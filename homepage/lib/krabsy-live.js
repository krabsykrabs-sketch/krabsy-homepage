/* ──────────────────────────────────────────────────────────────────────────
   Krabsy — live classroom client (docs/live-classroom.md, WP L4)

   One WebSocket to the relay WS /api/live/ws (api/live.py), same API host as
   the Quiz Room. Both pages use it:
     krabsy-live-tutor.js    hello {role:'tutor', token, student}
     krabsy-live-student.js  hello {role:'student', key}

   connectLive({ hello, on }) → handle
     on.ready(msg)        after every (re)connect: {role, name, tutor, adult, lesson}
     on.presence(msg)     {tutor, student, visible}
     on.message(msg)      every other relay message (state, cursor, answer, start,
                          load, cmd, point, reward, end …)
     on.status(s)         'connecting' | 'open' | 'retry' | 'closed'
     on.fatal(code)       'auth' | 'bad' | 'busy' | 'replaced': no auto-reconnect
                          (busy retries after 30 s; replaced = another tab took over)
   handle.send(t, data)   → true when sent (dropped while offline)
   handle.reconnect()     connect again now (e.g. "use this tab" after replaced)
   handle.close()
   Plus typed helpers: tutor start/load/queue/cmd/point/reward/end,
   student state/cursor/answer/focus.

   Reconnect with backoff 1 s → 15 s; a client ping every 20 s and a watchdog
   (nothing heard for 60 s → reconnect), so a sleeping laptop or a switched
   Wi-Fi comes back by itself. The relay resumes the lesson on the same hello.
   ────────────────────────────────────────────────────────────────────────── */
import { apiBase } from '/lib/krabsy-class.js?v=2026-11-25b';

const PING_MS = 20000;
const DEAD_MS = 60000;
const FATAL = new Set(['auth', 'bad', 'replaced']);

export function liveUrl() {
  return apiBase().replace(/^http/, 'ws') + '/api/live/ws';
}

export function connectLive({ hello, on = {} } = {}) {
  let ws = null, closed = false, tries = 0, retryT = null, pingT = null, heard = 0, fatal = null;
  const call = (k, ...a) => { try { if (on[k]) on[k](...a); } catch (e) { console.error('krabsy-live:', k, e); } };

  function open() {
    clearTimeout(retryT); retryT = null;
    if (closed) return;
    fatal = null;
    call('status', tries ? 'retry' : 'connecting');
    let sock;
    try { sock = new WebSocket(liveUrl()); } catch (_) { return later(); }
    ws = sock;
    sock.onopen = () => {
      if (ws !== sock) return;
      heard = Date.now();
      sock.send(JSON.stringify(Object.assign({ t: 'hello' }, typeof hello === 'function' ? hello() : hello)));
    };
    sock.onmessage = (ev) => {
      if (ws !== sock) return;
      heard = Date.now();
      let m; try { m = JSON.parse(ev.data); } catch (_) { return; }
      if (!m || typeof m !== 'object') return;
      if (m.t === 'ping') { send('pong'); return; }
      if (m.t === 'pong') return;
      if (m.t === 'ready') { tries = 0; call('status', 'open'); call('ready', m); return; }
      if (m.t === 'presence') { call('presence', m); return; }
      if (m.t === 'error') {
        if (FATAL.has(m.code) || m.code === 'busy') { fatal = m.code; call('fatal', m.code); }
        else call('message', m);       // too_big: the connection stays open
        return;
      }
      call('message', m);
    };
    sock.onclose = () => {
      if (ws !== sock) return;
      ws = null;
      if (closed) return;
      if (fatal && fatal !== 'busy') { call('status', 'closed'); return; }
      later(fatal === 'busy' ? 30000 : 0);
    };
    sock.onerror = () => {};
  }
  function later(ms) {
    if (closed || retryT) return;
    tries++;
    const wait = ms || Math.min(15000, 1000 * 2 ** Math.min(4, tries - 1)) + Math.floor(Math.random() * 400);
    call('status', 'retry');
    retryT = setTimeout(open, wait);
  }
  function send(t, data) {
    if (!ws || ws.readyState !== 1) return false;
    try { ws.send(JSON.stringify(Object.assign({}, data, { t }))); return true; } catch (_) { return false; }
  }
  pingT = setInterval(() => {
    if (!ws || ws.readyState !== 1) return;
    if (Date.now() - heard > DEAD_MS) { try { ws.close(); } catch (_) {} return; }
    send('ping');
  }, PING_MS);
  // back online / laptop woke up: try at once instead of waiting for the backoff
  const wake = () => { if (!closed && !ws && !(fatal && fatal !== 'busy')) { tries = 0; open(); } };
  const onVis = () => { if (document.visibilityState === 'visible') wake(); };
  window.addEventListener('online', wake);
  document.addEventListener('visibilitychange', onVis);

  open();
  const h = {
    send,
    get connected() { return !!(ws && ws.readyState === 1); },
    reconnect() { fatal = null; tries = 0; if (ws) { const s = ws; ws = null; try { s.close(); } catch (_) {} } open(); },
    close() { closed = true; clearTimeout(retryT); clearInterval(pingT); window.removeEventListener('online', wake); document.removeEventListener('visibilitychange', onVis); if (ws) { try { ws.close(); } catch (_) {} ws = null; } },
    // tutor
    start: (items, index) => send('start', { items, index }),
    load: (material, items, index, fresh = false) => send('load', { material, items, index, fresh: !!fresh }),
    queue: (items, index) => send('queue', { items, index }),
    cmd: (type, extra) => send('cmd', Object.assign({ type }, extra)),
    point: (pos) => send('point', pos),
    reward: (kind) => send('reward', { kind }),
    end: (summary) => send('end', { summary }),
    // student
    state: (state) => send('state', { state }),
    cursor: (pos) => send('cursor', pos),
    answer: (ans) => send('answer', ans),
    focus: (visible) => send('focus', { visible }),
  };
  return h;
}
