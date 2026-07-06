-- ═══════════════════════════════════════════════════════════════════════
--  STEP 1: Run this ENTIRE file in Supabase SQL Editor
--  supabase.com → your project → SQL Editor → New Query → Paste → Run
--  Project: Event-Driven Lightweight Blockchain-Based Secure Routing (WSN)
-- ═══════════════════════════════════════════════════════════════════════

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

-- ═══════════════════════════════════════
--  STEP 2: DEMO SEED DATA
-- ═══════════════════════════════════════

-- ── SEED: Sensor Nodes ──
INSERT INTO public.sensor_nodes (node_uid,label,role,pos_x,pos_y,energy,trust_score,is_malicious,is_isolated,status,packets_fwd,packets_drop,avg_delay) VALUES
('N-001','Field Node 1','Sink',92.1,35.0,44.1,0.927,false,false,'Active',969,10,16.1),
('N-002','Field Node 2','Relay',71.1,53.3,86.5,0.141,true,true,'Isolated',117,296,92.7),
('N-003','Field Node 3','Sensor',60.9,83.3,87.9,0.859,false,false,'Active',1000,17,58.2),
('N-004','Field Node 4','Sensor',94.6,82.7,84.2,0.928,false,false,'Active',866,1,83.4),
('N-005','Field Node 5','Sensor',36.7,65.7,44.6,0.86,false,false,'Active',1147,14,69.1),
('N-006','Field Node 6','Sensor',26.5,46.5,68.7,0.924,false,false,'Active',750,2,31.5),
('N-007','Field Node 7','Sensor',33.8,74.7,48.3,0.324,true,false,'Active',192,472,12.9),
('N-008','Field Node 8','Sensor',23.4,90.7,51.4,0.953,false,false,'Active',1221,10,84.2),
('N-009','Field Node 9','Sensor',63.1,17.1,91.5,0.846,false,false,'Active',1210,15,20.1),
('N-010','Field Node 10','Sensor',43.4,57.7,82.6,0.284,true,false,'Active',117,395,39.5),
('N-011','Field Node 11','Cluster Head',73.5,83.2,66.1,0.989,false,false,'Active',1443,4,21.3),
('N-012','Field Node 12','Sensor',58.8,47.1,59.0,0.814,false,false,'Active',530,13,29.9),
('N-013','Field Node 13','Sensor',53.4,28.5,78.3,0.896,false,false,'Active',634,0,63.8),
('N-014','Field Node 14','Relay',91.8,84.6,63.5,0.803,false,false,'Active',723,13,30.9),
('N-015','Field Node 15','Sensor',84.1,31.5,93.3,0.885,false,false,'Active',1439,5,63.6),
('N-016','Field Node 16','Cluster Head',53.6,75.6,83.6,0.908,false,false,'Active',1165,4,54.1),
('N-017','Field Node 17','Sensor',89.5,84.8,35.3,0.78,false,false,'Active',1400,10,80.4),
('N-018','Field Node 18','Relay',91.1,11.9,91.1,0.845,false,false,'Active',893,1,50.3),
('N-019','Field Node 19','Sensor',47.7,54.6,42.3,0.795,false,false,'Active',657,17,31.1),
('N-020','Field Node 20','Relay',73.5,67.5,94.4,0.312,true,false,'Active',104,336,70.0),
('N-021','Field Node 21','Gateway',45.5,26.8,92.5,0.864,false,false,'Active',1297,11,13.6),
('N-022','Field Node 22','Sink',4.7,69.1,72.2,0.784,false,false,'Active',871,17,13.1),
('N-023','Field Node 23','Cluster Head',25.9,65.5,38.6,0.794,false,false,'Active',1076,1,26.6),
('N-024','Field Node 24','Sensor',47.5,41.4,49.8,0.808,false,false,'Active',1368,18,16.2)
ON CONFLICT (node_uid) DO NOTHING;

