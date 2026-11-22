// Child page: join a room, walk around as an avatar, answer on a private card.
import { t, lang } from './i18n.js';
import { $, esc, LETTERS, questionHTML, teachHTML, applyTexts } from './ui.js';
import { Net, normCode, showCode } from './net.js';
import { Room, Controller, COLORS, AVATARS, EMOTES } from './room.js';
import { middleSpot } from './play.js';
import { sfx } from './audio.js';
import { analytics } from './analytics.js';

document.documentElement.lang = lang();
document.title = t('title');
applyTexts(t);

const params = new URLSearchParams(location.search);
const S = {
  pid: null, name: '', color: Math.floor(Math.random() * COLORS.length),
  avatar: Math.floor(Math.random() * AVATARS.length),
  phase: 'lobby', players: [], answered: new Set(), q: null, qi: -1, n: 0,
  deadline: 0, time: 20, mine: null, score: 0, code: '', middle: false,
};

// ------------------------------------------------------------------ join form
$('codeIn').value = showCode(normCode(params.get('code') || ''));
try { $('nameIn').value = sessionStorage.getItem('krabsy_quiz_name') || ''; } catch (_) {}
function renderColors() {
  const box = $('colors'); box.innerHTML = '';
  COLORS.forEach((c, i) => {
    const b = document.createElement('button');
    b.style.background = c; b.className = i === S.color ? 'on' : '';
    b.addEventListener('click', () => { S.color = i; renderColors(); });
    box.appendChild(b);
  });
}
renderColors();
try { const a = +sessionStorage.getItem('krabsy_quiz_avatar'); if (sessionStorage.getItem('krabsy_quiz_avatar') != null && a >= 0 && a < AVATARS.length) S.avatar = a; } catch (_) {}
function renderAvatars() {
  const box = $('avatars'); box.innerHTML = '';
  AVATARS.forEach((name, i) => {
    const b = document.createElement('button');
    b.className = i === S.avatar ? 'on' : '';
    b.innerHTML = `<img src="assets/thumbs/${name}.png" alt="">`;
    b.addEventListener('click', () => { S.avatar = i; renderAvatars(); });
    box.appendChild(b);
  });
}
renderAvatars();
$('codeIn').addEventListener('input', (e) => { e.target.value = showCode(normCode(e.target.value)); });
for (const id of ['codeIn', 'nameIn']) $(id).addEventListener('keydown', (e) => { if (e.key === 'Enter') join(); });
$('joinBtn').addEventListener('click', join);

// ------------------------------------------------------------------ room
const room = new Room($('c'), { mode: 'child' });
const ctl = new Controller(room);
const roomReady = room.load().catch((e) => console.error('room load failed', e));
let last = performance.now(), sendT = 0, lastSent = '';
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  ctl.enabled = !(S.phase === 'question' && S.mine == null) && S.pid != null && !S.middle;
  room.frozen = !ctl.enabled;
  ctl.update(dt);
  room.update(dt);
  // Own position to the server ~10× per second, only when it changed (plus a heartbeat).
  sendT += dt;
  if (S.pid != null && sendT >= 0.1) {
    const st = ctl.state();
    const key = st && JSON.stringify(st);
    if (st && (key !== lastSent || sendT >= 2)) { net.send({ t: 'move', ...st }); lastSent = key; sendT = 0; }
    else if (sendT >= 2) sendT = 0;
  }
  tickTimer();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ------------------------------------------------------------------ network
const net = new Net();
let connected = false;

async function join() {
  sfx.init();
  const code = normCode($('codeIn').value), name = $('nameIn').value.trim();
  if (code.length !== 6) { $('joinErr').textContent = t('err_no_room'); return; }
  if (!name) { $('joinErr').textContent = t('err_bad_name'); return; }
  $('joinErr').textContent = ''; $('joinBtn').disabled = true; $('joinBtn').textContent = t('joining');
  try { sessionStorage.setItem('krabsy_quiz_name', name); sessionStorage.setItem('krabsy_quiz_avatar', S.avatar); } catch (_) {}
  S.code = code;
  let token = null;
  try { token = sessionStorage.getItem(`krabsy_quiz_${code}`); } catch (_) {}
  try {
    if (!connected) { await net.connect(); connected = true; }
    net.enter({ t: 'join', code, name, avatar: S.avatar, color: S.color, token });
  } catch (_) {
    $('joinErr').textContent = t('err_net');
    $('joinBtn').disabled = false; $('joinBtn').textContent = t('join');
  }
}

