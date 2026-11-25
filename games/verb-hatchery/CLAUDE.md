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


## Topics and languages (master session, 2026-11-24) — required

Owner direction (`docs/vision.md`): Krabsy becomes grammar practice in
**any learning language**, starting with Spanish for English speakers
(`/en/spanish/`, live as a pilot). **Every game must play any topic**, not
only English verbs. Questions come from the engine's `quiz` shape; topic
files are described in `content/FORMAT.md`.

- **Read `?topic=`** (`KQ.topicFromUrl()`) and ask that topic. Test with
  `?topic=es_ser&lang=en` (Spanish "Yo soy …", 38 sentences),
  `?topic=prepositions&lang=de` and the default verbs.
- **Pass the game's own language** to the engine:
  `getQuizSet({ …, lang })` with the `lang` from `src/i18n.js`. Without it
  the teach lines come in the site's stored language (Verb Towers showed
  German explanations in its English game until 2026-11-24).
- **Two question displays:** `display.kind === 'trio'` (verbs,
  `go → ___ → ___`) and `'gap'` (a sentence with one `___`; any hint is
  already in brackets in `display.sentence`, e.g. `Me llamo Pablo. Soy ___. (tall)`).
  Sentences are longer than verb forms: plan room for ~45 characters on
  cards, plates and signs, and fonts need á é í ó ú ñ ¿ ¡.
- **After a wrong answer** show `teach.line` for gap questions (the short
  rule, in the interface language); verbs keep showing the chain.
- **Menu and HUD texts must not say "English verbs"** for other topics: keep a
  small per-topic text table (pattern: `TOPIC_TEXT` in Verb Towers'
  `js/i18n.js`: subtitle, example line, "words to practise" heading).
- Record answers with `recordAttempt(q.item, q.form, correct, '<game-id>', q.topic)`.
- **Mechanics tied to the verb pair need a topic-neutral rule** (below).
  The verb version stays as it is.
- Interface languages: EN/DE/ES as now. The English interface matters most
  for the Spanish section.

**Verb Hatchery:** common/uncommon eggs ask one question, as now. **Rare and
above ask two sentences in a row** for gap topics (prefer two sentences of
the same item, `q.item`; otherwise any two), instead of the verb pair.
Creature names: check they are not rude in Spanish too (already listed).

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
- **Performance:** everything that never moves (trees, rocks, props, the
  house) is baked into a few merged meshes, one per 48 m cell of the island
  (`src/merge.js`, see the Log 2026-11-23 "Step 1"); the shadow camera
  follows the player, fog limits the view. New static props must go through
  `world.batch` (`put` / `inst` / `Qp` / `box` in `decor.js` do that), not `scene.add`.
  What you stand on is `height()` = the terrain MESH's height (`groundH`, a
  cached 2 m grid) or the pier / bridge deck; `terrainH` is the smooth
  function behind it (see the Log 2026-11-23 "Step 3").
  All batch meshes share ONE material (vertex colours × the Quaternius
  atlas, cut-out leaves, see-through between camera and player); see the
  Log 2026-11-23 "Step 2".
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

