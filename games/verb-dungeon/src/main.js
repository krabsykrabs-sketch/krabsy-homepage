// Verb Dungeon: game loop, rules and interface.
// One room is on screen at a time, seen by a fixed camera. Rules in short:
//   bonk every skeleton → the door is ready → answer its verb question → next room.
//   Chests are optional bonus questions. Nothing moves while a question is open.
import * as THREE from 'three';
import { Assets } from './assets.js';
import { Char } from './chars.js';
import { buildRoom, DOOR, BOUNDS, TORCH_SPOTS, glowTex } from './room.js';
import { LEVELS } from './levels.js';
import { loadQuestions, again } from './questions.js';
import * as Q from './questions.js';
import { t, lang } from './i18n.js';
import { sfx } from './audio.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const STORE = 'krabsy_vdungeon_stars';
const MAX_HEARTS = 3;

// ── Renderer, camera, lights (same for every room) ─────────────────────────
const renderer = new THREE.WebGLRenderer({ canvas: $('c'), antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x060d1c);

const camera = new THREE.PerspectiveCamera(36, 1, 1, 120);
const CAM_TARGET = new THREE.Vector3(0, 1.0, -0.2);
const CAM_ELEV = THREE.MathUtils.degToRad(43);
function fitCamera() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const dist = Math.max(8.3 / tan, 13.2 / (tan * camera.aspect)); // fit room height / width
  camera.position.set(0, CAM_TARGET.y + Math.sin(CAM_ELEV) * dist, CAM_TARGET.z + Math.cos(CAM_ELEV) * dist);
  camera.lookAt(CAM_TARGET);
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', fitCamera);
fitCamera();

scene.add(new THREE.HemisphereLight(0x7f9cff, 0x1a1230, 0.9));
const moon = new THREE.DirectionalLight(0xa9c0ff, 1.5); // the one shadow light
moon.position.set(7, 16, 9);
moon.castShadow = true;
moon.shadow.mapSize.set(2048, 2048);
Object.assign(moon.shadow.camera, { left: -15, right: 15, top: 15, bottom: -15, near: 1, far: 50 });
moon.shadow.bias = -0.0004;
moon.shadow.normalBias = 0.03;
scene.add(moon);
const torchLights = TORCH_SPOTS.map(([x, y, z], i) => {
  const l = new THREE.PointLight(0xff9a3c, 34, 16, 1.8);
  l.position.set(x, y, z);
  l.userData.seed = i * 17.3;
  scene.add(l);
  return l;
});
const beyond = new THREE.PointLight(0xffb060, 16, 10, 1.8); // glow from the next room
beyond.position.set(0, 2.2, -10.5);
scene.add(beyond);

const dust = (() => {
  const N = 90, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 19;
    pos[i * 3 + 1] = 0.4 + Math.random() * 4;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 15;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const p = new THREE.Points(geo, new THREE.PointsMaterial({
    map: glowTex, color: 0xffd9a0, size: 0.16, transparent: true, opacity: 0.55,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  scene.add(p);
  return p;
})();

// ── Game state ─────────────────────────────────────────────────────────────
const G = {
  mode: 'loading',      // loading | menu | play | end
  menuSel: 0,           // level highlighted in the menu (keys 1–3, ←/→, Enter)
  level: 0, roomIdx: 0, hearts: MAX_HEARTS,
  asked: 0, firstTry: 0, treasures: 0,
  missed: [],           // verbs answered wrong at least once: { base, past, pp }
  pool: [], poolIdx: 0, retry: [],
  locked: false,        // hero cannot act (room change, defeat)
  invuln: 0, kbx: 0, kbz: 0, attackT: 0, attackLen: 0, hitDone: true,
  plate: null,          // { gate: 'door' | 'chest', q }
  time: 0,
};
let room = null, hero = null;
let skeletons = [];
const timers = [];      // game-clock timers, so scripted runs can fast-forward them
const after = (sec, fn) => timers.push({ t: sec, fn });

function loadStars() { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch (_) { return {}; } }
function saveStars(id, n) {
  const s = loadStars();
  if ((s[id] || 0) < n) { s[id] = n; try { localStorage.setItem(STORE, JSON.stringify(s)); } catch (_) { /* private mode */ } }
}

// ── Interface helpers ──────────────────────────────────────────────────────
const _v = new THREE.Vector3();
function pop(text, x, y, z, color) {
  _v.set(x, y, z).project(camera);
  const el = document.createElement('div');
  el.className = 'pop';
  el.textContent = text;
  if (color) el.style.color = color;
  el.style.left = `${(_v.x * 0.5 + 0.5) * window.innerWidth}px`;
  el.style.top = `${(-_v.y * 0.5 + 0.5) * window.innerHeight}px`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 950);
}
let hintTimer = 0;
function hint(text, sec = 3.5) {
  $('hint').textContent = text;
  $('hint').classList.add('on');
  hintTimer = sec;
}
let toastTimer = 0;
function toast(html, sec = 1.8) {
  $('toast').innerHTML = html;
  $('toast').classList.add('on');
  toastTimer = sec;
}
const chainHtml = (q) => `<span class="base">${q.base}</span><span class="arrow">→</span>`
  + `<span class="past">${q.past}</span><span class="arrow">→</span><span class="pp">${q.pp}</span>`;

function drawHud() {
  let h = '';
  for (let i = 0; i < MAX_HEARTS; i++) h += i < G.hearts ? '♥' : '<span class="off">♥</span>';
  $('hearts').innerHTML = h;
  $('roomLabel').textContent = `${t('level', G.level + 1)} · ${t('room', G.roomIdx + 1, LEVELS[G.level].rooms.length)}`;
  $('mute').textContent = `${sfx.muted ? '🔇' : '🔊'} ${t('sound')}`;
}
const starsHtml = (n) => '★'.repeat(n) + `<i>${'★'.repeat(3 - n)}</i>`;

function showMenu() {
  G.mode = 'menu';
  $('hud').classList.remove('on');
  $('end').classList.remove('on');
  showPlate(null);
  const stars = loadStars();
  const box = $('levels');
  box.innerHTML = '';
  LEVELS.forEach((lv, i) => {
    const b = document.createElement('button');
    b.className = 'lvl';
    b.disabled = i > 0 && !stars[LEVELS[i - 1].id] && !params.has('unlock');
    b.innerHTML = `<b>${t('level', i + 1)}</b><span>${starsHtml(stars[lv.id] || 0)}</span>`;
    b.addEventListener('click', () => { sfx.init(); sfx.uiClick(); startLevel(i); });
    box.appendChild(b);
  });
  const open = [...box.children].map((b) => !b.disabled).lastIndexOf(true);
  selectLevel(Math.max(0, open));
  $('menu').classList.add('on');
}

// ── Question plate ─────────────────────────────────────────────────────────
function nextQuestion() {
  if (G.retry.length) return G.retry.shift();
  const q = G.pool[G.poolIdx % G.pool.length];
  G.poolIdx += 1;
  return { ...q };
}
function showPlate(plate) {
  if ((G.plate && G.plate.gate) === (plate && plate.gate)) return;
  G.plate = plate;
  $('plate').classList.toggle('on', !!plate);
  if (!plate) return;
  const q = plate.q;
  // Positional notation, never grammar terms: the asked blank is highlighted.
  // When the 3rd form is asked, the 2nd is shown (chain order, see questions.js).
  const blank = (form) => `<span class="blank ${form}${q.ask === form ? ' ask' : ''}">&nbsp;</span>`;
  const second = q.ask === 'pp' ? `<span class="past">${q.past}</span>` : blank('past');
  $('chain').innerHTML = `<span class="base">${q.base}</span><span class="arrow">→</span>`
    + `${second}<span class="arrow">→</span>${blank('pp')}`;
  $('chips').innerHTML = '';
  q.options.forEach((opt, i) => {
    const b = document.createElement('button');
    b.className = 'chip' + (q.tried && q.tried.includes(i) ? ' wrong' : '');
    b.innerHTML = `<small>${i + 1}</small>${opt}`;
    b.addEventListener('click', () => answer(i));
    $('chips').appendChild(b);
  });
  $('teach').innerHTML = q.tried && q.tried.length ? teachHtml(q) : '';
}
// After a 2nd-form question the 3rd form stays hidden (`go → went → ___`): the same
// verb's 3rd form is asked next, and the full chain would give it away.
const askedChain = (q) => (q.ask === 'past'
  ? `<span class="base">${q.base}</span><span class="arrow">→</span><span class="past">${q.past}</span>`
    + '<span class="arrow">→</span><span class="pp">___</span>'
  : chainHtml(q));
const teachHtml = (q) => `${t('notQuite')} ${askedChain(q)} · ${t('tryAgain')}`;

function answer(i) {
  const plate = G.plate;
  if (!plate || G.mode !== 'play') return;
  const q = plate.q;
  if (q.tried && q.tried.includes(i)) return;
  if (q.options[i] !== q.answer) {
    // Wrong: show the full chain, grey the chip out, ask this verb again at a later door.
    if (!q.tried) {
      q.tried = [];
      G.retry.push(again(q));
      if (!G.missed.some((m) => m.base === q.base)) G.missed.push({ base: q.base, past: q.past, pp: q.pp });
    }
    q.tried.push(i);
    $('chips').children[i].classList.add('wrong');
    $('teach').innerHTML = teachHtml(q);
    sfx.bzzt();
    return;
  }
  G.asked += 1;
  if (!q.tried) G.firstTry += 1;
  sfx.sparkle();
  toast(`✓ ${askedChain(q)}`);
  if (plate.gate === 'door') {
    room.doorOpen = true;
    sfx.rumble(0.7);
    pop(t('unlocked'), DOOR.x, 3.4, DOOR.z + 0.8);
  } else {
    room.chest.open = true;
    G.treasures += 1;
    sfx.coin(0); after(0.12, () => sfx.coin(1)); after(0.24, () => sfx.coin(2));
    if (G.hearts < MAX_HEARTS) {
      G.hearts += 1;
      pop(t('heart'), room.chest.x, 2.2, room.chest.z, '#ff8585');
    } else {
      pop(t('treasure'), room.chest.x, 2.2, room.chest.z);
    }
    drawHud();
  }
  showPlate(null);
}

// ── Levels and rooms ───────────────────────────────────────────────────────
async function startLevel(i) {
  G.locked = true;
  $('menu').classList.remove('on');
  $('end').classList.remove('on');
  Object.assign(G, { level: i, roomIdx: 0, hearts: MAX_HEARTS, asked: 0, firstTry: 0, treasures: 0,
    missed: [], poolIdx: 0, retry: [] });
  try {
    G.pool = await loadQuestions({ count: 14, tiers: LEVELS[i].tiers });
  } catch (err) {
    console.error(err);
    diag('error', { msg: `startLevel: ${err.message}` });
    showMenu();
    $('tagline').textContent = `⚠ ${err.message}`;
    return;
  }
  G.mode = 'play';
  $('hud').classList.add('on');
  enterRoom(0);
}

function spawnSkeletons() {
  for (const s of skeletons) s.dispose();
  skeletons = (room.def.skeletons || []).map((route) => {
    const s = new Char(Assets.skeleton, Assets.clips);
    s.route = route.map(([x, z]) => ({ x, z }));
    s.pos.set(s.route[0].x, 0, s.route[0].z);
    s.wp = 1 % s.route.length; s.mode = 'patrol'; s.t = 0; s.pause = 0; s.squash = 0;
    s.play('Walking_A');
    scene.add(s.root);
    return s;
  });
}
const roomCleared = () => skeletons.every((s) => s.mode !== 'patrol');

function enterRoom(idx) {
  if (room) room.dispose();
  const defs = LEVELS[G.level].rooms;
  room = buildRoom(defs[idx]);
  scene.add(room.group);
  G.roomIdx = idx;
  spawnSkeletons();
  room.cleared = roomCleared();
  hero.pos.set(0, 0, 6.4);
  hero.root.rotation.y = Math.PI;
  hero.setVisible(true);
  hero.play('Idle_A');
  Object.assign(G, { locked: false, invuln: 0, kbx: 0, kbz: 0, attackT: 0, hitDone: true });
  showPlate(null);
  drawHud();
  $('fade').classList.remove('on');
  if (G.mode === 'play') hint(skeletons.length ? t('hintBonk') : t('hintDoor'));
}

function leaveRoom() {
  G.locked = true;
  const last = G.roomIdx === LEVELS[G.level].rooms.length - 1;
  $('fade').textContent = last ? '' : t('nextRoom');
  $('fade').classList.add('on');
  after(0.6, () => { if (last) finishLevel(); else enterRoom(G.roomIdx + 1); });
}

function finishLevel() {
  G.mode = 'end';
  const ratio = G.asked ? G.firstTry / G.asked : 1;
  const stars = ratio >= 1 ? 3 : ratio >= 0.6 ? 2 : 1;
  saveStars(LEVELS[G.level].id, stars);
  sfx.fanfare();
  $('hud').classList.remove('on');
  $('endTitle').textContent = t('done');
  $('stars').innerHTML = starsHtml(stars);
  $('endLine').textContent = t('firstTry', G.firstTry, G.asked);
  $('missed').innerHTML = G.missed.length
    ? `<p>${t('practise')}</p>${G.missed.map((m) => `<div>${chainHtml(m)}</div>`).join('')}`
    : `<p>${t('perfect')}</p>`;
  $('btnNext').style.display = G.level < LEVELS.length - 1 ? '' : 'none';
  $('end').classList.add('on');
  $('fade').classList.remove('on');
  // Backdrop behind the end screen: the treasure room, calm.
  hero.pos.set(0, 0, 3); hero.root.rotation.y = 0; hero.play('Idle_A');
  for (const s of skeletons) s.dispose();
  skeletons = [];
}

function defeat() {
  G.locked = true;
  sfx.dizzy();
  hero.play('Death_A', { once: true });
  pop('✦ ✦ ✦', hero.pos.x, 3, hero.pos.z);
  hint(t('dizzy'), 4);
  after(1.3, () => $('fade').classList.add('on'));
  after(1.9, () => {
    G.hearts = MAX_HEARTS;
    const { doorOpen, doorQ, chest } = room;
    const keep = { doorOpen, doorQ, chestOpen: chest && chest.open, chestQ: chest && chest.q };
    enterRoom(G.roomIdx);
    Object.assign(room, { doorOpen: keep.doorOpen, doorQ: keep.doorQ });
    if (room.chest) { room.chest.open = keep.chestOpen; room.chest.q = keep.chestQ; }
    if (room.doorOpen) for (const s of skeletons) s.mode = 'calm';
    room.cleared = roomCleared();
  });
}

// ── Local diagnostics (localhost only): key presses, heartbeat and errors go to the
// dev server's request log as `diag?…`, so a session can see what a tester's browser does.
const DIAG = ['localhost', '127.0.0.1'].includes(location.hostname) && !params.has('qa');
function diag(kind, extra = {}) {
  if (!DIAG) return;
  const d = { kind, frames: typeof frameCount === 'number' ? frameCount : -1, mode: G.mode, locked: G.locked, focus: document.hasFocus(), keys: [...keys],
    t: +G.time.toFixed(1), pos: hero ? hero.pos.toArray().map((v) => +v.toFixed(2)) : null,
    plate: G.plate && G.plate.gate, ...extra };
  fetch(`diag?${encodeURIComponent(JSON.stringify(d))}`).catch(() => {});
}
window.addEventListener('error', (e) => diag('error', { msg: e.message, at: `${e.filename}:${e.lineno}` }));
window.addEventListener('unhandledrejection', (e) => diag('rejection', { msg: String(e.reason && (`${e.reason.message || e.reason} | ${e.reason.stack || ''}`)) }));
document.addEventListener('click', (e) => { if (e.target.closest('button')) e.target.closest('button').blur(); });
document.addEventListener('keydown', (e) => diag('keydown', { code: e.code, key: e.key, target: e.target.tagName }), true);
window.addEventListener('blur', () => diag('blur'));
window.addEventListener('focus', () => diag('focus'));
setInterval(() => diag('beat'), 2000);

// ── Input ──────────────────────────────────────────────────────────────────
const keys = new Set();
window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  keys.add(e.code);
  if (G.mode === 'menu' || G.mode === 'end') { menuKey(e); return; }
  if (G.mode !== 'play') return;
  if (e.code === 'Space') bonk();
  if (['Digit1', 'Digit2', 'Digit3', 'Numpad1', 'Numpad2', 'Numpad3'].includes(e.code)) answer(Number(e.code.slice(-1)) - 1);
  if (e.code === 'KeyM') toggleMute();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());
function menuKey(e) {
  const btns = G.mode === 'menu' ? [...$('levels').children] : [];
  const n = ['Digit1', 'Digit2', 'Digit3', 'Numpad1', 'Numpad2', 'Numpad3'].indexOf(e.code) % 3;
  if (G.mode === 'menu' && e.code.match(/^(Digit|Numpad)[1-3]$/) && !btns[n].disabled) { selectLevel(n); return; }
  if (G.mode === 'menu' && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) {
    const d = e.code === 'ArrowRight' ? 1 : -1;
    const k = G.menuSel + d;
    if (btns[k] && !btns[k].disabled) selectLevel(k);
    return;
  }
  if (e.code === 'Enter' || e.code === 'Space') {
    e.preventDefault();
    sfx.init(); sfx.uiClick();
    if (G.mode === 'menu') startLevel(G.menuSel);
    else startLevel(G.level < LEVELS.length - 1 && loadStars()[LEVELS[G.level].id] ? G.level + 1 : G.level);
  }
}
function selectLevel(k) {
  G.menuSel = k;
  [...$('levels').children].forEach((b, i) => b.classList.toggle('sel', i === k));
}
function toggleMute() { sfx.setMuted(!sfx.muted); drawHud(); }
$('focus').addEventListener('click', () => { window.focus(); sfx.init(); });
$('mute').addEventListener('click', () => { sfx.init(); toggleMute(); });
$('btnNext').addEventListener('click', () => { sfx.uiClick(); startLevel(G.level + 1); });
$('btnAgain').addEventListener('click', () => { sfx.uiClick(); startLevel(G.level); });
$('btnMenu').addEventListener('click', () => { sfx.uiClick(); showMenu(); });

// ── Hero ───────────────────────────────────────────────────────────────────
// The swing plays on the arms and chest only (clip 'ChopUpper', see Assets), on top of
// whatever the legs do, so you can swing while running. The clip's wind-up (0–0.47 s)
// is mostly skipped: it starts with the arm half raised, the blade comes down at clip
// time ~0.57 s, which is ~0.13 s after the key press.
const SWING = { from: 0.33, to: 0.78, speed: 1.6, hitAfter: 0.12, weight: 12 };
function bonk() {
  if (G.locked || G.attackT > 0) return;
  const a = hero.actions.ChopUpper;
  a.reset();
  a.time = SWING.from;
  a.timeScale = SWING.speed;
  a.setLoop(THREE.LoopOnce, 1);
  a.clampWhenFinished = true;
  a.setEffectiveWeight(SWING.weight); // outweighs the base clip on the arm bones
  a.play();
  G.attackT = G.attackLen = (SWING.to - SWING.from) / SWING.speed;
  G.hitDone = false;
  sfx.swing();
}
function bonkCheck() {
  const p = hero.pos, a = hero.root.rotation.y, fx = Math.sin(a), fz = Math.cos(a);
  for (const s of skeletons) {
    if (s.mode === 'down' || s.mode === 'rise') continue;
    const dx = s.pos.x - p.x, dz = s.pos.z - p.z, d = Math.hypot(dx, dz);
    if (d > 2.6 || (d > 0.6 && (dx * fx + dz * fz) / d < 0.2)) continue;
    s.mode = 'down'; s.t = 2.6; s.squash = 1;
    s.play('Death_A', { once: true, fade: 0.08 });
    sfx.bonk(); after(0.15, () => sfx.boneRattle());
    pop(t('bonk'), s.pos.x, 2.6, s.pos.z);
  }
  if (!room.cleared && roomCleared()) {
    room.cleared = true;
    after(0.5, () => { sfx.sparkle(); if (!room.doorOpen) hint(t('hintKey')); });
  }
}

function collide(p, r, allowDoor) {
  p.x = Math.min(BOUNDS.maxX, Math.max(BOUNDS.minX, p.x));
  const inDoor = allowDoor && Math.abs(p.x - DOOR.x) < 0.7;
  p.z = Math.min(BOUNDS.maxZ, Math.max(inDoor ? -10.5 : BOUNDS.minZ, p.z));
  if (p.z < BOUNDS.minZ) p.x = Math.min(DOOR.x + 0.7, Math.max(DOOR.x - 0.7, p.x));
  for (const o of room.obstacles) {
    const dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz), min = o.r + r;
    if (d < min && d > 1e-4) { p.x = o.x + dx / d * min; p.z = o.z + dz / d * min; }
  }
}
const near = (p, x, z, r) => (p.x - x) ** 2 + (p.z - z) ** 2 < r * r;

let doorNagT = 0;
function updateHero(dt) {
  const p = hero.pos;
  if (G.invuln > 0) {
    G.invuln -= dt;
    hero.setVisible(G.invuln <= 0 || Math.floor(G.time * 14) % 2 === 0);
  }
  if (G.locked) return;
  // Knock-back after a skeleton bump.
  if (G.kbx || G.kbz) {
    p.x += G.kbx * dt; p.z += G.kbz * dt;
    const k = Math.max(0, 1 - dt * 6); G.kbx *= k; G.kbz *= k;
    if (Math.abs(G.kbx) + Math.abs(G.kbz) < 0.3) G.kbx = G.kbz = 0;
    collide(p, 0.55, false);
  }
  if (G.attackT > 0) {
    G.attackT -= dt;
    if (!G.hitDone && G.attackLen - G.attackT >= SWING.hitAfter) { G.hitDone = true; bonkCheck(); }
    if (G.attackT <= 0) hero.actions.ChopUpper.fadeOut(0.12);
  }
  {
    let dx = 0, dz = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) dx -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) dx += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) dz -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) dz += 1;
    if (dx || dz) {
      const n = Math.hypot(dx, dz), speed = 6.2;
      p.x += dx / n * speed * dt; p.z += dz / n * speed * dt;
      collide(p, 0.55, room.doorOpen);
      hero.face(dx, dz, dt);
      hero.play('Running_A');
    } else {
      hero.play('Idle_A');
    }
  }
  // Which question plate is open? Door first, then chest.
  let plate = null;
  const atDoor = near(p, DOOR.x, DOOR.z + 1.2, 3.2);
  if (!room.doorOpen && atDoor) {
    if (room.cleared) {
      room.doorQ = room.doorQ || nextQuestion();
      plate = { gate: 'door', q: room.doorQ };
    } else if (doorNagT <= 0) { hint(t('hintBonk'), 2.5); doorNagT = 4; }
  }
  const c = room.chest;
  if (!plate && c && !c.open && near(p, c.x, c.z, 2.7)) {
    c.q = c.q || nextQuestion();
    plate = { gate: 'chest', q: c.q };
  }
  doorNagT -= dt;
  showPlate(plate);
  if (p.z < -8.4) leaveRoom();
}

