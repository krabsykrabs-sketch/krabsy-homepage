// Krabsy Tower — entry point.
// Loads authored krabsy-level rooms via the §7 loader, assembles them into a
// variable-width tower (SimTower-style buy-floor-space lots), and renders a 3D
// dollhouse. The build-and-grow GAME (game.js) is the single experience;
// `?sandbox=1` starts it in free-build, `?flat=1` uses the ortho cutaway, and
// `?room=<id>` renders one room (QA). QA hooks at the bottom.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { loadLevel, preloadLevel } from './loader.js';
import { makeCamera, frameCamera } from './camera.js';
import { buildTower, makeRoomSlot, disposeObject, cullShell } from './building.js';
import { Character, preloadCharacters, deriveWaypoints } from './character.js';
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

const LS_KEY = 'simtower.lots';
// a tiny starter: three ground lots, one already an apartment, to grow from
const GAME_START_LOTS = { '0:-1': null, '0:0': 'simroom1', '0:1': null };

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
const commutersGroup = new THREE.Group();   // world-space home for residents while travelling
commutersGroup.name = 'commuters';
scene.add(commutersGroup);
/** Move a character into world space (commuting) keeping its world transform. */
function detachToWorld(char) { commutersGroup.attach(char.obj); }
/** Settle a character back into a room's actors layer (world → room-local). */
function attachToRoom(char, room) { room.actors.updateWorldMatrix(true, false); room.actors.attach(char.obj); }

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

