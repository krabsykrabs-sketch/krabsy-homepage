# Krabsy for tutors and teachers — platform plan (2026-11-25)

Written with the owner on 2026-11-25. Builds on `docs/vision.md` (content,
games, teacher tools, languages) and `docs/classroom-concept.md` (classes,
learning data). This document adds **tutors** as the first paying audience
and plans the tools that let a tutor run their lessons on Krabsy.

Design partner: **Nora** (Spanish, 1:1 online lessons with children). She
uses everything for free and tells us what is missing.

## The one-line idea

**A tutor opens Krabsy before a lesson, sees where the student stands, gets a
50-minute lesson built from that, teaches it on Krabsy next to the video
call, and the student practises at home in games, which updates the
picture for next time.**

## Owner decisions (2026-11-25)

1. **Students can always play on their own.** Games, drills and topic pages
   stay free, with no account. Nothing in this plan puts a wall in front of
   a child.
2. **Teachers keep all their tools for free**: practice links, classes,
   dashboard, Quiz Room, the curated content. Teachers bring the traffic;
   traffic comes first.
3. **Tutors are the first audience that pays.** Not Nora (design partner,
   free forever), but other tutors who use the platform for their students.
4. **No marketplace, no commission, Krabsy never holds tutors' money.** A
   Preply-style marketplace is not the goal (finding students, payments,
   disputes, trust and safety are each a full-time job). A directory of
   tutors may come later, once there are many tutors (see phase 6).

## Teachers or tutors: one section or two?

**Recommendation: one shared toolbox, two front doors.**

Teachers and tutors use the same building blocks: a group of students, the
skill map, practice links, tasks, homework. The difference is only the
point of view:

| | Teacher | Tutor |
|---|---|---|
| Group size | 15–60 per class | usually 1, sometimes 2–5 |
| Main question | "What should the class repeat tomorrow?" | "What do I do with Lucas in his 50 minutes?" |
| First screen | class overview | student profile |
| Talks to | the class | the student **and the parents** (who pay) |
| Pays? | no (free tools, maybe Pro later) | yes (Pro) |

Technically, **a tutor's student is a class of one**. The classes API
(`api/classes.py`) already has codes, student tokens, answers and the
dashboard, so the tutor tools grow out of it instead of next to it.

Why not bend the teacher section towards tutors: there are far more
teachers than tutors, and teachers come for "free, no accounts, start in one
minute". Calendars, parent reports and prices on that page would make it
look like a business tool and scare them off. Why not two separate
products: twice the work for one person, and teachers should get the good
new parts too (tasks, worksheets).

### Page structure

```
Krabsy (kids: games, drills, topics, always free, no account)
│
├── For teachers  (button stays as it is; free)
│     practice links · classes · Quiz Room · lesson ideas
│     + new: task & worksheet generator (free, with a monthly limit)
│     + small link at the bottom: "Do you tutor privately? → Krabsy for tutors"
│
└── For tutors  (new page, own front door; Pro)
      landing: "Run your lessons on Krabsy"
      → My students (profiles, skill map)
      → Lesson builder → Live lesson → Homework → Parent report
```

- **Navigation:** the "For teachers" button stays. "For tutors" first gets
  its own page linked from the teacher page and the footer. It gets its own
  nav button only once tutors actually come.
- **One login for both** (once accounts exist): a teacher who also tutors
  sees their classes and their students in the same place.
