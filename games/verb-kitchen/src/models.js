// GLTF loading + caching. All Restaurant Bits share one atlas material, so
// static level geometry merges into a single draw call (see level.js).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';

export const TILE = 2;               // KayKit counters are 2×2 world units

const loader = new GLTFLoader();
const cache = new Map();             // url → Promise<gltf>

export function loadGLTF(url) {
  if (!cache.has(url)) {
    cache.set(url, new Promise((resolve, reject) => {
      loader.load(url, resolve, undefined, reject);
    }));
  }
  return cache.get(url);
}

const R = 'assets/models/restaurant/';
const restaurantCache = new Map();   // name → THREE.Object3D (template)
let sharedMat = null;                // single shared atlas material

export async function preloadRestaurant(names) {
  await Promise.all([...new Set(names)].map(async (n) => {
    if (restaurantCache.has(n)) return;
    const gltf = await loadGLTF(R + n + '.gltf');
    const tpl = gltf.scene;
    tpl.traverse((o) => {
      if (o.isMesh) {
        if (!sharedMat) {
          sharedMat = o.material;
          sharedMat.metalness = 0;
          sharedMat.roughness = 0.9;
          if (sharedMat.map) {
            sharedMat.map.colorSpace = THREE.SRGBColorSpace;
            sharedMat.map.magFilter = THREE.NearestFilter;
          }
        }
        o.material = sharedMat;
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    restaurantCache.set(n, tpl);
  }));
}

/** Clone of a preloaded restaurant model. tint clones the material (rare). */
export function getModel(name, tint = null) {
  const tpl = restaurantCache.get(name);
  if (!tpl) { console.error('[VK] model not preloaded:', name); return new THREE.Group(); }
  const obj = tpl.clone(true);
  if (tint) {
    const tinted = sharedMat.clone();
    tinted.color = new THREE.Color(tint);
    obj.traverse((o) => { if (o.isMesh) o.material = tinted; });
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

/** Merge all static meshes of a group into one mesh (one draw call). */
export function mergeStatic(group, BufferGeometryUtils) {
  group.updateMatrixWorld(true);
  const geos = [];
  const tinted = [];                 // tinted meshes keep their own draw call
  group.traverse((o) => {
    if (!o.isMesh) return;
    if (o.material === sharedMat) {
      const g = o.geometry.clone();
      g.applyMatrix4(o.matrixWorld);
      // drop attributes that differ between kit pieces so merge succeeds
      for (const key of Object.keys(g.attributes)) {
        if (key !== 'position' && key !== 'normal' && key !== 'uv') g.deleteAttribute(key);
      }
      geos.push(g);
    } else {
      tinted.push(o);
    }
  });
  const out = new THREE.Group();
  if (geos.length) {
    const merged = BufferGeometryUtils.mergeGeometries(geos, false);
    const mesh = new THREE.Mesh(merged, sharedMat);
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

export async function loadChefAssets() {
  const [knight, move, general, tools] = await Promise.all([
    loadGLTF(C + 'Knight.glb'),
    loadGLTF(C + 'Rig_Medium_MovementBasic.glb'),
    loadGLTF(C + 'Rig_Medium_General.glb'),
    loadGLTF(C + 'Rig_Medium_Tools.glb'),
  ]);
  const clips = {};
  for (const g of [move, general, tools]) {
    for (const c of g.animations) clips[c.name] = c;
  }
  return { charScene: knight.scene, clips };
}

export function cloneChef(charScene) {
  const obj = skeletonClone(charScene);
  obj.traverse((o) => {
    if (o.isMesh || o.isSkinnedMesh) { o.castShadow = true; o.frustumCulled = false; }
  });
  return obj;
}
