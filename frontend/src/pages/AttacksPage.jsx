import React, { useState, useMemo } from 'react';
import {
  Box, Stack, Chip, useTheme, alpha, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, MenuItem, InputAdornment, TablePagination, Card,
  Collapse, IconButton, Typography, Grid, Divider,
} from '@mui/material';
import GppMaybeIcon  from '@mui/icons-material/GppMaybe';
import SearchIcon    from '@mui/icons-material/Search';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon   from '@mui/icons-material/KeyboardArrowUp';
import LinkIcon      from '@mui/icons-material/Link';
import ReportIcon    from '@mui/icons-material/Report';
import BlockIcon     from '@mui/icons-material/Block';
import HealingIcon   from '@mui/icons-material/Healing';
import { useSim } from '../sim/SimContext';
import { PageHeader, StatCard, LiveDot, ATTACK_COLORS, SEVERITY_COLORS, STATUS_COLORS } from '../utils/ui';
import { ACCENT, DANGER, WARN, ACCENT2 } from '../context/ThemeContext';

const ATTACK_TYPES = ['All', 'Blackhole', 'Sybil', 'Wormhole'];
const SEVERITIES   = ['All', 'Critical', 'High', 'Low'];
const STATUSES     = ['All', 'Detected', 'Isolated'];

