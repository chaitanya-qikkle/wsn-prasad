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

const dash = keyframes`to { stroke-dashoffset: -60; }`;

// A small "network" motif for the brand panel.
function NetworkGlyph() {
  const nodes = [
    [50, 18], [18, 46], [82, 46], [34, 82], [66, 82], [50, 52],
  ];
  const links = [[5, 0], [5, 1], [5, 2], [5, 3], [5, 4], [0, 1], [0, 2], [3, 4]];
  return (
    <svg viewBox="0 0 100 100" width="220" height="220" style={{ maxWidth: '60vw' }}>
      {links.map(([a, b], i) => (
        <line key={i} x1={nodes[a][0]} y1={nodes[a][1]} x2={nodes[b][0]} y2={nodes[b][1]}
          stroke={NEON} strokeWidth="0.6" strokeOpacity="0.4"
          strokeDasharray="4 4" style={{ animation: `${dash} 2.5s linear infinite` }} />
      ))}
      {nodes.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i === 5 ? 4.5 : 3}
          fill={i === 5 ? ACCENT : ACCENT2} />
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
      color: '#0f172a', background: '#f8fafc', borderRadius: 2,
      '& fieldset': { borderColor: 'rgba(15,23,42,0.14)' },
      '&:hover fieldset': { borderColor: `${ACCENT}77` },
      '&.Mui-focused fieldset': { borderColor: ACCENT, borderWidth: 1.5 },
    },
    '& .MuiInputLabel-root': { color: 'rgba(15,23,42,0.5)' },
    '& .MuiInputLabel-root.Mui-focused': { color: ACCENT },
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex',
      background: '#f1f5f9', color: '#0f172a', overflow: 'hidden', position: 'relative' }}>

      {/* ── LEFT: brand / story panel (hidden on small screens) ── */}
      <Box sx={{ flex: 1.1, display: { xs: 'none', md: 'flex' }, flexDirection: 'column',
        justifyContent: 'center', px: 8, position: 'relative', zIndex: 1, background: '#0f172a', color: '#f1f5f9' }}>
        <Stack direction="row" spacing={1.5} alignItems="center" mb={4}>
          <Box component="img" src="/logo.png" alt="TrustChain-WSN"
            sx={{ width: 46, height: 46, objectFit: 'contain', borderRadius: '12px' }} />
          <Box>
            <Typography fontWeight={700} fontSize="1.3rem" color="#fff" letterSpacing={0.3}>
              TrustChain-WSN
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(241,245,249,0.5)', letterSpacing: 1.6 }}>
              INDUSTRIAL WSN SECURITY CONSOLE
            </Typography>
          </Box>
        </Stack>

        <Typography variant="h3" fontWeight={700} sx={{ lineHeight: 1.2, fontSize: '2.1rem', mb: 2 }}>
          Detect. Isolate.<br />
          <Box component="span" sx={{ color: ACCENT2 }}>Seal on-chain.</Box>
        </Typography>
        <Typography sx={{ color: 'rgba(241,245,249,0.55)', maxWidth: 440, mb: 5, fontSize: '1rem' }}>
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
              <Box sx={{ width: 44, height: 44, borderRadius: '50%', color: ACCENT2,
                border: `1px solid ${ACCENT2}44`, background: `${ACCENT2}14`,
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {f.icon}
              </Box>
              <Typography variant="caption" sx={{ color: 'rgba(241,245,249,0.5)' }}>{f.label}</Typography>
            </Stack>
          ))}
        </Stack>

        <NetworkGlyph />
      </Box>

      {/* ── RIGHT: auth card ── */}
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        px: 2, position: 'relative', zIndex: 1 }}>
        <Box sx={{ width: '100%', maxWidth: 420, p: { xs: 3, sm: 4.5 }, position: 'relative',
          background: '#ffffff', border: '1px solid rgba(15,23,42,0.08)', borderRadius: 3,
          boxShadow: '0 1px 3px rgba(15,23,42,0.06), 0 8px 24px rgba(15,23,42,0.06)' }}>

          <Box sx={{ textAlign: 'center', mb: 3.5 }}>
            <Box sx={{ width: 72, height: 72, borderRadius: '18px', mx: 'auto', mb: 2,
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Box component="img" src="/logo.png" alt="TrustChain-WSN"
                sx={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '18px' }} />
            </Box>
            <Typography variant="h5" fontWeight={700} color="#0f172a">
              Welcome back
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(15,23,42,0.5)', mt: 0.5 }}>
              Sign in to access the control room
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <Stack spacing={2.4}>
              <TextField label="Email Address" name="email" type="email"
                value={form.email} onChange={handleChange} required fullWidth
                InputProps={{ startAdornment: <InputAdornment position="start"><EmailIcon sx={{ color: 'rgba(15,23,42,0.35)', fontSize: 19 }} /></InputAdornment> }}
                sx={fieldSx} />
              <TextField label="Password" name="password" type={showPass ? 'text' : 'password'}
                value={form.password} onChange={handleChange} required fullWidth
                InputProps={{
                  startAdornment: <InputAdornment position="start"><LockIcon sx={{ color: 'rgba(15,23,42,0.35)', fontSize: 19 }} /></InputAdornment>,
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPass(p => !p)} edge="end" size="small" sx={{ color: 'rgba(15,23,42,0.35)' }}>
                        {showPass ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={fieldSx} />
              <Button type="submit" variant="contained" fullWidth size="large" disabled={loading}
                sx={{ mt: 0.5, py: 1.4, fontWeight: 700, fontSize: '0.95rem', borderRadius: 2,
                  background: ACCENT, color: '#fff',
                  '&:hover': { background: '#1d4ed8' },
                  '&:disabled': { background: 'rgba(15,23,42,0.08)', color: 'rgba(15,23,42,0.3)' } }}>
                {loading ? <CircularProgress size={22} sx={{ color: '#fff' }} /> : 'Access Control Room'}
              </Button>
            </Stack>
          </form>

          <Divider sx={{ my: 3, borderColor: 'rgba(15,23,42,0.08)' }}>
            <Typography variant="caption" sx={{ color: 'rgba(15,23,42,0.3)' }}>OR</Typography>
          </Divider>

          <Typography variant="body2" textAlign="center" sx={{ color: 'rgba(15,23,42,0.5)' }}>
            No account?{' '}
            <Typography component={Link} to="/register" variant="body2" sx={{ color: ACCENT, textDecoration: 'none', fontWeight: 700,
              '&:hover': { textDecoration: 'underline' } }}>
              Create one here
            </Typography>
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
