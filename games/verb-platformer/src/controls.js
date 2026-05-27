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

  // ---- Touch (tablet+) ----
  const isTouchDevice = 'ontouchstart' in window && window.innerWidth >= 768;
  let touchAxes = { x: 0, y: 0 };

  if (isTouchDevice) {
    input.isTouch = true;
    const stickEl = document.getElementById('touch-joystick');
    const jumpEl = document.getElementById('touch-jump');
    stickEl.hidden = false;
    jumpEl.hidden = false;
    document.getElementById('hint').hidden = true;

    const stick = nipplejs.create({
      zone: stickEl,
      mode: 'static',
      position: { left: '50%', bottom: '50%' },
      color: 'white',
      size: 120,
    });
    stick.on('move', (_, data) => {
      // nipplejs angle: 0=right, 90=up, etc. We want screen-space x/y with y inverted.
      const r = Math.min(data.distance / 60, 1);
      touchAxes.x = Math.cos(data.angle.radian) * r;
      touchAxes.y = -Math.sin(data.angle.radian) * r;
    });
    stick.on('end', () => { touchAxes.x = 0; touchAxes.y = 0; });

    jumpEl.addEventListener('touchstart', e => {
      e.preventDefault();
      input.jumpPressed = true;
    }, { passive: false });
  }

  // ---- Per-frame update ----
  input.update = () => {
    if (input.isTouch) {
      input.move.x = touchAxes.x;
      input.move.y = touchAxes.y;
    } else {
      const k = readKeyboard();
      input.move.x = k.x;
      input.move.y = k.y;
    }
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
