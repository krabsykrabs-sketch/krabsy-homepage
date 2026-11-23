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

## Play-test fixes 2026-11-21 (`docs/playtest-2026-11-21.md`) — done, awaiting master review

All seven items are fixed in the source and both wrappers (not committed by the
game session).

1. ~~Colour gives the answer away.~~ **Fixed:** `fruit-correct/-wrong/-wrong-alt`
   and `phase-pp-ball` are gone. Each wave deals a shuffled 5-colour palette
   (`.fruit-c0…c4`, `BALL_COLOURS=5`) by position, independent of right/wrong.
   Right/wrong shows only after the slash (flash, particles, teach card).
2. ~~Slow start.~~ **Fixed:** balloons start `BALLOON_START_BELOW=10` px under
   the bottom edge (was 160) and rise with `BALLOON_EASE=0.02`,
   `BALLOON_MIN_SPEED=0.5` per step (was 0.006 / 0.08). Measured: balloon
   tappable 0.1–0.2 s after Start, settled after 1.3 s (portrait 1.6 s; was
   5.1 s); first ball reachable 0.3–0.6 s after Start when the balloon is
   tapped at once. Ball physics (`GRAVITY`, `LAUNCH_VY_*`) unchanged on the
   landscape stage. Still 120 steps/s (measured 119–121 on start and restart).
3. ~~Tap must work.~~ **Fixed:** `tapAt()` — pointer-down on a balloon or ball
   counts as a slash (nearest target, radius + `TAP_PAD=10`). The 30 px swipe
   still works; a press that already hit something doesn't also start a swipe.
4. ~~Teach after a mistake.~~ **Fixed:** `mistake()` — a wrong slash or a missed
   correct ball ends the wave and shows `#teach-card` for `TEACH_MS=2400`:
   `go → went → gone`, asked form highlighted amber. The verb goes back to the
   front of the queue (one of the next two balloons). **The first mistake of
   each game costs no life** (`S.freeMiss`, the card says so). Game over now
   comes after the card (was 500 ms after the hit). Changed rule: a wrong slash
   ends the wave at once (before, the other balls kept flying).
5. ~~DE/ES UI.~~ **Fixed:** `STR` table (de/es/en) + `t()` + `data-i18n`.
   Lookup: wrapper `<html lang>` → `?lang=` → `krabsy_lang` → DE. EN is only
   reachable via `?lang=en` on the standalone source.
6. ~~Grammar terms.~~ **Fixed:** the start sentence uses `go → went → gone` in
   all three languages.
7. ~~Phone portrait strip.~~ **Fixed:** the stage is no longer always 1280×720.
   `resizeWorld()` uses 720 × (up to 1600) in portrait (`GW`/`GH` are now `let`),
   so a 390×844 phone gets a 390×760 stage instead of 390×220. Ball launch speed
   and gravity scale with `GH/720` (per-ball `f.g`), and patterns are fanned out
   1.4× on the narrow stage. Buttons are at least 46 CSS px tall at any scale
   (`--tap-min`, `--btn-font`, `--txt-min`, `--hint-min`). Ball label font sizes
   went up one step (`fontSz`: 36/31/26/21/17).

**Source = wrapper again.** The source had drifted behind the wrappers (older
physics constants, none of the perf changes). It was rebuilt from the DE
wrapper's game parts and now differs only in: `<head>`, Google-Fonts import,
`html,body` rule, `NAV=0,HINT=0` in `resizeWorld()` and the document
`touchmove` listener. The game `<style>`, `#game-world` markup and `<script>`
are identical in DE and ES.

Open for the master session:
- The info section below the game still says the in-game hints are English and
  that you swipe "mit gedrückter Maustaste" (DE and ES; data behind
  `tools/render_game_info.py`). Outdated now: the UI is translated and a
  click or tap is enough.
- JSON-LD `VideoGame.inLanguage` is still `en`.
- Issue 3 in the first list ("Language") is closed by items 5 and 6.

## TODO: phase 1 — shared learning engine (from master, 2026-11-22)

Record every answer with `recordAttempt()` and take rounds with `smart: true`. Recipe: `docs/phase1-game-wiring.md`. Mark it done there and here when finished.

## OFFLINE since 2026-11-23 (master session, owner decision)

Taken off the site like Crab Slash: out of `games.json`, the hubs, related
lists and the sitemap; the wrappers stay reachable with `noindex, follow`.
Reason: the 2D games look weak next to the 3D games, median time 0:39, and
the colour tell (the right ball is always the same colour) from the play
test. It can come back after a redesign — ask the owner first.
