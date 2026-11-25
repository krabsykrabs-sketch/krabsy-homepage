// Verb Hatchery (open-world version): run around the island in first person,
// answer to pick up eggs, carry them home past thief crabs, hatch creatures,
// earn coins, buy upgrades, open farther zones with stars. See ../CLAUDE.md.
import * as THREE from 'three';
import * as S from './state.js';
import { RARITIES, RARITY, UPGRADES, MAX_PENS, MAX_INCUBATORS, ZONES, HOME, ISLAND, EGG_RESPAWN, PLAYER, EVENTS, zoneRarities } from './balance.js';
import { World, INC_POS, PEN_POS, PAD, SPAWN, height, zoneAt, onIsland } from './world.js';
import { Player, touchMode, loadCharacters, LOOKS } from './player.js';
import { Thieves } from './thieves.js';
import { Minimap } from './minimap.js';
import { buildCreature, speciesName, animateCreature } from './creatures.js';
import { Raids } from './raid.js';
import { Hall, ROOM, HALL_DOOR, HALL_SPAWN, BARN_DOOR, BARN_OUT, PEDESTALS } from './hall.js';
import { ROSTER, isRosterId, isGolden, iconUrl, rosterTrick, creaturesOf, preload, entry as ENTRY } from './roster.js';
import { reserveSpots, buildDecor } from './decor.js';
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
const hall = new Hall(world);
const raids = new Raids(world);
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
const rName = (r) => t(`r_${r}`);
const zName = (z) => t(`zone_${z.id}`);
const isOpen = (z) => S.zoneOpen(st, z);
player.isLocked = (z) => !isOpen(z);

// colliders for the base: incubators and pens
// (switched on only once bought: world.setOwned sets .off; an unbought slot must not be an invisible wall)
world.incCols = INC_POS.map((p) => world.addCollider(p.x, p.z, 0.95));
world.penCols = PEN_POS.map((p) => world.addCollider(p.x, p.z, 1.9));

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
    if (isRosterId(sp)) return iconUrl(sp, silhouette); // (roster creatures have pre-made icons)
    const key = sp + (silhouette ? '#s' : '');
    if (cache.has(key)) return cache.get(key);
    const c = buildCreature(sp, { silhouette });
    c.rotation.y = -0.35;
    if (c.userData.mixer) c.userData.mixer.update(0.35); // a pose from the idle, not the bind pose
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
  hall.setOwned(S.hallOwned(st));
  st.hall.forEach((c, i) => { if (i < hall.slots.length) hall.setCreature(i, c ? c.sp : null); });
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
    if (!onIsland(x, z) || height(x, z) < 0.3 || world.noEggSpot(x, z)) continue;
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
  if (respawnLater && !e.event) respawn.push({ zone: e.zone, t: EGG_RESPAWN });
}
function fillEggs() {
  for (const z of ZONES) {
    let have = wild.filter((e) => e.zone === z && !e.event).length + respawn.filter((r) => r.zone === z).length;
    while (have < z.eggs && spawnWild(z)) have++;
  }
}

