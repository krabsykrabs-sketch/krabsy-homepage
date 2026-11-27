// Side-view physics on a cell grid: axis-aligned boxes, no physics library.
// Bodies: players and crates. x/y are the lower-left corner, w/h the size, in cells.
//   - tiles ('#') and dynamic solids (closed doors, gates, built bridges) block everything
//   - ladder tops are one-way floors (stand on them, climb down through them)
//   - crates block everyone; the strong one pushes them (never lifts them)
//   - players stand on crates and on each other (one-way from above); a rider moves with
//     whatever it stands on
import { W, H } from './levels.js';

export const GRAV = 32;
const EPS = 1e-4;

// Role abilities (docs/duo-games.md "Roles"). jumpV from the wanted jump height.
export const ROLES = {
  climber: { w: 0.56, h: 0.9, speed: 5.2, jumpV: Math.sqrt(2 * GRAV * 3.55), climb: true, push: false, look: 1.15 },
  strong: { w: 0.86, h: 1.6, speed: 3.9, jumpV: Math.sqrt(2 * GRAV * 1.45), climb: false, push: true, look: 1.85 },
};
const CLIMB_SPEED = 3.6;
const PUSH_SPEED = 2.3;
const COYOTE = 0.09;
const JUMP_BUFFER = 0.12;

export class World {
  constructor(room) {
    this.room = room;
    this.grid = room.grid;
    this.extra = new Uint8Array(W * H);
    this.bodies = [];
  }

  inside(cx, cy) { return cx >= 0 && cx < W && cy >= 0 && cy < H; }
  solid(cx, cy) {
    if (cy < 0) return false;                   // below the room: open (bottomless gaps)
    if (!this.inside(cx, cy)) return true;      // side walls and ceiling
    return this.grid[cy][cx] === '#' || this.extra[cy * W + cx] > 0;
  }
  ladder(cx, cy) { return this.inside(cx, cy) && this.grid[cy][cx] === 'H'; }
  ladderTop(cx, cy) { return this.ladder(cx, cy) && !this.ladder(cx, cy + 1); }

  setSolid(cells, on) {
    for (const [x, y] of cells) {
      if (!this.inside(x, y)) continue;
      const i = y * W + x;
      this.extra[i] = on ? 1 : 0;
    }
  }
  /** No body overlaps any of these cells (a door may close, a bridge may appear). */
  cellsFree(cells) {
    for (const b of this.bodies) {
      if (b.carried || b.hidden) continue;
      for (const [x, y] of cells) {
        if (b.x < x + 1 - EPS && b.x + b.w > x + EPS && b.y < y + 1 - EPS && b.y + b.h > y + EPS) return false;
      }
    }
    return true;
  }

  addBody(b) {
    const body = { vx: 0, vy: 0, onGround: false, support: null, riders: 0, ...b };
    this.bodies.push(body);
    return body;
  }

  // ── collision helpers ──────────────────────────────────────────────────────────────
  _tilesX(b, nx) {
    const y0 = Math.floor(b.y + EPS), y1 = Math.floor(b.y + b.h - EPS);
    if (nx > b.x) {
      const c = Math.floor(nx + b.w - EPS);
      for (let y = y0; y <= y1; y++) if (this.solid(c, y)) return c - b.w;
    } else if (nx < b.x) {
      const c = Math.floor(nx + EPS);
      for (let y = y0; y <= y1; y++) if (this.solid(c, y)) return c + 1;
    }
    return nx;
  }

  _blockers(b) {   // crates and lifts block everything; players never block each other sideways
    return this.bodies.filter((o) => o !== b && (o.kind === 'box' || o.kind === 'lift') && !o.carried && !o.hidden);
  }

  /** Move sideways by dx; a pusher (the strong one) shoves crates. Returns the distance moved. */
  moveX(b, dx, pusher = false, depth = 0) {
    if (!dx) return 0;
    let nx = this._tilesX(b, b.x + dx);
    for (const o of this._blockers(b)) {
      if (!(b.y < o.y + o.h - EPS && b.y + b.h > o.y + EPS)) continue;
      if (dx > 0 && b.x + b.w <= o.x + 0.02 && nx + b.w > o.x) {
        if (pusher && depth === 0 && o.onGround) this.moveX(o, nx + b.w - o.x, false, depth + 1);
        nx = Math.min(nx, o.x - b.w);
        b.pushing = pusher;
      } else if (dx < 0 && b.x >= o.x + o.w - 0.02 && nx < o.x + o.w) {
        if (pusher && depth === 0 && o.onGround) this.moveX(o, nx - (o.x + o.w), false, depth + 1);
        nx = Math.max(nx, o.x + o.w);
        b.pushing = pusher;
      }
    }
    const moved = nx - b.x;
    b.x = nx;
    return moved;
  }

