// First-person player: keyboard + mouse (pointer lock) and touch (left stick,
// drag to look, buttons). Moves on the height function, pushed out of circle
// colliders, kept on the island and out of locked zones.
import * as THREE from 'three';
import { PLAYER, ZONES } from './balance.js';
import { height, onIsland } from './world.js';
import { makeEggMesh } from './world.js';

export const touchMode = matchMedia('(pointer: coarse)').matches || /[?&]touch/.test(location.search);

export class Player {
  constructor(world, canvas) {
    this.world = world; this.canvas = canvas;
    this.pos = new THREE.Vector3();
    this.yaw = 0; this.pitch = -0.05; this.vy = 0; this.onGround = true;
    this.keys = new Set();
    this.speedFactor = 1;
    this.enabled = false;      // false while a card or panel is open
    this.locked = false;       // pointer lock (desktop)
    this.moved = 0;            // distance walked (head bob, footsteps)
    this.stick = { x: 0, y: 0, id: null, ox: 0, oy: 0 };
    this.look = { id: null, x: 0, y: 0 };
    this.isLocked = (z) => false; // set by main: is this zone locked?
    this.onStep = null; this.onJump = null;
    this._keyboard(); this._mouse();
    if (touchMode) this._touch();
    // eggs held in view (children of the camera)
    this.hands = new THREE.Group();
    world.camera.add(this.hands);
    this.hands.position.set(0.6, -0.62, -1.1);
  }

  spawn(v, yaw = Math.PI) { this.pos.copy(v); this.yaw = yaw; this.pitch = -0.08; this.vy = 0; }

