// Krabsy Tower — entry point.
// Loads authored krabsy-level rooms via the §7 loader, assembles them into a
// fixed-grid tower, and renders a fixed orthographic cutaway. Default experience
// is the build-and-grow GAME (game.js). `?sandbox=1` is the free author/build
// mode (builder.js). `?room=<id>` renders a single room (QA). QA hooks at bottom.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { loadLevel, preloadLevel } from './loader.js';
import { makeCamera, frameCamera } from './camera.js';
import { buildTower, makeRoomSlot, disposeObject, cullShell } from './building.js';
import { Character, preloadCharacters, deriveWaypoints } from './character.js';
import { createBuilder } from './builder.js';
import { createGame } from './game.js';
import { CameraRig } from './cameraRig.js';

// ── query overrides (QA / tuning, no edits needed) ───────────────────────
const Q = new URLSearchParams(location.search);
const qNum = (k, d) => (Q.has(k) ? parseFloat(Q.get(k)) : d);
if (Q.has('tilt'))    CONFIG.CAMERA_TILT_DEG = qNum('tilt');
if (Q.has('yaw'))     CONFIG.CAMERA_YAW_DEG = qNum('yaw');
if (Q.has('yawRoom')) CONFIG.ROOM_YAW_DEG = qNum('yawRoom');
if (Q.has('pitch'))   CONFIG.STORY_PITCH = qNum('pitch');
if (Q.has('persp'))   CONFIG.USE_PERSPECTIVE = Q.get('persp') === '1';
const ANIM = Q.get('anim') !== '0';            // ?anim=0 freezes characters (deterministic screenshot)
const SINGLE_ROOM = Q.get('room');             // ?room=simroom1 → render just that room
const SANDBOX = Q.get('sandbox') === '1';      // ?sandbox=1 → free author/build mode (no economy)
const START_BUILD = Q.get('build') === '1';    // ?build=1 → (sandbox) open build panel on load
const SHOW_UI = Q.get('ui') !== '0';           // ?ui=0 → hide game UI (clean diorama view)
const USE_3D = !SANDBOX && !SINGLE_ROOM && Q.get('flat') !== '1';   // 3D dollhouse orbit camera (default); ?flat=1 → ortho cutaway

const LS_KEY = 'simtower.layout';
const GAME_START_LAYOUT = [['simroom1', null], [null, null]];   // a tiny starter lot to grow from
const SANDBOX_DEFAULT_LAYOUT = [['simroom1', 'SimOffice'], ['SimOffice', 'simroom1'], ['simroom1', 'SimOffice']];

// ── DOM + error surfacing ────────────────────────────────────────────────
const canvas = document.getElementById('c');
const overlay = document.getElementById('overlay');
const ovmsg = document.getElementById('ovmsg');
const hud = document.getElementById('hud');
const errBox = document.getElementById('err');
const errors = [];
function showError(msg) {
  errors.push(msg);
  errBox.style.display = 'block';
  errBox.textContent = errors.join('\n');
  window.__ERRORS = errors;
}
window.addEventListener('error', (e) => showError('window.error: ' + (e.message || e.error)));
window.addEventListener('unhandledrejection', (e) => showError('promise: ' + (e.reason?.message || e.reason)));

// ── renderer / scene / camera ────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = CONFIG.SHADOWS;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = makeBackdropTexture();
const lightsGroup = new THREE.Group();
scene.add(lightsGroup);

let camera, rig = null;
if (USE_3D) {
  camera = new THREE.PerspectiveCamera(CONFIG.CAMERA3D.FOV, aspect(), 0.5, 400);
  rig = new CameraRig(camera, canvas);
} else {
  camera = makeCamera(aspect());
}
let frameBox = new THREE.Box3(new THREE.Vector3(-10, 0, -5), new THREE.Vector3(10, 12, 5));
const clock = new THREE.Clock();
const characters = [];
const tweens = [];          // spawn pop-in (character) tweens
let gi = 0;                 // global character index (variety)
let game = null;

function aspect() { return (innerWidth > 0 && innerHeight > 0) ? innerWidth / innerHeight : 1.5; }

