// Thief crabs: wander in their zone; when the player carries eggs nearby they
// chase. A catch opens a question card (main.js): right = bonked and dizzy,
// wrong = the crab takes the top egg and runs home with it.
import * as THREE from 'three';
import { THIEF, ZONES } from './balance.js';
import { height, makeEggMesh } from './world.js';

const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, ...o });
const RED = M(0xff6b4a), DARK = M(0xd94a30), BLACK = M(0x1a1a2e), WHITE = M(0xffffff), MASK = M(0x22223a);
const sph = new THREE.SphereGeometry(1, 16, 12), cylG = new THREE.CylinderGeometry(1, 1, 1, 8);
function mesh(g, m, x, y, z, sx, sy = sx, sz = sx) {
  const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.castShadow = true; return o;
}

export function buildCrab() {
  const g = new THREE.Group(), body = new THREE.Group();
  g.add(body);
  body.add(mesh(sph, RED, 0, 0.75, 0, 0.85, 0.5, 0.65));
  body.add(mesh(sph, DARK, 0, 0.62, 0, 0.8, 0.32, 0.6));
  // robber mask across the eyes
  body.add(mesh(cylG, MASK, 0, 1.2, 0.18, 0.5, 0.12, 0.5));
  for (const s of [-1, 1]) {
    body.add(mesh(cylG, DARK, s * 0.22, 1.05, 0.3, 0.05, 0.4, 0.05));
    body.add(mesh(sph, WHITE, s * 0.22, 1.3, 0.32, 0.15));
    body.add(mesh(sph, BLACK, s * 0.22, 1.3, 0.45, 0.07));
    // mask band behind the eyes
    body.add(mesh(sph, MASK, s * 0.22, 1.3, 0.28, 0.17, 0.08, 0.17));
    // claws
    const arm = new THREE.Group(); arm.position.set(s * 0.8, 0.85, 0.35);
    arm.add(mesh(sph, RED, 0, 0, 0, 0.14));
    arm.add(mesh(sph, RED, s * 0.18, 0.18, 0.25, 0.3, 0.2, 0.25));
    const pin = mesh(sph, DARK, s * 0.18, 0.38, 0.32, 0.22, 0.09, 0.2); arm.add(pin);
    arm.userData.side = s;
    body.add(arm);
    // legs
    for (let i = 0; i < 3; i++) {
      const leg = mesh(cylG, DARK, s * (0.75 + i * 0.05), 0.35, -0.25 + i * 0.25, 0.06, 0.7, 0.06);
      leg.rotation.z = s * 0.7; leg.userData.leg = i; body.add(leg);
    }
  }
  // smile
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.03, 6, 12, Math.PI), BLACK);
  smile.position.set(0, 0.85, 0.63); smile.rotation.z = Math.PI; body.add(smile);
  // dizzy stars
  const stars = new THREE.Group(); stars.position.y = 1.75; stars.visible = false;
  for (let i = 0; i < 3; i++) {
    const s = mesh(new THREE.OctahedronGeometry(1), M(0xffcf5e, { emissive: 0xffcf5e, emissiveIntensity: 0.6 }), Math.cos(i * 2.1) * 0.45, 0, Math.sin(i * 2.1) * 0.45, 0.1);
    stars.add(s);
  }
  g.add(stars);
  g.userData = { body, stars };
  g.scale.setScalar(0.9);
  return g;
}

export class Thieves {
  constructor(world) {
    this.world = world;
    this.list = [];
    for (const z of ZONES) {
      for (let i = 0; i < z.thieves; i++) {
        const obj = buildCrab();
        world.scene.add(obj);
        const a = Math.random() * Math.PI * 2, d = Math.random() * z.r * 0.6;
        const t = { obj, zone: z, x: z.x + Math.cos(a) * d, z: z.z + Math.sin(a) * d, dir: Math.random() * 6.28,
          state: 'wander', timer: 0, carry: null, phase: Math.random() * 10 };
        this.list.push(t);
      }
    }
  }

