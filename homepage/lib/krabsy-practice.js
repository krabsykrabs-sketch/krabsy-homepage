/* ──────────────────────────────────────────────────────────────────────────
   Krabsy — the practice session "Jetzt üben" (docs/student-path.md §1, P1)
   Pages: /de/ueben/, /es/practicar/, /en/spanish/practice/ (<main id="kp">).

   Three steps, about 5 minutes:
     1. Warm-up       WARM questions the smart mix says are due, across the
                      child's topics (choice chips, the Sprint look).
     2. New or weak   one topic: homework first, else the weakest topic, else
                      the one not practiced for the longest time. NEW
                      questions; a new item shows its teach line first.
                      Typed answers (checkTyped), "show choices" as fallback.
     3. Play          2–3 games of this section that play that topic.
   The session counts for the weekly ring (krabsy-practice-week.js) when
   steps 1 and 2 are done; step 3 is the reward, the child may leave.

   "The child's topics" = topics of this section answered at least once
   (krabsy-stats.js) + homework topics + the section's starter topic.
   A topic belongs to the section when its subject matches and it has a URL in
   the section's interface language (krabsy-lang.js, sections.json).

   Every answer: recordAttempt(item, form, correct, 'practice', topic, mode),
   mode 'choice' | 'typed' (shells, gifts and the tutor's map follow).

   URL: ?topic=<id> forces the topic of step 2 (student page, tests).
   ────────────────────────────────────────────────────────────────────────── */

import { getQuizSet, checkTyped, topicSupports, TOPICS } from '/lib/krabsy-questions.js';
import { loadTopics, loadGames } from '/lib/krabsy-data.js';
import { recordAttempt, readTopicItems } from '/lib/krabsy-stats.js';
import { itemState, KNOWN, INTERVAL_DAYS } from '/lib/krabsy-smart.js';
import { getShells } from '/lib/krabsy-shells.js';
import { currentLang, currentSection, sectionTopics as sectionTopicIds, topicLearnLang, subjectKeys, gameUrl, pickLang } from '/lib/krabsy-lang.js?v=2026-11-27';
import { thisWeek, addSession, ringSvg, ringText, totalSessions } from '/lib/krabsy-practice-week.js?v=2026-11-27l';

const WARM = 8;          // questions in step 1
const FOCUS = 5;         // questions in step 2
const DAY = 86400000;

const LANG = currentLang();
const SECTION = currentSection();   // { home, games, starter, … } from sections.json

