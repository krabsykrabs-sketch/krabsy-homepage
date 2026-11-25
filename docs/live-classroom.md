# Live classroom — build contract (2026-11-25)

Owner decision 2026-11-25: **the live classroom comes first** (before the rest of
`docs/tutor-platform-v2.md`), so the owner can test it in real lessons with Nora.
The 3D avatar classroom with a blackboard is **parked**.

## The idea

Zoom (or any call) stays for face and voice. **Nobody shares a screen.** Krabsy is
the shared workspace:

1. The student has **one personal link that never changes** (`/en/spanish/me/#k=…`,
   bookmarked). No new link per lesson.
2. The tutor opens the student and clicks **Start live lesson**. The student's page
   (if open) switches to the lesson by itself.
3. **Both computers render the material themselves.** Only small messages travel:
   the student's state (answers, what is typed, what is dragged, the book page),
   the pointer position (~10×/s), the tutor's commands. Fast on slow internet,
   sharp, no video.
4. The tutor sees a **mirror** of the student's screen: the same material in the
   same state, the student's pointer as a small hand, typing letter by letter.
5. The tutor can **add material on the fly** (curated material, a quick practice
   set from any topic, a saved worksheet), **point** at something on the student's
   screen, give a **hint**, **show the answer**, move **next/previous** (steps,
   book pages), send a **star** or a **gift**, keep **notes**, and **end** the lesson
   (summary + lesson note saved).
6. Nothing is recorded as video; answers count like any game answer (star map).

Most students sit at a computer; the student side must work well with mouse and
keyboard, and also on a tablet. The tutor page must work **beside Zoom: compact at
~700 px wide**, two columns from ~1100 px.

## Pieces and file ownership

Agents stage **only their own paths** (`git add <paths> && git commit`), never
`git add -A`, never push. If `index.lock` blocks, wait and retry.

| WP | What | Owns |
|---|---|---|
| L1 relay | WebSocket relay + lesson memory on the API | `api/live.py`, `api/tests/test_live.py`, `api/main.py` (router include + CORS header only), `api/Dockerfile` (COPY line only) |
| L2 player | The real activity player + book reader, ported from the prototype, with the sync API below | `homepage/lib/activities/` except `from-engine.js` |
| L3 content | Vocabulary, curated materials, engine → material converter | `content/materials/`, `content/vocab/`, `homepage/data/materials/`, `homepage/data/vocab/`, `homepage/lib/activities/from-engine.js` |
| L4 live UI | Tutor live page, student lesson mode, client WS wrapper, entry buttons | `homepage/lib/krabsy-live.js`, `krabsy-live-tutor.js`, `krabsy-live-student.js`, `krabsy-live.css`, `homepage/en/spanish/tutors/live/`, and in `homepage/lib/krabsy-tutor.js` only: the Start-live button and the student-page hook |

The prototype to port from: `docs/prototype/tutor-v2/` (`js/student/player.js`,
`book.js`, `drag.js`, `js/tutor/live.js`, `css/`, `js/data.js` for vocabulary and the
three real materials). Keep its look and feel; it was designed and reviewed.

## Material format (L3 produces, L2 renders)

A material is one JSON object. Shapes follow the prototype's step shapes so the
port stays simple; L3 documents the final shapes in `content/materials/README.md`.

```json
{
  "id": "m_es_farm_1",
  "kind": "worksheet",                // worksheet | book | cards
  "title": "Lucas visits the farm",
  "topic": "es_animals",              // or an existing topic id (es_ser …)
  "level": "A1",
  "learn": "es",
  "minutes": 10,
  "steps": [                          // worksheet / cards
    { "type": "cards", "title": "…", "words": ["vaca", "cerdo"] },
    { "type": "tap",   "title": "…", "items": [{ "word": "vaca", "options": ["vaca", "oveja", "pato"] }] },
    { "type": "match", "title": "…", "pairs": [["vaca", "la vaca"]] },
    { "type": "sort",  "title": "…", "baskets": [{ "label": "…", "words": ["…"] }] },
    { "type": "gap",   "title": "…", "mode": "drag",   // drag | typed | choice
      "sentences": [{ "text": "La ___ dice muu.", "answer": "vaca", "accepts": ["vaca"], "options": ["vaca", "oveja"], "hint": "", "teach": "", "item": "…", "topic": "…" }] }
  ],
  "pages": [ … ]                      // book only (prototype book.js shape)
}
```

Vocabulary: `homepage/data/vocab/es.json`: `{ "<wordId>": { "es": "la vaca", "en": "cow", "de": "Kuh", "emoji": "🐄" } }`
(emoji = stand-in pictures until the picture decision; the renderer must take an
optional `img` too). Curated list: `homepage/data/materials/index.json`
`[{ id, kind, title, topic, level, minutes, file }]`.

Questions never require grammar terminology (CLAUDE.md presentation mandate);
Spanish must be safe in Uruguay/Argentina (never "concha").

