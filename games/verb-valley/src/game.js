// Main orchestrator: renderer + loop, input, interaction targeting, the school
// gate, sleep/pass-out flow, ?qa= frozen scenes and the window.__VV QA harness.

import * as THREE from 'three';
import { TIME, LAYOUT, CROPS, SELLABLE, AXE_COST, INTERACT_RANGE } from './config.js';
import { buildWorld, drawBoardIdle } from './world.js';
import { createDayCycle } from './daycycle.js';
import { createPlayer } from './player.js';
import { createFarm } from './farming.js';
import { createSchool } from './school.js';
import { createUI } from './ui.js';
import * as save from './save.js';
import { unlock, sfx, birds } from './audio.js';

const QA_SCENE = new URLSearchParams(location.search).get('qa');

// ── Boot: renderer, scene, static world ─────────────────────────────────
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.1, 200);
camera.position.set(0, 16, 18);
camera.lookAt(0, 0, 0);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// Wait briefly for the Google fonts so canvas textures use Fredoka/Nunito.
await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1800))]);

const refs = buildWorld(scene);
drawBoardIdle(refs.blackboard);
const daycycle = createDayCycle(scene, renderer, refs, document.getElementById('vignette'));

// Backdrop state so the world renders behind the start screen.
let state = { timeMin: 600, day: 1 };
let started = false;
let frozen = false;            // QA clock freeze
let player = null, farm = null, school = null, ui = null;
let camMode = 'follow';        // 'follow' | 'class'
let lastNagMin = -999;
let bellSwing = 0;

const BELL_POS = new THREE.Vector3(LAYOUT.school.x + 3, 3.2, LAYOUT.school.z + 1.5);
const KRABSY_POS = new THREE.Vector3(LAYOUT.school.x - 2, 2.2, LAYOUT.school.z + 1.4);

// ── Input ───────────────────────────────────────────────────────────────
const input = { up: false, down: false, left: false, right: false };
const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
};
addEventListener('keydown', (e) => {
  unlock();
  if (KEYMAP[e.code]) { input[KEYMAP[e.code]] = true; e.preventDefault(); }
  if (!started) return;
  if (e.code === 'Escape') ui.closePanels();
  if (school.active) {
    if (e.code === 'Digit1') school.answer(0);
    if (e.code === 'Digit2') school.answer(1);
    if (e.code === 'Digit3') school.answer(2);
    return;
  }
  if (e.code === 'Digit1') ui.selectTool('hoe');
  if (e.code === 'Digit2') ui.selectTool('can');
  if (e.code === 'Digit3') ui.selectTool('seeds');
  if (e.code === 'Digit4') ui.selectTool('axe');
  if (e.code === 'KeyE') interact();
});
addEventListener('keyup', (e) => { if (KEYMAP[e.code]) input[KEYMAP[e.code]] = false; });

// Click: board chips during class, otherwise same as E.
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
addEventListener('pointerdown', (e) => {
  unlock();
  if (!started || e.target.closest('#hud, .panel, #start-screen, #sleep-overlay')) return;
  if (school.active) {
    pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const boardMesh = refs.blackboard.group.children.find((c) => c.isMesh && c.material.map === refs.blackboard.tex);
    const hit = raycaster.intersectObject(boardMesh)[0];
    if (hit?.uv) school.handleBoardClick(hit.uv);
    return;
  }
  interact();
});

// ── The school gate ─────────────────────────────────────────────────────
function attended() { return state.schooledDay === state.day; }
function gated(fn) {
  if (!attended()) {
    sfx.deny();
    ui.bubble(new THREE.Vector3(player.position.x, 2.4, player.position.z),
      '🤷 School first! Professor Krabsy is waiting 🔔', 2800);
    return { ok: false, reason: 'school-gate' };
  }
  return fn();
}

