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

### L2 player (`homepage/lib/activities/`)

API as in the contract; details in `homepage/lib/activities/README.md`. Additions:
- `onCursor` sends `{a:'off', x:0, y:0}` when the pointer leaves the player (the relay
  only forwards `{a: string, x, y}`); the mirror hides the hand on `a:'off'`.
- `onAnswer` also carries `shown` (answer was given), `mode` (`choice|typed|hint`) and
  `a` (anchor of the item); `ref` = the whole right sentence/word. It fires for every
  decisive attempt; `first` = first attempt on that item.
- Recording only when the sentence/vocab entry itself has `item` + `topic` (material
  `topic` is the library filter, per L3), so vocabulary activities are not recorded yet.
- A student can be mounted with `opts.state` or get `apply(state)` (resume after a
  reload, running timers restart). `cmd` also takes `{type:'lock', on}` for books;
  extra `p.reward({kind:'star'|'gift', g})` plays the celebration on the student and,
  via the state, on the mirror (a tutor star adds one ⭐). `p.ready` = a promise
  (vocab loads by itself when `opts.vocab` is missing; calls before it are queued).
- Book `cmd({type:'goto'})` takes `page` (or `step`). Book state also stores the open word
  card, so a tapped word's card shows on both screens.
- The mirror is a real small layout (container queries), not a scaled copy; on a very
  narrow mirror long content scrolls inside the mirror (the student's scroll position is
  mirrored when the student scrolls).

### L4 live UI (`krabsy-live*.js`, `krabsy-live.css`, `/en/spanish/tutors/live/`)

- Tutor page hash: `#s=<id>` plus `&start=1` (the entry buttons: start at once), `&w=<v1 worksheet id>`
  (show it first) and `&qp=<topic>` (open Quick practice for that topic); `&t=` for old spaces.
  After the start the address bar keeps only `s` (and `t`), so a reload resumes and never restarts.
- No "I turn the pages" lock: the relay only forwards `hint|reveal|next|prev|goto`, so ◀ ▶ turn the
  book pages for both, but the student can still turn them too.
- The student page adds `mat` (material id) to every `answer`, so the tutor groups first-try results
  per material. Queue items (relay `items`) are `{key, k:'m'|'qp'|'v1', title, ico, sub, mid, done,
  stars}` plus `file` (Krabsy material), `material` (quick practice, inline) or `wid` (v1 worksheet).
- End lesson: the note is saved first (`POST /api/tutor/student/lesson`), then `end {summary}` goes to
  the student with `{minutes, materials, first, total}`. Notes while teaching are kept in
  localStorage (`krabsy_live_notes:<id>`) until saved.
- v1 "Show live" entry points are replaced in `krabsy-tutor.js` by turning the buttons of
  `krabsy-tutor-lesson.js` into links to the live page (worksheet "Show live" → `&w=`, plan block
  "Make worksheet & show live" → `&qp=`); the student page uses the live room instead of the v1
  `meLive` polling. v1 endpoints are unchanged; a v1 live panel saved earlier still shows on the profile.
- Outside the L4 file list: `?v=` of `krabsy-tutor.js` bumped to `2026-11-26` in the five pages that
  load it (me, space, tutors, login, report), so returning visitors get the new module.
- The student lesson view is a full-screen layer over `/me/`; its CSS (fonts, `activities.css`,
  `krabsy-live.css`) is added by `krabsy-live-student.js`. `krabsy-live.css` also styles the entry
  buttons and is added by `krabsy-tutor.js` on the space pages.
- Queue reorder is ▲ ▼ buttons (no drag); the prototype's pause button and run-sheet timings are not built.

### Integration (acceptance run, 2026-11-26)

- Acceptance run on port 8129 (8125 was held by another session's tower-defense dev server):
  two Playwright contexts, real relay, player, materials; 98/98 checks. The run compares a state
  signature of the student's player with the mirror after every action (cards, tap, match, sort,
  drag gap, typed letter by letter, reveal, book).
- Tutor gifts during a lesson: the gift is granted at once, but the site's gift card
  (`krabsy-gifts-ui`, its "Have a look →" leads to the figure page) no longer pops up over the lesson.
  `krabsy-live.css` hides `.k-gift` while `html.kl-locked`; the lesson's gifts are kept in
  `sessionStorage` (`krabsy_live_gifts`) and shown when the lesson layer closes (also after a reload).
