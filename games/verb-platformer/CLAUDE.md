# Verb Platformer — game brief

3D jump-and-run (Three.js + Rapier) for irregular verbs. Source lives here;
the built copy is served from `homepage/games/verb-platformer/` and wrapped by
`homepage/de/spiele/verb-platformer/` + `homepage/es/juegos/verb-platformer/`.
See also `WORK_LOG.md` in this folder.

## Status: OFFLINE, to be continued (owner decision 2026-11-21)

The game was taken out of the catalogue on 2026-11-12. On 2026-11-21 the
owner decided **not to retire it**: the mechanics and the feel are good;
what is missing is **real levels**. The next work here is **level design**,
plus the open issues below.

How it is offline (master session, 2026-11-12):

- Removed from `homepage/data/games.json` → gone from the games hub, homepage
  strip, topic hubs, the game chip-bar and "related games" cards.
- Removed from the hub texts/JSON-LD (`de/spiele/index.html`,
  `es/juegos/index.html`) and from `tools/game_info_content.py` related lists.
- Wrapper pages kept reachable (no 404 for old links) but carry
  `<meta name="robots" content="noindex, follow">`; out of the sitemap.

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
  0.19.3, nipplejs 1.0.1; tracked in git). No CDN.

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

### Art pass 1 (2026-11-21; owner: "not bad, actually quite good", wants scenery closer and more of it)

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

**To bring it back:** re-add the `games.json` entry (see git history), remove
the robots noindex from both wrapper pages, add it back to the related lists
and hub text, run `tools/render_static_games.py`, `tools/render_game_info.py`,
`tools/generate_sitemap.py`, and get the owner's OK. Release only after the
issues below are fixed and it has been play-tested on desktop, tablet, phone.

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
- **UI is English only**, system font, title "Krabsy 3D".
- **Size:** 22 MB. `assets/kaykit-platformer/` is 16 MB (five colour
  sets of every piece). `assets/sprites/skybox.png` (3.9 MB), `coin.png`
  and `particle.png` are not referenced by any code.

Quality bar before re-release: it must feel good in the first 30 seconds
(controls, camera, clear goal, readable verb question) on a school laptop
and on a 1024×768 touch tablet.
