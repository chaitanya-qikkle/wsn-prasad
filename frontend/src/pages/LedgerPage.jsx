import React, { useMemo } from 'react';
import { Box, Grid, Typography, Stack, Chip, useTheme, alpha, Card, Tooltip } from '@mui/material';
import LinkIcon        from '@mui/icons-material/Link';
import VerifiedIcon    from '@mui/icons-material/Verified';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import LayersIcon      from '@mui/icons-material/Layers';
import { useSim } from '../sim/SimContext';
import { PageHeader, MetricStrip, Panel, LiveDot } from '../utils/ui';
import { ACCENT, ACCENT2, DANGER } from '../context/ThemeContext';

const TRIGGER_COLORS = { genesis: '#94a3b8', attack: DANGER, isolation: '#ffab3d' };

export default function LedgerPage() {
  const theme = useTheme();
  const sim = useSim();

  // newest first
  const blocks = useMemo(() => [...sim.ledger].sort((a, b) => b.block_index - a.block_index), [sim.ledger]);
  const height = blocks.length ? blocks[0].block_index : 0;
  const short = (h) => (h ? `${h.slice(0, 10)}…${h.slice(-6)}` : '—');

  return (
    <Box>
      <PageHeader icon={<LinkIcon />} title="Blockchain Ledger" accent={NEONish}
        subtitle="Lightweight, event-driven chain — a block is sealed only when an attack is detected"
        action={
          <Stack direction="row" spacing={1} alignItems="center">
            <LiveDot color={sim.chainValid ? ACCENT2 : DANGER} />
            <Chip icon={<VerifiedIcon />} color={sim.chainValid ? 'success' : 'error'} variant="outlined"
              label={sim.chainValid ? 'Chain Verified' : 'Chain Broken'} />
          </Stack>
        } />

      <Box mb={3}>
        <MetricStrip items={[
          { icon: <LayersIcon />, label: 'Block Height', value: height, color: ACCENT },
          { icon: <FingerprintIcon />, label: 'Total Blocks', value: blocks.length, color: ACCENT2 },
          { icon: <LinkIcon />, label: 'Attack Blocks', value: blocks.filter(b => b.trigger_type === 'attack').length, color: DANGER },
          { icon: <VerifiedIcon />, label: 'Integrity', value: sim.chainValid ? 'OK' : 'FAIL', color: sim.chainValid ? ACCENT2 : DANGER },
        ]} />
      </Box>

      <Panel title="Chain Explorer" accent={ACCENT} action={<Typography variant="caption" color="text.secondary">newest first</Typography>}>
        <Stack spacing={0} sx={{ maxHeight: 620, overflowY: 'auto', pr: 0.5 }}>
          {blocks.map((b, i) => (
            <Box key={b.block_index}>
              <Card sx={{ p: 2, border: `1px solid ${alpha(TRIGGER_COLORS[b.trigger_type] || ACCENT, 0.35)}`,
                background: alpha(TRIGGER_COLORS[b.trigger_type] || ACCENT, 0.04) }}>
                <Grid container spacing={1.5} alignItems="center">
                  <Grid item xs={12} sm={2}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Box sx={{ width: 42, height: 42, borderRadius: 1.5, flexShrink: 0,
                        background: alpha(TRIGGER_COLORS[b.trigger_type] || ACCENT, 0.15),
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: TRIGGER_COLORS[b.trigger_type] || ACCENT, fontWeight: 900, fontFamily: '"JetBrains Mono", monospace' }}>
                        #{b.block_index}
                      </Box>
                      <Box>
                        <Chip size="small" label={b.trigger_type} sx={{ fontSize: 9, height: 18,
                          bgcolor: alpha(TRIGGER_COLORS[b.trigger_type] || '#94a3b8', 0.18), color: TRIGGER_COLORS[b.trigger_type] || '#94a3b8' }} />
                        <Typography variant="caption" color="text.secondary" display="block" mt={0.3}>{new Date(b.mined_at).toLocaleTimeString()}</Typography>
                      </Box>
                    </Stack>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <HashRow label="hash" value={b.block_hash} color={ACCENT} short={short} />
                    <HashRow label="prev" value={b.prev_hash} short={short} />
                    <HashRow label="merkle" value={b.merkle_root} short={short} />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Stack direction="row" spacing={2} justifyContent={{ sm: 'flex-end' }}>
                      <Meta label="Nonce" value={b.nonce} />
                      <Meta label="Diff" value={b.difficulty} />
                      <Meta label="Events" value={b.event_count} />
                      <Meta label="Sealer" value={b.validator_uid || '—'} />
                    </Stack>
                  </Grid>
                </Grid>
              </Card>
              {i < blocks.length - 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 0.3 }}>
                  <Box sx={{ width: 2, height: 16, background: alpha(ACCENT, 0.4) }} />
                </Box>
              )}
            </Box>
          ))}
        </Stack>
      </Panel>
    </Box>
  );
}

const NEONish = '#38bdf8';

function HashRow({ label, value, color, short }) {
  return (
    <Tooltip title={value || ''} placement="top">
      <Stack direction="row" spacing={1} alignItems="center" sx={{ cursor: 'default' }}>
        <Typography variant="caption" color="text.secondary" width={48} flexShrink={0}>{label}</Typography>
        <Typography variant="caption" fontFamily="monospace" sx={{ color: color || 'text.secondary' }} noWrap>{short(value)}</Typography>
      </Stack>
    </Tooltip>
  );
}
function Meta({ label, value }) {
  return (
    <Box textAlign="center">
      <Typography variant="caption" color="text.secondary" fontSize={9.5} textTransform="uppercase">{label}</Typography>
      <Typography variant="body2" fontWeight={700} fontFamily="monospace">{value}</Typography>
    </Box>
  );
}
