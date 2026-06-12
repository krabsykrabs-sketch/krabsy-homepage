# Verb Dungeon — proof-of-concept brief

You are building a new game for **Krabsy** (krabsy.com), a browser-based
English-grammar learning site for German- and Spanish-speaking school kids
(roughly ages 10–14). The site has a catalogue of arcade games that drill
irregular verbs (Verb Slash, Verb Snake, Air Control, a 3D Verb
Platformer). This folder is yours; the brief below is everything you need.
You do not have — and do not need — access to the rest of the repo except
the two read-only references listed under **Data**.

## The game in one paragraph

**Verb Dungeon** is a 3D dungeon crawler with a goofy-spooky tone
(Luigi's-Mansion energy, not horror). The player explores a torch-lit
dungeon as a small brave hero. **Grammar is the key system**: doors and
treasure chests are locked by irregular-verb challenges (pick the right
*simple past* / *past participle* to open). Combat exists but is simple
and readable — goofy skeletons block paths, get bonked with one button,
collapse into a tidy pile of bones, and sheepishly reassemble later. No
blood, no death language ("bonked!", "scared away!" — never "killed").
The long-term plan is a roguelite (hand-authored room templates +
procedural assembly), but **that is not this task**.

## This task: a proof of concept

One single, hand-crafted level — but NOT a simple one. The level's job is
to showcase what is possible **without any asset packs**: if this PoC
convinces, a real 3D asset pack (KayKit Dungeon) gets bought and the full
game gets built. So the PoC optimizes for two things:

1. **Atmosphere & spectacle** — the dungeon must feel like a *place*.
   Flickering torchlight, drifting dust motes, fog, glowing runes, a
   chasm crossed on a narrow bridge, a treasure vault that glitters.
   All geometry procedural: Three.js primitives, composed groups,
   BufferGeometry, vertex colors, procedural canvas textures, emissive
   materials. Characters are charming primitive-rigs (grouped
   boxes/spheres/capsules) animated in code — squash-and-stretch,
   springy bounces, exaggerated anticipation. Charm over fidelity.
2. **The grammar-gate loop** — proving that "answer a verb challenge to
   unlock the door/chest" is satisfying in 3D.

### Non-goals (explicitly out of scope)

- No procedural level generation, no roguelite meta — one authored level.
- No external assets of any kind (no GLTF, no images, no audio files).
  Sound = WebAudio synth only.
- No localization plumbing — game UI is English (site convention).
- No integration with the site (no wrapper pages, no catalogue entry) —
  the master session handles release later. The game just needs to run
  standalone.

## Tone guardrails (non-negotiable)

- Skeletons are mischievous, not menacing: oversized heads, rattly
  walks, surprised expressions; defeated = bones collapse into a neat
  pile with a xylophone rattle, then reassemble after ~20s with a
  sheepish shrug.
- No blood, gore, screams, or kill/die vocabulary anywhere (UI, code
  comments are fine).
- Spooky is fine; scary is not. Think candy-colored ghosts, cobwebs,
  wobbly torches — a dungeon a 10-year-old grins at.
- A defeated PLAYER just gets dizzy stars and restarts at the room
  entrance ("Ouch! Try again!").

## Core loop spec

- **Camera/controls:** third-person follow camera. Desktop-first:
  WASD/arrows to move, Space (or click) to bonk. Touch support is a
  nice-to-have, not required for the PoC.
- **Movement feel matters more than feature count.** Acceleration,
  turning lean, a little hop over small steps, dust puffs on landing.
- **Verb gates (doors & chests):** approaching one shows the verb chain
  with a gap — e.g. door shows `GO → ? → GONE`, three floating stone
  word-plates nearby read `went / goed / wented`. Walk into (or click)
  the right plate → door rumbles open, plates shatter into sparkles.
  Wrong plate → comic "bzzt", the plate wobbles, a friendly toast shows
  the full chain (`go → went → gone`), then a fresh challenge appears.
  Mix which slot is blanked (sometimes past, sometimes participle).
- **Skeletons:** patrol or guard; touching one costs a heart (3 hearts,
  refill at room entry); bonking takes 1–2 hits. They should be a
  rhythm-break between grammar gates, not the focus.
- **Treasure:** chests gated like doors but with a harder verb; opening
  showers coins (score). A final vault = the level goal.
- **Progress feedback:** score, hearts, and a "verbs mastered" counter
  in a clean HUD; a win screen recapping the verb chains encountered
  (this recap doubles as the learning review).

## The showcase level (sketch — you have creative freedom)

Aim for ~6–8 connected spaces, each demonstrating something different.
A possible flow (rearrange freely):

1. **Entrance hall** — big doors close behind you, title moment, torches
   ignite one by one down the hall (scripted lighting beat).
2. **Corridor with patrolling skeleton** — teach the bonk.
3. **First verb door** — teach the gate loop on an easy verb (go/see/eat).
4. **The chasm** — narrow bridge, fog below, falling = respawn at the
   bridge start with dizzy stars. Drama for free.
5. **Ambush room** — door slams, 3 skeletons clatter out of floor
   hatches, bonk-fest, then a verb door out.
6. **Rune puzzle room** — three verb doors, only the correctly-formed
   one opens; the wrong ones reveal a brick wall + comic trombone.
7. **Treasure vault** — golden glow, particle glitter, the final chest
   with a 2-blank challenge (`THINK → ? → ?`).
8. **Exit / win** — confetti, chain recap, score.

A "wow budget" worth spending effort on: the torch-lighting beat in
room 1, the chasm fog, and the vault glitter. Three moments people
remember > eight uniform rooms.

## Tech conventions (match the rest of Krabsy)

- **Stack:** Three.js **0.169** via CDN import map, exactly like the
  existing 3D game:
  ```html
  <script type="importmap">
  { "imports": {
      "three": "https://unpkg.com/three@0.169.0/build/three.module.js",
      "three/addons/": "https://unpkg.com/three@0.169.0/examples/jsm/" } }
  </script>
  ```
  Plain ES modules, **no build step, no npm, no TypeScript**.
- **Files:** `index.html` + `src/*.js` modules (game.js, level.js,
  player.js, skeletons.js, gates.js, fx.js, ui.js, audio.js, verbs.js —
  shape it as you see fit, keep modules focused).
- **Look & feel:** Krabsy house style for all UI — palette teal
  `#2ee6c0`, coral `#ff8585`, amber `#ffcf5e` on deep navy `#0d2240`;
  fonts Fredoka One (display) + Nunito (body) via Google Fonts; rounded
  chips/buttons; start screen with emoji mascot + how-to rows + a big
  primary button; the form-color convention used site-wide is
  **base=amber, past=teal, participle=coral** — use it on word plates.
- **Audio:** WebAudio synth only (oscillators/noise): torch crackle,
  xylophone bone-rattle, door rumble, sparkle arpeggio, sad trombone.
  Mute toggle persisted in localStorage (`krabsy_vdungeon_sound`).
- **Performance:** target 60 fps on a mid laptop. At most ONE
  shadow-casting light (or fake blob shadows); merge static room
  geometry; reuse materials/geometries; cap particle counts; fog hides
  draw distance. Test with the tab's FPS meter, not vibes.
- **Persistence:** best score in `localStorage` (`krabsy_vdungeon_best`).

## Data

Canonical verb data lives at `../../content/irregular-verbs.json`
(155 verbs) — **read-only reference**. For the PoC, inline a curated
subset (~30–40 common verbs, e.g. go/see/eat/take/give/know/think/
buy/break/speak/…) directly in `src/verbs.js` with shape
`{v:'go', past:'went', pp:'gone'}`. Generate wrong options that are
plausible (regularized forms like "goed", cross-verb forms, swapped
past/pp) — the distractors are where the learning happens.

## Verification (do this, don't skip it)

- Serve the folder statically (`python3 -m http.server`) and verify in a
  real browser via the preview tools: screenshots of every room, the
  gate interaction, a full playthrough.
- Expose a QA hook (`window.__VD`) that can teleport the player, trigger
  gates, and read state — drive a full level run programmatically.
- Zero console errors; check FPS in at least one heavy scene.

## Definition of done

- A stranger can open `index.html` (served), play start→win in ~5–8
  minutes, and the level produces at least three "oh, nice" moments.
- The verb-gate loop has been play-verified: correct unlocks, wrong
  answers teach (full chain shown), challenges vary slot and verb.
- Tone check passes: nothing a cautious parent would flinch at.
- This file's **Status log** below is updated, work is committed (commits
  stay inside this folder).

