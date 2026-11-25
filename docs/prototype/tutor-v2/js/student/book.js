// Book reader: La granja. Page turns (buttons, swipe, arrow keys), tappable words with a
// picture card, one check question inside the book, and an end gallery.
import { BOOK, word, state, shuffle } from '../data.js';
import { esc, speak, reducedMotion } from '../ui.js';

const parse = es => es.replace(/\{([^}]+)\}([.,;:!?]*)/g, (_, body, punct) => {
  const [shown, full, en, pic, id = ''] = body.split('|');
  return `<button class="bk-w" data-full="${esc(full)}" data-en="${esc(en)}" data-pic="${pic}" data-id="${id}">${esc(shown)}</button>`.replace(/^/, '<span class="nw">') + punct + '</span>';
});

export function mountBook(root, opts = {}) {
  const pages = BOOK.pages; const storyNo = i => pages.slice(0, i + 1).filter(p => p.es).length; const storyTotal = pages.filter(p => p.es).length;
  const S = { i: 0, en: false, tapped: new Set(), checkOk: false, endStep: 0, locked: !!opts.locked, busy: false };
  root.innerHTML = `<div class="bk">
    <header class="bk-top">${opts.onExit ? '<button class="bk-x" data-exit aria-label="Close the book">✕</button>' : ''}<b>${esc(BOOK.title)}</b>
      <button class="bk-en-btn" data-toggle-en aria-pressed="false">Show in English</button></header>
    <div class="bk-stage"><div class="bk-spread" data-spread></div></div>
    <footer class="bk-nav"><button class="bk-arrow" data-prev aria-label="Page back">◀</button>
      <div class="bk-dots" data-dots></div><span class="bk-pageno" data-no></span>
      <button class="bk-arrow" data-next aria-label="Next page">▶</button></footer>
    <div class="bk-card" data-card hidden></div>
  </div>`;
  const bk = root.firstElementChild, q = s => bk.querySelector(s), spread = q('[data-spread]');
  const emit = extra => opts.onState && opts.onState({ page: S.i, pages: pages.length, label: pages[S.i].check ? 'Check question' : pages[S.i].end ? 'Last page' : `Page ${storyNo(S.i)} of ${storyTotal}`, tapped: [...S.tapped], ...extra });

  const tiles = (c, key) => `<div class="bk-tiles" data-check="${key}">${c.options.map(o => `<button class="kp-tile" data-w="${o}"><span class="pic">${word(o).pic}</span><span class="mk"></span></button>`).join('')}</div>`;

  function pageHTML(p) {
    if (p.check) {
      const c = BOOK.check;
      return `<div class="bk-pic scene-check"><span class="bk-bigcrab">🦀</span><span class="bk-bubble">¡Una pregunta!</span></div>
        <div class="bk-text"><p class="bk-q">${esc(c.q)}</p><p class="bk-en" ${S.en ? '' : 'hidden'}>${esc(c.en)}</p>${tiles(c, 'mid')}
        <p class="bk-fb" data-fb>${S.checkOk ? `✓ ${esc(c.teach)}` : 'Tap the right picture.'}</p></div>`;
    }
    if (p.end) return endHTML();
    return `<div class="bk-pic scene-${p.scene}">${p.cast.map(([e, x, y, s], k) => `<span class="bk-fig" style="left:${x}%;top:${y}%;--s:${s};--d:${k}">${e}</span>`).join('')}</div>
      <div class="bk-text"><p class="bk-es">${parse(p.es)}</p><p class="bk-en" ${S.en ? '' : 'hidden'}>${esc(p.en)}</p>
      ${S.i === 0 ? '<p class="bk-crab"><span>🦀</span> Tap the dotted words!</p>' : ''}</div>`;
  }
  function endHTML() {
    const c = BOOK.endChecks[S.endStep];
    return `<div class="bk-pic scene-gallery"><h3>Words you met</h3><div class="bk-gallery">${BOOK.words.map(id => { const w = word(id); return `<button class="bk-g ${S.tapped.has(id) || state.album[id] ? 'met' : ''}" data-say="${esc(w.full)}"><i>${w.pic}</i><b>${esc(w.full)}</b></button>`; }).join('')}</div></div>
      <div class="bk-text bk-endtext">${c ? `<p class="bk-small">Three quick questions · ${S.endStep + 1} of 3</p><p class="bk-q">${esc(c.q)}</p>${tiles(c, 'end')}<p class="bk-fb" data-fb>Tap the right picture.</p>`
        : `<div class="bk-fin"><span class="bk-stamp">¡Leído!</span><h3>¡Fin!</h3>
           <div class="bk-sayit"><b>🗣 Say it to your tutor</b><p>¿Cuál es tu animal favorito? Tell ${esc(opts.tutor || 'Nora')} in your next lesson.</p></div>
           ${opts.onExit ? '<button class="kp-btn" data-finish>Put the book back ✓</button>' : ''}</div>`}</div>`;
  }

  function paint() {
    spread.innerHTML = pageHTML(pages[S.i]);
    q('[data-dots]').innerHTML = pages.map((p, k) => `<button class="${k === S.i ? 'now' : k < S.i ? 'read' : ''} ${p.check ? 'star' : ''} ${p.end ? 'end' : ''}" data-go="${k}" aria-label="Go to page ${k + 1}">${p.check ? '★' : p.end ? '✓' : ''}</button>`).join('');
    q('[data-no]').textContent = pages[S.i].check ? 'question' : pages[S.i].end ? 'the end' : `page ${storyNo(S.i)} of ${storyTotal}`;
    q('[data-prev]').disabled = S.i === 0 || S.locked; q('[data-next]').disabled = S.i === pages.length - 1 || S.locked;
    q('[data-card]').hidden = true;
    emit();
  }
  function turn(to) {
    if (to < 0 || to >= pages.length || to === S.i || S.busy) return;
    const dir = to > S.i ? 'n' : 'p';
    if (reducedMotion()) { S.i = to; return paint(); }
    S.busy = true; spread.className = 'bk-spread out-' + dir;
    setTimeout(() => { S.i = to; paint(); spread.className = 'bk-spread in-' + dir; setTimeout(() => { spread.className = 'bk-spread'; S.busy = false; }, 280); }, 220);
  }

  function check(tile, c, key) {
    const box = tile.closest('.bk-tiles'), fb = q('[data-fb]');
    if (box.classList.contains('done')) return;
    if (tile.dataset.w === c.answer) {
      tile.classList.add('is-ok'); box.classList.add('done'); fb.className = 'bk-fb ok'; fb.textContent = `✓ ${c.teach}`; speak(c.teach);
      if (state.album[c.answer] !== 'gold') state.album[c.answer] = 'sticker';
      if (key === 'mid') S.checkOk = true; else setTimeout(() => { if (bk.isConnected && pages[S.i].end) { S.endStep++; paint(); } }, 1700);
      emit({ answered: `${c.q} ✓` });
    } else {
      tile.classList.add('is-wrong'); tile.disabled = true; fb.className = 'bk-fb no'; fb.textContent = '✗ Not quite. Look again.';
      emit({ answered: `${c.q} ✗ ${word(tile.dataset.w).full}` });
    }
  }

  bk.addEventListener('click', e => {
    const t = e.target;
    if (t.closest('[data-exit]')) return opts.onExit && opts.onExit();
    if (t.closest('[data-finish]')) { state.bookDone = true; state.stars += 3; return opts.onExit && opts.onExit(true); }
    if (t.closest('[data-prev]')) return turn(S.i - 1);
    if (t.closest('[data-next]')) return turn(S.i + 1);
    if (t.closest('[data-go]')) { if (!S.locked) turn(+t.closest('[data-go]').dataset.go); return; }
    if (t.closest('[data-toggle-en]')) { S.en = !S.en; const b = q('[data-toggle-en]'); b.setAttribute('aria-pressed', S.en); b.textContent = S.en ? 'Hide English' : 'Show in English'; bk.querySelectorAll('.bk-en').forEach(p => { p.hidden = !S.en; }); return; }
    if (t.closest('[data-say]')) return speak(t.closest('[data-say]').dataset.say);
    const tile = t.closest('.kp-tile');
    if (tile) { const key = tile.closest('.bk-tiles').dataset.check; return check(tile, key === 'mid' ? BOOK.check : BOOK.endChecks[S.endStep], key); }
    const w = t.closest('.bk-w'), card = q('[data-card]');
    if (w) {
      const d = w.dataset; w.classList.add('seen'); speak(d.full);
      if (d.id) { S.tapped.add(d.id); if (!state.album[d.id]) state.album[d.id] = 'seen'; }
      card.innerHTML = `<span class="pic">${d.pic}</span><span class="bk-card-t"><b>${esc(d.full)}</b><em>${esc(d.en)}</em>${d.id && word(d.id) ? '<small>★ in your word album</small>' : ''}</span><button class="bk-card-say" data-say="${esc(d.full)}" aria-label="Listen">🔊</button>`;
      card.hidden = false; card.classList.remove('pop'); void card.offsetWidth; card.classList.add('pop');
      emit({ word: d.full });
    } else if (!t.closest('[data-card]')) card.hidden = true;
  });

  // swipe
  let sx = null;
  spread.addEventListener('pointerdown', e => { sx = e.target.closest('button') ? null : e.clientX; });
  spread.addEventListener('pointerup', e => { if (sx === null || S.locked) return; const dx = e.clientX - sx; sx = null; if (Math.abs(dx) > 50) turn(S.i + (dx < 0 ? 1 : -1)); });
  const key = e => {
    if (!bk.isConnected) return document.removeEventListener('keydown', key);
    if (S.locked || e.target.matches('input, textarea')) return;
    if (e.key === 'ArrowRight') turn(S.i + 1); if (e.key === 'ArrowLeft') turn(S.i - 1);
  };
  document.addEventListener('keydown', key);

  paint();
  return {
    next: () => turn(S.i + 1), prev: () => turn(S.i - 1), goto: turn,
    lock(v) { S.locked = v; paint(); },
    point() { const el = q('.bk-w:not(.seen)') || q('.bk-w') || q('.bk-q'); if (el) { el.classList.add('kp-ring'); setTimeout(() => el.classList.remove('kp-ring'), 4000); } },
    destroy: () => { document.removeEventListener('keydown', key); root.innerHTML = ''; },
  };
}
