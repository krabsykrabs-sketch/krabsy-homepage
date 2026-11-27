# The student's side: a practice path around the games (concept, 2026-11-27)

Written with the owner on 2026-11-27. Builds on `docs/tutor-platform.md`
(skill map, student page, homework, sync), `docs/figures-shells-world.md`
(figure, shells, gifts) and `docs/game-contract.md` (games play any topic).

## The idea in one paragraph

**Games are Krabsy's USP on the students' side. Everything else is built
around them to support teachers' and tutors' work.** Teachers and tutors
bring the students. The more of a student's practice happens on Krabsy, the
better the tutor's picture of that student (the skill map), and the more a
tutor gets out of Krabsy Pro. So the student side should make children want
to come back every day, Duolingo-style, without becoming a Duolingo clone:
a short **practice session** that decides what's next (with a **weekly** goal, not a daily one), **vocabulary** as a new
kind of topic, and an interface that **gradually switches to the language
being learned** as the child gets better.

## Principles

1. **Games first.** The practice session ends in a game, gifts are found in games,
   vocabulary is played in the games. Drills and lists are the quick way in,
   not the destination.
2. **The data serves the tutor.** Every answer feeds the skill map
   (`measure_stars`, `attempts.mode`). Features that create more and better
   answers (typed answers, spaced repetition, regular practice) are the
   priority, because they make the tutor's picture sharper.
3. **Calm, not addictive.** Children are 10–14 and often in a class. No
   leagues, no rankings between children, no hearts or lives, no "you lost
   your streak!" guilt. Streak days don't have to be consecutive (already
   the rule for gifts).
4. **No wall in front of a child.** Everything works without an account
   (owner decision in `tutor-platform.md`). With a tutor or class link, the
   progress follows the child across devices (`krabsy-sync.js`).
5. **The adult decides where it matters.** A tutor or teacher can set what
   a student practises (homework, word lists) and how much of the
   interface is in the learning language.

## What already exists (2026-11-27)

| Piece | Where |
|---|---|
| Smart mix: what this child should practise now (new / weak / due) | `krabsy-smart.js`, `getQuizSet({ smart })` |
| Mastery 0–5 per word and form, accuracy, streak | `krabsy-stats.js` |
| Shells, gifts for milestones, practice days, weeks, finds in games | `krabsy-shells.js`, `krabsy-rewards.js` |
| Own figure, hero choice in the games | `krabsy-figure.js`, figure page |
| Profile "Mein Profil": progress per topic, goals | `krabsy-profile.js` |
| Student page with homework (topic + goal + difficulty), tutor stars | `/en/spanish/me/`, `api/tutors.py` |
| Progress synced to the student's key (tutor or class link) | `krabsy-sync.js`, `/api/profile` |
| Topics in any learning language (gap format v2) | `content/FORMAT.md`, `TOPIC_REGISTRY` |

What is missing is the **spine**: something that tells the child "this is
your practice now" and ties the pieces together.

---

## 1. The practice session ("Jetzt üben" / "Practicar ahora" / "Practise now")

