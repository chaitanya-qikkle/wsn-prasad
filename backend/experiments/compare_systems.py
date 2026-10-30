"""Existing system vs proposed TrustChain, measured on the real simulator.

Both systems get the same 24-node networks and the same four attackers (one of
each attack type) at round 5. Results are averaged over SEEDS runs and written
to a CSV, one row per round, which the report's result graphs are drawn from.

    python backend/experiments/compare_systems.py [output.csv]

Measurement model:
  PDR         chance a sensor's packet survives every node on its route;
              a benign node drops 2.5% (mean of the simulator's 0-5%), an
              attacker drops its DROP_RATIO share
  Delay       route latency x transmission attempts, 1/PDR capped at 3 because
              an undelivered packet is retried at most twice
  Throughput  delivered packets x 64 bytes, each sensor sending 40 packets per
              2-second round (mean of the simulator's 20-60)
  Energy      average battery spent per node since the start of the run
"""
import csv
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.sim.network import ATTACKS, DROP_RATIO, WSNSimulator  # noqa: E402

SEEDS = 30
ROUNDS = 40
ATTACK_ROUND = 5
BENIGN_DROP = 0.025
MAX_ATTEMPTS = 3
PACKETS_PER_ROUND = 40
PACKET_BYTES = 64
ROUND_SEC = 2
FIELDS = ["pdr", "delay", "throughput", "energy"]


def sample(sim, start_energy):
    """Measure one round across every sensor still sending."""
    sensors = [n for n in sim.nodes.values() if n.role == "Sensor" and not n.isolated and n.energy > 0]
    delivered, delays = 0.0, []
    for s in sensors:
        route = sim.discover_route(s.uid)
        if not route["is_active"]:
            continue
        p = 1.0
        for uid in route["hops"][:-1]:
            n = sim.nodes[uid]
            p *= 1 - (DROP_RATIO[n.attack] if n.malicious else BENIGN_DROP)
        delivered += p
        delays.append(route["latency"] * min(MAX_ATTEMPTS, 1 / max(p, 1e-6)))
    spent = [start_energy[u] - n.energy for u, n in sim.nodes.items() if n.role != "Sink"]
    return {
        "pdr": 100 * delivered / max(1, len(sensors)),
        "delay": sum(delays) / max(1, len(delays)),
        "throughput": delivered * PACKETS_PER_ROUND * PACKET_BYTES * 8 / ROUND_SEC / 1000,
        "energy": sum(spent) / len(spent),
    }


def run(seed, existing):
    sim = WSNSimulator(n_nodes=24, n_malicious=0, seed=seed)
    sim.set_baseline_mode(existing)
    pick = random.Random(seed)
    attackers = pick.sample([u for u, n in sim.nodes.items() if n.role != "Sink"], len(ATTACKS))
    start_energy = {u: n.energy for u, n in sim.nodes.items()}
    rows = []
    for r in range(ROUNDS):
        if r == ATTACK_ROUND:
            for uid, attack in zip(attackers, ATTACKS):
                sim.inject_attack(uid, attack)
        sim.evaluate_trust()
        rows.append(sample(sim, start_energy))
    return rows


def main():
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("TrustChain-Results.csv")
    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["round"] + [f"{m}_{s}" for s in ("existing", "proposed") for m in FIELDS])
        results = {e: [run(seed, e) for seed in range(SEEDS)] for e in (True, False)}
        for r in range(ROUNDS):
            row = [r]
            for e in (True, False):
                row += [round(sum(run_[r][m] for run_ in results[e]) / SEEDS, 2) for m in FIELDS]
            w.writerow(row)
    print("wrote", out)


if __name__ == "__main__":
    main()
