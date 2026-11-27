# Krabsy — platform vision (2026-11-24)

Written with the owner on 2026-11-24, triggered by a Spanish teacher
(Nora, 1:1 online lessons with children) who wants to use Krabsy for
**Spanish** grammar. This document is the direction for content, games
and teacher tools from here on.

## The one-line vision

**Krabsy: grammar practice that kids actually want to do, ready-made
and correct, and a teacher can start it in one minute, in class or 1:1.**

The games are the hook for the children. The teacher tools are what
spreads it: one teacher brings 20–200 kids, and teachers recommend tools
to each other.

## Where Krabsy stands among the alternatives

The real comparison is **Wordwall, Blooket, Kahoot, Educaplay**, the tools
teachers already use. They give teachers game templates, but the teacher
has to write the questions, and those questions are often wrong or boring.
Krabsy's difference:

1. **Curated content.** Complete, correct grammar topics with good wrong
   answers and short teach notes, sorted by level. That's what teachers
   don't have time to write.
2. **Better games.** Real game mechanics (3D, arcade) instead of quiz
   templates.
3. **No friction.** Free, no accounts for kids, runs in the browser,
   works in class, at home and over a Zoom call.

We don't become a "make your own quiz" tool. Teachers may edit and add
questions (the Quiz Room already allows this), but the product is the
curated catalogue.

## The four layers

| Layer | What it is | Status 2026-11-25 |
|---|---|---|
| **Content** | Topic catalogues per learning language, sorted by level (A1, A2 …) | English: irregular verbs (172), prepositions (99). Spanish: ser, estar, ser vs estar, tener (A1, waiting for Nora's check) |
| **Games** | Any game plays any topic | 4 of 8 released games (Verb Towers, Quiz Room, Verb Kitchen, Verb Platformer); rules in `docs/game-contract.md` |
| **Teacher tools** | Quiz Room, class page, stats, own question lists, sending a topic as a link | Mostly built; practice links done 2026-11-25 |
| **Languages** | Learning language × interface language | English × de/es; Spanish × en (`/en/spanish/`, noindex pilot) |

### 1. Content: one universal question format

Almost all school grammar fits **one question = a prompt with a gap + the
right answer + wrong choices + a teach note**: ser/estar, conjugation,
articles and gender, prepositions, tenses, gustar, single-gap word order,
vocabulary. Typed answers work on the same format (`checkTyped`,
alternates accepted).

The format needs these additions (next technical step):

- **Learning language** per topic (`en`, `es`, …).
- **Hints and teach notes per interface language.** The Spanish sentence
  stays the same; the hint (`Yo soy ___. (tall)`) and the explanation
  come in the interface language.
- **Level** (A1, A2 …) so topics can be sorted along a standard scale.

What it does **not** cover (later, only if teachers ask): several gaps in
one sentence, putting words in order, listening and speaking.

The quality work is the **wrong answers**: *soy / estoy / es* teaches
something, random wrong words don't. Every topic is checked by someone
who teaches it.

The presentation mandate stays: questions never require grammar terms.

### 2. Games: universal by default

- **Rule from now on: every new game takes the `quiz` shape**, meaning
  any topic in any learning language.
- The verb-form games (`chain` shape) stay as a few English specials.
  Convert old games one by one where it's cheap: Air Control and Verb
  Snake are candidates. (Verb Kitchen and the Platformer were converted
  on 2026-11-24 after all; Verb Flow stays a verb game.)
- **How a game does it: `docs/game-contract.md`** (topic and language from
  the URL, `lang` to the engine, gap display, per-topic texts, test URLs,
  registering in `games.json`).
- Games must not assume English in their own texts (fonts with ñ, á, ¿ ¡;
  room for longer Spanish words).

### 3. Teacher tools

Already there: Quiz Room (teacher page + children's page, own questions,
most-missed words), class page, stats. For 1:1 online lessons, the Quiz
Room already works: teacher on the teacher page, student in the room,
both on the Zoom call. A real two-player game (teacher and student
playing together) is a later wish, not part of the pilot.

### 4. Languages

The site becomes a matrix of **learning language × interface language**:

| Learning ↓ / Interface → | de | es | en |
|---|---|---|---|
| English | live | live | later (cheap once `ui_en` exists) |
| Spanish | later | later | **pilot** |

URLs keep both axes unambiguous, e.g. `/en/spanish/…` = Spanish content,
English interface. `/es/` keeps meaning "Spanish-speaking learners of
English".

**Teachers of another subject (proposal 2026-11-27, not decided):** one
teacher entry per interface language. `/de/lehrkraefte/` stays the single
page for German-speaking teachers and later gets a subject switch
(Englisch | Spanisch); the class code, practice links and quiz room already
work per topic, so a Spanish teacher uses the same tools. Only the
subject-specific material (lessons, worksheets) is filtered. The URL stays
(it is promoted on 4teachers).

## What this changes from the June strategy

`docs/strategy-2026-06.html` said "more topics, not more languages (yet)
— revisit when German organic traffic shows". Since then, teachers turned
out to be the main channel and Google sent almost nothing (Uruguay class
via Bing, 2026-11-12). A teacher asking for Spanish is the kind of demand
signal the June plan was waiting for, but from teachers, not from search.
The June warnings still hold: one person, a growing maintenance surface,
content before games.

## Tutors (added 2026-11-25)

Tutors (1:1 lessons, like Nora) are the first audience that pays: a Pro
toolbox for running lessons on Krabsy (student profiles with a skill map,
live lesson mode, tasks and worksheets, lesson builder, parent reports).
Kids keep playing free and teachers keep their tools free. Plan:
**`docs/tutor-platform.md`**.

## Guard rails

- **Expand by teacher demand**, in level order (A1 → A2), not "all
  grammar at once".
- **Content before games.** Twenty good topics in four universal games
  beat five topics in twelve games.
- **No ads, no login walls for kids, no selling data** (unchanged).

## Order of steps

1. ✅ **Question format v2** (done 2026-11-24): learning language,
   interface-language hints, level. Spec `content/FORMAT.md`; topic
   registry in `krabsy-data.js`; engine takes `lang`. Tested headless
   with a fixture topic; verbs, prepositions and drill pages unchanged.
   Not deployed yet (no visible change; goes out with step 3).
2. 🟡 (2026-11-24: `ui_en.json` + `/en/spanish/` pilot section, noindex) **English interface texts** (`data/ui_en.json`), first for the Quiz
   Room children's page and the drills.
3. 🟡 (built 2026-11-24, waiting for Nora's check + deploy; see STATUS.md)
   **Spanish pilot topic "ser"** (Nora's request): *ser* with *yo*, name,
   origin, descriptions (`Yo ___ Lucas.` → soy, `Soy ___ Inglaterra.`
   → de, `Yo soy ___. (tall)` → alto/alta). 30–40 questions in
   `content/`, checked by Nora. Runs in Quiz Room + drills. Direct link
   for Nora; no public page or SEO yet.
4. Nora tests it in her 1:1 lessons; we check the analytics.
5. Every new game is universal; convert old ones where cheap.
6. Grow Spanish topics by level as teachers ask (likely next: estar,
   ser vs estar, present tense, gustar, past tenses).

Open questions for Nora: include alto/alta (boy/girl forms) yet? the
children's ages and reading level? add *tú* early ("¿De dónde eres?")?
