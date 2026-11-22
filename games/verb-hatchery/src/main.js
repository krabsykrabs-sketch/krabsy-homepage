// Verb Hatchery (open-world version): run around the island in first person,
// answer to pick up eggs, carry them home past thief crabs, hatch creatures,
// earn coins, buy upgrades, open farther zones with stars. See ../CLAUDE.md.
import * as THREE from 'three';
import * as S from './state.js';
import { RARITIES, RARITY, UPGRADES, MAX_PENS, MAX_INCUBATORS, ZONES, HOME, ISLAND, EGG_RESPAWN, PLAYER } from './balance.js';
import { World, INC_POS, PEN_POS, PAD, SPAWN, height, zoneAt, onIsland } from './world.js';
import { Player, touchMode, loadCharacters, LOOKS } from './player.js';
import { Thieves } from './thieves.js';
import { Minimap } from './minimap.js';
import { buildCreature, speciesName } from './creatures.js';
import * as Q from './questions.js';
import { t, lang, fmt, fmtRate, fmtTime } from './i18n.js';
import { sfx } from './audio.js';
import * as A from './analytics.js';

const $ = (id) => document.getElementById(id);
const DEBUG = /[?&]debug/.test(location.search);
if (touchMode) document.body.classList.add('touch');

const world = new World($('c'));
const player = new Player(world, $('c'));
const thieves = new Thieves(world);
const map = new Minimap($('map'));
let st = S.load() || S.newState();
let away = { seconds: 0, coins: 0 };
let running = false;
let card = null;     // open question card
let panel = null;    // open panel element
let wild = [];       // eggs in the world: { obj, rarity, zone, x, z, id }
let respawn = [];    // { zone, t }
let eggId = 0, saveT = 0, goalT = 0, mapT = 0, lastCoins = -1;
let target = null;   // what E would act on
let curZone = null, zoneTimer = 0;
const openZones = new Set();

// ── static texts ──
$('tagline').textContent = t('tagline');
$('controls').innerHTML = touchMode ? t('controls_touch') : t('controls');
$('goalsTitle').textContent = t('goals');
$('upLbl').textContent = t('upgrades'); $('upTitle').textContent = t('upgrades');
$('bookLbl').textContent = t('book'); $('bookTitle').textContent = t('book');
$('goOn').textContent = t('goOn');
$('rotate').textContent = t('rotate');
$('resetBtn').textContent = t('newGame');
$('clickPlay').firstElementChild.textContent = t('clickToPlay');
const rName = (r) => t(`r_${r}`);
const zName = (z) => t(`zone_${z.id}`);
const isOpen = (z) => S.zoneOpen(st, z);
player.isLocked = (z) => !isOpen(z);

// colliders for the base: incubators and pens
INC_POS.forEach((p) => world.addCollider(p.x, p.z, 0.95));
PEN_POS.forEach((p) => world.addCollider(p.x, p.z, 1.9));

// ── creature portraits (book, reveal, info) ──
const portrait = (() => {
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setSize(168, 168); r.outputColorSpace = THREE.SRGBColorSpace;
  const sc = new THREE.Scene();
  sc.add(new THREE.HemisphereLight(0xffffff, 0x8899bb, 1.6));
  const d = new THREE.DirectionalLight(0xffffff, 1.6); d.position.set(2, 3, 4); sc.add(d);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
  const cache = new Map();
  return (sp, silhouette = false) => {
    const key = sp + (silhouette ? '#s' : '');
    if (cache.has(key)) return cache.get(key);
    const c = buildCreature(sp, { silhouette });
    c.rotation.y = -0.35;
    sc.add(c);
    const h = c.userData.height + 0.35;
    cam.position.set(0, h * 0.7, 1.7 + h * 1.25); cam.lookAt(0, h * 0.45, 0);
    r.render(sc, cam);
    const url = r.domElement.toDataURL();
    sc.remove(c);
    cache.set(key, url);
    return url;
  };
})();

// ── sync the base with the state ──
function syncWorld() {
  world.setOwned(S.pensOwned(st), S.incubatorsOwned(st));
  for (let i = 0; i < MAX_PENS; i++) {
    const sp = st.pens[i] ? st.pens[i].sp : null;
    if (world.pens[i].sp !== sp) world.setPenCreature(i, sp);
  }
  st.incubators.forEach((inc, i) => {
    const c = world.incubators[i];
    if (!inc) { if (c.egg || c.waiting) world.clearIncubator(i); return; }
    if (inc.sp) { if (!c.waiting) world.showWaiting(i, inc.sp); return; }
    if (!c.egg || c.eggRarity !== inc.rarity) world.putEgg(i, inc.rarity);
  });
  player.showCarry(st.carry);
  player.speedFactor = S.speedFactor(st);
  $('carryN').textContent = `${st.carry.length}/${S.backpackSize(st)}`;
  for (const z of ZONES) if (z.r) {
    const open = isOpen(z);
    if (open && !openZones.has(z.id)) openZones.add(z.id);
    world.setZoneOpen(z.id, open, false);
  }
}

