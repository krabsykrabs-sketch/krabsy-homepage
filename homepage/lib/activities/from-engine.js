// Materials made at runtime for the live classroom (format: content/materials/README.md).
//   quickPractice({topic, count, mode, focus, lang}) → a worksheet with one gap step,
//     built from the question engine (getQuizSet, 3 options per sentence).
//   fromV1Worksheet(ws) → a v1 tutor worksheet (api/tutors.py, questions[]) as a material.
// Lists are mixed here, once; the player shows them as given (mirror = same order).
import { getQuizSet, topicInfo } from '../krabsy-questions.js';

const MODES = ['drag', 'typed', 'choice'];
const TITLES = { drag: 'Drag the word into the gap', typed: 'Type the missing word', choice: 'Choose the right word' };
const norm = (s) => String(s == null ? '' : s).trim().toLowerCase().replace(/\s+/g, ' ');
const uid = () => Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/* Sentence text with exactly one ___ for an engine record. */
function textOf(q) {
  const d = q.display || {};
  if (d.kind === 'trio') {
    // irregular verbs: go → ___ → …  /  go → went → ___
    const slots = (d.slots || []).map((s, i) => (i === d.askIndex ? '___' : (s && s.text != null ? s.text : '…')));
    return [d.base, ...slots].join(' → ');
  }
  return d.plain || d.sentence || '';
}

function oneGap(text) {
  const t = String(text || '').trim();
  if (!t) return '';
  const n = t.split('___').length - 1;
  if (n === 1) return t;
  if (n === 0) return `${t} ___`;
  return null; // more than one gap: cannot be asked
}

function sentence({ text, answer, accepts, options, hint, teach, item, topic, form }) {
  // a gap that starts the sentence: every choice starts with a capital (a lower-case
  // distractor would give the answer away), e.g. "___ cansado." → Estoy / Soy / Está
  const atStart = /^[¿¡]?___/.test(String(text || '').trim());
  const capF = (o) => (atStart && o ? o.charAt(0).toLocaleUpperCase('es') + o.slice(1) : o);
  answer = capF(String(answer ?? ''));
  const acc = [...new Set([answer, ...(accepts || [])].map(norm).filter(Boolean))];
  const opts = [];
  for (const o0 of options || []) { const o = capF(String(o0 || '')); if (o && !opts.some((x) => norm(x) === norm(o))) opts.push(o); }
  if (opts.length && !opts.includes(answer)) opts.splice(Math.floor(Math.random() * (opts.length + 1)), 0, answer);
  // a wrong option that is also accepted would be marked wrong when tapped: drop it
  const clean = opts.filter((o) => o === answer || !acc.includes(norm(o))).slice(0, 4);
  const s = { text, answer, accepts: acc, options: clean.length >= 2 ? clean : [], hint: hint || '', teach: teach || '', item, topic };
  if (form && form !== 'default') s.form = form;
  return s;
}

/* ── Quality rules (the same as tools/check_materials.py) ──
   All sentences of a gap step are on screen together, and the teach line of each answered
   sentence shows before the next one. So within one set:
   - no give-away: an answer (describing words / nouns: also their -o/-a/-os/-as form) is not
     in another sentence's text or hint, and no teach line names another sentence's answer
     word or contains another sentence filled in;
   - variety: an answer at most twice in a row and for at most ~40 % of the set, and at
     most half the set in one sentence pattern;
   - drag: every answer once in the bank, no gap at the start (its capital gives it away). */
const VERB_FORMS = new Set(('soy eres es somos sois son estoy estás está estamos estáis están tengo tienes '
  + 'tiene tenemos tienen me llamo llamas llama hay').split(' '));
const WORD_RE = /[a-záéíóúüñ]+/gi;
function stem(w) {
  w = w.toLowerCase();
  if (VERB_FORMS.has(w) || w.length < 5) return w;
  for (const end of ['os', 'as', 'es', 'o', 'a', 's']) {
    if (w.endsWith(end) && w.length - end.length >= 4) return w.slice(0, -end.length);
  }
  return w;
}
const wordsOf = (t) => String(t || '').match(WORD_RE) || [];
const wordKeys = (t, exact) => new Set(wordsOf(t).map((w) => (exact ? w.toLowerCase() : stem(w))));
const bare = (t) => wordsOf(t).map((w) => w.toLowerCase()).join(' ');
const isChain = (s) => String(s.text || '').includes('→');
const shareCap = (n) => Math.max(2, Math.round(0.4 * n));

