// Verb Hatchery: eggs ride past on a belt, a right answer grabs one, eggs hatch
// into creatures that earn coins, coins buy upgrades. See ../CLAUDE.md.
import * as THREE from 'three';
import * as S from './state.js';
import { RARITIES, RARITY, BELT, UPGRADES, MAX_PENS } from './balance.js';
import { World, INC_POS, PEN_POS, BELT_Y, BELT_Z } from './scene.js';
import { buildCreature, speciesName } from './creatures.js';
import * as Q from './questions.js';
import { t, lang, fmt, fmtRate, fmtTime } from './i18n.js';
import { sfx } from './audio.js';
import * as A from './analytics.js';

const $ = (id) => document.getElementById(id);
const world = new World($('c'));
let st = S.load() || S.newState();
let away = { seconds: 0, coins: 0 };
let running = false;
let card = null;        // the open question: { egg, pair, steps, i, answered, ok }
let panel = null;       // open panel element
let spawnT = 1.2, eggId = 0, saveT = 0, goalT = 0, lastCoins = 0;

// ── static texts ──
$('tagline').textContent = t('tagline');
$('goalsTitle').textContent = t('goals');
$('upLbl').textContent = t('upgrades'); $('upTitle').textContent = t('upgrades');
$('bookLbl').textContent = t('book'); $('bookTitle').textContent = t('book');
$('goOn').textContent = t('goOn');
$('rotate').textContent = t('rotate');
$('resetBtn').textContent = t('newGame');
const rName = (r) => t(`r_${r}`);

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

// ── rebuild the 3D world from the state ──
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
}

