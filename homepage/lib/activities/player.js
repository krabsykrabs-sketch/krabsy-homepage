// The Krabsy activity player (live classroom, docs/live-classroom.md, WP L2).
// Ported from the reviewed prototype docs/prototype/tutor-v2/js/student/player.js.
//
// One state object is the single source of truth. Both roles render from it:
//   role 'student'  takes input, changes the state, calls onState / onCursor / onAnswer /
//                   onEnd, records first-try answers (recordAttempt … 'live').
//   role 'mirror'   (the tutor's view) renders exactly the state it is given with apply();
//                   no own input, no recording, no speech.
// Each activity type is a plug-in with build (HTML from step + step state) and sync
// (classes / values from the step state). A rebuild happens only when the plug-in's
// signature changes (new card, new tap round, new step), so apply() is cheap and
// idempotent and typing never loses focus. One-off animations travel as numbered
// effects (state.fx) and play once on each side.
import { recordAttempt } from '/lib/krabsy-stats.js';
import { dragTap } from './drag.js?v=2026-11-26b';
import { esc, keyOf, shuffle, speak, loadVocab, makeWords, labels, anchorAt as anchorAtIn, findAnchor, overlay, batcher, throttle, normAnswer, cap, clone, saneState } from './util.js';
import { mountBook } from './book.js';

const PRAISE = ['¡Muy bien!', '¡Genial!', '¡Sí!', '¡Perfecto!', '¡Bravo!'];
const ACCENTS = ['á', 'é', 'í', 'ó', 'ú', 'ñ', 'ü', '¿', '¡'];

/** Book or worksheet: picks the right renderer. Same API either way. */
export function mountMaterial(root, material, opts = {}) {
  if (material && (material.kind === 'book' || (Array.isArray(material.pages) && !material.steps))) return mountBook(root, material, opts);
  return mountPlayer(root, material, opts);
}

/* ── Material normalisation (contract shapes + the prototype's shapes) ───── */
function normStep(raw, word) {
  const s = { ...raw, type: raw.type };
  if (s.type === 'cards') s.words = (raw.words || []).slice();
  if (s.type === 'tap') {
    s.items = (raw.items || (raw.words || []).map(w => ({ word: w }))).map(it => (typeof it === 'string' ? { word: it } : { word: it.word || it.w, options: it.options }));
  }
  if (s.type === 'match') {
    const src = raw.pairs || (raw.words || []).map(w => [w]);
    s.pairs = src.map((p, i) => {
      const [l, r] = Array.isArray(p) ? p : [p.left ?? p.l, p.right ?? p.r];
      const lw = word(l);
      return { k: lw ? keyOf(l) : 'p' + i, lw: lw ? l : null, lt: lw ? '' : String(l ?? ''), r: r != null ? String(r) : (lw ? lw.full : String(l)), item: lw ? lw.item : (p.item || null), topic: (lw && lw.topic) || p.topic || null };
    });
    // L3 format: `right` = the same ids in display order (the player never shuffles given lists)
    if (Array.isArray(raw.right)) s.right = raw.right.map(id => keyOf(id)).filter(k => s.pairs.some(p => p.k === k));
  }
  if (s.type === 'sort') {
    if (raw.cards) { s.baskets = raw.baskets.map((b, i) => ({ id: b.id || 'b' + i, label: b.label, sub: b.sub || '' })); s.cards = raw.cards.map(c => ({ k: keyOf(c.w), w: c.w, b: c.b })); }
    else {
      s.baskets = (raw.baskets || []).map((b, i) => ({ id: b.id || 'b' + i, label: b.label, sub: b.sub || '' }));
      s.cards = [];
      (raw.baskets || []).forEach((b, i) => (b.words || []).forEach(w => s.cards.push({ k: keyOf(w), w, b: b.id || 'b' + i })));
    }
    const seen = {}; s.cards.forEach(c => { if (seen[c.k]) c.k += '~' + seen[c.k]; seen[c.k.split('~')[0]] = (seen[c.k.split('~')[0]] || 0) + 1; });
  }
  if (s.type === 'gap') {
    s.mode = raw.mode || 'drag';
    s.sentences = (raw.sentences || raw.items || []).map(x => ({
      text: x.text ?? x.s ?? '', answer: x.answer ?? x.a ?? '', accepts: x.accepts || [], options: x.options || null,
      // hint = visible clue in brackets (L3 format); en = hidden translation, hint ladder step 1.
      // Prototype shape {s, a, hint}: its hint was the hidden translation.
      clue: x.text != null ? (x.hint || '') : '', en: x.text != null ? (x.en || '') : (x.hint || ''),
      teach: x.teach || '', item: x.item || null, topic: x.topic || null, form: x.form || null,
    }));
    if (Array.isArray(raw.bank)) s.bank = raw.bank.map(String);
  }
  return s;
}
function normMaterial(m, word) {
  if (Array.isArray(m)) m = { id: 'steps', kind: 'worksheet', steps: m };
  m = m || { steps: [] };
  return { ...m, learn: m.learn || 'es', steps: (m.steps || []).map(s => normStep(s, word)).filter(s => ACTS[s.type]) };
}

