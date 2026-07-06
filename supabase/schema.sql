-- ═══════════════════════════════════════════════════════════════════════
--  TrustChain-WSN  —  Supabase PostgreSQL Schema
--  Project: Event-Driven Lightweight Blockchain-Based Secure Routing
--           for Industrial Wireless Sensor Networks
--  Team:    Prasad Kathare | Pradnya Desai
--  Guide:   Jitesh Mhatre
-- ═══════════════════════════════════════════════════════════════════════

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── User Profiles (extends Supabase auth.users) ──────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name   TEXT,
    role        TEXT DEFAULT 'Operator' CHECK (role IN ('Admin','Operator','Viewer')),
    avatar_url  TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Sensor Nodes ──────────────────────────────────────────────────────────
--  Represents each node in the industrial WSN. Nodes have energy, position,
--  a live trust score, and a role. Malicious nodes are flagged and isolated.
CREATE TABLE IF NOT EXISTS public.sensor_nodes (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_uid      TEXT NOT NULL UNIQUE,              -- e.g. N-014
    label         TEXT,
    role          TEXT DEFAULT 'Sensor' CHECK (role IN ('Sensor','Cluster Head','Sink','Relay','Gateway')),
    pos_x         FLOAT DEFAULT 0,                   -- 2D field coordinate (0-100)
    pos_y         FLOAT DEFAULT 0,
    energy        FLOAT DEFAULT 100.0,               -- remaining energy %
    trust_score   FLOAT DEFAULT 1.0,                 -- 0.0 (rogue) → 1.0 (trusted)
    is_malicious  BOOLEAN DEFAULT FALSE,             -- ground-truth (simulation)
    is_isolated   BOOLEAN DEFAULT FALSE,             -- quarantined by the framework
    status        TEXT DEFAULT 'Active' CHECK (status IN ('Active','Isolated','Sleeping','Dead')),
    packets_fwd   INTEGER DEFAULT 0,                 -- packets forwarded
    packets_drop  INTEGER DEFAULT 0,                 -- packets dropped
    avg_delay     FLOAT DEFAULT 0,                   -- ms
    last_seen     TIMESTAMPTZ DEFAULT NOW(),
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Routing Paths (AODV routes discovered / in use) ──────────────────────
CREATE TABLE IF NOT EXISTS public.routing_paths (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    src_uid       TEXT NOT NULL,
    dst_uid       TEXT NOT NULL,
    hops          TEXT[],                            -- ordered node_uid hop list
    hop_count     INTEGER DEFAULT 0,
    path_trust    FLOAT DEFAULT 1.0,                 -- min/avg trust along path
    latency       FLOAT DEFAULT 0,                   -- end-to-end ms
    is_active     BOOLEAN DEFAULT TRUE,
    reconfigured  BOOLEAN DEFAULT FALSE,             -- TRUE if route was re-built to avoid a bad node
    reason        TEXT,                              -- why reconfigured
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Attack Detections ────────────────────────────────────────────────────
--  A trust-evaluation event that flagged a node. Triggers a blockchain block.
CREATE TABLE IF NOT EXISTS public.attack_events (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timestamp     TIMESTAMPTZ DEFAULT NOW(),
    node_uid      TEXT NOT NULL,                     -- offending node
    attack_type   TEXT CHECK (attack_type IN ('Blackhole','Sybil','Wormhole','Grayhole','Normal')),
    severity      TEXT CHECK (severity IN ('Critical','High','Medium','Low')),
    confidence    FLOAT DEFAULT 0.0,                 -- detector confidence 0-1
    trust_before  FLOAT,
    trust_after   FLOAT,
    drop_ratio    FLOAT,                             -- packet drop ratio observed
    delay_anomaly FLOAT,                             -- delay deviation
    identity_flag BOOLEAN DEFAULT FALSE,             -- Sybil identity anomaly
    status        TEXT DEFAULT 'Detected' CHECK (status IN ('Detected','Isolated','Recovered','Mitigated')),
    mitigation    TEXT,                              -- action taken
    block_id      UUID                               -- linked ledger block (FK set below)
);

-- ── Blockchain Ledger (event-driven; one block per detection batch) ──────
CREATE TABLE IF NOT EXISTS public.ledger_blocks (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    block_index   BIGINT NOT NULL,
    prev_hash     TEXT NOT NULL,
    block_hash    TEXT NOT NULL,
    nonce         INTEGER DEFAULT 0,
    difficulty    INTEGER DEFAULT 2,
    merkle_root   TEXT,
    event_count   INTEGER DEFAULT 1,                 -- detections recorded in block
    trigger_type  TEXT DEFAULT 'attack',             -- 'attack' | 'isolation' | 'genesis'
    validator_uid TEXT,                              -- node that sealed the block
    payload       JSONB,                             -- recorded events / node states
    mined_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.attack_events
    ADD CONSTRAINT fk_attack_block
    FOREIGN KEY (block_id) REFERENCES public.ledger_blocks(id) ON DELETE SET NULL;

-- ── Trust History (timeseries of node trust for charts) ──────────────────
CREATE TABLE IF NOT EXISTS public.trust_history (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_uid      TEXT NOT NULL,
    trust_score   FLOAT NOT NULL,
    event         TEXT,                              -- what changed it
    recorded_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Network Metric Snapshots (PDR / delay / throughput / energy) ─────────
CREATE TABLE IF NOT EXISTS public.network_metrics (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    captured_at   TIMESTAMPTZ DEFAULT NOW(),
    pdr           FLOAT,                             -- packet delivery ratio %
    avg_delay     FLOAT,                             -- ms
    throughput    FLOAT,                             -- kbps
    energy_avg    FLOAT,                             -- avg remaining energy %
    alive_nodes   INTEGER,
    malicious_active INTEGER,
    overhead      FLOAT                              -- control/blockchain overhead %
);

-- ── Notifications ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    type       TEXT,
    title      TEXT,
    body       TEXT,
    read       BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════
--  INDEXES
-- ═══════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_attack_events_ts     ON public.attack_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_attack_events_type   ON public.attack_events(attack_type);
CREATE INDEX IF NOT EXISTS idx_attack_events_node   ON public.attack_events(node_uid);
CREATE INDEX IF NOT EXISTS idx_nodes_status         ON public.sensor_nodes(status);
CREATE INDEX IF NOT EXISTS idx_nodes_uid            ON public.sensor_nodes(node_uid);
CREATE INDEX IF NOT EXISTS idx_ledger_index         ON public.ledger_blocks(block_index DESC);
CREATE INDEX IF NOT EXISTS idx_trust_hist_node      ON public.trust_history(node_uid, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_paths_active         ON public.routing_paths(is_active);
CREATE INDEX IF NOT EXISTS idx_notifications_user   ON public.notifications(user_id, read);

-- ═══════════════════════════════════════
--  ROW LEVEL SECURITY
-- ═══════════════════════════════════════
ALTER TABLE public.profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sensor_nodes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routing_paths   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attack_events   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_blocks   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trust_history   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.network_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "nodes_read"   ON public.sensor_nodes  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "nodes_write"  ON public.sensor_nodes  FOR ALL    USING (auth.role() = 'authenticated');

CREATE POLICY "paths_read"   ON public.routing_paths FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "paths_write"  ON public.routing_paths FOR ALL    USING (auth.role() = 'authenticated');

CREATE POLICY "attacks_read" ON public.attack_events FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "attacks_write"ON public.attack_events FOR ALL    USING (auth.role() = 'authenticated');

CREATE POLICY "ledger_read"  ON public.ledger_blocks FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "ledger_write" ON public.ledger_blocks FOR ALL    USING (auth.role() = 'authenticated');

CREATE POLICY "trust_read"   ON public.trust_history  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "trust_write"  ON public.trust_history  FOR ALL    USING (auth.role() = 'authenticated');

CREATE POLICY "metrics_read" ON public.network_metrics FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "metrics_write"ON public.network_metrics FOR ALL    USING (auth.role() = 'authenticated');

CREATE POLICY "notif_select" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notif_update" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

-- ═══════════════════════════════════════
--  REALTIME
-- ═══════════════════════════════════════
ALTER PUBLICATION supabase_realtime ADD TABLE public.sensor_nodes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.attack_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ledger_blocks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- ═══════════════════════════════════════
--  AUTO-UPDATE updated_at
-- ═══════════════════════════════════════
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

CREATE TRIGGER trg_nodes_updated
    BEFORE UPDATE ON public.sensor_nodes
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ═══════════════════════════════════════
--  AUTO PROFILE ON SIGNUP
-- ═══════════════════════════════════════
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, role)
    VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', COALESCE(NEW.raw_user_meta_data->>'role','Operator'));
    RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
