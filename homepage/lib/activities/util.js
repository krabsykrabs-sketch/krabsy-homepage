// Shared helpers for the activity player and the book reader (docs/live-classroom.md):
// escaping, speech, vocabulary, labels, anchors and the overlay layer that draws
// the tutor's pulse (student side) and the student's ghost hand (mirror side).

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Attribute-safe key for anchors / data attributes (keeps letters incl. accents, digits, - _).
export const keyOf = s => String(s ?? '').trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\p{L}\p{N}_-]/gu, '') || '_';

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export const reducedMotion = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } };

// Speech in the LEARNING language (owner 2026-11-26: "Spanish words are pronounced English").
// Browsers load their voice list late (Chrome: empty on the first call), and without an
// explicit voice they read with the default voice (English on an English computer). So we
// load the list early, wait for it (max 1.5 s) and pick a voice of that language:
// Latin-American Spanish first (Uruguay/Argentina learners), then Spain; natural/online
// voices ("Google", "Natural", "Online") before the robotic ones.
const SPEECH_LANG = { es: 'es-419', en: 'en-GB', de: 'de-DE' };
const PREFER = { es: ['es-419', 'es-us', 'es-mx', 'es-ar', 'es-uy', 'es-co', 'es-cl', 'es-es', 'es'], en: ['en-gb', 'en-us', 'en'], de: ['de-de', 'de'] };
let voicesReady = null;
function loadVoices() {
  if (voicesReady) return voicesReady;
  voicesReady = new Promise((resolve) => {
    try {
      const now = speechSynthesis.getVoices();
      if (now.length) return resolve(now);
      const done = () => resolve(speechSynthesis.getVoices());
      speechSynthesis.addEventListener('voiceschanged', done, { once: true });
      setTimeout(done, 1500);
    } catch (_) { resolve([]); }
  });
  return voicesReady;
}
try { if (typeof speechSynthesis !== 'undefined') loadVoices(); } catch (_) {}
export function pickVoice(voices, learn) {
  const base = String(learn || 'es').toLowerCase().slice(0, 2);
  const mine = voices.filter((v) => String(v.lang).toLowerCase().replace('_', '-').startsWith(base));
  if (!mine.length) return null;
  const order = PREFER[base] || [base];
  const rank = (v) => {
    const l = String(v.lang).toLowerCase().replace('_', '-');
    let r = order.findIndex((p) => l.startsWith(p)); if (r < 0) r = order.length;
    const good = /google|natural|online|neural|premium|enhanced/i.test(v.name) ? 0 : 1;
    return r * 2 + good;
  };
  return mine.sort((a, b) => rank(a) - rank(b))[0];
}
export function speak(text, learn = 'es') {
  try {
    if (typeof speechSynthesis === 'undefined' || !text) return;
    const say = (voices) => {
      const v = pickVoice(voices, learn);
      // Voices known but none speaks this language: stay silent rather than read Spanish
      // with an English voice (Chrome and Edge always have Spanish voices).
      if (!v && voices.length) return;
      const u = new SpeechSynthesisUtterance(text);
      if (v) { u.voice = v; u.lang = v.lang; } else u.lang = SPEECH_LANG[learn] || learn;
      u.rate = 0.85;
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    };
    // Voices known: speak right now (Safari/iPad only allow speech directly after a tap).
    const now = speechSynthesis.getVoices();
    if (now.length) say(now); else loadVoices().then(say);
  } catch (_) { /* no speech in this browser */ }
}

/* The tutor does it on the student's screen (live "act", 2026-11-27): click the element
   with this anchor (pick a word, tap a picture, choose a basket, turn a page; a drag is
   click word → click gap), or type into / press Enter in a typing gap. Answers that result
   from it are the tutor's, not the student's (the player marks them). */
