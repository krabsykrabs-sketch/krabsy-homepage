# Duo games: tutor and student play together (concept, 2026-11-27)

Written with the owner on 2026-11-27. Builds on `docs/tutor-platform.md`,
`docs/live-classroom.md` (the live lesson relay) and `docs/game-contract.md`
(games play any topic, the player's figure).

## The idea

In a tutor lesson the call (Zoom, Meet) carries face and voice, and Krabsy is
the shared workspace (live lesson). **Duo games** let tutor and student play
one game together inside that lesson: **co-op** games where they need each
other, and **competition** games where they race.

**Learning first.** A tutor's time is expensive for the parents. A duo game
must teach at least as much as a worksheet of the same length; the game is
the reason to keep going, not the content. So:

- **Every interaction is a question.** Pressing a button, turning a switch,
  opening a door, activating a portal, defeating a monster: each needs a
  grammar answer. No free switches.
- **Most questions go to the student.** Roughly 3 out of 4. The tutor's
  questions are there for fairness and fun (and can be harder), and they
  never count for anybody's skill map.
- **High density.** Target: a question at least every 20–30 seconds of play,
  shown to the tutor after the game ("38 answers in 12 minutes, 81 %
  right").
- **The tutor teaches during play.** After a wrong answer the game pauses
  that object and shows the teach line on both screens; the tutor can
  explain over the call, give a hint (highlight a word, first letter) or let
  the student try again. The tutor never just gives the answer by pressing.
- **The lesson's topic.** The game plays the topic the tutor chose for the
  lesson (`?topic=`, `getQuizSet`), at the student's level.
- **Short.** Levels of 3–5 minutes, so a game fits in the last 10–15
  minutes of a lesson.

## Two kinds of pairs (owner 2026-11-27)

Duo games work for **tutor + student** and for **two students** (siblings,
friends at home), so children can also make progress without a tutor.

| | Tutor + student | Two students |
|---|---|---|
| Where | in the live lesson (tutor clicks "Play together") | at home, from the game's page |
| Devices | two devices over the live-lesson relay | **one device** (shared keyboard: WASD / arrows; on a tablet two touch zones) **or two devices** with a short room code / link (like the Quiz-Raum join), no accounts |
| Questions | ~3 of 4 to the student | **shared fairly**: each player answers at their own objects; roles swap every level, so both do the puzzle role |
| Level of questions | the student's level | **each player at their own level** (own smart mix), so an older and a younger sibling can play together |
| What counts | only the student's answers | **each player's answers count for that player**: on two devices simply each device; on one device for the active person and the second player's chosen person (`krabsy_people`, "Who's playing?"), else only the active person |
| Topic | the lesson's topic | chosen together on the start screen (or a teacher/tutor homework link) |
| After the game | summary into the lesson note | a short "you two answered 41 questions" card; each child's answers go to their own profile and, if linked, their tutor/class |

Rules that stay for both: every interaction is a question, wrong answers teach
and never cost lives, a question every 20–30 s.

## First game: a co-op puzzle platformer

Inspired by the **genre** of 1990s co-op puzzle platformers (several
characters with different abilities who only get through a level together),
built new from scratch: own name, own characters (the players' figures),
own levels, own look. Not a remake of any existing game.

### Look and engine

- **2D gameplay, 3D engine:** a side view (2.5D) on the Verb Platformer engine
  (three.js, KayKit pieces, figures, touch controls, answer gates). Movement
  only left/right and up/down; the camera follows both players or shows the
  whole room.
- **The players' own figures** (`loadPlayerFigure`), the tutor included.
  Abilities come from the role, not the figure.

### Roles (different abilities, neither gets through alone)

Two roles per level; the tutor picks or the level sets them. Example set:

| Role | Can | Typical use |
|---|---|---|
| **Climber** (student) | jump high, climb ladders and ropes, squeeze through small gaps | reaches the switches, levers and portals |
| **Strong one** (tutor) | push and carry boxes, hold a heavy door or a platform, shield against monsters | builds the way, protects the climber |

More roles later (e.g. a role that can swim, one that can glide). The student's
role always has **more of the puzzle objects** in reach, so most questions go
to the student by the level design itself.

### What needs an answer

| Object | Who answers | Wrong answer |
|---|---|---|
| Switch, lever, button | the one who uses it | it stays off; teach line on both screens; try again or a new question |
| Door, gate, portal | the one who opens it | stays closed; teach line |
| Monster | the one it attacks (each hit is a question; a shield from the strong one gives time) | the player is pushed back, no lives lost |
| Bridge / moving platform | the student (builds it) | half a bridge, try again |
| Key or item | the student (picks it up) | it hops away a bit |

No game over: a wrong answer costs time, never the level. A room is solved
when both reach the exit.

### Talking in the learning language (optional per level)

Some rooms are **guide rooms**: only one player sees the hidden path or the
right lever ("the key is *under* the table"). The other must follow the
spoken directions over the call. Natural for prepositions and vocabulary;
counts as speaking practice in the tutor's lesson note.

### Levels

- 3–4 levels to start, 3–5 rooms each, rising slowly: first switches and
  doors, then boxes and timing, then monsters, then a guide room.
- Built in the world-designer or as level files like the Verb Platformer.

## Competition games (second step)

- **Answer race:** both race the same track; each right answer is a dash or a
  jump over the next obstacle. **Fair by design:** the tutor gets harder
  questions or a short delay, so a child can honestly win.
- **Turn-based first**, so a slow connection never decides who wins.
- Same density rule: answers drive everything.

## How it connects

- **Through the live lesson** (`api/live.py`, `docs/live-classroom.md`): the
  tutor clicks "Play together" in the live lesson; the student's screen
  switches to the game, like any lesson material. No extra code to type.
- **Network:** small messages only (positions ~10×/s, inputs, answers,
  object states), the same relay as the live lesson. The **tutor's browser
  is the host** of the game state (doors, boxes, monsters); the student's
  browser sends inputs and answers. A few hundred ms of delay are fine for
  puzzles.
- **Answers:** the student's answers go through `recordAttempt(…, topic,
  mode)` into the skill map as usual; the tutor's answers are not recorded.
- **After the game:** a summary on the tutor's screen (answers, % right, the
  words that went wrong) that goes into the lesson note with one click.

## Rules for every duo game (addition to `docs/game-contract.md` later)

1. Every interaction is a question; ~3 of 4 questions to the student.
2. A question every 20–30 s of play at least; the game reports the density.
3. Wrong answers teach (teach line on both screens), never punish with lives.
4. Only the student's answers are recorded.
5. Plays any topic (`getQuizSet`), at the student's level; no grammar terms as
   the question.
6. Both players use their own figure.
7. Runs over the live-lesson relay; tutor's browser hosts.
8. Works with keyboard and touch; the tutor's window may be narrow (beside
   the call).

## Phases

| Phase | What |
|---|---|
| **D1** | Prototype on the Verb Platformer engine, **local only** (= already the two-siblings-on-one-device mode): side view, two roles on one keyboard (WASD / arrows), switches, doors, boxes, answer cards, one level of 3 rooms. Proves the fun and the question density. |
| **D2** | Online: through the live-lesson relay (tutor hosts, student joins from the lesson; summary into the lesson note) and with a room code for two students on two devices; both figures. |
| **D3** | 3–4 levels, monsters with shield, guide rooms; DE/ES/EN. |
| **D4** | First competition game (answer race, turn-based). |

## Open decisions (owner)

1. ~~Who plays~~ **Decided 2026-11-27:** tutor + student **and** two students
   (siblings / friends at home, one device or two).
2. **Name** of the co-op game (Krabsy style, short, English words a learner
   knows).
3. **Should the tutor answer questions at all?** Recommendation: yes, a few
   (1 in 4), harder ones, so the student sees the tutor play too; or a
   setting "only the student answers".
