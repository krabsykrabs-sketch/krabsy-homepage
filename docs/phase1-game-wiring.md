# Phase 1 — wire a game to the shared learning engine

Part of the classroom concept (`docs/classroom-concept.md`, phase 1). The
shared pieces are built (2026-11-22). Each game session does the steps below
for its own game. It takes two small changes: **record every answer** and
**ask for a smart round**.

## 1. Record every answer

At every right/wrong moment, call:

```js
import { recordAttempt } from '/lib/krabsy-stats.js';   // no ?v= (see note)

recordAttempt(item, form, correct, source, topic);
```

| Argument | Value |
|---|---|
| `item` | quiz records: `q.item`. Chain records: `rec.verb`. |
| `form` | quiz records: `q.form` (`past` / `participle` / `default`). Chain games: `'past'` for the 2nd form, `'participle'` for the 3rd. |
| `correct` | `true` / `false` — the player's first answer to this question. Don't record retries of the same question as extra wrong answers. |
| `source` | the game id from `homepage/data/games.json`, e.g. `'verb-kitchen'`. |
| `topic` | `q.topic` (quiz) or `'irregular_verbs'` (chains). |

Rules:
- Record only real answers the player chose or typed. A form that was eaten
  by accident in Snake or a plane that crashed in Air Control without a
  choice is not an answer.
- A choice the game shows as wrong counts as wrong, even if the game lets the
  player continue.
- One question = one record. A chain answered in one go (go → went → gone)
  is two records: `past` and `participle`.

Import note: import `krabsy-stats.js` **without** `?v=…`. The question engine
and the class session (phase 2) use that URL; a second copy of the module
under another URL keeps its own cache.

## 2. Ask for a smart round

```js
const KQ = await import('/lib/krabsy-questions.js');
const quiz   = await KQ.getQuizSet({ topic, count: 10, smart: true });
const chains = await KQ.getChainSet({ topic, count: 8, maxLen: 7, smart: true });
```

`smart: true` mixes about 40 % words this player still gets wrong, 40 % new
words from their level and 20 % known words that are due again
(`homepage/lib/krabsy-smart.js`). Ask for a new set at the start of every
round or level, not once per page load, so answers from the last round count.

Keep the inline fallback for `file://` dev, as today.

## 3. Games with their own repetition

Verb Kitchen has its own spaced repetition (`krabsy_vkitchen_save`, practice
keys). Switch it to the shared one: record answers (step 1), take rounds
from `getQuizSet({ smart: true })`, and stop maintaining its own practice
keys. Keep the Verb Cookbook reading the shared stats
(`getItemStats(item, topic)`).

## 4. Check

- Play two rounds, getting the same verb wrong on purpose. Open
  `/de/unregelmaessige-verben/statistik/`: the verb must appear, and it must
  come back in the next round.
- `localStorage.krabsy_stats_v2` in the dev tools shows the records.
- Update the game's `CLAUDE.md` (done/not done), commit your game folder only.

## Status per game

| Game | Where | Owner | Done |
|---|---|---|---|
| Verb Snake | `homepage/krabsy-verb-snake.html` | master | no |
| Air Control | `homepage/krabsy-air-control.html` | master | no |
| Verb Flow | `games/verb-flow/` → `homepage/krabsy-verb-flow.html` | verb-flow session | no |
| Verb Slash | `games/verb-slash/` (inlined into wrappers) | verb-slash session | no |
| Verb Kitchen | `games/verb-kitchen/` (+ step 3) | verb-kitchen session | no |
| Verb Towers | `games/tower-defense/` | tower-defense session | no — before release |
| Verb Dungeon | `games/verb-dungeon/` | verb-dungeon session | no — before release |
| Verb Platformer | `games/verb-platformer/` | verb-platformer session | no — before release |
| Drills (Sprint, …) | `homepage/de|es/…` | master | already record; smart mix not yet (they load through `krabsy-data.js getQuestions`) |
