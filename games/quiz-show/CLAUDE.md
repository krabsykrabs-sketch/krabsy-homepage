# Krabsy Quiz Show — game brief

You are the **game session** for the Krabsy Quiz Show on **Krabsy**
(krabsy.com): a free browser site where German- and Spanish-speaking kids
(about 10–14) practise English irregular verbs and prepositions. Read the
repo-root `CLAUDE.md` once for the site rules, then work only in this
folder. The master session releases games (wrapper pages, `games.json`,
sitemap, deploy, the teacher pages). You don't touch `homepage/` or other
games, and you don't push or deploy. Stage only this folder, in the same
command that commits: `git add games/quiz-show && git commit …`.

Status: **brief written 2026-11-22 on the owner's request, nothing built yet.**

## Why this game

The owner wants games that copy a **proven format**. Classroom quiz shows
(Kahoot, and TV shows like Who Wants to Be a Millionaire) are among the
best-known things teachers already use. We copy the **format only**: our
own name, our own studio and look, no logos, names, music or show
elements from those products.

**Teachers are Krabsy's main channel** (see `docs/classroom-concept.md`: the
first organic class came from Uruguay via Bing). Every other game is built for one child
at one device; this is the first one built for **a whole class in front of
one projector**. It's the thing a teacher can start in the first or last
10 minutes of a lesson.

## The game

A bright 3D TV studio (KayKit Furniture Bits + stage lights, built from
primitives). A host stands in the middle, 2–4 team podiums stand in a
row, a big screen behind them shows the question. The class plays in
teams; the teacher (or one child) runs the laptop.

### Setup screen (teacher)

- **Topic:** irregular verbs or prepositions (both work with the
  question engine's `quiz` shape). Later: the class word list from the
  classroom concept.
- **Teams:** 2, 3 or 4, with a colour and an editable name each
  (default: Teal, Coral, Amber, Purple). A solo mode (one player against
  three computer contestants) is for home use.
- **Length:** short (about 10 minutes, 12 questions), normal (about 20
  minutes, 20), long (30).
- **Timer:** on (20 s per question, the default) or off. The time limit
  is the teacher's choice, and it's generous because the whole class reads
  the question together.
- Language of the interface DE/ES/EN (`?lang=`); the questions stay
  English.

### Rounds (one show)

1. **Round 1 — "Everyone answers".** Each question goes to all teams. The
   question is on the big screen (`go → ___ → ___`, the asked blank
   highlighted), four big answer boxes A–D in four colours. Each team
   picks one letter and enters it in turn (the teacher taps the team's
   podium, then the letter; or keys: team 1 = 1–4, team 2 = Q W E R …).
   Then the reveal: drum roll, the right box lights up, points fly to the
   teams that had it. Faster = more points only when the timer is on.
2. **Round 2 — "Buzzer".** One question at a time, and the first team to
   buzz answers (keys: team 1 = A, team 2 = L, team 3 = V, team 4 = P;
   on a touch screen, a big buzzer per podium). Right = points; wrong =
   the other teams may buzz. This is the loud, exciting round.
3. **Final — "Bet your points".** Before the last 3 questions, each team
   bets part of its points (slider), then answers. Right doubles the bet,
   wrong loses it. Comebacks are possible.

After each round a ranking with podium heights and confetti. At the end
the winners' podium, applause, and the **review screen for the teacher:
the 5 words the class missed most** (`go → went → gone`, all forms shown
now), so the teacher knows what to repeat.

### Rules from the site

- **No grammar terminology** in the questions: positional notation
  `go → ___ → ___` or a sentence gap (`My birthday is ___ July.`).
- **Chain order** (verbs): the 3rd form only directly after the 2nd, with
  the 2nd filled in (`go → went → ___`). In round 1 both are a pair of
  questions in a row; in the buzzer round the pair goes to the team that
  won the 2nd form.
- **After every question a short teach beat** (the chain as far as it
  may be shown), so the class learns, not only scores.
- Readable on a projector from the back row: very large text, strong
  contrast, nothing important in small type. Test at 1280×720 and on a
  dim projector (washed-out colours).

## Assets

The shared KayKit library is at `/home/janah/dev/krabsy-homepage/assets/`
(gitignored, CC0; some packs are symlinks into `/home/janah/dev/_assets/kaykit/`).
Copy only what you use into `games/quiz-show/assets/`.

- **`KayKit_Furniture_Bits_1.0_SOURCE`** — desks (podiums), monitors,
  lamps, rugs, shelves, couches for the studio set.
- **`KayKit_Mystery_Monthly_Series_5`** — the host (Protagonists, or the
  Superhero as a show host) and one character per team on its podium,
  with cheer and sad animations (the pack's `Animations` folder).
- Stage lights, the big screen and the floor are simple primitives with
  emissive colours; confetti as particles.
- Team colours from the site palette: teal `#2ee6c0`, coral `#ff8585`,
  amber `#ffcf5e`, plus one purple.

## Technical direction

- Plain ES modules, Three.js vendored (copy `vendor/three/` from Verb
  Dungeon, 0.169), no CDN, no build step. Dev server: `python3
  tools/serve.py` (no cache), this folder's port is **8142**.
- The 3D scene is the backdrop; **the question and answer boxes are HTML
  over the canvas**, so text stays sharp on any projector. Camera: a
  fixed wide shot, with short camera moves to a podium only between
  questions (TV feel, never while the class reads).
- **Questions:** from `homepage/lib/krabsy-questions.js`, `getQuizSet`
  with `withOptions` (4 options here; ask for 4 or add one distractor)
  and the default chain order. Inline fallback lists for verbs and
  prepositions (copy from Verb Dungeon's `src/questions.js` +
  `src/verbs.js`, and a few prepositions from `content/prepositions.json`).
- **Interface texts EN/DE/ES** (`src/i18n.js` like the Dungeon).
- **Analytics:** call `recordAttempt()` for every team answer (it feeds
  the classroom stats), and send game events via
  `/lib/krabsy-game-events.js` (spec in `docs/game-analytics.md`:
  `show_start` with teams, topic, length, timer; `round_end`;
  `show_end` with question count and % right).
- WebAudio synth for the show sounds: a short jingle, drum roll, right
  and wrong stings, buzzer, applause, ticking clock in the last 5 s.
- **Fullscreen button** and keyboard-first control (the teacher is at a
  laptop); everything must also work with a mouse alone.

### Later: children on their own devices (not in version 1)

Version 1 is **one screen, no server, no accounts**. The bigger version
(every child joins on a Chromebook or phone with a class code, the
projector shows the live ranking) is **phase 4, "live mode on the
projector", of `docs/classroom-concept.md`**. It needs a live server
connection in `api/` and the class codes from phase 2, so it's built
there, by the master session, after the classroom phases. Keep the show
logic (rounds, scoring, reveal) separate from the input (`src/input.js`:
who answered what), so a network input can replace the keyboard later.

## Open questions for the owner

- Name: "Krabsy Quiz Show" or something else (DE/ES names too)?
- Is the buzzer round OK on one keyboard, or too chaotic in a real class?
- Should the show also appear on the teacher pages (`/de/lehrkraefte/`,
  `/es/docentes/`) as the featured "for your lesson" game? (Master
  session's job at release.)

## Log

- 2026-11-22: brief written by the master session (owner: "something like
  Kahoot / a quiz show").
