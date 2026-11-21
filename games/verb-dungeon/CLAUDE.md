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

## What exists

**The game base (built 2026-11-21, replaces the PoC as `index.html`).**
Plain ES modules, no build step. Serve with `python3 tools/serve.py`
(port 8130, caching off; `.claude/launch.json` does the same) and open `/`.
`?play=1` skips the menu.

| File | What it does |
|---|---|
| `index.html` | page, styles, HUD, question plate, start and end screens |
| `src/main.js` | game loop and rules, input, interface, QA hook |
| `src/room.js` | builds one room from data (shell + props, merged to one mesh) |
| `src/levels.js` | level data: 3 levels, 4–5 rooms each, 4 room templates |
| `src/assets.js` | model loading, shared material, static merge |
| `src/chars.js` | animated character (hero, skeletons) |
| `src/questions.js` | questions from the site engine, inline fallback |
| `src/verbs.js` | inline fallback verbs (46, copied from Verb Kitchen) |
| `src/i18n.js` | interface texts EN/DE/ES (`?lang=`) |
| `src/audio.js` | WebAudio synth (kept from the PoC) |
| `assets/`, `vendor/three/`, `fonts/` | models (2.3 MB), Three.js 0.169, fonts; nothing from a CDN |
| `poc/` | the June PoC, kept for reference (follow camera, primitives) |

**Rules as built**
- One room on screen, fixed camera (43° down, fitted to the window). Every
  room has the same shell; you enter at the open front and leave through
  the door in the back wall. Room change is a short fade.
- Per room: bonk every skeleton (Space) → a key appears over the door →
  walk to the door → verb question (`go → ___ → ___`, asked blank
  highlighted, 3 choices, keys 1–3 or click) → door opens.
- A wrong answer shows the full chain, greys that choice out and puts the
  verb back in the queue for a later door or chest.
- Chests are optional bonus questions: +1 heart (or just treasure).
- Skeletons that are not bonked yet chase and bump the hero (−1 heart,
  knock-back, short blink). Bonked ones get up again and only wander.
  Nothing moves while a question plate is open.
- Sword: Space swings on the arms only (clip `ChopUpper`, built at load),
  so you can swing while running. It skips most of the clip's wind-up and
  hits ~0.13 s after the key press (`SWING` in `main.js`).
- Chain order: a verb's 3rd form is asked only right after its 2nd form,
  with the 2nd form shown (`go → went → ___`). After a 2nd-form answer the feedback
  also stops at `go → went → ___`; the full chain comes after the 3rd form. From the site engine the
  game takes 2nd-form questions only until the engine can pair them.
- Menu works with the keyboard: 1–3 or ←/→ pick a level, Enter/Space start.
  If the game has no keyboard focus it pauses with "Click here to play".
- 3 hearts; at 0 the hero is dizzy and the room restarts with full hearts.
- Stars: 3 = every question right on the first try, 2 = at least 60 %,
  else 1. Best stars per level in localStorage `krabsy_vdungeon_stars`.
  Level n+1 unlocks with any star on level n (`?unlock` opens all).
- Questions: `/lib/krabsy-questions.js` (`getQuizSet`, tiers per level)
  when served from the site, otherwise the inline list.

**Not built yet**
- **Touch controls** (virtual stick, bonk button). Phones in portrait get
  a "use a wider screen" message; tablets have no way to move yet.
- A tutorial that teaches by doing (room 1 of level 1 has no skeletons,
  hints tell you what to do, but that is all).
- Real level design: the three levels reuse four room templates.
- Prepositions (`?topic=`), cinematic beats, music.

**Local diagnostics:** on localhost (not with `?qa`) the game sends key
presses, a 2-second heartbeat and errors as `diag?…` requests, visible in
the dev server's output. This is how the "controls don't work" report was
solved.

**QA without a keyboard:** `window.__VD` (`info()`, `run(n)`, `teleport`,
`bonkAll`, `answerRight`, `answerWrong`, `playRoom`). `?qa=play&level=2`
plays a level by script; `?qa=hurt` checks the dizzy restart; `?qa=keys`
sends real key events; `?qa=door&stop=3` and `?qa=swing&stop=0` freeze a
pose for screenshots (headless Edge needs `--virtual-time-budget` ≈ 40000
with the no-cache server). On localhost
the result is also sent as a `qa-report?…` request, readable in the dev
server's log (headless Edge with `--screenshot` works from WSL; it does
not run long enough with `--dump-dom`).

## Direction for the full game (proposed by the master session)

The owner said yes to the game and, after the look test, to building on
this look (2026-11-21). Points 1–5 below are built in a first version;
6 (touch) is open. He has not confirmed the rule details listed under
"Rules as built", so treat those as a first proposal.

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

**Next tasks:** see the end of the Status log.

## Assets: shared CC0 library

