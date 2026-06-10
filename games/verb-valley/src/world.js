// Builds the static scene with Three.js primitives + procedural canvas
// textures — no asset files. Returns handles the rest of the game animates
// (cottage windows glow at dusk, the blackboard gets chalk text, Professor
// Krabsy idles). Dynamic farm geometry (soil, crops, trees) lives in farming.js.

import * as THREE from 'three';
import { LAYOUT, PAL } from './config.js';

const c = (hex) => new THREE.Color(hex);

// Soft round dot texture for Points materials (fireflies, stars, sparkles) —
// without a map, points render as hard squares.
let dotTex = null;
export function makeDotTexture() {
  if (dotTex) return dotTex;
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.8)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  dotTex = new THREE.CanvasTexture(cv);
  return dotTex;
}

// Small material cache so we reuse instead of allocating per mesh.
const matCache = new Map();
function lambert(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshLambertMaterial({ color, ...opts }));
  return matCache.get(key);
}

function box(w, h, d, color, opts) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lambert(color, opts));
}
function cyl(rt, rb, h, color, seg = 12, opts) {
  return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), lambert(color, opts));
}
function sph(r, color, opts) {
  return new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), lambert(color, opts));
}

export function buildWorld(scene) {
  const refs = { windows: [], lanterns: [], fireflyParent: null };
  const G = LAYOUT.ground;

  // ── Ground: grassy field, sandy beach strip on +Z, water beyond ──────
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(G, G), lambert(0x6db24a));
  grass.rotation.x = -Math.PI / 2;
  grass.receiveShadow = true;
  scene.add(grass);

  // Subtle grass tone patches for texture (a few flat discs).
  for (let i = 0; i < 14; i++) {
    const a = i * 2.39996, r = (i % 5) * 3 + 3;
    const patch = new THREE.Mesh(new THREE.CircleGeometry(1.4 + (i % 3) * 0.6, 10),
      lambert(i % 2 ? 0x66a843 : 0x74bd52));
    patch.rotation.x = -Math.PI / 2;
    patch.position.set(Math.cos(a) * r, 0.01, Math.sin(a) * r - 2);
    patch.receiveShadow = true;
    scene.add(patch);
  }

  // Beach sand band near the school (south edge).
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(G, 11), lambert(0xf2e2a8));
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.02, 17.5);
  sand.receiveShadow = true;
  scene.add(sand);

  // Sea — gentle animated plane (vertex bob done in update()).
  const seaGeo = new THREE.PlaneGeometry(G * 1.6, 26, 24, 8);
  const sea = new THREE.Mesh(seaGeo, new THREE.MeshLambertMaterial({ color: 0x2fa4c7, transparent: true, opacity: 0.92 }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0.04, 33);
  scene.add(sea);
  refs.sea = sea;

  // ── Cottage ──────────────────────────────────────────────────────────
  const cot = new THREE.Group();
  cot.position.set(LAYOUT.cottage.x, 0, LAYOUT.cottage.z);
  const body = box(6, 3.4, 5, 0xe8d6b0); body.position.y = 1.7; body.castShadow = true; cot.add(body);
  // Roof — two slanted boxes.
  const roofMat = lambert(PAL ? 0xb5503e : 0xb5503e);
  const r1 = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.4, 3.1), roofMat);
  r1.position.set(0, 3.9, -1.35); r1.rotation.x = -0.62; r1.castShadow = true; cot.add(r1);
  const r2 = r1.clone(); r2.position.z = 1.35; r2.rotation.x = 0.62; cot.add(r2);
  // Door (faces +Z toward field).
  const door = box(1.3, 2.2, 0.2, 0x8a5a3c); door.position.set(0, 1.1, 2.55); cot.add(door);
  // Windows — emissive so they glow after dark.
  for (const dx of [-1.9, 1.9]) {
    const winMat = new THREE.MeshLambertMaterial({ color: 0x9fd8e8, emissive: c(0xffcf5e), emissiveIntensity: 0 });
    const w = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 0.2), winMat);
    w.position.set(dx, 1.9, 2.55); cot.add(w);
    refs.windows.push(winMat);
  }
  // Chimney.
  const chim = box(0.7, 1.6, 0.7, 0x8a6a55); chim.position.set(2, 4.4, 0); cot.add(chim);
  scene.add(cot);

  // Bed marker outside the door (sleep spot) — a cozy little porch mat + sign.
  const mat = new THREE.Mesh(new THREE.CircleGeometry(1.3, 18), lambert(0xcf6b58));
  mat.rotation.x = -Math.PI / 2; mat.position.set(LAYOUT.bed.x, 0.03, LAYOUT.bed.z); scene.add(mat);
  refs.bedSign = makeSignpost(scene, LAYOUT.bed.x + 1.4, LAYOUT.bed.z, '🛏 Sleep', 0xcf6b58);

  // ── Shipping crate ───────────────────────────────────────────────────
  const crate = new THREE.Group();
  crate.position.set(LAYOUT.crate.x, 0, LAYOUT.crate.z);
  const cb = box(2, 1.3, 2, 0x9c6b3f); cb.position.y = 0.65; cb.castShadow = true; crate.add(cb);
  const lid = box(2.1, 0.2, 2.1, 0xb98a55); lid.position.y = 1.35; lid.rotation.z = 0.06; crate.add(lid);
  // metal bands
  for (const y of [0.35, 1.0]) { const band = box(2.05, 0.12, 2.05, 0x6a4a2c); band.position.y = y; crate.add(band); }
  scene.add(crate);
  refs.crate = crate;
  makeSignpost(scene, LAYOUT.crate.x + 1.6, LAYOUT.crate.z, '📦 Ship', 0x9c6b3f);

  // ── Shop stand ───────────────────────────────────────────────────────
  const shop = new THREE.Group();
  shop.position.set(LAYOUT.shop.x, 0, LAYOUT.shop.z);
  const counter = box(3, 1.1, 1.4, 0xc98a4a); counter.position.y = 0.55; counter.castShadow = true; shop.add(counter);
  // Awning posts + striped roof.
  for (const dx of [-1.4, 1.4]) { const post = cyl(0.1, 0.1, 2.6, 0x7a5a30); post.position.set(dx, 1.3, 0); shop.add(post); }
  const awn = box(3.4, 0.25, 1.8, 0xff8585); awn.position.set(0, 2.6, 0); awn.rotation.x = 0.12; shop.add(awn);
  for (let i = -1; i <= 1; i++) { const stripe = box(0.7, 0.27, 1.8, 0xffffff); stripe.position.set(i * 1.1, 2.6, 0); stripe.rotation.x = 0.12; shop.add(stripe); }
  scene.add(shop);
  refs.shop = shop;
  makeSignpost(scene, LAYOUT.shop.x, LAYOUT.shop.z + 1.4, '🛒 Shop', 0xffcf5e);

  // ── Pond (decor) ─────────────────────────────────────────────────────
  const pond = new THREE.Mesh(new THREE.CircleGeometry(LAYOUT.pond.r, 28),
    new THREE.MeshLambertMaterial({ color: 0x2f8fc7, transparent: true, opacity: 0.9 }));
  pond.rotation.x = -Math.PI / 2; pond.position.set(LAYOUT.pond.x, 0.03, LAYOUT.pond.z); scene.add(pond);
  // Reeds around the pond.
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2;
    const reed = cyl(0.04, 0.06, 1.1 + Math.random() * 0.5, 0x4f9b3a);
    reed.position.set(LAYOUT.pond.x + Math.cos(a) * (LAYOUT.pond.r + 0.4), 0.55, LAYOUT.pond.z + Math.sin(a) * (LAYOUT.pond.r + 0.4));
    scene.add(reed);
  }

  // ── Beach school: blackboard, bench, Professor Krabsy ────────────────
  const school = new THREE.Group();
  school.position.set(LAYOUT.school.x, 0, LAYOUT.school.z);
  // Blackboard with a live canvas texture.
  const bb = makeBlackboard();
  bb.group.position.set(0, 0, 0);
  school.add(bb.group);
  refs.blackboard = bb;
  // Bench facing the board (on +Z side).
  const bench = new THREE.Group();
  const seat = box(3, 0.2, 0.7, 0x9a6a44); seat.position.y = 0.6; bench.add(seat);
  for (const dx of [-1.2, 1.2]) for (const dz of [-0.25, 0.25]) { const leg = box(0.15, 0.6, 0.15, 0x7a4f30); leg.position.set(dx, 0.3, dz); bench.add(leg); }
  const back = box(3, 0.6, 0.15, 0x9a6a44); back.position.set(0, 1.0, -0.3); bench.add(back);
  bench.position.set(0, 0, 3.2); school.add(bench);
  // Professor Krabsy at the board.
  const krabsy = makeKrabsy(); krabsy.group.position.set(-2, 0, 1.4); krabsy.group.rotation.y = 0.4; school.add(krabsy.group);
  refs.krabsy = krabsy;
  // A school bell on a post (nags via the bell sound).
  const bellPost = cyl(0.1, 0.12, 3, 0x6a5030); bellPost.position.set(3, 1.5, 1.5); school.add(bellPost);
  const bell = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.6, 12), lambert(0xe0b84a));
  bell.position.set(3, 2.9, 1.5); bell.rotation.x = Math.PI; school.add(bell);
  refs.bell = bell;
  scene.add(school);
  makeSignpost(scene, LAYOUT.school.x - 3.5, LAYOUT.school.z + 2, '🦀 School', 0x2ee6c0);

  // ── Fences framing the play area ─────────────────────────────────────
  buildFences(scene);

  // Scatter a few flowers + bushes for life.
  for (let i = 0; i < 22; i++) {
    const a = i * 2.39996, r = 5 + (i % 7) * 2.4;
    const x = Math.cos(a) * r, z = Math.sin(a) * r - 1;
    if (Math.abs(x - LAYOUT.field.cx) < 6 && Math.abs(z - LAYOUT.field.cz) < 5) continue; // keep field clear
    if (i % 3 === 0) {
      const bush = sph(0.5 + Math.random() * 0.3, 0x4f9b3a); bush.position.set(x, 0.4, z); bush.scale.y = 0.8; bush.castShadow = true; scene.add(bush);
    } else {
      const stem = cyl(0.03, 0.03, 0.4, 0x4f9b3a); stem.position.set(x, 0.2, z); scene.add(stem);
      const petal = sph(0.16, [0xff8585, 0xffcf5e, 0xff6fae, 0xffffff][i % 4]); petal.position.set(x, 0.45, z); scene.add(petal);
    }
  }

  // Firefly + star particle parents (filled by daycycle).
  const fireflies = new THREE.Group(); scene.add(fireflies); refs.fireflies = fireflies;
  return refs;
}

