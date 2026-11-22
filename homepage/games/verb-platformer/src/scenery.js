import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { preloadLife, buildLife } from './scenery-life.js';

// Background scenery for a level: floating islands, a castle beyond the flag, cloud puffs and
// the platforms' shadows on the cloud deck. Everything here is decoration:
//   - NO colliders, nothing the player can touch;
//   - placed automatically from the level's pieces (no hand placement per level), always
//     ISLAND_CLEAR / PUFF_CLEAR units away from every path piece, grass tops well below it;
//   - Few draw calls for the static part: the islands and the castle are ONE merged mesh (the
//     whole KayKit Medieval Hexagon pack shares one palette texture), the islets and the
//     start flags one mesh per 110 × 110 map cell (cells out of view are skipped), the puffs
//     are two InstancedMeshes, the deck shadows one InstancedMesh.
//   - Slow devices: when the game runs below 12 frames a second for three seconds, everything
//     art pass 2 added is switched off for the rest of the visit (setLite). `?scenery=lite`
//     / `?scenery=full` in the URL force one or the other.
//   - Three depth layers: islets 10–22 units from the path (small, inhabited, always well
//     below the walkway), islands 25–50, islands and the castle far out in the haze.
//   - Everything that moves (windmill sails, cloud ships, balloons, birds, the spectators on
//     the look-out islets) lives in scenery-life.js: 4 InstancedMeshes + 1 mesh per spectator.
// Models (assets/scenery/, ~1.6 MB) are loaded once and reused by every level.

const DIR = './assets/scenery/';
const MODELS = [
  'hex_grass', 'mountain_A_grass_trees', 'mountain_B_grass_trees', 'hills_A_trees',
  'hills_B_trees', 'trees_A_large', 'building_castle_blue', 'building_tower_A_blue',
  'cloud_big', 'cloud_small',
  // art pass 2: islets and life
  'building_windmill_yellow', 'building_home_A_blue', 'building_home_B_red', 'building_well_blue',
  'ship', 'tent', 'unit_blue_full', 'horse_A', 'haybale', 'flag_yellow',
  'banner_yellow_full', 'tree_single_A', 'tree_single_B', 'trees_A_small', 'hill_single_A',
  'rock_single_B', 'building_grain',
];
const WINDMILL = 'building_windmill_yellow';
const WINDMILL_FAN = 'building_windmill_top_fan_yellow';   // node name of the sails
const SEASON_TEX = {
  summer: 'hexagons_medieval.png',
  fall: 'hexagons_medieval_Fall.png',
  winter: 'hexagons_medieval_Winter.png',
};

const ISLAND_CLEAR = 25;      // min gap between an island's rim and any path piece
const LANDMARK_CLEAR = 20;    // same for the castle island (it stands "near" the flag)
const ISLAND_DROP = 7;        // island grass is at least this far below the nearest path piece
const PUFF_CLEAR = 15;        // min gap between a cloud puff and any path piece
const CHUNK = 110;             // islands are merged per cell of this size (frustum culling)
const ISLAND_COUNT = 8;
const ISLANDS_NEAR = 4;       // this many of them stay within 25–48 units of the path
const PUFFS_PER_LAYER = 14;   // three layers → 42 puffs (+ the close ones, see buildScenery)
// Mid-ground islets
const ISLET_GAP_MIN = 10;     // min gap between an islet's rim and any path piece
const ISLET_GAP_MAX = 22;
const ISLET_FLOOR = 2.5;      // islet grass is at least this far above the cloud deck
const PUFF_SWAY = 4;          // puffs drift this far to each side

// Keel (the rock under an island): a cell of the palette texture with a grey-brown gradient.
const KEEL_U = 0.8125, KEEL_V_TOP = 0.28, KEEL_V_TIP = 0.47;

// Slow-device guard (see setLite in buildScenery)
const LITE_BELOW = 1 / 12;    // smoothed frame time above this …
const LITE_AFTER = 3;         // … for this many seconds → extras off
const urlMode = new URLSearchParams(globalThis.location?.search || '').get('scenery');
const FORCE_FULL = urlMode === 'full';
let liteMode = urlMode === 'lite';

let libPromise = null;

// Loads the models and textures once. Safe to call early (game start) and again per level.
export function preloadScenery() {
  if (!libPromise) libPromise = loadLib().catch(e => { libPromise = null; throw e; });
  return libPromise;
}

