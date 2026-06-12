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

## Working agreements

- You own only `games/verb-kitchen/`. Don't modify anything outside it.
- Commit locally as you go; never push.
- Keep this CLAUDE.md current — it is the only memory between sessions.

## Status log

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
