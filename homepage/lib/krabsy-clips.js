// Game clips: a short silent gameplay loop plays over a game card's picture.
//
// - Mouse: on hover (after a short delay, so sweeping across the grid stays
//   calm); keyboard: on focus. Leaving fades back to the picture.
// - Touch screens (no hover): the card that is fully in view plays, one at a time.
// - Nothing plays with "reduce motion" or Save-Data, and nothing downloads
//   before a card asks for it.
//
// Which clip: games.json "clip" = { <section id>: url }, so each section shows
// its own interface language (clips are made by tools/game-clips/record.cjs).
// Works on every card that carries data-game-id (or links to /…/<game id>/),
// whoever rendered it: landing tiles (.gt), hub cards (.k-game-card).
import { currentSection } from './krabsy-lang.js?v=2026-11-27';

const CARD = 'a.gt, a.k-game-card';
const THUMB = '.gt-thumb, .k-game-card-thumb';
const HOVER_DELAY = 140;   // ms

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const saveData = !!(navigator.connection && navigator.connection.saveData);

function gameIdOf(card) {
  if (card.dataset.gameId) return card.dataset.gameId;
  const m = (card.getAttribute('href') || '').match(/\/([a-z0-9-]+)\/?(\?|$)/);
  return m ? m[1] : null;
}

function addStyle() {
  const css = document.createElement('style');
  css.textContent =
    '.k-game-card-thumb{position:relative}' +
    '.k-clip{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;' +
    'opacity:0;transition:opacity .28s ease;pointer-events:none}' +
    '.k-clip.is-on{opacity:1}';
  document.head.appendChild(css);
}

async function clipMap() {
  const sec = currentSection();
  if (!sec) return {};
  const res = await fetch('/data/games.json');
  const games = await res.json();
  const map = {};
  for (const g of games) if (g.clip && g.clip[sec.id]) map[g.id] = g.clip[sec.id];
  return map;
}

function videoFor(card, src) {
  if (card._clip) return card._clip;
  const thumb = card.querySelector(THUMB);
  if (!thumb) return null;
  const v = document.createElement('video');
  v.className = 'k-clip';
  v.muted = true; v.loop = true; v.playsInline = true;
  v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('aria-hidden', 'true');
  v.preload = 'auto';
  v.src = src;
  v.addEventListener('playing', () => { if (card._clipWanted) v.classList.add('is-on'); });
  // right after the picture: badges and the play pill that follow stay on top
  const img = thumb.querySelector('img');
  if (img) img.after(v); else thumb.prepend(v);
  card._clip = v;
  return v;
}

function play(card, src) {
  card._clipWanted = true;
  const v = videoFor(card, src);
  if (!v) return;
  try { v.currentTime = 0; } catch (_) { /* not loaded yet */ }
  const p = v.play();
  if (p && p.catch) p.catch(() => { /* autoplay refused: the picture stays */ });
}

function stop(card) {
  card._clipWanted = false;
  const v = card._clip;
  if (!v) return;
  v.classList.remove('is-on');
  setTimeout(() => { if (!card._clipWanted) v.pause(); }, 300);
}

async function init() {
  if (reduce || saveData) return;
  let map;
  try { map = await clipMap(); } catch (_) { return; }
  if (!Object.keys(map).length) return;
  addStyle();
  const srcOf = (card) => map[gameIdOf(card)];

  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    let timer = null;
    document.addEventListener('pointerover', (e) => {
      const card = e.target.closest && e.target.closest(CARD);
      if (!card || card.contains(e.relatedTarget)) return;
      const src = srcOf(card);
      if (!src) return;
      clearTimeout(timer);
      timer = setTimeout(() => play(card, src), HOVER_DELAY);
    });
    document.addEventListener('pointerout', (e) => {
      const card = e.target.closest && e.target.closest(CARD);
      if (!card || card.contains(e.relatedTarget)) return;
      clearTimeout(timer);
      stop(card);
    });
  } else if ('IntersectionObserver' in window) {
    // touch: the card fully in view plays; only one at a time
    let current = null;
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) {
        if (en.isIntersecting && en.intersectionRatio >= 0.95) {
          if (current && current !== en.target) stop(current);
          current = en.target;
          play(current, srcOf(current));
        } else if (en.target === current) { stop(current); current = null; }
      }
    }, { threshold: [0, 0.95] });
    const watch = () => document.querySelectorAll(CARD).forEach((c) => {
      if (!c._clipWatched && srcOf(c)) { c._clipWatched = true; io.observe(c); }
    });
    watch();
    new MutationObserver(watch).observe(document.body, { childList: true, subtree: true });   // cards built later
  }

  // keyboard
  document.addEventListener('focusin', (e) => {
    const card = e.target.closest && e.target.closest(CARD);
    if (card && card.matches(':focus-visible') && srcOf(card)) play(card, srcOf(card));
  });
  document.addEventListener('focusout', (e) => {
    const card = e.target.closest && e.target.closest(CARD);
    if (card && card._clip) stop(card);
  });
}

init();
