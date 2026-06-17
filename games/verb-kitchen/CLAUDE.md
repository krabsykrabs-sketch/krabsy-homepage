# Verb Kitchen — proof-of-concept brief

You are building a new game for **Krabsy** (krabsy.com), a browser-based
English-grammar learning site for German- and Spanish-speaking school kids
(roughly ages 10–14). The site has a catalogue of arcade games that drill
irregular verbs (Verb Slash, Verb Snake, Verb Flow, Air Control, a 3D
platformer). This folder is yours; the brief below is everything you need.
You do not have — and do not need — access to the rest of the repo except
the read-only references listed under **Data** and **Assets**.

## The game in one paragraph

**Verb Kitchen** is a single-player Overcooked-style cooking-chaos game
in 3D. Order tickets stream in; you run a small kitchen alone — grab
ingredients, chop them, cook them (don't let them burn!), assemble the
dish on a plate, and slide it out the serving hatch before the
customer's patience runs out. Levels have **different kitchen layouts
and different recipes** (salads → burgers → pizza). The grammar lives at
the **sink**: every served order comes back as a dirty plate, and
washing a plate = answering one irregular-verb question. No clean
plates, no serving — so studying IS your throughput.

## Why dishwashing is the quiz hook (decision rationale, already made)

Three candidates were considered: per-serve questions (interrupts every
order — kills the arcade flow), crate restocking (random, low stakes),
and **dishwashing — chosen** because:
- It's already a chore station in Overcooked; players expect it.
- It's **self-paced**: you decide when to wash, so the player controls
  when the "thinking moment" happens — frantic cooking and calm reading
  never collide at the wrong time.
- Plate scarcity makes grammar load-bearing without gating every single
  action: roughly one question per served order, batched as YOU choose.
- Thematically perfect: the sink is where a chef catches their breath.

Mechanics: each level starts with 3–4 clean plates (~5 in circulation).
Served orders return as dirty plates at the sink after a few seconds.
Interacting with the sink opens one question (three answer chips).
Correct → sparkling clean plate slides onto the rack. Wrong → plate
stays dirty, the full chain is shown (`go → went → gone`), a fresh
question waits. **While the question is open, cooking timers pause and
patience bars tick at ~30%** — thinking is safe-ish but not free.

## Core loop & systems (build exactly this)

- **Tickets:** order cards slide in at the top (dish icon + ingredient
  icons + patience bar). Max 3 concurrent. Serve in any order. Tip
  scales with remaining patience; an expired ticket slides away with a
  sad trombone (score sting, never a fail state).
- **Carrying:** the chef carries ONE thing (ingredient, plate, pan).
  `E` = pick up / put down (context-sensitive). `Space` = work the
  station you face (chop / wash). Counters hold one item per tile.
- **Stations:** ingredient crates (infinite in the PoC), cutting board
  (hold Space, progress bar), stove + pan and oven (cook timer → ready
  → overcook warning → burnt + smoke; burnt food goes to the trash),
  plate rack, assembly counter, serving hatch, sink, trash bin.
- **Recipes & levels (PoC = 3 authored levels + 1 teaser):**
  1. **Garden Bistro** — salad only (chop lettuce + tomato → plate →
     serve). Teaches movement, chop, plate, serve, wash. Generous.
  2. **Burger Bar** — patties on the stove (first burn risk!) + chopped
     toppings + bun. Layout forces a little routing dance.
  3. **Pizzeria** — roll dough at the prep table, add sauce + topping,
     bake in the oven, serve. Longest pipeline, tightest kitchen.
  4. *(teaser tile on the level select, locked: "Sundae Sunday — coming
     soon" — the ice-cream assets exist in the pack's Extra tier.)*
- **Scoring:** coins per dish + patience tip + combo bonus for
  consecutive no-expiry serves. 1–3 stars per level at score
  thresholds; stars persist and gate the next level (1 star unlocks).
  Round length ~3 minutes.
- **The chaos checklist (this is where the fun lives):** smoke + alarm
  when something burns, wobbling ingredient stacks, the chef's little
  skid when changing direction at speed, plates clattering onto the
  rack, ticket cards that shake when nearly expired, a frantic music
  layer that kicks in under 30 seconds left.

## Camera & character

- Fixed Overcooked-style angled top-down camera per level — the whole
  kitchen visible at once, no camera controls.
- Chef = KayKit Adventurer character with the Character Animations rig
  (run/idle/interact); items render in hands / over head. Squash &
  stretch generously; charm over fidelity.

## Assets (FIRST asset-first game — read carefully)

The shared KayKit library is at `/home/jan/krabsy-homepage/assets/` and
this session has **read access** already (via `.claude/settings.local.json`
→ `permissions.additionalDirectories`). The library is **read-only**:
copy what you wire into THIS folder (gitignored working copy); the
master session promotes the used subset to `homepage/` at release.

- **Primary pack (ON DISK, verified):**
  `/assets/KayKit/KayKit_Restaurant_Bits_1.0_EXTRA/Assets/gltf/`
  — 225 gltf models + `restaurantbits_extra.png` (the single texture
  atlas every model references) + per-model `.bin` files. The EXTRA
  download is **self-contained** (it includes all base models too);
  ignore the `_FREE` sibling folder if it still exists.
- **The pack models the game's mechanics directly — use these:**
  - Sink loop: `plate` / `plate_dirty` / `plate_small`, `bowl` /
    `bowl_dirty`, `kitchencounter_sink` (+`_backsplash`, `_styleB`),
    `dishrack` / `dishrack_plates`, `kitchentable_sink*`.
  - Cooking: `stove_single` / `stove_multi` (+`_countertop`), `oven`,
    **`pizza_oven`**, `pan_A/B`, `pot_A/B` (+`_stew`), `cuttingboard`,
    `extractorhood`.
  - Ingredient states exist as separate models — wire them as the
    visual per processing step: e.g. `food_ingredient_potato` →
    `_chopped` → `_mashed`; `mushroom` → `_chopped` → `_pieces`;
    `burger_cooked` → **`burger_trash` (burnt!)**; `dough` /
    `dough_base`; `bun_top` / `bun_bottom`; `cheese_grated`.
  - Finished dishes: `food_burger`, `food_pizza_{cheese,mushroom,
    pepperoni}_plated`, `food_dinner`, `food_icecream_cone_{vanilla,
    chocolate,strawberry}` (the sundae teaser is real).
  - Ingredient sources: `crate_<ingredient>` for buns, carrots, cheese,
    dough, ham, lettuce, mushrooms, onions, pepperoni, potatoes, steak,
    tomatoes.
  - Rooms: walls (incl. **`wall_orderwindow`** — the serving hatch!),
    windows/curtains/doors, `floor_kitchen` + `_small` variants, and
    **two full visual styles** — counters/floors come in style A and
    `_styleB` → use style A for levels 1–2 and style B for level 3 to
    get "different kitchen designs" for free.
- Also available: `KayKit_Adventurers_2.0_FREE` (the chef),
  `KayKit_Character_Animations_1.1` (rig animations).
- Use the **GLTF** files only (Three.js native); ignore FBX/OBJ copies.

## Tech conventions (match the rest of Krabsy)

- **Stack:** Three.js **0.169** via CDN import map (same as the other 3D
  games), plain ES modules, `index.html` + `src/*.js` (game, level,
  chef, stations, orders, recipes, sink, fx, ui, audio, verbs). No
  build step, no npm, no TypeScript.
- **Look & feel:** Krabsy house style for all UI — teal `#2ee6c0`,
  coral `#ff8585`, amber `#ffcf5e` on deep navy; Fredoka One + Nunito;
  rounded chips/buttons; start screen with emoji mascot (🍳), how-to
  rows, big primary button; level-select screen with star badges.
- **Grammar content:** house standard — irregular verbs, mixed simple
  past / past participle slots, three chips, plausible distractors
  (regularized "goed", swapped past↔pp, similar verbs). Form colors:
  **base=amber, past=teal, participle=coral**. Track missed verbs; the
  sink re-asks them later in the round (spaced repetition at the sink!).
  Post-level screen recaps missed chains.
- **Audio:** WebAudio synth only: chop thock, sizzle loop, smoke alarm,
  serve ding + register cha-ching, dish-splash, correct arpeggio, wrong
  bzzt, 30-second frantic layer. Mute persisted (`krabsy_vkitchen_sound`).
- **Persistence:** `krabsy_vkitchen_save` (versioned JSON): stars per
  level, best scores, missed-verb list.
- **Performance:** 60 fps mid laptop; merge static kitchen geometry per
  level; ONE shadow light or blob shadows; cap particles.

## Verification (do this, don't skip it)

- Serve statically and verify in a real browser. **Known issue:** the
  interactive preview's screenshot tool can hang (suspended renderer).
  Proven workaround: **headless Edge** screenshots —
  `msedge --headless=new --disable-gpu --window-size=900,600
  --screenshot=out.png "http://localhost:PORT/?qa=level2"` — and
  support `?qa=` frozen scenes (each level, sink-question open,
  burn-smoke moment, level-complete stars).
- QA hook (`window.__VK`): teleport chef, grant/clear plates, spawn
  tickets, force question outcomes, read state. Drive the FULL loop
  programmatically and assert each step: ticket → ingredient → chop →
  cook → plate → serve → coins → dirty plate → sink question → clean
  plate. Also assert: burn path → trash; expired-ticket path; pause
  behavior during questions; save/load round-trip.
- Zero console errors; FPS check during max chaos (3 tickets, smoke).

## Definition of done

- A stranger can play level 1 unaided, understand washing-by-grammar
  without reading anything, finish level 3 sweating, and immediately
  retry for 3 stars.
- The full order pipeline, sink loop, burn/expiry paths, star gating,
  and persistence verified programmatically.
- Feels like Overcooked: by level 3 the player is routing, batching
  washes, and muttering at the oven. The chaos checklist is in.
- This file's **Status log** is updated; work is committed (commits
  stay inside this folder).

## Non-goals (v1.1+ roadmap — keep the code open to these)

- Two-chef tag-switching (solo Overcooked mode), local co-op
- Throwing ingredients, conveyor belts, moving counters, rats
- Ice cream / sundae level (Extra assets), drinks
- Crate restocking via grammar, plate-rack upgrades
- Touch controls; DE/ES UI localization; site integration (master
  session handles release)

## Data

Canonical verb data: `../../content/irregular-verbs.json` (155 verbs,
read-only reference). Inline a curated ~40-verb subset in
`src/verbs.js` with shape `{v:'go', past:'went', pp:'gone'}`.

## Question engine (site-wide, added 2026-06-12 by the master session)

The shared engine at `/lib/krabsy-questions.js` (served site root) is now
the standard question source — prefer it over inlining data when this
game is integrated/released (keep a small inline fallback for offline
dev). For this game use the **quiz** shape:
`getQuizSet({topic: topicFromUrl(), count, withOptions})` returns
presentation-ready records (`display`, `options`, `correctIndex`,
`accepts`, `teach`) and works for irregular verbs AND prepositions —
`?topic=` makes the game topic-agnostic for free.

**Presentation mandate (user decision): never require grammar
terminology.** Render the positional notation `go → ___ → ___` with the
asked blank highlighted (record.display gives you base/slots/askIndex),
or the sentence gap for prepositions — NOT "what is the simple past
of…". Terminology may appear only as a small caption or in the
after-answer teach beat. Typed input (validate with `checkTyped`) is a
welcome alternative to choice chips.

## Working agreements

- You own only `games/verb-kitchen/`. Don't modify anything outside it.
- Commit locally as you go; never push.
- Keep this CLAUDE.md current — it is the only memory between sessions.

## Status log

- 2026-06-16 — **Sink quiz: answer box sizes to the answers (no 2-row wrap).**
  User disliked the chips wrapping to two rows. `#quizCard` was fixed at
  `max-width:480px; width:92%`; changed to `width:fit-content;
  max-width:min(94vw,660px); min-width:min(92vw,340px)` and added
  `white-space:nowrap` to `.chip`. The card now grows/shrinks to keep the three
  chips on ONE row (wraps only as a last resort past the viewport). Verified
  headless (`?qa=question`, forced triples): short go/went/gone → 1 row, card
  479px; long understood/understanded/understand → 1 row, card 646px. Only
  `index.html` touched.

- 2026-06-16 — **SESSION WRAP — editor-JSON levels + new menu + guided tutorial
  (read first; the co-op Level 4/5 entries below are a SEPARATE parallel
  session).** Current lineup (`src/levels.js`): **1 Garden Bistro** (salad,
  `levels/salad1.json`, GUIDED tutorial), **2 Burger Bar** (ASCII map), **3 Pizza**
  (`levels/pizza3.json`, replaced the old ASCII Pizzeria), **4 Burger Co-op** +
  **5 Split Kitchen Co-op** (the other session's ASCII+bot levels). 6–10 locked.
  - **Editor→game JSON pipeline (the big new system).** The Krabsy Level Editor
    (separate worktree `../restaurant-editor`, branch `editor-branch`) exports a
    level as placed KayKit models. `World.buildFromJSON(scene)` (`src/world.js`)
    rebuilds the scene EXACTLY per `assets/JSON Levels/LEVEL-FORMAT.md`
    (footprints, ground/wall offsets, stacking, rotations, floor-recentre to the
    origin) and INFERS stations from model names: `kitchencounter_sink*`→sink,
    `pizza_oven`/`oven`→oven, `cuttingboard`→board (auto-adds a hiding knife),
    `dishrack`→rack, `crate_<x>`→crate (item via `CRATE_MODELS`), an EMPTY
    `crate`→trash bin (tinted `#4a5366`, 0.92), order-window counters→hatch;
    `ketchup`→a pickable start item; walls/cabinets/pillars/an oven off the floor
    →decor (a station is only made on a FLOOR tile). Handles a `rotX` field; skips
    explicit `knife`/`rollingpin` objects. **To add an editor level:** drop its
    JSON in `levels/`, add a LEVELS entry `{ jsonUrl, rotate:2 (puts the hatch at
    the BACK — camera convention), spawn:{col,row} in JSON cell coords, orders,
    plates, starTimes, tutorial, optional startItems:[{c,r,item}] }`, and copy any
    models it uses that aren't already in `assets/models/restaurant/` from the
    KayKit EXTRA pack. ASCII levels (2,4,5) still use `map`/`build()`; World
    branches on `level.jsonUrl`.
  - **Main menu = `assets/ChatGPT/MainMenu.png`.** ONE fixed `#menuBg` element
    (index.html) sits behind EVERY menu screen — `ui.showScreen` toggles its
    `.on`; the screens are transparent overlays, so switching never reloads/moves
    the background and only a screen's own content scrolls. Title + buttons
    centred. (Recipe cards still use `Salad/Burger/Pizza.png` in `assets/ChatGPT/`.)
  - **Guided salad tutorial** (`src/tutorial.js`, only on `guided` levels): Level 1
    walks the first salad (grab→chop→plate→repeat→serve→wash) with a bottom banner
    + a bobbing 3D arrow at the target station, then frees play for the other 2.
    Latching milestones (robust to out-of-order). Starts with 1 clean plate on a
    counter + 1 dirty at the sink (`startItems` + `startDirty` level fields).
  - **Also this session:** help bubbles render the actual plate/bun MODELS
    (`src/icons.js`), not emoji; the board knife hides while chopping
    (`st.toolMesh`); HUD = one full-width top bar (timer+orders left, coins +
    sound/home right), bottom-left plate counter removed; mobile tap on a TALL
    station (oven/sink) now snaps to the counter beneath it (`touch.js` pickTile,
    when hit `y > 1.4`).
  - **Deploy:** `bash tools/deploy-to-dev.sh verb-kitchen` (from repo root) →
    rsyncs the folder (incl. `assets/`, EXCL `*.md`) to `../brocco-dev` + pushes →
    Coolify auto-serves `dev.brocco.run/verb-kitchen/`. The user wants every
    finished change committed + pushed to DEV automatically (only the real
    krabsy.com site needs explicit approval).
  - **Verified** via headless-Edge + `__VK`/`__touch`; zero console errors.
    **Multi-session note:** the MASTER session released the game to the homepage
    (`9d52df5`) + did analytics/SEO; the CO-OP session added Levels 4/5 +
    `src/helper.js` on top — all linear on `main`; current HEAD boots & all 5
    levels load.
  - **Open:** star times are placeholders (Level 1 is slower now it's guided);
    `pizza3.json` shipped WITHOUT its ketchup bottle, so it's re-added as a start
    item — drop that if the editor exports it; portrait crops the menu image's
    side chefs (centre wall stays). `assets/` is gitignored — images + models
    ship via the deploy rsync, NOT git.

- 2026-06-16 — **Mobile menu auto-start FIX + Level 5 compacted (user).**
  - **Bug:** on mobile, opening the game jumped straight into a level (Level 4).
    Cause: `tap()` (in BOTH `main.js` and `ui.js`) acted on `pointerup` with a
    PER-ELEMENT dedupe flag, so a touch on "Play" fired pointerup→show grid, then
    the touch's trailing GHOST click landed on the level card now under the
    finger (its own flag was false) → auto-start. Fix: a SHARED guard
    (`window.__touchTapAt`) — any click within 700 ms of a touch pointerup is
    ignored, so a tap can't ghost-click a just-revealed element. Desktop (mouse)
    path unchanged. Both `tap()`s updated.
  - **Level 5 compacted** (user: each chef owns its room, so no need to size for
    two in one area): map 11×8 → **9×7** (−2 w, −1 h; each wing one tile
    narrower), helper now uses **ONE shared cutting board** (col 2) instead of 3
    (it only chops one thing at a time), **two stoves kept**. coop coords
    updated (pass pool col 4 ×5, board col 2, spawn/idle col 1). Verified
    headless (`?qa=split`): 9×7, board×1, stove×2, crate×5; planner stocked the
    3 orders' needs (cheese×2, lettuce×2, tomato×1) on the 5-tile pool, idle.
    Files: `main.js` `ui.js` `levels.js` `qa.js`.
- 2026-06-16 — **CO-OP Level 5 v3 (user): smart requirements planner.** Replaced
  the simple demand counter with an order-by-order MRP-style planner
  (`helper.pickByPlan` + `gatherResources`). Each free cycle it scans the world
  for resources — ready-made dishes (a complete plate, or a finished plate-less
  burger) and FREE chopped slices (standalone on any station or in the player's
  hand, NOT slices bound inside a plate/half-built burger) — then walks the
  on-screen orders in turn: an order already covered by a ready dish is skipped;
  for the rest, each chopped ingredient it needs is satisfied from a free slice
  if one exists, else it's made. First genuinely-missing ingredient is the next
  job (so 2 cheeseburgers → 2 cheese, over 2 trips). Backup when all covered:
  fill an empty pass slot with any ingredient we have NONE of anywhere.
  - Verified headless (`?qa=split`): free lettuce on a counter + salad + 2×
    cheeseburger → pool = cheese×2, tomato×1, **lettuce×0** (free one used),
    helper idle. Files: `helper.js` `qa.js`.
- 2026-06-16 — **CO-OP Level 5 v2 (user feedback): demand-driven + pass pool.**
  Two per-level helper behaviours added (Level 4 keeps the old always-stocked /
  fixed-spot behaviour):
  - **`coop.demand: true`** — the bot cuts whichever ingredient the on-screen
    orders are most SHORT of (orders needing it − already staged; biggest
    deficit wins). Fixes the reported bug: under the old "always stock in fixed
    order" rule the bot endlessly refilled cheese+lettuce (burned through by
    burgers) and never reached tomato, so salads had no tomato. Demand mode
    makes the salad's tomato as soon as a salad ticket is up.
  - **`coop.pass: [...tiles]`** — staging is now a shared POOL of pass-counter
    tiles; the bot drops a slice on the nearest FREE tile (preferred one taken →
    use the next), and waits holding it only if the whole isle is full. Per-line
    `staging` is now optional (helper `stagedCount` / `chooseStaging`).
  - Verified headless (`?qa=split`): salad+cheeseburger tickets → pool =
    [cheese_chopped, lettuce_chopped, tomato_slices, …], demand=true, helper
    idle (no over-stock). Tomato now flows. Files: `helper.js` `levels.js`
    `qa.js`.
- 2026-06-16 — **CO-OP Level 5 "Split Kitchen" — the flagship co-op level.**
  User: the simple Level 4 doesn't justify co-op; build a complex one where it
  does. Designed a walled-split 11×8 kitchen: a counter wall down col 5 divides
  a PREP wing (bot: cheese/lettuce/tomato crates + 3 boards, cols 0–4) from a
  SERVICE wing (player: bun+patty crates, 2 stoves, rack, sink, hatch, trash,
  cols 6–10), joined ONLY by the central pass counter (col 5). Neither chef can
  cross — co-op is structural (prep wing unreachable solo). Bot stages all three
  toppings on the pass counter; player cooks/builds/plates/serves/washes. Menu =
  burgers + big burgers + salads (`['cheeseburger','salad','bigburger',
  'hamburger','salad',...]`) so all three prep streams stay busy. **tomato is
  the bot's 3rd line** (one-stage chop → tomato_slices; free via config).
  - New `open: true` level flag → both co-op test levels (4 & 5) always
    selectable; `ui.js` gate reverted to `!lv.open && i>=3` (cleaner than the
    earlier i>=4 bump). Removed the `lv5` placeholder.
  - Verified headless (`?qa=split`, 40s): all 3 pass-counter slots staged
    (cheese_chopped / lettuce_chopped / tomato_slices), helper idle at corner
    {1,6}; station census 5 crate / 3 board / 2 stove / sink+rack+hatch+trash all
    present; screenshot shows the split + handoff clearly. Files: `levels.js`
    `ui.js` `qa.js`.
  - **Open / to playtest:** topping starvation risk — one slow bot keeping 3
    streams stocked at par=1 vs dense orders; tune via order density, par, or a
    per-level bot-speed bump. Star times are placeholders. Idea backlog (user +
    asset pack): pepperoni pizza, sandwiches, **soups/stews** (pot+ladle+stew
    assets exist → biggest co-op payoff), plated dinners — see chat brainstorm.
- 2026-06-16 — **CO-OP v0.3 (user: "bot is way too fast").** Slowed the helper
  on three axes, all tunable from `coop` config:
  - **Walk speed** — `Chef.speedScale` (new), helper set to `coop.moveSpeed`
    0.5 (50% of the player). `chef.js` uses `SPEED * speedScale`.
  - **Chop speed** — `helper.workMul` (`coop.workSpeed` 0.55): chopTick advances
    `progress += dt*workMul/chopTime` → a slice takes ~3.3s not 1.8s.
  - **Reaction time** — `helper.delay` + `coop.reaction` 0.7s: the helper stands
    still for a beat before starting a new job, and for ~0.35s after grabbing /
    before chopping / before carrying to staging — so it no longer reacts
    instantly. Stands idle (no input) while the delay counts down.
  - Verified headless (`?qa=coop`): at 5s only partway through the first slice
    (was both done by ~7s before); both staged + parked at the corner by ~27s;
    `speedScale 0.5 / workMul 0.55 / reaction 0.7` confirmed wired. Files:
    `chef.js` `game.js` `helper.js` `levels.js` `qa.js`.
- 2026-06-16 — **CO-OP v0.2 (user feedback: "doesn't feel good yet").** Three
  changes to the helper:
  - **Always stock, no demand gate.** Dropped the demand-driven logic — the
    helper now keeps BOTH boards topped up regardless of orders and refills the
    instant the player takes a slice (`pickWork` = first empty staging spot;
    `demand()` + the DISHES import removed).
  - **Chef-vs-chef collision.** Player and helper can no longer slide through
    each other: `game.resolveChefCollision()` runs each frame after both move
    and pushes them apart (axis-separated via `chef.tryMove`, MIN centre
    distance 0.92). Verified: dropping the player exactly on the helper
    separates them to 0.92.
  - **Idle in the bottom-left corner.** When both boards are stocked the helper
    walks to `coop.idle` ({col:1,row:4}) and waits there, out of the player's
    way (new `toIdle`/`idle` states + `goToTile`/`navigate` floor-tile nav;
    `reset()` now routes to `toIdle`).
  - Also **unlocked Level 4** in the grid (`ui.js` gate `i>=3`→`i>=4`) so the
    co-op test is reachable without starring Level 3 first.
  - Verified headless (`?qa=coop`): 0 tickets → both slices staged; take cheese
    → refilled; helper idles at {1,4}; collisionSep 0.92. Files this pass:
    `helper.js` `game.js` `levels.js` `ui.js` `qa.js`.
- 2026-06-16 — **CO-OP MODE v0: Level 4 + a BOT kitchen helper (first
  multiplayer experiment).** Per the user's brainstorm: co-op is the first
  multiplayer; bots NEVER do the dishes (grammar stays 100% with the human).
  - **Level 4 "Burger Bar Co-op"** (`levels.js`): an exact copy of Burger Bar
    (same map / crates / orders / plates / starTimes) + a new `coop` config
    block. Took the menu's Level 4 slot (removed the `lv4` placeholder; gating
    unchanged → unlocks once Level 3 has ≥1★). The `coop` block is code-side
    only — it does NOT touch the editor JSON/grid schema (data-shape freeze
    respected; the parallel restaurant-editor session is untouched).
  - **The helper** (`src/helper.js`, new): a SECOND `Chef` driven by a small
    state machine `idle→toCrate→toBoard→chopping→toStaging`. It owns the two
    cutting boards — left (col 2) = lettuce, right (col 4) = cheese — fetches
    raw from the crates, chops on its board (reuses the two-stage chop logic),
    and parks the slice on the counter to the RIGHT of that board (col+1:
    col 3 / col 5). Two rules the user chose: **demand-driven** (only cuts what
    the on-screen tickets need — cheese for cheese/big burger, lettuce for big
    burger; higher demand first) and **par=1** (≤1 slice staged per board, then
    it idles — no overproducing). It NEVER cooks/plates/serves/washes. Nav is a
    4-connected BFS over `world.walk` + a steer-to-tile (mirrors touch.js).
  - **The "second seat" seam:** `Chef` now takes an optional `chefAssets` arg so
    the helper uses a DIFFERENT character (knight) than the player (rogue) —
    `game.preload` loads it via `loadChefAssets` when `level.coop` is set. The
    helper's "brain" is swappable: a remote human could later drive the same
    seat. `game.update` calls `helper.update(dt)` after `workStations`; it
    pauses with the kitchen during sink questions / round-over; the board's
    resting knife hides while the helper chops (extended the tool-hide line).
  - **Verified** headless (Edge `?qa=coop`, seed 42, 14s tick): boots clean,
    `inScene:3` (world + 2 chefs), both spots staged `lettuce_chopped` +
    `cheese_chopped`, helper ends `idle` empty-handed (par=1 held). Screenshot
    shows both slices to the right of their boards. New `?qa=coop` QA scene.
  - **Open / next:** helper char clashes if the player also picked knight (rare;
    make it pick a non-player char if it matters); no inter-chef collision
    avoidance yet (they can overlap — fine for the test); the human can still
    use the boards if they want (not needed for burgers); star thresholds
    copied from L2, untuned for two cooks. Files: NEW `src/helper.js`;
    `src/chef.js` `src/game.js` `src/levels.js` `src/qa.js`.
- 2026-06-11 — Brief written by the master session. Nothing built yet.
- 2026-06-11 — Restaurant Bits **EXTRA pack landed and verified** in
  `/assets/KayKit/KayKit_Restaurant_Bits_1.0_EXTRA/` (225 gltf models,
  self-contained, single atlas `restaurantbits_extra.png`). Assets
  section updated with the real model inventory — no placeholder
  primitives needed, build asset-first from day one.
- 2026-06-11 — **PoC v1 built and verified.** Full game playable:
  3 levels (Garden Bistro / Burger Bar / Pizzeria w/ style-B kitchen)
  + Sundae Sunday teaser tile, complete order pipeline, sink-quiz wash
  loop with spaced re-asks, burn/expiry paths, stars + gating, save
  (`krabsy_vkitchen_save` v1), WebAudio SFX incl. alarm + frantic layer.
  - **Layout:** `index.html` + `src/` (main, game, world, levels, chef,
    stations, orders, recipes, sink, fx, ui, audio, verbs, models, qa).
    Art is data-table-driven: item/dish→model maps in `recipes.js`,
    level maps as ASCII grids in `levels.js`. Assets copied (filtered,
    no `*Zone.Identifier`) to `assets/models/{restaurant,chef}/` —
    **gitignored** via local `.gitignore`; chef = Knight.glb + Rig_Medium
    clips (Idle_A/Running_A/Chopping retarget fine).
  - **Verified programmatically** via `window.__VK` (preview_eval):
    full pipelines L1 salad → serve → dirty → wrong-then-right wash;
    L2 cook/burn/trash, expiry combo-reset, question pause (cook frozen,
    clock frozen, patience ~30%); L3 dough→roll→sauce→top→bake→plate→
    serve. Save round-trip + star gating asserted. Zero console errors.
    Perf: ~3.8 ms/frame at max chaos, 16 draw calls (static merge).
  - **Screenshots:** headless Edge against `?qa=` scenes works
    (`level1|level2|level3|question|burn|stars`, `&seed=` for
    determinism). NOTE: preview-panel rAF suspends when backgrounded —
    drive time with `__VK.tick(s)`, don't wait wall-clock.
  - **Known cosmetics (minor):** order-window wall piece aligns to even
    2-tile slots so the hatch window can sit half a tile off; baked
    pizzas reuse `food_pizza_*_plated` (plate baked into model) so a
    plated pizza shows a double plate; burnt pizza = dark-tinted model.
  - **Next (v1.1 candidates):** playtune star thresholds from real
    playthroughs, touch controls, DE/ES UI, sundae level.
- 2026-06-11 — **Pacing pass (user feedback) + quit button.** Cook/bake
  times +50% (patty 10.5s, pizza 13.5s), patty burn window 8→12s,
  ticket patience +50% (112/128/150). HUD 🏠 button quits to level
  select (closes quiz, clears tickets, stops audio). All re-verified
  via __VK; star thresholds NOT retuned yet — slower pipelines mean
  lower scores, so thresholds likely need a playtest-based pass.
- 2026-06-12 — **Burger Bar fixes (user feedback).** Salad removed from
  the L2 ticket pool (it needed tomatoes the level doesn't stock);
  replaced by **Big Burger** (bun+patty+lettuce+cheese, 40🪙, w:1).
  Plating is now **free-build** (`canPlate` replaced `canExtend`): any
  plateable ingredient goes on a plate regardless of active tickets —
  only exact duplicates and >5 stacks are blocked; unservable plates
  are emptied at the trash. Verified: pool sampling, free build,
  dupe-block, junk-plate trash, bigburger match + serve.
- 2026-06-12 — **SESSION WRAP (v1.4, big polish day).** State: game is
  feature-complete and playtested-by-user through the Pizzeria. Today's
  batch (each detailed below, newest→oldest): compact kitchens w/
  storage islands on every level; pizzeria simplified (cheese/mushroom
  only, hot pizza needs a plate, +5 in-order serve bonus); pizza scale
  pass + slice-by-slice loading screen; board-item alignment +
  staccato chop (windowed clip, knife edge-down, in-hand tools via
  `handslotr`); rack turned 90°; carry anchor raised (visibility);
  character select (5 KayKit adventurers, `krabsy_vkitchen_char`);
  dough rolls on any cutting board. All verified via __VK + headless
  Edge; zero console errors. HEAD = `2d091c0`.
  - **Open items for next session:** star thresholds still untuned for
    the slower pipelines + new bonuses (needs playtest pass); raw
    pizza on plates question deferred by user (plate use rethink);
    L2 patties/burger flow untouched today — re-playtest after the
    map shrink (spawn rates may now be generous); music not yet
    reviewed by ear; touch controls / DE-ES UI / sundae level still
    on the v1.1+ list. Two known workflow gotchas: preview panel
    caches ES modules (fetch {cache:'reload'} then reload) and
    headless-Edge screenshots need the temp-profile trick.
- 2026-06-14 — **CLEANED UP + deployed clean.** Reverted all dev-network
  workarounds: index.html back to normal per-file loading (`<script
  type=importmap>` three→`./vendor/`, `<script type=module src=src/main.js>`),
  renamed `src/main-v9.js`→`src/main.js`, removed the 1.2 MB inline bundle, the
  on-device diagnostic overlay + probe, and the diag cruft in main.js (restored
  the simple `new THREE.WebGLRenderer`). KEPT the legit session work: tap()
  (pointerup+click) on menu buttons/cards, the audio blur/visibility pause, the
  d-pad removal, the level-grid scroll fix. **Softlock fix:** `ui.showTutorial`
  now `.catch()`es the preload promise so a failed/404 asset can't freeze the
  loading screen (button shows regardless). index.html back to ~23 KB; verified
  live (small HTML, module entry, no diag). Headless `?qa=level1` renders,
  `preload_misses=0 js_errors=0`; preview boots + navigation works. STILL TODO
  (infra, not game): origin `Cache-Control: no-store` so the game also works on
  the one tablet's filtering+caching wifi proxy (and remember that tablet's
  browser cached the old 404s — needs a cache clear / incognito there).
- 2026-06-14 — **RESOLVED: game runs fine on a normal phone.** User confirmed
  the game loads + plays with no issues on their phone. So the code/assets/deploy
  are all correct — the entire multi-round saga was ONE tablet's environment: its
  wifi proxy breaks external script + asset loads, and its browser then cached
  those 404s (per-device cache, so they persisted even after switching to mobile
  data; an incognito tab / cache-clear is needed there). NOT a game bug.
  - **Cleanup plan (revert the dev-network workarounds):** restore index.html to
    normal per-file loading (`<script type=importmap>` + `<script type=module
    src=src/main.js>`), rename `src/main-v9.js`→`src/main.js`, remove the inlined
    1.2 MB bundle, the redirect, the on-device diagnostic overlay + probe. The
    game works on normal devices without any of it.
  - **TODO robustness:** make `ui.showTutorial` proceed if the recipe image
    fails to load (today a failed image softlocks the loading screen — any
    single bad asset shouldn't block the game).
  - **Tablet-on-its-wifi** still needs the origin `Cache-Control: no-store`
    header (Coolify/brocco-dev) to work there; that's the only thing that beats
    that proxy. Environmental, not blocking the game elsewhere.
- 2026-06-14 — **Tablet, round 12 — CONCLUSION: it's the network proxy; needs a
  SERVER header. Game code is DONE.** With the code fully inlined (round 11) the
  game now boots + the menu works on the bare URL; clicking a level then 404s the
  ASSET fetches (`assets/models/restaurant/floor_kitchen.gltf`, `assets/ChatGPT/
  Salad.png`). Verified the ORIGIN serves every asset 200 (gltf/bin/atlas/png/
  glb) — so it's the proxy 404-poisoning assets too, exactly like it did the JS.
  It plays fully under `?debug=1` (that address has good copies cached in the
  browser). After 12 rounds (path bumps, query bumps, referer redirect, inline
  shim, full inline bundle) the verdict is definitive: this specific network runs
  a proxy that globally caches the brief 404s from each Coolify deploy and serves
  them stale with no revalidation — **no client-side change clears it.** THE fix
  is server-side: make the dev origin (Coolify → `brocco-dev`, nginx) send
  `Cache-Control: no-store` (or `no-cache`) on everything, so that proxy stops
  caching `dev.brocco.run`. That's infra/master-session territory (the brocco-dev
  nginx/Coolify config), NOT the game folder. STOPPED deploying (each deploy
  poisons more). Once the header is in: revert the inline-bundle hack + the
  diagnostic/probe back to clean per-file `src/` loading + `main.js`. Game itself
  is verified correct on every other path (preview, headless, `?debug=1` on the
  tablet). The referer-redirect (round 10)
  also failed (`main-v9` 404 even under a fresh `?cb`), so the proxy's behaviour
  isn't cleanly referer-keyed — it breaks/poisons external JS by mechanisms I
  can't fully model. Stopped fighting it: bundled `src/main-v9.js` + all modules
  + THREE into ONE IIFE with **esbuild** (`npx esbuild … --bundle --format=iife
  --alias:three=vendor/three/three.module.js` + addon aliases; built from a
  Windows temp copy because esbuild treats `//wsl.localhost` UNC as an external
  URL), then INLINED that 1.2 MB bundle into index.html as a single classic
  `<script>` (PowerShell surgery: removed the redirect, the importmap-shim, the
  inlined es-module-shims, and the module-shim entry; injected the bundle;
  bumped `vendor-11`). The ONLY external requests left are GLTF assets at
  runtime (GLTFLoader uses fetch → works). The document loads reliably on the
  tablet (the diag box always showed the current build), so a fully-inlined
  document = the whole game with nothing for the proxy to 404/block/mangle.
  index.html is now ~1.28 MB. Verified: preview boots+navigates; headless
  `?qa=level1` renders the full 3D kitchen, `js_errors=0`. **To rebuild after a
  code change:** re-run the esbuild bundle (temp-copy trick) + re-inline (the
  PowerShell snippets in this session). Once the origin gets `Cache-Control:
  no-store`, revert to the normal `src/` module loading + `main.js`.
  Decisive clue from the user: the game FULLY PLAYS under `?debug=1` but the bare
  URL throws `TypeError 404 main-v9`. Same build, same files — only the document's
  query differs. ⟹ the proxy keys its subresource cache by the requesting page's
  full URL (referer); the bare URL's referer-cache holds poisoned deploy-window
  404s, while any `?query` address has its own clean cache (that's why `?debug=1`
  works). FIX: first inline script in index.html redirects the bare URL to
  `?cb=<Date.now()+rand>` (skips if `cb`/`debug` already present) → every visit
  uses a FRESH referer the proxy has never poisoned, self-healing per load. Runs
  before any subresource loads (so the poisoned bare referer is never even used).
  diag → `vendor-10` (now also prints `location.search`). Verified preview: bare
  URL → bounces to `?cb=…` → boots + navigates. This is the consequence of the
  user's own observation (any query works), not another guess. Permanent cure
  still = origin `Cache-Control: no-store` (then drop this redirect + the
  inline-shim + revert to main.js).
- 2026-06-14 — **Tablet, round 9: inline shim RAN (good) but the entry path was
  proxy-cached as a 404 → fresh path `main-v9.js`; the recurring cause is the
  COOLIFY DEPLOY WINDOW.** vendor-8 inlined shim worked (no syntax error) but
  threw `TypeError 404` fetching `src/main-v6.js` + the 15 s watchdog
  ("shim-mode fetch failed/slow"). Root: every Coolify redeploy briefly 404s the
  files while it swaps them; this network's proxy caches that 404 (query-
  stripped, no revalidation), so whatever PATH the entry has gets poisoned by a
  deploy the user reloaded during. Renamed entry `main-v6.js`→**`main-v9.js`**
  (index entry + probe + build marker `vendor-9`) and polled the origin until
  `main-v9.js`=200 + `vendor-9` for **5 consecutive checks (~1 min)** before
  telling the user to reload, so the proxy's first fetch is a settled 200.
  **This will recur on EVERY future deploy** unless the dev origin sends
  `Cache-Control: no-store` on JS/HTML (Coolify/nginx — the real cure; the
  origin currently sends none, only Etag/Last-Modified). Escalated to the user.
  Game CODE is confirmed correct (inline-shim shim-mode boots in preview every
  build); the saga is 100% this network's caching/▸script-mangling proxy.
