// Two players on one device. Keyboard: player 1 = WASD + E, player 2 = arrows + Enter;
// answer cards also take 1 2 3 (player 1) and 8 9 0 (player 2), see cards.js.
// Touch: two button zones at the bottom (left = player 1, right = player 2), multi-touch.
// Each player's pad: { left, right, up, down, action } held flags + edge events.
export const KEYS = [
  { left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'], action: ['KeyE'] },
  { left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'], action: ['Enter', 'NumpadEnter'] },
];
export const KEY_LABEL = ['E', 'Enter'];
const BUTTONS = ['left', 'right', 'up', 'down', 'action'];

function makePad() {
  const held = { left: 0, right: 0, up: 0, down: 0, action: 0 };
  return {
    held,
    pressed: new Set(),         // buttons that went down since the last frame
    isDown: (b) => held[b] > 0,
  };
}

export function createInput() {
  const pads = [makePad(), makePad()];
  const listeners = new Set();     // (playerIdx, button) on every press (cards use this)
  const keyOwner = new Map();
  KEYS.forEach((k, pi) => BUTTONS.forEach((b) => k[b].forEach((code) => keyOwner.set(code, [pi, b]))));
  const down = new Set();

  function press(pi, b) {
    const pad = pads[pi];
    pad.held[b]++;
    pad.pressed.add(b);
    listeners.forEach((fn) => fn(pi, b));
  }
  function release(pi, b) {
    const pad = pads[pi];
    pad.held[b] = Math.max(0, pad.held[b] - 1);
  }

  window.addEventListener('keydown', (e) => {
    const own = keyOwner.get(e.code);
    if (!own) return;
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (document.body.dataset.state !== 'playing') return;   // menus keep Enter / arrows
    e.preventDefault();
    if (e.repeat || down.has(e.code)) return;
    down.add(e.code);
    press(own[0], own[1]);
  });
  window.addEventListener('keyup', (e) => {
    const own = keyOwner.get(e.code);
    if (!own || !down.has(e.code)) return;
    down.delete(e.code);
    release(own[0], own[1]);
  });
  window.addEventListener('blur', () => {
    down.clear();
    pads.forEach((p) => BUTTONS.forEach((b) => { p.held[b] = 0; }));
  });

  // touch buttons: <button data-pad="0" data-btn="left">
  function bindTouch(root) {
    root.querySelectorAll('[data-pad][data-btn]').forEach((el) => {
      const pi = +el.dataset.pad, b = el.dataset.btn;
      const active = new Set();
      const on = (e) => {
        e.preventDefault();
        if (active.has(e.pointerId)) return;
        active.add(e.pointerId);
        try { el.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
        el.classList.add('down');
        press(pi, b);
      };
      const off = (e) => {
        if (!active.has(e.pointerId)) return;
        active.delete(e.pointerId);
        if (!active.size) el.classList.remove('down');
        release(pi, b);
      };
      el.addEventListener('pointerdown', on);
      el.addEventListener('pointerup', off);
      el.addEventListener('pointercancel', off);
      el.addEventListener('lostpointercapture', off);
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    });
  }

  return {
    pads,
    bindTouch,
    onPress(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    /** Movement for physics; clears the edge events. */
    read(pi) {
      const p = pads[pi];
      const r = {
        x: (p.isDown('right') ? 1 : 0) - (p.isDown('left') ? 1 : 0),
        up: p.isDown('up'), down: p.isDown('down'),
        jumpPressed: p.pressed.has('up'),
        actionPressed: p.pressed.has('action'),
        anyMovePressed: p.pressed.has('left') || p.pressed.has('right') || p.pressed.has('up'),
      };
      p.pressed.clear();
      return r;
    },
    clear() { pads.forEach((p) => p.pressed.clear()); },
    // tests: press / release a pad button directly
    _press: press, _release: release,
  };
}

export function isTouchDevice() {
  const q = new URLSearchParams(location.search).get('touch');
  if (q === '1') return true;
  if (q === '0') return false;
  return window.matchMedia?.('(pointer: coarse)').matches || false;
}
