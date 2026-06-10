# Verb Valley — proof-of-concept brief

You are building a new game for **Krabsy** (krabsy.com), a browser-based
English-grammar learning site for German- and Spanish-speaking school kids
(roughly ages 10–14). The site has a catalogue of arcade games that drill
irregular verbs (Verb Slash, Verb Snake, Verb Flow, Air Control, a 3D
platformer). This folder is yours; the brief below is everything you need.
You do not have — and do not need — access to the rest of the repo except
the read-only references listed under **Data**.

## The game in one paragraph

**Verb Valley** is a cozy 3D farming life-sim — Stardew Valley's loop,
shrunk to browser size, with learning woven into the day. There is a
running clock and a **day/night cycle**: mornings start at school
(English class = grammar questions), and **only after class can you work
the farm** — plant seeds, water crops, harvest after a few in-game days,
chop trees, sell produce, buy better seeds and tools. When night falls
you go to bed, the world saves, and tomorrow the crops you watered have
grown. The endgame vision is "Stardew with grammar"; this PoC builds the
core day loop and makes it feel wonderful.

## Story (the framing — keep it light)

You spend the summer at your grandparents' overgrown coastal farm. The
deal your parents made: every morning you attend the village's tiny
open-air beach school (a bench, a blackboard, and **Professor Krabsy**,
a scholarly crab 🦀). After class, the farm is yours to bring back to
life. Grandpa left a note: "The fields remember everyone who works
them." That's all the plot the PoC needs — charm over lore.

## The daily loop (this IS the game — build exactly this)

```
06:00  wake up at the cottage, fresh energy, day counter +1
06:00–08:00  free time: water crops? walk around? (tools UNLOCKED only
       after school, so mostly: get to class)
08:00  school bell rings — Professor Krabsy waits at the blackboard
       CLASS: ~8 grammar questions, one at a time. Rewards scale with
       correct answers: coins + (at 6+ correct) a SPECIAL SEED packet.
       Class is skippable in UI terms only: farm tools stay locked any
       day you haven't attended. The bell nags you, gently.
09:00–~20:00  farm time: till, plant, water, harvest, chop, shop, explore
~20:00  dusk — light turns golden, then dark; a sleepy vignette grows
24:00  if still up, you doze off where you stand (Stardew style) and
       wake at the cottage
SLEEP  = save game + advance the world: watered crops +1 growth stage,
       unwatered crops pause (they never die in the PoC — kind world)
```

- **Time scale:** one in-game day ≈ **7–8 real minutes** (school ~1.5 of
  them). A visible clock + day counter sits in the HUD.
- Sleeping early skips dead time — going to bed any time after 18:00 is
  allowed and jumps straight to morning.

## School (the learning core — make it delightful, not dutiful)

- Open-air classroom: bench, standing blackboard, Professor Krabsy.
  Class = **8 multiple-choice questions** rendered on the blackboard
  (chalk text!): mostly irregular verbs (*"simple past of GO?"* — three
  chalk answer chips), with prepositions as an occasional lesson variety
  (*"My birthday is ___ July"* — in/on/at). Mix slots: past one day,
  participle the next.
- Use the site-wide form-color convention: **base = amber, past = teal,
  participle = coral**. Wrong answer → Professor Krabsy kindly shows the
  full chain (`go → went → gone`) before the next question.
- **Rewards:** ~5 coins per correct answer; 6+ correct earns a **special
  seed packet** (rare crop, sells high); 8/8 earns a star sticker (pure
  cosmetic pride — show a sticker row somewhere in the cottage).
- Class ends when the 8 questions are done (~60–90 s). Re-attending the
  same day gives no extra reward (one class per day).
- Track missed verbs across days; Professor Krabsy opens the next class
  with one "review question" from yesterday's misses. (This tiny spaced
  repetition is the pedagogical heart — do not cut it.)

## The farm (PoC scope)

- **Plots:** a fixed field of ~24 tillable tiles near the cottage. Till
  with the hoe (free starting tool), plant a seed, water it (watering
  can, free), sleep to grow. Crop states are readable at a glance:
  seeded → sprout → growing → ready (bobbing + sparkle).
- **Crops (3 + 1 special):** e.g. turnip (2 days, cheap), tomato
  (3 days, medium), pumpkin (5 days, pricey), and the school-reward
  special (e.g. "star fruit", 3 days, sells very high). Buy regular
  seeds at a small shop stand; the special is school-only.