const entryHeight = (sp) => { const c = ENTRY(sp); return c ? c.scale : 1; };
// ── first minutes: guidance for new players (learning by doing) ──
// 1 walk to the egg → 2 pick it up → 3 bring it home to the pad → 4 it hatches (fast)
// → 5 hatch it → 6 "it earns coins" → done. A bouncing arrow shows where to go.
let tut = null; // { step, egg, t }
const tutArrow = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = '#ffcf5e'; x.strokeStyle = '#0d2240'; x.lineWidth = 5;
  x.beginPath(); x.moveTo(20, 6); x.lineTo(44, 6); x.lineTo(44, 30); x.lineTo(58, 30); x.lineTo(32, 58); x.lineTo(6, 30); x.lineTo(20, 30); x.closePath(); x.fill(); x.stroke();
  const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, depthTest: false, transparent: true }));
  s.scale.set(1.4, 1.4, 1); s.renderOrder = 6; s.visible = false;
  return s;
})();
function tutEgg() {
  const x = SPAWN.x + 1.5, z = SPAWN.z - 9; // just in front of the player
  const obj = world.makeWildEgg('common', x, z);
  const e = { obj, rarity: 'common', zone: ZONES[0], x, z, id: eggId++, tut: true };
  wild.push(e);
  return e;
}
function startTutorial() {
  if (st.tutDone || st.stats.answers > 0) { st.tutDone = true; return; }
  world.scene.add(tutArrow);
  tut = { step: 1, egg: tutEgg(), t: 0 };
  evtTimer = 1e9; // (no event egg while learning)
  A.ev('tutorial', { step: 1 });
}
function tutSay(key) {
  const k = touchMode && T_TOUCH.has(key) ? `${key}_touch` : key;
  const el = $('coach'), txt = t(k);
  if (el.textContent !== txt) { el.textContent = txt; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
  el.classList.add('on');
}
const T_TOUCH = new Set(['tut1', 'tut2', 'tut5', 'tut6']);
function tutStep(n) { tut.step = n; tut.t = 0; sfx.tap(); A.ev('tutorial', { step: n }); }
function updateTutorial(dt) {
  if (!tut) return;
  tut.t += dt;
  const bob = Math.abs(Math.sin(world.time * 3)) * 0.4;
  const point = (x, y, z) => { tutArrow.visible = true; tutArrow.position.set(x, y + bob, z); };
  if (tut.step === 1 || tut.step === 2) {
    if (!wild.includes(tut.egg) && !st.carry.length) tut.egg = tutEgg(); // (it rolled away: a new one)
    if (st.carry.length) tutStep(3);
    else {
      point(tut.egg.x, tut.egg.obj.position.y + 2.4, tut.egg.z);
      if (tut.step === 1 && target && target.kind === 'egg') tutStep(2);
      tutSay(tut.step === 1 ? 'tut1' : 'tut2');
    }
  }
  if (tut.step === 3) {
    point(PAD.x, PAD.y + 3.4, PAD.z); tutSay('tut3');
    const i = st.incubators.findIndex(Boolean);
    if (i >= 0) { st.incubators[i].dur = 8000; tut.inc = i; tutStep(4); } // (the first egg hatches fast)
  }
  if (tut.step === 4) {
    const inc = st.incubators[tut.inc];
    if (st.stats.hatched > 0) tutStep(5);
    else if (inc) { point(INC_POS[tut.inc].x, INC_POS[tut.inc].y + 3.2, INC_POS[tut.inc].z); tutSay(S.isReady(inc) ? 'tut5' : 'tut4'); }
  }
  if (tut.step === 5) {
    tutArrow.visible = false; tutSay('tut6');
    if (tut.t > 8) {
      tut = null; st.tutDone = true; evtTimer = EVENTS.first; save();
      $('coach').classList.remove('on'); world.scene.remove(tutArrow);
      A.ev('tutorial', { step: 6 });
    }
  }
}

// ── event eggs: now and then a zone's best egg appears, announced, for a while ──
let evt = null;                     // { egg, zone, t (seconds left) }
let evtTimer = EVENTS.first, lastEvtZone = null;
function spawnEventEgg(zone) {
  const spot = randomSpot(zone);
  if (!spot) return null;
  const obj = world.makeWildEgg(zone.event, spot[0], spot[1], { event: true });
  const e = { obj, rarity: zone.event, zone, x: spot[0], z: spot[1], id: eggId++, event: true };
  wild.push(e);
  return e;
}
function startEvent() {
  const open = ZONES.filter(isOpen);
  let pool = open.filter((z) => z !== lastEvtZone);
  if (!pool.length) pool = open;
  // farther zones a little more often (they have the better eggs)
  const w = pool.map((z) => ZONES.indexOf(z) + 1), sum = w.reduce((a, b) => a + b, 0);
  let x = Math.random() * sum, zone = pool[0];
  for (let i = 0; i < pool.length; i++) { x -= w[i]; if (x < 0) { zone = pool[i]; break; } }
  const egg = spawnEventEgg(zone);
  if (!egg) { evtTimer = 5; return; }
  evt = { egg, zone, t: EVENTS.duration };
  lastEvtZone = zone;
  sfx.star();
  toast(`⭐ ${t('evStart', rName(zone.event), zName(zone))}`, 'star');
  A.ev('egg_event_start', { zone: zone.id, rarity: zone.event });
}
function endEvent(result) {
  if (!evt) return;
  A.ev('egg_event_end', { zone: evt.zone.id, rarity: evt.zone.event, result, seconds_left: Math.round(evt.t) });
  if (result === 'expired') {
    const e = evt.egg;
    removeWild(e, false);
    toast(t('evGone'));
  }
  evt = null;
  evtTimer = EVENTS.gap[0] + Math.random() * (EVENTS.gap[1] - EVENTS.gap[0]);
  $('evBanner').classList.remove('on');
}
// ── crab raids on the base (raid.js) ──
function updateRaid(dt, paused) {
  const ev = raids.update(dt, { st, px: player.pos.x, pz: player.pos.z, indoor: !!player.indoor, tutorial: !!tut, paused });
  if (ev === 'start') {
    sfx.alarm(); setTimeout(() => sfx.alarm(), 350);
    toast(`🚨 ${t('raidStart')}`, 'warn');
    A.ev('raid', { result: 'start', rarity: raids.r.rarity });
  } else if (ev === 'caught') {
    // you got there in time: the question decides
    const r = raids.r;
    player.lookAtPoint(r.x, r.z); player.enabled = false;
    openCard({ kind: 'thief', thief: null, raid: true, rarity: r.rarity });
  } else if (ev === 'stolen') {
    st.incubators[raids.r.inc] = null; world.clearIncubator(raids.r.inc);
    raids.takeEgg(); sfx.steal();
    toast(`🚨 ${t('raidStolen')}`, 'warn');
    A.ev('raid', { result: 'stolen', rarity: raids.r.rarity });
    save();
  } else if (ev === 'recovered') {
    const r = raids.r;
    if (!st.incubators[r.inc]) { st.incubators[r.inc] = { rarity: r.rarity, zone: r.zone, start: Date.now(), dur: S.hatchDuration(st, r.rarity) * 1000 }; syncWorld(); }
    else st.carry.push({ r: r.rarity, z: r.zone }), player.showCarry(st.carry);
    raids.bonk(); sfx.bonk(); sfx.ding();
    floatCenter(`🥚 ${t('gotBack')}`);
    A.ev('raid', { result: 'recovered', rarity: r.rarity }); save();
  } else if (ev === 'escaped') {
    toast(t('crabEscaped'), 'warn'); A.ev('raid', { result: 'escaped', rarity: raids.r.rarity });
    raids.end();
  }
  // the banner while a raid is on
  const info = raids.info(), el = $('raidBanner');
  if (!info || info.state === 'dizzy') { el.classList.remove('on'); return; }
  const s = Math.ceil(info.left), dx = info.x - player.pos.x, dz = info.z - player.pos.z;
  const fwd = dx * -Math.sin(player.yaw) + dz * -Math.cos(player.yaw), right = dx * Math.cos(player.yaw) + dz * -Math.sin(player.yaw);
  const txt = info.state === 'flee' ? t('raidRun') : t('raidOn');
  el.innerHTML = `🚨 ${txt} <b>${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}</b> <span class="evArrow" style="transform:rotate(${Math.atan2(right, fwd)}rad)">➤</span> ${Math.round(Math.hypot(dx, dz))} m`;
  el.classList.add('on');
}
function raidResult(ok) {
  const r = raids.r; if (!r) return;
  if (ok) {
    raids.bonk(); sfx.bonk(); S.bonked(st);
    floatCenter(`💥 ${t('raidDefended')}`);
    A.ev('raid', { result: 'bonk', rarity: r.rarity });
  } else {
    if (r.state !== 'flee') { st.incubators[r.inc] = null; world.clearIncubator(r.inc); raids.takeEgg(); }
    sfx.steal(); toast(t('stolenChase'), 'warn');
    A.ev('raid', { result: 'stolen', rarity: r.rarity });
  }
  save(); checkGoals();
}
function updateEvent(dt, paused) {
  if (!evt) {
    if (!paused) { evtTimer -= dt; if (evtTimer <= 0) startEvent(); }
    return;
  }
  if (!paused) evt.t -= dt;
  if (evt.t <= 0) { endEvent('expired'); return; }
  // the egg: ring turns, star bobs
  const ud = evt.egg.obj.userData;
  ud.ring.rotation.y += dt * 1.5; ud.ring.scale.setScalar(1 + Math.sin(world.time * 4) * 0.08);
  ud.star.position.y = 2.4 + Math.sin(world.time * 3) * 0.2;
  // banner: what, where, time left, and an arrow towards it (relative to the camera)
  const s = Math.ceil(evt.t), time = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const dx = evt.egg.x - player.pos.x, dz = evt.egg.z - player.pos.z, dist = Math.hypot(dx, dz);
  const fwd = dx * -Math.sin(player.yaw) + dz * -Math.cos(player.yaw), right = dx * Math.cos(player.yaw) + dz * -Math.sin(player.yaw);
  const ang = Math.atan2(right, fwd);
  const html = `<span class="evDot" style="background:${RARITY[evt.zone.event].css}"></span>${t('egg', rName(evt.zone.event))} · ${zName(evt.zone)}`
    + ` <b>${time}</b> <span class="evArrow" style="transform:rotate(${ang}rad)">➤</span> ${Math.round(dist)} m`;
  const el = $('evBanner');
  el.innerHTML = html;
  el.classList.toggle('urgent', evt.t < 20);
  el.classList.add('on');
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
  $('toasts').appendChild(toastEl);
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
    const canPlace = S.available(st).length > 0;
    st.pens.forEach((c, i) => { if (i < S.pensOwned(st) && (c || canPlace)) consider(c ? 'pen' : 'penEmpty', i, PEN_POS[i].x, PEN_POS[i].z, PLAYER.reach + 1.4); });
    consider('hallDoor', 0, BARN_DOOR.x, BARN_DOOR.z, 2.8);
  }
  if (player.indoor) {
    consider('hallExit', 0, HALL_DOOR.x, HALL_DOOR.z, 2.8);
    const canPlace = S.available(st).length > 0;
    hall.slots.forEach((s, i) => { if (s.owned && (st.hall[i] || canPlace)) consider('pedestal', i, s.p.x, s.p.z, PLAYER.reach + 1.4); });
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
  if (tg.kind === 'penEmpty') return t('p_place');
  if (tg.kind === 'hallDoor') return `🏛️ ${t('p_enterHall')}`;
  if (tg.kind === 'hallExit') return t('p_leaveHall');
  if (tg.kind === 'pedestal') return st.hall[tg.ref] ? `${t('p_pen')} · ${speciesName(st.hall[tg.ref].sp)}` : t('p_place');
  return null;
}
function act() {
  if (!running || card || panel || !target) return;
  sfx.init();
  if (target.kind === 'egg') tryPickUp(target.ref);
  else if (target.kind === 'inc') tapIncubator(target.ref);
  else if (target.kind === 'pen') showCreature('pen', target.ref);
  else if (target.kind === 'penEmpty') openPicker('pen', target.ref);
  else if (target.kind === 'hallDoor') goHall(true);
  else if (target.kind === 'hallExit') goHall(false);
  else if (target.kind === 'pedestal') { if (st.hall[target.ref]) showCreature('hall', target.ref); else openPicker('hall', target.ref); }
}
// ── the Hall of Fame (hall.js): in and out through a quick fade ──
let fading = false;
function goHall(enter) {
  if (fading) return;
  fading = true; sfx.whoosh();
  $('fade').classList.add('on');
  setTimeout(() => {
    if (enter) {
      player.indoor = { x0: ROOM.x0 + 0.3, x1: ROOM.x1 - 0.3, z0: ROOM.z0 + 0.4, z1: ROOM.z1 - 0.3, y: ROOM.y, h: ROOM.h };
      player.spawn(HALL_SPAWN, Math.PI); player.camDist = Math.min(player.camDist, 4.5); player.pitch = -0.12; // (a flatter view: you see the pedestals and the banner)
      toast(`🏛️ ${t('hallWelcome')}`);
      A.ev('hall_enter', { placed: st.hall.filter(Boolean).length });
    } else {
      player.indoor = null;
      player.spawn(BARN_OUT, 0);
    }
    document.body.classList.toggle('indoor', enter);
    player.update(0);
    $('fade').classList.remove('on');
    setTimeout(() => { fading = false; }, 400);
  }, 380);
}
// Pick a creature from the Book for an empty pen or pedestal.
let pickFor = null;
function openPicker(where, i) {
  const list = S.available(st);
  if (!list.length) { sfx.denied(); toast(t('pickNone'), 'warn'); return; }
  pickFor = { where, i };
  sfx.tap();
  list.sort((a, b) => S.speciesIncome(b) - S.speciesIncome(a));
  $('pickTitle').textContent = where === 'hall' ? t('pickHall') : t('pickPen');
  $('pickList').innerHTML = list.map((sp) => {
    const r = S.speciesRarity(sp);
    return `<button class="bookCell pick" data-sp="${sp}" style="border-color:${RARITY[r].css}">${isGolden(sp) ? '<span class="goldMark">✨</span>' : ''}
      <img src="${portrait(sp)}" alt=""><div class="n">${speciesName(sp)}</div><div class="earnS">+${fmtRate(S.speciesIncome(sp) * (where === 'hall' ? 1.5 : 1))}/s</div></button>`;
  }).join('');
  $('pickList').querySelectorAll('.pick').forEach((b) => b.addEventListener('click', () => {
    if (!pickFor || !S.place(st, pickFor.where, pickFor.i, b.dataset.sp)) return;
    sfx.pop(); A.ev('creature_placed', { where: pickFor.where, rarity: S.speciesRarity(b.dataset.sp), golden: isGolden(b.dataset.sp) });
    pickFor = null; closePanel(); syncWorld(); renderHud(); save(); checkGoals();
  }));
  openPanel('pickPanel');
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
// buttons drop the keyboard focus after a click, so Space (jump) can't press them again
document.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setTimeout(() => b.blur(), 0); });
// a short click on the game (no drag) acts like E
player.onClick = () => { sfx.init(); act(); };
$('c').addEventListener('pointerdown', () => sfx.init());
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
  const el = $('card');
  el.style.setProperty('--rc', c.kind === 'thief' ? '#ff6b4a' : R.css);
  $('cardEgg').textContent = c.kind === 'thief' ? `🦀 ${t('thiefTitle')}` : t('egg', rName(c.rarity));
  $('cardSub').textContent = c.kind === 'thief' ? t('thiefSub') : (card.steps.length > 1 ? t('cardTwo') : t('cardOne'));
  const compact = c.kind === 'thief';
  el.classList.toggle('compact', compact); $('shade').classList.toggle('light', compact);
  $('shade').classList.add('on'); el.classList.add('on');
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
  S.recordAnswer(st, ok); Q.record(q, ok); S.trackWord(st, q, ok); A.countAnswer(ok);
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
  $('card').classList.remove('on'); $('shade').classList.remove('on', 'light');
  if (c.kind === 'egg') { if (ok) pickedUp(c.egg); else eggRollsAway(c.egg); }
  else if (c.raid) raidResult(ok);
  else thiefResult(c.thief, ok);
  renderHud();
}
function pickedUp(e) {
  const res = S.pickUp(st, e.rarity, e.zone.id);
  preload(creaturesOf(e.zone.id).map((c) => c.id)); // (their models load while the player walks home)
  if (!res) { eggRollsAway(e); return; }
  A.ev('egg_grabbed', { rarity: e.rarity, zone: e.zone.id, streak: st.stats.streak, carry: st.carry.length });
  A.countVisit('grabbed');
  sfx.pop();
  floatCenter(`+${fmt(res.bonus)}`);
  // the egg joins your line of eggs
  const from = e.obj.position.clone().add(new THREE.Vector3(0, 0.5, 0));
  removeWild(e);
  if (e.event && evt && evt.egg === e) { endEvent('grabbed'); toast(`⭐ ${t('evGot')}`, 'star'); }
  const m = e.obj; world.scene.add(m);
  player.gesture('PickUp');
  // the egg hops off its nest to the end of your line of eggs
  const to = new THREE.Vector3();
  world.tween(0.5, (k) => {
    const [tx, tz] = player.trailPoint(st.carry.length - 1);
    to.set(tx, height(tx, tz), tz);
    m.position.lerpVectors(from, to, k); m.position.y += Math.sin(k * Math.PI) * 1.4; m.scale.setScalar(1 - k * 0.15);
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
  // a special egg is not lost: it rolls off and waits somewhere else in its zone
  if (e.event && evt && evt.egg === e) {
    const again = spawnEventEgg(e.zone);
    if (again) { evt.egg = again; toast(t('evMoved', zName(e.zone))); } else endEvent('lost');
  }
}

// ── thieves ──
// A crab catches you: a short moment (the world stops, the camera turns to the crab,
// it snaps at the last egg of your line), then a compact card at the bottom so the
// scene stays visible. (owner: it was hard to see what happened)
let grab = null; // { th, t, egg }
function thiefCatch(th) {
  const top = st.carry[st.carry.length - 1].r;
  // put the crab a little in front of the player and look at it
  const p = player.pos, dx = th.x - p.x, dz = th.z - p.z, L = Math.hypot(dx, dz) || 1;
  th.x = p.x + (dx / L) * 2.4; th.z = p.z + (dz / L) * 2.4;
  th.dir = Math.atan2(-dx, -dz); th.move = th.dir; th.face = th.dir;
  player.lookAtPoint(th.x, th.z);
  player.camDist = Math.min(player.camDist, 7);
  thieves.update(0, { x: p.x, z: p.z, carrying: true }, isOpen, true);
  player.enabled = false;
  sfx.alarm(); player.gesture('Hit_A');
  grab = { th, t: 0, rarity: top };
  toast(`🦀 ${t('thiefTitle')}`, 'warn');
}
function updateGrab(dt) {
  grab.t += dt;
  // the crab's claws snap, it leans towards your last egg
  const body = grab.th.obj.userData.body;
  body.rotation.x = Math.sin(grab.t * 18) * 0.15;
  const tail = player.trail[player.trail.length - 1];
  if (tail) tail.mesh.position.lerp(new THREE.Vector3(grab.th.x, tail.mesh.position.y + 0.02, grab.th.z), Math.min(1, dt * 1.2));
  if (grab.t > 0.85) {
    body.rotation.x = 0;
    const g = grab; grab = null;
    openCard({ kind: 'thief', thief: g.th, rarity: g.rarity });
  }
}
function recoverEgg(th) {
  const egg = thieves.recover(th);
  if (!egg) return;
  st.carry.push(egg);
  player.showCarry(st.carry);
  sfx.ding(); sfx.bonk();
  floatCenter(`🥚 ${t('gotBack')}`);
  A.ev('thief_catch', { zone: th.zone.id, result: 'recovered', rarity: egg.r });
  save();
}
function thiefResult(th, ok) {
  if (ok) {
    S.bonked(st); thieves.knock(th, player.pos.x, player.pos.z); sfx.bonk();
    floatCenter(`💥 ${t('eggSaved')}`);
    A.ev('thief_catch', { zone: th.zone.id, result: 'bonk' });
  } else {
    const egg = S.stealTop(st), r = egg && egg.r;
    if (r) thieves.steal(th, r, egg);
    sfx.steal(); toast(t('stolenChase'), 'warn'); player.gesture('Hit_A');
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
    sfx.hatch(res.rarity); setTimeout(() => sfx.creature(entryHeight(res.sp)), 450);
    world.clearIncubator(i);
    shellBurst(INC_POS[i].clone().setY(INC_POS[i].y + 0.9), res.rarity);
    showReveal(res);
    const cr = buildCreature(res.sp);
    cr.position.copy(INC_POS[i]).setY(INC_POS[i].y + 0.55);
    cr.rotation.y = Math.atan2(player.pos.x - cr.position.x, player.pos.z - cr.position.z); // (it looks at you when it hatches)
    world.scene.add(cr); world.extra.add(cr);
    const S0 = cr.userData.real ? Math.min(1.7, 2.0 / cr.userData.height) : 1.5; // (its size when it pops out)
    if (cr.userData.real) setTimeout(() => rosterTrick(cr, 'jump'), 450);
    world.tween(0.4, (k) => cr.scale.setScalar(Math.max(0.01, k < 0.7 ? k / 0.7 * S0 * 1.1 : S0 * (1.1 - (k - 0.7) / 0.3 * 0.1))));
    if (res.waiting) setTimeout(() => { world.scene.remove(cr); world.extra.delete(cr); syncWorld(); }, 900);
    else jumpToPen(cr, res.pen, 1.6);
    save(); checkGoals();
  });
}
function jumpToPen(cr, pen, delay) {
  setTimeout(() => {
    const from = cr.position.clone(), to = PEN_POS[pen].clone().setY(PEN_POS[pen].y + 0.25);
    const r0 = cr.rotation.y; let d = Math.PI - r0; d = Math.atan2(Math.sin(d), Math.cos(d)); // (turns to face the path while it jumps, like in the pen)
    world.tween(0.8, (k) => { cr.position.lerpVectors(from, to, k); cr.position.y += Math.sin(k * Math.PI) * 3.5; cr.rotation.y = r0 + d * k; },
      () => { world.scene.remove(cr); world.extra.delete(cr); syncWorld(); });
  }, delay * 1000);
}
function placeWaiting(i) {
  const sp = st.incubators[i].sp;
  const res = S.hatch(st, i);
  if (!res || res.waiting) return;
  world.clearIncubator(i);
  const cr = buildCreature(sp);
  cr.position.copy(INC_POS[i]).setY(INC_POS[i].y + 0.55);
  world.scene.add(cr); world.extra.add(cr);
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
  if (isGolden(res.sp)) $('revInfo').textContent = `${t('goldenFound')} · ${$('revInfo').textContent}`;
  el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
  clearTimeout(revealTimer);
  revealTimer = setTimeout(() => el.classList.remove('on'), res.waiting ? 4200 : 3000);
}
let infoPen = -1, infoWhere = 'pen';
function showCreature(where, i) {
  const c = (where === 'hall' ? st.hall : st.pens)[i];
  if (!c) return;
  sfx.tap();
  infoPen = i; infoWhere = where;
  sfx.creature(entryHeight(c.sp));
  const r = S.speciesRarity(c.sp);
  $('ciImg').src = portrait(c.sp);
  $('ciName').textContent = speciesName(c.sp);
  $('ciR').textContent = rName(r); $('ciR').style.background = RARITY[r].css;
  $('ciEarn').textContent = t('earns', fmtRate(S.speciesIncome(c.sp) * (where === 'hall' ? 1.5 : 1)));
  $('ciRelease').textContent = t('toBook');
  $('ciAsk').textContent = t('toBookAsk');
  openPanel('creatureInfo');
}
$('ciRelease').addEventListener('click', () => {
  if (infoPen < 0) return;
  S.toBook(st, infoWhere, infoPen);
  sfx.tap();
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
}
function closePanel() {
  if (!panel) return;
  panel.classList.remove('on'); $('shade').classList.remove('on');
  panel = null;
}
document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closePanel));
$('shade').addEventListener('click', () => { if (panel) closePanel(); });
$('upBtn').addEventListener('click', () => { sfx.init(); sfx.tap(); openPanel('upPanel'); });
$('bookBtn').addEventListener('click', () => { sfx.init(); sfx.tap(); openPanel('bookPanel'); });

