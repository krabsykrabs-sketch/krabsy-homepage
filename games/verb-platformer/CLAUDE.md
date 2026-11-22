# Verb Platformer — game brief

3D jump-and-run (Three.js + Rapier) for irregular verbs. Source lives here;
the built copy is served from `homepage/games/verb-platformer/` and wrapped by
`homepage/de/spiele/verb-platformer/` + `homepage/es/juegos/verb-platformer/`.
See also `WORK_LOG.md` in this folder.

## Status: LIVE (beta), 2026-11-22

Deployed (c68ef88 + hotfix b2b206c: the `.mjs` vendor files). Checked on
krabsy.com: both wrappers show the menu and level 1 runs, with 0 errors and
0 failed requests. IndexNow sent for the two wrappers + `/de/spiele/`,
`/es/juegos/`. **Still untested on real devices** (school laptop GPU,
tablet/phone touch).

History of the release:

Owner 2026-11-22: "the mechanics and the levels are good — make a proper game
out of it so we can put it live." What went into the release:

- Game shell (title + level select with stars, results, pause, first-run
  hint, DE/ES/EN, site fonts) — see "Game shell" below.
- Questions follow the site's chain order (`src/data/questions.js`).
- Release copy built into `homepage/games/verb-platformer/` (7.8 MB) with
  `tools/build-release.cjs`; re-enabled on the site: `games.json` entry
  (beta, 3d, large_screen), hub JSON-LD, new info texts
  (`tools/game_info_content.py`), new thumbnail, noindex removed from both
  wrappers, sitemap +2 URLs.
- Checked: both wrappers load the game in the right language with 0 errors
  / 0 404s; the bot finishes all six levels from the served copy.

**Before pushing:** the owner plays it on a real laptop (and ideally a
tablet / phone) — performance on integrated GPUs and real touch are
untested. Then push, owner clicks Deploy in Coolify, verify live, IndexNow
the two wrapper URLs + `/de/spiele/`, `/es/juegos/`.

**Every later change to the game:** edit here, then rebuild the served copy:
`PLAYWRIGHT=<playwright module> node tools/build-release.cjs <url serving this
folder with /lib and /data beside it>` (it opens every level, records what
loads, copies only that). Commit `homepage/games/verb-platformer/` with it.

**Key art belongs to the master session** (Gemini, Verb Kitchen style,
commit 9c99a50): `homepage/thumbnails/sm/verb-platformer.jpg`,
`homepage/thumbnails/hero/verb-platformer.jpg`, the `games.json` thumbnail
(points to the sm JPG; `thumbnails/verb-platformer.png` is unused) and the
wrappers' og:image / twitter:image (hero JPG). Never replace them with
screenshots; on a re-release keep these fields as they are.

## Next: level design

What exists:

- **The mechanic:** a gate is three red answer platforms side by side,
  each with a word bubble; wrong ones fall on contact (`src/gates.js`).
- **Levels are JSON files** in `assets/levels/`, listed in
  `assets/levels/index.json` (menu order). A new level = one file + one
  line. Six first drafts exist (2026-11-21): First Steps, Zigzag (turns),
  The Climb (height, ramps), Ferries (moving platforms), Hammer Works
  (hammers, conveyor belts), Sky Finale (everything + a shortcut).
  **The owner has not played them yet.** `_sandbox.json` and
  `_test-piece.json` are test pieces, not in the menu.
- **Drafts come from `tools/make_levels.py`** (short path scripts). It
  never overwrites an existing file without `--force <id>`; once a level
  was reshaped in the editor, the JSON is the truth.
- **`tools/bot-test.cjs` plays a level to the flag** in a headless
  browser, following `botPath` in the level file (needs a server with
  the site root and `PLAYWRIGHT=<path to playwright module>`). All six
  pass with 0 deaths; the bot plays perfectly, so this proves a level
  can be finished, not that it is fun or fair for a child.
- **Moving platforms** in JSON: `"motion": { "axis": "x|y|z",
  "amplitude": 3, "period": 7, "phase": 0 }` on a box platform (editor:
  "Moves"). Hammers hang when `rotationX` is 180, pivot 7.3 above the
  floor. `src/levels/*.js` (old built-in layouts) are no longer in the menu.
