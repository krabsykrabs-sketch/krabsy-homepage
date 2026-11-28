/* ──────────────────────────────────────────────────────────────────────────
   Krabsy — live invites overlay (docs/classroom-concept.md "Live invites")

   When a pupil's teacher opens the Quiz Room "for the class", or a tutor
   starts a live lesson, an overlay appears on whatever Krabsy page the pupil
   is on, games included (it sits above the game iframe; games keep running,
   there is no pause): "Deine Klasse startet ein Quiz – jetzt beitreten?",
   for whom ("Für Mia"), Beitreten / Jetzt nicht, and on shared devices
   "Nein, jemand anderes" (→ "Who's playing?").

   Loaded by krabsy-analytics.js on top-level pages only, and only on devices
   that hold a class session or a student key (krabsy_class / krabsy_people);
   a device without tokens makes no request. Asks the API every ~18 s (the
   server sends the interval) while the tab is visible (Page Visibility API),
   backs off on errors. Tokens go in the POST body, never in a URL.
   Texts: data/ui_<lang>.json "invites" (loaded only when an invite shows).
   ────────────────────────────────────────────────────────────────────────── */
import { apiBase, getSession } from '/lib/krabsy-class.js?v=2026-11-25b';
import { currentLang, FALLBACK_UI, SECTIONS } from '/lib/krabsy-lang.js?v=2026-11-27';
import { people, switchTo, showPicker } from '/lib/krabsy-sync.js?v=2026-11-27l';

const ICONS = '/lib/icons/krabsy-icons.svg?v=2026-11-27-acct';
const SKIP = 'krabsy_invite_skip';        // sessionStorage: invites put aside in this tab ("someone else")
const LAST = 'krabsy_invite_last';        // sessionStorage: time of the last poll (across page loads)
const FIRST_MS = 1500;
let pollMs = 18000;
let timer = null, busy = false, failures = 0, open = null, started = false;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ss = {
  get(k) { try { return sessionStorage.getItem(k); } catch (_) { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch (_) {} },
};

/** The device's tokens: the active class session first, then the other people. */
function tokens() {
  const out = [];
  const s = getSession();
  if (s && s.token) out.push(s.token);
  for (const p of people().list) if (p.token && !out.includes(p.token)) out.push(p.token);
  return out.slice(0, 8);
}

/** Pages where an invite would get in the way: the teacher and tutor pages. */
function quietPage() {
  const path = location.pathname;
  if (SECTIONS.some((s) => s.teachers && path.startsWith(s.teachers))) return true;
  return /\/(tutors|report)\//.test(path);
}

function skipped(id) { return (ss.get(SKIP) || '').split(',').includes(id); }
function skip(id) { ss.set(SKIP, [...(ss.get(SKIP) || '').split(',').filter(Boolean), id].slice(-20).join(',')); }
function onTarget(inv) {
  try { return new URL(inv.target, location.origin).pathname === location.pathname; } catch (_) { return false; }
}

/* ── polling ───────────────────────────────────────────────────────────── */
function schedule(ms) {
  clearTimeout(timer);
  timer = setTimeout(tick, Math.max(0, ms));
}

async function tick() {
  timer = null;
  if (document.visibilityState !== 'visible') return;          // picked up again by visibilitychange
  const toks = tokens();
  if (!toks.length) return;                                     // left the class: no more requests
  if (open || busy || document.querySelector('.k-who')) { schedule(pollMs); return; }
  busy = true;
  ss.set(LAST, String(Date.now()));
  try {
    const r = await fetch(apiBase() + '/api/invites', {
      method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokens: toks }) });
    if (!r.ok) throw new Error('http_' + r.status);
    const d = await r.json();
    failures = 0;
    if (d.poll) pollMs = Math.min(120000, Math.max(10000, d.poll * 1000));
    const inv = (d.invites || []).find((x) => !skipped(x.id) && !onTarget(x));
    if (inv) await show(inv, toks);
  } catch (_) {
    failures += 1;                                              // offline / server busy: back off
  } finally { busy = false; }
  const jitter = Math.random() * 3000;
  schedule(failures ? Math.min(300000, pollMs * 2 ** failures) : pollMs + jitter);
}

