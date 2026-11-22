// The one marker for "you can use this" (play-test note 6): a soft teal ring on the
// floor that slowly pulses, and a few sparkles rising from it. Things you can use move
// or glow; decoration never does. Every usable thing gets it (coin stacks, the key on
// the floor, search props, a closed chest, the boss stone) and loses it when used up.
//   const m = markUsable(obj, { radius, top });   // obj: Object3D (or {x, z}); top = its height
//   unmark(m);                                     // used up (null is fine)
//   m.off = true;                                  // hidden for a moment (a coin in flight)
// Cheap: all rings are one InstancedMesh and all sparkles one Points object, so the
// marker costs two draw calls in total, however many things are marked. No lights.
import * as THREE from 'three';

const CAP = 24;                    // marked things at once (a treasure room has 6 coins + a chest)
const SPARKS = 3;                  // sparkles per marker
const COLOR = 0x2ee6c0;            // site teal: reads against the warm, torch-lit floor
const RING_Y = 0.15;               // above the floor tiles' relief
export const MARK = { color: COLOR };

const ringTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,.10)');
  grad.addColorStop(0.5, 'rgba(255,255,255,.22)');
  grad.addColorStop(0.72, 'rgba(255,255,255,1)');   // the ring
  grad.addColorStop(0.8, 'rgba(255,255,255,.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const sparkTex = (() => { // a four-point twinkle
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.3, 'rgba(255,255,255,.6)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.beginPath();
  for (let i = 0; i < 8; i++) { // long points on the axes, short in between
    const a = i * Math.PI / 4, r = i % 2 ? 7 : 31;
    g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r);
  }
  g.closePath(); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();

const ringGeo = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
const ringMat = new THREE.MeshBasicMaterial({ map: ringTex, color: COLOR, transparent: true,
  blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
const rings = new THREE.InstancedMesh(ringGeo, ringMat, CAP);
rings.frustumCulled = false; rings.renderOrder = 2; rings.count = 0;

const sparkGeo = new THREE.BufferGeometry();
sparkGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(CAP * SPARKS * 3), 3));
sparkGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(CAP * SPARKS * 3), 3));
sparkGeo.setDrawRange(0, 0);
const sparkMat = new THREE.PointsMaterial({ map: sparkTex, size: 0.62, vertexColors: true, transparent: true,
  blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
const sparks = new THREE.Points(sparkGeo, sparkMat);
sparks.frustumCulled = false; sparks.renderOrder = 3;

const marks = new Set();
let seedN = 0;
export function initMarks(scene) { scene.add(rings, sparks); }
export function markUsable(target, { radius = 1, top = 1 } = {}) {
  const m = { target, radius, top, seed: (seedN++ * 0.618) % 1, off: false };
  marks.add(m);
  return m;
}
export function unmark(m) { if (m) marks.delete(m); return null; }
export function clearMarks() { marks.clear(); }
export const markCount = () => marks.size;

const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
const TEAL = new THREE.Color(COLOR), WHITE = new THREE.Color(0xffffff), _c = new THREE.Color();
export function updateMarks(time) {
  ringMat.opacity = 0.75 + 0.25 * Math.sin(time * 2.6); // the slow pulse, the same on all
  const pos = sparkGeo.attributes.position, col = sparkGeo.attributes.color;
  let n = 0;
  for (const m of marks) {
    if (m.off || n >= CAP) continue;
    const t = m.target;
    if (t.isObject3D) t.getWorldPosition(_p); else _p.set(t.x, 0, t.z);
    const x = _p.x, z = _p.z, r = m.radius;
    const breathe = 1 + 0.07 * Math.sin(time * 2.6 + m.seed * 6.28);
    _m.compose(_s.set(x, RING_Y, z), _q, _p.set(r * breathe, 1, r * breathe));
    rings.setMatrixAt(n, _m);
    for (let j = 0; j < SPARKS; j++) { // rise from the ring to a bit above the thing, then fade
      const k = n * SPARKS + j;
      const ph = (time * 0.42 + m.seed + j / SPARKS) % 1;
      const a = m.seed * 6.28 + j * 2.09 + ph * 1.2;
      pos.setXYZ(k, x + Math.cos(a) * r * 0.7, 0.2 + ph * (m.top + 0.5), z + Math.sin(a) * r * 0.55);
      const b = Math.sin(ph * Math.PI) ** 2;
      _c.copy(TEAL).lerp(WHITE, 0.6).multiplyScalar(b);
      col.setXYZ(k, _c.r, _c.g, _c.b);
    }
    n += 1;
  }
  rings.count = n;
  rings.instanceMatrix.needsUpdate = true;
  rings.visible = sparks.visible = n > 0;
  sparkGeo.setDrawRange(0, n * SPARKS);
  pos.needsUpdate = true; col.needsUpdate = true;
}