- 2026-06-14 — **Tablet, round 8: es-module-shims.js itself was served as an
  HTML block page → INLINE the shim.** vendor-7 (shim loaded via fetch→blob)
  threw `Uncaught SyntaxError: Unexpected token '<'` at a blob — the proxy
  returned an HTML block page for `vendor/es-module-shims.js` (the one file the
  probe hadn't covered), so the blob held HTML. FIX: stop fetching the shim —
  **inline its 63 KB source directly into index.html** (a `/*__ESMS_INLINE__*/`
  placeholder swapped at edit time via PowerShell, UTF-8 no-BOM; inline scripts
  always run, like the diag box). The inlined shim then fetch()es the game
  modules (proven clean). Also expanded the `?debug=1` probe to ALL 21 modules,
  reporting only non-200/HTML ones + a `probe: N/21 clean JS` summary. diag →
  `vendor-8`. Verified preview: inlined shim parses + boots + `21/21 clean JS`.
  If the tablet STILL fails, the probe summary now names the exact blocked
  module. (NOTE: index.html is now ~91 KB with the inlined shim — fine.)
- 2026-06-14 — **Tablet ROOT CAUSE (real one): the proxy breaks external
  `<script>` loads but allows `fetch()` → load the game via es-module-shims
  SHIM MODE.** The on-device `?debug=1` fetch-probe was decisive: ALL files
  (`main-v6.js`, `three.module.js`, `game.js`, `GLTFLoader.js`) return
  `200 · application/javascript [js?]` via `fetch()` — clean JS, no 404, no
  block-page — YET the `<script type=module>` load of the entry kept failing
  (and earlier the external `es-module-shims.js` classic `<script>` failed too).
  So it's NOT caching/CDN/MIME/old-browser — the proxy mangles/blocks external
  `<script>` subresource requests while letting `fetch()` (and inline scripts)
  through. FIX (index.html): load EVERYTHING via es-module-shims **shim mode**
  (it fetch()es modules + instantiates via blob URLs — no network `<script>`):
  `window.esmsInitOptions={shimMode:true}`, the import map is now
  `type="importmap-shim"`, the entry is `type="module-shim" src=src/main-v6.js`,
  and es-module-shims ITSELF is loaded by fetch()ing `vendor/es-module-shims.js`
  and running it from a `Blob` URL (an external `<script src>` for it would be
  broken too). Watchdog 6s→15s (shim-mode fetches the whole graph incl. 1.2 MB
  three). diag → `vendor-7`. Verified preview: forced shim mode boots + renders
  + navigates (`main.js: start`/`renderer ok`/`boot ok`). Relies ONLY on fetch+
  blob, both proven to work on the tablet. NOTE: keep the diagnostic + probe
  until the user confirms; the per-deploy path bumps (main-vN) are now moot
  (fetch wasn't the cache-poisoned path) but harmless — can revert to main.js
  once confirmed. REAL infra cure is still understanding/relaxing that network's
  proxy, but this sidesteps it entirely from the client. The tablet's diag
  showed the unique `…main.js?cb=<rand>` URL ALSO `✗ load failed`, so the proxy
  ignores the query for .js and keeps mapping every variant back to the one
  poisoned `src/main.js`. The only client lever left is the file PATH. FIX:
  renamed `src/main.js` → **`src/main-v5.js`** and load it via a static
  `<script type="module" src="src/main-v5.js">`. A brand-new path only exists
  once the deploy is fully live, so the proxy can't already hold a poisoned copy
  of it; it caches it as a clean 200 and revalidates via Etag thereafter (the
  rest of the graph — game.js/etc. — was never poisoned). Bump to `main-v6.js`
  only if a future deploy window re-poisons it. diag → `vendor-5`. Verified
  preview: entry req = `/src/main-v5.js`, boots + navigates. **Confirm the
  origin serves `/src/main-v5.js` 200 + `build=vendor-5` BEFORE telling the user
  to reload, so the proxy's first fetch of the new path hits a settled origin
  (a mid-deploy fetch is what poisons paths).** PERMANENT cure still =
  server `Cache-Control: no-store` on the dev origin (master/Coolify).
- 2026-06-14 — **Tablet, round 5: static `?v=3` ALSO got poisoned → per-load
  cache-bust token (then superseded by the path bump above).** The tablet's diag showed the
  `?v=3` URLs ALSO `✗ load failed` — so a FIXED URL (any version) gets poisoned
  by the proxy if first fetched during a deploy window. FIX: the entry is no
  longer a static `<script src>`; an inline classic script injects
  `src/main.js?cb=<Date.now()+random>` — a UNIQUE url every page load, which the
  proxy can never already hold. Also DROPPED es-module-shims (the other poisoned
  resource; target devices are Chromium/Safari-16.4+ with native import maps —
  re-add vendored+tokened only if a real no-import-map browser shows up). three
  stays a static local import-map entry (it was never in the poisoned set). diag
  build marker → `vendor-4`. Verified preview: `main.js?cb=<unique>` per load,
  no es-module-shims request, three from `/vendor/`, boots + navigates.
  CAVEAT: relies on the proxy keying its cache by query string (the `?debug=1`
  evidence says it does). If it STRIPS queries on JS, the next step is a
  per-deploy PATH bump (e.g. `main-v5.js`). REAL cure remains a server
  `Cache-Control: no-cache`/`no-store` header on the dev origin (nginx has none
  now — only Etag/Last-Modified) — a Coolify/master task.
- 2026-06-13 — **Tablet, round 4: caching proxy poisoned the bare URL →
  cache-bust `?v=3`.** After self-hosting (round 3), the diag on the tablet
  showed the failing URLs were SAME-ORIGIN (`✗ load failed › /src/main.js`,
  `› /vendor/es-module-shims.js`) AND — the tell — the game WORKS at
  `…/?debug=1` but not the bare URL. Identical subresource URLs, only the doc
  query differs ⇒ a **TLS-intercepting caching proxy on that network cached a
  broken copy of the bare URL's two `<script>` resources** (poisoned during the
  mid-deploy window; the graph fails at `main.js` so `game.js` etc. were never
  fetched, hence only those two errored). I verified from here the live origin
  serves all of them 200. FIX: version the referenced script URLs so the
  (freshly-served) index.html points at URLs the proxy has never seen:
  `vendor/es-module-shims.js?v=3`, importmap `three`→`…three.module.js?v=3`,
  `src/main.js?v=3`; diag build marker → `vendor-3`. Verified in preview
  (`build=vendor-3`, the 3 `?v=3` URLs fetched, boots, navigates, no errors).
  NOTE: relative imports inside `main.js` (game.js/ui.js/…) don't carry the
  query, but they weren't poisoned (loaded fine under `?debug`), so they're
  fine. **Proper long-term fix is server-side `Cache-Control: no-cache` on HTML
  (+ hashed asset names) — a Coolify/master-session task; bump `?v=N` on each
  deploy until then.**
- 2026-06-13 — **Tablet dead-menu ROOT CAUSE FOUND + FIXED: THREE.js is now
  SELF-HOSTED (no CDN).** The on-device diagnostic (round 2) paid off — the
  tablet's `?debug=1` box reported: UA `X11; Linux x86_64 … Chrome` (a Chromium
  that DOES support import maps), `webgl=true`, a **"resource load error"**, and
  **"main.js never executed."** On Chromium the only way `main.js` doesn't run
  is a module in its graph failing to LOAD → the lone external module is THREE
  from **cdn.jsdelivr.net, which that tablet's network blocks** (the phone is on
  a network that reaches it). FIX: vendored THREE locally under
  `games/verb-kitchen/vendor/` (relative paths, NOT a CDN):
  `vendor/three/three.module.js` + `vendor/three/addons/loaders/GLTFLoader.js`
  + `…/utils/BufferGeometryUtils.js` (GLTFLoader's only sibling dep) +
  `…/utils/SkeletonUtils.js`, and `vendor/es-module-shims.js`. index.html
  importmap now points `three`→`./vendor/three/three.module.js`,
  `three/addons/`→`./vendor/three/addons/`; the polyfill `src` is local too.
  VERIFIED: preview shows `jsdelivrRequests:[]` (all 5 files served from
  `/vendor/`), boots, renders the full 3D kitchen, navigation works; headless
  with `--host-resolver-rules="MAP cdn.jsdelivr.net ~NOTFOUND"` →
  `js_errors=0 preload_misses=0` (no jsdelivr touched). **Caveat:** Google
  Fonts (fonts.googleapis.com) is still a CDN — if that network blocks it too,
  the game still works but falls back to system fonts; self-host the woff2s if
  the exact look matters there. The diagnostic overlay + `tap()` fallback from
  round 2 are KEPT (dormant on a healthy load; box only shows on error or
  `?debug=1`). NOTE for release: the OTHER Krabsy 3D games still use the CDN
  import map — they'll have the SAME failure on such networks; self-host them
  too (or host three at the site root) when releasing.
- 2026-06-13 — **Tablet dead-menu, round 2: on-device diagnostics + tap
  fallback** (es-module-shims alone did NOT fix it). Can't read the tablet's
  console, so instrument the page to report on itself.
  - **On-device diagnostic overlay** (`index.html`, inline CLASSIC script so it
    runs even if the ES module fails): a `window.__diag` + `error`/
    `unhandledrejection` capture + a 6s watchdog that prints "main.js never
    executed" if the module didn't run. Shows the tablet's **UA** +
    `importmap`/`esmodules`/`webgl` support booleans. Detailed status gated by
    `?debug=1`; genuine errors always show (red box, tap to hide). `main.js`
    logs milestones (`main.js: start`, `renderer ok`/`✗ WebGL failed`,
    `boot ok`, `Play tapped`/`Characters tapped`). This will pinpoint whether
    it's module-load (import map), WebGL, a runtime error, or a click that
    doesn't fire.
  - **Robust `tap()` fallback** (`main.js` + `ui.js`): bind `pointerup`
    (touch/pen) alongside `click`, deduped — covers tablets that don't deliver
    a `click` after a touch (which would leave buttons looking pressed but
    inert). Applied to all menu buttons (play/chars/back/quit/retry/next/menu/
    shopBack) AND the level + character cards. A real fix IF the cause is the
    click; otherwise harmless and the diagnostic still tells us the cause.
  - Verified on modern Chromium: full boot chain logs, navigation via tap()
    works (Play→level, Characters→shop), `js_errors=0`. **Awaiting the user's
    `?debug=1` readout from the tablet** to confirm the cause.
- 2026-06-13 — **Two mobile fixes: level-grid scroll + start-menu dead on
  older tablets** (user feedback from phone + tablet).
  - **Level select clipped / unscrollable on phone** (`index.html` CSS): the
    `.screen`s used `justify-content:center` with NO overflow, so on a short
    landscape phone the level grid overflowed and the TOP row (logos) was
    clipped with no way to scroll. FIX: `.screen{justify-content:flex-start;
    overflow-y:auto; -webkit-overflow-scrolling:touch}` + auto-margin centering
    (`.screen>:first-child{margin-top:auto}` / `:last-child{margin-bottom:auto}`)
    — centres the stack when it fits, scrolls with the TOP reachable when it
    overflows (justify-content:center clips the top of overflow and can't scroll
    back). Plus a `@media (max-height:560px)` pass shrinking logo/how-to/level &
    char cards so the grids need less scrolling. Verified at 740×360: grid
    scrollable, first row + heading reachable at top, Back button reachable at
    bottom; start screen still centred at 1024×768.
  - **Main menu buttons did nothing on the tablet (only)** (`index.html`): the
    game boots via a bare `import … from 'three'` resolved by
    `<script type="importmap">`, with no polyfill. Import maps need Safari 16.4+
    / Chrome 89+ — an older tablet browser fails the bare-specifier resolution,
    so the WHOLE module graph never runs: the static HTML menu renders and the
    buttons show their CSS `:active` "move", but no click handler is ever
    attached → nothing happens (phone = newer browser → works). FIX: added the
    **es-module-shims** polyfill (`@1.10.0`, `async`, before the importmap) — a
    no-op where import maps are native (verified: modern Chromium still uses
    native maps, boots, navigation Play→level / Characters→shop / Back works,
    `js_errors=0`). HYPOTHESIS pending the user's tablet retest — if it's NOT
    import-map support, need the tablet's browser/OS + console to pin it (could
    instead be WebGL-context failure, which would also halt `main.js` at the
    renderer line before the button handlers register).