export function actOn(root, c) {
  if (!root || !c || typeof c.a !== 'string') return false;
  let el = null;
  try { el = root.querySelector(`[data-anchor="${CSS.escape(c.a)}"]`); } catch (_) { return false; }
  if (!el) return false;
  // forgiving: a click on a row/box that holds exactly ONE clickable thing (e.g. the gap in a
  // sentence row) means that thing; typing into a row means its input
  const clickable = (e) => e.matches('button, input, textarea, a[href], [role="button"]');
  if (!clickable(el)) {
    const inner = [...el.querySelectorAll('button:not(:disabled), input:not([readonly]), textarea')];
    const inputs = inner.filter((e) => e.matches('input, textarea'));
    if ((c.kind === 'type' || c.kind === 'enter') && inputs.length === 1) el = inputs[0];
    else if (c.kind === 'click' && inner.length === 1) el = inner[0];
  }
  if (c.kind === 'type' && el.matches('input, textarea')) {
    el.focus({ preventScroll: true }); el.value = String(c.text || '').slice(0, 80);
    el.dispatchEvent(new Event('input', { bubbles: true })); return true;
  }
  if (c.kind === 'enter' && el.matches('input, textarea')) {
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); return true;
  }
  if (c.kind === 'click') {
    if (el.matches('input, textarea')) { el.focus({ preventScroll: true }); el.dispatchEvent(new FocusEvent('focusin', { bubbles: true })); return true; }
    el.click(); return true;
  }
  return false;
}

/* ── Vocabulary ─────────────────────────────────────────────────────────────
   Served shape (homepage/data/vocab/<learn>.json):
     { "<wordId>": { "es": "la vaca", "en": "cow", "de": "Kuh", "emoji": "🐄", "img"?: "/…" } }
   The prototype's array shape [{id, full, en, pic}] is accepted too. */
const vocabCache = {};
export function loadVocab(learn = 'es') {
  if (!vocabCache[learn]) {
    vocabCache[learn] = fetch(`/data/vocab/${learn}.json`).then(r => (r.ok ? r.json() : {})).catch(() => ({}));
  }
  return vocabCache[learn];
}

export function makeWords(vocab, learn = 'es', lang = 'en') {
  const map = {};
  if (Array.isArray(vocab)) vocab.forEach(v => { map[v.id] = v; });
  else if (vocab && typeof vocab === 'object') Object.assign(map, vocab);
  const cache = {};
  const word = function (id) {
    if (id == null) return null;
    if (cache[id]) return cache[id];
    const v = map[id];
    if (!v) return null;
    const full = v.full || v[learn] || v.es || String(id);
    const both = v.f ? `${full} · ${v.f}` : full;          // contento · contenta
    const mean = v[lang] || v.en || '';
    const pic = v.img ? `<img class="ka-img" src="${esc(v.img)}" alt="">` : esc(v.pic || v.emoji || '');
    return (cache[id] = { id, full, en: mean, pic, both, set: v.set || v.group || '', topic: v.topic || '', item: v.item || (v.topic ? id : null) });
  };
  word.all = () => Object.keys(map);
  return word;
}

