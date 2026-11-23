// Set pieces and life for the island (all CC0, see assets/CREDITS.md):
// Meadow: flower fields with butterflies, an old stone circle, a pond with lily
//   pads and a canoe, signposts where the paths fork.
// Home: lanterns, benches, bushes, a fountain, a playground, a picnic, a small farm.
// Forest: mushrooms (some giant), stumps, logs, a campsite with a crackling fire, fireflies.
// Beach: a bay with a walkable pier, palms along the dunes, a shipwreck on the rocks,
//   parasols and towels, sandcastles, boats, a treasure dig, an islet, seagulls, a
//   pirate ship at anchor in the bay mouth.
// Volcano: stone heads guarding it, glowing crystals, smoke from the crater.
// Sea: a lighthouse on a rock. Sky: drifting clouds.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ZONES, ISLAND, HOME } from './balance.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { height, terrainH, zoneAt, pathDist, POND, pondPoint, PATHS, FORK, WATER_Y, glowTex, BAY, PIER, ISLET, bayPoint, beachW } from './world.js';
import { paint } from './merge.js';
import { rng } from './creatures.js';
import { t } from './i18n.js';

const Z = Object.fromEntries(ZONES.map((z) => [z.id, z]));
const F = {}; // short name → file
const add = (dir, ext, names) => names.forEach((n) => { F[n] = `assets/props/${dir}/${n}.${ext}`; });
add('nature', 'glb', ['stump_roundDetailed', 'stump_old', 'log',
  'log_large', 'tent_detailedOpen', 'campfire_logs', 'lily_large', 'lily_small', 'statue_column', 'statue_obelisk', 'statue_head',
  'stone_largeB', 'crop_pumpkin', 'crop_carrot', 'crops_cornStageD', 'fence_simple',
  'canoe', 'pot_large']);
add('pirate', 'glb', ['palm-detailed-bend', 'palm-detailed-straight', 'palm-bend', 'ship-wreck', 'ship-pirate-large', 'boat-row-small',
  'barrel', 'crate', 'chest', 'flag-pirate-high', 'rocks-sand-a', 'rocks-sand-b', 'tower-complete-small',
  'palm-straight', 'rocks-a', 'rocks-b', 'rocks-c', 'boat-row-large', 'bottle', 'tool-shovel', 'hole']);
add('survival', 'glb', ['signpost', 'bedroll']);
add('playground', 'gltf', ['swing_A_large', 'slide_A', 'seesaw_large', 'merry_go_round', 'sandbox_round_decorated', 'spring_horse_A',
  'sandcastle_A', 'sandcastle_B', 'sandcastle_C', 'picnic_table']);
add('picnic', 'gltf', ['picnic_blanket_red', 'picnic_basket_round', 'teapot', 'apple', 'sandwich', 'pillow_large_blue']);
add('park', 'gltf', ['street_lantern', 'bench', 'fountain']);
add('gems', 'gltf', ['Gem_Large', 'Gem_Medium']);

// Spots kept free of random trees and rocks (world.loadDecor reads them): [x, z, r]
const H = HOME;
const SPOT = {
  playground: [H.x - 29, H.z - 2], picnic: [H.x + 24, H.z - 5], farm: [H.x + 30, H.z + 16],
  circle: [-30, 30], camp: [Z.forest.x + 12, Z.forest.z + 16],
};
export function reserveSpots(world) {
  world.reserved.push([...SPOT.playground, 12], [...SPOT.picnic, 6], [...SPOT.farm, 10], [...SPOT.circle, 10],
    [...SPOT.camp, 8], [FORK.x, FORK.z, 4]);
}

// Kenney's Nature Kit paints all leaves teal; in our warm meadow that looks wrong.
const LEAF = { grass: 0x79c85a, leafsGreen: 0x6dbe52, leafsDark: 0x4d9c48 };
const dir = (url) => url.split('/')[2];
const cache = {};
async function loadAll(loader) {
  await Promise.all(Object.entries(F).map(async ([n, url]) => {
    try {
      const g = await loader.loadAsync(url);
      g.scene.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(g.scene), size = box.getSize(new THREE.Vector3());
      g.scene.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = true; o.receiveShadow = true;
        // some packs export metalness 1, which renders black without an environment map
        for (const m of [].concat(o.material)) {
          m.metalness = 0; m.roughness = Math.max(m.roughness ?? 1, 0.6);
          if (LEAF[m.name] && dir(url) === 'nature') m.color.setHex(LEAF[m.name]); // the kit's leaves are mint / teal
        }
      });
      let parts = 0; g.scene.traverse((o) => { if (o.isMesh) parts++; });
      cache[n] = { scene: g.scene, h: size.y || 1, w: Math.max(size.x, size.z) || 1, minY: box.min.y, parts };
    } catch (_) { /* a missing prop is skipped */ }
  }));
}

// A copy of a model for things that move (ship, boat): its parts are merged into one
// mesh per material, so the whole model is one draw call.
function liveModel(scene) {
  const by = new Map(), g = new THREE.Group();
  scene.updateMatrixWorld(true);
  scene.traverse((o) => { if (o.isMesh) { if (!by.has(o.material)) by.set(o.material, []); by.get(o.material).push(o.geometry.clone().applyMatrix4(o.matrixWorld)); } });
  for (const [mat, geos] of by) {
    const one = mergeGeometries(geos);
    for (const geo of one ? [one] : geos) { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; g.add(m); }
  }
  return g;
}

