// The castle simulation: planck.js (Box2D) in one plane, x to the right, y up, metres.
// No Three.js here, so the same code runs headless in node (tools/sim.cjs) for tuning.
// The ground's top is y = 0. The catapult's cup is at LAUNCH.
//
// Bodies carry userData { kind: 'block' | 'skel' | 'stone' | 'ground', ... }.
// Damage: every contact's impulse (post-solve) above a material's threshold takes hp.
// A skeleton is also down when it tips over (> TIP rad) or falls off the world.

export const LAUNCH = { x: 0, y: 1.9 };
export const MAX_PULL = 2.6;      // metres of drag at full power
export const MAX_SPEED = 19;      // m/s at full power
export const STEP = 1 / 60;
const TIP = 1.05;                 // rad: a skeleton leaning this far falls apart
const GRACE = 1.0;                // s after building: no damage (settling contacts)

export const MATERIALS = {
  wood:  { density: 0.7, friction: 0.7, restitution: 0.05, hp: 9,  min: 1.2, points: 100 },
  stone: { density: 2.2, friction: 0.8, restitution: 0.0,  hp: 40, min: 4,   points: 250 },
  hay:   { density: 0.35, friction: 0.9, restitution: 0.0, hp: 5,  min: 0.8, points: 50 },
};
// The skeleton: a box with its feet at the bottom.
export const SKEL = { w: 0.55, h: 0.95, density: 0.6, hp: 2.2, min: 0.5, points: 1000 };

// Stone types. `r` radius, `density`, `speed` factor, extras per type.
export const STONES = {
  pebble: { r: 0.2,  density: 3.0, speed: 1.0 },
  normal: { r: 0.36, density: 4.0, speed: 1.0 },
  big:    { r: 0.55, density: 6.0, speed: 0.92 },
  split:  { r: 0.3,  density: 4.0, speed: 1.0, split: true },
  bomb:   { r: 0.42, density: 3.0, speed: 0.95, bomb: true },
  cannon: { r: 0.3,  density: 9.0, speed: 1.3, gravity: 0.55, pierce: true },
};
export const SPECIAL_OF_LEVEL = { 1: 'big', 2: 'split', 3: 'bomb', 4: 'cannon', 5: 'big', 6: 'bomb' };

export class Sim {
  constructor(planck) {
    this.pl = planck;
    this.V = (x, y) => planck.Vec2(x, y);
    this.world = new planck.World({ gravity: this.V(0, -10) });
    this.t = 0;
    this.events = [];            // { type, ... } read and cleared by the game each frame
    this.dead = new Set();       // bodies to remove after the step
    this.stones = [];
    const ground = this.world.createBody();
    ground.createFixture(planck.Edge(this.V(-40, 0), this.V(80, 0)), { friction: 0.9 });
    ground.setUserData({ kind: 'ground' });
    this.ground = ground;

    this.world.on('pre-solve', (c) => this._preSolve(c));
    this.world.on('post-solve', (c, imp) => this._postSolve(c, imp));
  }

  // A castle from level data: { blocks: [{t, x, y, w, h, a}], skels: [{x, y}] }.
  // x, y = the centre of a block; for a skeleton, y = where its feet stand.
  build(castle) {
    this.blocks = []; this.skels = [];
    for (const b of castle.blocks) {
      const m = MATERIALS[b.t] || MATERIALS.wood;
      const body = this.world.createBody({ type: 'dynamic', position: this.V(b.x, b.y), angle: b.a || 0 });
      body.createFixture(this.pl.Box(b.w / 2, b.h / 2), { density: m.density, friction: m.friction, restitution: m.restitution });
      body.setUserData({ kind: 'block', mat: b.t, w: b.w, h: b.h, hp: m.hp, src: b });
      body.setAwake(false);
      this.blocks.push(body);
    }
    for (const s of castle.skels) {
      const body = this.world.createBody({ type: 'dynamic', position: this.V(s.x, s.y + SKEL.h / 2) });
      body.createFixture(this.pl.Box(SKEL.w / 2, SKEL.h / 2), { density: SKEL.density, friction: 0.8 });
      body.setUserData({ kind: 'skel', hp: (s.hp || 1) * SKEL.hp, maxHp: (s.hp || 1) * SKEL.hp, down: false, src: s });
      body.setAwake(false);
      this.skels.push(body);
    }
    this.builtAt = this.t;
  }

