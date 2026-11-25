# Krabsy for tutors v2: clickable design prototype (work package D)

A static prototype of the tutor app and the student side from `docs/tutor-platform-v2.md` §3.
Fake data, no backend, nothing is saved: a reload resets everything. It is **not served by the
site** and uses nothing outside this folder (except Google Fonts).

## Open it

```
cd docs/prototype/tutor-v2
python3 -m http.server 8090
```

Then open <http://localhost:8090/>. Any current Chrome, Edge, Safari or Firefox.

- **Tutor app:** starts on "Today". The story is Wednesday 25 November, 14:35, Nora in Montevideo.
- **Student side:** "Student view" at the bottom of the sidebar (or **+ New → Student view** on a
  phone). A bar on top switches between a phone frame, a tablet frame and full screen. On a real
  phone the frame goes away.
- The demo student is **Lucas** (8, A1). His lesson today at 15:00 has a ready plan.

## A ten-minute tour

1. **Today** → look at "Needs attention", dismiss a row, click an action.
2. **Students** → type in the search, click the chips, sort by a column, tick three students and
   use the dark bar at the bottom (assign, group, archive). Try **Add students** → "Fill with an example".
3. Click **Lucas** → go through the six tabs. On **Progress** click a topic. On **Overview** press
   "Make a worksheet from these" (it opens the editor).
4. **Library** → switch the three shelves, search "granja", filter by kind. Click
   **Lucas visits the farm**: the drawer has the real student page, play it there. Then "Assign to students".
5. In the drawer press **Duplicate & edit** → the **Editor**. Reorder blocks, add a "Sort into baskets",
   in "Drag to the gap" press **My own sentence**, type a sentence and tap the word that becomes the gap. **Preview**.
6. **Lessons** → open Emma's lesson (no plan): add steps from the suggestions, "Build it for me".
7. **Today** → **Start ▶** on Lucas's lesson → the **Live classroom**. Play Lucas's part in the middle
   frame, watch the right column, press Hint / Show the answer / Point / ⭐. Jump to the **Book** step
   and switch "I turn the pages". Leave the page (a strip keeps the lesson in reach). **End lesson**.
8. **Student view** → play "Lucas visits the farm" to the end, read "La granja" to the end, then look
   at **Books** (stamp) and **Words** (new stickers).

## Screens

