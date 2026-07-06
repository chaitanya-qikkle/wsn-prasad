import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeModeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { SimProvider } from './sim/SimContext';
import MainLayout      from './layouts/MainLayout';
import AuthLayout      from './layouts/AuthLayout';
import ProtectedLayout from './layouts/ProtectedLayout';
import SplashPage      from './pages/SplashPage';
import LoginPage       from './pages/LoginPage';
import RegisterPage    from './pages/RegisterPage';
// ── Live console modules (all driven by the in-browser simulation engine) ──
import DashboardPage   from './pages/DashboardPage';
import TopologyPage    from './pages/TopologyPage';
import TrustPage       from './pages/TrustPage';
import AttacksPage     from './pages/AttacksPage';
import SimulationPage  from './pages/SimulationPage';
import LedgerPage      from './pages/LedgerPage';
import RoutesPage      from './pages/RoutesPage';
import MetricsPage     from './pages/MetricsPage';
import NotificationsPage from './pages/NotificationsPage';
import SettingsPage    from './pages/SettingsPage';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30000, retry: 1 } },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeModeProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<SplashPage />} />

              <Route element={<AuthLayout />}>
                <Route path="/login"    element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
              </Route>

              <Route element={<ProtectedLayout />}>
                <Route element={<SimProvider><MainLayout /></SimProvider>}>
                  <Route path="/dashboard"     element={<DashboardPage />} />
                  <Route path="/topology"      element={<TopologyPage />} />
                  <Route path="/attacks"       element={<AttacksPage />} />
                  <Route path="/simulation"    element={<SimulationPage />} />
                  <Route path="/trust"         element={<TrustPage />} />
                  <Route path="/ledger"        element={<LedgerPage />} />
                  <Route path="/routes"        element={<RoutesPage />} />
                  <Route path="/metrics"       element={<MetricsPage />} />
                  <Route path="/notifications" element={<NotificationsPage />} />
                  <Route path="/settings"      element={<SettingsPage />} />
                </Route>
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ThemeModeProvider>
    </QueryClientProvider>
  );
}
