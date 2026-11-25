# Activity player + book reader (live classroom, WP L2)

Contract: `docs/live-classroom.md` (Player API). Material format: `content/materials/README.md`.
Ported from the reviewed prototype `docs/prototype/tutor-v2/` (`js/student/player.js`,
`book.js`, `drag.js`, `css/student.css`); keep its look.

| File | What |
|---|---|
| `player.js` | `mountPlayer` (worksheets / cards), `mountMaterial` (picks player or book) |
| `book.js` | `mountBook` (books: pages, tap words, check questions, end gallery) |
| `drag.js` | `dragTap`: drag with a tap alternative (pointer events), with pick/drag hooks |
| `util.js` | escaping, speech, vocabulary, labels (en/de), anchors, overlay (pulse + ghost hand) |
| `activities.css` | all styles, self-contained tokens on `.kp` / `.bk`, container queries |
| `from-engine.js` | owned by L3: quick practice / v1 worksheets → materials |

## Use

```html
<link rel="stylesheet" href="/lib/fonts/krabsy-fonts.css">
<link rel="stylesheet" href="/lib/activities/activities.css">
```
```js
import { mountMaterial } from '/lib/activities/player.js';
// student
const p = mountMaterial(el, material, { role: 'student', lang: 'en', adult, vocab,
  onState: s => ws.send({ t: 'state', state: s }),          // every visible change, ≤ 60 ms after it
  onCursor: pos => ws.send({ t: 'cursor', ...pos }),        // {a, x, y}, ≤ 10/s; a = 'off' = pointer left the player
  onAnswer: a => ws.send({ t: 'answer', ...a }),
  onEnd: sum => …,
  state: savedState,                                         // optional: resume after a reload
});
p.cmd({ type: 'hint' | 'reveal' | 'next' | 'prev' | 'goto', step, page });
p.point({ a, x, y });                                        // tutor's pulse, 2 s
// tutor's mirror
const m = mountMaterial(el, material, { role: 'mirror', lang: 'en', vocab });
m.apply(state); m.cursor(pos); m.anchorAt(clientX, clientY)  // → {a, x, y} for Point
```

- The host element needs a height (the player fills it: `height: 100%`). The player
  has `min-height: 480px` (book 520) for the student; the mirror has none.
- `vocab` is optional: without it the player loads `/data/vocab/<learn>.json` itself
  (`await p.ready` if you need it mounted). Calls before that are queued.
- `p.getState()` is plain JSON. A state is complete: a fresh mirror + `apply(state)`
  shows the same screen (reload of the tutor page); a student mounted with
  `opts.state` (or `apply(state)` on a student) continues there, timers included.
- Extras (not in the contract): `p.reward({kind: 'star'|'gift', g})` plays the
  celebration on the student and, through the state, on the mirror (a tutor star adds one
  ⭐ to the worksheet's stars; adults get no gift). Book: `cmd({type: 'lock', on})` /
  `p.lock(v)` = "I turn the pages" (the student's arrows, swipe and keys stop).
- `onAnswer(a)`: `{step, item, given, correct, first, shown, topic, mode, ref, a}` —
  every decisive attempt (right, wrong, shown). `first` = first attempt on that item,
  `ref` = the whole right sentence / word, `a` = anchor of the item, `mode` =
  `choice | typed | hint`. Book: `step` = page.
- Recording: student role only, the first attempt of an item, through
  `recordAttempt(item, form || 'default', correct, 'live', topic, mode)` — only when the
  sentence (or vocab entry) has `item` + `topic` (material `topic` is a library filter,
  never a recording topic). Picture cards and book word taps are "seen", never recorded.

## State (what travels)

Worksheet: `{v, kind: 'worksheet', id, n, step, stars, first, total, practise, done,
msg, fx, fxn, rec, ss: [step states], scroll}`. `ss[i]` keeps each visited step, so
`prev`/`goto` show a finished step with its answers. Typed text, the picked piece,
the dragged piece (`drag`, shown under the mirror's ghost hand), the target tapped first
(`waiting`), wrong tries, hints and filled gaps are all in the step state. `fx` = the
last one-off animations, numbered; each side plays only numbers it has not played yet
(a fresh mirror plays none). Book: `{kind: 'book', page, en, seen, tapped, card,
checks, endStep, locked, stars, …}`.

The player never shuffles a list the material gives (L3 rule): `tap.items[].options`,
`match.right`, `sort.cards`, `gap.bank`, `gap.sentences[].options`. Older prototype
shapes (`tap.words`, `match.words` without `right`, `gap.items` with `s/a`, contract
`match.pairs`, `sort.baskets[].words`) still work; there the student side mixes once and
the order travels in the state.

## Anchors

`root`, `step`, `title`, `stars`, `hint`, `msg`, `dots`, `dot<k>`;
`s<i>.go`, `s<i>.card.<word>`, `s<i>.say`, `s<i>.know`, `s<i>.again`, `s<i>.tile.<word>`,
`s<i>.l.<key>` / `s<i>.r.<key>`, `s<i>.chip.<key>`, `s<i>.basket.<id>`, `s<i>.tray`,
`s<i>.gap<n>`, `s<i>.slot<n>`, `s<i>.opt.<word>[~k]` (bank chip; `~1` = second chip with
that word), `s<i>.gap<n>.opt.<word>` (choice), `s<i>.check<n>`, `s<i>.acc.<char>`,
`s<i>.bank`, `end`, `end.again`;
book: `book.page`, `book.pic`, `book.text`, `book.word.<id or word>[~k]`, `book.card`,
`book.en`, `book.q`, `book.tile.<id>`, `book.fb`, `book.prev`, `book.next`, `book.dot<k>`,
`book.g.<id>`, `book.fin`. A missing anchor falls back to its parent (`s2.opt.vaca` →
`s2.opt` → `s2` → `step`).

## Test

A side-by-side harness (student + mirror wired through plain function calls) with a
headless Playwright run lives outside the repo (the L2 report names it); it checks every
step type, partly typed text, the ghost hand and the dragged piece, point, hint /
reveal / next / prev / goto, book page turns, word taps, check questions and resume.
