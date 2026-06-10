import * as THREE from 'three';
import { loadModel } from './assets.js';

const DUST_URL  = './assets/models/dust.glb';
const BRICK_URL = './assets/models/brick-particle.glb';

let dustTpl = null;
let brickTpl = null;

export async function preloadParticles() {
  // loadModel returns a clone; keep it as the template, future spawns clone the template.
  dustTpl  = await loadModel(DUST_URL);
  brickTpl = await loadModel(BRICK_URL);
}

const GRAVITY = 14;       // particle gravity (visual; not Rapier)
const TTL     = 1.0;      // seconds before despawn

// Fall-poof droplet template — built lazily on the first fall so we don't pay the cost in
// tutorial levels that never trigger one. Soft white to read as a little cloud burst when the
// player drops through the cloud sea. Geometry + material are shared across all spawned droplets
// (clone-the-mesh pattern, matching the dust/brick puff approach), so a 16-particle poof adds 16
// cheap meshes that share one buffer and one material.
let splashTpl = null;
function getSplashTemplate() {
  if (!splashTpl) {
    const geo = new THREE.SphereGeometry(0.08, 6, 4);
    const mat = new THREE.MeshBasicMaterial({ color: 0xeaf2ff, transparent: true, opacity: 0.9 });
    splashTpl = new THREE.Mesh(geo, mat);
  }
  return splashTpl;
}

export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
  }

  // Spawn a small puff of mixed dust + brick particles at a world position.
  spawnPuff(pos, count = 5) {
    if (!dustTpl || !brickTpl) return;
    for (let i = 0; i < count; i++) {
      const useBrick = Math.random() < 0.5;
      const mesh = (useBrick ? brickTpl : dustTpl).clone(true);
      mesh.position.set(pos.x, pos.y + 0.2, pos.z);
      mesh.scale.setScalar(0.6 + Math.random() * 0.5);

      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 2.5;
      const vel = new THREE.Vector3(
        Math.cos(angle) * speed,
        2.0 + Math.random() * 2.0,
        Math.sin(angle) * speed,
      );
      const spin = new THREE.Vector3(
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 8,
      );

      this.scene.add(mesh);
      this.list.push({ mesh, vel, spin, life: TTL });
    }
  }

  // Water splash — short, light-cyan droplet fountain. Same physics path as spawnPuff
  // (push into this.list, gravity + ttl in update), so the existing despawn loop tears
  // them down without any extra bookkeeping. Caller passes the water-surface position
  // (XZ from the player, Y = water plane); particles spread out from there.
  spawnSplash(pos, count = 16) {
    const tpl = getSplashTemplate();
    for (let i = 0; i < count; i++) {
      const mesh = tpl.clone();
      mesh.scale.setScalar(0.7 + Math.random() * 0.8);
      mesh.position.set(
        pos.x + (Math.random() - 0.5) * 0.4,
        pos.y + 0.05,
        pos.z + (Math.random() - 0.5) * 0.4,
      );
      const angle = Math.random() * Math.PI * 2;
      const radial = 1.8 + Math.random() * 2.2;
      const vel = new THREE.Vector3(
        Math.cos(angle) * radial,
        3.2 + Math.random() * 1.8,
        Math.sin(angle) * radial,
      );
      const spin = new THREE.Vector3();
      this.scene.add(mesh);
      this.list.push({ mesh, vel, spin, life: 0.8 });
    }
  }

  update(dt) {
    const remaining = [];
    for (const p of this.list) {
      p.mesh.position.x += p.vel.x * dt;
      p.mesh.position.y += p.vel.y * dt;
      p.mesh.position.z += p.vel.z * dt;
      p.vel.y -= GRAVITY * dt;
      p.mesh.rotation.x += p.spin.x * dt;
      p.mesh.rotation.y += p.spin.y * dt;
      p.mesh.rotation.z += p.spin.z * dt;
      p.life -= dt;
      if (p.life > 0) remaining.push(p);
      else this.scene.remove(p.mesh);
    }
    this.list = remaining;
  }

  clear() {
    for (const p of this.list) this.scene.remove(p.mesh);
    this.list = [];
  }
}