const UP_ICON = { pen: '🏡', incubator: '🥚', hatchSpeed: '💡', shoes: '👟', backpack: '🎒', hall: '🏛️' };
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
// The Book: one section per zone with all its creatures (sorted by rarity, border in
// the rarity's colour), found ones with picture and name, missing ones as silhouettes;
// ✨ = also found as a golden version.
function renderBook() {
  $('bookHow').textContent = `${t('bookFound', S.bookCount(st), ROSTER.length)} · ${t('bookHow')}`;
  const gold = st.gold || {};
  const words = S.wordsToPractise(st).slice(0, 12);
  const wordsHtml = `<div class="bookR words"><h3>📝 ${t('wordsTitle')} <small>${words.length ? t('wordsHow') : ''}</small></h3>` +
    (words.length ? `<div class="wordList">${words.map((w) => `<div class="word"><span class="base">${w.base}</span><span class="arrow">→</span><span class="past">${w.past}</span><span class="arrow">→</span><span class="pp">${w.pp}</span>${w.ok ? ' <span class="wOk">✓</span>' : ''}</div>`).join('')}</div>`
      : `<div class="wordNone">${t('wordsNone')}</div>`) + '</div>';
  $('bookList').innerHTML = wordsHtml + ZONES.map((z) => {
    const list = creaturesOf(z.id);
    const found = list.filter((c) => st.book[c.id]).length;
    const eggs = zoneRarities(z).map((r) => `<span class="evDot" style="background:${RARITY[r].css}" title="${rName(r)}"></span>${z.event === r ? '⭐' : ''}`).join(' ');
    const cells = list.map((c) => {
      const has = !!st.book[c.id];
      return `<div class="bookCell ${has ? '' : 'miss'}" style="border-color:${has ? RARITY[c.rarity].css : 'transparent'}" title="${rName(c.rarity)}">
        ${gold[c.id] ? '<span class="goldMark">✨</span>' : ''}<img src="${portrait(c.id, !has)}" alt="" loading="lazy"><div class="n">${has ? speciesName(c.id) : '???'}</div></div>`;
    }).join('');
    const lock = isOpen(z) ? '' : ` 🔒 ★${z.stars}`;
    return `<div class="bookR"><h3>${zName(z)}${lock} <small>${found}/${list.length} &nbsp; ${eggs}</small></h3><div class="bookGrid">${cells}</div></div>`;
  }).join('') + `<div class="bookNote">⭐ = ${t('bookEvent')} · ✨ = ${t('bookGolden')}</div>`;
}