// ── Skeletons ──────────────────────────────────────────────────────────────
function updateSkeleton(s, dt, frozen) {
  const p = s.pos, hp = hero.pos;
  if (s.squash > 0) { // squash and stretch on the bonk
    s.squash = Math.max(0, s.squash - dt * 4);
    const k = Math.sin(s.squash * Math.PI);
    s.root.scale.set(1 + k * 0.25, 1 - k * 0.3, 1 + k * 0.25);
  }
  if (s.mode === 'down') {
    s.t -= dt;
    if (s.t <= 0) { s.mode = 'rise'; s.t = s.dur('Spawn_Ground'); s.play('Spawn_Ground', { once: true, fade: 0.05 }); sfx.reassemble(); }
    return;
  }
  if (s.mode === 'rise') {
    s.t -= dt;
    if (s.t <= 0) { s.mode = 'calm'; s.play('Walking_A'); }
    return;
  }
  // Nothing attacks while a question is open, the hero is dizzy, or after a bump.
  if (frozen || s.pause > 0) { s.pause -= dt; s.play('Idle_A'); return; }
  const angry = s.mode === 'patrol'; // not bonked yet; 'calm' ones just wander, sheepish
  const chase = angry && near(p, hp.x, hp.z, 6) && hp.z > BOUNDS.minZ;
  const goal = chase ? hp : s.route[s.wp];
  const dx = goal.x - p.x, dz = goal.z - p.z, d = Math.hypot(dx, dz);
  if (chase && d < 1.15) {
    if (G.invuln <= 0) bump(s, dx / d, dz / d);
    return;
  }
  if (!chase && d < 0.4) { s.wp = (s.wp + 1) % s.route.length; return; }
  const speed = chase ? 2.7 : angry ? 1.6 : 1.1;
  p.x += dx / d * speed * dt; p.z += dz / d * speed * dt;
  collide(p, 0.5, false);
  s.face(dx, dz, dt, 6);
  s.play('Walking_A', { speed: chase ? 1.5 : 1 });
}
function bump(s, nx, nz) {
  G.hearts -= 1;
  G.invuln = 1.6; G.kbx = nx * 9; G.kbz = nz * 9;
  s.pause = 1.3;
  sfx.hurt();
  pop(t('ouch'), hero.pos.x, 3, hero.pos.z, '#ff8585');
  drawHud();
  if (G.hearts <= 0) defeat();
}

