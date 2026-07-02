// Krabsy Tower — a cozy build-and-grow tycoon layered on the diorama.
// Build rooms (cost coins) → tenants move in → occupied rooms earn coins →
// spend coins to expand → hit population milestones to level up. No fail state.
// A "Free build" toggle drops back to the sandbox author mode (no economy).
import { CONFIG } from './config.js';
import { audio, unlockAudio } from './audio.js';
import { createSlotPicker } from './slots.js';
import { CHAR_EMOJI } from './character.js';
import { planTrip, ElevatorManager, elevatorFor } from './commute.js';
import { pickQuestion } from './questions.js';

// Resident wants — one per resident; met/unmet drives happiness + rent.
const WANTS = {
  sofa:     { icon: '🛋️', label: 'a sofa to relax on', met: (r, ctx) => ctx.roomIsApartment(r.key) },
  quiet:    { icon: '🤫', label: 'a quiet floor (no office)', met: (r, ctx) => !ctx.floorHasOffice(r.floor) },
  cafe:     { icon: '☕', label: 'a café nearby', met: (r, ctx) => ctx.amenityNear('cafe', r.floor) },
  pizza:    { icon: '🍕', label: 'a pizzeria nearby', met: (r, ctx) => ctx.amenityNear('pizzeria', r.floor) },
  icecream: { icon: '🍦', label: 'ice cream nearby', met: (r, ctx) => ctx.amenityNear('icecream', r.floor) },
};
const WANT_BY_TYPE = { Ranger: 'sofa', Rogue: 'sofa', Knight: 'quiet', Mage: 'cafe' };
// each class rolls one of two possible wants on move-in (variety + new tradeoffs)
const WANT_POOLS = { Ranger: ['sofa', 'icecream'], Rogue: ['sofa', 'pizza'], Knight: ['quiet', 'icecream'], Mage: ['cafe', 'pizza'] };
const rollWant = (type) => { const p = WANT_POOLS[type] || ['sofa']; return p[Math.floor(Math.random() * p.length)]; };
const MOOD_FACE = { happy: '😊', meh: '😐', leaving: '😟' };

// Soft milestones — gentle direction tied to the level bar (no fail).
const MILESTONES = [
  { id: 'house5', label: 'House 5 residents',        reward: 15, check: (a) => a.population >= 5,     prog: (a) => `${Math.min(a.population, 5)}/5` },
  { id: 'cafe',   label: 'Build a café ☕',           reward: 20, check: (a) => a.hasCafe(),           prog: (a) => (a.hasCafe() ? '✓' : 'not yet') },
  { id: 'happy8', label: 'Keep 8 residents happy',   reward: 25, check: (a) => a.happyCount() >= 8,   prog: (a) => `${a.happyCount()}/8` },
  { id: 'grow12', label: 'Grow to 12 residents',     reward: 30, check: (a) => a.population >= 12,    prog: (a) => `${Math.min(a.population, 12)}/12` },
];

