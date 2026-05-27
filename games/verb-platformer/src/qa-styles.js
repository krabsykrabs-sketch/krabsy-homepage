// Per-style Q/A presentation spawners for the Q/A test level.
// Each spawnStyleN(...) returns { gate, extras } where:
//   - `gate` is an AnswerGate (or WideAnswerGate) — managed by the level loader for update/dispose
//   - `extras` are scene objects added outside the gate (banners, walls, floor labels, archways)
//     that the level loader must remove on dispose.
//
// All styles reuse the underlying "step on the falling platform" mechanic — only the visible
// presentation of the question and the three answer choices changes.

import * as THREE from 'three';
import { spawnGate, LANE_OFFSETS } from './gates.js';
import { addStaticBox } from './physics.js';
import { loadModel } from './assets.js';
import { formatPrompt } from './data/questions.js';

// -------------------- shared canvas/material helpers --------------------

function drawCard(ctx, W, H, { bg = '#ffffff', border = '#1a2435', borderW = 18, fg = '#1a2435', font = 'bold 220px Arial, sans-serif', text }) {
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  if (borderW > 0) {
    ctx.strokeStyle = border;
    ctx.lineWidth = borderW;
    ctx.strokeRect(borderW / 2, borderW / 2, W - borderW, H - borderW);
  }
  ctx.fillStyle = fg;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, W / 2, H / 2);
}

function canvasTexture(c) {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

// Vertical card facing +Z (player approaches from +Z). Used for billboards/signs.
function makeTextPlane(text, { w, h, font = 'bold 220px Arial, sans-serif', bg = '#ffffff', fg = '#1a2435', borderW = 18, alpha = 1 }) {
  const W = 1024, H = 512;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  drawCard(ctx, W, H, { bg, fg, font, borderW, text });

  const tex = canvasTexture(c);
  const geo = new THREE.PlaneGeometry(w, h);
  const mat = new THREE.MeshBasicMaterial({
    map: tex, transparent: true, depthWrite: false, fog: false,
    side: THREE.DoubleSide, opacity: alpha,
  });
  return new THREE.Mesh(geo, mat);
}

// Horizontal floor decal that lies flat on the ground but reads upright from +Z (player).
// Rotation +π/2 about X tips the plane to be horizontal with image-top pointing toward +Z;
// DoubleSide makes it visible from above even though the normal points -Y after that rotation.
function makeFloorDecal(text, { w, h, font = 'bold 240px Arial, sans-serif', bg = '#ffffff', fg = '#1a2435', borderW = 18 }) {
  const mesh = makeTextPlane(text, { w, h, font, bg, fg, borderW });
  mesh.rotation.x = Math.PI / 2;
  return mesh;
}

// -------------------- shared base: 3 falling platforms + decoration --------------------

// Builds a "default" 3-lane gate without signposts. Returns the gate plus a helper that
// each style uses to attach decoration meshes to specific options (so they shake & fall with them).
async function spawnSignlessGate(scene, world, RAPIER, particles, sfx, gateData, callbacks) {
  return spawnGate(scene, world, RAPIER, particles, sfx, gateData, callbacks, { noSignposts: true });
}

// Attach an extra mesh to an option so it shakes & falls with the platform.
// Stores the base XZ position so the shake math reads cleanly.
function attachExtra(opt, mesh, mats) {
  const matList = mats || (mesh.material ? [mesh.material] : []);
  opt.extras.push({
    mesh,
    basePos: { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z },
    mats: matList,
    baseOpacity: matList.map(m => m.opacity),   // restored by AnswerGate.reset() on respawn
  });
}

// =================================================================
// STYLE 1 — Floor decals on every platform, no signs anywhere.
// =================================================================
export async function spawnStyle1(scene, world, RAPIER, particles, sfx, gateData, callbacks, ctx) {
  const gate = await spawnSignlessGate(scene, world, RAPIER, particles, sfx, gateData, callbacks);
  const extras = [];

  for (const opt of gate.options) {
    const decal = makeFloorDecal(opt.text, { w: 1.9, h: 0.95 });
    decal.position.set(opt.pos.x, opt.top + 0.03, opt.pos.z);
    decal.renderOrder = 1;
    scene.add(decal);
    attachExtra(opt, decal);
  }

  // Question painted on the approach platform floor.
  if (ctx.approachPos) {
    const qDecal = makeFloorDecal(formatPrompt(gateData.question.verb), { w: 2.2, h: 1.1, font: 'bold 200px Arial, sans-serif' });
    qDecal.position.set(ctx.approachPos.x, ctx.approachPos.y + 0.03, ctx.approachPos.z);
    qDecal.renderOrder = 1;
    scene.add(qDecal);
    extras.push(qDecal);
  }
  return { gate, extras };
}

// =================================================================
// STYLE 2 — Front-facing labels on the player-facing vertical side of each platform.
// Small question banner above the approach platform.
// =================================================================
export async function spawnStyle2(scene, world, RAPIER, particles, sfx, gateData, callbacks, ctx) {
  const gate = await spawnSignlessGate(scene, world, RAPIER, particles, sfx, gateData, callbacks);
  const extras = [];

  for (const opt of gate.options) {
    const label = makeTextPlane(opt.text, { w: 2.0, h: 0.5 });
    // Stuck to +Z face of the falling-platform. Platform top is at opt.top, body extends
    // from opt.top - 2*half.y up to opt.top, so the +Z face spans those y values.
    label.position.set(opt.pos.x, opt.top - opt.half.y, opt.pos.z + opt.half.z + 0.02);
    scene.add(label);
    attachExtra(opt, label);
  }

  if (ctx.approachPos) {
    const banner = makeTextPlane(formatPrompt(gateData.question.verb), { w: 3, h: 1.5 });
    banner.position.set(ctx.approachPos.x, ctx.approachPos.y + 3.5, ctx.approachPos.z);
    scene.add(banner);
    extras.push(banner);
  }
  return { gate, extras };
}

// =================================================================
// STYLE 3 — Translucent rounded bubbles hovering ~1 unit above each platform.
// =================================================================
function makeBubble(text) {
  // Light-blue translucent card with white text and rounded corners drawn on canvas.
  const W = 1024, H = 512;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, W, H);
  const r = 80;
  ctx.fillStyle = 'rgba(110, 180, 255, 0.85)';   // multiplied by material.opacity below
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.arcTo(W, 0, W, H, r);
  ctx.arcTo(W, H, 0, H, r);
  ctx.arcTo(0, H, 0, 0, r);
  ctx.arcTo(0, 0, W, 0, r);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 280px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, W / 2, H / 2);

  const tex = canvasTexture(c);
  const geo = new THREE.PlaneGeometry(1.4, 0.6);
  const mat = new THREE.MeshBasicMaterial({
    map: tex, transparent: true, depthWrite: false, fog: false,
    side: THREE.DoubleSide, opacity: 0.85,
  });
  return new THREE.Mesh(geo, mat);
}

