import React, { useState, useMemo } from 'react';
import {
  Box, Grid, Typography, Stack, Chip, useTheme, alpha, Button, MenuItem,
  TextField, Alert, Snackbar, LinearProgress, Tooltip,
  Stepper, Step, StepLabel, StepContent,
} from '@mui/material';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
} from 'recharts';
import ScienceIcon      from '@mui/icons-material/Science';
import BugReportIcon    from '@mui/icons-material/BugReport';
import RestartAltIcon   from '@mui/icons-material/RestartAlt';
import HealingIcon      from '@mui/icons-material/Healing';
import BoltIcon         from '@mui/icons-material/Bolt';
import CheckCircleIcon  from '@mui/icons-material/CheckCircle';
import { useSim } from '../sim/SimContext';
import { PageHeader, Panel, LiveDot, useChartTip, ATTACK_COLORS, trustColor, popIn, pulse } from '../utils/ui';
import { ACCENT, ACCENT2, NEON, DANGER, WARN } from '../context/ThemeContext';
import { TRUST_THRESHOLD } from '../sim/constants';

const ATTACKS = [
  { key: 'Blackhole', desc: 'Drops ~95% of packets — critical', color: ATTACK_COLORS.Blackhole,
    how: 'A blackhole node advertises itself as the best route, then silently drops almost every packet it should forward. The trust engine catches it through an extreme packet-drop ratio.' },
  { key: 'Wormhole',  desc: 'Delay / topology anomaly', color: ATTACK_COLORS.Wormhole,
    how: 'Two colluding nodes tunnel traffic between distant points, distorting the network topology and route timing. It is flagged by an abnormal end-to-end delay anomaly.' },
  { key: 'Sybil',     desc: 'Fake identities — identity flag', color: ATTACK_COLORS.Sybil,
    how: 'A single node forges several fake identities to gain disproportionate influence over routing. The engine raises an identity-anomaly flag when it detects the spoofed IDs.' },
];

