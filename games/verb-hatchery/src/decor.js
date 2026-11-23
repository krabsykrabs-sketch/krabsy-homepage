// Set pieces and life for the island (all CC0, see assets/CREDITS.md):
// Home: the hatchery (a long house with a tower and a wind wheel, Quaternius village
//   kit), a fenced yard with lantern posts and benches, a fountain, a playground, a
//   picnic, a farm with real crops, a wagon and a market stall.
// Meadow: flower fields with butterflies, a ring of standing stones, a pond with lily
//   pads and a canoe, signposts where the paths fork; landmarks to find your way by:
//   a hill with one huge tree, a stream with a stone bridge, a scarecrow in a wheat
//   field, a ruin.
// Forest: mushrooms (some giant), stumps, logs, a camp in a clearing with a crackling
//   fire, fireflies.
// Beach: a bay with a walkable pier, palms along the dunes, a shipwreck on the rocks,
//   parasols and towels, sandcastles, boats, a treasure dig, an islet, seagulls, a
//   pirate ship at anchor in the bay mouth, the lighthouse on the north headland.
// Volcano: stone heads guarding it, glowing crystals, smoke from the crater, embers
//   over the lava streams.
// Sea: three tiny islands, a few rock stacks. Sky: drifting clouds.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ZONES, ISLAND, HOME } from './balance.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { height, terrainH, groundH, zoneAt, pathDist, POND, pondPoint, PATHS, FORK, WATER_Y, glowTex, BAY, PIER, ISLET, bayPoint, beachW,
  HATCHERY, DECK, CAMP, HILL, FIELD, RUIN, BRIDGE, bridgeTop, LIGHT, ISLETS, LAVA_ANGLES, lavaPoint, LAVA_RIM, LAVA_END } from './world.js';
import { paint, paintMat } from './merge.js';
import { rng } from './creatures.js';
import { t } from './i18n.js';

const Z = Object.fromEntries(ZONES.map((z) => [z.id, z]));
const F = {}; // short name → file
const add = (dir, ext, names) => names.forEach((n) => { F[n] = `assets/props/${dir}/${n}.${ext}`; });
add('nature', 'glb', ['lily_large', 'lily_small', 'statue_head', 'canoe']);
add('pirate', 'glb', ['palm-detailed-bend', 'palm-detailed-straight', 'palm-bend', 'ship-wreck', 'ship-pirate-large', 'boat-row-small',
  'barrel', 'crate', 'chest', 'flag-pirate-high', 'rocks-sand-a', 'rocks-sand-b', 'tower-complete-small',
  'palm-straight', 'rocks-a', 'rocks-b', 'rocks-c', 'boat-row-large', 'bottle', 'tool-shovel', 'hole']);
add('survival', 'glb', ['signpost', 'bedroll']);
add('playground', 'gltf', ['swing_A_large', 'slide_A', 'seesaw_large', 'merry_go_round', 'sandbox_round_decorated', 'spring_horse_A',
  'sandcastle_A', 'sandcastle_B', 'sandcastle_C', 'picnic_table']);
add('picnic', 'gltf', ['picnic_blanket_red', 'picnic_basket_round', 'teapot', 'apple', 'sandwich', 'pillow_large_blue']);
add('park', 'gltf', ['fountain']);
add('gems', 'gltf', ['Gem_Large', 'Gem_Medium']);

