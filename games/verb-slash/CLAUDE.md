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

## Pacing — decided 2026-11-16: fixed 120 steps/s

The game had been played and tuned at 2× (every click started two loops), with
per-frame physics, so speed also depended on the display's refresh rate. Owner decision:
keep the as-played pace and make it display-independent. `gameLoop(now)` is
now a fixed-timestep accumulator that runs `gameStep()` (the old per-frame
update, constants unchanged) `STEP_HZ=120` times per second of real time,
keeps the remainder, caps at `MAX_STEPS=5` per frame and resets after gaps
>250 ms (hidden tab) so it never fast-forwards. All tuning constants (gravity,
launch vy, balloon rise, hover delay) are per *step* at 120 steps/s.
