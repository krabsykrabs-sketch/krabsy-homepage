# Krabsy materials — file format (live classroom, 2026-11-25)

A **material** is one JSON file: a worksheet, a book or a set of picture cards. The
player (`homepage/lib/activities/`, WP L2) renders it; the live classroom (L4) sends
it to the student as one `load {material}` message (≤ 200 KB). Contract:
`docs/live-classroom.md`. Step shapes are the prototype's
(`docs/prototype/tutor-v2/js/student/player.js`, `book.js`), with three changes
listed at the end.

- Canonical copies: `content/materials/*.json` and `content/vocab/es.json`.
- Served copies: `homepage/data/materials/` and `homepage/data/vocab/es.json`
  (identical; copy at release — `tools/check_materials.py` fails when they differ).
- Check after every edit: `python3 tools/check_materials.py`.

## The one rule for the player: never shuffle

Every list is stored **in the order it is shown** (options, word bank, right column
of a match, sort cards, tap pictures). The material is already mixed. The player shows
it as it is, so the tutor's mirror and the student's screen look the same without
sending an order. (Materials made at runtime by `from-engine.js` are mixed once when
they are made, then sent.)

## Vocabulary (`vocab/es.json`)

```json
{ "vaca":     { "es": "la vaca", "en": "cow", "de": "die Kuh", "emoji": "🐄", "set": "animals" },
  "contento": { "es": "contento", "f": "contenta", "en": "happy", "de": "froh", "emoji": "😊", "set": "feelings" } }
```

| Field | Meaning |
|---|---|
| key | word id: `[a-z0-9_]`, ASCII, **stable** (album and answers are stored under it). `raton` = el ratón, `papa` = el papá |
| `es` | the word as shown, with article where natural (`la vaca`, `las uvas`; feelings without) |
| `f` | optional: the feminine form of a describing word (`contenta`); show as "contento · contenta" on cards |
| `en`, `de` | meaning, no article |
| `emoji` | stand-in picture until the picture decision |
| `img` | optional (none yet): picture URL; the renderer prefers it to `emoji` |
| `set` | `animals`, `feelings`, `food`, `family` (tap pictures and sort cards come from one set) |

Words are Rioplatense-safe (Uruguay/Argentina): cerdo, enojado, torta, banana, jugo,
frutilla, galletita; never "concha", "zumo", "fresa", "enfadado", "tarta".

## Material (all kinds)

```json
{ "id": "m_es_farm_1", "kind": "worksheet", "title": "Lucas visits the farm",
  "topic": "es_animals", "level": "A1", "learn": "es", "minutes": 10,
  "blurb": "Meet six farm animals, then tap, match, sort and fill the gaps.",
  "steps": [ … ] }
```

| Field | Meaning |
|---|---|
| `id` | `m_<learn>_<name>`, stable; the file name is the id without `m_`, `_` → `-` (`es-farm-1.json`) |
| `kind` | `worksheet` (steps) · `cards` (steps, only `cards` steps) · `book` (pages) |
| `topic` | a vocabulary topic (`es_animals`, `es_feelings`, `es_food`) or a question topic (`es_ser`, `es_estar`, `es_ser_estar`, `es_tener`). For the library filter only; **answers are recorded under each sentence's own `topic`** |
| `level` | `Pre-A1`, `A1`, `A2`, `B1` |
| `minutes` | about how long it takes |
| `blurb` | one line for the library card |
| `source` | optional, runtime materials only: `{ "kind": "quick" }` or `{ "kind": "v1", "worksheet_id": 12 }` |

## Steps (worksheet / cards)

Every step has `type` and `title` (the player falls back to its own label when
`title` is missing). `hint` (optional, any step) is the text of the hint button where
the type has no hint ladder of its own.

### `text` — intro card
```json
{ "type": "text", "title": "Lucas visits the farm", "body": "Lucas is at his grandmother’s farm today …", "pic": "🚜" }
```
English (interface language) story line, Spanish only in the activities. "Let’s go!" button.

### `cards` — picture cards (flip: picture → word, "I know it / again")
```json
{ "type": "cards", "title": "Meet the animals", "words": ["vaca", "caballo", "cerdo"] }
```
`words` = vocab ids, in this order. Seen only, never recorded as right/wrong.

### `tap` — hear/read the word, tap its picture
```json
{ "type": "tap", "title": "Tap the picture",
  "items": [ { "word": "vaca", "options": ["cerdo", "pato", "oveja", "vaca"] } ] }
```
One item per screen, in order. `options` = 3–4 vocab ids, shown in this order, one of
them is `word`. (Prototype: `words` + random pictures from the set; now explicit.)

### `match` — tap left, tap right
```json
{ "type": "match", "title": "Match the pairs",
  "words": ["oveja", "pato", "caballo"], "right": ["pato", "caballo", "oveja"] }
```
Left column = pictures in `words` order, right column = the Spanish words (`es` of the
vocab entry) in `right` order (`right` is the same ids, mixed).

### `sort` — sort cards into baskets
```json
{ "type": "sort", "title": "Sort into baskets",
  "baskets": [ { "id": "two", "label": "Tiene 2 patas", "sub": "two legs", "pic": "🧺" },
               { "id": "four", "label": "Tiene 4 patas", "sub": "four legs", "pic": "🧺" } ],
  "cards": [ { "w": "gallina", "b": "two" }, { "w": "vaca", "b": "four" } ],
  "hint": "Count the legs." }
```
`cards` = tray order; `w` = vocab id, `b` = the basket id it belongs to. Basket
`label` is Spanish, `sub` its meaning in the interface language.

