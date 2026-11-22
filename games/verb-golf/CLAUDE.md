# Verb Golf — game brief

You are the **game session** for Verb Golf on **Krabsy** (krabsy.com): a
free browser site where German- and Spanish-speaking kids (about 10–14)
practise English irregular verbs. Read the repo-root `CLAUDE.md` once for
the site rules, then work only in this folder. The master session releases
games (wrapper pages, `games.json`, sitemap, deploy). You don't touch
`homepage/` or other games, and you don't push or deploy. Stage only this
folder, in the same command that commits: `git add games/verb-golf && git commit …`.

Status: **first playable version built 2026-11-22: levels 1 and 2 (6 holes), card strokes and
word gates, mouse / keyboard / touch. Not yet play-tested by a human.** See "What exists".

## Why this game

The owner wants more 3D games in the Verb Kitchen style (see
`games/verb-kitchen/` and its `CLAUDE.md`; it held a class in Uruguay for
up to 28 minutes). What makes Kitchen work, and how golf fits it:

- **Self-paced question moment.** Golf is turn-based by nature: the ball
  lies still until you shoot, so nothing ever moves while the player
  reads. This is the best fit of all our ideas.
- **Grammar drives progress.** You can't take a stroke without an answer.
- **Fixed camera, simple controls.** One hole fits on one screen; you
  aim with one drag, which is the same on mouse and touch.
- **Short levels with stars.** Par is a star system people already know.

Mini golf is also a new genre for Krabsy, and a hole is a small scene, so
levels are cheap to make.

## The game

A cheerful mini-golf course of small floating islands in the sky. The
player putts a ball from the tee into the hole (the flag), past slopes,
walls, conveyors, bumpers and moving obstacles.

### Core loop (one stroke)

1. The ball lies still. The player taps the ball / presses Space when
   ready → the **question card** opens (same pattern as Verb Dungeon's
   card: large, centred, the scene dimmed and paused, chips 1–3 or tap).
2. **Right answer:** the card closes and the player aims and shoots.
3. **Wrong answer:** the chip greys out, the teach line shows the chain
   (as far as chain-order rules allow), **+1 penalty stroke**, the verb
   comes back later. The player then picks again until right, and shoots.
4. Ball rolls, stops. Repeat until it drops in the hole.

So the question count per hole ≈ the strokes. A level of 3 holes at
par 2–4 asks about 10–15 questions in about 3 minutes.

### Word gates (from level 2 on, the second question type)

Some strokes don't use the card. Three gates/hoops stand across the
fairway, each with a word plate (`went` / `goed` / `gone`); the base form
and blank show in the small line at the bottom (`go → ___ → ___`).
Putting the ball through the right gate opens the way (a bridge drops, a
wall sinks); a wrong gate bounces the ball back to where it was, +1
stroke, the gate greys out. A second gate row later on the same hole asks
the 3rd form with the 2nd shown (`go → went → ___`). This puts the
grammar into the world, like the Dungeon's word bridge. A wrong gate
means the verb returns later.

### Controls

- **Drag back from the ball** (slingshot): an arrow shows direction and
  power; release to shoot. Same for mouse and touch.
- Keyboard: ← → aim, hold Space for power, release to shoot.
- A small "camera to the hole" toggle or button is optional; the default
  is one fixed view per hole, fitted to the window (portrait tablets too).

### Stars and scoring

- Strokes = shots + penalty strokes. Each hole has a par.
- Level stars from the total against the level par: at or under par = 3,
  par +1 to +3 = 2, finished = 1.
- **No losing:** after par +4 strokes on a hole the ball is placed in the
  hole ("Let's go on!"), so a weak student still sees every hole.
- Results screen like Kitchen's: stars, strokes, verbs answered right,
  missed verbs listed for review.

### Levels (6, each 3 holes; themes from pack colours)

| Level | New element | Colour |
|---|---|---|
| 1 | flat greens, gentle slopes, walls; the card only | green |
| 2 | word gates, railings, arch | green |
| 3 | conveyors, arrow platforms | yellow |
| 4 | swipers and moving bumpers (timing, but only while the ball rolls) | blue |
| 5 | spring pads and jumps between islands (out of bounds = +1, back to last spot) | red |
| 6 | everything + hoops and saw traps (bounce, never "die") | neutral/mixed |

Level 1 hole 1 is the tutorial: one question, one straight putt.

## Assets

The shared KayKit library is at `/home/janah/dev/krabsy-homepage/assets/`
(gitignored, CC0). Copy only the models you use into `games/verb-golf/assets/`
and keep the first load small (Verb Dungeon loads about 3.4 MB).

