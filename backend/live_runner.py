"""
TrustChain-WSN — LIVE simulator → Supabase writer.

Runs the real WSN simulator (trust engine + multi-attack + event-driven
blockchain + AODV routing) and streams every change into Supabase so the
frontend updates in REAL TIME (no dummy data).

What one tick does:
  1. Runs one trust-evaluation round  (network.evaluate_trust())
  2. Pushes updated node trust / isolation / energy → sensor_nodes
  3. Inserts any new detections            → attack_events
  4. Seals + inserts the event-driven block → ledger_blocks (links attack.block_id)
  5. Appends a trust-history point per node → trust_history
  6. Rebuilds AODV routes                   → routing_paths
  7. Snapshots PDR / delay / throughput …   → network_metrics

Run:
    cd backend
    python live_runner.py                 # uses .env  (SUPABASE_URL + SUPABASE_SERVICE_KEY)
    python live_runner.py --interval 4    # seconds between ticks (default 5)
    python live_runner.py --reset         # wipe demo tables and re-seed first

The frontend reads these tables directly (with Supabase Realtime), so as this
loop writes, the teacher sees the network live: attacks arrive, trust drops,
nodes get isolated, blocks get sealed, PDR climbs back up.
"""
from __future__ import annotations

import argparse
import sys
import time
from datetime import datetime, timezone

# Windows consoles default to cp1252 and choke on ✓ / ⚠ / · symbols.
# Force UTF-8 so the live log prints cleanly everywhere.
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

from app.core.config import get_settings
from app.sim.network import WSNSimulator

try:
    from supabase import create_client, Client
except Exception:
    print("ERROR: supabase package not installed. Run: pip install -r requirements.txt")
    sys.exit(1)


# demo tables we own/clear (NOT profiles / notifications / auth)
DEMO_TABLES = [
    "attack_events", "trust_history", "network_metrics",
    "routing_paths", "ledger_blocks", "sensor_nodes",
]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def connect() -> Client:
    s = get_settings()
    key = s.SUPABASE_SERVICE_KEY or s.SUPABASE_ANON_KEY
    if not (s.SUPABASE_URL and key):
        print("ERROR: SUPABASE_URL / SUPABASE_SERVICE_KEY missing.")
        print("Create backend/.env with:")
        print("  SUPABASE_URL=https://<project>.supabase.co")
        print("  SUPABASE_SERVICE_KEY=<service_role secret>")
        sys.exit(1)
    if not s.SUPABASE_SERVICE_KEY:
        print("WARNING: using ANON key — writes will be blocked by RLS. "
              "Set SUPABASE_SERVICE_KEY in backend/.env.")
    return create_client(s.SUPABASE_URL, key)


def wipe(sb: Client) -> None:
    print("· wiping demo tables …")
    for t in DEMO_TABLES:
        try:
            # delete-all trick: match every row
            sb.table(t).delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
        except Exception as e:
            print(f"  (skip {t}: {e})")


# ── row builders (map simulator objects → DB columns) ───────────────────────
def node_row(n) -> dict:
    return {
        "node_uid": n.uid,
        "label": f"Field Node {n.uid[-2:]}",
        "role": n.role,
        "pos_x": n.pos[0], "pos_y": n.pos[1],
        "energy": round(n.energy, 1),
        "trust_score": round(n.trust, 3),
        "is_malicious": n.malicious,
        "is_isolated": n.isolated,
        "status": "Isolated" if n.isolated else "Active",
        "packets_fwd": n.fwd,
        "packets_drop": n.drop,
        "avg_delay": round(n.delay, 1),
        "last_seen": _now_iso(),
    }


def seed_nodes(sb: Client, sim: WSNSimulator) -> None:
    print("· seeding sensor nodes …")
    rows = [node_row(n) for n in sim.nodes.values()]
    sb.table("sensor_nodes").upsert(rows, on_conflict="node_uid").execute()


