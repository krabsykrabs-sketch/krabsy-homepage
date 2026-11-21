import * as THREE from 'three';
import { clamp, damp, segAABB } from './utils.js';
import { buildLevel, L } from './level.js';
import { Player } from './player.js';
import { Skeleton } from './skeletons.js';
import { VerbGate, RuneDoors } from './gates.js';
import { fx } from './fx.js';
import { ui, chainHTML } from './ui.js';
import { sfx } from './audio.js';
import { POOL_EASY, POOL_MEDIUM, POOL_HARD } from './verbs.js';

const BEST_KEY = 'krabsy_vdungeon_best';
const TOTAL_GATES = 5;

let renderer, scene, camera, clock, level, player, runeDoors;
const gates = {};
const skeletons = [];
let ambushSkels = [];

const state = {
  phase: 'start', // start | intro | playing | won
  t: 0, score: 0, mastered: 0, chains: [],
  usedVerbs: new Set(),
  checkpoint: { x: 0, z: -6.5 },
  best: +(localStorage.getItem(BEST_KEY) || 0),
  ambushStarted: false, ambushDone: false,
  respawning: false,
};

const timers = [];
const after = (s, fn) => timers.push({ at: state.t + s, fn });
const keys = {};
let shakeT = 0, shakeAmp = 0;
const shake = (dur, amp) => { shakeT = dur; shakeAmp = amp; };

boot();

async function boot() {
  try { await document.fonts.load('64px "Fredoka One"'); await document.fonts.ready; } catch (e) { /* fallback font is fine */ }

  renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('c'), antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x060b18);
  scene.fog = new THREE.FogExp2(0x0a1426, 0.026);

  camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 130);
  camera.position.set(0, 7, -15);

  fx.init(scene);
  level = buildLevel(scene);
  fx.addGlitterRegion(
    new THREE.Vector3(-6, 0.3, 77), new THREE.Vector3(6, 4, 91));

  player = new Player(scene);
  player.pos.set(L.start.x, 0, L.start.z);
  player.group.rotation.y = Math.PI; // facing the doors that are about to slam
  player.frozen = true;

  buildActors();
  setupInput();
  setupQA();

  ui.init({
    onStart: startGame,
    onAgain: () => location.reload(),
    onMute: () => { sfx.setMuted(!sfx.muted); ui.setMuteIcon(sfx.muted); },
  });
  ui.setMuteIcon(sfx.muted);
  ui.showStartBest(state.best);

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  clock = new THREE.Clock();
  renderer.setAnimationLoop(tick);
}