export async function spawnStyle3(scene, world, RAPIER, particles, sfx, gateData, callbacks, ctx) {
  const gate = await spawnSignlessGate(scene, world, RAPIER, particles, sfx, gateData, callbacks);
  const extras = [];

  for (const opt of gate.options) {
    const bubble = makeBubble(opt.text);
    bubble.position.set(opt.pos.x, opt.top + 1.2, opt.pos.z);
    scene.add(bubble);
    attachExtra(opt, bubble);
  }
  if (ctx.approachPos) {
    const banner = makeTextPlane(formatPrompt(gateData.question.verb), { w: 3, h: 1.5 });
    banner.position.set(ctx.approachPos.x, ctx.approachPos.y + 3.5, ctx.approachPos.z);
    scene.add(banner);
    extras.push(banner);
  }
  return { gate, extras };
}

// =================================================================
// STYLE 4 — Archway gates: two vertical bars + horizontal top bar + sign on top bar.
// Larger arch over the approach platform carries the question.
// =================================================================
function makeArch(scene, centerX, baseY, z, { w, h, post = 0.15, color = 0x6e6e7a }) {
  const meshes = [];
  const postGeo = new THREE.BoxGeometry(post, h, post);
  const barGeo  = new THREE.BoxGeometry(w + post * 2, post, post);
  const mat = new THREE.MeshBasicMaterial({ color });

  const left = new THREE.Mesh(postGeo, mat);
  left.position.set(centerX - w / 2 - post / 2, baseY + h / 2, z);
  scene.add(left); meshes.push(left);

  const right = new THREE.Mesh(postGeo, mat);
  right.position.set(centerX + w / 2 + post / 2, baseY + h / 2, z);
  scene.add(right); meshes.push(right);

  const top = new THREE.Mesh(barGeo, mat);
  top.position.set(centerX, baseY + h + post / 2, z);
  scene.add(top); meshes.push(top);

  return { meshes, mat, topY: baseY + h + post };
}