## Assets (for the asset-using version — the PoC above is procedural)

The PoC was built asset-free on purpose. When you graduate it to a real
3D build with bought art, the **shared KayKit library** is on disk at
`/home/jan/krabsy-homepage/assets/` and **this session already has read
access to it** (granted via `.claude/settings.local.json` →
`permissions.additionalDirectories`; no flag needed). It is **read-only**:
copy what you wire into *this* folder — never modify the library, it's a
re-downloadable master shared by several games.

- Packs this game draws from (free tiers exist for all):
  `KayKit_Dungeon_Remastered/`, `KayKit_Skeletons/`,
  `KayKit_Adventurers/`, `KayKit_Fantasy_Weapons/`,
  `KayKit_Character_Animations/` (+ `KayKit_Forest_Nature/` for any
  overworld). Use the **GLTF/GLB** files (Three.js loads them natively),
  not the FBX/OBJ.
- Release path: the master session promotes the *used subset* into
  `homepage/games/verb-dungeon/assets/` (that copy IS tracked + deployed).
  Your working copy here stays gitignored.

## Question engine (site-wide, added 2026-06-12 by the master session)

The shared engine at `/lib/krabsy-questions.js` (served site root) is now
the standard question source — prefer it over inlining data when this
game is integrated/released (keep a small inline fallback for offline
dev). For this game use the **quiz** shape:
`getQuizSet({topic: topicFromUrl(), count, withOptions})` returns
presentation-ready records (`display`, `options`, `correctIndex`,
`accepts`, `teach`) and works for irregular verbs AND prepositions —
`?topic=` makes the game topic-agnostic for free.

