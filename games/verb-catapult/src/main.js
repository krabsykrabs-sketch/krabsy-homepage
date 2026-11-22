// Verb Catapult: answer a verb pair, get a stone, knock the skeletons off their forts.
// Milestones 1–2 (see CLAUDE.md): planck.js physics in one plane (src/physics.js), drawn
// with plain Three.js shapes; the question card and the shot table. KayKit art comes next.
import * as THREE from 'three';
import { Sim, LAUNCH, MAX_PULL, STEP, STONES, SKEL, SPECIAL_OF_LEVEL } from './physics.js';
import { loadPairs, again, source as qSource } from './questions.js';
import { t, lang, isTouch } from './i18n.js';
import { sfx } from './audio.js';

const GAME = 'verb-catapult';
const QS = new URLSearchParams(location.search);
const QA = QS.get('qa') || '';
const LEVELS = 6, BUILT = 1; // levels with data so far
const $ = (id) => document.getElementById(id);
document.documentElement.lang = lang;

// ---- site hooks (missing in local dev: then silently off) ----
let recordAttempt = () => {}, gameEvent = () => {};
import('/lib/krabsy-stats.js').then((m) => { recordAttempt = m.recordAttempt; }).catch(() => {});
import('/lib/krabsy-game-events.js').then((m) => { gameEvent = (n, d) => m.gameEvent(GAME, n, d); }).catch(() => {});

const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (_) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* private mode */ } },
};
const STARS_KEY = 'krabsy_vcatapult_stars';

// ---------------------------------------------------------------- renderer + scene
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fd3f4);
scene.fog = new THREE.Fog(0x8fd3f4, 45, 110);
const camera = new THREE.PerspectiveCamera(35, 1, 0.5, 200);

scene.add(new THREE.HemisphereLight(0xdff3ff, 0x5b8a3a, 1.3));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(-8, 22, 16);
sun.target.position.set(12, 0, 0);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 1024);
Object.assign(sun.shadow.camera, { left: -16, right: 22, top: 14, bottom: -6, near: 1, far: 70 });
scene.add(sun, sun.target);

const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
const shade = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };
{ // meadow, hills, clouds
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(700, 500), mat(0x7cc35a));
  ground.rotation.x = -Math.PI / 2; ground.position.set(15, 0, -60); ground.receiveShadow = true;
  scene.add(ground);
  const strip = new THREE.Mesh(new THREE.BoxGeometry(60, 0.3, 2.2), mat(0x6aae4b));
  strip.position.set(14, -0.14, 0); strip.receiveShadow = true; scene.add(strip);
  const hill = new THREE.SphereGeometry(1, 24, 12);
  for (const [x, z, s, c] of [[-10, -30, 14, 0x86c96a], [12, -40, 20, 0x8fd06f], [38, -32, 16, 0x86c96a], [60, -45, 22, 0x93d473]]) {
    const h = new THREE.Mesh(hill, mat(c)); h.position.set(x, -s * 0.55, z); h.scale.set(s * 1.6, s, s); scene.add(h);
  }
  const cloud = mat(0xffffff);
  for (const [x, y, z] of [[-4, 13, -25], [18, 16, -35], [34, 12, -28], [50, 17, -40]]) {
    const g = new THREE.Group();
    for (const [dx, dy, r] of [[0, 0, 2], [1.8, 0.4, 1.6], [-1.8, 0.2, 1.4], [0.6, 1, 1.4]]) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), cloud); b.position.set(dx, dy, 0); g.add(b);
    }
    g.position.set(x, y, z); g.scale.y = 0.6; scene.add(g);
  }
}

// ---- catapult (a sturdy wooden fork for now; the KayKit model comes with the art milestone)
const catapult = new THREE.Group();
{
  const wood = mat(0x9c6a3c), dark = mat(0x6b4526);
  const base = shade(new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.35, 1.3), dark)); base.position.set(-0.3, 0.3, 0);
  const wheelG = new THREE.CylinderGeometry(0.34, 0.34, 0.16, 16); wheelG.rotateX(Math.PI / 2);
  for (const [x, z] of [[-0.9, 0.7], [0.3, 0.7], [-0.9, -0.7], [0.3, -0.7]]) {
    const w = shade(new THREE.Mesh(wheelG, mat(0x4a3220))); w.position.set(x, 0.34, z); catapult.add(w);
  }
  const post = shade(new THREE.Mesh(new THREE.BoxGeometry(0.28, 1.2, 0.28), wood)); post.position.set(0, 0.95, 0);
  for (const z of [-0.45, 0.45]) {
    const arm = shade(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.75, 0.2), wood));
    arm.position.set(0.05, LAUNCH.y + 0.1, z); arm.rotation.x = z > 0 ? -0.35 : 0.35; catapult.add(arm);
  }
  catapult.add(base, post);
}
scene.add(catapult);
const bandMat = new THREE.LineBasicMaterial({ color: 0x4a2a14 });
const bandGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]);
const band = new THREE.Line(bandGeo, bandMat); scene.add(band);
const forkTips = [new THREE.Vector3(0.12, LAUNCH.y + 0.42, 0.58), new THREE.Vector3(0.12, LAUNCH.y + 0.42, -0.58)];

