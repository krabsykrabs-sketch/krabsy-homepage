// Assemble authored rooms into a small stacked building (cutaway).
// Each room becomes a "slot": slot ▸ {furniture, actors}. The slot carries the
// building position + ROOM_YAW; furniture carries the optional DEPTH_SQUASH (z)
// scale; actors stays unscaled so characters never get distorted.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { buildRoom } from './loader.js';

const DEG = Math.PI / 180;

// "who's inside the lift" badge — a class emoji on the class colour, drawn to a
// canvas texture (cached per class) and shown on the cab's front face.
const BADGE_EMOJI = { Rogue: '🗡️', Knight: '🛡️', Mage: '🧙', Ranger: '🏹' };
const BADGE_COLOR = { Rogue: '#2ee6c0', Knight: '#6fa8ff', Mage: '#c79bff', Ranger: '#ffcf5e' };
const _badgeCache = {};
function _roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function badgeTexture(type) {
  if (_badgeCache[type]) return _badgeCache[type];
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = BADGE_COLOR[type] || '#cfd6e2'; _roundRect(ctx, 6, 6, 116, 116, 22); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.28)'; ctx.lineWidth = 5; ctx.stroke();
  ctx.font = '74px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(BADGE_EMOJI[type] || '🙂', 64, 72);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return (_badgeCache[type] = tex);
}