export async function spawnStyle4(scene, world, RAPIER, particles, sfx, gateData, callbacks, ctx) {
  const gate = await spawnSignlessGate(scene, world, RAPIER, particles, sfx, gateData, callbacks);
  const extras = [];

  for (const opt of gate.options) {
    const arch = makeArch(scene, opt.pos.x, opt.top, opt.pos.z, { w: 2.2, h: 2.5 });
    const sign = makeTextPlane(opt.text, { w: 2.0, h: 0.6 });
    sign.position.set(opt.pos.x, arch.topY + 0.35, opt.pos.z);
    scene.add(sign);
    // Track all arch pieces + sign as extras of this option so they shake & fall with it.
    for (const m of arch.meshes) {
      attachExtra(opt, m, [arch.mat]);
    }
    attachExtra(opt, sign);
  }
  // Approach arch with the question.
  if (ctx.approachPos) {
    const ap = ctx.approachPos;
    const arch = makeArch(scene, ap.x, ap.y, ap.z, { w: 4.0, h: 3.2, post: 0.2 });
    const sign = makeTextPlane(formatPrompt(gateData.question.verb), { w: 3.6, h: 1.0 });
    sign.position.set(ap.x, arch.topY + 0.55, ap.z);
    scene.add(sign);
    extras.push(...arch.meshes, sign);
  }
  return { gate, extras };
}

// =================================================================
// STYLE 5 — Color-coded platforms + persistent HUD question + answer floor decals.
// The HUD question is shown by the level loader via ctx.uiHooks.setHudQuestion while this
// gate is the next un-cleared one.
// =================================================================
const STYLE5_TINTS = [0xff5050, 0x5078ff, 0xffcc40];   // red, blue, yellow

export async function spawnStyle5(scene, world, RAPIER, particles, sfx, gateData, callbacks, ctx) {
  const gate = await spawnSignlessGate(scene, world, RAPIER, particles, sfx, gateData, callbacks);
  const extras = [];

  gate.options.forEach((opt, i) => {
    // Floor decal with the answer word.
    const decal = makeFloorDecal(opt.text, { w: 1.9, h: 0.95 });
    decal.position.set(opt.pos.x, opt.top + 0.04, opt.pos.z);
    decal.renderOrder = 1;
    scene.add(decal);
    attachExtra(opt, decal);

    // Subtle color wash: a thin translucent colored plane laid flat just above platform top.
    const washMat = new THREE.MeshBasicMaterial({
      color: STYLE5_TINTS[i % STYLE5_TINTS.length],
      transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide,
    });
    const wash = new THREE.Mesh(new THREE.PlaneGeometry(opt.half.x * 2 - 0.05, opt.half.z * 2 - 0.05), washMat);
    wash.rotation.x = Math.PI / 2;
    wash.position.set(opt.pos.x, opt.top + 0.02, opt.pos.z);
    scene.add(wash);
    attachExtra(opt, wash, [washMat]);
  });

  // The HUD question itself is driven by the level update loop, not built into the scene.
  // Return a marker so the loader knows this gate wants the HUD active while it's un-cleared.
  return { gate, extras, hudQuestion: `Past tense of ${gateData.question.verb.toUpperCase()}?` };
}

// =================================================================
// STYLE 6 — One wide platform with three painted pads. Wrong pad → whole platform falls.
// =================================================================
// KayKit 6x6x1 platform in blue — the "wide" Style-6 single-answer platform with three pads.
const WIDE_DEF = {
  url: './assets/kaykit-platformer/blue/platform_6x6x1_blue.gltf',
  half: { x: 3.0, y: 0.5, z: 3.0 },
  height: 1.0,
};
const WIDE_PAD_X = [-1.6, 0, 1.6];
const WIDE_PAD_HALF_X = 0.7;
const WIDE_PAD_HALF_Z = 0.8;       // player must step into the pad's z-strip, not just land on it

class WideAnswerGate {
  constructor(scene, world, RAPIER, particles, sfx, plat, pads, question, callbacks) {
    this.scene = scene;
    this.world = world;
    this.RAPIER = RAPIER;
    this.particles = particles;
    this.sfx = sfx;
    this.plat = plat;       // { pos, half, top, mesh, body, decals[] }
    this.pads = pads;       // [{ correct, x, text, decalMesh }]
    this.question = question;
    this.callbacks = callbacks;
    this.cleared = false;
    this.state = 'idle';    // idle | shaking | falling | gone
    this.timer = 0;
    this.fallVel = 0;
  }

