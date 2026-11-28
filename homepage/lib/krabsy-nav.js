/* ──────────────────────────────────────────────────────────────────────────
   Krabsy — Sub-nav for drill & tool pages
   ES module. Injects two pieces of chrome into module HTML pages:

     • A chip bar under the page header listing all peer modules
       (5 drills on drill pages, 3 tools on tool pages), with the current
       page highlighted via aria-current="page".
     • On drill pages only: a "Probier auch das" strip below the end-screen
       action buttons showing 2–3 random arcade game tiles. Tools are calm
       no-pressure activities and don't get this strip.

   Per-page usage:
     import { initDrillPage } from '/lib/krabsy-nav.js';
     initDrillPage('sprint');   // or 'type_race' | 'drag_match' | …

     import { initToolPage } from '/lib/krabsy-nav.js';
     initToolPage('flashcards'); // or 'verb_table' | 'free_practice' | 'verb_diplom'

   Cache-busting: every page imports this module via `?v=YYYY-MM-DD`
   (see any moved HTML for the pattern). Bump that marker across all HTML
   pages whenever you make a backwards-incompatible change here or in any
   library this module imports from — otherwise users may keep running a
   cached older copy that, e.g., still emits old-format URLs after a
   URL-structure migration.

   Pages need no HTML mount points — the helper finds the page header and
   the end-actions block by class and inserts itself after them.
   ────────────────────────────────────────────────────────────────────────── */

import { loadStrings, buildPageUrl, getTopicSlug, getAllGames, getGamesForTopic } from './krabsy-data.js';
import { mountShellCounter } from './krabsy-shells.js';
import { currentLang, currentSection, sectionGames, gameUrl, uiPage } from './krabsy-lang.js?v=2026-11-27';

/* For the chip bar we need a key (i18n lookup) and a pageId understood by
   buildPageUrl(). Slugs themselves now come from /data/topics.json — see
   getPageSlug() — and may differ per language. */
const DRILLS = [
  { key: 'sprint',        pageId: 'sprint' },
  { key: 'type_race',     pageId: 'type-race' },
  { key: 'drag_match',    pageId: 'drag-match' },
  { key: 'fill_gap',      pageId: 'fill-the-gap' },
  { key: 'falling_forms', pageId: 'falling-forms' },
];

const TOOLS = [
  { key: 'flashcards',    pageId: 'flashcards' },
  { key: 'verb_table',    pageId: 'verb-table' },
  { key: 'free_practice', pageId: 'free-practice' },
  // The Verb-Diplom sits with the tools (its name lives under drills.verb_diplom).
  // Topics without a diplom pass an explicit tool list (prepositions).
  { key: 'verb_diplom',   pageId: 'verb-diplom', ns: 'drills' },
];

/* Arcade games live outside the topic tree, under the section's games folder
   (sections.json: /de/spiele/, /es/juegos/, /en/spanish/games/). A section
   shows only the games that play one of its topics (krabsy-lang.js). The game
   catalogue lives in /data/games.json (getAllGames / getGamesForTopic). */

/* Default topic when a caller doesn't specify one. Drill/tool pages that
   pre-date the topic chooser (every verb-side page) omit the topic arg and
   inherit this. Prep pages pass `'prepositions'` explicitly. */
const DEFAULT_TOPIC = 'irregular_verbs';

const ICONS = '/lib/icons/krabsy-icons.svg?v=2026-11-27c';
const icon = (id, cls, size) => `<svg class="${cls}" viewBox="0 0 24 24"${size ? ` width="${size}" height="${size}"` : ''} aria-hidden="true" focusable="false"><use href="${ICONS}#${id}"/></svg>`;

const END_ACTIONS_SELECTORS = [
  '.sprint-end-actions',
  '.tr-end-actions',
  '.dm-end-actions',
  '.fg-end-actions',
  '.ff-end-actions',
].join(', ');

/* ── Helpers ─────────────────────────────────────────────────────────── */

