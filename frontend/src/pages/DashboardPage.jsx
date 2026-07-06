import React, { useMemo } from 'react';
import { Box, Grid, Typography, Stack, Chip, useTheme, alpha, Divider } from '@mui/material';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ComposedChart, Bar, Line,
} from 'recharts';
import SensorsIcon      from '@mui/icons-material/Sensors';
import GppMaybeIcon     from '@mui/icons-material/GppMaybe';
import BlockIcon        from '@mui/icons-material/Block';
import ShieldMoonIcon   from '@mui/icons-material/ShieldMoon';
import LinkIcon         from '@mui/icons-material/Link';
import BoltIcon         from '@mui/icons-material/Bolt';
import { useSim } from '../sim/SimContext';
import { ACCENT, ACCENT2, NEON, DANGER, WARN } from '../context/ThemeContext';
import {
  PageHeader, Panel, StatCard, Gauge, LiveDot, LegendDot, useChartTip, ATTACK_COLORS, popIn,
} from '../utils/ui';

export default function DashboardPage() {
  const theme = useTheme();
  const grid = theme.palette.divider;
  const axis = theme.palette.text.secondary;
  const tip = useChartTip();
  const sim = useSim();
  const s = sim.stats;
  const series = sim.metricsHist;

  const pdr = Number((s.pdr ?? 0).toFixed(1));
  const health = pdr >= 85 ? ACCENT2 : pdr >= 60 ? WARN : DANGER;
  const latest = series[series.length - 1] || {};

  const dist = useMemo(() => {
    const counts = {};
    sim.attacks.forEach(a => { counts[a.attack_type] = (counts[a.attack_type] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value, color: ATTACK_COLORS[name] || NEON }))
      .sort((a, b) => b.value - a.value);
  }, [sim.attacks]);
  const distTotal = dist.reduce((a, b) => a + b.value, 0) || 1;

  return (
    <Box>
      <PageHeader icon={<SensorsIcon />} title="Security Analytics"
        subtitle="Live overview of the industrial WSN — trust, detections & on-chain events"
        action={
          <Stack direction="row" spacing={1} alignItems="center">
            <LiveDot color={health} />
            <Chip label={`${s.maliciousActive} active threats`} size="small"
              sx={{ fontWeight: 700, bgcolor: alpha(DANGER, 0.14), color: DANGER, border: `1px solid ${alpha(DANGER, 0.3)}` }} />
          </Stack>
        } />

      {/* KPI ROW */}
      <Grid container spacing={2.5} mb={2.5}>
        <Grid item xs={6} md={3}><StatCard icon={<SensorsIcon />} label="Total Nodes" value={s.totalNodes} color={ACCENT} sub={`${s.activeNodes} active`} spark={series.map(d => d.pdr)} /></Grid>
        <Grid item xs={6} md={3}><StatCard icon={<BlockIcon />} label="Isolated" value={s.isolatedNodes} color={DANGER} sub="quarantined" /></Grid>
        <Grid item xs={6} md={3}><StatCard icon={<GppMaybeIcon />} label="Detections" value={s.detections} color={WARN} sub="recorded on-chain" spark={series.map(d => d.overhead)} /></Grid>
        <Grid item xs={6} md={3}><StatCard icon={<LinkIcon />} label="Chain Height" value={s.blockHeight} color={NEON} sub={sim.chainValid ? 'chain verified' : 'integrity broken'} /></Grid>
      </Grid>

      {/* HERO: health gauge + live feed */}
      <Grid container spacing={2.5} mb={2.5}>
        <Grid item xs={12} md={4}>
          <Panel title="Network Health" accent={health} sx={{ display: 'flex', flexDirection: 'column' }}>
            <Stack alignItems="center" py={1}>
              <Gauge value={pdr} color={health} label="PACKET DELIVERY" size={172} />
            </Stack>
            <Divider sx={{ borderColor: grid, my: 1.5 }} />
            <Stack direction="row" justifyContent="space-around">
              <Mini label="Delay" value={`${(latest.delay ?? 0).toFixed(1)} ms`} />
              <Mini label="Throughput" value={`${(latest.throughput ?? 0).toFixed(0)}`} />
              <Mini label="Overhead" value={`${(latest.overhead ?? 0).toFixed(1)}%`} />
            </Stack>
          </Panel>
        </Grid>

        <Grid item xs={12} md={8}>
          <Panel accent={ACCENT}
            title={<Stack direction="row" spacing={1} alignItems="center"><Typography variant="subtitle1" fontWeight={800}>Recent Detections</Typography><LiveDot color={ACCENT2} /></Stack>}
            action={<Chip size="small" label="event-driven" variant="outlined" sx={{ height: 22, borderColor: alpha(ACCENT, 0.35), color: ACCENT }} />}>
            <Stack divider={<Divider sx={{ borderColor: grid }} />} sx={{ maxHeight: 262, overflowY: 'auto', pr: 0.5 }}>
              {sim.attacks.slice(0, 8).map((a, i) => (
                <Stack key={a.id} direction="row" alignItems="center" spacing={1.6} py={1.1}
                  sx={{ animation: i === 0 ? `${popIn} .4s ease` : 'none' }}>
                  <Box sx={{ width: 36, height: 36, borderRadius: 2, flexShrink: 0,
                    background: alpha(ATTACK_COLORS[a.attack_type] || NEON, 0.14),
                    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <GppMaybeIcon sx={{ fontSize: 19, color: ATTACK_COLORS[a.attack_type] || NEON }} />
                  </Box>
                  <Box flex={1} minWidth={0}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="body2" fontWeight={700} fontFamily="'JetBrains Mono', monospace">{a.node_uid}</Typography>
                      <Typography variant="body2" fontWeight={600} sx={{ color: ATTACK_COLORS[a.attack_type] || NEON }}>{a.attack_type}</Typography>
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(a.timestamp).toLocaleTimeString()} · confidence {(a.confidence * 100).toFixed(0)}% · #{a.block_index}
                    </Typography>
                  </Box>
                  <Chip size="small" label={a.status} sx={{ height: 22, fontWeight: 600, flexShrink: 0,
                    bgcolor: alpha(a.status === 'Isolated' ? DANGER : WARN, 0.14), color: a.status === 'Isolated' ? DANGER : WARN }} />
                </Stack>
              ))}
              {sim.attacks.length === 0 && (
                <Stack alignItems="center" py={5} spacing={1}>
                  <ShieldMoonIcon sx={{ fontSize: 40, color: ACCENT2 }} />
                  <Typography variant="body2" color="text.secondary" textAlign="center">
                    Network is clean. Inject an attack from the Attack Lab (or enable Auto-attack) to see detections stream in live.
                  </Typography>
                </Stack>
              )}
            </Stack>
          </Panel>
        </Grid>
      </Grid>

      {/* CHARTS */}
      <Grid container spacing={2.5}>
        <Grid item xs={12} lg={8}>
          <Panel title="Network Performance"
            action={<Stack direction="row" spacing={2}><LegendDot color={ACCENT} label="PDR %" /><LegendDot color={ACCENT2} label="Throughput" /></Stack>}>
            <Box height={280}>
              <ResponsiveContainer>
                <AreaChart data={series} margin={{ left: -12, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="gPdr" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={ACCENT} stopOpacity={0.35} /><stop offset="100%" stopColor={ACCENT} stopOpacity={0} /></linearGradient>
                    <linearGradient id="gThr" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={ACCENT2} stopOpacity={0.3} /><stop offset="100%" stopColor={ACCENT2} stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
                  <XAxis dataKey="time" stroke={axis} fontSize={10} tickLine={false} axisLine={{ stroke: grid }} minTickGap={28} />
                  <YAxis stroke={axis} fontSize={11} tickLine={false} axisLine={false} />
                  <RTooltip contentStyle={tip} />
                  <Area type="monotone" dataKey="pdr" stroke={ACCENT} strokeWidth={2.5} fill="url(#gPdr)" name="PDR %" isAnimationActive={false} />
                  <Area type="monotone" dataKey="throughput" stroke={ACCENT2} strokeWidth={2.5} fill="url(#gThr)" name="Throughput" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </Box>
          </Panel>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Panel title="Attack Distribution" sx={{ height: '100%' }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: 280 }}>
              {dist.length === 0
                ? <Typography variant="body2" color="text.secondary" textAlign="center">No attacks recorded yet.</Typography>
                : <Stack spacing={2.2}>
                    {dist.map(d => {
                      const pct = (d.value / distTotal) * 100;
                      return (
                        <Box key={d.name}>
                          <Stack direction="row" justifyContent="space-between" mb={0.6}>
                            <Typography variant="body2" fontWeight={600}>{d.name}</Typography>
                            <Typography variant="body2" color="text.secondary" fontFamily="'JetBrains Mono', monospace">{d.value} · {pct.toFixed(0)}%</Typography>
                          </Stack>
                          <Box sx={{ height: 8, borderRadius: 999, background: alpha(d.color, 0.12), overflow: 'hidden' }}>
                            <Box sx={{ height: '100%', width: `${pct}%`, background: d.color, boxShadow: `0 0 10px ${alpha(d.color, 0.8)}`, transition: 'width .5s' }} />
                          </Box>
                        </Box>
                      );
                    })}
                  </Stack>}
            </Box>
          </Panel>
        </Grid>

        <Grid item xs={12} lg={7}>
          <Panel title="Blockchain Overhead"
            action={<Stack direction="row" spacing={0.6} alignItems="center"><BoltIcon sx={{ fontSize: 15, color: WARN }} /><Typography variant="caption" color="text.secondary">rises only on detection</Typography></Stack>}>
            <Box height={230}>
              <ResponsiveContainer>
                <ComposedChart data={series} margin={{ left: -12, right: 8, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
                  <XAxis dataKey="time" stroke={axis} fontSize={10} tickLine={false} axisLine={{ stroke: grid }} minTickGap={28} />
                  <YAxis stroke={axis} fontSize={11} tickLine={false} axisLine={false} />
                  <RTooltip contentStyle={tip} />
                  <Bar dataKey="malicious" barSize={14} fill={alpha(DANGER, 0.5)} radius={[3, 3, 0, 0]} name="Active Malicious" isAnimationActive={false} />
                  <Line type="monotone" dataKey="overhead" stroke={WARN} strokeWidth={2.5} dot={false} name="Overhead %" isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </Box>
          </Panel>
        </Grid>

        <Grid item xs={12} lg={5}>
          <Panel title="Energy & Latency"
            action={<Stack direction="row" spacing={2}><LegendDot color={NEON} label="Energy %" /><LegendDot color={WARN} label="Delay ms" /></Stack>}>
            <Box height={230}>
              <ResponsiveContainer>
                <AreaChart data={series} margin={{ left: -12, right: 8, top: 8 }}>
                  <defs><linearGradient id="gEn" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={NEON} stopOpacity={0.3} /><stop offset="100%" stopColor={NEON} stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
                  <XAxis dataKey="time" stroke={axis} fontSize={10} tickLine={false} axisLine={{ stroke: grid }} minTickGap={28} />
                  <YAxis stroke={axis} fontSize={11} tickLine={false} axisLine={false} />
                  <RTooltip contentStyle={tip} />
                  <Area type="monotone" dataKey="energy" stroke={NEON} strokeWidth={2} fill="url(#gEn)" name="Energy %" isAnimationActive={false} />
                  <Line type="monotone" dataKey="delay" stroke={WARN} strokeWidth={2} dot={false} name="Delay ms" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </Box>
          </Panel>
        </Grid>
      </Grid>
    </Box>
  );
}

function Mini({ label, value }) {
  return (
    <Box textAlign="center">
      <Typography variant="caption" color="text.secondary" fontSize={9.5} fontWeight={700} textTransform="uppercase" letterSpacing={0.5} display="block">{label}</Typography>
      <Typography sx={{ fontFamily: '"JetBrains Mono", monospace', fontWeight: 700, fontSize: 15, mt: 0.2 }}>{value}</Typography>
    </Box>
  );
}
