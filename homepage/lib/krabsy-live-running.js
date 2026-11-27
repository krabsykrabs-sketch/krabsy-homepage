/* Krabsy — which live lessons are running, remembered on the tutor's device
   (owner 2026-11-27: "the teacher should be able to go back to different menus
   without the live session ending").

   Leaving the live page never ends a lesson: the relay keeps it (docs/live-classroom.md),
   the student keeps working, and opening the live page again resumes it. This list only
   lets the other tutor pages show "Live lesson with Lucas is running · Back to the lesson".

   localStorage["krabsy_live_running"] = { "<student id>": { name, started, href, seen } }
   The live page refreshes `seen` every minute while it is open; an entry not seen for
   3 hours is dropped (the relay forgets an idle room after 3 hours too). */
const KEY = 'krabsy_live_running';
const STALE_MS = 3 * 3600 * 1000;

function read() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (_) { return {}; }
}
function write(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (_) {} }

/** Running lessons, newest first: [{ sid, name, started, href, seen }]. */
export function runningLessons() {
  const all = read(), now = Date.now();
  let changed = false;
  for (const [k, v] of Object.entries(all)) {
    if (!v || !v.seen || now - v.seen > STALE_MS) { delete all[k]; changed = true; }
  }
  if (changed) write(all);
  return Object.entries(all).map(([sid, v]) => ({ sid: Number(sid), ...v }))
    .sort((a, b) => Date.parse(b.started || 0) - Date.parse(a.started || 0));
}
export function isRunning(sid) { return runningLessons().some((r) => r.sid === Number(sid)); }
export function markRunning(sid, { name, started, href }) {
  const all = read();
  all[String(sid)] = { name, started, href, seen: Date.now() };
  write(all);
}
export function markEnded(sid) {
  const all = read();
  if (all[String(sid)]) { delete all[String(sid)]; write(all); }
}

/** The red "lesson running" bar for the tutor pages (HTML; empty when none). */
export function runningBar(esc, exceptSid = null) {
  const list = runningLessons().filter((r) => r.sid !== Number(exceptSid));
  if (!list.length) return '';
  const time = (iso) => { try { return new Date(iso).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }); } catch (_) { return ''; } };
  return `<div class="kt-livebar" role="status">${list.map((r) => `<div class="kt-livebar-row">
      <span class="kt-livebar-dot" aria-hidden="true"></span>
      <span><b>Live lesson with ${esc(r.name)}</b> is running${r.started ? ` · since ${esc(time(r.started))}` : ''} · it keeps going while you look around</span>
      <a class="kt-livebar-btn" href="${esc(r.href)}">Back to the lesson →</a></div>`).join('')}</div>`;
}