## Player API (L2 implements, L4 uses)

`homepage/lib/activities/player.js`:

```js
const p = mountPlayer(root, material, {
  role: 'student' | 'mirror',   // mirror = tutor's view: renders state, no own input
  lang: 'en',                   // interface language for labels
  adult: false,
  vocab,                        // the vocabulary object (or the player loads it)
  onState(state) {},            // student: called on EVERY visible change (debounce ≤ 150 ms)
  onCursor(pos) {},             // student: pointer as {a, x, y} (anchor + 0..1 inside it), throttle 100 ms
  onAnswer(ans) {},             // student: {step, item, given, correct, first, topic, ref}
  onEnd(summary) {},            // student: finished the material
});
p.getState()        // JSON-serialisable: step, per-item results, current inputs
                    // (typed text, picked piece, placed pieces), book page, stars
p.apply(state)      // mirror: render exactly this state (idempotent, cheap)
p.cmd({ type: 'hint' | 'reveal' | 'next' | 'prev' | 'goto', step?, page? })
                    // student side: the tutor's commands (reveal = show the answer
                    // of the current item, counts as not first-try)
p.point({ a, x, y }) // student side: show the tutor's pulse at that spot (2 s)
p.cursor({ a, x, y }) // mirror: move the ghost hand
p.anchorAt(clientX, clientY) // → {a, x, y}: nearest element with data-anchor, x/y 0..1 in it
p.destroy()
```

**Anchors:** every meaningful element has a stable `data-anchor` (e.g. `step`,
`s2.gap3`, `s2.opt.vaca`, `s1.card.vaca`, `book.page`, `book.word.vaca`). Pointer and
point positions are sent relative to the nearest anchor, so they land on the same
thing even though the two screens have different sizes and layouts.

`book.js` `mountBook(root, material, opts)` has the same API (state = page + taps +
check answers). `mountMaterial(root, material, opts)` picks the right one.

