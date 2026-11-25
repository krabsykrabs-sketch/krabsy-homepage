import { TOPIC, LANG } from './i18n.js';

// Sentence topics (2026-11-24, docs/vision.md): with ?topic=<id> other than
// irregular_verbs (Spanish es_ser, prepositions …) the sink asks sentences with
// a gap from the site question engine instead of verb pairs. One plate = two
// sentences, preferably of the same item ("soy de + place" twice). The verb
// game below is unchanged.
export const IS_GAP = TOPIC !== 'irregular_verbs';

// Curated irregular-verb subset (from content/irregular-verbs.json, tier 1
// + kitchen-flavored tier 2). Shape: v=base, past, pp, wp/wpp = catalogue
// distractors for past / participle.
export const VERBS = [
  { v: 'be', past: 'was', pp: 'been', wp: ['beed', 'is', 'been'], wpp: ['beed', 'was', 'being'] },
  { v: 'come', past: 'came', pp: 'come', wp: ['comed', 'come', 'camed'], wpp: ['comed', 'came', 'comen'] },
  { v: 'do', past: 'did', pp: 'done', wp: ['doed', 'done', 'didd'], wpp: ['doed', 'did', 'doen'] },
  { v: 'draw', past: 'drew', pp: 'drawn', wp: ['drawed', 'drawn', 'drow'], wpp: ['drawed', 'drew', 'drawen'] },
  { v: 'drink', past: 'drank', pp: 'drunk', wp: ['drinked', 'drunk', 'drunken'], wpp: ['drinked', 'drank', 'dronk'] },
  { v: 'drive', past: 'drove', pp: 'driven', wp: ['drived', 'driven', 'droven'], wpp: ['drived', 'drove', 'droven'] },
  { v: 'eat', past: 'ate', pp: 'eaten', wp: ['eated', 'eaten', 'et'], wpp: ['eated', 'ate', 'eat'] },
  { v: 'feel', past: 'felt', pp: 'felt', wp: ['feeled', 'fell', 'feelt'], wpp: ['feeled', 'fell', 'feelt'] },
  { v: 'find', past: 'found', pp: 'found', wp: ['finded', 'fund', 'findd'], wpp: ['finded', 'fund', 'founden'] },
  { v: 'fly', past: 'flew', pp: 'flown', wp: ['flied', 'flown', 'flowed'], wpp: ['flied', 'flew', 'flying'] },
  { v: 'forget', past: 'forgot', pp: 'forgotten', wp: ['forgetted', 'forgotten', 'forgat'], wpp: ['forgetted', 'forgot', 'forgeted'] },
  { v: 'get', past: 'got', pp: 'got', wp: ['getted', 'gat', 'gotten'], wpp: ['getted', 'gat', 'geted'] },
  { v: 'give', past: 'gave', pp: 'given', wp: ['gived', 'given', 'gaved'], wpp: ['gived', 'gave', 'givven'] },
  { v: 'go', past: 'went', pp: 'gone', wp: ['goed', 'gone', 'wented'], wpp: ['goed', 'went', 'goen'] },
  { v: 'have', past: 'had', pp: 'had', wp: ['haved', 'hade', 'haves'], wpp: ['haved', 'hadded', 'haveen'] },
  { v: 'hear', past: 'heard', pp: 'heard', wp: ['heared', 'hore', 'hurd'], wpp: ['heared', 'hore', 'hearen'] },
  { v: 'know', past: 'knew', pp: 'known', wp: ['knowed', 'known', 'knewed'], wpp: ['knowed', 'knew', 'knowen'] },
  { v: 'leave', past: 'left', pp: 'left', wp: ['leaved', 'lefted', 'lave'], wpp: ['leaved', 'lefted', 'leaven'] },
  { v: 'make', past: 'made', pp: 'made', wp: ['maked', 'mode', 'makt'], wpp: ['maked', 'mode', 'maken'] },
  { v: 'meet', past: 'met', pp: 'met', wp: ['meeted', 'meat', 'meeten'], wpp: ['meeted', 'meat', 'meeten'] },
  { v: 'pay', past: 'paid', pp: 'paid', wp: ['payed', 'payd', 'paied'], wpp: ['payed', 'payd', 'payen'] },
  { v: 'put', past: 'put', pp: 'put', wp: ['putted', 'puts', 'putten'], wpp: ['putted', 'putten', 'puting'] },
  { v: 'read', past: 'read', pp: 'read', wp: ['readed', 'red', 'reads'], wpp: ['readed', 'red', 'reading'] },
  { v: 'run', past: 'ran', pp: 'run', wp: ['runned', 'run', 'ranned'], wpp: ['runned', 'ran', 'ronnen'] },
  { v: 'say', past: 'said', pp: 'said', wp: ['sayed', 'sed', 'sayd'], wpp: ['sayed', 'sed', 'sayen'] },
  { v: 'see', past: 'saw', pp: 'seen', wp: ['seed', 'seen', 'sawed'], wpp: ['seed', 'saw', 'seeen'] },
  { v: 'send', past: 'sent', pp: 'sent', wp: ['sended', 'sented', 'sant'], wpp: ['sended', 'sented', 'sant'] },
  { v: 'show', past: 'showed', pp: 'shown', wp: ['shew', 'shown', 'showd'], wpp: ['showded', 'shewn', 'showen'] },
  { v: 'sing', past: 'sang', pp: 'sung', wp: ['singed', 'sung', 'songed'], wpp: ['singed', 'sang', 'singen'] },
  { v: 'sit', past: 'sat', pp: 'sat', wp: ['sitted', 'set', 'saten'], wpp: ['sitted', 'set', 'sitten'] },
  { v: 'sleep', past: 'slept', pp: 'slept', wp: ['sleeped', 'slep', 'sleped'], wpp: ['sleeped', 'slep', 'sleeppen'] },
  { v: 'speak', past: 'spoke', pp: 'spoken', wp: ['speaked', 'spoken', 'spake'], wpp: ['speaked', 'spoke', 'spaken'] },
  { v: 'swim', past: 'swam', pp: 'swum', wp: ['swimmed', 'swum', 'swimd'], wpp: ['swimmed', 'swam', 'swimen'] },
  { v: 'take', past: 'took', pp: 'taken', wp: ['taked', 'taken', 'tooked'], wpp: ['taked', 'took', 'takeen'] },
  { v: 'teach', past: 'taught', pp: 'taught', wp: ['teached', 'tought', 'tach'], wpp: ['teached', 'tought', 'teachen'] },
  { v: 'tell', past: 'told', pp: 'told', wp: ['telled', 'telt', 'tald'], wpp: ['telled', 'telt', 'tellen'] },
  { v: 'think', past: 'thought', pp: 'thought', wp: ['thinked', 'thunk', 'thinkt'], wpp: ['thinked', 'thunk', 'thinken'] },
  { v: 'understand', past: 'understood', pp: 'understood', wp: ['understanded', 'understud', 'understands'], wpp: ['understanded', 'understud', 'understooden'] },
  { v: 'wear', past: 'wore', pp: 'worn', wp: ['weared', 'worn', 'ware'], wpp: ['weared', 'wore', 'weren'] },
  { v: 'write', past: 'wrote', pp: 'written', wp: ['writed', 'written', 'wroten'], wpp: ['writed', 'wrote', 'writen'] },
  // kitchen flavor (tier 2)
  { v: 'cut', past: 'cut', pp: 'cut', wp: ['cutted', 'cuts', 'cuten'], wpp: ['cutted', 'cuts', 'cutten'] },
  { v: 'burn', past: 'burnt', pp: 'burnt', wp: ['burnded', 'born', 'burnen'], wpp: ['burnded', 'born', 'burnen'] },
  { v: 'break', past: 'broke', pp: 'broken', wp: ['breaked', 'broken', 'broked'], wpp: ['breaked', 'broke', 'broaken'] },
  { v: 'catch', past: 'caught', pp: 'caught', wp: ['catched', 'cought', 'catchen'], wpp: ['catched', 'cought', 'catchen'] },
  { v: 'bring', past: 'brought', pp: 'brought', wp: ['bringed', 'brung', 'brang'], wpp: ['bringed', 'brung', 'brangen'] },
  { v: 'hold', past: 'held', pp: 'held', wp: ['holded', 'hild', 'houlded'], wpp: ['holded', 'hild', 'holden'] },
];

