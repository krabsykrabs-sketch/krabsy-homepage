// Gate questions for the platformer.
//
// On the site the verbs come from the shared engine /lib/krabsy-questions.js ('chain' shape:
// one record per verb with both forms and per-form distractors). When the game is served on
// its own (dev server in this folder, file://) that import fails and the small inline list
// below is used instead.
//
// Presentation follows the site rules (root CLAUDE.md): no grammar terms, the position in the
// chain is the question, and the 3rd form is asked ONLY directly after the same verb's 2nd
// form, with the 2nd form filled in:
//     gate n:    go → [___] → ___        (2nd form; 3rd stays hidden)
//     gate n+1:  go → went → [___]       (3rd form)
// A 2nd-form question that is NOT followed by its 3rd form shows the 3rd form as a hint:
//     go → [___] → gone
//
// A question:
//   { verb, form: 'past'|'participle', correct, wrong: [a, b],
//     parts: ['go', '___', '___'], askIndex: 1,      // for the sign; asked slot highlighted
//     prompt: 'go → ___ → ___',                      // the same as plain text (HUD)
//     chain: 'go → went → ___' }                     // shown after answering (teach beat);
//                                                     // the 3rd form stays hidden when the
//                                                     // next gate asks it
//     full:  'go → went → gone' }                     // always complete (results screen)

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

// pairNext: true when the next gate asks this verb's 3rd form (so it must not be shown yet).
function makeQuestion(row, form, pairNext = false) {
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
  const parts = form === 'past'
    ? [row.verb, BLANK, pairNext ? BLANK : row.participle]
    : [row.verb, row.past, BLANK];
  return {
    verb: row.verb,
    form,
    correct,
    wrong,
    parts,
    askIndex: form === 'past' ? 1 : 2,
    prompt: parts.join(' → '),
    chain: pairNext
      ? `${row.verb} → ${row.past} → ${BLANK}`
      : `${row.verb} → ${row.past} → ${row.participle}`,

    full: `${row.verb} → ${row.past} → ${row.participle}`,   // always complete (results screen)
  };
}

// One question per gate, in gate order.
//   level.verbs  ['go', 'eat', …]   only these verbs (optional)
//   level.tiers  [1, 2]             only these difficulty tiers (optional)
//   level.forms  ['past']           only the 2nd form (optional; default: 2nd + 3rd in pairs)
//   gates        [{ verb?, form? }, …]  a gate may fix its verb and/or form
// With both forms on, gates are dealt in pairs: 2nd form of a verb, then its 3rd form on the
// next gate. A gate that fixes form 'participle' becomes the 2nd gate of a pair (the gate before
// it asks the same verb's 2nd form); if that is impossible it is asked as 2nd form instead.
// Verbs are not repeated until the pool is used up.
// Smart mix (site, docs/phase1-game-wiring.md): unless the level names its verbs, the first
// verbs dealt come from getChainSet({ smart: true }) — words this player still gets wrong,
// new words of their level, words due again — asked anew for every level start.
async function smartVerbs(level, count) {
  try {
    const KQ = await import('/lib/krabsy-questions.js');
    const tiers = Array.isArray(level.tiers) && level.tiers.length ? level.tiers : undefined;
    return await KQ.getChainSet({ topic: 'irregular_verbs', count, tiers, maxLen: 9, smart: true });
  } catch (_) { return []; }
}

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

  const pastOnly = Array.isArray(level.forms) && level.forms.length && !level.forms.includes('participle');
  const byVerb = new Map(all.map(r => [norm(r.verb), r]));

  let bag = [];
  const used = new Set(gates.map(g => norm(g.verb)).filter(v => byVerb.has(v)));
  if (!(Array.isArray(level.verbs) && level.verbs.length)) {
    // smart verbs on top of the bag (it is popped from the end), the rest of the pool below
    const smart = (await smartVerbs(level, Math.ceil(gates.length / 2) + 1))
      .map(r => byVerb.get(norm(r.verb))).filter(r => r && !used.has(norm(r.verb)));
    const smartSet = new Set(smart.map(r => norm(r.verb)));
    bag = [...shuffle(pool.filter(r => !used.has(norm(r.verb)) && !smartSet.has(norm(r.verb)))), ...smart.reverse()];
  }
  const draw = () => {
    if (bag.length === 0) bag = shuffle(pool.filter(r => !used.has(norm(r.verb))));
    if (bag.length === 0) { used.clear(); bag = shuffle([...pool]); }
    const r = bag.pop();
    used.add(norm(r.verb));
    return r;
  };

  // Plan forms, left to right: which gates are the 2nd gate of a pair.
  const n = gates.length;
  const second = new Array(n).fill(false);
  const canPair = (i) => i + 1 < n
    && gates[i].form !== 'participle' && gates[i + 1].form !== 'past'
    && (!gates[i].verb || !gates[i + 1].verb || norm(gates[i].verb) === norm(gates[i + 1].verb));
  for (let i = 0; i < n && !pastOnly; ) {
    // leave gate i+1 free if it is needed for a fixed 3rd-form gate right after it
    const nextNeeded = gates[i + 2]?.form === 'participle' && canPair(i + 1);
    if (canPair(i) && !nextNeeded) { second[i + 1] = true; i += 2; } else i += 1;
  }

  const out = [];
  for (let i = 0; i < n; i++) {
    if (second[i]) continue;   // filled together with its 1st gate
    const pair = i + 1 < n && second[i + 1];
    const fixed = gates[i].verb || (pair && gates[i + 1].verb);
    const row = byVerb.get(norm(fixed)) || draw();
    out[i] = makeQuestion(row, 'past', pair);
    if (pair) out[i + 1] = makeQuestion(row, 'participle');
  }
  return out;
}

// Kept for the Q/A style test bench (qa-styles.js).
export function formatPrompt(verb) {
  return `${verb} → ${BLANK}`;
}
