# Verb Slash — game brief

Single-file canvas game (`krabsy-verb-slash.html`). It is **inlined** into the
wrapper pages `homepage/de/spiele/verb-slash/index.html` and
`homepage/es/juegos/verb-slash/index.html` — fixes must be applied to this
source AND carried into both wrappers.

**Careful when re-inlining:** since 2026-11-12 the wrappers also contain an
SEO info section below the game (rendered by `tools/render_game_info.py`,
between markers), JSON-LD, a scroll bar under the game, and touch/scroll
handling from `homepage/lib/krabsy-game-info.js`. Don't overwrite the whole
wrapper with the source; replace only the game part, then run
`python3 tools/render_game_info.py --check`.

## Open issues (verified by master session 2026-11-12)

1. **Game starts twice → probably double speed.** Both buttons call
   `startGame` twice: `onclick="startGame()"` on `#start-btn` / `#restart-btn`
   (source lines ~167/177) AND `$('start-btn').addEventListener('click',startGame)`
   / same for restart (~658/659). `startGame()` calls `startPick()` and
   `gameLoop()` without cancelling the previous animation frame, so two loops
   run. Remove one of the two bindings (and ideally `cancelAnimationFrame(S.animId)`
   at the top of `startGame`). Re-test pacing afterwards — difficulty may have
   been tuned while running at double speed.
2. **Debug label visible to players.** "// Debug label" block creates
   `patternLabel` (top-right, monospace) that shows the trajectory pattern
   name during play. Remove it or hide it behind a `?debug` URL flag.
3. **Language:** all in-game text is English only (the wrapper pages say so).
   Fine per the presentation mandate, but check that no grammar terminology
   is required to answer (see repo `CLAUDE.md`).