- **`KayKit_Platformer_Pack_1.0_EXTRA/Assets/gltf/<colour>/`** — the course
  itself: `platform_*`, `platform_slope_*`, `platform_hole_6x6x1`,
  `barrier_*`, `railing_*`, `arch*`, `hoop`, `hoop_angled`, `conveyor_*`,
  `platform_arrow_*`, `spring_pad`, `swiper*`, `saw_trap*`, `flag_A/B/C`,
  `ball`, `star`, `diamond`, `signage_*`. About 4.4 MB per colour; take a
  subset.
- **`KayKit_Forest_Nature_Pack_1.0_EXTRA`** — trees, bushes and rocks on
  the island edges.
- **`KayKit_Mystery_Monthly_Series_5`** (Protagonists, Hiker) — optional
  golfer standing at the tee, cheering animation when the ball drops.
- Look at `games/verb-platformer/` too: it already uses the platformer
  pack and has sky islands and clouds (`assets/scenery/`, tracked) you can
  copy.

## Technical direction

- Plain ES modules, Three.js vendored (copy `vendor/three/` from Verb
  Dungeon, 0.169), no CDN, no build step. Copy `tools/serve.py` from
  Verb Dungeon (no-cache dev server); this folder's port is **8140**.
- **Grid-built holes.** Build each hole from 2×2 platform tiles on a grid
  (flat, slope with a direction, wall edges, hole, conveyor …), defined
  as data in `src/holes.js` (or JSON). Then ball physics only needs to
  know the tile shapes: roll on a height field with slopes, friction,
  bounce off wall edges and round bumpers, fixed time step. No physics
  library needed. Decide early and keep it simple.