// ---- basket with the stones left
const BASKET = { x: -2.3, y: 0.0 };
const basket = new THREE.Group();
{
  const b = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.48, 0.55, 16, 1, true), mat(0xc9a15e)));
  b.material.side = THREE.DoubleSide; b.position.y = 0.28; basket.add(b);
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.48, 16), mat(0x8a6a38)); bottom.rotation.x = -Math.PI / 2; bottom.position.y = 0.03; basket.add(bottom);
}
basket.position.set(BASKET.x, BASKET.y, 0.3); scene.add(basket);
const basketStones = [];

// ---- shared geometries / materials for bodies
const STONE_LOOK = {
  pebble: 0xb9b4a8, normal: 0xa8a294, big: 0x8c8678, split: 0x7fa6c9, bomb: 0x9a5b2c, cannon: 0x2b2f36,
};
const BLOCK_LOOK = { wood: 0xc8925a, stone: 0x9aa0a8, hay: 0xe6c25a };
function stoneMesh(type) {
  const r = STONES[type].r;
  let m;
  if (type === 'bomb') {
    m = new THREE.Group();
    const c = shade(new THREE.Mesh(new THREE.CylinderGeometry(r, r, r * 1.7, 14), mat(STONE_LOOK.bomb)));
    c.rotation.x = Math.PI / 2; m.add(c);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 1.01, 0.04, 6, 18), mat(0xd23c3c)); m.add(ring);
  } else {
    m = shade(new THREE.Mesh(new THREE.IcosahedronGeometry(r, type === 'cannon' ? 3 : 1), mat(STONE_LOOK[type])));
    if (type !== 'cannon') m.geometry.scale(1, 0.92, 1);
  }
  return m;
}
function blockMesh(u) {
  const g = new THREE.Group();
  const depth = Math.max(1, Math.min(u.w, u.h) * 1.1);
  const m = shade(new THREE.Mesh(new THREE.BoxGeometry(u.w, u.h, depth), mat(BLOCK_LOOK[u.mat])));
  g.add(m);
  if (u.mat === 'wood' && u.w > 0.6 && u.h > 0.6) { // a crate: dark planks across
    const edge = mat(0x8d5f33);
    for (const s of [-1, 1]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(u.w * 1.01, 0.12, depth * 1.01), edge); bar.position.y = s * (u.h / 2 - 0.08); g.add(bar);
    }
    const diag = new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(u.w, u.h) * 0.85, 0.1, depth * 1.015), edge);
    diag.rotation.z = Math.atan2(u.h, u.w); g.add(diag);
  }
  g.userData.base = m.material.color.clone();
  g.userData.mat = m.material;
  return g;
}
function skelMesh() {
  const g = new THREE.Group(), bone = mat(0xf1ede0), dark = mat(0x23262e);
  const body = shade(new THREE.Mesh(new THREE.BoxGeometry(SKEL.w * 0.7, SKEL.h * 0.5, 0.35), bone)); body.position.y = -0.12;
  const head = shade(new THREE.Mesh(new THREE.SphereGeometry(0.27, 16, 12), bone)); head.position.y = SKEL.h / 2 - 0.2;
  for (const x of [-0.1, 0.1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), dark); eye.position.set(x - 0.05, SKEL.h / 2 - 0.18, 0.22); g.add(eye);
  }
  for (const x of [-0.12, 0.12]) {
    const leg = shade(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.3, 0.09), bone)); leg.position.set(x, -SKEL.h / 2 + 0.15, 0); g.add(leg);
  }
  g.add(body, head);
  g.userData.mats = [bone];
  return g;
}

// ---------------------------------------------------------------- camera fit
// Fixed camera: the whole scene (catapult to fort) is visible. In portrait it backs off.
const VIEW = { x0: -3.4, x1: 25, y0: -0.3, y1: 6.8 };
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  const vt = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const cx = (VIEW.x0 + VIEW.x1) / 2, cy = (VIEW.y0 + VIEW.y1) / 2;
  const dH = (VIEW.y1 - VIEW.y0) / 2 / vt, dW = (VIEW.x1 - VIEW.x0) / 2 / (vt * camera.aspect);
  const d = Math.max(dH, dW) * 1.02;
  const portrait = h > w;
  camera.position.set(cx - 2.5, cy + 1.3 + (portrait ? 1 : 0), d);
  camera.lookAt(cx, cy + 0.9 - (portrait ? 0.5 : 0), 0);
  camera.far = d + 160;
  scene.fog.near = d + 25; scene.fog.far = d + 100; // a far camera (portrait) must not fog the fort
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

