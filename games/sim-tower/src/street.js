// A street in front of the building: a row of road tiles (KayKit City Builder)
// with cars looping past left↔right. Pure decoration — lives in its own world
// group, independent of the tower lots. Sizes are measured at runtime so we
// don't hardcode pack dimensions.
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
 * Build the street in front of the building.
 *   opts.frontZ = world z of the building's front face (street sits just past it)
 * Returns { group, update(dt), recenter(x) }.
 */
export async function buildStreet(scene, opts = {}) {
  const S = CONFIG.STREET;
  const frontZ = opts.frontZ ?? 7;
  const group = new THREE.Group();
  group.name = 'street';

  // ── road: tile a 2×2 straight road piece along X at the street line ──
  const road = await load('road_straight');
  const rs = sizeOf(road);
  const tile = Math.max(0.5, rs.x);                 // 2u tiles
  const roadDepth = rs.z;                            // road width (across the lanes)
  const roadTopY = S.Y + rs.y;                       // top surface of the road
  const centerZ = frontZ + S.GAP + roadDepth / 2;    // road centreline z, just past the building
  const n = Math.ceil(S.WIDTH / tile) + 1;
  for (let i = 0; i < n; i++) {
    const t = road.clone();
    t.rotation.y = (S.ROAD_YAW_DEG || 0) * Math.PI / 180;
    t.position.set((i - (n - 1) / 2) * tile, S.Y, centerZ);
    t.traverse((o) => { if (o.isMesh) { o.receiveShadow = true; o.castShadow = false; } });
    group.add(t);
  }

  // ── cars: pooled clones, scaled to a target width, looping along X ──
  const protos = [];
  for (const m of CAR_MODELS) protos.push(await load(m));
  const cars = [];
  const half = S.WIDTH / 2 + tile;
  for (let i = 0; i < S.CARS; i++) {
    const proto = protos[i % protos.length];
    const obj = proto.clone();
    const cs = sizeOf(obj);
    const scale = S.CAR_TARGET_W / (cs.x || 1);      // cars model ~+Z forward; width is X
    obj.scale.setScalar(scale);
    const minY = new THREE.Box3().setFromObject(obj).min.y;
    obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false; } });

    const dir = i % 2 === 0 ? 1 : -1;                // alternate directions per lane
    const laneZ = centerZ - dir * S.LANE;            // opposite lanes for opposite directions
    obj.rotation.y = dir * Math.PI / 2;              // model faces +Z → turn to face ±X
    const x = -dir * half + (i / S.CARS) * S.WIDTH;  // spread them out along the street
    obj.position.set(x, roadTopY - minY, laneZ);
    group.add(obj);
    cars.push({ obj, dir, laneZ, speed: S.CAR_SPEED_MIN + Math.random() * (S.CAR_SPEED_MAX - S.CAR_SPEED_MIN) });
  }

  scene.add(group);
  return {
    group,
    update(dt) {
      for (const c of cars) {
        c.obj.position.x += c.dir * c.speed * dt;
        if (c.dir > 0 && c.obj.position.x > half) c.obj.position.x = -half;
        else if (c.dir < 0 && c.obj.position.x < -half) c.obj.position.x = half;
      }
    },
    recenter(x) { group.position.x = x; },           // keep the strip centred on the tower
  };
}
