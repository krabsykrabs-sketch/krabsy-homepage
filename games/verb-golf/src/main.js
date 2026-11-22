// Verb Golf: game loop, rules, input and interface. See CLAUDE.md ("Rules as built").
import * as THREE from 'three';
import { Assets } from './assets.js';
import { buildCourse, blockOpening, BALL_R, CUP_R, GATE_OPEN } from './course.js';
import { step, DT, MAX_SPEED } from './physics.js';
import { LEVELS } from './holes.js';
import { loadPairs, again, source, tierInfo } from './questions.js';
import { t, setTouch, touchMode } from './i18n.js';
import { sfx } from './audio.js';
import { Track, log as trackLog } from './track.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const QA = params.get('qa');
const STARS_KEY = 'krabsy_vgolf_stars';
const MAX_OVER = 4;            // after par + 4 strokes the ball is put in the hole
const PITCH = 54 * Math.PI / 180;
const ALL_LEVELS = 6;          // shown in the menu; the ones without data say "soon"

// ---------------------------------------------------------------- renderer, scene
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = skyTexture();
const camera = new THREE.PerspectiveCamera(34, 1, 0.5, 400);

const hemi = new THREE.HemisphereLight('#e4f0ff', '#8d7a68', 1.5);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff3df', 2.1);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.bias = -0.0008;
sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);

function skyTexture() {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#4d97e8'); gr.addColorStop(0.55, '#9fcdf6'); gr.addColorStop(1, '#e4f2ff');
  g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------------------------------------------------------------- state
const G = {
  mode: 'loading',   // menu | idle | card | aim | roll | rewind | sink | between | end
  level: null, levelIdx: 0, holeIdx: 0, course: null, holeGroup: null,
  ball: { x: 0, z: 0, vx: 0, vz: 0 }, lastPos: null,
  strokes: 0, shots: 0, penalties: 0, scores: [],
  aim: { angle: 0, power: 0, dragging: false, charging: false, chargeT: 0, rot: 0, touched: false },
  pool: [], pi: 0, comeBack: [], cardPair: null, cardStep: 0, gatePair: null,
  cardQ: null, asked: 0, answers: 0, correct: 0, firstTry: 0, missed: new Map(),
  askLog: [], rollT: 0, t0: 0, gaveUp: false, yaw: 0,
};
window.__VG = { G, get camera() { return camera; }, get scene() { return scene; } };

// ---------------------------------------------------------------- dynamic meshes
let ballMesh, flagMesh, cupGroup, arrow, clouds;
const tweens = [];
function tween(dur, fn, done) { tweens.push({ t: 0, dur, fn, done }); }

function buildDynamic() {
  ballMesh = Assets.mesh('ball');
  ballMesh.scale.setScalar(BALL_R);
  scene.add(ballMesh);

  cupGroup = new THREE.Group();
  const hole = new THREE.Mesh(new THREE.CircleGeometry(CUP_R, 28).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: '#13213a' }));
  hole.position.y = 0.012;
  const rim = new THREE.Mesh(new THREE.RingGeometry(CUP_R, CUP_R + 0.07, 28).rotateX(-Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: '#f4f1e6' }));
  rim.position.y = 0.014;
  hole.receiveShadow = rim.receiveShadow = true;
  cupGroup.add(hole, rim);
  scene.add(cupGroup);

  flagMesh = Assets.mesh('flag_A');
  flagMesh.scale.setScalar(0.95);
  scene.add(flagMesh);

  // aim arrow: shaft + head, flat on the green, built along +x
  arrow = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: '#2ee6c0', transparent: true, opacity: 0.92, depthWrite: false });
  const shaft = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.2).rotateX(-Math.PI / 2).translate(0.5, 0, 0), mat);
  const shape = new THREE.Shape([new THREE.Vector2(0, 0.34), new THREE.Vector2(0.5, 0), new THREE.Vector2(0, -0.34)]);
  const head = new THREE.Mesh(new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2), mat);
  const ring = new THREE.Mesh(new THREE.RingGeometry(BALL_R + 0.1, BALL_R + 0.17, 28).rotateX(-Math.PI / 2), mat);
  arrow.add(shaft, head, ring);
  arrow.userData = { shaft, head, ring, mat };
  arrow.renderOrder = 4;
  arrow.visible = false;
  scene.add(arrow);

  // clouds below and around the island (one merged mesh, turning slowly)
  const items = [];
  const rnd = mulberry(7);
  for (let i = 0; i < 18; i++) {
    const a = rnd() * Math.PI * 2, r = 16 + rnd() * 30, s = 1.8 + rnd() * 2.6;
    const m = new THREE.Matrix4().compose(new THREE.Vector3(Math.cos(a) * r, -5 - rnd() * 7, Math.sin(a) * r),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 6), new THREE.Vector3(s, s * 0.8, s));
    items.push({ name: rnd() < 0.5 ? 'cloud_big' : 'cloud_small', m });
  }
  clouds = Assets.merge(items, 'scenery');
  clouds.castShadow = false;
  scene.add(clouds);
}

function mulberry(a) {
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
}

