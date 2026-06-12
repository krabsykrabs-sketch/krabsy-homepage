// Item + dish data tables. The model column is the single source of truth
// for what each item looks like — swapping art = editing this table.
//
// Chop chains: chopTo may point at another choppable (two-stage chopping:
// raw → half → done). `interim` marks the halfway stage for hints.
// `compose` items are built from several models in stations.buildItemMesh.
// `steamy` items emit steam wisps for a while after cooking/baking.
export const ITEMS = {
  // --- level 1: salad ---
  lettuce:         { model: 'food_ingredient_lettuce',         emoji: '🥬', chopTo: 'lettuce_half', chopTime: 1.8 },
  lettuce_half:    { model: 'food_ingredient_lettuce_chopped', emoji: '🥬', chopTo: 'lettuce_chopped', chopTime: 1.8, interim: true },
  lettuce_chopped: { model: 'food_ingredient_lettuce_slice',   emoji: '🥬', plateable: true },
  tomato:          { model: 'food_ingredient_tomato',          emoji: '🍅', chopTo: 'tomato_slices' },
  tomato_slices:   { model: 'food_ingredient_tomato_slices',   emoji: '🍅', plateable: true },

  // --- level 2: burgers ---
  bun:             { model: 'food_ingredient_bun',             emoji: '🍞', plateable: true },
  patty_raw:       { model: 'food_ingredient_burger_uncooked', emoji: '🥩', cookTo: 'patty_cooked', cookTime: 10.5 },
  patty_cooked:    { model: 'food_ingredient_burger_cooked',   emoji: '🍖', plateable: true, burnTo: 'patty_burnt', burnTime: 12, steamy: true },
  patty_burnt:     { model: 'food_ingredient_burger_trash',    emoji: '💀', trashOnly: true },
  cheese:          { model: 'food_ingredient_cheese',          emoji: '🧀', chopTo: 'cheese_half', chopTime: 1.8 },
  cheese_half:     { model: 'food_ingredient_cheese_chopped',  emoji: '🧀', chopTo: 'cheese_chopped', chopTime: 1.8, interim: true },
  cheese_chopped:  { model: 'food_ingredient_cheese_grated',   emoji: '🧀', plateable: true },

  // --- level 3: pizza ---
  dough:           { model: 'food_ingredient_dough',           emoji: '🟤', chopTo: 'dough_base', chopVerb: 'Roll' },
  dough_base:      { model: 'food_ingredient_dough_base',      emoji: '⚪', accepts: { ketchup: 'dough_sauced' } },
  ketchup:         { model: 'ketchup',                         emoji: '🥫', scale: 1.45, reusable: true },
  dough_sauced:    { compose: 'sauced',                        emoji: '🔴',
                     accepts: { cheese_chopped: 'pizza_raw_cheese', pepperoni_chopped: 'pizza_raw_pepperoni', mushroom_chopped: 'pizza_raw_mushroom' } },
  pepperoni:       { model: 'food_ingredient_pepperoni',         emoji: '🍖', chopTo: 'pepperoni_chopped' },
  pepperoni_chopped:{ model: 'food_ingredient_pepperoni_chopped',emoji: '🍖' },
  mushroom:        { model: 'food_ingredient_mushroom',          emoji: '🍄', chopTo: 'mushroom_chopped' },
  mushroom_chopped:{ model: 'food_ingredient_mushroom_chopped',  emoji: '🍄' },
  pizza_raw_cheese:    { compose: 'rawpizza', topping: 'cheese',    emoji: '🧀', bakeTo: 'pizza_cheese', bakeTime: 13.5 },
  pizza_raw_pepperoni: { compose: 'rawpizza', topping: 'pepperoni', emoji: '🍖', bakeTo: 'pizza_pepperoni', bakeTime: 13.5 },
  pizza_raw_mushroom:  { compose: 'rawpizza', topping: 'mushroom',  emoji: '🍄', bakeTo: 'pizza_mushroom', bakeTime: 13.5 },
  pizza_cheese:    { model: 'food_pizza_cheese_plated',    emoji: '🍕', plateable: true, burnTo: 'pizza_burnt', burnTime: 8, steamy: true },
  pizza_pepperoni: { model: 'food_pizza_pepperoni_plated', emoji: '🍕', plateable: true, burnTo: 'pizza_burnt', burnTime: 8, steamy: true },
  pizza_mushroom:  { model: 'food_pizza_mushroom_plated',  emoji: '🍕', plateable: true, burnTo: 'pizza_burnt', burnTime: 8, steamy: true },
  pizza_burnt:     { model: 'food_pizza_cheese_plated',    emoji: '💀', tint: '#2a2118', trashOnly: true },
};

