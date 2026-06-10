// Krabsy 3D level editor.
// Standalone page (editor.html) sharing only the Three.js + GLTFLoader pipeline with the game.
// No Rapier — the editor doesn't simulate physics. Output is the editor JSON format consumed
// by src/level-loader.js (the data.objects code path).

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CATALOG, CATALOG_BY_TYPE, CATEGORY_ORDER, urlFor, defaultColorFor } from './src/kaykit-catalog.js';

// =====================================================================
// Asset catalog. Combines the synthesized editor tools (spawn / answer-label / checkpoint —
// not real GLTF assets) with the KayKit catalog imported from kaykit-catalog.js.
// =====================================================================

const SYNTH_ENTRIES = [
  { type: 'spawn',        category: 'special', icon: '⚑',  singleton: true,  colors: [], label: 'spawn' },
  { type: 'answer-label', category: 'special', icon: '💬',                    colors: [], label: 'answer-label' },
  { type: 'checkpoint',   category: 'special', icon: '◉',                     colors: [], label: 'checkpoint' },
];

// Prefab catalog. Each prefab places multiple objects at fixed offsets relative to the cursor.
// On placement, every component is spawned as its OWN entry in state.objects — independently
// movable / colorable / deletable. A single undo wipes the whole group (one pushUndo before
// the spawn loop, none inside).
//
// Prefab fields:
//   type, category, icon, label   — UI presentation (no GLTF for prefabs)
//   kind: 'prefab'                — dispatch marker
//   half: { x, z }                — snap footprint (lets the prefab anchor snap to integers
//                                   so the big-platform alignment lands on a cell corner)
//   objects: [ { type, dx, dy, dz, rotation?, scale?, color?, correctAnswer? }, ... ]
const PREFAB_ENTRIES = [
  {
    type: 'prefab-answer-gate',
    category: 'prefabs',
    icon: '⛩',
    label: 'answer gate',
    kind: 'prefab',
    colors: [],
    // Match the big platform's half-extents so the anchor snaps to integers.
    half: { x: 3, z: 3 },
    // Components. Platforms with `name` expose a slot so later answer-label components can
    // reference them via `attachedToSlot`; the placer resolves the slot to the platform's
    // generated id (so a single Ctrl+Z removes the whole gate). For attached label components,
    // `dx/dy/dz` is the OFFSET from the linked platform's base — not a world position.
    objects: [
      // Big "question podium" — the platform_hole the answer banner floats over.
      { name: 'podium',     type: 'platform_hole_6x6x1', dx: 0,    dy: 0, dz:  0,   color: 'blue' },
      // Three 2×2 answer platforms in a Z-column to the west. dx=-6 puts each platform's east
      // edge at x=-5 → 2-unit gap from the big platform's west edge at x=-3 (same gap the old
      // 1×1 layout had). dz = -3, 0, +3 keeps the middle platform centered on the podium and
      // leaves a 1-unit gap between adjacent 2×2 platforms — distinct enough to require a
      // deliberate hop without being a hard jump.
      { name: 'answer_top', type: 'platform_2x2x1', dx: -6, dy: 0, dz: -3, color: 'red', correctAnswer: false },
      { name: 'answer_mid', type: 'platform_2x2x1', dx: -6, dy: 0, dz:  0, color: 'red', correctAnswer: true  },
      { name: 'answer_bot', type: 'platform_2x2x1', dx: -6, dy: 0, dz:  3, color: 'red', correctAnswer: false },
      // All four labels are rotated 90° around Y so their planes' front face points +X — the
      // direction of the big platform when viewed from the answer column. A player approaching
      // the gate from the east reads every sign head-on; the question banner sits aligned with
      // the answer bubbles for a uniform look.
      // Question banner over the big platform. dy=4 puts it ~3 above the podium's top surface
      // so it reads from a distance.
      { type: 'answer-label', dx: 0, dy: 4,   dz: 0, rotation: 90, text: 'swim → ___', fontSize: 'large',  color: 'yellow', attachedToSlot: 'podium' },
      // Answer bubbles, one per answer platform. The middle (correctAnswer) gets the real past
      // tense; the other two get the regularised + past-participle distractors. dy=1.5 from the
      // platform base puts the bubble ~0.5 above each platform's top surface.
      { type: 'answer-label', dx: 0, dy: 1.5, dz: 0, rotation: 90, text: 'swimmed', fontSize: 'medium', color: 'white', attachedToSlot: 'answer_top' },
      { type: 'answer-label', dx: 0, dy: 1.5, dz: 0, rotation: 90, text: 'swam',    fontSize: 'medium', color: 'white', attachedToSlot: 'answer_mid' },
      { type: 'answer-label', dx: 0, dy: 1.5, dz: 0, rotation: 90, text: 'swum',    fontSize: 'medium', color: 'white', attachedToSlot: 'answer_bot' },
    ],
  },
];

// Single flat catalog used internally. UI groups by `category` at render time.
const ASSET_CATALOG = [...SYNTH_ENTRIES, ...PREFAB_ENTRIES, ...CATALOG];

// Sections shown in the library, in display order. "Special" is the first group, always
// expanded; "Prefabs" sits right after so multi-component placements are visible immediately;
// KayKit categories follow per kaykit-catalog's CATEGORY_ORDER.
const LIBRARY_SECTIONS = [
  ['special',      'Tools'],
  ['prefabs',      'Prefabs'],
  ['user-prefabs', 'Custom Prefabs'],
  ...CATEGORY_ORDER,
];

const GRID_SIZE = 1;            // XZ snap (m) — 1-unit so all KayKit sizes tile cleanly
const Y_SNAP    = 1;            // Y plane step
const ROT_SNAP  = 15;           // degrees
const UNDO_LIMIT = 30;

// Color swatch render colors (CSS).
const COLOR_SWATCH_HEX = {
  neutral: '#d8d8d8',
  red:     '#e94f4f',
  blue:    '#4f7ce9',
  green:   '#4fb05c',
  yellow:  '#e9c84f',
};

// =====================================================================
// Three.js scene + cameras.
// =====================================================================

const canvas = document.getElementById('viewport');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf1f2f4);

scene.add(new THREE.AmbientLight(0xffffff, 0.85));
const dir = new THREE.DirectionalLight(0xffffff, 0.45);
dir.position.set(10, 20, 8);
scene.add(dir);

// Top-down ortho. Frustum recomputed on resize / zoom.
let orthoZoom = 28;   // half-height of the orthographic view in world units
const orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 500);
orthoCam.position.set(0, 80, 0);
orthoCam.up.set(0, 0, -1);
orthoCam.lookAt(0, 0, 0);

const perspCam = new THREE.PerspectiveCamera(55, 1, 0.1, 500);
perspCam.position.set(20, 25, 30);
perspCam.lookAt(0, 0, 0);

let camera = orthoCam;
let viewMode = 'top';     // 'top' | 'perspective'
const camPan = { x: 0, z: 0 };
const perspOrbit = { yaw: -Math.PI * 0.25, pitch: -Math.PI * 0.3, dist: 35, target: new THREE.Vector3(0, 0, 0) };

function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  const aspect = w / h;
  orthoCam.left   = -orthoZoom * aspect;
  orthoCam.right  =  orthoZoom * aspect;
  orthoCam.top    =  orthoZoom;
  orthoCam.bottom = -orthoZoom;
  orthoCam.updateProjectionMatrix();
  perspCam.aspect = aspect;
  perspCam.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
// Initial layout — defer one frame so flex sizing settles.
requestAnimationFrame(resize);

// =====================================================================
// Grid + axes.
// =====================================================================

// Fine grid: 1×1 cells (matches the editor's 1-unit XZ snap, so every KayKit asset's footprint
// lines up with the visible grid). 200 wide / 200 divisions = 1m per cell.
const gridHelper = new THREE.GridHelper(200, 200, 0xc8ccd1, 0xdee2e8);
gridHelper.position.y = 0;
scene.add(gridHelper);

// Coarse grid: every 5m, bolder, so the eye can count cells at far zoom without going cross-eyed.
const coarseGrid = new THREE.GridHelper(200, 40, 0x9aa0a8, 0x9aa0a8);
coarseGrid.position.y = 0.001;
scene.add(coarseGrid);

const axes = new THREE.Group();
const axisLen = 12;
const xAxis = new THREE.Line(
  new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-axisLen, 0.01, 0), new THREE.Vector3(axisLen, 0.01, 0)]),
  new THREE.LineBasicMaterial({ color: 0xd22f2f }),
);
const zAxis = new THREE.Line(
  new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.01, -axisLen), new THREE.Vector3(0, 0.01, axisLen)]),
  new THREE.LineBasicMaterial({ color: 0x2f8cd2 }),
);
const yAxis = new THREE.Line(
  new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 6, 0)]),
  new THREE.LineBasicMaterial({ color: 0x2fa84f }),
);
axes.add(xAxis, zAxis, yAxis);
scene.add(axes);

// Placement shadow: a flat yellow rectangle sitting just above the ground grid that mirrors
// the XZ footprint of the asset being placed. Sized in setPlacementPreview, positioned in the
// mousemove handler, hidden when no tool is active. The mesh is unit-sized; we drive its
// footprint via mesh.scale.{x,z} so we never have to rebuild geometry.
const placementShadowGeo = new THREE.PlaneGeometry(1, 1);
const placementShadowMat = new THREE.MeshBasicMaterial({
  color: 0xffcc33, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide,
});
const placementShadow = new THREE.Mesh(placementShadowGeo, placementShadowMat);
placementShadow.rotation.x = -Math.PI / 2;       // lay flat on XZ
placementShadow.position.y = 0.005;              // above coarseGrid (0.001) so it isn't z-fought
placementShadow.renderOrder = 1;
placementShadow.visible = false;
scene.add(placementShadow);

// Selection outlines. One yellow BoxHelper per selected object, kept in sync with the mesh
// via refreshSelectionHelpers(). BoxHelper computes a world-space AABB, so it grows/shrinks to
// hug the rotated object — fine for "what's selected" feedback.
const selectionHelpers = new Map();   // id → THREE.BoxHelper
const SELECTION_COLOR = 0xffcc00;

// =====================================================================
// GLB cache + cloning. We don't reuse src/assets.js because it's tied to the game's tree.
// =====================================================================

const gltfLoader = new GLTFLoader();
const glbCache = new Map();

function loadGLB(url) {
  if (!glbCache.has(url)) {
    glbCache.set(url, new Promise((resolve, reject) => {
      gltfLoader.load(url, resolve, undefined, reject);
    }));
  }
  return glbCache.get(url);
}

async function cloneModel(url) {
  const gltf = await loadGLB(url);
  return gltf.scene.clone(true);
}

// =====================================================================
// Library thumbnails. Each asset is rendered once at editor boot to an 80x80 canvas
// using a small off-screen renderer. Synth entries use a glyph instead.
// =====================================================================

const thumbRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
thumbRenderer.setSize(80, 80);
thumbRenderer.outputColorSpace = THREE.SRGBColorSpace;

async function makeThumbnail(asset) {
  // Synth entries (spawn/answer-label/checkpoint) — no GLTF; library uses an icon glyph.
  if (!asset.colors || asset.colors.length === 0) return null;
  const url = urlFor(asset.type, asset.defaultColor);
  const model = await cloneModel(url);
  // Frame the model: compute bounding box, fit ortho camera, then render once.
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 0.5);

  const tScene = new THREE.Scene();
  tScene.background = new THREE.Color(0xffffff);
  tScene.add(new THREE.AmbientLight(0xffffff, 0.9));
  const tDir = new THREE.DirectionalLight(0xffffff, 0.5);
  tDir.position.set(2, 3, 2);
  tScene.add(tDir);
  model.position.sub(center);
  tScene.add(model);

  const half = maxDim * 0.7;
  const tCam = new THREE.OrthographicCamera(-half, half, half, -half, 0.1, 100);
  tCam.position.set(maxDim, maxDim * 1.2, maxDim);
  tCam.lookAt(0, 0, 0);

  thumbRenderer.render(tScene, tCam);
  const data = thumbRenderer.domElement.toDataURL('image/png');
  return data;
}

// =====================================================================
// Editor state.
// =====================================================================

const state = {
  levelName: 'Untitled Level',
  levelId:   'untitled-level',
  topic:     'irregular_verbs',
  objects: new Map(),    // id -> object record
  spawn:   null,         // { id, position }
  flag:    null,         // { id, position }
  nextSeq: {},           // type -> next sequence number
  selectedIds: new Set(),
  activeTool: null,      // asset catalog entry currently being placed
  placementRotation: 0,  // degrees, applied to the next placed object (cycled with R / toolbar)
  yPlane: 0,
  labelsVisible: true,
  gridVisible: true,
  // User-defined prefabs, captured via "Save as Prefab" from a multi-selection. Same shape as
  // the built-in PREFAB_ENTRIES so they reuse the existing placement + preview code paths.
  // Persisted in level JSON under data.prefabs.
  userPrefabs: [],
};

// Dirty flag as an accessor so every existing `state.dirty = …` write also refreshes the
// tab-title indicator — the one place the user can see unsaved state at a glance.
let _dirty = false;
Object.defineProperty(state, 'dirty', {
  get() { return _dirty; },
  set(v) {
    _dirty = v;
    document.title = `${v ? '● ' : ''}${state.levelName} — Krabsy 3D Level Editor`;
  },
});

// Warn before the tab closes/reloads with unsaved changes. (Browsers show their own generic
// message; returnValue just has to be set.)
window.addEventListener('beforeunload', (ev) => {
  if (!state.dirty) return;
  ev.preventDefault();
  ev.returnValue = '';
});

const undoStack = [];
const redoStack = [];

function snapshotState() {
  // Copy of the placement state used for undo/redo. We snapshot only the JSON data fields —
  // never the Three.js meshes, which have cycles and would crash structuredClone with a
  // DataCloneError. Mesh state is recreated from data on restore. Selection isn't part of undo.
  const objects = [];
  for (const o of state.objects.values()) objects.push(structuredClone(o.data));
  return {
    objects,
    spawn: state.spawn ? { id: state.spawn.id, position: [...state.spawn.position] } : null,
    flag:  state.flag  ? {
      id: state.flag.id,
      type: state.flag.type,
      color: state.flag.color,
      position: [...state.flag.position],
    } : null,
    nextSeq: { ...state.nextSeq },
  };
}

function pushUndo() {
  undoStack.push(snapshotState());
  if (undoStack.length > UNDO_LIMIT) undoStack.shift();
  redoStack.length = 0;
  state.dirty = true;
}