// ── Signpost helper: a little post with a canvas label ─────────────────
function makeSignpost(scene, x, z, label, color) {
  const g = new THREE.Group();
  const post = cyl(0.07, 0.07, 1.3, 0x7a5a36); post.position.y = 0.65; g.add(post);
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 96;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#' + color.toString(16).padStart(6, '0'); roundRect(ctx, 4, 4, 248, 88, 16); ctx.fill();
  ctx.fillStyle = '#1b223f'; ctx.font = 'bold 44px Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, 128, 50);
  const tex = new THREE.CanvasTexture(cv);
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.5), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  plate.position.y = 1.35; g.add(plate);
  const plateB = plate.clone(); plateB.rotation.y = Math.PI; g.add(plateB);
  g.position.set(x, 0, z);
  scene.add(g);
  return g;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ── Blackboard with a redrawable chalk canvas ──────────────────────────
function makeBlackboard() {
  const group = new THREE.Group();
  // Frame + legs.
  const frame = box(5.2, 3.4, 0.25, 0x6a4a30); frame.position.y = 2.6; frame.castShadow = true; group.add(frame);
  for (const dx of [-2.2, 2.2]) { const leg = cyl(0.1, 0.1, 1.2, 0x6a4a30); leg.position.set(dx, 0.6, 0); group.add(leg); }
  const cv = document.createElement('canvas'); cv.width = 768; cv.height = 512;
  const ctx = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 3.0), new THREE.MeshBasicMaterial({ map: tex }));
  board.position.set(0, 2.6, 0.14); group.add(board);
  const api = { group, cv, ctx, tex };
  drawBoardIdle(api);
  return api;
}

