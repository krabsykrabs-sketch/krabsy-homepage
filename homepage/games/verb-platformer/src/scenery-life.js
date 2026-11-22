import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { loadRigClips } from './player-character.js';

// The moving part of the scenery (art pass 2). Decoration only: NO colliders, nothing here
// comes near the walkway at walking or jumping height.
//
//   windmill sails   1 InstancedMesh (island material)        on the "mill" islets
//   cloud ships      1 InstancedMesh (island material)        sail in circles on the cloud deck,
//                                                             masts stay below the walkway
//   balloons         1 InstancedMesh (procedural, tinted teal / coral / amber per instance)
//   birds            1 InstancedMesh (procedural, two wing halves per bird, flapped on the CPU)
//   spectators       1 SkinnedMesh each (max 3): the KayKit Mage, its eight parts merged into
//                    one geometry. Same Rig_Medium as the player, so the clips are shared.
//                    They stand on the look-out islets, turn to the player and cheer when the
//                    player is near. Mixers only run for spectators that are close.
//
// buildLife() is called by scenery.js with the level's path pieces and the islands already
// placed, and places everything from the same seeded random stream.

const SITE_COLOURS = ['#2ee6c0', '#ff8585', '#ffcf5e'];   // teal, coral, amber
const NPC_MODEL = './assets/scenery/Mage.glb';
const NPC_SCALE = 0.77;            // the player is 0.617; a little larger reads better at 12+ units
const NPC_TINTS = ['#ffffff', '#ffd2c4', '#c9fff0'];
const NPC_ACTIVE = 70;             // spectators further away than this stand still (no mixer)
const NPC_VISIBLE = 100;           // … and beyond this they are not drawn
const NPC_CHEER = 34;              // … and closer than this they cheer
const SHIP_SPEED = 1.3;            // units per second
const BIRD_SPEED = 4.2;

let npcLib = null;                 // { geometry, material, rootBone, skeleton, clips }
let npcPromise = null;
let shared = null;                 // procedural geometries + materials, built once

// Loads the spectator model. Scenery works without it (no spectators then).
export function preloadLife() {
  if (!npcPromise) npcPromise = loadNpc().catch(e => { npcPromise = null; throw e; });
  return npcPromise;
}

async function loadNpc() {
  const [gltf, clips] = await Promise.all([new GLTFLoader().loadAsync(NPC_MODEL), loadRigClips()]);
  gltf.scene.updateMatrixWorld(true);
  const parts = [];
  gltf.scene.traverse(o => { if (o.isSkinnedMesh) parts.push(o); });
  if (!parts.length) throw new Error('no skinned mesh in ' + NPC_MODEL);
  // All parts hang on the same skeleton and use one texture: one geometry, one draw call.
  const geometry = mergeGeometries(parts.map(p => p.geometry), false);
  if (!geometry) throw new Error('could not merge ' + NPC_MODEL);
  const src = parts[0].material;
  const material = new THREE.MeshLambertMaterial({ map: src.map });
  geometry.computeBoundingSphere();
  const bounds = geometry.boundingSphere.clone();
  bounds.radius *= 1.5;
  const skeleton = parts[0].skeleton;
  const rootBone = skeleton.bones.find(b => !b.parent?.isBone) || skeleton.bones[0];
  const find = n => clips.find(c => c.name === n);
  npcLib = {
    geometry, material, skeleton, rootBone, bounds,
    bindMatrix: parts[0].bindMatrix.clone(),
    idle: [find('Idle_A'), find('Idle_B')].filter(Boolean),
    cheer: [find('Jump_Full_Short'), find('Interact'), find('Jump_Full_Long')].filter(Boolean),
  };
  for (const p of parts) p.material.dispose();
  return npcLib;
}

