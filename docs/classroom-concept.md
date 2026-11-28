# Krabsy for classrooms — concept

Status: phases agreed 2026-11-21. **Phase 1** (smart mix, answers recorded) built
2026-11-22 for the engine, drills, Snake, Air Control, Verb Towers. **Phase 2**
(classes without teacher accounts) built 2026-11-22 — see "Phase 2 as built" at
the end. Master session owns this document.

## 1. Why

Teachers are Krabsy's main channel. The first organic class (Uruguay, Plan
Ceibal/Schoology, 2026-11-12) found us via Bing, and teachers share links with
their classes. Today a teacher can share a link but sees nothing afterwards:
who played, for how long, and which words the class still gets wrong.

Goal: a teacher creates a class, children join with a code, the teacher sees
what to repeat in the next lesson, and every child gets questions that fit
what *they* still need, not *go → went → gone* again and again.

## 2. Principles

1. **The anonymous path stays.** Anyone can still play without a code or an
   account. "No accounts, no data" is a selling point on the teacher page and
   remains true for everyone who doesn't join a class.
2. **As little data about children as possible.** No email, no password, no
   surname, no birthday. A child is a display name the teacher typed (first
   name or nickname) inside one class.
3. **The teacher's question is "what should I repeat tomorrow?"** The class
   view comes first; the per-child view second. Krabsy does not lock or
   police what children play.
4. **One learning engine for everything.** Every game and drill records
   answers the same way and asks the same engine for its next questions, so
   practice in one game counts in all of them.
5. **No grammar terminology in questions** (existing mandate). The same goes
   for the dashboard as far as possible: show `go → went → ___`, not
   "Simple Past".

## 3. What exists today

| Piece | State | File |
|---|---|---|
| Per-word learning data | Every answer per item and form (`past`, `participle`, prepositions `default`): attempts, correct, mastery 0–5, last seen; fades after 14 days without practice; "strugglers" list. **Only in the child's browser** (`localStorage["krabsy_stats_v2"]`). | `homepage/lib/krabsy-stats.js` |
| Who records answers | Drills and tools only: Sprint, free practice, flashcards, overview pages (DE + ES, verbs + prepositions). **No arcade or 3D game records anything.** | grep `recordAttempt` |
| Question engine | `getQuizSet` / `getChainSet` pick by topic, count and tier (3 difficulty tiers), **at random**. Mastery is not used. | `homepage/lib/krabsy-questions.js`, `krabsy-data.js` |
| Spaced repetition | Verb Kitchen has its own (`krabsy_vkitchen_save`), separate from the shared stats; in the unreleased source only. | `games/verb-kitchen/src/qa.js` |
| Server | FastAPI app on Coolify (`api.krabsy.com`): anonymous page analytics, append-only JSONL file, basic-auth dashboard. No database, no logins. | `api/` |
| Teacher page | Explains link sharing and the privacy promise ("Keine Konten"). | `homepage/de/lehrkraefte/`, `homepage/es/docentes/` |

## 4. The smart mix (runs through all phases)

One function in the question engine decides what to ask next:
`getSmartSet({ topic, count, shape, wordList? })`. Games and drills call it
instead of picking at random. The mix per round, e.g. 20 questions:

- **~40 % practice words:** answered wrong recently, or mastery has faded
  because the word hasn't come up for a while.
- **~40 % new words** from the child's current level.
- **~20 % quick repeats** of known words, spaced further apart each time
  they are answered right (so *go* shows up rarely once it is mastered).

Levels: a new child starts with tier 1. When most tier-1 words reach good
mastery, tier 2 words start appearing, then tier 3. Within a class the
teacher's word list replaces the tiers (see 6.3). Assignment words go first.

Rules the engine keeps: the chain order for verbs (3rd form only right after
the 2nd, with the 2nd filled in), no duplicate word in the same short round,
and the existing shape filters (e.g. max word length for Verb Snake/Flow).

The numbers above are starting values to tune with real play data.

## 5. Phases

### Phase 1 — every game records answers, and the smart mix (no accounts)

- Each game calls `recordAttempt()` at its right/wrong moment (Verb Kitchen,
  Snake, Flow, Slash, Air Control; Verb Towers and Verb Dungeon before
  release).
- Games ask `getSmartSet()` for questions. Verb Kitchen drops its own
  spaced repetition in favour of the shared one (migrate its saved keys).
