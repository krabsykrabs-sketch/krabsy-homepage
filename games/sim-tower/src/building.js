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

/**
 * Build the tower from a fixed-grid layout (columns align across floors; empty
 * slots are reserved, not collapsed — so it composes predictably in the builder).
 *   layout: floors bottom→top; each floor = array length `cols` of (roomId | null)
 *   opts:   { cols, levelsById, defaultSlotW }
 * Returns { group, rooms, slots, cols, floors, slotW, roomH, roomD, pitch, box }.
 * `slots` covers EVERY grid cell (filled or empty) with its world rect — the
 * builder uses it for clickable placeholders.
 */
export function buildTower(layout, opts) {
  const { levelsById } = opts;
  const cols = opts.cols;
  const floors = layout.length;
  const pitch = CONFIG.STORY_PITCH + CONFIG.FLOOR_SLAB_GAP;

  // uniform slot width from the widest room in play (keeps columns aligned)
  let slotW = 0;
  for (const fl of layout) for (const id of fl) if (id && levelsById[id]) slotW = Math.max(slotW, levelFootW(levelsById[id]));
  if (!slotW) slotW = opts.defaultSlotW || 13;
  const colSpacing = slotW + CONFIG.ROOM_GAP_X;
  const colX = (c) => (c - (cols - 1) / 2) * colSpacing;

  const group = new THREE.Group();
  const rooms = [];
  let roomH = 0, zBack = Infinity, zFront = -Infinity;
  const _box = new THREE.Box3();

  layout.forEach((floor, f) => {
    for (let c = 0; c < cols; c++) {
      const id = floor[c];
      if (!id || !levelsById[id]) continue;
      const s = makeRoomSlot(levelsById[id]);
      // measure in local space (slot not yet positioned) for slot/shell dims
      _box.setFromObject(s.furniture);
      roomH = Math.max(roomH, _box.max.y - _box.min.y);
      zBack = Math.min(zBack, _box.min.z); zFront = Math.max(zFront, _box.max.z);
      s.slot.position.set(colX(c), f * pitch, 0);
      group.add(s.slot);
      rooms.push({ slot: s.slot, furniture: s.furniture, actors: s.actors, grid: s.grid, level: levelsById[id], floor: f, col: c, roomId: id });
    }
  });

  if (!rooms.length) { roomH = pitch * 0.82; zBack = -2.6; zFront = 2.6; }
  const roomD = zFront - zBack, zMid = (zBack + zFront) / 2;

  // grid box spanning ALL columns/floors (incl. empty) so the shell wraps the whole frame
  const xHalf = Math.abs(colX(0)) + slotW / 2;
  const gridBox = new THREE.Box3(
    new THREE.Vector3(-xHalf, 0, zBack),
    new THREE.Vector3(xHalf, (floors - 1) * pitch + roomH, zFront),
  );
  group.add(buildShell(gridBox, floors, pitch));

  // clickable slot rects for the builder (every cell)
  const slots = [];
  for (let f = 0; f < floors; f++)
    for (let c = 0; c < cols; c++)
      slots.push({ c, f, x: colX(c), yBase: f * pitch, yMid: f * pitch + roomH / 2, zMid, w: slotW, h: roomH, d: roomD, id: layout[f][c] || null });

  const box = new THREE.Box3().setFromObject(group);
  return { group, rooms, slots, cols, floors, slotW, roomH, roomD, pitch, box };
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
 * Structural shell around the cutaway so it reads as a building: a dark back
 * wall (fills the inter-room gaps + above the walls), floor slabs between
 * stories, a sidewalk, side columns and a roof. `box` is the Box3 of the rooms
 * only; sized to wrap it with small margins.
 */
export function buildShell(box, floors, pitch) {
  const S = CONFIG.SHELL;
  const g = new THREE.Group();
  g.name = 'shell';
  if (!S.enabled) return g;

  const mat = (c) => new THREE.MeshStandardMaterial({ color: new THREE.Color(c), roughness: 1, metalness: 0 });
  const matBack = mat(S.CONCRETE_BACK);
  const matSlab = mat(S.SLAB);
  const matGround = mat(S.GROUND);
  const matRoof = mat(S.ROOF);
  function slab(w, h, d, x, y, z, m) {
    const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    me.position.set(x, y, z); me.castShadow = true; me.receiveShadow = true; g.add(me); return me;
  }

  const SM = S.SIDE_MARGIN;
  const x0 = box.min.x - SM, x1 = box.max.x + SM;
  const W = x1 - x0, cx = (x0 + x1) / 2;
  const zBack = box.min.z, zFront = box.max.z, zMid = (zBack + zFront) / 2;
  const depth = zFront - zBack;
  const slabDepth = depth + S.FRONT_PROTRUDE;
  const slabZ = zMid + S.FRONT_PROTRUDE / 2;

  const yGround = box.min.y;                 // floor-0 room floor sits here
  const yTop = box.max.y;                     // top of the topmost room (box is world-space)
  const fullH = yTop - yGround;

  // back wall plane — from below the sidewalk to above the roof
  slab(W, fullH + S.GROUND_THICK + S.ROOF_THICK + 2, 0.3, cx, (yGround + yTop) / 2, zBack - S.BACK_OFFSET, matBack);

  // sidewalk
  slab(W + 1.2, S.GROUND_THICK, depth + 2.0, cx, yGround - S.GROUND_THICK / 2, zMid + 0.5, matGround);

  // structural floor slabs between stories (fill the gap under each upper floor)
  for (let i = 1; i < floors; i++) {
    const y = i * pitch;                     // bottom of floor i's room
    slab(W, S.SLAB_THICK, slabDepth, cx, y - S.SLAB_THICK / 2, slabZ, matSlab);
  }

  // side columns (full height)
  const colW = SM * 0.9;
  slab(colW, fullH, depth, x0 + colW / 2, (yGround + yTop) / 2, zMid, matSlab);
  slab(colW, fullH, depth, x1 - colW / 2, (yGround + yTop) / 2, zMid, matSlab);

  // roof + parapet
  slab(W, S.ROOF_THICK, slabDepth, cx, yTop + S.ROOF_THICK / 2, slabZ, matRoof);
  slab(W, S.PARAPET, 0.4, cx, yTop + S.ROOF_THICK + S.PARAPET / 2, zFront + S.FRONT_PROTRUDE - 0.2, matRoof);

  return g;
}