// ── Gated farm actions (single path for player input AND QA) ────────────
const act = {
  till: (i) => gated(() => { const r = farm.actions.till(i); if (r.ok) sfx.till(); return r; }),
  plant: (i, t) => gated(() => { const r = farm.actions.plant(i, t); if (r.ok) { sfx.plant(); ui.renderHotbar(); } return r; }),
  water: (i) => gated(() => { const r = farm.actions.water(i); if (r.ok) sfx.water(); return r; }),
  harvest: (i) => gated(() => {
    const r = farm.actions.harvest(i);
    if (r.ok) { sfx.harvest(); ui.toast(`${CROPS[r.type].emoji} ${CROPS[r.type].name} harvested!`); }
    return r;
  }),
  chop: (i) => gated(() => {
    const r = farm.actions.chop(i);
    if (r.ok) { sfx.chop(); ui.toast('🪵 +3 wood'); }
    return r;
  }),
};

// ── Interaction targeting: one function feeds the prompt AND the E key ──
function computeTarget() {
  const p = player.position;
  const d2 = (x, z) => Math.hypot(p.x - x, p.z - z);

  if (d2(LAYOUT.school.x, LAYOUT.school.z) < 4.2) {
    if (school.active) return { kind: 'none' };
    if (attended()) return { kind: 'info', label: 'Class is done for today 🦀' };
    if (state.timeMin < TIME.SCHOOL_BELL) return { kind: 'info', label: `Class starts at 08:00 ⏰` };
    return { kind: 'school', label: '<b>E</b> — Attend class 🦀' };
  }
  if (d2(LAYOUT.bed.x, LAYOUT.bed.z) < 2.1) {
    if (state.timeMin >= TIME.BEDTIME_OK) return { kind: 'sleep', label: '<b>E</b> — Sleep 🛏' };
    return { kind: 'info', label: 'Too early to sleep (after 18:00) 🌞' };
  }
  if (d2(LAYOUT.crate.x, LAYOUT.crate.z) < 2.4) return { kind: 'ship', label: '<b>E</b> — Ship produce 📦' };
  if (d2(LAYOUT.shop.x, LAYOUT.shop.z) < 2.8) return { kind: 'shop', label: '<b>E</b> — Shop 🛒' };

  const bi = farm.nearestBerry(p, 1.7);
  if (bi >= 0) return { kind: 'berry', i: bi, label: '<b>E</b> — Pick berries 🫐' };

  const pi = farm.nearestPlot(p, 1.6);
  if (pi >= 0) {
    const plot = state.plots[pi];
    const lock = attended() ? '' : ' 🔒';
    if (plot.crop && plot.stage >= CROPS[plot.crop].days)
      return { kind: 'harvest', i: pi, label: `<b>E</b> — Harvest ${CROPS[plot.crop].emoji}${lock}` };
    const tool = ui.tool;
    if (tool === 'hoe' && !plot.tilled) return { kind: 'till', i: pi, label: `<b>E</b> — Till soil ⛏${lock}` };
    if (tool === 'seeds' && plot.tilled && !plot.crop) {
      const t = ui.seedType;
      if ((state.seeds[t] ?? 0) < 1) return { kind: 'info', label: `No ${CROPS[t].name} seeds — visit the shop` };
      return { kind: 'plant', i: pi, t, label: `<b>E</b> — Plant ${CROPS[t].emoji} ${CROPS[t].name}${lock}` };
    }
    if (tool === 'can' && plot.tilled && !plot.watered) return { kind: 'water', i: pi, label: `<b>E</b> — Water 🚿${lock}` };
    if (plot.tilled && plot.watered && plot.crop) return { kind: 'info', label: 'Watered for today ✓' };
    return { kind: 'none' };
  }

  const ti = farm.nearestTree(p, 2.2);
  if (ti >= 0) {
    if (!state.tools.axe) return { kind: 'info', label: 'You need an axe — check the shop 🛒' };
    const lock = attended() ? '' : ' 🔒';
    return { kind: 'chop', i: ti, label: `<b>E</b> — Chop tree 🪓${lock}` };
  }
  return { kind: 'none' };
}