const TXT = {
  de: {
    title: 'Jetzt üben', lead: '3 kurze Schritte, etwa 5 Minuten.',
    s1: 'Aufwärmen', s1sub: (n) => `${n} schnelle Fragen`,
    s2: 'Neu oder knifflig', s3: 'Spielen', s3sub: 'Ein Spiel zu deinem Thema',
    start: 'Los geht’s', back: 'Zurück zur Startseite', quit: 'Später weiter',
    step: (i) => `Schritt ${i} von 3`, count: (i, n) => `${i} / ${n}`,
    right: 'Richtig!', wrong: 'Fast! Richtig ist:', next: 'Weiter',
    typePh: 'Antwort tippen …', check: 'Prüfen', choices: 'Lieber auswählen',
    accent: (w) => `Richtig! Mit Akzent: ${w}`,
    newBadge: 'Neu', teachGo: 'Verstanden, frag mich!', teachLead: 'Schau es dir kurz an:',
    rHw: (t) => `Hausaufgabe von ${t}`, rHwPlain: 'Deine Hausaufgabe', rWeak: 'Das übst du noch',
    rOld: 'Lange nicht geübt', rNew: 'Neu für dich',
    s2go: 'Weiter zu Schritt 2',
    doneTitle: 'Geschafft!', doneSub: 'Diese Übungsrunde zählt für deine Woche.',
    shells: (n) => `+${n} Muscheln`, score: (r, n) => `${r} von ${n} richtig`,
    playH: 'Schritt 3: Jetzt spielen', playSub: (t) => `Diese Spiele üben ${t}:`,
    finish: 'Fertig für heute', again: 'Noch eine Runde',
    loading: 'Einen Moment …', error: 'Das hat nicht geklappt. Lade die Seite neu.',
    noGames: 'Alle Spiele →', typeLabel: 'Deine Antwort', blank: 'Lücke',
  },
  es: {
    title: 'Practicar ahora', lead: '3 pasos cortos, unos 5 minutos.',
    s1: 'Calentamiento', s1sub: (n) => `${n} preguntas rápidas`,
    s2: 'Algo nuevo o difícil', s3: 'Jugar', s3sub: 'Un juego de tu tema',
    start: '¡Vamos!', back: 'Volver al inicio', quit: 'Seguir más tarde',
    step: (i) => `Paso ${i} de 3`, count: (i, n) => `${i} / ${n}`,
    right: '¡Correcto!', wrong: 'Casi. La respuesta es:', next: 'Siguiente',
    typePh: 'Escribe la respuesta …', check: 'Comprobar', choices: 'Prefiero elegir',
    accent: (w) => `¡Correcto! Con tilde: ${w}`,
    newBadge: 'Nuevo', teachGo: '¡Entendido, pregúntame!', teachLead: 'Míralo un momento:',
    rHw: (t) => `Tarea de ${t}`, rHwPlain: 'Tu tarea', rWeak: 'Esto todavía lo practicas',
    rOld: 'Hace tiempo que no lo practicas', rNew: 'Nuevo para ti',
    s2go: 'Al paso 2',
    doneTitle: '¡Lo lograste!', doneSub: 'Esta ronda cuenta para tu semana.',
    shells: (n) => `+${n} caracolas`, score: (r, n) => `${r} de ${n} correctas`,
    playH: 'Paso 3: A jugar', playSub: (t) => `Estos juegos practican ${t}:`,
    finish: 'Listo por hoy', again: 'Otra ronda',
    loading: 'Un momento …', error: 'Algo salió mal. Vuelve a cargar la página.',
    noGames: 'Todos los juegos →', typeLabel: 'Tu respuesta', blank: 'hueco',
  },
  en: {
    title: 'Practice now', lead: '3 short steps, about 5 minutes.',
    s1: 'Warm-up', s1sub: (n) => `${n} quick questions`,
    s2: 'Something new or tricky', s3: 'Play', s3sub: 'A game for your topic',
    start: 'Let’s go', back: 'Back to the start page', quit: 'Finish later',
    step: (i) => `Step ${i} of 3`, count: (i, n) => `${i} / ${n}`,
    right: 'Right!', wrong: 'Almost! The answer is:', next: 'Next',
    typePh: 'Type the answer …', check: 'Check', choices: 'Show choices',
    accent: (w) => `Right! With the accent: ${w}`,
    newBadge: 'New', teachGo: 'Got it, ask me!', teachLead: 'Have a quick look:',
    rHw: (t) => `Homework from ${t}`, rHwPlain: 'Your homework', rWeak: 'Still a bit tricky',
    rOld: 'Not practiced for a while', rNew: 'New for you',
    s2go: 'On to step 2',
    doneTitle: 'Done!', doneSub: 'This round counts for your week.',
    shells: (n) => `+${n} shells`, score: (r, n) => `${r} of ${n} right`,
    playH: 'Step 3: Now play', playSub: (t) => `These games practice ${t}:`,
    finish: 'Done for today', again: 'One more round',
    loading: 'One moment …', error: 'Something went wrong. Please reload the page.',
    noGames: 'All games →', typeLabel: 'Your answer', blank: 'gap',
  },
};
const T = TXT[LANG] || TXT.en;

/* ── small helpers ─────────────────────────────────────────────────────── */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const main = document.getElementById('kp');
const $ = (sel) => main.querySelector(sel);
const stripAccents = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
const learnAttr = (topic) => topicLearnLang(topic) || 'en';   // lang attribute of learning-language text
let lastKeyboard = false;
window.addEventListener('keydown', () => { lastKeyboard = true; }, true);
window.addEventListener('pointerdown', () => { lastKeyboard = false; }, true);
function focusSoft(el, force = false) { if (el && (lastKeyboard || force)) try { el.focus({ preventScroll: !lastKeyboard }); } catch (_) {} }

