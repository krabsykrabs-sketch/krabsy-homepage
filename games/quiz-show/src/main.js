// Krabsy Quiz Show — screens and glue. Show logic: show.js. Input: input.js.
// 3D backdrop: scene.js. Sounds: audio.js. Texts: i18n.js. Questions: questions.js.
import { t, lang } from './i18n.js';
import { Show, LENGTHS, POINTS } from './show.js';
import { Input, PICK_KEYS, BUZZ_KEYS } from './input.js';
import { Studio } from './scene.js';
import * as Q from './questions.js';
import { sfx } from './audio.js';
import { analytics } from './analytics.js';

const $ = (id) => document.getElementById(id);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const COLORS = ['#2ee6c0', '#ff8585', '#ffcf5e', '#b18cff'];
const LETTERS = ['A', 'B', 'C', 'D'];
const ARROW = '<span class="arrow">→</span>';

document.documentElement.lang = lang();
document.querySelectorAll('[data-t]').forEach((e) => { e.textContent = t(e.dataset.t); });
document.querySelectorAll('#langs a').forEach((a) => {
  a.classList.toggle('on', a.dataset.l === lang());
  a.addEventListener('click', () => { try { localStorage.setItem('krabsy_lang', a.dataset.l); } catch (_) {} });
});
document.title = t('title');

// ------------------------------------------------------------------ setup screen
const cfg = { topic: Q.TOPICS.includes(new URLSearchParams(location.search).get('topic')) ? new URLSearchParams(location.search).get('topic') : 'irregular_verbs',
  teams: 3, length: 'short', timer: true, names: t('teamNames').slice() };

function optRow(id, items, key) {
  const box = $(id); box.innerHTML = '';
  for (const it of items) {
    const b = el('button', 'opt' + (cfg[key] === it.v ? ' on' : ''), it.html);
    b.addEventListener('click', () => { cfg[key] = it.v; renderSetup(); });
    box.appendChild(b);
  }
}
function renderSetup() {
  optRow('optTopic', Q.TOPICS.map((v) => ({ v, html: esc(t('topic_' + v)) })), 'topic');
  optRow('optTeams', [2, 3, 4].map((v) => ({ v, html: String(v) })), 'teams');
  optRow('optLength', Object.entries(LENGTHS).map(([v, L]) => ({ v,
    html: `${esc(t('len_' + v))}<small>${esc(t('lenInfo', L.r1 + L.r2 + L.final, L.minutes))}</small>` })), 'length');
  optRow('optTimer', [{ v: true, html: esc(t('timerOn')) }, { v: false, html: esc(t('timerOff')) }], 'timer');
  const names = $('teamNames'); names.innerHTML = '';
  for (let i = 0; i < cfg.teams; i++) {
    const inp = el('input'); inp.type = 'text'; inp.maxLength = 14; inp.value = cfg.names[i];
    inp.style.setProperty('--c', COLORS[i]);
    inp.addEventListener('input', () => { cfg.names[i] = inp.value; });
    names.appendChild(inp);
  }
}
renderSetup();

// ------------------------------------------------------------------ 3D studio
const studio = new Studio($('c'));
const studioReady = studio.load().catch((e) => { console.error('studio load failed', e); });
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (show) show.tick(dt);
  studio.update(dt);
  placeLabels();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ------------------------------------------------------------------ the show
let show = null, input = null, labels = [], revealing = false;
const advance = () => { if (!revealing) show?.advance(); };

$('startBtn').addEventListener('click', async () => {
  sfx.init();
  $('startBtn').disabled = true;
  $('loading').classList.remove('hidden'); $('loading').textContent = '…';
  const L = LENGTHS[cfg.length];
  const [set] = await Promise.all([Q.loadShow(cfg.topic, L), studioReady]);
  const teams = cfg.names.slice(0, cfg.teams).map((n, i) => ({ name: (n || '').trim() || t('teamNames')[i], color: COLORS[i] }));
  if (input) input.detach();
  show = new Show({ teams, set, timer: cfg.timer, onChange: onShow });
  input = new Input(show, { onSelect: () => render(), onAdvance: advance });
  studio.setTeams(teams);
  studio.setLift(null);
  buildLabels();
  $('setup').classList.add('hidden');
  $('bar').classList.remove('hidden');
  $('startBtn').disabled = false; $('loading').classList.add('hidden');
  analytics.reset();
  window.__qs = { show, source: Q.source }; // QA hook
  sfx.jingle();
  show.start();
});