- ~~Quirky animals licence~~: no longer used (60 CC0 creatures instead, 2026-11-25).

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
(height function, terrain, sea + pond, sky, zones, walls, trees / rocks, base,
wild eggs), `src/merge.js` (static batches: bakes colours into vertex colours and
merges per cell), `src/decor.js` (set pieces, life), `src/player.js` (third-person character + camera, pointer lock,
touch, collisions, egg stack), `src/thieves.js` (robber crabs), `src/minimap.js`,
`src/questions.js` (tier pools), `src/creatures.js` (procedural creatures,
names, blocklist), `src/main.js` (flow, cards, panels, HUD), `src/i18n.js`,
`src/audio.js`, `src/analytics.js`, `src/qnature.js` (loads the Quaternius
pack), `src/ground.js` (grass and small plants near the player). Nature,
the hatchery building, the ruin, yard / camp props and the crops: the
Quaternius pack `assets/qnature/` (one .glb + one atlas, 1.2 MB, built by
`tools/build-qnature.mjs`); characters + animations in
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
- 2026-11-23: **World proposal Step 1 built (items 1–4)**; the owner approved
  all 15 items, they are built step by step (Fable 5.2 subagent, lead session
  reviews). Pictures: `_shots/step1-before-*.png` / `step1-after-*.png`.
  - **1 Merged static props** (new `src/merge.js`, `world.batch`). Every
    static model is baked: its colour (material colour × palette texture at
    the vertex) becomes a vertex colour, so all models share one Lambert
    material; the geometry is merged per 48 m cell (41 meshes for the whole
    island, 209k triangles; cells outside the view or the shadow box are
    culled). A texture that is a real picture (checked per triangle: only the
    picnic blanket and pillow) keeps its texture. Baked: all KayKit trees /
    bushes / rocks / grass (were 74 `InstancedMesh`es that were always drawn,
    twice with the shadow pass), all `put` / `inst` props, farm beds, pier
    posts, parasols, the house / roof / door / deck trim / egg pad. `put(…, {
    live: true })` keeps a model separate (pirate ship, pier boat; merged to
    one mesh each). Batch options: `color`, `mul`, `glow` (crystals).
    Owned pens + incubators are ONE mesh and the glass domes a second one,
    rebuilt in `setOwned` after a purchase; one ghost mesh per kind; the
    groups hold only bulb, egg, creature. Also merged, although they move:
    a thief crab is 7 meshes (was 26, `thieves.js`), the player character 3
    skinned meshes (was 9, `mergeSkinned` in `player.js`), each cloud 1 mesh,
    butterflies 1 `InstancedMesh` (was 52 meshes), seagulls 2 (was 18).
    Colliders are unchanged (354), random placements are identical to before
    (the old code's random-number use is reproduced, see `inst`).
    The merge runs once after loading (about 80 ms on the dev PC).
    Draw calls / triangles, same camera, headless 1366×768, all zones open,
    new save (shadow pass included):

    | View | before | after |
    |---|---|---|
    | Home | 191 / 217k | 30 / 126k |
    | Beach, ground | 173 / 224k | 49 / 132k |
    | Beach, from above | 96 / 211k | 35 / 124k |
    | Forest | 155 / 226k | 55 / 169k |
    | Volcano | 188 / 233k | 67 / 150k |
    | Meadow (towards the pond) | 287 / 273k | 79 / 180k |
    | Pond | 142 / 235k | 52 / 154k |

    Scene objects: 885 meshes + 74 instanced → 215 + 3. What is left in a view:
    eggs (nest, egg, glow, beam: 3–5 calls each), crabs (7 each), creatures in
    pens, sprites, sign boards.
  - **2 Sky, light, colour** (`world.js` `_sky`, `_lights`): gradient sky dome
    (pale horizon, deeper blue above, drawn only where nothing else is) with a
    visible sun in the west-south-west, 37° up; the fog has the horizon colour.
    Tone mapping is **Neutral** (three.js `NeutralToneMapping`), not ACES / AgX:
    those grey our teal / coral / amber, Neutral keeps them and only softens
    the highlights. More sky light, warmer and stronger sun (lower sun = longer,
    lighter shadows; the ground is as bright as before). No extra render pass.
  - **3 Egg beams**: thin (0.2 m), in the egg's colour, fading out over 30 m;
    `main.js` widens them with the distance (up to ×5) so they stay a few
    pixels wide from far away. The event egg keeps a big beam (×4.5, 72 m).
  - **4 Pond**: irregular outline (`pondF` / `pondD` / `pondPoint` in
    `world.js`), the sea's shore shader with calmer waves (`_waterMat`), a
    shallower bowl (its floor stays above sea level), sand bank + pale floor,
    reeds in three greens in clumps, minimap draws the real outline. The Kenney
    Nature Kit's teal leaves (flower stems, crops, lily pads) are recoloured
    green at load (`LEAF` in `decor.js`).
  - **Checked (headless, EN / DE / ES, desktop + `?touch`):** egg card right /
    wrong, carry, egg pad → incubator, hatch → pen, buy pen + incubator (the
    new ones appear, ghosts move on), release, locked wall + signs, zone
    opening, event egg (start, wrong answer moves it), thief card, minimap;
    walk test `walk2.js` after `stars(9)`: 9 stops without an object, all in
    the pond's deep water (intended, as before); no console errors.
  - **Not checked:** a real Chromebook / tablet (frame rate, look of the tone
    mapping on a real screen), the game without `assets/animals/` (not touched
    by this step), memory use on a 4 GB device (the merged geometry is about
    10 MB of buffers).
  - Left as it was: the wide teal home beacon (not in the list; it now looks
    heavy next to the thin egg beams).
- 2026-11-23: **creature collection prepared** (not wired in yet): 60
  creatures (44 animals, 16 monsters, all Quaternius CC0) in
  `assets/creatures/` (`creatures.json` manifest, GLBs, icons +
  silhouettes), pipeline in `tools/creatures/` (README). Owner confirmed
  **Poly Pizza** (poly.pizza, per-model pages "By Quaternius, Public
  Domain (CC0)") as an acceptable download source, because the
  quaternius.com Google Drive links answered "quota exceeded". Open:
  native Spanish check of the invented monster names; wiring (fixed rarity
  per creature + golden bonus, lazy model loading) after world step 4.
- 2026-11-23: owner downloaded the full **Ultimate Monsters** (glTF, incl.
  the 5 missing from Poly Pizza, e.g. the blob Dog) and **Ultimate Crops**
  (FBX/OBJ only) into `/home/janah/dev/_assets/quaternius/`. Use: missing
  monsters → add to `tools/creatures/roster.json` when wiring creatures;
  crops → the farm next to the base (world step 3).
- 2026-11-23: **World proposal Step 2 built (items 5–7) + the whole island's
  nature is now Quaternius** (owner: "The Quaternius kits look amazing. Why
  don't we use them for our world?") **+ see-through camera** (owner: "the
  leaves often block my view and I can't see my player anymore"). Fable 5.2
  subagent, lead session reviews. Pictures: `_shots/step2-before-*.png` /
  `step2-after-*.png` (same views as Step 1, plus `gate-forest`,
  `gate-volcano`, `path-fork`, `forest-edge`, `grass-closeup`,
  `seethrough-*-off/on`).
  - **The pack** (`assets/qnature/qnature.glb` 800 KB + `atlas.webp` 160 KB,
    built by `tools/build-qnature.mjs`, loaded by `src/qnature.js`): 70 models
    from the Stylized Nature MegaKit (trees, bushes, plants, grass, flowers,
    petals, mushrooms, rocks, pebbles, stepping stones), Fantasy Props MegaKit
    (`Lantern_Wall`, `Banner_1_Cloth`) and Medieval Village MegaKit (wooden
    fence). The kits as downloaded are too heavy (a tree = 3–10k triangles,
    2048 px textures, normal maps), so the tool simplifies them (a tree is now
    400–700 triangles, a twisted giant about 1,300; leaf cards are thinned out
    and made bigger), bakes bark / wood / metal / the grass palette into vertex
    colours and packs the cut-out leaf shapes, plants, flowers, rocks and stones
    into one 1024 × 1272 atlas. No normal maps. Leaf crowns are stored grey and
    get their colour when placed (`tint`), so one mesh gives light, dark and
    autumn trees.
  - **One material for the whole static world** (`merge.js`): vertex colours ×
    the atlas, alpha test for the leaf shapes, double-sided; plain painted
    geometry has uv (0, 0) = a white texel. So trees with cut-out leaves and
    textured rocks sit in the same per-cell mesh as the old props: no extra
    draw calls (the two old buckets "front side" / "double side" became one;
    41 → 33 batch meshes). `world.batch.addQ(model, matrix, { tint, mul })`;
    in `decor.js`, `put` / `inst` take pack names too.
  - **Replaced:** all KayKit Forest Nature trees / bushes / rocks / grass
    (`assets/nature/` deleted) and the Kenney flowers, mushrooms, reeds, the
    park bush and the pirate kit's dune grass (files deleted). Forest = leaf
    trees + pines + 6 huge twisted trees, up to 114 in all (was 150), dense in the
    middle and **thinning out to 15 m beyond the zone's edge** (this is the
    "trees thin out" part of item 10), ferns and big leafy plants as
    undergrowth; Meadow = 34 single leaf trees, two small autumn groves,
    flowering bushes, tall grass; Volcano = dead trees and dark rocks. Kept
    (no Quaternius equivalent): palms and all beach props, stumps, logs, tent,
    campfire, lily pads, canoe, statues / stone heads, crops and farm fence,
    playground, picnic, park lanterns / benches / fountain, signpost.
  - **5 Ground colour** (`_terrain()`, `groundNoise()`): dark mossy Forest floor
    with leaf-litter patches and a ragged edge, a grey ash ring around the
    Volcano with dark rock above it (no lawn on the cone any more), dry yellow
    and lusher green patches in the Meadow, lighter grass around each flower
    field (`world.tintGround`; mixing in the petal colours turned the green to
    grey, so the patches are fresh / yellowish / minty greens). Sand and paths
    as before.
  - **6 Grass and small plants** (`src/ground.js`): grass tufts (30 triangles
    each), clover, small ferns, fallen petals and pebbles as 5 `InstancedMesh`es
    (5 draw calls, no shadows cast) in a 23 m ring around the player; 4 m cells
    filled from a hash, so the same spot always looks the same; what grows
    follows the zone and the ground patches; nothing on paths, the deck, sand
    (pebbles only) or in water. At most about 31k triangles (the caps of the five kinds added up).
    The second quality drop (`adaptQuality`) halves it.
  - **7 Paths** (`pathDressing()` in `decor.js`): stepping stones along all
    three paths (tilted with the slope), a lantern post on the outside and a
    short fence on the inside of each bend, and a wooden gate with a banner in
    the zone's colour and two lanterns where each path reaches its zone (the
    Volcano gate stands at the end of the path, between the stone heads). The
    lantern flames are small shapes with a colour above 1 (no sprites, no extra
    draw calls). The signpost at the fork is unchanged. Posts and fences have
    colliders.
  - **See-through camera** (`merge.js` `seeThrough`, set in `world.update`): the
    shared static material does not draw what lies between the camera and the
    player's chest inside a tube around that line (2.3 m wide at the camera,
    1.25 m at the player, dithered edge, stops 0.7 m before the player). It
    covers everything in the batch: crowns, trunks, bushes, rocks, big
    mushrooms, the house, gates. Not the terrain, water, eggs, crabs, pens or
    the grass near the player. The shadow pass uses its own depth material, so
    a tree with a hole still throws its whole shadow. `world.seeThrough = false`
    switches it off (for comparing).
  - **Also fixed:** a crab that started right beside a trunk could not move
    (every step counted as "into the tree"); steps away from a collider are
    now always allowed (`thieves.js`).
  - **Draw calls / triangles**, same cameras as Step 1, headless 1366×768, all
    zones open, shadow pass included. "World only" = eggs and crabs hidden,
    which is the fair comparison: the total changes from run to run with the
    eggs and crabs in view (3–7 calls each).

    | View | Step 1, all | Step 2, all | Step 1, world only | Step 2, world only |
    |---|---|---|---|---|
    | Home | 30 / 126k | 34 / 175k | 30 / 126k | 34 / 175k |
    | Beach, ground | 55 / 137k | 52 / 147k | 24 / 118k | 24 / 132k |
    | Beach, from above | 35 / 124k | 49 / 144k | 20 / 113k | 20 / 129k |
    | Forest | 54 / 170k | 62 / 213k | 24 / 154k | 30 / 197k |
    | Volcano | 67 / 150k | 72 / 171k | 33 / 130k | 38 / 151k |
    | Meadow (towards the pond) | 80 / 180k | 95 / 231k | 36 / 157k | 36 / 203k |
    | Pond | 58 / 159k | 67 / 199k | 29 / 144k | 29 / 184k |

    (Step 1 columns measured again today from the committed version.) World
    draw calls: +0 to +6 (5 of them are the grass). **Triangles: +12 % to
    +39 %**, more than the +20–30k planned for item 6 alone, because the
    Quaternius trees and plants are heavier than the KayKit ones even after
    simplifying (static world 211k → 280k triangles). Views across the whole
    island are the heaviest: from the fork looking north 306k → 422k, and the forest gate 218k → 314k,
    both measured before the last trim (static world 319k → 280k) and not again.
    Colliders 354 → 401. Game size without `assets/animals/`,
    `assets/creatures/`, `_shots/`: 6.3 MB (was 5.7).
  - **Checked (headless, EN / DE / ES):** walk test `walk2.js` after
    `stars(9)`: 9 stops without an object, all in the pond's deep water (as
    before); eggs 12 / 7 / 5 / 4 per zone; 40 forced events landed in all four
    zones; all 8 crabs move; egg card → right answer → carried, for common,
    uncommon, rare and epic eggs; see-through on / off behind trunks, under
    crowns and behind a giant mushroom; console shows only the three expected
    `/lib/*.js` 404s.
  - **Not checked:** a real Chromebook / tablet (the triangle increase, the
    cost of alpha test + no back-face culling on the static world, how the
    dithered see-through looks at low resolution), `?touch`, the base flow
    (incubators, pens, upgrades: code not touched), the game without
    `assets/animals/`. During this session the dev PC was busy with other
    headless browsers, so the headless frame rates say nothing.
  - **Notes for Step 3:** style clashes left on purpose: the Kenney stumps /
    logs / tent (flat, pale) next to the Quaternius trees in the Forest camp;
    the grey Kenney stone heads and columns; the Tiny Treats park lanterns at
    the base next to the new wooden lantern posts; the box house. Pieces to
    use: Medieval Village MegaKit for the hatchery building and yard fence
    (item 8; `Prop_WoodenFence_*` is already in the pack), Fantasy Props
    `Barrel`, `Crate_Wooden`, `Stall_Empty`, `Bench` for the yard and a
    Forest camp; `TwistedTree_*` on a hill as the Meadow landmark (item 11);
    `Rock_Medium_*` in big scales + `DeadTree_*` for the Volcano's ridges
    (item 9); `Mushroom_Laetiporus` on trunks. Add a model = one line in
    `MODELS` in `tools/build-qnature.mjs`, then rebuild.