- **URLs** (proposal): `/de/nachhilfe/`, `/es/clases-particulares/`,
  `/en/spanish/tutors/` (Nora's pilot section first).

## The core: one skill map per student

Every source feeds the map; everything Krabsy suggests is built from it.

```
games · homework · tasks · worksheets · tutor's notes
                     ↓
       skill map (stars per topic, per student)
                     ↓
 lesson plan · tasks · homework · parent report
```

**Same five-star scale for every topic** (no separate descriptions per
topic to write; example sentences per topic can be added where useful):

| Stars | Meaning | Where it comes from |
|---|---|---|
| ★ | Has seen it | tutor (or first answers recorded) |
| ★★ | Gets it right with help or hints | games / tasks |
| ★★★ | Gets it right when choosing from options | games (choice chips) |
| ★★★★ | Gets it right when typing | games (typed answers) |
| ★★★★★ | Uses it freely in their own sentences | **only the tutor** |

The tutor can always override a star by hand, and can add a short note
("mixes up ser/estar with feelings").

Starting point: `krabsy-stats.js` already keeps mastery 0–5 per word and
form, and class sessions already send every answer to the server. Needed:
record **how** the answer was given (choice / typed / with hint) and roll
the word data up into stars per topic.

## What a tutor needs to move their business over

1. **Student profiles.** Name (first name only), level, goals, notes, skill
   map, lesson history. A student is invited with a personal link or code:
   no email, no password for the child.
2. **Lesson builder.** "50 minutes, Lucas" → a suggested plan from his weakest
   topics: warm-up game, two tasks, a short teach part, a game at the end.
   The tutor drags blocks around, swaps or deletes them. This is the time
   saver tutors pay for.
3. **Tasks from templates.** The same pipeline as the games: a fixed
   template, questions filled in (`quiz` shape). Templates: gap sentences,
   choice, typed answers, matching, sorting into two groups. Each task also
   prints as a worksheet (PDF).
4. **Live lesson mode.** The tutor's screen controls the student's: start a
   task, see the answers come in live, give a reward. **No video in
   Krabsy**: they stay on Zoom/Meet, Krabsy is the second screen. (The
   Quiz Room is the starting point; it already has a teacher page and a
   children's page.)
5. **Rewards during the lesson.** The existing reward system (figures,
   accessories): the tutor gives a star or unlocks something live.
6. **Homework.** After the lesson: "practise ser vs estar, 10 minutes" as a
   link that opens a game with the right topic and level. Results update the
   skill map.
7. **Parent report.** One page per month (or after each lesson): what was
   practised, which stars went up, what comes next. Parents pay the tutor,
   so this keeps the tutor's customers happy.

**Not at first:** booking and payments. Tutors already have a way. Later:
a simple booking link, payments through the tutor's **own** Stripe/PayPal
account.

## Accounts, devices, siblings, adults, parents (owner decisions 2026-11-25)

**The rule: children never have an email or password. Accounts only ever
belong to adults who own the data.**

| | Login (email, later) | Personal link / key | Read-only link |
|---|---|---|---|
| Tutor, teacher | ✅ (secret link until then) | | |
| Adult learner alone (later) | ✅ | | |
| Adult learner with a tutor | | ✅ | |
| Child | **never** | ✅ | |
| Parent | only if Krabsy ever sells to families | uses the child's key | ✅ report |

- **Homework = content, not a game.** The tutor gives a topic, a goal in answers
  (e.g. 40) and a difficulty; the student picks any game or drill. Answers from
  everywhere count. The student page shows two groups: *Quick practice* (drills,
  "fastest way to your goal") and *Games* ("more fun, takes a bit longer").
  Counting answers instead of minutes keeps game choice fair.
- **Profile saved to the student's key.** Figure, shells, gifts, practice stats
  and game saves are saved on the server under the student (classes and tutor
  students alike) and restored when the link is opened on another device. Children
  without a key stay anonymous, on their device only (an optional "save code" may
  come later).
- **Siblings on one device: "Who's playing?"** A device can hold several people.
  Switching parks one person's data and loads the other's into the slots the
  games read, so games need no changes. A child without a key plays as *Guest*.
  The first person who opens a link on a device takes over what was played there
  anonymously before.
- **Adults:** a *child / adult* flag on the student. Adults get a calmer student
  page ("Your practice", quick practice first, no shells or gifts). Same content,
  star map and homework; no parental consent needed.
- **Parents: no account.** They use the child's link, and get a read-only **report
  link** from the tutor: star map, homework progress, number of lessons and a
  "note for parents" the tutor writes. Never the tutor's private notes.

## AI task generator (for tutors and teachers)

The gap that stops a tutor from moving over is **content coverage**: a
tutor needs a whole curriculum, Krabsy has a handful of topics per language.

- The tutor or teacher asks: "estar with feelings, A1, 15 questions, about
  football." Claude writes a draft in the topic format (`content/FORMAT.md`:
  sentence with a gap, answers, wrong choices, hint, teach note).
- **A human checks every draft before a student sees it.** Drafts are
  clearly marked "own material" and never mixed into the curated library on
  their own.
- With the author's permission, good checked material can be proposed for
  the curated library (reviewed again). Every user then helps grow the
  catalogue: the answer to "one person writes all the content".
- Teachers get it too, with a free monthly limit (each draft costs API
  money). Tutors on Pro get a higher limit.
- This bends the vision rule "we don't become a make-your-own-quiz tool"
  a little. The curated library stays the base; AI plus a human check fills
  gaps.

## Free vs. Pro

| | Kids | Teachers | Tutors (Pro) |
|---|---|---|---|
| Games, drills, topics | ✅ free | ✅ | ✅ |
| Practice links, classes, dashboard, Quiz Room | — | ✅ free | ✅ |
| Rewards | ✅ free | ✅ | ✅ |
| AI tasks / worksheets | — | free, monthly limit | higher limit |
| Student profiles, skill map with notes | — | (class dashboard) | ✅ |
| Lesson builder, live lesson mode | — | later, maybe | ✅ |
| Homework links | — | ✅ (practice links) | ✅ tracked per student |
| Parent report | — | — | ✅ |

Price idea to test, not decided: around **€10–15 per month** per tutor,
first students free (e.g. 2), so a tutor can try it with real lessons.
Nothing is sold to children, ever (no paid cosmetics).

## Phases

| Phase | What | Who it serves | Builds on |
|---|---|---|---|
| **1** | Student profiles + skill map (stars, notes) + homework links from existing topics | Nora | classes API, `krabsy-stats.js`, practice links |
| **2** | Live lesson mode with rewards | Nora | Quiz Room, reward system |
| **3** | Tasks from templates + printable worksheets | Nora, teachers | `quiz` shape, topic format |
| **4** | Lesson builder ("50 minutes, Lucas") | tutors | phases 1–3 |
| **5** | AI task drafts with human check | tutors, teachers | topic format, Claude API |
| **6** | Accounts (email login), Pro billing, 2–5 more tutors; later booking link and a tutor directory | paying tutors | — |

After phase 2, ask 2–3 tutors besides Nora whether this is what they would
pay for (not only Nora's wish list), before phases 4–6.

**Accounts** are needed for tutors from phase 1 (a tutor must find their
students again on another device). Start like classes do: a secret tutor
link (`#t=…`), and add email login in phase 6 (classroom concept phase 3).

## Guard rails

- Anonymous play for kids stays; teacher tools stay free (decisions 1–2).
- **Children's data:** first name only, no email or password for the child,
  data on the EU server, parental consent collected once through the tutor
  (in Germany, consent is needed under 16). Update the privacy pages and
  write an AVV template before tutor tools go public.
- No video, no payment handling, no marketplace commission.
- Content before features: a tutor who can't fill a lesson with Krabsy
  content won't stay, however good the tools are.
- One person: every phase must be usable on its own, so we can stop after
  any phase and still have something that works.

## Open questions

For the owner:
- Page names and URLs for the tutor section (proposal above).
- When to switch from the secret tutor link to email login.
- Price and number of free students to test.

For Nora:
- How do you plan a lesson today, and what takes the most time?
- What do parents ask you about progress, and how do you answer now?
- Which topics do your students need next (by level)?
- Would a live mode next to Zoom work for you, or do you share your screen?

## Phase 1 as built (2026-11-25)

- **API** `api/tutors.py` (same SQLite as classes): `POST /api/tutor/create` →
  tutor token · `GET /api/tutor/space` · `/rename` `/delete` · students:
  `POST /api/tutor/student/add` (→ id + student key) · `GET /api/tutor/student?id=`
  · `/update` `/stars` (null = back to measured) `/lesson` `/lesson-delete`
  `/homework` `/homework-delete` `/new-link` `/remove` (header `X-Tutor-Token`) ·
  `GET /api/tutor/me` (header `X-Student-Token`, the student's page).
- **A student = a hidden class of one.** Its code is never shown and can't be
  joined (`/api/class/join` refuses it). The student key in the personal link is
  the student token itself, so the link works on several devices; "new link"
  replaces it. Answers come in through `/api/class/answers` unchanged.
- **Stars** `measure_stars` (tested): 0 none · 1 answered · 2 ≥ 5 answers, half of
  the last 20 right · 3 ≥ 10 choice/typed answers, 80 % of the last 20, ≥ 4 words
  right · 4 level 3 + ≥ 8 typed, 80 % of the last 10 · 5 only by the tutor.
  Answer mode: new column `attempts.mode`; `recordAttempt(…, topic, mode)` sends it;
  without it the server counts free-practice pages as typed, the rest as choice.
  **No game sends `mode` yet**, so ★★★★ is only reachable via free practice
  (English topics) until games with typed answers pass `'typed'`.
- **Pages** (noindex, unlinked): `/en/spanish/tutors/`, `/en/spanish/tutors/space/`,
  `/en/spanish/me/`; UI `lib/krabsy-tutor.js` + `.css`. The tutor's device
  remembers spaces and student links (`krabsy_tutor_spaces`, `krabsy_tutor_keys`);
  the server keeps only hashes, so a link made on another device can't be shown
  again (→ "make a new link").
- Homework links use `from=teacher` (banner "Practice from your teacher").
- Retention: a tutor space idle 180 days is deleted with all students; opening
  the space keeps its students' classes alive.
- Not yet: other interface languages, rewards from the tutor, parent report,
  live mode (phase 2).

## Accounts round as built (2026-11-25)

- **Homework = topic + goal + difficulty** (`tutor_homework.goal`, `target` now
  empty = any game). The student page shows per homework a progress bar
  (answers since it was given / goal) and two groups of tiles: *Quick practice*
  (Sprint, Fill the Gap) and *Games* (every game that plays the topic). Children
  see games first, adults quick practice first.
- **Profile saved to the key:** `GET/POST /api/profile` (`student_profiles`, one JSON
  per student, max 400 KB; works for class pupils and tutor students; survives a
  new link). Client `lib/krabsy-sync.js`, loaded by `krabsy-analytics.js` on
  every top-level page when the device has a person or a class session. Synced:
  every `krabsy_*` / `td3d_*` key except device settings (language, sound/mute,
  class/tutor bookkeeping). Pull on page load, push every 20 s and on leaving.
  Both sides changed → shells (higher `earned`, owned united), stats (per word the
  record with more attempts) and rewards (done/log united) are merged; anything
  else: this device wins.
- **People on a device** (`krabsy_people`): opening a student link or joining a
  class makes that person active. The first person takes over what was played
  anonymously before; a second person parks the first one's keys
  (`krabsy_stash_<id>`) and starts with their own. With 2+ people (or a guest), the
  first page of a browser session asks "Who's playing?" (not on the tutor,
  student and report pages); the student page has "Switch player".
- **Adults:** `tutor_students.adult`; checkbox when adding/editing. Adult student
  page "Your practice, Ana", quick practice first, no figure link; `krabsy_adult=1`
  on the device (synced with the person) hides the shells counter and gift cards.
- **Parents' report:** `POST /api/tutor/student/report-link` (new link replaces the
  old) → `/en/spanish/report/#r=…` (`GET /api/report`): note for the parents
  (`report_note`), star map, answers per week (4 weeks), homework progress, number
  of lessons. Never the private notes, topic notes or lesson texts.
- Tested: `api/tests/test_tutors.py` (55 API tests); headless: anonymous play →
  Lucas's link keeps it; Emma on the same device starts at 0; picker switches back
  to Lucas with his shells; Lucas's link on a second device restores his shells;
  adult page without shells; the report shows the note but not the private note;
  Emma's answers don't count for Lucas's homework.
- Limits: a game already open in another tab keeps the old person until it is
  reloaded; pages show synced changes from another device on the next page load.
