// Set pieces and life for the island (all CC0, see assets/CREDITS.md):
// Meadow: flower fields with butterflies, an old stone circle, a pond with lily
//   pads and a canoe, signposts where the paths fork.
// Home: lanterns, benches, bushes, a fountain, a playground, a picnic, a small farm.
// Forest: mushrooms (some giant), stumps, logs, a campsite with a crackling fire, fireflies.
// Beach: palm trees, a shipwreck, a dock with barrels and a chest, sandcastles, a
//   rowing boat, seagulls, a pirate ship at anchor.
// Volcano: stone heads guarding it, glowing crystals, smoke from the crater.
// Sea: a lighthouse on a rock. Sky: drifting clouds.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ZONES, ISLAND, HOME } from './balance.js';
import { height, zoneAt, pathDist, POND, PATHS, FORK, WATER_Y, glowTex } from './world.js';
import { rng } from './creatures.js';
import { t } from './i18n.js';

const Z = Object.fromEntries(ZONES.map((z) => [z.id, z]));
const F = {}; // short name → file
const add = (dir, ext, names) => names.forEach((n) => { F[n] = `assets/props/${dir}/${n}.${ext}`; });
add('nature', 'glb', ['flower_redA', 'flower_yellowA', 'flower_purpleA', 'flower_redB', 'flower_yellowB', 'mushroom_red',
  'mushroom_redTall', 'mushroom_tanGroup', 'mushroom_redGroup', 'mushroom_tanTall', 'stump_roundDetailed', 'stump_old', 'log',
  'log_large', 'tent_detailedOpen', 'campfire_logs', 'lily_large', 'lily_small', 'statue_column', 'statue_obelisk', 'statue_head',
  'stone_tallA', 'stone_tallD', 'stone_largeB', 'crop_pumpkin', 'crop_carrot', 'crops_cornStageD', 'fence_simple', 'plant_flatTall',
  'canoe', 'pot_large']);
add('pirate', 'glb', ['palm-detailed-bend', 'palm-detailed-straight', 'palm-bend', 'ship-wreck', 'ship-pirate-large', 'boat-row-small',
  'structure-platform-dock', 'barrel', 'crate', 'chest', 'flag-pirate-high', 'rocks-sand-a', 'rocks-sand-b', 'tower-complete-small']);
add('survival', 'glb', ['signpost', 'bedroll']);
add('playground', 'gltf', ['swing_A_large', 'slide_A', 'seesaw_large', 'merry_go_round', 'sandbox_round_decorated', 'spring_horse_A',
  'sandcastle_A', 'sandcastle_B', 'sandcastle_C', 'picnic_table']);
add('picnic', 'gltf', ['picnic_blanket_red', 'picnic_basket_round', 'teapot', 'apple', 'sandwich', 'pillow_large_blue']);
add('park', 'gltf', ['street_lantern', 'bench', 'fountain', 'bush_large']);
add('gems', 'gltf', ['Gem_Large', 'Gem_Medium']);

// Spots kept free of random trees and rocks (world.loadDecor reads them): [x, z, r]
const H = HOME;
const SPOT = {
  playground: [H.x - 29, H.z - 2], picnic: [H.x + 24, H.z - 5], farm: [H.x + 30, H.z + 16],
  circle: [-30, 30], camp: [Z.forest.x + 12, Z.forest.z + 16], wreck: [Z.beach.x + 14, Z.beach.z - 16],
  dock: [Z.beach.x + 20, Z.beach.z + 4],
};
export function reserveSpots(world) {
  world.reserved.push([...SPOT.playground, 12], [...SPOT.picnic, 6], [...SPOT.farm, 10], [...SPOT.circle, 10],
    [...SPOT.camp, 8], [...SPOT.wreck, 9], [...SPOT.dock, 8], [FORK.x, FORK.z, 4]);
}

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
        for (const m of [].concat(o.material)) { m.metalness = 0; m.roughness = Math.max(m.roughness ?? 1, 0.6); }
      });
      cache[n] = { scene: g.scene, h: size.y || 1, w: Math.max(size.x, size.z) || 1, minY: box.min.y };
    } catch (_) { /* a missing prop is skipped */ }
  }));
}

