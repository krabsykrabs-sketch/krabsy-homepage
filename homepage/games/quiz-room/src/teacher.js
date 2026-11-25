// Teacher page: set up the quiz, open the room, run it, see the results.
// The teacher doesn't play. The screen may be on the projector, so the right answer
// is shown only at the reveal.
import { t, lang } from './i18n.js';
import { $, esc, LETTERS, questionHTML, teachHTML, reviewHTML, applyTexts, plainQuestion } from './ui.js';
import { Net, showCode } from './net.js';
import { Room, Controller, COLORS } from './room.js';
import * as QS from './questions.js';
import { sfx } from './audio.js';
import { analytics } from './analytics.js';
import { QuestionEditor } from './editor.js';
import qrcode from '../vendor/qrcode/qrcode.js';

document.documentElement.lang = lang();
document.title = `${t('title')} — ${t('setupTitle')}`;
applyTexts(t);

const cfg = { topic: QS.TOPICS.includes(new URLSearchParams(location.search).get('topic')) ? new URLSearchParams(location.search).get('topic') : 'irregular_verbs',
  levels: [1, 2], count: 10, time: 20, bonus: 3, host: '' };
const S = { code: '', phase: 'setup', players: [], answered: new Set(), q: null, qi: -1, n: 0, time: 20,
  deadline: 0, reveal: null, end: null, locked: false, questions: [], t0: 0 };

// ------------------------------------------------------------------ setup
function optRow(id, items, isOn, onClick) {
  const box = $(id); box.innerHTML = '';
  for (const it of items) {
    const b = document.createElement('button');
    b.className = 'opt' + (isOn(it.v) ? ' on' : '');
    b.innerHTML = it.html;
    b.addEventListener('click', () => { onClick(it.v); renderSetup(); settingsChanged(); });
    box.appendChild(b);
  }
}
function renderSetup() {
  optRow('optTopic', QS.TOPICS.map((v) => ({ v, html: esc(t('topic_' + v)) })), (v) => cfg.topic === v, (v) => { cfg.topic = v; });
  optRow('optDiff', [1, 2, 3].map((v) => ({ v, html: esc(t('diff_' + cfg.topic)[v - 1]) })), (v) => cfg.levels.includes(v), (v) => {
    const on = cfg.levels.includes(v);
    if (on && cfg.levels.length > 1) cfg.levels = cfg.levels.filter((x) => x !== v);
    else if (!on) cfg.levels = [...cfg.levels, v].sort();
  });
  optRow('optCount', [10, 15, 20, 30].map((v) => ({ v, html: String(v) })), (v) => cfg.count === v, (v) => { cfg.count = v; });
  optRow('optTime', [15, 20, 30].map((v) => ({ v, html: `${v} s` })), (v) => cfg.time === v, (v) => { cfg.time = v; });
  optRow('optBonus', [0, 3, 5].map((v) => ({ v, html: v ? String(v) : esc(t('bonusOff')) })), (v) => cfg.bonus === v, (v) => { cfg.bonus = v; });
}
renderSetup();
// The teacher's name in the room, remembered on this device.
try { $('hostIn').value = localStorage.getItem('krabsy_quiz_host') || ''; } catch (_) {}
$('hostIn').placeholder = t('hostPh');
$('hostIn').addEventListener('change', () => { try { localStorage.setItem('krabsy_quiz_host', $('hostIn').value.trim()); } catch (_) {} });

// ------------------------------------------------------------------ question list
const editor = new QuestionEditor($('editor'), { onChange: (n) => { $('openBtn').disabled = n < 1; } });
editor.onMix = () => editor.load(cfg.topic, cfg.levels, cfg.count, { fresh: true });
let editMode = false;   // false: before the room opens; true: editing in the lobby
function settingsChanged() { editor.bonusCount = cfg.bonus; editor.load(cfg.topic, cfg.levels, cfg.count); }

function setEditMode(on) {
  editMode = on;
  $('timeRow').classList.toggle('hidden', on);
  $('hostRow').classList.toggle('hidden', on);
  $('hintA').classList.toggle('hidden', !on);
  $('cancelBtn').classList.toggle('hidden', !on);
  $('openBtn').textContent = on ? t('save') : t('open');
  $('openBtn').disabled = editor.count < 1;
  $('setupErr').textContent = '';
}

