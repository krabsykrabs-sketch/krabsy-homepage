// Question source for the forge.
//
// On the site, questions come from the shared engine /lib/krabsy-questions.js
// ("quiz" shape, topic from ?topic=), so the game follows the canonical catalogue and
// works for other topics too. When that import fails (local dev server, file://) a
// small inline verb list is turned into records of the same shape.
//
// Record (see krabsy-questions.js): { id, display, answer, options, correctIndex,
// teach: { line, chain } } where display is
//   { kind: 'trio', base, slots: [{text|null}, {text|null}], askIndex }  go → ___ → ___
//   { kind: 'gap', sentence }                                            My birthday is ___ July.
// Presentation rule: the position in the chain IS the question. Grammar terms appear
// only as small captions after the answer.

// base, past, participle, wrong pasts, wrong participles
const FALLBACK_VERBS = [
  ['go', 'went', 'gone', ['goed', 'gone', 'wented'], ['goed', 'went', 'goen']],
  ['run', 'ran', 'run', ['runned', 'run', 'ranned'], ['runned', 'ran', 'ronnen']],
  ['eat', 'ate', 'eaten', ['eated', 'eaten', 'et'], ['eated', 'ate', 'eat']],
  ['swim', 'swam', 'swum', ['swimmed', 'swum', 'swimd'], ['swimmed', 'swam', 'swimen']],
  ['fly', 'flew', 'flown', ['flied', 'flown', 'flowed'], ['flied', 'flew', 'flying']],
  ['see', 'saw', 'seen', ['seed', 'seen', 'sawed'], ['seed', 'saw', 'seeen']],
  ['write', 'wrote', 'written', ['writed', 'written', 'wroted'], ['writed', 'wrote', 'wroten']],
  ['sing', 'sang', 'sung', ['singed', 'sung', 'songed'], ['singed', 'sang', 'singen']],
  ['drive', 'drove', 'driven', ['drived', 'driven', 'droven'], ['drived', 'drove', 'droven']],
  ['break', 'broke', 'broken', ['breaked', 'broken', 'broked'], ['breaked', 'broke', 'breaken']],
  ['take', 'took', 'taken', ['taked', 'taken', 'tooked'], ['taked', 'took', 'takeen']],
  ['give', 'gave', 'given', ['gived', 'given', 'gaved'], ['gived', 'gave', 'givven']],
  ['know', 'knew', 'known', ['knowed', 'known', 'knewed'], ['knowed', 'knew', 'knowen']],
  ['come', 'came', 'come', ['comed', 'come', 'camed'], ['comed', 'came', 'comen']],
  ['think', 'thought', 'thought', ['thinked', 'thunk', 'thinkt'], ['thinked', 'thunk', 'thinken']],
  ['buy', 'bought', 'bought', ['buyed', 'bot', 'buyd'], ['buyed', 'bot', 'buyen']],
  ['make', 'made', 'made', ['maked', 'mode', 'makt'], ['maked', 'mode', 'maken']],
  ['find', 'found', 'found', ['finded', 'fund', 'findd'], ['finded', 'fund', 'founden']],
  ['tell', 'told', 'told', ['telled', 'telt', 'tald'], ['telled', 'telt', 'tellen']],
  ['drink', 'drank', 'drunk', ['drinked', 'drunk', 'drunken'], ['drinked', 'drank', 'dronk']],
  ['begin', 'began', 'begun', ['beginned', 'begun', 'begined'], ['beginned', 'began', 'beginnen']],
  ['speak', 'spoke', 'spoken', ['speaked', 'spoken', 'spake'], ['speaked', 'spoke', 'spaken']],
  ['fall', 'fell', 'fallen', ['falled', 'fallen', 'felled'], ['falled', 'fell', 'fellen']],
  ['grow', 'grew', 'grown', ['growed', 'grown', 'grewed'], ['growed', 'grew', 'growen']],
  ['throw', 'threw', 'thrown', ['throwed', 'thrown', 'threwed'], ['throwed', 'threw', 'throwen']],
  ['wear', 'wore', 'worn', ['weared', 'worn', 'wored'], ['weared', 'wore', 'wearen']],
  ['ride', 'rode', 'ridden', ['rided', 'ridden', 'roded'], ['rided', 'rode', 'riden']],
  ['choose', 'chose', 'chosen', ['choosed', 'chosen', 'chosed'], ['choosed', 'chose', 'choosen']],
  ['forget', 'forgot', 'forgotten', ['forgetted', 'forgotten', 'forgat'], ['forgetted', 'forgot', 'forgeted']],
  ['draw', 'drew', 'drawn', ['drawed', 'drawn', 'drow'], ['drawed', 'drew', 'drawen']],
];

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function fallbackSet() {
  const out = [];
  FALLBACK_VERBS.forEach(([base, past, participle, wrongPast, wrongPart], n) => {
    [[past, wrongPast, 0, 'past'], [participle, wrongPart, 1, 'participle']].forEach(([answer, wrongs, askIndex, form]) => {
      const options = shuffle([answer, ...wrongs.filter(w => w !== answer).slice(0, 2)]);
      out.push({
        id: `fb_${base}_${form}`,
        topic: 'irregular_verbs',
        difficulty: 2,
        rank: n < 15 ? 1 : 2,
        form,
        display: { kind: 'trio', base, slots: [{ text: null }, { text: null }], askIndex },
        answer,
        accepts: [answer],
        options,
        correctIndex: options.indexOf(answer),
        teach: { line: `${base} → ${past} → ${participle}`, chain: { base, past, participle } },
      });
    });
  });
  return out;
}

