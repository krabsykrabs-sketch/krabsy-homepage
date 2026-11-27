// Answer cards: one per player, shown near that player's character, with choice chips.
// Keyboard: player 1 A/D (or W/S) to pick + E, player 2 ←/→ + Enter; digits 1–3 for
// player 1; tap or click works for both. Questions never use grammar terms: verbs show
// `go → ___ → ___` with the asked blank highlighted, sentences show their gap.
import { t } from './i18n.js';
import { revealText } from './questions.js';
import { sfx } from './sound.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function questionHtml(q) {
  const d = q.display;
  if (d.kind === 'trio') {
    const slot = (i) => {
      const s = d.slots[i];
      if (i === d.askIndex) return '<span class="blank ask">___</span>';
      if (s && s.text != null) return `<span class="known">${esc(s.text)}</span>`;
      return '<span class="blank">___</span>';
    };
    return `<span class="trio"><span class="known">${esc(d.base)}</span><span class="arrow">→</span>${slot(0)}<span class="arrow">→</span>${slot(1)}</span>`;
  }
  const sentence = d.sentence || d.plain || '';
  const parts = esc(sentence).split(/_{2,}/);
  const html = parts.length > 1 ? parts[0] + '<span class="blank ask">___</span>' + parts.slice(1).join('___') : esc(sentence);
  return `<span class="gap${sentence.length > 46 ? ' long' : ''}">${html}</span>`;
}

export function createCards(root, input, keyHints) {
  const cards = [0, 1].map((pi) => {
    const el = document.createElement('div');
    el.className = `card p${pi + 1}`;
    el.hidden = true;
    el.setAttribute('role', 'dialog');
    el.innerHTML = `<div class="card-head"><span class="dot"></span><span class="who"></span><span class="what"></span></div>
      <div class="card-q"></div><div class="chips"></div><div class="card-foot"></div>`;
    root.appendChild(el);
    return { pi, el, open: false, q: null, sel: 0, done: null, locked: false, timer: 0 };
  });

  function render(c) {
    const { el, q } = c;
    el.querySelector('.card-q').innerHTML = questionHtml(q);
    const chips = el.querySelector('.chips');
    chips.innerHTML = '';
    q.options.forEach((opt, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip' + (i === c.sel ? ' sel' : '');
      b.textContent = opt;
      b.tabIndex = -1;
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (!c.locked) { c.sel = i; choose(c); } });
      chips.appendChild(b);
    });
    el.querySelector('.card-foot').textContent = keyHints[c.pi];
    el.classList.remove('right', 'wrong');
  }

  function highlight(c) {
    c.el.querySelectorAll('.chip').forEach((b, i) => b.classList.toggle('sel', i === c.sel));
  }

  function close(c, result) {
    c.open = false; c.locked = false;
    c.el.hidden = true;
    clearTimeout(c.timer);
    const done = c.done; c.done = null;
    done?.(result);
  }

  function choose(c) {
    if (!c.open || c.locked) return;
    const q = c.q;
    const correct = c.sel === q.correctIndex;
    c.locked = true;
    c.lockedAt = Date.now();
    const chips = c.el.querySelectorAll('.chip');
    chips.forEach((b, i) => {
      b.classList.toggle('is-right', i === q.correctIndex);
      b.classList.toggle('is-wrong', i === c.sel && !correct);
      b.disabled = true;
    });
    const foot = c.el.querySelector('.card-foot');
    c.result = correct;
    c.onAnswer?.(correct);
    if (correct) {
      sfx('right');
      c.el.classList.add('right');
      foot.innerHTML = `<b>${esc(t('right'))}</b>`;
      c.timer = setTimeout(() => close(c, true), 750);
    } else {
      sfx('wrong');
      c.el.classList.add('wrong');
      const line = revealText(q);
      const teach = q.display.kind === 'gap' && q.teach?.line ? `<span class="teach">${esc(q.teach.line)}</span>` : '';
      foot.innerHTML = `<b>${esc(t('wrong'))}</b> <span class="reveal">${esc(line)}</span>${teach}<span class="again">${esc(t('tryAgain'))}</span>`;
      c.timer = setTimeout(() => close(c, false), 3200);
    }
  }

  input.onPress((pi, b) => {
    const c = cards[pi];
    if (!c.open) return;
    if (c.locked) {   // a press after a wrong answer closes the card early
      if (b === 'action' && c.result === false && Date.now() - c.lockedAt > 700) close(c, false);
      return;
    }
    const n = c.q.options.length;
    if (b === 'left' || b === 'up') { c.sel = (c.sel + n - 1) % n; sfx('select'); highlight(c); }
    else if (b === 'right' || b === 'down') { c.sel = (c.sel + 1) % n; sfx('select'); highlight(c); }
    else if (b === 'action') choose(c);
  });
  window.addEventListener('keydown', (e) => {
    const c = cards[0];
    if (!c.open || c.locked) return;
    const k = { Digit1: 0, Digit2: 1, Digit3: 2 }[e.code];
    if (k !== undefined && k < c.q.options.length) { c.sel = k; choose(c); }
  });

  return {
    isOpen: (pi) => cards[pi].open,
    /** Open a card for player pi. onAnswer(correct) right away, done(correct) once it closes. */
    open(pi, q, { who, what, onAnswer, done }) {
      const c = cards[pi];
      c.q = q; c.sel = 0; c.open = true; c.locked = false; c.done = done; c.onAnswer = onAnswer;
      c.el.querySelector('.who').textContent = who;
      c.el.querySelector('.what').textContent = what || '';
      render(c);
      c.el.hidden = false;
      sfx('card');
    },
    closeAll() { cards.forEach((c) => { if (c.open) { c.done = null; close(c, false); } }); },
    /** Place card pi with its lower middle at screen point (x, y), kept on screen. */
    place(positions) {
      const vw = window.innerWidth, vh = window.innerHeight;
      const rects = cards.map((c, i) => {
        if (!c.open || !positions[i]) return null;
        const w = c.el.offsetWidth, h = c.el.offsetHeight;
        let x = positions[i].x - w / 2, y = positions[i].y - h - 14;
        if (y < 56) {   // no room above the head: beside the player, never over them
          y = positions[i].y - 10;
          x = positions[i].x + 34;
          if (x + w > vw - 8) x = positions[i].x - 34 - w;
        }
        return { c, x, y, w, h };
      });
      const [a, b] = rects;
      if (a && b && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) {
        // overlap: push apart sideways around their middle
        const left = a.x <= b.x ? a : b, right = left === a ? b : a;
        const mid = (left.x + left.w + right.x) / 2;
        left.x = mid - left.w - 6; right.x = mid + 6;
      }
      for (const r of rects) {
        if (!r) continue;
        r.x = Math.max(8, Math.min(vw - r.w - 8, r.x));
        r.y = Math.max(8, Math.min(vh - r.h - 8, r.y));
        r.c.el.style.transform = `translate(${Math.round(r.x)}px, ${Math.round(r.y)}px)`;
      }
    },
    // tests: { options, correctIndex } of an open card
    peek(pi) { const c = cards[pi]; return c.open && !c.locked ? { options: c.q.options, correctIndex: c.q.correctIndex, q: c.q } : null; },
  };
}