/* ── which topics ──────────────────────────────────────────────────────── */
let topicsJson = {};
function sectionTopics() {
  return sectionTopicIds(SECTION).filter((id) => topicsJson[id] && topicsJson[id].status !== 'coming_soon'
    && TOPICS.includes(id) && topicSupports(id, 'quiz'));
}
function topicName(id) {
  const t = topicsJson[id] || {};
  return pickLang(t.short_name, LANG) || pickLang(t.display_name, LANG) || id;
}

/** Per topic: { seen, weak, due, share, last } from the child's stats. */
function topicState(topic) {
  const items = readTopicItems(topic);
  let seen = 0, weak = 0, due = 0, last = 0;
  const now = Date.now();
  for (const forms of Object.values(items)) {
    const st = itemState(forms);
    if (!st.seen) continue;
    seen += 1;
    if (st.last > last) last = st.last;
    if (st.mastery < KNOWN) { weak += 1; due += 1; continue; }
    const gap = (INTERVAL_DAYS[Math.min(5, st.mastery)] || 7) * DAY;
    if (now - st.last >= gap) due += 1;
  }
  return { seen, weak, due, share: seen ? weak / seen : 0, last };
}

/** Homework from a tutor (the student page's API); null without a student key. */
async function fetchHomework() {
  let token = null;
  try {
    const p = JSON.parse(localStorage.getItem('krabsy_people') || 'null');
    const a = p && Array.isArray(p.list) ? p.list.find((x) => x.id === p.active) : null;
    token = (a && a.token) || null;
    if (!token) { const c = JSON.parse(localStorage.getItem('krabsy_class') || 'null'); token = (c && c.token) || null; }
  } catch (_) { /* no storage */ }
  if (!token) return null;
  let base = 'https://api.krabsy.com';
  try { if (window.KRABSY_API) base = String(window.KRABSY_API).replace(/\/$/, ''); } catch (_) {}
  const ctl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), 4000) : null;
  try {
    const r = await fetch(base + '/api/tutor/me', { headers: { 'X-Student-Token': token }, credentials: 'omit', signal: ctl && ctl.signal });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.ok) return null;
    return { tutor: d.tutor_name || '', list: Array.isArray(d.homework) ? d.homework : [] };
  } catch (_) {
    return null;
  } finally { if (timer) clearTimeout(timer); }
}

/** The plan: the child's topics, the topic of step 2 and why. */
function makePlan(hw) {
  const inSection = new Set(sectionTopics());
  const mine = new Set();
  if (inSection.has(SECTION.starter)) mine.add(SECTION.starter);
  const state = new Map();
  for (const id of inSection) {
    const st = topicState(id);
    state.set(id, st);
    if (st.seen) mine.add(id);
  }
  const hwList = ((hw && hw.list) || []).filter((h) => inSection.has(h.topic));
  for (const h of hwList) mine.add(h.topic);

  let focus = null, reason = null, hwItem = null;
  const forced = new URLSearchParams(location.search).get('topic');
  const openHw = hwList.find((h) => !(h.goal && h.answers >= h.goal));
  if (forced && inSection.has(forced)) {
    focus = forced;
    hwItem = hwList.find((h) => h.topic === forced) || null;
    reason = hwItem ? 'hw' : null;
  } else if (openHw) {
    focus = openHw.topic; hwItem = openHw; reason = 'hw';
  }
  if (!focus) {
    // weakest: the largest share of items that don't sit yet (at least 2 such items)
    const weak = [...mine].map((id) => [id, state.get(id)]).filter(([, s]) => s.weak >= 2)
      .sort((a, b) => b[1].share - a[1].share || b[1].weak - a[1].weak);
    if (weak.length) { focus = weak[0][0]; reason = 'weak'; }
  }
  if (!focus) {
    // longest not practiced (a topic never answered counts as the oldest)
    const old = [...mine].sort((a, b) => state.get(a).last - state.get(b).last);
    focus = old[0] || SECTION.starter;
    reason = state.get(focus) && state.get(focus).seen ? 'old' : 'new';
  }
  if (!reason) { const s = state.get(focus); reason = s && s.seen ? (s.weak >= 2 ? 'weak' : 'old') : 'new'; }
  if (focus) mine.add(focus);
  return { mine: [...mine], focus, reason, hw: hwItem, tutor: (hw && hw.tutor) || '', state };
}