  clear() {
    for (let b = this.world.getBodyList(); b;) { const n = b.getNext(); if (b !== this.ground) this.world.destroyBody(b); b = n; }
    this.blocks = []; this.skels = []; this.stones = []; this.dead.clear(); this.events = [];
  }

  // Launch velocity for a pull vector (dx, dy) from the cup (pull back = shoot forward).
  static velocity(pullX, pullY, factor = 1) {
    const len = Math.min(Math.hypot(pullX, pullY), MAX_PULL);
    if (len < 0.15) return null;
    const k = (len / MAX_PULL) * MAX_SPEED * factor / Math.hypot(pullX, pullY);
    return { x: -pullX * k, y: -pullY * k };
  }

  fire(type, vx, vy, at = LAUNCH) {
    const st = STONES[type];
    const body = this.world.createBody({ type: 'dynamic', position: this.V(at.x, at.y), bullet: true });
    body.createFixture(this.pl.Circle(st.r), { density: st.density, friction: 0.6, restitution: 0.15 });
    body.setLinearVelocity(this.V(vx * st.speed, vy * st.speed));
    body.setAngularDamping(0.8);
    if (st.gravity) body.setGravityScale(st.gravity);
    body.setUserData({ kind: 'stone', type, hit: false, pierced: 0, born: this.t });
    this.stones.push(body);
    return body;
  }

  // Split stone: the stone in flight becomes three (tap in flight).
  split(body) {
    const u = body.getUserData();
    if (!STONES[u.type].split || u.hit || u.splitDone) return false;
    u.splitDone = true;
    const p = body.getPosition(), v = body.getLinearVelocity();
    for (const ang of [0.2, -0.2]) {
      const c = Math.cos(ang), s = Math.sin(ang);
      const nb = this.fire('split', (v.x * c - v.y * s) / STONES.split.speed, (v.x * s + v.y * c) / STONES.split.speed, { x: p.x, y: p.y });
      nb.getUserData().splitDone = true;
    }
    this.events.push({ type: 'split', x: p.x, y: p.y });
    return true;
  }

  _other(c, kind) {
    const a = c.getFixtureA().getBody(), b = c.getFixtureB().getBody();
    const ua = a.getUserData(), ub = b.getUserData();
    if (ua && ua.kind === kind) return [a, b];
    if (ub && ub.kind === kind) return [b, a];
    return null;
  }

  _preSolve(c) {
    // Cannonball flies through wood: the wood breaks, the ball loses a little speed.
    const pair = this._other(c, 'stone');
    if (!pair) return;
    const [stone, other] = pair, u = stone.getUserData(), ou = other.getUserData();
    if (STONES[u.type].pierce && ou && ou.kind === 'block' && ou.mat !== 'stone' && u.pierced < 4 && !this.dead.has(other)) {
      c.setEnabled(false);
      u.pierced += 1;
      const v = stone.getLinearVelocity();
      stone.setLinearVelocity(this.V(v.x * 0.85, v.y * 0.85));
      this._kill(other, 'pierce');
    }
  }

  _postSolve(c, imp) {
    let total = 0;
    for (const n of imp.normalImpulses) total += n;
    const a = c.getFixtureA().getBody(), b = c.getFixtureB().getBody();
    for (const [body, other] of [[a, b], [b, a]]) {
      const u = body.getUserData();
      if (!u) continue;
      if (u.kind === 'stone') {
        const ou = other.getUserData();
        if (!u.hit && ou) {
          u.hit = true;
          this.events.push({ type: 'impact', x: body.getPosition().x, y: body.getPosition().y, imp: total, on: ou.kind, mat: ou.mat });
          if (STONES[u.type].bomb) this._pendingBomb = body;
        }
        continue;
      }
      if (this.t - this.builtAt < GRACE) continue;
      this._damage(body, total);
    }
  }