// Spots kept free of random trees and rocks (world.loadDecor reads them): [x, z, r]
const H = HOME;
const SPOT = {
  playground: [H.x - 29, H.z - 2], picnic: [H.x + 24, H.z - 5], farm: [H.x + 30, H.z + 16],
  circle: [-30, 30], camp: [CAMP.x, CAMP.z],
};
export function reserveSpots(world) {
  world.reserved.push([...SPOT.playground, 12], [...SPOT.picnic, 6], [...SPOT.farm, 12], [...SPOT.circle, 10],
    [...SPOT.camp, 10.5], [FORK.x, FORK.z, 4],
    [HILL.x, HILL.z, 9], [FIELD.x, FIELD.z, 13], [RUIN.x, RUIN.z, 10], [LIGHT.x, LIGHT.z, 8],
    [BRIDGE.x + BRIDGE.ux * 10, BRIDGE.z + BRIDGE.uz * 10, 4], [BRIDGE.x - BRIDGE.ux * 10, BRIDGE.z - BRIDGE.uz * 10, 4]);
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

  // A pack model with its own turn / tilt / stretch: s = scale or [sx, sy, sz]; o.rx / o.rz tilt it.
  const qe = new THREE.Euler();
  const Qp = (n, x, y, z, ry = 0, s = 1, o = {}) => {
    const m = Q[n]; if (!m) return;
    qe.set(o.rx || 0, ry, o.rz || 0, 'YXZ');
    world.batch.addQ(m, m4.compose(v3.set(x, y, z), q.setFromEuler(qe), Array.isArray(s) ? sc.set(s[0], s[1], s[2]) : sc.setScalar(s)), o);
  };
  // painted boxes / cylinders (static batch); `at` = which cell they belong to
  const box = (w, h, d, hex, x, y, z, ry = 0, rz = 0) => world.batch.addPainted(paint(new THREE.BoxGeometry(w, h, d), hex).rotateZ(rz).rotateY(ry).translate(x, y, z), x, z);
  const T = { Qp, box, put, R, lantern: (x, z, ry, postH) => lanternPost(world, Q, x, z, ry, postH) };

  // ── home: the hatchery, its yard, the farm ──
  life.push(buildHatchery(world, T));
  for (const sx of [-1, 1]) {
    Qp('Bench', H.x + sx * 9.5, height(H.x, H.z - 12.9), H.z - 12.9, 0, 1.15); world.addCollider(H.x + sx * 9.5, H.z - 12.9, 0.9); world.addCollider(H.x + sx * 9.5 + 1, H.z - 12.9, 0.6); world.addCollider(H.x + sx * 9.5 - 1, H.z - 12.9, 0.6);
    for (let k = 0; k < 3; k++) put('Bush_Common_Flowers', H.x + sx * (18.2 + k * 0.2), H.z - 6 + k * 8, { h: 1.7, col: 0.9, tint: 0x77bb3e });
    Qp('Barrel', H.x + sx * 6.5, HATCHERY.y, H.z - 10.3, R() * 6.28, 1.1); world.addCollider(H.x + sx * 6.5, H.z - 10.3, 0.45);
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
  // the farm beside the base: four beds (pumpkins, carrots, tomatoes, corn) inside a
  // wooden fence, open towards the yard; a wagon, a market stall and crates at its gate
  const [fx, fz] = SPOT.farm;
  [['Crop_Pumpkin', 1.25, 0.02], ['Crop_Carrot', 1.0, 0.0], ['Crop_Tomato', 0.95, 0.0], ['Crop_Corn', 1.0, 0.0]].forEach(([n, s0, lift], r) => {
    const z = fz - 3.6 + r * 2.4, y = height(fx, z) + 0.2;
    box(10.4, 0.34, 1.5, 0x7a5234, fx, y - 0.15, z); box(10.0, 0.1, 1.1, 0x6a452b, fx, y + 0.02, z);
    for (let i = 0; i < 6; i++) Qp(n, fx - 4.2 + i * 1.68 + (R() - 0.5) * 0.25, y + 0.05 + lift, z + (R() - 0.5) * 0.2, R() * 6.28, s0 * (0.85 + R() * 0.3));
  });
  fenceRun(world, T, [[fx - 6.3, fz - 5.4], [fx + 6.3, fz - 5.4], [fx + 6.3, fz + 5.4], [fx - 6.3, fz + 5.4], [fx - 6.3, fz + 2.2]]);
  fenceRun(world, T, [[fx - 6.3, fz - 2.2], [fx - 6.3, fz - 5.4]]);
  Qp('Prop_Wagon', fx - 9.2, height(fx - 9.2, fz - 4.6), fz - 4.6, 2.2, 1.0); world.addCollider(fx - 9.2, fz - 4.6, 1.2); world.addCollider(fx - 8.2, fz - 6.0, 1.0);
  Qp('Stall_Empty', fx - 8.8, height(fx - 8.8, fz + 4.4), fz + 4.4, 1.9, 1.15, { tint: 0xff8585 }); world.addCollider(fx - 8.8, fz + 4.4, 1.1);
  Qp('FarmCrate_Carrot', fx - 7.5, height(fx - 7.5, fz + 2.6), fz + 2.6, 0.6, 1.3);
  Qp('Crate_Wooden', fx - 7.4, height(fx - 7.4, fz - 2.5), fz - 2.5, 0.3, 0.85); world.addCollider(fx - 7.4, fz - 2.5, 0.6);
  Qp('Bag', fx - 7.9, height(fx - 7.9, fz - 1.5), fz - 1.5, 1.1, 1.0);
  Qp('Crop_Pumpkin', fx - 7.0, height(fx - 7.0, fz + 1.4) + 0.02, fz + 1.4, 2.0, 1.5);

  // ── signposts where the paths fork, with the zone names ──
  put('signpost', FORK.x, FORK.z, { h: 2.6, ry: 0, col: 0.4 });
  const ICON = { forest: '🌲', beach: '🏖️', volcano: '🌋' };
  ['forest', 'beach', 'volcano'].forEach((id, k) => {
    const p = PATHS[k], a = k === 0 ? p[1] : p[0], b = k === 0 ? p[2] : p[1];
    const dir = Math.atan2(b[0] - a[0], b[1] - a[1]);
    world.scene.add(signBoard(`${ICON[id]} ${t(`zone_${id}`)}`, Z[id].stars, FORK.x, height(FORK.x, FORK.z) + 2.4 - k * 0.55, FORK.z, dir));
  });

  // ── paths you can read: stepping stones, lantern posts, bits of fence, a gate at each zone ──
  const lay = pathDressing(world, Q, rng('paths'));

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
  // (standing stones: the pack's rocks, stretched tall; one has fallen over)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2, x = sx0 + Math.cos(a) * 6.5, z = sz0 + Math.sin(a) * 6.5, tall = 1.5 + R() * 0.5;
    if (i === 5) Qp('Rock_Lo_2', x, height(x, z) + 0.25, z, a, [0.5, 1.6, 0.55], { rz: 1.45, mul: 0xeeeade });
    else Qp(`Rock_Lo_${1 + (i % 3)}`, x, height(x, z) - 0.45, z, a + R(), [0.5, tall, 0.55], { rz: (R() - 0.5) * 0.16, mul: 0xeeeade });
    world.addCollider(x, z, 0.75);
  }
  Qp('Rock_Medium_2', sx0, height(sx0, sz0) - 0.25, sz0, 0.4, [1.0, 0.45, 0.9], { mul: 0xeeeade }); world.addCollider(sx0, sz0, 1.5); // the altar stone in the middle
  // the Meadow's landmarks
  hillTop(world, T); bridge(world, T, lay); scarecrowField(world, T); ruin(world, T);
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
  // stumps and fallen logs (built in code, in the bark colour of the pack's trees)
  for (let i = 0; i < 10; i++) { const [x, z] = around(F0.x, F0.z, F0.r - 3); if (free(x, z, 1.5) && Math.hypot(x - CAMP.x, z - CAMP.z) > 9) { stump(world, x, z, 0.38 + R() * 0.2, 0.5 + R() * 0.5); world.addCollider(x, z, 0.6); } }
  for (let i = 0; i < 7; i++) { const [x, z] = around(F0.x, F0.z, F0.r - 3); if (free(x, z, 1.5) && Math.hypot(x - CAMP.x, z - CAMP.z) > 9) { logAt(world, x, z, 2.6 + R() * 1.4, 0.27 + R() * 0.1, R() * 6.28); world.addCollider(x, z, 0.8); } }
  life.push(camp(world, T, lay));
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
    put('statue_head', x, z, { h: 3.4, ry: a - Math.PI / 2, col: 1.2, mul: 0xb3a29b }); // the model faces +x: turn it to look outwards (darkened: the Volcano's own rock)
  }
  const crystal = (n, x, z, h, color) => put(n, x, z, { h, col: 0.3, mul: color, glow: 0.6 });
  for (let i = 0; i < 14; i++) {
    let a = R() * 6.28; const r = 8 + R() * (V.r - 10);
    if (LAVA_ANGLES.some((la) => Math.abs(Math.atan2(Math.sin(a - la), Math.cos(a - la))) < 0.2)) a += 0.4; // not in a lava stream
    crystal(i % 2 ? 'Gem_Large' : 'Gem_Medium', V.x + Math.cos(a) * r, V.z + Math.sin(a) * r, 1.0 + R() * 1.2, [0xb57bff, 0xff8a3d, 0xff5fb0][i % 3]);
  }
  life.push(smoke(S, V.x, world.lavaY + 1, V.z));
  life.push(embers(S, R));

  // ── the lighthouse on the Beach's north headland (seen from the bay and from the Meadow) ──
  {
    const lx = LIGHT.x, lz = LIGHT.z, ly = groundH(lx, lz);
    const tower = put('tower-complete-small', lx, lz, { h: 12.5, y: ly - 0.3, ry: 0.6 });
    world.addCollider(lx, lz, 2.1);
    if (tower) { life.push(lighthouse(S, lx, ly + 11.2, lz)); world.batch.addPainted(flameGeo(0.55).scale(1, 1.3, 1).translate(lx, ly + 11.2, lz), lx, lz); } // (the lamp: a bright shape, no sprite)
    for (const [a, d, s0] of [[0.3, 4.2, 1.1], [1.9, 4.8, 0.8], [3.4, 4.4, 1.3], [4.6, 5.2, 0.9], [5.5, 6.5, 0.7]]) {
      const x = lx + Math.cos(a) * d, z = lz + Math.sin(a) * d;
      Qp(`Rock_Lo_${1 + Math.floor(R() * 3)}`, x, groundH(x, z) - 0.4 * s0, z, R() * 6.28, s0, { mul: 0xe6e2d8 }); world.addCollider(x, z, 1.2 * s0);
    }
  }
  // ── sea: three tiny islands (not reachable) and a few rock stacks ──
  ISLETS.forEach((I, k) => {
    const at = (dx, dz) => [I.x + dx, groundH(I.x + dx, I.z + dz), I.z + dz];
    if (k === 0) { // pines
      for (const [dx, dz, s0] of [[0, 0, 1.0], [2.6, 1.2, 0.75], [-2.2, 1.8, 0.85]]) { const [x, y, z] = at(dx, dz); Qp(`Pine_${1 + Math.floor(R() * 5)}`, x, y - 0.1, z, R() * 6.28, s0, { tint: 0x3f9458 }); }
      const [x, y, z] = at(-3.5, -1.5); Qp('Rock_Lo_1', x, y - 0.4, z, 1, 1.2, { mul: 0xe6e2d8 });
    } else if (k === 1) { // a rock stack with a dead tree
      for (const [dx, dz, s0, sy] of [[0, 0, 2.0, 1.5], [2.4, 1.0, 1.3, 1.0], [-2.0, -1.4, 1.1, 0.8]]) { const [x, y, z] = at(dx, dz); Qp(`Rock_Lo_${1 + Math.floor(R() * 3)}`, x, y - 0.5, z, R() * 6.28, [s0, s0 * sy, s0], { mul: 0xe6e2d8 }); }
      const [x, y, z] = at(-0.8, 2.6); Qp('DeadTree_2', x, y - 0.1, z, 0.5, 0.42, {});
    } else { // palms
      inst('palm-detailed-bend', [{ x: I.x + 0.6, z: I.z - 0.4, h: 7.5 }, { x: I.x - 1.8, z: I.z + 1.2, h: 5.8 }], {});
      inst('palm-straight', [{ x: I.x + 2.0, z: I.z + 1.6, h: 6.4 }], {});
      const [x, y, z] = at(-2.6, -1.8); Qp('Rock_Lo_3', x, y - 0.3, z, 2, 0.9, { mul: 0xe6e2d8 });
    }
  });
  for (const [x, z, s0] of [[121, 50, 1.5], [-88, -108, 2.0], [38, 119, 1.3], [-127, -30, 1.8], [-40, -146, 1.6]]) {
    Qp('Rock_Lo_3', x, WATER_Y - 1.1 * s0, z, x, [s0, s0 * 1.6, s0], { mul: 0xe6e2d8 }); Qp('Rock_Lo_2', x + 2.2 * s0, WATER_Y - 0.9 * s0, z + 1.2, z, s0 * 0.8, { mul: 0xe6e2d8 });
  }

  // ── sky ──
  life.push(clouds(S, rng('clouds')));       // (own random streams: later changes to the props above don't move them)
  life.push(butterflies(S, fieldCenters, rng('butterflies')));
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
    nrm.set(groundH(x - 0.6, z) - groundH(x + 0.6, z), 1.2, groundH(x, z - 0.6) - groundH(x, z + 0.6)).normalize();
    q.setFromUnitVectors(up, nrm).multiply(q2.setFromAxisAngle(up, ry));
    B.addQ(m, m4.compose(v.set(x, height(x, z) - m.minY * s - sink, z), q, sc.setScalar(s)));
  };
  const stand = (name, x, y, z, s, ry, o) => { const m = Q[name]; if (m) B.addQ(m, m4.compose(v.set(x, y, z), q.setFromAxisAngle(up, ry), sc.setScalar(s)), o); };
  const box = (w, h, d, hex, x, y, z, ry) => B.addPainted(paint(new THREE.BoxGeometry(w, h, d), hex).rotateY(ry).translate(x, y, z), x, z);
  const lantern = (x, z, ry, postH) => lanternPost(world, Q, x, z, ry, postH);
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
  return lay;
}
const LANTERN_OUT = 1.1, LANTERN_UP = 0.25; // where the lamp hangs on the Lantern_Wall model
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
// A wooden post with a hanging lantern; the flame is a small bright shape (its colour is
// over 1, so it looks lit). ry = the direction the arm points. y = the ground (default) or a floor.
function lanternPost(world, Q, x, z, ry, postH = 2.5, y = height(x, z)) {
  const B = world.batch;
  B.addPainted(paint(new THREE.BoxGeometry(0.17, postH, 0.17), 0x6e4628).rotateY(ry).translate(x, y + postH / 2 - 0.1, z), x, z);
  if (Q.Lantern_Wall) B.addQ(Q.Lantern_Wall, _m4.compose(_v.set(x + Math.sin(ry) * 0.06, y + postH - 1.45, z + Math.cos(ry) * 0.06), _q.setFromAxisAngle(_up, ry), _s.setScalar(1)));
  B.addPainted(flameGeo(0.13).translate(x + Math.sin(ry) * LANTERN_OUT, y + postH - 1.45 + LANTERN_UP, z + Math.cos(ry) * LANTERN_OUT), x, z);
  world.addCollider(x, z, 0.25);
}
function flameGeo(r) { const f = paint(new THREE.OctahedronGeometry(r), 0xffffff); f.attributes.color.array.forEach((_, i, a) => { a[i] = [5, 3.2, 1.1][i % 3]; }); return f; }
// A wooden fence along a line of points (2 m pieces, a collider each).
function fenceRun(world, T, pts) {
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i], L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / 2.1)), ry = Math.atan2(bx - ax, bz - az) + Math.PI / 2;
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      T.Qp((i + k) % 3 === 0 ? 'Prop_WoodenFence_Extension1' : 'Prop_WoodenFence_Single', x, height(x, z) + 0.02, z, ry, [L / n / 2, 1.05, 1.05]);
      world.addCollider(x, z, Math.min(0.8, L / n * 0.4));
    }
  }
}

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

