/* Language landing pages (/de/, /es/) — games-first layout, 2026-11-21.

   The featured game and all game tiles are static HTML, pre-rendered from
   /data/games.json by tools/render_static_games.py. This script only:
   1. wires the filter chips above the game grid, and
   2. fills the progress row for returning players (krabsy-stats.js).

   Filter rules: a tile matches when its data-tags contain the filter. Counts
   use PLAYABLE games only (<a> tiles, the featured game included). A chip is
   shown only if it narrows the list (count > 0 and < "all"), so the topic
   chips appear on their own once a second topic has a live game. The
   featured game is left out of "all" (it is right above the grid). */
import { buildPageUrl } from '/lib/krabsy-data.js?v=2026-11-21';
import { hasData, getOverall, getStrugglers } from '/lib/krabsy-stats.js?v=2026-11-22';

const LANG = document.documentElement.lang === 'es' ? 'es' : 'de';
const T = {
  de: { one: 'Spiel', many: 'Spiele', soon: 'bald verfügbar' },
  es: { one: 'juego', many: 'juegos', soon: 'disponibles pronto' },
}[LANG];

function initFilters() {
  const chips = [...document.querySelectorAll('#gl-chips .gl-chip')];
  const tiles = [...document.querySelectorAll('#gl-grid .gt')];
  const status = document.getElementById('gl-status');
  const wrap = document.getElementById('gl-chips-wrap');
  const bar = document.getElementById('gl-chips');
  if (!chips.length || !tiles.length) return;

  const matches = (t, f) => f === 'all' || (' ' + t.dataset.tags + ' ').includes(' ' + f + ' ');
  const playable = (f) => tiles.filter((t) => t.tagName === 'A' && matches(t, f)).length;
  const total = playable('all');
  const nGames = (n) => n + ' ' + (n === 1 ? T.one : T.many);

  function apply(f, announce) {
    let soon = 0;
    for (const t of tiles) {
      const on = matches(t, f) && !(f === 'all' && t.hasAttribute('data-featured'));
      t.hidden = !on;
      if (on && t.tagName !== 'A') soon++;
    }
    let label = '';
    for (const c of chips) {
      const sel = c.dataset.filter === f;
      c.setAttribute('aria-pressed', String(sel));
      if (sel) label = c.dataset.label;
    }
    if (announce && status) {
      status.textContent = label + ': ' + nGames(playable(f)) + (soon ? ', ' + soon + ' ' + T.soon : '') + '.';
    }
  }

  for (const c of chips) {
    const f = c.dataset.filter;
    const n = playable(f);
    c.hidden = f !== 'all' && (n === 0 || n === total);
    c.setAttribute('aria-label', c.dataset.label + ', ' + nGames(n));
    const s = document.createElement('span');
    s.className = 'gl-chip-n';
    s.setAttribute('aria-hidden', 'true');
    s.textContent = n;
    c.appendChild(s);
    c.addEventListener('click', () => apply(f, true));
  }

  const fade = () => wrap.classList.toggle('can-scroll', bar.scrollWidth - bar.clientWidth - bar.scrollLeft > 8);
  bar.addEventListener('scroll', fade, { passive: true });
  window.addEventListener('resize', fade);
  fade();

  const m = location.hash.match(/^#f=([\w-]+)$/);   // deep link, e.g. /de/#f=3d
  if (m && chips.some((c) => c.dataset.filter === m[1] && !c.hidden)) apply(m[1], false);
}

async function initProgress() {
  const row = document.getElementById('gl-prog');
  if (!row) return;
  try {
    if (!hasData()) return;
    const o = getOverall();
    const streak = o.current_streak || 0;
    document.getElementById('gl-prog-acc').textContent = Math.round((o.accuracy || 0) * 100) + ' %';
    document.getElementById('gl-prog-streak').textContent = String(streak);

    // Up to 3 distinct words to practise — base word only, no grammar terms.
    const chipsEl = document.getElementById('gl-prog-chips');
    const seen = new Set();
    let added = 0;
    for (const r of getStrugglers(12)) {
      if (added >= 3) break;
      if (!r.verb || seen.has(r.topic + '/' + r.verb)) continue;
      seen.add(r.topic + '/' + r.verb);
      const href = await buildPageUrl(r.topic, 'free-practice', LANG).catch(() => null);
      if (!href) continue;
      const a = document.createElement('a');
      a.className = 'gl-prog-chip';
      a.lang = 'en';
      a.href = href + '?verbs=' + encodeURIComponent(r.verb);
      a.textContent = r.verb;
      chipsEl.appendChild(a);
      added++;
    }
    chipsEl.hidden = added === 0;

    row.hidden = false;
    document.getElementById('gl-head').classList.add('has-progress');
  } catch (err) {
    console.warn('landing: progress row skipped', err);
  }
}

/* NEU flags expire on their own: the static HTML carries data-new-until. */
function expireNew() {
  const today = new Date().toISOString().slice(0, 10);
  for (const el of document.querySelectorAll('[data-new-until]')) {
    if (el.dataset.newUntil >= today) continue;
    if (el.dataset.alt) el.textContent = el.dataset.alt;   // featured kicker
    else el.remove();
  }
}

/* Class session (phase 2): show "Klasse 6b · Mia" instead of the join link. */
function initClassBadge() {
  const el = document.getElementById('gl-join');
  if (!el) return;
  let s = null;
  try { s = JSON.parse(localStorage.getItem('krabsy_class') || 'null'); } catch (_) {}
  if (!s || !s.name) return;
  const a = el.querySelector('a:not(.gl-join-quiz)');   // the quiz-room link stays
  if (!a) return;
  const badge = document.createElement('a');
  badge.href = a.getAttribute('href');
  badge.className = 'gl-class-badge';
  badge.textContent = '👥 ' + s.name + ' · ' + s.nickname;
  a.replaceWith(badge);
}

expireNew();
initClassBadge();
initFilters();
initProgress();
