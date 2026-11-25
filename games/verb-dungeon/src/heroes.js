// The heroes of the start screen's hero picker (owner decision 2026-11-25,
// docs/game-contract.md "Hero choice on the start screen"): first the child's own figure
// ('figure', src/figure.js; the default Schülerin when the child has none), then the
// Dungeon's own heroes, free, from this folder: the Knight, the Barbarian, the Rogue and
// the Mage. They are not saved as the child's figure; the last pick is remembered here
// (`Choice`, localStorage krabsy_vdungeon_hero). Coins are the treasure of one level run
// (chests, boss, treasure room), shown in the HUD and on the end screen; they buy nothing.
// The child's figure carries the Knight's gear without the shield (its sword is the
// Dungeon's item on the right hand slot; the figure catalogue stays weapon-free).
// Every hero is the same rig; each Dungeon hero has its own weapon(s), swing and swoosh
// colour (play-test notes 7 + 13). Models other than the knight load when first chosen
// (Assets.loadHero).
//
// gear: models in the hand slots ('r' = handslot.r, 'l' = handslot.l), `scale`, and
//   `hold`: 'fixed' (as the model sits in the hand), 'faceCam' (turned about its handle
//   so the flat side faces the camera every frame: an axe head or a dagger blade reads
//   from above instead of edge-on), 'upright' (at rest kept vertical, top up, leaning
//   forward and out so it shows from above: the mage's staff, gem up; during a swing it
//   blends into the hand's pose and follows the arm, gem first, then back: main.js updateGear);
//   `glow` = a soft light sprite at height y on the model (the staff's gem).
//   `figure: false` = not on the child's figure (the shield).
// swing: a key of SWINGS. trails: one swoosh per entry, following that hand's slot;
//   `dir` -1 = the hand sweeps to the hero's right, +1 = to the left; r0/r1 = inner and
//   outer radius from the hero, maxLen = longest tail (radians), tint = how much of the
//   colour is already at the blade (0 = white-hot edge); tip = distance of the weapon's tip
//   from the hand slot (the arc then runs through it: the staff's gem). sparks: colour of the
//   hit sparks; magic: extra sparkle.
// portraitT: for ?qa=portrait, hold the swing clip at this time (the axe held up in both
//   hands); without it the hero stands idle.
export const HEROES = [
  { id: 'knight', file: 'Knight.glb', swing: 'slice',
    gear: [{ model: 'sword_1handed', slot: 'r' }, { model: 'shield_round', slot: 'l', figure: false }],
    trails: [{ slot: 'r', color: 0x2ee6c0 }], sparks: 0xffcf5e },
  { id: 'barbarian', file: 'Barbarian.glb', swing: 'heavy', portraitT: 0.05,
    gear: [{ model: 'axe_2handed', slot: 'r', scale: 1.05, hold: 'faceCam' }], // big, not oversized (note 13; was 1.35)
    trails: [{ slot: 'r', color: 0xffa31a, tint: 0.45, r0: 0.8, r1: 2.45, maxLen: 2.7 }], sparks: 0xffcf5e },
  { id: 'rogue', file: 'Rogue_Hooded.glb', swing: 'dual',
    gear: [{ model: 'dagger', slot: 'r', scale: 1.3, hold: 'faceCam' }, { model: 'dagger', slot: 'l', scale: 1.3, hold: 'faceCam' }],
    // Two crescents that cross in front (a scissor cut): the right one outside, the left inside.
    trails: [{ slot: 'r', color: 0xff5c6c, tint: 0.55, r0: 1.55, r1: 2.45, maxLen: 1.6 },
      { slot: 'l', color: 0xff8f6b, tint: 0.55, r0: 1.0, r1: 1.85, maxLen: 1.6, dir: 1 }], sparks: 0xff8585 },
  { id: 'mage', file: 'Mage.glb', swing: 'slice',
    gear: [{ model: 'staff', slot: 'r', hold: 'upright', scale: 1.35, glow: { color: 0xb57bff, y: 1.15, size: 1.2 } }],
    trails: [{ slot: 'r', color: 0x9d55ff, tint: 0.55, tip: 1.55 }], sparks: 0xd7a8ff, magic: true }, // tip: the gem (1.15 × 1.35)
];
// The picker's tiles in order; 'figure' plays with the knight's def (sword, no shield).
export const PICKS = ['figure', ...HEROES.map((h) => h.id)];
const HERO_KEY = 'krabsy_vdungeon_hero';
export const Choice = {
  // An unknown or missing value (or no storage) → the child's figure.
  get() { try { const v = localStorage.getItem(HERO_KEY); return PICKS.includes(v) ? v : 'figure'; } catch (_) { return 'figure'; } },
  set(id) { try { localStorage.setItem(HERO_KEY, id); } catch (_) { /* private mode */ } },
};

