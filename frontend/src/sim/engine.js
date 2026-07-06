/*  TrustChain-WSN — in-browser simulation engine.
 *
 *  A faithful JavaScript port of the Python WSN simulator
 *  (backend/app/sim/network.py + blockchain.py). It runs entirely in the
 *  browser so the whole console is LIVE with real-time attacks out of the box —
 *  no Python runner and no Supabase writes required.
 *
 *  One tick = one trust-evaluation round:
 *    1. simulate a forwarding window for every node
 *    2. penalise trust for drops / delay / identity anomalies
 *    3. emit detections when a node crosses the isolation threshold
 *    4. seal ONE event-driven block per round that produced detections
 *    5. rebuild trust-aware AODV routes, recompute network metrics
 *
 *  The engine is framework-agnostic: subscribe(fn) to receive an immutable
 *  snapshot after every mutation; SimContext bridges it into React.
 */

// ── tunables (mirror backend/app/core/config.py) ───────────────────────────
export const TRUST_THRESHOLD = 0.4;   // isolate below this
const DROP_PENALTY  = 0.08;
const DELAY_PENALTY = 0.05;
const DIFFICULTY    = 2;              // leading hex-zero PoW target

export const ATTACKS = ['Blackhole', 'Sybil', 'Wormhole'];
export const SEVERITY = { Blackhole: 'Critical', Sybil: 'High', Wormhole: 'Critical' };
const DROP_RATIO = { Blackhole: 0.95, Wormhole: 0.3, Sybil: 0.2 };

const HISTORY = 40;                   // points kept in each timeseries buffer

// ── tiny deterministic hash (cyrb53) → 64-char hex, good enough for a demo ──
function cyrb53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
}
function sha(str) {
  // expand the 16-hex digest to a 64-char pseudo-hash by re-hashing chunks
  let out = '';
  for (let i = 0; i < 4; i++) out += cyrb53(str, i * 7 + 1);
  return out;
}
function merkleRoot(events) {
  if (!events.length) return sha('');
  let layer = events.map(e => sha(JSON.stringify(e)));
  while (layer.length > 1) {
    if (layer.length % 2) layer.push(layer[layer.length - 1]);
    const next = [];
    for (let i = 0; i < layer.length; i += 2) next.push(sha(layer[i] + layer[i + 1]));
    layer = next;
  }
  return layer[0];
}

let _id = 0;
const uid = () => `${Date.now().toString(36)}-${(_id++).toString(36)}`;

