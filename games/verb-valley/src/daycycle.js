// The day/night showcase. One shadow-casting sun that arcs across the sky,
// keyframed sky/fog/light colours, golden-hour dusk, warm windows after dark,
// fireflies, a star field, and a sleepy vignette late at night. Everything is
// derived from state.timeMin so the ?qa= frozen scenes are exact.

import * as THREE from 'three';
import { TIME } from './config.js';
import { setNight } from './audio.js';
import { makeDotTexture } from './world.js';

const C = (h) => new THREE.Color(h);
const lerpC = (a, b, t) => a.clone().lerp(b, t);

// Keyframes across the 24h clock (minutes). Interpolated each frame.
const KEYS = [
  { m: 0,    sky: 0x0b1026, fog: 0x0b1026, sun: 0x3a4a7a, si: 0.18, amb: 0x35406e, ai: 0.38 },
  { m: 300,  sky: 0x0d1430, fog: 0x0d1430, sun: 0x3a4a7a, si: 0.18, amb: 0x35406e, ai: 0.38 },
  { m: 360,  sky: 0xe6a878, fog: 0xeec0a0, sun: 0xffcaa0, si: 0.55, amb: 0x8a7892, ai: 0.5 },
  { m: 420,  sky: 0xf3c79a, fog: 0xf0d2b0, sun: 0xffe0b0, si: 0.85, amb: 0x9a8aa0, ai: 0.55 },
  { m: 540,  sky: 0x9fd6f2, fog: 0xc8e8f6, sun: 0xfff4d8, si: 1.05, amb: 0xa6c8da, ai: 0.62 },
  { m: 780,  sky: 0x86c6f4, fog: 0xd8eefb, sun: 0xffffff, si: 1.25, amb: 0xc0d8e8, ai: 0.70 },
  { m: 1020, sky: 0xa6cfee, fog: 0xe8dcc2, sun: 0xffe8bc, si: 1.05, amb: 0xc6c2a6, ai: 0.62 },
  { m: 1140, sky: 0xf0a85e, fog: 0xf2b985, sun: 0xff9c4e, si: 1.1,  amb: 0xcc9a85, ai: 0.6 },
  { m: 1200, sky: 0xff7e4d, fog: 0xff9a64, sun: 0xff6a38, si: 0.85, amb: 0xb07a86, ai: 0.52 },
  { m: 1260, sky: 0x6a4274, fog: 0x6e4a80, sun: 0x9a5e94, si: 0.34, amb: 0x5e4e7e, ai: 0.42 },
  { m: 1320, sky: 0x15193a, fog: 0x15193a, sun: 0x3a4a7a, si: 0.2,  amb: 0x3a456e, ai: 0.4 },
  { m: 1440, sky: 0x0b1026, fog: 0x0b1026, sun: 0x3a4a7a, si: 0.18, amb: 0x35406e, ai: 0.38 },
];

function sampleKeys(min) {
  let a = KEYS[0], b = KEYS[KEYS.length - 1];
  for (let i = 0; i < KEYS.length - 1; i++) {
    if (min >= KEYS[i].m && min <= KEYS[i + 1].m) { a = KEYS[i]; b = KEYS[i + 1]; break; }
  }
  const t = b.m === a.m ? 0 : (min - a.m) / (b.m - a.m);
  return {
    sky: lerpC(C(a.sky), C(b.sky), t),
    fog: lerpC(C(a.fog), C(b.fog), t),
    sun: lerpC(C(a.sun), C(b.sun), t),
    si: a.si + (b.si - a.si) * t,
    amb: lerpC(C(a.amb), C(b.amb), t),
    ai: a.ai + (b.ai - a.ai) * t,
  };
}

