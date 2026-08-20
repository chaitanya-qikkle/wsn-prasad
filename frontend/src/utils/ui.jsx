import React from 'react';
import { Box, Card, Chip, Typography, Stack, useTheme, alpha, LinearProgress, Grid, keyframes } from '@mui/material';

/*  Shared UI kit — security-operations surfaces, live indicators, sparklines,
 *  stat cards and the lifecycle/duration primitives used across every console
 *  page. Anything that appears on more than one page belongs here rather than
 *  being re-styled per page, so the console reads as one system.            */

export const pulse = keyframes`0%,100%{opacity:1}50%{opacity:.25}`;
export const rise  = keyframes`from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}`;
export const popIn = keyframes`0%{transform:scale(.7);opacity:0}60%{transform:scale(1.06)}100%{transform:scale(1);opacity:1}`;
export const spin  = keyframes`from{transform:rotate(0deg)}to{transform:rotate(360deg)}`;

function cardShadow(theme) {
  return theme.palette.mode === 'dark'
    ? '0 1px 0 rgba(255,255,255,0.03) inset, 0 8px 24px rgba(3,7,18,0.45)'
    : '0 1px 2px rgba(15,23,42,0.04), 0 4px 12px rgba(15,23,42,0.06)';
}

// A "live" status dot — small, calm, no glow halo.
export function LiveDot({ color, size = 8 }) {
  const theme = useTheme();
  const c = color || theme.palette.success.main;
  return (
    <Box sx={{ width: size, height: size, borderRadius: '50%', bgcolor: c, flexShrink: 0,
      boxShadow: `0 0 0 3px ${alpha(c, 0.14)}`, animation: `${pulse} 1.8s ease infinite` }} />
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
        <Box sx={{ width: 44, height: 44, borderRadius: 2, flexShrink: 0, color: c,
          background: alpha(c, 0.1), border: `1px solid ${alpha(c, 0.18)}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', '& svg': { fontSize: 22 } }}>
          {icon}
        </Box>
        <Box>
          <Typography variant="h5" fontWeight={700} sx={{ lineHeight: 1.1, letterSpacing: -0.3 }}>{title}</Typography>
          {subtitle && <Typography variant="body2" color="text.secondary" mt={0.4}>{subtitle}</Typography>}
        </Box>
      </Stack>
      {action}
    </Box>
  );
}

// Section / panel surface — accent hairline along the top edge, header row
// separated by a divider so dense telemetry panels stay scannable.
export function Panel({ title, action, children, sx, accent, dense, subtitle }) {
  const theme = useTheme();
  const c = accent || theme.palette.primary.main;
  return (
    <Card sx={{ p: dense ? 2 : 2.5, height: '100%', position: 'relative', overflow: 'hidden',
      boxShadow: cardShadow(theme), ...sx }}>
      {accent && (
        <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2,
          background: `linear-gradient(90deg, ${c}, ${alpha(c, 0)})` }} />
      )}
      {(title || action) && (
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={subtitle ? 0.4 : 2}
          flexWrap="wrap" gap={1}>
          {title && (typeof title === 'string'
            ? <Typography variant="subtitle1" fontWeight={700} letterSpacing={0.1}>{title}</Typography>
            : title)}
          {action}
        </Stack>
      )}
      {subtitle && (
        <Typography variant="caption" color="text.secondary" display="block" mb={2} lineHeight={1.5}>
          {subtitle}
        </Typography>
      )}
      {children}
    </Card>
  );
}

// KPI stat card — mono number, flat tinted icon chip, thin accent underline + sparkline.
export function StatCard({ icon, label, value, sub, color, spark }) {
  const theme = useTheme();
  const c = color || theme.palette.primary.main;
  return (
    <Card sx={{ p: 2.4, height: '100%', position: 'relative', overflow: 'hidden', boxShadow: cardShadow(theme),
      transition: 'border-color .15s', '&:hover': { borderColor: alpha(c, 0.35) } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
        <Box minWidth={0}>
          <Typography variant="caption" color="text.secondary" fontWeight={700} textTransform="uppercase"
            letterSpacing={0.6} fontSize={10.5} noWrap>{label}</Typography>
          <Typography sx={{ mt: 0.6, fontFamily: '"JetBrains Mono", monospace', fontWeight: 700, fontSize: 30, lineHeight: 1,
            color: theme.palette.text.primary }}>{value}</Typography>
          {sub && <Typography variant="caption" color="text.secondary" mt={0.8} display="block" noWrap>{sub}</Typography>}
        </Box>
        {icon && (
          <Box sx={{ width: 38, height: 38, borderRadius: 2, flexShrink: 0, color: c,
            background: alpha(c, 0.1), border: `1px solid ${alpha(c, 0.16)}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', '& svg': { fontSize: 19 } }}>{icon}</Box>
        )}
      </Stack>
      {spark && spark.length > 1 && (
        <Box sx={{ mt: 1.2, mx: -0.4 }}><Sparkline data={spark} color={c} height={26} /></Box>
      )}
      <Box sx={{ position: 'absolute', left: 0, bottom: 0, height: 2, width: '100%', background: alpha(c, 0.5) }} />
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
          transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
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
        sx={{ height: 6, borderRadius: 999, bgcolor: alpha(color, 0.12),
          '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 999 } }} />
    </Box>
  );
}

export function LegendDot({ color, label }) {
  return (
    <Stack direction="row" spacing={0.6} alignItems="center">
      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color }} />
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
  const dark = theme.palette.mode === 'dark';
  return {
    background: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`, borderRadius: 9, fontSize: 12,
    padding: '8px 10px',
    boxShadow: dark ? '0 10px 28px rgba(3,7,18,0.6)' : '0 6px 18px rgba(15,23,42,0.10)',
    color: theme.palette.text.primary,
  };
}

// ── palettes ──
// Every value here is mid-luminance on purpose: the console runs dark by
// default but the light toggle has to stay readable, and one palette that
// works on both beats two that drift apart.
export const ATTACK_COLORS = {
  Blackhole: '#f43f5e',  // rose   — swallows everything
  Sybil:     '#8b5cf6',  // violet — forged identities
  Wormhole:  '#d97706',  // amber  — the two-node tunnel
  Grayhole:  '#0ea5e9',  // sky    — selective, sneaky
  Normal:    '#059669',
  'Manual Isolation': '#64748b',
};
export const SEVERITY_COLORS = {
  Critical: '#f43f5e', High: '#d97706', Medium: '#8b5cf6', Low: '#0ea5e9',
};
export const STATUS_COLORS = {
  Detected: '#d97706', Isolated: '#f43f5e', Recovered: '#059669', Mitigated: '#0ea5e9',
  Active: '#059669', Recovering: '#0891b2', Sleeping: '#64748b', Dead: '#475569',
};

// Node lifecycle — mirrors the PHASE_* constants in backend/app/sim/network.py.
export const PHASE_COLORS = {
  Active:      '#059669',
  Compromised: '#f43f5e',
  Detected:    '#d97706',
  Isolated:    '#f43f5e',
  Remediating: '#0891b2',
  Recovered:   '#059669',
};
export const PHASE_ORDER = ['Active', 'Compromised', 'Detected', 'Isolated', 'Remediating', 'Recovered'];

export function trustColor(t) {
  if (t >= 0.7) return '#059669';
  if (t >= 0.4) return '#d97706';
  return '#f43f5e';
}

// Distinct areas on the topology map — one Cluster Head per zone.
export const ZONE_COLORS = ['#8b5cf6', '#0ea5e9', '#d97706', '#059669', '#db2777', '#65a30d'];
export function zoneColor(label) {
  if (!label) return '#64748b';
  const idx = (label.charCodeAt(label.length - 1) - 65) % ZONE_COLORS.length;
  return ZONE_COLORS[idx < 0 ? 0 : idx];
}

// "Different tricks for different isolation" — each attack type quarantines
// with a distinct ring treatment, so a glance at the map tells you *what* was
// caught, not merely that something was. Wormhole additionally draws its
// two-node tunnel (see NetworkMap) because it is the one attack that is not a
// property of a single node.
export const ISOLATION_TREATMENT = {
  Blackhole: { ringAnim: pulse, dash: 'none', rings: 1, label: 'solid pulsing ring — total packet sink' },
  Sybil:     { ringAnim: pulse, dash: '2 3',  rings: 2, label: 'double dotted ring — one node, many identities' },
  Wormhole:  { ringAnim: spin,  dash: '4 3',  rings: 1, label: 'rotating dashed ring + tunnel to its partner' },
  Grayhole:  { ringAnim: pulse, dash: '1 4',  rings: 1, label: 'fine dotted ring — drops only some packets' },
};

// ── formatting ──
// One duration format everywhere, so the same elapsed time never reads as
// "12s" in one panel and "0.2m" in the next.
export function formatDuration(sec) {
  if (sec == null || Number.isNaN(sec)) return '—';
  if (sec < 1) return '<1s';
  if (sec < 60) return `${Math.round(sec)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return s ? `${m}m ${s}s` : `${m}m`;
}

// Lifecycle badge — same colour language as the map and the timeline.
export function PhaseChip({ phase, size = 'small', sx }) {
  const c = PHASE_COLORS[phase] || '#64748b';
  return (
    <Chip size={size} label={phase} sx={{ height: 21, fontSize: 10.5, fontWeight: 700, letterSpacing: 0.2,
      bgcolor: alpha(c, 0.16), color: c, border: `1px solid ${alpha(c, 0.32)}`, ...sx }} />
  );
}

// A labelled duration — the "how long did it take" unit used across the
// recovery panels.
export function TimeStat({ label, value, color, hint }) {
  const theme = useTheme();
  const c = color || theme.palette.primary.main;
  return (
    <Box sx={{ flex: 1, minWidth: 92 }}>
      <Typography variant="caption" color="text.secondary" fontSize={9.5} fontWeight={700}
        textTransform="uppercase" letterSpacing={0.5} display="block" noWrap>{label}</Typography>
      <Typography sx={{ fontFamily: '"JetBrains Mono", monospace', fontWeight: 800, fontSize: 19, color: c, lineHeight: 1.2 }}>
        {value}
      </Typography>
      {hint && <Typography variant="caption" color="text.secondary" fontSize={9.5} noWrap>{hint}</Typography>}
    </Box>
  );
}
