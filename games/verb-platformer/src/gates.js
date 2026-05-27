import * as THREE from 'three';
import { loadModel, loadAudio, playSfx } from './assets.js';
import { addStaticBox } from './physics.js';

// All answer platforms use the KayKit 2x2x1 platform in red — the canonical "fall on contact"
// visual under the new mechanic. Anchor is at the mesh bottom (KayKit convention), so the
// renderer offsets the mesh down by `height` to put the walkable top at y.
const FALLING_DEF = {
  url: './assets/kaykit-platformer/red/platform_2x2x1_red.gltf',
  half: { x: 1.0, y: 0.5, z: 1.0 },
  height: 1.0,
};

// 3 lanes side-by-side at x = -3.5, 0, +3.5. Pulled in from the original ±5 so the diagonal jump
// to the outer two answer blocks isn't so tricky, while still leaving a clear gap (1.5 m between
// the 2 m-wide blocks) so each signpost reads as belonging to one platform.
export const LANE_OFFSETS = [
  [-3.5, 0, 0],
  [ 0,   0, 0],
  [ 3.5, 0, 0],
];

const BUBBLE_H = 0.6;             // world-space height; width is measured per-word
const BUBBLE_MIN_W = 1.0;
const BUBBLE_Y = 1.2;             // hover height above the platform top
const BUBBLE_TINT = 'rgba(110, 180, 255, 0.85)';   // translucent sky-blue — test-level Style 3 colour
const BUBBLE_TEXT = '#ffffff';
const BUBBLE_FONT_PX = 280;
const BUBBLE_PAD_PX = 110;        // canvas-space horizontal padding inside the bubble

// Translucent rounded "bubble" hovering above a platform, displaying one answer word.
// Canvas width and plane width are both sized to the rendered text + padding so short words
// produce small bubbles and long words ("thought", "wented") still fit without truncation.
// Plane faces +Z so the player approaching from +Z reads it head-on (corridor levels).
function makeAnswerBubble(text) {
  const group = new THREE.Group();
  const H = 512;
  const font = `bold ${BUBBLE_FONT_PX}px Arial, sans-serif`;

  const measure = document.createElement('canvas').getContext('2d');
  measure.font = font;
  const textW = measure.measureText(text).width;
  const W = Math.max(700, Math.ceil(textW + 2 * BUBBLE_PAD_PX));

  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  const r = 80;
  ctx.fillStyle = BUBBLE_TINT;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.arcTo(W, 0, W, H, r);
  ctx.arcTo(W, H, 0, H, r);
  ctx.arcTo(0, H, 0, 0, r);
  ctx.arcTo(0, 0, W, 0, r);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = BUBBLE_TEXT;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, W / 2, H / 2);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;

  // Keep height fixed in world space; scale width to match canvas aspect.
  const planeW = Math.max(BUBBLE_MIN_W, BUBBLE_H * (W / H));
  const geo = new THREE.PlaneGeometry(planeW, BUBBLE_H);
  const mat = new THREE.MeshBasicMaterial({
    map: tex, transparent: true, depthWrite: false, fog: false,
    side: THREE.DoubleSide, opacity: 0.95,
  });
  const sign = new THREE.Mesh(geo, mat);
  sign.position.y = BUBBLE_Y;
  group.add(sign);

  return { group, sign, mats: [mat] };
}

async function spawnOption(scene, world, RAPIER, gatePos, optData, { noSignposts = false } = {}) {
  const def = FALLING_DEF;
  const pos = {
    x: gatePos[0] + optData.offset[0],
    y: gatePos[1] + optData.offset[1],
    z: gatePos[2] + optData.offset[2],
  };

  const mesh = await loadModel(def.url);
  // Convention: pos.y = mesh-bottom anchor. Mesh sits AT pos.y; walkable top = pos.y + height.
  mesh.position.set(pos.x, pos.y, pos.z);
  scene.add(mesh);

  const colliderCenter = { x: pos.x, y: pos.y + def.half.y, z: pos.z };
  const phys = addStaticBox(world, RAPIER, colliderCenter, def.half);

  let post = null;
  if (!noSignposts) {
    post = makeAnswerBubble(optData.text);
    // The answer-bubble sign sits a little above the walkable top.
    post.group.position.set(pos.x, pos.y + def.height, pos.z);
    scene.add(post.group);
  }

  return {
    pos, half: def.half, top: pos.y + def.height,
    colliderCenter,                     // cached so reset() can rebuild the collider after a fall
    mesh, body: phys.body, collider: phys.collider,
    post,
    correct: optData.correct, text: optData.text,
    state: 'idle',
    timer: 0,
    fallVel: 0,
    // Extra meshes that should follow the platform when it shakes/falls.
    // Each entry: { mesh, mats?: Material[] } — mats listed here will fade with the platform.
    extras: [],
  };
}

export async function spawnGate(scene, world, RAPIER, particles, sfx, gateData, callbacks = {}, options = {}) {
  const opts = await Promise.all(
    gateData.options.map(opt => spawnOption(scene, world, RAPIER, gateData.position, opt, options))
  );
  return new AnswerGate(scene, world, RAPIER, particles, sfx, opts, gateData.question, callbacks);
}

const SHAKE_DURATION = 0.2;
const FALL_DURATION  = 1.5;
const SHAKE_AMPLITUDE = 0.06;
const FALL_GRAVITY    = 22;

