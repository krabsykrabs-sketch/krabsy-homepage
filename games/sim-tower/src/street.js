// The block's OUTDOORS: a road ring around the sidewalk with cars doing laps
// (two lanes, opposite directions, uniform per-lane speed so nobody collides),
// plus streetlights at the sidewalk corners and benches/bushes in the
// courtyard park. Pure decoration in its own group; loaded in the background.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CONFIG } from './config.js';
import { squarePoint, squareDir, squarePerimeter } from './block.js';

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
 * Build roads + cars + props around/inside the block.
 *   geom: built.geom from buildBlock ({ ROAD_IN, K, FACE, D, walkY … })
 * Returns { group, update(dt) }.
 */
export async function buildStreet(scene, geom) {
  const S = CONFIG.STREET;
  const scale = S.ROAD_SCALE || 3;
  const group = new THREE.Group(); group.name = 'street';

  // ── road ring ──
  const straight = await load('road_straight');
  const corner = await load('road_corner_curved');
  const rs = sizeOf(straight);
  const tileW = rs.x * scale;                      // 6u at scale 3
  const roadR = geom.ROAD_IN + tileW / 2;          // road centreline half-extent
  const roadTopY = S.ROAD_TOP ?? 0.16;
  const roadY = roadTopY - rs.y * scale;
  const half = roadR - tileW / 2;                  // straight runs end where corners begin
  const nT = Math.max(1, Math.round((half * 2) / tileW));
  // straights: S/N run along x (yaw 90 lines the lanes up), E/W along z (yaw 0)
  const sideDefs = [
    { yaw: 90,  pos: (t) => [t, roadR] },          // south
    { yaw: 0,   pos: (t) => [roadR, t] },          // east
    { yaw: 90,  pos: (t) => [t, -roadR] },         // north
    { yaw: 0,   pos: (t) => [-roadR, t] },         // west
  ];
  for (const def of sideDefs) {
    for (let i = 0; i < nT; i++) {
      const t = -half + tileW / 2 + i * tileW;
      const [x, z] = def.pos(t);
      const tl = straight.clone();
      tl.scale.setScalar(scale);
      tl.rotation.y = def.yaw * Math.PI / 180;
      tl.position.set(x, roadY, z);
      tl.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });
      group.add(tl);
    }
  }
  // corners (rotation guessed per quadrant; verified visually)
  const cornerDefs = [
    { x: roadR,  z: roadR,  rot: 0 },              // SE
    { x: roadR,  z: -roadR, rot: 90 },             // NE
    { x: -roadR, z: -roadR, rot: 180 },            // NW
    { x: -roadR, z: roadR,  rot: 270 },            // SW
  ];
  for (const c of cornerDefs) {
    const tl = corner.clone();
    tl.scale.setScalar(scale);
    tl.rotation.y = c.rot * Math.PI / 180;
    tl.position.set(c.x, roadY, c.z);
    tl.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });
    group.add(tl);
  }

  // ── props: streetlights at sidewalk corners, park furniture in the courtyard ──
  try {
    const lightM = await load('streetlight');
    const lh = sizeOf(lightM).y || 1;
    const lScale = (S.LIGHT_H ?? 4.4) / lh;
    const Kc = geom.K;
    [[Kc, Kc], [Kc, -Kc], [-Kc, -Kc], [-Kc, Kc]].forEach(([x, z], i) => {
      const l = lightM.clone();
      l.scale.setScalar(lScale);
      l.rotation.y = (i * 90 + 45) * Math.PI / 180;   // face inward-ish
      l.position.set(x, geom.walkY, z);
      l.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
      group.add(l);
    });
    const bench = await load('bench');
    const bh = sizeOf(bench).x || 1;
    const bScale = 2.2 / bh;
    const lawn = geom.FACE - geom.D - 3;
    [[0, lawn * 0.5, 180], [lawn * 0.5, 0, 90], [0, -lawn * 0.5, 0], [-lawn * 0.5, 0, 270]].forEach(([x, z, ry]) => {
      const b = bench.clone(); b.scale.setScalar(bScale);
      b.rotation.y = ry * Math.PI / 180;
      b.position.set(x, geom.walkY - 0.06, z);
      b.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
      group.add(b);
    });
    for (const name of ['bush_A', 'bush_B']) {
      const bushM = await load(name);
      const bs = 1.6 / (sizeOf(bushM).x || 1);
      const r = lawn * 0.82;
      const offs = name === 'bush_A' ? [[r, r], [-r, -r]] : [[r, -r], [-r, r]];
      for (const [x, z] of offs) {
        const b = bushM.clone(); b.scale.setScalar(bs);
        b.position.set(x, geom.walkY - 0.06, z);
        b.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
        group.add(b);
      }
    }
  } catch (e) { console.warn('[block] props skipped:', e); }

  // ── cars: two lanes, opposite directions, uniform per-lane speed ──
  const protos = [];
  for (const m of CAR_MODELS) protos.push(await load(m));
  const cars = [];
  const lanes = [
    { r: roadR - tileW / 4, dir: 1 },              // inner lane, counter-clockwise
    { r: roadR + tileW / 4, dir: -1 },             // outer lane, clockwise
  ];
  const nCars = Math.min(S.MAX_CARS ?? 6, 2 * Math.max(1, Math.round((roadR * 8) / (tileW * (S.CAR_SPACING ?? 5)))));
  for (let i = 0; i < nCars; i++) {
    const lane = lanes[i % 2];
    const proto = protos[i % protos.length];
    const obj = proto.clone();
    const cs = sizeOf(obj);
    obj.scale.setScalar(S.CAR_TARGET_W / (cs.x || 1));
    const minY = new THREE.Box3().setFromObject(obj).min.y;
    obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
    group.add(obj);
    if (lane.speed == null) lane.speed = S.CAR_SPEED_MIN + Math.random() * (S.CAR_SPEED_MAX - S.CAR_SPEED_MIN);
    const P = squarePerimeter(lane.r);
    const t = (Math.floor(i / 2) / Math.ceil(nCars / 2)) * P;   // even spacing per lane
    cars.push({ obj, lane, t, y: roadTopY - minY, heading: 0 });
  }
  const place = (c) => {
    const p = squarePoint(c.lane.r, c.t, c.y);
    c.obj.position.copy(p);
    const d = squareDir(c.lane.r, c.t).multiplyScalar(c.lane.dir);
    const target = Math.atan2(d.x, d.z);
    let diff = target - c.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    c.heading += diff * 0.25;                       // ease round the corners
    c.obj.rotation.y = c.heading;
  };
  for (const c of cars) { c.heading = (() => { const d = squareDir(c.lane.r, c.t).multiplyScalar(c.lane.dir); return Math.atan2(d.x, d.z); })(); place(c); }

  scene.add(group);
  return {
    group,
    update(dt) {
      for (const c of cars) { c.t += c.lane.dir * c.lane.speed * dt; place(c); }
    },
  };
}