  _keyboard() {
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'Space' && this.enabled) { e.preventDefault(); this.jump(); }
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
  }
  _mouse() {
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (!this.locked) this.keys.clear();
      if (this.onLockChange) this.onLockChange(this.locked);
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked || !this.enabled) return;
      this.turn(e.movementX * 0.0022, e.movementY * 0.0022);
    });
  }
  requestLock() {
    if (touchMode || this.locked) return;
    try { const p = this.canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (_) { /* ignore */ }
  }
  releaseLock() { if (document.pointerLockElement) document.exitPointerLock(); }
  turn(dx, dy) {
    this.yaw -= dx;
    this.pitch = Math.max(-1.35, Math.min(1.25, this.pitch - dy));
  }
  jump() {
    if (!this.onGround || !this.enabled) return;
    this.vy = PLAYER.jump; this.onGround = false;
    if (this.onJump) this.onJump();
  }

  // Touch: left half = floating stick, right half = drag to look.
  _touch() {
    const stickEl = document.getElementById('stick'), knob = document.getElementById('knob');
    this.canvas.addEventListener('touchstart', (e) => {
      for (const t of e.changedTouches) {
        if (t.clientX < innerWidth * 0.45 && this.stick.id === null) {
          this.stick.id = t.identifier; this.stick.ox = t.clientX; this.stick.oy = t.clientY;
          stickEl.style.display = 'block'; stickEl.style.left = `${t.clientX}px`; stickEl.style.top = `${t.clientY}px`;
          knob.style.transform = 'translate(-50%,-50%)';
        } else if (this.look.id === null) {
          this.look.id = t.identifier; this.look.x = t.clientX; this.look.y = t.clientY;
        }
      }
      e.preventDefault();
    }, { passive: false });
    this.canvas.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.stick.id) {
          let dx = t.clientX - this.stick.ox, dy = t.clientY - this.stick.oy;
          const L = Math.hypot(dx, dy), max = 55;
          if (L > max) { dx *= max / L; dy *= max / L; }
          this.stick.x = dx / max; this.stick.y = dy / max;
          knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        } else if (t.identifier === this.look.id) {
          if (this.enabled) this.turn((t.clientX - this.look.x) * 0.006, (t.clientY - this.look.y) * 0.006);
          this.look.x = t.clientX; this.look.y = t.clientY;
        }
      }
      e.preventDefault();
    }, { passive: false });
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.stick.id) { this.stick = { x: 0, y: 0, id: null }; stickEl.style.display = 'none'; }
        if (t.identifier === this.look.id) this.look.id = null;
      }
    };
    this.canvas.addEventListener('touchend', end);
    this.canvas.addEventListener('touchcancel', end);
  }

  // Input → wish direction (x = right, y = forward), sprint flag.
  input() {
    const k = this.keys;
    let x = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    let y = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    let sprint = k.has('ShiftLeft') || k.has('ShiftRight');
    if (this.stick.id !== null) {
      x = this.stick.x; y = -this.stick.y;
      sprint = Math.hypot(x, y) > 0.85; // push the stick all the way = run
    }
    const L = Math.hypot(x, y);
    if (L > 1) { x /= L; y /= L; }
    return { x, y, sprint };
  }

  update(dt) {
    const w = this.world;
    if (this.enabled) {
      const { x, y, sprint } = this.input();
      const speed = (sprint ? PLAYER.sprint : PLAYER.walk) * this.speedFactor;
      const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
      // forward = (−sin, −cos), right = (cos, −sin)
      const dx = (-sin * y + cos * x) * speed * dt, dz = (-cos * y - sin * x) * speed * dt;
      this.tryMove(dx, dz);
      const step = Math.hypot(dx, dz);
      if (step > 0 && this.onGround) {
        const before = Math.floor(this.moved / 2.2);
        this.moved += step;
        if (Math.floor(this.moved / 2.2) !== before && this.onStep) this.onStep(sprint);
      }
      this.running = sprint && step > 0;
    }
    // gravity / ground
    const g = height(this.pos.x, this.pos.z);
    const floor = this.floorAt ? Math.max(g, this.floorAt(this.pos.x, this.pos.z)) : g;
    this.vy -= PLAYER.gravity * dt;
    this.pos.y += this.vy * dt;
    if (this.pos.y <= floor) { this.pos.y = floor; this.vy = 0; this.onGround = true; }
    else if (this.pos.y > floor + 0.05) this.onGround = false;
    // camera
    const bob = this.onGround ? Math.sin(this.moved * 2.6) * 0.05 : 0;
    w.camera.position.set(this.pos.x, this.pos.y + PLAYER.eye + bob, this.pos.z);
    w.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    this.hands.position.y = -0.62 + Math.sin(this.moved * 2.6) * 0.02;
    this.hands.position.x = 0.6 + Math.cos(this.moved * 1.3) * 0.015;
  }

  tryMove(dx, dz) {
    const w = this.world, r = PLAYER.radius;
    let nx = this.pos.x + dx, nz = this.pos.z + dz;
    // circle colliders (two passes)
    for (let pass = 0; pass < 2; pass++) {
      for (const c of w.nearColliders(nx, nz)) {
        const ddx = nx - c.x, ddz = nz - c.z, d = Math.hypot(ddx, ddz), min = c.r + r;
        if (d < min && d > 1e-4) { nx = c.x + (ddx / d) * min; nz = c.z + (ddz / d) * min; }
      }
    }
    // locked zones: stay outside the wall
    for (const z of ZONES) {
      if (!z.r || !this.isLocked(z)) continue;
      const ddx = nx - z.x, ddz = nz - z.z, d = Math.hypot(ddx, ddz), min = z.r + r + 0.2;
      if (d < min) { nx = z.x + (ddx / d) * min; nz = z.z + (ddz / d) * min; }
    }
    // stay on the island (not into deep water), and no walking up cliffs
    if (!onIsland(nx, nz)) return;
    const climb = height(nx, nz) - height(this.pos.x, this.pos.z);
    if (this.onGround && climb > 0.9) return;
    this.pos.x = nx; this.pos.z = nz;
  }

  // Eggs in the backpack, held in view (bottom right).
  showCarry(list) {
    this.hands.clear();
    list.forEach((r, i) => {
      const m = makeEggMesh(r, 0.3);
      m.position.set(-i * 0.16, i * 0.13, -i * 0.05);
      m.rotation.z = 0.15 - i * 0.08;
      m.castShadow = false;
      this.hands.add(m);
    });
  }

  // direction the player looks at, on the ground plane
  forward() { return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }
}