`/home/janah/dev/_assets/` (about 3.4 GB, all CC0; see its `README.md`).
It is read-only: copy only the files you use into this folder (e.g.
`assets/`) and list each pack in `assets/CREDITS.md`.

- `kaykit/KayKit_Dungeon_Pack_1.1_FREE`: walls, floors, chests, keys,
  torches, stairs, props. Note: this is the older free pack, not "Dungeon
  Remastered". If it is not enough, tell the owner what is missing before
  asking him to buy anything.
  - **The door is inside `wall_doorway.gltf`**: a child node
    `wall_doorway_door`, hinged at its origin (rotate `.y` to open). There
    is no standalone door file. `chest*.gltf` has a separate lid node
    (`chest_lid`, `chest_gold_lid`; rotate `.x` to open) in the same way.
  - Grid: walls are 4 wide, 4 tall, 1 thick; large floor tiles 4×4;
    characters about 2.2–2.5 tall at scale 1. Wall decorations (banners,
    mounted torches) are authored to hang on the wall's +z face.
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
  Copy the `@font-face` rules from `krabsy-fonts.css` too: one Nunito
  file per subset is declared for weights 400/700/800/900 (there is no
  600, which the PoC uses), and the `url(/lib/fonts/…)` paths are
  absolute, so make them relative to this folder.
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
- 2026-06-10 — **PoC built and play-verified.** `index.html` + 10 modules in
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
- 2026-11-21 — Master session checked the brief against the repo and
  fixed `.claude/launch.json` (stale path; port moved 8123 → **8130**
  because the Tower Defense session serves on 8123–8125).
- 2026-11-21 — **Look-test room built** (owner request, before any level
  work): `looktest.html` + `looktest.js`. One 20×16 room from the free
  KayKit Dungeon pack, fixed camera (43° down, fitted to the viewport),
  Knight hero with sword and shield, two Skeleton Minions, four flickering
  torches + one shadow light, dust motes. Playable: WASD/arrows, Space =
  bonk (skeleton falls over, gets up again) or open the gold chest, a mock
  verb plate at the locked door (`go → ___ → gone`, keys 1–3), door swings
  open, walking through restarts the room.
  - New folders: `vendor/three/` (0.169, copied from Verb Kitchen),
    `fonts/`, `assets/` (2.5 MB, see `assets/CREDITS.md`). The PoC
    (`index.html`, `src/`) is untouched.
  - **Checked** with headless Edge screenshots at 1366×768 and 1024×768
    (`_shots/looktest-*.png`): room, door plate, open door, open chest,
    bonked skeleton all render. `?pose=door` / `?pose=open` set those
    scenes up for screenshots; QA hook `window.__LT`.
  - **Not checked:** real keyboard play by a human, frame rate on a
    Chromebook (headless used software rendering), touch, phone layout.
  - It is a look test, not the base of the game: no level data format,
    no question engine, English only, models not merged (one mesh each).
  - Owner's answer the same day: build on it. The look-test files were
    then folded into the game and removed.
- 2026-11-21 — **Game base built** on the look test (see "What exists").
  The PoC moved to `poc/`.
  - **Checked** by script in headless Edge (software rendering): levels
    1, 2 and 3 play from the first room to the end screen; wrong answer →
    chain shown and verb asked again later; chest reward; bump → heart
    lost; 0 hearts → room restarts with 3 hearts. Screens looked at in
    DE, ES and EN at 1366×768 and 1024×768 (`_shots/`). 22 draw calls,
    about 30k triangles per room.
  - **Not checked:** a human playing with a real keyboard (feel, speed,
    difficulty), sound, frame rate on a Chromebook, the site question
    engine (local dev always uses the inline list).
  - **Next:** 1) owner plays it and comments on feel and rules;
    2) touch controls; 3) tutorial room; 4) more room templates and real
    level design; 5) device tests, then "ready for review".
  - **Open questions for the owner:** should bumping cost a heart at all,
    or is that too punishing for beginners? Knight as hero? Free pack
    enough, or buy "Dungeon Remastered" for more variety?
- 2026-11-21 — **Owner play-test 1** ("really cool"). Fixed:
  - "Can't move": Firefox kept the PoC's cached `src/verbs.js` (same URL,
    no wrong answers), so starting a level crashed silently. Now: no-cache
    dev server `tools/serve.py`, a level that fails to start shows the
    error, a "click to play" pause when the page lacks focus, the menu
    works with the keyboard, clicked buttons drop focus.
  - Sword felt slow and needed standing still → upper-body swing that
    works while running, hits ~0.13 s after Space (was ~0.33 s, plus a
    full-body 0.8 s lock).
  - Chain order for 2nd/3rd form (owner rule, relayed by the Tower
    Defense session).
  - Checked by script and screenshots only; the swing's feel is for the
    owner to judge.
  - **Next:** owner retries the sword; then touch controls, tutorial room,
    more room templates.