$('next').addEventListener('click', () => { sfx.init(); advance(); });
$('fsBtn').addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else document.documentElement.requestFullscreen?.().catch(() => {});
});
const soundLabel = () => { $('soundBtn').textContent = `${sfx.muted ? '🔇' : '🔊'} ${t('sound')}`; };
$('soundBtn').addEventListener('click', () => { sfx.init(); sfx.setMuted(!sfx.muted); soundLabel(); });
soundLabel();

function buildLabels() {
  const box = $('labels'); box.innerHTML = ''; labels = [];
  show.state.teams.forEach((tm, i) => {
    const d = el('div', 'tlabel');
    d.style.setProperty('--c', tm.color);
    d.innerHTML = `<div class="st"></div><div class="plate"><span class="name">${esc(tm.name)}</span><span class="score">0</span></div><span class="keys"></span>`;
    d.addEventListener('click', () => { sfx.init(); input.podium(i); });
    box.appendChild(d); labels.push(d);
  });
}

function placeLabels() {
  if (!show) return;
  labels.forEach((d, i) => {
    const p = studio.podiumScreen(i, 1.25);
    if (!p) return;
    d.style.left = `${p.x}px`; d.style.top = `${p.y}px`;
  });
}

function gainPop(i, n) {
  const p = labels[i]?.getBoundingClientRect();
  if (!p || !n) return;
  const g = el('div', 'gain', (n > 0 ? '+' : '−') + Math.abs(n));
  g.style.left = `${p.left + p.width / 2}px`; g.style.top = `${p.top - 30}px`;
  g.style.color = n > 0 ? show.state.teams[i].color : '#ff8585';
  document.body.appendChild(g); setTimeout(() => g.remove(), 1500);
}

// ------------------------------------------------------------------ show events
let revealTimer = null;
function onShow(e) {
  const s = show.state;
  switch (e.type) {
    case 'round_title':
      studio.lampsOff(); studio.setLift(null); studio.focus(null);
      analytics.event('level_start', { level: e.round, teams: s.teams.length, timer: show.timerOn, length: cfg.length });
      sfx.whoosh(); break;
    case 'question':
      studio.lampsOff(); studio.focus(null); studio.clearConfetti(); studio.hostTalk(); sfx.whoosh();
      s.teams.forEach((_, i) => studio.chars[i]?.idle());
      if (e.owner != null) studio.lamp(e.owner, true);
      break;
    case 'locked': sfx.locked(); studio.lamp(e.team, true); break;
    case 'buzz':
      sfx.buzz(); studio.lamp(e.team, true);
      labels[e.team]?.classList.remove('buzz'); void labels[e.team]?.offsetWidth; labels[e.team]?.classList.add('buzz');
      break;
    case 'wrong_buzz': sfx.wrong(); studio.lamp(e.team, false); studio.sad(e.team); break;
    case 'second': if (e.left <= 5 && e.left > 0) sfx.tick(e.left === 1); break;
    case 'time_up': sfx.timeUp(); break;
    case 'attempt': analytics.attempt(e.correct); break;
    case 'reveal': {
      // Drum roll, then the answer. Round 2 answers come one at a time, so no roll there.
      const roll = show.round.kind !== 'buzz';
      revealing = roll;
      if (roll) sfx.drumroll(1.0);
      clearTimeout(revealTimer);
      revealTimer = setTimeout(() => {
        revealing = false;
        const r = e.result;
        if (r.correct.length) sfx.right(); else sfx.wrong();
        studio.flash(r.correct.length ? '#2ee6c0' : '#ff8585');
        r.correct.forEach((i) => studio.cheer(i));
        r.wrong.forEach((i) => studio.sad(i));
        s.teams.forEach((tm, i) => gainPop(i, tm.gained));
        if (show.round.kind === 'buzz' && r.correct.length) studio.focus(r.correct[0]);
        if (r.correct.length) studio.hostCheer();
        render();
      }, roll ? 1100 : 0);
      break;
    }
    case 'round_end': {
      analytics.event('level_end', { level: e.round, result: 'won', seconds: e.seconds, answers: e.answers, correct: e.correct });
      const rank = show.ranking();
      const lifts = s.teams.map((tm) => (rank.length - 1 - rank.indexOf(tm)) * 0.9);
      studio.setLift(lifts); studio.focus(null); studio.lampsOff();
      studio.cheer(rank[0].i); studio.confettiBurst(); sfx.applause(2);
      break;
    }
    case 'end': {
      const pct = s.answered ? Math.round(100 * s.right / s.answered) : 0;
      analytics.event('show_end', { level: 3, teams: s.teams.length, questions: show.total, pct });
      const rank = show.ranking();
      rank.filter((tm) => tm.score === rank[0].score).forEach((tm) => studio.cheer(tm.i));
      studio.confettiBurst(); sfx.applause(3.5); sfx.jingle();
      break;
    }
    default: break;
  }
  render();
}
// ------------------------------------------------------------------ rendering
function questionHTML(q, revealed) {
  if (q.kind === 'trio') {
    const slot = (k) => {
      const given = q.slots[k];
      if (given != null) return `<span class="slot">${esc(given)}</span>`;
      if (k === q.askIndex) return `<span class="slot ask${revealed ? ' filled' : ''}">${revealed ? esc(q.answer) : '&nbsp;'}</span>`;
      return '<span class="slot">&nbsp;</span>';
    };
    return `<span>${esc(q.base)}</span>${ARROW}${slot(0)}${ARROW}${slot(1)}`;
  }
  const parts = esc(q.sentence).split('___');
  const gap = `<span class="gap${revealed ? ' filled' : ''}">${revealed ? esc(q.answer) : '&nbsp;'}</span>`;
  return parts.join(gap);
}