// ── World ──────────────────────────────────────────────────────────────────
function updateWorld(dt) {
  const time = G.time;
  torchLights.forEach((l, i) => {
    const f = 0.82 + 0.12 * Math.sin(time * 9 + l.userData.seed) + 0.08 * Math.sin(time * 23.7 + l.userData.seed * 3);
    l.intensity = 34 * f;
    if (room) room.glows[i].scale.setScalar(2.6 * (0.9 + (f - 0.82) * 0.9));
  });
  if (room) {
    const k = Math.min(1, dt * 4);
    room.doorLeaf.rotation.y += ((room.doorOpen ? 1.9 : 0) - room.doorLeaf.rotation.y) * k;
    if (room.chest) room.chest.lid.rotation.x += ((room.chest.open ? -1.15 : 0) - room.chest.lid.rotation.x) * Math.min(1, dt * 6);
    // Key sign above the door: shown while the door is ready but still locked.
    const ks = (room.cleared && !room.doorOpen && G.mode === 'play') ? 1.5 : 0.001;
    const sc = room.keyIcon.scale.x + (ks - room.keyIcon.scale.x) * Math.min(1, dt * 8);
    room.keyIcon.scale.setScalar(sc);
    room.keyIcon.position.y = 3.5 + Math.sin(time * 2.2) * 0.15;
    room.keyIcon.rotation.y = time * 1.6;
    room.keyGlow.material.opacity = (sc / 1.5) * (0.55 + 0.15 * Math.sin(time * 3));
  }
  const a = dust.geometry.attributes.position;
  for (let i = 0; i < a.count; i++) {
    let y = a.getY(i) + dt * 0.12;
    if (y > 4.6) y = 0.4;
    a.setY(i, y);
    a.setX(i, a.getX(i) + Math.sin(time * 0.5 + i) * dt * 0.05);
  }
  a.needsUpdate = true;
}