// ── the hatchery: a long house with a tall tiled roof, a tower with a wind wheel, a
// sign board on posts, a fenced yard (Quaternius Medieval Village kit; positions in
// world.js HATCHERY). Walls are 2 m modules whose outside faces the model's +z.
function buildHatchery(world, T) {
  const { Qp, box } = T, { hall: A, tower: W, y: Y, wallH: WH, sign: SG } = HATCHERY, PI = Math.PI;
  const ROOF = 0xff8585, ROOF2 = 0xf07272, STONE = 0x9a958a, WOOD = 0x7a4a26, WOOD_DARK = 0x6e4628;
  const x0 = A.x - A.w / 2, x1 = A.x + A.w / 2, z0 = A.z - A.d / 2, z1 = A.z + A.d / 2;
  box(A.w + 0.5, 0.8, A.d + 0.5, STONE, A.x, Y - 0.27, A.z); box(4.5, 0.8, 4.5, STONE, W.x, Y - 0.27, W.z); // stone base
  const win = (x, y, z, ry, shutters, brick) => {
    Qp(brick ? 'Wall_UnevenBrick_Window_Wide_Round' : 'Wall_Plaster_Window_Wide_Round', x, y, z, ry); Qp('Window_Wide_Round1', x, y, z, ry);
    if (shutters) Qp('WindowShutters_Wide_Round_Open', x, y, z, ry, 1, { mul: 0x8fe0d2 });
  };
  // hall, front (faces the yard): windows with shutters, the door in the middle
  ['W', 'G', 'W', 'D', 'W', 'G', 'W'].forEach((k, i) => {
    const x = x0 + 1 + i * 2;
    if (k === 'W') win(x, Y, z0, PI, true);
    else if (k === 'G') Qp('Wall_Plaster_WoodGrid', x, Y, z0, PI);
    else { Qp('Wall_Plaster_Door_Round', x, Y, z0, PI); Qp('DoorFrame_Round_WoodDark', x, Y, z0, PI); Qp('Door_1_Round', x + 0.55, Y, z0 - 0.02, PI); }
  });
  for (let i = 0; i < 7; i++) Qp('Wall_Plaster_Straight', x0 + 1 + i * 2, Y, z1, 0);                         // back
  for (let j = 0; j < 4; j++) {                                                                               // sides
    const z = z0 + 1 + j * 2;
    if (j === 1) win(x0, Y, z, -PI / 2, false); else Qp('Wall_Plaster_Straight', x0, Y, z, -PI / 2);
    if (j === 2) win(x1, Y, z, PI / 2, false); else if (j > 0) Qp('Wall_Plaster_Straight', x1, Y, z, PI / 2); // (the tower stands in front of the first one)
  }
  for (const cx of [x0, x1]) for (const cz of [z0, z1]) Qp('Corner_Exterior_Wood', cx, Y, cz, 0, [1.3, 1, 1.3]);
  // roof (ridge along x; the kit's roof is 8 × 12 m, stretched to the hall's length), gables, chimney
  Qp('Roof_RoundTiles_8x12', A.x, Y + WH, A.z, PI / 2, [1, 1, (A.w + 1.3) / 14.2], { tint: ROOF });
  Qp('Roof_Front_Brick8', x1, Y + WH, A.z, PI / 2); Qp('Roof_Front_Brick8', x0, Y + WH, A.z, -PI / 2);
  Qp('Prop_Chimney2', A.x - 4, Y + WH + 2.5, A.z + 2.0, 0, 1.3);
  // tower: three floors of stone, windows at the top, a pointed roof
  for (let f = 0; f < W.floors; f++) {
    const y = Y + f * WH, top = f === W.floors - 1;
    for (const d of [-1, 1]) {
      if (top) win(W.x + d, y, W.z - 2, PI, false, true); else Qp('Wall_UnevenBrick_Straight', W.x + d, y, W.z - 2, PI);
      Qp('Wall_UnevenBrick_Straight', W.x + d, y, W.z + 2, 0);
      if (top && d < 0) win(W.x + 2, y, W.z + d, PI / 2, false, true); else Qp('Wall_UnevenBrick_Straight', W.x + 2, y, W.z + d, PI / 2);
      if (!(f === 0 && d > 0)) Qp('Wall_UnevenBrick_Straight', W.x - 2, y, W.z + d, -PI / 2); // (the hall hides that one)
    }
    for (const cx of [-2, 2]) for (const cz of [-2, 2]) Qp('Corner_Exterior_Wood', W.x + cx, y, W.z + cz, 0, [1.3, 1, 1.3]);
  }
  Qp('Roof_Tower_RoundTiles', W.x, Y + W.floors * WH, W.z, 0, 1, { tint: ROOF2 });
  Qp('Banner_1_Cloth', W.x + 2.16, Y + 2 * WH + 0.1, W.z + 1, PI / 2, 1.25, { tint: 0x2ee6c0 });
  // the wind wheel on the tower's front: four sails, turning slowly (its own mesh)
  const parts = [paint(new THREE.CylinderGeometry(0.3, 0.3, 0.5, 10).rotateX(PI / 2), WOOD_DARK)];
  for (let b = 0; b < 4; b++) {
    const m = new THREE.Matrix4().makeRotationZ(b * PI / 2);
    parts.push(paint(new THREE.BoxGeometry(0.16, 3.5, 0.12).translate(0, 1.75, 0), 0x8a5c36).applyMatrix4(m));
    parts.push(paint(new THREE.BoxGeometry(0.95, 2.5, 0.05).translate(0.56, 2.15, 0.03), 0xfff1d6).applyMatrix4(m));
    for (const yy of [0.95, 1.8, 2.65, 3.38]) parts.push(paint(new THREE.BoxGeometry(1.06, 0.07, 0.09).translate(0.56, yy, 0), 0x8a5c36).applyMatrix4(m));
  }
  const wheel = new THREE.Mesh(mergeGeometries(parts), paintMat());
  wheel.position.set(W.x, Y + 2 * WH + 0.9, W.z - 2 - 0.8); wheel.castShadow = true; world.scene.add(wheel);
  box(0.22, 0.22, 1.0, WOOD_DARK, W.x, Y + 2 * WH + 0.9, W.z - 2 - 0.35);
  // the sign board's frame: two posts, the board behind the painted sign, a little roof
  const top = SG.y + SG.w / 8 + 0.35;
  for (const sx of [-1, 1]) { const x = A.x + sx * (SG.w / 2 - 0.5); box(0.3, top - Y, 0.3, WOOD, x, (top + Y) / 2, SG.z + 0.14); world.addCollider(x, SG.z + 0.14, 0.3); }
  box(SG.w + 0.3, SG.w / 4 + 0.3, 0.12, WOOD, A.x, SG.y, SG.z);
  box(SG.w + 1.0, 0.16, 0.8, WOOD_DARK, A.x, top + 0.06, SG.z + 0.05);
  // yard fence: open to the north (where you arrive), a gate on each side, lantern posts
  const fz = DECK.z0 - 0.6, fw = DECK.x0 - 0.7, fe = DECK.x1 + 0.7, g0 = HOME.z - 1.2, g1 = HOME.z + 3.2;
  fenceRun(world, T, [[fw + 4.2, fz], [fw, fz], [fw, g0]]); fenceRun(world, T, [[fw, g1], [fw, z0 + 0.6], [x0 - 0.3, z0 + 0.6]]);
  fenceRun(world, T, [[fe - 4.2, fz], [fe, fz], [fe, g0]]); fenceRun(world, T, [[fe, g1], [fe, z0 + 0.6], [W.x + 2.4, z0 + 0.6]]);
  for (const x of [fw + 4.6, -4.6, 4.6, fe - 4.6]) T.lantern(x, fz, PI);
  for (const [x, ry] of [[fw, PI / 2], [fe, -PI / 2]]) { T.lantern(x, g0 + 0.25, ry, 2.7); T.lantern(x, g1 - 0.25, ry, 2.7); }
  return (dt, time) => { wheel.rotation.z = -time * 0.45; };
}