// ── wild eggs ──
function randomSpot(zone) {
  for (let tries = 0; tries < 60; tries++) {
    let x, z;
    if (zone.r) {
      const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * (zone.r - 3);
      x = zone.x + Math.cos(a) * d; z = zone.z + Math.sin(a) * d;
    } else {
      const a = Math.random() * Math.PI * 2, d = 32 + Math.sqrt(Math.random()) * (ISLAND.r - 50);
      x = HOME.x + Math.cos(a) * d; z = HOME.z - Math.abs(Math.sin(a)) * d * 0.9 - 6;
      if (zoneAt(x, z) !== zone) continue;
      if (Math.hypot(x - ISLAND.cx, z - ISLAND.cz) > ISLAND.r - 16) continue;
    }
    if (!onIsland(x, z) || height(x, z) < 0.3) continue;
    if (world.nearColliders(x, z).some((c) => Math.hypot(x - c.x, z - c.z) < c.r + 1.2)) continue;
    if (wild.some((e) => Math.hypot(x - e.x, z - e.z) < 6)) continue;
    if (Math.hypot(x - HOME.x, z - HOME.z) < 26) continue;
    return [x, z];
  }
  return null;
}
function spawnWild(zone) {
  const spot = randomSpot(zone);
  if (!spot) return false;
  const rarity = S.rollRarity(zone);
  const obj = world.makeWildEgg(rarity, spot[0], spot[1]);
  wild.push({ obj, rarity, zone, x: spot[0], z: spot[1], id: eggId++ });
  return true;
}
function removeWild(e, respawnLater = true) {
  wild = wild.filter((x) => x !== e);
  world.scene.remove(e.obj);
  if (respawnLater) respawn.push({ zone: e.zone, t: EGG_RESPAWN });
}
function fillEggs() {
  for (const z of ZONES) {
    let have = wild.filter((e) => e.zone === z).length + respawn.filter((r) => r.zone === z).length;
    while (have < z.eggs && spawnWild(z)) have++;
  }
}

