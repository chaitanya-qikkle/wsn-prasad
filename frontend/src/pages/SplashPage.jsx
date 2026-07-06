import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Chip, Stack, Grid, keyframes } from '@mui/material';
import SensorsIcon       from '@mui/icons-material/Sensors';
import ArrowForwardIcon  from '@mui/icons-material/ArrowForward';
import LinkIcon          from '@mui/icons-material/Link';
import VerifiedUserIcon  from '@mui/icons-material/VerifiedUser';
import BoltIcon          from '@mui/icons-material/Bolt';
import { ACCENT, ACCENT2 } from '../context/ThemeContext';

const pulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(245,165,36,0.5); }
  70% { box-shadow: 0 0 0 18px rgba(245,165,36,0); }
  100% { box-shadow: 0 0 0 0 rgba(245,165,36,0); }
`;
const fadeUp = keyframes`from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); }`;
const drift = keyframes`0%,100% { transform: translate(0,0); } 50% { transform: translate(6px,-8px); }`;
const dash  = keyframes`to { stroke-dashoffset: -40; }`;

// A small decorative WSN graph for the right panel.
const GRAPH_NODES = [
  { id: 'sink', x: 50, y: 50, r: 14, sink: true },
  { id: 'a', x: 20, y: 22, r: 8 }, { id: 'b', x: 80, y: 20, r: 8 },
  { id: 'c', x: 16, y: 78, r: 8 }, { id: 'd', x: 84, y: 76, r: 8 },
  { id: 'e', x: 50, y: 14, r: 7 }, { id: 'f', x: 50, y: 86, r: 7, bad: true },
  { id: 'g', x: 30, y: 50, r: 6 }, { id: 'h', x: 72, y: 50, r: 6 },
];
const GRAPH_EDGES = [['a','g'],['g','sink'],['e','sink'],['b','h'],['h','sink'],['c','g'],['d','h'],['f','sink']];

export default function SplashPage() {
  const navigate = useNavigate();
  const [time, setTime] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);
  const nm = Object.fromEntries(GRAPH_NODES.map(n => [n.id, n]));

  return (
    <Box sx={{ minHeight: '100vh', background: '#0a0a12', color: '#fff', position: 'relative', overflow: 'hidden' }}>
      {/* ambient glows */}
      <Box sx={{ position: 'fixed', top: '-25%', right: '-10%', width: 900, height: 900, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(139,92,246,0.16) 0%, transparent 60%)', pointerEvents: 'none' }} />
      <Box sx={{ position: 'fixed', bottom: '-30%', left: '-10%', width: 700, height: 700, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(45,212,191,0.12) 0%, transparent 60%)', pointerEvents: 'none' }} />

      {/* top bar */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: { xs: 2, md: 6 }, py: 2.2,
        borderBottom: `1px solid ${ACCENT}14`, position: 'relative', zIndex: 2 }}>
        <Stack direction="row" spacing={1.4} alignItems="center">
          <Box sx={{ width: 34, height: 34, borderRadius: '9px', background: `linear-gradient(135deg,${ACCENT},#f97316)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', animation: `${pulse} 2.5s ease-in-out infinite` }}>
            <SensorsIcon sx={{ fontSize: 18, color: '#080b11' }} />
          </Box>
          <Typography fontWeight={900} sx={{ background: `linear-gradient(90deg,${ACCENT},${ACCENT2})`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: 2 }}>TRUSTCHAIN-WSN</Typography>
        </Stack>
        <Stack direction="row" spacing={2} alignItems="center">
          <Typography variant="caption" color={ACCENT} fontFamily="monospace" sx={{ display: { xs: 'none', sm: 'block' } }}>
            {time.toLocaleTimeString()}
          </Typography>
          <Button variant="outlined" size="small" onClick={() => navigate('/login')}
            sx={{ borderColor: `${ACCENT}66`, color: ACCENT, '&:hover': { borderColor: ACCENT, background: `${ACCENT}14` } }}>
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
                sx={{ width: 46, height: 46, borderRadius: '50%', border: `1px solid ${ACCENT}40`, objectFit: 'cover' }} />
              <Box>
                <Typography fontSize="0.78rem" fontWeight={700} color="rgba(255,255,255,0.8)">Pillai HOC College of Engineering and Technology</Typography>
                <Typography fontSize="0.6rem" letterSpacing={2} color="rgba(255,255,255,0.35)">DEPARTMENT OF MCA · 2025–26</Typography>
              </Box>
            </Stack>

            <Chip label="FINAL YEAR PROJECT · MCA" size="small"
              icon={<VerifiedUserIcon sx={{ fontSize: '14px !important', color: `${ACCENT} !important` }} />}
              sx={{ alignSelf: 'flex-start', background: `${ACCENT}14`, border: `1px solid ${ACCENT}40`, color: ACCENT, fontWeight: 700, fontSize: '0.6rem', letterSpacing: 1 }} />

            <Typography variant="h2" fontWeight={900} sx={{ fontSize: { xs: '2.4rem', md: '3.4rem' }, lineHeight: 1.05 }}>
              Secure Routing,<br />
              <Box component="span" sx={{ background: `linear-gradient(90deg,${ACCENT},${ACCENT2})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Sealed On-Chain.
              </Box>
            </Typography>

            <Typography sx={{ color: 'rgba(255,255,255,0.55)', maxWidth: 520, fontSize: '0.95rem', lineHeight: 1.7 }}>
              An <b style={{ color: ACCENT }}>event-driven lightweight blockchain</b> with trust-aware AODV routing —
              detecting, isolating and recovering from blackhole, Sybil and wormhole attacks in industrial
              wireless sensor networks, without continuous-chain overhead.
            </Typography>

            <Stack direction="row" spacing={1.2} flexWrap="wrap" useFlexGap>
              {[
                { icon: <BoltIcon sx={{ fontSize: 14 }} />, label: 'Event-Driven Chain', c: ACCENT },
                { icon: <VerifiedUserIcon sx={{ fontSize: 14 }} />, label: 'Trust-Aware AODV', c: '#a855f7' },
                { icon: <LinkIcon sx={{ fontSize: 14 }} />, label: 'Multi-Attack Defense', c: ACCENT2 },
              ].map(p => (
                <Stack key={p.label} direction="row" spacing={0.7} alignItems="center"
                  sx={{ px: 1.6, py: 0.7, borderRadius: 5, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: p.c }}>
                  {p.icon}<Typography fontSize="0.72rem" fontWeight={600} color="rgba(255,255,255,0.65)">{p.label}</Typography>
                </Stack>
              ))}
            </Stack>

            <Stack direction="row" spacing={2} pt={1}>
              <Button variant="contained" size="large" endIcon={<ArrowForwardIcon />} onClick={() => navigate('/login')}
                sx={{ background: ACCENT, color: '#080b11', fontWeight: 800, letterSpacing: 1, px: 4, py: 1.4,
                  borderRadius: 1, borderBottom: '3px solid rgba(0,0,0,0.35)',
                  '&:hover': { background: '#ffc233' } }}>
                Enter Control Room
              </Button>
              <Button variant="outlined" size="large" onClick={() => navigate('/register')}
                sx={{ borderColor: 'rgba(255,255,255,0.2)', borderWidth: 1.5, color: 'rgba(255,255,255,0.7)', px: 4, py: 1.4, borderRadius: 1,
                  '&:hover': { borderColor: ACCENT, borderWidth: 1.5, color: ACCENT } }}>
                Create Account
              </Button>
            </Stack>

            <Stack direction="row" spacing={4} pt={2}>
              <Box>
                <Typography fontSize="0.58rem" letterSpacing={2} color={`${ACCENT}aa`}>SUBMITTED BY</Typography>
                <Typography fontWeight={700} fontSize="0.85rem">Prasad Kathare · Pradnya Desai</Typography>
              </Box>
              <Box sx={{ borderLeft: '1px solid rgba(255,255,255,0.1)', pl: 4 }}>
                <Typography fontSize="0.58rem" letterSpacing={2} color={`${ACCENT}aa`}>GUIDE</Typography>
                <Typography fontWeight={700} fontSize="0.85rem">Prof. Jitesh Mhatre</Typography>
              </Box>
              <Box sx={{ borderLeft: '1px solid rgba(255,255,255,0.1)', pl: 4 }}>
                <Typography fontSize="0.58rem" letterSpacing={2} color={`${ACCENT}aa`}>HEAD OF DEPT.</Typography>
                <Typography fontWeight={700} fontSize="0.85rem">Prof. Abhijeet More</Typography>
              </Box>
            </Stack>
          </Stack>
        </Grid>

        {/* RIGHT — live network graphic */}
        <Grid item xs={12} md={5.5} sx={{ display: { xs: 'none', md: 'flex' }, justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
          <Box sx={{ width: 440, height: 440, position: 'relative' }}>
            <Box sx={{ position: 'absolute', inset: 0, borderRadius: '50%',
              border: `1px solid ${ACCENT}22`, animation: `${drift} 9s ease-in-out infinite` }} />
            <Box component="svg" viewBox="0 0 100 100" sx={{ width: '100%', height: '100%' }}>
              {GRAPH_EDGES.map(([a, b], i) => {
                const bad = nm[a].bad || nm[b].bad;
                return <line key={i} x1={nm[a].x} y1={nm[a].y} x2={nm[b].x} y2={nm[b].y}
                  stroke={bad ? '#ef4444' : ACCENT2} strokeOpacity={bad ? 0.7 : 0.45} strokeWidth={0.6}
                  strokeDasharray={bad ? '2 2' : '3 3'} style={{ animation: `${dash} 2s linear infinite` }} />;
              })}
              {GRAPH_NODES.map(n => (
                <g key={n.id}>
                  {n.sink && <circle cx={n.x} cy={n.y} r={n.r + 3} fill="none" stroke={ACCENT} strokeWidth={0.5} strokeDasharray="2 2" />}
                  <circle cx={n.x} cy={n.y} r={n.r / 2.2}
                    fill={n.bad ? '#ef4444' : n.sink ? ACCENT : '#34d399'}
                    opacity={0.9}>
                    {n.sink && <animate attributeName="opacity" values="0.6;1;0.6" dur="2s" repeatCount="indefinite" />}
                  </circle>
                </g>
              ))}
            </Box>
            <Box sx={{ position: 'absolute', bottom: 8, right: 8, px: 1.4, py: 0.6, borderRadius: 2,
              background: 'rgba(8,11,17,0.7)', border: `1px solid ${ACCENT}22` }}>
              <Typography fontSize="0.6rem" color="rgba(255,255,255,0.5)" fontFamily="monospace">
                <span style={{ color: '#ef4444' }}>● </span>1 malicious isolated · chain sealed
              </Typography>
            </Box>
          </Box>
        </Grid>
      </Grid>

      <Box sx={{ borderTop: '1px solid rgba(255,255,255,0.05)', py: 2.2, textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <Typography variant="caption" color="rgba(255,255,255,0.2)">
          © 2025 TrustChain-WSN · Pillai HOC College of Engineering and Technology · Final Year Project (MCA)
        </Typography>
      </Box>
    </Box>
  );
}
