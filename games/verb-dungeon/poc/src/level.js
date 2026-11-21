import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { rand, canvasTexture, triplanarUV } from './utils.js';

// ---- layout constants (x across, z = depth into the dungeon) ----
export const L = {
  start: { x: 0, z: -6.5 },
  hall: { x: [-7, 7], z: [-9, 9] },
  corridor: { x: [-2, 2], z: [9, 21] },
  antechamber: { x: [-4, 4], z: [21, 25] },
  chasm: { x: [-7, 7], z: [25, 45], pit: { z: [31.3, 38.7] }, bridgeHalfW: 0.78 },
  ambush: { x: [-6, 6], z: [45, 59] },
  puzzle: { x: [-7, 7], z: [59, 73] },
  vault: { x: [-7, 7], z: [76, 92] },
  runeX: [-4.5, 0, 4.5],
  runeZ: 73, // tunnels run z 73..76
  hatches: [[-3, 52], [0, 54], [3, 52]],
  chest1: { x: 5.1, z: 42.0 },
  finalChest: { x: 0, z: 88 },
};

const WALL_H = 5;

// ---------- procedural textures ----------
function stoneTex() {
  return canvasTexture(256, 256, (g) => {
    g.fillStyle = '#39456b'; g.fillRect(0, 0, 256, 256);
    const rowH = 32;
    for (let row = 0; row < 8; row++) {
      const off = row % 2 ? 32 : 0;
      for (let col = -1; col < 4; col++) {
        const x = col * 64 + off, y = row * rowH;
        const l = 36 + Math.random() * 12;
        g.fillStyle = `hsl(${222 + Math.random() * 8}, ${26 + Math.random() * 8}%, ${l}%)`;
        g.fillRect(x + 2, y + 2, 60, rowH - 4);
      }
    }
    g.strokeStyle = '#1b2138'; g.lineWidth = 3;
    for (let row = 0; row <= 8; row++) {
      g.beginPath(); g.moveTo(0, row * rowH); g.lineTo(256, row * rowH); g.stroke();
      const off = row % 2 ? 32 : 0;
      for (let col = 0; col < 5; col++) {
        g.beginPath(); g.moveTo(col * 64 + off, row * rowH); g.lineTo(col * 64 + off, row * rowH + rowH); g.stroke();
      }
    }
    g.fillStyle = 'rgba(0,0,0,.18)';
    for (let i = 0; i < 320; i++) g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    g.fillStyle = 'rgba(180,210,255,.07)';
    for (let i = 0; i < 200; i++) g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  });
}

function floorTex() {
  return canvasTexture(256, 256, (g) => {
    g.fillStyle = '#1c2440'; g.fillRect(0, 0, 256, 256);
    for (let ry = 0; ry < 2; ry++) for (let rx = 0; rx < 2; rx++) {
      const l = 25 + Math.random() * 7;
      g.fillStyle = `hsl(${224 + Math.random() * 6}, ${28 + Math.random() * 6}%, ${l}%)`;
      g.fillRect(rx * 128 + 4, ry * 128 + 4, 120, 120);
      if (Math.random() < 0.5) { // hairline crack
        g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2; g.beginPath();
        let x = rx * 128 + 20 + Math.random() * 60, y = ry * 128 + 10;
        g.moveTo(x, y);
        for (let s = 0; s < 4; s++) { x += (Math.random() - 0.5) * 40; y += 28; g.lineTo(x, y); }
        g.stroke();
      }
    }
    g.fillStyle = 'rgba(0,0,0,.2)';
    for (let i = 0; i < 380; i++) g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  });
}

