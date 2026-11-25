// Player character — visual mesh + animation state. Isolated from physics/controller so the
// next character swap (Krabsy, when the designer delivers) is a single-file change here, not a
// hunt-and-replace through the codebase.
//
// Public interface:
//   createPlayerCharacter(scene) → Promise<{
//     root,                // THREE.Object3D — caller positions/rotates the root each frame
//     setState(name),      // 'idle' | 'walking' | 'jumping' — hard-cuts to a new clip
//     setFacing(yawRad),   // smoothly slerps the root's Y rotation toward yawRad
//     update(dt),          // advances the animation mixer
//   }>
//
// Since 2026-11-25 the player is the child's own figure (site page "Meine Figur", loaded via
// /lib/krabsy-figure.js); without a saved figure, or when that module is missing, it is the
// KayKit Adventurers Ranger, with animations retargeted from the KayKit
// Character Animations Rig_Medium pack. Three.js's AnimationMixer matches tracks to bones by
// name, and KayKit's Rig_Medium characters all share bone names — so clipAction(clip) on the
// Ranger's SkinnedMesh just works without any manual bone remapping.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ─── Asset paths ─────────────────────────────────────────────────────────────
const CHARACTER_MODEL    = './assets/character/Ranger.glb';
const ANIM_MOVEMENT_BASE = './assets/character/Rig_Medium_MovementBasic.glb';
const ANIM_GENERAL       = './assets/character/Rig_Medium_General.glb';

// State → animation clip name. The clips come from one of the loaded animation .glb files;
// we search both pools at lookup time. Swap these names when changing characters if the new
// rig uses different clip naming.
const STATE_CLIPS = {
  idle:    'Idle_A',         // Rig_Medium_General
  walking: 'Walking_A',      // Rig_Medium_MovementBasic
  jumping: 'Jump_Idle',      // Rig_Medium_MovementBasic — mid-air pose
};

// ─── Sizing ──────────────────────────────────────────────────────────────────
// The player's collision capsule has total height 1.4m (half-height 0.4 + 2× radius 0.3).
// The Ranger's source mesh is 2.27m tall, feet at minY=0. Scale uniformly so the visible
// character fills the capsule top-to-bottom — head at capsule top, feet at capsule bottom.
//
// IMPORTANT: do not change the capsule size in player.js; gameplay (jump arcs, gap widths,
// step heights) is tuned to the existing capsule. Scale the mesh to fit the capsule instead.
const RANGER_NATIVE_HEIGHT = 2.27;
const CAPSULE_HEIGHT       = 1.4;
const CHARACTER_SCALE      = CAPSULE_HEIGHT / RANGER_NATIVE_HEIGHT;   // ≈ 0.617

// How sharply the character's facing snaps to the move direction each frame (0..1).
const TURN_LERP = 0.25;

// ─── Internal ────────────────────────────────────────────────────────────────
const gltfLoader = new GLTFLoader();

function loadGLB(url) {
  return new Promise((resolve, reject) => gltfLoader.load(url, resolve, undefined, reject));
}

// The child's own figure (2026-11-25, docs/game-contract.md "The player's figure"): the site's
// /lib/krabsy-figure.js builds it with this game's three.js (import map). On file:// or a dev
// server without /lib and /assets/figures/ the import fails → the Ranger the old way.
const FIGURE_MODULE = '/lib/krabsy-figure.js';
let figureModP = null;
function figureModule() {
  if (!figureModP) {
    figureModP = (location.protocol.startsWith('http') ? import(FIGURE_MODULE) : Promise.reject(new Error('no http')))
      .catch(e => { console.info('[player-character] no figure module, playing the Ranger', e?.message || e); return null; });
  }
  return figureModP;
}

/** Which figure is played: { own, char, hero } once the player is built (null before). */
let figureInfo = null;
export function playerFigureInfo() { return figureInfo; }

// ─── Heroes (owner decision 2026-11-25, docs/game-contract.md "Hero choice on the start
// screen") ──────────────────────────────────────────────────────────────────
// 'mine'   = the child's figure (site page "Meine Figur"); a child without one plays the
//            default figure, the Schülerin (Protagonist_A).
// 'Ranger' = this game's own hero, free, the original model WITH its quiver (a game item
//            here; the figure catalogue drops it). Never saved as the child's figure.
// The title screen remembers the choice in localStorage krabsy_vp_hero (src/hero.js).
export const DEFAULT_FIGURE = 'Protagonist_A';
export const HEROES = ['mine', 'Ranger'];

/** Which character 'mine' shows, without loading any 3D: { char, own } or null when the
    figure module is not there (file://, bare dev server). Never throws. */
export async function mineInfo() {
  const mod = await figureModule();
  if (!mod) return null;
  try {
    const cfg = mod.playerConfig();
    return cfg ? { char: cfg.char, own: true } : { char: DEFAULT_FIGURE, own: false };
  } catch (_) { return { char: DEFAULT_FIGURE, own: false }; }
}

