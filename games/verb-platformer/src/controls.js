// Unified input. Game code reads:
//   input.move.x / input.move.y  in [-1, 1]   (WASD or joystick, screen-relative)
//   input.lookDelta.{x,y}                     (consumed each frame)
//   input.jumpPressed                         (one-shot per press; consume via consumeJump())
import nipplejs from 'nipplejs';

export function createControls(canvas) {
  const input = {
    move: { x: 0, y: 0 },
    lookDelta: { x: 0, y: 0 },
    jumpPressed: false,
    pointerLocked: false,
    isTouch: false,
  };

  // ---- Keyboard ----
  const keys = new Set();
  window.addEventListener('keydown', e => {
    if (e.repeat) return;
    keys.add(e.code);
    if (e.code === 'Space') input.jumpPressed = true;
  });
  window.addEventListener('keyup', e => keys.delete(e.code));

  function readKeyboard() {
    let x = 0, y = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
    return { x, y };
  }

  // ---- Touch detection ----
  // Any device whose main pointer is a finger gets the on-screen controls — phones too.
  // The keyboard stays live in every case (touch-screen laptops, tablets with keyboards).
  const isTouchDevice = window.matchMedia('(pointer: coarse)').matches
    || (('ontouchstart' in window) && !window.matchMedia('(pointer: fine)').matches);
  input.isTouch = isTouchDevice;

  // ---- Mouse + pointer lock ----
  canvas.addEventListener('click', () => {
    if (!input.pointerLocked && !input.isTouch) canvas.requestPointerLock();
  });
  document.addEventListener('pointerlockchange', () => {
    input.pointerLocked = document.pointerLockElement === canvas;
  });
  window.addEventListener('mousemove', e => {
    if (!input.pointerLocked) return;
    input.lookDelta.x += e.movementX;
    input.lookDelta.y += e.movementY;
  });

  // ---- Touch: joystick (left), jump button (right), drag on the scene = look around ----
  let touchAxes = { x: 0, y: 0 };

  if (isTouchDevice) {
    const stickEl = document.getElementById('touch-joystick');
    const jumpEl = document.getElementById('touch-jump');
    stickEl.hidden = false;
    jumpEl.hidden = false;
    const hint = document.getElementById('hint');
    if (hint) hint.hidden = true;

    const stick = nipplejs.create({
      zone: stickEl,
      mode: 'static',
      position: { left: '50%', bottom: '50%' },
      color: 'white',
      size: 120,
    });
    stick.on('move', (evt) => {
      // nipplejs 1.x passes one event object ({ type, data }).
      // Angle: 0=right, 90=up, etc. We want screen-space x/y with y inverted.
      const data = evt.data;
      if (!data?.angle) return;
      const r = Math.min(data.distance / 60, 1);
      touchAxes.x = Math.cos(data.angle.radian) * r;
      touchAxes.y = -Math.sin(data.angle.radian) * r;
    });
    stick.on('end', () => { touchAxes.x = 0; touchAxes.y = 0; });

    jumpEl.addEventListener('touchstart', e => {
      e.preventDefault();
      input.jumpPressed = true;
    }, { passive: false });

    // One finger dragging on the canvas turns the camera (the joystick and the jump
    // button sit above the canvas, so their touches never arrive here).
    const LOOK_GAIN = 1.6;
    let lookId = null, lastX = 0, lastY = 0;
    canvas.addEventListener('touchstart', e => {
      if (lookId !== null) return;
      const t = e.changedTouches[0];
      lookId = t.identifier; lastX = t.clientX; lastY = t.clientY;
    }, { passive: true });
    canvas.addEventListener('touchmove', e => {
      for (const t of e.changedTouches) {
        if (t.identifier !== lookId) continue;
        input.lookDelta.x += (t.clientX - lastX) * LOOK_GAIN;
        input.lookDelta.y += (t.clientY - lastY) * LOOK_GAIN;
        lastX = t.clientX; lastY = t.clientY;
      }
      e.preventDefault();
    }, { passive: false });
    const endLook = e => {
      for (const t of e.changedTouches) if (t.identifier === lookId) lookId = null;
    };
    canvas.addEventListener('touchend', endLook);
    canvas.addEventListener('touchcancel', endLook);
  }

  // ---- Per-frame update ---- keyboard and joystick add up, clamped to [-1, 1].
  // input.virtual: a third stick, driven by the automated play-test bot (tools/bot-test.cjs).
  input.virtual = { x: 0, y: 0 };
  input.update = () => {
    const k = readKeyboard();
    input.move.x = Math.max(-1, Math.min(1, k.x + touchAxes.x + input.virtual.x));
    input.move.y = Math.max(-1, Math.min(1, k.y + touchAxes.y + input.virtual.y));
  };

  input.consumeJump = () => {
    const j = input.jumpPressed;
    input.jumpPressed = false;
    return j;
  };

  input.consumeLook = () => {
    const d = { x: input.lookDelta.x, y: input.lookDelta.y };
    input.lookDelta.x = 0;
    input.lookDelta.y = 0;
    return d;
  };

  return input;
}