const _v = new THREE.Vector3();
function toScreen(x, y, z = 0) {
  _v.set(x, y, z).project(camera);
  return { x: (_v.x + 1) / 2 * innerWidth, y: (1 - _v.y) / 2 * innerHeight };
}
const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
function toWorld(cx, cy) {
  ray.setFromCamera(new THREE.Vector2(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1), camera);
  const p = new THREE.Vector3(); return ray.ray.intersectPlane(plane, p) ? p : null;
}

// ---------------------------------------------------------------- particles + pops
const parts = [];
const partGeo = new THREE.BoxGeometry(1, 1, 1);
function burst(x, y, color, n = 8, size = 0.22, speed = 4) {
  const m = mat(color);
  for (let i = 0; i < n; i++) {
    const p = new THREE.Mesh(partGeo, m);
    const s = size * (0.5 + Math.random()); p.scale.set(s, s * (0.5 + Math.random()), s);
    p.position.set(x + (Math.random() - 0.5) * 0.6, y + (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.8);
    p.userData = { vx: (Math.random() - 0.5) * speed, vy: Math.random() * speed, vz: (Math.random() - 0.5) * 2,
      spin: (Math.random() - 0.5) * 12, life: 0.9 + Math.random() * 0.6 };
    p.castShadow = true; scene.add(p); parts.push(p);
  }
}
let flash = null;
function boomFlash(x, y, r) {
  if (flash) scene.remove(flash);
  flash = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffcf5e, transparent: true, opacity: 0.85 }));
  flash.position.set(x, y, 0); flash.userData = { r, t: 0 }; scene.add(flash);
}
function stepParts(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i], u = p.userData;
    u.life -= dt; u.vy -= 14 * dt;
    p.position.x += u.vx * dt; p.position.y += u.vy * dt; p.position.z += u.vz * dt;
    if (p.position.y < 0.05) { p.position.y = 0.05; u.vy *= -0.3; u.vx *= 0.6; }
    p.rotation.x += u.spin * dt; p.rotation.z += u.spin * dt;
    if (u.life < 0.3) p.scale.multiplyScalar(0.9);
    if (u.life <= 0) { scene.remove(p); parts.splice(i, 1); }
  }
  if (flash) {
    const u = flash.userData; u.t += dt;
    flash.scale.setScalar(u.r * Math.min(1, u.t * 6));
    flash.material.opacity = Math.max(0, 0.85 - u.t * 2.2);
    if (u.t > 0.4) { scene.remove(flash); flash = null; }
  }
}
function pop(x, y, text, cls = '') {
  const s = toScreen(x, y), el = document.createElement('div');
  el.className = `pop ${cls}`; el.textContent = text;
  el.style.left = `${s.x}px`; el.style.top = `${s.y}px`;
  document.body.appendChild(el); setTimeout(() => el.remove(), 1000);
}
let toastTimer = 0;
function toast(text, ms = 1300) {
  const el = $('toast'); el.innerHTML = text; el.classList.add('on');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('on'), ms);
}
let hintKey = '';
function hint(key) {
  hintKey = key || '';
  const el = $('hint');
  if (!key) { el.classList.remove('on'); return; }
  el.textContent = t(key); el.classList.add('on');
}

// ---------------------------------------------------------------- game state
const sim = new Sim(window.planck);
const meshes = new Map(); // body → mesh
const G = {
  mode: 'loading',        // menu | need | card | aim | flight | between | results
  level: 1, data: null, castle: 0,
  stonesLeft: 0, extraUsed: false, points: 0, castlePoints: 0,
  loaded: null,           // stone type in the cup
  pull: { x: 0, y: 0 }, kAng: 35, kPow: 0.75,
  flightT: 0, shots: 0, specials: 0,
  pairs: [], pairIx: 0, retry: [],
  answers: 0, correct: 0, missed: new Set(),
  castleLog: [], startedAt: 0, shotsDone: 0,
  castleAnswers: 0, castleCorrect: 0,
};

function special() {
  const c = G.data.castles[G.castle];
  return c.special || G.data.special || SPECIAL_OF_LEVEL[G.level] || 'big';
}

function clearScene() {
  for (const m of meshes.values()) scene.remove(m);
  meshes.clear();
  sim.clear();
}

function buildCastle() {
  clearScene();
  const c = G.data.castles[G.castle];
  sim.build(c);
  for (const b of [...sim.blocks, ...sim.skels]) {
    const u = b.getUserData();
    const m = u.kind === 'skel' ? skelMesh() : blockMesh(u);
    scene.add(m); meshes.set(b, m);
  }
  G.stonesLeft = c.stones; G.extraUsed = false; G.castlePoints = 0; G.shotsDone = 0;
  G.castleAnswers = 0; G.castleCorrect = 0;
  G.loaded = null;
  syncMeshes();
  updateHud();
  setMode('need');
  if (G.level === 1 && G.castle === 0) hint('hintBasket');
}

