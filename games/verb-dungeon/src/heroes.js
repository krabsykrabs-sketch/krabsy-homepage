// Heroes and the saved progress that buys them. Coins are collected in the dungeon
// (chests, the boss, the treasure room) and spent here; stars stay in their own key.
// Every hero is the same rig; each has its own weapon(s), swing and swoosh colour.
// Models other than the knight are loaded when first chosen (Assets.loadHero).
//
// gear: models in the hand slots ('r' = handslot.r, 'l' = handslot.l), `scale`, and
//   `hold`: 'fixed' (as the model sits in the hand), 'faceCam' (turned about its handle
//   so the flat side faces the camera every frame: an axe head or a dagger blade reads
//   from above instead of edge-on), 'upright' (at rest kept vertical, top up, leaning
//   forward and out so it shows from above: the mage's staff, gem up; during a swing it
//   blends into the hand's pose and follows the arm, gem first, then back: main.js updateGear);
//   `glow` = a soft light sprite at height y on the model (the staff's gem).
// swing: a key of SWINGS. trails: one swoosh per entry, following that hand's slot;
//   `dir` -1 = the hand sweeps to the hero's right, +1 = to the left; r0/r1 = inner and
//   outer radius from the hero, maxLen = longest tail (radians), tint = how much of the
//   colour is already at the blade (0 = white-hot edge); tip = distance of the weapon's tip
//   from the hand slot (the arc then runs through it: the staff's gem). sparks: colour of the
//   hit sparks; magic: extra sparkle.
// portraitT: for ?qa=portrait, hold the swing clip at this time (the axe held up in both
//   hands); without it the hero stands idle.
export const HEROES = [
  { id: 'knight', file: 'Knight.glb', cost: 0, swing: 'slice',
    gear: [{ model: 'sword_1handed', slot: 'r' }, { model: 'shield_round', slot: 'l' }],
    trails: [{ slot: 'r', color: 0x2ee6c0 }], sparks: 0xffcf5e },
  { id: 'barbarian', file: 'Barbarian.glb', cost: 40, swing: 'heavy', portraitT: 0.05,
    gear: [{ model: 'axe_2handed', slot: 'r', scale: 1.05, hold: 'faceCam' }], // big, not oversized (note 13; was 1.35)
    trails: [{ slot: 'r', color: 0xffa31a, tint: 0.45, r0: 0.8, r1: 2.45, maxLen: 2.7 }], sparks: 0xffcf5e },
  { id: 'rogue', file: 'Rogue_Hooded.glb', cost: 90, swing: 'dual',
    gear: [{ model: 'dagger', slot: 'r', scale: 1.3, hold: 'faceCam' }, { model: 'dagger', slot: 'l', scale: 1.3, hold: 'faceCam' }],
    // Two crescents that cross in front (a scissor cut): the right one outside, the left inside.
    trails: [{ slot: 'r', color: 0xff5c6c, tint: 0.55, r0: 1.55, r1: 2.45, maxLen: 1.6 },
      { slot: 'l', color: 0xff8f6b, tint: 0.55, r0: 1.0, r1: 1.85, maxLen: 1.6, dir: 1 }], sparks: 0xff8585 },
  { id: 'mage', file: 'Mage.glb', cost: 150, swing: 'slice',
    gear: [{ model: 'staff', slot: 'r', hold: 'upright', scale: 1.35, glow: { color: 0xb57bff, y: 1.15, size: 1.2 } }],
    trails: [{ slot: 'r', color: 0x9d55ff, tint: 0.55, tip: 1.55 }], sparks: 0xd7a8ff, magic: true }, // tip: the gem (1.15 × 1.35)
];

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

const KEY = 'krabsy_vdungeon_save';
export const Save = {
  coins: 0, owned: ['knight'], hero: 'knight',
  load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY)) || {};
      this.coins = Math.max(0, Math.floor(Number(s.coins) || 0));
      this.owned = HEROES.filter((h) => h.cost === 0 || (s.owned || []).includes(h.id)).map((h) => h.id);
      this.hero = this.owned.includes(s.hero) ? s.hero : 'knight';
    } catch (_) { /* private mode: start fresh */ }
    // Testing: ?unlock (which also opens all levels) makes every hero selectable.
    // Note: picking a hero then stores it as owned in this browser.
    try { if (new URLSearchParams(location.search).has('unlock')) this.owned = HEROES.map((h) => h.id); } catch (_) { /* no location */ }
  },
  store() {
    try { localStorage.setItem(KEY, JSON.stringify({ coins: this.coins, owned: this.owned, hero: this.hero })); } catch (_) { /* private mode */ }
  },
  addCoins(n) { this.coins += n; this.store(); },
  // Buys a hero if the coins are there. Returns true when the hero is (now) owned.
  buy(id) {
    if (this.owned.includes(id)) return true;
    const h = heroDef(id);
    if (h.id !== id || this.coins < h.cost) return false;
    this.coins -= h.cost; this.owned.push(id); this.store();
    return true;
  },
  choose(id) { if (this.owned.includes(id)) { this.hero = id; this.store(); } },
};
Save.load();
