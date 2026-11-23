// Third-person player: an animated KayKit character with the camera behind it.
// Keyboard + mouse (the mouse stays free for the buttons; dragging on the game
// turns the camera, a short click acts) and touch (left stick moves, right thumb
// turns the camera, buttons). While running forward the camera slowly swings in
// behind the character, so steering the camera is optional. The character runs where
// the stick / keys point, relative to the camera, and turns to face that way.
// Moves on the height function, pushed out of circle colliders, kept on the
// island and out of locked zones. Carried eggs stack above the head.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { PLAYER, ZONES } from './balance.js';
import { height, onIsland, makeEggMesh, WATER_Y } from './world.js';

export const touchMode = matchMedia('(pointer: coarse)').matches || /[?&]touch/.test(location.search);
export const LOOKS = ['A', 'B']; // Protagonist_A / Protagonist_B
const SCALE = 0.78;              // about 1.8 m tall
const CAM = { dist: 6.2, min: 3.2, max: 11, height: 1.55 };

let template = {}, clips = null;
export async function loadCharacters() {
  const loader = new GLTFLoader();
  const [a, b, anim] = await Promise.all([
    loader.loadAsync('assets/characters/Protagonist_A.glb'),
    loader.loadAsync('assets/characters/Protagonist_B.glb'),
    loader.loadAsync('assets/characters/anim_player.glb'),
  ]);
  template = { A: a.scene, B: b.scene };
  clips = Object.fromEntries(anim.animations.map((c) => [c.name, c]));
}

export class Player {
  constructor(world, canvas) {
    this.world = world; this.canvas = canvas;
    this.pos = new THREE.Vector3();
    this.yaw = 0;          // camera yaw (0 = looking towards −z)
    this.pitch = -0.32;    // camera pitch (negative = looking down)
    this.facing = 0;       // the character's own yaw
    this.vy = 0; this.onGround = true;
    this.keys = new Set();
    this.speedFactor = 1;
    this.enabled = false;
    this.drag = null;      // mouse drag on the game: { id, x, y, moved }
    this.onClick = null;   // a short click on the game (no drag)
    this.camIdle = 0;      // seconds since the player last turned the camera
    this.moved = 0; this.speed = 0; this.camDist = CAM.dist;
    this.stick = { x: 0, y: 0, id: null };
    this.look = { id: null, x: 0, y: 0 };
    this.isLocked = () => false;
    this.onStep = null; this.onJump = null; this.onLand = null;
    this.root = new THREE.Group();
    world.scene.add(this.root);
    this.eggStack = new THREE.Group();
    this.root.add(this.eggStack);
    this.oneShot = 0;      // seconds left of a one-shot animation (pick up, hit)
    this._keyboard(); this._mouse();
    if (touchMode) this._touch();
  }

  // ── character ──
  setLook(look) {
    if (!template.A) return;
    if (this.char) { this.root.remove(this.char); this.mixer.stopAllAction(); }
    const c = cloneSkinned(template[look] || template.A);
    c.scale.setScalar(SCALE);
    c.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
    this.root.add(c);
    this.char = c; this.lookId = look;
    this.mixer = new THREE.AnimationMixer(c);
    this.actions = {};
    for (const [n, clip] of Object.entries(clips)) this.actions[n] = this.mixer.clipAction(clip);
    this.current = null;
    this.play('Idle_A');
    this.headY = 2.05;
  }
  play(name, { once = false, fade = 0.18, speed = 1 } = {}) {
    if (!this.actions || !this.actions[name]) return;
    const next = this.actions[name];
    next.timeScale = speed;
    if (this.current === name) return;
    const prev = this.current && this.actions[this.current];
    next.reset();
    next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    next.clampWhenFinished = once;
    next.play();
    if (prev) prev.crossFadeTo(next, fade, false);
    this.current = name;
  }
  // one-shot animation (pick up, hit, interact), then back to the loop
  gesture(name) {
    if (!this.actions || !this.actions[name]) return;
    this.current = null;
    for (const a of Object.values(this.actions)) if (a !== this.actions[name]) a.fadeOut(0.1);
    this.play(name, { once: true, fade: 0.1 });
    this.actions[name].fadeIn(0.1);
    this.oneShot = this.actions[name].getClip().duration * 0.85;
  }

  spawn(v, yaw = 0) {
    this.pos.copy(v); this.yaw = yaw; this.facing = yaw + Math.PI; this.pitch = -0.32; this.vy = 0;
    this.root.position.copy(this.pos);
  }