// Deterministic RNG hook (QA mode swaps this for a seeded generator).
export const rng = { next: Math.random };
export function seedRng(seed) {
  let a = seed >>> 0;
  rng.next = function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function pick(arr) { return arr[Math.floor(rng.next() * arr.length)]; }

/**
 * Start-of-round practice: verbs missed in EARLIER rounds (the persisted
 * save.missed list) come back as the first plates of the next round.
 * Returns up to n verb base forms; verbs no longer in the current subset are
 * skipped. Consumes no rng draws when the list is empty (QA seeds).
 */
export function seedPractice(missedList = [], n = 3) {
  const known = missedList.filter((v) => (IS_GAP
    ? !!(gapItems && gapItems.has(v)) : VERBS.some((x) => x.v === v)));
  return shuffle(known.slice()).slice(0, n);
}

// ---------- washing questions: ONE verb per plate, its two forms in chain order ----------
// Owner decision 2026-11-23 (+ "Chain order" in the root CLAUDE.md): a plate is
// washed by TWO answers — the 2nd and 3rd form of one verb, in that order:
//   1. go → [___] → ___     asks "went"
//   2. go → went → [___]    asks "gone" (the 2nd form is written in)
// After step 1 the 3rd form is NOT revealed (step 2 asks it). On the site the
// pairs come from the shared question engine (getQuizSet, chainOrder on by
// default, restricted to this game's curated verbs via `ids`); in local dev
// (no /lib/) they are built from the inline list above, the same way.

/** One question of a pair → the record the sink renders. */
function stepRecord(base, past, pp, ask, answer, options) {
  const chain = `<span class="form-base">${base}</span> → <span class="form-past">${past}</span> → <span class="form-pp">${pp}</span>`;
  const prompt = ask === 'past'
    ? `<span class="form-base">${base}</span> → <span class="form-past slot ask">___</span> → <span class="form-pp slot">___</span>`
    : `<span class="form-base">${base}</span> → <span class="form-past">${past}</span> → <span class="form-pp slot ask">___</span>`;
  return {
    verb: base, form: ask, answer, chips: options.slice(), prompt, chain,
    key: `${base}|${ask}`,
    sub: ask === 'past' ? 'simple past' : 'past participle',   // small caption only
  };
}

function inlinePair(v) {
  const step = (ask) => {
    const answer = ask === 'past' ? v.past : v.pp;
    const wrong = shuffle((ask === 'past' ? v.wp : v.wpp).filter((w) => w !== answer)).slice(0, 2);
    return stepRecord(v.v, v.past, v.pp, ask, answer, shuffle([answer, ...wrong]));
  };
  return { verb: v.v, steps: [step('past'), step('pp')] };
}

/** Engine pairs keyed by verb (null until/unless the site engine loaded). */
let enginePairs = null;
export let questionSource = 'inline';

/** Load the pairs from the site question engine. Only tried where the game is
 *  served by the site (path …/games/verb-kitchen/) — the local dev server has
 *  no /lib/, and a failed import would only log a 404. Never throws. */
export async function loadQuestionEngine() {
  if (enginePairs || gapItems) return;
  try {
    if (!/\/games\/verb-kitchen\//.test(location.pathname)) return;
    const KQ = await import('/lib/krabsy-questions.js');
    if (IS_GAP) { await loadGapTopic(KQ); return; }
    if (KQ.topicFromUrl() !== 'irregular_verbs') return;
    const set = await KQ.getQuizSet({ topic: 'irregular_verbs', count: 1000, withOptions: 3,
      ids: VERBS.map((v) => v.v) });            // chainOrder is on by default for verbs
    const map = new Map();
    for (let i = 1; i < set.length; i++) {
      const q3 = set[i], q2 = set[i - 1];
      if (!q3.followUp) continue;                // the engine keeps each pair adjacent
      const c = q2.teach && q2.teach.chain;
      if (!c || q2.display.askIndex !== 0 || q3.display.askIndex !== 1) continue;
      // three DIFFERENT chips (the catalogue repeats a distractor for a few
      // verbs, e.g. have → "haved" twice): dedupe, top up from the inline list
      const inline = VERBS.find((x) => x.v === c.base);
      const chips = (q, extra) => {
        const out = [q.answer];
        for (const o of [...q.options, ...extra]) {
          if (out.length >= 3) break;
          if (o && !out.some((x) => x.toLowerCase() === o.toLowerCase())) out.push(o);
        }
        return out.length === 3 ? shuffle(out) : null;
      };
      const o2 = chips(q2, inline ? inline.wp : []), o3 = chips(q3, inline ? inline.wpp : []);
      if (!o2 || !o3) continue;                  // that verb keeps its inline pair
      map.set(c.base, { verb: c.base, steps: [
        stepRecord(c.base, c.past, c.participle, 'past', q2.answer, o2),
        stepRecord(c.base, c.past, c.participle, 'pp', q3.answer, o3),
      ] });
    }
    if (map.size >= 10) { enginePairs = map; questionSource = 'engine'; }
  } catch (e) { /* offline / local dev: keep the inline list */ }
}

// ---------- sentence topics ----------
/** item id → { label, recs: [sink records] } (null until loaded). */
let gapItems = null;

const escHtml = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** One engine quiz record (display.kind 'gap') → the record the sink renders. */
function gapRecord(q) {
  const parts = String(q.display.sentence).split(/_{2,}/);
  const pre = escHtml(parts[0] || ''), post = escHtml(parts.slice(1).join('___'));
  const chips = [];
  for (const o of q.options) if (o && !chips.some((x) => x.toLowerCase() === o.toLowerCase())) chips.push(o);
  if (chips.length < 3 || !chips.includes(q.answer)) return null;
  const filled = `${pre}<span class="form-past">${escHtml(q.answer)}</span>${post}`;
  return {
    verb: q.item, form: 'default', answer: q.answer, chips: chips.slice(0, 3),
    prompt: `<span class="gapS">${pre}<span class="form-past slot ask">___</span>${post}</span>`,
    chain: `<span class="gapS">${filled}</span>` +
      (q.teach && q.teach.line ? `<div class="gapTeach">${escHtml(q.teach.line)}</div>` : ''),
    filled, key: `${q.item}|${q.id}`, sub: '', topic: q.topic, id: q.id,
  };
}

async function loadGapTopic(KQ) {
  const set = await KQ.getQuizSet({ topic: TOPIC, count: 1000, withOptions: 3, uniqueBy: 'id', lang: LANG });
  const map = new Map();
  for (const q of set) {
    if (!q.display || q.display.kind !== 'gap') continue;
    const r = gapRecord(q);
    if (!r) continue;
    if (!map.has(r.verb)) map.set(r.verb, { recs: [] });
    map.get(r.verb).recs.push(r);
  }
  if (map.size >= 3) { gapItems = map; questionSource = 'engine'; }
}

/** Cookbook / recap rows for the current topic: [{ id, html }]. Verbs: the chain;
 *  sentence topics: one example sentence per item, the answer highlighted. */
export function cookbookRows() {
  if (IS_GAP) {
    if (!gapItems) return [];                     // not loaded (yet): never show the verbs here
    return [...gapItems.entries()].map(([id, it]) => ({ id, html: `<span class="ck ckS">${it.recs[0].filled}</span>` }));
  }
  return VERBS.map((v) => ({ id: v.v, html: `<span class="ck"><span class="form-base">${v.v}</span> → ` +
    `<span class="form-past">${v.past}</span> → <span class="form-pp">${v.pp}</span></span>` }));
}

function makeGapPair(missed, recentlyAsked) {
  const ids = [...gapItems.keys()];
  let item = null, fromMissed = false;
  while (missed.length && !item) {
    const k = missed.shift();
    if (gapItems.has(k)) { item = k; fromMissed = true; }
  }
  if (!item) {
    const fresh = ids.filter((k) => !recentlyAsked.has(k));
    item = pick(fresh.length ? fresh : ids);
  }
  const own = shuffle(gapItems.get(item).recs.slice());
  let second = own[1];
  if (!second) {                                  // an item with one sentence: borrow another item's
    const other = pick(ids.filter((k) => k !== item)) || item;
    second = pick(gapItems.get(other).recs);
  }
  const fresh = (q) => ({ ...q, chips: shuffle(q.chips.slice()) });
  return { verb: item, steps: [fresh(own[0]), fresh(second)], fromMissed };
}

/**
 * The next plate's question pair: { verb, steps: [2nd-form q, 3rd-form q], fromMissed }.
 * missed: verbs queued for re-asking (take priority); recentlyAsked: verbs to
 * avoid repeating right away. Option order is shuffled fresh every time.
 */
export function makePair(missed = [], recentlyAsked = new Set()) {
  if (IS_GAP && gapItems) return makeGapPair(missed, recentlyAsked);
  let verb = null, fromMissed = false;
  while (missed.length && !verb) {
    const base = missed.shift();
    if (VERBS.some((x) => x.v === base)) { verb = base; fromMissed = true; }
  }
  if (!verb) {
    // engine loaded: only its verbs (a teacher link may have narrowed them to easy ones)
    const pool = enginePairs ? VERBS.filter((x) => enginePairs.has(x.v)) : VERBS;
    const fresh = pool.filter((x) => !recentlyAsked.has(x.v));
    verb = pick(fresh.length ? fresh : pool).v;
  }
  const src = enginePairs && enginePairs.get(verb);
  const pair = src
    ? { verb, steps: src.steps.map((q) => ({ ...q, chips: shuffle(q.chips.slice()) })) }
    : inlinePair(VERBS.find((x) => x.v === verb));
  pair.fromMissed = fromMissed;
  return pair;
}