net.on('error', (m) => {
  if (S.pid == null) {
    $('joinErr').textContent = t('err_' + m.code) || m.code;
    $('joinBtn').disabled = false; $('joinBtn').textContent = t('join');
    if (m.code === 'removed' || m.code === 'no_room') { try { sessionStorage.removeItem(`krabsy_quiz_${S.code}`); } catch (_) {} }
    net.hello = null;
  }
});

net.on('joined', async (m) => {
  await roomReady;
  S.pid = m.pid; S.name = m.name; S.score = m.you.score; S.color = m.you.color;
  // The join message stays the "hello" for reconnects, now with the token.
  net.hello = { t: 'join', code: S.code, token: m.token, name: m.name, avatar: m.you.avatar, color: m.you.color };
  try { sessionStorage.setItem(`krabsy_quiz_${S.code}`, m.token); } catch (_) {}
  $('join').classList.add('hidden'); $('hud').classList.remove('hidden');
  $('meName').textContent = m.name; $('meDot').style.background = COLORS[m.you.color];
  S.players = m.players; S.n = m.n; S.time = m.time;
  room.syncPlayers(m.players, m.pid);
  setPhase(m.phase);
  setMiddle(!!m.middle, false);
  if (m.question) onQuestion(m.question);
  if (m.reveal) onReveal(m.reveal);
  if (m.end) onEnd(m.end);
  render();
});

net.on('players', (m) => { S.players = m.list; room.syncPlayers(m.list, S.pid); render(); });
net.on('pos', (m) => room.applyPositions(m.s));
net.on('answered', (m) => { S.answered.add(m.pid); render(); });
net.on('question', onQuestion);
net.on('reveal', onReveal);
net.on('end', onEnd);
net.on('renamed', (m) => { S.name = m.name; $('meName').textContent = m.name; });
net.on('kicked', () => { net.close(); showMsg(t('kicked')); try { sessionStorage.removeItem(`krabsy_quiz_${S.code}`); } catch (_) {} });
net.on('closed', () => { net.close(); showMsg(t('closed')); });
// Play area: own kicks and the confetti button go to the server; others' arrive here.
room.play.onKick = (b, p, v) => net.send({ t: 'ball', b, p, v });
room.play.onBoom = () => net.send({ t: 'boom' });
room.play.onSound = (n) => sfx[n]?.();
net.on('ball', (m) => room.play.applyBall(m.b, m.p, m.v));
net.on('boom', () => { room.play.burst(); sfx.boom(); });
net.on('emote', (m) => { if (m.pid !== S.pid) room.avatars.get(m.pid)?.emote(m.e); });
net.on('middle', (m) => setMiddle(m.on, true));

function setMiddle(on, move) {
  S.middle = on;
  if (on && move) { ctl.teleport(middleSpot()); sfx.whoosh(); }
  $('midMsg').classList.toggle('hidden', !on);
}

function emote(e) {
  if (S.pid == null || (S.phase === 'question' && S.mine == null) || S.middle) return;
  const me = room.me;
  if (!me || (me.emoteT > 0)) return;
  me.emote(e); sfx.pop();
  net.send({ t: 'emote', e });
}
EMOTES.forEach((E, i) => {
  const b = document.createElement('button');
  b.innerHTML = `<small>${i + 1}</small>${E.icon}`;
  b.addEventListener('click', () => { emote(i); b.blur(); });
  $('emotes').appendChild(b);
});
$('emotes').title = t('emoteHint');

net.on('_status', (s) => {
  $('status').textContent = t('lost');
  $('status').classList.toggle('hidden', s !== 'lost' || S.pid == null);
});

function setPhase(p) { S.phase = p; }

function onQuestion(m) {
  if (S.qi !== m.qi) room.play.reset();
  setMiddle(false, false);
  setPhase('question');
  S.qi = m.qi; S.n = m.n; S.q = m.q; S.time = m.time;
  S.deadline = performance.now() + m.ends_in;
  S.answered = new Set(m.answered || []);
  S.mine = m.mine ?? (S.answered.has(S.pid) ? -1 : null);
  S.reveal = null;
  const boxes = $('qboxes'); boxes.innerHTML = '';
  m.q.options.forEach((o, k) => {
    const b = document.createElement('button');
    b.className = 'box';
    b.innerHTML = `<span class="k">${LETTERS[k]}</span><span class="w">${esc(o)}</span>`;
    b.addEventListener('click', () => answer(k));
    boxes.appendChild(b);
  });
  $('qnum').textContent = t('question', m.qi + 1, m.n);
  $('qline').innerHTML = questionHTML(m.q);
  $('miniLine').innerHTML = questionHTML(m.q);
  if (m.ends_in > 1000) sfx.whoosh();
  render();
}

function answer(k) {
  if (S.phase !== 'question' || S.mine != null) return;
  S.mine = k;
  net.send({ t: 'answer', qi: S.qi, opt: k });
  sfx.locked();
  render();
}