- **The level editor** (`editor.html`, `editor.js`): place KayKit pieces
  on a grid, Playtest opens `index.html?level=editor` from a localStorage
  draft, Save writes JSON. `WORK_LOG.md` is the editor's work log.
- **Local assets:** `assets/` is gitignored except `levels/`. Restored on
  2026-11-21 by copying `homepage/games/verb-platformer/assets/` here
  (22 MB). On a fresh machine do the same; the master library is
  `/home/janah/dev/_assets/kaykit/KayKit_Platformer_Pack_1.0_EXTRA`.
- **Libraries are self-hosted** in `vendor/` (three r169, rapier3d-compat
  0.19.3, nipplejs 1.0.1; tracked in git). No CDN. **No `.mjs` files:** the
  live server sends them as `application/octet-stream` and browsers refuse
  them as modules (broke the first live deploy on 2026-11-22; Python's local
  server hides this). Rapier and nipplejs are renamed to `.js`.

### Level JSON, the parts that matter

```json
{ "id": "first-steps", "name": "First Steps",
  "tiers": [1],
  "spawn": { "position": [0, 2, 0] },
  "flag":  { "type": "flag_C", "color": "blue", "position": [0, 1, -46] },
  "objects": [
    { "id": "platform_1", "type": "platform_6x6x1", "position": [0, 0, 0], "color": "blue" },
    { "id": "checkpoint_1", "type": "checkpoint", "position": [0, 2, -5] },
    { "id": "gate_1", "type": "gate", "position": [0, 0, -10], "rotation": 0 }
  ] }
```

- **`gate`** (editor: Tools → "answer gate"): three answer blocks at
  x −3.5 / 0 / +3.5 around `position` (bottom of the middle block; tops
  are 1 higher) and the question sign above. `rotation` turns the whole
  gate (0 = read from +Z, 90 = read from +X). Optional `verb` fixes the
  verb, optional `form` (`past` / `participle`) fixes the blank. **No
  words are stored in the level**: the game deals them at play time.
- **Which verbs:** level field `tiers` (1 easy to 3 hard; editor toolbar
  "Verbs") or a hand-written `verbs` list, optional `forms`. Nothing set
  = all verbs.
- **Questions** (`src/data/questions.js`) come from
  `/lib/krabsy-questions.js` (chain shape) on the site; served alone
  (dev) that import 404s and 15 inline verbs are used. Prompt is
  `go → ___ → gone` or `go → went → ___`; after every answer the full
  chain shows (with the wrong word and ✗ after a miss).
- **Respawn:** last checkpoint touched, else the spawn. Clearing a gate
  makes its correct block the checkpoint. Put a `checkpoint` object on
  the platform before each gate (feet height: platform top + 1), or a
  miss sends the player back a whole section. On respawn, uncleared
  gates get their fallen blocks back.
- Platform `position` is the bottom of the piece; a `…x1` piece at y 0
  has its top at y 1. Red platforms outside gates still fall on contact
  (old mechanic, with hand-typed `answer-label`s); prefer `gate`.
- `window.__krabsyDebug` and the `krabsy-teleport` event exist for
  automated play-tests.
- **`sky`** (optional): `{ "preset": "morning" }`, presets `morning`,
  `noon` (default when absent), `afternoon`, `golden`, `sunset`, `dusk`.
  Every value of a preset can be overridden in the same block (`zenith`,
  `horizon`, `cloudLit`, `cloudShade`, `fog`, `sun`, `sunDir`, `stars`,
  `season` = `summer|fall|winter` for the background islands …): see
  `src/sky-presets.js`. The editor has no UI for it but keeps the block
  on load/save.

### Art pass 1 (2026-11-21; owner: "not bad, actually quite good", wants scenery closer and more of it → art pass 2 below)

- `src/game.js`: cloud deck at y −10 (`CLOUD_Y`), a fall counts at y −5
  (`FALL_Y`); the character keeps dropping during the respawn delay and
  vanishes in the clouds. Sky dome with sun disc/glow/stars, cloud sea
  shaded towards the sun, HemisphereLight instead of AmbientLight.
  `applySky()` writes a level's sky into colours, fog and lights.
- `src/scenery.js`: background islands + a castle beyond the flag (one
  merged mesh), 42 cloud puffs (two InstancedMeshes), platform shadows on
  the deck (one InstancedMesh; movers and falling blocks update). **Placed
  automatically** from the level's pieces, seeded by the level id: islands
  25+ units from every path piece and 7+ below it, puffs 15+ away. No
  colliders. +4 draw calls, about +67k triangles.
