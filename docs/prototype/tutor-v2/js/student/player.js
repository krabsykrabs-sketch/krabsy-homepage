// The one activity player. Every activity type is a small plug-in; feedback, hints,
// stars and the end summary live here so they are the same everywhere.
import { word, VOCAB, shuffle, state } from '../data.js';
import { esc, speak } from '../ui.js';
import { dragTap } from './drag.js';

const PRAISE = ['¡Muy bien!', '¡Genial!', '¡Sí!', '¡Perfecto!', '¡Bravo!'];
const LABELS = { text: 'Start', cards: 'Picture cards', tap: 'Tap the picture', match: 'Match the pairs', sort: 'Sort into baskets', gap: 'Fill the gaps' };

export function mountPlayer(root, steps, opts = {}) {
  root.innerHTML = `<div class="kp ${opts.adult ? 'is-adult' : ''}">
    <header class="kp-top">
      ${opts.onExit ? '<button class="kp-x" data-exit aria-label="Close">✕</button>' : ''}
      <div class="kp-dots" aria-hidden="true">${steps.map(() => '<span><i></i></span>').join('')}</div>
      <span class="kp-stars" title="Stars in this worksheet">⭐ <b data-stars>0</b></span>
    </header>
    <div class="kp-head"><h2 data-title></h2><span class="kp-count" data-count></span></div>
    <main class="kp-stage" data-stage></main>
    <footer class="kp-foot"><button class="kp-hint" data-hint>💡 Hint</button><div class="kp-msg" data-msg role="status"></div></footer>
  </div>`;
  const kp = root.firstElementChild, q = s => kp.querySelector(s);
  const S = { i: -1, stars: 0, first: 0, total: 0, log: [], practise: new Set(), newStickers: new Set(), act: null, item: '', done: false, timer: null };
  let hinted = false;
  const emit = () => opts.onState && opts.onState({ step: S.i, steps: steps.length, type: steps[S.i] ? steps[S.i].type : 'end', title: steps[S.i] ? steps[S.i].title : 'Finished',
    item: S.item, first: S.first, total: S.total, stars: S.stars, log: S.log, done: S.done });
  const later = (fn, ms) => { clearTimeout(S.timer); S.timer = setTimeout(() => { if (kp.isConnected) fn(); }, ms); };
  const msg = (kind, html) => { const m = q('[data-msg]'); m.className = 'kp-msg ' + (kind || ''); m.innerHTML = html || ''; };

  function ctxFor(stage, idx) {
    return {
      stage,
      later,
      msg,
      hinted: () => hinted,
      useHint: () => { hinted = true; },
      clearHint: () => { hinted = false; },
      newItem(label) { hinted = false; S.item = label; msg('', ''); emit(); },
      count(txt) { q('[data-count]').textContent = txt; },
      progress(f) { const d = kp.querySelectorAll('.kp-dots i')[idx]; if (d) d.style.width = Math.round(f * 100) + '%'; },
      seen(id) { if (word(id) && !state.album[id]) state.album[id] = 'seen'; },
      // ok: right answer. first: at first try and without a hint. shown: the answer was given.
      answer({ ok, first, label, wordId, teach, shown, counts = true }) {
        if (ok) {
          if (counts) S.total++;
          if (first) { S.first++; S.stars++; q('[data-stars]').textContent = S.stars; kp.querySelector('.kp-stars').classList.remove('pop'); void kp.offsetWidth; kp.querySelector('.kp-stars').classList.add('pop'); }
          else if (wordId) S.practise.add(wordId); else if (label) S.practise.add(label);
          if (wordId && word(wordId) && state.album[wordId] !== 'gold' && state.album[wordId] !== 'sticker') { state.album[wordId] = 'sticker'; S.newStickers.add(wordId); }
          msg('ok', `<span class="mk">✓</span><span><b>${PRAISE[S.total % PRAISE.length]}</b> ${teach ? esc(teach) : ''}</span>`);
          S.log.push({ ok: true, first, text: label });
        } else {
          if (shown) { if (counts) S.total++; S.practise.add(wordId || label); msg('shown', `<span class="mk">→</span><span>It is <b>${esc(label)}</b>. ${teach ? esc(teach) : ''}</span>`); }
          else msg('no', '<span class="mk">✗</span><span><b>Not quite.</b> Try once more.</span>');
          S.log.push({ ok: false, shown, text: label });
        }
        emit();
      },
      finish: () => later(() => goStep(idx + 1), 900),
    };
  }

  function goStep(i) {
    clearTimeout(S.timer);
    if (i >= steps.length) return summary();
    S.i = i; S.item = ''; hinted = false;
    const step = steps[i];
    kp.querySelectorAll('.kp-dots span').forEach((d, k) => { d.classList.toggle('is-done', k < i); d.classList.toggle('is-now', k === i); if (k < i) d.firstElementChild.style.width = '100%'; });
    q('[data-title]').textContent = step.type === 'text' ? '' : (step.title || LABELS[step.type]); q('[data-count]').textContent = '';
    msg('', '');
    const old = q('[data-stage]'); const stage = old.cloneNode(false); old.replaceWith(stage);   // fresh node: drops old listeners
    stage.className = 'kp-stage in';
    q('[data-hint]').hidden = step.type === 'text' || step.type === 'cards';
    S.act = ACTS[step.type](ctxFor(stage, i), step) || {};
    emit();
  }

  function summary() {
    S.done = true; S.i = steps.length; S.act = {};
    kp.querySelectorAll('.kp-dots span').forEach(d => { d.classList.add('is-done'); d.classList.remove('is-now'); d.firstElementChild.style.width = '100%'; });
    if (opts.onExit) { state.stars += S.stars; state.wsDone = true; }
    q('[data-title]').textContent = ''; q('[data-count]').textContent = ''; q('[data-hint]').hidden = true; msg('', '');
    const pr = [...S.practise].map(p => word(p) ? `<span class="kp-pw"><i>${word(p).pic}</i>${esc(word(p).full)}</span>` : `<span class="kp-pw">${esc(p)}</span>`).join('');
    const st = [...S.newStickers].map(id => `<span class="kp-sticker">${word(id).pic}</span>`).join('');
    const stage = q('[data-stage]'); stage.className = 'kp-stage in';
    stage.innerHTML = `<div class="kp-end">
      <div class="kp-end-hero">${opts.adult ? '' : '<span class="crab">🦀</span>'}<h3>${opts.adult ? 'Finished' : '¡Lo lograste!'}</h3>
        <p class="big">⭐ ${S.stars} star${S.stars === 1 ? '' : 's'}</p>
        <p><b>${S.first} of ${S.total}</b> right at first try</p></div>
      ${pr ? `<div class="kp-end-box"><h4>Words to practise</h4><div class="kp-pws">${pr}</div></div>` : '<div class="kp-end-box"><h4>Nothing to practise. Everything right!</h4></div>'}
      ${st ? `<div class="kp-end-box"><h4>New stickers in your album</h4><div class="kp-stickers">${st}</div></div>` : ''}
      <div class="kp-end-btns"><button class="kp-btn ghost" data-again>↺ Play again</button>${opts.onExit ? `<button class="kp-btn" data-exit>${esc(opts.doneLabel || 'Done')}</button>` : ''}</div>
    </div>`;
    emit(); opts.onDone && opts.onDone(S);
  }

  kp.addEventListener('click', e => {
    if (e.target.closest('[data-exit]')) return opts.onExit && opts.onExit(S);
    if (e.target.closest('[data-again]')) { Object.assign(S, { stars: 0, first: 0, total: 0, log: [], done: false }); S.practise.clear(); S.newStickers.clear(); q('[data-stars]').textContent = 0; kp.querySelectorAll('.kp-dots i').forEach(d => { d.style.width = '0'; }); return goStep(0); }
    if (e.target.closest('[data-hint]')) { S.act.hint && S.act.hint(); }
  });

  goStep(opts.startStep || 0);
  return {
    hint: () => S.act.hint && S.act.hint(),
    reveal: () => S.act.reveal && S.act.reveal(),
    skip: () => goStep(S.i + 1),
    point() { const el = (S.act.anchor && S.act.anchor()) || q('[data-stage]'); const onNow = el.classList.toggle('kp-ring'); if (onNow) setTimeout(() => el.classList.remove('kp-ring'), 4000); },
    star() { S.stars++; q('[data-stars]').textContent = S.stars; const f = document.createElement('span'); f.className = 'kp-fly'; f.textContent = '⭐'; kp.appendChild(f); setTimeout(() => f.remove(), 1300); emit(); },
    gift(g) { const f = document.createElement('div'); f.className = 'kp-gift'; f.innerHTML = `<span>${g}</span><b>A gift from your tutor!</b>`; kp.appendChild(f); setTimeout(() => f.remove(), 2400); },
    state: () => S,
    destroy: () => { clearTimeout(S.timer); root.innerHTML = ''; },
  };
}