export async function buildDecor(world) {
  await loadAll(new GLTFLoader());
  const S = world.scene, R = rng('decor-2');
  const life = [];
  // place one model: h = target height, w = target width (else s = scale)
  const put = (n, x, z, o = {}) => {
    const c = cache[n]; if (!c) return null;
    const m = c.scene.clone(true);
    const s = o.s ?? (o.w ? o.w / c.w : (o.h ?? 1) / c.h);
    m.scale.setScalar(s);
    m.rotation.y = o.ry ?? R() * Math.PI * 2;
    m.position.set(x, (o.y ?? height(x, z)) - c.minY * s + (o.lift ?? 0), z);
    S.add(m);
    if (o.col) world.addCollider(x, z, o.col);
    return m;
  };
  // many copies of one model as instanced meshes
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  const inst = (n, pts) => {
    const c = cache[n]; if (!c || !pts.length) return;
    c.scene.traverse((o) => {
      if (!o.isMesh) return;
      const im = new THREE.InstancedMesh(o.geometry, o.material, pts.length);
      im.castShadow = true; im.receiveShadow = true;
      pts.forEach((p, i) => {
        const s = p.h / c.h;
        q.setFromAxisAngle(up, p.ry ?? R() * 6.28);
        m4.compose(new THREE.Vector3(p.x, (p.y ?? height(p.x, p.z)) - c.minY * s, p.z), q, new THREE.Vector3(s, s, s)).multiply(o.matrixWorld);
        im.setMatrixAt(i, m4);
      });
      im.computeBoundingSphere();
      S.add(im);
    });
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
    for (let k = 0; k < 3; k++) put('bush_large', H.x + sx * (17 + k * 0.2), H.z - 6 + k * 8, { h: 1.6, col: 0.9 });
    put('pot_large', H.x + sx * 6.5, H.z - 10.2, { h: 0.9 });
  }
  put('fountain', H.x + 13, H.z - 19, { h: 2.4, ry: 0, col: 2.4 });
  // flower beds along the front edge of the deck
  ['flower_redA', 'flower_yellowA', 'flower_purpleA'].forEach((n, k) => inst(n, Array.from({ length: 6 }, (_, i) => {
    const x = H.x + (i < 3 ? -1 : 1) * (7.5 + (i % 3) * 1.7 + k * 0.55);
    return { x, z: H.z - 12.0 + (k % 2) * 0.45, h: 0.55 + ((i + k) % 3) * 0.1 };
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
  const soil = new THREE.MeshStandardMaterial({ color: 0x8a5a33, roughness: 1 });
  const rows = [['crop_pumpkin', 0.7], ['crop_carrot', 0.5], ['crops_cornStageD', 2.0]];
  rows.forEach(([n, h], r) => {
    const z = fz - 3 + r * 3;
    const bed = new THREE.Mesh(new THREE.BoxGeometry(10, 0.25, 1.4), soil);
    bed.position.set(fx, height(fx, z) + 0.05, z); bed.receiveShadow = true; S.add(bed);
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

  // ── meadow: flower fields, stone circle, pond ──
  const flowerNames = ['flower_redA', 'flower_yellowA', 'flower_purpleA', 'flower_redB', 'flower_yellowB'];
  const flowers = Object.fromEntries(flowerNames.map((n) => [n, []]));
  const fieldCenters = [];
  for (let tries = 0; fieldCenters.length < 34 && tries < 600; tries++) {
    const [x, z] = around(ISLAND.cx, ISLAND.cz + 10, ISLAND.r - 22);
    if (zoneAt(x, z).id !== 'meadow' || !free(x, z, 4) || ZONES.some((zz) => zz.r && Math.hypot(x - zz.x, z - zz.z) < zz.r + 5)) continue;
    fieldCenters.push([x, z]);
    const kind = flowerNames[Math.floor(R() * flowerNames.length)];
    for (let i = 0; i < 9; i++) {
      const [fx2, fz2] = around(x, z, 3.2);
      if (free(fx2, fz2, 2)) flowers[(R() < 0.75 ? kind : flowerNames[Math.floor(R() * flowerNames.length)])].push({ x: fx2, z: fz2, h: 0.45 + R() * 0.35 });
    }
  }
  for (const [n, pts] of Object.entries(flowers)) inst(n, pts);
  // an old stone circle
  const [sx0, sz0] = SPOT.circle;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    put('statue_column', sx0 + Math.cos(a) * 6.5, sz0 + Math.sin(a) * 6.5, { h: 3.2 + R() * 0.8, ry: a, col: 0.6 });
  }
  put('statue_obelisk', sx0, sz0, { h: 4.5, ry: 0.4, col: 0.9 });
  // pond: lily pads, reeds, a canoe on the bank
  inst('lily_large', Array.from({ length: 7 }, () => { const [x, z] = around(POND.x, POND.z, POND.r - 3); return { x, z, y: POND.water + 0.02, h: 0.12 }; }));
  inst('lily_small', Array.from({ length: 6 }, () => { const [x, z] = around(POND.x, POND.z, POND.r - 2); return { x, z, y: POND.water + 0.02, h: 0.1 }; }));
  inst('plant_flatTall', Array.from({ length: 16 }, (_, i) => {
    const a = R() * 6.28, r = POND.r + 0.3 + R() * 1.5; return { x: POND.x + Math.cos(a) * r, z: POND.z + Math.sin(a) * r, h: 1.0 + R() * 0.6 };
  }));
  put('canoe', POND.x - POND.r - 0.5, POND.z + 2, { w: 3.2, ry: 1.2, lift: 0.05 });

  // ── forest: mushrooms (some giant), stumps, logs, a campsite ──
  const F0 = Z.forest;
  const mush = { mushroom_red: [], mushroom_redTall: [], mushroom_tanGroup: [], mushroom_redGroup: [], mushroom_tanTall: [] };
  const mNames = Object.keys(mush);
  for (let i = 0, tries = 0; i < 70 && tries < 900; tries++) {
    const [x, z] = around(F0.x, F0.z, F0.r - 2);
    if (!free(x, z, 1.5)) continue;
    const giant = i < 9;
    mush[mNames[Math.floor(R() * mNames.length)]].push({ x, z, h: giant ? 2.6 + R() * 1.8 : 0.4 + R() * 0.6 });
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

  // ── beach: palms, wreck, dock, sandcastles, boats ──
  const B = Z.beach;
  const palms = { 'palm-detailed-bend': [], 'palm-detailed-straight': [], 'palm-bend': [] };
  for (let i = 0, tries = 0; i < 18 && tries < 400; tries++) {
    const [x, z] = around(B.x, B.z, B.r - 2);
    if (!free(x, z, 2) || height(x, z) < 0.3) continue;
    palms[Object.keys(palms)[i % 3]].push({ x, z, h: 6 + R() * 3 });
    world.addCollider(x, z, 0.5); i++;
  }
  for (const [n, pts] of Object.entries(palms)) inst(n, pts);
  const [wx, wz] = SPOT.wreck;
  put('ship-wreck', wx, wz, { w: 11, ry: 2.3, col: 3.5, lift: -0.4 });
  put('flag-pirate-high', wx - 5, wz + 4, { h: 4.5, col: 0.3 });
  const [dx, dz] = SPOT.dock;
  // the dock reaches from the beach out into the sea
  put('structure-platform-dock', dx + 14, dz, { w: 9, ry: Math.PI / 2, y: WATER_Y - 0.4 });
  put('barrel', dx - 1, dz + 2, { h: 1.0, col: 0.5 });
  put('barrel', dx - 0.2, dz + 3, { h: 1.0, col: 0.5 });
  put('crate', dx - 2, dz - 2, { h: 0.9, col: 0.6 });
  put('chest', dx - 3.2, dz + 0.2, { h: 0.8, ry: 1.2, col: 0.6 });
  put('boat-row-small', dx + 14, dz + 6, { w: 4, ry: 0.4, y: WATER_Y - 0.3 });
  for (const [n, ox, oz] of [['sandcastle_A', -12, 6], ['sandcastle_B', -10, 9], ['sandcastle_C', -14, 10]]) put(n, B.x + ox, B.z + oz, { h: 1.0, col: 0.7 });
  for (let i = 0; i < 6; i++) { const [x, z] = around(B.x, B.z, B.r - 2); if (free(x, z, 1)) put(i % 2 ? 'rocks-sand-a' : 'rocks-sand-b', x, z, { h: 0.8, col: 0.8 }); }
  const ship = put('ship-pirate-large', B.x + 68, B.z - 26, { w: 18, ry: -0.9, y: WATER_Y - 1.8 });
  if (ship) { const y0 = ship.position.y; life.push((dt, time) => { ship.position.y = y0 + Math.sin(time * 0.8) * 0.25; ship.rotation.z = Math.sin(time * 0.6) * 0.04; ship.rotation.x = Math.sin(time * 0.5 + 1) * 0.03; }); }
  life.push(seagulls(S, B.x + 6, B.z, R));

  // ── volcano: stone heads guarding it, glowing crystals, smoke ──
  const V = Z.volcano;
  for (let i = 0; i < 6; i++) {
    const a = (i - 2.5) * 0.42, r = V.r + 7; // on the side facing home
    const x = V.x + Math.sin(a) * r, z = V.z + Math.cos(a) * r;
    put('statue_head', x, z, { h: 3.4, ry: a - Math.PI / 2, col: 1.2 }); // the model faces +x: turn it to look outwards
  }
  const crystal = (n, x, z, h, color) => {
    const m = put(n, x, z, { h, col: 0.3 });
    if (m) m.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.setHex(color); o.material.emissive = new THREE.Color(color); o.material.emissiveIntensity = 0.6; } });
  };
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
    const g = new THREE.Group();
    const n = 4 + Math.floor(R() * 4);
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(geo, mat);
      m.position.set((i - n / 2) * 3.2 + R() * 1.5, R() * 1.5, R() * 3); m.scale.setScalar(3 + R() * 3); m.scale.y *= 0.65;
      g.add(m);
    }
    g.position.set(-220 + R() * 440, 55 + R() * 25, -180 + R() * 320);
    S.add(g); return { g, v: 1.2 + R() * 1.5 };
  });
  return (dt) => { for (const c of list) { c.g.position.x += c.v * dt; if (c.g.position.x > 240) c.g.position.x = -240; } };
}
function seagulls(S, cx, cz, R) {
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  const wing = new THREE.PlaneGeometry(0.9, 0.3).translate(0.45, 0, 0);
  const birds = Array.from({ length: 6 }, (_, i) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 4), mat); body.scale.z = 2.2; g.add(body);
    const l = new THREE.Mesh(wing, mat), r = new THREE.Mesh(wing, mat); r.rotation.y = Math.PI; g.add(l, r);
    S.add(g); return { g, l, r, rad: 10 + R() * 14, h: 14 + R() * 8, sp: 0.25 + R() * 0.2, ph: R() * 6.28 };
  });
  return (dt, time) => {
    for (const b of birds) {
      const a = time * b.sp + b.ph;
      b.g.position.set(cx + Math.cos(a) * b.rad, b.h + Math.sin(time * 0.7 + b.ph) * 1.5, cz + Math.sin(a) * b.rad);
      b.g.rotation.y = -a; // fly along the circle
      const f = Math.sin(time * 8 + b.ph) * 0.5;
      b.l.rotation.z = f; b.r.rotation.z = -f;
    }
  };
}
function butterflies(S, centers, R) {
  if (!centers.length) return null;
  const geo = new THREE.PlaneGeometry(0.22, 0.18).translate(0.11, 0, 0);
  const list = Array.from({ length: 26 }, (_, i) => {
    const c = centers[i % centers.length];
    const mat = new THREE.MeshBasicMaterial({ color: [0xff8585, 0xffcf5e, 0x9fe8ff, 0xc9b6ff, 0xffffff][i % 5], side: THREE.DoubleSide });
    const g = new THREE.Group(), l = new THREE.Mesh(geo, mat), r = new THREE.Mesh(geo, mat);
    r.rotation.y = Math.PI; g.add(l, r); S.add(g);
    return { g, l, r, cx: c[0], cz: c[1], y: height(c[0], c[1]) + 0.9, ph: R() * 10, sp: 0.5 + R() * 0.5 };
  });
  return (dt, time) => {
    for (const b of list) {
      const p = time * b.sp + b.ph;
      b.g.position.set(b.cx + Math.sin(p) * 2.5, b.y + Math.sin(p * 2.3) * 0.4, b.cz + Math.sin(p * 1.3) * 2.5);
      b.g.rotation.y = Math.atan2(Math.cos(p), Math.cos(p * 1.3));
      const f = Math.sin(time * 18 + b.ph) * 1.1;
      b.l.rotation.x = 0; b.l.rotation.z = f; b.r.rotation.z = -f;
    }
  };
}
