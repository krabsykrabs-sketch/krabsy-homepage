# Krabsy Quiz Show — game brief

You are the **game session** for the Krabsy Quiz Show on **Krabsy**
(krabsy.com): a free browser site where German- and Spanish-speaking kids
(about 10–14) practise English irregular verbs and prepositions. Read the
repo-root `CLAUDE.md` once for the site rules, then work only in this
folder. The master session releases games (wrapper pages, `games.json`,
sitemap, deploy, the teacher pages). You don't touch `homepage/` or other
games, and you don't push or deploy. Stage only this folder, in the same
command that commits: `git add games/quiz-show && git commit …`.

Status: **version 1 playable (2026-11-22)**: all three rounds, 2–4 teams,
verbs + prepositions, DE/ES/EN, timer on/off, review screen. Tested only in
headless Chromium (`tools/qa.cjs`), **not yet played by a person or in a
class, not released**.

## How it's built (v1)

| File | Job |
|---|---|
| `index.html` | all CSS + the HTML overlays (setup, question card, boxes, labels, round cards, bets, standings, end) |
| `src/main.js` | screens and glue: renders `show.state`, sounds/effects on show events |
| `src/show.js` | the show logic, no DOM: rounds, scoring, bets, timer, reveal, missed-words list |
| `src/input.js` | keys / clicks → show actions (swap for a network input in phase 4) |
| `src/questions.js` | engine (`getQuizSet`, 4 options, chain order; easy verb tiers first) or inline fallback (`src/verbs.js`, `src/preps.js`) |
| `src/scene.js` | the 3D studio: podiums, characters, host, screen, lights, confetti, camera |
| `src/audio.js` | WebAudio synth sounds |
| `src/analytics.js` | game events + answer counts (no `recordAttempt`) |
| `src/i18n.js` | EN/DE/ES texts |

- Dev: `python3 tools/serve.py` (port 8142) also serves `/lib/` and `/data/`
  from `../../homepage/`, so dev uses the real question engine; `?offline=1`
  forces the inline lists. `?lang=` and `?topic=` work as on the site.
- QA: `node tools/qa.cjs "?lang=de" <outDir> 1280 720 <teams> <on|off>` plays a
  whole show by keys and saves a screenshot per stage. QA hook: `window.__qs`.
- Assets in `assets/`: 5 Mystery Monthly characters (teams: Protagonist A/B,
  Hiker, Witch; host: Superhero), the Rig_Medium animations, 8 Furniture
  Bits models (all CC0, licences copied alongside). About 3.7 MB, tracked.
- Mouse flow, round 1: click a team's label, then a box. A box click with no
  team chosen goes to the next team that hasn't answered (fast with A–D cards).
- The dev server sometimes logs `ERR_ABORTED` for a furniture `.bin` in
  headless Chromium; the studio still loads (no load error). Dev only.

## Next steps

1. **Play-test with a person** (owner), then in a class if possible: is the
   text readable from the back row, is the buzzer round OK on one keyboard?
2. Check on a real projector / dim screen (washed-out colours).
3. Touch screen: labels work as buzzers / team pickers, but nothing is
   tuned for an interactive whiteboard yet.
4. Release (master session): wrapper pages, `games.json` entry `quiz-show`,
   sitemap, teacher pages; game id for analytics is already `quiz-show`.

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
  (default: Teal, Coral, Amber, Purple). (A solo mode against computer
  contestants is **later**, not version 1: it needs its own rules for how
  often the computer answers right.)
- **Length** (round 1 + buzzer + final; round 1 and buzzer counts are even
  so verb pairs never straddle a round): short 6 + 4 + 3 = 13 questions
  (about 10 minutes), normal 10 + 8 + 3 = 21 (about 20), long 14 + 12 + 3 =
  29 (about 30).
- **Timer:** on (20 s per question, the default) or off. The time limit
  is the teacher's choice, and it's generous because the whole class reads
  the question together.
- Language of the interface DE/ES/EN: `?lang=` → `localStorage
  krabsy_lang` → DE, like the other games; the questions stay English.

### Rounds (one show)

1. **Round 1 — "Everyone answers".** Each question goes to all teams. The
   question is on the big screen (`go → ___ → ___`, the asked blank
   highlighted), four big answer boxes A–D in four colours. Each team
   picks one letter and enters it (the teacher taps the team's podium,
   then the letter; or keys: team 1 = `1 2 3 4`, team 2 = `Q W E R`,
   team 3 = `A S D F`, team 4 = `Z X C V`). A team may change its letter
   until the reveal.
   **Entries are secret:** the screen shows only "Team ✓ locked in", never
   the letter, so later teams can't copy. (Variant for loud classes: every
   team holds up an A–D card at the same moment and the teacher types them
   in; same input, nothing extra to build.)
   The reveal comes when all teams are locked in, when the timer runs out,
   or when the teacher presses Enter: drum roll, the right box lights up,
   points fly to the teams that had it. **Right = 100 points, no speed
   bonus** (teams enter one after another, so speed would always punish
   the last team).
