// The KayKit models of the rooms (assets/models/, list + credits in its README.md).
// loadModels() loads them all once; clones share geometry and materials.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const BASE = new URL('../assets/models/', import.meta.url).href;
export const MODEL_NAMES = [
  'dirt_with_grass', 'stone', 'wood', 'bricks_A', 'bricks_B', 'stone_dark',
  'wall', 'wall_window_closed', 'wall_arched', 'wall_cracked',
  'torch_mounted', 'banner_patternA_red', 'banner_shield_blue', 'barrel_large', 'crates_stacked',
  'box_small', 'key', 'ladder', 'arch_gate', 'chain_full', 'floor_wood_1x1',
  'stone_with_copper', 'rubble_large', 'chain_link',
  'shield_badge_color', 'arrow_crossbow',
  'lever_floor_base_yellow', 'button_base_red', 'button_base_yellow', 'lever_wall_base_A_blue',
  'signage_arrow_stand_yellow', 'hoop_yellow',
];

let cache = null;
export function loadModels() {
  if (!cache) {
    const loader = new GLTFLoader();
    cache = Promise.all(MODEL_NAMES.map((n) => loader.loadAsync(`${BASE}${n}.gltf`).then((g) => [n, g.scene])))
      .then((entries) => new Models(new Map(entries)));
  }
  return cache;
}

class Models {
  constructor(map) {
    this.map = map;
    for (const s of map.values()) s.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  }
  /** A clone of the whole model (shared geometry + materials). */
  clone(name) { return this.map.get(name).clone(true); }
  /** A clone of one named node of a model (e.g. one gate leaf). */
  part(name, node) {
    let found = null;
    this.map.get(name).traverse((o) => { if (!found && o.name === node) found = o; });
    const c = found.clone(true);
    c.position.set(0, 0, 0);
    return c;
  }
  /** Geometry (node transforms baked in) + material of a single-mesh model, for instancing. */
  mesh(name) {
    const root = this.map.get(name);
    root.updateMatrixWorld(true);
    let m = null;
    root.traverse((o) => { if (!m && o.isMesh) m = o; });
    const geometry = m.geometry.clone().applyMatrix4(m.matrixWorld);
    return { geometry, material: m.material };
  }
}

/**
 * Wrap obj so it fills a box w × h × d (any of them null = keep the proportions of the
 * first given size), centred in x/z, standing on y = 0. Returns the wrapper group.
 */
export function fit(obj, w, h, d) {
  const g = new THREE.Group();
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const ref = w != null ? w / size.x : h != null ? h / size.y : d / size.z;
  const sx = w != null ? w / size.x : ref, sy = h != null ? h / size.y : ref, sz = d != null ? d / size.z : ref;
  const c = box.getCenter(new THREE.Vector3());
  obj.position.set(-c.x, -box.min.y, -c.z);
  const inner = new THREE.Group();
  inner.add(obj);
  inner.scale.set(sx, sy, sz);
  g.add(inner);
  return g;
}

/** Geometry normalised to a 1 × 1 × 1 cube around the origin (ground blocks). */
export function unitGeometry(geometry) {
  const geo = geometry.clone();
  geo.computeBoundingBox();
  const b = geo.boundingBox, c = b.getCenter(new THREE.Vector3());
  const s = Math.max(b.max.y - b.min.y, 1e-6);   // blocks are 2 tall; the grass drips stick out sideways
  geo.translate(-c.x, -c.y, -c.z);
  geo.scale(1 / s, 1 / s, 1 / s);
  return geo;
}
