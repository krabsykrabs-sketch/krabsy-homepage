// Models: KayKit Medieval Hexagon props (one shared texture atlas, one material) and
// KayKit skeletons (one animation rig file). See assets/CREDITS.md (CC0).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

THREE.Cache.enabled = true; // every medieval model references the same texture file

export const MEDIEVAL = ['catapult', 'projectile_cannonball', 'crate_A_big', 'barrel', 'haybale', 'resource_lumber', 'tree_single_A', 'tree_single_B', 'trees_A_medium', 'trees_B_small', 'rock_single_A', 'rock_single_C', 'hill_single_A', 'hills_A_trees', 'cloud_big', 'cloud_small', 'fence_wood_straight', 'flag_red', 'tent', 'wheelbarrow', 'cannonball_pallet', 'bucket_empty'];
const CHARS = ['Skeleton_Minion', 'Skeleton_Warrior'];

export const Assets = {
  models: new Map(),
  material: null,     // the shared atlas material (Lambert)
  chars: {},          // skeleton templates
  clips: {},          // name → AnimationClip (medium rig)
  skelHeight: 1,      // model units from feet to the top of the head

  async load(onProgress) {
    const loader = new GLTFLoader();
    const total = MEDIEVAL.length + CHARS.length + 1;
    let done = 0;
    const tick = (v) => { done += 1; if (onProgress) onProgress(done / total); return v; };
    const props = Promise.all(MEDIEVAL.map((n) => loader.loadAsync(`assets/medieval/${n}.gltf`)
      .then((g) => { this.models.set(n, g.scene); tick(); })));
    const chars = Promise.all(CHARS.map((n) => loader.loadAsync(`assets/characters/${n}.glb`)
      .then((g) => { this.chars[n] = g.scene; tick(); })));
    const anim = loader.loadAsync('assets/characters/anim_medium.glb').then(tick);
    const [, , a] = await Promise.all([props, chars, anim]);

    for (const sc of this.models.values()) {
      sc.traverse((o) => {
        if (!o.isMesh) return;
        if (!this.material) this.material = new THREE.MeshLambertMaterial({ map: o.material.map });
        o.material = this.material; o.castShadow = true; o.receiveShadow = true;
      });
      sc.updateMatrixWorld(true);
    }
    for (const sc of Object.values(this.chars)) {
      const swapped = new Map();
      sc.traverse((o) => {
        if (!o.isMesh) return;
        if (!swapped.has(o.material)) swapped.set(o.material, new THREE.MeshLambertMaterial({ map: o.material.map, color: o.material.color }));
        o.material = swapped.get(o.material); o.castShadow = true;
      });
    }
    for (const c of a.animations) this.clips[c.name] = c;
    const box = new THREE.Box3().setFromObject(this.chars.Skeleton_Minion);
    this.skelHeight = box.max.y - box.min.y;
  },

  clone(name) {
    const src = this.models.get(name);
    if (!src) throw new Error(`Unknown model: ${name}`);
    return src.clone(true);
  },

  // A model stretched to fill a w × h × d box centred on the origin.
  // rotZ turns it first (a long crate standing up as a pillar).
  fit(name, w, h, d, { rotX = 0, rotZ = 0, rotY = 0, material } = {}) {
    const inner = this.clone(name);
    const pivot = new THREE.Group(); pivot.add(inner);
    pivot.rotation.set(rotX, rotY, rotZ);
    pivot.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(pivot), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    const fit = new THREE.Group(); fit.add(pivot);
    fit.scale.set(w / size.x, h / size.y, d / size.z);
    fit.position.set(-c.x * fit.scale.x, -c.y * fit.scale.y, -c.z * fit.scale.z);
    if (material) inner.traverse((o) => { if (o.isMesh) o.material = material; });
    const out = new THREE.Group(); out.add(fit);
    return out;
  },
};