function updateHud() {
  $('castleNo').textContent = t('castle', G.castle + 1, G.data.castles.length);
  const total = G.data.castles[G.castle].stones + (G.extraUsed ? 1 : 0);
  let h = '';
  for (let i = 0; i < total; i++) h += `<i class="${i < G.stonesLeft ? '' : 'off'}"></i>`;
  $('stonesPill').innerHTML = h;
  $('points').textContent = G.points;
  // stones in the basket
  for (const s of basketStones) basket.remove(s);
  basketStones.length = 0;
  for (let i = 0; i < G.stonesLeft; i++) {
    const s = stoneMesh('normal'); s.scale.setScalar(0.75);
    s.position.set((i % 3 - 1) * 0.32, 0.45 + Math.floor(i / 3) * 0.22, (i % 2) * 0.12);
    basket.add(s); basketStones.push(s);
  }
}

function setMode(m) {
  G.mode = m;
  document.body.dataset.mode = m;
  $('basketBtn').classList.toggle('on', m === 'need');
}

// ---------------------------------------------------------------- questions
function nextPair() {
  // A missed verb comes back two cards later.
  const due = G.retry.findIndex((r) => r.due <= G.shots);
  if (due >= 0) return G.retry.splice(due, 1)[0].pair;
  const p = G.pairs[G.pairIx % G.pairs.length]; G.pairIx += 1;
  return p;
}

const card = { pair: null, step: 0, res: [null, null], busy: false };
function openCard() {
  if (G.mode !== 'need' || G.stonesLeft <= 0) return;
  sfx.init(); sfx.click();
  hint('');
  G.stonesLeft -= 1; G.shots += 1; updateHud();
  card.pair = nextPair(); card.step = 0; card.res = [null, null];
  setMode('card');
  $('askTitle').textContent = t('cardTitle');
  $('askIcon').className = '';
  renderStep();
  $('ask').classList.add('on');
}

function chainHtml(step, filled) {
  const p = card.pair, A = '<span class="arrow">→</span>';
  const base = `<span class="base">${p.base}</span>`;
  if (step === 0) {
    const b2 = filled ? `<span class="past filled">${filled}</span>` : `<span class="blank ask past">___</span>`;
    return `${base}${A}${b2}${A}<span class="blank">___</span>`;
  }
  const b3 = filled ? `<span class="pp filled">${filled}</span>` : `<span class="blank ask pp">___</span>`;
  return `${base}${A}<span class="past">${p.past}</span>${A}${b3}`;
}

function renderStep() {
  const q = card.pair.steps[card.step];
  $('askCard').className = card.step === 0 ? 'past' : 'pp';
  $('chain').innerHTML = chainHtml(card.step);
  $('teach').textContent = card.step === 1 ? t('cardUp') : '';
  const steps = $('steps').children;
  for (let i = 0; i < 2; i++) steps[i].className = i === card.step ? 'now' : card.res[i] === null ? '' : card.res[i] ? 'ok' : 'no';
  const chips = $('chips'); chips.innerHTML = '';
  q.options.forEach((o, i) => {
    const b = document.createElement('button');
    b.className = 'chip'; b.innerHTML = `<small>${i + 1}</small>${o}`;
    b.onclick = () => answer(i);
    chips.appendChild(b);
  });
  card.busy = false;
}

function stoneFromResults(r2, r3) {
  if (r2 && r3) return QA.includes('normal') ? 'normal' : special();
  if (r2 || r3) return 'normal';
  return 'pebble';
}

function answer(i) {
  if (G.mode !== 'card' || card.busy) return;
  card.busy = true;
  const q = card.pair.steps[card.step], chips = [...$('chips').children];
  const ok = q.options[i] === q.answer;
  card.res[card.step] = ok;
  G.answers += 1; G.castleAnswers += 1;
  if (ok) { G.correct += 1; G.castleCorrect += 1; }
  else G.missed.add(card.pair.base);
  try { recordAttempt(card.pair.base, card.step === 0 ? 'past' : 'participle', ok, GAME); } catch (_) { /* never break the game */ }
  chips.forEach((c, j) => { c.disabled = true; if (q.options[j] === q.answer) c.classList.add('right'); });
  $('chain').innerHTML = chainHtml(card.step, q.answer);
  if (ok) { sfx.right(); $('teach').textContent = t('right'); }
  else {
    sfx.wrong(); chips[i].classList.add('wrong');
    $('teach').innerHTML = `${t('notQuite')} <span class="${card.step === 0 ? 'past' : 'pp'}">${q.answer}</span>`;
  }
  // The icon shows the stone this pair will give.
  const icon = $('askIcon');
  if (card.step === 0) icon.className = ok ? '' : 'pebble';
  else icon.className = stoneFromResults(card.res[0], ok) === 'pebble' ? 'pebble' : (card.res[0] && ok ? 'special' : '');
  if (card.step === 0 && !ok) G.retry.push({ pair: again(card.pair), due: G.shots + 2 });
  setTimeout(() => {
    if (card.step === 0) { card.step = 1; renderStep(); return; }
    closeCard();
  }, ok ? 750 : 1500);
}