/** Split WARM questions over the child's topics: the ones with most due items first. */
function warmShare(plan) {
  const list = plan.mine.map((id) => ({ id, due: plan.state.get(id) ? plan.state.get(id).due : 0 }))
    .filter((x) => x.due > 0).sort((a, b) => b.due - a.due).slice(0, 3);
  if (!list.length) return [{ id: plan.mine.includes(SECTION.starter) ? SECTION.starter : plan.focus, n: WARM }];
  const total = list.reduce((s, x) => s + x.due, 0);
  let left = WARM;
  const out = list.map((x, i) => {
    const n = i === list.length - 1 ? left : Math.max(2, Math.min(left - 2 * (list.length - 1 - i), Math.round(WARM * x.due / total)));
    left -= n;
    return { id: x.id, n };
  }).filter((x) => x.n > 0);
  return out;
}

/* ── questions ─────────────────────────────────────────────────────────── */
async function warmQuestions(plan) {
  const out = [];
  for (const { id, n } of warmShare(plan)) {
    try { out.push(...await getQuizSet({ topic: id, count: n, smart: true, lang: LANG })); } catch (_) { /* skip topic */ }
  }
  return out;
}

/** Units = a question, or a 2nd-form + 3rd-form pair (chain order). */
function toUnits(list) {
  const units = [];
  for (const q of list) {
    if (q.followUp && units.length && units[units.length - 1][0].item === q.item) units[units.length - 1].push(q);
    else units.push([q]);
  }
  return units;
}

async function focusQuestions(plan, used) {
  const topic = plan.focus;
  const opts = { topic, count: FOCUS + 8, smart: true, lang: LANG };
  const lvl = plan.hw && Number(plan.hw.difficulty);
  let list = [];
  if (lvl >= 1 && lvl <= 3 && topic !== 'irregular_verbs') {
    try { list = await getQuizSet({ ...opts, difficulty: [1, 2, 3].filter((d) => d <= lvl) }); } catch (_) { list = []; }
  }
  if (list.length < 3) list = await getQuizSet(opts);
  let units = toUnits(list);
  const fresh = units.filter((u) => !used.has(u[0].topic + ':' + u[0].item));
  if (fresh.reduce((s, u) => s + u.length, 0) >= 3) units = fresh;
  const out = [];
  for (const u of units) {
    if (out.length >= FOCUS) break;
    out.push(...u);
  }
  // mark new items: never answered before this session → teach line first
  const stats = readTopicItems(topic);
  for (const q of out) q._new = !itemState(stats[q.item]).seen && !q.followUp;
  return out;
}

/* ── rendering ─────────────────────────────────────────────────────────── */
function stepsHtml(active) {
  const names = [T.s1, T.s2, T.s3];
  return `<ol class="kp-steps" aria-label="${esc(T.step(active))}">${names.map((n, i) => {
    const cls = i + 1 < active ? 'is-done' : i + 1 === active ? 'is-now' : '';
    return `<li class="${cls}"${i + 1 === active ? ' aria-current="step"' : ''}><span class="kp-steps-n" aria-hidden="true">${i + 1 < active ? '✓' : i + 1}</span><span class="kp-steps-t">${esc(n)}</span></li>`;
  }).join('')}</ol>`;
}

function reasonText(plan) {
  if (plan.reason === 'hw') return plan.tutor ? T.rHw(plan.tutor) : T.rHwPlain;
  return { weak: T.rWeak, old: T.rOld, new: T.rNew }[plan.reason] || '';
}

function weekHtml(big = false) {
  const { count } = thisWeek();
  return `<span class="kp-week${count >= 3 ? ' is-week-done' : ''}${big ? ' kp-week-big' : ''}">${ringSvg(count, big ? 56 : 30)}<span>${esc(ringText(count))}</span></span>`;
}