// ---------------------------------------------------------------- camera
function fitCamera() {
  const course = G.course; if (!course) return;
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  const box = course.box;
  const corners = [];
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) corners.push(new THREE.Vector3(x, y, z));
  // allowed screen area (NDC) after the HUD on top and the sign line at the bottom
  const top = 1 - 2 * 64 / h, bot = -1 + 2 * (G.course.gates.length ? 100 : 40) / h, side = 1 - 2 * 14 / w;
  const tryYaw = (yaw) => {
    const off = new THREE.Vector3(Math.sin(yaw) * Math.cos(PITCH), Math.sin(PITCH), Math.cos(yaw) * Math.cos(PITCH));
    const target = box.getCenter(new THREE.Vector3());
    let d = 40;
    const right = new THREE.Vector3(), up = new THREE.Vector3();
    for (let it = 0; it < 8; it++) {
      camera.position.copy(target).addScaledVector(off, d);
      camera.lookAt(target); camera.updateMatrixWorld();
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const c of corners) {
        const p = c.clone().project(camera);
        x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
      }
      right.setFromMatrixColumn(camera.matrixWorld, 0); up.setFromMatrixColumn(camera.matrixWorld, 1);
      const k = Math.max((x1 - x0) / (2 * side), (y1 - y0) / (top - bot));
      // shift the target so the box sits in the middle of the allowed area
      const half = d * Math.tan(camera.fov * Math.PI / 360);
      const sx = ((x0 + x1) / 2) * half * camera.aspect, sy = ((y0 + y1) / 2 - (top + bot) / 2) * half;
      target.addScaledVector(right, sx).addScaledVector(up, sy);
      d *= k;
    }
    return { yaw, d, target, off };
  };
  const a = tryYaw(0), b = tryYaw(Math.PI / 2);
  const best = b.d < a.d * 0.75 ? b : a; // turn the hole sideways only when it is much bigger then
  G.yaw = best.yaw;
  camera.position.copy(best.target).addScaledVector(best.off, best.d);
  camera.lookAt(best.target); camera.updateMatrixWorld();
  // the shadow camera covers the hole
  const c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
  const r = Math.max(size.x, size.z) * 0.62 + 2;
  sun.position.set(c.x - 8, c.y + 22, c.z + 10); sun.target.position.copy(c);
  Object.assign(sun.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 1, far: 60 });
  sun.shadow.camera.updateProjectionMatrix();
}
window.addEventListener('resize', () => { fitCamera(); });

// ---------------------------------------------------------------- questions
function nextPair() {
  const i = G.comeBack.findIndex((c) => c.due <= G.asked);
  if (i >= 0) return G.comeBack.splice(i, 1)[0].pair;
  const p = G.pool[G.pi % G.pool.length]; G.pi += 1;
  return again(p);
}
// after both steps of a pair: a missed verb comes back a few questions later
function pairDone(pair) {
  if (pair.missed) G.comeBack.push({ pair: again(pair), due: G.asked + 3 });
}
function markMissed(q, pair) {
  pair.missed = true;
  G.missed.set(q.base, q);
}
function record(q, correct) {
  if (q.answered) return;
  q.answered = true;
  G.answers += 1;
  if (correct) { G.correct += 1; G.firstTry += 1; }
  Track.answer(q, correct);
}

const blank = (cls, text = '') => `<span class="blank ${cls}">${text || '&nbsp;'}</span>`;
function chainHTML(q, { fill = false } = {}) {
  const arrowS = '<span class="arrow">→</span>';
  const base = `<span class="base">${q.base}</span>`;
  if (q.ask === 'past') {
    const b1 = fill ? `<span class="past filled">${q.past}</span>` : blank('ask past', '?');
    return base + arrowS + b1 + arrowS + blank('');
  }
  const b2 = fill ? `<span class="pp filled">${q.pp}</span>` : blank('ask pp', '?');
  return base + arrowS + `<span class="past">${q.past}</span>` + arrowS + b2;
}
// teach line after a wrong answer: the chain as far as it may be shown
function teachHTML(q) {
  const a = '<span class="arrow">→</span>';
  const tail = q.ask === 'past' ? '___' : `<span class="pp">${q.pp}</span>`;
  return `${t('notQuite')} <span class="base">${q.base}</span>${a}<span class="past">${q.past}</span>${a}${tail}`;
}

// ---------------------------------------------------------------- the card (one per stroke)
function openStroke() {
  if (G.mode !== 'idle') return;
  sfx.init();
  let q;
  if (G.cardPair && G.cardStep === 1) q = G.cardPair.steps[1];
  else { G.cardPair = nextPair(); G.cardStep = 0; q = G.cardPair.steps[0]; }
  q.tried = new Set();
  G.cardQ = q; G.asked += 1;
  G.askLog.push(`card:${q.base}:${q.ask}`);
  G.mode = 'card';
  $('askCard').className = q.ask === 'past' ? 'past' : 'pp';
  $('askTitle').textContent = t('cardTitle');
  $('chain').innerHTML = chainHTML(q);
  $('teach').innerHTML = '';
  const chips = $('chips'); chips.innerHTML = '';
  q.options.forEach((w, i) => {
    const b = document.createElement('button');
    b.className = 'chip'; b.innerHTML = `<small>${i + 1}</small>${w}`;
    tap(b, () => answerCard(i));
    chips.appendChild(b);
  });
  $('ask').classList.add('on'); document.body.classList.add('carding');
  showPrompt(false); hint('');
  sfx.cardOpen();
}