export async function buildDecor(world) {
  await loadAll(new GLTFLoader());
  const S = world.scene, R = rng('decor-2');
  const life = [];
  // Place one model: h = target height, w = target width (else s = scale).
  // It is baked into the static batch (merge.js) and can't be moved afterwards;
  // { live: true } keeps it a separate object (returned) for things that move.
  // Batch options: color (replace the model's colour), mul (multiply it), glow.
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v3 = new THREE.Vector3(), sc = new THREE.Vector3();
  // Names of the Quaternius pack (world.q, e.g. 'Flower_3_Single') work too; for those
  // the options are tint (foliage colour) and mul.
  const Q = world.q ? world.q.models : {};
  const put = (n, x, z, o = {}) => {
    const c = cache[n] || Q[n]; if (!c) return null;
    const s = o.s ?? (o.w ? o.w / c.w : (o.h ?? 1) / c.h);
    const ry = o.ry ?? R() * Math.PI * 2, y = (o.y ?? height(x, z)) - c.minY * s + (o.lift ?? 0);
    if (o.col) world.addCollider(x, z, o.col);
    if (o.live) {
      const m = liveModel(c.scene);
      m.scale.setScalar(s); m.rotation.y = ry; m.position.set(x, y, z);
      S.add(m);
      return m;
    }
    m4.compose(v3.set(x, y, z), q.setFromAxisAngle(up, ry), sc.setScalar(s));
    if (c.q) world.batch.addQ(c, m4, o); else world.batch.addModel(c.scene, m4, o);
    return true;
  };
  // many copies of one model (also baked into the batch)
  const inst = (n, pts, o = {}) => {
    const c = cache[n] || Q[n]; if (!c) return;
    let burn = 0;
    for (const p of pts) {
      const s = p.h / c.h;
      if (p.ry === undefined) burn += c.parts - 1;
      m4.compose(v3.set(p.x, (p.y ?? height(p.x, p.z)) - c.minY * s, p.z), q.setFromAxisAngle(up, p.ry ?? R() * 6.28), sc.setScalar(s));
      if (c.q) world.batch.addQ(c, m4, p.tint !== undefined ? { ...o, tint: p.tint } : o); else world.batch.addModel(c.scene, m4, o);
    }
    // (the old code drew one random number per model PART; use up the same amount, so
    // every later random placement stays exactly where it was)
    while (burn-- > 0) R();
  };
  const free = (x, z, gap = 2.5) => height(x, z) > 0.45 && pathDist(x, z) > gap
    && Math.hypot(x - POND.x, z - POND.z) > POND.r + 2 && Math.hypot(x - H.x, z - H.z) > 24
    && !world.nearColliders(x, z).some((c) => Math.hypot(x - c.x, z - c.z) < c.r + 0.6);
  const around = (cx, cz, r) => { const a = R() * 6.28, d = Math.sqrt(R()) * r; return [cx + Math.cos(a) * d, cz + Math.sin(a) * d]; };

  // ── home ──
  for (const sx of [-1, 1]) {
    put('street_lantern', H.x + sx * 4.2, H.z - 11.6, { h: 3.2, ry: 0, col: 0.3 });
    put('street_lantern', H.x + sx * 14.6, H.z - 11.6, { h: 3.2, ry: 0, col: 0.3 });
    put('bench', H.x + sx * 9.5, H.z - 12.6, { h: 1.0, ry: Math.PI, col: 0.9 });
    for (let k = 0; k < 3; k++) put('Bush_Common_Flowers', H.x + sx * (17 + k * 0.2), H.z - 6 + k * 8, { h: 1.7, col: 0.9, tint: 0x77bb3e });
    put('pot_large', H.x + sx * 6.5, H.z - 10.2, { h: 0.9 });
  }
  put('fountain', H.x + 13, H.z - 19, { h: 2.4, ry: 0, col: 2.4 });
  // flower beds along the front edge of the deck
  ['Flower_3_Single', 'Flower_4_Single', 'Flower_3_Group'].forEach((n, k) => inst(n, Array.from({ length: 6 }, (_, i) => {
    const x = H.x + (i < 3 ? -1 : 1) * (7.5 + (i % 3) * 1.7 + k * 0.55);
    return { x, z: H.z - 12.0 + (k % 2) * 0.45, h: 0.6 + ((i + k) % 3) * 0.1 };
  })));
  // playground (west of the base)
  const [px, pz] = SPOT.playground;
  put('swing_A_large', px - 4, pz - 4, { h: 2.6, ry: 0.3, col: 1.8 });
  put('slide_A', px + 4, pz + 3, { h: 2.4, ry: -0.6, col: 1.8 });
  put('seesaw_large', px - 5, pz + 5, { h: 0.9, ry: 1.2, col: 1.4 });
  put('merry_go_round', px + 4, pz - 5, { h: 1.0, col: 1.6 });
  put('sandbox_round_decorated', px, pz + 1, { w: 3.2, col: 1.5 });
  put('spring_horse_A', px + 7, pz, { h: 1.1, ry: -1.4, col: 0.6 });
  put('picnic_table', px - 8, pz - 1, { h: 0.9, ry: 1.5, col: 1.3 });
  // picnic (east of the base)
  const [cx, cz] = SPOT.picnic;
  put('picnic_blanket_red', cx, cz, { w: 3.2, ry: 0.3 });
  put('picnic_basket_round', cx - 0.8, cz - 0.4, { h: 0.55, lift: 0.03 });
  put('teapot', cx + 0.6, cz + 0.3, { h: 0.35, lift: 0.03 });
  put('sandwich', cx + 0.2, cz - 0.7, { h: 0.12, lift: 0.03 });
  put('apple', cx - 0.2, cz + 0.7, { h: 0.15, lift: 0.03 });
  put('pillow_large_blue', cx + 1.3, cz - 0.9, { h: 0.35, lift: 0.03 });
  // a small farm behind the base: three rows (pumpkins, carrots, corn) with a fence
  const [fx, fz] = SPOT.farm;
  const rows = [['crop_pumpkin', 0.7], ['crop_carrot', 0.5], ['crops_cornStageD', 2.0]];
  rows.forEach(([n, h], r) => {
    const z = fz - 3 + r * 3;
    world.batch.addPainted(paint(new THREE.BoxGeometry(10, 0.25, 1.4), 0x8a5a33).translate(fx, height(fx, z) + 0.05, z), fx, fz);
    inst(n, Array.from({ length: 7 }, (_, i) => ({ x: fx - 4.2 + i * 1.4, z, y: height(fx, z) + 0.17, h: h * (0.85 + R() * 0.3) })));
  });
  if (cache.fence_simple) {
    const fw = cache.fence_simple.w * (1.0 / cache.fence_simple.h) * 1.0; // width at 1 m height
    for (const [x0, z0, x1, z1] of [[fx - 6, fz - 5, fx + 6, fz - 5], [fx - 6, fz + 5, fx + 6, fz + 5], [fx - 6, fz - 5, fx - 6, fz + 5], [fx + 6, fz - 5, fx + 6, fz + 5]]) {
      const L = Math.hypot(x1 - x0, z1 - z0), n = Math.round(L / fw), ry = Math.atan2(x1 - x0, z1 - z0) + Math.PI / 2;
      for (let i = 0; i < n; i++) { const k = (i + 0.5) / n; put('fence_simple', x0 + (x1 - x0) * k, z0 + (z1 - z0) * k, { h: 1.0, ry }); }
    }
  }

  // ── signposts where the paths fork, with the zone names ──
  put('signpost', FORK.x, FORK.z, { h: 2.6, ry: 0, col: 0.4 });
  const ICON = { forest: '🌲', beach: '🏖️', volcano: '🌋' };
  ['forest', 'beach', 'volcano'].forEach((id, k) => {
    const p = PATHS[k], a = k === 0 ? p[1] : p[0], b = k === 0 ? p[2] : p[1];
    const dir = Math.atan2(b[0] - a[0], b[1] - a[1]);
    world.scene.add(signBoard(`${ICON[id]} ${t(`zone_${id}`)}`, Z[id].stars, FORK.x, height(FORK.x, FORK.z) + 2.4 - k * 0.55, FORK.z, dir));
  });

  // ── paths you can read: stepping stones, lantern posts, bits of fence, a gate at each zone ──
  pathDressing(world, Q, rng('paths'));

  // ── meadow: flower fields, stone circle, pond ──
  // (each field: one or two kinds of flowers, single ones around a group, fallen petals)
  const flowerNames = ['Flower_3_Single', 'Flower_4_Single', 'Flower_3_Group', 'Flower_4_Group', 'Flower_3_Single'];
  const petalNames = ['Petal_1', 'Petal_2', 'Petal_3', 'Petal_4', 'Petal_5'];
  const flowers = Object.fromEntries([...flowerNames, ...petalNames].map((n) => [n, []]));
  const fieldCenters = [];
  for (let tries = 0; fieldCenters.length < 34 && tries < 600; tries++) {
    const [x, z] = around(ISLAND.cx, ISLAND.cz + 10, ISLAND.r - 22);
    if (zoneAt(x, z).id !== 'meadow' || !free(x, z, 4) || ZONES.some((zz) => zz.r && Math.hypot(x - zz.x, z - zz.z) < zz.r + 5)) continue;
    fieldCenters.push([x, z]);
    const kind = flowerNames[Math.floor(R() * flowerNames.length)];
    for (let i = 0; i < 7; i++) {
      const [fx2, fz2] = around(x, z, 3.2);
      const n = i < 3 ? petalNames[Math.floor(R() * 5)] : (R() < 0.75 ? kind : flowerNames[Math.floor(R() * flowerNames.length)]);
      if (free(fx2, fz2, 2)) flowers[n].push(i < 3 ? { x: fx2, z: fz2, h: 0.1, y: height(fx2, fz2) + 0.03 } : { x: fx2, z: fz2, h: (n.endsWith('Group') ? 0.75 : 0.6) + R() * 0.3 });
    }
  }
  for (const [n, pts] of Object.entries(flowers)) inst(n, pts);
  // the grass around a flower field is lighter: fresh, yellowish or minty green
  // (mixing in the petal colours themselves turned the green to grey)
  world.tintGround(fieldCenters.map(([x, z], i) => [x, z, 6.5, [0xa6e072, 0xd3e060, 0x8fdc98, 0xbfe57a][i % 4], 0.5]));
  // an old stone circle
  const [sx0, sz0] = SPOT.circle;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    put('statue_column', sx0 + Math.cos(a) * 6.5, sz0 + Math.sin(a) * 6.5, { h: 3.2 + R() * 0.8, ry: a, col: 0.6 });
  }
  put('statue_obelisk', sx0, sz0, { h: 4.5, ry: 0.4, col: 0.9 });
  // pond: lily pads on the water, green reeds along the waterline (thicker on two
  // sides, none where the canoe lies), a canoe on the bank. Positions follow the
  // pond's outline: pondPoint(direction, metres from the middle of a round pond).
  const RP = rng('pond');
  const onWater = (n) => Array.from({ length: n }, () => { const [x, z] = pondPoint(RP() * 6.28, Math.sqrt(RP()) * 6.3); return { x, z, y: POND.water + 0.02, ry: RP() * 6.28 }; });
  inst('lily_large', onWater(7).map((p) => ({ ...p, h: 0.12 })));
  inst('lily_small', onWater(6).map((p) => ({ ...p, h: 0.1 })));
  // (the kit's reed is teal; real reed colours instead, three greens so the clumps look alive)
  [0x6aa843, 0x86b84c, 0x4f9440].forEach((tint, k) => inst(k === 1 ? 'Grass_Wispy_Tall' : 'Grass_Common_Tall', Array.from({ length: 9 }, () => {
    const a = [0.5, 2.2, 5.0][Math.floor(RP() * 3)] + (RP() - 0.5) * 1.5;
    const [x, z] = pondPoint(a, 7.5 + RP() * 1.7);
    return { x, z, y: Math.max(height(x, z), POND.water - 0.1), h: 0.9 + RP() * 0.8 + (k === 0 ? 0.3 : 0), ry: RP() * 6.28 };
  }), { tint }));
  put('canoe', ...pondPoint(3.5, 9.3), { w: 3.2, ry: 1.2, lift: 0.05 });
  for (let i = 0; i < 123; i++) R(); // the old round pond used 123 random numbers here (keeps the later placements)

  // ── forest: mushrooms (some giant), stumps, logs, a campsite ──
  const F0 = Z.forest;
  const mush = { Mushroom_Common: [], Mushroom_Laetiporus: [] };
  const mNames = ['Mushroom_Common', 'Mushroom_Common', 'Mushroom_Laetiporus'];
  for (let i = 0, tries = 0; i < 48 && tries < 900; tries++) {
    const [x, z] = around(F0.x, F0.z, F0.r - 2);
    if (!free(x, z, 1.5)) continue;
    const giant = i < 9;
    if (giant) put('Mushroom_Common', x, z, { h: 2.6 + R() * 1.8, mul: [0xffa07a, 0xffd27a, 0xd9b0ff][i % 3] }); // (the giants are coloured)
    else mush[mNames[Math.floor(R() * mNames.length)]].push({ x, z, h: 0.4 + R() * 0.5 });
    if (giant) world.addCollider(x, z, 0.5);
    i++;
  }
  for (const [n, pts] of Object.entries(mush)) inst(n, pts);
  for (let i = 0; i < 10; i++) { const [x, z] = around(F0.x, F0.z, F0.r - 3); if (free(x, z, 1.5)) put(i % 2 ? 'stump_roundDetailed' : 'stump_old', x, z, { h: 0.9, col: 0.6 }); }
  for (let i = 0; i < 7; i++) { const [x, z] = around(F0.x, F0.z, F0.r - 3); if (free(x, z, 1.5)) put(i % 2 ? 'log' : 'log_large', x, z, { w: 3, col: 0.8 }); }
  const [kx, kz] = SPOT.camp;
  put('tent_detailedOpen', kx - 3, kz - 2, { h: 2.4, ry: 0.6, col: 1.8 });
  put('bedroll', kx - 0.5, kz - 3.4, { w: 2.0, ry: 0.6 });
  put('campfire_logs', kx, kz, { h: 0.6, col: 0.7 });
  put('log', kx + 2.2, kz + 0.4, { w: 2.2, ry: 1.4 });
  put('log', kx - 0.4, kz + 2.4, { w: 2.2, ry: 0.1 });
  life.push(campfire(S, kx, height(kx, kz) + 0.35, kz));
  life.push(fireflies(S, F0, R));

  // ── beach: a bay. Positions are bay coordinates: bayPoint(angle, metres inland
  // from the waterline); angle 0 = the middle of the beach, − = north, + = south ──
  const B = Z.beach;
  const clear = (x, z, gap) => !world.nearColliders(x, z).some((c) => Math.hypot(x - c.x, z - c.z) < c.r + gap);
  const offPier = (x, z) => { const dx = x - PIER.x0, dz = z - PIER.z0, a = dx * PIER.ux + dz * PIER.uz; return a < -3 || a > PIER.len + 3 || Math.abs(-dx * PIER.uz + dz * PIER.ux) > 5; };
  life.push(buildPier(world, put));
  // the wreck lies on the rocks of the north headland, half in the water
  const [wx, wz] = bayPoint(-0.98, -1.5);
  put('ship-wreck', wx, wz, { w: 12, ry: 2.5, col: 3.6, y: WATER_Y - 0.55 });
  put('flag-pirate-high', ...bayPoint(-0.86, 6), { h: 4.5, col: 0.3 });
  // grey rocks close the bay at both ends, a few stand in the shallows
  const rk = { 'rocks-a': [], 'rocks-b': [], 'rocks-c': [] }, rkN = Object.keys(rk);
  const rock = (ang, s, h) => {
    const [x, z] = bayPoint(ang, s);
    rk[rkN[Math.floor(R() * 3)]].push({ x, z, h, y: terrainH(x, z) - h * 0.12 });
    world.addCollider(x, z, h * 0.55);
  };
  for (const side of [-1, 1]) {
    for (let i = 0; i < 7; i++) rock(side * (1.14 + i * 0.075 + R() * 0.03), -3 + R() * 8 + i * 0.9, 1.6 + R() * 2.2 + (i > 3 ? 1 : 0));
    rock(side * 1.02, -9, 1.6); rock(side * 1.2, -13, 2.4); rock(side * 0.9, -6.5, 1.0);
  }
  rock(-0.75, -4.5, 1.2); rock(-1.08, 2.5, 1.5);
  // (the kit's rocks are almost black: lighten them to a warm grey that fits the sand)
  for (const n of rkN) cache[n]?.scene.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.setRGB(1.9, 1.8, 1.7); } });
  for (const [n, pts] of Object.entries(rk)) inst(n, pts);
  // palms: a belt along the dunes behind the beach, a few down by the water, two on the islet
  const palms = { 'palm-detailed-bend': [], 'palm-detailed-straight': [], 'palm-bend': [], 'palm-straight': [] }, palmN = Object.keys(palms);
  const palm = (x, z, h) => { palms[palmN[Math.floor(R() * 4)]].push({ x, z, h }); world.addCollider(x, z, 0.5); };
  for (let i = 0, tries = 0; i < 20 && tries < 500; tries++) {
    const [x, z] = bayPoint(-1.0 + R() * 2.0, 17 + R() * R() * 24);
    if (!clear(x, z, 3.2) || !offPier(x, z) || pathDist(x, z) < 3.5 || terrainH(x, z) < 0.5) continue;
    palm(x, z, 6 + R() * 3.5); i++;
  }
  for (const [ang, s] of [[-0.6, 10.5], [0.56, 10], [1.0, 12.5]]) palm(...bayPoint(ang, s), 6.5 + R() * 2);
  palm(ISLET.x + 1.2, ISLET.z - 0.8, 7.5); palm(ISLET.x - 1.6, ISLET.z + 1.4, 5.5);
  for (const [n, pts] of Object.entries(palms)) inst(n, pts);
  // dune grass where the sand ends, sand-coloured rocks between the palms
  const tufts = { Grass_Common_Short: [], Grass_Wispy_Short: [] };
  for (let i = 0; i < 60; i++) {
    const [x, z] = bayPoint(-1.15 + R() * 2.3, 15 + R() * 26);
    if (clear(x, z, 0.6) && offPier(x, z) && pathDist(x, z) > 2.5 && beachW(x, z) > 0.3) tufts[i % 3 ? 'Grass_Common_Short' : 'Grass_Wispy_Short'].push({ x, z, h: 0.45 + R() * 0.35 });
  }
  for (const [n, pts] of Object.entries(tufts)) inst(n, pts, { tint: 0xb7c46c }); // dry dune grass
  for (let i = 0; i < 7; i++) { const [x, z] = bayPoint(-0.9 + R() * 1.8, 20 + R() * 16); if (clear(x, z, 1.5) && offPier(x, z) && pathDist(x, z) > 3.5) put(i % 2 ? 'rocks-sand-a' : 'rocks-sand-b', x, z, { h: 0.9 + R() * 0.5, col: 0.9 }); }
  inst('rocks-sand-a', [{ x: ISLET.x + 3.2, z: ISLET.z + 2.6, h: 0.7 }]);
  // a day at the beach: parasols, towels, a ball, sandcastles by the water
  beachSet(world, [[0.2, 13.5, 0xff8585], [0.36, 15, 0x2ee6c0], [0.52, 13, 0xffcf5e], [-0.66, 15.5, 0x2ee6c0]].map(([a, s, c]) => [...bayPoint(a, s), c]), R);
  for (const [n, ang, s] of [['sandcastle_A', 0.03, 10.6], ['sandcastle_B', 0.09, 12.2], ['sandcastle_C', -0.04, 12.6]]) put(n, ...bayPoint(ang, s), { h: 1.0, col: 0.7 });
  // boats: one pulled up on the sand, one tied to the pier head
  put('boat-row-small', ...bayPoint(-0.7, 4.5), { w: 4, ry: 0.9, lift: -0.08, col: 1.5 });
  put('bottle', ...bayPoint(0.95, 1.2), { h: 0.45, lift: -0.05 });
  // someone has been digging for treasure under the palms
  const [tx, tz] = bayPoint(-0.7, 24);
  put('hole', tx, tz, { w: 2.6, lift: 0.02 });
  put('tool-shovel', tx + 1.6, tz + 0.6, { h: 1.3, ry: 0.5, col: 0.3 });
  put('chest', tx - 1.9, tz + 0.9, { h: 0.9, ry: 2.2, col: 0.7 });
  put('crate', tx - 2.2, tz - 1.4, { h: 0.8, col: 0.6 });
  // the pirate ship lies at anchor in the mouth of the bay
  const ship = put('ship-pirate-large', BAY.x + 24, BAY.z - 26, { w: 22, ry: -1.0, y: WATER_Y - 2.2, live: true });
  if (ship) { const y0 = ship.position.y; life.push((dt, time) => { ship.position.y = y0 + Math.sin(time * 0.8) * 0.25; ship.rotation.z = Math.sin(time * 0.6) * 0.04; ship.rotation.x = Math.sin(time * 0.5 + 1) * 0.03; }); }
  life.push(seagulls(S, BAY.x - 16, BAY.z, R));

  // ── volcano: stone heads guarding it, glowing crystals, smoke ──
  const V = Z.volcano;
  for (let i = 0; i < 6; i++) {
    const a = (i - 2.5) * 0.42, r = V.r + 7; // on the side facing home
    const x = V.x + Math.sin(a) * r, z = V.z + Math.cos(a) * r;
    put('statue_head', x, z, { h: 3.4, ry: a - Math.PI / 2, col: 1.2 }); // the model faces +x: turn it to look outwards
  }
  const crystal = (n, x, z, h, color) => put(n, x, z, { h, col: 0.3, mul: color, glow: 0.6 });
  for (let i = 0; i < 14; i++) {
    const a = R() * 6.28, r = 8 + R() * (V.r - 10);
    crystal(i % 2 ? 'Gem_Large' : 'Gem_Medium', V.x + Math.cos(a) * r, V.z + Math.sin(a) * r, 1.0 + R() * 1.2, [0xb57bff, 0xff8a3d, 0xff5fb0][i % 3]);
  }
  life.push(smoke(S, V.x, height(V.x, V.z) + 2, V.z));

  // ── sea: a lighthouse on a rock ──
  const lx = -116, lz = 52;
  put('stone_largeB', lx, lz, { h: 5, y: WATER_Y - 2.5, ry: 0 });
  const tower = put('tower-complete-small', lx, lz, { h: 12, y: WATER_Y + 2.2, ry: 0 });
  if (tower) life.push(lighthouse(S, lx, WATER_Y + 13.5, lz));
  for (const [x, z, h] of [[118, 48, 3], [-88, -105, 4], [40, 118, 2.5], [-125, -30, 3.5]]) put('stone_largeB', x, z, { h, y: WATER_Y - 1 });

  // ── sky ──
  life.push(clouds(S, R));
  life.push(butterflies(S, fieldCenters, R));
  world.animators.push((dt, time) => { for (const f of life) if (f) f(dt, time); });
}