$('editBtn').addEventListener('click', async () => {
  setEditMode(true);
  editor.showAnswers = false;                 // the projector may be on
  if (!editor.units.length && S.questions.length) editor.setQuestions(S.questions);
  else editor.render();
  $('setup').classList.remove('hidden');
  if (!editor.pool.length) editor.loadPool(cfg.topic, cfg.levels).catch(() => {});
});
$('cancelBtn').addEventListener('click', () => {
  editor.setQuestions(S.questions);
  $('setup').classList.add('hidden');
});

// ------------------------------------------------------------------ room view
const room = new Room($('c'), { mode: 'teacher' });
const roomReady = room.load().catch((e) => console.error('room load failed', e));
// The teacher's own figure (the wizard): walks with WASD / arrows like the children.
const ctl = new Controller(room);
let last = performance.now(), sendT = 0, lastSent = '';
function frame(now) {
  const dt = Math.max(0, Math.min(0.1, (now - last) / 1000)); last = now;  // rAF time can be older than "last" on the first frame
  ctl.enabled = !!room.me && S.phase !== 'setup' && !editMode;
  if (room.me) {
    ctl.update(dt);
    sendT += dt;
    if (sendT >= 0.1) {
      const st = ctl.state(), key = st && JSON.stringify(st);
      if (st && (key !== lastSent || sendT >= 2)) { net.send({ t: 'move', ...st }); lastSent = key; sendT = 0; }
      else if (sendT >= 2) sendT = 0;
    }
  }
  room.update(dt);
  tickTimer();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

const net = new Net();
let connected = false;
async function ensureNet() { if (!connected) { await net.connect(); connected = true; } }

$('openBtn').addEventListener('click', async () => {
  sfx.init();
  const questions = editor.questions;
  const bonus = editor.bonusQuestions;
  if (editMode) { net.send({ t: 'questions', questions, bonus }); return; }
  $('openBtn').disabled = true; $('openBtn').textContent = t('opening'); $('setupErr').textContent = '';
  try {
    if (!questions.length) throw new Error('noQuestions');
    await ensureNet();
    cfg.host = $('hostIn').value.trim();
    net.send({ t: 'create', questions, bonus, time: cfg.time, lang: lang(), host: cfg.host });
  } catch (e) {
    $('setupErr').textContent = e.message === 'noQuestions' ? t('noQuestions') : t('err_net');
    $('openBtn').disabled = false; $('openBtn').textContent = t('open');
  }
});

// A reload of the teacher page comes back into the room.
let saved = null;
try { saved = JSON.parse(sessionStorage.getItem('krabsy_quiz_teacher') || 'null'); } catch (_) {}
if (saved) {
  if (saved.cfg) { Object.assign(cfg, saved.cfg); renderSetup(); }
  ensureNet().then(() => net.enter({ t: 'resume', code: saved.code, token: saved.token })).catch(() => {});
} else settingsChanged();

net.on('created', (m) => {
  try { sessionStorage.setItem('krabsy_quiz_teacher', JSON.stringify({ code: m.code, token: m.token, cfg })); } catch (_) {}
  net.hello = { t: 'resume', code: m.code, token: m.token };
  enterRoom(m);
  analytics.event('quiz_open', { level: 1, questions: m.n, topic: cfg.topic, time: m.time });
});
net.on('resumed', (m) => enterRoom(m));
net.on('questions_set', (m) => {
  S.questions = m.questions; S.n = m.n;
  editor.setQuestions(m.questions);
  $('setup').classList.add('hidden');
  setEditMode(false);
  render();
});
net.on('error', (m) => {
  if (m.code === 'no_room' && S.phase === 'setup') {
    try { sessionStorage.removeItem('krabsy_quiz_teacher'); } catch (_) {}
    net.hello = null;
    settingsChanged();
  } else if (S.phase === 'setup' || editMode) {
    $('setupErr').textContent = m.code;
  }
  $('openBtn').disabled = false; $('openBtn').textContent = t('open');
});

// The join link as a QR code (SVG, black on white with a quiet zone, scannable from a
// projector). Error correction M; the version grows with the link length.
function qrSvg(text) {
  try {
    const q = qrcode(0, 'M'); q.addData(text); q.make();
    const n = q.getModuleCount(), b = 2, size = n + b * 2;
    let d = '';
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.isDark(y, x)) d += `M${x + b} ${y + b}h1v1h-1z`;
    return `<svg viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" role="img" aria-label="QR"><rect width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
  } catch (_) { return ''; }
}

async function enterRoom(m) {
  await roomReady;
  S.middle = !!m.middle;
  S.code = m.code; S.n = m.n; S.time = m.time; S.locked = m.locked; S.questions = m.questions || [];
  S.players = m.players; S.phase = m.phase; S.qi = m.qi;
  room.setSize(m.size);
  room.setHost(m.host, t('hostDefault'));
  $('hostHint').classList.remove('hidden');
  room.syncPlayers(m.players, null);
  $('setup').classList.add('hidden');
  for (const id of ['top', 'players', 'controls']) $(id).classList.remove('hidden');
  $('code').textContent = showCode(m.code);
  // On krabsy.com the children's link is the short path /quiz/ (it forwards to the child
  // page with the same parameters); the room's language travels along.
  const onSite = /(^|\.)krabsy\.com$/.test(location.hostname);
  const url = onSite ? new URL('/quiz/', location.origin) : new URL('index.html', location.href);
  url.search = `?code=${m.code}&lang=${lang()}`;
  $('joinUrl').textContent = onSite ? `${location.host}/quiz` : url.href.replace(/^https?:\/\//, '');
  $('qr').innerHTML = qrSvg(url.href);
  if (m.question) onQuestion(m.question);
  if (m.reveal) onReveal(m.reveal);
  if (m.end) onEnd(m.end);
  render();
}

net.on('players', (m) => {
  if (m.list.length > S.players.length && S.phase === 'lobby') autoEmote(0);   // a child arrived: wave
  S.players = m.list; S.locked = m.locked; room.syncPlayers(m.list, null); render();
});
net.on('host', (m) => room.setHost(m, t('hostDefault')));
net.on('size', (m) => room.setSize(m.s));   // the room grows with the group
net.on('pos', (m) => room.applyPositions(m.s));
net.on('answered', (m) => { S.answered.add(m.pid); sfx.locked(); render(); });
net.on('question', onQuestion);
net.on('reveal', onReveal);
net.on('end', onEnd);
// The play area as the children see it (the teacher doesn't play).
room.play.onSound = () => {};
net.on('ball', (m) => room.play.applyBall(m.b, m.p, m.v));
net.on('boom', () => { room.play.burst(); });
net.on('emote', (m) => { if (m.pid !== 0) room.avatarOf(m.pid)?.emote(m.e); });   // own ones play at once
// The teacher's figure: emotes by key (1–4) and a few by itself (wave, cheer, dance).
function autoEmote(e) {
  const h = room.host;
  if (!h || h.emoteT > 0 || ctl.anim > 0) return;
  h.emote(e); net.send({ t: 'emote', e });
}
net.on('middle', (m) => { S.middle = m.on; render(); });
$('midBtn').addEventListener('click', () => net.send({ t: 'middle', on: !S.middle }));

net.on('closed', () => { showMsg(t('closed')); try { sessionStorage.removeItem('krabsy_quiz_teacher'); } catch (_) {} });

function onQuestion(m) {
  S.middle = false;
  if (S.qi !== m.qi) room.play.reset();
  if (S.phase === 'lobby') { S.t0 = performance.now(); analytics.event('level_start', { level: 1, players: S.players.length, questions: m.n, topic: cfg.topic }); }
  S.phase = 'question'; S.qi = m.qi; S.n = m.n; S.q = m.q; S.time = m.time;
  S.deadline = performance.now() + m.ends_in; S.answered = new Set(m.answered || []); S.reveal = null;
  S.dur = Math.max(m.ends_in, S.time * 1000);
  const wasBonus = !!S.bonus;
  S.bonus = m.bonus || null; S.pads = [0, 0, 0, 0];
  if (S.bonus) {
    room.play.setPads(m.q.options);
    room.setScreen({ title: t('bonusTitle', S.bonus.i + 1, S.bonus.n), line: plainQuestion(m.q) });
    if (!wasBonus) sfx.jingle();
  } else if (wasBonus || room.play.padWords) { room.play.setPads(null); room.setScreen(null); }
  sfx.whoosh();
  render();
}
net.on('pads', (m) => { S.pads = m.counts; render(); });

function onReveal(m) {
  S.phase = 'reveal'; S.reveal = m;
  if (S.bonus) room.play.sinkPads(m.correct);
  sfx.drumroll(0.6); setTimeout(() => sfx.right(), 600);
  setTimeout(() => autoEmote(2), 700);                 // cheer
  render();
}
function onEnd(m) {
  S.phase = 'end'; S.end = m;
  if (room.play.padsOn) { room.play.setPads(null); room.setScreen(null); }   // the answer pads go away
  if (m.answers != null) {
    analytics.event('level_end', { level: 1, result: 'won', seconds: Math.round((performance.now() - S.t0) / 1000),
      answers: m.answers, correct: m.right, players: m.ranking.length });
  }
  sfx.applause(3); sfx.jingle();
  autoEmote(1);                                        // dance
  render();
}
function showMsg(text) { $('msgCard').textContent = text; $('msg').classList.remove('hidden'); }

// ------------------------------------------------------------------ controls
$('mainBtn').addEventListener('click', () => { sfx.init(); net.send({ t: 'next' }); });
$('lockBtn').addEventListener('click', () => net.send({ t: 'lock', on: !S.locked }));
$('endBtn').addEventListener('click', () => net.send({ t: 'end' }));
window.addEventListener('keydown', (e) => {
  if (S.phase === 'setup' || e.target.tagName === 'INPUT') return;
  if (e.key === 'Enter') { e.preventDefault(); if (S.phase !== 'end') net.send({ t: 'next' }); }
  const k = ['1', '2', '3', '4'].indexOf(e.key);
  if (k >= 0 && room.host && !editMode) { room.host.emote(k); net.send({ t: 'emote', e: k }); }
});

// ------------------------------------------------------------------ render
function topHTML(top) {
  return '<div class="toplist">' + top.map((p, i) =>
    `<div><span class="n">${i + 1}.</span><i style="background:${COLORS[(p.color ?? 0) % COLORS.length]}"></i><span class="nm">${esc(p.name)}</span><span>${p.score}</span></div>`).join('') + '</div>';
}

function render() {
  const ph = S.phase;
  const online = S.players.filter((p) => p.online);
  $('count').textContent = online.length ? t('inRoom', online.length) : t('waitingPlayers');

  // player list
  const pl = $('players');
  pl.innerHTML = `<h3>${esc(t('inRoom', online.length))}</h3>`;
  for (const p of S.players) {
    const d = document.createElement('div');
    d.className = 'pl' + (p.online ? '' : ' off');
    const ans = ph === 'question' && S.answered.has(p.pid);
    d.innerHTML = `<i style="background:${COLORS[p.color % COLORS.length]}"></i><span class="nm">${esc(p.name)}</span>${ans ? '<span class="ans"></span>' : ''}
      <button data-a="rename">✎</button><button data-a="remove">✕</button>`;
    d.querySelector('[data-a=rename]').title = t('rename');
    d.querySelector('[data-a=remove]').title = t('remove');
    d.querySelector('[data-a=rename]').addEventListener('click', () => {
      const name = prompt(t('renameTo'), p.name);
      if (name) net.send({ t: 'rename', pid: p.pid, name });
    });
    d.querySelector('[data-a=remove]').addEventListener('click', () => {
      if (confirm(`${t('remove')}: ${p.name}?`)) net.send({ t: 'remove', pid: p.pid });
    });
    pl.appendChild(d);
  }

  room.setMarks((pid) => (ph !== 'question' || S.bonus ? null : S.answered.has(pid) ? 'dot' : 'think'));

  // main button
  const mb = $('mainBtn');
  mb.textContent = ph === 'lobby' ? t('start') : ph === 'question' ? t('reveal') : t('next');
  mb.disabled = ph === 'lobby' && !online.length;
  $('controls').classList.toggle('hidden', ph === 'end' || ph === 'setup');
  $('lockBtn').textContent = S.locked ? t('unlock') : t('lock');
  $('editBtn').classList.toggle('hidden', ph !== 'lobby');
  $('midBtn').textContent = S.middle ? t('middleOff') : t('middle');
  $('midBtn').classList.toggle('hidden', ph === 'question');

  // question / reveal panel
  const qp = $('qpanel');
  qp.classList.toggle('hidden', !(ph === 'question' || ph === 'reveal') || !S.q);
  if ((ph === 'question' || ph === 'reveal') && S.q) {
    const rv = ph === 'reveal' ? S.reveal : null;
    const asked = rv ? rv.asked : online.length;
    const answered = rv ? rv.answered : S.answered.size;
    // Bonus round: live counts of children on each pad, while the time runs.
    const counts = rv ? rv.counts : S.bonus ? S.pads : null;
    const total = counts ? Math.max(1, counts.reduce((a, b) => a + b, 0)) : 1;
    const title = S.bonus ? `★ ${t('bonusTitle', S.bonus.i + 1, S.bonus.n)}` : t('question', S.qi + 1, S.n);
    const status = S.bonus && !rv ? t('onPads', S.pads.reduce((a, b) => a + b, 0)) : t('answeredOf', answered, asked);
    $('qcardT').innerHTML = `<div class="head"><span>${esc(title)}</span>
        ${rv ? '' : '<div class="timerbar" id="tTimer"><i></i></div>'}
        <span class="answered">${esc(status)}</span></div>
      <div class="qline">${questionHTML(S.q, rv ? S.q.options[S.q.correct] : null)}</div>
      <div class="boxes" style="margin-top:12px">${S.q.options.map((o, k) => `<div class="box ${rv ? (k === S.q.correct ? 'right' : 'dim') : ''}">
        <span class="k">${LETTERS[k]}</span><span class="w">${esc(o)}</span>${counts ? `<span class="cnt">${counts[k]}</span><span class="bar" style="width:${counts[k] / total * 100}%"></span>` : ''}</div>`).join('')}</div>
      ${rv && teachHTML(S.q, S.q.teach) ? `<div class="teach">${teachHTML(S.q, S.q.teach)}</div>` : ''}`;
  }
  $('tTop5').classList.toggle('hidden', ph !== 'reveal' || !S.reveal);
  if (ph === 'reveal' && S.reveal) $('tTop5').innerHTML = `<h3>${esc(t('top5'))}</h3>${topHTML(S.reveal.top)}`;

  // results
  $('endT').classList.toggle('hidden', ph !== 'end' || !S.end);
  if (ph === 'end' && S.end) {
    const e = S.end;
    const pct = e.answers ? Math.round(100 * e.right / e.answers) : 0;
    $('endCardT').innerHTML = `<h2>${esc(t('results'))}</h2>
      <div class="cols"><div><h3>${esc(t('ranking'))}</h3>${topHTML(e.ranking.map((r) => ({ ...r, color: S.players.find((p) => p.pid === r.pid)?.color ?? 0 })))}</div>
      <div><h3>${esc(t('review'))}</h3>${e.review.length ? `<div class="review">${e.review.map((r) => `<div><span>${reviewHTML(r.q)}</span><small>${esc(t('missed', r.n))}</small></div>`).join('')}</div>` : `<p>${esc(t('reviewNone'))}</p>`}</div></div>
      <div class="stat">${esc(t('classRight', pct))}</div>
      <div class="btns"><button class="btn" id="newBtn">${esc(t('newQuiz'))}</button></div>`;
    $('newBtn').addEventListener('click', () => {
      net.send({ t: 'close' });
      try { sessionStorage.removeItem('krabsy_quiz_teacher'); } catch (_) {}
      location.reload();
    });
  }
}

function tickTimer() {
  if (S.phase !== 'question') return;
  const el = document.getElementById('tTimer');
  if (!el) return;
  const left = Math.max(0, S.deadline - performance.now());
  el.querySelector('i').style.width = `${left / (S.dur || S.time * 1000) * 100}%`;
  el.classList.toggle('low', left < 5000);
}

window.__qt = { S, room, net, analytics, editor }; // QA hook