- 2026-11-23: **World proposal Step 3 built (items 8–12): every zone has a face.**
  Fable 5.2 subagent, lead session reviews. Pictures: `_shots/step3-before-*.png` /
  `step3-after-*.png` (the seven standard views) and `step3-after-base-full.png`.
  - **The pack grew** (`tools/build-qnature.mjs`, 108 models, 26.7k triangles,
    `qnature.glb` 1.04 MB + `atlas.webp` 130 KB): walls, windows, door, roofs,
    chimney, wagon, bricks and vines from the **Medieval Village MegaKit**; barrel,
    crate, bench, bag, cauldron, stall, carrot crate, stool from **Fantasy Props**;
    pumpkin, carrot, corn, tomato, wheat from the owner's **Ultimate Crops** (the
    tool now reads OBJ + MTL itself: no Blender needed); `Rock_Lo_*` (bare grey
    rocks, 80–170 triangles) and `TwistedTree_Big`. The village kit's wall and roof
    textures repeat, so they cannot go into the atlas: walls and roofs are plain
    colours per vertex (plaster and stone are lifted to cream / sandstone, because
    the hatchery's front never gets sun); roof tiles are stored grey and tinted
    when placed. A roof went from 6,400 to 700 triangles. `Lantern_Wall` 420 → 240.
    Tints may now be `[r, g, b]` above 1 (golden wheat from the green grass models).
  - **8 Home** (`buildHatchery` in `decor.js`, footprint `HATCHERY` in `world.js`):
    a long house (14 × 8 m, half-timbered, coral tiled roof, door, windows with
    shutters, chimney) with a three-storey stone tower on its east end (16 m to the
    roof's tip) and a slowly turning **wind wheel** on the tower's front (its own
    mesh: +1 draw call); the sign is a 8.4 m board on two posts in front of the
    roof (a mesh, not a sprite any more); a wooden yard fence, open to the north,
    with a gate on each side, eight lantern posts, benches and barrels from the
    Fantasy kit (the Tiny Treats lanterns and bench are gone; the fountain stays).
    Deck, egg pad, incubators, pens, `PAD` / `INC_POS` / `PEN_POS` are unchanged.
    The farm has four beds of real crops, a fence, a wagon, a market stall, crates.
  - **9 Volcano** (`terrainH`, `_terrain`, `embers`): seven ridges and gullies, a
    little bumpy all over, a deeper crater with a lava pool (a collider keeps
    players and eggs out of it); **four lava streams** run down the gullies that
    face the island: one mesh for pool + streams with a small texture that drifts
    downhill (it replaces the old lava disc: +0 draw calls), the rock beside them
    is scorched and glows (vertex colours above 1); embers rise from the streams
    (one `Points`, only drawn when the Volcano is in view); up to nine big dark
    boulders on the ridges; the stone heads are darkened. No egg spawns in a lava stream
    (`world.noEggSpot`, used by `randomSpot` in `main.js`). Smoke puffs 10 → 7.
  - **10 Forest**: the camp (`CAMP`, `camp()` in `decor.js`) is a clearing with a
    dirt floor: an A-frame tent, a fire in a ring of stones, two log seats, a
    stool, cauldron, barrel, crates, a lantern post and a 6 m pole with a green
    banner; a trail of stepping stones leads to it from the end of the Forest
    path. Stumps and logs everywhere in the Forest are now built in code in the
    trees' bark colour (the pale Kenney ones are gone). **Haze** (`_haze` in
    `world.js`): deep in the Forest the fog turns green and close (far 190 → 78 m)
    and the sky's horizon follows; on the Volcano's slope it is warm and dusty.
    It fades in over about a second; no extra drawing.
  - **11 Meadow landmarks**: `HILL` (north-east, 5 m high) with one **huge twisted
    tree** (about 28 m), a bench and a lantern; a **stream** from the pond to the
    sea (`STREAM`, a shallow bed in a gentle valley, ankle-deep: you can wade
    through anywhere; its water is part of the pond's mesh) with a walkable **stone
    bridge** (`BRIDGE`, built in code, three arched openings; `height()` knows its
    deck like the pier's; its parapets are colliders, so you cross from end to end
    and cannot walk under it); a **wheat field with a scarecrow** beyond the bridge
    (`FIELD`); a **ruin** in the south-west near the standing stones (`RUIN`: kit
    walls sunk and tilted, one corner two floors high, vines, rubble). The old
    stone circle's Kenney columns are now standing stones made of `Rock_Lo`.
  - **12 Coast** (`coast()` in `world.js`): the island's edge moves in and out by
    −8 … +5.5 m: coves with wide sand, headlands with a grey rock strip and about
    40 boulders along the waterline (some in the water); behind the hatchery the
    land always reaches out. The **lighthouse** stands on a 3 m rocky knoll on the
    Beach's north headland (`LIGHT`; it lies outside the Beach's wall, so you can
    walk there from the start). Three **tiny islands** (`ISLETS`: pines / a rock
    stack with a dead tree / palms) lie 20–30 m off the coast, deep water in
    between; five rock stacks further out.
  - **`height()` now follows the terrain mesh** (`groundH`: the 2 m grid, cached),
    not the smooth function: on the ridges the two differ by up to 0.3 m, and feet,
    eggs and props must touch what is drawn. `terrainH` (the smooth function) is
    still what fills the grid, the sea's shore line and the minimap.
  - **Minimap**: the coast, the islands and the stream come from the height
    function; the stream, the bridge, the hill's tree and the lighthouse are drawn
    on top. Its scale is 6 % smaller (the islands fit).
  - **Removed files** (0.28 MB): Kenney stumps, logs, tent, campfire, columns,
    obelisk, sea rock, crops, farm fence, pot; Tiny Treats street lantern + bench.
  - **Draw calls / triangles**, world only (eggs and crabs hidden), same cameras
    and method as Step 2 (`measure.cjs`, headless 1366×768, all zones open):

    | View | Step 2 | Step 3 |
    |---|---|---|
    | Home | 34 / 175k | 36 / 191k |
    | Beach, ground | 24 / 132k | 28 / 138k |
    | Beach, from above | 20 / 129k | 23 / 135k |
    | Forest | 30 / 197k | 29 / 204k |
    | Volcano | 38 / 151k | 38 / 161k |
    | Meadow (towards the pond) | 35 / 203k | 41 / 233k |
    | Pond | 29 / 184k | 33 / 204k |

    Static world 280k → **314k triangles** (36 batch meshes, was 33). Where the
    extra draw calls come from (counted per object in the Meadow view): 3 more
    batch cells in view (the islands are cells of their own, and cells with tall
    things have bigger bounds), the lighthouse beam, and clouds (their positions
    changed; they have their own random stream now, so later steps won't move
    them). Triangles per view: +3 % to +15 %. Colliders 401 → 621 (fences, the
    bridge's parapets, coast boulders; they sit in a grid, so this costs nothing
    measurable). Game size without `assets/animals/`, `assets/creatures/`,
    `tools/creatures/`, `_shots/`: 6.3 MB (as before: +0.21 MB pack, −0.28 MB
    removed props).
  - **Checked (headless; all of it in EN and in DE without `assets/animals/`
    (`BLOCK`), the base flow also in ES, the start also with `?touch`):** new
    save: egg card → right answer → carried → egg pad → incubator → hatch → pen
    (state), buying pens and incubators shows them and moves the ghosts (12 pens +
    6 incubators in `step3-after-base-full.png`); after `stars(9)`: all walls
    open, 8 of 8 crabs move, eggs 12 / 7 / 5 / 4 per zone (one Meadow egg was
    carried in the test), 40 forced events land in all four zones, no egg in the
    lava, in the stream or on the bridge; walk test `walk2.js`: 9 stops without
    an object, all in the pond's deep water (as before); `walk3.js` (beach, islet,
    pier): the islet and the pier head are reachable, the stops without a collider
    are at the wading limit or beside the pier deck (as before); new `walk4.js`
    (scratchpad `s3/`): over the bridge both ways, wading across the stream at 5
    places, up the hill, to the lighthouse, the camp, the field, the ruin and the
    crater's rim: all reached; the three tiny islands are not reachable; 2 stops
    without a collider (the sea at the stream's mouth, the pier's side). Console:
    only the three expected `/lib/*.js` 404s (plus the blocked animal files in
    the `BLOCK` run). See-through: seen working on trunks in the Forest; behind
    the hatchery the camera moves in front of the building's colliders instead
    (as with any big collider).
  - **Not checked:** a real Chromebook / tablet (the +34k triangles, the lava
    texture and the haze on a real screen), `?touch`, how the haze feels while
    walking in and out (headless runs at 1–2 frames per second: the dev PC was
    busy), thief crabs meeting the lava pool's collider or the stream in play,
    the minimap at phone size.
  - **Left as it was / to decide:** the Tiny Treats fountain, playground and
    picnic at the base (no Quaternius equivalent); the Kenney stone heads (only
    darkened); the pirate-kit lighthouse tower (it fits the Beach); the wide teal
    home beacon; the walls of the hatchery are plain colours (no brick or plaster
    texture, see above); the sign text is English in all languages (as before).
