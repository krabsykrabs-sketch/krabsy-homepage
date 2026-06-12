// The chef: KayKit Knight + Rig_Medium animation clips, WASD movement with
// tile collision, one-item carry slot rendered over the head.
import * as THREE from 'three';
import { TILE, loadChefAssets, cloneChef } from './models.js';
import { audio } from './audio.js';

const SPEED = 7.2;          // world units/s (tile = 2)
const RADIUS = 0.42;
const TURN_LERP = 18;

let assets = null;          // shared {charScene, clips}

export async function preloadChef() {
  if (!assets) assets = await loadChefAssets();
}

export class Chef {
  constructor(world) {
    this.world = world;
    this.obj = new THREE.Group();
    this.body = cloneChef(assets.charScene);
    this.body.scale.setScalar(1.15);
    this.obj.add(this.body);

    this.mixer = new THREE.AnimationMixer(this.body);
    this.actions = {};
    for (const name of ['Idle_A', 'Running_A', 'Chopping', 'PickUp', 'Holding_B']) {
      const clip = assets.clips[name];
      if (clip) this.actions[name] = this.mixer.clipAction(clip);
    }
    this.current = null;
    this.play('Idle_A');

    // carry anchor: in front of the body at chest height (not overhead)
    this.carryAnchor = new THREE.Group();
    this.carryAnchor.position.set(0, 1.16, 0.66);
    this.obj.add(this.carryAnchor);
    this.carried = null;          // logical item
    this.carriedMesh = null;

    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.facing = new THREE.Vector2(0, 1);   // grid-space dir (x, z)
    this.heading = 0;
    this.working = false;          // chopping at a board this frame
    this.bobT = 0;
    this.squash = 0;               // squash impulse timer
    this.frozen = false;
  }

  play(name, fade = 0.12) {
    const next = this.actions[name];
    if (!next || this.current === next) return;
    next.reset().fadeIn(fade).play();
    if (this.current) this.current.fadeOut(fade);
    this.current = next;
  }

  setCarried(item, mesh) {
    if (this.carriedMesh) this.carryAnchor.remove(this.carriedMesh);
    this.carried = item;
    this.carriedMesh = mesh || null;
    if (mesh) {
      mesh.position.set(0, 0, 0);
      this.carryAnchor.add(mesh);
    }
    this.squash = 0.18;
    if (item) audio.pickup(); else audio.putdown();
  }

  /** Tile the chef is facing (for E / Space targeting). */
  targetTile() {
    const gx = (this.pos.x + this.facing.x * TILE * 0.72) / TILE + this.world.offX;
    const gz = (this.pos.z + this.facing.y * TILE * 0.72) / TILE + this.world.offZ;
    return { col: Math.round(gx), row: Math.round(gz) };
  }

  update(dt, input, fx) {
    this.mixer.update(dt);
    if (this.frozen) { this.play('Idle_A'); return; }

    let ix = input.x, iz = input.z;
    const mag = Math.hypot(ix, iz);
    if (mag > 0) { ix /= mag; iz /= mag; }

    if (this.working) {
      this.play('Chopping');
    } else if (mag > 0) {
      this.play('Running_A');
    } else if (this.carried && this.actions['Holding_B']) {
      this.play('Holding_B');
    } else {
      this.play('Idle_A');
    }

    if (mag > 0 && !this.working) {
      // skid detection: sharp reversal at speed
      const sp = this.vel.length();
      if (sp > SPEED * 0.7) {
        const dot = (this.vel.x * ix + this.vel.z * iz) / (sp || 1);
        if (dot < -0.55) {
          fx && fx.dust(this.pos);
          audio.skid();
          this.squash = Math.max(this.squash, 0.14);
        }
      }
      this.facing.set(ix, iz);
      this.vel.set(ix * SPEED, 0, iz * SPEED);

      // axis-separated collision
      this.tryMove(this.vel.x * dt, 0);
      this.tryMove(0, this.vel.z * dt);
      this.bobT += dt * 11;
    } else {
      this.vel.set(0, 0, 0);
      this.bobT = 0;
    }

    // face movement direction
    const targetHeading = Math.atan2(this.facing.x, this.facing.y);
    let d = targetHeading - this.heading;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.heading += d * Math.min(1, TURN_LERP * dt);
    this.obj.rotation.y = this.heading;

    // squash & stretch: run bob + pickup squash
    let sy = 1, sxz = 1;
    if (mag > 0) { sy += Math.sin(this.bobT) * 0.045; sxz = 1 / Math.sqrt(sy); }
    if (this.squash > 0) {
      this.squash -= dt;
      const k = Math.max(0, this.squash) / 0.18;
      sy *= 1 - 0.22 * Math.sin(k * Math.PI);
      sxz *= 1 + 0.13 * Math.sin(k * Math.PI);
    }
    this.body.scale.set(1.15 * sxz, 1.15 * sy, 1.15 * sxz);

    // carried item bob/wobble
    if (this.carriedMesh) {
      this.carriedMesh.position.y = Math.sin(this.bobT * 0.9) * 0.06;
      this.carriedMesh.rotation.z = Math.sin(this.bobT * 0.7) * 0.05;
    }

    this.obj.position.copy(this.pos);
  }

  tryMove(dx, dz) {
    const nx = this.pos.x + dx, nz = this.pos.z + dz;
    if (this.world.areaWalkable(nx, nz, RADIUS)) {
      this.pos.x = nx; this.pos.z = nz;
    }
  }
}
