// Builds the static scene with Three.js primitives + procedural canvas
// textures — no asset files. Returns handles the rest of the game animates
// (cottage windows glow at dusk, the blackboard gets chalk text, Professor
// Krabsy idles). Dynamic farm geometry (soil, crops, trees) lives in farming.js.

import { t } from './i18n.js';
import * as THREE from 'three';
import { LAYOUT, PAL } from './config.js';
import { prop } from './assets.js';

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

// Cottage window panes [x, y, z, w, h] in cottage space (by eye against
// the KayKit home_A model at scale 6.6).
// Found by raycasting the model: front wall z≈2.08, side walls x≈±1.62.
// [x, y, z, w, h, rotY]
const COTTAGE_PANES = [
  [0, 3.64, 2.17, 0.4, 0.4, 0],
  [1.9, 1.6, -1.0, 0.45, 0.75, Math.PI / 2], [1.9, 1.6, 1.0, 0.45, 0.75, Math.PI / 2],
  [-1.9, 1.6, -1.0, 0.45, 0.75, -Math.PI / 2], [-1.9, 1.6, 1.0, 0.45, 0.75, -Math.PI / 2],
];

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

  // ── Cottage: KayKit home (door faces +Z toward the field) ─────────────
  const cot = new THREE.Group();
  cot.position.set(LAYOUT.cottage.x, 0, LAYOUT.cottage.z);
  const house = prop('cottage', 6.6);
  cot.add(house);
  // Warm window glow after dusk: emissive panes laid over the model's
  // front windows (the model's own windows are part of its texture).
  for (const [x, y, z, w, h, ry] of COTTAGE_PANES) {
    const winMat = new THREE.MeshLambertMaterial({ color: 0x000000, emissive: c(0xffcf5e), emissiveIntensity: 0, transparent: true, opacity: 0.0 });
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), winMat);
    pane.position.set(x, y, z); pane.rotation.y = ry; cot.add(pane);
    refs.windows.push(winMat);
  }
  scene.add(cot);

  // Windmill landmark; its sails turn (game.js spins refs.windmillFan).
  const mill = prop('windmill', 5.2);
  mill.position.set(LAYOUT.windmill.x, 0, LAYOUT.windmill.z); mill.rotation.y = -0.5;
  scene.add(mill);
  refs.windmillFan = mill.getObjectByName('building_windmill_top_fan_red');

  // Bed marker outside the door (sleep spot) — a cozy little porch mat + sign.
  const mat = new THREE.Mesh(new THREE.CircleGeometry(1.3, 18), lambert(0xcf6b58));
  mat.rotation.x = -Math.PI / 2; mat.position.set(LAYOUT.bed.x, 0.03, LAYOUT.bed.z); scene.add(mat);
  refs.bedSign = makeSignpost(scene, LAYOUT.bed.x + 1.4, LAYOUT.bed.z, t('sign.sleep'), 0xcf6b58);

  // ── Selling crate (KayKit wood crate + a berry crate beside it) ──────
  const crate = new THREE.Group();
  crate.position.set(LAYOUT.crate.x, 0, LAYOUT.crate.z);
  const cb = prop('crateWood', 1.6); cb.rotation.y = 0.3; crate.add(cb);
  const cb2 = prop('crateBerries', 1.2); cb2.position.set(1.3, 0, 0.6); cb2.rotation.y = -0.4; crate.add(cb2);
  scene.add(crate);
  refs.crate = crate;
  makeSignpost(scene, LAYOUT.crate.x + 1.6, LAYOUT.crate.z, t('sign.sell'), 0x9c6b3f);
  // ── The well (KayKit) ─────────────────────────────────────────────────
  const well = prop('wellModel', 2.9);
  well.position.set(LAYOUT.well.x, 0, LAYOUT.well.z); well.rotation.y = Math.PI / 2;
  scene.add(well);
  refs.well = well;
  makeSignpost(scene, LAYOUT.well.x - 1.4, LAYOUT.well.z + 1.2, t('sign.well'), 0x3fa7d6);


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
  makeSignpost(scene, LAYOUT.shop.x, LAYOUT.shop.z + 1.4, t('sign.shop'), 0xffcf5e);

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
  // Krabsy stands on a crate at the board's left edge, so he stays visible
  // above the question panel during class.
  const podium = prop('crateWood', 1.5); podium.position.set(-2.7, 0, 1.0); school.add(podium);
  const krabsy = makeKrabsy(); krabsy.group.position.set(-2.7, 0.78, 1.0); krabsy.group.rotation.y = 0.35; school.add(krabsy.group);
  refs.krabsy = krabsy;
  // A school bell on a post (nags via the bell sound).
  const bellPost = cyl(0.1, 0.12, 3, 0x6a5030); bellPost.position.set(3, 1.5, 1.5); school.add(bellPost);
  const bell = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.6, 12), lambert(0xe0b84a));
  bell.position.set(3, 2.9, 1.5); bell.rotation.x = Math.PI; school.add(bell);
  refs.bell = bell;
  scene.add(school);
  makeSignpost(scene, LAYOUT.school.x - 5.4, LAYOUT.school.z + 2.4, t('sign.school'), 0x2ee6c0);

  // Hay meadow sign (the tiles themselves are dynamic, built in farming.js).
  makeSignpost(scene, LAYOUT.hay.cx - 7, LAYOUT.hay.cz, t('sign.hay'), 0xd8c25e);

  // Quarry sign + permanent dressing rocks framing the mining corner
  // (the mineable nodes themselves are dynamic, built in farming.js).
  makeSignpost(scene, LAYOUT.mine[1].x + 2.2, LAYOUT.mine[1].z - 1.6, t('sign.quarry'), 0xb8c4d0);
  for (const [k, x, z, s] of [['rock5', -20.5, -4.5, 3.2], ['rock5', -20.8, 4.8, 2.6], ['rock1', -15.0, 4.6, 2.0]]) {
    const r = prop(k, s); r.position.set(x, 0, z); r.rotation.y = x * 2.1; scene.add(r);
  }

  // ── Fences framing the play area ─────────────────────────────────────
  buildFences(scene);

  // Scatter pack bushes, grass tufts and pebbles for life.
  const SCATTER = ['bush1', 'grass1', 'grass2', 'bush2', 'grass1', 'bush4', 'grass2', 'stoneSmall'];
  for (let i = 0; i < 26; i++) {
    const a = i * 2.39996, r = 5 + (i % 7) * 2.4;
    const x = Math.cos(a) * r, z = Math.sin(a) * r - 1;
    if (Math.abs(x - LAYOUT.field.cx) < 6 && Math.abs(z - LAYOUT.field.cz) < 5) continue; // keep field clear
    if (Math.abs(x - LAYOUT.hay.cx) < 7.5 && Math.abs(z - LAYOUT.hay.cz) < 3.5) continue; // keep hay meadow clear
    if (Math.abs(x - LAYOUT.school.x) < 5 && Math.abs(z - LAYOUT.school.z) < 5) continue;  // keep classroom clear
    const p = prop(SCATTER[i % SCATTER.length], 0.8 + (i % 3) * 0.25);
    p.position.set(x, 0, z);
    p.rotation.y = i * 1.7;
    scene.add(p);
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
  ctx.fillText(t('boardIdle'), cv.width / 2, 200);
  ctx.font = '40px Nunito, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText(t('boardIdleSub'), cv.width / 2, 300);
  tex.needsUpdate = true;
}

