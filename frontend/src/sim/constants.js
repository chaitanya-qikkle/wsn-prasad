// Mirrors backend/app/core/config.py Settings.TRUST_THRESHOLD — the trust
// score below which a node is isolated from routing.
export const TRUST_THRESHOLD = 0.4;

// The standard names of the algorithms the backend implements, as they appear
// in the WSN / MANET literature.
export const ALGORITHMS = {
  detection: { name: 'Weighted Trust Evaluation (WTE)', ref: 'Atakli et al., 2008' },
  routing:   { name: 'Trust-Aware AODV (TA-AODV)', ref: 'AODV — Perkins & Royer, 1999' },
  recovery:  { name: 'Second-Chance Redemption', ref: 'CONFIDANT — Buchegger & Le Boudec, 2002' },
  ledger:    { name: 'Event-Triggered Proof-of-Work (SHA-256 + Merkle tree)', ref: 'Nakamoto, 2008' },
};

// Battery level → colour band used everywhere a battery is drawn.
export const batteryLevel = (pct) => (pct > 50 ? 'good' : pct > 20 ? 'low' : 'critical');

// Seconds of battery left at the node's current drain rate (% per round).
export const batteryLifeSec = (node, intervalMs = 2000) =>
  node?.drain_rate > 0 ? (node.energy / node.drain_rate) * (intervalMs / 1000) : null;
