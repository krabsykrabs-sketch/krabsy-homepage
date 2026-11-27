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
| jump / climb up | W (or Space) | ↑ |
| climb down | S | ↓ |
| use (lever, door, key …) | E | Enter |
| answer card | A/D or W/S to pick, E to choose, or 1 2 3 | ← → to pick, Enter |

Touch (`pointer: coarse` or `?touch=1`): two button zones at the bottom, teal =
player 1 (left), coral = player 2 (right): ◀ ▶ ▼ ▲ ✋. Chips are tapped.
Esc / P pause, M sound. A wrong answer's card closes by itself after 3 s, or
earlier with the use key.

## Roles (abilities come from the role, not the figure)

| Role | Size | Can |
|---|---|---|
| **Climber** (DE Kletterass, ES Ágil) | 0.9 tall, small figure | jumps 3.5 high and ~5 far (with a run-up), climbs ladders, fits through 1-high tunnels |
| **Strong one** (DE Kraftpaket, ES Fuerte) | 1.6 tall, big figure | pushes crates, carries one (use key next to a crate, again to put it down), lifts and holds heavy gates, pulls heavy levers; jumps only 1.4 high |

Player 1 is the climber by default; "Swap roles" on the title screen
(`krabsy_duo_swap`). Players can stand on each other: the climber jumps off the
strong one's head to reach what is too high even for them (room 3).

## The level (`src/levels.js`)

Rooms are 32 × 13 cells, drawn with `fill()` steps, objects listed by cell. The
camera frames both players and never shows more than the room.

| Room | Idea | Questions (who) |
|---|---|---|
| 1 Levers & doors | lever on a ledge (ladder) opens door A · climber jumps a pit too wide for the strong one, bridge post builds a bridge · strong one lifts the heavy gate and holds it, climber slips under and props it with a lever · exit | lever C, post C, gate S, lever C, exit (first there) = 5 |
| 2 Boxes | key on a shelf (ladder) · locked door · strong one pushes the crate to the 2-high step and climbs it · heavy lever drops a caged crate, pushed to the next step · portal (climber switches it on) into the closed exit chamber · exit | key C, door C, heavy lever S, portal C, exit = 5 |
| 3 Together | switch on a ledge only reachable from the strong one's head · strong one holds the heavy gate, climber switches on the portal beyond it, strong one lets go and comes through the portal · key at the end of a 1-high tunnel · locked door · exit | switch C, gate S, portal C, key C, door C, exit = 6 |

16 objects with a question; about 3 of 4 are in the climber's reach (the brief's
"most questions go to the student" by level design). A wrong answer leaves the
object as it was and shows the teach line on the card; pressing it again asks a
new question. No lives, no game over; Pause → "Restart room" if a crate gets stuck
(a carried crate can also be put down anywhere, so a crate in a corner can be
fetched).

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

## Figures

Player 1: tile 1 is "Your figure" (`loadPlayerFigure`, the Schülerin without a
saved figure), then every free figure; remembered in `krabsy_duo_hero`. Player 2:
the free figures (`FREE_CHARS`), default Hiker, `krabsy_duo_p2`; never saved as
anybody's figure. Portraits and names from the figure catalogue. Size by role:
`look` in `src/physics.js` (figures are ~2.2 units tall, scaled to 1.15 / 1.85).
Clips: Idle_A, Walking_A, Running_A, Jump_Idle, Walking_B (climbing, back to the
camera), Walking_C (pushing), Interact (answering, facing the camera), Idle_B
(holding the gate). No `/lib`: a simple built figure in the player's colour.

## Files

- `index.html`, `styles.css`, `main.js` (title screen, pause, results, states on
  `body[data-state]`, `window.__duo`)
- `src/game.js` (rooms, objects, interactions, camera, overlays, debug API),
  `src/physics.js` (cell grid + box bodies, no physics library), `src/levels.js`,
  `src/world.js` (3D room from primitives: no model files at all),
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

Plays all 3 rooms at 1366×768 (keyboard, EN) and 1024×768 (touch, DE; taps the
touch buttons and the chips for real), with one wrong answer on purpose, and fails
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
  stand-in figures + inline verbs. Headless Chromium sometimes reports 1–2 figure
  `.glb` requests as ERR_ABORTED although they load (the bot lists them as warnings;
  a plain page load shows none). Not tested on a real tablet or by two real players.
  Committed on the session's worktree branch `claude/nervous-golick-d26e0f`, not
  pushed; master session: merge it into `main`.

## Open (owner)

1. **Name** of the game (brief, open decision 2).
2. **Play it with a second person**: is it fun, do the rooms explain themselves
   (the goal line at the start of each room), how many answers in how many minutes?
3. Room 1 is the easiest; for 3–5 minute levels each room may need one more idea.
4. Next (D2): two devices (room code) and the live-lesson relay; player 2's answers
   for their own profile; a wrapper page + `games.json` (master session).
