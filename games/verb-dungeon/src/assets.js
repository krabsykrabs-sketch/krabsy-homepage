// Model loading. All dungeon models share one texture atlas and one material.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SWINGS } from './heroes.js';

THREE.Cache.enabled = true; // every dungeon model references the same texture file

const DUNGEON = ['wall', 'wall_half', 'wall_corner', 'wall_doorway', 'wall_cracked', 'wall_shelves',
  'floor_tile_large', 'chest', 'chest_gold', 'torch_mounted',
  'barrel_large', 'barrel_small_stack', 'box_large', 'crates_stacked',
  'banner_patternA_red', 'banner_shield_blue', 'coin_stack_small', // coins: only collectable ones
  'table_medium_decorated_A', 'chair', 'stool', 'keg_decorated', 'candle_triple',
  'sword_shield_gold', 'key', 'column', 'pillar_decorated'];

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

// Upper-body copy of an attack clip, played on top of running/idle (main.js bonk()).
// One per swing in heroes.js SWINGS, named 'Swing_<key>'.
// Only rotations of the spine, chest, head and arms are kept, so the legs stay with the
// base clip. In the source clip half of the sweep comes from the hips turning (~50°);
// the hips belong to the legs here, so their turn (relative to the clip's first frame)
// is folded into the spine track. The blade then sweeps the full arc.
// Track names are '<bone>.quaternion'; GLTFLoader drops the dot in 'upperarm.r'.
function upperBodyClip(src, name) {
  const UPPER = /^(spine|chest|head|upperarm[lr]|lowerarm[lr]|wrist[lr]|hand[lr]|handslot[lr])\.quaternion$/;
  const tracks = src.tracks.filter((tr) => UPPER.test(tr.name)).map((tr) => tr.clone());
  const hips = src.tracks.find((tr) => tr.name === 'hips.quaternion');
  const spine = tracks.find((tr) => tr.name === 'spine.quaternion');
  if (hips && spine) {
    const sample = hips.createInterpolant();
    const rest = new THREE.Quaternion().fromArray(hips.values, 0).invert();
    const h = new THREE.Quaternion(), q = new THREE.Quaternion();
    for (let i = 0; i < spine.times.length; i++) {
      h.fromArray(sample.evaluate(spine.times[i]));
      q.fromArray(spine.values, i * 4).premultiply(h).premultiply(rest).toArray(spine.values, i * 4);
    }
  }
  return new THREE.AnimationClip(name, src.duration, tracks);
}

export const Assets = {
  models: new Map(),
  material: null,
  clips: {},        // medium rig: heroes and skeletons
  clipsLarge: {},   // large rig: the golem
  heroes: {},       // hero id → model
  gear: {},         // weapon / shield name → model

  async load(onProgress) {
    const loader = new GLTFLoader();
    const chars = ['characters/Knight.glb', 'characters/Skeleton_Minion.glb',
      'characters/anim_medium.glb', 'characters/sword_1handed.gltf', 'characters/shield_round.gltf',
      'characters/Skeleton_Golem.glb', 'characters/Skeleton_Rogue.glb', 'characters/anim_large.glb',
      'characters/anim_ranged.glb', 'characters/Skeleton_Crossbow.gltf', 'characters/Skeleton_Arrow.gltf'];
    let done = 0;
    const total = DUNGEON.length + chars.length;
    const tick = (v) => { done += 1; if (onProgress) onProgress(done / total); return v; };

    const jobs = DUNGEON.map((name) => loader.loadAsync(`assets/dungeon/${name}.gltf`)
      .then((g) => { this.models.set(name, g.scene); tick(); }));
    const [knight, skel, anim, sword, shield, golem, rogue, animLarge, animRanged, crossbow, arrow] = await Promise.all(
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
    for (const g of [knight, skel, sword, shield, golem, rogue, crossbow, arrow]) toLambert(g.scene);
    for (const a of [...anim.animations, ...animRanged.animations]) this.clips[a.name] = a; // same rig
    for (const a of animLarge.animations) this.clipsLarge[a.name] = a;                       // the golem's rig
    for (const [key, sw] of Object.entries(SWINGS)) this.clips[`Swing_${key}`] = upperBodyClip(this.clips[sw.clip], `Swing_${key}`);
    this.skeleton = skel.scene; this.golem = golem.scene; this.archer = rogue.scene;
    this.crossbow = crossbow.scene; this.arrow = arrow.scene;
    this.gear.sword_1handed = sword.scene; this.gear.shield_round = shield.scene;
    this.heroes.knight = knight.scene;
  },

  // Hero models and their gear (heroes.js) are loaded when first chosen; the knight
  // comes with the first load.
  async loadHero(def) {
    const loader = new GLTFLoader();
    const jobs = [];
    if (!this.heroes[def.id]) {
      jobs.push(loader.loadAsync(`assets/characters/${def.file}`)
        .then((g) => { toLambert(g.scene); this.heroes[def.id] = g.scene; }));
    }
    for (const name of new Set(def.gear.map((g) => g.model))) {
      if (this.gear[name]) continue;
      jobs.push(loader.loadAsync(`assets/characters/${name}.gltf`)
        .then((g) => { toLambert(g.scene); this.gear[name] = g.scene; }));
    }
    await Promise.all(jobs);
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
    const pos = new THREE.Vector3(), sc = new THREE.Vector3();
    for (const it of items) {
      const src = this.models.get(it.name);
      if (!src) throw new Error(`Unknown model: ${it.name}`);
      m.compose(pos.set(it.x, it.y || 0, it.z), q.setFromAxisAngle(up, it.rot || 0), sc.set(1, 1, it.sz || 1)); // sz: squeeze along z (bridge floor bands)
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