function answerKey(s) {
  const a = norm(s.answer);
  const verb = a.split(' ').every((x) => VERB_FORMS.has(x));
  return { verb, key: verb ? a : stem(a) };
}
/* Hard give-away: a's answer is in b's text or hint (cannot be mended: a and b never go
   together; with b === a the sentence gives its own answer away). */
function inText(a, b) {
  if (isChain(a) || isChain(b)) return false; // verb chains (go → went → ___) show it on purpose
  const { verb, key } = answerKey(a);
  const seen = `${String(b.text || '').replace('___', ' ')} ${b.hint || ''}`;
  return key.includes(' ') ? bare(seen).includes(key) : wordKeys(seen, verb).has(key);
}
/* Soft give-away: b's teach line names a's answer word or is a filled in (mended below). */
function inTeach(a, b) {
  if (isChain(a) || isChain(b)) return false;
  const { verb, key } = answerKey(a);
  const filled = bare(String(a.text || '').replace('___', a.answer));
  if (filled && bare(b.teach).includes(filled)) return true;
  // a word of b's own answer (the same answer, inglés / inglesa) is on screen anyway once b is filled in
  return !verb && !key.includes(' ') && !wordKeys(b.answer, false).has(key) && wordKeys(b.teach, false).has(key);
}
const hardClash = (a, b) => inText(a, b) || inText(b, a);
const startsWithGap = (s) => /^[¿¡]?___/.test(String(s.text || '').trim());
// sentence pattern: names and other capitalised words as X ("Me llamo Sara. Estoy ___." ~ "… Pablo …")
const frameOf = (s) => String(s.text || '').replace(/\p{Lu}\p{Ll}*/gu, 'X');

/* One greedy pass over units in the given order. */
// relax: 0 = strict rules; 1 = an answer may come twice in drag and in up to half of the gaps,
// any sentence pattern; 2 = any answer as often as needed (still no give-aways, no sentence
// twice, never three in a row). Owner 2026-11-27: "10 questions" must give 10 when the topic has them.
function pickOnce(units, count, mode, relax = 0) {
  const chosen = [];
  const texts = new Set();
  const tally = new Map();
  const cap = (n) => (relax >= 2 ? Math.max(2, Math.floor((2 * n + 2) / 3)) : relax === 1 ? Math.max(2, Math.ceil(n / 2)) : shareCap(n));
  const limit = relax >= 2 ? cap(count) : mode === 'drag' ? (relax ? 2 : 1) : cap(count);
  const frames = new Map();
  const frameCap = relax ? count : Math.max(2, Math.floor(count / 2)); // mix sentence patterns
  let n = 0;
  for (const u of units) {
    if (n + u.length > count) continue;
    if (u.some((s) => texts.has(norm(s.text)) || inText(s, s))) continue;
    if (mode === 'drag' && u.some(startsWithGap)) continue;
    if (u.some((s) => chosen.some((v) => v.some((o) => hardClash(s, o))))) continue;
    if (!isChain(u[0]) && (frames.get(frameOf(u[0])) || 0) >= frameCap) continue;
    const add = new Map();
    u.forEach((s) => add.set(norm(s.answer), (add.get(norm(s.answer)) || 0) + 1));
    if ([...add].some(([x, k]) => (tally.get(x) || 0) + k > limit)) continue;
    add.forEach((k, x) => tally.set(x, (tally.get(x) || 0) + k));
    u.forEach((s) => texts.add(norm(s.text)));
    frames.set(frameOf(u[0]), (frames.get(frameOf(u[0])) || 0) + 1);
    chosen.push(u);
    n += u.length;
    if (n >= count) break;
  }
  // the share cap holds for the set as it came out (it may be smaller than asked)
  for (;;) {
    const flat = chosen.flat();
    const cnt = new Map();
    flat.forEach((s) => cnt.set(norm(s.answer), (cnt.get(norm(s.answer)) || 0) + 1));
    const over = [...cnt].find(([, k]) => k > (mode === 'drag' && !relax ? 1 : cap(flat.length)));
    if (!over) break;
    let i = chosen.length - 1;
    while (i > 0 && !chosen[i].some((s) => norm(s.answer) === over[0])) i--;
    chosen.splice(i, 1);
  }
  return chosen;
}

/* A teach line that names another sentence's answer gets a plain one: the sentence filled in. */
function mendTeach(sentences) {
  return sentences.map((s) => (sentences.some((o) => o !== s && inTeach(o, s))
    ? { ...s, teach: String(s.text).replace('___', s.answer) + (s.hint ? ` (${s.hint})` : '') }
    : s));
}