function makeBackdropTexture() {
  const cnv = document.createElement('canvas');
  cnv.width = 4; cnv.height = 256;
  const ctx = cnv.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, CONFIG.BG_TOP);
  g.addColorStop(1, CONFIG.BG_BOTTOM);
  ctx.fillStyle = g; ctx.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(cnv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ── lighting (soft shadowbox), rebuilt to fit the current building ───────
function rebuildLights(target, box) {
  lightsGroup.clear();
  const size = box.getSize(new THREE.Vector3());
  lightsGroup.add(new THREE.AmbientLight(0xffffff, CONFIG.AMBIENT_INTENSITY));
  lightsGroup.add(new THREE.HemisphereLight(0xbfd4ff, 0x2a2030, 0.4));

  const key = new THREE.DirectionalLight(0xfff2d8, CONFIG.KEY_INTENSITY);
  key.position.set(target.x + 9, target.y + size.y * 0.7 + 14, target.z + 18);
  key.target.position.copy(target);
  if (CONFIG.SHADOWS) {
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const s = Math.max(size.x, size.y) * 0.62 + 3;
    key.shadow.camera.left = -s; key.shadow.camera.right = s;
    key.shadow.camera.top = s; key.shadow.camera.bottom = -s;
    key.shadow.camera.near = 1; key.shadow.camera.far = size.length() * 2 + 60;
    key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
  }
  lightsGroup.add(key, key.target);

  const fill = new THREE.DirectionalLight(0x9fc0ff, CONFIG.FILL_INTENSITY);
  fill.position.set(target.x - 14, target.y + 8, target.z + 12);
  fill.target.position.copy(target);
  lightsGroup.add(fill, fill.target);

  const back = new THREE.DirectionalLight(0xa8c0ff, CONFIG.BACK_LIGHT_INTENSITY);
  back.position.set(target.x - 5, target.y + size.y * 0.6 + 10, target.z - 20);
  back.target.position.copy(target);
  lightsGroup.add(back, back.target);
}

// ── characters ───────────────────────────────────────────────────────────
function clearCharacters() {
  for (const c of characters) c.obj.parent?.remove(c.obj);
  characters.length = 0;
}
/** Remove a single character (a resident moving out). */
function removeOne(char) {
  if (!char) return;
  char.obj.parent?.remove(char.obj);
  const i = characters.indexOf(char);
  if (i >= 0) characters.splice(i, 1);
}
/** Spawn one tenant into a room (room-local actors layer). Optional pop-in. */
function spawnOne(room, { bounce = false } = {}) {
  const { waypoints, nav } = deriveWaypoints(room);
  if (!waypoints.length) return null;
  const k = room.__n = (room.__n || 0) + 1;       // nth tenant in this room (this build)
  const c = new Character(gi++, waypoints, nav);
  c.wi = ((k - 1) * Math.max(1, Math.floor(waypoints.length / 2))) % waypoints.length;
  c.obj.position.copy(waypoints[c.wi].pos);
  c.timer = 0.3 + (gi % 5) * 0.27 + (k - 1) * 0.7;
  room.actors.add(c.obj);
  characters.push(c);
  if (bounce) { c.obj.scale.setScalar(0.01); tweens.push({ obj: c.obj, t: 0, dur: 0.42 }); }
  return c;
}
/** Default (no-game) populate: a couple of tenants per room, unless editing. */
function dioramaPopulate(rooms) {
  if (tower.buildMode) return;
  for (const r of rooms) for (let i = 0; i < CONFIG.CHARS_PER_ROOM; i++) spawnOne(r, { bounce: false });
}
function updateTweens(dt) {
  const c1 = 1.70158, c3 = c1 + 1;
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i]; tw.t += dt;
    const k = Math.min(1, tw.t / tw.dur);
    const s = 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);  // easeOutBack
    tw.obj.scale.setScalar(Math.max(0.01, s));
    if (k >= 1) { tw.obj.scale.setScalar(1); tweens.splice(i, 1); }
  }
}

