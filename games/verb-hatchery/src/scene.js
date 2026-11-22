// The 3D island: belt, eggs, incubators, pens, decoration. Drawing only; the
// rules live in state.js. Fixed camera, slightly from above.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RARITY, MAX_PENS, MAX_INCUBATORS } from './balance.js';
import { buildCreature, animateCreature } from './creatures.js';

export const BELT_Z = 7.4, BELT_Y = 0.62, BELT_X0 = -13.5, BELT_X1 = 13.5;
export const INC_POS = Array.from({ length: MAX_INCUBATORS }, (_, i) => new THREE.Vector3(-6.25 + i * 2.5, 0, 3.9));
export const PEN_POS = Array.from({ length: MAX_PENS }, (_, i) => {
  const col = i % 4, row = Math.floor(i / 4);
  return new THREE.Vector3(-6.6 + col * 4.4, 0, 0.4 - row * 3.7);
});

// ── eggs ──
const eggGeo = (() => {
  const g = new THREE.SphereGeometry(1, 24, 18);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), k = 1 - 0.2 * Math.max(0, y);
    p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k);
  }
  g.computeVertexNormals();
  g.scale(0.5, 0.64, 0.5);
  g.translate(0, 0.64, 0);
  return g;
})();
const spotTex = {};
function eggTexture(rarity) {
  if (spotTex[rarity]) return spotTex[rarity];
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const x = c.getContext('2d');
  const R = RARITY[rarity];
  x.fillStyle = R.css; x.fillRect(0, 0, 256, 128);
  const accent = '#' + R.accent.toString(16).padStart(6, '0');
  x.fillStyle = accent;
  if (rarity === 'legendary') {
    x.globalAlpha = 0.5;
    for (let i = 0; i < 6; i++) { x.fillRect(0, 14 + i * 20, 256, 5); }
  } else if (rarity === 'epic') {
    x.globalAlpha = 0.6;
    for (let i = 0; i < 16; i++) { x.beginPath(); const px = i * 16, py = 64 + Math.sin(i) * 10; x.moveTo(px, py - 8); x.lineTo(px + 8, py); x.lineTo(px, py + 8); x.lineTo(px - 8, py); x.fill(); }
  } else {
    x.globalAlpha = 0.55;
    for (let i = 0; i < 26; i++) {
      x.beginPath(); x.arc((i * 61) % 256, 18 + ((i * 37) % 96), 5 + (i % 4) * 3, 0, Math.PI * 2); x.fill();
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return (spotTex[rarity] = t);
}
const eggMats = {};
function eggMat(rarity) {
  if (!eggMats[rarity]) {
    const shiny = rarity === 'legendary' || rarity === 'epic';
    eggMats[rarity] = new THREE.MeshStandardMaterial({
      map: eggTexture(rarity), roughness: shiny ? 0.22 : 0.55, metalness: rarity === 'legendary' ? 0.55 : 0.05,
      emissive: shiny ? RARITY[rarity].color : 0x000000, emissiveIntensity: shiny ? 0.18 : 0,
    });
  }
  return eggMats[rarity];
}
let glowTexture = null;
function glowTex() {
  if (glowTexture) return glowTexture;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.4, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return (glowTexture = new THREE.CanvasTexture(c));
}
export function makeEgg(rarity) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(eggGeo, eggMat(rarity));
  m.castShadow = true;
  g.add(m);
  if (rarity === 'rare' || rarity === 'epic' || rarity === 'legendary') {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: RARITY[rarity].color,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: rarity === 'rare' ? 0.5 : 0.85 }));
    s.scale.setScalar(rarity === 'legendary' ? 2.8 : 2.2); s.position.y = 0.64;
    g.add(s);
    g.userData.glow = s;
  }
  g.userData.shell = m;
  g.userData.rarity = rarity;
  return g;
}

