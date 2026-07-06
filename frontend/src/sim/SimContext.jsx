import React, { createContext, useContext, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { SimEngine } from './engine';

/*  Single live simulation shared by the whole console.
 *  Every page reads the current snapshot via useSim() and re-renders on each
 *  tick, so attacks injected anywhere are reflected everywhere in real time.  */

const SimContext = createContext(null);

export function SimProvider({ children }) {
  // one engine instance for the app lifetime
  const engineRef = useRef(null);
  if (!engineRef.current) engineRef.current = new SimEngine({ nodes: 24, malicious: 0 });
  const engine = engineRef.current;

  // start the live loop on mount
  useEffect(() => {
    engine.start();
    return () => engine.stop();
  }, [engine]);

  // subscribe React to engine snapshots. The engine emits a fresh immutable
  // snapshot on every mutation; we cache it so getSnapshot stays referentially
  // stable between emits (a requirement of useSyncExternalStore).
  const snapshot = useSyncExternalStore(
    (cb) => engine.subscribe((s) => { engine._lastSnap = s; cb(); }),
    () => engine._lastSnap || (engine._lastSnap = engine.snapshot()),
  );

  const actions = useMemo(() => ({
    inject:      (uid, type) => engine.injectAttack(uid, type),
    isolate:     (uid) => engine.isolateNode(uid),
    restore:     (uid) => engine.restoreNode(uid),
    recoverAll:  () => engine.recoverAll(),
    reset:       (opts) => engine.reset(opts),
    play:        () => engine.start(),
    pause:       () => engine.stop(),
    step:        () => engine.step(),
    setSpeed:    (ms) => engine.setInterval_(ms),
    setAutoAttack: (on) => engine.setAutoAttack(on),
    markRead:    (id) => engine.markRead(id),
    markAllRead: () => engine.markAllRead(),
    dismiss:     (id) => engine.dismiss(id),
  }), [engine]);

  const value = useMemo(() => ({ ...snapshot, ...actions }), [snapshot, actions]);

  return <SimContext.Provider value={value}>{children}</SimContext.Provider>;
}

export function useSim() {
  const ctx = useContext(SimContext);
  if (!ctx) throw new Error('useSim must be used inside <SimProvider>');
  return ctx;
}
