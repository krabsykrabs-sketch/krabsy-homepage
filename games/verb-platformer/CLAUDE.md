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

## The player's figure (2026-11-25; built 041d726. Fallback and pill changed since: see "Hero picker")

The child's own figure (site page "Meine Figur", `docs/game-contract.md` "The player's
figure") is the player character. **Master session: rebuild the served copy** with
`tools/build-release.cjs` from a server that has `/lib`, `/data` AND `/assets/figures/`.

- `src/player-character.js`: imports `/lib/krabsy-figure.js` dynamically and calls
  `loadPlayerFigure({ fallback: 'Ranger', lambert: false, clips: false })` (the game
  used the GLB's standard material, so no Lambert). Same `CHARACTER_SCALE` (0.617) for
  every figure: same skeleton, same body height; hats stick out above the capsule
  (rule 7), capsule/jump untouched. Shadows stay off on the player, as before.
- **Clips:** `loadRigClips()` (player + spectators) takes them from the figure module's
  `loadClips()` = `/assets/figures/anim/` (byte-identical to `assets/character/`), so the
  1.5 MB load once and are shared with the other 3D games' cache.
- **Never throws:** no `http(s)` (file://), a failed import, or a failed figure/clip load →
  the old way (`./assets/character/Ranger.glb` + local clips). `build-release.cjs` now
  always copies `assets/character/` (the record pass never requests it any more).
- `vendor/three/addons/utils/SkeletonUtils.js` added (r169; the figure module needs it).
- **Title screen:** a pill under the stars with the figure's portrait
  (`/assets/figures/portraits/<char>.webp`), "Das bist du!" when it is the child's own
  figure, and the link "Spiel mit deiner Figur →" / "Juega con tu personaje →" / "Play
  with your figure →" to `/de/meine-figur/` / `/es/mi-personaje/` / `/en/my-figure/`
  (`target="_top"`, the game is iframed; language = the game's language). Hidden when
  the figure module is missing. Strings `figureLink`, `figureMine`, `figureUrl` in i18n.js.
- The fallback Ranger now comes without its quiver (the figure catalogue drops it as
  weapon-like); otherwise it looks as before.
- `tools/bot-test.cjs`: `--storage '<json>'` (localStorage entries, e.g. a saved figure),
  `CHROME=<browser binary>`, console errors count as failures.
- First load: no saved figure = the same 2.0 MB of GLBs as before (other URLs) + about
  15 KB gzipped JS (figure module, shells module, SkeletonUtils) + a 4 KB portrait. A saved
  figure: its character file (0.2–0.6 MB) instead of the Ranger (0.48 MB), plus one file
  per accessory borrowed from another character (Witch + wizard hat + wings: 0.94 MB).
- Checked headless (served-copy layout): no figure → Ranger; Protagonist_A; Witch with
  wizard hat + wings (unlocked); ToySoldier (tall own hat); Vampire not owned → Ranger;
  `?topic=es_ser&lang=en` with the Knight. Walk/jump/idle animate on every figure (side
  renders), bot reaches the flag (first-steps with no figure / Protagonist_A / Witch,
  all levels with the Witch), 0 console errors; without `/lib` or `/assets/figures/`
  and on file:// the old Ranger loads and the link is hidden.

## Hero picker on the title screen (2026-11-25; built + stamped by the master session, v=11f2c2a9bf)

Master-session job (docs/game-contract.md "Hero choice on the start screen"). **Master
session: rebuild the served copy** (`tools/build-release.cjs`, server with `/lib`, `/data`
and `/assets/figures/`) and stamp.

- **Heroes** (`HEROES` in `src/player-character.js`): `'mine'` = the child's figure via
  `loadPlayerFigure({ fallback: 'Protagonist_A' })`, i.e. the **Schülerin** for a child
  without one (was the Ranger); `'Ranger'` = this game's free hero, the original
  `./assets/character/Ranger.glb` **with its quiver** (a game item here). The Ranger is
  never written to the child's figure. When the figure module is missing or a figure
  fails to load, `'mine'` falls back to the local Ranger the old way (unchanged).
- **Choice:** `src/hero.js`, localStorage `krabsy_vp_hero` (`mine` | `Ranger`), default
  `mine`. The game is created with it; `player.setHero()` (src/player.js) swaps the mesh
  in place (position/facing/visibility carry over, old one disposed, newest call wins, a
  failed build keeps the current hero). `main.js` starts the swap on a pick and awaits it
  before each level start (not in `?level=editor`).
- **Title screen** (`src/menu.js`, `index.html` `#hero-pick`, replaces the figure pill):
  portrait tiles (`/assets/figures/portraits/<char>.webp`; tile 1 shows the child's
  character, "Das bist du!" under it when it is their own saved figure), a radio group:
  click/tap, Tab reaches the chosen tile, arrow keys move the choice, teal ring + tick on
  the chosen one. Under it the link "Spiel mit deiner Figur →" (`_top`). A missing
  portrait shows the name's first letter. Hidden when the figure module is missing.
  Phones (height ≤ 520): portrait circles only (names for screen readers + tooltip), link
  beside them: 44 px, the old pill was 40 (the German phone menu was already 408 px tall
  in 390 and scrolls; now 412). Strings `heroPick`, `heroMine`, `hero.Ranger`
  (Waldläufer / Guardabosques / Ranger) in `src/i18n.js`.
- **Idea (master, 2026-11-25):** the figure shop is now a reward system (no prices;
  gifts via shells, milestones, practice days) with a `grantGift()` API for in-game finds
  (docs/game-contract.md "Gifts found in a game"). A hat or cape waiting at a level's flag
  would fit. Not built. (The "other characters cost shells" reason below is outdated.)
- More heroes: add the id to `HEROES`, a branch in `loadCharacterRoot()`, a
  `hero.<id>` string and a portrait. Only the Ranger for now (the game's old hero); other
  catalogue characters cost shells on the figure page, so they are not given away here.
- Checked (local server with `/lib`, `/data`, `/assets/figures/`): no figure → Schülerin
  preselected and played; saved Witch → Witch, "Das bist du!"; Ranger click → saved,
  played with quiver; after reload still Ranger; ArrowLeft → back to the figure; phone
  landscape tap; one player mesh in the scene after every switch; without the figure
  module the picker is hidden and the old Ranger plays; bot: first-steps with the
  Schülerin and with the Ranger, hammer-works with the Ranger (218 s, machine load 23);
  shell test ALL OK (de/es/en × 3 sizes); 0 console errors.

## Tracking and polish (2026-11-22, after the release)

- **Game events** for the site dashboard (`src/analytics.js`, docs/game-analytics.md):
  `level_start`, `gate_passed {gate, first_try, seconds}`, `wrong_answer {gate}`,
  `fell {gate, cause: gap|wrong|hazard}`, `level_end {stars, seconds, answers,
  correct, gates, falls}`; `level` = menu number. A restart or the menu mid-level
  sends nothing (= "left"). Editor playtests send nothing.
- **Word statistics + smart mix** (docs/phase1-game-wiring.md): the first answer at
  each gate goes to `recordAttempt` (retries after a fall do not); each level start
  asks `getChainSet({ smart: true, tiers })` for its first verbs (`src/data/questions.js`).
- **Mute:** HUD button next to pause and the `M` key (`src/sound.js`,
  `krabsy_vp_mute`); `playSfx` and the jingles check it.
- **Site font** (Fredoka One) on the question sign and the answer words
  (`CANVAS_FONT` in `src/shell-bits.js`); `main.js` waits up to 2 s for it before
  a level builds its signs.
- **Answer words** 0.75 high (were 0.6), ×1.3 on screens under 560 px high.
- **Cheering:** clearing a gate makes every spectator within 70 units cheer at once
  (`scenery.cheer()`), with a soft synthesized applause (`playApplause` in
  `src/celebrate.js`). No spectators in range / lite scenery = no applause.
- Checked: a scripted run of level 1 sends the events in order with the right gate
  numbers, records 2 answers, 2 spectators cheer per gate; shell test ALL OK
  (de/es/en × desktop/tablet/phone); editor loads; served copy 0 errors.
  Live (deployed 2026-11-22): played through `/de/spiele/verb-platformer/`, the
  wrapper's tracker sent `level_start` and `gate_passed` to api.krabsy.com (the
  test intercepted them, nothing reached the dashboard).

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
- **Open:** the
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

- 2026-11-23 — Master session: level names translated for DE/ES (i18n keys `name.<level id>`: Erste Schritte … / Primeros pasos …) on the level cards, play button, pause and result screens; EN keeps the JSON names. Source + live build (25a1ae2). Owner: menus in the child's language, English only for what is learned.
- 2026-11-24 — Master session: **sentence topics** (`?topic=es_ser`, `prepositions`, any
  format-v2 topic; docs/vision.md). `src/data/questions.js` `buildSentenceQueue`: one
  sentence per gate from `getQuizSet` (game `lang`), different items first; level `tiers`
  cap the sentence difficulty (First Steps = easy sentences); gate `verb`/`form` ignored.
  Sign (`level-loader.js`): `q.sep` (' ' instead of the arrow), long sentences drawn
  smaller; answer bubbles shrink above 3.2 m (`gates.js`). After a miss the reveal shows
  the filled sentence + `teach` (`.reveal-teach`; `#answer-reveal` may wrap now).
  `analytics.js` records under `question.topic`. Texts: `TOPIC`, sentence wording for
  "Verbs"/"Practise these verbs", `exampleHtml()`/`exampleBlocks()` for the help card
  and the first-run hint (`src/i18n.js`). The changed files were copied straight into
  `homepage/games/verb-platformer/` (the served copy matched the source; no new assets,
  so no `build-release.cjs` run). Checked headless: gate 1 wrong + right (es_ser/en,
  stats under es_ser), verbs/de unchanged, menu + hint. Served in the Spanish section:
  `/en/spanish/games/verb-platformer/`.

