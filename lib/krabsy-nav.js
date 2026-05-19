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
     import { initDrillPage } from '../../lib/krabsy-nav.js';
     initDrillPage('sprint');   // or 'type_race' | 'drag_match' | …

     import { initToolPage } from '../../lib/krabsy-nav.js';
     initToolPage('flashcards'); // or 'verb_table' | 'free_practice'

   Pages need no HTML mount points — the helper finds the page header and
   the end-actions block by class and inserts itself after them.
   ────────────────────────────────────────────────────────────────────────── */

import { loadStrings } from './krabsy-data.js';

const DRILLS = [
  { key: 'sprint',        slug: 'sprint' },
  { key: 'type_race',     slug: 'type-race' },
  { key: 'drag_match',    slug: 'drag-match' },
  { key: 'fill_gap',      slug: 'fill-the-gap' },
  { key: 'falling_forms', slug: 'falling-forms' },
];

const TOOLS = [
  { key: 'flashcards',    slug: 'flashcards' },
  { key: 'verb_table',    slug: 'verb-table' },
  { key: 'free_practice', slug: 'free-practice' },
];

const GAMES = [
  { key: 'verb_slash',      file: 'verb-slash.html',     thumb: 'VerbSlash.png' },
  { key: 'crab_slash',      file: 'crab-slash.html',     thumb: null },
  { key: 'air_control',     file: 'air-control.html',    thumb: null },
  { key: 'verb_snake',      file: 'verb-snake.html',     thumb: 'verb-snake.png' },
  { key: 'verb_platformer', file: '3dPlat/index.html',   thumb: null },
];

/* Same order as GAMES — used to render the arcade-game chip bar. */
const GAMES_NAV = GAMES;

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