  // player: { x, z, carrying }, open(zone) → is the zone open. Returns a thief that catches, or null.
  update(dt, player, isOpen, paused) {
    let caught = null;
    for (const t of this.list) {
      const z = t.zone;
      if (!paused) {
        t.timer -= dt;
        const dp = Math.hypot(player.x - t.x, player.z - t.z);
        const dz = Math.hypot(t.x - z.x, t.z - z.z);
        if (t.state === 'dizzy' && t.timer <= 0) t.state = 'wander';
        if (t.state === 'flee' && t.timer <= 0) { t.state = 'wander'; t.carry && this._dropCarry(t); }
        if (t.state === 'wander') {
          if (player.carrying && isOpen(z) && dp < THIEF.see && t.timer <= 0 && dz < z.r + THIEF.leash) t.state = 'chase';
          else {
            if (Math.random() < dt * 0.4) t.dir += (Math.random() - 0.5) * 2;
            if (dz > z.r * 0.8) t.dir = Math.atan2(z.x - t.x, z.z - t.z);
            this._step(t, Math.sin(t.dir), Math.cos(t.dir), 2.2 * dt);
          }
        } else if (t.state === 'chase') {
          if (!player.carrying || dz > z.r + THIEF.leash || dp > THIEF.see * 1.6) { t.state = 'wander'; t.timer = 1.5; }
          else {
            const dx = (player.x - t.x) / dp, dzz = (player.z - t.z) / dp;
            t.dir = Math.atan2(dx, dzz);
            this._step(t, dx, dzz, THIEF.speed * dt);
            if (dp < 1.4) caught = caught || t;
          }
        } else if (t.state === 'flee') {
          // runs back to the zone centre with the egg
          const dx = z.x - t.x, dzz = z.z - t.z, L = Math.hypot(dx, dzz) || 1;
          t.dir = Math.atan2(dx, dzz);
          if (L > 2) this._step(t, dx / L, dzz / L, THIEF.speed * 1.1 * dt);
          else { t.timer = Math.min(t.timer, 0.5); }
        }
      }
      // pose
      const y = height(t.x, t.z);
      t.obj.position.set(t.x, y, t.z);
      t.obj.rotation.y = t.dir;
      const time = this.world.time + t.phase;
      const moving = !paused && t.state !== 'dizzy';
      const { body, stars } = t.obj.userData;
      body.position.y = moving ? Math.abs(Math.sin(time * 12)) * 0.08 : 0;
      body.rotation.z = t.state === 'dizzy' ? Math.sin(time * 4) * 0.2 : 0;
      for (const c of body.children) {
        if (c.userData.leg !== undefined) c.rotation.x = moving ? Math.sin(time * 14 + c.userData.leg * 2) * 0.4 : 0;
        if (c.userData.side) c.rotation.x = t.state === 'chase' ? -0.6 + Math.sin(time * 10) * 0.4 : Math.sin(time * 2) * 0.15;
      }
      stars.visible = t.state === 'dizzy';
      stars.rotation.y = time * 4;
    }
    return caught;
  }

  _step(t, dx, dz, len) {
    const nx = t.x + dx * len, nz = t.z + dz * len;
    if (height(nx, nz) < 0) { t.dir += Math.PI * 0.6; return; }
    // crabs walk around trees, not through them
    for (const c of this.world.nearColliders(nx, nz)) if (Math.hypot(nx - c.x, nz - c.z) < c.r + 0.5) { t.dir += 0.8; return; }
    t.x = nx; t.z = nz;
  }

  bonk(t) {
    t.state = 'dizzy'; t.timer = THIEF.dizzy;
  }
  steal(t, rarity) {
    t.state = 'flee'; t.timer = 8;
    const egg = makeEggMesh(rarity, 1.1);
    egg.position.set(0, 1.45, 0);
    t.obj.add(egg); t.carry = egg;
  }
  _dropCarry(t) { t.obj.remove(t.carry); t.carry = null; t.timer = THIEF.cooldown; }
  // short grace period for every thief after a catch
  graceAll() { for (const t of this.list) if (t.state === 'chase') { t.state = 'wander'; t.timer = THIEF.cooldown; } }
}
