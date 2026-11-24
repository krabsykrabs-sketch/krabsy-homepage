# Verb Catapult — game brief

You are the **game session** for Verb Catapult on **Krabsy** (krabsy.com):
a free browser site where German- and Spanish-speaking kids (about 10–14)
practise English irregular verbs. Read the repo-root `CLAUDE.md` once for
the site rules, then work only in this folder. The master session releases
games (wrapper pages, `games.json`, sitemap, deploy). You don't touch
`homepage/` or other games, and you don't push or deploy. Stage only this
folder, in the same command that commits: `git add games/verb-catapult && git commit …`.

Status: **milestones 1–3 built 2026-11-22** (physics, question loop, KayKit
art; level 1 with 3 castles). Next: milestone 4 (levels 2–6, `?edit=1`
editor, mobile/touch pass), after an owner play-test of level 1.

### How to run / test

- `python3 tools/serve.py` → http://localhost:8141/ (`?lang=de|es|en`,
  `?castle=N` jumps to castle N, `?qa=perf` fps/bodies/step counter,
  `?qa=normal` never a special stone).
- `node tools/sim.mjs [level] [stone]`: headless (no browser) check that
  every castle stands still for 6 s, then a greedy best-shot run.
- `node tools/frac.mjs [level] [stone]`: share of shots over an
  angle × power grid that down 0/1/…/all skeletons (tuning).
- `node tools/shot.cjs "<query>" out.png [w h] [js…]`: headless screenshot;
  `window.__VC` has `start(n)`, `card()`, `answer(right)`, `aim(deg,pow)`,
  `shoot(deg,pow)`, `info()`.

### Code map

- `src/physics.js`: planck.js simulation, no Three.js (runs in node).
  Materials, skeleton, stone types and damage live here.
- `src/main.js`: scene, camera fit, aiming, card, castle/level flow,
  results, analytics, QA hooks.
- `src/art.js`: models on the bodies (crates = `crate_A_big`, planks and
  pillars = `resource_lumber`, hay, cut stone = plain boxes, stones =
  faceted procedural rocks, bomb = `barrel`, cannon = `projectile_cannonball`),
  `Skeleton` (Spawn_Ground → Idle_A, Hit_A, Death_A; a dying skeleton keeps
  its momentum and lands before it bursts into bones; `type: "warrior"` in
  the level data = `Skeleton_Warrior`), `Catapult` (the KayKit arm swings;
  the stone leaves the cup at RELEASE = the physics launch point, mirrored
  in `physics.js` LAUNCH for the node tools), `buildWorld` (meadow scenery).
