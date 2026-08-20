import React, { useMemo, useState } from 'react';
import {
  Box, Grid, Typography, Stack, Chip, alpha, ToggleButton, ToggleButtonGroup, Button, Tooltip,
} from '@mui/material';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import GppBadIcon         from '@mui/icons-material/GppBad';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';
import RestartAltIcon     from '@mui/icons-material/RestartAlt';
import TrendingUpIcon     from '@mui/icons-material/TrendingUp';
import TrendingDownIcon   from '@mui/icons-material/TrendingDown';
import NetworkMap from './NetworkMap';
import { useZonesAndTunnels } from './networkMapHooks';
import { ACCENT, ACCENT2, DANGER, WARN } from '../context/ThemeContext';

/*  "Show how our system recovers" — the same field, at the three moments that
 *  matter, side by side: clean before the attack, at the worst point of the
 *  incident, and once the trust engine has put it back together.
 *
 *  All three are captured server-side (LiveSimRunner._capture_phases), so they
 *  survive a refresh and every viewer is comparing against the same "before"
 *  rather than whenever their own tab happened to connect.                    */

const STAGES = [
  { key: 'before', label: 'Before Attack',   icon: <ShieldOutlinedIcon />,     color: ACCENT2,
    blurb: 'Clean network — every node forwarding, no quarantine.' },
  { key: 'during', label: 'Under Attack',    icon: <GppBadIcon />,             color: DANGER,
    blurb: 'The attack at its widest. PDR shown is the lowest delivery reached at any point in the incident.' },
  { key: 'after',  label: 'After Recovery',  icon: <HealthAndSafetyIcon />,    color: ACCENT,
    blurb: 'Every node remediated and readmitted — automatically.' },
];