- `player.js` show-answer line: a whole sentence is shown as it is ("→ El cerdo está en el barro."),
  not "It is El cerdo está en el barro..".
- `from-engine.js`: when the gap starts the sentence, the answer and every choice start with a capital
  (topic items' own distractors are lower case; `check_materials.py` failed at random on this).

### FIX (review, 2026-11-26)

Code and UX review applied (details in the commit). Changes against the protocol / the parts above:
- Relay room life: a room is tied to the student row (id + tutor + class + created); a hello for a
  reused id gets a new room (the old sockets get `error auth`). A room that never had a lesson is
  deleted when the last socket leaves; an ended lesson keeps only its summary (**answers are dropped
  at `end`**, they are in the lesson note). `sweep()` runs at most every 10 min from hellos and pings,
  not only at the room limit. At the limit the longest-idle room nobody is connected to makes way;
  `busy` only when every room has someone connected.
- `tutors.py` (outside L1's files): remove student / delete space close both sockets (`error auth`)
  and delete the room; a new student link closes the student socket. Every socket re-checks its
  token / key every 60 s (logout, removed student).
- Limits: student `state` ≤ 64 KB, `answer` ≤ 2 KB, all answers of a lesson ≤ 160 KB; only the newest
  unsent `state` waits in a connection's outbox, more than 2 MB waiting cuts the connection; ≤ 60 live
  sockets per IP; ≤ 3 running lessons per tutor (starting a 4th ends that tutor's longest-idle one).
  A failed hello closes the socket (no second try); auth runs off the event loop.
- A `state` whose `id` is not the current material's id is dropped (relay and tutor page).
- Mirror: the state is sanitised before rendering (numbers, lists, known effect kinds), the end card
  escapes its numbers; the mirror has no tab stops. Player state has a new field `last` (anchor of
  the last answered item); the mirror is drawn at 600 px height and scaled down when it has less room
  and scrolls to the item the student works on. `p.current()` (gap steps): the item number Hint /
  Show answer act on; a tutor **point on a gap makes it the current item** on the student.
- First-try counts on the tutor page: one per item (an item that comes back, "Play again" or a
  material shown twice count once); a tap item that comes back is never `first`.
- Offline: the student keeps up to 50 unsent answers and sends them after the reconnect; "Save and end"
  while offline sends `end` after the reconnect; hint / show answer / point / rewards offline show a
  "not sent" toast.
- UX: drag ghost above the lesson layer; the site header is not sticky on the live page (the live bar
  is); "+ Add" in the control bar; "… left the lesson" after the student closed the page; gift = one
  message (the player's card); children see "You did N tasks!" instead of "x of y right at first try"
  (player end card and "Lesson done"); second hint names the word ("It is not “son”."), a greyed bank
  word can't be dragged; end summary marks unfinished materials "· … (not finished)"; drawer button
  "Add to list".
- Content: `es-estar` "Hoy no ___ nerviosa." (was "No ___ nerviosa.", where *soy* is also right);
  farm worksheet "La vaca ___ un animal grande." (was "… grande.", where the bank word *está* also fits).

## As built (2026-11-26, not deployed)

**Use it:** the tutor opens the space (`/en/spanish/tutors/space/`), clicks **Start live lesson** on a
student card (or on the student's profile). The student opens their bookmark (`/en/spanish/me/#k=…`;
the tutor's "Copy link" in the live bar while they are not there). The student's page switches to the
lesson by itself. **+ Add** → Krabsy materials / Quick practice (topic, 6 or 10, type / choose / drag) /
saved worksheets → **Show now** (or "Add to list"). Click on the mirror to point; Hint / Show answer act
on the item outlined on both screens (point at another gap to switch); ◀ ▶ steps and book pages;
⭐ 🎁 (no gift for adults). Answers and Notes tabs; **End lesson** → summary → editable note → Save and
end (saved under Lesson notes on the profile). Reload on either side continues at the same place.

**Local test:** `KRABSY_DATA_DIR=<scratch> python3 tools/dev_api_server.py <port>`; API tests
`cd api && python -m pytest -q tests`. Deploy needs both Coolify apps (static site and `api/`, the
relay is in the API) and `wss://api.krabsy.com/api/live/ws` reachable.

**Known limits:**
- Memory only, one API process: an API restart ends running rooms (both pages reconnect; the tutor page
  sends the material again, the student's last state is lost).
- The relay does not check what a material or a state contains (only sizes and the material id); the
  pages escape everything they show.
- Vocabulary activities (cards, tap, match, sort) are not recorded in the star map (no question topic
  for vocabulary yet); gap sentences are.
- The answers column is a plain list (not grouped by material; sort answers show the basket id),
  "Words to practise" lists whole sentences, the after-answer teach note is the topic's grammar note
  (also for children), the hand can cover typed letters in the mirror, places in the materials are in
  Spain / the UK, quick practice does not know the student's gender. (Review LATER items.)
- No real tablet, Zoom window or slow network tested; touch only emulated.

## Later: the video corner (owner decision 2026-11-26)

**Now:** Zoom (or any call) for face and voice; the student **minimizes Zoom**, which
leaves Zoom's small floating video window on top while Krabsy fills the screen.
Lesson setup note for tutors and students: `docs/live-lesson-guide.md`.

**Later (wanted, to try after the first lessons):** a 1:1 **video corner inside the
live lesson**, so the student never juggles two windows and Zoom is not needed at all:

- Browser-native **WebRTC** between the two computers (camera + microphone): the
  tutor's face in a corner of the student's lesson view, the student's face on the
  tutor's live page. One tab.
- **Signalling over the existing live WebSocket** (`api/live.py`: offer / answer / ICE
  candidates relayed like the other messages); media goes peer-to-peer, not through
  our server. Public STUN; a **TURN relay (coturn) on the Hetzner server** for
  networks that block direct connections (school networks, some routers).
- Mute / camera off / hide video on both sides; audio echo cancellation from the
  browser; falls back to "use your call" when the camera is refused.
- **Nothing recorded.** Privacy pages: one line (live video/audio goes directly between
  the two devices, not stored); parents' consent text mentions the camera.
- Size: about 1–2 sessions + the TURN setup. Test with Nora on a slow connection first.

This turns the live classroom into a complete lesson tool (no Zoom), a strong point for
tutors. It is NOT a general video platform: 1:1 (plus siblings on one device), no
group calls, no recording.

## Tutor does it on the student's screen (owner 2026-11-27)

- **Left click** on the mirror = do it on the student's screen (relay `cmd {type:'act', kind:
  'click'|'type'|'enter', a:<anchor>, text?}`; `util.actOn`): pick a word, tap a picture, choose a
  basket, drag = click word → click gap, turn a page, tap a book word. A click on a row with exactly
  one clickable thing (the gap in a sentence) means that thing. Clicking a typing gap opens a small
  box: the letters appear on the student's screen as the tutor types, Enter checks.
- **Right click** = point (as before). On a tablet: switch **◎ Point** on to point with a tap.
- Answers that result from the tutor's action (within 600 ms) are the tutor's: no star, no
  `recordAttempt` (not in the star map), `byTutor` on the answer → "by you" in the answers list.
- **Leaving the live page never ends a lesson** (it always resumed on return): every tutor page now
  shows a red "Live lesson with … is running · Back to the lesson" bar (`krabsy-live-running.js`,
  device-local list) and "Back to live lesson" on the student's card/profile. Anything that ends a
  lesson asks first: End lesson ("End the lesson with …?"), a 4th lesson at once (ends the oldest),
  remove student, new link, delete space.

## Progress is never lost (owner 2026-11-27)

- The relay saves the running lesson (material, the student's state, queue, answers) to SQLite
  (`live_lessons`) at most every 2 s while it changes and at once on load/start/end/disconnect;
  a new room loads it back (same student identity, not older than 3 h). A server restart or
  deploy in the middle of a lesson continues where it was.
- The student page keeps a local backup per material (`krabsy_live_states`, ~1 s) and uses the
  newer of the relay's copy and its own; backups are cleared when the lesson ends.
- Showing the material that is already on screen does nothing ("already on their screen"); an
  earlier material continues where it was. **↺ Start again** in the lesson list (with a
  confirmation) resets it (`load {fresh: true}`).
- Quick practice fills the requested number: the quality rules relax step by step (answer
  share, sentence patterns, drag bank extras for sets of 6+) but never allow give-aways, a
  sentence twice, or the same answer three times in a row. "Focus on the words to practise" is
  now "Start with what <name> still gets wrong".