function answerCard(i) {
  const q = G.cardQ;
  if (G.mode !== 'card' || !q || q.tried.has(i) || q.done) return;
  const chip = $('chips').children[i];
  if (q.options[i] === q.answer) {
    q.done = true;
    record(q, true);
    chip.classList.add('right');
    $('chain').innerHTML = chainHTML(q, { fill: true });
    sfx.right();
    setTimeout(() => {
      $('ask').classList.remove('on'); document.body.classList.remove('carding');
      if (G.cardStep === 0) G.cardStep = 1; else { pairDone(G.cardPair); G.cardPair = null; G.cardStep = 0; }
      startAim();
    }, QA ? 50 : 650);
  } else {
    q.tried.add(i);
    record(q, false);
    markMissed(q, G.cardPair);
    chip.classList.add('wrong');
    $('teach').innerHTML = `${teachHTML(q)}<span class="pen">${t('penalty')}</span>`;
    sfx.wrong();
    addPenalty();
  }
}

// ---------------------------------------------------------------- gates
function activeRow() {
  const row = G.course.gates.find((r) => !r.solved);
  if (!row) return null;
  const c = row.line.axis === 'z' ? G.ball.z : G.ball.x;
  return (c - row.line.at) * row.sign > 0 ? row : null;
}
function gateQ(row) { return G.gatePair.steps[row.step]; }

function dealRow(row) {
  const q = gateQ(row);
  row.openings.forEach((o, i) => o.plate.set('open', q.options[i]));
  if (!row.logged) { row.logged = true; G.asked += 1; G.askLog.push(`gate:${q.base}:${q.ask}`); }
}
function showSign(q) {
  if (!q) { $('sign').classList.remove('on'); return; }
  $('signChain').innerHTML = chainHTML(q);
  $('signHow').textContent = t('gateHow');
  $('sign').classList.add('on');
}

function judgeGate(row, i) {
  const q = gateQ(row), o = row.openings[i];
  if (o.plate.word === q.answer) {
    record(q, true);
    o.plate.set('right');
    row.openings.forEach((p, k) => { if (k !== i) { if (p.plate.state !== 'wrong') p.plate.set('off'); blockOpening(G.course, p); } });
    row.solved = true;
    sfx.right(); sfx.sparkle();
    popAt(o.cx, o.y + 2.8, o.cz, t('rightGate'), true);
    const next = G.course.gates.find((r) => !r.solved);
    if (next) { dealRow(next); showSign(gateQ(next)); $('signChain').innerHTML = chainHTML(gateQ(next)); }
    else { pairDone(G.gatePair); showSign(null); }
    return true;
  }
  record(q, false);
  markMissed(q, G.gatePair);
  o.plate.set('wrong');
  blockOpening(G.course, o);
  sfx.wrong(); sfx.boing();
  popAt(o.cx, o.y + 2.8, o.cz, t('wrongGate'));
  addPenalty();
  rewind();
  return false;
}

// back to where the ball was shot from (wrong gate, out of bounds)
function rewind() {
  G.mode = 'rewind';
  const from = { x: G.ball.x, z: G.ball.z }, to = G.lastPos;
  G.ball.vx = G.ball.vz = 0;
  tween(0.55, (k) => {
    const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
    G.ball.x = from.x + (to.x - from.x) * e; G.ball.z = from.z + (to.z - from.z) * e;
    G.ball.hop = Math.sin(k * Math.PI) * 1.2;
  }, () => { G.ball.hop = 0; afterStop(); });
}

// ---------------------------------------------------------------- strokes
function addPenalty() {
  G.penalties += 1; G.strokes += 1;
  updateHud(true);
}

function afterStop() {
  if (G.mode === 'between' || G.mode === 'sink') return;
  const par = G.level.holes[G.holeIdx].par;
  if (G.strokes >= par + MAX_OVER) { giveUp(); return; }
  // A gate stroke needs no card, unless a card verb still waits for its 3rd form: that
  // comes first (chain order), then the stroke goes through the gates as usual.
  const row = activeRow();
  if (row && !(G.cardPair && G.cardStep === 1)) { startAim(); return; }
  showSign(null);
  G.mode = 'idle';
  hint('');
  showPrompt(true);
}

function startAim() {
  G.mode = 'aim';
  const row = activeRow();
  if (row) { dealRow(row); showSign(gateQ(row)); }
  const a = G.aim;
  a.power = 0; a.dragging = false; a.charging = false;
  if (!a.touched) a.angle = Math.atan2(G.course.cup.z - G.ball.z, G.course.cup.x - G.ball.x);
  hint(t('aimHint'));
  arrow.visible = true;
}

