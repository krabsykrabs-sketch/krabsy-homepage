// Krabsy Duo: shell around the game. States boot → menu → loading →
// playing ⇄ paused → results, mirrored on <body data-state>; window.__duo for tests.
import { t, lang, setLang, applyStatic, topicLine } from './src/i18n.js';
import { createInput, isTouchDevice } from './src/input.js';
import { createGame } from './src/game.js';
import { currentTopic, makeQueue } from './src/questions.js';
import { figureChoices } from './src/figures.js';
import { LEVELS } from './src/levels.js';
import { isMuted, setMuted } from './src/sound.js';
import { fmtTime } from './src/game.js';

const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch (_) { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (_) { /* ignore */ } },
};
const K_P1 = 'krabsy_duo_hero', K_P2 = 'krabsy_duo_p2', K_SWAP = 'krabsy_duo_swap';

const touch = isTouchDevice();
const input = createInput();
input.bindTouch($('touch'));
let state = 'boot';
let game = null;
let topic = 'irregular_verbs';
let choices = null;
const pick = { p1: store.get(K_P1, 'mine'), p2: store.get(K_P2, 'Hiker'), swap: store.get(K_SWAP, '0') === '1' };

function setState(s) { state = s; document.body.dataset.state = s; }

// ── title screen ─────────────────────────────────────────────────────────────────────
function roleOf(pi) { return (pi === 0) !== pick.swap ? 'climber' : 'strong'; }
function optionsFor(pi) { return pi === 0 ? ['mine', ...choices.free] : choices.free; }

function renderPicker(pi) {
  const card = $(`pcard-${pi + 1}`);
  const id = pi === 0 ? pick.p1 : pick.p2;
  const char = id === 'mine' ? (choices.mine?.char || 'Protagonist_A') : id;
  card.querySelector('.pname').textContent = pi === 0 ? `${t('player', 1)} (${t('you')})` : t('player', 2);
  const img = card.querySelector('.portrait img');
  const initial = card.querySelector('.initial');
  const src = choices.portrait(char);
  if (src) {
    img.hidden = false; initial.textContent = '';
    img.onerror = () => { img.hidden = true; initial.textContent = char[0]; };
    img.src = src;
  } else { img.hidden = true; initial.textContent = String(pi + 1); }
  const fname = card.querySelector('.fname');
  fname.innerHTML = '';
  const n = document.createElement('span');
  n.textContent = id === 'mine' ? t('yourFigure') : choices.name(char, lang);
  fname.appendChild(n);
  if (id === 'mine' && choices.mine?.own) {
    const m = document.createElement('span'); m.className = 'mine'; m.textContent = t('thisIsYou'); fname.appendChild(m);
  }
  const role = roleOf(pi);
  card.querySelector('.rname').textContent = t('role.' + role);
  card.querySelector('.rdo').textContent = t('roleDo.' + role);
  card.querySelector('.keys').textContent = touch ? t('keysTouch') : t(pi === 0 ? 'keysP1' : 'keysP2');
}

function step(pi, d) {
  const list = optionsFor(pi);
  const cur = pi === 0 ? pick.p1 : pick.p2;
  let i = list.indexOf(cur); if (i < 0) i = 0;
  const next = list[(i + d + list.length) % list.length];
  if (pi === 0) { pick.p1 = next; store.set(K_P1, next); } else { pick.p2 = next; store.set(K_P2, next); }
  renderPicker(pi);
}

function renderMenu() {
  applyStatic();
  document.querySelectorAll('.lang-switch button').forEach((b) => b.classList.toggle('on', b.dataset.lang === lang));
  $('topic-line').textContent = topicLine(topic);
  // all levels and rooms open (owner, for testing): one row per level
  const pick = $('room-pick');
  pick.innerHTML = '';
  const head = document.createElement('div'); head.className = 'rp-head'; head.textContent = t('startRoom'); pick.appendChild(head);
  LEVELS.forEach((lv, li) => {
    const row = document.createElement('div'); row.className = 'rp-row';
    const lab = document.createElement('span'); lab.textContent = t('levelN', li + 1); row.appendChild(lab);
    lv.rooms.forEach((r, ri) => {
      const b = document.createElement('button'); b.type = 'button';
      b.dataset.level = li; b.dataset.room = ri;
      b.textContent = `${ri + 1} · ${t(r.name)}`;
      b.addEventListener('click', () => play(li, ri));
      row.appendChild(b);
    });
    pick.appendChild(row);
  });
  renderPicker(0); renderPicker(1);
  const link = $('figure-link');
  link.hidden = !choices.available;
  link.textContent = t('figureLink');
  link.href = t('figureUrl');
}

async function showMenu() {
  if (game) { game.dispose(); game = null; }
  $('hud').hidden = true; $('pause').hidden = true; $('results').hidden = true; $('banner').hidden = true;
  $('touch').hidden = true;
  renderMenu();
  $('menu').hidden = false;
  setState('menu');
  $('play-btn').focus();
}

