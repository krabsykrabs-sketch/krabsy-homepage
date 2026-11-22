# Krabsy Quiz Room — game brief

You are the **game session** for the Krabsy Quiz Room on **Krabsy**
(krabsy.com): a free browser site where German- and Spanish-speaking kids
(about 10–14) practise English irregular verbs and prepositions. Read the
repo-root `CLAUDE.md` once for the site rules.

**What you own:** this folder (`games/quiz-show/`, the client) and the room
server module `api/quiz_room.py` (+ its tests in `api/tests/`). In
`api/main.py` you only add the `include_router` line and, if needed, the
file to the `Dockerfile` `COPY` line. Everything else in `homepage/` and
`api/` belongs to the master session. You don't push or deploy. Stage only
your files, in the same command that commits:
`git add games/quiz-show api/quiz_room.py api/tests/test_quiz_room.py && git commit …`.

Status: **released 2026-11-22 (pushed; owner chose to release before a
play-test). Not played by people yet.** Served copy: `homepage/games/quiz-room/`
(re-copy `index.html teacher.html src vendor assets fonts` after every change);
pages `/de/spiele/quiz-room/`, `/es/juegos/quiz-room/`, short link `/quiz/`. Release steps for the master session:
`RELEASE.md` in this folder. Built: room server + teacher
page + child page, the teacher's question list (see every question,
swap, remove, add, new mix; also in the lobby while children join), and
the play area (avatar choice, emotes, trampolines, tower + slide, ball
pit, balls + hoop, confetti button, dance floor, "everyone to the
middle"), and the bonus round "run to the answer" (answer pads over a
foam pit), touch controls, the class link (answers into each child's own
stats and class), automatic quality steps for slow devices, and the join link as a QR code
on the teacher screen (`vendor/qrcode/qrcode.js`, qrcode-generator 1.4.4,
MIT, owner yes 2026-11-22). A
whole quiz runs with a teacher and several children (tested headless with
3 and 4 children, verbs and prepositions, DE/ES; server tests pass). **Not deployed, not played by people yet.** The server must be
deployed with the API (master session) before anyone can play online.

## How to run it locally

1. Room server (the API): a Python env with `api/requirements.txt`, then in
   `api/`: `KRABSY_DATA_DIR=/tmp/krabsy uvicorn main:app --port 8150`.
   Port **8150** (8000 is the homepage preview, 8140–8144 are game dev
   servers). Tests: `python -m pytest api/tests/test_quiz_room.py`.
2. Game files: `python3 tools/serve.py` here (port 8142; also serves `/lib/`
   and `/data/` from `homepage/`, so the real question engine is used).
3. Teacher: http://localhost:8142/teacher.html · Children:
   http://localhost:8142/index.html?code=XXXXXX (the teacher page shows the
   link). Several children = several browser windows/profiles (the child's
   token is in `sessionStorage`, so each tab is its own child).
4. QA: `node tools/qa-room.cjs <outDir> <children> "lang=de&topic=…"` plays a
   whole quiz with one teacher and N children and saves screenshots.
   `node tools/qa-editor.cjs <outDir>` checks the question list (14 checks).
   `node tools/qa-play.cjs <outDir>` checks the play area (13 checks).
   `node tools/qa-bonus.cjs <outDir>` checks the bonus round (14 checks).
   `node tools/qa-touch.cjs <outDir>` checks touch stick + jump, the answer
   landing in the child's stats, and reconnecting (10 checks).
   `node tools/perf.cjs 29` renders one real child with 29 simulated ones.
   `node tools/load-test.mjs 30 6` is a protocol load test without 3D (30
   children walking at 10 moves/s; 2026-11-22: question delivery median
   ~15 ms, max ~23 ms, nothing missed; 40 children the same).
   `node tools/make-thumbs.cjs` re-renders the avatar portraits
   (`assets/thumbs/`, via `tools/thumbs.html`).
   Headless runs are slow (software GPU, ~7 fps with 3–4 pages; the game's
   dt cap makes time run slower), so the scripts wait for conditions, not
   fixed times. When other sessions run headless tests at the same time
   (load 15 on 12 cores on 2026-11-22), the browser scripts time out
   (screenshots, page loads); run them on a quiet machine. The earlier
   "child gets the question late" flake was partly real: see "Sending"
   below.