// ── Meadow landmark: the hill with the giant tree (the tree itself: world.loadDecor) ──
function hillTop(world, T) {
  const { Qp, R } = T, at = (dx, dz) => [HILL.x + dx, height(HILL.x + dx, HILL.z + dz), HILL.z + dz];
  { const [x, y, z] = at(-2.6, 4.4); Qp('Bench', x, y, z, 0.5, 1.2); world.addCollider(x, z, 0.9); world.addCollider(x - 0.95, z + 0.5, 0.6); world.addCollider(x + 0.95, z - 0.5, 0.6); }
  T.lantern(HILL.x + 3.6, HILL.z + 3.4, -2.3);
  for (const [dx, dz, s0, n] of [[-5.2, -1.6, 0.8, 'Rock_Medium_1'], [4.6, -3.4, 0.55, 'Rock_Medium_2'], [1.2, -5.8, 0.4, 'Rock_Lo_3']]) { const [x, y, z] = at(dx, dz); Qp(n, x, y - 0.3 * s0, z, R() * 6.28, s0); world.addCollider(x, z, 1.4 * s0); }
  for (let i = 0; i < 12; i++) { const a = i * 0.52 + R() * 0.3, d = 5.5 + R() * 5; T.put(i % 3 ? 'Flower_3_Single' : 'Flower_4_Single', HILL.x + Math.cos(a) * d, HILL.z + Math.sin(a) * d, { h: 0.6 + R() * 0.3 }); }
}