/* ── Interface labels (interface language = opts.lang) ───────────────────── */
const L = {
  en: { text: 'Start', cards: 'Picture cards', tap: 'Tap the picture', match: 'Match the pairs', sort: 'Sort into baskets', gap: 'Fill the gaps',
    hint: '💡 Hint', go: 'Let’s go! ›', turn: 'Tap to turn', listen: '🔊 listen', again: '↺ Again later', know: '✓ I know it',
    seen: n => `${n} cards seen.`, seenTail: 'Now let’s play with them.', notQuite: 'Not quite.', tryAgain: 'Try once more.', itIs: 'It is',
    comesBack: 'It comes back once at the end.', oneGone: 'One picture is gone. Listen again: tap the word.', together: 'Look: these two belong together.',
    lookPic: 'Look at the picture.', dragTip: 'Drag a card into a basket. Or tap the card, then the basket.', bank: 'Word bank', inEnglish: n => `Sentence ${n} in English:`,
    notGrey: w => `It is not “${w}”.`, startsWith: 'It starts with', check: 'Check', typeHere: 'type…', choose: 'Choose the word',
    finished: 'Finished', hooray: '¡Lo lograste!', stars: n => `⭐ ${n} star${n === 1 ? '' : 's'}`, firstTry: (a, b) => `<b>${a} of ${b}</b> right at first try`, tasks: n => `You did ${n} task${n === 1 ? '' : 's'}!`,
    practise: 'Words to practise', allRight: 'Nothing to practise. Everything right!', playAgain: '↺ Play again', gift: 'A gift from your tutor!',
    showEn: 'Show in English', hideEn: 'Hide English', tapDotted: 'Tap the dotted words!', question: '¡Una pregunta!', tapRight: 'Tap the right picture.',
    lookAgain: '✗ Not quite. Look again.', inAlbum: '★ in your word album', wordsMet: 'Words you met', quick: (a, b) => `Three quick questions · ${a} of ${b}`,
    theEnd: '¡Fin!', read: '¡Leído!', sayIt: '🗣 Say it to your tutor', sayItText: t => `¿Cuál es tu animal favorito? Tell ${t} in your next lesson.`,
    page: (a, b) => `page ${a} of ${b}`, qPage: 'question', endPage: 'the end', prev: 'Page back', next: 'Next page', close: 'Close' },
  de: { text: 'Los', cards: 'Bildkarten', tap: 'Tippe auf das Bild', match: 'Finde die Paare', sort: 'Sortiere in die Körbe', gap: 'Fülle die Lücken',
    hint: '💡 Tipp', go: 'Los geht’s! ›', turn: 'Tippen zum Umdrehen', listen: '🔊 anhören', again: '↺ Später nochmal', know: '✓ Kann ich',
    seen: n => `${n} Karten angesehen.`, seenTail: 'Jetzt spielen wir damit.', notQuite: 'Noch nicht ganz.', tryAgain: 'Versuch es nochmal.', itIs: 'Es ist',
    comesBack: 'Es kommt am Ende noch einmal.', oneGone: 'Ein Bild ist weg. Hör nochmal: tippe auf das Wort.', together: 'Schau: diese zwei gehören zusammen.',
    lookPic: 'Schau dir das Bild an.', dragTip: 'Zieh eine Karte in einen Korb. Oder tippe auf die Karte, dann auf den Korb.', bank: 'Wörter', inEnglish: n => `Satz ${n} auf Deutsch:`,
    notGrey: w => `Es ist nicht „${w}“.`, startsWith: 'Es beginnt mit', check: 'Prüfen', typeHere: 'tippen…', choose: 'Wähle das Wort',
    finished: 'Fertig', hooray: '¡Lo lograste!', stars: n => `⭐ ${n} Stern${n === 1 ? '' : 'e'}`, firstTry: (a, b) => `<b>${a} von ${b}</b> beim ersten Versuch richtig`, tasks: n => `Du hast ${n} Aufgabe${n === 1 ? '' : 'n'} gemacht!`,
    practise: 'Wörter zum Üben', allRight: 'Nichts zu üben. Alles richtig!', playAgain: '↺ Nochmal', gift: 'Ein Geschenk von deiner Lehrkraft!',
    showEn: 'Auf Deutsch zeigen', hideEn: 'Deutsch ausblenden', tapDotted: 'Tippe auf die gepunkteten Wörter!', question: '¡Una pregunta!', tapRight: 'Tippe auf das richtige Bild.',
    lookAgain: '✗ Noch nicht. Schau nochmal.', inAlbum: '★ in deinem Wortalbum', wordsMet: 'Deine neuen Wörter', quick: (a, b) => `Drei kurze Fragen · ${a} von ${b}`,
    theEnd: '¡Fin!', read: '¡Leído!', sayIt: '🗣 Sag es deiner Lehrkraft', sayItText: t => `¿Cuál es tu animal favorito? Erzähl es ${t} in der nächsten Stunde.`,
    page: (a, b) => `Seite ${a} von ${b}`, qPage: 'Frage', endPage: 'Ende', prev: 'Zurück', next: 'Weiter', close: 'Schließen' },
};
export const labels = lang => L[lang] || L.en;

