/* ──────────────────────────────────────────────────────────────────────────
   Krabsy — class session (classroom concept phase 2, 2026-11-22)

   A pupil who joined a class (/de/klasse/, /es/clase/) has a session in
   localStorage["krabsy_class"] = { code, name, nickname, token }. While it
   exists, every answer recorded by krabsy-stats.js (games and drills, also
   inside game iframes — same origin, same storage) is queued here and sent
   to the teacher's class on api.krabsy.com:

     { topic, item, form, correct, source, at }   e.g. irregular_verbs / bring / past

   Pupils who never joined a class send nothing — the anonymous path is
   unchanged. The queue lives in localStorage["krabsy_class_queue"] so a
   page change doesn't lose answers; it is flushed every 8 s, on load and
   on pagehide (sendBeacon, token in the body).

   API base: window.KRABSY_API or https://api.krabsy.com
   ────────────────────────────────────────────────────────────────────────── */

const SESSION_KEY = 'krabsy_class';
const QUEUE_KEY = 'krabsy_class_queue';
const MAX_QUEUE = 1000;
const FLUSH_MS = 8000;

export function apiBase() {
  try { if (window.KRABSY_API) return String(window.KRABSY_API).replace(/\/$/, ''); } catch (_) {}
  return 'https://api.krabsy.com';
}

export function getSession() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    return s && s.token && s.code ? s : null;
  } catch (_) { return null; }
}

function setSession(s) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch (_) {}
}

/** Leave the class on this device (queued answers are dropped). */
export function leave() {
  try { localStorage.removeItem(SESSION_KEY); localStorage.removeItem(QUEUE_KEY); } catch (_) {}
}

/** Join a class with the pupil's first name. Resolves { ok, session } or
    { ok: false, error } — error 'name_taken' when the class already has
    that name: call again with samePerson=true ("that's me") or with the
    surname's initial added ("Mia S."). */
export async function join(code, nickname, samePerson = false) {
  try {
    const r = await fetch(apiBase() + '/api/class/join', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, nickname, same_person: !!samePerson }), credentials: 'omit',
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.ok) return { ok: false, error: d.error || ('http_' + r.status) };
    const session = { code: d.code, name: d.class_name, nickname: d.nickname, token: d.student_token };
    leave();
    setSession(session);
    return { ok: true, session };
  } catch (_) {
    return { ok: false, error: 'network' };
  }
}

/* ── answer queue ─────────────────────────────────────────────────────── */

function readQueue() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]') || []; } catch (_) { return []; }
}
function writeQueue(q) {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-MAX_QUEUE))); } catch (_) {}
}

/** Called by krabsy-stats.js for every recorded answer. */
export function queueAnswer(evt) {
  if (!getSession() || !evt || !evt.itemId) return;
  const q = readQueue();
  q.push({
    topic: evt.topic, item: String(evt.itemId).toLowerCase().slice(0, 60), form: evt.form,
    correct: !!evt.correct, source: evt.source || null, at: evt.at || new Date().toISOString(),
  });
  writeQueue(q);
  scheduleFlush();
}

let _timer = null;
let _flushing = false;
function scheduleFlush() {
  if (_timer) return;
  _timer = setTimeout(() => { _timer = null; flush(); }, FLUSH_MS);
}

/** Send queued answers. Keeps them on network errors; drops the session
    when the class is gone (401: deleted class or pupil removed). */
export async function flush() {
  const s = getSession();
  if (!s || _flushing) return;
  const q = readQueue();
  if (!q.length) return;
  const batch = q.slice(0, 200);
  _flushing = true;
  try {
    const r = await fetch(apiBase() + '/api/class/answers', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Student-Token': s.token },
      body: JSON.stringify({ answers: batch }), credentials: 'omit', keepalive: true,
    });
    if (r.status === 401) { leave(); return; }
    if (r.ok) {
      writeQueue(readQueue().slice(batch.length));
      if (readQueue().length) scheduleFlush();
    }
  } catch (_) { /* offline: try again later */ } finally { _flushing = false; }
}

function flushByBeacon() {
  const s = getSession();
  const q = readQueue();
  if (!s || !q.length || !navigator.sendBeacon) return;
  const body = JSON.stringify({ token: s.token, answers: q.slice(0, 200) });
  try {
    if (navigator.sendBeacon(apiBase() + '/api/class/answers', new Blob([body], { type: 'text/plain;charset=UTF-8' }))) {
      writeQueue(q.slice(200));
    }
  } catch (_) {}
}

// Start: send what is left from earlier pages; send the rest on leaving.
try {
  if (getSession()) {
    setTimeout(flush, 1500);
    window.addEventListener('pagehide', flushByBeacon);
  }
} catch (_) {}