async function loadLib() {
  const loader = new GLTFLoader();
  const texLoader = new THREE.TextureLoader();
  const [gltfs] = await Promise.all([
    Promise.all(MODELS.map(n => loader.loadAsync(`${DIR}${n}.gltf`))),
    preloadLife().catch(e => console.warn('[krabsy3d] spectators not available', e)),
  ]);
  const pieces = {};
  MODELS.forEach((n, i) => { pieces[n] = flatten(gltfs[i].scene, o => o.name !== WINDMILL_FAN); });
  // The windmill's sails turn: they are kept apart, in their own coordinates, with the
  // pivot (where they sit on the mill).
  const millScene = gltfs[MODELS.indexOf(WINDMILL)].scene;
  const fanNode = millScene.getObjectByName(WINDMILL_FAN);
  const fan = { geo: null, pivot: new THREE.Vector3() };
  if (fanNode) {
    fan.geo = fanNode.geometry.clone();
    fanNode.getWorldPosition(fan.pivot);
  }
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

  const shipGeo = toGeometry(pieces.ship);

  return { pieces, textures, islandMat, puffMat, puffGeo, shadowMat, shadowGeo, fan, shipGeo };
}

// All meshes of a model baked into plain arrays (world transforms applied).
// keep(mesh) = false leaves a mesh out.
function flatten(root, keep = null) {
  root.updateMatrixWorld(true);
  const pos = [], nrm = [], uv = [], idx = [];
  const v = new THREE.Vector3(), nm = new THREE.Matrix3();
  root.traverse(o => {
    if (!o.isMesh || (keep && !keep(o))) return;
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
      bottom: b.y - (m && m.axis === 'y' ? m.amplitude : 0),
      platform: true,
      hx: p.half.x, hz: p.half.z, yaw: p.mesh?.rotation?.y || 0, ref: p, mover: !!m,
    });
  }
  for (const g of level.gates || []) {
    for (const o of g.gate?.options || []) {
      if (!o.pos || !o.half) continue;
      items.push({ x: o.pos.x, z: o.pos.z, r: Math.hypot(o.half.x, o.half.z), top: o.top, bottom: o.top - o.half.y * 2, hx: o.half.x, hz: o.half.z, yaw: o.rotY || 0, ref: o, mover: false });
    }
  }
  if (level.flag?.pos) items.push({ x: level.flag.pos.x, z: level.flag.pos.z, r: 1, top: level.flag.pos.y, bottom: level.flag.pos.y - 1, flag: true });
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