/** One room wrapped in slot/furniture/actors. Not yet positioned in the stack. */
export function makeRoomSlot(level) {
  const furniture = buildRoom(level);
  if (CONFIG.DEPTH_SQUASH !== 1) furniture.scale.z = CONFIG.DEPTH_SQUASH;

  const actors = new THREE.Group();
  actors.name = 'actors';
  actors.position.y = CONFIG.FLOOR_SURFACE_Y;   // lift residents onto the floor surface (feet sit at the tile top, not the slab base)

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
function levelFootW(level) {
  const yaw = Math.abs(CONFIG.ROOM_YAW_DEG % 180);
  return (yaw === 90 ? level.grid.rows : level.grid.cols) * level.grid.tile;
}

const parseKey = (k) => { const i = k.indexOf(':'); return { f: +k.slice(0, i), c: +k.slice(i + 1) }; };

/**
 * Build the tower from a sparse LOTS map (SimTower-style variable-width floors).
 *   lots: Map "f:c" → content  (null = bought floor space/hallway, roomId = a room, 'elevator')
 *   opts: { levelsById, defaultSlotW }
 * Floors are independently sized; columns may be negative (expanded left).
 * Returns { group, shell, rooms, slots, buyable, slotW, roomH, roomD, pitch, floors, box, colX, lotW }.
 *   `slots`   = built lots (clickable to place/clear a room)
 *   `buyable` = frontier cells you may buy (adjacent + supported by a lot below)
 */
export function buildTower(lots, opts) {
  const { levelsById } = opts;
  const pitch = CONFIG.STORY_PITCH + CONFIG.FLOOR_SLAB_GAP;
  const has = (c, f) => lots.has(f + ':' + c);

  // uniform lot width from the widest room in play
  let slotW = 0;
  for (const content of lots.values()) if (content && content !== 'elevator' && levelsById[content]) slotW = Math.max(slotW, levelFootW(levelsById[content]));
  if (!slotW) slotW = opts.defaultSlotW || 13;
  const lotW = slotW + CONFIG.ROOM_GAP_X;

  const cells = [...lots.entries()].map(([k, content]) => ({ ...parseKey(k), content }));
  const colsArr = cells.length ? cells.map((c) => c.c) : [0];
  const minC = Math.min(...colsArr), maxC = Math.max(...colsArr);
  const centerC = (minC + maxC) / 2;
  const colX = (c) => (c - centerC) * lotW;
  const maxF = cells.length ? Math.max(...cells.map((c) => c.f)) : 0;

  const group = new THREE.Group();
  const rooms = [];
  let roomH = 0, zBack = Infinity, zFront = -Infinity;
  const _box = new THREE.Box3();

  for (const cell of cells) {
    if (!cell.content || cell.content === 'elevator' || !levelsById[cell.content]) continue;
    const s = makeRoomSlot(levelsById[cell.content]);
    _box.setFromObject(s.furniture);
    roomH = Math.max(roomH, _box.max.y - _box.min.y);
    zBack = Math.min(zBack, _box.min.z); zFront = Math.max(zFront, _box.max.z);
    s.slot.position.set(colX(cell.c), cell.f * pitch, 0);
    group.add(s.slot);
    rooms.push({ slot: s.slot, furniture: s.furniture, actors: s.actors, grid: s.grid, level: levelsById[cell.content], floor: cell.f, col: cell.c, roomId: cell.content });
  }
  if (!roomH) roomH = pitch * 0.82;
  if (zBack === Infinity) { zBack = -2.6; zFront = 2.6; }
  const roomD = zFront - zBack, zMid = (zBack + zFront) / 2;

  const shell = buildShell(cells, { colX, pitch, lotW, roomH, zBack, zFront, has });
  group.add(shell);

  // front-hallway geometry: the front 2 cells of every room are the shared hallway.
  const tile = rooms[0]?.level.grid.tile || 2;
  const hallwayDepth = 2 * tile;
  const roomFrontZ = zFront - hallwayDepth;                                   // room ↔ hallway boundary
  const hallwayZ = roomFrontZ + hallwayDepth * CONFIG.CIRCULATION.HALLWAY_WALK_FRAC; // walk line in the hallway
  const elevatorCols = new Set(opts.elevators || []);
  const circ = buildCirculation(group, cells, { colX, pitch, slotW, lotW, roomH, zBack, zFront, has, hallwayZ, roomFrontZ, elevatorCols });

  // reveal-on-occupancy front walls: opaque when a unit is empty (can't see in),
  // faded by game.js when someone's home. Sits just in front of the furniture, so
  // the hallway (and anyone walking it) stays visible even for vacant units.
  for (const r of rooms) {
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(slotW - 0.04, roomH, 0.22),
      new THREE.MeshStandardMaterial({ color: new THREE.Color('#b9a78c'), roughness: 1, transparent: true, opacity: 1 }));
    wall.position.set(colX(r.col), r.floor * pitch + roomH / 2, roomFrontZ + 0.12);
    wall.receiveShadow = true; wall.userData.reveal = true;
    group.add(wall);
    r.revealWall = wall;
  }

  const slots = cells.map((cell) => ({ c: cell.c, f: cell.f, content: cell.content, x: colX(cell.c), yBase: cell.f * pitch, yMid: cell.f * pitch + roomH / 2, zMid, w: slotW, h: roomH, d: roomD }));

  // buyable frontier: expand right/left/up from any lot; up needs support below (the cell itself)
  const buyable = [];
  const seen = new Set();
  const addBuy = (c, f) => {
    if (has(c, f)) return;
    if (f > 0 && !has(c, f - 1)) return;            // support: nothing to stand on
    const k = f + ':' + c; if (seen.has(k)) return; seen.add(k);
    buyable.push({ c, f, x: colX(c), yBase: f * pitch, yMid: f * pitch + roomH / 2, zMid, w: slotW, h: roomH, d: roomD });
  };
  if (!cells.length) addBuy(0, 0);
  for (const cell of cells) { addBuy(cell.c + 1, cell.f); addBuy(cell.c - 1, cell.f); addBuy(cell.c, cell.f + 1); }

  const box = new THREE.Box3().setFromObject(group);
  if (box.isEmpty()) box.set(new THREE.Vector3(-lotW / 2, 0, zBack), new THREE.Vector3(lotW / 2, roomH, zFront));
  return { group, shell, rooms, slots, buyable, circ, slotW, lotW, roomH, roomD, pitch, floors: maxF + 1, box, colX };
}

// ── circulation: back corridor + procedural stairs + elevators ───────────
function makeStairs(width, run, rise, color) {
  const g = new THREE.Group();
  const n = 8, mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 1, metalness: 0 });
  for (let i = 0; i < n; i++) {
    const h = rise * (i + 1) / n;
    const step = new THREE.Mesh(new THREE.BoxGeometry(width, h, run / n + 0.02), mat);
    step.position.set(0, h / 2, run / 2 - (i + 0.5) * (run / n));   // rise going toward −z (back)
    step.castShadow = true; step.receiveShadow = true;
    g.add(step);
  }
  return g;
}