function renderIntro(plan) {
  main.innerHTML = `
    <section class="kp-card kp-intro">
      <div class="kp-intro-top">
        <h1 class="kp-title">${esc(T.title)}</h1>
        ${weekHtml()}
      </div>
      <p class="kp-lead">${esc(T.lead)}</p>
      <ol class="kp-plan">
        <li><span class="kp-plan-n">1</span><span><b>${esc(T.s1)}</b><small>${esc(T.s1sub(WARM))}</small></span></li>
        <li><span class="kp-plan-n">2</span><span><b>${esc(T.s2)}: ${esc(topicName(plan.focus))}</b><small${plan.reason === 'hw' ? ' class="kp-hw"' : ''}>${esc(reasonText(plan))}</small></span></li>
        <li><span class="kp-plan-n">3</span><span><b>${esc(T.s3)}</b><small>${esc(T.s3sub)}</small></span></li>
      </ol>
      <div class="kp-actions">
        <button type="button" class="kp-btn kp-btn-main" id="kp-start">${esc(T.start)} <span aria-hidden="true">→</span></button>
        <a class="kp-link" href="${SECTION.home}">${esc(T.back)}</a>
      </div>
    </section>`;
  return $('#kp-start');
}

/* the question itself: verbs = trio "go → ___ → ___", sentence topics = the gap */
function promptHtml(q, typedSlot = '') {
  const lang = learnAttr(q.topic);
  if (q.display.kind === 'trio') {
    const slot = (i) => {
      const s = q.display.slots[i];
      if (i === q.display.askIndex) return `<span class="kp-slot is-asked">${typedSlot || '<span class="kp-blank" aria-label="' + esc(T.blank) + '">?</span>'}</span>`;
      if (s.text != null) return `<span class="kp-slot is-filled">${esc(s.text)}</span>`;
      return '<span class="kp-slot"><span class="kp-blank" aria-hidden="true">…</span></span>';
    };
    return `<p class="kp-trio" lang="${lang}"><span class="kp-base">${esc(q.display.base)}</span><span class="kp-arrow" aria-hidden="true">→</span>${slot(0)}<span class="kp-arrow" aria-hidden="true">→</span>${slot(1)}</p>`;
  }
  const plain = q.display.plain || q.display.sentence;
  const parts = plain.split('___');
  const gap = typedSlot || `<span class="kp-gap" aria-label="${esc(T.blank)}">___</span>`;
  return `<p class="kp-sentence" lang="${lang}">${parts.map(esc).join(gap)}</p>${q.display.hint ? `<p class="kp-hint">(${esc(q.display.hint)})</p>` : ''}`;
}

function teachLine(q) {
  if (q.teach && q.teach.line) return q.teach.line;
  return null;
}
function filledSentence(q) {
  if (q.display.kind === 'trio') {
    const c = q.teach && q.teach.chain;
    return c ? `${c.base} → ${c.past} → ${c.participle}` : q.answer;
  }
  return (q.display.plain || q.display.sentence).replace('___', q.answer);
}

/**
 * Run a list of questions. step: 1 | 2. typed: offer typing first (step 2).
 * Resolves { right, total } when all are answered.
 */
