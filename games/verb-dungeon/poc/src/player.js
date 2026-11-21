import * as THREE from 'three';
import { clamp, damp, angleDamp, collideCircle } from './utils.js';
import { fx } from './fx.js';
import { sfx } from './audio.js';

const SPEED = 5.4;
const ACCEL = 26;
const RADIUS = 0.42;

export class Player {
  constructor(scene) {
    this.group = new THREE.Group();           // at the feet
    this.rig = new THREE.Group();             // bob / lean / squash live here
    this.group.add(this.rig);
    scene.add(this.group);
    this.pos = this.group.position;
    this.vel = new THREE.Vector3();
    this.hearts = 3;
    this.facing = Math.PI;                    // start looking back at the doors
    this.walkPhase = 0;
    this.bonkT = -1;
    this.invuln = 0;
    this.falling = false;
    this.fallVy = 0;
    this.frozen = false;                      // intro / respawn moments
    this._buildRig();
    this.shadow = fx.blobShadow(0.9);
  }

  _buildRig() {
    const teal = new THREE.MeshLambertMaterial({ color: 0x2ee6c0 });
    const tealDk = new THREE.MeshLambertMaterial({ color: 0x1ba88a });
    const amber = new THREE.MeshLambertMaterial({ color: 0xffcf5e });
    const coral = new THREE.MeshLambertMaterial({ color: 0xff8585 });
    const skin = new THREE.MeshLambertMaterial({ color: 0xffe0c2 });
    const dark = new THREE.MeshLambertMaterial({ color: 0x1b2138 });
    const wood = new THREE.MeshLambertMaterial({ color: 0x8a5a32 });

    // body
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.3, 6, 12), teal);
    body.position.y = 0.62;
    this.rig.add(body);
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.08, 12), tealDk);
    belt.position.y = 0.52; this.rig.add(belt);

    // head + helmet
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 12), skin);
    head.position.y = 1.08;
    this.rig.add(head);
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.27, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), amber);
    helm.position.y = 1.13;
    this.rig.add(helm);
    const plume = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.3, 8), coral);
    plume.position.set(0, 1.42, -0.05);
    plume.rotation.x = -0.4;
    this.rig.add(plume);
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.038, 8, 6), dark);
      eye.position.set(sx * 0.095, 1.1, 0.205);
      this.rig.add(eye);
    }

    // legs
    this.legs = [];
    for (const sx of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(sx * 0.12, 0.42, 0);
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.24, 4, 8), tealDk);
      leg.position.y = -0.2;
      pivot.add(leg);
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.22), wood);
      boot.position.set(0, -0.37, 0.03);
      pivot.add(boot);
      this.rig.add(pivot);
      this.legs.push(pivot);
    }

    // left arm
    this.armL = new THREE.Group();
    this.armL.position.set(-0.32, 0.86, 0);
    const armMeshL = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.26, 4, 8), teal);
    armMeshL.position.y = -0.18;
    this.armL.add(armMeshL);
    this.rig.add(this.armL);

    // right arm with the bonk mallet
    this.armR = new THREE.Group();
    this.armR.position.set(0.32, 0.86, 0);
    const armMeshR = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.26, 4, 8), teal);
    armMeshR.position.y = -0.18;
    this.armR.add(armMeshR);
    const mallet = new THREE.Group();
    mallet.position.set(0, -0.34, 0.1);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.5, 8), wood);
    handle.rotation.x = Math.PI / 2;
    handle.position.z = 0.18;
    mallet.add(handle);
    const headM = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.26, 12), amber);
    headM.rotation.z = Math.PI / 2;
    headM.position.z = 0.46;
    mallet.add(headM);
    this.armR.add(mallet);
    this.rig.add(this.armR);
  }

  tryBonk() {
    if (this.bonkT >= 0 || this.falling || this.frozen) return false;
    this.bonkT = 0;
    this.didHitCheck = false;
    sfx.swing();
    return true;
  }

  // true exactly once per swing, in the "impact" window — game checks skeletons then
  consumeHitWindow() {
    if (this.bonkT >= 0.1 && this.bonkT < 0.22 && !this.didHitCheck) {
      this.didHitCheck = true;
      return true;
    }
    return false;
  }

  takeHit(fromPos) {
    if (this.invuln > 0 || this.falling) return this.hearts;
    this.hearts = Math.max(0, this.hearts - 1);
    this.invuln = 1.15;
    const away = this.pos.clone().sub(fromPos).setY(0).normalize();
    if (away.lengthSq() < 0.01) away.set(0, 0, -1);
    this.vel.copy(away.multiplyScalar(7.5));
    sfx.hurt();
    return this.hearts;
  }

  respawn(pos) {
    this.pos.set(pos.x, 0, pos.z);
    this.vel.set(0, 0, 0);
    this.falling = false;
    this.fallVy = 0;
    this.group.rotation.set(0, this.group.rotation.y, 0);
    this.rig.visible = true;
    this.invuln = 1.2;
  }

  update(dt, t, move, level) {
    const events = [];

    if (this.falling) {
      this.fallVy -= 22 * dt;
      this.pos.y += this.fallVy * dt;
      this.group.rotation.x += dt * 5;
      this.shadow.visible = false;
      if (this.pos.y < -6) events.push({ type: 'fellOut' });
      return events;
    }

    // steer
    const wantX = this.frozen ? 0 : move.x * SPEED;
    const wantZ = this.frozen ? 0 : move.y * SPEED;
    this.vel.x = damp(this.vel.x, wantX, ACCEL / SPEED, dt);
    this.vel.z = damp(this.vel.z, wantZ, ACCEL / SPEED, dt);
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    collideCircle(this.pos, RADIUS, level.colliders);

    // over the chasm?
    if (level.inPit(this.pos)) {
      this.falling = true;
      this.fallVy = 1.5;
      sfx.fall();
      events.push({ type: 'fell' });
      return events;
    }

    const speed = Math.hypot(this.vel.x, this.vel.z);
    const moving = speed > 0.6;

    // face the way we're going
    if (moving) {
      const target = Math.atan2(this.vel.x, this.vel.z);
      this.group.rotation.y = angleDamp(this.group.rotation.y, target, 12, dt);
      this.facing = this.group.rotation.y;
    }

    // walk cycle: leg swing, counter arm swing, bob, lean into the turn
    this.walkPhase += speed * dt * 2.4;
    const k = clamp(speed / SPEED, 0, 1);
    const swing = Math.sin(this.walkPhase) * 0.75 * k;
    this.legs[0].rotation.x = swing;
    this.legs[1].rotation.x = -swing;
    this.armL.rotation.x = -swing * 0.7;
    if (this.bonkT < 0) this.armR.rotation.x = swing * 0.7;
    this.rig.position.y = Math.abs(Math.sin(this.walkPhase)) * 0.07 * k;
    this.rig.rotation.x = k * 0.12;
    // lean into turns: sideways velocity relative to facing
    const lateral = this.vel.x * Math.cos(this.facing) - this.vel.z * Math.sin(this.facing);
    this.rig.rotation.z = damp(this.rig.rotation.z, -lateral * 0.03, 8, dt);

    // footstep dust
    if (moving && Math.sin(this.walkPhase) > 0.96 && Math.random() < 0.5) {
      fx.dustPuff(this.pos, 2);
    }

    // bonk swing: wind up, whack, recover
    if (this.bonkT >= 0) {
      this.bonkT += dt;
      const bt = this.bonkT;
      if (bt < 0.1) this.armR.rotation.x = -1.9 * (bt / 0.1);            // anticipation: raise
      else if (bt < 0.22) this.armR.rotation.x = -1.9 + 3.1 * ((bt - 0.1) / 0.12); // whack down
      else if (bt < 0.45) this.armR.rotation.x = 1.2 * (1 - (bt - 0.22) / 0.23);
      else { this.bonkT = -1; this.armR.rotation.x = 0; }
    }

    // invulnerability blink
    if (this.invuln > 0) {
      this.invuln -= dt;
      this.rig.visible = Math.floor(t * 14) % 2 === 0;
      if (this.invuln <= 0) this.rig.visible = true;
    }

    this.shadow.visible = true;
    this.shadow.position.set(this.pos.x, 0.02, this.pos.z);
    return events;
  }

  // point just in front of the hero, for bonk range checks
  frontPoint(dist = 1.0) {
    return new THREE.Vector3(
      this.pos.x + Math.sin(this.facing) * dist, 0,
      this.pos.z + Math.cos(this.facing) * dist);
  }
}
