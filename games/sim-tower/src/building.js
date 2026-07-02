// Assemble authored rooms into the CITY BLOCK: a ring of single-story
// buildings around a courtyard, every building facing outward onto the
// sidewalk. Each room becomes a "plot": plotGroup ▸ slot ▸ {furniture, actors}.
// The slot carries ROOM_YAW (authored depth → width); the plot group carries
// the side yaw + world position.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { buildRoom } from './loader.js';
import { SIDE_YAW, sideToWorld, squareT } from './block.js';

const DEG = Math.PI / 180;

/** One room wrapped in slot/furniture/actors. Not yet positioned in the block. */
export function makeRoomSlot(level) {
  const furniture = buildRoom(level);
  if (CONFIG.DEPTH_SQUASH !== 1) furniture.scale.z = CONFIG.DEPTH_SQUASH;

  const actors = new THREE.Group();
  actors.name = 'actors';
  actors.position.y = CONFIG.FLOOR_SURFACE_Y;   // residents stand on the floor tiles, not the slab

  const slot = new THREE.Group();
  slot.rotation.y = CONFIG.ROOM_YAW_DEG * DEG;
  slot.add(furniture, actors);

  // footprint after yaw (for layout). width/depth swap at 90°/270°.
  const w = furniture.userData.widthX, d = furniture.userData.depthZ * CONFIG.DEPTH_SQUASH;
  const yaw = Math.abs(CONFIG.ROOM_YAW_DEG % 180);
  const footW = yaw === 90 ? d : w;

  return { slot, furniture, actors, level, grid: level.grid, footW };
}

/** footprint width a level occupies after ROOM_YAW (cols/rows swap at 90°/270°). */
export function levelFootW(level) {
  const yaw = Math.abs(CONFIG.ROOM_YAW_DEG % 180);
  return (yaw === 90 ? level.grid.rows : level.grid.cols) * level.grid.tile;
}

const parseKey = (k) => { const i = k.indexOf(':'); return { side: +k.slice(0, i), i: +k.slice(i + 1) }; };

/** Slot-local lateral x of the room's front door (from the authored level). */
function doorLatOf(level) {
  const yaw = CONFIG.ROOM_YAW_DEG * DEG;
  const { cols, rows, tile } = level.grid;
  const o = level.objects.find((x) => x.model === 'wall_doorway');
  if (!o) return 0;
  const lx = (o.col - (cols - 1) / 2) * tile + (o.off?.x || 0);
  const lz = (o.row - (rows - 1) / 2) * tile + (o.off?.z || 0);
  return lx * Math.cos(yaw) + lz * Math.sin(yaw);   // rotate authored (x,z) by ROOM_YAW, keep x
}

/**
 * Build the block from a sparse PLOTS map.
 *   lots: Map "side:i" → content (null = owned empty plot, roomId = a building)
 *   opts: { levelsById }
 * Returns { group, shell, rooms, slots, buyable, plots, geom, roomH, box }.
 */
