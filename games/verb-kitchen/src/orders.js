// Order tickets: spawn, patience decay, serve matching, expiry.
import { DISHES, ITEMS } from './recipes.js';
import { pickDish } from './levels.js';
import { audio } from './audio.js';
import { rng } from './verbs.js';

let nextId = 1;

export class Orders {
  constructor(level, callbacks = {}) {
    this.level = level;
    this.cb = callbacks;            // { onExpire(ticket) }
    this.tickets = [];
    this.tNext = 2.5;               // first ticket lands quickly
    this.spawningEnabled = true;
    this.bar = document.getElementById('tickets');
    this.bar.innerHTML = '';
  }

  spawn(dishId = null) {
    if (this.tickets.length >= 3) return null;
    const dish = dishId || pickDish(this.level, rng.next);
    const d = DISHES[dish];
    const t = {
      id: nextId++, dish,
      patience: this.level.patience, max: this.level.patience,
      el: null,
    };
    const el = document.createElement('div');
    el.className = 'ticket';
    const ings = d.icons || d.parts.map((p) => ITEMS[p].emoji).join(' ');
    el.innerHTML = `<div class="dish">${d.emoji}</div><div class="dn">${d.name}</div>` +
      `<div class="ings">${ings}</div><div class="pbar"><div class="pfill" style="width:100%"></div></div>`;
    this.bar.appendChild(el);
    t.el = el;
    this.tickets.push(t);
    audio.tick();
    return t;
  }

  update(dt, patienceScale = 1) {
    if (this.spawningEnabled) {
      this.tNext -= dt;
      if (this.tNext <= 0 && this.tickets.length < 3) {
        this.spawn();
        const [a, b] = this.level.spawnEvery;
        this.tNext = a + rng.next() * (b - a);
      }
    }
    for (const t of [...this.tickets]) {
      t.patience -= dt * patienceScale;
      const frac = Math.max(0, t.patience / t.max);
      const fill = t.el.querySelector('.pfill');
      fill.style.width = (frac * 100) + '%';
      t.el.classList.toggle('warn', frac < 0.5 && frac >= 0.25);
      t.el.classList.toggle('hurry', frac < 0.25);
      if (t.patience <= 0) {
        this.remove(t, 'gone');
        audio.trombone();
        if (this.cb.onExpire) this.cb.onExpire(t);
      }
    }
  }

  /** Serve a dish: match most-urgent ticket (any order is allowed).
   *  inOrder = true when it was the oldest open ticket → streak bonus. */
  serve(dishId) {
    const matches = this.tickets.filter((t) => t.dish === dishId);
    if (!matches.length) return null;
    matches.sort((a, b) => a.patience - b.patience);
    const t = matches[0];
    const inOrder = t === this.tickets[0];
    const tipFrac = Math.max(0, t.patience / t.max);
    this.remove(t, 'servedAnim');
    return { ticket: t, tipFrac, inOrder };
  }

  remove(t, animClass) {
    this.tickets = this.tickets.filter((x) => x !== t);
    t.el.classList.add(animClass);
    setTimeout(() => t.el.remove(), 600);
  }

  clear() {
    for (const t of this.tickets) t.el.remove();
    this.tickets = [];
  }
}
