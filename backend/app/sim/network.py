"""Industrial WSN simulator with trust-aware AODV routing.

Models a field of sensor nodes around a sink. A configurable subset are
malicious and mount blackhole / Sybil / wormhole / grayhole behaviour.
A behaviour-based trust engine penalises nodes for packet drops, delay
anomalies and identity anomalies; nodes below the threshold are isolated and
routes are rebuilt to avoid them. Each detection seals an event-driven block.
"""
import random
import math
from dataclasses import dataclass, field

from .blockchain import Blockchain
from ..core.config import get_settings

ATTACKS = ["Blackhole", "Sybil", "Wormhole", "Grayhole"]
SEVERITY = {"Blackhole": "Critical", "Sybil": "High", "Wormhole": "Critical", "Grayhole": "Medium"}


@dataclass
class Node:
    uid: str
    role: str = "Sensor"
    pos: tuple[float, float] = (0.0, 0.0)
    energy: float = 100.0
    trust: float = 1.0
    malicious: bool = False
    attack: str | None = None
    isolated: bool = False
    fwd: int = 0
    drop: int = 0
    delay: float = 0.0


class WSNSimulator:
    def __init__(self, n_nodes: int = 24, n_malicious: int = 4, seed: int | None = None):
        self.s = get_settings()
        self.rng = random.Random(seed)
        self.chain = Blockchain(difficulty=self.s.BLOCK_DIFFICULTY)
        self.nodes: dict[str, Node] = {}
        self.detections: list[dict] = []
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
                uid=uid, role=role,
                pos=(round(self.rng.uniform(4, 96), 1), round(self.rng.uniform(4, 96), 1)),
                energy=round(self.rng.uniform(40, 99), 1),
                trust=round(self.rng.uniform(0.85, 0.99), 3),
                malicious=mal,
                attack=self.rng.choice(ATTACKS) if mal else None,
            )

    # ── trust engine ────────────────────────────────────────────────────────
    def evaluate_trust(self) -> list[dict]:
        """One evaluation round. Returns detections produced this round."""
        new_detections = []
        for n in self.nodes.values():
            if n.role == "Sink" or n.isolated:
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

        # event-driven: seal ONE block if anything was detected this round
        if new_detections:
            blk = self.chain.seal_block(new_detections, trigger_type="attack", validator_uid="N-001")
            for d in new_detections:
                d["block_index"] = blk.index
            self.detections.extend(new_detections)
        return new_detections

    def _make_detection(self, n: Node, trust_before, drop_ratio, delay_anom, identity) -> dict:
        attack = n.attack or "Grayhole"
        # isolate if below threshold
        if n.trust < self.s.TRUST_THRESHOLD:
            n.isolated = True
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
            "src_uid": src, "dst_uid": dst, "hops": hops, "hop_count": len(hops) - 1,
            "path_trust": round(min(trusts), 3), "latency": round(latency, 1),
            "is_active": True, "reconfigured": bool(avoided),
            "reason": f"Avoided isolated node {avoided[0]}" if avoided else None,
        }

    def _dist(self, a: Node, b: Node) -> float:
        return math.hypot(a.pos[0] - b.pos[0], a.pos[1] - b.pos[1])

    # ── metrics ─────────────────────────────────────────────────────────────
    def metrics(self) -> dict:
        active = [n for n in self.nodes.values() if not n.isolated]
        total_fwd = sum(n.fwd for n in self.nodes.values())
        total_drop = sum(n.drop for n in self.nodes.values())
        pdr = 100.0 * total_fwd / max(1, total_fwd + total_drop)
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
            "node_uid": n.uid, "label": f"Field Node {n.uid[-2:]}", "role": n.role,
            "pos_x": n.pos[0], "pos_y": n.pos[1], "energy": n.energy,
            "trust_score": n.trust, "is_malicious": n.malicious, "is_isolated": n.isolated,
            "status": "Isolated" if n.isolated else "Active",
            "packets_fwd": n.fwd, "packets_drop": n.drop, "avg_delay": round(n.delay, 1),
        } for n in self.nodes.values()]
