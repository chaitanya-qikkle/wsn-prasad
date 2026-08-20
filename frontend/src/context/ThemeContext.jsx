import React, { createContext, useContext, useState, useMemo } from 'react';
import { ThemeProvider, createTheme, CssBaseline, alpha } from '@mui/material';

const ThemeModeContext = createContext({ mode: 'dark', toggleMode: () => {} });

/*  TrustChain-WSN — security-operations console identity.
 *
 *  Dark-first: a NOC sits in a dim room, and against deep navy the state
 *  colours (healthy / suspect / under attack / recovering) separate far more
 *  sharply than they can on white. Light mode stays available via the toggle
 *  and uses the same hues on paper surfaces.
 *
 *  The exported constants below are deliberately mid-luminance so a single
 *  value stays legible on BOTH the navy and the paper background — that is
 *  why they are not the vivid neons used for the panel chrome. Anything that
 *  only ever renders on one surface (glows, map strokes) pulls the brighter
 *  variant out of the MUI palette instead.                                   */

// ── shared state colours (safe on navy and on paper) ──────────────────────
export const ACCENT  = '#0891b2';  // cyan-600     — primary / brand
export const ACCENT2 = '#059669';  // emerald-600  — healthy / recovered
export const NEON    = '#0ea5e9';  // sky-500      — info / grayhole
export const DANGER  = '#f43f5e';  // rose-500     — malicious / blackhole
export const WARN    = '#d97706';  // amber-600    — suspect / wormhole
export const GOLD    = '#8b5cf6';  // violet-500   — sybil / identity anomaly

// ── surfaces ──────────────────────────────────────────────────────────────
export const BG_DARK       = '#0a0f1c';  // app background — deep navy
export const PANEL_DARK    = '#111a2e';  // card / panel
export const PANEL_DARK_2  = '#16203a';  // raised / hover
export const LINE_DARK     = 'rgba(56,78,120,0.45)';

export const BG_LIGHT      = '#f5f7fa';
export const PANEL_LIGHT   = '#ffffff';
export const LINE_LIGHT    = 'rgba(15,23,42,0.10)';

// kept for back-compat with older imports
export const BG_MESH = BG_LIGHT;
export const BG_MESH_DARK = BG_DARK;
export const GLASS = PANEL_LIGHT;

