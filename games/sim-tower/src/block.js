// Ring math for the city block. Sides are indexed 0=S(+z) 1=E(+x) 2=N(−z)
// 3=W(−x); every building faces OUTWARD. Plots are ordered counter-clockwise
// around the ring: ringIndex = side * SIDE_PLOTS + i, neighbours ±1 (wrapping).
//
// "Square path" helpers parametrize an axis-aligned square of half-extent K by
// perimeter distance t ∈ [0, 8K), running S → E → N → W (counter-clockwise,
// matching plot order). Used by both the sidewalk ring (commutes) and the road
// ring (car circuits).
import * as THREE from 'three';

export const SIDE_YAW = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];   // front (0,0,1) → +z,+x,−z,−x

/** Outward unit vector of a side. */
export function outwardOf(side) {
  return [new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0),
          new THREE.Vector3(0, 0, -1), new THREE.Vector3(-1, 0, 0)][side];
}

/** side-local (lateral u, outward v) → world XZ. */
export function sideToWorld(side, u, v) {
  const yaw = SIDE_YAW[side], c = Math.cos(yaw), s = Math.sin(yaw);
  return { x: u * c + v * s, z: -u * s + v * c };
}

// ── square-perimeter parametrization (half-extent K) ──────────────────────
// Corners in walk order: SW'(−K,+K) → SE(+K,+K) → NE(+K,−K) → NW(−K,−K).
const CORNERS = (K) => [[-K, K], [K, K], [K, -K], [K === 0 ? 0 : -K, -K]];

export function squarePerimeter(K) { return 8 * K; }

/** Param t of a point that lies on (or near) the square. */
export function squareT(K, x, z) {
  // clamp to the square first (points are computed on it, this is just safety)
  const cl = (v) => Math.max(-K, Math.min(K, v));
  x = cl(x); z = cl(z);
  const dS = Math.abs(z - K), dE = Math.abs(x - K), dN = Math.abs(z + K), dW = Math.abs(x + K);
  const m = Math.min(dS, dE, dN, dW);
  if (m === dS) return (x + K);                    // south: t 0..2K as x −K→+K
  if (m === dE) return 2 * K + (K - z);            // east:  z +K→−K
  if (m === dN) return 4 * K + (K - x);            // north: x +K→−K
  return 6 * K + (z + K);                          // west:  z −K→+K
}

/** Point at param t on the square (y supplied by caller). */
export function squarePoint(K, t, y = 0) {
  const P = 8 * K;
  t = ((t % P) + P) % P;
  if (t < 2 * K) return new THREE.Vector3(-K + t, y, K);
  if (t < 4 * K) return new THREE.Vector3(K, y, K - (t - 2 * K));
  if (t < 6 * K) return new THREE.Vector3(K - (t - 4 * K), y, -K);
  return new THREE.Vector3(-K, y, -K + (t - 6 * K));
}

/** Walk direction (unit XZ) at param t (counter-clockwise). */
export function squareDir(K, t) {
  const P = 8 * K;
  t = ((t % P) + P) % P;
  if (t < 2 * K) return new THREE.Vector3(1, 0, 0);
  if (t < 4 * K) return new THREE.Vector3(0, 0, -1);
  if (t < 6 * K) return new THREE.Vector3(-1, 0, 0);
  return new THREE.Vector3(0, 0, 1);
}

/**
 * Waypoints along the square from param tA to tB, taking the shorter way
 * round; includes every corner crossed (so walkers turn at corners), excludes
 * the endpoints themselves.
 */
export function squareArc(K, tA, tB, y = 0) {
  const P = 8 * K;
  const fwd = ((tB - tA) % P + P) % P;
  const dir = fwd <= P / 2 ? 1 : -1;
  const dist = dir === 1 ? fwd : P - fwd;
  const cornerTs = [0, 2 * K, 4 * K, 6 * K];
  const pts = [];
  // corners at param c are crossed if c lies strictly between tA and tA+dir*dist
  for (let lap = -1; lap <= 1; lap++) {
    for (const c of cornerTs) {
      const ct = c + lap * P;
      const rel = (ct - tA) * dir;
      if (rel > 0.01 && rel < dist - 0.01) pts.push({ rel, t: ct });
    }
  }
  pts.sort((a, b) => a.rel - b.rel);
  return pts.map((p) => squarePoint(K, p.t, y));
}
