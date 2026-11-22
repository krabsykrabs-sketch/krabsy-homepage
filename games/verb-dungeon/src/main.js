// Verb Dungeon: game loop, rules and interface.
// One room is on screen at a time, seen by a fixed camera. Rules in short:
//   do the room's goal (GOALS, by room type): find the hidden key (in a skeleton or a
//   crate) and answer both forms of its verb in the question card → the door opens by
//   itself → next room. Rune doors and the word bridge are the verb question themselves
//   and open the exit. The last room is the boss: answer on the glowing stone to stun
//   the golem, then bonk it. Coins (chests, boss, treasure room) buy other heroes.
//   Chests are optional bonus questions. The question card pauses the whole room.
import * as THREE from 'three';
import { Assets } from './assets.js';
import { Char } from './chars.js';
import { buildRoom, DOOR, BOUNDS, TORCH_SPOTS, PITS, STONE, glowTex, makeGlow } from './room.js';
import { initMarks, markUsable, unmark, clearMarks, updateMarks, markCount } from './marker.js';
import { LEVELS } from './levels.js';
import { loadPairs, again, single } from './questions.js';
import { makeLabel } from './labels.js';
import * as Q from './questions.js';
import { t, lang } from './i18n.js';
import { HEROES, SWINGS, heroDef, Save } from './heroes.js';
import { sfx } from './audio.js';
import { initTouch, stick, holdStick, touchOn, resetTouch, swordIcon } from './touch.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
// A button press by mouse (click) or touch (pointerup: some touch browsers send no click
// after a touch). The click that trails a touch is ignored, also on an element that only
// just appeared under the finger (shared guard, as in Verb Kitchen).
function tap(el, fn) {
  el.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'mouse') return;
    window.__touchTapAt = performance.now();
    fn(e);
  });
  el.addEventListener('click', (e) => {
    if (performance.now() - (window.__touchTapAt || -9999) < 700) return;
    fn(e);
  });
}
const STORE = 'krabsy_vdungeon_stars';
const MAX_HEARTS = 3;

// ── Renderer, camera, lights (same for every room) ─────────────────────────
const renderer = new THREE.WebGLRenderer({ canvas: $('c'), antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x060d1c);

const camera = new THREE.PerspectiveCamera(36, 1, 1, 120);
const CAM_TARGET = new THREE.Vector3(0, 1.0, -0.2);
const CAM_ELEV = THREE.MathUtils.degToRad(43);
function fitCamera() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const dist = Math.max(8.3 / tan, 13.2 / (tan * camera.aspect)); // fit room height / width
  camera.position.set(0, CAM_TARGET.y + Math.sin(CAM_ELEV) * dist, CAM_TARGET.z + Math.cos(CAM_ELEV) * dist);
  camera.lookAt(CAM_TARGET);
  camera.updateProjectionMatrix();
  camBase.copy(camera.position);
}
const camBase = new THREE.Vector3(); // camera position without the hit shake
window.addEventListener('resize', fitCamera);
fitCamera();

scene.add(new THREE.HemisphereLight(0x7f9cff, 0x1a1230, 0.9));
const moon = new THREE.DirectionalLight(0xa9c0ff, 1.5); // the one shadow light
moon.position.set(7, 16, 9);
moon.castShadow = true;
moon.shadow.mapSize.set(2048, 2048);
Object.assign(moon.shadow.camera, { left: -15, right: 15, top: 15, bottom: -15, near: 1, far: 50 });
moon.shadow.bias = -0.0004;
moon.shadow.normalBias = 0.03;
scene.add(moon);
const torchLights = TORCH_SPOTS.map(([x, y, z], i) => {
  const l = new THREE.PointLight(0xff9a3c, 34, 16, 1.8);
  l.position.set(x, y, z);
  l.userData.seed = i * 17.3;
  scene.add(l);
  return l;
});
const beyond = new THREE.PointLight(0xffb060, 16, 10, 1.8); // glow from the next room
beyond.position.set(0, 2.2, -10.5);
scene.add(beyond);

