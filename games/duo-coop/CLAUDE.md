# Krabsy Duo (working title): co-op puzzle platformer, phase D1

The first **duo game** (`docs/duo-games.md`): two players on one device, a side
view, two roles that need each other, and **every interaction is a question**.
The owner has not chosen a name yet ("Krabsy Duo" is shown as a working title).

Read first: `docs/duo-games.md` (the brief, phases D1–D4), `docs/game-contract.md`
(any topic through `getQuizSet`, the player's figure, hero choice).

## Status (2026-11-27): D1 local prototype, playable, NOT on the site

- One level of 3 rooms, two players on one keyboard or one tablet, DE/ES/EN.
- Not built for release: no wrapper page, no `games.json` entry, no build copy in
  `homepage/games/`. Not in D1 (brief): online play, live-lesson relay, monsters,
  guide rooms, gifts.
- **Owner: please play it with someone** (see "Run it"). Open questions are at the end.

## Run it

```
python3 games/duo-coop/tools/serve.py          # port 8930
→ http://localhost:8930/games/duo-coop/
```

`tools/serve.py` serves this source folder at `/games/duo-coop/` and `homepage/`
for everything else, so `/lib` (question engine, stats, figures), `/data` and
`/assets/figures/` are there like on the site. Nothing is copied.

URL options: `?lang=de|es|en`, `?topic=<id>` (any quiz topic, e.g. `es_ser`,
`prepositions`), `?touch=1|0` (force the touch buttons on/off), `?autostart=1`
(skip the title screen), `?shadows=0`.

Opened from a folder without `/lib` (e.g. `python3 -m http.server` inside this
folder, or file://): built stand-in figures and 12 inline verbs, no stats.

## Controls

| | Player 1 (left) | Player 2 (right) |
|---|---|---|
| move | A D | ← → |
| jump / climb up | W | ↑ |
| climb down | S | ↓ |
| use (lever, door, key …) | E | Enter |
| answer card | **1 2 3** (quick answer) | **8 9 0** |

Owner 2026-11-27: few keys per player (W / ↑ jump, E / Enter use, 1 2 3 and 8 9 0 to
answer; Space removed). The chips show their key. Picking a chip with the move keys +
E / Enter still works as a fallback but isn't advertised. S / ↓ are only for climbing
down a ladder (one can also step off the top).

Touch (`pointer: coarse` or `?touch=1`): two button zones at the bottom, teal =
player 1 (left), coral = player 2 (right): ◀ ▶ ▼ ▲ ✋. Chips are tapped.
Esc / P pause, M sound. A wrong answer's card closes by itself after 3 s, or
earlier with the use key.

## Roles (abilities come from the role, not the figure)

| Role | Size | Can |
|---|---|---|
| **Climber** (DE Kletterass, ES Ágil) | 0.9 tall, small figure | jumps 3.5 high and ~5 far (with a run-up), climbs ladders, fits through 1-high tunnels |
| **Strong one** (DE Kraftpaket, ES Fuerte) | 1.6 tall, big figure | pushes crates, carries one (use key next to a crate, again to put it down), **smashes cracked walls**, pulls heavy levers; jumps only 1.4 high |

Player 1 is the climber by default; "Swap roles" on the title screen
(`krabsy_duo_swap`). Players can stand on each other: the climber jumps off the
strong one's head to reach what is too high even for them (room 3).

## The level (`src/levels.js`)

Rooms are 32 × 13 cells, drawn with `fill()` steps, objects listed by cell. The
camera frames both players and never shows more than the room.

| Room | Idea | Questions (who) |
|---|---|---|
| 1 Levers & doors | lever on a ledge (ladder) opens door A · climber jumps a bottomless gap too wide for the strong one, bridge post builds a bridge · strong one smashes the cracked wall · exit | lever C, post C, wall S, exit (first there) = 4 |
| 2 Boxes | key on a shelf (ladder) · locked door · strong one pushes the crate to the 2-high step and climbs it · heavy lever drops a caged crate, pushed to the next step · portal (climber switches it on) into the closed exit chamber · exit | key C, door C, heavy lever S, portal C, exit = 5 |
| 3 Together | switch on a ledge only reachable from the strong one's head · strong one smashes the cracked wall · key at the end of a 1-high tunnel · locked door · exit | switch C, wall S, key C, door C, exit = 5 |

14 objects with a question; about 3 of 4 are in the climber's reach (the brief's
"most questions go to the student" by level design). A wrong answer leaves the
object as it was and shows the teach line on the card; pressing it again asks a
new question. No lives, no game over; Pause → "Restart room" if a crate gets stuck
(a carried crate can also be put down anywhere, so a crate in a corner can be
fetched).

### Smashing walls (owner 2026-11-27: replaces holding a heavy gate)

The strong one's own puzzle object is a **cracked wall** (`crack` in `src/levels.js`): use
key next to it → a question → right: the punch (Throw clip, 0.55 s without control), the
wall bursts 0.28 s later and is gone for good. The climber gets "Only the strong one can
smash this." Wrong answer: the wall stays. (The old gate that had to be held up while the
climber slipped through, its prop lever and room 3's portal pair are gone.)

### Falling (owner 2026-11-27)

Gaps have no bottom (a column empty down to y = 0; `physics.js` `solid()` is open below
the room). Whoever falls in drops into a dark shaft, gets "Whoops! Back to the start." /
"Hoppla! Zurück zum Start." / "¡Uy! Vuelves al inicio." and is back at **this room's
spawn** after 1 s. No lives, no game over: what is already open stays open, a carried key
stays with the player, a carried crate goes back to where it
started (a crate that falls in does too). Before this, a player could get stuck under the
bridge in the old pit (owner's test). Only room 1 has a gap so far.

## Questions and answers

- `src/questions.js`: one queue per player from `/lib/krabsy-questions.js`
  `getQuizSet({ topic, count: 30, withOptions: 3, lang, smart })` (player 1 smart,
  player 2 plain), refilled in the background; chain pairs stay in order (a 3rd
  form is asked right after its 2nd form, by the same player). Fallback: 12 inline
  verb pairs.
- Cards (`src/cards.js`): next to the player's character, colour of the player,
  `go → ___ → ___` with the asked blank highlighted, sentence topics show their gap
  (`display.sentence`, long ones smaller). After a miss: the right chip, the filled
  sentence or the chain (`teach.line`, 3rd form hidden on the first of a pair) and
  for sentence topics the teach line in the interface language.
- **Recording:** only player 1 (= the active person on this device) via
  `recordAttempt(item, form, correct, 'duo-coop', topic, 'choice')`, every answer.
  Player 2 is counted for the summary only (D2: the second player's chosen person,
  `krabsy_people`).
- **Density:** the results screen and the console show
  "N answers in M min · X % right"; each room logs its count
  (`[duo] room 1: 6 answers in 20 s`).

## Look: KayKit models (owner 2026-11-27: "use actual assets")

`assets/models/` (1.4 MB, glTF + texture atlases, CC0; sources and credits in its
`README.md`), all KayKit so they match the figures:

| Part | Model |
|---|---|
| ground | Block Bits blocks, two deep; per room top / body: dirt_with_grass / stone, wood / bricks_B, bricks_A / stone_dark |
| back wall | Dungeon wall, wall_window_closed, wall_arched, wall_cracked (4 × 4.5 pieces, seeded per room) |
| decoration | Dungeon torch_mounted (+ a warm point light), banners, barrel_large, crates_stacked; placed by a seeded pass along the floors, never next to puzzle objects |
| ladder | Medieval Hexagon ladder |
| lever / heavy lever | Platformer lever_floor_base yellow / red (bigger); the handle node flips |
| switch | Platformer lever_wall_base_A blue (handle turns) |
| bridge post / bridge | Platformer signage_arrow_stand (turns round when built) / floor_wood_1x1 (amber ghost before) |
| door / locked door | an iron double gate facing the camera: the two leaves of the Halloween arch_gate, which swing back into the room in 3D; the locked one has the Dungeon key across it |
| cracked wall | 3 × 2 Block Bits stone_with_copper blocks; smashed, they burst away from the fist, shrink and vanish, a Dungeon rubble_large pile stays |
| exit | Halloween arch_gate, both leaves swing open, teal light behind |
| portal | Platformer hoop (grey when off, yellow + teal swirl when on) |
| crate / caged crate | Dungeon box_small / hanging on Platformer chain_full |
| key | Dungeon key (floating; carried above the head) |

Only the "?" markers, the bridge ghost and the portal / exit glow are drawn by the game.
Swapping a model = change the name in `src/models.js` `MODEL_NAMES` and the `fit()` call
in `src/world.js`, copy its .gltf/.bin/texture into `assets/models/`.

## Figures

Player 1: tile 1 is "Your figure" (`loadPlayerFigure`, the Schülerin without a
saved figure), then every free figure; remembered in `krabsy_duo_hero`. Player 2:
the free figures (`FREE_CHARS`), default Hiker, `krabsy_duo_p2`; never saved as
anybody's figure. Portraits and names from the figure catalogue. Size by role:
`look` in `src/physics.js` (figures are ~2.2 units tall, scaled to 1.15 / 1.85).
Clips: Idle_A, Walking_A, Running_A, Jump_Idle, Walking_B (climbing, back to the
camera), Walking_C (pushing), Interact (answering, facing the camera), Throw
(smashing a wall). No `/lib`: a simple built figure in the player's colour.

## Files

- `index.html`, `styles.css`, `main.js` (title screen, pause, results, states on
  `body[data-state]`, `window.__duo`)
- `src/game.js` (rooms, objects, interactions, camera, overlays, debug API),
  `src/physics.js` (cell grid + box bodies, no physics library), `src/levels.js`,
  `src/world.js` (the 3D room from KayKit models), `src/models.js` (loads
  `assets/models/`, `fit()` to size a model to cells),
  `src/figures.js`, `src/cards.js`, `src/input.js`, `src/questions.js`,
  `src/i18n.js`, `src/sound.js` (WebAudio synth)
- `vendor/three` (r169, copied from the Platformer: three, GLTFLoader,
  SkeletonUtils, BufferGeometryUtils), `fonts/` (Fredoka One + Nunito)
- `tools/serve.py` (dev server), `tools/play-test.cjs` (bot)

Built on the Platformer's three.js setup (vendor, fonts, figure loading, the
`.js`-only rule for vendor files), not on its Rapier physics: a side-view puzzle
game needs crates, ladders and standing on each other, which a small cell-grid
collision does more simply. The Platformer itself is unchanged.

## Test

```
python3 games/duo-coop/tools/serve.py &
node games/duo-coop/tools/play-test.cjs [base-url] [out-dir] [--only desktop|touch]
```

Plays all 3 rooms at 1366×768 (keyboard, EN, answers with the 1 2 3 / 8 9 0 keys)
and 1024×768 (touch, DE; taps the touch buttons and the chips for real), with one wrong answer on purpose, and fails
on any console error or failed request. Headless software WebGL runs at ~4 fps, so
the bot switches the game to manual stepping (`__duo.game.manual(true)`,
`advance(seconds)`) and presses the same input pads as keys and buttons.
Screenshots of every step go to the out-dir. The bot's density (17 answers in about
1 minute) says nothing about children: it plays perfectly. Only a real pair can
measure it.

