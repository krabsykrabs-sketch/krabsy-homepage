// The player — a KayKit Ranger driven by the shared rig animation clips:
// idle/walk/run locomotion crossfades, one-shot work actions (Dig, Chop,
// Pickaxe, the Fishing_* set), GLTF tools snapped onto the hand slot bone,
// and the held seed-bag/produce hoisted over the head. Plus the movement
// controller and the gentle down-angled follow cam.

import * as THREE from 'three';
import { LAYOUT } from './config.js';
import { makeRanger, prop } from './assets.js';

const lambert = (c) => new THREE.MeshLambertMaterial({ color: c });

// Tool id → { asset, attach tweaks }. Rotations found by eye against the
// KayKit hand slot (tools rest in the right fist, blade forward).
const TOOL_FIT = {
  shovel:  { asset: 'shovel',  rot: [0, 0, 0], pos: [0, 0, 0] },
  bucket:  { asset: 'bucket',  rot: [0, 0, 0], pos: [0, 0, 0] },
  sword:   { asset: 'sword',   rot: [0, 0, 0], pos: [0, 0, 0] },
  axe:     { asset: 'axe',     rot: [0, 0, 0], pos: [0, 0, 0] },
  pickaxe: { asset: 'pickaxe', rot: [0, 0, 0], pos: [0, 0, 0] },
  rod:     null,   // procedural — no fishing rod in the packs
};

function makeRod() {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.032, 1.5, 6), lambert(0x8a6a3c));
  shaft.position.y = 0.55; g.add(shaft);
  const tipPos = new THREE.Vector3(0, 1.3, 0);
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([tipPos, new THREE.Vector3(0, 0.4, 0.55)]),
    new THREE.LineBasicMaterial({ color: 0xeeeeee }));
  g.add(line);
  const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 8), lambert(0x445066));
  reel.rotation.z = Math.PI / 2; reel.position.set(0, 0.15, 0.05); g.add(reel);
  g.rotation.x = Math.PI / 2.6;   // held tilted forward like the pack tools
  return g;
}