function shoot() {
  const a = G.aim;
  const p = a.power;
  a.dragging = false; a.charging = false;
  if (p < 0.04) { a.power = 0; return; }
  const v = MAX_SPEED * (0.55 * p + 0.45 * p * p) + 0.6;
  G.lastPos = { x: G.ball.x, z: G.ball.z };
  G.lastShot = { deg: Math.round(a.angle * 180 / Math.PI), power: +p.toFixed(2) };
  G.ball.vx = Math.cos(a.angle) * v; G.ball.vz = Math.sin(a.angle) * v;
  G.shots += 1; G.strokes += 1;
  G.mode = 'roll'; G.rollT = 0; G.acc = 0;
  arrow.visible = false;
  a.power = 0;
  hint('');
  sfx.putt(p);
  updateHud(true);
}

function sink() {
  G.mode = 'sink';
  const from = { x: G.ball.x, z: G.ball.z };
  sfx.cup();
  tween(0.4, (k) => {
    G.ball.x = from.x + (G.course.cup.x - from.x) * Math.min(1, k * 2);
    G.ball.z = from.z + (G.course.cup.z - from.z) * Math.min(1, k * 2);
    G.ball.sinkY = -k * 0.45;
  }, holeDone);
  const f0 = flagMesh.position.y;
  tween(0.6, (k) => { flagMesh.position.y = f0 + Math.sin(k * Math.PI / 2) * 1.0; });
}

function giveUp() {
  G.gaveUp = true; G.mode = 'sink';
  showSign(null); hint('');
  toast(t('goOn'));
  const from = { x: G.ball.x, z: G.ball.z };
  sfx.whoosh();
  tween(0.8, (k) => {
    G.ball.x = from.x + (G.course.cup.x - from.x) * k; G.ball.z = from.z + (G.course.cup.z - from.z) * k;
    G.ball.hop = Math.sin(k * Math.PI) * 2.2;
  }, () => { G.ball.hop = 0; G.mode = 'roll'; sink(); });
}

function holeDone() {
  G.mode = 'between';
  const hole = G.level.holes[G.holeIdx];
  const sc = { par: hole.par, strokes: G.strokes, shots: G.shots, penalties: G.penalties, gaveUp: G.gaveUp };
  G.scores.push(sc);
  Track.holeEnd({ level: G.level.id, hole: G.holeIdx + 1, strokes: G.strokes, par: hole.par,
    shots: G.shots, penalties: G.penalties, gave_up: G.gaveUp });
  if (!G.gaveUp) {
    const msg = G.strokes === 1 ? t('holeInOne') : G.strokes < hole.par ? t('underPar') : G.strokes === hole.par ? t('atPar') : t('overPar');
    toast(msg, G.strokes <= hole.par);
    if (G.strokes <= hole.par) sfx.cheer(); else sfx.sparkle();
    burst(G.course.cup.x, G.course.cup.y + 0.3, G.course.cup.z);
  }
  setTimeout(() => {
    if (G.holeIdx + 1 < G.level.holes.length) fadeTo(() => startHole(G.holeIdx + 1));
    else levelEnd();
  }, QA ? 100 : 1900);
}

// ---------------------------------------------------------------- holes and levels
function startHole(idx) {
  G.holeIdx = idx;
  const def = G.level.holes[idx];
  if (G.holeGroup) { scene.remove(G.holeGroup); disposeGroup(G.holeGroup); }
  G.course = buildCourse(def, G.level.id * 10 + idx);
  G.holeGroup = G.course.group;
  scene.add(G.holeGroup);
  Object.assign(G.ball, { x: G.course.tee.x, z: G.course.tee.z, vx: 0, vz: 0, hop: 0, sinkY: 0 });
  G.lastPos = { x: G.ball.x, z: G.ball.z };
  G.strokes = 0; G.shots = 0; G.penalties = 0; G.gaveUp = false;
  G.aim.touched = false;
  const cup = G.course.cup;
  cupGroup.position.set(cup.x, cup.y, cup.z);
  flagMesh.position.set(cup.x, cup.y, cup.z);
  G.gatePair = G.course.gates.length ? nextPair() : null;
  for (const row of G.course.gates) row.openings.forEach((o) => o.plate.set('wait'));
  fitCamera();
  updateHud();
  $('hud').classList.add('on');
  G.mode = 'start';
  afterStop();
  if (idx === 0 && G.levelIdx === 0 && G.mode === 'idle') hint(t('ready'));
}

function disposeGroup(g) {
  g.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.isSprite) { o.material.map.dispose(); o.material.dispose(); }
  });
}

async function startLevel(idx) {
  sfx.init();
  G.levelIdx = idx; G.level = LEVELS[idx];
  $('menu').classList.remove('on'); $('end').classList.remove('on');
  $('loading').style.display = 'flex'; $('loading').textContent = t('loading');
  G.pool = await loadPairs({ count: 16, tiers: G.level.tiers });
  G.pi = 0; G.comeBack = []; G.cardPair = null; G.cardStep = 0;
  G.asked = 0; G.answers = 0; G.correct = 0; G.firstTry = 0; G.missed = new Map(); G.askLog = [];
  G.scores = []; G.t0 = performance.now();
  trackLog.length = 0;
  $('loading').style.display = 'none';
  Track.levelStart(G.level.id);
  startHole(0);
}