async function restoreState(snap) {
  // Clear all existing meshes.
  for (const o of state.objects.values()) disposeRec(o);
  state.objects.clear();
  if (state.spawn?._mesh) scene.remove(state.spawn._mesh);
  if (state.spawn?._dropLine) scene.remove(state.spawn._dropLine);
  state.spawn = null;
  if (state.flag?._mesh) scene.remove(state.flag._mesh);
  if (state.flag?._dropLine) scene.remove(state.flag._dropLine);
  state.flag = null;
  state.selectedIds.clear();
  state.nextSeq = { ...snap.nextSeq };
  // Recreate.
  for (const data of snap.objects) await spawnRec(data, { suppressUndo: true });
  if (snap.spawn) await setSpawn(snap.spawn.position, snap.spawn.id, { suppressUndo: true });
  if (snap.flag) await setFlag(snap.flag.position, snap.flag.type || 'flag_C', snap.flag.color || 'blue', snap.flag.id, { suppressUndo: true });
  refreshAll();
}

async function doUndo() {
  if (undoStack.length === 0) return;
  redoStack.push(snapshotState());
  const snap = undoStack.pop();
  await restoreState(snap);
}
async function doRedo() {
  if (redoStack.length === 0) return;
  undoStack.push(snapshotState());
  const snap = redoStack.pop();
  await restoreState(snap);
}

// =====================================================================
// Object record creation + lifecycle.
// =====================================================================

function nextId(type) {
  // ID prefix derivation:
  //   • All sized platforms / slopes / variants collapse to "platform_N" (so the user sees
  //     platform_1, platform_2 regardless of size).
  //   • Flags collapse to "flag_N".
  //   • Collectibles use the asset name (star/diamond/heart/power/ball).
  //   • Synth tools (spawn/answer-label/checkpoint) use their own short names.
  //   • Everything else uses the asset type with dashes turned into underscores.
  let prefix;
  if (type === 'answer-label')        prefix = 'answerlabel';
  else if (type === 'spawn')          prefix = 'spawn';
  else if (type === 'checkpoint')     prefix = 'checkpoint';
  else if (type.startsWith('platform_')) prefix = 'platform';
  else if (type.startsWith('flag_'))     prefix = 'flag';
  else                                prefix = type.replace(/[^a-z0-9]/g, '');
  state.nextSeq[prefix] = (state.nextSeq[prefix] || 0) + 1;
  let id = `${prefix}_${state.nextSeq[prefix]}`;
  // Defensive: if the counter got out of sync with what's already in the scene (loaded JSON
  // with higher seqs, an external editor, etc.), bump past any collision so we never overwrite
  // an existing record via state.objects.set(id, ...).
  while (isIdInUse(id)) {
    state.nextSeq[prefix]++;
    id = `${prefix}_${state.nextSeq[prefix]}`;
  }
  return id;
}

function isIdInUse(id) {
  if (state.objects.has(id)) return true;
  if (state.spawn?.id === id) return true;
  if (state.flag?.id === id) return true;
  return false;
}

// Spawn a fresh object record into state. `data` is the JSON-format object (id, type, position, …).
async function spawnRec(data, { suppressUndo = false } = {}) {
  const asset = ASSET_CATALOG.find(a => a.type === data.type);
  if (!asset) {
    console.warn('Unknown type', data.type);
    return null;
  }

  // Singleton handling for flags (any flag_A/B/C — only one flag goal per level).
  if (asset.kind === 'flag') {
    await setFlag(data.position, data.type, data.color || asset.defaultColor, data.id, { suppressUndo });
    return state.flag;
  }

  let mesh;
  if (data.type === 'answer-label') {
    mesh = makeLabelSprite(data.text || 'word', data);
  } else if (data.type === 'checkpoint') {
    mesh = makeCheckpointMarker();
  } else if (asset.colors && asset.colors.length > 0) {
    // KayKit asset — resolve URL from (type, color).
    const color = data.color || asset.defaultColor;
    mesh = await cloneModel(urlFor(data.type, color));
    mesh.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  } else {
    return null;
  }
  const yOffset = meshYOffsetForType(data.type);
  mesh.position.set(data.position[0], data.position[1] - yOffset, data.position[2]);
  // 3-axis rotation: data.rotation is Y (preserved for backward compat with older levels);
  // optional data.rotationX / data.rotationZ provide tilt and roll. Euler order YXZ matches
  // the runtime level loader.
  mesh.rotation.order = 'YXZ';
  mesh.rotation.set(
    (data.rotationX || 0) * Math.PI / 180,
    (data.rotation  || 0) * Math.PI / 180,
    (data.rotationZ || 0) * Math.PI / 180,
  );
  const s = data.scale ?? 1;
  mesh.scale.set(s, s, s);
  scene.add(mesh);

  // Hover label.
  const idLabel = makeIdLabelSprite(data.id);
  idLabel.position.set(0, 1.2, 0);
  mesh.add(idLabel);
  idLabel.visible = state.labelsVisible;

  const rec = { data, mesh, idLabel, type: 'object' };
  state.objects.set(data.id, rec);
  if (!suppressUndo) state.dirty = true;
  return rec;
}

function disposeRec(rec) {
  if (rec.mesh && rec.mesh.parent) rec.mesh.parent.remove(rec.mesh);
  if (rec.dropLine) { scene.remove(rec.dropLine); rec.dropLine = null; }
}

async function setSpawn(position, id = null, { suppressUndo = false } = {}) {
  if (state.spawn?._mesh) scene.remove(state.spawn._mesh);
  if (state.spawn?._dropLine) scene.remove(state.spawn._dropLine);
  const mesh = makeSpawnMarker();
  mesh.position.set(position[0], position[1], position[2]);
  scene.add(mesh);
  const finalId = id || (state.spawn?.id || nextId('spawn'));
  state.spawn = { id: finalId, position: [...position], _mesh: mesh };
  const lbl = makeIdLabelSprite(finalId);
  lbl.position.set(0, 1.4, 0);
  mesh.add(lbl);
  lbl.visible = state.labelsVisible;
  state.spawn._idLabel = lbl;
  if (!suppressUndo) state.dirty = true;
}

// Singleton flag placement. type is one of 'flag_A' | 'flag_B' | 'flag_C'; color is one of the
// supported variants for that flag. Replaces any existing flag of any type with the new one.
async function setFlag(position, type = 'flag_C', color = 'blue', id = null, { suppressUndo = false } = {}) {
  if (state.flag?._mesh) scene.remove(state.flag._mesh);
  if (state.flag?._dropLine) scene.remove(state.flag._dropLine);
  const mesh = await cloneModel(urlFor(type, color));
  mesh.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  mesh.position.set(position[0], position[1], position[2]);
  scene.add(mesh);
  const finalId = id || (state.flag?.id || nextId(type));
  state.flag = { id: finalId, type, color, position: [...position], _mesh: mesh };
  const lbl = makeIdLabelSprite(finalId);
  lbl.position.set(0, 1.4, 0);
  mesh.add(lbl);
  lbl.visible = state.labelsVisible;
  state.flag._idLabel = lbl;
  if (!suppressUndo) state.dirty = true;
}

// =====================================================================
// Helper meshes: spawn marker, checkpoint marker, label sprite, ID label sprite.
// =====================================================================

function makeSpawnMarker() {
  const group = new THREE.Group();
  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 1.8, 8),
    new THREE.MeshBasicMaterial({ color: 0x2d8c4f }),
  );
  post.position.y = 0.9;
  group.add(post);
  const flag = new THREE.Mesh(
    new THREE.PlaneGeometry(0.9, 0.55),
    new THREE.MeshBasicMaterial({ color: 0x2d8c4f, side: THREE.DoubleSide }),
  );
  flag.position.set(0.45, 1.45, 0);
  group.add(flag);
  return group;
}

function makeCheckpointMarker() {
  const group = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.7, 0.08, 8, 24),
    new THREE.MeshBasicMaterial({ color: 0xffaa00 }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.1;
  group.add(ring);
  return group;
}

// Style 3 translucent bubble preview, scaled smaller for the editor — same recipe as the
// game's answer-label so the editor view matches the in-game render.
function makeLabelSprite(text, data = {}) {
  const FONT_PX = { small: 200, medium: 280, large: 360 }[data.fontSize] || 280;
  const TINT = ({
    white:  'rgba(110, 180, 255, 0.85)',
    red:    'rgba(255, 110, 110, 0.85)',
    green:  'rgba(110, 220, 130, 0.85)',
    blue:   'rgba(110, 180, 255, 0.85)',
    yellow: 'rgba(255, 215, 90, 0.85)',
  })[data.color] || 'rgba(110, 180, 255, 0.85)';
  const HEIGHT_W = { small: 0.45, medium: 0.6, large: 0.8 }[data.fontSize] || 0.6;
  const H = 512;
  const font = `bold ${FONT_PX}px Arial, sans-serif`;
  const measure = document.createElement('canvas').getContext('2d');
  measure.font = font;
  const tw = measure.measureText(text || '').width;
  const W = Math.max(700, Math.ceil(tw + 220));
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, W, H);
  const r = 80;
  ctx.fillStyle = TINT;
  ctx.beginPath();
  ctx.moveTo(r, 0); ctx.arcTo(W, 0, W, H, r); ctx.arcTo(W, H, 0, H, r); ctx.arcTo(0, H, 0, 0, r); ctx.arcTo(0, 0, W, 0, r); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = font;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text || '', W / 2, H / 2);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  const planeW = Math.max(1.0, HEIGHT_W * (W / H));
  const geo = new THREE.PlaneGeometry(planeW, HEIGHT_W);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0.95 });
  const mesh = new THREE.Mesh(geo, mat);
  // Top-down readable: rotate flat in top-down view. We keep it billboarded approximately.
  return mesh;
}

// Vertical guide line from the object's XZ position down to Y=0. Hidden when the object is on
// the ground plane. Helps locate objects placed at non-zero Y in top-down view, where
// elevation is otherwise invisible. The geometry is a unit-length segment along +Y that we
// position at (x, 0, z) and scale-Y to the object's height — works for negative Y too.
function makeDropLine() {
  const geo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 1, 0),
  ]);
  const mat = new THREE.LineBasicMaterial({ color: 0x5078ff, transparent: true, opacity: 0.6 });
  return new THREE.Line(geo, mat);
}

function ensureDropLineOn(container, key) {
  if (!container[key]) {
    container[key] = makeDropLine();
    scene.add(container[key]);
  }
  return container[key];
}

// Drop-line takes a {x, y, z} representing the LOGICAL position of the object — for platforms
// that's the walkable top (data.position[1]), not the mesh anchor. So the line visualizes the
// Y the user typed in the properties panel.
function updateDropLine(line, wp) {
  if (!line || !wp) return;
  const h = wp.y;
  if (Math.abs(h) < 0.01) { line.visible = false; return; }
  line.visible = true;
  line.position.set(wp.x, 0, wp.z);
  line.scale.y = h;
}

function updateAllDropLines() {
  for (const rec of state.objects.values()) {
    const line = ensureDropLineOn(rec, 'dropLine');
    const [x, y, z] = rec.data.position;
    updateDropLine(line, { x, y, z });
  }
  if (state.spawn) {
    const line = ensureDropLineOn(state.spawn, '_dropLine');
    const [x, y, z] = state.spawn.position;
    updateDropLine(line, { x, y, z });
  }
  if (state.flag) {
    const line = ensureDropLineOn(state.flag, '_dropLine');
    const [x, y, z] = state.flag.position;
    updateDropLine(line, { x, y, z });
  }
}

function makeIdLabelSprite(id) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(id, 128, 32);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const spr = new THREE.Sprite(mat);
  spr.scale.set(1.4, 0.35, 1);
  spr.renderOrder = 999;
  return spr;
}

// =====================================================================
// Input: pan/zoom, picking, placement preview.
// =====================================================================

const raycaster = new THREE.Raycaster();
const mouseNdc = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

function cursorWorldPos(ev) {
  const rect = canvas.getBoundingClientRect();
  mouseNdc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  mouseNdc.y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);
  raycaster.setFromCamera(mouseNdc, camera);
  // Plane Y depends on current Y plane.
  groundPlane.constant = -state.yPlane;
  const hit = new THREE.Vector3();
  raycaster.ray.intersectPlane(groundPlane, hit);
  return hit;
}

// Asset-aware snap. The grid is 1×1; we want each asset's FOOTPRINT corners to land on grid
// corners (not the mesh center). For a half-width h, snap targets are integers + h:
//   • Even-sized platforms (2/4/6 wide → h = 1/2/3) snap to integers, so the mesh covers
//     `w` whole cells from cellCorner to cellCorner+w.
//   • Odd-sized platforms (1 wide → h = 0.5) snap to half-integers, so the mesh covers
//     one cell from cellCorner to cellCorner+1.
// Synth tools / assets without a footprint half default to 0.5 (treat them as 1×1 — places
// them at cell centers, which reads better than landing on a corner-of-4 intersection).
function snapped(pos, asset = null) {
  // snapHalf (when present) carries the snap PARITY separately from the visual footprint —
  // user prefabs / duplicates set it so copies land on the same sub-grid as their originals,
  // while `half` stays the true bounding footprint for the placement shadow.
  const halfX = asset?.snapHalf?.x ?? asset?.half?.x ?? 0.5;
  const halfZ = asset?.snapHalf?.z ?? asset?.half?.z ?? 0.5;
  return [
    Math.round(pos.x - halfX) + halfX,
    Math.round(pos.y / Y_SNAP) * Y_SNAP,
    Math.round(pos.z - halfZ) + halfZ,
  ];
}