def push_nodes(sb: Client, sim: WSNSimulator) -> None:
    rows = [node_row(n) for n in sim.nodes.values()]
    sb.table("sensor_nodes").upsert(rows, on_conflict="node_uid").execute()


def push_block(sb: Client, blk) -> str | None:
    """Insert the sealed block; return its DB id (for linking detections)."""
    row = {
        "block_index": blk.index,
        "prev_hash": blk.prev_hash,
        "block_hash": blk.hash,
        "nonce": blk.nonce,
        "difficulty": blk.difficulty,
        "merkle_root": blk.merkle,
        "event_count": blk.payload.get("count", 1),
        "trigger_type": blk.trigger_type,
        "validator_uid": blk.validator_uid,
        "payload": blk.payload,
        "mined_at": _now_iso(),
    }
    res = sb.table("ledger_blocks").insert(row).execute()
    try:
        return res.data[0]["id"]
    except Exception:
        return None


def push_detections(sb: Client, dets: list[dict], block_db_id: str | None) -> None:
    if not dets:
        return
    rows = []
    for d in dets:
        rows.append({
            "timestamp": _now_iso(),
            "node_uid": d["node_uid"],
            "attack_type": d["attack_type"],
            "severity": d["severity"],
            "confidence": d["confidence"],
            "trust_before": d["trust_before"],
            "trust_after": d["trust_after"],
            "drop_ratio": d["drop_ratio"],
            "delay_anomaly": d["delay_anomaly"],
            "identity_flag": d["identity_flag"],
            "status": d["status"],
            "mitigation": d["mitigation"],
            "block_id": block_db_id,
        })
    sb.table("attack_events").insert(rows).execute()


def push_trust_history(sb: Client, sim: WSNSimulator) -> None:
    ts = _now_iso()
    rows = [{
        "node_uid": n.uid,
        "trust_score": round(n.trust, 3),
        "event": "isolated" if n.isolated else ("malicious" if n.malicious else "normal"),
        "recorded_at": ts,
    } for n in sim.nodes.values() if n.role != "Sink"]
    if rows:
        sb.table("trust_history").insert(rows).execute()


def push_routes(sb: Client, sim: WSNSimulator) -> None:
    # rebuild active AODV routes from a few source sensors to the sink
    sources = [u for u, n in sim.nodes.items()
               if n.role in ("Sensor", "Relay", "Gateway") and not n.isolated][:6]
    # mark old routes inactive, insert fresh ones
    try:
        sb.table("routing_paths").delete().neq(
            "id", "00000000-0000-0000-0000-000000000000").execute()
    except Exception:
        pass
    rows = []
    for src in sources:
        r = sim.discover_route(src)
        if not r:
            continue
        rows.append({
            "src_uid": r["src_uid"], "dst_uid": r["dst_uid"],
            "hops": r["hops"], "hop_count": r["hop_count"],
            "path_trust": r["path_trust"], "latency": r["latency"],
            "is_active": r["is_active"], "reconfigured": r["reconfigured"],
            "reason": r["reason"], "created_at": _now_iso(),
        })
    if rows:
        sb.table("routing_paths").insert(rows).execute()