- 2026-06-13 — **Two bug fixes: tap-after-chop pickup + audio stops when
  unfocused** (user feedback; verified + adversarially reviewed before push).
  - **Touch chop→pickup race** (`touch.js`): after holding a board to chop,
    a quick tap on that same board (chef already standing there) re-started a
    chop instead of picking up the chopped item — because the old `pendingHold`
    flag is true for the whole touch, and when already adjacent the arrival
    (`doArrive`) fired before touchend → always chopped. FIX: tap-vs-hold is now
    decided by DURATION (`HOLD_MS=200`). A board chops only on a sustained hold;
    a quick tap runs `game.interactE()` (board `!held && st.item` branch → pick
    up). When arrival is instant but the touch is still down < HOLD_MS, it
    `chopArmed`s and `resolveArm()` (run every rAF tick + QA `step()`) decides:
    released first → tap (pickup); held past HOLD_MS → chop. `resolveArm` drops
    a pending arm if `running/roundOver/questionOpen` changed mid-window (the
    closure outlives the round, so a stuck arm would leak into the next one);
    `navEnd` is intentionally NOT reset (the arm must survive release so the tap
    resolves to a pickup). New `__touch.armed()` hook.
  - **Audio kept playing when tab hidden / window blurred** (`audio.js` +
    `main.js`): music is a `setInterval` scheduler that ran on regardless. FIX:
    `_inactive` flag + `_applyMaster()` → master gain 0 when `(muted ||
    _inactive)`; `setActive(active)` toggles it (+ `resume()` on activate).
    main.js wires `visibilitychange`/`blur`/`focus` →
    `setActive(document.hasFocus() && !document.hidden)`, calls it once at
    startup (correct state if loaded backgrounded), and resumes a suspended ctx
    on the first `pointerdown`/`keydown` (mobile gesture requirement). Gain-mute
    (not node teardown / ctx.suspend) so the still-running loop never piles up
    events → no burst on return.
  - **Adversarial review** (3-agent workflow) flagged: stuck-`chopArmed` on
    round/quiz change (fixed via `resolveArm` guard — NOT the reviewer's
    `navEnd` reset, which would've broken tap→pickup), missing startup
    `setAudioActive` (added), QA-hook chop-cancel fidelity (added), mobile
    resume gesture (added). Known nuance (NOT changed): on the iframed
    production site, `blur` also fires when the player clicks the parent page →
    music pauses until they click back into the game (acceptable; standalone
    dev build + phone behave exactly as asked).
  - Verified via __VK/__touch: tap→pickup, hold→chop, arm-drops-on-question,
    arm-drops-on-roundOver (no cross-round leak), audio gain 0↔0.5 on
    active/blur/mute, resume fires on gesture; keyboard `d`→{x:1} unchanged;
    fresh headless `?qa=level1`+`?qa=chop` `preload_misses=0 js_errors=0`.
- 2026-06-13 — **D-pad scrapped — tap-to-move is the only touch input** (user:
  "the point and click pathfinding I like way way way better than the d-pad.
  Remove the d-pad completely. Scrap it."). `touch.js` rewritten to tap-to-move
  ONLY: no joystick (`#padZone/#padBase/#padKnob`), no Pick/Drop+Chop buttons
  (`#tBtnE/#tBtnChop`), no mode toggle (`#ctrlToggle`), no `body.touch /
  ctrl-tap` gating, no `?ctrl/?touch` aids. Kept the verified
  pickTile→BFS→steer→doArrive nav (tap = walk + `game.interactE()`; hold a
  board = walk + `keys[' ']` chop while held). Canvas touchstart listener is
  now always active during play. Removed all dead d-pad markup + CSS from
  index.html (`#touchControls` block, `#ctrlToggle` button, their CSS,
  `body.touch/ctrl-tap` rules); reverted `#muteBtn,#quitBtn,#ctrlToggle` →
  `#muteBtn,#quitBtn`; KEPT `#app{touch-action:none}`. Keyboard + game logic
  untouched. Verified: zero dangling refs (grep), dead DOM gone, `__touch`
  exposes only tap hooks, `onKey('d')`→`keys.d`→`inputVector{x:1}` unchanged,
  touch still feeds the SAME `game.keys` (tap far crate → `keys.a`), board
  hold/release toggles chop, fresh headless `?qa=level1` `preload_misses=0
  js_errors=0` + clean HUD screenshot (no 🕹️ toggle).
- 2026-06-13 — **Reverted the rotate-to-landscape overlay** (user: "doesn't
  really work, go back to not forcing anything"). Removed `#rotate` markup +
  CSS from index.html; nothing else touched. Game now plays in any orientation
  on touch; the touch controls + `body.touch` gating are unchanged.
- 2026-06-13 — **Two control modes + tap-to-move + rotate prompt + Later
  removed.** All additive — keyboard + game logic untouched.
  - **Rotate-to-landscape overlay** (`#rotate`, z90): pure CSS — shows on
    `body.touch` in portrait, hidden via `@media (orientation: landscape)`.
    Covers everything (game must be played landscape on touch).
  - **Removed the quiz "Later" button** (markup + sink.js handlers + the
    `· Esc to leave` hint). NOTE: on touch you now commit to washing one
    plate once the sink quiz opens (the quiz covers the 🏠 quit button) —
    offer a tap-outside-to-close if the user wants an escape.
  - **Tap-to-move mode** added to `touch.js` alongside the d-pad. Raycasts a
    tap → tile (prefers a real mesh hit, falls back to the y=0 plane);
    4-connected BFS over `world.walk`; steers the chef along the path by
    setting the SAME `game.keys` w/a/s/d. Station tap → walk to an adjacent
    tile, face it, `game.interactE()` (pick/drop/serve/sink — all via the
    existing method). Floor tap → just walk. **Hold on a cutting board** →
    walk there + `keys[' ']=true` while held (chops via workStations),
    release clears. Own nav rAF (no game.update edit).
  - **HUD toggle** `#ctrlToggle` (🕹️ ↔ 👆, `#topRight`, `body.touch` only):
    switches mode mid-level, persisted `krabsy_vkitchen_ctrl` (default dpad).
    `body.ctrl-tap` hides the joystick + action buttons and disables `#padZone`
    so taps reach the canvas. Switching clears all transient input state.
  - QA hook `window.__touch` (setMode/tapTile/holdTile/step/getNav/chopping).
    `?ctrl=tap|dpad` + `?touch=1` test aids. Verified via __touch+__VK pump:
    tap crate from afar → walk + pick up lettuce; tap floor → walk only; hold
    board → chop while held (progress advances), release stops; toggle
    restores d-pad + clears nav; keyboard `d`→{x:1} unchanged in both modes;
    fresh headless `js_errors=0`.
- 2026-06-13 — **Touch controls (mobile/tablet) — purely additive.** New
  `src/touch.js` (`initTouch(game)`, called once in main.js) routes touch into
  the SAME input state the keyboard uses — NO game logic touched, keyboard path
  unchanged (`onKey`/`inputVector`/`workStations` not edited).
  - Floating joystick on the LEFT half (`#padZone`): touchstart = origin, move
    sets `game.keys.w/a/s/d` via a per-axis cut (8-way, diagonals — matches the
    keyboard model), 15px dead zone; touchend clears. Visual base+knob (rgba).
  - RIGHT-side fixed buttons: **Pick/Drop** → `game.interactE()` (edge, guarded
    by running/!roundOver); **Chop** → `game.keys[' ']=true` + `spacePress()` on
    touchstart, `false` on touchend → workStations chops while held, identical
    to the key.
  - Shown only on touch (`matchMedia('(pointer:coarse)')` or first touchstart →
    `body.touch`; `?touch=1` test aid) AND only during play (markup lives in
    `#hud`, z22 < quiz z30 so covered during the quiz). Landscape: pad bottom-
    left, buttons bottom-right, 94–104px. Perf: rgba + transform/opacity only,
    NO blur/filter/animated shadows. `touch-action:none` on `#app` + controls,
    `passive:false` + preventDefault on the control touch events.
  - Files: NEW `src/touch.js`; `index.html` (#touchControls markup + CSS +
    `#app` touch-action); `src/main.js` (import + `initTouch(game)`). Verified
    via synthetic touches: drag→keys (diagonals), chop hold sets/clears
    `keys[' ']`, pick fires interactE once; keyboard re-tested identical; fresh
    headless `preload_misses=0 js_errors=0`.
- 2026-06-13 — **Character shop (star-unlocked, threshold) + 3D portrait
  cards.** Per user Q&A: stars are a THRESHOLD (never spent) and cards show
  rendered 3D portraits. Rogue is the free starter; others unlock when TOTAL
  stars reach a per-character `cost`.
  - **models.js:** `CHEF_CHARACTERS` reordered rogue-first + `cost`
    (rogue 0, ranger 3, knight 6, mage 9, barbarian 12 — PLACEHOLDERS).
    New `totalStars(save)` + `charUnlocked(name,save)` (= total ≥ cost).
    No new save field — unlock is derived (stars never decrease, so nothing
    re-locks); only the selected char (`krabsy_vkitchen_char`) is validated
    (falls back to rogue if not unlocked). Default char everywhere → rogue.
  - **portraits.js (new):** offscreen alpha `WebGLRenderer` renders each
    character to a cached dataURL (`characterPortrait(name)`). Posed in the
    **idle stance** (arms down — short AnimationMixer + Idle_A, `update(0.6)`),
    framed head + shoulders/upper body (camera back 1.78·h, aim max.y−0.24·h).
    Render block is sync after the `loadChefAssets` await, so no scene race.
  - **Shop screen** (`#shopScreen`, `ui.renderShop`): portrait card per
    character, sorted by cost; unlocked = selectable (✓ Selected / Select),
    locked = greyed portrait + 🔒 + ⭐cost; total-stars header. Start screen's
    old pill row replaced by a **🧑‍🍳 Characters** button → shop; `← Back`.
    Old `.char-btn`/`#charRow` removed.
  - Verified via __VK + headless: 7★ → rogue/ranger/knight unlocked,
    mage(⭐9)/barbarian(⭐12) locked; all 5 portraits render (64–94KB);
    click unlocked = select+persist, click locked = no-op; `qa=shop` scene;
    fresh headless `preload_misses=0 js_errors=0`.
  - NOTE: rogue & ranger portraits look similar (both brown-haired, hoods
    down at head-shot crop) — offer a wider/idle-posed shot if more
    distinction wanted. Costs are placeholders to tune as levels/chars grow.
- 2026-06-13 — **Finishing always = ≥1 star.** `endRound` star calc now
  floors at 1 (`let stars = 1`, drop the s1 threshold); 2★/3★/author still
  time-gated. So 0 stars is no longer possible — completing the level always
  earns the first star regardless of time. Menu 1★ row now reads "★ finish"
  (no time) instead of the old s1 target. `starTimes[0]` kept in the data
  (array shape) but unused for award/display. Verified: 300s/180s finishes →
  1★ (was 0); 150→2, 120→3, 90→4 on burger [215,165,130,100].
- 2026-06-13 — **Cheese-slice layering fix.** `food_ingredient_cheese_
  slice`'s origin sits 0.087 ABOVE its geometry (`measureModel().minY =
  -0.087`, vs 0 for patty/bun/tomato), so it sank — hidden by the cutting
  board and buried in the bun bottom. Compensated for `minY` in two render
  paths in stations.js: composeBurger layers now `y - minY*S` (rest on the
  running height), and standalone ingredients (`buildItemMesh` ing branch)
  lift `-minY*scale` so they sit on the board/counter. General fix (keys
  off each model's measured minY), so any low-origin model is handled.
- 2026-06-13 — **Veggie patties (asset-only swap).** Meat → veggie:
  `patty_raw`/`patty_cooked` models → `food_ingredient_vegetableburger_
  uncooked`/`_cooked`; `BURGER_LAYER_MODELS.patty_cooked` → veggie cooked.
  Steak crate → **potato crate** (`CRATE_MODELS.patty_raw` + levelModelNames
  `crate_steak`→`crate_potatoes`). Copied the 3 gltf+bin into
  `assets/models/restaurant/` (gitignored working set; flat-reference the
  shared atlas). NO mechanic/id changes — still grab raw from the crate,
  cook, etc. (`patty_burnt` kept as `burger_trash`; item emojis 🥩/🍖 kept).
  Verified: all 3 models served (200), data wired, zero console errors.
- 2026-06-13 — **Burger overhaul (set-based, plate-less) + global QoL.**
  - **Burgers now build on the BUN as a set** (mirrors the pizza-on-dough
    system): `bun` accepts patty_cooked/cheese_chopped/lettuce_chopped →
    `burgerwip_<set>` items (generated in `buildBurgerStates`). Order-free,
    **PLATE-LESS** — you assemble in hand / on a counter; a plate is only
    needed to SERVE. A burgerwip with a complete-dish set closes with a top
    bun + carries `dish`; any other set is open-faced (buildable, not
    servable). `expandsTo` unpacks it onto a plate for dish-matching.
    `bun_patty`/`composeBunPatty` removed; stove "patty onto bun" now uses
    `combine(held, patty_cooked)` (works on a bun OR a partial burger).
  - **Renamed dishes:** `burger`→**hamburger** = bun+meat (lettuce dropped,
    now a *finished* product w/ top bun); **cheeseburger** = +cheese;
    **bigburger** = +cheese+lettuce. `isBurgerDish` + icons updated.
  - **All permutations** buildable (bun+cheese, bun+lettuce, …) and each
    finished burger is visually distinct; **fillings ~10% bigger** in
    composeBurger (scale 0.78→0.86) so patty/slice/lettuce read in the bun.
  - **L2 orders:** `[hamburger, cheeseburger, hamburger, bigburger,
    cheeseburger]` — big burger exactly once, slot 4.
  - **All levels — QoL:** (a) **return an ingredient to its OWN crate**
    (E on the matching crate; wrong crate / non-raw rejects); (b) **rack
    auto-grab**: holding a plateable + E on a rack plate grabs the plate
    WITH the item already on it (steam + dish carried).
  - Verified via __VK: 7 burgerwip permutations + order-independence;
    crate-return (right/wrong/chopped); rack-grab (bun → plate[bun],
    burgerwip → plate:cheeseburger); plate-less counter build → plate via
    rack → serve (bigburger + hamburger); stove patty→bun. Zero console
    errors. qa=level2 showcases the 3 burgers + a plate-less permutation.
- 2026-06-13 — **4-star (Trackmania-style) system + 10-level menu +
  gating.** Per user Q&A: 3 playable levels + 7 locked "coming soon"
  placeholders; numbered names ("Level N"); **no global leaderboard**
  (skipped — local per-level best times only); per-level times the metric.
  - **`starTimes` = `[1★, 2★, 3★(gold), author]`** DESCENDING seconds
    (placeholders). `game.endRound` cascades `t<=s → stars` (0–4 possible;
    0 if slower than 1★). The author (4th) time + star are HIDDEN: the
    author time shows in the menu/post only once the gold (3★) star is
    earned, and the 4th author star only renders once *earned* (never an
    empty slot). Author star = teal ★ w/ glow (distinct from gold ⭐).
  - **`levels.js`:** added `num` to the 3 real levels; replaced single
    `TEASER` with `PLACEHOLDERS` (7 entries, num 4–10, emoji hint only).
    `LEVELS` stays length 3 so nextBtn/hasNext logic is untouched.
  - **`ui.renderLevelGrid`** rewritten: numbered cards, 3 stars + author,
    best time, the 3 visible target times + author (`?:??` until gold),
    placeholders as locked teasers. **Gating CHANGED:** first 3 always
    open (was: each needs prev star); rule `locked = i>=3 && prevStars<1`
    ready for when real levels grow past 3.
  - **`ui.renderPost`:** title "Level N", 4th author star span (shown only
    if earned), `#postAuthor` line reveals the author time at gold / "Author
    star earned!" at 4★.
  - Verified via __VK: 10 cards (3 open + 7 locked); L1 4★ (author star +
    time 1:02), L2 3★ (author time revealed, no author star), L3 1★ (author
    `?:??`). Zero console errors. New `qa=menu` scene. Save still v2
    (stars now 0–4). Timer still runs during quiz (unchanged).
- 2026-06-13 — **Burger cheese = sliced (not grated).** Cheese chain now
  mirrors lettuce: whole `food_ingredient_cheese` → half-cut
  `food_ingredient_cheese_chopped` (interim) → **sliced
  `food_ingredient_cheese_slice`** (final, was `_grated`). Changed
  `ITEMS.cheese_chopped.model` + `BURGER_LAYER_MODELS.cheese_chopped` →
  `_slice`; **`PIZZA_TOPPING_MODELS.cheese` stays `_grated`** so pizza
  cheese still renders as melted/grated bits while the burger gets a real
  slice. `_slice` asset was already copied in
  `assets/models/restaurant/`; auto-added to preload via
  `itemModelNames`. Verified: chop chain intact, burger plate carries
  `cheese_chopped` (renders slice), pizza topping grated, zero console
  errors.
- 2026-06-13 — **Dishwashing juice: scrub animation + one-plate-per-
  visit + celebration.**
  - **Washing animation:** chef plays `Working_A` (generic looping work
    clip, no tool in hand) whenever `frozen` (i.e. a sink question is
    open) — `chef.js` loads the clip + the frozen branch plays it +
    `setTool(null)`. Visible through the dimmed quiz backdrop; chef keeps
    facing the sink. (Rig has many clips — Working_A chosen as the
    scrub; swap easily if a better one's wanted.)
  - **One plate per visit:** after 3 correct → plate washed → quiz CLOSES
    (no more auto-continue). Press E at the sink again to wash another —
    gives the player control over how many to wash. Partial progress
    still kept across visits (Later/Esc).
  - **Celebration on a clean plate:** `audio.washComplete()` (rising
    C-E-G-C-E fanfare + sparkle shimmer) + `ui.confetti()` (42 DOM
    confetti pieces bursting from the wash card, z50 over the quiz).
    Replaces the plain clatter at completion.
  - Verified via __VK: frozen→`Working_A` (tool null), 3 correct → 42
    confetti + dirty−1/rack+1, quiz closed despite a dirty plate
    remaining. New `qa=washing` scene (chef scrub pose at the sink).
    Zero console errors.
- 2026-06-13 — **Scoop chopped ingredients onto a held plate at the
  cutting board.** `interactE` board case: holding a (clean) plate + a
  plateable item on the board + `canPlate` ok → `plateAdd` it onto the
  plate (mirrors the oven→plate scoop), steam carried, dish re-matched,
  ding+sparkle on a match. Guards: duplicates / >5 blocked by canPlate;
  raw (non-plateable) items can't be scooped. Hint "E — add to plate 🍽️"
  ("E — take it" now only with empty hands). Verified: empty plate →
  tomato → lettuce → salad; dupe + raw both rejected; zero console errors.
- 2026-06-13 — **Recipe card IS the loading screen.** Merged the
  separate full-screen loader + recipe step into one: `game.preload` no
  longer shows `ui.loading`; `startLevel` fires `preload` and immediately
  `await ui.showTutorial(level, loadP)`. The card shows at once with the
  pizza-building animation (`#recipeLoader` + `ui.recipeLoading`) where
  the button goes; the **"Let's cook!" button only appears once loadP
  AND the recipe image have loaded** (`Promise.all`, with a cached-image
  shortcut). Scene setup moved to AFTER the card (models guaranteed
  loaded when it resolves). Full-screen `#loader`/`ui.loading` kept only
  for the `qa=loading` showcase. New `qa=recipeload` scene freezes the
  loading state. Verified (eval + headless): loading→button swap, zero
  console errors.
- 2026-06-13 — **Recipe tutorial = framed image card (replaces emoji
  diagram).** User dislikes the emoji flow; supplies own ChatGPT-made
  recipe images (copyright-safe, Overcooked as *inspiration* only).
  Images live in `games/verb-kitchen/assets/ChatGPT/` (gitignored,
  served by the dev server at `/assets/ChatGPT/…`). `level.tutorial` is
  now `{ image?, title, text }`. `ui.showTutorial` shows a wooden-framed
  card (navy bg = blends with the image's navy bg), chalk-white Fredoka
  uppercase title + chalk underline, a taped "NEW RECIPE!" tag, the
  image, and one instruction line. Salad + Pizza use `Salad.png` /
  `Pizza.png` (1570×1002, both added by the user, wired in). **Burger**
  still falls back to a clean text-only card (commented `image:` line
  ready; add `Burger.png` to switch it). Emoji `.rcard/.rico/...` flow + builder
  removed. `qa=recipe` now loads L1 (salad) for screenshots. Verified:
  image loads (naturalWidth 1570), card renders, zero console errors.
- 2026-06-13 — **Fixes batch (user feedback; "don't break Fable's
  work").**
  - **Reverted a regression:** the `ui.fade(false)` I'd added before the
    tutorial/countdown exposed the chef pre-`update()` (bind/T-pose at an
    unset position, looked like it stood on the island during loading).
    Removed it → Fable's behavior restored: the fader hides the kitchen
    through loading + countdown; the chef is only revealed once the loop
    has positioned + animated it. (Tutorial overlay is z65, above the
    z60 fader, so it still shows.)
  - **Order window aligned over BOTH hatch tiles.** Both `H` tiles were
    already `hatch` stations (verified both serve), but the window decor
    was placed on the even-tile grid → sat one tile off (over tiles 2-3
    while hatches are 1-2), so only one serving counter looked "under the
    window." `world.js` back wall now anchors the 2-wide wall pieces to
    the hatch centre (`hatchMid`) and tiles outward — window sits exactly
    over the two serving counters, no gaps, all levels.
  - **All levels start with 2 plates** (`plates: 2` for L1/L2/L3) → 5
    orders / 2 plates → 3 washes everywhere.
  - **Cut/finished items can be parked on an empty cutting board** (set a
    cut tomato down to free a hand, pick it back up). `interactE` board
    case: any ingredient onto an empty board; tool gate kept ONLY for raw
    choppables. Hint "E — set it down".
  - Verified via __VK: plates=2; both hatches serve (served 1→2); board
    park+repick of `tomato_slices`; raw `lettuce` still places. Zero
    console errors.
- 2026-06-13 — **HIGH-SCORE REDESIGN + helps + tutorial (big user
  feedback batch, on Opus).** Race-the-clock replaces time-attack.
  - **Count-up high-score mode.** Each level is a FIXED `orders` list
    (same every play → comparable times); round ends when ALL are
    served; the clock counts UP (`game.elapsed`, runs even during sink
    questions so fast verb recall pays off). Stars come from
    `level.starTimes` `[gold, silver, bronze]` seconds — **PLACEHOLDERS,
    tune from playtests** (completing always ≥1 star). `orders.js`
    rewritten: fixed queue, NO patience/expiry, ≤3 on screen, refill on
    serve, `served`/`total`/`allServed()`. Removed `roundTime`,
    `patience`, `stars` (score), `dishes`, `pickDish`, `onTicketExpired`,
    patience tip, frantic-at-30s. L1 5 orders/4 plates, L2 5/3, L3 5/2
    (orders/plates → 1/2/3 washes). Coins kept as secondary juice; TIME
    is the headline + star metric. Save bumped **v1→v2**: `best`(score)
    → `bestTime`(fastest, lower=better); stars+missed migrated, times
    reset. Level-grid + post screen now show ⏱ time.
  - **Dishwashing = 3 correct answers / plate.** `ANSWERS_PER_PLATE=3`;
    `game.washProgress` is banked GLOBALLY (kept if you leave the sink).
    `onWashCorrect()` advances 1/3, completes a plate (rack+1, dirty−1)
    only at 3, auto-continues if dirty remain. New 3-segment `#washBar`
    + `🍽️ n/3` in the quiz card (`ui.setWashProgress`); sink auto-advances
    questions on correct, `Later 🍳` button + Esc leave mid-wash keeping
    progress. So L3 = 5 orders / 2 plates → 3 washes → 9 questions:
    studying is load-bearing.
  - **Cooked patty can't be grabbed bare-handed** (stove): needs a
    **plate** (slides on) or a **bun** → new `bun_patty` composed carry
    item (`compose:'bunpatty'`, `expandsTo:['bun','patty_cooked']`),
    `composeBunPatty()` = bun_bottom+patty; `plateAdd()` unpacks combos
    on plating; `canPlate` accounts for `expandsTo`. Burnt patty still
    bare-handable → trash. Stove/oven branch in `interactE` restructured
    into 4 ordered cases (cook → take-pizza → take-patty → bare-hand).
  - **Help bubbles:** `fx.bubble(worldPos, emoji)` — throttled DOM
    speech bubble; oven shows 🍽️, stove shows 🍽️🍞 when you try to grab
    hot food without a carrier.
  - **Per-level recipe tutorial:** `ui.showTutorial(level)` one-screen
    diagram (`#recipe` overlay, z65) from `level.tutorial` data
    (ingredient cards w/ tool overlay → arrows → combined → bake →
    serve); shown before each level (gated on `!skipCountdown`).
    `game.startLevel` now lifts the fader before the tutorial so the
    countdown is visible too.
  - **Verified** via __VK: full 5-order round → ends at 2:00 → 3 stars
    (gold 160) + bestTime saved + coins secondary; 3-answer wash bar
    1→2→3 → plate done + auto-continue; stove bare-hand REJECTED + bubble,
    plate path, bun→bun_patty→plated expands to `[bun,patty_cooked]`;
    oven bare-hand rejected + bubble + plate path. Zero console errors.
    Headless-Edge shots: recipe overlay, wash card (bar 1/3 + Later/Esc),
    HUD (📋 0/5 orders pill + ⏱ count-up). NEW qa scenes: `recipe`;
    `question` now shows the wash bar at 1/3.
- 2026-06-13 — **Order-free pizza assembly + responsive tickets
  (user feedback, on Opus — Fable blocked).**
  - **Pizza toppings in ANY order (dough always first).** Replaced the
    rigid linear chain (`dough_base`→ketchup→`dough_sauced`→cheese→
    `pizza_raw_cheese`→mushroom→`pizza_raw_mushroom`) with a **set-based
    state machine**. A pizza-in-progress is identified by the SET of
    toppings it carries (canonical layer order `sauce, cheese,
    mushroom`), so build order never matters — logically OR visually.
    Ids: `pizzawip_<sorted_tokens>` (e.g. `pizzawip_cheese`,
    `pizzawip_sauce_cheese`, `pizzawip_sauce_cheese_mushroom`); the empty
    set is `dough_base`. Generated programmatically in `recipes.js`
    (`buildPizzaStates` IIFE + `PIZZA_LAYERS`/`PIZZA_ADDERS`/`PIZZA_BAKES`
    /`pizzaWipId`): every non-empty subset gets an ITEMS entry whose
    `accepts` adds any not-yet-present topping (ketchup→sauce,
    cheese_chopped→cheese, mushroom_chopped→mushroom). **Cheese or
    mushroom can now go on bare dough WITHOUT sauce**, sauce added later
    — exactly the request. Only COMPLETE sets bake: `sauce,cheese`→
    `pizza_cheese`, `sauce,cheese,mushroom`→`pizza_mushroom`; incomplete
    pizzas have no `bakeTo` (oven rejects, new hint "add 🥫 + 🧀 first 🍕"
    in game.js). Old `dough_sauced`/`pizza_raw_*` ids GONE.
  - **Visual:** `composeRawPizza(topping)`→`composePizza(toppings)` in
    stations.js renders deterministically from the canonical set —
    `saucedParts(withSauce)` makes the red disc optional; cheese layer
    then mushroom bits added only if present. Same toppings ⇒ same id ⇒
    identical mesh, so "cheese then sauce" and "sauce then cheese" look
    the same by construction. `compose:'sauced'`/`'rawpizza'` →
    `compose:'pizza'` with a `toppings` array. qa=level3 now showcases
    the full lineup (bare dough, cheese-no-sauce, sauce-only,
    sauce+cheese, full, baked+plated).
  - **Responsive order tickets.** Were fixed `128px` → tiny on big
    monitors. Added `--ticket-scale:clamp(1.2, 100vmin/640, 2.8)` on
    `:root` and `transform:scale(var(--ticket-scale))` +
    `transform-origin:top left` on `#tickets` (scale the whole strip, NOT
    per-ticket — would clobber the tIn/shake/served transforms). Floor
    1.2 (laptop a bit bigger than before), ~1.7× at 1080p, ~2.25× at
    1440p, cap 2.8 (4K). Pure CSS, auto-handles resize. vmin tracks the
    camera (fits the smaller dimension).
  - **Verified:** exhaustive `combine()` logic test (all 6 full-set
    orders converge to `pizzawip_sauce_cheese_mushroom`; cheese↔sauce
    converge to `pizzawip_sauce_cheese`; double-topping blocked; only
    complete sets have `bakeTo`) + a REAL scrambled-order pipeline via
    __VK (mushroom→cheese→sauce-last on a counter → bake → plate →
    serve, +54🪙; oven rejected an incomplete `pizzawip_cheese`; ketchup
    stayed reusable). Headless-Edge shots confirm cheese-on-bare-dough
    (no red disc) and tickets at 2560×1440. Zero console errors.
    GOTCHA reconfirmed: in-panel preview_screenshot hangs (suspended
    renderer) — use headless Edge with **`Start-Process -Wait`** (the
    `&` call operator returns before Edge flushes the PNG → 0-byte/no
    file) and a `--virtual-time-budget` (~14s) so async model load + the
    qa scene run before capture. ES-module cache: `fetch(f,{cache:
    'reload'})` per changed module then reload.
- 2026-06-12 — **Compact kitchens (all 3 levels).** Walking distances
  were too long for one chef. L1 9×6 → 7×5; L2 10×7 → 8×6 (kept a
  small 3-tile island row 2); L3 10×7 → 8×6. Per user, EVERY level
  keeps a storage island: L1 got a 2-tile island (2-3,2), L3 a 2×2
  island (2-3,2-3); spawn moved off the island tiles. Park/lap-around
  verified via __VK.
  Camera auto-fit = free zoom-in. All station inventories audited via
  __VK (boards/stoves/ovens/sink/rack/trash/crates/hatch all present),
  L3 ketchup start counter moved to (0,3), rack still next to sink.
  qa.js showcase tile coords updated for the new maps; qa=chop chef
  now stands INSIDE the kitchen (was teleporting outside the bottom
  wall — board.row-1, face(0,1)).
- 2026-06-12 — **Pizzeria simplified + hot-pizza plating + order bonus.**
  - **Plate required at the oven:** baked pizza (ready OR burnt) can
    only be taken with an empty clean plate — it slides straight onto
    the plate (`held.contents.push` in the oven branch, steam carries
    over, dish matched → immediately servable). Bare hands rejected,
    hint: "too hot! bring a clean plate 🍽️". Burnt pizza plates too;
    trash empties the plate (existing branch). Mid-bake (cooking) can
    still be pulled bare-handed. Stove (patties) unchanged.
  - **Pepperoni removed entirely** (items, dish, topping model, crate,
    map char '4' → 'C'). L3 = dough, ketchup, cheese, mushrooms; only
    two orders: Cheese Pizza (w3) / Mushroom Pizza (w2).
  - **Raw-pizza cheese: 3 big bits (0.7)** instead of 5 small; mushroom
    layer 4 bits at 0.45 above them.
  - **In-order streak bonus:** serving in any order was already
    possible (serve() matches any ticket); NEW +5 🪙 `orderBonus` when
    the served ticket is the oldest open one (`inOrder` from
    orders.serve, 📋 in the score pop). Verified: 50 vs 60 coins.
  - qa=level3 scene updated (mushroom raw pizza + plated cheese pizza).
- 2026-06-12 — **Pizza scale pass + loading screen.**
  - All pizza stages shrunk: `PIZZA_SCALE 0.72` in stations.js scales
    the composed sauced/raw-pizza groups (built unscaled via
    `saucedParts()`, scaled once at the end); `dough_base` def scale
    0.72; baked `pizza_*`/`pizza_burnt` defs + plated-dish render
    0.92→0.66. Topping bits 0.6→0.45 with tighter scatter (centers
    ≤0.42·r) so nothing pokes past the sauce disc (0.68·r).
  - **Loading overlay** (`#loader`, z-70 above the fader): CSS pizza
    that builds slice-by-slice (conic-gradient, 8 slices, 260ms steps,
    pepperoni dots via radial-gradients) + cycling Fredoka messages
    ("Rolling the dough…" etc). `ui.loading(on)` drives it;
    `game.preload` shows/hides in try/finally. `?qa=loading` scene.
  - GOTCHA hit again: the preview panel caches ES modules HARD —
    mixed old/new modules threw "ui.loading is not a function".
    Fix: `fetch(file, {cache:'reload'})` for each module, then reload.
- 2026-06-12 — **Board-item alignment + staccato chop.** Items on
  boards now rotate to the board's facing (`itemMesh.rotation.y =
  st.rot` in setItem) — pepperoni lies along the board. Chop anim:
  full Chopping clip drives the knife through the table (y profile
  measured: high 1.76 @13% → 0.59 @33%, slow recovery); now loops only
  the first 25% at timeScale 1.7 (`chef.chopWindow`, reset in update)
  → quick chops, knife bottoms out at y≈0.86 (board top 1.17,
  reads as striking the board). One-frame low dip on fade-in from
  idle is expected. Tuned per user: timeScale 1.7 → 1.25; knife roll
  fixed to edge-down: `rotation.set(PI, 0, -PI/2)` (blade shows as a
  thin line from above, not its flat face).
- 2026-06-12 — **Dough rolling scrapped + knife orientation fix.** Both
  L3 boards are plain cutting boards again ('d' map char unused but the
  world.js/`st.tool` plumbing kept for later); dough preps on any board
  with the knife (hint still says "Roll"). In-hand knife rotation fixed
  to blade-forward: `rotation.set(PI/2, 0, -PI/2)` (z=+PI/2 pointed at
  the camera — verified via qa=chop crops).
- 2026-06-12 — **Rack turn + tool placement + tools-in-hand.**
  - Dishrack rotated 90° (`facing + PI/2` in world.js; plate row in
    `refreshStack` rotated to match).
  - Static board tools no longer sink: knife lies FLAT on the board
    (rotation.set(PI/2, facing+0.6, 0), y 1.23), rolling pin rests on
    its rollers (y 1.39). Board top = 1.17 (counter 1.02 + board 0.15).
  - **Tools in hand while working:** rig has `handslotr` socket bone;
    `chef.setTool(name)` clones knife/rollingpin onto it, driven by
    `chef.workTool` (set from `st.tool` in workStations) — shows only
    while Space is held, auto-clears on release. Knife blade-forward;
    pin gripped center (offsetting along bone axis flung it to the
    floor — bone-local axes are not world-aligned, keep offsets tiny).
    Swing arc verified: hand y 0.59→1.57, visible above counters.
    `?qa=chop` now freezes at the TOP of the swing (holdSpace 1.25).
- 2026-06-12 — **Carry visibility pass.** Chibi heads were hiding
  carried items from the camera. Carry anchor raised + pushed out
  (0,1.16,0.66 → 0,1.42,1.02), ketchup scale 1.45 → 1.9. (A ×1.3
  in-hand scale boost was tried and reverted — anchor move alone
  solves it per user.) New `?qa=carry` worst-case scene (chef
  facing away from camera holding ketchup) — screenshot confirms the
  item reads clearly past the head. If still not enough, the next step
  is replacement characters (Quaternius CC0 / Synty paid have
  Overcooked-like proportions; KayKit packs are all chibi).
- 2026-06-12 — **Pizzeria overhaul (user feedback batch).**
  - **Cheese on every pizza:** build order is now roll → ketchup →
    cheese → optional topping → bake. `dough_sauced` accepts ONLY
    `cheese_chopped` → `pizza_raw_cheese`, which accepts
    pepperoni/mushroom. Raw-pizza visual scatters a cheese layer under
    the topping bits. Ticket `icons` field shows the true build
    (🥫🧀, 🥫🧀🍖, 🥫🧀🍄).
  - **Pepperoni 3-stage chop** like mushroom: `pepperoni` →
    `pepperoni_half` (model `*_chopped`) → `pepperoni_chopped` (model
    `*_slices`), continuous bar.
  - **Task-specific boards:** new map char `d` = dough-rolling station
    (rolling pin); `b` = cutting board (knife). `st.tool` gates
    placement (`ITEMS.dough.tool='rollingpin'`, default knife); hint
    explains the right station. `boardTool` level field removed.
  - **L3 layout:** rack moved next to sink (bottom row, col 6); right
    edge has one `d` (row 2) + one `b` (row 3). **L3 starts with 2
    plates** (faster first wash); L1/L2 still 4.
  - NOT done (user paused it): raw pizza on plates — plate use being
    rethought; raw pizzas still go hand↔counter↔oven only.
  - All verified via __VK: tool gating both ways, cheese-before-topping
    enforced, pepperoni chain, bake → pizza_mushroom, ticket icons,
    rack/plates layout. Zero console errors + headless-Edge screenshot.
- 2026-06-12 — **Character select + 3-stage mushroom.** (Note: a first
  broken attempt at character select was committed `bc33a26` and
  reverted in `a25153d` — it referenced GLBs that weren't on disk.)
  - **Character select:** `CHEF_CHARACTERS` registry in models.js
    (knight/barbarian/mage/ranger/rogue); GLBs copied from the
    Adventurers pack into `assets/models/chef/` (gitignored). Start
    screen renders a `#charRow` of pill buttons from the registry;
    choice persists in `krabsy_vkitchen_char`; `game.preload` reads the
    key and `preloadChef(charName)` loads only that character (GLTF
    cache makes switching cheap). All five share the Rig_Medium clips.
  - **Mushroom is now a two-stage chop** like lettuce/cheese:
    `mushroom` → `mushroom_half` (model `*_chopped`, interim, swap at
    50% on the continuous bar) → `mushroom_chopped` (model `*_pieces`).
    Verified: chain continuity + `dough_sauced`+`mushroom_chopped` →
    `pizza_raw_mushroom` unchanged.
  - Verified via __VK (barbarian loads w/ all clips, mushroom chain,
    pizza combine) + headless-Edge menu screenshot. Zero console
    errors. NOTE: browser caches ES modules — hard reload after edits.
- 2026-06-12 — **v1.3 feedback batch.**
  - **Progress bars:** chop/cook indicator is now a horizontal pill bar
    (`drawRing` in stations.js, 128×32 canvas) instead of the pie ring;
    burn warning shows a white `!` on the bar. New `?qa=chop` frozen
    scene (chef mid-chop) for screenshots.
  - **Rack fix:** plates were rotated coplanar (all in one plane along
    x) → now `rotation.z` so the disc normal runs along the row; 0–4
    upright plates side-by-side like the pack's `dishrack_plates`.
  - **Continuous two-stage chop:** one bar 0→100% for lettuce/cheese;
    model swaps to `*_half` at 50% WITHOUT resetting progress
    (`setItem(..., keepProgress)`); chopTime now 1.8 on both stages;
    placing an interim item on a board resumes the bar at 50%.
  - **Reusable ketchup bottle:** L3 ketchup crate removed (map '2' →
    'C'); bottle (scale 1.45) starts on that counter via new level
    `startItems`. Squeezing on dough keeps the bottle in hand
    (`reusable` flag in counterInteract, both directions); park it on
    any counter; trash rejects it. `CRATE_MODELS.ketchup` gone.
  - All verified via __VK (chop continuity/resume, ketchup two-dough
    reuse + park + trash-reject, zero console errors) + headless-Edge
    screenshots (qa=chop, qa=level3 incl. rack crop).
- 2026-06-12 — **v1.2 polish batch (user feedback, 9 items).**
  - **Music:** WebAudio chiptune sequencer (lookahead scheduler in
    `audio.js`), one 2-bar loop per level (104/116/124 BPM), routed via
    `musicGain` and **ducked to 33% during sink questions**. Zero-asset
    convention kept. NOT yet playtested by ear — needs user listen.
  - **SFX juice:** chop pitch-varies per hit, serve has coin shimmer.
  - **Carry:** anchor moved overhead → chest-front (0, 1.16, 0.66);
    `Holding_B` clip plays when idle+carrying.
  - **Two-stage chopping:** lettuce/cheese: raw → `*_half` (interim,
    0.9s/stage) → final. Final models per user: lettuce_slice /
    cheese_grated. `chopTime` is per-item now; boards got progress
    rings; hint says "halfway — keep chopping!".
  - **Compositional burgers:** plate w/ bun renders bun_bottom + actual
    layers (patty/cheese/lettuce/tomato, bbox-stacked) + bun_top only
    when a burger dish matches. `food_burger` model no longer used.
  - **Compositional pizza:** `dough_sauced` = dough_base + red sauce
    disc at 68% radius (crust visible, replaces tint hack);
    `pizza_raw_*` adds 5 scattered topping bits (scale 0.6) — raw pizza
    is no longer the pre-sliced plated model. Baked keeps plated model.
  - **Ketchup:** sauce crate → ketchup bottles (`ketchup` model, crate
    visual crate_tomatoes); bottle consumed on dough. 'sauce' item gone.
  - **Steam:** `steamy` items (cooked patty, baked pizzas) get
    `item.steam=14s` on ready; wisps follow item across stove → hand →
    counter → plate (transfer on plating). New fx mat 'steam'.
  - **Plate rack:** plates now stand upright side-by-side in the rack
    (0–4 visible, rotation follows rack facing); sink keeps small dirty
    pile. `st.rot` stored on all stations.
  - All re-verified via __VK (two-stage chains, ketchup flow, compose
    structures, steam transfer, rack states, full L1 regression).
    Screenshots: level2/level3 QA scenes now stage build-step showcases.
    Headless-Edge note: kill stray headless msedge + use
    `--user-data-dir=%TEMP%\vk_edge_profile` if screenshots hang.