  update(dt, playerPos, playerGrounded) {
    if (this.state === 'shaking') {
      this.timer -= dt;
      const jx = (Math.random() - 0.5) * 0.06;
      const jz = (Math.random() - 0.5) * 0.06;
      this.plat.mesh.position.x = this.plat.pos.x + jx;
      this.plat.mesh.position.z = this.plat.pos.z + jz;
      for (const d of this.plat.decals) {
        d.mesh.position.x = d.basePos.x + jx;
        d.mesh.position.z = d.basePos.z + jz;
      }
      if (this.timer <= 0) this._drop();
      return;
    }
    if (this.state === 'falling') {
      this.fallVel += 22 * dt;
      const dy = this.fallVel * dt;
      this.plat.mesh.position.y -= dy;
      for (const d of this.plat.decals) d.mesh.position.y -= dy;
      const fade = Math.max(0, this.timer / 1.5);
      for (const d of this.plat.decals) { d.mat.transparent = true; d.mat.opacity = fade; }
      this.timer -= dt;
      if (this.timer <= 0) {
        this.scene.remove(this.plat.mesh);
        for (const d of this.plat.decals) this.scene.remove(d.mesh);
        this.state = 'gone';
      }
      return;
    }

    if (!playerGrounded || this.cleared) return;
    // Player on platform top?
    if (Math.abs(playerPos.x - this.plat.pos.x) > this.plat.half.x) return;
    if (Math.abs(playerPos.z - this.plat.pos.z) > this.plat.half.z) return;
    if (Math.abs(playerPos.y - this.plat.top) > 0.3) return;
    // Which pad? Require the player to be inside the pad's z-strip too (pads are centered
    // at gate.z); otherwise the player auto-triggers a pad the instant they land on the front
    // edge of the wide platform.
    if (Math.abs(playerPos.z - this.plat.pos.z) > WIDE_PAD_HALF_Z) return;
    const padIdx = this.pads.findIndex(p => Math.abs(playerPos.x - (this.plat.pos.x + p.x)) < WIDE_PAD_HALF_X);
    if (padIdx === -1) return;
    const pad = this.pads[padIdx];
    if (pad.correct) {
      this.cleared = true;
      this.callbacks.onCleared?.(this);
    } else {
      this._startCrumble();
      this.callbacks.onWrong?.(this, pad);
    }
  }

  _startCrumble() {
    this.state = 'shaking';
    this.timer = 0.2;
  }

  _drop() {
    this.world.removeRigidBody(this.plat.body);
    this.plat.body = null;
    this.state = 'falling';
    this.timer = 1.5;
    this.fallVel = 0;
    this.particles.spawnPuff({ x: this.plat.pos.x, y: this.plat.top, z: this.plat.pos.z });
  }

  // Mirror AnswerGate.reset(): rebuild the dropped collider, restore the wide platform and its
  // pad decals, and clear the answered flag so the gate is replayable after a respawn.
  reset() {
    if (!this.plat.body) {
      const phys = addStaticBox(
        this.world, this.RAPIER,
        { x: this.plat.pos.x, y: this.plat.pos.y + this.plat.half.y, z: this.plat.pos.z },
        this.plat.half,
      );
      this.plat.body = phys.body;
    }
    if (!this.plat.mesh.parent) this.scene.add(this.plat.mesh);
    this.plat.mesh.position.set(this.plat.pos.x, this.plat.pos.y, this.plat.pos.z);
    for (const d of this.plat.decals) {
      if (!d.mesh.parent) this.scene.add(d.mesh);
      d.mesh.position.set(d.basePos.x, d.basePos.y, d.basePos.z);
      d.mat.opacity = 1;
    }
    this.state = 'idle';
    this.timer = 0;
    this.fallVel = 0;
    this.cleared = false;
  }

  dispose() {
    if (this.plat.mesh.parent) this.scene.remove(this.plat.mesh);
    for (const d of this.plat.decals) if (d.mesh.parent) this.scene.remove(d.mesh);
    if (this.plat.body) this.world.removeRigidBody(this.plat.body);
  }
}

