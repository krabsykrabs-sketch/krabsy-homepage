# Verb Hatchery — game brief

You are the **game session** for Verb Hatchery on **Krabsy** (krabsy.com):
a free browser site where German- and Spanish-speaking kids (about 10–14)
practise English irregular verbs. Read the repo-root `CLAUDE.md` once for
the site rules, then work only in this folder. The master session releases
games (wrapper pages, `games.json`, sitemap, deploy). You don't touch
`homepage/` or other games, and you don't push or deploy. Stage only this
folder, in the same command that commits: `git add games/verb-hatchery && git commit …`.

Status: **open-world version playable 2026-11-22, not play-tested by a person, not released (see Build state).**

## Why this game

The owner asked what is popular on Roblox and picked the **egg / creature
collector**. In October 2026 the most-played Roblox game was *Steal an
Egg* (about 1.28 M players on average), and *Steal a Brainrot* and *Break
and Steal an Egg* were also in the top 12. Simulation/tycoon games had
37 % of the top-100 players. We copy the **loop only**: our own name,
creatures, art and texts, nothing from those games.

**Owner decision 2026-11-22 (after seeing v1):** the fixed-camera belt
version was "way too boring". The game is now a **first-person 3D world**:
you run out into the fields, find eggs, carry them home, and other
creatures try to steal them. Same kind of game as the Roblox hits, still
**our own** name, world, characters and look (no copied maps, names, art).

The loop is: run out → find an egg → answer to pick it up → carry it home
while thief crabs try to steal it → it hatches in your base → creatures
earn coins → coins buy upgrades (faster shoes, bigger backpack, more pens)
→ stars open farther zones with rarer eggs. Kids come back to see their
collection grow.

How it fits Krabsy:

- **Grammar is the currency.** You pick up an egg by answering; rarer
  eggs ask harder verbs. You keep an egg from a thief by answering.
- **Self-paced question moment.** When a card opens, the whole world
  pauses (thieves too) and the mouse is released. Nothing chases you
  while you read.
- **Coming back tomorrow** (coins that pile up while away, eggs that
  hatch) is spaced repetition for free.
- **Runs on a school Chromebook and a tablet:** keyboard + mouse (pointer
  lock) and touch (left stick, drag to look, buttons).

No levels, one growing base. Stars come from goals (below), so a lesson
still has a clear "done".

## The game

### The world

One island, about 250 m across, with **Krabsy's hatchery** in the south
and zones around it. Rarer eggs live farther away:

| Zone | Where | Eggs | Opens with |
|---|---|---|---|
| Meadow | around the hatchery | common, some uncommon | start |
| Forest | west | uncommon, rare | 2 ★ |
| Beach | east | rare, epic | 5 ★ |
| Volcano | far north | epic, legendary | 9 ★ |

A locked zone has a shimmering wall with its star number; you can see the
glowing eggs behind it. Rare and better eggs send a light beam into the
sky so they can be found from far away. A **minimap** (bottom left) shows
home, the zones, eggs nearby and the player; a **beacon** over the
hatchery shows the way home.

### Core loop

1. **Find an egg** in the world (on a little nest). Colour = rarity:
   white, green, blue (+ beam), purple (+ beam), gold (+ beam).
2. **Walk up and press E / tap the hand button** → the world pauses, the
   question card opens (chips 1–3 or tap).
   - Common/uncommon: one question (2nd form only, `go → ___ → ___`, the
     teach line may then show the whole chain).
   - Rare and above: the chain pair (2nd form, then `go → went → ___`);
     after the 2nd-form answer, don't show the 3rd form.
   - **Right** → the egg goes into your backpack (shown in your hands at
     the bottom of the screen). **Wrong** → the egg cracks a little and
     rolls off into the grass (it respawns somewhere else); the verb comes
     back soon.
   - **Backpack full:** no question; "Backpack full! Bring your eggs home."
3. **Carry it home.** In Forest, Beach and Volcano, **thief crabs** (our
   own cute robber crabs with masks) chase a player who carries eggs. When
   one catches you, the world pauses and a card asks a question: **right →
   the crab is bonked and runs away dizzy; wrong → it grabs your top egg
   and runs off** (the egg goes back to its zone). Crabs are slower than a
   sprinting player, so running is a real choice.