function runQuestions(list, { step, typed, title }) {
  return new Promise((resolve) => {
    let i = 0, right = 0;
    const total = list.length;

    function frame(inner) {
      main.innerHTML = `
        <div class="kp-bar">${stepsHtml(step)}<a class="kp-quit" href="${SECTION.home}">${esc(T.quit)}</a></div>
        <section class="kp-card kp-q">
          <div class="kp-q-head"><span class="kp-q-title">${esc(title)}</span><span class="kp-q-count">${esc(T.count(Math.min(i + 1, total), total))}</span></div>
          <div class="kp-prog" aria-hidden="true"><span style="width:${Math.round((i / total) * 100)}%"></span></div>
          ${inner}
        </section>`;
    }

    function next() {
      if (i >= total) { resolve({ right, total }); return; }
      const q = list[i];
      if (q._new && !q._taught) { teach(q); return; }
      ask(q, typed && !q._choice);
    }

    function teach(q) {
      q._taught = true;
      const line = teachLine(q);
      const filled = filledSentence(q);
      frame(`<div class="kp-teach">
          <span class="kp-new">${esc(T.newBadge)}</span>
          <p class="kp-teach-lead">${esc(T.teachLead)}</p>
          <p class="kp-teach-main" lang="${learnAttr(q.topic)}">${esc(filled)}</p>
          ${line && line !== filled && q.display.kind !== 'trio' ? `<p class="kp-teach-line">${esc(line)}</p>` : ''}
          <div class="kp-actions"><button type="button" class="kp-btn kp-btn-main" id="kp-teach-go">${esc(T.teachGo)}</button></div>
        </div>`);
      const b = $('#kp-teach-go');
      b.addEventListener('click', () => ask(q, typed && !q._choice));
      focusSoft(b);
    }

    function ask(q, asTyped) {
      if (asTyped) {
        const input = `<input class="kp-input" id="kp-in" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done" lang="${learnAttr(q.topic)}" aria-label="${esc(T.typeLabel)}" placeholder="${esc(T.typePh)}">`;
        const keys = subjectKeys(q.topic);
        const accents = keys.length
          ? `<div class="kp-keys" aria-hidden="false">${keys.map((c) => `<button type="button" class="kp-key" data-key="${c}" tabindex="-1">${c}</button>`).join('')}</div>` : '';
        frame(`${promptHtml(q)}
          <form class="kp-type" id="kp-form" autocomplete="off">${input}<button type="submit" class="kp-btn kp-btn-main">${esc(T.check)}</button></form>
          ${accents}
          <div class="kp-fb" id="kp-fb" role="status" aria-live="polite"></div>
          <p class="kp-alt"><button type="button" class="kp-link" id="kp-tochoice">${esc(T.choices)}</button></p>`);
        const inp = $('#kp-in');
        main.querySelectorAll('.kp-key').forEach((k) => k.addEventListener('click', () => {
          const s = inp.selectionStart ?? inp.value.length, e = inp.selectionEnd ?? inp.value.length;
          inp.value = inp.value.slice(0, s) + k.dataset.key + inp.value.slice(e);
          inp.focus(); inp.setSelectionRange(s + 1, s + 1);
        }));
        $('#kp-tochoice').addEventListener('click', () => { q._choice = true; ask(q, false); });
        $('#kp-form').addEventListener('submit', (ev) => {
          ev.preventDefault();
          const val = inp.value.trim();
          if (!val) { inp.focus(); return; }
          let ok = checkTyped(q, val);
          let accentNote = false;
          if (!ok && q.accepts.some((a) => stripAccents(a) === stripAccents(val))) { ok = true; accentNote = true; }
          inp.readOnly = true;
          inp.classList.add(ok ? 'is-right' : 'is-wrong');
          main.querySelector('#kp-form button').disabled = true;
          $('#kp-tochoice').closest('.kp-alt').remove();
          const keys = main.querySelector('.kp-keys'); if (keys) keys.remove();
          answered(q, ok, 'typed', accentNote);
        });
        // on a phone the keyboard would cover the question: focus only with a keyboard/desktop
        if (lastKeyboard || !matchMedia('(pointer: coarse)').matches) focusSoft(inp, true);
        return;
      }
      frame(`${promptHtml(q)}
        <div class="kp-choices" role="group">${q.options.map((o, k) => `<button type="button" class="kp-choice" data-k="${k}" lang="${learnAttr(q.topic)}"><span class="kp-choice-n" aria-hidden="true">${k + 1}</span>${esc(o)}</button>`).join('')}</div>
        <div class="kp-fb" id="kp-fb" role="status" aria-live="polite"></div>`);
      const btns = [...main.querySelectorAll('.kp-choice')];
      const pick = (k) => {
        if (btns[0].disabled) return;
        const ok = k === q.correctIndex;
        btns.forEach((b, j) => { b.disabled = true; if (j === q.correctIndex) b.classList.add('is-right'); else if (j === k) b.classList.add('is-wrong'); });
        answered(q, ok, 'choice');
      };
      btns.forEach((b, k) => b.addEventListener('click', () => pick(k)));
      keyHandler = (ev) => {
        if (ev.target && ev.target.tagName === 'INPUT') return;
        const k = Number(ev.key) - 1;
        if (k >= 0 && k < btns.length) { ev.preventDefault(); pick(k); }
      };
      if (lastKeyboard) focusSoft(btns[0]);
    }

    function answered(q, ok, mode, accentNote = false) {
      keyHandler = null;
      try { recordAttempt(q.item, q.form, ok, 'practice', q.topic, mode); } catch (_) { /* never block the session */ }
      if (ok) right += 1;
      const line = teachLine(q);
      const fb = $('#kp-fb');
      fb.className = 'kp-fb ' + (ok ? 'is-right' : 'is-wrong');
      fb.innerHTML = `<p class="kp-fb-main">${ok ? esc(accentNote ? T.accent(q.answer) : T.right)
        : `${esc(T.wrong)} <b lang="${learnAttr(q.topic)}">${esc(q.answer)}</b>`}</p>
        ${line ? `<p class="kp-fb-line" lang="${learnAttr(q.topic)}">${esc(line)}</p>` : ''}
        <button type="button" class="kp-btn kp-btn-main kp-next" id="kp-next">${esc(T.next)} <span aria-hidden="true">→</span></button>`;
      // fill the gap / slot with the answer
      const slot = main.querySelector('.kp-slot.is-asked .kp-blank, .kp-gap');
      if (slot) { slot.textContent = q.answer; slot.classList.add(ok ? 'is-right' : 'is-wrong'); }
      const go = () => { if (done) return; done = true; clearTimeout(timer); i += 1; next(); };
      let done = false;
      const nb = $('#kp-next');
      nb.addEventListener('click', go);
      focusSoft(nb);
      enterHandler = (ev) => { if (ev.key === 'Enter' && document.activeElement !== nb) { ev.preventDefault(); go(); } };
      const timer = ok && !accentNote ? setTimeout(go, 1400) : null;
    }

    next();
  });
}
let keyHandler = null, enterHandler = null;
document.addEventListener('keydown', (ev) => {
  if (enterHandler) { const h = enterHandler; if (ev.key === 'Enter') { enterHandler = null; h(ev); return; } }
  if (keyHandler) keyHandler(ev);
});

