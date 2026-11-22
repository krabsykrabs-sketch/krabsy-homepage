# Verb Hatchery — game brief

You are the **game session** for Verb Hatchery on **Krabsy** (krabsy.com):
a free browser site where German- and Spanish-speaking kids (about 10–14)
practise English irregular verbs. Read the repo-root `CLAUDE.md` once for
the site rules, then work only in this folder. The master session releases
games (wrapper pages, `games.json`, sitemap, deploy). You don't touch
`homepage/` or other games, and you don't push or deploy. Stage only this
folder, in the same command that commits: `git add games/verb-hatchery && git commit …`.

Status: **brief written 2026-11-22 on the owner's request, nothing built yet.**

## Why this game

The owner asked what is popular on Roblox and picked the **egg / creature
collector**. In October 2026 the most-played Roblox game was *Steal an
Egg* (about 1.28 M players on average), and *Steal a Brainrot* and *Break
and Steal an Egg* were also in the top 12. Simulation/tycoon games had
37 % of the top-100 players. We copy the **loop only**: our own name,
creatures, art and texts, nothing from those games.

The loop is: things you can grab ride past on a belt → you collect them →
they earn coins in your base → coins make the base bigger and the belt
better → rarer things. Kids come back to see their collection grow.

How it fits Krabsy:

- **Grammar is the currency.** You grab an egg by answering; harder verbs
  give rarer eggs.
- **Self-paced question moment.** When the player taps an egg, the belt
  stops and the card opens. Nothing is missed while reading; there is
  always another egg coming.
- **Coming back tomorrow** (the coins that pile up while away, eggs that
  hatch) is spaced repetition for free: the next visit asks again.
- **Fixed camera, tap controls.** Works on a Chromebook and a tablet.

This game is **different from the level-based games**: no levels, one
growing base. Stars come from goals (below), so a lesson still has a
clear "done".

## The game

Krabsy's sunny island has a **hatchery**: pens for creatures, a few
incubators, and a **conveyor belt** along the front where eggs ride past.

### Core loop

1. **Eggs ride past on the belt** (slowly, a few at a time). Each egg's
   colour shows its rarity: white (common), green (uncommon), blue
   (rare), purple (epic), gold (legendary).
2. **Tap an egg** → the belt stops, the question card opens (same pattern
   as Verb Dungeon's card: large, centred, scene dimmed and paused, chips
   1–3 or tap).
   - Common/uncommon eggs: one question (2nd form, `go → ___ → ___`).
   - Rare and above: the chain pair (2nd form, then 3rd with the 2nd
     filled in: `go → went → ___`), from harder verb tiers.
3. **Right** → the egg flies into a free incubator. **Wrong** → the chip
   greys out, the teach line shows the chain, the egg wobbles and rolls
   off the belt ("Oops!"). No coins are lost; the verb comes back later
   on another egg.
4. **Hatching:** the egg hatches after a short time (common 20 s, legendary
   a few minutes). Tap to hatch it: shake, crack, a creature pops out with
   its name and rarity. New creatures go into the **Creature Book**
   (missing ones are grey silhouettes).
5. **Creatures earn coins** in their pen (numbers float up). Rarer
   creatures earn much more. Earnings keep counting while the player is
   away, up to a cap (about 8 hours), so coming back is rewarded.
6. **Coins buy upgrades:** more pens, more incubators, faster hatching, a
   better belt (rarer eggs appear more often), decorations for the island.

The numbers grow fast (1.2K, 45K, 3.1M): that is a big part of the fun in
this genre.

### Rarity is earned, not gambled

- The rarity of an egg is visible on the belt and decides the difficulty
  of its question. Getting rare creatures means answering harder verbs,
  not luck.
- Inside one rarity, which creature hatches is random, and the chances
  are shown in the Creature Book.
- **No spin wheels, no loot boxes, no countdown offers, no real money,
  nothing that looks like a shop with prices in euros.** This is for
  school kids.

### Goals and stars (gives each lesson a "done")

A short list of goals is always shown (3 at a time, a new one when one is
done), for example "Hatch 3 blue eggs", "Earn 1,000 coins per second",
"Find 10 different creatures", "Answer 10 in a row". Each goal gives a
star; stars unlock new island areas (beach, forest, volcano) with new
creature sets.

### Rivals (version 2, not in the first build)

The "steal" part of the Roblox games needs other players. Our version:
two computer neighbours (crabs on the islands next door) whose pens you
can visit. When their guard is asleep you can **borrow** a creature by
answering 3 questions in a row correctly; sometimes they come for one of
yours, and a right answer streak locks your gate. Build this only after
the core loop has been play-tested.

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
- Fixed camera on the island, slightly from above. An "island map"
  button can move the camera to other areas; it never moves on its own
  while the player reads.
- **Questions:** from `homepage/lib/krabsy-questions.js`, `getQuizSet`
  with `withOptions` and the default chain order. Egg rarity → verb tier
  (common/uncommon tier 1, rare tier 2, epic/legendary tier 3). Missed
  verbs come back on the next eggs. Keep an inline fallback list (copy
  Verb Dungeon's `src/questions.js` + `src/verbs.js`). No grammar terms in
  the question; use `go → ___ → ___` with the asked blank highlighted
  (teal = 2nd form, coral = 3rd, as in the Dungeon).
- **Interface texts EN/DE/ES** (`?lang=`, `src/i18n.js` like the Dungeon).
- **Analytics:** call `recordAttempt()` for every answer, and send game
  events via `/lib/krabsy-game-events.js` (spec in `docs/game-analytics.md`):
  `egg_grabbed` (rarity), `egg_lost`, `creature_hatched` (rarity, new or
  not), `upgrade_bought`, `goal_done`, plus a session summary.
- WebAudio synth for sounds (belt hum, egg pop, crack and hatch fanfare
  per rarity, coin plinks, upgrade "ding").
- Target: plays smoothly on a school Chromebook and a touch tablet. Many
  creatures on screen → merge/instance the parts; cap pens visible at once.

## Open questions for the owner

- Name: "Verb Hatchery" or something else?
- Creatures from code (recommended) or a downloaded CC0 animal pack?
- Rivals/stealing in version 2, or never?
- Should progress be shared between devices later (e.g. via the class
  code from `docs/classroom-concept.md`)? School Chromebooks often clear
  their storage, so a save on the device can get lost.

## Log

- 2026-11-22: brief written by the master session after the owner picked
  the egg collector from the Roblox research (sources: bloxodes.com
  October 2026 report, livecounts.nl live charts).