function makeNpc(tint) {
  const L = npcLib;
  const root = new THREE.Group();
  const rootBone = L.rootBone.clone(true);
  const bones = L.skeleton.bones.map(b => rootBone.getObjectByName(b.name));
  const material = L.material.clone();
  material.color.set(tint);
  const mesh = new THREE.SkinnedMesh(L.geometry, material);
  mesh.boundingSphere = L.bounds;        // the bind pose, a little larger: they animate on the spot
  root.add(rootBone);
  root.add(mesh);
  mesh.bind(new THREE.Skeleton(bones, L.skeleton.boneInverses), L.bindMatrix);
  root.scale.setScalar(NPC_SCALE);
  const mixer = new THREE.AnimationMixer(root);
  return { root, mesh, material, mixer };
}

function buildShared() {
  if (shared) return shared;

  // ---- Balloon: envelope with ten gores (every second one takes the instance colour),
  //      basket and four ropes. Flat shaded like the rest of the low-poly world. ----
  const cream = new THREE.Color('#fff3dc'), wood = new THREE.Color('#8a5a3a'), rope = new THREE.Color('#5d4030');
  const paint = (g, colour, maskFn) => {
    g = g.index ? g.toNonIndexed() : g;
    g.deleteAttribute('uv');
    g.computeVertexNormals();
    const P = g.attributes.position, n = P.count;
    const col = new Float32Array(n * 3), mask = new Float32Array(n);
    for (let i = 0; i < n; i += 3) {
      const cx = (P.getX(i) + P.getX(i + 1) + P.getX(i + 2)) / 3, cz = (P.getZ(i) + P.getZ(i + 1) + P.getZ(i + 2)) / 3;
      const m = maskFn ? maskFn(cx, cz) : 0;
      for (let k = 0; k < 3; k++) { colour.toArray(col, (i + k) * 3); mask[i + k] = m; }
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('tintMask', new THREE.BufferAttribute(mask, 1));
    return g;
  };
  const GORES = 10;
  const profile = [[0.45, 0], [1.05, 0.75], [1.7, 1.8], [2.0, 2.9], [1.9, 3.9], [1.4, 4.75], [0.7, 5.25], [0, 5.4]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  const envelope = paint(new THREE.LatheGeometry(profile, GORES), cream,
    (x, z) => Math.floor(((Math.atan2(z, x) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2 / GORES)) % 2);
  const basket = paint(new THREE.BoxGeometry(0.75, 0.6, 0.75).translate(0, -1.25, 0), wood);
  const parts = [envelope, basket];
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    parts.push(paint(new THREE.BoxGeometry(0.05, 1.05, 0.05).translate(sx * 0.33, -0.45, sz * 0.33), rope));
  }
  const balloonGeo = mergeGeometries(parts, false);
  const balloonMat = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x30302c });
  balloonMat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float tintMask;')
      .replace('#include <color_vertex>', `#include <color_vertex>
        #ifdef USE_INSTANCING_COLOR
          vColor.xyz = mix( color.rgb, instanceColor.rgb, tintMask );
        #endif`);
  };

  // ---- Bird: one wing half with half a body; a bird is two instances (one mirrored).
  //      Forward is +Z, the wing reaches out along +X and flaps about Z. ----
  const v = [
    [0, 0, 0.2], [0.55, 0, 0.14], [0, 0, -0.2],          // inner wing
    [0, 0, -0.2], [0.55, 0, 0.14], [1, 0, -0.16],        // outer wing
    [0, 0.02, 0.55], [0.1, 0.02, 0.1], [0, 0.02, -0.5],  // half the body
  ].flat();
  const white = [1, 1, 1], tip = [0.28, 0.3, 0.36];
  const c = [white, white, white, white, white, tip, white, white, white].flat();
  const birdGeo = new THREE.BufferGeometry();
  birdGeo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  birdGeo.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(9).fill([0, 1, 0]).flat(), 3));
  birdGeo.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  const birdMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, emissive: 0x777777 });

  shared = { balloonGeo, balloonMat, birdGeo, birdMat };
  return shared;
}

