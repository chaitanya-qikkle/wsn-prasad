import React from 'react';
import { Box, Card, Typography, Stack, useTheme, alpha, LinearProgress, Grid, keyframes } from '@mui/material';
import BlockIcon        from '@mui/icons-material/Block';
import CallSplitIcon    from '@mui/icons-material/CallSplit';
import CycloneIcon      from '@mui/icons-material/Cyclone';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';

/*  Redesigned shared UI kit — "cyber ops" surfaces, live indicators,
 *  sparklines and stat cards used across every console page.                */

export const pulse = keyframes`0%,100%{opacity:1}50%{opacity:.25}`;
export const rise  = keyframes`from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}`;
export const popIn = keyframes`0%{transform:scale(.7);opacity:0}60%{transform:scale(1.06)}100%{transform:scale(1);opacity:1}`;
export const spin  = keyframes`from{transform:rotate(0deg)}to{transform:rotate(360deg)}`;

function cardShadow(theme) {
  return theme.palette.mode === 'dark'
    ? '0 10px 34px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.04)'
    : '0 6px 22px rgba(0,0,0,0.06)';
}

// A pulsing "live" status dot.
export function LiveDot({ color, size = 8 }) {
  const theme = useTheme();
  const c = color || theme.palette.success.main;
  return (
    <Box sx={{ width: size, height: size, borderRadius: '50%', bgcolor: c, flexShrink: 0,
      boxShadow: `0 0 0 3px ${alpha(c, 0.18)}, 0 0 10px ${c}`, animation: `${pulse} 1.5s ease infinite` }} />
  );
}

// Page header — icon chip, title, subtitle, optional action + live indicator.
export function PageHeader({ icon, title, subtitle, action, accent }) {
  const theme = useTheme();
  const c = accent || theme.palette.primary.main;
  return (
    <Box sx={{ display: 'flex', alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between',
      gap: 2, mb: 3, flexWrap: 'wrap' }}>
      <Stack direction="row" spacing={2} alignItems="center">
        <Box sx={{ width: 48, height: 48, borderRadius: 3, flexShrink: 0, color: c,
          background: `linear-gradient(135deg, ${alpha(c, 0.22)}, ${alpha(c, 0.06)})`,
          border: `1px solid ${alpha(c, 0.3)}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', '& svg': { fontSize: 24 } }}>
          {icon}
        </Box>
        <Box>
          <Typography variant="h5" fontWeight={800} sx={{ lineHeight: 1.1, letterSpacing: -0.4 }}>{title}</Typography>
          {subtitle && <Typography variant="body2" color="text.secondary" mt={0.4}>{subtitle}</Typography>}
        </Box>
      </Stack>
      {action}
    </Box>
  );
}

// Section / panel surface — gradient hairline header, glow-tinted top edge.
export function Panel({ title, action, children, sx, accent, dense }) {
  const theme = useTheme();
  const c = accent || theme.palette.primary.main;
  return (
    <Card sx={{ p: dense ? 2 : 2.5, height: '100%', position: 'relative', overflow: 'hidden',
      boxShadow: cardShadow(theme), ...sx }}>
      {accent && (
        <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2,
          background: `linear-gradient(90deg, ${alpha(c, 0)}, ${c}, ${alpha(c, 0)})` }} />
      )}
      {(title || action) && (
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={1}>
          {title && (typeof title === 'string'
            ? <Typography variant="subtitle1" fontWeight={800} letterSpacing={0.1}>{title}</Typography>
            : title)}
          {action}
        </Stack>
      )}
      {children}
    </Card>
  );
}

// KPI stat card — mono number, glowing icon chip, accent underline + sparkline.
export function StatCard({ icon, label, value, sub, color, spark }) {
  const theme = useTheme();
  const c = color || theme.palette.primary.main;
  return (
    <Card sx={{ p: 2.4, height: '100%', position: 'relative', overflow: 'hidden', boxShadow: cardShadow(theme),
      transition: 'transform .18s, border-color .18s',
      '&:hover': { transform: 'translateY(-2px)', borderColor: alpha(c, 0.4) } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
        <Box minWidth={0}>
          <Typography variant="caption" color="text.secondary" fontWeight={700} textTransform="uppercase"
            letterSpacing={0.6} fontSize={10.5} noWrap>{label}</Typography>
          <Typography sx={{ mt: 0.6, fontFamily: '"JetBrains Mono", monospace', fontWeight: 800, fontSize: 32, lineHeight: 1,
            color: theme.palette.text.primary }}>{value}</Typography>
          {sub && <Typography variant="caption" color="text.secondary" mt={0.8} display="block" noWrap>{sub}</Typography>}
        </Box>
        {icon && (
          <Box sx={{ width: 42, height: 42, borderRadius: 2.5, flexShrink: 0, color: c,
            background: `linear-gradient(135deg, ${alpha(c, 0.24)}, ${alpha(c, 0.06)})`,
            border: `1px solid ${alpha(c, 0.28)}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', '& svg': { fontSize: 22 } }}>{icon}</Box>
        )}
      </Stack>
      {spark && spark.length > 1 && (
        <Box sx={{ mt: 1.2, mx: -0.4 }}><Sparkline data={spark} color={c} height={26} /></Box>
      )}
      <Box sx={{ position: 'absolute', left: 0, bottom: 0, height: 3, width: '100%',
        background: `linear-gradient(90deg, ${c}, ${alpha(c, 0)})` }} />
    </Card>
  );
}

