// Crab raids on the base (owner idea): while the player is far from home and an egg
// lies in an incubator, now and then a crab sneaks into the hatchery to steal it.
// It walks slowly to the incubator (the player can hurry home and catch it: a
// question card, main.js), grabs the egg, then runs off with it towards the sea;
// caught on the way, it drops the egg. Escaped = the egg is gone.
import { RAID } from './balance.js';
import { HOME } from './balance.js';
import { height, INC_POS } from './world.js';
import { buildCrab } from './thieves.js';
import { makeEggMesh } from './world.js';

export class Raids {
  constructor(world) {
    this.world = world;
    this.timer = RAID.first;
    this.r = null; // the raider: { obj, x, z, state: 'sneak'|'grab'|'flee'|'dizzy', inc, rarity, zone, t, carry }
  }
  get active() { return !!this.r; }
  // ctx: { st, px, pz, indoor, tutorial, paused }; returns an event or null:
  // 'start' | 'caught' (player reached it before it got away) | 'stolen' (it took the egg) | 'escaped'
  update(dt, ctx) {
    if (ctx.paused) return null;
    const { st } = ctx;
    if (!this.r) {
      const far = !ctx.indoor && Math.hypot(ctx.px - HOME.x, ctx.pz - HOME.z) > RAID.homeDist;
      if (st.goals.stars < RAID.minStars || ctx.tutorial || !far) return null;
      this.timer -= dt;
      if (this.timer > 0) return null;
      const incs = st.incubators.map((x, i) => (x && !x.sp ? i : -1)).filter((i) => i >= 0);
      if (!incs.length) { this.timer = 20; return null; }
      this._start(incs[Math.floor(Math.random() * incs.length)], st);
      return 'start';
    }
    const r = this.r, p = INC_POS[r.inc];
    r.t += dt;
    const dp = Math.hypot(ctx.px - r.x, ctx.pz - r.z);
    if (r.state === 'sneak') {
      const dx = p.x - r.x, dz = (p.z - 1.3) - r.z, L = Math.hypot(dx, dz);
      if (L < 0.3) { r.state = 'grab'; r.t = 0; }
      else { const s = Math.min(L, RAID.speed * dt); r.x += dx / L * s; r.z += dz / L * s; r.dir = Math.atan2(dx, dz); }
      if (dp < 1.8) return 'caught';
    } else if (r.state === 'grab') {
      if (dp < 1.8) return 'caught';
      if (r.t > RAID.grabTime) return 'stolen';
    } else if (r.state === 'flee') {
      // away from home, towards the sea in the south
      const ax = r.x - HOME.x, az = r.z - HOME.z + 30, L = Math.hypot(ax, az) || 1;
      r.x += ax / L * RAID.fleeSpeed * dt; r.z += az / L * RAID.fleeSpeed * dt; r.dir = Math.atan2(ax, az);
      if (dp < 1.8 && r.t > 1.5) return 'recovered'; // (a head start after it grabbed the egg)
      if (r.t > RAID.fleeTime) return 'escaped';
    } else if (r.state === 'dizzy') {
      r.obj.position.y += dt * 2; r.obj.rotation.y += dt * 12; // spins away into the air
      if (r.t > 1.2) { this.end(); return null; }
    }
    this._pose(dt);
    return null;
  }
  _start(inc, st) {
    const obj = buildCrab(), a = (Math.random() < 0.5 ? -1 : 1) * (0.6 + Math.random() * 0.5);
    const x = HOME.x + Math.sin(a) * 26, z = HOME.z + Math.cos(a) * 26; // from the edge of the base
    this.world.scene.add(obj);
    this.r = { obj, x, z, dir: 0, state: 'sneak', inc, rarity: st.incubators[inc].rarity, zone: st.incubators[inc].zone, t: 0, carry: null };
    this.r.obj.userData.alert.visible = true;
  }
  // the crab got the egg: it runs off with it (main removes the egg from the incubator)
  takeEgg() {
    const r = this.r; if (!r) return;
    r.state = 'flee'; r.t = 0;
    const egg = makeEggMesh(r.rarity, 1.1); egg.position.set(0, 1.45, 0); r.obj.add(egg); r.carry = egg;
  }
  // a right answer or a catch: the crab spins away into the air and is gone
  bonk() { if (!this.r) return; this.r.state = 'dizzy'; this.r.t = 0; if (this.r.carry) { this.r.obj.remove(this.r.carry); this.r.carry = null; } }
  end() {
    if (!this.r) return;
    this.world.scene.remove(this.r.obj);
    this.r = null;
    this.timer = RAID.gap[0] + Math.random() * (RAID.gap[1] - RAID.gap[0]);
  }
  _pose() {
    const r = this.r, o = r.obj, t = this.world.time;
    if (r.state !== 'dizzy') { o.position.set(r.x, height(r.x, r.z), r.z); o.rotation.y = r.dir; }
    const { body, alert } = o.userData;
    body.position.y = Math.abs(Math.sin(t * (r.state === 'flee' ? 14 : 7))) * 0.08;
    alert.position.y = 2.6 + Math.abs(Math.sin(t * 6)) * 0.2;
    if (r.state === 'grab') body.rotation.x = Math.sin(t * 16) * 0.15; else body.rotation.x = 0;
    for (const c of body.children) if (c.userData.leg !== undefined) c.rotation.x = Math.sin(t * 14 + c.userData.leg * 2) * 0.4;
  }
  // for the banner: seconds until it grabs / gets away, where it is
  info() {
    const r = this.r; if (!r) return null;
    const sneakLeft = Math.hypot(INC_POS[r.inc].x - r.x, (INC_POS[r.inc].z - 1.3) - r.z) / RAID.speed + RAID.grabTime;
    const left = r.state === 'sneak' ? sneakLeft : r.state === 'grab' ? RAID.grabTime - r.t : r.state === 'flee' ? RAID.fleeTime - r.t : 0;
    return { x: r.x, z: r.z, state: r.state, left: Math.max(0, left) };
  }
}