function woodTex() {
  return canvasTexture(128, 128, (g) => {
    g.fillStyle = '#6b4527'; g.fillRect(0, 0, 128, 128);
    for (let p = 0; p < 4; p++) {
      g.fillStyle = `hsl(${26 + Math.random() * 8}, ${38 + Math.random() * 10}%, ${24 + Math.random() * 9}%)`;
      g.fillRect(p * 32 + 1, 0, 30, 128);
      g.strokeStyle = 'rgba(40,20,8,.5)'; g.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) {
        g.beginPath(); g.moveTo(p * 32 + 4 + Math.random() * 24, 0);
        g.bezierCurveTo(p * 32 + 16, 40 + Math.random() * 30, p * 32 + 16, 80, p * 32 + 4 + Math.random() * 24, 128);
        g.stroke();
      }
    }
  });
}

function brickTex() {
  return canvasTexture(128, 128, (g) => {
    g.fillStyle = '#3a221c'; g.fillRect(0, 0, 128, 128);
    for (let row = 0; row < 8; row++) {
      const off = row % 2 ? 16 : 0;
      for (let col = -1; col < 5; col++) {
        g.fillStyle = `hsl(${10 + Math.random() * 10}, ${34 + Math.random() * 10}%, ${30 + Math.random() * 9}%)`;
        g.fillRect(col * 32 + off + 1, row * 16 + 1, 30, 14);
      }
    }
  });
}

function flameTex() {
  return canvasTexture(64, 96, (g) => {
    const r = g.createRadialGradient(32, 66, 4, 32, 60, 52);
    r.addColorStop(0, 'rgba(255,240,170,1)');
    r.addColorStop(0.35, 'rgba(255,170,60,.85)');
    r.addColorStop(0.7, 'rgba(255,90,20,.35)');
    r.addColorStop(1, 'rgba(255,60,0,0)');
    g.fillStyle = r;
    g.beginPath(); g.ellipse(32, 54, 26, 42, 0, 0, Math.PI * 2); g.fill();
  });
}

function glowTex() {
  return canvasTexture(128, 128, (g) => {
    const r = g.createRadialGradient(64, 64, 6, 64, 64, 62);
    r.addColorStop(0, 'rgba(255,190,110,.55)');
    r.addColorStop(1, 'rgba(255,150,60,0)');
    g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  });
}

function fogTexture() {
  return canvasTexture(128, 128, (g) => {
    const r = g.createRadialGradient(64, 64, 8, 64, 64, 62);
    r.addColorStop(0, 'rgba(150,190,245,.75)');
    r.addColorStop(0.55, 'rgba(140,175,235,.4)');
    r.addColorStop(1, 'rgba(120,160,220,0)');
    g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  });
}

function webTexture() {
  return canvasTexture(128, 128, (g) => {
    g.strokeStyle = 'rgba(220,235,255,.5)'; g.lineWidth = 1.5;
    for (let i = 0; i <= 4; i++) {
      g.beginPath(); g.moveTo(0, 0);
      const a = (i / 4) * Math.PI / 2;
      g.lineTo(Math.cos(a) * 180, Math.sin(a) * 180); g.stroke();
    }
    for (let r = 22; r < 130; r += 26) {
      g.beginPath();
      for (let i = 0; i <= 12; i++) {
        const a = (i / 12) * Math.PI / 2;
        const rr = r * (0.94 + 0.06 * Math.sin(i * 2.2));
        g[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr);
      }
      g.stroke();
    }
  });
}

function runeRingTex() {
  return canvasTexture(512, 512, (g) => {
    g.translate(256, 256);
    g.strokeStyle = '#2ee6c0'; g.lineWidth = 7;
    g.beginPath(); g.arc(0, 0, 215, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 3;
    g.beginPath(); g.arc(0, 0, 178, 0, Math.PI * 2); g.stroke();
    const runes = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛋ';
    g.fillStyle = '#2ee6c0'; g.font = '38px serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      g.save();
      g.translate(Math.cos(a) * 196, Math.sin(a) * 196);
      g.rotate(a + Math.PI / 2);
      g.fillText(runes[i % runes.length], 0, 0);
      g.restore();
    }
  });
}