function buildActors() {
  // corridor tutorial skeleton — one bonk does it
  skeletons.push(new Skeleton(scene, {
    pos: new THREE.Vector3(0, 0, 13),
    waypoints: [{ x: 0, z: 12 }, { x: 0, z: 18.5 }],
    hp: 1,
  }));
  // ambush trio, dormant under the floor hatches
  ambushSkels = L.hatches.map(([hx, hz]) => new Skeleton(scene, {
    pos: new THREE.Vector3(hx, 0, hz),
    hp: 2, chase: true, dormant: true,
    bounds: { minX: -5.4, maxX: 5.4, minZ: 45.9, maxZ: 58.1 },
  }));
  skeletons.push(...ambushSkels);

  const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

  gates.d1 = new VerbGate(scene, level, {
    id: 'd1', kind: 'door', pos: { x: 0, z: 25 }, facing: Math.PI,
    pool: POOL_EASY, usedVerbs: state.usedVerbs,
    platePositions: [v3(-1.9, 0, 23.4), v3(0, 0, 22.7), v3(1.9, 0, 23.4)],
    onSolved: gateSolved,
  });
  gates.chest1 = new VerbGate(scene, level, {
    id: 'chest1', kind: 'chest', pos: { x: 5.1, z: 42, ry: -Math.PI / 2 }, facing: -Math.PI / 2,
    pool: POOL_MEDIUM, usedVerbs: state.usedVerbs,
    platePositions: [v3(3.1, 0, 40.4), v3(2.7, 0, 42), v3(3.1, 0, 43.6)],
    onSolved: gateSolved,
  });
  gates.d2 = new VerbGate(scene, level, {
    id: 'd2', kind: 'door', pos: { x: 0, z: 59 }, facing: Math.PI,
    pool: POOL_MEDIUM, usedVerbs: state.usedVerbs, locked: true,
    platePositions: [v3(-2.2, 0, 56.4), v3(0, 0, 55.9), v3(2.2, 0, 56.4)],
    onSolved: gateSolved,
  });
  gates.vault = new VerbGate(scene, level, {
    id: 'vault', kind: 'chest', pos: { x: 0, z: 88, ry: Math.PI }, facing: Math.PI,
    pool: POOL_HARD, usedVerbs: state.usedVerbs, double: true,
    platePositions: [v3(-2.2, 0, 85.2), v3(0, 0, 84.7), v3(2.2, 0, 85.2)],
    onSolved: gateSolved,
  });
  level.addCollider(0, 88.6, 3.6, 2.4); // treasure dais

  runeDoors = new RuneDoors(scene, level, {
    xs: L.runeX, z: L.runeZ, usedVerbs: state.usedVerbs,
    onSolved: () => {
      state.mastered++; state.score += 100;
      state.chains.push(runeDoors.challenge.verb);
      ui.setMastered(state.mastered); ui.setScore(state.score);
      ui.toast(`✨ ${chainHTML(runeDoors.challenge.verb)}`, { kind: 'good' });
    },
  });
}

function gateSolved(gate, firstTry) {
  state.mastered++;
  state.score += firstTry ? 100 : 50;
  state.chains.push(gate.challenge.verb);
  ui.setMastered(state.mastered);
  ui.toast(`✨ ${chainHTML(gate.challenge.verb)} — mastered!`, { kind: 'good' });
  if (gate.kind === 'chest') {
    state.score += 150;
    const p = new THREE.Vector3(gate.pos.x, 0.9, gate.pos.z);
    fx.coinShower(p, 14);
    after(0.5, () => fx.coinShower(p, 8));
  }
  ui.setScore(state.score);
  if (gate.id === 'vault') winSequence();
}

// ---------- the scripted intro: doors slam, torches ignite, title ----------
function startGame() {
  sfx.init();
  sfx.uiClick();
  ui.hideStart();
  ui.showHud();
  ui.setHearts(player.hearts);
  state.phase = 'intro';
  after(0.7, () => { level.closeEntrance(); sfx.rumble(0.9); });
  after(1.5, () => { sfx.slam(); shake(0.4, 0.14); fx.dustPuff(new THREE.Vector3(0, 0.5, -8.6), 14); });
  for (let i = 0; i < 8; i++) {
    after(1.9 + i * 0.3, () => {
      level.igniteTorch(i);
      sfx.whoosh();
      level.hallLight.base = (i + 1) * 8;
    });
  }
  after(2.1, () => ui.showTitle());
  after(2.6, () => { player.frozen = false; });
  after(3.6, () => { state.phase = 'playing'; });
  after(5.8, () => ui.hint('Explore! WASD / arrows to move'));
}

// ---------- one-shot story triggers along the dungeon's z axis ----------
const triggers = [
  { z: 9.2, fn: () => { setCheckpoint(0, 10.5); ui.hint('A skeleton! Press SPACE to bonk 💥', 5000); } },
  { z: 21.2, fn: () => { setCheckpoint(0, 22.5); ui.hint('Walk into the correct word to open the door! 🪨', 5200); } },
  { z: 25.7, fn: () => { setCheckpoint(0, 27); ui.toast('Mind the gap… 🌫️', { dur: 2400 }); } },
  { z: 39.9, fn: () => setCheckpoint(0, 41) },
  { z: 45.7, fn: () => setCheckpoint(0, 46.5) },
  { z: 48, fn: startAmbush },
  { z: 59.7, fn: () => { setCheckpoint(0, 60.5); ui.toast('Three doors… only the true chain opens 🔮', { dur: 3200 }); } },
  { z: 76.3, fn: () => { setCheckpoint(0, 77.5); ui.toast('The treasure vault! ✨', { dur: 2600 }); } },
];