export class AnswerGate {
  constructor(scene, world, RAPIER, particles, sfx, options, question, callbacks) {
    this.scene = scene;
    this.world = world;
    this.RAPIER = RAPIER;
    this.particles = particles;
    this.sfx = sfx;
    this.options = options;
    this.question = question;       // { verb, correct }
    this.callbacks = callbacks;
    this.cleared = false;
  }

  update(dt, playerPos, playerGrounded) {
    for (const opt of this.options) {
      if (opt.state === 'shaking') {
        opt.timer -= dt;
        const jx = (Math.random() - 0.5) * SHAKE_AMPLITUDE;
        const jz = (Math.random() - 0.5) * SHAKE_AMPLITUDE;
        opt.mesh.position.x = opt.pos.x + jx;
        opt.mesh.position.z = opt.pos.z + jz;
        if (opt.post) {
          opt.post.group.position.x = opt.pos.x + jx;
          opt.post.group.position.z = opt.pos.z + jz;
        }
        for (const ex of opt.extras) {
          ex.mesh.position.x = ex.basePos.x + jx;
          ex.mesh.position.z = ex.basePos.z + jz;
        }
        if (opt.timer <= 0) this._dropCollider(opt);
      } else if (opt.state === 'falling') {
        opt.fallVel += FALL_GRAVITY * dt;
        const dy = opt.fallVel * dt;
        opt.mesh.position.y -= dy;
        if (opt.post) opt.post.group.position.y -= dy;
        for (const ex of opt.extras) ex.mesh.position.y -= dy;
        const fade = Math.max(0, opt.timer / FALL_DURATION);
        if (opt.post) {
          for (const m of opt.post.mats) m.opacity = fade * 0.95;
        }
        for (const ex of opt.extras) {
          for (const m of (ex.mats || [])) { m.transparent = true; m.opacity = fade; }
        }
        opt.timer -= dt;
        if (opt.timer <= 0) {
          this.scene.remove(opt.mesh);
          if (opt.post) this.scene.remove(opt.post.group);
          for (const ex of opt.extras) this.scene.remove(ex.mesh);
          opt.state = 'gone';
        }
      }
    }

    if (!playerGrounded || this.cleared) return;
    for (const opt of this.options) {
      if (opt.state !== 'idle') continue;
      if (!this._playerOnOption(playerPos, opt)) continue;
      if (opt.correct) {
        opt.state = 'cleared';
        this.cleared = true;
        if (this.sfx?.correct) playSfx(this.sfx.correct);
        this.callbacks.onCleared?.(this);
      } else {
        this._startCrumble(opt);
        this.callbacks.onWrong?.(this, opt);
      }
    }
  }

  _playerOnOption(p, opt) {
    if (Math.abs(p.x - opt.pos.x) > opt.half.x) return false;
    if (Math.abs(p.z - opt.pos.z) > opt.half.z) return false;
    if (Math.abs(p.y - opt.top) > 0.3) return false;
    return true;
  }

  _startCrumble(opt) {
    opt.state = 'shaking';
    opt.timer = SHAKE_DURATION;
  }

  _dropCollider(opt) {
    this.world.removeRigidBody(opt.body);
    opt.body = null;
    opt.collider = null;
    opt.state = 'falling';
    opt.timer = FALL_DURATION;
    opt.fallVel = 0;
    this.particles.spawnPuff({ x: opt.pos.x, y: opt.top, z: opt.pos.z });
    if (this.sfx?.break) playSfx(this.sfx.break);
  }

  // Restore the gate to its untouched state: rebuild any collider that was dropped, re-add and
  // re-position every block/sign/extra, reset opacity, and clear the answered flag. Called on
  // respawn so the player can attempt the same question again on a freshly-reset gate.
  reset() {
    for (const opt of this.options) {
      // A crumbled/fallen block had its rigid body removed — rebuild it from the cached center.
      if (!opt.body) {
        const phys = addStaticBox(this.world, this.RAPIER, opt.colliderCenter, opt.half);
        opt.body = phys.body;
        opt.collider = phys.collider;
      }
      if (!opt.mesh.parent) this.scene.add(opt.mesh);
      opt.mesh.position.set(opt.pos.x, opt.pos.y, opt.pos.z);
      if (opt.post) {
        if (!opt.post.group.parent) this.scene.add(opt.post.group);
        opt.post.group.position.set(opt.pos.x, opt.top, opt.pos.z);
        for (const m of opt.post.mats) m.opacity = 0.95;
      }
      for (const ex of opt.extras) {
        if (!ex.mesh.parent) this.scene.add(ex.mesh);
        ex.mesh.position.set(ex.basePos.x, ex.basePos.y, ex.basePos.z);
        (ex.mats || []).forEach((m, i) => { m.opacity = ex.baseOpacity?.[i] ?? 1; });
      }
      opt.state = 'idle';
      opt.timer = 0;
      opt.fallVel = 0;
    }
    this.cleared = false;
  }

  dispose() {
    for (const opt of this.options) {
      if (opt.mesh.parent) this.scene.remove(opt.mesh);
      if (opt.post && opt.post.group.parent) this.scene.remove(opt.post.group);
      for (const ex of opt.extras) if (ex.mesh.parent) this.scene.remove(ex.mesh);
      if (opt.body) this.world.removeRigidBody(opt.body);
    }
    this.options = [];
  }
}
