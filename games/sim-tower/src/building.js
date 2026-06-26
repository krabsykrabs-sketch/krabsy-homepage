// Assemble authored rooms into a small stacked building (cutaway).
// Each room becomes a "slot": slot ▸ {furniture, actors}. The slot carries the
// building position + ROOM_YAW; furniture carries the optional DEPTH_SQUASH (z)
// scale; actors stays unscaled so characters never get distorted.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { buildRoom } from './loader.js';

const DEG = Math.PI / 180;

/** One room wrapped in slot/furniture/actors. Not yet positioned in the stack. */
export function makeRoomSlot(level) {
  const furniture = buildRoom(level);
  if (CONFIG.DEPTH_SQUASH !== 1) furniture.scale.z = CONFIG.DEPTH_SQUASH;

  const actors = new THREE.Group();
  actors.name = 'actors';

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
  return { group, shell, rooms, slots, buyable, slotW, lotW, roomH, roomD, pitch, floors: maxF + 1, box, colX };
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
    // back wall segment (tiles vertically across floors)
    box(lotW + 0.02, pitch + 0.02, 0.3, x, yb + pitch / 2 - S.SLAB_THICK / 2, zBack - S.BACK_OFFSET, matBack, 'back');
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
