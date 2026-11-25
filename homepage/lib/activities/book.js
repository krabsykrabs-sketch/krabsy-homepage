// Book reader (live classroom, docs/live-classroom.md, WP L2). Ported from the prototype
// docs/prototype/tutor-v2/js/student/book.js: page turns (buttons, swipe, arrow keys),
// tappable words with a picture card, check questions inside the book, an end gallery.
// Same API and roles as the activity player (player.js): the state (page, taps, open
// word card, check answers) is the single source of truth; the mirror renders it.
//
// Book material: { kind: 'book', id, title, learn, topic, pages: [ … ], check?, endChecks?, words? }
//   story page: { scene, cast: [[emoji, x%, y%, size]], es | text, en | tr, img? }
//     text markup: {shown|card word|meaning|picture|vocab id (optional)}
//   check page: { check: true } (uses material.check) or { check: { q, en, options, answer, teach } }
//   end page:   { end: true } → "words you met" gallery + material.endChecks + "say it" card
import { recordAttempt } from '/lib/krabsy-stats.js';
import { esc, keyOf, speak, reducedMotion, loadVocab, makeWords, labels, anchorAt as anchorAtIn, overlay, batcher, throttle, clone } from './util.js';

const TOKEN = /\{([^}]+)\}([.,;:!?]*)/g;
// Words of one page: [{k, shown, full, en, pic, id, punct}] in order; k is unique on the page.
function pageWords(text) {
  const out = [], cnt = {}; let m; TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(text))) {
    const [shown, full, en, pic, id = ''] = m[1].split('|');
    const base = id ? keyOf(id) : keyOf(shown); cnt[base] = (cnt[base] || 0) + 1;
    out.push({ k: cnt[base] > 1 ? `${base}~${cnt[base] - 1}` : base, shown, full: full || shown, en: en || '', pic: pic || '', id });
  }
  return out;
}
function parse(text) {
  const ws = pageWords(text); let n = 0;
  return esc(text).replace(/\{([^}]+)\}([.,;:!?]*)/g, (_, body, punct) => {
    const w = ws[n++];
    return `<span class="nw"><button class="bk-w" data-k="${esc(w.k)}" data-anchor="book.word.${esc(w.k)}">${esc(w.shown)}</button>${punct}</span>`;
  });
}

