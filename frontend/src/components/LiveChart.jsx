import React, { useMemo, useState } from 'react';
import { Box, Stack, Typography, alpha, useTheme, Tooltip as MTooltip } from '@mui/material';
import {
  ResponsiveContainer, ComposedChart, Area, Line, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, ReferenceArea, ReferenceLine, Brush,
} from 'recharts';
import { useChartTip } from '../utils/ui';
import { DANGER } from '../context/ThemeContext';

/*  One interactive chart used everywhere, instead of six hand-rolled recharts
 *  blocks that each behave slightly differently.
 *
 *  Interactive means: click a legend key to show/hide that series, drag the
 *  brush to zoom into a time range, and — the part that actually matters for
 *  this project — the windows where the network was under attack are shaded,
 *  so the dip in PDR is anchored to a cause instead of being an unexplained
 *  wobble the reader has to take on trust.                                    */

export default function LiveChart({
  data = [], series = [], height = 280, shadeAttacks = true, brush = false,
  yDomain, rightAxis = false, footnote,
}) {
  const theme = useTheme();
  const grid = theme.palette.divider;
  const axis = theme.palette.text.secondary;
  const tip = useChartTip();
  const [hidden, setHidden] = useState(() => new Set());

  const toggle = (key) => setHidden(prev => {
    const next = new Set(prev);
    // never let the reader hide the last visible series — an empty chart
    // looks like a bug rather than a choice
    if (next.has(key)) next.delete(key);
    else if (series.length - next.size > 1) next.add(key);
    return next;
  });

  // contiguous runs where the network was under attack, as x-axis bands
  const attackBands = useMemo(() => {
    if (!shadeAttacks) return [];
    const bands = [];
    let start = null;
    data.forEach((d, i) => {
      const on = !!d.underAttack;
      if (on && start === null) start = i;
      if ((!on || i === data.length - 1) && start !== null) {
        bands.push({ x1: data[start].time, x2: data[on ? i : Math.max(start, i - 1)].time });
        start = null;
      }
    });
    return bands;
  }, [data, shadeAttacks]);

  return (
    <Box>
      <Stack direction="row" spacing={1.6} flexWrap="wrap" useFlexGap mb={1}>
        {series.map(s => {
          const off = hidden.has(s.key);
          return (
            <MTooltip key={s.key} title={off ? `Show ${s.label}` : `Hide ${s.label}`}>
              <Stack direction="row" spacing={0.7} alignItems="center" onClick={() => toggle(s.key)}
                sx={{ cursor: 'pointer', px: 0.9, py: 0.35, borderRadius: 1.5, userSelect: 'none',
                  border: `1px solid ${off ? 'transparent' : alpha(s.color, 0.35)}`,
                  background: off ? 'transparent' : alpha(s.color, 0.09),
                  opacity: off ? 0.42 : 1, transition: 'all .15s',
                  '&:hover': { background: alpha(s.color, off ? 0.06 : 0.16) } }}>
                <Box sx={{ width: 9, height: 9, borderRadius: s.type === 'bar' ? 0.5 : '50%',
                  bgcolor: off ? theme.palette.text.disabled : s.color }} />
                <Typography variant="caption" fontWeight={700}
                  color={off ? 'text.disabled' : 'text.secondary'}>{s.label}</Typography>
              </Stack>
            </MTooltip>
          );
        })}
        {shadeAttacks && attackBands.length > 0 && (
          <Stack direction="row" spacing={0.7} alignItems="center" sx={{ px: 0.9, py: 0.35 }}>
            <Box sx={{ width: 14, height: 9, borderRadius: 0.5, bgcolor: alpha(DANGER, 0.22),
              border: `1px solid ${alpha(DANGER, 0.4)}` }} />
            <Typography variant="caption" color="text.secondary">under attack</Typography>
          </Stack>
        )}
      </Stack>

      <Box height={height}>
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ left: -14, right: rightAxis ? 0 : 8, top: 8, bottom: brush ? 0 : 4 }}>
            <defs>
              {series.filter(s => s.type === 'area').map(s => (
                <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.36} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
            <XAxis dataKey="time" stroke={axis} fontSize={10} tickLine={false}
              axisLine={{ stroke: grid }} minTickGap={28} />
            <YAxis yAxisId="left" domain={yDomain} stroke={axis} fontSize={11} tickLine={false} axisLine={false} />
            {rightAxis && (
              <YAxis yAxisId="right" orientation="right" stroke={axis} fontSize={11}
                tickLine={false} axisLine={false} width={34} />
            )}
            <RTooltip contentStyle={tip} cursor={{ stroke: alpha(theme.palette.text.primary, 0.25), strokeWidth: 1 }} />

            {attackBands.map((b, i) => (
              <ReferenceArea key={i} yAxisId="left" x1={b.x1} x2={b.x2}
                fill={alpha(DANGER, 0.14)} stroke={alpha(DANGER, 0.3)} strokeDasharray="3 3" />
            ))}

            {series.filter(s => !hidden.has(s.key)).map(s => {
              // `key` stays off the spread — React treats a spread key as a
              // special prop and warns, and recharts would forward it as data
              const common = {
                dataKey: s.key, name: s.label, isAnimationActive: false,
                yAxisId: s.axis === 'right' ? 'right' : 'left',
              };
              if (s.type === 'bar') {
                return <Bar key={s.key} {...common} barSize={s.barSize || 12}
                  fill={alpha(s.color, 0.55)} radius={[3, 3, 0, 0]} />;
              }
              if (s.type === 'area') {
                return <Area key={s.key} {...common} type="monotone" stroke={s.color} strokeWidth={2.4}
                  fill={`url(#grad-${s.key})`} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />;
              }
              return <Line key={s.key} {...common} type="monotone" stroke={s.color} strokeWidth={2.2} dot={false}
                strokeDasharray={s.dashed ? '5 4' : undefined} activeDot={{ r: 4, strokeWidth: 0 }} />;
            })}

            {series.filter(s => s.reference != null && !hidden.has(s.key)).map(s => (
              <ReferenceLine key={`ref-${s.key}`} yAxisId="left" y={s.reference} stroke={s.color}
                strokeDasharray="4 4" strokeOpacity={0.6} />
            ))}

            {brush && data.length > 8 && (
              <Brush dataKey="time" height={22} travellerWidth={8} stroke={theme.palette.primary.main}
                fill={alpha(theme.palette.primary.main, 0.06)}
                startIndex={Math.max(0, data.length - 30)} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </Box>

      {footnote && (
        <Typography variant="caption" color="text.secondary" display="block" mt={1} lineHeight={1.5}>
          {footnote}
        </Typography>
      )}
    </Box>
  );
}

/* Compact before/after bar comparison — "the network before the attack vs
   after it recovered", as numbers rather than two maps. */
export function BeforeAfterBars({ phases, metrics = [] }) {
  const theme = useTheme();
  const b = phases?.before, d = phases?.during, a = phases?.after;
  if (!b) return null;

  return (
    <Stack spacing={2}>
      {metrics.map(m => {
        const vals = [
          { label: 'Before', v: m.get(b), color: m.colors[0] },
          { label: 'Under attack', v: d ? m.get(d) : null, color: m.colors[1] },
          { label: 'After recovery', v: a ? m.get(a) : null, color: m.colors[2] },
        ];
        const max = Math.max(1, ...vals.map(x => x.v ?? 0));
        return (
          <Box key={m.label}>
            <Typography variant="caption" color="text.secondary" fontWeight={700}
              textTransform="uppercase" letterSpacing={0.5} display="block" mb={0.8}>{m.label}</Typography>
            <Stack spacing={0.8}>
              {vals.map(x => (
                <Stack key={x.label} direction="row" alignItems="center" spacing={1.2}>
                  <Typography variant="caption" color="text.secondary" sx={{ width: 96, flexShrink: 0 }}>
                    {x.label}
                  </Typography>
                  <Box sx={{ flex: 1, height: 18, borderRadius: 1, position: 'relative',
                    bgcolor: alpha(theme.palette.text.primary, 0.05), overflow: 'hidden' }}>
                    {x.v != null && (
                      <Box sx={{ position: 'absolute', inset: 0, width: `${(x.v / max) * 100}%`,
                        background: alpha(x.color, 0.6), borderRight: `2px solid ${x.color}`,
                        transition: 'width .5s ease' }} />
                    )}
                  </Box>
                  <Typography variant="caption" fontWeight={800} fontFamily="'JetBrains Mono', monospace"
                    sx={{ width: 56, textAlign: 'right', flexShrink: 0, color: x.v == null ? 'text.disabled' : x.color }}>
                    {x.v == null ? '—' : m.format ? m.format(x.v) : x.v}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Box>
        );
      })}
    </Stack>
  );
}