export function ThemeModeProvider({ children }) {
  const [mode, setMode] = useState('dark');
  const toggleMode = () => setMode(m => (m === 'dark' ? 'light' : 'dark'));
  const dark = mode === 'dark';

  const theme = useMemo(() => {
    const panel = dark ? PANEL_DARK : PANEL_LIGHT;
    const line  = dark ? LINE_DARK : LINE_LIGHT;
    return createTheme({
      palette: {
        mode,
        ...(dark ? {
          background: { default: BG_DARK, paper: PANEL_DARK },
          primary:    { main: '#22d3ee' },   // cyan-400  — vivid on navy
          secondary:  { main: '#34d399' },   // emerald-400
          error:      { main: '#fb7185' },   // rose-400
          warning:    { main: '#fbbf24' },   // amber-400
          info:       { main: '#38bdf8' },   // sky-400
          success:    { main: '#34d399' },
          text:       { primary: '#e6edf7', secondary: 'rgba(148,171,207,0.78)' },
          divider:    LINE_DARK,
        } : {
          background: { default: BG_LIGHT, paper: PANEL_LIGHT },
          primary:    { main: ACCENT },
          secondary:  { main: ACCENT2 },
          error:      { main: DANGER },
          warning:    { main: WARN },
          info:       { main: NEON },
          success:    { main: ACCENT2 },
          text:       { primary: '#0b1424', secondary: 'rgba(15,23,42,0.60)' },
          divider:    LINE_LIGHT,
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
      shape: { borderRadius: 12 },
      components: {
        MuiCssBaseline: {
          styleOverrides: {
            body: {
              // faint corner wash — gives the navy some depth without the
              // busy "mesh gradient" look the old theme had
              backgroundImage: dark
                ? `radial-gradient(1200px 600px at 15% -10%, ${alpha('#22d3ee', 0.07)}, transparent 60%),
                   radial-gradient(1000px 500px at 100% 0%, ${alpha('#8b5cf6', 0.06)}, transparent 55%)`
                : 'none',
              backgroundAttachment: 'fixed',
            },
            '*::-webkit-scrollbar': { width: 9, height: 9 },
            '*::-webkit-scrollbar-thumb': {
              background: dark ? 'rgba(94,124,175,0.35)' : 'rgba(15,23,42,0.18)',
              borderRadius: 9, border: '2px solid transparent', backgroundClip: 'content-box',
            },
            '*::-webkit-scrollbar-thumb:hover': { background: dark ? 'rgba(94,124,175,0.55)' : 'rgba(15,23,42,0.30)' },
            '*::-webkit-scrollbar-track': { background: 'transparent' },
          },
        },
        MuiCard: {
          styleOverrides: {
            root: {
              backgroundImage: 'none',
              borderRadius: 14,
              backgroundColor: panel,
              border: `1px solid ${line}`,
              boxShadow: dark
                ? '0 1px 0 rgba(255,255,255,0.03) inset, 0 8px 24px rgba(3,7,18,0.45)'
                : '0 1px 2px rgba(15,23,42,0.04), 0 4px 12px rgba(15,23,42,0.06)',
            },
          },
        },
        MuiButton: {
          defaultProps: { disableElevation: true },
          styleOverrides: {
            root: { textTransform: 'none', fontWeight: 600, borderRadius: 9, paddingInline: 18 },
            contained: { boxShadow: 'none', '&:hover': { boxShadow: 'none' } },
            outlined: { borderWidth: 1, '&:hover': { borderWidth: 1 } },
          },
        },
        MuiChip: { styleOverrides: { root: { fontWeight: 600, borderRadius: 7 } } },
        MuiToggleButton: {
          styleOverrides: {
            root: {
              textTransform: 'none', fontWeight: 600, borderRadius: 8,
              borderColor: line,
              '&.Mui-selected': {
                background: alpha(dark ? '#22d3ee' : ACCENT, dark ? 0.18 : 0.12),
                color: dark ? '#22d3ee' : ACCENT,
                '&:hover': { background: alpha(dark ? '#22d3ee' : ACCENT, dark ? 0.26 : 0.18) },
              },
            },
          },
        },
        MuiLinearProgress: { styleOverrides: { root: { borderRadius: 999 } } },
        MuiTooltip: {
          styleOverrides: {
            tooltip: {
              fontSize: 12, borderRadius: 8, padding: '7px 10px',
              background: dark ? PANEL_DARK_2 : '#0b1424',
              border: `1px solid ${dark ? 'rgba(94,124,175,0.35)' : 'rgba(255,255,255,0.10)'}`,
              boxShadow: '0 8px 24px rgba(3,7,18,0.5)',
            },
            arrow: { color: dark ? PANEL_DARK_2 : '#0b1424' },
          },
        },
        MuiPopover: {
          styleOverrides: {
            paper: {
              backgroundColor: panel, backgroundImage: 'none', border: `1px solid ${line}`,
              boxShadow: dark ? '0 16px 40px rgba(3,7,18,0.6)' : '0 8px 24px rgba(15,23,42,0.10)',
            },
          },
        },
        MuiMenu: { styleOverrides: { paper: { backgroundColor: panel, backgroundImage: 'none' } } },
        MuiDialog: { styleOverrides: { paper: { backgroundColor: panel, backgroundImage: 'none' } } },
        MuiAutocomplete: { styleOverrides: { paper: { backgroundColor: panel, backgroundImage: 'none' } } },
      },
    });
  }, [mode, dark]);

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