// ── play ─────────────────────────────────────────────────────────────────────────────
let curLevel = 0;
async function play(level = 0, room = 0) {
  curLevel = level;
  if (state === 'loading') return;
  setState('loading');
  $('menu').hidden = true; $('results').hidden = true;
  $('loader').hidden = false;
  if (game) { game.dispose(); game = null; }
  try { await document.fonts?.load('20px "Fredoka One"'); } catch (_) { /* ignore */ }
  const [q1, q2] = await Promise.all([
    makeQueue({ topic, lang, smart: true, recorded: true }),
    makeQueue({ topic, lang, smart: false, recorded: false }),
  ]);
  const players = [
    { choice: pick.p1, role: roleOf(0), queue: q1, recorded: true, name: t('player', 1) },
    { choice: pick.p2, role: roleOf(1), queue: q2, recorded: false, name: t('player', 2) },
  ];
  game = await createGame($('game'), { input, players, touch, onEvent });
  $('loader').hidden = true;
  $('hud').hidden = false;
  $('touch').hidden = !touch;
  setState('playing');
  game.start(level, room);
  window.__duo.game = game.debug;
}

function onEvent(type, data) {
  if (type === 'done') showResults(data);
}

function showResults(s) {
  setState('results');
  $('hud').hidden = true; $('touch').hidden = true; $('banner').hidden = true;
  const mins = (s.seconds / 60).toFixed(1).replace('.0', '');
  $('sum-line').textContent = t('summary', s.answers, mins, s.pct);
  const ul = $('sum-players'); ul.innerHTML = '';
  for (const p of s.players) {
    const li = document.createElement('li');
    li.textContent = `${t('perPlayer', `${p.name} (${t('role.' + p.role)})`, p.answers, p.answers ? Math.round(100 * p.right / p.answers) : 0)}`;
    ul.appendChild(li);
  }
  const m = $('sum-missed'); m.innerHTML = '';
  const h = document.createElement('h3');
  h.textContent = s.missed.length ? t('practice') : t('nothingMissed');
  m.appendChild(h);
  if (s.missed.length) {
    const list = document.createElement('ul');
    for (const line of s.missed.slice(0, 8)) { const li = document.createElement('li'); li.textContent = line; list.appendChild(li); }
    m.appendChild(list);
  }
  // density log (docs/duo-games.md: "38 answers in 12 minutes, 81 % right")
  console.info(`[duo] ${s.answers} answers in ${(s.seconds / 60).toFixed(1)} minutes (${fmtTime(s.seconds)}), ${s.pct} % right, one every ${s.perAnswerSeconds.toFixed(1)} s`);
  $('next-level-btn').hidden = !s.hasNext;
  $('results').hidden = false;
  (s.hasNext ? $('next-level-btn') : $('again-btn')).focus();
}

function pause(on) {
  if (!game) return;
  if (on && state !== 'playing') return;
  if (!on && state !== 'paused') return;
  game.pause(on);
  $('pause').hidden = !on;
  setState(on ? 'paused' : 'playing');
  if (on) $('resume-btn').focus();
}

// ── wiring ───────────────────────────────────────────────────────────────────────────
document.querySelectorAll('.lang-switch button').forEach((b) => b.addEventListener('click', () => { setLang(b.dataset.lang); renderMenu(); }));
for (const pi of [0, 1]) {
  const card = $(`pcard-${pi + 1}`);
  card.querySelector('.prev').addEventListener('click', () => step(pi, -1));
  card.querySelector('.next').addEventListener('click', () => step(pi, 1));
}
$('swap-roles').addEventListener('click', () => { pick.swap = !pick.swap; store.set(K_SWAP, pick.swap ? '1' : '0'); renderPicker(0); renderPicker(1); });
$('play-btn').addEventListener('click', () => play(0, 0));
$('again-btn').addEventListener('click', () => play(curLevel, 0));
$('next-level-btn').addEventListener('click', () => play(curLevel + 1, 0));
$('results-menu-btn').addEventListener('click', showMenu);
$('menu-btn').addEventListener('click', showMenu);
$('resume-btn').addEventListener('click', () => pause(false));
$('restart-btn').addEventListener('click', () => { pause(false); game?.restartRoom(); });
$('pause-btn').addEventListener('click', () => pause(true));
const mute = $('mute-btn');
const showMute = () => mute.setAttribute('aria-pressed', isMuted() ? 'true' : 'false');
mute.addEventListener('click', () => { setMuted(!isMuted()); showMute(); });
showMute();
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') { if (state === 'playing') pause(true); else if (state === 'paused') pause(false); }
  if (e.code === 'KeyM' && (state === 'playing' || state === 'paused')) { setMuted(!isMuted()); showMute(); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'playing') pause(true); });

window.__duo = { state: () => state, play, menu: showMenu, game: null, input };

(async () => {
  applyStatic();
  $('loader').hidden = false;
  [topic, choices] = await Promise.all([currentTopic(), figureChoices()]);
  if (!choices.free.includes(pick.p2)) pick.p2 = choices.free[2] || choices.free[0];
  if (pick.p1 !== 'mine' && !choices.free.includes(pick.p1)) pick.p1 = 'mine';
  $('loader').hidden = true;
  const q = new URLSearchParams(location.search);
  const room = Math.max(0, (parseInt(q.get('room'), 10) || 1) - 1);     // ?room=2 → room 2
  const level = Math.max(0, (parseInt(q.get('level'), 10) || 1) - 1);  // ?level=2 → level 2
  if (q.get('autostart') === '1' || q.has('room') || q.has('level')) play(level, room);
  else showMenu();
})();