export async function spawnStyle6(scene, world, RAPIER, particles, sfx, gateData, callbacks, ctx) {
  const def = WIDE_DEF;
  const [gx, gy, gz] = gateData.position;

  const mesh = await loadModel(def.url);
  // Convention: gy = mesh-bottom anchor. Walkable top = gy + def.height.
  mesh.position.set(gx, gy, gz);
  scene.add(mesh);
  const phys = addStaticBox(world, RAPIER, { x: gx, y: gy + def.half.y, z: gz }, def.half);

  // Build the 3 pads with the same shuffled order as gateData.options.
  const pads = [];
  const decals = [];
  gateData.options.forEach((optData, i) => {
    const padX = WIDE_PAD_X[i];
    // Circular pad: draw a filled circle on canvas with the answer text.
    const W = 512, H = 512;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const cx = c.getContext('2d');
    cx.clearRect(0, 0, W, H);
    cx.fillStyle = '#ffffff';
    cx.beginPath();
    cx.arc(W / 2, H / 2, W / 2 - 8, 0, Math.PI * 2);
    cx.fill();
    cx.strokeStyle = '#1a2435';
    cx.lineWidth = 14;
    cx.stroke();
    cx.fillStyle = '#1a2435';
    cx.font = 'bold 110px Arial, sans-serif';
    cx.textAlign = 'center';
    cx.textBaseline = 'middle';
    cx.fillText(optData.text, W / 2, H / 2);

    const tex = canvasTexture(c);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide });
    const geo = new THREE.PlaneGeometry(1.4, 1.4);
    const padMesh = new THREE.Mesh(geo, mat);
    padMesh.rotation.x = Math.PI / 2;
    padMesh.position.set(gx + padX, gy + def.height + 0.03, gz);
    padMesh.renderOrder = 1;
    scene.add(padMesh);

    pads.push({ correct: optData.correct, x: padX, text: optData.text });
    decals.push({ mesh: padMesh, mat, basePos: { x: padMesh.position.x, y: padMesh.position.y, z: padMesh.position.z } });
  });

  const plat = {
    pos: { x: gx, y: gy, z: gz },
    half: def.half,
    top: gy + def.height,
    mesh,
    body: phys.body,
    decals,
  };

  const wgate = new WideAnswerGate(scene, world, RAPIER, particles, sfx, plat, pads, gateData.question, callbacks);

  // Freeway-sign-style vertical sign just before the wide platform (on the approach).
  const extras = [];
  if (ctx.approachPos) {
    const sign = makeTextPlane(formatPrompt(gateData.question.verb), { w: 2.5, h: 1.0 });
    sign.position.set(ctx.approachPos.x, ctx.approachPos.y + 2.2, ctx.approachPos.z);
    scene.add(sign);
    extras.push(sign);
  }

  return { gate: wgate, extras };
}

// =================================================================
// STYLE 7 — Tall wall behind the answer platforms. Question at top, 3 answers at bottom.
// No signs on platforms themselves.
// =================================================================
export async function spawnStyle7(scene, world, RAPIER, particles, sfx, gateData, callbacks, ctx) {
  const gate = await spawnSignlessGate(scene, world, RAPIER, particles, sfx, gateData, callbacks);
  const extras = [];

  const [gx, gy, gz] = gateData.position;
  // Wall behind the platforms (further from player). The player approaches from +Z, so "behind"
  // the platforms means smaller z. Place the wall a bit beyond the lane platforms.
  const wallZ = gz - 3.5;
  const W = 2048, H = 1024;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const cx = c.getContext('2d');
  // Card-style background — sky-friendly white with a dark border.
  cx.fillStyle = '#ffffff';
  cx.fillRect(0, 0, W, H);
  cx.strokeStyle = '#1a2435';
  cx.lineWidth = 20;
  cx.strokeRect(10, 10, W - 20, H - 20);

  // Question at the top.
  cx.fillStyle = '#1a2435';
  cx.font = 'bold 180px Arial, sans-serif';
  cx.textAlign = 'center';
  cx.textBaseline = 'middle';
  cx.fillText(`Past tense of ${gateData.question.verb.toUpperCase()}?`, W / 2, H * 0.28);

  // Three answers across the bottom, each above its corresponding lane.
  cx.font = 'bold 200px Arial, sans-serif';
  const colX = [W * 0.18, W * 0.5, W * 0.82];
  gate.options.forEach((opt, i) => {
    cx.fillText(opt.text, colX[i], H * 0.7);
  });

  const tex = canvasTexture(c);
  // Tall, thin "billboard" box. Use a plane (not a true box) for clarity; the spec describes a
  // wall-shaped object — a 0.2-thick visual is overkill, a flat plane reads identically.
  const wallGeo = new THREE.PlaneGeometry(10, 5);
  const wallMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide });
  const wall = new THREE.Mesh(wallGeo, wallMat);
  wall.position.set(gx, gy + 3.0, wallZ);
  scene.add(wall);
  extras.push(wall);

  return { gate, extras };
}

// -------------------- dispatcher --------------------

const STYLES = {
  1: spawnStyle1, 2: spawnStyle2, 3: spawnStyle3, 4: spawnStyle4,
  5: spawnStyle5, 6: spawnStyle6, 7: spawnStyle7,
};

export async function spawnStyledGate(style, scene, world, RAPIER, particles, sfx, gateData, callbacks, ctx) {
  const fn = STYLES[style];
  if (!fn) throw new Error(`Unknown Q/A style: ${style}`);
  return fn(scene, world, RAPIER, particles, sfx, gateData, callbacks, ctx);
}

export { LANE_OFFSETS };
