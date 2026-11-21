// Level data. A level is a chain of rooms; you leave each room through the verb
// door in the back wall. Room format: see buildRoom() in room.js.
// Prop entry: [model, x, z, rotDeg, blockRadius, y]. Skeleton entry: a patrol route.

const cellar = { // barrels and a table, the look-test room
  shelves: true, banners: 'red',
  props: [
    ['barrel_large', -8.4, -6.4, 17, 1.1], ['barrel_small_stack', -6.4, -6.7, 6, 1.0],
    ['keg_decorated', -8.3, -3.4, 90, 1.5], ['table_medium_decorated_A', -6.2, 3.2, 11, 1.4],
    ['chair', -4.6, 3.4, -100, 0.5], ['stool', -6.4, 5.0, 23, 0.5],
    ['column', -2.6, -5.6, 0, 0.6], ['candle_triple', -2.6, -5.6, 30, 0, 1.4],
    ['column', 2.6, -5.6, 0, 0.6], ['candle_triple', 2.6, -5.6, 126, 0, 1.4],
    ['crates_stacked', 8.1, 5.6, 11, 1.5], ['box_large', 6.1, 6.6, 29, 1.0],
  ],
};
const storage = { // crates along the walls, open middle
  banners: 'blue',
  props: [
    ['crates_stacked', -8.2, -6.2, -8, 1.5], ['box_large', -8.3, -3.6, 14, 1.0],
    ['box_small_decorated', -6.4, -6.6, 40, 0.9], ['barrel_large', 8.3, -6.3, 0, 1.1],
    ['barrel_large', 8.4, -4.2, 50, 1.1], ['barrel_small_stack', 6.3, -6.7, -6, 1.0],
    ['trunk_large_A', -8.4, 5.6, 80, 1.0], ['box_large', 8.2, 6.4, -20, 1.0],
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
    ['column', -2.6, -5.6, 0, 0.6], ['candle_triple', -2.6, -5.6, 30, 0, 1.4],
    ['column', 2.6, -5.6, 0, 0.6], ['candle_triple', 2.6, -5.6, 126, 0, 1.4],
    ['trunk_large_A', -8.3, 6.2, 75, 1.0], ['box_small_decorated', 8.4, 6.2, -17, 0.9],
  ],
};
const vault = { // treasure room: the level's last room
  banners: 'blue', trophy: true,
  props: [
    ['coin_stack_large', 8.6, -6.6, 23, 0.8], ['coin_stack_small', 5.9, -4.9, 57],
    ['coin_stack_small', 8.5, -4.6, 115], ['coin_stack_large', -8.5, -6.5, 80, 0.8],
    ['coin_stack_small', -6.6, -6.4, 10], ['trunk_large_A', 4.4, -6.6, 3, 1.0],
    ['trunk_large_A', -4.4, -6.6, -4, 1.0], ['pillar_decorated', -6, 1, 0, 1.1],
    ['pillar_decorated', 6, 1, 0, 1.1], ['crates_stacked', -8.1, 5.8, -12, 1.5],
  ],
};

const R = (base, extra) => ({ ...base, ...extra });
const patrolA = [[-6, -2], [5, -2.5], [4, 2], [-3, 0.5]];
const patrolB = [[6.5, 1], [1.5, 2.5], [4, 4.5]];
const patrolC = [[-6.5, 4.5], [-1, 4], [-3, -3.5]];
const patrolD = [[0, -4], [6, -3], [-6, -4.5]];

export const LEVELS = [
  { id: 'l1', tiers: [1], rooms: [
    R(cellar, { skeletons: [] }),
    R(storage, { skeletons: [patrolA], chest: { x: 7.4, z: 0.5, rot: -90 } }),
    R(hall, { skeletons: [patrolD, patrolB] }),
    R(vault, { skeletons: [patrolA, patrolC], chest: { x: 7.2, z: -5.6, rot: -20, gold: true } }),
  ] },
  { id: 'l2', tiers: [1, 2], rooms: [
    R(storage, { skeletons: [patrolD] }),
    R(hall, { skeletons: [patrolD, patrolB], chest: { x: -7.6, z: 2.2, rot: 90 } }),
    R(cellar, { skeletons: [patrolA, patrolB] }),
    R(storage, { skeletons: [patrolA, patrolB, patrolC] }),
    R(vault, { skeletons: [patrolA, patrolC, patrolD], chest: { x: 7.2, z: -5.6, rot: -20, gold: true } }),
  ] },
  { id: 'l3', tiers: [2, 3], rooms: [
    R(hall, { skeletons: [patrolD, patrolB] }),
    R(cellar, { skeletons: [patrolA, patrolB], chest: { x: 7.6, z: -1, rot: -90 } }),
    R(storage, { skeletons: [patrolA, patrolB, patrolC] }),
    R(hall, { skeletons: [patrolD, patrolB, patrolC], chest: { x: -7.6, z: 2.2, rot: 90 } }),
    R(vault, { skeletons: [patrolA, patrolB, patrolC, patrolD], chest: { x: 7.2, z: -5.6, rot: -20, gold: true } }),
  ] },
];