/* ── Anchors ────────────────────────────────────────────────────────────────
   Every meaningful element carries data-anchor. Positions travel as {a, x, y}
   (anchor + 0..1 inside it), so they land on the same thing on both screens. */
export function findAnchor(root, a) {
  if (!a) return null;
  let key = String(a);
  for (;;) {
    const el = root.querySelector(`[data-anchor="${CSS.escape(key)}"]`);
    if (el && el.getClientRects().length) return el;
    const cut = Math.max(key.lastIndexOf('.'), key.lastIndexOf('~'));
    if (cut <= 0) break;
    key = key.slice(0, cut);            // s2.opt.vaca → s2.opt → s2
  }
  return root.querySelector('[data-anchor="step"]') || root.querySelector('[data-anchor]');
}

export function anchorAt(root, clientX, clientY) {
  const r0 = root.getBoundingClientRect();
  if (clientX < r0.left || clientX > r0.right || clientY < r0.top || clientY > r0.bottom) return null;
  let el = null;
  try {
    const stack = document.elementsFromPoint(clientX, clientY);
    for (const e of stack) {
      if (e.closest('.ka-layer') || e.classList.contains('drag-ghost')) continue;
      if (!root.contains(e)) break;
      el = e.closest('[data-anchor]'); if (el && root.contains(el)) break; el = null;
    }
  } catch (_) { /* old browser */ }
  if (!el) el = root.querySelector('[data-anchor]') || root;
  const r = el.getBoundingClientRect();
  const cl = v => Math.round(Math.min(1, Math.max(0, v)) * 1000) / 1000;
  return { a: el.dataset.anchor || 'root', x: cl(r.width ? (clientX - r.left) / r.width : 0.5), y: cl(r.height ? (clientY - r.top) / r.height : 0.5) };
}