-- ── SEED: Ledger Blocks ──
INSERT INTO public.ledger_blocks (block_index,prev_hash,block_hash,nonce,difficulty,merkle_root,event_count,trigger_type,validator_uid,payload,mined_at) VALUES
(0,'0000000000000000000000000000000000000000000000000000000000000000','8ecb8467120d6e3ffdb39855d9155f605e98e3359711abb7878de93388dec969',0,2,'1858ea09512211ddb87372e2efc2da18',1,'genesis',NULL,'{"genesis": true, "network": "Industrial-WSN", "nodes": 24}'::jsonb,'2026-06-28T06:30:34.522958'),
(1,'8ecb8467120d6e3ffdb39855d9155f605e98e3359711abb7878de93388dec969','c7edb0bc9c1eb9f0f85310be02187587f15d443fd3505c63b4772c97caf4a3cc',87374,2,'ff8a111cf3ea9807a73da7815f6c28f0',1,'attack','N-001','{"node": "N-002", "trust": 0.141, "action": "flagged"}'::jsonb,'2026-06-28T07:07:34.522958'),
(2,'c7edb0bc9c1eb9f0f85310be02187587f15d443fd3505c63b4772c97caf4a3cc','1344705007a465246f8d04780a925e14d098ffd5075927ed11128b77ed19faee',57498,2,'bbc7bf394126b966a2b24ad9218ae519',1,'attack','N-001','{"node": "N-007", "trust": 0.324, "action": "flagged"}'::jsonb,'2026-06-28T07:44:34.522958'),
(3,'1344705007a465246f8d04780a925e14d098ffd5075927ed11128b77ed19faee','8843acbeda4fc9a1fbabf68608f42f9dcf64ef50db8097dffabfa2f2128d2219',47438,2,'ae4199966142efc7d84c57c9a706fe28',1,'attack','N-001','{"node": "N-010", "trust": 0.284, "action": "flagged"}'::jsonb,'2026-06-28T08:21:34.522958'),
(4,'8843acbeda4fc9a1fbabf68608f42f9dcf64ef50db8097dffabfa2f2128d2219','0c55b2beb07bae65694e8b7a7a942e163b55e7f921733c718b1fc014f234adf9',56519,2,'e5c960aecb71f1911f7ada74c5cbbb1d',1,'attack','N-001','{"node": "N-020", "trust": 0.312, "action": "flagged"}'::jsonb,'2026-06-28T08:58:34.522958');

-- ── SEED: Attack Events ──
INSERT INTO public.attack_events (timestamp,node_uid,attack_type,severity,confidence,trust_before,trust_after,drop_ratio,delay_anomaly,identity_flag,status,mitigation,block_id) VALUES
('2026-06-28T07:07:34.522958','N-002','Grayhole','Medium',0.899,0.587,0.141,0.715,4.96,false,'Isolated','Node isolated; routes reconfigured',(SELECT id FROM public.ledger_blocks WHERE block_index=1)),
('2026-06-28T07:44:34.522958','N-007','Blackhole','Critical',0.83,0.77,0.324,0.71,5.56,false,'Mitigated','Trust penalized; monitored',(SELECT id FROM public.ledger_blocks WHERE block_index=2)),
('2026-06-28T08:21:34.522958','N-010','Blackhole','Critical',0.862,0.622,0.284,0.77,3.91,false,'Mitigated','Trust penalized; monitored',(SELECT id FROM public.ledger_blocks WHERE block_index=3)),
('2026-06-28T08:58:34.522958','N-020','Grayhole','Medium',0.851,0.705,0.312,0.762,5.91,false,'Mitigated','Trust penalized; monitored',(SELECT id FROM public.ledger_blocks WHERE block_index=4));