export function mountPlayer(root, material, opts = {}) {
  const role = opts.role === 'mirror' ? 'mirror' : 'student';
  const mirror = role === 'mirror';
  const L = labels(opts.lang);
  const learn = (material && material.learn) || 'es';
  let word = makeWords(opts.vocab || {}, learn, opts.lang || 'en');
  let M = null;                 // normalised material
  let st = null;                // THE state
  let rs = { step: null, sig: null, fx: null, scroll: null };  // what is rendered now
  let kp = null, ov = null, dead = false, ready = false, pending = [];
  const timers = new Set(); let stepTimer = null;
  const emitter = batcher(() => { if (!dead && opts.onState) opts.onState(clone(st)); }, 60);
  const q = s => kp.querySelector(s);

  /* ── state ─────────────────────────────────────────────────────────────── */
  const fresh = () => ({ v: 1, kind: 'worksheet', id: M.id || null, n: M.steps.length, step: 0, stars: 0, first: 0, total: 0,
    practise: [], done: false, msg: null, fx: [], fxn: 0, rec: {}, ss: [], scroll: 0 });
  const cur = () => st.ss[st.step];
  const stepOf = i => M.steps[i];

  function commit() { if (dead) return; render(); if (!mirror) emitter.push(); }
  function fx(k, a) { st.fxn++; st.fx.push({ n: st.fxn, k, a }); if (st.fx.length > 6) st.fx.shift(); }
  function msg(kind, mk, b, t) { st.msg = kind ? { kind, mk: mk || '', b: b || '', t: t || '' } : null; }
  function soon(fn, ms) { const t = setTimeout(() => { timers.delete(t); if (!dead) fn(); }, ms); timers.add(t); return t; }
  function later(fn, ms) { clearTimeout(stepTimer); const at = st.step; stepTimer = setTimeout(() => { if (!dead && st.step === at) fn(); }, ms); }
  function clearTimers() { clearTimeout(stepTimer); timers.forEach(clearTimeout); timers.clear(); }

  // One answer event. ok: right. firstTry: this is the first decisive attempt on the item.
  // first: right at first try without hint (= a star). shown: the answer was given.
  function answer(a) {
    const { ok, first, shown, label, wordId, teach, counts = true, recKey, item, topic, form, given, mode, anchor, firstTry } = a;
    if (anchor) st.last = anchor;
    if (ok) {
      if (counts) st.total++;
      if (first) { st.first++; st.stars++; fx('pop', 'stars'); }
      else addPractise(wordId, label);
      msg('ok', '✓', PRAISE[st.total % PRAISE.length], teach || '');
    } else if (shown) {
      if (counts) st.total++;
      addPractise(wordId, label);
      // a whole sentence is shown as it is; a word gets "It is …."
      const lb = String(label ?? ''), sent = /\s/.test(lb) && /[.!?…]$/.test(lb);
      msg('shown', '→', '', `${sent ? lb : `${L.itIs} ${lb.replace(/[.!?…]+$/, '')}.`} ${teach || ''}`.trim());
    } else msg('no', '✗', L.notQuite, L.tryAgain);
    if (mirror) return;
    const correct = !!ok;
    if (firstTry && item && topic && !st.rec[recKey]) {
      st.rec[recKey] = 1;
      try { recordAttempt(item, form || 'default', correct, 'live', topic, mode); } catch (e) { console.warn('player: recordAttempt failed', e); }
    }
    if (opts.onAnswer) {
      try { opts.onAnswer({ step: st.step, item: item || wordId || null, given: given ?? null, correct, first: !!firstTry, shown: !!shown, topic: topic || null, mode: mode || null, ref: label, a: anchor || null }); } catch (e) { console.warn(e); }
    }
  }
  function addPractise(id, label) { const key = id || label; if (key && !st.practise.some(p => (p.id || p.label) === key)) st.practise.push(id ? { id } : { label }); }

  const ctx = {
    get L() { return L; }, word: w => word(w), allWords: () => (word.all ? word.all() : []), learn, mirror, fx, msg, soon, later, answer, commit,
    say: t => { if (!mirror) speak(t, learn); },
    finish: () => later(() => goStep(st.step + 1), 900),
    topicOf: (x, step) => (x && x.topic) || step.topic || null,   // material.topic is a library filter, never a recording topic
  };

  /* ── navigation ────────────────────────────────────────────────────────── */
  function goStep(i) {
    clearTimers();
    if (i < 0) i = 0;
    if (i >= M.steps.length) return summary();
    st.step = i; st.done = false; st.msg = null; st.scroll = 0;
    if (!st.ss[i]) st.ss[i] = ACTS[stepOf(i).type].init(stepOf(i), ctx);
    commit();
  }
  function summary() {
    clearTimers();
    st.step = M.steps.length; st.done = true; st.msg = null; st.scroll = 0;
    commit();
    if (!mirror && opts.onEnd && !st.ended) {
      st.ended = true; emitter.push(); try { opts.onEnd({ stars: st.stars, first: st.first, total: st.total, practise: st.practise.map(p => p.id ? { id: p.id, label: word(p.id) ? word(p.id).full : p.id } : p), id: st.id }); } catch (e) { console.warn(e); } }
  }

  /* ── rendering ─────────────────────────────────────────────────────────── */
  function shell() {
    root.innerHTML = `<div class="kp ${opts.adult ? 'is-adult' : ''} ${mirror ? 'is-mirror' : ''}" data-anchor="root">
      <header class="kp-top">
        ${opts.onExit && !mirror ? `<button class="kp-x" data-exit aria-label="${esc(L.close)}">✕</button>` : ''}
        <div class="kp-dots" aria-hidden="true" data-anchor="dots">${M.steps.map((_, k) => `<span data-anchor="dot${k}"><i></i></span>`).join('')}</div>
        <span class="kp-stars" data-anchor="stars">⭐ <b data-stars>0</b></span>
      </header>
      <div class="kp-head"><h2 data-title data-anchor="title"></h2><span class="kp-count" data-count></span></div>
      <main class="kp-stage" data-stage data-anchor="step"></main>
      <footer class="kp-foot"><button class="kp-hint" data-hint data-anchor="hint">${esc(L.hint)}</button><div class="kp-msg" data-msg data-anchor="msg" role="status"></div></footer>
    </div>`;
    kp = root.firstElementChild;
    ov = overlay(kp);
    if (mirror) { kp.setAttribute('aria-hidden', 'true'); noTabs(kp); return; }
    kp.addEventListener('click', e => {
      if (e.target.closest('[data-exit]')) return opts.onExit && opts.onExit(clone(st));
      if (e.target.closest('[data-again]')) { st = fresh(); rs.step = null; return goStep(0); }
      if (e.target.closest('[data-hint]')) return doHint();
    });
    const sendCursor = throttle(pos => { if (!dead && opts.onCursor) opts.onCursor(pos); }, 100);
    kp.addEventListener('pointermove', e => { const p = anchorAtIn(kp, e.clientX, e.clientY); if (p) sendCursor(p); });
    kp.addEventListener('pointerleave', () => sendCursor({ a: 'off', x: 0, y: 0 }));
  }

  function newStage() {
    const old = q('[data-stage]'); const stage = old.cloneNode(false); old.replaceWith(stage);   // fresh node: drops old listeners
    if (!mirror) stage.addEventListener('scroll', throttle(() => { if (st && stage.scrollHeight > stage.clientHeight) { st.scroll = Math.round(stage.scrollTop / Math.max(1, stage.scrollHeight - stage.clientHeight) * 1000) / 1000; emitter.push(); } }, 120), { passive: true });
    else stage.addEventListener('scroll', () => ov && ov.reflow(), { passive: true });
    return stage;
  }

  function render() {
    if (!kp || !st) return;
    const n = M.steps.length, i = st.step, step = stepOf(i), act = step && ACTS[step.type], ss = st.ss[i];
    // header
    q('[data-stars]').textContent = st.stars;
    kp.querySelectorAll('.kp-dots span').forEach((d, k) => {
      d.classList.toggle('is-done', k < i || st.done); d.classList.toggle('is-now', k === i && !st.done);
      const s2 = st.ss[k]; const f = (k < i || st.done) ? 1 : (k === i && act && s2) ? act.progress(stepOf(k), s2) : (s2 && s2.done ? 1 : 0);
      d.firstElementChild.style.width = Math.round(f * 100) + '%';
    });
    q('[data-title]').textContent = st.done || !step || step.type === 'text' ? '' : (step.title || L[step.type] || '');
    q('[data-count]').textContent = act && ss && act.count ? act.count(step, ss) : '';
    q('[data-hint]').hidden = st.done || !act || !act.hint || (ss && ss.done);
    const m = q('[data-msg]');
    const mk = st.msg ? `${st.msg.kind}|${st.msg.mk}|${st.msg.b}|${st.msg.t}` : '';
    if (m.dataset.k !== mk) {
      m.dataset.k = mk; m.className = 'kp-msg ' + (st.msg ? st.msg.kind : '');
      m.innerHTML = st.msg ? `<span class="mk">${esc(st.msg.mk)}</span><span>${st.msg.b ? `<b>${esc(st.msg.b)}</b> ` : ''}${esc(st.msg.t)}</span>` : '';
    }
    // stage
    let stage = q('[data-stage]');
    const stepKey = st.done ? 'end' : i;
    if (rs.step !== stepKey) {
      stage = newStage(); rs.step = stepKey; rs.sig = null;
      stage.className = 'kp-stage' + (rs.fx === null ? '' : ' in');
      if (!st.done && act && !mirror && act.bind) act.bind(stage, step, () => st.ss[st.step], { ...ctx, sIdx: i, step });
    }
    if (st.done) {
      if (rs.sig !== 'end') { rs.sig = 'end'; stage.innerHTML = endHTML(); if (mirror) noTabs(stage); }
    } else if (act && ss) {
      const c = { ...ctx, sIdx: i, step };
      const sig = act.sig(step, ss);
      if (sig !== rs.sig) { rs.sig = sig; stage.innerHTML = act.build(step, ss, c); if (act.mounted) act.mounted(stage, step, ss, c); if (mirror) noTabs(stage); }
      act.sync(stage, step, ss, c);
    }
    // scroll (mirror follows the student)
    if (mirror && rs.scroll !== st.scroll) { rs.scroll = st.scroll; stage.scrollTop = (st.scroll || 0) * Math.max(0, stage.scrollHeight - stage.clientHeight); }
    // the mirror is smaller than the student's screen: keep what the student works on in view
    if (mirror) follow(stage, ss);
    // effects: play the ones newer than what this side has played
    if (rs.fx === null) rs.fx = st.fxn;                 // first render (or a mirror's first apply): never replay old effects
    else if (st.fxn > rs.fx) { const nw = st.fx.filter(f => f.n > rs.fx); rs.fx = st.fxn; nw.forEach(f => { try { playFx(f); } catch (_) {} }); }
    else if (st.fxn < rs.fx) rs.fx = st.fxn;            // state was reset (play again)
    // the piece being dragged rides under the mirror's ghost hand
    if (mirror) carry();
  }
  // Mirror: when the student moves on to another item (or answers one), scroll the mirror's
  // stage so that item is visible (only if it is out of view; the student's scroll still wins
  // when the student scrolls).
  function follow(stage, ss) {
    if (stage.scrollHeight <= stage.clientHeight + 2) return;
    const curEl = st.done ? null : stage.querySelector('.is-cur, .is-focus, .is-picked, .is-target, .is-dragging');
    const curA = curEl ? (curEl.closest('[data-anchor]') || curEl).dataset.anchor || '' : '';
    const key = `${st.step}|${st.last || ''}|${curA}`;
    if (rs.follow === key) return;
    const lastChanged = !rs.follow || rs.follow.split('|')[1] !== (st.last || '');
    rs.follow = key;
    const el = (lastChanged && st.last && findAnchor(stage, st.last)) || curEl;
    if (!el || el === stage || !stage.contains(el)) return;
    const sr = stage.getBoundingClientRect(), er = el.getBoundingClientRect(), k = stage.offsetHeight ? sr.height / stage.offsetHeight || 1 : 1;
    const top = (er.top - sr.top) / k, bottom = (er.bottom - sr.top) / k;
    if (top < 0) stage.scrollTop += top - 8;
    else if (bottom > stage.clientHeight) stage.scrollTop += Math.min(top - 8, bottom - stage.clientHeight + 8);
  }
  function carry() {
    if (!ov || !st) return; const ss = st.ss[st.step], d = !st.done && ss && ss.drag;
    ov.carry(d ? q('[data-stage]').querySelector(`[data-k="${CSS.escape(d)}"]`) : null); ov.reflow();
  }

  function playFx(f) {
    if (f.k === 'star' || f.k === 'gift') return reward(f.k, f.g, true);
    const el = f.a === 'stars' ? q('.kp-stars') : findAnchor(kp, f.a);
    if (!el) return;
    const cls = f.k === 'glow' ? 'glow' : f.k;
    el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), f.k === 'glow' ? 1600 : 600);
  }

  function endHTML() {
    const pr = st.practise.map(p => { const w = p.id && word(p.id); return w ? `<span class="kp-pw"><i class="pic">${w.pic}</i>${esc(w.full)}</span>` : `<span class="kp-pw">${esc(p.label || p.id)}</span>`; }).join('');
    return `<div class="kp-end" data-anchor="end">
      <div class="kp-end-hero">${opts.adult ? '' : '<span class="crab">🦀</span>'}<h3>${esc(opts.adult ? L.finished : L.hooray)}</h3>
        <p class="big">${esc(L.stars(+st.stars || 0))}</p><p>${opts.adult ? L.firstTry(+st.first | 0, +st.total | 0) : esc(L.tasks(+st.total | 0))}</p></div>
      ${pr ? `<div class="kp-end-box" data-anchor="end.practise"><h4>${esc(L.practise)}</h4><div class="kp-pws">${pr}</div></div>` : `<div class="kp-end-box"><h4>${esc(L.allRight)}</h4></div>`}
      <div class="kp-end-btns"><button class="kp-btn ghost" data-again data-anchor="end.again">${esc(L.playAgain)}</button>${opts.onExit && !mirror ? `<button class="kp-btn" data-exit>${esc(opts.doneLabel || 'Done')}</button>` : ''}</div>
    </div>`;
  }

  // Student resumes from a saved state (reload): restart the timer that was running.
  function resume() {
    if (st.done) return; const step = stepOf(st.step), ss = cur(); if (!step || !ss) return;
    const c = { ...ctx, sIdx: st.step, step };
    if (ss.done) return c.finish();
    if (step.type === 'tap' && (ss.ok || ss.shown)) c.later(() => { ACTS.tap.round(step, ss, c); c.commit(); if (ss.done) c.finish(); }, 900);
    if (step.type === 'gap') Object.keys(ss.tries).forEach(i => { if (ss.tries[i] >= 2 && !ss.filled[i]) { ACTS.gap.fill(step, ss, c, +i, true, null); c.commit(); } });
  }

  /* ── tutor commands (student side) ─────────────────────────────────────── */
  function doHint() { const step = stepOf(st.step), ss = cur(); if (st.done || !ss || ss.done) return; const act = ACTS[step.type]; if (act.hint) { act.hint(step, ss, { ...ctx, sIdx: st.step, step }); commit(); } }
  function doReveal() { const step = stepOf(st.step), ss = cur(); if (st.done || !ss || ss.done) return; const act = ACTS[step.type]; if (act.reveal) { act.reveal(step, ss, { ...ctx, sIdx: st.step, step }); commit(); } }
  function reward(kind, g, fromState) {
    if (!kp) return;
    if (kind === 'gift') {
      if (opts.adult) return;
      const f = document.createElement('div'); f.className = 'kp-gift'; f.innerHTML = `<span>${esc(g || '🎁')}</span><b>${esc(L.gift)}</b>`; kp.appendChild(f); setTimeout(() => f.remove(), 2400);
    } else {
      const f = document.createElement('span'); f.className = 'kp-fly'; f.textContent = '⭐'; kp.appendChild(f); setTimeout(() => f.remove(), 1300);
    }
  }

  /* ── boot ──────────────────────────────────────────────────────────────── */
  function boot() {
    if (dead) return;
    M = normMaterial(material, word);
    shell();
    ready = true;
    if (mirror) {
      st = fresh(); st.step = -1;           // nothing until the first apply
      const p = pending.find(x => x[0] === 'apply'); pending = pending.filter(x => x[0] !== 'apply');
      if (p) api.apply(p[1]); else { st.step = 0; st.ss[0] = ACTS[stepOf(0)?.type]?.init(stepOf(0), ctx); if (!stepOf(0)) st.done = true; render(); }
    } else {
      if (opts.state && opts.state.kind === 'worksheet' && Array.isArray(opts.state.ss)) { st = clone(opts.state); render(); resume(); emitter.push(); }
      else { st = fresh(); if (M.steps.length) goStep(opts.startStep || 0); else summary(); }
    }
    pending.forEach(([fn, arg]) => api[fn](arg)); pending = [];
  }

  const api = {
    kind: 'worksheet',
    get ready() { return readyP; },
    getState: () => (st ? clone(st) : null),
    apply(state) {
      if (!ready) { pending.push(['apply', state]); return; }
      if (!state || state.kind !== 'worksheet' || !Array.isArray(state.ss)) return;
      if (!mirror) { clearTimers(); st = clone(state); rs.step = null; rs.fx = null; render(); resume(); emitter.push(); return; }
      const s2 = saneState(state); if (!s2) return;
      st = s2;
      try { render(); } catch (e) { rs.step = null; rs.sig = null; console.warn('mirror: state not shown', e && e.message); }
    },
    // which item the tutor's Hint / Show answer act on (for the button label), or null
    current() {
      if (!st || st.done) return null; const step = stepOf(st.step), ss = cur();
      if (!step || !ss || ss.done || step.type !== 'gap') return null;
      const i = ACTS.gap.current(step, ss); return i >= 0 ? i + 1 : null;
    },
    cmd(c) {
      if (!ready) { pending.push(['cmd', c]); return; }
      if (!c || mirror) return;
      if (c.type === 'hint') doHint();
      else if (c.type === 'reveal') doReveal();
      else if (c.type === 'next') { if (!st.done) goStep(st.step + 1); }
      else if (c.type === 'prev') goStep(st.done ? M.steps.length - 1 : st.step - 1);
      else if (c.type === 'goto' && Number.isInteger(c.step)) goStep(Math.min(c.step, M.steps.length));
    },
    point(pos) {
      if (!ready) return pending.push(['point', pos]);
      if (ov && pos) ov.pulse(pos, 2000);
      if (!mirror && pos && st && !st.done) {
        const step = stepOf(st.step), ss = cur(), m = /^s(\d+)\.(?:gap|slot)(\d+)(?:\.|$)/.exec(String(pos.a || ''));
        if (step && ss && step.type === 'gap' && m && +m[1] === st.step && +m[2] < step.sentences.length && !ss.filled[+m[2]]) { ss.cur = +m[2]; ss.waiting = null; commit(); }
      }
    },
    cursor(pos) { if (!ready || !ov) return; ov.cursor(pos); carry(); },
    anchorAt: (x, y) => (kp ? anchorAtIn(kp, x, y) : null),
    // Extra (not in the contract, optional for L4): the tutor's star / gift celebration,
    // carried in the state so the mirror shows it too. A tutor star adds one star.
    reward(r) {
      if (!ready || mirror || !r) return;
      if (r.kind === 'star') { st.stars++; }
      fx(r.kind === 'gift' ? 'gift' : 'star'); if (r.kind === 'gift') st.fx[st.fx.length - 1].g = r.g || '🎁';
      commit();
    },
    destroy() { dead = true; clearTimers(); emitter.cancel(); root.innerHTML = ''; },
  };
  const readyP = (async () => {
    if (!opts.vocab) { try { const v = await loadVocab(learn); word = makeWords(v, learn, opts.lang || 'en'); } catch (_) {} }
    boot();
    return api;
  })();
  return api;
}

