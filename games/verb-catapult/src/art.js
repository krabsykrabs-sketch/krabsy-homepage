// Everything the player sees of the castle world: KayKit models fitted onto the physics
// bodies (src/physics.js), the catapult with its swinging arm, animated skeletons and the
// meadow around them. Needs Assets.load() first.
import * as THREE from 'three';
import { Assets } from './assets.js';
import { Char } from './chars.js';
import { STONES, SKEL } from './physics.js';

const shade = (m) => { m.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return m; };
const lambert = (c) => new THREE.MeshLambertMaterial({ color: c });

// A copy of the atlas material, so one block can darken (cracks) or one stone can be tinted.
function atlas(color = 0xffffff) {
  const m = Assets.material.clone(); m.color.setHex(color); return m;
}

// ---------------------------------------------------------------- stones
const STONE_TINT = { pebble: 0xb9b3a7, normal: 0x9d978b, big: 0x7f7a70, split: 0x7fa7d6 };
export function stoneMesh(type) {
  const r = STONES[type].r, d = r * 2;
  let m;
  if (type === 'bomb') {
    m = Assets.fit('barrel', d, d * 1.15, d, { rotX: Math.PI / 2 });
    const fuse = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffcf5e }));
    fuse.position.set(0, 0, d * 0.6); fuse.name = 'fuse'; m.add(fuse);
  } else if (type === 'cannon') m = Assets.fit('projectile_cannonball', d, d, d);
  else { // a faceted rock (the pack's catapult projectile is a spiked ball)
    const g = new THREE.IcosahedronGeometry(r, type === 'pebble' ? 0 : 1);
    const p = g.attributes.position, v = new THREE.Vector3(), seed = type.length;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const k = 0.88 + 0.12 * Math.sin(v.x * 9 + seed) * Math.cos(v.y * 7 + v.z * 5);
      p.setXYZ(i, v.x * k, v.y * k * 0.92, v.z * k);
    }
    g.computeVertexNormals();
    m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: STONE_TINT[type], flatShading: true }));
  }
  return shade(m);
}

// ---------------------------------------------------------------- blocks
// Crates for chunky wood, long crates for planks and pillars, hay bales, cut stone.
let crateFlip = 0;
export function blockMesh(u) {
  const depth = Math.max(0.9, Math.min(1.3, Math.min(u.w, u.h) * 1.05));
  const mat = u.mat === 'stone' ? lambert(0xa3a7ad) : atlas();
  let g;
  if (u.mat === 'hay') g = Assets.fit('haybale', u.w, u.h, depth, { material: mat });
  else if (u.mat === 'stone') {
    g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.BoxGeometry(u.w, u.h, depth), mat));
    const edge = lambert(0x7d828a), k = 0.05;
    const top = new THREE.Mesh(new THREE.BoxGeometry(u.w * 1.01, k, depth * 1.01), edge); top.position.y = u.h / 2 - k / 2; g.add(top);
  } else if (Math.min(u.w, u.h) >= 0.6) {
    g = Assets.fit('crate_A_big', u.w, u.h, depth, { material: mat, rotY: (crateFlip++ % 2) * Math.PI / 2 });
  } else { // planks and pillars: a bundle of logs
    const upright = u.h > u.w;
    g = Assets.fit('resource_lumber', u.w, u.h, 0.7, { rotZ: upright ? Math.PI / 2 : 0, material: mat });
  }
  shade(g);
  g.userData.base = mat.color.clone();
  g.userData.mat = mat;
  return g;
}

// ---------------------------------------------------------------- skeletons
// The body is a box (SKEL.w × SKEL.h); the model stands in it, turned towards the
// catapult and a little towards the camera. On `die()` it leaves the body and plays its
// fall; the caller removes it when `dead` is set.
export class Skeleton {
  constructor(kind = 'Skeleton_Minion') {
    this.char = new Char(Assets.chars[kind], Assets.clips);
    this.group = new THREE.Group();
    const s = (SKEL.h * 1.4) / Assets.skelHeight; // a bit bigger than the body box (reads better; feet stay put)
    this.char.root.scale.setScalar(s);
    this.char.root.position.y = -SKEL.h / 2;
    this.char.root.rotation.y = -1.0;
    this.group.add(this.char.root);
    this.char.mixer.setTime(Math.random() * 2);
    this.state = 'spawn';
    this.char.play('Spawn_Ground', { once: true, fade: 0 });
    this.t = this.char.dur('Spawn_Ground') * 0.8;
    this.char.mixer.update(0.001);
    this.hurtT = 0; this.dead = false;
  }
  hurt() {
    if (this.state === 'dying') return;
    this.hurtT = 0.3;
    this.char.current = null; this.char.play('Hit_A', { once: true, fade: 0.05 });
    this.state = 'hit'; this.t = this.char.dur('Hit_A') * 0.85;
  }
  // (vx, vy): the body's velocity. A skeleton knocked off something keeps flying and lands
  // on the ground; one that went down where it stood stays there.
  die(vx = 0, vy = 0) {
    this.state = 'dying';
    this.char.current = null; this.char.play('Death_A', { once: true, fade: 0.08, speed: 1.3 });
    this.t = 1.0;
    this.fall = Math.hypot(vx, vy) > 1.2 || this.group.position.y > SKEL.h ? { vx: vx * 0.6, vy } : null;
    if (this.fall && Math.hypot(vx, vy) < 1.2) this.fall.vy = Math.min(vy, 0); // the floor went away
  }
  update(dt) {
    this.char.mixer.update(dt);
    if (this.fall) {
      const g = this.group, f = this.fall;
      f.vy -= 14 * dt; g.position.x += f.vx * dt; g.position.y += f.vy * dt;
      g.rotation.z *= Math.max(0, 1 - dt * 6);
      if (g.position.y <= SKEL.h / 2) { g.position.y = SKEL.h / 2; this.fall = null; this.t = Math.max(this.t, 0.35); }
      else if (this.t < 0.2) this.t = 0.2; // burst into bones only after landing
    }
    if (this.hurtT > 0) {
      this.hurtT -= dt;
      for (const m of this.char.materials) m.color.setHex(this.hurtT > 0 ? 0xff9a9a : 0xffffff);
    }
    if (this.t > 0) {
      this.t -= dt;
      if (this.t <= 0) {
        if (this.state === 'dying') this.dead = true;
        else { this.state = 'idle'; this.char.play('Idle_A', { fade: 0.25 }); }
      }
    }
  }
  dispose() { this.char.dispose(); if (this.group.parent) this.group.parent.remove(this.group); }
}