// Stepping stones along the dirt paths, a lantern post and a short fence at the bends,
// and a wooden gate with a banner in the zone's colour where each path reaches its zone.
function pathDressing(world, Q, R) {
  if (!Q.RockPath_Round_Small_1) return;
  const B = world.batch, m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), q2 = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), nrm = new THREE.Vector3();
  const stones = ['RockPath_Round_Small_1', 'RockPath_Square_Small_1', 'RockPath_Round_Small_2', 'RockPath_Square_Small_2', 'RockPath_Round_Small_3', 'RockPath_Square_Small_3'];
  const WOOD = 0x8a5c36, WOOD_DARK = 0x6e4628, BANNER = { forest: 0x4fb857, beach: 0x35b8e8, volcano: 0xf2643c };
  // a model lying on the ground, tilted with the slope
  const lay = (name, x, z, s, ry, sink = 0.03) => {
    const m = Q[name]; if (!m) return;
    nrm.set(terrainH(x - 0.6, z) - terrainH(x + 0.6, z), 1.2, terrainH(x, z - 0.6) - terrainH(x, z + 0.6)).normalize();
    q.setFromUnitVectors(up, nrm).multiply(q2.setFromAxisAngle(up, ry));
    B.addQ(m, m4.compose(v.set(x, terrainH(x, z) - m.minY * s - sink, z), q, sc.setScalar(s)));
  };
  const stand = (name, x, y, z, s, ry, o) => { const m = Q[name]; if (m) B.addQ(m, m4.compose(v.set(x, y, z), q.setFromAxisAngle(up, ry), sc.setScalar(s)), o); };
  const box = (w, h, d, hex, x, y, z, ry) => B.addPainted(paint(new THREE.BoxGeometry(w, h, d), hex).rotateY(ry).translate(x, y, z), x, z);
  // a post with a hanging lantern; the flame is a small bright shape (its colour is over 1, so it looks lit)
  const lantern = (x, z, ry, postH = 2.5) => {
    const y = height(x, z);
    box(0.17, postH, 0.17, WOOD_DARK, x, y + postH / 2 - 0.1, z, ry);
    stand('Lantern_Wall', x + Math.sin(ry) * 0.06, y + postH - 1.45, z + Math.cos(ry) * 0.06, 1, ry);
    const flame = paint(new THREE.OctahedronGeometry(0.13), 0xffffff); flame.attributes.color.array.forEach((_, i, a) => { a[i] = [5, 3.2, 1.1][i % 3]; });
    B.addPainted(flame.translate(x + Math.sin(ry) * LANTERN_OUT, y + postH - 1.45 + LANTERN_UP, z + Math.cos(ry) * LANTERN_OUT), x, z);
    world.addCollider(x, z, 0.25);
  };
  PATHS.forEach((path, k) => {
    const zone = [Z.forest, Z.beach, Z.volcano][k];
    // walk along the path
    let gate = null, walked = 0, next = 1.5, n = 0;
    for (let i = 1; i < path.length; i++) {
      const [ax, az] = path[i - 1], [bx, bz] = path[i], L = Math.hypot(bx - ax, bz - az), dx = (bx - ax) / L, dz = (bz - az) / L, dir = Math.atan2(dx, dz);
      for (let t = 0; t < L; t += 0.5) {
        const x = ax + dx * t, z = az + dz * t; walked += 0.5;
        const dZone = Math.hypot(x - zone.x, z - zone.z);
        if (!gate && dZone < zone.r + 3.2) gate = [x, z, dir];
        const inBase = z > H.z - 14 && Math.abs(x - H.x) < 17; // (the first path starts on the deck)
        if (walked >= next && !inBase && beachW(x, z) < 0.35 && !(gate && Math.hypot(x - gate[0], z - gate[1]) < 1.2)) {
          const side = (n % 2 ? 1 : -1) * (0.25 + R() * 0.45);
          lay(stones[Math.floor(R() * stones.length)], x + dz * side, z - dx * side, 0.95 + R() * 0.35, dir + (R() - 0.5) * 0.7);
          next = walked + 3.2 + R() * 1.2; n++;
        }
      }
      // at each bend: a lantern post on the outside, a short fence on the inside
      // (not at the fork: the signpost stands there)
      if (i < path.length - 1 && !(k === 0 && i === 1)) {
        const [cx, cz] = path[i + 1], turn = Math.sign((bx - ax) * (cz - bz) - (bz - az) * (cx - bx)) || 1;
        const ox = dz * turn, oz = -dx * turn; // unit vector to the outside of the bend
        lantern(bx + ox * 3.3, bz + oz * 3.3, Math.atan2(-ox, -oz));
        for (let s = 0; s < 3; s++) {
          const fx = bx - ox * 3.4 - dx * (2.1 * (s - 1)), fz = bz - oz * 3.4 - dz * (2.1 * (s - 1));
          stand(s === 1 ? 'Prop_WoodenFence_Extension1' : 'Prop_WoodenFence_Single', fx, height(fx, fz) + 0.02, fz, 1.05, dir + Math.PI / 2);
          world.addCollider(fx, fz, 0.8);
        }
      }
    }
    const [gx, gz, dir] = gate || [...path[path.length - 1], Math.atan2(path[path.length - 1][0] - path[path.length - 2][0], path[path.length - 1][1] - path[path.length - 2][1])];
    // the gate: two posts, a beam and a little roof, the zone's banner, a lantern on each post
    const px = Math.cos(dir), pz = -Math.sin(dir), W = 2.9, Hh = 4.3; // (px, pz) = across the path
    const yb = Math.max(height(gx + px * W, gz + pz * W), height(gx - px * W, gz - pz * W));
    for (const sd of [-1, 1]) {
      const x = gx + px * W * sd, z = gz + pz * W * sd, y = height(x, z);
      box(0.42, yb + Hh - y + 0.3, 0.42, WOOD, x, (y + yb + Hh) / 2 - 0.15, z, dir);
      box(0.6, 0.35, 0.6, WOOD_DARK, x, y + 0.12, z, dir);
      stand('Lantern_Wall', x - Math.sin(dir) * 0.22, yb + 1.25, z - Math.cos(dir) * 0.22, 0.95, dir + Math.PI);
      const flame = paint(new THREE.OctahedronGeometry(0.1), 0xffffff); flame.attributes.color.array.forEach((_, i, a) => { a[i] = [5, 3.2, 1.1][i % 3]; });
      B.addPainted(flame.translate(x - Math.sin(dir) * (0.22 + LANTERN_OUT * 0.95), yb + 1.25 + LANTERN_UP * 0.95, z - Math.cos(dir) * (0.22 + LANTERN_OUT * 0.95)), x, z);
      world.addCollider(x, z, 0.45);
    }
    box(W * 2 + 1.5, 0.36, 0.36, WOOD, gx, yb + Hh - 0.25, gz, dir);
    box(W * 2 + 2.3, 0.2, 0.75, WOOD_DARK, gx, yb + Hh + 0.08, gz, dir);
    stand('Banner_1_Cloth', gx, yb + Hh - 0.42, gz, 0.9, dir + Math.PI, { tint: BANNER[zone.id] });
    stand('Banner_1_Cloth', gx - Math.sin(dir) * 0.02, yb + Hh - 0.42, gz - Math.cos(dir) * 0.02, 0.9, dir, { tint: BANNER[zone.id] });
  });
}
const LANTERN_OUT = 1.1, LANTERN_UP = 0.25; // where the lamp hangs on the Lantern_Wall model