// ── Meadow landmark: a stone bridge over the stream (you walk over it: world.height knows it) ──
function bridge(world, T, lay) {
  const B = BRIDGE, L = B.len, parts = [], STONE = [0xb3aea2, 0xa39e92, 0xbdb8ab, 0x979286];
  const seg = 1.25, n = Math.round(L / seg), PIER = 3.3;
  for (let i = 0; i < n; i++) {
    const a0 = -L / 2 + i * seg, a1 = a0 + seg, am = (a0 + a1) / 2, y0 = bridgeTop(a0), y1 = bridgeTop(a1), ym = (y0 + y1) / 2, rz = Math.atan2(y1 - y0, seg), len = Math.hypot(seg, y1 - y0) + 0.03;
    parts.push(paint(new THREE.BoxGeometry(len, 0.4, B.half * 2 + 0.5), STONE[i % 4]).rotateZ(rz).translate(am, ym - 0.2, 0));
    // side walls: a low parapet above, and below the deck deeper towards the piers (so the openings look arched)
    const p = Math.min(Math.abs(am - PIER), Math.abs(am + PIER), L / 2 - Math.abs(am)), deep = 0.35 + 1.5 * Math.pow(Math.max(0, 1 - p / 1.9), 1.6);
    for (const sd of [-1, 1]) {
      parts.push(paint(new THREE.BoxGeometry(len, 0.62, 0.34), STONE[(i + sd + 2) % 4]).rotateZ(rz).translate(am, ym + 0.31, sd * (B.half + 0.14)));
      parts.push(paint(new THREE.BoxGeometry(len, deep, 0.3), STONE[(i + sd + 3) % 4]).rotateZ(rz).translate(am, ym - 0.4 - deep / 2, sd * (B.half + 0.1)));
    }
  }
  const world2 = (a, b) => [B.x + a * B.ux - b * B.uz, B.z + a * B.uz + b * B.ux];
  for (const a of [-PIER, PIER]) { // two piers standing at the stream's edges
    const [x, z] = world2(a, 0), bot = groundH(x, z) - 0.5, top = bridgeTop(a) - 0.4;
    parts.push(paint(new THREE.BoxGeometry(1.0, top - bot, B.half * 2 + 0.3), 0x8d887c).translate(a, (top + bot) / 2, 0));
  }
  for (const a of [-L / 2 + 0.25, L / 2 - 0.25]) for (const sd of [-1, 1]) { // end posts with a cap
    parts.push(paint(new THREE.BoxGeometry(0.52, 1.6, 0.52), 0x979286).translate(a, bridgeTop(a) + 0.2, sd * (B.half + 0.14)));
    parts.push(paint(new THREE.BoxGeometry(0.66, 0.14, 0.66), 0xc4bfb2).translate(a, bridgeTop(a) + 1.05, sd * (B.half + 0.14)));
  }
  world.batch.addPainted(mergeGeometries(parts).applyMatrix4(new THREE.Matrix4().makeRotationY(Math.atan2(-B.uz, B.ux)).setPosition(B.x, 0, B.z)), B.x, B.z);
  // the parapets are solid (you cross from end to end; no way under the bridge)
  for (let a = -L / 2 + 0.4; a <= L / 2 - 0.39; a += 1.02) for (const sd of [-1, 1]) world.addCollider(...world2(a, sd * (B.half + 0.3)), 0.42);
  // a few stepping stones lead up to both ends
  if (lay) for (const sd of [-1, 1]) for (let k = 0; k < 4; k++) { const [x, z] = world2(sd * (L / 2 + 1.4 + k * 2.6), (k % 2 ? 0.4 : -0.3)); lay(k % 2 ? 'RockPath_Square_Small_1' : 'RockPath_Round_Small_2', x, z, 1.1, k * 1.3); }
}