function interact() {
  if (!started || ui.anyPanelOpen()) return;
  const t = computeTarget();
  switch (t.kind) {
    case 'school': startClass(); break;
    case 'sleep': doSleep(); break;
    case 'ship': ui.openShip(); break;
    case 'shop': ui.openShop(); break;
    case 'berry': { const r = farm.actions.pickBerry(t.i); if (r.ok) { sfx.harvest(); ui.toast('🫐 Wild berries!'); } break; }
    case 'harvest': act.harvest(t.i); break;
    case 'till': act.till(t.i); break;
    case 'plant': act.plant(t.i, t.t); break;
    case 'water': act.water(t.i); break;
    case 'chop': act.chop(t.i); break;
  }
  ui.updateHUD();
}

// ── School flow ─────────────────────────────────────────────────────────
function startClass(seed) {
  const r = school.start(seed);
  if (!r.ok) return r;
  camMode = 'class';
  document.getElementById('hud').classList.add('in-class');
  player.teleport(LAYOUT.school.x, LAYOUT.school.z + 3.0);
  player.setFacing(Math.PI);
  sfx.bell(); bellSwing = 1;
  return r;
}

function onClassComplete(sum) {
  camMode = 'follow';
  document.getElementById('hud').classList.remove('in-class');
  state.timeMin = Math.max(state.timeMin, 540);   // class lets out at 09:00
  ui.renderHotbar();
  ui.updateHUD();
  daycycle.applyInstant(state);
  let msg = `Class done — +${sum.coins} 🪙`;
  if (sum.specialSeed) msg += ' · ⭐ special seed!';
  if (sum.sticker) msg += ' · 🌟 sticker!';
  ui.toast(msg, 4200);
  save.save(state);
}

// ── Shop / ship / sleep ─────────────────────────────────────────────────
function buy(id) {
  if (id === 'axe') {
    if (state.tools.axe) return { ok: false, reason: 'owned' };
    if (state.coins < AXE_COST) { sfx.deny(); return { ok: false, reason: 'coins' }; }
    state.coins -= AXE_COST; state.tools.axe = true; sfx.buy();
    ui.renderHotbar();
    return { ok: true };
  }
  if (id.startsWith('seed:')) {
    const t = id.slice(5);
    const def = CROPS[t];
    if (!def || def.schoolOnly) return { ok: false, reason: 'unknown' };
    if (state.coins < def.seed) { sfx.deny(); return { ok: false, reason: 'coins' }; }
    state.coins -= def.seed; state.seeds[t] = (state.seeds[t] ?? 0) + 1; sfx.buy();
    ui.renderHotbar();
    return { ok: true };
  }
  return { ok: false, reason: 'unknown' };
}

function ship(item, n) {
  const have = state.inventory[item] ?? 0;
  const move = Math.min(have, n);
  if (move <= 0) return { ok: false, reason: 'none' };
  state.inventory[item] -= move;
  state.crate[item] = (state.crate[item] ?? 0) + move;
  sfx.coin();
  return { ok: true, moved: move };
}

function doSleep(dozed = false, force = false) {
  if (!force && !dozed && state.timeMin < TIME.BEDTIME_OK) return { ok: false, reason: 'too-early' };
  sfx.sleep();
  const summary = save.advanceDay(state);
  save.save(state);
  farm.refreshAll();
  player.teleport(LAYOUT.bed.x, LAYOUT.bed.z + 1);
  daycycle.applyInstant(state);
  ui.renderHotbar();
  ui.updateHUD();
  ui.showSleep(summary, dozed);
  birds();
  lastNagMin = -999;
  return { ok: true, summary };
}

// ── Game start ──────────────────────────────────────────────────────────
function startGame(loaded) {
  state = loaded ?? save.createNewState();
  player = createPlayer(scene, camera);
  farm = createFarm(scene, state);
  school = createSchool(state, refs.blackboard, { onComplete: onClassComplete });
  ui = createUI(state, {
    onBuy: buy,
    onShip: (item, n) => { ship(item, n); ui.updateHUD(); },
    onContinue: () => {}, onNewFarm: () => {},
    onWake: () => {},
  });
  daycycle.applyInstant(state);
  player.updateCamera(0, true);
  document.getElementById('hud').hidden = false;
  started = true;
  if (!loaded && !QA_SCENE) {
    setTimeout(() => ui.toast('Welcome to the valley! School starts at 08:00 🦀', 4200), 600);
  }
  installQA();
}

