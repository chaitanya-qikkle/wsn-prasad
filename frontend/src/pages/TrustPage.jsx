import React from 'react';
import { Box, Grid, Typography, Stack, useTheme, Chip, alpha, Divider } from '@mui/material';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import ShieldMoonIcon   from '@mui/icons-material/ShieldMoon';
import BlockIcon        from '@mui/icons-material/Block';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ReferenceLine,
} from 'recharts';
import { useSim } from '../sim/SimContext';
import { PageHeader, Panel, StatCard, ProgressRow, LiveDot, useChartTip, trustColor } from '../utils/ui';
import { ACCENT, ACCENT2, NEON, DANGER, WARN } from '../context/ThemeContext';
import { TRUST_THRESHOLD } from '../sim/constants';

const SERIES_COLORS = [DANGER, WARN, ACCENT, NEON, ACCENT2, '#ffd54a', '#f472b6'];

export default function TrustPage() {
  const theme = useTheme();
  const grid = theme.palette.divider;
  const tip = useChartTip();
  const sim = useSim();

  const allNodes = sim.nodes.filter(n => n.role !== 'Sink');
  const series = sim.trustHist;
  const ranked = [...allNodes].sort((a, b) => a.trust_score - b.trust_score);
  // chart the 7 lowest-trust nodes (most interesting), keeping it legible
  const chartNodes = ranked.slice(0, 7).map(n => n.node_uid);

  const s = sim.stats;
  const avgTrust = s.avgTrust || 0;

  return (
    <Box>
      <PageHeader icon={<VerifiedUserIcon />} title="Trust Engine"
        subtitle="Behaviour-based trust — packet forwarding, delay and identity anomalies scored live"
        action={
          <Stack direction="row" spacing={1} alignItems="center">
            <LiveDot color={s.belowThreshold ? DANGER : ACCENT2} />
            <Chip size="small" label={`${s.belowThreshold} below threshold`}
              sx={{ fontWeight: 700, bgcolor: alpha(DANGER, 0.12), color: DANGER, border: `1px solid ${alpha(DANGER, 0.3)}` }} />
          </Stack>
        } />

      <Grid container spacing={2.5} mb={2.5}>
        <Grid item xs={6} md={3}><StatCard icon={<ShieldMoonIcon />} label="Trusted Nodes" value={s.trusted} color={ACCENT2} sub="score ≥ 0.70" /></Grid>
        <Grid item xs={6} md={3}><StatCard icon={<TrendingDownIcon />} label="Suspect Nodes" value={s.suspect} color={WARN} sub="0.40 – 0.70" /></Grid>
        <Grid item xs={6} md={3}><StatCard icon={<BlockIcon />} label="Below Threshold" value={s.belowThreshold} color={DANGER} sub="isolated / rogue" /></Grid>
        <Grid item xs={6} md={3}><StatCard icon={<VerifiedUserIcon />} label="Avg Trust" value={avgTrust.toFixed(2)} color={ACCENT} sub={`across ${allNodes.length} nodes`} /></Grid>
      </Grid>

      <Grid container spacing={2.5}>
        <Grid item xs={12} lg={8}>
          <Panel title="Trust Score Evolution" accent={ACCENT}
            action={<Typography variant="caption" color="text.secondary">isolation threshold = {TRUST_THRESHOLD.toFixed(2)}</Typography>}>
            <Box height={340}>
              <ResponsiveContainer>
                <LineChart data={series} margin={{ left: -12, right: 12, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
                  <XAxis dataKey="time" stroke={theme.palette.text.secondary} fontSize={10} tickLine={false} axisLine={{ stroke: grid }} minTickGap={30} />
                  <YAxis domain={[0, 1]} stroke={theme.palette.text.secondary} fontSize={11} tickLine={false} axisLine={false} />
                  <RTooltip contentStyle={tip} />
                  <ReferenceLine y={TRUST_THRESHOLD} stroke={DANGER} strokeDasharray="6 4"
                    label={{ value: 'isolate', fill: DANGER, fontSize: 10, position: 'right' }} />
                  {chartNodes.map((n, i) => (
                    <Line key={n} type="monotone" dataKey={n} stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                      strokeWidth={2.2} dot={false} name={n} connectNulls isAnimationActive={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </Box>
            <Stack direction="row" spacing={2} flexWrap="wrap" mt={1.5}>
              {chartNodes.map((n, i) => (
                <Stack key={n} direction="row" spacing={0.6} alignItems="center">
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: SERIES_COLORS[i % SERIES_COLORS.length] }} />
                  <Typography variant="caption" color="text.secondary" fontFamily="'JetBrains Mono', monospace">{n}</Typography>
                </Stack>
              ))}
            </Stack>
          </Panel>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Panel title="Node Trust Ranking" accent={DANGER} action={<Typography variant="caption" color="text.secondary">lowest first</Typography>}>
            <Stack spacing={2} divider={<Divider sx={{ borderColor: grid }} />} sx={{ maxHeight: 380, overflowY: 'auto', pr: 0.5 }}>
              {ranked.map(n => (
                <ProgressRow key={n.node_uid} label={n.node_uid}
                  chip={n.is_isolated && <Chip size="small" label="isolated" sx={{ fontSize: 9, height: 17, bgcolor: alpha(DANGER, 0.14), color: DANGER, fontWeight: 700 }} />}
                  value={n.trust_score.toFixed(3)} pct={n.trust_score * 100} color={trustColor(n.trust_score)} />
              ))}
            </Stack>
          </Panel>
        </Grid>
      </Grid>
    </Box>
  );
}