const dust = (() => {
  const N = 90, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 19;
    pos[i * 3 + 1] = 0.4 + Math.random() * 4;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 15;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const p = new THREE.Points(geo, new THREE.PointsMaterial({
    map: glowTex, color: 0xffd9a0, size: 0.16, transparent: true, opacity: 0.55,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  scene.add(p);
  return p;
})();

// ── Game state ─────────────────────────────────────────────────────────────
const G = {
  mode: 'loading',      // loading | menu | play | end
  menuSel: 0,           // level highlighted in the menu (keys 1–3, ←/→, Enter)
  level: 0, roomIdx: 0, hearts: MAX_HEARTS,
  asked: 0, firstTry: 0, treasures: 0, coinsRun: 0,
  missed: [],           // verbs answered wrong at least once: { base, past, pp }
  pool: [], poolIdx: 0, // verb pairs for this level (questions.js)
  retry: [],            // missed pairs, asked again at the next door
  locked: false,        // hero cannot act (room change, defeat)
  invuln: 0, kbx: 0, kbz: 0, attackT: 0, attackLen: 0, swingOut: 0, hitDone: true,
  card: null,           // the open question card (openCard); the room is paused meanwhile
  sign: null,           // rune doors / bridge: { pair, q, caption } for the line at the bottom
  time: 0,              // game clock (stops while the card is open)
  wall: 0,              // runs always (torch flicker)
};
let room = null, hero = null;
let skeletons = [];
const timers = [];      // game-clock timers, so scripted runs can fast-forward them
const after = (sec, fn) => timers.push({ t: sec, fn });

function loadStars() { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch (_) { return {}; } }
function saveStars(id, n) {
  const s = loadStars();
  if ((s[id] || 0) < n) { s[id] = n; try { localStorage.setItem(STORE, JSON.stringify(s)); } catch (_) { /* private mode */ } }
}

// ── Interface helpers ──────────────────────────────────────────────────────
const _v = new THREE.Vector3();
function pop(text, x, y, z, color) {
  _v.set(x, y, z).project(camera);
  const el = document.createElement('div');
  el.className = 'pop';
  el.textContent = text;
  if (color) el.style.color = color;
  el.style.left = `${(_v.x * 0.5 + 0.5) * window.innerWidth}px`;
  el.style.top = `${(-_v.y * 0.5 + 0.5) * window.innerHeight}px`;
  document.body.appendChild(el);
  if (params.has('hold')) el.classList.add('hold'); // QA screenshots: keep it on screen
  else setTimeout(() => el.remove(), 950);
}
let hintTimer = 0;
function hint(text, sec = 3.5) {
  $('hint').textContent = text;
  $('hint').classList.add('on');
  hintTimer = sec;
}
let toastTimer = 0;
function toast(html, sec = 1.8) {
  $('toast').innerHTML = html;
  $('toast').classList.add('on');
  toastTimer = sec;
}
const chainHtml = (q) => `<span class="base">${q.base}</span><span class="arrow">→</span>`
  + `<span class="past">${q.past}</span><span class="arrow">→</span><span class="pp">${q.pp}</span>`;

function drawHud() {
  let h = '';
  for (let i = 0; i < MAX_HEARTS; i++) h += i < G.hearts ? '♥' : '<span class="off">♥</span>';
  $('hearts').innerHTML = h;
  $('keySlot').style.display = room && (room.type === 'key' || room.type === 'ambush') ? '' : 'none';
  $('keySlot').classList.toggle('on', !!room && key.state === 'taken');
  $('coinN').textContent = Save.coins;
  const boss = room && room.type === 'boss' && room.boss;
  $('roomLabel').innerHTML = boss
    ? `${t('level', G.level + 1)} · ${t('boss')} <span class="pips">${[0, 1, 2].map((i) => `<i class="${i < boss.hp ? '' : 'off'}">💀</i>`).join('')}</span>`
    : `${t('level', G.level + 1)} · ${t('room', G.roomIdx + 1, LEVELS[G.level].rooms.length)}`;
  $('mute').textContent = `${sfx.muted ? '🔇' : '🔊'} ${t('sound')}`;
}
const starsHtml = (n) => '★'.repeat(n) + `<i>${'★'.repeat(3 - n)}</i>`;

function showMenu() {
  G.mode = 'menu';
  $('hud').classList.remove('on');
  $('hint').classList.remove('on');
  $('end').classList.remove('on');
  closeCard(); showSign(null);
  const stars = loadStars();
  const box = $('levels');
  box.innerHTML = '';
  LEVELS.forEach((lv, i) => {
    const b = document.createElement('button');
    b.className = 'lvl';
    b.disabled = i > 0 && !stars[LEVELS[i - 1].id] && !params.has('unlock');
    b.innerHTML = `<b>${t('level', i + 1)}</b><span>${starsHtml(stars[lv.id] || 0)}</span>`;
    tap(b, () => { if (!b.disabled) { sfx.init(); sfx.uiClick(); startLevel(i); } });
    box.appendChild(b);
  });
  const open = [...box.children].map((b) => !b.disabled).lastIndexOf(true);
  selectLevel(Math.max(0, open));
  drawHeroes();
  $('menu').classList.add('on');
}
// Hero choice in the menu: owned heroes can be picked, the others cost coins.
function drawHeroes() {
  $('heroTitle').innerHTML = `${t('heroes')} · <i class="coin"></i> ${Save.coins}`;
  const box = $('heroes');
  box.innerHTML = '';
  for (const h of HEROES) {
    const owned = Save.owned.includes(h.id), b = document.createElement('button');
    b.className = `hero${Save.hero === h.id ? ' sel' : ''}${owned ? '' : ' locked'}${!owned && Save.coins < h.cost ? ' poor' : ''}`;
    b.innerHTML = `<img src="assets/portraits/${h.id}.webp" alt=""><b>${t(`hero_${h.id}`)}</b>`
      + `<span>${owned ? (Save.hero === h.id ? '✓' : '&nbsp;') : `<i class="coin"></i> ${h.cost}`}</span>`;
    tap(b, () => { sfx.init(); pickHero(h.id); });
    box.appendChild(b);
  }
}
async function pickHero(id) {
  if (!Save.owned.includes(id)) {
    if (!Save.buy(id)) { sfx.bzzt(); $('heroTitle').innerHTML = `${t('needCoins')} · <i class="coin"></i> ${Save.coins}`; return; }
    sfx.coin(0); after(0.12, () => sfx.coin(2));
  } else sfx.uiClick();
  Save.choose(id);
  drawHeroes();
  await setHero(id);
}

// ── Question card ──────────────────────────────────────────────────────────
// The key, a chest, the boss stone and the treasure-room door ask in a card in the
// middle of the screen. The room is dimmed and paused while it is open (step()). The card
// opens on an event and stays until it is answered; only a chest can be put off ("later",
// Esc), and stays closed then. card = { gate: 'key' | 'door' | 'chest' | 'boss', pair,
// step, q? }: key and door ask both forms of the pair in a row (step 0 = 2nd form, step 1 =
// 3rd form with the 2nd shown); the boss asks one step per round; a chest has its own q.
// Missed pairs come first (key, door, boss, rune, bridge); chests always take a fresh verb.
function nextPair(retryFirst) {
  if (retryFirst && G.retry.length) return G.retry.shift();
  const pair = G.pool[G.poolIdx % G.pool.length];
  G.poolIdx += 1;
  return again(pair); // a copy with its own option order and "tried" marks
}
const CARD = { key: ['🔑', 'cardKey'], door: ['🚪', 'cardDoor'], chest: ['💰', 'cardChest'], boss: ['💀', 'cardBoss'] };
const cardQ = (c) => c.q || c.pair.steps[c.step];
function openCard(card) {
  G.card = card;
  keys.clear(); holdStick(); // the hero stands still when the card closes
  sfx.cardOpen();
  renderCard();
  $('ask').classList.add('on');
  document.body.classList.add('carding');
}
function closeCard() {
  G.card = null;
  $('ask').classList.remove('on');
  document.body.classList.remove('carding');
}
// Positional notation, never grammar terms: the asked blank is highlighted (teal = 2nd
// form, coral = 3rd). When the 3rd form is asked, the 2nd is shown (chain order).
function chainAsk(q) {
  const blank = (form) => (q.ask === form ? `<span class="blank ask ${form}">?</span>` : `<span class="blank ${form}">&nbsp;</span>`);
  const second = q.ask === 'pp' ? `<span class="past filled">${q.past}</span>` : blank('past');
  return `<span class="base">${q.base}</span><span class="arrow">→</span>${second}<span class="arrow">→</span>${blank('pp')}`;
}
const askLog = []; // QA: every question shown (card or sign), `gate:base:ask`, to check chain order
function renderCard() {
  const c = G.card, q = cardQ(c), [icon, title] = CARD[c.gate];
  askLog.push(`${c.gate}:${q.base}:${q.ask}`);
  $('askIcon').textContent = icon;
  $('askTitle').textContent = t(title);
  $('askCard').className = `${q.ask} ${c.gate}`;
  const chain = $('chain');
  chain.innerHTML = chainAsk(q);
  chain.style.fontSize = '';
  const room_ = $('askCard').clientWidth - 64; // long verbs: shrink the chain to fit
  if (chain.scrollWidth > room_) chain.style.fontSize = `${parseFloat(getComputedStyle(chain).fontSize) * room_ / chain.scrollWidth}px`;
  // Two forms are asked in a row: two dots in the corner show which one this is.
  const now = q.ask === 'pp' ? 1 : 0;
  $('steps').innerHTML = c.gate === 'chest' ? ''
    : [0, 1].map((i) => `<i class="${i < now ? 'done' : i === now ? 'now' : ''}"></i>`).join('');
  $('chips').innerHTML = '';
  q.options.forEach((opt, i) => {
    const b = document.createElement('button');
    b.className = 'chip' + (q.tried && q.tried.includes(i) ? ' wrong' : '');
    b.innerHTML = `<small>${i + 1}</small>${opt}`;
    tap(b, () => answer(i));
    $('chips').appendChild(b);
  });
  $('teach').innerHTML = q.tried && q.tried.length ? teachHtml(q) : '';
  $('askLater').innerHTML = `${t('later')}<kbd>Esc</kbd>`;
}
// Rune doors and the word bridge show their words in the room; a small line at the
// bottom shows the chain and how to choose (sign = { pair, q, caption }).
function showSign(sign) {
  if ((G.sign && G.sign.q) === (sign && sign.q)) return;
  G.sign = sign;
  $('sign').classList.toggle('on', !!sign);
  if (!sign) return;
  askLog.push(`sign:${sign.q.base}:${sign.q.ask}`);
  $('signChain').innerHTML = chainAsk(sign.q);
  $('signHow').innerHTML = sign.q.tried && sign.q.tried.length ? teachHtml(sign.q) : sign.caption;
}
const redrawSign = () => { G.sign = null; }; // the next frame draws it again (teach line changed)
// After a 2nd-form answer the 3rd form stays hidden (`go → went → ___`): it is asked
// next, and the full chain would give it away. Chest questions (`full`) have no
// follow-up and show the whole chain.
const askedChain = (q) => (q.ask === 'past' && !q.full
  ? `<span class="base">${q.base}</span><span class="arrow">→</span><span class="past">${q.past}</span>`
    + '<span class="arrow">→</span><span class="pp">___</span>'
  : chainHtml(q));
const teachHtml = (q) => `${t('notQuite')} ${askedChain(q)} · ${t('tryAgain')}`;

// One answer to one step of a pair, wherever it is given (card chip, rune door, bridge
// stone). Returns true if right. Wrong: the choice is remembered as tried and the verb
// comes back later as a full pair (once per pair, however many mistakes).
function judge(pair, q, i) {
  if (q.options[i] !== q.answer) {
    if (!q.tried) q.tried = [];
    if (!q.tried.includes(i)) q.tried.push(i);
    if (!pair.missed) {
      pair.missed = true;
      G.retry.push(again(pair));
      if (!G.missed.some((m) => m.base === q.base)) G.missed.push({ base: q.base, past: q.past, pp: q.pp });
    }
    return false;
  }
  G.asked += 1;
  if (!q.tried) G.firstTry += 1;
  return true;
}
function answer(i) {
  const c = G.card;
  if (!c || G.mode !== 'play') return;
  const q = cardQ(c);
  if (!q.options[i] || (q.tried && q.tried.includes(i))) return;
  const right = judge(c.pair, q, i);
  if (c.gate === 'boss') { closeCard(); goal().onAnswer(right, q); return; }
  if (!right) {
    $('chips').children[i].classList.add('wrong');
    $('teach').innerHTML = teachHtml(q);
    sfx.bzzt();
    return;
  }
  sfx.sparkle();
  if ((c.gate === 'key' || c.gate === 'door') && c.step === 0) {
    // 2nd form right: the same card now asks the 3rd form, with the 2nd written in.
    c.step = 1;
    renderCard();
    return;
  }
  closeCard();
  toast(`✓ ${askedChain(q)}`);
  if (c.gate === 'key') takeKey();
  else if (c.gate === 'door') openExit(room.doors[0]);
  else openChest();
}
// "Later" (chest only): the card closes, the chest stays shut until you come back.
function later() {
  if (!G.card || G.card.gate !== 'chest') return;
  closeCard();
  room.chest.armed = false; // opens again only after the hero has stepped away
  sfx.uiClick();
}
tap($('askLater'), later);
function openChest() {
  const c = room.chest;
  c.open = true;
  c.mark = unmark(c.mark);
  G.treasures += 1;
  sfx.chestCreak(); sfx.coin(0); after(0.12, () => sfx.coin(1)); after(0.24, () => sfx.coin(2));
  burstCoins(c.x, c.z, room.def.chest.gold ? 3 : 2);
  if (G.hearts < MAX_HEARTS) {
    G.hearts += 1;
    pop(t('heart'), c.x, 2.2, c.z, '#ff8585');
  } else {
    pop(t('treasure'), c.x, 2.2, c.z);
  }
  drawHud();
}

// ── Levels and rooms ───────────────────────────────────────────────────────
async function startLevel(i) {
  G.locked = true;
  $('menu').classList.remove('on');
  $('end').classList.remove('on');
  Object.assign(G, { level: i, roomIdx: 0, hearts: MAX_HEARTS, asked: 0, firstTry: 0, treasures: 0, coinsRun: 0,
    missed: [], poolIdx: 0, retry: [] });
  try {
    G.pool = await loadPairs({ count: 10, tiers: LEVELS[i].tiers });
  } catch (err) {
    console.error(err);
    diag('error', { msg: `startLevel: ${err.message}` });
    showMenu();
    $('tagline').textContent = `⚠ ${err.message}`;
    return;
  }
  G.mode = 'play';
  $('hud').classList.add('on');
  enterRoom(0);
}

function clearSkeletons() {
  for (const s of skeletons) s.dispose();
  skeletons = [];
  for (const a of arrows) scene.remove(a.obj);
  arrows.length = 0;
  if (golem) { golem.dispose(); golem = null; }
  for (const st of dizzy) st.visible = false;
  bossStone.mesh.visible = false;
}
// A skeleton entry in the level data is a patrol route, or { archer: true, route }.
function spawnSkeletons() {
  clearSkeletons();
  skeletons = (room.def.skeletons || []).map((entry, i) => {
    const def = Array.isArray(entry) ? { route: entry } : entry;
    const s = new Char(def.archer ? Assets.archer : Assets.skeleton, Assets.clips);
    s.route = def.route.map(([x, z]) => ({ x, z }));
    s.pos.set(s.route[0].x, 0, s.route[0].z);
    s.idx = i; s.wp = 1 % s.route.length; s.mode = 'patrol'; s.t = 0; s.pause = 0; s.squash = 0;
    if (def.archer) {
      s.archer = true; s.shotT = 2.2 + i * 0.7; s.aim = 0; s.recoil = 0;
      const hand = s.root.getObjectByName('handslotr');
      if (hand) {
        const bow = Assets.crossbow.clone(true);
        bow.rotation.y = Math.PI / 2; // the pack's crossbow sits sideways in the hand slot; measured: this aims it forward (upright)
        hand.add(bow);
      }
    }
    s.play('Walking_A');
    scene.add(s.root);
    return s;
  });
}

// ── Room goals ─────────────────────────────────────────────────────────────
// Every room has a type (levels.js) and runs through the same phases:
//   'goal'  the room's own task is open, the door only gives a hint
//   'door'  task done: the lock glows; the door opens when the hero comes near
//           (the treasure room's door asks its verb pair first)
//   'open'  walk through
// A room type is one entry here. enter(keep) sets the task up (keep = the saved state
// after a dizzy restart, from save()), update(dt) runs it every frame, onBonk(s) hears
// about a bonked skeleton, doorHint is shown at the locked door, and goalDone() ends
// the 'goal' phase. Types that are a verb question themselves (rune doors, word bridge)
// return their question from sign() (the small line at the bottom), check answers with
// judge() and call openExit() instead of goalDone().
function goalDone(hintKey) {
  if (room.phase !== 'goal') return;
  room.phase = 'door';
  if (hintKey) hint(t(hintKey));
  drawHud();
}
function openExit(door) {
  door.open = true;
  if (door.bricks) door.bricks.visible = false;
  room.exitX = beyond.position.x = door.x;
  room.phase = 'open';
  sfx.rumble(0.7);
  pop(t('unlocked'), door.x, 3.4, DOOR.z + 0.8);
  drawHud();
}
// Key hunt: the key hides in one of the room's search props or, without them, in one of
// its skeletons (hideKey, reveal). Walking over it asks its verb pair in the card; then
// the key is yours and the door opens by itself.
const keyHunt = {
  doorHint: 'hintNoKey',
  enter(keep) {
    hideKey(keep);
    if (G.mode === 'play' && room.phase === 'goal') {
      hint(t(key.state !== 'hidden' ? 'hintGrab' : room.hide.where === 'search' ? 'hintSearch' : 'hintSkeletons'), 5);
    }
  },
  save: () => ({ state: key.state, x: key.to.x, z: key.to.z, hide: room.hide }),
  onBonk(s) { if (room.hide.where === 'skeleton') reveal(s.idx, s.pos.x, s.pos.z, false); },
  update(dt) { updateKey(dt); },
};
const GOALS = {
  key: keyHunt,

  // Ambush: the door stands open; walk in and it slams, skeletons rise from the floor.
  // One of them has the key, as in the key hunt.
  ambush: {
    ...keyHunt,
    doorHint: 'hintAmbushDoor',
    enter(keep) {
      hideKey(keep);
      const a = room.ambush = { on: false };
      if (room.phase !== 'goal') { for (const s of skeletons) s.mode = 'calm'; a.on = true; return; }
      room.doors[0].open = true;
      for (const s of skeletons) { s.mode = 'hidden'; s.setVisible(false); }
      if (G.mode === 'play') hint(t('hintAmbushEnter'), 4);
    },
    // A dizzy restart springs the ambush again (the key's state stays); a finished one stays finished.
    update(dt) {
      updateKey(dt);
      const a = room.ambush;
      if (a.on || G.locked || hero.pos.z > 2.2) return;
      a.on = true;
      room.doors[0].open = false; room.slam = true; // updateWorld shuts the leaf fast
      sfx.slam(); FX.shake = 1;
      hint(t(key.state === 'hidden' ? 'hintAmbushKey' : 'hintAmbush'), 4);
      skeletons.forEach((s, i) => after(0.25 + i * 0.3, () => {
        if (s.mode !== 'hidden') return;
        s.setVisible(true);
        s.mode = 'rise'; s.afterRise = 'patrol'; s.t = s.dur('Spawn_Ground');
        s.play('Spawn_Ground', { once: true, fade: 0.05 });
        sfx.reassemble();
      }));
    },
  },

  // Treasure room: coins lie around, nothing attacks. Its door asks a verb pair in the card.
  vault: {
    enter() {
      for (const [x, z] of room.def.coins || []) lyingCoin(x, z);
      if (room.phase === 'goal') room.phase = 'door';
      if (G.mode === 'play') hint(t('hintVault'), 5);
    },
  },

  // Boss: a big golem walks after the hero and charges now and then. A glowing stone
  // lies in the room: step on it and the card asks. Right = the golem is dizzy for a few
  // seconds and can be bonked (3 bonks and it falls apart, the exit opens). Wrong = it
  // laughs it off and the stone comes back with the same question a little later.
  // Questions follow the chain order across rounds: 2nd form, 3rd form, next verb.
  boss: {
    enter(keep) {
      const b = room.boss = keep || { hp: 3, pair: nextPair(true), step: 0 };
      Object.assign(b, { state: 'intro', t: 1.8, stone: null, stoneT: 0.6, chargeT: 5, dx: 0, dz: 1, told: false });
      golem = new Char(Assets.golem, Assets.clipsLarge);
      golem.root.scale.setScalar(BOSS.scale);
      golem.pos.set(0, 0, -3.5);
      golem.pause = 0; golem.squash = 0;
      golem.play('Flexing');
      scene.add(golem.root);
      if (G.mode === 'play') hint(t('hintBoss'), 6);
    },
    save: () => ({ hp: room.boss.hp, pair: room.boss.pair, step: room.boss.step }),
    onAnswer(right, q) {
      const b = room.boss;
      b.stone = null; bossStone.mesh.visible = false; b.mark = unmark(b.mark);
      if (!right) { // the golem laughs it off; the same question comes back
        sfx.bzzt();
        toast(teachHtml(q), 2.6);
        pop(t('bossShrug'), golem.pos.x, BOSS.head + 1, golem.pos.z, '#ff8585');
        Object.assign(b, { state: 'taunt', t: 1.5, stoneT: 3 });
        golem.play('Flexing');
        return;
      }
      sfx.sparkle();
      toast(`✓ ${askedChain(q)}`);
      if (b.step === 0) b.step = 1; else { b.pair = nextPair(true); b.step = 0; }
      Object.assign(b, { state: 'stun', t: BOSS.stun });
      golem.play('Idle_A', { speed: 0.5 });
      sfx.dizzy();
      hint(t('hintBossBonk'), 4);
    },
    onSwing(p, fx, fz) { // the hero's sword swing (bonkCheck)
      const b = room.boss, g = golem.pos;
      const dx = g.x - p.x, dz = g.z - p.z, d = Math.hypot(dx, dz);
      if (b.state === 'dead' || d > 3.6 || (d > 1 && (dx * fx + dz * fz) / d < 0.2)) return;
      if (b.state !== 'stun') { // too strong while it is not dizzy
        sfx.thud();
        pop(t('bossClonk'), g.x, BOSS.head, g.z, '#9db4dd');
        if (!b.told) { b.told = true; hint(t('hintBossStone'), 4); }
        return;
      }
      b.hp -= 1;
      golem.squash = 1;
      sfx.bonk(); after(0.15, () => sfx.boneRattle());
      pop(t('bonk'), g.x, BOSS.head, g.z);
      hitFx(g.x, g.z);
      for (const st of dizzy) st.visible = false;
      drawHud();
      if (b.hp > 0) {
        Object.assign(b, { state: 'hit', t: 1.1, stoneT: 2.2, chargeT: 4 });
        golem.play('Hit_A', { once: true, fade: 0.05 });
        return;
      }
      b.state = 'dead';
      golem.play('Death_A', { once: true, fade: 0.08 });
      sfx.rumble(0.9); after(0.5, () => sfx.boneRattle()); after(0.8, () => sfx.boneRattle());
      FX.shake = 1;
      hint(t('bossDown'), 5);
      after(0.9, () => burstCoins(g.x, g.z, 5));
      after(1.4, () => { sfx.fanfare(); openExit(room.doors[0]); });
    },
    update(dt) { updateBoss(dt); },
  },

  // Rune doors: three doors, each with a word. Walk into the right one. Two rounds:
  // the 2nd form, then the 3rd with the 2nd shown. A wrong door shows a brick wall.
  rune: {
    enter() {
      room.rune = { pair: nextPair(true), step: 0, armed: true, busy: false };
      dealRunes();
      $('hint').classList.remove('on'); // no hint here: it would cover the door signs
    },
    sign() {
      const r = room.rune;
      return room.phase === 'goal' ? { pair: r.pair, q: r.pair.steps[r.step], caption: t('runeHow') } : null;
    },
    update() {
      const r = room.rune, p = hero.pos;
      if (room.phase !== 'goal' || r.busy || G.locked) return;
      // After a choice the hero has to step back before the next one counts.
      if (!r.armed) { r.armed = p.z > BOUNDS.minZ + 1.2; return; }
      if (p.z > BOUNDS.minZ + 0.25) return;
      const i = room.doors.findIndex((d) => Math.abs(p.x - d.x) < 1.1);
      if (i >= 0) chooseRune(i);
    },
  },

  // Word bridge: two pits, each crossed by a row of three word stones (2nd form, then the
  // 3rd), a strip of floor between them. The hero walks across the right stone.
  bridge: {
    enter() {
      const pair = nextPair(true);
      room.bridge = { pair, step: 0, fall: 0, safe: { x: 0, z: 6.4 }, pit: 0 };
      room.baseSign.set(pair.base, 'base');
      dealStones();
      hero.pos.x = -3; // beside the base-form plate, so it stays readable
      if (G.mode === 'play') hint(t('hintBridge'), 6);
    },
    sign() {
      const b = room.bridge;
      return room.phase === 'goal' ? { pair: b.pair, q: b.pair.steps[b.step], caption: t('bridgeHow') } : null;
    },
    update(dt) { updateBridge(dt); },
  },
};
const goal = () => GOALS[room.type];

// Boss.
const BOSS = { scale: 1.25, head: 4.6, stun: 6, reach: 1.9,
  spots: [[-6, 3], [6, 3], [-6, -3.5], [6, -3.5], [0, 4.8], [0, -1]] };
let golem = null;
const bossStone = makeLabel(2.4, 2.4, { flat: true }); // the glowing question stone
bossStone.set('?', 'base');
bossStone.mesh.visible = false;
scene.add(bossStone.mesh);
const starTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  g.font = '56px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#ffcf5e'; g.strokeStyle = '#7a5200'; g.lineWidth = 4;
  g.strokeText('★', 32, 35); g.fillText('★', 32, 35);
  const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; return tx;
})();
const dizzy = [0, 1, 2, 3].map(() => { // stars that circle a stunned golem's head
  const st = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex, transparent: true, depthTest: false, toneMapped: false }));
  st.scale.setScalar(1.1); st.renderOrder = 7;
  st.visible = false; scene.add(st);
  return st;
});
function placeStone() {
  const b = room.boss, g = golem.pos, h = hero.pos;
  const far = (x, z, p) => Math.hypot(x - p.x, z - p.z);
  const ok = BOSS.spots.filter(([x, z]) => far(x, z, g) > 4.5 && far(x, z, h) > 3);
  const [x, z] = (ok.length ? ok : BOSS.spots)[Math.floor(Math.random() * (ok.length || BOSS.spots.length))];
  b.stone = { x, z };
  bossStone.mesh.position.set(x, 0.13, z); // just above the floor tiles
  bossStone.mesh.visible = true;
  b.mark = unmark(b.mark);
  b.mark = markUsable(bossStone.mesh, { radius: 1.75, top: 0.6 });
  sfx.popIn();
}
function updateBoss(dt) {
  const b = room.boss, g = golem, p = g.pos, hp = hero.pos, time = G.time;
  if (g.squash > 0) {
    g.squash = Math.max(0, g.squash - dt * 4);
    const k = Math.sin(g.squash * Math.PI);
    g.root.scale.set(BOSS.scale * (1 + k * 0.2), BOSS.scale * (1 - k * 0.25), BOSS.scale * (1 + k * 0.2));
  }
  // The stone glows (the key's light is free in this room).
  keyLight.intensity = b.stone ? 22 + 8 * Math.sin(time * 5) : 0;
  if (b.stone) keyLight.position.set(b.stone.x, 1.6, b.stone.z);
  const stunned = b.state === 'stun';
  dizzy.forEach((st, i) => {
    st.visible = stunned;
    const a = time * 3.5 + i * (Math.PI / 2);
    st.position.set(p.x + Math.cos(a) * 1.5, BOSS.head + 0.2 + Math.sin(a * 2) * 0.15, p.z + Math.sin(a) * 0.9);
  });
  g.root.rotation.z = stunned ? Math.sin(time * 5) * 0.08 : 0;
  if (b.state === 'dead') return;
  // Nothing moves while the hero is dizzy (or a question is open: step() pauses everything).
  if (G.locked) { if (!stunned) g.play('Idle_A'); return; }
  // Standing on the glowing stone opens the question card.
  if (b.stone && ['chase', 'windup', 'charge', 'tired'].includes(b.state) && near(hp, b.stone.x, b.stone.z, 1.5)) {
    openCard({ gate: 'boss', pair: b.pair, step: b.step });
    return;
  }
  if (!b.stone && !stunned && b.state !== 'intro' && (b.stoneT -= dt) <= 0) placeStone();
  const dx = hp.x - p.x, dz = hp.z - p.z, d = Math.hypot(dx, dz) || 1;
  const fast = 1 + 0.12 * G.level + 0.1 * (3 - b.hp);
  const touch = () => { if (d < BOSS.reach && G.invuln <= 0) bump(g, dx / d, dz / d); };
  b.t -= dt;
  switch (b.state) {
    case 'intro': case 'taunt': case 'hit':
      if (b.t <= 0) b.state = 'chase';
      break;
    case 'stun':
      if (b.t <= 0) { b.state = 'chase'; b.stoneT = 1.5; }
      break;
    case 'chase':
      if (g.pause > 0) { g.pause -= dt; g.play('Idle_A'); break; }
      p.x += dx / d * 1.8 * fast * dt; p.z += dz / d * 1.8 * fast * dt;
      collide(p, 1.3, false);
      g.face(dx, dz, dt, 4);
      g.play('Walking_A');
      touch();
      if ((b.chargeT -= dt) <= 0 && d > 3.5) { // wind up for a charge: easy to see coming
        Object.assign(b, { state: 'windup', t: 0.9 });
        g.play('Flexing');
        pop('!!', p.x, BOSS.head + 0.6, p.z, '#ff8585');
        sfx.popIn();
      }
      break;
    case 'windup':
      g.face(dx, dz, dt, 6);
      b.dx = dx / d; b.dz = dz / d;
      if (b.t <= 0) { Object.assign(b, { state: 'charge', t: 0.95 }); g.play('Running_A'); }
      break;
    case 'charge': // straight ahead, no turning: step aside
      p.x += b.dx * 7.5 * fast * dt; p.z += b.dz * 7.5 * fast * dt;
      collide(p, 1.3, false);
      touch();
      if (b.t <= 0) { Object.assign(b, { state: 'tired', t: 1.3, chargeT: 5 }); g.play('Idle_A'); }
      break;
    case 'tired':
      if (b.t <= 0) b.state = 'chase';
      break;
  }
}

