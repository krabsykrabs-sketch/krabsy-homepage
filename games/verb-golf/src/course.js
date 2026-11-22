// Builds one hole from its grid (holes.js): the height field the ball rolls on, the wall
// segments it bounces off, the gates, and the meshes (course merged to one mesh, scenery to
// another, the island's rocky underside to a third).
import * as THREE from 'three';
import { Assets } from './assets.js';
import { makePlate } from './labels.js';

export const TILE = 2;          // world units per tile
export const STEP = 0.5;        // height of one level
export const BALL_R = 0.2;
export const CUP_R = 0.4;
const RAIL_IN = 0.09, RAIL_HT = 0.15;   // railing collision: centre line inset, half thickness
const GATE_POST = 0.62;                  // gate opening: |along| < GATE_POST is open

const SLOPES = { '^': 'N', '>': 'E', v: 'S', '<': 'W' };
const SIDES = {          // inward normal and the two corners (tile-local u, v ∈ [−1, 1])
  N: { n: [0, 1], a: [-1, -1], b: [1, -1], dc: 0, dr: -1, opp: 'S' },
  S: { n: [0, -1], a: [-1, 1], b: [1, 1], dc: 0, dr: 1, opp: 'N' },
  E: { n: [-1, 0], a: [1, -1], b: [1, 1], dc: 1, dr: 0, opp: 'W' },
  W: { n: [1, 0], a: [-1, -1], b: [-1, 1], dc: -1, dr: 0, opp: 'E' },
};
const YAW = { N: 0, E: -Math.PI / 2, S: Math.PI, W: Math.PI / 2 }; // model "north" → dir

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

