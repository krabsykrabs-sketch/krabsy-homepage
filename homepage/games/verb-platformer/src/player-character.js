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
// Current placeholder = KayKit Adventurers Ranger, with animations retargeted from the KayKit
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

export async function createPlayerCharacter(scene) {
  // Load the character model + both animation .glb files in parallel.
  const [modelGltf, movGltf, genGltf] = await Promise.all([
    loadGLB(CHARACTER_MODEL),
    loadGLB(ANIM_MOVEMENT_BASE),
    loadGLB(ANIM_GENERAL),
  ]);

  const root = modelGltf.scene;
  root.scale.setScalar(CHARACTER_SCALE);
  root.traverse(o => {
    if (o.isMesh || o.isSkinnedMesh) {
      o.castShadow = false;
      o.receiveShadow = false;
    }
  });
  scene.add(root);

  // Pool of available clips from both animation source files.
  const clipPool = [...(movGltf.animations || []), ...(genGltf.animations || [])];
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

  return { root, setState, setFacing, update };
}
