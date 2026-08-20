import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { CircularProgress, Box } from '@mui/material';
import { BG_DARK } from '../context/ThemeContext';

export default function AuthLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: BG_DARK }}>
        <CircularProgress sx={{ color: '#22d3ee' }} />
      </Box>
    );
  }

  if (user) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
