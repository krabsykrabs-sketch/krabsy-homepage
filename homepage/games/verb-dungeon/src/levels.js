// Level data. A level is a chain of rooms; you leave each room through the verb
// door in the back wall. Room format: see buildRoom() in room.js.
// Prop entry: [model, x, z, rotDeg, blockRadius, y]. Skeleton entry: a patrol route.
// Room type (`type`, default 'key'): what the player must do to get on.
//   'key'     find the hidden key. Where it hides:
//               `search: [[model, x, z, rotDeg, blockRadius], …]` given → in one of these
//               2–3 props (built as extra props with the "usable" marker, marker.js;
//               Space next to one searches it). Needed in rooms without skeletons; also fine with skeletons.
//               No `search` → in one of the room's skeletons (found when bonked).
//             Which one is picked at random when the room starts; the last one searched
//             or bonked always has it. Walking over the key takes it; then the verb book
//             (Space in its circle) asks both forms, and the door opens by itself.
//   'ambush'  the skeletons rise when the hero walks in (each at the start of its
//             route); one of them has the key, as in 'key'.
//   'rune'    two walls of three doors with words, walk into the right one of each (no skeletons).
//   'bridge'  two pits with a row of word stones each and a strip of floor between,
//             walked across (no skeletons, no props between z −5.4 and 5.4).
//   'vault'   treasure room: coins lie at `coins: [[x, z], …]`; the verb book opens the door.
//   'boss'    the last room of a level; `boss: 'golem' | 'necro' | 'mage'` (main.js BOSSES).
//             Keep the floor open.
// Key, ambush and vault rooms have the verb book on a stand in a rune circle near the door
// (room.js BOOK, right of the door at x 2.8 z −5.2; `book: [x, z]` moves it). Keep props
// ≥ 2.2 from it.
// Decoration never moves or glows, and is never a coin pile or a chest: everything that
// looks like treasure can be used (play-test note 6), so no coin_stack_*, trunk_large_A or
// box_small_decorated (it has coins on it) as props. Usable things get the marker.

const cellar = { // barrels and a table, the look-test room
  shelves: true, banners: 'red',
  props: [
    ['barrel_large', -8.4, -6.4, 17, 1.1], ['barrel_small_stack', -6.4, -6.7, 6, 1.0],
    ['keg_decorated', -8.3, -3.4, 90, 1.5], ['table_medium_decorated_A', -6.2, 3.2, 11, 1.4],
    ['chair', -4.6, 3.4, -100, 0.5], ['stool', -6.4, 5.0, 23, 0.5],
    ['column', -2.6, -5.6, 0, 0.6], ['candle_triple', -2.6, -5.6, 30, 0, 1.4], // the verb book stands right of the door
    ['crates_stacked', 8.1, 5.6, 11, 1.5], ['box_large', 6.1, 6.6, 29, 1.0],
  ],
};
const storage = { // crates along the walls, open middle
  banners: 'blue',
  props: [
    ['crates_stacked', -8.2, -6.2, -8, 1.5], ['box_large', -8.3, -3.6, 14, 1.0],
    ['box_large', -6.3, -6.6, 40, 1.0], ['barrel_large', 8.3, -6.3, 0, 1.1],
    ['barrel_large', 8.4, -4.2, 50, 1.1], ['barrel_small_stack', 6.3, -6.7, -6, 1.0],
    ['barrel_small_stack', -8.4, 5.6, 80, 1.0], ['box_large', 8.2, 6.4, -20, 1.0],
    ['pillar_decorated', -4.5, -1.5, 0, 1.1], ['pillar_decorated', 4.5, -1.5, 0, 1.1],
  ],
};
const hall = { // dining hall with two tables
  shelves: true, banners: 'red', trophy: true,
  props: [
    ['table_medium_decorated_A', -5.5, -2.5, 4, 1.4], ['chair', -5.4, -0.8, 175, 0.5],
    ['stool', -7.2, -2.6, 0, 0.5], ['table_medium_decorated_A', 5.5, 1.5, -8, 1.4],
    ['chair', 5.6, 3.2, 185, 0.5], ['stool', 3.8, 1.3, 0, 0.5],
    ['keg_decorated', 8.3, -6.2, 0, 1.5], ['barrel_small_stack', -8.2, -6.7, 10, 1.0],
    ['column', -2.6, -5.6, 0, 0.6], ['candle_triple', -2.6, -5.6, 30, 0, 1.4], // the verb book stands right of the door
    ['barrel_large', -8.3, 6.2, 75, 1.1], ['barrel_small_stack', 8.4, 6.2, -17, 1.0],
  ],
};
const vault = { // treasure room. No coins or chests as decoration: every coin here is collectable
  banners: 'blue', trophy: true,
  props: [
    ['barrel_small_stack', 8.5, -3.4, 20, 1.0], ['barrel_large', -8.5, -6.5, 80, 1.1],
    ['box_large', -6.5, -6.6, 10, 1.0], ['keg_decorated', -8.3, -3.2, 90, 1.5],
    ['column', -4.4, -6.6, 0, 0.6], ['candle_triple', -4.4, -6.6, 30, 0, 1.4],
    ['column', 4.4, -6.6, 0, 0.6], ['candle_triple', 4.4, -6.6, 126, 0, 1.4],
    ['pillar_decorated', -6, 1, 0, 1.1],
    ['pillar_decorated', 6, 1, 0, 1.1], ['crates_stacked', -8.1, 5.8, -12, 1.5],
  ],
};