// ── room discovery (auto-find levels/*.json + manifest labels) ────────────
function prettify(id) { return id.replace(/[_-]+/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()); }
async function discoverRooms() {
  const rooms = {};
  try {
    const html = await (await fetch('levels/')).text();
    for (const m of html.matchAll(/href="([^"]+\.json)"/g)) {
      const file = m[1].split('/').pop();
      if (file === 'manifest.json' || file === 'building.json') continue;
      const id = file.replace(/\.json$/, '');
      rooms[id] = { id, label: prettify(id), url: 'levels/' + file };
    }
  } catch (_) { /* host without dir listing */ }
  try {
    const man = await (await fetch('levels/manifest.json')).json();
    for (const r of (man.rooms || man)) {
      const id = r.id || r;
      rooms[id] = { id, label: r.label || prettify(id), url: r.url || ('levels/' + id + '.json') };
    }
  } catch (_) { /* no manifest */ }
  if (!Object.keys(rooms).length) {
    rooms.simroom1 = { id: 'simroom1', label: 'Apartment', url: 'levels/simroom1.json' };
    rooms.SimOffice = { id: 'SimOffice', label: 'Office', url: 'levels/SimOffice.json' };
  }
  return rooms;
}

// ── the tower controller (owns layout + rebuild) ─────────────────────────
const tower = {
  cols: 2,
  layout: [],
  rooms: {},
  levels: {},
  built: null,
  buildMode: false,    // sandbox panel open (builder)
  gameActive: false,
  freeBuild: false,    // sandbox-within-game
  gutter: 0,           // left framing gutter (for a docked panel)
  brush: null,
  repopulate: dioramaPopulate,
  onRebuilt: null,

  idsInUse() {
    const set = new Set();
    for (const fl of this.layout) for (const id of fl) if (id) set.add(id);
    return [...set];
  },
  async ensureLevels(ids) {
    await Promise.all(ids.map(async (id) => {
      if (this.levels[id]) return;
      const def = this.rooms[id];
      if (!def) { console.warn('[sim-tower] unknown room id:', id); return; }
      const lvl = await loadLevel(def.url);
      await preloadLevel(lvl);
      this.levels[id] = lvl;
    }));
  },
  async rebuild() {
    await this.ensureLevels(this.idsInUse());
    if (this.built) { scene.remove(this.built.group); disposeObject(this.built.group); }
    clearCharacters();
    const built = buildTower(this.layout, { cols: this.cols, levelsById: this.levels, defaultSlotW: 13 });
    this.built = built;
    scene.add(built.group);
    frameBox = built.box;
    const center = frameBox.getCenter(new THREE.Vector3());
    if (rig) rig.fit(frameBox);
    else frameCamera(camera, frameBox, aspect(), this.gutter);
    rebuildLights(center, frameBox);
    if (this.repopulate) this.repopulate(built.rooms);
    if (this.onRebuilt) this.onRebuilt();
    renderer.render(scene, camera);
  },
  async setSlot(c, f, id) {
    if (f < 0 || f >= this.layout.length || c < 0 || c >= this.cols) return;
    this.layout[f][c] = id;
    await this.rebuild();
    this.persistLocal();
  },
  async addFloor() { this.layout.push(new Array(this.cols).fill(null)); await this.rebuild(); this.persistLocal(); },
  async removeFloor() { if (this.layout.length > 1) { this.layout.pop(); await this.rebuild(); this.persistLocal(); } },
  async clear() { this.layout = this.layout.map(() => new Array(this.cols).fill(null)); await this.rebuild(); this.persistLocal(); },
  persistLocal() {
    if (this.gameActive) return;   // the LS layout is the sandbox author's; the game starts fresh and must not clobber it
    try { localStorage.setItem(LS_KEY, JSON.stringify({ cols: this.cols, layout: this.layout })); } catch (_) {}
  },
  exportJSON() {
    const blob = new Blob([JSON.stringify({ cols: this.cols, layout: this.layout }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'building.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  },
  save() { this.persistLocal(); this.exportJSON(); },
  async enterBuild() { this.buildMode = true; this.gutter = CONFIG.BUILD_PAN_FRAC; await this.rebuild(); },
  async exitBuild() { this.buildMode = false; this.gutter = 0; await this.rebuild(); },
};
window.__TOWER = tower;

function normalizeLayout(layout, cols) {
  return layout.map((floor) => {
    const row = new Array(cols).fill(null);
    for (let c = 0; c < cols; c++) { const id = floor[c]; if (id && tower.rooms[id]) row[c] = id; }
    return row;
  });
}
async function loadSandboxLayout() {
  try {
    const s = JSON.parse(localStorage.getItem(LS_KEY));
    if (s && Array.isArray(s.layout) && s.layout.length) { tower.cols = s.cols || 2; return normalizeLayout(s.layout, tower.cols); }
  } catch (_) {}
  try {
    const r = await fetch('building.json');
    if (r.ok) {
      const j = await r.json();
      const lay = Array.isArray(j) ? j : j.layout;
      if (Array.isArray(lay) && lay.length) { tower.cols = j.cols || 2; return normalizeLayout(lay, tower.cols); }
    }
  } catch (_) {}
  return normalizeLayout(SANDBOX_DEFAULT_LAYOUT, tower.cols);
}

// ── boot ─────────────────────────────────────────────────────────────────
async function boot() {
  try {
    if (SINGLE_ROOM) return await bootSingleRoom();

    ovmsg.textContent = 'finding rooms…';
    tower.rooms = await discoverRooms();
    tower.brush = tower.rooms.simroom1 ? 'simroom1' : Object.keys(tower.rooms)[0];
    await preloadCharacters();

    let layout;
    if (Q.has('layout')) {
      try { layout = normalizeLayout(JSON.parse(decodeURIComponent(Q.get('layout'))), tower.cols); }
      catch (e) { showError('bad ?layout=: ' + e); layout = normalizeLayout(GAME_START_LAYOUT, tower.cols); }
    }

    window.__SIM = { scene, camera, renderer, tower, characters, CONFIG, rig, get game() { return game; }, get frameBox() { return frameBox; } };

    if (SANDBOX) {
      // free author/build mode — no economy
      ovmsg.textContent = 'building the tower…';
      tower.layout = layout || await loadSandboxLayout();
      await tower.rebuild();
      const builder = createBuilder(tower, { THREE, scene, camera, renderer });
      tower.onRebuilt = builder.refresh;
      hud.style.display = '';
      updateSandboxHud();
      tower.onRebuilt = () => { builder.refresh(); updateSandboxHud(); };
      overlay.classList.add('hidden');
      window.__READY = true;
      if (!Q.has('t')) { loop(); if (START_BUILD) await builder.enter(); }
      else { fastForward(qNum('t', 0)); window.__READY = true; }
      return;
    }

    // ── default: the GAME ──
    ovmsg.textContent = 'opening Krabsy Tower…';
    hud.style.display = 'none';
    game = createGame(tower, { THREE, scene, camera, renderer, spawnOne, removeOne, rig });
    await game.start(layout || normalizeLayout(GAME_START_LAYOUT, tower.cols));
    if (!SHOW_UI) game.setUiVisible(false);
    applyCamQA();
    overlay.classList.add('hidden');

    if (Q.has('selftest')) { runSelfTest(); return; }
    if (Q.has('t')) { fastForward(qNum('t', 0)); window.__READY = true; return; }
    window.__READY = true;
    loop();
  } catch (e) {
    showError('boot: ' + (e?.stack || e));
    ovmsg.textContent = 'failed — see log';
    window.__READY = true;
  }
}

async function bootSingleRoom() {
  ovmsg.textContent = `loading ${SINGLE_ROOM}…`;
  const level = await loadLevel(`levels/${SINGLE_ROOM}.json`);
  await preloadLevel(level);
  const s = makeRoomSlot(level);
  scene.add(s.slot);
  frameBox = new THREE.Box3().setFromObject(s.slot);
  const target = frameCamera(camera, frameBox, aspect());
  rebuildLights(target, frameBox);
  const rooms = [{ slot: s.slot, furniture: s.furniture, actors: s.actors, grid: s.grid, level, floor: 0, col: 0 }];
  if (Q.get('chars') === '1') { for (const r of rooms) for (let i = 0; i < CONFIG.CHARS_PER_ROOM; i++) spawnOne(r); }
  window.__SIM = { scene, camera, renderer, characters, CONFIG, get frameBox() { return frameBox; } };
  hud.style.display = '';
  hud.innerHTML = `<b>${SINGLE_ROOM}</b> · single room`;
  overlay.classList.add('hidden');
  renderer.render(scene, camera);
  window.__READY = true;
  loop();
}

function updateSandboxHud() {
  const rooms = tower.built ? tower.built.rooms.length : 0;
  hud.innerHTML = `<b>Krabsy Tower</b> · sandbox · ${tower.layout.length} floor(s) · ${rooms} room(s) · ${characters.length} tenant(s)`
    + (tower.buildMode ? ' · <b>BUILD</b>' : '');
}

/** Headless self-test: drive the sim and assert residents never WALK through a
 *  blocked furniture cell. Logs a [SELFTEST] line (error if any violation). */
function runSelfTest() {
  const dt = 1 / 60;
  let walkSamples = 0, violations = 0, moved = 0, navMissing = 0;
  const hits = new Set();
  const ck = (cell) => cell.c + ',' + cell.r;
  for (let i = 0; i < 3600; i++) {
    if (game) game.tick(dt);
    for (const c of characters) {
      const bx = c.obj.position.x, bz = c.obj.position.z;
      c.update(dt);
      if (c.state !== 'walk') continue;
      if (!c.nav) { navMissing++; continue; }
      walkSamples++;
      if (bx !== c.obj.position.x || bz !== c.obj.position.z) moved++;
      // rigorous: the PLANNED path (BFS cells) must never include a furniture cell.
      if (c.bfsCells) for (const cell of c.bfsCells) {
        const k = ck(cell);
        if (c.nav.blocked.has(k)) { violations++; hits.add(k); }
      }
    }
  }
  const msg = `[SELFTEST] collision chars=${characters.length} walkSamples=${walkSamples} moved=${moved} violations=${violations} navMissing=${navMissing} hits=${[...hits].join('|')}`;
  if (violations > 0 || navMissing > 0 || walkSamples === 0) console.error(msg); else console.log(msg);
  window.__SELFTEST = { chars: characters.length, walkSamples, moved, violations, navMissing };
  window.__READY = true;
  for (let i = 0; i < 40; i++) step3D(1 / 60);
  const redraw = () => { requestAnimationFrame(redraw); renderer.render(scene, camera); };
  redraw();
}

/** Deterministic fixed-step advance (QA screenshots): advances game + tenants. */
function fastForward(T) {
  const dt = 1 / 60;
  for (let s = 0; s < Math.max(0, T); s += dt) {
    step3D(dt);
    updateTweens(dt);
    if (game) game.tick(dt);
    for (const c of characters) c.update(dt);
  }
  for (let i = 0; i < 40; i++) step3D(dt);   // settle camera/cull damping for a clean frame
  const redraw = () => { requestAnimationFrame(redraw); renderer.render(scene, camera); };
  redraw();
}

/** QA camera overrides for deterministic angle screenshots: ?az=&pol=&zoom=&fy= */
function applyCamQA() {
  if (!rig) return;
  const D = Math.PI / 180;
  if (Q.has('az')) { rig.goalAz = rig.az = qNum('az') * D; }
  if (Q.has('pol')) { rig.goalPol = rig.pol = qNum('pol') * D; }
  if (Q.has('zoom')) { rig.goalRad = rig.rad = qNum('zoom'); }
  if (Q.has('fy')) { rig.goalTarget.y = rig.target.y = qNum('fy'); }
}

function step3D(dt) {
  if (!rig) return;
  rig.update(dt);
  if (tower.built && tower.built.shell) cullShell(tower.built.shell, rig, dt);
}

function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  step3D(dt);
  updateTweens(dt);
  if (game) game.tick(dt);
  if (ANIM) for (const c of characters) c.update(dt);
  renderer.render(scene, camera);
}

addEventListener('resize', () => {
  if (camera.isPerspectiveCamera) camera.aspect = aspect();
  if (rig) rig.fit(frameBox);
  else frameCamera(camera, frameBox, aspect(), tower.gutter);
  renderer.setSize(innerWidth, innerHeight, false);
});
renderer.setSize(innerWidth, innerHeight, false);

boot();