def apply_commands(sb: Client, sim: WSNSimulator) -> list[str]:
    """Read un-consumed Simulation-page commands and apply them to the sim.

    Returns short log lines describing what was applied. Silently no-ops if the
    sim_control table does not exist yet (so the loop keeps running).
    """
    logs: list[str] = []
    try:
        res = (sb.table("sim_control").select("*")
               .eq("consumed", False).order("created_at", desc=False).limit(20).execute())
        rows = res.data or []
    except Exception:
        return logs  # table not created yet — ignore

    for cmd in rows:
        c = (cmd.get("command") or "").lower()
        note = None
        if c == "inject":
            uid = cmd.get("node_uid")
            atk = cmd.get("attack_type") or "Blackhole"
            n = sim.nodes.get(uid)
            if n and n.role != "Sink":
                n.malicious = True
                n.attack = atk
                n.isolated = False
                # nudge trust so the drop is visible quickly, but stays above threshold
                n.trust = max(sim.s.TRUST_THRESHOLD + 0.25, min(n.trust, 0.85))
                note = f"injected {atk} on {uid}"
                logs.append(f"→ {note}")
            else:
                note = f"target {uid} invalid"
        elif c == "clear":
            cnt = 0
            for n in sim.nodes.values():
                if n.malicious or n.isolated:
                    n.malicious = False
                    n.attack = None
                    n.isolated = False
                    n.trust = 0.85
                    cnt += 1
            note = f"cleared/recovered {cnt} node(s)"
            logs.append(f"→ {note}")
        elif c == "reset":
            sim.__init__(n_nodes=len(sim.nodes), n_malicious=0, seed=None)
            note = "network reset (0 malicious)"
            logs.append(f"→ {note}")

        try:
            sb.table("sim_control").update({"consumed": True, "note": note}).eq("id", cmd["id"]).execute()
        except Exception:
            pass
    return logs


def push_metrics(sb: Client, sim: WSNSimulator) -> None:
    m = sim.metrics()
    sb.table("network_metrics").insert({
        "captured_at": _now_iso(),
        "pdr": m["pdr"], "avg_delay": m["avg_delay"],
        "throughput": m["throughput"], "energy_avg": m["energy_avg"],
        "alive_nodes": m["alive_nodes"], "malicious_active": m["malicious_active"],
        "overhead": m["overhead"],
    }).execute()


def main() -> None:
    ap = argparse.ArgumentParser(description="TrustChain-WSN live simulator → Supabase")
    ap.add_argument("--interval", type=float, default=5.0, help="seconds between ticks")
    ap.add_argument("--nodes", type=int, default=24)
    # default 0 malicious: the network starts CLEAN so the teacher can watch an
    # attack appear live when injected from the Simulation page.
    ap.add_argument("--malicious", type=int, default=0)
    ap.add_argument("--reset", action="store_true", help="wipe demo tables and re-seed")
    args = ap.parse_args()

    sb = connect()
    sim = WSNSimulator(n_nodes=args.nodes, n_malicious=args.malicious, seed=None)

    if args.reset:
        wipe(sb)

    seed_nodes(sb, sim)
    push_routes(sb, sim)
    push_metrics(sb, sim)
    push_trust_history(sb, sim)
    print(f"✓ seeded {len(sim.nodes)} nodes "
          f"({args.malicious} malicious). Starting live loop "
          f"(every {args.interval}s). Ctrl-C to stop.\n")

    tick = 0
    try:
        while True:
            tick += 1
            for line in apply_commands(sb, sim):    # Simulation-page injections
                print(line)
            dets = sim.evaluate_trust()             # real trust round
            push_nodes(sb, sim)                     # live trust / isolation
            if dets:
                block_db_id = push_block(sb, sim.chain.head)
                push_detections(sb, dets, block_db_id)
                iso = [d["node_uid"] for d in dets if d["status"] == "Isolated"]
                names = ", ".join(d["node_uid"] for d in dets)
                msg = f"⚠ tick {tick}: {len(dets)} detection(s) [{names}]"
                if iso:
                    msg += f"  → isolated {', '.join(iso)}, block #{sim.chain.head.index} sealed"
                print(msg)
            push_trust_history(sb, sim)
            push_routes(sb, sim)
            push_metrics(sb, sim)

            m = sim.metrics()
            print(f"  tick {tick}: PDR {m['pdr']}%  delay {m['avg_delay']}ms  "
                  f"malicious-active {m['malicious_active']}  block-height {sim.chain.head.index}")
            time.sleep(args.interval)
    except KeyboardInterrupt:
        print("\n· stopped. Supabase retains the last live state.")


if __name__ == "__main__":
    main()
