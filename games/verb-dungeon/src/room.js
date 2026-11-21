// Builds one room from level data. Every room has the same shell: floor x −10…10,
// z −8…8, walls on the back and both sides, open front (the camera looks in from
// there), the exit door in the middle of the back wall. Rooms differ in props,
// skeletons and chest. Static pieces are merged into one mesh.
import * as THREE from 'three';
import { Assets } from './assets.js';

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

// def: { props: [[model, x, z, rotDeg, blockRadius, y]], chest: {x, z, rot, gold} | null,
//        skeletons: [[[x, z], …route]], banners: 'red' | 'blue' }
export function buildRoom(def) {
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
  for (let ix = 0; ix < 5; ix++) for (let iz = 0; iz < 4; iz++) {
    put('floor_tile_large', -8 + ix * 4, -6 + iz * 4, ((ix * 7 + iz * 3) % 4) * H);
  }
  put('floor_tile_large', 0, -10.5);
  // Walls. Back wall on z = −8, side walls on x = ±10 (inner faces look into the room).
  put('wall_corner', -10, -8, H); put('wall_corner', 10, -8, 0);
  put('wall_half', -8, -8); put('wall', -4, -8); put('wall_cracked', 4, -8); put('wall_half', 6, -8);
  put('wall', -10, -4, H); put(def.shelves ? 'wall_shelves' : 'wall', -10, 0, H); put('wall', -10, 4, H);
  put('wall_half', -10, 8, H);
  put('wall', 10, -4, -H); put('wall', 10, 0, -H); put('wall', 10, 4, -H); put('wall_half', 10, 6, -H);
  // Torches and wall decoration.
  mount('torch_mounted', -4, -8, 0, 1.2, 2.3, 0.5); mount('torch_mounted', 4, -8, 0, -1.2, 2.3, 0.5);
  mount('torch_mounted', -10, 4, H, 0, 2.3, 0.5); mount('torch_mounted', 10, 4, -H, 0, 2.3, 0.5);
  const back = def.banners === 'blue' ? 'banner_shield_blue' : 'banner_patternA_red';
  const side = def.banners === 'blue' ? 'banner_patternA_red' : 'banner_shield_blue';
  mount(back, -4, -8, 0, -0.9, 0); mount(back, 4, -8, 0, 0.9, 0);
  mount(side, -10, -4, H, 0, 0); mount(side, 10, -4, -H, 0, 0);
  if (def.trophy) mount('sword_shield_gold', 10, 0, -H, 0, 2.4, 0.58);

  for (const [name, x, z, rotDeg = 0, block = 0, y = 0] of def.props || []) {
    put(name, x, z, THREE.MathUtils.degToRad(rotDeg), y);
    if (block) obstacles.push({ x, z, r: block });
  }
  for (const [x, z, r] of def.extraBlocks || []) obstacles.push({ x, z, r });
  const merged = Assets.mergeStatic(stat);
  group.add(merged);
  const slab = new THREE.Mesh(slabGeo, slabMat);
  slab.position.set(0, -1.62, -0.5);
  group.add(slab);

  // Door (the leaf is a separate node inside the doorway wall).
  const doorway = Assets.clone('wall_doorway');
  doorway.position.set(DOOR.x, 0, DOOR.z);
  group.add(doorway);
  const doorLeaf = doorway.getObjectByName('wall_doorway_door');

  // Chest with a lid that can open.
  let chest = null;
  if (def.chest) {
    const name = def.chest.gold ? 'chest_gold' : 'chest';
    const o = Assets.clone(name);
    o.position.set(def.chest.x, 0.17, def.chest.z);
    o.rotation.y = THREE.MathUtils.degToRad(def.chest.rot || 0);
    group.add(o);
    obstacles.push({ x: def.chest.x, z: def.chest.z, r: 1.2 });
    chest = { x: def.chest.x, z: def.chest.z, lid: o.getObjectByName(`${name}_lid`), open: false, q: null };
  }

  // Torch glows.
  const glows = TORCH_SPOTS.map(([x, y, z]) => {
    const g = makeGlow(0xffa94d, 2.6);
    g.position.set(x, y - 0.1, z);
    group.add(g);
    return g;
  });
  // "Ready to unlock" sign: a key floating above the door.
  const keyIcon = Assets.clone('key');
  keyIcon.position.set(DOOR.x, 3.5, DOOR.z + 0.9);
  keyIcon.scale.setScalar(0.001);
  keyIcon.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  group.add(keyIcon);
  const keyGlow = makeGlow(0xffcf5e, 3.2);
  keyGlow.position.set(DOOR.x, 3.5, DOOR.z + 0.85);
  keyGlow.material.opacity = 0;
  group.add(keyGlow);

  return {
    def, group, obstacles, doorLeaf, chest, glows, keyIcon, keyGlow,
    doorOpen: false, doorQ: null,
    dispose() {
      if (group.parent) group.parent.remove(group);
      merged.geometry.dispose();
      for (const g of [...glows, keyGlow]) g.material.dispose();
    },
  };
}