/* ── Activity plug-ins ────────────────────────────────────────────────────
   init(step, ctx) → step state (student only; random orders live in the state)
   sig(step, ss)   → string; a change rebuilds the stage
   build(step, ss, c) → HTML · sync(stage, step, ss, c) → classes/values from ss
   bind(stage, step, getSS, c) → student input (delegated on the stage)
   hint / reveal(step, ss, c) · count / progress(step, ss)                     */
const noTabs = el => el.querySelectorAll('button, input, a, [tabindex]').forEach(b => { b.tabIndex = -1; });   // the mirror takes no input
const A = (c, s) => `s${c.sIdx}.${s}`;              // anchor names: s2.gap3, s1.card.vaca …
const attrK = s => esc(s);
const pickTiles = (step, it, c) => {
  const word = c.word;
  let opts = it.options && it.options.length ? it.options.slice() : null;
  if (!opts) {
    const me = word(it.word); const all = c.allWords();
    let others = all.filter(id => id !== it.word && me && word(id) && word(id).set && word(id).set === me.set);
    if (others.length < 3) others = others.concat(step.items.map(x => x.word).filter(id => id !== it.word && !others.includes(id)));
    opts = [it.word, ...shuffle(others).slice(0, 3)];
  }
  else return [...new Set(it.options.includes(it.word) ? it.options : [...it.options, it.word])];   // given order, never shuffled
  if (!opts.includes(it.word)) opts.unshift(it.word);
  return shuffle([...new Set(opts)]);
};
// A finished picture step (when the tutor goes back to it): the words of the step.
const recap = (ids, c) => `<div class="kp-recap" data-anchor="${A(c, 'recap')}">${[...new Set(ids)].map(id => { const w = c.word(id) || { full: id, pic: '' }; return `<span class="kp-pw" data-anchor="${A(c, 'recap.' + keyOf(id))}"><i class="pic">${w.pic}</i>${esc(w.full)}</span>`; }).join('')}</div>`;
const ACTS = {
  text: {
    init: () => ({ done: false }),
    sig: () => 'text',
    build: (step, ss, c) => `<div class="kp-intro" data-anchor="${A(c, 'intro')}"><div class="pic">${esc(step.pic || '📘')}</div><h3>${esc(step.title)}</h3><p>${esc(step.body || '')}</p><button class="kp-btn" data-go data-anchor="${A(c, 'go')}">${esc(c.L.go)}</button></div>`,
    sync() {},
    bind(stage, step, ss, c) { stage.addEventListener('click', e => { if (e.target.closest('[data-go]') && !ss().done) { ss().done = true; c.commit(); c.later(() => c.finish(), 0); } }); },
    progress: (step, ss) => (ss.done ? 1 : 0.5),
  },

  cards: {
    init: step => ({ queue: step.words.slice(1), again: [], n: 0, cur: step.words[0], flipped: false, opened: false, shows: 0, done: !step.words.length }),
    sig: (step, ss) => `cards:${ss.done ? 'end' : ss.shows + ':' + ss.cur}`,
    build(step, ss, c) {
      if (ss.done) return recap(step.words, c);
      const w = c.word(ss.cur) || { full: ss.cur, en: '', pic: '' };
      return `<div class="kp-cards">
        <button class="kp-card" data-flip data-anchor="${A(c, 'card.' + keyOf(ss.cur))}" aria-label="Turn the card">
          <span class="face front"><span class="pic">${w.pic || esc(w.full)}</span><small>${esc(c.L.turn)}</small></span>
          <span class="face back"><span class="pic sm">${w.pic}</span><b>${esc(w.both || w.full)}</b><em>${esc(w.en)}</em><span class="say" data-anchor="${A(c, 'say')}">${esc(c.L.listen)}</span></span>
        </button>
        <div class="kp-cardbtns"><button class="kp-btn ghost" data-again data-anchor="${A(c, 'again')}">${esc(c.L.again)}</button><button class="kp-btn" data-know data-anchor="${A(c, 'know')}">${esc(c.L.know)}</button></div>
      </div>`;
    },
    sync(stage, step, ss) {
      const card = stage.querySelector('.kp-card'); if (!card) return;
      card.classList.toggle('is-flipped', !!ss.flipped);
      stage.querySelectorAll('.kp-cardbtns button').forEach(b => { b.disabled = !ss.opened; });
    },
    bind(stage, step, get, c) {
      const next = () => {
        const ss = get();
        if (!ss.queue.length) { ss.done = true; c.msg('ok', '✓', c.L.seen(step.words.length), c.L.seenTail); c.commit(); return c.finish(); }
        ss.cur = ss.queue.shift(); ss.flipped = false; ss.opened = false; ss.shows++; c.msg(null); c.commit();
      };
      stage.addEventListener('click', e => {
        const ss = get(); if (ss.done) return;
        const w = c.word(ss.cur);
        if (e.target.closest('[data-flip]')) {
          const toBack = !ss.flipped;
          if (e.target.closest('.say') || toBack) c.say(w ? w.full : ss.cur);
          if (!e.target.closest('.say') || !ss.flipped) ss.flipped = !ss.flipped;
          ss.opened = true; c.commit();
        } else if (e.target.closest('[data-know]')) { ss.n++; next(); }
        else if (e.target.closest('[data-again]')) { if (!ss.again.includes(ss.cur)) { ss.again.push(ss.cur); ss.queue.push(ss.cur); } else ss.n++; next(); }
      });
    },
    count: (step, ss) => (ss.done ? '' : `${Math.min(ss.n + 1, step.words.length)} / ${step.words.length}`),
    progress: (step, ss) => (ss.done ? 1 : ss.n / Math.max(1, step.words.length)),
  },

  tap: {
    init(step, c) { const ss = { queue: step.items.map((_, k) => k), back: [], n: 0, shows: 0, done: false }; return ACTS.tap.round(step, ss, c); },
    round(step, ss, c) {
      if (!ss.queue.length) { ss.done = true; ss.cur = null; return ss; }
      ss.cur = ss.queue.shift(); ss.opts = pickTiles(step, step.items[ss.cur], c); ss.wrong = []; ss.out = []; ss.ok = false; ss.shown = false; ss.tries = 0; ss.hinted = false; ss.shows++;
      return ss;
    },
    sig: (step, ss) => `tap:${ss.done ? 'end' : ss.shows}`,
    build(step, ss, c) {
      if (ss.done) return recap(step.items.map(x => x.word), c);
      const it = step.items[ss.cur], w = c.word(it.word) || { full: it.word, pic: '' };
      return `<div class="kp-tap">
        <button class="kp-say" data-say data-anchor="${A(c, 'say')}"><span>🔊</span><b>${esc(w.full)}</b></button>
        <div class="kp-tiles">${ss.opts.map(id => { const o = c.word(id) || { full: id, pic: '' }; return `<button class="kp-tile" data-w="${attrK(id)}" data-anchor="${A(c, 'tile.' + keyOf(id))}"><span class="pic">${o.pic || `<span class="kp-tile-t">${esc(o.full)}</span>`}</span><span class="mk"></span></button>`; }).join('')}</div>
      </div>`;
    },
    sync(stage, step, ss) {
      if (ss.done) return;
      const right = step.items[ss.cur].word;
      stage.querySelectorAll('.kp-tile').forEach(t => {
        const id = t.dataset.w, wrong = ss.wrong.includes(id), out = ss.out.includes(id);
        t.classList.toggle('is-ok', ss.ok && id === right); t.classList.toggle('is-shown', ss.shown && id === right);
        t.classList.toggle('is-wrong', wrong); t.classList.toggle('is-out', out); t.disabled = wrong || out;
      });
    },
    rec(step, ss, c) { const id = step.items[ss.cur].word, w = c.word(id); return { wordId: id, label: w ? w.full : id, item: w ? w.item : id, topic: c.topicOf(w, step), recKey: `${c.sIdx}:${id}`, anchor: A(c, 'tile.' + keyOf(id)), teach: w && w.en ? `${w.full} = ${w.en}` : '' }; },
    reveal(step, ss, c) {
      if (ss.ok || ss.shown || ss.done) return;
      ss.shown = true; const back = ss.back.includes(ss.cur), r = ACTS.tap.rec(step, ss, c);
      c.answer({ ...r, ok: false, shown: true, firstTry: ss.tries === 0 && !back, mode: ss.hinted ? 'hint' : 'choice', given: null, teach: back ? '' : c.L.comesBack, counts: back });
      if (!back) { ss.back.push(ss.cur); ss.queue.push(ss.cur); } else ss.n++;
      c.commit(); c.later(() => { ACTS.tap.round(step, ss, c); c.commit(); if (ss.done) c.finish(); }, 2200);
    },
    hint(step, ss, c) {
      if (ss.ok || ss.shown) return;
      const right = step.items[ss.cur].word, live = ss.opts.filter(id => !ss.wrong.includes(id) && !ss.out.includes(id));
      const w = live.find(id => id !== right);
      if (w && live.length > 2) { ss.out.push(w); ss.hinted = true; c.msg('hint', '💡', '', c.L.oneGone); }
    },
    bind(stage, step, get, c) {
      stage.addEventListener('click', e => {
        const ss = get(); if (ss.done) return;
        const it = step.items[ss.cur];
        if (e.target.closest('[data-say]')) { const w = c.word(it.word); return c.say(w ? w.full : it.word); }
        const t = e.target.closest('.kp-tile'); if (!t || ss.ok || ss.shown || t.disabled) return;
        const back = ss.back.includes(ss.cur), r = ACTS.tap.rec(step, ss, c), firstTry = ss.tries === 0 && !back, mode = ss.hinted ? 'hint' : 'choice';
        if (t.dataset.w === it.word) {
          ss.ok = true; ss.n++;
          c.answer({ ...r, ok: true, first: firstTry && !ss.hinted && !back, firstTry, mode, given: t.dataset.w, counts: !back });
          c.commit(); c.later(() => { ACTS.tap.round(step, ss, c); c.commit(); if (ss.done) c.finish(); }, 1300);
        } else {
          ss.tries++; ss.wrong.push(t.dataset.w);
          if (ss.tries >= 2) { c.answer({ ...r, ok: false, firstTry, mode, given: t.dataset.w }); ss.tries = 1; ACTS.tap.reveal(step, ss, c); }
          else { c.answer({ ...r, ok: false, firstTry, mode, given: t.dataset.w }); c.commit(); }
        }
      });
    },
    count: (step, ss) => (ss.done ? '' : `${Math.min(ss.n + 1, step.items.length)} / ${step.items.length}`),
    progress: (step, ss) => (ss.done ? 1 : ss.n / Math.max(1, step.items.length)),
  },

  match: {
    init: step => ({ left: step.pairs.map(p => p.k), right: step.right && step.right.length === step.pairs.length ? step.right.slice() : shuffle(step.pairs.map(p => p.k)), tries: {}, ok: [], shown: [], selL: null, selR: null, hinted: {}, done: !step.pairs.length }),
    sig: () => 'match',
    build(step, ss, c) {
      const P = k => step.pairs.find(p => p.k === k);
      return `<div class="kp-match"><svg class="kp-lines" aria-hidden="true"></svg>
        <div class="col">${ss.left.map(P).filter(Boolean).map(p => { const w = p.lw && c.word(p.lw); return `<button class="kp-m ${w && w.pic ? 'pic-side' : ''}" data-side="l" data-k="${attrK(p.k)}" data-anchor="${A(c, 'l.' + p.k)}">${w ? (w.pic ? `<span class="pic">${w.pic}</span>` : esc(w.full)) : esc(p.lt)}</button>`; }).join('')}</div>
        <div class="col">${ss.right.map(P).filter(Boolean).map(p => `<button class="kp-m" data-side="r" data-k="${attrK(p.k)}" data-anchor="${A(c, 'r.' + p.k)}">${esc(p.r)}</button>`).join('')}</div></div>`;
    },
    mounted(stage) { const box = stage.querySelector('.kp-match'); if (box) new ResizeObserver(() => ACTS.match.draw(stage)).observe(box); },
    draw(stage) {
      const box = stage.querySelector('.kp-match'); if (!box || !box.isConnected) return; const svg = box.querySelector('svg');
      const b = box.getBoundingClientRect(); svg.setAttribute('viewBox', `0 0 ${b.width} ${b.height}`);
      svg.innerHTML = [...box.querySelectorAll('[data-side="l"].is-done')].map(l => {
        const r = box.querySelector(`[data-side="r"][data-k="${CSS.escape(l.dataset.k)}"]`); if (!r) return '';
        const a = l.getBoundingClientRect(), d = r.getBoundingClientRect();
        return `<line class="${l.classList.contains('is-shown') ? 'shown' : ''}" x1="${a.right - b.left}" y1="${a.top + a.height / 2 - b.top}" x2="${d.left - b.left}" y2="${d.top + d.height / 2 - b.top}"/>`;
      }).join('');
    },
    sync(stage, step, ss) {
      let changed = false;
      stage.querySelectorAll('.kp-m').forEach(b => {
        const k = b.dataset.k, done = ss.ok.includes(k) || ss.shown.includes(k);
        if (b.classList.contains('is-done') !== done) changed = true;
        b.classList.toggle('is-done', done); b.classList.toggle('is-shown', ss.shown.includes(k));
        b.classList.toggle('is-picked', !done && ((b.dataset.side === 'l' && ss.selL === k) || (b.dataset.side === 'r' && ss.selR === k)));
        b.disabled = done;
      });
      if (changed || stage.querySelector('.kp-lines').childElementCount !== ss.ok.length + ss.shown.length) ACTS.match.draw(stage);
    },
    rec(step, k, c) { const p = step.pairs.find(x => x.k === k); const w = p.lw && c.word(p.lw); return { wordId: p.lw || null, label: w ? w.full : `${p.lt} – ${p.r}`, item: p.item || (w ? w.item : null), topic: c.topicOf(w || p, step), recKey: `${c.sIdx}:${k}`, anchor: A(c, 'l.' + k), teach: w && w.en ? `${w.full} = ${w.en}` : '' }; },
    pair(step, ss, c, k, shown, given) {
      if (shown) ss.shown.push(k); else ss.ok.push(k);
      const firstTry = !ss.tries[k], r = ACTS.match.rec(step, k, c), mode = ss.hinted[k] ? 'hint' : 'choice';
      c.answer(shown ? { ...r, ok: false, shown: true, firstTry, mode, given } : { ...r, ok: true, first: firstTry && !ss.hinted[k], firstTry, mode, given });
      if (ss.ok.length + ss.shown.length === step.pairs.length) { ss.done = true; c.finish(); }
    },
    hint(step, ss, c) { const k = ss.left.find(x => !ss.ok.includes(x) && !ss.shown.includes(x)); if (!k) return; ss.hinted[k] = true; c.fx('glow', A(c, 'l.' + k)); c.fx('glow', A(c, 'r.' + k)); c.msg('hint', '💡', '', c.L.together); },
    reveal(step, ss, c) { const k = ss.selL && !ss.ok.includes(ss.selL) && !ss.shown.includes(ss.selL) ? ss.selL : ss.left.find(x => !ss.ok.includes(x) && !ss.shown.includes(x)); if (k) { ss.selL = ss.selR = null; ACTS.match.pair(step, ss, c, k, true, null); } },
    bind(stage, step, get, c) {
      stage.addEventListener('click', e => {
        const ss = get(); const b = e.target.closest('.kp-m'); if (!b || b.disabled || ss.done) return;
        const k = b.dataset.k;
        if (b.dataset.side === 'l') ss.selL = ss.selL === k ? null : k; else { ss.selR = ss.selR === k ? null : k; const p = step.pairs.find(x => x.k === k); c.say(p.r); }
        if (ss.selL && ss.selR) {
          const l = ss.selL, r = ss.selR; ss.selL = ss.selR = null;
          if (l === r) ACTS.match.pair(step, ss, c, l, false, step.pairs.find(x => x.k === r).r);
          else {
            c.fx('shake', A(c, 'l.' + l)); c.fx('shake', A(c, 'r.' + r));
            const firstTry = !ss.tries[l]; ss.tries[l] = (ss.tries[l] || 0) + 1;
            const rr = ACTS.match.rec(step, l, c), given = step.pairs.find(x => x.k === r).r, mode = ss.hinted[l] ? 'hint' : 'choice';
            c.answer({ ...rr, ok: false, firstTry, mode, given });
            if (ss.tries[l] >= 2) ACTS.match.pair(step, ss, c, l, true, given);
          }
        }
        c.commit();
      });
    },
    count: (step, ss) => `${ss.ok.length + ss.shown.length} / ${step.pairs.length}`,
    progress: (step, ss) => (ss.ok.length + ss.shown.length) / Math.max(1, step.pairs.length),
  },

  sort: {
    init: step => ({ tray: step.cards.map(x => x.k), placed: {}, shown: [], tries: {}, picked: null, waiting: null, drag: null, hinted: false, done: !step.cards.length }),
    sig: () => 'sort',
    chip(step, k, c) { const cd = step.cards.find(x => x.k === k), w = c.word(cd.w); return `<button class="kp-chip ${w && w.pic ? 'pic-chip' : ''}" data-k="${attrK(k)}" data-anchor="${A(c, 'chip.' + k)}">${w && w.pic ? `<span class="pic">${w.pic}</span>` : ''}<span>${esc(w ? w.full : cd.w)}</span></button>`; },
    got(step, k, ss, c, isNew) { const cd = step.cards.find(x => x.k === k), w = c.word(cd.w); return `<i class="${ss.shown.includes(k) ? 'shown' : ''} ${isNew ? 'new' : ''}" data-k="${attrK(k)}">${w && w.pic ? w.pic : `<small>${esc(w ? w.full : cd.w)}</small>`}</i>`; },
    build(step, ss, c) {
      return `<div class="kp-sort">
        <div class="kp-tray" data-anchor="${A(c, 'tray')}">${ss.tray.filter(k => !ss.placed[k] && step.cards.some(x => x.k === k)).map(k => ACTS.sort.chip(step, k, c)).join('')}</div>
        <p class="kp-tip">${esc(c.L.dragTip)}</p>
        <div class="kp-baskets">${step.baskets.map(b => `<button class="kp-basket" data-b="${attrK(b.id)}" data-anchor="${A(c, 'basket.' + keyOf(b.id))}"><span class="got">${Object.keys(ss.placed).filter(k => ss.placed[k] === b.id).map(k => ACTS.sort.got(step, k, ss, c)).join('')}</span><span class="lbl"><b>${esc(b.label)}</b><small>${esc(b.sub || '')}</small></span></button>`).join('')}</div>
      </div>`;
    },
    sync(stage, step, ss, c) {
      stage.querySelectorAll('.kp-chip').forEach(ch => { const k = ch.dataset.k; if (ss.placed[k]) ch.remove(); else { ch.classList.toggle('is-picked', ss.picked === k); ch.classList.toggle('is-dragging', ss.drag === k); } });
      stage.querySelectorAll('.kp-basket').forEach(b => {
        const got = b.querySelector('.got'), have = new Set([...got.children].map(i => i.dataset.k));
        Object.keys(ss.placed).filter(k => ss.placed[k] === b.dataset.b && !have.has(k)).forEach(k => got.insertAdjacentHTML('beforeend', ACTS.sort.got(step, k, ss, c, true)));
        b.classList.toggle('is-target', ss.waiting === b.dataset.b);
      });
      stage.querySelector('.kp-sort').classList.toggle('has-pick', !!ss.picked);
    },
    place(step, ss, c, k, shown, given) {
      const cd = step.cards.find(x => x.k === k), w = c.word(cd.w), lbl = step.baskets.find(x => x.id === cd.b).label;
      ss.placed[k] = cd.b; if (shown) ss.shown.push(k); ss.picked = ss.waiting = null;
      c.fx('bump', A(c, 'basket.' + keyOf(cd.b)));
      const firstTry = !ss.tries[k], label = w ? w.full : cd.w, mode = ss.hinted ? 'hint' : 'choice';
      const r = { wordId: w ? cd.w : null, label, item: w ? w.item : null, topic: c.topicOf(w, step), recKey: `${c.sIdx}:${k}`, anchor: A(c, 'basket.' + keyOf(cd.b)), given };
      c.answer(shown ? { ...r, ok: false, shown: true, firstTry, mode, teach: `${cap(label)}: ${lbl.toLowerCase()}.` } : { ...r, ok: true, first: firstTry && !ss.hinted, firstTry, mode, teach: `${cap(label)}: ${lbl.toLowerCase()}.` });
      ss.hinted = false;
      if (Object.keys(ss.placed).length === step.cards.length) { ss.done = true; c.finish(); }
    },
    hint(step, ss, c) { ss.hinted = true; c.msg('hint', '💡', '', step.hint || c.L.lookPic); },
    reveal(step, ss, c) { const k = (ss.picked && !ss.placed[ss.picked]) ? ss.picked : ss.tray.find(x => !ss.placed[x]); if (k) ACTS.sort.place(step, ss, c, k, true, null); },
    bind(stage, step, get, c) {
      dragTap(stage, {
        piece: '.kp-chip', target: '.kp-basket',
        onPick(p) { get().picked = p ? p.dataset.k : null; c.commit(); },
        onWait(t) { get().waiting = t ? t.dataset.b : null; c.commit(); },
        onDrag(p) { get().drag = p ? p.dataset.k : null; c.commit(); },
        onDrop(chip, basket) {
          const ss = get(), k = chip.dataset.k, cd = step.cards.find(x => x.k === k); if (!cd || ss.placed[k]) return;
          ss.picked = ss.waiting = null;
          if (cd.b === basket.dataset.b) { ACTS.sort.place(step, ss, c, k, false, basket.dataset.b); return c.commit(); }
          c.fx('shake', A(c, 'chip.' + k)); c.fx('nope', A(c, 'basket.' + keyOf(basket.dataset.b)));
          const firstTry = !ss.tries[k]; ss.tries[k] = (ss.tries[k] || 0) + 1;
          const w = c.word(cd.w);
          c.answer({ ok: false, label: w ? w.full : cd.w, wordId: w ? cd.w : null, item: w ? w.item : null, topic: c.topicOf(w, step), recKey: `${c.sIdx}:${k}`, firstTry, mode: ss.hinted ? 'hint' : 'choice', given: basket.dataset.b, anchor: A(c, 'chip.' + k) });
          c.commit();
          if (ss.tries[k] >= 2) c.soon(() => { const s2 = get(); if (s2 === ss && !ss.placed[k]) { ACTS.sort.place(step, ss, c, k, true, null); c.commit(); } }, 500);
        },
      });
    },
    count: (step, ss) => `${Object.keys(ss.placed).length} / ${step.cards.length}`,
    progress: (step, ss) => Object.keys(ss.placed).length / Math.max(1, step.cards.length),
  },

  gap: {
    init(step) {
      const S = step.sentences, ss = { filled: {}, tries: {}, hintLv: {}, typed: {}, wrongOpt: {}, out: [], bad: -1, cur: 0, picked: null, waiting: null, drag: null, done: !S.length, opts: {} };
      const cnt = {}, chip = w => { const b = keyOf(w); cnt[b] = (cnt[b] || 0) + 1; return { k: cnt[b] > 1 ? `${b}~${cnt[b] - 1}` : b, w }; };
      if (step.mode === 'drag' && step.bank && step.bank.length) ss.bank = step.bank.map(chip);     // given order
      else if (step.mode === 'drag') {
        let extra = step.extra || [];
        if (!step.extra) { const answers = new Set(S.map(x => normAnswer(x.answer))); const d = []; S.forEach(x => (x.options || []).forEach(o => { if (!answers.has(normAnswer(o)) && !d.includes(o)) d.push(o); })); extra = shuffle(d).slice(0, Math.max(1, Math.ceil(S.length / 4))); }
        ss.bank = shuffle([...S.map(x => x.answer), ...extra]).map(chip);
      }
      if (step.mode === 'choice') S.forEach((x, i) => {
        if (x.options && x.options.length >= 2) {        // given order
          const o = [...new Set(x.options)]; if (!o.some(v => normAnswer(v) === normAnswer(x.answer))) o.push(x.answer);
          ss.opts[i] = o; return;
        }
        ss.opts[i] = shuffle([...new Set(S.map(y => y.answer))]).slice(0, 4);
        if (!ss.opts[i].some(v => normAnswer(v) === normAnswer(x.answer))) ss.opts[i][0] = x.answer;
      });
      return ss;
    },
    sig: (step, ss) => 'gap:' + step.mode,
    ok: (x, given) => [x.answer, ...(x.accepts || [])].some(a => normAnswer(a) === normAnswer(given)),
    open: (step, ss) => step.sentences.findIndex((_, i) => !ss.filled[i]),
    current(step, ss) { if (ss.waiting != null && !ss.filled[ss.waiting]) return ss.waiting; if (ss.cur != null && !ss.filled[ss.cur] && ss.cur < step.sentences.length) return ss.cur; return ACTS.gap.open(step, ss); },
    build(step, ss, c) {
      const mode = step.mode;
      const sents = step.sentences.map((x, i) => {
        const parts = String(x.text).split('___'); const a = parts[0], b = parts.slice(1).join('___');
        const slot = mode === 'typed'
          ? `<span class="kp-typewrap"><input class="kp-type" data-i="${i}" data-anchor="${A(c, 'slot' + i)}" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="gap ${i + 1}" ${c.mirror ? 'readonly tabindex="-1"' : ''}></span>`
          : `<button class="kp-slot" data-i="${i}" data-anchor="${A(c, 'slot' + i)}" aria-label="gap ${i + 1}"></button>`;
        const opts = mode === 'choice' ? `<span class="kp-opts" data-opts="${i}">${(ss.opts[i] || []).map(o => `<button class="kp-chip kp-opt" data-i="${i}" data-word="${esc(o)}" data-anchor="${A(c, `gap${i}.opt.${keyOf(o)}`)}">${esc(o)}</button>`).join('')}</span>` : '';
        const check = mode === 'typed' && !c.mirror ? `<button class="kp-check" data-check="${i}" data-anchor="${A(c, 'check' + i)}" aria-label="${esc(c.L.check)}">↵</button>` : '';
        return `<li data-i="${i}" data-anchor="${A(c, 'gap' + i)}"><span class="num">${i + 1}</span><span class="txt">${esc(a)}${slot}${esc(b)}${x.clue ? ` <span class="kp-clue" data-anchor="${A(c, `gap${i}.clue`)}">(${esc(x.clue)})</span>` : ''}${x.en ? `<small class="kp-en" hidden>${esc(x.en)}</small>` : ''}${opts}</span>${check}<span class="mk"></span></li>`;
      }).join('');
      const bank = mode === 'drag' ? `<div class="kp-bank" data-anchor="${A(c, 'bank')}"><span class="kp-banklbl">${esc(c.L.bank)}</span>${ss.bank.map(x => `<button class="kp-chip" data-k="${attrK(x.k)}" data-word="${esc(x.w)}" data-anchor="${A(c, 'opt.' + x.k)}">${esc(x.w)}</button>`).join('')}</div>` : '';
      const acc = mode === 'typed' ? `<div class="kp-acc" data-anchor="${A(c, 'acc')}">${ACCENTS.map(ch => `<button class="kp-accbtn" data-acc="${ch}" data-anchor="${A(c, 'acc.' + ch)}" tabindex="-1">${ch}</button>`).join('')}</div>` : '';
      return `<div class="kp-gap is-${mode}"><ol class="kp-sents">${sents}</ol>${bank}${acc}</div>`;
    },
    sync(stage, step, ss, c) {
      const curI = ACTS.gap.current(step, ss);
      const used = new Set(Object.values(ss.filled).map(f => f.k).filter(Boolean));
      step.sentences.forEach((x, i) => {
        const li = stage.querySelector(`li[data-i="${i}"]`); if (!li) return;
        const f = ss.filled[i], lv = ss.hintLv[i] || 0;
        li.classList.toggle('done', !!f); li.classList.toggle('is-cur', !f && i === curI);
        li.querySelector('.mk').textContent = f ? (f.shown ? '→' : '✓') : (ss.bad === i ? '✗' : '');
        const en = li.querySelector('.kp-en'); if (en) en.hidden = !(lv >= 1 || f);
        if (step.mode === 'typed') {
          const inp = li.querySelector('.kp-type'), v = f ? x.answer : (ss.typed[i] || '');
          if (inp.value !== v) inp.value = v;
          inp.readOnly = c.mirror || !!f; inp.classList.toggle('is-ok', !!f && !f.shown); inp.classList.toggle('is-shown', !!f && !!f.shown);
          inp.classList.toggle('is-bad', !f && ss.bad === i); inp.classList.toggle('is-focus', c.mirror && !f && ss.focus === i);
          inp.placeholder = f ? '' : lv >= 3 ? x.answer.slice(0, Math.ceil(x.answer.length / 2)) + '…' : lv >= 2 ? x.answer[0] + '…' : '';
          inp.style.width = `calc(${Math.max(4, v.length) * 1.15}ch + 26px)`;   // grows with the text, never hints at the answer length
          const ck = li.querySelector('.kp-check'); if (ck) ck.hidden = !!f;
        } else {
          const s = li.querySelector('.kp-slot');
          s.textContent = f ? x.answer : (lv >= 3 ? x.answer[0] + '…' : '');
          s.classList.toggle('is-full', !!f); s.classList.toggle('is-ok', !!f && !f.shown); s.classList.toggle('is-shown', !!f && !!f.shown);
          s.classList.toggle('is-target', !f && (ss.waiting === i || (step.mode === 'choice' && i === curI))); s.disabled = !!f;
        }
        if (step.mode === 'choice') {
          const row = li.querySelector('.kp-opts'); row.hidden = !!f || i !== curI;
          row.querySelectorAll('.kp-opt').forEach(o => { const bad = (ss.wrongOpt[i] || []).includes(o.dataset.word); o.disabled = bad; o.classList.toggle('is-out', bad); });
        }
      });
      if (step.mode === 'drag') stage.querySelectorAll('.kp-bank .kp-chip').forEach(ch => {
        const k = ch.dataset.k; ch.hidden = used.has(k);
        ch.classList.toggle('is-out', ss.out.includes(k)); ch.disabled = ss.out.includes(k); ch.classList.toggle('is-picked', ss.picked === k); ch.classList.toggle('is-dragging', ss.drag === k);
      });
      const g = stage.querySelector('.kp-gap'); g.classList.toggle('has-pick', !!ss.picked);
      const acc = stage.querySelector('.kp-acc'); if (acc) acc.hidden = ss.done;
    },
    rec(step, i, c) { const x = step.sentences[i]; return { label: x.text.replace('___', x.answer), item: x.item, topic: x.item ? c.topicOf(x, step) : null, form: x.form, recKey: `${c.sIdx}:${i}`, anchor: A(c, 'gap' + i), teach: x.teach }; },
    fill(step, ss, c, i, shown, given, chipK) {
      const x = step.sentences[i];
      if (!chipK && step.mode === 'drag') { const used = new Set(Object.values(ss.filled).map(f => f.k)); const ch = ss.bank.find(b => !used.has(b.k) && normAnswer(b.w) === normAnswer(x.answer)); chipK = ch && ch.k; }
      ss.filled[i] = { shown: !!shown, k: chipK || null }; ss.bad = -1; ss.waiting = ss.picked = null;
      const firstTry = !ss.tries[i], mode = (ss.hintLv[i] ? 'hint' : step.mode === 'typed' ? 'typed' : 'choice');
      c.answer(shown ? { ...ACTS.gap.rec(step, i, c), ok: false, shown: true, firstTry, mode, given } : { ...ACTS.gap.rec(step, i, c), ok: true, first: firstTry && !ss.hintLv[i], firstTry, mode, given });
      const nx = ACTS.gap.open(step, ss); ss.cur = nx < 0 ? null : nx;
      if (nx < 0) { ss.done = true; c.finish(); }
    },
    wrong(step, ss, c, i, given, chipA) {
      const firstTry = !ss.tries[i]; ss.tries[i] = (ss.tries[i] || 0) + 1; ss.bad = i;
      c.fx('shake', A(c, 'slot' + i)); if (chipA) c.fx('shake', chipA);
      const mode = ss.hintLv[i] ? 'hint' : step.mode === 'typed' ? 'typed' : 'choice';
      c.answer({ ...ACTS.gap.rec(step, i, c), ok: false, firstTry, mode, given });
      c.soon(() => { if (ss.bad === i && !ss.filled[i]) { ss.bad = -1; c.commit(); } }, 1200);
      if (ss.tries[i] >= 2) c.soon(() => { if (!ss.filled[i]) { ACTS.gap.fill(step, ss, c, i, true, null); c.commit(); } }, 500);
    },
    hint(step, ss, c) {
      const i = ACTS.gap.current(step, ss); if (i < 0) return; const x = step.sentences[i];
      let lv = ss.hintLv[i] = (ss.hintLv[i] || 0) + 1;
      if (lv === 1 && !x.en) lv = ss.hintLv[i] = 2;
      c.fx('hinting', A(c, 'gap' + i));
      if (lv === 1) c.msg('hint', '💡', c.L.inEnglish(i + 1), x.en);
      else if (lv === 2 && step.mode !== 'typed') {
        let gone = null;
        if (step.mode === 'drag') { const used = new Set(Object.values(ss.filled).map(f => f.k)); const w = ss.bank.find(b => !used.has(b.k) && !ss.out.includes(b.k) && normAnswer(b.w) !== normAnswer(x.answer)); if (w) { ss.out.push(w.k); gone = w.w; } }
        else { const w = (ss.opts[i] || []).find(o => normAnswer(o) !== normAnswer(x.answer) && !(ss.wrongOpt[i] || []).includes(o)); if (w) { (ss.wrongOpt[i] = ss.wrongOpt[i] || []).push(w); gone = w; } }
        if (gone) c.msg('hint', '💡', '', c.L.notGrey(gone)); else c.msg('hint', '💡', '', `${c.L.startsWith} ${x.answer[0]}.`);
      } else c.msg('hint', '💡', '', `${c.L.startsWith} ${x.answer[0]}.`);
    },
    reveal(step, ss, c) { const i = ACTS.gap.current(step, ss); if (i >= 0) ACTS.gap.fill(step, ss, c, i, true, step.mode === 'typed' ? (ss.typed[i] || null) : null); },
    bind(stage, step, get, c) {
      if (step.mode === 'drag') {
        dragTap(stage, {
          piece: '.kp-bank .kp-chip', target: '.kp-slot',
          onPick(p) { get().picked = p ? p.dataset.k : null; c.commit(); },
          onWait(t) { const ss = get(); ss.waiting = t ? +t.dataset.i : null; if (t) ss.cur = +t.dataset.i; c.commit(); },
          onDrag(p) { get().drag = p ? p.dataset.k : null; c.commit(); },
          onDrop(chip, s) {
            const ss = get(), i = +s.dataset.i; if (ss.filled[i]) return;
            ss.picked = ss.waiting = null; ss.cur = i;
            if (ACTS.gap.ok(step.sentences[i], chip.dataset.word)) ACTS.gap.fill(step, ss, c, i, false, chip.dataset.word, chip.dataset.k);
            else ACTS.gap.wrong(step, ss, c, i, chip.dataset.word, A(c, 'opt.' + chip.dataset.k));
            c.commit();
          },
        });
      }
      if (step.mode === 'choice') {
        stage.addEventListener('click', e => {
          const ss = get(), o = e.target.closest('.kp-opt'), s = e.target.closest('.kp-slot');
          if (s && !ss.filled[+s.dataset.i]) { ss.cur = +s.dataset.i; return c.commit(); }
          if (!o || o.disabled) return; const i = +o.dataset.i; if (ss.filled[i]) return;
          ss.cur = i;
          if (ACTS.gap.ok(step.sentences[i], o.dataset.word)) ACTS.gap.fill(step, ss, c, i, false, o.dataset.word);
          else { (ss.wrongOpt[i] = ss.wrongOpt[i] || []).push(o.dataset.word); ACTS.gap.wrong(step, ss, c, i, o.dataset.word, o.dataset.anchor); }
          c.commit();
        });
      }
      if (step.mode === 'typed') {
        let lastInput = null;
        const check = i => {
          const ss = get(); if (ss.filled[i]) return; const v = (ss.typed[i] || '').trim(); if (!v) return;
          if (ACTS.gap.ok(step.sentences[i], v)) {
            ACTS.gap.fill(step, ss, c, i, false, v); c.commit();
            const nx = stage.querySelector(`.kp-type[data-i="${ss.cur}"]`); if (nx && ss.cur != null) nx.focus();
          } else { ACTS.gap.wrong(step, ss, c, i, v); c.commit(); }
        };
        stage.addEventListener('input', e => { const t = e.target.closest('.kp-type'); if (!t) return; const ss = get(), i = +t.dataset.i; ss.typed[i] = t.value; if (ss.bad === i) ss.bad = -1; c.commit(); });
        stage.addEventListener('focusin', e => { const t = e.target.closest('.kp-type'); if (!t) return; lastInput = t; const ss = get(); ss.focus = +t.dataset.i; if (!ss.filled[ss.focus]) ss.cur = ss.focus; c.commit(); });
        stage.addEventListener('keydown', e => { const t = e.target.closest('.kp-type'); if (t && e.key === 'Enter') { e.preventDefault(); check(+t.dataset.i); } });
        stage.addEventListener('pointerdown', e => { if (e.target.closest('.kp-accbtn, .kp-check')) e.preventDefault(); });   // keep the focus in the input
        stage.addEventListener('click', e => {
          const ck = e.target.closest('[data-check]'); if (ck) return check(+ck.dataset.check);
          const a = e.target.closest('[data-acc]'); if (!a) return;
          const ss = get(); const inp = (lastInput && !ss.filled[+lastInput.dataset.i]) ? lastInput : stage.querySelector(`.kp-type[data-i="${ACTS.gap.current(step, ss)}"]`); if (!inp || inp.readOnly) return;
          const s0 = inp.selectionStart ?? inp.value.length, s1 = inp.selectionEnd ?? s0;
          inp.value = inp.value.slice(0, s0) + a.dataset.acc + inp.value.slice(s1); inp.focus(); inp.setSelectionRange(s0 + 1, s0 + 1);
          inp.dispatchEvent(new Event('input', { bubbles: true }));
        });
      }
    },
    mounted(stage, step, ss, c) { if (!c.mirror && step.mode === 'typed') { const i = ACTS.gap.current(step, ss); const inp = stage.querySelector(`.kp-type[data-i="${i}"]`); if (inp && matchMedia('(pointer: fine)').matches) setTimeout(() => inp.isConnected && inp.focus({ preventScroll: true }), 50); } },
    count: (step, ss) => `${Object.keys(ss.filled).length} / ${step.sentences.length}`,
    progress: (step, ss) => Object.keys(ss.filled).length / Math.max(1, step.sentences.length),
  },
};
