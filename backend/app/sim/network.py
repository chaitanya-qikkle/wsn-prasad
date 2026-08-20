"""Industrial WSN simulator with trust-aware AODV routing.

Models a field of sensor nodes around a sink. A configurable subset are
malicious and mount blackhole / Sybil / wormhole / grayhole behaviour.
A behaviour-based trust engine penalises nodes for packet drops, delay
anomalies and identity anomalies; nodes below the threshold are isolated and
routes are rebuilt to avoid them. Each detection seals an event-driven block.

Isolation is not the end of the story: quarantined nodes are automatically
remediated by the trust engine and readmitted once their trust proves itself
again, and every stage of that lifecycle is timed so the proposed system can
be compared against the "existing system" baseline (no trust engine, no
automatic recovery).
"""
import random
import math
import time
import uuid
from dataclasses import dataclass

from .blockchain import Blockchain
from ..core.config import get_settings

ATTACKS = ["Blackhole", "Sybil", "Wormhole", "Grayhole"]
SEVERITY = {"Blackhole": "Critical", "Sybil": "High", "Wormhole": "Critical", "Grayhole": "Medium"}

# Node lifecycle phases, in order. Drives the UI's recovery timeline.
PHASE_ACTIVE      = "Active"
PHASE_COMPROMISED = "Compromised"
PHASE_DETECTED    = "Detected"
PHASE_ISOLATED    = "Isolated"
PHASE_REMEDIATING = "Remediating"
PHASE_RECOVERED   = "Recovered"


@dataclass
class Node:
    uid: str
    role: str = "Sensor"
    label: str = ""
    pos: tuple[float, float] = (0.0, 0.0)
    energy: float = 100.0
    trust: float = 1.0
    malicious: bool = False
    attack: str | None = None
    isolated: bool = False
    fwd: int = 0
    drop: int = 0
    delay: float = 0.0
    zone: str = ""
    zone_label: str = ""
    partner: str | None = None  # colluding node uid — Wormhole is a two-node tunnel attack
    # ── recovery lifecycle ────────────────────────────────────────────────
    phase: str = PHASE_ACTIVE
    attack_started_at: float | None = None
    detected_at: float | None = None
    isolated_at: float | None = None
    remediated_at: float | None = None
    recovered_at: float | None = None
    quarantine_ticks: int = 0
    last_attack: str | None = None   # survives remediation, for "recovered from X" labels
    episode_id: str | None = None

    def clear_lifecycle(self):
        self.phase = PHASE_ACTIVE
        self.attack_started_at = None
        self.detected_at = None
        self.isolated_at = None
        self.remediated_at = None
        self.quarantine_ticks = 0
        self.episode_id = None