function levelEnd() {
  G.mode = 'end';
  showPrompt(false); showSign(null); hint('');
  const par = G.scores.reduce((s, h) => s + h.par, 0), strokes = G.scores.reduce((s, h) => s + h.strokes, 0);
  const stars = strokes <= par ? 3 : strokes <= par + 3 ? 2 : 1;
  const saved = loadStars();
  if ((saved[G.level.id] || 0) < stars) { saved[G.level.id] = stars; saveStars(saved); }
  Track.levelEnd({ level: G.level.id, stars, seconds: Math.round((performance.now() - G.t0) / 1000),
    answers: G.answers, correct: G.correct, strokes, par });
  sfx.fanfare();
  $('endTitle').textContent = t('done');
  $('stars').innerHTML = [1, 2, 3].map((i) => (i <= stars ? '★' : '<i>★</i>')).join('');
  $('endLine').textContent = t('total', strokes, par);
  const cell = (h) => `<td class="${h.strokes < h.par ? 'under' : h.strokes > h.par ? 'over' : ''}">${h.strokes}</td>`;
  $('score').innerHTML = `<tr><th></th>${G.scores.map((_, i) => `<th>${i + 1}</th>`).join('')}<th>Σ</th></tr>`
    + `<tr><th>Par</th>${G.scores.map((h) => `<td>${h.par}</td>`).join('')}<td>${par}</td></tr>`
    + `<tr><th>⛳</th>${G.scores.map(cell).join('')}<td>${strokes}</td></tr>`;
  $('endFirst').textContent = t('firstTry', G.firstTry, G.answers);
  const missed = [...G.missed.values()];
  $('missed').innerHTML = missed.length
    ? `<p>${t('practise')}</p>` + missed.map((q) => `<div><span class="base">${q.base}</span><span class="arrow">→</span><span class="past">${q.past}</span><span class="arrow">→</span><span class="pp">${q.pp}</span></div>`).join('')
    : `<p>${t('perfect')}</p>`;
  const hasNext = G.levelIdx + 1 < LEVELS.length;
  $('btnNext').style.display = hasNext ? '' : 'none';
  $('btnNext').textContent = t('next'); $('btnAgain').textContent = t('again'); $('btnMenu').textContent = t('menu');
  $('end').classList.add('on');
  $('hud').classList.remove('on');
  if (QA) qaDone();
}

function loadStars() { try { return JSON.parse(localStorage.getItem(STARS_KEY)) || {}; } catch (_) { return {}; } }
function saveStars(s) { try { localStorage.setItem(STARS_KEY, JSON.stringify(s)); } catch (_) { /* private mode */ } }

// ---------------------------------------------------------------- interface helpers
function updateHud(bump) {
  const hole = G.level.holes[G.holeIdx];
  $('holeLabel').textContent = t('hole', G.holeIdx + 1, G.level.holes.length);
  $('parLabel').textContent = t('par', hole.par);
  $('strokes').textContent = t('strokes', G.strokes);
  if (bump) { const s = $('strokes'); s.classList.remove('bump'); void s.offsetWidth; s.classList.add('bump'); }
  $('mute').textContent = (sfx.muted ? '🔇 ' : '🔊 ') + t('sound');
}
let hintText = '';
function hint(text) {
  if (text === hintText) return;
  hintText = text;
  const h = $('hint');
  if (!text) { h.classList.remove('on'); return; }
  h.textContent = text; h.classList.add('on');
}
let promptOn = false;
function showPrompt(on) {
  promptOn = on;
  $('prompt').textContent = '⛳ ' + t('ready');
  $('prompt').classList.toggle('on', on);
}
let toastTimer = 0;
function toast(text, big = false) {
  const el = $('toast');
  el.textContent = text; el.classList.toggle('big', big); el.classList.add('on');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('on'), 1500);
}
function screenOf(x, y, z) {
  const p = new THREE.Vector3(x, y, z).project(camera);
  return { x: (p.x + 1) / 2 * window.innerWidth, y: (1 - p.y) / 2 * window.innerHeight };
}
function popAt(x, y, z, text, good = false) {
  const s = screenOf(x, y, z);
  const el = document.createElement('div');
  el.className = 'pop' + (good ? ' good' : ''); el.textContent = text;
  el.style.left = `${s.x}px`; el.style.top = `${s.y}px`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}
function fadeTo(fn) {
  const f = $('fade');
  f.classList.add('on');
  setTimeout(() => { fn(); setTimeout(() => f.classList.remove('on'), 60); }, QA ? 20 : 380);
}

// confetti stars when the ball drops
const bursts = [];
function burst(x, y, z) {
  for (let i = 0; i < 10; i++) {
    const m = Assets.mesh('star');
    m.scale.setScalar(0.22); m.castShadow = false;
    m.position.set(x, y, z);
    const a = (i / 10) * Math.PI * 2;
    m.userData.v = new THREE.Vector3(Math.cos(a) * 2.2, 5 + Math.random() * 2, Math.sin(a) * 2.2);
    m.userData.life = 1.2;
    scene.add(m); bursts.push(m);
  }
}

// buttons: pointerup for touch, click for the mouse (no ghost clicks)
function tap(el, fn) {
  let touchT = 0;
  el.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') { touchT = performance.now(); e.preventDefault(); fn(e); } });
  el.addEventListener('click', (e) => { if (performance.now() - touchT < 600) return; fn(e); });
}

