// The Hall of Fame inside the barn (owner idea 2026-11-25): a bright, tall room with
// pedestals for your best creatures. It is its own little scene far out at sea (the
// fog hides the island); the barn door outside and the door in here switch between
// them with a fade (main.js). Creatures on pedestals earn HALL.bonus × (state.js).
import * as THREE from 'three';
import { MAX_HALL } from './balance.js';
import { HATCHERY } from './world.js';
import { buildCreature } from './creatures.js';
import { t } from './i18n.js';

// the room: x0..x1 × z0..z1, floor at y, h tall
export const ROOM = { x: 0, z: 420, w: 22, d: 16, h: 7.5, y: 0 };
ROOM.x0 = ROOM.x - ROOM.w / 2; ROOM.x1 = ROOM.x + ROOM.w / 2; ROOM.z0 = ROOM.z - ROOM.d / 2; ROOM.z1 = ROOM.z + ROOM.d / 2;
// the door in the room (south wall) and where you stand after coming in
export const HALL_DOOR = new THREE.Vector3(ROOM.x, ROOM.y, ROOM.z0 + 0.6);
export const HALL_SPAWN = new THREE.Vector3(ROOM.x, ROOM.y, ROOM.z0 + 2.6);
// the barn's front door outside, and where you stand after leaving the hall
const A = HATCHERY.hall;
export const BARN_DOOR = new THREE.Vector3(A.x, HATCHERY.y, A.z - A.d / 2 - 0.9);
export const BARN_OUT = new THREE.Vector3(A.x, HATCHERY.y, A.z - A.d / 2 - 2.6);
// pedestals: 3 along the back wall, then the side walls (U shape, facing the middle)
export const PEDESTALS = (() => {
  const P = [], bz = ROOM.z1 - 3.2;
  for (const x of [0, -5, 5]) P.push({ x: ROOM.x + x, z: bz, ry: Math.PI });
  for (const k of [0, 1, 2, 3]) {
    const side = k % 2 ? 1 : -1, row = Math.floor(k / 2);
    P.push({ x: ROOM.x + side * (ROOM.w / 2 - 3), z: ROOM.z1 - 7.2 - row * 4, ry: -side * Math.PI / 2 });
  }
  P.push({ x: ROOM.x, z: ROOM.z1 - 7.6, ry: Math.PI }); // the eighth in the middle
  return P.slice(0, MAX_HALL);
})();

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
  return tx;
}
const M = (o) => new THREE.MeshLambertMaterial(o);
function box(g, w, h, d, mat, x, y, z, cast = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; g.add(m); return m;
}