class WSNSimulator:
    def __init__(self, n_nodes: int = 24, n_malicious: int = 4, seed: int | None = None):
        self.s = get_settings()
        self.rng = random.Random(seed)
        self.chain = Blockchain(difficulty=self.s.BLOCK_DIFFICULTY)
        self.nodes: dict[str, Node] = {}
        self.detections: list[dict] = []
        self.auto_healed: list[dict] = []       # readmitted to routing this round
        self.auto_remediated: list[dict] = []   # attack payload scrubbed this round
        self.recovery_events: list[dict] = []
        self.episodes: list[dict] = []          # one per attack, open or closed — the timeline
        self._open: dict[str, dict] = {}        # node_uid -> its currently-open episode
        self.round_history: list[tuple[int, int]] = []  # recent (forwarded, dropped) per round — for a PDR that actually reacts
        self.baseline_mode = False  # "existing system" — no trust engine, nothing gets isolated
        self.round_no = 0
        self._metrics_cache: dict | None = None
        self._metrics_round = -1
        self._build(n_nodes, n_malicious)

    def set_baseline_mode(self, on: bool):
        self.baseline_mode = bool(on)

    def _build(self, n, m):
        roles = ["Sink"] + ["Cluster Head"] * 3 + ["Relay"] * 4 + ["Gateway"]
        roles += ["Sensor"] * (n - len(roles))
        mal_ids = set(self.rng.sample(range(2, n + 1), min(m, n - 1)))
        for i in range(1, n + 1):
            uid = f"N-{i:03d}"
            role = "Sink" if i == 1 else roles[i - 1]
            mal = i in mal_ids
            self.nodes[uid] = Node(
                uid=uid, role=role, label=f"Field Node {uid[-2:]}",
                pos=(round(self.rng.uniform(4, 96), 1), round(self.rng.uniform(4, 96), 1)),
                energy=round(self.rng.uniform(40, 99), 1),
                trust=round(self.rng.uniform(0.85, 0.99), 3),
                malicious=mal,
                attack=self.rng.choice(ATTACKS) if mal else None,
            )
        self._assign_zones()
        for nd in self.nodes.values():
            if nd.malicious:
                if nd.attack == "Wormhole":
                    nd.partner = self._pick_wormhole_partner(nd)
                self._open_episode(nd)

    def _pick_wormhole_partner(self, n: Node) -> str | None:
        """Wormhole is a two-node tunnel — pick the nearest other node to
        collude with, purely for visualising the tunnel on the map."""
        others = [o for o in self.nodes.values() if o.uid != n.uid and o.role != "Sink"]
        if not others:
            return None
        return min(others, key=lambda o: self._dist(n, o)).uid

    def _assign_zones(self):
        """Group every node under its nearest Cluster Head — 'Zone A/B/C…' —
        so the topology map can show areas instead of one flat field."""
        heads = [n for n in self.nodes.values() if n.role == "Cluster Head"]
        letters = "ABCDEFGH"
        for i, h in enumerate(heads):
            h.zone = h.uid
            h.zone_label = f"Zone {letters[i % len(letters)]}"
        if not heads:
            return
        for n in self.nodes.values():
            if n.role in ("Sink", "Cluster Head"):
                continue
            nearest = min(heads, key=lambda h: self._dist(n, h))
            n.zone = nearest.zone
            n.zone_label = nearest.zone_label

    # ── attack episodes (the "how long did it take" record) ─────────────────
    def _open_episode(self, n: Node) -> dict:
        """Start timing a fresh attack on this node. One episode spans
        injection → detection → isolation → remediation → readmission, so the
        UI can show both the total attack duration and each stage's cost."""
        attack = n.attack or n.last_attack or "Manual Isolation"
        ep = {
            "id": uuid.uuid4().hex,
            "node_uid": n.uid,
            "attack_type": attack,
            "severity": SEVERITY.get(attack, "Medium"),
            "zone_label": n.zone_label,
            "mode": "existing" if self.baseline_mode else "proposed",
            "status": PHASE_COMPROMISED,
            "started_at": time.time(),
            "detected_at": None, "isolated_at": None,
            "remediated_at": None, "recovered_at": None,
            "detect_sec": None, "isolate_sec": None,
            "remediate_sec": None, "recover_sec": None, "total_sec": None,
        }
        n.phase = PHASE_COMPROMISED
        n.attack_started_at = ep["started_at"]
        n.last_attack = attack
        n.episode_id = ep["id"]
        self.episodes.append(ep)
        self._open[n.uid] = ep
        return ep

    def _stamp(self, n: Node, stage: str):
        """Record a lifecycle transition on the node's open episode."""
        ep = self._open.get(n.uid)
        if not ep:
            return
        now = time.time()
        start = ep["started_at"]
        if stage == "detected" and ep["detected_at"] is None:
            ep["detected_at"] = now
            ep["detect_sec"] = round(now - start, 1)
            ep["status"] = PHASE_DETECTED
            n.detected_at = now
        elif stage == "isolated" and ep["isolated_at"] is None:
            ep["isolated_at"] = now
            ep["isolate_sec"] = round(now - start, 1)
            ep["status"] = PHASE_ISOLATED
        elif stage == "remediated" and ep["remediated_at"] is None:
            ep["remediated_at"] = now
            ep["remediate_sec"] = round(now - (ep["isolated_at"] or start), 1)
            ep["status"] = PHASE_REMEDIATING
        elif stage == "recovered" and ep["recovered_at"] is None:
            ep["recovered_at"] = now
            # recovery time = how long the node was out of the routing pool
            ep["recover_sec"] = round(now - (ep["isolated_at"] or start), 1)
            ep["total_sec"] = round(now - start, 1)
            ep["status"] = PHASE_RECOVERED
            self._open.pop(n.uid, None)

    def open_attack_seconds(self) -> float:
        """Longest currently-unresolved attack, in seconds — the live
        'this network has been under attack for N s' counter."""
        if not self._open:
            return 0.0
        now = time.time()
        return round(max(now - ep["started_at"] for ep in self._open.values()), 1)

    # ── trust engine ────────────────────────────────────────────────────────
    ROUND_WINDOW = 6  # rounds kept for the live PDR window

    def evaluate_trust(self) -> list[dict]:
        """One evaluation round. Returns detections produced this round."""
        self.round_no += 1
        new_detections = []
        self.auto_healed = []
        self.auto_remediated = []
        round_fwd = 0
        round_drop = 0
        for n in self.nodes.values():
            if n.role == "Sink":
                continue
            if n.isolated:
                self._probation_tick(n)
                continue
            # simulate one forwarding window
            traffic = self.rng.randint(20, 60)
            if n.malicious:
                drop_ratio = {"Blackhole": 0.95, "Grayhole": 0.5, "Wormhole": 0.3, "Sybil": 0.2}[n.attack]
                dropped = int(traffic * drop_ratio)
                delay_anom = self.rng.uniform(2.0, 6.0) if n.attack in ("Wormhole", "Grayhole") else self.rng.uniform(0.5, 2.0)
                identity = n.attack == "Sybil"
            else:
                dropped = int(traffic * self.rng.uniform(0, 0.05))
                delay_anom = self.rng.uniform(0, 0.8)
                identity = False

            forwarded = traffic - dropped
            n.fwd += forwarded
            n.drop += dropped
            round_fwd += forwarded
            round_drop += dropped
            n.energy = max(0.0, n.energy - self.rng.uniform(0.1, 0.6))

            trust_before = n.trust
            penalty = (dropped / traffic) * self.s.DROP_PENALTY * 10
            penalty += max(0, delay_anom - 1) * self.s.DELAY_PENALTY
            if identity:
                penalty += 0.06
            n.trust = round(max(0.0, min(1.0, n.trust - penalty + (0.01 if not n.malicious else 0))), 3)

            # detection: trust crossed threshold OR strong anomaly on malicious node
            crossed = trust_before >= self.s.TRUST_THRESHOLD > n.trust
            if crossed or (n.malicious and n.trust < self.s.TRUST_THRESHOLD and self.rng.random() < 0.4):
                det = self._make_detection(n, trust_before, dropped / traffic, delay_anom, identity)
                new_detections.append(det)

        self.round_history.append((round_fwd, round_drop))
        if len(self.round_history) > self.ROUND_WINDOW:
            self.round_history.pop(0)

        # event-driven: seal ONE block if anything was detected this round
        if new_detections:
            blk = self.chain.seal_block(new_detections, trigger_type="attack", validator_uid="N-001")
            for d in new_detections:
                d["block_index"] = blk.index
            self.detections.extend(new_detections)
        return new_detections

    # ── automatic recovery ──────────────────────────────────────────────────
    def readmit_trust(self) -> float:
        """Trust a quarantined node must reach to rejoin the routing pool."""
        return round(min(1.0, self.s.TRUST_THRESHOLD + self.s.READMIT_MARGIN), 3)

    def _probation_tick(self, n: Node):
        """The automatic-recovery pipeline, one tick at a time.

        An isolated node is out of the routing pool, so it can do no further
        harm. From there the trust engine runs recovery in two stages:

          1. Quarantine + remediation. After QUARANTINE_TICKS rounds of
             isolation the node's compromised behaviour is scrubbed (attack
             cleared, wormhole tunnel torn down). This is what makes recovery
             *automatic* — no operator action is required.
          2. Probation. Trust rebuilds a little each round. Only once it
             proves itself back above the threshold is the node readmitted —
             never on a timer alone, so a node that is still misbehaving can
             never talk its way back in.

        In baseline ("existing system") mode neither stage runs: an attack
        there stays live until a human intervenes, which is exactly the gap
        the comparison is meant to show.
        """
        n.quarantine_ticks += 1

        if n.malicious:
            if self.baseline_mode or not self.s.AUTO_RECOVERY:
                return  # existing system — no self-healing, ever
            if n.quarantine_ticks < self.s.QUARANTINE_TICKS:
                return  # still being scrubbed
            cleared = n.attack
            n.malicious = False
            n.attack = None
            n.partner = None
            n.remediated_at = time.time()
            n.phase = PHASE_REMEDIATING
            self._stamp(n, "remediated")
            self.auto_remediated.append({
                "node_uid": n.uid, "attack_type": cleared, "zone_label": n.zone_label,
                "quarantine_sec": round(time.time() - (n.isolated_at or time.time()), 1),
            })
            return

        # probation — rebuild trust until it clears the readmission bar. That
        # bar sits above the isolation threshold on purpose: readmitting a node
        # at exactly the threshold puts it one bad round away from being
        # quarantined again, which shows up as a node flapping in and out of
        # service instead of recovering.
        trust_before = n.trust
        n.trust = round(min(1.0, n.trust + self.s.TRUST_REBUILD_RATE), 3)
        if n.trust >= self.readmit_trust():
            n.isolated = False
            n.phase = PHASE_RECOVERED
            n.recovered_at = time.time()
            duration = (time.time() - n.isolated_at) if n.isolated_at else 0.0
            self.auto_healed.append({
                "node_uid": n.uid, "trust_before": trust_before, "trust_after": n.trust,
                "duration_sec": round(duration, 1), "attack_type": n.last_attack,
            })
            self._record_recovery(n, method="auto")

    def _record_recovery(self, n: Node, method: str):
        """Log how long a node stayed isolated before this recovery."""
        now = time.time()
        duration = (now - n.isolated_at) if n.isolated_at else 0.0
        ep = self._open.get(n.uid)
        self._stamp(n, "recovered")
        self.recovery_events.append({
            "node_uid": n.uid, "attack_type": n.last_attack, "zone_label": n.zone_label,
            "method": method, "duration_sec": round(duration, 1),
            "total_sec": (ep or {}).get("total_sec"),
            "detect_sec": (ep or {}).get("detect_sec"),
            "recovered_at": now,
        })
        n.isolated_at = None
        n.quarantine_ticks = 0
        n.recovered_at = now
        n.phase = PHASE_RECOVERED

    def _make_detection(self, n: Node, trust_before, drop_ratio, delay_anom, identity) -> dict:
        attack = n.attack or "Grayhole"
        # A benign node can also decay below the threshold. Time that episode
        # too, so every period a node spends out of service is accounted for.
        if n.uid not in self._open:
            self._open_episode(n)
        self._stamp(n, "detected")
        if n.phase in (PHASE_ACTIVE, PHASE_COMPROMISED):
            n.phase = PHASE_DETECTED
        if self.baseline_mode:
            # "existing system" — the anomaly is visible but nothing acts on
            # it: no trust engine means no automatic isolation, no recovery,
            # no rerouting. This is the honest baseline for the comparison.
            status, mitigation = "Detected", "No automatic defense — existing system has no trust engine"
        elif n.trust < self.s.TRUST_THRESHOLD:
            n.isolated = True
            n.isolated_at = time.time()
            n.quarantine_ticks = 0
            n.phase = PHASE_ISOLATED
            self._stamp(n, "isolated")
            status, mitigation = "Isolated", "Node isolated; routes reconfigured; automatic recovery started"
        else:
            status, mitigation = "Detected", "Trust penalized; monitored"
        return {
            "node_uid": n.uid, "attack_type": attack, "severity": SEVERITY[attack],
            "confidence": round(min(0.99, 0.7 + drop_ratio * 0.3), 3),
            "trust_before": round(trust_before, 3), "trust_after": n.trust,
            "drop_ratio": round(drop_ratio, 3), "delay_anomaly": round(delay_anom, 2),
            "identity_flag": identity, "status": status, "mitigation": mitigation,
        }

    # ── routing (trust-aware AODV) ──────────────────────────────────────────
    def discover_route(self, src: str, dst: str = "N-001") -> dict | None:
        """Greedy trust+distance route to the sink avoiding isolated nodes."""
        if src not in self.nodes:
            return None
        avoided = [u for u, n in self.nodes.items() if n.isolated or n.trust < self.s.TRUST_THRESHOLD]
        candidates = [n for n in self.nodes.values() if not n.isolated and n.trust >= self.s.TRUST_THRESHOLD]
        cur = self.nodes[src]
        hops = [src]
        visited = {src}
        latency = 0.0
        for _ in range(6):
            if cur.uid == dst:
                break
            nxt = min(
                (c for c in candidates if c.uid not in visited),
                key=lambda c: self._dist(c, self.nodes[dst]) / max(c.trust, 0.01),
                default=None,
            )
            if not nxt:
                break
            hops.append(nxt.uid)
            visited.add(nxt.uid)
            latency += self._dist(cur, nxt) * 0.8 + self.rng.uniform(2, 8)
            cur = nxt
        if hops[-1] != dst:
            hops.append(dst)
        trusts = [self.nodes[h].trust for h in hops]
        return {
            "id": f"{src}-{dst}", "src_uid": src, "dst_uid": dst, "hops": hops, "hop_count": len(hops) - 1,
            "path_trust": round(min(trusts), 3), "latency": round(latency, 1),
            "is_active": True, "reconfigured": bool(avoided),
            "reason": f"Avoided isolated node {avoided[0]}" if avoided else None,
        }

    def _dist(self, a: Node, b: Node) -> float:
        return math.hypot(a.pos[0] - b.pos[0], a.pos[1] - b.pos[1])

    # ── metrics ─────────────────────────────────────────────────────────────
    def metrics(self) -> dict:
        """Cached for the current round.

        metrics() is read several times per tick (stats, history snapshot,
        the WS payload). Some fields are sampled from the RNG, so recomputing
        would hand each caller a *different* number for the same instant —
        which is exactly how the dashboard ends up disagreeing with the
        sidebar. One value per round, shared by every reader.
        """
        if self._metrics_cache is not None and self._metrics_round == self.round_no:
            return self._metrics_cache

        active = [n for n in self.nodes.values() if not n.isolated]
        # PDR reacts to the last few rounds only, not the whole run's history —
        # otherwise a long-running demo makes new attacks/recoveries invisible
        # because they get diluted into an ever-growing all-time average.
        window_fwd = sum(f for f, _ in self.round_history)
        window_drop = sum(d for _, d in self.round_history)
        total = window_fwd + window_drop
        # A network that has not forwarded anything yet has not dropped
        # anything either — report a clean 100%, not 0%, before the first round.
        pdr = 100.0 if total == 0 else 100.0 * window_fwd / total
        mal_active = sum(1 for n in self.nodes.values() if n.malicious and not n.isolated)
        m = {
            "pdr": round(pdr, 1),
            "avg_delay": round(self.rng.uniform(12, 40) - mal_active, 1),
            "throughput": round(180 + len(active) * 5 + self.rng.uniform(0, 40), 1),
            "energy_avg": round(sum(n.energy for n in active) / max(1, len(active)), 1),
            "alive_nodes": len(active),
            "malicious_active": mal_active,
            # overhead is low & only rises with detection activity (event-driven)
            "overhead": round(2.0 + len(self.detections) * 0.05, 2),
        }
        self._metrics_cache = m
        self._metrics_round = self.round_no
        return m

    def topology(self) -> list[dict]:
        return [{
            "node_uid": n.uid, "label": n.label or f"Field Node {n.uid[-2:]}", "role": n.role,
            "pos_x": n.pos[0], "pos_y": n.pos[1], "energy": n.energy,
            "trust_score": n.trust, "is_malicious": n.malicious, "is_isolated": n.isolated,
            "status": "Isolated" if n.isolated else "Active",
            "packets_fwd": n.fwd, "packets_drop": n.drop, "avg_delay": round(n.delay, 1),
            "zone": n.zone, "zone_label": n.zone_label,
            "attack": n.attack, "partner": n.partner if n.attack == "Wormhole" else None,
            "phase": n.phase, "last_attack": n.last_attack,
            "recovering": n.isolated and not n.malicious,
            "quarantine_ticks": n.quarantine_ticks,
            "recovered_at": n.recovered_at,
        } for n in self.nodes.values()]

    def recovery_summary(self) -> dict:
        """Aggregate timings, split by system — this is the guide's
        'existing vs proposed' comparison, measured rather than claimed."""
        done = [e for e in self.episodes if e["status"] == PHASE_RECOVERED and e["total_sec"] is not None]
        prop = [e for e in done if e["mode"] == "proposed"]
        detected = [e for e in self.episodes if e["detect_sec"] is not None]

        def avg(vals):
            vals = [v for v in vals if v is not None]
            return round(sum(vals) / len(vals), 1) if vals else None

        return {
            "totalEpisodes": len(self.episodes),
            "recovered": len(done),
            "unresolved": len(self._open),
            "avgDetectSec": avg([e["detect_sec"] for e in detected]),
            "avgIsolateSec": avg([e["isolate_sec"] for e in self.episodes]),
            "avgRecoverSec": avg([e["recover_sec"] for e in prop]),
            "avgTotalSec": avg([e["total_sec"] for e in prop]),
            "worstTotalSec": max([e["total_sec"] for e in prop], default=None),
            "bestTotalSec": min([e["total_sec"] for e in prop], default=None),
            "openSec": self.open_attack_seconds(),
            "autoRecoveries": sum(1 for e in self.recovery_events if e["method"] == "auto"),
            "manualRecoveries": sum(1 for e in self.recovery_events if e["method"] == "manual"),
        }

    # ── attack containment cap ────────────────────────────────────────────────
    def malicious_count(self) -> int:
        return sum(1 for n in self.nodes.values() if n.role != "Sink" and n.malicious)

    def malicious_cap(self) -> int:
        non_sink = sum(1 for n in self.nodes.values() if n.role != "Sink")
        return max(1, round(non_sink * self.s.MAX_MALICIOUS_PCT))

    def malicious_cap_reached(self) -> bool:
        return self.malicious_count() >= self.malicious_cap()

    # ── user actions (mirrors frontend engine.js semantics) ──────────────────
    def inject_attack(self, uid: str, attack_type: str = "Blackhole") -> Node | None:
        n = self.nodes.get(uid)
        if not n or n.role == "Sink":
            return None
        if not n.malicious and self.malicious_cap_reached():
            return None  # containment cap — never let an attack spread to the whole network
        n.malicious = True
        n.attack = attack_type
        n.isolated = False
        n.isolated_at = None
        n.recovered_at = None
        n.quarantine_ticks = 0
        n.partner = self._pick_wormhole_partner(n) if attack_type == "Wormhole" else None
        # nudge trust just above threshold so the live drop is visible within a tick or two
        n.trust = round(max(self.s.TRUST_THRESHOLD + 0.22, min(n.trust, 0.8)), 3)
        self._open_episode(n)
        return n

    def isolate_node(self, uid: str) -> Node | None:
        n = self.nodes.get(uid)
        if not n:
            return None
        n.isolated = True
        n.isolated_at = time.time()
        n.quarantine_ticks = 0
        n.phase = PHASE_ISOLATED
        n.trust = 0.1
        if n.uid not in self._open:
            self._open_episode(n)
        self._stamp(n, "isolated")
        return n

    def restore_node(self, uid: str) -> Node | None:
        n = self.nodes.get(uid)
        if not n:
            return None
        if n.attack:
            n.last_attack = n.attack
        n.isolated = False
        n.malicious = False
        n.attack = None
        n.partner = None
        n.trust = 0.85
        if n.uid in self._open:
            self._record_recovery(n, method="manual")
        else:
            n.clear_lifecycle()
        return n

    def recover_all(self) -> int:
        cnt = 0
        for n in list(self.nodes.values()):
            if n.malicious or n.isolated:
                self.restore_node(n.uid)
                cnt += 1
        return cnt