// The teach beat, only where it adds to the filled-in question: a verb's whole chain
// (never the 3rd form after a 2nd-form question whose 3rd form comes next), or the
// rule for a preposition.
function teachHTML(q) {
  if (q.kind === 'trio') {
    if (!q.teach || q.teach.includes('___') || q.askIndex === 1) return '';
    return q.teach.split(' → ').map((w, i) => `<span class="${['base', 'past', 'pp'][i]}">${esc(w)}</span>`).join(ARROW);
  }
  return q.teach ? esc(q.teach) : '';
}

function keysFor(i) {
  const kind = show.round?.kind;
  if (kind === 'buzz') return `${t('buzzKey')}: ${BUZZ_KEYS[i].toUpperCase()}`;
  return PICK_KEYS[i].map((k) => k.toUpperCase()).join(' ');
}

function keymapHTML() {
  return '<div class="keymap">' + show.state.teams.map((tm, i) =>
    `<div style="--c:${tm.color}"><b>${esc(tm.name)}</b>${show.round.kind === 'buzz'
      ? `<kbd>${BUZZ_KEYS[i].toUpperCase()}</kbd>`
      : PICK_KEYS[i].map((k, j) => `${LETTERS[j]}=<kbd>${k.toUpperCase()}</kbd>`).join(' ')}</div>`).join('') + '</div>';
}