// ── labels above incubators ──
const incLabels = world.incubators.map(() => {
  const el = document.createElement('div'); el.className = 'lbl'; el.style.display = 'none';
  document.body.appendChild(el); return el;
});
const tmpV = new THREE.Vector3();
function toScreen(v3) {
  tmpV.copy(v3).project(world.camera);
  return { x: (tmpV.x + 1) / 2 * innerWidth, y: (1 - tmpV.y) / 2 * innerHeight, behind: tmpV.z > 1 };
}
function updateLabels() {
  const now = Date.now();
  st.incubators.forEach((inc, i) => {
    const el = incLabels[i], c = world.incubators[i];
    c.ready = !!inc && !inc.sp && S.isReady(inc, now);
    const near = player.pos.distanceTo(INC_POS[i]) < 30;
    if (!inc || !c.owned || !running || card || panel || !near) { el.style.display = 'none'; return; }
    const p = toScreen(tmpV.copy(INC_POS[i]).setY(INC_POS[i].y + 2.3));
    if (p.behind) { el.style.display = 'none'; return; }
    el.style.display = ''; el.style.left = `${p.x}px`; el.style.top = `${p.y}px`;
    let cls = 'lbl', txt;
    if (inc.sp) { cls += ' wait'; txt = t('waitingPen'); }
    else if (c.ready) { cls += ' ready'; txt = `${touchMode ? '✋' : 'E'} · ${t('p_hatch')}`; }
    else { const s = Math.ceil(S.hatchLeft(inc, now)); txt = s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s}s`; }
    if (el.className !== cls) el.className = cls;
    if (el.textContent !== txt) el.textContent = txt;
  });
}

// ── floating numbers, toasts, hints ──
function floatAt(v3, text, big = false) {
  const p = toScreen(v3);
  if (p.behind || p.x < 0 || p.x > innerWidth || p.y < 0 || p.y > innerHeight) return;
  const el = document.createElement('div');
  el.className = 'float' + (big ? ' big' : '');
  el.textContent = text; el.style.left = `${p.x}px`; el.style.top = `${p.y}px`;
  document.body.appendChild(el);
  requestAnimationFrame(() => { el.style.transform = 'translate(-50%,-50%) translateY(-60px)'; el.style.opacity = '0'; });
  setTimeout(() => el.remove(), 1200);
}
function floatCenter(text) {
  const el = document.createElement('div');
  el.className = 'float big'; el.textContent = text;
  el.style.left = '50%'; el.style.top = '40%';
  document.body.appendChild(el);
  requestAnimationFrame(() => { el.style.transform = 'translate(-50%,-50%) translateY(-70px)'; el.style.opacity = '0'; });
  setTimeout(() => el.remove(), 1200);
}
let toastEl = null, toastTimer = 0;
function toast(text, kind = '') {
  if (toastEl) toastEl.remove();
  toastEl = document.createElement('div'); toastEl.className = 'toast ' + kind; toastEl.textContent = text;
  document.body.appendChild(toastEl);
  clearTimeout(toastTimer);
  const el = toastEl;
  toastTimer = setTimeout(() => { el.remove(); if (toastEl === el) toastEl = null; }, kind === 'star' ? 2600 : 2400);
}
function setHint(text) {
  const el = $('hint');
  if (!text) { el.classList.remove('on'); return; }
  if (el.textContent !== text) el.textContent = text;
  el.classList.add('on');
}
function showZoneName(text) {
  const el = $('zoneName');
  el.textContent = text; el.classList.add('on');
  clearTimeout(zoneTimer); zoneTimer = setTimeout(() => el.classList.remove('on'), 1800);
}

// ── HUD ──
function goalText(g) {
  const r = g.r ? rName(g.r) : '';
  return t(`g_${g.kind}`, g.kind === 'cps' ? fmt(g.n) : g.n, r);
}
let goalSig = '';
function renderGoals(force) {
  const items = st.goals.active.map((g) => ({ g, p: S.goalProgress(st, g) }));
  const sig = items.map(({ g, p }) => `${g.id}:${Math.floor(p.cur)}`).join('|');
  if (sig === goalSig && !force) return;
  goalSig = sig;
  $('goalList').innerHTML = items.map(({ g, p }) => {
    const pct = Math.min(100, (p.cur / p.n) * 100);
    const cnt = g.n > 1 ? ` <span style="color:var(--muted)">${g.kind === 'cps' ? fmt(p.cur) : Math.floor(p.cur)}/${g.kind === 'cps' ? fmt(g.n) : g.n}</span>` : '';
    return `<div class="goal"><span class="starI">☆</span> ${goalText(g)}${cnt}<div class="bar"><i style="width:${pct}%"></i></div></div>`;
  }).join('');
}
function renderHud() {
  const c = Math.floor(st.coins);
  if (c !== lastCoins) {
    $('coinN').textContent = fmt(c);
    if (lastCoins >= 0 && c - lastCoins > Math.max(2, S.cps(st) * 1.5)) { $('money').classList.remove('bump'); void $('money').offsetWidth; $('money').classList.add('bump'); }
    lastCoins = c;
  }
  $('cps').textContent = `+${fmtRate(S.cps(st))}${t('perSec')}`;
  $('starN').textContent = st.goals.stars;
  $('carryN').textContent = `${st.carry.length}/${S.backpackSize(st)}`;
  $('upBadge').classList.toggle('on', Object.keys(UPGRADES).some((k) => S.canBuy(st, k)));
  renderGoals();
  if (panel === $('upPanel')) refreshUpgradeButtons();
}

// ── goals, stars, zones ──
function checkGoals() {
  const done = S.checkGoals(st);
  for (const g of done) {
    sfx.star();
    toast(`★ ${t('star')}`, 'star');
    A.ev('goal_done', { goal: g.id, kind: g.kind, stars: st.goals.stars });
    A.levelEnd({ coins: Math.floor(st.coins), creatures: S.bookCount(st), cps: Math.round(S.cps(st)) });
    A.levelStart(st.goals.stars + 1);
  }
  if (!done.length) return;
  renderGoals(true);
  for (const z of ZONES) {
    if (!z.r || openZones.has(z.id) || !isOpen(z)) continue;
    openZones.add(z.id);
    world.setZoneOpen(z.id, true, true);
    setTimeout(() => { toast(t('zoneOpen', zName(z)), 'star'); sfx.ding(); }, 1400);
    A.ev('zone_opened', { zone: z.id, stars: st.goals.stars });
  }
  save();
}

// ── actions (E key, click while playing, ✋ button) ──
function findTarget() {
  const p = player.pos, f = player.forward();
  let best = null, bestScore = 1e9;
  const consider = (kind, ref, x, z, reach) => {
    const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
    if (d > reach) return;
    const dot = d > 0.01 ? (dx * f.x + dz * f.z) / d : 1;
    if (d > 1.6 && dot < 0.35) return;
    const score = d * (1.6 - dot);
    if (score < bestScore) { bestScore = score; best = { kind, ref }; }
  };
  for (const e of wild) if (isOpen(e.zone)) consider('egg', e, e.x, e.z, PLAYER.reach);
  if (Math.hypot(p.x - HOME.x, p.z - HOME.z) < 30) {
    st.incubators.forEach((inc, i) => { if (inc && world.incubators[i].owned) consider('inc', i, INC_POS[i].x, INC_POS[i].z, PLAYER.reach); });
    st.pens.forEach((c, i) => { if (c && i < S.pensOwned(st)) consider('pen', i, PEN_POS[i].x, PEN_POS[i].z, PLAYER.reach + 1.4); });
  }
  return best;
}
function promptFor(tg) {
  if (!tg) return null;
  if (tg.kind === 'egg') return `${t('p_egg')} · ${rName(tg.ref.rarity)}`;
  if (tg.kind === 'inc') {
    const inc = st.incubators[tg.ref];
    if (inc.sp) return t('p_waiting');
    return S.isReady(inc) ? t('p_hatch') : `${t('p_wait')} ${Math.ceil(S.hatchLeft(inc))}s`;
  }
  if (tg.kind === 'pen') return `${t('p_pen')} · ${speciesName(st.pens[tg.ref].sp)}`;
  return null;
}
function act() {
  if (!running || card || panel || !target) return;
  sfx.init();
  if (target.kind === 'egg') tryPickUp(target.ref);
  else if (target.kind === 'inc') tapIncubator(target.ref);
  else if (target.kind === 'pen') showCreature(target.ref);
}
addEventListener('keydown', (e) => {
  if (card) {
    if (!card.answered && ['Digit1', 'Digit2', 'Digit3', 'Numpad1', 'Numpad2', 'Numpad3'].includes(e.code)) answer(+e.key - 1);
    else if (card.answered && $('goOn').classList.contains('on') && (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyE')) { e.preventDefault(); closeCard(false); }
    return;
  }
  if (panel) { if (e.code === 'Escape' || e.code === 'KeyU' || e.code === 'KeyB') closePanel(); return; }
  if (!running) return;
  if (e.code === 'KeyE') act();
  else if (e.code === 'KeyU') openPanel('upPanel');
  else if (e.code === 'KeyB') openPanel('bookPanel');
});
$('c').addEventListener('mousedown', () => {
  if (!running || touchMode || card || panel) return;
  if (!player.locked) { player.requestLock(); sfx.init(); return; }
  act();
});
$('clickPlay').addEventListener('click', () => { sfx.init(); player.requestLock(); });
player.onLockChange = (locked) => { updateClickPlay(); if (locked) sfx.init(); };
function updateClickPlay() {
  $('clickPlay').classList.toggle('on', running && !touchMode && !player.locked && !card && !panel);
}
$('actBtn').addEventListener('touchstart', (e) => { e.preventDefault(); act(); }, { passive: false });
$('jumpBtn').addEventListener('touchstart', (e) => { e.preventDefault(); player.jump(); }, { passive: false });
player.onStep = (run) => sfx.step(run);
player.onJump = () => sfx.jump();

// ── question card (egg pick-up or thief catch) ──
function tryPickUp(e) {
  if (st.carry.length >= S.backpackSize(st)) { sfx.denied(); toast(t('backpackFull'), 'warn'); return; }
  sfx.open();
  openCard({ kind: 'egg', egg: e, rarity: e.rarity });
}
function openCard(c) {
  const R = RARITY[c.rarity];
  const pair = Q.nextPair(R.tier);
  card = { ...c, pair, steps: Q.stepsFor(pair, c.kind === 'egg' && R.pair), i: 0 };
  player.enabled = false;
  player.releaseLock();
  const el = $('card');
  el.style.setProperty('--rc', c.kind === 'thief' ? '#ff6b4a' : R.css);
  $('cardEgg').textContent = c.kind === 'thief' ? `🦀 ${t('thiefTitle')}` : t('egg', rName(c.rarity));
  $('cardSub').textContent = c.kind === 'thief' ? t('thiefSub') : (card.steps.length > 1 ? t('cardTwo') : t('cardOne'));
  $('shade').classList.add('on'); el.classList.add('on');
  updateClickPlay();
  showStep();
}
function trioHtml(q, reveal) {
  const b = `<span class="base">${q.base}</span>`, ar = '<span class="arrow">→</span>';
  const past = reveal.past || q.ask === 'pp' ? `<span class="filled">${q.past}</span>` : `<span class="blank ${q.ask === 'past' ? 'ask-past' : ''}">${q.past}</span>`;
  const pp = reveal.pp ? `<span class="pp">${q.pp}</span>` : `<span class="blank ${q.ask === 'pp' ? 'ask-pp' : ''}">${q.pp}</span>`;
  return b + ar + past + ar + pp;
}
function showStep() {
  const q = card.steps[card.i];
  card.answered = false;
  $('trio').innerHTML = trioHtml(q, {});
  $('feedback').innerHTML = card.steps.length > 1 ? `<div class="small">${t('step', card.i + 1, card.steps.length)}</div>` : '';
  $('goOn').classList.remove('on');
  $('chips').innerHTML = q.options.map((o, k) => `<button class="chip" data-k="${k}"><span class="k">${k + 1}</span>${o}</button>`).join('');
  $('chips').querySelectorAll('.chip').forEach((b) => b.addEventListener('click', () => answer(+b.dataset.k)));
}
function answer(k) {
  if (!card || card.answered || !card.steps[card.i].options[k]) return;
  const q = card.steps[card.i];
  const ok = q.options[k] === q.answer;
  card.answered = true;
  S.recordAnswer(st, ok); Q.record(q, ok); A.countAnswer(ok);
  $('chips').querySelectorAll('.chip').forEach((c, j) => c.classList.add(q.options[j] === q.answer ? 'right' : 'off'));
  const last = card.i === card.steps.length - 1;
  const showPp = q.ask === 'pp' || q.full; // never reveal a 3rd form the next step asks
  $('trio').innerHTML = trioHtml(q, { past: true, pp: showPp });
  if (ok) {
    sfx.right();
    $('feedback').innerHTML = `<div class="ok">${t('right')}</div>`;
    if (!last) { setTimeout(() => { if (card) { card.i++; showStep(); } }, 750); return; }
    setTimeout(() => closeCard(true), 650);
  } else {
    sfx.wrong();
    Q.missed(card.pair);
    const chain = `<span class="base">${q.base}</span><span class="arrow">→</span><span class="past">${q.past}</span><span class="arrow">→</span>` +
      (showPp ? `<span class="pp">${q.pp}</span>` : '<span style="color:#42577f">___</span>');
    const after = card.kind === 'thief' ? t('stolen') : t('eggRolled');
    $('feedback').innerHTML = `<div class="bad">${t('wrong')}</div><div class="teach">${chain}</div><div class="small">${after}</div>`;
    $('goOn').classList.add('on');
  }
}
$('goOn').addEventListener('click', () => closeCard(false));
function closeCard(ok) {
  if (!card) return;
  const c = card;
  card = null;
  $('card').classList.remove('on'); $('shade').classList.remove('on');
  player.requestLock();
  if (c.kind === 'egg') { if (ok) pickedUp(c.egg); else eggRollsAway(c.egg); }
  else thiefResult(c.thief, ok);
  renderHud();
  setTimeout(updateClickPlay, 300);
}
function pickedUp(e) {
  const res = S.pickUp(st, e.rarity);
  if (!res) { eggRollsAway(e); return; }
  A.ev('egg_grabbed', { rarity: e.rarity, zone: e.zone.id, streak: st.stats.streak, carry: st.carry.length });
  A.countVisit('grabbed');
  sfx.pop();
  floatCenter(`+${fmt(res.bonus)}`);
  // the egg flies onto your head
  const from = e.obj.position.clone().add(new THREE.Vector3(0, 0.5, 0));
  removeWild(e);
  const m = e.obj; world.scene.add(m);
  player.gesture('PickUp');
  const to = new THREE.Vector3();
  world.tween(0.45, (k) => {
    to.copy(player.pos).setY(player.pos.y + 2.1 + (st.carry.length - 1) * 0.5);
    m.position.lerpVectors(from, to, k); m.position.y += Math.sin(k * Math.PI) * 1.2; m.scale.setScalar(1 - k * 0.3);
  }, () => { world.scene.remove(m); player.showCarry(st.carry); });
  if (st.carry.length === 1) toast(t('bringHome'));
  save(); checkGoals();
}
function eggRollsAway(e) {
  S.loseEgg(st);
  A.ev('egg_lost', { rarity: e.rarity, zone: e.zone.id });
  sfx.roll();
  removeWild(e);
  const egg = e.obj.userData.egg, from = egg.position.clone();
  const dir = Math.random() * Math.PI * 2;
  world.scene.add(e.obj);
  world.tween(1.2, (k) => {
    egg.position.set(from.x + Math.sin(dir) * k * 4, from.y + Math.sin(k * Math.PI) * 0.8, from.z + Math.cos(dir) * k * 4);
    egg.rotation.x = k * 10;
    e.obj.userData.glow.material.opacity = 0.6 * (1 - k);
    if (e.obj.userData.beam) e.obj.userData.beam.visible = false;
    if (k > 0.7) egg.scale.setScalar(1.25 * (1 - (k - 0.7) / 0.3));
  }, () => world.scene.remove(e.obj));
}

// ── thieves ──
function thiefCatch(th) {
  const top = st.carry[st.carry.length - 1];
  // put the crab a little in front of the player and look at it
  const p = player.pos, dx = th.x - p.x, dz = th.z - p.z, L = Math.hypot(dx, dz) || 1;
  th.x = p.x + (dx / L) * 2.4; th.z = p.z + (dz / L) * 2.4;
  th.dir = Math.atan2(-dx, -dz);
  player.lookAtPoint(th.x, th.z);
  thieves.update(0, { x: p.x, z: p.z, carrying: true }, isOpen, true);
  sfx.alarm();
  openCard({ kind: 'thief', thief: th, rarity: top });
}
function thiefResult(th, ok) {
  if (ok) {
    S.bonked(st); thieves.bonk(th); sfx.bonk(); toast(t('bonked'));
    A.ev('thief_catch', { zone: th.zone.id, result: 'bonk' });
  } else {
    const r = S.stealTop(st);
    if (r) { thieves.steal(th, r); respawn.push({ zone: th.zone, t: EGG_RESPAWN }); }
    sfx.steal(); toast(t('stolen'), 'warn'); player.gesture('Hit_A');
    A.ev('thief_catch', { zone: th.zone.id, result: 'stolen', rarity: r || 'none' });
  }
  thieves.graceAll();
  player.showCarry(st.carry);
  save(); checkGoals();
}

// ── home: egg pad, hatching, pens ──
let padCooldown = 0;
function checkPad(dt) {
  padCooldown -= dt;
  if (!st.carry.length || padCooldown > 0) return;
  if (Math.hypot(player.pos.x - PAD.x, player.pos.z - PAD.z) > 2.7) return;
  const moved = S.deliver(st);
  padCooldown = 2;
  if (!moved.length) { sfx.denied(); toast(t('incFullCarry'), 'warn'); return; }
  sfx.whoosh();
  toast(t('delivered', moved.length));
  A.ev('eggs_home', { n: moved.length, left: st.carry.length });
  player.showCarry(st.carry);
  // eggs fly from the pad to the incubators
  moved.forEach(({ index, rarity }, k) => {
    const egg = world.putEgg(index, rarity);
    const to = egg.position.clone();
    const fromLocal = world.incubators[index].group.worldToLocal(PAD.clone().setY(PAD.y + 1.2));
    egg.position.copy(fromLocal);
    world.tween(0.7 + k * 0.15, (q) => { egg.position.lerpVectors(fromLocal, to, q); egg.position.y += Math.sin(q * Math.PI) * 2.5; });
  });
  renderHud(); save(); checkGoals();
}
function tapIncubator(i) {
  const inc = st.incubators[i];
  if (!inc) return;
  if (inc.sp) { if (S.freePen(st) >= 0) placeWaiting(i); else { sfx.denied(); toast(t('incFullWaiting'), 'warn'); } return; }
  if (!S.isReady(inc)) { sfx.tap(); return; }
  doHatch(i);
}
function doHatch(i) {
  const c = world.incubators[i];
  const egg = c.egg;
  const res = S.hatch(st, i);
  if (!res) return;
  A.ev('creature_hatched', { rarity: res.rarity, new: res.isNew, waiting: res.waiting });
  A.countVisit('hatched');
  sfx.crack(); player.gesture('Interact');
  world.tween(0.55, (k) => { if (egg) { egg.rotation.z = Math.sin(k * 40) * 0.25 * k; egg.scale.setScalar(1.25 * (1 + k * 0.25)); } }, () => {
    sfx.hatch(res.rarity);
    world.clearIncubator(i);
    shellBurst(INC_POS[i].clone().setY(INC_POS[i].y + 0.9), res.rarity);
    showReveal(res);
    const cr = buildCreature(res.sp);
    cr.position.copy(INC_POS[i]).setY(INC_POS[i].y + 0.55);
    world.scene.add(cr);
    world.tween(0.4, (k) => cr.scale.setScalar(Math.max(0.01, k < 0.7 ? k / 0.7 * 1.5 : 1.5 - (k - 0.7) / 0.3 * 0.2)));
    if (res.waiting) setTimeout(() => { world.scene.remove(cr); syncWorld(); }, 900);
    else jumpToPen(cr, res.pen, 0.9);
    save(); checkGoals();
  });
}
function jumpToPen(cr, pen, delay) {
  setTimeout(() => {
    const from = cr.position.clone(), to = PEN_POS[pen].clone().setY(PEN_POS[pen].y + 0.25);
    world.tween(0.8, (k) => { cr.position.lerpVectors(from, to, k); cr.position.y += Math.sin(k * Math.PI) * 3.5; },
      () => { world.scene.remove(cr); syncWorld(); });
  }, delay * 1000);
}
function placeWaiting(i) {
  const sp = st.incubators[i].sp;
  const res = S.hatch(st, i);
  if (!res || res.waiting) return;
  world.clearIncubator(i);
  const cr = buildCreature(sp);
  cr.position.copy(INC_POS[i]).setY(INC_POS[i].y + 0.55);
  world.scene.add(cr);
  sfx.pop();
  jumpToPen(cr, res.pen, 0);
  save();
}
const shellGeo = new THREE.TetrahedronGeometry(0.13);
function shellBurst(at, rarity) {
  const m = new THREE.MeshStandardMaterial({ color: RARITY[rarity].color, roughness: 0.6 });
  for (let k = 0; k < 12; k++) {
    const s = new THREE.Mesh(shellGeo, m); s.position.copy(at); world.scene.add(s);
    const v = new THREE.Vector3((Math.random() - 0.5) * 5, 3 + Math.random() * 3, (Math.random() - 0.5) * 5);
    world.tween(0.9, (q, dt) => { v.y -= 12 * dt; s.position.addScaledVector(v, dt); s.rotation.x += dt * 8; if (s.position.y < at.y - 0.8) s.position.y = at.y - 0.8; },
      () => world.scene.remove(s));
  }
}
let revealTimer = 0;
function showReveal(res) {
  const el = $('reveal');
  el.style.setProperty('--rc', RARITY[res.rarity].css);
  $('revImg').src = portrait(res.sp);
  $('revTitle').textContent = `${t('hatched')} · ${rName(res.rarity)}`;
  $('revName').textContent = speciesName(res.sp);
  $('revNew').textContent = res.isNew ? t('isNew') : '';
  $('revNew').style.display = res.isNew ? '' : 'none';
  $('revInfo').textContent = res.waiting ? t('waitsForPen') : t('earns', fmtRate(S.speciesIncome(res.sp)));
  el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
  clearTimeout(revealTimer);
  revealTimer = setTimeout(() => el.classList.remove('on'), res.waiting ? 4200 : 3000);
}
let infoPen = -1;
function showCreature(i) {
  const c = st.pens[i];
  if (!c) return;
  sfx.tap();
  infoPen = i;
  const r = S.speciesRarity(c.sp);
  $('ciImg').src = portrait(c.sp);
  $('ciName').textContent = speciesName(c.sp);
  $('ciR').textContent = rName(r); $('ciR').style.background = RARITY[r].css;
  $('ciEarn').textContent = t('earns', fmtRate(S.speciesIncome(c.sp)));
  $('ciRelease').textContent = t('release', fmt(Math.round(S.speciesIncome(c.sp) * 60)));
  $('ciAsk').textContent = t('releaseAsk');
  openPanel('creatureInfo');
}
$('ciRelease').addEventListener('click', () => {
  if (infoPen < 0) return;
  const coins = S.release(st, infoPen);
  floatCenter(`+${fmt(coins)}`);
  sfx.ding();
  infoPen = -1;
  closePanel(); syncWorld(); renderHud(); save();
});

// ── panels ──
function openPanel(id) {
  closePanel();
  panel = $(id);
  if (id === 'upPanel') renderUpgrades();
  if (id === 'bookPanel') renderBook();
  panel.classList.add('on'); $('shade').classList.add('on');
  player.enabled = false;
  player.releaseLock();
  updateClickPlay();
}
function closePanel() {
  if (!panel) return;
  panel.classList.remove('on'); $('shade').classList.remove('on');
  panel = null;
  player.requestLock();
  setTimeout(updateClickPlay, 300);
}
document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closePanel));
$('shade').addEventListener('click', () => { if (panel) closePanel(); });
$('upBtn').addEventListener('click', () => { sfx.init(); sfx.tap(); openPanel('upPanel'); });
$('bookBtn').addEventListener('click', () => { sfx.init(); sfx.tap(); openPanel('bookPanel'); });

const UP_ICON = { pen: '🏡', incubator: '🥚', hatchSpeed: '💡', shoes: '👟', backpack: '🎒' };
function renderUpgrades() {
  $('upList').innerHTML = Object.keys(UPGRADES).map((k) => `
    <div class="upRow"><div class="ico">${UP_ICON[k]}</div>
      <div class="txt"><div class="nm">${t(`up_${k}`)} <span style="color:var(--muted);font-size:14px;font-family:Nunito">${t('level', st.up[k])}</span></div>
      <div class="ds">${t(`up_${k}_d`)}</div></div>
      <button class="buy" data-up="${k}"></button></div>`).join('');
  $('upList').querySelectorAll('.buy').forEach((b) => b.addEventListener('click', () => buyUp(b.dataset.up)));
  refreshUpgradeButtons();
}
function refreshUpgradeButtons() {
  $('upList').querySelectorAll('.buy').forEach((b) => {
    const k = b.dataset.up;
    const html = S.isMaxed(st, k) ? t('max') : `<span class="coin"></span>${fmt(S.upgradePrice(st, k))}`;
    if (b.innerHTML !== html) b.innerHTML = html;
    b.disabled = !S.canBuy(st, k);
  });
}
function buyUp(k) {
  const cost = S.upgradePrice(st, k);
  if (!S.buy(st, k)) { sfx.denied(); return; }
  sfx.ding();
  A.ev('upgrade_bought', { upgrade: k, lvl: st.up[k], cost, coins_left: Math.floor(st.coins) });
  if (k === 'pen') st.incubators.forEach((inc, i) => { if (inc && inc.sp && S.freePen(st) >= 0) placeWaiting(i); });
  syncWorld(); renderUpgrades(); renderHud(); save(); checkGoals();
}
function renderBook() {
  const total = RARITIES.reduce((a, r) => a + RARITY[r].species, 0);
  $('bookHow').textContent = `${t('bookFound', S.bookCount(st), total)} · ${t('bookHow')}`;
  $('bookList').innerHTML = RARITIES.map((r) => {
    const n = RARITY[r].species;
    const cells = Array.from({ length: n }, (_, i) => {
      const sp = `${r}-${i}`, has = !!st.book[sp];
      return `<div class="bookCell ${has ? '' : 'miss'}" style="${has ? `border-color:${RARITY[r].css}` : ''}">
        <img src="${portrait(sp, !has)}" alt=""><div class="n">${has ? speciesName(sp) : '???'}</div></div>`;
    }).join('');
    return `<div class="bookR"><h3 style="color:${RARITY[r].css}">${rName(r)} <small>${t('bookChance', n)}</small></h3><div class="bookGrid">${cells}</div></div>`;
  }).join('');
}

// ── sound ──
function soundIcon() { $('soundBtn').textContent = sfx.muted ? '🔇' : '🔊'; }
soundIcon();
$('soundBtn').addEventListener('click', () => { sfx.init(); sfx.setMuted(!sfx.muted); soundIcon(); });

// ── save ──
function save() { S.save(st); }
A.onSummary(() => ({ coins_per_sec: Math.round(S.cps(st)), creatures: S.bookCount(st), stars: st.goals.stars }));
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') save(); });
addEventListener('pagehide', save);

// ── slow device? lower the resolution and the shadows (once each) ──
let qT = 0, qN = 0, qLevel = 0;
function adaptQuality(dt) {
  if (!running || card || panel || qLevel >= 2) return;
  qT += dt; qN++;
  if (qT < 4) return;
  const fps = qN / qT; qT = 0; qN = 0;
  if (fps > 32) return;
  qLevel++;
  if (qLevel === 1) world.renderer.setPixelRatio(1);
  else { world.sun.shadow.mapSize.set(1024, 1024); world.sun.shadow.map?.dispose(); world.sun.shadow.map = null; world.renderer.shadowMap.type = THREE.PCFShadowMap; }
  world.resize();
  A.ev('quality_down', { level: qLevel, fps: Math.round(fps) });
}

// ── main loop ──
let last = performance.now();
const chasing = new Set();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  adaptQuality(dt);
  if (running) {
    const paused = !!card || !!panel;
    player.enabled = !paused && (touchMode || player.locked || DEBUG);
    player.update(dt);
    world.followSun(player.pos);
    S.tick(st, dt);
    // coins floating from pens (visual; the real income is continuous)
    world.pens.forEach((p, i) => {
      if (!p.owned || !st.pens[i]) return;
      p.nextCoin -= dt;
      if (p.nextCoin <= 0) {
        p.nextCoin = 3 + Math.random() * 1.5;
        if (player.pos.distanceTo(PEN_POS[i]) < 25) {
          floatAt(PEN_POS[i].clone().setY(PEN_POS[i].y + 2.6), `+${fmt(S.speciesIncome(st.pens[i].sp) * 3)}`);
          sfx.plink();
        }
      }
    });
    // wild eggs: bob and glow; respawn
    for (const e of wild) {
      const ud = e.obj.userData;
      ud.egg.rotation.y += dt * 0.8;
      ud.glow.material.opacity = 0.45 + Math.sin(world.time * 3 + e.id) * 0.2;
      if (ud.beam) ud.beam.visible = Math.hypot(e.x - player.pos.x, e.z - player.pos.z) > 6;
    }
    for (const r of respawn) r.t -= dt;
    const due = respawn.filter((r) => r.t <= 0);
    respawn = respawn.filter((r) => r.t > 0);
    for (const r of due) spawnWild(r.zone);
    // thieves
    const caught = thieves.update(dt, { x: player.pos.x, z: player.pos.z, carrying: st.carry.length > 0 }, isOpen, paused);
    for (const th of thieves.list) {
      if (th.state === 'chase' && !chasing.has(th)) { chasing.add(th); sfx.alarm(); }
      if (th.state !== 'chase') chasing.delete(th);
    }
    if (caught && !paused && st.carry.length) thiefCatch(caught);
    if (!paused) checkPad(dt);
    // zone name when entering
    const z = zoneAt(player.pos.x, player.pos.z);
    if (z !== curZone) { curZone = z; showZoneName(zName(z)); }
    // locked zone close by → hint
    let hint = null;
    for (const zz of ZONES) {
      if (zz.r && !isOpen(zz) && Math.hypot(player.pos.x - zz.x, player.pos.z - zz.z) < zz.r + 6) hint = t('zoneLockedHint', zName(zz), zz.stars);
    }
    if (!hint && st.carry.length) hint = st.carry.length >= S.backpackSize(st) ? t('backpackFull') : t('bringHome');
    setHint(paused ? null : hint);
    // E target
    target = paused ? null : findTarget();
    const pt = promptFor(target);
    const pr = $('prompt');
    if (pt) {
      const html = `${touchMode ? '' : '<span class="key">E</span>'}${pt}`;
      if (pr.innerHTML !== html) pr.innerHTML = html;
      // float above the thing it is about
      const tp = target.kind === 'egg' ? tmpV.set(target.ref.x, target.ref.obj.position.y + 1.6, target.ref.z)
        : target.kind === 'inc' ? tmpV.copy(INC_POS[target.ref]).setY(INC_POS[target.ref].y + 3.0)
        : tmpV.copy(PEN_POS[target.ref]).setY(PEN_POS[target.ref].y + 3.4);
      const sp = toScreen(tp);
      if (!sp.behind) { pr.style.left = `${Math.max(120, Math.min(innerWidth - 120, sp.x))}px`; pr.style.top = `${Math.max(90, sp.y)}px`; }
      pr.classList.add('on');
    } else pr.classList.remove('on');
    $('actBtn').classList.toggle('on', !!pt);
    $('jumpBtn').classList.toggle('on', !paused);
    // timers
    saveT += dt; if (saveT > 5) { saveT = 0; save(); }
    goalT += dt; if (goalT > 0.4) { goalT = 0; checkGoals(); renderHud(); }
    mapT += dt; if (mapT > 0.1) {
      mapT = 0;
      map.draw({ player: player.pos, yaw: player.yaw, eggs: wild, thieves: thieves.list, isOpen, carrying: st.carry.length > 0 });
    }
  } else {
    // before Play: a slow look around from the hatchery
    player.yaw += dt * 0.08;
    player.update(0);
  }
  world.update(dt);
  updateLabels();
  requestAnimationFrame(frame);
}

// ── character choice (start screen) ──
function renderLooks() {
  $('looks').innerHTML = `<div class="lkTitle">${t('chooseChar')}</div>` + LOOKS.map((l) =>
    `<button class="lk ${(st.look || 'A') === l ? 'on' : ''}" data-look="${l}"><img src="${charPortrait(l)}" alt=""></button>`).join('');
  $('looks').querySelectorAll('.lk').forEach((b) => b.addEventListener('click', () => {
    st.look = b.dataset.look; player.setLook(st.look); save(); renderLooks(); sfx.init(); sfx.tap();
  }));
}
const charPortrait = (() => {
  const cache = {};
  return (look) => {
    if (cache[look]) return cache[look];
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    r.setSize(150, 180); r.outputColorSpace = THREE.SRGBColorSpace;
    const sc = new THREE.Scene();
    sc.add(new THREE.HemisphereLight(0xffffff, 0x8899bb, 1.8));
    const d = new THREE.DirectionalLight(0xffffff, 1.8); d.position.set(2, 3, 4); sc.add(d);
    const p = new Player({ scene: sc, camera: new THREE.PerspectiveCamera() }, document.createElement('canvas'));
    p.setLook(look); p.root.rotation.y = 0.35;
    if (!p.mixer) return '';
    p.mixer.update(0.4);
    const cam = new THREE.PerspectiveCamera(30, 150 / 180, 0.1, 20);
    cam.position.set(0, 1.25, 4.6); cam.lookAt(0, 0.95, 0);
    r.render(sc, cam);
    cache[look] = r.domElement.toDataURL();
    r.dispose();
    return cache[look];
  };
})();

// ── start ──
async function boot() {
  syncWorld();
  player.spawn(SPAWN, 0);
  world.followSun(player.pos);
  const decor = world.loadDecor();
  requestAnimationFrame(frame);
  $('playBtn').textContent = t('loading');
  await Promise.all([Q.init(), decor, loadCharacters().catch((e) => console.error('characters', e))]);
  player.setLook(st.look || 'A');
  player.spawn(SPAWN, 0);
  renderLooks();
  fillEggs();
  away = S.applyAway(st);
  const ready = st.incubators.filter((x) => x && S.isReady(x)).length;
  const parts = [];
  if (away.coins >= 1) parts.push(t('awayEarned', fmt(away.coins), fmtTime(Math.min(away.seconds, 8 * 3600))));
  if (ready) parts.push(t('eggsReady', ready));
  if (parts.length) { $('welcome').innerHTML = `<div class="fredoka" style="color:var(--amber);font-size:20px">${t('welcomeBack')}</div>${parts.join('<br>')}`; $('welcome').classList.add('on'); }
  $('resetBtn').style.display = st.stats.answers ? '' : 'none';
  $('playBtn').textContent = t('play');
  $('playBtn').disabled = false;
}
$('playBtn').addEventListener('click', () => {
  sfx.init();
  $('start').classList.add('off');
  $('hud').classList.add('on');
  player.spawn(SPAWN, 0);
  running = true;
  player.requestLock();
  if (away.coins >= 1) floatCenter(`+${fmt(away.coins)}`);
  renderHud(); renderGoals(true);
  A.levelStart(st.goals.stars + 1);
  A.ev('game_open', { lang, source: Q.source, touch: touchMode, returning: st.stats.answers > 0,
    away_min: Math.round(away.seconds / 60), stars: st.goals.stars, creatures: S.bookCount(st) });
  setTimeout(updateClickPlay, 400);
  save();
});
$('resetBtn').addEventListener('click', () => {
  if (!confirm(t('confirmReset'))) return;
  S.wipe(); st = S.newState(); away = { seconds: 0, coins: 0 };
  openZones.clear();
  $('welcome').classList.remove('on'); $('resetBtn').style.display = 'none';
  syncWorld();
});

// QA hooks (?debug)
if (DEBUG) {
  window.hatchery = {
    get state() { return st; }, world, player, thieves, S, get wild() { return wild; },
    get card() { return card; }, get target() { return target; },
    give(n) { S.addCoins(st, n); renderHud(); },
    ready() { st.incubators.forEach((x) => { if (x) x.start = 0; }); },
    stars(n) { st.goals.stars = n; checkGoals(); for (const z of ZONES) if (z.r && isOpen(z) && !openZones.has(z.id)) { openZones.add(z.id); world.setZoneOpen(z.id, true, true); } },
    tp(x, z, yaw) { player.pos.set(x, height(x, z), z); if (yaw !== undefined) player.yaw = yaw; },
    // stand next to the nearest open egg (of a rarity) and look at it
    toEgg(rarity) {
      const list = wild.filter((e) => isOpen(e.zone) && (!rarity || e.rarity === rarity));
      list.sort((a, b) => Math.hypot(a.x - player.pos.x, a.z - player.pos.z) - Math.hypot(b.x - player.pos.x, b.z - player.pos.z));
      const e = list[0]; if (!e) return null;
      this.tp(e.x, e.z + 2.2); player.lookAtPoint(e.x, e.z); return e.rarity;
    },
    home() { this.tp(PAD.x, PAD.z - 1); player.lookAtPoint(PAD.x, PAD.z + 6); },
    act, answer(right = true) { const q = card.steps[card.i]; answer(q.options.findIndex((o) => (o === q.answer) === right)); },
    sync: syncWorld, open: openPanel, catchMe() { const th = thieves.list[0]; if (st.carry.length) thiefCatch(th); },
  };
}
boot();
