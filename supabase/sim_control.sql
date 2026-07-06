-- ═══════════════════════════════════════════════════════════════════════
--  TrustChain-WSN — Simulation Control table
--  Lets the Simulation page (frontend) send LIVE commands to live_runner.py:
--    · inject an attack on a node        (type = 'inject')
--    · clear / recover all attacks        (type = 'clear')
--    · reset the whole network            (type = 'reset')
--  The runner reads the newest un-consumed command each tick and applies it.
--  Paste this whole file into Supabase → SQL Editor → Run.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.sim_control (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    command      TEXT NOT NULL,                      -- 'inject' | 'clear' | 'reset'
    node_uid     TEXT,                               -- target node (for 'inject')
    attack_type  TEXT,                               -- Blackhole | Sybil | Wormhole | Grayhole
    consumed     BOOLEAN DEFAULT FALSE,              -- runner sets TRUE after applying
    note         TEXT,                               -- human label / result
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sim_control_unconsumed
    ON public.sim_control(consumed, created_at DESC);

ALTER TABLE public.sim_control ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "simctl_read"  ON public.sim_control;
DROP POLICY IF EXISTS "simctl_write" ON public.sim_control;
CREATE POLICY "simctl_read"  ON public.sim_control FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "simctl_write" ON public.sim_control FOR ALL    USING (auth.role() = 'authenticated');

-- realtime so the page reflects command status instantly
ALTER PUBLICATION supabase_realtime ADD TABLE public.sim_control;