// A wooden board with a zone name, pointing along `dir` (both sides readable).
function signBoard(text, stars, x, y, z, dir) {
  const draw = (arrowRight) => {
    const c = document.createElement('canvas'); c.width = 512; c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#c68a52'; g.beginPath();
    if (arrowRight) { g.moveTo(8, 10); g.lineTo(440, 10); g.lineTo(504, 64); g.lineTo(440, 118); g.lineTo(8, 118); }
    else { g.moveTo(504, 10); g.lineTo(72, 10); g.lineTo(8, 64); g.lineTo(72, 118); g.lineTo(504, 118); }
    g.closePath(); g.fill(); g.strokeStyle = '#7a4a24'; g.lineWidth = 8; g.stroke();
    g.fillStyle = '#2b1a0c'; g.font = "bold 50px 'Fredoka One', sans-serif"; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(stars ? `${text}  ★${stars}` : text, 256, 68);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  };
  const grp = new THREE.Group();
  const geo = new THREE.PlaneGeometry(2.4, 0.6);
  const front = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: draw(true), roughness: 0.9 }));
  const back = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: draw(false), roughness: 0.9 }));
  back.rotation.y = Math.PI;
  front.position.z = 0.02; back.position.z = -0.02;
  grp.add(front, back);
  // the board's +x points along the path, its middle sits next to the post
  grp.rotation.y = dir - Math.PI / 2;
  grp.position.set(x + Math.sin(dir) * 1.1, y, z + Math.cos(dir) * 1.1);
  return grp;
}