/** Front-hallway circulation: procedural stairs (every Nth unit) + elevator shafts,
 *  all living in the 2-cell front hallway that's part of each room. No back corridor.
 *  Returns metadata the commute uses for the building nav graph + cab movement. */
function buildCirculation(group, cells, geom) {
  const { colX, pitch, slotW, roomH, hallwayZ, roomFrontZ, elevatorCols } = geom;
  const CC = CONFIG.CIRCULATION;

  const byFloor = new Map();
  for (const cell of cells) { if (!byFloor.has(cell.f)) byFloor.set(cell.f, []); byFloor.get(cell.f).push(cell); }

  const stairs = [];     // {c, f, x} — a flight from floor f→f+1, in the front hallway

  // stairs in the front hallway of every Nth unit, climbing to f+1 if that floor exists
  for (const [f, fcells] of byFloor) {
    if (!byFloor.has(f + 1)) continue;
    const units = fcells.filter((c) => c.content).sort((a, b) => a.c - b.c);
    for (let i = 0; i < units.length; i++) {
      if ((i + 1) % CC.STAIRS_EVERY !== 0) continue;
      const u = units[i];
      if (elevatorCols.has(u.c)) continue;             // don't stack stairs under a lift
      const flight = makeStairs(slotW * 0.42, CC.STAIR_RUN, pitch, CC.STAIR_COLOR);
      flight.position.set(colX(u.c), f * pitch, hallwayZ);   // steps rise toward the room (−z)
      group.add(flight);
      stairs.push({ c: u.c, f, x: colX(u.c) });
    }
  }

  // elevators: a translucent shaft + cab in the front hallway of each lift column,
  // spanning that column's room floors (the room stays behind it — "lift shares the
  // unit's hallway"). Bigger now there's hallway room for it.
  const shaftMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(CC.ELEVATOR_SHAFT), roughness: 1, transparent: true, opacity: 0.32 });
  const cabMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(CC.ELEVATOR_CAB), roughness: 0.7, metalness: 0.1 });
  const elevators = [];
  const shaftW = slotW * CC.ELEVATOR_WIDTH_FRAC, shaftD = CC.ELEVATOR_DEPTH;
  for (const c of elevatorCols) {
    const colCells = cells.filter((x) => x.c === c).sort((a, b) => a.f - b.f);
    if (!colCells.length) continue;
    const fMin = colCells[0].f, fMax = colCells[colCells.length - 1].f;
    const yBot = fMin * pitch, yTop = fMax * pitch + roomH;
    const ex = colX(c) - slotW / 2 + shaftW / 2 + CC.ELEVATOR_INSET;   // hug the far-left of the lot
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(shaftW, yTop - yBot + 0.3, shaftD), shaftMat);
    shaft.position.set(ex, (yBot + yTop) / 2, hallwayZ); group.add(shaft);
    const cabH = roomH * 0.82;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(shaftW - 0.16, cabH, shaftD - 0.16), cabMat);
    cab.castShadow = true;
    cab.position.set(ex, yBot + cabH / 2 + 0.1, hallwayZ);
    group.add(cab);
    // "who's inside" badge on the cab front face — the manager shows it during a ride
    const badgeMat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false });
    const bs = Math.max(0.6, Math.min(shaftW - 0.35, cabH - 0.6));
    const badge = new THREE.Mesh(new THREE.PlaneGeometry(bs, bs), badgeMat);
    badge.position.set(0, 0, (shaftD - 0.16) / 2 + 0.03); badge.visible = false;
    cab.add(badge);
    elevators.push({
      c, x: ex, z: hallwayZ, cab, fMin, fMax, floorY: (f) => f * pitch + cabH / 2 + 0.1,
      setOccupant: (type) => {
        if (type) { badgeMat.map = badgeTexture(type); badgeMat.needsUpdate = true; badge.visible = true; }
        else badge.visible = false;
      },
    });
  }

  return { stairs, elevators, hallwayZ, roomFrontZ, elevatorCols: [...elevatorCols] };
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

/**
 * Per-lot structural shell so a variable-width tower reads as a building and
 * steps correctly (a lot only exists where floor space was bought). Each lot
 * gets a back-wall segment + a structural floor slab; floor-0 lots get a
 * sidewalk; the topmost lot in each column gets a roof cap.
 */
