import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Box, TextField, Button, Typography, InputAdornment,
  IconButton, Alert, CircularProgress, Divider, Stack, keyframes,
} from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import LockIcon from '@mui/icons-material/Lock';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import HubIcon from '@mui/icons-material/Hub';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import LinkIcon from '@mui/icons-material/Link';
import { useAuth } from '../context/AuthContext';
import { ACCENT, ACCENT2, NEON } from '../context/ThemeContext';

const float = keyframes`
  0%,100% { transform: translateY(0) scale(1); }
  50%     { transform: translateY(-14px) scale(1.04); }
`;
const pulse = keyframes`
  0%,100% { box-shadow: 0 0 0 0 ${ACCENT}55, 0 10px 40px ${ACCENT}55; }
  50%     { box-shadow: 0 0 0 18px ${ACCENT}00, 0 10px 40px ${ACCENT}55; }
`;
const sweep = keyframes`
  0%   { transform: translateX(-120%); }
  100% { transform: translateX(120%); }
`;
const dash = keyframes`
  to { stroke-dashoffset: -60; }
`;

// A small animated "network" motif for the brand panel.
function NetworkGlyph() {
  const nodes = [
    [50, 18], [18, 46], [82, 46], [34, 82], [66, 82], [50, 52],
  ];
  const links = [[5, 0], [5, 1], [5, 2], [5, 3], [5, 4], [0, 1], [0, 2], [3, 4]];
  return (
    <svg viewBox="0 0 100 100" width="230" height="230" style={{ maxWidth: '60vw' }}>
      {links.map(([a, b], i) => (
        <line key={i} x1={nodes[a][0]} y1={nodes[a][1]} x2={nodes[b][0]} y2={nodes[b][1]}
          stroke={NEON} strokeWidth="0.6" strokeOpacity="0.5"
          strokeDasharray="4 4" style={{ animation: `${dash} 2.5s linear infinite` }} />
      ))}
      {nodes.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i === 5 ? 4.5 : 3}
          fill={i === 5 ? ACCENT : ACCENT2}
          style={{ filter: `drop-shadow(0 0 4px ${i === 5 ? ACCENT : ACCENT2})` }} />
      ))}
    </svg>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await signIn(form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally { setLoading(false); }
  };

  const fieldSx = {
    '& .MuiOutlinedInput-root': {
      color: '#ecebff', background: 'rgba(255,255,255,0.03)', borderRadius: 2.5,
      '& fieldset': { borderColor: 'rgba(139,92,246,0.2)' },
      '&:hover fieldset': { borderColor: `${ACCENT}88` },
      '&.Mui-focused fieldset': { borderColor: ACCENT, boxShadow: `0 0 0 3px ${ACCENT}22` },
    },
    '& .MuiInputLabel-root': { color: 'rgba(236,235,255,0.45)' },
    '& .MuiInputLabel-root.Mui-focused': { color: ACCENT },
    // kill Chrome's sky-blue autofill background & keep our dark glass look
    '& input:-webkit-autofill, & input:-webkit-autofill:hover, & input:-webkit-autofill:focus, & input:-webkit-autofill:active': {
      WebkitBoxShadow: '0 0 0 1000px rgba(20,20,32,0.9) inset',
      WebkitTextFillColor: '#ecebff',
      caretColor: '#ecebff',
      borderRadius: 'inherit',
      transition: 'background-color 9999s ease-in-out 0s',
    },
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex',
      background: '#08080f', color: '#ecebff', overflow: 'hidden', position: 'relative' }}>

      {/* animated mesh glows */}
      <Box sx={{ position: 'absolute', inset: 0, zIndex: 0,
        background:
          `radial-gradient(700px 500px at 15% 20%, ${ACCENT}22, transparent 60%),` +
          `radial-gradient(700px 500px at 85% 80%, ${ACCENT2}1c, transparent 60%),` +
          `radial-gradient(500px 500px at 50% 120%, ${NEON}14, transparent 60%)` }} />
      {/* grid overlay */}
      <Box sx={{ position: 'absolute', inset: 0, zIndex: 0, opacity: 0.5,
        backgroundImage:
          `linear-gradient(rgba(139,92,246,0.05) 1px, transparent 1px),` +
          `linear-gradient(90deg, rgba(139,92,246,0.05) 1px, transparent 1px)`,
        backgroundSize: '46px 46px', maskImage: 'radial-gradient(ellipse at center, #000 40%, transparent 85%)' }} />
      {/* floating orbs */}
      <Box sx={{ position: 'absolute', width: 320, height: 320, borderRadius: '50%', top: '-8%', left: '-6%',
        background: `radial-gradient(circle, ${ACCENT}33, transparent 70%)`, filter: 'blur(30px)',
        animation: `${float} 9s ease-in-out infinite`, zIndex: 0 }} />
      <Box sx={{ position: 'absolute', width: 260, height: 260, borderRadius: '50%', bottom: '-6%', right: '-4%',
        background: `radial-gradient(circle, ${ACCENT2}2e, transparent 70%)`, filter: 'blur(30px)',
        animation: `${float} 11s ease-in-out infinite`, zIndex: 0 }} />

      {/* ── LEFT: brand / story panel (hidden on small screens) ── */}
      <Box sx={{ flex: 1.1, display: { xs: 'none', md: 'flex' }, flexDirection: 'column',
        justifyContent: 'center', px: 8, position: 'relative', zIndex: 1 }}>
        <Stack direction="row" spacing={1.5} alignItems="center" mb={4}>
          <Box component="img" src="/logo.png" alt="TrustChain-WSN"
            sx={{ width: 52, height: 52, objectFit: 'contain', borderRadius: '14px',
              filter: `drop-shadow(0 6px 22px ${ACCENT}66)` }} />
          <Box>
            <Typography fontWeight={900} fontSize="1.35rem" sx={{
              background: `linear-gradient(90deg, ${ACCENT}, ${ACCENT2})`,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: 0.5 }}>
              TrustChain-WSN
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(236,235,255,0.4)', letterSpacing: 2 }}>
              INDUSTRIAL WSN SECURITY CONSOLE
            </Typography>
          </Box>
        </Stack>

        <Typography variant="h3" fontWeight={800} sx={{ fontFamily: '"JetBrains Mono", monospace',
          lineHeight: 1.15, fontSize: '2.3rem', mb: 2 }}>
          Detect. Isolate.<br />
          <Box component="span" sx={{ color: ACCENT2 }}>Seal on-chain.</Box>
        </Typography>
        <Typography sx={{ color: 'rgba(236,235,255,0.55)', maxWidth: 440, mb: 5, fontSize: '1rem' }}>
          Event-driven lightweight blockchain secures trust-aware routing against
          Blackhole, Sybil &amp; Wormhole attacks — in real time.
        </Typography>

        <Stack direction="row" spacing={3} alignItems="center" mb={4}>
          {[
            { icon: <HubIcon />, label: 'WSN Field' },
            { icon: <VerifiedUserIcon />, label: 'Trust Engine' },
            { icon: <LinkIcon />, label: 'Blockchain' },
          ].map(f => (
            <Stack key={f.label} spacing={1} alignItems="center">
              <Box sx={{ width: 46, height: 46, borderRadius: '50%', color: ACCENT,
                border: `1px solid ${ACCENT}44`, background: `${ACCENT}14`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 0 16px ${ACCENT}33` }}>
                {f.icon}
              </Box>
              <Typography variant="caption" sx={{ color: 'rgba(236,235,255,0.5)' }}>{f.label}</Typography>
            </Stack>
          ))}
        </Stack>

        <Box sx={{ opacity: 0.85, animation: `${float} 7s ease-in-out infinite` }}>
          <NetworkGlyph />
        </Box>
      </Box>

      {/* ── RIGHT: auth card ── */}
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        px: 2, position: 'relative', zIndex: 1 }}>
        <Box sx={{ width: '100%', maxWidth: 420, p: { xs: 3, sm: 4.5 }, position: 'relative', overflow: 'hidden',
          background: 'rgba(20,20,32,0.6)', border: `1px solid ${ACCENT}2e`, borderRadius: 4,
          backdropFilter: 'blur(22px)', boxShadow: '0 30px 90px rgba(0,0,0,0.6)' }}>

          {/* top sweep shimmer */}
          <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, overflow: 'hidden' }}>
            <Box sx={{ position: 'absolute', inset: 0,
              background: `linear-gradient(90deg, transparent, ${ACCENT}, ${ACCENT2}, transparent)`,
              animation: `${sweep} 3.5s ease-in-out infinite` }} />
          </Box>

          <Box sx={{ textAlign: 'center', mb: 3.5 }}>
            <Box sx={{ width: 84, height: 84, borderRadius: '22px', mx: 'auto', mb: 2,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: `${pulse} 3s ease-in-out infinite` }}>
              <Box component="img" src="/logo.png" alt="TrustChain-WSN"
                sx={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '22px' }} />
            </Box>
            <Typography variant="h5" fontWeight={900} sx={{
              background: `linear-gradient(90deg, ${ACCENT}, ${ACCENT2})`,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Welcome back
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(236,235,255,0.45)', mt: 0.5 }}>
              Sign in to access the control room
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2.5, background: 'rgba(251,92,107,0.14)', color: '#ffb4bc',
              border: '1px solid rgba(251,92,107,0.3)', borderRadius: 2.5 }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <Stack spacing={2.4}>
              <TextField label="Email Address" name="email" type="email"
                value={form.email} onChange={handleChange} required fullWidth
                InputProps={{ startAdornment: <InputAdornment position="start"><EmailIcon sx={{ color: 'rgba(236,235,255,0.35)', fontSize: 19 }} /></InputAdornment> }}
                sx={fieldSx} />
              <TextField label="Password" name="password" type={showPass ? 'text' : 'password'}
                value={form.password} onChange={handleChange} required fullWidth
                InputProps={{
                  startAdornment: <InputAdornment position="start"><LockIcon sx={{ color: 'rgba(236,235,255,0.35)', fontSize: 19 }} /></InputAdornment>,
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPass(p => !p)} edge="end" size="small" sx={{ color: 'rgba(236,235,255,0.35)' }}>
                        {showPass ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={fieldSx} />
              <Button type="submit" variant="contained" fullWidth size="large" disabled={loading}
                sx={{ mt: 0.5, py: 1.5, fontWeight: 800, fontSize: '0.95rem', letterSpacing: 0.8, borderRadius: 3,
                  background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})`, color: '#08080f',
                  boxShadow: `0 10px 30px ${ACCENT}55`,
                  '&:hover': { background: `linear-gradient(135deg, ${ACCENT2}, ${ACCENT})`, boxShadow: `0 12px 36px ${ACCENT}77` },
                  '&:disabled': { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)' } }}>
                {loading ? <CircularProgress size={22} sx={{ color: '#08080f' }} /> : 'Access Control Room'}
              </Button>
            </Stack>
          </form>

          <Divider sx={{ my: 3, borderColor: 'rgba(139,92,246,0.14)' }}>
            <Typography variant="caption" sx={{ color: 'rgba(236,235,255,0.25)' }}>OR</Typography>
          </Divider>

          <Typography variant="body2" textAlign="center" sx={{ color: 'rgba(236,235,255,0.45)' }}>
            No account?{' '}
            <Typography component={Link} to="/register" variant="body2" sx={{ color: ACCENT2, textDecoration: 'none', fontWeight: 700,
              '&:hover': { textDecoration: 'underline' } }}>
              Create one here
            </Typography>
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
