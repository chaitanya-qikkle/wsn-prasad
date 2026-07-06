import React, { useState } from 'react';
import {
  Box, Card, Typography, Stack, Grid, Button, TextField, Switch, FormControlLabel,
  Alert, Slider, MenuItem, Chip, useTheme, alpha, ToggleButtonGroup, ToggleButton,
} from '@mui/material';
import SettingsIcon      from '@mui/icons-material/Settings';
import VerifiedUserIcon  from '@mui/icons-material/VerifiedUser';
import LinkIcon          from '@mui/icons-material/Link';
import ScienceIcon       from '@mui/icons-material/Science';
import PaletteIcon       from '@mui/icons-material/Palette';
import BoltIcon          from '@mui/icons-material/Bolt';
import HealingIcon       from '@mui/icons-material/Healing';
import RestartAltIcon    from '@mui/icons-material/RestartAlt';
import { useThemeMode } from '../context/ThemeContext';
import { useSim } from '../sim/SimContext';
import { PageHeader } from '../utils/ui';
import { ACCENT, ACCENT2, DANGER } from '../context/ThemeContext';

function Section({ icon, title, children }) {
  const theme = useTheme();
  return (
    <Card sx={{ p: 3, mb: 2.5 }}>
      <Stack direction="row" spacing={1.5} alignItems="center" mb={2.5}>
        <Box sx={{ color: theme.palette.primary.main }}>{icon}</Box>
        <Typography variant="subtitle1" fontWeight={800}>{title}</Typography>
      </Stack>
      {children}
    </Card>
  );
}

const SPEEDS = [{ ms: 3500, l: '0.5x' }, { ms: 2000, l: '1x' }, { ms: 1000, l: '2x' }, { ms: 500, l: '4x' }];