let placementPreview = null;
async function setPlacementPreview(asset) {
  if (placementPreview) { scene.remove(placementPreview); placementPreview = null; }
  if (!asset) {
    placementShadow.visible = false;
    return;
  }
  // Size the ground shadow to the asset's XZ footprint. Synth tools / labels without a
  // footprint fall back to a 1×1 cell so the user still sees which cell will receive them.
  const shadowHalfX = asset.half?.x ?? 0.5;
  const shadowHalfZ = asset.half?.z ?? 0.5;
  placementShadow.scale.set(shadowHalfX * 2, shadowHalfZ * 2, 1);
  placementShadow.visible = true;
  if (asset.type === 'answer-label') {
    placementPreview = makeLabelSprite('label', {});
  } else if (asset.type === 'checkpoint') {
    placementPreview = makeCheckpointMarker();
  } else if (asset.type === 'spawn') {
    placementPreview = makeSpawnMarker();
  } else if (asset.kind === 'prefab') {
    // Prefab: load every component model and position it relative to the prefab anchor. The
    // user sees the full layout following the cursor, not just a single placeholder.
    // Pre-pass: collect each named slot's offset so attached labels can be placed at the
    // host's position + the label's offset (matching how the runtime renders them).
    const slotOffsets = {};
    for (const comp of asset.objects) {
      if (comp.name) slotOffsets[comp.name] = { dx: comp.dx, dy: comp.dy, dz: comp.dz };
    }
    const group = new THREE.Group();
    for (const comp of asset.objects) {
      let mesh;
      if (comp.type === 'answer-label') {
        mesh = makeLabelSprite(comp.text || 'word', { fontSize: comp.fontSize, color: comp.color });
      } else {
        const catalog = CATALOG_BY_TYPE[comp.type];
        const color = comp.color || catalog?.defaultColor || 'blue';
        mesh = await cloneModel(urlFor(comp.type, color));
      }
      // Effective preview position: for attached labels, add the linked slot's offset so the
      // bubble floats above its platform; for everything else, the component offset is used
      // directly relative to the prefab anchor.
      let ex = comp.dx, ey = comp.dy, ez = comp.dz;
      if (comp.attachedToSlot && slotOffsets[comp.attachedToSlot]) {
        const h = slotOffsets[comp.attachedToSlot];
        ex += h.dx; ey += h.dy; ez += h.dz;
      }
      mesh.position.set(ex, ey, ez);
      mesh.rotation.order = 'YXZ';
      mesh.rotation.set(
        (comp.rotationX || 0) * Math.PI / 180,
        (comp.rotation  || 0) * Math.PI / 180,
        (comp.rotationZ || 0) * Math.PI / 180,
      );
      const s = comp.scale || 1;
      mesh.scale.set(s, s, s);
      group.add(mesh);
    }
    placementPreview = group;
  } else if (asset.colors && asset.colors.length > 0) {
    // Use the asset's pending placement color (defaults to defaultColor) so the preview
    // reflects which color will actually be placed.
    placementPreview = await cloneModel(urlFor(asset.type, state.placementColor || asset.defaultColor));
  }
  if (placementPreview) {
    // Apply the pending rotation so the user can see the orientation before placing.
    placementPreview.rotation.y = (state.placementRotation || 0) * Math.PI / 180;
  }
  if (placementPreview) {
    placementPreview.traverse?.(o => {
      if (o.material) {
        o.material = o.material.clone();
        o.material.transparent = true;
        o.material.opacity = 0.45;
      }
    });
    scene.add(placementPreview);
  }
}

canvas.addEventListener('mousemove', (ev) => {
  const wp = cursorWorldPos(ev);
  if (!wp) return;
  const [sx, sy, sz] = snapped(wp, state.activeTool);
  document.getElementById('status-cursor').textContent = `X: ${sx}  Z: ${sz}`;
  if (placementPreview) {
    // For platform-kind tools, lower the preview by `height` so the walkable top sits at the
    // current Y plane — matching what spawnRec does on placement.
    const yOff = state.activeTool ? meshYOffsetForType(state.activeTool.type) : 0;
    placementPreview.position.set(sx, state.yPlane - yOff, sz);
  }
  if (placementShadow.visible) {
    placementShadow.position.x = sx;
    placementShadow.position.z = sz;
  }
});

// Right-click serves two roles on the viewport: a drag pans (top-down) or orbits (perspective),
// while a quick click-and-release with no significant drag drops the active placement tool —
// i.e. returns the user to "select" mode. The drag-vs-click discrimination lives in the global
// mouseup handler below. preventDefault here suppresses the browser's context menu.
canvas.addEventListener('contextmenu', (ev) => { ev.preventDefault(); });

// Box-select state. Tracking is started on left-mousedown in select mode and resolved on
// mouseup as either a click (tiny movement, do a single pick) or a marquee (significant drag,
// box-select every object whose projected XZ center lands inside the screen rectangle).
let boxSelect = null;
const BOX_SELECT_PX_THRESHOLD = 4;
let marqueeDiv = null;
function ensureMarqueeDiv() {
  if (marqueeDiv) return marqueeDiv;
  marqueeDiv = document.createElement('div');
  marqueeDiv.style.cssText = [
    'position: absolute',
    'pointer-events: none',
    'border: 1px solid #ffcc00',
    'background: rgba(255, 204, 0, 0.12)',
    'display: none',
    'z-index: 100',
    'box-sizing: border-box',
  ].join(';');
  document.getElementById('viewport-wrap').appendChild(marqueeDiv);
  return marqueeDiv;
}

canvas.addEventListener('mousedown', async (ev) => {
  if (ev.button !== 0) return;       // left-click only for place/pick
  if (panActive || rotateActive) return;

  try {
    if (state.activeTool) {
      const wp = cursorWorldPos(ev);
      if (!wp) return;
      const [sx, , sz] = snapped(wp, state.activeTool);
      await placeAtCursor(sx, state.yPlane, sz);
      return;
    }

    // Select mode: defer the actual pick to mouseup so the user can either click (no drag) or
    // drag. A drag starting ON an object moves it; a drag starting on empty ground marquee-
    // selects. Just record the starting state here — the threshold logic decides which.
    boxSelect = {
      startX: ev.clientX, startY: ev.clientY,
      currentX: ev.clientX, currentY: ev.clientY,
      additive: ev.ctrlKey || ev.metaKey || ev.shiftKey,
      activated: false,                          // true once we've crossed the drag threshold
      preSelection: new Set(state.selectedIds),  // snapshot for additive marquee
      hitId: null,                               // object under the press → drag becomes a move
    };
    // Additive presses stay pure selection ops (marquee/toggle); only plain presses can move.
    if (!boxSelect.additive) {
      const rect = canvas.getBoundingClientRect();
      mouseNdc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      mouseNdc.y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);
      boxSelect.hitId = pickAtCursor();
    }
  } catch (err) {
    // An async error in an event handler is otherwise silent — surface it so the editor doesn't
    // appear to silently swallow clicks.
    console.error('[editor] placement/pick failed:', err);
    alert(`Editor error: ${err?.message || err}`);
  }
});

function pickAtCursor() {
  raycaster.setFromCamera(mouseNdc, camera);
  // Gather candidate meshes AND sprites. Sprites are included so users can click the floating
  // ID label to pick an object that would otherwise be edge-on (e.g. answer-labels seen from
  // directly above are zero pixels wide).
  const candidates = [];
  const rootByMesh = new WeakMap();
  const collect = (root, id) => {
    root.traverse(m => {
      if (m.isMesh || m.isSprite) { candidates.push(m); rootByMesh.set(m, id); }
    });
  };
  for (const rec of state.objects.values()) collect(rec.mesh, rec.data.id);
  if (state.spawn) collect(state.spawn._mesh, state.spawn.id);
  if (state.flag)  collect(state.flag._mesh,  state.flag.id);
  const hits = raycaster.intersectObjects(candidates, false);
  return hits[0] ? rootByMesh.get(hits[0].object) : null;
}

async function placeAtCursor(x, y, z) {
  const asset = state.activeTool;
  if (asset.kind === 'prefab') {
    // Expand each component into its own state.objects entry. Single pushUndo before the loop
    // means one Ctrl+Z wipes the entire prefab placement. The current state.placementRotation
    // is applied to every component: world-positioned components have their (dx, dz) offsets
    // rotated around the cursor before placement, and every component's local rotation gets
    // the placement angle added — so the prefab places as a coherent rotated unit.
    pushUndo();
    // slotIds maps a prefab's named slot to the platform's freshly generated id, so a label
    // component's `attachedToSlot: 'podium'` resolves to a real `attachedTo: 'platform_N'`.
    const slotIds = {};
    const rotDeg = state.placementRotation || 0;
    const rotRad = rotDeg * Math.PI / 180;
    const cosA = Math.cos(rotRad), sinA = Math.sin(rotRad);
    for (const comp of asset.objects) {
      const catalog = CATALOG_BY_TYPE[comp.type];
      const isLabel = comp.type === 'answer-label';
      // Rotate the (dx, dz) offset around the anchor. Attached labels keep their host-relative
      // offset untouched — the host carries the rotation, applyAttachedLabelPositions follows.
      let placed;
      if (isLabel && comp.attachedToSlot) {
        placed = [comp.dx, comp.dy, comp.dz];
      } else {
        const rx = comp.dx * cosA - comp.dz * sinA;
        const rz = comp.dx * sinA + comp.dz * cosA;
        placed = [x + rx, y + comp.dy, z + rz];
      }
      const data = {
        id: nextId(comp.type),
        type: comp.type,
        position: placed,
        // Y (yaw) inherits the prefab's placement rotation; X/Z are component-local tilts
        // that pass through unchanged so a tilted hammer in a saved prefab stays tilted.
        rotation: ((comp.rotation || 0) + rotDeg) % 360,
        scale: comp.scale || 1,
      };
      if (comp.rotationX) data.rotationX = comp.rotationX;
      if (comp.rotationZ) data.rotationZ = comp.rotationZ;
      if (isLabel) {
        data.text = comp.text || 'word';
        data.fontSize = comp.fontSize || 'medium';
        data.color = comp.color || 'white';
        data.attachedTo = comp.attachedToSlot ? (slotIds[comp.attachedToSlot] || null) : null;
      } else if (catalog?.colors?.length > 0) {
        data.color = comp.color || catalog.defaultColor || 'blue';
      }
      if (catalog?.kind === 'platform') data.correctAnswer = comp.correctAnswer === true;
      // Behavior-bearing components (conveyors, hazards) inherit the saved component value if
      // present, else the catalog's default. Lets a saved prefab carry custom motion settings.
      if (catalog?.behavior && catalog.defaults) {
        for (const [k, v] of Object.entries(catalog.defaults)) {
          data[k] = (comp[k] !== undefined) ? comp[k] : v;
        }
      }
      await spawnRec(data);
      if (comp.name) slotIds[comp.name] = data.id;
    }
    refreshAll();
    return;
  }
  if (asset.type === 'spawn') {
    pushUndo();
    await setSpawn([x, y, z]);
  } else if (asset.kind === 'flag') {
    // Singleton: warn if replacing.
    if (state.flag) {
      const ok = confirm('A flag already exists. Replace it?');
      if (!ok) return;
    }
    pushUndo();
    const color = state.placementColor || asset.defaultColor;
    await setFlag([x, y, z], asset.type, color);
  } else {
    pushUndo();
    const data = {
      id: nextId(asset.type),
      type: asset.type,
      position: [x, y, z],
      rotation: state.placementRotation || 0,
      scale: 1,
    };
    if (asset.type === 'answer-label') {
      data.text = 'word';
      data.fontSize = 'medium';
      data.color = 'white';   // answer-label "color" is its bubble tint, separate from KayKit colors
      data.attachedTo = null;
    } else if (asset.colors && asset.colors.length > 0) {
      // KayKit asset — set color from the active swatch (or its catalog default).
      data.color = state.placementColor || asset.defaultColor;
    }
    // For red platforms placed as wrong-answer platforms, the user can later flip the
    // Correct Answer checkbox in the properties panel.
    if (asset.kind === 'platform') data.correctAnswer = false;
    // For hazards and conveyors (anything with a `behavior`), seed the per-instance motion
    // parameters from the catalog's defaults so the runtime always finds usable values.
    if (asset.behavior && asset.defaults) {
      for (const [k, v] of Object.entries(asset.defaults)) {
        if (data[k] === undefined) data[k] = v;
      }
    }
    await spawnRec(data);
  }
  refreshAll();
}

// Camera drag controls:
//   • Right-button drag: pan (top-down) or orbit (perspective)
//   • Middle-button drag: pan in both views (translates the orbit target in perspective)
let panActive = false;          // right-button pan in top-down
let rotateActive = false;       // right-button orbit in perspective
let panMiddleActive = false;    // middle-button pan in either view
let lastMouse = { x: 0, y: 0 };
// Track where the right-button press began so mouseup can tell a quick click apart from a
// pan/orbit drag. A click (drag distance below the threshold) drops the active placement tool
// → returns the user to "select" mode. A drag pans/orbits as before.
let rightDownAt = null;
const RIGHT_CLICK_DRAG_THRESHOLD = 4;   // pixels

canvas.addEventListener('mousedown', (ev) => {
  if (ev.button === 2) {
    if (viewMode === 'top') panActive = true;
    else rotateActive = true;
    lastMouse = { x: ev.clientX, y: ev.clientY };
    rightDownAt = { x: ev.clientX, y: ev.clientY };
  } else if (ev.button === 1) {
    panMiddleActive = true;
    lastMouse = { x: ev.clientX, y: ev.clientY };
    // Suppress the browser's default middle-click behavior (autoscroll on Windows/Linux).
    ev.preventDefault();
  }
});
// auxclick fires for non-primary buttons; prevent the default for middle so it doesn't toggle
// autoscroll mid-drag in some browsers.
canvas.addEventListener('auxclick', (ev) => { if (ev.button === 1) ev.preventDefault(); });

window.addEventListener('mousemove', (ev) => {
  const dx = ev.clientX - lastMouse.x;
  const dy = ev.clientY - lastMouse.y;
  lastMouse = { x: ev.clientX, y: ev.clientY };
  if (panActive) {
    const scale = (orthoZoom * 2) / canvas.clientHeight;
    camPan.x -= dx * scale;
    camPan.z -= dy * scale;
  } else if (rotateActive) {
    perspOrbit.yaw   -= dx * 0.005;
    perspOrbit.pitch -= dy * 0.005;
    perspOrbit.pitch = Math.max(-Math.PI / 2.05, Math.min(-0.05, perspOrbit.pitch));
  } else if (panMiddleActive) {
    if (viewMode === 'top') {
      const scale = (orthoZoom * 2) / canvas.clientHeight;
      camPan.x -= dx * scale;
      camPan.z -= dy * scale;
    } else {
      // World units per screen pixel at the current orbit distance + camera FOV.
      const fovRad = perspCam.fov * Math.PI / 180;
      const worldPerPx = (2 * perspOrbit.dist * Math.tan(fovRad / 2)) / canvas.clientHeight;
      const right = new THREE.Vector3();
      const up    = new THREE.Vector3();
      right.setFromMatrixColumn(perspCam.matrix, 0);
      up.setFromMatrixColumn(perspCam.matrix, 1);
      // Drag right → world appears to shift right → target moves left, and similarly for Y.
      perspOrbit.target.addScaledVector(right, -dx * worldPerPx);
      perspOrbit.target.addScaledVector(up,    +dy * worldPerPx);
    }
  } else if (dragMove) {
    updateDragMove(ev);
  } else if (boxSelect) {
    boxSelect.currentX = ev.clientX;
    boxSelect.currentY = ev.clientY;
    const moved = Math.hypot(ev.clientX - boxSelect.startX, ev.clientY - boxSelect.startY);
    if (!boxSelect.activated && moved >= BOX_SELECT_PX_THRESHOLD) {
      if (boxSelect.hitId) {
        // Drag began on an object → move it (and the rest of the selection) instead of marquee.
        startDragMove();
      } else {
        boxSelect.activated = true;
        ensureMarqueeDiv().style.display = 'block';
      }
    }
    if (boxSelect && boxSelect.activated) updateMarqueeRect();
  }
});

