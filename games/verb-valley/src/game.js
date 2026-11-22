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
import { t, NameOf, applyStatic } from './i18n.js';
import { createTouch } from './touch.js';

applyStatic();
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
  loadAssets((p) => { loadingEl.textContent = t('loadingPct', Math.round(p * 100)); }),
  Q.initQuestions(),
]);

const refs = buildWorld(scene);
drawBoardIdle(refs.blackboard);
const daycycle = createDayCycle(scene, renderer, refs, document.getElementById('vignette'));

// Backdrop state so the world renders behind the start screen.
let state = { timeMin: 600, day: 1 };
let started = false;
let frozen = false;            // QA clock freeze
let player = null, farm = null, school = null, ui = null, fishing = null, touch = null;
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
      t('schoolFirst'), 2800);
    return { ok: false, reason: 'school-gate' };
  }
  return fn();
}

function bucketEmpty() {
  sfx.deny();
  ui.bubble(new THREE.Vector3(player.position.x, 2.4, player.position.z), t('bucketEmptyBubble'), 2400);
  return { ok: false, reason: 'bucket-empty' };
}

// ── Question stations (the Verb Kitchen sink pattern) ───────────────────
// Self-paced: the player walks up when they choose. The clock pauses while
// a question is open. Wrong = the chain is shown, nothing is lost.
async function useWell() {
  if (quiz.isOpen()) return { ok: false, reason: 'busy' };
  if (state.water >= BUCKET_CAP) {
    ui.toast(t('bucketFull'));
    return { ok: false, reason: 'full' };
  }
  const unit = Q.nextUnit();
  const perRight = unit.steps.length > 1 ? WATER_PER_RIGHT : BUCKET_CAP;
  player.playAction('Use_Item');
  const r = await quiz.ask(unit, {
    title: t('wellTitle'),
    reward: () => `+${perRight} 💧`,
    onStep: (i, ok) => {
      Q.recordStep(state, unit, i, ok);
      if (ok) { state.water = Math.min(BUCKET_CAP, state.water + perRight); sfx.water(); }
      ui.updateHUD();
    },
  });
  Q.recordUnit(state, unit, r.correct === r.total);
  state.today.wells += 1;
  if (r.correct === 0) ui.toast(t('wellAgain'));
  return { ok: true, ...r, water: state.water };
}

