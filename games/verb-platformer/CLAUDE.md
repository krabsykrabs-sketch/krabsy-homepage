# Verb Platformer — game brief

3D jump-and-run (Three.js + Rapier) for irregular verbs. Source lives here;
the built copy is served from `homepage/games/verb-platformer/` and wrapped by
`homepage/de/spiele/verb-platformer/` + `homepage/es/juegos/verb-platformer/`.
See also `WORK_LOG.md` in this folder.

## Status: OFFLINE (taken out of the catalogue 2026-11-12)

The owner judged the game not good enough to be on the site. What was done
(master session, commit on `main` 2026-11-12):

- Removed from `homepage/data/games.json` → gone from the games hub, homepage
  strip, topic hubs, the game chip-bar and "related games" cards.
- Removed from the hub texts/JSON-LD (`de/spiele/index.html`,
  `es/juegos/index.html`) and from `tools/game_info_content.py` related lists.
- Wrapper pages kept reachable (no 404 for old links) but carry
  `<meta name="robots" content="noindex, follow">`; out of the sitemap.

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

General quality bar before re-release (owner's words: "still shit, a
disgrace that it's live"): it must feel good in the first 30 seconds —
controls, camera, clear goal, verb question readable — on a school laptop.
