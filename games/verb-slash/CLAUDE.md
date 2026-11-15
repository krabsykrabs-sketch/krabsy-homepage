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

## Issues (verified by master session 2026-11-12)

1. ~~Game starts twice → double speed.~~ **Fixed 2026-11-16:** inline
   `onclick` removed (one listener per button); `startGame()` cancels
   `S.animId`, pending flow timers (`later()`/`clearFlowTimers()`) and leftover
   sprites first; measured 120 → 60 game frames/s at 60 Hz (start and restart).
2. ~~Debug label visible to players.~~ **Fixed 2026-11-16:** `patternLabel` deleted.
3. **Language:** all in-game text is English only (the wrapper pages say so).
   Fine per the presentation mandate, but check that no grammar terminology
   is required to answer (see repo `CLAUDE.md`).

## Pending owner decision — pacing (2026-11-16)

The game was tuned while running at 2× (every click started two loops), and
physics is per *frame*, so speed also scales with display refresh rate
(120 Hz phones/iPads ran it at 4× before the fix, 2× after). Measured at 60 Hz
after the fix: balloon fully visible 2.9 s / settled ~10 s after Start; beach
balls reach apex in ~4.2 s and leave the screen ~8.8 s after the pop (before:
~2.3 s / ~4.8 s). That is noticeably slow. Proposal (not applied): make the loop
time-based at 120 steps/s — the as-played pacing on 60 Hz screens, identical on
every refresh rate — via a fixed-step accumulator in `gameLoop()` (run the
update body `round((now-last)/(1000/120))` times, capped at ~4).