async function krabsyDeal() {
  if (quiz.isOpen() || state.saleBonus > 0) return { ok: false, reason: 'busy' };
  const unit = Q.nextUnit();
  const per = unit.steps.length > 1 ? SALE_BONUS_PER_RIGHT : SALE_BONUS_PER_RIGHT * 2;
  ui.closePanels();
  const r = await quiz.ask(unit, {
    title: t('dealTitle'),
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
        ui.toast(t('cropCollected', CROPS[r.type].emoji, NameOf(r.type), n, Object.keys(CROPS).length), 3800);
        if (n === Object.keys(CROPS).length) {
          state.school.stickers += 1;
          setTimeout(() => ui.toast(t('albumComplete'), 6000), 4000);
        }
      } else {
        ui.toast(t('harvested', CROPS[r.type].emoji, NameOf(r.type)));
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
    if (r.ok) { sfx.chop(); player.playAction('Chop'); ui.toast(t('woodToast')); ui.refresh(); }
    return r;
  }),
  mine: (i) => gated(() => {
    const r = farm.actions.mine(i);
    if (r.ok) {
      sfx.clink(); player.playAction('Pickaxe');
      ui.toast(t('mineToast', ITEM_EMOJI[r.drop], r.n, NameOf(r.drop)));
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
    if (fishing.phase === 'bite') return { kind: 'fishPress', label: t('fishNow') };
    return { kind: 'fishPress', label: t('fishWait') };
  }

  if (d2(LAYOUT.school.x, LAYOUT.school.z) < 4.2) {
    if (school.active) return { kind: 'none' };
    if (attended()) return { kind: 'info', label: t('classDoneLabel') };
    return { kind: 'school', label: t('attendClass') };
  }
  if (d2(LAYOUT.bed.x, LAYOUT.bed.z) < 2.1) {
    return { kind: 'sleep', label: t('sleepLabel') };
  }
  if (d2(LAYOUT.crate.x, LAYOUT.crate.z) < 2.4) return { kind: 'ship', label: t('sellLabel') };
  if (d2(LAYOUT.well.x, LAYOUT.well.z) < 2.2) {
    if (!attended()) return { kind: 'info', label: t('wellAfterSchool') };
    if (state.water >= BUCKET_CAP) return { kind: 'info', label: t('bucketFullLabel', state.water, BUCKET_CAP) };
    return { kind: 'well', label: t('fillBucket', state.water, BUCKET_CAP) };
  }
  if (d2(LAYOUT.shop.x, LAYOUT.shop.z) < 2.8) return { kind: 'shop', label: t('shopLabel') };

  const bi = farm.nearestBerry(p, 1.7);
  if (bi >= 0) return { kind: 'berry', i: bi, label: t('pickBerries') };

  const pi = farm.nearestPlot(p, 1.6);
  if (pi >= 0) {
    const plot = state.plots[pi];
    const lock = attended() ? '' : ' 🔒';
    if (plot.crop && plot.stage >= CROPS[plot.crop].days)
      return { kind: 'harvest', i: pi, label: t('harvestLabel', CROPS[plot.crop].emoji) + lock };
    const tool = ui.tool, seed = ui.seedType;
    if (seed && plot.tilled && !plot.crop)
      return { kind: 'plant', i: pi, t: seed, label: t('plantLabel', CROPS[seed].emoji, NameOf(seed)) + lock };
    if (seed && !plot.tilled) return { kind: 'info', label: t('tillFirst') };
    if (tool === 'shovel' && !plot.tilled) return { kind: 'till', i: pi, label: t('tillLabel') + lock };
    if (tool === 'bucket' && plot.tilled && !plot.watered) {
      if (state.water <= 0) return { kind: 'info', label: t('bucketEmptyLabel') };
      return { kind: 'water', i: pi, label: t('waterLabel', state.water, BUCKET_CAP) + lock };
    }
    if (plot.tilled && plot.watered && plot.crop) return { kind: 'info', label: t('wateredLabel') };
    if (plot.tilled && !plot.crop) return { kind: 'info', label: t('pickSeedBag') };
    return { kind: 'none' };
  }

  const hi = farm.nearestHay(p, 1.5);
  if (hi >= 0) {
    const h = state.hay[hi];
    const lock = attended() ? '' : ' 🔒';
    const tool = ui.tool;
    if (!h.cut) {
      if (tool === 'sword') return { kind: 'cutHay', i: hi, label: t('cutHayLabel') + lock };
      return { kind: 'info', label: t('hayNeedSword') };
    }
    if (!h.watered) {
      if (tool === 'bucket') {
        if (state.water <= 0) return { kind: 'info', label: t('bucketEmptyLabel') };
        return { kind: 'waterHay', i: hi, label: t('waterStubble', state.water, BUCKET_CAP) + lock };
      }
      return { kind: 'info', label: t('stubbleHint') };
    }
    return { kind: 'info', label: t('regrowsTomorrow') };
  }

  const ti = farm.nearestTree(p, 2.2);
  if (ti >= 0) {
    if (!state.tools.axe) return { kind: 'info', label: t('needAxe') };
    const lock = attended() ? '' : ' 🔒';
    return { kind: 'chop', i: ti, label: t('chopLabel') + lock };
  }

  const mi = farm.nearestMine(p, 2.2);
  if (mi >= 0) {
    if (!state.tools.pickaxe) return { kind: 'info', label: t('needPickaxe') };
    const lock = attended() ? '' : ' 🔒';
    const node = MINE_NODES[state.mine[mi].type];
    return { kind: 'mine', i: mi, label: t('mineLabel', node.emoji, NameOf(node.drop)) + lock };
  }

  // Pond edge: fish (rod selected) — pond is decor otherwise.
  if (d2(LAYOUT.pond.x, LAYOUT.pond.z) < LAYOUT.pond.r + 1.6) {
    if (!state.tools.rod) return { kind: 'info', label: t('fishJumping') };
    if (ui.tool !== 'rod') return { kind: 'info', label: t('pressRod') };
    const lock = attended() ? '' : ' 🔒';
    return { kind: 'fish', label: t('castLabel') + lock };
  }
  return { kind: 'none' };
}

function interact() {
  if (!started || ui.anyPanelOpen() || quiz.isOpen()) return;
  const tg = computeTarget();
  switch (tg.kind) {
    case 'school': startClass(); break;
    case 'sleep': doSleep(); break;
    case 'ship': ui.openShip(); break;
    case 'well': useWell(); break;
    case 'shop': ui.openShop(); break;
    case 'berry': { const r = farm.actions.pickBerry(tg.i); if (r.ok) { sfx.harvest(); ui.toast(t('berriesToast')); ui.refresh(); } break; }
    case 'harvest': act.harvest(tg.i); break;
    case 'till': act.till(tg.i); break;
    case 'plant': act.plant(tg.i, tg.t); break;
    case 'water': act.water(tg.i); break;
    case 'chop': act.chop(tg.i); break;
    case 'cutHay': act.cutHay(tg.i); break;
    case 'waterHay': act.waterHay(tg.i); break;
    case 'mine': act.mine(tg.i); break;
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
  let msg = t('classDone', sum.coins);
  if (sum.specialSeed) msg += t('rareSeed', CROPS[sum.seedAwarded].emoji);
  if (sum.sticker) msg += t('stickerToast');
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
  state.saleBonus = 0;
  state.inventory[item] -= move;
  state.coins += earned;
  sfx.coin();
  ui.toast(earned > base ? t('soldBonus', earned, earned - base) : t('sold', earned));
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
      ui.toast(type === 'goldfish' ? t('goldfishToast') : t('fishToast'), 3000);
      ui.refresh();
    },
    onMiss: () => { sfx.deny(); ui.toast(t('gotAway')); },
    onBite: () => sfx.bite(),
    toast: (m) => ui.toast(m),
  });
  school = createSchool(state, refs.blackboard, { onComplete: onClassComplete, onAnswer: (ok) => { krabsyMood = { ok, t: worldClock }; } });
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
  if (!touch) touch = createTouch(input, { onAction: () => { unlock(); interact(); } });
  started = true;
  if (!loaded && !QA_SCENE) {
    setTimeout(() => ui.toast(t('welcome'), 4200), 600);
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
      ui.bubble(BELL_POS, t('bellNag'), 2600);
    }

    // Walking away cancels a fishing session.
    if (fishing.active && (input.up || input.down || input.left || input.right)) fishing.cancel();
    fishing.tick(dt, worldClock);

    player.update(dt, input, paused || fishing.active);
    farm.update(worldClock);

    if (camMode === 'class') {
      const cz = LAYOUT.school.z;
      // Portrait screens: step back so the whole board fits.
      const back = Math.max(1, 0.8 / camera.aspect);
      camera.position.lerp(new THREE.Vector3(0, 2.5 + 1.5 * back, cz + 6.8 * back), Math.min(1, dt * 5));
      camera.lookAt(0, 2.5, cz);
    } else if (camMode !== 'qa') {
      player.updateCamera(dt);
    }

    if (!ui.anyPanelOpen() && !school.active && !quiz.isOpen()) {
      const tg = computeTarget();
      ui.prompt(tg.kind === 'none' ? null : tg.label);
      touch.setReady(tg.kind !== 'none' && tg.kind !== 'info');
      touch.setVisible(true);
    } else { ui.prompt(null); touch.setVisible(false); }

    ui.updateHUD();
    ui.projectBubble(camera);
  }

  // Ambient world animation (also behind the start screen).
  daycycle.update(state, dt);
  if (refs.sea) refs.sea.position.y = 0.04 + Math.sin(worldClock * 0.7) * 0.04;
  if (refs.krabsy) animateKrabsy(refs.krabsy.group.userData.parts, started && school.active);
  if (refs.bell && bellSwing > 0.01) {
    refs.bell.rotation.z = Math.sin(worldClock * 13) * 0.35 * bellSwing;
    bellSwing *= 0.96;
  }

  renderer.render(scene, camera);
}