- `src/assets.js`: loader + `fit(name, w, h, d)` (stretch a model into a
  body's box). `src/chars.js` copied from the Dungeon.
- `tools/preview.html`: a model sheet for picking art
  (http://localhost:8141/tools/preview.html).
- `src/questions.js` + `src/verbs.js`: copied from Verb Dungeon (engine
  pairs, inline fallback). `src/i18n.js`, `src/audio.js`.
- `levels/level1.json`: castles (block centres; skeleton `y` = feet).
- `vendor/planck.min.js` (1.0.6, MIT, loaded as a classic script →
  `window.planck`; `vendor/package.json` marks it CommonJS for node),
  `vendor/three/` (0.169, from the Dungeon).

## Why this game

The owner wants a game that copies a **proven mechanic** instead of a new
invention, and named the Angry Birds kind: a slingshot/catapult, physics,
towers that fall down. We copy the **gameplay only**: our own name, our
own characters and the KayKit look. No birds, pigs, names, art, sounds or
level layouts from that game.

It also fits what makes Verb Kitchen work (see `games/verb-kitchen/CLAUDE.md`):

- **Self-paced question moment.** Between shots nothing moves; the player
  answers when ready, and only then aims.
- **Grammar drives progress.** No answer, no stone.
- **Fixed camera, simple controls.** The whole scene is visible; one drag
  aims, the same on mouse and touch.
- **Short levels with stars.** One castle takes 1–2 minutes.

## The game

Goofy skeletons (KayKit Skeletons) have built wobbly forts of crates,
planks and stone blocks on a meadow. Krabsy's catapult stands on the left.
Knock down every skeleton to win the castle.

### Core loop (one shot)

1. The stones lie in a basket next to the catapult (the count shows how
   many shots are left). The player taps the basket / presses Space →
   the **question card** opens (same pattern as Verb Dungeon's card:
   large, centred, the scene dimmed and paused, chips 1–3 or tap).
2. **2nd form right** (`go → ___ → ___`): a normal stone drops into the
   catapult.
3. Right after it, the **3rd form** is asked with the 2nd filled in
   (`go → went → ___`, the chain-order rule). **Right = the stone is
   upgraded** to a special stone (see below). Wrong = it stays a normal
   stone. So the 3rd form is a bonus, never a block.
4. **Wrong 2nd form:** the chip greys out and the right 2nd form is shown.
   The stone **shrinks to a pebble** (light, small: it still flies, but
   only knocks loose planks), and the shot counts as used. **The 3rd form
   is still asked**, with the right 2nd form filled in
   (`go → went → ___`), because the chain-order rule allows that and it
   keeps the pair together. Right 3rd form = the pebble becomes a normal
   stone (not a special one). The verb comes back later in the castle
   set. *(Pebble instead of a crumbled stone: suggestion from the
   2026-11-22 brief review, owner to confirm. A crumbled stone meant
   whole turns with nothing to watch for weak players.)*
5. Drag back from the catapult, release, watch the fort fall.
6. When everything has stopped (or after 4 s), the next shot.

Shot result table (the one place this is defined):

| 2nd form | 3rd form | Stone |
|---|---|---|
| right | right | special stone (the castle's type) |
| right | wrong | normal stone |
| wrong | right | normal stone |
| wrong | wrong | pebble |

**Timing (one set of numbers):** a castle has **3–4 stones** (= 6–8
questions) and takes about **1½ minutes** (a card ~10 s, a shot ~10 s).
A level has **3 castles** (the last level: 3 + boss) → about **20
questions in about 5 minutes**. Level 1 castle 1 (tutorial) has 2 stones.

**Every castle can be won with normal stones.** Skeletons stand where
toppling wood or a push off a ledge gets them, so a player who misses
every 3rd form can still clear the castle (and get 2 stars). Stone blocks
that "only big stones / bombs break" may shield *a route*, never the only
route. Special stones make it faster and score more, nothing more. Check
this for every castle in play-testing (`?qa=normal` = never a special
stone).

### Special stones (earned by the 3rd form)

Introduced one per level so the player learns them one at a time:

| Stone | Effect | From level |
|---|---|---|
| Big stone | heavier, smashes stone blocks | 1 |
| Split stone | tap / click / Space in flight → splits into three | 2 |
| Barrel bomb | explodes on impact (KayKit barrel) | 3 |
| Cannonball | fast and flat, flies through wood | 4 |

The game picks the special stone of the castle (one type per castle), so
the player doesn't have to choose.

### Stars and scoring

- Points for each skeleton knocked over, each block broken, and every
  stone left over at the end.
- Stars from the points (3 thresholds per castle, set in the level data).
- **No hard losing:** when the stones run out and skeletons are still
  standing, the player gets one extra stone ("One more try!"), but the
  castle can then give at most 1 star. After that one, the castle counts
  as done and the next one opens.
- Results screen like Kitchen's: stars, points, verbs answered right,
  missed verbs listed for review.

### Levels (6, each 3 castles)

| Level | Theme | New element |
|---|---|---|
| 1 | green meadow | wooden crates and planks; big stone |
| 2 | farm (hay bales, carts) | split stone; skeletons on high towers |
| 3 | stone fort | stone blocks that only big stones / bombs break; barrel bomb |
| 4 | harbour (boats, crates) | cannonball; forts behind walls |
| 5 | night castle (torches) | skeleton mages with shields (need two hits) |
| 6 | the skeleton king's castle | the Skeleton Golem as a boss in the last castle |

Level 1 castle 1 is the tutorial: one skeleton on one crate, two stones.

### Controls

- **Mouse / touch:** tap the basket (or anywhere when no card is open and
  the catapult is empty) → card; tap a chip; drag back from the catapult
  and release. Tap in flight = split stone.
- **Keyboard:** Space/Enter = open the card / fire / split; 1–3 = chips;
  ←/→ = angle, ↑/↓ = power (a dotted aim line shows the first part of the
  path, as long as the drag); Esc = pause.
- **Phones:** landscape is the target. In portrait, the camera zooms out so
  the catapult and the whole fort fit (like Verb Valley's portrait class
  camera); the card is full width. No "turn your device" wall.

### Topic

~~Irregular verbs only.~~ Superseded 2026-11-24: every topic, see
"Topics and languages" below (special stone = two right in a row for
sentence topics).


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

**Verb Catapult:** this replaces the old "Topic" rule (verbs only). For gap
topics the **special stone comes from two right answers in a row** (the
second question is another sentence, ideally of the same item/`q.item`)
instead of from the 3rd form. A normal stone = one right answer, as now.

## Assets

The shared KayKit library is at `/home/janah/dev/krabsy-homepage/assets/`
(gitignored, CC0; some packs are symlinks into `/home/janah/dev/_assets/kaykit/`).
Copy only the models you use into `games/verb-catapult/assets/`, and keep
the first load small (Verb Dungeon loads about 3.4 MB).

- **`KayKit_Medieval_Hexagon_Pack_1.0_EXTRA`** — `catapult` (+ colour
  versions), `cannon`, `cannonball_pallet`, `barrel`, `crate_A/B_*`,
  `crate_long_*`, `haybale`, `cart*`, `boat`, `fence_*`, `banner_*`,
  `building_*` (background), `cloud_*`. These are hex-tile pieces at
  board-game scale: scale them up a lot (the crates become the building
  blocks), and the `catapult` model has no separate arm, so the throw
  needs either a split mesh or a fake (the whole catapult rocks back and
  the stone leaves the cup).
- **`KayKit_Skeletons_1.1_EXTRA`** — `Skeleton_Minion`, `Skeleton_Warrior`,
  `Skeleton_Mage`, `Skeleton_Rogue`, `Skeleton_Golem` (+ shields,
  weapons). The rigs and animations are in the pack; Verb Dungeon already
  loads and animates them (`games/verb-dungeon/src/chars.js`), so copy
  that code.
- **`KayKit_ResourceBits_1.0_EXTRA`** — crates, boxes, piles, gold for
  the points bursts.
- **`KayKit_Platformer_Pack_1.0_EXTRA`** — plain blocks and planks
  (`platform_*`, `barrier_*`) if the crates aren't enough for building.
- **`KayKit_Forest_Nature_Pack_1.0_EXTRA`** — trees, rocks, grass around
  the scene.
- Krabsy at the catapult: optional; a KayKit character
  (Mystery Monthly "Protagonists") or none.

## Technical direction

- Plain ES modules, Three.js vendored (copy `vendor/three/` from Verb
  Dungeon, 0.169), no CDN, no build step. Dev server: `python3
  tools/serve.py` (no cache), this folder's port is **8141**.
- **Physics is the main decision, and it needs a real engine.** Falling
  stacks of blocks are too hard to write by hand. Recommended: **2D
  physics in a side view, drawn in 3D.** Everything moves in one plane
  (x/y), the models are 3D, and the camera looks from the side, slightly
  from above and at an angle, so it still looks 3D. Use **planck.js**
  (a JavaScript port of Box2D, about 200 KB, no WebAssembly) and vendor it
  into `vendor/`. Every block is a box or circle body; its 3D model
  follows the body. Rapier 2D is the alternative if planck.js is too
  slow. Don't do full 3D physics: it wobbles more, is harder to make fair,
  and is slower on school Chromebooks.
- **Stable stacks:** the forts must stand still until hit (bodies start
  asleep; enough friction; the first second after loading has no damage).
  Blocks break from impact force over a threshold (wood low, stone high).
- **Level data as JSON** (`levels/*.json`): blocks with type, position,
  rotation; skeletons; stone count; star thresholds; special stone type.
  A small in-game editor (`?edit=1`: drag blocks, save JSON) is worth
  building early, because castles are tuned by play-testing.
- **Questions:** from `homepage/lib/krabsy-questions.js`, `getQuizSet`
  with `withOptions` and the default chain order (pairs: 2nd form, then
  3rd form with the 2nd filled in). Keep an inline fallback list (copy
  Verb Dungeon's `src/questions.js` + `src/verbs.js`). No grammar terms in
  the question; use `go → ___ → ___` with the asked blank highlighted
  (teal = 2nd form, coral = 3rd, as in the Dungeon).
- **Interface texts EN/DE/ES** (`?lang=`, `src/i18n.js` like the Dungeon).
- **Analytics:** call `recordAttempt()` (from `/lib/krabsy-stats.js`) for
  every answer, and send game events via `/lib/krabsy-game-events.js`
  `gameEvent()` (spec in `docs/game-analytics.md`): `level_start {level}`,
  `castle_end {level, castle, stones, shots_used, extra_stone, stars,
  points, answers, correct}`, `level_end {level, result: 'won', stars,
  seconds, answers, correct, points, specials_earned}`. There is no hard
  losing, so `result` is always `'won'`; quitting = no `level_end` (as
  the spec says).
- WebAudio synth for sounds (catapult creak and thwack, wood crack, stone
  thud, skeleton rattle "oof", cheer).
- Target: plays smoothly on a school Chromebook and a touch tablet.
  Physics runs at a fixed step; cap the number of bodies per castle
  (about 60).

## Build order (milestones)

Physics is the risky part, so it is proven first, with plain boxes.

1. **Physics test:** planck.js, a side-view Three.js scene, a fort of
   plain boxes and a skeleton stand-in, drag-to-shoot. Pass: the fort
   stands still until hit, about 60 bodies run at 60 fps on a weak
   machine (fixed step 1/60, `?qa=` perf counter), breaking by impact
   force works.
2. **Question loop:** card, pairs, stone types per the table above, inline
   fallback + engine, i18n, results screen.
3. **Art:** KayKit models on the bodies, skeletons animated, sounds.
4. **Levels + editor:** `levels/*.json`, `?edit=1`, the 6 levels tuned by
   play-testing; then mobile/touch and analytics.

## Open questions for the owner

- Name: "Verb Catapult" or something else?
- Wrong 2nd form = a pebble (written in above as the suggestion). OK, or
  harsher (the stone crumbles, no shot) or softer (a normal stone, fewer
  points)?
- Wrong 2nd form still asks the 3rd form (with the right 2nd filled in)?
  Written in as yes.
- Krabsy at the catapult, or only the catapult?

## Log

- 2026-11-22: brief written by the master session (owner: "something like
  Angry Birds").
- 2026-11-22: brief reviewed and fixed (wrong-answer flow, shot table,
  one set of timings, castles winnable with normal stones, controls,
  portrait, analytics fields, build order).
- 2026-11-22: milestones 1–2. planck.js physics: level-1 castles stand
  still (drift < 5 cm, no damage) and a 12-body castle steps in ~0.2 ms.
  Single random shots on castle 3 down every skeleton 1% (pebble) / 9%
  (normal) / 19% (big) of the time, so the stone types are clearly
  ordered. Question card per the shot table (wrong 2nd form → pebble, 3rd
  form still asked; missed verb returns 2 cards later). Castle flow:
  extra stone, stars, leftover-stone bonus, results with missed verbs,
  `castle_end`/`level_start`/`level_end` events, `recordAttempt`. A
  random-aim bot clears level 1 (3/1/2 stars). Keyboard aim (arrows +
  Space) works. **Open:** portrait phones see a very small scene (28 m
  across 390 px). It works, but it needs a better idea (follow-cam on the
  stone, or a closer fort view between shots). The random bot clearing
  level 1 suggests skeletons may be too fragile; decide in play-testing.
  All art is placeholder (milestone 3).
- 2026-11-22: milestone 3, art. KayKit Medieval Hexagon props (one
  texture, 468 KB for 22 models) + Skeleton Minion/Warrior and the
  Dungeon's animation file; first load about 2.9 MB with Three.js and
  planck. Picked with the preview sheet: `crate_A` is the brown crate
  (`crate_B` is grey, free for a "metal" block later); the long crates are
  fruit trays, so planks are log bundles; the pack's catapult projectile is
  a spiked ball, so stones are procedural rocks. Catapult scaled 3.2×,
  arm swing 16 rad/s, release at 1.45 rad → launch point (−1.2, 3.45);
  stone odds per shot unchanged (castle 3, normal stone: 9% clear all).
  Skeletons drawn 1.4× the body height. A random-aim bot cleared level 1
  in 4 shots (8 answers) this run. **This is the main play-test question:**
  when castles fall in one shot, a level asks far fewer than the ~20
  questions the timing plan wants. Possible fixes: sturdier skeletons
  (hp / TIP), more skeletons per castle, or a castle asks for every stone
  in the basket even when the last skeleton falls early (no: that wastes
  answers). Decide after the owner plays.
- 2026-11-22: controls reworked after the owner's first try ("the controls
  need to be better"). Cause: the pull was measured in world metres, so
  full power was ~120 px of mouse on a laptop and ~35 px on a phone, and
  nothing showed the grab point or the power. Now: drag anywhere, power =
  drag length in **screen pixels** (full power = 38% of the short screen
  side, 130–300 px); launch angle clamped −8°…82°; a 2D overlay (`#ui`
  canvas) draws the grab point, a band to the finger, a power ring
  (teal → amber → coral) and an arrow the way the stone will go; the
  catapult arm winds back and trembles with the pull; the dotted path
  shows the first 55% of the flight; the last shot leaves a faint trail
  (Angry-Birds style) until the next shot; letting go with < 12% power
  cancels ("Pull further back to shoot!"), as do right click and Esc;
  arrow keys start from the last shot's angle and power. QA: `__VC.drag(x,
  y, dx, dy)`, and `tools/shot.cjs` takes `!drag x0 y0 x1 y1 [up]` (a real
  mouse drag) and `@file.png` (a screenshot mid-sequence).
- 2026-11-23: juice + layout, after the owner's second try ("can't really
  pull, the catapult is at the edge; it floats; the bucket blocks it; add
  screen shake and slow motion"). Layout: the catapult floated 0.39 m
  (the model's wheels sit at its origin) → now on the ground, so the
  launch point is (−1.2, 3.08) (`physics.js` LAUNCH updated); the view
  starts at x −9 so the cup sits about a quarter in and a full pull fits;
  the view's right edge follows the castle (`VIEW.x1` = fort + 2.5 m, at
  least 20, set in `buildCastle`); spare height goes to sky, not
  foreground grass; the bucket moved behind the catapult (x −4.3,
  z −0.5) and the camp props further left. Juice (`FX` in `main.js`):
  trauma screen shake (stone hit by force, block breaks, skeleton down,
  bomb, catapult release); a short hit-stop on hard first hits and bombs;
  dust puffs on impact; **the last skeleton falls in slow motion**
  (¼ speed, 1.8 s, eases back) while the camera leans in on it. Game time
  is scaled; clouds and the UI use real time. `__VC.FX` for QA. Portrait
  phones: still a tiny scene (open).

- 2026-11-23: shorter wait after a shot (owner: "quite some waiting at
  the end of each shot … boring"). Cause: the shot ended only when every
  body was still, including the stone, which rolled on across the meadow
  out of view (or the 8 s cap). Now: a stone that has hit something
  stops counting once it rolls on the ground or is slower than 3 m/s, and
  it gets rolling resistance after its first hit; a stone that leaves the
  picture (right of `VIEW.x1` + 4) is removed; the fort must be calm for
  0.3 s; when every skeleton is down the shot ends after the slow motion
  and the falls (no waiting for rubble); cap 6 s; leftover stones vanish
  in a dust puff. Measured on 9 fixed shots: 6.6–10.1 s → 1.8–4.8 s game
  time (the rest is a fort still falling). Full level-1 bot run: 10
  shots, 20 answers, no errors.
