// Every tunable number of the game lives here: rarities, hatch times, income,
// prices, belt, goals. Change numbers here, not in the code that uses them.

export const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

// Per rarity (same order as RARITIES).
export const RARITY = {
  common:    { color: 0xf4f1ea, accent: 0xcfc8b8, css: '#f4f1ea', tier: 1, pair: false, hatch: 20,  income: 1,   grabBonus: 5,   species: 8 },
  uncommon:  { color: 0x6fdc7a, accent: 0x3faa4c, css: '#6fdc7a', tier: 1, pair: false, hatch: 40,  income: 5,   grabBonus: 15,  species: 6 },
  rare:      { color: 0x5aa8ff, accent: 0x2f6fd0, css: '#5aa8ff', tier: 2, pair: true,  hatch: 75,  income: 25,  grabBonus: 50,  species: 5 },
  epic:      { color: 0xb57bff, accent: 0x7a3fd6, css: '#b57bff', tier: 3, pair: true,  hatch: 120, income: 120, grabBonus: 200, species: 4 },
  legendary: { color: 0xffcf5e, accent: 0xe0a020, css: '#ffcf5e', tier: 3, pair: true,  hatch: 240, income: 600, grabBonus: 800, species: 3 },
};

// Each species of a rarity earns a little more than the one before it:
// income = RARITY.income * (1 + SPECIES_STEP * index).
export const SPECIES_STEP = 0.12;

// A right answer also pays a bonus: max(RARITY.grabBonus, GRAB_BONUS_SECONDS × income/s),
// so answering stays worth it when the income is large.
export const GRAB_BONUS_SECONDS = 8;

// Releasing a creature from its pen pays this many seconds of its income.
export const RELEASE_SECONDS = 60;

// Belt
export const BELT = {
  speed: 1.25,          // world units per second
  spawnEvery: 2.9,      // seconds between eggs
  // Base chance weights (common … legendary) and how much each belt-luck level adds
  // to each weight, relative: weight × (1 + level × luckGain).
  weights: [60, 25, 10, 4, 1],
  luckGain: [0, 0.22, 0.45, 0.7, 1.0],
};

// Coins earned while away: capped, and at a reduced rate.
export const AWAY = { capSeconds: 8 * 3600, rate: 0.2, minSeconds: 60 };

// Start values and upgrades. price(level) = base × growth^level, level = times bought.
export const START = { pens: 3, incubators: 2 };
export const UPGRADES = {
  pen:        { base: 15, growth: 3.0, max: 9 },   // +1 pen each, up to 12
  incubator:  { base: 30, growth: 4.0, max: 4 },   // +1 incubator each, up to 6
  hatchSpeed: { base: 50, growth: 3.0, max: 8, factor: 0.85 }, // hatch time × factor^level
  beltLuck:   { base: 40, growth: 3.2, max: 10 },  // rarer eggs more often
};
export const MAX_PENS = START.pens + UPGRADES.pen.max;
export const MAX_INCUBATORS = START.incubators + UPGRADES.incubator.max;

export function price(kind, level) {
  const u = UPGRADES[kind];
  return Math.round(u.base * Math.pow(u.growth, level));
}

// Goals, in order; 3 are shown at a time, each one done = 1 star.
// Kinds: grab (eggs grabbed), grabR (grabbed of a rarity), hatch, hatchR,
// streak (right answers in a row), cps (coins per second), book (different
// creatures found), upgrades (bought), pens (owned).
// `n` counts from the moment the goal appears (except streak/cps/book/pens,
// which compare the current value).
// Pacing (owner brief): a first-time player gets about 3 stars in 10–15 minutes.
export const GOALS = [
  { id: 'g1',  kind: 'grab', n: 3 },
  { id: 'g2',  kind: 'hatch', n: 1 },
  { id: 'g3',  kind: 'upgrades', n: 1 },
  { id: 'g4',  kind: 'streak', n: 5 },
  { id: 'g5',  kind: 'cps', n: 10 },
  { id: 'g6',  kind: 'hatchR', r: 'uncommon', n: 1 },
  { id: 'g7',  kind: 'book', n: 5 },
  { id: 'g8',  kind: 'grabR', r: 'rare', n: 1 },
  { id: 'g9',  kind: 'pens', n: 6 },
  { id: 'g10', kind: 'streak', n: 10 },
  { id: 'g11', kind: 'cps', n: 100 },
  { id: 'g12', kind: 'hatchR', r: 'epic', n: 1 },
  { id: 'g13', kind: 'book', n: 12 },
  { id: 'g14', kind: 'cps', n: 1000 },
  { id: 'g15', kind: 'hatchR', r: 'legendary', n: 1 },
  { id: 'g16', kind: 'book', n: 26 },
  { id: 'g17', kind: 'cps', n: 10000 },
];
// After the list: endless goals, alternating, each a bit bigger.
export function endlessGoal(k) {
  const i = Math.floor(k / 2);
  return k % 2 === 0
    ? { id: `e${k}`, kind: 'hatch', n: 10 + 5 * i }
    : { id: `e${k}`, kind: 'streak', n: Math.min(30, 12 + 2 * i) };
}
export const GOALS_SHOWN = 3;