// The pier: planks on posts from the sand out over the water. You can walk on it
// (world.height() knows it), so it has no colliders except the things standing on it.
function buildPier(world, put) {
  const P = PIER, g = new THREE.Group();
  g.position.set(P.x0, 0, P.z0); g.rotation.y = Math.atan2(-P.uz, P.ux); // local +x runs out to sea
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const x = c.getContext('2d');
  ['#c98f58', '#bd844f', '#d09a63', '#b97d48'].forEach((col, i) => { x.fillStyle = col; x.fillRect(i * 16, 0, 16, 64); x.fillStyle = 'rgba(70,35,10,.45)'; x.fillRect(i * 16, 0, 1.5, 64); });
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  const planks = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 });
  // deck parts: [from, to, half width, y at from, y at to]; u of the texture runs along the pier
  const parts = [[0, P.ramp, P.half, P.y0, P.top], [P.ramp, P.len - P.headLen, P.half, P.top, P.top], [P.len - P.headLen, P.len, P.headHalf, P.top, P.top]];
  const decks = parts.map(([a0, a1, hw, y0, y1]) => {
    const L = Math.hypot(a1 - a0, y1 - y0), b = new THREE.BoxGeometry(L, 0.16, hw * 2);
    const uv = b.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * L / 2.2 + a0 / 2.2, uv.getY(i));
    b.rotateZ(Math.atan2(y1 - y0, a1 - a0)); b.translate((a0 + a1) / 2, (y0 + y1) / 2 - 0.08, 0);
    return b;
  });
  const deck = new THREE.Mesh(mergeGeometries(decks), planks); deck.castShadow = true; deck.receiveShadow = true; g.add(deck);
  // posts (down to the bay floor) and the beams along both edges
  const wood = [];
  const post = (a, b, top) => wood.push(new THREE.CylinderGeometry(0.17, 0.2, top + 3.2, 7).translate(a, top - (top + 3.2) / 2, b));
  for (let a = 2.5; a < P.len - P.headLen - 1; a += 4) for (const sd of [-1, 1]) post(a, sd * (P.half - 0.05), P.top + (a > 6 ? 0.45 : 0.05));
  for (const a of [P.len - P.headLen + 0.2, P.len - 0.2]) for (const sd of [-1, 1]) post(a, sd * (P.headHalf - 0.2), P.top + 0.75);
  for (const sd of [-1, 1]) wood.push(new THREE.BoxGeometry(P.len - P.headLen - P.ramp, 0.14, 0.16).translate((P.ramp + P.len - P.headLen) / 2, P.top - 0.2, sd * (P.half - 0.05)));
  g.updateMatrix();
  world.batch.addPainted(paint(mergeGeometries(wood), 0x7a4a26).applyMatrix4(g.matrix), P.x0, P.z0);
  world.scene.add(g);
  // things on the pier head, and a boat tied up beside it
  const at = (a, b) => [P.x0 + a * P.ux - b * P.uz, P.z0 + a * P.uz + b * P.ux];
  put('barrel', ...at(P.len - 1, -2.5), { h: 1.0, y: P.top, col: 0.5 });
  put('barrel', ...at(P.len - 2.1, -2.7), { h: 1.0, y: P.top, col: 0.5 });
  put('crate', ...at(P.len - 4.4, 2.6), { h: 0.9, y: P.top, col: 0.6 });
  const lamp = new THREE.Sprite(additive(0xffd27a, 0.7)); lamp.scale.setScalar(1.6);
  lamp.position.set(...(([px, pz]) => [px, P.top + 1.0, pz])(at(P.len - 0.2, P.headHalf - 0.2))); world.scene.add(lamp);
  const boat = put('boat-row-large', ...at(P.len - 8, -P.half - 1.5), { w: 4.6, ry: g.rotation.y, y: WATER_Y - 0.28, live: true });
  return (dt, time) => {
    if (boat) { boat.position.y = WATER_Y - 0.28 + Math.sin(time * 1.1) * 0.05; boat.rotation.z = Math.sin(time * 0.9) * 0.05; }
    lamp.material.opacity = 0.6 + Math.sin(time * 5) * 0.08;
  };
}

