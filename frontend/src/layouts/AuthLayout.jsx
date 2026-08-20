import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { CircularProgress, Box } from '@mui/material';

export default function AuthLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <CircularProgress sx={{ color: '#2563eb' }} />
      </Box>
    );
  }

  if (user) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
