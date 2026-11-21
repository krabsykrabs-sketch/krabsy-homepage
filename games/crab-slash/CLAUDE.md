# Crab Slash — game brief

## Status: OFFLINE (hidden 2026-11-21, owner decision)

Play-test 2026-11-21 (`docs/playtest-2026-11-21.md`) showed that the central
rule is broken, and it had the worst analytics of all games (median 0:18).

**Problems:**
- Only the four crabs of the verb shown in the top panel count
  (wrapper `:433`, `:600`, `:638`). The other 8 crabs carry *correct* forms
  of other verbs (e.g. FORGOT, RAN while the prompt is BUY) and flash red
  like a real mistake (BUYED).
- There is no goal or stakes.
- The game is English-only.
- It's unreadable on a phone.
- The frame rate depends on the display (`:678`: one step per refresh, so
  it runs 2× fast at 120 Hz).

**What was done:**
- Removed from `homepage/data/games.json`, the hub texts and JSON-LD, and
  the related lists in `tools/game_info_content.py`.
- The wrapper pages stay reachable, with `noindex, follow`, and are out of
  the sitemap.

**Before bringing it back:**
- Redesign the rule. For example, each wrong crab carries a *plausible
  wrong* form of the prompt verb (buyed, boughten), so every slash is
  about one verb.
- Add a goal (rounds, stars).
- DE/ES UI.
- Fixed-timestep loop.
- Phone layout.

Then reverse the steps above, the same way as for Verb Platformer.

Standalone source here; the game is **inlined** into
`homepage/de/spiele/crab-slash/index.html` and `homepage/es/juegos/crab-slash/index.html`.

## Notes from the master session (2026-11-12)

- **Careful when re-inlining:** the wrappers now also contain an SEO info
  section below the game (between markers, rendered by
  `tools/render_game_info.py`), JSON-LD, a scroll bar under the game, and
  scroll/touch handling from `homepage/lib/krabsy-game-info.js`. Previously a
  touch anywhere blocked scrolling for the whole 30-verb round; it now only
  blocks touches on the game itself. Replace only the game part, then run
  `python3 tools/render_game_info.py --check`.