// ── Meadow landmark: a wheat field with a scarecrow, beyond the bridge ──
function scarecrowField(world, T) {
  const { Qp, R } = T, fx = FIELD.x, fz = FIELD.z, GOLD = [[2.9, 1.65, 0.34], [2.5, 1.45, 0.3], [3.1, 1.9, 0.45]]; // (over 1: the grass models are green)
  for (let r = -2; r <= 2; r++) for (let i = 0; i < 10; i++) {
    const x = fx - 7.6 + i * 1.7 + (R() - 0.5) * 0.6, z = fz + r * 2.1 + (R() - 0.5) * 0.7, y = height(x, z), k = (i + r * 3 + 30) % 5;
    if (Math.hypot(x - fx, z - fz) < 1.7) continue;
    if (k === 0 || k === 3) Qp('Grass_Common_Tall', x, y - 0.05, z, R() * 6.28, 1.25 + R() * 0.3, { tint: GOLD[(i + r + 9) % 3] });
    else if (k === 1) for (let j = 0; j < 2; j++) Qp('Crop_Wheat', x + (j - 0.5) * 0.5, y - 0.02, z + (R() - 0.5) * 0.5, R() * 6.28, 1.5 + R() * 0.4, { rz: (R() - 0.5) * 0.2 });
    else Qp('Grass_Tuft', x, y - 0.04, z, R() * 6.28, 2.3 + R() * 0.7, { tint: GOLD[(i + r + 10) % 3] });
  }
  // the scarecrow (built in code: a pole, a coral shirt, a sack head, a straw hat, a teal scarf)
  const P = [], B = (w, h, d, hex, x, y, z, rz = 0) => P.push(paint(new THREE.BoxGeometry(w, h, d), hex).rotateZ(rz).translate(x, y, z));
  B(0.14, 3.0, 0.14, 0x7a4a26, 0, 1.5, 0); B(2.3, 0.12, 0.12, 0x7a4a26, 0, 2.15, 0);
  B(0.78, 0.95, 0.4, 0xff8585, 0, 1.82, 0); B(0.8, 0.14, 0.42, 0x9a6236, 0, 1.4, 0);
  for (const sd of [-1, 1]) { B(0.72, 0.3, 0.3, 0xff8585, sd * 0.72, 2.13, 0, sd * -0.08); B(0.26, 0.2, 0.2, 0xe9c95a, sd * 1.18, 2.1, 0, sd * -0.3); B(0.2, 0.34, 0.2, 0xe9c95a, sd * 0.2, 1.2, 0, sd * 0.2); }
  P.push(paint(new THREE.SphereGeometry(0.34, 8, 6), 0xead7a8).translate(0, 2.62, 0));
  for (const sd of [-1, 1]) B(0.07, 0.09, 0.04, 0x2b1a0c, sd * 0.12, 2.68, 0.33);
  B(0.2, 0.05, 0.04, 0x2b1a0c, 0, 2.52, 0.33); B(0.5, 0.14, 0.44, 0x2ee6c0, 0, 2.32, 0);
  P.push(paint(new THREE.CylinderGeometry(0.66, 0.66, 0.05, 10), 0xc9953e).translate(0, 2.88, 0));
  P.push(paint(new THREE.ConeGeometry(0.38, 0.5, 8), 0xd9a94c).translate(0, 3.14, 0));
  const ry = Math.atan2(BRIDGE.x - fx, BRIDGE.z - fz); // it looks towards the bridge
  world.batch.addPainted(mergeGeometries(P).applyMatrix4(new THREE.Matrix4().makeRotationY(ry).scale(new THREE.Vector3(1.4, 1.4, 1.4)).setPosition(fx, height(fx, fz) - 0.2, fz)), fx, fz);
  world.addCollider(fx, fz, 0.45);
  // a fence on the two far sides, pumpkins and a crate at the near corner
  fenceRun(world, T, [[fx - 9.6, fz - 6.6], [fx + 9.6, fz - 6.6], [fx + 9.6, fz + 6.4]]);
  for (const [dx, dz, s0] of [[-9.4, 5.2, 1.5], [-8.2, 6.3, 1.2], [-10.3, 6.6, 1.0], [-7.0, 6.9, 1.35]]) { const x = fx + dx, z = fz + dz; Qp('Crop_Pumpkin', x, height(x, z) + 0.02, z, R() * 6.28, s0); }
  { const x = fx - 10.6, z = fz + 4.2; Qp('Crate_Wooden', x, height(x, z), z, 0.4, 0.85); world.addCollider(x, z, 0.6); }
}

