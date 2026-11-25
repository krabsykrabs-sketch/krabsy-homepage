/* ──────────────────────────────────────────────────────────────────────────
   Krabsy landing pages — the live 3D figure next to the featured game
   (owner 2026-11-25: "an actual 3D character that moves or jumps or spins",
   not a static picture in a tile).

   krabsy-landing.js shows the picture and the label first and imports this
   file only after `load` + idle, with the spot in view, and never with
   "save data", reduced motion, a 2g connection, a very small device or
   without a graphics chip. This file then loads three.js, one character and
   the animations (krabsy-figure-live.js) and fades the canvas in over the
   picture. If anything fails, the picture stays.

   The figure: idle loop; every few seconds a wave, a jump, a spin or a
   jump with a spin; a wave when the mouse comes over it (or the link gets
   the keyboard focus), a jump on press; it turns a little towards the mouse.
   A new visitor (no figure of their own) sees three of the free characters
   in turn, with a spin between them.

   The animation file is the small one (Idle_A + Jump_Full_Short, 0.06 MB);
   wave, spin and the hop are made in code (krabsy-figure-live.js).
   ────────────────────────────────────────────────────────────────────────── */
import { createLiveFigure } from '/lib/krabsy-figure-live.js?v=2026-11-25';

// Free characters a new visitor sees (the first is the picture in the page).
const TEASERS = ['Witch', 'Robot_One', 'Protagonist_A'];   // Witch first: a small file (0.3 MB)

/**
 * root    #gl-figure      link  the <a> around figure + label
 * stage   .lf-stage       canvas  the <canvas> in it
 * char    the saved character id, or null for a visitor without a figure
 */
