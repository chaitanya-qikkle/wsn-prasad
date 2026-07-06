import React from 'react';
import { Box, Grid, Typography, Stack, useTheme } from '@mui/material';
import InsightsIcon from '@mui/icons-material/Insights';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
} from 'recharts';
import { useSim } from '../sim/SimContext';
import { PageHeader, MetricStrip, Panel, LiveDot, useChartTip } from '../utils/ui';
import { ACCENT, ACCENT2, NEON, WARN } from '../context/ThemeContext';

export default function MetricsPage() {
  const theme = useTheme();
  const grid = theme.palette.divider;
  const axis = theme.palette.text.secondary;
  const tt = useChartTip();
  const sim = useSim();
  const series = sim.metricsHist;
  const last = series[series.length - 1] || {};
  const first = series[0] || {};

  return (
    <Box>
      <PageHeader icon={<InsightsIcon />} title="Performance Evaluation" accent={ACCENT}
        subtitle="PDR, delay, throughput and energy — measured as the framework isolates malicious nodes"
        action={<Stack direction="row" spacing={1} alignItems="center"><LiveDot color={ACCENT2} /><Typography variant="caption" fontWeight={800} color={ACCENT2} letterSpacing={1}>LIVE</Typography></Stack>} />

      <Box mb={3}>
        <MetricStrip items={[
          { icon: <InsightsIcon />, label: 'Packet Delivery', value: `${(last.pdr ?? 0).toFixed(1)}%`, sub: `from ${(first.pdr ?? 0).toFixed(1)}%`, color: ACCENT2 },
          { icon: <InsightsIcon />, label: 'Avg Delay', value: `${(last.delay ?? 0).toFixed(1)}ms`, color: NEON },
          { icon: <InsightsIcon />, label: 'Throughput', value: `${(last.throughput ?? 0).toFixed(0)}kbps`, color: ACCENT },
          { icon: <InsightsIcon />, label: 'Control Overhead', value: `${(last.overhead ?? 0).toFixed(1)}%`, sub: 'event-driven', color: WARN },
        ]} />
      </Box>

      <Grid container spacing={2.5}>
        <Grid item xs={12} md={6}>
          <Panel title="Packet Delivery Ratio (PDR)" accent={ACCENT2}>
            <Box height={260}>
              <ResponsiveContainer>
                <AreaChart data={series}>
                  <defs><linearGradient id="mPdr" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={ACCENT2} stopOpacity={0.4} /><stop offset="100%" stopColor={ACCENT2} stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
                  <XAxis dataKey="time" stroke={axis} fontSize={10} minTickGap={30} />
                  <YAxis domain={[0, 100]} stroke={axis} fontSize={11} />
                  <RTooltip contentStyle={tt} />
                  <Area type="monotone" dataKey="pdr" stroke={ACCENT2} strokeWidth={2} fill="url(#mPdr)" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </Box>
          </Panel>
        </Grid>
        <Grid item xs={12} md={6}>
          <Panel title="End-to-End Delay" accent={NEON}>
            <Box height={260}>
              <ResponsiveContainer>
                <LineChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
                  <XAxis dataKey="time" stroke={axis} fontSize={10} minTickGap={30} />
                  <YAxis stroke={axis} fontSize={11} />
                  <RTooltip contentStyle={tt} />
                  <Line type="monotone" dataKey="delay" stroke={NEON} strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </Box>
          </Panel>
        </Grid>
        <Grid item xs={12} md={6}>
          <Panel title="Throughput" accent={ACCENT}>
            <Box height={260}>
              <ResponsiveContainer>
                <BarChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
                  <XAxis dataKey="time" stroke={axis} fontSize={10} minTickGap={30} />
                  <YAxis stroke={axis} fontSize={11} />
                  <RTooltip contentStyle={tt} cursor={{ fill: theme.palette.action.hover }} />
                  <Bar dataKey="throughput" fill={ACCENT} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Panel>
        </Grid>
        <Grid item xs={12} md={6}>
          <Panel title="Avg Energy vs Control Overhead" accent={WARN}>
            <Box height={260}>
              <ResponsiveContainer>
                <LineChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
                  <XAxis dataKey="time" stroke={axis} fontSize={10} minTickGap={30} />
                  <YAxis stroke={axis} fontSize={11} />
                  <RTooltip contentStyle={tt} />
                  <Line type="monotone" dataKey="energy" stroke={ACCENT} strokeWidth={2} dot={false} name="Energy %" isAnimationActive={false} />
                  <Line type="monotone" dataKey="overhead" stroke={WARN} strokeWidth={2} dot={false} name="Overhead %" isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </Box>
            <Typography variant="caption" color="text.secondary" mt={1} display="block">
              Energy depletes slowly; overhead stays low because the blockchain runs only on detection events.
            </Typography>
          </Panel>
        </Grid>
      </Grid>
    </Box>
  );
}