// ---------------------------------------------------------------- menu
function buildMenu() {
  $('tagline').textContent = t('tagline');
  const saved = loadStars();
  const box = $('levels'); box.innerHTML = '';
  for (let i = 0; i < ALL_LEVELS; i++) {
    const L = LEVELS[i];
    const b = document.createElement('button');
    b.className = 'lvl';
    const open = L && (i === 0 || params.has('unlock') || (saved[LEVELS[i - 1].id] || 0) > 0);
    const st = L ? saved[L.id] || 0 : 0;
    b.innerHTML = `<b>${t('level', i + 1)}</b>` + (L ? `<span>${[1, 2, 3].map((k) => (k <= st ? '★' : '<i>★</i>')).join('')}</span>` : `<em>${t('soon')}</em>`);
    if (!open) b.disabled = true;
    else tap(b, () => { sfx.init(); sfx.uiClick(); startLevel(i); });
    box.appendChild(b);
  }
  $('howto').innerHTML = touchMode
    ? `<div>👆 ${t('howAnswer')}</div><div>↩ ${t('howAim')}</div><div>${t('howShoot')}</div>`
    : `<div><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd>${t('howAnswer')}</div><div><kbd>←</kbd><kbd>→</kbd>${t('howAim')}</div><div><kbd>Space</kbd>${t('howShoot')}</div>`;
}
function showMenu() {
  G.mode = 'menu';
  $('end').classList.remove('on'); $('hud').classList.remove('on');
  showPrompt(false); showSign(null); hint('');
  buildMenu();
  $('menu').classList.add('on');
}
tap($('btnNext'), () => { sfx.uiClick(); startLevel(G.levelIdx + 1); });
tap($('btnAgain'), () => { sfx.uiClick(); startLevel(G.levelIdx); });
tap($('btnMenu'), () => { sfx.uiClick(); showMenu(); });
tap($('mute'), () => { sfx.init(); sfx.setMuted(!sfx.muted); updateHud(); });

function setTouchMode(on) {
  if (on === touchMode) return;
  setTouch(on);
  document.documentElement.classList.toggle('touch', on);
  if (G.mode === 'menu') buildMenu();
  if (G.mode === 'aim') hint(t('aimHint'));
  if (promptOn) showPrompt(true);
}
if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) setTouchMode(true);

// ---------------------------------------------------------------- input: aiming
const ray = new THREE.Raycaster();
const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
function groundPoint(cx, cy) {
  const ndc = new THREE.Vector2(cx / window.innerWidth * 2 - 1, -(cy / window.innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  plane.constant = -(G.course.heightAt(G.ball.x, G.ball.z) + BALL_R);
  const p = new THREE.Vector3();
  return ray.ray.intersectPlane(plane, p) ? p : null;
}
canvas.addEventListener('pointerdown', (e) => {
  sfx.init();
  if (e.pointerType === 'touch' || e.pointerType === 'pen') setTouchMode(true);
  if (G.mode === 'idle') { openStroke(); return; }
  if (G.mode !== 'aim') return;
  const a = G.aim;
  a.dragging = true; a.charging = false;
  a.sx = e.clientX; a.sy = e.clientY; a.start = groundPoint(e.clientX, e.clientY);
  try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
});
canvas.addEventListener('pointermove', (e) => {
  const a = G.aim;
  if (!a.dragging || G.mode !== 'aim') return;
  const px = Math.hypot(e.clientX - a.sx, e.clientY - a.sy);
  const p = groundPoint(e.clientX, e.clientY);
  if (px > 6 && p && a.start) {
    a.angle = Math.atan2(a.start.z - p.z, a.start.x - p.x);
    a.touched = true;
  }
  a.power = Math.min(1, Math.max(0, (px - 6) / (0.3 * Math.min(window.innerWidth, window.innerHeight))));
});
const endDrag = () => {
  const a = G.aim;
  if (!a.dragging) return;
  a.dragging = false;
  if (G.mode === 'aim') shoot();
};
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', () => { G.aim.dragging = false; G.aim.power = 0; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// ---------------------------------------------------------------- input: keyboard
const KEY_LEFT = ['ArrowLeft', 'KeyA'], KEY_RIGHT = ['ArrowRight', 'KeyD'];
window.addEventListener('keydown', (e) => {
  if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Digit1', 'Digit2', 'Digit3', 'Enter'].includes(e.code)) {
    setTouchMode(false);
  }
  if (e.code === 'KeyM') { sfx.init(); sfx.setMuted(!sfx.muted); if (G.level) updateHud(); return; }
  if (G.mode === 'menu') {
    const n = Number(e.key);
    if (n >= 1 && n <= LEVELS.length) { const b = $('levels').children[n - 1]; if (!b.disabled) startLevel(n - 1); }
    if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); startLevel(0); }
    return;
  }
  if (G.mode === 'end') {
    if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); startLevel(LEVELS[G.levelIdx + 1] ? G.levelIdx + 1 : G.levelIdx); }
    return;
  }
  if (G.mode === 'card') {
    const n = Number(e.key);
    if (n >= 1 && n <= 3) answerCard(n - 1);
    return;
  }
  if (e.code === 'Space') {
    e.preventDefault();
    if (e.repeat) return;
    sfx.init();
    if (G.mode === 'idle') openStroke();
    else if (G.mode === 'aim' && !G.aim.dragging) { G.aim.charging = true; G.aim.chargeT = 0; }
    return;
  }
  if (KEY_LEFT.includes(e.code)) G.aim.rot = -1;
  if (KEY_RIGHT.includes(e.code)) G.aim.rot = 1;
});
window.addEventListener('keyup', (e) => {
  if (KEY_LEFT.includes(e.code) && G.aim.rot < 0) G.aim.rot = 0;
  if (KEY_RIGHT.includes(e.code) && G.aim.rot > 0) G.aim.rot = 0;
  if (e.code === 'Space' && G.aim.charging && G.mode === 'aim') shoot();
});
window.addEventListener('blur', () => { G.aim.rot = 0; if (G.aim.charging) { G.aim.charging = false; G.aim.power = 0; } });