- 2026-11-23 (pause): **world step 4 (items 13–15: wind, water life,
  beach extras) is HALF DONE and NOT committed** — the Fable agent was
  stopped mid-run at the owner's request (usage limit). Uncommitted:
  `src/decor.js`, `src/ground.js`, `src/merge.js`, `src/world.js`, new
  `src/waterlife.js`, new `assets/props/watercraft/` (Kenney Watercraft
  Kit), `assets/CREDITS.md`, `WORLD-PROPOSAL.md`. Smoke test passed (game
  starts, egg pick-up works, no console errors). Next session: read
  `git diff games/verb-hatchery`, finish items 13–15 (see WORLD-PROPOSAL.md
  and the step-4 brief: wind via a per-vertex sway weight baked in
  merge.js, splashes, jumping fish, sailing boat, beach hut/shells/buoys,
  stream contrast, fading the home beacon), verify (walk tests, base flow,
  `BLOCK=assets/animals`), commit. Crab steering was changed by the lead
  (committed). After that: wire the 60 creatures (`assets/creatures/`) into
  the game, plus the missing Ultimate Monsters from the owner's download.
- 2026-11-25: **world step 4 (items 13–15) finished and committed** by the
  lead (Opus) from the stopped Fable run; nothing new was needed beyond
  testing. Built: wind (`merge.js`: per-vertex `aSway` = bend + flutter
  written by `setSway()` per model kind — tree, bush, plant, palm, cloth,
  buoy; same displacement in the shadow pass via `windDepthMat()` and
  before the see-through test; near-player grass sways too), water life
  (`src/waterlife.js`: splash rings when wading / landing in water, fish
  jumping in the bay, pond and near the player; two InstancedMeshes),
  two sailing boats circling far out + buoys (Kenney Watercraft Kit,
  `assets/props/watercraft/`), a lookout tower, shells and starfish on the
  beach, stream banks with more foam, a slimmer home beacon that fades
  with height and widens with distance. Checked headless: walk tests
  (walk2: only the pond's deep water; walk4: bridge both ways, stream 5/5,
  hill, lighthouse, camp, field, ruin, crater rim reached, islets not;
  2 stops flagged = waist-deep water at the wading limit), base flow
  deliver → hatch → pen, game without `assets/animals/`, forced fish jumps
  + splash rings, 46 shells, 2 boats; beach-ground view 35 calls / 126k
  triangles (all incl. eggs/crabs). Not checked: a real Chromebook (wind
  shader cost), touch beyond earlier steps. Owner note (same day): Fable
  is expensive — use it only where it clearly improves quality.