export default function SimulationPage() {
  const theme = useTheme();
  const grid = theme.palette.divider;
  const tip = useChartTip();
  const sim = useSim();

  const [attack, setAttack] = useState('Blackhole');
  const [target, setTarget] = useState('');
  const [focus, setFocus]   = useState('');   // node the guided walkthrough is following
  const [toast, setToast]   = useState(null);

  const byUid = useMemo(() => Object.fromEntries(sim.nodes.map(n => [n.node_uid, n])), [sim.nodes]);
  const nodes = sim.nodes.filter(n => n.role !== 'Sink');
  const cleanNodes = nodes.filter(n => !n.is_malicious && !n.is_isolated);
  const effectiveTarget = target || cleanNodes[0]?.node_uid || '';
  const attackMeta = ATTACKS.find(a => a.key === attack);

  const inject = () => {
    if (!effectiveTarget) { setToast({ sev: 'warning', text: 'No healthy node available to attack.' }); return; }
    sim.inject(effectiveTarget, attack);
    setFocus(effectiveTarget);
    setToast({ sev: 'success', text: `${attack} launched on ${effectiveTarget} — follow the walkthrough on the right.` });
    setTarget('');
  };

  const series = sim.metricsHist.slice(-24);
  const latest = series[series.length - 1] || {};

  // guided lifecycle for the focused node — follow it, or the latest detection
  const focusUid = focus || sim.attacks[0]?.node_uid || '';
  const fNode = byUid[focusUid];
  const fDet  = sim.attacks.find(a => a.node_uid === focusUid);
  const recovered = fNode && !fNode.is_malicious && !fNode.is_isolated && !!fDet;

  let activeStep;
  if (!focusUid || !fNode) activeStep = 0;
  else if (recovered) activeStep = 5;                                   // all done
  else if (fNode.is_isolated) activeStep = sim.stats.reroutedPaths > 0 ? 4 : 3;
  else if (fDet) activeStep = 2;
  else if (fNode.is_malicious) activeStep = 1;
  else activeStep = 0;

  const STEPS = [
    { label: 'Attack injected', color: DANGER,
      body: fNode ? `${focusUid} is now a ${fNode.attack || attack} attacker and starts misbehaving on the very next round.`
        : 'Pick an attack and a target, then press Inject — the walkthrough starts here.' },
    { label: 'Trust degrading', color: WARN,
      body: `Each evaluation round the trust engine penalises ${focusUid || 'the node'} for dropped packets, delay and identity anomalies. Its trust falls toward the isolation threshold (${TRUST_THRESHOLD.toFixed(2)}).`,
      extra: fNode && (
        <Box mt={1}>
          <Stack direction="row" justifyContent="space-between" mb={0.4}>
            <Typography variant="caption" color="text.secondary">live trust</Typography>
            <Typography variant="caption" fontWeight={700} fontFamily="'JetBrains Mono', monospace" sx={{ color: trustColor(fNode.trust_score) }}>{fNode.trust_score.toFixed(3)}</Typography>
          </Stack>
          <LinearProgress variant="determinate" value={fNode.trust_score * 100}
            sx={{ height: 6, borderRadius: 999, bgcolor: alpha(trustColor(fNode.trust_score), 0.15),
              '& .MuiLinearProgress-bar': { bgcolor: trustColor(fNode.trust_score) } }} />
        </Box>
      ) },
    { label: 'Anomaly detected', color: WARN,
      body: fDet ? `Detected as ${fDet.attack_type} (${fDet.severity}) with ${(fDet.confidence * 100).toFixed(0)}% confidence — drop ratio ${(fDet.drop_ratio * 100).toFixed(0)}%, delay σ ${fDet.delay_anomaly}.`
        : 'Once trust crosses the threshold, the behaviour is flagged as a confirmed detection.' },
    { label: 'Isolated & sealed on-chain', color: DANGER,
      body: fDet && fDet.block_index != null
        ? `${focusUid} is quarantined and the detection is sealed into event-driven block #${fDet.block_index}. This is the project's novelty — a block is minted only when an attack happens.`
        : 'The node is quarantined and a single blockchain block is sealed for tamper-proof provenance.' },
    { label: 'Rerouted & recovered', color: ACCENT2,
      body: `Trust-aware AODV rebuilds routes around ${focusUid || 'the isolated node'}. Packet delivery climbs back up — currently ${(latest.pdr ?? 0).toFixed(0)}%.` },
  ];

  return (
    <Box>
      <PageHeader icon={<ScienceIcon />} title="Attack Simulation Lab" accent={DANGER}
        subtitle="Trigger an attack yourself and watch a live, step-by-step walkthrough of detect → isolate → seal → recover"
        action={
          <Stack direction="row" spacing={1} alignItems="center">
            <LiveDot color={sim.running ? ACCENT2 : DANGER} />
            <Typography variant="caption" fontWeight={800} color={sim.running ? ACCENT2 : DANGER} letterSpacing={1}>
              {sim.running ? 'LIVE SIMULATOR' : 'PAUSED'}
            </Typography>
          </Stack>
        } />

      {!sim.running && (
        <Alert severity="info" sx={{ mb: 2, borderRadius: 3 }}>
          The simulation is paused — press <b>Play</b> in the top bar to resume live ticks so the walkthrough advances.
        </Alert>
      )}

      <Grid container spacing={2.5}>
        {/* CONTROL PANEL */}
        <Grid item xs={12} md={5}>
          <Panel accent={DANGER} title="Injection Console" sx={{ height: '100%' }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700} textTransform="uppercase" letterSpacing={0.6}>
              1 · Choose attack type
            </Typography>
            <Grid container spacing={1} mt={0.3} mb={1.5}>
              {ATTACKS.map(a => {
                const sel = attack === a.key;
                return (
                  <Grid item xs={4} key={a.key}>
                    <Box onClick={() => setAttack(a.key)}
                      sx={{ cursor: 'pointer', p: 1.2, borderRadius: 2.5, height: '100%', textAlign: 'center',
                        border: `1.5px solid ${sel ? a.color : grid}`,
                        background: sel ? alpha(a.color, 0.14) : 'transparent',
                        boxShadow: sel ? `0 0 18px ${alpha(a.color, 0.4)}` : 'none', transition: 'all .2s' }}>
                      <BugReportIcon sx={{ fontSize: 20, color: a.color }} />
                      <Typography variant="body2" fontWeight={800} sx={{ color: sel ? a.color : 'text.primary' }}>{a.key}</Typography>
                    </Box>
                  </Grid>
                );
              })}
            </Grid>

            {/* attack explainer — for talking the teacher through it */}
            <Box sx={{ p: 1.4, mb: 2.5, borderRadius: 2, background: alpha(attackMeta.color, 0.08), border: `1px solid ${alpha(attackMeta.color, 0.25)}` }}>
              <Typography variant="caption" fontWeight={800} sx={{ color: attackMeta.color }}>{attackMeta.key} — how it works</Typography>
              <Typography variant="caption" color="text.secondary" display="block" mt={0.4} lineHeight={1.5}>{attackMeta.how}</Typography>
            </Box>

            <Typography variant="caption" color="text.secondary" fontWeight={700} textTransform="uppercase" letterSpacing={0.6}>
              2 · Choose target node <Box component="span" sx={{ textTransform: 'none', fontWeight: 500 }}>(or click a green node below)</Box>
            </Typography>
            <TextField select fullWidth size="small" sx={{ mt: 0.8, mb: 2.5 }}
              value={effectiveTarget} onChange={e => setTarget(e.target.value)}
              helperText={cleanNodes.length ? `${cleanNodes.length} healthy nodes available` : 'no healthy nodes'}
              SelectProps={{ MenuProps: { PaperProps: { sx: { maxHeight: 320 } } } }}>
              {nodes.map(n => (
                <MenuItem key={n.node_uid} value={n.node_uid} disabled={n.is_malicious || n.is_isolated}>
                  <Stack direction="row" spacing={1} alignItems="center" width="100%">
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: trustColor(n.trust_score) }} />
                    <Typography variant="body2" fontFamily="'JetBrains Mono', monospace">{n.node_uid}</Typography>
                    <Typography variant="caption" color="text.secondary">{n.role}</Typography>
                    <Box flex={1} />
                    {(n.is_malicious || n.is_isolated) &&
                      <Chip size="small" label={n.is_isolated ? 'isolated' : 'infected'} sx={{ height: 18, fontSize: 9 }} />}
                  </Stack>
                </MenuItem>
              ))}
            </TextField>

            <Typography variant="caption" color="text.secondary" fontWeight={700} textTransform="uppercase" letterSpacing={0.6}>
              3 · Launch it
            </Typography>
            <Button fullWidth variant="contained" size="large" disabled={!effectiveTarget} onClick={inject} startIcon={<BoltIcon />}
              sx={{ mt: 0.8, py: 1.4, fontWeight: 800, letterSpacing: 0.6, borderRadius: 3,
                background: `linear-gradient(135deg, ${DANGER}, ${WARN})`, color: '#0a0a12',
                boxShadow: `0 10px 30px ${alpha(DANGER, 0.45)}`,
                '&:hover': { background: `linear-gradient(135deg, ${WARN}, ${DANGER})` } }}>
              Inject {attack} Attack — Live
            </Button>

            <Stack direction="row" spacing={1.2} mt={1.5}>
              <Button fullWidth variant="outlined" size="small" startIcon={<HealingIcon />}
                onClick={() => { sim.recoverAll(); setToast({ sev: 'success', text: 'Recovering all nodes…' }); }}
                sx={{ borderColor: alpha(ACCENT2, 0.5), color: ACCENT2 }}>Recover All</Button>
              <Button fullWidth variant="outlined" size="small" startIcon={<RestartAltIcon />}
                onClick={() => { sim.reset({ nodes: 24, malicious: 0 }); setFocus(''); setToast({ sev: 'info', text: 'Network reset — 24 clean nodes.' }); }}
                sx={{ borderColor: alpha(ACCENT, 0.5), color: ACCENT }}>Reset Network</Button>
            </Stack>

            <Stack direction="row" spacing={1} mt={2.5} justifyContent="space-around">
              <Stat label="Nodes" value={sim.stats.totalNodes} color={ACCENT} />
              <Stat label="Infected" value={sim.stats.maliciousActive} color={WARN} />
              <Stat label="Isolated" value={sim.stats.isolatedNodes} color={DANGER} />
            </Stack>
          </Panel>
        </Grid>

        {/* GUIDED WALKTHROUGH */}
        <Grid item xs={12} md={7}>
          <Panel accent={ACCENT} sx={{ height: '100%' }}
            title={<Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="subtitle1" fontWeight={800}>Attack Lifecycle — Guided Walkthrough</Typography><LiveDot color={ACCENT2} />
            </Stack>}
            action={focusUid && <Chip size="small" label={focusUid} sx={{ fontFamily: '"JetBrains Mono", monospace', fontWeight: 700, bgcolor: alpha(ACCENT, 0.14), color: ACCENT }} />}>

            {!focusUid ? (
              <Stack alignItems="center" py={5} spacing={1.2}>
                <ScienceIcon sx={{ fontSize: 40, color: ACCENT2 }} />
                <Typography variant="body2" color="text.secondary" textAlign="center" maxWidth={360}>
                  Inject an attack on the left. This panel then walks through every stage the framework performs — perfect for explaining the detect → prevent → recover flow live.
                </Typography>
              </Stack>
            ) : (
              <Stepper activeStep={activeStep} orientation="vertical"
                sx={{ '& .MuiStepConnector-line': { borderColor: grid }, '& .MuiStepLabel-label': { fontWeight: 700 } }}>
                {STEPS.map((s, i) => {
                  const done = activeStep > i;
                  const active = activeStep === i;
                  return (
                    <Step key={s.label} completed={done} expanded>
                      <StepLabel StepIconComponent={() => (
                        <Box sx={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          bgcolor: done ? alpha(ACCENT2, 0.2) : active ? alpha(s.color, 0.2) : alpha(theme.palette.text.primary, 0.08),
                          color: done ? ACCENT2 : active ? s.color : theme.palette.text.secondary,
                          border: `1.5px solid ${done ? ACCENT2 : active ? s.color : 'transparent'}`,
                          boxShadow: active ? `0 0 12px ${alpha(s.color, 0.6)}` : 'none',
                          animation: active ? `${pulse} 1.6s ease infinite` : 'none' }}>
                          {done ? <CheckCircleIcon sx={{ fontSize: 18 }} /> : <Typography fontWeight={800} fontSize={13}>{i + 1}</Typography>}
                        </Box>
                      )}>
                        <Typography sx={{ color: active ? s.color : done ? theme.palette.text.primary : theme.palette.text.secondary, fontWeight: 700 }}>{s.label}</Typography>
                      </StepLabel>
                      <StepContent>
                        <Typography variant="body2" color="text.secondary" lineHeight={1.5}>{s.body}</Typography>
                        {active && s.extra}
                      </StepContent>
                    </Step>
                  );
                })}
              </Stepper>
            )}

            {recovered && (
              <Alert icon={<CheckCircleIcon />} severity="success" sx={{ mt: 1, borderRadius: 2 }}>
                Threat neutralised — {focusUid} handled end-to-end: detected, isolated, sealed on-chain and routed around.
              </Alert>
            )}
          </Panel>
        </Grid>

        {/* LIVE PDR + DETECTIONS */}
        <Grid item xs={12} md={5}>
          <Panel accent={ACCENT} title="Live Delivery Ratio (reacts to attacks)"
            action={<Typography variant="h6" fontFamily="'JetBrains Mono', monospace"
              sx={{ color: (latest.pdr ?? 100) >= 80 ? ACCENT2 : DANGER }}>{(latest.pdr ?? 0).toFixed(0)}%</Typography>}>
            <Box height={150}>
              <ResponsiveContainer>
                <AreaChart data={series}>
                  <defs><linearGradient id="gSimPdr" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={ACCENT} stopOpacity={0.45} /><stop offset="100%" stopColor={ACCENT} stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="2 4" stroke={grid} />
                  <XAxis dataKey="time" stroke={theme.palette.text.secondary} fontSize={10} minTickGap={30} />
                  <YAxis domain={[0, 100]} stroke={theme.palette.text.secondary} fontSize={10} width={28} />
                  <RTooltip contentStyle={tip} />
                  <Area type="monotone" dataKey="pdr" stroke={ACCENT} strokeWidth={2.5} fill="url(#gSimPdr)" name="PDR %" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </Box>
          </Panel>
        </Grid>

        <Grid item xs={12} md={7}>
          <Panel accent={ACCENT2} sx={{ height: '100%' }}
            title={<Stack direction="row" spacing={1} alignItems="center"><Typography variant="subtitle1" fontWeight={800}>Live Detections</Typography><LiveDot color={ACCENT2} /></Stack>}
            action={<Chip size="small" label="realtime" variant="outlined" sx={{ height: 22, borderColor: alpha(ACCENT2, 0.4), color: ACCENT2 }} />}>
            <Stack spacing={1} sx={{ maxHeight: 180, overflowY: 'auto', pr: 0.5 }}>
              {sim.attacks.slice(0, 10).map((a, i) => (
                <Stack key={a.id} direction="row" alignItems="center" spacing={1.3}
                  sx={{ p: 1.1, borderRadius: 2, cursor: 'pointer', background: alpha(ATTACK_COLORS[a.attack_type] || NEON, 0.08),
                    border: `1px solid ${alpha(ATTACK_COLORS[a.attack_type] || NEON, focusUid === a.node_uid ? 0.6 : 0.25)}`,
                    animation: i === 0 ? `${popIn} .4s ease` : 'none' }}
                  onClick={() => setFocus(a.node_uid)}>
                  <BugReportIcon sx={{ color: ATTACK_COLORS[a.attack_type] || NEON, fontSize: 20 }} />
                  <Box flex={1} minWidth={0}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="body2" fontWeight={800} fontFamily="'JetBrains Mono', monospace">{a.node_uid}</Typography>
                      <Typography variant="body2" fontWeight={700} sx={{ color: ATTACK_COLORS[a.attack_type] || NEON }}>{a.attack_type}</Typography>
                    </Stack>
                    <Typography variant="caption" color="text.secondary">trust {a.trust_before?.toFixed(2)} → {a.trust_after?.toFixed(2)} · block #{a.block_index}</Typography>
                  </Box>
                  <Chip size="small" label={a.status} sx={{ height: 20, fontWeight: 700,
                    bgcolor: alpha(a.status === 'Isolated' ? DANGER : WARN, 0.16), color: a.status === 'Isolated' ? DANGER : WARN }} />
                </Stack>
              ))}
              {sim.attacks.length === 0 && (
                <Stack alignItems="center" py={3} spacing={1}>
                  <Typography variant="body2" color="text.secondary" textAlign="center">Detections appear here in real time — click one to follow it in the walkthrough.</Typography>
                </Stack>
              )}
            </Stack>
          </Panel>
        </Grid>

        {/* LIVE NODE GRID — click a healthy node to target it */}
        <Grid item xs={12}>
          <Panel title="Field Nodes — click a node to target it, then Inject">
            <Box sx={{ display: 'grid', gap: 1.2,
              gridTemplateColumns: { xs: 'repeat(3,1fr)', sm: 'repeat(6,1fr)', md: 'repeat(8,1fr)', lg: 'repeat(12,1fr)' } }}>
              {sim.nodes.map(n => {
                const c = n.is_isolated ? DANGER : trustColor(n.trust_score);
                const hot = n.is_malicious || n.is_isolated;
                const selectable = n.role !== 'Sink' && !hot;
                const isTarget = effectiveTarget === n.node_uid;
                return (
                  <Tooltip key={n.node_uid} arrow
                    title={`${n.node_uid} · ${n.role} · trust ${n.trust_score?.toFixed(2)}${n.is_isolated ? ' · ISOLATED' : n.is_malicious ? ` · ${n.attack}` : selectable ? ' · click to target' : ''}`}>
                    <Box onClick={() => selectable && setTarget(n.node_uid)}
                      sx={{ p: 1, borderRadius: 2, textAlign: 'center', position: 'relative', cursor: selectable ? 'pointer' : 'default',
                        border: `1.5px solid ${isTarget ? ACCENT : alpha(c, 0.5)}`, background: alpha(isTarget ? ACCENT : c, 0.1),
                        boxShadow: hot ? `0 0 12px ${alpha(c, 0.6)}` : isTarget ? `0 0 12px ${alpha(ACCENT, 0.6)}` : 'none', transition: 'all .3s' }}>
                      {hot && <Box sx={{ position: 'absolute', top: 3, right: 3, width: 7, height: 7, borderRadius: '50%', bgcolor: c, animation: `${pulse} 1s infinite` }} />}
                      <Typography variant="caption" fontWeight={800} fontFamily="'JetBrains Mono', monospace" display="block" fontSize={11}>{n.node_uid}</Typography>
                      <Typography sx={{ color: c, fontWeight: 800, fontSize: 13, fontFamily: '"JetBrains Mono", monospace' }}>{n.trust_score?.toFixed(2)}</Typography>
                      <LinearProgress variant="determinate" value={n.trust_score * 100}
                        sx={{ mt: 0.4, height: 4, borderRadius: 999, bgcolor: alpha(c, 0.2), '& .MuiLinearProgress-bar': { bgcolor: c } }} />
                    </Box>
                  </Tooltip>
                );
              })}
            </Box>
            <Stack direction="row" spacing={2} mt={2} flexWrap="wrap">
              <Legend c={ACCENT2} t="Trusted (≥0.70)" /><Legend c="#ffd54a" t="Suspect (0.40–0.70)" /><Legend c={DANGER} t="Rogue / Isolated (<0.40)" />
            </Stack>
          </Panel>
        </Grid>
      </Grid>

      <Snackbar open={!!toast} autoHideDuration={4000} onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={toast?.sev || 'info'} variant="filled" onClose={() => setToast(null)} sx={{ borderRadius: 3 }}>{toast?.text}</Alert>
      </Snackbar>
    </Box>
  );
}

function Stat({ label, value, color }) {
  return (
    <Box textAlign="center">
      <Typography sx={{ color, fontFamily: '"JetBrains Mono", monospace', fontWeight: 800, fontSize: 24 }}>{value}</Typography>
      <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase" letterSpacing={0.5} fontSize={9.5}>{label}</Typography>
    </Box>
  );
}
function Legend({ c, t }) {
  return (
    <Stack direction="row" spacing={0.6} alignItems="center">
      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: c, boxShadow: `0 0 8px ${c}` }} />
      <Typography variant="caption" color="text.secondary">{t}</Typography>
    </Stack>
  );
}