function setCheckpoint(x, z) {
  state.checkpoint = { x, z };
  if (player.hearts < 3) { player.hearts = 3; ui.setHearts(3); }
}

function startAmbush() {
  state.ambushStarted = true;
  level.slamAmbushDoor();
  sfx.slam();
  sfx.sting();
  shake(0.5, 0.16);
  ui.toast('Ambush! 💀💀💀', { dur: 2200, kind: 'bad' });
  ui.showSkelCounter(3);
  ambushSkels.forEach((s, i) => {
    after(0.25 + i * 0.22, () => { level.openHatch(i); fx.dustPuff(new THREE.Vector3(s.home.x, 0, s.home.z), 8); });
    after(0.45 + i * 0.22, () => s.rise());
  });
}

function checkAmbush() {
  if (!state.ambushStarted || state.ambushDone) return;
  const left = ambushSkels.filter((s) => s.state !== 'collapsed' && s.state !== 'collapsing').length;
  ui.setSkelCounter(left);
  if (left === 0) {
    state.ambushDone = true;
    ui.hideSkelCounter();
    level.openAmbushDoor();
    gates.d2.unlock();
    ui.toast('The spooky magic fades! ✨', { dur: 2800, kind: 'good' });
    // once beaten, the trio comes back sheepish and harmless-ish — no more chasing
    for (const s of ambushSkels) { s.chase = false; s.waypoints = null; }
  }
}

function winSequence() {
  state.phase = 'won';
  player.frozen = true;
  after(0.3, () => fx.coinShower(new THREE.Vector3(0, 1.4, 88), 12));
  after(1.2, () => sfx.fanfare());
  after(2.3, () => {
    if (state.score > state.best) {
      state.best = state.score;
      localStorage.setItem(BEST_KEY, state.best);
    }
    ui.showWin({ score: state.score, best: state.best, chains: state.chains });
  });
}

// ---------- defeat / falling ----------
function defeat() {
  if (state.respawning) return;
  state.respawning = true;
  player.frozen = true;
  fx.dizzyStars(player.group, 1.5);
  after(1.1, () => ui.fade(true));
  after(1.6, () => {
    player.respawn(state.checkpoint);
    player.hearts = 3;
    ui.setHearts(3);
    ui.fade(false);
    ui.toast('Ouch! Try again! 💫', { dur: 2200 });
    player.frozen = false;
    state.respawning = false;
  });
}

function fellInChasm() {
  if (state.respawning) return;
  state.respawning = true;
  after(0.5, () => ui.fade(true));
  after(1.0, () => {
    player.respawn({ x: 0, z: 29.8 });
    ui.fade(false);
    fx.dizzyStars(player.group, 1.5);
    ui.toast('Wooooah! That fog is deep… 💫', { dur: 2200 });
    state.respawning = false;
  });
}

// ---------- input ----------
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

function setupInput() {
  addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys[e.code] = true;
    if (e.code === 'Space') { e.preventDefault(); doBonk(); }
    if (e.code === 'KeyM') { sfx.setMuted(!sfx.muted); ui.setMuteIcon(sfx.muted); }
  });
  addEventListener('keyup', (e) => { keys[e.code] = false; });

  renderer.domElement.addEventListener('pointerdown', (e) => {
    if (state.phase !== 'playing') return;
    pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    for (const g of Object.values(gates)) {
      const i = g.plates.raycastIndex(raycaster);
      if (i >= 0) { g.choose(i); return; }
    }
    doBonk();
  });
}

function doBonk() {
  if (state.phase !== 'playing') return;
  player.tryBonk();
}