- `assets/scenery/` (tracked, 0.7 MB): the pieces used from the KayKit
  Medieval Hexagon pack (`/home/janah/dev/_assets/kaykit/KayKit_Medieval_Hexagon_Pack_1.0_EXTRA`).

### Art pass 2 (2026-11-21; closer scenery, more clouds, life)
  Look-out and camp islets keep 13+ units from the path (main session, after the owner's review screenshots showed a spectator right beside an answer block).

Three depth layers now: **islets** 10–22 units from the path, islands
25–48 (four of them), islands and the castle far out (eight islands in all,
was seven). Everything is still placed automatically from the level's
pieces and seeded by the level id; the new parts use their own random
stream (`id + ':near'`), so the far layer did not move. Still no colliders.

- `src/scenery.js`
  - **Islets** (`addIslet`, `ISLET_THEMES`): 7–16 per level (one per ~12
    units of level), spread along the path. Themes: look-out (a spectator
    stands there), windmill + wheat field, village (well, two houses,
    horse), hamlet, camp, grove. Rim 10+ units from every path piece, grass
    4.5–8 below the **lowest** walkway nearby (so nothing on an islet can
    stand in front of the path), at least 2.5 above the clouds. They float
    free (short keel). The first look-out and the first windmill are placed
    in view of the start. Merged into one mesh per 110 × 110 map cell
    (3–6 cells per level, cells out of view are skipped); the season
    texture (`sky.season`) applies to them too.
  - **Close cloud puffs**: 25 more (same two InstancedMeshes), three
    kinds: under and beside the path (top 5+ below the underside of the
    pieces, checked along the whole drift), beside the path between deck and
    walkway, five big mounds sunk in the deck. They drift 5–13 units, slowly.
  - Two small flags on the back corners of the start platform (merged, no
    collider).
- `src/scenery-life.js` (new) — everything that moves:
  windmill sails, one or two **cloud ships** sailing circles on the deck (8+ units from
  the path, masts below it), **hot-air balloons** in teal / coral / amber
  (procedural, 13+ units from the path), **birds** in small flocks circling
  beside the path and round the castle (procedural, flapped on the CPU),
  and up to three **spectators**: the KayKit Mage with its eight parts
  merged into one skinned mesh, same Rig_Medium as the player, clips shared
  through `loadRigClips()` in `src/player-character.js`. They turn to the
  player and hop / wave when the player is within 34 units; their mixers
  only run within 70 units and they are not drawn beyond 100.
- **Slow-device guard** (`setLite` in `src/scenery.js`): when the game
  runs below 12 frames a second for three seconds, everything art pass 2
  added is switched off for the rest of the visit (art pass 1 stays).
  `?scenery=full` / `?scenery=lite` in the URL force one or the other.
  Headless Chromium with software GL is such a device: **the bot and plain
  screenshots show the lite scenery after a few seconds; use
  `?scenery=full` for screenshots.** (The game runs in slow motion below
  10 fps, and the bot's finale needs 116 of its 120 seconds even at full
  speed.)
- `src/game.js`: `scenery.update(dt, playerPos)`; `__krabsyDebug.scenery()`
  returns the scenery (its `info` lists islets, ships, balloons, flocks,
  spectators with positions, for screenshots and tests).
- **Cost** (start view, 1024×768, `?scenery=full`): scenery draw calls
  4 → 13–16 (+3–6 islet cells, +1 sails, +1 ships, +1 balloons, +1 birds,
  +1 per spectator in view); scenery triangles about 50k → 90–111k (frame
  total 61–71k → 102–133k). If a device struggles before the guard kicks
  in: fewer islets (`isletCount`), no village, two spectators.
- `assets/scenery/` is now 1.6 MB: + windmill, two houses, well, ship,
  tent, pawn, horse, hay bale, flag, banner, single trees, small wood,
  hill, rock, wheat field (same Hexagon pack, same palette texture) and
  `Mage.glb` (KayKit Adventurers, 0.35 MB).
- Bot: all six levels pass. Not done: nothing on the checkpoint platforms;
  the spectators react to distance only (not to a cleared gate); no sound.

What a level-design session should do:

1. ~~Restore the assets, play the levels, fix open issues 1–5~~ **done
   2026-11-21** (see "Fixed" below).
2. Agree a **level plan** with the owner: how many levels for a first
   re-release (suggestion: 6–8), about 2–3 minutes each, one new idea per
   level (moving platforms, turns, height, a shortcut, a timed stretch),
   difficulty rising with the verb tier.
3. **Who builds levels: both** (owner decision 2026-11-21) — the owner
   in the editor, the session by writing level JSON. The editor's open
   items in `WORK_LOG.md` (save in place, auto-reload playtest) matter.
4. ~~Menu loads JSON levels from `assets/levels/`~~ **done 2026-11-21.**
5. Check the game against the site rules (not verified yet): questions
   without grammar terms (`go → ___ → gone`), full chain after a wrong
   answer, question data from `homepage/lib/krabsy-questions.js`, UI in
   German and Spanish, self-hosted fonts. The build is 22 MB today; the
   target for 3D games is ≤ 15 MB.

(The old "to bring it back" steps were done on 2026-11-22, see Status.)

## Game shell (2026-11-22; title screen, HUD, pause, results, DE/ES/EN)

Everything around the gameplay. Plain DOM + CSS over the canvas, no build step.

- **Flow** lives in `main.js`: states `boot → menu → loading → (hint →) playing ⇄
  paused → results`, mirrored on `<body data-state>` (CSS shows the touch
  controls only while playing) and readable as `window.__krabsyShell.state()`.
- **Files:** `index.html` (all screens as static nodes), `styles.css`,
  `src/i18n.js` (strings), `src/progress.js` (saved results, star rule, time
  format), `src/menu.js` (title + level select), `src/ui.js` (HUD, pause card,
  first-run hint, results, loader), `src/celebrate.js` (canvas confetti +
  WebAudio jingle), `src/shell-bits.js` (stars, key caps, controls help,
  touch test), `fonts/` (Fredoka One + Nunito woff2, copied from
  `homepage/lib/fonts/`; `assets/` is gitignored, so they are not in there).
- **`src/game.js` hooks for the shell:** `setPaused(bool)` (no physics, no
  movers, no clock; the picture stays), `getTime()` (seconds played, stops
  while paused and at the flag), `lockPointer()`, `getGateQuestions()`.
- **Title screen:** Play starts the first level never finished (then the first
  below 3 stars). All levels are always selectable. A card shows name, the
  level's idea (`idea.<level id>` in `src/i18n.js`: **a new level needs its
  line there in all three languages**, else the line is empty), verb
  difficulty dots (highest of `tiers`), best stars, best time. Level names
  stay English. The live sky of the game shows behind the menu.
