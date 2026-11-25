// The hero's game items and swing (the hero itself is the child's figure, src/figure.js),
// and the saved Dungeon progress. Since 2026-11-25 the hero is the child's own figure from
// the site (docs/game-contract.md, "The player's figure"); the coin hero shop (Barbarian,
// Rogue, Mage) is gone and its purchases were moved to the site's shells store once
// (figure.js migrateHeroes). Coins are the treasure of one level run (chests, boss,
// treasure room), shown in the HUD and on the end screen; they buy nothing.
// The sword is the Dungeon's own item, attached to the figure's right hand slot; the
// figure catalogue itself stays weapon-free.
//
// gear: models in the hand slots ('r' = handslot.r, 'l' = handslot.l), `scale`, and
//   `hold`: 'fixed' (as the model sits in the hand). `figure: false` = only on the old
//   Knight (the fallback hero), not on a child's own figure (the shield).
// swing: a key of SWINGS. trails: one swoosh per entry, following that hand's weapon;
//   `dir` -1 = the hand sweeps to the hero's right, +1 = to the left; r0/r1 = inner and
//   outer radius from the hero, maxLen = longest tail (radians), tint = how much of the
//   colour is already at the blade (0 = white-hot edge). sparks: colour of the hit sparks.
export const HEROES = [
  { id: 'knight', file: 'Knight.glb', swing: 'slice',
    gear: [{ model: 'sword_1handed', slot: 'r' }, { model: 'shield_round', slot: 'l', figure: false }],
    trails: [{ slot: 'r', color: 0x2ee6c0 }], sparks: 0xffcf5e },
];

// Forehand (play-test note 13, 2026-11-22): the sword is in the right hand, but the KayKit slices sweep the blade from the hero's left to the
// right, a backhand that read as a left-hand swing. `reverse: true` plays the whole clip
// backwards (Assets.upperBodyClip): the reversed recovery is a wind-up to the weapon side,
// the reversed strike sweeps right → left, the
// reversed wind-up is the follow-through. main.js turns the numbers below (clip times of
// the original clip) into times of the reversed one (swingTimes) and flips each trail's dir.
// Swing clips (upper body only, see Assets.upperBodyClip), measured from the keyframes
// (blade direction seen from above, 0° = ahead, + = the hero's left). `from` = clip time
// at the key press, `speed` = time scale, strikeFrom/strikeTo = the strike in clip time
// (the swoosh is drawn between them). Each starts inside its wind-up so the blade is in
// front ~0.12 s after the key press (hit check, SWING.hitAfter in main.js); the next
// swing is allowed 0.38 s after the press. (Until 2026-11-25 the shop heroes had their own
// 2H and dual-wield swings; see git history.)
export const SWINGS = {
  // 1H horizontal slice: wind-up to +120° (0.20), strike +120° → −77° (0.20–0.37, ahead at 0.26).
  slice: { clip: 'Melee_1H_Attack_Slice_Horizontal', from: 0.14, speed: 1, strikeFrom: 0.2, strikeTo: 0.38, ahead: 0.26, reverse: true },
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