function lookup(strings, path) {
  if (!strings) return null;
  return path.split('.').reduce((o, k) => (o == null ? null : o[k]), strings);
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* Resolve the chip URL for a (topic, pageId, lang) triple. Tries the
   canonical buildPageUrl() path first — that reads per-page slugs from
   topics.json (which lets a slug like 'flashcards' map to DE
   'karteikarten' / ES 'tarjetas'). When topics.json doesn't declare a
   page for the topic (the prep topic ships with `pages: {}` today and
   gets per-page entries in a later task), fall back to constructing
   the URL from the topic's top-level slug + the pageId verbatim. Every
   drill in DRILLS has the same slug as its pageId across both
   languages — verified in topics.json — so this fallback yields the
   correct on-disk URL for prep drill pages. Returns null only when
   even the topic slug is unknown. */
async function resolveChipHref(topic, pageId, lang) {
  try {
    const declared = await buildPageUrl(topic, pageId, lang);
    if (declared) return declared;
  } catch (_) { /* fall through to fallback */ }
  try {
    const topicSlug = await getTopicSlug(topic, lang);
    if (topicSlug) return `/${lang}/${topicSlug}/${pageId}/`;
  } catch (_) { /* fall through */ }
  return null;
}

async function buildTabBar(items, currentKey, namespace, strings, ariaLabel, guardActiveDrill, topic = DEFAULT_TOPIC) {
  const nav = document.createElement('nav');
  nav.className = 'k-nav-chip-bar';
  nav.setAttribute('role', 'navigation');
  nav.setAttribute('aria-label', ariaLabel);

  const inner = document.createElement('div');
  inner.className = 'k-nav-chip-bar-inner';

  const lang = currentLang();
  // Resolve every chip URL in parallel.
  const hrefs = await Promise.all(
    items.map((item) => resolveChipHref(topic, item.pageId, lang))
  );

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const a = document.createElement('a');
    a.className = 'k-nav-chip';
    const isCurrent = (item.key === currentKey);
    if (isCurrent) {
      a.setAttribute('aria-current', 'page');
      a.href = '#';
      a.addEventListener('click', (ev) => ev.preventDefault());
    } else {
      const href = hrefs[i];
      if (!href) {
        // topics.json unreachable for this entry. Render the chip as an
        // inert label so the bar still looks complete and we get a console
        // signal — silent skip would just leave a hole and look like a bug.
        console.warn(`krabsy-nav: no URL for ${namespace}:${item.pageId} in lang=${lang}; rendering inert chip`);
        a.setAttribute('aria-disabled', 'true');
        a.href = '#';
        a.addEventListener('click', (ev) => ev.preventDefault());
      } else {
        a.href = href;
        if (guardActiveDrill) {
          a.addEventListener('click', (ev) => {
            // Honor user intent to open in a new tab/window.
            if (ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.button !== 0) return;
            if (!isDrillActive()) return;  // start/end screen → silent jump
            ev.preventDefault();
            showLeaveConfirm(href, strings);
          });
        }
      }
    }
    a.textContent = lookup(strings, `${item.ns || namespace}.${item.key}.name`) || item.key;
    inner.appendChild(a);
  }
  nav.appendChild(inner);
  return nav;
}

/* True when any drill *-play section is currently rendered (offsetParent
   is null whenever the element or an ancestor is display:none, which is
   how every drill hides screens via its *-hidden class). */
function isDrillActive() {
  const playEls = document.querySelectorAll('[id$="-play"]');
  for (const el of playEls) {
    if (el.offsetParent !== null) return true;
  }
  return false;
}

function showLeaveConfirm(href, strings) {
  const dlg = document.createElement('dialog');
  dlg.className = 'k-nav-confirm';

  const card = document.createElement('div');
  card.className = 'k-nav-confirm-card';

  const title = document.createElement('h3');
  title.className = 'k-nav-confirm-title';
  title.textContent = lookup(strings, 'common.leave_drill_title') || 'Spiel verlassen?';

  const body = document.createElement('p');
  body.className = 'k-nav-confirm-body';
  body.textContent =
    lookup(strings, 'common.leave_drill_body') || 'Dein Fortschritt geht verloren.';

  const actions = document.createElement('div');
  actions.className = 'k-nav-confirm-actions';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'k-btn-secondary';
  cancelBtn.textContent =
    lookup(strings, 'common.leave_drill_cancel') || 'Weiterspielen';

  const confirmBtn = document.createElement('button');
  confirmBtn.type = 'button';
  confirmBtn.className = 'k-btn-primary';
  confirmBtn.textContent =
    lookup(strings, 'common.leave_drill_confirm') || 'Verlassen';

  // Tag with data-action so the standalone game-nav CSS can style them
  // even when krabsy-ui.css isn't loaded on the page (arcade games).
  cancelBtn.setAttribute('data-action', 'cancel');
  confirmBtn.setAttribute('data-action', 'confirm');

  cancelBtn.addEventListener('click', () => dlg.close('cancel'));
  confirmBtn.addEventListener('click', () => dlg.close('confirm'));
  dlg.addEventListener('close', () => {
    const result = dlg.returnValue;
    dlg.remove();
    if (result === 'confirm') window.location.href = href;
  });
  // Native <dialog>'s ESC closes with empty returnValue → treated as cancel.

  actions.append(cancelBtn, confirmBtn);
  card.append(title, body, actions);
  dlg.appendChild(card);
  document.body.appendChild(dlg);

  if (typeof dlg.showModal === 'function') {
    dlg.showModal();
    // Focus the safe option (cancel) so Enter doesn't immediately leave.
    cancelBtn.focus();
  } else {
    // Fallback for very old browsers without <dialog>
    const ok = window.confirm(`${title.textContent}\n\n${body.textContent}`);
    dlg.remove();
    if (ok) window.location.href = href;
  }
}