- **Watering:** once per day per tile (visible wet/dry soil color). The
  can never runs out in the PoC (refill mechanics are v1.1).
- **Foraging:** a few trees regrow every 2 days; an **axe** is the first
  big purchase (~50 coins) and chops them for wood (sells, or stockpiles
  for v1.1 building). Wild berries spawn daily for free pocket money.
  (Pickaxe/stones: v1.1 — see roadmap.)
- **Selling:** a shipping crate by the cottage — toss produce in,
  coins arrive when you sleep (Stardew homage). Simple shop stand sells
  seeds + the axe. That's the whole economy loop: school → seeds →
  crops → coins → tools → faster farming.
- **Hard gate (the user's core rule):** every farm interaction (hoe,
  plant, water, harvest, chop) is disabled until you've attended school
  *that day*. Interacting while locked → the character shrugs and a
  speech bubble points at the school bell. Make the gate diegetic and
  friendly, never a popup scolding.

## World & feel

- One compact scene: cottage + bed, the tillable field, shop stand,
  shipping crate, the beach school, a handful of trees, a pond (decor
  for now — fishing is v1.1), fences/paths for readability. Small
  enough to cross in ~15 seconds.
- **Day/night is the showcase.** Spend your "wow budget" here: the sun
  arcs, shadows lengthen, golden-hour glow at dusk, warm windows after
  dark, fireflies at night, a star field, soft morning fog. This game
  sells itself with one screenshot of dusk.
- Third-person character with a slightly elevated follow camera (gentle
  Stardew-ish down-angle). WASD/arrows to move, E / click to interact,
  number keys or a hotbar to switch tools. Touch is nice-to-have.
- Player character: a charming primitive-rig kid (grouped
  boxes/spheres, squash-and-stretch walk, big hat). Professor Krabsy is
  a red crab with reading glasses and a tiny mortarboard. Animate with
  code (bobs, leans, anticipation) — charm over fidelity.

## Non-goals for the PoC (v1.1+ roadmap — write code that won't fight these later)

- Animals (cow/sheep/chickens: buy, feed, daily produce)
- Fishing at the pond (timing minigame)
- Pickaxe + stones/ore, cave or quarry corner
- Energy/stamina system, watering-can refills, crop wilting
- NPC villagers, friendship, festivals
- Farm expansion / building with wood
- DE/ES localization of game UI (site convention: game UI is English)
- Site integration (wrappers, catalogue) — master session handles later

Keep the save format and day-advance logic extensible (e.g. a single
`advanceDay(world)` function and versioned save schema) so 1.1 features
slot in without rewrites.

## Tech conventions (match the rest of Krabsy)

- **Stack:** Three.js **0.169** via CDN import map, exactly like the
  existing 3D game:
  ```html
  <script type="importmap">
  { "imports": {
      "three": "https://unpkg.com/three@0.169.0/build/three.module.js",
      "three/addons/": "https://unpkg.com/three@0.169.0/examples/jsm/" } }
  </script>
  ```
  Plain ES modules, **no build step, no npm, no TypeScript**.
- **No external assets** (no GLTF/images/audio files): Three.js
  primitives, procedural canvas textures, vertex colors, emissive
  materials. If this PoC convinces, an asset pack gets bought for v1.1.
- **Files:** `index.html` + `src/*.js` modules (game.js, world.js,
  daycycle.js, player.js, farming.js, school.js, shop.js, save.js,
  ui.js, audio.js, verbs.js — shape as you see fit, keep modules
  focused).
- **Look & feel:** Krabsy house style for all UI — teal `#2ee6c0`,
  coral `#ff8585`, amber `#ffcf5e` on deep navy; Fredoka One + Nunito
  via Google Fonts; rounded chips/buttons; start screen with emoji
  mascot + how-to rows + big primary button (other Krabsy games follow
  this pattern exactly — keep the family resemblance).
- **Audio:** WebAudio synth only: school bell, chalk squeak, watering
  sprinkle, harvest pop, coin chime, cricket loop at night, morning
  birds. Mute toggle persisted (`krabsy_vvalley_sound`).
- **Save system (required):** full world state in localStorage
  (`krabsy_vvalley_save`, versioned JSON): day, coins, inventory,
  tools, plot states, tree states, school stats incl. missed-verb list.
  Auto-save on sleep; "Continue / New Farm" on the start screen.
- **Performance:** 60 fps mid laptop; ONE shadow-casting light (the
  sun/moon); merge static geometry; reuse materials; fog for distance.