// ---------------------------------------------------------------- frame loop
let last = performance.now();
const tmpQ = new THREE.Quaternion(), tmpAxis = new THREE.Vector3();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(QA ? 0.25 : 0.05, (now - last) / 1000); last = now;
  update(dt, now / 1000);
  renderer.render(scene, camera);
}

function update(dt, time) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i]; tw.t += dt;
    const k = Math.min(1, tw.t / tw.dur);
    tw.fn(k);
    if (k >= 1) { tweens.splice(i, 1); if (tw.done) tw.done(); }
  }
  if (clouds) clouds.rotation.y = time * 0.006;
  for (let i = bursts.length - 1; i >= 0; i--) {
    const m = bursts[i], v = m.userData.v;
    v.y -= 12 * dt; m.position.addScaledVector(v, dt); m.rotation.y += dt * 8;
    m.userData.life -= dt;
    if (m.userData.life <= 0) { scene.remove(m); bursts.splice(i, 1); }
  }
  if (!G.course) return;
  const b = G.ball;
  const px = b.x, pz = b.z;

  if (G.mode === 'roll') {
    G.acc += dt; G.rollT += dt;
    while (G.acc >= DT && G.mode === 'roll') {
      G.acc -= DT;
      const ox = b.x, oz = b.z;
      const ev = step(b, G.course);
      if (ev.wall) sfx.clunk(ev.wall);
      if (ev.lip) sfx.lip();
      if (ev.cup) { sink(); break; }
      if (crossGates(ox, oz)) break;
      if (!G.course.walkable(b.x, b.z)) { toast(t('outOfBounds')); addPenalty(); rewind(); break; }
      if (ev.stop || G.rollT > 25) { b.vx = b.vz = 0; afterStop(); break; }
    }
  }
  sfx.roll(G.mode === 'roll' ? Math.hypot(b.vx, b.vz) : 0);

  // ball mesh: position on the surface, rolling rotation from the distance moved
  const y = G.course.heightAt(b.x, b.z) + BALL_R + (b.hop || 0) + (b.sinkY || 0);
  ballMesh.position.set(b.x, y, b.z);
  const mx = b.x - px, mz = b.z - pz, dist = Math.hypot(mx, mz);
  if (dist > 1e-5) {
    tmpAxis.set(mz, 0, -mx).normalize();
    ballMesh.quaternion.premultiply(tmpQ.setFromAxisAngle(tmpAxis, dist / BALL_R));
  }
  flagMesh.rotation.y = Math.sin(time * 1.3) * 0.12;

  // aiming
  const a = G.aim;
  if (G.mode === 'aim') {
    if (a.rot) { a.angle += a.rot * dt * 1.6; a.touched = true; }
    if (a.charging) {
      a.chargeT += dt;
      const u = a.chargeT / 0.8; const m = u % 2;
      a.power = m < 1 ? m : 2 - m;
    }
    const L = 0.4 + a.power * 3.4;
    const { shaft, head, ring, mat } = arrow.userData;
    shaft.scale.x = L; shaft.position.x = BALL_R + 0.15;
    head.position.x = BALL_R + 0.15 + L;
    arrow.position.set(b.x, G.course.heightAt(b.x, b.z) + 0.03, b.z);
    arrow.rotation.y = -a.angle;
    mat.color.set(a.power < 0.45 ? '#2ee6c0' : a.power < 0.8 ? '#ffcf5e' : '#ff8585');
    mat.opacity = a.power > 0 ? 0.95 : 0.55;
  } else arrow.visible = false;
  if (G.mode === 'aim') arrow.visible = true;

  if (promptOn) {
    const s = screenOf(b.x, y + 0.35, b.z);
    const el = $('prompt'); el.style.left = `${s.x}px`; el.style.top = `${s.y - 10}px`;
  }
}