**Not daily (owner 2026-11-27).** Children practise when their class or tutor
sets it, often once or twice a week. So there is no daily goal and no day
counter on screen: the goal is **per week** (3 sessions), and practice days
only count in the background (gifts, parents' report).

### What the child sees

- One big button on the landing page (next to the figure) and on the
  profile: **"Jetzt üben · 5 Minuten"**, with a small **weekly ring** ("1 von 3 diese Woche")
  (0/3 steps).
- A session is **three short steps**, then a reward:
  1. **Warm-up** (1–2 min): 8–10 questions the smart mix says are due,
     across all of the child's topics, in a light drill (the Sprint look).
  2. **Something new or weak** (1–2 min): one topic, a few new items with
     the teach line shown first, then asked. Typed answers when the child is
     ready (★★★★ in the tutor's map needs typing).
  3. **Play** (open end): a game suggested for this session, already set to the
     topic of step 2 (`?topic=…`). The step counts as done after a few
     answers in the game; the child can keep playing.
- Done: **one more session in the weekly ring** (3 = the week is ✓, more is welcome), shells, maybe a gift (practice days already give
  gifts at 3 / 7 / 14 / 30). The ring on the landing page is full.
- **Homework comes first.** If a tutor or teacher assigned something, step 2
  is that topic, and the session says so ("Von deiner Lehrerin: ser oder
  estar").

### How it decides

- The **smart mix already knows** what is new, weak or due per topic. The
  path adds the cross-topic layer: which of the child's topics is most
  urgent now (homework > weakest > longest not practised).
- **"The child's topics"** = topics the child has answered at least once,
  plus homework topics, plus the section's starter topic (verbs on /de/ and
  /es/, `es_ser` on /en/spanish/).
- **Weekly goal**: 3 sessions of 3 steps each. Later a tutor or teacher sets the number per student or class
  if tutors ask for it.

### Why it matters for tutors

- Regular short practice → more answers per week, spread over time → a
  sharper skill map and a parents' report that shows steady work.
- Typed answers in step 2 make ★★★★ reachable outside free practice.

---

## 2. Vocabulary

### Content

- **A vocabulary list is a topic** in the gap format v2, with one addition:
  each item is a word with its translation(s), and an optional example
  sentence with a gap. Proposal (to be specified in `content/FORMAT.md`):

  ```json
  { "format": 2, "kind": "vocab", "id": "en_vocab_school", "learn_lang": "en", "level": "A1",
    "title": { "de": "In der Schule", "es": "En el colegio", "en": "At school" },
    "items": [
      { "id": "pencil", "word": "pencil", "emoji": "✏️",
        "translations": { "de": ["der Bleistift"], "es": ["el lápiz"] },
        "examples": [ { "sentence": "Can I borrow your ___?", "answers": ["pencil"], "difficulty": 1 } ] }
    ] }
  ```

- **Question shapes** from one item, all through `getQuizSet` so every game
  that plays any topic plays vocabulary without code changes:
  - **meaning → word**: "Bleistift → ?" with choices or typed;
  - **word → meaning**: "pencil → ?" (choices in the child's language);
  - **gap sentence** from the example ("Can I borrow your ___?").
  Picture-only questions (emoji) for the youngest, where an emoji exists.
- **Pronunciation** with the browser's built-in voice (`speechSynthesis`),
  a 🔊 button on the question and in the teach beat. No audio files to
  record or maintain. Falls back to nothing if the device has no voice.
- **Pictures**: only emoji or pictures we own; no image search.

### Two kinds of lists

1. **Core lists by Krabsy**, curated and small (20–40 words each), by theme
   and level: school, family, food, animals, body, clothes, house,
   weather, time, hobbies … for English (DE/ES speakers) and Spanish (EN
   speakers). They appear as topics in the section, the link builder and
   the practice session.
2. **Personal lists per student, made by the tutor**: "the words from
   today's lesson". Typed in or pasted, or made by the AI task generator
   (`tutor-platform.md`) from a theme. They live with the student on the
   server (the student's key), are played in the games like any topic, and
   show up in the tutor's skill map. **A strong Pro feature.**
   Teachers get the same per class (a class word list) for free.

### Rules

- Word lists follow the presentation mandate: no grammar terms as the
  question.
- A personal list is private to the tutor and the student; it is not shown
  on public pages.

---

## 3. More of the learning language in the interface

### The idea

As a child gets better, more of the menus and buttons appear in the
language they are learning: English for /de/ and /es/, Spanish for
/en/spanish/. It is language exposure that costs nothing extra and grows
with the child.

### Rules (so it doesn't backfire)

- **Per child, never site-wide.** Public pages, SEO pages, teacher pages
  and the landing page text stay in the native language. A teacher who
  opens the site must see a site for their class.
- **Short, repeated words first**: buttons and menu items in games and the
  practice session ("Play", "Next", "Try again", "Level", "Done!"). Explanations,
  teach lines, instructions and anything about privacy stay native.
- **Levels**, driven by the child's progress (e.g. answers and stars in the
  section's topics), switched on gradually:
  - **0 (start):** everything native.
  - **1:** game buttons and the practice session's buttons in the learning language.
  - **2:** plus menu headings and short game messages.
  - **3:** plus game start screens (short tagline texts).
- **Tap to translate**: every learning-language label shows the native word
  on tap / hover. The first time, a one-line hint explains it.
- **The adult can set it**: the tutor (per student) or the teacher (per
  class) chooses "automatic / always native / as much as possible". The
  child can step one level back in the profile.
- **How**: games already have `?lang=` and i18n tables with `en`/`es`. A
  small shared helper (`krabsy-immersion.js`) decides per string group which
  language to use, and the games ask it instead of using the page language
  for buttons. This is a game-contract addition, done game by game.

---

## 4. How it all feeds the tutor

| Student side | Tutor side |
|---|---|
| Practice session answers (choice / typed, `mode`) | Skill map stars, weekly answers in the parents' report |
| Homework done in step 2 | Homework progress bar |
| Vocabulary from personal lists | Words known / still weak per list |
| Immersion level | Shown on the student profile; tutor can change it |
| Practice days / streak | "Practised on 5 of the last 7 days" in the report |

---

## P1 as built (2026-11-27)

- **Pages** `/de/ueben/`, `/es/practicar/`, `/en/spanish/practise/` (EN noindex like all of
  /en/spanish/; DE/ES in the sitemap with hreflang, `krabsy-lang-switch.js` PARALLEL). Static
  head + header/footer like the profile page; the session is `lib/krabsy-practice.js` + `.css`.
- **The child's topics** = topics of the section (topics.json has a URL in the page language,
  quiz shape) answered at least once (`krabsy_stats_v2`) + homework topics + the starter topic
  (`irregular_verbs` on /de/ and /es/, `es_ser` on /en/spanish/).
- **Step 1, warm-up:** 8 questions (`getQuizSet({ topic, count, smart: true, lang })`, chain
  order kept) split over the up to 3 topics with the most due items (mastery < 3, or known and
  past its repeat gap from `krabsy-smart.js`), at least 2 each, one block per topic. Nothing due
  (new child) → 8 from the starter topic. Choice chips (keys 1–3), Sprint look.
- **Step 2, one topic:** `?topic=` (student page) → the newest unfinished homework of this
  section (`GET /api/tutor/me` with the active person's / class session's token, 4 s timeout,
  skipped without a token; class pupils get 404 and skip) → the weakest topic (largest share of
  answered items with mastery < 3, at least 2 such items) → the topic not practised for the
  longest (never answered = oldest). ~5 questions (a verb pair may make it 6), items from step 1
  left out when enough remain; homework `difficulty` filters sentence topics. An item never
  answered before shows a teach card first (the full sentence / `go → went → gone`, plus the
  teach note on sentence topics), then is asked. **Typed first** (`checkTyped`), "Lieber
  auswählen" switches that question to chips; Spanish topics get á é í ó ú ñ keys. Own decision:
  a typed answer that only misses an accent counts as right and shows "Richtig! Mit Akzent:
  está" (children type on keyboards without accents).
- **Every answer:** `recordAttempt(item, form, correct, 'practice', topic, 'choice'|'typed')`.
- **Counts** when steps 1 and 2 are done (`addSession()` before the reward screen).
- **Step 3, play:** up to 3 games of `games.json` with the topic, not `audience: "teacher"`,
  `ui_langs` incl. the page language, linking to `<section games>/<id>/?topic=…` (homework adds
  `difficulty`, `lang` = homework game language, `from=teacher`). The list starts at a different
  game each session (total sessions mod n). Prepositions have only Verb Towers → 1 tile.
- **Weekly ring** `lib/krabsy-practice-week.js`: `localStorage krabsy_practice_v1 =
  { v, weeks: { "2026-W48": n }, total, last }` (ISO weeks in local time, last 12 kept; synced by
  `krabsy-sync.js`, conflict = this device wins). Any `[data-kp-ring]` element gets the ring and
  the text on import: "1 von 3 diese Woche" / "1 de 3 esta semana" / "1 of 3 this week", at 3
  "Woche geschafft ✓" / "Semana lograda ✓" / "Week done ✓", more: "… · 4×". No daily goal, no
  day counter, nothing is lost.
- **Entry points:** landing pages `/de/`, `/es/`, `/en/spanish/` (`.kp-go` under the "Mein
  Profil" button; phones: full width under the figure row; ≥ 1000 px: title on two lines);
  profile pages (head row, after the subtitle on phones); student page `/en/spanish/me/`
  ("Practise now", `?topic=` = the open homework; `krabsy-tutor.js`).
- **Checked headless** (390×844 touch, 1024×768 touch, 1366×768; DE/ES/EN; 0 console errors):
  new child (verbs only), verbs + prepositions answered (step 2 = prepositions "Das übst du
  noch"), /en/spanish/ with `es_ser`, homework (API mocked: student page → es_tener, "Homework
  from Nora", game links with difficulty/from=teacher), sessions 1–4 → ring 1/3, 2/3, "Woche
  geschafft ✓", "· 4×"; Monday of the next ISO week → 0 von 3 (Sunday still counts); typed
  answers right and wrong; keyboard only (Tab to start, 1–3, Enter); language switch DE ↔ ES.
- **Open:** real devices; Spanish wording by a native speaker; a real homework from the API;
  the gift card can appear mid-session (existing behaviour of the gifts module).

## Phases

| Phase | What | Size |
|---|---|---|
| **P1** | Practice session: "Jetzt üben" button + session (warm-up, new/weak, game), weekly ring (3 a week) on landing and profile, homework first. DE/ES/EN. | 1–2 sessions |
| **P2** | Vocabulary format + 4–6 core lists per learning language, three question shapes through `getQuizSet`, 🔊 pronunciation. | 1–2 sessions + content work |
| **P3** | Personal word lists per student (tutor) and per class (teacher), API + student side; AI list generator later with the task generator. | 1–2 sessions |
| **P4** | Gradual interface language: `krabsy-immersion.js`, levels, tap to translate, the adult's setting; then game by game. | 1 session + per game |

Typed answers in games (`recordAttempt(…, 'typed')`) should be added along the
way: the practice session's step 2 first, then games that already have a
typewriter mode.

## Open decisions (owner)

1. **Decided 2026-11-27: no daily goal.** 3 sessions a week; a setting per student/class later. (Was: daily goal size?)
   Recommendation: 3 steps now, a setting later if tutors ask.
2. **Where the button lives:** landing page next to the figure + profile.
   Also in the header on every page? Recommendation: landing + profile
   first.
3. **Vocabulary first for which section:** English for DE/ES speakers
   (most traffic) or Spanish for EN speakers (Nora's students)?
   Recommendation: both get 4 core lists; Nora tests the personal lists.
4. **Immersion default:** automatic (driven by progress) or off until an
   adult switches it on? Recommendation: automatic but slow, starting at
   level 1 only after clear progress; teachers can switch it off per class.
5. **Who writes the core word lists:** curated by hand (us + Nora for
   Spanish), with AI help for the drafts, checked by a native speaker.

## Guard rails

- No account for children; nothing new is required to start.
- No comparison between children (no leaderboards, also not per class on
  the student side).
- No dark patterns: no streak-loss guilt, no day counter on screen, no countdowns, no "only today".
- Privacy: word lists and immersion settings are learning data like the
  answers; the same storage, retention and privacy-page rules as classes
  and tutor students.