-- ── SEED: Routing Paths ──
INSERT INTO public.routing_paths (src_uid,dst_uid,hops,hop_count,path_trust,latency,is_active,reconfigured,reason) VALUES
('N-004','N-001',ARRAY['N-004','N-024','N-008','N-001'],3,0.752,119.9,true,false,NULL),
('N-004','N-001',ARRAY['N-004','N-011','N-001'],2,0.833,64.0,true,false,NULL),
('N-003','N-001',ARRAY['N-003','N-018','N-001'],2,0.74,54.2,true,false,NULL),
('N-018','N-001',ARRAY['N-018','N-019','N-022','N-001'],3,0.776,44.0,true,false,NULL),
('N-023','N-001',ARRAY['N-023','N-024','N-004','N-015','N-001'],4,0.753,75.1,true,false,NULL),
('N-021','N-001',ARRAY['N-021','N-004','N-001'],2,0.961,20.7,true,true,'Avoided isolated node N-002'),
('N-011','N-001',ARRAY['N-011','N-006','N-013','N-001'],3,0.873,16.3,true,true,'Avoided isolated node N-010'),
('N-012','N-001',ARRAY['N-012','N-016','N-001'],2,0.795,54.7,true,false,NULL),
('N-013','N-001',ARRAY['N-013','N-016','N-005','N-001'],3,0.742,79.1,true,false,NULL),
('N-005','N-001',ARRAY['N-005','N-024','N-001'],2,0.789,40.6,true,false,NULL),
('N-004','N-001',ARRAY['N-004','N-017','N-001'],2,0.806,59.3,true,false,NULL),
('N-013','N-001',ARRAY['N-013','N-023','N-003','N-015','N-001'],4,0.954,23.2,true,false,NULL),
('N-012','N-001',ARRAY['N-012','N-006','N-001'],2,0.911,28.8,true,true,'Avoided isolated node N-007'),
('N-014','N-001',ARRAY['N-014','N-013','N-001'],2,0.856,39.1,true,false,NULL);

