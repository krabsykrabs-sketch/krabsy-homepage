/* ──────────────────────────────────────────────────────────────────────────
   Krabsy — Verb-Diplom / Diploma de verbos (2026-11-22)

   A typed test on irregular verbs in three levels; passing one shows a
   printable certificate. Brief: docs/brief-verb-diplom.md.

     import { initVerbDiplom } from '/lib/krabsy-verb-diplom.js';
     initVerbDiplom(document.getElementById('vd-app'));

   Language comes from <html lang>. Each verb is two typed answers (2nd
   form, then 3rd form with the 2nd filled in — getQuizSet chain order).
   A mistake is one wrong answer; the test stops as soon as it can no
   longer be passed.

   Privacy: the name typed for the certificate never leaves the page —
   it is not stored, not sent to analytics. Only passed levels (level,
   date, mistakes, seconds) are kept in localStorage.
   ────────────────────────────────────────────────────────────────────────── */

import { getQuizSet, checkTyped } from '/lib/krabsy-questions.js';
import { recordAttempt } from '/lib/krabsy-stats.js';
import { gameEvent } from '/lib/krabsy-game-events.js';
import { currentLang } from '/lib/krabsy-lang.js?v=2026-11-27';

const GAME = 'verb-diplom';
const STORE_KEY = 'krabsy_verb_diplom';

const BRONZE_VERBS = ['be', 'have', 'do', 'go', 'get', 'make', 'say', 'see',
  'come', 'take', 'give', 'know', 'think', 'write', 'eat'];

/* tier lists are read from the verb table at start */
const LEVELS = [
  { key: 'bronze', num: 1, verbs: 15, maxMistakes: 3, pick: (t) => BRONZE_VERBS.slice() },
  { key: 'silver', num: 2, verbs: 30, maxMistakes: 6, pick: (t) => sample(t[1], 30) },
  { key: 'gold',   num: 3, verbs: 45, maxMistakes: 9, pick: (t) => [...sample(t[1], 15), ...sample(t[2], 30)] },
];

const STR = {
  de: {
    levels: { bronze: 'Bronze', silver: 'Silber', gold: 'Gold' },
    choose: 'Wähle dein Diplom',
    levelInfo: '{verbs} Verben · {answers} Antworten · höchstens {max} Fehler',
    bronzeNote: 'Die 15 wichtigsten Verben. Der Einstieg.',
    silverNote: '30 Grundverben, jedes Mal andere.',
    goldNote: '45 Verben, darunter schwierigere.',
    passedOn: 'Bestanden am {date}',
    showCert: 'Urkunde zeigen',
    start: 'Start',
    progress: 'Antwort {n} von {total}',
    mistakes: 'Fehler: {n} von höchstens {max}',
    placeholder: 'Hier tippen',
    check: 'Prüfen',
    next: 'Weiter',
    correct: 'Richtig!',
    wrong: 'Leider falsch. Richtig ist:',
    yourAnswer: 'Deine Antwort:',
    empty: '(leer)',
    passTitle: 'Bestanden! Verb-Diplom {level}',
    passText: '{correct} von {answers} Antworten richtig, Zeit {time}.',
    failTitle: 'Diesmal nicht bestanden',
    failText: 'Mehr als {max} Fehler. Übe diese Verben und versuch es noch einmal:',
    retry: 'Noch einmal',
    otherLevel: 'Anderes Diplom',
    nameLabel: 'Dein Vorname oder Spitzname für die Urkunde',
    nameHint: 'Der Name bleibt auf deinem Gerät. Er wird nicht gespeichert und nicht verschickt.',
    print: 'Urkunde drucken oder als PDF speichern',
    quit: 'Abbrechen',
    quitConfirm: 'Test wirklich abbrechen?',
    certTitle: 'Verb-Diplom',
    certFor: 'für',
    certLine: 'hat das Verb-Diplom {level} bestanden: {verbs} unregelmäßige englische Verben, {correct} von {answers} Formen richtig.',
    certDate: 'Datum',
    certTime: 'Zeit',
    loadError: 'Die Verben konnten nicht geladen werden. Bitte lade die Seite neu.',
    locale: 'de-DE',
    pageUrl: 'krabsy.com/de/unregelmaessige-verben/verb-diplom/',
    practiceHref: (v) => `/de/unregelmaessige-verben/${v.replace(/ /g, '-')}/`,
  },
  es: {
    levels: { bronze: 'Bronce', silver: 'Plata', gold: 'Oro' },
    choose: 'Elige tu diploma',
    levelInfo: '{verbs} verbos · {answers} respuestas · máximo {max} errores',
    bronzeNote: 'Los 15 verbos más importantes. Para empezar.',
    silverNote: '30 verbos básicos, distintos cada vez.',
    goldNote: '45 verbos, algunos más difíciles.',
    passedOn: 'Aprobado el {date}',
    showCert: 'Ver diploma',
    start: 'Empezar',
    progress: 'Respuesta {n} de {total}',
    mistakes: 'Errores: {n} de máximo {max}',
    placeholder: 'Escribe aquí',
    check: 'Comprobar',
    next: 'Siguiente',
    correct: '¡Correcto!',
    wrong: 'Incorrecto. La respuesta es:',
    yourAnswer: 'Tu respuesta:',
    empty: '(vacía)',
    passTitle: '¡Aprobado! Diploma de verbos {level}',
    passText: '{correct} de {answers} respuestas correctas, tiempo {time}.',
    failTitle: 'Esta vez no ha salido',
    failText: 'Más de {max} errores. Practica estos verbos y vuelve a intentarlo:',
    retry: 'Otra vez',
    otherLevel: 'Otro diploma',
    nameLabel: 'Tu nombre o apodo para el diploma',
    nameHint: 'El nombre se queda en tu dispositivo. No se guarda ni se envía.',
    print: 'Imprimir el diploma o guardarlo como PDF',
    quit: 'Salir',
    quitConfirm: '¿Seguro que quieres salir del test?',
    certTitle: 'Diploma de verbos',
    certFor: 'para',
    certLine: 'ha aprobado el diploma de verbos {level}: {verbs} verbos irregulares en inglés, {correct} de {answers} formas correctas.',
    certDate: 'Fecha',
    certTime: 'Tiempo',
    loadError: 'No se pudieron cargar los verbos. Recarga la página.',
    locale: 'es-ES',
    pageUrl: 'krabsy.com/es/verbos-irregulares/diploma/',
    practiceHref: (v) => `/es/verbos-irregulares/${v.replace(/ /g, '-')}/`,
  },
};