export const Questions = {
  source: 'none',     // 'site' | 'fallback'
  pool: [],           // not yet asked, easiest first
  all: [],
  retry: [],          // [{ q, due }] missed questions waiting to come back
  missed: new Map(),  // id → { q, times } for the end-of-game recap
  _sinceStart: 0,

  async init() {
    let set = null;
    try {
      const KQ = await import('/lib/krabsy-questions.js');
      set = await KQ.getQuizSet({ topic: KQ.topicFromUrl(), count: 1000, withOptions: 3, uniqueBy: 'id' });
      if (!set || set.length < 6) set = null;
      else {
        this.source = 'site';
        // Every verb question has the same `difficulty` in the catalogue; what orders
        // them from common to rare is the verb's tier (1 = everyday verbs).
        try {
          const chains = await KQ.getChainSet({ topic: KQ.topicFromUrl(), shuffle: false });
          const tier = new Map(chains.map(c => [c.verb, c.tier || 2]));
          for (const q of set) if (q.display.kind === 'trio') q.rank = tier.get(q.display.base) || 2;
        } catch (_) { /* topic without chains (e.g. prepositions): keep catalogue order */ }
      }
    } catch (_) {
      set = null;
    }
    if (!set) { set = fallbackSet(); this.source = 'fallback'; }
    this.all = set;
    this._refill();
  },

  // Easier questions first, but shuffled within the same level.
  _refill() {
    const level = (q) => (q.rank || 0) * 10 + (q.difficulty || 0);
    this.pool = shuffle(this.all.slice()).sort((a, b) => level(a) - level(b));
  },

  // New run: forget the recap list, keep working through the pool.
  resetRun() {
    this.retry = [];
    this.missed.clear();
    this._sinceStart = 0;
  },

  next() {
    this._sinceStart += 1;
    // A missed question returns once a couple of other questions have passed.
    const i = this.retry.findIndex(r => r.due <= this._sinceStart);
    if (i >= 0) return this._fresh(this.retry.splice(i, 1)[0].q);
    if (this.pool.length === 0) this._refill();
    // Pick from the easiest few so the order is not identical every game.
    const span = Math.min(12, this.pool.length);
    return this._fresh(this.pool.splice(Math.floor(Math.random() * span), 1)[0]);
  },

  // Re-shuffle the options so a repeated question is not answered by position.
  _fresh(q) {
    const options = shuffle(q.options.slice());
    return Object.assign({}, q, { options, correctIndex: options.indexOf(q.answer) });
  },

  markWrong(q) {
    const entry = this.missed.get(q.id) || { q, times: 0 };
    entry.times += 1;
    this.missed.set(q.id, entry);
    if (!this.retry.some(r => r.q.id === q.id)) this.retry.push({ q, due: this._sinceStart + 3 });
  },

  // Text for the recap list and the after-answer beat: the full chain, or the
  // sentence with the gap filled in.
  solutionLine(q) {
    if (q.teach && q.teach.line && q.display.kind === 'trio') return q.teach.line;
    if (q.display.kind === 'gap') return q.display.sentence.replace(/_{2,}/, q.answer);
    return q.answer;
  },
};
