# Crab Slash — game brief

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
