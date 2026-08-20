import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, alpha, useTheme, Tooltip, Stack, IconButton } from '@mui/material';
import AddIcon        from '@mui/icons-material/Add';
import RemoveIcon     from '@mui/icons-material/Remove';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
import { trustColor, ISOLATION_TREATMENT, pulse, ATTACK_COLORS } from '../utils/ui';
import { ACCENT, ACCENT2, WARN, DANGER } from '../context/ThemeContext';

/*  Shared field-map renderer — used by the Topology page (full detail, with
 *  Node Inspector / Active Routes side panels), the Dashboard's embedded live
 *  tile, and the before/during/after comparison. One component means every
 *  view of the field is visually identical instead of several hand-maintained
 *  SVGs drifting apart.
 *
 *  Interactive: scroll to zoom around the cursor, drag to pan, double-click to
 *  reset. Hovering a node dims everything it is not connected to, which is the
 *  only practical way to read a single route out of two dozen overlapping
 *  ones.                                                                     */

const VB = { w: 1000, h: 600 };
const X = (x) => 40 + (x / 100) * 920;
const Y = (y) => 30 + (y / 100) * 540;
const MIN_ZOOM = 1, MAX_ZOOM = 6;

export default function NetworkMap({
  nodes, routes = [], zones = [], wormholeLinks = [], selected, onSelect,
  activeZone = null, recentlyRecovered, compact = false, interactive = true,
  frozen = false,   // a captured snapshot — no live packet animation
}) {
  const theme = useTheme();
  const grid = theme.palette.divider;
  const paper = theme.palette.background.paper;
  const byUid = useMemo(() => Object.fromEntries(nodes.map(n => [n.node_uid, n])), [nodes]);
  const recovered = recentlyRecovered || new Set();
  const animate = !frozen;

  // ── pan / zoom ──────────────────────────────────────────────────────────
  const svgRef = useRef(null);
  const [view, setView] = useState({ x: 0, y: 0, z: 1 });
  const drag = useRef(null);
  const reset = useCallback(() => setView({ x: 0, y: 0, z: 1 }), []);

  const clamp = (v) => {
    const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.z));
    const maxX = VB.w - VB.w / z, maxY = VB.h - VB.h / z;
    return { z, x: Math.min(maxX, Math.max(0, v.x)), y: Math.min(maxY, Math.max(0, v.y)) };
  };

  const zoomBy = useCallback((factor, originX = 0.5, originY = 0.5) => {
    setView(v => {
      const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.z * factor));
      // keep the point under the cursor fixed while the scale changes
      const wx = v.x + (VB.w / v.z) * originX;
      const wy = v.y + (VB.h / v.z) * originY;
      return clamp({ z, x: wx - (VB.w / z) * originX, y: wy - (VB.h / z) * originY });
    });
  }, []);

  // React routes wheel through a passive root listener, so preventDefault is
  // only honoured on a natively-attached non-passive one.
  useEffect(() => {
    const el = svgRef.current;
    if (!el || !interactive) return;
    const onWheel = (e) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomBy(e.deltaY < 0 ? 1.18 : 1 / 1.18,
        (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [interactive, zoomBy]);

  const onPointerDown = (e) => {
    if (!interactive || view.z <= 1) return;
    drag.current = { px: e.clientX, py: e.clientY, ox: view.x, oy: view.y };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const r = svgRef.current.getBoundingClientRect();
    const sx = (VB.w / view.z) / r.width, sy = (VB.h / view.z) / r.height;
    setView(v => clamp({ ...v, x: d.ox - (e.clientX - d.px) * sx, y: d.oy - (e.clientY - d.py) * sy }));
  };
  const endDrag = () => { drag.current = null; };

  // ── hover focus ─────────────────────────────────────────────────────────
  const [hover, setHover] = useState(null);
  // uids that share a route with the hovered node — everything else fades back
  const linked = useMemo(() => {
    if (!hover) return null;
    const set = new Set([hover]);
    routes.forEach(r => { if ((r.hops || []).includes(hover)) (r.hops || []).forEach(h => set.add(h)); });
    wormholeLinks.forEach(({ a, b }) => {
      if (a.node_uid === hover) set.add(b.node_uid);
      if (b.node_uid === hover) set.add(a.node_uid);
    });
    return set;
  }, [hover, routes, wormholeLinks]);

  const faded = (uids) => {
    if (linked && !uids.some(u => linked.has(u))) return 0.1;
    if (activeZone) {
      const inZone = uids.some(u => byUid[u]?.zone_label === activeZone);
      if (!inZone) return 0.14;
    }
    return 1;
  };

  const vb = `${view.x} ${view.y} ${VB.w / view.z} ${VB.h / view.z}`;
  const s = 1 / view.z;  // keep strokes/labels a constant on-screen size while zoomed

  return (
    <Box sx={{ position: 'relative' }}>
      <Box component="svg" ref={svgRef} viewBox={vb}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove}
        onPointerUp={endDrag} onPointerLeave={() => { endDrag(); setHover(null); }}
        onDoubleClick={reset}
        sx={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none',
          cursor: !interactive ? 'default' : view.z > 1 ? (drag.current ? 'grabbing' : 'grab') : 'default' }}>
        <defs>
          <radialGradient id="sinkGlow">
            <stop offset="0%" stopColor={alpha(ACCENT, 0.45)} /><stop offset="100%" stopColor={alpha(ACCENT, 0)} />
          </radialGradient>
        </defs>

        {!compact && Array.from({ length: 11 }).map((_, i) => (
          <line key={'v' + i} x1={40 + i * 92} y1={30} x2={40 + i * 92} y2={570} stroke={grid} strokeWidth={0.5 * s} />
        ))}
        {!compact && Array.from({ length: 7 }).map((_, i) => (
          <line key={'h' + i} x1={40} y1={30 + i * 90} x2={960} y2={30 + i * 90} stroke={grid} strokeWidth={0.5 * s} />
        ))}

        {/* zone areas — soft boundary + label per Cluster Head grouping */}
        {zones.map(z => {
          const rx = (z.radius / 100) * 920, ry = (z.radius / 100) * 540;
          const op = faded(z.members.map(m => m.node_uid));
          return (
            <g key={z.label} opacity={op} style={{ transition: 'opacity .2s' }}>
              <ellipse cx={X(z.cx)} cy={Y(z.cy)} rx={rx} ry={ry}
                fill={alpha(z.color, z.hasThreat ? 0.1 : 0.05)}
                stroke={alpha(z.color, z.hasThreat ? 0.65 : 0.38)}
                strokeWidth={(z.hasThreat ? 1.8 : 1.2) * s} strokeDasharray={`${6 * s} ${5 * s}`} />
              {!compact && (
                <text x={X(z.cx)} y={Y(z.cy) - ry - 8 * s} fontSize={11 * s} fontWeight={800}
                  textAnchor="middle" fill={z.color}>
                  {z.label}{z.hasThreat ? ' ⚠' : z.recovered ? ' ✓' : ''}
                </text>
              )}
            </g>
          );
        })}

        {/* Wormhole tunnels — the one attack that lives between two nodes, not
            inside one, so it gets a link rather than a ring: a private
            out-of-band channel with packets shuttling both ways. */}
        {wormholeLinks.map(({ a, b }) => {
          const x1 = X(a.pos_x), y1 = Y(a.pos_y), x2 = X(b.pos_x), y2 = Y(b.pos_y);
          const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
          const C = ATTACK_COLORS.Wormhole;
          const op = faded([a.node_uid, b.node_uid]);
          return (
            <g key={`wh-${a.node_uid}-${b.node_uid}`} opacity={op} style={{ transition: 'opacity .2s' }}>
              {/* soft halo so the tunnel reads as a channel, not just a line */}
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={alpha(C, 0.18)} strokeWidth={9 * s} strokeLinecap="round" />
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={C} strokeWidth={2.4 * s}
                strokeDasharray={`${3 * s} ${6 * s}`} strokeLinecap="round" opacity={0.9}>
                {animate && <animate attributeName="stroke-dashoffset" values={`0;${-18 * s}`} dur="1s" repeatCount="indefinite" />}
              </line>

              {/* packets shuttling in both directions — the "data sharing"
                  between the colluding pair that defines the attack */}
              {animate && [0, 1].map(dir => (
                <circle key={dir} r={2.8 * s} fill={C} opacity={dir ? 0.75 : 1}>
                  <animate attributeName="cx" values={dir ? `${x2};${x1}` : `${x1};${x2}`} dur="1.4s" repeatCount="indefinite" />
                  <animate attributeName="cy" values={dir ? `${y2};${y1}` : `${y1};${y2}`} dur="1.4s" repeatCount="indefinite" />
                </circle>
              ))}

              {/* both endpoints marked, so it is obvious this takes two nodes */}
              {[[x1, y1], [x2, y2]].map(([px, py], i) => (
                <circle key={i} cx={px} cy={py} r={13 * s} fill="none" stroke={C} strokeWidth={1.4 * s}
                  strokeDasharray={`${4 * s} ${3 * s}`} opacity={0.9}>
                  {animate && <animateTransform attributeName="transform" type="rotate"
                    from={`0 ${px} ${py}`} to={`360 ${px} ${py}`} dur="4s" repeatCount="indefinite" />}
                </circle>
              ))}

              {/* tunnel mouth at the midpoint */}
              <g>
                <circle cx={mx} cy={my} r={9 * s} fill={paper} stroke={C} strokeWidth={1.2 * s} />
                <circle cx={mx} cy={my} r={5 * s} fill="none" stroke={C} strokeWidth={1.2 * s} />
                <circle cx={mx} cy={my} r={1.8 * s} fill={C} />
              </g>
              {!compact && (
                <text x={mx} y={my - 14 * s} fontSize={9 * s} fontWeight={800} textAnchor="middle"
                  fill={C} letterSpacing={0.6 * s}>TUNNEL</text>
              )}
            </g>
          );
        })}

        {/* routes + animated packets */}
        {routes.map((r, ri) => {
          const pts = (r.hops || []).map(h => byUid[h]).filter(Boolean);
          const op = faded(pts.map(p => p.node_uid));
          return pts.slice(0, -1).map((p, i) => {
            const q = pts[i + 1];
            const stroke = r.reconfigured ? WARN : alpha(ACCENT, 0.55);
            return (
              <g key={`r${ri}-${i}`} opacity={op} style={{ transition: 'opacity .2s' }}>
                <line x1={X(p.pos_x)} y1={Y(p.pos_y)} x2={X(q.pos_x)} y2={Y(q.pos_y)}
                  stroke={stroke} strokeWidth={1.6 * s}
                  strokeDasharray={r.reconfigured ? `${5 * s} ${4 * s}` : 'none'} />
                {!compact && animate && (
                  <circle r={2.6 * s} fill={r.reconfigured ? WARN : ACCENT}>
                    <animate attributeName="cx" values={`${X(p.pos_x)};${X(q.pos_x)}`} dur="1.6s" repeatCount="indefinite" />
                    <animate attributeName="cy" values={`${Y(p.pos_y)};${Y(q.pos_y)}`} dur="1.6s" repeatCount="indefinite" />
                  </circle>
                )}
              </g>
            );
          });
        })}

        {nodes.map(n => {
          const isSink = n.role === 'Sink';
          // A quarantined node that has already been scrubbed is healing, not
          // hostile — it gets its own colour so "recovering" never looks the
          // same as "under attack".
          const healing = n.is_isolated && !n.is_malicious;
          const c = n.is_malicious ? DANGER : n.is_isolated ? (healing ? ACCENT : DANGER) : trustColor(n.trust_score);
          const r = (isSink ? 16 : n.role === 'Cluster Head' ? 12 : 9) * s;
          const hot = n.is_malicious;
          const cx = X(n.pos_x), cy = Y(n.pos_y);
          const treatment = ISOLATION_TREATMENT[n.attack || n.last_attack];
          const justRecovered = recovered.has(n.node_uid);
          const op = faded([n.node_uid]);
          const tip = [
            n.node_uid, n.role, `trust ${n.trust_score?.toFixed(2)}`,
            n.zone_label,
            n.is_malicious ? `ATTACKING · ${n.attack}`
              : healing ? 'RECOVERING — rebuilding trust'
              : justRecovered ? 'RECOVERED' : null,
          ].filter(Boolean).join(' · ');

          return (
            <Tooltip key={n.node_uid} title={tip} arrow>
              <g style={{ cursor: onSelect ? 'pointer' : 'default', opacity: op, transition: 'opacity .2s' }}
                onClick={() => onSelect?.(n.node_uid)}
                onPointerEnter={() => interactive && setHover(n.node_uid)}
                onPointerLeave={() => interactive && setHover(null)}>
                {isSink && <circle cx={cx} cy={cy} r={30 * s} fill="url(#sinkGlow)" />}
                {selected === n.node_uid && (
                  <circle cx={cx} cy={cy} r={r + 8 * s} fill="none" stroke={ACCENT} strokeWidth={2 * s} />
                )}

                {/* isolation "trick" — a distinct ring treatment per attack type,
                    so the map says which attack was caught, not just that one was */}
                {n.is_isolated && n.is_malicious && treatment ? (
                  Array.from({ length: treatment.rings }).map((_, k) => (
                    <circle key={k} cx={cx} cy={cy} r={r + (6 + k * 4) * s} fill="none" stroke={c}
                      strokeWidth={1.6 * s} strokeDasharray={treatment.dash === 'none' ? undefined
                        : treatment.dash.split(' ').map(v => +v * s).join(' ')} opacity={0.8 - k * 0.25}>
                      {treatment.ringAnim === pulse
                        ? <animate attributeName="opacity" values="0.85;0.25;0.85" dur="1.6s" repeatCount="indefinite" />
                        : <animateTransform attributeName="transform" type="rotate"
                            from={`0 ${cx} ${cy}`} to={`360 ${cx} ${cy}`} dur="3s" repeatCount="indefinite" />}
                    </circle>
                  ))
                ) : hot && (
                  <circle cx={cx} cy={cy} r={r + 5 * s} fill="none" stroke={c} strokeWidth={1.5 * s} opacity={0.6}>
                    {animate && <>
                      <animate attributeName="r" values={`${r + 3 * s};${r + 10 * s}`} dur="1.4s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.6;0" dur="1.4s" repeatCount="indefinite" />
                    </>}
                  </circle>
                )}

                {/* healing — an arc that fills as trust rebuilds toward readmission */}
                {healing && (
                  <TrustArc cx={cx} cy={cy} r={r + 6 * s} pct={Math.min(1, (n.trust_score || 0) / 0.65)}
                    color={ACCENT} width={2 * s} />
                )}

                {/* recovery confirmation — held briefly, then the caller stops
                    passing this uid and it fades out on its own */}
                {justRecovered && !hot && !healing && (
                  <circle cx={cx} cy={cy} r={r + 6 * s} fill="none" stroke={ACCENT2} strokeWidth={1.8 * s} opacity={0.85}>
                    {animate && <>
                      <animate attributeName="r" values={`${r + 3 * s};${r + 10 * s}`} dur="1.2s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.85;0.1;0.85" dur="1.2s" repeatCount="indefinite" />
                    </>}
                  </circle>
                )}

                <circle cx={cx} cy={cy} r={r} fill={alpha(c, 0.85)} stroke={c} strokeWidth={2 * s} />
                {isSink && (
                  <circle cx={cx} cy={cy} r={r + 4 * s} fill="none" stroke={c} strokeWidth={s}
                    strokeDasharray={`${3 * s} ${3 * s}`} />
                )}

                {n.is_isolated && n.is_malicious && treatment && (
                  <g>
                    <circle cx={cx + r - 2 * s} cy={cy - r + 2 * s} r={6.5 * s} fill={paper} stroke={c} strokeWidth={s} />
                    <AttackBadgeGlyph attack={n.attack} cx={cx + r - 2 * s} cy={cy - r + 2 * s} color={c} s={s} />
                  </g>
                )}
                {healing && (
                  <g>
                    <circle cx={cx + r - 2 * s} cy={cy - r + 2 * s} r={6.5 * s} fill={paper} stroke={ACCENT} strokeWidth={s} />
                    <HealGlyph cx={cx + r - 2 * s} cy={cy - r + 2 * s} color={ACCENT} s={s} />
                  </g>
                )}
                {justRecovered && !hot && !healing && (
                  <g>
                    <circle cx={cx + r - 2 * s} cy={cy - r + 2 * s} r={6.5 * s} fill={paper} stroke={ACCENT2} strokeWidth={s} />
                    <path d={`M ${cx + r - 4.5 * s} ${cy - r + 2 * s} l ${1.6 * s} ${1.8 * s} l ${3 * s} ${-3.4 * s}`}
                      fill="none" stroke={ACCENT2} strokeWidth={1.4 * s} strokeLinecap="round" strokeLinejoin="round" />
                  </g>
                )}

                {!compact && (
                  <text x={cx} y={cy - r - 5 * s} fontSize={10 * s} textAnchor="middle"
                    fill={theme.palette.text.secondary} fontFamily="'JetBrains Mono', monospace">{n.node_uid}</text>
                )}
              </g>
            </Tooltip>
          );
        })}
      </Box>

      {interactive && (
        <Stack spacing={0.5} sx={{ position: 'absolute', right: 8, bottom: 8 }}>
          {[
            { icon: <AddIcon sx={{ fontSize: 16 }} />, on: () => zoomBy(1.4), t: 'Zoom in' },
            { icon: <RemoveIcon sx={{ fontSize: 16 }} />, on: () => zoomBy(1 / 1.4), t: 'Zoom out' },
            { icon: <CenterFocusStrongIcon sx={{ fontSize: 16 }} />, on: reset, t: 'Reset view' },
          ].map(b => (
            <Tooltip key={b.t} title={b.t} placement="left">
              <IconButton size="small" onClick={b.on}
                sx={{ bgcolor: alpha(paper, 0.9), border: `1px solid ${grid}`, borderRadius: 1.5,
                  '&:hover': { bgcolor: paper } }}>{b.icon}</IconButton>
            </Tooltip>
          ))}
        </Stack>
      )}
    </Box>
  );
}

