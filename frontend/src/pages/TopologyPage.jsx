import React, { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Box, Grid, Typography, Stack, Chip, useTheme, alpha, Card, Button, Divider, Tooltip } from '@mui/material';
import HubIcon      from '@mui/icons-material/Hub';
import BlockIcon    from '@mui/icons-material/Block';
import RestoreIcon  from '@mui/icons-material/Restore';
import RouterIcon   from '@mui/icons-material/Router';
import SensorsIcon  from '@mui/icons-material/Sensors';
import AltRouteIcon from '@mui/icons-material/AltRoute';
import { useSim } from '../sim/SimContext';
import {
  PageHeader, Panel, StatCard, LiveDot, LegendDot, trustColor, STATUS_COLORS,
  zoneColor, ISOLATION_TREATMENT, pulse, ATTACK_COLORS,
} from '../utils/ui';
import { ACCENT, ACCENT2, WARN, DANGER } from '../context/ThemeContext';

export default function TopologyPage() {
  const theme = useTheme();
  const grid = theme.palette.divider;
  const sim = useSim();
  const location = useLocation();
  const [selected, setSelected] = useState(null);
  const [activeZone, setActiveZone] = useState(null);

  // arriving from a Notifications card click — pre-select the node it named
  useEffect(() => {
    if (location.state?.selectedNode) setSelected(location.state.selectedNode);
  }, [location.state]);

  const nodes = sim.nodes;
  const routes = sim.routes.filter(r => r.is_active).slice(0, 8);
  const byUid = Object.fromEntries(nodes.map(n => [n.node_uid, n]));
  const sel = selected ? byUid[selected] : null;

  const active = sim.stats.activeNodes;
  const isolated = sim.stats.isolatedNodes;
  const rerouted = sim.stats.reroutedPaths;

  const X = (x) => 40 + (x / 100) * 920;
  const Y = (y) => 30 + (y / 100) * 540;

  // ── zones — group nodes under their Cluster Head so the map shows areas ──
  const zones = useMemo(() => {
    const byZone = {};
    nodes.forEach(n => {
      if (!n.zone_label) return;
      (byZone[n.zone_label] ??= []).push(n);
    });
    return Object.entries(byZone).map(([label, members]) => {
      const cx = members.reduce((s, n) => s + n.pos_x, 0) / members.length;
      const cy = members.reduce((s, n) => s + n.pos_y, 0) / members.length;
      const radius = Math.max(14, ...members.map(n => Math.hypot(n.pos_x - cx, n.pos_y - cy))) + 8;
      const hasThreat = members.some(n => n.is_malicious && !n.is_isolated);
      return { label, members, cx, cy, radius, color: zoneColor(label), hasThreat };
    });
  }, [nodes]);

  // Wormhole is a two-node tunnel attack — draw the colluding pair as a link
  const wormholeLinks = useMemo(() => {
    const seen = new Set();
    const links = [];
    nodes.forEach(n => {
      if (n.attack !== 'Wormhole' || !n.partner || !byUid[n.partner]) return;
      const key = [n.node_uid, n.partner].sort().join('|');
      if (seen.has(key)) return;
      seen.add(key);
      links.push({ a: n, b: byUid[n.partner] });
    });
    return links;
  }, [nodes, byUid]);

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

      <Stack direction="row" spacing={1} mb={2} flexWrap="wrap" useFlexGap alignItems="center">
        <Typography variant="caption" color="text.secondary" fontWeight={700} textTransform="uppercase" letterSpacing={0.6} mr={0.5}>Areas</Typography>
        <Chip label="All zones" size="small" clickable onClick={() => setActiveZone(null)}
          sx={{ fontWeight: activeZone === null ? 700 : 500,
            bgcolor: activeZone === null ? alpha(ACCENT, 0.18) : alpha(theme.palette.text.primary, 0.05),
            color: activeZone === null ? ACCENT : 'text.secondary' }} />
        {zones.map(z => (
          <Chip key={z.label} label={z.label} size="small" clickable onClick={() => setActiveZone(activeZone === z.label ? null : z.label)}
            icon={z.hasThreat ? <BlockIcon sx={{ fontSize: 13 }} /> : undefined}
            sx={{ fontWeight: activeZone === z.label ? 700 : 500,
              bgcolor: activeZone === z.label ? alpha(z.color, 0.22) : alpha(z.color, 0.08),
              color: z.color, border: `1px solid ${alpha(z.color, activeZone === z.label ? 0.6 : 0.25)}`,
              '& .MuiChip-icon': { color: DANGER } }} />
        ))}
      </Stack>

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

              {/* zone areas — soft boundary + label per Cluster Head grouping */}
              {zones.map(z => {
                const dim = activeZone && activeZone !== z.label;
                const rx = (z.radius / 100) * 920, ry = (z.radius / 100) * 540;
                return (
                  <g key={z.label} opacity={dim ? 0.15 : 1} style={{ transition: 'opacity .25s' }}>
                    <ellipse cx={X(z.cx)} cy={Y(z.cy)} rx={rx} ry={ry}
                      fill={alpha(z.color, 0.06)} stroke={alpha(z.color, 0.4)} strokeWidth={1.2} strokeDasharray="6 5" />
                    <text x={X(z.cx)} y={Y(z.cy) - ry - 8} fontSize={11} fontWeight={800} textAnchor="middle" fill={z.color}>
                      {z.label}{z.hasThreat ? ' ⚠' : ''}
                    </text>
                  </g>
                );
              })}

              {/* Wormhole tunnels — two colluding nodes, drawn as a distinct glowing link */}
              {wormholeLinks.map(({ a, b }) => {
                const dim = activeZone && a.zone_label !== activeZone && b.zone_label !== activeZone;
                const x1 = X(a.pos_x), y1 = Y(a.pos_y), x2 = X(b.pos_x), y2 = Y(b.pos_y);
                const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
                return (
                  <g key={`wh-${a.node_uid}-${b.node_uid}`} opacity={dim ? 0.15 : 1} style={{ transition: 'opacity .25s' }}>
                    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={ATTACK_COLORS.Wormhole} strokeWidth={2.4}
                      strokeDasharray="3 6" strokeLinecap="round" opacity={0.85}>
                      <animate attributeName="stroke-dashoffset" values="0;-18" dur="1s" repeatCount="indefinite" />
                    </line>
                    <g>
                      <circle cx={mx} cy={my} r={8} fill={theme.palette.background.paper} stroke={ATTACK_COLORS.Wormhole} strokeWidth={1} />
                      <circle cx={mx} cy={my} r={4.5} fill="none" stroke={ATTACK_COLORS.Wormhole} strokeWidth={1.2} />
                      <circle cx={mx} cy={my} r={1.6} fill={ATTACK_COLORS.Wormhole} />
                    </g>
                  </g>
                );
              })}

              {/* routes + animated packets */}
              {routes.map((r, ri) => {
                const pts = (r.hops || []).map(h => byUid[h]).filter(Boolean);
                const dim = activeZone && !pts.some(p => p.zone_label === activeZone);
                return pts.slice(0, -1).map((p, i) => {
                  const q = pts[i + 1];
                  const stroke = r.reconfigured ? WARN : alpha(ACCENT, 0.55);
                  return (
                    <g key={`r${ri}-${i}`} opacity={dim ? 0.12 : 1} style={{ transition: 'opacity .25s' }}>
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
                const cx = X(n.pos_x), cy = Y(n.pos_y);
                const treatment = ISOLATION_TREATMENT[n.attack];
                const dim = activeZone && n.zone_label && n.zone_label !== activeZone;
                const tip = `${n.node_uid} · ${n.role} · trust ${n.trust_score?.toFixed(2)}${n.zone_label ? ` · ${n.zone_label}` : ''}${n.is_isolated ? ' · ISOLATED' : n.is_malicious ? ` · ${n.attack}` : ''}`;
                return (
                  <Tooltip key={n.node_uid} title={tip} arrow>
                  <g style={{ cursor: 'pointer', opacity: dim ? 0.18 : 1, transition: 'opacity .25s' }}
                    onClick={() => setSelected(n.node_uid)}>
                    {isSink && <circle cx={cx} cy={cy} r={30} fill="url(#sinkGlow)" />}
                    {selected === n.node_uid && <circle cx={cx} cy={cy} r={r + 7} fill="none" stroke={ACCENT} strokeWidth={2} />}

                    {/* isolation "trick" — distinct ring treatment per attack type once quarantined */}
                    {n.is_isolated && treatment ? (
                      <circle cx={cx} cy={cy} r={r + 6} fill="none" stroke={c} strokeWidth={1.6} strokeDasharray={treatment.dash} opacity={0.75}>
                        {treatment.ringAnim === pulse
                          ? <animate attributeName="opacity" values="0.8;0.25;0.8" dur="1.6s" repeatCount="indefinite" />
                          : <animateTransform attributeName="transform" type="rotate" from={`0 ${cx} ${cy}`} to={`360 ${cx} ${cy}`} dur="3s" repeatCount="indefinite" />}
                      </circle>
                    ) : hot && (
                      <circle cx={cx} cy={cy} r={r + 5} fill="none" stroke={c} strokeWidth={1.5} opacity={0.6}>
                        <animate attributeName="r" values={`${r + 3};${r + 10}`} dur="1.4s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.6;0" dur="1.4s" repeatCount="indefinite" />
                      </circle>
                    )}

                    <circle cx={cx} cy={cy} r={r} fill={alpha(c, 0.85)} stroke={c} strokeWidth={2} />
                    {isSink && <circle cx={cx} cy={cy} r={r + 4} fill="none" stroke={c} strokeWidth={1} strokeDasharray="3 3" />}
                    {n.is_isolated && treatment && (
                      <g>
                        <circle cx={cx + r - 2} cy={cy - r + 2} r={6.5} fill={theme.palette.background.paper} stroke={c} strokeWidth={1} />
                        <AttackBadgeGlyph attack={n.attack} cx={cx + r - 2} cy={cy - r + 2} color={c} />
                      </g>
                    )}
                    <text x={cx} y={cy - r - 5} fontSize={10} textAnchor="middle"
                      fill={theme.palette.text.secondary} fontFamily="'JetBrains Mono', monospace">{n.node_uid}</text>
                  </g>
                  </Tooltip>
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
                {sel.zone_label && <InfoRow label="Area" value={sel.zone_label} color={zoneColor(sel.zone_label)} />}
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

// Tiny hand-drawn glyphs, one per attack type — plain SVG primitives only.
// (A React icon component rendered as a nested <svg> inside this hand-authored
// map does not size reliably across browsers, so no MUI icons in here.)
function AttackBadgeGlyph({ attack, cx, cy, color }) {
  switch (attack) {
    case 'Blackhole':
      return <g><circle cx={cx} cy={cy} r={3.4} fill="none" stroke={color} strokeWidth={1.2} />
        <line x1={cx - 2.4} y1={cy - 2.4} x2={cx + 2.4} y2={cy + 2.4} stroke={color} strokeWidth={1.2} /></g>;
    case 'Sybil':
      return <g>
        <line x1={cx} y1={cy + 2.6} x2={cx} y2={cy - 0.5} stroke={color} strokeWidth={1.2} />
        <line x1={cx} y1={cy - 0.5} x2={cx - 2.4} y2={cy - 2.8} stroke={color} strokeWidth={1.2} />
        <line x1={cx} y1={cy - 0.5} x2={cx + 2.4} y2={cy - 2.8} stroke={color} strokeWidth={1.2} />
      </g>;
    case 'Wormhole':
      return <g><circle cx={cx} cy={cy} r={3.2} fill="none" stroke={color} strokeWidth={1.2} />
        <circle cx={cx} cy={cy} r={1} fill={color} /></g>;
    case 'Grayhole':
      return <g><ellipse cx={cx} cy={cy} rx={3.4} ry={2} fill="none" stroke={color} strokeWidth={1.1} />
        <line x1={cx - 3} y1={cy + 2.4} x2={cx + 3} y2={cy - 2.4} stroke={color} strokeWidth={1.2} /></g>;
    default:
      return <circle cx={cx} cy={cy} r={2} fill={color} />;
  }
}

function InfoRow({ label, value, color }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center">
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" fontWeight={700} sx={{ color }}>{value}</Typography>
    </Stack>
  );
}
