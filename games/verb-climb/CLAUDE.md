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
- 2026-06-10 — First build attempt **rejected by the owner** and replaced.
  Fatal design flaw: the playfield was a narrow ~420 px column, so platforms
  stacked into a "chimney shaft" — every jump was straight up, horizontal
  movement barely mattered, and a missed jump was instantly caught by the
  platform right below (falls were toothless). Lesson recorded for future
  sessions: **the strip must be wide and the path must zigzag with enforced
  horizontal clearance, or the whole risk economy collapses.**
- 2026-06-10 — **Rebuilt from scratch & verified.** `krabsy-verb-climb.html`
  (single file, ~38 KB, canvas 2D + WebAudio synth, no external assets beyond
  Google Fonts). Key design decisions of the rebuild:

  **Layout (the fix that matters)**
  - Wide 880 px logical strip, scaled to the screen (camera follows x too on
    narrow viewports).
  - The generator builds a **zigzag path**: each platform is placed with a
    REQUIRED edge-to-edge horizontal clearance from the previous one (clearance
    grows with altitude), in directional "legs" of 2–4 steps that fold back at
    the walls. Measured across 20 towers / 809 jumps: median horizontal offset
    between consecutive platforms ≈ 224 px (≈7 m), only 2.1 % of jumps under
    80 px (summit hop + wall fold-backs); 69 % of platforms have NOTHING within
    6 m directly below — falls find real air. Full-width cloud "rest shelves"
    every ~24 m cap the damage (max loss ≈ one shelf gap).
  - Walking off an edge at 60 m in testing fell 8 m before landing.

  **Mechanics**
  - 8-segment energy; standard jump ⅓, charge jump 1 full segment; at 0 you
    can walk + study but not jump; study (+Q / 💡 while grounded) gives +1 per
    correct answer; stop anytime.
  - Jump model: jump fires on key RELEASE; hold ≤0.18 s = standard (height
    scales with hold — release early = lower), holding past 0.18 s visibly
    enters charge mode (crab squats, ring fills ~0.6 s, charge whine) and
    locks walking — release launches a Jump-King-style aimed leap (hold ←/→
    to aim). Can't afford a charge → capped to max standard.
  - Coyote 90 ms, buffer 130 ms, squash/stretch, edge-landing wobble, dust,
    capped fall, "wheee/aaaah/not again!" + slide whistle past 8 m of falling,
    dizzy stars after big landings.
  - 25 emoji object types with authored collision: flat / slope (house, tent —
    slide off unless near ridge) / dome (cat + pig wobble) / hole (donut,
    lifebuoy) / drift (duck, bonus-only, never on the main path) / tiny
    perches; one-way platforms (pass from below, land from above).
  - Questions: past/participle MC, distractors = regularized form + swapped
    form + other verb's form; base amber / past teal / participle coral;
    missed verbs recapped on the summit card. 55 verbs inlined
    (frequency-ordered, canonical forms from `../../content/`), selection
    window widens with altitude.
  - Summit at 120 m: night sky + confetti + time + seed; "new tower" / "same
    tower" replay. Persistence: `krabsy_vclimb_best`, `krabsy_vclimb_summit`,
    `krabsy_vclimb_sound`.

  **Verification (all passed)**
  - Generator invariant: `?qa=gentest&n=300` → **PASS, 300 towers, 0
    unreachable gaps**. Validator `simJump` re-simulates every consecutive
    path pair with conservative margins (97 % jump power, 92 % air accel,
    bang-bang steering with braking) — if the sim makes it, a kid can.
  - Logic driven via `window.__VC` (incl. a RAF-independent `step(seconds)`
    so tests work in throttled background tabs): tap −⅓; held 0.5 s −1;
    1-segment budget = exactly 3 jumps then parked-not-stuck; broke + full
    hold = capped standard; study correct +1, wrong = chain toast + missed
    list + no refill; full dry→study→climb loop green.
  - Zero console errors. QA scenes: `?qa=start|low|scene|study|summit|gentest`,
    `?seed=N`. NOTE for future sessions: headless Edge (`--disable-gpu`)
    renders canvas emoji desaturated — screenshot artifact only; real-browser
    canvas emoji verified full-colour earlier (pixel-sampled 90–98 %
    saturation). Edge can't write screenshots to UNC paths — write to a local
    tmp dir and copy in.
  - `.claude/launch.json` serves this folder on :8139 for the preview tool.

  **Open items:** touch controls present but untested on a real device
  (desktop-first per brief); difficulty curve worth a human playtest pass
  (charge-jump tuning at high altitude). Ready for master-session review.
