# Game analytics — what games report, and how

Owner request 2026-11-22: game-specific statistics so level difficulty can
be tuned — which towers were built in which level for how much money, how
many questions were answered, did the player win, lose or quit.

The pipeline is built (master session, 2026-11-22). Each game session adds
the calls for its own game.

## How it works

1. **Answers are counted automatically.** Every `recordAttempt()` (phase 1,
   `docs/phase1-game-wiring.md`) also tells the page analytics "one answer,
   right/wrong, from game X". The dashboard shows answers, % right and
   answers per minute per game. Nothing extra to do.
2. **Game events** describe what happens in a level. A game calls:

   ```js
   import { gameEvent } from '/lib/krabsy-game-events.js';
   gameEvent('verb-towers', 'tower_built', { level: 3, wave: 2, tower: 'cannon', cost: 50, coins_left: 12 });
   ```

   The game runs in an iframe; the helper posts the event to the wrapper
   page, whose tracker (`/lib/krabsy-analytics.js`) sends it to
   `api.krabsy.com` with the page-visit id. Nothing is stored in the
   browser. Max 300 events per page visit.
3. The dashboard (`api.krabsy.com/dashboard/`, section **Games in detail**)
   shows per game: a level table (started, won, lost, **left** mid-level,
   win rate, median minutes, answers per level, % right, wave where players
   left) and a breakdown of every other event per level and attribute
   (e.g. `tower_built · level 3 · tower=cannon · 41× · avg cost 50, wave 2.3`).

## Rules (enforced by the server — anything else is dropped)

- `game`, event `name`: lowercase slugs `a-z 0-9 - _`, max 32 chars. Use
  the game id from `homepage/data/games.json`.
- `data`: one flat object, at most 24 keys, keys are slugs, values are
  numbers, booleans or short slug strings (`'cannon'`, `'won'`).
- **No free text, no words the player typed, nothing about the player.**
- `level` inside `data` becomes its own field — always send it.
- Send events at moments, not per frame. A level typically produces a few
  dozen events.

## Standard events (every game)

| Event | Data | Meaning |
|---|---|---|
| `level_start` | `level` | a level/round begins (also on retry) |
| `level_end` | `level`, `result: 'won' \| 'lost'`, `seconds`, `answers`, `correct`, + game-specific totals | the level is over |

**Quitting needs no event:** a `level_start` without a `level_end` in the
same page visit counts as *left*. The last event before leaving (its
`wave`, `lives`, `coins` …) shows where players gave up — so send progress
events such as `wave_end` with the current state.

## Verb Towers (proposal for the tower-defense session)

| Event | Data |
|---|---|
| `level_start` | `level` |
| `wave_start` | `level, wave, coins, lives, towers` |
| `tower_built` | `level, wave, tower` (`basic`/`catapult`/`cannon`/`freeze`), `cost, coins_left` |
| `tower_upgraded` | `level, wave, tower, tier, cost, coins_left` |
| `tower_sold` | `level, wave, tower, refund` |
| `not_enough_coins` | `level, wave, tower` — tried to build/upgrade without money (frustration signal) |
| `wave_end` | `level, wave, lives, coins, leaked` (enemies that reached the castle), `answers, correct` (in this wave) |
| `level_end` | `level, result, stars, wave, lives, seconds, answers, correct, coins_earned, towers_built` |

`wave` is the wave number at the moment of the event (0 = before the
first wave). `seconds` = active play time of the level.

## Other games (when their sessions get to it)

- **Verb Kitchen:** `level_start/level_end` (+ `stars, orders, dishes_burnt`),
  `order_served`, `plate_washed`.
- **Verb Dungeon:** `level_start/level_end` (+ `rooms, keys, hits_taken`),
  `room_cleared {level, room, seconds}`, `door_opened`, `player_down`.
- **Verb Platformer:** built 2026-11-22 (`games/verb-platformer/src/analytics.js`):
  `level_start {level}`, `gate_passed {level, gate, first_try, seconds}`,
  `wrong_answer {level, gate}`, `fell {level, gate, cause: gap|wrong|hazard}`
  (gate = the one ahead), `level_end {level, result: won, stars, seconds,
  answers, correct, gates, falls}`. There is no "lost": a level ends at the
  flag or is left.
- **Arcade games** (Snake, Flow, Air Control, Slash): `level_start/level_end`
  with `score` is enough.

## Privacy

Counts and game states only, tied to one anonymous page visit; no
cookies, no ids across visits, no content of answers. The privacy pages
(DE `datenschutz`, ES `politica-privacidad`) mention this since 2026-11-22.