function render() {
  if (!show) return;
  const s = show.state, r = show.round, q = show.q, ph = s.phase;
  const nm = { 1: [t('round1'), t('round1Name'), t('r1How')], 2: [t('round2'), t('round2Name'), t('r2How')], 3: [t('round3'), t('round3Name'), t('r3How')] }[r.n];
  $('roundPill').textContent = ph === 'end' ? t('title') : `${nm[0]} · ${nm[1]}${q && s.qi >= 0 ? ' · ' + t('question', s.qi + 1, r.qs.length) : ''}`;

  // overlays
  $('roundTitle').classList.toggle('hidden', ph !== 'title');
  if (ph === 'title') $('roundCard').innerHTML = `<h2>${esc(nm[0])}</h2><h3>${esc(nm[1])}</h3><p>${esc(nm[2])}</p>${keymapHTML()}`;
  $('betPanel').classList.toggle('hidden', ph !== 'bet');
  if (ph === 'bet') renderBets();
  $('standings').classList.toggle('hidden', ph !== 'standings');
  if (ph === 'standings') renderStandings(nm[0]);
  $('endPanel').classList.toggle('hidden', ph !== 'end');
  if (ph === 'end') renderEnd();

  // question stage
  const onStage = ['ask', 'answering', 'reveal'].includes(ph);
  const revealed = ph === 'reveal' && !revealing;
  $('stage').classList.toggle('hidden', !onStage);
  if (onStage && q) {
    const qc = $('qcard');
    qc.className = q.kind === 'gap' ? 'sentence' : '';
    qc.innerHTML = questionHTML(q, revealed);
    const right = q.options.indexOf(q.answer);
    const boxes = $('boxes');
    if (boxes.dataset.q !== `${s.round}|${s.qi}`) {
      boxes.dataset.q = `${s.round}|${s.qi}`; boxes.innerHTML = '';
      q.options.forEach((o, k) => {
        const b = el('button', 'box', `<span class="k">${LETTERS[k]}</span><span class="w">${esc(o)}</span><span class="who"></span>`);
        b.addEventListener('click', () => { sfx.init(); input.box(k); });
        boxes.appendChild(b);
      });
    }
    [...boxes.children].forEach((b, k) => {
      b.classList.toggle('right', revealed && k === right);
      b.classList.toggle('dim', revealed && k !== right);
      const struck = r.kind === 'buzz' && !revealed && s.struck.includes(k);
      b.classList.toggle('struck', !!struck);
      const who = b.querySelector('.who');
      who.innerHTML = revealed && s.result ? Object.entries(s.result.picked).filter(([, o]) => o === k)
        .map(([tm]) => `<i style="background:${s.teams[tm].color}"></i>`).join('') : '';
    });
    const teach = $('teach');
    const tHtml = revealed ? teachHTML(q) : '';
    teach.classList.toggle('hidden', !tHtml);
    teach.innerHTML = tHtml;
    const hint = $('hint');
    let h = '';
    if (ph === 'answering') h = `<span style="color:${s.teams[s.buzzer].color}">${esc(s.teams[s.buzzer].name)}</span> ${esc(t('buzzed'))}`;
    else if (ph === 'ask' && r.kind === 'buzz') h = esc(t('buzzNow'));
    else if (ph === 'ask' && input.selected != null) h = `<span style="color:${s.teams[input.selected].color}">${esc(s.teams[input.selected].name)}</span>: A B C D?`;
    else if (revealed && !s.result?.correct.length) h = esc(t('nobody'));
    hint.innerHTML = h; hint.classList.toggle('hidden', !h);
  }

  // timer
  const showTimer = show.timerOn && (ph === 'ask' || ph === 'answering');
  $('timer').classList.toggle('hidden', !showTimer);

  // podium labels
  labels.forEach((d, i) => {
    const tm = s.teams[i];
    d.querySelector('.score').textContent = revealing ? (tm.score - tm.gained) : tm.score;
    const st = d.querySelector('.st');
    let txt = '', cls = '';
    if (ph === 'ask' && r.kind !== 'buzz') { if (i in s.picks) { txt = `✓ ${t('lockedIn')}`; cls = 'ok'; } else txt = t('waiting'); }
    else if ((ph === 'ask' || ph === 'answering') && r.kind === 'buzz') {
      if (s.out.includes(i)) { txt = t('out'); cls = 'bad'; } else if (s.buzzer === i) { txt = '🔔'; cls = 'ok'; }
    } else if (revealed && s.result) {
      if (s.result.correct.includes(i)) { txt = `✓ ${t('right')}`; cls = 'ok'; }
      else if (s.result.wrong.includes(i)) txt = (r.kind !== 'buzz' && !(i in s.result.picked)) ? t('noAnswer') : '✗';
    } else if (ph === 'bet') { txt = `${t('bet')}: ${s.bets[i]}`; }
    st.textContent = txt; st.className = 'st ' + cls; st.style.visibility = txt ? 'visible' : 'hidden';
    d.querySelector('.keys').textContent = (ph === 'ask' || ph === 'title') ? keysFor(i) : '';
    d.classList.toggle('sel', input.selected === i);
    d.style.display = ph === 'end' ? 'none' : '';
  });

  // next button
  const nb = $('next');
  let label = null;
  if (ph === 'title') label = t('go');
  else if (ph === 'bet') label = t('showQuestion');
  else if (ph === 'ask') label = t('reveal');
  else if (ph === 'reveal' && !revealing) label = t('next');
  else if (ph === 'standings') label = t('continue');
  nb.classList.toggle('hidden', !label);
  if (label) nb.innerHTML = `${esc(label)}<small>⏎</small>`;
}