- 2026-06-10 — Second build **rejected by the owner** too. Diagnosis: the
  emoji objects were decoration behind thin platform lines (not the thing
  you climb), and the charge jump out-jumped the whole level (straight up
  past everything). Owner reference: **Gimkit's "Don't Look Down"** — climb
  up the BODIES of giant objects, several jumps per object.
- 2026-06-10 — **v3 rebuilt around solid giant objects & verified.**
  `krabsy-verb-climb.html` (~52 KB, same Krabsy single-file conventions).

  **Core redesign**
  - Objects ARE the terrain: each is a giant solid (6–14× the crab) with
    full side/top/bottom collision (AABB boxes + slope "roofs"), authored
    per type as climbing TIERS: cake = 3 tiers, snowman = 3 balls,
    books = 4 staggered steps, sofa = seat→armrest→backrest→lamp,
    giraffe = back→neck→head (glyph faces LEFT — boxes follow),
    house = porch→body→roof-slope→ridge-cap, moai = nose→brow→crown,
    bus/bath = bumper/faucet entries. 12 route types + tent (decor-only),
    cloud shelf / puff / summit deck as one-way utility platforms.
  - One object = 2–4 jumps. Charge jump capped: apex rise measured 208 px
    < shortest object (230 px) — it can cross gaps but NEVER skip an
    object. Air drag when gliding (release = soft brake) so kids can land
    on ledges without counter-steering.
  - Generator: chains objects side-by-side (zigzag legs), entry tier one
    std jump above the previous stand point; every link verified with a
    conservative full-collision sim (`simJumpEx` + `reach`: ≤3 chained
    jumps, landing at/above target height counts — intermediate landings
    are progress). Each new placement re-verifies all spatially-near links
    so later objects can't break earlier routes. Rest shelves every ~30 m.

  **Hard-won lessons (do not relearn)**
  - Utility platforms must be placed by their TOP surface, not base
    (the 42 px shelf height made links unreachable).
  - Full-width solid shelves block the jump from below — utility clouds
    must be one-way (no side block, no head bonk).
  - The validator's single greedy jump is too strict in a crowded world:
    landing on an overhanging neighbor ABOVE the target is progress, not
    failure (reach()'s at/above-height rule). Without it ~50 % of valid
    towers "fail".
  - A tier <30 px above the previous is decoration, not a climb link
    (the cat's tail is 4 px above its head — never chain it).
  - Pure-slope objects (tent) are sim-passable but miserable to recover
    on after landing on the slope; flat ridge caps on house help, tent
    pulled from the route pool entirely.
  - Glyph alignment: tune collider boxes against `?qa=gallery&debug=1`
    (3 pages via `&from=0|4|8`) — colliders red, surfaces green, roofs
    orange. Segoe UI Emoji is the reference font.

  **Verification (all passed)**
  - GENTEST: 40 towers in-page + 100 headless, 0 unreachable links.
  - **An auto-climber driving the real player physics (walk + jump +
    mid-air steering via `__VC.keys`/`step`) climbed an entire tower
    ground→summit in 37 jumps** — the summit screen triggered by actually
    landing on the deck. This is the test that caught the tent problem;
    keep using it.
  - Side collision (walking into an object stops you), head bonk,
    multi-tier cake climb (3 tiers with player physics), costs (⅓ std /
    1 charge / capped when broke / parked at 0), study (+1 correct,
    chain + missed-list on wrong) — all verified via `__VC`.
  - Zero console errors. QA: `?qa=low|scene|study|summit|gentest&n=|
    gallery&from=&debug=1`, `?seed=N`.

  **Open items:** human playtest for difficulty feel; touch on real
  device; maybe 2–3 more object types (train, elephant, whale as wide
  rest objects). Ready for master-session review.
- 2026-06-11 — v3 **rejected by the owner** as well: the crab stood on
  invisible boxes marked by white lines, so it still read and played as
  "platforms with emoji decoration behind them". Reference remains
  Gimkit "Don't Look Down": you climb the body of the object itself.
- 2026-06-11 — **v4 IN PROGRESS (uncommitted → committed as WIP): pixel
  heightfield terrain.** The collision IS the picture now:
  - At boot every emoji type renders once to an offscreen canvas
    (glyph bbox mapped exactly to its w×h via measureText actual-
    bounding-box; the SAME canvas is drawn in-game, so visuals and
    collision match pixel-for-pixel on every platform/font).
  - Per 2px column we store top/bottom opaque pixels → the crab stands
    on the silhouette's profile, is blocked by its sides (>~56° slope =
    wall), bonks its underside, slides on steep parts (>~40°).
    "Standable zones" (runs of walkable slope ≥40px wide) are derived
    automatically and become the generator's route waypoints — no more
    hand-authored boxes. 20 candidate types incl. train, whale,
    elephant, t-rex, castle; tofu/hollow glyphs auto-dropped.
  - Utility clouds (shelf/puff/deck) stay one-way code-drawn platforms.

  **v4 lessons already burned in (do not relearn):**
  - Pit-cap the profile: glyph notches (train chimney↔cab) deeper than
    a jump are hard-stuck traps — cap pit depth at 60 px below the rim
    ("water fill" with rimL/rimR minima).
  - reach()'s "landed at target height = progress" rule MUST also
    require horizontal nearness (±140 px of the target zone): an
    at-height landing across a canyon (train front bumper vs cab) is a
    dead end the old rule wrongly accepted.
  - Walking collision must ignore slabs that float entirely above the
    head (b < feet−height) — otherwise the crab freezes under any
    overhead object (this bug looked exactly like "can't walk").
  - Keep the spawn corridor (x 410–590 × y −190..10) free of objects or
    the crab can spawn buried inside a glyph.
  - Generation perf: filter sim worlds to objects within ±700 px of the
    link (28× speedup, 14 s → 0.5 s/tower); first call pays ~5 s JIT.
  - Landing acceptance: x-in-zone identifies the zone (heightmap is
    single-valued); y-tolerance must be loose (±60) or flank landings
    on curved zones (whale back) fail and generation crawls.

  **OPEN BUG (where work stopped):** the generator/validator sims
  launch from `sx = clamp(target.x into the source waypoint span)` —
  but that spot may be UNREACHABLE: the ground waypoint spans the whole
  strip, yet an object standing ON the ground (books) blocks walking
  past its left wall, while the sim happily "starts" at a column inside/
  beyond it and proves an entry the player can't actually approach.
  The auto-climber therefore fails at the very first link (can't walk
  under/over books#0 to reach its right-side entry zone at x 897).
  FIX DIRECTION: launch points must be constrained to the REACHABLE
  part of the source surface — e.g. clamp sx to the connected walkable
  interval around the previous landing point (walk the heightfield/
  ground left+right from the waypoint centre until blocked), and use
  that interval, not the full span. Then re-run: in-page gentest 40+,
  headless gentest 100+, and the auto-climber (window.__climb pattern
  in the transcripts; drive via __VC.keys/step/doJump) until it summits
  with real player physics, as it did for v3 (37 jumps).
  Also still pending after that: visual pass (gallery `?qa=gallery&
  from=0|4|8|12|16&debug=1` now draws the top/bottom profile polylines
  + green zone bars), scene/summit screenshots, console-error check,
  STATUS update, final commit.