- **Results:** stars by wrong answers in the run (0 = 3, 1–2 = 2, more = 1;
  `starsFor` in `src/progress.js`; a gate jumped past counts like a wrong
  answer; falls do not count), time, gates right
  first time, the missed verbs as full chains (`missedChains()` in `main.js`
  pieces the three forms together from all gate questions, because one
  question may hide the 3rd form; a `full` field on a question wins if it
  ever exists), Retry / Levels / Next level (Enter = the yellow button).
  The results screen is `#level-complete` — **the bot reads its `hidden`**.
- **Pause:** the HUD button, `Esc` or `P`, a hidden tab. `Esc` while the mouse
  is captured never reaches the page; the released pointer lock is what opens
  the pause card. Resume / Restart level / Levels. Starting, resuming and
  the hint's button capture the mouse again (they are clicks); if that fails
  a tip at the bottom says "click the game".
- **First-run hint:** before the first level ever played, game paused behind
  it. Remembered in the progress key. Not shown with `?hint=0` and not in
  `?level=editor`.
- **`?level=editor`** (editor Playtest, bot): nothing is saved, no hint, the
  results offer Retry only, pause has no "Levels".
- **localStorage:** `krabsy_vp_progress` = `{ v: 1, levels: { <id>: { stars,
  time } }, hint: true }` (best stars and best time, each on its own);
  `krabsy_vp_lang` (only written by the DE/ES/EN switch on the title screen).
  The prototype's `krabsy_3d_completed` is turned into one-star entries once
  and removed. `krabsy_3d_editor_level` is the editor draft, as before.