// Progress arc drawn clockwise from 12 o'clock — how far a quarantined node
// has rebuilt its trust toward the readmission bar.
function TrustArc({ cx, cy, r, pct, color, width }) {
  const circ = 2 * Math.PI * r;
  return (
    <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round"
      strokeDasharray={circ} strokeDashoffset={circ * (1 - Math.max(0, Math.min(1, pct)))}
      transform={`rotate(-90 ${cx} ${cy})`} opacity={0.95}
      style={{ transition: 'stroke-dashoffset .6s ease' }} />
  );
}

// Tiny hand-drawn glyphs, one per attack type — plain SVG primitives only.
// (A React icon component rendered as a nested <svg> inside this hand-authored
// map does not size reliably across browsers, so no MUI icons in here.)
function AttackBadgeGlyph({ attack, cx, cy, color, s = 1 }) {
  const w = 1.2 * s;
  switch (attack) {
    case 'Blackhole':
      return <g><circle cx={cx} cy={cy} r={3.4 * s} fill="none" stroke={color} strokeWidth={w} />
        <line x1={cx - 2.4 * s} y1={cy - 2.4 * s} x2={cx + 2.4 * s} y2={cy + 2.4 * s} stroke={color} strokeWidth={w} /></g>;
    case 'Sybil':
      return <g>
        <line x1={cx} y1={cy + 2.6 * s} x2={cx} y2={cy - 0.5 * s} stroke={color} strokeWidth={w} />
        <line x1={cx} y1={cy - 0.5 * s} x2={cx - 2.4 * s} y2={cy - 2.8 * s} stroke={color} strokeWidth={w} />
        <line x1={cx} y1={cy - 0.5 * s} x2={cx + 2.4 * s} y2={cy - 2.8 * s} stroke={color} strokeWidth={w} />
      </g>;
    case 'Wormhole':
      return <g><circle cx={cx} cy={cy} r={3.2 * s} fill="none" stroke={color} strokeWidth={w} />
        <circle cx={cx} cy={cy} r={s} fill={color} /></g>;
    case 'Grayhole':
      return <g><ellipse cx={cx} cy={cy} rx={3.4 * s} ry={2 * s} fill="none" stroke={color} strokeWidth={1.1 * s} />
        <line x1={cx - 3 * s} y1={cy + 2.4 * s} x2={cx + 3 * s} y2={cy - 2.4 * s} stroke={color} strokeWidth={w} /></g>;
    default:
      return <circle cx={cx} cy={cy} r={2 * s} fill={color} />;
  }
}

// "healing" plus-sign badge for a node on probation
function HealGlyph({ cx, cy, color, s = 1 }) {
  return (
    <g stroke={color} strokeWidth={1.4 * s} strokeLinecap="round">
      <line x1={cx - 2.6 * s} y1={cy} x2={cx + 2.6 * s} y2={cy} />
      <line x1={cx} y1={cy - 2.6 * s} x2={cx} y2={cy + 2.6 * s} />
    </g>
  );
}

export { X, Y };