## Status log

- 2026-11-27 — D1 built (game session). `tools/play-test.cjs`: ALL OK, desktop
  1366×768 (EN) and touch 1024×768 (DE) both play all 3 rooms, 17 answers each
  (room 1: 6, room 2: 5, room 3: 6, one wrong on purpose), real figures (Schülerin +
  Hiker), 0 console errors. Also checked: `?topic=es_ser&lang=en`,
  `?topic=prepositions&lang=de`, `?topic=es_ser_estar&lang=es&difficulty=1`, phone
  844×390 with touch: cards fit, teach line after a miss, 0 errors; without `/lib`:
  stand-in figures + inline verbs. (Aborted-request reports in these runs:
  see the next entry.) Not tested on a real tablet or by two real players.
  Committed on the session's worktree branch `claude/nervous-golick-d26e0f`, not
  pushed; master session: merge it into `main`.
- 2026-11-27 — Cherry-picked onto main (640001ea); work continues on main. Fewer keys
  (3bbe690d). **KayKit models instead of drawn shapes** (owner: "use actual assets"):
  see "Look". Play-test ALL OK (desktop + touch, all 3 rooms, 0 errors, 0 failed
  requests). The ERR_ABORTED reports from earlier runs came from `tools/serve.py`
  sending `Cache-Control: no-store`; it sends `no-cache` now and the bot counts every
  failed request as an error again.
- 2026-11-27 — Bottomless gap + falling back to the room start (owner); the bot now
  walks the strong one into the gap and checks the respawn.
- 2026-11-27 — Doors are iron double gates that swing open in 3D (owner: the old doors
  and the lifting gate "look very bad"); holding the heavy gate replaced by the strong
  one smashing cracked walls (rooms 1 and 3; room 3's portals removed). Prototype Bits
  Door_A no longer used and deleted.
  Answer cards now stay where they opened (they slid with the camera; the touch test
  could not tap a moving chip). Play-test ALL OK: desktop + touch, all 3 rooms, 15
  answers each, 0 errors.

## Open (owner)

1. **Name** of the game (brief, open decision 2).
2. **Play it with a second person**: is it fun, do the rooms explain themselves
   (the goal line at the start of each room), how many answers in how many minutes?
3. Room 1 is the easiest; for 3–5 minute levels each room may need one more idea.
4. Next (D2): two devices (room code) and the live-lesson relay; player 2's answers
   for their own profile; a wrapper page + `games.json` (master session).