- **Language:** `?lang=de|es|en` (this visit) → `krabsy_vp_lang` →
  `krabsy_lang` (set by the site's wrapper pages) → browser language →
  English. Static nodes carry `data-i18n` / `data-i18n-aria`; everything else
  calls `t()`. Verbs and the chain notation are never translated; no string
  uses a grammar term.
- **`tools/shell-test.cjs`** walks the whole shell in three screen sizes
  (menu → level 1 → hint → a wrong block of gate 1 → pause → resume → flag →
  results → next level → menu, moving the player with `krabsy-teleport`),
  takes a screenshot of every screen and reports console errors, failed
  requests and broken steps:
  `PLAYWRIGHT=… node tools/shell-test.cjs <base-url> <out-dir> de es en`.
- **Open:** the question sign and answer bubbles still draw with Arial
  (`src/level-loader.js`, `src/gates.js`: main session); no mute button; the
  wrapper pages do not pass a level (`?level=N` works for teacher links, but
  nothing on the site builds such a link yet).

## Fixed 2026-11-21 (source only, NOT yet copied to `homepage/`)

Checked in headless Chromium (desktop 1366×768, tablet 1024×768 touch,
phone 844×390 touch): all three levels, the editor and the editor level
load with 0 console errors, 0 failed requests, 0 external requests.

1. **Texture 404:** the two Kenney particle models (`assets/models/`) are
   gone; `src/particles.js` builds the dust and brick bits from
   primitives. At release, delete `homepage/games/verb-platformer/assets/models/`.
2. **Touch crash:** `#hint` exists now and the lookup is guarded.
3. **Phones:** touch controls show on every device whose main pointer is
   a finger (`pointer: coarse`), phones included. Keyboard and joystick
   add up, so touch-screen laptops keep WASD. Portrait phones get a
   "rotate" screen; small-height styles for landscape.
4. **Joystick never worked** (found behind the crash): nipplejs 1.x passes
   one event object; the handler read a second argument. Fixed.
5. **Touch camera:** dragging on the scene turns the camera (there was no
   way to look around on touch, which levels with turns need).
6. **Libraries self-hosted** in `vendor/` (also for `editor.html`).
7. **`noindex, indexifembedded`** meta is in the source `index.html`.

## Open (found 2026-11-21)

- **Not tested on real devices.** Joystick, look-drag and jump were only
  driven by simulated touches. Owner: try a tablet and a phone.
- **Small text on phones:** the question now also shows in the HUD when
  the screen is under 500 px high. The answer bubbles are still
  world-space and small on phones.
- **Cleanup:** delete `src/levels/`, `qa-styles.js` and the legacy
  loader path once the owner has accepted the JSON levels.
- **Level feedback from the owner.** 2026-11-21, first play: gaps of 1
  could simply be walked across (the capsule bridges them) → all gaps
  are now 0 (attached) or 2–3; "Ferries is quite good"; the character
  now turns to its steering direction in the air too (it used to jump
  sideways). Still open: his view on the wider gaps, the other levels,
  hammer timing. **Controls (owner decisions, same day), in `src/camera.js`
  + `src/player.js`:** the mouse aims; the character turns to the aim at
  once and the camera trails it (`yawFollow`), so a fast flick shows the
  character's side. With keys alone the camera holds still and the
  character turns to where it is steered. When the mouse moves again
  after a pause, the camera swings round behind the character. While
  the mouse is in use (`mouseHoldMs`), A/D step sideways.
  **Touch (owner's tablet test on the live site, 2026-11-22):** no mouse
  to aim with, so the camera swings behind the character by itself while
  the stick points forward or diagonally (`autoFollow`, `touchFollow` 1.2,
  about 35°/s on a held diagonal); pushing sideways or back leaves it
  still. A finger drag on the scene still turns it and pauses the swing
  for 1.5 s. The joystick was nipplejs's default (two equally pale
  circles, "looks duplicated"): now a ring and a solid knob (`styles.css`).
- ~~UI is English only, system font, title "Krabsy 3D"~~ done 2026-11-22, see "Game shell".
- **Size:** 22 MB. `assets/kaykit-platformer/` is 16 MB (five colour
  sets of every piece). `assets/sprites/skybox.png` (3.9 MB), `coin.png`
  and `particle.png` are not referenced by any code.

Quality bar before re-release: it must feel good in the first 30 seconds
(controls, camera, clear goal, readable verb question) on a school laptop
and on a 1024×768 touch tablet.
