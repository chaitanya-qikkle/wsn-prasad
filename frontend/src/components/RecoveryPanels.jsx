import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Grid, Typography, Stack, Chip, alpha, useTheme, Switch, Tooltip, LinearProgress, Divider,
} from '@mui/material';
import AutoFixHighIcon    from '@mui/icons-material/AutoFixHigh';
import CheckCircleIcon    from '@mui/icons-material/CheckCircle';
import TimerIcon          from '@mui/icons-material/Timer';
import CompareArrowsIcon  from '@mui/icons-material/CompareArrows';
import ReportProblemIcon  from '@mui/icons-material/ReportProblem';
import { Panel, TimeStat, PhaseChip, formatDuration, ATTACK_COLORS } from '../utils/ui';
import { ACCENT, ACCENT2, DANGER, WARN, NEON } from '../context/ThemeContext';

/*  Everything about automatic recovery and how long it takes.
 *
 *  The numbers here are measured by the simulator (each attack opens a timed
 *  "episode" — see WSNSimulator._open_episode), never hard-coded, so the
 *  existing-vs-proposed comparison holds up when someone asks to see it run
 *  live rather than as a slide.                                              */

// One ticking clock for anything showing live elapsed time.
function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

/* ── 1. Automatic recovery status ─────────────────────────────────────────── */
export function AutoRecoveryBanner({ sim }) {
  const cfg = sim.autoRecovery || {};
  const sum = sim.recoverySummary || {};
  const on = !!cfg.enabled;
  const c = on ? ACCENT2 : DANGER;
  const healing = sim.stats.recoveringNodes || 0;

  // how long a full automatic recovery takes, from the engine's own settings
  const quarantineSec = ((cfg.quarantineTicks || 0) * (cfg.intervalMs || 2000)) / 1000;

  return (
    <Box sx={{ p: 2.2, borderRadius: 3, border: `1px solid ${alpha(c, 0.35)}`,
      background: `linear-gradient(135deg, ${alpha(c, 0.12)}, ${alpha(c, 0.04)})` }}>
      <Stack direction="row" alignItems="center" spacing={1.6} flexWrap="wrap" useFlexGap>
        <Box sx={{ width: 42, height: 42, borderRadius: 2.5, flexShrink: 0, color: c,
          background: alpha(c, 0.16), border: `1px solid ${alpha(c, 0.3)}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <AutoFixHighIcon sx={{ fontSize: 22 }} />
        </Box>
        <Box flex={1} minWidth={240}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="subtitle2" fontWeight={800} sx={{ color: c }}>Automatic Recovery</Typography>
            <Chip size="small" label={on ? 'ACTIVE' : 'DISABLED — BASELINE'}
              sx={{ height: 19, fontSize: 9.5, fontWeight: 800, letterSpacing: 0.5,
                bgcolor: alpha(c, 0.18), color: c }} />
            {healing > 0 && (
              <Chip size="small" label={`${healing} healing now`}
                sx={{ height: 19, fontSize: 9.5, fontWeight: 800, bgcolor: alpha(ACCENT, 0.16), color: ACCENT }} />
            )}
          </Stack>
          <Typography variant="caption" color="text.secondary" display="block" mt={0.5} lineHeight={1.55}>
            {on ? (
              <>Quarantine → scrub after {formatDuration(quarantineSec)} → rebuild trust to{' '}
                {((cfg.threshold ?? 0.4) + 0.25).toFixed(2)} → readmitted to routing.{' '}
                <b>{sum.autoRecoveries || 0}</b> node(s) have healed themselves so far, with zero operator action.</>
            ) : (
              <>The existing system has no trust engine: a detected node keeps attacking until a human
                intervenes. Nothing below will self-heal while this is on.</>
            )}
          </Typography>
        </Box>
      </Stack>

      {on && (
        <Stack direction="row" spacing={1} mt={2} flexWrap="wrap" useFlexGap>
          {['Quarantine', 'Scrub', 'Rebuild trust', 'Readmit'].map((step, i) => (
            <React.Fragment key={step}>
              <Chip size="small" label={`${i + 1}. ${step}`}
                sx={{ height: 22, fontSize: 10.5, fontWeight: 700,
                  bgcolor: alpha(c, 0.1), color: c, border: `1px solid ${alpha(c, 0.25)}` }} />
              {i < 3 && <Typography variant="caption" sx={{ color: alpha(c, 0.6), lineHeight: '22px' }}>→</Typography>}
            </React.Fragment>
          ))}
        </Stack>
      )}
    </Box>
  );
}

/* ── 2. "How much time did it take" ───────────────────────────────────────── */
export function RecoveryTimings({ sim }) {
  const sum = sim.recoverySummary || {};
  return (
    <Panel accent={ACCENT} title="Recovery Time"
      subtitle="Measured per attack, from the moment it starts to the moment the node is back in service."
      action={<Chip size="small" icon={<TimerIcon sx={{ fontSize: 14 }} />} variant="outlined"
        label={`${sum.recovered || 0} of ${sum.totalEpisodes || 0} resolved`}
        sx={{ height: 22, fontSize: 10.5, borderColor: alpha(ACCENT, 0.35), color: ACCENT,
          '& .MuiChip-icon': { color: 'inherit' } }} />}>
      <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
        <TimeStat label="Detect" value={formatDuration(sum.avgDetectSec)} color={WARN} hint="attack → flagged" />
        <TimeStat label="Isolate" value={formatDuration(sum.avgIsolateSec)} color={DANGER} hint="attack → quarantined" />
        <TimeStat label="Recover" value={formatDuration(sum.avgRecoverSec)} color={ACCENT} hint="quarantine → back in service" />
        <TimeStat label="End to end" value={formatDuration(sum.avgTotalSec)} color={ACCENT2} hint="average, whole incident" />
        <TimeStat label="Worst case" value={formatDuration(sum.worstTotalSec)} color={NEON} hint="slowest recovery seen" />
      </Stack>
    </Panel>
  );
}

/* ── 3. Per-node lifecycle, with stage timings ────────────────────────────── */
export function AttackTimeline({ sim, limit = 8, onSelect }) {
  const theme = useTheme();
  const now = useNow();
  const rows = (sim.attackTimeline || []).slice(0, limit);

  // scale every bar against the longest incident so the widths are comparable
  const maxSec = useMemo(() => {
    const vals = (sim.attackTimeline || []).map(e =>
      e.total_sec ?? Math.max(1, now / 1000 - e.started_at));
    return Math.max(8, ...vals);
  }, [sim.attackTimeline, now]);

  if (!rows.length) {
    return (
      <Panel accent={ACCENT2} title="Attack Lifecycle Timeline">
        <Typography variant="body2" color="text.secondary" py={3} textAlign="center">
          Nothing has attacked this network yet. Every attack from here on is timed stage by stage.
        </Typography>
      </Panel>
    );
  }

  return (
    <Panel accent={ACCENT2} title="Attack Lifecycle Timeline"
      subtitle="Each bar is one attack: how long to detect it, isolate it, scrub it, and put the node back."
      action={
        <Stack direction="row" spacing={1.4} flexWrap="wrap" useFlexGap>
          {[['Detecting', WARN], ['Isolating', DANGER], ['Scrubbing', NEON], ['Rebuilding trust', ACCENT]].map(([l, c]) => (
            <Stack key={l} direction="row" spacing={0.5} alignItems="center">
              <Box sx={{ width: 9, height: 9, borderRadius: 0.5, bgcolor: c }} />
              <Typography variant="caption" color="text.secondary" fontSize={10}>{l}</Typography>
            </Stack>
          ))}
        </Stack>
      }>
      <Stack divider={<Divider sx={{ borderColor: theme.palette.divider }} />}>
        {rows.map(ep => <TimelineRow key={ep.id} ep={ep} maxSec={maxSec} now={now} onSelect={onSelect} />)}
      </Stack>
    </Panel>
  );
}

function TimelineRow({ ep, maxSec, now, onSelect }) {
  const theme = useTheme();
  const attackColor = ATTACK_COLORS[ep.attack_type] || NEON;
  const resolved = ep.status === 'Recovered';
  const elapsed = resolved ? ep.total_sec : Math.max(0, now / 1000 - ep.started_at);

  // stage boundaries in seconds from the start of the attack
  const tDetect = ep.detect_sec ?? null;
  const tIsolate = ep.isolate_sec ?? null;
  const tRemediate = tIsolate != null && ep.remediate_sec != null ? tIsolate + ep.remediate_sec : null;
  const tEnd = resolved ? ep.total_sec : elapsed;

  const seg = (from, to, color, label) => {
    if (from == null || to == null || to <= from) return null;
    return { left: (from / maxSec) * 100, width: ((to - from) / maxSec) * 100, color, label };
  };
  const segments = [
    seg(0, tDetect ?? tEnd, WARN, 'detecting'),
    seg(tDetect, tIsolate ?? (resolved ? tEnd : elapsed), DANGER, 'isolating'),
    seg(tIsolate, tRemediate, NEON, 'scrubbing'),
    seg(tRemediate, tEnd, ACCENT, 'rebuilding trust'),
  ].filter(Boolean);

  return (
    <Box sx={{ py: 1.3, cursor: onSelect ? 'pointer' : 'default' }} onClick={() => onSelect?.(ep.node_uid)}>
      <Stack direction="row" alignItems="center" spacing={1} mb={0.8} flexWrap="wrap" useFlexGap>
        <Typography variant="body2" fontWeight={800} fontFamily="'JetBrains Mono', monospace">{ep.node_uid}</Typography>
        <Typography variant="body2" fontWeight={700} sx={{ color: attackColor }}>{ep.attack_type}</Typography>
        {ep.zone_label && <Typography variant="caption" color="text.secondary">{ep.zone_label}</Typography>}
        <PhaseChip phase={ep.status} />
        {ep.mode === 'existing' && (
          <Chip size="small" label="existing system" sx={{ height: 19, fontSize: 9.5, fontWeight: 700,
            bgcolor: alpha(DANGER, 0.14), color: DANGER }} />
        )}
        <Box flex={1} />
        {resolved ? (
          <Stack direction="row" spacing={0.6} alignItems="center">
            <CheckCircleIcon sx={{ fontSize: 15, color: ACCENT2 }} />
            <Typography variant="caption" fontWeight={800} sx={{ color: ACCENT2 }}>
              recovered in {formatDuration(ep.total_sec)}
            </Typography>
          </Stack>
        ) : (
          <Stack direction="row" spacing={0.6} alignItems="center">
            <ReportProblemIcon sx={{ fontSize: 15, color: WARN }} />
            <Typography variant="caption" fontWeight={800} sx={{ color: WARN }}>
              unresolved · {formatDuration(elapsed)} and counting
            </Typography>
          </Stack>
        )}
      </Stack>

      <Tooltip arrow title={
        <Box>
          {[['Detected after', ep.detect_sec], ['Isolated after', ep.isolate_sec],
            ['Scrubbed in', ep.remediate_sec], ['Back in service after', ep.recover_sec],
            ['Total', ep.total_sec]].map(([l, v]) => (
            <Typography key={l} variant="caption" display="block">{l}: {formatDuration(v)}</Typography>
          ))}
        </Box>
      }>
        <Box sx={{ position: 'relative', height: 10, borderRadius: 999, overflow: 'hidden',
          bgcolor: alpha(theme.palette.text.primary, 0.07) }}>
          {segments.map((sg, i) => (
            <Box key={i} sx={{ position: 'absolute', top: 0, bottom: 0, left: `${sg.left}%`,
              width: `${Math.max(0.6, sg.width)}%`, background: sg.color,
              opacity: resolved ? 0.9 : 0.95, transition: 'width .4s ease, left .4s ease' }} />
          ))}
          {!resolved && (
            <Box sx={{ position: 'absolute', top: 0, bottom: 0, left: `${(tEnd / maxSec) * 100}%`,
              width: 2, background: WARN }} />
          )}
        </Box>
      </Tooltip>
    </Box>
  );
}

/* ── 4. Existing system vs proposed system ────────────────────────────────── */
export function SystemComparison({ sim }) {
  const sum = sim.recoverySummary || {};
  const baseline = !!sim.baselineMode;

  // In the baseline there is no automatic recovery, so the honest "time to
  // recover" is however long the incident has already been running unresolved.
  const openSec = sum.unresolved > 0
    ? Math.max(sum.openSec || 0, 0) + (baseline ? 0 : 0)
    : 0;

  const rows = [
    {
      title: 'Proposed System', sub: 'trust engine + automatic recovery', color: ACCENT2,
      active: !baseline,
      time: formatDuration(sum.avgTotalSec),
      caption: sum.recovered
        ? `average, across ${sum.recovered} recovered node(s) · ${sum.autoRecoveries} healed automatically`
        : 'no incident resolved yet — inject an attack to measure it',
      points: ['Detects and isolates on its own', 'Scrubs and readmits without an operator',
        'Routes rebuilt around the node while it is out'],
    },
    {
      title: 'Existing System', sub: 'no trust engine', color: DANGER,
      active: baseline,
      time: sum.unresolved > 0 ? `${formatDuration(openSec)}+` : '—',
      caption: sum.unresolved > 0
        ? `${sum.unresolved} node(s) still compromised — the clock does not stop on its own`
        : 'never recovers without manual intervention',
      points: ['Anomaly is visible but nothing acts on it', 'Node keeps attacking until a human steps in',
        'PDR stays degraded for the whole window'],
    },
  ];

  return (
    <Panel accent={baseline ? DANGER : ACCENT2}
      title={
        <Stack direction="row" spacing={1} alignItems="center">
          <CompareArrowsIcon sx={{ fontSize: 19 }} />
          <Typography variant="subtitle1" fontWeight={700}>Existing System vs Proposed System</Typography>
        </Stack>}
      subtitle="Same attacks, same network — the only difference is whether the trust engine is running. Toggle it and watch it happen live."
      action={
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="caption" fontWeight={baseline ? 500 : 800} color={baseline ? 'text.secondary' : ACCENT2}>
            Proposed
          </Typography>
          <Switch size="small" checked={baseline} color="error"
            onChange={(e) => sim.setBaselineMode(e.target.checked)} />
          <Typography variant="caption" fontWeight={baseline ? 800 : 500} color={baseline ? DANGER : 'text.secondary'}>
            Existing
          </Typography>
        </Stack>}>
      <Grid container spacing={2}>
        {rows.map(r => (
          <Grid item xs={12} sm={6} key={r.title}>
            <Box sx={{ p: 2, borderRadius: 2.5, height: '100%',
              border: `1px solid ${alpha(r.color, r.active ? 0.5 : 0.22)}`,
              background: alpha(r.color, r.active ? 0.09 : 0.03),
              opacity: r.active ? 1 : 0.6, transition: 'opacity .2s, background .2s' }}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography variant="caption" fontWeight={800} sx={{ color: r.color }}
                  textTransform="uppercase" letterSpacing={0.5}>{r.title}</Typography>
                {r.active && <Chip size="small" label="RUNNING" sx={{ height: 17, fontSize: 9,
                  fontWeight: 800, bgcolor: alpha(r.color, 0.2), color: r.color }} />}
              </Stack>
              <Typography variant="caption" color="text.secondary" display="block">{r.sub}</Typography>
              <Typography sx={{ fontFamily: '"JetBrains Mono", monospace', fontWeight: 800, fontSize: 32,
                mt: 0.8, color: r.color, lineHeight: 1.1 }}>{r.time}</Typography>
              <Typography variant="caption" color="text.secondary" display="block" mt={0.3}>{r.caption}</Typography>
              <Stack spacing={0.5} mt={1.5}>
                {r.points.map(p => (
                  <Stack key={p} direction="row" spacing={0.8} alignItems="flex-start">
                    <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: r.color, mt: 0.7, flexShrink: 0 }} />
                    <Typography variant="caption" color="text.secondary" lineHeight={1.45}>{p}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Box>
          </Grid>
        ))}
      </Grid>
    </Panel>
  );
}

/* ── 5. Recovery confirmations — "did this node/area actually recover?" ───── */
export function RecoveryLog({ sim, limit = 6 }) {
  const theme = useTheme();
  const events = [...(sim.recoveryEvents || [])].reverse().slice(0, limit);
  const healing = (sim.nodes || []).filter(n => n.is_isolated && !n.is_malicious);
  const readmitAt = (sim.autoRecovery?.threshold ?? 0.4) + 0.25;

  return (
    <Panel accent={ACCENT2} title="Recovery Confirmations"
      subtitle="Nodes currently healing, and the ones the engine has already put back."
      action={<Chip size="small" label={`${(sim.recoveryEvents || []).length} total`} variant="outlined"
        sx={{ height: 22, fontSize: 10.5, borderColor: alpha(ACCENT2, 0.35), color: ACCENT2 }} />}>

      {healing.length > 0 && (
        <Stack spacing={1.2} mb={events.length ? 2 : 0}>
          {healing.map(n => {
            const pct = Math.min(100, ((n.trust_score || 0) / readmitAt) * 100);
            return (
              <Box key={n.node_uid}>
                <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
                  <Typography variant="body2" fontWeight={800} fontFamily="'JetBrains Mono', monospace">
                    {n.node_uid}
                  </Typography>
                  <PhaseChip phase={n.phase || 'Remediating'} />
                  {n.zone_label && <Typography variant="caption" color="text.secondary">{n.zone_label}</Typography>}
                  <Box flex={1} />
                  <Typography variant="caption" fontFamily="'JetBrains Mono', monospace" sx={{ color: ACCENT }}>
                    {n.trust_score?.toFixed(2)} / {readmitAt.toFixed(2)}
                  </Typography>
                </Stack>
                <LinearProgress variant="determinate" value={pct}
                  sx={{ height: 6, borderRadius: 999, bgcolor: alpha(ACCENT, 0.14),
                    '& .MuiLinearProgress-bar': { bgcolor: ACCENT } }} />
              </Box>
            );
          })}
        </Stack>
      )}

      {events.length === 0 && healing.length === 0 && (
        <Typography variant="body2" color="text.secondary" py={3} textAlign="center">
          Nothing has needed recovering yet.
        </Typography>
      )}

      <Stack divider={<Divider sx={{ borderColor: theme.palette.divider }} />}>
        {events.map((e, i) => (
          <Stack key={`${e.node_uid}-${e.recovered_at}-${i}`} direction="row" alignItems="center" spacing={1.4} py={1}>
            <CheckCircleIcon sx={{ fontSize: 20, color: ACCENT2, flexShrink: 0 }} />
            <Box flex={1} minWidth={0}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <Typography variant="body2" fontWeight={800} fontFamily="'JetBrains Mono', monospace">
                  {e.node_uid}
                </Typography>
                <Typography variant="caption" fontWeight={700} sx={{ color: ACCENT2 }}>recovered</Typography>
                {e.zone_label && (
                  <Typography variant="caption" color="text.secondary">· {e.zone_label} restored</Typography>
                )}
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {e.attack_type || 'anomaly'} · out of service {formatDuration(e.duration_sec)}
                {e.total_sec != null && ` · ${formatDuration(e.total_sec)} end to end`}
              </Typography>
            </Box>
            <Chip size="small" label={e.method === 'auto' ? 'automatic' : 'manual'}
              sx={{ height: 20, fontSize: 9.5, fontWeight: 800, flexShrink: 0,
                bgcolor: alpha(e.method === 'auto' ? ACCENT2 : WARN, 0.15),
                color: e.method === 'auto' ? ACCENT2 : WARN }} />
          </Stack>
        ))}
      </Stack>
    </Panel>
  );
}

