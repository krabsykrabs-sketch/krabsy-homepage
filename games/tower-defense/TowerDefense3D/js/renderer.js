import * as THREE from 'three';
import { CONFIG, TOWER_ORDER } from './config.js';
import { Level, HEX, hexCenter } from './level.js';
import { Grid } from './grid.js';
import { Assets } from './assets.js';

// Three.js renderer. Public API: init / resize / render(state) / setLevel, plus
// screenToWorld() used by input for picking.
//
// World mapping: game coordinate (x, y) → scene position (x, 0, y). The top of the
// hex tiles sits at scene y = 0. Game logic stays fully 2D — only the presentation
// lives here. Board, scenery and towers are KayKit models (see assets.js); enemies,
// projectiles and effects are still simple shapes.

// Camera framing reference: at this aspect the base FOV shows the whole board.
// Wider windows just see more sea; narrower ones get a wider FOV to compensate.
const BASE_ASPECT = 1.78;
const BASE_FOV = 34;

const TOWER_MODEL = {
  basic: 'building_tower_A_blue',
  catapult: 'building_tower_catapult_blue',
  cannon: 'building_tower_cannon_blue',
  freeze: 'building_tower_B_blue',
};

// Road tiles by the sides the road leaves through (direction index, see level.js).
// Each tile is listed in its unrotated pose; rotating by k·60° shifts every side by k.
const ROAD_TILES = [
  ['hex_road_A', [0, 3]],
  ['hex_road_B', [1, 3]],
  ['hex_road_C', [2, 3]],
  ['hex_road_D', [1, 3, 5]],
  ['hex_road_E', [0, 1, 3]],
  ['hex_road_F', [0, 3, 5]],
  ['hex_road_G', [2, 3, 4]],
  ['hex_road_M', [3]],
];

function roadTile(conn) {
  const want = [...conn].sort().join();
  for (const [name, sides] of ROAD_TILES) {
    if (sides.length !== conn.size) continue;
    for (let k = 0; k < 6; k++) {
      if (sides.map(d => (d + k) % 6).sort().join() === want) return { name, rot: k * Math.PI / 3 };
    }
  }
  console.warn('No road tile for sides', want);
  return { name: 'hex_road_A', rot: 0 };
}

// Unit vector (scene x, z) for a direction index.
function dirVec(k) {
  const a = k * Math.PI / 3;
  return { x: Math.cos(a), z: -Math.sin(a) };
}

// Yaw that turns a model whose front faces +z toward game angle a (atan2(dy, dx)).
const yawFor = (a) => Math.PI / 2 - a;