/* Build the "Probier auch das" strip from the topic-filtered game catalogue.
   Returns null if no compatible games exist — caller should NOT mount the
   strip at all in that case (no heading without games beneath it). */
async function buildGameStrip(strings, count, topic) {
  let games = [];
  try { games = await getGamesForTopic(topic); }
  catch (err) { console.error('krabsy-nav: games.json fetch failed', err); }

  // Only playable games — coming-soon entries don't belong on a recommendation strip.
  // Teacher-led games (Quiz-Raum) aren't something a child can start alone.
  games = games.filter((g) => g.status !== 'coming_soon' && g.audience !== 'teacher');
  if (!games.length) return null;

  const wrap = document.createElement('section');
  wrap.className = 'k-game-strip';

  const heading = document.createElement('h3');
  heading.className = 'k-game-strip-heading';
  heading.textContent = lookup(strings, 'common.try_also') || 'Probier auch das';
  wrap.appendChild(heading);

  const grid = document.createElement('div');
  grid.className = 'k-game-strip-grid';

  const picked = shuffle(games).slice(0, Math.min(count, games.length));
  const lang = currentLang();
  const section = currentSection();
  for (const g of picked) {
    const a = document.createElement('a');
    a.className = 'k-game-tile';
    a.href = gameUrl(section, g.id);

    const thumb = document.createElement('div');
    thumb.className = 'k-game-tile-thumb';
    if (g.thumbnail) {
      const img = document.createElement('img');
      img.src = g.thumbnail;
      img.alt = '';
      img.loading = 'lazy';
      img.addEventListener('error', () => {
        img.remove();
        thumb.classList.add('has-emoji');
        thumb.innerHTML = icon('ki-play', 'k-game-tile-ico', 40);
      });
      thumb.appendChild(img);
    } else {
      thumb.classList.add('has-emoji');
      thumb.innerHTML = icon('ki-play', 'k-game-tile-ico', 40);
    }

    const name = document.createElement('div');
    name.className = 'k-game-tile-name';
    name.textContent = (g.name && g.name[lang]) || g.id;

    a.append(thumb, name);
    grid.appendChild(a);
  }

  wrap.appendChild(grid);
  return wrap;
}

/* ── Public API ──────────────────────────────────────────────────────── */

/**
 * Mount the drill chip-bar (peer-drill nav) and the "Probier auch das"
 * game strip on a drill page. Also wires the body.k-is-playing class
 * toggle that lets `.k-intro-card` hide itself during play.
 *
 * @param {string}        currentKey  Drill key for this page, e.g. 'sprint'.
 *                                     Matched against DRILLS[*].key to mark
 *                                     the active chip.
 * @param {string}        topic        Topic ID ('irregular_verbs' or
 *                                     'prepositions'). Default keeps
 *                                     verb-side callers byte-identical.
 * @param {string[]|null} drillKeys    Allow-list of drill keys to render
 *                                     in the chip-bar. Null = render every
 *                                     drill in DRILLS (verb-side default).
 *                                     Topics that ship only a subset of
 *                                     drills pass an explicit array, e.g.
 *                                     ['sprint', 'fill_gap'] for prep —
 *                                     this prevents chips that link to
 *                                     non-existent drill pages.
 */