// ---------------------------------------------------------------- catapult
// KayKit catapult, turned to shoot to the right. Its arm rests pointing back; firing
// swings it up and over. The stone leaves the cup at RELEASE (the physics launch point).
const SCALE = 3.2, RELEASE = 1.45, STOP = 1.9;
export class Catapult {
  constructor(scene, x = -1.2) {
    this.root = Assets.clone('catapult');
    this.arm = this.root.getObjectByName('catapult_arm');
    this.root.rotation.y = Math.PI / 2;
    this.root.scale.setScalar(SCALE);
    this.root.position.set(x, 0, 0); // the wheels' bottom is the model's origin height
    shade(this.root);
    this.cup = new THREE.Object3D(); this.cup.position.set(0, 0.07, -0.56); this.arm.add(this.cup);
    scene.add(this.root);
    this.a = 0; this.v = 0; this.phase = 'rest';
    this.launch = this.cupAt(RELEASE);
    this.cupAt(0);
  }
  // Cup position in world space with the arm at angle a.
  cupAt(a) {
    this.arm.rotation.x = a;
    this.root.updateMatrixWorld(true);
    const p = this.cup.getWorldPosition(new THREE.Vector3());
    return { x: p.x, y: p.y };
  }
  cupWorld() { return this.cupAt(this.a); }
  throw() { this.phase = 'throw'; }
  get released() { return this.phase !== 'throw' || this.a >= RELEASE; }
  // `cock` 0..1 while aiming (the pull's power).
  update(dt, cock = 0) {
    if (this.phase === 'throw') {
      this.a = Math.min(STOP, this.a + dt * 16);
      if (this.a >= STOP) this.phase = 'back';
    } else if (this.phase === 'back') {
      this.a = Math.max(0, this.a - dt * 1.6);
      if (this.a === 0) this.phase = 'rest';
    } else {
      // winds back with the pull and trembles a little under the strain
      this.a = cock > 0 ? -0.32 * cock + Math.sin(performance.now() / 30) * 0.015 * cock : 0;
    }
    this.arm.rotation.x = this.a;
  }
}

// ---------------------------------------------------------------- the meadow
export function buildWorld(scene) {
  const S = 6; // hex-tile units → metres for scenery
  const put = (name, x, z, s = S, ry = 0, y = 0) => {
    const m = shade(Assets.clone(name)); m.scale.setScalar(s); m.position.set(x, y, z); m.rotation.y = ry; scene.add(m); return m;
  };
  // back row: hills with trees, single trees, rocks
  put('hills_A_trees', -14, -22, 9, 0.4);
  put('hills_A_trees', 46, -30, 11, 2.1);
  put('hill_single_A', 14, -26, 12, 0.2);
  for (const [n, x, z, s, r] of [['trees_A_medium', -4, -12, 4.5, 0.3], ['trees_B_small', 8, -14, 5, 1.2],
    ['tree_single_A', 31, -10, 4.2, 0.5], ['tree_single_B', 35, -14, 4.6, 2], ['trees_A_medium', 24, -30, 5, 2.6],
    ['tree_single_B', -9, -6, 4, 0], ['tree_single_A', 11, -10, 3.6, 1]]) put(n, x, z, s, r);
  for (const [n, x, z, s, r] of [['rock_single_C', 4, -4, 3, 0.4], ['rock_single_A', 27, -3, 4, 1], ['rock_single_C', 9, 3.4, 2, 2]]) put(n, x, z, s, r);
  // the catapult camp
  put('tent', -8.6, -4.2, 5, 0.6);
  put('flag_red', -6, -2.2, 5, -0.6);
  put('cannonball_pallet', -8.2, 1.4, 3, 0.2);
  put('wheelbarrow', -9.6, 0.4, 4, 1.1);
  put('fence_wood_straight', -11.5, -1.8, 2.4, 0.3);
  // clouds
  const clouds = [];
  for (const [n, x, y, z, s] of [['cloud_big', -6, 14, -30, 2.6], ['cloud_small', 12, 17, -38, 2.8], ['cloud_big', 30, 13, -32, 2.4], ['cloud_small', 46, 16, -40, 3]]) {
    const c = put(n, x, z, s, 0, y); c.traverse((o) => { if (o.isMesh) o.castShadow = false; }); clouds.push(c);
  }
  return {
    update(dt) { for (const [i, c] of clouds.entries()) { c.position.x += dt * (0.15 + i * 0.04); if (c.position.x > 60) c.position.x = -20; } },
  };
}

// The bucket the stones lie in.
export function basketMesh() {
  const b = Assets.fit('bucket_empty', 1.15, 0.85, 1.15);
  return shade(b);
}
