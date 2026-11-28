/* ──────────────────────────────────────────────────────────────────────────
   Krabsy — the drill shell (docs/drill-review-2026-11-28.md, changes 1–3)

   One script + one stylesheet (krabsy-drill.css) for every list-style drill:
   Sprint, Type Race, Free Practice, Fill the Gap. It plays any topic with the
   'quiz' shape (krabsy-questions.js getQuizSet / checkTyped), in rounds:

     answer   'choice' (chips, keys 1–4) | 'typed' (input, Enter; accent keys
              when the taught language has them, sections.json subjects)
     clock    on: a start card, the time counts only while a question is open
              (reading the feedback is free), a wrong answer adds 1 s; best
              time per drill + topic. Off: no start card, best = most right.

   Page markup (no inline script, contract rule 9):

     <link rel="stylesheet" href="/lib/krabsy-drill.css?v=…">
     <div id="kd" class="kd" data-drill="sprint" data-topic="irregular_verbs"
          data-answer="choice" data-clock="1" data-count="12"></div>
     <script type="module" src="/lib/krabsy-drill.js?v=…"></script>

   data-*:  drill       sprint | type_race | free_practice | fill_gap (names,
                        stats source, best key)
            topic       topic id (topics.json)
            answer      choice | typed          clock   1 | 0
            count       questions per round (default 12, typed 10)
            ramp        1 = the round starts easy (verbs by tier, sentences
                        by difficulty)
            sentences   1 = verbs asked in their example sentence (Fill the Gap)
            difficulty  only these question levels, e.g. "2" (Sprint prepositions)
            ids-param   URL parameter with a fixed item list (?verbs=go,see),
                        Free Practice; the round then asks exactly those items

   URL: ?difficulty=N (teacher link) is applied by the engine; ?from=teacher
   shows "Practice from your teacher" above the card.

   Every answer: recordAttempt(item, form, correct, source, topic, mode), which
   also pays the shells (krabsy-stats.js → krabsy-shells.js). All visible text
   comes from data/ui_<lang>.json (`drill`, `common`, `drills`, `tools`).
   ────────────────────────────────────────────────────────────────────────── */

import { getQuizSet, checkTyped, topicSupports } from '/lib/krabsy-questions.js?v=2026-11-28d';
import { loadStrings, loadTopics, loadGames } from '/lib/krabsy-data.js?v=2026-11-27l';
import { recordAttempt } from '/lib/krabsy-stats.js?v=2026-11-25';
import { getShells } from '/lib/krabsy-shells.js';
import { currentLang, currentSection, sectionGames, gameUrl, topicLearnLang, subjectKeys, pickLang } from '/lib/krabsy-lang.js?v=2026-11-27';

const ICONS = '/lib/icons/krabsy-icons.svg?v=2026-11-28q';
const AUDIO_KEY = 'krabsy_audio';          // shared with the drill games
const SOURCE = { sprint: 'sprint', type_race: 'type-race', fill_gap: 'fill-the-gap', free_practice: 'free_practice' };
const NAME_NS = { free_practice: 'tools' }; // where drills.<id> / tools.<id> live
const PENALTY_MS = 1000;
const MAX_IDS = 20;                         // a teacher list asks at most this many items