export default function SettingsPage() {
  const theme = useTheme();
  const { mode, toggleMode } = useThemeMode();
  const sim = useSim();
  const [saved, setSaved] = useState('');
  const [nodeCount, setNodeCount] = useState(sim.nodes.length);
  const [cfg, setCfg] = useState({
    routingMode: 'Trust-Aware AODV',
    trustThreshold: 40,
    blockchainTrigger: 'Event-Driven',
    consensus: 'Lightweight PoW',
    ledgerRetention: '90',
    isolationAuto: true, rerouteAuto: true, adaptiveThreshold: true, twoFA: false,
  });
  const update = (k, v) => setCfg(p => ({ ...p, [k]: v }));
  const save = () => { setSaved('Settings saved successfully'); setTimeout(() => setSaved(''), 3500); };
  const applyReset = () => { sim.reset({ nodes: Number(nodeCount) || 24, malicious: 0 }); setSaved(`Network rebuilt with ${nodeCount} clean nodes`); setTimeout(() => setSaved(''), 3500); };

  return (
    <Box>
      <PageHeader icon={<SettingsIcon />} title="Settings"
        subtitle="Control the live simulation, routing, trust engine and blockchain"
        action={<Button variant="contained" onClick={save} sx={{ fontWeight: 800 }}>Save Changes</Button>} />

      {saved && <Alert severity="success" sx={{ mb: 2.5 }} onClose={() => setSaved('')}>{saved}</Alert>}

      <Grid container spacing={0}>
        <Grid item xs={12} lg={7} sx={{ pr: { lg: 2.5 } }}>
          <Section icon={<ScienceIcon />} title="Live Simulation">
            <Grid container spacing={2.5} alignItems="center">
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary" mb={1}>Tick speed</Typography>
                <ToggleButtonGroup exclusive size="small" value={sim.interval} onChange={(_, v) => v && sim.setSpeed(v)}>
                  {SPEEDS.map(s => <ToggleButton key={s.ms} value={s.ms}>{s.l}</ToggleButton>)}
                </ToggleButtonGroup>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth size="small" label="Deployed Nodes" type="number" value={nodeCount}
                  onChange={e => setNodeCount(e.target.value)} inputProps={{ min: 8, max: 60 }} />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel control={<Switch checked={sim.autoAttack} onChange={e => sim.setAutoAttack(e.target.checked)} />}
                  label={<Box><Typography variant="body2" fontWeight={600}>Auto-attack mode</Typography>
                    <Typography variant="caption" color="text.secondary">Periodically inject random attacks so the network is never idle</Typography></Box>} />
              </Grid>
              <Grid item xs={12}>
                <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                  <Button variant="outlined" startIcon={<BoltIcon />} onClick={() => { const c = sim.nodes.filter(n => n.role !== 'Sink' && !n.is_malicious && !n.is_isolated); if (c.length) sim.inject(c[0].node_uid, 'Blackhole'); }}
                    sx={{ borderColor: alpha(DANGER, 0.5), color: DANGER }}>Inject Sample Attack</Button>
                  <Button variant="outlined" startIcon={<HealingIcon />} onClick={() => sim.recoverAll()} sx={{ borderColor: alpha(ACCENT2, 0.5), color: ACCENT2 }}>Recover All</Button>
                  <Button variant="outlined" startIcon={<RestartAltIcon />} onClick={applyReset} sx={{ borderColor: alpha(ACCENT, 0.5), color: ACCENT }}>Rebuild Network</Button>
                </Stack>
              </Grid>
            </Grid>
          </Section>

          <Section icon={<VerifiedUserIcon />} title="Routing & Trust Engine">
            <Grid container spacing={2.5}>
              <Grid item xs={12} sm={6}>
                <TextField select fullWidth size="small" label="Routing Protocol" value={cfg.routingMode} onChange={e => update('routingMode', e.target.value)}>
                  {['Trust-Aware AODV', 'Plain AODV', 'Energy-Aware Hybrid'].map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField select fullWidth size="small" label="Consensus" value={cfg.consensus} onChange={e => update('consensus', e.target.value)}>
                  {['Lightweight PoW', 'PoA', 'PBFT'].map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary" mb={1}>
                  Trust Isolation Threshold: <strong style={{ color: theme.palette.primary.main }}>{(cfg.trustThreshold / 100).toFixed(2)}</strong>
                </Typography>
                <Slider value={cfg.trustThreshold} onChange={(_, v) => update('trustThreshold', v)} min={10} max={70} step={1} />
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="caption" color="text.secondary">Lenient (0.10)</Typography>
                  <Typography variant="caption" color="text.secondary">Strict (0.70)</Typography>
                </Stack>
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel control={<Switch checked={cfg.adaptiveThreshold} onChange={e => update('adaptiveThreshold', e.target.checked)} />}
                  label={<Box><Typography variant="body2" fontWeight={600}>Adaptive Trust Threshold</Typography><Typography variant="caption" color="text.secondary">Auto-tune threshold to network conditions</Typography></Box>} />
              </Grid>
            </Grid>
          </Section>
        </Grid>

        <Grid item xs={12} lg={5}>
          <Section icon={<VerifiedUserIcon />} title="Automated Mitigation">
            <Stack spacing={2}>
              <FormControlLabel control={<Switch checked={cfg.isolationAuto} onChange={e => update('isolationAuto', e.target.checked)} />}
                label={<Box><Typography variant="body2" fontWeight={600}>Auto-Isolate Malicious Nodes</Typography><Typography variant="caption" color="text.secondary">Quarantine nodes below trust threshold</Typography></Box>} />
              <FormControlLabel control={<Switch checked={cfg.rerouteAuto} onChange={e => update('rerouteAuto', e.target.checked)} />}
                label={<Box><Typography variant="body2" fontWeight={600}>Dynamic Route Reconfiguration</Typography><Typography variant="caption" color="text.secondary">Rebuild paths to avoid compromised nodes</Typography></Box>} />
            </Stack>
          </Section>

          <Section icon={<LinkIcon />} title="Blockchain Configuration">
            <Stack spacing={2.5}>
              <TextField select fullWidth size="small" label="Trigger Mode" value={cfg.blockchainTrigger} onChange={e => update('blockchainTrigger', e.target.value)}>
                {['Event-Driven', 'Periodic', 'Continuous'].map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
              </TextField>
              <TextField fullWidth size="small" label="Ledger Retention (days)" type="number" value={cfg.ledgerRetention} onChange={e => update('ledgerRetention', e.target.value)} />
            </Stack>
          </Section>

          <Section icon={<PaletteIcon />} title="Appearance">
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="body2" fontWeight={600}>Dark Mode</Typography>
                <Typography variant="caption" color="text.secondary">Toggle dark / light interface</Typography>
              </Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip label={mode === 'dark' ? 'Dark' : 'Light'} size="small" color="primary" variant="outlined" />
                <Switch checked={mode === 'dark'} onChange={toggleMode} />
              </Stack>
            </Stack>
          </Section>

          <Section icon={<VerifiedUserIcon />} title="Account Security">
            <FormControlLabel control={<Switch checked={cfg.twoFA} onChange={e => update('twoFA', e.target.checked)} />}
              label={<Box><Typography variant="body2" fontWeight={600}>Two-Factor Authentication</Typography><Typography variant="caption" color="text.secondary">Add extra login security via TOTP</Typography></Box>} />
          </Section>
        </Grid>
      </Grid>
    </Box>
  );
}
