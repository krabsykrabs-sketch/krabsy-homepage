// Touch controls (phones in landscape, tablets, touch Chromebooks): a virtual stick and
// one sword button. Purely additive: the stick gives a direction that updateHero() uses
// like WASD, the sword button does what Space does (bonk()); menus, the question card
// and the end screen are ordinary buttons and work by tapping.
//
//   Stick: touch anywhere on the left 60 % of the room → the stick appears under the
//          thumb (at rest it waits faint in the bottom-left corner). Analog, with a small
//          dead zone; near the four main directions it snaps to them, so walking straight
//          through a door or across a bridge stone is easy.
//   Sword: the round button in the bottom-right corner.
//
// Shown only on touch devices: from the first touch, or at once when the main pointer
// is coarse. A key press on a device with both (touch Chromebook) hides them again.
// The controls are drawn only while a level is being played (html.touch body.playing).

import { VW, VH, toLocal } from './rotate.js';

export const stick = { x: 0, z: 0, speed: 0 }; // direction (screen right = +x, down = +z) and 0…1 speed

const R = () => (Math.min(VW(), VH()) < 500 ? 46 : 58); // stick radius in px
const DEAD = 0.16, FULL = 0.62, SNAP = 0.36; // dead zone, full speed from, axis snap (radians, ~20°)
let id = null, blocked = false, ox = 0, oy = 0;
let on = false, opts = null, $stick, $knob, $sword;

export const touchOn = () => on;

// Stop moving until the finger is lifted (card opened, hero dropped off the bridge).
export function holdStick() {
  if (id !== null) blocked = true;
  zero();
}

function zero() {
  stick.x = stick.z = stick.speed = 0;
  if ($knob) $knob.style.transform = 'translate(-50%,-50%)';
}

function setMode(v) {
  if (on === v) return;
  on = v;
  document.documentElement.classList.toggle('touch', v);
  if (!v) release();
  opts.onMode(v);
}

function place(x, y) { // the stick's centre, kept clear of the screen edges and the HUD
  const r = R();
  ox = Math.min(VW() * 0.6, Math.max(r + 14, x));
  oy = Math.min(VH() - r - 10, Math.max(r + 70, y));
  $stick.style.left = `${ox}px`; $stick.style.top = `${oy}px`;
  $stick.style.right = $stick.style.bottom = 'auto';
}
function move(x, y) {
  if (blocked) return;
  const r = R();
  let dx = (x - ox) / r, dy = (y - oy) / r;
  const len = Math.hypot(dx, dy);
  if (len > 1) { dx /= len; dy /= len; }
  $knob.style.transform = `translate(calc(-50% + ${dx * r}px), calc(-50% + ${dy * r}px))`;
  const m = Math.min(1, len);
  if (m < DEAD) { stick.x = stick.z = stick.speed = 0; return; }
  let a = Math.atan2(dy, dx);
  const q = Math.round(a / (Math.PI / 2)) * (Math.PI / 2); // the nearest main direction
  if (Math.abs(a - q) < SNAP) a = q;
  stick.x = Math.cos(a); stick.z = Math.sin(a);
  stick.speed = 0.35 + 0.65 * Math.min(1, (m - DEAD) / (FULL - DEAD));
}
function release() {
  id = null; blocked = false;
  zero();
  if ($stick) { $stick.classList.remove('on'); $stick.removeAttribute('style'); }
}

const SWORD_SVG = '<svg viewBox="0 0 64 64" aria-hidden="true"><g fill="none" stroke-linecap="round" stroke-linejoin="round">'
  + '<path d="M44 8h12v12L27 49l-12-12z" fill="#eaf2ff" stroke="#0a1b36" stroke-width="3"/>'
  + '<path d="M50 14L22 42" stroke="#9db4dd" stroke-width="2.5"/>'
  + '<path d="M11 33l20 20" stroke="#ffcf5e" stroke-width="7"/>'
  + '<path d="M17 47l-8 8" stroke="#c98f1c" stroke-width="7"/>'
  + '<circle cx="7.5" cy="56.5" r="4.5" fill="#ffcf5e" stroke="#c98f1c" stroke-width="2"/></g></svg>';
export const swordIcon = SWORD_SVG;

// opts: { canvas, playing() (a level runs and no card is open), onSwing(), onMode(on), label }
export function initTouch(o) {
  opts = o;
  $stick = document.createElement('div');
  $stick.id = 'tStick';
  $stick.innerHTML = '<div class="tKnob"></div>';
  $knob = $stick.firstChild;
  $sword = document.createElement('button');
  $sword.id = 'tSword';
  $sword.setAttribute('aria-label', o.label || 'Swing');
  $sword.innerHTML = SWORD_SVG;
  document.body.append($stick, $sword);

  if (matchMedia('(pointer: coarse)').matches) setMode(true);
  // Any touch turns the touch controls on (before the menu's click, so its texts switch).
  window.addEventListener('touchstart', () => setMode(true), { capture: true, passive: true });
  window.addEventListener('keydown', (e) => {
    if (on && /^(Key[WASD]|Arrow|Space|Enter|Digit)/.test(e.code)) setMode(false);
  }, true);

  // The stick: a touch that lands on the room itself (the canvas; everything above it
  // that is not a button lets touches through).
  window.addEventListener('touchstart', (e) => {
    if (!o.playing()) return;
    for (const t of e.changedTouches) {
      if (t.target !== o.canvas) continue;
      e.preventDefault(); // no zoom, no scrolling, no long-press menu
      const p = toLocal(t.clientX, t.clientY); // screen → game coordinates (rotate.js)
      if (id === null && p.x < VW() * 0.6) {
        id = t.identifier; blocked = false;
        place(p.x, p.y);
        $stick.classList.add('on');
        move(p.x, p.y);
      }
    }
  }, { passive: false });
  window.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) if (t.identifier === id) { e.preventDefault(); const p = toLocal(t.clientX, t.clientY); move(p.x, p.y); }
  }, { passive: false });
  const end = (e) => { for (const t of e.changedTouches) if (t.identifier === id) release(); };
  window.addEventListener('touchend', end);
  window.addEventListener('touchcancel', end);

  // The sword button: touchstart swings at once (no wait for the click).
  const down = () => { $sword.classList.add('down'); o.onSwing(); };
  const up = () => $sword.classList.remove('down');
  $sword.addEventListener('touchstart', (e) => { e.preventDefault(); down(); }, { passive: false });
  $sword.addEventListener('touchend', (e) => { e.preventDefault(); up(); }, { passive: false });
  $sword.addEventListener('touchcancel', up);
  $sword.addEventListener('mousedown', (e) => { e.preventDefault(); down(); }); // trackpad on a touch Chromebook
  $sword.addEventListener('mouseup', up);
  $sword.addEventListener('mouseleave', up);

  // Pinch zoom on older iOS, long-press menus.
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  window.addEventListener('contextmenu', (e) => { if (on) e.preventDefault(); });
}

// The game stopped (menu, end screen, card): let go of the stick.
export function resetTouch() { release(); }