export default function PhaseCompare({ phases, live, onReset }) {
  const [layout, setLayout] = useState('grid');   // grid = all three, focus = one big
  const [focus, setFocus] = useState('after');

  const captured = STAGES.filter(s => phases?.[s.key]);
  const anything = captured.length > 0;

  const delta = useMemo(() => {
    const b = phases?.before, a = phases?.after;
    if (!b || !a) return null;
    return { pdr: +(a.pdr - b.pdr).toFixed(1), isolated: a.isolated - b.isolated };
  }, [phases]);

  if (!anything) {
    return (
      <Stack alignItems="center" spacing={1.2} py={5}>
        <ShieldOutlinedIcon sx={{ fontSize: 38, color: ACCENT2 }} />
        <Typography variant="body2" color="text.secondary" textAlign="center" maxWidth={460}>
          No incident recorded yet this session. Inject an attack from the Attack Lab (or switch on
          Auto-attack) and the network will be captured automatically at each stage — before, at the
          worst point, and once it has recovered.
        </Typography>
      </Stack>
    );
  }

  const shown = layout === 'grid' ? STAGES : STAGES.filter(s => s.key === focus);

  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap mb={2}>
        <ToggleButtonGroup exclusive size="small" value={layout} onChange={(_, v) => v && setLayout(v)}>
          <ToggleButton value="grid" sx={{ px: 1.4, fontSize: 12 }}>Compare all</ToggleButton>
          <ToggleButton value="focus" sx={{ px: 1.4, fontSize: 12 }}>Focus one</ToggleButton>
        </ToggleButtonGroup>
        {layout === 'focus' && (
          <ToggleButtonGroup exclusive size="small" value={focus} onChange={(_, v) => v && setFocus(v)}>
            {STAGES.map(s => (
              <ToggleButton key={s.key} value={s.key} disabled={!phases?.[s.key]} sx={{ px: 1.4, fontSize: 12 }}>
                {s.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        )}
        <Box flex={1} />
        {delta && (
          <Chip size="small" icon={delta.pdr >= 0 ? <TrendingUpIcon sx={{ fontSize: 15 }} /> : <TrendingDownIcon sx={{ fontSize: 15 }} />}
            label={`PDR ${delta.pdr >= 0 ? '+' : ''}${delta.pdr}% vs before`}
            sx={{ fontWeight: 700, bgcolor: alpha(delta.pdr >= -1 ? ACCENT2 : WARN, 0.14),
              color: delta.pdr >= -1 ? ACCENT2 : WARN, '& .MuiChip-icon': { color: 'inherit' } }} />
        )}
        {onReset && (
          <Tooltip title="Forget this incident and capture the next attack from scratch">
            <Button size="small" startIcon={<RestartAltIcon sx={{ fontSize: 16 }} />} onClick={onReset}
              sx={{ color: 'text.secondary' }}>New comparison</Button>
          </Tooltip>
        )}
      </Stack>

      <Grid container spacing={2}>
        {shown.map(stage => {
          const snap = phases?.[stage.key];
          const isLatest = stage.key === 'after' && !snap && live;
          return (
            <Grid item xs={12} md={layout === 'grid' ? 4 : 12} key={stage.key}>
              <StageCard stage={stage} snap={snap} pending={isLatest} big={layout === 'focus'} />
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
}

function StageCard({ stage, snap, pending, big }) {
  const nodes = snap?.nodes || [];
  const byUid = useMemo(() => Object.fromEntries(nodes.map(n => [n.node_uid, n])), [nodes]);
  const { zones, wormholeLinks } = useZonesAndTunnels(nodes, byUid);

  return (
    <Box sx={{ borderRadius: 3, overflow: 'hidden', height: '100%',
      border: `1px solid ${alpha(stage.color, 0.35)}`, background: alpha(stage.color, 0.05) }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 1.8, py: 1.2,
        borderBottom: `1px solid ${alpha(stage.color, 0.22)}`, background: alpha(stage.color, 0.09) }}>
        <Box sx={{ color: stage.color, display: 'flex', '& svg': { fontSize: 18 } }}>{stage.icon}</Box>
        <Typography variant="body2" fontWeight={800} sx={{ color: stage.color }}>{stage.label}</Typography>
        <Box flex={1} />
        {snap && (
          <Typography variant="caption" color="text.secondary" fontFamily="'JetBrains Mono', monospace">
            t{snap.tick}
          </Typography>
        )}
      </Stack>

      {snap ? (
        <>
          <Box sx={{ px: 1, pt: 1 }}>
            <NetworkMap nodes={nodes} routes={[]} zones={zones} wormholeLinks={wormholeLinks}
              compact={!big} interactive={big} frozen />
          </Box>
          <Stack direction="row" spacing={1} sx={{ px: 1.8, py: 1.4 }}>
            <Metric label="PDR" value={`${Math.round(snap.pdr)}%`}
              color={snap.pdr >= 85 ? ACCENT2 : snap.pdr >= 60 ? WARN : DANGER} />
            <Metric label="Attacking" value={snap.malicious} color={snap.malicious ? DANGER : ACCENT2} />
            <Metric label="Out of service" value={snap.isolated} color={snap.isolated ? WARN : ACCENT2} />
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ px: 1.8, pb: 1.6, display: 'block', lineHeight: 1.5 }}>
            {stage.blurb}
          </Typography>
        </>
      ) : (
        <Stack alignItems="center" justifyContent="center" spacing={0.8} sx={{ minHeight: 200, px: 2, py: 4 }}>
          <Typography variant="body2" color="text.secondary" textAlign="center">
            {pending ? 'Recovery still in progress — this fills in the moment every node is back in service.'
                     : 'Not captured yet.'}
          </Typography>
        </Stack>
      )}
    </Box>
  );
}

function Metric({ label, value, color }) {
  return (
    <Box flex={1} minWidth={0}>
      <Typography variant="caption" color="text.secondary" fontSize={9.5} fontWeight={700}
        textTransform="uppercase" letterSpacing={0.5} display="block" noWrap>{label}</Typography>
      <Typography sx={{ fontFamily: '"JetBrains Mono", monospace', fontWeight: 800, fontSize: 17, color }}>
        {value}
      </Typography>
    </Box>
  );
}

