// Level definitions. Map legend (1 char = 1 tile = 2 world units):
//   .  floor          C  counter            b  cutting board (knife)
//   d  dough-rolling station (rolling pin; dough only)
//   s  stove          o  oven (pizza oven)  k  sink
//   r  plate rack     t  trash              H  serving hatch (2 wide)
//   T  toaster (a cook station like the stove, but only for bread slices)
//   1-9 ingredient crates (per-level `crates` mapping)
//   P  chef spawn (floor)
// High-score (race-the-clock) mode: each level is a FIXED list of orders,
// identical every play so completion TIMES are comparable. Deliver them all;
// the timer counts UP. Stars: `starTimes` = [1★, 2★, 3★(gold), author] in
// DESCENDING seconds (Trackmania-style; the author time stays hidden in the
// menu until the gold star is earned, and the 4th author star only shows once
// earned). Times calibrated 2026-11-23 from a headless expert bot (E): author
// ≈ E, gold ≈ E×1.3, 2★ ≈ E×1.75, 1★ ≈ E×2.6, rounded to 5 s. Starting
// `plates` is below the order count so the player MUST wash (and study).
// Decor (`props`) — see the Sandwich Bar for the field docs. Tile coords are the
// level's LOCAL grid (ASCII map coords; for editor-JSON levels the grid the
// stations use, col 0 / row 0 = the back-left counter). Props only ever stand
// on the dead corner counters the chef can't reach, or hang on the back wall.
// `wall: 'right'` hangs a prop on the right side wall (see `sideWall`).
// Burger Bar's decor (the co-op level has its own kitchen and its own props).
const BURGER_PROPS = [
  { model: 'tt_wall_knife_rack', col: 0, wall: true, y: 2.8 },
  { model: 'tt_wall_shelf_kitchen_hooks_decorated', col: 3.5, wall: true, y: 3.3 },
  { model: 'wall_tiles_A', col: 5, row: 0 },            // tiled splash behind sink + rack
  { model: 'wall_tiles_B', col: 6, row: 0 },
  { model: 'tt_wall_papertowel_holder', col: 5, wall: true, y: 2.85 },
  { model: 'tt_wall_cabinet_straight', col: 6.5, wall: true, y: 2.9, scale: [1.5, 1, 0.6] },
  { model: 'tt_sansevieria_plant_small_potted', col: 0, row: 0, y: 1.02 },
  // the cook's corner next to the stoves
  { model: 'tt_utensils_cup', col: 6.85, row: -0.15, y: 1.02, rot: -0.4, scale: 1.1 },
  { model: 'tt_container_kitchen_A_red', col: 7.2, row: 0.1, y: 1.02, scale: 1.3 },
  { model: 'tt_monstera_plant_small_potted', col: 0, row: 5, y: 1.02, rot: 0.6 },
  { model: 'tt_pothos_plant_small_potted', col: 7, row: 5, y: 1.3, rot: 2.4 },
  // hood over the two side stoves, on the right side wall; shallow and high so
  // it never hides the pans from the camera
  { model: 'tt_extractor_hood', wall: 'right', row: 1.5, y: 2.95, scale: [1.7, 1, 0.6] },
];