function closeCard() {
  $('ask').classList.remove('on');
  const type = stoneFromResults(card.res[0], card.res[1]);
  if (type !== 'normal' && type !== 'pebble') { G.specials += 1; sfx.upgrade(); }
  G.loaded = type;
  const m = stoneMesh(type); scene.add(m); G.cupMesh = m;
  G.pull = { x: 0, y: 0 };
  toast(t(`stone_${type}`), 1100);
  setMode('aim');
  if (G.level === 1 && G.castle === 0 && G.shotsDone === 0) hint(isTouch ? 'hintAim' : 'hintAimKeys');
  else if (type === 'split') hint('hintSplit');
}

// ---------------------------------------------------------------- aiming + firing
let drag = null; // { x0, y0 } world point where the drag started
const dots = [];
{
  const g = new THREE.SphereGeometry(0.07, 8, 6), m = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
  for (let i = 0; i < 22; i++) { const d = new THREE.Mesh(g, m); d.visible = false; scene.add(d); dots.push(d); }
}
function pullFromKeys() {
  const a = THREE.MathUtils.degToRad(G.kAng), len = G.kPow * MAX_PULL;
  G.pull = { x: -Math.cos(a) * len, y: -Math.sin(a) * len };
}
function cupPos() {
  const len = Math.hypot(G.pull.x, G.pull.y), k = len > MAX_PULL ? MAX_PULL / len : 1;
  return { x: LAUNCH.x + G.pull.x * k, y: Math.max(0.3, LAUNCH.y + G.pull.y * k) };
}
function updateAim() {
  const showing = G.mode === 'aim';
  const cp = showing ? cupPos() : LAUNCH;
  if (G.cupMesh) G.cupMesh.position.set(cp.x, cp.y, 0);
  const pos = bandGeo.attributes.position;
  pos.setXYZ(0, forkTips[0].x, forkTips[0].y, forkTips[0].z);
  pos.setXYZ(1, showing && G.cupMesh ? cp.x : forkTips[0].x, showing && G.cupMesh ? cp.y : LAUNCH.y + 0.2, 0);
  pos.setXYZ(2, forkTips[1].x, forkTips[1].y, forkTips[1].z);
  pos.needsUpdate = true;
  const v = showing && G.loaded ? Sim.velocity(G.pull.x, G.pull.y) : null;
  const st = G.loaded && STONES[G.loaded];
  const n = v ? Math.round(6 + 14 * Math.min(1, Math.hypot(G.pull.x, G.pull.y) / MAX_PULL)) : 0;
  for (let i = 0; i < dots.length; i++) {
    const d = dots[i]; d.visible = i < n;
    if (!d.visible) continue;
    const tt = (i + 1) * 0.07, gs = st.gravity || 1;
    d.position.set(LAUNCH.x + v.x * st.speed * tt, LAUNCH.y + v.y * st.speed * tt - 5 * gs * tt * tt, 0);
    d.scale.setScalar(1 - i / dots.length * 0.6);
  }
}
function fire() {
  if (G.mode !== 'aim' || !G.loaded) return;
  const v = Sim.velocity(G.pull.x, G.pull.y);
  if (!v) return;
  hint('');
  const body = sim.fire(G.loaded, v.x, v.y);
  scene.remove(G.cupMesh); meshes.set(body, G.cupMesh); G.cupMesh = null;
  sfx.thwack();
  G.lastType = G.loaded; G.loaded = null; G.flightT = 0; G.shotsDone += 1;
  G.pull = { x: 0, y: 0 };
  scene.add(meshes.get(body));
  setMode('flight');
  if (G.lastType === 'split' && G.level <= 2) hint('hintSplit');
}

