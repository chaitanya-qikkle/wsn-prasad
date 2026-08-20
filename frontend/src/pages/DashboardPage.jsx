import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Grid, Typography, Stack, Chip, useTheme, alpha, Divider,
} from '@mui/material';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RTooltip } from 'recharts';
import SensorsIcon      from '@mui/icons-material/Sensors';
import GppMaybeIcon     from '@mui/icons-material/GppMaybe';
import BlockIcon        from '@mui/icons-material/Block';
import ShieldMoonIcon   from '@mui/icons-material/ShieldMoon';
import LinkIcon         from '@mui/icons-material/Link';
import TimerIcon        from '@mui/icons-material/Timer';
import HubIcon          from '@mui/icons-material/Hub';
import HealingIcon      from '@mui/icons-material/Healing';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import { useSim } from '../sim/SimContext';
import { ACCENT, ACCENT2, NEON, DANGER, WARN, GOLD } from '../context/ThemeContext';
import {
  PageHeader, Panel, StatCard, Gauge, LiveDot, useChartTip, ATTACK_COLORS, popIn, zoneColor,
  formatDuration,
} from '../utils/ui';
import NetworkMap from '../components/NetworkMap';
import { useLiveMap } from '../components/networkMapHooks';
import PhaseCompare from '../components/PhaseCompare';
import LiveChart, { BeforeAfterBars } from '../components/LiveChart';
import {
  AutoRecoveryBanner, RecoveryTimings, AttackTimeline, SystemComparison, RecoveryLog,
} from '../components/RecoveryPanels';