export const LEVELS = [
  {
    id: 'garden',
    num: 1,
    name: 'Garden Bistro',
    emoji: '🥗',
    // GUIDED tutorial level (see tutorial.js) — now an editor JSON layout
    // (levels/salad1.json). Step-by-step walkthrough of the first salad — grab →
    // chop → plate → repeat → serve → wash — then free play for the other 2.
    // Starts with one clean plate on a counter, an empty rack, and one dirty
    // plate at the sink (1 clean + 1 dirty), so washing is load-bearing.
    jsonUrl: 'levels/salad1.json',
    trimFloor: true,             // no bare floor strip behind the back wall
    // a garden bistro: plants on the four dead corners, mugs + towels on the wall
    props: [
      { model: 'tt_wall_shelf_kitchen_hooks_decorated', col: 3, wall: true, y: 3.3 },
      { model: 'tt_wall_papertowel_holder', col: 4.15, wall: true, y: 2.85 },
      { model: 'tt_monstera_plant_small_potted', col: -0.1, row: -0.15, y: 1.02, rot: 0.4 },
      { model: 'tt_sansevieria_plant_small_potted', col: 5, row: 0, y: 1.02 },
      { model: 'tt_zzplant_plant_small_potted', col: 0, row: 4, y: 1.02 },
      { model: 'tt_pothos_plant_small_potted', col: 5, row: 4, y: 1.3, rot: 2.4 },
    ],
    rotate: 2,                   // 180° — serving hatch at the back (camera convention)
    spawn: { col: 6, row: 4 },   // chef start in JSON cell coords
    guided: true,
    orders: ['salad', 'salad', 'salad'],
    spawnEvery: [4, 7],
    plates: 0,
    startItems: [{ c: 7, r: 4, item: 'plate' }],   // clean plate pre-placed on a counter (JSON cell coords)
    startDirty: 1,   // one dirty plate already at the sink (1 clean + 1 dirty to start)
    starTimes: [125, 85, 65, 50],   // 1★ / 2★ / 3★(gold) / author — calibrated 2026-11-23 evening (bot E=48.2s, 2-answer washing)
    tutorial: {
      image: 'assets/ChatGPT/Salad.webp',
      title: 'Salad',
      text: 'Chop the lettuce and the tomato, pop them on a plate, and serve it up!',
    },
  },
  {
    id: 'burger',
    num: 2,
    name: 'Burger Bar',
    emoji: '🍔',
    style: 'A',
    map: [
      'CHHCCkrC',
      '1......s',
      '2.CCC..s',
      '3..P...C',
      '4......C',
      'CCbCbCtC',
    ],
    crates: { 1: 'bun', 2: 'patty_raw', 3: 'lettuce', 4: 'cheese' },
    sideWall: { right: 3 },      // a wall behind the side stoves (carries the hood)
    props: BURGER_PROPS,
    // big burger appears exactly once, in slot 4 (or 5); the rest are
    // hamburgers / cheeseburgers in any order. 5 · 2 plates → 3 washes.
    orders: ['hamburger', 'cheeseburger', 'hamburger', 'bigburger', 'cheeseburger'],
    spawnEvery: [5, 8],
    plates: 2,
    starTimes: [235, 160, 120, 95],   // 1★ / 2★ / 3★(gold) / author — calibrated 2026-11-23 evening (bot E=91.2s, 2-answer washing)
    tutorial: {
      image: 'assets/ChatGPT/Burger.webp',
      title: 'Burger',
      text: 'Cook a patty on a bun for a hamburger — add cheese for a cheeseburger, plus lettuce for a Big Burger!',
    },
  },
  {
    // Level 3 — the pizza level, made in the Krabsy Level Editor
    // (levels/pizza3.json). The layout/visuals come from the JSON; the gameplay
    // below is added here, and stations are inferred from the placed models
    // (see world.buildFromJSON). Replaced the old ASCII Pizzeria.
    id: 'pizzapalace',
    num: 3,
    name: 'Pizza Palace',
    emoji: '🍕',
    style: 'A',
    jsonUrl: 'levels/pizza3.json',
    // a bakery corner: flour, scale and mixing bowl on the dead corners
    props: [
      { model: 'tt_utensils_cup', col: 5.05, row: 0.3, y: 1.02, rot: 0.3, scale: 1.1 },
      { model: 'tt_scale', col: -0.05, row: 5, y: 1.02, rot: 0.5, scale: 1.2 },
      { model: 'tt_monstera_plant_small_potted', col: 5.1, row: 4.85, y: 1.02, rot: 2.2 },
      { model: 'tt_flour_sack_closed', col: 4.72, row: 5.15, y: 1.02, rot: 0.4, scale: 1.4 },
    ],
    rotate: 2,                   // 180° — put the serving hatch at the back (camera convention)
    spawn: { col: 6, row: 4 },   // chef start in JSON cell coords (editor stores none)
    // pizza3.json no longer includes the ketchup/sauce bottle (pizza4 had one at
    // 9,5) — without a sauce source no pizza can bake, so re-add it as a start
    // item on that counter. Remove if the editor exports it again.
    // The sauce counter and the dough crate swapped places (JSON rows 5 ↔ 6): the
    // low crate used to sit BEHIND the taller counter and under the wall
    // cabinets, half hidden from the camera. Now no counter stands in front of
    // a crate on the left side: sauce (back), dough, mushrooms, cheese. The second
    // wall cabinet (over the sauce counter) is gone: it shaded the bottle.
    startItems: [{ c: 9, r: 6, item: 'ketchup' }],
    orders: ['pizza_cheese', 'pizza_mushroom', 'pizza_cheese', 'pizza_cheese', 'pizza_mushroom'],
    spawnEvery: [6, 9],
    plates: 2,
    starTimes: [310, 210, 155, 120],   // 1★ / 2★ / 3★(gold) / author — calibrated 2026-11-23 evening (bot E=118.6s, 2-answer washing)
    tutorial: {
      image: 'assets/ChatGPT/Pizza.webp',
      title: 'Pizza',
      text: 'Roll the dough, add sauce and cheese (and mushroom if you like), bake it, then serve!',
    },
  },
  {
    // Level 4 "Burger Bar Co-op" — ONE open room shared with a bot helper, split
    // into two lanes by a prep island (row 3) instead of a wall:
    //   • back lane (rows 1–2) = the player's cook line: buns + patties on the
    //     left, two stoves at the back wall (hood), hatch, sink, rack, trash;
    //   • front lane (rows 4–5) = the helper's: lettuce + cheese crates
    //     bottom-left, its two boards on the island, facing the front. The lane
    //     is two tiles deep on purpose: in a one-tile lane the walking helper
    //     bulldozed a waiting player onto the only tile in front of its crates
    //     and then stood there blocked.
    // The helper chops on a board and parks the slice on the island tile to the
    // RIGHT of that board (col+1); the player takes it from the back side. So
    // the island is the hand-over point and the two chefs never have to cross.
    // The helper keeps one slice per board in stock (par = 1, no demand gate),
    // and never cooks, plates, serves or washes — see helper.js.
    // (Until 2026-11-23 this level was an exact copy of Burger Bar plus the bot.
    // Level 5 stays distinct: there a counter wall divides the room, the bot
    // also cuts tomato for salads and drops onto a shared pass pool.)
    // The `coop` block lives entirely in code (not the editor JSON schema).
    id: 'burger_coop',
    num: 4,
    open: true,                  // co-op test level — always selectable
    name: 'Burger Bar Co-op',
    emoji: '🤝',
    style: 'A',
    map: [
      'CssCHHCkC',
      '1.......r',
      '2...P...t',
      'C.CbCbC.C',
      'C.......C',
      '3.......C',
      'C4CCCCCCC',
    ],
    crates: { 1: 'bun', 2: 'patty_raw', 3: 'lettuce', 4: 'cheese' },
    props: [
      // shallow and high, so the hood never hides the pans from the camera
      { model: 'tt_extractor_hood', col: 1.5, wall: true, y: 2.95, scale: [1.5, 1, 0.7] },
      { model: 'tt_wall_knife_rack', col: 3, wall: true, y: 2.8 },
      { model: 'tt_wall_shelf_kitchen_hooks_decorated', col: 6.1, wall: true, y: 3.3 },
      { model: 'wall_tiles_A', col: 7, row: 0 },            // tiled splash behind the sink
      { model: 'tt_wall_papertowel_holder', col: 7.2, wall: true, y: 2.85 },
      // the four dead corners
      { model: 'tt_utensils_cup', col: -0.15, row: -0.15, y: 1.02, rot: 0.4, scale: 1.1 },
      { model: 'tt_container_kitchen_A_red', col: 0.2, row: 0.1, y: 1.02, scale: 1.3 },
      { model: 'tt_sansevieria_plant_small_potted', col: 8, row: 0, y: 1.02 },
      { model: 'tt_monstera_plant_small_potted', col: 0, row: 6, y: 1.02, rot: 0.6 },
      { model: 'tt_pothos_plant_small_potted', col: 8, row: 6, y: 1.3, rot: 2.4 },
    ],
    // An order mix for two: six of the seven burgers need a topping from the
    // helper (6 cheese, 3 lettuce), only one is plain. 7 · 3 plates → 4 washes.
    orders: ['cheeseburger', 'hamburger', 'bigburger', 'cheeseburger', 'bigburger', 'cheeseburger', 'bigburger'],
    spawnEvery: [4, 7],
    plates: 3,
    starTimes: [325, 220, 165, 130],   // 1★ / 2★ / 3★(gold) / author — calibrated 2026-11-23 evening (bot E=125.6s, 2-answer washing)
    tutorial: {
      image: 'assets/ChatGPT/Burger.webp',
      title: 'Burger Bar — with a helper!',
      text: 'A kitchen helper chops cheese and lettuce for you and puts them on the middle counter — you cook the patties, build the burgers, serve and wash up!',
    },
    coop: {
      char: 'knight',                  // helper character (player defaults to rogue)
      intro: 'helperIntroCoop',        // i18n key: the helper's first line (who does what)
      spawn: { col: 2, row: 5 },       // helper starts in its lane, near its crates
      idle: { col: 2, row: 5 },        // parks here (bottom-left) when both boards are stocked
      moveSpeed: 0.5,                  // walks at 50% of the player's speed (unhurried)
      workSpeed: 0.55,                 // chops slower than the player too
      reaction: 0.7,                   // pauses ~0.7s to "think" before each action
      // left board (col 3) = cheese (needed most, nearest its crates), right
      // board (col 5) = lettuce; each stages onto the island tile to its right.
      stations: [
        { ingredient: 'cheese',  board: { col: 3, row: 3 }, staging: { col: 4, row: 3 } },
        { ingredient: 'lettuce', board: { col: 5, row: 3 }, staging: { col: 6, row: 3 } },
      ],
    },
  },
  {
    // Level 5 "Split Kitchen" — the FLAGSHIP co-op level. A solid counter wall
    // (col 4) splits the kitchen into a PREP wing (the bot's room: cheese /
    // lettuce / tomato crates + ONE board, cols 0–3) and a SERVICE wing (yours:
    // buns, patties, two stoves, rack, sink, hatch, trash, cols 5–8). The two
    // are joined ONLY by the central pass counter (col 4), where the bot drops
    // prepped toppings and you grab them from the service side. Neither can
    // cross — co-op is structural (the prep wing is unreachable solo). Each chef
    // owns its room, so the kitchen is compact (9×7). You cook, build burgers,
    // plate salads, serve and WASH; the bot preps all three toppings.
    // Code-side ASCII + coop config (editor schema untouched).
    id: 'split_coop',
    num: 5,
    open: true,                  // co-op test level — always selectable
    name: 'Split Kitchen',
    emoji: '👥',
    style: 'A',
    map: [
      'CCCCCHHCC',
      '4...C...s',
      '3.b.C.P.s',
      '5...C...1',
      'C...C.C.2',
      'C...C...C',
      'CCCCCkrtC',
    ],
    crates: { 1: 'bun', 2: 'patty_raw', 3: 'lettuce', 4: 'cheese', 5: 'tomato' },
    // The stoves stand against the right side wall (they used to stand one tile
    // in, with a dead counter behind them), so they get a wall and a hood.
    sideWall: { right: 3 },
    backWall: ['wall', 'wall', 'wall_window_closed_curtains_red'],   // window stays right of the hatch
    props: [
      { model: 'tt_wall_knife_rack', col: 2, wall: true, y: 2.8 },          // the prep wing
      { model: 'tt_wall_shelf_kitchen_hooks_decorated', col: 3.6, wall: true, y: 3.3 },
      { model: 'tt_sansevieria_plant_small_potted', col: 0, row: 0, y: 1.02 },
      { model: 'tt_scale', col: 4, row: 0, y: 1.02, rot: 0.3, scale: 1.2 },  // head of the pass counter
      // the dead corner next to the stoves: the cook's corner
      { model: 'tt_utensils_cup', col: 7.85, row: -0.15, y: 1.02, rot: -0.4, scale: 1.1 },
      { model: 'tt_container_kitchen_A_red', col: 8.2, row: 0.1, y: 1.02, scale: 1.3 },
      // shallow and high, so the hood never hides the pans from the camera
      { model: 'tt_extractor_hood', wall: 'right', row: 1.5, y: 2.95, scale: [1.7, 1, 0.6] },
      { model: 'tt_monstera_plant_small_potted', col: 0, row: 6, y: 1.02, rot: 0.6 },
      { model: 'tt_zzplant_plant_small_potted', col: 4, row: 6, y: 1.02 },
      { model: 'tt_pothos_plant_small_potted', col: 8, row: 6, y: 1.3, rot: 2.4 },
    ],
    // burgers (cheese) + big burgers (cheese+lettuce) + salads (lettuce+tomato)
    // → all three of the bot's prep streams stay busy.
    orders: ['cheeseburger', 'salad', 'bigburger', 'hamburger', 'salad', 'cheeseburger', 'bigburger', 'salad'],
    spawnEvery: [5, 8],
    plates: 3,
    starTimes: [360, 245, 180, 140],   // 1★ / 2★ / 3★(gold) / author — calibrated 2026-11-23 evening (bot E=138.7s, 2-answer washing)
    tutorial: {
      image: 'assets/ChatGPT/Burger.webp',
      title: 'Split Kitchen (co-op)',
      text: 'You share a divided kitchen with a helper! It preps cheese, lettuce and tomato and passes them across the middle counter — you cook the patties, build burgers and salads, serve, and wash up.',
    },
    coop: {
      char: 'knight',
      intro: 'helperIntroSplit',       // i18n key: the helper's first line (who does what)
      spawn: { col: 1, row: 4 },
      idle: { col: 1, row: 5 },        // parks bottom-left of the prep wing
      moveSpeed: 0.5, workSpeed: 0.55, reaction: 0.7,
      demand: true,                    // cut only what the orders actually need
      // the central pass counter (col 4) is a shared drop pool — the bot parks a
      // slice on ANY free tile (preferred one taken? just use the next).
      pass: [
        { col: 4, row: 1 }, { col: 4, row: 2 }, { col: 4, row: 3 },
        { col: 4, row: 4 }, { col: 4, row: 5 },
      ],
      // ONE shared cutting board (col 2) — the bot only chops one thing at a
      // time; staging is the shared pass pool above.
      stations: [
        { ingredient: 'cheese',  board: { col: 2, row: 2 } },
        { ingredient: 'lettuce', board: { col: 2, row: 2 } },
        { ingredient: 'tomato',  board: { col: 2, row: 2 } },
      ],
    },
  },
  {
    // Level 6 "Soup Kitchen" — a vegetable-soup level (editor JSON layout,
    // levels/soup6.json). Single player, served in BOWLS not plates. TWO empty
    // pots sit on the two stoves at the start (Overcooked-style fixtures): chop a
    // veg and tip it STRAIGHT into a stove-pot (E) — the broth shows the soup
    // forming, coloured by recipe even with just one veg in. Two recipes share
    // four veg: carrot + potato (orange soup) and onion + mushroom (creamy). A
    // complete pot auto-boils, then you scoop the soup into a clean BOWL (the pot
    // stays, empty, reusable), serve at the hatch → dirty bowl → sink → verb quiz
    // (grammar loop reused unchanged). Clean bowls stack where the dish rack was;
    // dirty bowls land on the right of the sink.
    id: 'soup',
    num: 6,
    open: true,                  // selectable for playtest
    name: 'Soup Kitchen',
    emoji: '🍲',
    style: 'B',
    jsonUrl: 'levels/soup6.json',
    trimFloor: true,             // no bare floor strip right of the counters
    props: [
      // shallow + high, so the hood never hides the pots from the camera
      { model: 'tt_extractor_hood', col: 4.5, wall: true, y: 2.95, scale: [1.5, 1, 0.7] },
      { model: 'tt_wall_shelf_kitchen_hooks_decorated', col: 0.6, wall: true, y: 3.3 },
      { model: 'tt_wall_knife_rack', col: 6, wall: true, y: 2.8 },
      { model: 'tt_teapot', col: -0.05, row: 0.1, y: 1.02, rot: 0.6, scale: 1.2 },
      { model: 'tt_utensils_cup', col: 5.9, row: -0.1, y: 1.02, rot: -0.3, scale: 1.1 },
      { model: 'tt_container_kitchen_A_red', col: 6.25, row: 0.15, y: 1.02, scale: 1.3 },
      { model: 'tt_cacti_plant_pot_small', col: 0, row: 4, y: 1.02 },
      { model: 'tt_sansevieria_plant_small_potted', col: 6, row: 4, y: 1.02 },
    ],
    vessel: 'bowl',              // serve in bowls, not plates (see stations.setVessel)
    spawn: { col: 4, row: 4 },   // chef start in JSON cell coords
    // two empty pots pre-placed on the two stoves (JSON cell coords)
    startItems: [
      { c: 5, r: 1, item: 'pot_empty' },
      { c: 6, r: 1, item: 'pot_empty' },
    ],
    // a mix of the two recipes; lets the player batch chops. 6 orders · 2 bowls
    // → washing stays load-bearing.
    orders: ['carrot_potato_soup', 'onion_mushroom_soup', 'carrot_potato_soup', 'onion_mushroom_soup', 'carrot_potato_soup', 'onion_mushroom_soup'],
    spawnEvery: [7, 11],
    plates: 2,                   // 2 clean bowls to start
    starTimes: [290, 195, 145, 115],   // 1★ / 2★ / 3★(gold) / author — calibrated 2026-11-23 evening (bot E=111.4s, 2-answer washing)
    tutorial: {
      image: 'assets/ChatGPT/Soup.webp',   // made with Gemini 2026-11-23
      title: 'Soup Kitchen',
      text: 'Two pots wait on the stoves! Chop the veg on the boards, then tip each into a pot — carrot + potato makes one soup, onion + mushroom another. When it boils, scoop it into a bowl and serve!',
    },
  },
  {
    // Level 7 "Sundae Sunday" — cold assembly with ONE tool (no stove, no board).
    // Redesigned 2026-11-23 after the owner's play-test. Editor-JSON layout
    // (levels/icecream7.json), served in BOWLS. Local grid 8×5:
    //
    //      0 1 2 3 4 5 6 7        V S X  the three ice-cream tubs (vanilla,
    //   0  # h C H H C C #               strawberry, chocolate), left wall
    //   1  V . . . . . . k        h      the scoop stand (the ONE scoop's home)
    //   2  S . I . . . . r        I      the island: bowls are filled here
    //   3  X . I . . . . C        w c s  topping bowls: waffles, cookie sticks,
    //   4  # C # w c s t #               cherries (front row) · t trash
    //                             k sink · r clean bowls · H hatch · # dead corner
    //
    // The ice-cream aisle (col 1) runs between the tubs and the island: turn
    // left to fill the scoop, turn right to drop the ball into a bowl on the
    // island. The scoop is a real object (recipes.js `scoop`): grab it from its
    // stand, load it at a tub, empty it into a bowl, park it (stand or any free
    // counter) — you need a free hand to carry the bowl. Toppings are taken by
    // hand, or simply carry the bowl to a topping bowl. Every sundae on the
    // tickets has a topping. Rules: game.js scoopAtTub / scoopIntoBowl.
    id: 'sundae',
    num: 7,
    open: true,                  // selectable for playtest
    name: 'Sundae Sunday',
    emoji: '🍨',
    style: 'B',
    jsonUrl: 'levels/icecream7.json',
    trimFloor: true,             // no bare floor strips outside the counters
    // Decor only on the dead corners + the dead counter in front of the island
    // (col 2, row 4), and on the wall. Nothing that looks like a topping bowl
    // or a scoop: everything on a reachable counter is usable.
    props: [
      { model: 'tt_wall_shelf_kitchen_hooks_decorated', col: 0.4, wall: true, y: 3.3 },
      { model: 'tt_cookie_jar', col: -0.14, row: -0.1, y: 1.02, scale: 1.2 },
      { model: 'tt_sansevieria_plant_small_potted', col: 7, row: 0, y: 1.02 },
      { model: 'tt_monstera_plant_small_potted', col: 0, row: 4, y: 1.02, rot: 0.6 },
      { model: 'icecream_cone_stacked', col: 1.84, row: 4.1, y: 1.02 },
      { model: 'food_icecream_cone_chocolate', col: 2.2, row: 3.9, y: 1.02 },
      { model: 'tt_pothos_plant_small_potted', col: 7, row: 4, y: 1.3, rot: 2.4 },
    ],
    vessel: 'bowl',              // sundaes are served in a bowl (no plate)
    spawn: { col: 5, row: 3 },   // chef start in JSON cell coords
    scoopStand: { c: 2, r: 1 },  // JSON cell coords: back counter at the head of the aisle
    startItems: [{ c: 2, r: 1, item: 'scoop' }],   // the one and only scoop, in its stand
    // 1 ball + topping twice to learn the flow, then 2 balls, then all three;
    // the round ends on the big one. 13 balls + 7 toppings in all;
    // 7 orders · 2 bowls → 5 washes (the old level was the second-easiest).
    orders: ['sundae_vanilla', 'sundae_crunch', 'sundae_deluxe', 'sundae_vanilla', 'sundae_neapolitan', 'sundae_deluxe', 'sundae_neapolitan'],
    spawnEvery: [5, 8],
    plates: 2,                   // 2 clean bowls to start
    starTimes: [270, 185, 135, 105],   // 1★ / 2★ / 3★(gold) / author — calibrated 2026-11-23 evening (bot E=104.7s, 2-answer washing)
    tutorial: {
      image: 'assets/ChatGPT/Sundae.webp',   // made with Gemini 2026-11-23
      title: 'Sundae Sunday',
      text: 'Put a bowl on the counter and grab the ice-cream scoop. Scoop a ball from a tub and drop it into the bowl — one ball for each on the ticket. Park the scoop, add the topping (cherry, waffle or cookie stick) and serve!',
    },
  },
  {
    // Level 8 "Sandwich Bar" — chop + TOASTER. Bread comes as a whole loaf:
    // chop it into a slice (two-stage chop), toast the slice in one of the two
    // toasters (cook → ready → BURNS if you forget it, like a burger patty), then
    // build the sandwich on the toast with chopped cheese / lettuce / tomato in
    // any order — no plate needed until you serve (the burger pattern). Three
    // sandwiches vary the fillings. Routing dance: crates on the left, boards on
    // the right, toasters at the back-left, the island in the middle to assemble.
    // The first kitchen dressed with Tiny Treats props (`tt`, `props`): toaster,
    // extractor hood, shelf with mugs, knife rack, paper towels, kettle, plants.
    id: 'sandwich',
    num: 8,
    open: true,                  // selectable for playtest
    name: 'Sandwich Bar',
    emoji: '🥪',
    style: 'B',                  // dark counters: bread + the red toasters read well on them
    tt: true,                    // preload the Tiny Treats item models (bread, sandwich)
    backWall: ['wall'],          // solid back wall all along (the wall props hang on it)
    map: [
      'CTTCHHkC',
      '1......r',
      '2.CC...C',
      '3..P...b',
      '4......b',
      'CCCCCCtC',
    ],
    crates: { 1: 'bread', 2: 'cheese', 3: 'tomato', 4: 'lettuce' },
    // the Club (all three fillings) comes exactly twice; 6 orders · 2 plates →
    // 4 washes, so washing stays load-bearing.
    orders: ['cheese_toastie', 'garden_sandwich', 'cheese_toastie', 'club_sandwich', 'garden_sandwich', 'club_sandwich'],
    spawnEvery: [6, 9],
    plates: 2,
    starTimes: [430, 290, 215, 170],   // 1★ / 2★ / 3★(gold) / author — calibrated 2026-11-23 evening (bot E=165.8s, 2-answer washing)
    tutorial: {
      image: 'assets/ChatGPT/Sandwich.webp',   // made with Gemini 2026-11-23
      title: 'Sandwich',
      text: 'Slice the bread and toast a slice — don’t let it burn! Then add chopped cheese for a Cheese Toastie, lettuce and tomato for a Garden Sandwich, or all three for a Club Sandwich.',
    },
    // Tiny Treats decor. Tile coords may be fractional. `wall: true` hangs the
    // prop on the back wall (y = height of its origin); otherwise it stands at
    // height `y` (1.02 = on a counter). The four corner counters can't be
    // reached by the chef, so props there never block a work surface.
    props: [
      // the hood is kept shallow and high so it never hides the toasters from the camera
      { model: 'tt_extractor_hood', col: 1.5, wall: true, y: 2.95, scale: [1.5, 1, 0.7] },
      { model: 'tt_wall_shelf_kitchen_hooks_decorated', col: 3.05, wall: true, y: 3.3 },
      { model: 'tt_wall_papertowel_holder', col: 6, wall: true, y: 2.75 },
      { model: 'tt_wall_knife_rack', col: 7, wall: true, y: 2.8 },
      { model: 'tt_kettle', col: -0.12, row: 0.1, y: 1.02, rot: 0.5, scale: 1.2 },
      { model: 'tt_utensils_cup', col: 0.2, row: -0.2, y: 1.02, rot: -0.3, scale: 1.1 },
      { model: 'tt_sansevieria_plant_small_potted', col: 7, row: 0, y: 1.02 },
      { model: 'tt_monstera_plant_small_potted', col: 0, row: 5, y: 1.02, rot: 0.6 },
      { model: 'tt_pothos_plant_small_potted', col: 7, row: 5, y: 1.3, rot: 2.4 },
    ],
  },
];

