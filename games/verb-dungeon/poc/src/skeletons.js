import * as THREE from 'three';
import { rand, clamp, damp, angleDamp, collideCircle } from './utils.js';
import { fx } from './fx.js';
import { sfx } from './audio.js';

const REASSEMBLE_AFTER = 20;

// Mischievous, not menacing: oversized skull, rattly walk, tidy bone pile when bonked.
export class Skeleton {
  constructor(scene, {
    pos, waypoints = null, hp = 2, chase = false, dormant = false,
    bounds = null, // {minX,maxX,minZ,maxZ} clamp for chasers
  }) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.position.set(pos.x, 0, pos.z);
    scene.add(this.group);
    this.home = pos.clone();
    this.waypoints = waypoints;
    this.wpIndex = 0;
    this.maxHp = hp;
    this.hp = hp;
    this.chase = chase;
    this.bounds = bounds;
    this.state = dormant ? 'dormant' : 'patrol';
    this.t = 0;
    this.timer = 0;
    this.walkPhase = rand(10);
    this.facing = 0;
    this.vel = new THREE.Vector3();
    this.parts = [];
    this._build();
    this.shadow = fx.blobShadow(0.85);
    if (dormant) { this.group.visible = false; this.shadow.visible = false; }
  }

  _build() {
    const bone = new THREE.MeshLambertMaterial({ color: 0xe9e4d2 });
    const boneDk = new THREE.MeshLambertMaterial({ color: 0xc9c2ac });
    const dark = new THREE.MeshLambertMaterial({ color: 0x14182c });

    const add = (mesh, x, y, z, pile) => {
      mesh.position.set(x, y, z);
      this.group.add(mesh);
      this.parts.push({
        mesh,
        home: { p: new THREE.Vector3(x, y, z), r: mesh.rotation.clone() },
        pile: { p: new THREE.Vector3(pile[0], pile[1], pile[2]),
          r: new THREE.Euler(rand(-0.4, 0.4), rand(Math.PI * 2), Math.PI / 2 + rand(-0.3, 0.3)) },
        from: { p: new THREE.Vector3(), r: new THREE.Euler() },
      });
      return mesh;
    };

    // pelvis + spine + ribs
    add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.18), boneDk), 0, 0.62, 0, [rand(-0.2, 0.2), 0.07, rand(-0.2, 0.2)]);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.34, 6), bone), 0, 0.88, 0, [rand(-0.25, 0.25), 0.05, rand(-0.25, 0.25)]);
    for (let i = 0; i < 3; i++) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(0.16 - i * 0.025, 0.028, 6, 12), bone);
      rib.rotation.x = Math.PI / 2;
      add(rib, 0, 1.02 - i * 0.11, 0, [rand(-0.3, 0.3), 0.05 + i * 0.05, rand(-0.3, 0.3)]);
    }

    // legs (pivot groups so they can swing)
    this.legs = [];
    for (const sx of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(sx * 0.1, 0.55, 0);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.5, 6), bone);
      leg.position.y = -0.25;
      pivot.add(leg);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.18), boneDk);
      foot.position.set(0, -0.52, 0.04);
      pivot.add(foot);
      this.group.add(pivot);
      this.parts.push({
        mesh: pivot,
        home: { p: pivot.position.clone(), r: new THREE.Euler() },
        pile: { p: new THREE.Vector3(rand(-0.3, 0.3), 0.06, rand(-0.3, 0.3)),
          r: new THREE.Euler(Math.PI / 2, rand(Math.PI * 2), 0) },
        from: { p: new THREE.Vector3(), r: new THREE.Euler() },
      });
      this.legs.push(pivot);
    }

    // arms
    this.arms = [];
    for (const sx of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(sx * 0.24, 1.05, 0);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.04, 0.42, 6), bone);
      arm.position.y = -0.21;
      pivot.add(arm);
      this.group.add(pivot);
      this.parts.push({
        mesh: pivot,
        home: { p: pivot.position.clone(), r: new THREE.Euler() },
        pile: { p: new THREE.Vector3(rand(-0.35, 0.35), 0.05, rand(-0.35, 0.35)),
          r: new THREE.Euler(Math.PI / 2, rand(Math.PI * 2), 0) },
        from: { p: new THREE.Vector3(), r: new THREE.Euler() },
      });
      this.arms.push(pivot);
    }

    // the oversized skull (group: dome + jaw + eyes + pupils)
    this.skull = new THREE.Group();
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 12), bone);
    dome.scale.set(1, 0.95, 0.92);
    this.skull.add(dome);
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.22), boneDk);
    jaw.position.set(0, -0.22, 0.04);
    this.skull.add(jaw);
    for (const sx of [-1, 1]) {
      const socket = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), dark);
      socket.position.set(sx * 0.1, 0.02, 0.2);
      this.skull.add(socket);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.024, 6, 5),
        new THREE.MeshBasicMaterial({ color: 0xffffff }));
      pupil.position.set(sx * 0.1, 0.02, 0.26);
      this.skull.add(pupil);
    }
    const noseHole = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.05, 4), dark);
    noseHole.rotation.x = Math.PI / 2;
    noseHole.position.set(0, -0.06, 0.24);
    this.skull.add(noseHole);
    this.skull.position.set(0, 1.42, 0);
    this.group.add(this.skull);
    this.parts.push({
      mesh: this.skull,
      home: { p: this.skull.position.clone(), r: new THREE.Euler() },
      pile: { p: new THREE.Vector3(0, 0.3, 0), r: new THREE.Euler(0.5, rand(Math.PI * 2), 0.2) },
      from: { p: new THREE.Vector3(), r: new THREE.Euler() },
    });
  }

  get pos() { return this.group.position; }
  get active() { return this.state === 'patrol' || this.state === 'chase' || this.state === 'stagger'; }

  // pop out of a floor hatch (ambush room)
  rise() {
    this.group.visible = true;
    this.shadow.visible = true;
    this.state = 'rising';
    this.t = 0;
    this.group.position.y = -1.6;
    fx.dustPuff(new THREE.Vector3(this.pos.x, 0, this.pos.z), 10);
    sfx.reassemble();
  }

  hit(fromPos) {
    if (!this.active) return null;
    this.hp--;
    const away = this.pos.clone().sub(fromPos).setY(0).normalize();
    this.pos.x += away.x * 0.7;
    this.pos.z += away.z * 0.7;
    if (this.hp <= 0) {
      this._collapse();
      return 'collapsed';
    }
    this.state = 'stagger';
    this.t = 0;
    return 'staggered';
  }

  _collapse() {
    this.state = 'collapsing';
    this.t = 0;
    this.timer = REASSEMBLE_AFTER;
    for (const p of this.parts) {
      p.from.p.copy(p.mesh.position);
      p.from.r.copy(p.mesh.rotation);
    }
    fx.burst(new THREE.Vector3(this.pos.x, 0.8, this.pos.z), { color: 0xfff3c8, n: 14, speed: 2 });
    fx.dustPuff(new THREE.Vector3(this.pos.x, 0, this.pos.z), 8);
    sfx.boneRattle();
  }

  _startReassemble() {
    this.state = 'reassembling';
    this.t = 0;
    for (const p of this.parts) {
      p.from.p.copy(p.mesh.position);
      p.from.r.copy(p.mesh.rotation);
    }
    sfx.reassemble();
  }

  _lerpParts(k, toPile) {
    for (const p of this.parts) {
      const dst = toPile ? p.pile : p.home;
      p.mesh.position.lerpVectors(p.from.p, dst.p, k);
      p.mesh.rotation.set(
        p.from.r.x + (dst.r.x - p.from.r.x) * k,
        p.from.r.y + (dst.r.y - p.from.r.y) * k,
        p.from.r.z + (dst.r.z - p.from.r.z) * k);
    }
  }

  update(dt, t, player, level) {
    const events = [];
    const st = this.state;
    this.t += dt;

    if (st === 'dormant') return events;

    if (st === 'rising') {
      const k = Math.min(1, this.t / 0.55);
      this.group.position.y = -1.6 + 1.6 * (1 - (1 - k) * (1 - k));
      if (k >= 1) { this.group.position.y = 0; this.state = this.chase ? 'chase' : 'patrol'; }
      this.shadow.position.set(this.pos.x, 0.025, this.pos.z);
      return events;
    }

    if (st === 'collapsing') {
      const k = Math.min(1, this.t / 0.5);
      this._lerpParts(k * k, true); // accelerate into the pile
      if (k >= 1) this.state = 'collapsed';
      return events;
    }

    if (st === 'collapsed') {
      this.timer -= dt;
      if (this.timer <= 0) this._startReassemble();
      return events;
    }

    if (st === 'reassembling') {
      const k = Math.min(1, this.t / 0.8);
      this._lerpParts(1 - (1 - k) * (1 - k), false);
      if (k >= 1) {
        this.hp = this.maxHp;
        this.state = 'shrug';
        this.t = 0;
        events.push({ type: 'reassembled' });
      }
      return events;
    }

    if (st === 'shrug') {
      // sheepish shoulder shrug + head tilt, then back to work
      const k = Math.min(1, this.t / 0.9);
      const lift = Math.sin(k * Math.PI) * 0.9;
      this.arms[0].rotation.z = lift;
      this.arms[1].rotation.z = -lift;
      this.skull.rotation.z = Math.sin(k * Math.PI) * 0.3;
      if (k >= 1) {
        this.arms[0].rotation.z = this.arms[1].rotation.z = this.skull.rotation.z = 0;
        this.state = this.chase ? 'chase' : 'patrol';
      }
      return events;
    }

    if (st === 'stagger') {
      this.skull.rotation.y = Math.sin(this.t * 30) * 0.6 * (1 - this.t / 0.45);
      if (this.t > 0.45) { this.skull.rotation.y = 0; this.state = this.chase ? 'chase' : 'patrol'; }
      return events;
    }

    // ---- moving states ----
    let target = null;
    let speed = 1.7;
    if (st === 'chase') {
      target = player.pos;
      speed = 2.3;
    } else if (this.waypoints) {
      const wp = this.waypoints[this.wpIndex];
      if (Math.hypot(wp.x - this.pos.x, wp.z - this.pos.z) < 0.4)
        this.wpIndex = (this.wpIndex + 1) % this.waypoints.length;
      target = this.waypoints[this.wpIndex];
    }

    if (target) {
      const dx = target.x - this.pos.x, dz = target.z - this.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.25) {
        this.pos.x += (dx / d) * speed * dt;
        this.pos.z += (dz / d) * speed * dt;
        this.facing = angleDamp(this.facing, Math.atan2(dx, dz), 8, dt);
        this.group.rotation.y = this.facing;
      }
      if (this.bounds) {
        this.pos.x = clamp(this.pos.x, this.bounds.minX, this.bounds.maxX);
        this.pos.z = clamp(this.pos.z, this.bounds.minZ, this.bounds.maxZ);
      }
      collideCircle(this.pos, 0.35, level.colliders);
    }

    // rattly walk: quick leg swings, bouncy hop, wobbling oversized head
    this.walkPhase += dt * 9;
    const swing = Math.sin(this.walkPhase) * 0.6;
    this.legs[0].rotation.x = swing;
    this.legs[1].rotation.x = -swing;
    this.arms[0].rotation.x = -swing * 0.5;
    this.arms[1].rotation.x = swing * 0.5;
    this.group.position.y = Math.abs(Math.sin(this.walkPhase)) * 0.08;
    this.skull.rotation.z = Math.sin(this.walkPhase * 0.5) * 0.16;
    this.skull.rotation.x = Math.sin(this.walkPhase) * 0.06;
    if (Math.random() < dt * 2.2) sfx.tone({ f: 1900 + rand(600), type: 'sine', dur: 0.025, g: 0.012 });

    // surprised hop when the hero gets close
    const pd = Math.hypot(player.pos.x - this.pos.x, player.pos.z - this.pos.z);
    if (pd < 3 && !this._spotted) {
      this._spotted = true;
      this.skull.rotation.x = -0.3;
      sfx.tone({ f: 740, f1: 1100, type: 'triangle', dur: 0.12, g: 0.05 });
    } else if (pd > 4.5) this._spotted = false;

    // bumping the hero costs a heart (game decides what to do with it)
    if (pd < 0.8 && player.invuln <= 0 && !player.falling) events.push({ type: 'touch' });

    this.shadow.position.set(this.pos.x, 0.025, this.pos.z);
    return events;
  }
}