-- ── SEED: Trust History ──
INSERT INTO public.trust_history (node_uid,trust_score,event,recorded_at) VALUES
('N-002',0.822,'packet drop penalty','2026-06-28T06:35:34.522958'),
('N-002',0.779,'packet drop penalty','2026-06-28T06:50:34.522958'),
('N-002',0.69,'packet drop penalty','2026-06-28T07:05:34.522958'),
('N-002',0.639,'delay anomaly','2026-06-28T07:20:34.522958'),
('N-002',0.58,'packet drop penalty','2026-06-28T07:35:34.522958'),
('N-002',0.494,'delay anomaly','2026-06-28T07:50:34.522958'),
('N-002',0.463,'packet drop penalty','2026-06-28T08:05:34.522958'),
('N-002',0.417,'packet drop penalty','2026-06-28T08:20:34.522958'),
('N-002',0.367,'packet drop penalty','2026-06-28T08:35:34.522958'),
('N-002',0.322,'delay anomaly','2026-06-28T08:50:34.522958'),
('N-002',0.234,'packet drop penalty','2026-06-28T09:05:34.522958'),
('N-002',0.189,'delay anomaly','2026-06-28T09:20:34.522958'),
('N-007',0.833,'packet drop penalty','2026-06-28T06:35:34.522958'),
('N-007',0.774,'delay anomaly','2026-06-28T06:50:34.522958'),
('N-007',0.686,'delay anomaly','2026-06-28T07:05:34.522958'),
('N-007',0.601,'packet drop penalty','2026-06-28T07:20:34.522958'),
('N-007',0.57,'delay anomaly','2026-06-28T07:35:34.522958'),
('N-007',0.537,'packet drop penalty','2026-06-28T07:50:34.522958'),
('N-007',0.505,'delay anomaly','2026-06-28T08:05:34.522958'),
('N-007',0.43,'packet drop penalty','2026-06-28T08:20:34.522958'),
('N-007',0.363,'delay anomaly','2026-06-28T08:35:34.522958'),
('N-007',0.326,'packet drop penalty','2026-06-28T08:50:34.522958'),
('N-007',0.324,'packet drop penalty','2026-06-28T09:05:34.522958'),
('N-007',0.324,'packet drop penalty','2026-06-28T09:20:34.522958'),
('N-010',0.866,'delay anomaly','2026-06-28T06:35:34.522958'),
('N-010',0.822,'delay anomaly','2026-06-28T06:50:34.522958'),
('N-010',0.741,'packet drop penalty','2026-06-28T07:05:34.522958'),
('N-010',0.674,'packet drop penalty','2026-06-28T07:20:34.522958'),
('N-010',0.635,'packet drop penalty','2026-06-28T07:35:34.522958'),
('N-010',0.561,'packet drop penalty','2026-06-28T07:50:34.522958'),
('N-010',0.505,'delay anomaly','2026-06-28T08:05:34.522958'),
('N-010',0.426,'packet drop penalty','2026-06-28T08:20:34.522958'),
('N-010',0.404,'delay anomaly','2026-06-28T08:35:34.522958'),
('N-010',0.366,'packet drop penalty','2026-06-28T08:50:34.522958'),
('N-010',0.284,'packet drop penalty','2026-06-28T09:05:34.522958'),
('N-010',0.284,'packet drop penalty','2026-06-28T09:20:34.522958'),
('N-020',0.825,'packet drop penalty','2026-06-28T06:35:34.522958'),
('N-020',0.736,'packet drop penalty','2026-06-28T06:50:34.522958'),
('N-020',0.653,'packet drop penalty','2026-06-28T07:05:34.522958'),
('N-020',0.63,'packet drop penalty','2026-06-28T07:20:34.522958'),
('N-020',0.574,'delay anomaly','2026-06-28T07:35:34.522958'),
('N-020',0.506,'delay anomaly','2026-06-28T07:50:34.522958'),
('N-020',0.434,'packet drop penalty','2026-06-28T08:05:34.522958'),
('N-020',0.384,'delay anomaly','2026-06-28T08:20:34.522958'),
('N-020',0.312,'delay anomaly','2026-06-28T08:35:34.522958'),
('N-020',0.312,'packet drop penalty','2026-06-28T08:50:34.522958'),
('N-020',0.312,'packet drop penalty','2026-06-28T09:05:34.522958'),
('N-020',0.312,'packet drop penalty','2026-06-28T09:20:34.522958'),
('N-003',0.961,'normal forwarding','2026-06-28T06:35:34.522958'),
('N-003',0.968,'normal forwarding','2026-06-28T06:50:34.522958'),
('N-003',0.963,'normal forwarding','2026-06-28T07:05:34.522958'),
('N-003',0.973,'normal forwarding','2026-06-28T07:20:34.522958'),
('N-003',0.975,'normal forwarding','2026-06-28T07:35:34.522958'),
('N-003',0.987,'normal forwarding','2026-06-28T07:50:34.522958'),
('N-003',0.982,'normal forwarding','2026-06-28T08:05:34.522958'),
('N-003',0.989,'normal forwarding','2026-06-28T08:20:34.522958'),
('N-003',0.99,'normal forwarding','2026-06-28T08:35:34.522958'),
('N-003',0.99,'normal forwarding','2026-06-28T08:50:34.522958'),
('N-003',0.989,'normal forwarding','2026-06-28T09:05:34.522958'),
('N-003',0.985,'normal forwarding','2026-06-28T09:20:34.522958'),
('N-004',0.964,'normal forwarding','2026-06-28T06:35:34.522958'),
('N-004',0.972,'normal forwarding','2026-06-28T06:50:34.522958'),
('N-004',0.971,'normal forwarding','2026-06-28T07:05:34.522958'),
('N-004',0.975,'normal forwarding','2026-06-28T07:20:34.522958'),
('N-004',0.985,'normal forwarding','2026-06-28T07:35:34.522958'),
('N-004',0.99,'normal forwarding','2026-06-28T07:50:34.522958'),
('N-004',0.99,'normal forwarding','2026-06-28T08:05:34.522958'),
('N-004',0.99,'normal forwarding','2026-06-28T08:20:34.522958'),
('N-004',0.99,'normal forwarding','2026-06-28T08:35:34.522958'),
('N-004',0.99,'normal forwarding','2026-06-28T08:50:34.522958'),
('N-004',0.989,'normal forwarding','2026-06-28T09:05:34.522958'),
('N-004',0.99,'normal forwarding','2026-06-28T09:20:34.522958'),
('N-017',0.959,'normal forwarding','2026-06-28T06:35:34.522958'),
('N-017',0.951,'normal forwarding','2026-06-28T06:50:34.522958'),
('N-017',0.97,'normal forwarding','2026-06-28T07:05:34.522958'),
('N-017',0.967,'normal forwarding','2026-06-28T07:20:34.522958'),
('N-017',0.966,'normal forwarding','2026-06-28T07:35:34.522958'),
('N-017',0.98,'normal forwarding','2026-06-28T07:50:34.522958'),
('N-017',0.975,'normal forwarding','2026-06-28T08:05:34.522958'),
('N-017',0.966,'normal forwarding','2026-06-28T08:20:34.522958'),
('N-017',0.986,'normal forwarding','2026-06-28T08:35:34.522958'),
('N-017',0.99,'normal forwarding','2026-06-28T08:50:34.522958'),
('N-017',0.99,'normal forwarding','2026-06-28T09:05:34.522958'),
('N-017',0.99,'normal forwarding','2026-06-28T09:20:34.522958');

