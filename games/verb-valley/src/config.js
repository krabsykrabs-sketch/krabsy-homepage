// Shared constants for Verb Valley. Tunables live here so balance + layout
// changes don't require hunting through gameplay modules.

// ── Krabsy house palette ──────────────────────────────────────────────
export const PAL = {
  teal:  '#2ee6c0',
  coral: '#ff8585',
  amber: '#ffcf5e',
  navy:  '#141a33',
  navy2: '#1d2647',
};

// ── Clock ─────────────────────────────────────────────────────────────
// In-game minutes. The playable day runs 06:00 (360) → 24:00 (1440).
// School opens at wake and bed works anytime — playtesting showed any
// "wait until X o'clock" window is dead time in a 7-minute day.
export const TIME = {
  WAKE: 360,            // 06:00
  SCHOOL_BELL: 360,     // class available from the moment you wake
  CLASS_LENGTH: 60,     // in-game minutes the clock jumps after class
  DUSK: 1140,           // 19:00 golden hour starts
  PASS_OUT: 1440,       // 24:00 — doze off where you stand
  MIN_PER_SEC: 2.4,     // 1080 in-game min over ~7.5 real minutes
};

// ── Crops ─────────────────────────────────────────────────────────────
// stage advances by 1 per watered sleep; ready when stage >= days.
// tier: 1 always in the shop, 2/3 unlock as the crop album fills
// (see TIER_UNLOCK). schoolOnly crops come from class rewards in ladder
// order (SCHOOL_LADDER) — the rare seeds the album hunts for.
// shape drives the procedural mesh: ball | cluster | ground | gem | tall.
export const CROPS = {
  carrot:    { name: 'Carrot',      emoji: '🥕', days: 1, seed: 6,  sell: 12,  tier: 1, color: 0xffb066, ripe: 0xff8c2e, shape: 'ball' },
  turnip:    { name: 'Turnip',      emoji: '🥬', days: 2, seed: 10, sell: 22,  tier: 1, color: 0xc8f08a, ripe: 0x9be23a, shape: 'ball' },
  tomato:    { name: 'Tomato',      emoji: '🍅', days: 3, seed: 20, sell: 45,  tier: 1, color: 0xff8d6b, ripe: 0xff4d3d, shape: 'cluster' },
  pumpkin:   { name: 'Pumpkin',     emoji: '🎃', days: 5, seed: 35, sell: 110, tier: 1, color: 0xffb35e, ripe: 0xff8c1a, shape: 'ground' },
  strawberry:{ name: 'Strawberry',  emoji: '🍓', days: 4, seed: 30, sell: 80,  tier: 2, color: 0xff9aa8, ripe: 0xff4060, shape: 'cluster' },
  sunflower: { name: 'Sunflower',   emoji: '🌻', days: 3, seed: 40, sell: 90,  tier: 2, color: 0xffe066, ripe: 0xffc400, shape: 'tall' },
  melon:     { name: 'Melon',       emoji: '🍈', days: 6, seed: 60, sell: 190, tier: 2, color: 0xb8e6a0, ripe: 0x7ed957, shape: 'ground' },
  eggplant:  { name: 'Eggplant',    emoji: '🍆', days: 4, seed: 45, sell: 120, tier: 3, color: 0xb88ad4, ripe: 0x7a3fa8, shape: 'ball' },
  grapes:    { name: 'Grapes',      emoji: '🍇', days: 5, seed: 70, sell: 210, tier: 3, color: 0xc09ae0, ripe: 0x8a4fc8, shape: 'cluster' },
  starfruit: { name: 'Star Fruit',  emoji: '⭐', days: 3, seed: 0,  sell: 160, schoolOnly: true, color: 0xfff07a, ripe: 0xffd400, shape: 'gem' },
  moonfruit: { name: 'Moon Fruit',  emoji: '🌙', days: 4, seed: 0,  sell: 280, schoolOnly: true, color: 0xcfd8ff, ripe: 0x9ab0ff, shape: 'gem' },
  rainbowfruit:{ name: 'Rainbow Fruit', emoji: '🌈', days: 6, seed: 0, sell: 500, schoolOnly: true, color: 0xffb0e8, ripe: 0xff66cc, shape: 'gem' },
};
// Album display + reward order.
export const CROP_ORDER = Object.keys(CROPS);
export const SCHOOL_LADDER = ['starfruit', 'moonfruit', 'rainbowfruit'];
// Distinct crops harvested → shop tier unlocked.
export const TIER_UNLOCK = { 1: 0, 2: 3, 3: 6 };