// ── Meadow landmark: the ruin of a cottage (village-kit walls, sunk and tilted, with vines) ──
function ruin(world, T) {
  const { Qp, R } = T, PI = Math.PI, OLD = 0xcfd2c2, rx = RUIN.x, rz0 = RUIN.z;
  const wall = (n, dx, dz, ry, sink, rz) => {
    const x = rx + dx, z = rz0 + dz;
    Qp(n, x, height(x, z) - sink - 0.1, z, ry, 1, { rz, mul: OLD });
    if (sink < 1.7) for (const k of [-0.55, 0.55]) world.addCollider(x + Math.cos(ry) * k, z - Math.sin(ry) * k, 0.55);
  };
  wall('Wall_UnevenBrick_Window_Wide_Round', -3, -3.5, PI, 0, 0); wall('Wall_UnevenBrick_Straight', -1, -3.5, PI, 1.25, 0.05);
  wall('Wall_UnevenBrick_Door_Round', 1, -3.5, PI, 0, 0); wall('Wall_UnevenBrick_Straight', 3, -3.5, PI, 2.1, -0.07);
  wall('Wall_UnevenBrick_Straight', -4, -2.5, -PI / 2, 0, 0); wall('Wall_UnevenBrick_Window_Wide_Round', -4, -0.5, -PI / 2, 0.95, 0.03); wall('Wall_UnevenBrick_Straight', -4, 1.5, -PI / 2, 2.2, 0.09);
  wall('Wall_UnevenBrick_Straight', 4, -2.5, PI / 2, 1.6, -0.06);
  // one corner still stands two floors high: seen from far across the Meadow
  { const y1 = height(rx - 3, rz0 - 3.5) + 3.0; Qp('Wall_UnevenBrick_Window_Wide_Round', rx - 3, y1, rz0 - 3.5, PI, 1, { mul: OLD }); Qp('Wall_UnevenBrick_Straight', rx - 4, y1, rz0 - 2.5, -PI / 2, 1, { mul: OLD });
    Qp('Wall_UnevenBrick_Straight', rx - 1, y1 - 1.9, rz0 - 3.5, PI, 1, { rz: 0.04, mul: OLD }); Qp('Corner_Exterior_Wood', rx - 4, y1, rz0 - 3.5, 0, [1.3, 1, 1.3], { mul: OLD }); Qp('Prop_Vine5', rx - 4.14, y1 + 2.5, rz0 - 2.5, -PI / 2, 1.2, { tint: 0x5fa945 }); }
  Qp('Corner_Exterior_Wood', rx - 4, height(rx - 4, rz0 - 3.5) - 0.1, rz0 - 3.5, 0, [1.3, 1, 1.3], { mul: OLD });
  // vines hang over the standing walls (the kit's vine hangs down from its origin, on the wall's outside)
  const VINE = { tint: 0x5fa945 };
  Qp('Prop_Vine5', rx - 3, height(rx - 3, rz0 - 3.5) + 2.6, rz0 - 3.62, PI, 1.1, VINE); Qp('Prop_Vine2', rx + 1.2, height(rx + 1, rz0 - 3.5) + 2.7, rz0 - 3.38, 0, 1.0, VINE);
  Qp('Prop_Vine2', rx - 4.12, height(rx - 4, rz0 - 2.5) + 2.6, rz0 - 2.4, -PI / 2, 1.1, VINE);
  // rubble, old stones, a crate left behind, grass growing inside
  for (let i = 0; i < 9; i++) { const x = rx - 4.5 + R() * 9.5, z = rz0 - 4.5 + R() * 7.5; Qp(i % 2 ? 'Prop_Brick1' : 'Prop_Brick3', x, height(x, z) + 0.08, z, R() * 6.28, 1.7 + R() * 0.8, { rz: R() - 0.5, mul: OLD }); }
  for (const [dx, dz, s0] of [[4.8, 0.6, 0.6], [-5.6, 3.4, 0.45], [2.2, 3.6, 0.35]]) { const x = rx + dx, z = rz0 + dz; Qp('Rock_Lo_1', x, height(x, z) - 0.25 * s0, z, R() * 6.28, s0, { mul: 0xeeeade }); world.addCollider(x, z, 1.3 * s0); }
  { const x = rx - 2.4, z = rz0 - 1.8; Qp('Barrel', x, height(x, z) + 0.28, z, 0.7, 1.05, { rz: 1.5 }); world.addCollider(x, z, 0.5); }
  for (let i = 0; i < 6; i++) { const x = rx - 3 + R() * 6, z = rz0 - 2.5 + R() * 4; Qp(i % 2 ? 'Grass_Wispy_Tall' : 'Fern_1', x, height(x, z) - 0.04, z, R() * 6.28, i % 2 ? 0.9 : 0.26, { tint: 0x5fa945 }); }
  Qp('DeadTree_3', rx + 5.6, height(rx + 5.6, rz0 - 4.4) - 0.1, rz0 - 4.4, 1.0, 0.36); world.addCollider(rx + 5.6, rz0 - 4.4, 0.5);
}