export function createPlayer(scene, camera) {
  const root = new THREE.Group();

  const { group: rig, mixer, clips } = makeRanger();
  rig.scale.setScalar(1.12);    // reads right against the 1.4u farm plots
  root.add(rig);
  scene.add(root);

  // GLTFLoader sanitizes bone names: 'handslot.r' arrives as 'handslotr'.
  const handSlot = rig.getObjectByName('handslotr');

  // ── Animation control ──
  const clip = (n) => THREE.AnimationClip.findByName(clips, n);
  const actions = {};
  for (const n of ['Idle_A', 'Walking_A', 'Running_A', 'Dig', 'Chop', 'Pickaxe',
    'Interact', 'PickUp', 'Use_Item', 'Holding_A',
    'Fishing_Cast', 'Fishing_Idle', 'Fishing_Bite', 'Fishing_Reeling', 'Fishing_Catch']) {
    const c = clip(n);
    if (c) actions[n] = mixer.clipAction(c);
  }
  let current = null;
  function play(name, { once = false, fade = 0.18, timeScale = 1 } = {}) {
    const a = actions[name];
    if (!a) return null;
    if (current === a && !once) return a;
    a.reset();
    a.timeScale = timeScale;
    if (once) { a.setLoop(THREE.LoopOnce); a.clampWhenFinished = true; }
    else a.setLoop(THREE.LoopRepeat);
    if (current) current.crossFadeTo(a, fade, false);
    a.play();
    current = a;
    return a;
  }

  // One-shot work action: locks movement, returns to locomotion when done.
  // loop:true keeps the clip repeating until stopAction() (fishing states).
  let actionLock = 0;
  let loopingAction = false;
  function playAction(name, { loop = false, timeScale = 1.4 } = {}) {
    const a = actions[name];
    if (!a) return 0;
    loopingAction = loop;
    if (loop) { play(name, { timeScale }); actionLock = Infinity; return Infinity; }
    play(name, { once: true, timeScale });
    const dur = a.getClip().duration / timeScale;
    actionLock = dur;
    return dur;
  }
  function stopAction() { actionLock = 0; loopingAction = false; }
  const busy = () => actionLock > 0 && !loopingAction;

  // ── Held item: a seed bag or produce hoisted over the head ──
  let heldGroup = null, holding = false;
  function emojiSprite(emoji, size, overlay = false) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const c2 = cv.getContext('2d');
    c2.font = '96px serif'; c2.textAlign = 'center'; c2.textBaseline = 'middle';
    c2.fillText(emoji, 64, 70);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(cv), transparent: true,
      depthTest: !overlay,
    }));
    if (overlay) sp.renderOrder = 5;
    sp.scale.set(size, size, 1);
    return sp;
  }
  function setHeld(desc) {
    if (heldGroup) { root.remove(heldGroup); heldGroup = null; }
    holding = !!desc;
    if (!desc) return;
    heldGroup = new THREE.Group();
    if (desc.bag) {
      const bag = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.34), lambert(0xc89858));
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.16, 8), lambert(0xb08448));
      neck.position.y = 0.32;
      const knot = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), lambert(0x8a6a3c));
      knot.position.y = 0.42;
      bag.castShadow = true;
      heldGroup.add(bag, neck, knot);
      heldGroup.add(emojiSprite(desc.emoji, 0.34, true));
    } else {
      heldGroup.add(emojiSprite(desc.emoji, 0.85));
    }
    heldGroup.scale.setScalar(1.5);
    heldGroup.position.y = 2.55;
    root.add(heldGroup);
  }

  // ── Tool in hand: pack models snapped to the hand slot bone ──
  let toolGroup = null;
  function setTool(id) {
    if (toolGroup) { toolGroup.parent.remove(toolGroup); toolGroup = null; }
    if (!id || !handSlot) return;
    let g;
    if (id === 'rod') {
      g = makeRod();
    } else {
      const fit = TOOL_FIT[id];
      if (!fit) return;
      g = prop(fit.asset);
      g.rotation.set(...fit.rot);
      g.position.set(...fit.pos);
    }
    toolGroup = g;
    handSlot.add(g);
  }

  // ── State ──
  const pos = new THREE.Vector3(LAYOUT.bed.x, 0, LAYOUT.bed.z + 1);
  let facing = 0, moving = false, running = false;
  const SPEED = 6.2;
  const tmp = new THREE.Vector3();

  function blocked(x, z) {
    if (x > LAYOUT.cottage.x - 3.4 && x < LAYOUT.cottage.x + 3.4 && z > LAYOUT.cottage.z - 3 && z < LAYOUT.cottage.z + 2.2) return true;
    if (Math.hypot(x - LAYOUT.pond.x, z - LAYOUT.pond.z) < LAYOUT.pond.r + 0.4) return true;
    return false;
  }

  function update(dt, input, locked) {
    let dx = 0, dz = 0;
    if (!locked && !busy() && !loopingAction) {
      if (input.up) dz -= 1; if (input.down) dz += 1;
      if (input.left) dx -= 1; if (input.right) dx += 1;
      if (input.joy) { dx += input.joy.x; dz += input.joy.y; }
    }
    moving = !!(dx || dz);
    if (moving) {
      const len = Math.hypot(dx, dz) || 1; dx /= len; dz /= len;
      facing = Math.atan2(dx, dz);
      const nx = pos.x + dx * SPEED * dt;
      const nz = pos.z + dz * SPEED * dt;
      const bound = LAYOUT.ground / 2 - 3.5;
      if (!blocked(nx, pos.z)) pos.x = THREE.MathUtils.clamp(nx, -bound, bound);
      if (!blocked(pos.x, nz)) pos.z = THREE.MathUtils.clamp(nz, -bound, 20);
    }
    running = moving;   // single speed; Running reads better at farm scale

    root.position.set(pos.x, 0, pos.z);
    let df = facing - rig.rotation.y;
    while (df > Math.PI) df -= Math.PI * 2; while (df < -Math.PI) df += Math.PI * 2;
    rig.rotation.y += df * Math.min(1, dt * 14);

    // Locomotion unless a one-shot action holds the rig.
    const idleClip = holding ? 'Holding_A' : 'Idle_A';
    if (actionLock > 0 && !loopingAction) {
      actionLock -= dt;
      if (actionLock <= 0) { actionLock = 0; play(moving ? 'Running_A' : idleClip); }
    } else if (!loopingAction) {
      play(moving ? 'Running_A' : idleClip);
    }
    mixer.update(dt);

    // Held item bobs gently.
    if (heldGroup) heldGroup.position.y = 2.45 + Math.sin(performance.now() / 420) * 0.05;
  }

  // ── Camera: gentle down-angled follow ──
  camera.fov = 46; camera.updateProjectionMatrix();
  const camOffset = new THREE.Vector3(0, 15.5, 17);
  let camZoom = 1;   // QA close-ups
  function setZoom(f) { camZoom = f; }
  function updateCamera(dt, instant = false) {
    tmp.copy(camOffset).multiplyScalar(camZoom).add(pos);
    camera.position.lerp(tmp, instant ? 1 : Math.min(1, dt * 4));
    camera.lookAt(pos.x, 1.4, pos.z - 1.5);
  }

  function teleport(x, z) { pos.set(x, 0, z); root.position.set(x, 0, z); }

  play('Idle_A');

  return {
    root, update, updateCamera, teleport, setHeld, setTool, setZoom,
    playAction, stopAction,
    get position() { return pos; },
    get facing() { return facing; },
    setFacing(f) { facing = f; rig.rotation.y = f; },
  };
}
