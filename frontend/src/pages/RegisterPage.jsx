import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Box, TextField, Button, Typography, InputAdornment,
  IconButton, Alert, CircularProgress, Stack, Paper, MenuItem,
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
      color: '#0f172a', background: '#f8fafc', borderRadius: 2,
      '& fieldset': { borderColor: 'rgba(15,23,42,0.14)' },
      '&:hover fieldset': { borderColor: `${ACCENT2}77` },
      '&.Mui-focused fieldset': { borderColor: ACCENT2, borderWidth: 1.5 },
    },
    '& .MuiInputLabel-root': { color: 'rgba(15,23,42,0.5)' },
    '& .MuiInputLabel-root.Mui-focused': { color: ACCENT2 },
    '& .MuiSelect-icon': { color: 'rgba(15,23,42,0.4)' },
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#f1f5f9', px: 2, py: 4 }}>

      <Paper elevation={0} sx={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 460, p: { xs: 3, sm: 5 },
        background: '#ffffff', border: '1px solid rgba(15,23,42,0.08)', borderRadius: 3,
        borderTop: `3px solid ${ACCENT2}`,
        boxShadow: '0 1px 3px rgba(15,23,42,0.06), 0 8px 24px rgba(15,23,42,0.06)' }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Box sx={{ width: 68, height: 68, borderRadius: '16px', mx: 'auto', mb: 2,
            background: ACCENT2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <SensorsIcon sx={{ fontSize: 32, color: '#fff' }} />
          </Box>
          <Typography variant="h5" fontWeight={700} color="#0f172a">
            Create Account
          </Typography>
          <Typography variant="body2" color="rgba(15,23,42,0.5)" mt={0.5}>
            Join the TrustChain-WSN platform
          </Typography>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 3, borderRadius: 2 }}>{success}</Alert>}

        <form onSubmit={handleSubmit}>
          <Stack spacing={2.5}>
            <TextField label="Full Name" name="fullName" value={form.fullName} onChange={handleChange} required fullWidth
              InputProps={{ startAdornment: <InputAdornment position="start"><PersonIcon sx={{ color: 'rgba(15,23,42,0.35)', fontSize: 18 }} /></InputAdornment> }} sx={fieldSx} />
            <TextField label="Email Address" name="email" type="email" value={form.email} onChange={handleChange} required fullWidth
              InputProps={{ startAdornment: <InputAdornment position="start"><EmailIcon sx={{ color: 'rgba(15,23,42,0.35)', fontSize: 18 }} /></InputAdornment> }} sx={fieldSx} />
            <TextField select label="Role" name="role" value={form.role} onChange={handleChange} fullWidth
              InputProps={{ startAdornment: <InputAdornment position="start"><BadgeIcon sx={{ color: 'rgba(15,23,42,0.35)', fontSize: 18 }} /></InputAdornment> }}
              sx={fieldSx}>
              {ROLES.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
            </TextField>
            <TextField label="Password" name="password" type={showPass ? 'text' : 'password'} value={form.password} onChange={handleChange} required fullWidth
              InputProps={{
                startAdornment: <InputAdornment position="start"><LockIcon sx={{ color: 'rgba(15,23,42,0.35)', fontSize: 18 }} /></InputAdornment>,
                endAdornment: <InputAdornment position="end"><IconButton onClick={() => setShowPass(p => !p)} size="small" sx={{ color: 'rgba(15,23,42,0.35)' }}>{showPass ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}</IconButton></InputAdornment>,
              }} sx={fieldSx} />
            <TextField label="Confirm Password" name="confirm" type="password" value={form.confirm} onChange={handleChange} required fullWidth
              InputProps={{ startAdornment: <InputAdornment position="start"><LockIcon sx={{ color: 'rgba(15,23,42,0.35)', fontSize: 18 }} /></InputAdornment> }} sx={fieldSx} />

            <Button type="submit" variant="contained" fullWidth size="large" disabled={loading}
              sx={{ mt: 1, py: 1.4, fontWeight: 700, fontSize: '0.95rem', borderRadius: 2,
                background: ACCENT2, color: '#fff',
                '&:hover': { background: '#0f766e' },
                '&:disabled': { background: 'rgba(15,23,42,0.08)', color: 'rgba(15,23,42,0.3)' } }}>
              {loading ? <CircularProgress size={22} sx={{ color: '#fff' }} /> : 'Create Account'}
            </Button>
          </Stack>
        </form>

        <Typography variant="body2" textAlign="center" color="rgba(15,23,42,0.5)" mt={3}>
          Already have an account?{' '}
          <Typography component={Link} to="/login" variant="body2" sx={{ color: ACCENT2, textDecoration: 'none', fontWeight: 700, '&:hover': { textDecoration: 'underline' } }}>
            Sign in
          </Typography>
        </Typography>
      </Paper>
    </Box>
  );
}