/* Up to `count` sentences from units (arrays: a verb pair stays together; the first nFirst
   units are the focus items and stay first), keeping the quality rules. Several tries in
   different orders, the fullest set wins. Then ordered so the same answer does not come
   twice in a row where that can be avoided (never three times). */
function pickSet(units, count, mode, nFirst = 0) {
  const head = units.slice(0, nFirst);
  const tail = units.slice(nFirst);
  let best = [];
  for (let relax = 0; relax <= 2 && best.flat().length < count; relax++) {
    for (let t = 0; t < 40; t++) {
      const got = pickOnce([...head, ...(t ? shuffle(tail) : tail)], count, mode, relax);
      if (got.flat().length > best.flat().length) best = got;
      if (best.flat().length >= count) break;
    }
  }
  // Order: the focus unit opens the set; then always the answer that is left most often,
  // unless it would make three in a row (two in a row is fine: that is what keeps the rarer
  // answers for later and avoids a run at the end).
  const out = [];
  const rest = best.slice();
  while (rest.length) {
    const last = out.length ? norm(out[out.length - 1].answer) : null;
    const prev = out.length > 1 ? norm(out[out.length - 2].answer) : null;
    const left = new Map();
    rest.forEach((u) => left.set(norm(u[0].answer), (left.get(norm(u[0].answer)) || 0) + 1));
    const ok = (u) => !(norm(u[0].answer) === last && last === prev);
    let k = -1;
    // the focus unit opens the set only if the rest can still be ordered without a run of three
    const feasibleAfter = (u) => {
      const cnt = new Map(left); const a = norm(u[0].answer); cnt.set(a, cnt.get(a) - 1);
      const vals = [...cnt.values()]; const total = vals.reduce((x, y) => x + y, 0); const max = Math.max(0, ...vals);
      return max <= 2 * (total - max + 1);
    };
    if (!out.length && nFirst > 0 && feasibleAfter(rest[0])) k = 0;
    else {
      rest.forEach((u, j) => {
        if (!ok(u)) return;
        const a = norm(u[0].answer), b = k >= 0 ? norm(rest[k][0].answer) : null;
        if (k < 0 || left.get(a) > left.get(b) || (left.get(a) === left.get(b) && b === last && a !== last)) k = j;
      });
    }
    if (k < 0) k = 0;
    out.push(...rest.splice(k, 1)[0]);
  }
  return mendTeach(out);
}

/* moreWords: further wrong words for the drag bank when the sentences' own wrong options
   run short (every answer is in the bank once, plus at least 2 extras). */
function gapStep(mode, sentences, title, moreWords = []) {
  const step = { type: 'gap', title: title || TITLES[mode], mode, sentences };
  if (mode === 'drag') {
    const answers = sentences.map((s) => s.answer);
    const taken = new Set(sentences.flatMap((s) => [s.answer, ...(s.accepts || [])]).map(norm));
    const extra = [];
    for (const o of [...sentences.flatMap((s) => s.options), ...moreWords]) {
      if (extra.length >= 2) break;
      if (o && !taken.has(norm(o))) { taken.add(norm(o)); extra.push(o); }
    }
    step.bank = shuffle([...answers, ...extra]);
  }
  return step;
}

function baseMaterial(id, title, topic, n, source) {
  const info = topicInfo(topic) || {};
  return {
    id, kind: 'worksheet', title, topic,
    level: ['Pre-A1', 'A1', 'A2', 'B1'].includes(info.level) ? info.level : 'A1',
    learn: info.learn || 'es',
    minutes: Math.max(2, Math.min(60, Math.round(n * 0.8))),
    source,
  };
}

/**
 * A quick-practice material from any quiz topic.
 *   topic  question topic id (es_ser_estar, irregular_verbs …)
 *   count  sentences (default 6)
 *   mode   'drag' | 'typed' | 'choice' (default 'choice')
 *   focus  item ids to ask first (the student's words to practice)
 *   lang   interface language for hints and teach lines (default 'en')
 *   title  optional material title
 * Throws when the topic has no quiz shape or no question could be built.
 */
