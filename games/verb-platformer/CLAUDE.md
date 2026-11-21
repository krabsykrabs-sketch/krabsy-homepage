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
- **Local assets are incomplete:** `assets/` here only holds `levels/`
  (the model packs are gitignored and are not on this machine).
  The deployed copy `homepage/games/verb-platformer/assets/` has the wired
  set (22 MB build); the master library is
  `/home/janah/dev/_assets/kaykit/KayKit_Platformer_Pack_1.0_EXTRA`.
  Restore the working copy before anything else.

What a level-design session should do:

1. Restore the assets, play the three levels and the editor level, and
   fix open issues 1–5 below (they are small).
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

## Open issues (verified by master session 2026-11-12)

1. **Missing texture → 404.** `assets/models/Textures/colormap.png` is
   requested by the models (GLB) but not in git / not deployed
   (`https://krabsy.com/games/verb-platformer/assets/models/Textures/colormap.png`
   → 404). It is a Kenney kit texture; copies exist in the shared library, e.g.
   `/home/janah/dev/_assets/kenney/*/Models/GLB format/Textures/colormap.png` —
   find out which kit the models come from and ship the matching file
   (remember the deployed `homepage/games/verb-platformer/assets/` IS tracked).
2. **Crash on touch tablets.** `src/controls.js:57`:
   `document.getElementById('hint').hidden = true;` — there is no element with
   `id="hint"` in `index.html`, so on touch devices ≥768 px wide this throws a
   TypeError and the touch setup (joystick, jump button) never finishes.
   Guard it (`const h = …; if (h) h.hidden = true;`) or add the element.
3. **No controls on phones.** `src/controls.js:48`:
   `isTouchDevice = 'ontouchstart' in window && window.innerWidth >= 768` —
   phones (<768 px) get neither touch controls nor a message. The wrapper text
   currently tells phone users to use a computer. Decide: support phones or
   show an explicit "please use a computer/tablet" screen.
4. **3D libraries from a third-party CDN.** `index.html` loads three.js
   0.169.0 and rapier3d-compat 0.19.3 from `unpkg.com`. Self-host them under
   the game folder (reliability on school networks that block CDNs, and
   privacy: the privacy policy says no third parties).
5. **Keep the SEO meta when copying the build.** `homepage/games/verb-platformer/index.html`
   carries `<meta name="robots" content="noindex, indexifembedded">` (added
   2026-11-12) so Google indexes the wrapper page, not the raw build. Add the
   same tag to this source `index.html`, or the next build copy drops it.

Quality bar before re-release: it must feel good in the first 30 seconds
(controls, camera, clear goal, readable verb question) on a school laptop
and on a 1024×768 touch tablet.