// ── sound ──
function soundIcon() { $('soundBtn').textContent = { all: '🔊', fx: '🔈', off: '🔇' }[sfx.mode]; $('soundBtn').title = t(`sound_${sfx.mode}`); }
soundIcon();
$('soundBtn').addEventListener('click', () => { sfx.init(); sfx.cycleMode(); soundIcon(); toast(t(`sound_${sfx.mode}`)); });

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
  else { world.cover?.setDensity(0.5); world.sun.shadow.mapSize.set(1024, 1024); world.sun.shadow.map?.dispose(); world.sun.shadow.map = null; world.renderer.shadowMap.type = THREE.PCFShadowMap; }
  world.resize();
  A.ev('quality_down', { level: qLevel, fps: Math.round(fps) });
}

// ── main loop ──
let last = performance.now();
const chasing = new Set();
let heartT = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  adaptQuality(dt);
  if (running) {
    const paused = !!card || !!panel || !!grab;
    player.enabled = !paused;
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
      if (ud.beam) {
        ud.beam.visible = Math.hypot(e.x - player.pos.x, e.z - player.pos.z) > 6;
        // thin up close, but never thinner than a few pixels from far away (event beams are big anyway)
        if (!e.event) { const k = Math.min(5, Math.max(1, world.camera.position.distanceTo(e.obj.position) / 28)); ud.beam.scale.set(k, 1, k); }
      }
    }
    for (const r of respawn) r.t -= dt;
    const due = respawn.filter((r) => r.t <= 0);
    respawn = respawn.filter((r) => r.t > 0);
    for (const r of due) spawnWild(r.zone);
    updateEvent(dt, paused);
    updateRaid(dt, paused);
    if (!paused) updateTutorial(dt);
    // thieves
    const caught = thieves.update(dt, { x: player.pos.x, z: player.pos.z, carrying: st.carry.length > 0 }, isOpen, paused);
    let hunted = false, runner = null;
    for (const th of thieves.list) {
      if (th.state === 'chase' && !chasing.has(th)) { chasing.add(th); sfx.alarm(); }
      if (th.state !== 'chase') chasing.delete(th);
      if (th.state === 'chase') hunted = true;
      // a crab running off with your egg: catch it to get the egg back
      if (th.state === 'flee' && th.stolen) {
        runner = th;
        if (!paused && Math.hypot(th.x - player.pos.x, th.z - player.pos.z) < 1.7) recoverEgg(th);
      }
      if (th.escaped) { th.escaped = false; toast(t('crabEscaped'), 'warn'); A.ev('thief_catch', { zone: th.zone.id, result: 'escaped' }); }
    }
    // being hunted: red pulsing screen edge + heartbeat
    document.body.classList.toggle('hunted', hunted && !paused);
    sfx.setMood(player.indoor ? 'hall' : hunted || runner ? 'chase' : 'calm');
    if (hunted && !paused) { heartT -= dt; if (heartT <= 0) { heartT = 0.62; sfx.heart(); } } else heartT = 0;
    if (caught && !paused && st.carry.length) thiefCatch(caught);
    if (grab) updateGrab(dt);
    if (!paused) checkPad(dt);
    world.wantPadSign = st.carry.length > 0;
    // zone name when entering
    const z = zoneAt(player.pos.x, player.pos.z);
    if (z !== curZone) { curZone = z; showZoneName(zName(z)); }
    // locked zone close by → hint
    let hint = null;
    for (const zz of ZONES) {
      if (zz.r && !isOpen(zz) && Math.hypot(player.pos.x - zz.x, player.pos.z - zz.z) < zz.r + 6) hint = t('zoneLockedHint', zName(zz), zz.stars);
    }
    if (runner) hint = t('getBack', Math.max(1, Math.ceil(runner.timer)));
    else if (hunted) hint = t('huntWarn');
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
      map.draw({ player: player.pos, yaw: player.yaw, eggs: wild, thieves: thieves.list, isOpen, carrying: st.carry.length > 0, raid: raids.info() });
    }
  } else {
    // before Play: a slow look around from the hatchery
    player.yaw += dt * 0.08;
    player.update(0);
  }
  hall.update(dt, animateCreature);
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
  reserveSpots(world);
  const decor = world.loadDecor().then(() => buildDecor(world)).catch((e) => console.error('decor', e))
    .then(() => world.batch.build(true)); // merge all static props into a few meshes
  requestAnimationFrame(frame);
  $('playBtn').textContent = t('loading');
  await Promise.all([Q.init(), decor, loadCharacters().catch((e) => console.error('characters', e)),
  ]);
  // creatures built before the animals were loaded: build them again
  world.pens.forEach((p) => { if (p.sp) p.sp = '#reload'; });
  world.incubators.forEach((c, i) => { if (c.waiting) world.clearIncubator(i); });
  syncWorld();
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
  if (away.coins >= 1) floatCenter(`+${fmt(away.coins)}`);
  renderHud(); renderGoals(true);
  startTutorial();
  A.levelStart(st.goals.stars + 1);
  A.ev('game_open', { lang, source: Q.source, touch: touchMode, returning: st.stats.answers > 0,
    away_min: Math.round(away.seconds / 60), stars: st.goals.stars, creatures: S.bookCount(st) });
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
    get state() { return st; }, world, player, thieves, S, sfx, get wild() { return wild; },
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
    raids, startRaid() { raids.timer = 0; },
    skipTut() { if (tut) { tut = null; st.tutDone = true; $('coach').classList.remove('on'); world.scene.remove(tutArrow); evtTimer = EVENTS.first; } },
    sync: syncWorld, open: openPanel, get evt() { return evt; }, startEvent, evtIn(sec) { evtTimer = sec; },
    toEvent() { if (!evt) return null; this.tp(evt.egg.x, evt.egg.z + 3); player.lookAtPoint(evt.egg.x, evt.egg.z); return evt.zone.id; }, catchMe() { const th = thieves.list[0]; if (st.carry.length) thiefCatch(th); },
  };
}
boot();