// Coins: small stacks that pop out of chests and the boss or lie in the treasure room.
// Walk near one to collect it. Coins are saved at once (heroes.js Save).
const COIN = { value: 5, reach: 1.6, flight: 0.5 };
const coins = [];
function makeCoin(x, z) { // a coin stack with the "usable" marker under it (marker.js)
  const obj = new THREE.Group(), stack = Assets.clone('coin_stack_small');
  stack.scale.setScalar(1.25);
  obj.add(stack);
  obj.position.set(x, 0, z);
  scene.add(obj);
  const c = { obj, stack, state: 'floor', t: 0, from: new THREE.Vector3(x, 0, z), to: new THREE.Vector3(x, 0, z),
    mark: markUsable(obj, { radius: 0.85, top: 0.7 }), seed: Math.random() * 6.28 };
  coins.push(c);
  return c;
}
const lyingCoin = (x, z) => makeCoin(x, z);
function burstCoins(x, z, n) { // n stacks fly out around (x, z) and land on free floor
  const start = Math.random() * 6.28;
  for (let i = 0; i < n; i++) {
    const a = start + i * (6.28 / n), c = makeCoin(x, z);
    c.from.set(x, 1, z);
    c.to.set(x + Math.cos(a) * 2.4, 0, z + Math.sin(a) * 2.4);
    freeSpot(c.to, 0.6, { x, z, r: 1.2 });
    c.state = 'fly'; c.t = -i * 0.08; // one after the other
    c.mark.off = true; // the marker shows once it has landed
  }
}
function updateCoins(dt) {
  for (let i = coins.length - 1; i >= 0; i--) {
    const c = coins[i];
    if (c.state === 'fly') {
      c.t += dt / COIN.flight;
      const k = Math.min(1, Math.max(0, c.t));
      c.obj.position.lerpVectors(c.from, c.to, k);
      c.obj.position.y += 2.2 * 4 * k * (1 - k);
      if (k >= 1) { c.state = 'floor'; c.mark.off = false; }
      continue;
    }
    c.stack.position.y = 0.06 + 0.06 * Math.sin(G.time * 3 + c.seed); // a gentle bob
    c.stack.rotation.y += dt * 0.8;
    if (!G.locked && near(hero.pos, c.to.x, c.to.z, COIN.reach)) takeCoin(i, true);
  }
}
function takeCoin(i, show) {
  const c = coins[i];
  coins.splice(i, 1);
  scene.remove(c.obj); unmark(c.mark);
  Save.addCoins(COIN.value); G.coinsRun += COIN.value;
  if (show) {
    sfx.coin(i % 3);
    pop(`+${COIN.value}`, c.to.x, 1.6, c.to.z);
    flyToHud(c.to.x, 0.6, c.to.z, 'coinBox', '<i class="coin big"></i>');
  }
  drawHud();
}
// Coins still lying when the room ends are not lost.
function sweepCoins() { while (coins.length) takeCoin(0, false); }

// Arrows of the archer skeletons: slow, big and easy to see. They fly straight; step
// aside or swat them with the sword.
const ARROW = { speed: 7, life: 3, hit: 0.85 };
const arrows = [];
function shootArrow(s) {
  const obj = new THREE.Group(), m = Assets.arrow.clone(true), glow = makeGlow(0xff8585, 1.3);
  m.rotation.x = -Math.PI / 2; // the model stands upright, tip down: lay it down, tip ahead
  m.scale.setScalar(2.2);
  glow.material.opacity = 0.7;
  obj.add(m, glow);
  obj.position.set(s.pos.x + s.ax * 0.9, 1.25, s.pos.z + s.az * 0.9);
  obj.rotation.y = Math.atan2(s.ax, s.az);
  scene.add(obj);
  arrows.push({ obj, glow, vx: s.ax * ARROW.speed, vz: s.az * ARROW.speed, t: 0 });
  sfx.swing();
}
function removeArrow(i) {
  const a = arrows[i];
  arrows.splice(i, 1);
  scene.remove(a.obj); a.glow.material.dispose();
}
function updateArrows(dt) {
  for (let i = arrows.length - 1; i >= 0; i--) {
    const a = arrows[i], p = a.obj.position;
    p.x += a.vx * dt; p.z += a.vz * dt; a.t += dt;
    p.y = 1.25 + Math.sin(a.t * 14) * 0.08; // a goofy wobble
    const out = a.t > ARROW.life || Math.abs(p.x) > 9.7 || p.z < -7.7 || p.z > 8.6
      || room.obstacles.some((o) => o.r > 0.8 && near(p, o.x, o.z, o.r * 0.8));
    if (out) { removeArrow(i); continue; }
    if (G.invuln <= 0 && !G.locked && near(p, hero.pos.x, hero.pos.z, ARROW.hit)) {
      removeArrow(i);
      hurt(a.vx / ARROW.speed, a.vz / ARROW.speed);
    }
  }
}
// The archer keeps its distance, aims (a "!" warns), then shoots where the hero stood.
function updateArcher(s, dt) {
  const p = s.pos, hp = hero.pos, dx = hp.x - p.x, dz = hp.z - p.z, d = Math.hypot(dx, dz) || 1;
  if (s.aim > 0) {
    s.aim -= dt;
    if (s.aim > 0.3) { s.face(dx, dz, dt, 9); s.ax = dx / d; s.az = dz / d; } // the last moment is fixed: dodge now
    if (s.aim <= 0) { shootArrow(s); s.shotT = 3.4; s.recoil = 0.6; s.play('Ranged_2H_Shoot', { once: true, fade: 0.05 }); }
    return;
  }
  if (s.recoil > 0) { s.recoil -= dt; return; }
  s.shotT -= dt;
  if (s.shotT <= 0 && d < 14 && hp.z > BOUNDS.minZ) {
    s.aim = 1.0; s.ax = dx / d; s.az = dz / d;
    s.play('Ranged_2H_Aiming', { fade: 0.1 });
    pop('!', p.x, 3.2, p.z, '#ff8585');
    sfx.popIn();
    return;
  }
  if (d < 4.5) { // too close: back off
    const bx = p.x, bz = p.z;
    p.x -= dx / d * 2.3 * dt; p.z -= dz / d * 2.3 * dt;
    collide(p, 0.5, false);
    s.face(p.x - bx, p.z - bz, dt, 8);
    s.play('Walking_A', { speed: 1.4 });
  } else if (d > 10) {
    p.x += dx / d * 1.5 * dt; p.z += dz / d * 1.5 * dt;
    collide(p, 0.5, false);
    s.face(dx, dz, dt, 6);
    s.play('Walking_A');
  } else {
    s.face(dx, dz, dt, 5);
    s.play('Idle_A');
  }
}

// Rune doors.
function dealRunes() { // write this round's words on the signs, close every door
  const r = room.rune, q = r.pair.steps[r.step];
  room.doors.forEach((d, i) => {
    const tried = q.tried && q.tried.includes(i);
    d.sign.set(q.options[i], tried ? 'wrong' : 'normal');
    d.open = !!tried; d.bricks.visible = !!tried;
  });
}
function chooseRune(i) {
  const r = room.rune, q = r.pair.steps[r.step], d = room.doors[i];
  r.armed = false;
  if (q.tried && q.tried.includes(i)) return; // already a brick wall
  G.kbz = 7; // a small push back from the door
  if (!judge(r.pair, q, i)) {
    d.open = true; d.bricks.visible = true;
    d.sign.set(q.options[i], 'wrong');
    sfx.thud(); after(0.25, () => sfx.trombone());
    pop(t('deadEnd'), d.x, 3, DOOR.z + 1.5, '#ff8585');
    redrawSign();
    return;
  }
  d.sign.set(q.options[i], 'right');
  sfx.sparkle();
  if (r.step === 1) { // both forms right: this door is the way out
    G.kbz = 0;
    toast(`✓ ${chainHtml(q)}`);
    openExit(d);
    return;
  }
  // 2nd form right: the next round asks the 3rd form on fresh signs.
  pop(q.answer, d.x, 3, DOOR.z + 1.5, '#2ee6c0');
  r.busy = true;
  after(0.9, () => { r.step = 1; r.busy = false; dealRunes(); });
}