4. **At home**, walking onto the glowing **egg pad** puts the eggs from
   your backpack into free incubators (if all are full, they stay in the
   backpack: "Incubators full!").
5. **Hatching** as before: timers run on the clock (also while away); walk
   to a ready incubator and press E → shake, crack, the creature pops out
   (banner with name, rarity, NEW!) and jumps into a free pen. If all pens
   are full it waits in the incubator until a pen is bought.
6. **Creatures earn coins** in their pens (coins float up), also while
   away (capped, reduced rate). Press E at a pen to see a creature and
   let it go for coins.
7. **Upgrades** (button / U key): extra pen, extra incubator, warm lamps
   (faster hatching), running shoes (faster), bigger backpack (carry
   more eggs).

The numbers grow fast (1.2K, 45K, 3.1M): that is part of the fun.

### Rarity is earned, not gambled

- An egg's rarity is visible from afar and decides the difficulty of its
  question. Rare creatures come from harder verbs and farther zones, not
  luck.
- Inside one rarity, which creature hatches is random, and the chances
  are shown in the Creature Book.
- **No spin wheels, no loot boxes, no countdown offers, no real money,
  nothing that looks like a shop with prices in euros.**

### Goals and stars (gives each lesson a "done")

3 goals shown at a time (e.g. "Bring 3 eggs home", "Hatch your first
creature", "Buy an upgrade", "Answer 5 in a row", "Find a blue egg"),
each gives a star; stars open the zones above.

**Pacing for a lesson:** a first-time player should earn about **3 stars
in 10–15 minutes** and reach the Forest in the first lesson. Later goals
get longer. The goal numbers live in `src/balance.js`.

**Answer mode:** choice chips only in version 1.

### Rivals' bases (later)

Visiting a computer neighbour's base and "borrowing" a creature with a
streak of 3 answers stays an idea for later (see the open questions).

## Creatures (the main art question)

The KayKit packs we own have **no animals or pets** (only the Halloween
bat, skeletons and people). Recommended: **build the creatures from
primitives in code**, a procedural creature generator: a round body
(sphere, egg, cube, pear), eyes, a mouth, and parts (ears, horns,
antennae, crab claws, wings, tail, spikes, hats), each in a colour and
pattern. A few hundred combinations from a handful of parts; rarer
creatures get more parts, shiny materials, a glow, a little dance. It
fits the cute, rounded KayKit look and costs no download.

Each creature gets a silly made-up English-sounding name built from
syllables ("Wobbly Crabbo", "Sir Fluffington") so kids talk about them.
Make sure no generated name is rude in English, German or Spanish (keep
a blocklist).

Alternative: a CC0 animal pack (for example Quaternius animals or Kenney
"Cube Pets"). That needs the owner's OK and a download.

## Assets

The shared KayKit library is at `/home/janah/dev/krabsy-homepage/assets/`
(gitignored, CC0; some packs are symlinks into `/home/janah/dev/_assets/kaykit/`).
Copy only what you use into `games/verb-hatchery/assets/`.

- **`KayKit_Platformer_Pack_1.0_EXTRA`** — `conveyor_*` for the belt,
  `platform_*` for the island and pens, `railing_*`, `flag_*`, `star`.
- **`KayKit_Medieval_Hexagon_Pack_1.0_EXTRA`** — fences, hay bales,
  barrels, carts, buildings as island decoration.
- **`KayKit_Forest_Nature_Pack_1.0_EXTRA`** — trees, rocks, flowers.
- **`KayKit_ResourceBits_1.0_EXTRA`** — coins, gold, gems for the money
  bursts and the upgrade icons.
- Eggs, incubators and creatures: primitives in code.

## Technical direction

- Plain ES modules, Three.js vendored (copy `vendor/three/` from Verb
  Dungeon, 0.169), no CDN, no build step. Dev server: `python3
  tools/serve.py` (no cache), this folder's port is **8143**.
- **Keep the game state separate from the drawing** (`src/state.js`:
  coins, pens, creatures, incubators, upgrades, goals; pure data and
  rules). It is saved to `localStorage` (`krabsy_hatchery_save`, every
  read and write in try/catch, the game must start fine without it) and
  is the base for the coins-while-away calculation (time since last save,
  capped). Balance numbers (prices, income, hatch times, rarity chances)
  live in one file, `src/balance.js`, so they can be tuned.
- **Third person (owner decision 2026-11-22: "I want to see our
  character, camera behind it, like the original").** The player is a
  KayKit Protagonist (A = girl with glasses, B = boy; chosen on the start
  screen, saved as `look`), animated with idle / walk / run / jump / pick
  up / hit / interact. The camera orbits behind. Desktop (owner, same day:
  "I can't click the upgrade button, I don't see the mouse"): **no pointer
  lock**, the mouse stays visible for the buttons; dragging on the game
  (left or right button) turns the camera, a short click on the game does
  the action (like E), wheel zooms; WASD / arrows run relative to the
  camera, Shift sprint, Space jump, U upgrades, B book. While running
  forward the camera slowly swings in behind the character (not while
  dragging, not when running sideways or back), so turning it is
  optional. Buttons drop keyboard focus after a click (Space must not
  press them again). Touch: left half = stick (push far = run), right half = drag to
  turn the camera, buttons for jump and action. The camera stays above
  the terrain and moves in front of tree trunks. Carried eggs stack above
  the character's head. The terrain is a height function (`src/world.js`), so the
  player needs no physics engine; trees and rocks are circle colliders.
- **Performance:** trees and rocks are `InstancedMesh`es (one draw call per
  model part), the shadow camera follows the player, fog limits the view.
- **Questions:** from `homepage/lib/krabsy-questions.js`. Egg rarity →
  verb tier (common/uncommon tier 1, rare tier 2, epic/legendary tier 3).
  ⚠ `getQuizSet` has **no tier filter**, and its `difficulty` field is 2
  for every verb, so it can't pick by tier. Do it like Verb Dungeon's
  `src/questions.js` `loadPairs()`: fetch all pairs with `getQuizSet`
  (default chain order, `withOptions: 3`), get each verb's tier from
  `getChainSet` (`r.verb → r.tier`), and sort the pairs into one pool
  per tier. Common/uncommon eggs ask only the pair's first step (2nd
  form). Missed verbs come back on the next eggs. Keep an inline fallback
  list (copy Verb Dungeon's `src/questions.js` + `src/verbs.js`). No grammar terms in
  the question; use `go → ___ → ___` with the asked blank highlighted
  (teal = 2nd form, coral = 3rd, as in the Dungeon).
- **Interface texts EN/DE/ES** (`?lang=`, `src/i18n.js` like the Dungeon).
- **Analytics:** call `recordAttempt()` for every answer, and send game
  events via `/lib/krabsy-game-events.js` (spec in `docs/game-analytics.md`):
  `egg_grabbed` (rarity), `egg_lost`, `creature_hatched` (rarity, new or
  not), `upgrade_bought`, `goal_done`.
  **Levels:** the dashboard groups by `level` and expects
  `level_start`/`level_end`; this game has none, so **a level = the next
  star**. `level` = stars earned so far + 1. Send `level_start {level}`
  when the game opens and right after each star; send `level_end {level,
  result: 'won', seconds, answers, correct, coins, creatures}` when a goal
  gives a star. Leaving before the next star counts as "left", which is
  what we want to see (where players stop). There is no "lost".
  Also send `session_summary {level, seconds, answers, correct,
  eggs_grabbed, hatched, coins_per_sec, creatures}` on `pagehide` /
  `visibilitychange` → hidden (once per visit).
- WebAudio synth for sounds (belt hum, egg pop, crack and hatch fanfare
  per rarity, coin plinks, upgrade "ding").
- Target: plays smoothly on a school Chromebook and a touch tablet. Many
  creatures on screen → merge/instance the parts; cap pens visible at once.

## Open questions for the owner

- **Quirky animals licence:** may we ship the Quirky Series FREE
  Animals on krabsy.com? (blocks release while they are used)

Defaults used until the owner says otherwise (owner said "build it",
2026-11-22): name **Verb Hatchery**, **creatures from code**, rivals
stay **version 2**.

- Name: "Verb Hatchery" or something else?
- Creatures from code (recommended) or a downloaded CC0 animal pack?
- Rivals/stealing in version 2, or never?
- Should progress be shared between devices later (e.g. via the class
  code from `docs/classroom-concept.md`)? School Chromebooks often clear
  their storage, so a save on the device can get lost.

## Build state (version 2 = open world, 2026-11-22)

Runs: `python3 tools/serve.py` → http://localhost:8143/ (add `?debug` for
QA hooks on `window.hatchery` and event logging, `?lang=de|es|en`,
`?touch` to force the touch controls). Headless QA screenshots:
`node tools/shot.cjs "?debug" out.png [w h] [steps…]` (`PORT=…` if 8143
is busy). Headless Chromium renders in software (~2–10 fps), so give
steps generous waits.

Files: `src/balance.js` (all numbers, zones), `src/state.js` (rules +
save, pure; save key `krabsy_hatchery_save`, version 2), `src/world.js`
(height function, terrain, zones, walls, instanced decor, base, wild
eggs), `src/player.js` (third-person character + camera, pointer lock,
touch, collisions, egg stack), `src/thieves.js` (robber crabs), `src/minimap.js`,
`src/questions.js` (tier pools), `src/creatures.js` (procedural creatures,
names, blocklist), `src/main.js` (flow, cards, panels, HUD), `src/i18n.js`,
`src/audio.js`, `src/analytics.js`. Decor: 19 KayKit Forest Nature models
in `assets/nature/` (370 KB); characters + animations in
`assets/characters/` (1.2 MB); see `assets/CREDITS.md`.

Done (checked headless at 1366×768 desktop and 1024×700 touch, EN/DE/ES):
island with Meadow / Forest / Beach / Volcano (lava crater), locked-zone
walls with star signs that dissolve when opened, eggs on nests with glow
and light beams, pick-up card (single 2nd form or chain pair), wrong =
the egg rolls away and respawns, backpack (eggs in hand), thief crabs
chase and catch → card (bonk / stolen), egg pad delivers to incubators,
hatching, pens, release, 5 upgrades (pen, incubator, lamps, shoes,
backpack), goals → stars → zones, minimap, home beacon, zone names,
coins while away, welcome-back note, auto quality drop on slow devices
(`quality_down` event), analytics events (`egg_grabbed`, `egg_lost`,
`eggs_home`, `thief_catch`, `zone_opened`, `creature_hatched`,
`upgrade_bought`, `goal_done`, levels = stars, `session_summary`).

Not done yet / to check:
- **Play-test by a person** on a real Chromebook and tablet: frame rate in
  the forest (150 trees), mouse sensitivity, touch look speed, whether
  kids find eggs and the way home, crab speed vs. sprint.
- Balance: egg counts per zone, crab speed, prices, away coins.
- The site question engine path is untested (local fallback verbs only).
- Rival bases ("borrow" a creature), version 2+.
- Wrapper pages / release (master session).

## Log

- 2026-11-22: brief written by the master session after the owner picked
  the egg collector from the Roblox research (sources: bloxodes.com
  October 2026 report, livecounts.nl live charts).
- 2026-11-22: brief reviewed and fixed (tier pools instead of a
  getQuizSet tier filter, single-question eggs, full incubators, hatching
  while away, lesson pacing, analytics levels = stars). Version 1 built
  the same day (see Build state).
- 2026-11-22: owner found the belt version "way too boring" → rebuilt as
  a first-person 3D island (zones, carrying eggs home, thief crabs,
  minimap). Save format version 2 (v1 saves are dropped).
- 2026-11-22: third person with a visible character (KayKit
  Protagonists A/B, choice on the start screen), camera behind, eggs
  stacked above the head, action prompt floats over the egg / incubator.
  Owner asked whether to buy an animal pack: answered no (code creatures
  stay; free CC0 packs as an option if wanted).
- 2026-11-22: mouse controls reworked (no pointer lock; drag = camera,
  click = action, camera follows when running forward). Checked with real
  Playwright mouse input: drag turns, Upgrades opens/closes, Space jumps
  without re-pressing a button, click on an egg opens the card, click on a
  chip answers.
- 2026-11-22: hatched creatures are now the **Quirky Series animals**
  (owner: "use the quirky animals that we have"), `src/animals.js`: the 8
  animals in every rarity as fancier versions (common plain, uncommon
  pastel, rare party hat + shine, epic glow + top / wizard hat, legendary
  gold + crown; hats follow the head / body bone), idle plus a random
  trick every few seconds (bounce, spin, eat, sit, jump, roll …), names
  "<title> <Animal>" (e.g. "Sleepy Muskrat", "King Pudu"). **Licence of
  that pack is not confirmed** (no file in the archive, blank on itch.io):
  `assets/animals/` is git-ignored, and without it the game falls back to
  the code-built creatures. Before release: owner confirms the licence
  (or asks omabuarts), then un-ignore and commit the 8 files (2.2 MB).
- 2026-11-22: **world dressing** (owner: "the world looks a bit boring … be
  creative" + "the floor in our base overlaps"). Base floor fixed: the
  terrain under the deck is lowered 0.15 m (`DECK` in `world.js`), the deck
  got a plank texture and a trim. New `src/decor.js` (all CC0, 2 MB in
  `assets/props/`): dirt paths from home to each zone with signposts at
  the fork (`PATHS`, `FORK`), a pond (`POND`, not walkable in the middle),
  flower fields with butterflies, a stone circle, base lanterns / benches /
  flower beds / fountain, a playground, a picnic, a small farm; forest
  mushrooms (some giant), stumps, logs, a campsite with a flickering fire,
  fireflies; beach palms, shipwreck, dock into the sea, barrels / chest,
  sandcastles, rowing boat, seagulls, a pirate ship bobbing offshore;
  volcano stone heads facing home, glowing crystals, crater smoke; a
  lighthouse with a turning beam on a sea rock; drifting clouds. Kenney
  models export metalness 1 → set to 0 at load (else black). Minimap shows
  paths and the pond. Measured: ~50 draw calls, ~160k triangles in a
  busy view (headless).
- 2026-11-22: **zones matter now** (owner: "once the best area is open you
  always go there; boring"). Built ideas 2 + 3 of the proposal (1 = heavy
  eggs, and home raids, not built):
  - **Each zone has its own animals** (`ZONES[].animals` in `balance.js`):
    Meadow Muskrat + Sparrow, Forest Pudu + Colobus, Beach Herring +
    Inkfish, Volcano Taipan + Gecko. An egg remembers its zone (carry /
    incubator `{ r, z }`), hatching picks one of that zone's animals.
    Species id = `<rarity>-<Animal>`; 22 species (`SPECIES`), the Book has
    one row per zone with its egg colours. Save version 3 (older saves
    dropped).
  - **Best egg only as an event**: everyday eggs per zone are Meadow
    white/green, Forest green/blue, Beach blue/purple, Volcano purple;
    the zone's best egg (Meadow blue, Forest purple, Beach gold, Volcano
    gold) appears as an announced event (`EVENTS`: first after 40 s, then
    every 55–95 s, stays 120 s, farther open zones a bit more often, never
    the same zone twice in a row). Event egg: bigger, wide beam, turning
    gold ring, star; banner under the coins with rarity, zone, countdown,
    an arrow (relative to the camera) and the distance; blinking ring on
    the minimap. A wrong answer moves it elsewhere in its zone (the event
    goes on). Events: `egg_event_start {zone, rarity}`, `egg_event_end
    {zone, rarity, result: grabbed|expired|lost, seconds_left}`.
  - Not tuned with real players: event frequency, egg counts per zone.
- 2026-11-22: **invisible wall fixed** (owner, near the forest path at
  about (-31, 2)). Cause: the rolling meadow dipped to −0.44 m there, and
  "walkable" was `height > water + 0.25` (−0.35), so a dry-looking dip
  counted as sea. Fix: inland ground +0.8 m (lowest inland point now on
  the beach slope), and `onIsland()` = not the deep pond middle, and
  always walkable within `ISLAND.r − 20` of the centre; only the coast
  uses the height test. Checked by walking from home towards 144 points
  all over the island (`tryMove`): no stop without a visible object,
  except the pond's deep water (intended).
- 2026-11-23: owner **parked the heavy-eggs idea** (rarer eggs slow you
  down). Still open as ideas: heavy eggs, crab raids on the home base.
  Next: beach overhaul (a real beach by the water, not a sand patch) and a
  graphics / level-design review of the whole world (Fable 5.2 subagent).
- 2026-11-23: **Beach rebuilt as a real beach** (owner: "a proper beach …
  by the water"; built by a Fable 5.2 subagent, lead session reviews).
  Before / after pictures: `_shots/beach-*.png` (git-ignored).
  - **Island:** a bay (`BAY` in `world.js`, a 28 m circle of sea) is cut
    into the east coast. Sand runs down into shallow water, low dunes
    behind. The Beach zone moved 10 m east and grew (`balance.js`: x 88,
    r 34, was 78 / 30), so its circle now covers sand **and** part of the
    bay. The Beach path got one more point and ends on the sand. A small
    **islet** (`ISLET`) is reached by wading along a sandbar. A **pier**
    (`PIER`, built in code) is walkable: `height()` = ground or pier top,
    `terrainH()` = ground only (terrain mesh, water).
  - **Sea:** one mesh with a per-vertex "distance to shore" (`_water()`):
    light turquoise shallows, foam on the waterline, two wave lines running
    in, the level rises and falls 3 cm. No extra render pass. It runs
    around the whole island, not only the beach.
  - **Rules:** you can wade (`WADE` = 0.28 m, waist-high), deeper water
    stops you. `onIsland()`: inland ground is still always walkable, except
    on the beach (`beachW() > 0`), where the height test decides. Crabs
    start on dry ground, paddle through the shallows (so the islet is no
    safe spot) and don't hop on or off the pier from the side. The camera
    stays above the sea. Meadow trees / bushes / grass stay off the sand.
  - **Dressing** (`decor.js`): palm belt along the dunes, grey rocks at both
    ends of the bay, wreck on the north rocks, pier with barrels, lamp and a
    tied-up boat, parasols + towels + beach ball (one mesh, code), sand
    castles, a treasure dig, dune grass, a bottle, two palms on the islet,
    the pirate ship at anchor in the bay mouth. New models (Kenney Pirate
    Kit, about 250 KB): `rocks-a/b/c`, `grass-plant`, `grass-patch`,
    `boat-row-large`, `bottle`, `tool-shovel`, `hole`, `palm-straight`;
    `structure-platform-dock` removed. Game size without animals: 5.8 MB.
  - **Minimap:** the island is drawn once from the height function (real
    coast, bay, pier, sand); locked zones are shaded with a dashed ring.
  - **Checked (headless, EN + DE):** eggs 12 / 7 / 5 / 4 per zone; 40 forced
    events landed in all four zones (Beach ones on sand); 3 beach crabs
    start dry and move; walk test from home, from the beach and from the
    islet (about 480 walks): every stop is at an object, at water, or at the
    pier deck when coming from the water; islet and pier head reachable on
    foot. Same camera, old vs new: Beach ground view 201 → 210 draw calls,
    219k → 243k triangles (measured before the sea mesh was cut from 33k to
    21k triangles). **These counts are far above the "~50" noted earlier**:
    see `WORLD-PROPOSAL.md` item 1.
  - Not checked: a real device (cost of the sea shader on a Chromebook),
    touch controls, how crabs in the water feel in play, ES texts (no new
    texts were added).
  - `WORLD-PROPOSAL.md`: review of the whole world with 15 prioritised
    ideas. **Nothing from it is built**; the owner decides.