export function createDayCycle(scene, renderer, refs, vignetteEl) {
  scene.fog = new THREE.Fog(0x88c6f4, 22, 64);
  scene.background = C(0x88c6f4);

  const sun = new THREE.DirectionalLight(0xffffff, 1.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 90;
  const s = 34;
  sun.shadow.camera.left = -s; sun.shadow.camera.right = s;
  sun.shadow.camera.top = s; sun.shadow.camera.bottom = -s;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  scene.add(sun.target);

  const ambient = new THREE.HemisphereLight(0xcfe6ff, 0x44623a, 0.6);
  scene.add(ambient);

  // ── Stars ──
  const starGeo = new THREE.BufferGeometry();
  const starN = 320, sp = new Float32Array(starN * 3);
  for (let i = 0; i < starN; i++) {
    const a = Math.random() * Math.PI * 2, el = Math.random() * 0.5 + 0.15, r = 70;
    sp[i * 3] = Math.cos(a) * Math.cos(el) * r;
    sp[i * 3 + 1] = Math.sin(el) * r + 8;
    sp[i * 3 + 2] = Math.sin(a) * Math.cos(el) * r;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.7, map: makeDotTexture(), transparent: true, opacity: 0, depthWrite: false }));
  scene.add(stars);

  // ── Fireflies ──
  const flyN = 38;
  const flyGeo = new THREE.BufferGeometry();
  const fp = new Float32Array(flyN * 3);
  const flyBase = [];
  for (let i = 0; i < flyN; i++) {
    const x = (Math.random() - 0.5) * 36, z = (Math.random() - 0.5) * 30 + 2;
    flyBase.push({ x, z, y: 0.7 + Math.random() * 1.6, ph: Math.random() * 6.28, sp: 0.4 + Math.random() * 0.6 });
    fp[i * 3] = x; fp[i * 3 + 1] = 1; fp[i * 3 + 2] = z;
  }
  flyGeo.setAttribute('position', new THREE.BufferAttribute(fp, 3));
  const fireflies = new THREE.Points(flyGeo, new THREE.PointsMaterial({ color: 0xfff3a0, size: 0.45, map: makeDotTexture(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  scene.add(fireflies);

  // ── Sun/moon disc that follows the light ──
  const disc = new THREE.Mesh(new THREE.SphereGeometry(2.2, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xfff2c0, fog: false }));
  scene.add(disc);

  let clock = 0;

  function darkness(min) {
    // 0 in full day, 1 deep night. Night begins around dusk.
    if (min >= TIME.WAKE && min <= TIME.DUSK) return 0;
    if (min < TIME.WAKE) return min < 300 ? 1 : (TIME.WAKE - min) / 60;
    // dusk → night ramp 1140..1320
    if (min <= 1320) return Math.min(1, (min - TIME.DUSK) / 180);
    return 1;
  }

  function update(state, dt) {
    clock += dt;
    const min = state.timeMin;
    const k = sampleKeys(min);

    scene.background.copy(k.sky);
    scene.fog.color.copy(k.fog);
    sun.color.copy(k.sun);
    sun.intensity = k.si;
    ambient.color.copy(k.amb.clone().lerp(C(0xcfe6ff), 0.4));
    ambient.intensity = k.ai;

    // Sun arc: east at 06:00 → overhead ~13:00 → west at 20:00; low + dim at night.
    const frac = Math.max(0, Math.min(1, (min - TIME.WAKE) / (1200 - TIME.WAKE)));
    const ang = frac * Math.PI;
    const sx = Math.cos(ang) * 30;
    const sy = Math.max(5, Math.sin(ang) * 30);
    const sz = -12;
    sun.position.set(sx, sy, sz);
    sun.target.position.set(0, 0, 0);
    disc.position.set(sx, sy, sz);
    const night = darkness(min);
    disc.material.color.copy(night > 0.5 ? C(0xdfe6ff) : k.sun.clone().lerp(C(0xffffff), 0.3));
    disc.visible = sy > 2.5;

    // Stars + fireflies fade with night.
    stars.material.opacity = night * 0.9;
    fireflies.material.opacity = night * 0.85;
    const fa = flyGeo.attributes.position.array;
    for (let i = 0; i < flyN; i++) {
      const b = flyBase[i];
      fa[i * 3] = b.x + Math.sin(clock * b.sp + b.ph) * 1.2;
      fa[i * 3 + 1] = b.y + Math.sin(clock * b.sp * 1.7 + b.ph) * 0.5;
      fa[i * 3 + 2] = b.z + Math.cos(clock * b.sp * 0.8 + b.ph) * 1.2;
    }
    flyGeo.attributes.position.needsUpdate = true;

    // Warm windows after dusk.
    const glow = Math.max(night, min >= 1080 ? (min - 1080) / 90 : 0);
    for (const w of refs.windows) w.emissiveIntensity = glow * 0.95;

    // Sleepy vignette grows late at night.
    if (vignetteEl) {
      let v = 0;
      if (min >= 1320) v = Math.min(0.55, (min - 1320) / 120 * 0.55);
      else if (min < 330) v = 0.3;
      vignetteEl.style.opacity = v;
    }

    // Morning fog: thicker right at wake, lifts by 08:00.
    const fogNear = min < TIME.SCHOOL_BELL ? 10 + (min - TIME.WAKE) / 120 * 12 : 22;
    scene.fog.near = night > 0.5 ? 14 : fogNear;
    scene.fog.far = night > 0.5 ? 50 : 64;

    setNight(night);
  }

  // Jump straight to a clock value (QA frozen scenes + load).
  function applyInstant(state) { update(state, 0); }

  return { update, applyInstant, sun, ambient };
}