// ── Main loop ───────────────────────────────────────────────────────────
const clock3 = new THREE.Clock();
let worldClock = 0;

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock3.getDelta());
  worldClock += dt;

  if (started) {
    const paused = school.active || ui.anyPanelOpen();
    if (!paused && !frozen) {
      state.timeMin += dt * TIME.MIN_PER_SEC;
      if (state.timeMin >= TIME.PASS_OUT) doSleep(true);
    }

    // Bell nag: every 45 in-game minutes between 08:00 and dusk.
    if (!attended() && !school.active && state.timeMin >= TIME.SCHOOL_BELL && state.timeMin < TIME.DUSK
        && state.timeMin - lastNagMin > 45) {
      lastNagMin = state.timeMin;
      sfx.bell(); bellSwing = 1;
      ui.bubble(BELL_POS, '🔔 Ding-ding! English class!', 2600);
    }

    player.update(dt, input, paused);
    farm.update(worldClock);
    school.update(dt);

    if (camMode === 'class') {
      const cz = LAYOUT.school.z;
      camera.position.lerp(new THREE.Vector3(0, 4.0, cz + 6.8), Math.min(1, dt * 5));
      camera.lookAt(0, 2.5, cz);
    } else {
      player.updateCamera(dt);
    }

    if (!ui.anyPanelOpen() && !school.active) {
      const t = computeTarget();
      ui.prompt(t.kind === 'none' ? null : t.label);
    } else ui.prompt(null);

    ui.updateHUD();
    ui.projectBubble(camera);
  }

  // Ambient world animation (also behind the start screen).
  daycycle.update(state, dt);
  if (refs.sea) refs.sea.position.y = 0.04 + Math.sin(worldClock * 0.7) * 0.04;
  if (refs.krabsy) {
    const k = refs.krabsy.group;
    const excited = started && school.active;
    k.position.y = Math.abs(Math.sin(worldClock * (excited ? 5 : 1.6))) * (excited ? 0.12 : 0.05);
    k.userData.claws.rotation.x = Math.sin(worldClock * (excited ? 6 : 2)) * 0.12;
    k.userData.eyes.rotation.z = Math.sin(worldClock * 1.1) * 0.06;
  }
  if (refs.bell && bellSwing > 0.01) {
    refs.bell.rotation.z = Math.sin(worldClock * 13) * 0.35 * bellSwing;
    bellSwing *= 0.96;
  }

  renderer.render(scene, camera);
}