// did the ball cross an unsolved gate row between (ox, oz) and now? → judge it
function crossGates(ox, oz) {
  for (const row of G.course.gates) {
    if (row.solved) continue;
    const axis = row.line.axis;
    const c0 = axis === 'z' ? oz : ox, c1 = axis === 'z' ? G.ball.z : G.ball.x;
    if ((c0 - row.line.at) * row.sign > 0 && (c1 - row.line.at) * row.sign <= 0) {
      const along = axis === 'z' ? G.ball.x : G.ball.z;
      const i = row.openings.findIndex((o) => Math.abs(along - (axis === 'z' ? o.cx : o.cz)) < GATE_OPEN);
      if (i < 0) continue;
      if (row.openings[i].plate.state === 'wait') continue;
      const ok = judgeGate(row, i);
      return !ok; // a wrong gate stops the roll (rewind)
    }
  }
  return false;
}

// ---------------------------------------------------------------- QA (headless checks)
Object.assign(window.__VG, {
  info: () => ({ mode: G.mode, level: G.level && G.level.id, hole: G.holeIdx + 1, strokes: G.strokes,
    shots: G.shots, penalties: G.penalties, ball: { x: +G.ball.x.toFixed(2), z: +G.ball.z.toFixed(2) },
    source, tiers: tierInfo, asked: G.asked, answers: G.answers, firstTry: G.firstTry,
    missed: [...G.missed.keys()], scores: G.scores, yaw: G.yaw,
    calls: renderer.info.render.calls, tris: renderer.info.render.triangles,
    row: (() => { const r = G.course && activeRow(); return r ? r.index : -1; })(), track: trackLog }),
  ready: () => openStroke(),
  answer: (right) => {
    const q = G.cardQ; if (!q) return;
    const i = right ? q.options.indexOf(q.answer) : q.options.findIndex((w, k) => w !== q.answer && !q.tried.has(k));
    answerCard(i);
  },
  // a real shot: angle in degrees (world: 0 = +x, 90 = +z) or towards a point
  shoot: (deg, power) => { G.aim.angle = deg * Math.PI / 180; G.aim.power = power; shoot(); },
  shootAt: (x, z, power) => { G.aim.angle = Math.atan2(z - G.ball.z, x - G.ball.x); G.aim.power = power; shoot(); },
  putt: () => { // towards the cup with a power that roughly fits the distance
    const c = G.course.cup, d = Math.hypot(c.x - G.ball.x, c.z - G.ball.z);
    window.__VG.shootAt(c.x, c.z, Math.min(1, 0.1 + d / 26));
  },
  // a gate stroke: put the ball in front of opening i (right / a wrong one) and putt it through
  gate: (right) => {
    const row = activeRow(); if (!row) return false;
    const q = gateQ(row);
    const i = row.openings.findIndex((o) => (right ? o.plate.word === q.answer : o.plate.word !== q.answer && o.plate.state === 'open'));
    const o = row.openings[i];
    const back = 1.2 * row.sign;
    if (row.line.axis === 'z') { G.ball.x = o.cx; G.ball.z = o.cz + back; } else { G.ball.x = o.cx + back; G.ball.z = o.cz; }
    const deg = { N: -90, S: 90, E: 0, W: 180 }[row.dir];
    window.__VG.shoot(deg, 0.3);
    return true;
  },
  sinkNow: () => { G.ball.x = G.course.cup.x; G.ball.z = G.course.cup.z; sink(); },
  teleport: (x, z) => { G.ball.x = x; G.ball.z = z; },
  course: () => G.course,
  hole: (n) => startHole(n - 1),
  ballScreen: () => screenOf(G.ball.x, G.course.heightAt(G.ball.x, G.ball.z) + BALL_R, G.ball.z),
});

function qaDone() {
  $('qa').textContent = JSON.stringify(window.__VG.info());
}

// ?qa=play&level=n[&wrongall=1]: plays a level by script with real shots (putts at the cup,
// gate strokes through the right gate; wrongall = one wrong card answer and one wrong gate per hole)
async function qaPlay() {
  const wrongAll = params.has('wrongall');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  let wrongGateDone = -1, wrongCardDone = -1;
  const tEnd = performance.now() + 200000;
  while (G.mode !== 'end' && performance.now() < tEnd) {
    await wait(60);
    const V = window.__VG;
    if (G.mode === 'idle') V.ready();
    else if (G.mode === 'card') {
      const wrong = wrongAll && wrongCardDone !== G.holeIdx;
      if (wrong) wrongCardDone = G.holeIdx;
      V.answer(!wrong);
    } else if (G.mode === 'aim') {
      if (activeRow()) {
        const wrong = wrongAll && wrongGateDone !== G.holeIdx;
        if (wrong) wrongGateDone = G.holeIdx;
        V.gate(!wrong);
      } else V.putt();
    }
  }
}

// ---------------------------------------------------------------- boot
async function boot() {
  $('loading').textContent = t('loading');
  await Assets.load((f) => { $('loading').textContent = `${t('loading')} ${Math.round(f * 100)} %`; });
  buildDynamic();
  requestAnimationFrame(frame);
  $('loading').style.display = 'none';
  const lv = Math.max(1, Math.min(LEVELS.length, Number(params.get('level')) || 1)) - 1;
  if (QA === 'play') { await startLevel(lv); qaPlay(); return; }
  if (params.has('play')) { await startLevel(lv); return; }
  showMenu();
}
boot().catch((e) => {
  $('loading').style.display = 'flex';
  $('loading').textContent = `Error: ${e.message}`;
  console.error(e);
});