export function KpiItem({ xs = 6, md = 3, ...statProps }) {
  return <Grid item xs={xs} md={md}><StatCard {...statProps} /></Grid>;
}

// Lightweight inline SVG sparkline (no chart lib needed).
export function Sparkline({ data = [], color, height = 34, strokeWidth = 2 }) {
  const theme = useTheme();
  const c = color || theme.palette.primary.main;
  const id = React.useId();
  if (!data.length) return <Box sx={{ height }} />;
  const w = 100, h = height;
  const min = Math.min(...data), max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1 || 1)) * w, h - ((v - min) / span) * (h - 4) - 2]);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = `${line} L${w},${h} L0,${h} Z`;
  return (
    <Box sx={{ width: '100%', height }}>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" width="100%" height={h}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c} stopOpacity={0.32} />
            <stop offset="100%" stopColor={c} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${id})`} />
        <path d={line} fill="none" stroke={c} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
          vectorEffect="non-scaling-stroke" />
      </svg>
    </Box>
  );
}

// Metric strip — glass band split into equal cells.
export function MetricStrip({ items }) {
  const theme = useTheme();
  return (
    <Card sx={{ overflow: 'hidden', boxShadow: cardShadow(theme) }}>
      <Stack direction={{ xs: 'column', sm: 'row' }}
        divider={<Box sx={{ borderColor: theme.palette.divider, borderStyle: 'solid',
          borderWidth: { xs: '1px 0 0 0', sm: '0 0 0 1px' } }} />}>
        {items.map((it) => {
          const c = it.color || theme.palette.text.primary;
          return (
            <Box key={it.label} sx={{ flex: 1, px: 2.5, py: 2, display: 'flex', alignItems: 'center', gap: 1.6 }}>
              {it.icon && (
                <Box sx={{ width: 38, height: 38, borderRadius: 2.5, flexShrink: 0, color: c,
                  background: alpha(c, 0.14), display: 'flex', alignItems: 'center', justifyContent: 'center', '& svg': { fontSize: 20 } }}>
                  {it.icon}
                </Box>
              )}
              <Box minWidth={0}>
                <Typography variant="caption" color="text.secondary" textTransform="uppercase"
                  letterSpacing={0.6} fontSize={10} fontWeight={700} noWrap display="block">{it.label}</Typography>
                <Stack direction="row" spacing={0.8} alignItems="baseline">
                  <Typography fontWeight={800} fontSize={22} sx={{ color: c, lineHeight: 1.1, fontFamily: '"JetBrains Mono", monospace' }}>
                    {it.value}
                  </Typography>
                  {it.sub && <Typography variant="caption" color="text.secondary">{it.sub}</Typography>}
                </Stack>
              </Box>
            </Box>
          );
        })}
      </Stack>
    </Card>
  );
}

// Radial gauge — signature chart.
export function Gauge({ value, max = 100, size = 150, color, label, unit = '%', thickness = 10 }) {
  const theme = useTheme();
  const c = color || theme.palette.primary.main;
  const pct = Math.max(0, Math.min(1, value / max));
  const r = (size - thickness * 2) / 2;
  const circ = 2 * Math.PI * r;
  const id = React.useId();
  return (
    <Box sx={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={c} />
            <stop offset="100%" stopColor={theme.palette.secondary.main} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={alpha(theme.palette.text.primary, 0.07)} strokeWidth={thickness} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#${id})`} strokeWidth={thickness}
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dashoffset 0.8s ease',
            filter: `drop-shadow(0 0 6px ${alpha(c, 0.6)})` }} />
      </svg>
      <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <Typography sx={{ fontFamily: '"JetBrains Mono", monospace', fontWeight: 800, fontSize: size * 0.2, lineHeight: 1, color: c }}>
          {value}{unit}
        </Typography>
        {label && <Typography variant="caption" color="text.secondary" mt={0.4} letterSpacing={1}>{label}</Typography>}
      </Box>
    </Box>
  );
}

