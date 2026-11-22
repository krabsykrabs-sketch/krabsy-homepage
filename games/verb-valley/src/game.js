// Main orchestrator: renderer + loop, input, interaction targeting, the school
// gate, sleep/pass-out flow, ?qa= frozen scenes and the window.__VV QA harness.

import * as THREE from 'three';
import { TIME, LAYOUT, CROPS, TIER_UNLOCK, SELLABLE, TOOL_COST, ITEM_EMOJI, MINE_NODES,
  BUCKET_CAP, WATER_PER_RIGHT, SALE_BONUS_PER_RIGHT } from './config.js';
import { loadAssets } from './assets.js';
import { buildWorld, drawBoardIdle } from './world.js';
import { createDayCycle } from './daycycle.js';
import { createPlayer } from './player.js';
import { createFarm } from './farming.js';
import { createFishing } from './fishing.js';
import { createSchool } from './school.js';
import { createUI } from './ui.js';
import * as save from './save.js';
import * as Q from './questions.js';
import * as quiz from './quiz.js';
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

// Wait briefly for the Google fonts so canvas textures use Fredoka/Nunito,
// then pull in every GLTF asset (the loading screen shows progress).
await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1800))]);
const loadingEl = document.getElementById('loading');
await Promise.all([
  loadAssets((p) => { loadingEl.textContent = `🦀 Loading the valley… ${Math.round(p * 100)}%`; }),
  Q.initQuestions(),
]);

const refs = buildWorld(scene);
drawBoardIdle(refs.blackboard);
const daycycle = createDayCycle(scene, renderer, refs, document.getElementById('vignette'));

// Backdrop state so the world renders behind the start screen.
let state = { timeMin: 600, day: 1 };
let started = false;
let frozen = false;            // QA clock freeze
let player = null, farm = null, school = null, ui = null, fishing = null;
let camMode = 'follow';        // 'follow' | 'class'
let lastNagMin = TIME.WAKE;
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
  if (quiz.isOpen()) {
    if (e.code === 'Digit1') quiz.answer(0);
    if (e.code === 'Digit2') quiz.answer(1);
    if (e.code === 'Digit3') quiz.answer(2);
    return;
  }
  if (school.active) return;
  if (e.code === 'Digit1') ui.selectTool('shovel');
  if (e.code === 'Digit2') ui.selectTool('bucket');
  if (e.code === 'Digit3') ui.selectTool('sword');
  if (e.code === 'Digit4') ui.selectTool('axe');
  if (e.code === 'Digit5') ui.selectTool('pickaxe');
  if (e.code === 'Digit6') ui.selectTool('rod');
  if (e.code === 'Digit7') ui.cycleSeed();
  if (e.code === 'KeyE') interact();
});
addEventListener('keyup', (e) => { if (KEYMAP[e.code]) input[KEYMAP[e.code]] = false; });