2. **Round 2 — "Buzzer".** One question at a time, and the first team to
   buzz answers (keys: team 1 = A, team 2 = L, team 3 = V, team 4 = P;
   on a touch screen, a big buzzer per podium). The buzzing team then
   answers on the boxes (click, or keys `1 2 3 4`; buzzer keys are dead
   until the answer is in). Right = 200 points; wrong = no points, that
   team is out for this question and the others may buzz again. Nobody
   left, or the timer runs out → reveal. This is the loud, exciting round.
3. **Final — "Bet your points".** 3 questions, each with its own bet:
   before the question is shown, every team sets its bet (slider, 0 up to
   its points; a team with fewer than 100 points may still bet up to 100
   so it can come back). Then all teams answer secretly as in round 1.
   Right = + the bet, wrong = − the bet (never below 0). For verbs the
   final asks single 2nd-form questions (`go → ___ → ___`), and the teach
   beat then shows the whole chain, as Verb Dungeon's chests do.

After each round a ranking with podium heights and confetti. At the end
the winners' podium, applause, and the **review screen for the teacher:
the 5 words the class missed most** (`go → went → gone`, all forms shown
now), so the teacher knows what to repeat.

### Rules from the site

- **No grammar terminology** in the questions: positional notation
  `go → ___ → ___` or a sentence gap (`My birthday is ___ July.`).
- **Chain order** (verbs): the 3rd form only directly after the 2nd, with
  the 2nd filled in (`go → went → ___`). In round 1 both are a pair of
  questions in a row; in the buzzer round the 3rd form goes to the team
  that won the 2nd form (if no team got the 2nd form right, the 3rd form
  is an open buzzer question again). After the 2nd-form answer, don't
  reveal the 3rd form.
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
  Superhero as a show host) and one character per team on its podium.
  ⚠ The pack's `Animations` (Rig_Medium General + MovementBasic) have **no
  cheer or sad clip**: only Idle, Hit, Death, Interact, PickUp, Throw,
  Use_Item, Jump, Run, Walk. Cheer = `Jump_Full_Short` (looped a few
  times, arms are fine), sad = `Hit_A` then a slumped `Idle_B`, plus small
  procedural moves (bob, turn to the screen). An alternative host is the
  BlobVideos hermit crab that Verb Valley uses for Professor Krabsy
  (already cheers and shakes its head).
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
- **Answers and stats:** **don't call `recordAttempt()`** (default,
  confirm with the owner). It writes to the learning stats of *that
  browser*; on a teacher's laptop or a shared classroom PC the whole
  class's answers would land in one device's personal stats and skew the
  smart mix for whoever plays there next. There are no classroom stats
  yet (that's phase 2 of `docs/classroom-concept.md`). Instead, post the
  same `{type:'krabsy:attempt', correct, source:'quiz-show'}` message that
  `krabsy-stats.js` `_announce()` sends, so the wrapper's answer counts
  still work. For the same reason the question set uses **no `smart`
  mix**. When classes exist, team answers go to the class instead.
  (General recipe for other games: `docs/phase1-game-wiring.md`.)
- **Game events** via `/lib/krabsy-game-events.js`, game id `quiz-show`,
  using the dashboard's standard names (`docs/game-analytics.md`): one
  "level" per round: `level_start {level: 1|2|3, teams, timer, length}`,
  `level_end {level, result: 'won', seconds, answers, correct}`, and
  `show_end {level: 3, teams, questions, pct}`. Team names are free text
  and are **never** sent, only the number of teams.
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
- Defaults chosen by the master session on 2026-11-22, to confirm: no
  `recordAttempt` / no smart mix on a class device; secret round-1 entry;
  no speed bonus in round 1; buzzer 200 / wrong = out for that question;
  final = one bet per question, minimum bet room 100; solo mode later.
- Should the show also appear on the teacher pages (`/de/lehrkraefte/`,
  `/es/docentes/`) as the featured "for your lesson" game? (Master
  session's job at release.)

## Log

- 2026-11-22: brief written by the master session (owner: "something like
  Kahoot / a quiz show").
- 2026-11-22: brief reviewed against the repo and fixed (animations don't
  include cheer/sad, recordAttempt on a class device, standard analytics
  names, secret entry, no round-1 speed bonus, missing buzzer/final rules,
  round split, key map, lang fallback, solo mode moved to later).
- 2026-11-22: version 1 built (same session, owner: "update the brief and
  then start building"): all rounds, setup, studio, sounds, i18n, analytics,
  review screen. Full shows pass in headless Chromium at 1280×720 and
  1024×768, with 2/3/4 teams, timer on/off, engine and offline lists, no
  console errors. Changes found while testing: the teach line sits under the
  question card and only shows when it adds something (full chain, or the
  preposition rule in the show's language); Next button is in the top bar;
  the camera push on a buzzer win is small so no podium leaves the frame.