// Word bridge. The hero walks normally everywhere. The pits are crossed only on the
// stones; standing over the pit (off a stone's side, or where a stone crumbled) drops the
// hero back onto the floor it came from (no heart lost). The first row asks the 2nd form,
// the second row the 3rd (its words appear once the first row is solved). Right stone =
// teal, the other two of the row crumble away; wrong stone = it crumbles under the hero.
const BRIDGE = { edge: 0.15, shake: 0.28, fall: 0.75, back: 1.0 };
const pitAt = (z) => PITS.findIndex((pt) => z < pt.near && z > pt.far);
function dealStones() {
  const b = room.bridge;
  for (const st of room.stones) {
    if (st.gone) continue;
    const q = b.pair.steps[st.row];
    if (st.row > b.step) st.label.set('?', 'wait');
    else st.label.set(q.options[st.col], st.row < b.step && q.options[st.col] === q.answer ? 'right' : 'normal');
  }
}
function crumble(st) {
  st.gone = true; st.shake = BRIDGE.shake;
  st.label.set(st.label.text, 'wrong');
}
function stepOnStone(st) {
  const b = room.bridge, q = b.pair.steps[st.row];
  if (st.row > b.step || st.label.state === 'right') return; // a word still hidden / already solved
  if (q.options[st.col] !== q.answer) { // wrong word: the stone crumbles under the hero
    if (st.row === b.step) judge(b.pair, q, st.col);
    crumble(st);
    sfx.thud();
    after(BRIDGE.shake, () => puff(st.x, st.z));
    pop(t('crumble'), st.x, 1.8, st.z, '#ff8585');
    redrawSign();
    dropHero(BRIDGE.shake);
    return;
  }
  judge(b.pair, q, st.col);
  st.label.set(st.label.text, 'right');
  sfx.sparkle();
  for (const o of room.stones) if (o.row === st.row && o !== st && !o.gone) after(0.35, () => crumble(o));
  b.step += 1;
  if (b.step === 1) { pop(q.answer, st.x, 2.6, st.z, '#2ee6c0'); dealStones(); }
  else { toast(`✓ ${chainHtml(q)}`); openExit(room.doors[0]); }
}
function updateBridge(dt) {
  const b = room.bridge, p = hero.pos;
  for (const st of room.stones) { // crumbled stones shake a moment, then drop into the pit
    if (!st.gone || st.obj.position.y < -9) continue;
    if (st.shake > 0) { st.shake -= dt; st.obj.position.x = st.x + Math.sin(G.time * 70) * 0.07; continue; }
    st.obj.position.x = st.x;
    st.obj.position.y -= (2 + -st.obj.position.y * 6) * dt; st.obj.rotation.z += dt * 0.5;
  }
  if (b.fall > 0) { // the hero drops (after the stone's shake), then stands where it came from
    b.fall -= dt;
    if (b.fall < BRIDGE.fall) p.y -= (3 + (BRIDGE.fall - b.fall) * 30) * dt;
    if (b.fall <= 0) {
      b.fall = 0;
      const pit = PITS[b.pit], back = b.safe.z > pit.near ? pit.near + BRIDGE.back : pit.far - BRIDGE.back;
      p.set(Math.min(BOUNDS.maxX, Math.max(BOUNDS.minX, b.safe.x)), 0, back);
      keys.clear(); holdStick(); // walk on again only after a fresh key press (or touch)
      Object.assign(G, { locked: false, invuln: 0.9, kbx: 0, kbz: 0 });
    }
    return;
  }
  if (G.locked) return;
  const i = pitAt(p.z);
  if (i < 0) { b.safe.x = p.x; b.safe.z = p.z; return; } // on the floor
  b.pit = i;
  const st = room.stones.find((s) => s.row === i && !s.gone && Math.abs(p.x - s.x) <= STONE.w / 2 + BRIDGE.edge);
  if (st) stepOnStone(st);
  else dropHero(0); // off a stone's side, or a broken stone
}
function dropHero(wait) {
  room.bridge.fall = BRIDGE.fall + wait;
  G.locked = true;
  cancelSwing();
  hero.play('Idle_A');
  after(wait, () => sfx.fall());
}

// The key: one pooled model with a glow. States: none | hidden (in a skeleton or a
// search prop; nobody can see which) | fly (pops out in an arc) | floor | taken (its
// verb answered: in the HUD, the door opens).
const key = { state: 'none', obj: new THREE.Group(), glow: makeGlow(0xffcf5e, 2.4),
  from: new THREE.Vector3(), to: new THREE.Vector3(), t: 0, pair: null };
const KEY = { flight: 0.55, arc: 2.6, reach: 1.25, floatY: 0.75, coinChance: 0.3 };
key.obj.visible = false;
key.obj.add(key.glow);
scene.add(key.obj);
initMarks(scene); // the "usable" marker (marker.js): rings and sparkles, two draw calls
// One amber light pools on the floor under the dropped key (and under the boss stone):
// the clearest "here it is" from the top-down camera.
const keyLight = new THREE.PointLight(0xffc04a, 0, 7, 1.6);
scene.add(keyLight);
function initKey() { // at boot, when the models are loaded
  const mat = Assets.material.clone(); // lit from inside, so the key shines in dark corners
  mat.color.setHex(0xffc94a);
  mat.emissive.setHex(0xffb020); mat.emissiveMap = mat.map; mat.emissiveIntensity = 0.6;
  const k = Assets.clone('key');
  k.traverse((o) => { if (o.isMesh) o.material = mat; });
  k.position.set(0, -0.5, 0); // stands upright (handle down), centred on the group
  k.rotation.z = Math.PI / 2;
  k.scale.setScalar(2);
  key.obj.add(k);
}
function resetKey() {
  key.state = 'none'; key.pair = null; key.obj.visible = false; keyLight.intensity = 0;
  key.mark = unmark(key.mark);
}
function markKey() { if (!key.mark) key.mark = markUsable(key.obj, { radius: 0.95, top: 1.3 }); }
// Where the key hides: in one of the search props if the room has them, else in one of
// the skeletons. The hiding place is picked at random now; since it is fixed, the last
// one searched or bonked always has it. keep = saved state after a dizzy restart.
function hideKey(keep) {
  const where = room.search.length ? 'search' : 'skeleton';
  const n = where === 'search' ? room.search.length : skeletons.length;
  room.hide = keep ? keep.hide : { where, keyIn: Math.floor(Math.random() * n), checked: [] };
  if (where === 'search') for (const i of room.hide.checked) searched(room.search[i], true);
  if (keep && (keep.state === 'floor' || keep.state === 'fly')) placeKey(keep.x, keep.z);
  else if (keep) key.state = keep.state;
  else if (n) key.state = 'hidden';
  else placeKey(0, 1); // a room without skeletons and search props (should not happen)
}
// Bonked skeleton i / searched prop i at (x, z): the key pops out, or nothing does.
function reveal(i, x, z, prop) {
  const h = room.hide;
  if (key.state !== 'hidden' || h.checked.includes(i)) {
    if (prop) { sfx.rattle(); puff(x, z); }
    return;
  }
  h.checked.push(i);
  if (i === h.keyIn) { dropKey(x, z, prop); return; }
  // Nothing here: a dust puff and a shrug, sometimes a coin.
  const coin = Math.random() < KEY.coinChance;
  after(prop ? 0 : 0.35, () => {
    puff(x, z);
    if (prop) sfx.rattle();
    pop(t(prop ? 'empty' : 'nothing'), x, prop ? 2.4 : 1.1, z, '#9db4dd');
    if (coin) burstCoins(x, z, 1);
  });
}
function placeKey(x, z) {
  key.state = 'floor';
  key.to.set(x, KEY.floatY, z);
  key.obj.position.copy(key.to);
  key.obj.visible = true;
  markKey();
}
// Moves a landing spot (key, coins) onto free floor: inside the walls with a margin,
// not in the doorway, clear of props and the chest and of `avoid` ({ x, z, r }).
function freeSpot(v, margin, avoid) {
  for (let i = 0; i < 4; i++) {
    v.x = Math.min(BOUNDS.maxX - 0.8, Math.max(BOUNDS.minX + 0.8, v.x));
    v.z = Math.min(BOUNDS.maxZ - 1.2, Math.max(BOUNDS.minZ + 1.0, v.z));
    for (const o of [...room.obstacles, ...(avoid ? [avoid] : [])]) {
      const ox = v.x - o.x, oz = v.z - o.z, od = Math.hypot(ox, oz), min = o.r + margin;
      if (od < min) { v.x = o.x + (od > 1e-3 ? ox / od : 1) * min; v.z = o.z + (od > 1e-3 ? oz / od : 0) * min; }
    }
  }
}
// The key pops out onto free floor: from a skeleton away from the hero (not under the
// bone pile), from a prop towards the hero (props stand near the walls).
function dropKey(x, z, prop) {
  const dx = (x - hero.pos.x) * (prop ? -1 : 1), dz = (z - hero.pos.z) * (prop ? -1 : 1), d = Math.hypot(dx, dz) || 1;
  key.from.set(x, prop ? 1.6 : 1.3, z);
  key.to.set(x + dx / d * 2.4, KEY.floatY, z + dz / d * 2.4);
  freeSpot(key.to, 0.8, { x, z, r: 0.9 });
  key.state = 'fly'; key.t = 0;
  key.obj.position.copy(key.from);
  key.obj.visible = true;
  sfx.popIn();
  after(KEY.flight, () => { sfx.coin(1); if (room.phase === 'goal') hint(t('hintGrab')); });
}
function updateKey(dt) {
  const o = key.obj, time = G.time;
  const lying = key.state === 'fly' || key.state === 'floor';
  keyLight.intensity = lying ? 13 + 4 * Math.sin(time * 5) : 0; // softer: the teal marker ring must read too
  if (lying) keyLight.position.set(o.position.x, 1.7, o.position.z + 0.4);
  if (key.state === 'fly') {
    key.t = Math.min(1, key.t + dt / KEY.flight);
    const k = key.t;
    o.position.lerpVectors(key.from, key.to, k);
    o.position.y += KEY.arc * 4 * k * (1 - k);
    o.rotation.y += dt * 14;
    if (k >= 1) { key.state = 'floor'; markKey(); }
  } else if (key.state === 'floor') {
    // Glint: slow spin, a small bob, a pulsing glow; the marker ring under it (markKey).
    o.position.y = KEY.floatY + Math.sin(time * 3) * 0.12;
    o.rotation.y += dt * 2.4;
    key.glow.material.opacity = 0.5 + 0.2 * Math.sin(time * 5);
    // Walking over it asks its verb pair; answered, it is yours (takeKey).
    if (!G.locked && near(hero.pos, key.to.x, key.to.z, KEY.reach)) {
      key.pair = key.pair || nextPair(true);
      openCard({ gate: 'key', pair: key.pair, step: 0 });
    }
  }
}
function takeKey() {
  key.state = 'taken';
  key.obj.visible = false; keyLight.intensity = 0;
  key.mark = unmark(key.mark);
  sfx.coin(2); after(0.1, () => sfx.sparkle());
  pop(t('key'), key.to.x, 2.4, key.to.z);
  flyToHud(key.to.x, 1, key.to.z);
  goalDone('hintDoor');
}

// Search props (levels.js `search`): Space next to one searches it. Every one not
// searched yet has the "usable" marker (the same on all, so it does not tell which).
function searchCheck(p, fx, fz) {
  room.search.forEach((sp, i) => {
    if (sp.done) return;
    const dx = sp.x - p.x, dz = sp.z - p.z, d = Math.hypot(dx, dz);
    if (d > sp.r + 1.7 || (d > 0.6 && (dx * fx + dz * fz) / d < 0.2)) return;
    searched(sp, false);
    reveal(i, sp.x, sp.z, true);
  });
}
function searched(sp, quiet) {
  sp.done = true;
  sp.mark = unmark(sp.mark);
  if (!quiet) sp.shake = 1;
}
function updateSearch(dt) {
  room.search.forEach((sp, i) => {
    if (sp.shake > 0) { // a wobble when searched
      sp.shake = Math.max(0, sp.shake - dt * 2.4);
      const k = sp.shake;
      sp.obj.rotation.z = Math.sin(k * 28) * 0.13 * k;
      sp.obj.position.y = Math.abs(Math.sin(k * 18)) * 0.18 * k;
    }
  });
}
// A small dust puff (searched prop, bonked skeleton without the key). Pooled sprites.
const puffs = [0, 1, 2, 3, 4, 5, 6, 7].map(() => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xd6def0, transparent: true, depthWrite: false, opacity: 0 }));
  s.visible = false; scene.add(s);
  return s;
});
const PUFF = { t: 1, x: 0, z: 0 };
function puff(x, z) { Object.assign(PUFF, { t: 0, x, z }); }
function updatePuff(dt) {
  if (PUFF.t >= 1) { for (const s of puffs) s.visible = false; return; }
  PUFF.t = Math.min(1, PUFF.t + dt / 0.6);
  const k = PUFF.t;
  puffs.forEach((s, i) => {
    const a = i * (Math.PI / 4) + 0.4, out = 1 - (1 - k) ** 2;
    s.visible = true;
    s.position.set(PUFF.x + Math.cos(a) * (0.3 + out * 1.3), 0.6 + out * 1.2 + (i % 2) * 0.35, PUFF.z + Math.sin(a) * (0.2 + out * 0.8));
    s.scale.setScalar(1.3 + out * 1.6);
    s.material.opacity = 0.9 * (1 - k);
  });
}
// A symbol flies from a pickup spot to its place in the HUD (decoration only; the HUD
// itself is updated by drawHud()).
function flyToHud(x, y, z, target = 'keySlot', html = '🔑') {
  _v.set(x, y, z).project(camera);
  const el = document.createElement('div');
  el.className = 'keyfly';
  el.innerHTML = html;
  el.style.left = `${(_v.x * 0.5 + 0.5) * window.innerWidth}px`;
  el.style.top = `${(-_v.y * 0.5 + 0.5) * window.innerHeight}px`;
  document.body.appendChild(el);
  const r = $(target).getBoundingClientRect();
  requestAnimationFrame(() => { el.style.left = `${r.left + r.width / 2}px`; el.style.top = `${r.top + r.height / 2}px`; el.style.scale = '0.6'; });
  setTimeout(() => el.remove(), 650);
}

