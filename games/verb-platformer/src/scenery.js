import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Background scenery for a level: floating islands, a castle beyond the flag, cloud puffs and
// the platforms' shadows on the cloud deck. Everything here is decoration:
//   - NO colliders, nothing the player can touch;
//   - placed automatically from the level's pieces (no hand placement per level), always
//     ISLAND_CLEAR / PUFF_CLEAR units away from every path piece, grass tops well below it;
//   - 4 draw calls in total: all islands + the castle are merged into ONE mesh (the whole
//     KayKit Medieval Hexagon pack shares one palette texture), the puffs are two
//     InstancedMeshes, the deck shadows one InstancedMesh.
// Models (assets/scenery/, ~0.7 MB) are loaded once and reused by every level.

const DIR = './assets/scenery/';
const MODELS = [
  'hex_grass', 'mountain_A_grass_trees', 'mountain_B_grass_trees', 'hills_A_trees',
  'hills_B_trees', 'trees_A_large', 'building_castle_blue', 'building_tower_A_blue',
  'cloud_big', 'cloud_small',
];
const SEASON_TEX = {
  summer: 'hexagons_medieval.png',
  fall: 'hexagons_medieval_Fall.png',
  winter: 'hexagons_medieval_Winter.png',
};

const ISLAND_CLEAR = 25;      // min gap between an island's rim and any path piece
const LANDMARK_CLEAR = 20;    // same for the castle island (it stands "near" the flag)
const ISLAND_DROP = 7;        // island grass is at least this far below the nearest path piece
const PUFF_CLEAR = 15;        // min gap between a cloud puff and any path piece
const ISLAND_COUNT = 7;
const PUFFS_PER_LAYER = 14;   // three layers → 42 puffs
const PUFF_SWAY = 4;          // puffs drift this far to each side

// Keel (the rock under an island): a cell of the palette texture with a grey-brown gradient.
const KEEL_U = 0.8125, KEEL_V_TOP = 0.28, KEEL_V_TIP = 0.47;

let libPromise = null;

// Loads the models and textures once. Safe to call early (game start) and again per level.
export function preloadScenery() {
  if (!libPromise) libPromise = loadLib().catch(e => { libPromise = null; throw e; });
  return libPromise;
}

