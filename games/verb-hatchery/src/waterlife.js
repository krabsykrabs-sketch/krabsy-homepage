// Water life (world proposal item 14): splash rings where the player wades (sea, pond,
// stream) and fish that jump out of the water, in the bay and wherever the player is
// near deep water. Two InstancedMeshes: the rings (one draw call while a ring lives)
// and the fish (one draw call while a fish is in the air); nothing is drawn otherwise.
// The sailing boats on the horizon are in decor.js (sailboats).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { paint, paintMat } from './merge.js';
import { height, groundH, POND, pondD, streamAt, streamLevel, BAY, PIER, pierLocal, onBridge } from './world.js';

const RINGS = 28, FISH = 4;

// The water's surface (y) at a spot, or null where there is none: the sea (it laps up
// and down), the pond, the stream.
export function waterLevel(world, x, z) {
  const g = groundH(x, z), sea = world.water.position.y;
  if (pondD(x, z) < POND.r && g < POND.water) return POND.water;
  const [sd, st] = streamAt(x, z);
  if (sd < 5.2) { const lv = streamLevel(st); if (g < lv) return Math.max(lv, sea); } // (near its mouth the stream's bed lies below the sea's level)
  return g < sea ? sea : null;
}

function ringTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.6, 'rgba(255,255,255,0.05)'); g.addColorStop(0.8, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.9, 'rgba(255,255,255,0.75)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// A fish, nose towards +x, about 1 m long: blue-grey back, silver belly, tail and back fin.
function fishGeo() {
  const body = paint(new THREE.SphereGeometry(1, 8, 6).scale(0.42, 0.17, 0.1), 0xe9f3f8);
  const p = body.attributes.position, c = body.attributes.color, back = new THREE.Color(0x4f86b5);
  for (let i = 0; i < p.count; i++) if (p.getY(i) > 0.02) c.setXYZ(i, back.r, back.g, back.b);
  const tri = (pts, hex) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); return paint(g, hex); };
  return mergeGeometries([body,
    tri([-0.34, 0, 0, -0.62, 0.19, 0, -0.56, 0, 0, -0.34, 0, 0, -0.56, 0, 0, -0.62, -0.19, 0], 0x3f74a6),
    tri([0.12, 0.15, 0, -0.14, 0.15, 0, -0.08, 0.28, 0], 0x3f74a6)]);
}

