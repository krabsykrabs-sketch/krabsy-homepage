import * as THREE from 'three';

export const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
// frame-rate independent exponential smoothing
export const damp = (a, b, l, dt) => lerp(a, b, 1 - Math.exp(-l * dt));

export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// smooth an angle toward a target along the shortest arc
export function angleDamp(a, b, l, dt) {
  const d = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return a + d * (1 - Math.exp(-l * dt));
}

export function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

// Project box UVs from world position so brick/tile scale is uniform across
// differently-sized boxes (call AFTER applyMatrix4 so coords are world-space).
export function triplanarUV(geo, s = 0.45) {
  const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i)), nz = Math.abs(n.getZ(i));
    let u, v;
    if (ny >= nx && ny >= nz) { u = p.getX(i); v = p.getZ(i); }
    else if (nx >= nz) { u = p.getZ(i); v = p.getY(i); }
    else { u = p.getX(i); v = p.getY(i); }
    uv.setXY(i, u * s, v * s);
  }
  uv.needsUpdate = true;
  return geo;
}

// First hit parameter f in [0,1] of a 2D segment against an AABB, or Infinity (slab method)
export function segAABB(x0, z0, x1, z1, c) {
  const dx = x1 - x0, dz = z1 - z0;
  let tmin = 0, tmax = 1;
  for (const [p, d, mn, mx] of [[x0, dx, c.minX, c.maxX], [z0, dz, c.minZ, c.maxZ]]) {
    if (Math.abs(d) < 1e-9) { if (p < mn || p > mx) return Infinity; continue; }
    let t1 = (mn - p) / d, t2 = (mx - p) / d;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    if (tmin > tmax) return Infinity;
  }
  return tmin;
}

// Resolve a circle (x,z,r) against a list of AABB colliders {minX,maxX,minZ,maxZ,off?}
export function collideCircle(pos, r, colliders) {
  for (const c of colliders) {
    if (c.off) continue;
    const nx = clamp(pos.x, c.minX, c.maxX);
    const nz = clamp(pos.z, c.minZ, c.maxZ);
    const dx = pos.x - nx, dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 < 1e-8) {
        // center is inside the box — push out along the cheapest axis
        const pl = pos.x - (c.minX - r), pr = (c.maxX + r) - pos.x;
        const pd = pos.z - (c.minZ - r), pu = (c.maxZ + r) - pos.z;
        const m = Math.min(pl, pr, pd, pu);
        if (m === pl) pos.x = c.minX - r;
        else if (m === pr) pos.x = c.maxX + r;
        else if (m === pd) pos.z = c.minZ - r;
        else pos.z = c.maxZ + r;
      } else {
        const d = Math.sqrt(d2);
        pos.x = nx + (dx / d) * r;
        pos.z = nz + (dz / d) * r;
      }
    }
  }
}