function onVisibility() {
  if (document.visibilityState !== 'visible') { clearTimeout(timer); timer = null; return; }
  if (timer || busy) return;
  const since = Date.now() - Number(ss.get(LAST) || 0);
  schedule(Math.max(FIRST_MS, pollMs - since));
}

/* ── texts ─────────────────────────────────────────────────────────────── */
let TX = null;
async function texts() {
  if (TX) return TX;
  const get = (l) => fetch(`/data/ui_${l}.json`).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
  const lang = currentLang();
  let d = (await get(lang)).invites;
  if (!d && lang !== FALLBACK_UI) d = (await get(FALLBACK_UI)).invites;   // i18n contract rule 5
  TX = d || {};
  return TX;
}
const tx = (key, vars = {}) => String((TX && TX[key]) || key).replace(/\{([a-zA-Z_]\w*)\}/g, (m, k) => (k in vars ? vars[k] : m));

/* ── the overlay ───────────────────────────────────────────────────────── */
const CSS = `.k-inv{position:fixed;inset:0;z-index:2147483000;background:rgba(13,34,64,.6);display:grid;place-items:center;padding:16px;overflow:auto}
.k-inv-box{background:#fffdf7;border-radius:22px;padding:22px 20px 16px;max-width:440px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.3);font-family:Nunito,system-ui,sans-serif;color:#20304a;text-align:center;box-sizing:border-box}
.k-inv-ico{display:grid;place-items:center;width:64px;height:64px;border-radius:50%;background:#e8fbf6;margin:0 auto 8px}
.k-inv-ico .ki{width:40px;height:40px}
.k-inv-for{display:inline-block;margin:0 0 8px;padding:4px 12px;border-radius:999px;background:#ffcf5e;font-weight:800;font-size:1rem}
.k-inv-box h2{font-family:'Fredoka One',system-ui,sans-serif;font-weight:normal;font-size:1.45rem;line-height:1.25;margin:0 0 8px}
.k-inv-box p.k-inv-lead{margin:0 0 16px;color:#4a5a78;font-size:1rem}
.k-inv-btns{display:flex;flex-wrap:wrap;gap:10px;justify-content:center}
.k-inv-btns button{flex:1 1 150px;min-height:52px;border-radius:14px;font:inherit;font-weight:800;font-size:1.1rem;cursor:pointer;padding:8px 16px}
.k-inv-join{background:#2ee6c0;color:#0b3b31;border:2px solid #1fbf9d}
.k-inv-later{background:#fff;color:#20304a;border:2px solid #d9d2ea}
.k-inv-btns button:hover,.k-inv-btns button:focus-visible{outline:3px solid #bf4a33;outline-offset:2px}
.k-inv-other{margin-top:12px;background:none;border:0;font:inherit;font-weight:700;color:#4a5a78;text-decoration:underline;cursor:pointer;min-height:44px;padding:4px 10px}
.k-inv-other:focus-visible{outline:3px solid #bf4a33;outline-offset:2px;border-radius:8px}
.k-inv button[disabled]{opacity:.6;cursor:default}`;

function close(restore) {
  if (!open) return;
  const { el, prev, onKey } = open;
  document.removeEventListener('keydown', onKey, true);
  el.remove();
  open = null;
  if (restore && prev && document.contains(prev)) { try { prev.focus(); } catch (_) {} }
}

function respond(inv, token, answer) {
  return fetch(apiBase() + '/api/invites/respond', {
    method: 'POST', credentials: 'omit', keepalive: true, headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, invite: inv.id, answer }) }).catch(() => null);
}

