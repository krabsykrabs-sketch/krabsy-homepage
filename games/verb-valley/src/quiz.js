// The question panel: one DOM card used by every station (school, well,
// sell crate). Big tappable chips (touch-ready) plus keys 1–3.
//
// Presentation mandate: no grammar terms. Verbs show as
//   go → [___] → ___      (asked blank highlighted in its form colour)
// sentence topics as a gap sentence. After a wrong answer Professor Krabsy
// shows the teach line (the full chain, or "go → went → ___" when the next
// step asks the 3rd form).
//
// ask(unit, opts) → Promise<{ correct, total, results[] }>
//   opts.title     header line (station name)
//   opts.reward    (stepIndex) → short text shown on a right answer
//   opts.onStep    (stepIndex, correct) → called after each answer
//   opts.onShow    (step) → mirror hook (the 3D blackboard)

import { sfx } from './audio.js';
import { t } from './i18n.js';

const FORM_COL = ['var(--teal)', 'var(--coral)'];   // 2nd form teal, 3rd coral
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let el = null;
let current = null;   // { unit, i, results, resolve, opts, locked, timer }

function build() {
  el = document.createElement('div');
  el.id = 'quiz-panel';
  el.hidden = true;
  el.innerHTML = `
    <div class="qz-head"><span class="qz-crab">🦀</span><span class="qz-title"></span><span class="qz-prog"></span></div>
    <div class="qz-prompt"></div>
    <div class="qz-chips"></div>
    <div class="qz-feedback"></div>`;
  document.body.appendChild(el);
}

// One slot of the trio: filled word, the asked blank, or a quiet blank.
function slotHTML(text, idx, askIndex) {
  if (text) return `<span class="qz-w" style="color:${FORM_COL[idx]}">${esc(text)}</span>`;
  if (idx === askIndex) return `<span class="qz-blank ask" style="border-color:${FORM_COL[idx]}">?</span>`;
  return '<span class="qz-blank">___</span>';
}

export function promptHTML(d) {
  if (d.kind === 'trio') {
    return `<span class="qz-w" style="color:var(--amber)">${esc(d.base)}</span>
      <span class="qz-arrow">→</span>${slotHTML(d.slots[0], 0, d.askIndex)}
      <span class="qz-arrow">→</span>${slotHTML(d.slots[1], 1, d.askIndex)}`;
  }
  return esc(d.sentence).replace('___', '<span class="qz-blank ask" style="border-color:var(--amber)">?</span>');
}

// Colour a teach line "go → went → gone" by position.
function teachHTML(line) {
  const parts = line.split(' → ');
  if (parts.length !== 3) return esc(line);
  const col = ['var(--amber)', 'var(--teal)', 'var(--coral)'];
  return parts.map((p, i) => `<b style="color:${col[i]}">${esc(p)}</b>`).join(' <span class="qz-arrow">→</span> ');
}

function showStep() {
  const { unit, i, opts } = current;
  const step = unit.steps[i];
  el.querySelector('.qz-title').textContent = opts.title || '';
  const total = unit.steps.length;
  el.querySelector('.qz-prog').textContent = (opts.progress ?? '') + (total > 1 ? ` ${'●'.repeat(i + 1)}${'○'.repeat(total - i - 1)}` : '');
  el.querySelector('.qz-prompt').innerHTML = promptHTML(step.display);
  el.querySelector('.qz-feedback').innerHTML = unit.isReview && i === 0 ? `<span class="qz-review">${t('againBefore')}</span>` : '';
  const chips = el.querySelector('.qz-chips');
  chips.innerHTML = '';
  const col = step.display.kind === 'trio' ? FORM_COL[step.display.askIndex] : 'var(--amber)';
  step.options.forEach((o, k) => {
    const b = document.createElement('button');
    b.className = 'qz-chip';
    b.style.setProperty('--c', col);
    b.innerHTML = `<small>${k + 1}</small>${esc(o)}`;
    b.onclick = (e) => { e.stopPropagation(); answer(k); };
    chips.appendChild(b);
  });
  current.locked = false;
  current.shownAt = performance.now();
  opts.onShow?.(step, i);
}

// Answers in the first moments after a question appears are ignored: on a
// touch screen the tap that opened the panel (✋ button) could otherwise
// land on the chip that just appeared under the finger. QA passes force.
const GUARD_MS = 350;
export function answer(k, force = false) {
  if (!current || current.locked) return { ok: false };
  if (!force && performance.now() - current.shownAt < GUARD_MS) return { ok: false, reason: 'too-soon' };
  const { unit, i, opts } = current;
  const step = unit.steps[i];
  if (k < 0 || k >= step.options.length) return { ok: false };
  current.locked = true;
  const correct = step.options[k] === step.answer;
  current.results.push(correct);
  const chips = [...el.querySelectorAll('.qz-chip')];
  chips[k].classList.add(correct ? 'right' : 'wrong');
  if (!correct) chips[step.options.indexOf(step.answer)]?.classList.add('right');
  // fill the blank with the right word
  const d = step.display;
  const filled = d.kind === 'trio'
    ? { ...d, slots: d.slots.map((s, idx) => (idx === d.askIndex ? step.answer : s)) }
    : { ...d, sentence: d.sentence.replace('___', step.answer) };
  el.querySelector('.qz-prompt').innerHTML = promptHTML(filled);
  const fb = el.querySelector('.qz-feedback');
  if (correct) {
    sfx.correct();
    fb.innerHTML = `<span class="qz-ok">✓ ${esc(opts.reward?.(i) ?? t('right'))}</span>`;
  } else {
    sfx.wrong();
    const line = d.kind === 'gap'
      ? esc(step.teach).replace('___', `<b style="color:var(--amber)">${esc(step.answer)}</b>`)
      : teachHTML(step.teach);
    fb.innerHTML = `<span class="qz-no">${t('krabsySays')}</span> ${line}`;
  }
  opts.onStep?.(i, correct);
  current.timer = setTimeout(next, correct ? 750 : 2300);
  return { ok: true, correct };
}

function next() {
  if (!current) return;
  current.i++;
  if (current.i < current.unit.steps.length) { showStep(); return; }
  const { results, resolve } = current;
  current = null;
  el.hidden = true;
  resolve({ correct: results.filter(Boolean).length, total: results.length, results });
}

export function ask(unit, opts = {}) {
  if (!el) build();
  if (current) return Promise.resolve({ correct: 0, total: 0, results: [], busy: true });
  el.hidden = false;
  return new Promise((resolve) => {
    current = { unit, i: 0, results: [], resolve, opts, locked: false, timer: 0 };
    showStep();
  });
}

// QA: skip the feedback pause.
export function flush() {
  if (current?.locked) { clearTimeout(current.timer); next(); }
}

export const isOpen = () => !!current;
export const currentStep = () => (current ? current.unit.steps[current.i] : null);