// ── Drag-move. Started from the boxSelect threshold logic when the press landed on an object.
// Moves the whole selection in the XZ plane at the grabbed object's height, snapped so the
// GRABBED object keeps its normal grid parity (the rest of the selection rides along rigidly).
// One pushUndo at drag start covers the entire gesture.
let dragMove = null;
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

function startDragMove() {
  const id = boxSelect.hitId;
  const startX = boxSelect.startX, startY = boxSelect.startY;
  boxSelect = null;
  // Grabbing an unselected object replaces the selection with it (standard editor behavior).
  if (!state.selectedIds.has(id)) {
    state.selectedIds.clear();
    state.selectedIds.add(id);
    refreshAll();
  }
  const grabRec = getRecordById(id);
  if (!grabRec?.mesh) return;
  // Ray from the PRESS position onto the horizontal plane through the grabbed mesh — that's
  // the anchor the drag delta is measured from (works in both top-down and perspective).
  const rect = canvas.getBoundingClientRect();
  mouseNdc.x = ((startX - rect.left) / rect.width) * 2 - 1;
  mouseNdc.y = -(((startY - rect.top) / rect.height) * 2 - 1);
  raycaster.setFromCamera(mouseNdc, camera);
  dragPlane.constant = -grabRec.mesh.position.y;
  const startWorld = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(dragPlane, startWorld)) return;

  pushUndo();
  const entries = [];
  for (const selId of state.selectedIds) {
    const rec = getRecordById(selId);
    if (!rec) continue;
    entries.push({
      rec,
      start: [...rec.data.position],
      startMesh: rec.mesh ? { x: rec.mesh.position.x, z: rec.mesh.position.z } : null,
      skip: attachedHostSelected(rec),   // host carries its attached labels
    });
  }
  const grabType = grabRec.data?.type || grabRec.type;   // spawn record has no data.type
  dragMove = {
    planeY: grabRec.mesh.position.y,
    startWorld,
    grabStartMesh: { x: grabRec.mesh.position.x, z: grabRec.mesh.position.z },
    snapAsset: ASSET_CATALOG.find(a => a.type === grabType) || null,
    entries,
  };
  canvas.style.cursor = 'move';
}

function updateDragMove(ev) {
  const rect = canvas.getBoundingClientRect();
  mouseNdc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  mouseNdc.y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);
  raycaster.setFromCamera(mouseNdc, camera);
  dragPlane.constant = -dragMove.planeY;
  const hit = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(dragPlane, hit)) return;
  // Raw delta, then re-snap the grabbed object's would-be position so it keeps grid parity.
  const candidate = {
    x: dragMove.grabStartMesh.x + (hit.x - dragMove.startWorld.x),
    y: 0,
    z: dragMove.grabStartMesh.z + (hit.z - dragMove.startWorld.z),
  };
  const [sx, , sz] = snapped(candidate, dragMove.snapAsset);
  const dx = sx - dragMove.grabStartMesh.x;
  const dz = sz - dragMove.grabStartMesh.z;
  for (const e of dragMove.entries) {
    if (e.skip) continue;
    e.rec.data.position[0] = e.start[0] + dx;
    e.rec.data.position[2] = e.start[2] + dz;
    if (e.rec.mesh && e.startMesh) {
      e.rec.mesh.position.x = e.startMesh.x + dx;
      e.rec.mesh.position.z = e.startMesh.z + dz;
    }
  }
  applyAttachedLabelPositions();
  updateAllDropLines();
  refreshSelectionHelpers();
  document.getElementById('status-cursor').textContent = `X: ${sx}  Z: ${sz}`;
}

// Sync the marquee div's CSS with the current boxSelect drag rectangle.
function updateMarqueeRect() {
  if (!boxSelect || !marqueeDiv) return;
  const wrapRect = document.getElementById('viewport-wrap').getBoundingClientRect();
  const x1 = Math.min(boxSelect.startX, boxSelect.currentX) - wrapRect.left;
  const y1 = Math.min(boxSelect.startY, boxSelect.currentY) - wrapRect.top;
  const x2 = Math.max(boxSelect.startX, boxSelect.currentX) - wrapRect.left;
  const y2 = Math.max(boxSelect.startY, boxSelect.currentY) - wrapRect.top;
  marqueeDiv.style.left   = x1 + 'px';
  marqueeDiv.style.top    = y1 + 'px';
  marqueeDiv.style.width  = (x2 - x1) + 'px';
  marqueeDiv.style.height = (y2 - y1) + 'px';
}
window.addEventListener('mouseup', (ev) => {
  // Right-button release: if the cursor barely moved since the press, treat it as a click and
  // return to "select" mode by clearing the active placement tool. A drag (pan/orbit) is left
  // alone — only the no-drag case fires the select action.
  if (ev.button === 2 && rightDownAt) {
    const dx = ev.clientX - rightDownAt.x;
    const dy = ev.clientY - rightDownAt.y;
    if (Math.hypot(dx, dy) < RIGHT_CLICK_DRAG_THRESHOLD && state.activeTool) {
      setActiveTool(null);
    }
  }
  // Left-button release: finalize an in-flight drag-move (positions are already applied per
  // mousemove; this just syncs the properties panel and restores the cursor).
  if (ev.button === 0 && dragMove) {
    dragMove = null;
    canvas.style.cursor = '';
    refreshAll();
  }
  // Left-button release: resolve any pending box-select started in the canvas mousedown handler.
  if (ev.button === 0 && boxSelect) {
    if (boxSelect.activated) {
      resolveBoxSelect();
      if (marqueeDiv) marqueeDiv.style.display = 'none';
    } else {
      // No real drag — treat as a normal click. Run the pick at the original mousedown position.
      resolveClickSelect(ev);
    }
    boxSelect = null;
  }
  rightDownAt = null;
  panActive = false; rotateActive = false; panMiddleActive = false;
});

// "Click" branch of the deferred select: the user pressed and released without crossing the
// drag threshold. Apply the same pick logic the editor had before box-select was added.
function resolveClickSelect(ev) {
  // Update mouseNdc to the release position so pickAtCursor's raycast hits the right pixel.
  const rect = canvas.getBoundingClientRect();
  mouseNdc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  mouseNdc.y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);
  const hit = pickAtCursor();
  const toggle = boxSelect.additive;
  if (hit) {
    if (toggle) {
      if (state.selectedIds.has(hit)) state.selectedIds.delete(hit);
      else state.selectedIds.add(hit);
    } else {
      state.selectedIds.clear();
      state.selectedIds.add(hit);
    }
  } else if (!toggle) {
    state.selectedIds.clear();
  }
  refreshAll();
}

// "Drag" branch: project every selectable object's world position into screen space and add the
// ones inside the marquee rectangle to the selection. Additive (Ctrl/Shift held at mousedown)
// keeps the prior selection; non-additive replaces it.
function resolveBoxSelect() {
  const rect = canvas.getBoundingClientRect();
  const x1 = Math.min(boxSelect.startX, boxSelect.currentX) - rect.left;
  const y1 = Math.min(boxSelect.startY, boxSelect.currentY) - rect.top;
  const x2 = Math.max(boxSelect.startX, boxSelect.currentX) - rect.left;
  const y2 = Math.max(boxSelect.startY, boxSelect.currentY) - rect.top;
  const W = rect.width, H = rect.height;
  const v = new THREE.Vector3();
  const isInside = (worldPos) => {
    v.copy(worldPos).project(camera);
    const px = (v.x * 0.5 + 0.5) * W;
    const py = (-v.y * 0.5 + 0.5) * H;
    return px >= x1 && px <= x2 && py >= y1 && py <= y2 && v.z < 1;
  };
  const inside = new Set();
  for (const rec of state.objects.values()) {
    if (isInside(rec.mesh.position)) inside.add(rec.data.id);
  }
  if (state.spawn?._mesh && isInside(state.spawn._mesh.position)) inside.add(state.spawn.id);
  if (state.flag?._mesh  && isInside(state.flag._mesh.position))  inside.add(state.flag.id);

  if (boxSelect.additive) {
    // Keep prior selection; add inside-rect ones to it.
    for (const id of inside) state.selectedIds.add(id);
  } else {
    state.selectedIds.clear();
    for (const id of inside) state.selectedIds.add(id);
  }
  refreshAll();
}

canvas.addEventListener('wheel', (ev) => {
  ev.preventDefault();
  if (viewMode === 'top') {
    orthoZoom *= ev.deltaY > 0 ? 1.1 : 0.9;
    orthoZoom = Math.max(4, Math.min(120, orthoZoom));
    resize();
  } else {
    perspOrbit.dist *= ev.deltaY > 0 ? 1.1 : 0.9;
    perspOrbit.dist = Math.max(6, Math.min(200, perspOrbit.dist));
  }
}, { passive: false });

// =====================================================================
// Keyboard.
// =====================================================================

const keysDown = new Set();
window.addEventListener('keydown', async (ev) => {
  // Don't capture editor shortcuts while focus is in a text input.
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    if (ev.key === 'Escape') document.activeElement.blur();
    return;
  }

  keysDown.add(ev.key.toLowerCase());

  if (ev.key === 'Escape') {
    // Esc closes the help overlay first; only a second Esc touches tool/selection state.
    const help = document.getElementById('help-panel');
    if (!help.hidden) { help.hidden = true; return; }
    setActiveTool(null);
    state.selectedIds.clear();
    refreshAll();
    return;
  }
  if (ev.key === 'Delete' || ev.key === 'Backspace') {
    if (state.selectedIds.size > 0) {
      pushUndo();
      for (const id of state.selectedIds) deleteById(id);
      state.selectedIds.clear();
      refreshAll();
    }
    return;
  }
  if ((ev.ctrlKey || ev.metaKey) && !ev.shiftKey && ev.key.toLowerCase() === 'z') {
    ev.preventDefault();
    await doUndo();
    return;
  }
  if ((ev.ctrlKey || ev.metaKey) && (ev.key.toLowerCase() === 'y' || (ev.shiftKey && ev.key.toLowerCase() === 'z'))) {
    ev.preventDefault();
    await doRedo();
    return;
  }
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's') {
    ev.preventDefault();
    saveJSON();
    return;
  }
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'd') {
    ev.preventDefault();          // keep the browser's bookmark dialog out of the way
    duplicateSelection();
    return;
  }
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'a') {
    ev.preventDefault();
    selectAll();
    return;
  }
  if (ev.key === 'f' || ev.key === 'F') { frameSelection(); return; }
  if (ev.key === 'p') { setViewMode('perspective'); return; }
  if (ev.key === 'o') { setViewMode('top'); return; }
  if (ev.key === '+' || ev.key === '=' || ev.key === ']') { bumpYPlane(+Y_SNAP); return; }
  if (ev.key === '-' || ev.key === '_' || ev.key === '[') { bumpYPlane(-Y_SNAP); return; }
  if (ev.key === 'l') { state.labelsVisible = !state.labelsVisible; applyLabelVisibility(); return; }
  if (ev.key === 'g') { state.gridVisible = !state.gridVisible; applyGridVisibility(); return; }
  if (ev.key === 'r' || ev.key === 'R') {
    // R rotates by 90° (or 15° with Shift). Operates on the current selection if any, else on
    // the active placement preview.
    const step = ev.shiftKey ? 15 : 90;
    rotateActiveOrSelection(step);
    return;
  }
  // PageUp/PageDown: move the selection ±1 in Y (or step the Y plane while placing).
  if (ev.key === 'PageUp')   { ev.preventDefault(); nudgeSelectionY(+1); return; }
  if (ev.key === 'PageDown') { ev.preventDefault(); nudgeSelectionY(-1); return; }
  // WASD: half-cell nudge in the four horizontal directions. Top-down convention: W=north (-Z),
  // S=south (+Z), A=west (-X), D=east (+X). Works on selection or hovering preview.
  // Shift+W / Shift+S move vertically instead — same target rules as PageUp/PageDown.
  if (ev.key === 'w' || ev.key === 'W') { if (ev.shiftKey) nudgeSelectionY(+1); else nudgeActiveOrSelection( 0, -0.5); return; }
  if (ev.key === 's' || ev.key === 'S') { if (ev.shiftKey) nudgeSelectionY(-1); else nudgeActiveOrSelection( 0,  0.5); return; }
  if (ev.key === 'a' || ev.key === 'A') { nudgeActiveOrSelection(-0.5,   0  ); return; }
  if (ev.key === 'd' || ev.key === 'D') { nudgeActiveOrSelection( 0.5,   0  ); return; }
  // Q / E: 45° rotation (same target as R: selection if any, else preview).
  if (ev.key === 'q' || ev.key === 'Q') { rotateActiveOrSelection(-45); return; }
  if (ev.key === 'e' || ev.key === 'E') { rotateActiveOrSelection( 45); return; }
  // Enter: place active tool at the current preview position (cursor + any WASD offset).
  if (ev.key === 'Enter') {
    if (state.activeTool && placementPreview) {
      ev.preventDefault();
      await placeAtPreview();
    }
    return;
  }
  if (ev.key === '?') { toggleHelp(); return; }
});
window.addEventListener('keyup', (ev) => { keysDown.delete(ev.key.toLowerCase()); });

function selectAll() {
  state.selectedIds.clear();
  for (const rec of state.objects.values()) state.selectedIds.add(rec.data.id);
  if (state.spawn) state.selectedIds.add(state.spawn.id);
  if (state.flag)  state.selectedIds.add(state.flag.id);
  refreshAll();
}