// The Rig_Medium animation clips, loaded once. The spectators on the scenery islets
// (scenery-life.js) use the same rig and share these clips. They come from the figure
// module's shared files (/assets/figures/anim/, same bytes, cached across games) when it is
// there, so the 1.5 MB are not fetched twice; otherwise from ./assets/character/.
let clipPromise = null;
function loadLocalClips() {
  return Promise.all([loadGLB(ANIM_MOVEMENT_BASE), loadGLB(ANIM_GENERAL)])
    .then(([mov, gen]) => [...(mov.animations || []), ...(gen.animations || [])]);
}
export function loadRigClips() {
  if (!clipPromise) {
    clipPromise = figureModule()
      .then(mod => (mod ? mod.loadClips().then(o => Object.values(o)) : loadLocalClips()))
      .catch(e => { console.warn('[player-character] shared clips failed, loading the local ones', e); return loadLocalClips(); });
  }
  return clipPromise;
}

// The visible character for a hero (see HEROES). 'mine': the child's figure, or the
// Schülerin when there is none, via the figure module; 'Ranger': the local Ranger.glb.
// Any figure problem (no module, a failed load) → the local Ranger. Never throws for that.
async function loadCharacterRoot(hero) {
  if (hero !== 'Ranger') {
    const mod = await figureModule();
    if (mod) {
      try {
        // lambert: false — the game shows its hero with the standard (PBR) material.
        const fig = await mod.loadPlayerFigure({ fallback: DEFAULT_FIGURE, lambert: false, clips: false });
        figureInfo = { hero: 'mine', own: fig.own, char: fig.config?.char || DEFAULT_FIGURE };
        return { root: fig.root, dispose: fig.dispose };
      } catch (e) {
        console.warn('[player-character] figure failed, loading the Ranger the old way', e);
      }
    }
  }
  const gltf = await loadGLB(CHARACTER_MODEL);
  figureInfo = { hero: hero === 'Ranger' ? 'Ranger' : 'mine', own: false, char: 'Ranger', local: hero !== 'Ranger' };
  const root = gltf.scene;
  return {
    root,
    dispose() {
      root.traverse(o => {
        if (!o.isMesh) return;
        o.geometry?.dispose();
        for (const m of [].concat(o.material || [])) { m.map?.dispose(); m.dispose(); }
      });
    },
  };
}

// hero: 'mine' (default) or 'Ranger', see HEROES.
export async function createPlayerCharacter(scene, hero = 'mine') {
  // Load the character + both animation .glb files in parallel.
  const [{ root, dispose: disposeRoot }, clipPool] = await Promise.all([
    loadCharacterRoot(hero),
    loadRigClips(),
  ]);

  // Same skeleton and body height for every figure → same scale. Hats stick out above the
  // capsule; that's fine (contract rule 7: hats don't count for collisions).
  root.scale.setScalar(CHARACTER_SCALE);
  root.traverse(o => {
    if (o.isMesh || o.isSkinnedMesh) {
      o.castShadow = false;
      o.receiveShadow = false;
    }
  });
  scene.add(root);

  // Pool of available clips from both animation source files.
  const findClip = (name) => clipPool.find(c => c.name === name);

  // Build a mixer rooted at the character. clipAction retargets bones by name — works for any
  // rig that shares KayKit's Rig_Medium bone names.
  const mixer = new THREE.AnimationMixer(root);
  const actions = {};
  for (const [stateName, clipName] of Object.entries(STATE_CLIPS)) {
    const clip = findClip(clipName);
    if (!clip) {
      console.warn(`[player-character] missing animation clip '${clipName}' (state: ${stateName}). Available: ${clipPool.map(c => c.name).join(', ')}`);
      continue;
    }
    actions[stateName] = mixer.clipAction(clip);
  }

  let currentState = null;
  let currentAction = null;
  const targetQuat = new THREE.Quaternion();
  const yAxis = new THREE.Vector3(0, 1, 0);

  function setState(name) {
    if (name === currentState) return;
    if (currentAction) currentAction.stop();
    currentAction = actions[name] || null;
    if (currentAction) currentAction.reset().play();
    currentState = name;
  }

  // KayKit characters' local forward is +Z (same as the previous Kenney character), so we can
  // use atan2(x, z) directly without a baked-in offset.
  function setFacing(yawRad) {
    targetQuat.setFromAxisAngle(yAxis, yawRad);
    root.quaternion.slerp(targetQuat, TURN_LERP);
  }

  function update(dt) {
    mixer.update(dt);
  }

  // Default state on spawn.
  setState('idle');

  // Throw this character away (hero switch): stop the animations, free the GPU buffers.
  function dispose() {
    mixer.stopAllAction();
    mixer.uncacheRoot(root);
    root.parent?.remove(root);
    try { disposeRoot?.(); } catch (_) { /* ignore */ }
  }

  return { root, hero, setState, setFacing, update, dispose };
}
