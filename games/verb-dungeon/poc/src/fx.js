import * as THREE from 'three';
import { rand, canvasTexture } from './utils.js';
import { sfx } from './audio.js';

const FOG_COLOR = new THREE.Color(0x0a1426);

function dotTexture() {
  return canvasTexture(64, 64, (g) => {
    const r = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.5, 'rgba(255,255,255,.5)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  });
}

function starTexture() {
  return canvasTexture(64, 64, (g) => {
    g.translate(32, 32); g.fillStyle = '#ffe9a0';
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 11 : 26, a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      g[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
    }
    g.closePath(); g.fill();
  });
}

class PSystem {
  constructor(scene, { count = 400, size = 0.15, additive = true, opacity = 1, tex }) {
    this.count = count;
    this.pos = new Float32Array(count * 3);
    this.col = new Float32Array(count * 3);
    this.vel = new Float32Array(count * 3);
    this.life = new Float32Array(count);
    this.max = new Float32Array(count);
    this.grav = new Float32Array(count);
    this.base = new Float32Array(count * 3);
    this.pos.fill(-999);
    this.head = 0;
    this.additive = additive;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    const mat = new THREE.PointsMaterial({
      size, vertexColors: true, transparent: true, opacity,
      map: tex, alphaTest: 0.01, depthWrite: false, sizeAttenuation: true,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  spawn(p, v, life, color, gravity = 0) {
    const i = this.head++ % this.count, i3 = i * 3;
    this.pos[i3] = p.x; this.pos[i3 + 1] = p.y; this.pos[i3 + 2] = p.z;
    this.vel[i3] = v.x; this.vel[i3 + 1] = v.y; this.vel[i3 + 2] = v.z;
    this.life[i] = this.max[i] = life;
    this.grav[i] = gravity;
    this.base[i3] = color.r; this.base[i3 + 1] = color.g; this.base[i3 + 2] = color.b;
  }

  update(dt) {
    for (let i = 0; i < this.count; i++) {
      if (this.life[i] <= 0) continue;
      const i3 = i * 3;
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.pos[i3 + 1] = -999; continue; }
      this.vel[i3 + 1] -= this.grav[i] * dt;
      this.pos[i3] += this.vel[i3] * dt;
      this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
      this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      const f = this.life[i] / this.max[i];
      if (this.additive) {
        this.col[i3] = this.base[i3] * f;
        this.col[i3 + 1] = this.base[i3 + 1] * f;
        this.col[i3 + 2] = this.base[i3 + 2] * f;
      } else {
        // fade toward fog color so non-additive dust "dissolves" into the gloom
        this.col[i3] = FOG_COLOR.r + (this.base[i3] - FOG_COLOR.r) * f;
        this.col[i3 + 1] = FOG_COLOR.g + (this.base[i3 + 1] - FOG_COLOR.g) * f;
        this.col[i3 + 2] = FOG_COLOR.b + (this.base[i3 + 2] - FOG_COLOR.b) * f;
      }
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}

const _c = new THREE.Color();
const _v = new THREE.Vector3();

class FXManager {
  init(scene) {
    this.scene = scene;
    const dot = dotTexture();
    this.sparkle = new PSystem(scene, { count: 600, size: 0.16, additive: true, tex: dot });
    this.dust = new PSystem(scene, { count: 260, size: 0.4, additive: false, opacity: 0.55, tex: dot });
    this.glitterRegions = [];
    this.glitterT = 0;
    this.dizzies = [];
    this.coins = [];
    this.starTex = starTexture();
    this.shadowTex = canvasTexture(64, 64, (g) => {
      const r = g.createRadialGradient(32, 32, 4, 32, 32, 30);
      r.addColorStop(0, 'rgba(0,0,0,.5)');
      r.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = r; g.fillRect(0, 0, 64, 64);
    });
    this.shadowGeo = new THREE.CircleGeometry(0.55, 20).rotateX(-Math.PI / 2);
    this.shadowMat = new THREE.MeshBasicMaterial({
      map: this.shadowTex, transparent: true, depthWrite: false,
    });
    this._buildCoinPool();
  }

  blobShadow(scale = 1) {
    const m = new THREE.Mesh(this.shadowGeo, this.shadowMat);
    m.scale.setScalar(scale);
    m.position.y = 0.02;
    m.renderOrder = 1;
    this.scene.add(m);
    return m;
  }

  burst(pos, { color = 0xffffff, n = 12, speed = 2.5, life = 0.7, gravity = 0, up = 1 } = {}) {
    _c.set(color);
    for (let i = 0; i < n; i++) {
      const a = rand(Math.PI * 2), r = rand(0.3, 1) * speed;
      this.sparkle.spawn(pos,
        { x: Math.cos(a) * r, y: rand(0.2, 1) * speed * up, z: Math.sin(a) * r },
        life * rand(0.6, 1.2), _c, gravity);
    }
  }

  dustPuff(pos, n = 8, color = 0x6b7aa0) {
    _c.set(color);
    for (let i = 0; i < n; i++) {
      const a = rand(Math.PI * 2);
      this.dust.spawn({ x: pos.x, y: pos.y + 0.08, z: pos.z },
        { x: Math.cos(a) * rand(0.4, 1.4), y: rand(0.4, 1.1), z: Math.sin(a) * rand(0.4, 1.4) },
        rand(0.5, 0.9), _c, 0.6);
    }
  }

  addGlitterRegion(min, max) { this.glitterRegions.push({ min, max }); }

  // five little stars orbiting a defeated/fallen hero's head
  dizzyStars(target, dur = 1.6) {
    const group = new THREE.Group();
    const mat = new THREE.SpriteMaterial({ map: this.starTex, transparent: true, depthWrite: false });
    for (let i = 0; i < 5; i++) {
      const s = new THREE.Sprite(mat);
      s.scale.setScalar(0.28);
      group.add(s);
    }
    group.position.y = 1.5;
    target.add(group);
    this.dizzies.push({ group, target, t: 0, dur });
    sfx.dizzy();
  }

  _buildCoinPool() {
    this.coinGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.05, 12);
    this.coinMat = new THREE.MeshLambertMaterial({ color: 0xffd35e, emissive: 0x6b4a08 });
    for (let i = 0; i < 26; i++) {
      const m = new THREE.Mesh(this.coinGeo, this.coinMat);
      m.visible = false;
      this.scene.add(m);
      this.coins.push({ mesh: m, life: 0, vel: new THREE.Vector3(), spin: 0 });
    }
  }

  coinShower(pos, n = 14) {
    let spawned = 0;
    for (const c of this.coins) {
      if (c.life > 0 || spawned >= n) continue;
      c.mesh.visible = true;
      c.mesh.position.set(pos.x, pos.y, pos.z);
      const a = rand(Math.PI * 2);
      c.vel.set(Math.cos(a) * rand(0.8, 2.6), rand(3.2, 5.4), Math.sin(a) * rand(0.8, 2.6));
      c.spin = rand(6, 14);
      c.life = rand(1.2, 1.7);
      sfx.coin(spawned);
      spawned++;
    }
  }

  update(dt, t) {
    this.sparkle.update(dt);
    this.dust.update(dt);

    // vault glitter: continuous twinkle inside registered regions
    this.glitterT -= dt;
    if (this.glitterT <= 0 && this.glitterRegions.length) {
      this.glitterT = 0.03;
      for (const r of this.glitterRegions) {
        for (let i = 0; i < 2; i++) {
          _c.set(Math.random() < 0.6 ? 0xffe9a0 : 0xfff6dd);
          this.sparkle.spawn(
            { x: rand(r.min.x, r.max.x), y: rand(r.min.y, r.max.y), z: rand(r.min.z, r.max.z) },
            { x: 0, y: rand(0.1, 0.4), z: 0 }, rand(0.5, 1.1), _c, 0);
        }
      }
    }

    for (let i = this.dizzies.length - 1; i >= 0; i--) {
      const d = this.dizzies[i];
      d.t += dt;
      d.group.children.forEach((s, j) => {
        const a = d.t * 6 + (j / 5) * Math.PI * 2;
        s.position.set(Math.cos(a) * 0.42, Math.sin(d.t * 9 + j) * 0.06, Math.sin(a) * 0.42);
      });
      if (d.t >= d.dur) {
        d.target.remove(d.group);
        this.dizzies.splice(i, 1);
      }
    }

    for (const c of this.coins) {
      if (c.life <= 0) continue;
      c.life -= dt;
      if (c.life <= 0) {
        _v.copy(c.mesh.position);
        this.burst(_v, { color: 0xffe9a0, n: 4, speed: 1, life: 0.4 });
        c.mesh.visible = false;
        continue;
      }
      c.vel.y -= 12 * dt;
      c.mesh.position.addScaledVector(c.vel, dt);
      if (c.mesh.position.y < 0.1 && c.vel.y < 0) {
        c.mesh.position.y = 0.1;
        c.vel.y *= -0.45;
        c.vel.x *= 0.7; c.vel.z *= 0.7;
      }
      c.mesh.rotation.x += c.spin * dt;
      c.mesh.rotation.z += c.spin * 0.6 * dt;
    }
  }
}

export const fx = new FXManager();