// Parasols with towels and a beach ball, all in one mesh (vertex colours).
function beachSet(world, spots, R) {
  const parts = [], col = new THREE.Color();
  const paint = (geo, hex, hex2) => {
    const g = geo.index ? geo.toNonIndexed() : geo, n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col.setHex(hex2 !== undefined && Math.floor(i / 6) % 2 ? hex2 : hex); a[i * 3] = col.r; a[i * 3 + 1] = col.g; a[i * 3 + 2] = col.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.deleteAttribute('uv');
    return g;
  };
  spots.forEach(([x, z, hex], k) => {
    const y = terrainH(x, z), tilt = 0.12 + R() * 0.1, ry = R() * 6.28;
    const m = new THREE.Matrix4().makeTranslation(x, y, z).multiply(new THREE.Matrix4().makeRotationY(ry)).multiply(new THREE.Matrix4().makeRotationZ(tilt));
    parts.push(paint(new THREE.CylinderGeometry(0.05, 0.05, 2.5, 6).translate(0, 1.25, 0), 0xf5f0e6).applyMatrix4(m));
    // canopy: 12 segments, the colour changes every second one
    parts.push(paint(new THREE.ConeGeometry(1.9, 0.75, 12, 1, true).translate(0, 2.55, 0), hex, 0xffffff).applyMatrix4(m));
    // two towels beside it, lying on the sand
    for (const side of [-1, 1]) {
      const tx = x + Math.cos(ry + side * 1.3) * 1.5, tz = z + Math.sin(ry + side * 1.3) * 1.5;
      const tm = new THREE.Matrix4().makeTranslation(tx, terrainH(tx, tz) + 0.04, tz).multiply(new THREE.Matrix4().makeRotationY(ry + 0.4 * side));
      parts.push(paint(new THREE.BoxGeometry(0.9, 0.04, 1.9, 1, 1, 4), side > 0 ? hex : 0xffffff, side > 0 ? 0xffffff : [0x5aa8ff, 0xff8585, 0xb57bff, 0xffcf5e][k % 4]).applyMatrix4(tm));
    }
    world.addCollider(x, z, 0.3);
  });
  const [bx, bz] = [spots[0][0] + 2.6, spots[0][1] - 2.2];
  parts.push(paint(new THREE.SphereGeometry(0.38, 12, 8), 0xff8585, 0xffffff).applyMatrix4(new THREE.Matrix4().makeTranslation(bx, terrainH(bx, bz) + 0.36, bz)));
  world.addCollider(bx, bz, 0.4);
  world.batch.addPainted(mergeGeometries(parts), spots[0][0], spots[0][1]);
}

