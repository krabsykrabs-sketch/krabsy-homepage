/* Language landing pages (/de/, /es/) — games-first layout, 2026-11-21.

   The featured game and all game tiles are static HTML, pre-rendered from
   /data/games.json by tools/render_static_games.py. This script only:
   1. wires the filter chips above the game grid,
   2. fills the progress row for returning players (krabsy-stats.js), and
   3. shows the child's figure next to the featured tile: picture first, then
      the live 3D figure (krabsy-landing-figure.js), with shells and the link
      to "Mein Profil" (krabsy-me.js).

   Filter rules: a tile matches when its data-tags contain the filter. Counts
   use PLAYABLE games only (<a> tiles, the featured game included). A chip is
   shown only if it narrows the list (count > 0 and < "all"), so the topic
   chips appear on their own once a second topic has a live game. The
   featured game is left out of "all" (it is right above the grid). */
import { buildPageUrl } from '/lib/krabsy-data.js?v=2026-11-27l';
import { hasData, getOverall, getStrugglers } from '/lib/krabsy-stats.js?v=2026-11-25';
import { getShells, onShellsChange } from '/lib/krabsy-shells.js';
import { savedChar, portraitUrl, DEFAULT_CHAR, itemLabel, figurePicks, savePick, isCustomFigure } from '/lib/krabsy-me.js?v=2026-11-27';
import { currentLang, currentSection, topicInSection, topicLearnLang } from '/lib/krabsy-lang.js?v=2026-11-27';

const LANG = currentLang();
const SECTION = currentSection();
const T = {
  de: { one: 'Spiel', many: 'Spiele', soon: 'bald verfügbar' },
  es: { one: 'juego', many: 'juegos', soon: 'disponibles pronto' },
  en: { one: 'game', many: 'games', soon: 'coming soon' },   // /en/spanish/ (2026-11-24)
}[LANG] || { one: 'game', many: 'games', soon: 'coming soon' };

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
      if (!r.verb || seen.has(r.topic + '/' + r.verb) || !topicInSection(r.topic, SECTION)) continue;
      seen.add(r.topic + '/' + r.verb);
      const href = await buildPageUrl(r.topic, 'free-practice', LANG).catch(() => null);
      if (!href) continue;
      const label = await itemLabel(r.topic, r.verb);
      if (!label) continue;
      const a = document.createElement('a');
      a.className = 'gl-prog-chip';
      a.lang = topicLearnLang(r.topic) || 'en';
      a.href = href + '?verbs=' + encodeURIComponent(r.verb);
      a.textContent = label;
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

/* The child's figure next to the featured game (#gl-figure), standing freely on the page.
   Static HTML = a visitor without anything: a free character's picture and "Bau deine
   Figur →" (to the figure page). A child with a figure, shells or answers gets their own
   figure, the shell count and "Mein Profil →" (to the profile page).
   The picture comes first. The live 3D figure (krabsy-landing-figure.js → three.js, one
   character, the animations) replaces it only after `load` + idle with the spot in view,
   and not at all with "save data", reduced motion, a 2g connection, a very small device or
   without a graphics chip (software drawing would keep a slow computer busy).
   For testing: ?fig=3d allows software drawing too, ?fig=off keeps the picture. */
function initFigure() {
  const root = document.getElementById('gl-figure');
  if (!root) return;
  const link = document.getElementById('lf-link');
  const img = document.getElementById('lf-img');
  const char = savedChar();
  let liveApi = null;
  try {
    img.onerror = () => { if (!img.dataset.fb) { img.dataset.fb = '1'; img.src = portraitUrl(DEFAULT_CHAR); } };
    if (char && !img.src.endsWith(portraitUrl(char))) img.src = portraitUrl(char);
    const render = () => {
      const s = getShells();
      let answered = false;
      try { answered = hasData(); } catch (_) { /* no stats */ }
      if (!savedChar() && !(s.earned > 0) && !answered) return;
      link.href = link.dataset.profileHref;
      document.getElementById('lf-cta').textContent = link.dataset.profileCta;
      document.getElementById('lf-shells-n').textContent = String(s.earned);    // collected so far (nothing is spent)
      document.getElementById('lf-shells').hidden = !(s.earned > 0);
      root.classList.add('is-mine');
    };
    render();
    onShellsChange(render);

    // Arrows: pick another figure right here; it becomes the child's figure in the games.
    // Only until the child builds a figure in the builder (owner 2026-11-25): then the
    // arrows go, so a stray tap can't replace it. ("Mein Profil" → "Figur ändern" instead.)
    let builtFigure = false;
    try { builtFigure = isCustomFigure(JSON.parse(localStorage.getItem('krabsy_figure_v2') || 'null')); } catch (_) { /* none */ }
    const { picks, index } = figurePicks(builtFigure ? [] : getShells().owned);
    let at = index;
    const step = (dir) => {
      at = (at + dir + picks.length) % picks.length;
      const p = picks[at];
      savePick(p);
      img.src = portraitUrl(p.char);
      render();
      if (liveApi && liveApi.show) liveApi.show(p.config, dir);
    };
    if (!builtFigure) root.querySelectorAll('[data-pick]').forEach((b) => {
      b.hidden = false;
      b.addEventListener('click', () => step(Number(b.dataset.pick)));
    });
    root.addEventListener('keydown', (e) => {
      if (e.target.closest('[data-pick]') && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault(); step(e.key === 'ArrowLeft' ? -1 : 1);
      }
    });
    root.dataset.startPick = String(at);
    initFigure.pick = () => picks[at];
  } catch (err) {
    console.warn('landing: figure label left as is', err);
  }

  const force = new URLSearchParams(location.search).get('fig');
  if (force === 'off') return;
  const go = async () => {
    try {
      const { liveFigureBlocked, hasWebGL } = await import('/lib/krabsy-figure-live.js?v=2026-11-25');
      if (liveFigureBlocked() || !hasWebGL(force !== '3d')) return;
      const { startLandingFigure } = await import('/lib/krabsy-landing-figure.js?v=2026-11-25e');
      const cur = initFigure.pick && initFigure.pick();
      liveApi = await startLandingFigure({ root, link, stage: document.getElementById('lf-stage'), canvas: document.getElementById('lf-canvas'),
        char: cur ? cur.char : char, config: cur ? cur.config : null });
    } catch (err) {
      console.warn('landing: live figure skipped', err);
    }
  };
  // after load + idle, and only once the spot is on screen
  const idle = () => (window.requestIdleCallback ? requestIdleCallback(seen, { timeout: 2500 }) : setTimeout(seen, 300));
  const seen = () => {
    try {
      const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); go(); } });
      io.observe(root);
    } catch (_) { go(); }
  };
  if (document.readyState === 'complete') idle(); else addEventListener('load', idle, { once: true });
}

expireNew();
initFigure();
initClassBadge();
initFilters();
initProgress();