- 2026-11-25: **the 60-creature collection is in the game** (lead, Opus).
  New `src/roster.js`: loads `assets/creatures/creatures.json` (top-level
  await), creature id = roster id (`fox`), golden version = id + `*`
  (`fox*`); models load on first use and are cached (`preload()` of the
  zone's creatures when an egg is picked up); idle clip always playing, a
  random jump / eat / fun trick every 4–10 s; swimmers and flyers bob at
  their `hover` height; golden = gold-tinted, shiny, earns ×3
  (`GOLDEN` in balance.js, 4 % per hatch, own ✨ mark in the Book).
  `creatures.js` hands roster ids to roster.js (pens, incubators, hatch
  animation unchanged); unknown ids fall back to a code-built stand-in.
  Hatching (`state.js` `hatch`): a creature of the egg's zone with the
  egg's rarity (nearest rarity if the zone has none). Egg weights per zone
  changed so every roster rarity can hatch: Meadow 55/35/10 + event epic
  (Bunbun), Forest 40/40/20 + event epic, Beach 25/35/30/10 + event
  legendary (Squidle), Volcano 15/30/35/20 + event legendary (Drakonix).
  Pens show creatures at their real height ×1.7 (at least 1.1 m, at most
  2.4 m). Book: one section per zone, sorted by rarity, icons /
  silhouettes from the pipeline, found count per zone, ✨ for golden.
  Book goals: 5, 15, 30, 60. Save version 4 (older saves dropped). The
  Quirky animals (`src/animals.js`, git-ignored files) are no longer
  loaded; their licence question is moot. Not done: the 5 extra Ultimate
  Monsters from the owner's download (add via `tools/creatures/`), a real
  Chromebook check of many animated creatures in view.

## Play-test notes (owner, 2026-11-25) — all built 2026-11-25 (see below)

Owner: "collect comments before rebuilding".
1. **Creatures look sad / scary**: too dark under the scene lighting
   (tone mapping + Lambert/standard materials of the Quaternius GLBs);
   some look scary because of it.
2. **Unbought incubators are invisible obstacles** (their colliders exist
   before they are bought).
3. **Eggs stacked above the head** while carried: owner doesn't like it;
   needs a better way to show the backpack's eggs.
4. **Crab "battles" unclear**: barely noticeable that you are hunted; when
   caught, the question card blocks everything and it's hard to see what
   happens; the end of the encounter is unclear → needs better build-up,
   encounter presentation and outcome.
5. **Hatching creature should face the player** (it pops out of the egg
   looking at the player, not in a fixed direction).
6. **Windmill sails should turn the other way.**
7. **Top messages overlap** (hatch banner, star toast, event banner).
8. **"Find N creatures" goals must count the Book, not the pens.**

Built (lead, Opus, 2026-11-25):
- 1: creature materials get a soft fill of their own colour (emissive ≈
  0.42 × colour, or the texture as emissive map) and a little more
  brightness (`roster.js` load); golden ones keep their gold glow.
- 2: pen / incubator colliders exist from the start but are `.off` until
  bought (`world.setOwned` → `penCols` / `incCols`; `nearColliders` skips
  `.off`).
- 3: carried eggs hop along **behind** the player like ducklings
  (`player.js` `showCarry` / `trailPoint` / `_updateTrail`: each egg 1 m
  further back along the player's recent path); a picked-up egg hops from
  its nest to the end of the line.
- 4: crab encounters: a red '!' over a chasing crab, a pulsing red screen
  edge + heartbeat sound + hint "A crab is after your eggs! Run!"; on a
  catch the world stops for ~0.85 s (camera turns to the crab, it snaps at
  your last egg), then a **compact card at the bottom** over a light shade
  so the scene stays visible. Right → the crab is thrown back and dizzy,
  "💥 Egg saved!". Wrong → it runs off with the egg; for `THIEF.fleeTime`
  (10 s) a hint counts down "Catch the crab to get your egg back!";
  catching it (≤ 1.7 m) returns the egg and leaves the crab dizzy
  ("Got it back!"), else "The crab got away with the egg." Events
  `thief_catch` result bonk / stolen / recovered / escaped.
- 5: the hatched creature turns to face the player, does a jump, and stays
  1.6 s before it hops (turning) into its pen.
- 6: wind wheel turns the other way.
- 7: `#topStack` under the coins: event banner, hatch banner and toasts
  stack in one column (measured: no overlap).
- 8: was already Book-based (`bookCount` = entries in `s.book`, releasing
  doesn't lower it; checked); goal text now says "(Book)" / "(Buch)" /
  "(libro)" to make it clear.
Checked headless (machine heavily loaded by another session's leftover
headless Chrome, so mostly state checks instead of screenshots): egg
trail, hunted hint, compact card, steal → chase → recover, bonk, banner
stacking. Not checked by eye: brightness of all 60 creatures, the
heartbeat volume, touch.
- 2026-11-25: **site question engine checked** (site-like server: game
  files + `lib` / `data` symlinks to `homepage/`, port 8165): `source:
  engine`, tier pools 1/2/3 right, answers recorded in `krabsy_stats_v2`.
  Added the **smart mix** (`questions.js`: per tier a queue from
  `getChainSet({ tiers: [t], count: 6, smart: true })`, refilled when
  empty; picks come from it first). Local fallback unchanged.
- 2026-11-25: **first-minutes guidance** (new players only, `st.tutDone`):
  a practice egg 9 m in front of the spawn, a bouncing amber arrow and a
  teal coach box (`#coach`): walk to the egg → pick it up → bring it to the
  pad → it hatches in 8 s → hatch it → "earns coins, find more eggs, buy
  upgrades" (8 s) → done. Touch texts use ✋ / ⬆️. No event egg during
  the guidance. Event `tutorial {step}` 1–6. Checked headless (all steps).
- 2026-11-25: **Hall of Fame + Book swap** (owner idea: a second area for
  the most valuable pets, "inside the barn"). `src/hall.js`: its own room
  far out at sea (`ROOM` x 0, z 420; 22 × 16 m, 7.5 m tall; the fog hides
  the island): planks, red carpet, plaster walls with a timber frame, warm
  windows and lanterns, a "Hall of Fame" banner, 8 pedestals (U shape).
  In / out: E at the barn's front door (`BARN_DOOR`) / at the hall's door,
  a 0.35 s fade (`goHall`). `player.indoor` = room bounds: no island
  checks, the floor is the room's, the camera stays inside the walls.
  Pedestals: 3 at the start, `UPGRADES.hall` (+1 each, up to 8); creatures
  there earn `HALL.bonus` ×1.5. **Book swap:** every found creature (and its
  golden version, if found) can stand in one place at a time; E at an empty
  pen or pedestal opens a picker (`#pickPanel`, sorted by income); "Release
  for coins" became **"Back to the Book"** (no coins: placing again is
  free, so coins would be an endless money trick). State: `s.hall`,
  `place()`, `toBook()`, `available()`, `placedSet()`; cps includes the
  hall. Events `hall_enter`, `creature_placed`. Checked headless: enter,
  target pedestal, place, leave, income.
- 2026-11-25: **music + sound modes** (`audio.js`): procedural island loop
  (C major pentatonic, C–Am–F–G, 96 bpm: marimba plucks, soft pad, bass),
  moods 'calm' / 'chase' (a crab hunts you or runs with your egg: busier
  bass, kick, shaker) / 'hall' (Hall of Fame: chimes, no bass); a creature
  "voice" (chirp, pitch by size) when it hatches and when you look at it.
  The speaker button cycles 🔊 all → 🔈 effects only → 🔇 off (saved;
  `?sound=off`, `?music=off` for teacher links); audio pauses while the
  tab is hidden. Not heard by a human yet.
- 2026-11-25: **words to practise** (`state.js` `trackWord` / `wordsToPractise`,
  `s.words`): every missed verb is listed at the top of the Creature Book
  as a full chain (newest first, max 12); it leaves the list after two
  later right answers (a ✓ after the first). Checked headless (two wrong
  answers → two chains in the Book).
- 2026-11-25: **crab raids on the base** (`src/raid.js`, `RAID` in
  balance.js): from 2 ★, while the player is > 45 m from home (not in the
  hall, not during the guidance) and an incubator holds an egg, a crab
  sneaks in now and then (first after 180 s, then every 240–420 s): red
  banner with countdown / arrow / distance (`#raidBanner`), home blinks red
  on the minimap. It walks slowly (0.75 m/s) to the incubator, grabs for
  4 s. Reach it first → question card (compact): right = it spins away,
  "Hatchery defended!"; wrong or too late = it runs towards the sea with
  the egg for 22 s (1.5 s head start); catch it = the egg goes back into
  the incubator. Events `raid {result: start|bonk|stolen|recovered|escaped}`.
  QA: `hatchery.startRaid()`, `hatchery.skipTut()`. Checked headless:
  start + banner, defend, stolen, recovered.
