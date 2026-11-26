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

function gapStep(mode, sentences, title) {
  const step = { type: 'gap', title: title || TITLES[mode], mode, sentences };
  if (mode === 'drag') {
    const answers = sentences.map((s) => s.answer);
    const taken = new Set(answers.map(norm));
    const extra = [];
    for (const s of sentences) {
      for (const o of s.options) {
        if (extra.length >= 2) break;
        if (!taken.has(norm(o))) { taken.add(norm(o)); extra.push(o); }
      }
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
 *   focus  item ids to ask first (the student's words to practise)
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
  const pool = first.length >= count ? [] : await getQuizSet({ ...base, count: count * 2 });
  const seen = new Set();
  const sentences = [];
  for (const q of [...first, ...pool]) {
    if (sentences.length >= count) break;
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
    sentences.push(s);
  }
  if (!sentences.length) throw new Error(`quickPractice: no questions for "${topic}"`);
  const m = baseMaterial(`qp_${topic}_${uid()}`, title || 'Quick practice', topic, sentences.length, { kind: 'quick', mode, focus: (focus || []).slice(0, 30) });
  m.steps = [gapStep(mode, sentences)];
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
