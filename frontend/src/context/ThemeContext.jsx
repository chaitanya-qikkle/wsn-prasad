import React, { createContext, useContext, useState, useMemo } from 'react';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';

const ThemeModeContext = createContext({ mode: 'dark', toggleMode: () => {} });

/*  TrustChain-WSN — "cyber operations console" identity (redesigned).
 *  A deep midnight base with an electric violet→aurora accent, crisp glass
 *  surfaces and neon status colours. Every live element glows.               */
export const ACCENT  = '#7c6cff';  // electric violet — primary / brand
export const ACCENT2 = '#25e6b8';  // aurora mint    — secondary / healthy
export const NEON    = '#38bdf8';  // sky            — info glow
export const DANGER  = '#ff4d6d';  // rose           — malicious / blackhole
export const WARN    = '#ffab3d';  // amber          — wormhole / suspect
export const GOLD    = '#ffd54a';  // amber accent

// App-wide background: layered aurora glows over near-black indigo.
export const BG_MESH =
  'radial-gradient(1100px 640px at 8% -8%, rgba(124,108,255,0.20), transparent 60%),' +
  'radial-gradient(900px 620px at 102% 4%, rgba(37,230,184,0.13), transparent 55%),' +
  'radial-gradient(760px 760px at 50% 118%, rgba(56,189,248,0.10), transparent 60%),' +
  '#070912';

export const GLASS = 'rgba(19,20,34,0.62)';

export function ThemeModeProvider({ children }) {
  const [mode, setMode] = useState('dark');
  const toggleMode = () => setMode(m => (m === 'dark' ? 'light' : 'dark'));
  const dark = mode === 'dark';

  const theme = useMemo(() => createTheme({
    palette: {
      mode,
      ...(dark ? {
        background: { default: '#070912', paper: GLASS },
        primary:    { main: ACCENT },
        secondary:  { main: ACCENT2 },
        error:      { main: DANGER },
        warning:    { main: WARN },
        info:       { main: NEON },
        success:    { main: ACCENT2 },
        text:       { primary: '#eef0ff', secondary: 'rgba(206,210,240,0.60)' },
        divider:    'rgba(124,108,255,0.16)',
      } : {
        background: { default: '#eceefb', paper: '#ffffff' },
        primary:    { main: '#5b4bdb' },
        secondary:  { main: '#0f9c86' },
        error:      { main: DANGER },
        warning:    { main: '#e08600' },
        info:       { main: '#0284c7' },
        success:    { main: '#0f9c86' },
        text:       { primary: '#161629', secondary: 'rgba(22,22,41,0.6)' },
        divider:    'rgba(91,75,219,0.16)',
      }),
    },
    typography: {
      fontFamily: '"Inter", "Roboto", "Helvetica", sans-serif',
      h1: { fontWeight: 800 }, h2: { fontWeight: 800 },
      h3: { fontFamily: '"JetBrains Mono", monospace', fontWeight: 700 },
      h4: { fontFamily: '"JetBrains Mono", monospace', fontWeight: 700 },
      h5: { fontFamily: '"JetBrains Mono", monospace', fontWeight: 700, letterSpacing: -0.5 },
      button: { fontWeight: 700, letterSpacing: 0.3 },
    },
    shape: { borderRadius: 16 },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          '*::-webkit-scrollbar': { width: 8, height: 8 },
          '*::-webkit-scrollbar-thumb': { background: dark ? 'rgba(124,108,255,0.28)' : 'rgba(0,0,0,0.18)', borderRadius: 8 },
          '*::-webkit-scrollbar-track': { background: 'transparent' },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            borderRadius: 18,
            backgroundColor: dark ? GLASS : '#ffffff',
            backdropFilter: dark ? 'blur(16px)' : 'none',
            border: dark ? '1px solid rgba(124,108,255,0.14)' : '1px solid rgba(0,0,0,0.06)',
            boxShadow: dark
              ? '0 10px 34px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.04)'
              : '0 6px 22px rgba(0,0,0,0.06)',
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { textTransform: 'none', fontWeight: 700, borderRadius: 12, paddingInline: 18 },
          contained: { boxShadow: `0 8px 24px ${ACCENT}40` },
          outlined: { borderWidth: 1.5, '&:hover': { borderWidth: 1.5 } },
        },
      },
      MuiChip: { styleOverrides: { root: { fontWeight: 600, borderRadius: 8 } } },
      MuiToggleButton: { styleOverrides: { root: { textTransform: 'none', fontWeight: 700, borderRadius: 10 } } },
      MuiLinearProgress: { styleOverrides: { root: { borderRadius: 999 } } },
      MuiTooltip: { styleOverrides: { tooltip: { fontSize: 12, borderRadius: 8, background: dark ? '#14162a' : '#1b1b2e',
        border: `1px solid ${dark ? 'rgba(124,108,255,0.24)' : 'rgba(255,255,255,0.1)'}` } } },
      // Popovers/menus/dialogs stay fully OPAQUE (paper is translucent glass).
      MuiPopover: { styleOverrides: { paper: { backgroundColor: dark ? '#121427' : '#ffffff', backgroundImage: 'none',
        border: `1px solid ${dark ? 'rgba(124,108,255,0.18)' : 'rgba(0,0,0,0.08)'}`,
        boxShadow: dark ? '0 20px 60px rgba(0,0,0,0.6)' : '0 12px 40px rgba(0,0,0,0.12)' } } },
      MuiMenu: { styleOverrides: { paper: { backgroundColor: dark ? '#121427' : '#ffffff', backgroundImage: 'none' } } },
      MuiDialog: { styleOverrides: { paper: { backgroundColor: dark ? '#121427' : '#ffffff', backgroundImage: 'none' } } },
      MuiAutocomplete: { styleOverrides: { paper: { backgroundColor: dark ? '#121427' : '#ffffff', backgroundImage: 'none' } } },
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
