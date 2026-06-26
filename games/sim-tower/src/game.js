// Krabsy Tower — a cozy build-and-grow tycoon layered on the diorama.
// Build rooms (cost coins) → tenants move in → occupied rooms earn coins →
// spend coins to expand → hit population milestones to level up. No fail state.
// A "Free build" toggle drops back to the sandbox author mode (no economy).
import { CONFIG } from './config.js';
import { audio, unlockAudio } from './audio.js';
import { createSlotPicker } from './slots.js';

export function createGame(tower, deps) {
  const { THREE, scene, camera, renderer, spawnOne } = deps;
  const G = CONFIG.GAME;

  const state = { coins: G.START_COINS, population: 0, level: 0, goalIdx: 0, running: false };
  const occ = new Map();        // "f:c" → tenant count
  const roomType = new Map();   // "f:c" → roomId
  const earnT = new Map();      // "f:c" → income timer
  const pops = [];              // furniture build-pop tweens
  let moveT = G.MOVE_IN_INTERVAL;
  let lastCoinSfx = 0;
  let elapsed = 0;

  const key = (c, f) => f + ':' + c;
  const costFor = (id) => G.COST[id] ?? G.COST._default;
  const earnFor = (id) => G.EARN[id] ?? G.EARN._default;
  const maxOcc = (id) => G.MAX_OCC[id] ?? G.MAX_OCC._default;
  const nextGoal = () => G.GOALS[Math.min(state.goalIdx, G.GOALS.length - 1)];

  tower.brush = tower.brush || Object.keys(tower.rooms)[0];

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

  const dock = el('div', 'gDock'); document.body.appendChild(dock);
  dock.innerHTML = `
    <div class="gHead">🏙️ Krabsy Tower</div>
    <div class="gHint">Click a glowing slot to build. Rooms earn 🪙 over time — grow your tower!</div>
    <div class="gSec">Build a room</div>
    <div class="gPalette" id="gPalette"></div>
    <div class="gSec">Expand</div>
    <button class="gBtn" id="gAddFloor">＋ Add floor</button>
    <label class="gFree"><input type="checkbox" id="gFreeBuild"> Free build (sandbox)</label>
    <div class="gExtra" id="gExtra"></div>`;
  const paletteEl = dock.querySelector('#gPalette');
  const extraEl = dock.querySelector('#gExtra');
  const addFloorBtn = dock.querySelector('#gAddFloor');
  const freeChk = dock.querySelector('#gFreeBuild');

  const toast = el('div', 'gToast'); document.body.appendChild(toast);
  const floatLayer = el('div', 'gFloats'); document.body.appendChild(floatLayer);

  const picker = createSlotPicker(tower, { THREE, scene, camera, renderer, onPick: onSlotClick });

  // ── room registry sync (keeps occ/type in step with the layout) ────────
  function syncRooms() {
    const live = new Set();
    for (const r of tower.built.rooms) {
      const k = key(r.col, r.floor); live.add(k);
      if (!occ.has(k)) occ.set(k, 0);
      roomType.set(k, r.roomId);
      if (!earnT.has(k)) earnT.set(k, G.EARN_INTERVAL * Math.random());
    }
    for (const k of [...occ.keys()]) if (!live.has(k)) { occ.delete(k); roomType.delete(k); earnT.delete(k); }
    recountPop();
  }
  function recountPop() { let p = 0; for (const v of occ.values()) p += v; state.population = p; }
  function roomAt(c, f) { return tower.built.rooms.find((r) => r.col === c && r.floor === f); }

  // ── tower hooks (called from tower.rebuild) ────────────────────────────
  function repopulate(rooms) {
    if (tower.freeBuild) return;                  // sandbox: empty rooms
    for (const r of rooms) {
      const n = occ.get(key(r.col, r.floor)) || 0;
      for (let i = 0; i < n; i++) spawnOne(r, { bounce: false });
    }
  }
  function onRebuilt() { syncRooms(); picker.refresh(); updateHud(); updateDock(); }

  // ── actions ────────────────────────────────────────────────────────────
  async function onSlotClick(c, f) {
    if (tower.freeBuild) {
      await tower.setSlot(c, f, tower.brush === 'erase' ? null : tower.brush);
      return;
    }
    if (tower.layout[f][c]) return;               // occupied slot — nothing to build
    const id = tower.brush;
    const cost = costFor(id);
    if (state.coins < cost) { audio.nope(); flashCoins(); return; }
    state.coins -= cost;
    await tower.setSlot(c, f, id);                // rebuild → onRebuilt → syncRooms
    audio.build();
    popRoom(c, f);
    updateHud();
  }

  async function addFloor() {
    if (tower.freeBuild) { await tower.addFloor(); return; }
    if (state.coins < G.FLOOR_COST) { audio.nope(); flashCoins(); return; }
    state.coins -= G.FLOOR_COST;
    await tower.addFloor();
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
    const cands = tower.built.rooms.filter((r) => (occ.get(key(r.col, r.floor)) || 0) < maxOcc(roomType.get(key(r.col, r.floor))));
    if (!cands.length) return;
    const r = cands[Math.floor((elapsed * 7.3) % cands.length)];   // deterministic-ish pick
    const k = key(r.col, r.floor);
    occ.set(k, (occ.get(k) || 0) + 1);
    recountPop();
    spawnOne(r, { bounce: true });
    audio.moveIn();
    floatAt(r, '+1 👤', '#9fe6ff');
    checkGoal();
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

  // ── per-frame ──────────────────────────────────────────────────────────
  function tick(dt) {
    updatePops(dt);
    if (!state.running) return;
    elapsed += dt;
    // tenant move-in
    moveT -= dt;
    if (moveT <= 0) { moveT = G.MOVE_IN_INTERVAL * (0.7 + ((elapsed * 0.37) % 1) * 0.6); tryMoveIn(); }
    // income
    let earned = 0, earnRoom = null;
    for (const r of tower.built.rooms) {
      const k = key(r.col, r.floor);
      const n = occ.get(k) || 0;
      if (n <= 0) continue;
      let t = (earnT.get(k) || G.EARN_INTERVAL) - dt;
      if (t <= 0) {
        t = G.EARN_INTERVAL;
        const gain = earnFor(roomType.get(k)) * n;
        state.coins += gain; earned += gain;
        floatAt(r, '+' + gain + ' 🪙', '#ffcf5e');
        earnRoom = r;
      }
      earnT.set(k, t);
    }
    if (earned && elapsed - lastCoinSfx > 0.18) { audio.coin(); lastCoinSfx = elapsed; }
    updateHud();
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
      if (id && id !== 'erase') b.classList.toggle('gPoor', !tower.freeBuild && state.coins < costFor(id));
    }
    addFloorBtn.classList.toggle('gPoor', !tower.freeBuild && state.coins < G.FLOOR_COST);
  }
  function updateDock() {
    paletteEl.innerHTML = '';
    for (const id of Object.keys(tower.rooms)) {
      const cost = costFor(id);
      const b = el('button', 'gChip');
      b.dataset.id = id;
      b.innerHTML = `<span class="gChipName">${tower.rooms[id].label}</span>` + (tower.freeBuild ? '' : `<span class="gChipCost">🪙${cost}</span>`);
      if (tower.brush === id) b.classList.add('on');
      b.onclick = () => { tower.brush = id; markBrush(); };
      paletteEl.appendChild(b);
    }
    if (tower.freeBuild) {
      const er = el('button', 'gChip gEraseChip', '🧽 Erase');
      er.dataset.id = 'erase';
      if (tower.brush === 'erase') er.classList.add('on');
      er.onclick = () => { tower.brush = 'erase'; markBrush(); };
      paletteEl.appendChild(er);
    } else if (tower.brush === 'erase') {
      tower.brush = Object.keys(tower.rooms)[0];
    }
    addFloorBtn.textContent = tower.freeBuild ? '＋ Add floor' : `＋ Add floor  🪙${G.FLOOR_COST}`;
    extraEl.innerHTML = '';
    if (tower.freeBuild) {
      const row = el('div', 'gRow');
      const rm = el('button', 'gBtn', '－ Floor'); rm.onclick = () => tower.removeFloor();
      const cl = el('button', 'gBtn', 'Clear'); cl.onclick = () => { if (confirm('Clear all rooms?')) tower.clear(); };
      const sv = el('button', 'gBtn gPrimary', '💾 Save'); sv.onclick = () => { tower.save(); showToast('saved ✓ (building.json downloaded)'); };
      row.append(rm, cl, sv); extraEl.appendChild(row);
    }
    updateHud();
  }
  function markBrush() { for (const b of paletteEl.children) b.classList.toggle('on', b.dataset.id === tower.brush); }

  addFloorBtn.onclick = addFloor;
  freeChk.onchange = () => setFreeBuild(freeChk.checked);
  // unlock audio on first interaction
  const unlock = () => { unlockAudio(); window.removeEventListener('pointerdown', unlock); };
  window.addEventListener('pointerdown', unlock);

  // ── start ────────────────────────────────────────────────────────────────
  async function start(initialLayout) {
    tower.gameActive = true;
    tower.freeBuild = false;
    tower.gutter = CONFIG.BUILD_PAN_FRAC;
    tower.repopulate = repopulate;
    tower.onRebuilt = onRebuilt;
    tower.layout = initialLayout;
    await tower.rebuild();
    // seed the starter room(s) with a tenant or two so it isn't dead on arrival
    for (const r of tower.built.rooms) {
      const k = key(r.col, r.floor);
      const seed = Math.min(G.SEED_OCCUPIED, maxOcc(roomType.get(k)));
      for (let i = 0; i < seed; i++) { occ.set(k, (occ.get(k) || 0) + 1); spawnOne(r, { bounce: false }); }
    }
    recountPop();
    picker.setVisible(true);
    updateDock();
    showToast('🏙️ Welcome! Build rooms and grow your tower.');
    state.running = true;
  }

  return { start, tick, state, setUiVisible(v) { hud.style.display = dock.style.display = v ? '' : 'none'; picker.setVisible(v); } };
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
  .gToast{position:fixed; top:64px; left:50%; transform:translateX(-50%) translateY(-12px); z-index:45; opacity:0;
    background:#ffcf5e; color:#0e141d; font:800 16px 'Fredoka One','Nunito',cursive; padding:10px 20px; border-radius:12px;
    box-shadow:0 8px 24px rgba(0,0,0,.4); transition:opacity .3s, transform .3s; pointer-events:none;}
  .gToast.show{opacity:1; transform:translateX(-50%) translateY(0);}
  .gFloats{position:fixed; inset:0; z-index:43; pointer-events:none; overflow:hidden;}
  .gFloat{position:absolute; transform:translate(-50%,0); font:800 17px 'Nunito',sans-serif; opacity:1;
    text-shadow:0 2px 4px rgba(0,0,0,.6); transition:transform .9s ease-out, opacity .9s ease-out; white-space:nowrap;}
  `;
  document.head.appendChild(s);
}
