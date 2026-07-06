import { supabase } from './supabase';

// ── Sensor Nodes ────────────────────────────────────────────────────────────
export async function fetchNodes({ status, role, search } = {}) {
  let q = supabase.from('sensor_nodes').select('*').order('node_uid', { ascending: true });
  if (status && status !== 'All') q = q.eq('status', status);
  if (role   && role   !== 'All') q = q.eq('role', role);
  if (search) q = q.or(`node_uid.ilike.%${search}%,label.ilike.%${search}%`);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function isolateNode(node_uid) {
  const { data, error } = await supabase
    .from('sensor_nodes')
    .update({ is_isolated: true, status: 'Isolated', trust_score: 0.1 })
    .eq('node_uid', node_uid).select().single();
  if (error) throw error;
  return data;
}

export async function restoreNode(node_uid) {
  const { data, error } = await supabase
    .from('sensor_nodes')
    .update({ is_isolated: false, status: 'Active', trust_score: 0.8 })
    .eq('node_uid', node_uid).select().single();
  if (error) throw error;
  return data;
}

// ── Dashboard Stats ─────────────────────────────────────────────────────────
export async function fetchDashboardStats() {
  const since24h = new Date(Date.now() - 86400000).toISOString();
  const [nodesRes, isoRes, malRes, attacksRes, latestMetric] = await Promise.all([
    supabase.from('sensor_nodes').select('*', { count: 'exact', head: true }),
    supabase.from('sensor_nodes').select('*', { count: 'exact', head: true }).eq('status', 'Isolated'),
    supabase.from('sensor_nodes').select('*', { count: 'exact', head: true }).eq('is_malicious', true),
    supabase.from('attack_events').select('*', { count: 'exact', head: true }).gte('timestamp', since24h),
    supabase.from('network_metrics').select('*').order('captured_at', { ascending: false }).limit(1),
  ]);

  const m = (latestMetric.data && latestMetric.data[0]) || {};
  return {
    totalNodes:     nodesRes.count  || 0,
    isolatedNodes:  isoRes.count    || 0,
    maliciousNodes: malRes.count    || 0,
    attacks24h:     attacksRes.count || 0,
    pdr:            m.pdr ?? 0,
    avgDelay:       m.avg_delay ?? 0,
    throughput:     m.throughput ?? 0,
    overhead:       m.overhead ?? 0,
  };
}

// ── Attack Distribution (pie) ───────────────────────────────────────────────
export async function fetchAttackDistribution() {
  const { data, error } = await supabase.from('attack_events').select('attack_type');
  if (error) throw error;
  const counts = {};
  (data || []).forEach(r => { if (r.attack_type) counts[r.attack_type] = (counts[r.attack_type] || 0) + 1; });
  const COLORS = { Blackhole: '#ef4444', Sybil: '#a855f7', Wormhole: '#fb923c', Grayhole: '#eab308', Normal: '#34d399' };
  return Object.entries(counts).map(([name, value]) => ({ name, value, color: COLORS[name] || '#22d3ee' }));
}

// ── Attack Events ───────────────────────────────────────────────────────────
export async function fetchAttackEvents({ page = 1, limit = 50, attackType, severity, status, search } = {}) {
  let q = supabase.from('attack_events').select('*', { count: 'exact' }).order('timestamp', { ascending: false });
  if (attackType && attackType !== 'All') q = q.eq('attack_type', attackType);
  if (severity   && severity   !== 'All') q = q.eq('severity', severity);
  if (status     && status     !== 'All') q = q.eq('status', status);
  if (search) q = q.or(`node_uid.ilike.%${search}%,attack_type.ilike.%${search}%`);
  const from = (page - 1) * limit;
  q = q.range(from, from + limit - 1);
  const { data, error, count } = await q;
  if (error) throw error;
  return { items: data || [], total: count || 0 };
}

export async function fetchRecentAttacks(limit = 8) {
  const { data, error } = await supabase
    .from('attack_events').select('*').order('timestamp', { ascending: false }).limit(limit);
  if (error) throw error;
  return data || [];
}

// ── Blockchain Ledger ───────────────────────────────────────────────────────
export async function fetchLedger(limit = 50) {
  const { data, error } = await supabase
    .from('ledger_blocks').select('*').order('block_index', { ascending: false }).limit(limit);
  if (error) throw error;
  return data || [];
}

// ── Routing Paths ───────────────────────────────────────────────────────────
export async function fetchRoutes({ reconfigured } = {}) {
  let q = supabase.from('routing_paths').select('*').order('created_at', { ascending: false });
  if (reconfigured === true)  q = q.eq('reconfigured', true);
  if (reconfigured === false) q = q.eq('reconfigured', false);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

// ── Trust History (timeseries grouped by node) ─────────────────────────────
export async function fetchTrustHistory() {
  const { data, error } = await supabase
    .from('trust_history').select('*').order('recorded_at', { ascending: true });
  if (error) throw error;

  // pivot → [{ time, N-002: 0.4, N-007: 0.3, ... }]
  const byTime = {};
  (data || []).forEach(r => {
    const t = new Date(r.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    byTime[t] = byTime[t] || { time: t };
    byTime[t][r.node_uid] = r.trust_score;
  });
  const series = Object.values(byTime);
  const nodes = [...new Set((data || []).map(r => r.node_uid))];
  return { series, nodes };
}

// ── Network Metrics (timeseries) ────────────────────────────────────────────
export async function fetchMetricsSeries() {
  const { data, error } = await supabase
    .from('network_metrics').select('*').order('captured_at', { ascending: true });
  if (error) throw error;
  return (data || []).map(r => ({
    time: new Date(r.captured_at).toLocaleTimeString([], { hour: '2-digit' }),
    pdr: r.pdr, delay: r.avg_delay, throughput: r.throughput,
    energy: r.energy_avg, overhead: r.overhead, malicious: r.malicious_active,
  }));
}

// ── Simulation Control (live attack injection from the Simulation page) ─────
export async function sendSimCommand({ command, node_uid = null, attack_type = null, note = null }) {
  const { data, error } = await supabase
    .from('sim_control')
    .insert({ command, node_uid, attack_type, note })
    .select().single();
  if (error) throw error;
  return data;
}

export async function fetchSimCommands(limit = 12) {
  const { data, error } = await supabase
    .from('sim_control').select('*').order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return data || [];
}

// active (non-isolated) sensor/relay/gateway nodes — valid injection targets
export async function fetchInjectableNodes() {
  const { data, error } = await supabase
    .from('sensor_nodes').select('node_uid,label,role,trust_score,is_malicious,is_isolated,status')
    .neq('role', 'Sink').order('node_uid', { ascending: true });
  if (error) throw error;
  return data || [];
}

// ── Notifications ───────────────────────────────────────────────────────────
export async function fetchNotifications(userId) {
  const { data, error } = await supabase
    .from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function markNotificationRead(id) {
  const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id);
  if (error) throw error;
}

export async function markAllNotificationsRead(userId) {
  const { error } = await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false);
  if (error) throw error;
}
