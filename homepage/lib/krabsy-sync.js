/* ──────────────────────────────────────────────────────────────────────────
   Krabsy — people on this device + profile saved to the student's key
   (docs/tutor-platform.md "Accounts, devices, siblings", 2026-11-25)

   PEOPLE. A device can hold several people (siblings): localStorage
   ["krabsy_people"] = { active, list: [{ id, name, token, code, tutor, adult }] }.
   A person with a token is a student of a tutor or a teacher's class; the
   person "guest" has no token (anonymous, this device only).
   The games read and write fixed localStorage keys (figure, shells, stats,
   game saves …). Switching person parks the active person's keys in
   krabsy_stash_<id> and loads the other person's, so games need no changes.
   Device settings (language, sound, class/tutor bookkeeping) are not switched.

   SYNC. For a person with a token the same keys are saved on the server
   (/api/profile) and restored on another device. Per key we remember the hash
   of what was last synced (krabsy_sync_<id>): a key changed here since then is
   pushed; a key unchanged here takes the server's value; changed on both sides
   → merged (shells, stats, rewards) or this device wins.

   Loaded on every page by krabsy-analytics.js when krabsy_people or a class
   session exists; never inside game iframes (the wrapper page syncs).
   ────────────────────────────────────────────────────────────────────────── */
import { apiBase, adopt, leave, flush, getSession } from '/lib/krabsy-class.js?v=2026-11-25b';

const PEOPLE = 'krabsy_people';
const STASH = 'krabsy_stash_';
const SNAP = 'krabsy_sync_';
const PUSH_MS = 20000;
const DEVICE = /^(krabsy_(lang|class|class_queue|teacher_classes|tutor_.+|people|stash_.+|sync_.+|notrack|quiz_host|3d_editor_level|vclimb_author|es_topic|audio|who)|.+_(sound|muted|mute))$/;

const LANG = (document.documentElement.lang || 'en').slice(0, 2);
const T = {
  en: { who: 'Who’s playing?', guest: 'Someone else (guest)', guestName: 'Guest', switching: 'One moment …' },
  de: { who: 'Wer spielt?', guest: 'Jemand anderes (Gast)', guestName: 'Gast', switching: 'Einen Moment …' },
  es: { who: '¿Quién juega?', guest: 'Otra persona (invitado)', guestName: 'Invitado', switching: 'Un momento …' },
}[LANG] || null;
const TX = T || { who: 'Who’s playing?', guest: 'Someone else (guest)', guestName: 'Guest', switching: 'One moment …' };

/* ── storage helpers ───────────────────────────────────────────────────── */
const get = (k) => { try { return localStorage.getItem(k); } catch (_) { return null; } };
const set = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (_) {} };
const json = (k, d) => { try { return JSON.parse(get(k) || 'null') ?? d; } catch (_) { return d; } };

export function isPersonal(k) { return (k.startsWith('krabsy_') || k.startsWith('td3d_')) && !DEVICE.test(k); }
function personalKeys() {
  const out = [];
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && isPersonal(k)) out.push(k); } } catch (_) {}
  return out;
}
function hash(s) {          // small, stable string hash (djb2) + length
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `${s.length}:${h >>> 0}`;
}

/* ── people ────────────────────────────────────────────────────────────── */
export function people() {
  const st = json(PEOPLE, null);
  return st && Array.isArray(st.list) ? st : { active: null, list: [] };
}
function savePeople(st) { set(PEOPLE, JSON.stringify(st)); }
export function activePerson() { const st = people(); return st.list.find((p) => p.id === st.active) || null; }
export const personId = (s) => `${String(s.code || '').toUpperCase()}:${String(s.nickname || '').toLowerCase()}`;

/** A personal link or a class join: make this session the active person.
    The first person on a device takes over what was played there before;
    anyone else gets their own (empty or saved) data. `extra`: { adult, tutor }. */
export async function enter(session, extra = {}) {
  registerLegacy();
  const st = people();
  const id = personId(session);
  const entry = { id, name: session.nickname, token: session.token, code: session.code, tutor: session.name,
    adult: !!extra.adult };
  const known = st.list.find((p) => p.id === id);
  if (known) Object.assign(known, entry); else st.list.push(entry);
  if (!st.active || st.active === id || !st.list.some((p) => p.id === st.active)) {
    st.active = id;
    savePeople(st);
    adopt(session);
  } else {
    savePeople(st);
    await switchTo(id);
  }
  set('krabsy_adult', entry.adult ? '1' : null);
  await pull();
  await push();
}