  /** Move up/down by dy, landing on tiles, ladder tops, crates and players. */
  moveY(b, dy) {
    if (!dy) return 0;
    const x0 = Math.floor(b.x + EPS), x1 = Math.floor(b.x + b.w - EPS);
    let ny = b.y + dy;
    if (dy < 0) {
      b.onGround = false;
      const r = Math.floor(ny);
      for (let c = x0; c <= x1; c++) {
        if (this.solid(c, r) || (b.kind === 'player' && !b.climbing && this.ladderTop(c, r) && b.y >= r + 1 - 0.02)) {
          ny = Math.max(ny, r + 1); b.onGround = true; b.support = null;
        }
      }
      for (const o of this.bodies) {
        if (o === b || o.carried || o.hidden || b.carried) continue;
        if (b.kind === 'player' && o.kind === 'player' && b.climbing) continue;
        if (!(b.x < o.x + o.w - EPS && b.x + b.w > o.x + EPS)) continue;
        const top = o.y + o.h;
        if (b.y >= top - 0.02 && ny < top) { ny = Math.max(ny, top); b.onGround = true; b.support = o; }
      }
      if (b.onGround) b.vy = 0;
    } else {
      const r = Math.floor(ny + b.h - EPS);
      for (let c = x0; c <= x1; c++) if (this.solid(c, r)) { ny = Math.min(ny, r - b.h); b.vy = 0; }
      for (const o of this._blockers(b)) {
        if (!(b.x < o.x + o.w - EPS && b.x + b.w > o.x + EPS)) continue;
        if (b.y + b.h <= o.y + 0.02 && ny + b.h > o.y) { ny = Math.min(ny, o.y - b.h); b.vy = 0; }
      }
    }
    const moved = ny - b.y;
    b.y = ny;
    return moved;
  }

  _onLadder(b) {
    const cx = Math.floor(b.x + b.w / 2);
    return this.ladder(cx, Math.floor(b.y + 0.01)) || this.ladder(cx, Math.floor(b.y + b.h * 0.5));
  }

  // ── one frame ──────────────────────────────────────────────────────────────────────
  // inputs: Map body → { x: -1..1, up, down, jumpPressed } ; frozen players get none.
  step(dt, inputs) {
    // supports first (lower bodies first), so riders follow the movement of this frame
    const order = this.bodies.filter((b) => !b.carried && !b.hidden && !b.static).sort((a, b) => a.y - b.y);
    for (const b of order) { b._dx = 0; b._dy = 0; }
    for (const b of order) {
      const sup = b.support;
      if (sup && (sup._dx || sup._dy) && b.onGround) {
        b._dx += this.moveX(b, sup._dx);
        if (sup._dy > 0) b._dy += this.moveY(b, sup._dy);
      }
      if (b.kind === 'player') this._player(b, inputs.get(b) || null, dt);
      else this._box(b, dt);
    }
  }

  _box(b, dt) {
    b.vy = Math.max(b.vy - GRAV * dt, -20);
    const wasGround = b.onGround;
    b._dy += this.moveY(b, b.vy * dt);
    if (!wasGround && b.onGround) b.landed = true;
  }

  _player(p, inp, dt) {
    const role = ROLES[p.role];
    const i = inp || { x: 0, up: false, down: false, jumpPressed: false };
    p.pushing = false;
    p.coyote = p.onGround ? COYOTE : Math.max(0, (p.coyote || 0) - dt);
    if (i.jumpPressed) p.jumpBuf = JUMP_BUFFER; else p.jumpBuf = Math.max(0, (p.jumpBuf || 0) - dt);

    // ladders (climber only)
    const onLadder = role.climb && this._onLadder(p);
    const cx = Math.floor(p.x + p.w / 2);
    const ladderBelow = role.climb && p.onGround && this.ladderTop(cx, Math.floor(p.y - 0.05));
    if (role.climb && !p.climbing && ((i.up && onLadder) || (i.down && ladderBelow))) {
      p.climbing = true; p.vy = 0; p.vx = 0; p.onGround = false; p.support = null; p.jumpBuf = 0;
      if (!onLadder) p.y -= 0.06;                                  // step down into the top rung
      p.x += ((cx + 0.5 - p.w / 2) - p.x) * 0.7;                   // towards the ladder's middle
    }
    if (p.climbing && p.jumpBuf > 0 && !i.up) { p.climbing = false; p.vy = role.jumpV * 0.7; p.jumpBuf = 0; }

    if (p.climbing) {
      const vy = (i.up ? 1 : 0) - (i.down ? 1 : 0);
      p.vx = i.x * 2.2;
      p._dx += this.moveX(p, p.vx * dt, false);
      const moved = this.moveY(p, vy * CLIMB_SPEED * dt);
      p._dy += moved;
      p.vy = 0;
      if (vy < 0 && p.onGround) p.climbing = false;
      if (!this._onLadder(p)) p.climbing = false;
    } else {
      const target = i.x * role.speed;
      const accel = p.onGround ? 40 : 22;
      p.vx += Math.max(-accel * dt, Math.min(accel * dt, target - p.vx));
      if (p.jumpBuf > 0 && p.coyote > 0) {
        p.vy = role.jumpV; p.jumpBuf = 0; p.coyote = 0; p.onGround = false; p.support = null; p.jumped = true;
      }
      p.vy = Math.max(p.vy - GRAV * dt, -22);
      let vx = p.vx;
      const moved = this.moveX(p, vx * dt, role.push && p.onGround);
      if (p.pushing) p.vx = Math.sign(p.vx) * Math.min(Math.abs(p.vx), PUSH_SPEED);
      else if (Math.abs(moved) < Math.abs(vx * dt) * 0.5) p.vx = 0;
      p._dx += moved;
      p._dy += this.moveY(p, p.vy * dt);
    }
    if (i.x) p.facing = i.x > 0 ? 1 : -1;
  }
}