function renderBetween(plan, warm) {
  main.innerHTML = `
    <div class="kp-bar">${stepsHtml(2)}<a class="kp-quit" href="${SECTION.home}">${esc(T.quit)}</a></div>
    <section class="kp-card kp-between">
      <p class="kp-score">${esc(T.score(warm.right, warm.total))}</p>
      <h2 class="kp-h2">${esc(T.s2)}: ${esc(topicName(plan.focus))}</h2>
      <p class="kp-reason${plan.reason === 'hw' ? ' kp-hw' : ''}">${esc(reasonText(plan))}</p>
      <div class="kp-actions"><button type="button" class="kp-btn kp-btn-main" id="kp-s2">${esc(T.s2go)} <span aria-hidden="true">→</span></button></div>
    </section>`;
  return $('#kp-s2');
}

async function renderDone(plan, res, shells) {
  const games = await suggestGames(plan);
  main.innerHTML = `
    <div class="kp-bar">${stepsHtml(3)}</div>
    <section class="kp-card kp-done">
      <h1 class="kp-title"><svg class="ki" width="34" height="34" style="vertical-align:-0.18em;margin-right:8px" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="/lib/icons/krabsy-icons.svg?v=2026-11-27c#ki-star"/></svg>${esc(T.doneTitle)}</h1>
      <p class="kp-lead">${esc(T.doneSub)}</p>
      <div class="kp-done-row">
        ${weekHtml(true)}
        <span class="kp-done-facts"><span>${esc(T.score(res.right, res.total))}</span>${shells > 0 ? `<span class="kp-shells"><svg class="kp-shells-ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="/lib/icons/krabsy-icons.svg?v=2026-11-27c#ki-shell"/></svg>${esc(T.shells(shells))}</span>` : ''}</span>
      </div>
    </section>
    <section class="kp-card kp-play">
      <h2 class="kp-h2">${esc(T.playH)}</h2>
      <p class="kp-muted">${esc(T.playSub(topicName(plan.focus)))}</p>
      ${games.length ? `<div class="kp-games">${games.map((g) => `<a class="kp-game" href="${esc(g.href)}">
          <img src="${esc(g.thumb)}" alt="" width="400" height="225" loading="lazy" decoding="async"><span>${esc(g.name)}</span></a>`).join('')}</div>`
        : `<p><a class="kp-link" href="${SECTION.games}">${esc(T.noGames)}</a></p>`}
      <div class="kp-actions kp-actions-end">
        <a class="kp-btn kp-btn-ghost" href="${SECTION.home}">${esc(T.finish)}</a>
        <button type="button" class="kp-btn kp-btn-ghost" id="kp-again">${esc(T.again)}</button>
      </div>
    </section>`;
  $('#kp-again').addEventListener('click', () => { location.reload(); });
  focusSoft(main.querySelector('.kp-game') || $('#kp-again'));
}

async function suggestGames(plan) {
  let games = [];
  try { games = await loadGames(); } catch (_) { return []; }
  const list = games.filter((g) => g.status !== 'coming_soon' && g.audience !== 'teacher'
    && (g.topics || []).includes(plan.focus) && (!g.ui_langs || g.ui_langs.includes(LANG)));
  // a little variety between sessions: start the list at a different game each time
  const shift = list.length ? totalSessions() % list.length : 0;
  const order = [...list.slice(shift), ...list.slice(0, shift)].slice(0, 3);
  return order.map((g) => {
    const q = new URLSearchParams({ topic: plan.focus });
    if (plan.hw) {
      if (plan.hw.difficulty) q.set('difficulty', String(plan.hw.difficulty));
      if (plan.hw.glang && plan.hw.glang !== LANG) q.set('lang', plan.hw.glang);
      q.set('from', 'teacher');
    }
    return { href: `${gameUrl(SECTION, g.id)}?${q}`, name: pickLang(g.name, LANG) || g.id,
      thumb: g.thumb_small || g.thumbnail || '' };
  });
}

/* ── the session ───────────────────────────────────────────────────────── */
async function start() {
  main.innerHTML = `<p class="kp-loading">${esc(T.loading)}</p>`;
  let plan;
  try {
    const [tj, hw] = await Promise.all([loadTopics(), fetchHomework()]);
    topicsJson = tj;
    plan = makePlan(hw);
  } catch (err) {
    console.warn('krabsy-practice: plan failed', err);
    main.innerHTML = `<p class="kp-card">${esc(T.error)}</p>`;
    return;
  }
  const go = renderIntro(plan);
  focusSoft(go);
  await new Promise((r) => go.addEventListener('click', r, { once: true }));

  const shells0 = (() => { try { return getShells().earned || 0; } catch (_) { return 0; } })();
  let warmList = [];
  try { warmList = await warmQuestions(plan); } catch (err) { console.warn('krabsy-practice: warm-up failed', err); }
  const used = new Set(warmList.map((q) => q.topic + ':' + q.item));
  const warm = warmList.length ? await runQuestions(warmList, { step: 1, typed: false, title: T.s1 }) : { right: 0, total: 0 };

  let focusList = [];
  try { focusList = await focusQuestions(plan, used); } catch (err) { console.warn('krabsy-practice: step 2 failed', err); }
  if (focusList.length) {
    const b = renderBetween(plan, warm);
    focusSoft(b);
    await new Promise((r) => b.addEventListener('click', r, { once: true }));
  }
  const focus = focusList.length ? await runQuestions(focusList, { step: 2, typed: true, title: topicName(plan.focus) }) : { right: 0, total: 0 };

  if (warm.total + focus.total > 0) addSession();
  const shells = (() => { try { return Math.max(0, (getShells().earned || 0) - shells0); } catch (_) { return 0; } })();
  await renderDone(plan, { right: warm.right + focus.right, total: warm.total + focus.total }, shells);
  window.scrollTo(0, 0);
}

if (main) start();