export async function initDrillPage(currentKey, topic = DEFAULT_TOPIC, drillKeys = null) {
  let strings = null;
  try { strings = await loadStrings(); } catch (_) { /* fallback uses keys */ }

  // Filter the drill list when the caller specified an allow-list. Null /
  // omitted keeps every drill, preserving the verb-side rendering exactly.
  const items = Array.isArray(drillKeys)
    ? DRILLS.filter((d) => drillKeys.includes(d.key))
    : DRILLS;

  const header = document.querySelector('header.k-page-header');
  if (header) {
    const nav = await buildTabBar(items, currentKey, 'drills', strings, 'Speed-Drills', true, topic);
    header.insertAdjacentElement('afterend', nav);
  }

  const endActions = document.querySelector(END_ACTIONS_SELECTORS);
  if (endActions && endActions.parentElement) {
    const strip = await buildGameStrip(strings, 3, topic);
    // If no games are tagged for the current topic, render nothing at all —
    // we don't want a "Probier auch das" heading without games under it.
    if (strip) {
      // Append to the end of the end-screen card so any static elements
      // between end-actions and the bottom of the card (e.g. ad slots)
      // render above the game strip.
      endActions.parentElement.appendChild(strip);
    }
  }

  watchPlayScreen();
}

/* Mirror the visibility of the drill's *-play section onto body.k-is-playing.
   Used by the .k-intro-card SEO/orientation block to hide itself mid-game. */
function watchPlayScreen() {
  const playEls = Array.from(document.querySelectorAll('[id$="-play"]'));
  if (!playEls.length) return;
  const sync = () => {
    document.body.classList.toggle('k-is-playing', isDrillActive());
  };
  sync();
  const obs = new MutationObserver(sync);
  for (const el of playEls) {
    obs.observe(el, { attributes: true, attributeFilter: ['class', 'style', 'aria-hidden'] });
  }
}

/* ── Arcade-game nav ─────────────────────────────────────────────────── */

let __gamePageLoadTime = null;

export async function initGamePage(currentKey) {
  __gamePageLoadTime = performance.now();
  let strings = null;
  try { strings = await loadStrings(); } catch (_) { /* fallback to keys */ }

  injectGameNavStyles();
  const header = await buildGameHeader(currentKey, strings);
  document.body.insertBefore(header, document.body.firstChild);
}

/* True once the game has been visible for >3s — heuristic for "mid-play",
   since arcade games each have their own state we can't reliably introspect. */
function isGameActive() {
  return __gamePageLoadTime !== null
    && (performance.now() - __gamePageLoadTime) > 3000;
}

