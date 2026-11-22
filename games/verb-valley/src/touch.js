// Touch controls for tablets and phones: a virtual stick (bottom left) and
// one big action button (bottom right, same as E). They switch on when the
// device's main pointer is coarse or on the first touch, and stay hidden on a
// laptop with a mouse. The stick writes input.joy = {x, y} (−1..1, y down
// = towards the camera), which player.update() already reads.
// The hotbar, inventory and question chips are plain buttons, so they are
// tappable without anything extra here.

const RADIUS = 52;   // px the knob may travel from the base centre

export function createTouch(input, { onAction }) {
  const root = document.createElement('div');
  root.id = 'touch';
  root.innerHTML = `
    <div id="stick-zone"><div id="stick-base"><div id="stick-knob"></div></div></div>
    <button id="btn-action" aria-label="Action">✋</button>`;
  document.getElementById('hud').appendChild(root);
  const zone = root.querySelector('#stick-zone');
  const base = root.querySelector('#stick-base');
  const knob = root.querySelector('#stick-knob');
  const btn = root.querySelector('#btn-action');

  let on = false;
  function enable() {
    if (on) return;
    on = true;
    document.body.classList.add('touch');
  }
  if (matchMedia('(pointer: coarse)').matches) enable();
  addEventListener('touchstart', enable, { passive: true, capture: true });

  // ── Stick: the base appears where the thumb lands (inside the zone) ──
  let id = null, cx = 0, cy = 0;
  function setKnob(dx, dy) {
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
  }
  zone.addEventListener('pointerdown', (e) => {
    if (id !== null) return;
    id = e.pointerId;
    zone.setPointerCapture(id);
    const r = zone.getBoundingClientRect();
    cx = e.clientX; cy = e.clientY;
    base.style.left = `${cx - r.left}px`;
    base.style.top = `${cy - r.top}px`;
    base.classList.add('live');
    input.joy = { x: 0, y: 0 };
    e.preventDefault();
    e.stopPropagation();
  });
  zone.addEventListener('pointermove', (e) => {
    if (e.pointerId !== id) return;
    let dx = e.clientX - cx, dy = e.clientY - cy;
    const len = Math.hypot(dx, dy);
    if (len > RADIUS) { dx *= RADIUS / len; dy *= RADIUS / len; }
    setKnob(dx, dy);
    // small dead zone so a resting thumb doesn't drift
    const m = Math.min(1, len / RADIUS);
    input.joy = m < 0.18 ? { x: 0, y: 0 } : { x: (dx / RADIUS), y: (dy / RADIUS) };
  });
  const release = (e) => {
    if (e.pointerId !== id) return;
    id = null;
    input.joy = null;
    setKnob(0, 0);
    base.classList.remove('live');
  };
  zone.addEventListener('pointerup', release);
  zone.addEventListener('pointercancel', release);

  // ── Action button ──
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation();
    btn.classList.add('down');
    onAction();
  });
  const up = () => btn.classList.remove('down');
  btn.addEventListener('pointerup', up);
  btn.addEventListener('pointercancel', up);
  btn.addEventListener('pointerleave', up);

  return {
    get on() { return on; },
    setVisible(v) { root.hidden = !v; if (!v && id !== null) release({ pointerId: id }); },
    // The button glows when there is something to do right here.
    setReady(ready) { btn.classList.toggle('ready', !!ready); },
  };
}