export default function DashboardPage() {
  const theme = useTheme();
  const grid = theme.palette.divider;
  const tip = useChartTip();
  const sim = useSim();
  const navigate = useNavigate();
  const s = sim.stats;
  const series = sim.metricsHist;

  // One source, one rounding, everywhere in the app (sidebar, dashboard,
  // metrics, attack lab). The backend caches its per-round metrics for the
  // same reason — the same live value must never read as two numbers.
  const pdr = Math.round(s.pdr ?? 0);
  const health = pdr >= 85 ? ACCENT2 : pdr >= 60 ? WARN : DANGER;
  const sum = sim.recoverySummary || {};

  const { zones, wormholeLinks, recentlyRecovered } = useLiveMap(sim);
  const liveRoutes = useMemo(() => sim.routes.filter(r => r.is_active).slice(0, 8), [sim.routes]);

  const dist = useMemo(() => {
    const counts = {};
    sim.attacks.forEach(a => { counts[a.attack_type] = (counts[a.attack_type] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value, color: ATTACK_COLORS[name] || NEON }))
      .sort((a, b) => b.value - a.value);
  }, [sim.attacks]);
  const distTotal = dist.reduce((a, b) => a + b.value, 0) || 1;
  const [activeSlice, setActiveSlice] = useState(null);

  const zoneHealth = useMemo(() => zones.map(z => ({
    label: z.label,
    color: zoneColor(z.label),
    total: z.members.length,
    isolated: z.members.filter(n => n.is_isolated).length,
    healing: z.members.filter(n => n.is_isolated && !n.is_malicious).length,
    malicious: z.members.filter(n => n.is_malicious && !n.is_isolated).length,
    active: z.members.filter(n => !n.is_isolated).length,
    recovered: z.recovered,
  })), [zones]);

  return (
    <Box>
      <PageHeader icon={<SensorsIcon />} title="Security Operations"
        subtitle="Live industrial WSN — trust, detections, automatic recovery and on-chain provenance"
        action={
          <Stack direction="row" spacing={1} alignItems="center">
            <LiveDot color={health} />
            <Chip label={`${s.maliciousActive} active threats`} size="small"
              sx={{ fontWeight: 700, bgcolor: alpha(s.maliciousActive ? DANGER : ACCENT2, 0.14),
                color: s.maliciousActive ? DANGER : ACCENT2,
                border: `1px solid ${alpha(s.maliciousActive ? DANGER : ACCENT2, 0.3)}` }} />
            {s.recoveringNodes > 0 && (
              <Chip label={`${s.recoveringNodes} recovering`} size="small" icon={<HealingIcon sx={{ fontSize: 15 }} />}
                sx={{ fontWeight: 700, bgcolor: alpha(ACCENT, 0.14), color: ACCENT,
                  border: `1px solid ${alpha(ACCENT, 0.3)}`, '& .MuiChip-icon': { color: 'inherit' } }} />
            )}
          </Stack>
        } />

      {/* ── KPI ROW ── */}
      <Grid container spacing={2.5} mb={2.5}>
        <Grid item xs={6} md={4} lg={2}>
          <StatCard icon={<SensorsIcon />} label="Nodes" value={s.totalNodes} color={ACCENT}
            sub={`${s.activeNodes} in service`} /></Grid>
        <Grid item xs={6} md={4} lg={2}>
          <StatCard icon={<GppMaybeIcon />} label="Active Threats" value={s.maliciousActive}
            color={s.maliciousActive ? DANGER : ACCENT2} sub={`${s.detections} detections on-chain`} /></Grid>
        <Grid item xs={6} md={4} lg={2}>
          <StatCard icon={<BlockIcon />} label="Quarantined" value={s.isolatedNodes} color={WARN}
            sub={s.recoveringNodes ? `${s.recoveringNodes} healing` : 'none healing'} /></Grid>
        <Grid item xs={6} md={4} lg={2}>
          <StatCard icon={<HealingIcon />} label="Auto-Recovered" value={sum.autoRecoveries || 0} color={ACCENT2}
            sub={sum.manualRecoveries ? `${sum.manualRecoveries} manual` : 'zero manual steps'} /></Grid>
        <Grid item xs={6} md={4} lg={2}>
          <StatCard icon={<TimerIcon />} label="Avg Recovery" value={formatDuration(sum.avgTotalSec)}
            color={NEON} sub="attack → back in service" /></Grid>
        <Grid item xs={6} md={4} lg={2}>
          <StatCard icon={<LinkIcon />} label="Chain Height" value={s.blockHeight} color={GOLD}
            sub={sim.chainValid ? 'chain verified' : 'integrity broken'} /></Grid>
      </Grid>

      {/* ── AUTOMATIC RECOVERY — the headline capability ── */}
      <Box mb={2.5}><AutoRecoveryBanner sim={sim} /></Box>

      {/* ── LIVE MAP + HEALTH ── */}
      <Grid container spacing={2.5} mb={2.5}>
        <Grid item xs={12} lg={8}>
          <Panel accent={ACCENT} sx={{ height: '100%' }}
            title={<Stack direction="row" spacing={1} alignItems="center">
              <HubIcon sx={{ fontSize: 18, color: ACCENT }} />
              <Typography variant="subtitle1" fontWeight={700}>Live Network Map</Typography>
              <LiveDot color={health} />
            </Stack>}
            subtitle="Scroll to zoom, drag to pan, hover a node to isolate its routes, click to inspect it."
            action={<MapLegend />}>
            <NetworkMap nodes={sim.nodes} routes={liveRoutes} zones={zones} wormholeLinks={wormholeLinks}
              recentlyRecovered={recentlyRecovered}
              onSelect={(uid) => navigate('/topology', { state: { selectedNode: uid } })} />
          </Panel>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Panel title="Network Health" accent={health} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Stack alignItems="center" py={1}>
              <Gauge value={pdr} color={health} label="PACKET DELIVERY" size={168} />
            </Stack>
            <Divider sx={{ borderColor: grid, my: 1.5 }} />
            <Stack direction="row" justifyContent="space-around" mb={2}>
              <Mini label="Delay" value={`${(s.delay ?? 0).toFixed(1)} ms`} />
              <Mini label="Throughput" value={`${(s.throughput ?? 0).toFixed(0)}`} />
              <Mini label="Overhead" value={`${(s.overhead ?? 0).toFixed(1)}%`} />
            </Stack>
            <Divider sx={{ borderColor: grid, mb: 1.6 }} />
            <Typography variant="caption" color="text.secondary" fontWeight={700}
              textTransform="uppercase" letterSpacing={0.6} display="block" mb={1.2}>
              Before vs after this incident
            </Typography>
            {sim.phaseSnapshots?.before ? (
              <BeforeAfterBars phases={sim.phaseSnapshots} metrics={[
                { label: 'Packet delivery', get: p => p.pdr, colors: [ACCENT2, DANGER, ACCENT],
                  format: v => `${Math.round(v)}%` },
                { label: 'Nodes out of service', get: p => p.isolated, colors: [ACCENT2, DANGER, ACCENT] },
              ]} />
            ) : (
              <Typography variant="caption" color="text.secondary">
                Captured automatically the moment the next attack starts.
              </Typography>
            )}
          </Panel>
        </Grid>
      </Grid>

      {/* ── BEFORE / UNDER ATTACK / AFTER RECOVERY ── */}
      <Panel sx={{ mb: 2.5 }} accent={ACCENT2}
        title={<Stack direction="row" spacing={1} alignItems="center">
          <CompareArrowsIcon sx={{ fontSize: 19, color: ACCENT2 }} />
          <Typography variant="subtitle1" fontWeight={700}>How the Network Recovers</Typography>
        </Stack>}
        subtitle="The same field at three moments — captured automatically as the incident unfolds.">
        <PhaseCompare phases={sim.phaseSnapshots} live={sim.nodes} onReset={sim.clearPhases} />
      </Panel>

      {/* ── RECOVERY TIME + SYSTEM COMPARISON ── */}
      <Grid container spacing={2.5} mb={2.5}>
        <Grid item xs={12} lg={5}><RecoveryTimings sim={sim} /></Grid>
        <Grid item xs={12} lg={7}><SystemComparison sim={sim} /></Grid>
      </Grid>

      {/* ── LIFECYCLE TIMELINE + RECOVERY CONFIRMATIONS ── */}
      <Grid container spacing={2.5} mb={2.5}>
        <Grid item xs={12} lg={7}>
          <AttackTimeline sim={sim} onSelect={(uid) => navigate('/topology', { state: { selectedNode: uid } })} />
        </Grid>
        <Grid item xs={12} lg={5}>
          <RecoveryLog sim={sim} />
        </Grid>
      </Grid>

      {/* ── CHARTS ── */}
      <Grid container spacing={2.5}>
        <Grid item xs={12} lg={8}>
          <Panel accent={ACCENT} title="Network Performance"
            subtitle="Shaded windows are the periods the network was actually under attack — drag the brush to zoom.">
            <LiveChart data={series} height={280} brush rightAxis
              series={[
                { key: 'pdr', label: 'PDR %', color: ACCENT, type: 'area' },
                { key: 'throughput', label: 'Throughput', color: ACCENT2, type: 'area' },
                { key: 'malicious', label: 'Active threats', color: DANGER, type: 'bar', axis: 'right' },
                { key: 'recovering', label: 'Recovering', color: NEON, type: 'bar', axis: 'right' },
              ]} />
          </Panel>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Panel accent={GOLD} title="Attack Distribution" sx={{ height: '100%' }}
            subtitle="Click a type to open it in Detection.">
            {dist.length === 0
              ? <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 240 }}>
                  <Stack alignItems="center" spacing={1}>
                    <ShieldMoonIcon sx={{ fontSize: 36, color: ACCENT2 }} />
                    <Typography variant="body2" color="text.secondary" textAlign="center">No attacks recorded yet.</Typography>
                  </Stack>
                </Box>
              : <>
                  <Box sx={{ position: 'relative', height: 178 }}>
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie data={dist} dataKey="value" nameKey="name" innerRadius={54} outerRadius={78}
                          paddingAngle={2} isAnimationActive={false}
                          onMouseEnter={(_, i) => setActiveSlice(dist[i]?.name)}
                          onMouseLeave={() => setActiveSlice(null)}
                          onClick={() => navigate('/attacks')}>
                          {dist.map(d => (
                            <Cell key={d.name} fill={d.color} stroke="none" cursor="pointer"
                              opacity={activeSlice && activeSlice !== d.name ? 0.35 : 1} />
                          ))}
                        </Pie>
                        <RTooltip contentStyle={tip} />
                      </PieChart>
                    </ResponsiveContainer>
                    <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                      <Typography sx={{ fontFamily: '"JetBrains Mono", monospace', fontWeight: 800, fontSize: 26, lineHeight: 1 }}>
                        {activeSlice ? dist.find(d => d.name === activeSlice)?.value : distTotal}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {activeSlice || 'detections'}
                      </Typography>
                    </Box>
                  </Box>
                  <Stack spacing={0.4} mt={1}>
                    {dist.map(d => (
                      <Stack key={d.name} direction="row" justifyContent="space-between" alignItems="center"
                        onMouseEnter={() => setActiveSlice(d.name)} onMouseLeave={() => setActiveSlice(null)}
                        onClick={() => navigate('/attacks')}
                        sx={{ px: 1, py: 0.5, borderRadius: 1.5, cursor: 'pointer',
                          background: activeSlice === d.name ? alpha(d.color, 0.12) : 'transparent',
                          transition: 'background .15s' }}>
                        <Stack direction="row" spacing={0.8} alignItems="center">
                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: d.color }} />
                          <Typography variant="body2" fontWeight={600}>{d.name}</Typography>
                        </Stack>
                        <Typography variant="body2" color="text.secondary" fontFamily="'JetBrains Mono', monospace">
                          {d.value} · {((d.value / distTotal) * 100).toFixed(0)}%
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                </>}
          </Panel>
        </Grid>

        <Grid item xs={12} lg={7}>
          <Panel accent={WARN} title="Blockchain Overhead"
            subtitle="A block is sealed only when an attack is detected, so overhead tracks incidents rather than time.">
            <LiveChart data={series} height={220} rightAxis
              series={[
                { key: 'overhead', label: 'Overhead %', color: WARN, type: 'line' },
                { key: 'malicious', label: 'Active threats', color: DANGER, type: 'bar', axis: 'right' },
              ]} />
          </Panel>
        </Grid>

        <Grid item xs={12} lg={5}>
          <Panel accent={NEON} title="Energy & Latency">
            <LiveChart data={series} height={220}
              series={[
                { key: 'energy', label: 'Energy %', color: ACCENT2, type: 'area' },
                { key: 'delay', label: 'Delay ms', color: NEON, type: 'line' },
              ]} />
          </Panel>
        </Grid>

        <Grid item xs={12}>
          <Panel accent={ACCENT} title="Zone Health"
            subtitle="Per area: in service · quarantined · under attack. A zone is marked recovered once nothing in it is attacking or quarantined.">
            {zoneHealth.length === 0
              ? <Typography variant="body2" color="text.secondary">No zones yet — reset the network to seed one.</Typography>
              : <Grid container spacing={2}>
                  {zoneHealth.map(z => (
                    <Grid item xs={12} sm={6} md={4} lg={3} key={z.label}>
                      <Box sx={{ p: 1.8, borderRadius: 2.5, height: '100%',
                        border: `1px solid ${alpha(z.malicious ? DANGER : z.recovered ? ACCENT2 : z.color, 0.3)}`,
                        background: alpha(z.malicious ? DANGER : z.recovered ? ACCENT2 : z.color, 0.06) }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                          <Typography variant="body2" fontWeight={800} sx={{ color: z.color }}>{z.label}</Typography>
                          <Typography variant="caption" color="text.secondary">{z.total} nodes</Typography>
                        </Stack>
                        <Box sx={{ display: 'flex', height: 8, borderRadius: 999, overflow: 'hidden',
                          bgcolor: alpha(z.color, 0.12) }}>
                          <Box sx={{ width: `${((z.active - z.malicious) / z.total) * 100}%`, background: ACCENT2 }} />
                          <Box sx={{ width: `${(z.malicious / z.total) * 100}%`, background: DANGER }} />
                          <Box sx={{ width: `${(z.healing / z.total) * 100}%`, background: ACCENT }} />
                          <Box sx={{ width: `${((z.isolated - z.healing) / z.total) * 100}%`, background: WARN }} />
                        </Box>
                        <Stack direction="row" spacing={1.5} mt={1.2} flexWrap="wrap" useFlexGap>
                          <Typography variant="caption" color="text.secondary">{z.active} in service</Typography>
                          {z.malicious > 0 && <Typography variant="caption" sx={{ color: DANGER, fontWeight: 700 }}>{z.malicious} under attack</Typography>}
                          {z.healing > 0 && <Typography variant="caption" sx={{ color: ACCENT, fontWeight: 700 }}>{z.healing} recovering</Typography>}
                          {z.isolated - z.healing > 0 && <Typography variant="caption" sx={{ color: WARN }}>{z.isolated - z.healing} quarantined</Typography>}
                          {z.recovered && (
                            <Typography variant="caption" fontWeight={800} sx={{ color: ACCENT2,
                              animation: `${popIn} .4s ease` }}>✓ area recovered</Typography>
                          )}
                        </Stack>
                      </Box>
                    </Grid>
                  ))}
                </Grid>}
          </Panel>
        </Grid>
      </Grid>
    </Box>
  );
}

function MapLegend() {
  const items = [
    { c: ACCENT2, l: 'Trusted' },
    { c: WARN, l: 'Suspect' },
    { c: DANGER, l: 'Attacking' },
    { c: ACCENT, l: 'Recovering' },
  ];
  return (
    <Stack direction="row" spacing={1.4} flexWrap="wrap" useFlexGap>
      {items.map(i => (
        <Stack key={i.l} direction="row" spacing={0.5} alignItems="center">
          <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: i.c }} />
          <Typography variant="caption" color="text.secondary" fontSize={10.5}>{i.l}</Typography>
        </Stack>
      ))}
    </Stack>
  );
}

function Mini({ label, value }) {
  return (
    <Box textAlign="center">
      <Typography variant="caption" color="text.secondary" fontSize={9.5} fontWeight={700}
        textTransform="uppercase" letterSpacing={0.5} display="block">{label}</Typography>
      <Typography sx={{ fontFamily: '"JetBrains Mono", monospace', fontWeight: 700, fontSize: 15, mt: 0.2 }}>{value}</Typography>
    </Box>
  );
}