function moveInput() {
  const ix = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  const iy = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  if (!ix && !iy) return { x: 0, y: 0 };
  // camera-relative on the ground plane
  const fwd = new THREE.Vector3().subVectors(player.pos, camera.position).setY(0).normalize();
  const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0));
  const len = Math.hypot(ix, iy) || 1;
  return {
    x: (fwd.x * iy + right.x * ix) / len,
    y: (fwd.z * iy + right.z * ix) / len,
  };
}

// ---------- camera ----------
const camTarget = new THREE.Vector3();
const lookTarget = new THREE.Vector3();

function updateCamera(dt) {
  if (state.phase === 'intro') {
    // title beat: low camera looking back at the hero and the slamming doors
    camTarget.set(0, 2.6, player.pos.z + 4.6);
    camera.position.x = damp(camera.position.x, camTarget.x, 3, dt);
    camera.position.y = damp(camera.position.y, camTarget.y, 3, dt);
    camera.position.z = damp(camera.position.z, camTarget.z, 3, dt);
    lookTarget.set(0, 1.6, -9);
    camera.lookAt(lookTarget);
    return;
  }
  const cx = player.pos.x * 0.85; // bias toward the corridor center line
  const cz = player.pos.z - 5.8;
  // crane up just enough to see over any full-height wall (and its door frame)
  // between camera and hero
  let cy = 6.6;
  for (const c of level.colliders) {
    if (!c.tall || c.off) continue;
    const f = segAABB(cx, cz, player.pos.x, player.pos.z, c);
    if (f >= 0.92) continue;
    const need = (6.2 - 1.4 * f) / (1 - f);
    if (need > cy) cy = Math.min(need, 13);
  }
  camTarget.set(cx, player.pos.y + cy, cz);
  camera.position.x = damp(camera.position.x, camTarget.x, 4, dt);
  camera.position.y = damp(camera.position.y, camTarget.y, 4, dt);
  camera.position.z = damp(camera.position.z, camTarget.z, 4, dt);
  lookTarget.set(
    player.pos.x + player.vel.x * 0.22,
    player.pos.y + 1.2,
    player.pos.z + 1.2 + player.vel.z * 0.22);
  if (shakeT > 0) {
    shakeT -= dt;
    const a = shakeAmp * (shakeT > 0 ? shakeT : 0);
    camera.position.x += (Math.random() - 0.5) * a * 8;
    camera.position.y += (Math.random() - 0.5) * a * 8;
  }
  camera.lookAt(lookTarget);
}

// ---------- main loop ----------
function tick() {
  step(clamp(clock.getDelta(), 0.0001, 0.05));
}

