// Multi-pack krabsy-level loader — reconstructs an authored room exactly per
// the brief's §5–§7. A level JSON stores no world positions; Y, XZ, footprint
// anchoring and the built-in wall/ground offsets are recomputed here.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const MODELS_BASE = 'assets/models/';
const gltfLoader = new GLTFLoader();

const templates = new Map();   // "pack/name" → Object3D (resolved template)
const loading   = new Map();   // "pack/name" → Promise<Object3D>
const measures  = new Map();   // "pack/name" → {height, minY, sizeX, sizeZ}

const key = (pack, name) => pack + '/' + name;

// ── per-model rules (NOT in the JSON), brief §6 ──────────────────────────
const RESTAURANT_FP = { floor_kitchen: [2, 2], floor_kitchen_styleB: [2, 2] };
const GROUND = new Set([
  'floor_kitchen', 'floor_kitchen_styleB',
  'floor_kitchen_small', 'floor_kitchen_small_styleB',
  'tile_white', 'tile_black', 'tile_brown_light', 'tile_brown_dark',
]);
const WALL_PLACE = { x: -1, y: 0, z: -0.5 };
const WALL = new Set([
  'door_A', 'door_B', 'wall', 'wall_doorway', 'wall_half',
  'wall_decorated', 'wall_decorated_styleB', 'wall_window_open', 'wall_window_closed',
  'wall_window_closed_curtains_red', 'wall_window_closed_curtains_green',
  'wall_orderwindow', 'wall_orderwindow_decorated',
]);
const ZERO = { x: 0, y: 0, z: 0 };

function loadTemplate(pack, name) {
  const k = key(pack, name);
  if (templates.has(k)) return Promise.resolve(templates.get(k));
  if (loading.has(k)) return loading.get(k);
  const url = `${MODELS_BASE}${pack}/${name}.gltf`;
  const p = new Promise((resolve, reject) => {
    gltfLoader.load(url, (gltf) => {
      const tpl = gltf.scene;
      tpl.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
          const m = o.material;
          if (m) {
            m.metalness = 0;
            m.roughness = 0.88;
            if (m.map) {
              m.map.colorSpace = THREE.SRGBColorSpace;
              m.map.magFilter = THREE.NearestFilter;   // KayKit atlases are flat-shaded — keep crisp
            }
          }
        }
      });
      templates.set(k, tpl);
      resolve(tpl);
    }, undefined, (err) => reject(new Error(`load failed: ${url} — ${err?.message || err}`)));
  });
  loading.set(k, p);
  return p;
}

/** Unique (pack, model) pairs a level references, resolving obj.pack || catalog. */
export function collectModels(level) {
  const seen = new Map();
  const def = level.catalog;
  for (const o of level.objects) {
    const pack = o.pack || def;
    seen.set(key(pack, o.model), { pack, name: o.model });
  }
  return [...seen.values()];
}

/** Load every model a level needs, then prime measurement caches. */
export async function preloadLevel(level) {
  const models = collectModels(level);
  await Promise.all(models.map((m) => loadTemplate(m.pack, m.name)));
  for (const m of models) measure(m.pack, m.name);   // cache bboxes
}

/** Local-space bbox of a preloaded template → {height, minY, sizeX, sizeZ}. */
export function measure(pack, name) {
  const k = key(pack, name);
  if (measures.has(k)) return measures.get(k);
  const tpl = templates.get(k);
  if (!tpl) { console.error('[sim-tower] measure before preload:', k); return { height: 0.1, minY: 0, sizeX: 2, sizeZ: 2 }; }
  tpl.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(tpl);
  const m = {
    height: box.max.y - box.min.y,
    minY: box.min.y,
    sizeX: box.max.x - box.min.x,
    sizeZ: box.max.z - box.min.z,
  };
  measures.set(k, m);
  return m;
}

/** Fresh instance of a preloaded model. */
export function getModel(pack, name) {
  const tpl = templates.get(key(pack, name));
  if (!tpl) { console.error('[sim-tower] getModel before preload:', key(pack, name)); return new THREE.Group(); }
  return tpl.clone(true);
}

const packOf = (o, def) => o.pack || def;

function footprint(pack, name, TILE) {
  if (pack === 'restaurant-bits') return RESTAURANT_FP[name] || [1, 1];
  const m = measure(pack, name);
  return [Math.max(1, Math.round(m.sizeX / TILE)), Math.max(1, Math.round(m.sizeZ / TILE))];
}

const rotY = (v, q) => {
  const t = q * Math.PI / 2, c = Math.cos(t), s = Math.sin(t);
  return { x: v.x * c + v.z * s, y: v.y, z: -v.x * s + v.z * c };
};

/**
 * Build a room's Object3D from a krabsy-level (brief §7). Models must already
 * be preloaded (call preloadLevel first). The group is centred on the grid at
 * its own floor Y = 0; the caller lifts/spaces it into the building.
 */
export function buildRoom(level) {
  const TILE = level.grid.tile;
  const { cols, rows } = level.grid;
  const DEFAULT = level.catalog;
  const cellCenter = (c, r) => ({ x: (c - (cols - 1) / 2) * TILE, z: (r - (rows - 1) / 2) * TILE });

  // pass 1 — stack heights (array order matters)
  const tops = new Map();
  const yByObj = new Map();
  for (const o of level.objects) {
    const pk = packOf(o, DEFAULT);
    const [w, d] = footprint(pk, o.model, TILE);
    let base = 0;
    for (let c = o.col; c < o.col + w; c++)
      for (let r = o.row; r < o.row + d; r++)
        base = Math.max(base, tops.get(c + ',' + r) || 0);
    yByObj.set(o, base);
    const top = base + (GROUND.has(o.model) ? 0 : measure(pk, o.model).height);
    for (let c = o.col; c < o.col + w; c++)
      for (let r = o.row; r < o.row + d; r++)
        tops.set(c + ',' + r, top);
  }

  // pass 2 — instantiate
  const roomGroup = new THREE.Group();
  for (const o of level.objects) {
    const pk = packOf(o, DEFAULT);
    const [w, d] = footprint(pk, o.model, TILE);
    const ctr = cellCenter(o.col + (w - 1) / 2, o.row + (d - 1) / 2);
    const yObj = yByObj.get(o);
    const yB = GROUND.has(o.model) ? yObj : yObj - measure(pk, o.model).minY;
    const pl = WALL.has(o.model) ? rotY(WALL_PLACE, o.rot) : ZERO;
    const off = o.off || ZERO;
    const node = getModel(pk, o.model);
    node.position.set(ctr.x + pl.x + off.x, yB + pl.y + off.y, ctr.z + pl.z + off.z);
    node.rotation.set((o.rotX || 0) * Math.PI / 180, o.rot * Math.PI / 2, (o.rotZ || 0) * Math.PI / 180, 'YXZ');
    node.userData.levelObj = o;
    roomGroup.add(node);
  }

  // world-space extents (for camera framing + waypoint derivation)
  roomGroup.userData.grid = level.grid;
  roomGroup.userData.widthX = cols * TILE;
  roomGroup.userData.depthZ = rows * TILE;
  return roomGroup;
}

/** Fetch + parse a level JSON by url. */
export async function loadLevel(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`level fetch ${res.status}: ${url}`);
  return res.json();
}

// ── shared with nav.js (collision) ────────────────────────────────────────
/** Footprint [w,d] in cells for a model (same rule the builder uses). */
export function footprintOf(pack, name, tile) { return footprint(pack, name, tile); }
/** Ground/floor-tile models (laid flush). The prototype `Floor` is separate. */
export { GROUND, WALL };
