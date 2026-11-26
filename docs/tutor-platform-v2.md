# Krabsy for tutors, version 2: the plan (2026-11-25)

Status: **proposal for the owner to decide on.** After the decisions in §7 it is
the brief that build sessions follow. It builds on `docs/vision.md` and
`docs/tutor-platform.md` (v1, built 2026-11-25). Five research reports fed into
it (market, codebase audit, content-system architecture, tutor UX, activities &
storybooks), and one critic pass checked it against the repo (see the
"Review notes" appendix).

---

## 1. Summary

**What we build.** A real workplace for a tutor with 20–30 students, and real
learning material for the students.

- **For the tutor:** a "Today" screen that says who comes today and who needs
  help. A student list that still works with 30 students, and a fast way to
  add them. One profile per student with tabs. A **library** of material:
  Krabsy's own plus the tutor's. Later an **editor** that starts from Krabsy
  content, never from a blank page, and a **lesson planner** that becomes the
  run sheet in the live lesson.
- **For the student:** worksheets that feel like a game page: picture cards,
  tap the right picture, match pairs, sort cards into baskets, drag words into
  gaps, type the answer. **Storybooks** with page turns, where every new word has
  a picture, and a **word album** that fills up ("Animals 9/12").

**Why.** v1 proved that the parts work, but each part is a thin form that
belongs to one student. Nothing can be reused, so nothing adds up to a library.
No competitor puts "my students' progress" and "good ready-made material" in one
place (italki lists lesson plans as "coming"; Wordwall has skins, not games;
LiveWorksheets is scanned paper with boxes). v2 turns Krabsy's real games,
curated content and no-child-accounts rule into a product a tutor pays for.

**How, in this order:**

1. **Design first.** A clickable prototype with fake data (30 students, about
   80 materials) of the tutor app and the student player. The owner and Nora
   review it before any app code is written.
2. **Slim foundations** at the same time: the Egg Island fix, a question
   engine that never repeats directly, stable ids for every sentence, a
   validator, the content format for vocabulary, books and worksheets, and only
   the database tables the next two phases read.
3. **The first visible release is the fun part:** an "Animals" slice with
   picture cards, tap-the-picture, match, sort, drag-to-gap and one short book,
   played end to end by a student and seen by the tutor.
4. Then the **tutor app shell** (Today, Students, profiles, lessons with
   times), then the **library** and the student's "My Krabsy". That is the
   point where 2–3 other tutors test it and we ask about price.
5. Editor, planner and live classroom come after the test, if it says so.

**The Egg Island bug** (same question 3 times in a row) has two causes. The
game's picker has five bugs (§2.1), and the Spanish topics are far too small:
102 sentences in all, with tier 3 of `es_tener` holding **one** sentence. We fix
it three times over: a game patch now, a no-repeat "deck" in the engine for all
games (no same item back to back, no near-identical sentence, no same answer
three times in a row), and 2–4× more Spanish sentences with a minimum size per
topic.

**Size and pace.** About 52 sessions in nine phases, plus 3 game sessions in the
background. The **must** part (design, foundations, Animals slice, shell,
library) is 35 sessions: at 3 sessions a week, about 12 weeks. Fable is used in
five places, 3.5 sessions in all, all of them visual: the prototype, the picture
style guide, the player, the book reader and the live classroom. Opus does
everything else.

---

## 2. What is wrong with v1, honestly

### 2.1 Questions repeat (Egg Island, and every game in principle)

`games/verb-hatchery/src/questions.js` has five bugs:

- Its memory compares **item ids**, not sentences.
- The smart pick always returns the **first sentence** of an item.
- The "recent" window is `pool.length / 2`, so a 1-sentence tier sets it to 0
  and **erases the memory for every tier**.
- An epic egg (two questions) in a 1-sentence tier asks **the same sentence
  twice**.
- The missed-answer queue is used up by the egg's own second question.

The owner's case (Forest, epic event, `es_tener`) is exactly this: tier 3 has
one sentence, the epic pair asks it twice, and the missed queue asks it a third
time.

Underneath: every game writes its own picker, because the engine has no memory
between calls. The audit found the same pattern in Kitchen, Tower Defense, Quiz
Room, Verb Dungeon and the Platformer. Sentence ids are `item_exN`, so they shift
when a sentence is inserted. Nothing can safely point at "this sentence".

Exact repeats are not the only repeats a child feels. "Yo ___ Lucas." and
"Yo ___ Ana." are the same question to a child, and "tengo" as the answer four
times in a row feels like a repeat too.

### 2.2 The content is too small