// keep = { phase, goal, chest } saved before a dizzy restart of the same room.
function enterRoom(idx, keep = null) {
  if (room) room.dispose();
  for (const el of document.querySelectorAll('.pop')) el.remove();
  const defs = LEVELS[G.level].rooms;
  room = buildRoom(defs[idx]);
  scene.add(room.group);
  G.roomIdx = idx;
  clearMarks();
  resetKey();
  sweepCoins();
  spawnSkeletons();
  if (keep) {
    room.phase = keep.phase;
    if (room.chest) Object.assign(room.chest, keep.chest);
    if (room.phase === 'open') { room.doors[0].open = true; for (const s of skeletons) s.mode = 'calm'; }
  }
  // The back torches' lights follow the room's torches.
  torchLights.forEach((l, i) => { l.position.x = room.glows[i].position.x; });
  beyond.position.x = 0;
  hero.pos.set(0, 0, 6.4);
  hero.root.rotation.y = Math.PI;
  hero.setVisible(true);
  hero.play('Idle_A');
  cancelSwing();
  Object.assign(G, { locked: false, invuln: 0, kbx: 0, kbz: 0 });
  closeCard(); showSign(null);
  // The "usable" marker on what can be used here (search props: until searched, hideKey).
  for (const sp of room.search) sp.mark = markUsable(sp.obj, { radius: sp.r + 0.25, top: sp.top });
  const ch = room.chest;
  if (ch && !ch.open) ch.mark = markUsable(ch.obj, { radius: 1.35, top: 1.1 });
  goal().enter(keep && keep.goal);
  drawHud();
  $('fade').classList.remove('on');
}

function leaveRoom() {
  G.locked = true;
  const last = G.roomIdx === LEVELS[G.level].rooms.length - 1;
  $('fade').textContent = last ? '' : t('nextRoom');
  $('fade').classList.add('on');
  after(0.6, () => { if (last) finishLevel(); else enterRoom(G.roomIdx + 1); });
}

function finishLevel() {
  G.mode = 'end';
  const ratio = G.asked ? G.firstTry / G.asked : 1;
  const stars = ratio >= 1 ? 3 : ratio >= 0.6 ? 2 : 1;
  saveStars(LEVELS[G.level].id, stars);
  sfx.fanfare();
  $('hud').classList.remove('on');
  showSign(null);
  $('endTitle').textContent = t('done');
  $('stars').innerHTML = starsHtml(stars);
  sweepCoins();
  $('endLine').textContent = t('firstTry', G.firstTry, G.asked);
  $('endCoins').innerHTML = G.coinsRun ? `<i class="coin"></i> ${t('coinsWon', G.coinsRun)}` : '';
  $('missed').innerHTML = G.missed.length
    ? `<p>${t('practise')}</p>${G.missed.map((m) => `<div>${chainHtml(m)}</div>`).join('')}`
    : `<p>${t('perfect')}</p>`;
  $('btnNext').style.display = G.level < LEVELS.length - 1 ? '' : 'none';
  $('end').classList.add('on');
  $('fade').classList.remove('on');
  // Backdrop behind the end screen: the treasure room, calm.
  hero.pos.set(0, 0, 3); hero.root.rotation.y = 0; hero.play('Idle_A');
  clearSkeletons();
  resetKey();
}

function defeat() {
  G.locked = true;
  sfx.dizzy();
  cancelSwing();
  hero.play('Death_A', { once: true });
  pop('✦ ✦ ✦', hero.pos.x, 3, hero.pos.z);
  hint(t('dizzy'), 4);
  after(1.3, () => $('fade').classList.add('on'));
  after(1.9, () => {
    G.hearts = MAX_HEARTS;
    // The room starts again, but what was reached stays: where the key is (and which
    // hiding places were tried), a taken key, the boss's skulls, an opened chest.
    const { phase, chest } = room;
    enterRoom(G.roomIdx, { phase, goal: goal().save && goal().save(),
      chest: chest && { open: chest.open, pair: chest.pair, q: chest.q } });
  });
}

// ── Local diagnostics (localhost only): key presses, heartbeat and errors go to the
// dev server's request log as `diag?…`, so a session can see what a tester's browser does.
const DIAG = ['localhost', '127.0.0.1'].includes(location.hostname) && !params.has('qa');
function diag(kind, extra = {}) {
  if (!DIAG) return;
  const d = { kind, frames: typeof frameCount === 'number' ? frameCount : -1, mode: G.mode, locked: G.locked, focus: document.hasFocus(), keys: [...keys],
    t: +G.time.toFixed(1), pos: hero ? hero.pos.toArray().map((v) => +v.toFixed(2)) : null,
    card: G.card && G.card.gate, ...extra };
  fetch(`diag?${encodeURIComponent(JSON.stringify(d))}`).catch(() => {});
}
window.addEventListener('error', (e) => diag('error', { msg: e.message, at: `${e.filename}:${e.lineno}` }));
window.addEventListener('unhandledrejection', (e) => diag('rejection', { msg: String(e.reason && (`${e.reason.message || e.reason} | ${e.reason.stack || ''}`)) }));
document.addEventListener('click', (e) => { if (e.target.closest('button')) e.target.closest('button').blur(); });
document.addEventListener('keydown', (e) => diag('keydown', { code: e.code, key: e.key, target: e.target.tagName }), true);
window.addEventListener('blur', () => diag('blur'));
window.addEventListener('focus', () => diag('focus'));
setInterval(() => diag('beat'), 2000);

// ── Input ──────────────────────────────────────────────────────────────────
const keys = new Set();
window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  keys.add(e.code);
  if (G.mode === 'menu' || G.mode === 'end') { menuKey(e); return; }
  if (G.mode !== 'play') return;
  if (e.code === 'KeyM') toggleMute();
  if (G.card) { // the question card: 1–3 answer, Esc = later (chest only)
    if (/^(Digit|Numpad)[1-3]$/.test(e.code)) answer(Number(e.code.slice(-1)) - 1);
    if (e.code === 'Escape') later();
    return;
  }
  if (e.code === 'Space') bonk();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());
function menuKey(e) {
  const btns = G.mode === 'menu' ? [...$('levels').children] : [];
  const n = ['Digit1', 'Digit2', 'Digit3', 'Numpad1', 'Numpad2', 'Numpad3'].indexOf(e.code) % 3;
  if (G.mode === 'menu' && e.code.match(/^(Digit|Numpad)[1-3]$/) && !btns[n].disabled) { selectLevel(n); return; }
  if (G.mode === 'menu' && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) {
    const d = e.code === 'ArrowRight' ? 1 : -1;
    const k = G.menuSel + d;
    if (btns[k] && !btns[k].disabled) selectLevel(k);
    return;
  }
  if (e.code === 'Enter' || e.code === 'Space') {
    e.preventDefault();
    sfx.init(); sfx.uiClick();
    if (G.mode === 'menu') startLevel(G.menuSel);
    else startLevel(G.level < LEVELS.length - 1 && loadStars()[LEVELS[G.level].id] ? G.level + 1 : G.level);
  }
}
function selectLevel(k) {
  G.menuSel = k;
  [...$('levels').children].forEach((b, i) => b.classList.toggle('sel', i === k));
}
function toggleMute() { sfx.setMuted(!sfx.muted); drawHud(); }
tap($('focus'), () => { window.focus(); sfx.init(); });
tap($('mute'), () => { sfx.init(); toggleMute(); });
tap($('btnNext'), () => { sfx.init(); sfx.uiClick(); startLevel(G.level + 1); });
tap($('btnAgain'), () => { sfx.init(); sfx.uiClick(); startLevel(G.level); });
tap($('btnMenu'), () => { sfx.init(); sfx.uiClick(); showMenu(); });
// Touch: a stick on the left, the sword button = Space (src/touch.js).
initTouch({ canvas: renderer.domElement, label: t('howBonk'),
  playing: () => G.mode === 'play' && !G.card,
  onSwing: () => { sfx.init(); if (G.mode === 'play' && !G.card) bonk(); },
  onMode: () => applyStatic() });

// ── Hero ───────────────────────────────────────────────────────────────────
// Weapon swing: a horizontal cut (each hero's clip in heroes.js SWINGS, upper body only,
// see Assets), played on top of whatever the legs do, so you can swing while running.
// Flat sweeps are used because the camera looks down: an overhead chop hides behind the
// hero's head, a slice draws a wide arc on the floor. Every swing starts inside its
// wind-up (`from`), so after the key press:
//   ~0.06 s strike begins · ~0.12 s blade is in front = hit check (`hitAfter`) ·
//   ~0.23 s strike done · 0.38 s (`cadence`) the next swing is allowed and the arms
//   blend back over `out` seconds.
// `share` is how much of the arm pose comes from the swing (rest: run/idle clip).
// Knight swing as measured (1H slice): 0.00–0.20 s wind-up (blade to +100°), 0.20–0.37 s
// strike +100° → −77°, ahead at 0.26 s; the other clips are measured in heroes.js.
const SWING = { hitAfter: 0.11, share: 0.97, out: 0.16, cadence: 0.38 };
function swingWeight(share) { return share / (1 - share); } // mixer weights are relative; base clips sum to 1
let heroSwing = null; // { hero, key, def (SWINGS entry), act (the hero's action) } — set in buildHero
function bonk() {
  if (G.locked || G.attackT > 0) return;
  const { def: sw, act: a } = heroSwing;
  a.reset();
  a.time = sw.from;
  a.timeScale = sw.speed;
  a.setLoop(THREE.LoopOnce, 1);
  a.clampWhenFinished = true;
  a.setEffectiveWeight(swingWeight(SWING.share));
  a.play();
  G.attackT = G.attackLen = SWING.cadence;
  G.swingOut = 0;
  G.hitDone = false;
  for (const tr of trails) tr.state = 'wait';
  sfx.swing();
}

// Swoosh: a glowing crescent that follows a blade through the strike and fades out,
// so the swing reads even when the arm is small on screen. One mesh per trail (20 quads,
// vertex colours, additive), child of the hero, rebuilt in place each frame of a swing.
// The colour and shape come from the hero's `trails` (heroes.js): the rogue has two.
function makeTrail(def) {
  const N = 20, pos = new Float32Array((N + 1) * 3 * 3), col = new Float32Array((N + 1) * 3 * 3), idx = [];
  const tail = new THREE.Color(def.color), head = new THREE.Color(0xffffff).lerp(tail, def.tint || 0), c = new THREE.Color();
  for (let i = 0; i <= N; i++) {
    const u = i / N, fade = (1 - u) ** 1.5; // 0 = at the blade, 1 = end of the tail
    c.copy(head).lerp(tail, Math.min(1, u * 4));
    [0, 0.3, 1].forEach((b, row) => { // dark inner edge, brightest where the blade tip passed
      col.set([c.r * fade * b, c.g * fade * b, c.b * fade * b], (i * 3 + row) * 3);
    });
    if (i < N) for (const r of [0, 1]) { const a = i * 3 + r, b = a + 3; idx.push(a, a + 1, b, b, a + 1, b + 1); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  mesh.frustumCulled = false; mesh.visible = false; mesh.renderOrder = 5;
  return { mesh, N, slot: null, dir: def.dir || -1, r0: def.r0 ?? 1.0, r1: def.r1 ?? 2.3, maxLen: def.maxLen ?? 2.4,
    state: 'off', start: 0, head: 0, y: 1, life: 0, len: 0 };
}
let trails = []; // the current hero's swooshes (buildHero)
const SWOOSH = { fade: 0.14, bladeLen: 1.4 };
function drawSwoosh(tr) {
  const { N, mesh } = tr, a = mesh.geometry.attributes.position;
  for (let i = 0; i <= N; i++) {
    const u = i / N, ang = tr.head - tr.dir * u * tr.len, sn = Math.sin(ang), cs = Math.cos(ang);
    // Crescent: a point at the blade (u = 0), full width just behind it, thinning to the tail.
    const outer = tr.r1 - 0.12 * u;
    const width = (tr.r1 - tr.r0) * Math.min(1, u / 0.12) * (1 - u) ** 0.8;
    [outer - width, outer - width * 0.45, outer].forEach((r, row) => a.setXYZ(i * 3 + row, sn * r, tr.y, cs * r));
  }
  a.needsUpdate = true;
}
// Runs after the mixer update, so it sees this frame's blade position.
function updateSwoosh(dt) {
  const act = heroSwing && heroSwing.act, sw = heroSwing && heroSwing.def;
  for (const tr of trails) {
    if (tr.state === 'off') continue;
    if (tr.state === 'wait') {
      if (G.attackT <= 0) { tr.state = 'off'; continue; }
      if (act.time < sw.strikeFrom) continue;
      tr.state = 'sweep'; tr.start = null;
    }
    if (tr.state === 'sweep') {
      hero.root.updateMatrixWorld(true);
      hero.root.worldToLocal(_v.set(0, SWOOSH.bladeLen, 0).applyMatrix4(tr.slot.matrixWorld));
      const yaw = Math.atan2(_v.x, _v.z);
      if (tr.start === null) { tr.start = tr.head = yaw; tr.life = 1; tr.mesh.visible = true; }
      // The strike only moves one way: dir −1 to the hero's right, +1 to the left.
      tr.head = tr.dir < 0 ? Math.min(tr.head, yaw) : Math.max(tr.head, yaw);
      tr.y = _v.y;
      tr.len = Math.min(tr.maxLen, Math.abs(tr.start - tr.head));
      if (act.time >= sw.strikeTo || G.attackT <= 0) tr.state = 'fade';
    } else { // fade: the tail catches up with the blade
      tr.life -= dt / SWOOSH.fade;
      tr.len *= Math.max(0, 1 - dt * 9);
      if (tr.life <= 0) { tr.state = 'off'; tr.mesh.visible = false; continue; }
    }
    tr.mesh.material.opacity = Math.max(0, tr.life);
    drawSwoosh(tr);
  }
}

// Weapons that do not just sit in the hand (heroes.js `hold`), set after the mixer update.
let heldGear = []; // [{ obj, slot, hold }]
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _w = new THREE.Vector3();
// Upright weapons lean forward and a little outward, so the shaft shows from the camera.
const UPRIGHT_TILT = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.35, 0, 0.7));
function updateGear() {
  if (!heldGear.length) return;
  hero.root.updateMatrixWorld(true);
  for (const g of heldGear) {
    g.slot.getWorldQuaternion(_q);
    if (g.hold === 'faceCam') { // turn about the handle (local y) so the flat side (local z) faces the camera
      g.slot.getWorldPosition(_w);
      _v.copy(camera.position).sub(_w).applyQuaternion(_q.invert());
      if (_v.x * _v.x + _v.z * _v.z > 1e-4) g.obj.rotation.set(0, Math.atan2(_v.x, _v.z), 0);
    } else if (g.hold === 'upright') { // vertical, turned with the hero
      _q2.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, hero.root.rotation.y).multiply(UPRIGHT_TILT);
      g.obj.quaternion.copy(_q.invert()).multiply(_q2);
    }
  }
}

