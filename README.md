# TrustChain-WSN

**Event-Driven Lightweight Blockchain-Based Secure Routing for Industrial Wireless Sensor Networks**

A full-stack monitoring & control console for a secure-routing framework that
combines **trust-aware AODV routing** with an **event-driven lightweight
blockchain** to detect, isolate and recover from routing attacks
(**Blackhole, Sybil, Wormhole, Grayhole**) in industrial WSNs.

| | |
|---|---|
| **Team** | Prasad Kathare · Pradnya Desai |
| **Guide** | Prof. Jitesh Mhatre |
| **Program** | Final Year Project — Master of Computer Applications |

---

## Why this project

Traditional blockchain-secured WSNs run the chain **continuously**, which is
expensive for resource-constrained sensor nodes (energy, storage, latency,
poor PBFT scalability). This framework's core novelty is that the blockchain
is **event-driven** — a block is sealed **only when the trust engine detects an
attack**, keeping overhead low while still giving tamper-evident provenance of
every malicious event.

```
 Behaviour-based Trust  ──►  Detection  ──►  Seal block (event-driven)
   (drop ratio, delay,                         │
    identity anomaly)                          ▼
        │                              Isolate node + reroute (AODV)
        └──────────── continuous, cheap ───────┘
```

## Tech Stack

Same stack as the team's sibling project, with a **separate Supabase project**
and a distinct industrial amber/cyan theme.

- **Frontend** — React 18 · Vite · MUI 5 · React Query · Recharts · Supabase JS
- **Backend**  — FastAPI · Pydantic · NumPy (WSN simulator + blockchain)
- **Database** — Supabase (PostgreSQL + Auth + Realtime + RLS)

## Features (UI)

| Page | What it shows |
|------|---------------|
| **Control Room** | Live KPIs, PDR/throughput trend, attack distribution, overhead (event-driven), recent detections |
| **Network Topology** | Interactive SVG field map — node trust colouring, isolation, AODV routes; click-to-inspect & isolate/restore |
| **Trust Engine** | Trust-score evolution timeseries with isolation threshold; per-node trust ranking |
| **Attack Detection** | Filterable detection log with expandable forensics; each row links to its on-chain block |
| **Blockchain Ledger** | Chain explorer with hashes, nonce, merkle root, validator + **chain-integrity verification** |
| **Secure Routing** | AODV paths, path-trust bars, reconfiguration log (routes that avoided bad nodes) |
| **Performance** | PDR, end-to-end delay, throughput, energy vs overhead charts |
| **Alerts / Settings** | Realtime notifications, framework & blockchain configuration |

## Quick Start

See **[SETUP.md](SETUP.md)** for full step-by-step instructions.

```bash
# 1. Database — paste supabase/run_this_in_supabase.sql into the Supabase SQL Editor

# 2. Frontend
cd frontend
npm install
npm run dev            # http://localhost:5174

# 3. Backend (optional — simulator + REST API)
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001   # http://localhost:8001/docs
```

## Repository layout

```
bc-routing/
├── frontend/            React + Vite SPA (control console)
├── backend/             FastAPI API + WSN simulator + blockchain
│   └── app/sim/         blockchain.py · network.py (trust engine + AODV)
├── supabase/            schema.sql · seed.sql · run_this_in_supabase.sql
└── docker-compose.yml
```
