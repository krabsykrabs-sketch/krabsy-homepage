// Gifts found in the Dungeon (docs/game-contract.md, "Gifts found in a game"; owner yes,
// 2026-11-25). After the boss of every level a golden chest rises from the floor. It holds
// that level's gift, a figure accessory from the site's catalogue, shown floating over the
// chest before it is opened (pickGift → image). Space opens it (no question: the boss fight
// was the questions) and grantGift() gives exactly that entry. A gift the child owns
// already, the game's daily limit (2 per calendar day, kept by the lib) or no site libs
// (dev server, file://) → the same chest holds coins, as every chest did before.
//
// The lib (/lib/krabsy-rewards.js, no three.js) never throws, but its import fails without
// the site; every function here then answers "no gift" and nothing else changes.

const LIB = '/lib/krabsy-rewards.js';
const SOURCE = 'verb-dungeon';

// One gift per level, dungeon-themed (ids from homepage/lib/krabsy-figure-catalog.js).
//   level 1, after the Golem:          the adventurer's cape (back slot: every figure can wear
//                                      it, also the default Schülerin, who can't wear hats)
//   level 2, after the Necromancer:    the knight's helmet
//   level 3, after the Skeleton Mage:  the wizard's hat (the Skeleton Mage's own)
export const GIFTS = ['back:capeRogue', 'hat:helmet', 'hat:wizard'];

let lib = null;
export const giftsReady = import(LIB)
  .then((m) => { if (typeof m.pickGift === 'function' && typeof m.grantGift === 'function') lib = m; })
  .catch(() => { /* not on the site: chests hold coins */ });

const nameIn = (id, lang) => {
  try { const i = lib.giftInfo && lib.giftInfo(id, lang); if (i && i.name) return i; } catch (_) { /* below */ }
  return null;
};

/**
 * What the gift chest of this level (0-based) holds: { id, slot, key, name, image } in the
 * game's language, or null (owned already, today's limit reached, no site). Never throws.
 */
export function giftFor(level, lang) {
  try {
    if (!lib || !GIFTS[level]) return null;
    const g = lib.pickGift({ source: SOURCE, id: GIFTS[level] });
    if (!g) return null;
    return { ...g, ...(nameIn(g.id, lang) || {}) };
  } catch (_) { return null; }
}

/**
 * Give the shown gift. → { ok: true, id, slot, key, name, image } or { ok: false, reason }
 * ('owned' | 'limit' | 'storage' | 'nolib' …). Never throws.
 */
export function takeGift(gift, lang) {
  try {
    if (!lib || !gift) return { ok: false, reason: 'nolib' };
    const r = lib.grantGift({ source: SOURCE, id: gift.id });
    if (!r || !r.ok) return r || { ok: false, reason: 'storage' };
    return { ...r, ...(nameIn(r.id, lang) || {}) };
  } catch (_) { return { ok: false, reason: 'storage' }; }
}