// timer display updates every frame cheaply
setInterval(() => {
  if (!show) return;
  const s = show.state;
  $('timerNum').textContent = Math.ceil(s.timeLeft);
  $('timer').style.setProperty('--p', `${(s.timeLeft / 20) * 100}%`);
  $('timer').classList.toggle('low', s.timeLeft <= 5);
}, 100);

function renderBets() {
  const s = show.state, card = $('betCard');
  if (card.dataset.q === `${s.round}|${s.qi}`) {
    card.querySelectorAll('.bet').forEach((b, i) => { b.querySelector('.v').textContent = s.bets[i]; });
    return;
  }
  card.dataset.q = `${s.round}|${s.qi}`;
  card.innerHTML = `<h2>${esc(t('round3'))}</h2><h3>${esc(t('question', s.qi + 1, show.round.qs.length))}</h3><p>${esc(t('betsHow'))}</p><div class="bets"></div>`;
  const wrap = card.querySelector('.bets');
  s.teams.forEach((tm, i) => {
    const max = show.maxBet(i);
    const b = el('div', 'bet', `<b>${esc(tm.name)}</b><div class="v">${s.bets[i]}</div>
      <input type="range" min="0" max="${max}" step="10" value="${s.bets[i]}"><div class="of">0 – ${max}</div>`);
    b.style.setProperty('--c', tm.color);
    b.querySelector('input').addEventListener('input', (ev) => show.setBet(i, +ev.target.value));
    wrap.appendChild(b);
  });
}

function rankHTML() {
  return '<div class="rank">' + show.ranking().map((tm, k) =>
    `<div style="--c:${tm.color}"><span class="pos">${k + 1}.</span><span class="nm">${esc(tm.name)}</span><span class="pt">${tm.score}</span></div>`).join('') + '</div>';
}

function renderStandings(roundName) {
  $('standCard').innerHTML = `<h3>${esc(t('afterRound', roundName))}</h3>${rankHTML()}`;
}

function reviewLine(e) {
  const q = e.q;
  let body;
  if (q.kind === 'trio') {
    const c = q.chain || { base: q.base, past: q.askIndex === 0 ? q.answer : q.slots[0], pp: q.askIndex === 1 ? q.answer : '…' };
    body = `<span><span class="base">${esc(c.base)}</span>${ARROW}<span class="past">${esc(c.past)}</span>${ARROW}<span class="pp">${esc(c.pp)}</span></span>`;
  } else {
    body = `<span>${esc(q.sentence).split('___').join(`<span class="gapa">${esc(q.answer)}</span>`)}</span>`;
  }
  return `<div>${body}<small>${esc(t('reviewMissed', e.n))}</small></div>`;
}

function renderEnd() {
  const rank = show.ranking();
  const top = rank.filter((tm) => tm.score === rank[0].score);
  const head = top.length > 1 ? t('tie') : t('winner', rank[0].name);
  const rev = show.review(5);
  $('endCard').innerHTML = `<h2 style="color:${top.length > 1 ? 'var(--amber)' : rank[0].color}">${esc(head)}</h2>
    <div class="endcols"><div>${rankHTML()}</div><div><h3>${esc(t('review'))}</h3>
    ${rev.length ? `<div class="review">${rev.map(reviewLine).join('')}</div>` : `<p>${esc(t('reviewNone'))}</p>`}</div></div>
    <div class="btns"><button id="againBtn">${esc(t('again'))}</button></div>`;
  $('againBtn').addEventListener('click', () => {
    $('endPanel').classList.add('hidden'); $('bar').classList.add('hidden'); $('stage').classList.add('hidden');
    $('next').classList.add('hidden'); $('labels').innerHTML = ''; labels = [];
    input?.detach(); show = null; input = null;
    studio.setLift(null);
    renderSetup(); $('setup').classList.remove('hidden');
  });
}