export function buildBlock(lots, opts) {
  const { levelsById } = opts;
  const B = CONFIG.BLOCK, S = CONFIG.SHELL;
  const N = B.SIDE_PLOTS;
  const W = B.PLOT_W;
  const FACE = (N * W) / 2 + B.CORNER_GAP;          // building-front plane distance
  const K = FACE + B.SIDEWALK_W / 2;                // sidewalk centreline half-extent
  const ROAD_IN = FACE + B.SIDEWALK_W;              // road inner edge
  const walkY = CONFIG.FLOOR_SURFACE_Y;

  const group = new THREE.Group();
  const rooms = [];
  const plots = new Map();                          // "side:i" → plot geometry (ALL positions)
  const has = (side, i) => lots.has(side + ':' + i);

  // measure a representative room (all levels share the template) for depth/height
  let roomH = 0, zFrontL = 5, zBackL = -5;
  const _box = new THREE.Box3();

  // pass 1: build owned rooms so we can measure the real extents
  const builtRooms = new Map();                     // key → {s, level}
  for (const [k, content] of lots) {
    if (!content || !levelsById[content]) continue;
    const s = makeRoomSlot(levelsById[content]);
    _box.setFromObject(s.slot);          // slot, not furniture: includes ROOM_YAW (front = slot-local +z)
    roomH = Math.max(roomH, _box.max.y - _box.min.y);
    zBackL = Math.min(zBackL, _box.min.z); zFrontL = Math.max(zFrontL, _box.max.z);
    builtRooms.set(k, { s, level: levelsById[content], content });
  }
  if (!roomH) roomH = 4.2;
  const D = zFrontL - zBackL;                       // building depth
  const vC = FACE - zFrontL;                        // plot-centre outward offset → front lands on FACE

  // geometry for every plot position (owned or not) — picker needs the empties too
  for (let side = 0; side < 4; side++) {
    for (let i = 0; i < N; i++) {
      const u = (i - (N - 1) / 2) * W;
      const { x, z } = sideToWorld(side, u, vC);
      plots.set(side + ':' + i, { side, i, u, x, z, yaw: SIDE_YAW[side] });
    }
  }

  // materials
  const mat = (c) => new THREE.MeshStandardMaterial({ color: new THREE.Color(c), roughness: 1, metalness: 0 });
  const matSlab = mat(S.SLAB), matRoof = mat(S.ROOF), matGround = mat(S.GROUND);
  const matPave = mat(S.PAVEMENT), matGrass = mat(S.GRASS), matSide = mat('#b9a78c');

  // ── ground: base slab, sidewalk ring (incl. corners), courtyard lawn ──
  const base = new THREE.Mesh(new THREE.BoxGeometry(ROAD_IN * 2 + 0.4, 0.8, ROAD_IN * 2 + 0.4), matGround);
  base.position.y = -0.42; base.receiveShadow = true; group.add(base);
  // pavement top sits a hair BELOW the interior floor tops (0.5) — coplanar
  // surfaces z-fight (flickering floors); the 0.06 kerb step is invisible.
  const pave = new THREE.Mesh(new THREE.BoxGeometry(ROAD_IN * 2, 0.52, ROAD_IN * 2), matPave);
  pave.position.y = 0.44 - 0.26; pave.receiveShadow = true; group.add(pave);
  const lawnHalf = FACE - D - 0.6;
  if (lawnHalf > 3) {
    // lawn top 0.48: above the pavement (0.44, no burial) and below the room
    // floors (0.5) — never coplanar with either, so nothing z-fights
    const lawn = new THREE.Mesh(new THREE.BoxGeometry(lawnHalf * 2, 0.5, lawnHalf * 2), matGrass);
    lawn.position.y = 0.48 - 0.25; lawn.receiveShadow = true; group.add(lawn);
  }

  // ── buildings on owned plots ──
  const cullRoofs = [];
  for (const [k, br] of builtRooms) {
    const { side, i } = parseKey(k);
    const p = plots.get(k);
    const plotG = new THREE.Group();
    plotG.rotation.y = p.yaw;
    plotG.position.set(p.x, 0, p.z);

    br.s.slot.position.set(0, 0, 0);
    plotG.add(br.s.slot);

    // reveal-on-occupancy front wall (opaque when vacant), on the outward face
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(W - 0.06, roomH, 0.22),
      new THREE.MeshStandardMaterial({ color: new THREE.Color('#b9a78c'), roughness: 1, transparent: true, opacity: 1 }));
    wall.position.set(0, roomH / 2, zFrontL + 0.12);
    wall.receiveShadow = true;
    plotG.add(wall);

    // thin side panels close the building ends — inset so neighbours' panels
    // never share a plane (coincident faces z-fight)
    for (const sx of [-1, 1]) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.18, roomH, D), matSide);
      panel.position.set(sx * (W / 2 - 0.15), roomH / 2, (zFrontL + zBackL) / 2);
      panel.castShadow = true; panel.receiveShadow = true;
      plotG.add(panel);
    }

    // roof (own transparent material — faded by cullShell when its side faces
    // the camera, so you can see into the near buildings) + base slab
    const roofMat = matRoof.clone(); roofMat.transparent = true; roofMat.opacity = 1;
    const roof = new THREE.Mesh(new THREE.BoxGeometry(W - 0.04, S.ROOF_THICK, D + 0.5), roofMat);   // no sideways overhang — neighbours' roofs must not overlap
    roof.position.set(0, roomH + S.ROOF_THICK / 2, (zFrontL + zBackL) / 2 + 0.1);
    roof.castShadow = true; roof.receiveShadow = true;
    const ow = sideToWorld(side, 0, 1);
    roof.userData.cull = { ox: ow.x, oz: ow.z };
    plotG.add(roof);
    cullRoofs.push(roof);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(W - 0.06, S.SLAB_THICK, D + 0.3), matSlab);
    slab.position.set(0, -S.SLAB_THICK / 2 + 0.02, (zFrontL + zBackL) / 2);
    slab.receiveShadow = true;
    plotG.add(slab);

    group.add(plotG);

    // door anchors (world) for the commute: just inside, and out on the sidewalk line
    const dl = doorLatOf(br.level);
    const doorIn = plotG.localToWorld(new THREE.Vector3(dl, 0, zFrontL - 1.4)); doorIn.y = walkY;
    const doorOut = plotG.localToWorld(new THREE.Vector3(dl, 0, zFrontL + (K - FACE))); doorOut.y = walkY;
    // clamp the sidewalk point onto the ring line, remember its ring param
    const t = squareT(K, doorOut.x, doorOut.z);
    Object.assign(p, { doorIn, doorOut, t, plotG });

    rooms.push({
      slot: br.s.slot, plotG, furniture: br.s.furniture, actors: br.s.actors,
      grid: br.s.grid, level: br.level, floor: side, col: i, roomId: br.content, revealWall: wall,
    });
  }

  // ── owned-but-empty plots: a visible foundation pad (buying changes the world) ──
  const padMat = mat(S.SLAB);
  for (const [k, content] of lots) {
    if (content) continue;
    const p = plots.get(k);
    const pad = new THREE.Mesh(new THREE.BoxGeometry(W - 0.6, 0.18, D - 0.6), padMat);
    pad.position.set(p.x, 0.52, p.z); pad.rotation.y = p.yaw;
    pad.receiveShadow = true;
    group.add(pad);
    const edge = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(W - 0.5, 0.22, D - 0.5)),
      new THREE.LineBasicMaterial({ color: 0x2ee6c0, transparent: true, opacity: 0.6 }));
    edge.position.copy(pad.position); edge.rotation.y = p.yaw;
    group.add(edge);
  }

  // ── picker geometry ──
  const yawDegOf = (side) => SIDE_YAW[side] / DEG;
  const slots = [...lots.entries()].map(([k, content]) => {
    const { side, i } = parseKey(k); const p = plots.get(k);
    return { c: i, f: side, content, x: p.x, z: p.z, yawDeg: yawDegOf(side), yBase: 0, yMid: roomH / 2, w: W, h: roomH, d: D };
  });
  const total = 4 * N;
  const ringIdx = (side, i) => side * N + i;
  const byRing = new Map();
  for (const [k] of lots) { const { side, i } = parseKey(k); byRing.set(ringIdx(side, i), k); }
  const buyable = [];
  const seen = new Set();
  const addBuy = (r) => {
    r = ((r % total) + total) % total;
    const side = Math.floor(r / N), i = r % N;
    const k = side + ':' + i;
    if (lots.has(k) || seen.has(k)) return;
    seen.add(k);
    const p = plots.get(k);
    buyable.push({ c: i, f: side, x: p.x, z: p.z, yawDeg: yawDegOf(side), yBase: 0, yMid: roomH / 2, w: W, h: roomH, d: D });
  };
  if (!lots.size) addBuy(1);
  for (const r of byRing.keys()) { addBuy(r + 1); addBuy(r - 1); }

  // cull shell: the roofs fade when their side faces the camera (dollhouse view)
  const shell = new THREE.Group();
  shell.userData.cullMeshes = cullRoofs;
  group.add(shell);

  const geom = { N, W, D, FACE, K, ROAD_IN, walkY, roomH, total,
    roadR: ROAD_IN + (CONFIG.STREET.ROAD_SCALE * 2) / 2 };   // road centreline (tile depth = 2 × scale)
  const box = new THREE.Box3(
    new THREE.Vector3(-(geom.roadR + 4), -0.6, -(geom.roadR + 4)),
    new THREE.Vector3(geom.roadR + 4, roomH + 1.4, geom.roadR + 4));

  return {
    group, shell, rooms, slots, buyable, plots, geom, roomH, box,
    plotAt: (side, i) => plots.get(side + ':' + i),
  };
}

