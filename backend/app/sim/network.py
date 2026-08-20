"""Industrial WSN simulator with trust-aware AODV routing.

Models a field of sensor nodes around a sink. A configurable subset are
malicious and mount blackhole / Sybil / wormhole / grayhole behaviour.
A behaviour-based trust engine penalises nodes for packet drops, delay
anomalies and identity anomalies; nodes below the threshold are isolated and
routes are rebuilt to avoid them. Each detection seals an event-driven block.
"""
import random
import math
import time
from dataclasses import dataclass, field

from .blockchain import Blockchain
from ..core.config import get_settings

ATTACKS = ["Blackhole", "Sybil", "Wormhole", "Grayhole"]
SEVERITY = {"Blackhole": "Critical", "Sybil": "High", "Wormhole": "Critical", "Grayhole": "Medium"}


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
    isolated_at: float | None = None
    partner: str | None = None  # colluding node uid — Wormhole is a two-node tunnel attack


class WSNSimulator:
    def __init__(self, n_nodes: int = 24, n_malicious: int = 4, seed: int | None = None):
        self.s = get_settings()
        self.rng = random.Random(seed)
        self.chain = Blockchain(difficulty=self.s.BLOCK_DIFFICULTY)
        self.nodes: dict[str, Node] = {}
        self.detections: list[dict] = []
        self.auto_healed: list[dict] = []
        self.recovery_events: list[dict] = []
        self.round_history: list[tuple[int, int]] = []  # recent (forwarded, dropped) per round — for a PDR that actually reacts
        self._build(n_nodes, n_malicious)

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
        for n in self.nodes.values():
            if n.malicious and n.attack == "Wormhole":
                n.partner = self._pick_wormhole_partner(n)

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

    # ── trust engine ────────────────────────────────────────────────────────
    ROUND_WINDOW = 6  # rounds kept for the live PDR window

    def evaluate_trust(self) -> list[dict]:
        """One evaluation round. Returns detections produced this round."""
        new_detections = []
        self.auto_healed = []
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

    def _probation_tick(self, n: Node):
        """Isolated nodes are excluded from routing/traffic, but if their
        attack has genuinely stopped (malicious cleared — by the operator
        or auto-attack toggling off) their trust is allowed to recover
        slowly. Only once trust proves itself back above the threshold is
        the node let back into the routing pool — never on a timer alone,
        so a still-malicious node can never talk its way back in."""
        if n.malicious:
            return  # still actively attacking — no recovery, ever
        trust_before = n.trust
        n.trust = round(min(1.0, n.trust + 0.015), 3)
        if n.trust >= self.s.TRUST_THRESHOLD:
            n.isolated = False
            duration = (time.time() - n.isolated_at) if n.isolated_at else 0.0
            self.auto_healed.append({
                "node_uid": n.uid, "trust_before": trust_before, "trust_after": n.trust,
                "duration_sec": round(duration, 1),
            })
            self._record_recovery(n, method="auto")

    def _record_recovery(self, n: Node, method: str):
        """Log how long a node stayed isolated before this recovery."""
        duration = (time.time() - n.isolated_at) if n.isolated_at else 0.0
        self.recovery_events.append({
            "node_uid": n.uid, "attack_type": n.attack, "zone_label": n.zone_label,
            "method": method, "duration_sec": round(duration, 1),
            "recovered_at": time.time(),
        })
        n.isolated_at = None

    def _make_detection(self, n: Node, trust_before, drop_ratio, delay_anom, identity) -> dict:
        attack = n.attack or "Grayhole"
        # isolate if below threshold
        if n.trust < self.s.TRUST_THRESHOLD:
            n.isolated = True
            n.isolated_at = time.time()
            status, mitigation = "Isolated", "Node isolated; routes reconfigured"
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
        active = [n for n in self.nodes.values() if not n.isolated]
        # PDR reacts to the last few rounds only, not the whole run's history —
        # otherwise a long-running demo makes new attacks/recoveries invisible
        # because they get diluted into an ever-growing all-time average.
        window_fwd = sum(f for f, _ in self.round_history)
        window_drop = sum(d for _, d in self.round_history)
        pdr = 100.0 * window_fwd / max(1, window_fwd + window_drop)
        mal_active = sum(1 for n in self.nodes.values() if n.malicious and not n.isolated)
        return {
            "pdr": round(pdr, 1),
            "avg_delay": round(self.rng.uniform(12, 40) - mal_active, 1),
            "throughput": round(180 + len(active) * 5 + self.rng.uniform(0, 40), 1),
            "energy_avg": round(sum(n.energy for n in active) / max(1, len(active)), 1),
            "alive_nodes": len(active),
            "malicious_active": mal_active,
            # overhead is low & only rises with detection activity (event-driven)
            "overhead": round(2.0 + len(self.detections) * 0.05, 2),
        }

    def topology(self) -> list[dict]:
        return [{
            "node_uid": n.uid, "label": n.label or f"Field Node {n.uid[-2:]}", "role": n.role,
            "pos_x": n.pos[0], "pos_y": n.pos[1], "energy": n.energy,
            "trust_score": n.trust, "is_malicious": n.malicious, "is_isolated": n.isolated,
            "status": "Isolated" if n.isolated else "Active",
            "packets_fwd": n.fwd, "packets_drop": n.drop, "avg_delay": round(n.delay, 1),
            "zone": n.zone, "zone_label": n.zone_label,
            "attack": n.attack, "partner": n.partner if n.attack == "Wormhole" else None,
        } for n in self.nodes.values()]

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
        n.partner = self._pick_wormhole_partner(n) if attack_type == "Wormhole" else None
        # nudge trust just above threshold so the live drop is visible within a tick or two
        n.trust = round(max(self.s.TRUST_THRESHOLD + 0.22, min(n.trust, 0.8)), 3)
        return n

    def isolate_node(self, uid: str) -> Node | None:
        n = self.nodes.get(uid)
        if not n:
            return None
        n.isolated = True
        n.isolated_at = time.time()
        n.trust = 0.1
        return n

    def restore_node(self, uid: str) -> Node | None:
        n = self.nodes.get(uid)
        if not n:
            return None
        if n.isolated:
            self._record_recovery(n, method="manual")
        n.isolated = False
        n.malicious = False
        n.attack = None
        n.partner = None
        n.trust = 0.85
        return n

    def recover_all(self) -> int:
        cnt = 0
        for n in self.nodes.values():
            if n.malicious or n.isolated:
                if n.isolated:
                    self._record_recovery(n, method="manual")
                n.malicious = False
                n.attack = None
                n.partner = None
                n.isolated = False
                n.trust = 0.85
                cnt += 1
        return cnt
