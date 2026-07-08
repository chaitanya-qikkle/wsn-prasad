/*  Reconnecting WebSocket client for the live backend simulation.
 *
 *  Framework-agnostic (mirrors the old engine.js's plain-class shape) so
 *  SimContext.jsx stays focused on React glue, not socket plumbing.
 *  Buffers the last received snapshot so a late-subscribing consumer
 *  (React's useSyncExternalStore) can return synchronously.
 */

const MIN_BACKOFF = 500;
const MAX_BACKOFF = 5000;

export class WsClient {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.subs = new Set();
    this.connected = false;
    this.backoff = MIN_BACKOFF;
    this.lastSnapshot = null;
    this._closedByUser = false;
    this._reconnectTimer = null;
  }

  subscribe(fn) {
    this.subs.add(fn);
    return () => this.subs.delete(fn);
  }

  _emit() {
    this.subs.forEach((fn) => fn());
  }

  connect() {
    this._closedByUser = false;
    this._open();
  }

  _open() {
    try {
      this.ws = new WebSocket(this.url);
    } catch {
      this._scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.connected = true;
      this.backoff = MIN_BACKOFF;
      this._emit();
    };

    this.ws.onmessage = (evt) => {
      let msg;
      try {
        msg = JSON.parse(evt.data);
      } catch {
        return;
      }
      if (msg.type === 'snapshot') {
        this.lastSnapshot = { ...msg.payload, connected: true };
        this._emit();
      } else if (msg.type === 'error') {
        console.warn('[sim ws] server error:', msg.message);
      }
    };

    this.ws.onclose = () => {
      this.connected = false;
      this._emit();
      if (!this._closedByUser) this._scheduleReconnect();
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  _scheduleReconnect() {
    clearTimeout(this._reconnectTimer);
    this._reconnectTimer = setTimeout(() => this._open(), this.backoff);
    this.backoff = Math.min(this.backoff * 1.7, MAX_BACKOFF);
  }

  send(action, args = []) {
    if (!this.connected || this.ws?.readyState !== WebSocket.OPEN) {
      console.warn(`[sim ws] cannot send "${action}" — not connected`);
      return;
    }
    this.ws.send(JSON.stringify({ type: 'action', action, args }));
  }

  close() {
    this._closedByUser = true;
    clearTimeout(this._reconnectTimer);
    this.ws?.close();
  }

  getSnapshot() {
    return this.lastSnapshot || (this.lastSnapshot = { connected: this.connected });
  }
}

export function deriveWsUrl() {
  const explicit = import.meta.env.VITE_WS_URL;
  if (explicit) return explicit;
  const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8001';
  return apiBase.replace(/^http/, 'ws').replace(/\/$/, '') + '/ws/sim';
}
