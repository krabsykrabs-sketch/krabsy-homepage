// Every tunable number of the game lives here: rarities, hatch times, income,
// zones, prices, player, thieves, goals. Change numbers here, not in the code.

export const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

// Per rarity (same order as RARITIES). beam = light beam into the sky.
export const RARITY = {
  common:    { color: 0xf4f1ea, accent: 0xcfc8b8, css: '#f4f1ea', tier: 1, pair: false, hatch: 20,  income: 1,   grabBonus: 5,   species: 8, beam: false },
  uncommon:  { color: 0x6fdc7a, accent: 0x3faa4c, css: '#6fdc7a', tier: 1, pair: false, hatch: 40,  income: 5,   grabBonus: 15,  species: 6, beam: false },
  rare:      { color: 0x5aa8ff, accent: 0x2f6fd0, css: '#5aa8ff', tier: 2, pair: true,  hatch: 75,  income: 25,  grabBonus: 50,  species: 5, beam: true },
  epic:      { color: 0xb57bff, accent: 0x7a3fd6, css: '#b57bff', tier: 3, pair: true,  hatch: 120, income: 120, grabBonus: 200, species: 4, beam: true },
  legendary: { color: 0xffcf5e, accent: 0xe0a020, css: '#ffcf5e', tier: 3, pair: true,  hatch: 240, income: 600, grabBonus: 800, species: 3, beam: true },
};

// Each species of a rarity earns a little more than the one before it.
export const SPECIES_STEP = 0.12;
// A right answer pays a bonus: max(RARITY.grabBonus, seconds × income/s).
export const GRAB_BONUS_SECONDS = 8;
// Releasing a creature pays this many seconds of its income.
export const RELEASE_SECONDS = 60;

// The island (metres). Home = the hatchery. Zones are circles; everything else
// on the island is Meadow. weights = chance weights common … legendary.
export const ISLAND = { cx: 0, cz: -20, r: 125 };
export const HOME = { x: 0, z: 62 };
export const ZONES = [
  { id: 'meadow',  stars: 0, weights: [70, 30, 0, 0, 0], eggs: 14, thieves: 0 },
  { id: 'forest',  stars: 2, x: -68, z: -22, r: 34, weights: [0, 55, 45, 0, 0], eggs: 8, thieves: 2 },
  { id: 'beach',   stars: 5, x: 78, z: -14, r: 30, weights: [0, 0, 65, 35, 0], eggs: 7, thieves: 3 },
  { id: 'volcano', stars: 9, x: 0, z: -98, r: 30, weights: [0, 0, 0, 65, 35], eggs: 5, thieves: 3 },
];
export const EGG_RESPAWN = 12; // seconds until a taken egg is replaced in its zone

// Player
export const PLAYER = {
  walk: 6.5, sprint: 10.5, jump: 7.5, gravity: 22, eye: 1.6, radius: 0.45,
  reach: 3.2,          // how close to an egg / incubator / pen for E
};

// Thief crabs: they chase a player who carries eggs, inside their zone.
export const THIEF = {
  speed: 7.4,          // between walk and sprint
  see: 16,             // starts chasing within this distance
  leash: 12,           // gives up this far outside its zone
  dizzy: 9,            // seconds stunned after a right answer
  cooldown: 4,         // seconds of grace after any catch
};

// Coins earned while away: capped, and at a reduced rate.
export const AWAY = { capSeconds: 8 * 3600, rate: 0.2, minSeconds: 60 };

// Start values and upgrades. price(level) = base × growth^level.
export const START = { pens: 3, incubators: 2, backpack: 1 };
export const UPGRADES = {
  pen:        { base: 15, growth: 3.0, max: 9 },                 // +1 pen, up to 12
  incubator:  { base: 30, growth: 4.0, max: 4 },                 // +1 incubator, up to 6
  hatchSpeed: { base: 50, growth: 3.0, max: 8, factor: 0.85 },   // hatch time × factor^level
  shoes:      { base: 40, growth: 3.5, max: 5, factor: 1.1 },    // speed × factor^level
  backpack:   { base: 60, growth: 6.0, max: 3 },                 // +1 egg carried
};
export const MAX_PENS = START.pens + UPGRADES.pen.max;
export const MAX_INCUBATORS = START.incubators + UPGRADES.incubator.max;

export function price(kind, level) {
  const u = UPGRADES[kind];
  return Math.round(u.base * Math.pow(u.growth, level));
}

// Goals, in order; 3 are shown at a time, each one done = 1 star.
// Kinds: grab (eggs picked up), grabR (of a rarity), home (eggs brought home),
// hatch, hatchR, streak (right answers in a row), cps (coins per second), book
// (different creatures found), upgrades (bought), pens (owned), bonk (thieves
// bonked). `n` counts from the moment the goal appears, except for the
// absolute kinds (streak, cps, book, pens).
// Pacing (owner brief): a first-time player gets ~3 stars in 10–15 minutes and
// reaches the Forest (2 ★) in the first lesson.
export const GOALS = [
  { id: 'g1',  kind: 'home', n: 2 },
  { id: 'g2',  kind: 'hatch', n: 1 },
  { id: 'g3',  kind: 'upgrades', n: 1 },
  { id: 'g4',  kind: 'streak', n: 5 },
  { id: 'g5',  kind: 'grabR', r: 'rare', n: 1 },
  { id: 'g6',  kind: 'bonk', n: 1 },
  { id: 'g7',  kind: 'book', n: 5 },
  { id: 'g8',  kind: 'cps', n: 50 },
  { id: 'g9',  kind: 'pens', n: 6 },
  { id: 'g10', kind: 'grabR', r: 'epic', n: 1 },
  { id: 'g11', kind: 'streak', n: 10 },
  { id: 'g12', kind: 'book', n: 12 },
  { id: 'g13', kind: 'cps', n: 1000 },
  { id: 'g14', kind: 'hatchR', r: 'legendary', n: 1 },
  { id: 'g15', kind: 'bonk', n: 10 },
  { id: 'g16', kind: 'book', n: 26 },
  { id: 'g17', kind: 'cps', n: 10000 },
];
export function endlessGoal(k) {
  const i = Math.floor(k / 2);
  return k % 2 === 0
    ? { id: `e${k}`, kind: 'home', n: 10 + 5 * i }
    : { id: `e${k}`, kind: 'streak', n: Math.min(30, 12 + 2 * i) };
}
export const GOALS_SHOWN = 3;