// Forehand (play-test note 13, 2026-11-22): every weapon is in the right hand (the rogue
// has one in each), but the KayKit slices sweep the blade from the hero's left to the
// right, a backhand that read as a left-hand swing. `reverse: true` plays the whole clip
// backwards (Assets.upperBodyClip): the reversed recovery is a wind-up to the weapon side,
// the reversed strike sweeps right → left (each dagger from its own side inwards), the
// reversed wind-up is the follow-through. main.js turns the numbers below (clip times of
// the original clip) into times of the reversed one (swingTimes) and flips each trail's dir.
// Swing clips (upper body only, see Assets.upperBodyClip), measured from the keyframes
// (blade direction seen from above, 0° = ahead, + = the hero's left). `from` = clip time
// at the key press, `speed` = time scale, strikeFrom/strikeTo = the strike in clip time
// (the swoosh is drawn between them). Each starts inside its wind-up so the blade is in
// front ~0.12 s after the key press (hit check, SWING.hitAfter in main.js); the next
// swing is allowed 0.38 s after the press for every hero.
export const SWINGS = {
  // 1H horizontal slice: wind-up to +120° (0.20), strike +120° → −77° (0.20–0.37, ahead at 0.26).
  slice: { clip: 'Melee_1H_Attack_Slice_Horizontal', from: 0.14, speed: 1, strikeFrom: 0.2, strikeTo: 0.38, ahead: 0.26, reverse: true },
  // 2H slice: wind-up to +119° (0.33), strike +119° → −35° (0.33–0.60, ahead at ~0.45),
  // both hands on the handle. A shorter, heavier arc.
  heavy: { clip: 'Melee_2H_Attack_Slice', from: 0.27, speed: 1.1, strikeFrom: 0.33, strikeTo: 0.6, ahead: 0.41, reverse: true }, // reversed: blade ahead at D − 0.41
  // Dual-wield slice: both blades raised crossed (0.47), then a scissor cut: right
  // +108° → −104°, left −106° → +104° (0.53–0.82, both ahead at ~0.66). Played faster.
  dual: { clip: 'Melee_Dualwield_Attack_Slice', from: 0.52, speed: 1.2, strikeFrom: 0.53, strikeTo: 0.84, ahead: 0.66, reverse: true },
};
// The clip times used at run time: for a reversed clip of duration D, time t becomes D − t,
// and the press starts as far before the blade is ahead as in the original (same latency).
export function swingTimes(sw, D) {
  if (!sw.reverse) return sw;
  const ahead = D - sw.ahead;
  return { ...sw, from: ahead - (sw.ahead - sw.from), strikeFrom: D - sw.strikeTo, strikeTo: D - sw.strikeFrom, ahead };
}
export const heroDef = (id) => HEROES.find((h) => h.id === id) || HEROES[0];

// localStorage krabsy_vdungeon_save: { coins, owned, hero, migrated }. `owned` and `hero`
// are what the old hero shop saved; they are kept as they were (figure.js migrateHeroes
// reads them) and never written again. `migrated` = the shop's purchases are in the shells
// store. `coins` = all coins ever collected (kept, not shown).
const KEY = 'krabsy_vdungeon_save';
export const Save = {
  coins: 0, raw: {},
  load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      this.raw = s && typeof s === 'object' ? s : {};
      this.coins = Math.max(0, Math.floor(Number(this.raw.coins) || 0));
    } catch (_) { this.raw = {}; /* private mode: start fresh */ }
  },
  store() {
    try { localStorage.setItem(KEY, JSON.stringify({ ...this.raw, coins: this.coins })); } catch (_) { /* private mode */ }
  },
  addCoins(n) { this.coins += n; this.store(); },
  setMigrated() { this.raw.migrated = true; this.store(); },
};
Save.load();
