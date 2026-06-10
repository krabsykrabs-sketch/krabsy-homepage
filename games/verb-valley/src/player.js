// The farm kid — a primitive rig (grouped boxes + spheres) animated entirely in
// code: a squash-and-stretch walk, arm/leg swing, idle breathing, and a big hat
// that bobs. Plus the movement controller and the gentle down-angled follow cam.

import * as THREE from 'three';
import { LAYOUT } from './config.js';

const lambert = (c) => new THREE.MeshLambertMaterial({ color: c });

export function createPlayer(scene, camera) {
  const root = new THREE.Group();

  // ── Rig ──
  const rig = new THREE.Group(); root.add(rig);
  const skin = 0xf2c79a, shirt = 0x2ee6c0, pants = 0x3a4a8a, hat = 0xff8585;

  const legs = new THREE.Group(); rig.add(legs);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.7, 0.28), lambert(pants));
  legL.position.set(-0.18, 0.35, 0); legL.castShadow = true; legs.add(legL);
  const legR = legL.clone(); legR.position.x = 0.18; legs.add(legR);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.75, 0.45), lambert(shirt));
  torso.position.y = 1.05; torso.castShadow = true; rig.add(torso);

  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.2), lambert(shirt));
  armL.position.set(-0.48, 1.1, 0); armL.castShadow = true; rig.add(armL);
  const armR = armL.clone(); armR.position.x = 0.48; rig.add(armR);
  // hands
  const handL = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), lambert(skin)); handL.position.set(-0.48, 0.78, 0); rig.add(handL);
  const handR = handL.clone(); handR.position.x = 0.48; rig.add(handR);

  const head = new THREE.Group(); head.position.y = 1.62; rig.add(head);
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 12), lambert(skin)); face.castShadow = true; head.add(face);
  for (const dx of [-0.13, 0.13]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), lambert(0x222a44)); eye.position.set(dx, 0.03, 0.3); head.add(eye);
  }
  // Big floppy hat.
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.06, 16), lambert(hat)); brim.position.y = 0.28; head.add(brim);
  const crown = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), lambert(hat)); crown.position.y = 0.42; crown.scale.y = 0.7; head.add(crown);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.1, 16), lambert(0xffcf5e)); band.position.y = 0.3; head.add(band);

  scene.add(root);

  // ── Held item: a seed bag or produce hoisted over the head ──
  // setHeld({emoji, bag}) builds the visual; setHeld(null) stows it.
  // While holding, the arms reach up toward it.
  let heldGroup = null, holding = false;
  function emojiSprite(emoji, size, overlay = false) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const c2 = cv.getContext('2d');
    c2.font = '96px serif'; c2.textAlign = 'center'; c2.textBaseline = 'middle';
    c2.fillText(emoji, 64, 70);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(cv), transparent: true,
      depthTest: !overlay,            // overlay sprites draw on top of the bag mesh
    }));
    if (overlay) sp.renderOrder = 5;
    sp.scale.set(size, size, 1);
    return sp;
  }
  function setHeld(desc) {
    if (heldGroup) { rig.remove(heldGroup); heldGroup = null; }
    holding = !!desc;
    if (!desc) return;
    heldGroup = new THREE.Group();
    if (desc.bag) {
      // burlap seed bag with the crop printed on the front
      const bag = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.34), lambert(0xc89858));
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.16, 8), lambert(0xb08448));
      neck.position.y = 0.32;
      const knot = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), lambert(0x8a6a3c));
      knot.position.y = 0.42;
      bag.castShadow = true;
      heldGroup.add(bag, neck, knot);
      const print = emojiSprite(desc.emoji, 0.34, true);
      heldGroup.add(print);
    } else {
      heldGroup.add(emojiSprite(desc.emoji, 0.85));
    }
    heldGroup.scale.setScalar(1.5);   // oversized so it reads at camera distance
    heldGroup.position.y = 2.55;
    rig.add(heldGroup);
  }

  // ── State ──
  const pos = new THREE.Vector3(LAYOUT.bed.x, 0, LAYOUT.bed.z + 1);
  let facing = 0, walkPhase = 0, moving = false, bobT = 0;
  const SPEED = 6.2;
  const tmp = new THREE.Vector3();

  // Soft obstacles the player can't walk through.
  function blocked(x, z) {
    // cottage footprint
    if (x > LAYOUT.cottage.x - 3.4 && x < LAYOUT.cottage.x + 3.4 && z > LAYOUT.cottage.z - 3 && z < LAYOUT.cottage.z + 2.2) return true;
    // pond
    if (Math.hypot(x - LAYOUT.pond.x, z - LAYOUT.pond.z) < LAYOUT.pond.r + 0.4) return true;
    return false;
  }

  function update(dt, input, locked) {
    let dx = 0, dz = 0;
    if (!locked) {
      if (input.up) dz -= 1; if (input.down) dz += 1;
      if (input.left) dx -= 1; if (input.right) dx += 1;
      if (input.joy) { dx += input.joy.x; dz += input.joy.y; }
    }
    moving = (dx || dz);
    if (moving) {
      const len = Math.hypot(dx, dz) || 1; dx /= len; dz /= len;
      facing = Math.atan2(dx, dz);
      const nx = pos.x + dx * SPEED * dt;
      const nz = pos.z + dz * SPEED * dt;
      const bound = LAYOUT.ground / 2 - 3.5;
      if (!blocked(nx, pos.z)) pos.x = THREE.MathUtils.clamp(nx, -bound, bound);
      if (!blocked(pos.x, nz)) pos.z = THREE.MathUtils.clamp(nz, -bound, 20);
      walkPhase += dt * 11;
    } else {
      walkPhase *= 0.8;
    }
    bobT += dt;

    root.position.set(pos.x, 0, pos.z);
    // smooth facing
    let df = facing - rig.rotation.y;
    while (df > Math.PI) df -= Math.PI * 2; while (df < -Math.PI) df += Math.PI * 2;
    rig.rotation.y += df * Math.min(1, dt * 14);

    // Walk + idle animation.
    const sw = Math.sin(walkPhase);
    legL.rotation.x = sw * (moving ? 0.9 : 0);
    legR.rotation.x = -sw * (moving ? 0.9 : 0);
    if (holding) {
      // arms reach up toward the held item
      armL.rotation.x = armR.rotation.x = Math.PI * 0.92;
      handL.position.set(-0.42, 1.62, 0.04); handR.position.set(0.42, 1.62, 0.04);
      handL.position.z = handR.position.z = 0.04;
      if (heldGroup) heldGroup.position.y = 2.45 + Math.sin(bobT * 2.4) * 0.05;
    } else {
      armL.rotation.x = -sw * (moving ? 0.7 : 0);
      armR.rotation.x = sw * (moving ? 0.7 : 0);
      handL.position.x = -0.48; handR.position.x = 0.48;
      handL.position.z = -sw * (moving ? 0.42 : 0); handR.position.z = sw * (moving ? 0.42 : 0);
      handL.position.y = 0.78 - Math.abs(sw) * (moving ? 0.05 : 0); handR.position.y = handL.position.y;
    }
    // squash-and-stretch bob
    const bob = moving ? Math.abs(Math.sin(walkPhase)) * 0.12 : Math.sin(bobT * 2) * 0.03;
    rig.position.y = bob;
    const squash = moving ? 1 + Math.sin(walkPhase * 2) * 0.04 : 1 + Math.sin(bobT * 2) * 0.015;
    rig.scale.set(2 - squash, squash, 2 - squash);
    head.rotation.z = moving ? Math.sin(walkPhase) * 0.06 : 0;
  }

  // ── Camera: gentle down-angled follow ──
  camera.fov = 46; camera.updateProjectionMatrix();
  const camOffset = new THREE.Vector3(0, 15.5, 17);
  function updateCamera(dt, instant = false) {
    tmp.copy(pos).add(camOffset);
    camera.position.lerp(tmp, instant ? 1 : Math.min(1, dt * 4));
    camera.lookAt(pos.x, 1.4, pos.z - 1.5);
  }

  function teleport(x, z) { pos.set(x, 0, z); root.position.set(x, 0, z); }

  return {
    root, update, updateCamera, teleport, setHeld,
    get position() { return pos; },
    get facing() { return facing; },
    setFacing(f) { facing = f; },
  };
}