export function createGame(tower, deps) {
  const { THREE, scene, camera, renderer, spawnOne, removeOne, detachToWorld, attachToRoom, deriveWaypoints } = deps;
  const G = CONFIG.GAME;
  let elevatorMgr = null;
  let commuteScanT = 0;

  const state = { coins: G.START_COINS, population: 0, level: 0, goalIdx: 0, running: false };
  const residents = [];         // { id, key, floor, char, type, want, mood, unhappyT, grumbleT }
  let residentSeq = 0;
  let started = false;          // guards saveGame until start() has restored/seeded
  let saveT = 4;                // autosave cadence (coins tick along without events)
  let questionT = G.QUESTION.FIRST_DELAY;   // countdown to the next resident 💬
  const roomType = new Map();   // "f:c" → roomId
  const earnT = new Map();      // "f:c" → income timer
  const pops = [];              // furniture build-pop tweens
  let moveT = G.MOVE_IN_INTERVAL;
  let lastCoinSfx = 0;
  let elapsed = 0;
  let milestoneIdx = 0;
  let milestoneT = 0;
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  const key = (c, f) => f + ':' + c;
  const costFor = (id) => id === 'elevator' ? CONFIG.CIRCULATION.ELEVATOR_COST : (G.COST[id] ?? G.COST._default);
  const earnFor = (id) => G.EARN[id] ?? G.EARN._default;
  const maxOcc = (id) => G.MAX_OCC[id] ?? G.MAX_OCC._default;
  const nextGoal = () => G.GOALS[Math.min(state.goalIdx, G.GOALS.length - 1)];
  const occCount = (k) => residents.reduce((n, r) => n + (r.key === k ? 1 : 0), 0);

  // want-evaluation context (recomputed when checking moods)
  function buildCtx() {
    const offices = new Set(), apartments = new Set();
    const amenityFloors = { cafe: new Set(), pizzeria: new Set(), icecream: new Set() };
    for (const r of tower.built.rooms) {
      if (r.roomId === 'SimOffice' || r.roomId === 'office3') offices.add(r.floor);
      if (r.roomId === 'simroom1') apartments.add(key(r.col, r.floor));
      if (amenityFloors[r.roomId]) amenityFloors[r.roomId].add(r.floor);
    }
    return {
      roomIsApartment: (k) => apartments.has(k),
      floorHasOffice: (f) => offices.has(f),
      amenityNear: (id, f) => { const s = amenityFloors[id]; return !!s && (s.has(f) || s.has(f - 1) || s.has(f + 1)); },
    };
  }
  const wantMet = (r, ctx) => WANTS[r.want].met(r, ctx);

  tower.brush = null;   // no build tool selected by default → clean view, no ghosts

  // ── DOM (top HUD + left dock + floating coins + toast) ─────────────────
  injectStyles();
  const hud = el('div', 'gHud'); document.body.appendChild(hud);
  hud.innerHTML = `
    <div class="gStat"><span class="gIco">🪙</span><span id="gCoins">0</span></div>
    <div class="gStat"><span class="gIco">👥</span><span id="gPop">0</span></div>
    <div class="gStat gLvl"><span class="gIco">⭐</span><span>Lv <span id="gLvl">1</span></span>
      <div class="gBar"><div class="gBarFill" id="gBarFill"></div></div>
      <span class="gGoal" id="gGoal"></span></div>`;
  const $coins = hud.querySelector('#gCoins'), $pop = hud.querySelector('#gPop'),
        $lvl = hud.querySelector('#gLvl'), $bar = hud.querySelector('#gBarFill'), $goal = hud.querySelector('#gGoal');
  const goalBanner = el('div', 'gGoalBanner'); document.body.appendChild(goalBanner);

  const dock = el('div', 'gDock'); document.body.appendChild(dock);
  dock.innerHTML = `
    <div class="gHead">🏙️ Krabsy Tower</div>
    <div class="gHint">Pick a tool below: <b style="color:#ffcf5e">🏗️ Expand</b> to add floor space 🪙${CONFIG.GAME.LOT_COST}, then a <b style="color:#2ee6c0">room</b> to build into it. Click empty space to put the tool down.</div>
    <div class="gSec">Build a room</div>
    <div class="gPalette" id="gPalette"></div>
    <label class="gFree"><input type="checkbox" id="gFreeBuild"> Free build (sandbox)</label>
    <div class="gExtra" id="gExtra"></div>`;
  const paletteEl = dock.querySelector('#gPalette');
  const extraEl = dock.querySelector('#gExtra');
  const freeChk = dock.querySelector('#gFreeBuild');

  const toast = el('div', 'gToast'); document.body.appendChild(toast);
  const floatLayer = el('div', 'gFloats'); document.body.appendChild(floatLayer);
  const card = el('div', 'gCard'); document.body.appendChild(card);
  const quiz = el('div', 'gQuiz'); document.body.appendChild(quiz);
  let homeBtn = null;
  if (deps.rig) {
    homeBtn = el('button', 'gHomeBtn', '⌂');
    homeBtn.title = 'Reset view';
    homeBtn.onclick = () => deps.rig.resetView();
    document.body.appendChild(homeBtn);
  }

  const picker = createSlotPicker(tower, { THREE, scene, camera, renderer, onPick: onSlotClick });
  // click a resident → their quiz (if pending) or want card; a ghost → build;
  // empty space → close cards + drop the tool
  const handleClick = (ev) => {
    const res = pickResident(ev);
    if (res) { if (res.question) showQuiz(res); else showResidentCard(res); return; }
    hideCard(); hideQuiz();
    const hit = picker.clickAt(ev);
    if (!hit && tower.brush) deselectBrush();
  };
  if (deps.rig) { deps.rig.onClick = handleClick; deps.rig.onHover = (ev) => picker.hoverAt(ev); }
  else { renderer.domElement.addEventListener('pointerdown', handleClick); renderer.domElement.addEventListener('pointermove', (ev) => picker.hoverAt(ev)); }

  // ── room registry sync (keeps type/earn + residents in step with layout) ─
  function syncRooms() {
    const live = new Set();
    for (const r of tower.built.rooms) {
      const k = key(r.col, r.floor); live.add(k);
      roomType.set(k, r.roomId);
      if (!earnT.has(k)) earnT.set(k, G.EARN_INTERVAL * Math.random());
    }
    for (const k of [...roomType.keys()]) if (!live.has(k)) { roomType.delete(k); earnT.delete(k); }
    // drop residents whose room no longer exists (their char is gone with the rebuild)
    for (let i = residents.length - 1; i >= 0; i--) if (!live.has(residents[i].key)) residents.splice(i, 1);
    recountPop();
  }
  function recountPop() { state.population = residents.length; }
  function roomAt(c, f) { return tower.built.rooms.find((r) => r.col === c && r.floor === f); }

  // ── tower hooks (called from tower.rebuild) ────────────────────────────
  // After a structural rebuild the character objects are gone — re-create one
  // per existing resident and re-link it (residents are the persistent identity).
  function repopulate(rooms) {
    if (tower.freeBuild) return;                  // sandbox: empty rooms
    for (const r of rooms) {
      const k = key(r.col, r.floor);
      for (const res of residents) {
        if (res.key !== k) continue;
        res.char = spawnOne(r, { bounce: false });   // fresh char, back home
        res.traveling = false; res.atKey = res.key; res.atHome = true;
        if (res.char) res.char.obj.userData.resident = res;
      }
    }
  }
  function onRebuilt() { elevatorMgr = new ElevatorManager(tower.built); syncRooms(); picker.refresh(); updateHud(); updateDock(); saveGame(); }

  // ── game save (localStorage) — the tower survives a refresh ─────────────
  const GS_KEY = 'simtower.game';
  let ephemeral = false;   // ?lots= QA sessions never overwrite the player's save
  function saveGame() {
    if (!started || ephemeral || tower.freeBuild || !tower.gameActive) return;
    try {
      localStorage.setItem(GS_KEY, JSON.stringify({
        lots: [...tower.lots.entries()], elevators: [...tower.elevators],
        coins: Math.floor(state.coins), level: state.level, goalIdx: state.goalIdx, milestoneIdx,
        residents: residents.map((r) => ({ key: r.key, type: r.type, want: r.want })),
      }));
    } catch (_) {}
  }
  function clearSave() { try { localStorage.removeItem(GS_KEY); } catch (_) {} }

  // ── commute (residents travel between floors via the elevator) ──────────
  const roomByKey = (k) => tower.built.rooms.find((r) => key(r.col, r.floor) === k);
  const floorOf = (k) => +k.slice(0, k.indexOf(':'));
  const colOf = (k) => +k.slice(k.indexOf(':') + 1);
  const randCommuteDelay = () => CONFIG.CIRCULATION ? (CC().COMMUTE_MIN + Math.random() * (CC().COMMUTE_MAX - CC().COMMUTE_MIN)) : 12;
  function CC() { return CONFIG.CIRCULATION; }

  function pickDestination(res) {
    const curF = floorOf(res.atKey || res.key);
    // prefer offices/cafés on another reachable floor (work/errand)
    const cands = tower.built.rooms.filter((r) => {
      if (r.floor === curF) return false;
      const k = key(r.col, r.floor);
      if (k === res.key) return false;
      return !!planTrip(tower.built, curF, colOf(res.atKey || res.key), r.floor, r.col);
    });
    if (!cands.length) return null;
    const DEST = new Set(['SimOffice', 'office3', 'cafe', 'pizzeria', 'icecream']);
    const work = cands.filter((r) => DEST.has(r.roomId));
    const pool = work.length ? work : cands;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function startCommute(res, destRoom, goingHome) {
    const fromKey = res.atKey || res.key;
    const plan = planTrip(tower.built, floorOf(fromKey), colOf(fromKey), destRoom.floor, destRoom.col);
    if (!plan || !res.char) return false;
    res.traveling = true;
    detachToWorld(res.char);
    res.char.onElevatorRequest = (c) => elevatorMgr && elevatorMgr.request(c);
    res.char.startCommute({ ...plan, onArrive: () => onCommuteArrive(res, destRoom, goingHome) });
    return true;
  }

  function onCommuteArrive(res, destRoom, goingHome) {
    const room = roomByKey(key(destRoom.col, destRoom.floor)) || destRoom;
    if (res.char) {
      attachToRoom(res.char, room);
      const { waypoints, nav } = deriveWaypoints(room);
      res.char.waypoints = waypoints; res.char.nav = nav;
      res.char.wi = 0; res.char.state = 'perform'; res.char.timer = 1 + Math.random() * 2;
      res.char.path = null; res.char.bfsCells = null; res.char.parkedApproach = null; res.char.commute = null;
    }
    res.atKey = key(destRoom.col, destRoom.floor);
    res.atHome = goingHome;
    res.traveling = false;
    res.commuteT = goingHome ? randCommuteDelay() : (CC().VISIT_MIN + Math.random() * (CC().VISIT_MAX - CC().VISIT_MIN));
  }

  function updateCommutes(dt) {
    if (elevatorMgr) elevatorMgr.update(dt);
    commuteScanT -= dt;
    if (commuteScanT > 0) return;
    commuteScanT = 0.5;
    for (const res of residents) {
      if (res.traveling || !res.char) continue;
      if (res.atKey === undefined) { res.atKey = res.key; res.atHome = true; }
      res.commuteT = (res.commuteT ?? randCommuteDelay()) - 0.5;
      if (res.commuteT > 0) continue;
      if (res.atHome) {
        const dest = pickDestination(res);
        if (dest) { startCommute(res, dest, false); } else { res.commuteT = randCommuteDelay(); }
      } else {
        const home = roomByKey(res.key);
        if (home) startCommute(res, home, true); else { res.atHome = true; res.atKey = res.key; res.commuteT = randCommuteDelay(); }
      }
    }
  }

  // ── actions ────────────────────────────────────────────────────────────
  // kind 'buy' = buy floor space on the frontier; kind 'lot' = build/clear a room.
  async function onSlotClick(c, f, kind, content) {
    if (kind === 'buy') return buyLot(c, f);
    if (tower.brush === 'elevator') return buildElevatorAt(c);
    // an existing lot:
    if (tower.freeBuild) {
      await tower.setRoom(c, f, tower.brush === 'erase' ? null : tower.brush);
      if (tower.brush !== 'erase') popRoom(c, f);
      return;
    }
    if (content) return;                          // already has a room — nothing to build
    const id = tower.brush;
    const cost = costFor(id);
    if (state.coins < cost) { audio.nope(); flashCoins(); return; }
    state.coins -= cost;
    await tower.setRoom(c, f, id);                // rebuild → onRebuilt → syncRooms
    audio.build();
    popRoom(c, f);
    updateHud();
  }

  async function buyLot(c, f) {
    if (!tower.canBuy(c, f)) return;
    if (!tower.freeBuild) {
      if (state.coins < G.LOT_COST) { audio.nope(); flashCoins(); return; }
      state.coins -= G.LOT_COST;
    }
    await tower.buyLot(c, f);
    audio.build();
    updateHud();
  }

  async function buildElevatorAt(c) {
    if (!tower.canElevator(c)) { audio.nope(); showToast('That column already has a lift (or no floors yet).'); return; }
    const cost = costFor('elevator');
    if (!tower.freeBuild && state.coins < cost) { audio.nope(); flashCoins(); return; }
    if (!tower.freeBuild) state.coins -= cost;
    await tower.buildElevator(c);
    audio.build();
    updateHud();
  }

  function setFreeBuild(on) {
    tower.freeBuild = on;
    state.running = !on;
    tower.rebuild();                               // add/remove tenants
    updateDock();
  }

  function tryMoveIn() {
    const cands = tower.built.rooms.filter((r) => occCount(key(r.col, r.floor)) < maxOcc(roomType.get(key(r.col, r.floor))));
    if (!cands.length) return;
    const r = cands[Math.floor((elapsed * 7.3) % cands.length)];   // deterministic-ish pick
    const char = spawnOne(r, { bounce: true });
    const type = char ? char.typeName : 'Rogue';
    const res = { id: residentSeq++, key: key(r.col, r.floor), floor: r.floor, char, type, want: rollWant(type), mood: 'happy', unhappyT: 0, grumbleT: 0 };
    residents.push(res);
    if (char) char.obj.userData.resident = res;
    recountPop();
    audio.moveIn();
    floatAt(r, '+1 👤', '#9fe6ff');
    checkGoal();
    saveGame();
  }

  function moveOut(res) {
    const i = residents.indexOf(res);
    if (i < 0) return;
    residents.splice(i, 1);
    if (res.char) { floatAtChar(res.char, '👋 bye', '#ff8585'); removeOne(res.char); }
    recountPop();
    if (cardRes === res) hideCard();
    if (quizRes === res) hideQuiz();
    saveGame();
  }

  // re-evaluate every resident's want → mood (happy/meh/leaving) → eventual move-out
  function updateMoods(dt) {
    const ctx = buildCtx();
    for (let i = residents.length - 1; i >= 0; i--) {
      const r = residents[i];
      if (r.traveling) continue;                       // don't grumble / move out mid-commute
      // stranded: no route to the ground floor. Mirrors planTrip: stairs cover a
      // ONE-floor hop, an elevator spans its column — floor 1 with stairs is fine.
      const rf = floorOf(r.key);
      r.stranded = rf > 0 && !elevatorFor(tower.built, rf, 0)
        && !(rf === 1 && (tower.built.circ?.stairs || []).some((s) => s.f === 0));
      if (wantMet(r, ctx) && !r.stranded) { r.unhappyT = 0; r.mood = 'happy'; }
      else {
        r.unhappyT += dt;
        r.mood = r.unhappyT >= G.LEAVE_TIME ? 'leaving' : 'meh';
        if (r.unhappyT >= G.MOVEOUT_TIME) { moveOut(r); continue; }
        // occasional grumble float so unhappiness is visible without clicking
        r.grumbleT -= dt;
        if (r.grumbleT <= 0 && r.char) { r.grumbleT = G.GRUMBLE_INTERVAL * (0.8 + 0.4 * ((r.id * 0.31) % 1)); floatAtChar(r.char, r.mood === 'leaving' ? '😟' : '💢', '#ffb4b4'); }
      }
    }
    if (cardRes) refreshCard();
  }

  // ── resident pick + card ────────────────────────────────────────────────
  function pickResident(ev) {
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const objs = residents.map((r) => r.char && r.char.obj).filter(Boolean);
    const hits = raycaster.intersectObjects(objs, true);
    if (!hits.length) return null;
    let o = hits[0].object;
    while (o && !o.userData.resident) o = o.parent;
    return o ? o.userData.resident : null;
  }
  let cardRes = null;
  function showResidentCard(res) { cardRes = res; refreshCard(); card.classList.add('show'); }
  function hideCard() { cardRes = null; card.classList.remove('show'); }
  function refreshCard() {
    const res = cardRes; if (!res) return;
    const ctx = buildCtx();
    const met = wantMet(res, ctx);
    const w = WANTS[res.want];
    card.innerHTML =
      `<div class="gCardHead">${CHAR_EMOJI[res.type] || '🙂'} ${res.type}</div>` +
      `<div class="gCardWant">Wants: <b>${w.icon} ${w.label}</b></div>` +
      `<div class="gCardMood m-${res.mood}">${MOOD_FACE[res.mood]} ${res.mood}` +
      `<span class="gCardMet">${met ? '✓ satisfied' : '✗ not yet'}</span></div>`;
    if (res.char) {
      const wp = res.char.obj.getWorldPosition(new THREE.Vector3()); wp.y += 2.2;
      const p = wp.project(camera);
      const rect = renderer.domElement.getBoundingClientRect();
      card.style.left = (rect.left + (p.x * 0.5 + 0.5) * rect.width) + 'px';
      card.style.top = (rect.top + (-p.y * 0.5 + 0.5) * rect.height) + 'px';
    }
  }

  // ── resident 💬 quiz (the learning hook) ────────────────────────────────
  // Every so often a resident raises a question bubble; click them → a sentence
  // gap / verb chain with three chips. Correct → tip coins + instant happy.
  let quizRes = null;
  function updateQuestions(dt) {
    const QU = G.QUESTION;
    questionT -= dt;
    if (questionT <= 0) {
      questionT = QU.INTERVAL_MIN + Math.random() * (QU.INTERVAL_MAX - QU.INTERVAL_MIN);
      const cands = residents.filter((r) => r.char && !r.question);
      if (cands.length) {
        const r = cands[Math.floor(Math.random() * cands.length)];
        r.question = pickQuestion();
        r.qBubbleT = 0;
      }
    }
    for (const r of residents) {
      if (!r.question || !r.char) continue;
      r.qBubbleT = (r.qBubbleT ?? 0) - dt;
      if (r.qBubbleT <= 0) { r.qBubbleT = QU.BUBBLE_EVERY; floatAtChar(r.char, '💬', '#9fe6ff'); }
    }
  }
  function showQuiz(res) {
    quizRes = res;
    const q = res.question;
    quiz.innerHTML =
      `<div class="gQzWho">${CHAR_EMOJI[res.type] || '🙂'} ${res.type} asks:</div>` +
      `<div class="gQzText">${q.text.replace('___', '<b class="gQzGap">___</b>')}</div>` +
      `<div class="gQzChips">${q.options.map((o) => `<button class="gQzChip" data-o="${o}">${o}</button>`).join('')}</div>`;
    for (const b of quiz.querySelectorAll('.gQzChip')) b.onclick = (ev) => { ev.stopPropagation(); answerQuiz(res, b); };
    quiz.classList.add('show');
  }
  function hideQuiz() { quizRes = null; quiz.classList.remove('show'); }
  function answerQuiz(res, btn) {
    const q = res.question;
    if (!q || res !== quizRes) return;
    const ok = btn.dataset.o === q.answer;
    for (const b of quiz.querySelectorAll('.gQzChip')) b.disabled = true;
    btn.classList.add(ok ? 'gQzGood' : 'gQzBad');
    if (ok) {
      audio.coin();
      state.coins += G.QUESTION.REWARD;
      res.unhappyT = 0; res.mood = 'happy';
      if (res.char) floatAtChar(res.char, `+${G.QUESTION.REWARD} 🪙`, '#ffcf5e');
      updateHud();
    } else {
      audio.nope();
      const right = [...quiz.querySelectorAll('.gQzChip')].find((b) => b.dataset.o === q.answer);
      if (right) right.classList.add('gQzGood');
      if (q.cap) quiz.insertAdjacentHTML('beforeend', `<div class="gQzCap">${q.cap}</div>`);
    }
    res.question = null;
    saveGame();
    setTimeout(() => { if (!quizRes || quizRes === res) hideQuiz(); }, ok ? 750 : 1900);
  }

  function checkGoal() {
    while (state.goalIdx < G.GOALS.length && state.population >= G.GOALS[state.goalIdx]) {
      state.goalIdx++;
      state.level++;
      state.coins += G.GOAL_BONUS;
      audio.levelUp();
      showToast(`⭐ Level ${state.level + 1}!  +${G.GOAL_BONUS} 🪙`);
    }
  }

  // ── soft milestones (named goals for direction) ──────────────────────────
  function milestoneApi() {
    return {
      population: state.population,
      hasCafe: () => tower.built.rooms.some((r) => r.roomId === 'cafe'),
      happyCount: () => residents.filter((r) => r.mood === 'happy').length,
    };
  }
  function checkMilestones() {
    const api = milestoneApi();
    while (milestoneIdx < MILESTONES.length && MILESTONES[milestoneIdx].check(api)) {
      const m = MILESTONES[milestoneIdx];
      milestoneIdx++;
      state.coins += m.reward;
      audio.levelUp();
      showToast(`🎯 Goal done: ${m.label}  +${m.reward} 🪙`);
    }
    updateGoalBanner();
  }
  function updateGoalBanner() {
    if (milestoneIdx >= MILESTONES.length) { goalBanner.innerHTML = '🏆 <b>All goals complete!</b>'; goalBanner.classList.add('gDone'); return; }
    const m = MILESTONES[milestoneIdx];
    goalBanner.innerHTML = `📋 <b>${m.label}</b> <span class="gGoalProg">${m.prog(milestoneApi())}</span>`;
  }

  // reveal-on-occupancy: fade a unit's front wall out when someone's physically
  // home (or in sandbox, always show interiors); opaque when vacant.
  function updateReveals(dt) {
    if (!tower.built) return;
    const home = new Set();
    if (!tower.freeBuild) for (const r of residents) if (!r.traveling) home.add(r.atKey || r.key);
    const showAll = tower.freeBuild;
    const k = 1 - Math.exp(-6 * dt);
    for (const room of tower.built.rooms) {
      const w = room.revealWall; if (!w) continue;
      const occupied = showAll || home.has(key(room.col, room.floor));
      const goal = occupied ? 0.0 : 0.92;
      w.material.opacity += (goal - w.material.opacity) * k;
      w.material.depthWrite = w.material.opacity > 0.6;
      w.visible = w.material.opacity > 0.04;
    }
  }

  // ── per-frame ──────────────────────────────────────────────────────────
  function tick(dt) {
    updatePops(dt);
    updateReveals(dt);
    if (!state.running) return;
    elapsed += dt;
    // tenant move-in
    moveT -= dt;
    if (moveT <= 0) { moveT = G.MOVE_IN_INTERVAL * (0.7 + ((elapsed * 0.37) % 1) * 0.6); tryMoveIn(); }
    updateMoods(dt);
    updateCommutes(dt);
    updateQuestions(dt);
    // income — each resident pays rent scaled by their mood (happy pays more)
    let earned = 0;
    for (const r of tower.built.rooms) {
      const k = key(r.col, r.floor);
      const res = residents.filter((x) => x.key === k);
      let t = (earnT.get(k) || G.EARN_INTERVAL) - dt;
      if (t <= 0 && res.length) {
        t = G.EARN_INTERVAL;
        let gain = 0;
        for (const x of res) gain += earnFor(roomType.get(k)) * (G.MOOD_MULT[x.mood] ?? 1);
        gain = Math.round(gain);
        if (gain > 0) { state.coins += gain; earned += gain; floatAt(r, '+' + gain + ' 🪙', '#ffcf5e'); }
      }
      earnT.set(k, t);
    }
    if (earned && elapsed - lastCoinSfx > 0.18) { audio.coin(); lastCoinSfx = elapsed; }
    updateHud();
    milestoneT += dt;
    if (milestoneT >= 0.4) { milestoneT = 0; checkMilestones(); }
    saveT -= dt;
    if (saveT <= 0) { saveT = 4; saveGame(); }
  }

  // ── juice ───────────────────────────────────────────────────────────────
  function popRoom(c, f) {
    const r = roomAt(c, f);
    if (r) pops.push({ obj: r.furniture, t: 0, dur: 0.34 });
  }
  function updatePops(dt) {
    for (let i = pops.length - 1; i >= 0; i--) {
      const p = pops[i]; p.t += dt;
      const k = Math.min(1, p.t / p.dur);
      const e = 1 - Math.pow(1 - k, 3);              // easeOutCubic
      const s = 0.18 + 0.82 * e + Math.sin(k * Math.PI) * 0.12; // tiny overshoot
      p.obj.scale.set(s, s, s * (tower.built ? 1 : 1));
      if (k >= 1) { p.obj.scale.set(1, 1, 1); pops.splice(i, 1); }
    }
  }
  function project(x, y, z) {
    const v = new THREE.Vector3(x, y, z).project(camera);
    const rect = renderer.domElement.getBoundingClientRect();
    return { x: rect.left + (v.x * 0.5 + 0.5) * rect.width, y: rect.top + (-v.y * 0.5 + 0.5) * rect.height };
  }
  function floatAt(r, text, color) {
    const roomH = tower.built ? tower.built.roomH : 4;
    const p = project(r.slot.position.x, r.slot.position.y + roomH * 0.7, 2.4);
    const s = el('div', 'gFloat', text);
    s.style.left = p.x + 'px'; s.style.top = p.y + 'px'; s.style.color = color;
    floatLayer.appendChild(s);
    requestAnimationFrame(() => { s.style.transform = 'translate(-50%,-46px)'; s.style.opacity = '0'; });
    setTimeout(() => s.remove(), 950);
  }
  function floatAtChar(char, text, color) {
    const wp = char.obj.getWorldPosition(new THREE.Vector3());
    const p = project(wp.x, wp.y + 2.0, wp.z);
    const s = el('div', 'gFloat', text);
    s.style.left = p.x + 'px'; s.style.top = p.y + 'px'; s.style.color = color;
    floatLayer.appendChild(s);
    requestAnimationFrame(() => { s.style.transform = 'translate(-50%,-40px)'; s.style.opacity = '0'; });
    setTimeout(() => s.remove(), 950);
  }
  function flashCoins() { $coins.parentElement.classList.add('gFlash'); setTimeout(() => $coins.parentElement.classList.remove('gFlash'), 500); }
  function showToast(msg) { toast.textContent = msg; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2200); }

  // ── HUD / dock rendering ────────────────────────────────────────────────
  function updateHud() {
    $coins.textContent = Math.floor(state.coins);
    $pop.textContent = state.population;
    $lvl.textContent = state.level + 1;
    const prev = state.goalIdx > 0 ? G.GOALS[state.goalIdx - 1] : 0;
    const goal = nextGoal();
    const frac = state.goalIdx >= G.GOALS.length ? 1 : Math.max(0, Math.min(1, (state.population - prev) / (goal - prev)));
    $bar.style.width = (frac * 100) + '%';
    $goal.textContent = state.goalIdx >= G.GOALS.length ? 'MAX' : `${state.population}/${goal}`;
    // grey unaffordable chips
    for (const b of paletteEl.children) {
      const id = b.dataset.id;
      if (!id || id === 'erase') continue;
      const cost = id === 'expand' ? G.LOT_COST : costFor(id);
      b.classList.toggle('gPoor', !tower.freeBuild && state.coins < cost);
    }
  }
  function updateDock() {
    paletteEl.innerHTML = '';
    // Expand — buy floor space (shows the amber frontier)
    const exp = el('button', 'gChip gExpand');
    exp.dataset.id = 'expand';
    exp.innerHTML = `<span class="gChipName">🏗️ Expand</span>` + (tower.freeBuild ? '' : `<span class="gChipCost">🪙${G.LOT_COST}</span>`);
    exp.onclick = () => selectBrush('expand');
    paletteEl.appendChild(exp);
    // room + elevator tools (each shows its own ghosts)
    for (const id of Object.keys(tower.rooms)) {
      const b = el('button', 'gChip');
      b.dataset.id = id;
      b.innerHTML = `<span class="gChipName">${tower.rooms[id].label}</span>` + (tower.freeBuild ? '' : `<span class="gChipCost">🪙${costFor(id)}</span>`);
      b.onclick = () => selectBrush(id);
      paletteEl.appendChild(b);
    }
    if (tower.freeBuild) {
      const er = el('button', 'gChip gEraseChip', '🧽 Erase');
      er.dataset.id = 'erase';
      er.onclick = () => selectBrush('erase');
      paletteEl.appendChild(er);
    } else if (tower.brush === 'erase') {
      deselectBrush();
    }
    markBrush();
    extraEl.innerHTML = '';
    if (tower.freeBuild) {
      const row = el('div', 'gRow');
      const cl = el('button', 'gBtn', 'Clear rooms'); cl.onclick = () => { if (confirm('Clear all rooms?')) tower.clear(); };
      const sv = el('button', 'gBtn gPrimary', '💾 Save'); sv.onclick = () => { tower.save(); showToast('saved ✓ (building.json downloaded)'); };
      row.append(cl, sv); extraEl.appendChild(row);
    } else {
      const ng = el('button', 'gBtn', '🔄 New game');
      ng.onclick = () => { if (confirm('Start over with a fresh tower?')) { clearSave(); location.href = location.pathname; } };
      extraEl.appendChild(ng);
    }
    updateHud();
  }
  function markBrush() { for (const b of paletteEl.children) b.classList.toggle('on', b.dataset.id === tower.brush); }
  // select a tool (toggle off if it's already active) → refresh the ghost layer
  function selectBrush(id) { tower.brush = (tower.brush === id) ? null : id; markBrush(); picker.refresh(); updateHud(); }
  function deselectBrush() { tower.brush = null; markBrush(); picker.refresh(); }

  freeChk.onchange = () => setFreeBuild(freeChk.checked);
  // unlock audio on first interaction
  const unlock = () => { unlockAudio(); window.removeEventListener('pointerdown', unlock); };
  window.addEventListener('pointerdown', unlock);

  // ── start ────────────────────────────────────────────────────────────────
  async function start(startLots, opts = {}) {
    tower.gameActive = true;
    tower.freeBuild = !!opts.freeBuild;
    ephemeral = !!opts.ephemeral;
    tower.gutter = CONFIG.BUILD_PAN_FRAC;
    tower.repopulate = repopulate;
    tower.onRebuilt = onRebuilt;
    tower.lots = startLots;
    await tower.rebuild();
    if (!tower.freeBuild && opts.resume) {
      // restore a saved game: coins/progress + every saved resident whose room still exists
      const s = opts.resume;
      state.coins = s.coins ?? state.coins;
      state.level = s.level | 0; state.goalIdx = s.goalIdx | 0; milestoneIdx = s.milestoneIdx | 0;
      for (const rs of (s.residents || [])) {
        const room = tower.built.rooms.find((r) => key(r.col, r.floor) === rs.key);
        if (!room || occCount(rs.key) >= maxOcc(roomType.get(rs.key))) continue;
        const char = spawnOne(room, { bounce: false, typeName: rs.type });
        const type = char ? char.typeName : (rs.type || 'Rogue');
        const res = { id: residentSeq++, key: rs.key, floor: room.floor, char, type, want: rs.want || WANT_BY_TYPE[type] || 'sofa', mood: 'happy', unhappyT: 0, grumbleT: 0 };
        residents.push(res); if (char) char.obj.userData.resident = res;
      }
    } else if (!tower.freeBuild) {
      // fresh game: seed the starter room(s) so it isn't dead on arrival
      for (const r of tower.built.rooms) {
        const k = key(r.col, r.floor);
        const seed = Math.min(G.SEED_OCCUPIED, maxOcc(roomType.get(k)));
        for (let i = 0; i < seed; i++) {
          const char = spawnOne(r, { bounce: false });
          const type = char ? char.typeName : 'Rogue';
          const res = { id: residentSeq++, key: k, floor: r.floor, char, type, want: WANT_BY_TYPE[type] || 'sofa', mood: 'happy', unhappyT: 0, grumbleT: 0 };
          residents.push(res); if (char) char.obj.userData.resident = res;
        }
      }
    }
    recountPop();
    picker.setVisible(true);
    updateDock();
    updateGoalBanner();
    showToast(tower.freeBuild ? '🏗️ Sandbox — free build.'
      : (opts.resume ? '🏙️ Welcome back!' : '🏙️ Welcome! Buy floor space, then build rooms.'));
    state.running = !tower.freeBuild;
    started = true;
    saveGame();
  }

  return {
    start, tick, state, residents, showResidentCard, pickResident, showQuiz,
    get milestoneIdx() { return milestoneIdx; }, milestones: MILESTONES,
    setUiVisible(v) { hud.style.display = dock.style.display = goalBanner.style.display = v ? '' : 'none'; if (homeBtn) homeBtn.style.display = v ? '' : 'none'; picker.setVisible(v); },
  };
}