const canvas = renderer.domElement;
canvas.addEventListener('pointerdown', (e) => {
  sfx.init();
  if (G.mode === 'need') { openCard(); return; }
  if (G.mode === 'aim') {
    const p = toWorld(e.clientX, e.clientY); if (!p) return;
    drag = { x0: p.x, y0: p.y, id: e.pointerId };
    canvas.setPointerCapture(e.pointerId);
    sfx.creak();
    return;
  }
  if (G.mode === 'flight') trySplit();
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag || G.mode !== 'aim') return;
  const p = toWorld(e.clientX, e.clientY); if (!p) return;
  G.pull = { x: Math.min(p.x - drag.x0, 0.4), y: p.y - drag.y0 };
  const len = Math.hypot(G.pull.x, G.pull.y);
  if (len > MAX_PULL) { G.pull.x *= MAX_PULL / len; G.pull.y *= MAX_PULL / len; }
});
canvas.addEventListener('pointerup', () => {
  if (!drag) return;
  drag = null;
  if (G.mode === 'aim') { if (Sim.velocity(G.pull.x, G.pull.y)) fire(); else G.pull = { x: 0, y: 0 }; }
});
canvas.addEventListener('pointercancel', () => { drag = null; });
$('basketBtn').addEventListener('click', () => openCard());

function trySplit() {
  for (const s of sim.stones) {
    if (sim.split(s)) {
      sfx.pop();
      const p = s.getPosition();
      for (const ns of sim.stones) if (!meshes.has(ns)) { const m = stoneMesh('split'); scene.add(m); meshes.set(ns, m); }
      pop(p.x, p.y + 0.5, '✦');
      hint('');
      return;
    }
  }
}

addEventListener('keydown', (e) => {
  if (e.repeat && !/^Arrow/.test(e.key)) return;
  sfx.init();
  if (G.mode === 'card' && /^[1-3]$/.test(e.key)) { answer(+e.key - 1); return; }
  if (G.mode === 'need' && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); openCard(); return; }
  if (G.mode === 'aim') {
    const step = e.shiftKey ? 5 : 1.5;
    if (e.key === 'ArrowLeft') { G.kAng = Math.min(80, G.kAng + step); pullFromKeys(); }
    else if (e.key === 'ArrowRight') { G.kAng = Math.max(-10, G.kAng - step); pullFromKeys(); }
    else if (e.key === 'ArrowUp') { G.kPow = Math.min(1, G.kPow + 0.03); pullFromKeys(); }
    else if (e.key === 'ArrowDown') { G.kPow = Math.max(0.2, G.kPow - 0.03); pullFromKeys(); }
    else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!Sim.velocity(G.pull.x, G.pull.y)) pullFromKeys(); fire(); }
    if (/^Arrow/.test(e.key)) e.preventDefault();
    return;
  }
  if (G.mode === 'flight' && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); trySplit(); }
});

// ---------------------------------------------------------------- simulation events
function handleEvents() {
  for (const e of sim.events) {
    switch (e.type) {
      case 'impact':
        if (e.mat === 'stone' || e.on === 'ground') sfx.stoneHit(Math.min(1, e.imp / 10)); else sfx.woodHit(Math.min(1, e.imp / 8));
        break;
      case 'crack': {
        const m = meshes.get(e.body); if (!m) break;
        const u = e.body.getUserData(), f = Math.max(0.45, u.hp / ({ wood: 9, stone: 40, hay: 5 }[u.mat] || 9));
        m.userData.mat.color.copy(m.userData.base).multiplyScalar(0.55 + 0.45 * f);
        sfx.woodHit(0.6);
        break;
      }
      case 'break': {
        const m = meshes.get(e.body); if (m) { scene.remove(m); meshes.delete(e.body); }
        burst(e.x, e.y, BLOCK_LOOK[e.mat], e.mat === 'stone' ? 10 : 8);
        if (e.mat === 'stone') sfx.crumble(); else sfx.crack();
        score(e.points, e.x, e.y);
        break;
      }
      case 'skel': {
        const m = meshes.get(e.body); if (m) { scene.remove(m); meshes.delete(e.body); }
        burst(e.x, e.y + 0.4, 0xf1ede0, 12, 0.16, 5);
        sfx.oof();
        pop(e.x, e.y + 1.4, t('oof'), 'big');
        score(e.points, e.x, e.y + 0.6);
        break;
      }
      case 'hurt': {
        const m = meshes.get(e.body); if (!m) break;
        m.userData.hurtT = 0.25;
        break;
      }
      case 'boom':
        boomFlash(e.x, e.y, e.r); burst(e.x, e.y, 0x6b3b1a, 14, 0.2, 7); sfx.boom(); pop(e.x, e.y + 1, t('boom'), 'big');
        break;
      default: break;
    }
  }
  sim.events.length = 0;
}
function score(n, x, y) {
  G.points += n; G.castlePoints += n;
  pop(x, y, `+${n}`);
  $('points').textContent = G.points;
}

function syncMeshes() {
  for (const [b, m] of meshes) {
    const u = b.getUserData();
    if (u.kind === 'stone' && !sim.stones.includes(b)) { scene.remove(m); meshes.delete(b); continue; }
    const p = b.getPosition();
    m.position.set(p.x, p.y, 0);
    m.rotation.z = b.getAngle();
    if (m.userData.hurtT > 0) {
      m.userData.hurtT -= 1 / 60;
      for (const mm of m.userData.mats || []) mm.color.setHex(m.userData.hurtT > 0 ? 0xff9a9a : 0xf1ede0);
    }
  }
}