// Scatter models used to dress a raw pizza per topping.
export const PIZZA_TOPPING_MODELS = {
  cheese: 'food_ingredient_cheese_grated',
  pepperoni: 'food_ingredient_pepperoni_slices',
  mushroom: 'food_ingredient_mushroom_pieces',
};

// Burger stack: which model represents each ingredient inside the stack,
// bottom-to-top serving order. (bun renders as bun_bottom + bun_top.)
export const BURGER_LAYER_ORDER = ['patty_cooked', 'cheese_chopped', 'lettuce_chopped', 'tomato_slices'];
export const BURGER_LAYER_MODELS = {
  patty_cooked: 'food_ingredient_burger_cooked',
  cheese_chopped: 'food_ingredient_cheese_grated',
  lettuce_chopped: 'food_ingredient_lettuce_slice',
  tomato_slices: 'food_ingredient_tomato_slices',
};

// Dishes: parts must exactly match a plate's contents (order-free).
export const DISHES = {
  salad:           { name: 'Salad',        emoji: '🥗', parts: ['lettuce_chopped', 'tomato_slices'], coins: 20, model: null },
  burger:          { name: 'Burger',       emoji: '🍔', parts: ['bun', 'patty_cooked', 'lettuce_chopped'], coins: 30, model: null },
  cheeseburger:    { name: 'Cheeseburger', emoji: '🧀🍔', parts: ['bun', 'patty_cooked', 'cheese_chopped'], coins: 30, model: null },
  bigburger:       { name: 'Big Burger',   emoji: '🍔⭐', parts: ['bun', 'patty_cooked', 'lettuce_chopped', 'cheese_chopped'], coins: 40, model: null },
  pizza_cheese:    { name: 'Cheese Pizza',    emoji: '🍕', parts: ['pizza_cheese'],    coins: 40, model: 'food_pizza_cheese_plated' },
  pizza_pepperoni: { name: 'Pepperoni Pizza', emoji: '🍕', parts: ['pizza_pepperoni'], coins: 40, model: 'food_pizza_pepperoni_plated' },
  pizza_mushroom:  { name: 'Mushroom Pizza',  emoji: '🍕', parts: ['pizza_mushroom'],  coins: 40, model: 'food_pizza_mushroom_plated' },
};

export function isBurgerDish(dishId) {
  return dishId === 'burger' || dishId === 'cheeseburger' || dishId === 'bigburger';
}

/** Exact-set dish match for a plate's contents. Returns dish id or null. */
export function matchDish(contents) {
  const sorted = contents.slice().sort().join(',');
  for (const [id, d] of Object.entries(DISHES)) {
    if (d.parts.slice().sort().join(',') === sorted) return id;
  }
  return null;
}

/**
 * Free-build rule: any plateable ingredient may go on a plate (build the
 * burger YOU want), except exact duplicates (can never match a dish —
 * pure frustration) and silly towers (cap 5).
 */
export function canPlate(contents, extra) {
  return !contents.includes(extra) && contents.length < 5;
}

/** Counter-top combine (pizza assembly): base item + held item → result id or null. */
export function combine(baseId, heldId) {
  const def = ITEMS[baseId];
  return (def && def.accepts && def.accepts[heldId]) || null;
}

// Every restaurant model the game ever instantiates (preload manifest).
export function itemModelNames() {
  const names = new Set();
  for (const def of Object.values(ITEMS)) if (def.model) names.add(def.model);
  for (const d of Object.values(DISHES)) if (d.model) names.add(d.model);
  for (const m of Object.values(PIZZA_TOPPING_MODELS)) names.add(m);
  for (const m of Object.values(BURGER_LAYER_MODELS)) names.add(m);
  ['food_ingredient_bun_top', 'food_ingredient_bun_bottom', 'food_ingredient_dough_base',
   'plate', 'plate_dirty'].forEach((m) => names.add(m));
  return [...names];
}