// ---------- build ----------
export function buildLevel(scene) {
  const group = new THREE.Group();
  scene.add(group);

  const mats = {
    wall: new THREE.MeshLambertMaterial({ map: stoneTex() }),
    floor: new THREE.MeshLambertMaterial({ map: floorTex() }),
    dark: new THREE.MeshLambertMaterial({ color: 0x0e1528 }),
    wood: new THREE.MeshLambertMaterial({ map: woodTex() }),
    gold: new THREE.MeshLambertMaterial({ color: 0xf7c75c, emissive: 0x3d2a06 }),
    brick: new THREE.MeshLambertMaterial({ map: brickTex() }),
    stone: new THREE.MeshLambertMaterial({ color: 0x39456b }),
    stoneDk: new THREE.MeshLambertMaterial({ color: 0x252e4e }),
    bone: new THREE.MeshLambertMaterial({ color: 0xe8e4d4 }),
    flameTex: flameTex(),
    glowTex: glowTex(),
  };

  const colliders = [];
  // `tall` marks full-height walls so the camera knows to crane up over them
  function addCollider(cx, cz, w, d, tall = false) {
    const c = { minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, off: false, tall };
    colliders.push(c);
    return c;
  }

  // static geometry buckets, merged into one mesh per material at the end —
  // every static prop costs zero extra draw calls
  const buckets = { wall: [], floor: [], dark: [], stone: [], wood: [], gold: [] };
  const composeM = (px, py, pz, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) =>
    new THREE.Matrix4().compose(new THREE.Vector3(px, py, pz),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
      new THREE.Vector3(sx, sy, sz));
  function bake(bucket, geo, m) { buckets[bucket].push(geo.clone().applyMatrix4(m)); }
  function box(bucket, cx, cy, cz, w, h, d, uvS = 0.4) {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(cx, cy, cz);
    triplanarUV(g, uvS);
    buckets[bucket].push(g);
  }
  const wall = (cx, cz, w, d, h = WALL_H) => { box('wall', cx, h / 2, cz, w, h, d); addCollider(cx, cz, w, d, true); };
  const floor = (cx, cz, w, d) => box('floor', cx, -0.15, cz, w, 0.3, d, 0.25);

  // -- walls (thickness .6) --
  wall(-4.4, -9, 5.2, 0.6); wall(4.4, -9, 5.2, 0.6);            // hall south (entrance gap)
  wall(-7, 0, 0.6, 18.6); wall(7, 0, 0.6, 18.6);                // hall sides
  wall(-4.3, 9, 5.4, 0.6); wall(4.3, 9, 5.4, 0.6);              // hall north (corridor gap)
  wall(-2, 15, 0.6, 12.6); wall(2, 15, 0.6, 12.6);              // corridor sides
  wall(-3, 21, 2.6, 0.6); wall(3, 21, 2.6, 0.6);                // antechamber shoulders
  wall(-4, 23, 0.6, 4.6); wall(4, 23, 0.6, 4.6);                // antechamber sides
  wall(-4.3, 25, 5.4, 0.6); wall(4.3, 25, 5.4, 0.6);            // verb door 1 wall
  wall(-7, 35, 0.6, 20.6); wall(7, 35, 0.6, 20.6);              // chasm room sides
  wall(-4.3, 45, 5.4, 0.6); wall(4.3, 45, 5.4, 0.6);            // ambush entry wall
  wall(-6, 52, 0.6, 14.6); wall(6, 52, 0.6, 14.6);              // ambush sides
  wall(-4.3, 59, 5.4, 0.6); wall(4.3, 59, 5.4, 0.6);            // verb door 2 wall
  wall(-7, 66, 0.6, 14.6); wall(7, 66, 0.6, 14.6);              // puzzle sides
  // thick rune wall with three tunnels (z 73..76)
  wall(-6.35, 74.5, 1.3, 3.0); wall(-2.25, 74.5, 2.1, 3.0);
  wall(2.25, 74.5, 2.1, 3.0); wall(6.35, 74.5, 1.3, 3.0);
  wall(-7, 84, 0.6, 16.6); wall(7, 84, 0.6, 16.6);              // vault sides
  wall(0, 92, 14.6, 0.6);                                       // far wall

  // -- floors --
  floor(0, 0, 14.6, 18.6);          // hall
  floor(0, 15, 5, 12.6);            // corridor
  floor(0, 23, 8.6, 4.6);           // antechamber
  floor(0, 28, 14.6, 6.6);          // chasm south lip
  floor(0, 42, 14.6, 6.6);          // chasm north lip
  floor(0, 52, 12.6, 14.6);         // ambush
  floor(0, 66, 14.6, 14.6);         // puzzle
  floor(0, 82.5, 14.6, 19.6);       // tunnels + vault

  // -- the pit --
  box('dark', 0, -4, 31, 14.6, 8, 0.6);    // south inner face
  box('dark', 0, -4, 39, 14.6, 8, 0.6);    // north inner face
  box('dark', -6.7, -4, 35, 0.6, 8, 8.6);
  box('dark', 6.7, -4, 35, 0.6, 8, 8.6);
  const pitBottom = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 12).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x03060e }));
  pitBottom.position.set(0, -7.6, 35);
  group.add(pitBottom);

  // door frames at the three gate walls + entrance
  function doorFrame(z, gapHalf = 1.7) {
    for (const s of [-1, 1]) box('dark', s * (gapHalf + 0.25), 2.1, z, 0.5, 4.2, 0.95, 0.5);
    box('dark', 0, 4.4, z, gapHalf * 2 + 1, 0.8, 0.95, 0.5);
  }
  doorFrame(-9, 1.9); doorFrame(25); doorFrame(45); doorFrame(59);

  // -- bridge (baked) --
  const plankGeo = new THREE.BoxGeometry(1.3, 0.09, 0.42);
  for (let z = 31.1; z <= 38.9; z += 0.55) {
    bake('wood', plankGeo, composeM(rand(-0.04, 0.04), -0.04 + rand(-0.02, 0.02), z, 0, rand(-0.05, 0.05)));
  }
  const postGeo = new THREE.CylinderGeometry(0.045, 0.055, 0.7, 6);
  const ropeGeo = new THREE.CylinderGeometry(0.022, 0.022, 8.2, 5).rotateX(Math.PI / 2);
  for (const sx of [-0.68, 0.68]) {
    for (const z of [31.2, 35, 38.8]) bake('wood', postGeo, composeM(sx, 0.3, z));
    bake('dark', ropeGeo, composeM(sx, 0.58, 35));
  }

  // -- chasm fog planes --
  const fogPlanes = [];
  const fogMat = new THREE.MeshBasicMaterial({
    map: fogTexture(), transparent: true, opacity: 0.55, depthWrite: false,
  });
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(10 + i * 1.5, 7.5).rotateX(-Math.PI / 2), fogMat);
    m.position.set(rand(-3, 3), -1.2 - i * 0.65, 35 + rand(-1.2, 1.2));
    m.renderOrder = 2;
    group.add(m);
    fogPlanes.push({ mesh: m, seed: rand(10), speed: rand(0.15, 0.4) });
  }

  // -- torches (statics baked; only flame + glow are live objects) --
  const torches = [];
  const flameGeo = BufferGeometryUtils.mergeGeometries([
    new THREE.PlaneGeometry(0.5, 0.75),
    new THREE.PlaneGeometry(0.5, 0.75).rotateY(Math.PI / 2),
  ]);
  const stickGeo = new THREE.CylinderGeometry(0.045, 0.06, 0.7, 6);
  const cupGeo = new THREE.CylinderGeometry(0.1, 0.05, 0.16, 6);
  const bracketGeo = new THREE.BoxGeometry(0.14, 0.3, 0.14);
  const flameMat = new THREE.MeshBasicMaterial({
    map: mats.flameTex, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const flameMatGold = flameMat.clone();
  flameMatGold.color.set(0xbfffe9);
  const glowMat = new THREE.SpriteMaterial({
    map: mats.glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  function makeTorch(x, z, faceAngle, { lit = true, gold = false } = {}) {
    const root = composeM(x, 2.2, z, 0, faceAngle);
    bake('dark', bracketGeo, root.clone().multiply(composeM(0, -0.25, -0.12)));
    bake('wood', stickGeo, root.clone().multiply(composeM(0, 0, 0.06, 0.35)));
    bake('dark', cupGeo, root.clone().multiply(composeM(0, 0.34, 0.18)));
    const t = new THREE.Group();
    t.position.set(x, 2.2, z);
    t.rotation.y = faceAngle;
    const flame = new THREE.Mesh(flameGeo, gold ? flameMatGold : flameMat);
    flame.position.set(0, 0.74, 0.18);
    t.add(flame);
    const glow = new THREE.Sprite(glowMat);
    glow.scale.setScalar(1.5);
    glow.position.copy(flame.position);
    t.add(glow);
    const torch = { group: t, flame, glow, lit, seed: rand(20), igniteT: lit ? 1 : 0 };
    if (!lit) { flame.scale.setScalar(0.001); glow.scale.setScalar(0.001); }
    torches.push(torch);
    group.add(t);
    return torch;
  }

  // hall torches start dark — they ignite one by one in the intro beat
  const hallTorches = [];
  for (const z of [-5.5, -1.5, 2.5, 6.5]) {
    hallTorches.push(makeTorch(-6.55, z, Math.PI / 2, { lit: false }));
    hallTorches.push(makeTorch(6.55, z, -Math.PI / 2, { lit: false }));
  }
  makeTorch(-1.82, 13, Math.PI / 2); makeTorch(1.82, 19, -Math.PI / 2);
  makeTorch(-3.82, 23, Math.PI / 2); makeTorch(3.82, 23, -Math.PI / 2);
  makeTorch(-6.55, 27, Math.PI / 2); makeTorch(6.55, 27, -Math.PI / 2);
  makeTorch(-6.55, 43, Math.PI / 2); makeTorch(6.55, 43, -Math.PI / 2);
  makeTorch(-5.55, 47.5, Math.PI / 2); makeTorch(5.55, 47.5, -Math.PI / 2);
  makeTorch(-5.55, 56.5, Math.PI / 2); makeTorch(5.55, 56.5, -Math.PI / 2);
  makeTorch(-6.55, 61.5, Math.PI / 2); makeTorch(6.55, 61.5, -Math.PI / 2);
  makeTorch(-6.55, 70.5, Math.PI / 2); makeTorch(6.55, 70.5, -Math.PI / 2);
  makeTorch(-6.55, 78, Math.PI / 2, { gold: true }); makeTorch(6.55, 78, -Math.PI / 2, { gold: true });
  makeTorch(-6.55, 86, Math.PI / 2, { gold: true }); makeTorch(6.55, 86, -Math.PI / 2, { gold: true });

  // -- lights (8 points + hemisphere; no shadow maps, blob shadows instead) --
  scene.add(new THREE.HemisphereLight(0x55699f, 0x241c3a, 1.35));
  const lights = [];
  function light(x, y, z, color, base, dist = 26) {
    const pl = new THREE.PointLight(color, base, dist, 2);
    pl.position.set(x, y, z);
    scene.add(pl);
    lights.push({ pl, base, seed: rand(20) });
    return lights[lights.length - 1];
  }
  const hallLight = light(0, 4.2, 0, 0xff9a4d, 0);   // ramps up with the torch beat
  light(0, 3.2, -7.8, 0xff9a4d, 16, 12);             // dim embers by the entrance doors
  light(0, 3.4, 17, 0xff9a4d, 48);
  light(0, 4, 27.5, 0xff9a4d, 56);
  light(0, 4, 42.5, 0xff9a4d, 56);
  light(0, 4.4, 52, 0xff9a4d, 62);
  light(0, 4.2, 66, 0xff9a4d, 62);
  light(-3, 4, 84, 0xffd27a, 62);
  light(3, 4, 87, 0xffd27a, 62);

  // -- entrance double doors (start open, slam shut behind the player) --
  const doorPanelGeo = new THREE.BoxGeometry(1.85, 3.9, 0.18).translate(0.925, 1.95, 0);
  const bandGeo = new THREE.BoxGeometry(1.7, 0.16, 0.22).translate(0.925, 0, 0);
  const entrance = { panels: [], closing: false, t: 0, collider: addCollider(0, -9, 3.8, 0.5, true) };
  entrance.collider.off = true;
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(s * 1.85, 0, -9);
    const panel = new THREE.Mesh(doorPanelGeo, mats.wood);
    for (const by of [0.8, 3.1]) {
      const band = new THREE.Mesh(bandGeo, mats.stoneDk);
      band.position.y = by; panel.add(band);
    }
    if (s === 1) panel.scale.x = -1;
    pivot.add(panel);
    pivot.rotation.y = s * 1.85; // open outward
    group.add(pivot);
    entrance.panels.push({ pivot, openRot: s * 1.85 });
  }

  // -- ambush slam door (stone slab drops from above) --
  const slab = new THREE.Mesh(new THREE.BoxGeometry(3.4, 4.2, 0.5), mats.stone);
  slab.position.set(0, 7.5, 45);
  slab.visible = false;
  group.add(slab);
  const ambushDoor = { slab, state: 'open', t: 0, collider: addCollider(0, 45, 3.4, 0.6, true) };
  ambushDoor.collider.off = true;

  // -- ambush floor hatches --
  const hatches = [];
  const hatchGeo = new THREE.BoxGeometry(1.3, 0.1, 1.3).translate(0, 0, -0.65);
  for (const [hx, hz] of L.hatches) {
    const pivot = new THREE.Group();
    pivot.position.set(hx, 0.06, hz + 0.65);
    const lid = new THREE.Mesh(hatchGeo, mats.wood);
    pivot.add(lid);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.03, 6, 12).rotateX(Math.PI / 2), mats.stoneDk);
    ring.position.set(0, 0.08, -0.65); pivot.add(ring);
    group.add(pivot);
    hatches.push({ pivot, opening: false, t: 0 });
  }

  // -- crab statues in the hall (Krabsy says hi), all baked --
  function crabStatue(x, z) {
    const root = composeM(x, 0, z);
    const B = (bucket, geo, local) => bake(bucket, geo, root.clone().multiply(local));
    B('dark', new THREE.BoxGeometry(1.3, 0.7, 1.3), composeM(0, 0.35, 0));
    B('stone', new THREE.SphereGeometry(0.5, 14, 10), composeM(0, 1.05, 0, 0, 0, 0, 1.15, 0.7, 0.9));
    for (const sx of [-1, 1]) {
      B('stone', new THREE.SphereGeometry(0.22, 10, 8), composeM(sx * 0.62, 1.12, 0.32, 0, 0, 0, 1, 0.8, 1.2));
      B('stone', new THREE.BoxGeometry(0.1, 0.12, 0.26), composeM(sx * 0.62, 1.2, 0.55));
      for (let i = 0; i < 3; i++)
        B('stone', new THREE.CylinderGeometry(0.04, 0.03, 0.45, 5),
          composeM(sx * (0.45 + i * 0.06), 0.85, -0.1 - i * 0.16, 0, 0, sx * 0.85));
      B('stone', new THREE.CylinderGeometry(0.035, 0.035, 0.22, 5), composeM(sx * 0.16, 1.45, 0.25));
      B('dark', new THREE.SphereGeometry(0.07, 8, 6), composeM(sx * 0.16, 1.57, 0.27));
    }
    addCollider(x, z, 1.3, 1.3);
  }
  crabStatue(-4.2, 4.5); crabStatue(4.2, 4.5);

  // -- cobwebs --
  const webMat = new THREE.MeshBasicMaterial({
    map: webTexture(), transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0.7,
  });
  const webGeo = new THREE.PlaneGeometry(1.6, 1.6);
  for (const [wx, wz, ry] of [[-6.6, -8.5, Math.PI / 4], [6.6, -8.5, -Math.PI / 4],
    [-6.6, 8.5, Math.PI * 0.75], [5.6, 45.5, -Math.PI * 0.75], [-5.6, 58.5, Math.PI / 4]]) {
    const w = new THREE.Mesh(webGeo, webMat);
    w.position.set(wx, 4.1, wz);
    w.rotation.y = ry;
    group.add(w);
  }

  // -- rune circle on the puzzle-room floor --
  const runeRing = new THREE.Mesh(
    new THREE.PlaneGeometry(5.6, 5.6).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      map: runeRingTex(), transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, opacity: 0.8,
    }));
  runeRing.position.set(0, 0.04, 66);
  group.add(runeRing);

  // -- vault dressing: dais, pillars, coin piles (all baked) --
  bake('stone', new THREE.CylinderGeometry(2.1, 2.3, 0.26, 24), composeM(0, 0.13, 88));
  bake('stone', new THREE.CylinderGeometry(1.45, 1.6, 0.26, 24), composeM(0, 0.39, 88));
  const pillarGeo = new THREE.CylinderGeometry(0.45, 0.55, 5, 10);
  const trimGeo = new THREE.TorusGeometry(0.52, 0.08, 8, 16).rotateX(Math.PI / 2);
  for (const [px, pz] of [[-5, 78.5], [5, 78.5], [-5, 89.5], [5, 89.5]]) {
    bake('stone', pillarGeo, composeM(px, 2.5, pz));
    bake('gold', trimGeo, composeM(px, 0.5, pz));
    addCollider(px, pz, 1.1, 1.1);
  }
  const pileGeo = new THREE.ConeGeometry(1.1, 0.75, 12);
  const coinGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.045, 10);
  for (const [px, pz, ps] of [[-4.6, 84, 1], [4.6, 85.5, 1.25], [-3.4, 90.5, 0.8], [4.2, 90.8, 1]]) {
    bake('gold', pileGeo, composeM(px, 0.37 * ps, pz, 0, 0, 0, ps, ps, ps));
    for (let i = 0; i < 7; i++)
      bake('gold', coinGeo, composeM(px + rand(-1.6, 1.6), 0.03, pz + rand(-1.6, 1.6), 0, rand(Math.PI)));
    addCollider(px, pz, 1.4 * ps, 1.4 * ps);
  }

  // merge all static geometry — one draw call per material
  const matFor = { wall: mats.wall, floor: mats.floor, dark: mats.stoneDk,
    stone: mats.stone, wood: mats.wood, gold: mats.gold };
  for (const k of Object.keys(buckets)) {
    if (!buckets[k].length) continue;
    group.add(new THREE.Mesh(BufferGeometryUtils.mergeGeometries(buckets[k]), matFor[k]));
  }

  // -- floating dust motes everywhere --
  const moteCount = 230;
  const motePos = new Float32Array(moteCount * 3);
  const moteBase = new Float32Array(moteCount * 3);
  const motePhase = new Float32Array(moteCount);
  const roomRects = [
    [-7, 7, -9, 9], [-2, 2, 9, 25], [-7, 7, 25, 45], [-6, 6, 45, 59], [-7, 7, 59, 73], [-7, 7, 76, 92],
  ];
  for (let i = 0; i < moteCount; i++) {
    const r = roomRects[i % roomRects.length];
    moteBase[i * 3] = rand(r[0], r[1]);
    moteBase[i * 3 + 1] = rand(0.4, 4.2);
    moteBase[i * 3 + 2] = rand(r[2], r[3]);
    motePhase[i] = rand(20);
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
  const motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({
    color: 0x88aadd, size: 0.05, transparent: true, opacity: 0.55,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  motes.frustumCulled = false;
  group.add(motes);

  // ---------- runtime API ----------
  const level = {
    group, mats, colliders, addCollider,
    hallTorches, hallLight,
    inPit(p) {
      return p.z > L.chasm.pit.z[0] && p.z < L.chasm.pit.z[1] && Math.abs(p.x) < 7
        && Math.abs(p.x) > L.chasm.bridgeHalfW;
    },
    igniteTorch(i) {
      const t = hallTorches[i];
      if (t && !t.lit) { t.lit = true; t.igniteT = 0.001; }
    },
    closeEntrance() { entrance.closing = true; },
    slamAmbushDoor() {
      slab.visible = true;
      ambushDoor.state = 'slamming'; ambushDoor.t = 0;
      ambushDoor.collider.off = false;
    },
    openAmbushDoor() {
      ambushDoor.state = 'opening'; ambushDoor.t = 0;
      ambushDoor.collider.off = true;
    },
    openHatch(i) {
      if (!hatches[i].opening) { hatches[i].opening = true; hatches[i].t = 0; }
    },

    update(dt, t) {
      for (const tor of torches) {
        if (!tor.lit) continue;
        if (tor.igniteT < 1) tor.igniteT = Math.min(1, tor.igniteT + dt * 2.4);
        const k = tor.igniteT;
        const fl = k * (1 + 0.13 * Math.sin(t * 21 + tor.seed) + 0.07 * Math.sin(t * 47 + tor.seed * 2));
        tor.flame.scale.set(fl, fl * (1 + 0.1 * Math.sin(t * 13 + tor.seed)), fl);
        tor.flame.rotation.z = 0.06 * Math.sin(t * 9 + tor.seed);
        tor.glow.scale.setScalar(1.5 * fl);
      }
      for (const l of lights) {
        l.pl.intensity = l.base * (0.88 + 0.09 * Math.sin(t * 11 + l.seed) + 0.05 * Math.sin(t * 27 + l.seed * 1.7));
      }
      for (const f of fogPlanes) {
        f.mesh.position.x = Math.sin(t * f.speed + f.seed) * 2.6;
        f.mesh.rotation.z = t * f.speed * 0.18 + f.seed;
      }
      runeRing.rotation.y = t * 0.18;
      // entrance door slam
      if (entrance.closing) {
        let done = true;
        for (const p of entrance.panels) {
          p.pivot.rotation.y *= Math.pow(0.0001, dt); // exponential ease to 0
          if (Math.abs(p.pivot.rotation.y) > 0.015) done = false;
          else p.pivot.rotation.y = 0;
        }
        if (done) { entrance.closing = false; entrance.collider.off = false; }
      }
      // ambush slab
      if (ambushDoor.state === 'slamming') {
        ambushDoor.t += dt * 3.4;
        slab.position.y = 7.5 - Math.min(1, ambushDoor.t) * 5.4;
        if (ambushDoor.t >= 1) { slab.position.y = 2.1; ambushDoor.state = 'closed'; }
      } else if (ambushDoor.state === 'opening') {
        ambushDoor.t += dt * 0.9;
        slab.position.y = 2.1 + ambushDoor.t * 5.4;
        if (ambushDoor.t >= 1) { ambushDoor.state = 'open'; slab.visible = false; }
      }
      // hatches flip open
      for (const h of hatches) {
        if (h.opening && h.t < 1) {
          h.t = Math.min(1, h.t + dt * 4);
          h.pivot.rotation.x = -2.1 * h.t * (2 - h.t); // ease-out flip
        }
      }
      // dust motes drift
      for (let i = 0; i < moteCount; i++) {
        const i3 = i * 3, ph = motePhase[i];
        motePos[i3] = moteBase[i3] + Math.sin(t * 0.25 + ph) * 0.5;
        motePos[i3 + 1] = moteBase[i3 + 1] + Math.sin(t * 0.4 + ph * 2) * 0.3;
        motePos[i3 + 2] = moteBase[i3 + 2] + Math.cos(t * 0.2 + ph) * 0.5;
      }
      moteGeo.attributes.position.needsUpdate = true;
    },

    // intro convenience: how done is the slam (for the thud moment)
    entranceClosed: () => !entrance.closing && !entrance.collider.off,
  };
  return level;
}