const runes = { // three rune doors in the back wall; props stay at the sides
  type: 'rune', shelves: true, banners: 'red',
  props: [
    ['crates_stacked', -8.2, 5.8, -8, 1.5], ['box_large', -8.3, 3.4, 30, 1.0],
    ['barrel_large', 8.3, 5.6, 0, 1.1], ['barrel_small_stack', 8.3, 3.2, -6, 1.0],
    ['box_large', 8.4, -3.2, -85, 1.0], ['keg_decorated', -8.3, -3.4, 90, 1.5],
  ],
};
const chasm = { // word bridge: two pits with word stones (z −4.4…4.4), props only on the ledges
  type: 'bridge', banners: 'blue',
  props: [
    // kept back from the pit edges, so bumping into one never pushes the hero over the edge
    ['barrel_large', -8.4, 6.6, 17, 1.1], ['box_large', 8.3, 6.6, -20, 1.0],
    ['barrel_small_stack', -8.3, -6.7, 6, 1.0], ['barrel_large', 8.3, -6.7, 11, 1.1],
    ['column', -2.6, -7.0, 0, 0.6], ['candle_triple', -2.6, -7.0, 30, 0, 1.4], // against the back wall:
    ['column', 2.6, -7.0, 0, 0.6], ['candle_triple', 2.6, -7.0, 126, 0, 1.4],  // the far ledge stays walkable
  ],
};

const arena = { // boss room: open floor, things only in the corners
  type: 'boss', banners: 'red', trophy: true,
  props: [
    ['barrel_small_stack', 8.4, -6.6, 23, 1.0], ['barrel_large', 6.6, -6.7, 57, 1.1],
    ['barrel_large', -8.5, -6.5, 80, 1.1], ['box_large', -6.6, -6.7, -4, 1.0],
    ['barrel_large', -8.5, 6.4, 17, 1.1], ['crates_stacked', 8.3, 6.2, 11, 1.5],
  ],
};

const R = (base, extra) => ({ ...base, ...extra });
const patrolA = [[-6, -2], [5, -2.5], [4, 2], [-3, 0.5]];
const patrolB = [[6.5, 1], [1.5, 2.5], [4, 4.5]];
const patrolC = [[-6.5, 4.5], [-1, 4], [-3, -3.5]];
const patrolD = [[0, -4], [6, -3], [-6, -4.5]];
const patrolE = [[5, -3], [1, -1], [6, 4]];
const patrolG = [[-3, -1], [2, 1], [-2, 4]];
const archer = (route) => ({ archer: true, route }); // keeps its distance and shoots slow arrows
const goldChest = { x: 7.2, z: -5.6, rot: -20, gold: true };

// Every level ends with the boss. Level 1 is gentle (no ambush, no archers).
export const LEVELS = [
  { id: 'l1', tiers: [1], rooms: [
    R(cellar, { skeletons: [], search: [['barrel_large', 5.4, -1.0, 10, 1.0],
      ['box_large', -3.8, 1.2, 25, 1.0], ['barrel_small_stack', 7.4, 2.4, -15, 1.0]] }),
    R(storage, { skeletons: [patrolD], chest: { x: 7.4, z: 0.5, rot: -90 },
      search: [['barrel_large', -6.0, 2.6, 0, 1.0], ['box_large', 2.8, 4.2, 15, 1.0],
        ['barrel_small_stack', 6.2, -2.4, 30, 1.0]] }),
    R(chasm),
    R(runes),
    R(arena, { boss: 'golem' }),
  ] },
  { id: 'l2', tiers: [1, 2], rooms: [
    R(hall, { type: 'ambush', skeletons: [patrolD, patrolG] }),
    R(chasm),
    R(cellar, { skeletons: [patrolA, archer([[7, -4], [7, 3]])], chest: { x: 7.6, z: -1, rot: -90 } }),
    R(runes),
    R(vault, { type: 'vault', book: [2.4, -4.9], coins: [[-5, 2], [-2.5, -1.5], [0, 2.5], [2.5, -1.5], [5, 3], [0, -4]], chest: goldChest }),
    R(arena, { boss: 'necro' }),
  ] },
  { id: 'l3', tiers: [2, 3], rooms: [
    R(runes),
    R(hall, { skeletons: [patrolD, patrolG, archer(patrolC)], chest: { x: -7.6, z: 2.2, rot: 90 } }),
    R(chasm),
    R(storage, { type: 'ambush', skeletons: [patrolD, patrolG, patrolC, archer([[7, 4.5], [7, -3]])] }),
    R(arena, { boss: 'mage' }),
  ] },
];
