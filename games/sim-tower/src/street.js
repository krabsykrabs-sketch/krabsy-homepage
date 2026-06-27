// A street in front of the building: a row of road tiles (KayKit City Builder)
// with cars looping past left↔right. Pure decoration — lives in its own world
// group. The road spans the CURRENT tower width (relayout on every rebuild);
// sizes are measured at runtime then scaled by CONFIG.STREET.ROAD_SCALE.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CONFIG } from './config.js';

const PACK = 'assets/models/city-bits/';
const CAR_MODELS = ['car_hatchback', 'car_sedan', 'car_taxi', 'car_stationwagon', 'car_police'];

const loader = new GLTFLoader();
const _cache = {};
function load(name) {
  if (_cache[name]) return Promise.resolve(_cache[name]);
  return new Promise((res, rej) => loader.load(
    PACK + name + '.gltf',
    (g) => { _cache[name] = g.scene; res(g.scene); },
    undefined,
    (e) => rej(new Error('street load ' + name + ': ' + (e?.message || e))),
  ));
}
const sizeOf = (obj) => new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3());

/**
 * Build the street. Loads the road + cars once; call `relayout({minX,maxX,frontZ})`
 * (also on every tower rebuild) to fit the road to the tower's current width.
 * Returns { group, update(dt), relayout(box) }.
 */
export async function buildStreet(scene) {
  const S = CONFIG.STREET;
  const scale = S.ROAD_SCALE || 1;
  const group = new THREE.Group(); group.name = 'street';
  const roadGroup = new THREE.Group(); roadGroup.name = 'road'; group.add(roadGroup);

  // ── measure the road tile (2×2×0.1), derive scaled dimensions ──
  const road = await load('road_straight');
  const rs = sizeOf(road);
  const tileStep = rs.x * scale;            // tiling step along x
  const roadDepth = rs.z * scale;           // road width (across the lanes)
  const roadTopY = S.Y + rs.y * scale;      // top surface of the road
  const lane = roadDepth * (S.LANE_FRAC ?? 0.25);

  // ── car pool: scaled clones; activated per-width in relayout ──
  const protos = [];
  for (const m of CAR_MODELS) protos.push(await load(m));
  const pool = [];
  for (let i = 0; i < (S.MAX_CARS || 8); i++) {
    const proto = protos[i % protos.length];
    const obj = proto.clone();
    const cs = sizeOf(obj);
    obj.scale.setScalar(S.CAR_TARGET_W / (cs.x || 1));
    obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
    const minY = new THREE.Box3().setFromObject(obj).min.y;
    obj.visible = false;
    group.add(obj);
    pool.push({ obj, minY, dir: i % 2 === 0 ? 1 : -1, speed: S.CAR_SPEED_MIN + Math.random() * (S.CAR_SPEED_MAX - S.CAR_SPEED_MIN), active: false });
  }
  scene.add(group);

  let minX = -tileStep, maxX = tileStep, centerZ = 0, active = [];

  function relayout(box) {
    minX = box.minX; maxX = box.maxX;
    centerZ = box.frontZ + S.GAP + roadDepth / 2;
    const span = Math.max(tileStep, maxX - minX);
    const mid = (minX + maxX) / 2;

    // rebuild road tiles spanning the tower width (cloned tiles share geometry — remove, don't dispose)
    roadGroup.clear();
    const n = Math.max(1, Math.round(span / tileStep));   // ≈ tower width, no big overhang
    const x0 = mid - ((n - 1) / 2) * tileStep;
    for (let i = 0; i < n; i++) {
      const t = road.clone();
      t.scale.setScalar(scale);
      t.rotation.y = (S.ROAD_YAW_DEG || 0) * Math.PI / 180;
      t.position.set(x0 + i * tileStep, S.Y, centerZ);
      t.traverse((o) => { if (o.isMesh) { o.receiveShadow = true; o.castShadow = false; } });
      roadGroup.add(t);
    }

    // activate cars proportional to width; spread them across the road
    const nCars = Math.min(pool.length, Math.max(2, Math.round(span / (tileStep * 1.5))));
    active = [];
    for (let i = 0; i < pool.length; i++) {
      const c = pool[i];
      c.active = i < nCars;
      c.obj.visible = c.active;
      if (!c.active) continue;
      c.laneZ = centerZ - c.dir * lane;
      c.obj.rotation.y = c.dir * Math.PI / 2;     // car models face +Z → turn to drive ±X
      c.obj.position.set(minX + (i / nCars) * span, roadTopY - c.minY, c.laneZ);
      active.push(c);
    }
  }

  function update(dt) {
    if (!active.length) return;
    const lo = minX - tileStep, hi = maxX + tileStep;   // drive a touch off each end before wrapping
    for (const c of active) {
      c.obj.position.x += c.dir * c.speed * dt;
      if (c.dir > 0 && c.obj.position.x > hi) c.obj.position.x = lo;
      else if (c.dir < 0 && c.obj.position.x < lo) c.obj.position.x = hi;
    }
  }

  return { group, update, relayout };
}
