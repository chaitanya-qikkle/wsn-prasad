import React, { useState, useRef, useEffect } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Box, Typography, IconButton, Avatar, Stack, Tooltip, Badge, Chip,
  useTheme, useMediaQuery, alpha, Drawer, Menu, MenuItem, Divider, ToggleButtonGroup, ToggleButton,
  Snackbar, Alert,
} from '@mui/material';
import SpaceDashboardIcon from '@mui/icons-material/SpaceDashboard';
import HubIcon            from '@mui/icons-material/Hub';
import VerifiedUserIcon   from '@mui/icons-material/VerifiedUser';
import GppMaybeIcon       from '@mui/icons-material/GppMaybe';
import ScienceIcon        from '@mui/icons-material/Science';
import LinkIcon           from '@mui/icons-material/Link';
import AltRouteIcon       from '@mui/icons-material/AltRoute';
import InsightsIcon       from '@mui/icons-material/Insights';
import NotificationsIcon  from '@mui/icons-material/Notifications';
import SettingsIcon       from '@mui/icons-material/Settings';
import MenuIcon           from '@mui/icons-material/Menu';
import LogoutIcon         from '@mui/icons-material/Logout';
import Brightness4Icon    from '@mui/icons-material/Brightness4';
import Brightness7Icon    from '@mui/icons-material/Brightness7';
import HomeIcon           from '@mui/icons-material/Home';
import PlayArrowIcon      from '@mui/icons-material/PlayArrow';
import PauseIcon          from '@mui/icons-material/Pause';
import BoltIcon           from '@mui/icons-material/Bolt';
import { useAuth }        from '../context/AuthContext';
import { useThemeMode, ACCENT, ACCENT2, DANGER, WARN, BG_MESH } from '../context/ThemeContext';
import { useSim } from '../sim/SimContext';
import { LiveDot } from '../utils/ui';

const SIDEBAR_W = 256;

const NAV_SECTIONS = [
  { heading: 'Monitor', items: [
    { path: '/dashboard', label: 'Dashboard',    icon: <SpaceDashboardIcon /> },
    { path: '/topology',  label: 'Network Map',  icon: <HubIcon /> },
    { path: '/trust',     label: 'Trust Engine', icon: <VerifiedUserIcon /> },
    { path: '/metrics',   label: 'Performance',  icon: <InsightsIcon /> },
  ] },
  { heading: 'Security', items: [
    { path: '/attacks',    label: 'Detection',      icon: <GppMaybeIcon /> },
    { path: '/simulation', label: 'Attack Lab',     icon: <ScienceIcon /> },
    { path: '/routes',     label: 'Secure Routing', icon: <AltRouteIcon /> },
    { path: '/ledger',     label: 'Blockchain',     icon: <LinkIcon /> },
  ] },
];

