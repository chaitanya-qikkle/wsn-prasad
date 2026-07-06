import React, { useState } from 'react';
import { Box, Card, Typography, Stack, Chip, Button, IconButton, alpha, useTheme } from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import DoneAllIcon       from '@mui/icons-material/DoneAll';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import GppMaybeIcon      from '@mui/icons-material/GppMaybe';
import BlockIcon         from '@mui/icons-material/Block';
import WarningAmberIcon  from '@mui/icons-material/WarningAmber';
import InfoOutlinedIcon  from '@mui/icons-material/InfoOutlined';
import { useSim } from '../sim/SimContext';
import { PageHeader, LiveDot, popIn } from '../utils/ui';
import { DANGER } from '../context/ThemeContext';

const typeColor = { attack: '#ff4d6d', isolation: '#ffab3d', recovery: '#25e6b8', warning: '#ffd54a', info: '#38bdf8' };
const typeIcon = {
  attack:    <GppMaybeIcon     sx={{ fontSize: 20, color: typeColor.attack }} />,
  isolation: <BlockIcon        sx={{ fontSize: 20, color: typeColor.isolation }} />,
  recovery:  <DoneAllIcon      sx={{ fontSize: 20, color: typeColor.recovery }} />,
  warning:   <WarningAmberIcon sx={{ fontSize: 20, color: typeColor.warning }} />,
  info:      <InfoOutlinedIcon sx={{ fontSize: 20, color: typeColor.info }} />,
};
const FILTERS = ['All', 'Unread', 'attack', 'isolation', 'recovery', 'warning'];

export default function NotificationsPage() {
  const theme = useTheme();
  const sim = useSim();
  const [filter, setFilter] = useState('All');

  const items = sim.notifications;
  const filtered = items.filter(n => filter === 'All' ? true : filter === 'Unread' ? !n.read : n.type === filter);
  const unread = items.filter(n => !n.read).length;

  return (
    <Box sx={{ maxWidth: 880, mx: 'auto' }}>
      <PageHeader icon={<NotificationsIcon />} title="Alerts" accent={DANGER}
        subtitle="Real-time network alerts — generated live as attacks, isolations and recoveries occur"
        action={
          <Stack direction="row" spacing={1} alignItems="center">
            <LiveDot color={DANGER} />
            {unread > 0 && <Chip label={`${unread} unread`} size="small" sx={{ bgcolor: alpha('#ff4d6d', 0.15), color: '#ff4d6d', fontWeight: 700 }} />}
            <Button variant="outlined" color="success" startIcon={<DoneAllIcon />} onClick={() => sim.markAllRead()} disabled={unread === 0} size="small">Mark All Read</Button>
          </Stack>
        } />

      <Stack direction="row" spacing={1} mb={2.5} flexWrap="wrap" useFlexGap>
        {FILTERS.map(f => (
          <Chip key={f} label={f} size="small" clickable onClick={() => setFilter(f)}
            sx={{ textTransform: 'capitalize',
              bgcolor: filter === f ? alpha(typeColor[f] || theme.palette.primary.main, 0.18) : alpha(theme.palette.text.primary, 0.05),
              color: filter === f ? (typeColor[f] || theme.palette.primary.main) : 'text.secondary',
              fontWeight: filter === f ? 700 : 500 }} />
        ))}
      </Stack>

      {filtered.length === 0 ? (
        <Card sx={{ p: 5, textAlign: 'center' }}>
          <NotificationsIcon sx={{ color: alpha(theme.palette.text.primary, 0.15), fontSize: 48, mb: 1 }} />
          <Typography color="text.secondary">
            {filter === 'All' ? 'No alerts yet — they appear automatically when attacks or isolations occur.' : `No ${filter} alerts.`}
          </Typography>
        </Card>
      ) : (
        <Stack spacing={1.5}>
          {filtered.map((n, i) => (
            <Card key={n.id} sx={{ p: 2, animation: i === 0 ? `${popIn} .4s ease` : 'none',
              border: `1px solid ${n.read ? theme.palette.divider : alpha(typeColor[n.type] || theme.palette.primary.main, 0.35)}`,
              background: n.read ? 'transparent' : alpha(typeColor[n.type] || theme.palette.primary.main, 0.05) }}>
              <Stack direction="row" spacing={2} alignItems="flex-start">
                <Box mt={0.3}>{typeIcon[n.type] || typeIcon.info}</Box>
                <Box flex={1} minWidth={0}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                    <Box>
                      <Typography variant="body2" fontWeight={n.read ? 500 : 800}>{n.title}</Typography>
                      {n.body && <Typography variant="caption" color="text.secondary" display="block" mt={0.3}>{n.body}</Typography>}
                    </Box>
                    <Stack direction="row" spacing={0.5} ml={1}>
                      {!n.read && <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: typeColor[n.type] || theme.palette.primary.main, mt: 0.8 }} />}
                      <IconButton size="small" onClick={() => sim.markRead(n.id)} disabled={n.read}><DoneAllIcon sx={{ fontSize: 16 }} /></IconButton>
                      <IconButton size="small" onClick={() => sim.dismiss(n.id)} sx={{ '&:hover': { color: '#ff4d6d' } }}><DeleteOutlineIcon sx={{ fontSize: 16 }} /></IconButton>
                    </Stack>
                  </Stack>
                  <Stack direction="row" spacing={1.5} alignItems="center" mt={0.8}>
                    <Chip label={n.type || 'info'} size="small" sx={{ textTransform: 'capitalize', height: 18, fontSize: 9.5, fontWeight: 700,
                      bgcolor: alpha(typeColor[n.type] || '#38bdf8', 0.12), color: typeColor[n.type] || '#38bdf8' }} />
                    <Typography variant="caption" color="text.secondary">{n.created_at ? new Date(n.created_at).toLocaleTimeString() : '—'}</Typography>
                  </Stack>
                </Box>
              </Stack>
            </Card>
          ))}
        </Stack>
      )}
    </Box>
  );
}
