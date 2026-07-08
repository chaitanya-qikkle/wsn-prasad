import React, { createContext, useContext, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { WsClient, deriveWsUrl } from './wsClient';

/*  Single live simulation shared by the whole console, backed by the
 *  FastAPI backend over WebSocket. Every page reads the current snapshot
 *  via useSim() and re-renders on each server-pushed update, so attacks
 *  injected anywhere (any tab, or directly via REST) are reflected
 *  everywhere in real time — the backend is the single source of truth.  */

const SimContext = createContext(null);

export function SimProvider({ children }) {
  // one client instance for the app lifetime
  const clientRef = useRef(null);
  if (!clientRef.current) clientRef.current = new WsClient(deriveWsUrl());
  const client = clientRef.current;

  useEffect(() => {
    client.connect();
    return () => client.close();
  }, [client]);

  const snapshot = useSyncExternalStore(
    (cb) => client.subscribe(cb),
    () => client.getSnapshot(),
  );

  const actions = useMemo(() => ({
    inject:      (uid, type) => client.send('inject', [uid, type]),
    isolate:     (uid) => client.send('isolate', [uid]),
    restore:     (uid) => client.send('restore', [uid]),
    recoverAll:  () => client.send('recoverAll'),
    reset:       (opts) => client.send('reset', [opts]),
    play:        () => client.send('play'),
    pause:       () => client.send('pause'),
    step:        () => client.send('step'),
    setSpeed:    (ms) => client.send('setSpeed', [ms]),
    setAutoAttack: (on) => client.send('setAutoAttack', [on]),
    markRead:    (id) => client.send('markRead', [id]),
    markAllRead: () => client.send('markAllRead'),
    dismiss:     (id) => client.send('dismiss', [id]),
  }), [client]);

  const value = useMemo(() => ({ ...EMPTY_SNAPSHOT, ...snapshot, ...actions }), [snapshot, actions]);

  return <SimContext.Provider value={value}>{children}</SimContext.Provider>;
}

// shape mirrors the backend's LiveSimRunner.snapshot() — safe defaults so
// pages don't need null-guards before the first WS message arrives
const EMPTY_SNAPSHOT = {
  tick: 0, running: false, interval: 2000, autoAttack: false, connected: false,
  nodes: [], routes: [], ledger: [], attacks: [], notifications: [],
  trustHist: [], metricsHist: [], chainValid: true, metrics: {},
  stats: { totalNodes: 0, activeNodes: 0, isolatedNodes: 0, maliciousActive: 0,
    maliciousNodes: 0, trusted: 0, suspect: 0, belowThreshold: 0, avgTrust: 0,
    detections: 0, blockHeight: 0, reroutedPaths: 0, pdr: 0, unread: 0 },
};

export function useSim() {
  const ctx = useContext(SimContext);
  if (!ctx) throw new Error('useSim must be used inside <SimProvider>');
  return ctx;
}
