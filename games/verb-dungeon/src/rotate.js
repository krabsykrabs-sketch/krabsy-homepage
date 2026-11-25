// Sideways mode for phones held upright (2026-11-25). Browsers can't force landscape
// (only Android in fullscreen can lock it, iPhones can't at all), so on a narrow
// portrait screen the whole game is drawn turned by 90°: the player turns the phone
// and plays in landscape, even with the phone's rotation lock on. If the phone does
// rotate the page, the screen becomes landscape and the game is drawn normally again.
//
// While rotated, <body> is a landscape box (logical size VW() × VH()) turned 90°
// clockwise; every position:fixed element lives inside it. Code that sizes the canvas
// or places things uses VW()/VH() instead of innerWidth/innerHeight, and screen
// coordinates (touch clientX/Y, getBoundingClientRect) go through toLocal().
//
// The landscape-phone CSS (@media max-height rules) is copied into an extra style
// sheet that is switched on when the LOGICAL height matches, so the compact menus
// apply to the turned game too. CSS uses var(--lw) / var(--lvw) where it needs the
// game's width.

const PORTRAIT = matchMedia('(max-width:640px) and (orientation:portrait)');
const root = document.documentElement;
let rot = false;
let extra = null; // [{ max, sheet }] copies of the max-height media rules

export const isRotated = () => rot;
export const VW = () => (rot ? innerHeight : innerWidth);
export const VH = () => (rot ? innerWidth : innerHeight);

// Screen point → point in the game's own (landscape) coordinates.
export function toLocal(x, y) {
  return rot ? { x: y, y: innerWidth - x } : { x, y };
}
// Centre of an element in the game's own coordinates.
export function centreOf(el) {
  const r = el.getBoundingClientRect();
  return toLocal(r.left + r.width / 2, r.top + r.height / 2);
}

function copyHeightRules() {
  extra = [];
  for (const sheet of document.styleSheets) {
    let rules;
    try { rules = sheet.cssRules; } catch (e) { continue; } // cross-origin font sheets
    for (const r of rules) {
      const m = r.media && /^\(max-height:\s*(\d+)px\)$/.exec(r.media.mediaText.trim());
      if (!m) continue;
      const el = document.createElement('style');
      el.textContent = [...r.cssRules].map((c) => c.cssText).join('\n');
      document.head.appendChild(el);
      el.sheet.disabled = true;
      extra.push({ max: Number(m[1]), sheet: el.sheet });
    }
  }
}

function apply() {
  rot = PORTRAIT.matches;
  root.classList.toggle('rot', rot);
  const w = VW(), h = VH();
  root.style.setProperty('--lw', `${w}px`);
  root.style.setProperty('--lh', `${h}px`);
  root.style.setProperty('--lvw', `${w / 100}px`);
  if (!extra) copyHeightRules();
  for (const e of extra) e.sheet.disabled = !(rot && h <= e.max);
}

// Runs before main.js's own resize listener (this module is imported first), so the
// canvas is sized with the new logical size.
apply();
addEventListener('resize', apply);
PORTRAIT.addEventListener?.('change', () => { apply(); dispatchEvent(new Event('resize')); });
