// Placeholder for the real Krabsy question DB. Distractors include both regularised
// forms ("goed") and the past participle ("gone", "eaten") — both wrong for simple past,
// both plausible. Matches Krabsy's difficulty-2 design.
export const QUESTIONS = [
  { verb: 'go',    correct: 'went',    wrong: ['goed',     'wented']  },
  { verb: 'run',   correct: 'ran',     wrong: ['runned',   'ranned']  },
  { verb: 'eat',   correct: 'ate',     wrong: ['eated',    'eaten']   },
  { verb: 'swim',  correct: 'swam',    wrong: ['swimmed',  'swum']    },
  { verb: 'fly',   correct: 'flew',    wrong: ['flied',    'flown']   },
  { verb: 'see',   correct: 'saw',     wrong: ['seed',     'seen']    },
  { verb: 'write', correct: 'wrote',   wrong: ['writed',   'written'] },
  { verb: 'sing',  correct: 'sang',    wrong: ['singed',   'sung']    },
  { verb: 'drive', correct: 'drove',   wrong: ['drived',   'driven']  },
  { verb: 'break', correct: 'broke',   wrong: ['breaked',  'broken']  },
  { verb: 'take',  correct: 'took',    wrong: ['taked',    'taken']   },
  { verb: 'give',  correct: 'gave',    wrong: ['gived',    'given']   },
  { verb: 'know',  correct: 'knew',    wrong: ['knowed',   'known']   },
  { verb: 'come',  correct: 'came',    wrong: ['comed',    'come']    },
  { verb: 'think', correct: 'thought', wrong: ['thinked',  'thunk']   },
];

export function formatPrompt(verb) {
  return `${verb} → ___`;
}

export function getQuestion(verb) {
  const q = QUESTIONS.find(q => q.verb === verb);
  if (!q) throw new Error(`No question for verb "${verb}"`);
  // fresh distractor order each call so repeats look different
  return { verb: q.verb, correct: q.correct, wrong: shuffle([...q.wrong]) };
}

// Build per-gate question queue from a level's verb pool.
// Prefers unused verbs first; once all have been used, reuses up to `repeatsAllowed` times.
// Throws if the pool can't supply enough unique-or-repeated questions.
export function buildQuestionQueue(verbPool, gateCount, repeatsAllowed = 1) {
  const available = QUESTIONS.filter(q => verbPool.includes(q.verb));
  if (available.length === 0) throw new Error('no questions match verb pool');
  if (available.length * repeatsAllowed < gateCount) {
    throw new Error(`not enough questions: ${available.length} verbs × ${repeatsAllowed} repeats < ${gateCount} gates`);
  }

  const counts = new Map(available.map(q => [q.verb, 0]));
  const queue = [];
  for (let i = 0; i < gateCount; i++) {
    const minCount = Math.min(...counts.values());
    const candidates = available.filter(q => counts.get(q.verb) === minCount);
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    counts.set(pick.verb, counts.get(pick.verb) + 1);
    queue.push({
      verb: pick.verb,
      correct: pick.correct,
      // shuffled distractors fresh each time (so repeats look different)
      wrong: shuffle([...pick.wrong]),
    });
  }
  return queue;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