/* ── helpers ─────────────────────────────────────────────────────────── */

function sample(arr, n) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}
function fmt(s, vars) { return s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : '')); }
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
}
function loadStore() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (_) { return {}; }
}
function saveStore(s) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch (_) { /* private mode */ }
}
/* "was / were", "was/were" or "was, were": accepted when every part is. */
function isCorrect(q, input) {
  if (checkTyped(q, input)) return true;
  const parts = input.split(/[\/,]/).map((p) => p.trim()).filter(Boolean);
  return parts.length > 1 && parts.every((p) => checkTyped(q, p));
}

let _tiers = null;
async function loadTiers() {
  if (_tiers) return _tiers;
  const res = await fetch('/data/irregular-verbs.json');
  const rows = await res.json();
  const t = { 1: new Set(), 2: new Set() };
  for (const r of rows) if (t[r.tier]) t[r.tier].add(r.verb);
  _tiers = { 1: [...t[1]], 2: [...t[2]] };
  return _tiers;
}

/* ── app ─────────────────────────────────────────────────────────────── */

export function initVerbDiplom(root) {
  const lang = currentLang({ supported: Object.keys(STR) });
  const S = STR[lang];
  let run = null; // current test

  function screen(name) {
    for (const s of root.querySelectorAll('.vd-screen')) s.hidden = s.dataset.screen !== name;
    root.dataset.state = name;
    document.body.classList.toggle('k-is-playing', name === 'play');
  }

  /* level chooser */
  function renderChooser() {
    const box = root.querySelector('[data-screen="choose"]');
    box.innerHTML = '';
    box.appendChild(el('h2', 'vd-h2', S.choose));
    const grid = el('div', 'vd-levels');
    const store = loadStore();
    for (const L of LEVELS) {
      const card = el('div', `vd-level vd-level--${L.key}`);
      const medal = el('div', 'vd-medal'); medal.setAttribute('aria-hidden', 'true');
      card.appendChild(medal);
      card.appendChild(el('h3', 'vd-level-name', S.levels[L.key]));
      card.appendChild(el('p', 'vd-level-note', S[`${L.key}Note`]));
      card.appendChild(el('p', 'vd-level-info',
        fmt(S.levelInfo, { verbs: L.verbs, answers: L.verbs * 2, max: L.maxMistakes })));
      const done = store[L.key];
      const actions = el('div', 'vd-level-actions');
      const startBtn = el('button', 'k-btn-primary', S.start);
      startBtn.type = 'button';
      startBtn.addEventListener('click', () => startLevel(L));
      actions.appendChild(startBtn);
      if (done && done.passed) {
        card.appendChild(el('p', 'vd-level-passed',
          '✓ ' + fmt(S.passedOn, { date: new Date(done.date).toLocaleDateString(S.locale) })));
        const cert = el('button', 'k-btn-ghost', S.showCert);
        cert.type = 'button';
        cert.addEventListener('click', () => showPass(L, done, false));
        actions.appendChild(cert);
      }
      card.appendChild(actions);
      grid.appendChild(card);
    }
    box.appendChild(grid);
    screen('choose');
  }

  /* test */
  async function startLevel(L) {
    let qs;
    try {
      const tiers = await loadTiers();
      const ids = L.pick(tiers);
      qs = await getQuizSet({ topic: 'irregular_verbs', ids, count: ids.length * 2, withOptions: 1 });
    } catch (e) {
      console.error(e);
      alert(S.loadError);
      return;
    }
    run = { L, qs, i: 0, mistakes: 0, correct: 0, wrongVerbs: [], t0: Date.now(), answered: false };
    gameEvent(GAME, 'level_start', { level: L.num });
    screen('play');
    root.scrollIntoView({ block: 'start' });
    renderQuestion();
  }

  const play = () => root.querySelector('[data-screen="play"]');

  function renderQuestion() {
    const q = run.qs[run.i];
    const P = play();
    P.querySelector('.vd-progress-text').textContent =
      fmt(S.progress, { n: run.i + 1, total: run.qs.length });
    P.querySelector('.vd-progress-bar > span').style.width = `${(run.i / run.qs.length) * 100}%`;
    renderMistakes();

    const trio = P.querySelector('.vd-trio');
    trio.innerHTML = '';
    const d = q.display;
    const parts = [d.base, d.slots[0].text, d.slots[1].text];
    parts.forEach((txt, k) => {
      if (k > 0) trio.appendChild(el('span', 'vd-arrow', '→'));
      const asked = k === d.askIndex + 1;
      const cell = el('span', 'vd-cell' + (k === 0 ? ' vd-cell--base' : '') + (asked ? ' vd-cell--ask' : ''),
        txt || '___');
      trio.appendChild(cell);
    });

    const fb = P.querySelector('.vd-feedback');
    fb.hidden = true; fb.className = 'vd-feedback'; fb.innerHTML = '';
    const input = P.querySelector('.vd-input');
    input.value = ''; input.readOnly = false; input.classList.remove('is-ok', 'is-bad');
    P.querySelector('.vd-submit').textContent = S.check;
    run.answered = false;
    input.focus({ preventScroll: true });
  }

  function renderMistakes() {
    const m = play().querySelector('.vd-mistakes');
    m.textContent = fmt(S.mistakes, { n: run.mistakes, max: run.L.maxMistakes });
    m.classList.toggle('is-warn', run.mistakes > 0 && run.mistakes >= run.L.maxMistakes);
  }

  function submit() {
    if (!run) return;
    if (run.answered) { advance(); return; }
    const P = play();
    const input = P.querySelector('.vd-input');
    const val = input.value.trim();
    if (!val) { input.focus(); return; }
    const q = run.qs[run.i];
    const ok = isCorrect(q, val);
    run.answered = true;
    input.readOnly = true;
    recordAttempt(q.item, q.form, ok, 'verb_diplom', 'irregular_verbs');
    const fb = P.querySelector('.vd-feedback');
    fb.hidden = false;
    if (ok) {
      run.correct += 1;
      input.classList.add('is-ok');
      fb.classList.add('is-ok');
      fb.textContent = S.correct;
      setTimeout(() => { if (run && run.answered && run.qs[run.i] === q) advance(); }, 650);
    } else {
      run.mistakes += 1;
      if (!run.wrongVerbs.includes(q.item)) run.wrongVerbs.push(q.item);
      input.classList.add('is-bad');
      fb.classList.add('is-bad');
      fb.appendChild(el('div', 'vd-fb-head', `${S.wrong} ${q.answer}`));
      if (q.teach && q.teach.line) fb.appendChild(el('div', 'vd-fb-line', q.teach.line));
      fb.appendChild(el('div', 'vd-fb-yours', `${S.yourAnswer} ${val}`));
      P.querySelector('.vd-submit').textContent = S.next;
      renderMistakes();
      // focus stays in the (read-only) input so the phone keyboard stays
      // open; Enter or the button goes on.
    }
  }

  function advance() {
    const failed = run.mistakes > run.L.maxMistakes;
    run.i += 1;
    if (failed || run.i >= run.qs.length) { finish(!failed); return; }
    renderQuestion();
  }

  function finish(passed) {
    const L = run.L;
    const seconds = Math.round((Date.now() - run.t0) / 1000);
    const answers = run.qs.length;
    gameEvent(GAME, 'level_end', {
      level: L.num, result: passed ? 'won' : 'lost',
      answers: run.i, correct: run.correct, mistakes: run.mistakes, seconds,
    });
    const res = { passed, date: new Date().toISOString(), mistakes: run.mistakes,
      correct: run.correct, answers, verbs: L.verbs, seconds };
    if (passed) {
      const store = loadStore();
      const prev = store[L.key];
      // keep the better result (fewer mistakes, then faster)
      if (!prev || !prev.passed || res.mistakes < prev.mistakes
          || (res.mistakes === prev.mistakes && res.seconds < prev.seconds)) {
        store[L.key] = res; saveStore(store);
      }
      showPass(L, res, true);
    } else {
      showFail(L, run.wrongVerbs.slice());
    }
    run = null;
  }

  function resultActions(L) {
    const row = el('div', 'vd-result-actions');
    const again = el('button', 'k-btn-secondary', S.retry); again.type = 'button';
    again.addEventListener('click', () => startLevel(L));
    const other = el('button', 'k-btn-ghost', S.otherLevel); other.type = 'button';
    other.addEventListener('click', renderChooser);
    row.append(again, other);
    return row;
  }

  function showFail(L, verbs) {
    const box = root.querySelector('[data-screen="result"]');
    box.innerHTML = '';
    box.appendChild(el('h2', 'vd-h2', S.failTitle));
    box.appendChild(el('p', 'vd-result-text', fmt(S.failText, { max: L.maxMistakes })));
    const list = el('ul', 'vd-practice');
    for (const v of verbs) {
      const li = el('li');
      const a = el('a', null, v); a.href = S.practiceHref(v);
      li.appendChild(a); list.appendChild(li);
    }
    box.appendChild(list);
    box.appendChild(resultActions(L));
    screen('result');
    box.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  function showPass(L, res, fresh) {
    const box = root.querySelector('[data-screen="result"]');
    box.innerHTML = '';
    const levelName = S.levels[L.key];
    box.appendChild(el('h2', 'vd-h2', fmt(S.passTitle, { level: levelName })));
    if (fresh) {
      box.appendChild(el('p', 'vd-result-text',
        fmt(S.passText, { correct: res.correct, answers: res.answers, time: fmtTime(res.seconds) })));
    }

    const nameWrap = el('div', 'vd-name');
    const lab = el('label', null, S.nameLabel);
    lab.htmlFor = 'vd-name-input';
    const name = el('input', 'vd-name-input');
    name.id = 'vd-name-input'; name.type = 'text'; name.maxLength = 40;
    name.autocomplete = 'off'; name.setAttribute('autocapitalize', 'words');
    nameWrap.append(lab, name, el('p', 'vd-name-hint', S.nameHint));
    box.appendChild(nameWrap);

    // certificate
    const cert = el('div', `vd-cert vd-cert--${L.key}`);
    const inner = el('div', 'vd-cert-inner');
    const logo = el('div', 'vd-cert-logo');
    logo.innerHTML = '<span>kr</span><img src="/favicon.png?v=2026-11-27" alt=""><span>bsy</span>';
    inner.appendChild(logo);
    inner.appendChild(el('div', 'vd-cert-title', S.certTitle));
    const medal = el('div', 'vd-cert-medal', levelName);
    inner.appendChild(medal);
    inner.appendChild(el('div', 'vd-cert-for', S.certFor));
    const nameLine = el('div', 'vd-cert-name', ' ');
    inner.appendChild(nameLine);
    inner.appendChild(el('p', 'vd-cert-line', fmt(S.certLine, {
      level: levelName, verbs: res.verbs, correct: res.correct, answers: res.answers })));
    const meta = el('div', 'vd-cert-meta');
    meta.appendChild(el('span', null,
      `${S.certDate}: ${new Date(res.date).toLocaleDateString(S.locale)}`));
    meta.appendChild(el('span', null, `${S.certTime}: ${fmtTime(res.seconds)}`));
    inner.appendChild(meta);
    inner.appendChild(el('div', 'vd-cert-url', S.pageUrl));
    cert.appendChild(inner);
    box.appendChild(cert);

    name.addEventListener('input', () => {
      nameLine.textContent = name.value.trim() || ' ';
    });

    const printBtn = el('button', 'k-btn-primary vd-print', S.print); printBtn.type = 'button';
    printBtn.addEventListener('click', () => {
      gameEvent(GAME, 'certificate_print', { level: L.num });
      window.print();
    });
    box.appendChild(printBtn);
    box.appendChild(resultActions(L));
    screen('result');
    box.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  /* static play-screen wiring */
  const P = play();
  P.querySelector('.vd-input').placeholder = S.placeholder;
  P.querySelector('.vd-form').addEventListener('submit', (e) => { e.preventDefault(); submit(); });
  const quit = P.querySelector('.vd-quit');
  quit.textContent = S.quit;
  quit.addEventListener('click', () => {
    if (confirm(S.quitConfirm)) { run = null; renderChooser(); }
  });

  renderChooser();
}