// ---------------------------------------------------------------- shot end, castle end
function endShot() {
  for (const s of [...sim.stones]) { sim.dead.add(s); }
  sim.step(); handleEvents(); syncMeshes();
  if (sim.standing() === 0) { castleWon(); return; }
  if (G.stonesLeft > 0) { setMode('need'); return; }
  if (!G.extraUsed) {
    G.extraUsed = true; G.stonesLeft = 1; updateHud();
    toast(t('extra'), 1600); setMode('need');
    return;
  }
  castleOver(false);
}

function starsFor(points, cleared) {
  if (!cleared) return 0;
  if (G.extraUsed) return 1;
  const th = G.data.castles[G.castle].stars || [0, 0, 0];
  return Math.max(1, th.filter((x) => points >= x).length);
}

function castleWon() {
  // Stones left over are worth a lot.
  const bonus = G.stonesLeft * 1500;
  if (bonus) { G.points += bonus; G.castlePoints += bonus; }
  sfx.cheer();
  castleOver(true, bonus);
}

function castleOver(cleared, bonus = 0) {
  setMode('between');
  const stars = starsFor(G.castlePoints, cleared);
  G.castleLog.push({ stars, points: G.castlePoints, cleared });
  gameEvent('castle_end', { level: G.level, castle: G.castle + 1, stones: G.data.castles[G.castle].stones,
    shots_used: G.shotsDone, extra_stone: G.extraUsed, stars, points: G.castlePoints,
    answers: G.castleAnswers, correct: G.castleCorrect });
  $('points').textContent = G.points;
  const st = '★'.repeat(stars) + '<span style="color:#2b4370">' + '★'.repeat(3 - stars) + '</span>';
  toast(`${cleared ? t('castleWon') : t('castleDone')}<br><span style="color:var(--amber);letter-spacing:4px">${st}</span>${bonus ? ` <small style="font-size:18px;color:var(--muted)">+${bonus}</small>` : ''}`, 2300);
  setTimeout(() => {
    G.castle += 1;
    if (G.castle >= G.data.castles.length) results();
    else buildCastle();
  }, 2600);
}

function results() {
  setMode('results');
  hint('');
  const stars = Math.round(G.castleLog.reduce((a, c) => a + c.stars, 0) / G.castleLog.length);
  const best = store.get(STARS_KEY, {});
  best[G.level] = Math.max(best[G.level] || 0, stars); store.set(STARS_KEY, best);
  gameEvent('level_end', { level: G.level, result: 'won', stars, seconds: Math.round((performance.now() - G.startedAt) / 1000),
    answers: G.answers, correct: G.correct, points: G.points, specials_earned: G.specials });
  $('resTitle').textContent = t('done');
  $('stars').innerHTML = '★'.repeat(stars) + '<i>' + '★'.repeat(3 - stars) + '</i>';
  $('resPoints').textContent = t('points', G.points);
  $('castleRows').innerHTML = G.castleLog.map((c, i) => `<div><span>${t('castle', i + 1, G.castleLog.length)}</span><b>${'★'.repeat(c.stars)}${'☆'.repeat(3 - c.stars)}</b></div>`).join('');
  $('resRight').textContent = t('firstTry', G.correct, G.answers);
  $('missed').innerHTML = G.missed.size ? `<div style="color:var(--muted);font-family:Nunito;font-size:16px">${t('practise')}</div>`
    + [...G.missed].map((b) => { const p = G.pairs.find((x) => x.base === b); return p ? `<span class="base">${p.base}</span><span class="arrow">→</span><span class="past">${p.past}</span><span class="arrow">→</span><span class="pp">${p.pp}</span>` : b; }).join('<br>')
    : t('perfect');
  $('resNext').textContent = t('next'); $('resNext').style.display = G.level < BUILT ? '' : 'none';
  $('resAgain').textContent = t('again'); $('resMenu').textContent = t('menu');
  $('results').classList.add('on');
  $('hud').classList.remove('on');
}
$('resNext').onclick = () => { $('results').classList.remove('on'); startLevel(G.level + 1); };
$('resAgain').onclick = () => { $('results').classList.remove('on'); startLevel(G.level); };
$('resMenu').onclick = () => { $('results').classList.remove('on'); showMenu(); };

// ---------------------------------------------------------------- level start + menu
async function startLevel(n) {
  sfx.init();
  G.level = n;
  G.data = await (await fetch(`levels/level${n}.json`)).json();
  G.pairs = await loadPairs({ count: 40, tiers: n <= 2 ? [1] : n <= 4 ? [1, 2] : undefined });
  Object.assign(G, { castle: Math.max(0, (+QS.get('castle') || 1) - 1), points: 0, shots: 0, pairIx: 0, retry: [], answers: 0, correct: 0,
    missed: new Set(), castleLog: [], specials: 0, startedAt: performance.now() });
  $('menu').classList.remove('on');
  $('hud').classList.add('on');
  gameEvent('level_start', { level: n });
  buildCastle();
}