export async function quickPractice({ topic, count = 6, mode = 'choice', focus = [], lang = 'en', title } = {}) {
  if (!MODES.includes(mode)) throw new Error(`quickPractice: mode "${mode}"`);
  count = Math.max(1, Math.min(30, count | 0 || 6));
  const base = { topic, withOptions: 3, lang };
  let first = [];
  if (focus && focus.length) {
    try { first = await getQuizSet({ ...base, count, ids: focus }); } catch (_) { first = []; }
  }
  // draw more than needed, then choose a set without give-aways or answer streaks
  const pool = await getQuizSet({ ...base, count: Math.max(count * 5, 40) });
  const seen = new Set();
  const units = [];
  let nFirst = 0; // units of focus items (asked first)
  let open = null; // the unit a following 3rd-form question may join (its 2nd form was just added)
  for (const [i, q] of [...first, ...pool].entries()) {
    if (i === first.length) nFirst = units.length;
    const joins = open;
    open = null;
    if (seen.has(q.id)) continue;
    seen.add(q.id);
    const text = oneGap(textOf(q));
    if (!text || !q.answer) continue;
    const s = sentence({
      text, answer: q.answer, accepts: q.accepts, options: q.options,
      hint: (q.display && q.display.hint) || '', teach: (q.teach && q.teach.line) || '',
      item: q.item, topic: q.topic || topic, form: q.form,
    });
    if (mode !== 'typed' && s.options.length < 2) continue;
    // a verb's 3rd form follows its 2nd form (chain order): keep the pair as one unit
    if (q.followUp) { if (joins) joins.push(s); continue; } // never a lone 3rd form
    const u = [s];
    units.push(u);
    open = u;
  }
  if (!pool.length) nFirst = units.length;
  let sentences = pickSet(units, count, mode, nFirst);
  if (!sentences.length) throw new Error(`quickPractice: no questions for "${topic}"`);
  const m = baseMaterial(`qp_${topic}_${uid()}`, title || 'Quick practice', topic, sentences.length, { kind: 'quick', mode, focus: (focus || []).slice(0, 30) });
  // wrong words of the sentences not chosen (lower case: drag gaps never start a sentence)
  const more = units.flat().filter((s) => !sentences.includes(s)).flatMap((s) => {
    const words = [s.answer, ...s.options];
    return /^[¿¡]?___/.test(String(s.text).trim()) ? words.map((o) => o.charAt(0).toLocaleLowerCase('es') + o.slice(1)) : words;
  });
  let step = gapStep(mode, sentences, null, more);
  // drag: too few wrong words left for the bank → the last sentence's answer becomes one
  // (long sets repeat words in the bank anyway, so the last gap is not solved by elimination)
  while (mode === 'drag' && sentences.length > 3 && sentences.length < 6 && step.bank.length - sentences.length < 2) {
    const drop = sentences[sentences.length - 1];
    sentences = mendTeach(sentences.slice(0, -1));
    step = gapStep(mode, sentences, null, [drop.answer, ...more]);
  }
  m.steps = [step];
  return m;
}

/**
 * A v1 tutor worksheet ({id, topic, title, mode: typed|choice|mixed, questions:[{item, form,
 * sentence, hint, answer, accepts, options, teach}]}) as a material.
 * typed/choice → one gap step; mixed → a choice step, then a typed step (v1 alternated them).
 */
export function fromV1Worksheet(ws) {
  if (!ws || !Array.isArray(ws.questions)) throw new Error('fromV1Worksheet: no questions');
  const topic = ws.topic;
  const all = [];
  ws.questions.forEach((q, i) => {
    const text = oneGap(q && q.sentence);
    if (!text || !q.answer) return;
    all.push({ i, s: sentence({ text, answer: String(q.answer), accepts: q.accepts, options: q.options, hint: q.hint, teach: q.teach, item: q.item, topic, form: q.form }) });
  });
  if (!all.length) throw new Error('fromV1Worksheet: no usable questions');
  const canChoose = (x) => x.s.options.length >= 2;
  const steps = [];
  if (ws.mode === 'mixed') {
    const choice = all.filter((x) => x.i % 2 === 1 && canChoose(x));
    const typed = all.filter((x) => !choice.includes(x));
    if (choice.length) steps.push(gapStep('choice', choice.map((x) => x.s)));
    if (typed.length) steps.push(gapStep('typed', typed.map((x) => x.s)));
  } else if (ws.mode === 'choice') {
    const choice = all.filter(canChoose);
    const typed = all.filter((x) => !canChoose(x));
    if (choice.length) steps.push(gapStep('choice', choice.map((x) => x.s)));
    if (typed.length) steps.push(gapStep('typed', typed.map((x) => x.s)));
  } else {
    steps.push(gapStep('typed', all.map((x) => x.s)));
  }
  const m = baseMaterial(`v1_ws_${String(ws.id == null ? uid() : ws.id).replace(/[^a-z0-9]/gi, '').toLowerCase() || uid()}`,
    ws.title || 'Worksheet', topic, all.length, { kind: 'v1', worksheet_id: ws.id == null ? null : ws.id });
  m.steps = steps;
  return m;
}
