// Level definitions. Map legend (1 char = 1 tile = 2 world units):
//   .  floor          C  counter            b  cutting board
//   s  stove          o  oven (pizza oven)  k  sink
//   r  plate rack     t  trash              H  serving hatch (2 wide)
//   1-9 ingredient crates (per-level `crates` mapping)
//   P  chef spawn (floor)
export const LEVELS = [
  {
    id: 'garden',
    name: 'Garden Bistro',
    emoji: '🥗',
    style: 'A',
    boardTool: 'knife',
    map: [
      'CCHHCCrkC',
      'C.......C',
      '1...P...C',
      '2.......C',
      'C.......C',
      'CCbCCbCCC',
    ],
    crates: { 1: 'lettuce', 2: 'tomato' },
    dishes: [{ dish: 'salad', w: 1 }],
    spawnEvery: [16, 22],
    patience: 112,
    roundTime: 180,
    plates: 4,
    stars: [60, 140, 220],
  },
  {
    id: 'burger',
    name: 'Burger Bar',
    emoji: '🍔',
    style: 'A',
    boardTool: 'knife',
    map: [
      'CCCHHCCkrC',
      '1........s',
      '2.CCC.CC.s',
      '3...P....C',
      '4.CC.CCC.C',
      'C........C',
      'CCbCCbCCtC',
    ],
    crates: { 1: 'bun', 2: 'patty_raw', 3: 'lettuce', 4: 'cheese' },
    dishes: [{ dish: 'burger', w: 3 }, { dish: 'cheeseburger', w: 2 }, { dish: 'bigburger', w: 1 }],
    spawnEvery: [19, 26],
    patience: 128,
    roundTime: 180,
    plates: 4,
    stars: [90, 190, 300],
  },
  {
    id: 'pizzeria',
    name: 'Pizzeria',
    emoji: '🍕',
    style: 'B',
    boardTool: 'rollingpin',
    map: [
      'CCHHCooCrC',
      '1........C',
      '2.CCC.CC.b',
      '3...P....b',
      '4.CC.CCC.C',
      '5........C',
      'CCtCCkCCCC',
    ],
    crates: { 1: 'dough', 2: 'sauce', 3: 'cheese', 4: 'pepperoni', 5: 'mushroom' },
    dishes: [{ dish: 'pizza_cheese', w: 3 }, { dish: 'pizza_pepperoni', w: 2 }, { dish: 'pizza_mushroom', w: 2 }],
    spawnEvery: [24, 32],
    patience: 150,
    roundTime: 180,
    plates: 4,
    stars: [100, 200, 320],
  },
];

export const TEASER = { id: 'sundae', name: 'Sundae Sunday', emoji: '🍨', soon: true };

export function pickDish(level, rnd) {
  const total = level.dishes.reduce((s, d) => s + d.w, 0);
  let roll = rnd() * total;
  for (const d of level.dishes) { roll -= d.w; if (roll <= 0) return d.dish; }
  return level.dishes[0].dish;
}

// Static decor models every level needs preloaded, keyed by visual style.
export function levelModelNames(level) {
  const sB = level.style === 'B' ? '_styleB' : '';
  return [
    'floor_kitchen' + sB,
    'wall', 'wall_half', 'wall_orderwindow', 'wall_window_open',
    'wall_window_closed_curtains_red', 'wall_window_closed_curtains_green',
    'wall_tiles_A', 'wall_tiles_B', 'wall_decorated', 'wall_decorated_styleB',
    'kitchencounter_straight_A' + sB, 'kitchencounter_straight_B' + sB,
    'kitchencounter_straight_decorated' + sB,
    'kitchencounter_sink' + sB,
    'cuttingboard', 'knife', 'rollingpin',
    'stove_single_countertop', 'oven', 'pizza_oven', 'pan_A',
    'extractorhood', 'fridge_A', 'shelf_papertowel', 'towelrail',
    'dishrack', 'plate', 'plate_dirty',
    'crate', 'crate_lid',
    'crate_lettuce', 'crate_tomatoes', 'crate_buns', 'crate_steak',
    'crate_cheese', 'crate_dough', 'crate_mushrooms', 'crate_pepperoni',
  ];
}

// crate item id → crate model
export const CRATE_MODELS = {
  lettuce: 'crate_lettuce',
  tomato: 'crate_tomatoes',
  bun: 'crate_buns',
  patty_raw: 'crate_steak',
  cheese: 'crate_cheese',
  dough: 'crate_dough',
  sauce: 'crate_tomatoes',
  pepperoni: 'crate_pepperoni',
  mushroom: 'crate_mushrooms',
};