window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  // Keys 1–4 answer while the card is open; otherwise they are emotes.
  if (!(S.phase === 'question' && S.mine == null)) {
    const k = ['1', '2', '3', '4'].indexOf(e.key);
    if (k >= 0) emote(k);
    return;
  }
  const k = ['1', '2', '3', '4'].indexOf(e.key);
  const l = ['a', 'b', 'c', 'd'].indexOf(e.key.toLowerCase());
  if (k >= 0) answer(k); else if (l >= 0) answer(l);
});

function onReveal(m) {
  setPhase('reveal');
  S.reveal = m;
  if (m.you) {
    S.score = m.you.score;
    if (m.you.opt != null) analytics.attempt(m.you.right);
    if (m.you.right) sfx.right(); else sfx.wrong();
  }
  render();
}

function onEnd(m) {
  setPhase('end');
  S.end = m;
  if (m.you) S.score = m.you.score;
  sfx.applause(3); sfx.jingle();
  render();
}

function showMsg(text) {
  $('msgCard').textContent = text;
  $('msg').classList.remove('hidden');
}

// ------------------------------------------------------------------ render
function topHTML(top) {
  return '<div class="toplist">' + top.map((p, i) =>
    `<div class="${p.pid === S.pid ? 'me' : ''}"><span class="n">${i + 1}.</span><i style="background:${COLORS[p.color % COLORS.length]}"></i><span class="nm">${esc(p.name)}</span><span>${p.score}</span></div>`).join('') + '</div>';
}

function render() {
  const ph = S.phase, inRoom = S.pid != null;
  $('meScore').textContent = S.score;
  const open = ph === 'question' && S.mine == null && inRoom;
  $('qcard').classList.toggle('hidden', !open);
  $('mini').classList.toggle('hidden', !(ph === 'question' && S.mine != null));
  $('hint').classList.toggle('hidden', !(inRoom && ph === 'lobby'));
  $('emotes').classList.toggle('hidden', !inRoom || open);
  $('hint').textContent = t('lobby');

  // Marks over heads: during a question, a dot for "answered", a bubble for "thinking".
  room.setMarks((pid) => (ph !== 'question' ? null : S.answered.has(pid) || (pid === S.pid && S.mine != null) ? 'dot' : 'think'));

  const rv = $('reveal');
  rv.classList.toggle('hidden', ph !== 'reveal' || !S.reveal || !S.q);
  if (ph === 'reveal' && S.reveal && S.q) {
    const m = S.reveal, y = m.you || {};
    const head = y.opt == null ? `<h2 class="no">${esc(t('none'))}</h2>` : y.right ? `<h2 class="ok">${esc(t('right'))}</h2>` : `<h2 class="no">${esc(t('wrong'))}</h2>`;
    const teach = teachHTML(S.q, m.teach);
    rv.querySelector('.card').innerHTML = `${head}<div class="qline">${questionHTML(S.q, S.q.options[m.correct])}</div>
      ${teach ? `<div class="teach">${teach}</div>` : ''}
      <div class="meta">${y.right ? `<b>${esc(t('pts', y.pts))}</b>` : ''}<span>${esc(t('rank', y.rank, y.of))}</span>${y.streak >= 3 ? `<b>${esc(t('streak', y.streak))}</b>` : ''}</div>`;
  }
  const top = (ph === 'reveal' && S.reveal?.top) || null;
  $('top5').classList.toggle('hidden', !top);
  if (top) $('top5').innerHTML = `<h3>${esc(t('top5'))}</h3>${topHTML(top)}`;

  $('endc').classList.toggle('hidden', ph !== 'end' || !S.end);
  if (ph === 'end' && S.end) {
    const y = S.end.you || {};
    $('endCard').innerHTML = `<h2>${esc(t('endTitle'))}</h2><div class="you">${esc(t('youPlace', y.rank, y.of))} · ${esc(t('youRight', y.right, S.end.n))}</div>${topHTML(S.end.top)}`;
  }
}

function tickTimer() {
  if (S.phase !== 'question') return;
  const left = Math.max(0, S.deadline - performance.now());
  const frac = left / (S.time * 1000);
  for (const id of ['qtimer', 'miniTimer']) {
    const el = $(id);
    el.querySelector('i').style.width = `${frac * 100}%`;
    el.classList.toggle('low', left < 5000);
  }
  const sec = Math.ceil(left / 1000);
  if ($('qsec').textContent !== String(sec)) {
    $('qsec').textContent = sec;
    if (sec <= 5 && sec > 0 && S.mine == null) sfx.tick(sec === 1);
  }
}

window.__qr = { S, room, net, ctl }; // QA hook
