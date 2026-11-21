# Verb Dungeon — game brief

You are the **game session** for Verb Dungeon on **Krabsy** (krabsy.com): a
free browser site where German- and Spanish-speaking kids (about 10–14)
practise English irregular verbs. Read the repo-root `CLAUDE.md` once for
the site rules, then work only in this folder. The master session releases
games (wrapper pages, `games.json`, sitemap, deploy). You don't touch
`homepage/` or other games, and you don't push or deploy.

## Goal (owner decision 2026-11-21)

Turn the proof of concept into a **releasable 3D game at Verb Kitchen
quality**. Verb Kitchen (`games/verb-kitchen/`, live at
`/de/spiele/verb-kitchen/`) is the reference: a class in Uruguay played it
for up to 28 minutes and came back the next day, while the simple 2D games
lose people in 18–40 seconds. Study its code and `CLAUDE.md` before
designing anything. What makes it work:

- **Self-paced question moment** (the sink): the player decides when to
  think, so reading and action never collide.
- **Grammar drives progress:** no clean plates, no serving.
- **Fixed camera, simple controls:** the whole kitchen is visible; it
  plays on a Chromebook and a touch tablet.
- **Short levels with stars** (about 3 minutes), which fits a lesson.

## The game

A goofy-spooky dungeon crawler (Luigi's-Mansion mood, not horror). A small
hero walks through torch-lit rooms. **Doors and chests are locked by verb
questions**; goofy skeletons block the way and get bonked with one button.

## What exists (PoC from 2026-06-10, untouched since)

- `index.html` + `src/` (about 2,850 lines): game, level, player,
  skeletons, gates, fx, ui, audio, verbs, utils.
- One hand-built level with 8 spaces, played start to win in 5–8 minutes:
  entrance hall, corridor, verb door, chasm bridge, ambush room, rune
  room with three doors, treasure vault, win screen with chain recap.
- Everything is **procedural** (Three.js primitives, no models). Details
  are in the Status log at the bottom.
- QA hook `window.__VD` (teleport, answer, solve, step).

Known weaknesses of the PoC:
- Third-person **follow camera**. This is the main risk: camera trouble is
  what makes 3D games feel bad on school devices.
- **No touch controls.**
- Three.js and fonts come from **CDNs** (unpkg, Google Fonts).
- UI is **English only**.
- Verbs are inlined (42), not from the question engine.
- One long level, no level select, no stars.

## Direction for the full game (proposed by the master session)

The owner said yes to the game. He has **not** yet confirmed the points
below one by one. Your first task is to check them against the PoC and
come back with a short plan.

1. **Fixed camera per room**, angled top-down like Verb Kitchen. The whole
   room is on screen; the camera cuts or slides when you walk through a
   door. No camera controls. Keep the cinematic beats (torch lighting,
   vault) as short scripted shots.
2. **Short levels:** one level = a chain of 4–6 rooms, about 3–4 minutes,
   with 1–3 stars and a level select. Start with 3 levels plus a tutorial
   level that teaches by doing.
3. **Questions stay self-paced.** A locked door waits; nothing attacks
   while the question is open (or the world slows strongly, like Verb
   Kitchen's 30 % patience). Skeletons are the action between questions,
   never during them.
4. **Make grammar drive more than doors.** Ideas to weigh: chests give
   keys, hearts or a stronger bonk; a missed verb comes back at a later
   door in the same level (spaced repetition, as at the Kitchen sink);
   stars depend on first-try answers.
5. **Real models** from the shared library instead of primitives (see
   Assets). Keep the charm: squash and stretch, bone piles, sheepish
   skeletons.
6. **Touch:** virtual stick + one bonk button; answer plates are tappable.
7. Later, not now: procedural room assembly (roguelite), prepositions via
   `?topic=`.

Suggested milestones: M0 clean base (vendored Three.js, self-hosted fonts,
noindex meta) → M1 fixed room camera + room/level data format → M2 KayKit
dungeon, hero and animated skeletons → M3 verb loop on the question
engine, DE/ES UI → M4 tutorial, 3 levels, stars, touch → M5 polish, device
tests, size check, then "ready for review".

**First task:** play the PoC, read the code, then propose a short plan to
the owner (camera, level structure, how grammar drives progress, assets,
milestones). Get an OK before big rewrites.

## Assets: shared CC0 library

`/home/janah/dev/_assets/` (about 3.4 GB, all CC0; see its `README.md`).
It is read-only: copy only the files you use into this folder (e.g.
`assets/`) and list each pack in `assets/CREDITS.md`.

- `kaykit/KayKit_Dungeon_Pack_1.1_FREE`: walls, floors, doors, chests,
  torches, props. Note: this is the older free pack, not "Dungeon
  Remastered". If it is not enough, tell the owner what is missing before
  asking him to buy anything.
- `kaykit/KayKit_Skeletons_1.1_EXTRA`, `KayKit_Adventurers_2.0_EXTRA`,
  `KayKit_Character_Animations_1.1`: animated enemies and hero.
- `kaykit/KayKit_FantasyWeaponsBits_1.0_FREE`, `KayKit_ResourceBits`,
  `KayKit_HalloweenBits_1.0_EXTRA`, `kenney/graveyard-kit`.
- **Reuse, don't reinvent:** the Tower Defense session
  (`games/tower-defense/TowerDefense3D/js/assets.js`, `renderer.js`) is
  wiring the same KayKit skeletons and animations right now, and Verb
  Kitchen and Verb Valley load KayKit characters too (Valley's log notes
  that GLTFLoader turns the bone name `handslot.r` into `handslotr`). Read
  their loaders first. Copy code; don't import across game folders.
- The world designer (`tools/world-designer/`, see its README) places
  models on a grid and exports `krabsy-level` JSON. It may suit room
  building; it is a repo-root tool, so ask the master session for changes.

Rules: GLB/glTF only. Whole download **≤ 15 MB**, first playable screen
within a few seconds on a school Chromebook. Share materials, merge static
geometry, at most one shadow light.

## Engine and stack

- Three.js **0.169 as ES modules, vendored locally** like Verb Kitchen
  (`games/verb-kitchen/vendor/`, import map). **No CDN and no third-party
  requests at runtime**: school networks block CDNs, and the privacy
  policy promises no third parties.
- Fonts Fredoka One + Nunito self-hosted (copy from `homepage/lib/fonts/`).
- Plain static files, no build step, no npm.
- `index.html` must contain
  `<meta name="robots" content="noindex, indexifembedded">`.

## Hard rules for content and UX

- **Questions never require grammar terminology** (owner mandate). Use
  positional notation (`go → ___ → gone`, asked blank highlighted). Terms
  only as small captions or in the feedback after an answer.
- After a wrong answer show the full chain (`go → went → gone`).
- Form colours site-wide: base = amber, past = teal, participle = coral.
- Question data from `homepage/lib/krabsy-questions.js` (`getQuizSet`,
  topic from `?topic=`), with a small inline fallback for offline dev. The
  canonical list is `content/irregular-verbs.json`.
- **UI in German and Spanish** (verbs stay English), chosen by
  `?lang=de|es`. See Verb Kitchen's `src/i18n.js`.
- **Tone (non-negotiable):** spooky is fine, scary is not. No blood, no
  screams, no "kill/die" words in the UI ("bonked!", "Ouch! Try again!").
  Skeletons collapse into a tidy bone pile and get up again, sheepish. A
  defeated player gets dizzy stars and restarts at the room entrance.
- **First 30 seconds:** clear goal, playable within about 10 s, nothing
  that punishes a beginner early.
- **Devices** (test all three): 1366×768 laptop with keyboard; 1024×768
  touch tablet/Chromebook (must be fully playable); 390×844 phone
  (playable, or an explicit friendly message).
- Site style: teal `#2ee6c0`, coral `#ff8585`, amber `#ffcf5e` on deep
  navy `#0d2240`. Sound via WebAudio synth or small CC0 files; mute toggle
  in localStorage.

## Working agreement

- Work in `/home/janah/dev/krabsy-homepage/games/verb-dungeon/` on `main`.
  There is one shared checkout; other sessions work in it at the same time.
- Stage only this folder (`git add games/verb-dungeon`, never
  `git add -A` or `git stash`), commit with the Co-Authored-By trailer.
  **Don't push.**
- End every session by updating the **Status log** below: what changed,
  what's next, open questions for the owner.
- The owner prefers short, step-by-step explanations in chat. Ask before
  big design decisions.
- When it's ready for review, say so in the Status log. The master session
  then play-tests and releases it to `homepage/games/verb-dungeon/` with
  wrappers `/de/spiele/verb-dungeon/` and `/es/juegos/verb-dungeon/`.

## Status log

- 2026-06-10 — PoC brief written by the master session (the original PoC
  brief is in git history: `git log -- games/verb-dungeon/CLAUDE.md`).
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
- 2026-11-21 — **Owner decision: build the full game.** The master session
  replaced the PoC brief with this one. Nothing changed in the code.
  **Next:** the first task above (play, read, propose a plan).
