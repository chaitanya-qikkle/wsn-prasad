"""Lightweight, event-driven blockchain for WSN attack provenance.

Key design point (project novelty): blocks are NOT produced on a timer or
continuously. `seal_block` is only called when the trust engine reports a
detection / isolation event, which keeps computational and communication
overhead low compared with continuous-blockchain approaches.
"""
import hashlib
import json
import time
from dataclasses import dataclass, field, asdict
from typing import Any


def _sha256(data: str) -> str:
    return hashlib.sha256(data.encode()).hexdigest()


def merkle_root(events: list[dict]) -> str:
    if not events:
        return _sha256("")
    layer = [_sha256(json.dumps(e, sort_keys=True)) for e in events]
    while len(layer) > 1:
        if len(layer) % 2:
            layer.append(layer[-1])
        layer = [_sha256(layer[i] + layer[i + 1]) for i in range(0, len(layer), 2)]
    return layer[0]


@dataclass
class Block:
    index: int
    prev_hash: str
    payload: dict
    trigger_type: str = "attack"
    validator_uid: str | None = None
    difficulty: int = 2
    nonce: int = 0
    merkle: str = ""
    timestamp: float = field(default_factory=time.time)
    hash: str = ""

    def compute_hash(self) -> str:
        body = json.dumps({
            "index": self.index, "prev": self.prev_hash, "merkle": self.merkle,
            "nonce": self.nonce, "ts": round(self.timestamp, 3),
            "trigger": self.trigger_type,
        }, sort_keys=True)
        return _sha256(body)

    def mine(self) -> "Block":
        target = "0" * self.difficulty
        self.merkle = merkle_root(self.payload.get("events", []) or [self.payload])
        while True:
            self.hash = self.compute_hash()
            if self.hash.startswith(target):
                return self
            self.nonce += 1


class Blockchain:
    def __init__(self, difficulty: int = 2):
        self.difficulty = difficulty
        self.chain: list[Block] = []
        self._genesis()

    def _genesis(self):
        g = Block(index=0, prev_hash="0" * 64,
                  payload={"genesis": True, "network": "Industrial-WSN"},
                  trigger_type="genesis", difficulty=self.difficulty)
        g.mine()
        self.chain.append(g)

    @property
    def head(self) -> Block:
        return self.chain[-1]

    def seal_block(self, events: list[dict], trigger_type: str = "attack",
                   validator_uid: str | None = None) -> Block:
        """Event-driven block production — only called on a detection event."""
        blk = Block(
            index=self.head.index + 1,
            prev_hash=self.head.hash,
            payload={"events": events, "count": len(events)},
            trigger_type=trigger_type,
            validator_uid=validator_uid,
            difficulty=self.difficulty,
        )
        blk.mine()
        self.chain.append(blk)
        return blk

    def is_valid(self) -> bool:
        for i in range(1, len(self.chain)):
            cur, prev = self.chain[i], self.chain[i - 1]
            if cur.prev_hash != prev.hash:
                return False
            if cur.compute_hash() != cur.hash:
                return False
        return True

    def to_list(self) -> list[dict]:
        out = []
        for b in self.chain:
            d = asdict(b)
            d["block_index"] = d.pop("index")
            d["block_hash"] = d.pop("hash")
            d["prev_hash"] = d["prev_hash"]
            d["merkle_root"] = d.pop("merkle")
            out.append(d)
        return out
