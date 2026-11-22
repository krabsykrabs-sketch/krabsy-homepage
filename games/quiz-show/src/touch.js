// Touch controls for the child page (tablets, phones, touch Chromebooks), adapted from
// Verb Dungeon: a virtual stick and a jump button. Purely additive: the stick feeds the
// controller like WASD (Controller.touch), the button does what Space does. Answer
// cards, emotes and the join form are ordinary buttons and work by tapping.
//
//   Stick: touch anywhere on the left 60 % of the room → it appears under the thumb.
//          Analog with a small dead zone; full push = running.
//   Jump:  the round button bottom right (above the emote buttons).
//
// Shown only on touch devices: from the first touch, or at once when the main pointer is
// coarse. A key press on a device with both (touch Chromebook) hides them again.

const R = () => (Math.min(innerWidth, innerHeight) < 500 ? 46 : 58);
const DEAD = 0.16, RUN = 0.85;
let id = null, ox = 0, oy = 0, on = false;
let $stick, $knob, $jump, opts;
export const touchOn = () => on;

function setMode(v) {
  if (on === v) return;
  on = v;
  document.documentElement.classList.toggle('touch', v);
  if (!v) release();
}

function place(x, y) {
  const r = R();
  ox = Math.min(innerWidth * 0.6, Math.max(r + 14, x));
  oy = Math.min(innerHeight - r - 10, Math.max(r + 70, y));
  $stick.style.left = `${ox}px`; $stick.style.top = `${oy}px`;
}

function move(x, y) {
  const r = R(), c = opts.controller;
  let dx = (x - ox) / r, dy = (y - oy) / r;
  const len = Math.hypot(dx, dy);
  if (len > 1) { dx /= len; dy /= len; }
  $knob.style.transform = `translate(calc(-50% + ${dx * r}px), calc(-50% + ${dy * r}px))`;
  const m = Math.min(1, len);
  if (m < DEAD) { c.touch.x = c.touch.z = 0; c.touchRun = false; return; }
  const k = Math.min(1, (m - DEAD) / (1 - DEAD));
  c.touch.x = (dx / Math.max(len, 1e-6)) * k;
  c.touch.z = (dy / Math.max(len, 1e-6)) * k;
  c.touchRun = m > RUN;
}

function release() {
  id = null;
  if (opts) { opts.controller.touch.x = opts.controller.touch.z = 0; opts.controller.touchRun = false; }
  if ($knob) $knob.style.transform = 'translate(-50%,-50%)';
  if ($stick) $stick.classList.remove('on');
}

// opts: { canvas, controller, playing() (in the room, no card open) }
export function initTouch(o) {
  opts = o;
  $stick = document.createElement('div'); $stick.id = 'tStick';
  $stick.innerHTML = '<div class="tKnob"></div>'; $knob = $stick.firstChild;
  $jump = document.createElement('button'); $jump.id = 'tJump'; $jump.setAttribute('aria-label', 'Jump');
  $jump.innerHTML = '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 12 L50 34 H40 V52 H24 V34 H14 Z" fill="#eaf2ff" stroke="#0a1b36" stroke-width="3" stroke-linejoin="round"/></svg>';
  document.body.append($stick, $jump);

  if (matchMedia('(pointer: coarse)').matches) setMode(true);
  window.addEventListener('touchstart', () => setMode(true), { capture: true, passive: true });
  window.addEventListener('keydown', (e) => {
    if (on && /^(Key[WASD]|Arrow|Space)/.test(e.code) && e.target.tagName !== 'INPUT') setMode(false);
  }, true);

  window.addEventListener('touchstart', (e) => {
    if (!o.playing()) return;
    for (const t of e.changedTouches) {
      if (t.target !== o.canvas) continue;
      e.preventDefault();
      if (id === null && t.clientX < innerWidth * 0.6) {
        id = t.identifier; place(t.clientX, t.clientY);
        $stick.classList.add('on'); move(t.clientX, t.clientY);
      }
    }
  }, { passive: false });
  window.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) if (t.identifier === id) { e.preventDefault(); move(t.clientX, t.clientY); }
  }, { passive: false });
  const end = (e) => { for (const t of e.changedTouches) if (t.identifier === id) release(); };
  window.addEventListener('touchend', end);
  window.addEventListener('touchcancel', end);

  const down = () => { $jump.classList.add('down'); o.controller.touchJump = true; };
  const up = () => { $jump.classList.remove('down'); o.controller.touchJump = false; };
  $jump.addEventListener('touchstart', (e) => { e.preventDefault(); down(); }, { passive: false });
  $jump.addEventListener('touchend', (e) => { e.preventDefault(); up(); }, { passive: false });
  $jump.addEventListener('touchcancel', up);
  $jump.addEventListener('mousedown', (e) => { e.preventDefault(); down(); });
  $jump.addEventListener('mouseup', up);
  $jump.addEventListener('mouseleave', up);
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  window.addEventListener('contextmenu', (e) => { if (on) e.preventDefault(); });
}

// The card opened / the room froze: let go of the stick.
export function resetTouch() { release(); }