// ── QA: ?qa= frozen scenes + window.__VV ───────────────────────────────
function installQA() {
  window.__VV = {
    get state() { return state; },
    save: () => save.save(state),
    freeze(v = true) { frozen = v; },
    setTime(min) { state.timeMin = min; daycycle.applyInstant(state); ui.updateHUD(); },
    setDay(n) { state.day = n; ui.updateHUD(); },
    grantCoins(n) { state.coins += n; ui.updateHUD(); },
    grantSeeds(t, n) { state.seeds[t] = (state.seeds[t] ?? 0) + n; ui.renderHotbar(); },
    teleport(x, z) { player.teleport(x, z); },
    selectTool: (t) => ui.selectTool(t),
    startClass: (seed) => startClass(seed),
    answer: (i) => school.answer(i),
    tickSchool: (dt = 10) => school.update(dt),
    classActive: () => school.active,
    currentQuestion: () => school.currentQuestion,
    // Run a full class, getting exactly `wantCorrect` answers right.
    attendClass(wantCorrect = 8, seed = 42) {
      const r = startClass(seed);
      if (!r.ok) return r;
      let togo = wantCorrect;
      let guard = 0;
      while (school.active && guard++ < 20) {
        const q = school.currentQuestion;
        const right = q.chips.indexOf(q.correct);
        school.answer(togo-- > 0 ? right : (right + 1) % q.chips.length);
        school.update(10);   // fast-forward the feedback pause
      }
      return { ok: true, correct: school.progress.correct };
    },
    till: (i) => act.till(i),
    plant: (i, t) => act.plant(i, t),
    water: (i) => act.water(i),
    harvest: (i) => act.harvest(i),
    chop: (i) => act.chop(i),
    pickBerry: (i) => farm.actions.pickBerry(i),
    buy: (id) => buy(id),
    ship: (item, n) => ship(item, n),
    sleep: (force = true) => {
      const r = doSleep(false, force);
      document.getElementById('sleep-overlay').hidden = true;   // QA: skip the overlay pause
      return r;
    },
    refreshFarm: () => farm.refreshAll(),
    // Times forced renders directly — works even when rAF is suspended
    // (the preview tool's known background-window issue).
    benchmark(n = 120) {
      renderer.render(scene, camera);   // warm-up / compile shaders
      const t0 = performance.now();
      for (let i = 0; i < n; i++) {
        worldClock += 1 / 60;
        daycycle.update(state, 1 / 60);
        farm.update(worldClock);
        renderer.render(scene, camera);
      }
      const ms = (performance.now() - t0) / n;
      return { msPerFrame: Math.round(ms * 100) / 100, impliedFps: Math.round(1000 / ms) };
    },
  };
}

function setupQAScene(name) {
  startGame(null);
  frozen = true;
  const VV = window.__VV;
  switch (name) {
    case 'morning':
      VV.setTime(390);
      VV.teleport(LAYOUT.bed.x, LAYOUT.bed.z + 2);
      break;
    case 'school-open':
      VV.setTime(485);
      startClass(42);
      break;
    case 'field-with-crops': {
      state.day = 3; state.schooledDay = 3;
      VV.setTime(660);
      const setup = [
        ['turnip', 2, true], ['turnip', 2, false], ['turnip', 1, true], ['turnip', 1, false],
        ['tomato', 3, true], ['tomato', 2, true], ['tomato', 1, false], ['tomato', 0, true],
        ['pumpkin', 2, true], ['pumpkin', 1, true], ['pumpkin', 0, false], ['starfruit', 3, true],
      ];
      setup.forEach(([t, stage, watered], i) => {
        state.plots[i] = { tilled: true, crop: t, stage, watered };
      });
      state.plots[12].tilled = true;
      farm.refreshAll();
      VV.teleport(LAYOUT.field.cx, LAYOUT.field.cz + 4);
      break;
    }
    case 'dusk': {
      state.day = 2; state.schooledDay = 2;
      VV.setTime(1185);
      for (let i = 0; i < 8; i++) state.plots[i] = { tilled: true, crop: 'turnip', stage: i % 3, watered: i % 2 === 0 };
      farm.refreshAll();
      VV.teleport(LAYOUT.field.cx - 2, LAYOUT.field.cz + 5);
      break;
    }
    case 'night':
      VV.setTime(1380);
      VV.teleport(0, 3);
      break;
  }
  ui.renderHotbar();
  ui.updateHUD();
  daycycle.applyInstant(state);
  player.updateCamera(0, true);
}

// ── Entry ───────────────────────────────────────────────────────────────
const qa = QA_SCENE;
document.getElementById('loading').hidden = true;
if (qa) {
  document.getElementById('start-screen').hidden = true;
  setupQAScene(qa);
} else {
  // Show the start screen over the live world (set a pleasant backdrop hour).
  const bootUI = createUI(save.load() ?? save.createNewState(), {
    onBuy: () => {}, onShip: () => {},
    onContinue: () => startGame(save.load()),
    onNewFarm: () => { save.wipe(); startGame(null); },
  });
  bootUI.showStart(save.hasSave());
}
frame();