function step(dt) {
  state.t += dt;
  const t = state.t;

  // scheduled beats
  for (let i = timers.length - 1; i >= 0; i--) {
    if (timers[i].at <= t) {
      const fn = timers[i].fn;
      timers.splice(i, 1);
      fn();
    }
  }

  level.update(dt, t);
  fx.update(dt, t);

  if (state.phase === 'intro' || state.phase === 'playing' || state.phase === 'won') {
    const move = state.phase !== 'won' ? moveInput() : { x: 0, y: 0 };
    const pEvents = player.update(dt, t, move, level);
    for (const ev of pEvents) {
      if (ev.type === 'fellOut') fellInChasm();
    }

    // bonk impact: anything rattly in front gets it
    if (player.consumeHitWindow()) {
      const fwd = { x: Math.sin(player.facing), z: Math.cos(player.facing) };
      let hitSomething = false;
      for (const s of skeletons) {
        if (!s.active) continue;
        const dx = s.pos.x - player.pos.x, dz = s.pos.z - player.pos.z;
        const d = Math.hypot(dx, dz);
        if (d > 1.6) continue;
        if ((dx * fwd.x + dz * fwd.z) / (d || 1) < 0.2) continue;
        const res = s.hit(player.pos);
        if (res) {
          hitSomething = true;
          sfx.bonk();
          const sc = toScreen(new THREE.Vector3(s.pos.x, 1.4, s.pos.z));
          ui.pop(sc.x, sc.y, 'BONK!', '#ffcf5e');
          fx.burst(new THREE.Vector3(s.pos.x, 1.1, s.pos.z), { color: 0xfff3c8, n: 8, speed: 2 });
          if (res === 'collapsed') {
            state.score += 25;
            ui.setScore(state.score);
            after(0.6, () => {
              const sc2 = toScreen(new THREE.Vector3(s.pos.x, 1, s.pos.z));
              ui.pop(sc2.x, sc2.y, 'scared away!', '#2ee6c0');
            });
          }
        }
      }
      if (hitSomething) shake(0.15, 0.05);
    }

    for (const s of skeletons) {
      const sEvents = s.update(dt, t, player, level);
      for (const ev of sEvents) {
        if (ev.type === 'touch' && !state.respawning && state.phase === 'playing') {
          const hearts = player.takeHit(s.pos);
          ui.setHearts(hearts);
          const sc = toScreen(new THREE.Vector3(player.pos.x, 1.6, player.pos.z));
          ui.pop(sc.x, sc.y, 'Ouch!', '#ff8585');
          shake(0.25, 0.08);
          if (hearts <= 0) defeat();
        }
      }
    }

    if (state.phase === 'playing') {
      for (const g of Object.values(gates)) g.update(dt, t, player);
      runeDoors.update(dt, t, player);
      for (const tr of triggers) {
        if (!tr.done && player.pos.z > tr.z) { tr.done = true; tr.fn(); }
      }
      checkAmbush();
    }
  }

  updateCamera(dt);
  renderer.render(scene, camera);
}

function toScreen(v) {
  const p = v.project(camera);
  return { x: (p.x * 0.5 + 0.5) * innerWidth, y: (-p.y * 0.5 + 0.5) * innerHeight };
}

// ---------- QA hook (drives a full programmatic run) ----------
function setupQA() {
  window.__VD = {
    state: () => ({
      phase: state.phase, score: state.score, mastered: state.mastered,
      hearts: player.hearts, pos: { x: +player.pos.x.toFixed(2), z: +player.pos.z.toFixed(2) },
      checkpoint: state.checkpoint,
      ambush: { started: state.ambushStarted, done: state.ambushDone },
      gates: Object.fromEntries(Object.entries(gates).map(([k, g]) => [k, g.state])),
      rune: runeDoors ? { solved: runeDoors.solved } : null,
      skeletons: skeletons.map((s) => s.state),
      chains: state.chains.map((c) => c.v),
    }),
    start: () => { if (state.phase === 'start') startGame(); },
    teleport: (x, z) => { player.respawn({ x, z }); },
    solve: (id) => {
      if (id === 'rune') {
        const d = runeDoors.doors.find((dd) => dd.chain.correct);
        if (!d.tried) {
          d.tried = true; d.opening = true; d.t = 0;
          runeDoors.solved = true;
          runeDoors.onSolved(runeDoors);
        }
      } else gates[id].forceSolve();
    },
    answer: (id, correct = true) => {
      const g = gates[id];
      const i = g.challenge.options.findIndex((o) => o.correct === correct);
      g.choose(i);
    },
    bonkAmbush: () => ambushSkels.forEach((s) => { s.hit(player.pos); s.hit(player.pos); }),
    // headless helpers: advance the sim with a fixed timestep / grab a frame
    step: (frames = 1, dt = 1 / 60) => { for (let i = 0; i < frames; i++) step(dt); },
    keys,
    shot: (w = 880) => {
      renderer.render(scene, camera);
      const src = renderer.domElement;
      const c = document.createElement('canvas');
      c.width = w; c.height = Math.round(w * src.height / src.width);
      c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', 0.82);
    },
    gates, skeletons, player, level, runeDoors: () => runeDoors,
    renderer: () => renderer, scene: () => scene, camera: () => camera,
  };
}
