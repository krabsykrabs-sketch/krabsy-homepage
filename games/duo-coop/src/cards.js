// Answer cards: one per player, shown near that player's character, with choice chips.
// Keyboard: quick answer with 1 2 3 (player 1) or 8 9 0 (player 2); picking with the
// move keys + E / Enter works too; tap or click works for both. Questions never use grammar
// terms: verbs show three boxes `go → ? → …` (the asked one amber with "?", small captions
// today / yesterday / already so it is clear which form is meant; owner 2026-11-27),
// sentences show their gap. The chips always stay in one row.
import { t } from './i18n.js';
import { revealText } from './questions.js';
import { sfx } from './sound.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function questionHtml(q) {
  const d = q.display;
  if (d.kind === 'trio') {
    const box = (cls, word, caption) => `<span class="slot ${cls}"><b>${word}</b><small>${esc(caption)}</small></span>`;
    const slot = (i) => {
      const s = d.slots[i];
      if (i === d.askIndex) return box('ask', '?', t(`slot.${i + 1}`));
      if (s && s.text != null) return box('known', esc(s.text), t(`slot.${i + 1}`));
      return box('later', '…', t(`slot.${i + 1}`));
    };
    // long verbs get smaller text instead of being cut ("unders…", owner 2026-11-28)
    const longest = Math.max(String(d.base).length, ...d.slots.map((x) => (x && x.text != null ? String(x.text).length : 1)));
    const len = longest > 12 ? ' len-xxl' : longest > 10 ? ' len-xl' : longest > 7 ? ' len-l' : '';
    return `<span class="trio${len}">${box('known', esc(d.base), t('slot.0'))}<span class="arrow">→</span>${slot(0)}<span class="arrow">→</span>${slot(1)}</span>`;
  }
  const sentence = d.sentence || d.plain || '';
  const parts = esc(sentence).split(/_{2,}/);
  const html = parts.length > 1 ? parts[0] + '<span class="blank ask">___</span>' + parts.slice(1).join('___') : esc(sentence);
  return `<span class="gap${sentence.length > 46 ? ' long' : ''}">${html}</span>`;
}

export const ANSWER_KEYS = [['Digit1', 'Digit2', 'Digit3'], ['Digit8', 'Digit9', 'Digit0']];
const keyLabel = (code) => code.replace('Digit', '');

// digits: show the answer key on each chip (keyboard); false on touch screens.
export function createCards(root, input, keyHints, digits = true) {
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
      const word = document.createElement('span');
      word.className = 'word';
      word.textContent = opt;
      b.appendChild(word);
      const k = ANSWER_KEYS[c.pi][i];
      if (digits && k) { const s = document.createElement('kbd'); s.textContent = keyLabel(k); b.prepend(s); }
      b.tabIndex = -1;
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (!c.locked) { c.sel = i; choose(c); } });
      chips.appendChild(b);
    });
    // long answers get smaller text instead of a second row
    const longest = Math.max(...q.options.map((o) => String(o).length));
    chips.dataset.len = longest > 13 ? 'xxl' : longest > 10 ? 'xl' : longest > 6 ? 'l' : '';
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
    if (e.repeat || document.body.dataset.state !== 'playing') return;
    for (const c of cards) {
      const k = ANSWER_KEYS[c.pi].indexOf(e.code);
      if (k < 0) continue;
      e.preventDefault();
      if (c.open && !c.locked && k < c.q.options.length) { c.sel = k; choose(c); }
    }
  });

  return {
    isOpen: (pi) => cards[pi].open,
    /** Open a card for player pi. onAnswer(correct) right away, done(correct) once it closes. */
    open(pi, q, { who, what, onAnswer, done }) {
      const c = cards[pi];
      c.q = q; c.sel = 0; c.open = true; c.locked = false; c.done = done; c.onAnswer = onAnswer; c.pos = null;
      c.el.querySelector('.who').textContent = who;
      c.el.querySelector('.what').textContent = what || '';
      render(c);
      c.el.hidden = false;
      sfx('card');
    },
    closeAll() { cards.forEach((c) => { if (c.open) { c.done = null; close(c, false); } }); },
    /** Place card pi with its lower middle at screen point (x, y), kept on screen. */
    // Each card is placed once, when it opens, and then stays put (a card that slides with the
    // camera is hard to tap); a second card is kept clear of the first.
    place(positions) {
      const vw = window.innerWidth, vh = window.innerHeight, M = 8;
      const fits = (r) => r.x >= M && r.y >= M && r.x + r.w <= vw - M && r.y + r.h <= vh - M;
      const hits = (a, b) => a.x < b.x + b.w + 6 && b.x < a.x + a.w + 6 && a.y < b.y + b.h + 6 && b.y < a.y + a.h + 6;
      const clamp = (r) => ({ ...r, x: Math.max(M, Math.min(vw - r.w - M, r.x)), y: Math.max(M, Math.min(vh - r.h - M, r.y)) });
      for (const c of cards) {
        if (!c.open) { c.pos = null; continue; }
        if (c.pos || !positions[c.pi]) continue;
        const p = positions[c.pi];
        const w = c.el.offsetWidth, h = c.el.offsetHeight;
        // where it would like to be: above the head, else beside the player
        const want = [
          { x: p.x - w / 2, y: p.y - h - 14 },
          { x: p.x + 34, y: p.y - 10 },
          { x: p.x - 34 - w, y: p.y - 10 },
        ].map((r) => ({ ...r, w, h }));
        const other = cards.find((o) => o !== c && o.open && o.pos)?.pos;
        if (other) {   // never on top of the other player's card: beside, above or below it
          const g = 10;
          want.push(
            { x: other.x + other.w + g, y: other.y, w, h }, { x: other.x - w - g, y: other.y, w, h },
            { x: other.x, y: other.y - h - g, w, h }, { x: other.x, y: other.y + other.h + g, w, h },
          );
        }
        let pick = want.find((r) => fits(r) && !(other && hits(r, other)));
        if (!pick) pick = want.map(clamp).find((r) => !(other && hits(r, other)));
        if (!pick) {   // tiny screen: the two cards side by side across the screen
          pick = clamp({ x: other && other.x > vw / 2 ? M : vw - w - M, y: M, w, h });
        }
        c.pos = pick;
        c.el.style.transform = `translate(${Math.round(pick.x)}px, ${Math.round(pick.y)}px)`;
      }
    },
    replace() { cards.forEach((c) => { c.pos = null; }); },   // after a resize
    // tests: { options, correctIndex } of an open card
    peek(pi) { const c = cards[pi]; return c.open && !c.locked ? { options: c.q.options, correctIndex: c.q.correctIndex, q: c.q } : null; },
  };
}