5. The client picks the server from the page: `wss://api.krabsy.com` on
   krabsy.com, `ws://<host>:8150` elsewhere, or `?server=<ws url>`.

## How it's built (milestone 1)

| File | Job |
|---|---|
| `api/quiz_room.py` | the room server (WebSocket `/api/quiz/ws`, rooms in memory, referee + scoring) |
| `teacher.html` + `src/teacher.js` | setup (topic, difficulty, count, time), room code + link, player list (rename ✎ / remove ✕), lock, start/next/end, question panel with answer counts at the reveal, top 5, results with ranking + most-missed words |
| `index.html` + `src/child.js` | join (code, first name, colour), walking, private answer card (click or keys 1–4 / A–D), small panel after answering, reveal (right/wrong, points, place, teach beat), top 5, end screen |
| `src/room.js` | the 3D room, avatars (random KayKit character, colour ring, name tag, "answered" dot / thinking bubble), movement (WASD/arrows, Shift run, Space jump), cameras |
| `src/net.js` | socket with auto-reconnect (re-sends join/resume) |
| `src/questions.js` | builds the question pool in the teacher's browser (engine or inline lists), verb pairs kept together |
| `src/play.js` | the play area: trampolines, tower + steps + slide, ball pit, 3 balls (kicks sent to the server), hoop, big red button, dance floor, confetti; ground heights for the controller |
| `src/editor.js` | the teacher's question list: one row per question (a verb pair = one row), ⟳ swap for an unused one (same topic + difficulty, same length), ✕ remove, + add, new mix, "show answers" toggle |
| `src/ui.js`, `src/style.css` | shared rendering (question line, teach beat, review) and styles |
| `src/i18n.js`, `src/audio.js`, `src/analytics.js` | texts, synth sounds, analytics (`quiz-room`: `quiz_open`, `level_start`, `level_end`; children post answer counts) |

Server rules worth knowing: a child gets only the question and the four
options until the reveal; the first answer counts; points 500–1000 by speed
+100 from the 3rd right answer in a row; the reveal comes when every child
who is online has answered, when the time is up, or when the teacher
presses "Show answer"; a child who leaves the room and comes back (same
tab) keeps name and points; a removed child can't rejoin with the same tab.
The room's question list stays on the server; nothing is written to disk.

Question list (milestone 2): the setup page shows the list right away
(10 questions, filled from the pool); changing the count adds or trims at
the end and keeps the teacher's edits; changing topic or difficulty makes
a new list. In the lobby, "Fragen bearbeiten" opens the same list with the
**answers hidden** (the projector may be on; with hidden answers the
3rd-form row also hides the 2nd form, shown as •••); "Speichern" sends it
to the server (`questions` message, lobby only). The teacher's settings
are kept in `sessionStorage` with the room token, so after a reload the
pool can be rebuilt for swaps.

