# Verb Climb — proof-of-concept brief

You are building a new game for **Krabsy** (krabsy.com), a browser-based
English-grammar learning site for German- and Spanish-speaking school kids
(roughly ages 10–14). The site has a catalogue of arcade games that drill
irregular verbs (Verb Slash, Verb Snake, Verb Flow, Air Control, a 3D
platformer). This folder is yours; the brief below is everything you need.
You do not have — and do not need — access to the rest of the repo except
the read-only reference listed under **Data**.

## The game in one paragraph

**Verb Climb** is a 2D side-view tower-climbing platformer (Super Mario
perspective: camera looks straight at a vertical plane, player moves on
that plane). The goal: climb as high as you can — and reach the summit —
by making **precise jumps between floating nonsense objects**: a grand
piano, a sleeping cat, a little house, a flower, a teapot, a sofa. The
objects have nothing to do with each other and their sizes are absurd
(a cat bigger than a house is fine). Each object type has a different
silhouette and standable surface, so every jump reads differently. Fall
short and you can tumble a long way back down — losing height is the
punishment (Jump King / Getting Over It energy, tuned kid-friendly).
**Grammar is the fuel**: jumping costs energy, and the only way to refill
energy is answering irregular-verb questions.

## The core loop (this is the design — build exactly this)

1. **Climb**: every jump costs energy. The energy bar has **8 segments**.
2. **Run dry**: at 0 energy you can still walk and answer questions, but
   you cannot jump — you're parked until you study. (Never hard-stuck.)
3. **Refuel = grammar**: press the study button (key `Q` / tap the 💡
   chip) at any time **while standing on an object**. The world freezes
   (no falling during study) and verb questions appear one at a time:
   *"simple past of GO?"* with three answer chips. Each correct answer
   fills **+1 segment**; a wrong answer fills nothing and shows the full
   chain (`go → went → gone`) as a teaching beat. Stop whenever you like
   — answer 4 for half a bar, grind all 8 for a full one — then resume
   climbing. This stop-when-you-want choice is the heart of the game:
   kids self-dose the studying because they want the fuel.
4. **Fall**: missing a jump means falling — sometimes one object down,
   sometimes ten. No damage, no death: height lost IS the cost.
5. **Summit**: an authored tower top (~120 m) with a celebrating crab 🦀
   and confetti. Track best height and summit time in localStorage.

## Movement spec (precision is the identity)

- **Standard jump**: variable height (release early = lower), full air
  control, costs ~⅓ of a segment. Tight, snappy, Mario-like.
- **Charge jump**: hold the jump key to charge (~0.7 s max), release for
  a much higher/longer leap, costs a full segment. This is the Jump
  King nod — risky, expensive, spectacular.
- **No double jump.** Precision only matters if commitment matters.
- **Feel checklist (non-negotiable)**: coyote time (~90 ms), jump
  buffering (~120 ms), squash-and-stretch on jump/land, dust puffs,
  capped fall speed, a brief "wobble" when you barely make a ledge.
  Get these right before building more tower.
- **Controls**: ←→/AD move, Space/W/↑ jump (hold to charge), Q for
  study mode. Touch: on-screen left/right + jump buttons and the 💡 chip
  (nice-to-have; desktop-first for the PoC).
- The playfield is a fixed-width vertical strip (~one screen wide) with
  soft walls; the camera follows the player up and down (Icy Tower
  style), with a height meter on the side.

## The objects (the visual hook)

- Platforms are **random everyday objects floating in the sky** — no
  logic, no theme, pure cheerful nonsense. Build ~20–25 types using
  **large emoji rendered on canvas** (🎹🐱🏠🌸🛋️🫖☂️📚🚲🪑🍩🛁🎸🦆…) at
  absurd, inconsistent scales, plus code-drawn accents (outline plate,
  soft shadow) so they read as solid objects, not stickers.
- **Each type gets a hand-authored collision profile** — this is what
  makes every jump different:
  - piano / sofa / bathtub → wide flat tops (rest stops)
  - house → sloped roof; you slide off unless you land the ridge
  - cat → gentle dome that wobbles when you land (the cat shifts!)
  - flower / umbrella tip → tiny one-tile perches for experts
  - donut → you can fall through the hole
  - duck → drifts slowly sideways (the only moving type; use sparingly)
- Collision is simple shapes under the hood (flat segments, slopes,
  small arcs) — authored per type, not pixel-perfect.

## Tower generation (your craft showcase)

- **Procedurally generated, guaranteed climbable.** Place objects with a
  reachability check against the actual jump physics (standard jump for
  the main path; charge-jump-only shortcuts allowed as optional risk).
  No unwinnable seeds, ever — validate at generation time.