// Professor Krabsy: claws wave, eye stalks sway, he blinks; livelier in class.
// After an answer in class he cheers (claws up, hop) or shakes his head.
let krabsyMood = null;
function animateKrabsy(P, excited) {
  if (!P?.body) return;
  const w = worldClock;
  const moodAge = krabsyMood ? w - krabsyMood.t : 99;
  const rest = (o) => o.userData.rest;
  const bob = Math.abs(Math.sin(w * (excited ? 5 : 1.6))) * (excited ? 0.05 : 0.02);
  const crab = P.body.parent;
  crab.position.y = bob;   // the whole crab node hops a little
  crab.rotation.x = 0;
  if (moodAge < 0.9 && krabsyMood.ok) crab.position.y += Math.sin((moodAge / 0.9) * Math.PI) * 0.35;
  const shake = moodAge < 0.9 && !krabsyMood.ok ? Math.sin(moodAge * 28) * 0.18 * (1 - moodAge / 0.9) : 0;
  crab.rotation.y = shake;   // inner model node; the wrapper already faces the bench
  const wave = excited ? 0.45 : 0.12, spd = excited ? 6 : 2;
  if (P.claw_L) P.claw_L.rotation.z = rest(P.claw_L).z + Math.sin(w * spd) * wave;
  if (P.claw_R) P.claw_R.rotation.z = rest(P.claw_R).z + Math.sin(w * spd + 1.3) * wave * (excited ? 1.2 : 0.8);
  if (moodAge < 0.9 && krabsyMood.ok) for (const c of [P.claw_L, P.claw_R]) if (c) c.rotation.z = rest(c).z + 0.9;
  if (P.stalk_L) P.stalk_L.rotation.x = rest(P.stalk_L).x + Math.sin(w * 1.1) * 0.12;
  if (P.stalk_R) P.stalk_R.rotation.x = rest(P.stalk_R).x + Math.sin(w * 1.1 + 0.8) * 0.12;
  // blink: lids close for ~0.12 s every ~3.5 s
  const blink = (w % 3.5) < 0.12;
  for (const lid of [P.lid_L, P.lid_R]) if (lid) lid.visible = blink;
  // brows lift while he teaches
  for (const b of [P.brow_L, P.brow_R]) if (b) b.position.y = (b.userData.y0 ??= b.position.y) + (excited ? 0.02 + Math.sin(w * 3) * 0.01 : 0);
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
    pos: () => [player.position.x, player.position.z],
    // QA: park the camera (x,y,z) looking at (tx,ty,tz); camView() to release.
    camAt(x, y, z, tx, ty, tz) { camMode = 'qa'; camera.position.set(x, y, z); camera.lookAt(tx, ty, tz); },
    camView() { camMode = 'follow'; },
    krabsyAt() { const v = new THREE.Vector3(); refs.krabsy.group.getWorldPosition(v); return [v.x, v.y, v.z]; },
    // QA: scale the follow-cam distance (0.4 = close-up) for screenshots
    zoom(f = 1) { player.setZoom?.(f); player.updateCamera(0, true); },
    face: (rad) => player.setFacing(rad),
    playAction: (n, o) => player.playAction(n, o),
    poseAt: (n, t) => player.poseAt(n, t),
    selectTool: (t) => ui.selectTool(t),
    startClass: (seed) => startClass(seed),
    // Question panel (all stations): answer index, skip the feedback pause.
    answer: (i) => quiz.answer(i, true),
    flush: () => quiz.flush(),
    quizOpen: () => quiz.isOpen(),
    currentStep: () => quiz.currentStep(),
    // Answer the open panel right (true) or wrong (false), then flush.
    async solve(right = true) {
      const st = quiz.currentStep();
      if (!st) return { ok: false };
      const k = st.options.indexOf(st.answer);
      const r = quiz.answer(right ? k : (k + 1) % st.options.length, true);
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
