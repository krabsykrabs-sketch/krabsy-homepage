// Small UI helpers shared by the child and teacher pages.
export const $ = (id) => document.getElementById(id);
export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const LETTERS = ['A', 'B', 'C', 'D'];
const ARROW = '<span class="arrow">→</span>';

// The question line: `go → ___ → ___` (asked blank highlighted) or the sentence gap.
// `answer` (string) fills the asked blank after the reveal.
export function questionHTML(q, answer = null) {
  if (q.kind === 'trio') {
    const slot = (k) => {
      const given = q.slots[k];
      if (given != null) return `<span class="slot">${esc(given)}</span>`;
      if (k === q.askIndex) return `<span class="slot ask${answer ? ' filled' : ''}">${answer ? esc(answer) : '&nbsp;'}</span>`;
      return '<span class="slot">&nbsp;</span>';
    };
    return `<span>${esc(q.base)}</span>${ARROW}${slot(0)}${ARROW}${slot(1)}`;
  }
  const gap = `<span class="gap${answer ? ' filled' : ''}">${answer ? esc(answer) : '&nbsp;'}</span>`;
  return esc(q.sentence).split('___').join(gap);
}

// The teach beat: a verb chain in colour (only when it adds to the filled-in question),
// or the preposition rule.
export function teachHTML(q, teach) {
  if (!teach) return '';
  if (q.kind === 'trio') {
    if (teach.includes('___') || q.askIndex === 1) return '';
    return teach.split(' → ').map((w, i) => `<span class="${['base', 'past', 'pp'][i]}">${esc(w)}</span>`).join(ARROW);
  }
  return esc(teach);
}

// One line for the review list: the full chain, or the sentence with the answer.
export function reviewHTML(q) {
  if (q.kind === 'trio') {
    const c = q.chain || { base: q.base, past: q.askIndex === 0 ? q.options[q.correct] : q.slots[0], pp: q.askIndex === 1 ? q.options[q.correct] : '…' };
    return `<span class="base">${esc(c.base)}</span>${ARROW}<span class="past">${esc(c.past)}</span>${ARROW}<span class="pp">${esc(c.pp)}</span>`;
  }
  return esc(q.sentence).split('___').join(`<span class="past">${esc(q.options[q.correct])}</span>`);
}

export function applyTexts(t) {
  document.querySelectorAll('[data-t]').forEach((e) => { e.textContent = t(e.dataset.t); });
}