Play area (milestone 3): children pick one of 8 characters (portraits in
`assets/thumbs/`) and a colour. Emotes: keys 1–4 (when no answer card is
open) or the buttons bottom right: wave 👋, dance 💃 (spin), cheer 🎉 (jump),
thumbs up 👍, with a bubble over the head; the server relays them (one per
0.8 s per child). Movement: Shift runs, Space jumps; steps (0.8 / 1.6 m)
lead up the tower (2.4 m), the slide pushes you down, trampolines bounce
higher each time (capped), the ball pit sinks you in and slows you. Balls:
each client simulates them; the kicker sends the new state (`ball`), the
others apply it (exact sync doesn't matter); a basket gives confetti over
the ring. The big red button sends `boom`; the server allows one every 8 s
for the whole room and everyone (teacher too) gets confetti. Teacher:
"Alle in die Mitte" (lobby and reveal) freezes everyone in the middle
until the next question or "Weiterspielen lassen". Balls reset at every
new question. No sitting and no swings (the rig has no sit clip).

Bonus round (milestone 4): setup option "Bonusrunde" Aus / 3 / 5 (default
3); the bonus questions are single questions (a verb's 2nd form; the teach
beat then shows the whole chain), shown in the editor under ★ with swap and
remove. They come after the normal questions (`create`/`questions` take
`bonus:[…]`; the server marks them `bonus`). During a bonus question the
children get no card: a bar shows the question and "run onto the pad", the
big screen in the room shows it too, the four pads (A–D, `PADS` in
`play.js` = `PAD_X/PAD_Z/PAD_HALF` in the server) carry the words, and
everyone can run (and switch pads) until the time is up (+5 s extra).
The server takes each child's last position (`pad_at`): right pad = 500
(+100 from a streak of 3), no pad = no answer. The teacher sees live
counts per pad (`pads` message every 0.5 s). Reveal: the wrong pads sink
into the foam pit (the floor has holes there) for 3.5 s and come back up;
children inside can't walk out meanwhile; the right pad gets confetti.

Sending (server): every connection has its own `Outbox` (one sender task,
in order). A slow device can't hold up the room; when it falls more than 8
messages behind, position updates to it are dropped (they're superseded
anyway), nothing else; 400 behind = disconnected (it reconnects and gets a
fresh snapshot). Before this, a send that waited over 2 s was cut off and
the message lost silently.

Milestone 5:
- **Touch** (`src/touch.js`, from Verb Dungeon): stick on the left 60 % of
  the room (full push = run), jump button bottom right, emote buttons stay;
  on from the first touch or a coarse pointer, off again with a key press.
- **Class link / stats:** the server sends the word (`item/topic/form`) only
  with the reveal (a preposition's use-case id could hint at the answer).
  The child's page then calls `recordAttempt()` (`analytics.record`), once
  per question: the answer goes into that child's own learning stats and,
  if the child joined a class (phase 2), to the class dashboard
  (`krabsy-stats.js` does that). Confirmed by the owner 2026-11-22.
- **Performance:** other children's avatars use blob shadows (only your own
  casts a real shadow); shaders compile behind the join screen
  (`compileAsync`); slow devices step down automatically (`Room.adapt`:
  pixel ratio 1, then no sun shadows) after 4 s under ~24 fps. Headless
  (software GPU) numbers, not representative of a Chromebook: 1 avatar
  ~6 fps, 30 avatars ~2 fps (≈ 240k triangles, ~400 draw calls; the
  characters dominate). **Needs a check on a real cheap Chromebook.**
- **Bug fixed:** the first frame's time step could be negative (the rAF
  timestamp is older than the page's start time); the camera's smoothing
  then swung outward and the view was empty for several seconds after
  joining. dt is now clamped to 0..0.1 and the smoothing factor to 0..1.
- **Reconnect** checked: a dropped connection shows "Verbindung weg", comes
  back as the same child with its points, no duplicate player, no answer
  counted twice.

## Why this game

Teachers are Krabsy's main channel, and in many of their classes every
child has a device (the first organic class came from Uruguay, Plan
Ceibal: a laptop per child). Classroom quizzes in the Kahoot style are
what teachers already know. We copy the **format only**: our own name,
look, sounds and rules, no logos or elements from other products.

What makes ours different: the quiz happens **inside a 3D room where every
child is an avatar**. Once a child has answered, they can walk around,
play with things in the room and goof around until the next question.
Children who are fast and sure get playtime; the room is the reward.

## A lesson with the Quiz Room

1. **Teacher** opens the Quiz Room page and sets up the quiz (below). Krabsy
   creates a room and shows a **room code** (6 characters, same alphabet as
   the class codes, e.g. `QR7-K2M`), a join link and a QR code.
2. **Children** open the link (or krabsy.com → "Quiz-Raum beitreten" /
   "Unirse a la sala"), type the code and their **first name**, pick an
   **avatar**, and land in the room. They can walk around at once.
3. The teacher's screen (on the projector if there is one) shows the room
   from above, the code, and every avatar arriving: "18 in the room".
4. Teacher presses **Start**. Each question appears on **every child's own
   screen** as a private answer card (`go → ___ → ___`, four answers). While
   a child hasn't answered, the card covers their screen and their avatar
   stands still with a thinking bubble.
5. **After answering**, the card shrinks to a corner and the child is free:
   walk, jump, play with the toys, dance. Above every avatar that has
   answered floats **a dot** (same colour for everyone, so it shows
   *that* they answered, never *what*). The teacher sees "21 / 24 answered".
6. **Reveal** (timer ends or everyone answered): each child sees privately
   whether they were right and their points. Publicly (in the room and on
   the teacher screen): the right answer, the teach beat, and the **top 5**.
   Nobody's wrong answer is shown to the others.
7. After the last question: a **winners' podium in the room** with confetti,
   every child sees their own place and score, and the teacher gets the
   **review: the words the class missed most** (all forms shown).

### Bonus round: "Run to the answer" (owner: yes, as a bonus)

An optional round of 3–5 questions (default at the end, before the
podium). The question appears big on a wall of the room, and four coloured
**answer pads** (A–D) light up on the floor. Children run to the pad they
think is right. When the timer ends, the wrong pads sink into a soft foam
pit (bouncy, funny, nobody "dies"), the right pad shoots confetti and
everyone standing on it gets points. Children can copy the crowd here;
that's accepted, it's the loud fun part, not the test.

## The teacher (runs the room, doesn't play)

### Setting up the quiz (before the room opens)

- **Topic:** irregular verbs or prepositions (more topics later, all from
  the question engine's `quiz` shape).
- **Difficulty:** verbs by tier (1 = most common … 3 = rare), prepositions
  by level (1–3); several can be ticked.
- **Number of questions** (10 / 15 / 20 / 30), **time per question**
  (15 / 20 / 30 s), **bonus round** on/off.
- **Question list preview:** the teacher sees every question before the
  quiz starts and can **remove** a question, **swap** it for another one
  from the same topic and difficulty, or **add** more. Verb pairs (2nd form,
  then 3rd form) are shown and swapped as one unit, so the chain order rule
  always holds.
- Later (phase 2 classes): "use my class's word list" and "practise the
  class's most-missed words".

### During the quiz

- Buttons: **Start**, **Next** (skip the rest of the timer), **Pause**,
  **End quiz**. Keyboard: Enter = next, P = pause.
- Player list: rename a player (silly names), **remove** a player, **lock
  the room** (no new joins). A removed player can't rejoin that room.
- **Sound for everyone** on/off (25 laptops making noise in one room).
- **"Everyone to the middle"**: freezes all avatars and pulls them back
  (when the goofing gets too wild), until the next question.

## The children

- **Join:** code + first name (same rule as the classes: first names; a
  name already in the room gets a number, "Mia 2"). No account.
- **Avatar:** pick one of ~8 KayKit characters plus a colour (shirt or
  hat tint). Name tag over the head.
- **Moving:** WASD / arrows + Space to jump; on touch screens a stick and a
  jump button (as in Verb Valley / Verb Dungeon). Camera follows behind.
- **Emotes** (keys 1–4 or a small wheel): wave, dance, cheer, thumbs up.
  **No chat, no free text** anywhere (child safety, nothing to moderate).
- **Answer card:** big text, four buttons A–D (click/tap or keys 1–4 / A–D
  while the card is open). Faster answers give a few more points (fair
  here: everyone answers at the same moment on their own device). Right =
  500–1000 by speed, wrong = 0. A streak of 3+ right gives a small bonus.
- **Reconnect:** a child whose Chromebook sleeps or reloads comes back with
  their name, avatar and points (token in `sessionStorage`).

### The play area (what "doing nonsense" means)

Things to do between questions, all harmless to others:
- **Balls** to kick around (soft physics), a **basketball hoop**.
- **Trampolines** and a **slide**; a **bouncy foam pit** (shared with the
  bonus round).
- **Couches and swings** to sit on (KayKit Furniture Bits).
- A **big red button** that fires confetti over the whole room (cooldown).
- A **dance floor** with coloured tiles that light up under avatars.

Rules: no pushing other avatars, no blocking doors or pads, nothing that
can trap someone. Avatars pass through each other. Toys reset when the next
question starts. Keep the room small enough that the answer card is never
far away and everybody stays in view of the teacher camera.

## Rules from the site

- **No grammar terminology** in the questions: positional notation
  `go → ___ → ___` or a sentence gap (`My birthday is ___ July.`).
- **Chain order** (verbs): the 3rd form only directly after the 2nd, with
  the 2nd filled in (`go → went → ___`). After the 2nd-form answer, don't
  reveal the 3rd form. In the bonus round: single 2nd-form questions; the
  teach beat then shows the whole chain.
- **After every question a short teach beat** (the chain as far as it may
  be shown, or the preposition rule), so the class learns, not only scores.
- Readable on a projector from the back row (teacher screen) and on a small
  Chromebook screen (child): large text, strong contrast.

## Technical direction

### Server (`api/quiz_room.py`, FastAPI WebSocket)

- The analytics API (`api.krabsy.com`, Coolify, base directory `/api`) is a
  **single uvicorn process**, so rooms can live **in memory**: no database,
  nothing stored after the room closes. Rooms close 15 min after the
  teacher leaves or after 2 hours.
- **The server is the referee:** it holds the question list, sends a child
  only the question and the four options (never the answer before the
  reveal), records each child's first answer and time, scores, and
  broadcasts results. Clients can't cheat by reading their messages.
- **Questions come from the teacher's browser:** the setup page builds the
  list with `homepage/lib/krabsy-questions.js` (`getQuizSet`, 4 options,
  default chain order, `ids` for swaps) and uploads it with "open room".
  No need to port the engine to Python.
- **Movement:** each client sends its own position/rotation/animation about
  10× per second; the server relays them (no physics on the server) and
  clients interpolate. Toys: simulated by each client locally, with a
  "kick" event broadcast so everyone sees the same ball roughly; exact sync
  doesn't matter.
- Limits: max 40 children per room, rate limits per socket, name filter (a
  short block list) on top of the teacher's rename/remove.
- **Phase 2 classes (`api/classes.py`):** optional. If the teacher picks
  one of their classes at setup, children who are in that class (student
  token in their browser) have their answers sent to the class dashboard
  like any game answer. Without a class, nothing is stored.
- Check early: WebSockets through Coolify's Traefik on `api.krabsy.com`
  (`wss://`), and whether school networks block them (fallback: long
  polling, only if it really happens).

### Client (`games/quiz-show/`)

- Plain ES modules, Three.js 0.169 vendored, no build step (as now). Dev
  server `python3 tools/serve.py`, port **8142** (serves `/lib/` and
  `/data/` from `homepage/`); the room server runs locally with
  `uvicorn main:app` in `api/`.
- Two entry pages: `teacher.html` (setup, question preview, room overview,
  results) and `index.html` (child: join, avatar, room). Shared modules
  for the room scene, avatars and the socket protocol.
- Performance budget: **30 avatars at 30 fps on a cheap Chromebook**.
  Low-poly room, one shared texture atlas, simple shadows (blob shadows
  under avatars instead of a shadow map if needed), name tags as sprites.
- Interface texts DE/ES/EN (`?lang=` → `krabsy_lang` → DE).
- **Analytics** (`/lib/krabsy-game-events.js`, game id `quiz-room`): the
  teacher page sends `level_start {level: 1, players, questions, topic}`,
  `level_end {level: 1, result: 'won', seconds, answers, correct}` and
  `bonus_end {level: 2, …}`; the child pages send nothing but answer counts
  (`krabsy:attempt` message). Counts only, never names.
- **`recordAttempt()` on the child's device: yes** (owner, 2026-11-22). Unlike the one-projector version, every child has their
  own device here, so their answers belong in their own browser's learning
  stats and smart mix. The teacher page records nothing.

### Assets

KayKit library at `/home/janah/dev/krabsy-homepage/assets/` (gitignored, CC0).
Copy only what you use into `games/quiz-show/assets/`.
- Avatars: `KayKit_Mystery_Monthly_Series_5` (Protagonists, Hiker, Witch,
  Superhero, Helpers, Caveman …) and the Adventurers if present; all on the
  Rig_Medium animations (Idle, Walk, Run, Jump, Interact …). There is **no
  cheer or dance clip**: build emotes from Jump/Interact/Use_Item plus
  procedural moves (spin, bob, arms via bone rotation).
- Room: `KayKit_Furniture_Bits` (couches, lamps, rugs, shelves), toys and
  pads from primitives, balls from the Platformer pack if it fits.

## Milestones

1. **Core loop with 2 browser tabs:** room server (create, join, questions,
   answers, scoring, reveal), teacher setup *without* preview, child join
   with a default avatar, a plain room where avatars walk and see each
   other, answer cards, "answered" dots, top 5, review. Test with
   several headless clients.
2. **Teacher question preview:** remove / swap / add, difficulty filters.
3. **The play area:** toys, trampolines, emotes, avatar choice, sounds,
   "everyone to the middle".
4. **Bonus round** with the answer pads and the foam pit.
5. **Class link** (phase 2 classes), reconnect polish, touch controls,
   performance pass on a real Chromebook, play-test in a class, release
   (master session: wrapper pages, `games.json`, sitemap, teacher pages).

## Open questions for the owner

(Release-blocking: only the play-test, see `RELEASE.md`. Decided
2026-11-22: name "Quiz-Raum" / "Sala de quiz" (EN "Quiz Room"); QR library
yes; answers into stats + class yes.)


- Public reveal: top 5 only (recommended) or the full ranking?
- Max players per room: 40 enough?
- Should the teacher's results (who answered what) be downloadable, or
  only the class-wide review? (Downloadable means personal data on paper;
  without a class, recommended: class-wide only.)

## Version 1 (one projector, built 2026-11-22, superseded)

The first prototype: one laptop + projector, teams on one keyboard, a 3D TV
studio. Rejected by the owner. Its show-only files (`src/main.js`,
`src/show.js`, `src/input.js`, `src/scene.js`, `tools/qa.cjs`) were removed
for milestone 1; they are in git at commit `94ab6f5`. Reused: the
question loading, texts, sounds, character loading and the QA approach.

## Log

- 2026-11-22: first brief (owner: "something like Kahoot / a quiz show"),
  reviewed and fixed, version 1 (one projector, teams) built and tested
  headless.
- 2026-11-22: owner rejected the one-projector concept. New concept: online
  quiz room, every child on their own device with an avatar, walking and
  playing between questions; private answer cards with an "answered" dot
  over the head; the teacher only runs the room and chooses topic,
  difficulty and the questions (see all, skip/swap); the physical
  "run to the answer pads" idea as a bonus round. Brief rewritten.
- 2026-11-22: milestone 1 built: `api/quiz_room.py` (+ 4 tests; whole API
  suite 42 passed), teacher and child pages, shared room scene. Whole
  quizzes pass headless with a teacher + 3 and + 4 children (verbs DE,
  prepositions ES), no console errors. Teacher screen: question panel at
  the bottom so the room stays visible.
- 2026-11-22: milestone 2 built: question list in the teacher setup and in
  the lobby (server: `questions` message in the lobby, + test; API suite 43
  passed). `tools/qa-editor.cjs` 14/14; full quiz still passes.
- 2026-11-22: milestone 3 built: play area, emotes, avatar choice, teacher
  "everyone to the middle" (server: `emote` rate limit, `ball`, `boom`,
  `middle`; + test; API suite 44 passed). `qa-play.cjs` 13/13 (twice),
  `qa-editor.cjs` 14/14, `qa-room.cjs` passes (with the flake noted above).
- 2026-11-22: milestone 4 built: bonus round "run to the answer" (server
  scores by position; floor with pits; editor section; live pad counts).
  Found while testing: a slow child could get messages late or lose them
  (direct sends with a 2 s cut-off) → per-connection send queue (`Outbox`)
  + test, and `tools/load-test.mjs`. API suite 47 passed, qa-bonus 14/14,
  qa-editor 14/14, qa-play 13/13; qa-room passes on a quiet machine.
- 2026-11-22: milestone 5 built: touch controls, class link via
  `recordAttempt` on the child's device (word sent at the reveal), blob
  shadows + shader precompile + automatic quality steps, camera bug fixed
  (negative first dt), reconnect checked, `RELEASE.md` written. QR code not
  built: vendoring a QR library was stopped by the permission check → owner
  decision. Tests: API 47 passed, qa-editor 14/14, qa-play 13/13, qa-bonus
  14/14, qa-touch 10/10, qa-room passes, load test 30 children ~11 ms.
- 2026-11-22: owner said yes to the QR library: `qrcode-generator` 1.4.4
  (MIT) vendored as an ES module; the teacher's code box shows the join
  link as a QR code (SVG). Checked headless: renders, no errors, the
  screenshot decodes (OpenCV) to the exact join link.
- 2026-11-22: owner confirmed: answers go into each child's stats and class
  (as built). Open before release: name, play-test.
- 2026-11-22: owner chose the name: DE "Quiz-Raum", ES "Sala de quiz" (page
  titles already used them; ES casing fixed). Open before release: play-test.
- 2026-11-22: owner: "Release it" (before a play-test). Released by this session
  (acting as master for the release): see `RELEASE.md` "Done". Game changes for
  it: short join link krabsy.com/quiz on the site (teacher screen + QR), join
  URL always carries the room's language, "Lehrkraft? Quiz-Raum öffnen →" link on
  the child's join screen (hidden on phones).