// ── Professor Krabsy — a scholarly crab built from primitives ──────────
// Professor Krabsy: the owner's crab from BlobVideos (rigid named parts,
// pivots at the joints, model forward = +x). Game.js animates the parts.
function makeKrabsy() {
  const group = new THREE.Group();
  const crab = prop('crab', 1.9);
  crab.rotation.y = -Math.PI / 2;   // +x forward → faces the bench (+z)
  group.add(crab);
  const names = ['body', 'shell', 'claw_L', 'claw_R', 'stalk_L', 'stalk_R', 'lid_L', 'lid_R', 'brow_L', 'brow_R'];
  const parts = Object.fromEntries(names.map((n) => [n, crab.getObjectByName(n)]));
  for (const p of Object.values(parts)) if (p) p.userData.rest = p.rotation.clone();
  // The professor's mortarboard, sitting on top of the shell (model units).
  if (parts.shell) {
    const cap = new THREE.Group();
    const base = cyl(0.11, 0.12, 0.09, 0x222244); cap.add(base);
    const top = box(0.4, 0.03, 0.4, 0x222244); top.position.y = 0.06; top.rotation.y = 0.3; cap.add(top);
    const cord = cyl(0.008, 0.008, 0.14, 0xffcf5e); cord.position.set(0.17, -0.01, 0.1); cap.add(cord);
    const tassel = sph(0.03, 0xffcf5e); tassel.position.set(0.17, -0.09, 0.1); cap.add(tassel);
    cap.position.set(-0.22, 0.68, 0); cap.rotation.z = -0.12;
    cap.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    parts.shell.add(cap);
  }
  group.userData.parts = parts;
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
