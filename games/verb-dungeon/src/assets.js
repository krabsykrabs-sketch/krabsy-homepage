// Model loading. All dungeon models share one texture atlas and one material.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

THREE.Cache.enabled = true; // every dungeon model references the same texture file

const DUNGEON = ['wall', 'wall_half', 'wall_corner', 'wall_doorway', 'wall_cracked', 'wall_shelves',
  'floor_tile_large', 'chest', 'chest_gold', 'torch_mounted',
  'barrel_large', 'barrel_small_stack', 'box_large', 'box_small_decorated', 'crates_stacked',
  'banner_patternA_red', 'banner_shield_blue', 'coin_stack_large', 'coin_stack_small',
  'table_medium_decorated_A', 'chair', 'stool', 'keg_decorated', 'candle_triple',
  'sword_shield_gold', 'trunk_large_A', 'key', 'column', 'pillar_decorated'];

function toLambert(root) {
  const swapped = new Map();
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (!swapped.has(o.material)) {
      const s = o.material;
      swapped.set(s, new THREE.MeshLambertMaterial({
        map: s.map, color: s.color, emissive: s.emissive, emissiveMap: s.emissiveMap,
        emissiveIntensity: s.emissiveIntensity,
      }));
    }
    o.material = swapped.get(o.material);
    o.castShadow = true; o.receiveShadow = true;
  });
}

export const Assets = {
  models: new Map(),
  material: null,
  clips: {},

  async load(onProgress) {
    const loader = new GLTFLoader();
    const chars = ['characters/Knight.glb', 'characters/Skeleton_Minion.glb',
      'characters/anim_medium.glb', 'characters/sword_1handed.gltf', 'characters/shield_round.gltf'];
    let done = 0;
    const total = DUNGEON.length + chars.length;
    const tick = (v) => { done += 1; if (onProgress) onProgress(done / total); return v; };

    const jobs = DUNGEON.map((name) => loader.loadAsync(`assets/dungeon/${name}.gltf`)
      .then((g) => { this.models.set(name, g.scene); tick(); }));
    const [knight, skel, anim, sword, shield] = await Promise.all(
      chars.map((f) => loader.loadAsync(`assets/${f}`).then(tick)));
    await Promise.all(jobs);

    for (const sc of this.models.values()) {
      sc.traverse((o) => {
        if (!o.isMesh) return;
        if (!this.material) this.material = new THREE.MeshLambertMaterial({ map: o.material.map });
        o.material = this.material; o.castShadow = true; o.receiveShadow = true;
      });
      sc.updateMatrixWorld(true);
    }
    for (const g of [knight, skel, sword, shield]) toLambert(g.scene);
    for (const a of anim.animations) this.clips[a.name] = a;
    // Arms + chest part of the sword chop, played on top of running/idle (main.js bonk()).
    // Track names are '<bone>.quaternion'; GLTFLoader drops the dot in 'upperarm.r'.
    const UPPER = /^(chest|upperarm[lr]|lowerarm[lr]|wrist[lr]|hand[lr]|handslot[lr])\./;
    const chop = this.clips.Melee_1H_Attack_Chop;
    this.clips.ChopUpper = new THREE.AnimationClip('ChopUpper', chop.duration,
      chop.tracks.filter((tr) => UPPER.test(tr.name)));
    this.knight = knight.scene; this.skeleton = skel.scene;
    this.sword = sword.scene; this.shield = shield.scene;
  },

  clone(name) {
    const src = this.models.get(name);
    if (!src) throw new Error(`Unknown model: ${name}`);
    return src.clone(true);
  },

  // Merge many static placements into one mesh (one draw call).
  // items: [{ name, x, z, y, rot }]
  mergeStatic(items) {
    const geos = [];
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    const pos = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
    for (const it of items) {
      const src = this.models.get(it.name);
      if (!src) throw new Error(`Unknown model: ${it.name}`);
      m.compose(pos.set(it.x, it.y || 0, it.z), q.setFromAxisAngle(up, it.rot || 0), one);
      src.traverse((o) => {
        if (!o.isMesh) return;
        let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
        for (const key of Object.keys(g.attributes)) {
          if (!['position', 'normal', 'uv'].includes(key)) g.deleteAttribute(key);
        }
        g.applyMatrix4(o.matrixWorld).applyMatrix4(m);
        geos.push(g);
      });
    }
    const merged = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    if (!merged) throw new Error('Static merge failed');
    const mesh = new THREE.Mesh(merged, this.material);
    mesh.castShadow = true; mesh.receiveShadow = true;
    return mesh;
  },
};