**Presentation mandate (user decision): never require grammar
terminology.** Render the positional notation `go → ___ → ___` with the
asked blank highlighted (record.display gives you base/slots/askIndex),
or the sentence gap for prepositions — NOT "what is the simple past
of…". Terminology may appear only as a small caption or in the
after-answer teach beat. Typed input (validate with `checkTyped`) is a
welcome alternative to choice chips.

## Working agreements

- You own only `games/verb-dungeon/`. Don't modify anything outside it.
- Commit locally as you go; never push.
- Keep this CLAUDE.md current — it is the only memory between sessions.

## Status log

- 2026-06-10 — Brief written by the master session. Nothing built yet.
- 2026-06-10 — **PoC built and play-verified.** `index.html` + 9 modules in
  `src/` (game, level, player, skeletons, gates, fx, ui, audio, verbs, utils).
  Full level start→win: entrance hall (door-slam + torch-ignition beat with a
  cinematic intro camera), corridor with patrol skeleton, verb door 1 (easy
  pool), chasm with drifting fog + plank bridge (falling respawns at bridge
  start), side treasure chest (medium pool), 3-skeleton hatch ambush that
  unlocks verb door 2, rune-puzzle room (3 plaqued doors, wrong ones reveal a
  brick wall + sad trombone), gold treasure vault with glitter and a 2-blank
  final chest, win screen with chain recap + confetti. 42 inlined verbs in
  `src/verbs.js` (forms match `content/irregular-verbs.json`, e.g.
  get→got→got); distractors = regularized / swapped / cross-verb / mangled.
  - **Verified** in a served browser run driven through the `window.__VD` QA
    hook (`state/start/step/teleport/answer/solve/bonkAmbush/shot`): all 5
    gates, wrong-answer teach-toast + challenge reroll, both-slot blanking,
    ambush unlock chain, fall + defeat respawns, win recap, localStorage best.
    Zero console errors/warnings. Screenshots of every room in `_shots/`
    (gitignored).
  - **Perf:** every static prop is baked into one merged mesh per material →
    113 draw calls / ~12k tris; ~10 ms/frame on an Intel UHD 620 at 800×450
    in a *hidden* window (pessimistic), so the 60 fps mid-laptop target holds.
    9 point lights, no shadow maps (blob shadows), `FogExp2`.
  - **Camera:** third-person follow with a "crane-up" that checks tall-wall
    colliders and rises just enough to keep the hero visible past walls and
    door lintels; cinematic low reverse angle during the intro.
  - Known gaps: touch controls not implemented (desktop-first per brief); DOM
    overlays (start/win/HUD) verified via state + metrics, worth one eyeball
    pass in a visible browser; ambush skeletons reassemble harmless (no
    re-chase) once beaten — intentional.
  - Dev helper: `.claude/launch.json` serves this folder on :8123 for the
    preview tool.