function rand(a, b) { return a + Math.random() * (b - a); }
function randint(a, b) { return Math.floor(rand(a, b + 1)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function dist(a, b) { return Math.hypot(a.pos_x - b.pos_x, a.pos_y - b.pos_y); }

// ── the engine ─────────────────────────────────────────────────────────────
export class SimEngine {
  constructor({ nodes = 24, malicious = 0 } = {}) {
    this.subs = new Set();
    this.timer = null;
    this.interval = 2000;
    this.autoAttack = false;
    this.tick = 0;
    this.reset({ nodes, malicious });
  }

  // ── lifecycle ──
  subscribe(fn) { this.subs.add(fn); return () => this.subs.delete(fn); }
  _emit() { const s = this.snapshot(); this.subs.forEach(fn => fn(s)); }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.step(), this.interval);
  }
  stop() { if (this.timer) { clearInterval(this.timer); this.timer = null; } this._emit(); }
  get running() { return !!this.timer; }

  setInterval_(ms) {
    this.interval = ms;
    if (this.timer) { clearInterval(this.timer); this.timer = setInterval(() => this.step(), ms); }
    this._emit();
  }
  setAutoAttack(on) { this.autoAttack = on; this._emit(); }

  // ── build / reset ──
  reset({ nodes = 24, malicious = 0 } = {}) {
    const roles = ['Sink', 'Cluster Head', 'Cluster Head', 'Cluster Head', 'Relay', 'Relay', 'Relay', 'Relay', 'Gateway'];
    while (roles.length < nodes) roles.push('Sensor');
    const malIds = new Set();
    while (malIds.size < Math.min(malicious, nodes - 1)) malIds.add(randint(2, nodes));

    this.nodes = {};
    for (let i = 1; i <= nodes; i++) {
      const u = `N-${String(i).padStart(3, '0')}`;
      const mal = malIds.has(i);
      this.nodes[u] = {
        node_uid: u,
        label: `Field Node ${u.slice(-2)}`,
        role: i === 1 ? 'Sink' : roles[i - 1],
        pos_x: +rand(4, 96).toFixed(1),
        pos_y: +rand(4, 96).toFixed(1),
        energy: +rand(55, 99).toFixed(1),
        trust_score: +rand(0.85, 0.99).toFixed(3),
        is_malicious: mal,
        attack: mal ? pick(ATTACKS) : null,
        is_isolated: false,
        status: 'Active',
        packets_fwd: 0,
        packets_drop: 0,
        avg_delay: +rand(4, 12).toFixed(1),
      };
    }

    // event-driven blockchain — start with the genesis block
    const genesis = { block_index: 0, prev_hash: '0'.repeat(64), payload: { genesis: true, network: 'Industrial-WSN' },
      trigger_type: 'genesis', validator_uid: null, difficulty: DIFFICULTY, nonce: 0, event_count: 0,
      merkle_root: merkleRoot([]), mined_at: new Date().toISOString() };
    genesis.block_hash = this._mine(genesis);
    this.ledger = [genesis];

    this.attacks = [];          // detection log (newest first)
    this.notifications = [];    // alert feed (newest first)
    this.trustHist = [];        // [{ time, N-002: .., ... }]
    this.metricsHist = [];      // [{ time, pdr, delay, throughput, energy, overhead, malicious }]
    this.detectionCount = 0;
    this.tick = 0;

    this._rebuildRoutes();
    this._snapMetrics();
    this._snapTrust();
    this._emit();
  }

  _mine(block) {
    const target = '0'.repeat(DIFFICULTY);
    block.nonce = 0;
    while (true) {
      const body = `${block.block_index}|${block.prev_hash}|${block.merkle_root}|${block.nonce}|${block.trigger_type}`;
      const h = sha(body);
      if (h.startsWith(target)) return h;
      block.nonce++;
      if (block.nonce > 200000) return h; // safety
    }
  }

  // ── one simulation round ──
  step() {
    this.tick++;

    // occasionally auto-inject an attack so the network is never idle
    if (this.autoAttack && Math.random() < 0.28) {
      const clean = Object.values(this.nodes).filter(n => n.role !== 'Sink' && !n.is_malicious && !n.is_isolated);
      if (clean.length) this.injectAttack(pick(clean).node_uid, pick(ATTACKS), false);
    }

    const detections = [];
    for (const n of Object.values(this.nodes)) {
      if (n.role === 'Sink' || n.is_isolated) continue;

      const traffic = randint(20, 60);
      let dropped, delayAnom, identity;
      if (n.is_malicious) {
        const dr = DROP_RATIO[n.attack] ?? 0.5;
        dropped = Math.floor(traffic * dr);
        delayAnom = n.attack === 'Wormhole' ? rand(2, 6) : rand(0.5, 2);
        identity = n.attack === 'Sybil';
      } else {
        dropped = Math.floor(traffic * rand(0, 0.05));
        delayAnom = rand(0, 0.8);
        identity = false;
      }

      const forwarded = traffic - dropped;
      n.packets_fwd += forwarded;
      n.packets_drop += dropped;
      n.energy = Math.max(0, n.energy - rand(0.1, 0.6));
      n.avg_delay = +(n.avg_delay * 0.7 + (6 + delayAnom * 4) * 0.3).toFixed(1);

      const trustBefore = n.trust_score;
      let penalty = (dropped / traffic) * DROP_PENALTY * 10;
      penalty += Math.max(0, delayAnom - 1) * DELAY_PENALTY;
      if (identity) penalty += 0.06;
      const recover = n.is_malicious ? 0 : 0.02;
      n.trust_score = +Math.max(0, Math.min(1, trustBefore - penalty + recover)).toFixed(3);

      const crossed = trustBefore >= TRUST_THRESHOLD && n.trust_score < TRUST_THRESHOLD;
      if (crossed || (n.is_malicious && n.trust_score < TRUST_THRESHOLD && Math.random() < 0.4)) {
        detections.push(this._makeDetection(n, trustBefore, dropped / traffic, delayAnom, identity));
      }
    }

    // event-driven: seal exactly ONE block for this round's detections
    if (detections.length) {
      const block = this._sealBlock(detections);
      this.detectionCount += detections.length;
      for (const d of detections) {
        d.id = uid();
        d.timestamp = new Date().toISOString();
        d.block_index = block.block_index;
        this.attacks.unshift(d);
        this._notify(d);
      }
      if (this.attacks.length > 200) this.attacks.length = 200;
    }

    this._rebuildRoutes();
    this._snapMetrics();
    this._snapTrust();
    this._emit();
  }

  _makeDetection(n, trustBefore, dropRatio, delayAnom, identity) {
    const attack = n.attack || 'Blackhole';
    let status, mitigation;
    if (n.trust_score < TRUST_THRESHOLD) {
      n.is_isolated = true;
      n.status = 'Isolated';
      status = 'Isolated';
      mitigation = 'Node isolated; routes reconfigured';
    } else {
      status = 'Detected';
      mitigation = 'Trust penalized; monitored';
    }
    return {
      node_uid: n.node_uid, attack_type: attack, severity: SEVERITY[attack],
      confidence: +Math.min(0.99, 0.7 + dropRatio * 0.3).toFixed(3),
      trust_before: +trustBefore.toFixed(3), trust_after: n.trust_score,
      drop_ratio: +dropRatio.toFixed(3), delay_anomaly: +delayAnom.toFixed(2),
      identity_flag: identity, status, mitigation,
    };
  }

  _sealBlock(events) {
    const head = this.ledger[this.ledger.length - 1];
    const block = {
      block_index: head.block_index + 1,
      prev_hash: head.block_hash,
      payload: { events, count: events.length },
      event_count: events.length,
      trigger_type: 'attack',
      validator_uid: 'N-001',
      difficulty: DIFFICULTY,
      merkle_root: merkleRoot(events),
      mined_at: new Date().toISOString(),
    };
    block.block_hash = this._mine(block);
    this.ledger.push(block);
    return block;
  }

  _notify(d) {
    const isIso = d.status === 'Isolated';
    this.notifications.unshift({
      id: uid(),
      type: isIso ? 'isolation' : 'attack',
      title: isIso ? `${d.node_uid} isolated` : `${d.attack_type} detected on ${d.node_uid}`,
      body: isIso
        ? `Trust fell to ${d.trust_after} — quarantined and routes reconfigured.`
        : `Trust ${d.trust_before} → ${d.trust_after}, confidence ${(d.confidence * 100).toFixed(0)}%.`,
      severity: d.severity,
      read: false,
      created_at: new Date().toISOString(),
    });
    if (this.notifications.length > 100) this.notifications.length = 100;
  }

  // ── trust-aware AODV routing ──
  discoverRoute(src, dst = 'N-001') {
    if (!this.nodes[src]) return null;
    const avoided = Object.values(this.nodes).filter(n => n.is_isolated || n.trust_score < TRUST_THRESHOLD).map(n => n.node_uid);
    const candidates = Object.values(this.nodes).filter(n => !n.is_isolated && n.trust_score >= TRUST_THRESHOLD);
    let cur = this.nodes[src];
    const hops = [src];
    const visited = new Set([src]);
    let latency = 0;
    for (let i = 0; i < 6; i++) {
      if (cur.node_uid === dst) break;
      let best = null, bestScore = Infinity;
      for (const c of candidates) {
        if (visited.has(c.node_uid)) continue;
        const score = dist(c, this.nodes[dst]) / Math.max(c.trust_score, 0.01);
        if (score < bestScore) { bestScore = score; best = c; }
      }
      if (!best) break;
      hops.push(best.node_uid);
      visited.add(best.node_uid);
      latency += dist(cur, best) * 0.8 + rand(2, 8);
      cur = best;
    }
    if (hops[hops.length - 1] !== dst) hops.push(dst);
    const trusts = hops.map(h => this.nodes[h].trust_score);
    return {
      id: `${src}-${dst}`, src_uid: src, dst_uid: dst, hops, hop_count: hops.length - 1,
      path_trust: +Math.min(...trusts).toFixed(3), latency: +latency.toFixed(1),
      is_active: true, reconfigured: avoided.length > 0,
      reason: avoided.length ? `Avoided isolated node ${avoided[0]}` : null,
    };
  }

  _rebuildRoutes() {
    const sources = Object.values(this.nodes)
      .filter(n => ['Sensor', 'Relay', 'Gateway', 'Cluster Head'].includes(n.role) && !n.is_isolated)
      .slice(0, 8).map(n => n.node_uid);
    this.routes = sources.map(s => this.discoverRoute(s)).filter(Boolean);
  }

  // ── metrics ──
  metrics() {
    const all = Object.values(this.nodes);
    const active = all.filter(n => !n.is_isolated);
    const totalFwd = all.reduce((s, n) => s + n.packets_fwd, 0);
    const totalDrop = all.reduce((s, n) => s + n.packets_drop, 0);
    const pdr = 100 * totalFwd / Math.max(1, totalFwd + totalDrop);
    const malActive = all.filter(n => n.is_malicious && !n.is_isolated).length;
    return {
      pdr: +pdr.toFixed(1),
      avg_delay: +Math.max(6, rand(12, 40) - malActive * 2).toFixed(1),
      throughput: +(180 + active.length * 5 + rand(0, 40)).toFixed(1),
      energy_avg: +(active.reduce((s, n) => s + n.energy, 0) / Math.max(1, active.length)).toFixed(1),
      alive_nodes: active.length,
      malicious_active: malActive,
      overhead: +(2.0 + this.detectionCount * 0.05).toFixed(2),
    };
  }

  _snapMetrics() {
    const m = this.metrics();
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    this.metricsHist.push({ time, pdr: m.pdr, delay: m.avg_delay, throughput: m.throughput,
      energy: m.energy_avg, overhead: m.overhead, malicious: m.malicious_active });
    if (this.metricsHist.length > HISTORY) this.metricsHist.shift();
  }

  _snapTrust() {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const row = { time };
    for (const n of Object.values(this.nodes)) if (n.role !== 'Sink') row[n.node_uid] = n.trust_score;
    this.trustHist.push(row);
    if (this.trustHist.length > HISTORY) this.trustHist.shift();
  }

  // ── user actions ──
  injectAttack(nodeUid, attackType = 'Blackhole', emit = true) {
    const n = this.nodes[nodeUid];
    if (!n || n.role === 'Sink') return;
    n.is_malicious = true;
    n.attack = attackType;
    n.is_isolated = false;
    n.status = 'Active';
    // nudge trust just above threshold so the live drop is visible within a tick or two
    n.trust_score = +Math.max(TRUST_THRESHOLD + 0.22, Math.min(n.trust_score, 0.8)).toFixed(3);
    this.notifications.unshift({ id: uid(), type: 'warning',
      title: `${attackType} injected on ${nodeUid}`,
      body: 'Watch the trust engine detect, isolate and seal it on-chain.',
      severity: SEVERITY[attackType], read: false, created_at: new Date().toISOString() });
    if (emit) this._emit();
  }

  isolateNode(nodeUid) {
    const n = this.nodes[nodeUid];
    if (!n) return;
    n.is_isolated = true; n.status = 'Isolated'; n.trust_score = 0.1;
    this.notifications.unshift({ id: uid(), type: 'isolation', title: `${nodeUid} manually isolated`,
      body: 'Operator quarantined the node.', read: false, created_at: new Date().toISOString() });
    this._rebuildRoutes(); this._emit();
  }

  restoreNode(nodeUid) {
    const n = this.nodes[nodeUid];
    if (!n) return;
    n.is_isolated = false; n.is_malicious = false; n.attack = null; n.status = 'Active'; n.trust_score = 0.85;
    this.notifications.unshift({ id: uid(), type: 'recovery', title: `${nodeUid} restored`,
      body: 'Node returned to the routing pool.', read: false, created_at: new Date().toISOString() });
    this._rebuildRoutes(); this._emit();
  }

  recoverAll() {
    let cnt = 0;
    for (const n of Object.values(this.nodes)) {
      if (n.is_malicious || n.is_isolated) { n.is_malicious = false; n.attack = null; n.is_isolated = false; n.status = 'Active'; n.trust_score = 0.85; cnt++; }
    }
    this.notifications.unshift({ id: uid(), type: 'recovery', title: `Recovered ${cnt} node(s)`,
      body: 'All malicious / isolated nodes returned to service.', read: false, created_at: new Date().toISOString() });
    this._rebuildRoutes(); this._emit();
  }

  markRead(id) { const n = this.notifications.find(x => x.id === id); if (n) n.read = true; this._emit(); }
  markAllRead() { this.notifications.forEach(n => (n.read = true)); this._emit(); }
  dismiss(id) { this.notifications = this.notifications.filter(n => n.id !== id); this._emit(); }

  chainValid() {
    for (let i = 1; i < this.ledger.length; i++) {
      if (this.ledger[i].prev_hash !== this.ledger[i - 1].block_hash) return false;
    }
    return true;
  }

  // ── immutable snapshot for React ──
  snapshot() {
    const nodes = Object.values(this.nodes).map(n => ({ ...n }));
    const m = this.metricsHist[this.metricsHist.length - 1] || {};
    const trusted = nodes.filter(n => n.role !== 'Sink' && n.trust_score >= 0.7).length;
    const suspect = nodes.filter(n => n.role !== 'Sink' && n.trust_score >= TRUST_THRESHOLD && n.trust_score < 0.7).length;
    const belowThreshold = nodes.filter(n => n.role !== 'Sink' && (n.trust_score < TRUST_THRESHOLD || n.is_isolated)).length;
    return {
      tick: this.tick,
      running: this.running,
      interval: this.interval,
      autoAttack: this.autoAttack,
      nodes,
      routes: this.routes.map(r => ({ ...r })),
      ledger: [...this.ledger],
      attacks: [...this.attacks],
      notifications: [...this.notifications],
      trustHist: [...this.trustHist],
      metricsHist: [...this.metricsHist],
      chainValid: this.chainValid(),
      metrics: this.metrics(),
      stats: {
        totalNodes: nodes.length,
        activeNodes: nodes.filter(n => !n.is_isolated).length,
        isolatedNodes: nodes.filter(n => n.is_isolated).length,
        maliciousActive: nodes.filter(n => n.is_malicious && !n.is_isolated).length,
        maliciousNodes: nodes.filter(n => n.is_malicious).length,
        trusted, suspect, belowThreshold,
        avgTrust: nodes.filter(n => n.role !== 'Sink').reduce((s, n, _, a) => s + n.trust_score / a.length, 0),
        detections: this.attacks.length,
        blockHeight: this.ledger[this.ledger.length - 1].block_index,
        reroutedPaths: this.routes.filter(r => r.reconfigured).length,
        pdr: m.pdr ?? this.metrics().pdr,
        unread: this.notifications.filter(n => !n.read).length,
      },
    };
  }
}