async function show(inv, toks) {
  await texts();
  if (open || document.querySelector('.k-who')) return;
  const token = toks[inv.who];
  const st = people();
  const person = st.list.find((p) => p.token === token) || null;
  const shared = st.list.length >= 2;
  const activeToken = (getSession() || {}).token;
  if (!document.getElementById('k-inv-css')) {
    const css = document.createElement('style'); css.id = 'k-inv-css'; css.textContent = CSS;
    document.head.appendChild(css);
  }
  const quiz = inv.kind === 'quiz';
  const title = quiz ? tx('quiz_title') : inv.host ? tx('lesson_title', { host: inv.host }) : tx('lesson_title_nohost');
  const lead = quiz ? (inv.host ? tx('quiz_lead', { host: inv.host, class: inv.class }) : tx('quiz_lead_class', { class: inv.class }))
    : tx('lesson_lead');
  const el = document.createElement('div');
  el.className = 'k-inv';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-labelledby', 'k-inv-h');
  el.setAttribute('aria-describedby', 'k-inv-p');
  el.innerHTML = `<div class="k-inv-box">
    <span class="k-inv-ico" aria-hidden="true"><svg class="ki" aria-hidden="true" focusable="false"><use href="${ICONS}#${quiz ? 'ki-quiz' : 'ki-teacher'}"/></svg></span>
    <p class="k-inv-for">${esc(tx(shared ? 'ask_shared' : 'for', { name: inv.name }))}</p>
    <h2 id="k-inv-h">${esc(title)}</h2>
    <p class="k-inv-lead" id="k-inv-p">${esc(lead)}</p>
    <div class="k-inv-btns"><button type="button" class="k-inv-join">${esc(tx('join'))}</button>
      <button type="button" class="k-inv-later">${esc(tx('not_now'))}</button></div>
    ${shared ? `<button type="button" class="k-inv-other">${esc(tx('someone_else'))}</button>` : ''}
  </div>`;
  const prev = document.activeElement;
  const buttons = () => [...el.querySelectorAll('button:not([disabled])')];
  const later = () => {
    skip(inv.id);                       // in case the answer doesn't reach the server
    respond(inv, token, 'decline');
    close(true);
    schedule(pollMs);
  };
  const onKey = (e) => {
    if (!open) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); later(); return; }
    if (e.key === 'Tab') {                // focus stays inside the dialog
      const b = buttons();
      if (!b.length) return;
      const i = b.indexOf(document.activeElement);
      e.preventDefault();
      b[(i + (e.shiftKey ? -1 : 1) + b.length) % b.length].focus();
    }
  };
  open = { el, prev, onKey };
  document.addEventListener('keydown', onKey, true);
  (document.body || document.documentElement).appendChild(el);
  el.querySelector('.k-inv-join').focus();

  el.querySelector('.k-inv-later').addEventListener('click', later);
  el.querySelector('.k-inv-join').addEventListener('click', async () => {
    buttons().forEach((b) => { b.disabled = true; });
    await Promise.race([respond(inv, token, 'join'), new Promise((r) => setTimeout(r, 1500))]);
    // The invite is for another person on this device: switch to them first ("Who's playing?").
    if (person && token !== activeToken) { try { await switchTo(person.id); } catch (_) {} }
    location.href = inv.target;
  });
  const other = el.querySelector('.k-inv-other');
  if (other) other.addEventListener('click', () => {
    skip(inv.id);                         // not this person's decision: nothing is recorded
    close(false);
    const named = people().list.filter((p) => p.id !== 'guest');
    if (named.length >= 2 || people().list.some((p) => p.id === 'guest')) showPicker();
    schedule(pollMs);
  });
}

/* ── start ─────────────────────────────────────────────────────────────── */
export function start() {
  if (started) return; started = true;
  try { if (window.top !== window) return; } catch (_) { return; }
  if (quietPage() || !tokens().length) return;
  document.addEventListener('visibilitychange', onVisibility);
  if (document.visibilityState === 'visible') {
    const since = Date.now() - Number(ss.get(LAST) || 0);
    schedule(Math.max(FIRST_MS, pollMs - since));
  }
}
