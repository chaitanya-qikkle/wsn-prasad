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
import { alpha } from '@mui/material';
import { ACCENT2, NEON, BG_DARK, PANEL_DARK, LINE_DARK } from '../context/ThemeContext';

/*  Auth screens are painted with the console's dark palette directly, not the
 *  MUI theme — you sign in to an operations room, so the door should look like
 *  one no matter which mode the console toggle is left on.                    */
const T1 = '#e6edf7';
const T2 = 'rgba(148,171,207,0.72)';
const T3 = 'rgba(148,171,207,0.45)';
const BRAND = '#22d3ee';

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
          fill={i === 5 ? BRAND : ACCENT2} />
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
      color: T1, background: alpha('#0a0f1c', 0.6), borderRadius: 2,
      '& fieldset': { borderColor: LINE_DARK },
      '&:hover fieldset': { borderColor: alpha(BRAND, 0.45) },
      '&.Mui-focused fieldset': { borderColor: BRAND, borderWidth: 1.5 },
    },
    '& .MuiInputLabel-root': { color: T3 },
    '& .MuiInputLabel-root.Mui-focused': { color: BRAND },
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex',
      background: BG_DARK, color: T1, overflow: 'hidden', position: 'relative' }}>

      {/* ── LEFT: brand / story panel (hidden on small screens) ── */}
      <Box sx={{ flex: 1.1, display: { xs: 'none', md: 'flex' }, flexDirection: 'column',
        justifyContent: 'center', px: 8, position: 'relative', zIndex: 1, color: T1,
        borderRight: `1px solid ${LINE_DARK}`,
        backgroundImage: `radial-gradient(900px 520px at 20% 0%, ${alpha(BRAND, 0.12)}, transparent 62%)` }}>
        <Stack direction="row" spacing={1.5} alignItems="center" mb={4}>
          <Box component="img" src="/logo.png" alt="TrustChain-WSN"
            sx={{ width: 46, height: 46, objectFit: 'contain', borderRadius: '12px' }} />
          <Box>
            <Typography fontWeight={700} fontSize="1.3rem" color="#fff" letterSpacing={0.3}>
              TrustChain-WSN
            </Typography>
            <Typography variant="caption" sx={{ color: T3, letterSpacing: 1.6 }}>
              INDUSTRIAL WSN SECURITY CONSOLE
            </Typography>
          </Box>
        </Stack>

        <Typography variant="h3" fontWeight={700} sx={{ lineHeight: 1.2, fontSize: '2.1rem', mb: 2 }}>
          Detect. Isolate.<br />
          <Box component="span" sx={{ color: BRAND }}>Recover automatically.</Box>
        </Typography>
        <Typography sx={{ color: T2, maxWidth: 460, mb: 5, fontSize: '1rem', lineHeight: 1.7 }}>
          Event-driven lightweight blockchain secures trust-aware routing against blackhole, Sybil,
          wormhole and grayhole attacks — then heals the compromised node and puts it back in service
          on its own, in real time.
        </Typography>

        <Stack direction="row" spacing={3} alignItems="center" mb={4}>
          {[
            { icon: <HubIcon />, label: 'WSN Field', c: ACCENT2 },
            { icon: <VerifiedUserIcon />, label: 'Trust Engine', c: BRAND },
            { icon: <LinkIcon />, label: 'Blockchain', c: NEON },
          ].map(f => (
            <Stack key={f.label} spacing={1} alignItems="center">
              <Box sx={{ width: 44, height: 44, borderRadius: '50%', color: f.c,
                border: `1px solid ${alpha(f.c, 0.32)}`, background: alpha(f.c, 0.1),
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {f.icon}
              </Box>
              <Typography variant="caption" sx={{ color: T3 }}>{f.label}</Typography>
            </Stack>
          ))}
        </Stack>

        <NetworkGlyph />
      </Box>

      {/* ── RIGHT: auth card ── */}
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        px: 2, position: 'relative', zIndex: 1 }}>
        <Box sx={{ width: '100%', maxWidth: 420, p: { xs: 3, sm: 4.5 }, position: 'relative',
          background: PANEL_DARK, border: `1px solid ${LINE_DARK}`, borderRadius: 3,
          boxShadow: '0 1px 0 rgba(255,255,255,0.03) inset, 0 16px 44px rgba(3,7,18,0.6)' }}>

          <Box sx={{ textAlign: 'center', mb: 3.5 }}>
            <Box sx={{ width: 72, height: 72, borderRadius: '18px', mx: 'auto', mb: 2,
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Box component="img" src="/logo.png" alt="TrustChain-WSN"
                sx={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '18px' }} />
            </Box>
            <Typography variant="h5" fontWeight={700} color={T1}>
              Welcome back
            </Typography>
            <Typography variant="body2" sx={{ color: T2, mt: 0.5 }}>
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
                InputProps={{ startAdornment: <InputAdornment position="start"><EmailIcon sx={{ color: T3, fontSize: 19 }} /></InputAdornment> }}
                sx={fieldSx} />
              <TextField label="Password" name="password" type={showPass ? 'text' : 'password'}
                value={form.password} onChange={handleChange} required fullWidth
                InputProps={{
                  startAdornment: <InputAdornment position="start"><LockIcon sx={{ color: T3, fontSize: 19 }} /></InputAdornment>,
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPass(p => !p)} edge="end" size="small" sx={{ color: T3 }}>
                        {showPass ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={fieldSx} />
              <Button type="submit" variant="contained" fullWidth size="large" disabled={loading}
                sx={{ mt: 0.5, py: 1.4, fontWeight: 800, fontSize: '0.95rem', borderRadius: 2,
                  background: BRAND, color: '#03212b',
                  '&:hover': { background: '#67e8f9' },
                  '&:disabled': { background: alpha('#94a3b8', 0.12), color: T3 } }}>
                {loading ? <CircularProgress size={22} sx={{ color: '#03212b' }} /> : 'Access Control Room'}
              </Button>
            </Stack>
          </form>

          <Divider sx={{ my: 3, borderColor: LINE_DARK }}>
            <Typography variant="caption" sx={{ color: T3 }}>OR</Typography>
          </Divider>

          <Typography variant="body2" textAlign="center" sx={{ color: T2 }}>
            No account?{' '}
            <Typography component={Link} to="/register" variant="body2" sx={{ color: BRAND, textDecoration: 'none', fontWeight: 700,
              '&:hover': { textDecoration: 'underline' } }}>
              Create one here
            </Typography>
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