- **Questions:** from `homepage/lib/krabsy-questions.js`, `getQuizSet`
  with `withOptions` and the default chain order (the 3rd form only
  directly after the 2nd, with the 2nd filled in). Keep an inline
  fallback list (copy Verb Dungeon's `src/questions.js` + `src/verbs.js`).
  No grammar terms in the question; use `go → ___ → ___` with the asked
  blank highlighted (teal = 2nd form, coral = 3rd, as in the Dungeon).
- **Interface texts EN/DE/ES** (`?lang=`, `src/i18n.js` like the Dungeon).
- **Analytics:** call `recordAttempt()` for every answer, and send game
  events via `/lib/krabsy-game-events.js` (spec in `docs/game-analytics.md`:
  `level_start`, `level_end`, plus `hole_end` with strokes and par).
- WebAudio synth for sounds (putt tap, roll, wall clunk, drop in the cup,
  cheer).
- Target: plays smoothly on a school Chromebook and a touch tablet.

## What exists (2026-11-22)

Serve with `python3 tools/serve.py` (port 8140, caching off; `.claude/launch.json` does the
same) and open `/`. `?play=1&level=n` skips the menu, `?unlock` opens all levels, `?lang=de|es`.

| File | What it does |
|---|---|
| `index.html` | page, styles, HUD, question card, bottom sign line, toast, menu and end screens |
| `src/main.js` | game state and rules, card, gates, strokes, camera fit, input (pointer + keys), frame loop, QA hook |
| `src/course.js` | builds one hole from its grid: height field, wall segments, gates, merged meshes, rocky underside, slope chevrons |
| `src/physics.js` | the ball: fixed step 1/240 s, slope pull, friction, capsule walls, cup catch / lip |
| `src/holes.js` | level and hole data (grid format explained at the top) |
| `src/labels.js` | word plates over the gates (canvas sprites) |
| `src/assets.js` | model loading, baked geometries, merge into one mesh per material |
| `src/questions.js`, `src/verbs.js` | verb pairs from the site engine, inline fallback (copied from Verb Dungeon) |
| `src/i18n.js` | EN/DE/ES texts, `_touch` twins |
| `src/audio.js` | WebAudio synth: putt, roll (speed-driven noise), wall clunk, lip, cup rattle, cheer, card, right/wrong |
| `src/track.js` | analytics: `level_start`, `hole_end`, `level_end` game events; `recordAttempt` on every first answer |
| `assets/` | 0.27 MB of KayKit models (`assets/CREDITS.md`); `vendor/three/` 0.169, `fonts/` |
| `tools/` | `serve.py`, `shot.cjs` (headless screenshot), `qa-play.cjs` (plays levels by script), `qa-input.cjs` (real mouse/keys/touch) |

First load ≈ 1.9 MB (Three.js 1.2 MB of it), 9–25 draw calls per hole.

### Rules as built (a first proposal; the owner has not confirmed them)

- **Holes are tile grids** (`holes.js`): 2×2-unit tiles; `#` green, `T` tee, `H` cup, `^ > v <`
  slope rising that way, `X` raised block, `t r g` decoration tiles (tree, rocks, bushes)
  outside the fence; optional `h` grid of levels (0.5 units each; a slope rises one level).
  Railings go automatically on every course edge that leads nowhere or to another height.
  Slope tiles carry white chevrons pointing downhill (otherwise a slope doesn't read from
  the fixed camera). The course is one merged mesh; the island has a rocky underside.
- **Camera:** fixed per hole, 54° down, fitted to the window (HUD on top, sign line at the
  bottom kept free). It turns the hole 90° (tee on the left) only when that makes it at
  least a third bigger, e.g. the tutorial hole on a laptop. Portrait tablets fit too.
- **A stroke:** the ball lies still, a "Space / Tap: your stroke" bubble floats over it.
  Space, or a tap/click anywhere on the course, opens the card (scene dimmed, nothing moves).
  Right answer → the card closes, aim. Wrong → chip greys, teach line (`go → went → ___` at
  the 2nd form, the full chain at the 3rd), **+1 stroke**, pick again. Card strokes ask
  pairs: 2nd form on one stroke, the same verb's 3rd form on the next.
- **Aiming:** drag anywhere (does not have to start on the ball) and pull back like a
  slingshot; the arrow shows direction and power (teal → amber → coral); let go to shoot.
  A tiny drag cancels. Keys: ← → turn the aim (starts pointing at the cup), hold Space:
  power swings up and down, let go to shoot. Full power ≈ 26 units of roll.
- **Ball physics:** slopes pull, friction slows, railings bounce (72 % of the normal speed),
  the cup catches a ball slower than 6.2 u/s over it and pulls a slow ball near it a little;
  a faster ball skips over the lip. A ball that leaves the course (not possible on the
  current holes) goes back with +1.
- **Word gates** (level 2): a row of three arches with word plates across the fairway. While
  the ball is before an unsolved row, strokes need no card; the bottom line shows
  `go → ___ → ___`. Through the right gate: plate teal, the other two close, the next row
  (if any) shows its 3rd-form words (`go → went → ___`; "?" until then). Wrong gate: the
  plate greys and closes, +1, the ball hops back to where it was shot from. If a card verb
  still waits for its 3rd form when a gate stroke comes up, the card asks it first (chain order).
- **Missed verbs** come back as a pair about three questions later and are listed on the end
  screen.
- **Give-up rule:** at par + 4 strokes the ball flies into the hole ("Let's go on!").
- **Stars:** level total ≤ par 3, ≤ par + 3 2, else 1; best per level in localStorage
  `krabsy_vgolf_stars`; level n+1 opens with any star on n. Menu shows levels 3–6 as "soon".
- **Analytics:** `hole_end { level, hole, strokes, par, shots, penalties, gave_up }`.

### QA

`window.__VG`: `info()`, `ready()`, `answer(right)`, `shoot(deg, power)`, `shootAt(x, z, p)`,
`putt()` (at the cup), `gate(right)` (puts the ball before the right / a wrong gate and shoots
through), `sinkNow()`, `hole(n)`, `ballScreen()`, `camera`, `scene`, `G`.
`?qa=play&level=n[&wrongall=1]` plays a level by script (real physics; the bot only putts
straight at the cup, so it gives up on hole 1-3); the result lands in `#qa`.
`node tools/qa-play.cjs` runs levels 1–2 with and without mistakes and checks chain order;
`node tools/qa-input.cjs` drives real mouse, keyboard and touch (CDP) input.
Headless Chromium comes from `~/.cache/ms-playwright` via the Worksheets app's Playwright.

### Not built yet

Levels 3–6 (conveyors, bumpers/swipers, springs and island jumps, saw traps), golfer
character, music, prepositions (`?topic=`), the "click to play" focus pause (not needed so
far: the mouse works without keyboard focus), a site-engine test (`source: 'engine'`).

## Open questions for the owner

- Card before every stroke, or only before the first stroke of each hole
  plus word gates? (Start with every stroke; play-test the feel.)
- Golfer character at the tee, or just the ball?
- Name: "Verb Golf" or something else?

## Log

- 2026-11-22: brief written by the master session after the owner picked
  Verb Golf from six ideas.
- 2026-11-22: **first playable version** (game session). Levels 1 (tutorial straight, corner,
  slope + block) and 2 (one gate row; two rows over a slope; corner with a row each way),
  see "What exists". **Checked** in headless Chromium (software rendering): `qa-play.cjs`
  levels 1–2 ± mistakes reach the end screen, no chain-order violations, all events sent;
  `qa-input.cjs`: click opens the card, digits answer, mouse drag shoots, ← → turn and held
  Space shoots, touch drag shoots through a gate; screenshots at 1366×768, 1024×768 and
  768×1024 in EN/DE/ES (`_shots/`, gitignored). **Not checked:** a human playing (shot
  power, friction, how hard hole 1-2's corner and 1-3's block are, whether the card on every
  stroke feels too slow), sounds, a real tablet / Chromebook frame rate, the site question
  engine. **Next:** owner play-test, then tune; then level 3 (conveyors, arrow platforms).