export function drawBoardIdle(bb) {
  const { ctx, cv, tex } = bb;
  ctx.fillStyle = '#1e3a2f'; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 4;
  ctx.font = 'italic 64px "Fredoka One", cursive'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText('English Class', cv.width / 2, 200);
  ctx.font = '40px Nunito, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText('Press E to begin', cv.width / 2, 300);
  tex.needsUpdate = true;
}

// ── Professor Krabsy — a scholarly crab built from primitives ──────────
function makeKrabsy() {
  const group = new THREE.Group();
  const shell = sph(0.7, 0xe0392b); shell.scale.set(1.2, 0.75, 1); shell.position.y = 0.7; shell.castShadow = true; group.add(shell);
  const belly = sph(0.55, 0xf2a98f); belly.scale.set(1, 0.5, 0.6); belly.position.set(0, 0.55, 0.45); group.add(belly);
  // Eye stalks.
  const eyes = new THREE.Group();
  for (const dx of [-0.25, 0.25]) {
    const stalk = cyl(0.05, 0.06, 0.5, 0xe0392b); stalk.position.set(dx, 1.25, 0.2); eyes.add(stalk);
    const ball = sph(0.13, 0xffffff); ball.position.set(dx, 1.55, 0.2); eyes.add(ball);
    const pup = sph(0.06, 0x1b223f); pup.position.set(dx, 1.55, 0.32); eyes.add(pup);
  }
  group.add(eyes); group.userData.eyes = eyes;
  // Reading glasses (two rings).
  for (const dx of [-0.25, 0.25]) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.025, 8, 16), lambert(0x222222));
    rim.position.set(dx, 1.55, 0.34); group.add(rim);
  }
  // Mortarboard cap.
  const capBase = cyl(0.18, 0.2, 0.18, 0x222244); capBase.position.set(0, 1.78, 0.2); group.add(capBase);
  const capTop = box(0.7, 0.06, 0.7, 0x222244); capTop.position.set(0, 1.9, 0.2); capTop.rotation.y = 0.2; group.add(capTop);
  const tassel = sph(0.06, 0xffcf5e); tassel.position.set(0.3, 1.78, 0.45); group.add(tassel);
  // Claws on little arms.
  const claws = new THREE.Group();
  for (const dx of [-0.8, 0.8]) {
    const arm = cyl(0.07, 0.07, 0.5, 0xe0392b); arm.position.set(dx, 0.6, 0.3); arm.rotation.z = dx < 0 ? 0.6 : -0.6; claws.add(arm);
    const claw = sph(0.22, 0xc83228); claw.position.set(dx * 1.25, 0.75, 0.45); claw.scale.set(1, 1.2, 0.7); claws.add(claw);
  }
  group.add(claws); group.userData.claws = claws;
  // Little legs.
  for (const dx of [-0.5, -0.2, 0.2, 0.5]) { const leg = cyl(0.04, 0.04, 0.4, 0xc83228); leg.position.set(dx, 0.2, 0); leg.rotation.z = dx < 0 ? 0.5 : -0.5; group.add(leg); }
  return { group };
}

function buildFences(scene) {
  const half = LAYOUT.ground / 2 - 3;
  const postMat = lambert(0x8a6a44);
  const addRail = (x1, z1, x2, z2) => {
    const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.12, 0.12), postMat);
    rail.position.set((x1 + x2) / 2, 0.9, (z1 + z2) / 2);
    rail.rotation.y = Math.atan2(-dz, dx);
    scene.add(rail);
    const n = Math.max(2, Math.floor(len / 3));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.2, 0.18), postMat);
      post.position.set(x1 + dx * t, 0.6, z1 + dz * t); scene.add(post);
    }
  };
  // Frame three sides; leave the beach (+Z) open.
  addRail(-half, -half, half, -half);
  addRail(-half, -half, -half, 9);
  addRail(half, -half, half, 9);
}
