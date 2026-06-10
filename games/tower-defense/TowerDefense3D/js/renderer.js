// Three.js renderer (3D version). Same public API as the 2D canvas renderer —
// init / resize / render(state) — plus screenToWorld() used by input for picking.
//
// World mapping: tile coordinate (x, y) → scene position (x, 0, y). One tile is one
// world unit; the ground sits at scene y = 0. Game logic stays fully 2D — only the
// presentation lives here. All meshes are procedural placeholders; swap them for real
// glTF models later by replacing the _make*() builders.

// Camera framing reference: at this aspect the base FOV shows the whole board.
// Wider windows just see more apron; narrower ones get a wider FOV to compensate.
const BASE_ASPECT = 1.6;
const BASE_FOV = 40;

const Renderer = {
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
  _goalFlags: [],
  _spawnArrows: [],

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
    this._r.outputEncoding = THREE.sRGBEncoding;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x8fc4ea);

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
        if (own) for (const m of own) { if (m.map) m.map.dispose(); m.dispose(); }
      });
      this._board = null;
    }
    if (this._placementGroup) {
      this.scene.remove(this._placementGroup);
      this._placementGroup = null;
      this._placementCells = [];
    }
    this._clouds = [];
    this._goalFlags = [];
    this._spawnArrows = [];
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
    r.outputEncoding = THREE.sRGBEncoding;
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xcfe6ff, 0x3a5a2a, 0.7));
    const sun = new THREE.DirectionalLight(0xfff2dd, 0.95);
    sun.position.set(2, 4, 3);
    scene.add(sun);
    const cam = new THREE.PerspectiveCamera(33, 1, 0.1, 20);
    cam.position.set(1.8, 1.7, 1.8);
    cam.lookAt(0, 0.62, 0);

    const thumbs = {};
    for (const type of TOWER_ORDER) {
      const fake = { type, position: { x: 0, y: 0 }, rotation: 0, upgradeLevel: 0, fireAnimT: 0 };
      const g = this._makeTower(fake);
      g.position.set(0, 0, 0);
      // Aim rotating heads toward the camera diagonal so barrels read clearly.
      if (g.userData.rotGroup) g.userData.rotGroup.rotation.y = -Math.PI / 4;
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
      overlayAvail: new THREE.MeshBasicMaterial({ color: 0x78dc78, transparent: true, opacity: 0.28, depthWrite: false }),
      overlayBad: new THREE.MeshBasicMaterial({ color: 0xdc5050, transparent: true, opacity: 0.32, depthWrite: false }),
      hpBg: new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6 }),
    };
  },

  _initLights() {
    this.scene.add(new THREE.HemisphereLight(0xcfe6ff, 0x3a5a2a, 0.5));
    const sun = new THREE.DirectionalLight(0xfff2dd, 0.85);
    sun.position.set(4, 26, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const cam = sun.shadow.camera;
    cam.left = -20; cam.right = 20; cam.top = 20; cam.bottom = -20;
    cam.near = 1; cam.far = 80;
    const lvl = Level.current;
    sun.target.position.set(lvl ? lvl.gridWidth / 2 : 11, 0, lvl ? lvl.gridHeight / 2 : 10);
    this.scene.add(sun, sun.target);
  },

  _frameCamera(level) {
    const cx = level.gridWidth / 2;
    // Fixed angled view from the "south" (high z), looking down at the board.
    this.camera.position.set(cx, level.gridHeight * 0.95, level.gridHeight * 1.52);
    this.camera.lookAt(cx, 0, level.gridHeight * 0.46);
  },

  _buildBoard(level) {
    const g = new THREE.Group();
    const W = level.gridWidth, H = level.gridHeight;

    // Backdrop apron so the camera never sees the void.
    const apron = new THREE.Mesh(this._geo.plane, this._mats.apron);
    apron.rotation.x = -Math.PI / 2;
    apron.scale.set(300, 300, 1);
    apron.position.set(W / 2, -0.06, H / 2);
    apron.receiveShadow = true;
    g.add(apron);

    const groundMat = this._makeGroundMaterial(level);
    const ground = new THREE.Mesh(this._geo.plane, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.scale.set(W, H, 1);
    ground.position.set(W / 2, 0, H / 2);
    ground.receiveShadow = true;
    ground.userData.own = [groundMat];
    g.add(ground);

    // Sky band (rows 0-2 in the 2D map) becomes a backdrop ridge with trees.
    let ridgeRows = 0;
    while (ridgeRows < H && level.tileKey[level.tiles[ridgeRows][0]] === 'obstacle' &&
           level.tiles[ridgeRows].every(t => level.tileKey[t] === 'obstacle')) ridgeRows++;
    if (ridgeRows > 0) {
      const ridge = new THREE.Mesh(this._geo.box, this._mats.ridge);
      ridge.scale.set(W, 0.8, ridgeRows);
      ridge.position.set(W / 2, 0.4, ridgeRows / 2);
      ridge.castShadow = ridge.receiveShadow = true;
      g.add(ridge);
      for (let i = 0; i < 24; i++) {
        const tx = Math.random() * (W - 1) + 0.5;
        const tz = Math.random() * (ridgeRows - 0.6) + 0.3;
        g.add(this._makeTree(tx, 0.8, tz, 0.8 + Math.random() * 0.9));
      }
    }

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const type = level.tileKey[level.tiles[y][x]];
        if (type === 'path' || type === 'spawn' || type === 'goal') {
          const m = new THREE.Mesh(this._geo.box, this._mats.path);
          m.scale.set(1, 0.1, 1);
          m.position.set(x + 0.5, 0.05, y + 0.5);
          m.receiveShadow = true;
          g.add(m);
        } else if (type === 'water') {
          const m = new THREE.Mesh(this._geo.box, this._mats.water);
          m.scale.set(1, 0.06, 1);
          m.position.set(x + 0.5, 0.03, y + 0.5);
          g.add(m);
        } else if (type === 'obstacle' && y >= ridgeRows) {
          g.add(this._makeTree(x + 0.5, 0, y + 0.5, 0.9));
        }

        if (type === 'spawn') {
          // Yellow arrow cone pointing onto the board (+x); pulses in render().
          const m = new THREE.Mesh(this._geo.cone, this._mats.spawn);
          m.scale.set(0.28, 0.7, 0.28);
          m.rotation.z = -Math.PI / 2;
          m.position.set(x + 0.45, 0.45, y + 0.5);
          m.castShadow = true;
          g.add(m);
          this._spawnArrows.push(m);
        } else if (type === 'goal') {
          const pole = new THREE.Mesh(this._geo.cyl, this._mats.goalPole);
          pole.scale.set(0.06, 1.5, 0.06);
          pole.position.set(x + 0.5, 0.75, y + 0.5);
          pole.castShadow = true;
          // Flag pivots at the pole so render() can wave it.
          const pivot = new THREE.Group();
          pivot.position.set(x + 0.5, 1.3, y + 0.5);
          const flag = new THREE.Mesh(this._geo.box, this._mats.goalFlag);
          flag.scale.set(0.55, 0.32, 0.04);
          flag.position.x = -0.3;
          flag.castShadow = true;
          pivot.add(flag);
          g.add(pole, pivot);
          this._goalFlags.push(pivot);
        }
      }
    }

    // Decorative flowers scattered on buildable grass (sparse, near tile centers
    // so they never visually block the placement read).
    const grassTiles = [];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (level.tileKey[level.tiles[y][x]] === 'ground') grassTiles.push([x, y]);
      }
    }
    const FLOWER_COLORS = [0xffffff, 0xffe66d, 0xff9ecb];
    for (let i = 0; i < Math.min(32, grassTiles.length); i++) {
      const [tx, ty] = grassTiles[Math.floor(Math.random() * grassTiles.length)];
      const fx = tx + 0.2 + Math.random() * 0.6;
      const fz = ty + 0.2 + Math.random() * 0.6;
      const flower = new THREE.Group();
      const stem = new THREE.Mesh(this._geo.cyl, this._mats.leaf);
      stem.scale.set(0.015, 0.12, 0.015);
      stem.position.y = 0.06;
      const headMat = new THREE.MeshLambertMaterial({ color: FLOWER_COLORS[i % FLOWER_COLORS.length] });
      const head = new THREE.Mesh(this._geo.sphere, headMat);
      head.scale.setScalar(0.05);
      head.position.y = 0.14;
      head.userData.own = [headMat];
      flower.add(stem, head);
      flower.position.set(fx, 0, fz);
      g.add(flower);
    }

    this._buildClouds(level, g);

    this._board = g;
    this.scene.add(g);
  },

  // Per-tile checkerboard texture for the grass plane — adds depth and makes the
  // placement grid easier to read without extra meshes.
  _makeGroundMaterial(level) {
    const W = level.gridWidth, H = level.gridHeight;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#4a7c2e' : '#528834';
        ctx.fillRect(x, y, 1, 1);
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.encoding = THREE.sRGBEncoding;
    return new THREE.MeshLambertMaterial({ map: tex });
  },

  _buildClouds(level, parent) {
    const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x9aa6b0 });
    for (let i = 0; i < 4; i++) {
      const cloud = new THREE.Group();
      if (i === 0) cloud.userData.own = [cloudMat];
      const puffs = 2 + Math.floor(Math.random() * 2);
      for (let p = 0; p <= puffs; p++) {
        const puff = new THREE.Mesh(this._geo.sphere, cloudMat);
        const s = 0.8 + Math.random() * 0.9;
        puff.scale.set(s * 1.6, s * 0.55, s);
        puff.position.set(p * 1.1 - puffs * 0.5, (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.6);
        cloud.add(puff);
      }
      cloud.position.y = 7.5 + Math.random() * 2.5;
      Object.assign(cloud.userData, {
        x0: Math.random() * (level.gridWidth + 24),
        z: 1 + Math.random() * level.gridHeight * 0.55,
        speed: 0.25 + Math.random() * 0.3,
      });
      parent.add(cloud);
      this._clouds.push(cloud);
    }
  },

  _animateScenery(now) {
    const W = Level.current.gridWidth;
    for (const cloud of this._clouds) {
      const u = cloud.userData;
      cloud.position.x = ((u.x0 + now * u.speed) % (W + 24)) - 12;
      cloud.position.z = u.z;
    }
    this._goalFlags.forEach((pivot, i) => {
      pivot.rotation.y = Math.sin(now * 4 + i) * 0.2;
    });
    const pulse = 1 + Math.sin(now * 5) * 0.12;
    for (const arrow of this._spawnArrows) {
      arrow.scale.set(0.28 * pulse, 0.7, 0.28 * pulse);
    }
  },

  _makeTree(x, baseY, z, s) {
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(this._geo.cyl, this._mats.trunk);
    trunk.scale.set(0.08 * s, 0.4 * s, 0.08 * s);
    trunk.position.y = 0.2 * s;
    const leaf = new THREE.Mesh(this._geo.cone, Math.random() < 0.5 ? this._mats.leaf : this._mats.leaf2);
    leaf.scale.set(0.34 * s, 0.85 * s, 0.34 * s);
    leaf.position.y = (0.4 + 0.42) * s;
    trunk.castShadow = leaf.castShadow = true;
    tree.add(trunk, leaf);
    tree.position.set(x, baseY, z);
    return tree;
  },

  // ─── Placement overlay / ghost / selection ────────────────────────────

  _buildPlacementOverlay() {
    const group = new THREE.Group();
    group.visible = false;
    this._placementCells = [];
    const size = CONFIG.placementCellSize;
    for (let cy = 0; cy < Grid.cellsY; cy++) {
      for (let cx = 0; cx < Grid.cellsX; cx++) {
        const m = new THREE.Mesh(this._geo.plane, this._mats.overlayAvail);
        m.rotation.x = -Math.PI / 2;
        m.scale.set(size * 0.92, size * 0.92, 1);
        const c = Grid.placementCellToWorld(cx, cy);
        m.position.set(c.centerX, 0.12, c.centerY);
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
      cell.mesh.material = Grid.isAvailable(cell.cx, cell.cy)
        ? this._mats.overlayAvail
        : this._mats.overlayBad;
    }
  },

  _initIndicators() {
    // Ghost tower preview.
    const ghost = new THREE.Group();
    const body = new THREE.Mesh(this._geo.cyl,
      new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.65 }));
    body.scale.set(0.55, 0.9, 0.55);
    body.position.y = 0.45;
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x78dc78, transparent: true, opacity: 0.9, depthWrite: false });
    const ring = new THREE.Mesh(this._geo.ring, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.scale.set(0.95, 0.95, 1);
    ring.position.y = 0.14;
    const range = this._makeRangeDisc(0.10, 0.35);
    ghost.add(body, ring, range);
    ghost.visible = false;
    ghost.userData = { body, ring, range };
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
    group.position.y = 0.11;
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
    g.userData.body.material.color.set(def.color);
    g.userData.ring.material.color.set(valid ? 0x78dc78 : 0xdc5050);
    g.userData.range.visible = valid;
    g.userData.range.scale.set(def.range, 1, def.range);
  },

  _syncSelection(state) {
    const t = state.selectedTower;
    if (!t) { this._rangeIndicator.visible = false; this._selRing.visible = false; return; }
    this._rangeIndicator.visible = true;
    this._rangeIndicator.position.set(t.position.x, 0.11, t.position.y);
    this._rangeIndicator.scale.set(t.range, 1, t.range);
    this._selRing.visible = true;
    this._selRing.position.set(t.position.x, 0.13, t.position.y);
    this._selRing.scale.set(0.85, 0.85, 1);
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
      if (u.rotGroup) u.rotGroup.rotation.y = -t.rotation;
      if (u.spin) u.spin.rotation.y = now * 1.2;
      // Recoil / pulse driven by the tower's visual-only fireAnimT countdown.
      const anim = Math.max(0, t.fireAnimT || 0);
      if (u.barrel) u.barrel.position.x = u.barrelBaseX - 0.16 * Math.min(1, anim / 0.15);
      if (u.crystal) {
        const k = Math.min(1, anim / 0.4);
        const s = 1 + 0.5 * Math.sin(k * Math.PI);
        u.crystal.scale.set(0.3 * s, 0.52 * s, 0.3 * s);
      }
      if (u.lastUpgrade !== t.upgradeLevel) this._refreshUpgradePips(obj, t);
    }
  },

  _makeTower(t) {
    const def = CONFIG.TOWERS[t.type];
    const g = new THREE.Group();
    g.position.set(t.position.x, 0, t.position.y);
    const own = [];

    const baseMat = new THREE.MeshLambertMaterial({ color: 0x9aa0a6 });
    own.push(baseMat);
    const base = new THREE.Mesh(this._geo.cyl, baseMat);
    base.scale.set(0.62, 0.5, 0.62);
    base.position.y = 0.25;
    g.add(base);

    const mat = new THREE.MeshLambertMaterial({ color: def.color });
    own.push(mat);
    const u = { own, lastUpgrade: -1 };

    if (t.type === 'basic') {
      const head = new THREE.Mesh(this._geo.box, mat);
      head.scale.set(0.55, 0.5, 0.55);
      head.position.y = 0.75;
      const rotGroup = new THREE.Group();
      rotGroup.position.y = 0.8;
      const barrel = new THREE.Mesh(this._geo.box, this._mats.stone);
      barrel.scale.set(0.85, 0.16, 0.16);
      barrel.position.x = 0.45;
      rotGroup.add(barrel);
      g.add(head, rotGroup);
      u.rotGroup = rotGroup;
      u.barrel = barrel;
      u.barrelBaseX = 0.45;
    } else if (t.type === 'circleShooter') {
      const head = new THREE.Mesh(this._geo.sphere, mat);
      head.scale.setScalar(0.34);
      head.position.y = 0.85;
      const halo = new THREE.Mesh(this._geo.torus, this._mats.stone);
      halo.scale.setScalar(0.5);
      halo.rotation.x = Math.PI / 2;
      halo.position.y = 0.85;
      const spin = new THREE.Group();
      spin.add(halo);
      g.add(head, spin);
      u.spin = spin;
      spin.position.y = 0;
    } else if (t.type === 'cannon') {
      const rotGroup = new THREE.Group();
      rotGroup.position.y = 0.62;
      const barrel = new THREE.Mesh(this._geo.cyl, mat);
      barrel.scale.set(0.18, 0.85, 0.18);
      barrel.rotation.z = -Math.PI / 2 + 0.5; // tilted up, pointing +x
      barrel.position.x = 0.3;
      barrel.position.y = 0.18;
      const hub = new THREE.Mesh(this._geo.sphere, this._mats.stone);
      hub.scale.setScalar(0.3);
      rotGroup.add(barrel, hub);
      g.add(rotGroup);
      u.rotGroup = rotGroup;
      u.barrel = barrel;
      u.barrelBaseX = 0.3;
    } else if (t.type === 'freeze') {
      const crystalMat = new THREE.MeshLambertMaterial({
        color: 0xaee4f7, emissive: 0x2e7da0, transparent: true, opacity: 0.9,
      });
      own.push(crystalMat);
      const crystal = new THREE.Mesh(this._geo.octa, crystalMat);
      crystal.scale.set(0.3, 0.52, 0.3);
      crystal.position.y = 1.05;
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
      pip.scale.setScalar(0.09);
      pip.position.set(-0.25 + i * 0.25, 0.55, 0.62);
      pips.add(pip);
    }
    obj.add(pips);
    u.pips = pips;
    u.lastUpgrade = t.upgradeLevel;
    // Upgraded towers grow bulkier — instantly readable from across the board.
    obj.scale.setScalar(1 + 0.16 * t.upgradeLevel);
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
      let y = 0.6;
      if (p.isAoE) {
        // Fake a mortar arc from launch point to the snapshotted target.
        const total = Math.hypot(p.targetPosition.x - p.startPosition.x,
                                 p.targetPosition.y - p.startPosition.y) || 1;
        const gone = Math.hypot(p.position.x - p.startPosition.x,
                                p.position.y - p.startPosition.y);
        const f = Math.min(1, gone / total);
        y = 0.5 + Math.sin(f * Math.PI) * 1.6;
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
        color: new THREE.Color(m[1] / 255, m[2] / 255, m[3] / 255),
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