/* ── Activity plug-ins ──────────────────────────────────────────────────── */
const ACTS = {
  text(ctx, step) {
    ctx.stage.innerHTML = `<div class="kp-intro"><div class="pic">${step.pic || '📘'}</div><h3>${esc(step.title)}</h3><p>${esc(step.body)}</p><button class="kp-btn" data-go>Let’s go! ›</button></div>`;
    ctx.progress(0.5);
    ctx.stage.addEventListener('click', e => { if (e.target.closest('[data-go]')) { ctx.progress(1); ctx.later(() => ctx.finish(), 0); } });
  },

  cards(ctx, step) {
    const queue = step.words.slice(), again = new Set(); const total = queue.length; let done = 0, cur, flipped;
    function show() {
      if (!queue.length) { ctx.msg('ok', `<span class="mk">✓</span><span><b>${total} cards seen.</b> Now let’s play with them.</span>`); return ctx.finish(); }
      cur = word(queue.shift()); flipped = false; ctx.newItem(cur.full); ctx.count(`${Math.min(done + 1, total)} / ${total}`); ctx.progress(done / total);
      ctx.stage.innerHTML = `<div class="kp-cards">
        <button class="kp-card" data-flip aria-label="Turn the card">
          <span class="face front"><span class="pic">${cur.pic}</span><small>Tap to turn</small></span>
          <span class="face back"><span class="pic sm">${cur.pic}</span><b>${esc(cur.full)}</b><em>${esc(cur.en)}</em><span class="say">🔊 listen</span></span>
        </button>
        <div class="kp-cardbtns"><button class="kp-btn ghost" data-again disabled>↺ Again later</button><button class="kp-btn" data-know disabled>✓ I know it</button></div>
      </div>`;
    }
    ctx.stage.addEventListener('click', e => {
      if (e.target.closest('[data-flip]')) {
        const c = e.target.closest('[data-flip]'); const back = !c.classList.contains('is-flipped');
        if (e.target.closest('.say') || back) speak(cur.full);
        if (!e.target.closest('.say')) c.classList.toggle('is-flipped');
        if (!flipped) { flipped = true; ctx.seen(cur.id); ctx.stage.querySelectorAll('.kp-cardbtns button').forEach(b => { b.disabled = false; }); }
      } else if (e.target.closest('[data-know]')) { done++; show(); }
      else if (e.target.closest('[data-again]')) { if (!again.has(cur.id)) { again.add(cur.id); queue.push(cur.id); } else done++; show(); }
    });
    show();
    return { anchor: () => ctx.stage.querySelector('.kp-card') };
  },

  tap(ctx, step) {
    const queue = step.words.slice(), back = new Set(); const total = queue.length; let done = 0, cur, tries, lock;
    function show() {
      if (!queue.length) return ctx.finish();
      cur = word(queue.shift()); tries = 0; lock = false; ctx.newItem(cur.full); ctx.count(`${Math.min(done + 1, total)} / ${total}`); ctx.progress(done / total);
      const others = shuffle(VOCAB.filter(v => v.set === cur.set && v.id !== cur.id)).slice(0, 3);
      ctx.stage.innerHTML = `<div class="kp-tap">
        <button class="kp-say" data-say><span>🔊</span><b>${esc(cur.full)}</b></button>
        <div class="kp-tiles">${shuffle([cur, ...others]).map(o => `<button class="kp-tile" data-w="${o.id}"><span class="pic">${o.pic}</span><span class="mk"></span></button>`).join('')}</div>
      </div>`;
    }
    const tile = id => ctx.stage.querySelector(`.kp-tile[data-w="${id}"]`);
    function reveal() {
      if (lock) return; lock = true; tile(cur.id).classList.add('is-shown');
      ctx.answer({ ok: false, shown: true, label: cur.full, wordId: cur.id, teach: back.has(cur.id) ? '' : 'It comes back once at the end.', counts: back.has(cur.id) });
      if (!back.has(cur.id)) { back.add(cur.id); queue.push(cur.id); } else done++;
      ctx.later(show, 2200);
    }
    ctx.stage.addEventListener('click', e => {
      if (e.target.closest('[data-say]')) return speak(cur.full);
      const t = e.target.closest('.kp-tile'); if (!t || lock || t.disabled) return;
      if (t.dataset.w === cur.id) {
        lock = true; t.classList.add('is-ok'); done++; ctx.progress(done / total);
        ctx.answer({ ok: true, first: tries === 0 && !ctx.hinted() && !back.has(cur.id), label: cur.full, wordId: cur.id, teach: `${cur.full} = ${cur.en}`, counts: !back.has(cur.id) });
        ctx.later(show, 1300);
      } else {
        tries++; t.classList.add('is-wrong'); t.disabled = true;
        if (tries >= 2) reveal(); else ctx.answer({ ok: false, label: cur.full });
      }
    });
    show();
    return {
      hint() { if (lock) return; const w = [...ctx.stage.querySelectorAll('.kp-tile:not(:disabled)')].find(t => t.dataset.w !== cur.id); if (w && ctx.stage.querySelectorAll('.kp-tile:not(:disabled)').length > 2) { w.disabled = true; w.classList.add('is-out'); ctx.useHint(); ctx.msg('hint', '<span class="mk">💡</span><span>One picture is gone. Listen again: tap the word.</span>'); } },
      reveal, anchor: () => ctx.stage.querySelector('.kp-say'),
    };
  },

  match(ctx, step) {
    const words = step.words.map(word), right = shuffle(words); const tries = {}; let selL = null, selR = null, n = 0;
    ctx.stage.innerHTML = `<div class="kp-match"><svg class="kp-lines" aria-hidden="true"></svg>
      <div class="col">${words.map(w => `<button class="kp-m pic-side" data-side="l" data-w="${w.id}"><span class="pic">${w.pic}</span></button>`).join('')}</div>
      <div class="col">${right.map(w => `<button class="kp-m" data-side="r" data-w="${w.id}">${esc(w.full)}</button>`).join('')}</div></div>`;
    const box = ctx.stage.firstElementChild, svg = box.querySelector('svg');
    ctx.newItem('pairs'); ctx.count(`0 / ${words.length}`);
    const btn = (side, id) => box.querySelector(`[data-side="${side}"][data-w="${id}"]`);
    function draw() {
      const b = box.getBoundingClientRect(); svg.setAttribute('viewBox', `0 0 ${b.width} ${b.height}`);
      svg.innerHTML = [...box.querySelectorAll('[data-side="l"].is-done')].map(l => {
        const r = btn('r', l.dataset.w), a = l.getBoundingClientRect(), c = r.getBoundingClientRect();
        return `<line class="${l.classList.contains('is-shown') ? 'shown' : ''}" x1="${a.right - b.left}" y1="${a.top + a.height / 2 - b.top}" x2="${c.left - b.left}" y2="${c.top + c.height / 2 - b.top}"/>`;
      }).join('');
    }
    new ResizeObserver(draw).observe(box);
    function pair(id, shown) {
      [btn('l', id), btn('r', id)].forEach(b => { b.classList.add('is-done'); shown && b.classList.add('is-shown'); b.disabled = true; });
      n++; ctx.count(`${n} / ${words.length}`); ctx.progress(n / words.length); draw();
      const w = word(id);
      ctx.answer(shown ? { ok: false, shown: true, label: w.full, wordId: id, teach: `${w.full} = ${w.en}` } : { ok: true, first: !tries[id] && !ctx.hinted(), label: w.full, wordId: id, teach: `${w.full} = ${w.en}` });
      ctx.clearHint(); if (n === words.length) ctx.finish();
    }
    box.addEventListener('click', e => {
      const b = e.target.closest('.kp-m'); if (!b || b.disabled) return;
      if (b.dataset.side === 'l') { selL && selL.classList.remove('is-picked'); selL = b; } else { selR && selR.classList.remove('is-picked'); selR = b; }
      b.classList.add('is-picked');
      if (b.dataset.side === 'r') speak(word(b.dataset.w).full);
      if (!selL || !selR) return;
      const l = selL, r = selR; selL = selR = null; l.classList.remove('is-picked'); r.classList.remove('is-picked');
      if (l.dataset.w === r.dataset.w) pair(l.dataset.w);
      else {
        [l, r].forEach(x => { x.classList.remove('shake'); void x.offsetWidth; x.classList.add('shake'); });
        tries[l.dataset.w] = (tries[l.dataset.w] || 0) + 1;
        if (tries[l.dataset.w] >= 2) pair(l.dataset.w, true); else ctx.answer({ ok: false, label: word(l.dataset.w).full });
      }
    });
    return {
      hint() { const l = box.querySelector('[data-side="l"]:not(.is-done)'); if (!l) return; ctx.useHint(); const r = btn('r', l.dataset.w); [l, r].forEach(x => { x.classList.add('glow'); setTimeout(() => x.classList.remove('glow'), 1600); }); ctx.msg('hint', '<span class="mk">💡</span><span>Look: these two belong together.</span>'); },
      reveal() { const l = box.querySelector('[data-side="l"]:not(.is-done)'); if (l) pair(l.dataset.w, true); },
      anchor: () => box.querySelector('[data-side="l"]:not(.is-done)') || box,
    };
  },

  sort(ctx, step) {
    const tries = {}; let n = 0; const total = step.cards.length;
    ctx.stage.innerHTML = `<div class="kp-sort">
      <div class="kp-tray">${shuffle(step.cards).map(c => { const w = word(c.w); return `<button class="kp-chip pic-chip" data-w="${w.id}"><span class="pic">${w.pic}</span><span>${esc(w.full)}</span></button>`; }).join('')}</div>
      <p class="kp-tip">Drag a card into a basket. Or tap the card, then the basket.</p>
      <div class="kp-baskets">${step.baskets.map(b => `<button class="kp-basket" data-b="${b.id}"><span class="got"></span><span class="lbl"><b>${esc(b.label)}</b><small>${esc(b.sub || '')}</small></span></button>`).join('')}</div>
    </div>`;
    ctx.newItem('cards'); ctx.count(`0 / ${total}`);
    function place(chip, shown) {
      const c = step.cards.find(x => x.w === chip.dataset.w), w = word(c.w), b = ctx.stage.querySelector(`.kp-basket[data-b="${c.b}"]`);
      chip.remove(); b.querySelector('.got').insertAdjacentHTML('beforeend', `<i class="${shown ? 'shown' : ''}">${w.pic}</i>`); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump');
      n++; ctx.count(`${n} / ${total}`); ctx.progress(n / total);
      const lbl = step.baskets.find(x => x.id === c.b).label;
      ctx.answer(shown ? { ok: false, shown: true, label: w.full, wordId: w.id, teach: `${cap(w.full)}: ${lbl.toLowerCase()}.` } : { ok: true, first: !tries[c.w] && !ctx.hinted(), label: w.full, wordId: w.id, teach: `${cap(w.full)} ${lbl.toLowerCase()}.` });
      ctx.clearHint(); if (n === total) ctx.finish();
    }
    dragTap(ctx.stage, {
      piece: '.kp-chip', target: '.kp-basket',
      onDrop(chip, basket) {
        const c = step.cards.find(x => x.w === chip.dataset.w);
        if (c.b === basket.dataset.b) return place(chip);
        chip.classList.remove('shake'); void chip.offsetWidth; chip.classList.add('shake');
        basket.classList.remove('nope'); void basket.offsetWidth; basket.classList.add('nope');
        tries[c.w] = (tries[c.w] || 0) + 1;
        if (tries[c.w] >= 2) setTimeout(() => chip.isConnected && place(chip, true), 500); else ctx.answer({ ok: false, label: word(c.w).full });
      },
    });
    return {
      hint() { ctx.useHint(); ctx.msg('hint', `<span class="mk">💡</span><span>${esc(step.hint || 'Look at the picture.')}</span>`); },
      reveal() { const c = ctx.stage.querySelector('.kp-chip'); if (c) place(c, true); },
      anchor: () => ctx.stage.querySelector('.kp-chip') || ctx.stage,
    };
  },

  gap(ctx, step) {
    const items = step.items, tries = {}, hintLv = {}; let n = 0;
    const bank = shuffle([...items.map(x => x.a), ...(step.extra || [])]);
    ctx.stage.innerHTML = `<div class="kp-gap">
      <ol class="kp-sents">${items.map((it, i) => { const [a, b] = it.s.split('___'); return `<li data-i="${i}"><span class="num">${i + 1}</span><span class="txt">${esc(a)}<button class="kp-slot" data-i="${i}" aria-label="gap"></button>${esc(b)}<small class="kp-en" hidden>(${esc(it.hint)})</small></span><span class="mk"></span></li>`; }).join('')}</ol>
      <div class="kp-bank"><span class="kp-banklbl">Word bank</span>${bank.map(w => `<button class="kp-chip" data-word="${esc(w)}">${esc(w)}</button>`).join('')}</div>
    </div>`;
    ctx.newItem(items[0].s); ctx.count(`0 / ${items.length}`);
    const slot = i => ctx.stage.querySelector(`.kp-slot[data-i="${i}"]`);
    function fill(i, shown) {
      const it = items[i], s = slot(i); s.textContent = it.a; s.classList.add('is-full', shown ? 'is-shown' : 'is-ok'); s.classList.remove('is-target'); s.disabled = true;
      s.closest('li').classList.add('done'); s.closest('li').querySelector('.mk').textContent = shown ? '→' : '✓';
      const chip = [...ctx.stage.querySelectorAll('.kp-chip')].find(c => c.dataset.word === it.a); chip && chip.remove();
      n++; ctx.count(`${n} / ${items.length}`); ctx.progress(n / items.length);
      const whole = it.s.replace('___', it.a);
      ctx.answer(shown ? { ok: false, shown: true, label: whole, teach: it.teach } : { ok: true, first: !tries[i] && !hintLv[i], label: whole, teach: it.teach });
      if (n === items.length) ctx.finish(); 
    }
    const dt = dragTap(ctx.stage, {
      piece: '.kp-chip', target: '.kp-slot',
      onDrop(chip, s) {
        if (s.classList.contains('is-full')) return;
        const i = +s.dataset.i;
        if (chip.dataset.word === items[i].a) return fill(i);
        [chip, s].forEach(x => { x.classList.remove('shake'); void x.offsetWidth; x.classList.add('shake'); });
        const mk = s.closest('li').querySelector('.mk'); mk.textContent = '✗'; setTimeout(() => { if (mk.textContent === '✗') mk.textContent = ''; }, 1200);
        tries[i] = (tries[i] || 0) + 1;
        if (tries[i] >= 2) setTimeout(() => fill(i, true), 500); else ctx.answer({ ok: false, label: items[i].s.replace('___', '…') });
      },
    });
    const current = () => { const t = dt.target(); if (t) return +t.dataset.i; return items.findIndex((x, k) => !slot(k).classList.contains('is-full')); };
    return {
      hint() {
        const i = current(); if (i < 0) return; const lv = hintLv[i] = (hintLv[i] || 0) + 1; const it = items[i], li = slot(i).closest('li');
        li.classList.add('hinting'); setTimeout(() => li.classList.remove('hinting'), 1500);
        if (lv === 1) { li.querySelector('.kp-en').hidden = false; ctx.msg('hint', `<span class="mk">💡</span><span>Sentence ${i + 1} in English: <b>${esc(it.hint)}</b></span>`); }
        else if (lv === 2) { const wrong = [...ctx.stage.querySelectorAll('.kp-chip:not(:disabled)')].find(c => c.dataset.word !== it.a); if (wrong) { wrong.classList.add('is-out'); setTimeout(() => wrong.classList.remove('is-out'), 4000); } ctx.msg('hint', `<span class="mk">💡</span><span>Not the grey word, for sentence ${i + 1}.</span>`); }
        else { slot(i).textContent = it.a[0] + '…'; ctx.msg('hint', `<span class="mk">💡</span><span>It starts with <b>${esc(it.a[0])}</b>.</span>`); }
      },
      reveal() { const i = current(); if (i >= 0) fill(i, true); },
      anchor: () => { const i = current(); return i >= 0 ? slot(i).closest('li') : ctx.stage; },
    };
  },
};
const cap = s => s[0].toUpperCase() + s.slice(1);