- `recordAttempt()` gains an optional hook: when the child is in a class
  (phase 2), the answer is also queued for the server.
- Benefit right away: every child gets a better mix and a statistics page
  that includes the games. No new data leaves the device.
- Small, safe, needed for everything after it.

### Phase 2 — classes without teacher accounts (smallest real version)

- Teacher clicks **"Klasse erstellen" / "Crear clase"** on the teacher page.
  Krabsy creates a class and shows:
  - a **class code** for children (6 characters, no look-alike letters, e.g.
    `KR4-B7X`) plus a join link and QR code;
  - a **secret dashboard link** to bookmark ("keep this link private —
    whoever has it sees the class"). No email, no password.
- Child enters the code (or opens the link), types a nickname, plays.
  Answers go to the server under (class, nickname).
- Dashboard: who played this week and how long, and **the hardest words
  for the whole class**.
- Optional: the teacher picks a word list for the class (6.3).
- Purpose: learn whether teachers actually use a class view before building
  accounts. If they lose the link, they create a new class — acceptable for
  a test.
- Classes are deleted automatically after e.g. 6 months without activity.

### Phase 3 — teacher accounts, name lists, assignments

- Teacher account with **email and a login link** sent by email (no
  password). Google/Microsoft login can come later (many schools in Spain
  and Uruguay use Google Workspace).
- Phase-2 classes can be claimed into an account with their secret link.
- **Name list per class:** the teacher types first names or nicknames.
  A child enters the class code, taps their name, and confirms with a
  **picture code** (three pictures, e.g. 🐙 🍕 🚀) so children don't play as
  each other. The teacher can reset a picture code.
- On a child's own device the class + name is remembered, so next time it's
  one tap. On shared school devices the child taps "Not me" first.
- **Progress follows the child** across devices (school Chromebook, home).
- **Assignments:** "practise these 20 verbs by Friday" (optionally limited
  to certain games/drills). The child sees the assignment after joining;
  the teacher sees who has done it.

### Phase 4 — live mode on the projector

> 2026-11-22: being designed as the **Krabsy Quiz Room** (`games/quiz-show/CLAUDE.md`):
> every child joins a 3D room with a room code (no class needed; a phase-2 class
> can be linked), the server is a WebSocket module in `api/`.

- The teacher starts a live round (5 minutes, one topic or word list) on the
  classroom screen; children join with the code; a live ranking shows on the
  projector; results land in the dashboard.
- This is the feature classes remember and talk about (Kahoot effect).
- Needs realtime connections (WebSocket or server-sent events) — the most
  technical phase.

## 6. What the screens look like

### 6.1 Child

1. "Klassencode eingeben" field on the landing page header/teacher strip,
   plus the join link `krabsy.com/k/KR4B7X`.
2. Phase 2: type a nickname. Phase 3: tap your name, then your picture code.
3. A small class badge appears in the header ("Klasse 6b · Mia") with
   "Not me" / leave. Then the normal site: games, drills, an assignment card
   at the top if there is one.

### 6.2 Teacher dashboard

- **My classes** (phase 3) → one page per class.
- **Class header:** code, join link, QR code, "show code on projector".
- **Overview:** who played this week, minutes, number of answers, accuracy.
- **Words:** hardest words for the whole class, e.g. a list
  `bring → brought → brought · 14 of 22 children still unsure`; click a word
  to see which children. Also "solid words" so the teacher knows what to skip.
- **Child** (phase 3): known words, practice words, last played.
- **Assignments** (phase 3): create, see progress per child.
- **Word list** (6.3).
- **Settings:** rename class, delete class and all its data.

### 6.3 Word lists (teacher control over which verbs)

- Choose by level ("Grundwortschatz Klasse 5/6" = tier 1, …), tick
  individual verbs, or pick a ready-made list (later: textbook units, e.g.
  common German and Spanish school books — check licences).
- The smart mix then stays inside that list for this class; children outside
  a class keep the automatic levels.
- Same for prepositions (by use case: time, place, fixed phrases).

## 7. Data stored on the server

| Table | Fields | Notes |
|---|---|---|
| teacher (phase 3) | id, email, language, created, last login | email only for login; no name required |
| class | id, teacher_id (nullable in phase 2), name, code, secret dashboard token (hashed), word list, created, last active | auto-delete after inactivity |
| student | id, class_id, display name, picture code (hashed) | display name typed by the teacher/child; no other personal data |
| attempt | student_id, topic, item, form, correct, source (game/drill), timestamp | the same record `recordAttempt()` already makes |
| assignment (phase 3) | class_id, words, games, due date | |

Per-child mastery can be computed from `attempt` on the server, so the child's
device and the server always agree.

## 8. Technology

- **Backend:** extend the existing FastAPI app in `api/` (already deployed as
  its own Coolify app) or start a second small service; add a real database
  (SQLite on the existing mounted volume is enough for thousands of classes;
  Postgres if it grows). Backups of the volume become important.
- **Endpoints (sketch):** create class, join class, post attempts (batched,
  queued offline and retried), class dashboard data, teacher login link,
  word lists, assignments; later live rounds.
- **Child session:** a random token in `localStorage` tied to (class,
  student). No cookies needed.
- **Teacher session:** login link by email → session cookie on
  `api.krabsy.com` (or the dashboard served from the API app).
- **Email sending (phase 3):** an EU transactional email provider for login
  links.
- **Front end:** the dashboard can be a static page under `homepage/` that
  talks to the API, in the same style as the site; DE + ES from the start.
- **Abuse:** rate limits on join and create; codes long enough not to be
  guessed; teacher can remove a name.

## 9. Privacy and legal (before phase 2 goes online)

- Update the privacy policy (DE `datenschutz`, ES `politica-privacidad`) and
  the teacher page promise: anonymous use stays without data; joining a
  class stores nickname + answers for the teacher.
- **Data-processing agreement template** ("AVV" in Germany, "encargado del
  tratamiento" in Spain): the school is the controller, Krabsy processes on
  its behalf. Many German schools require one before using a service with
  pupil data.
- **EU hosting** of server and database (check where the Coolify server
  runs), EU email provider.
- Deletion: teacher can delete a class at any time; automatic deletion after
  inactivity; no data used for anything else (no ads, no selling, no
  training).
- Ages: children from about 10. Because the school/teacher creates the class
  and no account is created by the child, parental consent is normally
  handled by the school — to be confirmed for DE (DSGVO / state school
  rules), ES (LOPDGDD, age 14) and Uruguay (Ley 18.331).
- Get a short legal review once before phase 2 launches.

## 10. Who builds what

- **Master session:** this concept, the shared engine pieces
  (`recordAttempt` hook, `getSmartSet`), the backend, the dashboard, the
  join flow, privacy texts, teacher page.
- **Each game session:** wire its game to `recordAttempt()` and
  `getSmartSet()` (one short brief per game folder `CLAUDE.md`), Verb Kitchen
  also migrates its own spaced repetition.

## 11. Open decisions for the owner

1. Where is the Coolify server hosted (EU)? Needed before phase 2.
2. Phase 2 without teacher email (secret link) — OK as the first test, or
   go straight to email login?
3. Should a teacher see each child's details in phase 2 (nicknames), or only
   the class view until accounts exist?
4. How long to keep inactive classes (proposal: 6 months)?
5. Ready-made word lists: which school books / curricula matter most (DE,
   ES, Uruguay)?
6. Who does the legal review (privacy policy, AVV template)?

## Decision: teacher accounts (owner, 2026-11-27)

**Rule: no account for anything that stores no children's data; an
optional sign-in for classes, which do.**

| Teacher feature | Account |
|---|---|
| Practice links, Quiz Room, worksheets, lesson ideas | never (nothing about the children is stored) |
| Create a class | optional: works at once without an account; right after creating, offer "Klasse sichern" with an email link (no password, the tutor sign-in in `api/tutor_auth.py`) so the teacher finds all classes on any device |
| Paid teacher tools (if ever) | required |

**Why no required account:** teachers are the main channel and a sign-up
form loses the teacher who "just wants to try it" in a free period; without
an account Krabsy stores nothing about the teacher, which helps with school
data-protection officers; "ohne Konto, ohne E-Mail" is promised in the
outreach texts and is a selling point against comparable sites.

**Why not account-free forever:** the secret dashboard link is the weakest
point for children's data (whoever has it sees first names and results;
lost link = lost class, no recovery; a forwarded link exposes the class);
several devices and classes are awkward without an account; Krabsy can't
reach or learn from its teachers; the passwordless email sign-in already
exists for tutors.

**Revisit when:** teachers report lost class links; a school asks for a
data-processing agreement (AVV, needs a contracting party); paid teacher
tools are introduced.

**Next feature:** optional teacher sign-in ("Klasse sichern") on the class
pages DE/ES/EN, reusing the tutor email sign-in; existing classes can be
attached to the account via their secret link. The "ohne Konto" promises
stay true. **Built 2026-11-27**, see "Teacher sign-in as built" below.

## Teacher sign-in as built (2026-11-27)

Built to the decision above; not deployed yet (deploy the API first).

- **Account model:** one account identity for teachers and tutors
  (`api/accounts.py`, tables `accounts`, `account_links`, `account_sessions`).
  An account is only an email; the teacher role = classes with
  `classes.account_id`, the tutor role = a tutor space with `tutors.account_id`.
  One sign-in flow (email → one-time link → session per device); the link
  lands on the page of its context (teachers: "Meine Klassen" in their
  language, tutors: `/en/spanish/tutors/login/`). `tutor_auth.py` keeps the
  tutor endpoints on top of it; the 2026-11-25 tutor tables migrate on start.
- **Sessions:** like the tutor sign-in: token in `localStorage`
  (`krabsy_account` on class pages), sent as `X-Account-Token`
  (`X-Tutor-Token` on tutor pages, same session), stored as SHA-256, 60 days
  after last use, sign-out per device. Links: 20 minutes, single use, hashed.
- **Security:** rate limits 30 link requests per IP and 5 per address per hour
  (shared with tutors), 60 verifies per IP per 10 min, 60 attaches per IP per
  hour; `/login` answers the same for known and unknown addresses and the
  teacher email text doesn't depend on whether an account exists. A class
  attached to one account can't be attached to another (409) until detached.
  Saved classes open with the account (`#c=<id>`), so the secret link is no
  longer the only key; owners can replace it ("Neuen geheimen Link
  erstellen", the old one stops at once). The secret link keeps working for
  every class: it is the way back in after "delete account".
- **Purge:** classes as before (180 days without activity). Accounts with no
  class and no tutor space: deleted 180 days after the last sign-in or use.
  Deleting a tutor space deletes an otherwise empty account. "Konto löschen"
  removes email, sessions, open links and the account→class links at once;
  refused (409) while the account also has a tutor space.
- **Pages:** create (card "Klasse sichern", recommended, "Später"), dashboard
  (quiet card / "Zu meinem Konto hinzufügen" / "Gesichert in Ihrem Konto"),
  "Meine Klassen" `/de/lehrkraefte/meine-klassen/`, `/es/docentes/mis-clases/`.
  EN has no class pages (sections.json `class: null`), so nothing there.
- **Texts:** `ui_<lang>.json` `classes` (page) and `mail` (emails, de/es/en,
  copied into `api/catalog.json`). Privacy pages DE/ES/EN and the teacher
  pages updated; "Klasse erstellen ohne Konto und ohne E-Mail" stays true.
- **Open for the owner:** name the email provider in the privacy pages?
  Per-language senders (`MAIL_FROM_DE/_ES/_EN`, needs aliases); lawyer review.

## Live invites (owner decisions 2026-11-28)

**Idea:** pupils of a class and students of a tutor just use krabsy.com. When
their teacher or tutor starts something live (Quiz Room, live lesson, later a
live worksheet for a class), an overlay appears on whatever Krabsy page they
are on, games included: "Deine Klasse startet ein Quiz – jetzt beitreten?" →
**Beitreten** or **Jetzt nicht**. Joining needs no code and no name: Krabsy
already knows the pupil, so live answers count towards the class overview and
the skill map.

**Decisions:**
- One mechanism for teachers and tutors: a tutor's student is a class of one,
  so an invite always targets a class.
- **Website only.** No OS push notifications (permissions, children). The
  invite shows only while a Krabsy tab is open; the code/QR stays as fallback.
- **No pause function in games.** Games already save progress and levels are
  short; losing the current level when joining is fine. The overlay simply
  sits on top; "Beitreten" navigates away.
- **No fullscreen games** exist (checked 2026-11-28: no `requestFullscreen` in
  the site), so the overlay is always visible. Don't add fullscreen games
  without handling the overlay.
- **"Jetzt nicht"** always available; the teacher/tutor sees who joined and who
  declined/didn't respond. A declined invite doesn't come back for that session.
- Shown only while the session is actually live (expires when it ends or after
  a maximum time), so nothing appears in a pupil's free time unless the
  teacher/tutor really started something.
- Shared devices: the overlay names the pupil it is for ("Bist du Mia?") with
  "Nein, jemand anderes" (uses "Who's playing?" where available).
- Privacy: no new data; uses the existing class/student tokens. The server
  only answers whether there is a live invite for this device's classes.

**Mechanism:** a shared script on every page (only on devices that hold a
class or student key) asks the API every ~15–20 s while the tab is visible
(Page Visibility API) "any live invite for my tokens?". Starting a live
session creates an invite for the class with an expiry; ending it removes it.
Polling matches the existing live-lesson approach (no extra server parts).

**Steps:** (1) invite + overlay for the tutor live lesson (exists); (2) Quiz
Room started for a class → invite, pupils join with their identity, answers
recorded; (3) teacher-side live view of who joined/declined.

## Live invites as built (2026-11-28)

Built to the decisions above; not deployed (deploy the API first).

- **API** `api/invites.py`, **in memory only** (single uvicorn process, like the Quiz
  Room). An invite = class id, kind (`quiz` | `lesson`), class name, who started it,
  target page, expiry (quiz 2 h, lesson 3 h), the class roster and the pupils' answers.
  `POST /api/invites {tokens: [...]}` (all class/student tokens of the device, ≤ 8, in the
  body, never in a URL) → `{poll: 18, invites: [{id, kind, class, host, target, name, who}]}`
  (`name` = the pupil it is for, `who` = index of that token); with nothing live
  anywhere it answers without touching the database. `POST /api/invites/respond
  {token, invite, answer: join | decline}`: "Jetzt nicht" is kept per pupil and invite
  and that invite doesn't come back for that pupil. The host gets `{t: 'invite', class,
  list: [{name, s: joined | declined | waiting}], joined, declined, waiting}` on its
  socket whenever it changes. Rate limits per IP: 1200 polls / min (a school behind one
  address), 300 answers / min. Ending the session (quiz over, room closed, lesson ended,
  student removed / new link) deletes the invite with all answers. Tests:
  `api/tests/test_invites.py`, `test_quiz_room.py::test_class_room_*`,
  `test_live.py::test_lesson_invite`.
- **Quiz Room for a class** (`api/quiz_room.py`, `games/quiz-show/`, copied to
  `homepage/games/quiz-room/`): the teacher page has "Für Klasse" (classes opened on
  this device via their secret link, `krabsy_teacher_classes`, plus the account's
  classes when signed in); the class dashboard links "Quiz-Raum mit dieser Klasse"
  (`teacher.html?class=<code>` preselects it). `create {…, class: {teacher_token} |
  {account_token, class_id}}` is checked on the server (`no_class` otherwise). Pupils
  arrive at `index.html?code=…&lang=…&class=1` and send `join {code, student: <class
  token>}`: no code typed, no name, the name from the class (`joined.cls` = class name in
  the HUD); the same pupil on another device = the same player; removed = can't come
  back; a locked room pauses the invite. Joining by code works as before for everyone.
  Their answers reach the class exactly like any game answer (the reveal's word →
  `recordAttempt` on the pupil's device → `/api/class/answers`). Teacher view: a list
  "Einladung an 6b · 1 dabei · 1 jetzt nicht · 1 warten" with names above the players.
  Quiz-room modules now carry `?v=` (`tools/stamp_game_modules.py` handles games with
  several pages: `python3 tools/stamp_game_modules.py games/quiz-show homepage/games/quiz-room`).
- **Live lesson** (`api/live.py`): starting a lesson (start / first load, also after a
  restart when the tutor reconnects) opens a `lesson` invite to `/en/spanish/me/`, where
  the lesson opens by itself; a student already on that page counts as joined. The tutor
  live page shows "Lucas gets an invitation on any Krabsy page" / "Lucas chose “Not
  now”" in the presence line until the student is there.
- **Overlay** `lib/krabsy-invite.js`, started by `krabsy-analytics.js` next to
  `krabsy-sync.js` (same condition: top window, device holds `krabsy_people` or
  `krabsy_class`), so every page with the analytics script has it, including the game
  and drill wrapper pages (the overlay covers their iframes) — no page needed a new
  script tag. Polls every 18 s (+ up to 3 s jitter; the server sends the interval) only
  while `document.visibilityState === 'visible'`; the last poll time is kept in
  `sessionStorage`, so page changes don't add polls; errors back off (×2 up to 5 min);
  no tokens → no request. Not on teacher / tutor / report pages, not on the invite's own
  target page. Modal dialog (role dialog, aria-modal, focus trap, Esc = Jetzt nicht),
  icon `ki-quiz` / `ki-teacher`, "Für Mia" (shared device: "Bist du Mia?" + "Nein, jemand
  anderes" → "Who's playing?"), **Beitreten** (records join, switches to that person if
  needed, opens the target), **Jetzt nicht** (recorded). Texts `ui_<lang>.json`
  `invites` (de/es/en), loaded only when an invite shows.
- **Privacy:** DE/ES/EN privacy pages (Quiz-Raum + live lessons) say that the browser
  asks about every 20 s with the class key it already has, that the teacher/tutor sees
  joined / "Jetzt nicht" / no answer, and that this lives only in memory and is gone when
  the quiz / lesson ends, at the latest after 2 h / 3 h.
- **Limits / open:** `krabsy-analytics.js` is still referenced as `?v=2026-11-22` on
  ~500 pages (not bumped: shared checkout with other sessions' uncommitted pages); the
  1 h cache means returning visitors get the overlay at the latest an hour after the
  deploy. A pupil who joined and then left the room is not invited again for that quiz
  (the code still works). Live worksheets for a class (kind `worksheet`) are not built.

## Phase 2 as built (2026-11-22)

Owner decisions 2026-11-22: server is in the EU (Hetzner DE) · teachers get a
secret link first, no email · teachers see names and per-child detail ·
inactive classes are deleted after 6 months. Still open: word lists (5) and
the legal review (6) — the privacy pages DE/ES have a "Klassen / Clases"
section, but no lawyer has read it and there is no AVV template yet.

- **API** (`api/classes.py`, SQLite `classes.sqlite3` in the `/data` volume):
  `POST /api/class/create` → code + teacher token · `POST /api/class/join`
  (code + first name; a name already in the class returns `name_taken` → the
  page asks "that's me (other device)" → `same_person: true`, or "someone
  else" → add the surname's initial, e.g. "Mia S.") ·
  `POST /api/class/answers` (header `X-Student-Token` or `token` in the body
  for `sendBeacon`) · `GET /api/class/dashboard`, `POST /api/class/rename`,
  `/remove-student`, `/delete` (header `X-Teacher-Token`). Tokens stored as
  SHA-256 only; codes 6 chars without 0/O/1/I/L; max 60 pupils; rate limits
  per IP; background purge every 6 h (180 days after last activity). Tests:
  `api/tests/test_classes.py`.
- **Browser:** `lib/krabsy-class.js` (session in `localStorage.krabsy_class`,
  answer queue `krabsy_class_queue`, flush every 8 s and by beacon on
  pagehide). `krabsy-stats.js recordAttempt` loads it only when a class
  session exists — so every game/drill that records answers (phase 1) feeds
  the class automatically, also inside game iframes.
- **Pages** (noindex, not in the sitemap): join `/de/klasse/` `/es/clase/`
  (`?code=` prefills) · create `/de/lehrkraefte/klasse-erstellen/`
  `/es/docentes/crear-clase/` · dashboard `/de/lehrkraefte/klasse/#t=…`
  `/es/docentes/clase/#t=…` (token only in the URL fragment). UI in
  `lib/krabsy-class-pages.js` + `lib/krabsy-class.css`.
- **First names, not nicknames** (owner 2026-11-22): pupils type their first
  name; two pupils with the same name are never merged silently (see join).
- **Entry points:** landing "Klassencode bekommen? Hier beitreten →" (becomes
  a "👥 6b · Mia" badge after joining), the same badge in the game header,
  teacher pages: "Klasse erstellen (neu)" button + updated FAQ/privacy list.
- **Dashboard shows:** active pupils / answers / % right this week; words
  the class is unsure about (≥ 3 answers, fewer than 2 of a pupil's last 3
  right) with the nicknames; solid words; per pupil: last active, answers
  (week/total), % right, words to practise, remove; where they practised.
- **Not yet:** teacher-chosen word lists, assignments, picture codes,
  email login (phase 3), live mode (phase 4); phase-1 wiring for Kitchen,
  Flow, Slash, Platformer, Dungeon (their answers don't reach classes yet).