export default function AttacksPage() {
  const theme = useTheme();
  const grid = theme.palette.divider;
  const sim = useSim();
  const [filters, setFilters] = useState({ attackType: 'All', severity: 'All', status: 'All', search: '' });
  const [page, setPage] = useState(0);
  const [rpp, setRpp] = useState(10);
  const [expanded, setExpanded] = useState(null);

  const all = sim.attacks;
  const filtered = useMemo(() => all.filter(a => {
    if (filters.attackType !== 'All' && a.attack_type !== filters.attackType) return false;
    if (filters.severity !== 'All' && a.severity !== filters.severity) return false;
    if (filters.status !== 'All' && a.status !== filters.status) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      if (!a.node_uid.toLowerCase().includes(q) && !a.attack_type.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [all, filters]);

  const total = filtered.length;
  const items = filtered.slice(page * rpp, page * rpp + rpp);
  const set = (k) => (e) => { setFilters(f => ({ ...f, [k]: e.target.value })); setPage(0); };

  const critical  = all.filter(a => a.severity === 'Critical').length;
  const isolated  = all.filter(a => a.status === 'Isolated').length;
  const detected  = all.filter(a => a.status === 'Detected').length;

  return (
    <Box>
      <PageHeader icon={<GppMaybeIcon />} title="Attack Detection" accent={WARN}
        subtitle="Trust-flagged events — each detection seals an on-chain block (event-driven)"
        action={<Stack direction="row" spacing={1} alignItems="center"><LiveDot color={WARN} /><Typography variant="caption" fontWeight={800} color={WARN} letterSpacing={1}>LIVE FEED</Typography></Stack>} />

      <Grid container spacing={2.5} mb={2.5}>
        <Grid item xs={6} md={3}><StatCard icon={<ReportIcon />} label="Total Detections" value={total} color={ACCENT} sub="matching filters" /></Grid>
        <Grid item xs={6} md={3}><StatCard icon={<GppMaybeIcon />} label="Critical" value={critical} color={DANGER} sub="Blackhole / Wormhole" /></Grid>
        <Grid item xs={6} md={3}><StatCard icon={<BlockIcon />} label="Isolated" value={isolated} color={WARN} sub="quarantined" /></Grid>
        <Grid item xs={6} md={3}><StatCard icon={<HealingIcon />} label="Monitored" value={detected} color={ACCENT2} sub="penalized, watched" /></Grid>
      </Grid>

      <Card sx={{ p: 2, mb: 2.5, boxShadow: 'none' }}>
        <Grid container spacing={1.5}>
          <Grid item xs={12} md={4}>
            <TextField fullWidth size="small" placeholder="Search node or type…" value={filters.search} onChange={set('search')}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }} />
          </Grid>
          <Grid item xs={4} md={2.66}>
            <TextField select fullWidth size="small" label="Attack" value={filters.attackType} onChange={set('attackType')}>
              {ATTACK_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={4} md={2.66}>
            <TextField select fullWidth size="small" label="Severity" value={filters.severity} onChange={set('severity')}>
              {SEVERITIES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={4} md={2.66}>
            <TextField select fullWidth size="small" label="Status" value={filters.status} onChange={set('status')}>
              {STATUSES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </TextField>
          </Grid>
        </Grid>
      </Card>

      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ '& th': { fontWeight: 700, color: 'text.secondary', borderColor: grid, fontSize: 11.5,
                textTransform: 'uppercase', letterSpacing: 0.4, py: 1.4 } }}>
                <TableCell width={40} />
                <TableCell>Time</TableCell><TableCell>Node</TableCell><TableCell>Attack</TableCell>
                <TableCell>Severity</TableCell><TableCell>Confidence</TableCell><TableCell>Status</TableCell><TableCell align="center">Block</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map(a => (
                <React.Fragment key={a.id}>
                  <TableRow hover sx={{ '& td': { borderColor: grid, py: 1.1 } }}>
                    <TableCell><IconButton size="small" onClick={() => setExpanded(expanded === a.id ? null : a.id)}>
                      {expanded === a.id ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}</IconButton></TableCell>
                    <TableCell><Typography variant="caption" color="text.secondary">{new Date(a.timestamp).toLocaleTimeString()}</Typography></TableCell>
                    <TableCell><Typography variant="body2" fontWeight={700} fontFamily="'JetBrains Mono', monospace">{a.node_uid}</Typography></TableCell>
                    <TableCell><Chip size="small" label={a.attack_type} sx={{ bgcolor: alpha(ATTACK_COLORS[a.attack_type] || '#38bdf8', 0.14), color: ATTACK_COLORS[a.attack_type] || '#38bdf8', fontWeight: 700 }} /></TableCell>
                    <TableCell><Chip size="small" variant="outlined" label={a.severity} sx={{ borderColor: SEVERITY_COLORS[a.severity], color: SEVERITY_COLORS[a.severity], fontWeight: 600 }} /></TableCell>
                    <TableCell><Typography variant="body2" fontWeight={700} fontFamily="'JetBrains Mono', monospace">{(a.confidence * 100).toFixed(0)}%</Typography></TableCell>
                    <TableCell><Chip size="small" label={a.status} sx={{ bgcolor: alpha(STATUS_COLORS[a.status] || '#94a3b8', 0.14), color: STATUS_COLORS[a.status] || '#94a3b8', fontWeight: 600 }} /></TableCell>
                    <TableCell align="center"><Stack direction="row" spacing={0.5} justifyContent="center" alignItems="center">
                      <LinkIcon fontSize="small" sx={{ color: theme.palette.primary.main }} />
                      <Typography variant="caption" fontFamily="'JetBrains Mono', monospace" color="text.secondary">#{a.block_index}</Typography>
                    </Stack></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={8} sx={{ py: 0, borderColor: grid }}>
                      <Collapse in={expanded === a.id} unmountOnExit>
                        <Box py={2.5} px={1.5} sx={{ background: alpha(theme.palette.primary.main, 0.03), borderRadius: 2 }}>
                          <Grid container spacing={2.5}>
                            <Detail label="Trust before → after" value={`${a.trust_before?.toFixed(3)} → ${a.trust_after?.toFixed(3)}`} />
                            <Detail label="Packet drop ratio" value={`${(a.drop_ratio * 100)?.toFixed(1)}%`} />
                            <Detail label="Delay anomaly (σ)" value={a.delay_anomaly?.toFixed(2)} />
                            <Detail label="Identity anomaly (Sybil)" value={a.identity_flag ? 'Yes' : 'No'} />
                            <Divider sx={{ width: '100%', borderColor: grid, my: 0.5 }} />
                            <Detail label="Mitigation" value={a.mitigation} full />
                          </Grid>
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              ))}
              {items.length === 0 && (
                <TableRow><TableCell colSpan={8} align="center" sx={{ py: 5, color: 'text.secondary', borderColor: grid }}>
                  No detections match your filters — inject an attack from the Attack Lab.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination component="div" count={total} page={page} onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rpp} onRowsPerPageChange={(e) => { setRpp(parseInt(e.target.value, 10)); setPage(0); }}
          rowsPerPageOptions={[10, 25, 50]} sx={{ borderTop: `1px solid ${grid}` }} />
      </Card>
    </Box>
  );
}

function Detail({ label, value, full }) {
  return (
    <Grid item xs={12} sm={full ? 12 : 3}>
      <Typography variant="caption" color="text.secondary" textTransform="uppercase" letterSpacing={0.5} fontSize={10} fontWeight={700}>{label}</Typography>
      <Typography variant="body2" fontWeight={600} mt={0.3}>{value ?? '—'}</Typography>
    </Grid>
  );
}
