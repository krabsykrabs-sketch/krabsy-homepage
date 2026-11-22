// WebSocket connection to the room server (api/quiz_room.py).
// Server: wss://api.krabsy.com on the site, ws://<host>:8150 in local dev, or ?server=<url>.
// Reconnects by itself and re-sends the last "hello" (join / resume) so a child whose
// laptop slept, or a teacher who reloaded, comes back into the same room.

export function serverUrl() {
  const o = new URLSearchParams(location.search).get('server');
  if (o) return o;
  if (/(^|\.)krabsy\.com$/.test(location.hostname)) return 'wss://api.krabsy.com/api/quiz/ws';
  return `ws://${location.hostname || 'localhost'}:8150/api/quiz/ws`;  // local API: uvicorn --port 8150 (8000 = homepage preview)
}

export class Net {
  constructor(url = serverUrl()) {
    this.url = url;
    this.handlers = new Map();
    this.hello = null;      // message that (re)enters the room after a reconnect
    this.ws = null;
    this.closedByUs = false;
    this.retry = 0;
    this.status = 'idle';   // idle | connecting | open | lost
  }

  on(type, fn) { this.handlers.set(type, fn); return this; }
  emit(type, msg) { const f = this.handlers.get(type); if (f) f(msg); }

  connect() {
    return new Promise((resolve, reject) => {
      this.status = 'connecting';
      let ws;
      try { ws = new WebSocket(this.url); } catch (e) { reject(e); return; }
      this.ws = ws;
      let opened = false;
      ws.onopen = () => {
        opened = true; this.retry = 0; this.status = 'open';
        if (this.hello) this.send(this.hello);
        this.emit('_status', 'open');
        resolve();
      };
      ws.onmessage = (ev) => {
        let msg; try { msg = JSON.parse(ev.data); } catch (_) { return; }
        this.emit(msg.t, msg);
      };
      ws.onclose = () => {
        if (!opened) reject(new Error('no connection'));
        if (this.ws !== ws) return;
        this.status = 'lost';
        this.emit('_status', 'lost');
        if (this.closedByUs) return;
        // Back off: 0.5 s, 1 s, 2 s … max 8 s.
        const wait = Math.min(8000, 500 * 2 ** this.retry++);
        setTimeout(() => { if (!this.closedByUs) this.connect().catch(() => {}); }, wait);
      };
    });
  }

  send(msg) {
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(msg));
  }

  // Remember the message that enters the room, and send it now.
  enter(msg) { this.hello = msg; this.send(msg); }

  close() { this.closedByUs = true; try { this.ws?.close(); } catch (_) {} }
}

// Room codes are shown as QR7-K2M; typed in any case, with or without the dash.
export const normCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
export const showCode = (c) => (c && c.length === 6 ? `${c.slice(0, 3)}-${c.slice(3)}` : c || '');
