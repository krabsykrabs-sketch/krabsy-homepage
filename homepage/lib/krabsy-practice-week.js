/* ──────────────────────────────────────────────────────────────────────────
   Krabsy — practice sessions per week ("Jetzt üben", docs/student-path.md §1)

   A practice session counts when its warm-up and its new/weak step are done
   (lib/krabsy-practice.js calls addSession()). The goal is 3 a week, more are
   welcome. No daily goal, no day counter, nothing is ever "lost".

   Storage: localStorage["krabsy_practice_v1"] =
     { v: 1, weeks: { "2026-W48": 2, … }, total, last: ISO date }
   A krabsy_* key, so krabsy-sync.js saves it with the child's key (both
   devices changed → this device wins, like other unmerged keys).
   Weeks are ISO weeks in the device's local time; only the last 12 are kept.

   Rings: any element with [data-kp-ring] gets a small ring (n of 3) and its
   [data-kp-ring-text] child the text ("1 von 3 diese Woche"). mountRings()
   runs on import, so a page only needs
     <script type="module" src="/lib/krabsy-practice-week.js?v=…"></script>
   ────────────────────────────────────────────────────────────────────────── */

import { currentLang } from './krabsy-lang.js?v=2026-11-27';

export const KEY = 'krabsy_practice_v1';
export const GOAL = 3;
const KEEP_WEEKS = 12;

/** ISO week of a date, e.g. "2026-W48" (local calendar day). */
export function weekKey(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);           // Thursday of this week
  const y = t.getUTCFullYear();
  const w = Math.ceil(((t - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7);
  return `${y}-W${String(w).padStart(2, '0')}`;
}

function read() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s && s.weeks && typeof s.weeks === 'object') return s;
  } catch (_) { /* corrupted / private mode */ }
  return { v: 1, weeks: {}, total: 0, last: null };
}

/** Sessions done this week: { week, count, goal, done } */
export function thisWeek(now = new Date()) {
  const week = weekKey(now);
  const count = Math.max(0, Number(read().weeks[week]) || 0);
  return { week, count, goal: GOAL, done: count >= GOAL };
}

/** All sessions ever (for small variety, e.g. which games to suggest). */
export function totalSessions() { return Math.max(0, Number(read().total) || 0); }

/** One finished session (steps 1 and 2). Returns thisWeek() after it. */
export function addSession(now = new Date()) {
  const s = read();
  const week = weekKey(now);
  s.weeks[week] = (Number(s.weeks[week]) || 0) + 1;
  s.total = (Number(s.total) || 0) + 1;
  s.last = now.toISOString();
  const keep = Object.keys(s.weeks).sort().slice(-KEEP_WEEKS);
  s.weeks = Object.fromEntries(keep.map((k) => [k, s.weeks[k]]));
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (_) {}
  mountRings();
  return thisWeek(now);
}

/* ── ring ─────────────────────────────────────────────────────────────── */

const LANG = currentLang();
const TXT = {
  de: { of: (n) => `${n} von ${GOAL} diese Woche`, done: 'Woche geschafft ✓', more: (n) => `Woche geschafft ✓ · ${n}×` },
  es: { of: (n) => `${n} de ${GOAL} esta semana`, done: 'Semana lograda ✓', more: (n) => `Semana lograda ✓ · ${n}×` },
  en: { of: (n) => `${n} of ${GOAL} this week`, done: 'Week done ✓', more: (n) => `Week done ✓ · ${n}×` },
};
const T = TXT[LANG] || TXT.en;

export function ringText(count) {
  if (count > GOAL) return T.more(count);
  if (count === GOAL) return T.done;
  return T.of(count);
}

/** SVG ring: GOAL segments, `count` of them filled. */
export function ringSvg(count, size = 30) {
  const r = 12, c = 2 * Math.PI * r, gap = 7.5, seg = c / GOAL - gap;
  const parts = [];
  for (let i = 0; i < GOAL; i++) {
    const on = i < count;
    parts.push(`<circle cx="16" cy="16" r="${r}" fill="none" stroke-width="5" stroke-linecap="round"
      class="${on ? 'kp-ring-on' : 'kp-ring-off'}" stroke-dasharray="${seg.toFixed(2)} ${(c - seg).toFixed(2)}"
      stroke-dashoffset="${(-(i * c) / GOAL + c / 4 - gap / 2).toFixed(2)}"/>`);
  }
  const check = count >= GOAL
    ? '<path d="M11 16.5l3.4 3.4L21.5 12.5" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="kp-ring-check"/>'
    : '';
  return `<svg class="kp-ring" viewBox="0 0 32 32" width="${size}" height="${size}" aria-hidden="true" focusable="false">${parts.join('')}${check}</svg>`;
}

/** Fill every [data-kp-ring] element (landing, profile, student page). */
export function mountRings(root = document) {
  const { count } = thisWeek();
  root.querySelectorAll('[data-kp-ring]').forEach((el) => {
    const ico = el.querySelector('[data-kp-ring-ico]');
    if (ico) ico.innerHTML = ringSvg(count, Number(ico.dataset.kpRingIco) || 30);
    const tx = el.querySelector('[data-kp-ring-text]');
    if (tx) tx.textContent = ringText(count);
    el.classList.toggle('is-week-done', count >= GOAL);
  });
}

try { mountRings(); } catch (_) { /* no DOM */ }
