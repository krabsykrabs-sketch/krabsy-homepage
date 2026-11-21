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

## Open issues from the play-test 2026-11-21 (`docs/playtest-2026-11-21.md`)

Verdict: fix (small). Line numbers refer to `homepage/de/spiele/verb-slash/index.html`.

1. **Colour gives the answer away:** correct balls always get the
   `fruit-correct` class (`:593`, CSS `:121–126`), so kids can play by
   colour without reading. Randomise the colours.
2. **Slow start:** balloons take 5.1 s to arrive (`:787`). A plain
   click or tap does nothing; only a 30 px swipe counts (`:448`). Let a
   tap count too.
3. An ignored ball costs a life after 4.6 s, and the right answer is never
   shown after a mistake. Show the full chain `go → went → gone`.
4. All in-game text is English on both language pages. Add DE/ES UI (see
   Verb Flow, Verb Snake, Air Control from 2026-11-16 for the pattern). The
   start-screen sentence uses "simple past and past participle": rephrase
   it without terms.
5. Phone portrait: it renders as a 390×220 px strip with a 72×19 px
   start button.
Owner OK is still needed before starting.