const SPEEDS = [{ ms: 3500, l: '0.5x' }, { ms: 2000, l: '1x' }, { ms: 1000, l: '2x' }, { ms: 500, l: '4x' }];

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { mode, toggleMode } = useThemeMode();
  const theme = useTheme();
  const dark = theme.palette.mode === 'dark';
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mOpen, setMOpen] = useState(false);
  const [anchor, setAnchor] = useState(null);
  const sim = useSim();
  const [toast, setToast] = useState(null);
  const seenIds = useRef(new Set());
  const firstRun = useRef(true);

  // surface a live toast the moment a new attack/isolation/critical alert lands,
  // from anywhere in the console — not just the Notifications page
  useEffect(() => {
    const latest = sim.notifications[0];
    if (firstRun.current) {
      sim.notifications.forEach(n => seenIds.current.add(n.id));
      firstRun.current = false;
      return;
    }
    if (!latest || seenIds.current.has(latest.id)) return;
    seenIds.current.add(latest.id);
    if (latest.type === 'attack' || latest.type === 'isolation' || latest.severity === 'Critical') {
      setToast(latest);
    }
  }, [sim.notifications]);

  const isActive = (p) => location.pathname === p;
  const handleSignOut = async () => { setAnchor(null); await signOut(); navigate('/login'); };
  const panelBg = dark ? 'rgba(11,12,24,0.82)' : 'rgba(255,255,255,0.92)';

  const Brand = (
    <Stack direction="row" spacing={1.4} alignItems="center" sx={{ cursor: 'pointer', px: 2.5, py: 2.4 }}
      onClick={() => { navigate('/dashboard'); setMOpen(false); }}>
      <Box component="img" src="/logo.png" alt="TrustChain-WSN"
        sx={{ width: 44, height: 44, objectFit: 'contain', borderRadius: '13px', flexShrink: 0,
          filter: `drop-shadow(0 6px 16px ${alpha(ACCENT, 0.5)})` }} />
      <Box minWidth={0}>
        <Typography fontWeight={900} noWrap sx={{ lineHeight: 1.05, fontSize: '1.18rem',
          background: `linear-gradient(90deg,${ACCENT},${ACCENT2})`,
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: 0.3 }}>
          TrustChain
        </Typography>
        <Typography variant="caption" noWrap sx={{ color: theme.palette.text.secondary, fontSize: 9, letterSpacing: 1.8 }}>
          INDUSTRIAL WSN
        </Typography>
      </Box>
    </Stack>
  );

  const NavItem = ({ item }) => {
    const active = isActive(item.path);
    return (
      <Box component={Link} to={item.path} onClick={() => setMOpen(false)}
        sx={{ display: 'flex', alignItems: 'center', gap: 1.4, mx: 1.4, my: 0.3, px: 1.6, py: 1.1,
          borderRadius: 2.5, textDecoration: 'none', position: 'relative',
          color: active ? '#fff' : theme.palette.text.secondary,
          fontWeight: active ? 700 : 600, fontSize: 14,
          background: active ? `linear-gradient(90deg, ${alpha(ACCENT, 0.26)}, ${alpha(ACCENT, 0.05)})` : 'transparent',
          boxShadow: active ? `inset 0 0 0 1px ${alpha(ACCENT, 0.28)}` : 'none',
          transition: 'all .18s',
          '&:hover': { background: alpha(ACCENT, active ? 0.28 : 0.1), color: active ? '#fff' : ACCENT },
          '& svg': { fontSize: 20, color: active ? ACCENT : 'inherit' } }}>
        {active && (
          <Box sx={{ position: 'absolute', left: -1.4, top: '22%', bottom: '22%', width: 3.5, borderRadius: 3,
            background: `linear-gradient(${ACCENT},${ACCENT2})`, boxShadow: `0 0 10px ${ACCENT}` }} />
        )}
        {item.icon}<span>{item.label}</span>
      </Box>
    );
  };

  const MiniStat = ({ label, value, color }) => (
    <Box sx={{ flex: 1, textAlign: 'center', px: 0.5, py: 1, borderRadius: 2, background: alpha(color, 0.08),
      border: `1px solid ${alpha(color, 0.2)}` }}>
      <Typography sx={{ fontFamily: '"JetBrains Mono", monospace', fontWeight: 800, fontSize: 17, color, lineHeight: 1 }}>{value}</Typography>
      <Typography variant="caption" color="text.secondary" fontSize={8.5} fontWeight={700} letterSpacing={0.6} textTransform="uppercase">{label}</Typography>
    </Box>
  );

  const SidebarInner = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%',
      background: panelBg, backdropFilter: 'blur(22px)', borderRight: `1px solid ${theme.palette.divider}` }}>
      {Brand}
      <Divider sx={{ borderColor: theme.palette.divider, mx: 2 }} />

      <Box sx={{ mx: 1.5, mt: 1.8, mb: 1, px: 1.6, py: 1, borderRadius: 2.5, display: 'flex', alignItems: 'center', gap: 1,
        background: alpha(sim.running ? ACCENT2 : DANGER, 0.1),
        border: `1px solid ${alpha(sim.running ? ACCENT2 : DANGER, 0.25)}` }}>
        <LiveDot color={sim.running ? ACCENT2 : DANGER} />
        <Typography variant="caption" color={sim.running ? ACCENT2 : DANGER} fontWeight={800} fontSize={11} letterSpacing={0.8}>
          {sim.running ? 'LIVE SIMULATION' : 'PAUSED'}
        </Typography>
        <Box flex={1} />
        <Typography variant="caption" color="text.secondary" fontFamily="'JetBrains Mono', monospace" fontSize={10}>t{sim.tick}</Typography>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', py: 1 }}>
        {NAV_SECTIONS.map(sec => (
          <Box key={sec.heading} sx={{ mb: 1 }}>
            <Typography variant="caption" sx={{ px: 3, color: theme.palette.text.secondary,
              fontSize: 10, fontWeight: 800, letterSpacing: 1.4, textTransform: 'uppercase', opacity: 0.7 }}>
              {sec.heading}
            </Typography>
            <Box mt={0.6}>{sec.items.map(i => <NavItem key={i.path} item={i} />)}</Box>
          </Box>
        ))}
      </Box>

      <Box sx={{ px: 1.5, pb: 1 }}>
        <Stack direction="row" spacing={0.8}>
          <MiniStat label="Nodes" value={sim.stats.totalNodes} color={ACCENT} />
          <MiniStat label="Threats" value={sim.stats.maliciousActive} color={DANGER} />
          <MiniStat label="PDR" value={`${Math.round(sim.stats.pdr)}%`} color={ACCENT2} />
        </Stack>
      </Box>

      <Divider sx={{ borderColor: theme.palette.divider, mx: 2 }} />
      <Box sx={{ p: 1.5 }}>
        <Box onClick={(e) => setAnchor(e.currentTarget)}
          sx={{ display: 'flex', alignItems: 'center', gap: 1.2, p: 1.1, borderRadius: 2.5, cursor: 'pointer',
            border: `1px solid ${theme.palette.divider}`, '&:hover': { background: alpha(ACCENT, 0.07) } }}>
          <Avatar sx={{ width: 34, height: 34, background: `linear-gradient(135deg,${ACCENT},${ACCENT2})`,
            fontSize: 14, fontWeight: 700, color: '#0b0f14' }}>
            {user?.email?.[0]?.toUpperCase() || 'O'}
          </Avatar>
          <Box minWidth={0} flex={1}>
            <Typography variant="body2" fontWeight={700} noWrap>{user?.user_metadata?.full_name || 'Operator'}</Typography>
            <Typography variant="caption" color="text.secondary" noWrap display="block">{user?.email}</Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex',
      background: dark ? BG_MESH : theme.palette.background.default, backgroundAttachment: 'fixed' }}>

      {!isMobile && (
        <Box sx={{ width: SIDEBAR_W, flexShrink: 0, position: 'sticky', top: 0, height: '100vh' }}>{SidebarInner}</Box>
      )}
      <Drawer open={mOpen} onClose={() => setMOpen(false)} PaperProps={{ sx: { width: SIDEBAR_W, border: 'none' } }}>
        {SidebarInner}
      </Drawer>

      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {sim.connected === false && (
          <Box sx={{ px: 2, py: 0.8, textAlign: 'center', fontSize: 13, fontWeight: 700,
            background: alpha(DANGER, 0.16), color: DANGER, borderBottom: `1px solid ${alpha(DANGER, 0.3)}` }}>
            Reconnecting to simulation backend… live data will resume automatically.
          </Box>
        )}
        {/* top control strip — GLOBAL simulation controls */}
        <Box sx={{ position: 'sticky', top: 0, zIndex: 10, display: 'flex', alignItems: 'center', gap: 0.8,
          px: { xs: 1.5, md: 3 }, height: 60, background: alpha(panelBg, 0.75), backdropFilter: 'blur(20px)',
          borderBottom: `1px solid ${theme.palette.divider}` }}>
          {isMobile && (
            <IconButton onClick={() => setMOpen(true)} sx={{ color: theme.palette.text.secondary }}><MenuIcon /></IconButton>
          )}

          <Tooltip title={sim.running ? 'Pause simulation' : 'Resume simulation'}>
            <IconButton size="small" onClick={() => (sim.running ? sim.pause() : sim.play())}
              sx={{ color: sim.running ? WARN : ACCENT2, border: `1px solid ${alpha(sim.running ? WARN : ACCENT2, 0.4)}`, borderRadius: 2 }}>
              {sim.running ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
            </IconButton>
          </Tooltip>

          <ToggleButtonGroup exclusive size="small" value={sim.interval}
            onChange={(_, v) => v && sim.setSpeed(v)}
            sx={{ display: { xs: 'none', sm: 'flex' }, '& .MuiToggleButton-root': { px: 1.1, py: 0.3, fontSize: 11, border: `1px solid ${theme.palette.divider}` } }}>
            {SPEEDS.map(s => <ToggleButton key={s.ms} value={s.ms}>{s.l}</ToggleButton>)}
          </ToggleButtonGroup>

          <Tooltip title="Auto-inject random attacks over time">
            <Chip icon={<BoltIcon sx={{ fontSize: 16 }} />} label="Auto-attack" size="small" clickable
              onClick={() => sim.setAutoAttack(!sim.autoAttack)}
              sx={{ display: { xs: 'none', md: 'flex' }, fontWeight: 700,
                bgcolor: alpha(sim.autoAttack ? DANGER : theme.palette.text.primary, sim.autoAttack ? 0.16 : 0.06),
                color: sim.autoAttack ? DANGER : theme.palette.text.secondary,
                border: `1px solid ${alpha(sim.autoAttack ? DANGER : theme.palette.text.primary, sim.autoAttack ? 0.4 : 0.12)}` }} />
          </Tooltip>

          <Box sx={{ flex: 1 }} />

          <Chip size="small" label={`${sim.stats.blockHeight} blocks`} sx={{ display: { xs: 'none', lg: 'flex' },
            fontFamily: '"JetBrains Mono", monospace', fontWeight: 700, bgcolor: alpha(ACCENT, 0.12), color: ACCENT }} />

          <Tooltip title={`Switch to ${mode === 'dark' ? 'Light' : 'Dark'} mode`}>
            <IconButton size="small" sx={{ color: theme.palette.text.secondary }} onClick={toggleMode}>
              {mode === 'dark' ? <Brightness7Icon fontSize="small" /> : <Brightness4Icon fontSize="small" />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Alerts">
            <IconButton size="small" sx={{ color: theme.palette.text.secondary }} onClick={() => navigate('/notifications')}>
              <Badge badgeContent={sim.stats.unread} color="error"><NotificationsIcon fontSize="small" /></Badge>
            </IconButton>
          </Tooltip>
          <Tooltip title="Settings">
            <IconButton size="small" sx={{ color: theme.palette.text.secondary }} onClick={() => navigate('/settings')}>
              <SettingsIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

        <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }} transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          PaperProps={{ sx: { mb: 1, minWidth: 220, border: `1px solid ${theme.palette.divider}` } }}>
          <Box sx={{ px: 2, py: 1.2 }}>
            <Typography variant="body2" fontWeight={700} noWrap>{user?.user_metadata?.full_name || 'Operator'}</Typography>
            <Typography variant="caption" color="text.secondary" noWrap>{user?.email}</Typography>
          </Box>
          <Divider />
          <MenuItem onClick={() => { setAnchor(null); navigate('/'); }}><HomeIcon fontSize="small" sx={{ mr: 1.5 }} /> Home</MenuItem>
          <MenuItem onClick={() => { setAnchor(null); navigate('/settings'); }}><SettingsIcon fontSize="small" sx={{ mr: 1.5 }} /> Settings</MenuItem>
          <Divider />
          <MenuItem onClick={handleSignOut} sx={{ color: theme.palette.error.main }}><LogoutIcon fontSize="small" sx={{ mr: 1.5 }} /> Sign Out</MenuItem>
        </Menu>

        <Box sx={{ flex: 1, minWidth: 0, px: { xs: 2, md: 4 }, py: 3, pb: 6 }}>
          <Outlet />
        </Box>
      </Box>

      <Snackbar open={!!toast} autoHideDuration={5000} onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <Alert severity={toast?.type === 'isolation' ? 'error' : 'warning'} variant="filled"
          onClose={() => setToast(null)} sx={{ borderRadius: 3, cursor: 'pointer', maxWidth: 360 }}
          onClick={() => { if (toast?.node_uid) navigate('/topology', { state: { selectedNode: toast.node_uid } }); setToast(null); }}>
          <Typography variant="body2" fontWeight={700}>{toast?.title}</Typography>
          {toast?.body && <Typography variant="caption" display="block">{toast.body}</Typography>}
        </Alert>
      </Snackbar>
    </Box>
  );
}
