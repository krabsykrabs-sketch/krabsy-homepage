// GLTF loading + caching. All Restaurant Bits share one atlas material, so
// static level geometry merges into a single draw call (see world.js); Tiny
// Treats props add one material (and one merged mesh) per atlas.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import { withRetry } from './retry.js';

export const TILE = 2;               // KayKit counters are 2×2 world units

const loader = new GLTFLoader();
const cache = new Map();             // url → Promise<gltf>

export function loadGLTF(url) {
  if (!cache.has(url)) {
    const p = withRetry(() => loader.loadAsync(url), url);
    cache.set(url, p);
    // a download that failed every attempt must not stay cached, so the
    // "Try again" button on the recipe card really downloads it again
    p.catch(() => { if (cache.get(url) === p) cache.delete(url); });
  }
  return cache.get(url);
}

const R = 'assets/models/restaurant/';
// Tiny Treats props (CC0, Isa Lousberg): model names carry a `tt_` prefix and
// load from their own folder. They use two atlases of their own (kitchen /
// picnic / plants share one, baked goods has another), so every atlas gets ONE
// shared material — the KayKit one (`sharedMat`) is never touched by them.
const TT = 'assets/models/tinytreats/';
const modelUrl = (n) => (n.startsWith('tt_') ? TT + n.slice(3) : R + n) + '.gltf';
const restaurantCache = new Map();   // name → THREE.Object3D (template)
let sharedMat = null;                // the KayKit atlas material (first one loaded)
const atlasMats = new Map();         // atlas image uri → shared material
const mergeable = new Set();         // every shared atlas material (static merge)
const tintCache = new Map();         // material uuid + tint → tinted clone

/** One shared, flat-looking material per texture atlas. */
function atlasMaterial(gltf, loaded) {
  const key = gltf.parser?.json?.images?.[0]?.uri || 'none';
  let mat = atlasMats.get(key);
  if (!mat) {
    // Tiny Treats materials arrive as MeshPhysicalMaterial (specular / ior
    // extensions) — give them the same plain standard material as KayKit
    mat = loaded.isMeshPhysicalMaterial
      ? new THREE.MeshStandardMaterial({ map: loaded.map, name: loaded.name })
      : loaded;
    mat.metalness = 0;
    mat.roughness = 0.9;
    if (mat.map) {
      mat.map.colorSpace = THREE.SRGBColorSpace;
      mat.map.magFilter = THREE.NearestFilter;
    }
    atlasMats.set(key, mat);
    mergeable.add(mat);
    if (!sharedMat && !key.startsWith('tiny_treats')) sharedMat = mat;
  }
  return mat;
}