function showMenu() {
  setMode('menu');
  clearScene();
  hint('');
  const best = store.get(STARS_KEY, {});
  $('tagline').textContent = t('tagline');
  const lv = $('levels'); lv.innerHTML = '';
  for (let i = 1; i <= LEVELS; i++) {
    const b = document.createElement('button'); b.className = 'lvl';
    const s = best[i] || 0;
    b.innerHTML = `<b>${t('level', i)}</b><span>${i <= BUILT ? '★'.repeat(s) + '<i>' + '★'.repeat(3 - s) + '</i>' : t('soon')}</span>`;
    b.disabled = i > BUILT;
    b.onclick = () => startLevel(i);
    lv.appendChild(b);
  }
  $('howto').innerHTML = isTouch
    ? `<div>${t('howCard')}</div><div>${t('howAnswer')}</div><div>${t('howAim')}</div>`
    : `<div><kbd>Space</kbd>${t('howCard')}</div><div><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd>${t('howAnswer')}</div><div>${t('howAim')}</div>`;
  $('menu').classList.add('on');
  // a fort in the background of the menu
  fetch('levels/level1.json').then((r) => r.json()).then((d) => {
    if (G.mode !== 'menu') return;
    sim.build(d.castles[2]);
    for (const b of [...sim.blocks, ...sim.skels]) { const u = b.getUserData(); const m = u.kind === 'skel' ? skelMesh() : blockMesh(u); scene.add(m); meshes.set(b, m); }
    syncMeshes();
  }).catch(() => {});
}

$('mute').onclick = () => { sfx.init(); sfx.setMuted(!sfx.muted); $('mute').textContent = `${sfx.muted ? '🔇' : '🔊'} ${t('sound')}`; };
$('mute').textContent = `${sfx.muted ? '🔇' : '🔊'} ${t('sound')}`;
$('basketBtn').textContent = t('basket');

// ---------------------------------------------------------------- main loop
let last = performance.now(), acc = 0, fpsN = 0, fpsT = 0, fps = 0, stepMs = 0;
const perfOn = QA.includes('perf');
if (perfOn) $('perf').style.display = 'block';
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  const running = G.mode === 'need' || G.mode === 'aim' || G.mode === 'flight' || G.mode === 'between' || G.mode === 'card';
  if (running && G.mode !== 'card') {
    acc += dt;
    let n = 0; const t0 = performance.now();
    while (acc >= STEP && n < 4) { sim.step(); handleEvents(); acc -= STEP; n++; }
    if (n === 4) acc = 0;
    stepMs = stepMs * 0.9 + (performance.now() - t0) * 0.1;
    syncMeshes();
  }
  if (G.mode === 'flight') {
    G.flightT += dt;
    if ((G.flightT > 1.2 && sim.settled()) || G.flightT > 8) endShot();
  }
  if (G.mode === 'need') {
    const s = toScreen(BASKET.x, BASKET.y + 1.5, 0.3);
    const btn = $('basketBtn'), hw = btn.offsetWidth / 2 + 10;
    btn.style.left = `${Math.max(hw, Math.min(innerWidth - hw, s.x))}px`; btn.style.top = `${Math.max(90, s.y)}px`;
  }
  updateAim();
  stepParts(dt);
  renderer.render(scene, camera);
  if (perfOn) {
    fpsN++; fpsT += dt;
    if (fpsT > 0.5) { fps = fpsN / fpsT; fpsN = 0; fpsT = 0; $('perf').textContent = `${fps.toFixed(0)} fps · ${sim.bodyCount()} bodies · step ${stepMs.toFixed(2)} ms · q:${qSource}`; }
  }
}

// ---------------------------------------------------------------- QA hooks
window.__VC = {
  G, sim,
  info: () => ({ mode: G.mode, level: G.level, castle: G.castle, stones: G.stonesLeft, loaded: G.loaded,
    standing: sim.standing(), bodies: sim.bodyCount(), points: G.points, answers: G.answers, correct: G.correct, q: qSource }),
  start: (n = 1) => startLevel(n),
  card: () => openCard(),
  answer: (right = true) => { const q = card.pair.steps[card.step]; const i = q.options.findIndex((o) => (o === q.answer) === right); answer(i); },
  shoot: (deg = 35, pow = 0.8) => { G.kAng = deg; G.kPow = pow; pullFromKeys(); fire(); },
  aim: (deg = 35, pow = 0.8) => { G.kAng = deg; G.kPow = pow; pullFromKeys(); },
};

$('loading').remove();
showMenu();
requestAnimationFrame(frame);
