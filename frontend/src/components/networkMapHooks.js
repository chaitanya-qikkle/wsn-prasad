import { useEffect, useMemo, useState } from 'react';
import { zoneColor } from '../utils/ui';

/*  Shared derivations for anything rendering a <NetworkMap> — used by the
 *  Topology page, the Dashboard's embedded tile and the before/after
 *  comparison, so "areas" and "Wormhole tunnels" are computed identically
 *  everywhere.                                                               */

// A recovery counts as "recent" for this long — long enough to notice on the
// map, short enough that the badge clears itself without a manual dismiss.
export const RECOVERY_WINDOW_MS = 20000;

// Group nodes under their Cluster Head ("Zone A/B/C…") and find any active
// Wormhole tunnels (two colluding nodes) to draw as links.
export function useZonesAndTunnels(nodes, byUid, recentlyRecovered) {
  const zones = useMemo(() => {
    const byZone = {};
    nodes.forEach(n => {
      if (!n.zone_label) return;
      (byZone[n.zone_label] ??= []).push(n);
    });
    return Object.entries(byZone).map(([label, members]) => {
      const cx = members.reduce((s, n) => s + n.pos_x, 0) / members.length;
      const cy = members.reduce((s, n) => s + n.pos_y, 0) / members.length;
      const radius = Math.max(14, ...members.map(n => Math.hypot(n.pos_x - cx, n.pos_y - cy))) + 8;
      const hasThreat = members.some(n => n.is_malicious && !n.is_isolated);
      const healing = members.some(n => n.is_isolated && !n.is_malicious);
      // an area is "recovered" only once nothing in it is still attacking or
      // quarantined — otherwise the tick would fire while the area is mid-repair
      const recovered = !hasThreat && !healing
        && members.some(n => recentlyRecovered?.has(n.node_uid));
      return { label, members, cx, cy, radius, color: zoneColor(label), hasThreat, healing, recovered };
    }).sort((a, b) => a.label.localeCompare(b.label));
  }, [nodes, recentlyRecovered]);

  const wormholeLinks = useMemo(() => {
    const seen = new Set();
    const links = [];
    nodes.forEach(n => {
      if (n.attack !== 'Wormhole' || !n.partner || !byUid[n.partner]) return;
      const key = [n.node_uid, n.partner].sort().join('|');
      if (seen.has(key)) return;
      seen.add(key);
      links.push({ a: n, b: byUid[n.partner] });
    });
    return links;
  }, [nodes, byUid]);

  return { zones, wormholeLinks };
}

// Node uids that recovered within the last `windowMs`, for the map's green
// "just recovered" badge. Ticks once a second so the badge fades away on its
// own instead of staying lit for the rest of the session.
export function useRecentlyRecovered(recoveryEvents, windowMs = RECOVERY_WINDOW_MS) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return useMemo(() => {
    const cutoffSec = now / 1000 - windowMs / 1000;
    const set = new Set();
    (recoveryEvents || []).forEach(e => {
      if (e.recovered_at >= cutoffSec) set.add(e.node_uid);
    });
    return set;
  }, [recoveryEvents, now, windowMs]);
}

// Everything a page needs to render the live map, derived once.
export function useLiveMap(sim) {
  const byUid = useMemo(
    () => Object.fromEntries((sim.nodes || []).map(n => [n.node_uid, n])), [sim.nodes]);
  const recentlyRecovered = useRecentlyRecovered(sim.recoveryEvents);
  const { zones, wormholeLinks } = useZonesAndTunnels(sim.nodes || [], byUid, recentlyRecovered);
  return { byUid, zones, wormholeLinks, recentlyRecovered };
}