-- ── SEED: Network Metrics ──
INSERT INTO public.network_metrics (captured_at,pdr,avg_delay,throughput,energy_avg,alive_nodes,malicious_active,overhead) VALUES
('2026-06-27T09:35:34.522958',73.5,34.1,280.6,93.8,24,4,5.7),
('2026-06-27T10:35:34.522958',74.0,36.9,307.0,91.6,24,4,8.27),
('2026-06-27T11:35:34.522958',75.4,23.3,296.6,91.3,24,4,5.86),
('2026-06-27T12:35:34.522958',76.4,42.5,203.0,92.2,24,4,5.76),
('2026-06-27T13:35:34.522958',77.5,32.0,232.4,89.5,24,4,5.53),
('2026-06-27T14:35:34.522958',78.9,41.0,249.7,88.3,24,4,5.45),
('2026-06-27T15:35:34.522958',79.4,39.7,255.0,87.9,24,3,7.52),
('2026-06-27T16:35:34.522958',80.2,37.0,261.8,88.7,24,3,5.22),
('2026-06-27T17:35:34.522958',81.4,21.4,243.0,85.9,24,3,3.14),
('2026-06-27T18:35:34.522958',82.0,25.1,219.4,87.2,24,3,4.88),
('2026-06-27T19:35:34.522958',82.8,27.0,208.7,84.5,24,3,4.64),
('2026-06-27T20:35:34.522958',84.1,40.1,204.7,83.6,24,3,5.57),
('2026-06-27T21:35:34.522958',85.1,39.6,245.8,84.2,23,2,5.26),
('2026-06-27T22:35:34.522958',86.4,35.2,331.7,83.1,23,2,4.6),
('2026-06-27T23:35:34.522958',86.8,21.8,303.1,82.6,24,2,6.72),
('2026-06-28T00:35:34.522958',88.3,39.5,284.8,80.3,22,2,5.1),
('2026-06-28T01:35:34.522958',88.8,29.6,231.0,80.8,24,2,3.33),
('2026-06-28T02:35:34.522958',89.6,23.9,261.3,78.8,23,2,5.94),
('2026-06-28T03:35:34.522958',91.0,17.9,227.5,80.5,22,1,1.99),
('2026-06-28T04:35:34.522958',92.5,16.7,227.6,76.9,24,1,5.75),
('2026-06-28T05:35:34.522958',94.0,15.6,222.9,78.5,24,1,4.1),
('2026-06-28T06:35:34.522958',94.6,36.1,287.1,77.4,23,1,2.32),
('2026-06-28T07:35:34.522958',95.7,30.1,240.0,74.9,23,1,1.89),
('2026-06-28T08:35:34.522958',96.1,17.5,320.8,73.7,23,1,6.38);