export const SELLABLE = {
  ...Object.fromEntries(Object.entries(CROPS).map(([k, c]) => [k, c.sell])),
  wood:  8,
  berry: 5,
  hay:   4,
  stone: 6,
  gold:  28,
  gem:   48,
  fish:  18,
  goldfish: 60,
};

// Buyable tools (shovel/bucket/sword are free starters).
export const TOOL_COST = { axe: 50, pickaxe: 60, rod: 40 };

export const ITEM_EMOJI = {
  ...Object.fromEntries(Object.entries(CROPS).map(([k, c]) => [k, c.emoji])),
  wood: '🪵', berry: '🫐', hay: '🌾',
  stone: '🪨', gold: '🪙', gem: '💎', fish: '🐟', goldfish: '🐠',
};

// ── Mining ────────────────────────────────────────────────────────────
// Node types by spawn weight; a mined node regrows overnight as a fresh
// weighted roll, so the quarry stays mostly stone with lucky days.
export const MINE_NODES = {
  stone: { name: 'Stone', emoji: '🪨', weight: 6, drop: 'stone', n: 2 },
  gold:  { name: 'Gold',  emoji: '🪙', weight: 2, drop: 'gold',  n: 1 },
  gem:   { name: 'Gem',   emoji: '💎', weight: 1, drop: 'gem',   n: 1 },
};

// ── Fishing ───────────────────────────────────────────────────────────
export const FISHING = {
  WAIT_MIN: 1.2, WAIT_MAX: 3.6,   // seconds until a bite
  BITE_WINDOW: 0.9,               // seconds to react
  GOLD_CHANCE: 0.1,               // lucky goldfish
};

// ── World layout (XZ plane; +Z is toward the camera / "south") ─────────
export const LAYOUT = {
  ground: 46,
  cottage: { x: -13, z: -11 },
  bed:     { x: -13, z: -6.5 },   // step here + E to sleep
  crate:   { x: -7.5, z: -7 },
  shop:    { x: 13, z: -8 },
  // field grid
  field:   { cols: 6, rows: 4, gap: 1.7, cx: 2.5, cz: -1 },
  // hay meadow: big, cheap, regrows daily — the time-filler grind
  hay:     { cols: 8, rows: 3, gap: 1.5, cx: 7, cz: -12.5 },
  school:  { x: 0, z: 12.5 },     // blackboard; bench + Krabsy nearby
  pond:    { x: -15, z: 7, r: 4 },
  trees: [
    { x: -9, z: 4 }, { x: -5, z: 9 }, { x: 9, z: 6 },
    { x: 14, z: 2 }, { x: 11, z: -2 },
  ],
  // quarry corner (west edge, below the pond)
  mine: [
    { x: -19, z: -2.5 }, { x: -17.2, z: -0.8 }, { x: -19.4, z: 1.2 },
    { x: -16.8, z: -3.6 }, { x: -18.2, z: 3.4 }, { x: -16.2, z: 2.0 },
  ],
};

export const TREE_REGROW_DAYS = 2;
export const INTERACT_RANGE = 2.3;
export const SAVE_KEY = 'krabsy_vvalley_save';
export const SOUND_KEY = 'krabsy_vvalley_sound';
export const SAVE_VERSION = 3;