### `gap` — sentences with one gap: drag, typed or choice
```json
{ "type": "gap", "title": "Drag the word into the gap", "mode": "drag",
  "bank": ["es", "están", "tengo", "son", "está", "tiene"],
  "sentences": [
    { "text": "La vaca ___ grande.", "answer": "es", "accepts": ["es"],
      "options": ["está", "es", "son"], "hint": "", "en": "The cow is big.",
      "teach": "…", "item": "se_es_esta", "topic": "es_ser_estar" } ] }
```

| Field | Meaning |
|---|---|
| `mode` | `drag` (shared word bank, prototype) · `choice` (chips per sentence) · `typed` (typewriter with accent bar á é í ó ú ñ ¿ ¡) |
| `bank` | **drag only**: the chips of the shared word bank, in order. Contains every sentence's `answer` (a word twice when two sentences need it) plus wrong extras |
| `sentences[].text` | Spanish, exactly one `___` |
| `answer` | the right answer, as shown (capitalised when the gap starts the sentence) |
| `accepts` | typed answers that count as right, lower case (compare trimmed, lower-cased, spaces collapsed; accents count: `está` ≠ `esta`) |
| `options` | 3 choices in display order, `answer` among them. Every sentence has them in every mode, so the tutor can switch a step's mode without new data |
| `hint` | **visible clue shown in brackets after the sentence from the start**, e.g. `Me llamo Pablo. Soy ___.` + `"tall"` → `Me llamo Pablo. Soy ___. (tall)`. Part of the question (without it the gap is ambiguous); empty for most sentences. Same meaning as the engine's `display.hint` and v1 worksheets' `hint` |
| `en` | the whole sentence in English: **hint ladder step 1** (hidden until 💡 is pressed; the prototype called this `hint`). Optional (runtime materials from the engine have none; then the ladder starts at "one option out") |
| `teach` | the after-answer teach line (grammar words allowed here, never in `text`/`hint`) |
| `item`, `topic` | where the answer is recorded: `recordAttempt(item, form, correct, 'live', topic, mode)`. `topic` is a registered question topic, `item` an item id of that topic file (`homepage/data/es-*.json`) |
| `form` | optional, default `"default"` (irregular verbs: `past` / `participle`) |

Hint ladder (prototype): 1 English sentence (`en`) → 2 one wrong option greyed out →
3 first letter. Two wrong tries → the answer is shown (counts as not first-try).

## Book (`kind: "book"`, prototype `book.js` shape)

```json
{ "id": "m_es_book_granja", "kind": "book", "title": "La granja", "author": "A Krabsy storybook", …,
  "pages": [
    { "scene": "field", "cast": [["🐄", 58, 54, 6.5], ["👧", 22, 64, 3.6]],
      "es": "En la granja hay una {vaca|la vaca|the cow|🐄|vaca}. La vaca es {grande|grande|big|🐘}.",
      "en": "On the farm there is a cow. The cow is big." },
    { "check": true },
    { "end": true } ],
  "check":     { "q": "¿Quién es grande?", "en": "Who is big?", "options": ["vaca", "pollito", "gato"], "answer": "vaca", "teach": "La vaca es grande." },
  "endChecks": [ { "q": "…", "en": "…", "options": ["pato", "cerdo", "oveja"], "answer": "cerdo", "teach": "…" } ],
  "words": ["vaca", "caballo", "cerdo"] }
```

- Story page: `scene` (CSS class `scene-<name>`: `farm`, `field`, `mud`, `barn`, `pond`,
  `evening`), `cast` = `[emoji, x %, y %, size]`, `es` text with tap words, `en`
  translation (behind "Show in English", off by default).
- Tap word markup: `{shown|card word|meaning|picture|vocab id}`; the vocab id is
  optional (words outside the vocabulary, like *granja*, carry their own card).
- `{ "check": true }` page = the mini question in `check`; `{ "end": true }` = the
  "words you met" gallery (`words`, vocab ids) followed by the `endChecks` in order.
- Check `options` / `answer` are vocab ids (picture tiles), in display order.

## Changes against the prototype (L2: port with these)

1. Nothing is shuffled by the player (see the rule above): `tap.items[].options`,
   `match.right`, `sort.cards` order, `gap.bank` are given.
2. `gap` uses `sentences[]` (`text`/`answer`, not `s`/`a`) with `mode`, `accepts`,
   `options`, `item`, `topic`; the drag bank is `bank` (prototype: answers + `extra`).
3. Gap `hint` is now the visible bracket clue; the prototype's hidden translation is
   `en`. Vocab entries are `{es, en, de, emoji, set}` keyed by id (prototype: `full`,
   `pic`); `en` has no article.

## Runtime materials (`homepage/lib/activities/from-engine.js`)

- `quickPractice({topic, count, mode, focus, lang})` → a worksheet with one `gap`
  step built from the question engine (`getQuizSet`, 3 options); `focus` = item ids
  asked first (the student's "words to practise").
- `fromV1Worksheet(ws)` → a v1 tutor worksheet (`api/tutors.py`, `questions[]`) as a
  material: `typed`/`choice` → one gap step, `mixed` → a choice step then a typed step.

Both give the same shapes as the files here and pass `tools/check_materials.py`
(the headless check: `node tools/check_from_engine.mjs <port>` against the local site).

## Quality bar (`docs/tutor-platform-v2.md` §5.3)

A story context, an arc of 3–5 blocks (picture intro → recognise → choose → type),
8–12 minutes, at least 2 non-text activity types, never grammar terms in a question or
hint, wrong choices that really are wrong and look alike (capitalised together).
Grammar worksheets use the topic file's real sentences (the checker reports which
sentences are the worksheet's own). Every worksheet waits for Nora's review.