export class WaterLife {
  constructor(world) {
    this.world = world;
    // ── rings ──
    const rm = new THREE.MeshBasicMaterial({ map: ringTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    const ri = this.ringMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), rm, RINGS);
    ri.count = 0; ri.frustumCulled = false; ri.renderOrder = 3; // after the water
    ri.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    ri.setColorAt(0, new THREE.Color(1, 1, 1)); ri.instanceColor.setUsage(THREE.DynamicDrawUsage);
    world.scene.add(ri);
    this.rings = [];
    // ── fish ──
    const fi = this.fishMesh = new THREE.InstancedMesh(fishGeo(), paintMat(), FISH);
    fi.count = 0; fi.frustumCulled = false; fi.castShadow = false;
    fi.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    fi.setColorAt(0, new THREE.Color(1, 1, 1)); fi.instanceColor.setUsage(THREE.DynamicDrawUsage);
    world.scene.add(fi);
    this.fish = []; this.nextFish = 3; this.jumps = 0;
    this.last = new THREE.Vector3(1e9, 0, 0); this.lastT = 0; this.wasAir = false;
    this._o = new THREE.Object3D(); this._o.rotation.order = 'YZX'; this._c = new THREE.Color();
  }
  // A ring on the water at (x, z): grows to radius r in `dur` seconds and fades. a = strength.
  splash(x, z, r = 1, dur = 0.9, a = 1, delay = 0) {
    if (this.rings.length >= RINGS) this.rings.shift();
    this.rings.push({ x, z, r, dur, a, t: -delay });
  }
  // A spot with deep enough water for a fish, in the bay or near the player.
  _spot(p) {
    const W = this.world, nearBay = Math.hypot(p.x - BAY.x, p.z - BAY.z) < 95;
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * 6.283, inBay = nearBay && Math.random() < 0.65, d = inBay ? Math.sqrt(Math.random()) * 23 : 12 + Math.random() * 34;
      const x = (inBay ? BAY.x : p.x) + Math.cos(a) * d, z = (inBay ? BAY.z : p.z) + Math.sin(a) * d;
      const lv = waterLevel(W, x, z); if (lv === null || onBridge(x, z)) continue;
      const pond = lv === POND.water, depth = lv - groundH(x, z);
      if (depth < (pond ? 0.3 : 0.55) || (!pond && lv !== W.water.position.y)) continue; // (not in the ankle-deep stream)
      const [pa, pb] = pierLocal(x, z); if (pa > -2 && pa < PIER.len + 3 && Math.abs(pb) < 6) continue;
      if (Math.hypot(x - (BAY.x + 24), z - (BAY.z - 26)) < 15) continue;               // the pirate ship
      if (W.nearColliders(x, z).some((c) => Math.hypot(x - c.x, z - c.z) < c.r + 2)) continue; // rocks, the wreck
      return { x, z, lv, pond };
    }
    return null;
  }
  _jump(p) {
    const s = this._spot(p); if (!s) return;
    const n = !s.pond && Math.random() < 0.35 ? 2 + (Math.random() < 0.4 ? 1 : 0) : 1, yaw = Math.random() * 6.283;
    for (let k = 0; k < n && this.fish.length < FISH; k++) {
      const size = (s.pond ? 0.5 : 0.75) + Math.random() * 0.35, h = (s.pond ? 0.55 : 0.9) + Math.random() * 0.6, dist = 1.3 + h * 0.9;
      const x = s.x + (k ? (Math.random() - 0.5) * 2.4 : 0), z = s.z + (k ? (Math.random() - 0.5) * 2.4 : 0);
      const ex = x + Math.cos(yaw) * dist, ez = z + Math.sin(yaw) * dist;
      if (waterLevel(this.world, ex, ez) === null || waterLevel(this.world, x, z) === null) continue;
      this.fish.push({ x, z, ex, ez, yaw, h, size, T: 2 * Math.sqrt(2 * h / 9.8) * 1.15, t: -k * 0.22, warm: Math.random() < 0.3, out: false });
    }
    this.jumps++;
  }
  update(dt, time) {
    const W = this.world, p = W.sun.target.position; // (the sun's target is the player, see world.followSun)
    // ── the player wades: a ring every few steps, a bigger splash when landing in water ──
    const lv = waterLevel(W, p.x, p.z), floor = height(p.x, p.z);
    if (lv !== null && floor < lv - 0.04) {
      const air = p.y > floor + 0.15;
      if (!air) {
        const moved = Math.hypot(p.x - this.last.x, p.z - this.last.z);
        if (this.wasAir) { this.splash(p.x, p.z, 1.5, 0.9, 1); this.splash(p.x, p.z, 1.0, 0.8, 0.8, 0.12); this.last.copy(p); this.lastT = time; }
        else if (moved > 0.62) { this.splash(p.x, p.z, 0.95, 0.85, 0.85); this.last.copy(p); this.lastT = time; }
        else if (time - this.lastT > 1.7) { this.splash(p.x, p.z, 0.65, 1.1, 0.4); this.lastT = time; } // standing still: a faint ripple
      }
      this.wasAir = air;
    } else this.wasAir = false;
    // ── rings ──
    const ri = this.ringMesh, o = this._o, c = this._c;
    let n = 0;
    o.rotation.set(0, 0, 0);
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i]; r.t += dt;
      if (r.t >= r.dur) { this.rings.splice(i, 1); continue; }
      if (r.t < 0) continue;
      const k = r.t / r.dur, y = waterLevel(W, r.x, r.z);
      if (y === null) continue;
      o.position.set(r.x, y + 0.03, r.z); o.scale.setScalar(0.2 + (r.r - 0.2) * (1 - (1 - k) * (1 - k))); o.updateMatrix();
      ri.setMatrixAt(n, o.matrix); ri.setColorAt(n, c.setScalar(r.a * Math.pow(1 - k, 1.4))); n++;
    }
    ri.count = n; if (n) { ri.instanceMatrix.needsUpdate = true; ri.instanceColor.needsUpdate = true; }
    // ── fish ──
    this.nextFish -= dt;
    if (this.nextFish <= 0) { this.nextFish = 2.5 + Math.random() * 4.5; this._jump(p); }
    const fi = this.fishMesh; n = 0;
    for (let i = this.fish.length - 1; i >= 0; i--) {
      const f = this.fish[i]; f.t += dt;
      if (f.t < 0) continue;
      if (!f.out) { f.out = true; this.splash(f.x, f.z, 0.9 * f.size + 0.3, 0.8, 0.9); }
      if (f.t >= f.T) { this.splash(f.ex, f.ez, 1.2 * f.size + 0.4, 1.0, 1); this.splash(f.ex, f.ez, 0.8 * f.size, 0.8, 0.6, 0.15); this.fish.splice(i, 1); continue; }
      const s = f.t / f.T, y0 = waterLevel(W, f.x, f.z) ?? W.water.position.y;
      o.position.set(f.x + (f.ex - f.x) * s, y0 - 0.12 + 4 * f.h * s * (1 - s), f.z + (f.ez - f.z) * s);
      o.rotation.set(0, -f.yaw, Math.atan2(4 * f.h * (1 - 2 * s), Math.hypot(f.ex - f.x, f.ez - f.z)));
      o.scale.setScalar(f.size); o.updateMatrix();
      fi.setMatrixAt(n, o.matrix); fi.setColorAt(n, f.warm ? c.setRGB(1.25, 0.72, 0.42) : c.setScalar(1)); n++;
    }
    fi.count = n; if (n) { fi.instanceMatrix.needsUpdate = true; fi.instanceColor.needsUpdate = true; }
  }
}