async function buildGameHeader(currentKey, strings) {
  const header = document.createElement('header');
  header.className = 'k-game-nav';

  const lang = currentLang();
  const section = currentSection();
  // Arcade pages live OUTSIDE the topic tree, under the section's games folder.
  // The logo and back link go to the section home (the topic chooser), which
  // is the canonical entry point of the site.
  const hubHref = section.home;

  const logo = document.createElement('a');
  logo.className = 'k-game-nav-logo';
  logo.href = hubHref;
  logo.setAttribute('aria-label', 'Krabsy');
  // Same brand logo as the site header: "kr" + crab + "bsy".
  logo.innerHTML = '<span>kr</span><span class="k-game-nav-crab" aria-hidden="true">'
    + '<img src="/favicon.png?v=2026-11-27" alt="" decoding="async"></span><span>bsy</span>';
  logo.addEventListener('click', (ev) => guardedGameClick(ev, hubHref, strings));

  // Owner 2026-11-27: the game header follows the site's top bar style. Instead of a row
  // of every game: one "Alle Spiele" pill (back to the games), the current game's name,
  // and the shells. Switching games happens on the games page.
  let games = [];
  try { games = sectionGames(await getAllGames(), section); }
  catch (err) { console.error('krabsy-nav: games.json fetch failed', err); }
  // Normalize the page-supplied currentKey ("verb_slash") to the games.json id ("verb-slash").
  const currentId = String(currentKey || '').replace(/_/g, '-');
  const cur = games.find((g) => g.id === currentId);
  const gamesHref = section.games || hubHref;
  const ALL = { de: 'Alle Spiele', es: 'Todos los juegos', en: 'All games' };

  const back = document.createElement('a');
  back.className = 'k-game-nav-back';
  back.href = gamesHref;
  back.innerHTML = '<svg class="k-game-nav-ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="#2c2a3a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
    + '<path fill="#2ee6c0" d="M7.5 7h9a4.5 4.5 0 0 1 4.4 3.6l1 5a2.8 2.8 0 0 1-4.8 2.4L15 16H9l-2.1 2a2.8 2.8 0 0 1-4.8-2.4l1-5A4.5 4.5 0 0 1 7.5 7z"/>'
    + '<path d="M7.5 10.5v3M6 12h3"/><circle fill="#2c2a3a" stroke="none" cx="15.5" cy="11" r="1.1"/><circle fill="#2c2a3a" stroke="none" cx="17.6" cy="13.2" r="1.1"/></svg>'
    + '<span>' + (ALL[lang] || ALL.en) + '</span>';
  back.setAttribute('aria-label', ALL[lang] || ALL.en);
  back.addEventListener('click', (ev) => guardedGameClick(ev, gamesHref, strings));

  const title = document.createElement('span');
  title.className = 'k-game-nav-title';
  title.textContent = (cur && cur.name && (cur.name[lang] || cur.name.en)) || '';

  // Class session (phase 2): "6b · Mia" with the class icon, so pupils see their answers go to the class.
  let classBadge = null;
  try {
    const cs = JSON.parse(localStorage.getItem('krabsy_class') || 'null');
    const classUrl = uiPage('class', lang);         // not every interface language has classes
    if (cs && cs.name && classUrl) {
      classBadge = document.createElement('a');
      classBadge.className = 'k-game-nav-class';
      classBadge.href = classUrl;
      classBadge.innerHTML = icon('ki-class', 'k-game-nav-ico') + '<span></span>';
      classBadge.lastChild.textContent = cs.name + ' · ' + cs.nickname;
      classBadge.addEventListener('click', (ev) => guardedGameClick(ev, classBadge.href, strings));
    }
  } catch (_) { /* no storage */ }

  const grow = document.createElement('span');
  grow.className = 'k-game-nav-grow';
  // DE|ES like the site header (owner 2026-11-27: "I don't see the switch anymore");
  // only where the same games exist in another interface language (not /en/spanish/).
  let toggle = null;
  if (lang === 'de' || lang === 'es') {
    toggle = document.createElement('div');
    toggle.className = 'k-lang-toggle k-game-nav-lang';
    toggle.setAttribute('role', 'group');
    toggle.setAttribute('aria-label', lang === 'es' ? 'Idioma del menú' : 'Menüsprache');
    for (const l of ['de', 'es']) {
      const bt = document.createElement('button');
      bt.type = 'button';
      bt.className = 'k-lang-btn' + (l === lang ? ' is-active' : '');
      bt.dataset.lang = l;
      bt.textContent = l.toUpperCase();
      bt.setAttribute('aria-label', l === 'de' ? 'Deutsch' : 'Español');
      if (l === lang) bt.setAttribute('aria-current', 'true');
      else bt.addEventListener('click', (ev) => {
        // the same game in the other interface language: /de/spiele/x/ <-> /es/juegos/x/
        const to = location.pathname.replace(/^\/(de\/spiele|es\/juegos)\//, l === 'es' ? '/es/juegos/' : '/de/spiele/');
        try { localStorage.setItem('krabsy_lang', l); } catch (_) { /* private mode */ }
        guardedGameClick(ev, to + location.search + location.hash, strings);
        if (!ev.defaultPrevented) location.href = to + location.search + location.hash;
      });
      toggle.appendChild(bt);
    }
  }
  header.append(...[logo, back, title, grow, classBadge, toggle].filter(Boolean));

  // Shell counter (krabsy-shells.js): links to the profile page.
  const shells = mountShellCounter(header);
  if (shells) {
    header.appendChild(shells);   // right edge, like the site header
    shells.addEventListener('click', (ev) => guardedGameClick(ev, shells.href, strings));
  }
  return header;
}

function guardedGameClick(ev, href, strings) {
  if (ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.button !== 0) return;
  if (!isGameActive()) return;
  ev.preventDefault();
  showLeaveConfirm(href, strings);
}

/* Inject a self-contained <style> at runtime so games don't need to load
   krabsy-ui.css (which would restyle the inlined games). All selectors are
   scoped to .k-game-nav-* and .k-nav-confirm.
   One family with the site header (krabsy-ui.css ".k-hd", 2026-11-28): the same
   white bar and shadow, logo, pill shapes, shell counter and DE|ES switch, only
   48 px high instead of 60 so the game gets the screen. "Alle Spiele" looks like
   the site menu's current item (the player is in "Spielen"). */
function injectGameNavStyles() {
  if (document.getElementById('k-game-nav-styles')) return;
  const css = `
    @import url('/lib/fonts/krabsy-fonts.css?v=2026-11-26f');   /* Fredoka Display for the logo — games don't load krabsy-ui.css */
    .k-game-nav {
      position: fixed; top: 0; left: 0; right: 0; height: 48px;
      z-index: 9999;
      display: flex; align-items: center;
      padding: 0 24px; gap: 10px;
      background: #ffffff;
      color: #2c2a3a;
      font-family: 'Nunito', system-ui, sans-serif; line-height: 1;
      box-shadow: 0 1px 6px rgba(44,42,58,0.05), 0 1px 0 #e8e9f0;
      box-sizing: border-box;
      -webkit-user-select: none; user-select: none;
    }
    .k-game-nav *, .k-game-nav *::before, .k-game-nav *::after { box-sizing: border-box; }
    .k-game-nav-logo {
      font-family: 'Fredoka Display', 'Nunito', sans-serif;
      font-size: 1.5rem; color: #2c2a3a; line-height: 1;
      letter-spacing: -0.5px; margin-right: 6px;
      display: inline-flex; align-items: center;
      text-decoration: none; flex-shrink: 0;
    }
    .k-game-nav-logo:hover { color: #2c2a3a; }
    .k-game-nav-crab {
      display: inline-flex; width: 1.15em; height: 1.15em;
      align-items: center; justify-content: center; margin: 0 -0.04em;
    }
    .k-game-nav-crab img { display: block; width: 100%; height: 100%; object-fit: contain; pointer-events: none; }
    .k-game-nav-ico { width: 22px; height: 22px; flex: 0 0 auto; display: block; }
    .k-game-nav-back {
      display: inline-flex; align-items: center; gap: 7px; flex-shrink: 0;
      height: 36px; padding: 0 14px 0 11px; border-radius: 999px;
      font-family: 'Nunito', system-ui, sans-serif; font-size: 0.92rem; font-weight: 800; line-height: 1;
      color: #2c2a3a; text-decoration: none; white-space: nowrap;
      background: #dcf7f0; box-shadow: inset 0 0 0 2px #2ee6c0;
      transition: background-color 0.15s ease;
    }
    .k-game-nav-back:hover { background: #c9f2e8; color: #2c2a3a; }
    .k-game-nav a:focus-visible, .k-game-nav button:focus-visible { outline: 3px solid #2c2a3a; outline-offset: 2px; }
    .k-game-nav-title {
      font-family: 'Fredoka Display', 'Nunito', sans-serif; font-size: 1.2rem; color: #2c2a3a; line-height: 1.2;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; margin-left: 2px;
    }
    .k-game-nav-grow { flex: 1; min-width: 0; }
    .k-game-nav-lang { display: inline-flex; flex-shrink: 0; border-radius: 999px; background: #e8e9f0; overflow: hidden; }
    .k-game-nav-lang .k-lang-btn {
      display: inline-flex; align-items: center; min-height: 34px; padding: 0 13px; margin: 0;
      border: 0; border-radius: 999px; cursor: pointer; background: transparent; color: #6e6c80;
      font: 700 0.78rem/1 'Nunito', system-ui, sans-serif; letter-spacing: 0.5px;
      transition: color 0.15s ease, background-color 0.15s ease;
    }
    .k-game-nav-lang .k-lang-btn:hover:not(.is-active) { color: #2c2a3a; }
    .k-game-nav-lang .k-lang-btn.is-active { background: #2c2a3a; color: #ffffff; }
    .k-game-nav-lang .k-lang-btn:focus-visible { outline-offset: -3px; }
    /* the site header's shell pill (krabsy-shells.js draws it), a little lower */
    .k-game-nav .k-shells { min-height: 34px; padding: 0 12px; margin: 0; font-size: 0.85rem; }
    .k-game-nav-class {
      display: inline-flex; align-items: center; gap: 6px; min-height: 34px; padding: 0 12px 0 9px;
      font-size: 0.8rem; font-weight: 700; color: #2c2a3a; background: #ffffff;
      box-shadow: inset 0 0 0 1.5px #babfd8;
      border-radius: 999px; text-decoration: none; white-space: nowrap;
      flex-shrink: 1; min-width: 0; max-width: 30vw;
    }
    .k-game-nav-class:hover { background: #e8e9f0; color: #2c2a3a; }
    .k-game-nav-class .k-game-nav-ico { width: 18px; height: 18px; }
    .k-game-nav-class span { overflow: hidden; text-overflow: ellipsis; }
    @media (max-width: 1099px) { .k-game-nav { padding: 0 16px; gap: 8px; } }
    @media (max-width: 560px) {
      .k-game-nav { gap: 6px; padding: 0 10px; }
      .k-game-nav-logo { margin-right: 0; }
      .k-game-nav-logo > span:not(.k-game-nav-crab) { display: none; }   /* crab only */
      .k-game-nav-back span { display: none; }
      .k-game-nav-back { width: 40px; padding: 0; justify-content: center; }
      .k-game-nav-title { font-size: 1.05rem; }
      .k-game-nav-lang .k-lang-btn { padding: 0 9px; }
      .k-game-nav .k-shells { padding: 0 9px; }
      .k-game-nav-class { max-width: 22vw; padding: 0 9px 0 7px; }
    }

    /* Standalone confirm-dialog styling (so it looks right even without krabsy-ui.css) */
    .k-nav-confirm { border: none; padding: 0; background: transparent; max-width: 90vw; }
    .k-nav-confirm::backdrop { background: rgba(44,42,58,0.4); }
    .k-nav-confirm-card {
      background: #ffffff; border-radius: 16px; padding: 24px;
      width: 380px; max-width: 100%;
      box-shadow: 0 6px 20px rgba(44,42,58,0.20);
      font-family: 'Nunito', system-ui, sans-serif; color: #2c2a3a;
    }
    .k-nav-confirm-title { font-family: 'Fredoka Display', 'Nunito', sans-serif; font-size: 1.2rem; margin: 0 0 8px; color: #2c2a3a; }
    .k-nav-confirm-body { color: #6e6c80; margin: 0 0 18px; line-height: 1.45; font-size: 0.95rem; }
    .k-nav-confirm-actions { display: flex; gap: 12px; justify-content: flex-end; flex-wrap: wrap; }
    .k-nav-confirm-actions [data-action] {
      font-family: inherit; font-weight: 700;
      padding: 10px 20px; border-radius: 999px;
      border: 2px solid; cursor: pointer;
      font-size: 0.95rem;
    }
    .k-nav-confirm-actions [data-action="cancel"] {
      background: #ffffff; color: #2c2a3a; border-color: rgba(44,42,58,0.2);
    }
    .k-nav-confirm-actions [data-action="confirm"] {
      background: #bf4a33; color: #ffffff; border-color: #bf4a33;   /* white on the old salmon was 2.3:1 */
    }
    .k-nav-confirm-actions [data-action]:focus-visible { outline: 3px solid #2c2a3a; outline-offset: 2px; }
  `;
  const style = document.createElement('style');
  style.id = 'k-game-nav-styles';
  style.textContent = css;
  document.head.appendChild(style);
}

/**
 * Mount the tool chip-bar on a tool page. Same pattern as initDrillPage.
 *
 * @param {string}        currentKey  Tool key, e.g. 'flashcards'.
 * @param {string}        topic        Default keeps verb-side callers identical.
 * @param {string[]|null} toolKeys     Allow-list of tool keys. Null = all tools
 *                                     (verb-side default). Topics that ship
 *                                     only a subset pass an explicit array,
 *                                     e.g. ['flashcards', 'free_practice'] for
 *                                     prep — prevents chips that link to
 *                                     non-existent tool pages.
 */
export async function initToolPage(currentKey, topic = DEFAULT_TOPIC, toolKeys = null) {
  let strings = null;
  try { strings = await loadStrings(); } catch (_) { /* fallback uses keys */ }

  const items = Array.isArray(toolKeys)
    ? TOOLS.filter((t) => toolKeys.includes(t.key))
    : TOOLS;

  const header = document.querySelector('header.k-page-header');
  if (header) {
    const nav = await buildTabBar(items, currentKey, 'tools', strings, 'Lernwerkzeuge', false, topic);
    header.insertAdjacentElement('afterend', nav);
  }
}