// Builds the hero from a loaded model (heroes.js) and swaps it in for the current one.
function buildHero(id) {
  const def = heroDef(id), old = hero;
  const c = new Char(Assets.heroes[def.id], Assets.clips);
  // GLTFLoader strips the dot from bone names: 'handslot.r' arrives as 'handslotr'.
  const slots = { r: c.root.getObjectByName('handslotr'), l: c.root.getObjectByName('handslotl') };
  heldGear = [];
  for (const g of def.gear) {
    if (!slots[g.slot]) continue;
    const obj = Assets.gear[g.model].clone(true);
    if (g.scale) obj.scale.setScalar(g.scale);
    if (g.glow) { const gl = makeGlow(g.glow.color, g.glow.size); gl.position.y = g.glow.y; gl.material.opacity = 0.95; obj.add(gl); }
    slots[g.slot].add(obj);
    if (g.hold && g.hold !== 'fixed') heldGear.push({ obj, slot: slots[g.slot], hold: g.hold });
  }
  for (const tr of trails) { tr.mesh.geometry.dispose(); tr.mesh.material.dispose(); }
  trails = def.trails.map((td) => Object.assign(makeTrail(td), { slot: slots[td.slot] || slots.r }));
  for (const tr of trails) c.root.add(tr.mesh);
  heroSwing = { hero: def.id, key: def.swing, def: SWINGS[def.swing], act: c.actions[`Swing_${def.swing}`] };
  sparks.material.color.setHex(def.sparks || 0xffcf5e);
  hitFlash.material.color.setHex(def.magic ? 0xe6ccff : 0xfff2c0);
  FX.magic = !!def.magic;
  if (old) { c.pos.copy(old.pos); c.root.rotation.y = old.root.rotation.y; old.dispose(); }
  scene.add(c.root);
  hero = c;
  hero.play('Idle_A');
  hero.mixer.update(0);
  updateGear();
}
async function setHero(id) {
  await Assets.loadHero(heroDef(id));
  if (Save.hero === id || G.mode === 'loading') buildHero(id); // not if another one was picked meanwhile
}
function cancelSwing() { // room change, dizzy
  heroSwing.act.stop();
  G.attackT = G.swingOut = 0; G.hitDone = true;
  for (const tr of trails) { tr.state = 'off'; tr.mesh.visible = false; }
}

// Hit feedback: a flash and a few sparks at the skeleton, a very short freeze and a
// small camera shake. All pooled: one sprite, one Points object.
const hitFlash = makeGlow(0xfff2c0, 1);
hitFlash.material.depthTest = false; // drawn over the skeleton
hitFlash.visible = false; hitFlash.renderOrder = 6;
scene.add(hitFlash);
const SPARKS = 8;
const sparks = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({
  map: glowTex, color: 0xffcf5e, size: 0.5, transparent: true, blending: THREE.AdditiveBlending,
  depthWrite: false, depthTest: false }));
sparks.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SPARKS * 3), 3));
sparks.frustumCulled = false; sparks.visible = false; sparks.renderOrder = 6;
scene.add(sparks);
const FX = { flash: 0, stop: 0, shake: 0, x: 0, z: 0, spin: 0 };
function hitFx(x, z) {
  hitFlash.position.set(x, 1.6, z);
  Object.assign(FX, { flash: 1, stop: 0.05, shake: 1, x, z, spin: G.time * 7 });
}
function updateFx(dt) {
  if (FX.flash > 0) {
    FX.flash = Math.max(0, FX.flash - dt / 0.22);
    const on = FX.flash > 0, k = 1 - FX.flash; // k: 0 → 1 over 0.22 s
    hitFlash.visible = on && k < 0.7;
    hitFlash.scale.setScalar(1.3 + k * 4.5);
    hitFlash.material.opacity = 0.85 * Math.max(0, 1 - k / 0.7);
    sparks.visible = on;
    sparks.material.opacity = Math.min(1, FX.flash * 2);
    sparks.material.size = FX.magic ? 0.45 + 0.3 * Math.abs(Math.sin(G.time * 37)) : 0.5;
    const a = sparks.geometry.attributes.position, r = 0.4 + 2.1 * (1 - (1 - k) ** 2);
    for (let i = 0; i < SPARKS; i++) {
      const ang = FX.spin + i * (Math.PI * 2 / SPARKS), up = 0.55 + 0.45 * Math.sin(i * 2.4);
      if (FX.magic) { // the mage's hit: sparkles spiral up and twinkle instead of falling
        const sp = ang + k * 2.2;
        a.setXYZ(i, FX.x + Math.cos(sp) * r * 0.7, 1.2 + up * 0.6 + k * 1.6, FX.z + Math.sin(sp) * r * 0.5);
      } else a.setXYZ(i, FX.x + Math.cos(ang) * r, 1.6 + up * r * 0.6 - k * k * 0.5, FX.z + Math.sin(ang) * r * 0.6);
    }
    a.needsUpdate = true;
  }
  if (FX.shake > 0) {
    FX.shake = Math.max(0, FX.shake - dt / 0.14);
    const k = FX.shake * 0.07;
    camera.position.set(camBase.x + Math.sin(G.time * 91) * k, camBase.y + Math.cos(G.time * 77) * k, camBase.z);
  }
}

function bonkCheck() {
  const p = hero.pos, a = hero.root.rotation.y, fx = Math.sin(a), fz = Math.cos(a);
  for (const s of skeletons) {
    if (s.mode === 'down' || s.mode === 'rise' || s.mode === 'hidden') continue;
    const dx = s.pos.x - p.x, dz = s.pos.z - p.z, d = Math.hypot(dx, dz);
    if (d > 2.6 || (d > 0.6 && (dx * fx + dz * fz) / d < 0.2)) continue;
    s.mode = 'down'; s.t = 2.6; s.squash = 1;
    s.play('Death_A', { once: true, fade: 0.08 });
    sfx.bonk(); after(0.15, () => sfx.boneRattle());
    pop(t('bonk'), s.pos.x, 2.6, s.pos.z);
    hitFx(s.pos.x, s.pos.z);
    if (goal().onBonk) goal().onBonk(s);
  }
  if (goal().onSwing) goal().onSwing(p, fx, fz);
  searchCheck(p, fx, fz);
  for (let i = arrows.length - 1; i >= 0; i--) { // swat arrows out of the air
    const q = arrows[i].obj.position, dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz);
    if (d > 2.6 || (d > 0.6 && (dx * fx + dz * fz) / d < 0.2)) continue;
    pop(t('swat'), q.x, 2.2, q.z, '#2ee6c0');
    sfx.thud();
    removeArrow(i);
  }
}

function collide(p, r, allowDoor) {
  p.x = Math.min(BOUNDS.maxX, Math.max(BOUNDS.minX, p.x));
  const ex = room.exitX, inDoor = allowDoor && Math.abs(p.x - ex) < 0.7;
  p.z = Math.min(BOUNDS.maxZ, Math.max(inDoor ? -10.5 : BOUNDS.minZ, p.z));
  if (p.z < BOUNDS.minZ) p.x = Math.min(ex + 0.7, Math.max(ex - 0.7, p.x));
  for (const o of room.obstacles) {
    const dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz), min = o.r + r;
    if (d < min && d > 1e-4) { p.x = o.x + dx / d * min; p.z = o.z + dz / d * min; }
  }
}
const near = (p, x, z, r) => (p.x - x) ** 2 + (p.z - z) ** 2 < r * r;

let doorNagT = 0;
function updateHero(dt) {
  const p = hero.pos;
  if (G.invuln > 0) {
    G.invuln -= dt;
    hero.setVisible(G.invuln <= 0 || Math.floor(G.time * 14) % 2 === 0);
  }
  if (G.locked) return;
  // Knock-back after a skeleton bump.
  if (G.kbx || G.kbz) {
    p.x += G.kbx * dt; p.z += G.kbz * dt;
    const k = Math.max(0, 1 - dt * 6); G.kbx *= k; G.kbz *= k;
    if (Math.abs(G.kbx) + Math.abs(G.kbz) < 0.3) G.kbx = G.kbz = 0;
    collide(p, 0.55, false);
  }
  if (G.attackT > 0) {
    G.attackT -= dt;
    if (!G.hitDone && G.attackLen - G.attackT >= SWING.hitAfter) { G.hitDone = true; bonkCheck(); }
    if (G.attackT <= 0) G.swingOut = SWING.out;
  } else if (G.swingOut > 0) { // blend the arms back to the run/idle clip (eased)
    G.swingOut = Math.max(0, G.swingOut - dt);
    const k = G.swingOut / SWING.out, a = heroSwing.act;
    if (k > 0) a.setEffectiveWeight(swingWeight(SWING.share * k * k * (3 - 2 * k))); else a.stop();
  }
  let dx = 0, dz = 0, k = 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) dx -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) dx += 1;
  if (keys.has('KeyW') || keys.has('ArrowUp')) dz -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) dz += 1;
  if (!dx && !dz && stick.speed) { dx = stick.x; dz = stick.z; k = stick.speed; } // touch stick (camera has no yaw: screen = room)
  if (dx || dz) {
    const n = Math.hypot(dx, dz), speed = 6.2 * k;
    p.x += dx / n * speed * dt; p.z += dz / n * speed * dt;
    collide(p, 0.55, room.phase === 'open');
    hero.face(dx, dz, dt);
    hero.play('Running_A');
  } else {
    hero.play('Idle_A');
  }
  // The door: with the key it opens by itself (the treasure room's door asks first);
  // without, a hint.
  if (near(p, DOOR.x, DOOR.z + 1.2, 3.2)) {
    if (room.phase === 'door' && room.type !== 'vault') openExit(room.doors[0]);
    else if (room.phase === 'door' && near(p, DOOR.x, DOOR.z + 1.2, 2.4)) openCard({ gate: 'door', pair: nextPair(true), step: 0 });
    else if (room.phase === 'goal' && goal().doorHint && doorNagT <= 0) { hint(t(goal().doorHint), 2.5); doorNagT = 4; }
  }
  doorNagT -= dt;
  // A chest: walking into it opens its bonus question. After "later" the hero must step
  // away before it asks again.
  const c = room.chest;
  if (c && !c.open && !G.card) {
    if (c.armed === false) c.armed = !near(p, c.x, c.z, 3.2);
    else if (near(p, c.x, c.z, 2.0)) {
      if (!c.q) { c.pair = nextPair(false); c.q = single(c.pair); }
      openCard({ gate: 'chest', pair: c.pair, q: c.q });
    }
  }
  showSign(goal().sign ? goal().sign() : null);
  if (p.z < -8.4) leaveRoom();
}

// ── Skeletons ──────────────────────────────────────────────────────────────
function updateSkeleton(s, dt, frozen) {
  const p = s.pos, hp = hero.pos;
  if (s.mode === 'hidden') return; // ambush skeleton that has not risen yet
  if (s.squash > 0) { // squash and stretch on the bonk
    s.squash = Math.max(0, s.squash - dt * 4);
    const k = Math.sin(s.squash * Math.PI);
    s.root.scale.set(1 + k * 0.25, 1 - k * 0.3, 1 + k * 0.25);
  }
  if (s.mode === 'down') {
    s.t -= dt;
    if (s.t <= 0) { s.mode = 'rise'; s.t = s.dur('Spawn_Ground'); s.play('Spawn_Ground', { once: true, fade: 0.05 }); sfx.reassemble(); }
    return;
  }
  if (s.mode === 'rise') {
    s.t -= dt;
    if (s.t <= 0) { s.mode = s.afterRise || 'calm'; s.afterRise = null; s.play('Walking_A'); }
    return;
  }
  // Nothing attacks while a question is open, the hero is dizzy, or after a bump.
  if (frozen || s.pause > 0) { s.pause -= dt; s.play('Idle_A'); return; }
  const angry = s.mode === 'patrol'; // not bonked yet; 'calm' ones just wander, sheepish
  if (s.archer && angry) { updateArcher(s, dt); return; }
  const chase = angry && near(p, hp.x, hp.z, 6) && hp.z > BOUNDS.minZ;
  const goal = chase ? hp : s.route[s.wp];
  const dx = goal.x - p.x, dz = goal.z - p.z, d = Math.hypot(dx, dz);
  if (chase && d < 1.15) {
    if (G.invuln <= 0) bump(s, dx / d, dz / d);
    return;
  }
  if (!chase && d < 0.4) { s.wp = (s.wp + 1) % s.route.length; return; }
  const speed = chase ? 2.7 : angry ? 1.6 : 1.1;
  p.x += dx / d * speed * dt; p.z += dz / d * speed * dt;
  collide(p, 0.5, false);
  s.face(dx, dz, dt, 6);
  s.play('Walking_A', { speed: chase ? 1.5 : 1 });
}
function bump(s, nx, nz) {
  s.pause = 1.3;
  hurt(nx, nz);
}
function hurt(nx, nz) { // −1 heart and a push in direction (nx, nz)
  G.hearts -= 1;
  G.invuln = 1.6; G.kbx = nx * 9; G.kbz = nz * 9;
  sfx.hurt();
  pop(t('ouch'), hero.pos.x, 3, hero.pos.z, '#ff8585');
  drawHud();
  if (G.hearts <= 0) defeat();
}

