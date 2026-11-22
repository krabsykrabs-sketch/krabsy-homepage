// The teacher's question list: see every question, remove one, swap it for another from
// the same topic and difficulty, add more, or mix a new list. A verb's 2nd and 3rd form
// are one unit (one row), so the chain order rule always holds.
import { t } from './i18n.js';
import { esc, questionHTML } from './ui.js';
import * as QS from './questions.js';

const key = (u) => `${u[0].topic}|${u[0].item}`;
const len = (units) => units.reduce((n, u) => n + u.length, 0);

export class QuestionEditor {
  constructor(el, { onChange = () => {} } = {}) {
    this.el = el;
    this.onChange = onChange;
    this.pool = [];          // all units for the current topic + difficulty, in random order
    this.units = [];         // the chosen list
    this.bonus = [];         // the bonus round: single questions (a verb's 2nd form only)
    this.bonusCount = 3;
    this.showAnswers = true;
    this.loading = false;
    this.sig = '';
  }

  get questions() { return this.units.flat(); }
  get bonusQuestions() { return this.bonus.flat(); }
  get count() { return len(this.units); }

  // (Re)load the pool when topic or difficulty changed; then fill up to `count`.
  async load(topic, levels, count, { fresh = false } = {}) {
    const sig = `${topic}|${levels.join(',')}`;
    if (fresh || sig !== this.sig) {
      this.loading = true; this.render();
      this.pool = await QS.loadUnits(topic, levels);
      this.sig = sig;
      this.units = []; this.bonus = [];
      this.loading = false;
    }
    this.fit(count);
    this.fitBonus(this.bonusCount);
  }

  // Load the pool only (keeps the current list), e.g. after the teacher page reloaded.
  async loadPool(topic, levels) {
    this.pool = await QS.loadUnits(topic, levels);
    this.sig = `${topic}|${levels.join(',')}`;
    this.render();
  }

  // Start from an existing list (lobby edit after a reload, or the server's copy).
  setQuestions(qs) {
    const units = [];
    this.bonus = qs.filter((q) => q.bonus).map((q) => [q]);
    for (const q of qs.filter((x) => !x.bonus)) {
      const last = units[units.length - 1];
      if (q.followUp && last && last.length === 1 && last[0].item === q.item) last.push(q);
      else units.push([q]);
    }
    this.units = units;
    this.render();
  }

  unused() {
    const used = new Set([...this.units, ...this.bonus].map(key));
    return this.pool.filter((u) => !used.has(key(u)));
  }

  // Grow or shrink to `count` questions, keeping the teacher's edits at the front.
  fit(count) {
    while (this.count > count) {
      const last = this.units[this.units.length - 1];
      if (last.length === 2 && this.count - 1 >= count) this.units[this.units.length - 1] = QS.single(last);
      else this.units.pop();
      if (this.count < count) break;
    }
    const free = this.unused();
    while (this.count < count && free.length) {
      let u = free.shift();
      if (this.count + u.length > count) u = QS.single(u);
      this.units.push(u);
    }
    this.changed();
  }

  fitBonus(n) {
    this.bonusCount = n;
    while (this.bonus.length > n) this.bonus.pop();
    const free = this.unused();
    while (this.bonus.length < n && free.length) this.bonus.push(QS.single(free.shift()));
    this.changed();
  }

  swapBonus(i) {
    const free = this.unused();
    if (free.length) { this.bonus[i] = QS.single(free[0]); this.changed(); }
  }

  removeBonus(i) { this.bonus.splice(i, 1); this.changed(); }

  swap(i) {
    const free = this.unused();
    if (!free.length) return;
    let u = free[0];
    if (this.units[i].length === 1 && u.length === 2) u = QS.single(u);   // keep the count
    this.units[i] = u;
    this.changed();
  }

  remove(i) { this.units.splice(i, 1); this.changed(); }

  add() {
    const free = this.unused();
    if (free.length) { this.units.push(free[0]); this.changed(); }
  }

  changed() { this.render(); this.onChange(this.count); }

  render() {
    const el = this.el;
    if (this.loading) { el.innerHTML = `<div class="edHead">…</div>`; return; }
    let n = 1;
    const rows = this.units.map((u, i) => {
      const nums = u.length === 2 ? `${n}–${n + 1}` : `${n}`;
      n += u.length;
      const lines = u.map((q0) => {
        let q = q0;
        const answer = this.showAnswers ? q.options[q.correct] : null;
        // Hidden answers: the 3rd-form line must not show the 2nd form either.
        if (!this.showAnswers && q.followUp) q = { ...q, slots: q.slots.map((x) => (x == null ? x : '•••')) };
        const opts = q.options.map((o, k) => `<span class="${this.showAnswers && k === q.correct ? 'ok' : ''}">${esc(o)}</span>`).join('');
        return `<div class="edLine"><span class="qline">${questionHTML(q, answer)}</span><span class="opts">${opts}</span></div>`;
      }).join('');
      return `<div class="edRow" data-i="${i}"><span class="num">${nums}</span><div class="lines">${lines}</div>
        <button class="swap" title="${esc(t('swap'))}">⟳</button><button class="rm" title="${esc(t('removeQ'))}">✕</button></div>`;
    }).join('');
    const bonusRows = this.bonus.map((u, i) => {
      const q = u[0];
      const opts = q.options.map((o, k) => `<span class="${this.showAnswers && k === q.correct ? 'ok' : ''}">${esc(o)}</span>`).join('');
      return `<div class="edRow bonus" data-b="${i}"><span class="num">★${i + 1}</span><div class="lines"><div class="edLine">
        <span class="qline">${questionHTML(q, this.showAnswers ? q.options[q.correct] : null)}</span><span class="opts">${opts}</span></div></div>
        <button class="swap" title="${esc(t('swap'))}">⟳</button><button class="rm" title="${esc(t('removeQ'))}">✕</button></div>`;
    }).join('');
    const bonusPart = this.bonus.length ? `<div class="edSub">★ ${esc(t('bonusSection'))}</div>${bonusRows}` : '';
    el.innerHTML = `<div class="edHead"><b>${esc(t('nQuestions', this.count))}</b>
        <label><input type="checkbox" class="showA" ${this.showAnswers ? 'checked' : ''}> ${esc(t('showAnswers'))}</label>
        <span class="sp"></span>
        <button class="opt add">+ ${esc(t('addQ'))}</button><button class="opt mix">⟳ ${esc(t('newMix'))}</button></div>
      <div class="edList">${rows || `<p>${esc(t('noQuestions'))}</p>`}${bonusPart}</div>`;
    el.querySelector('.showA').addEventListener('change', (e) => { this.showAnswers = e.target.checked; this.render(); });
    el.querySelector('.add').addEventListener('click', () => this.add());
    el.querySelector('.add').disabled = !this.unused().length;
    el.querySelector('.mix').addEventListener('click', () => this.onMix?.());
    el.querySelectorAll('.edRow.bonus').forEach((r) => {
      const i = +r.dataset.b;
      r.querySelector('.swap').addEventListener('click', () => this.swapBonus(i));
      r.querySelector('.rm').addEventListener('click', () => this.removeBonus(i));
    });
    el.querySelectorAll('.edRow:not(.bonus)').forEach((r) => {
      const i = +r.dataset.i;
      r.querySelector('.swap').addEventListener('click', () => this.swap(i));
      r.querySelector('.rm').addEventListener('click', () => this.remove(i));
    });
  }
}