// ── labels above incubators ──
const incLabels = world.incubators.map(() => {
  const el = document.createElement('div'); el.className = 'lbl'; el.style.display = 'none';
  document.body.appendChild(el); return el;
});
function updateLabels() {
  const now = Date.now();
  st.incubators.forEach((inc, i) => {
    const el = incLabels[i], c = world.incubators[i];
    if (!inc || !c.owned || !running) { el.style.display = 'none'; c.ready = false; return; }
    const ready = S.isReady(inc, now);
    c.ready = ready && !inc.sp;
    const p = world.toScreen(INC_POS[i].clone().setY(2.0));
    el.style.display = ''; el.style.left = `${p.x}px`; el.style.top = `${p.y}px`;
    let cls = 'lbl', txt;
    if (inc.sp) { cls += ' wait'; txt = t('waitingPen'); }
    else if (ready) { cls += ' ready'; txt = t('tapToHatch'); }
    else { const s = Math.ceil(S.hatchLeft(inc, now)); txt = s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s}s`; }
    if (el.className !== cls) el.className = cls;
    if (el.textContent !== txt) el.textContent = txt;
  });
}

// ── floating numbers and toasts ──
function floatAt(v3, text, big = false) {
  const p = world.toScreen(v3);
  const el = document.createElement('div');
  el.className = 'float' + (big ? ' big' : '');
  el.textContent = text; el.style.left = `${p.x}px`; el.style.top = `${p.y}px`;
  document.body.appendChild(el);
  requestAnimationFrame(() => { el.style.transform = 'translate(-50%,-50%) translateY(-60px)'; el.style.opacity = '0'; });
  setTimeout(() => el.remove(), 1200);
}
let toastEl = null, toastTimer = 0;
function toast(text, kind = '') {
  if (toastEl) toastEl.remove();
  toastEl = document.createElement('div'); toastEl.className = 'toast ' + kind; toastEl.textContent = text;
  document.body.appendChild(toastEl);
  clearTimeout(toastTimer);
  const el = toastEl;
  toastTimer = setTimeout(() => { el.remove(); if (toastEl === el) toastEl = null; }, kind === 'star' ? 2600 : 2200);
}

// ── HUD ──
function goalText(g) {
  const r = g.r ? rName(g.r) : '';
  const n = g.kind === 'cps' ? fmt(g.n) : g.n;
  return t(`g_${g.kind}`, n, r);
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
    if (c > lastCoins + 0.5 && c - lastCoins > S.cps(st) * 1.5) { $('money').classList.remove('bump'); void $('money').offsetWidth; $('money').classList.add('bump'); }
    lastCoins = c;
  }
  $('cps').textContent = `+${fmtRate(S.cps(st))}${t('perSec')}`;
  $('starN').textContent = st.goals.stars;
  const affordable = Object.keys(UPGRADES).some((k) => S.canBuy(st, k));
  $('upBadge').classList.toggle('on', affordable);
  renderGoals();
  if (panel === $('upPanel')) refreshUpgradeButtons();
}

// ── goals and stars ──
function checkGoals() {
  const done = S.checkGoals(st);
  for (const g of done) {
    sfx.star();
    toast(`★ ${t('star')}`, 'star');
    A.ev('goal_done', { goal: g.id, kind: g.kind, stars: st.goals.stars });
    A.levelEnd({ coins: Math.floor(st.coins), creatures: S.bookCount(st), cps: Math.round(S.cps(st)) });
    A.levelStart(st.goals.stars + 1);
  }
  if (done.length) { renderGoals(true); save(); }
}

// ── belt ──
function spawn() {
  const r = S.rollRarity(st);
  world.spawnEgg(r, eggId++);
}
const beltRunning = () => running && !card && !panel;

// ── taps ──
$('c').addEventListener('pointerdown', (e) => {
  if (!running || card || panel) return;
  sfx.init();
  const hit = world.pick(e.clientX, e.clientY);
  if (!hit) return;
  if (hit.type === 'egg') tapEgg(hit.egg);
  else if (hit.type === 'inc') tapIncubator(hit.i);
  else if (hit.type === 'pen') tapPen(hit.i);
  else if (hit.type === 'lockedPen') openPanel('upPanel');
});

function tapEgg(egg) {
  if (S.freeIncubator(st) < 0) {
    sfx.denied();
    const waiting = st.incubators.some((x) => x && x.sp);
    toast(waiting ? t('incFullWaiting') : t('incFull'), 'warn');
    world.incubators.forEach((c) => {
      if (!c.owned) return;
      world.tween(0.5, (k) => c.group.scale.setScalar(1 + Math.sin(k * Math.PI) * 0.15), () => c.group.scale.setScalar(1));
    });
    return;
  }
  sfx.open();
  openCard(egg);
}

// ── question card ──
function openCard(egg) {
  const R = RARITY[egg.rarity];
  const pair = Q.nextPair(R.tier);
  card = { egg, pair, steps: Q.stepsFor(pair, R.pair), i: 0, ok: true };
  egg.obj.position.y = BELT_Y + 0.25;
  sfx.belt(false);
  const el = $('card');
  el.style.setProperty('--rc', R.css);
  $('cardEgg').textContent = t('egg', rName(egg.rarity));
  $('cardSub').textContent = card.steps.length > 1 ? t('cardTwo') : t('cardOne');
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
  if (!card || card.answered) return;
  const q = card.steps[card.i];
  const chosen = q.options[k];
  const ok = chosen === q.answer;
  card.answered = true;
  S.recordAnswer(st, ok); Q.record(q, ok); A.countAnswer(ok);
  const chips = [...$('chips').querySelectorAll('.chip')];
  chips.forEach((c, j) => {
    if (q.options[j] === q.answer) c.classList.add('right');
    else c.classList.add('off');
  });
  // what the trio may show now: never reveal a 3rd form that the next step asks
  const last = card.i === card.steps.length - 1;
  const showPp = q.ask === 'pp' || q.full;
  $('trio').innerHTML = trioHtml(q, { past: true, pp: showPp });
  if (ok) {
    sfx.right();
    $('feedback').innerHTML = `<div class="ok">${t('right')}</div>`;
    if (!last) { setTimeout(() => { if (card) { card.i++; showStep(); } }, 750); return; }
    setTimeout(() => closeCard(true), 650);
  } else {
    sfx.wrong();
    card.ok = false;
    Q.missed(card.pair);
    const chain = `<span class="base">${q.base}</span><span class="arrow">→</span><span class="past">${q.past}</span><span class="arrow">→</span>` +
      (showPp ? `<span class="pp">${q.pp}</span>` : '<span style="color:#42577f">___</span>');
    $('feedback').innerHTML = `<div class="bad">${t('wrong')}</div><div class="teach">${chain}</div><div class="small">${t('eggRolled')}</div>`;
    $('goOn').classList.add('on');
  }
}
$('goOn').addEventListener('click', () => closeCard(false));
function closeCard(ok) {
  if (!card) return;
  const { egg } = card;
  card = null;
  $('card').classList.remove('on'); $('shade').classList.remove('on');
  sfx.belt(true);
  world.removeEgg(egg);
  if (ok) grab(egg); else lose(egg);
  renderHud();
}
function grab(egg) {
  const res = S.grabEgg(st, egg.rarity);
  if (!res) { lose(egg); return; }
  A.ev('egg_grabbed', { rarity: egg.rarity, streak: st.stats.streak });
  A.countVisit('grabbed');
  floatAt(egg.obj.position.clone().setY(1.6), `+${fmt(res.bonus)}`, true);
  sfx.pop();
  const from = egg.obj.position.clone(), to = INC_POS[res.index].clone().setY(0.55);
  world.tween(0.6, (k) => {
    egg.obj.position.lerpVectors(from, to, k);
    egg.obj.position.y += Math.sin(k * Math.PI) * 3;
    egg.obj.rotation.z = k * Math.PI * 2;
  }, () => { world.scene.remove(egg.obj); syncWorld(); });
  save();
  checkGoals();
}
function lose(egg) {
  S.loseEgg(st);
  A.ev('egg_lost', { rarity: egg.rarity });
  sfx.roll();
  const from = egg.obj.position.clone();
  world.tween(1.0, (k) => {
    egg.obj.position.set(from.x + k * 1.5, from.y + Math.sin(k * Math.PI) * 0.6 - k * k * 2.2, from.z + k * 2.6);
    egg.obj.rotation.x = k * 8;
  }, () => world.scene.remove(egg.obj));
}
addEventListener('keydown', (e) => {
  if (card) {
    if (!card.answered && ['1', '2', '3'].includes(e.key)) answer(+e.key - 1);
    else if (card.answered && $('goOn').classList.contains('on') && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); closeCard(false); }
  } else if (panel && e.key === 'Escape') closePanel();
});

// ── hatching ──
function tapIncubator(i) {
  const inc = st.incubators[i];
  if (!inc) return;
  if (inc.sp) { // waiting for a pen
    if (S.freePen(st) >= 0) placeWaiting(i); else { sfx.denied(); toast(t('incFullWaiting'), 'warn'); }
    return;
  }
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
  sfx.crack();
  // shake, then burst
  world.tween(0.55, (k) => { if (egg) { egg.rotation.z = Math.sin(k * 40) * 0.25 * k; egg.scale.setScalar(1 + k * 0.25); } }, () => {
    sfx.hatch(res.rarity);
    world.clearIncubator(i);
    shellBurst(INC_POS[i].clone().setY(0.9), res.rarity);
    showReveal(res);
    const cr = buildCreature(res.sp);
    cr.position.copy(INC_POS[i]).setY(0.55);
    world.scene.add(cr);
    world.tween(0.4, (k) => cr.scale.setScalar(Math.max(0.01, k < 0.7 ? k / 0.7 * 1.3 : 1.3 - (k - 0.7) / 0.3 * 0.3)));
    if (res.waiting) {
      setTimeout(() => { world.scene.remove(cr); syncWorld(); }, 900);
    } else {
      jumpToPen(cr, res.pen, 0.9);
    }
    save();
    checkGoals();
  });
}
function jumpToPen(cr, pen, delay) {
  setTimeout(() => {
    const from = cr.position.clone(), to = PEN_POS[pen].clone().setY(0.3);
    world.tween(0.8, (k) => {
      cr.position.lerpVectors(from, to, k); cr.position.y += Math.sin(k * Math.PI) * 3.2;
      cr.scale.setScalar(1 + k * 0.25);
    }, () => { world.scene.remove(cr); syncWorld(); });
  }, delay * 1000);
}
function placeWaiting(i) {
  const inc = st.incubators[i];
  const res = S.hatch(st, i);
  if (!res || res.waiting) return;
  world.clearIncubator(i);
  const cr = buildCreature(inc.sp || res.sp);
  cr.position.copy(INC_POS[i]).setY(0.55);
  world.scene.add(cr);
  sfx.pop();
  jumpToPen(cr, res.pen, 0);
  save();
}
const shellGeo = new THREE.TetrahedronGeometry(0.13);
function shellBurst(at, rarity) {
  const m = new THREE.MeshStandardMaterial({ color: RARITY[rarity].color, roughness: 0.6 });
  for (let k = 0; k < 10; k++) {
    const s = new THREE.Mesh(shellGeo, m); s.position.copy(at); world.scene.add(s);
    const v = new THREE.Vector3((Math.random() - 0.5) * 5, 3 + Math.random() * 3, (Math.random() - 0.5) * 5);
    world.tween(0.9, (q, dt) => { v.y -= 12 * dt; s.position.addScaledVector(v, dt); s.rotation.x += dt * 8; if (s.position.y < 0.05) s.position.y = 0.05; },
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

// ── pens: tap a creature to see it (and let it go) ──
let infoPen = -1;
function tapPen(i) {
  const c = st.pens[i];
  if (!c) { sfx.tap(); toast(t('penEmpty')); return; }
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
  floatAt(PEN_POS[infoPen].clone().setY(1.8), `+${fmt(coins)}`, true);
  sfx.ding();
  infoPen = -1;
  closePanel();
  syncWorld(); renderHud(); save();
});

// ── panels ──
function openPanel(id) {
  closePanel();
  panel = $(id);
  if (id === 'upPanel') renderUpgrades();
  if (id === 'bookPanel') renderBook();
  panel.classList.add('on'); $('shade').classList.add('on');
  sfx.belt(false);
}
function closePanel() {
  if (!panel) return;
  panel.classList.remove('on'); $('shade').classList.remove('on');
  panel = null;
  sfx.belt(true);
}
document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closePanel));
$('shade').addEventListener('click', () => { if (panel) closePanel(); });
$('upBtn').addEventListener('click', () => { sfx.init(); sfx.tap(); openPanel('upPanel'); });
$('bookBtn').addEventListener('click', () => { sfx.init(); sfx.tap(); openPanel('bookPanel'); });

const UP_ICON = { pen: '🏡', incubator: '🥚', hatchSpeed: '💡', beltLuck: '🍀' };
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
  // new pens take creatures that wait in incubators
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

// ── sound button ──
function soundIcon() { $('soundBtn').textContent = sfx.muted ? '🔇' : '🔊'; }
soundIcon();
$('soundBtn').addEventListener('click', () => { sfx.init(); sfx.setMuted(!sfx.muted); soundIcon(); });

// ── save ──
function save() { S.save(st); }
A.onSummary(() => ({ coins_per_sec: Math.round(S.cps(st)), creatures: S.bookCount(st), stars: st.goals.stars }));
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') save(); });
addEventListener('pagehide', save);

// ── main loop ──
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (running) {
    const earned = S.tick(st, dt);
    // coin floats over pens (visual only, the real income is continuous)
    world.pens.forEach((p, i) => {
      if (!p.owned || !st.pens[i]) return;
      p.nextCoin -= dt;
      if (p.nextCoin <= 0) {
        p.nextCoin = 3 + Math.random() * 1.5;
        floatAt(PEN_POS[i].clone().setY(2.2), `+${fmt(S.speciesIncome(st.pens[i].sp) * 3)}`);
        sfx.plink();
      }
    });
    if (beltRunning()) {
      spawnT -= dt;
      if (spawnT <= 0) { spawnT = BELT.spawnEvery * (0.8 + Math.random() * 0.4); spawn(); }
    }
    world.updateBelt(beltRunning() ? dt : 0, BELT.speed, card ? card.egg : null);
    saveT += dt; if (saveT > 5) { saveT = 0; save(); }
    goalT += dt; if (goalT > 0.4) { goalT = 0; checkGoals(); renderHud(); }
    void earned;
  }
  world.update(dt);
  updateLabels();
  requestAnimationFrame(frame);
}

// ── start ──
async function boot() {
  syncWorld();
  world.loadDecor();
  // a few eggs already on the belt
  for (let k = 0; k < 6; k++) { const e = world.spawnEgg(S.rollRarity(st), eggId++); e.x = -12 + k * 4.2; e.obj.position.x = e.x; }
  requestAnimationFrame(frame);
  $('playBtn').textContent = t('loading');
  await Q.init();
  away = S.applyAway(st);
  const ready = st.incubators.filter((x) => x && S.isReady(x)).length;
  const parts = [];
  if (away.coins >= 1) parts.push(t('awayEarned', fmt(away.coins), fmtTime(Math.min(away.seconds, 8 * 3600))));
  if (ready) parts.push(t('eggsReady', ready));
  if (parts.length) { $('welcome').innerHTML = `<div class="fredoka" style="color:var(--amber);font-size:20px">${t('welcomeBack')}</div>${parts.join('<br>')}`; $('welcome').classList.add('on'); }
  $('resetBtn').style.display = st.stats.answers ? '' : 'none';
  $('playBtn').textContent = t('play');
  $('playBtn').disabled = false;
  lastCoins = -1;
}
$('playBtn').addEventListener('click', () => {
  sfx.init();
  $('start').classList.add('off');
  $('hud').classList.add('on');
  running = true;
  if (away.coins >= 1) floatAt(new THREE.Vector3(0, 3, 0), `+${fmt(away.coins)}`, true);
  renderHud(); renderGoals(true);
  A.levelStart(st.goals.stars + 1);
  A.ev('game_open', { lang, source: Q.source, returning: st.stats.answers > 0, away_min: Math.round(away.seconds / 60),
    stars: st.goals.stars, creatures: S.bookCount(st) });
  save();
});
$('resetBtn').addEventListener('click', () => {
  if (!confirm(t('confirmReset'))) return;
  S.wipe(); st = S.newState(); away = { seconds: 0, coins: 0 };
  $('welcome').classList.remove('on'); $('resetBtn').style.display = 'none';
  syncWorld();
});

// QA hooks (?debug): window.hatchery.state, .give(n), .ready()
if (/[?&]debug/.test(location.search)) {
  window.hatchery = {
    get state() { return st; }, world, S,
    give(n) { S.addCoins(st, n); renderHud(); },
    ready() { st.incubators.forEach((x) => { if (x) x.start = 0; }); },
    get card() { return card; },
    // tap the k-th egg near the middle of the belt; answer right (true) or wrong
    tapEgg(k = 0) { const e = world.eggs.filter((x) => x.x > -9 && x.x < 9)[k] || world.eggs[0]; tapEgg(e); return e.rarity; },
    answer(right = true) { const q = card.steps[card.i]; answer(q.options.findIndex((o) => (o === q.answer) === right)); },
    tapInc(i) { tapIncubator(i); }, sync: syncWorld, tapPen(i) { tapPen(i); }, open: openPanel,
  };
}
boot();
