// Grass and small plants near the player (world proposal item 6): tufts of grass,
// clover, small ferns, fallen petals and pebbles from the Quaternius pack, drawn as
// five InstancedMeshes (five draw calls, no shadows cast) in a ring around the player.
// Grass, clover and ferns sway in the wind (merge.js).
// The island is cut into 4 m cells; what grows in a cell comes from a hash of the
// cell, so it is the same every time you come back. Cells are worked out when they
// come into range and dropped when they are far away.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ZONES, HOME, ISLAND } from './balance.js';
import { paintQ, swayMat, setSway } from './merge.js';
import { groundH, pathDist, pondD, POND, beachW, groundNoise, DECK, streamAt, CAMP, LAVA_ANGLES, lavaPoint } from './world.js';

const CELL = 4, RADIUS = 23, PER_CELL = 11;
const zone = (id) => ZONES.find((z) => z.id === id);
const FOREST = zone('forest'), VOLCANO = zone('volcano');
// kind → [most instances drawn, models (merged into one little group)]
const KINDS = {
  grass: [760, [['Grass_Tuft', 0, 0, 1]]],
  clover: [44, [['Clover_Small', 0, 0, 1]]],
  fern: [18, [['Fern_Small', 0, 0, 1]]],
  petals: [40, [['Petal_1', 0, 0, 1], ['Petal_3', 0.5, 0.2, 0.8], ['Petal_2', -0.3, 0.45, 0.7]]],
  pebbles: [30, [['Pebble_Square_3', 0, 0, 1], ['Pebble_Round_2', 0.45, 0.25, 0.8], ['Pebble_Square_4', -0.2, 0.5, 1.1]]],
};
const SWAYS = { grass: 1, clover: 1, fern: 1 };
const hash = (ix, iz) => { let h = (ix * 73856093) ^ (iz * 19349663) ^ 0x9e3779b9; h = Math.imul(h ^ (h >>> 15), 0x85ebca6b); h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35); return (h ^ (h >>> 16)) >>> 0; };
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export class GroundCover {
  constructor(world) {
    this.world = world; this.cells = new Map(); this.last = new THREE.Vector3(1e9, 0, 0); this.density = 1;
    const M = world.q.models, m4 = new THREE.Matrix4();
    this.kinds = {};
    for (const [kind, [max, parts]] of Object.entries(KINDS)) {
      // (wind: grass, clover and ferns sway, weights for a plant of scale 1; the shader scales them with the instance)
      const geos = parts.filter(([n]) => M[n]).map(([n, x, z, s]) => setSway(paintQ(M[n]).applyMatrix4(m4.makeScale(s, s, s).setPosition(x, -M[n].minY * s, z)), SWAYS[kind] ? 'plant' : null, 0, M[n].h * s));
      if (!geos.length) continue;
      const im = new THREE.InstancedMesh(geos.length > 1 ? mergeGeometries(geos) : geos[0], swayMat(), max);
      im.count = 0; im.frustumCulled = false; im.receiveShadow = true; im.castShadow = false;
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.setColorAt(0, new THREE.Color(1, 1, 1)); im.instanceColor.setUsage(THREE.DynamicDrawUsage);
      world.scene.add(im);
      this.kinds[kind] = { im, max };
    }
  }
  // What grows in one cell: [kind, x, y, z, scale, rotY, r, g, b] …
  _cell(ix, iz) {
    let s = hash(ix, iz); const rnd = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const out = [], c = new THREE.Color();
    for (let k = 0; k < PER_CELL; k++) {
      const x = (ix + rnd()) * CELL, z = (iz + rnd()) * CELL, pick = rnd(), sc = rnd(), ry = rnd() * 6.28, shade = 0.88 + rnd() * 0.24;
      const pd = pathDist(x, z);
      if (pd < 1.7) continue;                                        // the paths stay clear
      if (x > DECK.x0 - 1.5 && x < DECK.x1 + 1.5 && z > DECK.z0 - 1.5 && z < DECK.z1 + 9) continue; // the base and the house
      if (pondD(x, z) < POND.r + 0.3) continue;
      if (streamAt(x, z)[0] < 5 || Math.hypot(x - CAMP.x, z - CAMP.z) < 2) continue;           // the stream's bed and banks, the camp fire
      const h = groundH(x, z); if (h < 0.5 || Math.hypot(x - ISLAND.cx, z - ISLAND.cz) > ISLAND.r - 6) continue;
      const sand = beachW(x, z) > 0.45 || Math.hypot(x - zone('beach').x, z - zone('beach').z) < zone('beach').r + 1;
      const [n1, , n3] = groundNoise(x, z);
      const dv = Math.hypot(x - VOLCANO.x, z - VOLCANO.z), df = Math.hypot(x - FOREST.x, z - FOREST.z);
      let kind = 'grass', scale = 0.3 + sc * 0.22;
      if (sand) { if (pick > 0.1) continue; kind = 'pebbles'; }
      else if (dv < VOLCANO.r + 12) {                                // ash and rock: pebbles, a little dry grass at the foot
        if (LAVA_ANGLES.some((_, k) => { const [lx, lz] = lavaPoint(k, dv); return Math.hypot(x - lx, z - lz) < 2.6; })) continue; // not in the lava
        if (pick < 0.07) kind = 'pebbles'; else if (pick < 0.3 && dv > VOLCANO.r + 2) { kind = 'grass'; c.setHex(0xb9b27a); } else continue;
      } else if (df < FOREST.r + 6) {                                // forest floor: ferns, clover, darker grass
        kind = pick < 0.035 ? 'fern' : pick < 0.11 ? 'clover' : pick < 0.13 ? 'pebbles' : pick < 0.8 ? 'grass' : '';
        if (!kind) continue;
        c.setHex(n3 > 0.3 ? 0x6f9a48 : 0x4f9c48);
        if (kind === 'fern') scale = 0.13 + sc * 0.08;
      } else {                                                       // meadow
        kind = pick < 0.04 ? 'clover' : pick < 0.075 ? 'petals' : pick < (pd < 3.2 ? 0.2 : 0.095) ? 'pebbles' : 'grass';
        c.setHex(n1 > 0.42 ? 0xcfd05e : n1 < -0.4 ? 0x66c060 : 0x8fd35c); // follows the ground's dry / lush patches
      }
      if (kind === 'grass') c.multiplyScalar(shade); else if (kind === 'pebbles') { c.setScalar(dv < VOLCANO.r + 12 ? 0.6 : 1); scale = 0.4 + sc * 0.45; }
      else if (kind === 'clover') { c.setScalar(shade); scale = 0.5 + sc * 0.35; } else if (kind !== 'fern') { c.setScalar(1); scale = 0.35 + sc * 0.2; }
      if (kind === 'fern') c.setScalar(shade);
      out.push([kind, x, h - (kind === 'pebbles' ? 0.02 : 0.03), z, scale, ry, c.r, c.g, c.b]);
    }
    return out;
  }
  setDensity(d) { this.density = d; this.last.x = 1e9; }
  // Call every frame with the player's position; it only works when the player has moved.
  update(p) {
    if (Math.hypot(p.x - this.last.x, p.z - this.last.z) < 1.2) return;
    this.last.copy(p);
    const cx = Math.floor(p.x / CELL), cz = Math.floor(p.z / CELL), n = Math.ceil(RADIUS / CELL);
    const count = {}, m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color();
    for (const k of Object.keys(this.kinds)) count[k] = 0;
    for (let iz = cz - n; iz <= cz + n; iz++) for (let ix = cx - n; ix <= cx + n; ix++) {
      const key = (ix + 2048) * 4096 + (iz + 2048);
      let cell = this.cells.get(key);
      if (!cell) this.cells.set(key, cell = this._cell(ix, iz));
      for (let i = 0; i < cell.length; i++) {
        if (this.density < 1 && (i % 2)) continue;
        const it = cell[i], K = this.kinds[it[0]]; if (!K || count[it[0]] >= K.max) continue;
        const d = Math.hypot(it[1] - p.x, it[3] - p.z); if (d > RADIUS) continue;
        const s = it[4] * (1 - smooth(RADIUS * 0.72, RADIUS, d)); // they shrink into the ground at the edge of the ring
        if (s < 0.05) continue;
        const j = count[it[0]]++;
        K.im.setMatrixAt(j, m4.compose(v.set(it[1], it[2], it[3]), q.setFromAxisAngle(up, it[5]), sc.setScalar(s)));
        K.im.setColorAt(j, col.setRGB(it[6], it[7], it[8]));
      }
    }
    for (const [k, K] of Object.entries(this.kinds)) { K.im.count = count[k]; K.im.instanceMatrix.needsUpdate = true; K.im.instanceColor.needsUpdate = true; }
    if (this.cells.size > 1200) for (const key of this.cells.keys()) { // forget cells far behind
      const ix = Math.floor(key / 4096) - 2048, iz = (key % 4096) - 2048;
      if (Math.abs(ix - cx) > n + 6 || Math.abs(iz - cz) > n + 6) this.cells.delete(key);
    }
  }
}