  _damage(body, imp) {
    const u = body.getUserData();
    if (u.kind === 'block') {
      const m = MATERIALS[u.mat];
      if (imp < m.min) return;
      u.hp -= imp;
      if (u.hp <= 0) this._kill(body, 'break');
      else if (imp > m.min * 2) this.events.push({ type: 'crack', body, mat: u.mat });
    } else if (u.kind === 'skel' && !u.down) {
      if (imp < SKEL.min) return;
      u.hp -= imp;
      if (u.hp <= 0) this._down(body, 'hit');
      else this.events.push({ type: 'hurt', body });
    }
  }

  _kill(body, why) {
    if (this.dead.has(body)) return;
    this.dead.add(body);
    const u = body.getUserData(), p = body.getPosition();
    this.events.push({ type: 'break', body, mat: u.mat, x: p.x, y: p.y, why, points: MATERIALS[u.mat].points });
  }

  _down(body, why) {
    const u = body.getUserData();
    if (u.down) return;
    u.down = true;
    this.dead.add(body);
    const p = body.getPosition();
    this.events.push({ type: 'skel', body, x: p.x, y: p.y, why, points: SKEL.points });
  }

  _explode(stone) {
    const p = stone.getPosition(), R = 3.6;
    this.events.push({ type: 'boom', x: p.x, y: p.y, r: R });
    for (let b = this.world.getBodyList(); b; b = b.getNext()) {
      const u = b.getUserData();
      if (!u || b === stone || u.kind === 'ground' || this.dead.has(b)) continue;
      const q = b.getPosition(), dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy);
      if (d > R) continue;
      const f = 1 - d / R, k = (14 * f * b.getMass() ** 0.5) / Math.max(d, 0.3);
      b.applyLinearImpulse(this.V(dx * k, dy * k + 2 * f), q, true);
      if (u.kind !== 'stone') this._damage(b, f * 30);
    }
    this.dead.add(stone);
  }

  step() {
    this.world.step(STEP, 8, 3);
    this.t += STEP;
    if (this._pendingBomb) { const s = this._pendingBomb; this._pendingBomb = null; this._explode(s); }
    // Tipped-over or fallen skeletons
    for (const s of this.skels) {
      const u = s.getUserData();
      if (u.down) continue;
      const a = Math.abs(Math.atan2(Math.sin(s.getAngle()), Math.cos(s.getAngle())));
      if (a > TIP && this.t - this.builtAt > GRACE) this._down(s, 'tip');
      else if (s.getPosition().y < -2) this._down(s, 'fall');
    }
    // Stones that left the scene or lie still are removed later by the game (settled()).
    for (const s of this.stones) if (s.getPosition().y < -5 || s.getPosition().x > 70 || s.getPosition().x < -20) this.dead.add(s);
    for (const b of this.dead) {
      this.world.destroyBody(b);
      this.blocks = this.blocks.filter((x) => x !== b);
      this.stones = this.stones.filter((x) => x !== b);
    }
    this.dead.clear();
  }

  standing() { return this.skels.filter((s) => !s.getUserData().down).length; }

  // Everything has (nearly) stopped.
  settled() {
    for (let b = this.world.getBodyList(); b; b = b.getNext()) {
      if (b === this.ground || !b.isAwake()) continue;
      const v = b.getLinearVelocity();
      if (Math.hypot(v.x, v.y) > 0.25 || Math.abs(b.getAngularVelocity()) > 0.4) return false;
    }
    return true;
  }

  bodyCount() { let n = 0; for (let b = this.world.getBodyList(); b; b = b.getNext()) n++; return n - 1; }
}
