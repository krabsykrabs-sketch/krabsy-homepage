// The hero chosen on the title screen (owner decision 2026-11-25, docs/game-contract.md
// "Hero choice on the start screen"): 'mine' (the child's figure, preselected) or one of
// this game's free heroes (player-character.js HEROES). Remembered for this game only in
// localStorage krabsy_vp_hero; never written to the child's figure. Never throws.
import { HEROES } from './player-character.js';

const KEY = 'krabsy_vp_hero';

export function getHero() {
  try {
    const h = localStorage.getItem(KEY);
    if (HEROES.includes(h)) return h;
  } catch (_) { /* private mode */ }
  return 'mine';
}

export function saveHero(h) {
  if (!HEROES.includes(h)) return;
  try { localStorage.setItem(KEY, h); } catch (_) { /* ignore */ }
}
