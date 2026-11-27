// Questions for both players. Each player has their own queue (own level later: D2 gives
// player 2 their own smart mix through their own profile). Source: the site's question engine
// /lib/krabsy-questions.js, quiz shape (docs/game-contract.md). On file:// or a dev server
// without /lib the import fails and a small inline set of verbs is played.
//
// Answers: only player 1 (the active person on this device) is recorded with recordAttempt
// (docs/duo-games.md, D1). The second player's answers are counted for the summary only.

const SOURCE = 'duo-coop';
let KQ = null;      // the engine module, or null
let stats = null;   // krabsy-stats module, or null

async function engine() {
  if (KQ !== null) return KQ;
  if (!location.protocol.startsWith('http')) { KQ = false; return KQ; }
  try { KQ = await import('/lib/krabsy-questions.js'); }
  catch (e) { console.info('[duo] no question engine, playing the inline set', e?.message || e); KQ = false; }
  return KQ;
}

async function statsModule() {
  if (stats !== null) return stats;
  if (!location.protocol.startsWith('http')) { stats = false; return stats; }
  try { stats = await import('/lib/krabsy-stats.js'); } catch (_) { stats = false; }
  return stats;
}

/** ?topic= (only topics the engine knows; the inline set is verbs). */
export async function currentTopic() {
  const m = await engine();
  if (m) return m.topicFromUrl('irregular_verbs');
  return 'irregular_verbs';
}

// ── Inline fallback: verbs as chain pairs (2nd form, then 3rd form with the 2nd filled in) ──
const VERBS = [
  ['go', 'went', 'gone', ['goed', 'wented']], ['see', 'saw', 'seen', ['seed', 'sawn']],
  ['eat', 'ate', 'eaten', ['eated', 'ated']], ['take', 'took', 'taken', ['taked', 'tooked']],
  ['write', 'wrote', 'written', ['writed', 'wroted']], ['swim', 'swam', 'swum', ['swimmed', 'swammed']],
  ['drink', 'drank', 'drunk', ['drinked', 'dranked']], ['fly', 'flew', 'flown', ['flied', 'flyed']],
  ['give', 'gave', 'given', ['gived', 'gaved']], ['ride', 'rode', 'ridden', ['rided', 'roded']],
  ['break', 'broke', 'broken', ['breaked', 'broked']], ['sing', 'sang', 'sung', ['singed', 'sanged']],
];
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

function inlineSet() {
  const out = [];
  for (const [base, past, pp, wrong] of shuffle(VERBS.slice())) {
    const o1 = shuffle([past, wrong[0], pp]);
    const o2 = shuffle([pp, wrong[1], past]);
    out.push({
      id: `${base}-past`, item: base, topic: 'irregular_verbs', form: 'past',
      display: { kind: 'trio', base, slots: [{ text: null }, { text: null }], askIndex: 0 },
      answer: past, accepts: [past], options: o1, correctIndex: o1.indexOf(past),
      teach: { line: `${base} → ${past} → ___`, hideParticiple: true },
    }, {
      id: `${base}-participle`, item: base, topic: 'irregular_verbs', form: 'participle', followUp: true,
      display: { kind: 'trio', base, slots: [{ text: past }, { text: null }], askIndex: 1 },
      answer: pp, accepts: [pp], options: o2, correctIndex: o2.indexOf(pp),
      teach: { line: `${base} → ${past} → ${pp}` },
    });
  }
  return out;
}

/**
 * A question queue for one player.
 *   next() → the next question, at once (refills itself; chain pairs stay in order)
 *   record(q, correct) → recordAttempt for the recorded player, no-op otherwise
 */
export async function makeQueue({ topic, lang, smart = false, recorded = false }) {
  let fromEngine = false;
  async function fetchSet() {
    const m = await engine();
    if (m) {
      try {
        const set = await m.getQuizSet({ topic, count: 30, withOptions: 3, lang, smart });
        if (set.length) { fromEngine = true; return set; }
      } catch (e) { console.info('[duo] engine set failed, inline set', e?.message || e); }
    }
    fromEngine = false;
    return inlineSet();
  }
  let list = await fetchSet();
  let i = 0;
  let nextList = null, pending = null;
  const prefetch = () => { if (!pending) pending = fetchSet().then((s) => { nextList = s; }); };
  const st = recorded ? await statsModule() : false;
  return {
    get fromEngine() { return fromEngine; },
    // Instant (the card opens at once); the next set is fetched in the background.
    next() {
      if (i >= list.length) {
        if (nextList) { list = nextList; nextList = null; pending = null; }
        else shuffle(list);
        i = 0;
      }
      const q = list[i++];
      if (list.length - i < 4) prefetch();
      return q;
    },
    record(q, correct) {
      if (!st || !q || !q.item) return;
      try { st.recordAttempt(q.item, q.form || 'default', !!correct, SOURCE, q.topic, 'choice'); }
      catch (e) { console.warn('[duo] recordAttempt failed', e); }
    },
  };
}

/** The sentence or chain after an answer: what was right (teach beat). */
export function revealText(q) {
  if (!q) return '';
  if (q.display.kind === 'trio') return q.teach?.line || '';
  const filled = (q.display.plain || q.display.sentence || '').replace(/_{2,}/, q.answer);
  return filled;
}