function buildTabBar(items, currentKey, namespace, strings, ariaLabel, guardActiveDrill) {
  const nav = document.createElement('nav');
  nav.className = 'k-nav-chip-bar';
  nav.setAttribute('role', 'navigation');
  nav.setAttribute('aria-label', ariaLabel);

  const inner = document.createElement('div');
  inner.className = 'k-nav-chip-bar-inner';

  for (const item of items) {
    const a = document.createElement('a');
    a.className = 'k-nav-chip';
    const isCurrent = (item.key === currentKey);
    if (isCurrent) {
      a.setAttribute('aria-current', 'page');
      a.href = '#';
      a.addEventListener('click', (ev) => ev.preventDefault());
    } else {
      const href = `../${item.slug}/`;
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
    a.textContent = lookup(strings, `${namespace}.${item.key}.name`) || item.key;
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

function buildGameStrip(strings, count) {
  const wrap = document.createElement('section');
  wrap.className = 'k-game-strip';

  const heading = document.createElement('h3');
  heading.className = 'k-game-strip-heading';
  heading.textContent = lookup(strings, 'common.try_also') || 'Probier auch das';
  wrap.appendChild(heading);

  const grid = document.createElement('div');
  grid.className = 'k-game-strip-grid';

  const picked = shuffle(GAMES).slice(0, Math.min(count, GAMES.length));
  for (const g of picked) {
    const a = document.createElement('a');
    a.className = 'k-game-tile';
    a.href = `../../games/${g.file}`;

    const thumb = document.createElement('div');
    thumb.className = 'k-game-tile-thumb';
    if (g.thumb) {
      const img = document.createElement('img');
      img.src = `../../thumbnails/${g.thumb}`;
      img.alt = '';
      img.loading = 'lazy';
      img.addEventListener('error', () => {
        img.remove();
        thumb.classList.add('has-emoji');
        thumb.textContent = '✏️';
      });
      thumb.appendChild(img);
    } else {
      thumb.classList.add('has-emoji');
      thumb.textContent = '✏️';
    }

    const name = document.createElement('div');
    name.className = 'k-game-tile-name';
    name.textContent = lookup(strings, `games.${g.key}.name`) || g.key;

    a.append(thumb, name);
    grid.appendChild(a);
  }

  wrap.appendChild(grid);
  return wrap;
}

/* ── Public API ──────────────────────────────────────────────────────── */

export async function initDrillPage(currentKey) {
  let strings = null;
  try { strings = await loadStrings(); } catch (_) { /* fallback uses keys */ }

  const header = document.querySelector('header.k-page-header');
  if (header) {
    const nav = buildTabBar(DRILLS, currentKey, 'drills', strings, 'Speed-Drills', true);
    header.insertAdjacentElement('afterend', nav);
  }

  const endActions = document.querySelector(END_ACTIONS_SELECTORS);
  if (endActions && endActions.parentElement) {
    const strip = buildGameStrip(strings, 3);
    // Append to the end of the end-screen card so any static elements
    // between end-actions and the bottom of the card (e.g. ad slots)
    // render above the game strip.
    endActions.parentElement.appendChild(strip);
  }
}

/* ── Arcade-game nav ─────────────────────────────────────────────────── */

let __gamePageLoadTime = null;

export async function initGamePage(currentKey) {
  __gamePageLoadTime = performance.now();
  let strings = null;
  try { strings = await loadStrings(); } catch (_) { /* fallback to keys */ }

  injectGameNavStyles();
  const header = buildGameHeader(currentKey, strings);
  document.body.insertBefore(header, document.body.firstChild);
}

/* True once the game has been visible for >3s — heuristic for "mid-play",
   since arcade games each have their own state we can't reliably introspect. */
function isGameActive() {
  return __gamePageLoadTime !== null
    && (performance.now() - __gamePageLoadTime) > 3000;
}

function buildGameHeader(currentKey, strings) {
  const header = document.createElement('header');
  header.className = 'k-game-nav';

  const logo = document.createElement('a');
  logo.className = 'k-game-nav-logo';
  logo.href = '/';
  logo.textContent = 'Krabsy';
  logo.addEventListener('click', (ev) => guardedGameClick(ev, '/', strings));

  const chipWrap = document.createElement('div');
  chipWrap.className = 'k-game-nav-chips';
  for (const g of GAMES_NAV) {
    const a = document.createElement('a');
    a.className = 'k-game-nav-chip';
    const isCurrent = (g.key === currentKey);
    const name = lookup(strings, `games.${g.key}.name`) || g.key;
    a.textContent = name;
    if (isCurrent) {
      a.setAttribute('aria-current', 'page');
      a.href = '#';
      a.addEventListener('click', (ev) => ev.preventDefault());
    } else {
      const href = `/games/${g.file}`;
      a.href = href;
      a.addEventListener('click', (ev) => guardedGameClick(ev, href, strings));
    }
    chipWrap.appendChild(a);
  }

  const back = document.createElement('a');
  back.className = 'k-game-nav-back';
  back.href = '/';
  back.textContent = '← ' + (lookup(strings, 'common.back_to_hub_short') || 'Zurück');
  back.addEventListener('click', (ev) => guardedGameClick(ev, '/', strings));

  header.append(logo, chipWrap, back);
  return header;
}

function guardedGameClick(ev, href, strings) {
  if (ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.button !== 0) return;
  if (!isGameActive()) return;
  ev.preventDefault();
  showLeaveConfirm(href, strings);
}

/* Inject a self-contained <style> at runtime so games don't need to load
   krabsy-ui.css (which would override their dark themes). All selectors
   are scoped to .k-game-nav-* and .k-nav-confirm. */
function injectGameNavStyles() {
  if (document.getElementById('k-game-nav-styles')) return;
  const css = `
    .k-game-nav {
      position: fixed; top: 0; left: 0; right: 0; height: 48px;
      z-index: 9999;
      display: flex; align-items: center;
      padding: 0 14px; gap: 12px;
      background: #ffffff;
      color: #2c2a3a;
      font-family: Verdana, Geneva, sans-serif;
      box-shadow: 0 2px 6px rgba(0,0,0,0.08);
      box-sizing: border-box;
    }
    .k-game-nav-logo {
      font-family: 'Limelight', cursive;
      font-size: 1.15rem; color: #2c2a3a;
      text-decoration: none; flex-shrink: 0;
    }
    .k-game-nav-chips {
      display: flex; gap: 4px;
      flex: 1; justify-content: center;
      overflow-x: auto; scrollbar-width: none;
    }
    .k-game-nav-chips::-webkit-scrollbar { display: none; }
    .k-game-nav-chip {
      font-family: Verdana, Geneva, sans-serif;
      font-size: 0.72rem; font-weight: 700; letter-spacing: 0.3px;
      padding: 4px 10px; border-radius: 999px;
      white-space: nowrap;
      color: #6e6c80; text-decoration: none;
      flex: 0 0 auto;
      transition: color 0.15s, background-color 0.15s;
    }
    .k-game-nav-chip:hover {
      color: #2c2a3a;
      background: rgba(186, 191, 216, 0.20);
    }
    .k-game-nav-chip[aria-current="page"] {
      background: #f2937e; color: #ffffff;
    }
    .k-game-nav-chip[aria-current="page"]:hover { background: #e07a64; color: #ffffff; }
    .k-game-nav-back {
      font-size: 0.78rem; font-weight: 700;
      color: #e07a64; text-decoration: none; flex-shrink: 0;
    }
    .k-game-nav-back:hover { color: #f2937e; }

    /* Standalone confirm-dialog styling (so it looks right even without krabsy-ui.css) */
    .k-nav-confirm { border: none; padding: 0; background: transparent; max-width: 90vw; }
    .k-nav-confirm::backdrop { background: rgba(44,42,58,0.4); }
    .k-nav-confirm-card {
      background: #ffffff; border-radius: 16px; padding: 24px;
      width: 380px; max-width: 100%;
      box-shadow: 0 6px 20px rgba(44,42,58,0.20);
      font-family: Verdana, Geneva, sans-serif; color: #2c2a3a;
    }
    .k-nav-confirm-title { font-family: 'Limelight', cursive; font-size: 1.2rem; margin: 0 0 8px; color: #2c2a3a; }
    .k-nav-confirm-body { color: #6e6c80; margin: 0 0 18px; line-height: 1.45; font-size: 0.95rem; }
    .k-nav-confirm-actions { display: flex; gap: 12px; justify-content: flex-end; flex-wrap: wrap; }
    .k-nav-confirm-actions [data-action] {
      font-family: inherit; font-weight: 700;
      padding: 10px 20px; border-radius: 999px;
      border: 2px solid; cursor: pointer;
      font-size: 0.95rem;
    }
    .k-nav-confirm-actions [data-action="cancel"] {
      background: transparent; color: #2c2a3a; border-color: #cdd9b4;
    }
    .k-nav-confirm-actions [data-action="confirm"] {
      background: #f2937e; color: #ffffff; border-color: #f2937e;
    }
  `;
  const style = document.createElement('style');
  style.id = 'k-game-nav-styles';
  style.textContent = css;
  document.head.appendChild(style);
}

export async function initToolPage(currentKey) {
  let strings = null;
  try { strings = await loadStrings(); } catch (_) { /* fallback uses keys */ }

  const header = document.querySelector('header.k-page-header');
  if (header) {
    const nav = buildTabBar(TOOLS, currentKey, 'tools', strings, 'Lernwerkzeuge');
    header.insertAdjacentElement('afterend', nav);
  }
}
