import React, { useState } from 'react';
import {
  Box, Typography, Stack, Chip, useTheme, alpha, Card, ToggleButton,
  ToggleButtonGroup, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, LinearProgress,
} from '@mui/material';
import RouteIcon     from '@mui/icons-material/AltRoute';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import { useSim } from '../sim/SimContext';
import { PageHeader, MetricStrip, LiveDot, trustColor } from '../utils/ui';
import { ACCENT, ACCENT2, WARN } from '../context/ThemeContext';

export default function RoutesPage() {
  const theme = useTheme();
  const grid = theme.palette.divider;
  const sim = useSim();
  const [filter, setFilter] = useState('all');

  const all = sim.routes;
  const routes = filter === 'all' ? all : filter === 'rerouted' ? all.filter(r => r.reconfigured) : all.filter(r => !r.reconfigured);
  const reroutedCount = all.filter(r => r.reconfigured).length;
  const avgHops = all.length ? (all.reduce((s, r) => s + (r.hop_count || 0), 0) / all.length).toFixed(1) : '0';
  const avgLat  = all.length ? (all.reduce((s, r) => s + (r.latency || 0), 0) / all.length).toFixed(0) : '0';

  return (
    <Box>
      <PageHeader icon={<RouteIcon />} title="Secure Routing" accent={ACCENT2}
        subtitle="Trust-aware AODV paths — routes are dynamically rebuilt to avoid compromised nodes"
        action={<Stack direction="row" spacing={1} alignItems="center"><LiveDot color={ACCENT2} /><Typography variant="caption" fontWeight={800} color={ACCENT2} letterSpacing={1}>LIVE ROUTES</Typography></Stack>} />

      <Box mb={3}>
        <MetricStrip items={[
          { icon: <RouteIcon />, label: 'Active Paths', value: all.length, color: ACCENT },
          { icon: <AutorenewIcon />, label: 'Reconfigured', value: reroutedCount, color: WARN },
          { icon: <RouteIcon />, label: 'Avg Hops', value: avgHops, color: ACCENT2 },
          { icon: <RouteIcon />, label: 'Avg Latency', value: `${avgLat}ms`, color: '#38bdf8' },
        ]} />
      </Box>

      <Stack direction="row" justifyContent="flex-end" mb={2}>
        <ToggleButtonGroup size="small" exclusive value={filter} onChange={(_, v) => v && setFilter(v)}>
          <ToggleButton value="all">All</ToggleButton>
          <ToggleButton value="rerouted">Reconfigured</ToggleButton>
          <ToggleButton value="direct">Stable</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ '& th': { fontWeight: 800, color: 'text.secondary', borderColor: grid } }}>
                <TableCell>Source → Sink</TableCell><TableCell>Path</TableCell><TableCell>Hops</TableCell>
                <TableCell>Path Trust</TableCell><TableCell>Latency</TableCell><TableCell>State</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {routes.map(r => (
                <TableRow key={r.id} hover sx={{ '& td': { borderColor: grid } }}>
                  <TableCell><Typography variant="body2" fontWeight={700} fontFamily="monospace">{r.src_uid} → {r.dst_uid}</Typography></TableCell>
                  <TableCell><Typography variant="caption" fontFamily="monospace" color="text.secondary">{(r.hops || []).join(' → ')}</Typography></TableCell>
                  <TableCell>{r.hop_count}</TableCell>
                  <TableCell sx={{ minWidth: 130 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <LinearProgress variant="determinate" value={r.path_trust * 100}
                        sx={{ flex: 1, height: 6, borderRadius: 3, bgcolor: alpha(theme.palette.text.primary, 0.08),
                          '& .MuiLinearProgress-bar': { bgcolor: trustColor(r.path_trust), borderRadius: 3 } }} />
                      <Typography variant="caption" fontWeight={700} fontFamily="monospace">{r.path_trust.toFixed(2)}</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>{r.latency?.toFixed(0)}ms</TableCell>
                  <TableCell>
                    {r.reconfigured
                      ? <Chip size="small" icon={<AutorenewIcon sx={{ fontSize: '14px !important' }} />} label="Rerouted" sx={{ bgcolor: alpha(WARN, 0.15), color: WARN }} />
                      : <Chip size="small" label="Stable" sx={{ bgcolor: alpha(ACCENT2, 0.15), color: ACCENT2 }} />}
                  </TableCell>
                </TableRow>
              ))}
              {routes.length === 0 && <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary', borderColor: grid }}>No routes found.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {routes.some(r => r.reconfigured && r.reason) && (
        <Card sx={{ p: 2, mt: 2 }}>
          <Typography variant="subtitle2" fontWeight={800} mb={1}>Reconfiguration Log</Typography>
          <Stack spacing={0.6}>
            {routes.filter(r => r.reconfigured && r.reason).map(r => (
              <Typography key={r.id} variant="caption" color="text.secondary">
                <b style={{ color: theme.palette.warning.main }}>{r.src_uid} → {r.dst_uid}</b> — {r.reason}
              </Typography>
            ))}
          </Stack>
        </Card>
      )}
    </Box>
  );
}