// Lowest walkway top / underside and highest top among the path pieces within `reach` of (x, z).
function pathLevels(items, x, z, reach) {
  let low = Infinity, bottom = Infinity, high = -Infinity;
  for (const it of items) {
    if (Math.hypot(x - it.x, z - it.z) - it.r > reach) continue;
    low = Math.min(low, it.top); bottom = Math.min(bottom, it.bottom ?? it.top - 1); high = Math.max(high, it.top);
  }
  return { low, bottom, high };
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
// reach = false: the keel need not reach the clouds (islets float free).
function addKeel(M, rnd, x, y, z, radius, cloudY, reach = true) {
  const n = 9;
  const depth = Math.max(radius * (1.0 + rnd() * 0.5), reach ? y - cloudY + 3 : 0);
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

// ---- Mid-ground islets (art pass 2) ----
// Small inhabited islands close to the path. Tiles of an islet in tile units (centre at 0, 0):
const ISLET_SHAPES = {
  single: { cells: [[0, 0]], radius: 1.15, keel: 1.0 },
  trio:   { cells: [[-1, -0.577], [1, -0.577], [0, 1.155]], radius: 2.3, keel: 1.6 },
  ring:   { cells: [[0, 0], ...HEX_RING1], radius: 3.15, keel: 2.9 },
};
// theme → shape, tile size range, how far below the walkway the grass lies (min, extra)
const ISLET_THEMES = {
  lookout: { shape: 'trio',   s: [2.5, 2.8], drop: [4.5, 1.0] },
  mill:    { shape: 'trio',   s: [2.7, 3.0], drop: [7.0, 1.0] },
  village: { shape: 'ring',   s: [2.4, 2.7], drop: [6.0, 1.5] },
  hamlet:  { shape: 'trio',   s: [2.5, 3.0], drop: [5.5, 1.5] },
  camp:    { shape: 'trio',   s: [2.4, 2.9], drop: [5.0, 2.0] },
  grove:   { shape: 'single', s: [2.6, 3.6], drop: [5.0, 2.5] },
};

// One islet. (x, top, z) = centre of the grass; (px, pz) = unit vector towards the path.
// Returns what scenery-life.js needs: the mill (sails) and the spectator's spot.
function addIslet(M, lib, rnd, { x, top, z, s, theme, cloudY, px, pz }) {
  const P = lib.pieces;
  const shape = ISLET_SHAPES[ISLET_THEMES[theme].shape];
  const turn = Math.floor(rnd() * 6) * Math.PI / 3;          // islets are not all aligned
  const c = Math.cos(turn), sn = Math.sin(turn);
  const tiles = shape.cells.map(([cx, cz], i) => {
    const drop = (shape === ISLET_SHAPES.ring && i === 0) ? 0 : rnd() * 0.22 * s;
    const t = { x: x + (cx * c + cz * sn) * s, y: top - drop, z: z + (-cx * sn + cz * c) * s };
    M.add(P.hex_grass, t.x, t.y, t.z, s, turn);
    return t;
  });
  // tiles sorted by how close they are to the path: [0] faces the walkway
  const facing = [...tiles].sort((a, b) => ((b.x - x) * px + (b.z - z) * pz) - ((a.x - x) * px + (a.z - z) * pz));
  const toPath = Math.atan2(px, pz);
  const anyYaw = () => rnd() * Math.PI * 2;
  // a prop on a tile; (ox, oz) in tile units from the tile centre, k = size factor
  const put = (name, t, ox = 0, oz = 0, k = 1, yaw = anyYaw()) => M.add(P[name], t.x + ox * s, t.y, t.z + oz * s, s * k, yaw);
  const scatter = (name, t, n, k, spread = 0.55) => {
    for (let i = 0; i < n; i++) {
      const a = anyYaw(), d = 0.15 + rnd() * spread;
      put(name, t, Math.cos(a) * d, Math.sin(a) * d, k * (0.85 + rnd() * 0.3));
    }
  };
  const out = { mill: null, spot: null };

  if (theme === 'lookout') {
    // the tile facing the path stays clear: a spectator stands there
    const t = facing[0];
    out.spot = { x: t.x + px * 0.45 * s, y: t.y, z: t.z + pz * 0.45 * s };
    put('banner_yellow_full', t, -pz * 0.6, px * 0.6, 1.6, toPath);
    put('tent', facing[1], 0, 0, 1.5, toPath);
    put('haybale', facing[1], pz * 0.62, -px * 0.62, 1.3);
    put('tree_single_B', facing[2], 0.1, 0.1, 0.9);
    put('flag_yellow', facing[2], -0.5, 0.3, 2.4);
    put('rock_single_B', facing[2], 0.5, -0.4, 1.6);
  } else if (theme === 'mill') {
    const t = facing[1];
    const k = 1.25;
    put(WINDMILL, t, 0, 0, k, toPath);
    out.mill = { x: t.x, y: t.y, z: t.z, s: s * k, yaw: toPath };
    put('building_grain', facing[0], 0, 0, 1, turn);
    scatter('haybale', facing[2], 3, 1.4);
    put('unit_blue_full', facing[2], 0.1, -0.1, 1.3);
    put('tree_single_A', facing[2], -0.55, 0.45, 0.8);
  } else if (theme === 'village') {
    const ring = tiles.slice(1);
    const start = Math.floor(rnd() * 6);
    const at = i => ring[(start + i) % 6];
    put('building_well_blue', tiles[0], 0, 0, 0.9);
    put('unit_blue_full', tiles[0], 0.55, 0.2, 1.2);
    put('unit_blue_full', tiles[0], -0.4, -0.5, 1.2);
    const face = t => Math.atan2(tiles[0].x - t.x, tiles[0].z - t.z);       // houses look at the well
    put('building_home_B_red', at(0), 0, 0, 1, face(at(0)));
    put('building_home_A_blue', at(2), 0, 0, 1.05, face(at(2)));
    put('tree_single_B', at(4), -0.1, 0.2, 1.05);
    put('tree_single_A', at(4), 0.45, -0.3, 0.9);
    put('tree_single_A', at(1), 0, 0.1, 1);
    put('rock_single_B', at(1), 0.45, -0.4, 2);
    put('tree_single_B', at(3), 0.2, 0.1, 0.95);
    scatter('haybale', at(3), 2, 1.4);
    put('horse_A', at(5), 0.2, 0, 1.1);
    put('tree_single_A', at(5), -0.5, 0.35, 0.9);
    put('hill_single_A', at(5), -0.2, -0.5, 1);
  } else if (theme === 'hamlet') {
    put(rnd() < 0.5 ? 'building_home_A_blue' : 'building_home_B_red', facing[1], 0, 0, 1.05, toPath);
    put('tree_single_B', facing[2], 0, 0.1, 1);
    put('tree_single_A', facing[2], 0.5, -0.4, 0.85);
    scatter('haybale', facing[0], 2, 1.4);
    put('unit_blue_full', facing[0], 0, 0, 1.3);
    put('flag_yellow', facing[0], pz * 0.6, -px * 0.6, 2.2);
  } else if (theme === 'camp') {
    put('tent', facing[1], 0, 0, 1.7, toPath);
    put('flag_yellow', facing[1], 0.6, 0.35, 2.4);
    put('horse_A', facing[0], 0.15, 0.1, 1.1);
    put('haybale', facing[0], -0.45, -0.35, 1.4);
    put('tree_single_A', facing[2], 0.1, 0.2, 1);
    put('tree_single_A', facing[2], -0.45, -0.3, 0.8);
    put('rock_single_B', facing[2], 0.5, -0.45, 2);
  } else {   // grove
    const t = tiles[0];
    const pick = rnd();
    if (pick < 0.4) put('trees_A_small', t);
    else if (pick < 0.75) { put('tree_single_B', t, -0.2, 0.1, 1.05); put('tree_single_A', t, 0.45, -0.3, 0.8); put('rock_single_B', t, 0.2, 0.55, 2); }
    else { put('hill_single_A', t, 0, 0, 1.3); put('tree_single_A', t, 0.3, 0.4, 0.9); put('rock_single_B', t, -0.5, -0.3, 1.8); }
  }
  addKeel(M, rnd, x, top - 0.55 * s, z, shape.keel * s, cloudY, false);
  return out;
}

// Two small flags on the start platform's far corners (behind the player at the start). Merged
// into the island mesh, no collider: they stand on the very edge.
function addStartFlags(M, lib, start) {
  const { home, ax, az } = start;
  if (!home) return;
  const c = Math.cos(home.yaw), sn = Math.sin(home.yaw);
  for (const [cx, cz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const lx = cx * (home.hx - 0.25), lz = cz * (home.hz - 0.25);
    const wx = lx * c + lz * sn, wz = -lx * sn + lz * c;
    if (wx * ax + wz * az >= 0) continue;                        // only the two corners at the back
    M.add(lib.pieces.flag_yellow, home.x + wx, home.top, home.z + wz, 3.2, Math.atan2(ax, az) + Math.PI);
  }
}

// The platform the level starts on and the direction the path leaves it (unit vector).
function startOf(items, spawn) {
  let home = null, best = Infinity;
  for (const it of items) {
    if (!it.platform || it.mover) continue;
    const d = Math.hypot(it.x - spawn[0], it.z - spawn[2]);
    if (d < best) { best = d; home = it; }
  }
  if (!home || best > home.r) return { home: null, ax: 0, az: -1 };
  // "ahead" = towards the middle of the nearest other pieces
  let ax = 0, az = 0;
  for (const it of items.filter(it => it !== home).sort((a, b) => Math.hypot(a.x - home.x, a.z - home.z) - Math.hypot(b.x - home.x, b.z - home.z)).slice(0, 4)) {
    ax += it.x - home.x; az += it.z - home.z;
  }
  const l = Math.hypot(ax, az) || 1;
  return { home, ax: ax / l, az: az / l };
}

// Builds the scenery of one level. `level` is the loaded level (platforms, gates, flag, spawn);
// sky = resolved sky values (sky-presets.js). Returns { update(dt), dispose(), info }.
export async function buildScenery(scene, level, { cloudY, sky, seed = 'level' }) {
  const lib = await preloadScenery();
  const rnd = seededRandom(String(seed));
  const items = pathItems(level);
  const group = new THREE.Group();
  group.name = 'scenery';
  const info = { islands: [], islets: [], landmark: null, puffs: 0, shadows: 0, life: null };
  if (!items.length) return { update() {}, dispose() {}, info };

  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, minTop = Infinity, maxTop = -Infinity;
  for (const it of items) {
    minX = Math.min(minX, it.x - it.r); maxX = Math.max(maxX, it.x + it.r);
    minZ = Math.min(minZ, it.z - it.r); maxZ = Math.max(maxZ, it.z + it.r);
    minTop = Math.min(minTop, it.top); maxTop = Math.max(maxTop, it.top);
  }
  const inBox = (pad) => [minX - pad + rnd() * (maxX - minX + 2 * pad), minZ - pad + rnd() * (maxZ - minZ + 2 * pad)];

  // ---- Islands + landmark: one merged mesh ----
  // The far layer (islands, castle) is one mesh. The islets are merged per CHUNK × CHUNK cell
  // of the map, so the renderer can skip the cells behind the camera or out of view.
  const M = new Merger();
  const mergers = new Map();
  const cellOf = (x, z) => {
    const key = Math.floor(x / CHUNK) + ':' + Math.floor(z / CHUNK);
    if (!mergers.has(key)) mergers.set(key, new Merger());
    return mergers.get(key);
  };
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
    const maxGap = info.islands.length < ISLANDS_NEAR ? 48 : 115;
    if (gap < ISLAND_CLEAR || gap > maxGap) continue;
    if (placed.some(o => Math.hypot(o.x - x, o.z - z) < o.r + r + 12)) continue;
    const top = islandTop(near.top, ISLAND_DROP + rnd() * 4);
    addIsland(M, lib, rnd, { x, top, z, s, rings: 1, cloudY, centre: centres[Math.floor(rnd() * centres.length)] });
    placed.push({ x, z, r, top });
    info.islands.push({ x, y: top, z, r, gap });
  }

  // ---- Mid-ground islets: 10–22 units from the path, grass well below the walkway ----
  // (own random stream, so the far layer above is the same as in art pass 1)
  const rnd2 = seededRandom(String(seed) + ':near');
  const plats = items.filter(it => it.platform);
  const span = Math.max(maxX - minX, maxZ - minZ) + 0.5 * Math.min(maxX - minX, maxZ - minZ);
  const isletCount = Math.max(7, Math.min(16, Math.round(span / 12)));
  const themes = [];
  const want = { lookout: isletCount >= 10 ? 3 : 2, mill: isletCount >= 10 ? 2 : 1, village: isletCount >= 12 ? 2 : 1,
    hamlet: Math.round(isletCount / 6), camp: Math.round(isletCount / 6) };
  for (const [t, n] of Object.entries(want)) for (let i = 0; i < n; i++) themes.push(t);
  while (themes.length < isletCount) themes.push('grove');
  // the start of a level shows a spectator and a windmill; the rest is shuffled
  const rest = themes.filter((t, i) => i !== themes.indexOf('lookout') && i !== themes.indexOf('mill'));
  for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(rnd2() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
  const order = ['lookout', 'mill', ...rest].slice(0, isletCount);
  const mills = [], spots = [];
  const start = startOf(items, level.spawn || [0, 0, 0]);
  order.forEach((theme, k) => {
    const T = ISLET_THEMES[theme], shape = ISLET_SHAPES[T.shape];
    // islet k belongs to the k-th stretch of the path, so they are spread along the level
    const from = Math.floor(k * plats.length / isletCount);
    let to = Math.max(from + 1, Math.floor((k + 1) * plats.length / isletCount));
    if (k < 2) to = Math.max(to, Math.ceil(plats.length * 0.3));
    const maxTries = theme === 'lookout' ? 240 : 80;
    for (let tries = 0; tries < maxTries; tries++) {
      const it = plats[Math.min(plats.length - 1, from + Math.floor(rnd2() * (to - from)))];
      const s = T.s[0] + rnd2() * (T.s[1] - T.s[0]), r = shape.radius * s;
      const a = rnd2() * Math.PI * 2;
      // Inhabited islets (look-out, camp) keep 13+ units: at 10–11 they read as standing right
      // next to an answer block even though they are far below (owner review 2026-11-22).
      const gapMin = (theme === 'lookout' || theme === 'camp') ? 13 : ISLET_GAP_MIN;
      const off = gapMin + 0.5 + rnd2() * (theme === 'lookout' ? 2.5 : 9);
      const x = it.x + Math.cos(a) * (it.r + r + off), z = it.z + Math.sin(a) * (it.r + r + off);
      const gap = nearestPath(items, x, z).gap - r;
      if (gap < gapMin || gap > (theme === 'lookout' ? 17 : ISLET_GAP_MAX)) continue;
      if (placed.some(o => Math.hypot(o.x - x, o.z - z) < o.r + r + 3)) continue;
      // the first two (spectator, windmill) are in view from the start, not behind the player
      if (k < 2 && start.home && tries < maxTries * 0.8) {
        const fx = x - start.home.x, fz = z - start.home.z;
        const ahead = fx * start.ax + fz * start.az, side = Math.abs(fx * start.az - fz * start.ax);
        if (ahead < 5 || ahead > 38 || side > (ahead + 7) * 0.85) continue;
      }
      // below the LOWEST walkway nearby, so nothing on it can stand in front of the path
      const low = pathLevels(items, x, z, gap + r + 14).low;
      const top = Math.max(cloudY + ISLET_FLOOR, low - T.drop[0] - rnd2() * T.drop[1]);
      // unit vector towards the nearest path piece
      let px = 0, pz = 1, best = Infinity;
      for (const o of items) {
        const d = Math.hypot(o.x - x, o.z - z) - o.r;
        if (d < best) { best = d; const l = Math.hypot(o.x - x, o.z - z) || 1; px = (o.x - x) / l; pz = (o.z - z) / l; }
      }
      const made = addIslet(cellOf(x, z), lib, rnd2, { x, top, z, s, theme, cloudY, px, pz });
      if (made.mill) mills.push(made.mill);
      if (made.spot) spots.push(made.spot);
      placed.push({ x, z, r, top, islet: true });
      info.islets.push({ x, y: top, z, r, gap, theme });
      break;
    }
  });
  if (start.home) addStartFlags(cellOf(start.home.x, start.home.z), lib, start);

  lib.islandMat.map = lib.islandMat.emissiveMap = lib.textures[sky.season] || lib.textures.summer;
  const islandGeos = [M.build()];
  const islands = new THREE.Mesh(islandGeos[0], lib.islandMat);
  islands.frustumCulled = false;
  islands.matrixAutoUpdate = false;
  group.add(islands);
  // `extras` = everything art pass 2 added; hidden on devices that are too slow (see setLite)
  const extras = new THREE.Group();
  extras.name = 'scenery-extras';
  group.add(extras);
  for (const m of mergers.values()) {
    const geo = m.build();
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, lib.islandMat);
    mesh.matrixAutoUpdate = false;
    extras.add(mesh);
    islandGeos.push(geo);
  }
  info.chunks = mergers.size;

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
      puffs[kind].push({ x, y, z, s, sy: 0.75 + rnd() * 0.3, yaw: rnd() * Math.PI * 2, phase: rnd() * Math.PI * 2, speed: 0.04 + rnd() * 0.05, ax: PUFF_SWAY, az: 0 });
      n++;
    }
  }
  const basePuffs = { big: puffs.big.length, small: puffs.small.length };   // art pass 1's puffs come first
  // Close puffs (art pass 2). They drift a long way, slowly, and may pass UNDER the path:
  // every one stays below the lowest walkway it can come near (checked along its whole drift).
  const nearItem = () => plats[Math.floor(rnd2() * plats.length)];
  const closeLayers = [
    // under and right beside the path; top at least 5 below the underside of the pieces
    { n: 10, gap: [-2, 12], s: [2.6, 4.2], drift: [7, 13], kind: 'small', y: (lv, half) => lv.bottom - 5 - half - rnd2() * 2.5 },
    // beside the path, between the deck and the walkway
    { n: 10, gap: [9, 22], s: [2.2, 4.2], drift: [5, 10], kind: 'small', y: (lv, half) => cloudY + 2 + rnd2() * Math.max(0.5, lv.low - 3.5 - half - (cloudY + 2)) },
    // a few big mounds rising out of the deck: what you see between two platforms
    // (mostly sunk in the deck; the top stays 2.5 below the walkway)
    { n: 5, gap: [14, 40], s: [10, 15], drift: [4, 8], kind: 'mound', sunk: true, y: (lv, half) => Math.min(cloudY + 0.5 + rnd2() * 3.5, lv.low - 2.5 - half) },
  ];
  for (const L of closeLayers) {
    for (let n = 0, tries = 0; n < L.n && tries < 300; tries++) {
      const it = nearItem();
      const s = L.s[0] + rnd2() * (L.s[1] - L.s[0]), sy = 0.7 + rnd2() * 0.3;
      const kind = L.kind === 'mound' ? 'small' : (rnd2() < 0.12 ? 'big' : 'small');   // cloud_big has twice the triangles
      const rad = (kind === 'big' ? 1.8 : 1.2) * s, half = (kind === 'big' ? 1.0 : 0.93) * s * sy;
      const a = rnd2() * Math.PI * 2, d = it.r + L.gap[0] + rnd2() * (L.gap[1] - L.gap[0]);
      const x = it.x + Math.cos(a) * d, z = it.z + Math.sin(a) * d;
      const amp = L.drift[0] + rnd2() * (L.drift[1] - L.drift[0]), da = rnd2() * Math.PI * 2;
      const ax = Math.cos(da) * amp, az = Math.sin(da) * amp;
      let lv = { low: Infinity, bottom: Infinity }, ok = true;
      for (const f of [-1, -0.5, 0, 0.5, 1]) {
        const qx = x + ax * f, qz = z + az * f;
        const q = pathLevels(items, qx, qz, rad + (L.sunk ? 14 : 2));
        lv.low = Math.min(lv.low, q.low); lv.bottom = Math.min(lv.bottom, q.bottom);
        if (L.gap[0] >= 9 && nearestPath(items, qx, qz).gap - rad < 7) ok = false;
        // not through an island, an islet or the castle
        if (placed.some(o => Math.hypot(o.x - qx, o.z - qz) < o.r + rad * 0.8)) ok = false;
      }
      if (!ok) continue;
      if (lv.low === Infinity) lv = pathLevels(items, x, z, 1e9);
      const y = L.sunk ? L.y(lv, half) : Math.max(cloudY + 0.3, L.y(lv, half));
      if (lv.bottom !== Infinity && y + half > lv.bottom - 4 && L.gap[0] < 9) continue;   // no room under this stretch
      puffs[kind].push({ x, y, z, s, sy, yaw: rnd2() * Math.PI * 2, phase: rnd2() * Math.PI * 2, speed: 0.035 + rnd2() * 0.035, ax, az });
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
    puffMeshes.push({ mesh, list, base: basePuffs[kind] });
    info.puffs += list.length;
  }
  let time = 0;
  function placePuffs() {
    for (const { mesh, list } of puffMeshes) {
      for (let i = 0; i < mesh.count; i++) {
        const p = list[i];
        const w = Math.sin(time * p.speed + p.phase);
        dummy.position.set(p.x + w * p.ax, p.y + Math.sin(time * p.speed * 2.3 + p.phase) * 0.4, p.z + w * p.az);
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

  // ---- Life: windmill sails, cloud ships, balloons, birds, spectators (scenery-life.js) ----
  let life = null;
  try {
    life = buildLife(extras, {
      lib, rnd: rnd2, items, placed, mills, spots, cloudY, sky,
      landmark: info.landmark, plats,
      nearestPath: (x, z) => nearestPath(items, x, z),
      pathLevels: (x, z, reach) => pathLevels(items, x, z, reach),
    });
    info.life = life.info;
  } catch (e) {
    console.warn('[krabsy3d] scenery life failed', e);
  }

  scene.add(group);

  // Too slow for the extras (software rendering, very old machines): keep art pass 1 only.
  let slowFor = 0, smooth = 1 / 60;
  function setLite() {
    liteMode = true;
    info.lite = true;
    extras.visible = false;
    for (const p of puffMeshes) p.mesh.count = p.base;
    shadows.count = shadowItems.length + placed.filter(o => !o.islet).length;   // islets come last
  }
  if (liteMode) setLite();

  return {
    info,
    // playerPos: the spectators look at the player
    update(dt, playerPos) {
      time += dt;
      placePuffs();
      if (!liteMode) {
        life?.update(dt, time, playerPos);
        if (!FORCE_FULL && time > 1.5) {
          smooth += (dt - smooth) * 0.1;
          slowFor = smooth > LITE_BELOW ? slowFor + dt : 0;
          if (slowFor > LITE_AFTER) setLite();
        }
      }
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
      life?.dispose();
      for (const g of islandGeos) g.dispose();
      for (const { mesh } of puffMeshes) mesh.dispose();   // frees the instance buffers; geometry + material are shared
      shadows.dispose();
    },
  };
}