export async function startLandingFigure({ root, link, stage, canvas, char }) {
  const t0 = performance.now();
  const conn = navigator.connection || {};
  const slowNet = conn.effectiveType === '3g' || (conn.downlink > 0 && conn.downlink < 1.5);
  canvas.hidden = false;                       // it needs a size; it is transparent until .is-live

  let live;
  try {
    live = await createLiveFigure({
      canvas, box: canvas,
      configFrom: (F) => F.playerConfig()
        || F.normalize({ char: char && F.FREE_CHARS.includes(char) ? char : TEASERS[0] }),
      fps: 30, maxRatio: 2, maxSize: 520, shadow: true,
      lights: { sky: '#ffffff', ground: '#c9b8a0', hemi: 1.9, sun: 1.5 },
      // The canvas is larger than the figure: room above for a jump, at the sides for a wave.
      place(camera, aspect) {
        const dist = 6.25 * Math.max(1, 0.85 / aspect);
        camera.position.set(0, 1.9, dist);
        camera.lookAt(0, 1.5, 0);
      },
    });
  } catch (err) {
    canvas.hidden = true;
    throw err;
  }

  // ---- first frame is drawn: swap the picture for the canvas
  root.classList.add('is-live');
  try {
    performance.measure('krabsy-figure-3d', { start: t0, end: performance.now() });
    performance.mark('krabsy-figure-3d-shown');
  } catch (_) { /* old browser */ }

  // ---- stop on a device that can't keep up (under ~12 frames a second): back to the picture
  let n = 0, sum = 0, alive = true;
  function giveUp() {
    alive = false;
    root.classList.remove('is-live');
    canvas.hidden = true;
    live.dispose();
  }

  // ---- moves (api.auto = false stops the figure doing them on its own)
  const api = { live: null, moves: null, nextTeaser: null, auto: true };
  const hasJump = () => !!live.clips.Jump_Full_Short;
  const hopHeight = () => (stage.clientHeight < 150 ? 0.32 : 0.55);   // phones: the game tile is right above
  const moves = {
    wave: () => live.wave(1.7),
    jump: () => { if (hasJump()) live.play('Jump_Full_Short'); live.hop(hopHeight(), 0.62, hasJump() ? 0.22 : 0); },
    spin: () => live.spin(0.95),
    cheer: () => { moves.jump(); live.spin(0.75); },
  };
  const order = ['wave', 'jump', 'spin', 'cheer'];
  let lastMove = '', wait = 2.2, sinceSwap = 0, swapping = false, teaser = 0;
  function playful() {
    const pool = order.filter((m) => m !== lastMove);
    lastMove = pool[Math.floor(Math.random() * pool.length)];
    moves[lastMove]();
    sinceSwap++;
  }
  // A visitor without a figure: the next free character comes in with a spin.
  const cycle = !char && !slowNet;
  async function nextTeaser() {
    swapping = true;
    teaser = (teaser + 1) % TEASERS.length;
    try {
      await live.setFigure({ char: TEASERS[teaser] }, {
        at: (mount) => {
          const go = () => { if (!alive) return; if (live.busy) { setTimeout(go, 200); return; } live.spin(0.8, { half: mount, squash: 0.3 }); };
          go();
        },
      });
    } catch (_) { /* that character stays away; keep the current one */ }
    swapping = false;
  }

  // ---- a gentle turn towards the mouse
  const mid = () => { const r = stage.getBoundingClientRect(); return r.left + r.width / 2; };
  const home = mid() > innerWidth / 2 ? -0.28 : 0.28;      // look towards the middle of the page
  let target = home, mouseX = null;
  live.yaw = home;
  const onMove = (e) => { if (e.pointerType === 'mouse') mouseX = e.clientX; };
  addEventListener('pointermove', onMove, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { target = home; mouseX = null; });

  live.onTick((dt) => {
    if (!alive || !dt) return;
    if (n < 60) {
      n++; if (n > 15) sum += dt;                           // skip the first frames (shader compile)
      if (n === 60 && sum / 45 > 0.085) { giveUp(); return; }
    }
    if (mouseX != null) { target = Math.max(-0.6, Math.min(0.6, (mouseX - mid()) / 520)); mouseX = null; }
    if (spinning) {                                         // a drag or a flick turns the figure
      if (!drag) {
        live.yaw += vel * dt;
        vel *= Math.pow(0.06, dt);                          // slows down over about a second
        if (Math.abs(vel) < 0.4) {                          // done: come back the short way
          spinning = false;
          const d = live.yaw - target;
          live.yaw = target + Math.atan2(Math.sin(d), Math.cos(d));
        }
      }
      wait = Math.max(wait, 2.5);
      return;
    }
    live.yaw += (target - live.yaw) * Math.min(1, dt * 4);
    if (live.busy || swapping || !api.auto) return;
    wait -= dt;
    if (wait > 0) return;
    wait = 4 + Math.random() * 3;
    if (cycle && sinceSwap >= 2) { sinceSwap = 0; nextTeaser(); } else playful();
  });

  Object.assign(api, { live, moves, nextTeaser });

  // ---- reactions
  const mouse = (e) => e.pointerType === 'mouse';
  link.addEventListener('pointerenter', (e) => { if (alive && mouse(e) && !live.busy) { moves.wave(); wait = Math.max(wait, 3); } });
  // ---- drag to spin (owner 2026-11-25: "be able to interact with the character, e.g. spinning
  // them"). A drag turns the figure, a flick keeps it turning for a moment; a tap without a
  // drag still follows the link. touch-action: pan-y keeps vertical page scrolling on phones.
  let drag = null, vel = 0, spinning = false, dragged = false;
  // The canvas lets clicks through (it overlaps the featured tile), so the stage takes the drag.
  stage.addEventListener('pointerdown', (e) => {
    if (!alive) return;
    drag = { x: e.clientX, t: performance.now(), id: e.pointerId }; dragged = false; vel = 0;
  });
  addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    if (!dragged && Math.abs(dx) < 6) return;
    if (!dragged) { dragged = true; spinning = true; try { stage.setPointerCapture(e.pointerId); } catch (_) {} }
    const now = performance.now();
    const d = dx * 0.016;
    live.yaw += d;
    vel = d / Math.max(0.012, (now - drag.t) / 1000);
    drag.x = e.clientX; drag.t = now;
    live.kick();
  }, { passive: true });
  const endDrag = (e) => {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    if (performance.now() - drag.t > 120) vel = 0;          // held still before letting go: no flick
    vel = Math.max(-25, Math.min(25, vel));
    drag = null;
  };
  addEventListener('pointerup', endDrag); addEventListener('pointercancel', endDrag);
  // a tap on the figure (no drag) makes it jump; the profile opens only from the button below
  stage.addEventListener('click', () => { if (!dragged && alive && !live.busy) { moves.jump(); wait = Math.max(wait, 3); } dragged = false; });
  stage.addEventListener('pointerenter', (e) => { if (alive && mouse(e) && !live.busy && !drag) { moves.wave(); wait = Math.max(wait, 3); } });
  link.addEventListener('focus', () => { if (alive && !live.busy && link.matches(':focus-visible')) moves.wave(); });

  return api;
}
