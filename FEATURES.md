# TrustChain-WSN — Feature & Architecture Notes

Talking points mapped to the project abstract (novelty, attacks, results).

## The framework, end to end

```
Sensor nodes forward packets  →  Trust engine scores behaviour
        │                              │ (drop ratio · delay anomaly · identity)
        │                              ▼
        │                     trust < 0.40 ?  ──no──►  keep routing
        │                              │ yes
        ▼                              ▼
  AODV route discovery   ◄───  Isolate node  +  Seal ONE blockchain block
  (avoids isolated nodes)        (event-driven — only on detection)
```

## Novelty (say it confidently)
- **Event-driven blockchain** — `seal_block()` is invoked *only* when the trust
  engine produces detections, not on a timer. See
  [`backend/app/sim/network.py`](backend/app/sim/network.py) → `evaluate_trust()`
  and [`backend/app/sim/blockchain.py`](backend/app/sim/blockchain.py).
- **Lightweight chain** — small PoW difficulty + merkle root per block; cheap
  enough for resource-constrained nodes. Overhead metric stays low and only
  rises slightly with detection activity.
- **Behaviour-based trust** — combines packet-drop ratio, delay anomaly and
  Sybil identity flag into a single live score.
- **Unified multi-attack defense** — Blackhole, Sybil, Wormhole, Grayhole.
- **Detect → prevent → recover** — isolation + dynamic route reconfiguration,
  not just detection.

## Attacks handled
| Attack | Signal used | Severity |
|--------|-------------|----------|
| Blackhole | very high drop ratio (~95%) | Critical |
| Grayhole  | selective drops (~50%) | Medium |
| Wormhole  | delay/topology anomaly | Critical |
| Sybil     | identity anomaly flag | High |

## Results shown (Performance page)
- **PDR** rises as malicious nodes are isolated.
- **Delay** drops once wormhole/grayhole nodes are removed.
- **Throughput** and **energy** trends.
- **Overhead** stays low — the visual proof of the event-driven design.

## Chain integrity
The Ledger page verifies the chain client-side (each block's `prev_hash` must
equal the previous block's `block_hash`) and the backend exposes
`GET /api/ledger/verify`.

## UI design note
This console deliberately uses a **top horizontal navigation bar** and an
amber/cyan industrial theme so it is visually distinct from the team's sibling
WAF project (which uses a left sidebar and a green theme).
