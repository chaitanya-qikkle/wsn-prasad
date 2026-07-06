import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Box, TextField, Button, Typography, InputAdornment,
  IconButton, Alert, CircularProgress, Stack, Paper, keyframes, MenuItem,
} from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import LockIcon from '@mui/icons-material/Lock';
import PersonIcon from '@mui/icons-material/Person';
import BadgeIcon from '@mui/icons-material/Badge';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import SensorsIcon from '@mui/icons-material/Sensors';
import { useAuth } from '../context/AuthContext';
import { ACCENT, ACCENT2 } from '../context/ThemeContext';

const pulse = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(34,211,238,0.4); }
  50%       { box-shadow: 0 0 0 16px rgba(34,211,238,0); }
`;

const ROLES = ['Admin', 'Operator', 'Viewer'];

export default function RegisterPage() {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirm: '', role: 'Operator' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (e) => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) { setError('Passwords do not match'); return; }
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      await signUp(form.email, form.password, { full_name: form.fullName, role: form.role });
      setSuccess('Account created! Check your email for verification.');
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally { setLoading(false); }
  };

  const fieldSx = {
    '& .MuiOutlinedInput-root': {
      color: '#fff', background: 'rgba(255,255,255,0.04)', borderRadius: 2,
      '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
      '&:hover fieldset': { borderColor: `${ACCENT2}66` },
      '&.Mui-focused fieldset': { borderColor: ACCENT2 },
    },
    '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.4)' },
    '& .MuiInputLabel-root.Mui-focused': { color: ACCENT2 },
    '& .MuiSelect-icon': { color: 'rgba(255,255,255,0.4)' },
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: `linear-gradient(135deg, #080b11 0%, #11161f 100%)`, px: 2, py: 4 }}>
      <Box sx={{ position: 'fixed', inset: 0, zIndex: 0,
        backgroundImage: `linear-gradient(rgba(34,211,238,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.03) 1px, transparent 1px)`,
        backgroundSize: '50px 50px', pointerEvents: 'none' }} />

      <Paper elevation={0} sx={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 460, p: { xs: 3, sm: 5 },
        background: 'rgba(255,255,255,0.03)', border: `1px solid ${ACCENT2}26`, borderRadius: 1.5,
        borderTop: `3px solid ${ACCENT2}`,
        backdropFilter: 'blur(20px)', boxShadow: '0 24px 80px rgba(0,0,0,0.5)' }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Box sx={{ width: 72, height: 72, borderRadius: '8px', mx: 'auto', mb: 2,
            background: ACCENT2, border: '2px solid rgba(0,0,0,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', animation: `${pulse} 3s ease-in-out infinite` }}>
            <SensorsIcon sx={{ fontSize: 36, color: '#fff' }} />
          </Box>
          <Typography variant="h5" fontWeight={900} sx={{
            background: `linear-gradient(90deg,${ACCENT2},#a855f7)`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Create Account
          </Typography>
          <Typography variant="body2" color="rgba(255,255,255,0.4)" mt={0.5}>
            Join the TrustChain-WSN platform
          </Typography>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 3, background: 'rgba(239,68,68,0.15)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.3)' }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 3, background: 'rgba(52,211,153,0.1)', color: '#a7f3d0', border: '1px solid rgba(52,211,153,0.3)' }}>{success}</Alert>}

        <form onSubmit={handleSubmit}>
          <Stack spacing={2.5}>
            <TextField label="Full Name" name="fullName" value={form.fullName} onChange={handleChange} required fullWidth
              InputProps={{ startAdornment: <InputAdornment position="start"><PersonIcon sx={{ color: 'rgba(255,255,255,0.3)', fontSize: 18 }} /></InputAdornment> }} sx={fieldSx} />
            <TextField label="Email Address" name="email" type="email" value={form.email} onChange={handleChange} required fullWidth
              InputProps={{ startAdornment: <InputAdornment position="start"><EmailIcon sx={{ color: 'rgba(255,255,255,0.3)', fontSize: 18 }} /></InputAdornment> }} sx={fieldSx} />
            <TextField select label="Role" name="role" value={form.role} onChange={handleChange} fullWidth
              InputProps={{ startAdornment: <InputAdornment position="start"><BadgeIcon sx={{ color: 'rgba(255,255,255,0.3)', fontSize: 18 }} /></InputAdornment> }}
              sx={fieldSx}
              SelectProps={{ MenuProps: { PaperProps: { sx: { background: '#11161f', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' } } } }}>
              {ROLES.map(r => <MenuItem key={r} value={r} sx={{ color: '#fff', '&:hover': { background: `${ACCENT2}1a` } }}>{r}</MenuItem>)}
            </TextField>
            <TextField label="Password" name="password" type={showPass ? 'text' : 'password'} value={form.password} onChange={handleChange} required fullWidth
              InputProps={{
                startAdornment: <InputAdornment position="start"><LockIcon sx={{ color: 'rgba(255,255,255,0.3)', fontSize: 18 }} /></InputAdornment>,
                endAdornment: <InputAdornment position="end"><IconButton onClick={() => setShowPass(p => !p)} size="small" sx={{ color: 'rgba(255,255,255,0.3)' }}>{showPass ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}</IconButton></InputAdornment>,
              }} sx={fieldSx} />
            <TextField label="Confirm Password" name="confirm" type="password" value={form.confirm} onChange={handleChange} required fullWidth
              InputProps={{ startAdornment: <InputAdornment position="start"><LockIcon sx={{ color: 'rgba(255,255,255,0.3)', fontSize: 18 }} /></InputAdornment> }} sx={fieldSx} />

            <Button type="submit" variant="contained" fullWidth size="large" disabled={loading}
              sx={{ mt: 1, py: 1.5, fontWeight: 800, fontSize: '0.95rem', letterSpacing: 1.2, borderRadius: 1,
                background: ACCENT2, color: '#fff',
                borderBottom: '3px solid rgba(0,0,0,0.35)',
                '&:hover': { background: '#8f74ff' },
                '&:disabled': { background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.3)', borderBottom: 'none' } }}>
              {loading ? <CircularProgress size={22} sx={{ color: '#fff' }} /> : 'Create Account'}
            </Button>
          </Stack>
        </form>

        <Typography variant="body2" textAlign="center" color="rgba(255,255,255,0.4)" mt={3}>
          Already have an account?{' '}
          <Typography component={Link} to="/login" variant="body2" sx={{ color: ACCENT2, textDecoration: 'none', fontWeight: 700, '&:hover': { textDecoration: 'underline' } }}>
            Sign in
          </Typography>
        </Typography>
      </Paper>
    </Box>
  );
}