  // ── input ──
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
    const c = this.canvas;
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch' || (e.button !== 0 && e.button !== 2)) return;
      this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0, button: e.button };
      try { c.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    });
    c.addEventListener('pointermove', (e) => {
      const d = this.drag;
      if (!d || e.pointerId !== d.id) return;
      const dx = e.clientX - d.x, dy = e.clientY - d.y;
      d.x = e.clientX; d.y = e.clientY;
      d.moved += Math.abs(dx) + Math.abs(dy);
      if (d.moved > 5) {
        c.classList.add('dragging');
        if (this.enabled) this.turn(dx * 0.006, dy * 0.0045);
      }
    });
    const up = (e) => {
      const d = this.drag;
      if (!d || e.pointerId !== d.id) return;
      this.drag = null;
      c.classList.remove('dragging');
      if (d.moved <= 5 && d.button === 0 && this.onClick) this.onClick();
    };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    this.canvas.addEventListener('wheel', (e) => {
      this.camDist = Math.max(CAM.min, Math.min(CAM.max, this.camDist + Math.sign(e.deltaY) * 0.8));
    }, { passive: true });
  }
  turn(dx, dy) {
    this.camIdle = 0;
    this.yaw -= dx;
    this.pitch = Math.max(-1.15, Math.min(0.35, this.pitch - dy));
  }
  jump() {
    if (!this.onGround || !this.enabled) return;
    this.vy = PLAYER.jump; this.onGround = false;
    this.current = null;
    this.play('Jump_Start', { once: true, fade: 0.08 });
    if (this.onJump) this.onJump();
  }
  _touch() {
    const stickEl = document.getElementById('stick'), knob = document.getElementById('knob');
    this.canvas.addEventListener('touchstart', (e) => {
      for (const t of e.changedTouches) {
        if (t.clientX < innerWidth * 0.45 && this.stick.id === null) {
          this.stick = { x: 0, y: 0, id: t.identifier, ox: t.clientX, oy: t.clientY };
          stickEl.style.display = 'block'; stickEl.style.left = `${t.clientX}px`; stickEl.style.top = `${t.clientY}px`;
          knob.style.transform = 'translate(-50%,-50%)';
        } else if (this.look.id === null) {
          this.look = { id: t.identifier, x: t.clientX, y: t.clientY };
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
          if (this.enabled) this.turn((t.clientX - this.look.x) * 0.007, (t.clientY - this.look.y) * 0.005);
          this.look.x = t.clientX; this.look.y = t.clientY;
        }
      }
      e.preventDefault();
    }, { passive: false });
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.stick.id) { this.stick = { x: 0, y: 0, id: null }; stickEl.style.display = 'none'; }
        if (t.identifier === this.look.id) this.look = { id: null, x: 0, y: 0 };
      }
    };
    this.canvas.addEventListener('touchend', end);
    this.canvas.addEventListener('touchcancel', end);
  }
  input() {
    const k = this.keys;
    let x = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    let y = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    let sprint = k.has('ShiftLeft') || k.has('ShiftRight');
    if (this.stick.id !== null) {
      x = this.stick.x; y = -this.stick.y;
      sprint = Math.hypot(x, y) > 0.85;
    }
    const L = Math.hypot(x, y);
    if (L > 1) { x /= L; y /= L; }
    return { x, y, sprint, amount: Math.min(1, L) };
  }

  // ── per frame ──
  update(dt) {
    let moving = false;
    if (this.enabled) {
      const inp = this.input();
      if (inp.amount > 0.08) {
        // direction relative to the camera
        const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
        const dirX = -sin * inp.y + cos * inp.x, dirZ = -cos * inp.y - sin * inp.x;
        const L = Math.hypot(dirX, dirZ) || 1;
        const speed = (inp.sprint ? PLAYER.sprint : PLAYER.walk) * this.speedFactor * (touchMode ? Math.max(0.45, inp.amount) : 1);
        const bx = this.pos.x, bz = this.pos.z;
        this.tryMove((dirX / L) * speed * dt, (dirZ / L) * speed * dt);
        const step = Math.hypot(this.pos.x - bx, this.pos.z - bz);
        this.speed = step / Math.max(dt, 1e-4);
        moving = step > 0.001;
        // the character turns to where it runs
        // running forward: the camera slowly swings in behind (not while the
        // player turns it, and not when running sideways or back)
        this.camIdle += dt;
        if (inp.y > 0.5 && this.camIdle > 0.8 && !this.drag && this.look.id === null) {
          let dy = (this.facing + Math.PI) - this.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
          this.yaw += dy * Math.min(1, dt * 1.6);
        }
        const want = Math.atan2(dirX, dirZ);
        let d = want - this.facing; d = Math.atan2(Math.sin(d), Math.cos(d));
        this.facing += d * Math.min(1, dt * 12);
        if (moving && this.onGround) {
          const b = Math.floor(this.moved / 2.4);
          this.moved += step;
          if (Math.floor(this.moved / 2.4) !== b && this.onStep) this.onStep(inp.sprint);
        }
      } else this.speed = 0;
    } else this.speed = 0;
    // gravity / ground
    const g = height(this.pos.x, this.pos.z);
    const wasAir = !this.onGround;
    this.vy -= 22 * dt;
    this.pos.y += this.vy * dt;
    if (this.pos.y <= g) {
      this.pos.y = g; this.vy = 0;
      if (wasAir) {
        this.onGround = true;
        if (this.onLand) this.onLand();
        if (this.actions) { this.current = null; this.play('Jump_Land', { once: true, fade: 0.05 }); this.oneShot = 0.22; }
      }
    } else if (this.pos.y > g + 0.08) this.onGround = false;
    // animation
    if (this.mixer) {
      this.oneShot -= dt;
      if (!this.onGround) { if (this.current !== 'Jump_Start' || this.vy < 2) this.play('Jump_Idle', { fade: 0.15 }); }
      else if (this.oneShot <= 0) {
        if (moving && this.speed > 0.5) {
          const run = this.speed > PLAYER.walk * 0.7;
          this.play(run ? 'Running_A' : 'Walking_A', { speed: run ? this.speed / 6.8 : this.speed / 2.6 });
        } else this.play('Idle_A');
      }
      this.mixer.update(dt);
    }
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.facing;
    // eggs above the head bob a little
    this.eggStack.position.y = (this.headY || 2) + 0.15 + Math.abs(Math.sin(this.moved * 1.3)) * 0.06;
    this.placeCamera();
  }

  // camera behind the character, kept above the ground
  placeCamera() {
    const cam = this.world.camera;
    const tx = this.pos.x, ty = this.pos.y + CAM.height, tz = this.pos.z;
    const cp = Math.cos(this.pitch);
    let dist = this.camDist;
    const at = (d) => [tx + Math.sin(this.yaw) * cp * d, ty - Math.sin(this.pitch) * d, tz + Math.cos(this.yaw) * cp * d];
    let p = at(dist);
    // a tree trunk or rock between the character and the camera: move the camera in front of it
    const sx = p[0] - tx, sz = p[2] - tz, sl = Math.hypot(sx, sz);
    if (sl > 0.01) {
      const ux = sx / sl, uz = sz / sl;
      for (const c of this.world.nearColliders(tx, tz)) {
        const ox = c.x - tx, oz = c.z - tz;
        const along = ox * ux + oz * uz;
        if (along <= 0 || along > sl + c.r) continue;
        const side = Math.abs(ox * uz - oz * ux), r = c.r + 0.35;
        if (side >= r) continue;
        const hit = along - Math.sqrt(r * r - side * side);
        if (hit > 0.5 && hit < sl) dist = Math.min(dist, Math.max(CAM.min * 0.6, (hit / sl) * dist));
      }
      p = at(dist);
    }
    for (let i = 0; i < 6; i++) {
      const gh = Math.max(height(p[0], p[2]), WATER_Y) + 0.5; // above the ground and above the sea
      if (p[1] >= gh) break;
      dist *= 0.8; p = at(dist);
      if (i === 5) p[1] = Math.max(p[1], gh);
    }
    cam.position.set(p[0], p[1], p[2]);
    cam.lookAt(tx, ty + 0.3, tz);
  }

  tryMove(dx, dz) {
    const w = this.world, r = PLAYER.radius;
    let nx = this.pos.x + dx, nz = this.pos.z + dz;
    for (let pass = 0; pass < 2; pass++) {
      for (const c of w.nearColliders(nx, nz)) {
        const ddx = nx - c.x, ddz = nz - c.z, d = Math.hypot(ddx, ddz), min = c.r + r;
        if (d < min && d > 1e-4) { nx = c.x + (ddx / d) * min; nz = c.z + (ddz / d) * min; }
      }
    }
    for (const z of ZONES) {
      if (!z.r || !this.isLocked(z)) continue;
      const ddx = nx - z.x, ddz = nz - z.z, d = Math.hypot(ddx, ddz), min = z.r + r + 0.2;
      if (d < min) { nx = z.x + (ddx / d) * min; nz = z.z + (ddz / d) * min; }
    }
    if (!onIsland(nx, nz)) return;
    const climb = height(nx, nz) - height(this.pos.x, this.pos.z);
    if (this.onGround && climb > 0.9) return;
    this.pos.x = nx; this.pos.z = nz;
  }

  // Eggs in the backpack: a stack above the head, like a trophy.
  showCarry(list) {
    this.eggStack.clear();
    list.forEach((egg, i) => {
      const m = makeEggMesh(egg.r || egg, 0.85);
      m.position.set(0, i * 0.5, 0);
      m.rotation.z = (i % 2 ? -1 : 1) * 0.12;
      this.eggStack.add(m);
    });
  }

  // where the character looks (for "what is in front of me")
  forward() { return new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing)); }
  // turn the camera to look from behind the player towards a point
  lookAtPoint(x, z) {
    const dx = x - this.pos.x, dz = z - this.pos.z;
    this.yaw = Math.atan2(-dx, -dz);
    this.facing = Math.atan2(dx, dz);
    this.pitch = -0.3;
    this.placeCamera();
  }
}
