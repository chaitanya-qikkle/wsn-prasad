import React, { useMemo } from 'react';
import { Box, Grid, Typography, Stack, Chip, alpha, useTheme } from '@mui/material';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell,
  Tooltip as RTooltip, LabelList,
} from 'recharts';
import InsightsIcon    from '@mui/icons-material/Insights';
import SpeedIcon       from '@mui/icons-material/Speed';
import TimerIcon       from '@mui/icons-material/Timer';
import BoltIcon        from '@mui/icons-material/Bolt';
import BatteryChargingFullIcon from '@mui/icons-material/BatteryChargingFull';
import { useSim } from '../sim/SimContext';
import {
  PageHeader, MetricStrip, Panel, LiveDot, useChartTip, formatDuration, TimeStat,
} from '../utils/ui';
import { ACCENT, ACCENT2, NEON, WARN, DANGER, GOLD } from '../context/ThemeContext';
import LiveChart from '../components/LiveChart';
import { RecoveryTimings, SystemComparison } from '../components/RecoveryPanels';

export default function MetricsPage() {
  const theme = useTheme();
  const grid = theme.palette.divider;
  const axis = theme.palette.text.secondary;
  const tt = useChartTip();
  const sim = useSim();
  const series = sim.metricsHist;
  const s = sim.stats;
  const first = series[0] || {};
  const sum = sim.recoverySummary || {};
  const phases = sim.phaseSnapshots || {};

  // PDR at the three moments of the last incident — the single clearest
  // "did the framework actually help?" chart in the whole console.
  const phaseBars = useMemo(() => ([
    { stage: 'Before attack', pdr: phases.before?.pdr, color: ACCENT2 },
    { stage: 'Under attack', pdr: phases.during?.pdr, color: DANGER },   // lowest reached during the incident
    { stage: 'After recovery', pdr: phases.after?.pdr, color: ACCENT },
  ].filter(d => d.pdr != null)), [phases]);

  // Per-attack-type mean recovery time, from the measured episodes.
  const byAttack = useMemo(() => {
    const acc = {};
    (sim.attackTimeline || []).forEach(e => {
      if (e.total_sec == null) return;
      (acc[e.attack_type] ??= []).push(e.total_sec);
    });
    return Object.entries(acc)
      .map(([name, vals]) => ({ name, sec: +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1), n: vals.length }))
      .sort((a, b) => b.sec - a.sec);
  }, [sim.attackTimeline]);

  return (
    <Box>
      <PageHeader icon={<InsightsIcon />} title="Performance Evaluation" accent={ACCENT}
        subtitle="PDR, delay, throughput, energy and recovery time — measured live as the framework isolates and heals nodes"
        action={<Stack direction="row" spacing={1} alignItems="center">
          <LiveDot color={ACCENT2} />
          <Typography variant="caption" fontWeight={800} color={ACCENT2} letterSpacing={1}>LIVE</Typography>
        </Stack>} />

      <Box mb={2.5}>
        <MetricStrip items={[
          { icon: <InsightsIcon />, label: 'Packet Delivery', value: `${Math.round(s.pdr ?? 0)}%`,
            sub: `from ${Math.round(first.pdr ?? 0)}%`, color: ACCENT2 },
          { icon: <TimerIcon />, label: 'Avg Delay', value: `${(s.delay ?? 0).toFixed(1)}ms`, color: NEON },
          { icon: <SpeedIcon />, label: 'Throughput', value: `${(s.throughput ?? 0).toFixed(0)}kbps`, color: ACCENT },
          { icon: <BoltIcon />, label: 'Control Overhead', value: `${(s.overhead ?? 0).toFixed(1)}%`,
            sub: 'event-driven', color: WARN },
          { icon: <BatteryChargingFullIcon />, label: 'Avg Recovery', value: formatDuration(sum.avgTotalSec),
            sub: `${sum.recovered || 0} incidents`, color: GOLD },
        ]} />
      </Box>

      <Grid container spacing={2.5}>
        {/* ── the headline result ── */}
        <Grid item xs={12} lg={5}>
          <Panel accent={ACCENT2} title="Packet Delivery — Before vs After the Attack" sx={{ height: '100%' }}
            subtitle="Captured automatically at each stage of the last incident.">
            {phaseBars.length === 0 ? (
              <Typography variant="body2" color="text.secondary" py={6} textAlign="center">
                No incident recorded yet — inject an attack and this fills in on its own.
              </Typography>
            ) : (
              <>
                <Box height={236}>
                  <ResponsiveContainer>
                    <BarChart data={phaseBars} margin={{ left: -14, right: 8, top: 18 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
                      <XAxis dataKey="stage" stroke={axis} fontSize={11} tickLine={false} axisLine={{ stroke: grid }} />
                      <YAxis domain={[0, 100]} stroke={axis} fontSize={11} tickLine={false} axisLine={false} />
                      <RTooltip contentStyle={tt} cursor={{ fill: alpha(theme.palette.text.primary, 0.05) }}
                        formatter={(v) => [`${v}%`, 'PDR']} />
                      <Bar dataKey="pdr" radius={[6, 6, 0, 0]} barSize={54} isAnimationActive={false}>
                        {phaseBars.map(d => <Cell key={d.stage} fill={d.color} />)}
                        <LabelList dataKey="pdr" position="top" formatter={(v) => `${Math.round(v)}%`}
                          fill={theme.palette.text.primary} fontSize={12} fontWeight={800} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
                {phases.before && phases.after && (
                  <Typography variant="caption" color="text.secondary" display="block" mt={1} lineHeight={1.55}>
                    Delivery fell to <b>{Math.round(phases.during?.pdr ?? 0)}%</b> at the worst point and returned
                    to <b>{Math.round(phases.after.pdr)}%</b> — recovered automatically, no operator action.
                  </Typography>
                )}
              </>
            )}
          </Panel>
        </Grid>

        <Grid item xs={12} lg={7}>
          <Panel accent={ACCENT} title="Packet Delivery Ratio Over Time" sx={{ height: '100%' }}
            subtitle="Shaded windows mark the periods the network was under attack.">
            <LiveChart data={series} height={252} yDomain={[0, 100]} brush
              series={[{ key: 'pdr', label: 'PDR %', color: ACCENT2, type: 'area' }]}
              footnote="PDR is a rolling window over the last few rounds, not an all-time average — a long demo would otherwise dilute every new attack into invisibility." />
          </Panel>
        </Grid>

        {/* ── recovery timings ── */}
        <Grid item xs={12} lg={5}><RecoveryTimings sim={sim} /></Grid>
        <Grid item xs={12} lg={7}><SystemComparison sim={sim} /></Grid>

        <Grid item xs={12} md={6}>
          <Panel accent={GOLD} title="Recovery Time by Attack Type"
            subtitle="Mean end-to-end time from injection to the node being back in service.">
            {byAttack.length === 0 ? (
              <Typography variant="body2" color="text.secondary" py={5} textAlign="center">
                No incident has completed a full recovery cycle yet.
              </Typography>
            ) : (
              <Box height={232}>
                <ResponsiveContainer>
                  <BarChart data={byAttack} layout="vertical" margin={{ left: 12, right: 40, top: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={grid} horizontal={false} />
                    <XAxis type="number" stroke={axis} fontSize={11} tickLine={false} axisLine={false}
                      tickFormatter={(v) => `${v}s`} />
                    <YAxis type="category" dataKey="name" stroke={axis} fontSize={11} width={78}
                      tickLine={false} axisLine={false} />
                    <RTooltip contentStyle={tt} cursor={{ fill: alpha(theme.palette.text.primary, 0.05) }}
                      formatter={(v, _n, p) => [`${formatDuration(v)} (${p.payload.n} incident${p.payload.n > 1 ? 's' : ''})`, 'Avg recovery']} />
                    <Bar dataKey="sec" radius={[0, 6, 6, 0]} barSize={22} isAnimationActive={false}>
                      {byAttack.map(d => <Cell key={d.name} fill={ATTACK_FILL[d.name] || NEON} />)}
                      <LabelList dataKey="sec" position="right" formatter={(v) => formatDuration(v)}
                        fill={theme.palette.text.secondary} fontSize={11} fontWeight={700} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            )}
          </Panel>
        </Grid>

        <Grid item xs={12} md={6}>
          <Panel accent={NEON} title="End-to-End Delay & Throughput">
            <LiveChart data={series} height={232} rightAxis
              series={[
                { key: 'delay', label: 'Delay ms', color: NEON, type: 'line' },
                { key: 'throughput', label: 'Throughput', color: ACCENT, type: 'area', axis: 'right' },
              ]} />
          </Panel>
        </Grid>

        <Grid item xs={12} md={6}>
          <Panel accent={WARN} title="Energy vs Control Overhead">
            <LiveChart data={series} height={232}
              series={[
                { key: 'energy', label: 'Avg energy %', color: ACCENT2, type: 'area' },
                { key: 'overhead', label: 'Overhead %', color: WARN, type: 'line' },
              ]}
              footnote="Energy depletes slowly; overhead stays flat because the blockchain seals a block only on a detection event, not on a timer." />
          </Panel>
        </Grid>

        <Grid item xs={12} md={6}>
          <Panel accent={DANGER} title="Threats vs Nodes Recovering">
            <LiveChart data={series} height={232} shadeAttacks={false}
              series={[
                { key: 'malicious', label: 'Active threats', color: DANGER, type: 'bar', barSize: 10 },
                { key: 'recovering', label: 'Recovering', color: ACCENT, type: 'bar', barSize: 10 },
                { key: 'isolated', label: 'Out of service', color: WARN, type: 'line', dashed: true },
              ]}
              footnote="Threats spike, then convert into nodes that are recovering rather than nodes that stay lost — that conversion is the whole point of the framework." />
          </Panel>
        </Grid>

        <Grid item xs={12}>
          <Panel accent={ACCENT2} title="Recovery Scoreboard"
            subtitle="Everything the framework has resolved this session, measured rather than claimed.">
            <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
              <TimeStat label="Incidents" value={sum.totalEpisodes || 0} color={ACCENT} hint="attacks recorded" />
              <TimeStat label="Resolved" value={sum.recovered || 0} color={ACCENT2} hint="back in service" />
              <TimeStat label="Unresolved" value={sum.unresolved || 0} color={sum.unresolved ? DANGER : ACCENT2}
                hint="still compromised" />
              <TimeStat label="Automatic" value={sum.autoRecoveries || 0} color={ACCENT2} hint="no operator action" />
              <TimeStat label="Manual" value={sum.manualRecoveries || 0} color={WARN} hint="operator stepped in" />
              <TimeStat label="Fastest" value={formatDuration(sum.bestTotalSec)} color={ACCENT} hint="best case" />
              <TimeStat label="Slowest" value={formatDuration(sum.worstTotalSec)} color={NEON} hint="worst case" />
            </Stack>
            {sum.unresolved > 0 && (
              <Chip size="small" sx={{ mt: 2, fontWeight: 700, bgcolor: alpha(DANGER, 0.14), color: DANGER }}
                label={`${sum.unresolved} incident(s) open for ${formatDuration(sum.openSec)} — recovery is disabled in baseline mode`} />
            )}
          </Panel>
        </Grid>
      </Grid>
    </Box>
  );
}

const ATTACK_FILL = {
  Blackhole: '#f43f5e', Sybil: '#8b5cf6', Wormhole: '#d97706', Grayhole: '#0ea5e9',
  'Manual Isolation': '#64748b',
};