// ── World ──────────────────────────────────────────────────────────────────
function updateTorches() { // on the wall clock: they flicker on while the card is open
  const time = G.wall;
  torchLights.forEach((l, i) => {
    const f = 0.82 + 0.12 * Math.sin(time * 9 + l.userData.seed) + 0.08 * Math.sin(time * 23.7 + l.userData.seed * 3);
    l.intensity = 34 * f;
    if (room) room.glows[i].scale.setScalar(2.6 * (0.9 + (f - 0.82) * 0.9));
  });
}
function updateWorld(dt) {
  const time = G.time;
  updatePuff(dt);
  if (room) {
    updateSearch(dt);
    updateMarks(time);
    const k = Math.min(1, dt * 4);
    for (const d of room.doors) d.leaf.rotation.y += ((d.open ? 1.9 : 0) - d.leaf.rotation.y) * (room.slam ? Math.min(1, dt * 22) : k);
    if (room.slam && room.doors[0].leaf.rotation.y < 0.02) room.slam = false;
    if (room.chest) room.chest.lid.rotation.x += ((room.chest.open ? -1.15 : 0) - room.chest.lid.rotation.x) * Math.min(1, dt * 6);
    // The lock glows once the key is yours (and at the treasure room's door).
    const lit = room.phase === 'door' && G.mode === 'play' ? 0.75 + 0.25 * Math.sin(time * 4) : 0;
    const lg = room.lockGlow.material;
    lg.opacity += (lit - lg.opacity) * Math.min(1, dt * 6);
    room.lockGlow.visible = lg.opacity > 0.01;
  }
  const a = dust.geometry.attributes.position;
  for (let i = 0; i < a.count; i++) {
    let y = a.getY(i) + dt * 0.12;
    if (y > 4.6) y = 0.4;
    a.setY(i, y);
    a.setX(i, a.getX(i) + Math.sin(time * 0.5 + i) * dt * 0.05);
  }
  a.needsUpdate = true;
}

