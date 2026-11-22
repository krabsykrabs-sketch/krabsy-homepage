// Builds one room from level data. Every room has the same shell: floor x −10…10,
// z −8…8, walls on the back and both sides, open front (the camera looks in from
// there), the exit door in the middle of the back wall. Rooms differ in props,
// skeletons and chest. Static pieces are merged into one mesh.
// Two room types change the shell: 'rune' has two walls of three doors (the first one
// across the room at RUNE_WALL.z, the second the back wall), each door with a word sign,
// 'bridge' has two pits across the room, each crossed by a row of three word stones,
// with a strip of floor between them.
import * as THREE from 'three';
import { Assets } from './assets.js';
import { makeLabel, brickTex } from './labels.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const H = Math.PI / 2;
export const DOOR = { x: 0, z: -8 };
export const BOUNDS = { minX: -9.0, maxX: 9.0, minZ: -7.0, maxZ: 7.5 };
// Torch flame positions: the game keeps four point lights here for every room.
export const TORCH_SPOTS = [[-2.8, 3.05, -6.95], [2.8, 3.05, -6.95], [-8.95, 3.05, 4], [8.95, 3.05, 4]];

const glowTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.3, 'rgba(255,255,255,.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
export function makeGlow(color, size) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
  }));
  s.scale.setScalar(size);
  return s;
}
export { glowTex };
const slabMat = new THREE.MeshLambertMaterial({ color: 0x141d33 });
const slabGeo = new THREE.BoxGeometry(21, 3, 17);
const pitMat = new THREE.MeshLambertMaterial({ color: 0x04070f });
const stoneMat = new THREE.MeshLambertMaterial({ color: 0x5d6485 });
const brickMat = new THREE.MeshLambertMaterial({ map: brickTex });
const brickGeo = new THREE.BoxGeometry(2.6, 3.4, 0.3);
// Word bridge (front to back): the entrance ledge, pit A with three stones (2nd form),
// a strip of floor across the room, pit B with three stones (3rd form), the far ledge.
// Each stone spans its pit from edge to edge; between the stones of a row the pit gaps
// are wider than the hero, so nobody slips sideways from one stone onto the next.
export const PITS = [{ near: 4.4, far: 1.6 }, { near: -1.6, far: -4.4 }];
export const STONE = { w: 2.8, d: 2.8, cols: [-4.2, 0, 4.2] };
export const BASE_SIGN = { x: 0, z: 5.1, w: 3.6, d: 1.1 }; // the base form, on the entrance ledge
const stoneGeo = new THREE.BoxGeometry(STONE.w, 4, STONE.d);
const rimMat = new THREE.MeshBasicMaterial({ color: 0x0a0f1c });
// The far wall of each pit: bricks that fade into the dark, so the drop reads as deep.
const pitWallMat = (() => {
  const t = brickTex.clone(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(10, 2); t.needsUpdate = true;
  return new THREE.MeshLambertMaterial({ map: t, color: 0x9aa3c8 });
})();
const pitFadeTex = (() => {
  const c = document.createElement('canvas'); c.width = 4; c.height = 64;
  const g = c.getContext('2d'), grad = g.createLinearGradient(0, 0, 0, 64);
  grad.addColorStop(0, 'rgba(4,7,15,0)'); grad.addColorStop(0.85, 'rgba(4,7,15,1)');
  g.fillStyle = grad; g.fillRect(0, 0, 4, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const pitFadeMat = new THREE.MeshBasicMaterial({ map: pitFadeTex, transparent: true, depthWrite: false });
export const RUNE_DOORS = [-4, 0, 4];
// Rune room (play-test note 10): a first wall across the room with three doors (2nd form);
// behind it an antechamber, then the back wall with three doors (3rd form). `z` = the
// first wall's centre line (1 thick). It fades out while the hero is in or behind it, so
// the antechamber stays visible from the fixed camera.
export const RUNE_WALL = { z: 0, half: 0.5 };
// The verb book (play-test note 12): a stand with an open book inside a glowing rune
// circle near the door. Key rooms, ambushes and the treasure room have one; skeletons,
// the golem and arrows stop at the circle's edge. `book: [x, z]` in the room data moves it.
export const BOOK = { x: 2.8, z: -5.2, r: 1.6 };
const bookMats = {
  wood: new THREE.MeshLambertMaterial({ color: 0x7a4f2e }),
  dark: new THREE.MeshLambertMaterial({ color: 0x4a2f1c }),
  cover: new THREE.MeshLambertMaterial({ color: 0x8c2f3a }),
  page: new THREE.MeshLambertMaterial({ color: 0xfff2d6, emissive: 0x6a5838 }),
};
const circleTex = (() => { // a rune ring: amber rings, teal runes between them, soft teal inside
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), m = S / 2;
  const fill = g.createRadialGradient(m, m, 0, m, m, m * 0.92); // a dark teal pool, so the lines read on the light floor
  fill.addColorStop(0, 'rgba(8,40,52,.55)'); fill.addColorStop(0.85, 'rgba(8,40,52,.5)'); fill.addColorStop(1, 'rgba(8,40,52,0)');
  g.fillStyle = fill; g.fillRect(0, 0, S, S);
  g.strokeStyle = '#ffcf5e'; g.shadowColor = '#ffb020'; g.shadowBlur = 18;
  for (const [r, w] of [[0.9, 16], [0.79, 6], [0.6, 7]]) { g.lineWidth = w; g.beginPath(); g.arc(m, m, r * m, 0, Math.PI * 2); g.stroke(); }
  g.strokeStyle = '#5ffde0'; g.shadowColor = '#2ee6c0'; g.lineWidth = 9; g.lineCap = 'round';
  const glyphs = [ // small rune strokes, in unit coordinates around the glyph centre
    [[-1, -1, 1, 1], [-1, 1, 0, 0]], [[0, -1, 0, 1], [0, -0.3, 1, -1]], [[-1, 1, 0, -1], [0, -1, 1, 1]],
    [[-1, -1, 1, -1], [0, -1, 0, 1]], [[-1, 0, 1, 0], [0, -1, -0.6, 1]], [[-0.8, -1, -0.8, 1], [-0.8, 0, 0.9, 0.8]],
  ];
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6, r = 0.695 * m, cx = m + Math.cos(a) * r, cy = m + Math.sin(a) * r, k = 17;
    g.save(); g.translate(cx, cy); g.rotate(a + Math.PI / 2);
    for (const [x0, y0, x1, y1] of glyphs[i % glyphs.length]) { g.beginPath(); g.moveTo(x0 * k, y0 * k); g.lineTo(x1 * k, y1 * k); g.stroke(); }
    g.restore();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
// A lectern with an open book, from primitives, facing the camera (+z). About 1.4 tall.
// The book is not baked into the stand: it is two halves hinged at the spine (`book.halves`),
// so main.js can close it once it is read (play-test note 14: the left half folds over onto
// the right one, the closed book slides to the middle). Pivot = the spine at the height of
// the page tops, so the folded half lands on top, cover up.
const BOOK_PIVOT = [0, 0.135, -0.01];
function bookHalf(side) { // side −1 = left, 1 = right; each half baked to one mesh per material
  const geos = new Map();
  const add = (geo, mat, x, y, z, rz = 0) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.z = rz; m.updateMatrix();
    if (!geos.has(mat)) geos.set(mat, []);
    geos.get(mat).push(geo.clone().applyMatrix4(m.matrix));
    geo.dispose();
  };
  const [, py, pz] = BOOK_PIVOT;
  add(new THREE.BoxGeometry(0.43, 0.04, 0.6), bookMats.cover, side * 0.215, 0.06 - py, -0.01 - pz);
  add(new THREE.BoxGeometry(0.4, 0.05, 0.54), bookMats.page, side * 0.21, 0.1 - py, -0.01 - pz, -side * 0.12); // open pages, a small V
  for (let i = 0; i < 4; i++) add(new THREE.BoxGeometry(0.28, 0.01, 0.03), bookMats.dark, side * 0.21, 0.13 - py, -0.18 + i * 0.11 - pz, -side * 0.12);
  const g = new THREE.Group();
  for (const [mat, list] of geos) {
    const mesh = new THREE.Mesh(mergeGeometries(list, false), mat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    g.add(mesh);
    for (const x of list) x.dispose();
  }
  return g;
}
function makeLectern() {
  const o = new THREE.Group();
  const add = (geo, mat, x, y, z, rx = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, 0, rz);
    m.castShadow = true; m.receiveShadow = true; o.add(m); return m;
  };
  add(new THREE.CylinderGeometry(0.36, 0.44, 0.14, 10), bookMats.dark, 0, 0.07, 0);
  add(new THREE.BoxGeometry(0.2, 0.95, 0.2), bookMats.wood, 0, 0.6, 0);
  const top = new THREE.Group(); top.position.set(0, 1.08, 0); top.rotation.x = 0.55; o.add(top); // tilted to the camera
  const tAdd = (geo, mat, x, y, z, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.z = rz; m.castShadow = true; top.add(m); return m; };
  tAdd(new THREE.BoxGeometry(0.95, 0.07, 0.68), bookMats.wood, 0, 0, 0);
  tAdd(new THREE.BoxGeometry(0.95, 0.06, 0.06), bookMats.dark, 0, 0.05, 0.33); // the ledge the book rests on
  // The stand is baked into one mesh per material (2 draw calls), the book halves 3 each.
  o.updateMatrixWorld(true);
  const byMat = new Map();
  o.traverse((m) => {
    if (!m.isMesh) return;
    const g = m.geometry.clone().applyMatrix4(m.matrixWorld);
    if (!byMat.has(m.material)) byMat.set(m.material, []);
    byMat.get(m.material).push(g);
  });
  const out = new THREE.Group();
  for (const [mat, geos] of byMat) {
    const mesh = new THREE.Mesh(mergeGeometries(geos, false), mat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    out.add(mesh);
    for (const g of geos) g.dispose();
  }
  o.traverse((m) => { if (m.isMesh) m.geometry.dispose(); });
  const top2 = new THREE.Group(); top2.position.copy(top.position); top2.rotation.copy(top.rotation);
  const spine = new THREE.Group(); spine.position.set(...BOOK_PIVOT);
  const halves = [bookHalf(-1), bookHalf(1)];
  spine.add(...halves); top2.add(spine); out.add(top2);
  out.userData.book = { spine, halves };
  return out;
}

// def: { type: 'key' | 'rune' | 'bridge' | 'ambush' | 'vault' | 'boss' (default 'key'), props: [[model, x, z, rotDeg, blockRadius, y]],
//        chest: {x, z, rot, gold} | null, skeletons: [[[x, z], …route]], banners: 'red' | 'blue',
//        search: [[model, x, z, rotDeg, blockRadius], …] (props the key may hide in, see levels.js) }
export function buildRoom(def) {
  const type = def.type || 'key';
  const rune = type === 'rune', bridge = type === 'bridge';
  const extras = []; // things to dispose with the room
  const group = new THREE.Group();
  const obstacles = [];
  const stat = []; // static placements, merged at the end
  const put = (name, x, z, rot = 0, y = 0) => stat.push({ name, x, z, rot, y });
  // Put something on a wall's inner face: (wx, wz, rot) = the wall piece's transform,
  // `along` = offset along the wall, `out` = distance from the wall's centre line.
  const mount = (name, wx, wz, rot, along, y, out = 0) => {
    const c = Math.cos(rot), s = Math.sin(rot);
    put(name, wx + c * along + s * out, wz - s * along + c * out, rot, y);
  };

  // Floor (5 × 4 large tiles) and the strip behind the door.
  if (!bridge) {
    for (let ix = 0; ix < 5; ix++) for (let iz = 0; iz < 4; iz++) {
      put('floor_tile_large', -8 + ix * 4, -6 + iz * 4, ((ix * 7 + iz * 3) % 4) * H);
    }
  } else { // three bands of floor, the tiles squeezed to fit between the pits
    const bands = [[8, PITS[0].near], [PITS[0].far, PITS[1].near], [PITS[1].far, -8]];
    bands.forEach(([z0, z1], iz) => {
      for (let ix = 0; ix < 5; ix++) {
        stat.push({ name: 'floor_tile_large', x: -8 + ix * 4, z: (z0 + z1) / 2, rot: ((ix + iz) % 2) * Math.PI, sz: (z0 - z1) / 4 });
      }
    });
  }
  put('floor_tile_large', 0, -10.5);
  if (rune) { put('floor_tile_large', -4, -10.5); put('floor_tile_large', 4, -10.5); }
  // Walls. Back wall on z = −8, side walls on x = ±10 (inner faces look into the room).
  put('wall_corner', -10, -8, H); put('wall_corner', 10, -8, 0);
  put('wall_half', -8, -8); put('wall_half', 6, -8);
  if (!rune) { put('wall', -4, -8); put('wall_cracked', 4, -8); } // rune rooms have doorways there
  put('wall', -10, -4, H); put(def.shelves ? 'wall_shelves' : 'wall', -10, 0, H); put('wall', -10, 4, H);
  put('wall_half', -10, 8, H);
  put('wall', 10, -4, -H); put('wall', 10, 0, -H); put('wall', 10, 4, -H); put('wall_half', 10, 6, -H);
  // Torches and wall decoration.
  const tx = rune ? 2.0 : 2.8; // back torches; between the doorways in a rune room
  mount('torch_mounted', -4, -8, 0, 4 - tx, 2.3, 0.5); mount('torch_mounted', 4, -8, 0, tx - 4, 2.3, 0.5);
  mount('torch_mounted', -10, 4, H, 0, 2.3, 0.5); mount('torch_mounted', 10, 4, -H, 0, 2.3, 0.5);
  const back = def.banners === 'blue' ? 'banner_shield_blue' : 'banner_patternA_red';
  const side = def.banners === 'blue' ? 'banner_patternA_red' : 'banner_shield_blue';
  if (!rune) { mount(back, -4, -8, 0, -0.9, 0); mount(back, 4, -8, 0, 0.9, 0); }
  mount(side, -10, -4, H, 0, 0); mount(side, 10, -4, -H, 0, 0);
  if (def.trophy) mount('sword_shield_gold', 10, 0, -H, 0, 2.4, 0.58);

  // Rune room: the first wall (three doorways, separate meshes with their own fading
  // material), built after the merge below.
  for (const [name, x, z, rotDeg = 0, block = 0, y = 0] of def.props || []) {
    put(name, x, z, THREE.MathUtils.degToRad(rotDeg), y);
    if (block) obstacles.push({ x, z, r: block });
  }
  for (const [x, z, r] of def.extraBlocks || []) obstacles.push({ x, z, r });
  const merged = Assets.mergeStatic(stat);
  group.add(merged);
  // Search spots: props the key may be hidden in. Separate meshes (a swing smashes them,
  // main.js searched()); the game gives each one the "usable" marker until it breaks.
  const search = (def.search || []).map(([name, x, z, rotDeg = 0, block = 1]) => {
    const obj = Assets.clone(name);
    obj.position.set(x, 0, z);
    obj.rotation.y = THREE.MathUtils.degToRad(rotDeg);
    group.add(obj);
    obstacles.push({ x, z, r: block });
    const box = new THREE.Box3().setFromObject(obj);
    return { x, z, r: block, obj, top: box.max.y, mark: null, done: false, kind: /barrel|keg/.test(name) ? 'barrel' : 'crate' };
  });
  const box = (w, h, d, mat, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.receiveShadow = true;
    group.add(m); extras.push(m.geometry);
    return m;
  };
  if (!bridge) {
    const slab = new THREE.Mesh(slabGeo, slabMat);
    slab.position.set(0, -1.62, -0.5);
    group.add(slab);
  } else { // a slab under each band of floor, deep dark pits with a bit of mist between them
    const bands = [[8.5, PITS[0].near], [PITS[0].far, PITS[1].near], [PITS[1].far, -8.5]];
    for (const [z0, z1] of bands) {
      box(21, 6, z0 - z1, slabMat, 0, -3.12, (z0 + z1) / 2);
      // a dark lip along each pit edge, so the edge reads as a drop
      if (z1 > -8) box(20, 0.06, 0.16, rimMat, 0, 0.03, z1 + 0.08);
      if (z0 < 8) box(20, 0.06, 0.16, rimMat, 0, 0.03, z0 - 0.08);
    }
    for (const pit of PITS) {
      const d = pit.near - pit.far, z = (pit.near + pit.far) / 2;
      box(21, 0.4, d, pitMat, 0, -5.8, z);
      for (const [mat, off] of [[pitWallMat, 0.01], [pitFadeMat, 0.03]]) { // the far wall, fading down
        const wall = new THREE.Mesh(new THREE.PlaneGeometry(20, 4), mat);
        wall.position.set(0, -2, pit.far + off);
        group.add(wall); extras.push(wall.geometry);
      }
      box(0.5, 6, d, slabMat, -10.25, -3.12, z); box(0.5, 6, d, slabMat, 10.25, -3.12, z);
      for (const x of [-7, 0, 7]) {
        const mist = makeGlow(0x2a7fa8, 7);
        mist.position.set(x, -4.4, z); mist.material.opacity = 0.2;
        group.add(mist); extras.push(mist.material);
      }
    }
  }
  // Word bridge: row 0 (pit A, 2nd form) and row 1 (pit B, 3rd form), three stones
  // each, plus the base form on a plate on the entrance ledge. The game writes the words.
  const stones = [];
  let baseSign = null;
  if (bridge) {
    PITS.forEach((pit, row) => {
      const z = (pit.near + pit.far) / 2;
      STONE.cols.forEach((x, col) => {
        const obj = new THREE.Group();
        const pillar = new THREE.Mesh(stoneGeo, stoneMat);
        pillar.position.y = -2.01; pillar.castShadow = true; pillar.receiveShadow = true;
        const label = makeLabel(STONE.w - 0.2, STONE.d - 0.2, { flat: true });
        label.mesh.position.y = 0.02;
        obj.add(pillar, label.mesh);
        obj.position.set(x, 0, z);
        group.add(obj); extras.push(label);
        stones.push({ row, col, x, z, obj, label, gone: false, shake: 0 });
      });
    });
    baseSign = makeLabel(BASE_SIGN.w, BASE_SIGN.d, { flat: true });
    baseSign.mesh.position.set(BASE_SIGN.x, 0.16, BASE_SIGN.z); // above the tiles' relief
    group.add(baseSign.mesh); extras.push(baseSign);
  }

  // Doors (the leaf is a separate node inside the doorway wall). Rune rooms have three,
  // each with a word sign above it and a brick wall behind it (shown when it was wrong).
  const doors = (rune ? RUNE_DOORS : [DOOR.x]).map((x) => {
    const doorway = Assets.clone('wall_doorway');
    doorway.position.set(x, 0, DOOR.z);
    group.add(doorway);
    const d = { x, z: DOOR.z, leaf: doorway.getObjectByName('wall_doorway_door'), open: false, sign: null, bricks: null };
    if (rune) {
      d.sign = makeLabel(3.5, 1.3);
      d.sign.mesh.position.set(x, 3.7, DOOR.z + 0.85);
      d.sign.mesh.rotation.x = -0.6; // leans towards the camera
      d.bricks = new THREE.Mesh(brickGeo, brickMat);
      d.bricks.position.set(x, 1.7, DOOR.z - 0.3);
      d.bricks.visible = false;
      group.add(d.sign.mesh, d.bricks); extras.push(d.sign);
    }
    return d;
  });

  // Rune room, first wall: three doorways (2nd form) with signs and brick dead ends, walls
  // to the sides, two torches on its front. One material for all of it, faded by the game.
  let inner = null;
  if (rune) {
    const fade = Assets.material.clone();
    fade.transparent = true;
    const wz = RUNE_WALL.z, parts = [];
    for (const x of [-8, 8]) parts.push({ name: 'wall', x, z: wz, rot: 0 });
    for (const x of [-2, 2]) parts.push({ name: 'torch_mounted', x, z: wz + 0.5, rot: 0, y: 2.3 });
    const wallMesh = Assets.mergeStatic(parts);
    wallMesh.material = fade;
    group.add(wallMesh); extras.push(wallMesh.geometry, fade);
    const bricksMat = brickMat.clone(); bricksMat.transparent = true; extras.push(bricksMat);
    const signs = [];
    const gates = RUNE_DOORS.map((x) => {
      const doorway = Assets.clone('wall_doorway');
      doorway.position.set(x, 0, wz);
      doorway.traverse((o) => { if (o.isMesh) o.material = fade; });
      group.add(doorway);
      const d = { x, z: wz, leaf: doorway.getObjectByName('wall_doorway_door'), open: false, pass: false, sign: makeLabel(3.5, 1.3), bricks: new THREE.Mesh(brickGeo, bricksMat) };
      d.sign.mesh.position.set(x, 3.7, wz + 0.85);
      d.sign.mesh.rotation.x = -0.6;
      d.bricks.position.set(x, 1.7, wz - 0.3);
      d.bricks.visible = false;
      group.add(d.sign.mesh, d.bricks); extras.push(d.sign); signs.push(d.sign.mesh.material);
      return d;
    });
    const flames = [-2, 2].map((x) => { const g = makeGlow(0xffa94d, 2.2); g.position.set(x, 2.95, wz + 0.95); group.add(g); extras.push(g.material); return g; });
    inner = { z: wz, half: RUNE_WALL.half, gates, mats: [fade, bricksMat, ...signs, ...flames.map((f) => f.material)], fade: 1 };
  }

  // The verb book on its stand, inside a rune circle (enemies stop at its edge).
  let book = null;
  if (['key', 'ambush', 'vault'].includes(type)) {
    const [bx, bz] = def.book || [BOOK.x, BOOK.z];
    const stand = makeLectern();
    stand.position.set(bx, 0, bz);
    stand.scale.setScalar(1.3);
    stand.rotation.y = Math.atan2(-bx * 0.15, 1); // a slight turn towards the room's middle
    group.add(stand);
    stand.traverse((o) => { if (o.isMesh) extras.push(o.geometry); });
    const circle = new THREE.Mesh(new THREE.PlaneGeometry(BOOK.r * 2.15, BOOK.r * 2.15),
      new THREE.MeshBasicMaterial({ map: circleTex, transparent: true, depthWrite: false, toneMapped: false }));
    circle.rotation.x = -Math.PI / 2; circle.position.set(bx, 0.17, bz); circle.renderOrder = 1;
    group.add(circle); extras.push(circle.geometry, circle.material);
    const glow = makeGlow(0xffd98a, 1.5); glow.position.set(bx, 1.85, bz + 0.2); glow.material.opacity = 0.55;
    group.add(glow); extras.push(glow.material);
    obstacles.push({ x: bx, z: bz, r: 0.6 });
    book = { x: bx, z: bz, r: BOOK.r, obj: stand, circle, glow, done: false, mark: null, pair: null,
      ...stand.userData.book, shut: 0 }; // shut: 0 open … 1 closed (main.js updateBook)
  }

  // Chest with a lid that can open.
  let chest = null;
  if (def.chest) {
    const name = def.chest.gold ? 'chest_gold' : 'chest';
    const o = Assets.clone(name);
    o.position.set(def.chest.x, 0.17, def.chest.z);
    o.rotation.y = THREE.MathUtils.degToRad(def.chest.rot || 0);
    group.add(o);
    obstacles.push({ x: def.chest.x, z: def.chest.z, r: 1.2 });
    chest = { x: def.chest.x, z: def.chest.z, obj: o, lid: o.getObjectByName(`${name}_lid`), open: false, q: null };
  }

  // Torch glows.
  const glows = TORCH_SPOTS.map(([x, y, z], i) => {
    const g = makeGlow(0xffa94d, 2.6);
    g.position.set(i < 2 ? Math.sign(x) * tx : x, y - 0.1, z);
    group.add(g);
    return g;
  });
  // Lock glow on the door: lit by the game once the key is yours (phase 'door').
  const lockGlow = makeGlow(0xffcf5e, 3.2);
  lockGlow.position.set(DOOR.x, 1.5, DOOR.z + 0.75);
  lockGlow.material.opacity = 0;
  group.add(lockGlow);

  return {
    def, group, obstacles, doors, stones, baseSign, chest, glows, lockGlow, search, inner, book,
    wards: book ? [{ x: book.x, z: book.z, r: book.r }] : [], // circles enemies and arrows cannot enter
    exitX: DOOR.x,           // x of the door that leads on (a rune room picks one of three)
    type,                    // room type = which goal unlocks the door (GOALS in main.js)
    phase: 'goal',           // goal (the room's task) → door (key taken: the lock glows) → open
    dispose() {
      if (group.parent) group.parent.remove(group);
      merged.geometry.dispose();
      for (const g of [...glows, lockGlow]) g.material.dispose();
      for (const e of extras) e.dispose();
    },
  };
}