// Click: board chips during class, otherwise same as E.
addEventListener('pointerdown', (e) => {
  unlock();
  if (!started || e.target.closest('#hud, .panel, #start-screen, #sleep-overlay, #quiz-panel')) return;
  if (school.active || quiz.isOpen()) return;
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

function bucketEmpty() {
  sfx.deny();
  ui.bubble(new THREE.Vector3(player.position.x, 2.4, player.position.z), '🪣 Empty! Refill it at the well', 2400);
  return { ok: false, reason: 'bucket-empty' };
}

// ── Question stations (the Verb Kitchen sink pattern) ───────────────────
// Self-paced: the player walks up when they choose. The clock pauses while
// a question is open. Wrong = the chain is shown, nothing is lost.
async function useWell() {
  if (quiz.isOpen()) return { ok: false, reason: 'busy' };
  if (state.water >= BUCKET_CAP) {
    ui.toast('🪣 Your bucket is already full');
    return { ok: false, reason: 'full' };
  }
  const unit = Q.nextUnit();
  const perRight = unit.steps.length > 1 ? WATER_PER_RIGHT : BUCKET_CAP;
  player.playAction('Use_Item');
  const r = await quiz.ask(unit, {
    title: '🪣 The well',
    reward: () => `+${perRight} 💧`,
    onStep: (i, ok) => {
      Q.recordStep(state, unit, i, ok);
      if (ok) { state.water = Math.min(BUCKET_CAP, state.water + perRight); sfx.water(); }
      ui.updateHUD();
    },
  });
  Q.recordUnit(state, unit, r.correct === r.total);
  state.today.wells += 1;
  if (r.correct === 0) ui.toast('🪣 Try the well again — a new word is waiting');
  return { ok: true, ...r, water: state.water };
}

async function krabsyDeal() {
  if (quiz.isOpen() || state.saleBonus > 0) return { ok: false, reason: 'busy' };
  const unit = Q.nextUnit();
  const per = unit.steps.length > 1 ? SALE_BONUS_PER_RIGHT : SALE_BONUS_PER_RIGHT * 2;
  ui.closePanels();
  const r = await quiz.ask(unit, {
    title: '📦 Krabsy’s deal',
    reward: () => `+${Math.round(per * 100)}% 🪙`,
    onStep: (i, ok) => { Q.recordStep(state, unit, i, ok); if (ok) state.saleBonus += per; },
  });
  Q.recordUnit(state, unit, r.correct === r.total);
  ui.openShip();
  return { ok: true, ...r, bonus: state.saleBonus };
}

// ── Gated farm actions (single path for player input AND QA) ────────────
const act = {
  till: (i) => gated(() => { const r = farm.actions.till(i); if (r.ok) { sfx.till(); player.playAction('Dig'); } return r; }),
  plant: (i, t) => gated(() => { const r = farm.actions.plant(i, t); if (r.ok) { sfx.plant(); ui.autoStow(); ui.refresh(); } return r; }),
  water: (i) => gated(() => {
    if (state.water <= 0) return bucketEmpty();
    const r = farm.actions.water(i);
    if (r.ok) { state.water--; sfx.water(); player.playAction('Use_Item'); ui.updateHUD(); }
    return r;
  }),
  harvest: (i) => gated(() => {
    const r = farm.actions.harvest(i);
    if (r.ok) {
      sfx.harvest();
      // crop album: first harvest of a type collects it
      if (!state.collection[r.type]) {
        state.collection[r.type] = true;
        const n = Object.keys(state.collection).length;
        sfx.star();
        ui.toast(`📖 New crop collected: ${CROPS[r.type].emoji} ${CROPS[r.type].name} (${n}/${Object.keys(CROPS).length})`, 3800);
        if (n === Object.keys(CROPS).length) {
          state.school.stickers += 1;
          setTimeout(() => ui.toast('🌈 CROP ALBUM COMPLETE! You are the valley legend! 🌟', 6000), 4000);
        }
      } else {
        ui.toast(`${CROPS[r.type].emoji} ${CROPS[r.type].name} harvested!`);
      }
      ui.refresh();
    }
    return r;
  }),
  cutHay: (i) => gated(() => {
    const r = farm.actions.cutHay(i);
    if (r.ok) { sfx.till(); player.playAction('Chop'); ui.refresh(); }
    return r;
  }),
  waterHay: (i) => gated(() => {
    if (state.water <= 0) return bucketEmpty();
    const r = farm.actions.waterHay(i);
    if (r.ok) { state.water--; sfx.water(); player.playAction('Use_Item'); ui.updateHUD(); }
    return r;
  }),
  chop: (i) => gated(() => {
    const r = farm.actions.chop(i);
    if (r.ok) { sfx.chop(); player.playAction('Chop'); ui.toast('🪵 +3 wood'); ui.refresh(); }
    return r;
  }),
  mine: (i) => gated(() => {
    const r = farm.actions.mine(i);
    if (r.ok) {
      sfx.clink(); player.playAction('Pickaxe');
      ui.toast(`${ITEM_EMOJI[r.drop]} +${r.n} ${r.drop}`);
      ui.refresh();
    }
    return r;
  }),
  fish: () => gated(() => {
    if (!state.tools.rod) return { ok: false, reason: 'no-rod' };
    const r = fishing.start();
    if (r.ok) sfx.splash();
    return r;
  }),
};

// ── Interaction targeting: one function feeds the prompt AND the E key ──
function computeTarget() {
  const p = player.position;
  const d2 = (x, z) => Math.hypot(p.x - x, p.z - z);

  // During fishing, E is the reaction button.
  if (fishing.active) {
    if (fishing.phase === 'bite') return { kind: 'fishPress', label: '<b>E</b> — NOW! Reel it in! 🐟' };
    return { kind: 'fishPress', label: 'Wait for the bobber to dip… 🎣' };
  }

  if (d2(LAYOUT.school.x, LAYOUT.school.z) < 4.2) {
    if (school.active) return { kind: 'none' };
    if (attended()) return { kind: 'info', label: 'Class is done for today 🦀' };
    return { kind: 'school', label: '<b>E</b> — Attend class 🦀' };
  }
  if (d2(LAYOUT.bed.x, LAYOUT.bed.z) < 2.1) {
    return { kind: 'sleep', label: '<b>E</b> — Sleep 🛏' };
  }
  if (d2(LAYOUT.crate.x, LAYOUT.crate.z) < 2.4) return { kind: 'ship', label: '<b>E</b> — Sell produce 📦' };
  if (d2(LAYOUT.well.x, LAYOUT.well.z) < 2.2) {
    if (!attended()) return { kind: 'info', label: 'The well opens after school 🦀' };
    if (state.water >= BUCKET_CAP) return { kind: 'info', label: `Bucket full 🪣 ${state.water}/${BUCKET_CAP}` };
    return { kind: 'well', label: `<b>E</b> — Fill the bucket 🪣 ${state.water}/${BUCKET_CAP}` };
  }
  if (d2(LAYOUT.shop.x, LAYOUT.shop.z) < 2.8) return { kind: 'shop', label: '<b>E</b> — Shop 🛒' };

  const bi = farm.nearestBerry(p, 1.7);
  if (bi >= 0) return { kind: 'berry', i: bi, label: '<b>E</b> — Pick berries 🫐' };

  const pi = farm.nearestPlot(p, 1.6);
  if (pi >= 0) {
    const plot = state.plots[pi];
    const lock = attended() ? '' : ' 🔒';
    if (plot.crop && plot.stage >= CROPS[plot.crop].days)
      return { kind: 'harvest', i: pi, label: `<b>E</b> — Harvest ${CROPS[plot.crop].emoji}${lock}` };
    const tool = ui.tool, seed = ui.seedType;
    if (seed && plot.tilled && !plot.crop)
      return { kind: 'plant', i: pi, t: seed, label: `<b>E</b> — Plant ${CROPS[seed].emoji} ${CROPS[seed].name}${lock}` };
    if (seed && !plot.tilled) return { kind: 'info', label: 'Till this first — press 1 for the shovel 🪏' };
    if (tool === 'shovel' && !plot.tilled) return { kind: 'till', i: pi, label: `<b>E</b> — Till soil 🪏${lock}` };
    if (tool === 'bucket' && plot.tilled && !plot.watered) {
      if (state.water <= 0) return { kind: 'info', label: '🪣 Bucket empty — fill it at the well' };
      return { kind: 'water', i: pi, label: `<b>E</b> — Water 🪣 ${state.water}/${BUCKET_CAP}${lock}` };
    }
    if (plot.tilled && plot.watered && plot.crop) return { kind: 'info', label: 'Watered for today ✓' };
    if (plot.tilled && !plot.crop) return { kind: 'info', label: 'Click a seed bag in your inventory 🌱' };
    return { kind: 'none' };
  }

  const hi = farm.nearestHay(p, 1.5);
  if (hi >= 0) {
    const h = state.hay[hi];
    const lock = attended() ? '' : ' 🔒';
    const tool = ui.tool;
    if (!h.cut) {
      if (tool === 'sword') return { kind: 'cutHay', i: hi, label: `<b>E</b> — Cut hay ⚔️${lock}` };
      return { kind: 'info', label: 'Tall hay — press 3 for the sword ⚔️' };
    }
    if (!h.watered) {
      if (tool === 'bucket') {
        if (state.water <= 0) return { kind: 'info', label: '🪣 Bucket empty — fill it at the well' };
        return { kind: 'waterHay', i: hi, label: `<b>E</b> — Water stubble 🪣 ${state.water}/${BUCKET_CAP}${lock}` };
      }
      return { kind: 'info', label: 'Water the stubble and it regrows overnight 🚿' };
    }
    return { kind: 'info', label: 'Regrows tomorrow ✓' };
  }

  const ti = farm.nearestTree(p, 2.2);
  if (ti >= 0) {
    if (!state.tools.axe) return { kind: 'info', label: 'You need an axe — check the shop 🛒' };
    const lock = attended() ? '' : ' 🔒';
    return { kind: 'chop', i: ti, label: `<b>E</b> — Chop tree 🪓${lock}` };
  }

  const mi = farm.nearestMine(p, 2.2);
  if (mi >= 0) {
    if (!state.tools.pickaxe) return { kind: 'info', label: 'You need a pickaxe — check the shop 🛒' };
    const lock = attended() ? '' : ' 🔒';
    const node = MINE_NODES[state.mine[mi].type];
    return { kind: 'mine', i: mi, label: `<b>E</b> — Mine ${node.emoji} ${node.name}${lock}` };
  }

  // Pond edge: fish (rod selected) — pond is decor otherwise.
  if (d2(LAYOUT.pond.x, LAYOUT.pond.z) < LAYOUT.pond.r + 1.6) {
    if (!state.tools.rod) return { kind: 'info', label: 'Fish are jumping! Buy a rod at the shop 🎣' };
    if (ui.tool !== 'rod') return { kind: 'info', label: 'Press 6 for the fishing rod 🎣' };
    const lock = attended() ? '' : ' 🔒';
    return { kind: 'fish', label: `<b>E</b> — Cast the line 🎣${lock}` };
  }
  return { kind: 'none' };
}

function interact() {
  if (!started || ui.anyPanelOpen() || quiz.isOpen()) return;
  const t = computeTarget();
  switch (t.kind) {
    case 'school': startClass(); break;
    case 'sleep': doSleep(); break;
    case 'ship': ui.openShip(); break;
    case 'well': useWell(); break;
    case 'shop': ui.openShop(); break;
    case 'berry': { const r = farm.actions.pickBerry(t.i); if (r.ok) { sfx.harvest(); ui.toast('🫐 Wild berries!'); ui.refresh(); } break; }
    case 'harvest': act.harvest(t.i); break;
    case 'till': act.till(t.i); break;
    case 'plant': act.plant(t.i, t.t); break;
    case 'water': act.water(t.i); break;
    case 'chop': act.chop(t.i); break;
    case 'cutHay': act.cutHay(t.i); break;
    case 'waterHay': act.waterHay(t.i); break;
    case 'mine': act.mine(t.i); break;
    case 'fish': act.fish(); break;
    case 'fishPress': fishing.press(); break;
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
  state.timeMin += TIME.CLASS_LENGTH;   // class takes an in-game hour
  ui.refresh();
  daycycle.applyInstant(state);
  let msg = `Class done — +${sum.coins} 🪙`;
  if (sum.specialSeed) msg += ` · ${CROPS[sum.seedAwarded].emoji} rare seed!`;
  if (sum.sticker) msg += ' · 🌟 sticker!';
  ui.toast(msg, 4200);
  save.save(state);
}

// ── Shop / ship / sleep ─────────────────────────────────────────────────
function buy(id) {
  if (TOOL_COST[id] != null) {
    if (state.tools[id]) return { ok: false, reason: 'owned' };
    if (state.coins < TOOL_COST[id]) { sfx.deny(); return { ok: false, reason: 'coins' }; }
    state.coins -= TOOL_COST[id]; state.tools[id] = true; sfx.buy();
    ui.refresh();
    return { ok: true };
  }
  if (id.startsWith('seed:')) {
    const t = id.slice(5);
    const def = CROPS[t];
    if (!def || def.schoolOnly) return { ok: false, reason: 'unknown' };
    if ((TIER_UNLOCK[def.tier] ?? 0) > Object.keys(state.collection).length) {
      sfx.deny(); return { ok: false, reason: 'tier-locked' };
    }
    if (state.coins < def.seed) { sfx.deny(); return { ok: false, reason: 'coins' }; }
    state.coins -= def.seed; state.seeds[t] = (state.seeds[t] ?? 0) + 1; sfx.buy();
    ui.refresh();
    return { ok: true };
  }
  return { ok: false, reason: 'unknown' };
}

// Selling pays out on the spot — playtesting showed the Stardew-style
// overnight crate payout just felt like a bug ("where's my money?").
function ship(item, n) {
  const have = state.inventory[item] ?? 0;
  const move = Math.min(have, n);
  if (move <= 0) return { ok: false, reason: 'none' };
  const base = (SELLABLE[item] ?? 0) * move;
  const earned = Math.round(base * (1 + (state.saleBonus || 0)));
  const bonusText = earned > base ? ` (🦀 +${earned - base})` : '';
  state.saleBonus = 0;
  state.inventory[item] -= move;
  state.coins += earned;
  sfx.coin();
  ui.toast(`+${earned} 🪙${bonusText}`);
  ui.autoStow();
  ui.refresh();
  return { ok: true, moved: move, earned };
}

function doSleep(dozed = false) {
  fishing?.cancel();
  sfx.sleep();
  const summary = save.advanceDay(state);
  summary.english.lines = summary.english.missed.map((m) => Q.chainLine(m));
  Q.resetDay();
  save.save(state);
  farm.refreshAll();
  player.teleport(LAYOUT.bed.x, LAYOUT.bed.z + 1);
  daycycle.applyInstant(state);
  ui.refresh();
  ui.showSleep(summary, dozed);
  birds();
  lastNagMin = TIME.WAKE;   // first bell nag ~45 in-game min after waking
  return { ok: true, summary };
}

// ── Game start ──────────────────────────────────────────────────────────
function startGame(loaded) {
  state = loaded ?? save.createNewState();
  player = createPlayer(scene, camera);
  farm = createFarm(scene, state);
  fishing = createFishing(scene, player, {
    onCatch: (type) => {
      state.inventory[type] = (state.inventory[type] ?? 0) + 1;
      sfx.catch_();
      ui.toast(type === 'goldfish' ? '🐠 A GOLDFISH! Lucky catch!' : '🐟 Fish caught!', 3000);
      ui.refresh();
    },
    onMiss: () => { sfx.deny(); ui.toast('It got away… cast again! 🎣'); },
    onBite: () => sfx.bite(),
    toast: (m) => ui.toast(m),
  });
  school = createSchool(state, refs.blackboard, { onComplete: onClassComplete });
  ui = createUI(state, {
    onBuy: buy,
    onShip: (item, n) => { ship(item, n); ui.updateHUD(); },
    onDeal: () => { krabsyDeal(); },
    onContinue: () => {}, onNewFarm: () => {},
    onWake: () => {},
    // Mirror the inventory selection onto the rig: seed bags and produce
    // ride over the head; tools clear the hands.
    onSelect: (sel) => {
      if (sel.kind === 'seed') { player.setHeld({ emoji: CROPS[sel.id].emoji, bag: true }); player.setTool(null); }
      else if (sel.kind === 'item') { player.setHeld({ emoji: ITEM_EMOJI[sel.id] }); player.setTool(null); }
      else { player.setHeld(null); player.setTool(sel.id); }
    },
  });
  daycycle.applyInstant(state);
  player.setTool('shovel');        // mirror the default selection
  player.updateCamera(0, true);
  document.getElementById('hud').hidden = false;
  started = true;
  if (!loaded && !QA_SCENE) {
    setTimeout(() => ui.toast('Welcome! Professor Krabsy is waiting at the school 🦀', 4200), 600);
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
    const paused = school.active || ui.anyPanelOpen() || quiz.isOpen();
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

    // Walking away cancels a fishing session.
    if (fishing.active && (input.up || input.down || input.left || input.right)) fishing.cancel();
    fishing.tick(dt, worldClock);

    player.update(dt, input, paused || fishing.active);
    farm.update(worldClock);

    if (camMode === 'class') {
      const cz = LAYOUT.school.z;
      camera.position.lerp(new THREE.Vector3(0, 4.0, cz + 6.8), Math.min(1, dt * 5));
      camera.lookAt(0, 2.5, cz);
    } else {
      player.updateCamera(dt);
    }

    if (!ui.anyPanelOpen() && !school.active && !quiz.isOpen()) {
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
  window.__SCENE = scene;   // debug/QA introspection
  window.__THREE = THREE;
  window.__RENDERER = renderer;
  window.__VV = {
    get state() { return state; },
    save: () => save.save(state),
    freeze(v = true) { frozen = v; },
    setTime(min) { state.timeMin = min; daycycle.applyInstant(state); ui.updateHUD(); },
    setDay(n) { state.day = n; ui.updateHUD(); },
    grantCoins(n) { state.coins += n; ui.updateHUD(); },
    grantSeeds(t, n) { state.seeds[t] = (state.seeds[t] ?? 0) + n; ui.refresh(); },
    teleport(x, z) { player.teleport(x, z); },
    // QA: scale the follow-cam distance (0.4 = close-up) for screenshots
    zoom(f = 1) { player.setZoom?.(f); player.updateCamera(0, true); },
    face: (rad) => player.setFacing(rad),
    playAction: (n, o) => player.playAction(n, o),
    poseAt: (n, t) => player.poseAt(n, t),
    selectTool: (t) => ui.selectTool(t),
    startClass: (seed) => startClass(seed),
    // Question panel (all stations): answer index, skip the feedback pause.
    answer: (i) => quiz.answer(i),
    flush: () => quiz.flush(),
    quizOpen: () => quiz.isOpen(),
    currentStep: () => quiz.currentStep(),
    // Answer the open panel right (true) or wrong (false), then flush.
    async solve(right = true) {
      const st = quiz.currentStep();
      if (!st) return { ok: false };
      const k = st.options.indexOf(st.answer);
      const r = quiz.answer(right ? k : (k + 1) % st.options.length);
      quiz.flush();
      await new Promise((res) => setTimeout(res, 0));
      return r;
    },
    // Answer until the panel closes with a pattern like [true, false, ...].
    async solveAll(pattern = [true]) {
      let i = 0, guard = 0;
      while (quiz.isOpen() && guard++ < 20) await this.solve(pattern[Math.min(i++, pattern.length - 1)]);
      return { ok: true };
    },
    classActive: () => school.active,
    async attendClass(wantCorrect = 4) {
      const r = startClass();
      if (!r.ok) return r;
      const pattern = Array.from({ length: 4 }, (_, k) => k < wantCorrect);
      await this.solveAll(pattern);
      await new Promise((res) => setTimeout(res, 0));
      return { ok: true, correct: school.progress.correct };
    },
    useWell: () => useWell(),
    deal: () => krabsyDeal(),
    questions: () => ({ source: Q.source, topic: Q.topic, size: Q._qa.pool.length, reask: Q._qa.reask.slice() }),
    till: (i) => act.till(i),
    plant: (i, t) => act.plant(i, t),
    water: (i) => act.water(i),
    harvest: (i) => act.harvest(i),
    chop: (i) => act.chop(i),
    cutHay: (i) => act.cutHay(i),
    waterHay: (i) => act.waterHay(i),
    mine: (i) => act.mine(i),
    // fishing QA: deterministic rng + manual ticking
    startFishing: () => act.fish(),
    fishPress: () => fishing.press(),
    tickFishing: (dt) => fishing.tick(dt, worldClock),
    fishingPhase: () => fishing.phase,
    setFishingRng: (fn) => fishing._setRng(fn),
    cancelFishing: () => fishing.cancel(),
    pickBerry: (i) => farm.actions.pickBerry(i),
    buy: (id) => buy(id),
    ship: (item, n) => ship(item, n),
    sleep: () => {
      const r = doSleep();
      document.getElementById('sleep-overlay').hidden = true;   // QA: skip the overlay pause
      return r;
    },
    selectSeed: (t) => ui.selectSeed(t),
    selectItem: (t) => ui.selectItem(t),
    selection: () => ui.selection,
    // Simulate an E press through the real targeting logic.
    interact: () => { const t = computeTarget(); interact(); return t; },
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
      startClass();
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
      VV.grantSeeds('tomato', 2);
      VV.selectSeed('tomato');   // showcase the held seed bag
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
  ui.refresh();
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