Recording: the student side records every first-try answer with
`recordAttempt(item, form, correct, 'live', topic, mode)` from `/lib/krabsy-stats.js`
(the class pipeline sends it to the tutor's star map). The player does this itself
when `role: 'student'` and the sentence/word has an `item` + `topic`.

## Protocol (L1 implements, L4 uses)

`WS /api/live/ws` (same API host as the Quiz Room: `wss://api.krabsy.com/api/live/ws`),
JSON messages with field `t`.

Hello (first message):
- tutor: `{t:'hello', role:'tutor', token, student:<tutor_student id>}`
  (token = the tutor's session or old private-link token; checked with `tutors._tutor`)
- student: `{t:'hello', role:'student', key}` (the student key = student token)
→ `{t:'ready', role, name, tutor, lesson}` where `lesson` is the current lesson
  snapshot or null: `{started, material, state, items:[…queue…], index}`.
→ errors: `{t:'error', code:'auth'|'busy'|'bad'}` then close.

One room per student (`tutor_students.id`). At most one tutor and one student
connection; a new connection of the same role replaces the old one.

Tutor → server → student:
- `start {}` · `end {summary?}` (lesson over; the room keeps a short snapshot)
- `load {material}` (show this material now; ≤ 200 KB)
- `cmd {type, step?, page?}` · `point {a, x, y}` · `reward {kind:'star'|'gift'}`

Student → server → tutor:
- `state {state}` (full state; server keeps the last one) · `cursor {a, x, y}`
  (server drops above 20/s) · `answer {…}` · `focus {visible:bool}`

Server → both: `presence {tutor:bool, student:bool, visible:bool}` whenever it
changes. Pings every 25 s; reconnect with the same hello resumes (the server sends
the snapshot: material + last state), so a reload on either side continues the
lesson at the same place.

Memory only (like the Quiz Room): a room lives 3 h after its last message. Answers
are recorded by the student page (above); the lesson note is saved by the tutor page
via the existing `POST /api/tutor/student/lesson`.

Limits: message ≤ 256 KB, ≤ 60 messages/s per connection (cursor ≤ 20/s), rooms ≤ 500.

## Tutor live page (L4)

`/en/spanish/tutors/live/#s=<student id>` (noindex, same look as the tutor pages;
the prototype's live classroom is the visual reference, but compact first):

- Header: student name, presence ("Lucas is here" / "not here yet — send the link" /
  "left the lesson tab"), lesson clock, End lesson.
- **Mirror** of the student's screen (the real player, `role:'mirror'`) with the
  ghost hand and typing as it happens; a **Point** tool (click on the mirror → pulse
  on the student's screen); **Hint · Show answer · ◀ ▶ · ⭐ · 🎁**.
- **Lesson queue**: materials for this lesson, current one highlighted, **+ Add**
  drawer: Krabsy materials (index.json), **Quick practice** from a topic (topic,
  6/10 questions, drag/typed/choice, "focus on words to practise" → `from-engine.js`),
  the student's saved v1 worksheets (converted). Click = show now; reorder; remove.
- **Answers** column: each answer as it comes (✓/✗, what was given), first-try count.
- **Notes** box; **End lesson** → summary (materials done, right on first try, words
  to practise) → saved as the lesson note (editable before saving).
- Layout: ≤ 1100 px one column (mirror on top, controls in a bar, queue and answers in
  tabs); ≥ 1100 px two columns. Must be usable at 700 px next to Zoom.

Entry: a **Start live lesson** button on the v1 student page (`krabsy-tutor.js`
student profile) and on each student card in the space. The old v1 "Show live"
(polling) is replaced by this.

## Student lesson mode (L4)

On `/en/spanish/me/` (the student's own page): when the page is open it connects to
the live room. Lesson started → full-width lesson view: a calm waiting card
("Nora is getting the next thing ready") until a material is loaded, then the
player. The tutor's pulse appears where she points; star/gift celebrations as in v1
(adults: star only). Page hidden → `focus {visible:false}`. Lesson ended → a short
"Lesson done" card, then back to the normal page. Works with mouse, keyboard, touch.

## Done means (acceptance)

Tested headless with two browser contexts (tutor and student) against the local API
(`python3 tools/dev_api_server.py <port>` with `KRABSY_DATA_DIR` in a scratch dir):

1. Tutor starts, student page switches to the lesson; tutor adds the farm worksheet;
   student drags/taps/types → the tutor's mirror shows the same state within 0.5 s,
   including partly typed text and the ghost hand moving.
2. Point, hint, show answer, next/prev, star, gift arrive on the student side.
3. Quick practice from `es_ser_estar` (typed) works; answers reach the star map
   (`attempts` with mode).
4. The book *La granja*: the tutor turns pages for both; tapped words show for both.
5. Reload of either side resumes at the same place; student tab hidden → tutor sees it.
6. End lesson → summary → lesson note saved.
7. Tutor page usable at 700 px and 1360 px; student page at 1280 px and 820 px (tablet).
8. API tests pass (`api/tests/`), 0 console errors.

## Deviations

### L1 relay (`api/live.py`)

Additions to the protocol (nothing in the contract changed):
- `ready` also carries `adult` (bool).
- Replaced connection: the old one gets `{t:'error', code:'replaced'}` and is closed.
  Clients must **not** auto-reconnect after `replaced` (two tabs would fight).
- Non-fatal `{t:'error', code:'too_big'}` (connection stays open) for a message
  > 256 KB or a `load` material > 200 KB. Only hello errors close the socket.
- Lesson queue: `start` and `load` accept optional `items` (≤ 60, stored as given)
  and `index`; a new tutor message `queue {items, index}` stores the queue without
  relaying. The snapshot returns them, so a tutor reload restores the queue.
- `load` without a running lesson starts one (the student gets `start`, then `load`).
  `start` during a running lesson keeps it (no reset).
- Snapshot differs per role. Student: `{started, material, state, items, index}`,
  or null once the lesson ended. Tutor: also `answers` (last 400, each with
  server `at`), `ended` (iso or null) and `summary`.
- `point` is limited like `cursor` (20/s); x/y are clamped to 0..1, anchor ≤ 80 chars.
- Server sends `{t:'ping'}` every 25 s; a client `{t:'ping'}` gets `{t:'pong'}`.
- Presence `visible` is false while the student is not connected; a new student
  hello resets it to true (the page sends `focus` if it is hidden).
- Rooms are swept (no connection + 3 h since last message) when the 500-room limit
  is reached; a room with someone connected is never swept.

### L3 content (`content/materials/`, `content/vocab/`, `from-engine.js`)

Final shapes: `content/materials/README.md`. Against the example above:
- **Nothing is shuffled by the player**: options, `tap.items[].options`, `match.right`,
  `sort.cards`, the drag `bank` are stored in display order (mirror = student without
  sending an order). `from-engine.js` mixes once when it makes a material.
- `tap` = `items[{word, options}]` (as above); `match` = `words` + `right` (ids, not
  `pairs`); `sort` = prototype `baskets[{id,label,sub,pic}]` + `cards[{w,b}]`.
- `gap` sentence `hint` = the **visible** bracket clue (engine / v1 meaning, e.g. `(tall)`);
  the prototype's hidden translation for hint step 1 is `en`. Drag steps carry `bank`.
  `options` may be `[]` only in a runtime typed step (v1 question saved without choices).
- Vocab entries also have `set` (and `f` = feminine form for feelings); `en` has no article.
  `index.json` rows also carry `blurb`. Extra kind `cards` (only `cards` steps).
- Vocabulary topics (`es_animals`, `es_feelings`, `es_food`) are not registered question
  topics, so tap/match/sort answers have no star-map target yet; gap sentences in every
  worksheet do carry a real `item` + `topic` (es_ser … es_tener).