// Center the view on the selection (or on everything when nothing is selected). Top-down pans
// and zooms the ortho frustum to fit; perspective re-targets the orbit and fits the distance.
function frameSelection() {
  const meshes = [];
  if (state.selectedIds.size > 0) {
    for (const id of state.selectedIds) {
      const rec = getRecordById(id);
      if (rec?.mesh) meshes.push(rec.mesh);
    }
  } else {
    for (const rec of state.objects.values()) meshes.push(rec.mesh);
    if (state.spawn?._mesh) meshes.push(state.spawn._mesh);
    if (state.flag?._mesh)  meshes.push(state.flag._mesh);
  }
  if (meshes.length === 0) return;
  const box = new THREE.Box3();
  for (const m of meshes) box.expandByObject(m);
  if (box.isEmpty()) return;
  const center = box.getCenter(new THREE.Vector3());
  const size   = box.getSize(new THREE.Vector3());
  const radius = Math.max(size.x, size.z, 4) * 0.5;
  if (viewMode === 'top') {
    camPan.x = center.x;
    camPan.z = center.z;
    orthoZoom = Math.max(4, Math.min(120, radius * 1.6));
    resize();
  } else {
    perspOrbit.target.set(center.x, center.y, center.z);
    perspOrbit.dist = Math.max(6, Math.min(200, radius * 3 + size.y));
  }
}

function applyLabelVisibility() {
  for (const rec of state.objects.values()) if (rec.idLabel) rec.idLabel.visible = state.labelsVisible;
  if (state.spawn?._idLabel) state.spawn._idLabel.visible = state.labelsVisible;
  if (state.flag?._idLabel)  state.flag._idLabel.visible  = state.labelsVisible;
  refreshToolbarToggles();
}

function applyGridVisibility() {
  gridHelper.visible = state.gridVisible;
  coarseGrid.visible = state.gridVisible;
  refreshToolbarToggles();
}

function setViewMode(mode) {
  viewMode = mode;
  camera = mode === 'top' ? orthoCam : perspCam;
  document.getElementById('status-mode').textContent = mode === 'top' ? 'top-down' : 'perspective';
  resize();
  refreshToolbarToggles();
}

// Sync the toggle-style toolbar buttons with their state.
function refreshToolbarToggles() {
  document.getElementById('btn-view-top').classList.toggle('on',   viewMode === 'top');
  document.getElementById('btn-view-persp').classList.toggle('on', viewMode === 'perspective');
  document.getElementById('btn-labels').classList.toggle('on',     state.labelsVisible);
  document.getElementById('btn-grid').classList.toggle('on',       state.gridVisible);
  // Select mode is "no active tool" — when nothing's selected for placement, clicks pick.
  document.getElementById('btn-select').classList.toggle('on', state.activeTool === null);
}

function bumpYPlane(delta) {
  state.yPlane += delta;
  refreshStatus();
  // Re-project the last cursor screen position onto the new Y plane and snap. Critical in
  // PERSPECTIVE view: the camera ray is angled, so the same on-screen pixel hits a different
  // (X, Z) on each Y plane. Without this, the preview shows the new Y at the *old* X/Z and
  // then a click recomputes against the new plane — placing the platform somewhere the user
  // didn't see the preview. In TOP-DOWN ortho the projection is vertical and X/Z don't change,
  // so this is a no-op there.
  if (placementPreview && state.activeTool) {
    raycaster.setFromCamera(mouseNdc, camera);
    groundPlane.constant = -state.yPlane;
    const hit = new THREE.Vector3();
    raycaster.ray.intersectPlane(groundPlane, hit);
    const yOff = meshYOffsetForType(state.activeTool.type);
    if (hit && Number.isFinite(hit.x)) {
      const [sx, , sz] = snapped(hit, state.activeTool);
      document.getElementById('status-cursor').textContent = `X: ${sx}  Z: ${sz}`;
      placementPreview.position.set(sx, state.yPlane - yOff, sz);
    } else {
      placementPreview.position.y = state.yPlane - yOff;
    }
  }
}

// Translate selected objects (if any) OR the hovering placement preview (if no selection) by
// (dx, dz) in world units. The Y plane is untouched. Mousemove will snap the preview back to
// the cursor on the next pointer event, so WASD-driven nudges are a "until you move the mouse"
// override — perfect for fine-grained alignment.
function nudgeActiveOrSelection(dx, dz) {
  // Precedence: when something is "in hand" (placement preview hovering with cursor), the keys
  // operate on THAT, not on whatever was selected before the tool became active. Otherwise a
  // stale selection from before clicking Duplicate (or any library item) would silently catch
  // the keypress and shift the original instead of the new copy.
  if (state.activeTool && placementPreview) {
    placementPreview.position.x += dx;
    placementPreview.position.z += dz;
    if (placementShadow.visible) {
      placementShadow.position.x = placementPreview.position.x;
      placementShadow.position.z = placementPreview.position.z;
    }
    return;
  }
  if (state.selectedIds.size > 0) {
    pushUndo();
    for (const id of state.selectedIds) {
      const rec = getRecordById(id);
      if (!rec) continue;
      // Attached label whose host platform is also selected: its data.position is an offset
      // from the host, and the host's own translation already carries the label (via
      // applyAttachedLabelPositions). Adding the delta here too would move it twice.
      if (attachedHostSelected(rec)) continue;
      rec.data.position[0] += dx;
      rec.data.position[2] += dz;
      if (rec.mesh) {
        rec.mesh.position.x += dx;
        rec.mesh.position.z += dz;
      }
    }
    refreshAll();
  }
}

// True for records that ride a host (answer-label with attachedTo) when that host is part of
// the current selection — translation deltas must skip them or they move at 2x speed (the
// rotation path, rotateSelectionAroundCentroid, already skips attached labels the same way).
function attachedHostSelected(rec) {
  return !!(rec?.data?.attachedTo && state.selectedIds.has(rec.data.attachedTo));
}

// Move the current selection ±N units in Y. With a placement tool in hand the same keys step
// the Y plane instead (the preview's height is the Y plane, so that's the matching action).
// Same precedence rule as nudgeActiveOrSelection: tool-in-hand wins over a stale selection.
function nudgeSelectionY(dy) {
  if (state.activeTool) { bumpYPlane(dy * Y_SNAP); return; }
  if (state.selectedIds.size === 0) return;
  pushUndo();
  for (const id of state.selectedIds) {
    const rec = getRecordById(id);
    if (!rec) continue;
    if (attachedHostSelected(rec)) continue;   // host carries its attached labels
    rec.data.position[1] += dy;
    if (rec.mesh) rec.mesh.position.y += dy;
  }
  refreshAll();
}

// Place the active tool at the current preview position (driven by mouse + any WASD nudges).
// Used by the Enter keybind so the user can confirm a placement without clicking.
async function placeAtPreview() {
  if (!state.activeTool || !placementPreview) return;
  const x = placementPreview.position.x;
  const z = placementPreview.position.z;
  await placeAtCursor(x, state.yPlane, z);
}

// Rotate selected objects (if any) OR the active tool's placement rotation (if no selection).
// `degDelta` is the rotation in degrees (positive = CCW looking down). Snapped to 15° in case
// the user invokes this from arbitrary state.
function rotateActiveOrSelection(degDelta) {
  // Same precedence rule as nudgeActiveOrSelection: an active placement tool wins over a stale
  // selection. Otherwise pressing Q/E with a duplicate in hand would spin the original objects
  // (or any leftover selection) instead of the preview the user is positioning.
  if (state.activeTool) {
    state.placementRotation = (state.placementRotation + degDelta + 360) % 360;
    if (placementPreview) {
      placementPreview.rotation.y = state.placementRotation * Math.PI / 180;
    }
    return;
  }
  if (state.selectedIds.size > 0) {
    pushUndo();
    if (state.selectedIds.size >= 2) {
      rotateSelectionAroundCentroid(degDelta);
    } else {
      // Single selection: rotate in place. Only touches the Y axis — X/Z rotations stay
      // untouched, and the mesh re-applies them via applyMeshRotation.
      for (const id of state.selectedIds) {
        const rec = getRecordById(id);
        if (!rec || rec.type === 'spawn' || rec.type === 'flag') continue;
        const cur = rec.data.rotation || 0;
        const next = (cur + degDelta + 360) % 360;
        rec.data.rotation = next;
        applyMeshRotation(rec);
      }
    }
    refreshAll();
  }
}

// Multi-select rotation: pick the XZ centroid of the selected world positions and rotate each
// object's position around it AND bump its local rotation by the same delta. Attached labels
// are skipped from the centroid math and just receive the rotation bump — their offset is
// host-relative and the host's movement already drags them along (via applyAttachedLabelPositions).
function rotateSelectionAroundCentroid(degDelta) {
  // Collect world positions of objects whose position is in world space (not host-relative).
  const points = [];
  for (const id of state.selectedIds) {
    const rec = getRecordById(id);
    if (!rec || !rec.mesh) continue;
    if (rec.data && rec.data.attachedTo) continue;
    points.push({ id, x: rec.mesh.position.x, z: rec.mesh.position.z });
  }
  if (points.length === 0) return;
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const cz = points.reduce((s, p) => s + p.z, 0) / points.length;
  const rad = degDelta * Math.PI / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  for (const id of state.selectedIds) {
    const rec = getRecordById(id);
    if (!rec) continue;
    // Attached label: only spin its local rotation. Position is offset-from-host and will
    // be reconciled by applyAttachedLabelPositions in refreshAll.
    if (rec.data && rec.data.attachedTo) {
      if (typeof rec.data.rotation === 'number') {
        rec.data.rotation = ((rec.data.rotation + degDelta) % 360 + 360) % 360;
        applyMeshRotation(rec);
      }
      continue;
    }
    // World-positioned object: rotate position around centroid.
    const dx = rec.mesh.position.x - cx;
    const dz = rec.mesh.position.z - cz;
    const nx = dx * cos - dz * sin + cx;
    const nz = dx * sin + dz * cos + cz;
    if (Array.isArray(rec.data?.position)) {
      rec.data.position[0] = nx;
      rec.data.position[2] = nz;
    }
    rec.mesh.position.x = nx;
    rec.mesh.position.z = nz;
    // Bump local rotation if the object has one (spawn/flag don't, so they translate without spinning).
    if (typeof rec.data?.rotation === 'number') {
      rec.data.rotation = ((rec.data.rotation + degDelta) % 360 + 360) % 360;
      applyMeshRotation(rec);
    }
  }
}

// =====================================================================
// User prefab capture. Bundles the current multi-selection into a prefab definition with the
// same shape as the built-in PREFAB_ENTRIES — components stored as offsets from the selection's
// XZ centroid (and min-Y for the anchor's Y), with attachment relationships preserved when both
// host and attached label are in the selection. Each component remains an independent
// state.objects entry on placement (no group binding at runtime).
// =====================================================================