/* ── Overlay layer: tutor pulse + ghost hand ─────────────────────────────── */
export function overlay(host) {
  const layer = document.createElement('div');
  layer.className = 'ka-layer'; layer.setAttribute('aria-hidden', 'true');
  host.appendChild(layer);
  let hand = null, handPos = null, handTimer = null, carry = null;
  const place = (el, pos) => {
    const t = findAnchor(host, pos.a); if (!t) return false;
    const hr = host.getBoundingClientRect(), r = t.getBoundingClientRect();
    const k = host.offsetWidth ? hr.width / host.offsetWidth || 1 : 1;     // the mirror may be scaled down (transform)
    el.style.transform = `translate(${Math.round((r.left - hr.left + r.width * (pos.x ?? 0.5)) / k)}px, ${Math.round((r.top - hr.top + r.height * (pos.y ?? 0.5)) / k)}px)`;
    return t;
  };
  return {
    pulse(pos, ms = 2000) {
      const t = findAnchor(host, pos && pos.a); if (!t) return;
      try { t.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (_) {}
      const p = document.createElement('div'); p.className = 'ka-pulse'; p.innerHTML = '<i></i><i></i>';
      layer.appendChild(p); place(p, pos);
      t.classList.add('kp-ring'); clearTimeout(t._ringT); t._ringT = setTimeout(() => t.classList.remove('kp-ring'), ms);
      setTimeout(() => p.remove(), ms);
    },
    cursor(pos) {
      if (!pos || !pos.a || pos.a === 'off') { if (hand) hand.classList.add('is-off'); handPos = null; return; }
      if (!hand) { hand = document.createElement('div'); hand.className = 'ka-hand'; hand.innerHTML = '<span class="ka-carry"></span><svg viewBox="0 0 24 24" width="26" height="26"><path d="M5 2.5 19 13l-6.2.9 3.6 7.1-2.9 1.4-3.5-7.1L5 19.6z" fill="#2c2a3a" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>'; layer.appendChild(hand); }
      handPos = pos; hand.classList.remove('is-off');
      if (!place(hand, pos)) hand.classList.add('is-off');
      clearTimeout(handTimer); handTimer = setTimeout(() => hand && hand.classList.add('is-idle'), 4000); hand.classList.remove('is-idle');
    },
    // The piece the student is dragging rides along under the ghost hand.
    carry(el) {
      if (carry === el) return; carry = el;
      if (!hand) { if (!el) return; this.cursor(handPos || { a: 'step', x: 0.5, y: 0.5 }); }
      const slot = hand.querySelector('.ka-carry');
      slot.innerHTML = ''; if (el) { const c = el.cloneNode(true); c.removeAttribute('data-anchor'); c.classList.remove('is-dragging', 'is-picked'); slot.appendChild(c); }
    },
    reflow() { if (hand && handPos) place(hand, handPos); },
    clear() { layer.querySelectorAll('.ka-pulse').forEach(p => p.remove()); },
    layer,
  };
}

// Coalesce many changes into one callback; the first change in a burst is sent after
// `ms`, never later (debounce ≤ 150 ms as the contract asks).
export function batcher(fn, ms = 60) {
  let t = null;
  const run = () => { t = null; fn(); };
  return { push() { if (!t) t = setTimeout(run, ms); }, flush() { if (t) { clearTimeout(t); run(); } }, cancel() { clearTimeout(t); t = null; } };
}
export function throttle(fn, ms = 100) {
  let last = 0, t = null, args = null;
  return (...a) => {
    args = a; const now = Date.now();
    if (now - last >= ms) { last = now; fn(...args); }
    else if (!t) t = setTimeout(() => { t = null; last = Date.now(); fn(...args); }, ms - (now - last));
  };
}

// Normalise a typed answer: case-, space- and edge-punctuation-insensitive (accents stay).
// Mirror side: a state comes from the other computer. Keep only what the renderers expect
// (numbers are numbers, lists are lists, effects of known kinds), so a crafted message can
// neither inject markup nor break the mirror.
const FX_KINDS = new Set(['pop', 'glow', 'shake', 'nope', 'bump', 'hinting', 'star', 'gift']);
const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
export function saneState(s) {
  if (!s || typeof s !== 'object' || Array.isArray(s)) return null;
  const o = { ...s };
  for (const k of ['v', 'n', 'step', 'stars', 'first', 'total', 'fxn', 'scroll', 'page', 'endStep']) if (k in o) o[k] = num(o[k]);
  if ('step' in o) o.step = Math.trunc(o.step);
  if ('page' in o) o.page = Math.max(0, Math.trunc(o.page));
  o.fx = (Array.isArray(s.fx) ? s.fx : []).filter(f => f && typeof f === 'object' && FX_KINDS.has(f.k)).map(f => ({ n: num(f.n), k: f.k, a: typeof f.a === 'string' ? f.a : undefined, g: typeof f.g === 'string' ? f.g.slice(0, 8) : undefined }));
  o.practise = (Array.isArray(s.practise) ? s.practise : []).filter(p => p && typeof p === 'object').map(p => (typeof p.id === 'string' ? { id: p.id } : { label: String(p.label ?? '') }));
  if ('ss' in o) o.ss = Array.isArray(s.ss) ? s.ss.map(x => (x && typeof x === 'object' && !Array.isArray(x) ? x : null)) : [];
  if (o.msg != null && (typeof o.msg !== 'object' || Array.isArray(o.msg))) o.msg = null;
  if (o.msg) o.msg = { kind: String(o.msg.kind || '').replace(/[^a-z]/g, ''), mk: String(o.msg.mk ?? ''), b: String(o.msg.b ?? ''), t: String(o.msg.t ?? '') };
  for (const k of ['last', 'id']) if (k in o && typeof o[k] !== 'string') o[k] = null;
  return o;
}

export const normAnswer = s => String(s ?? '').toLowerCase().replace(/[¿¡!?.,;:"“”«»]/g, ' ').replace(/\s+/g, ' ').trim();
export const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s);
const clone = o => JSON.parse(JSON.stringify(o));
export { clone };
