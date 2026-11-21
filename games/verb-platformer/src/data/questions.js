// Gate questions for the platformer.
//
// On the site the verbs come from the shared engine /lib/krabsy-questions.js ('chain' shape:
// one record per verb with both forms and per-form distractors). When the game is served on
// its own (dev server in this folder, file://) that import fails and the small inline list
// below is used instead.
//
// Presentation follows the site rule: no grammar terms, the position in the chain is the
// question —  `go → ___ → gone`  or  `go → went → ___`.
//
// A question:
//   { verb, form: 'past'|'participle', correct, wrong: [a, b],
//     prompt: 'go → ___ → gone', chain: 'go → went → gone' }

const BLANK = '___';

const FALLBACK = [
  ['go', 'went', 'gone', ['goed', 'wented'], ['goed', 'goen']],
  ['run', 'ran', 'run', ['runned', 'ranned'], ['runned', 'ranned']],
  ['eat', 'ate', 'eaten', ['eated', 'aten'], ['eated', 'aten']],
  ['swim', 'swam', 'swum', ['swimmed', 'swimed'], ['swimmed', 'swamed']],
  ['fly', 'flew', 'flown', ['flied', 'flyed'], ['flied', 'flewn']],
  ['see', 'saw', 'seen', ['seed', 'sawed'], ['seed', 'sawn']],
  ['write', 'wrote', 'written', ['writed', 'writ'], ['writed', 'wroten']],
  ['sing', 'sang', 'sung', ['singed', 'songed'], ['singed', 'songen']],
  ['drive', 'drove', 'driven', ['drived', 'droved'], ['drived', 'droven']],
  ['break', 'broke', 'broken', ['breaked', 'braked'], ['breaked', 'breaken']],
  ['take', 'took', 'taken', ['taked', 'tooked'], ['taked', 'tooken']],
  ['give', 'gave', 'given', ['gived', 'gaved'], ['gived', 'gaven']],
  ['know', 'knew', 'known', ['knowed', 'knewed'], ['knowed', 'knewn']],
  ['come', 'came', 'come', ['comed', 'camed'], ['comed', 'camen']],
  ['think', 'thought', 'thought', ['thinked', 'thunk'], ['thinked', 'thunk']],
].map(([verb, past, participle, wp, wpp]) => ({
  verb, past, participle, tier: 1,
  past_alt: [], participle_alt: [],
  distractors: { past: wp, participle: wpp },
}));

let poolPromise = null;

// All verbs the game may ask, loaded once.
export function loadVerbPool() {
  if (!poolPromise) {
    poolPromise = (async () => {
      try {
        const KQ = await import('/lib/krabsy-questions.js');
        const rows = await KQ.getChainSet({ topic: 'irregular_verbs', maxLen: 9, shuffle: false });
        if (rows.length) return rows;
      } catch (_) { /* not on the site — use the inline list */ }
      return FALLBACK;
    })();
  }
  return poolPromise;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const norm = s => String(s || '').trim().toLowerCase();

function makeQuestion(row, form) {
  const correct = row[form];
  const other = form === 'past' ? row.participle : row.past;
  // Never offer as "wrong" a word that is also right, or one already printed in the prompt.
  const taken = new Set([correct, other, row.verb, ...(row[`${form}_alt`] || [])].map(norm));
  const wrong = [];
  const candidates = [
    ...shuffle([...(row.distractors?.[form] || [])]),
    `${row.verb}ed`, `${correct}ed`, `${row.verb}en`,
  ];
  for (const w of candidates) {
    if (wrong.length === 2) break;
    if (!w || taken.has(norm(w))) continue;
    taken.add(norm(w));
    wrong.push(w);
  }
  return {
    verb: row.verb,
    form,
    correct,
    wrong,
    prompt: form === 'past'
      ? `${row.verb} → ${BLANK} → ${row.participle}`
      : `${row.verb} → ${row.past} → ${BLANK}`,
    chain: `${row.verb} → ${row.past} → ${row.participle}`,
  };
}

// One question per gate.
//   level.verbs  ['go', 'eat', …]   only these verbs (optional)
//   level.tiers  [1, 2]             only these difficulty tiers (optional)
//   level.forms  ['past']           only this blank (optional; default both, mixed)
//   gates        [{ verb? }, …]     a gate may fix its verb
// Verbs are not repeated until the pool is used up.
export async function buildQuestionQueue(level, gates) {
  const all = await loadVerbPool();
  let pool = all;
  if (Array.isArray(level.verbs) && level.verbs.length) {
    const want = new Set(level.verbs.map(norm));
    pool = all.filter(r => want.has(norm(r.verb)));
  } else if (Array.isArray(level.tiers) && level.tiers.length) {
    pool = all.filter(r => level.tiers.includes(r.tier));
  }
  if (pool.length === 0) pool = all;

  const forms = (Array.isArray(level.forms) && level.forms.length)
    ? level.forms.filter(f => f === 'past' || f === 'participle')
    : ['past', 'participle'];
  const byVerb = new Map(all.map(r => [norm(r.verb), r]));

  let bag = [];
  const used = new Set(gates.map(g => norm(g.verb)).filter(v => byVerb.has(v)));
  const draw = () => {
    if (bag.length === 0) bag = shuffle(pool.filter(r => !used.has(norm(r.verb))));
    if (bag.length === 0) { used.clear(); bag = shuffle([...pool]); }
    const r = bag.pop();
    used.add(norm(r.verb));
    return r;
  };

  // Mixed forms: deal them evenly so a level never asks one blank only by chance.
  let formBag = [];
  const drawForm = () => {
    if (formBag.length === 0) formBag = shuffle([...forms]);
    return formBag.pop();
  };

  return gates.map(g => {
    const row = byVerb.get(norm(g.verb)) || draw();
    const form = (g.form === 'past' || g.form === 'participle') ? g.form : drawForm();
    return makeQuestion(row, form);
  });
}

// Kept for the Q/A style test bench (qa-styles.js).
export function formatPrompt(verb) {
  return `${verb} → ${BLANK}`;
}