// Snapshot the current selection into a prefab definition (same shape as PREFAB_ENTRIES and
// state.userPrefabs entries). Returns null if the selection has no usable objects. Used by
// both "Save as Prefab" (names it, persists into state.userPrefabs) and "Duplicate" (passes the
// ephemeral prefab straight to setActiveTool so the copy follows the cursor).
function buildPrefabFromSelection(label) {
  const selected = [];
  for (const id of state.selectedIds) {
    if (state.objects.has(id)) selected.push(state.objects.get(id));
  }
  if (selected.length === 0) return null;

  // Anchor: XZ centroid of WORLD positions, min Y for Y. Attached labels store host-relative
  // offsets in data.position, so we use mesh.position.x/z instead for centroid math.
  let sumX = 0, sumZ = 0, minY = Infinity, count = 0;
  for (const rec of selected) {
    if (rec.data.attachedTo) continue;
    sumX += rec.mesh.position.x;
    sumZ += rec.mesh.position.z;
    if (rec.data.position[1] < minY) minY = rec.data.position[1];
    count++;
  }
  if (count === 0) return null;     // only attached labels — no host to anchor on
  const cx = sumX / count;
  const cz = sumZ / count;
  const cy = isFinite(minY) ? minY : 0;

  // Slot names let attached labels in the selection reference their host post-placement, just
  // like the built-in answer-gate prefab.
  const slotNameById = {};
  for (const rec of selected) {
    slotNameById[rec.data.id] = ('s_' + rec.data.id).replace(/[^a-z0-9_]/g, '_');
  }
  const selectedIdSet = new Set(selected.map(r => r.data.id));
  const components = [];
  for (const rec of selected) {
    const d = rec.data;
    const comp = { type: d.type, rotation: d.rotation || 0, scale: d.scale ?? 1 };
    if (d.rotationX) comp.rotationX = d.rotationX;
    if (d.rotationZ) comp.rotationZ = d.rotationZ;
    if (d.color) comp.color = d.color;
    if (d.type === 'answer-label') {
      if (d.text)     comp.text = d.text;
      if (d.fontSize) comp.fontSize = d.fontSize;
      if (d.attachedTo && selectedIdSet.has(d.attachedTo)) {
        comp.attachedToSlot = slotNameById[d.attachedTo];
        comp.dx = d.position[0];
        comp.dy = d.position[1];
        comp.dz = d.position[2];
      } else {
        comp.dx = rec.mesh.position.x - cx;
        comp.dy = rec.mesh.position.y - cy;
        comp.dz = rec.mesh.position.z - cz;
      }
    } else {
      comp.dx = d.position[0] - cx;
      comp.dy = d.position[1] - cy;
      comp.dz = d.position[2] - cz;
      if (typeof d.correctAnswer === 'boolean') comp.correctAnswer = d.correctAnswer;
      comp.name = slotNameById[d.id];
      // Carry the per-instance behavior parameters (conveyor speed, hammer period, etc.) into
      // the prefab so a duplicated/saved group preserves its motion tuning.
      const catalog = CATALOG_BY_TYPE[d.type];
      if (catalog?.behavior && catalog.defaults) {
        for (const k of Object.keys(catalog.defaults)) {
          if (d[k] !== undefined) comp[k] = d[k];
        }
      }
    }
    components.push(comp);
  }

  // Snap parity: the anchor must land on the same sub-grid the originals were placed on, or
  // every copy ends up offset by half a cell (a duplicated 6×6 platform snapped to .5 offsets
  // while the original sat on integer corners). The required parity is simply the centroid's
  // fractional part — snapping the anchor to (integer + parity) reproduces each component's
  // original world-position parity exactly. Rounded to kill float noise from the averaging.
  const frac = (v) => {
    const f = v - Math.floor(v);
    return Math.round(f * 1000) / 1000;
  };
  // Visual footprint for the placement shadow: XZ bounds of the world-positioned components
  // (catalog half-extents where known, 1×1 cells otherwise).
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const rec of selected) {
    if (rec.data.attachedTo) continue;
    const ch = CATALOG_BY_TYPE[rec.data.type]?.half;
    const hx = ch?.x ?? 0.5, hz = ch?.z ?? 0.5;
    minX = Math.min(minX, rec.mesh.position.x - hx);
    maxX = Math.max(maxX, rec.mesh.position.x + hx);
    minZ = Math.min(minZ, rec.mesh.position.z - hz);
    maxZ = Math.max(maxZ, rec.mesh.position.z + hz);
  }

  return {
    type: `userprefab_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    kind: 'prefab',
    category: 'user-prefabs',
    label: label || 'prefab',
    icon: '📦',
    colors: [],
    half: {
      x: isFinite(minX) ? Math.max(0.5, (maxX - minX) / 2) : 0.5,
      z: isFinite(minZ) ? Math.max(0.5, (maxZ - minZ) / 2) : 0.5,
    },
    snapHalf: { x: frac(cx), z: frac(cz) },
    objects: components,
  };
}

function saveSelectionAsPrefab() {
  if (state.selectedIds.size === 0) {
    alert('Select one or more objects first.');
    return;
  }
  const defaultName = `prefab ${state.userPrefabs.length + 1}`;
  const name = prompt('Prefab name:', defaultName);
  if (!name || !name.trim()) return;
  const prefab = buildPrefabFromSelection(name.trim());
  if (!prefab) {
    alert('Selection has no objects that can be saved (spawn/flag are skipped; attached labels need their host).');
    return;
  }
  state.userPrefabs.push(prefab);
  state.dirty = true;
  buildLibrary();
}

// Turn the current selection into an ephemeral prefab and make it the active placement tool.
// The copy follows the cursor (via the existing prefab preview path), accepts Q/E/R rotation
// and WASD nudging, and places on click or Enter.
function duplicateSelection() {
  if (state.selectedIds.size === 0) return;
  const prefab = buildPrefabFromSelection('duplicate');
  if (!prefab) {
    alert('Selection has nothing duplicable (spawn/flag are skipped; attached labels need their host).');
    return;
  }
  setActiveTool(prefab);
}

// =====================================================================
// Library panel — build it once at boot.
// =====================================================================

async function buildLibrary() {
  const list = document.getElementById('library-list');
  list.innerHTML = '';

  // Combine the static catalog with any user-defined prefabs so the library renders both.
  const allAssets = [...ASSET_CATALOG, ...state.userPrefabs];
  for (const [cat, sectionLabel] of LIBRARY_SECTIONS) {
    const items = allAssets.filter(a => a.category === cat);
    if (items.length === 0) continue;

    const section = document.createElement('div');
    section.className = 'lib-section';
    section.dataset.cat = cat;
    // Custom-prefabs section starts expanded too, so a freshly-saved prefab is visible
    // without an extra click.
    if (cat !== 'special' && cat !== 'platforms' && cat !== 'user-prefabs') section.classList.add('collapsed');

    const header = document.createElement('div');
    header.className = 'lib-section-header';
    header.innerHTML = `<span class="caret">▼</span> <span class="label">${sectionLabel}</span> <span class="count">${items.length}</span>`;
    header.addEventListener('click', () => {
      section.classList.toggle('collapsed');
      const caret = header.querySelector('.caret');
      caret.textContent = section.classList.contains('collapsed') ? '▶' : '▼';
    });
    section.appendChild(header);
    // Reflect collapsed state on the initial caret.
    if (section.classList.contains('collapsed')) header.querySelector('.caret').textContent = '▶';

    const grid = document.createElement('div');
    grid.className = 'lib-section-grid';
    for (const asset of items) grid.appendChild(buildLibItem(asset));
    section.appendChild(grid);

    list.appendChild(section);
  }
}

function buildLibItem(asset) {
  const el = document.createElement('div');
  el.className = 'lib-item';
  el.dataset.type = asset.type;
  el.dataset.search = (asset.type + ' ' + (asset.label || '')).toLowerCase();

  if (asset.icon) {
    const icon = document.createElement('div');
    icon.className = 'icon';
    icon.textContent = asset.icon;
    el.appendChild(icon);
  } else {
    const img = document.createElement('img');
    img.width = 80; img.height = 80; img.alt = asset.type;
    el.appendChild(img);
    makeThumbnail(asset).then(data => { if (data) img.src = data; }).catch(() => {});
  }
  const label = document.createElement('div');
  label.className = 'lib-item-label';
  label.textContent = asset.label || asset.type;
  el.appendChild(label);
  el.addEventListener('click', () => setActiveTool(asset));
  return el;
}

// Filters the library by query. Matches against `data-search` (asset type + label, lowercased).
// While a query is active, all sections with at least one match are expanded; the rest collapse.
function applyLibrarySearch(query) {
  const q = (query || '').trim().toLowerCase();
  for (const section of document.querySelectorAll('.lib-section')) {
    let anyVisible = false;
    for (const item of section.querySelectorAll('.lib-item')) {
      const matches = !q || item.dataset.search.includes(q);
      item.style.display = matches ? '' : 'none';
      if (matches) anyVisible = true;
    }
    section.style.display = anyVisible ? '' : 'none';
    if (q) {
      section.classList.toggle('collapsed', !anyVisible);
      const caret = section.querySelector('.caret');
      if (caret) caret.textContent = section.classList.contains('collapsed') ? '▶' : '▼';
    }
  }
}

function setActiveTool(asset) {
  state.activeTool = asset;
  // Reset placement color and rotation to defaults each time a new asset becomes active.
  state.placementColor = asset?.defaultColor || null;
  state.placementRotation = 0;
  for (const el of document.querySelectorAll('.lib-item')) {
    el.classList.toggle('active', asset && el.dataset.type === asset.type);
  }
  const banner = document.getElementById('active-tool');
  const swatchRow = document.getElementById('active-tool-swatches');
  if (asset) {
    banner.hidden = false;
    document.getElementById('active-tool-name').textContent = asset.label || asset.type;
    const onPickSwatch = (color) => {
      state.placementColor = color;
      for (const sw of swatchRow.querySelectorAll('.swatch')) {
        sw.classList.toggle('active', sw.title === color);
      }
      setPlacementPreview(asset);   // re-render preview in the new color
    };
    renderSwatchRow(swatchRow, asset, state.placementColor, onPickSwatch);
  } else {
    banner.hidden = true;
  }
  setPlacementPreview(asset);
  refreshToolbarToggles();
}

// Build a color swatch row for an asset. Empty if the asset has no color variants.
// Calls onPick(color) when the user clicks a swatch.
function renderSwatchRow(container, asset, currentColor, onPick) {
  container.innerHTML = '';
  if (!asset.colors || asset.colors.length === 0) { container.hidden = true; return; }
  container.hidden = false;
  for (const color of asset.colors) {
    const sw = document.createElement('button');
    sw.className = 'swatch';
    sw.title = color;
    sw.style.background = COLOR_SWATCH_HEX[color] || '#888';
    if (color === currentColor) sw.classList.add('active');
    sw.addEventListener('click', (ev) => { ev.stopPropagation(); onPick(color); });
    container.appendChild(sw);
  }
}

// =====================================================================
// Properties panel.
// =====================================================================

function refreshProperties() {
  const body = document.getElementById('properties-body');
  body.innerHTML = '';
  if (state.selectedIds.size === 0) {
    body.innerHTML = '<p class="muted">No object selected.</p>';
    return;
  }

  if (state.selectedIds.size > 1) {
    body.innerHTML = `<p class="muted">${state.selectedIds.size} objects selected.</p>`;
    const ids = [...state.selectedIds];
    addPositionEditor(body, ids);
    addRotationEditor(body, ids);
    addMultiColorEditor(body, ids);
    addMultiCorrectAnswerEditor(body, ids);
    addDuplicateButton(body);
    addSavePrefabButton(body);
    addDeleteButton(body);
    return;
  }

  const id = [...state.selectedIds][0];
  const rec = getRecordById(id);
  if (!rec) { body.innerHTML = '<p class="muted">Selection lost.</p>'; return; }

  // ID + type rows.
  body.appendChild(idRow(rec));
  if (rec.type === 'spawn' || rec.type === 'flag') {
    const r = makeRow('Type', textRO(rec.type));
    body.appendChild(r);
    addPositionEditor(body, [id]);
  } else {
    body.appendChild(makeRow('Type', textRO(rec.data.type)));
    addPositionEditor(body, [id]);
    // Answer-labels get rotation (so they can face the player on east/west-travel gates) but
    // not scale (size is controlled via the Font field instead).
    if (rec.data.type !== 'checkpoint' && rec.data.type !== 'spawn') {
      addRotationEditor(body, [id]);
      if (rec.data.type !== 'answer-label') addScaleEditor(body, [id]);
    }
    // Color dropdown for KayKit assets with variants.
    const catalogEntry = CATALOG_BY_TYPE[rec.data.type];
    if (catalogEntry && catalogEntry.colors && catalogEntry.colors.length > 1) {
      body.appendChild(makeRow('Color', selectInput(catalogEntry.colors, rec.data.color || catalogEntry.defaultColor, v => {
        pushUndo();
        rec.data.color = v;
        reloadObjectMesh(rec);
      })));
    }
    // Behavior-specific motion parameters (conveyor speed, pendulum period/amplitude, etc.).
    // Read from the catalog's defaults if the object doesn't have explicit values yet.
    if (catalogEntry?.behavior) addBehaviorEditor(body, rec, catalogEntry);
    // Platform-specific fields: only show "Correct Answer" for red platforms (the only ones
    // that fall on contact under the new mechanic).
    if (catalogEntry?.kind === 'platform' && rec.data.color === 'red') {
      const wrap = document.createElement('div');
      wrap.className = 'checkbox-row';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.id = 'prop-correct';
      cb.checked = !!rec.data.correctAnswer;
      cb.addEventListener('change', () => { pushUndo(); rec.data.correctAnswer = cb.checked; });
      const lab = document.createElement('label');
      lab.htmlFor = 'prop-correct';
      lab.textContent = 'Correct Answer (won’t fall)';
      lab.style.color = 'var(--fg)';
      wrap.appendChild(cb); wrap.appendChild(lab);
      body.appendChild(wrap);
    }
    if (rec.data.type === 'answer-label') {
      body.appendChild(makeRow('Text', textInput(rec.data.text || '', v => {
        pushUndo(); rec.data.text = v;
        // rebuild sprite to reflect new text.
        rebuildLabel(rec);
      })));
      body.appendChild(makeRow('Font', selectInput(['small','medium','large'], rec.data.fontSize || 'medium', v => {
        pushUndo(); rec.data.fontSize = v; rebuildLabel(rec);
      })));
      body.appendChild(makeRow('Color', selectInput(['white','red','green','blue','yellow'], rec.data.color || 'white', v => {
        pushUndo(); rec.data.color = v; rebuildLabel(rec);
      })));
      const platformIds = [...state.objects.values()]
        .filter(r => r.data.type?.startsWith('platform'))
        .map(r => r.data.id);
      body.appendChild(makeRow('Attached', selectInput(['(none)', ...platformIds], rec.data.attachedTo || '(none)', v => {
        pushUndo();
        // Preserve the label's current visible world position when toggling attachment:
        // converts position between absolute and offset-from-host so the user doesn't see the
        // label jump when they change the Attached dropdown.
        const newAttached = v === '(none)' ? null : v;
        const oldAttached = rec.data.attachedTo;
        // Current world position of the mesh (which is data.position if unattached, or
        // host+offset if attached).
        const worldPos = rec.mesh.position.toArray();
        if (newAttached) {
          const host = state.objects.get(newAttached);
          if (host) {
            rec.data.position = [
              worldPos[0] - host.data.position[0],
              worldPos[1] - host.data.position[1],
              worldPos[2] - host.data.position[2],
            ];
          }
        } else {
          rec.data.position = [...worldPos];
        }
        rec.data.attachedTo = newAttached;
        applyAttachedLabelPositions();
      })));
    }
  }
  // Duplicate is available for any regular object (not spawn/flag — they're singletons).
  if (rec.type !== 'spawn' && rec.type !== 'flag') addDuplicateButton(body);
  addDeleteButton(body);
}

// Multi-select color editor. Shown when the selection contains KayKit assets with color
// variants; the dropdown offers the colors COMMON to all of them and applies the pick to every
// one (the answer-row workflow: select 3 platforms, set them all red in one go). Mixed current
// colors render as a "(mixed)" placeholder that does nothing when re-picked.
function addMultiColorEditor(body, ids) {
  const colorables = [];
  for (const id of ids) {
    const rec = state.objects.get(id);
    if (!rec) continue;                       // spawn/flag handled elsewhere
    const cat = CATALOG_BY_TYPE[rec.data.type];
    if (cat?.colors?.length > 1) colorables.push({ rec, cat });
  }
  if (colorables.length === 0) return;
  let common = [...colorables[0].cat.colors];
  for (const { cat } of colorables) common = common.filter(c => cat.colors.includes(c));
  if (common.length === 0) return;
  const colorOf = ({ rec, cat }) => rec.data.color || cat.defaultColor;
  const first = colorOf(colorables[0]);
  const allSame = colorables.every(c => colorOf(c) === first);
  const current = allSame ? first : '(mixed)';
  const options = allSame ? common : ['(mixed)', ...common];
  body.appendChild(makeRow(`Color (${colorables.length})`, selectInput(options, current, v => {
    if (v === '(mixed)') return;
    pushUndo();
    for (const { rec } of colorables) {
      if ((rec.data.color || '') === v) continue;
      rec.data.color = v;
      reloadObjectMesh(rec);
    }
  })));
}

// Multi-select Correct Answer toggle for the red platforms in the selection (only red
// platforms fall on contact, so only they carry the flag). Indeterminate when mixed.
function addMultiCorrectAnswerEditor(body, ids) {
  const reds = [];
  for (const id of ids) {
    const rec = state.objects.get(id);
    if (!rec) continue;
    const cat = CATALOG_BY_TYPE[rec.data.type];
    if (cat?.kind === 'platform' && rec.data.color === 'red') reds.push(rec);
  }
  if (reds.length === 0) return;
  const wrap = document.createElement('div');
  wrap.className = 'checkbox-row';
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.id = 'prop-correct-multi';
  const allOn = reds.every(r => !!r.data.correctAnswer);
  const anyOn = reds.some(r => !!r.data.correctAnswer);
  cb.checked = allOn;
  cb.indeterminate = anyOn && !allOn;
  cb.addEventListener('change', () => {
    pushUndo();
    for (const r of reds) r.data.correctAnswer = cb.checked;
  });
  const lab = document.createElement('label');
  lab.htmlFor = 'prop-correct-multi';
  lab.textContent = `Correct Answer — ${reds.length} red platform${reds.length > 1 ? 's' : ''}`;
  lab.style.color = 'var(--fg)';
  wrap.appendChild(cb); wrap.appendChild(lab);
  body.appendChild(wrap);
}

// Swap a placed object's mesh in-place when its color changes. Keeps the same record entry
// (same id/data) so undo and selection stay valid; just replaces the visible GLTF.
// Handles regular objects (state.objects entries) AND the singleton flag (state.flag).
async function reloadObjectMesh(rec) {
  const catalogEntry = CATALOG_BY_TYPE[rec.data.type];
  if (!catalogEntry) return;
  const color = rec.data.color || catalogEntry.defaultColor;
  const oldMesh = rec.mesh;
  const oldPos = oldMesh.position.clone();
  const oldRot = oldMesh.rotation.clone();
  const oldScale = oldMesh.scale.clone();
  const idLabel = rec.idLabel;
  const newMesh = await cloneModel(urlFor(rec.data.type, color));
  newMesh.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  newMesh.position.copy(oldPos);
  newMesh.rotation.copy(oldRot);
  newMesh.scale.copy(oldScale);
  if (idLabel && idLabel.parent === oldMesh) oldMesh.remove(idLabel);
  if (idLabel) newMesh.add(idLabel);
  scene.remove(oldMesh);
  scene.add(newMesh);
  // Propagate the new mesh to whichever back-store owns this record.
  if (rec.type === 'flag') state.flag._mesh = newMesh;
  else rec.mesh = newMesh;   // regular state.objects entry — rec is the record itself
  refreshAll();
}

function rebuildLabel(rec) {
  // Replace mesh in scene with a freshly-built label.
  const old = rec.mesh;
  const idLabel = rec.idLabel;
  const newMesh = makeLabelSprite(rec.data.text || 'word', rec.data);
  newMesh.position.copy(old.position);
  newMesh.rotation.copy(old.rotation);
  newMesh.scale.copy(old.scale);
  scene.remove(old);
  scene.add(newMesh);
  if (idLabel) newMesh.add(idLabel);
  rec.mesh = newMesh;
}

// For every answer-label with attachedTo set, the runtime renders the mesh at
// `hostPlatform.position + label.position(treated as offset)`. The editor mirrors this so the
// preview matches what the player gets. Call after any change to a platform position OR a
// label's attachedTo / position.
// Universal "Y = mesh-bottom anchor" convention. Both editor and runtime place mesh.position.y
// = data.position[1] for every asset kind. The walkable top of a platform is then at
// data.position[1] + height (computed where needed). Returns 0 in all cases.
function meshYOffsetForType(_type) {
  return 0;
}

function applyAttachedLabelPositions() {
  for (const rec of state.objects.values()) {
    if (rec.data.type !== 'answer-label' || !rec.data.attachedTo) continue;
    const host = state.objects.get(rec.data.attachedTo);
    if (!host) continue;
    const hp = host.data.position;
    const off = rec.data.position;
    rec.mesh.position.set(hp[0] + off[0], hp[1] + off[1], hp[2] + off[2]);
  }
}

function getRecordById(id) {
  if (state.objects.has(id)) {
    const r = state.objects.get(id);
    // Return the live record (no spread) so callers that mutate rec.mesh affect state.objects.
    return r;
  }
  if (state.spawn?.id === id) return { mesh: state.spawn._mesh, idLabel: state.spawn._idLabel, data: state.spawn, type: 'spawn' };
  if (state.flag?.id === id)  return { mesh: state.flag._mesh,  idLabel: state.flag._idLabel,  data: state.flag,  type: 'flag'  };
  return null;
}

function idRow(rec) {
  const wrap = document.createElement('div');
  wrap.className = 'row';
  const label = document.createElement('label');
  label.textContent = 'ID';
  const input = document.createElement('input');
  input.type = 'text';
  input.value = (rec.type === 'object') ? rec.data.id : rec.data.id;
  input.addEventListener('change', () => {
    const newId = input.value.trim();
    if (!newId || newId === rec.data.id) { input.value = rec.data.id; return; }
    if (isIdInUse(newId)) {
      alert(`ID "${newId}" is already in use.`);
      input.value = rec.data.id;
      return;
    }
    pushUndo();
    const oldId = rec.data.id;
    if (rec.type === 'object') {
      const recObj = state.objects.get(oldId);
      state.objects.delete(oldId);
      recObj.data.id = newId;
      state.objects.set(newId, recObj);
      // Replace id label sprite.
      const newLbl = makeIdLabelSprite(newId);
      newLbl.position.copy(recObj.idLabel.position);
      newLbl.visible = recObj.idLabel.visible;
      recObj.mesh.remove(recObj.idLabel);
      recObj.mesh.add(newLbl);
      recObj.idLabel = newLbl;
    } else if (rec.type === 'spawn') {
      state.spawn.id = newId;
    } else if (rec.type === 'flag') {
      state.flag.id = newId;
    }
    state.selectedIds.clear();
    state.selectedIds.add(newId);
    refreshAll();
  });
  wrap.appendChild(label); wrap.appendChild(input);
  return wrap;
}

function makeRow(labelText, input) {
  const wrap = document.createElement('div');
  wrap.className = 'row';
  const lab = document.createElement('label');
  lab.textContent = labelText;
  wrap.appendChild(lab); wrap.appendChild(input);
  return wrap;
}
function textInput(initial, onChange) {
  const i = document.createElement('input');
  i.type = 'text'; i.value = initial;
  i.addEventListener('change', () => onChange(i.value));
  return i;
}
function textRO(value) {
  const i = document.createElement('input');
  i.type = 'text'; i.value = value; i.readOnly = true; i.style.color = 'var(--fg-muted)';
  return i;
}
function selectInput(options, current, onChange) {
  const s = document.createElement('select');
  for (const o of options) {
    const opt = document.createElement('option');
    opt.value = o; opt.textContent = o;
    if (o === current) opt.selected = true;
    s.appendChild(opt);
  }
  s.addEventListener('change', () => onChange(s.value));
  return s;
}

function addPositionEditor(body, ids) {
  const wrap = document.createElement('div');
  wrap.className = 'row col';
  const multi = ids.length > 1;
  wrap.innerHTML = `<label>Position (X / Y / Z)${multi ? '  <span class="muted">— delta</span>' : ''}</label>`;
  const triplet = document.createElement('div');
  triplet.className = 'triplet';
  const firstRec = getRecordById(ids[0]);
  const p = firstRec.data.position;
  const inputs = [];
  for (let i = 0; i < 3; i++) {
    const inp = document.createElement('input');
    inp.type = 'number';
    inp.step = (i === 1) ? Y_SNAP : GRID_SIZE;
    inp.value = p[i];
    // Track the previously committed value per input so multi-select edits compute a delta
    // against the last edit (or the initial display value), preserving relative offsets in a
    // group selection. Without this, typing a new X would collapse every selected object onto
    // the same X coordinate — disastrous for placed prefabs.
    let lastVal = Number(inp.value);
    inp.addEventListener('change', () => {
      pushUndo();
      const v = Number(inp.value);
      if (multi) {
        const delta = v - lastVal;
        lastVal = v;
        for (const id of ids) {
          const rec = getRecordById(id);
          if (attachedHostSelected(rec)) continue;   // host carries its attached labels
          rec.data.position[i] += delta;
          if (i === 1) {
            const off = meshYOffsetForType(rec.data.type);
            rec.mesh.position.y = rec.data.position[1] - off;
          } else {
            rec.mesh.position.setComponent(i, rec.data.position[i]);
          }
        }
      } else {
        lastVal = v;
        for (const id of ids) {
          const rec = getRecordById(id);
          rec.data.position[i] = v;
          if (i === 1) {
            // Y: apply the platform-top offset so mesh-Y = logical-Y - height (for platforms).
            const off = meshYOffsetForType(rec.data.type);
            rec.mesh.position.y = v - off;
          } else {
            rec.mesh.position.setComponent(i, v);
          }
        }
      }
      applyAttachedLabelPositions();
      updateAllDropLines();
      refreshSelectionHelpers();
    });
    inputs.push(inp);
    triplet.appendChild(inp);
  }
  wrap.appendChild(triplet);
  body.appendChild(wrap);
}

function addRotationEditor(body, ids) {
  const firstRec = getRecordById(ids[0]);
  if (firstRec.type === 'spawn' || firstRec.type === 'flag') return;
  const multi = ids.length > 1;
  const wrap = document.createElement('div');
  wrap.className = 'row col';
  wrap.innerHTML = `<label>Rotation X / Y / Z°${multi ? '  <span class="muted">— delta</span>' : ''}</label>`;
  const triplet = document.createElement('div');
  triplet.className = 'triplet';

  // Field keys per axis. Y stays on the legacy `rotation` field to keep older levels readable;
  // X and Z live on new `rotationX` / `rotationZ` fields, defaulting to 0 when unset.
  const axes = [
    { key: 'rotationX', label: 'X', mode: 'local' },     // tilt — per-object delta in multi-select
    { key: 'rotation',  label: 'Y', mode: 'yaw'   },     // yaw  — centroid-rotates positions on multi-select
    { key: 'rotationZ', label: 'Z', mode: 'local' },     // roll — per-object delta in multi-select
  ];

  for (const axis of axes) {
    const inp = document.createElement('input');
    inp.type = 'number';
    inp.step = ROT_SNAP;
    inp.value = (firstRec.data[axis.key] || 0);
    inp.title = `Rotation around ${axis.label}`;
    let lastVal = Number(inp.value);
    inp.addEventListener('change', () => {
      pushUndo();
      const v = Math.round(Number(inp.value) / ROT_SNAP) * ROT_SNAP;
      inp.value = v;
      if (multi) {
        const delta = v - lastVal;
        lastVal = v;
        if (delta !== 0) {
          if (axis.mode === 'yaw') {
            // Y delta uses the centroid rotation — positions move with the angle so the group
            // spins as a rigid body around its centroid (preserves placed prefabs).
            rotateSelectionAroundCentroid(delta);
          } else {
            // X/Z deltas apply per-object in place: every selected object tilts by `delta`
            // around its own axis. Positions don't change. This matches the simpler mental
            // model for tilting a stack of platforms uniformly.
            for (const id of ids) {
              const rec = getRecordById(id);
              if (!rec) continue;
              const cur = rec.data[axis.key] || 0;
              rec.data[axis.key] = ((cur + delta) % 360 + 360) % 360;
              applyMeshRotation(rec);
            }
          }
        }
        refreshAll();
      } else {
        lastVal = v;
        for (const id of ids) {
          const rec = getRecordById(id);
          rec.data[axis.key] = v;
          applyMeshRotation(rec);
        }
        refreshSelectionHelpers();
      }
    });
    triplet.appendChild(inp);
  }
  wrap.appendChild(triplet);
  body.appendChild(wrap);
}

// Reapply rec.data.rotation/rotationX/rotationZ to its mesh. Used by editors that mutate any
// single rotation axis — keeps the YXZ Euler composition consistent with spawnRec.
function applyMeshRotation(rec) {
  if (!rec?.mesh) return;
  rec.mesh.rotation.order = 'YXZ';
  rec.mesh.rotation.set(
    (rec.data.rotationX || 0) * Math.PI / 180,
    (rec.data.rotation  || 0) * Math.PI / 180,
    (rec.data.rotationZ || 0) * Math.PI / 180,
  );
}

function addScaleEditor(body, ids) {
  const firstRec = getRecordById(ids[0]);
  const input = document.createElement('input');
  input.type = 'number'; input.step = 0.1; input.min = 0.5; input.max = 2.0;
  input.value = firstRec.data.scale ?? 1;
  input.addEventListener('change', () => {
    pushUndo();
    const v = Math.max(0.5, Math.min(2.0, Number(input.value)));
    input.value = v;
    for (const id of ids) {
      const rec = getRecordById(id);
      rec.data.scale = v;
      rec.mesh.scale.set(v, v, v);
    }
  });
  body.appendChild(makeRow('Scale', input));
}

// Render behavior-specific motion parameters for a single selected object. The catalog tells us
// which behavior the asset uses (conveyor / pendulum / rotator / trap / cannon) and which
// numeric fields to expose. Values are stored on rec.data and persisted in level JSON.
function addBehaviorEditor(body, rec, catalogEntry) {
  const b = catalogEntry.behavior;
  const defaults = catalogEntry.defaults || {};
  const header = document.createElement('div');
  header.className = 'row';
  header.innerHTML = `<label style="font-weight: 600;">${b.charAt(0).toUpperCase() + b.slice(1)} parameters</label>`;
  body.appendChild(header);

  const numberField = (key, label, opts = {}) => {
    const cur = (rec.data[key] !== undefined) ? rec.data[key] : defaults[key];
    const inp = document.createElement('input');
    inp.type = 'number';
    if (opts.step != null) inp.step = opts.step;
    if (opts.min  != null) inp.min  = opts.min;
    if (opts.max  != null) inp.max  = opts.max;
    inp.value = cur ?? 0;
    inp.addEventListener('change', () => {
      pushUndo();
      let v = Number(inp.value);
      if (opts.min != null) v = Math.max(opts.min, v);
      if (opts.max != null) v = Math.min(opts.max, v);
      inp.value = v;
      rec.data[key] = v;
    });
    body.appendChild(makeRow(label, inp));
  };

  if (b === 'conveyor') {
    numberField('speed', 'Speed (m/s)', { step: 0.5 });
  } else if (b === 'pendulum') {
    numberField('period',    'Period (s)',     { step: 0.1, min: 0.2 });
    numberField('amplitude', 'Amplitude (°)',  { step: 5,   min: 0, max: 180 });
    numberField('phase',     'Phase (°)',      { step: 15,  min: 0, max: 360 });
  } else if (b === 'rotator') {
    numberField('rpm', 'RPM (signed)', { step: 5 });
  } else if (b === 'trap') {
    numberField('period',     'Period (s)',          { step: 0.1, min: 0.2 });
    numberField('onFraction', 'On fraction (0..1)',  { step: 0.05, min: 0, max: 1 });
    numberField('phase',      'Phase (°)',           { step: 15, min: 0, max: 360 });
  } else if (b === 'cannon') {
    numberField('interval',    'Interval (s)',  { step: 0.1, min: 0.2 });
    numberField('bulletSpeed', 'Bullet speed',  { step: 0.5, min: 0 });
  }
}

function addSavePrefabButton(body) {
  const btn = document.createElement('button');
  btn.className = 'prefab-save-btn';
  btn.textContent = '＋ Save as Prefab';
  btn.title = 'Bundle the selected objects into a reusable prefab in the Custom Prefabs library.';
  btn.style.cssText = 'width: 100%; margin: 6px 0; padding: 6px; cursor: pointer;';
  btn.addEventListener('click', () => { saveSelectionAsPrefab(); });
  body.appendChild(btn);
}

function addDuplicateButton(body) {
  const btn = document.createElement('button');
  btn.className = 'duplicate-btn';
  btn.textContent = '⎘ Duplicate';
  btn.title = 'Make a copy of the selected object(s) (Ctrl+D). The copy follows the cursor — click or press Enter to place.';
  btn.style.cssText = 'width: 100%; margin: 6px 0; padding: 6px; cursor: pointer;';
  btn.addEventListener('click', () => { duplicateSelection(); });
  body.appendChild(btn);
}

function addDeleteButton(body) {
  const btn = document.createElement('button');
  btn.className = 'delete-btn';
  btn.textContent = 'Delete';
  btn.addEventListener('click', () => {
    pushUndo();
    for (const id of state.selectedIds) deleteById(id);
    state.selectedIds.clear();
    refreshAll();
  });
  body.appendChild(btn);
}

function deleteById(id) {
  if (state.objects.has(id)) {
    const rec = state.objects.get(id);
    disposeRec(rec);
    state.objects.delete(id);
    // Unlink any answer-labels that pointed to this platform.
    for (const r of state.objects.values()) {
      if (r.data.type === 'answer-label' && r.data.attachedTo === id) r.data.attachedTo = null;
    }
  } else if (state.spawn?.id === id) {
    scene.remove(state.spawn._mesh);
    if (state.spawn._dropLine) scene.remove(state.spawn._dropLine);
    state.spawn = null;
  } else if (state.flag?.id === id) {
    scene.remove(state.flag._mesh);
    if (state.flag._dropLine) scene.remove(state.flag._dropLine);
    state.flag = null;
  }
}

// =====================================================================
// Status bar.
// =====================================================================

function refreshStatus() {
  const yLabel = `Y: ${state.yPlane >= 0 ? '+' : ''}${state.yPlane}`;
  document.getElementById('status-yplane').textContent = yLabel;
  // Mirror the same Y label into the toolbar so the user can see the current Y level right
  // next to the Y+/Y− buttons without looking down at the status bar.
  const tbY = document.getElementById('toolbar-y-indicator');
  if (tbY) tbY.textContent = yLabel;
  // Derived from the real constant — the HTML used to hardcode "grid: 2.0" while the snap is 1.
  document.getElementById('status-grid').textContent = `grid: ${GRID_SIZE.toFixed(1)}`;
  document.getElementById('status-count').textContent  = `objects: ${state.objects.size + (state.spawn ? 1 : 0) + (state.flag ? 1 : 0)}`;
}

function refreshAll() {
  refreshStatus();
  refreshProperties();
  applyAttachedLabelPositions();
  updateAllDropLines();
  refreshSelectionHelpers();
  // Selected outline (simple: tint the id label to white-bold).
  for (const rec of state.objects.values()) {
    const selected = state.selectedIds.has(rec.data.id);
    if (rec.idLabel) rec.idLabel.material.opacity = selected ? 1.0 : 0.8;
    if (rec.idLabel) rec.idLabel.scale.set(selected ? 1.7 : 1.4, selected ? 0.42 : 0.35, 1);
  }
}

// Maintain one BoxHelper per selected object. Helpers for de-selected ids are removed; helpers
// for newly-selected ids are created; existing helpers are refreshed against the current mesh
// transform (so the box follows nudges and rotations).
function refreshSelectionHelpers() {
  for (const [id, helper] of selectionHelpers) {
    if (!state.selectedIds.has(id) || !getRecordById(id)) {
      scene.remove(helper);
      helper.geometry?.dispose();
      helper.material?.dispose();
      selectionHelpers.delete(id);
    }
  }
  for (const id of state.selectedIds) {
    const rec = getRecordById(id);
    if (!rec || !rec.mesh) continue;
    let helper = selectionHelpers.get(id);
    if (!helper) {
      helper = new THREE.BoxHelper(rec.mesh, SELECTION_COLOR);
      helper.material.depthTest = false;
      helper.material.transparent = true;
      helper.material.opacity = 0.95;
      helper.renderOrder = 998;
      scene.add(helper);
      selectionHelpers.set(id, helper);
    } else {
      helper.setFromObject(rec.mesh);
    }
  }
}

// =====================================================================
// Toolbar buttons.
// =====================================================================

document.getElementById('btn-new').addEventListener('click', async () => {
  if (state.dirty) {
    const ok = confirm('Discard unsaved changes?');
    if (!ok) return;
  }
  await newLevel();
});

async function newLevel() {
  for (const rec of state.objects.values()) disposeRec(rec);
  state.objects.clear();
  if (state.spawn?._mesh) scene.remove(state.spawn._mesh);
  if (state.spawn?._dropLine) scene.remove(state.spawn._dropLine);
  state.spawn = null;
  if (state.flag?._mesh) scene.remove(state.flag._mesh);
  if (state.flag?._dropLine) scene.remove(state.flag._dropLine);
  state.flag = null;
  state.selectedIds.clear();
  state.nextSeq = {};
  state.levelName = 'Untitled Level';
  state.levelId = 'untitled-level';
  state.dirty = false;   // after the name so the title indicator shows the new name
  // Clear user prefabs too — they're per-level (stored in the level JSON).
  state.userPrefabs = [];
  document.getElementById('level-name').value = state.levelName;
  undoStack.length = 0; redoStack.length = 0;
  buildLibrary();
  refreshAll();
}

document.getElementById('btn-open').addEventListener('click', () => {
  // Same guard as New: loading a file replaces the whole level, so a dirty level needs an
  // explicit OK before its changes are thrown away.
  if (state.dirty) {
    const ok = confirm('Discard unsaved changes?');
    if (!ok) return;
  }
  document.getElementById('file-input').click();
});
document.getElementById('file-input').addEventListener('change', async (ev) => {
  const file = ev.target.files?.[0];
  if (!file) return;
  const txt = await file.text();
  try {
    const data = JSON.parse(txt);
    await loadFromData(data);
  } catch (e) {
    alert(`Failed to load: ${e.message}`);
  }
  ev.target.value = '';
});

async function loadFromData(data) {
  await newLevel();
  state.levelName = data.name || 'Untitled Level';
  state.levelId   = data.id   || 'untitled-level';
  state.topic     = data.topic || 'irregular_verbs';
  document.getElementById('level-name').value = state.levelName;
  if (data.spawn?.position) await setSpawn(data.spawn.position, data.spawn.id, { suppressUndo: true });
  if (data.flag?.position) {
    await setFlag(
      data.flag.position,
      data.flag.type  || 'flag_C',
      data.flag.color || 'blue',
      data.flag.id,
      { suppressUndo: true },
    );
  }
  if (Array.isArray(data.objects)) {
    for (const obj of data.objects) {
      // Bump sequence counter so new placements don't collide with loaded IDs. The prefix is
      // [a-z0-9]+ — NOT just [a-z]+ — because nextId() generates prefixes like "pillar1x1x1"
      // and "floorwood2x6" with digits embedded. A letters-only pattern silently failed to
      // match those IDs, leaving nextSeq at 0, which caused new placements to collide with
      // (and silently overwrite) loaded objects of the same type.
      const m = (obj.id || '').match(/^([a-z0-9]+)_(\d+)$/);
      if (m) state.nextSeq[m[1]] = Math.max(state.nextSeq[m[1]] || 0, parseInt(m[2], 10));
      await spawnRec(obj, { suppressUndo: true });
    }
  }
  // Repopulate the Custom Prefabs library from the level's stored definitions. Each entry is
  // restored to the runtime shape (kind/category/colors filled back in — those fields are
  // implicit and not persisted).
  if (Array.isArray(data.prefabs)) {
    state.userPrefabs = data.prefabs.map(p => ({
      type: p.type,
      kind: 'prefab',
      category: 'user-prefabs',
      label: p.label || 'prefab',
      icon: p.icon || '📦',
      colors: [],
      half: p.half || { x: 0.5, z: 0.5 },
      // Older saves have no snapHalf; snapped() then falls back to `half`, which for those
      // saves is the legacy {0.5, 0.5} — identical behavior to before.
      snapHalf: p.snapHalf,
      objects: Array.isArray(p.objects) ? p.objects : [],
    }));
    buildLibrary();
  }
  state.dirty = false;
  refreshAll();
}

document.getElementById('btn-save').addEventListener('click', () => saveJSON());
function saveJSON() {
  const data = exportData();
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slugify(state.levelName)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  state.dirty = false;
}

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'untitled';
}

function exportData() {
  return {
    id: slugify(state.levelName),
    name: state.levelName,
    topic: state.topic,
    spawn: state.spawn ? { id: state.spawn.id, position: state.spawn.position } : { id: 'spawn_1', position: [0, 2, 0] },
    objects: [...state.objects.values()].map(rec => ({ ...rec.data })),
    flag: state.flag ? {
      id: state.flag.id,
      type: state.flag.type,
      color: state.flag.color,
      position: state.flag.position,
    } : null,
    // User-created prefab definitions. Stored as plain JSON-safe objects (same shape as the
    // built-in PREFAB_ENTRIES). The runtime level loader ignores this field — only the editor
    // reads it back to repopulate the Custom Prefabs library on load.
    prefabs: state.userPrefabs.map(p => ({
      type: p.type, label: p.label, icon: p.icon || '📦',
      half: p.half, snapHalf: p.snapHalf, objects: p.objects,
    })),
  };
}

document.getElementById('btn-playtest').addEventListener('click', () => {
  const data = exportData();
  localStorage.setItem('krabsy_3d_editor_level', JSON.stringify(data));
  // Named target instead of '_blank': every Playtest click re-navigates the SAME tab (which
  // re-reads the localStorage draft) instead of piling up a new tab per iteration.
  window.open('./index.html?level=editor', 'krabsy-playtest');
});

document.getElementById('level-name').addEventListener('input', (ev) => {
  state.levelName = ev.target.value || 'Untitled Level';
  state.dirty = true;
});

document.getElementById('btn-help').addEventListener('click', toggleHelp);
document.getElementById('btn-help-close').addEventListener('click', toggleHelp);
function toggleHelp() {
  const el = document.getElementById('help-panel');
  el.hidden = !el.hidden;
}

// Toolbar buttons that mirror keyboard shortcuts. Each one runs the same code path the key
// would, so state stays consistent across input methods.
document.getElementById('btn-undo').addEventListener('click', () => { doUndo(); });
document.getElementById('btn-redo').addEventListener('click', () => { doRedo(); });
document.getElementById('btn-view-top').addEventListener('click',   () => setViewMode('top'));
document.getElementById('btn-view-persp').addEventListener('click', () => setViewMode('perspective'));
document.getElementById('btn-y-down').addEventListener('click', () => bumpYPlane(-Y_SNAP));
document.getElementById('btn-y-up').addEventListener('click',   () => bumpYPlane(+Y_SNAP));
document.getElementById('btn-rotate-ccw').addEventListener('click', () => rotateActiveOrSelection(-90));
document.getElementById('btn-rotate-cw').addEventListener('click',  () => rotateActiveOrSelection(+90));
document.getElementById('btn-labels').addEventListener('click', () => {
  state.labelsVisible = !state.labelsVisible;
  applyLabelVisibility();
});
document.getElementById('btn-grid').addEventListener('click', () => {
  state.gridVisible = !state.gridVisible;
  applyGridVisibility();
});
document.getElementById('btn-select').addEventListener('click', () => {
  // Enter select mode: clear any active placement tool so left-click picks instead of places.
  setActiveTool(null);
});
document.getElementById('lib-search-input').addEventListener('input', (ev) => {
  applyLibrarySearch(ev.target.value);
});
document.getElementById('btn-delete').addEventListener('click', () => {
  if (state.selectedIds.size === 0) return;
  pushUndo();
  for (const id of state.selectedIds) deleteById(id);
  state.selectedIds.clear();
  refreshAll();
});

// =====================================================================
// Render loop.
// =====================================================================

function frame() {
  requestAnimationFrame(frame);
  // Camera follow for ortho pan.
  if (viewMode === 'top') {
    orthoCam.position.set(camPan.x, 80, camPan.z);
    orthoCam.lookAt(camPan.x, 0, camPan.z);
  } else {
    const t = perspOrbit.target;
    perspCam.position.set(
      t.x + perspOrbit.dist * Math.cos(perspOrbit.pitch) * Math.cos(perspOrbit.yaw),
      t.y - perspOrbit.dist * Math.sin(perspOrbit.pitch),
      t.z + perspOrbit.dist * Math.cos(perspOrbit.pitch) * Math.sin(perspOrbit.yaw),
    );
    perspCam.lookAt(t);
  }

  // Arrow keys pan the camera in top-down / translate the look target in perspective. WASD was
  // repurposed as half-cell nudge for selected objects + hovering placement preview (see
  // nudgeActiveOrSelection in the keydown handler).
  const speed = 0.6 * (orthoZoom / 28);
  if (keysDown.has('arrowup'))    { if (viewMode === 'top') camPan.z -= speed; else perspOrbit.target.z -= speed * 0.8; }
  if (keysDown.has('arrowdown'))  { if (viewMode === 'top') camPan.z += speed; else perspOrbit.target.z += speed * 0.8; }
  if (keysDown.has('arrowleft'))  { if (viewMode === 'top') camPan.x -= speed; else perspOrbit.target.x -= speed * 0.8; }
  if (keysDown.has('arrowright')) { if (viewMode === 'top') camPan.x += speed; else perspOrbit.target.x += speed * 0.8; }

  // Spin coins for visual interest.
  for (const rec of state.objects.values()) {
    if (rec.data.type === 'coin') rec.mesh.rotation.y += 0.02;
  }

  renderer.render(scene, camera);
}

// =====================================================================
// Boot.
// =====================================================================

(async function boot() {
  await buildLibrary();
  await newLevel();
  // Initial spawn at origin for convenience.
  await setSpawn([0, 1, 0], null, { suppressUndo: true });
  state.dirty = false;
  refreshAll();
  refreshToolbarToggles();
  frame();
})();