export async function preloadRestaurant(names) {
  await Promise.all([...new Set(names)].map(async (n) => {
    if (restaurantCache.has(n)) return;
    const gltf = await loadGLTF(modelUrl(n));
    const tpl = gltf.scene;
    tpl.traverse((o) => {
      if (o.isMesh) {
        o.material = atlasMaterial(gltf, o.material);
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    restaurantCache.set(n, tpl);
  }));
}

/** Clone of a preloaded model. tint swaps in a tinted copy of its atlas material. */
export function getModel(name, tint = null) {
  const tpl = restaurantCache.get(name);
  if (!tpl) { console.error('[VK] model not preloaded:', name); return new THREE.Group(); }
  const obj = tpl.clone(true);
  if (tint) {
    obj.traverse((o) => {
      if (!o.isMesh) return;
      const key = o.material.uuid + tint;
      let tinted = tintCache.get(key);
      if (!tinted) {
        tinted = o.material.clone();
        tinted.color = new THREE.Color(tint);
        tintCache.set(key, tinted);
      }
      o.material = tinted;
    });
  }
  return obj;
}

export function hasModel(name) { return restaurantCache.has(name); }

const boxCache = new Map();
/** Cached bounding box of a preloaded model's template (local space). */
export function measureModel(name) {
  if (!boxCache.has(name)) {
    const tpl = restaurantCache.get(name);
    if (!tpl) return { height: 0.1, radius: 0.3 };
    const box = new THREE.Box3().setFromObject(tpl);
    boxCache.set(name, {
      height: box.max.y - box.min.y,
      radius: Math.max(box.max.x - box.min.x, box.max.z - box.min.z) / 2,
      minY: box.min.y,
    });
  }
  return boxCache.get(name);
}

/** Merge all static meshes of a group into one mesh per atlas material (one
 *  draw call each: KayKit, plus one per Tiny Treats atlas the level uses). */
export function mergeStatic(group, BufferGeometryUtils) {
  group.updateMatrixWorld(true);
  const byMat = new Map();           // atlas material → geometries
  const tinted = [];                 // tinted meshes keep their own draw call
  group.traverse((o) => {
    if (!o.isMesh) return;
    if (mergeable.has(o.material)) {
      const g = o.geometry.clone();
      g.applyMatrix4(o.matrixWorld);
      // drop attributes that differ between kit pieces so merge succeeds
      for (const key of Object.keys(g.attributes)) {
        if (key !== 'position' && key !== 'normal' && key !== 'uv') g.deleteAttribute(key);
      }
      if (!byMat.has(o.material)) byMat.set(o.material, []);
      byMat.get(o.material).push(g);
    } else {
      tinted.push(o);
    }
  });
  const out = new THREE.Group();
  for (const [mat, geos] of byMat) {
    const merged = BufferGeometryUtils.mergeGeometries(geos, false);
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    out.add(mesh);
  }
  for (const m of tinted) {
    m.updateMatrixWorld(true);
    const clone = m.clone();
    clone.matrix.copy(m.matrixWorld);
    clone.matrix.decompose(clone.position, clone.quaternion, clone.scale);
    out.add(clone);
  }
  return out;
}

// ---- chef + animations ----
const C = 'assets/models/chef/';

// Playable characters (KayKit Adventurers, all share the Rig_Medium clips).
// `cost` = TOTAL stars needed to unlock (threshold; stars are never spent).
// Rogue is the free starter; the rest unlock as you earn stars. Costs are
// PLACEHOLDERS — tune as more levels/characters are added. Order = cost order.
export const CHEF_CHARACTERS = {
  rogue:     { file: 'Rogue.glb',     emoji: '🗡️', name: 'Rogue',     cost: 0 },
  ranger:    { file: 'Ranger.glb',    emoji: '🏹', name: 'Ranger',    cost: 3 },
  knight:    { file: 'Knight.glb',    emoji: '🛡️', name: 'Knight',    cost: 6 },
  mage:      { file: 'Mage.glb',      emoji: '🧙', name: 'Mage',      cost: 9 },
  barbarian: { file: 'Barbarian.glb', emoji: '🪓', name: 'Barbarian', cost: 12 },
};

/** Total stars earned across all levels (best per level summed). */
export function totalStars(save) {
  return Object.values((save && save.stars) || {}).reduce((a, b) => a + (b || 0), 0);
}
/** A character is unlocked once your total stars reach its cost (threshold). */
export function charUnlocked(name, save) {
  const def = CHEF_CHARACTERS[name];
  return !!def && totalStars(save) >= (def.cost || 0);
}

/** Load one character + the shared animation clips (everything is cached). */
export async function loadChefAssets(charName = 'rogue') {
  const def = CHEF_CHARACTERS[charName] || CHEF_CHARACTERS.rogue;
  // Rig_Medium_Kitchen.glb = only the 6 clips chef.js plays (Idle_A, Running_A,
  // Chopping, PickUp, Holding_B, Working_A), cut from the three KayKit
  // Rig_Medium_* files (3 MB) to 0.3 MB for a faster first load on phones.
  // Rebuild with tools/slim-rig.mjs when chef.js needs another clip.
  const [char, rig] = await Promise.all([
    loadGLTF(C + def.file),
    loadGLTF(C + 'Rig_Medium_Kitchen.glb'),
  ]);
  const clips = {};
  for (const c of rig.animations) clips[c.name] = c;
  return { charScene: char.scene, clips };
}

export function cloneChef(charScene) {
  const obj = skeletonClone(charScene);
  obj.traverse((o) => {
    if (o.isMesh || o.isSkinnedMesh) { o.castShadow = true; o.frustumCulled = false; }
  });
  return obj;
}
