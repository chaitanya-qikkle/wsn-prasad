import React, { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Box, Grid, Typography, Stack, Chip, useTheme, alpha, Card, Button, Divider, LinearProgress, Tooltip,
} from '@mui/material';
import HubIcon      from '@mui/icons-material/Hub';
import BlockIcon    from '@mui/icons-material/Block';
import RestoreIcon  from '@mui/icons-material/Restore';
import RouterIcon   from '@mui/icons-material/Router';
import SensorsIcon  from '@mui/icons-material/Sensors';
import AltRouteIcon from '@mui/icons-material/AltRoute';
import HealingIcon  from '@mui/icons-material/Healing';
import { useSim } from '../sim/SimContext';
import {
  PageHeader, Panel, StatCard, LiveDot, LegendDot, PhaseChip, trustColor,
  zoneColor, ISOLATION_TREATMENT, ATTACK_COLORS, formatDuration,
} from '../utils/ui';
import { ACCENT, ACCENT2, WARN, DANGER } from '../context/ThemeContext';
import NetworkMap from '../components/NetworkMap';
import { useLiveMap } from '../components/networkMapHooks';

export default function TopologyPage() {
  const theme = useTheme();
  const grid = theme.palette.divider;
  const sim = useSim();
  const location = useLocation();
  const [selected, setSelected] = useState(null);
  const [activeZone, setActiveZone] = useState(null);

  // arriving from a notification / dashboard click — pre-select the node it named
  useEffect(() => {
    if (location.state?.selectedNode) setSelected(location.state.selectedNode);
  }, [location.state]);

  const nodes = sim.nodes;
  const routes = useMemo(() => sim.routes.filter(r => r.is_active).slice(0, 8), [sim.routes]);
  const { byUid, zones, wormholeLinks, recentlyRecovered } = useLiveMap(sim);
  const sel = selected ? byUid[selected] : null;

  const readmitAt = (sim.autoRecovery?.threshold ?? 0.4) + 0.25;
  const selEpisode = useMemo(
    () => (sim.attackTimeline || []).find(e => e.node_uid === selected), [sim.attackTimeline, selected]);

  // which attack types are actually present, so the legend explains only what
  // is on screen rather than listing all four every time
  const liveTreatments = useMemo(() => {
    const kinds = new Set();
    nodes.forEach(n => { if (n.is_isolated && n.is_malicious && n.attack) kinds.add(n.attack); });
    return [...kinds];
  }, [nodes]);

  return (
    <Box>
      <PageHeader icon={<HubIcon />} title="Network Topology"
        subtitle="Live field map — trust, quarantine state, wormhole tunnels and trust-aware AODV routes to the sink"
        action={
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
            <LiveDot color={ACCENT2} />
            <LegendDot color={ACCENT2} label="Trusted" />
            <LegendDot color={WARN} label="Suspect" />
            <LegendDot color={DANGER} label="Attacking" />
            <LegendDot color={ACCENT} label="Recovering" />
          </Stack>
        } />

      <Grid container spacing={2.5} mb={2.5}>
        <Grid item xs={6} md={3}><StatCard icon={<SensorsIcon />} label="Total Nodes" value={nodes.length} color={ACCENT} sub="deployed" /></Grid>
        <Grid item xs={6} md={3}><StatCard icon={<HubIcon />} label="In Service" value={sim.stats.activeNodes} color={ACCENT2} sub="forwarding" /></Grid>
        <Grid item xs={6} md={3}><StatCard icon={<HealingIcon />} label="Recovering" value={sim.stats.recoveringNodes} color={ACCENT} sub="rebuilding trust" /></Grid>
        <Grid item xs={6} md={3}><StatCard icon={<AltRouteIcon />} label="Rerouted" value={sim.stats.reroutedPaths} color={WARN} sub="avoided bad nodes" /></Grid>
      </Grid>

      <Stack direction="row" spacing={1} mb={2} flexWrap="wrap" useFlexGap alignItems="center">
        <Typography variant="caption" color="text.secondary" fontWeight={700} textTransform="uppercase"
          letterSpacing={0.6} mr={0.5}>Areas</Typography>
        <Chip label="All zones" size="small" clickable onClick={() => setActiveZone(null)}
          sx={{ fontWeight: activeZone === null ? 700 : 500,
            bgcolor: activeZone === null ? alpha(ACCENT, 0.18) : alpha(theme.palette.text.primary, 0.05),
            color: activeZone === null ? ACCENT : 'text.secondary' }} />
        {zones.map(z => {
          const state = z.hasThreat ? DANGER : z.healing ? ACCENT : z.recovered ? ACCENT2 : z.color;
          return (
            <Chip key={z.label} label={z.label + (z.recovered ? ' ✓' : '')} size="small" clickable
              onClick={() => setActiveZone(activeZone === z.label ? null : z.label)}
              icon={z.hasThreat ? <BlockIcon sx={{ fontSize: 13 }} />
                : z.healing ? <HealingIcon sx={{ fontSize: 13 }} /> : undefined}
              sx={{ fontWeight: activeZone === z.label ? 700 : 500,
                bgcolor: activeZone === z.label ? alpha(state, 0.22) : alpha(state, 0.08),
                color: state, border: `1px solid ${alpha(state, activeZone === z.label ? 0.6 : 0.25)}`,
                '& .MuiChip-icon': { color: 'inherit' } }} />
          );
        })}
      </Stack>

      <Grid container spacing={2.5}>
        <Grid item xs={12} lg={8.5}>
          <Card sx={{ p: 1.2 }}>
            <NetworkMap nodes={nodes} routes={routes} zones={zones} wormholeLinks={wormholeLinks}
              selected={selected} onSelect={setSelected} activeZone={activeZone}
              recentlyRecovered={recentlyRecovered} />
          </Card>

          {/* "Different tricks for different isolation" — the map draws each
              attack type differently; this says what each treatment means. */}
          <Box mt={2.5}>
            <Panel accent={WARN} title="Reading the Map"
              subtitle="Quarantine looks different per attack type, so the map tells you what was caught — not just that something was.">
              <Grid container spacing={1.5}>
                {Object.entries(ISOLATION_TREATMENT).map(([attack, t]) => {
                  const c = ATTACK_COLORS[attack];
                  const live = liveTreatments.includes(attack);
                  return (
                    <Grid item xs={12} sm={6} key={attack}>
                      <Stack direction="row" spacing={1.4} alignItems="center"
                        sx={{ p: 1.2, borderRadius: 2, height: '100%',
                          border: `1px solid ${alpha(c, live ? 0.45 : 0.18)}`,
                          background: alpha(c, live ? 0.09 : 0.03),
                          opacity: live ? 1 : 0.65 }}>
                        <TreatmentSwatch attack={attack} color={c} />
                        <Box minWidth={0}>
                          <Stack direction="row" spacing={0.8} alignItems="center">
                            <Typography variant="body2" fontWeight={800} sx={{ color: c }}>{attack}</Typography>
                            {live && <Chip size="small" label="on map" sx={{ height: 17, fontSize: 9,
                              fontWeight: 800, bgcolor: alpha(c, 0.18), color: c }} />}
                          </Stack>
                          <Typography variant="caption" color="text.secondary" lineHeight={1.45}>{t.label}</Typography>
                        </Box>
                      </Stack>
                    </Grid>
                  );
                })}
                <Grid item xs={12} sm={6}>
                  <Stack direction="row" spacing={1.4} alignItems="center"
                    sx={{ p: 1.2, borderRadius: 2, height: '100%',
                      border: `1px solid ${alpha(ACCENT, 0.45)}`, background: alpha(ACCENT, 0.07) }}>
                    <Box component="svg" viewBox="0 0 40 40" sx={{ width: 40, height: 40, flexShrink: 0 }}>
                      <circle cx="20" cy="20" r="15" fill="none" stroke={alpha(ACCENT, 0.25)} strokeWidth="3" />
                      <circle cx="20" cy="20" r="15" fill="none" stroke={ACCENT} strokeWidth="3" strokeLinecap="round"
                        strokeDasharray={2 * Math.PI * 15} strokeDashoffset={2 * Math.PI * 15 * 0.35}
                        transform="rotate(-90 20 20)" />
                      <circle cx="20" cy="20" r="7" fill={alpha(ACCENT, 0.85)} stroke={ACCENT} strokeWidth="2" />
                    </Box>
                    <Box minWidth={0}>
                      <Typography variant="body2" fontWeight={800} sx={{ color: ACCENT }}>Recovering</Typography>
                      <Typography variant="caption" color="text.secondary" lineHeight={1.45}>
                        arc fills as trust rebuilds toward readmission
                      </Typography>
                    </Box>
                  </Stack>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Stack direction="row" spacing={1.4} alignItems="center"
                    sx={{ p: 1.2, borderRadius: 2, height: '100%',
                      border: `1px solid ${alpha(ACCENT2, 0.45)}`, background: alpha(ACCENT2, 0.07) }}>
                    <Box component="svg" viewBox="0 0 40 40" sx={{ width: 40, height: 40, flexShrink: 0 }}>
                      <circle cx="20" cy="20" r="14" fill="none" stroke={ACCENT2} strokeWidth="2" opacity="0.7" />
                      <circle cx="20" cy="20" r="8" fill={alpha(ACCENT2, 0.85)} stroke={ACCENT2} strokeWidth="2" />
                      <path d="M 16.5 20 l 2.4 2.6 l 4.6 -5.2" fill="none" stroke="#fff" strokeWidth="2"
                        strokeLinecap="round" strokeLinejoin="round" />
                    </Box>
                    <Box minWidth={0}>
                      <Typography variant="body2" fontWeight={800} sx={{ color: ACCENT2 }}>Recovered</Typography>
                      <Typography variant="caption" color="text.secondary" lineHeight={1.45}>
                        green tick — node is back in the routing pool
                      </Typography>
                    </Box>
                  </Stack>
                </Grid>
              </Grid>
            </Panel>
          </Box>
        </Grid>

        <Grid item xs={12} lg={3.5}>
          <Panel title="Node Inspector" accent={ACCENT}>
            {!sel && (
              <Typography variant="body2" color="text.secondary">
                Click a node on the map to inspect its trust profile, recovery progress and take action.
              </Typography>
            )}
            {sel && (
              <Stack spacing={1.5}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="h6" fontWeight={800} fontFamily="'JetBrains Mono', monospace">{sel.node_uid}</Typography>
                  <PhaseChip phase={sel.phase || sel.status} />
                </Stack>
                <Typography variant="body2" color="text.secondary">{sel.label} · {sel.role}</Typography>

                {sel.is_isolated && !sel.is_malicious && (
                  <Box sx={{ p: 1.4, borderRadius: 2, border: `1px solid ${alpha(ACCENT, 0.35)}`,
                    background: alpha(ACCENT, 0.07) }}>
                    <Stack direction="row" alignItems="center" spacing={0.8} mb={0.8}>
                      <HealingIcon sx={{ fontSize: 16, color: ACCENT }} />
                      <Typography variant="caption" fontWeight={800} sx={{ color: ACCENT }}>
                        Recovering automatically
                      </Typography>
                    </Stack>
                    <LinearProgress variant="determinate"
                      value={Math.min(100, ((sel.trust_score || 0) / readmitAt) * 100)}
                      sx={{ height: 6, borderRadius: 999, bgcolor: alpha(ACCENT, 0.15),
                        '& .MuiLinearProgress-bar': { bgcolor: ACCENT } }} />
                    <Typography variant="caption" color="text.secondary" display="block" mt={0.7}>
                      Attack scrubbed. Trust {sel.trust_score?.toFixed(2)} — rejoins routing at {readmitAt.toFixed(2)}.
                    </Typography>
                  </Box>
                )}

                <Divider sx={{ borderColor: grid }} />
                {sel.zone_label && <InfoRow label="Area" value={sel.zone_label} color={zoneColor(sel.zone_label)} />}
                <InfoRow label="Trust score" value={sel.trust_score.toFixed(3)} color={trustColor(sel.trust_score)} />
                <InfoRow label="Energy" value={`${sel.energy.toFixed(0)}%`} />
                <InfoRow label="Packets forwarded" value={sel.packets_fwd} />
                <InfoRow label="Packets dropped" value={sel.packets_drop} color={sel.packets_drop > 50 ? DANGER : undefined} />
                <InfoRow label="Ground truth" value={sel.is_malicious ? (sel.attack || 'MALICIOUS') : 'Benign'}
                  color={sel.is_malicious ? DANGER : ACCENT2} />
                {sel.partner && (
                  <InfoRow label="Wormhole partner" value={sel.partner} color={ATTACK_COLORS.Wormhole} />
                )}

                {selEpisode && (
                  <>
                    <Divider sx={{ borderColor: grid }} />
                    <Typography variant="caption" color="text.secondary" fontWeight={700}
                      textTransform="uppercase" letterSpacing={0.6}>Incident timing</Typography>
                    <InfoRow label="Detected after" value={formatDuration(selEpisode.detect_sec)} color={WARN} />
                    <InfoRow label="Isolated after" value={formatDuration(selEpisode.isolate_sec)} color={DANGER} />
                    <InfoRow label="Back in service after" value={formatDuration(selEpisode.recover_sec)} color={ACCENT} />
                    <InfoRow label="End to end" value={formatDuration(selEpisode.total_sec)} color={ACCENT2} />
                  </>
                )}

                <Divider sx={{ borderColor: grid }} />
                {sel.is_isolated
                  ? <Tooltip title="Skip the automatic pipeline and return this node to service now.">
                      <Button startIcon={<RestoreIcon />} variant="outlined" color="success"
                        onClick={() => sim.restore(sel.node_uid)}>Restore Now</Button>
                    </Tooltip>
                  : <Button startIcon={<BlockIcon />} variant="contained" color="error"
                      onClick={() => sim.isolate(sel.node_uid)}>Isolate Node</Button>}
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
                      <Typography variant="caption" fontWeight={700} noWrap display="block"
                        fontFamily="'JetBrains Mono', monospace">{(r.hops || []).join(' → ')}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {r.hop_count} hops · {r.latency?.toFixed(0)}ms · trust {r.path_trust}
                      </Typography>
                    </Box>
                    {r.reconfigured && <Chip size="small" label="rerouted" sx={{ fontSize: 9, height: 19,
                      bgcolor: alpha(WARN, 0.14), color: WARN, fontWeight: 700 }} />}
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

// Miniature of exactly what the map draws for this attack's quarantine ring.
function TreatmentSwatch({ attack, color }) {
  const t = ISOLATION_TREATMENT[attack];
  const dash = t.dash === 'none' ? undefined : t.dash.split(' ').map(v => +v * 1.6).join(' ');
  return (
    <Box component="svg" viewBox="0 0 40 40" sx={{ width: 40, height: 40, flexShrink: 0 }}>
      {Array.from({ length: t.rings }).map((_, k) => (
        <circle key={k} cx="20" cy="20" r={14 - k * 4} fill="none" stroke={color} strokeWidth="1.6"
          strokeDasharray={dash} opacity={0.85 - k * 0.25} />
      ))}
      <circle cx="20" cy="20" r="7" fill={alphaHex(color)} stroke={color} strokeWidth="2" />
    </Box>
  );
}
const alphaHex = (c) => `${c}D9`;  // ~85% opacity, matching the map's node fill

function InfoRow({ label, value, color }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center">
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" fontWeight={700} sx={{ color }}>{value}</Typography>
    </Stack>
  );
}