// ── Forest: stumps and logs in the bark colour of the pack's trees ──
const BARK = 0x6a4a33, CUT = 0xd6b382;
function stump(world, x, z, r, h) {
  const g = mergeGeometries([paint(new THREE.CylinderGeometry(r * 0.82, r * 1.12, h, 8), BARK).translate(0, h / 2, 0), paint(new THREE.CylinderGeometry(r * 0.76, r * 0.76, 0.04, 8), CUT).translate(0, h + 0.01, 0)]);
  world.batch.addPainted(g.translate(x, height(x, z) - 0.06, z), x, z);
}
function logAt(world, x, z, len, r, ry, lift = 0) {
  const g = mergeGeometries([paint(new THREE.CylinderGeometry(r, r * 1.1, len, 8).rotateZ(Math.PI / 2), BARK),
    paint(new THREE.CylinderGeometry(r * 0.84, r * 0.84, 0.04, 8).rotateZ(Math.PI / 2), CUT).translate(len / 2 + 0.01, 0, 0), paint(new THREE.CylinderGeometry(r * 0.92, r * 0.92, 0.04, 8).rotateZ(Math.PI / 2), CUT).translate(-len / 2 - 0.01, 0, 0)]);
  world.batch.addPainted(g.rotateY(ry).translate(x, height(x, z) + r * 0.82 + lift, z), x, z);
}
// ── Forest: the camp in its clearing (a place to reach: a trail of stones leads to it
// from the end of the path; a tall pole with a green banner shows where it is) ──
function camp(world, T, lay) {
  const { Qp, box, put, R } = T, kx = CAMP.x, kz = CAMP.z, PI = Math.PI, y = (x, z) => height(x, z);
  // the tent: canvas over a ridge pole, open at the front
  {
    const g = new THREE.CylinderGeometry(1, 1, 3.6, 3, 1, false).rotateX(PI / 2).rotateZ(PI).translate(0, 0.5, 0).scale(1.62 / 0.866, 2.2 / 1.5, 1);
    const tent = paint(g, 0xf2e3bd, true), c = tent.attributes.color, n = tent.attributes.normal, dark = new THREE.Color(0x3b2a20);
    for (let i = 0; i < c.count; i++) if (n.getZ(i) > 0.9) c.setXYZ(i, dark.r, dark.g, dark.b); // the open front
    const tx = kx - 3.8, tz = kz - 2.8, ry = 0.75, M = new THREE.Matrix4().makeRotationY(ry).setPosition(tx, y(tx, tz) - 0.05, tz);
    const parts = [tent];
    for (const zz of [-1.82, 1.82]) parts.push(paint(new THREE.BoxGeometry(0.1, 2.45, 0.1), 0x7a4a26).translate(0, 1.2, zz));
    parts.push(paint(new THREE.BoxGeometry(0.09, 0.09, 4.0), 0x7a4a26).translate(0, 2.25, 0));
    for (const sd of [-1, 1]) parts.push(paint(new THREE.BoxGeometry(0.05, 2.75, 0.5), 0xff8585).rotateZ(sd * 0.635).translate(sd * 0.83, 1.12, 0.6)); // a coral band on each side
    world.batch.addPainted(mergeGeometries(parts).applyMatrix4(M), tx, tz);
    world.addCollider(tx, tz, 1.5); world.addCollider(tx + Math.sin(ry) * 1.3, tz + Math.cos(ry) * 1.3, 1.2); world.addCollider(tx - Math.sin(ry) * 1.3, tz - Math.cos(ry) * 1.3, 1.2);
    put('bedroll', tx + Math.sin(ry) * 3.2, tz + Math.cos(ry) * 3.2, { w: 2.0, ry: ry + 0.3 });
  }
  // the fire: a ring of stones, three logs leaning together
  for (let i = 0; i < 7; i++) { const a = i * 0.9, x = kx + Math.cos(a) * 0.85, z = kz + Math.sin(a) * 0.85; Qp(`Pebble_Round_${1 + (i % 5)}`, x, y(x, z) - 0.05, z, a, 2.6, { mul: 0xb9b3aa }); }
  for (let i = 0; i < 3; i++) { const a = i * 2.1 + 0.3; world.batch.addPainted(paint(new THREE.CylinderGeometry(0.08, 0.1, 0.95, 6), 0x4a3324).rotateZ(0.75).rotateY(a).translate(kx + Math.cos(a) * 0.22, y(kx, kz) + 0.33, kz - Math.sin(a) * 0.22), kx, kz); }
  world.addCollider(kx, kz, 0.85);
  // seats and supplies
  logAt(world, kx + 2.5, kz + 0.6, 2.5, 0.3, 1.45); world.addCollider(kx + 2.5, kz + 0.1, 0.6); world.addCollider(kx + 2.5, kz + 1.1, 0.6);
  logAt(world, kx - 0.5, kz + 2.6, 2.5, 0.3, 0.12); world.addCollider(kx - 1.0, kz + 2.6, 0.6); world.addCollider(kx, kz + 2.6, 0.6);
  for (const [n, dx, dz, s0, col] of [['Stool', -2.3, 0.9, 1.1, 0.35], ['Cauldron', 1.3, -1.9, 1.0, 0.6], ['Barrel', -6.1, -0.6, 1.1, 0.45], ['Crate_Wooden', -5.6, 0.7, 0.85, 0.6], ['Bag', -4.9, -0.2, 1.0, 0], ['Crate_Wooden', 3.6, -3.4, 0.7, 0.5]]) {
    const x = kx + dx, z = kz + dz; Qp(n, x, y(x, z), z, R() * 6.28, s0); if (col) world.addCollider(x, z, col);
  }
  stump(world, kx + 1.2, kz + 3.9, 0.45, 0.55); world.addCollider(kx + 1.2, kz + 3.9, 0.55);
  T.lantern(kx + 4.4, kz - 1.6, -2.0);
  // a tall pole with the Forest's banner
  { const x = kx - 1.4, z = kz - 5.6, y0 = y(x, z); box(0.2, 6.4, 0.2, 0x6e4628, x, y0 + 3.1, z); box(1.3, 0.12, 0.12, 0x6e4628, x, y0 + 6.1, z, 0.4);
    Qp('Banner_1_Cloth', x, y0 + 6.05, z + 0.02, 0.4, 1.35, { tint: 0x4fb857 }); Qp('Banner_1_Cloth', x, y0 + 6.05, z - 0.02, 0.4 + PI, 1.35, { tint: 0x4fb857 }); world.addCollider(x, z, 0.3); }
  // the trail from the end of the Forest path
  if (lay) { const [ex, ez] = PATHS[0][PATHS[0].length - 1], L = Math.hypot(kx - ex, kz - ez); for (let d = 2.5; d < L - 4.5; d += 2.7) { const t = d / L, w = Math.sin(d * 0.6) * 0.9; lay(d % 2 > 1 ? 'RockPath_Round_Small_1' : 'RockPath_Square_Small_2', ex + (kx - ex) * t + w * (kz - ez) / L, ez + (kz - ez) * t - w * (kx - ex) / L, 1.05, d); } }
  return campfire(world.scene, kx, y(kx, kz) + 0.35, kz);
}

// ── Volcano: embers rise from the lava streams and the crater (one Points object) ──
function embers(S, R) {
  const n = 64, pos = new Float32Array(n * 3), list = [];
  for (let i = 0; i < n; i++) {
    const k = Math.floor(R() * (LAVA_ANGLES.length + 1));
    let x = Z.volcano.x + (R() - 0.5) * 7, z = Z.volcano.z + (R() - 0.5) * 7, y0 = 0;
    if (k < LAVA_ANGLES.length) [x, z] = lavaPoint(k, LAVA_RIM + R() * (LAVA_END - LAVA_RIM - 5));
    y0 = groundH(x, z) + 0.2;
    list.push({ x, z, y0, ph: R() * 10, sp: 0.35 + R() * 0.5, top: 2.5 + R() * 4.5 });
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ map: glowTex(), color: 0xffa23a, size: 0.42, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.95 });
  const pts = new THREE.Points(geo, mat); S.add(pts);
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(Z.volcano.x, 14, Z.volcano.z), Z.volcano.r + 16); // (set by hand: not drawn when the Volcano is out of view)
  return (dt, time) => {
    for (let i = 0; i < n; i++) {
      const e = list[i], k = (time * e.sp + e.ph) % 1;
      pos[i * 3] = e.x + Math.sin(time * 1.3 + e.ph) * 0.5 * k + k * 1.2; pos[i * 3 + 1] = e.y0 + k * e.top; pos[i * 3 + 2] = e.z + Math.cos(time * 1.1 + e.ph) * 0.5 * k;
    }
    geo.attributes.position.needsUpdate = true;
  };
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
  const puffs = Array.from({ length: 7 }, (_, i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0x8a8590, transparent: true, depthWrite: false, opacity: 0.5 }));
    S.add(s); return { s, t: i * 1.29 };
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