export function buildCourse(def, seed = 1) {
  const rows = def.grid.length, cols = Math.max(...def.grid.map((r) => r.length));
  const x0 = -(cols - 1) * TILE / 2, z0 = -(rows - 1) * TILE / 2;
  const tiles = [];
  let tee = null, cup = null;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ch = def.grid[r][c] || '.';
      const lv = def.h ? Number(def.h[r][c]) || 0 : 0;
      const t = { c, r, ch, lv, x: x0 + c * TILE, z: z0 + r * TILE, kind: 'void' };
      if ('#TH'.includes(ch)) t.kind = 'flat';
      else if (SLOPES[ch]) { t.kind = 'slope'; t.dir = SLOPES[ch]; }
      else if (ch === 'X') t.kind = 'block';
      else if ('trg'.includes(ch)) t.kind = 'decor';
      if (ch === 'T') tee = { x: t.x, z: t.z };
      if (ch === 'H') cup = { x: t.x, z: t.z, y: lv * STEP };
      tiles.push(t);
    }
  }
  const at = (c, r) => (c >= 0 && r >= 0 && c < cols && r < rows ? tiles[r * cols + c] : null);
  const walk = (t) => t && (t.kind === 'flat' || t.kind === 'slope');
  const tileAt = (x, z) => at(Math.floor((x - x0) / TILE + 0.5), Math.floor((z - z0) / TILE + 0.5));

  // Height at tile-local (u, v), both −1…1 (v = −1 is the north edge).
  function hLocal(t, u, v) {
    if (t.kind !== 'slope') return t.lv * STEP;
    const f = { N: (1 - v) / 2, S: (1 + v) / 2, E: (1 + u) / 2, W: (1 - u) / 2 }[t.dir];
    return (t.lv + f) * STEP;
  }
  function heightAt(x, z) {
    const t = tileAt(x, z);
    if (!walk(t)) return 0;
    return hLocal(t, (x - t.x) / (TILE / 2), (z - t.z) / (TILE / 2));
  }
  function gradAt(x, z) { // dh/dx, dh/dz
    const t = tileAt(x, z);
    if (!walk(t) || t.kind !== 'slope') return [0, 0];
    const g = STEP / TILE;
    return { N: [0, -g], S: [0, g], E: [g, 0], W: [-g, 0] }[t.dir];
  }
  const edgeH = (t, s) => [hLocal(t, ...SIDES[s].a), hLocal(t, ...SIDES[s].b)];

  const course = [], scenery = [], segs = [];
  const M = (x, y, z, yaw = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw),
    new THREE.Vector3(sx, sy, sz));

  // Railing along one tile edge: sheared so it follows the edge's height (slope sides).
  function railing(t, s) {
    const S = SIDES[s];
    const n = new THREE.Vector3(S.n[0], 0, S.n[1]);
    const P = (uv) => new THREE.Vector3(t.x + uv[0] * TILE / 2, hLocal(t, uv[0], uv[1]), t.z + uv[1] * TILE / 2);
    let A = P(S.a), B = P(S.b);
    // model x must run along (n.z, −n.x) so that x × y = inward
    if ((B.x - A.x) * n.z + (B.z - A.z) * -n.x < 0) [A, B] = [B, A];
    const mid = A.clone().add(B).multiplyScalar(0.5);
    const X = B.clone().sub(A).multiplyScalar(0.5), Y = new THREE.Vector3(0, 0.5, 0), Z = n.clone().multiplyScalar(0.5);
    const o = mid.clone().addScaledVector(n, 0.49);
    const m = new THREE.Matrix4().makeBasis(X, Y, Z).setPosition(o);
    course.push({ name: 'railing_straight_padded', m });
    segs.push(seg(A.x + n.x * RAIL_IN, A.z + n.z * RAIL_IN, B.x + n.x * RAIL_IN, B.z + n.z * RAIL_IN, RAIL_HT));
  }

  for (const t of tiles) {
    if (t.kind === 'void') continue;
    if (t.kind === 'flat' || t.kind === 'slope') {
      course.push({ name: 'platform_2x2x1', m: M(t.x, t.lv * STEP - 1, t.z) });
      if (t.kind === 'slope') {
        // the model is a 1-high block with a ramp from 1 to 2 on top: scaled so the ramp
        // runs from this level to the next
        course.push({ name: 'platform_slope_2x2x2', m: M(t.x, t.lv * STEP - STEP, t.z, YAW[t.dir], 1, STEP, 1) });
      }
      for (const s of Object.keys(SIDES)) {
        const nb = at(t.c + SIDES[s].dc, t.r + SIDES[s].dr);
        if (walk(nb)) {
          const a = edgeH(t, s), b = edgeH(nb, SIDES[s].opp);
          if (Math.abs(a[0] - b[0]) < 1e-3 && Math.abs(a[1] - b[1]) < 1e-3) continue;
        }
        if (nb && nb.kind === 'block') { // the block's face is the wall
          const S = SIDES[s];
          segs.push(seg(t.x + S.a[0], t.z + S.a[1], t.x + S.b[0], t.z + S.b[1], 0));
          continue;
        }
        railing(t, s);
      }
    } else if (t.kind === 'block') {
      course.push({ name: 'platform_2x2x1', m: M(t.x, t.lv * STEP - 1, t.z) });
      course.push({ name: 'platform_2x2x1', m: M(t.x, t.lv * STEP - 0.2, t.z, 0, 0.96, 1, 0.96) });
    } else if (t.kind === 'decor') {
      const rnd = rng(seed * 131 + t.c * 17 + t.r * 7);
      course.push({ name: 'platform_2x2x1', m: M(t.x, t.lv * STEP - 1.25, t.z) });
      const y = t.lv * STEP - 0.25;
      if (t.ch === 't') {
        scenery.push({ name: rnd() < 0.5 ? 'tree_single_A' : 'tree_single_B', m: M(t.x + (rnd() - 0.5) * 0.4, y, t.z + (rnd() - 0.5) * 0.4, rnd() * 6, 1.7, 1.7, 1.7) });
      } else if (t.ch === 'g') {
        scenery.push({ name: 'tree_single_B', m: M(t.x - 0.35, y, t.z - 0.2, rnd() * 6, 1.1, 1.1, 1.1) });
        scenery.push({ name: 'tree_single_A', m: M(t.x + 0.45, y, t.z + 0.35, rnd() * 6, 0.9, 0.9, 0.9) });
      } else if (t.ch === 'r') {
        scenery.push({ name: 'rock_single_B', m: M(t.x, y, t.z, rnd() * 6, 6, 6, 6) });
        scenery.push({ name: 'rock_single_B', m: M(t.x + 0.55, y, t.z + 0.4, rnd() * 6, 3.5, 3.5, 3.5) });
      }
    }
  }

  // Gates: arches on a tile edge, their posts are walls, their openings triggers.
  const gates = [];
  for (const [gi, g] of (def.gates || []).entries()) {
    const row = { index: gi, dir: g.dir, step: gi, solved: false, openings: [] };
    const span = g.cols || g.rows;
    for (const k of span) {
      let cx, cz, ax, az; // centre and the unit vector along the edge
      if (g.row !== undefined) { cx = x0 + k * TILE; cz = z0 + (g.row - 0.5) * TILE; ax = 1; az = 0; }
      else { cx = x0 + (g.col - 0.5) * TILE; cz = z0 + k * TILE; ax = 0; az = 1; }
      const y = heightAt(cx + (g.row !== undefined ? 0 : 0.1), cz + (g.row !== undefined ? 0.1 : 0));
      // posts
      segs.push(seg(cx - ax, cz - az, cx - ax * GATE_POST, cz - az * GATE_POST, 0.1));
      segs.push(seg(cx + ax * GATE_POST, cz + az * GATE_POST, cx + ax, cz + az, 0.1));
      course.push({ name: 'arch', m: M(cx, y, cz, g.row !== undefined ? 0 : Math.PI / 2, 0.53, 0.5, 0.53) });
      const plate = makePlate();
      plate.sprite.position.set(cx, y + 2.35, cz);
      row.openings.push({ cx, cz, ax, az, y, plate, state: 'open', block: null });
    }
    // the line through the row, and which side is "before"
    const o = row.openings[0];
    row.line = g.row !== undefined ? { axis: 'z', at: o.cz } : { axis: 'x', at: o.cx };
    row.sign = { N: 1, S: -1, E: -1, W: 1 }[g.dir]; // (coord − at) * sign > 0 → before the row
    gates.push(row);
  }

  // Meshes
  const group = new THREE.Group();
  const cm = Assets.merge(course, 'course'); if (cm) group.add(cm);
  const sm = Assets.merge(scenery, 'scenery'); if (sm) group.add(sm);
  group.add(buildKeel(tiles, seed));
  const chev = buildChevrons(tiles, hLocal); if (chev) group.add(chev);
  for (const row of gates) for (const o of row.openings) group.add(o.plate.sprite);

  // Bounds (for the camera), over everything that is not void
  const box = new THREE.Box3();
  for (const t of tiles) {
    if (t.kind === 'void') continue;
    box.expandByPoint(new THREE.Vector3(t.x - 1, t.lv * STEP - 0.4, t.z - 1));
    box.expandByPoint(new THREE.Vector3(t.x + 1, t.lv * STEP + (t.kind === 'decor' ? 1.6 : 0.6), t.z + 1));
  }
  for (const row of gates) for (const o of row.openings) box.expandByPoint(new THREE.Vector3(o.cx, o.y + 2.8, o.cz));
  if (cup) box.expandByPoint(new THREE.Vector3(cup.x, cup.y + 2, cup.z));

  return { def, rows, cols, tiles, tileAt, walkable: (x, z) => walk(tileAt(x, z)), heightAt, gradAt,
    segs, tee, cup, gates, group, box, x0, z0 };
}