export function buildLife(group, ctx) {
  const { lib, rnd, items, placed, mills, spots, cloudY, sky, landmark, plats, nearestPath, pathLevels } = ctx;
  const S = buildShared();
  const info = { mills: [], ships: [], balloons: [], flocks: [], npcs: [], drawCalls: 0 };
  const meshes = [];
  const dummy = new THREE.Object3D();
  const add = (mesh) => {
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    group.add(mesh);
    meshes.push(mesh);
    info.drawCalls++;
    return mesh;
  };
  const awayFromIslands = (x, z, r) => !placed.some(o => Math.hypot(o.x - x, o.z - z) < o.r + r);
  const pickPlat = () => plats[Math.floor(rnd() * plats.length)];

  // ---- Windmill sails ----
  let fans = null;
  const fanList = mills.map(m => ({ ...m, angle: rnd() * Math.PI * 2, speed: 0.5 + rnd() * 0.35 }));
  if (fanList.length && lib.fan.geo) {
    fans = add(new THREE.InstancedMesh(lib.fan.geo, lib.islandMat, fanList.length));
    info.mills = fanList.map(m => ({ x: m.x, y: m.y, z: m.z }));
  }
  const mA = new THREE.Matrix4(), mB = new THREE.Matrix4();
  function placeFans(dt) {
    if (!fans) return;
    fanList.forEach((m, i) => {
      m.angle += dt * m.speed;
      dummy.position.set(m.x, m.y, m.z);
      dummy.rotation.set(0, m.yaw, 0);
      dummy.scale.setScalar(m.s);
      dummy.updateMatrix();
      mA.makeTranslation(lib.fan.pivot.x, lib.fan.pivot.y, lib.fan.pivot.z);
      mB.makeRotationZ(m.angle);
      fans.setMatrixAt(i, mA.premultiply(dummy.matrix).multiply(mB));
    });
    fans.instanceMatrix.needsUpdate = true;
  }

  // ---- Cloud ships: circles on the deck that stay clear of the path and of every island ----
  const shipList = [];
  const shipWant = 2;
  for (let tries = 0; tries < 400 && shipList.length < shipWant; tries++) {
    const it = pickPlat();
    const s = 2.6 + rnd() * 0.9, R = 12 + rnd() * 14;
    const a = rnd() * Math.PI * 2, d = it.r + R + 9 + rnd() * 26;
    const cx = it.x + Math.cos(a) * d, cz = it.z + Math.sin(a) * d;
    let ok = true;
    for (let k = 0; k < 16 && ok; k++) {
      const x = cx + Math.cos(k / 16 * Math.PI * 2) * R, z = cz + Math.sin(k / 16 * Math.PI * 2) * R;
      const near = nearestPath(x, z);
      // 8 units to the side of everything, and the mast top (2.3·s above the deck) far below it
      if (near.gap < 8 || near.gap > 60 || !awayFromIslands(x, z, 4)) ok = false;
      if (cloudY + 2.3 * s > pathLevels(x, z, 30).bottom - 2.5) ok = false;
    }
    if (!ok || shipList.some(o => Math.hypot(o.cx - cx, o.cz - cz) < o.R + R + 6)) continue;
    shipList.push({ cx, cz, R, s, dir: rnd() < 0.5 ? 1 : -1, a: rnd() * Math.PI * 2, phase: rnd() * 6 });
  }
  let ships = null;
  if (shipList.length) {
    ships = add(new THREE.InstancedMesh(lib.shipGeo, lib.islandMat, shipList.length));
    info.ships = shipList.map(o => ({ x: o.cx, z: o.cz, R: o.R }));
  }
  function placeShips(dt, time) {
    if (!ships) return;
    shipList.forEach((o, i) => {
      o.a += o.dir * dt * SHIP_SPEED / o.R;
      const x = o.cx + Math.cos(o.a) * o.R, z = o.cz + Math.sin(o.a) * o.R;
      // heading = tangent of the circle; the hull sits a little into the clouds and rocks
      const hx = -Math.sin(o.a) * o.dir, hz = Math.cos(o.a) * o.dir;
      dummy.position.set(x, cloudY - 0.12 * o.s + Math.sin(time * 0.9 + o.phase) * 0.18, z);
      dummy.rotation.set(Math.sin(time * 0.7 + o.phase) * 0.05, Math.atan2(hx, hz), Math.sin(time * 0.9 + o.phase) * 0.06, 'YXZ');
      dummy.scale.setScalar(o.s);
      dummy.updateMatrix();
      ships.setMatrixAt(i, dummy.matrix);
    });
    ships.instanceMatrix.needsUpdate = true;
  }

  // ---- Balloons: beside the path, 13+ units out, spread along the level ----
  const balloonList = [];
  const balloonWant = plats.length > 14 ? 4 : 3;
  for (let k = 0; k < balloonWant; k++) {
    const from = Math.floor(k * plats.length / balloonWant), to = Math.max(from + 1, Math.floor((k + 1) * plats.length / balloonWant));
    for (let tries = 0; tries < 80; tries++) {
      const it = plats[Math.min(plats.length - 1, from + Math.floor(rnd() * (to - from)))];
      const s = 1 + rnd() * 0.45, rad = 2.1 * s + 2.5;                 // envelope + its drift
      const a = rnd() * Math.PI * 2, d = it.r + rad + 13 + rnd() * (k % 2 ? 26 : 9);
      const x = it.x + Math.cos(a) * d, z = it.z + Math.sin(a) * d;
      const gap = nearestPath(x, z).gap - rad;
      if (gap < 13 || gap > 45) continue;
      const lv = pathLevels(x, z, gap + rad + 12);
      // basket height: from a little below the walkway to well above it
      const y = lv.low - 1.5 + rnd() * 9;
      if (placed.some(o => Math.hypot(o.x - x, o.z - z) < o.r + rad && y - 2 * s < o.top + (o.islet ? 9 : 22))) continue;
      if (balloonList.some(o => Math.hypot(o.x - x, o.z - z) < 14)) continue;
      balloonList.push({ x, y, z, s, phase: rnd() * 6, yaw: rnd() * 6, colour: SITE_COLOURS[k % SITE_COLOURS.length] });
      break;
    }
  }
  let balloons = null;
  if (balloonList.length) {
    balloons = add(new THREE.InstancedMesh(S.balloonGeo, S.balloonMat, balloonList.length));
    const col = new THREE.Color();
    balloonList.forEach((o, i) => balloons.setColorAt(i, col.set(o.colour)));
    balloons.instanceColor.needsUpdate = true;
    info.balloons = balloonList.map(o => ({ x: o.x, y: o.y, z: o.z }));
  }
  function placeBalloons(time) {
    if (!balloons) return;
    balloonList.forEach((o, i) => {
      const t = time * 0.25 + o.phase;
      dummy.position.set(o.x + Math.sin(t * 0.6) * 2, o.y + Math.sin(t) * 0.7, o.z + Math.cos(t * 0.45) * 2);
      dummy.rotation.set(Math.sin(t * 1.3) * 0.03, o.yaw + time * 0.04, Math.cos(t * 1.1) * 0.03);
      dummy.scale.setScalar(o.s);
      dummy.updateMatrix();
      balloons.setMatrixAt(i, dummy.matrix);
    });
    balloons.instanceMatrix.needsUpdate = true;
  }

  // ---- Birds: small flocks circling beside the path (never over it) and round the castle ----
  const flocks = [];
  if (landmark) flocks.push({ cx: landmark.x, cz: landmark.z, R: landmark.r * 0.55, y: landmark.y + 17, n: 5 });
  const flockWant = flocks.length + (plats.length > 14 ? 3 : 2);
  for (let tries = 0; tries < 300 && flocks.length < flockWant; tries++) {
    const it = pickPlat();
    const R = 6 + rnd() * 7;
    const a = rnd() * Math.PI * 2, d = it.r + R + 6 + rnd() * 14;
    const cx = it.x + Math.cos(a) * d, cz = it.z + Math.sin(a) * d;
    const gap = nearestPath(cx, cz).gap;
    if (gap < R + 6 || gap > R + 26) continue;                      // the whole circle is 6+ units off the path
    if (flocks.some(o => Math.hypot(o.cx - cx, o.cz - cz) < o.R + R + 10)) continue;
    const lv = pathLevels(cx, cz, gap + 10);
    const y = lv.low - 2.5 + rnd() * 6;
    // not through trees, houses or mountains
    if (placed.some(o => Math.hypot(o.x - cx, o.z - cz) < o.r + R + 1 && y < o.top + (o.islet ? 7 : 16))) continue;
    flocks.push({ cx, cz, R, y, n: 3 + Math.floor(rnd() * 3) });
  }
  const birdList = [];
  for (const f of flocks) {
    const dir = rnd() < 0.5 ? 1 : -1, a0 = rnd() * Math.PI * 2;
    for (let i = 0; i < f.n; i++) {
      birdList.push({
        f, dir, a: a0 + i * (0.5 + rnd() * 0.5) * (2.2 / f.R) * 2, dr: (rnd() - 0.5) * 2.4, dy: (rnd() - 0.5) * 1.6,
        s: 1.05 + rnd() * 0.5, phase: rnd() * 6, flap: 6.5 + rnd() * 2.5,
      });
    }
  }
  let birds = null;
  if (birdList.length) {
    birds = add(new THREE.InstancedMesh(S.birdGeo, S.birdMat, birdList.length * 2));
    info.flocks = flocks.map(f => ({ x: f.cx, y: f.y, z: f.cz, R: f.R, n: f.n }));
  }
  const mirror = new THREE.Matrix4().makeScale(-1, 1, 1);
  function placeBirds(dt, time) {
    if (!birds) return;
    birdList.forEach((b, i) => {
      const R = b.f.R + b.dr;
      b.a += b.dir * dt * BIRD_SPEED / R;
      dummy.position.set(b.f.cx + Math.cos(b.a) * R, b.f.y + b.dy + Math.sin(time * 0.5 + b.phase) * 0.5, b.f.cz + Math.sin(b.a) * R);
      const hx = -Math.sin(b.a) * b.dir, hz = Math.cos(b.a) * b.dir;
      dummy.rotation.set(0, Math.atan2(hx, hz), -b.dir * 0.3, 'YXZ');     // banked into the turn
      dummy.scale.setScalar(b.s);
      dummy.updateMatrix();
      // a few beats, then a glide with the wings held a little up
      const beat = Math.sin(time * 0.6 + b.phase) > -0.25 ? 1 : 0.12;
      const wing = 0.18 + Math.sin(time * b.flap + b.phase) * 0.62 * beat;
      mA.makeRotationZ(wing).premultiply(dummy.matrix);
      birds.setMatrixAt(i * 2, mA);
      mA.makeRotationZ(-wing).multiply(mirror).premultiply(dummy.matrix);
      birds.setMatrixAt(i * 2 + 1, mA);
    });
    birds.instanceMatrix.needsUpdate = true;
  }

  // ---- Spectators ----
  const npcs = [];
  if (npcLib && npcLib.idle.length) {
    spots.slice(0, NPC_TINTS.length).forEach((spot, i) => {
      const n = makeNpc(NPC_TINTS[i]);
      n.root.position.set(spot.x, spot.y, spot.z);
      // towards the nearest piece of the path until the player shows up
      let best = Infinity, tx = spot.x, tz = spot.z + 1;
      for (const it of items) {
        const d = Math.hypot(it.x - spot.x, it.z - spot.z);
        if (d < best) { best = d; tx = it.x; tz = it.z; }
      }
      n.yaw = Math.atan2(tx - spot.x, tz - spot.z);
      n.root.rotation.y = n.yaw;
      n.idle = n.mixer.clipAction(npcLib.idle[i % npcLib.idle.length]);
      n.idle.play();
      n.mixer.update(rnd() * 2);
      n.cheers = npcLib.cheer.map(c => {
        const act = n.mixer.clipAction(c);
        act.setLoop(THREE.LoopOnce, 1);
        act.clampWhenFinished = true;
        return act;
      });
      n.cheering = null;
      n.wait = 1 + rnd() * 2;
      n.turn = i;
      n.mixer.addEventListener('finished', () => {
        if (!n.cheering) return;
        n.idle.reset().play();
        n.idle.crossFadeFrom(n.cheering, 0.25, false);
        n.cheering = null;
      });
      group.add(n.root);
      npcs.push(n);
      info.drawCalls++;
      info.npcs.push({ x: spot.x, y: spot.y, z: spot.z });
    });
  }
  function updateNpcs(dt, playerPos) {
    for (const n of npcs) {
      const dx = (playerPos?.x ?? n.root.position.x) - n.root.position.x, dz = (playerPos?.z ?? n.root.position.z + 1) - n.root.position.z;
      const dist = playerPos ? Math.hypot(dx, dz) : Infinity;
      n.root.visible = dist < NPC_VISIBLE;
      if (dist > NPC_ACTIVE) continue;
      // turn to the player
      const want = Math.atan2(dx, dz);
      const diff = Math.atan2(Math.sin(want - n.yaw), Math.cos(want - n.yaw));
      n.yaw += diff * Math.min(1, dt * 4);
      n.root.rotation.y = n.yaw;
      if (!n.cheering && n.cheers.length && dist < NPC_CHEER) {
        n.wait -= dt;
        if (n.wait <= 0) {
          const act = n.cheers[n.turn++ % n.cheers.length];
          act.reset().play();
          act.crossFadeFrom(n.idle, 0.15, false);
          n.cheering = act;
          n.wait = 1.8 + Math.random() * 3;
        }
      }
      n.mixer.update(dt);
    }
  }

  // A gate was cleared: every spectator near enough to be animated cheers at once (staggered
  // by a few frames so they do not move in lockstep). Returns how many cheered.
  function cheerNpcs(playerPos) {
    let n = 0;
    for (const s of npcs) {
      if (!s.cheers.length || !playerPos) continue;
      const d = Math.hypot(playerPos.x - s.root.position.x, playerPos.z - s.root.position.z);
      if (d > NPC_ACTIVE) continue;
      const act = s.cheers[s.turn++ % s.cheers.length];
      const from = s.cheering || s.idle;
      act.reset();
      act.startAt(s.mixer.time + 0.12 * n);   // a small stagger (a negative .time would end a LoopOnce at once)
      act.play();
      if (from !== act) act.crossFadeFrom(from, 0.12, false);
      s.cheering = act;
      s.wait = 2.5 + Math.random() * 2;
      n++;
    }
    return n;
  }

  // Tints that follow the level's sky
  S.birdMat.color.set(sky.puff);
  S.birdMat.emissive.set(sky.puff).multiplyScalar(0.45);

  placeFans(0); placeShips(0, 0); placeBalloons(0); placeBirds(0, 0);

  return {
    info,
    cheer: cheerNpcs,
    update(dt, time, playerPos) {
      placeFans(dt);
      placeShips(dt, time);
      placeBalloons(time);
      placeBirds(dt, time);
      updateNpcs(dt, playerPos);
    },
    dispose() {
      for (const m of meshes) m.dispose();           // instance buffers; geometries + materials are shared
      for (const n of npcs) {
        n.mixer.stopAllAction();
        n.mixer.uncacheRoot(n.root);
        n.mesh.skeleton.dispose();
        n.material.dispose();
        group.remove(n.root);
      }
    },
  };
}
