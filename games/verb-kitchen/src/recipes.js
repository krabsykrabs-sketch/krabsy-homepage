// Item + dish data tables. The model column is the single source of truth
// for what each item looks like — swapping art = editing this table.
export const ITEMS = {
  // --- level 1: salad ---
  lettuce:         { model: 'food_ingredient_lettuce',         emoji: '🥬', chopTo: 'lettuce_chopped' },
  lettuce_chopped: { model: 'food_ingredient_lettuce_chopped', emoji: '🥬', plateable: true },
  tomato:          { model: 'food_ingredient_tomato',          emoji: '🍅', chopTo: 'tomato_slices' },
  tomato_slices:   { model: 'food_ingredient_tomato_slices',   emoji: '🍅', plateable: true },

  // --- level 2: burgers ---
  bun:             { model: 'food_ingredient_bun',             emoji: '🍞', plateable: true },
  patty_raw:       { model: 'food_ingredient_burger_uncooked', emoji: '🥩', cookTo: 'patty_cooked', cookTime: 10.5 },
  patty_cooked:    { model: 'food_ingredient_burger_cooked',   emoji: '🍖', plateable: true, burnTo: 'patty_burnt', burnTime: 12 },
  patty_burnt:     { model: 'food_ingredient_burger_trash',    emoji: '💀', trashOnly: true },
  cheese:          { model: 'food_ingredient_cheese',          emoji: '🧀', chopTo: 'cheese_chopped' },
  cheese_chopped:  { model: 'food_ingredient_cheese_chopped',  emoji: '🧀', plateable: true },

  // --- level 3: pizza ---
  dough:           { model: 'food_ingredient_dough',           emoji: '🟤', chopTo: 'dough_base', chopVerb: 'Roll' },
  dough_base:      { model: 'food_ingredient_dough_base',      emoji: '⚪', accepts: { sauce: 'dough_sauced' } },
  sauce:           { model: 'food_ingredient_tomato_sauce',    emoji: '🥫' },
  dough_sauced:    { model: 'food_ingredient_dough_base',      emoji: '🔴', tint: '#e2543a',
                     accepts: { cheese_chopped: 'pizza_raw_cheese', pepperoni_chopped: 'pizza_raw_pepperoni', mushroom_chopped: 'pizza_raw_mushroom' } },
  pepperoni:       { model: 'food_ingredient_pepperoni',         emoji: '🍖', chopTo: 'pepperoni_chopped' },
  pepperoni_chopped:{ model: 'food_ingredient_pepperoni_chopped',emoji: '🍖' },
  mushroom:        { model: 'food_ingredient_mushroom',          emoji: '🍄', chopTo: 'mushroom_chopped' },
  mushroom_chopped:{ model: 'food_ingredient_mushroom_chopped',  emoji: '🍄' },
  pizza_raw_cheese:    { model: 'food_pizza_cheese_plated',    emoji: '🧀', tint: '#d8c49a', bakeTo: 'pizza_cheese', bakeTime: 13.5 },
  pizza_raw_pepperoni: { model: 'food_pizza_pepperoni_plated', emoji: '🍖', tint: '#d8c49a', bakeTo: 'pizza_pepperoni', bakeTime: 13.5 },
  pizza_raw_mushroom:  { model: 'food_pizza_mushroom_plated',  emoji: '🍄', tint: '#d8c49a', bakeTo: 'pizza_mushroom', bakeTime: 13.5 },
  pizza_cheese:    { model: 'food_pizza_cheese_plated',    emoji: '🍕', plateable: true, burnTo: 'pizza_burnt', burnTime: 8 },
  pizza_pepperoni: { model: 'food_pizza_pepperoni_plated', emoji: '🍕', plateable: true, burnTo: 'pizza_burnt', burnTime: 8 },
  pizza_mushroom:  { model: 'food_pizza_mushroom_plated',  emoji: '🍕', plateable: true, burnTo: 'pizza_burnt', burnTime: 8 },
  pizza_burnt:     { model: 'food_pizza_cheese_plated',    emoji: '💀', tint: '#2a2118', trashOnly: true },
};

// Dishes: parts must exactly match a plate's contents (order-free).
export const DISHES = {
  salad:           { name: 'Salad',        emoji: '🥗', parts: ['lettuce_chopped', 'tomato_slices'], coins: 20, model: null },
  burger:          { name: 'Burger',       emoji: '🍔', parts: ['bun', 'patty_cooked', 'lettuce_chopped'], coins: 30, model: 'food_burger' },
  cheeseburger:    { name: 'Cheeseburger', emoji: '🧀🍔', parts: ['bun', 'patty_cooked', 'cheese_chopped'], coins: 30, model: 'food_burger' },
  bigburger:       { name: 'Big Burger',   emoji: '🍔⭐', parts: ['bun', 'patty_cooked', 'lettuce_chopped', 'cheese_chopped'], coins: 40, model: 'food_burger' },
  pizza_cheese:    { name: 'Cheese Pizza',    emoji: '🍕', parts: ['pizza_cheese'],    coins: 40, model: 'food_pizza_cheese_plated' },
  pizza_pepperoni: { name: 'Pepperoni Pizza', emoji: '🍕', parts: ['pizza_pepperoni'], coins: 40, model: 'food_pizza_pepperoni_plated' },
  pizza_mushroom:  { name: 'Mushroom Pizza',  emoji: '🍕', parts: ['pizza_mushroom'],  coins: 40, model: 'food_pizza_mushroom_plated' },
};

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
  for (const def of Object.values(ITEMS)) names.add(def.model);
  for (const d of Object.values(DISHES)) if (d.model) names.add(d.model);
  names.add('plate'); names.add('plate_dirty');
  return [...names];
}
