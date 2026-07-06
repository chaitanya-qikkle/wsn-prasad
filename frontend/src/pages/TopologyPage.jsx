import React, { useState } from 'react';
import { Box, Grid, Typography, Stack, Chip, useTheme, alpha, Card, Button, Divider } from '@mui/material';
import HubIcon      from '@mui/icons-material/Hub';
import BlockIcon    from '@mui/icons-material/Block';
import RestoreIcon  from '@mui/icons-material/Restore';
import RouterIcon   from '@mui/icons-material/Router';
import SensorsIcon  from '@mui/icons-material/Sensors';
import AltRouteIcon from '@mui/icons-material/AltRoute';
import { useSim } from '../sim/SimContext';
import { PageHeader, Panel, StatCard, LiveDot, LegendDot, trustColor, STATUS_COLORS } from '../utils/ui';
import { ACCENT, ACCENT2, WARN, DANGER } from '../context/ThemeContext';

export default function TopologyPage() {
  const theme = useTheme();
  const grid = theme.palette.divider;
  const sim = useSim();
  const [selected, setSelected] = useState(null);

  const nodes = sim.nodes;
  const routes = sim.routes.filter(r => r.is_active).slice(0, 8);
  const byUid = Object.fromEntries(nodes.map(n => [n.node_uid, n]));
  const sel = selected ? byUid[selected] : null;

  const active = sim.stats.activeNodes;
  const isolated = sim.stats.isolatedNodes;
  const rerouted = sim.stats.reroutedPaths;

  const X = (x) => 40 + (x / 100) * 920;
  const Y = (y) => 30 + (y / 100) * 540;

  return (
    <Box>
      <PageHeader icon={<HubIcon />} title="Network Topology"
        subtitle="Live field map — node trust, isolation state and trust-aware AODV routes to the sink"
        action={
          <Stack direction="row" spacing={2} alignItems="center">
            <LiveDot color={ACCENT2} />
            <LegendDot color={ACCENT2} label="Trusted" /><LegendDot color="#ffd54a" label="Suspect" /><LegendDot color={DANGER} label="Isolated" />
          </Stack>
        } />

      <Grid container spacing={2.5} mb={2.5}>
        <Grid item xs={6} md={3}><StatCard icon={<SensorsIcon />} label="Total Nodes" value={nodes.length} color={ACCENT} sub="deployed" /></Grid>
        <Grid item xs={6} md={3}><StatCard icon={<HubIcon />} label="Active" value={active} color={ACCENT2} sub="forwarding" /></Grid>
        <Grid item xs={6} md={3}><StatCard icon={<BlockIcon />} label="Isolated" value={isolated} color={DANGER} sub="quarantined" /></Grid>
        <Grid item xs={6} md={3}><StatCard icon={<AltRouteIcon />} label="Rerouted" value={rerouted} color={WARN} sub="avoided bad nodes" /></Grid>
      </Grid>

      <Grid container spacing={2.5}>
        <Grid item xs={12} lg={8.5}>
          <Card sx={{ p: 1.2 }}>
            <Box component="svg" viewBox="0 0 1000 600" sx={{ width: '100%', height: 'auto', display: 'block' }}>
              <defs>
                <radialGradient id="sinkGlow"><stop offset="0%" stopColor={alpha(ACCENT, 0.5)} /><stop offset="100%" stopColor={alpha(ACCENT, 0)} /></radialGradient>
              </defs>
              {Array.from({ length: 11 }).map((_, i) => (
                <line key={'v' + i} x1={40 + i * 92} y1={30} x2={40 + i * 92} y2={570} stroke={grid} strokeWidth={0.5} />
              ))}
              {Array.from({ length: 7 }).map((_, i) => (
                <line key={'h' + i} x1={40} y1={30 + i * 90} x2={960} y2={30 + i * 90} stroke={grid} strokeWidth={0.5} />
              ))}

              {/* routes + animated packets */}
              {routes.map((r, ri) => {
                const pts = (r.hops || []).map(h => byUid[h]).filter(Boolean);
                return pts.slice(0, -1).map((p, i) => {
                  const q = pts[i + 1];
                  const stroke = r.reconfigured ? WARN : alpha(ACCENT, 0.55);
                  return (
                    <g key={`r${ri}-${i}`}>
                      <line x1={X(p.pos_x)} y1={Y(p.pos_y)} x2={X(q.pos_x)} y2={Y(q.pos_y)}
                        stroke={stroke} strokeWidth={1.6} strokeDasharray={r.reconfigured ? '5 4' : 'none'} />
                      <circle r={2.6} fill={r.reconfigured ? WARN : ACCENT}>
                        <animate attributeName="cx" values={`${X(p.pos_x)};${X(q.pos_x)}`} dur="1.6s" repeatCount="indefinite" />
                        <animate attributeName="cy" values={`${Y(p.pos_y)};${Y(q.pos_y)}`} dur="1.6s" repeatCount="indefinite" />
                      </circle>
                    </g>
                  );
                });
              })}

              {nodes.map(n => {
                const isSink = n.role === 'Sink';
                const c = n.is_isolated || n.is_malicious ? DANGER : trustColor(n.trust_score);
                const r = isSink ? 16 : n.role === 'Cluster Head' ? 12 : 9;
                const hot = n.is_malicious || n.is_isolated;
                return (
                  <g key={n.node_uid} style={{ cursor: 'pointer' }} onClick={() => setSelected(n.node_uid)}>
                    {isSink && <circle cx={X(n.pos_x)} cy={Y(n.pos_y)} r={30} fill="url(#sinkGlow)" />}
                    {selected === n.node_uid && <circle cx={X(n.pos_x)} cy={Y(n.pos_y)} r={r + 7} fill="none" stroke={ACCENT} strokeWidth={2} />}
                    {hot && <circle cx={X(n.pos_x)} cy={Y(n.pos_y)} r={r + 5} fill="none" stroke={c} strokeWidth={1.5} opacity={0.6}>
                      <animate attributeName="r" values={`${r + 3};${r + 10}`} dur="1.4s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.6;0" dur="1.4s" repeatCount="indefinite" />
                    </circle>}
                    <circle cx={X(n.pos_x)} cy={Y(n.pos_y)} r={r} fill={alpha(c, 0.85)} stroke={c} strokeWidth={2} />
                    {isSink && <circle cx={X(n.pos_x)} cy={Y(n.pos_y)} r={r + 4} fill="none" stroke={c} strokeWidth={1} strokeDasharray="3 3" />}
                    <text x={X(n.pos_x)} y={Y(n.pos_y) - r - 5} fontSize={10} textAnchor="middle"
                      fill={theme.palette.text.secondary} fontFamily="'JetBrains Mono', monospace">{n.node_uid}</text>
                  </g>
                );
              })}
            </Box>
          </Card>
        </Grid>

        <Grid item xs={12} lg={3.5}>
          <Panel title="Node Inspector" accent={ACCENT}>
            {!sel && <Typography variant="body2" color="text.secondary">Click a node on the map to inspect its trust profile and take action.</Typography>}
            {sel && (
              <Stack spacing={1.5}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="h6" fontWeight={800} fontFamily="'JetBrains Mono', monospace">{sel.node_uid}</Typography>
                  <Chip size="small" label={sel.status} sx={{ bgcolor: alpha(STATUS_COLORS[sel.status] || '#94a3b8', 0.14), color: STATUS_COLORS[sel.status] || '#94a3b8', fontWeight: 600 }} />
                </Stack>
                <Typography variant="body2" color="text.secondary">{sel.label} · {sel.role}</Typography>
                <Divider sx={{ borderColor: grid }} />
                <InfoRow label="Trust score" value={sel.trust_score.toFixed(3)} color={trustColor(sel.trust_score)} />
                <InfoRow label="Energy" value={`${sel.energy.toFixed(0)}%`} />
                <InfoRow label="Packets forwarded" value={sel.packets_fwd} />
                <InfoRow label="Packets dropped" value={sel.packets_drop} color={sel.packets_drop > 50 ? DANGER : undefined} />
                <InfoRow label="Avg delay" value={`${sel.avg_delay.toFixed(1)} ms`} />
                <InfoRow label="Ground truth" value={sel.is_malicious ? (sel.attack || 'MALICIOUS') : 'Benign'} color={sel.is_malicious ? DANGER : ACCENT2} />
                <Divider sx={{ borderColor: grid }} />
                {sel.is_isolated
                  ? <Button startIcon={<RestoreIcon />} variant="outlined" color="success" onClick={() => sim.restore(sel.node_uid)}>Restore Node</Button>
                  : <Button startIcon={<BlockIcon />} variant="contained" color="error" onClick={() => sim.isolate(sel.node_uid)}>Isolate Node</Button>}
              </Stack>
            )}
          </Panel>

          <Box mt={2.5}>
            <Panel title="Active Routes" accent={ACCENT2}>
              <Stack spacing={1.4} divider={<Divider sx={{ borderColor: grid }} />}>
                {routes.slice(0, 6).map(r => (
                  <Stack key={r.id} direction="row" alignItems="center" spacing={1.2}>
                    <RouterIcon sx={{ fontSize: 17, color: r.reconfigured ? WARN : ACCENT }} />
                    <Box flex={1} minWidth={0}>
                      <Typography variant="caption" fontWeight={700} noWrap display="block" fontFamily="'JetBrains Mono', monospace">{(r.hops || []).join(' → ')}</Typography>
                      <Typography variant="caption" color="text.secondary">{r.hop_count} hops · {r.latency?.toFixed(0)}ms · trust {r.path_trust}</Typography>
                    </Box>
                    {r.reconfigured && <Chip size="small" label="rerouted" sx={{ fontSize: 9, height: 19, bgcolor: alpha(WARN, 0.14), color: WARN, fontWeight: 700 }} />}
                  </Stack>
                ))}
                {routes.length === 0 && <Typography variant="body2" color="text.secondary">No active routes yet.</Typography>}
              </Stack>
            </Panel>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}

function InfoRow({ label, value, color }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center">
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" fontWeight={700} sx={{ color }}>{value}</Typography>
    </Stack>
  );
}
