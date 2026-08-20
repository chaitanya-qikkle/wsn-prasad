"""Asyncio ticking engine — the backend's live equivalent of the frontend's
setInterval-driven SimEngine (frontend/src/sim/engine.js).

Wraps a WSNSimulator (composition, not inheritance) and adds everything the
live console needs on top of pure simulation state: notifications, rolling
trust/metrics history, a WebSocket client registry, and action dispatch.
Runs on the same asyncio event loop as the WebSocket handlers (single
uvicorn worker — see Dockerfile), so no locking is needed between an action
arriving over a socket and the tick loop firing, as long as every mutation
here stays synchronous (no `await` in the middle of a state mutation).
"""
import asyncio
import time
import uuid
from datetime import datetime, timezone

from .network import WSNSimulator, ATTACKS, SEVERITY
from ..core.config import get_settings

HISTORY = 40


def _now_iso() -> str:
    return datetime.now(tz=timezone.utc).isoformat()


class LiveSimRunner:
    def __init__(self, n_nodes: int = 24, n_malicious: int = 4, seed: int | None = None):
        self.s = get_settings()
        self.sim = WSNSimulator(n_nodes=n_nodes, n_malicious=n_malicious, seed=seed)
        self.interval_ms = 2000
        self.auto_attack = False
        self.running = True
        self.tick = 0
        self.notifications: list[dict] = []
        self.trust_hist: list[dict] = []
        self.metrics_hist: list[dict] = []
        self.routes: list[dict] = []
        self.clients: set = set()
        self._task: asyncio.Task | None = None
        # Before / during / after network states, captured automatically as the
        # incident unfolds. Held on the server so the comparison survives a
        # page refresh and is identical for every connected client.
        self.phase_snapshots: dict[str, dict | None] = {'before': None, 'during': None, 'after': None}
        self._prev_topology: list[dict] = []
        self._prev_pdr: float = 0.0
        self._prev_malicious: int = 0
        self._incident_open: bool = False
        self._rebuild_routes()
        self._snap_metrics()
        self._snap_trust()
        self._capture_phases()

    # ── lifecycle ──────────────────────────────────────────────────────────
    def start_task(self):
        if self._task is None:
            self._task = asyncio.create_task(self.run_forever())

    async def stop_task(self):
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

    async def run_forever(self):
        while True:
            await asyncio.sleep(self.interval_ms / 1000)
            if self.running:
                self.step()
                await self._broadcast()

    # ── reset ──────────────────────────────────────────────────────────────
    def reset(self, n_nodes: int = 24, n_malicious: int = 0, seed: int | None = None):
        self.sim = WSNSimulator(n_nodes=n_nodes, n_malicious=n_malicious, seed=seed)
        self.notifications = []
        self.trust_hist = []
        self.metrics_hist = []
        self.tick = 0
        self.phase_snapshots = {'before': None, 'during': None, 'after': None}
        self._prev_topology = []
        self._prev_pdr = 0.0
        self._prev_malicious = 0
        self._incident_open = False
        self._rebuild_routes()
        self._snap_metrics()
        self._snap_trust()
        self._capture_phases()

    # ── one simulation round ──────────────────────────────────────────────
    def step(self) -> list[dict]:
        self.tick += 1

        if self.auto_attack and not self.sim.malicious_cap_reached() and self.sim.rng.random() < 0.28:
            clean = [n for n in self.sim.nodes.values()
                     if n.role != 'Sink' and not n.malicious and not n.isolated]
            if clean:
                pick = self.sim.rng.choice(clean)
                self.sim.inject_attack(pick.uid, self.sim.rng.choice(ATTACKS))

        detections = self.sim.evaluate_trust()
        if detections:
            for d in detections:
                d['id'] = uuid.uuid4().hex
                d['timestamp'] = _now_iso()
                self.notifications_from_detection(d)

        for r in self.sim.auto_remediated:
            self.notifications.insert(0, {
                'id': uuid.uuid4().hex, 'type': 'recovery', 'node_uid': r['node_uid'],
                'title': f"{r['node_uid']} remediated automatically",
                'body': (f"{r['attack_type']} behaviour scrubbed after {r['quarantine_sec']:.0f}s in "
                         f"quarantine. The node is now on probation — it rejoins routing only once "
                         f"its trust climbs back above the threshold."),
                'read': False, 'created_at': _now_iso(),
            })

        for h in self.sim.auto_healed:
            self.notifications.insert(0, {
                'id': uuid.uuid4().hex, 'type': 'recovery', 'node_uid': h['node_uid'],
                'title': f"{h['node_uid']} recovered",
                'body': (f"Trust recovered to {h['trust_after']} — out of service for "
                         f"{h['duration_sec']:.0f}s, now automatically restored to the routing pool."),
                'read': False, 'created_at': _now_iso(),
            })

        if detections or self.sim.auto_healed or self.sim.auto_remediated:
            self.notifications = (self.notifications)[:200]

        self._rebuild_routes()
        self._snap_metrics()
        self._snap_trust()
        self._capture_phases()
        return detections

    # ── before / during / after capture ───────────────────────────────────
    def _capture_phases(self):
        """Freeze the network the moment it changes incident phase.

        'before' is the last clean topology seen *prior* to the first active
        attack — so it genuinely shows the network before the attack, not one
        tick into it. 'during' tracks the worst point of the incident, and
        'after' is taken once every node is back in service. Together they are
        the before / under-attack / recovered comparison on the dashboard.
        """
        topo = self.sim.topology()
        mal = sum(1 for n in topo if n['is_malicious'] and not n['is_isolated'])
        iso = sum(1 for n in topo if n['is_isolated'])
        m = self.sim.metrics()

        def snap(nodes, pdr, tick, **kw):
            return {'nodes': [dict(n) for n in nodes], 'pdr': pdr, 'tick': tick,
                    'captured_at': time.time(),
                    'malicious': sum(1 for n in nodes if n['is_malicious'] and not n['is_isolated']),
                    'isolated': sum(1 for n in nodes if n['is_isolated']), **kw}

        disrupted = mal + iso  # nodes either attacking or out of service

        if disrupted > 0 and not self._incident_open:
            # incident starts — the *previous* tick is the clean "before", so
            # the comparison shows the network before the attack rather than
            # one round into it
            self._incident_open = True
            if self._prev_topology:
                self.phase_snapshots['before'] = snap(self._prev_topology, self._prev_pdr,
                                                      max(0, self.tick - 1))
            self.phase_snapshots['during'] = None
            self.phase_snapshots['after'] = None

        if self._incident_open:
            during = self.phase_snapshots.get('during')
            # keep the worst moment of the incident, not just its first tick.
            # Strictly greater, so a tie keeps the *earliest* worst moment —
            # the one where attackers are still live rather than already
            # quarantined, which is the more honest "under attack" picture.
            if not during or disrupted > during['malicious'] + during['isolated']:
                self.phase_snapshots['during'] = snap(topo, m['pdr'], self.tick)
                during = self.phase_snapshots['during']
            # The map is frozen at the moment the attack was most widespread,
            # but delivery only degrades over the rounds that follow it. Pairing
            # that topology with its capture-instant PDR would show a flat line
            # across before/during/after, so the figure tracks the worst
            # delivery seen at any point in the incident instead.
            during['pdr'] = min(during['pdr'], m['pdr'])
            if disrupted == 0:
                # every attacker is remediated and nothing is left quarantined
                self._incident_open = False
                self.phase_snapshots['after'] = snap(topo, m['pdr'], self.tick)

        self._prev_topology = topo
        self._prev_pdr = m['pdr']
        self._prev_malicious = mal

    def _route_sources(self):
        return [n.uid for n in self.sim.nodes.values()
                if n.role in ('Sensor', 'Relay', 'Gateway', 'Cluster Head') and not n.isolated][:8]

    def _rebuild_routes(self):
        self.routes = [r for r in (self.sim.discover_route(s) for s in self._route_sources()) if r]

    def notifications_from_detection(self, d: dict):
        is_iso = d['status'] == 'Isolated'
        self.notifications.insert(0, {
            'id': uuid.uuid4().hex, 'node_uid': d['node_uid'],
            'type': 'isolation' if is_iso else 'attack',
            'title': f"{d['node_uid']} isolated" if is_iso else f"{d['attack_type']} detected on {d['node_uid']}",
            'body': (f"Trust fell to {d['trust_after']} — quarantined and routes reconfigured."
                     if is_iso else
                     f"Trust {d['trust_before']} → {d['trust_after']}, confidence {round(d['confidence'] * 100)}%."),
            'severity': d['severity'],
            'read': False,
            'created_at': _now_iso(),
        })

    # ── history buffers ───────────────────────────────────────────────────
    def _snap_metrics(self):
        m = self.sim.metrics()
        nodes = self.sim.nodes.values()
        isolated = sum(1 for n in nodes if n.isolated)
        recovering = sum(1 for n in nodes if n.isolated and not n.malicious)
        point = {'time': datetime.now().strftime('%H:%M:%S'), 'tick': self.tick,
                 'pdr': m['pdr'], 'delay': m['avg_delay'],
                 'throughput': m['throughput'], 'energy': m['energy_avg'], 'overhead': m['overhead'],
                 'malicious': m['malicious_active'], 'isolated': isolated, 'recovering': recovering,
                 # lets the charts shade the window where the network was actually
                 # under attack, instead of leaving the reader to guess
                 'underAttack': 1 if m['malicious_active'] > 0 else 0}
        self.metrics_hist.append(point)
        if len(self.metrics_hist) > HISTORY:
            self.metrics_hist.pop(0)

    def _snap_trust(self):
        row = {'time': datetime.now().strftime('%H:%M:%S')}
        for n in self.sim.nodes.values():
            if n.role != 'Sink':
                row[n.uid] = n.trust
        self.trust_hist.append(row)
        if len(self.trust_hist) > HISTORY:
            self.trust_hist.pop(0)

    # ── user actions ──────────────────────────────────────────────────────
    def inject(self, uid: str, attack_type: str = 'Blackhole'):
        n = self.sim.inject_attack(uid, attack_type)
        if n:
            # Capture here, not on the next tick. The trust engine detects and
            # quarantines within a single evaluation round, so by the end of the
            # next step() there is nothing left "attacking" to photograph — the
            # under-attack comparison would show an already-contained network.
            self._capture_phases()
            self.notifications.insert(0, {
                'id': uuid.uuid4().hex, 'type': 'warning', 'node_uid': uid,
                'title': f'{attack_type} injected on {uid}',
                'body': 'Watch the trust engine detect, isolate, seal it on-chain and heal the node.',
                'severity': SEVERITY.get(attack_type), 'read': False, 'created_at': _now_iso(),
            })
        elif self.sim.malicious_cap_reached() and self.sim.nodes.get(uid) and not self.sim.nodes[uid].malicious:
            cap = self.sim.malicious_cap()
            self.notifications.insert(0, {
                'id': uuid.uuid4().hex, 'type': 'warning',
                'title': 'Attack cap reached',
                'body': (f'{self.sim.malicious_count()}/{cap} nodes already compromised — contain and '
                         f'recover before adding more. The network refuses to let an incident spread further.'),
                'read': False, 'created_at': _now_iso(),
            })

    def isolate(self, uid: str):
        n = self.sim.isolate_node(uid)
        if n:
            self.notifications.insert(0, {
                'id': uuid.uuid4().hex, 'type': 'isolation', 'node_uid': uid, 'title': f'{uid} manually isolated',
                'body': 'Operator quarantined the node.', 'read': False, 'created_at': _now_iso(),
            })
            self._rebuild_routes()
            self._capture_phases()

    def restore(self, uid: str):
        n = self.sim.restore_node(uid)
        if n:
            self.notifications.insert(0, {
                'id': uuid.uuid4().hex, 'type': 'recovery', 'node_uid': uid, 'title': f'{uid} restored',
                'body': 'Node returned to the routing pool.', 'read': False, 'created_at': _now_iso(),
            })
            self._rebuild_routes()
            self._capture_phases()

    def recover_all(self):
        cnt = self.sim.recover_all()
        self.notifications.insert(0, {
            'id': uuid.uuid4().hex, 'type': 'recovery', 'title': f'Recovered {cnt} node(s)',
            'body': 'All malicious / isolated nodes returned to service.', 'read': False, 'created_at': _now_iso(),
        })
        self._rebuild_routes()
        self._capture_phases()

    def play(self):
        self.running = True

    def pause(self):
        self.running = False

    def step_once(self):
        self.step()

    def set_speed(self, ms: int):
        self.interval_ms = max(200, int(ms))

    def set_auto_attack(self, on: bool):
        self.auto_attack = bool(on)

    def set_baseline_mode(self, on: bool):
        self.sim.set_baseline_mode(on)
        self.notifications.insert(0, {
            'id': uuid.uuid4().hex, 'type': 'info',
            'title': 'Existing System (no trust engine)' if on else 'Proposed System (trust engine)',
            'body': ('Switched to the baseline — detections are logged but nothing is isolated or remediated '
                     'automatically, so PDR stays degraded until an operator steps in.') if on else
                     'Switched back — the trust engine will isolate, remediate and readmit nodes on its own again.',
            'read': False, 'created_at': _now_iso(),
        })

    def clear_phases(self):
        """Drop the before/during/after capture so the next attack starts a
        fresh comparison — used by the dashboard's 'new comparison' button."""
        self.phase_snapshots = {'before': None, 'during': None, 'after': None}
        self._incident_open = False

    def mark_read(self, notif_id: str):
        for n in self.notifications:
            if n['id'] == notif_id:
                n['read'] = True
                break

    def mark_all_read(self):
        for n in self.notifications:
            n['read'] = True

    def dismiss(self, notif_id: str):
        self.notifications = [n for n in self.notifications if n['id'] != notif_id]

    # ── snapshot assembly (must match engine.js's snapshot() field-for-field) ──
    def chain_valid(self) -> bool:
        return self.sim.chain.is_valid()

    def stats(self) -> dict:
        nodes = list(self.sim.nodes.values())
        non_sink = [n for n in nodes if n.role != 'Sink']
        trusted = sum(1 for n in non_sink if n.trust >= 0.7)
        suspect = sum(1 for n in non_sink if self.s.TRUST_THRESHOLD <= n.trust < 0.7)
        below = sum(1 for n in non_sink if n.trust < self.s.TRUST_THRESHOLD or n.isolated)
        avg_trust = (sum(n.trust for n in non_sink) / len(non_sink)) if non_sink else 0.0
        m = self.sim.metrics()
        return {
            'totalNodes': len(nodes),
            'activeNodes': sum(1 for n in nodes if not n.isolated),
            'isolatedNodes': sum(1 for n in nodes if n.isolated),
            'maliciousActive': sum(1 for n in nodes if n.malicious and not n.isolated),
            'maliciousNodes': sum(1 for n in nodes if n.malicious),
            # quarantined but already scrubbed — actively healing, not a threat
            'recoveringNodes': sum(1 for n in nodes if n.isolated and not n.malicious),
            'trusted': trusted, 'suspect': suspect, 'belowThreshold': below,
            'avgTrust': round(avg_trust, 3),
            'detections': len(self.sim.detections),
            'blockHeight': self.sim.chain.head.index,
            'reroutedPaths': sum(1 for r in self.routes if r.get('reconfigured')),
            'pdr': m['pdr'],
            'delay': m['avg_delay'],
            'throughput': m['throughput'],
            'overhead': m['overhead'],
            'unread': sum(1 for n in self.notifications if not n['read']),
        }

    def snapshot(self) -> dict:
        return {
            'tick': self.tick,
            'running': self.running,
            'interval': self.interval_ms,
            'autoAttack': self.auto_attack,
            'nodes': self.sim.topology(),
            'routes': self.routes,
            'ledger': self.sim.chain.to_list()[::-1],
            'attacks': list(reversed(self.sim.detections))[:200],
            'notifications': list(self.notifications),
            'trustHist': list(self.trust_hist),
            'metricsHist': list(self.metrics_hist),
            'chainValid': self.chain_valid(),
            'metrics': self.sim.metrics(),
            'stats': self.stats(),
            'recoveryEvents': list(self.sim.recovery_events)[-100:],
            'maliciousCap': {'used': self.sim.malicious_count(), 'max': self.sim.malicious_cap()},
            'baselineMode': self.sim.baseline_mode,
            # ── recovery / timing telemetry ──
            'attackTimeline': list(reversed(self.sim.episodes))[:60],
            'recoverySummary': self.sim.recovery_summary(),
            'phaseSnapshots': self.phase_snapshots,
            'autoRecovery': {
                'enabled': bool(self.s.AUTO_RECOVERY) and not self.sim.baseline_mode,
                'quarantineTicks': self.s.QUARANTINE_TICKS,
                'rebuildRate': self.s.TRUST_REBUILD_RATE,
                'threshold': self.s.TRUST_THRESHOLD,
                'intervalMs': self.interval_ms,
            },
        }

    # ── broadcast ─────────────────────────────────────────────────────────
    async def _broadcast(self):
        if not self.clients:
            return
        msg = {'type': 'snapshot', 'payload': self.snapshot()}
        dead = set()
        for ws in self.clients:
            try:
                await ws.send_json(msg)
            except Exception:
                dead.add(ws)
        self.clients -= dead

    async def broadcast(self):
        """Public trigger for a manual/action-driven broadcast (not just tick-loop)."""
        await self._broadcast()