## Verification (do this, don't skip it)

- Serve statically (`python3 -m http.server`) and verify in a real
  browser. **Known issue:** the interactive preview's screenshot tool
  can hang (suspended renderer). Proven workaround: **headless Edge** —
  `msedge --headless=new --disable-gpu --window-size=900,600
  --screenshot=out.png "http://localhost:PORT/?qa=dusk"` — and support
  `?qa=` params for frozen deterministic scenes (morning, school-open,
  field-with-crops, dusk, night) exactly for this purpose.
- Expose a QA hook (`window.__VV`) that can set the clock, skip days,
  grant coins/seeds, teleport, and read state — then drive the FULL loop
  programmatically: school → unlock → plant → water → sleep → grow →
  harvest → sell → coins. Assert each step.
- Test save/load round-trips (save, reload page, world identical) and
  the school gate (farm actions rejected pre-class, accepted after).
- Zero console errors; check FPS at dusk (shadows + fireflies = worst
  case).

## Definition of done

- A stranger can play three full in-game days unaided: attend class,
  earn a special seed, grow + harvest a turnip, sell it, and buy
  something — and the dusk moment makes them screenshot it.
- The school gate, growth-on-sleep, save/load, and missed-verb review
  all verified programmatically.
- The world feels alive at every hour of the clock (lighting states
  checked via the `?qa=` scenes).
- This file's **Status log** is updated; work is committed (commits stay
  inside this folder).

## Data

Canonical question data (read-only references):
- `../../content/irregular-verbs.json` (155 verbs)
- `../../content/prepositions.json` (99 items, DE/ES explanations)

Inline curated subsets in `src/verbs.js` (~40 verbs ordered by
frequency, shape `{v:'go', past:'went', pp:'gone'}`) and a dozen
preposition items for lesson variety. Distractors must be plausible
(regularized forms like "goed", swapped past/participle, similar verbs).

## Working agreements

- You own only `games/verb-valley/`. Don't modify anything outside it.
- Commit locally as you go; never push.
- Keep this CLAUDE.md current — it is the only memory between sessions.

## Status log

- 2026-06-10 — Brief written by the master session. Nothing built yet.
- 2026-06-10 — **PoC built and verified.** `index.html` + 10 modules in
  `src/` (config, verbs, audio, save, world, daycycle, player, farming,
  school, ui, game). Everything in the brief's daily loop is in:
  - **School:** 8 chalk questions on the 3D blackboard (raycast-clickable
    chips + keys 1–3), form-color convention (past=teal, pp=coral,
    prep=amber), wrong answers show the full chain, rewards 5c/correct,
    special star-fruit seed at 6+, sticker at 8/8, one class per day.
    Missed verbs persist in the save; the next class opens with a review
    question and a correct answer graduates the verb off the list.
  - **Farm:** 24 plots (till/plant/water/harvest), 4 crops, growth on
    sleep via `advanceDay()` in save.js, 5 regrowing trees + axe (50c),
    daily wild berries, shop stand, shipping crate that pays on sleep.
  - **Hard gate verified:** every farm action routes through one gated
    wrapper in game.js; pre-class attempts return `school-gate` and show
    the shrug bubble. Berry-picking is deliberately ungated (gives the
    06:00–08:00 window something to do).
  - **Day/night:** keyframed sky/fog/sun/ambient, sun arc with one shadow
    light, golden dusk, emissive cottage windows, fireflies + stars
    (soft-dot sprite texture — plain Points render as squares), morning
    fog, sleepy vignette, WebAudio cricket/bird ambience.
  - **Verification done:** `?qa=` scenes (morning, school-open,
    field-with-crops, dusk, night) screenshotted via headless Edge;
    `window.__VV` drove the full loop — 37 assertions PASS (gate,
    class rewards, review graduation, plant→water→sleep→grow→harvest→
    ship→coins, shop, axe+tree regrow, berries, save/load round-trip
    across a reload). Zero console errors. `__VV.benchmark()` (rAF-free,
    because the preview panel suspends rAF): 13.6 ms/frame at dusk ≈ 74 fps.
  - `.claude/launch.json` serves this folder on :8132 via WSL python3.
  - **Known gaps for v1.1:** touch controls, watering-can refills,
    sticker row only shows in HUD + sleep card (no cottage interior),
    class camera is a fixed angle, no Krabsy idle dialogue.