// ── Main loop ──────────────────────────────────────────────────────────────
let focusShown = false;
function step(dt) {
  G.time += dt;
  for (let i = timers.length - 1; i >= 0; i--) {
    timers[i].t -= dt;
    if (timers[i].t <= 0) { const { fn } = timers[i]; timers.splice(i, 1); fn(); }
  }
  if (hintTimer > 0 && (hintTimer -= dt) <= 0) $('hint').classList.remove('on');
  if (toastTimer > 0 && (toastTimer -= dt) <= 0) $('toast').classList.remove('on');
  // Keys only reach the page while it has focus (it often sits in a frame or panel).
  // Without focus: pause and ask for a click instead of ignoring the keyboard silently.
  const unfocused = G.mode === 'play' && !params.has('qa') && !document.hasFocus();
  if (unfocused !== focusShown) { focusShown = unfocused; $('focus').classList.toggle('on', unfocused); if (unfocused) keys.clear(); }
  if (G.mode === 'play' && !unfocused) {
    updateHero(dt);
    const frozen = !!G.plate || G.locked;
    for (const s of skeletons) updateSkeleton(s, dt, frozen);
  }
  updateWorld(dt);
  hero.mixer.update(dt);
  for (const s of skeletons) s.mixer.update(dt);
}
let last = 0, frameCount = 0;
function frame(ms) {
  frameCount += 1;
  const dt = Math.min(0.05, (ms - last) / 1000 || 0);
  last = ms;
  if (!window.__freeze) step(dt); // __freeze: QA screenshots of a single pose
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// ── Boot ───────────────────────────────────────────────────────────────────
function applyStatic() {
  document.documentElement.lang = lang;
  $('tagline').textContent = t('tagline');
  $('howto').innerHTML = `<div><kbd>WASD</kbd><kbd>↑↓←→</kbd>${t('howMove')}</div>`
    + `<div><kbd>Space</kbd>${t('howBonk')}</div><div><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd>${t('howAnswer')}</div>`;
  $('btnNext').textContent = t('next');
  $('btnAgain').textContent = t('again');
  $('btnMenu').textContent = t('menu');
  $('rotate').textContent = t('rotate');
  $('loading').textContent = t('loading');
  $('focusText').textContent = t('clickToPlay');
}
applyStatic();

Assets.load().then(async () => {
  hero = new Char(Assets.knight, Assets.clips);
  // GLTFLoader strips the dot from bone names: 'handslot.r' arrives as 'handslotr'.
  const r = hero.root.getObjectByName('handslotr'), l = hero.root.getObjectByName('handslotl');
  if (r) r.add(Assets.sword.clone(true));
  if (l) l.add(Assets.shield.clone(true));
  scene.add(hero.root);
  // Backdrop behind the menu: the first room, no skeletons.
  room = buildRoom(LEVELS[0].rooms[0]);
  scene.add(room.group);
  room.cleared = false;
  hero.pos.set(0, 0, 3); hero.play('Idle_A');
  $('loading').remove();
  showMenu();

  // QA hook: lets a script play without a keyboard (see CLAUDE.md).
  const run = (n) => { for (let i = 0; i < n; i++) step(1 / 30); };
  const QA = window.__VD = {
    G, keys, run, step, startLevel, answer, bonk,
    get room() { return room; }, get hero() { return hero; }, get skeletons() { return skeletons; },
    info: () => ({ mode: G.mode, level: G.level, room: G.roomIdx, hearts: G.hearts, asked: G.asked,
      firstTry: G.firstTry, missed: G.missed.map((m) => m.base), plate: G.plate && G.plate.gate,
      cleared: room.cleared, doorOpen: room.doorOpen, skeletons: skeletons.map((s) => s.mode),
      source: Q.source, calls: renderer.info.render.calls, tris: renderer.info.render.triangles }),
    teleport: (x, z, rot) => { hero.pos.set(x, 0, z); if (rot != null) hero.root.rotation.y = rot; },
    bonkAll: () => {
      for (const s of skeletons) {
        hero.pos.set(s.pos.x, 0, s.pos.z + 1.4); hero.root.rotation.y = Math.PI;
        G.attackT = 0; bonk(); run(25);
      }
    },
    answerRight: () => { const q = G.plate.q; answer(q.options.indexOf(q.answer)); },
    answerWrong: () => { const q = G.plate.q; answer(q.options.findIndex((o) => o !== q.answer)); },
    // Plays the current room to the next one. wrongFirst = make one mistake at the door.
    playRoom: (wrongFirst) => {
      const log = [];
      G.invuln = 99; // the script teleports into skeletons; keep it from getting bumped
      QA.bonkAll(); run(20);
      if (room.chest) { QA.teleport(room.chest.x - 1.6, room.chest.z + 1.4); run(3); log.push(`chest:${G.plate && G.plate.gate}`); QA.answerRight(); run(10); }
      QA.teleport(0, -5.6); run(3);
      log.push(`door:${G.plate && G.plate.gate}`);
      if (wrongFirst) QA.answerWrong();
      QA.answerRight(); run(30);
      QA.teleport(0, -6.9); keys.add('KeyW'); run(12); keys.delete('KeyW');
      run(25);
      return log;
    },
  };
  requestAnimationFrame(frame);
  if (params.has('play') && !params.has('qa')) startLevel(Math.max(0, Number(params.get('play')) - 1)); // dev: skip the menu

  // ?qa=play[&level=2][&stop=3] plays a level by script and prints the result (headless checks).
  // ?qa=keys: like a real player — click path (sound on), real frames, synthetic key events.
  if (params.get('qa') === 'keys') {
    const out = [];
    const report = () => { $('qa').textContent = JSON.stringify(out); fetch(`qa-report?${encodeURIComponent(JSON.stringify(out))}`).catch(() => {}); };
    window.addEventListener('error', (e) => { out.push(`WINDOW ERROR ${e.message} @${e.lineno}`); report(); });
    try {
      if (params.has('sound')) sfx.init();
      await startLevel(0);
      out.push({ start: hero.pos.toArray(), locked: G.locked, mode: G.mode });
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', key: 'w' }));
      await new Promise((r) => setTimeout(r, 1500));
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', key: 'w' }));
      out.push({ afterW: hero.pos.toArray(), keys: [...keys], locked: G.locked, t: G.time, anim: hero.current });
    } catch (err) { out.push(`ERROR ${err.stack || err}`); }
    report();
  } else if (params.has('qa')) {
    const out = [];
    try {
      await startLevel(Number(params.get('level') || 1) - 1);
      const stopAt = Number(params.get('stop') || 99);
      for (let i = 0; i < 9 && G.mode === 'play' && i < stopAt; i++) {
        out.push({ room: i, log: QA.playRoom(i === 0), after: QA.info() });
      }
      if (params.get('qa') === 'door') { // stand at the next door with its question open
        G.invuln = 99; QA.bonkAll(); run(20); QA.teleport(0, -5.6, Math.PI); run(3);
        out.push({ plate: G.plate && G.plate.gate, q: G.plate && `${G.plate.q.base}:${G.plate.q.ask}` });
        window.__freeze = true;
      }
      if (params.get('qa') === 'swing') { // swing while running, then hold the pose for a screenshot
        G.invuln = 99; QA.teleport(1.5, 5.5, Math.PI * 0.75); keys.add('KeyW'); keys.add('KeyA'); run(10);
        const t0 = hero.pos.toArray(); bonk(); run(Number(params.get('n') || 4));
        out.push({ tracks: Assets.clips.ChopUpper.tracks.length, moved: +(Math.hypot(hero.pos.x - t0[0], hero.pos.z - t0[2])).toFixed(2), base: hero.current, attackT: +G.attackT.toFixed(2) });
        window.__freeze = true;
      }
      if (params.get('qa') === 'hurt') { // stand still among angry skeletons until dizzy, then wait
        G.invuln = 0; hero.setVisible(true);
        for (let i = 0; i < 12 && G.hearts > 0; i++) { QA.teleport(skeletons[0].pos.x, skeletons[0].pos.z + 1); run(60); out.push(`hearts ${G.hearts}`); }
        out.push({ dizzy: QA.info() }); run(90); out.push({ restarted: QA.info() });
      }
    } catch (err) { out.push(`ERROR ${err.stack || err}`); }
    $('qa').textContent = JSON.stringify(out);
    // Local test runs read the result from the dev server's request log.
    if (['localhost', '127.0.0.1'].includes(location.hostname)) fetch(`qa-report?${encodeURIComponent(JSON.stringify(out))}`).catch(() => {});
  }
}).catch((err) => {
  console.error(err);
  $('loading').textContent = `Could not load the game:\n${err.message}`;
});
