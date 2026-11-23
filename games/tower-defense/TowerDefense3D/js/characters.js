import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { withRetry } from './retry.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

// Animated enemy characters (KayKit Skeletons). The character files hold a skinned
// model without animations; the clips live in separate rig files and fit every
// character of the same rig size.
//
// Instances are pooled per character: a wave spawns and kills dozens of enemies, and
// cloning a skinned model each time would stutter on a school Chromebook.

const CHARACTERS = {
  Skeleton_Minion: 'medium',
  Skeleton_Rogue: 'medium',
  Skeleton_Warrior: 'medium',
  Skeleton_Mage: 'medium',
  Necromancer: 'medium',
  Skeleton_Golem: 'large',
};

// Animation-only files made by tools/strip-rigs.py from the pack's rig files: just the
// bones and the four clips below (the originals are 2.7 MB with a mannequin mesh and
// dozens of unused clips).
const RIG_FILES = {
  medium: ['anim_medium'],
  large: ['anim_large'],
};

// Our name → clip name in the rig files. The large rig has no spawn clip.
const CLIP_NAMES = { walk: 'Walking_A', run: 'Running_A', death: 'Death_A', spawn: 'Spawn_Ground' };

const _tint = new THREE.Color();

class CharacterInstance {
  constructor(name, template, clips) {
    this.name = name;
    this.root = cloneSkinned(template);
    this.materials = [];
    const cloned = new Map();
    this.root.traverse((o) => {
      if (!o.isMesh) return;
      // Skinned bounds are wrong while animated; enemies are always on screen anyway.
      o.frustumCulled = false;
      if (!cloned.has(o.material)) {
        const m = o.material.clone();
        m.userData.base = o.material.color.clone();
        cloned.set(o.material, m);
        this.materials.push(m);
      }
      o.material = cloned.get(o.material);
    });
    // The clone gives every body part its own Skeleton over the same bones, which
    // means ten bone-texture uploads per enemy per frame. Share one instead.
    const parts = [];
    this.root.traverse((o) => { if (o.isSkinnedMesh) parts.push(o); });
    const shared = parts.length ? parts[0].skeleton : null;
    for (const m of parts.slice(1)) {
      const sk = m.skeleton;
      const same = sk.bones.length === shared.bones.length && sk.bones.every((b, i) => b === shared.bones[i]);
      if (!same) continue;
      m.bind(shared, m.bindMatrix);
      sk.dispose();
    }

    this.mixer = new THREE.AnimationMixer(this.root);
    this.actions = {};
    this.durations = {};
    for (const key of Object.keys(clips)) {
      this.actions[key] = this.mixer.clipAction(clips[key]);
      this.durations[key] = clips[key].duration;
    }
    this.current = null;
  }

  has(key) { return !!this.actions[key]; }

  // Switch to an animation. `once` plays it a single time and holds the last frame.
  play(key, { once = false, fade = 0.15 } = {}) {
    if (this.current === key) return;
    const next = this.actions[key];
    if (!next) return;
    const prev = this.current && this.actions[this.current];
    next.reset();
    next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    next.clampWhenFinished = once;
    next.play();
    if (prev && fade > 0) prev.crossFadeTo(next, fade, false);
    else if (prev) prev.stop();
    this.current = key;
  }

  // Multiply the model's colours (hit flash, frozen). null restores the original.
  setTint(hex) {
    if (this._tintHex === hex) return;
    this._tintHex = hex;
    for (const m of this.materials) {
      m.color.copy(m.userData.base);
      if (hex !== null) m.color.multiply(_tint.set(hex));
    }
  }

  reset() {
    this.mixer.stopAllAction();
    this.current = null;
    this.setTint(null);
    this.root.position.set(0, 0, 0);
    this.root.rotation.set(0, 0, 0);
    this.root.scale.setScalar(1);
  }
}

export const Characters = {
  templates: new Map(),          // name → skinned model (never added to a scene)
  clips: { medium: {}, large: {} },
  pools: new Map(),              // name → free CharacterInstance[]

  async load() {
    const loader = new GLTFLoader();
    const file = (n) => {
      const url = `assets/skeletons/${n}.glb`;
      return withRetry(() => loader.loadAsync(url), url);
    };

    const charJobs = Object.keys(CHARACTERS).map(async (name) => {
      const gltf = await file(name);
      // Lambert is much cheaper than the PBR material the files ship with.
      const swapped = new Map();
      gltf.scene.traverse((o) => {
        if (!o.isMesh) return;
        if (!swapped.has(o.material)) {
          const src = o.material;
          swapped.set(src, new THREE.MeshLambertMaterial({
            map: src.map, color: src.color,
            emissive: src.emissive, emissiveMap: src.emissiveMap,
            emissiveIntensity: src.emissiveIntensity,
          }));
          src.dispose();
        }
        o.material = swapped.get(o.material);
      });
      this.templates.set(name, gltf.scene);
      this.pools.set(name, []);
    });

    const rigJobs = Object.entries(RIG_FILES).map(async ([rig, files]) => {
      const loaded = await Promise.all(files.map(file));
      const all = loaded.flatMap(g => g.animations);
      for (const [key, clipName] of Object.entries(CLIP_NAMES)) {
        const clip = all.find(a => a.name === clipName);
        if (clip) this.clips[rig][key] = clip;
      }
    });

    await Promise.all([...charJobs, ...rigJobs]);
  },

  acquire(name) {
    const pool = this.pools.get(name);
    if (!pool) throw new Error(`Unknown character: ${name}`);
    return pool.pop() || new CharacterInstance(name, this.templates.get(name), this.clips[CHARACTERS[name]]);
  },

  release(inst) {
    if (inst.root.parent) inst.root.parent.remove(inst.root);
    inst.reset();
    this.pools.get(inst.name).push(inst);
  },
};