async function loadLib() {
  const loader = new GLTFLoader();
  const texLoader = new THREE.TextureLoader();
  const gltfs = await Promise.all(MODELS.map(n => loader.loadAsync(`${DIR}${n}.gltf`)));
  const pieces = {};
  MODELS.forEach((n, i) => { pieces[n] = flatten(gltfs[i].scene); });
  // The loader made one texture + material per file; we draw with our own, so free those.
  for (const g of gltfs) {
    g.scene.traverse(o => {
      if (!o.isMesh) return;
      o.material.map?.dispose();
      o.material.dispose();
    });
  }
  const textures = {};
  await Promise.all(Object.entries(SEASON_TEX).map(async ([season, file]) => {
    const t = await texLoader.loadAsync(DIR + file);
    t.flipY = false;                       // glTF convention
    t.colorSpace = THREE.SRGBColorSpace;
    textures[season] = t;
  }));

  // A little self-light keeps the islands' colours fresh in the haze (the level's platforms
  // use the same lights, but sit close to the camera).
  const islandMat = new THREE.MeshLambertMaterial({
    map: textures.summer, emissiveMap: textures.summer, emissive: 0xffffff, emissiveIntensity: 0.22,
  });
  const puffMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const puffGeo = {
    big: toGeometry(pieces.cloud_big),
    small: toGeometry(pieces.cloud_small),
  };

  // Shadow quads on the cloud deck. Alpha comes from blob_shadow.png, the tint from the sky.
  const shadowTex = await texLoader.loadAsync('./assets/sprites/blob_shadow.png');
  const shadowMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8,
    uniforms: {
      uMap: { value: shadowTex },
      uColor: { value: new THREE.Color('#5a5f9a') },
      uOpacity: { value: 0.5 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uMap;
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        float a = texture2D(uMap, vUv).a * uOpacity;
        gl_FragColor = vec4(uColor, a);
        #include <colorspace_fragment>
      }
    `,
  });
  const shadowGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

  return { pieces, textures, islandMat, puffMat, puffGeo, shadowMat, shadowGeo };
}

// All meshes of a model baked into plain arrays (world transforms applied).
function flatten(root) {
  root.updateMatrixWorld(true);
  const pos = [], nrm = [], uv = [], idx = [];
  const v = new THREE.Vector3(), nm = new THREE.Matrix3();
  root.traverse(o => {
    if (!o.isMesh) return;
    const g = o.geometry;
    const base = pos.length / 3;
    const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
    nm.getNormalMatrix(o.matrixWorld);
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i).applyMatrix4(o.matrixWorld);
      pos.push(v.x, v.y, v.z);
      v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize();
      nrm.push(v.x, v.y, v.z);
      uv.push(U.getX(i), U.getY(i));
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(base + g.index.getX(i));
    else for (let i = 0; i < P.count; i++) idx.push(base + i);
  });
  return { pos, nrm, uv, idx };
}

function toGeometry(piece) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(piece.pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(piece.nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(piece.uv, 2));
  g.setIndex(piece.idx);
  return g;
}

// Collects transformed copies of pieces and turns them into one geometry.
class Merger {
  constructor() { this.pos = []; this.nrm = []; this.uv = []; this.idx = []; }
  // yaw in radians, s = uniform scale
  add(piece, x, y, z, s, yaw = 0) {
    const base = this.pos.length / 3;
    const c = Math.cos(yaw), sn = Math.sin(yaw);
    const P = piece.pos, N = piece.nrm;
    for (let i = 0; i < P.length; i += 3) {
      this.pos.push(x + (P[i] * c + P[i + 2] * sn) * s, y + P[i + 1] * s, z + (-P[i] * sn + P[i + 2] * c) * s);
      this.nrm.push(N[i] * c + N[i + 2] * sn, N[i + 1], -N[i] * sn + N[i + 2] * c);
    }
    for (let i = 0; i < piece.uv.length; i++) this.uv.push(piece.uv[i]);
    for (let i = 0; i < piece.idx.length; i++) this.idx.push(base + piece.idx[i]);
  }
  build() { return toGeometry(this); }
}

// Seeded random numbers, so a level looks the same every time it is played.
function seededRandom(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Everything the player can stand on (plus the flag), as circles: { x, z, r, top }.
// Movers get their whole travel as radius / height.
function pathItems(level) {
  const items = [];
  for (const p of level.platforms || []) {
    if (!p.pos || !p.half) continue;
    const b = p.basePos || p.pos;
    const m = p.motion;
    const height = p.height ?? (p.half.y * 2);
    items.push({
      x: b.x, z: b.z,
      r: Math.hypot(p.half.x, p.half.z) + (m && m.axis !== 'y' ? m.amplitude : 0),
      top: b.y + height + (m && m.axis === 'y' ? m.amplitude : 0),
      hx: p.half.x, hz: p.half.z, yaw: p.mesh?.rotation?.y || 0, ref: p, mover: !!m,
    });
  }
  for (const g of level.gates || []) {
    for (const o of g.gate?.options || []) {
      if (!o.pos || !o.half) continue;
      items.push({ x: o.pos.x, z: o.pos.z, r: Math.hypot(o.half.x, o.half.z), top: o.top, hx: o.half.x, hz: o.half.z, yaw: o.rotY || 0, ref: o, mover: false });
    }
  }
  if (level.flag?.pos) items.push({ x: level.flag.pos.x, z: level.flag.pos.z, r: 1, top: level.flag.pos.y, flag: true });
  return items;
}

// Gap between (x, z) and the nearest path piece, and that piece's height.
function nearestPath(items, x, z) {
  let gap = Infinity, top = 0;
  for (const it of items) {
    const d = Math.hypot(x - it.x, z - it.z) - it.r;
    if (d < gap) { gap = d; top = it.top; }
  }
  return { gap, top };
}

const HEX_RING1 = [[2, 0], [1, 1.732], [-1, 1.732], [-2, 0], [-1, -1.732], [1, -1.732]];
const HEX_RING2 = [[4, 0], [3, 1.732], [2, 3.464], [0, 3.464], [-2, 3.464], [-3, 1.732],
  [-4, 0], [-3, -1.732], [-2, -3.464], [0, -3.464], [2, -3.464], [3, -1.732]];

// One island: hex grass tiles, something on each, a rock keel reaching into the clouds.
// (x, top, z) = centre of the grass surface; s = scale (a tile is 2·s wide).
function addIsland(M, lib, rnd, { x, top, z, s, rings, cloudY, centre }) {
  const P = lib.pieces;
  const cells = [[0, 0, 0], ...HEX_RING1.map(c => [...c, 1])];
  if (rings > 1) cells.push(...HEX_RING2.map(c => [...c, 2]));
  // (weighted towards the lighter models and bare grass: triangle count)
  const ringDecor = ['hills_A_trees', 'hills_B_trees', 'hills_B_trees', 'mountain_A_grass_trees', 'trees_A_large', null, null, null];
  for (const [cx, cz, ring] of cells) {
    // outer tiles sit a little lower, so the rim is not one flat table
    const drop = ring === 0 ? 0 : rnd() * 0.3 * s * ring;
    const tx = x + cx * s, tz = z + cz * s, ty = top - drop;
    M.add(P.hex_grass, tx, ty, tz, s);
    let decor = null;
    if (ring === 0) decor = centre;
    else if (!(rings > 1 && ring === 1)) decor = ringDecor[Math.floor(rnd() * ringDecor.length)];   // ring 1 of the castle island stays clear
    if (decor) {
      const k = typeof decor === 'string' ? { name: decor, scale: 1 } : decor;
      M.add(P[k.name], tx, ty, tz, s * k.scale, Math.floor(rnd() * 6) * Math.PI / 3);
    }
  }
  addKeel(M, rnd, x, top - 0.55 * s, z, (rings * 2 + 1) * s * 0.97, cloudY);
  return (rings * 2 + 1) * s * 1.1;      // radius of the island
}

// Rough upside-down cone, flat shaded, so the island visibly hangs in the air.
function addKeel(M, rnd, x, y, z, radius, cloudY) {
  const n = 9;
  const depth = Math.max(radius * (1.0 + rnd() * 0.5), y - cloudY + 3);
  const ring = (r, yy, jitter) => {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const rr = r * (1 - jitter * rnd());
      pts.push([x + Math.cos(a) * rr, yy, z + Math.sin(a) * rr]);
    }
    return pts;
  };
  const r0 = ring(radius, y, 0.06);
  const r1 = ring(radius * 0.62, y - depth * 0.4, 0.3);
  const tip = [x + (rnd() - 0.5) * radius * 0.3, y - depth, z + (rnd() - 0.5) * radius * 0.3];
  const piece = { pos: [], nrm: [], uv: [], idx: [] };
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), nn = new THREE.Vector3();
  const tri = (p, q, r, vp, vq, vr) => {
    a.fromArray(p); b.fromArray(q); c.fromArray(r);
    nn.subVectors(c, a).cross(b.clone().sub(a)).normalize();
    // face normals point away from the keel's axis (and a little down)
    const ox = (p[0] + q[0] + r[0]) / 3 - x, oz = (p[2] + q[2] + r[2]) / 3 - z;
    if (nn.x * ox + nn.z * oz - nn.y * radius * 0.3 < 0) nn.negate();
    for (const [pt, v] of [[p, vp], [q, vq], [r, vr]]) {
      piece.idx.push(piece.pos.length / 3);
      piece.pos.push(...pt);
      piece.nrm.push(nn.x, nn.y, nn.z);
      piece.uv.push(KEEL_U, v);
    }
  };
  const vMid = KEEL_V_TOP + (KEEL_V_TIP - KEEL_V_TOP) * 0.5;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    tri(r0[i], r0[j], r1[i], KEEL_V_TOP, KEEL_V_TOP, vMid);
    tri(r0[j], r1[j], r1[i], KEEL_V_TOP, vMid, vMid);
    tri(r1[i], r1[j], tip, vMid, vMid, KEEL_V_TIP);
  }
  M.add(fixWinding(piece), 0, 0, 0, 1);
}

// Make every triangle's winding agree with its stored normal (so back-face culling works).
function fixWinding(piece) {
  const p = piece.pos, a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < piece.idx.length; i += 3) {
    const i0 = piece.idx[i] * 3, i1 = piece.idx[i + 1] * 3, i2 = piece.idx[i + 2] * 3;
    a.set(p[i0], p[i0 + 1], p[i0 + 2]); b.set(p[i1], p[i1 + 1], p[i1 + 2]); c.set(p[i2], p[i2 + 1], p[i2 + 2]);
    b.sub(a); c.sub(a); b.cross(c);
    if (b.x * piece.nrm[i0] + b.y * piece.nrm[i0 + 1] + b.z * piece.nrm[i0 + 2] < 0) {
      const t = piece.idx[i + 1]; piece.idx[i + 1] = piece.idx[i + 2]; piece.idx[i + 2] = t;
    }
  }
  return piece;
}

// Builds the scenery of one level. `level` is the loaded level (platforms, gates, flag, spawn);
// sky = resolved sky values (sky-presets.js). Returns { update(dt), dispose(), info }.
export async function buildScenery(scene, level, { cloudY, sky, seed = 'level' }) {
  const lib = await preloadScenery();
  const rnd = seededRandom(String(seed));
  const items = pathItems(level);
  const group = new THREE.Group();
  group.name = 'scenery';
  const info = { islands: [], landmark: null, puffs: 0, shadows: 0 };
  if (!items.length) return { update() {}, dispose() {}, info };

  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, minTop = Infinity, maxTop = -Infinity;
  for (const it of items) {
    minX = Math.min(minX, it.x - it.r); maxX = Math.max(maxX, it.x + it.r);
    minZ = Math.min(minZ, it.z - it.r); maxZ = Math.max(maxZ, it.z + it.r);
    minTop = Math.min(minTop, it.top); maxTop = Math.max(maxTop, it.top);
  }
  const inBox = (pad) => [minX - pad + rnd() * (maxX - minX + 2 * pad), minZ - pad + rnd() * (maxZ - minZ + 2 * pad)];

  // ---- Islands + landmark: one merged mesh ----
  const M = new Merger();
  const placed = [];   // { x, z, r, top }
  const islandTop = (pathTop, drop) => Math.max(cloudY + 2, pathTop - drop);

  // The castle stands beyond the flag, in the direction the level has been heading (spawn →
  // flag) if that side is free, otherwise wherever there is room around the flag.
  const flag = level.flag?.pos;
  if (flag) {
    const s = 4, r = 5 * s * 1.1;
    const sp = level.spawn || [0, 0, 0];
    let hx = flag.x - sp[0], hz = flag.z - sp[2];
    const hl = Math.hypot(hx, hz) || 1; hx /= hl; hz /= hl;
    let best = null;
    for (let extra = 0; extra <= 60 && !best; extra += 10) {
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a);
        const dist = LANDMARK_CLEAR + r + 1 + extra;
        const x = flag.x + dx * dist, z = flag.z + dz * dist;
        if (nearestPath(items, x, z).gap - r < LANDMARK_CLEAR) continue;
        const score = dx * hx + dz * hz;
        if (!best || score > best.score) best = { x, z, score };
      }
    }
    if (best) {
      const top = islandTop(flag.y, 6);
      addIsland(M, lib, rnd, { x: best.x, top, z: best.z, s, rings: 2, cloudY, centre: { name: 'building_castle_blue', scale: 2.4 } });
      placed.push({ x: best.x, z: best.z, r, top });
      info.landmark = { x: best.x, y: top, z: best.z, r };
    }
  }

  const centres = ['mountain_A_grass_trees', 'mountain_B_grass_trees', 'building_tower_A_blue', 'mountain_B_grass_trees', 'hills_A_trees'];
  for (let tries = 0; tries < 600 && info.islands.length < ISLAND_COUNT; tries++) {
    const s = 3 + rnd() * 2.5, r = 3 * s * 1.1;
    const [x, z] = inBox(125);
    const near = nearestPath(items, x, z);
    const gap = near.gap - r;
    // the first few stay close enough to be seen well; the rest may sit far out in the haze
    const maxGap = info.islands.length < 3 ? 50 : 115;
    if (gap < ISLAND_CLEAR || gap > maxGap) continue;
    if (placed.some(o => Math.hypot(o.x - x, o.z - z) < o.r + r + 12)) continue;
    const top = islandTop(near.top, ISLAND_DROP + rnd() * 4);
    addIsland(M, lib, rnd, { x, top, z, s, rings: 1, cloudY, centre: centres[Math.floor(rnd() * centres.length)] });
    placed.push({ x, z, r, top });
    info.islands.push({ x, y: top, z, r, gap });
  }

  lib.islandMat.map = lib.islandMat.emissiveMap = lib.textures[sky.season] || lib.textures.summer;
  const islandGeo = M.build();
  const islands = new THREE.Mesh(islandGeo, lib.islandMat);
  islands.frustumCulled = false;
  islands.matrixAutoUpdate = false;
  group.add(islands);

  // ---- Cloud puffs: three depth layers, two InstancedMeshes ----
  const puffs = { big: [], small: [] };
  const layers = [
    // low over the deck, around the level
    { pad: 90,  clear: PUFF_CLEAR, y: () => cloudY + 1.5 + rnd() * 3,              s: () => 3 + rnd() * 3 },
    // at about path height, further out
    { pad: 140, clear: 32,         y: () => minTop - 2 + rnd() * (maxTop - minTop + 12), s: () => 3.5 + rnd() * 4 },
    // high and far
    { pad: 230, clear: 60,         y: () => maxTop + 18 + rnd() * 40,              s: () => 7 + rnd() * 7 },
  ];
  for (const L of layers) {
    for (let n = 0, tries = 0; n < PUFFS_PER_LAYER && tries < 400; tries++) {
      const [x, z] = inBox(L.pad);
      const s = L.s(), y = L.y();
      const kind = rnd() < 0.2 ? 'big' : 'small';   // cloud_big has twice the triangles
      const r = (kind === 'big' ? 1.8 : 1.2) * s + PUFF_SWAY;
      if (nearestPath(items, x, z).gap - r < L.clear) continue;
      // not inside an island or the castle
      if (placed.some(o => Math.hypot(o.x - x, o.z - z) < o.r + r && y < o.top + 50)) continue;
      puffs[kind].push({ x, y, z, s, sy: 0.75 + rnd() * 0.3, yaw: rnd() * Math.PI * 2, phase: rnd() * Math.PI * 2, speed: 0.04 + rnd() * 0.05 });
      n++;
    }
  }
  lib.puffMat.color.set(sky.puff);
  // mostly self-lit, so the puffs stay bright all round; the lights add only a soft shading
  lib.puffMat.emissive.set(sky.puff).lerp(new THREE.Color(sky.cloudShade), 0.35).multiplyScalar(0.5);
  const puffMeshes = [];
  const dummy = new THREE.Object3D();
  for (const kind of ['big', 'small']) {
    const list = puffs[kind];
    if (!list.length) continue;
    const mesh = new THREE.InstancedMesh(lib.puffGeo[kind], lib.puffMat, list.length);
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    group.add(mesh);
    puffMeshes.push({ mesh, list });
    info.puffs += list.length;
  }
  let time = 0;
  function placePuffs() {
    for (const { mesh, list } of puffMeshes) {
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        dummy.position.set(p.x + Math.sin(time * p.speed + p.phase) * PUFF_SWAY, p.y + Math.sin(time * p.speed * 2.3 + p.phase) * 0.4, p.z);
        dummy.rotation.set(0, p.yaw, 0);
        dummy.scale.set(p.s, p.s * p.sy, p.s);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
  }
  placePuffs();

  // ---- Shadows on the cloud deck: one soft quad per path piece and per island ----
  const shadowItems = items.filter(it => !it.flag);
  const shadowCount = shadowItems.length + placed.length;
  const shadows = new THREE.InstancedMesh(lib.shadowGeo, lib.shadowMat, shadowCount);
  shadows.frustumCulled = false;
  shadows.renderOrder = -0.5;       // straight after the cloud deck, before everything else
  shadows.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const deckY = cloudY + 0.08;
  // The blob texture is dark only in its middle half, so the quad is larger than the piece;
  // higher pieces throw a wider, softer blob.
  const setShadow = (i, x, z, hx, hz, top, hidden, yaw = 0) => {
    const spread = hidden ? 0 : 1.9 + Math.min(0.9, Math.max(0, top - cloudY) * 0.02);
    dummy.position.set(x, deckY, z);
    dummy.rotation.set(0, yaw, 0);
    dummy.scale.set(Math.max(hx * 2, 1.5) * spread, 1, Math.max(hz * 2, 1.5) * spread);
    dummy.updateMatrix();
    shadows.setMatrixAt(i, dummy.matrix);
  };
  const live = [];     // shadows that can change: movers and pieces that can fall
  shadowItems.forEach((it, i) => {
    setShadow(i, it.x, it.z, it.hx, it.hz, it.top, false, it.yaw);
    if (it.ref && (it.mover || 'state' in it.ref)) live.push({ i, it, x: it.x, z: it.z, hidden: false });
  });
  placed.forEach((o, k) => setShadow(shadowItems.length + k, o.x, o.z, o.r * 0.8, o.r * 0.8, cloudY, false));
  shadows.instanceMatrix.needsUpdate = true;
  lib.shadowMat.uniforms.uColor.value.set(sky.cloudShade).multiplyScalar(0.55);
  group.add(shadows);
  info.shadows = shadowCount;

  scene.add(group);

  return {
    info,
    update(dt) {
      time += dt;
      placePuffs();
      let changed = false;
      for (const l of live) {
        const ref = l.it.ref;
        const hidden = ref.state === 'falling' || ref.state === 'gone';
        const x = ref.pos.x, z = ref.pos.z;
        if (hidden === l.hidden && x === l.x && z === l.z) continue;
        l.hidden = hidden; l.x = x; l.z = z;
        setShadow(l.i, x, z, l.it.hx, l.it.hz, ref.top ?? l.it.top, hidden, l.it.yaw);
        changed = true;
      }
      if (changed) shadows.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      scene.remove(group);
      islandGeo.dispose();
      for (const { mesh } of puffMeshes) mesh.dispose();   // frees the instance buffers; geometry + material are shared
      shadows.dispose();
    },
  };
}