export function mountBook(root, material, opts = {}) {
  const role = opts.role === 'mirror' ? 'mirror' : 'student';
  const mirror = role === 'mirror';
  const L = labels(opts.lang);
  const B = material || { pages: [] };
  const learn = B.learn || 'es';
  const pages = B.pages || [];
  let word = makeWords(opts.vocab || {}, learn, opts.lang || 'en');
  const textOf = p => p[learn] ?? p.text ?? p.es ?? '';
  const trOf = p => (p.tr && (p.tr[opts.lang] || p.tr.en)) || p.en || '';
  const checkOf = p => (p && p.check ? (typeof p.check === 'object' ? p.check : B.check) : null);
  const ends = B.endChecks || [];
  const storyNo = i => pages.slice(0, i + 1).filter(p => !p.check && !p.end).length;
  const storyTotal = pages.filter(p => !p.check && !p.end).length;

  let st = null, bk = null, spread = null, ov = null, dead = false, ready = false, pending = [];
  const rs = { page: null, sig: null, fx: null, card: null };
  const timers = new Set();
  const emitter = batcher(() => { if (!dead && opts.onState) opts.onState(clone(st)); }, 60);
  const q = s => bk.querySelector(s);
  const fresh = () => ({ v: 1, kind: 'book', id: B.id || null, page: 0, pages: pages.length, en: false, seen: {}, tapped: [], card: null, checks: {}, endStep: 0,
    locked: !!opts.locked, stars: 0, first: 0, total: 0, finished: false, fx: [], fxn: 0, rec: {} });
  const fx = (k, a) => { st.fxn++; st.fx.push({ n: st.fxn, k, a }); if (st.fx.length > 6) st.fx.shift(); };
  const soon = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); if (!dead) fn(); }, ms); timers.add(t); };
  function commit() { if (dead) return; render(); if (!mirror) emitter.push(); }

  // which check is on this page: 'mid<page>' or 'end<step>'
  const checkKey = () => { const p = pages[st.page]; if (!p) return null; if (p.check) return 'mid' + st.page; if (p.end && st.endStep < ends.length) return 'end' + st.endStep; return null; };
  const checkFor = key => (key && key.startsWith('mid') ? checkOf(pages[+key.slice(3)]) : key ? ends[+key.slice(3)] : null);

  /* ── HTML ──────────────────────────────────────────────────────────────── */
  const tiles = (c, key) => `<div class="bk-tiles" data-check="${key}">${c.options.map(o => { const w = word(o); return `<button class="kp-tile" data-w="${esc(o)}" data-anchor="book.tile.${esc(keyOf(o))}"><span class="pic">${w ? w.pic || esc(w.full) : esc(o)}</span><span class="mk"></span></button>`; }).join('')}</div>`;
  function pageHTML(p) {
    if (p.check) {
      const c = checkOf(p); if (!c) return '';
      return `<div class="bk-pic scene-check" data-anchor="book.pic"><span class="bk-bigcrab">🦀</span><span class="bk-bubble">${esc(L.question)}</span></div>
        <div class="bk-text" data-anchor="book.text"><p class="bk-q" data-anchor="book.q">${esc(c.q)}</p>${c.en ? `<p class="bk-en" hidden>${esc(c.en)}</p>` : ''}${tiles(c, 'mid' + st.page)}
        <p class="bk-fb" data-fb data-anchor="book.fb"></p></div>`;
    }
    if (p.end) return endHTML();
    const pic = p.img ? `<img class="bk-img" src="${esc(p.img)}" alt="">` : (p.cast || []).map(([e, x, y, s], k) => `<span class="bk-fig" style="left:${+x}%;top:${+y}%;--s:${+s};--d:${k}">${esc(e)}</span>`).join('');
    return `<div class="bk-pic scene-${esc(p.scene || 'farm')}" data-anchor="book.pic">${pic}</div>
      <div class="bk-text" data-anchor="book.text"><p class="bk-es">${parse(textOf(p))}</p>${trOf(p) ? `<p class="bk-en" hidden>${esc(trOf(p))}</p>` : ''}
      ${st.page === 0 ? `<p class="bk-crab"><span>🦀</span> ${esc(L.tapDotted)}</p>` : ''}</div>`;
  }
  function endHTML() {
    const c = ends[st.endStep];
    const gal = (B.words || []).map(id => { const w = word(id); if (!w) return ''; return `<button class="bk-g" data-say="${esc(w.full)}" data-id="${esc(id)}" data-anchor="book.g.${esc(keyOf(id))}"><i>${w.pic}</i><b>${esc(w.full)}</b></button>`; }).join('');
    return `<div class="bk-pic scene-gallery" data-anchor="book.pic"><h3>${esc(L.wordsMet)}</h3><div class="bk-gallery">${gal}</div></div>
      <div class="bk-text bk-endtext" data-anchor="book.text">${c ? `<p class="bk-small">${esc(L.quick(st.endStep + 1, ends.length))}</p><p class="bk-q" data-anchor="book.q">${esc(c.q)}</p>${tiles(c, 'end' + st.endStep)}<p class="bk-fb" data-fb data-anchor="book.fb"></p>`
        : `<div class="bk-fin" data-anchor="book.fin"><span class="bk-stamp">${esc(L.read)}</span><h3>${esc(L.theEnd)}</h3>
           <div class="bk-sayit"><b>${esc(L.sayIt)}</b><p>${esc(B.sayIt || L.sayItText(opts.tutor || 'your tutor'))}</p></div>
           ${opts.onExit && !mirror ? `<button class="kp-btn" data-finish>${esc(opts.doneLabel || 'Put the book back ✓')}</button>` : ''}</div>`}</div>`;
  }

  function shell() {
    root.innerHTML = `<div class="bk ${mirror ? 'is-mirror' : ''} ${opts.adult ? 'is-adult' : ''}" data-anchor="root">
      <header class="bk-top">${opts.onExit && !mirror ? `<button class="bk-x" data-exit aria-label="${esc(L.close)}">✕</button>` : ''}<b data-anchor="book.title">${esc(B.title || '')}</b>
        <button class="bk-en-btn" data-toggle-en data-anchor="book.en" aria-pressed="false">${esc(L.showEn)}</button></header>
      <div class="bk-stage"><div class="bk-spread" data-spread data-anchor="book.page"></div></div>
      <footer class="bk-nav"><button class="bk-arrow" data-prev data-anchor="book.prev" aria-label="${esc(L.prev)}">◀</button>
        <div class="bk-dots" data-dots data-anchor="book.dots">${pages.map((p, k) => `<button class="${p.check ? 'star' : ''} ${p.end ? 'end' : ''}" data-go="${k}" data-anchor="book.dot${k}" aria-label="${k + 1}">${p.check ? '★' : p.end ? '✓' : ''}</button>`).join('')}</div><span class="bk-pageno" data-no></span>
        <button class="bk-arrow" data-next data-anchor="book.next" aria-label="${esc(L.next)}">▶</button></footer>
      <div class="bk-card" data-card data-anchor="book.card" hidden></div>
    </div>`;
    bk = root.firstElementChild; spread = q('[data-spread]'); ov = overlay(bk);
    if (mirror) { bk.setAttribute('aria-hidden', 'true'); bk.querySelectorAll('button').forEach(b => { b.tabIndex = -1; }); return; }
    bind();
  }

  /* ── render from state ─────────────────────────────────────────────────── */
  function render() {
    if (!bk || !st) return;
    const p = pages[st.page]; if (!p) return;
    const sig = `${st.page}:${p.end ? st.endStep : ''}`;
    if (rs.sig !== sig) {
      const dir = rs.page == null ? null : st.page > rs.page ? 'n' : st.page < rs.page ? 'p' : null;
      spread.innerHTML = pageHTML(p); rs.sig = sig;
      if (dir && !reducedMotion()) { spread.className = 'bk-spread'; void spread.offsetWidth; spread.className = 'bk-spread in-' + dir; clearTimeout(spread._t); spread._t = setTimeout(() => { spread.className = 'bk-spread'; }, 300); }
      rs.page = st.page;
      if (mirror) spread.querySelectorAll('button').forEach(b => { b.tabIndex = -1; });
    }
    // English on/off
    const eb = q('[data-toggle-en]'); eb.setAttribute('aria-pressed', String(!!st.en)); eb.textContent = st.en ? L.hideEn : L.showEn;
    bk.querySelectorAll('.bk-en').forEach(e => { e.hidden = !st.en; });
    // tapped words
    spread.querySelectorAll('.bk-w').forEach(w => w.classList.toggle('seen', !!st.seen[`${st.page}.${w.dataset.k}`]));
    spread.querySelectorAll('.bk-g').forEach(g => g.classList.toggle('met', st.tapped.includes(g.dataset.id) || !!(opts.album && opts.album[g.dataset.id])));
    // check tiles + feedback
    const key = checkKey(), c = checkFor(key), box = spread.querySelector('.bk-tiles');
    if (box && c) {
      const r = st.checks[key] || { ok: false, shown: false, wrong: [], out: [] };
      box.classList.toggle('done', !!(r.ok || r.shown));
      box.querySelectorAll('.kp-tile').forEach(t => {
        const id = t.dataset.w;
        t.classList.toggle('is-ok', !!r.ok && id === c.answer); t.classList.toggle('is-shown', !!r.shown && id === c.answer);
        t.classList.toggle('is-wrong', r.wrong.includes(id)); t.classList.toggle('is-out', (r.out || []).includes(id)); t.disabled = r.wrong.includes(id) || (r.out || []).includes(id);
      });
      const fb = q('[data-fb]');
      if (fb) {
        const kind = r.ok || r.shown ? 'ok' : r.wrong.length ? 'no' : '';
        fb.className = 'bk-fb ' + kind; fb.textContent = r.ok || r.shown ? `✓ ${c.teach || ''}` : r.wrong.length ? L.lookAgain : L.tapRight;
      }
    }
    // nav
    bk.querySelectorAll('.bk-dots button').forEach((d, k) => { d.classList.toggle('now', k === st.page); d.classList.toggle('read', k < st.page); });
    q('[data-no]').textContent = p.check ? L.qPage : p.end ? L.endPage : L.page(storyNo(st.page), storyTotal);
    q('[data-prev]').disabled = st.page === 0 || (st.locked && !mirror); q('[data-next]').disabled = st.page === pages.length - 1 || (st.locked && !mirror);
    if (mirror) { q('[data-prev]').disabled = st.page === 0; q('[data-next]').disabled = st.page === pages.length - 1; }
    bk.classList.toggle('is-locked', !!st.locked);
    // word card
    const card = q('[data-card]'), ck = st.card && st.card.p === st.page ? `${st.card.p}.${st.card.k}` : '';
    if (ck !== rs.card) {
      rs.card = ck;
      const w = ck && pageWords(textOf(p)).find(x => x.k === st.card.k);
      if (w) {
        const v = w.id && word(w.id);
        card.innerHTML = `<span class="pic">${esc(w.pic)}</span><span class="bk-card-t"><b>${esc(w.full)}</b><em>${esc(w.en)}</em>${v ? `<small>${esc(L.inAlbum)}</small>` : ''}</span><button class="bk-card-say" data-say="${esc(w.full)}" data-anchor="book.card.say" aria-label="Listen" ${mirror ? 'tabindex="-1"' : ''}>🔊</button>`;
        card.hidden = false; card.classList.remove('pop'); void card.offsetWidth; card.classList.add('pop');
      } else card.hidden = true;
    }
    // effects
    if (rs.fx === null) rs.fx = st.fxn;
    else if (st.fxn > rs.fx) { st.fx.filter(f => f.n > rs.fx).forEach(playFx); rs.fx = st.fxn; }
    else if (st.fxn < rs.fx) rs.fx = st.fxn;
    if (ov) ov.reflow();
  }
  function playFx(f) {
    if (f.k === 'star' || f.k === 'gift') {
      if (f.k === 'gift' && opts.adult) return;
      const el = document.createElement(f.k === 'gift' ? 'div' : 'span');
      if (f.k === 'gift') { el.className = 'kp-gift'; el.innerHTML = `<span>${esc(f.g || '🎁')}</span><b>${esc(L.gift)}</b>`; } else { el.className = 'kp-fly'; el.textContent = '⭐'; }
      bk.appendChild(el); setTimeout(() => el.remove(), f.k === 'gift' ? 2400 : 1300); return;
    }
    const el = bk.querySelector(`[data-anchor="${CSS.escape(f.a)}"]`); if (!el) return;
    el.classList.remove(f.k); void el.offsetWidth; el.classList.add(f.k); setTimeout(() => el.classList.remove(f.k), 600);
  }

  /* ── student input ─────────────────────────────────────────────────────── */
  function turn(to) {
    if (to < 0 || to >= pages.length || to === st.page) return;
    st.page = to; st.card = null; commit();
  }
  function check(tile, key) {
    const c = checkFor(key); if (!c) return;
    const r = st.checks[key] = st.checks[key] || { ok: false, shown: false, wrong: [], out: [], hinted: false };
    if (r.ok || r.shown) return;
    const id = tile.dataset.w, ok = id === c.answer, firstTry = !r.wrong.length;
    if (ok) {
      r.ok = true; st.total++; if (firstTry && !r.hinted) { st.first++; st.stars++; }
      speak(c.teach || (word(id) || {}).full || id, learn);
      fx('pop', `book.tile.${keyOf(id)}`);
      if (key.startsWith('end')) soon(() => { if (checkKey() === key) { st.endStep++; afterEnd(); commit(); } }, 1700);
    } else { r.wrong.push(id); fx('shake', `book.tile.${keyOf(id)}`); }
    answered(c, key, id, ok, firstTry, r.hinted);
    commit();
  }
  function answered(c, key, given, ok, firstTry, hinted) {
    const w = word(c.answer), item = c.item || (w ? w.item : null), topic = c.topic || (w && w.topic) || B.topic || null, mode = hinted ? 'hint' : 'choice';
    if (firstTry && item && topic && !st.rec[key]) { st.rec[key] = 1; try { recordAttempt(item, c.form || 'default', !!ok, 'live', topic, mode); } catch (e) { console.warn('book: recordAttempt failed', e); } }
    if (opts.onAnswer) { try { opts.onAnswer({ step: st.page, item: item || c.answer, given, correct: !!ok, first: !!firstTry, shown: given == null, topic, mode, ref: c.q, a: 'book.q' }); } catch (e) { console.warn(e); } }
  }
  function afterEnd() {
    if (st.finished || !pages[st.page] || !pages[st.page].end || st.endStep < ends.length) return;
    st.finished = true;
    if (opts.onEnd) { try { opts.onEnd({ stars: st.stars, first: st.first, total: st.total, tapped: st.tapped.slice(), id: st.id, practise: Object.keys(st.checks).filter(k => !st.checks[k].ok || st.checks[k].wrong.length).map(k => { const c = checkFor(k); const w = c && word(c.answer); return w ? { id: c.answer, label: w.full } : { label: c ? c.answer : k }; }) }); } catch (e) { console.warn(e); } }
  }

  function bind() {
    bk.addEventListener('click', e => {
      const t = e.target;
      if (t.closest('[data-exit]')) return opts.onExit && opts.onExit(clone(st));
      if (t.closest('[data-finish]')) return opts.onExit && opts.onExit(clone(st), true);
      if (t.closest('[data-prev]')) return !st.locked && turn(st.page - 1);
      if (t.closest('[data-next]')) return !st.locked && turn(st.page + 1);
      if (t.closest('[data-go]')) { if (!st.locked) turn(+t.closest('[data-go]').dataset.go); return; }
      if (t.closest('[data-toggle-en]')) { st.en = !st.en; return commit(); }
      if (t.closest('[data-say]')) { speak(t.closest('[data-say]').dataset.say, learn); return; }
      const tile = t.closest('.kp-tile');
      if (tile && !tile.disabled) return check(tile, tile.closest('.bk-tiles').dataset.check);
      const w = t.closest('.bk-w');
      if (w) {
        const k = w.dataset.k, info = pageWords(textOf(pages[st.page])).find(x => x.k === k); if (!info) return;
        speak(info.full, learn);
        st.seen[`${st.page}.${k}`] = 1; if (info.id && !st.tapped.includes(info.id)) st.tapped.push(info.id);
        st.card = { p: st.page, k }; rs.card = null;      // tapping again pops the card again
        return commit();
      }
      if (!t.closest('[data-card]') && st.card) { st.card = null; commit(); }
    });
    let sx = null;
    spread.addEventListener('pointerdown', e => { sx = e.target.closest('button') ? null : e.clientX; });
    spread.addEventListener('pointerup', e => { if (sx === null || st.locked) return; const dx = e.clientX - sx; sx = null; if (Math.abs(dx) > 50) turn(st.page + (dx < 0 ? 1 : -1)); });
    const sendCursor = throttle(pos => { if (!dead && opts.onCursor) opts.onCursor(pos); }, 100);
    bk.addEventListener('pointermove', e => { const pp = anchorAtIn(bk, e.clientX, e.clientY); if (pp) sendCursor(pp); });
    bk.addEventListener('pointerleave', () => sendCursor({ a: 'off', x: 0, y: 0 }));
    document.addEventListener('keydown', onKey);
  }
  function onKey(e) {
    if (dead || !bk || !bk.isConnected) return document.removeEventListener('keydown', onKey);
    if (st.locked || e.target.matches('input, textarea, select, [contenteditable]')) return;
    if (e.key === 'ArrowRight') turn(st.page + 1); if (e.key === 'ArrowLeft') turn(st.page - 1);
  }

  /* ── boot + API ────────────────────────────────────────────────────────── */
  function boot() {
    if (dead) return;
    st = fresh();
    if (!mirror && opts.state && opts.state.kind === 'book') st = clone(opts.state);
    shell(); ready = true; render();
    if (!mirror) emitter.push();
    pending.forEach(([fn, arg]) => api[fn](arg)); pending = [];
  }
  const tutorCmd = c => {
    if (c.type === 'next') turn(st.page + 1);
    else if (c.type === 'prev') turn(st.page - 1);
    else if (c.type === 'goto' && Number.isInteger(c.page ?? c.step)) turn(Math.max(0, Math.min(pages.length - 1, c.page ?? c.step)));
    else if (c.type === 'lock') { st.locked = !!c.on; commit(); }
    else if (c.type === 'hint' || c.type === 'reveal') {
      const key = checkKey(), ch = checkFor(key); if (!ch) return;
      const r = st.checks[key] = st.checks[key] || { ok: false, shown: false, wrong: [], out: [], hinted: false };
      if (r.ok || r.shown) return;
      if (c.type === 'hint') { const w = ch.options.find(o => o !== ch.answer && !r.wrong.includes(o) && !r.out.includes(o)); if (w && ch.options.length - r.wrong.length - r.out.length > 2) { r.out.push(w); r.hinted = true; } commit(); }
      else {
        r.shown = true; st.total++; answered(ch, key, null, false, !r.wrong.length, r.hinted);
        if (key.startsWith('end')) soon(() => { if (checkKey() === key) { st.endStep++; afterEnd(); commit(); } }, 2200);
        commit();
      }
    }
  };
  const api = {
    kind: 'book',
    get ready() { return readyP; },
    getState: () => (st ? clone(st) : null),
    apply(state) {
      if (!ready) { pending.push(['apply', state]); return; }
      if (!state || state.kind !== 'book') return;
      if (!mirror) { timers.forEach(clearTimeout); timers.clear(); st = clone(state); rs.fx = null; render(); emitter.push(); return; }
      st = clone(state); render();
    },
    cmd(c) { if (!ready) { pending.push(['cmd', c]); return; } if (c && !mirror) tutorCmd(c); },
    point(pos) { if (!ready) return pending.push(['point', pos]); if (ov && pos) ov.pulse(pos, 2000); },
    cursor(pos) { if (ready && ov) ov.cursor(pos); },
    anchorAt: (x, y) => (bk ? anchorAtIn(bk, x, y) : null),
    lock(v) { if (ready && !mirror) { st.locked = !!v; commit(); } },
    reward(r) { if (!ready || mirror || !r) return; if (r.kind === 'star') st.stars++; fx(r.kind === 'gift' ? 'gift' : 'star'); if (r.kind === 'gift') st.fx[st.fx.length - 1].g = r.g || '🎁'; commit(); },
    destroy() { dead = true; timers.forEach(clearTimeout); emitter.cancel(); document.removeEventListener('keydown', onKey); root.innerHTML = ''; },
  };
  const readyP = (async () => {
    if (!opts.vocab) { try { const v = await loadVocab(learn); word = makeWords(v, learn, opts.lang || 'en'); } catch (_) {} }
    boot();
    return api;
  })();
  return api;
}