// ── Main loop ──────────────────────────────────────────────────────────────
let focusShown = false, playingShown = false;
function step(dt) {
  G.wall += dt;
  if (hintTimer > 0 && (hintTimer -= dt) <= 0) $('hint').classList.remove('on');
  if (toastTimer > 0 && (toastTimer -= dt) <= 0) $('toast').classList.remove('on');
  // Keys only reach the page while it has focus (it often sits in a frame or panel).
  // Without focus: pause and ask for a click instead of ignoring the keyboard silently.
  // Touch play needs no keyboard focus.
  const unfocused = G.mode === 'play' && !params.has('qa') && !touchOn() && !document.hasFocus();
  if (unfocused !== focusShown) { focusShown = unfocused; $('focus').classList.toggle('on', unfocused); if (unfocused) keys.clear(); }
  const playing = G.mode === 'play'; // the touch controls show only while a level runs
  if (playing !== playingShown) { playingShown = playing; document.body.classList.toggle('playing', playing); if (!playing) resetTouch(); }
  updateTorches();
  // The question card pauses everything (skeletons, golem, arrows, timers, animations).
  if (G.card) return;
  if (FX.stop > 0) { FX.stop -= dt; dt *= 0.1; } // hit-stop: the world nearly freezes for 50 ms
  G.time += dt;
  for (let i = timers.length - 1; i >= 0; i--) {
    timers[i].t -= dt;
    if (timers[i].t <= 0) { const { fn } = timers[i]; timers.splice(i, 1); fn(); }
  }
  if (G.mode === 'play' && !unfocused) {
    updateHero(dt);
    if (goal().update) goal().update(dt);
    for (const s of skeletons) updateSkeleton(s, dt, G.locked);
    if (!G.locked) updateArrows(dt);
    updateCoins(dt);
  }
  updateWorld(dt);
  hero.mixer.update(dt);
  for (const s of skeletons) s.mixer.update(dt);
  if (golem) golem.mixer.update(dt);
  updateGear();
  updateSwoosh(dt);
  updateFx(dt);
}
let last = 0, frameCount = 0;
function frame(ms) {
  frameCount += 1;
  const dt = Math.min(0.05, (ms - last) / 1000 || 0);
  last = ms;
  if (!window.__freeze) step(dt); // __freeze: QA screenshots of a single pose
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// ── Boot ───────────────────────────────────────────────────────────────────
function applyStatic() {
  document.documentElement.lang = lang;
  $('tagline').textContent = t('tagline');
  $('howto').innerHTML = touchOn()
    ? `<div><i class="ico stickIco"></i>${t('howMove')}</div><div><i class="ico swordIco">${swordIcon}</i>${t('howBonk')}</div>`
      + `<div><i class="ico">👆</i>${t('howAnswer')}</div>`
    : `<div><kbd>WASD</kbd><kbd>↑↓←→</kbd>${t('howMove')}</div>`
      + `<div><kbd>Space</kbd>${t('howBonk')}</div><div><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd>${t('howAnswer')}</div>`;
  $('btnNext').textContent = t('next');
  $('btnAgain').textContent = t('again');
  $('btnMenu').textContent = t('menu');
  $('rotate').textContent = t('rotate');
  $('loading').textContent = t('loading');
  $('focusText').textContent = t('clickToPlay');
}
applyStatic();

Assets.load().then(async () => {
  buildHero('knight');
  hero.pos.set(0, 0, 3);
  if (Save.hero !== 'knight') await setHero(Save.hero).catch(() => Save.choose('knight'));
  initKey();
  // The word plates in the rooms are drawn on canvases: the font must be there first.
  try { await document.fonts.load("40px 'Fredoka One'"); } catch (_) { /* falls back to Nunito */ }
  bossStone.set('?', 'base');
  // Backdrop behind the menu: the first room, no skeletons.
  room = buildRoom(LEVELS[0].rooms[0]);
  scene.add(room.group);
  hero.pos.set(0, 0, 3); hero.play('Idle_A');
  $('loading').remove();
  showMenu();

  // QA hook: lets a script play without a keyboard (see CLAUDE.md).
  const run = (n) => { for (let i = 0; i < n; i++) step(1 / 30); };
  const QA = window.__VD = {
    G, keys, run, step, startLevel, answer, bonk, later, askLog,
    get room() { return room; }, get hero() { return hero; }, get skeletons() { return skeletons; },
    info: () => ({ mode: G.mode, level: G.level, room: G.roomIdx, hearts: G.hearts, asked: G.asked,
      firstTry: G.firstTry, missed: G.missed.map((m) => m.base), card: G.card && `${G.card.gate}:${cardQ(G.card).ask}`,
      type: room.type, phase: room.phase, door: room.doors[0].open, coins: Save.coins, hero: Save.hero, built: heroSwing && heroSwing.hero, lying: coins.length, arrows: arrows.length,
      boss: room.boss ? `${room.boss.state}:${room.boss.hp}` : undefined, key: key.state,
      hide: room.hide ? `${room.hide.where}:${room.hide.keyIn}:${room.hide.checked.join('')}` : undefined,
      bridge: room.bridge ? `${room.bridge.step}:${room.bridge.fall > 0 ? 'fall' : pitAt(hero.pos.z) >= 0 ? 'stone' : 'floor'}:${room.stones.filter((x) => x.gone).length}` : undefined,
      retry: G.retry.map((r) => r.base), skeletons: skeletons.map((s) => s.mode),
      marks: markCount(), source: Q.source, tiers: Q.tierInfo, calls: renderer.info.render.calls, tris: renderer.info.render.triangles }),
    teleport: (x, z, rot) => { hero.pos.set(x, 0, z); if (rot != null) hero.root.rotation.y = rot; },
    bonkOne: (sk) => {
      hero.pos.set(sk.pos.x, 0, sk.pos.z + 1.4); hero.root.rotation.y = Math.PI;
      G.attackT = 0; bonk(); run(25);
    },
    bonkAll: () => { for (const sk of skeletons) if (sk.mode === 'patrol' || sk.mode === 'calm') QA.bonkOne(sk); },
    searchOne: (i, n = 25) => { // stand beside search prop i (room side), facing it, and swing
      QA.besideProp(i);
      G.attackT = 0; bonk(); run(n);
    },
    besideProp: (i) => {
      const sp = room.search[i], side = sp.x > 0 ? -1 : 1;
      hero.pos.set(sp.x + side * (sp.r + 0.7), 0, sp.z); hero.root.rotation.y = -side * Math.PI / 2;
    },
    hideIn: (i) => { room.hide.keyIn = i; }, // QA: choose the hiding place
    keyObj: () => key.to, // where the key lands / lies
    golemPos: () => [golem.pos.x, golem.pos.z], cardNow: () => G.card && cardQ(G.card),
    // Bonk the skeletons / search the props one by one until the key pops out.
    findKey: () => {
      const h = room.hide;
      for (let n = 0; n < 8 && key.state === 'hidden'; n++) {
        if (h.where === 'search') {
          const i = room.search.findIndex((sp) => !sp.done);
          if (i < 0) break;
          QA.searchOne(i);
        } else {
          const sk = skeletons.find((s) => !h.checked.includes(s.idx) && (s.mode === 'patrol' || s.mode === 'calm'));
          if (sk) QA.bonkOne(sk); else run(30);
        }
      }
      for (let i = 0; i < 40 && key.state === 'fly'; i++) run(1);
    },
    // Answers the open card: both forms of a pair (key, door), one question otherwise.
    // wrongFirst = one mistake first. Returns what was asked.
    answerCard: (wrongFirst) => {
      const asked = [];
      for (let k = 0; k < 2 && G.card; k++) {
        const c = G.card, q = cardQ(c);
        asked.push(`${c.gate}:${q.base}:${q.ask}`);
        if (wrongFirst && k === 0) QA.answerWrong();
        QA.answerRight();
        if (c.gate !== 'key' && c.gate !== 'door') break;
      }
      return asked.join(',');
    },
    // Rune doors / word bridge: walk into the right (or a wrong) door, or walk across the
    // right (wrong) stone of the current row with the W key. hold = stop once on the stone.
    pick: (right, hold) => {
      const st = room.type === 'rune' ? room.rune : room.bridge, q = st.pair.steps[st.step];
      const i = q.options.findIndex((o, k) => (o === q.answer) === right && !(q.tried && q.tried.includes(k)));
      if (room.type === 'rune') {
        QA.teleport(room.doors[i].x, -5, Math.PI); run(3); QA.teleport(room.doors[i].x, -6.9); run(3);
      } else {
        const pit = PITS[st.step], sx = STONE.cols[i];
        QA.teleport(sx, pit.near + 1.2, Math.PI); run(2);
        keys.add('KeyW');
        for (let k = 0; k < 90 && st.fall <= 0 && hero.pos.z > pit.far - 0.9; k++) { run(1); if (hold && pitAt(hero.pos.z) >= 0) break; }
        keys.delete('KeyW');
        if (!hold) for (let k = 0; k < 60 && st.fall > 0; k++) run(1);
      }
      return q.options[i];
    },
    log: [],
    // Does the room's goal like a player would. wrong = one mistake first.
    solve: {
      key: (wrong) => {
        QA.findKey();
        if (key.state === 'floor') { QA.teleport(key.to.x, key.to.z + 0.5); run(2); }
        QA.log.push(QA.answerCard(wrong));
        run(5);
      },
      ambush: (wrong) => {
        QA.teleport(0, 1); run(3); // springs the trap
        for (let i = 0; i < 200 && skeletons.some((sk) => sk.mode === 'hidden' || sk.mode === 'rise'); i++) run(1);
        QA.solve.key(wrong);
      },
      rune: (wrong) => {
        if (wrong) { QA.pick(false); run(40); }
        QA.pick(true); run(40); QA.pick(true); run(10);
      },
      bridge: (wrong) => {
        if (wrong) { QA.pick(false); run(10); }
        QA.pick(true); run(15); QA.pick(true); run(15);
      },
      vault: (wrong) => {
        for (const c of coins.slice()) { QA.teleport(c.to.x, c.to.z + 0.5); run(3); }
        QA.teleport(0, -5.6); run(2);
        QA.log.push(QA.answerCard(wrong));
      },
      // Boss: wait for the stone, answer on it, bonk the dizzy golem; until it falls.
      boss: (wrong) => {
        const b = room.boss;
        for (let round = 0; round < 12 && b.state !== 'dead'; round++) {
          for (let i = 0; i < 400 && !b.stone; i++) run(1);
          if (!b.stone) break;
          QA.teleport(b.stone.x, b.stone.z); run(2);
          if (!G.card) continue; // the golem is mid-move; try again
          if (wrong && round === 0) { QA.answerWrong(); run(3); continue; }
          QA.answerRight(); run(3);
          QA.teleport(golem.pos.x, golem.pos.z + 2.4, Math.PI); G.attackT = 0; bonk(); run(40);
        }
        run(60); // coins fly, the exit opens
      },
    },
    doGoal: (wrong) => QA.solve[room.type](wrong),
    answerRight: () => { if (!G.card) return; const q = cardQ(G.card); answer(q.options.indexOf(q.answer)); },
    answerWrong: () => { if (!G.card) return; const q = cardQ(G.card); answer(q.options.findIndex((o, k) => o !== q.answer && !(q.tried && q.tried.includes(k)))); },
    // Plays the current room to the next one. wrongFirst = make one mistake (at the key,
    // the rune doors, the bridge, the boss or the treasure door). Optional skeletons stay angry.
    playRoom: (wrongFirst) => {
      const log = [];
      QA.log = log;
      G.invuln = 99; // the script teleports into skeletons; keep it from getting bumped
      const keyRoom = room.type === 'key' || room.type === 'ambush';
      if (room.type === 'key') { QA.teleport(0, -5.6); run(3); log.push(`locked:${room.phase}:${room.doors[0].open}`); }
      if (goal().sign) log.push(`${room.type}:${room[room.type].pair.base}`);
      if (room.chest && !room.chest.open) { // first put the chest off ("later"), then come back and answer it
        const ch = room.chest, at = () => { QA.teleport(ch.x - 1.2, ch.z + 1.2); run(2); };
        at(); log.push(`chest:${G.card && `${G.card.gate}:${cardQ(G.card).ask}`}`);
        later(); run(2); at(); log.push(`later:${!!G.card}:${ch.open}`);
        QA.teleport(0, 5); run(2); at(); log.push(`back:${!!G.card}`);
        QA.answerRight(); run(25); log.push(`opened:${ch.open}`);
        for (const c of coins.slice()) { QA.teleport(c.to.x, c.to.z + 0.5); run(2); }
      }
      QA.doGoal(wrongFirst); run(20);
      log.push(keyRoom ? `key:${key.state}:${room.hide.where}` : `${room.type}:${room.phase}`);
      for (let i = 0; i < 60 && coins.some((c) => c.state === 'fly'); i++) run(1);
      for (const c of coins.slice()) { QA.teleport(c.to.x, c.to.z + 0.5); run(2); } // pick up what dropped
      if (keyRoom) { QA.teleport(0, -4.4); run(3); log.push(`door:${room.phase}:${room.doors[0].open}`); }
      run(30);
      QA.teleport(room.exitX, -6.9); keys.add('KeyW'); run(12); keys.delete('KeyW');
      run(25);
      return log;
    },
  };
  requestAnimationFrame(frame);
  if (params.has('play') && !params.has('qa')) startLevel(Math.max(0, Number(params.get('play')) - 1)); // dev: skip the menu

  // ?qa=play[&level=2][&stop=3] plays a level by script and prints the result (headless checks).
  // ?qa=keys: like a real player — click path (sound on), real frames, synthetic key events.
  if (params.get('qa') === 'keys') {
    const out = [];
    const report = () => { $('qa').textContent = JSON.stringify(out); fetch(`qa-report?${encodeURIComponent(JSON.stringify(out))}`).catch(() => {}); };
    window.addEventListener('error', (e) => { out.push(`WINDOW ERROR ${e.message} @${e.lineno}`); report(); });
    try {
      if (params.has('sound')) sfx.init();
      await startLevel(0);
      out.push({ start: hero.pos.toArray(), locked: G.locked, mode: G.mode });
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', key: 'w' }));
      await new Promise((r) => setTimeout(r, 1500));
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', key: 'w' }));
      out.push({ afterW: hero.pos.toArray(), keys: [...keys], locked: G.locked, t: G.time, anim: hero.current });
    } catch (err) { out.push(`ERROR ${err.stack || err}`); }
    report();
  } else if (params.has('qa')) {
    const out = [];
    try {
      await startLevel(Number(params.get('level') || 1) - 1);
      const stopAt = params.has('stop') ? Number(params.get('stop')) : 99;
      // &hero=id: play as that hero (also in ?qa=play, so every hero's swing is tested)
      if (params.has('hero') && params.get('qa') !== 'portrait') { await Assets.loadHero(heroDef(params.get('hero'))); buildHero(params.get('hero')); }
      for (let i = 0; i < 9 && G.mode === 'play' && i < stopAt; i++) {
        out.push({ room: i, log: QA.playRoom(i === 0 || params.has('wrongall')), after: QA.info() });
      }
      if (params.has('keyin') && room.hide) QA.hideIn(Number(params.get('keyin')));
      if (params.get('qa') === 'portrait') { // a hero close up, for the menu portraits (assets/portraits/)
        await Assets.loadHero(heroDef(params.get('hero'))); buildHero(params.get('hero'));
        QA.teleport(0, 4, 0.35); run(20);
        camera.position.set(0.3, 2.3, 9.2); camera.lookAt(0, 1.45, 4); camBase.copy(camera.position);
        const pt = params.has('pt') ? Number(params.get('pt')) : heroDef(params.get('hero')).portraitT;
        if (pt != null) { // hold the swing clip at this time: the weapon shows beside the hero (heroes.js portraitT)
          const a = heroSwing.act; a.reset(); a.setEffectiveWeight(swingWeight(SWING.share)); a.play(); a.time = pt; a.paused = true;
          hero.mixer.update(0);
        }
        updateGear(); // weapons that face the camera: face this one
        window.__freeze = true;
      }
      if (params.get('qa') === 'pose') { // any room: &do=tp:x:z,run:n,… (see CLAUDE.md) — then freeze
        G.invuln = params.has('safe') ? 99 : 0; run(10);
        for (const cmd of (params.get('do') || '').split(',').filter(Boolean)) {
          const [c, a, b] = cmd.split(':');
          if (c === 'tp') QA.teleport(Number(a), Number(b), Math.PI);
          else if (c === 'run') run(Number(a));
          else if (c === 'face') hero.root.rotation.y = THREE.MathUtils.degToRad(Number(a)); // 0 = towards the camera
          else if (c === 'right' || c === 'wrong') QA.pick(c === 'right', a === 'hold');
          else if (c === 'goal') QA.doGoal();
          else if (c === 'find') QA.findKey();
          else if (c === 'search') QA.searchOne(Number(a));
          else if (c === 'bonkone') QA.bonkOne(skeletons[Number(a)]);
          else if (c === 'keyin') QA.hideIn(Number(a));
          else if (c === 'bonkall') QA.bonkAll();
          else if (c === 'ans') { if (a === 'wrong') QA.answerWrong(); else QA.answerRight(); }
          else if (c === 'stone') { for (let i = 0; i < 400 && !room.boss.stone; i++) run(1); QA.teleport(room.boss.stone.x, room.boss.stone.z, Math.PI); }
          else if (c === 'golem') { QA.teleport(golem.pos.x + 1.2, golem.pos.z + 2.2, Math.PI * 1.15); }
          else if (c === 'bonk') { G.attackT = 0; bonk(); }
          else if (c === 'menu') { showMenu(); }
          else if (c === 'coins') { Save.coins = Number(a); drawHud(); drawHeroes(); }
        }
        hero.setVisible(true);
        out.push({ pose: params.get('do'), info: QA.info() });
        window.__freeze = true;
      }
      if (params.get('qa') === 'card') { // a question card open: &gate=key|chest|boss|door
        // &step=2: the 2nd form is answered, the card asks the 3rd. &wrong=1: one mistake first.
        const gate = params.get('gate') || 'key';
        G.invuln = 99;
        if (gate === 'key') {
          if (room.type === 'ambush') { QA.teleport(0, 1); run(150); }
          QA.findKey(); QA.teleport(key.to.x, key.to.z + 0.5, Math.PI); run(2);
        } else if (gate === 'chest') {
          QA.teleport(room.chest.x - 1.2, room.chest.z + 1.2, Math.PI * 0.75); run(2);
        } else if (gate === 'boss') {
          for (let i = 0; i < 400 && !(room.boss.stone && G.card); i++) { run(1); if (room.boss.stone) QA.teleport(room.boss.stone.x, room.boss.stone.z, Math.PI); }
        } else if (gate === 'door') { QA.teleport(0, -5.4, Math.PI); run(2); }
        if (params.get('step') === '2') QA.answerRight();
        if (params.has('wrong')) QA.answerWrong();
        G.invuln = 0; hero.setVisible(true);
        out.push({ card: G.card && `${G.card.gate}:${cardQ(G.card).base}:${cardQ(G.card).ask}`, info: QA.info() });
        window.__freeze = true;
      }
      if (params.get('qa') === 'key') { // key hunt poses: &pose=nothing | pop | floor | taken | open (&n= frames)
        const pose = params.get('pose') || 'floor', h = room.hide, n = Number(params.get('n') || 0);
        G.invuln = 99; hero.setVisible(true);
        if (room.type === 'ambush') { QA.teleport(0, 1); run(150); }
        const count = h.where === 'search' ? room.search.length : skeletons.length;
        const tryOne = (i) => (h.where === 'search' ? QA.searchOne(i) : QA.bonkOne(skeletons[i]));
        const tryFast = (i) => { // swing and stop after n frames
          if (h.where === 'search') QA.besideProp(i);
          else { const sk = skeletons[i]; for (const s of skeletons) s.pause = 9; QA.teleport(sk.pos.x + 0.8, sk.pos.z + 1.3, Math.PI * 1.15); }
          G.attackT = 0; bonk(); run(n);
        };
        if (pose === 'nothing') { QA.hideIn(count - 1); tryFast(0); }
        else {
          QA.hideIn(Number(params.get('keyin') || 0));
          if (pose === 'pop') tryFast(h.keyIn);
          else {
            tryOne(h.keyIn); run(30);
            if (pose === 'taken' || pose === 'open') { QA.teleport(key.to.x, key.to.z + 0.5); run(2); QA.answerCard(); run(5); }
            if (pose === 'floor') QA.teleport(key.to.x + 1.6, key.to.z + 1.6, Math.PI * 1.2);
            if (pose === 'open') { QA.teleport(0.6, -4.2, Math.PI); run(n || 10); }
          }
        }
        hero.setVisible(true);
        out.push({ pose, info: QA.info(), key: key.to.toArray().map((v) => +v.toFixed(1)) });
        window.__freeze = true;
      }
      if (params.get('qa') === 'swing') { // swing, then hold the pose for a screenshot
        // &n=K frames after the key press (&fps=60 for finer steps), &stand=1 no running,
        // &face=deg hero direction (0 = towards the camera), &skel=1 a skeleton in reach.
        const fps = Number(params.get('fps') || 30), n = Number(params.get('n') || 4);
        const stand = params.has('stand'), face = THREE.MathUtils.degToRad(Number(params.get('face') || 135));
        G.invuln = 0; hero.setVisible(true);
        for (const s of skeletons) s.pos.set(8, 0, -6);
        QA.teleport(1.5, 4.5, face);
        if (!stand) { // run in the facing direction
          if (Math.sin(face) > 0.3) keys.add('KeyD'); if (Math.sin(face) < -0.3) keys.add('KeyA');
          if (Math.cos(face) > 0.3) keys.add('KeyS'); if (Math.cos(face) < -0.3) keys.add('KeyW');
        }
        run(10);
        if (params.has('skel') && skeletons[0]) {
          const a = hero.root.rotation.y;
          skeletons[0].pos.set(hero.pos.x + Math.sin(a) * 1.9, 0, hero.pos.z + Math.cos(a) * 1.9);
          skeletons[0].pause = 9;
        }
        const t0 = hero.pos.toArray(), time0 = G.time; bonk();
        let hitAt = null;
        for (let i = 0; i < n; i++) { step(1 / fps); if (hitAt === null && G.hitDone) hitAt = +((i + 1) / fps).toFixed(3); }
        out.push({ tag: params.get('tag'), hero: heroDef(params.get('hero')).id, swing: heroSwing.key,
          moved: +(Math.hypot(hero.pos.x - t0[0], hero.pos.z - t0[2])).toFixed(2), base: hero.current,
          clipT: +heroSwing.act.time.toFixed(3), w: +heroSwing.act.getEffectiveWeight().toFixed(1),
          attackT: +G.attackT.toFixed(2), hitAt, swoosh: trails.map((tr) => `${tr.state}:${tr.head.toFixed(2)}:${tr.len.toFixed(2)}`).join(' '),
          skel: skeletons.map((s) => [s.mode, s.root.visible, s.root.parent === scene, ...s.pos.toArray().map((v) => +v.toFixed(1)), ...s.root.scale.toArray()]), pos: hero.pos.toArray().map((v) => +v.toFixed(1)), fl: [hitFlash.visible, hitFlash.material.opacity, hitFlash.scale.x], dt: +(G.time - time0).toFixed(3) });
        window.__freeze = true;
      }
      if (params.get('qa') === 'hurt') { // stand still among angry skeletons until dizzy, then wait
        // &pre=floor: the key lies on the floor first (found in the first hiding place);
        // &pre=taken: key found and its pair answered; &pre=boss: one boss round won.
        // All must survive the restart (a key room needs 2+ skeletons).
        const pre = params.get('pre');
        if (room.type === 'ambush') { G.invuln = 99; QA.teleport(0, 1); run(150); } // spring the trap first
        if (pre === 'boss') { // one round won (answer + bonk), then get hurt: the golem must keep 2 skulls
          G.invuln = 99; const b = room.boss;
          for (let i = 0; i < 400 && !b.stone; i++) run(1);
          QA.teleport(b.stone.x, b.stone.z); run(2); QA.answerRight(); run(3);
          QA.teleport(golem.pos.x, golem.pos.z + 2.4, Math.PI); G.attackT = 0; bonk(); run(50);
        } else if (pre) { G.invuln = 99; QA.hideIn(0); QA.findKey(); run(30); }
        if (pre === 'taken') { QA.teleport(key.to.x, key.to.z + 0.5); run(2); QA.answerCard(); run(3); }
        out.push({ before: QA.info() });
        G.invuln = 0; hero.setVisible(true);
        for (let i = 0; i < 12 && G.hearts > 0; i++) {
          const sk = skeletons.find((x) => x.mode === 'patrol') || golem;
          if (!sk) { out.push('no angry skeleton left'); break; }
          QA.teleport(sk.pos.x, sk.pos.z + 1); run(60); out.push(`hearts ${G.hearts}`);
        }
        out.push({ dizzy: QA.info() }); run(90); out.push({ restarted: QA.info() });
      }
    } catch (err) { out.push(`ERROR ${err.stack || err}`); }
    $('qa').textContent = JSON.stringify(out);
    // Local test runs read the result from the dev server's request log.
    if (['localhost', '127.0.0.1'].includes(location.hostname)) fetch(`qa-report?${encodeURIComponent(JSON.stringify(out))}`).catch(() => {});
  }
}).catch((err) => {
  console.error(err);
  $('loading').textContent = `Could not load the game:\n${err.message}`;
});