/** Switch the device to another person (or 'guest'). Resolves when done. */
export async function switchTo(id) {
  const st = people();
  if (st.active === id) return;
  const cur = st.list.find((p) => p.id === st.active);
  if (cur && cur.token) { try { await flush(); } catch (_) {} await push(); }
  // park the active person's data
  const keys = personalKeys();
  const park = {};
  for (const k of keys) park[k] = get(k);
  if (st.active) set(STASH + st.active, JSON.stringify(park));
  for (const k of keys) set(k, null);
  // load the other one's
  if (id === 'guest' && !st.list.some((p) => p.id === 'guest')) st.list.push({ id: 'guest', name: TX.guestName, token: null });
  const saved = json(STASH + id, {});
  for (const [k, v] of Object.entries(saved)) if (isPersonal(k) && typeof v === 'string') set(k, v);
  set(STASH + id, null);
  st.active = id;
  savePeople(st);
  const next = st.list.find((p) => p.id === id);
  if (next && next.token) adopt({ code: next.code, name: next.tutor, nickname: next.name, token: next.token });
  else leave();
  set('krabsy_adult', next && next.adult ? '1' : null);
  if (next && next.token) await pull();
}

/** Forget a person on this device (their server data stays). */
export function forget(id) {
  const st = people();
  if (st.active === id) return;
  st.list = st.list.filter((p) => p.id !== id);
  set(STASH + id, null); set(SNAP + id, null);
  savePeople(st);
}

/* ── merge when both sides changed ─────────────────────────────────────── */
function mergeValue(k, local, server) {
  try {
    const a = JSON.parse(local), b = JSON.parse(server);
    if (k === 'krabsy_shells_v1') {
      const w = (b.earned || 0) > (a.earned || 0) ? b : a;
      return JSON.stringify(Object.assign({}, w, { owned: [...new Set([...(a.owned || []), ...(b.owned || [])])],
        balance: Math.max(a.balance || 0, b.balance || 0) }));
    }
    if (k === 'krabsy_stats_v2') {
      const big = ((b.overall || {}).total_attempts || 0) > ((a.overall || {}).total_attempts || 0) ? b : a;
      const small = big === a ? b : a;
      const items = JSON.parse(JSON.stringify(big.items || {}));
      for (const [tp, its] of Object.entries(small.items || {})) {
        items[tp] = items[tp] || {};
        for (const [it, forms] of Object.entries(its)) {
          items[tp][it] = items[tp][it] || {};
          for (const [f, rec] of Object.entries(forms)) {
            const mine = items[tp][it][f];
            if (!mine || (rec.attempts || 0) > (mine.attempts || 0)) items[tp][it][f] = rec;
          }
        }
      }
      return JSON.stringify(Object.assign({}, big, { items }));
    }
    if (k === 'krabsy_rewards_v1') {
      const score = (o) => (o.shellGifts || 0) + (o.done || []).length + (o.days || 0);
      const w = score(b) > score(a) ? b : a;
      const seen = new Set();
      const log = [...(a.log || []), ...(b.log || [])].filter((e) => { const key = e.id + '@' + e.t; if (seen.has(key)) return false; seen.add(key); return true; })
        .sort((x, y) => (x.t || 0) - (y.t || 0));
      return JSON.stringify(Object.assign({}, w, { done: [...new Set([...(a.done || []), ...(b.done || [])])], log }));
    }
  } catch (_) { /* not JSON: this device wins */ }
  return local;
}