// ── the tower controller — sparse LOTS model (SimTower-style expansion) ───
// lots: Map "f:c" → content  (null = bought floor space / hallway, roomId = a
// room, 'elevator' = lift shaft). Floors are independently sized; columns may be
// negative (expanded left). You buy a lot (floor space), then build into it.
const tower = {
  lots: new Map(),
  rooms: {},           // room catalog (id → {label,url})
  levels: {},
  built: null,
  gameActive: false,
  freeBuild: false,
  gutter: 0,
  brush: null,
  repopulate: null,
  onRebuilt: null,

  key(c, f) { return f + ':' + c; },
  has(c, f) { return this.lots.has(f + ':' + c); },
  content(c, f) { return this.lots.get(f + ':' + c); },
  roomAt(c, f) { const v = this.lots.get(f + ':' + c); return (v && v !== 'elevator') ? v : null; },
  /** A lot is buyable if empty, supported (ground or a lot below), and adjacent. */
  canBuy(c, f) {
    if (this.has(c, f)) return false;
    if (f > 0 && !this.has(c, f - 1)) return false;
    if (this.lots.size === 0) return c === 0 && f === 0;
    return this.has(c - 1, f) || this.has(c + 1, f) || this.has(c, f - 1);
  },
  idsInUse() { const s = new Set(); for (const v of this.lots.values()) if (v && v !== 'elevator') s.add(v); return [...s]; },
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
    const built = buildTower(this.lots, { levelsById: this.levels, defaultSlotW: 13 });
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
  colLots(c) { const out = []; for (const [k, v] of this.lots) { const i = k.indexOf(':'); if (+k.slice(i + 1) === c) out.push([k, v]); } return out; },
  canElevator(c) { const cl = this.colLots(c); return cl.length > 0 && cl.every(([, v]) => v === null); },
  async buyLot(c, f) { if (!this.canBuy(c, f)) return false; this.lots.set(this.key(c, f), null); await this.rebuild(); this.persistLocal(); return true; },
  async setRoom(c, f, id) { if (!this.has(c, f) || this.content(c, f) === 'elevator') return false; this.lots.set(this.key(c, f), id); await this.rebuild(); this.persistLocal(); return true; },
  async buildElevator(c) { if (!this.canElevator(c)) return false; for (const [k] of this.colLots(c)) this.lots.set(k, 'elevator'); await this.rebuild(); this.persistLocal(); return true; },
  async clearRoom(c, f) { if (!this.has(c, f)) return; this.lots.set(this.key(c, f), null); await this.rebuild(); this.persistLocal(); },
  async removeLot(c, f) { if (this.has(c, f + 1)) return false; this.lots.delete(this.key(c, f)); await this.rebuild(); this.persistLocal(); return true; },
  // back-compat shim (game/builder call setSlot to place/clear a room into a lot)
  async setSlot(c, f, id) { return id == null ? this.clearRoom(c, f) : this.setRoom(c, f, id); },
  async clear() { for (const k of [...this.lots.keys()]) this.lots.set(k, null); await this.rebuild(); this.persistLocal(); },
  persistLocal() {
    if (this.gameActive) return;   // LS is the sandbox author's; the game starts fresh
    try { localStorage.setItem(LS_KEY, JSON.stringify({ lots: [...this.lots.entries()] })); } catch (_) {}
  },
  exportJSON() {
    const blob = new Blob([JSON.stringify({ lots: [...this.lots.entries()] }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'building.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  },
  save() { this.persistLocal(); this.exportJSON(); },
};
window.__TOWER = tower;

/** Parse a lots payload (Map entries array, or {key:content} object) → Map, dropping unknown rooms. */
function lotsFromData(data) {
  const m = new Map();
  const entries = Array.isArray(data) ? data : Object.entries(data || {});
  for (const [k, content] of entries) {
    const id = content && content !== 'elevator' ? (tower.rooms[content] ? content : null) : content;
    m.set(k, id ?? null);
  }
  return m;
}
async function loadSandboxLots() {
  try { const s = JSON.parse(localStorage.getItem(LS_KEY)); if (s && s.lots) return lotsFromData(s.lots); } catch (_) {}
  try { const r = await fetch('building.json'); if (r.ok) { const j = await r.json(); if (j.lots) return lotsFromData(j.lots); } } catch (_) {}
  return lotsFromData(GAME_START_LOTS);
}

// ── boot ─────────────────────────────────────────────────────────────────
async function boot() {
  try {
    if (SINGLE_ROOM) return await bootSingleRoom();

    ovmsg.textContent = 'finding rooms…';
    tower.rooms = await discoverRooms();
    tower.rooms.elevator = { id: 'elevator', label: 'Elevator 🛗', special: true };   // built into a clear column, not a level
    tower.brush = tower.rooms.simroom1 ? 'simroom1' : Object.keys(tower.rooms)[0];
    await preloadCharacters();

    // starting lots: ?lots=<json> override, else sandbox-saved / default starter
    let startLots = null;
    if (Q.has('lots')) {
      try { startLots = lotsFromData(JSON.parse(decodeURIComponent(Q.get('lots')))); }
      catch (e) { showError('bad ?lots=: ' + e); }
    }
    if (!startLots) startLots = SANDBOX ? await loadSandboxLots() : lotsFromData(GAME_START_LOTS);

    window.__SIM = { scene, camera, renderer, tower, characters, CONFIG, rig, get game() { return game; }, get frameBox() { return frameBox; } };

    // The GAME is the single experience; ?sandbox=1 just starts it in free-build.
    ovmsg.textContent = 'opening Krabsy Tower…';
    hud.style.display = 'none';
    game = createGame(tower, { THREE, scene, camera, renderer, spawnOne, removeOne, detachToWorld, attachToRoom, deriveWaypoints, rig });
    await game.start(startLots, { freeBuild: SANDBOX });
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
  if (Q.get('chars') === '1') { await preloadCharacters(); for (const r of rooms) for (let i = 0; i < CONFIG.CHARS_PER_ROOM; i++) spawnOne(r); }
  window.__SIM = { scene, camera, renderer, characters, CONFIG, get frameBox() { return frameBox; } };
  hud.style.display = '';
  hud.innerHTML = `<b>${SINGLE_ROOM}</b> · single room`;
  overlay.classList.add('hidden');
  renderer.render(scene, camera);
  window.__READY = true;
  loop();
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
