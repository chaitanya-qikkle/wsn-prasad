# Setup Guide — TrustChain-WSN

## 1. Database (Supabase)

This project uses its **own** Supabase project (separate from the WAF project).

1. Open your Supabase project → **SQL Editor** → **New Query**.
2. Paste the entire contents of [`supabase/run_this_in_supabase.sql`](supabase/run_this_in_supabase.sql) and **Run**.
   This creates all tables, indexes, RLS policies, realtime publication, the
   auto-profile trigger, and demo seed data (24 nodes, ledger blocks,
   detections, routes, trust history, metrics).
3. (Realtime) Tables `sensor_nodes`, `attack_events`, `ledger_blocks`,
   `notifications` are already added to the realtime publication.

## 2. Frontend

```bash
cd frontend
npm install
# .env.local is already filled with this project's Supabase URL + anon key
npm run dev
```

Open **http://localhost:5174**, then **Create Account** (email + password).
Supabase emails a confirmation link; after confirming, sign in.

`frontend/.env.local`:
```env
VITE_SUPABASE_URL=https://kelfsywyajpmkbrwmvgq.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...   # anon public key
VITE_API_BASE_URL=http://localhost:8001
```

## 3. Backend (optional)

The frontend reads Supabase directly, so the backend is **optional**. Run it to
expose the WSN simulator + blockchain over REST (and to push live events).

```bash
cd backend
python -m venv venv && venv\Scripts\activate     # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

Interactive API docs: **http://localhost:8001/docs**

Useful endpoints:
- `POST /api/sim/start` — build a fresh network and run evaluation rounds
- `POST /api/sim/step`  — run one trust-evaluation round (seals a block if attacks fire)
- `GET  /api/ledger/verify` — verify chain integrity
- `GET  /api/metrics` — current PDR / delay / throughput / overhead

## 4. Docker (all-in-one)

```bash
cp backend/.env.example backend/.env   # fill Supabase keys
docker compose up --build
# frontend → http://localhost:5174   backend → http://localhost:8001
```

## Ports at a glance

| Service | Port | Note |
|---------|------|------|
| Frontend (this project) | **5174** | WAF project uses 5173 — no clash |
| Backend  (this project) | **8001** | WAF project uses 8000 — no clash |
