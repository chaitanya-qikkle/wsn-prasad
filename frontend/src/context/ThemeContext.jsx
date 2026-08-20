import React, { createContext, useContext, useState, useMemo } from 'react';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';

const ThemeModeContext = createContext({ mode: 'light', toggleMode: () => {} });

/*  TrustChain-WSN — enterprise security console identity.
 *  Clean, light-first SaaS surface: flat cards, thin hairline borders, subtle
 *  shadows instead of glow, blue/teal brand colours. Dark mode stays available
 *  via the toggle but follows the same flat, low-glow language.               */
export const ACCENT  = '#2563eb';  // blue-600   — primary / brand
export const ACCENT2 = '#0d9488';  // teal-600   — secondary / healthy
export const NEON    = '#0284c7';  // sky-600    — info
export const DANGER  = '#dc2626';  // red-600    — malicious / blackhole
export const WARN    = '#d97706';  // amber-600  — wormhole / suspect
export const GOLD    = '#b45309';  // amber-700  — medium severity accent

// Flat app background — no mesh/glow, just a quiet neutral surface.
export const BG_MESH = '#f8fafc';
export const BG_MESH_DARK = '#0b1120';

export const GLASS = '#ffffff';

export function ThemeModeProvider({ children }) {
  const [mode, setMode] = useState('light');
  const toggleMode = () => setMode(m => (m === 'dark' ? 'light' : 'dark'));
  const dark = mode === 'dark';

  const theme = useMemo(() => createTheme({
    palette: {
      mode,
      ...(dark ? {
        background: { default: BG_MESH_DARK, paper: '#111827' },
        primary:    { main: '#3b82f6' },
        secondary:  { main: '#14b8a6' },
        error:      { main: '#f87171' },
        warning:    { main: '#f59e0b' },
        info:       { main: '#38bdf8' },
        success:    { main: '#14b8a6' },
        text:       { primary: '#f1f5f9', secondary: 'rgba(226,232,240,0.62)' },
        divider:    'rgba(148,163,184,0.16)',
      } : {
        background: { default: BG_MESH, paper: '#ffffff' },
        primary:    { main: ACCENT },
        secondary:  { main: ACCENT2 },
        error:      { main: DANGER },
        warning:    { main: WARN },
        info:       { main: NEON },
        success:    { main: ACCENT2 },
        text:       { primary: '#0f172a', secondary: 'rgba(15,23,42,0.58)' },
        divider:    'rgba(15,23,42,0.09)',
      }),
    },
    typography: {
      fontFamily: '"Inter", "Roboto", "Helvetica", sans-serif',
      h1: { fontWeight: 700 }, h2: { fontWeight: 700 },
      h3: { fontWeight: 700 },
      h4: { fontWeight: 700 },
      h5: { fontWeight: 700, letterSpacing: -0.3 },
      button: { fontWeight: 600, letterSpacing: 0.2 },
    },
    shape: { borderRadius: 10 },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          '*::-webkit-scrollbar': { width: 8, height: 8 },
          '*::-webkit-scrollbar-thumb': { background: dark ? 'rgba(148,163,184,0.25)' : 'rgba(15,23,42,0.16)', borderRadius: 8 },
          '*::-webkit-scrollbar-track': { background: 'transparent' },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            borderRadius: 12,
            backgroundColor: dark ? '#111827' : '#ffffff',
            border: `1px solid ${dark ? 'rgba(148,163,184,0.14)' : 'rgba(15,23,42,0.08)'}`,
            boxShadow: dark
              ? '0 1px 2px rgba(0,0,0,0.4)'
              : '0 1px 2px rgba(15,23,42,0.04), 0 1px 3px rgba(15,23,42,0.06)',
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { textTransform: 'none', fontWeight: 600, borderRadius: 8, paddingInline: 18 },
          contained: { boxShadow: 'none', '&:hover': { boxShadow: 'none' } },
          outlined: { borderWidth: 1, '&:hover': { borderWidth: 1 } },
        },
      },
      MuiChip: { styleOverrides: { root: { fontWeight: 600, borderRadius: 6 } } },
      MuiToggleButton: { styleOverrides: { root: { textTransform: 'none', fontWeight: 600, borderRadius: 8 } } },
      MuiLinearProgress: { styleOverrides: { root: { borderRadius: 999 } } },
      MuiTooltip: { styleOverrides: { tooltip: { fontSize: 12, borderRadius: 6, background: dark ? '#1e293b' : '#0f172a',
        border: `1px solid ${dark ? 'rgba(148,163,184,0.2)' : 'rgba(255,255,255,0.08)'}` } } },
      MuiPopover: { styleOverrides: { paper: { backgroundColor: dark ? '#111827' : '#ffffff', backgroundImage: 'none',
        border: `1px solid ${dark ? 'rgba(148,163,184,0.14)' : 'rgba(15,23,42,0.08)'}`,
        boxShadow: dark ? '0 12px 32px rgba(0,0,0,0.45)' : '0 8px 24px rgba(15,23,42,0.10)' } } },
      MuiMenu: { styleOverrides: { paper: { backgroundColor: dark ? '#111827' : '#ffffff', backgroundImage: 'none' } } },
      MuiDialog: { styleOverrides: { paper: { backgroundColor: dark ? '#111827' : '#ffffff', backgroundImage: 'none' } } },
      MuiAutocomplete: { styleOverrides: { paper: { backgroundColor: dark ? '#111827' : '#ffffff', backgroundImage: 'none' } } },
    },
  }), [mode, dark]);

  return (
    <ThemeModeContext.Provider value={{ mode, toggleMode }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
}

export const useThemeMode = () => useContext(ThemeModeContext);