function additive(color, opacity = 0.8) {
  return new THREE.SpriteMaterial({ map: glowTex(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity });
}
function campfire(S, x, y, z) {
  const flames = [0xff7a1a, 0xffb020, 0xffe08a].map((c, i) => {
    const s = new THREE.Sprite(additive(c, 0.9)); s.position.set(x, y + 0.2 + i * 0.25, z); S.add(s); return s;
  });
  const glow = new THREE.Sprite(additive(0xff8a3d, 0.35)); glow.scale.setScalar(6); glow.position.set(x, y + 0.4, z); S.add(glow);
  return (dt, time) => {
    flames.forEach((s, i) => { const k = 1 + Math.sin(time * (9 + i * 3) + i) * 0.18 + Math.sin(time * 23 + i) * 0.08; s.scale.set(1.3 * k - i * 0.25, 1.7 * k - i * 0.3, 1); });
    glow.material.opacity = 0.3 + Math.sin(time * 7) * 0.05;
  };
}
function fireflies(S, zone, R) {
  const n = 70, pos = new Float32Array(n * 3), base = [];
  for (let i = 0; i < n; i++) {
    const a = R() * 6.28, d = Math.sqrt(R()) * (zone.r - 2);
    const x = zone.x + Math.cos(a) * d, z = zone.z + Math.sin(a) * d;
    base.push([x, height(x, z) + 0.8 + R() * 2.2, z, R() * 10]);
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ map: glowTex(), color: 0xd8ff7a, size: 0.55, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.85 });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; S.add(pts);
  return (dt, time) => {
    for (let i = 0; i < n; i++) {
      const b = base[i], p = time * 0.4 + b[3];
      pos[i * 3] = b[0] + Math.sin(p) * 1.2; pos[i * 3 + 1] = b[1] + Math.sin(p * 1.7) * 0.4; pos[i * 3 + 2] = b[2] + Math.cos(p * 0.8) * 1.2;
    }
    geo.attributes.position.needsUpdate = true;
    mat.opacity = 0.6 + Math.sin(time * 3) * 0.25;
  };
}
function smoke(S, x, y, z) {
  const puffs = Array.from({ length: 10 }, (_, i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0x8a8590, transparent: true, depthWrite: false, opacity: 0.5 }));
    S.add(s); return { s, t: i * 0.9 };
  });
  return (dt) => {
    for (const p of puffs) {
      p.t = (p.t + dt) % 9; const k = p.t / 9;
      p.s.position.set(x + Math.sin(p.t * 0.7) * 2 + k * 6, y + k * 26, z + Math.cos(p.t * 0.5) * 2);
      p.s.scale.setScalar(4 + k * 14);
      p.s.material.opacity = 0.55 * (1 - k);
    }
  };
}
function lighthouse(S, x, y, z) {
  const beam = new THREE.Mesh(new THREE.ConeGeometry(4, 40, 16, 1, true).rotateZ(Math.PI / 2).translate(20, 0, 0),
    new THREE.MeshBasicMaterial({ color: 0xfff3b0, transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
  beam.position.set(x, y, z); S.add(beam);
  const lamp = new THREE.Sprite(additive(0xfff3b0, 0.9)); lamp.scale.setScalar(5); lamp.position.set(x, y, z); S.add(lamp);
  return (dt, time) => { beam.rotation.y = time * 0.6; };
}
function clouds(S, R) {
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xc8d4e0, flatShading: true, transparent: true, opacity: 0.95, fog: false });
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const list = Array.from({ length: 16 }, () => {
    const n = 4 + Math.floor(R() * 4), puffs = [];
    for (let i = 0; i < n; i++) { // one mesh per cloud
      const sc = 3 + R() * 3;
      puffs.push(geo.clone().scale(sc, sc * 0.65, sc).translate((i - n / 2) * 3.2 + R() * 1.5, R() * 1.5, R() * 3));
    }
    const g = new THREE.Mesh(mergeGeometries(puffs), mat);
    g.position.set(-220 + R() * 440, 55 + R() * 25, -180 + R() * 320);
    S.add(g); return { g, v: 1.2 + R() * 1.5 };
  });
  return (dt) => { for (const c of list) { c.g.position.x += c.v * dt; if (c.g.position.x > 240) c.g.position.x = -240; } };
}
// Birds and butterflies: all wings of a kind are one InstancedMesh (matrices set every frame).
const _g = new THREE.Matrix4(), _w = new THREE.Matrix4(), _m = new THREE.Matrix4();
const _flip = new THREE.Matrix4().makeRotationY(Math.PI);
function wingPair(im, i, pos, yaw, flap) {
  _g.makeRotationY(yaw).setPosition(pos[0], pos[1], pos[2]);
  im.setMatrixAt(i * 2, _m.multiplyMatrices(_g, _w.makeRotationZ(flap)));
  im.setMatrixAt(i * 2 + 1, _m.multiplyMatrices(_g, _flip).multiply(_w.makeRotationZ(-flap)));
}
function seagulls(S, cx, cz, R) {
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  const n = 6;
  const wings = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.9, 0.3).translate(0.45, 0, 0), mat, n * 2);
  const bodies = new THREE.InstancedMesh(new THREE.SphereGeometry(0.16, 6, 4).scale(1, 1, 2.2), mat, n);
  wings.frustumCulled = bodies.frustumCulled = false; S.add(wings, bodies);
  const birds = Array.from({ length: n }, () => ({ rad: 10 + R() * 14, h: 14 + R() * 8, sp: 0.25 + R() * 0.2, ph: R() * 6.28 }));
  return (dt, time) => {
    birds.forEach((b, i) => {
      const a = time * b.sp + b.ph, pos = [cx + Math.cos(a) * b.rad, b.h + Math.sin(time * 0.7 + b.ph) * 1.5, cz + Math.sin(a) * b.rad];
      wingPair(wings, i, pos, -a, Math.sin(time * 8 + b.ph) * 0.5); // fly along the circle
      bodies.setMatrixAt(i, _g);
    });
    wings.instanceMatrix.needsUpdate = bodies.instanceMatrix.needsUpdate = true;
  };
}
function butterflies(S, centers, R) {
  if (!centers.length) return null;
  const n = 26, col = new THREE.Color();
  const im = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.22, 0.18).translate(0.11, 0, 0), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), n * 2);
  im.frustumCulled = false; S.add(im);
  const list = Array.from({ length: n }, (_, i) => {
    const c = centers[i % centers.length];
    col.setHex([0xff8585, 0xffcf5e, 0x9fe8ff, 0xc9b6ff, 0xffffff][i % 5]); im.setColorAt(i * 2, col); im.setColorAt(i * 2 + 1, col);
    return { cx: c[0], cz: c[1], y: height(c[0], c[1]) + 0.9, ph: R() * 10, sp: 0.5 + R() * 0.5 };
  });
  return (dt, time) => {
    list.forEach((b, i) => {
      const p = time * b.sp + b.ph;
      wingPair(im, i, [b.cx + Math.sin(p) * 2.5, b.y + Math.sin(p * 2.3) * 0.4, b.cz + Math.sin(p * 1.3) * 2.5],
        Math.atan2(Math.cos(p), Math.cos(p * 1.3)), Math.sin(time * 18 + b.ph) * 1.1);
    });
    im.instanceMatrix.needsUpdate = true;
  };
}