// Locked "coming soon" slots shown after the playable levels (levels grow to
// ~10–15; dish themes repeat). Numbers only; emoji is a decorative hint.
export const PLACEHOLDERS = [
  { id: 'lv9',  num: 9,  emoji: '🍕' },
  { id: 'lv10', num: 10, emoji: '🍲' },
];

// Static decor models every level needs preloaded, keyed by visual style.
export function levelModelNames(level) {
  const sB = level.style === 'B' ? '_styleB' : '';
  // Tiny Treats pieces only where a level uses them (toaster + its decor props)
  const tt = [
    ...(level.map && level.map.some((row) => row.includes('T')) ? ['tt_toaster'] : []),
    ...(level.props || []).map((p) => p.model),
  ];
  return [
    ...tt,
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
    'crate_lettuce', 'crate_tomatoes', 'crate_buns', 'crate_potatoes',
    'crate_cheese', 'crate_dough', 'crate_mushrooms',
    'crate_onions', 'crate_carrots', 'pot_A',
  ];
}

// crate item id → crate model
export const CRATE_MODELS = {
  lettuce: 'crate_lettuce',
  tomato: 'crate_tomatoes',
  bun: 'crate_buns',
  patty_raw: 'crate_potatoes',   // veggie patties come from the potato crate
  cheese: 'crate_cheese',
  dough: 'crate_dough',
  mushroom: 'crate_mushrooms',
  onion: 'crate_onions',
  carrot: 'crate_carrots',
  potato: 'crate_potatoes',
  pot_empty: 'crate',   // generic crate of clean pots (no pot-crate art in the pack)
  // sundae tubs: filled ice-cream containers read clearly as flavour tubs.
  ball_vanilla: 'icecream_container_icecream_vanilla',
  ball_chocolate: 'icecream_container_icecream_chocolate',
  ball_strawberry: 'icecream_container_icecream_strawberry',
  // sundae toppings: the pack's topping bowls stand on a counter (editor JSON)
  cherry: 'icecream_bowl_cherries',
  waffle: 'icecream_bowl_waffles',
  cookiestick: 'icecream_bowl_cookiesticks',
  bread: 'crate_buns',  // bread loaves come from the bakery crate (no loaf-crate art)
};
