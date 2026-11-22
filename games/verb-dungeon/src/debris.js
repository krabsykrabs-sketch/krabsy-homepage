// A crate or barrel smashed by the hero (play-test note 9): planks or staves fly out,
// bounce on the floor and shrink away. Cheap: one pool of meshes on a few shared
// geometries and three shared materials, no lights; pieces are reused smash after smash.
//   smash(x, z, kind, top)   kind 'barrel' | 'crate', top = the prop's height
//   updateDebris(dt)          every frame (game clock)
import * as THREE from 'three';

const POOL = 28, PER = 11, LIFE = 1.15, SHRINK = 0.4, GRAV = 19;
const mats = {
  wood: new THREE.MeshLambertMaterial({ color: 0xb98049 }),
  dark: new THREE.MeshLambertMaterial({ color: 0x7c5230 }),
  iron: new THREE.MeshLambertMaterial({ color: 0x555a70 }),
};
const geos = {
  plank: new THREE.BoxGeometry(0.95, 0.09, 0.24),
  short: new THREE.BoxGeometry(0.5, 0.08, 0.2),
  stave: new THREE.BoxGeometry(0.16, 0.85, 0.07),
  hoop: new THREE.TorusGeometry(0.42, 0.04, 4, 14),
};
const pieces = [];
export function initDebris(scene) {
  for (let i = 0; i < POOL; i++) {
    const m = new THREE.Mesh(geos.plank, mats.wood);
    m.visible = false; m.castShadow = true;
    scene.add(m);
    pieces.push({ m, t: LIFE, v: new THREE.Vector3(), w: new THREE.Vector3(), s: 1 });
  }
}
let next = 0;
export function smash(x, z, kind = 'crate', top = 1.2) {
  const barrel = kind === 'barrel';
  for (let i = 0; i < PER; i++) {
    const p = pieces[next]; next = (next + 1) % POOL;
    const hoop = barrel && i < 2;
    p.m.geometry = hoop ? geos.hoop : barrel ? geos.stave : i % 3 === 2 ? geos.short : geos.plank;
    p.m.material = hoop ? mats.iron : i % 2 ? mats.dark : mats.wood;
    const a = (i / PER) * Math.PI * 2 + Math.random() * 0.5, out = 2.2 + Math.random() * 2.4;
    p.m.position.set(x + Math.cos(a) * 0.35, 0.25 + Math.random() * top * 0.8, z + Math.sin(a) * 0.35);
    p.m.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    p.v.set(Math.cos(a) * out, 4.5 + Math.random() * 3.5, Math.sin(a) * out);
    p.w.set((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 16);
    p.s = 0.85 + Math.random() * 0.4;
    p.m.scale.setScalar(p.s);
    p.t = 0; p.m.visible = true;
  }
}
export function updateDebris(dt) {
  for (const p of pieces) {
    if (p.t >= LIFE) continue;
    p.t += dt;
    const o = p.m.position;
    p.v.y -= GRAV * dt;
    o.addScaledVector(p.v, dt);
    p.m.rotation.x += p.w.x * dt; p.m.rotation.y += p.w.y * dt; p.m.rotation.z += p.w.z * dt;
    if (o.y < 0.08) { // bounce, then slide to a stop
      o.y = 0.08; p.v.y = Math.abs(p.v.y) * 0.32; p.v.x *= 0.55; p.v.z *= 0.55; p.w.multiplyScalar(0.5);
    }
    const k = (LIFE - p.t) / SHRINK; // shrink away at the end
    p.m.scale.setScalar(p.s * Math.max(0, Math.min(1, k)));
    if (p.t >= LIFE) p.m.visible = false;
  }
}
export function clearDebris() { for (const p of pieces) { p.t = LIFE; p.m.visible = false; } }
export const debrisLive = () => pieces.filter((p) => p.t < LIFE).length;
