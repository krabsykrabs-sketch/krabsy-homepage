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
- **Three built-in levels** as JS layouts (`src/levels/level-1.js` to
  `level-3.js`, listed in `main.js`). Level 1 is a straight path with 3
  gates; all three are short.
- **A level editor** in this folder (`editor.html`, `editor.js`): place
  KayKit platformer pieces on a grid, mark answer platforms, attach
  labels, Playtest opens `index.html?level=editor` from a localStorage
  draft, Save writes JSON. `WORK_LOG.md` is the editor's work log (what
  was improved, what is still open).
- **One editor-format level:** `assets/levels/level1.json` (19 objects).
  Editor levels load through `src/level-loader.js`.
- **Local assets:** `assets/` is gitignored except `levels/`. Restored on
  2026-11-21 by copying `homepage/games/verb-platformer/assets/` here
  (22 MB). On a fresh machine do the same; the master library is
  `/home/janah/dev/_assets/kaykit/KayKit_Platformer_Pack_1.0_EXTRA`.
- **Libraries are self-hosted** in `vendor/` (three r169, rapier3d-compat
  0.19.3, nipplejs 1.0.1; tracked in git). No CDN.

What a level-design session should do:

1. ~~Restore the assets, play the levels, fix open issues 1–5~~ **done
   2026-11-21** (see "Fixed" below).
2. Agree a **level plan** with the owner: how many levels for a first
   re-release (suggestion: 6–8), about 2–3 minutes each, one new idea per
   level (moving platforms, turns, height, a shortcut, a timed stretch),
   difficulty rising with the verb tier.
3. Decide **who builds levels**: the owner in the editor, the session by
   writing level JSON, or both. If the owner builds, the editor's open
   items in `WORK_LOG.md` (save in place, auto-reload playtest) matter.
4. Make the menu load editor-format JSON levels from `assets/levels/`, so
   a new level is one file plus one line.
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
- **Small text on phones:** the question sign and answer bubbles are
  world-space and get tiny at 844×390. Needs a HUD question on small
  screens or bigger signs.
- **Two level formats.** Built-in levels (`src/levels/*.js`) have gates,
  a question queue, checkpoints and a progress bar. Editor levels
  (`assets/levels/*.json`) have none of that: answers are hand-typed
  labels, `gateCount` is 0. `level1.json` is a test piece without a flag.
  Decide which format real levels use before building any.
- **Questions:** 15 inline verbs in `src/data/questions.js`, simple past
  only (`go → ___`), nonsense distractors ("wented"). Site rule is
  `go → ___ → gone` from `krabsy-questions.js`, full chain after a miss.
- **UI is English only**, system font, title "Krabsy 3D".
- **Size:** 22 MB. `assets/kaykit-platformer/` is 16 MB (five colour
  sets of every piece). `assets/sprites/skybox.png` (3.9 MB), `coin.png`
  and `particle.png` are not referenced by any code.

Quality bar before re-release: it must feel good in the first 30 seconds
(controls, camera, clear goal, readable verb question) on a school laptop
and on a 1024×768 touch tablet.