export class Hall {
  constructor(world) {
    this.world = world;
    const g = this.group = new THREE.Group();
    const { x0, x1, z0, z1, y, h, w, d } = ROOM;
    // floor: warm wooden planks
    const planks = canvasTex(64, 256, (x) => {
      for (let i = 0; i < 8; i++) { x.fillStyle = ['#c98f55', '#c08750', '#cf9a5e', '#b97f49'][i % 4]; x.fillRect(0, i * 32, 64, 32); x.fillStyle = 'rgba(80,40,15,.35)'; x.fillRect(0, i * 32, 64, 2); }
    });
    planks.wrapS = planks.wrapT = THREE.RepeatWrapping; planks.repeat.set(w / 4, d / 2.5);
    box(g, w, 0.2, d, M({ map: planks }), ROOM.x, y - 0.1, ROOM.z, false);
    // a red carpet from the door to the back
    box(g, 2.4, 0.03, d - 1.5, M({ color: 0xc0392b }), ROOM.x, y + 0.02, ROOM.z - 0.2, false);
    box(g, 2.0, 0.035, d - 1.9, M({ color: 0xe0574a }), ROOM.x, y + 0.025, ROOM.z - 0.2, false);
    // walls (no shadows: the sun shines "through" the roof so the room stays bright)
    const wall = M({ color: 0xfff1d6, emissive: 0x8a7a5e }), // (lit from inside: the sun can't reach every wall) beam = M({ color: 0x7a4a26 }), dark = M({ color: 0x5e3a1f });
    box(g, w, h, 0.3, wall, ROOM.x, y + h / 2, z1, false);
    box(g, 0.3, h, d, wall, x0, y + h / 2, ROOM.z, false);
    box(g, 0.3, h, d, wall, x1, y + h / 2, ROOM.z, false);
    for (const sx of [-1, 1]) box(g, (w - 3.2) / 2, h, 0.3, wall, ROOM.x + sx * (w + 3.2) / 4, y + h / 2, z0, false);
    box(g, 3.2, h - 3.4, 0.3, wall, ROOM.x, y + 3.4 + (h - 3.4) / 2, z0, false);
    // timber frame: posts and a top beam all round, ceiling beams
    for (let i = 0; i <= 5; i++) { const xx = x0 + 0.2 + i * (w - 0.4) / 5; box(g, 0.3, h, 0.3, beam, xx, y + h / 2, z1 - 0.2, false); }
    for (let j = 0; j <= 3; j++) { const zz = z0 + 0.2 + j * (d - 0.4) / 3; for (const xx of [x0 + 0.2, x1 - 0.2]) box(g, 0.3, h, 0.3, beam, xx, y + h / 2, zz, false); }
    for (const zz of [z0 + 0.2, z1 - 0.2]) box(g, w, 0.3, 0.3, beam, ROOM.x, y + h - 0.15, zz, false);
    for (const xx of [x0 + 0.2, x1 - 0.2]) box(g, 0.3, 0.3, d, beam, xx, y + h - 0.15, ROOM.z, false);
    for (let i = 1; i < 6; i++) box(g, 0.35, 0.45, d, dark, x0 + i * w / 6, y + h - 0.2, ROOM.z, false);
    box(g, w, 0.1, d, M({ color: 0x8a5a33 }), ROOM.x, y + h + 0.05, ROOM.z, false); // ceiling
    // the door frame (way out) with a glowing doorway
    box(g, 0.4, 3.4, 0.5, beam, ROOM.x - 1.7, y + 1.7, z0, false); box(g, 0.4, 3.4, 0.5, beam, ROOM.x + 1.7, y + 1.7, z0, false);
    box(g, 3.8, 0.4, 0.5, beam, ROOM.x, y + 3.4, z0, false);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 3.2), new THREE.MeshBasicMaterial({ color: 0xfff3c4 }));
    glow.position.set(ROOM.x, y + 1.6, z0 - 0.05); g.add(glow);
    // windows with warm light, on the side walls
    const winMat = new THREE.MeshBasicMaterial({ color: 0xffe3a0 });
    for (const xx of [x0 + 0.17, x1 - 0.17]) for (const zz of [ROOM.z - 4, ROOM.z + 1.5]) {
      const wm = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.6), winMat);
      wm.position.set(xx, y + 4.6, zz); wm.rotation.y = xx < ROOM.x ? Math.PI / 2 : -Math.PI / 2; g.add(wm);
      box(g, 0.12, 0.15, 2.4, beam, xx, y + 4.6, zz, false); box(g, 0.12, 1.8, 0.15, beam, xx, y + 4.6, zz, false);
    }
    // the banner on the back wall
    const banner = canvasTex(1024, 256, (x, W, H) => {
      x.fillStyle = '#0d2240'; x.beginPath(); x.roundRect(8, 8, W - 16, H - 16, 40); x.fill();
      x.strokeStyle = '#ffcf5e'; x.lineWidth = 12; x.stroke();
      x.fillStyle = '#ffcf5e'; x.font = "96px 'Fredoka One', sans-serif"; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(`★ ${t('hallTitle')} ★`, W / 2, H / 2 + 4);
    });
    const bm = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.25), new THREE.MeshBasicMaterial({ map: banner }));
    bm.position.set(ROOM.x, y + 5.5, z1 - 0.2); bm.rotation.y = Math.PI; g.add(bm);
    // lanterns hanging from the beams (glowing balls)
    const lamp = new THREE.MeshBasicMaterial({ color: 0xffd27a });
    for (let i = 1; i < 6; i += 2) for (const zz of [ROOM.z - 3, ROOM.z + 3]) {
      const lx = x0 + i * w / 6;
      box(g, 0.05, 1.2, 0.05, dark, lx, y + h - 0.9, zz, false);
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), lamp); b.position.set(lx, y + h - 1.6, zz); g.add(b);
    }
    // pedestals
    const stone = M({ color: 0xe8e0d0 }), gold = new THREE.MeshLambertMaterial({ color: 0xffcf5e, emissive: 0x6a4a00 });
    const ghost = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, depthWrite: false });
    this.slots = PEDESTALS.map((p, i) => {
      const sg = new THREE.Group(); sg.position.set(p.x, y, p.z); g.add(sg);
      const base = new THREE.Group(); sg.add(base);
      const cyl = (r1, r2, hh, m, yy) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, hh, 24), m); c.position.y = yy; c.castShadow = true; c.receiveShadow = true; base.add(c); };
      cyl(1.15, 1.25, 0.35, stone, 0.17); cyl(1.0, 1.05, 0.5, stone, 0.6); cyl(1.08, 1.08, 0.08, gold, 0.88);
      const gh = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.25, 0.9, 24), ghost); gh.position.y = 0.45; sg.add(gh);
      const ring = new THREE.Mesh(new THREE.RingGeometry(1.3, 1.55, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x2ee6c0, transparent: true, opacity: 0.55 }));
      ring.position.y = 0.03; sg.add(ring);
      return { group: sg, base, ghost: gh, ring, p, creature: null, sp: null, owned: false, col: world.addCollider(p.x, p.z, 1.25), i };
    });
    world.scene.add(g);
    this.t = 0;
  }
  setOwned(n) {
    this.slots.forEach((s, i) => {
      s.owned = i < n;
      s.base.visible = s.owned; s.col.off = !s.owned;
      s.ghost.visible = i === n; // the next one to buy, as a ghost
      s.ring.visible = s.owned;
    });
  }
  setCreature(i, sp) {
    const s = this.slots[i];
    if (s.sp === sp) return;
    if (s.creature) { s.group.remove(s.creature); s.creature = null; }
    s.sp = sp || null;
    if (sp) {
      const cr = buildCreature(sp);
      const h = cr.userData.height || 1;
      cr.scale.setScalar(cr.userData.real ? Math.min(Math.max(1.8, 1.4 / h), 2.6 / h) : 1.6);
      cr.position.y = 0.92; cr.rotation.y = s.p.ry;
      s.group.add(cr); s.creature = cr;
    }
  }
  // spin the rings of empty owned pedestals a little (they invite you to place one)
  update(dt, animate) {
    this.t += dt;
    for (const s of this.slots) {
      s.ring.material.opacity = s.sp ? 0.25 : 0.4 + Math.sin(this.t * 3 + s.i) * 0.25;
      if (s.creature) animate(s.creature, this.t, dt);
    }
  }
}