| Topic | Sentences | Tier 1/2/3 |
|---|---|---|
| es_ser | 38 | 15/16/7 |
| es_estar | 25 | 7/13/5 |
| es_ser_estar | 21 | 8/10/**3** |
| es_tener | 18 | 7/10/**1** |

A 15-minute Egg Island session asks 45–75 questions. No game can avoid repeats
on 18 sentences. There is **no vocabulary at all** as data (only distractor
strings), no pictures, no audio, so storybooks and picture activities have
nothing to stand on.

### 2.3 The tutor tools are forms, not a product

- **Everything belongs to one student.** Worksheets, homework, lessons and the
  plan all hang off `tutor_students`. A tutor cannot reuse a worksheet, keep a
  library or give one item to five students.
- **The worksheet knows one thing:** gap sentences, typed or drop-down. There is
  no editor, no own sentences, no reorder, no preview as the student sees it.
- **The lesson builder is a fixed percentage template** around the weakest
  topic. It has no library, no history and no reuse.
- **Lessons have no time and homework has no due date.** So there can be no
  Today view, no calendar and no "overdue".
- **The dashboard reloads every answer of every student** on each visit
  (`get_space`). It works for 3 students and becomes slow at 30.
- **Retention can delete a paying tutor's work.** The tutor's students are
  hidden classes, and `classes.purge_inactive` deletes any class idle for 180
  days. `tutor_students` and everything under it cascade from the class. Only
  `_touch` (on tutor activity) keeps them alive, and `tutors.purge_inactive`
  deletes a whole tutor space after 180 days.
- **Adding 20–30 students is slow:** one form per student, one link to copy
  each time, no sign of who never opened their link.
- **The front end is one 724-line script** that rebuilds pages from
  `innerHTML` strings. Its hash regex "routing" has no deep links, search,
  filters or groups. That cannot carry an editor, drag and drop or a live screen.
- **English only.** Strings are hard-coded and paths are fixed to
  `/en/spanish/`.
- **There is no paid switch** although tutors are the first paying audience.

### 2.4 What v1 got right, and v2 keeps

Email sign-in; students as hidden classes with a personal link (no child email
or password, ever); the star map and `measure_stars`; answer mode in
`attempts`; profile sync and the sibling picker; report links; homework as
"topic + answer goal, any game counts"; the 55 API tests; SQLite with WAL
(already on in `classes.connect`). v2 **adds and migrates. It does not
restart.**

---

## 3. Target product

The wireframes below are the **brief for the prototype** (Phase D), not the
final design. The reviewed prototype replaces them as the reference for build
sessions.

### 3.1 Tutor app: shell and navigation

One app page with hash routes. On desktop it has a left sidebar, below 1100 px
an icon rail, and on phones a bottom tab bar. Top bar: global search (`/`) and
a **+ New** menu (student, lesson, homework; worksheet and book once the editor
exists). While a lesson is live, a sticky strip "Live with Lucas · 23:10 ·
Return" shows on every page.

```
┌─────────────┬────────────────────────────────────────────────────┐
│ Krabsy      │ [Search students, material …  /]     [+ New ▾] (N) │
│  for tutors ├────────────────────────────────────────────────────┤
│ ● Today     │                                                    │
│   Students  │            page content (max 1180 px)              │
│   Library   │                                                    │
│   Lessons   │                                                    │
│   Live  ●   │                                                    │
│ ─────────── │                                                    │
│   Settings  │                                                    │
└─────────────┴────────────────────────────────────────────────────┘
```

Routes:

| Route | Shows | Phase |
|---|---|---|
| `#/today` | Today | 2 |
| `#/students?q=&filter=&group=&sort=` | Students | 2 |
| `#/students/:id/{overview,progress,materials,lessons,notes,family}` | Student profile | 2 |
| `#/lessons?week=` | Lesson list (week view) | 2 |
| `#/settings` | Settings (name, timezone, plan) | 2 |
| `#/library?shelf=krabsy\|mine\|assigned&kind=&topic=&level=&q=` | Library | 3 |
| `#/library/:ref` | Material preview | 3 |
| `#/review` | Review shelf (reviewers only) | 4 |
| `#/library/:ref/edit` | Editor | 5 |
| `#/lessons/:id` | Planner | 6 |
| `#/live/:id` | Live classroom | 7 |

The old `#s=12` redirects to `#/students/12`.

Look: the Krabsy tokens, denser for adults. Body text 14–15 px, 40 px table
rows, Limelight for page titles only. No shells, no mascot, and the
`krabsy-ui.css` performance rules apply.

### 3.2 Today (dashboard)

It answers: *what do I have to do today, and who needs me?*

```
 Good morning, Nora                                    Wed 25 Nov
┌─ Today's lessons ──────────────────┐ ┌─ Needs attention (4) ───────┐
│ 15:00 Lucas A1 · 50' · Plan ready  │ │ ! Emma  homework 3 days late│
│       ser/estar · 5 steps [Start ▶]│ │ ! Mateo no practice 12 days │
│ 16:00 Emma  A2 · 50' · No plan     │ │ ↓ Ana   por/para ★3 → ★2    │
│                      [Plan lesson] │ │ ✎ Lucas 22 Nov: no note     │
└────────────────────────────────────┘ └─────────────────────────────┘
┌─ Since you last looked ────────────┐ ┌─ Homework ──────────────────┐
│ Lucas finished "La granja" · 9/10  │ │ Due today 2 · Overdue 1     │
│ Ana   reached ★★★★ in ser          │ │ Done, not reviewed 3        │
└────────────────────────────────────┘ └─────────────────────────────┘
```

**Needs-attention rules**, computed on the server from `progress_agg` and the
lesson rows, in the **tutor's timezone** (§3.7):

- homework overdue;
- no answers for N days (default 10);
- a star dropped;
- under 50 % right on current homework;
- a past lesson without a note;
- a lesson starting within the next 24 h whose plan is empty (in Phase 2, when
  the planner does not exist yet, "plan" means the lesson's short goal field);
- a link never opened (3 days after it was issued).

Each row has one reason and one action, and can be dismissed for 7 days.

### 3.3 Students at scale

A **table by default** (cards on phones). It has instant search, filter chips
(All · Needs attention · Homework overdue · Children · Adults), drop-downs for
level, group and topic, and sorting by next lesson, name, last active, stars or
homework. Tick several rows to **assign material, give homework, add to a group
or archive**: this is how one worksheet reaches five students.

```
 Students (24)                              [+ Add students ▾]
 [Search]  [All][Attention 4][Overdue 1][Children][Adults]  Level▾ Group▾
┌─┬──────────┬────┬────────────┬────────────────┬──────────┬──────────┐
│☐│ Name     │Lvl │ Next lesson│ Homework       │ Active   │ Stars    │
│☐│ ! Emma   │ A2 │ Today 16:00│ ▓▓░░░ 12/40 late│ 3 days   │ 2.4 ▂▃▅ │
│☐│ Lucas    │ A1 │ Today 15:00│ ▓▓▓▓▓ done     │ yesterday│ 3.1 ▃▅▆ │
│☐│ Mateo    │ A1 │ —          │ —              │ never ⚠  │ —        │
└─┴──────────┴────┴────────────┴────────────────┴──────────┴──────────┘
 2 selected: [Assign material] [Give homework] [Add to group] [Archive]
```

- **Level** becomes a fixed list (Pre-A1 … C1) plus an optional free label.
- **Groups** are free tags ("Siblings García", "Tuesday", "Exam").
- **Archive, not delete**, for students who pause. Archived students keep their
  data with the tutor (§4.4 retention) and come back with one click.

**Onboarding 20–30 students** (Phase 2):

- **Add several at once:** paste a list of first names (one per line, optional
  "child/adult" and level after a comma). The preview shows what will be
  created; nothing is created until "Add 12 students".
- **A link card per student:** name, personal link, QR code, and a short
  printable card. "Copy all links" gives a plain list.
- **A message template for parents** (EN/ES/DE, editable): what Krabsy is, the
  child's link, that there is no account, no email and no ads.
- **Link status:** "never opened" (with the date it was issued), then
  "first used …".
- **Issue a new link:** the old link stops working; answers and stars stay.

### 3.4 Student profile

A fixed header (name, level, child/adult, groups, goal, next lesson, [Plan
lesson], [Start live ▶]) with six tabs.

- **Overview** (read two minutes before a lesson): next lesson's plan, homework
  status, working on / weakest / strongest, last lesson's note, 4 weeks of
  activity, and **"Trips over"** (the words with the most wrong first tries).
- **Progress:** the star map by level; each topic has a drawer with the wrong
  words (and, with the editor, **"Make a worksheet from these"**).
- **Materials & homework:** everything assigned, with status, due date, score.
- **Lessons:** a timeline; a past lesson shows the plan as it was taught.
- **Notes:** private. **Family:** report link, note for parents, preview of the
  parents' view, consent tick with date ("Report" for adults), the student's
  link card and "issue a new link".

### 3.5 Library

Three shelves: **Krabsy** (curated, read-only), **Mine** (own and duplicated;
in Phase 3 this holds the migrated v1 worksheets) and **Assigned** (out with
students now).

```
 Library   [Krabsy] [Mine 7] [Assigned]
 [Search]  Kind▾  Topic▾  Level▾   ☆ Favourites
┌────────────┐┌────────────┐┌────────────┐┌────────────┐
│ [cover]    ││ [pictures] ││ ▤ worksheet││ ▶ game     │
│ BOOK · A1  ││ PICTURES   ││ A1 · 12 q  ││ Egg Island │
│ La granja  ││ Animals    ││ ser o estar││ estar · 1  │
│ 8 p · 6'   ││ 32 words   ││ Mine·used 4││ Krabsy ✓   │
└────────────┘└────────────┘└────────────┘└────────────┘
```

- **Kinds:** worksheet, book, picture set, lesson template, game link, practice
  homework.
- **Phase 3 ships:** search (across all UI languages, accent-insensitive),
  filters for kind, topic and level, Favourites, the preview drawer and bulk
  assign. Search and filters run **in the browser** over `library.json` plus the
  tutor's own envelopes. That is fine up to a few thousand items; we revisit
  only past that.
- **Added once there is enough material** (about 60 items, Phase 4–5): age,
  length, **"not yet used with ‹student›"** (from `material_use`), and
  collections.
- **Collection, not folder.** A collection is a named list that *points at*
  materials. One material can be in several collections; removing it from a
  collection does not delete it. There are no folders. Favourites is the
  built-in collection, "Recently used" comes from use records.
- **Clicking a card** opens a preview drawer with the real student player
  (playable), plus *Assign to students · Try as student · Copy public link*
  (and later *Add to a lesson · Duplicate & edit*).
- **Badges:** `Krabsy ✓`, `Mine`, `Draft`.

### 3.6 Editor (Phase 5)

A **block editor** with a small, fixed set of block types. It has one column and
no free layout, so it feels like filling in cards.

```
 ← Library  "Ser o estar: feelings" [A1▾][es_ser_estar▾] Saved ✓ [Preview][Assign]
┌─ Add ────────┐┌─ Worksheet ──────────────────────┐┌─ Block ────────────┐
│ Text         ││ ⠿ 1 Text "Estar: how you feel"   ││ Drag to the gap    │
│ Drag to gap  ││ ⠿ 2 Drag to the gap (5) ◀ chosen ││ Fill: (•) topic    │
│ Typewriter   ││   Hoy ___ cansado. → estoy       ││       ( ) Lucas's  │
│ Tap picture  ││   [+ sentence] [Refill ⟳]        ││           weak words│
│ Sort baskets ││ ⠿ 3 Match pairs (6)              ││       ( ) my own   │
│ Match pairs  ││ ⠿ 4 Tap the picture              ││ Count: 5  Hints: on│
│ Say it       ││ + Add block                      ││ Teach line: shown  │
└──────────────┘└──────────────────────────────────┘└────────────────────┘
```

- **Three ways to fill a question block:** from a Krabsy topic (with a swap
  arrow per question), from this student's weak words, or the tutor's own
  sentences. For their own sentences, the tutor types the sentence, selects the
  answer word and presses "Make gap". There is no syntax to learn.
- **Reorder** with a drag handle *and* up/down buttons.
- **Drafts and versions are two different things:**
  - **Autosave** overwrites the material's working draft, with a visible
    "Saved" state. Undo covers 20 steps within the session.
  - **A version** is created only when the material is assigned or published,
    when the tutor presses "Save version", or when an editing session ends
    (leaving the editor or 30 minutes idle) with changes.
  - **Assignments pin a version** (`m_…@3`). Pinned versions are never pruned;
    of the unpinned ones, the last 20 are kept.
- **Preview** always uses the real student player in a phone/tablet frame.
- **The presentation mandate is built in:** no block type has a field that asks
  a grammar term as the question. The validator also blocks grammar terms in
  instructions.
- **On phones**, the editor is for viewing and small fixes only.
- **Books** use the same editor with a page strip. In v2, tutors duplicate
  Krabsy books to cut or reorder pages. Writing a book from scratch comes later.

### 3.7 Lessons, time and the planner

A **lesson is a dated event** for one student, or for siblings together.

**Time model (Phase 2):**

- Every tutor has a **timezone** (`tutors.tz`, IANA name). It is guessed at
  sign-up from the country (`api/tz.py`; Nora is in Uruguay) and can be changed
  in Settings. All times are **stored in UTC** and shown in the tutor's zone.
- **"Repeat weekly"** creates a **series row** (`lesson_series`: students,
  weekday, local time, zone, minutes, first date, optional last date). Concrete
  `lessons` rows are generated from it 8 weeks ahead, when the week is read;
  generation is idempotent per series and date. Local time plus zone is
  recomputed for every date, so daylight-saving changes keep "Tuesday 15:00".
- **Editing:** "this lesson only" changes that row and marks it detached from
  the series. "This and following" ends the series on that date and starts a new
  one. **Cancelling** sets `status = cancelled` (the row stays, so the history
  shows it); cancelling the series cancels future rows that have no plan or note.
- **Today** is the tutor's local day. "Within 24 h without a plan" means
  `starts_at` between now and now + 24 h, status not cancelled, and an empty plan.

In Phase 2 a lesson has a time, students, minutes, a short goal and a note. The
**planner** (Phase 6) adds the plan itself:

```
 ← Lucas  Lesson · Wed 25 Nov 15:00 · 50' ▾          Draft → [Ready] [Start ▶]
┌─ Suggestions for Lucas ─────┐┌─ Plan ──────────────────── 48 / 50' ─┐
│ Weak: estar + feelings ★★   ││ ⠿ 5'  Warm-up   Sprint · numbers     │
│  ▸ Worksheet "Feelings" 8'  ││ ⠿ 5'  Homework  estar 28/40 · 79 %   │
│  ▸ Book "¿Cómo estás?" 6'   ││ ⠿ 10' Explain   my notes: "estoy…"   │
│ Trips over: está/es         ││ ⠿ 8'  Worksheet "Feelings"           │
│ Due for review: 8 words     ││ ⠿ 12' Game      Egg Island · estar   │
│ Not used with Lucas yet …   ││ ⠿ 2'  Homework  estar · 40 · Thu     │
│ [Search library] [Templates]││ + Add step     time bar ▓▓▓▓▓▓▓▓░    │
└─────────────────────────────┘└──────────────────────────────────────┘
 [Build it for me]  [Copy from last lesson]  [Save as template]
```

- **A lesson template is a library material.** Curated templates exist from
  Phase 3 as readable run sheets (the tutor reads and follows them, and can
  assign their materials); the planner makes them editable and turns them into a
  lesson's plan.
- **Step kinds:** warm-up, homework check, explain (free text plus topic
  examples), material, game, talk (speaking prompt), review (due items), homework,
  break.
- **Build it for me** is today's builder, kept as a first draft. It is never the
  final answer.
- **Status** moves Draft → Ready → Running → Done (or Cancelled). After the
  lesson, the plan becomes the record: ticked steps, results per step, and a
  prompted note ("What went well? What next?"). One click turns the note into
  "next objective" and one click adds a line to the parents' report. Following
  Preply, the next objective appears at the top of the next lesson's plan.
- There is no booking, no invitations and no calendar sync. An `.ics` export can
  come later.

### 3.8 Live classroom (Phase 7)

**Start ▶ turns the plan into the run sheet.** The tutor never rebuilds
anything during the lesson. Krabsy stays the second screen next to
Zoom or Meet.

```
 ● LIVE  Lucas · 23:10 / 50:00 · online ●                  [Pause] [End]
┌─ Run sheet ─────┐┌─ Lucas sees ─────────────────┐┌─ Lucas ────────────┐
│ ✓ Warm-up   5'  ││  Hoy ___ cansado.            ││ 7/10 · 5 right     │
│ ✓ Homework  5'  ││  [ estoy ]  answered ✓       ││ ✗ es → está        │
│ ▶ Worksheet 3:12││                              ││ [⭐ Star] [🎁 Gift]│
│   Book      6'  ││                              ││ Notes: start with  │
│ [◀] [Next ▶]    │└──────────────────────────────┘│ "estoy" [✎ note]   │
│ + from library  │ [Reveal] [Hint] [Skip] [Point] └────────────────────┘
└─────────────────┘
```

- **Mirror** shows the student's current activity rebuilt from **state
  events**, not a screen copy: which block and item is open, what was answered,
  which book page and which word was tapped. Events are throttled (at most two a
  second, never per keystroke).
- **Point** puts a highlight ring on an **anchor**, never on pixel coordinates:
  a block, an item, a word on a book page, or a control (hint, word bank). Each
  device draws the ring on its own layout, so it works across screen sizes.
- Both run on the player's `onState` / `highlight` contract (§4.6), which
  exists from Phase 1, so Phase 7 needs no player rewrite.
- **Transport:** the existing polling, made cheaper with an append-only
  `live_events` table and a `since=` cursor. SSE only if polling is measured too
  slow.
- **Books:** either "I turn the pages" or "Lucas turns the pages".
- **Siblings:** the right column has one row per child.
- **The student side** has no menus. The current activity fills the screen,
  progress dots show how far the lesson has come, stars collected sit in a
  corner, and between steps a calm "Nora is getting the next thing ready" card
  shows. Adults get the same screen without figure and gifts.

### 3.9 Student side: "My Krabsy"

The student page stays at **`/en/spanish/me/`** in v2 (decision 3). A neutral
`/me/` comes only when DE/ES tutors arrive, with a redirect. It gets four areas:

1. **Homework and assigned material** with due dates.
2. **Bookshelf**: books with a stamp when finished. Unread books are open, and
   nothing is ever locked.
3. **Word album**: one page per set. A word shows a grey outline when seen, a
   sticker when answered right once, and a gold edge when typed right.
4. **Lesson mode**: the page switches to it by itself during a live lesson.

Adults get "My words" (a plain list with pictures) and "Reading list", with no
shells and no crab.

### 3.10 Public player pages, and who gets what

Curated books, picture sets and worksheets are **not locked inside the tutor
app.** Teachers are Krabsy's main channel and stay free.

- **Public read-only player pages**, generated by `build_library.py`:
  `/en/spanish/books/<slug>/`, `/en/spanish/words/<slug>/` (picture sets) and
  `/en/spanish/worksheets/<slug>/`. One shared player, no sign-in, answers
  recorded on the device like any game. **noindex during the pilot**; not in the
  sitemap until the master session decides.
- The **teacher link builder** (`lib/krabsy-link-builder.js`) offers these as a
  fourth kind next to games and drills, with `from=teacher`.
- **What tutors pay for** is not the content but the work around it: assigning,
  due dates, tracking per student, the album filling across sessions, the
  library of their own material, the editor, the planner and live use.

| | Teachers / anyone (free) | Tutor Free | Tutor Pro |
|---|---|---|---|
| Games, drills, public books / picture sets / worksheets, link builder, classes | ✓ | ✓ | ✓ |
| Students in the tutor app | — | up to 3 | up to `MAX_STUDENTS` (100) |
| Assign, due dates, star map, reports, My Krabsy | — | ✓ | ✓ |
| Own materials, editor, planner, live classroom | — | try (first 30 days) | ✓ |

- `tutors.plan` (`free | pro | comp`) and `tutors.plan_until` come in Phase 2.
  The limits are checked on the server.
- **No billing in v2.** The first paying tutors are activated by hand
  (`tools/tutor_plan.py`, an admin-token call). Nora is `comp`.
- **Price** is asked at the test gate (§6), not guessed now.

### 3.11 Activity types

Every type is a plug-in for the one player. Every drag has a **tap alternative**
(tap the piece, then tap the target). Touch targets are 48 px or more. Phones
show one screen per step with no scrolling at 360×640.

| # | Activity | Content | Answer mode | First build |
|---|---|---|---|---|
| 1 | **Picture cards** (flip: picture → word, "I know it / again") | vocab | seen | Phase 1 |
| 2 | **Tap the picture** (hear/read the word, tap one of 3–4 pictures) | vocab | choice | Phase 1 |
| 3 | **Match pairs** (tap left, tap right; lines drawn) | vocab, sentence↔answer | choice | Phase 1 |
| 4 | **Sort into baskets** | vocab groups; gap items with 2–3 answer classes | choice | Phase 1 |
| 5 | **Drag to the gap** (shared word bank) | gap items, vocab sentences | choice | Phase 1 |
| 6 | **Typewriter** (with accent bar á é í ó ú ñ ¿ ¡) | gap, trio, vocab | typed | Phase 3 |
| 7 | **Choose** (chips, today's drop-down replaced) | gap | choice | Phase 3 |
| 8 | **Name the picture** | vocab | choice/typed | Phase 4 |
| 9 | **Say it to your tutor** (live only; the tutor rates it) | prompt | tutor-judged (only route to ★5) | Phase 4 |
| 10 | Memory (warm-up only) | vocab | seen | Phase 6 |
| 11 | Find the mistake (difficulty 2+, always ends on the correct sentence) | gap + distractor | choice | Phase 6 |
| 12 | Word order (needs `order_ok` per sentence) | gap items | typed-level | Phase 6 |
| 13 | Mini-dialogue (chat bubbles) | authored dialogue | choice/typed | later |
| 14 | Label the scene / listen and choose | scenes / audio | choice | later |

**Same feedback everywhere** (it lives in the player): right = snap, tick,
teach line, move on after ~1.2 s; wrong = slide back plus a cross (colour is
never the only sign); hint ladder = bracket hint → one option removed → first
letter (any hint sets `mode: hint`); second wrong try = answer and explanation
shown, item returns once at the end of the step. No timers, no lives. End of a
step: "7 of 8 right at first try" plus the words to practise. Only first tries
count: choice up to ★3, typed up to ★4, after a hint ★2. "Seen" (picture cards,
book taps) never counts as right or wrong (§4.4).

Drag to the gap, on a phone:

```
┌────────────────────────────────┐
│ ●●●○○○                    2/6  │
│ 1  Yo [ soy ] Lucas.        ✓  │
│ 2  Hoy ┌─ ─ ─┐ cansada. (tired)│
│ 3  Mi perro ┌─ ─┐ grande.      │
│ ──────── word bank ─────────── │
│   ( estoy )  ( es )  ( está )  │
│ [ Hint ]                       │
└────────────────────────────────┘
```

### 3.12 Storybooks

A short illustrated story of 8–12 pages around one vocabulary set, using grammar
the learner already has (at A1: ser, estar, tener). These are exactly the pilot
topics.

- **Pages:** one picture, one or two short sentences (A1 ≤ ~12 words); 2–3 new
  words per page, 8–12 per book, each new word at least three times.
- **Tap a word** (dotted underline plus a dot): a card with picture, word with
  article, meaning, speaker button; the word goes into the album as "seen".
- **Translation** behind "Show in English/German", off by default, never
  punished.
- **Every 3–4 pages the crab asks one mini-activity** from the player.
- **The end:** a "words you met" gallery (all the animals on one spread), three
  checks, a "Say it to your tutor" card, then the child's **own figure** ("It's
  you!") from the 42 existing portraits (`homepage/assets/figures/portraits/`).
- Reading text ≥ 20 px in the body font, never on top of pictures.

```
┌──────────────────────────────┬──────────────────────────────┐
│   ┌────────────────────┐     │ En la granja hay una         │
│   │ farm scene:        │     │ v̤a̤c̤a̤. La vaca es g̤r̤a̤n̤d̤e̤.     │
│   │ Lía + cow          │     │  ┌──────────────────────┐    │
│   └────────────────────┘     │  │ [cow] la vaca  🔊    │    │
│ (crab) "Tap the new words!"  │  │ the cow · + album    │    │
│                              │  └──────────────────────┘    │
├──────────────────────────────┴──────────────────────────────┤
│ ◀     ● ● ● ◉ ○ ○ ★ ○ ○ ✓          page 4 of 8           ▶  │
└─────────────────────────────────────────────────────────────┘
```

A two-page spread shows from about 900 px, one page per screen below that.
Pages turn by swipe, buttons or arrow keys. With reduced motion, pages change
instantly. How books are made is in §5.4.

---

## 4. Infrastructure

### 4.1 Three content layers

```
CONTENT (what)            ACTIVITIES (how it is played)       ASSEMBLIES (in what order)
banks: gap items ─┐       cards · tap-picture · match · sort   worksheet  = blocks
concepts + words ─┼──refs──▶ drag-gap · typewriter · choose ─▶ book       = pages (+ blocks)
books: pages ─────┘       say-it · …                           lesson     = timed steps
      │                                                        practice   = topic + goal
      └── quiz shape (gap / trio / picture) ──▶ every game
```

**Every content unit has a stable ref**, `topic:item:key`. Stars stay keyed by
`item`, so the star map does not change. The ref is the question-level id that
no-repeat, results, "seen" and worksheets point at.

| Content | Ref | Example |
|---|---|---|
| Gap-topic sentence (format v2) | `topic:item:key` | `es_ser:ser_name:a3` |
| Irregular verb form | `irregular_verbs:<verb>:<form>` | `irregular_verbs:go:past` |
| Preposition example | `prepositions:<item id>:<key>` | `prepositions:prep_in_month:a2` |
| Vocabulary word (picture question) | `<vocab topic>:<concept>:w` | `es_vocab_animals:cat:w` |
| Vocabulary sentence | `<vocab topic>:<concept>:<key>` | `es_vocab_animals:cat:s1` |

`irregular-verbs.json` already has one record per verb and form, so its ref
needs no new keys. `prepositions.json` and the four Spanish banks get explicit
`key`s on every example (WP 0.2).

**Games' inline fallback copies** (used on `file://` and when loading fails) get
no keys. The deck gives them `ref: null`, and nothing with a null ref is sent
to the server. They stay small and are not validated.

### 4.2 Material model

**Envelope** (the same for every kind):

```json
{ "id": "k.es.ws.animals_a1", "kind": "worksheet", "schema": 1, "version": 3,
  "title": {"en": "Animals on the farm", "de": "Tiere auf dem Bauernhof"},
  "summary": {"en": "Name 12 farm animals, then sort them."},
  "learn_lang": "es", "level": {"cefr": "A1", "difficulty": 1},
  "topics": ["es_vocab_animals", "es_ser"], "tags": ["animals", "warm-up"],
  "audience": "kids", "minutes": 10,
  "source": "curated", "status": "published",
  "derived_from": null, "reviewed": {"by": "nora", "at": "2026-12-02"},
  "body": {} }
```

- `kind`: `bank | vocab | worksheet | book | lesson | practice | game_link`
  (`course` comes later).
- `source`: `curated | tutor`. (AI drafts for tutors are not part of v2.)
- `status`: `draft | review | published | archived`.
- Interface-language texts use `{en,de,es}` with today's `pickLang` fallback.
  Learning-language text is a plain string.

**Blocks** (worksheet body and book mini-activities). Content comes in one of
three ways: `refs` (explicit), `pick` (a rule resolved at assign time) or
`inline` (the tutor's own items, in the same item shape as a bank):

```json
{ "type": "sort", "id": "b2", "instructions": {"en": "Farm or wild?"},
  "categories": [{"id": "farm", "label": {"en": "Farm"}}, {"id": "wild", "label": {"en": "Wild"}}],
  "items": {"from": "es_vocab_animals", "refs": ["cat", "cow", "lion", "monkey"], "cat_by": "group"} }
{ "type": "drag_gap", "id": "b3",
  "items": {"from": "es_ser", "pick": {"difficulty": [1, 2], "count": 8, "focus": "student_weak"}} }
```

**Vocabulary: one concept catalogue, one word file per learning language.**
Ids are fixed forever once published, so the shape is fixed now. Pictures
belong to the concept and are shared by Spanish and (later) English sets.

`content/vocab/concepts/animals.json` (language-neutral):

```json
{ "set": "animals", "groups": ["farm", "pets", "wild", "sea"],
  "concepts": [
    { "id": "cat", "group": "pets", "image": "vocab/animals/cat",
      "alt": {"en": "a cat", "de": "eine Katze", "es": "un gato"} } ] }
```

`content/vocab/es/animals.json` (Spanish words for those concepts; the topic id
is `es_vocab_animals`):

```json
{ "format": 3, "id": "es_vocab_animals", "learn_lang": "es", "concepts": "animals",
  "words": [
    { "concept": "cat", "word": "gato", "article": "el", "plural": "gatos",
      "gender": "m", "alts": ["gata"], "difficulty": 1, "audio": null,
      "sentences": [{"key": "s1", "sentence": "El ___ duerme.", "answers": ["gato"],
                     "difficulty": 1}] } ] }
```

The meaning shown to the learner ("cat", "die Katze") comes from the concept's
`alt` in the interface language. An English set later is `content/vocab/en/animals.json`
with the same concept ids.

**Book body:**

```json
{ "vocab": ["es_vocab_animals"], "grammar": ["es_ser", "es_tener"],
  "pages": [
    {"type": "page", "image": "books/granja/p02",
     "text": "En la granja hay una {vaca|cow}. La vaca es {grande}.",
     "translation": {"en": "There is a cow on the farm. The cow is big."}},
    {"type": "activity", "block": {"type": "tap_picture", "items": {"refs": ["cow", "pig", "horse"]}}},
    {"type": "check", "block": {"type": "drag_gap", "items": {"inline": []}}} ] }
```

`{word|concept}` links the word on the page to a concept of the book's sets.
`{word}` alone works when the page form equals the set's word.

**Lesson template body:** `{minutes, steps: [{min, role, ref | pick | text | assign}]}`.
A dated lesson stores a copy of this body as its plan.

### 4.3 Storage split

| Data | Where | Why |
|---|---|---|
| Banks, vocab, curated worksheets/books/lesson templates, taxonomy | git `content/**` → built into `homepage/data/` | reviewable, versioned, cacheable; games read it without the API |
| Picture files + `media.json` (id → path, sizes, licence, alt text per language) | `homepage/media/**` (tracked, WebP/SVG) | one style per set, licence per file |
| Tutor materials, assignments, runs, lessons, groups, aggregates, reviews | SQLite (the existing DB) | private, per tutor, changes often |
| Answers | SQLite `attempts` (existing, extended) | one source for stars |
| "Seen" (book taps, picture cards) | SQLite `seen` (new) | never mixed into answers |

**Snapshots are resolved in the browser, not on the server.** The API container
copies only the files named in `api/Dockerfile` and cannot see `content/`. The
tutor's browser already has the engine and the data. When a tutor assigns, it
resolves `refs`/`pick` into a snapshot and posts it. The server checks the shape
and the size and stores it.

**Curated layout:**

```
content/
  taxonomy.json                     learning lang → strand (grammar|vocab|reading) → topic → skills; tag list
  es-ser.json …                     banks (paths unchanged; moving them can wait)
  vocab/concepts/<set>.json         language-neutral concepts + pictures
  vocab/<lang>/<set>.json           words per learning language
  materials/es/{worksheets,books,lessons}/<slug>.json
  materials/es/books/<slug>/scenes/pNN.json     world-designer scenes (krabsy-level)
tools/add_example_keys.py           one-time: explicit keys (§4.8)
tools/check_content.py              validator (§5.2)
tools/build_library.py              generated files only (below)
tools/render_vocab_cards.cjs        3D model → 256 px WebP word card (from render_accessory_thumbs.cjs)
tools/render_book_scenes.cjs        scene JSON → page WebP (Playwright, §5.4)
tools/pull_reviews.py               review shelf → content/ (§5.2, Phase 4)
```

**`build_library.py` writes only generated files**, never into hand-written
ones:

- `homepage/data/library.json` (envelopes only), `homepage/data/materials/*.json`,
  `homepage/data/vocab/*.json`;
- `homepage/lib/krabsy-topics.gen.js`: registry entries for generated topics.
  `krabsy-data.js` imports it and merges it into `TOPIC_REGISTRY`; the
  hand-written entries stay where they are;
- `api/topics_gen.py`: the `TOPICS` set that `classes.py` and the tutor API
  import (replacing the hard-coded set at `classes.py:49`);
- the public player pages of §3.10;
- a **report**: pool size per topic × difficulty (in sentence families, §4.8),
  and the `topics.json` / `games.json` lines a new topic needs. Those two files
  stay master-owned; the master session applies the lines.

### 4.4 SQLite tables (new, additive)

**Each phase adds only the tables its screens read**, through the existing
`MIGRATIONS` list and `init_db` in `api/tutors.py` (additive, idempotent).
Nothing is created "for later".

| Phase | Tables and columns |
|---|---|
| **0** | `materials` (id `m_` + 10 base32, tutor_id, kind, title, learn_lang, cefr, topics, tags, source, status, derived_from, doc ≤ 200 KB, created, updated) · `assignments` (id, tutor_id, ts_id, mode homework\|live\|practice, material_ref `k…@3` / `m_…@2` / `practice` / `legacy`, title, snapshot ≤ 200 KB, goal, difficulty, glang, note, due, status, reviewed_at, created) · `assignment_runs` (assignment, student, started, finished, score, state JSON for resume) · `attempts` + `ref`, `assignment_id`, `hinted` · `seen` (student_id, ref, first_at, last_at, n; PK student_id+ref) · `progress_agg` (student, topic, item, n, right_first, last_seen, stars_cache; **updated on write**) · `tutor_students` + `level` (enum), `level_label`, `archived`, `link_issued_at`, `first_used_at` · `student_groups`, `student_group_members` |
| **2** | `lessons` (id, tutor_id, series_id, starts_at UTC, minutes, status, goal, plan JSON, note, next_objective, template_ref, detached) · `lesson_students` (lesson_id, ts_id) · `lesson_series` · `tutors` + `tz`, `plan`, `plan_until` · `attention_dismissed` |
| **3** | `collections`, `collection_items` (ref = curated id or `m_`) · `material_use` (tutor, ts_id, ref, last_used, uses) |
| **4** | `content_reviews` (§5.2) · `tutors` + `reviewer` |
| **5** | `material_versions` (§3.6 rules) |
| **7** | `live_events` (append-only, replaces the 20-item JSON array) |

- **`seen` is separate from `attempts`** because `attempts.correct` is
  `INTEGER NOT NULL` (`classes.py:85`); a NULL would need a table rebuild, and
  every star rule would have to learn to skip it. `measure_stars`,
  `homework_progress` and the class dashboard read only `attempts`, so "seen"
  can never count. A test asserts it. (`api/dashboard.py` reads the analytics
  log, not `attempts`.)
- **Due for review** (planner, star-map chips) has **one** algorithm: the rules
  of `homepage/lib/krabsy-smart.js` (mastery per item, known from mastery 3,
  intervals 3 → 1 day, 4 → 3 days, 5 → 7 days). The server computes "due" from
  `progress_agg` with a Python port of those rules, and a shared JSON fixture
  test makes the JS and Python versions give the same answer. There is no
  second schedule and no `srs` table.
- **Retention (WP 0.7, before v2 holds real material):**
  - Tutor-owned classes are **exempt** from `classes.purge_inactive`
    (`WHERE id NOT IN (SELECT class_id FROM tutor_students)`). They follow the
    tutor's retention.
  - A tutor space, with all its students (archived ones included) and
    materials, is deleted **12 months after the last sign-in**, after two
    warning emails (at 11 months and at 11.5 months). Today it is 180 days with
    no warning.
  - **Deleting one student** (by the tutor) deletes: the hidden class → its
    `students` row → `attempts`, `seen`, `progress_agg`, profile; and the
    `tutor_students` row → its assignments, runs, notes, group memberships,
    `lesson_students` rows, and lessons left with no student. The tutor's
    `materials`, collections and series for other students are never touched.
  - Classes of teachers (not tutors) keep the 180-day rule.

### 4.5 How answers travel (the `ref` path)

Today a recorded answer cannot carry a ref, and an unknown topic is dropped
silently. WPs 0.3 and 0.7 change these files:

| File | Change |
|---|---|
| `homepage/lib/krabsy-stats.js` | `recordAttempt(itemId, form, correct, source, topic, mode, extra = {})` with `extra = {ref, assignmentId, hinted}`; old calls keep working |
| `homepage/lib/krabsy-class.js` | the queue forwards `ref`, `assignment_id`, `hinted` |
| `api/classes.py` | the attempt model accepts `ref` (`[a-z0-9_:.-]{1,100}`), `assignment_id`, `hinted`; `TOPICS` comes from `topics_gen.py`; a dropped unknown topic is logged once per topic |
| `api/tutors.py` / `api/materials.py` | runs post results `{ref, item, topic, correct, mode, hinted}`; `mode: seen` goes to `seen`, never to `attempts`; the write updates `progress_agg` in the same transaction |
| `api/Dockerfile` | the `COPY` line names every module: add `materials.py`, `lessons.py`, `topics_gen.py` (and `live.py` in Phase 7) |

### 4.6 API surface (header `X-Tutor-Token` / `X-Student-Token`)

New code goes into `api/materials.py` (materials, assignments, runs, seen,
collections, reviews) and `api/lessons.py` (lessons, series, planner data).
`tutors.py` keeps accounts, students, onboarding and reports.

```
Phase 0/1  POST /api/tutor/assign {ts_ids[], ref, mode, snapshot, goal?, due?}
           GET  /api/tutor/assignments?ts_id= · /api/tutor/assignment?id= (with runs)
           Student: GET /api/me/assignments · /api/me/assignment?id=
                    POST /api/me/run {assignment_id, state, results[]}
Phase 2    GET  /api/tutor/overview                     Today
           GET  /api/tutor/students                     table rows (from progress_agg), groups
           POST /api/tutor/students/bulk {ts_ids, action, …}   assign | group | archive
           POST /api/tutor/students/add_many {lines[]}  · …/student/new_link
           GET  /api/tutor/student/progress?id=
           GET/POST /api/tutor/lessons?week= · …/lesson/save · …/lesson/status · …/series/save
Phase 3    GET  /api/tutor/materials (envelopes) · …/material?id= · POST …/material/archive
           GET/POST /api/tutor/collections · …/collection/add|remove
Phase 4    GET  /api/review/queue · POST /api/review/item   (reviewer flag)
           GET  /api/admin/reviews?since=                   (admin token, for pull_reviews.py)
Phase 5    POST /api/tutor/material/save {doc} → {id} · …/version · …/duplicate {ref}
Phase 6    GET  /api/tutor/planner?lesson=   suggestions, due items, not-used-with
Phase 7    POST /api/tutor/live/{start,step,point,reward,end} · GET /api/me/live?since=
```

The old endpoints stay as thin wrappers until v1 pages are gone, and are removed
one release later.

**One lock:** keep the global `_lock`; it is fine at this scale. WAL is already
on (`classes.connect`). Dashboard reads stay cheap through `progress_agg`.

### 4.7 Front end

**Vanilla ES modules with no build step, plus one vendored renderer.** The
library is `lit-html` (about 7 KB), copied into `homepage/lib/vendor/lit-html/`.
It is not loaded from a CDN, because that keeps the privacy promise and works in
preview. No framework and no bundler.

```
homepage/tutor/index.html            the app page (language-neutral URL; decision 3)
homepage/lib/tutor/
  app.js  router.js  store.js  ui.js  tutor-app.css
  components/  AppShell Tabs DataTable FilterBar SearchBox Card StatTile Stars
               ProgressBar MiniTrend Badge Menu Drawer Modal Toast EmptyState Field
               StudentPicker MaterialCard LinkCard SortableList DeviceFrame Timer Feed
  views/       today students student/* library material settings (later: review editor planner live)
homepage/lib/activities/              SHARED student player (student page, public pages, preview, live)
  player.js  feedback.js  record.js  t.js  types/{cards,tap_picture,match,sort,drag_gap,…}.js
  book.js  album.js  activities.css
```

- `router.js` is about 60 lines: a pattern table, params and query, and
  `beforeLeave` for unsaved edits. `store.js` fetches and caches each resource,
  offers `subscribe()`, makes optimistic updates, and holds the token and error
  handling in one place. Views load with `import()` on demand.
- **Activity type interface** (fixed in Phase 1, so later phases only add):
  `{type, schema, defaults, resolve(block, data), mount(el, block, ctx) → controller, units(block), toQuiz?(block)}`.
  - `ctx` holds `lang`, `mode` (`student|preview|live|print`), `onAnswer` and
    `onState`.
  - `onState(state)` reports `{block, item, page, word, phase, answer?}` and is
    throttled by the player (≤ 2 a second).
  - `controller.highlight(anchor)` draws a ring on `{block, item}`,
    `{page, word}` or `{control}`; `controller.apply(state)` rebuilds a state
    (for the live mirror and for resume).
- **Strings use the site's i18n, not a new system.** Student-facing strings
  (player, feedback, book, album, My Krabsy) live in
  `homepage/data/ui_{de,es,en}.json` under `act.*`, `book.*` and `me.*`, **in
  all three languages from day one**, because the same player serves German and
  Spanish children. Tutor-app strings go under `tutor.*` (English in v2; DE/ES
  later). `lib/activities/t.js` is a small `t(key, lang)` over the same JSON
  files for lit-html views; static markup keeps `data-i18n` and
  `krabsy-i18n-attr.js`. The player takes its language from the assignment or
  the page, not from `localStorage`.
- **Module versioning:** `tools/stamp_game_modules.py` is extended to
  `homepage/lib/tutor` and `lib/activities` (import map plus `?v=`). The cached
  old modules that hit the owner's phone on 2026-11-25 must not happen to tutors.
- **Tests:** `api/tests/` for every endpoint. Node tests for the engine deck and
  for each activity type's `resolve`/`units`. A headless Playwright run per
  phase (sign in → assign → student plays → tutor sees).

### 4.8 No repeats in the engine

`homepage/lib/krabsy-questions.js` gets one dealer that every game uses.

```js
const deck = createDeck({ topic, lang, withOptions, smart: stats, window });
deck.next({ difficulty, avoidItem })   // → quiz record with .ref and .fam
deck.missed(q)                         // re-ask after ≥ 3 others, other sentence of the item if any
deck.record(q, ok, mode)               // feeds smart mix + recent refs
```

**Sentence families.** `build_library.py` (and the deck, for older data) gives
every sentence a family id `fam`: the sentence with the gap, lower-cased,
accents removed, and **names and numbers replaced** by placeholders (names from
a list per learning language plus capitalised words that are not first in the
sentence). "Yo ___ Lucas." and "Yo ___ Ana." are one family.

**Hard rules:**

1. The same **family** never comes within `window` draws. `window` =
   min(10, families − 1), counted across all difficulties, not per tier.
2. The same **item** never comes back to back, unless the topic has only one
   item.
3. The same **accepted answer** comes at most **2 times in a row** ("tengo,
   tengo" yes, a third "tengo" no), whenever another answer is available.
4. Each difficulty is a shuffle bag of families, so every family is shown once
   before any repeat.
5. When the smart mix picks an item, the deck serves that item's least-recently
   seen sentence.
6. A difficulty bucket with fewer than 6 families merges with the next one down.
   `linkLevel` already uses the same threshold of 6.
7. `missed()` re-asks after at least 3 other questions; a second question of the
   same game event (Egg Island's epic pair) draws through `next()` like any
   other and cannot consume the missed queue.
8. The deck honours `chainOrder` / `followUp` for verb pairs (a follow-up is the
   one allowed same-item draw).

**Across sessions:** `krabsy_recent_refs` keeps the last 50 refs per topic on
the device (synced with the profile). A new session starts with the last
session's questions at the back of the deck.

**Tests (WP 0.3), all in node:**

- **Reproduction of the reported case** (also in WP 0.1, against the game's own
  picker): the Forest's epic event, `es_tener` tier 3 holding one sentence,
  asked by the egg pair and then again by the missed queue. It must fail before
  the fix and pass after.
- **Simulation per topic × difficulty:** 75 draws, with Egg Island epic pairs
  every 5th draw and 20 % wrong answers feeding the missed queue. Assert: zero
  back-to-back items (except chain follow-ups), zero family repeats within the
  window, never three equal answers in a row where avoidable.

**Game contract:** `docs/game-contract.md` gains "draw from `createDeck`, never
pick yourself" and the optional `display.kind: 'picture'`. The build report
warns when a game's typical session length is larger than a topic's pool.

**Stable keys:** `tools/add_example_keys.py` runs once, **before any other
content change**. It writes an explicit `key` on every example in the four
Spanish banks and `prepositions.json`, keeping the order so `a1, a2, …` match
today's `item_exN`. It also rewrites the ids in the review drafts waiting for
Nora (`docs/es-revision-nora-estar-ser-estar-tener.md`,
`docs/es-ser-revision-nora.md`) to the new keys, so her answers still match.
After that, keys never change; the validator rejects duplicates or missing keys.

### 4.9 Migration from v1 (Nora's live data must survive)

1. Back up the production DB (`api/export.py` / copy the volume) before the
   first v2 deploy.
2. Each v1 table is migrated in the phase that replaces its screen, never
   earlier. Until then the v1 table stays the one the v1 page uses.
   - Phase 0: retention fix only. New tables start empty.
   - Phase 2: `tutor_lessons` → `lessons` (status done, `starts_at` = that day
     12:00 in the tutor's zone); `tutor_students.plan` → the goal of the next
     undated lesson draft.
   - Phase 3: `tutor_worksheets` → a `materials` row on the Mine shelf plus an
     `assignments` row with `material_ref='legacy'`, the questions wrapped as one
     `typewriter`/`choose` block, `answers` → one `assignment_runs` row;
     `tutor_homework` → `assignments` with `practice`.
   - Phase 7: `tutor_live.worksheet_id` → `assignment_id`.
3. Rehearse each migration on a copy of the production DB in a test before
   deploying.
4. Pages:
   - `/en/spanish/tutors/space/` becomes a stub that redirects to `/tutor/#/…`
     (mapping `#s=` and `#t=`) once Phase 2 ships;
   - `/en/spanish/me/#w=<id>` keeps working by mapping the legacy worksheet id
     to its assignment;
   - sign-in and landing pages stay per language;
   - the report page keeps its URL.
5. Drop the old tables and endpoints one release after the v1 pages stop
   calling them.

---

## 5. Content plan

### 5.1 Size targets per topic (validator-enforced "content floor")

Counts are in **sentence families** (§4.8), so "Yo ___ Lucas / Ana / Sofía"
counts once.

| | Floor (topic may go live) | Target |
|---|---|---|
| Families per topic | 60 | 100+ |
| Per difficulty level in use | 15 | 30 |
| Items | 6 | 8–12 |
| Families per item | 4 | 6–10 |
| Vocab set | 16 words, 4 per group | 24–40 |

With the deck, a repeat after about 20 questions is acceptable, and it even
works as review. The floor makes sure that a 15-minute Egg Island session has no
exact repeat in tier 1. A topic below the floor still plays. It is marked
"small" in the library, and the deck merges its tiers.

**Spanish growth, first:**

| Topic | From | To |
|---|---|---|
| es_ser | 38 | 90 |
| es_estar | 25 | 80 |
| es_ser_estar | 21 | 80 |
| es_tener | 18 | 70 |

That is about 240 new sentences. Tier 3 of `es_tener` and of `es_ser_estar`
needs at least 15 families each. English prepositions need a difficulty spread
(today they have none). The irregular verbs are fine.

### 5.2 Authoring and review pipeline (curated) — the content management system

1. **Plan** the topic and its skills in `taxonomy.json`.
2. **AI draft**: Claude, in a session, writes the bank, vocab or material JSON
   from `FORMAT.md` plus the taxonomy entry, with `status: review`. Every
   example gets a new `key`.
3. **`tools/check_content.py` must pass.** It checks:
   - the schema;
   - exactly one `___`;
   - 3 or more distractors, none equal to an accepted answer;
   - consistent capitalisation;
   - unique keys;
   - **near-duplicates**: families with more than 3 members in one item are an
     error, any family across items is a warning;
   - that refs resolve;
   - that images exist and have a licence;
   - the floors;
   - a **grammar-words blocklist** per UI language for prompts and
     instructions (the presentation mandate);
   - for books: word count per page, that every `{word}` resolves, and that
     each new word appears three times or more;
   - for curated worksheets: the rubric's checkable parts (§5.3).
4. **Review.**
   - *Until Phase 4:* the review sheet (`tools/es_review_sheet.py`, extended to
     every kind). Nora gets a printable or online sheet; corrections are copied
     back with `reviewed: {by, at}` and `status: published`.
   - *From Phase 4:* the **Review shelf** in the tutor app (`#/review`, only for
     tutors with the reviewer flag). `build_library.py` publishes drafts to
     `homepage/data/review/` (never listed in `library.json`, never assignable).
     Nora sees each draft **in the real player**, and per item marks it OK, fixes
     the text in place, or leaves a comment. Results go to `content_reviews`
     (ref, content hash, reviewer, verdict, patch, comment, at).
     `tools/pull_reviews.py` fetches accepted results through an admin-token
     endpoint and writes them into `content/` with `reviewed: {by, at}`; an item
     whose content hash changed since the review is reported, not overwritten.
5. **`build_library.py`** regenerates the generated files (§4.3) and the pool
   report. `version` goes up whenever the content hash changes.
6. **Nothing reaches students unreviewed.** Curated content needs a native
   speaker's review; the build refuses to put a `status: review` item into
   `library.json`.

**Pace.** Nora's time is the bottleneck. Batch the work into one review round
per week: about 80 sentences, or one book plus one vocab set. Ask her for a
second reviewer in Uruguay or Spain, paid per round (decision 12).

### 5.3 What "a really good worksheet" means (rubric)

Every curated worksheet follows this template, and the review checks it:

- **A theme or a story context** ("Lucas visits the farm"), not a topic name.
- **An arc of 3–5 blocks:** picture intro → recognise → choose → type → say it.
  Not every worksheet has all five, but the order holds.
- **8–12 minutes**, and **at least 2 non-text activity types**.
- **A reward at the end:** stars, album stickers, and the crab (the figure for
  children, a plain summary for adults).
- **Grammar terms never in the question** (presentation mandate).
- **Quality gate:** Nora's review plus **one play-test with a child** of the
  target age, with a short note (what was too hard, what was fun) in the
  worksheet's review record.

**Numbers, by phase:**

| By the end of | Worksheets | Books | Picture sets | Lesson templates |
|---|---|---|---|---|
| Phase 1 (slice) | 3 (animals) | 1 (*La granja*, 8 p) | 1 (animals, 32 words) | — |
| Phase 3 (**test gate**) | 12 (3 animals, 3 feelings, 6 on ser/estar/tener) | 2 (+ *¿Cómo estás?*) | 2 (+ feelings) | 4 (readable run sheets) |
| Phase 4 | 16 | 3 (+ *El picnic*) | 3 (+ food) | 6 |

### 5.4 Vocabulary sets, pictures and books

**Words first, then pictures.** For each set, the word list is written first
(concept file, §4.2), then a **coverage table** per word: is there a fitting
existing picture, and in which style?

What exists today: Egg Island ships 60 Quaternius creature models and 120
rendered icons (`games/verb-hatchery/assets/creatures/icons`). Real animals
among them: cow, horse, pig, sheep, donkey, bull, alpaca, dog (husky, pug,
shiba), fox, wolf, deer, zebra, frog, snake, spider, rat, dolphin, whale, shark
and several fish. **Missing are the most basic children's words:** cat,
chicken, duck, rabbit, bird, lion, elephant, bear, giraffe, monkey, tiger
(cat and chicken were removed as head-only). So 3D renders cannot carry the
animals set alone.

**Rules:**

- **One style per set, never mixed on one album page.**
- **Word cards:** one open 3D-style emoji set, very likely **Fluent Emoji 3D**
  (Microsoft; MIT licence to be confirmed and recorded in `media.json`). It
  covers every animal above plus feelings, weather, food and family, which 3D
  packs cannot show. Rendered to 256 px WebP, 5–15 KB, one background and frame
  from the style guide.
- **Book scenes:** small 3D dioramas from the packs we own (KayKit, Tiny Treats,
  Quaternius), so books look like the games. A book only uses animals that exist
  as models in its scenes; the word card when a word is tapped uses the set's
  card style.
- WP 0.8 decides it with a **sample sheet**: the 32-word animals list, its
  coverage table, and 12 cards in the chosen style next to 12 existing icons.

**Book production pipeline** (first used in Phase 1):

1. **Text:** Claude drafts the story from the vocab set, the grammar list and
   the book rules (§3.12), with the page split and the `{word|concept}` links.
   The validator checks it. Nora reviews it (sheet, later the Review shelf).
2. **Scenes:** each page is a scene built in `tools/world-designer/`, which
   already places models and exports `krabsy-level` JSON
   (`tools/world-designer/LEVEL-FORMAT.md`). A fixed "book camera" preset (angle,
   light, background colour) lives in the style guide. Scenes are saved to
   `content/materials/es/books/<slug>/scenes/pNN.json`.
3. **Characters in scenes:** every book has the same fixed hero, **Lía**, a
   KayKit figure from the figure set, placed in the scene like any model (plus
   the crab where the story needs it). The reader's **own** figure appears only
   on the last page, from the existing portraits, so no scene depends on the
   child's figure.
4. **Render:** `tools/render_book_scenes.cjs` (Playwright, the way
   `tools/render_accessory_thumbs.cjs` works) loads each scene headless and
   writes `homepage/media/books/<slug>/pNN.webp` (1200×900, ≤ 60 KB). Pages load
   lazily (the current page plus the next two).
5. **Cost per 8–10-page book:** text 0.25 session, scenes 0.75 (0.5 when it
   reuses a set), render and wiring 0.25, plus about an hour of Nora. The first
   book costs 1.5 sessions including the render tool; later ones about 1.25.

**Sets and books:**

| # | Vocab set | Words | Grammar | Book | Phase |
|---|---|---|---|---|---|
| 1 | `es_vocab_animals` (farm, pets, wild, sea) | 32 | ser, tener | ***La granja*** (8 pages) | 1 |
| 2 | `es_vocab_feelings` | 16 | estar | *¿Cómo estás?* | 3 |
| 3 | `es_vocab_food` | 30 | estar (rico), tener (hambre) | *El picnic* (Tiny Treats picnic pack) | 4 |
| 4 | `es_vocab_family` | 20 | ser, tener | *Mi familia* | after v2 |
| 5 | `es_vocab_home` | 24 | estar (en) | *Mi casa* (Tiny Treats house) | after v2 |

**Target: 3 books by the end of Phase 4.** Every vocab set also becomes a
picture topic for games through `display.kind: 'picture'` (Phase 4), with a text
fallback "cat → ___". English sets for DE/ES learners follow later on the same
concept files.

---

## 6. Roadmap

Each phase leaves something Nora can use the next day, and we can stop after any
phase. A session means one focused Claude session, roughly half a day of owner
attention.

| Phase | Tier | Delivers | Sessions | Fable |
|---|---|---|---|---|
| **D Design prototype** | must | clickable static prototype, fake data (30 students, ~80 materials): shell, Today, Students, profile, Library, Editor, student player, Book reader; reviewed by owner + Nora | 1.5 | 1.5 |
| **0 Foundations** | must | Egg Island fix; stable keys; engine deck + tests; validator; format v3 + build tool; slim DB + ref path + retention; picture coverage + style guide; Spanish growth starts | 10 (+3 game sessions, background) | 0.5 (style guide) |
| **1 Animals slice** | must | player with picture cards, tap-picture, match, sort, drag-gap; book reader; animals set with pictures; *La granja*; 3 worksheets; assign from the v1 space; student plays in My Krabsy; tutor sees results; public player pages | 8.5 | 1 (player 0.5, reader 0.5) |
| **2 Tutor app shell** | must | `/tutor/`, Students table, groups, archive, onboarding (paste names, link cards, parent message, link status); profile tabs; Today; lessons with timezone and weekly series; due dates; Free/Pro switch | 7 | — (built from the prototype) |
| **3 Library + My Krabsy** | must | Library (search, kind/topic/level, favourites, preview, bulk assign); typewriter, choose; v1 worksheets migrated; My Krabsy with bookshelf and album; feelings set + *¿Cómo estás?*; content to the test-gate numbers | 8 | — |
| **Test gate** | | 2–3 tutors besides Nora use it for two weeks; ask what they would pay | — | — |
| **4 Content machine** | should | Review shelf + `pull_reviews.py`; name the picture, say it; food set + *El picnic*; picture questions in games; library filters for age/length/"not used with", collections | 5.5 | — |
| **5 Editor** | optional | block editor (topic / weak words / own sentences), drafts and versions, duplicate-and-edit of curated items | 4 | — |
| **6 Planner** | optional | planner on lessons + library, suggestions, editable templates, post-lesson record, next objective, review step ("due" from krabsy-smart rules); memory, find-the-mistake, word order | 4 | — |
| **7 Live classroom** | optional | run sheet from plan, mirror and point on anchors, cheaper polling, siblings | 3.5 | 0.5 |

**Totals:** 52 sessions plus 3 background game sessions; Fable 3.5 sessions in
five places (prototype 1.5, style guide 0.5, player 0.5, reader 0.5, live 0.5).
**Must** (D–3) is 35 sessions, **should** 5.5, **optional** 11.5.

**Pace and priorities.** The owner already runs too much at once, so v2 gets a
fixed share, and other work pauses:

- **Pace: 3 v2 sessions a week.** Must is done in about 12 weeks (late February
  2027), everything in about 18 weeks (early April 2027). At 2 a week: about 18
  and 27 weeks.
- **Keeps running beside v2:** the 4teachers route (owner-driven, capped at one
  session a week), bug fixes, and Nora's live use of v1.
- **Pauses until the test gate:** new games and game releases (Tower Defense,
  Krabsy Block, Platformer fixes), part 2 of the figures/world plan (part 1 gets
  its pending deploy first), and new SEO page batches.
- **If only half the sessions happen,** D, 0, 1, 2 and 3 still happen, in that
  order. The editor, planner and live classroom wait for the test gate's verdict.

### 6.1 Work packages and file ownership

Agents working in parallel stage **only their own paths** (`git add <paths> &&
git commit`, per CLAUDE.md). The master session merges, releases and owns
`games.json`, `topics.json`, the sitemap and `STATUS.md`.

**Phase D and Phase 0, as a dependency graph:**

```
D   Design prototype ─────────────────────────────────────────▶ (review) ─▶ Phase 1, 2
0.1 Egg Island hot fix + repro test ────────────────────────── (alone, day 1)
0.2 Stable keys ──┬──▶ 0.3 Engine deck + ref + tests ──▶ 0.9 Games adopt deck (background)
                  ├──▶ 0.5 Format v3 + build tool ──┬──▶ 0.7 Slim DB + ref path + retention
                  │                                 └──▶ (Phase 1 content)
0.4 Validator ────┴──▶ 0.6 Spanish growth (needs keys from 0.2 and the validator)
0.8 Word list + coverage + style guide (parallel; uses 0.5's concept shape when it lands)
```

0.1, 0.2, 0.4, 0.8 and D start on day one. 0.4's key checks switch on after
0.2. 0.7 needs 0.2 (ref format) and 0.5 (`topics_gen.py`).

| WP | Task | Owns | Model | Size |
|---|---|---|---|---|
| D | Clickable static prototype with fake data; review with owner and Nora; notes become the design reference | `docs/prototype/tutor-v2/` (not served) | **Fable** | 1.5 |
| 0.1 | Egg Island hot fix: key `recent`/`avoid` by `q.id`, fixed window 8, least-recent sentence per item, tier 3 < 4 sentences → tier 2, `avoid` checked everywhere, missed queue not consumed by the pair's second step; reproduction test of the Forest case; stamp modules | `games/verb-hatchery/src/questions.js`, `games/verb-hatchery/tests/`, `homepage/games/verb-hatchery/` | Opus | 0.5 |
| 0.2 | `tools/add_example_keys.py`: keys on Spanish banks + prepositions, re-key Nora's pending review drafts, sync `homepage/data/` | `tools/add_example_keys.py`, `content/*.json` (keys only), `homepage/data/*.json` sync, the two `docs/es-*revision-nora*.md` | Opus | 0.5 |
| 0.3 | `ref` + `fam` on quiz records, `createDeck` with the 8 rules, `krabsy_recent_refs`, simulation tests, `recordAttempt` `extra`, class queue forwards ref, game-contract rule | `homepage/lib/krabsy-questions.js`, `krabsy-data.js`, `krabsy-stats.js`, `krabsy-class.js`, `homepage/lib/tests/`, `docs/game-contract.md` | Opus | 1.5 |
| 0.4 | Validator incl. floors (families), near-duplicates, blocklist, rubric checks; book checks against 0.5's spec | `tools/check_content.py`, `tools/tests/` | Opus | 1 |
| 0.5 | Format v3 spec (concepts, words, materials, blocks, book, lesson), `taxonomy.json`, `build_library.py` with generated files only and the report | `content/FORMAT.md`, `content/taxonomy.json`, `tools/build_library.py`, `homepage/data/library.json`, `homepage/lib/krabsy-topics.gen.js`, `api/topics_gen.py` | Opus | 1.5 |
| 0.6 | Spanish growth to the floor: AI drafts, validator, review sheet to Nora | `content/es-*.json`, `tools/es_review_sheet.py` | Opus | 2 + review |
| 0.7 | Phase 0 tables (§4.4), `seen`, `progress_agg` on write, ref path in `classes.py`, `TOPICS` from `topics_gen.py`, retention fix + warning mails, Dockerfile, rehearsal on a prod copy, tests | `api/materials.py`, `api/tutors.py` (migrations, purge), `api/classes.py` (attempt model, purge), `api/mailer.py` (warning mail), `api/Dockerfile`, `api/tests/` | Opus | 2 |
| 0.8 | Animals word list (concept file), coverage table, Fluent Emoji licence check, sample sheet, `render_vocab_cards.cjs`, `media.json` shape; then the style guide incl. book camera | `content/vocab/concepts/animals.json`, `tools/render_vocab_cards.cjs`, `homepage/media/`, `docs/picture-style.md` | Opus + **Fable** (guide 0.5) | 1 |
| 0.9 | Games adopt `createDeck`: Egg Island (replaces its hot fix), Kitchen, Tower Defense, Quiz Room, Platformer, Verb Dungeon | each game's own folder (one game session each) | Opus | 0.5 each, any time after 0.3 |

**Phase 1 (Animals slice):**

| WP | Task | Owns | Model | Size |
|---|---|---|---|---|
| 1.1 | Player core (feedback, hint ladder, record, `onState`/`highlight`/`apply`, `t()`), types cards, tap_picture, match, sort, drag_gap | `homepage/lib/activities/{player,feedback,record,t}.js`, `types/`, `activities.css`, `ui_*.json` `act.*` keys | **Fable** visuals 0.5 + Opus 2 | 2.5 |
| 1.2 | Book reader, page turns, word cards, end gallery | `homepage/lib/activities/book.js`, `ui_*.json` `book.*` | **Fable** 0.5 + Opus 0.5 | 1 |
| 1.3 | Animals words (`content/vocab/es/animals.json`), 32 cards rendered, review | `content/vocab/`, `homepage/media/vocab/` | Opus | 1 + review |
| 1.4 | *La granja*: text, scenes, `render_book_scenes.cjs`, review | `content/materials/es/books/granja*`, `tools/render_book_scenes.cjs`, `homepage/media/books/granja/` | Opus | 1.5 |
| 1.5 | Assign/run endpoints, small "Material" panel in the v1 space, My Krabsy runner | `api/materials.py`, `homepage/lib/krabsy-tutor.js` (panel only), `homepage/lib/krabsy-me.js`, `homepage/en/spanish/me/` | Opus | 1.5 |
| 1.6 | 3 animal worksheets to the rubric, child play-test, public player pages, link builder entry | `content/materials/es/worksheets/`, `homepage/en/spanish/{books,words,worksheets}/`, `homepage/lib/krabsy-link-builder.js` | Opus | 1 |

**Phase 2 (shell):** 2.1 shell + component kit from the prototype, vendored
lit-html, router/store/ui (`homepage/tutor/`, `homepage/lib/tutor/{app,router,store,ui}.js`,
`components/`, `tutor-app.css`, `homepage/lib/vendor/lit-html/`; 2). 2.2 views
Students, profile tabs (moving v1 features), onboarding, Settings; redirects
from v1 pages (`views/{students,student,settings}*`,
`homepage/en/spanish/tutors/space/`; 2). 2.3 overview, students, progress,
attention, onboarding, lessons, series, plan endpoints; v1 lessons migrated
(`api/lessons.py`, `api/tutors.py`; 2). 2.4 views Today and lesson week
(`views/{today,lessons}.js`; 1).

**Phase 3 (library):** 3.1 Library, preview drawer, bulk assign
(`views/{library,material}.js`; 1.5). 3.2 typewriter and choose types
(`types/`; 1). 3.3 v1 worksheets/homework migrated, material endpoints
(`api/materials.py`, `api/tutors.py`; 1). 3.4 My Krabsy bookshelf and album
(`album.js`, `krabsy-me.js`, `ui_*.json` `me.*`; 1). 3.5 feelings set and
*¿Cómo estás?* (2 + review). 3.6 nine more worksheets and 4 lesson templates to
the rubric (`content/materials/es/`; 1.5).

**Phases 4–7** are sequenced inside each phase. Each owns its views (`review`,
`editor`, `planner`, `live`) plus its endpoints in `api/materials.py`,
`api/lessons.py` or `api/live.py`.

**Collision rules:**

- Exactly one session at a time edits each of `krabsy-questions.js`,
  `krabsy-data.js`, `api/tutors.py`, `api/classes.py`, `content/FORMAT.md` and
  the `ui_*.json` files, and the work package that holds it is named in
  `STATUS.md`.
- Generated files are only written by `build_library.py`; nobody edits them by
  hand.
- Shared CSS tokens stay in `krabsy-ui.css` (master only). New styles go in
  `tutor-app.css` / `activities.css`.

---

## 7. Open decisions for the owner

1. **Adopt this plan and its order:** design prototype → slim foundations →
   Animals slice as the first visible release → shell → library → test gate.
   *Recommendation: yes.*
2. **Pace and what pauses:** 3 v2 sessions a week; 4teachers continues at most
   one session a week; new games, game releases, figures part 2 and new SEO
   batches pause until the test gate.
   *Recommendation: yes.*
3. **URLs:** the tutor app moves to the language-neutral `/tutor/` in Phase 2;
   the student page stays `/en/spanish/me/` in v2.
   *Recommendation: yes.*
4. **Free and paid:** teachers and everyone keep games, drills, public books,
   picture sets, worksheets and the link builder for free. Tutors: Free up to 3
   students, Pro beyond that and for own materials, editor, planner and live.
   Manual activation, no billing in v2, Nora on `comp`, price asked at the test
   gate.
   *Recommendation: yes.*
5. **Public player pages** for curated books, picture sets and worksheets
   (`/en/spanish/books/<slug>/` …), noindex during the pilot, offered in the
   teacher link builder.
   *Recommendation: yes.*
6. **Pictures:** word cards from one 3D-style emoji set (Fluent Emoji, after the
   licence check), book scenes as 3D dioramas from our packs, one style per set.
   Confirmed by the WP 0.8 sample sheet.
   *Recommendation: yes.*
7. **No tutor picture uploads, no AI images, no recorded audio in v2.** Speech
   comes from the browser.
   *Recommendation: yes. Revisit when tutors ask.*
8. **Front end: vanilla ES modules plus vendored lit-html**, strings in the
   site's `ui_*.json`, student-facing strings in DE/ES/EN from day one.
   *Recommendation: yes.*
9. **Lessons: a week list with timezone and weekly series**, no full calendar
   and no sync.
   *Recommendation: yes. `.ics` export later if asked.*
10. **One review schedule:** "due" uses krabsy-smart's rules on the server; no
    second algorithm.
    *Recommendation: yes.*
11. **Retention:** tutor classes leave the 180-day class purge; a tutor's
    students (archived ones too) and materials are kept until 12 months after
    the last sign-in, with two warning emails.
    *Recommendation: yes. Update the privacy page before Phase 2 ships.*
12. **Review capacity:** pay a second native-speaker reviewer per weekly round,
    and move review into the Review shelf in Phase 4.
    *Recommendation: yes.*
13. **Content floor and worksheet rubric:** 60 families / 15 per difficulty per
    topic; every curated worksheet follows the rubric, with a child play-test.
    *Recommendation: yes.*
14. **Group lessons:** 1:1 plus siblings in v2. The data model
    (`lesson_students`) allows more.
    *Recommendation: yes, no groups of 3–5 until a tutor asks.*
15. **First set and book:** animals / *La granja*, then feelings and food.
    *Recommendation: yes.*
16. **The tutor test gate** after Phase 3 with 2–3 tutors besides Nora, deciding
    whether the editor, planner and live classroom are built.
    *Recommendation: yes. Keep the 4teachers contacts in mind.*

---

## 8. Risks, and what we deliberately do not build

### Risks

| Risk | Answer |
|---|---|
| **Content, not code, is the bottleneck.** | 0.6 starts at once; floors in families; rubric; paid second reviewer; Review shelf in Phase 4. |
| **Scope for one developer** (52 sessions). | Must / should / optional tiers; every phase works alone; test gate after Phase 3; other work paused. |
| **Building the wrong UI.** | Clickable prototype reviewed by owner and Nora before any app code. |
| **Migration breaks Nora's live data.** | Backup, rehearsal on a prod copy, each migration in the phase that needs it, old endpoints as wrappers for one release. |
| **Retention deletes paid work.** | Tutor classes exempt from the class purge in Phase 0; 12-month rule with warnings. |
| **Art drifts.** | One style per set, style guide, coverage table first, reused dioramas, no AI images. |
| **Fable cost.** | Five named sessions, 3.5 in all. |
| **Cached old modules.** | Stamped module URLs for `lib/tutor` and `lib/activities`. |
| **Children's data.** | First names only, no uploads, read-only parent links, privacy page/AVV updated before public tutor sign-up. |
| **SQLite with one lock.** | WAL (on), `progress_agg`, polling with a cursor. Postgres only if ever needed. |
| **Site weight** (102 MB). | 25 MB art budget, WebP, lazy loading. |

### Not built (on purpose)

- A public community library or tutor-to-tutor sharing (no columns for it yet;
  they are added when it is built).
- AI drafts for tutors (no hooks yet).
- Billing, invoices, booking, calendar sync, video, messaging between tutor and
  parent, a marketplace.
- A free-layout design editor. Books written from scratch by tutors (v2 only
  allows duplicating and cutting).
- Timers, lives, losing streaks, rankings between students, random prizes, and
  anything a child can lose or buy.
- Child accounts, emails or passwords. Parent accounts.
- A JS framework or a build step. Offline-first sync beyond the existing answer
  queue. SSE until polling is measured too slow.
- Roles, co-tutors, organisations.
- Server-side content resolution (the API container has no content).
- PDF printing for tutors (the teacher PDFs are their own item, and a print view
  comes "later").

---

## Review notes

Critic pass of 2026-11-25, 25 points. Accepted unless noted.

- **1 (vertical slice first):** accepted, with one change: the slice is
  assigned from a small panel in the v1 tutor space, because the new shell comes
  one phase later; the panel is dropped when the shell ships.
- **2 (prototype):** accepted; the shell needs no separate Fable session now.
- **3 (slim Phase 0, dependency graph):** accepted. Groups and level stay in
  Phase 0 because the shell reads them right after the slice.
- **4 (one review schedule):** accepted. Chose the server-side port of
  krabsy-smart's rules over reading the synced profile, because the server sees
  every answer while the profile exists only where sync is on.
- **5, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 23, 24:** accepted
  as written (§4.5, §4.4, §5.4, §3.10, §4.8, §3.6, §4.3, §3.3, §3.8, §4.7).
- **10 (rubric, numbers):** accepted; the 4 lesson templates at the test gate
  are readable run sheets, because the planner is optional and comes later.
- **21 (Review shelf):** accepted, but in Phase 4 ("should"), not in the must
  tier: the review sheet works until then, and the must tier is already 35
  sessions.
- **22 (lighter library):** accepted; "not used with" is kept for Phase 4,
  because it becomes the key filter once the library is large.
- **25 (priorities):** accepted; the plan recommends 3 sessions a week instead
  of the suggested 2, because the must tier at 2 a week would take about 4
  months before any other tutor sees it. Both paces are shown.

## Prototype findings (work package D, 2026-11-25)

The clickable prototype is in `docs/prototype/tutor-v2/` (open: `python3 -m http.server
8090` in that folder; tour and review checklist in its README). Building it showed
eight places where this plan should change; to decide in the review with the owner
and Nora:

1. **Two star systems collide**: ⭐ per first-try answer in a worksheet vs ★1–5 per
   topic in the star map. One needs another name or shape.
2. **"No scrolling at 360×640" does not hold for drag-to-gap**: cap at 4 sentences
   on phones or page them.
3. **Live in three columns needs ~1280 px**, but the tutor has Zoom beside it: a
   compact mode for ~700 px (run sheet + answers, mirror optional).
4. **"Lesson within 24 h without a plan" floods Needs attention**: only today's
   lessons, or one grouped row, or leave it to the lessons card.
5. **Book spread from 900 px window is too late** (portrait tablets never get it):
   use 680 px of book width.
6. **The editor's third column has little to do**: two columns, settings inside
   the open block.
7. **"Assigned" is not a library shelf**: it is material × students and belongs
   under homework/students.
8. **"I know it / again" on picture cards** makes young children rate themselves:
   watch in the child play-test.

## Update 2026-11-26: live classroom first, video corner later

Owner decision: the **live classroom** was moved ahead of the rest of this plan and is
built (`docs/live-classroom.md`, tested with Nora from 2026-11-27). Lessons use Zoom for
face and voice with Zoom minimized for now. **Wanted later:** a 1:1 WebRTC **video
corner inside the live lesson** (no Zoom needed), spec in `docs/live-classroom.md`
"Later: the video corner". It goes in after the first lessons with Nora, before
Phase 7's remaining live work.