export function HeroMetric({ label, value, unit, caption, color, children }) {
  const theme = useTheme();
  const c = color || theme.palette.primary.main;
  return (
    <Card sx={{ p: 3, height: '100%', position: 'relative', overflow: 'hidden', boxShadow: cardShadow(theme) }}>
      <Typography variant="caption" color="text.secondary" textTransform="uppercase" letterSpacing={1.4} fontSize={10.5} fontWeight={700}>
        {label}
      </Typography>
      <Stack direction="row" alignItems="baseline" spacing={1} mt={1}>
        <Typography sx={{ color: c, fontSize: { xs: '3rem', md: '4rem' }, lineHeight: 0.9, fontFamily: '"JetBrains Mono", monospace', fontWeight: 700 }}>{value}</Typography>
        {unit && <Typography fontWeight={700} color="text.secondary" fontSize="1.4rem">{unit}</Typography>}
      </Stack>
      {caption && <Typography variant="body2" color="text.secondary" mt={1.5}>{caption}</Typography>}
      {children && <Box mt={2}>{children}</Box>}
    </Card>
  );
}

export function ProgressRow({ label, value, pct, color, chip }) {
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.6}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="body2" fontWeight={700} fontFamily="'JetBrains Mono', monospace">{label}</Typography>
          {chip}
        </Stack>
        <Typography variant="body2" fontWeight={700} sx={{ color, fontFamily: '"JetBrains Mono", monospace' }}>{value}</Typography>
      </Stack>
      <LinearProgress variant="determinate" value={pct}
        sx={{ height: 7, borderRadius: 999, bgcolor: alpha(color, 0.12),
          '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 999, boxShadow: `0 0 8px ${alpha(color, 0.7)}` } }} />
    </Box>
  );
}

export function LegendDot({ color, label }) {
  return (
    <Stack direction="row" spacing={0.6} alignItems="center">
      <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: color, boxShadow: `0 0 8px ${color}` }} />
      <Typography variant="caption" color="text.secondary">{label}</Typography>
    </Stack>
  );
}

export function EmptyState({ icon, text }) {
  return (
    <Stack alignItems="center" py={5} spacing={1.5}>
      {icon}
      <Typography variant="body2" color="text.secondary" textAlign="center">{text}</Typography>
    </Stack>
  );
}

export function cardShadowOf(theme) { return cardShadow(theme); }

// Shared recharts tooltip style.
export function useChartTip() {
  const theme = useTheme();
  return {
    background: theme.palette.mode === 'dark' ? 'rgba(18,20,39,0.96)' : '#fff',
    border: `1px solid ${theme.palette.divider}`, borderRadius: 10, fontSize: 12,
    boxShadow: '0 8px 24px rgba(0,0,0,0.28)', color: theme.palette.text.primary,
  };
}

// ── palettes ──
export const ATTACK_COLORS = {
  Blackhole: '#ff4d6d', Sybil: '#7c6cff', Wormhole: '#ffab3d', Grayhole: '#38bdf8', Normal: '#25e6b8',
};
export const SEVERITY_COLORS = {
  Critical: '#ff4d6d', High: '#ffab3d', Medium: '#ffd54a', Low: '#38bdf8',
};
export const STATUS_COLORS = {
  Detected: '#ffab3d', Isolated: '#ff4d6d', Recovered: '#25e6b8', Mitigated: '#38bdf8',
  Active: '#25e6b8', Sleeping: '#94a3b8', Dead: '#64748b',
};

export function trustColor(t) {
  if (t >= 0.7) return '#25e6b8';
  if (t >= 0.4) return '#ffd54a';
  return '#ff4d6d';
}

// Distinct areas on the topology map — one Cluster Head per zone.
export const ZONE_COLORS = ['#7c6cff', '#38bdf8', '#ffab3d', '#25e6b8', '#f472b6', '#a3e635'];
export function zoneColor(label) {
  if (!label) return '#94a3b8';
  const idx = (label.charCodeAt(label.length - 1) - 65) % ZONE_COLORS.length;
  return ZONE_COLORS[idx < 0 ? 0 : idx];
}

// "Different tricks for different isolation" — each attack type quarantines
// with a distinct icon + ring animation so the map reads differently per attack.
export const ISOLATION_TREATMENT = {
  Blackhole: { Icon: BlockIcon,        ringAnim: pulse, dash: 'none' },
  Sybil:     { Icon: CallSplitIcon,    ringAnim: pulse, dash: '2 3' },
  Wormhole:  { Icon: CycloneIcon,      ringAnim: spin,  dash: '4 3' },
  Grayhole:  { Icon: VisibilityOffIcon, ringAnim: pulse, dash: '1 4' },
};