// ── materials ──
const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });
const MAT = {
  grass: M(0x7fd36a), grass2: M(0x6cc35a), sand: M(0xf3dca0), dirt: M(0xb98a5a),
  wood: M(0xc68a52), woodDark: M(0x9a6236), metal: M(0x8fa3c0, { metalness: 0.4, roughness: 0.45 }),
  metalDark: M(0x55657f, { metalness: 0.3, roughness: 0.5 }), white: M(0xffffff),
  teal: M(0x2ee6c0), coral: M(0xff8585), amber: M(0xffcf5e), pen: M(0xa8e08f),
  ghost: new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.28, roughness: 1, depthWrite: false }),
  glass: new THREE.MeshStandardMaterial({ color: 0xcff6ff, transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0.1, depthWrite: false }),
};
function box(w, h, d, m, x, y, z) {
  const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; return o;
}
function cyl(rt, rb, h, m, x, y, z, seg = 24) {
  const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
  o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; return o;
}

export class World {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x8fd8ff);
    this.scene.fog = new THREE.Fog(0x8fd8ff, 45, 90);
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.5, 200);
    this.target = new THREE.Vector3(0, 0, 2.2);
    this.ray = new THREE.Raycaster();
    this.eggs = [];        // belt eggs: { obj, rarity, x, id, hit }
    this.incubators = [];  // { group, base, egg, lid, ring, owned }
    this.pens = [];        // { group, creature, owned }
    this.fx = [];          // short animations: { t, dur, fn(k, dt), end() }
    this.time = 0;
    this._lights();
    this._island();
    this._belt();
    this._slots();
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  _lights() {
    this.scene.add(new THREE.HemisphereLight(0xdff4ff, 0x6a8a4a, 1.3));
    const sun = new THREE.DirectionalLight(0xfff2d8, 2.2);
    sun.position.set(-8, 20, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const c = sun.shadow.camera; c.left = -18; c.right = 18; c.top = 16; c.bottom = -16; c.near = 1; c.far = 60;
    sun.shadow.bias = -0.0005;
    this.scene.add(sun);
  }

  _island() {
    const s = this.scene;
    const water = new THREE.Mesh(new THREE.CircleGeometry(120, 48),
      new THREE.MeshStandardMaterial({ color: 0x3fb8e8, roughness: 0.3, metalness: 0.1 }));
    water.rotation.x = -Math.PI / 2; water.position.y = -0.9; water.receiveShadow = true;
    s.add(water);
    this.water = water;
    const sand = cyl(17.4, 18.2, 1.0, MAT.sand, 0, -0.75, 0, 64); sand.scale.z = 0.78; s.add(sand);
    const grass = cyl(16.2, 16.6, 0.8, MAT.grass, 0, -0.4, 0, 64); grass.scale.z = 0.78; s.add(grass);
    // path between incubators and belt
    const path = box(26, 0.06, 2.0, MAT.dirt, 0, 0.0, 5.55); path.receiveShadow = true; s.add(path);
    // a few flat grass patches for colour
    for (const [x, z, r] of [[-11, -6, 2.2], [11, -5, 2.6], [-12, 3, 1.8], [12, 2.5, 1.6]]) {
      const p = cyl(r, r, 0.05, MAT.grass2, x, 0.01, z, 20); s.add(p);
    }
  }

  _belt() {
    const s = this.scene;
    const len = BELT_X1 - BELT_X0;
    // frame
    s.add(box(len + 0.4, 0.5, 1.9, MAT.metalDark, 0, 0.25, BELT_Z));
    for (const side of [-1, 1]) s.add(box(len + 0.4, 0.22, 0.14, MAT.amber, 0, 0.62, BELT_Z + side * 0.95));
    for (let x = BELT_X0 + 1; x < BELT_X1; x += 3) s.add(box(0.3, 0.4, 2.0, MAT.metal, x, 0.2, BELT_Z));
    // moving surface: a striped texture that scrolls
    const c = document.createElement('canvas'); c.width = 64; c.height = 16;
    const x = c.getContext('2d');
    x.fillStyle = '#3b4458'; x.fillRect(0, 0, 64, 16);
    x.fillStyle = '#566078'; x.fillRect(0, 0, 10, 16);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(len / 1.2, 1); tex.colorSpace = THREE.SRGBColorSpace;
    this.beltTex = tex;
    const top = new THREE.Mesh(new THREE.PlaneGeometry(len, 1.7), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
    top.rotation.x = -Math.PI / 2; top.position.set(0, 0.505, BELT_Z); top.receiveShadow = true;
    s.add(top);
    // chute (left) and drop basket (right)
    s.add(box(1.6, 2.6, 2.2, MAT.teal, BELT_X0 - 0.4, 1.3, BELT_Z));
    s.add(box(1.8, 0.4, 2.4, MAT.coral, BELT_X0 - 0.4, 2.7, BELT_Z));
    const hole = box(1.0, 1.1, 1.6, new THREE.MeshStandardMaterial({ color: 0x1b2438 }), BELT_X0 + 0.12, 1.0, BELT_Z);
    s.add(hole);
    const basket = cyl(1.2, 0.9, 1.0, MAT.wood, BELT_X1 + 0.9, 0.0, BELT_Z, 16); s.add(basket);
  }

  _slots() {
    const s = this.scene;
    for (let i = 0; i < MAX_INCUBATORS; i++) {
      const g = new THREE.Group(); g.position.copy(INC_POS[i]);
      const base = cyl(0.85, 0.95, 0.5, MAT.coral, 0, 0.25, 0, 20); g.add(base);
      const rim = cyl(0.7, 0.7, 0.1, MAT.amber, 0, 0.52, 0, 20); g.add(rim);
      const lamp = cyl(0.08, 0.08, 1.6, MAT.metalDark, -0.75, 0.8, -0.3, 8); g.add(lamp);
      const lampHead = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.32, 12, 1, true), MAT.amber);
      lampHead.position.set(-0.55, 1.55, -0.2); lampHead.rotation.z = -2.2; g.add(lampHead);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
      bulb.position.set(-0.47, 1.48, -0.18); g.add(bulb);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.72, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), MAT.glass);
      dome.position.y = 0.55; dome.scale.y = 1.95; g.add(dome);
      const ghost = cyl(0.85, 0.95, 0.5, MAT.ghost, 0, 0.25, 0, 20);
      const hit = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 2.2, 8), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.y = 1.0; hit.userData.pick = { type: 'inc', i };
      g.add(hit);
      s.add(g); s.add(ghost); ghost.position.copy(INC_POS[i]).setY(0.25);
      this.incubators.push({ group: g, ghost, hit, egg: null, eggRarity: null, owned: false, ready: false, dome, bulb });
    }
    for (let i = 0; i < MAX_PENS; i++) {
      const g = new THREE.Group(); g.position.copy(PEN_POS[i]);
      g.add(box(3.7, 0.3, 3.1, MAT.pen, 0, 0.15, 0));
      // fence posts and rails
      const fence = new THREE.Group();
      for (const [x, z] of [[-1.8, -1.5], [1.8, -1.5], [-1.8, 1.5], [1.8, 1.5], [0, -1.5], [-1.8, 0], [1.8, 0]]) {
        fence.add(box(0.16, 0.7, 0.16, MAT.wood, x, 0.6, z));
      }
      fence.add(box(3.7, 0.1, 0.08, MAT.woodDark, 0, 0.75, -1.5));
      for (const x of [-1.8, 1.8]) fence.add(box(0.08, 0.1, 3.1, MAT.woodDark, x, 0.75, 0));
      for (const x of [-1.3, 1.3]) fence.add(box(1.0, 0.1, 0.08, MAT.woodDark, x, 0.75, 1.5));
      g.add(fence);
      const ghost = box(3.7, 0.3, 3.1, MAT.ghost, PEN_POS[i].x, 0.15, PEN_POS[i].z);
      const hit = new THREE.Mesh(new THREE.BoxGeometry(3.8, 2, 3.2), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.y = 1; hit.userData.pick = { type: 'pen', i };
      g.add(hit);
      const ghostHit = new THREE.Mesh(new THREE.BoxGeometry(3.8, 1, 3.2), new THREE.MeshBasicMaterial({ visible: false }));
      ghostHit.position.copy(PEN_POS[i]).setY(0.5); ghostHit.userData.pick = { type: 'lockedPen', i };
      s.add(g); s.add(ghost); s.add(ghostHit);
      this.pens.push({ group: g, ghost, ghostHit, hit, creature: null, sp: null, owned: false, nextCoin: 1 + Math.random() * 3 });
    }
  }

  // Trees, bushes and rocks (KayKit Forest Nature, CC0). Optional: the game works without.
  async loadDecor() {
    const loader = new GLTFLoader();
    const get = (n) => loader.loadAsync(`assets/nature/${n}_Color1.gltf`).then((g) => g.scene).catch(() => null);
    const names = ['Tree_1_A', 'Tree_2_B', 'Tree_3_A', 'Tree_4_A', 'Tree_6_B', 'Bush_1_A', 'Bush_2_C', 'Bush_4_A', 'Rock_1_A', 'Rock_3_C', 'Rock_2_B', 'Grass_1_A'];
    const models = Object.fromEntries(await Promise.all(names.map(async (n) => [n, await get(n)])));
    const place = (n, x, z, s = 1, ry = 0) => {
      const m = models[n]; if (!m) return;
      const o = m.clone(true);
      o.position.set(x, 0, z); o.scale.setScalar(s); o.rotation.y = ry;
      o.traverse((c) => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
      this.scene.add(o);
    };
    const L = [
      ['Tree_1_A', -12.5, -4, 1.1], ['Tree_3_A', -11, -8.5, 1.2], ['Tree_2_B', -13.6, 0.5, 1.0], ['Tree_6_B', -9.6, -10.2, 1.0],
      ['Tree_4_A', 12.6, -3.5, 1.15], ['Tree_1_A', 11, -8.8, 1.25], ['Tree_2_B', 13.8, 1.2, 0.95], ['Tree_3_A', 8.8, -10.6, 1.0],
      ['Tree_6_B', -3, -11.5, 1.1], ['Tree_4_A', 3.5, -11.6, 1.05], ['Tree_1_A', 0, -12.2, 1.2],
      ['Bush_1_A', -10.4, 3.6, 1], ['Bush_2_C', 10.6, 3.8, 1], ['Bush_4_A', -14, 4.2, 0.9], ['Bush_1_A', 14.2, 4.4, 0.9],
      ['Bush_2_C', -9.4, -1.5, 0.8], ['Bush_4_A', 9.4, -0.8, 0.8],
      ['Rock_1_A', -15, -2.5, 1.2], ['Rock_3_C', 15.2, -1.8, 1.1], ['Rock_2_B', -7.5, -11, 1], ['Rock_1_A', 6.5, -11.4, 0.9],
      ['Grass_1_A', -9.5, 1.8, 1], ['Grass_1_A', 9.8, 1.6, 1], ['Grass_1_A', -11.8, -1.2, 1], ['Grass_1_A', 12, -0.8, 1],
    ];
    for (const [n, x, z, s] of L) place(n, x, z, s, (x * 7 + z * 3) % 6.28);
  }

  // Shows owned slots, and the next one to buy as a faint ghost.
  setOwned(pens, incubators) {
    this.pens.forEach((p, i) => {
      p.owned = i < pens;
      p.group.visible = p.owned;
      p.ghost.visible = i === pens;
      p.ghostHit.visible = i === pens;
    });
    this.incubators.forEach((c, i) => {
      c.owned = i < incubators;
      c.group.visible = c.owned;
      c.ghost.visible = i === incubators;
    });
  }

  // ── belt eggs ──
  spawnEgg(rarity, id) {
    const obj = makeEgg(rarity);
    obj.position.set(BELT_X0 + 0.6, BELT_Y, BELT_Z);
    obj.scale.setScalar(0.01);
    const hit = new THREE.Mesh(new THREE.SphereGeometry(1.0, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = 0.6; obj.add(hit);
    const e = { obj, rarity, x: BELT_X0 + 0.6, id, hit, born: this.time };
    hit.userData.pick = { type: 'egg', egg: e };
    this.scene.add(obj);
    this.eggs.push(e);
    return e;
  }
  removeEgg(e) {
    this.eggs = this.eggs.filter((x) => x !== e);
  }
  updateBelt(dt, speed, held) {
    this.beltTex.offset.x -= (dt * speed) / 1.2;
    for (const e of this.eggs.slice()) {
      const age = this.time - e.born;
      e.obj.scale.setScalar(Math.min(1, age * 3));
      if (e !== held) { e.x += dt * speed; e.obj.position.x = e.x; }
      e.obj.userData.shell.rotation.y += dt * 0.6;
      if (e.obj.userData.glow) e.obj.userData.glow.material.opacity = 0.55 + Math.sin(this.time * 4 + e.id) * 0.25;
      if (e.x > BELT_X1 + 0.3) {
        // falls into the basket at the end
        this.removeEgg(e);
        this.tween(0.45, (k) => { e.obj.position.y = BELT_Y - k * 1.2; e.obj.position.x = e.x + k * 0.8; }, () => this.scene.remove(e.obj));
      }
    }
  }
  holdEgg(e, on) {
    e.held = on;
  }

  // ── incubators ──
  putEgg(i, rarity) {
    const c = this.incubators[i];
    if (c.egg) c.group.remove(c.egg);
    c.egg = makeEgg(rarity); c.eggRarity = rarity;
    c.egg.position.y = 0.55;
    c.group.add(c.egg);
    return c.egg;
  }
  clearIncubator(i) {
    const c = this.incubators[i];
    if (c.egg) c.group.remove(c.egg);
    if (c.waiting) { c.group.remove(c.waiting); c.waiting = null; }
    c.egg = null; c.eggRarity = null;
  }
  // A hatched creature that waits for a free pen stands on the incubator.
  showWaiting(i, sp) {
    const c = this.incubators[i];
    this.clearIncubator(i);
    const cr = buildCreature(sp); cr.position.y = 0.55; cr.scale.setScalar(0.85);
    c.group.add(cr); c.waiting = cr;
    return cr;
  }

  // ── pens ──
  setPenCreature(i, sp) {
    const p = this.pens[i];
    if (p.creature) { p.group.remove(p.creature); p.creature = null; }
    p.sp = sp || null;
    if (sp) {
      const cr = buildCreature(sp);
      cr.position.set(0, 0.3, 0.1);
      cr.scale.setScalar(1.25);
      p.group.add(cr); p.creature = cr;
    }
  }

  // ── picking ──
  pick(clientX, clientY) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const v = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(v, this.camera);
    const targets = [];
    for (const e of this.eggs) targets.push(e.hit);
    for (const c of this.incubators) if (c.owned) targets.push(c.hit);
    for (const p of this.pens) {
      if (p.owned) targets.push(p.hit);
      else if (p.ghostHit.visible) targets.push(p.ghostHit);
    }
    const hits = this.ray.intersectObjects(targets, false);
    for (const h of hits) if (h.object.userData.pick) return h.object.userData.pick;
    return null;
  }
  // world position → screen pixels
  toScreen(v3) {
    const p = v3.clone().project(this.camera);
    const r = this.renderer.domElement.getBoundingClientRect();
    return { x: r.left + (p.x + 1) / 2 * r.width, y: r.top + (1 - p.y) / 2 * r.height, behind: p.z > 1 };
  }

  tween(dur, fn, end) { this.fx.push({ t: 0, dur, fn, end }); }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    this.camera.aspect = aspect;
    // Fit the island width: a narrower screen moves the camera back.
    const fit = Math.max(1, (1.85 / aspect) ** 0.9);
    const dir = new THREE.Vector3(0, 0.7, 0.72).normalize();
    this.camera.position.copy(this.target).addScaledVector(dir, 28.5 * fit);
    this.camera.lookAt(this.target);
    this.camera.updateProjectionMatrix();
  }

  update(dt) {
    this.time += dt;
    for (const f of this.fx.slice()) {
      f.t += dt;
      const k = Math.min(1, f.t / f.dur);
      f.fn(k, dt);
      if (k >= 1) { this.fx.splice(this.fx.indexOf(f), 1); if (f.end) f.end(); }
    }
    for (const p of this.pens) if (p.creature) animateCreature(p.creature, this.time, dt);
    for (const c of this.incubators) {
      if (c.waiting) animateCreature(c.waiting, this.time, dt, 1);
      if (c.egg && c.ready) {
        // ready to hatch: wobble
        const w = Math.sin(this.time * 14) * 0.12 * (Math.sin(this.time * 2.2) > 0.2 ? 1 : 0.2);
        c.egg.rotation.z = w;
      } else if (c.egg) c.egg.rotation.z = 0;
      c.bulb.material.color.setHex(c.egg ? 0xffd27a : 0x8a7a5a);
    }
    this.renderer.render(this.scene, this.camera);
  }
}
