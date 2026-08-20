import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Chip, Stack, Grid, alpha, keyframes } from '@mui/material';
import SensorsIcon       from '@mui/icons-material/Sensors';
import ArrowForwardIcon  from '@mui/icons-material/ArrowForward';
import LinkIcon          from '@mui/icons-material/Link';
import VerifiedUserIcon  from '@mui/icons-material/VerifiedUser';
import BoltIcon          from '@mui/icons-material/Bolt';
import HealingIcon       from '@mui/icons-material/Healing';
import { ACCENT, ACCENT2, DANGER, GOLD, BG_DARK, PANEL_DARK, LINE_DARK } from '../context/ThemeContext';

/*  Landing page. Deliberately painted with the console's own dark palette
 *  rather than the MUI theme: this is the front door, and it should look like
 *  the operations room behind it regardless of which mode the visitor's
 *  console toggle happens to be on.                                          */

const T1 = '#e6edf7';
const T2 = 'rgba(148,171,207,0.72)';
const T3 = 'rgba(148,171,207,0.48)';
const BRAND = '#22d3ee';   // vivid cyan — safe here because the surface is always dark

const fadeUp = keyframes`from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); }`;
const dash  = keyframes`to { stroke-dashoffset: -40; }`;

// A small decorative WSN graph for the right panel.
const GRAPH_NODES = [
  { id: 'sink', x: 50, y: 50, r: 14, sink: true },
  { id: 'a', x: 20, y: 22, r: 8 }, { id: 'b', x: 80, y: 20, r: 8 },
  { id: 'c', x: 16, y: 78, r: 8 }, { id: 'd', x: 84, y: 76, r: 8 },
  { id: 'e', x: 50, y: 14, r: 7 }, { id: 'f', x: 50, y: 86, r: 7, bad: true },
  { id: 'g', x: 30, y: 50, r: 6 }, { id: 'h', x: 72, y: 50, r: 6, healing: true },
];
const GRAPH_EDGES = [['a','g'],['g','sink'],['e','sink'],['b','h'],['h','sink'],['c','g'],['d','h'],['f','sink']];