const icon = (id, cls = 'kd-ico') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="${ICONS}#${id}"/></svg>`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const stripAccents = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
const fmt = (t, vars) => String(t || '').replace(/\{(\w+)\}/g, (m, k) => (vars && vars[k] != null ? String(vars[k]) : m));
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const earned = () => { try { return getShells().earned || 0; } catch (_) { return 0; } };
const lsGet = (k) => { try { return localStorage.getItem(k); } catch (_) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (_) { /* private mode */ } };

let lastKeyboard = false;
window.addEventListener('keydown', () => { lastKeyboard = true; }, true);
window.addEventListener('pointerdown', () => { lastKeyboard = false; }, true);
const coarse = () => { try { return matchMedia('(pointer: coarse)').matches; } catch (_) { return false; } };

/* ── sound (WebAudio tones of the drill games, type-race.html) ─────────── */
let audioCtx = null;
let soundOn = lsGet(AUDIO_KEY) !== '0';
function tone({ type = 'sine', from = 600, to = 900, dur = 120, vol = 0.18, delay = 0 }) {
  if (!soundOn) return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const t0 = audioCtx.currentTime + delay;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t0);
    osc.frequency.linearRampToValueAtTime(to, t0 + dur / 1000);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur / 1000);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + dur / 1000 + 0.02);
  } catch (_) { /* no audio */ }
}
const sfx = {
  right: () => tone({ from: 620, to: 920, dur: 120, vol: 0.16 }),
  streak: () => { tone({ from: 660, to: 660, dur: 250, vol: 0.13 }); tone({ from: 830, to: 830, dur: 250, vol: 0.11, delay: 0.01 }); tone({ from: 990, to: 1180, dur: 260, vol: 0.10, delay: 0.02 }); },
  wrong: () => tone({ type: 'square', from: 180, to: 140, dur: 200, vol: 0.10 }),
  done: () => { [[523, 523, 110, 0], [659, 659, 110, 0.08], [784, 784, 110, 0.16], [988, 1175, 420, 0.24]].forEach(([f, t, d, w]) => tone({ from: f, to: t, dur: d, vol: 0.12, delay: w })); },
};

/* ── the drill ─────────────────────────────────────────────────────────── */
async function mount(root) {
  const ds = root.dataset;
  const drill = ds.drill || 'sprint';
  const topic = ds.topic || 'irregular_verbs';
  const typed = ds.answer === 'typed';
  const clock = ds.clock === '1';
  const ramp = ds.ramp === '1';
  const sentences = ds.sentences === '1';
  const baseCount = parseInt(ds.count, 10) || (typed ? 10 : 12);
  const difficulty = ds.difficulty ? ds.difficulty.split(',').map(Number).filter(Boolean) : undefined;
  const lang = currentLang();
  const section = currentSection();
  const learn = topicLearnLang(topic) || 'en';
  const keys = typed ? subjectKeys(topic) : [];
  const source = SOURCE[drill] || drill;
  const mode = typed ? 'typed' : 'choice';
  const params = new URLSearchParams(location.search);
  const fromTeacher = params.get('from') === 'teacher';

  let S;
  try { S = await loadStrings(lang, topic); } catch (err) {
    console.warn('krabsy-drill: strings failed', err);
    root.textContent = '…';
    return;
  }
  const D = S.drill || {};
  const C = S.common || {};
  const own = ((S[NAME_NS[drill] || 'drills'] || {})[drill]) || {};
  const t = (k, vars) => fmt(D[k] != null ? D[k] : (C[k] != null ? C[k] : k), vars);

  let topicsJson = {};
  try { topicsJson = await loadTopics(); } catch (_) { /* names stay empty */ }
  const topicName = pickLang((topicsJson[topic] || {}).short_name, lang) || pickLang((topicsJson[topic] || {}).display_name, lang) || '';

  // Fixed item list (?verbs=go,see — Free Practice, links from the profile/landing).
  let ids = null;
  if (ds.idsParam) {
    const raw = params.get(ds.idsParam);
    if (raw) ids = raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean).slice(0, MAX_IDS);
    if (ids && !ids.length) ids = null;
  }

  const legacyBest = drill === 'sprint' && topic === 'irregular_verbs' ? 'krabsy_best_sprint' : null;
  const bestKey = `krabsy_best_${drill}_${topic}${clock ? '' : '_right'}`;
  const readBest = () => {
    const n = Number(lsGet(bestKey) ?? (legacyBest ? lsGet(legacyBest) : null));
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  /* round state */
  let list = [];          // questions of this round
  let i = 0;              // index of the open question
  let right = 0, streak = 0;
  let missed = [];        // questions answered wrong
  let elapsed = 0;        // ms, only while questions are open (+ penalties)
  let qStart = 0;         // performance.now() when the open question appeared
  let tick = null;
  let shells0 = 0;
  let isRetry = false;
  let locked = false;     // between answer and next question
  let advance = null;     // function that moves on (Weiter / Enter)
  let autoTimer = null;
  let answeredAt = 0;

  async function fetchRound() {
    const want = ids ? ids.length * (topic === 'irregular_verbs' && !sentences ? 2 : 1) : baseCount;
    const opts = { topic, count: Math.max(1, want), smart: !ids, lang, ...(ids ? { ids } : {}),
      ...(sentences ? { sentences: true } : {}), ...(difficulty ? { difficulty } : {}) };
    let qs = await getQuizSet(opts);
    if (!qs.length && difficulty) qs = await getQuizSet({ ...opts, difficulty: undefined });
    if (ramp) {
      // start easy: verbs by tier, sentences by difficulty (stable, pairs stay together)
      const lvl = (q) => q.tier || q.difficulty || 1;
      qs = qs.map((q, k) => [q, k]).sort((a, b) => lvl(a[0]) - lvl(b[0]) || a[1] - b[1]).map((x) => x[0]);
    }
    return qs;
  }

  /* ── markup ──────────────────────────────────────────────────────────── */
  function teacherBar() {
    if (!fromTeacher) return '';
    const lvl = parseInt(params.get('difficulty'), 10);
    const bits = [topicName, lvl >= 1 && lvl <= 3 ? t('teacher_level_' + lvl) : ''].filter(Boolean);
    return `<p class="kd-teacher">${icon('ki-teacher')}<span>${esc(t('teacher_lead') + (bits.length ? ': ' + bits.join(' · ') : ''))}</span></p>`;
  }
  function listNote() {
    if (!ids) return '';
    const n = new Set(list.map((q) => q.item)).size;
    const txt = (S.tools && S.tools.free_practice && S.tools.free_practice.fixed_deck_note) || '';
    return txt ? `<p class="kd-note">${esc(fmt(txt, { n }))}</p>` : '';
  }
  function soundBtn() {
    return `<button type="button" class="kd-sound" id="kd-sound" aria-pressed="${soundOn}" aria-label="${esc(soundOn ? t('sound_on') : t('sound_off'))}">${icon(soundOn ? 'ki-sound' : 'ki-sound-off')}</button>`;
  }
  function wireSound() {
    const b = root.querySelector('#kd-sound');
    if (!b) return;
    b.addEventListener('click', () => {
      soundOn = !soundOn;
      lsSet(AUDIO_KEY, soundOn ? '1' : '0');
      b.outerHTML = soundBtn();
      wireSound();
      if (soundOn) sfx.right();
    });
  }

  /* the question: verbs = "go → ___ → ___" (asked slot highlighted), sentences = the gap */
  function promptHtml(q) {
    const d = q.display;
    if (d.kind === 'trio') {
      const slot = (k) => {
        const s = d.slots[k];
        if (k === d.askIndex) return `<span class="kd-slot is-asked"><span class="kd-blank" aria-label="${esc(t('aria_blank'))}">?</span></span>`;
        if (s.text != null) return `<span class="kd-slot is-filled">${esc(s.text)}</span>`;
        return '<span class="kd-slot"><span class="kd-blank" aria-hidden="true">…</span></span>';
      };
      return `<p class="kd-trio" lang="${learn}"><span class="kd-base">${esc(d.base)}</span><span class="kd-arrow" aria-hidden="true">→</span>${slot(0)}<span class="kd-arrow" aria-hidden="true">→</span>${slot(1)}</p>`;
    }
    const plain = d.plain || d.sentence || '';
    const parts = plain.split('___');
    const gap = `<span class="kd-gap" aria-label="${esc(t('aria_blank'))}">___</span>`;
    return `<p class="kd-sentence" lang="${learn}">${parts.map(esc).join(gap)}</p>`
      + (d.hint ? `<p class="kd-hint-line">(${esc(d.hint)})</p>` : '');
  }
  /* opt-in help: the rule label of a sentence, or the masked form of a verb */
  function hintText(q) {
    if (q.display.kind === 'gap') return q.display.pattern || '';
    if (!typed) return '';
    const a = q.answer || '';
    return a.length <= 2 ? a[0] + '_' : a[0] + '_'.repeat(a.length - 2) + a[a.length - 1];
  }
  function filled(q) {
    if (q.display.kind === 'trio') {
      const c = q.teach && q.teach.chain;
      if (!c) return q.answer;
      return q.teach.hideParticiple ? `${c.base} → ${c.past} → ___` : `${c.base} → ${c.past} → ${c.participle}`;
    }
    return (q.display.plain || q.display.sentence || '').replace('___', q.answer);
  }
  function teachLine(q) {
    const line = q.teach && q.teach.line;
    if (!line) return '';
    if (q.display.kind === 'trio') return ''; // the row itself shows the chain
    return line;
  }

  /* the verb row stays on one line: shrink it until it fits (understand → understood → understood on a phone) */
  function fitTrio() {
    const row = root.querySelector('.kd-trio');
    if (!row) return;
    row.style.fontSize = '';
    let size = parseFloat(getComputedStyle(row).fontSize) || 16;
    for (let k = 0; k < 12 && row.scrollWidth > row.clientWidth + 1 && size > 10; k++) {
      size -= 1;
      row.style.fontSize = size + 'px';
    }
  }

  function statusBar() {
    return `<div class="kd-top">
        <span class="kd-count" id="kd-count"></span>
        <span class="kd-streak" id="kd-streak" hidden>${icon('ki-flame')}<span id="kd-streak-n"></span></span>
        <span class="kd-grow"></span>
        ${clock ? `<span class="kd-clock" id="kd-clock"><span id="kd-clock-n">0</span>${esc(C.seconds_short || 's')}<span class="kd-penalty" id="kd-penalty" aria-hidden="true">${esc(t('penalty'))}</span></span>` : ''}
        ${soundBtn()}
      </div>
      <div class="kd-prog" aria-hidden="true"><span id="kd-prog"></span></div>`;
  }

  function renderPlayFrame() {
    const input = typed ? `
        <form class="kd-type" id="kd-form" autocomplete="off">
          <input class="kd-input" id="kd-in" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="go" lang="${learn}" aria-label="${esc(t('type_label'))}" placeholder="${esc(t('type_placeholder'))}">
          <button type="submit" class="k-btn-primary kd-check" id="kd-check">${esc(t('check'))}</button>
        </form>
        ${keys.length ? `<div class="kd-keys" id="kd-keys">${keys.map((c) => `<button type="button" class="kd-key" data-key="${esc(c)}" tabindex="-1">${esc(c)}</button>`).join('')}</div>` : ''}` : '';
    root.innerHTML = `${teacherBar()}${listNote()}
      <section class="kd-card kd-play" aria-live="polite">
        ${statusBar()}
        <div class="kd-ask" id="kd-ask"></div>
        <div class="kd-help" id="kd-help"></div>
        ${typed ? '' : `<div class="kd-choices" id="kd-choices" role="group" aria-label="${esc(t('aria_choices'))}"></div>`}
        ${input}
        <div class="kd-fb" id="kd-fb" role="status"></div>
        <span class="kd-pop" id="kd-pop" aria-hidden="true">${icon('ki-shell', 'kd-pop-ico')}<span id="kd-pop-n"></span></span>
      </section>`;
    wireSound();
    if (typed) {
      const inp = root.querySelector('#kd-in');
      root.querySelectorAll('.kd-key').forEach((k) => k.addEventListener('click', () => {
        if (inp.readOnly) return;
        const a = inp.selectionStart ?? inp.value.length, b = inp.selectionEnd ?? inp.value.length;
        inp.value = inp.value.slice(0, a) + k.dataset.key + inp.value.slice(b);
        try { inp.focus(); inp.setSelectionRange(a + 1, a + 1); } catch (_) { /* old browser */ }
      }));
      root.querySelector('#kd-form').addEventListener('submit', (ev) => {
        ev.preventDefault();
        if (locked) { if (advance) advance(); return; }
        const val = inp.value.trim();
        if (!val) { inp.focus(); return; }
        answerTyped(val);
      });
    }
  }

  function updateTop() {
    const total = list.length;
    const c = root.querySelector('#kd-count');
    if (c) { c.textContent = `${Math.min(i + 1, total)} / ${total}`; c.setAttribute('aria-label', t('aria_progress', { n: Math.min(i + 1, total), total })); }
    const p = root.querySelector('#kd-prog');
    if (p) p.style.width = `${Math.round((i / total) * 100)}%`;
    const s = root.querySelector('#kd-streak');
    if (s) {
      s.hidden = streak < 2;
      root.querySelector('#kd-streak-n').textContent = String(streak);
      s.setAttribute('aria-label', t('streak_aria', { n: streak }));
    }
  }
  const now = () => performance.now();
  const runningMs = () => elapsed + (qStart ? now() - qStart : 0);
  function drawClock() {
    const n = root.querySelector('#kd-clock-n');
    if (n) n.textContent = String(Math.floor(runningMs() / 1000));
  }

  function ask() {
    const q = list[i];
    locked = false;
    advance = null;
    q._hinted = false;
    root.querySelector('#kd-ask').innerHTML = promptHtml(q);
    fitTrio();
    const help = root.querySelector('#kd-help');
    const h = hintText(q);
    const dontKnow = typed ? `<button type="button" class="kd-link" id="kd-skip">${esc(t('dont_know'))}</button>` : '';
    help.innerHTML = (h ? `<button type="button" class="kd-hint-btn" id="kd-hint"><span class="kd-hint-q" aria-hidden="true">?</span>${esc(t('hint'))}</button><span class="kd-hint" id="kd-hint-text" lang="${learn}" hidden>${esc(h)}</span>` : '') + dontKnow;
    if (h) root.querySelector('#kd-hint').addEventListener('click', (ev) => {
      ev.currentTarget.hidden = true;
      root.querySelector('#kd-hint-text').hidden = false;
      q._hinted = true;
      const inp = root.querySelector('#kd-in'); if (inp && !coarse()) inp.focus();
    });
    if (typed) root.querySelector('#kd-skip').addEventListener('click', () => { if (!locked) answerTyped(null); });
    const fb = root.querySelector('#kd-fb');
    fb.className = 'kd-fb';
    fb.innerHTML = '';
    if (typed) {
      const inp = root.querySelector('#kd-in');
      inp.value = '';
      inp.readOnly = false;
      inp.classList.remove('is-right', 'is-wrong');
      root.querySelector('#kd-check').textContent = t('check');
      const kk = root.querySelector('#kd-keys'); if (kk) kk.hidden = false;
      // On a phone the keyboard would cover the question before the first tap:
      // keep focus only once the child is typing (the input stays the same element).
      if (!coarse() || document.activeElement === inp) { try { inp.focus({ preventScroll: true }); } catch (_) { inp.focus(); } }
    } else {
      const box = root.querySelector('#kd-choices');
      // fresh order on every showing (a retry round asks the same question again)
      const opts = shuffle(q.options.slice());
      box.innerHTML = opts.map((o, k) => `<button type="button" class="kd-choice" data-v="${esc(o)}" lang="${learn}"><span class="kd-choice-n" aria-hidden="true">${k + 1}</span><span>${esc(o)}</span></button>`).join('');
      const btns = [...box.querySelectorAll('.kd-choice')];
      btns.forEach((b) => b.addEventListener('click', () => answerChoice(b)));
      if (lastKeyboard) btns[0].focus({ preventScroll: true });
    }
    updateTop();
    qStart = now();
  }

  function stopQuestionClock() {
    if (qStart) { elapsed += now() - qStart; qStart = 0; }
  }

  function answerChoice(btn) {
    if (locked) return;
    const q = list[i];
    const ok = btn.dataset.v === q.answer || checkTyped(q, btn.dataset.v);
    root.querySelectorAll('.kd-choice').forEach((b) => {
      b.disabled = true;
      if (b.dataset.v === q.answer) b.classList.add('is-right');
      else if (b === btn) b.classList.add('is-wrong');
    });
    finish(q, ok, false);
  }

  function answerTyped(val) {
    if (locked) return;
    const q = list[i];
    let ok = val != null && checkTyped(q, val);
    let accent = false;
    if (val != null && !ok && q.accepts.some((a) => stripAccents(a) === stripAccents(val))) { ok = true; accent = true; }
    const inp = root.querySelector('#kd-in');
    inp.readOnly = true;
    inp.classList.add(ok ? 'is-right' : 'is-wrong');
    if (val == null) inp.value = '';
    const kk = root.querySelector('#kd-keys'); if (kk) kk.hidden = true;
    finish(q, ok, accent);
  }

  function popShells(n) {
    const pop = root.querySelector('#kd-pop');
    if (!pop || n <= 0) return;
    root.querySelector('#kd-pop-n').textContent = `+${n}`;
    pop.classList.remove('is-on');
    void pop.offsetWidth;
    pop.classList.add('is-on');
  }

  function finish(q, ok, accent) {
    locked = true;
    answeredAt = now();
    stopQuestionClock();
    playing(true);   // from the first answer on: the article and the phone tab bar step aside
    const before = earned();
    try { recordAttempt(q.item, q.form, ok, source, q.topic, mode); } catch (err) { console.warn('krabsy-drill: record failed', err); }
    if (ok) {
      right += 1; streak += 1;
      popShells(earned() - before);
      if (streak > 0 && streak % 5 === 0) sfx.streak(); else sfx.right();
    } else {
      streak = 0;
      missed.push(q);
      sfx.wrong();
      if (clock) {
        elapsed += PENALTY_MS;
        const pen = root.querySelector('#kd-penalty');
        if (pen) { pen.classList.remove('is-on'); void pen.offsetWidth; pen.classList.add('is-on'); }
      }
    }
    if (clock) drawClock();
    updateTop();
    const p = root.querySelector('#kd-prog'); if (p) p.style.width = `${Math.round(((i + 1) / list.length) * 100)}%`;

    // fill the slot / gap with the answer
    const slot = root.querySelector('.kd-slot.is-asked, .kd-gap');
    if (slot) { slot.textContent = q.answer; slot.classList.add(ok ? 'is-right' : 'is-wrong'); fitTrio(); }
    const help = root.querySelector('#kd-help'); if (help) help.innerHTML = '';

    const fb = root.querySelector('#kd-fb');
    fb.className = 'kd-fb ' + (ok ? 'is-right' : 'is-wrong');
    const line = teachLine(q);
    const last = i + 1 >= list.length;
    if (ok) {
      fb.innerHTML = `<p class="kd-fb-main">${icon('ki-check')}<span>${esc(accent ? t('accent_note', { word: q.answer }) : t('right'))}</span></p>`;
    } else {
      fb.innerHTML = `<p class="kd-fb-main">${esc(t('wrong_lead'))} <b lang="${learn}">${esc(q.answer)}</b></p>`
        + (line ? `<p class="kd-fb-line">${esc(line)}</p>` : '')
        + (typed ? '' : `<button type="button" class="k-btn-primary kd-next" id="kd-next">${esc(C.next || 'OK')} <span aria-hidden="true">→</span></button>`);
    }
    let moved = false;
    advance = (auto) => {
      if (moved) return;
      if (!auto && now() - answeredAt < 350) return;   // a double Enter must not skip the right answer
      moved = true;
      clearTimeout(autoTimer);
      i += 1;
      if (i >= list.length) endRound(); else ask();
    };
    if (typed) {
      root.querySelector('#kd-check').textContent = C.next || 'OK';
      const inp = root.querySelector('#kd-in');
      if (!coarse() || lastKeyboard) { try { inp.focus({ preventScroll: true }); } catch (_) { /* */ } }
    } else {
      const nb = root.querySelector('#kd-next');
      if (nb) { nb.addEventListener('click', () => advance()); if (lastKeyboard) nb.focus({ preventScroll: true }); }
    }
    // a right answer moves on by itself; a wrong one waits so the right answer can be read
    if (ok && !accent) autoTimer = setTimeout(() => advance(true), last ? 500 : (typed ? 750 : (clock ? 380 : 650)));
  }

  /* keyboard: 1–4 pick a chip, Enter / Space moves on after an answer */
  function onKey(ev) {
    if (!root.isConnected || !root.querySelector('.kd-play')) return;
    if (ev.target && ev.target.tagName === 'INPUT') return;   // the form handles Enter
    if (locked && advance && (ev.key === 'Enter' || ev.key === ' ')) {
      if (ev.target && ev.target.tagName === 'BUTTON' && ev.target.id !== 'kd-next') return;
      ev.preventDefault(); advance(); return;
    }
    if (!typed && !locked) {
      const k = Number(ev.key) - 1;
      const btns = root.querySelectorAll('.kd-choice');
      if (k >= 0 && k < btns.length && k < 4) { ev.preventDefault(); answerChoice(btns[k]); }
    }
  }
  document.addEventListener('keydown', onKey);

  /* ── round lifecycle ─────────────────────────────────────────────────── */
  function playing(on) { document.body.classList.toggle('k-is-playing', !!on); }

  function startRound(qs, retry = false, scroll = true) {
    list = qs;
    i = 0; right = 0; streak = 0; missed = []; elapsed = 0; qStart = 0;
    isRetry = retry;
    shells0 = earned();
    renderPlayFrame();
    if (scroll) playing(true);
    clearInterval(tick);
    if (clock) tick = setInterval(drawClock, 200);
    ask();
    if (scroll && coarse()) {
      const card = root.querySelector('.kd-play');
      const h = document.querySelector('body > .k-page > header, body > header');
      const off = h && /sticky|fixed/.test(getComputedStyle(h).position) ? h.getBoundingClientRect().height : 0;
      const top = card.getBoundingClientRect().top + window.scrollY - off - 8;
      if (Math.abs(window.scrollY - top) > 40) window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    }
  }

  async function newRound() {
    root.innerHTML = `<p class="kd-loading">${esc(C.loading || '…')}</p>`;
    let qs = [];
    try { qs = await fetchRound(); } catch (err) { console.warn('krabsy-drill: questions failed', err); }
    if (!qs.length) { root.innerHTML = `<p class="kd-card kd-error">${esc(t('error'))}</p>`; return; }
    startRound(qs);
  }

  function renderStart(qs) {
    const best = readBest();
    root.innerHTML = `${teacherBar()}${listNote()}
      <section class="kd-card kd-start">
        <p class="kd-start-line">${esc(t('round_clock', { n: qs.length }))}</p>
        <button type="button" class="k-btn-primary kd-big" id="kd-go">${esc(C.start || 'OK')}</button>
        ${best ? `<p class="kd-best-line">${esc(C.best_time || '')}: <b>${(best / 1000).toFixed(1)} ${esc(C.seconds_short || 's')}</b></p>` : ''}
      </section>`;
    const go = root.querySelector('#kd-go');
    go.addEventListener('click', () => {
      startRound(qs);
      // typed: the tap on "start" may open the phone keyboard
      const inp = root.querySelector('#kd-in'); if (inp) { try { inp.focus({ preventScroll: true }); } catch (_) { inp.focus(); } }
    });
    if (lastKeyboard || !coarse()) go.focus({ preventScroll: true });
  }

  /* units for "practice these again": a missed verb form brings back its pair */
  function retryList() {
    const missedIds = new Set(missed.map((q) => q.id));
    const units = [];
    for (const q of list) {
      if (q.followUp && units.length && units[units.length - 1][0].item === q.item) units[units.length - 1].push(q);
      else units.push([q]);
    }
    return shuffle(units.filter((u) => u.some((q) => missedIds.has(q.id)))).flat();
  }

  async function gameLink() {
    try {
      const games = sectionGames(await loadGames(), section).filter((g) => (g.topics || []).includes(topic)
        && g.status !== 'coming_soon' && g.audience !== 'teacher' && (!g.ui_langs || g.ui_langs.includes(lang)));
      if (!games.length) return '';
      const n = (Number(lsGet('krabsy_drill_game_turn')) || 0) + 1;
      lsSet('krabsy_drill_game_turn', String(n));
      const g = games[n % games.length];
      const name = pickLang(g.name, lang) || g.id;
      const href = `${gameUrl(section, g.id)}?topic=${encodeURIComponent(topic)}`;
      const thumb = g.thumb_small || g.thumbnail || '';
      return `<a class="kd-game" href="${esc(href)}">${thumb ? `<img src="${esc(thumb)}" alt="" width="160" height="90" loading="lazy" decoding="async">` : icon('ki-play', 'kd-game-ico')}<span>${esc(t('play_game', { name }))}</span>${icon('ki-play', 'kd-game-go')}</a>`;
    } catch (_) { return ''; }
  }

  async function endRound() {
    clearInterval(tick);
    stopQuestionClock();
    playing(false);
    const total = list.length;
    const won = Math.max(0, earned() - shells0);
    const counts = !isRetry && !ids;     // a retry or a teacher list sets no best
    let bestHtml = '', flag = '';
    if (clock) {
      const prev = readBest();
      const beat = counts && prev != null && elapsed < prev;
      if (counts && (prev == null || beat)) lsSet(bestKey, String(Math.round(elapsed)));
      const best = prev != null && !beat ? readBest() : null;   // the first run is the best: no second number
      if (beat) flag = C.new_best || '';
      bestHtml = `<div class="kd-stat"><b class="kd-stat-v${beat ? ' is-best' : ''}">${(elapsed / 1000).toFixed(1)} ${esc(C.seconds_short || 's')}</b><span class="kd-stat-l">${esc(C.your_time || '')}</span></div>`
        + (best ? `<div class="kd-stat"><b class="kd-stat-v">${(best / 1000).toFixed(1)} ${esc(C.seconds_short || 's')}</b><span class="kd-stat-l">${esc(C.best_time || '')}</span></div>` : '');
    } else if (counts) {
      const prev = readBest();
      const beat = prev != null && right > prev;
      if (prev == null || beat) lsSet(bestKey, String(right));
      if (beat) flag = t('new_record');
      else if (prev != null) bestHtml = `<p class="kd-best-line">${esc(t('best_score', { right: prev, total }))}</p>`;
    }
    const missedHtml = missed.length ? `
        <div class="kd-missed">
          <h2 class="kd-missed-h">${esc(C.missed || '')}</h2>
          <ul class="kd-missed-list">${missed.filter((q, k) => q.display.kind !== 'trio' || missed.findIndex((x) => x.item === q.item) === k).map((q) => `<li lang="${learn}">${q.display.kind === 'trio'
            ? esc(`${q.teach.chain ? `${q.teach.chain.base} → ${q.teach.chain.past} → ${q.teach.chain.participle}` : q.answer}`)
            : esc(filled(q))}</li>`).join('')}</ul>
          <button type="button" class="k-btn-secondary" id="kd-retry">${esc(t('retry_missed'))}</button>
        </div>` : '';
    const title = own.end_title || t('end_title');
    root.innerHTML = `${teacherBar()}
      <section class="kd-card kd-end">
        <h2 class="kd-end-h">${esc(title)}</h2>
        ${won > 0 ? `<p class="kd-shells">${icon('ki-shell', 'kd-shells-ico')}<span>${esc(fmt(C.shells_earned || '+{n}', { n: won }))}</span></p>` : ''}
        ${flag ? `<p class="kd-flag"><span>${icon('ki-star', 'kd-flag-ico')}${esc(flag)}</span></p>` : ''}
        <div class="kd-stats">
          <div class="kd-stat"><b class="kd-stat-v" aria-label="${esc(t('score', { right, total }))}">${right} / ${total}</b><span class="kd-stat-l">${esc(t('right_label'))}</span></div>
          ${clock ? bestHtml : ''}
        </div>
        ${clock ? '' : bestHtml}
        <div class="kd-end-actions">
          <button type="button" class="k-btn-primary kd-big" id="kd-again">${esc(C.play_again || 'OK')}</button>
        </div>
        ${missedHtml}
        <div class="kd-game-slot" id="kd-game-slot"></div>
      </section>`;
    sfx.done();
    const again = root.querySelector('#kd-again');
    again.addEventListener('click', () => newRound());
    const retry = root.querySelector('#kd-retry');
    if (retry) retry.addEventListener('click', () => startRound(retryList(), true));
    if (lastKeyboard) again.focus({ preventScroll: true });
    const card = root.querySelector('.kd-end');
    const h = document.querySelector('body > .k-page > header, body > header');
    const off = h && /sticky|fixed/.test(getComputedStyle(h).position) ? h.getBoundingClientRect().height : 0;
    const top = card.getBoundingClientRect().top + window.scrollY - off - 8;
    if (window.scrollY > top + 4 || card.getBoundingClientRect().top < off) window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    const slot = root.querySelector('#kd-game-slot');
    const link = await gameLink();
    if (slot && link) slot.innerHTML = link;
  }

  /* ── boot ────────────────────────────────────────────────────────────── */
  if (!topicSupports(topic, 'quiz')) { root.innerHTML = `<p class="kd-card kd-error">${esc(t('error'))}</p>`; return; }
  root.innerHTML = `<p class="kd-loading">${esc(C.loading || '…')}</p>`;
  let first = [];
  try { first = await fetchRound(); } catch (err) { console.warn('krabsy-drill: questions failed', err); }
  if (!first.length) { root.innerHTML = `<p class="kd-card kd-error">${esc(t('error'))}</p>`; return; }
  if (clock) renderStart(first); else startRound(first, false, false);   // no start card: no jump on load
}

document.querySelectorAll('.kd[data-drill]').forEach((el) => { mount(el); });