export function seg(ax, az, bx, bz, ht) { return { ax, az, bx, bz, ht }; }

// Close one gate opening with a wall segment (wrong gate, or the other gates of a solved row).
export function blockOpening(course, o) {
  if (o.block) return;
  o.block = seg(o.cx - o.ax * GATE_POST, o.cz - o.az * GATE_POST, o.cx + o.ax * GATE_POST, o.cz + o.az * GATE_POST, 0.08);
  course.segs.push(o.block);
}
export const GATE_OPEN = GATE_POST;

// White chevrons on slope tiles, pointing downhill, so a slope reads from the fixed camera.
function buildChevrons(tiles, hLocal) {
  const pts = [[-0.55, -0.25], [0, 0.2], [0.55, -0.25], [0.55, 0.02], [0, 0.47], [-0.55, 0.02]];
  const tris = [[0, 1, 5], [1, 4, 5], [1, 2, 3], [1, 3, 4]];
  const pos = [];
  for (const t of tiles) {
    if (t.kind !== 'slope') continue;
    const d = { N: [0, 1], S: [0, -1], E: [-1, 0], W: [1, 0] }[t.dir]; // downhill, in (u, v)
    const p = [-d[1], d[0]];
    for (const off of [-0.5, 0.3]) {
      const w = pts.map(([sx, sy]) => {
        const u = p[0] * sx + d[0] * (sy + off), v = p[1] * sx + d[1] * (sy + off);
        return [t.x + u, hLocal(t, u, v) + 0.025, t.z + v];
      });
      for (const tr of tris) for (const k of tr) pos.push(...w[k]);
    }
  }
  if (!pos.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.42,
    depthWrite: false, side: THREE.DoubleSide }));
  m.renderOrder = 2;
  return m;
}

// The floating island's rocky underside: one tapered chunk per tile, vertex coloured.
function buildKeel(tiles, seed) {
  const pos = [], col = [];
  const top = new THREE.Color('#7a5338'), bot = new THREE.Color('#4a3a52');
  for (const t of tiles) {
    if (t.kind === 'void') continue;
    const rnd = rng(seed * 977 + t.c * 31 + t.r * 13);
    const y0 = t.lv * STEP - (t.kind === 'decor' ? 1.25 : 1) + 0.02, depth = 1.4 + rnd() * 2.6;
    const y1 = y0 - depth, w0 = 1.0, w1 = 0.25 + rnd() * 0.35;
    const ox = (rnd() - 0.5) * 0.5, oz = (rnd() - 0.5) * 0.5;
    const T = [[-w0, -w0], [w0, -w0], [w0, w0], [-w0, w0]].map(([a, b]) => [t.x + a, y0, t.z + b]);
    const B = [[-w1, -w1], [w1, -w1], [w1, w1], [-w1, w1]].map(([a, b]) => [t.x + ox + a, y1, t.z + oz + b]);
    const tip = [t.x + ox, y1 - 0.6 - rnd() * 0.8, t.z + oz];
    const tri = (p, q, r, cp, cq, cr) => { pos.push(...p, ...q, ...r); col.push(...cp, ...cq, ...cr); };
    const ct = top.toArray(), cb = bot.toArray();
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      tri(T[i], B[i], B[j], ct, cb, cb); tri(T[i], B[j], T[j], ct, cb, ct);
      tri(B[i], tip, B[j], cb, cb, cb);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide }));
  m.receiveShadow = true;
  return m;
}