| Screen | Route | What to look at |
|---|---|---|
| App shell | all | Sidebar, icon rail below 1100 px, bottom tabs on phones. Global search (`/`), **+ New** menu, live strip |
| Today | `#/today` | Lessons today with plan state, needs attention (one reason, one action, dismiss), since you last looked, homework tiles, quick actions |
| Students | `#/students` | 28 active + 2 archived. Search, filter chips with counts, level and group, sorting, bulk bar, add several at once. Cards on phones |
| Student profile | `#/students/1/overview` | Header with next lesson and Start live. Tabs: Overview, Progress (star map + topic drawer), Materials & homework, Lessons (timeline), Notes, Family (link card, consent, parents' view) |
| Library | `#/library` | Shelves Krabsy 60 / Mine 20 / Assigned. Search without accents, filters, favourites, preview drawer with the playable student page, assign with group shortcuts, duplicate |
| Editor | `#/library/m_60/edit?for=1` | Three columns: add, worksheet, settings. Up/down and drag, undo, "my own sentence" without syntax, fill from weak words, good-worksheet check, preview in a phone frame |
| Lessons week | `#/lessons` | The week as a list by day, plan state per lesson, new lesson (weekly) |
| Planner | `#/lessons/<id>` | Suggestions for the student, plan with minutes and time bar, build it for me, templates. A taught lesson shows the plan as record plus the note |
| Live classroom | `#/live` | Run sheet, what the student sees (playable), student column with answers, star, gifts, notes, end-of-lesson note |
| My Krabsy | `#/me` | Things from the tutor with due dates, lesson banner, progress, finished |
| Bookshelf | `#/me/books` | Books on a shelf, stamp when read, nothing locked |
| Word album | `#/me/album` | Empty slot, seen, sticker, gold edge. Tap a sticker to hear it |
| Lesson mode | `#/me/lesson` | The calm waiting card between steps |
| Activity player | `#/play/m_ws_farm` | Intro, picture cards, tap the picture, match pairs, sort into baskets, drag to the gap, end summary |
| Book reader | `#/read` | *La granja*: 8 pages, a question in the middle, end gallery, three checks, "say it to your tutor", stamp |

## The activities, and what to try

- **Picture cards:** tap the card to turn it, "Again later" brings it back once.
- **Tap the picture:** tap a wrong one (cross, try again), twice wrong shows the answer and the word
  returns once at the end. **Hint** takes one picture away.
- **Match pairs:** tap a picture, then a word. Lines are drawn. Tapping a word reads it aloud.
- **Sort into baskets:** drag a card, or tap the card and then the basket.
- **Drag to the gap:** drag a word, or tap the word then the gap, or the gap then the word. Press
  **Hint** three times: English sentence → one wrong word greyed → first letter.
- Everywhere: right = tick + short explanation, wrong = shake + cross (never colour alone), no
  timer, no lives. The end shows "18 of 21 right at first try", words to practise and new stickers.
- **Book:** arrows, swipe, arrow keys or the dots. Dotted words open a picture card and go into the
  album as "seen". "Show in English" is off at the start.

## Review checklist (owner and Nora)

1. **Today:** in the first five seconds, do you know what to do next? Is anything on it noise?
2. **Needs attention:** are these the right reasons? Which one would you dismiss every time?
3. **Students:** with 28 rows, do you find one child and "everyone with late homework" fast enough?
   Is one column missing, or one too many?
4. **Bulk assign:** tick five students and give them one worksheet. Was that obvious without help?
5. **Profile:** which tab would you open two minutes before a lesson? Is everything you need on "Overview"?
6. **Library:** do the three shelves make sense? Do the cards tell you enough to choose without opening them?
7. **Preview drawer:** is playing the real student page there useful, or would a short list of the content be faster?
8. **Editor:** could you build your own worksheet without anyone explaining it? Where did you stop and think?
   Is "My own sentence → tap the gap word" clear?
9. **Planner:** are the suggestions on the left what you would want? Do you plan in minutes at all?
10. **Live:** you have Zoom open next to it. Is this too much for one screen? What do you really look at
    during a lesson: the run sheet, the child's screen, or the answers?
11. **Stars and gifts in the lesson:** fun, or a distraction from teaching?
12. **Student activities (please let a child try them):** which of the five is the most fun, which is
    confusing? Are the pictures and buttons big enough on a phone? Is the hint button used?
13. **Book:** is one picture plus one or two sentences per page right for A1? Is the question in the
    middle welcome or an interruption? Should the book read itself aloud?
14. **Word album:** does a child understand outline → sticker → gold without being told?
15. **Spanish:** is "el cerdo" right for your students, or "el chancho"? Anything else that sounds wrong
    in Uruguay? (Checked already: "enojado", "torta", "banana"; no "concha" anywhere.)
16. **Look:** does the tutor app feel like a tool you would pay for? Does the student side look like Krabsy?

## Design decisions

1. **One player, three places.** The same activity player and book reader run on the student page,
   in the library preview drawer, in the editor preview and inside the live classroom. Layout switches
   by the width of its container (CSS container queries), not the window. That is what makes "preview
   uses the real player" and "live shows what the student sees" cheap.
2. **Tutor side calm, student side loud.** Tutor: cream, ink, one accent (coral) for the main action,
   dense rows, Limelight only for page titles, a dark sidebar as the frame. Student: big rounded
   "pressable" pieces with a thick lower edge, Fredoka, teal = right, amber = stars, coral = go.
3. **Pictures are stand-ins on purpose.** Word pictures are emoji on white cards. Book scenes are small
   "dioramas": a CSS landscape (sky, hills, pond, barn) with emoji figures placed on it. It shows the
   idea of decision 6 (one object style on cards, a scene per page) without choosing the final set.
4. **Every drag has two tap ways** (piece then target, target then piece), and a picked piece lights up
   all places it can go. Touch targets are 48 px or more.
5. **The editor is a list of cards.** Click a block and it opens in place. The right column holds only
   what applies to the whole block. A "good-worksheet check" shows the §5.3 rubric live.
6. **Tables for people, cards for material.** Students are a 48 px table, the library is a cover grid.
   On phones the student table turns into cards.
7. **Honest prototype notes.** Small amber notes say where content is a stand-in.

## What I changed from the plan, and why

- **Book spread from 680 px of book width, not 900 px of window.** The reader is embedded in frames and
  drawers; at 900 px a tablet in portrait would never get the spread.
- **Body font Nunito instead of Verdana** in the tutor app (denser and calmer at 15 px); Fredoka on the
  student side. Limelight stays for titles. The real build can go back to the site fonts.
- **Hints differ a little by activity.** Tap-the-picture removes a picture (there is no bracket hint to
  show without giving the answer away). Drag-to-gap has the full three steps.
- **The question inside the book is its own page** (the ★ in the dots), not an overlay on a story page.
- **End of the book:** a "¡Leído!" stamp instead of the child's own figure (the portraits live outside
  this folder).
- **Needs attention** lists "no plan" only for today's lessons. With 26 lessons a week, "next 24 hours"
  filled the list with them.
- **Students "worksheet" is called "game page"** on the child's home screen.
- **Added:** the rubric check in the editor, group shortcuts in the assign dialog, a device switch in
  the student view.

## Fake or missing

- All data is in memory. Search, filters, sorting, assigning, archiving, groups, adding students,
  notes, plan editing, the editor and the players really work on that fake state.
- **Only three materials have real content:** the worksheet "Lucas visits the farm", the book
  "La granja" and the animal picture cards. Every other material opens one of these as a stand-in.
- **Live classroom:** there is no second device. You play the student in the middle frame. Leaving the
  live page and coming back restarts the current step.
- Not built: typewriter and the other later activity types, adult variant of the student side,
  siblings in one live lesson (second child is a static card), review shelf, public player pages,
  book editor (page strip), collections, week navigation, real QR codes, German/Spanish interface text,
  recorded audio (the browser's Spanish voice is used, if there is one).
- Copy-link, print, reminder and report buttons only show a message.

## Files

```
index.html
css/app.css        tutor app
css/student.css    My Krabsy, player (.kp), book (.bk), student-view frame
js/data.js         30 students, 80 materials, lessons, vocabulary, the worksheet, the book
js/ui.js           helpers: icons, modal, drawer, toast, pickers
js/main.js         hash router, shell, student-view frame
js/tutor/          today, students, profile, library, editor, lessons (+ planner), live
js/student/        me (home, books, album), player, drag (drag + tap), book
```
