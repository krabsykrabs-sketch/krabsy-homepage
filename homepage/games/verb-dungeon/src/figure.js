// The child's own figure as the hero (docs/game-contract.md, "The player's figure"), and
// the one-time move of the old coin hero shop's purchases into the site's shells store
// (docs/figures-shells-world.md, "What happens to the games' own unlocks").
//
// Both libs come from the site (/lib/). Without the site (dev server, file://) the imports
// fail: main.js then builds the old Knight from this folder's assets, and the migration
// waits for a load on the site (it is only marked done when it worked).
import { Save } from './heroes.js';

const FIGURE_LIB = '/lib/krabsy-figure.js';
const SHELLS_LIB = '/lib/krabsy-shells.js';

// Accessory slots the Dungeon doesn't show. None: capes and back items fit the rooms (the
// camera looks down from 43°, the sword swings in front), checked 2026-11-25.
const HIDE = [];

// Old Dungeon hero → what the child gets in the shells store (ids of krabsy-figure.js).
//   barbarian → the Barbarian.
//   rogue     → Rogue_Hooded: the Dungeon's rogue was the hooded model (the plain Rogue is free).
//   mage      → the Mage is the Quiz-Raum teacher's and not in the catalogue: the Cleric
//               (the catalogue's human spell-caster, 200) plus the wizard hat (90), so the
//               old pointy-hat look can be built again (e.g. the free Witch + wizard hat).
export const MIGRATE = {
  barbarian: ['char:Barbarian'],
  rogue: ['char:Rogue_Hooded'],
  mage: ['char:Cleric', 'hat:wizard'],
};
// A child who played one of them and has no figure yet keeps that look: it becomes the
// figure (the mage: the Witch in purple with the wizard hat, the closest to the old Mage).
const LOOK = {
  barbarian: { char: 'Barbarian' },
  rogue: { char: 'Rogue_Hooded' },
  mage: { char: 'Witch', hat: 'wizard', main: 4 },
};

/**
 * Runs once (idempotent: unlocking an owned id changes nothing, a saved figure is never
 * replaced). → { unlocked: [ids], figure: config | null } or null when nothing was done.
 * Never throws.
 */
export async function migrateHeroes() {
  try {
    if (Save.raw.migrated) return null;
    const owned = (Array.isArray(Save.raw.owned) ? Save.raw.owned : []).filter((id) => Object.hasOwn(MIGRATE, id));
    if (!owned.length) { Save.setMigrated(); return null; }
    const shells = await import(SHELLS_LIB);
    const unlocked = [];
    let ok = true;
    for (const hero of owned) {
      for (const id of MIGRATE[hero]) {
        const r = shells.unlock(id, 0); // price 0: a gift, the balance is not touched
        if (r && r.ok) { if (!r.already) unlocked.push(id); } else ok = false;
      }
    }
    let figure = null;
    const look = owned.includes(Save.raw.hero) && LOOK[Save.raw.hero];
    if (ok && look) {
      const F = await import(FIGURE_LIB);
      if (!F.readSavedFigure()) { figure = F.normalize(look); if (!F.saveFigure(figure)) figure = null; }
    }
    if (ok) Save.setMigrated(); // storage failed: try again next time
    return { unlocked, figure };
  } catch (_) { return null; /* not on the site: try again next time */ }
}

/**
 * The hero model: the child's figure, or the figure catalogue's Knight when there is none.
 * Throws when the site libs or assets are missing (main.js then uses the old Knight).
 * → { root, own, config, dispose }
 */
export async function loadHeroFigure() {
  const F = await import(FIGURE_LIB);
  // The Dungeon brings its own clips (anim_medium.glb with the swing, death and ranged
  // clips on the same skeleton), so the shared animation files are not needed.
  return F.loadPlayerFigure({ fallback: 'Knight', lambert: true, clips: false, hide: HIDE });
}