- **Difficulty ramps with altitude**: low tower = big friendly flat
  objects and short gaps; high tower = smaller perches, wider gaps,
  slopes, the occasional drifting duck. The bottom 20 m must be
  near-impossible to fail (that's the tutorial).
- **Falls are survivable by design**: every ~25 m place a "rest shelf" —
  an extra-wide object (piano/sofa) spanning most of the strip that
  catches long falls. Painful, not devastating.
- A fixed seed plays identically; new game = new seed. Show the seed on
  the win screen for bragging rights.

## Questions (grammar content)

- Multiple choice, one at a time: prompt shows the base verb and asks
  for *simple past* or *past participle* (mix both); three chips, one
  correct. Distractors must be plausible: regularized forms ("goed",
  "knowed"), the other form of the same verb (past↔pp swapped), or a
  similar verb's form.
- Use the site-wide form-color convention on chips and the chain
  teaching toast: **base = amber, past = teal, participle = coral**.
- Difficulty can ramp gently with height (common verbs low, rarer ones
  high). Track which verbs the player missed; the summit/game-over
  screen recaps them (`know → knew → known`) as the learning review.

## Tone

Joyful, sunny, surreal — floating teapots in a bright sky, NOT a grim
endurance test. Falling should make a kid laugh ("the cat again!?"), not
rage-quit: comic "wheee" slide-whistle on long falls, the player
character dusts themselves off at the bottom. No fail state, no timer
pressure. The difficulty is honest (precision jumps) but the framing is
warm.

## Tech conventions (match the rest of Krabsy)

- **Single self-contained HTML file**: `krabsy-verb-climb.html` in this
  folder. Plain canvas 2D, vanilla JS, **zero external assets** (emoji +
  code-drawn art only), WebAudio synth for all sound. No build step, no
  npm, no TypeScript, no frameworks.
- **Look & feel:** Krabsy house style — palette teal `#2ee6c0`, coral
  `#ff8585`, amber `#ffcf5e`; for this game a bright sky gradient
  background (day at the bottom shading toward dusk/stars near the
  summit is a lovely free spectacle); fonts Fredoka One (display) +
  Nunito (body) via Google Fonts; rounded chips/buttons; start screen
  with emoji mascot, how-to rows, legend chips, and a big primary
  button; game-over/summit screens in the same style. (Other Krabsy
  games follow this pattern exactly — keep the family resemblance.)
- **Audio:** WebAudio synth only: jump blip, charge whine, landing thump,
  correct-answer arpeggio, wrong-answer "bzzt", slide-whistle fall,
  summit fanfare. Mute toggle persisted (`krabsy_vclimb_sound`).
- **Persistence:** `krabsy_vclimb_best` (best height in m),
  `krabsy_vclimb_summit` (best summit time, if reached).
- **Performance:** 60 fps on a mid laptop; cap particles; only render
  objects near the viewport.

## Verification (do this, don't skip it)

- Serve the folder statically (`python3 -m http.server`) and verify in a
  real browser. **Known issue:** the interactive preview's screenshot
  tool can hang (suspended renderer). The proven workaround: take
  screenshots with **headless Edge** —
  `msedge --headless=new --disable-gpu --window-size=420,860
  --screenshot=out.png "http://localhost:PORT/krabsy-verb-climb.html?qa=scene"`
  — and support a few `?qa=` URL params that set up frozen, deterministic
  scenes (start screen, mid-climb, study mode open, summit) exactly for
  this purpose.
- Expose a QA hook (`window.__VC`) that can teleport the player, set
  energy, force questions, and read state — then drive a full loop
  programmatically: jump costs energy → run dry → study refill → climb.
- **Test the generator hard**: generate 200+ towers and assert the
  reachability invariant (every main-path gap clears with standard jump
  physics) — headless via node if you extract the generator, or in-page.
- Zero console errors; check FPS during a long fall (worst case).

## Definition of done

- A stranger can open the served file, understand the loop from the
  start screen alone, climb for 5 minutes, run out of energy, refuel via
  questions, and fall at least once without being stuck or confused.
- The feel checklist is implemented and tuned (coyote time, buffering,
  squash/stretch verified in play).
- Generator invariant proven (no unreachable towers).
- Tone check: falling is funny, studying feels like power, nothing
  punishes harder than lost height.
- This file's **Status log** below is updated; work is committed
  (commits stay inside this folder).

## Data

Canonical verb data lives at `../../content/irregular-verbs.json`
(155 verbs) — **read-only reference**. Inline a curated subset (~40
common verbs) directly in the game file with shape
`{v:'go', past:'went', pp:'gone'}`, ordered roughly by frequency so
difficulty can ramp with altitude.

## Working agreements

- You own only `games/verb-climb/`. Don't modify anything outside it.
- Commit locally as you go; never push.
- Keep this CLAUDE.md current — it is the only memory between sessions.

## Status log

- 2026-06-10 — Brief written by the master session. Nothing built yet.
