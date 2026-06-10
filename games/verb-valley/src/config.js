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
export const TIME = {
  WAKE: 360,            // 06:00
  SCHOOL_BELL: 480,     // 08:00
  CLASS_OVER_HINT: 540, // 09:00 (Krabsy stops waiting; bell still nags)
  DUSK: 1140,           // 19:00 golden hour starts
  BEDTIME_OK: 1080,     // 18:00 — sleeping allowed from here
  PASS_OUT: 1440,       // 24:00 — doze off where you stand
  MIN_PER_SEC: 2.4,     // 1080 in-game min over ~7.5 real minutes
};

// ── Crops ─────────────────────────────────────────────────────────────
// stage advances by 1 per watered sleep; ready when stage >= days.
export const CROPS = {
  turnip:   { name: 'Turnip',    emoji: '🥬', days: 2, seed: 10, sell: 22,  color: 0xc8f08a, ripe: 0x9be23a, schoolOnly: false },
  tomato:   { name: 'Tomato',    emoji: '🍅', days: 3, seed: 20, sell: 45,  color: 0xff8d6b, ripe: 0xff4d3d, schoolOnly: false },
  pumpkin:  { name: 'Pumpkin',   emoji: '🎃', days: 5, seed: 35, sell: 110, color: 0xffb35e, ripe: 0xff8c1a, schoolOnly: false },
  starfruit:{ name: 'Star Fruit',emoji: '⭐', days: 3, seed: 0,  sell: 160, color: 0xfff07a, ripe: 0xffd400, schoolOnly: true },
};
export const SELLABLE = {
  ...Object.fromEntries(Object.entries(CROPS).map(([k, c]) => [k, c.sell])),
  wood:  8,
  berry: 5,
};

export const AXE_COST = 50;

// ── World layout (XZ plane; +Z is toward the camera / "south") ─────────
export const LAYOUT = {
  ground: 46,
  cottage: { x: -13, z: -11 },
  bed:     { x: -13, z: -6.5 },   // step here + E to sleep
  crate:   { x: -7.5, z: -7 },
  shop:    { x: 13, z: -8 },
  // field grid
  field:   { cols: 6, rows: 4, gap: 1.7, cx: 2.5, cz: -1 },
  school:  { x: 0, z: 12.5 },     // blackboard; bench + Krabsy nearby
  pond:    { x: -15, z: 7, r: 4 },
  trees: [
    { x: -9, z: 4 }, { x: -5, z: 9 }, { x: 9, z: 6 },
    { x: 14, z: 2 }, { x: 11, z: -2 },
  ],
};

export const TREE_REGROW_DAYS = 2;
export const INTERACT_RANGE = 2.3;
export const SAVE_KEY = 'krabsy_vvalley_save';
export const SOUND_KEY = 'krabsy_vvalley_sound';
export const SAVE_VERSION = 1;