// ── DOM helpers + styles ────────────────────────────────────────────────────
function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
function injectStyles() {
  if (document.getElementById('gameCss')) return;
  const s = document.createElement('style'); s.id = 'gameCss';
  s.textContent = `
  .gHud{position:fixed; top:12px; left:50%; transform:translateX(-50%); z-index:42; display:flex; gap:10px;
    font:800 16px 'Nunito',system-ui,sans-serif; color:#e7ecf3;}
  .gStat{display:flex; align-items:center; gap:7px; background:rgba(16,20,29,.86); border:1px solid rgba(255,255,255,.1);
    border-radius:12px; padding:7px 14px; box-shadow:0 4px 14px rgba(0,0,0,.35);}
  .gStat.gFlash{animation:gShake .45s; border-color:#ff8585;}
  @keyframes gShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}
  .gIco{font-size:18px;}
  .gLvl{gap:9px;}
  .gBar{width:74px; height:8px; background:rgba(255,255,255,.14); border-radius:5px; overflow:hidden;}
  .gBarFill{height:100%; width:0%; background:linear-gradient(90deg,#2ee6c0,#ffcf5e); transition:width .35s;}
  .gGoal{font-size:13px; color:#9fb0c6; min-width:42px;}
  .gDock{position:fixed; left:0; top:0; bottom:0; width:236px; z-index:41; background:rgba(16,20,29,.93);
    backdrop-filter:blur(6px); border-right:1px solid rgba(46,230,192,.22); color:#e7ecf3; padding:16px 14px;
    overflow:auto; font:600 13px 'Nunito',system-ui,sans-serif;}
  .gHead{font:700 20px 'Fredoka One','Nunito',cursive; color:#2ee6c0; margin-bottom:4px;}
  .gHint{color:#8fa0b6; font-size:12px; line-height:1.45; margin-bottom:10px;}
  .gSec{color:#ffcf5e; font-weight:800; font-size:11px; letter-spacing:.6px; text-transform:uppercase; margin:12px 0 7px;}
  .gPalette{display:flex; flex-direction:column; gap:7px;}
  .gChip{display:flex; justify-content:space-between; align-items:center; cursor:pointer; gap:8px;
    border:1px solid rgba(255,255,255,.16); background:rgba(255,255,255,.05); color:#e7ecf3; border-radius:10px;
    padding:9px 12px; font:700 14px 'Nunito',sans-serif;}
  .gChip:hover{border-color:rgba(46,230,192,.6);}
  .gChip.on{background:#2ee6c0; color:#0e141d; border-color:#2ee6c0;}
  .gChip.gExpand{border-color:rgba(255,207,94,.45);}
  .gChip.gExpand.on{background:#ffcf5e; color:#0e141d; border-color:#ffcf5e;}
  .gChip[data-id="elevator"].on{background:#9b8cff; color:#0e141d; border-color:#9b8cff;}
  .gChip.gEraseChip.on{background:#ff8585; border-color:#ff8585;}
  .gChipCost{font-size:13px; opacity:.9;}
  .gChip.gPoor{opacity:.45;}
  .gBtn{width:100%; cursor:pointer; border:1px solid rgba(255,255,255,.16); background:rgba(255,255,255,.05);
    color:#e7ecf3; border-radius:10px; padding:10px; font:700 13px 'Nunito',sans-serif; margin-top:2px;}
  .gBtn:hover{border-color:rgba(46,230,192,.6);}
  .gBtn.gPoor{opacity:.45;}
  .gBtn.gPrimary{background:#2ee6c0; color:#0e141d; border-color:#2ee6c0;}
  .gFree{display:flex; align-items:center; gap:8px; margin-top:12px; color:#8fa0b6; font-size:12px; cursor:pointer;}
  .gRow{display:flex; gap:6px; margin-top:8px;}
  .gRow .gBtn{margin-top:0;}
  .gGoalBanner{position:fixed; top:58px; left:50%; transform:translateX(-50%); z-index:41;
    background:rgba(16,20,29,.86); border:1px solid rgba(255,207,94,.4); border-radius:11px; padding:6px 15px;
    color:#cdd6e2; font:700 13.5px 'Nunito',system-ui,sans-serif; box-shadow:0 4px 14px rgba(0,0,0,.35);}
  .gGoalBanner b{color:#ffcf5e;}
  .gGoalBanner.gDone{border-color:rgba(46,230,192,.5);} .gGoalBanner.gDone b{color:#2ee6c0;}
  .gGoalProg{color:#8fa0b6; margin-left:6px; font-weight:800;}
  .gToast{position:fixed; top:96px; left:50%; transform:translateX(-50%) translateY(-12px); z-index:45; opacity:0;
    background:#ffcf5e; color:#0e141d; font:800 16px 'Fredoka One','Nunito',cursive; padding:10px 20px; border-radius:12px;
    box-shadow:0 8px 24px rgba(0,0,0,.4); transition:opacity .3s, transform .3s; pointer-events:none;}
  .gToast.show{opacity:1; transform:translateX(-50%) translateY(0);}
  .gFloats{position:fixed; inset:0; z-index:43; pointer-events:none; overflow:hidden;}
  .gFloat{position:absolute; transform:translate(-50%,0); font:800 17px 'Nunito',sans-serif; opacity:1;
    text-shadow:0 2px 4px rgba(0,0,0,.6); transition:transform .9s ease-out, opacity .9s ease-out; white-space:nowrap;}
  .gCard{position:fixed; z-index:46; transform:translate(-50%,-100%); margin-top:-10px; pointer-events:none;
    background:rgba(16,20,29,.96); border:1px solid rgba(46,230,192,.4); border-radius:12px; padding:10px 13px;
    color:#e7ecf3; font:600 13px 'Nunito',sans-serif; box-shadow:0 8px 24px rgba(0,0,0,.5); opacity:0;
    transition:opacity .15s; min-width:170px; white-space:nowrap;}
  .gCard.show{opacity:1;}
  .gCard:after{content:''; position:absolute; left:50%; bottom:-7px; transform:translateX(-50%);
    border:7px solid transparent; border-top-color:rgba(46,230,192,.4);}
  .gQuiz{position:fixed; left:50%; bottom:30px; transform:translateX(-50%) translateY(14px); z-index:47;
    background:rgba(16,20,29,.97); border:1px solid rgba(46,230,192,.5); border-radius:16px; padding:16px 22px;
    color:#e7ecf3; font:600 15px 'Nunito',sans-serif; box-shadow:0 10px 30px rgba(0,0,0,.55);
    opacity:0; pointer-events:none; transition:opacity .18s, transform .18s; text-align:center; min-width:280px;}
  .gQuiz.show{opacity:1; pointer-events:auto; transform:translateX(-50%) translateY(0);}
  .gQzWho{font:700 13px 'Nunito',sans-serif; color:#8fa0b6; margin-bottom:6px;}
  .gQzText{font:800 19px 'Nunito',sans-serif; margin-bottom:12px;}
  .gQzGap{color:#ffcf5e;}
  .gQzChips{display:flex; gap:10px; justify-content:center;}
  .gQzChip{cursor:pointer; border:1px solid rgba(255,255,255,.2); background:rgba(255,255,255,.07); color:#e7ecf3;
    border-radius:12px; padding:10px 20px; font:800 17px 'Nunito',sans-serif; min-width:74px;}
  .gQzChip:hover:not(:disabled){border-color:#2ee6c0; background:rgba(46,230,192,.12);}
  .gQzChip:disabled{cursor:default;}
  .gQzChip.gQzGood{background:#2ee6c0; color:#0e141d; border-color:#2ee6c0;}
  .gQzChip.gQzBad{background:#ff8585; color:#0e141d; border-color:#ff8585;}
  .gQzCap{margin-top:10px; color:#8fa0b6; font-size:13px;}
  .gHomeBtn{position:fixed; right:16px; bottom:16px; z-index:44; width:44px; height:44px; border-radius:50%;
    border:1px solid rgba(46,230,192,.4); background:rgba(16,20,29,.88); color:#2ee6c0; font-size:22px; cursor:pointer;
    box-shadow:0 4px 14px rgba(0,0,0,.35);}
  .gHomeBtn:hover{background:rgba(46,230,192,.18);}
  .gCardHead{font:700 15px 'Fredoka One','Nunito',cursive; color:#2ee6c0; margin-bottom:3px;}
  .gCardWant{color:#cdd6e2; margin-bottom:5px;}
  .gCardMood{display:flex; gap:8px; align-items:center; font-weight:800;}
  .gCardMood.m-happy{color:#2ee6c0;} .gCardMood.m-meh{color:#ffcf5e;} .gCardMood.m-leaving{color:#ff8585;}
  .gCardMet{color:#8fa0b6; font-weight:700; font-size:12px;}
  `;
  document.head.appendChild(s);
}