export const Renderer = {
  canvas: null,
  // Kept for API compatibility with the 2D version (UI/debug may read it).
  // Approximate "pixels per tile" so DOM coin arcs scale with the window.
  viewport: { scale: 1 },

  _r: null,        // THREE.WebGLRenderer
  scene: null,
  camera: null,

  _board: null,
  _towerObjs: new Map(),   // Tower → group
  _enemyObjs: new Map(),   // Enemy → group
  _projObjs: new Map(),    // Projectile → mesh
  _fxObjs: new Map(),      // effect → object3d

  _placementGroup: null,
  _placementCells: [],
  _ghost: null,
  _rangeIndicator: null,
  _selRing: null,

  _raycaster: null,
  _groundPlane: null,

  _clouds: [],
  _spawnRings: [],

  _domLayer: null,         // HTML layer over the canvas for flying coins
  _coinEls: new Map(),
  _flashEl: null,

  _geo: null,
  _mats: null,

  init(canvas) {
    this.canvas = canvas;

    this._r = new THREE.WebGLRenderer({ canvas, antialias: true });
    this._r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this._r.shadowMap.enabled = true;
    this._r.shadowMap.type = THREE.PCFSoftShadowMap;
    this._r.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xbfe4f7);

    this.camera = new THREE.PerspectiveCamera(BASE_FOV, BASE_ASPECT, 0.1, 300);

    this._raycaster = new THREE.Raycaster();
    this._groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    this._initShared();
    this._initLights();
    if (Level.current) {
      this._buildBoard(Level.current);
      this._frameCamera(Level.current);
      this._buildPlacementOverlay();
    }
    this._initIndicators();
    this._initDomLayer();

    this.resize();
    window.addEventListener('resize', () => this.resize());
  },

  resize() {
    const container = document.getElementById('game-container');
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    this._r.setSize(w, h);
    const aspect = w / h;
    this.camera.aspect = aspect;
    // Keep the board's full width in frame: below the reference aspect, widen the
    // vertical FOV so the horizontal FOV stays constant.
    if (aspect < BASE_ASPECT) {
      const t = Math.tan(THREE.MathUtils.degToRad(BASE_FOV / 2)) * (BASE_ASPECT / aspect);
      this.camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(t));
    } else {
      this.camera.fov = BASE_FOV;
    }
    this.camera.updateProjectionMatrix();
    const level = Level.current;
    this.viewport.scale = level ? h / level.gridHeight : 1;
  },

  render(state) {
    if (!Level.current) return;
    // Recover from a 0-sized canvas (container hidden/collapsed during init).
    if (this.canvas.width === 0 && document.getElementById('game-container').clientWidth > 0) {
      this.resize();
    }
    const now = performance.now() / 1000;

    this._animateScenery(now);
    this._syncPlacementOverlay(state);
    this._syncGhost(state);
    this._syncSelection(state);
    this._syncTowers(state, now);
    this._syncEnemies(state, now);
    this._syncProjectiles(state);
    this._syncEffects(state);
    this._syncCoins(state);
    this._syncFlash(state);

    this._r.render(this.scene, this.camera);
  },

  // ─── Level switching ──────────────────────────────────────────────────

  // Tear down the current board and build the one in Level.current. Dynamic
  // objects (towers/enemies/projectiles) are cleared by their sync passes once
  // resetRun() empties the state arrays.
  setLevel() {
    if (this._board) {
      this.scene.remove(this._board);
      this._board.traverse(o => {
        const own = o.userData && o.userData.own;
        if (own) for (const m of own) m.dispose();
        if (o.userData && o.userData.ownGeo) o.geometry.dispose();
      });
      this._board = null;
    }
    if (this._placementGroup) {
      this.scene.remove(this._placementGroup);
      this._placementGroup = null;
      this._placementCells = [];
    }
    this._clouds = [];
    this._spawnRings = [];
    const level = Level.current;
    this._buildBoard(level);
    this._buildPlacementOverlay();
    this._frameCamera(level);
    this.resize();
  },

  // ─── Tower thumbnails ─────────────────────────────────────────────────

  // Photograph each tower model with a small offscreen renderer. The UI uses
  // these data-URLs on the dock buttons, so the buttons always show exactly
  // the models on the battlefield (including future glTF replacements).
  getTowerThumbnails(size = 128) {
    if (this._thumbs) return this._thumbs;
    const canvas = document.createElement('canvas');
    const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    r.setPixelRatio(1);
    r.setSize(size, size);
    r.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xe6f4ff, 0x6a8a4a, 1.4));
    const sun = new THREE.DirectionalLight(0xfff4e0, 2.0);
    sun.position.set(2, 4, 3);
    scene.add(sun);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 30);
    cam.position.set(3.3, 3.4, 3.3);
    cam.lookAt(0, 1.2, 0);

    const thumbs = {};
    for (const type of TOWER_ORDER) {
      const fake = { type, position: { x: 0, y: 0 }, rotation: 0, upgradeLevel: 0, fireAnimT: 0 };
      const g = this._makeTower(fake);
      g.position.set(0, 0, 0);
      // Aim rotating heads toward the camera diagonal so barrels read clearly.
      if (g.userData.turret) g.userData.turret.rotation.y = Math.PI / 4;
      scene.add(g);
      r.render(scene, cam);
      thumbs[type] = canvas.toDataURL('image/png');
      scene.remove(g);
      g.traverse(o => {
        const own = o.userData && o.userData.own;
        if (own) for (const m of own) m.dispose();
      });
    }
    r.dispose();
    this._thumbs = thumbs;
    return thumbs;
  },

  // ─── Picking ──────────────────────────────────────────────────────────

  // Client coords → tile coords {x, y} on the ground plane, or null on miss.
  screenToWorld(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    this._raycaster.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3();
    if (!this._raycaster.ray.intersectPlane(this._groundPlane, hit)) return null;
    return { x: hit.x, y: hit.z };
  },

  // The tower whose model is under the pointer, or null. Towers are tall, so their
  // tops cover the hexes behind them; picking the model beats picking the ground.
  pickTower(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    this._raycaster.setFromCamera(ndc, this.camera);
    let best = null, bestDist = Infinity;
    for (const [tower, obj] of this._towerObjs) {
      const hit = this._raycaster.intersectObject(obj, true)[0];
      if (hit && hit.distance < bestDist) { bestDist = hit.distance; best = tower; }
    }
    return best;
  },

  // Tile coords → pixel position relative to #canvas-frame (for the DOM coin layer).
  _worldToFrame(wx, wy, height = 0.6) {
    const v = new THREE.Vector3(wx, height, wy).project(this.camera);
    if (v.z > 1) return null;
    return {
      x: (v.x * 0.5 + 0.5) * this.canvas.clientWidth,
      y: (-v.y * 0.5 + 0.5) * this.canvas.clientHeight,
    };
  },

  // ─── Scene setup ──────────────────────────────────────────────────────

  _initShared() {
    this._geo = {
      box: new THREE.BoxGeometry(1, 1, 1),
      cyl: new THREE.CylinderGeometry(1, 1, 1, 20),
      sphere: new THREE.SphereGeometry(1, 20, 14),
      cone: new THREE.ConeGeometry(1, 1, 16),
      octa: new THREE.OctahedronGeometry(1),
      torus: new THREE.TorusGeometry(1, 0.07, 10, 32),
      plane: new THREE.PlaneGeometry(1, 1),
      circle: new THREE.CircleGeometry(1, 48),
      ring: new THREE.RingGeometry(0.92, 1, 48),
      // Pointy-top hexagon lying flat once rotated onto the ground.
      hex: new THREE.CircleGeometry(HEX.RADIUS * 0.88, 6, Math.PI / 6),
    };
    const L = (color, extra) => new THREE.MeshLambertMaterial(Object.assign({ color }, extra));
    this._mats = {
      ground: L(0x4a7c2e),
      apron: L(0x3c6626),
      path: L(0xc4a35a),
      water: L(0x3a8fd4),
      ridge: L(0x2d5a1e),
      trunk: L(0x6b4a2a),
      leaf: L(0x2f6b22),
      leaf2: L(0x3f8a2c),
      stone: L(0x9aa0a6),
      spawn: L(0xffe66d, { emissive: 0x6b5a10 }),
      goalPole: L(0xdddddd),
      goalFlag: L(0xe63946, { emissive: 0x5a0e15 }),
      gold: L(0xffd447, { emissive: 0x665010 }),
      sea: L(0x2f86c6),
      spawnRing: new THREE.MeshBasicMaterial({ color: 0xff8585, transparent: true, opacity: 0.9, depthWrite: false }),
      overlayAvail: new THREE.MeshBasicMaterial({ color: 0x2ee6c0, transparent: true, opacity: 0.42, depthWrite: false }),
      overlayBad: new THREE.MeshBasicMaterial({ color: 0xdc5050, transparent: true, opacity: 0.32, depthWrite: false }),
      hpBg: new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6 }),
    };
  },

  _initLights() {
    this.scene.add(new THREE.HemisphereLight(0xe6f4ff, 0x6a8a4a, 1.2));
    const sun = new THREE.DirectionalLight(0xfff4e0, 2.0);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.03;
    this._sun = sun;
    this.scene.add(sun, sun.target);
    if (Level.current) this._aimSun(Level.current);
  },

  // Point the sun (and its shadow box) at the middle of the board.
  _aimSun(level) {
    const cx = level.gridWidth / 2, cz = level.gridHeight / 2;
    this._sun.position.set(cx - 9, 24, cz + 13);
    this._sun.target.position.set(cx, 0, cz);
    const cam = this._sun.shadow.camera;
    const half = level.gridWidth / 2 + 3;
    cam.left = -half; cam.right = half; cam.top = half * 0.75; cam.bottom = -half * 0.75;
    cam.near = 1; cam.far = 70;
    cam.updateProjectionMatrix();
  },

  _frameCamera(level) {
    const W = level.gridWidth, cx = W / 2, cz = level.gridHeight / 2;
    // Fixed angled view from the "south" (high z), looking down at the board. The
    // look-at point sits a little south of centre so the bottom dock has room.
    this.camera.position.set(cx, W * 0.92, cz + W * 0.78);
    this.camera.lookAt(cx, 0, cz + 1.7);
    if (this._sun) this._aimSun(level);
  },

  _buildBoard(level) {
    const g = new THREE.Group();
    const tiles = [], solid = [], water = [];
    const put = (list, name, c, r, extra) => {
      const p = hexCenter(c, r);
      list.push(Object.assign({ name, x: p.x, z: p.y }, extra));
    };

    for (const cell of level.cells.values()) {
      const { c, r } = cell;
      const p = hexCenter(c, r);
      if (cell.type === 'water') { put(water, 'hex_water', c, r); continue; }

      if (cell.type === 'path' || cell.type === 'spawn') {
        const road = roadTile(cell.conn);
        put(tiles, road.name, c, r, { rot: road.rot });
      } else {
        put(tiles, 'hex_grass', c, r);
      }

      if (cell.type === 'scenery') {
        put(solid, cell.model, c, r, { rot: cell.rot });
      } else if (cell.type === 'goal') {
        // Castle with its gate toward the incoming road, a blue flag beside it.
        const k = [...cell.conn][0];
        put(solid, 'building_castle_blue', c, r, { rot: k * Math.PI / 3 + Math.PI / 2 });
      } else if (cell.type === 'spawn') {
        // Two red flags frame the spot where enemies appear, plus a pulsing ring.
        const k = [...cell.conn][0];
        const d = dirVec(k);
        for (const side of [-1, 1]) {
          solid.push({
            name: 'flag_red',
            x: p.x - d.x * 0.35 - d.z * 0.72 * side,
            z: p.y - d.z * 0.35 + d.x * 0.72 * side,
          });
        }
        const ring = new THREE.Mesh(this._geo.ring, this._mats.spawnRing);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(p.x, 0.06, p.y);
        g.add(ring);
        this._spawnRings.push(ring);
      }
    }

    // The board is an island: a few rings of water tiles, then open sea.
    for (let r = -6; r < level.rows + 5; r++) {
      for (let c = -6; c < level.cols + 6; c++) {
        if (c >= 0 && r >= 0 && c < level.cols && r < level.rows) continue;
        put(water, 'hex_water', c, r);
      }
    }

    const tileMesh = Assets.mergeStatic(tiles);
    tileMesh.receiveShadow = true;
    g.add(tileMesh);
    const solidMesh = Assets.mergeStatic(solid);
    if (solidMesh) {
      solidMesh.castShadow = solidMesh.receiveShadow = true;
      g.add(solidMesh);
    }
    g.add(Assets.mergeStatic(water));

    const sea = new THREE.Mesh(this._geo.plane, this._mats.sea);
    sea.rotation.x = -Math.PI / 2;
    sea.scale.set(400, 400, 1);
    sea.position.set(level.gridWidth / 2, -0.24, level.gridHeight / 2);
    g.add(sea);

    this._buildClouds(level, g);

    this._board = g;
    this.scene.add(g);
  },

  // A few clouds drifting over the sea north of the island (never over the board).
  _buildClouds(level, parent) {
    for (let i = 0; i < 4; i++) {
      const cloud = Assets.clone(i % 2 ? 'cloud_big' : 'cloud_small');
      cloud.scale.setScalar(0.9 + Math.random() * 0.5);
      cloud.position.y = 1.2 + Math.random() * 1.5;
      Object.assign(cloud.userData, {
        x0: Math.random() * (level.gridWidth + 30),
        z: -3 - Math.random() * 6,
        speed: 0.2 + Math.random() * 0.25,
      });
      parent.add(cloud);
      this._clouds.push(cloud);
    }
  },

  _animateScenery(now) {
    const W = Level.current.gridWidth;
    for (const cloud of this._clouds) {
      const u = cloud.userData;
      cloud.position.x = ((u.x0 + now * u.speed) % (W + 30)) - 15;
      cloud.position.z = u.z;
    }
    const pulse = 0.8 + Math.sin(now * 4) * 0.12;
    for (const ring of this._spawnRings) ring.scale.set(pulse, pulse, 1);
  },

  // ─── Placement overlay / ghost / selection ────────────────────────────

  // One teal hexagon per buildable cell; shown only while a tower is being placed.
  _buildPlacementOverlay() {
    const group = new THREE.Group();
    group.visible = false;
    this._placementCells = [];
    for (let cy = 0; cy < Grid.cellsY; cy++) {
      for (let cx = 0; cx < Grid.cellsX; cx++) {
        if (!Grid.isStructurallyValid(cx, cy)) continue;
        const m = new THREE.Mesh(this._geo.hex, this._mats.overlayAvail);
        m.rotation.x = -Math.PI / 2;
        const c = Grid.placementCellToWorld(cx, cy);
        m.position.set(c.centerX, 0.04, c.centerY);
        group.add(m);
        this._placementCells.push({ mesh: m, cx, cy });
      }
    }
    this._placementGroup = group;
    this.scene.add(group);
  },

  _syncPlacementOverlay(state) {
    if (!this._placementGroup) return;
    this._placementGroup.visible = state.placement.active;
    if (!state.placement.active) return;
    for (const cell of this._placementCells) {
      cell.mesh.visible = Grid.isAvailable(cell.cx, cell.cy);
    }
  },

  _initIndicators() {
    // Ghost tower preview: a see-through copy of the real model (swapped per type).
    const ghost = new THREE.Group();
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x78dc78, transparent: true, opacity: 0.9, depthWrite: false });
    const ring = new THREE.Mesh(this._geo.ring, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.scale.set(0.95, 0.95, 1);
    ring.position.y = 0.07;
    const range = this._makeRangeDisc(0.10, 0.35);
    ghost.add(ring, range);
    ghost.visible = false;
    ghost.userData = { ring, range, models: {}, shown: null };
    this._ghost = ghost;
    this.scene.add(ghost);

    // Range indicator for the selected tower.
    this._rangeIndicator = this._makeRangeDisc(0.12, 0.45);
    this._rangeIndicator.visible = false;
    this.scene.add(this._rangeIndicator);

    // Selection ring.
    const selMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false });
    this._selRing = new THREE.Mesh(this._geo.ring, selMat);
    this._selRing.rotation.x = -Math.PI / 2;
    this._selRing.position.y = 0.13;
    this._selRing.visible = false;
    this.scene.add(this._selRing);
  },

  _makeRangeDisc(fillOpacity, rimOpacity) {
    const group = new THREE.Group();
    const fill = new THREE.Mesh(this._geo.circle,
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: fillOpacity, depthWrite: false }));
    fill.rotation.x = -Math.PI / 2;
    const rim = new THREE.Mesh(this._geo.ring,
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: rimOpacity, depthWrite: false }));
    rim.rotation.x = -Math.PI / 2;
    group.position.y = 0.05;
    group.userData = { fill, rim };
    group.add(fill, rim);
    return group;
  },

  _syncGhost(state) {
    const g = this._ghost;
    if (!state.placement.active || !state.mouseWorld) { g.visible = false; return; }
    const { cellX, cellY } = Grid.worldToPlacementCell(state.mouseWorld.x, state.mouseWorld.y);
    if (!Grid.inBounds(cellX, cellY)) { g.visible = false; return; }

    const valid = Grid.isAvailable(cellX, cellY);
    const def = CONFIG.TOWERS[state.placement.towerType];
    const c = Grid.placementCellToWorld(cellX, cellY);
    g.visible = true;
    g.position.set(c.centerX, 0, c.centerY);
    const u = g.userData, type = state.placement.towerType;
    if (u.shown !== type) {
      if (u.shown) u.models[u.shown].visible = false;
      if (!u.models[type]) {
        const model = Assets.clone(TOWER_MODEL[type]);
        model.traverse(o => { if (o.isMesh) o.material = Assets.ghostMaterial; });
        u.models[type] = model;
        g.add(model);
      }
      u.models[type].visible = true;
      u.shown = type;
    }
    u.models[type].visible = valid;
    u.ring.material.color.set(valid ? 0x78dc78 : 0xdc5050);
    u.range.visible = valid;
    u.range.scale.set(def.range, 1, def.range);
  },

  _syncSelection(state) {
    const t = state.selectedTower;
    if (!t) { this._rangeIndicator.visible = false; this._selRing.visible = false; return; }
    this._rangeIndicator.visible = true;
    this._rangeIndicator.position.set(t.position.x, 0.05, t.position.y);
    this._rangeIndicator.scale.set(t.range, 1, t.range);
    this._selRing.visible = true;
    this._selRing.position.set(t.position.x, 0.07, t.position.y);
    this._selRing.scale.set(0.95, 0.95, 1);
  },

  // ─── Towers ───────────────────────────────────────────────────────────

  _syncTowers(state, now) {
    const live = new Set(state.towers);
    for (const [t, obj] of this._towerObjs) {
      if (!live.has(t)) { this._removeObj(obj); this._towerObjs.delete(t); }
    }
    for (const t of state.towers) {
      let obj = this._towerObjs.get(t);
      if (!obj) {
        obj = this._makeTower(t);
        this._towerObjs.set(t, obj);
        this.scene.add(obj);
      }
      const u = obj.userData;
      if (u.turret) u.turret.rotation.y = yawFor(t.rotation);
      if (u.spin) u.spin.rotation.y = now * 1.2;
      // Recoil / swing / pulse driven by the tower's visual-only fireAnimT countdown.
      const anim = Math.max(0, t.fireAnimT || 0);
      if (u.cannon) u.cannon.position.z = u.cannonZ - 0.18 * Math.min(1, anim / 0.15);
      if (u.arm) u.arm.rotation.x = u.armX + 1.1 * Math.min(1, anim / 0.35);
      if (u.top) u.top.position.y = u.topY + 0.1 * Math.min(1, anim / 0.15);
      if (u.crystal) {
        const k = Math.min(1, anim / 0.4);
        const s = 1 + 0.5 * Math.sin(k * Math.PI);
        u.crystal.scale.set(0.26 * s, 0.45 * s, 0.26 * s);
      }
      if (u.lastUpgrade !== t.upgradeLevel) this._refreshUpgradePips(obj, t);
    }
  },

  _makeTower(t) {
    const g = new THREE.Group();
    g.position.set(t.position.x, 0, t.position.y);
    const own = [];
    const u = { own, lastUpgrade: -1 };

    const model = Assets.clone(TOWER_MODEL[t.type]);
    g.add(model);
    const part = (name) => model.getObjectByName(name) || null;

    if (t.type === 'basic') {
      u.top = part('building_tower_A_top_blue');
      if (u.top) u.topY = u.top.position.y;
    } else if (t.type === 'cannon') {
      u.turret = part('cannon_turret_blue');
      u.cannon = part('cannon_blue');
      if (u.cannon) u.cannonZ = u.cannon.position.z;
    } else if (t.type === 'catapult') {
      u.turret = part('catapult_turret_blue');
      u.arm = part('catapult_arm_blue');
      if (u.arm) u.armX = u.arm.rotation.x;
    } else if (t.type === 'freeze') {
      // An ice crystal floats above the roof and pulses when the tower fires.
      const crystalMat = new THREE.MeshLambertMaterial({
        color: 0xaee4f7, emissive: 0x2e7da0, transparent: true, opacity: 0.92,
      });
      own.push(crystalMat);
      const crystal = new THREE.Mesh(this._geo.octa, crystalMat);
      crystal.scale.set(0.26, 0.45, 0.26);
      crystal.position.y = new THREE.Box3().setFromObject(model).max.y + 0.5;
      const spin = new THREE.Group();
      spin.add(crystal);
      g.add(spin);
      u.spin = spin;
      u.crystal = crystal;
    }

    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.userData = u;
    this._refreshUpgradePips(g, t);
    return g;
  },

  _refreshUpgradePips(obj, t) {
    const u = obj.userData;
    if (u.pips) { obj.remove(u.pips); }
    const pips = new THREE.Group();
    for (let i = 0; i < t.upgradeLevel; i++) {
      const pip = new THREE.Mesh(this._geo.sphere, this._mats.gold);
      pip.scale.setScalar(0.11);
      pip.position.set((i - (t.upgradeLevel - 1) / 2) * 0.3, 0.14, 0.78);
      pips.add(pip);
    }
    obj.add(pips);
    u.pips = pips;
    u.lastUpgrade = t.upgradeLevel;
    // Upgraded towers grow a little — readable from across the board.
    obj.scale.setScalar(1 + 0.08 * t.upgradeLevel);
  },

  // ─── Enemies ──────────────────────────────────────────────────────────

  _syncEnemies(state, now) {
    const live = new Set();
    for (const e of state.enemies) if (e.isAlive) live.add(e);
    for (const [e, obj] of this._enemyObjs) {
      if (!live.has(e)) { this._removeObj(obj); this._enemyObjs.delete(e); }
    }
    const tmpColor = this._tmpColor || (this._tmpColor = new THREE.Color());
    for (const e of live) {
      let obj = this._enemyObjs.get(e);
      if (!obj) {
        obj = this._makeEnemy(e);
        obj.userData.born = now;
        this._enemyObjs.set(e, obj);
        this.scene.add(obj);
      }
      const u = obj.userData;
      obj.position.set(e.position.x, 0, e.position.y);
      // Body scale follows e.radius (tier transformations shrink it live).
      const r = e.radius;
      u.body.scale.set(r * 1.25, r * 0.9, r * 1.25);
      u.body.position.y = r * 0.78;
      // Squash-and-stretch walk bob, paused while frozen.
      if (!e.isFrozen) {
        const bob = 1 + Math.sin((e.animTimer + e.animFrame * (1 / 8)) * Math.PI * 8) * 0.07;
        u.body.scale.y *= bob;
      }
      // Spawn pop-in with a little overshoot.
      const age = now - u.born;
      if (age < 0.3) {
        const x = Math.max(0.02, age / 0.3);
        const back = 1 + 2.7 * Math.pow(x - 1, 3) + 1.7 * Math.pow(x - 1, 2);
        u.body.scale.multiplyScalar(back);
      }
      u.rot.rotation.y = Math.atan2(-e.direction.y, e.direction.x);

      // Tint matches the 2D renderer's rules.
      const c = u.mat.color;
      if (e.damageTintTimer > 0) c.set(0xff4040);
      else if (e.isFrozen) c.set(0x80ccff);
      else if (e.isPermanentlySlowed) { c.set(e.tier.color); c.lerp(tmpColor.set(0x80ccff), 0.3); }
      else c.set(e.tier.color);

      // Health bar — only once damaged (or always for the boss).
      const showBar = e.isBoss || e.currentHealth < e.maxHealth;
      u.bar.visible = showBar;
      if (showBar) {
        const w = Math.max(r * 2.4, e.isBoss ? 1.6 : 0);
        u.bar.position.y = r * 1.9 + 0.35;
        u.bar.scale.set(w, 1, 1);
        const frac = Math.max(0, e.currentHealth / e.maxHealth);
        u.fill.scale.x = Math.max(frac, 0.001);
        u.fill.position.x = -(1 - frac) / 2;
        u.fillMat.color.set(frac > 0.5 ? 0x4caf50 : frac > 0.2 ? 0xf1c40f : 0xe74c3c);
        u.bar.quaternion.copy(this.camera.quaternion);
      }
    }
  },

  _makeEnemy(e) {
    // Outer group carries position only; `rot` carries the facing yaw. The health
    // bar hangs off the outer group so it never tilts with the enemy's heading.
    const g = new THREE.Group();
    const rot = new THREE.Group();
    g.add(rot);
    const mat = new THREE.MeshLambertMaterial({ color: e.tier.color });
    const body = new THREE.Mesh(this._geo.sphere, mat);
    body.castShadow = true;
    rot.add(body);

    // Two eyes on the facing (+x) side make even a placeholder blob read as a creature.
    const eyeMat = this._mats.hpBg;
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(this._geo.sphere, eyeMat);
      eye.scale.setScalar(0.16);
      eye.position.set(0.78, 0.35, side * 0.34);
      body.add(eye);
    }

    // Boss wears a little gold crown.
    if (e.isBoss) {
      for (let i = 0; i < 3; i++) {
        const spike = new THREE.Mesh(this._geo.cone, this._mats.gold);
        spike.scale.set(0.12, 0.3, 0.12);
        spike.position.set(0, 1.0, (i - 1) * 0.3);
        body.add(spike);
      }
    }

    // Health bar (billboarded each frame).
    const bar = new THREE.Group();
    const bg = new THREE.Mesh(this._geo.plane, this._mats.hpBg);
    const fillMat = new THREE.MeshBasicMaterial({ color: 0x4caf50 });
    const fill = new THREE.Mesh(this._geo.plane, fillMat);
    bg.scale.set(1, 0.12, 1);
    fill.scale.set(1, 0.09, 1);
    fill.position.z = 0.01;
    bar.add(bg, fill);
    bar.visible = false;
    g.add(bar);

    g.userData = { rot, body, mat, bar, fill, fillMat, own: [mat, fillMat] };
    return g;
  },

  // ─── Projectiles ──────────────────────────────────────────────────────

  _syncProjectiles(state) {
    const live = new Set();
    for (const p of state.projectiles) if (p.isAlive) live.add(p);
    for (const [p, obj] of this._projObjs) {
      if (!live.has(p)) { this._removeObj(obj); this._projObjs.delete(p); }
    }
    for (const p of live) {
      let obj = this._projObjs.get(p);
      if (!obj) {
        const mat = new THREE.MeshBasicMaterial({ color: p.color });
        obj = new THREE.Mesh(this._geo.sphere, mat);
        obj.scale.setScalar(p.isAoE ? 0.18 : 0.12);
        obj.userData = { own: [mat] };
        this._projObjs.set(p, obj);
        this.scene.add(obj);
      }
      // Directional shots stretch along their flight direction (motion read).
      if (!p.isAoE) {
        obj.scale.set(0.26, 0.1, 0.1);
        obj.rotation.y = Math.atan2(-p.direction.y, p.direction.x);
      }
      // Shots leave from the tower top and drop to enemy height.
      const gone = Math.hypot(p.position.x - p.startPosition.x, p.position.y - p.startPosition.y);
      let y = 0.5 + 1.4 * Math.max(0, 1 - gone / 2);
      if (p.isAoE) {
        // Lobbed arc from launch point to the snapshotted target.
        const total = Math.hypot(p.targetPosition.x - p.startPosition.x,
                                 p.targetPosition.y - p.startPosition.y) || 1;
        const f = Math.min(1, gone / total);
        y = 1.9 * (1 - f) + 0.3 * f + Math.sin(f * Math.PI) * 1.4;
      }
      obj.position.set(p.position.x, y, p.position.y);
    }
  },

  // ─── Effects ──────────────────────────────────────────────────────────

  _syncEffects(state) {
    const live = new Set();
    for (const fx of state.effects) {
      if (fx.kind === 'coin' || fx.kind === 'screenFlash') continue; // DOM-rendered
      live.add(fx);
      let obj = this._fxObjs.get(fx);
      if (!obj) {
        obj = this._makeEffect(fx);
        if (!obj) { live.delete(fx); continue; }
        this._fxObjs.set(fx, obj);
        this.scene.add(obj);
      }
      this._updateEffect(fx, obj);
    }
    for (const [fx, obj] of this._fxObjs) {
      if (!live.has(fx)) { this._removeObj(obj); this._fxObjs.delete(fx); }
    }
  },

  _makeEffect(fx) {
    if (fx.kind === 'ring') {
      const g = new THREE.Group();
      const own = [];
      if (fx.fill) {
        const { color, alpha } = this._cssColor(fx.fill);
        const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: alpha, depthWrite: false });
        own.push(m);
        const fill = new THREE.Mesh(this._geo.circle, m);
        fill.rotation.x = -Math.PI / 2;
        g.add(fill);
        g.userData.fillMat = m;
        g.userData.fillAlpha = alpha;
      }
      if (fx.stroke) {
        const { color, alpha } = this._cssColor(fx.stroke);
        const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: alpha, depthWrite: false });
        own.push(m);
        const rim = new THREE.Mesh(this._geo.ring, m);
        rim.rotation.x = -Math.PI / 2;
        g.add(rim);
        g.userData.rimMat = m;
        g.userData.rimAlpha = alpha;
      }
      g.position.set(fx.position.x, 0.15, fx.position.y);
      g.userData.own = own;
      return g;
    }
    if (fx.kind === 'poof' || fx.kind === 'particle') {
      const { color } = this._cssColor(fx.color);
      const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, depthWrite: false });
      const mesh = new THREE.Mesh(this._geo.sphere, m);
      mesh.userData = { own: [m] };
      return mesh;
    }
    return null;
  },

  _updateEffect(fx, obj) {
    const t = Math.max(0, Math.min(1, fx.elapsed / fx.duration));
    if (fx.kind === 'ring') {
      const r = fx.startRadius + (fx.endRadius - fx.startRadius) * t;
      obj.scale.set(r, 1, r);
      const fade = fx.fadeOut ? (1 - t) : 1;
      const u = obj.userData;
      if (u.fillMat) u.fillMat.opacity = u.fillAlpha * fade;
      if (u.rimMat) u.rimMat.opacity = u.rimAlpha * fade;
    } else if (fx.kind === 'poof') {
      const x = fx.position.x + fx.velocity.x * t;
      const y = fx.position.y + fx.velocity.y * t;
      obj.position.set(x, 0.45, y);
      obj.scale.setScalar(Math.max(0.01, fx.startRadius * (1 - t * 0.25)));
      obj.material.opacity = 1 - t;
    } else if (fx.kind === 'particle') {
      const damp = 1 - t * 0.4;
      const x = fx.position.x + fx.velocity.x * fx.elapsed * damp;
      const y = fx.position.y + fx.velocity.y * fx.elapsed * damp;
      obj.position.set(x, 0.4, y);
      obj.scale.setScalar(Math.max(0.01, fx.startRadius * (1 - t)));
      obj.material.opacity = 1 - t;
    }
  },

  // Parse '#rgb', 'rgb(...)' or 'rgba(...)' into a THREE.Color + alpha.
  _cssColor(str) {
    const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\)/.exec(str);
    if (m) {
      return {
        color: new THREE.Color().setRGB(m[1] / 255, m[2] / 255, m[3] / 255, THREE.SRGBColorSpace),
        alpha: m[4] !== undefined ? parseFloat(m[4]) : 1,
      };
    }
    return { color: new THREE.Color(str), alpha: 1 };
  },

  // ─── DOM layer: flying coins + screen flash ───────────────────────────

  _initDomLayer() {
    const frame = document.getElementById('canvas-frame');
    this._domLayer = document.createElement('div');
    this._domLayer.id = 'fx-dom-layer';
    frame.appendChild(this._domLayer);
    this._flashEl = document.createElement('div');
    this._flashEl.id = 'screen-flash';
    frame.appendChild(this._flashEl);
  },

  _coinTargetFramePos() {
    const el = document.getElementById('coin-count');
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const frameRect = this.canvas.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2 - frameRect.left,
      y: rect.top + rect.height / 2 - frameRect.top,
    };
  },

  _syncCoins(state) {
    const target = this._coinTargetFramePos();
    const seen = new Set();
    for (const fx of state.effects) {
      if (fx.kind !== 'coin') continue;
      seen.add(fx);
      let el = this._coinEls.get(fx);
      if (!el) {
        el = document.createElement('div');
        el.className = 'coin-fly';
        this._domLayer.appendChild(el);
        this._coinEls.set(fx, el);
      }
      if (fx.elapsed <= 0 || !target) { el.style.opacity = '0'; continue; }
      const t = Math.min(1, fx.elapsed / fx.duration);
      const ease = t * t * (3 - 2 * t);
      const start = this._worldToFrame(fx.worldStart.x + fx.spread.x, fx.worldStart.y + fx.spread.y);
      if (!start) { el.style.opacity = '0'; continue; }
      const x = start.x + (target.x - start.x) * ease;
      const lift = fx.arcHeight * this.viewport.scale * 4 * t * (1 - t);
      const y = start.y + (target.y - start.y) * ease - lift;
      el.style.opacity = '1';
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    }
    for (const [fx, el] of this._coinEls) {
      if (!seen.has(fx)) { el.remove(); this._coinEls.delete(fx); }
    }
  },

  _syncFlash(state) {
    let flash = null;
    for (const fx of state.effects) if (fx.kind === 'screenFlash') { flash = fx; break; }
    if (!flash) { this._flashEl.style.opacity = '0'; return; }
    const t = Math.min(1, flash.elapsed / flash.duration);
    this._flashEl.style.opacity = (Math.max(0, (1 - t) ** 1.5) * 0.9).toFixed(3);
  },

  // ─── Cleanup ──────────────────────────────────────────────────────────

  _removeObj(obj) {
    this.scene.remove(obj);
    obj.traverse(o => {
      const own = o.userData && o.userData.own;
      if (own) for (const m of own) m.dispose();
    });
  },
};
