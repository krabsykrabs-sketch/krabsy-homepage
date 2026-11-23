// Thief crabs: wander in their zone; when the player carries eggs nearby they
// chase. A catch opens a question card (main.js): right = bonked and dizzy,
// wrong = the crab takes the top egg and runs home with it.
import * as THREE from 'three';
import { THIEF, ZONES } from './balance.js';
import { height, makeEggMesh, onPier, WATER_Y } from './world.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { paint, paintMat } from './merge.js';

// A crab is 7 meshes (it was 26): the body, two claws, three leg pairs and the dizzy
// stars. All crabs share the same painted geometry (vertex colours, see merge.js).
const RED = 0xff6b4a, DARK = 0xd94a30, BLACK = 0x1a1a2e, WHITE = 0xffffff, MASK = 0x22223a;
const sph = new THREE.SphereGeometry(1, 16, 12), cylG = new THREE.CylinderGeometry(1, 1, 1, 8);
const part = (g, hex, x, y, z, sx, sy = sx, sz = sx, rz = 0) => { const p = paint(g, hex).scale(sx, sy, sz); if (rz) p.rotateZ(rz); return p.translate(x, y, z); };
let GEO = null;
function crabGeo() {
  if (GEO) return GEO;
  const body = [part(sph, RED, 0, 0.75, 0, 0.85, 0.5, 0.65), part(sph, DARK, 0, 0.62, 0, 0.8, 0.32, 0.6),
    part(cylG, MASK, 0, 1.2, 0.18, 0.5, 0.12, 0.5),                                       // robber mask across the eyes
    paint(new THREE.TorusGeometry(0.12, 0.03, 6, 12, Math.PI), BLACK).rotateZ(Math.PI).translate(0, 0.85, 0.63)]; // smile
  const arms = {}, legs = [];
  for (const s of [-1, 1]) {
    body.push(part(cylG, DARK, s * 0.22, 1.05, 0.3, 0.05, 0.4, 0.05), part(sph, WHITE, s * 0.22, 1.3, 0.32, 0.15),
      part(sph, BLACK, s * 0.22, 1.3, 0.45, 0.07), part(sph, MASK, s * 0.22, 1.3, 0.28, 0.17, 0.08, 0.17)); // eyes, mask band
    arms[s] = mergeGeometries([part(sph, RED, 0, 0, 0, 0.14), part(sph, RED, s * 0.18, 0.18, 0.25, 0.3, 0.2, 0.25), part(sph, DARK, s * 0.18, 0.38, 0.32, 0.22, 0.09, 0.2)]);
  }
  // a left and a right leg swing together, so each pair is one mesh
  for (let i = 0; i < 3; i++) legs.push(mergeGeometries([-1, 1].map((s) => part(cylG, DARK, s * (0.75 + i * 0.05), 0, 0, 0.06, 0.7, 0.06, s * 0.7))));
  const stars = mergeGeometries([0, 1, 2].map((i) => new THREE.OctahedronGeometry(0.1).translate(Math.cos(i * 2.1) * 0.45, 0, Math.sin(i * 2.1) * 0.45)));
  return (GEO = { body: mergeGeometries(body), arms, legs, stars, starMat: new THREE.MeshStandardMaterial({ color: 0xffcf5e, roughness: 0.6, emissive: 0xffcf5e, emissiveIntensity: 0.6 }) });
}

export function buildCrab() {
  const G = crabGeo(), mat = paintMat();
  const mk = (geo, m = mat) => { const o = new THREE.Mesh(geo, m); o.castShadow = true; return o; };
  const g = new THREE.Group(), body = new THREE.Group();
  g.add(body);
  body.add(mk(G.body));
  for (const s of [-1, 1]) { const arm = mk(G.arms[s]); arm.position.set(s * 0.8, 0.85, 0.35); arm.userData.side = s; body.add(arm); } // claws
  G.legs.forEach((geo, i) => { const leg = mk(geo); leg.position.set(0, 0.35, -0.25 + i * 0.25); leg.userData.leg = i; body.add(leg); });
  // dizzy stars
  const stars = mk(G.stars, G.starMat); stars.position.y = 1.75; stars.visible = false;
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
        // start on dry ground (the Beach circle is partly sea)
        let x = z.x, zz = z.z;
        for (let k = 0; k < 40; k++) {
          const a = Math.random() * Math.PI * 2, d = Math.random() * z.r * 0.6;
          x = z.x + Math.cos(a) * d; zz = z.z + Math.sin(a) * d;
          if (height(x, zz) > 0.3) break;
        }
        const t = { obj, zone: z, x, z: zz, dir: Math.random() * 6.28,
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
      // face where it walks, turning smoothly (never snap or spin on the spot)
      const target = t.move ?? t.dir;
      if (t.face === undefined) t.face = target;
      let df = target - t.face; df = Math.atan2(Math.sin(df), Math.cos(df));
      if (!paused) t.face += df * Math.min(1, dt * 8);
      t.obj.rotation.y = t.face;
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

  // Is one step from the crab's spot to (nx, nz) allowed?
  _free(t, nx, nz) {
    // crabs paddle through the shallows but not into deep water, and they don't hop
    // on or off the pier from the side
    const h = height(nx, nz);
    if (h < WATER_Y - 0.22 || (onPier(nx, nz) !== onPier(t.x, t.z) && Math.abs(h - height(t.x, t.z)) > 0.45)) return false;
    // crabs walk around trees, not through them (a step that leads away from a tree is
    // always fine: a crab that starts right beside a trunk must not be stuck there)
    for (const c of this.world.nearColliders(nx, nz)) {
      const d = Math.hypot(nx - c.x, nz - c.z);
      if (d < c.r + 0.5 && d < Math.hypot(t.x - c.x, t.z - c.z)) return false;
    }
    return true;
  }
  // One step towards (dx, dz). If the way is blocked, the crab steers around the obstacle
  // (tries directions further and further to the side, on the side it tried last) instead of
  // turning on the spot. Returns true if it moved. t.move = the direction it actually walked.
  _step(t, dx, dz, len) {
    const want = Math.atan2(dx, dz);
    const side = t.side || (Math.random() < 0.5 ? 1 : -1);
    for (const off of [0, 0.5, -0.5, 1.0, -1.0, 1.6, -1.6, 2.3, -2.3]) {
      const a = want + off * side;
      const nx = t.x + Math.sin(a) * len, nz = t.z + Math.cos(a) * len;
      if (!this._free(t, nx, nz)) continue;
      t.x = nx; t.z = nz; t.move = a;
      t.side = off === 0 ? t.side : Math.sign(off) * side; // keep going round the same way
      if (off === 0) t.side = 0;
      return true;
    }
    // boxed in: a wandering crab picks a new direction (once), a chasing one waits
    t.blocked = (t.blocked || 0) + 1;
    if (t.state === 'wander') t.dir = want + Math.PI * (0.7 + Math.random() * 0.6);
    return false;
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