/* ── sync ──────────────────────────────────────────────────────────────── */
async function call(method, token, body) {
  const r = await fetch(apiBase() + '/api/profile', {
    method, credentials: 'omit', keepalive: method === 'POST',
    headers: Object.assign({ 'X-Student-Token': token }, body ? { 'Content-Type': 'application/json' } : {}),
    body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.ok) throw new Error(d.error || 'http_' + r.status);
  return d;
}

/** Take what other devices saved. */
export async function pull() {
  const p = activePerson();
  if (!p || !p.token) return false;
  let d;
  try { d = await call('GET', p.token); } catch (_) { return false; }
  const snap = json(SNAP + p.id, {});
  let changed = false;
  for (const [k, rec] of Object.entries(d.data || {})) {
    if (!isPersonal(k) || !rec || typeof rec.v !== 'string') continue;
    const local = get(k);
    if (local === rec.v) { snap[k] = hash(local); continue; }
    if (local == null || hash(local) === snap[k]) {          // unchanged here since the last sync
      set(k, rec.v); snap[k] = hash(rec.v); changed = true;
    } else {
      const m = mergeValue(k, local, rec.v);                 // changed on both sides
      if (m !== local) { set(k, m); changed = true; }
      // snap stays old, so push() sends the merged value
    }
  }
  set(SNAP + p.id, JSON.stringify(snap));
  return changed;
}

/** Save what changed on this device. */
export async function push() {
  const p = activePerson();
  if (!p || !p.token) return;
  const snap = json(SNAP + p.id, {});
  const changes = {};
  const now = {};
  for (const k of personalKeys()) { const v = get(k); const h = hash(v); now[k] = h; if (snap[k] !== h) changes[k] = v; }
  for (const k of Object.keys(snap)) if (!(k in now)) changes[k] = null;
  if (!Object.keys(changes).length) return;
  try {
    await call('POST', p.token, { changes });
    for (const [k, v] of Object.entries(changes)) { if (v == null) delete snap[k]; else snap[k] = hash(v); }
    set(SNAP + p.id, JSON.stringify(snap));
  } catch (e) {
    if (e.message === 'not_in_class') {                    // link replaced or student removed
      const st = people(); const me = st.list.find((x) => x.id === p.id);
      if (me) { me.token = null; savePeople(st); }
    }
  }
}

function pushByBeacon() {
  const p = activePerson();
  if (!p || !p.token || !navigator.sendBeacon) return;
  const snap = json(SNAP + p.id, {});
  const changes = {};
  for (const k of personalKeys()) { const v = get(k); if (snap[k] !== hash(v)) changes[k] = v; }
  if (!Object.keys(changes).length) return;
  try {
    if (navigator.sendBeacon(apiBase() + '/api/profile', new Blob([JSON.stringify({ token: p.token, changes })], { type: 'text/plain;charset=UTF-8' }))) {
      for (const [k, v] of Object.entries(changes)) snap[k] = hash(v);
      set(SNAP + p.id, JSON.stringify(snap));
    }
  } catch (_) {}
}

/* ── "Who's playing?" ──────────────────────────────────────────────────── */
export function showPicker({ onDone } = {}) {
  const st = people();
  document.querySelector('.k-who')?.remove();
  const o = document.createElement('div');
  o.className = 'k-who';
  o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-label', TX.who);
  const list = st.list.filter((p) => p.id !== 'guest');
  const btn = (p, label) => `<button type="button" data-id="${p.id.replace(/"/g, '')}"${p.id === st.active ? ' class="is-on"' : ''}>
    <span class="k-who-ini" aria-hidden="true">${(label || '?').trim().charAt(0).toUpperCase()}</span><span>${label.replace(/[<>&]/g, '')}</span></button>`;
  o.innerHTML = `<div class="k-who-box"><h2>${TX.who}</h2><div class="k-who-list">
    ${list.map((p) => btn(p, p.name)).join('')}
    ${btn({ id: 'guest' }, TX.guest)}</div></div>`;
  if (!document.getElementById('k-who-css')) {
    const css = document.createElement('style'); css.id = 'k-who-css';
    css.textContent = `.k-who{position:fixed;inset:0;z-index:10050;background:rgba(13,34,64,.55);display:grid;place-items:center;padding:16px}
.k-who-box{background:#fffdf7;border-radius:20px;padding:22px 22px 18px;max-width:420px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.25);font-family:Nunito,system-ui,sans-serif}
.k-who-box h2{font-family:'Fredoka One',system-ui,sans-serif;font-weight:normal;margin:0 0 14px;font-size:1.5rem;color:#20304a}
.k-who-list{display:grid;gap:10px}
.k-who-list button{display:flex;align-items:center;gap:12px;min-height:56px;padding:8px 14px;border-radius:14px;border:2px solid #e3dcf2;background:#fff;font:inherit;font-weight:700;font-size:1.1rem;cursor:pointer;text-align:left;color:#20304a}
.k-who-list button:hover,.k-who-list button:focus-visible{border-color:#bf4a33}
.k-who-list button.is-on{border-color:#2ec4a0}
.k-who-ini{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:#ffcf5e;color:#20304a;font-family:'Fredoka One',system-ui,sans-serif}
.k-who-list button[data-id=guest] .k-who-ini{background:#e3dcf2}`;
    document.head.appendChild(css);
  }
  o.querySelectorAll('button[data-id]').forEach((b) => b.addEventListener('click', async () => {
    const id = b.dataset.id;
    try { sessionStorage.setItem('krabsy_who', '1'); } catch (_) {}
    if (id === people().active) { o.remove(); onDone && onDone(false); return; }
    o.querySelector('.k-who-box').innerHTML = `<h2>${TX.switching}</h2>`;
    await switchTo(id);
    o.remove();
    if (onDone) onDone(true); else location.reload();
  }));
  document.body.appendChild(o);
  (o.querySelector('button.is-on') || o.querySelector('button'))?.focus();
}

/** A class joined before this module existed: it becomes the device's first person. */
function registerLegacy() {
  const st = people();
  const s = getSession();
  if (s && !st.list.length) {
    st.list.push({ id: personId(s), name: s.nickname, token: s.token, code: s.code, tutor: s.name });
    st.active = personId(s); savePeople(st);
  }
}

/* ── start ─────────────────────────────────────────────────────────────── */
let started = false;
export function start() {
  if (started) return; started = true;
  try { if (window.top !== window) return; } catch (_) { return; }
  registerLegacy();
  const named = people().list.filter((p) => p.id !== 'guest');
  let asked = false;
  try { asked = sessionStorage.getItem('krabsy_who') === '1'; } catch (_) {}
  const personalPage = /\/(me|tutors|report)\//.test(location.pathname);
  if (named.length + (people().list.some((p) => p.id === 'guest') ? 1 : 0) >= 2 && !asked && !personalPage) {
    const go = () => showPicker();
    if (document.body) go(); else document.addEventListener('DOMContentLoaded', go);
  }
  if (activePerson() && activePerson().token) {
    pull().then(() => push());
    setInterval(push, PUSH_MS);
    window.addEventListener('pagehide', pushByBeacon);
  }
}