/** Recursively dispose geometries + materials of a group (for live rebuilds). */
export function disposeObject(obj) {
  obj.traverse((o) => {
    if (o.isMesh || o.isSkinnedMesh) {
      o.geometry?.dispose?.();
      const m = o.material;
      if (Array.isArray(m)) m.forEach((x) => x?.dispose?.());
      else m?.dispose?.();
    }
  });
}

/** Dollhouse culling on the ring: fade the roofs of buildings whose side faces
 *  the camera (see into the near buildings; the far side stays a solid block),
 *  and fade ALL roofs once you tilt down toward the top view. Per frame. */
export function cullShell(shell, rig, dt) {
  const meshes = shell?.userData?.cullMeshes;
  if (!meshes || !meshes.length || !rig) return;
  const C = CONFIG.CAMERA3D;
  const camX = Math.sin(rig.az), camZ = Math.cos(rig.az);   // horizontal camera direction from the target
  const polMin = C.POL_MIN_DEG * DEG, polMax = C.POL_MAX_DEG * DEG;
  const polFrac = Math.max(0, Math.min(1, (rig.pol - polMin) / (polMax - polMin)));
  const smooth = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
  const downFade = smooth(0.55, 0.95, polFrac);             // looking down from high → open everything
  const k = 1 - Math.exp(-C.CULL_LERP * dt);
  for (const m of meshes) {
    const cu = m.userData.cull;
    const facing = cu.ox * camX + cu.oz * camZ;             // 1 = this side faces the camera
    const fade = Math.max(smooth(0.05, 0.6, facing), downFade);
    const goal = 1 - fade * (1 - C.CULL_FADE);
    m.material.opacity += (goal - m.material.opacity) * k;
    m.material.depthWrite = m.material.opacity > 0.6;
    m.castShadow = m.material.opacity > 0.5;                // a faded roof shouldn't darken its room
    m.visible = m.material.opacity > 0.04;
  }
}