export default function SplashPage() {
  const navigate = useNavigate();
  const [time, setTime] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);
  const nm = Object.fromEntries(GRAPH_NODES.map(n => [n.id, n]));

  return (
    <Box sx={{ minHeight: '100vh', color: T1, position: 'relative', overflow: 'hidden',
      background: BG_DARK,
      backgroundImage: `radial-gradient(1100px 560px at 12% -12%, ${alpha(BRAND, 0.10)}, transparent 60%),
                        radial-gradient(900px 480px at 100% 0%, ${alpha(GOLD, 0.09)}, transparent 55%)` }}>

      {/* top bar */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        px: { xs: 2, md: 6 }, py: 2.2, position: 'relative', zIndex: 2,
        borderBottom: `1px solid ${LINE_DARK}`, background: alpha(PANEL_DARK, 0.7),
        backdropFilter: 'blur(8px)' }}>
        <Stack direction="row" spacing={1.4} alignItems="center">
          <Box sx={{ width: 34, height: 34, borderRadius: '9px', background: ACCENT,
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <SensorsIcon sx={{ fontSize: 18, color: '#fff' }} />
          </Box>
          <Typography fontWeight={700} sx={{ color: T1, letterSpacing: 1 }}>TRUSTCHAIN-WSN</Typography>
        </Stack>
        <Stack direction="row" spacing={2} alignItems="center">
          <Typography variant="caption" color={BRAND} fontFamily="monospace" sx={{ display: { xs: 'none', sm: 'block' } }}>
            {time.toLocaleTimeString()}
          </Typography>
          <Button variant="outlined" size="small" onClick={() => navigate('/login')}
            sx={{ borderColor: alpha(BRAND, 0.4), color: BRAND,
              '&:hover': { borderColor: BRAND, background: alpha(BRAND, 0.08) } }}>
            Sign In
          </Button>
        </Stack>
      </Box>

      {/* split hero */}
      <Grid container sx={{ position: 'relative', zIndex: 1, minHeight: 'calc(100vh - 69px)' }} alignItems="center">
        {/* LEFT — content */}
        <Grid item xs={12} md={6.5} sx={{ px: { xs: 3, md: 8 }, py: { xs: 5, md: 0 } }}>
          <Stack spacing={2.5} sx={{ animation: `${fadeUp} 0.7s ease both` }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box component="img" src="/college-logo.png" alt="College"
                sx={{ width: 46, height: 46, borderRadius: '50%', border: `1px solid ${alpha(BRAND, 0.3)}`, objectFit: 'cover' }} />
              <Box>
                <Typography fontSize="0.78rem" fontWeight={700} color={T1}>Pillai HOC College of Engineering and Technology</Typography>
                <Typography fontSize="0.6rem" letterSpacing={2} color={T3}>DEPARTMENT OF MCA · 2025–26</Typography>
              </Box>
            </Stack>

            <Chip label="FINAL YEAR PROJECT · MCA" size="small"
              icon={<VerifiedUserIcon sx={{ fontSize: '14px !important', color: `${BRAND} !important` }} />}
              sx={{ alignSelf: 'flex-start', background: alpha(BRAND, 0.1),
                border: `1px solid ${alpha(BRAND, 0.28)}`, color: BRAND, fontWeight: 700,
                fontSize: '0.6rem', letterSpacing: 1 }} />

            <Typography variant="h2" fontWeight={700} sx={{ fontSize: { xs: '2.2rem', md: '3.1rem' }, lineHeight: 1.1, color: T1 }}>
              Detect, Isolate,<br />
              <Box component="span" sx={{ color: BRAND }}>Recover — Automatically.</Box>
            </Typography>

            <Typography sx={{ color: T2, maxWidth: 540, fontSize: '0.95rem', lineHeight: 1.75 }}>
              An <b style={{ color: BRAND }}>event-driven lightweight blockchain</b> with trust-aware AODV routing.
              Blackhole, Sybil, wormhole and grayhole attacks are detected, quarantined and sealed on-chain — then
              the trust engine scrubs the node and puts it back into service on its own, with the whole cycle timed
              so it can be measured against a system without one.
            </Typography>

            <Stack direction="row" spacing={1.2} flexWrap="wrap" useFlexGap>
              {[
                { icon: <BoltIcon sx={{ fontSize: 14 }} />, label: 'Event-Driven Chain', c: BRAND },
                { icon: <VerifiedUserIcon sx={{ fontSize: 14 }} />, label: 'Trust-Aware AODV', c: GOLD },
                { icon: <HealingIcon sx={{ fontSize: 14 }} />, label: 'Automatic Recovery', c: ACCENT2 },
                { icon: <LinkIcon sx={{ fontSize: 14 }} />, label: 'Multi-Attack Defense', c: ACCENT },
              ].map(p => (
                <Stack key={p.label} direction="row" spacing={0.7} alignItems="center"
                  sx={{ px: 1.6, py: 0.7, borderRadius: 5, background: alpha(p.c, 0.09),
                    border: `1px solid ${alpha(p.c, 0.25)}`, color: p.c }}>
                  {p.icon}<Typography fontSize="0.72rem" fontWeight={600} color={T2}>{p.label}</Typography>
                </Stack>
              ))}
            </Stack>

            <Stack direction="row" spacing={2} pt={1}>
              <Button variant="contained" size="large" endIcon={<ArrowForwardIcon />} onClick={() => navigate('/login')}
                sx={{ background: BRAND, color: '#03212b', fontWeight: 800, letterSpacing: 0.4, px: 4, py: 1.3,
                  borderRadius: 1.5, '&:hover': { background: '#67e8f9' } }}>
                Enter Control Room
              </Button>
              <Button variant="outlined" size="large" onClick={() => navigate('/register')}
                sx={{ borderColor: LINE_DARK, color: T2, px: 4, py: 1.3, borderRadius: 1.5,
                  '&:hover': { borderColor: BRAND, color: BRAND, background: alpha(BRAND, 0.07) } }}>
                Create Account
              </Button>
            </Stack>

            <Stack direction="row" spacing={4} pt={2} flexWrap="wrap" useFlexGap>
              <Box>
                <Typography fontSize="0.58rem" letterSpacing={2} color={BRAND}>SUBMITTED BY</Typography>
                <Typography fontWeight={700} fontSize="0.85rem" color={T1}>Prasad Kathare · Pradnya Desai</Typography>
              </Box>
              <Box sx={{ borderLeft: `1px solid ${LINE_DARK}`, pl: 4 }}>
                <Typography fontSize="0.58rem" letterSpacing={2} color={BRAND}>GUIDE</Typography>
                <Typography fontWeight={700} fontSize="0.85rem" color={T1}>Prof. Jitesh Mhatre</Typography>
              </Box>
              <Box sx={{ borderLeft: `1px solid ${LINE_DARK}`, pl: 4 }}>
                <Typography fontSize="0.58rem" letterSpacing={2} color={BRAND}>HEAD OF DEPT.</Typography>
                <Typography fontWeight={700} fontSize="0.85rem" color={T1}>Prof. Abhijeet More</Typography>
              </Box>
            </Stack>
          </Stack>
        </Grid>

        {/* RIGHT — live network graphic */}
        <Grid item xs={12} md={5.5} sx={{ display: { xs: 'none', md: 'flex' }, justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
          <Box sx={{ width: 440, height: 440, position: 'relative' }}>
            <Box sx={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `1px solid ${alpha(BRAND, 0.16)}` }} />
            <Box sx={{ position: 'absolute', inset: '12%', borderRadius: '50%', border: `1px solid ${alpha(BRAND, 0.1)}` }} />
            <Box component="svg" viewBox="0 0 100 100" sx={{ width: '100%', height: '100%' }}>
              {GRAPH_EDGES.map(([a, b], i) => {
                const bad = nm[a].bad || nm[b].bad;
                return <line key={i} x1={nm[a].x} y1={nm[a].y} x2={nm[b].x} y2={nm[b].y}
                  stroke={bad ? DANGER : ACCENT2} strokeOpacity={bad ? 0.75 : 0.55} strokeWidth={0.6}
                  strokeDasharray={bad ? '2 2' : '3 3'} style={{ animation: `${dash} 2s linear infinite` }} />;
              })}
              {GRAPH_NODES.map(n => (
                <g key={n.id}>
                  {n.sink && <circle cx={n.x} cy={n.y} r={n.r + 3} fill="none" stroke={BRAND} strokeWidth={0.5} strokeDasharray="2 2" />}
                  {n.healing && (
                    <circle cx={n.x} cy={n.y} r={n.r / 1.5} fill="none" stroke={BRAND} strokeWidth={0.5} opacity={0.8}>
                      <animate attributeName="r" values={`${n.r / 2};${n.r}`} dur="1.6s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.8;0" dur="1.6s" repeatCount="indefinite" />
                    </circle>
                  )}
                  <circle cx={n.x} cy={n.y} r={n.r / 2.2}
                    fill={n.bad ? DANGER : n.healing ? BRAND : n.sink ? BRAND : ACCENT2} opacity={0.92}>
                    {n.sink && <animate attributeName="opacity" values="0.6;1;0.6" dur="2s" repeatCount="indefinite" />}
                  </circle>
                </g>
              ))}
            </Box>
            <Box sx={{ position: 'absolute', bottom: 8, right: 8, px: 1.4, py: 0.6, borderRadius: 2,
              background: alpha(PANEL_DARK, 0.9), border: `1px solid ${LINE_DARK}` }}>
              <Typography fontSize="0.6rem" color={T2} fontFamily="monospace">
                <span style={{ color: DANGER }}>● </span>1 isolated ·
                <span style={{ color: BRAND }}> ● </span>1 recovering · chain sealed
              </Typography>
            </Box>
          </Box>
        </Grid>
      </Grid>

      <Box sx={{ borderTop: `1px solid ${LINE_DARK}`, py: 2.2, textAlign: 'center', position: 'relative',
        zIndex: 1, background: alpha(PANEL_DARK, 0.6) }}>
        <Typography variant="caption" color={T3}>
          © 2025 TrustChain-WSN · Pillai HOC College of Engineering and Technology · Final Year Project (MCA)
        </Typography>
      </Box>
    </Box>
  );
}