export function buildShell(cells, geom) {
  const { colX, pitch, lotW, roomH, zBack, zFront, has } = geom;
  const S = CONFIG.SHELL;
  const g = new THREE.Group();
  g.name = 'shell';
  if (!S.enabled || !cells.length) return g;

  const mat = (c) => new THREE.MeshStandardMaterial({ color: new THREE.Color(c), roughness: 1, metalness: 0 });
  const matBack = mat(S.CONCRETE_BACK), matSlab = mat(S.SLAB), matGround = mat(S.GROUND), matRoof = mat(S.ROOF);
  const FADEABLE = new Set(['slab', 'roof']);
  function box(w, h, d, x, y, z, m, role) {
    const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), FADEABLE.has(role) ? m.clone() : m);
    me.position.set(x, y, z); me.castShadow = true; me.receiveShadow = true;
    me.userData.cull = { role, topY: y + h / 2 };
    if (FADEABLE.has(role)) { me.material.transparent = true; me.material.opacity = 1; }
    g.add(me); return me;
  }

  const depth = zFront - zBack, zMid = (zBack + zFront) / 2;
  const slabDepth = depth + S.FRONT_PROTRUDE, slabZ = zMid + S.FRONT_PROTRUDE / 2;

  for (const cell of cells) {
    const x = colX(cell.c), yb = cell.f * pitch;
    // (no shell back wall — rooms carry their own authored back walls, and the
    //  back service corridor + its wall sit behind them; this keeps the stairwell visible)
    // structural floor slab under the lot
    box(lotW + 0.02, S.SLAB_THICK, slabDepth, x, yb - S.SLAB_THICK / 2, slabZ, matSlab, 'slab');
    // sidewalk under ground-floor lots
    if (cell.f === 0) box(lotW + 0.2, S.GROUND_THICK, depth + 1.6, x, -S.GROUND_THICK / 2, zMid + 0.4, matGround, 'ground');
    // roof cap on the topmost lot of this column
    if (!has(cell.c, cell.f + 1)) box(lotW, S.ROOF_THICK, slabDepth, x, yb + roomH + S.ROOF_THICK / 2, slabZ, matRoof, 'roof');
  }

  g.userData.centerX = 0;
  g.userData.cullMeshes = g.children.filter((m) => m.userData.cull && FADEABLE.has(m.userData.cull.role));
  return g;
}

/** Dynamic dollhouse culling: fade occluders between the orbit camera and the
 *  rooms (near side column when orbiting; ceilings/roof above the focus when
 *  tilted down) so interiors stay readable. Called each frame in 3D mode. */
export function cullShell(shell, rig, dt) {
  if (!shell || !shell.userData.cullMeshes) return;
  const C = CONFIG.CAMERA3D;
  const cx = shell.userData.centerX || 0;
  const camX = rig.cam.position.x;
  const azMax = C.AZ_MAX_DEG * Math.PI / 180;
  const azFrac = Math.min(1, Math.abs(rig.az) / azMax);
  const polMin = C.POL_MIN_DEG * Math.PI / 180, polMax = C.POL_MAX_DEG * Math.PI / 180;
  const polFrac = Math.max(0, Math.min(1, (rig.pol - polMin) / (polMax - polMin)));
  const smooth = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
  const lerp = (a, b, t) => a + (b - a) * t;
  const k = 1 - Math.exp(-C.CULL_LERP * dt);

  for (const m of shell.userData.cullMeshes) {
    const role = m.userData.cull.role;
    let goal = 1;
    if (role === 'colR') goal = camX > cx + 0.4 ? lerp(1, C.CULL_FADE, azFrac) : 1;
    else if (role === 'colL') goal = camX < cx - 0.4 ? lerp(1, C.CULL_FADE, azFrac) : 1;
    else if (role === 'slab' || role === 'roof') {
      // fade ceilings/roof above the focused level once you tilt down to inspect
      const aboveFocus = m.userData.cull.topY > rig.target.y + 0.6;
      const steep = role === 'roof' ? smooth(0.25, 0.85, polFrac) : (aboveFocus ? smooth(0.35, 0.95, polFrac) : 0);
      goal = lerp(1, C.CULL_FADE, steep);
    }
    m.material.opacity += (goal - m.material.opacity) * k;
    m.material.depthWrite = m.material.opacity > 0.92;
    m.visible = m.material.opacity > 0.03;
  }
}
