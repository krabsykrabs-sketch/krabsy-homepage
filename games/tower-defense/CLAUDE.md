# Tower Defense — game brief

You are the **game session** for the 3D tower-defense game on **Krabsy**
(krabsy.com): a free browser site where German- and Spanish-speaking kids
(about 10–14) practise English irregular verbs. Read the repo-root
`CLAUDE.md` once for the site rules, then work only in this folder. The
master session releases games (wrapper pages, `games.json`, sitemap,
deploy). You don't touch `homepage/` or other games, and you don't push
to `main` or deploy.

## Goal (owner decision 2026-11-21)

Bring this game to **Verb Kitchen quality** so it can be released. Verb
Kitchen (`games/verb-kitchen/`, live at `/de/spiele/verb-kitchen/`) is the
reference. It is a 3D Three.js game with KayKit assets, and real data shows
it works:
- A Uruguayan class played it for up to 28 minutes and came back the next day.
- Median visit 1:39.
- The low-effort 2D games lose people in 18–40 seconds.

The owner's conclusion: more polished 3D games, built with the shared CC0
asset library. Study Verb Kitchen's code and its `CLAUDE.md` before
designing anything. Especially study how its question moment is
**self-paced** (the sink), so that thinking and action never collide.

## Current state (as found 2026-11-21, untouched since July 2026)

- `td-html5-spec.md` (976 lines): the original full spec, with systems,
  balance values, formulas, UI and quiz. It describes a **2D canvas** game
  and also mentions einmaleins.de. Reuse its balance and systems where
  useful. It is not binding.
- Root `index.html`, `js/`, `css/`, `levels/`: the **2D canvas**
  implementation of that spec, about 3,700 lines.
- `TowerDefense3D/`: a **3D port** with 3 levels. It uses
  `lib/three.min.js` (Three.js **r147**, global script, not ES modules) and
  `lib/GLTFLoader.js`. All visuals are **procedural placeholder meshes**
  (`js/renderer.js`); `js/assets.js` is a stub waiting for GLB models.
  Between waves the quiz asks 2 questions about one verb (`js/quiz.js`).
- `ToolPack/`: a 2D sprite export (map, characters, props). It is probably
  irrelevant for the 3D game.
- `.claude/launch.json` points at an old path (`/home/jan/TowerDefenseHTML`).
  It is stale, so fix it or serve with
  `python3 -m http.server <port>` from the game folder.

**First task:** play both versions, read the code, then propose to the
owner a short plan: base (recommended: `TowerDefense3D/`), game design
changes, asset choice, and milestones. Get an OK before big rewrites.

## Assets: shared CC0 library

`/home/janah/dev/_assets/` (about 3.4 GB, all CC0; see its `README.md`).
Good fits for a tower defense:
- `kaykit/KayKit_Medieval_Hexagon_Pack_1.0_EXTRA`: hex tiles, castles,
  towers, paths. This is the obvious base look.
- `kaykit/KayKit_Skeletons_1.1_EXTRA`, `KayKit_Adventurers_2.0_*`,
  `KayKit_Character_Animations_1.1`: animated enemies and characters.
- `kaykit/KayKit_FantasyWeaponsBits_1.0_FREE`, `KayKit_ResourceBits`,
  `KayKit_Forest_Nature_Pack`, `kenney/castle-kit`, `kenney/nature-kit`.
- Krabsy mascot (optional): the crab character from the owner's video
  project, `/home/janah/dev/BlobVideos/renderers/assets/crab.glb`. It is
  built from rigid named parts (eyes, lids, brows, claws, legs), and its
  rig contract is in `/home/janah/dev/BlobVideos/docs/asset_spec.md`. Ask
  the owner before using it.

Rules:
- Use **GLB/glTF only**.
- Copy only the files you actually use into this folder (e.g.
  `TowerDefense3D/assets/`).
- Keep the whole game download small; Verb Kitchen's build is about 17 MB.
  Aim for **≤ 15 MB**, and a first playable screen within a few seconds on
  a school Chromebook. Compress textures and share materials.
- Note each pack used in a credits list (CC0 needs no credit, but keep
  track).

## Engine and stack

- **Three.js, not Godot.** Godot web exports download an extra ~8–10 MB
  engine and run worse on school Chromebooks and tablets. Godot is the
  owner's tool for *videos* (e.g. a trailer of this game later), not for
  the web game.
- Upgrade to Three.js **0.169 as ES modules, vendored locally** like Verb
  Kitchen (`games/verb-kitchen/vendor/`, import map). **No CDN and no
  third-party requests at runtime.** School networks block CDNs, and the
  privacy policy promises no third parties.
- No build step required (plain static files), like Verb Kitchen.

## Hard rules for content and UX

- **Questions must never require grammar terminology** (owner mandate).
  No "Simple Past" or "Past Participle" as the question. Use positional
  notation (`go → ___ → gone` with the asked blank highlighted) or a
  sentence gap. Terms may appear only as small captions or in the
  after-answer feedback. The current 3D quiz is built around "simple past
  / past participle", so check and rework its UI.
- After a wrong answer, show the full chain (`go → went → gone`), like
  Verb Kitchen and the drills do.
- Question data: use `homepage/lib/krabsy-questions.js` (`getChainSet` /
  `getQuizSet`, topic from `?topic=`), with a small inline fallback for
  offline/file:// dev. The canonical list is `content/irregular-verbs.json`.
- **UI in German and Spanish** (verbs stay English). Pick the language via
  `?lang=de|es` or the wrapper. Verb Kitchen's English-only menus are a
  known weakness; don't repeat it.
- **First 30 seconds:** clear goal, playable within about 10 s, Level 1
  teaches by doing (no wall of text), nothing that punishes a beginner
  early.
- **Devices** (test all three):
  - 1366×768 laptop with mouse and keyboard
  - 1024×768 touch tablet/Chromebook (must be fully playable)
  - 390×844 phone (playable, or an explicit friendly message)
- Site style: palette teal `#2ee6c0`, coral `#ff8585`, amber `#ffcf5e` on
  deep navy; fonts Fredoka One and Nunito, self-hosted (copy from
  `homepage/lib/fonts/`, no Google Fonts link). Sound via WebAudio synth or
  small CC0 files.
- The built game's `index.html` must contain
  `<meta name="robots" content="noindex, indexifembedded">`. The wrapper
  page is what Google should index.

## Working agreement

- Work in `/home/janah/dev/krabsy-homepage/games/tower-defense/` on `main`.
  There is one shared checkout, and the master session works there too.
- Stage only this folder (`git add games/tower-defense`, never `git add -A`
  or `git stash`), then commit with the Co-Authored-By trailer. **Don't
  push.** The master session pushes.
- End every session by updating the **Status log** below: what changed,
  what's next, and open questions for the owner.
- The owner prefers short, step-by-step explanations in chat. Ask before
  big design decisions.
- When it's ready for review, say so in the Status log. The master
  session then play-tests and releases it to `homepage/games/tower-defense/`
  with wrappers `/de/spiele/tower-defense/` and `/es/juegos/tower-defense/`.
  The final name is open, e.g. "Verb Towers".

## Status log

- 2026-11-21 — Brief written by the master session. Nothing changed in
  the game yet.
- 2026-11-21 — **Plan approved by the owner; M0 (clean base) done.**
  - Removed: the 2D game (root `index.html`, `js/`, `css/`, `levels/`),
    `ToolPack/`, the old r147 `lib/`, the `assets.js` stub, `game.css`,
    Baloo 2. All still in git history. `td-html5-spec.md` is kept for
    balance values. The game now lives only in `TowerDefense3D/`.
  - `TowerDefense3D/` runs on Three.js 0.169 as vendored ES modules
    (`vendor/three/`, import map, copied from Verb Kitchen). Every
    `js/*.js` file is a module with explicit imports/exports; level data
    stays as classic scripts (`window.LEVELn`).
  - `renderer.js` has a temporary compatibility shim to keep the old look:
    `THREE.ColorManagement.enabled = false` and light intensities × PI.
    **Remove both in M1** (GLB models need default colour management).
  - Fonts: Fredoka One + Nunito self-hosted in `fonts/`. `noindex,
    indexifembedded` meta added. `.claude/launch.json` serves
    `TowerDefense3D/` on :8123.
  - Checked in headless Chromium (1366×768 mouse, 1024×768 touch): menu,
    placing towers, tower info, wave, quiz. No console errors, same look
    as before.
  - **Approved plan, milestones:** M1 hex world (KayKit Medieval Hexagon:
    hex road tiles, castle as goal, tower models; pointy-top hexes 2 wide,
    row step √3; road tiles A = straight, B = wide curve, C = sharp curve,
    M = dead end, rotate in 60° steps) → M2 animated KayKit skeletons
    (Rig_Medium/Large `Walking_A`, `Running_A`, `Death_A`, `Spawn_Ground`),
    real projectiles → M3 verb loop: self-paced "forge" in the untimed
    build phase (correct answer = coins, wrong = show full chain, verb
    returns later), `krabsy-questions.js`, DE/ES UI → M4 tutorial start,
    touch build menu, 3 levels with 8–10 waves, stars → M5 polish, device
    tests, size check, then "ready for review".
  - Design decisions so far: Circle Shooter is replaced by the catapult
    tower; fewer, stronger enemies per wave for Chromebook performance;
    crab mascot left out for now (decide after M2).
  - **Next:** M1.
- 2026-11-21 — **M1 (hex world) done.**
  - Levels are hex maps now (`levels/levelN.js`: `cols`, `rows`, `seed`,
    `paths[].cells` as chains of adjacent `[col, row]` cells, odd-r offset;
    first cell = spawn, last = castle). `js/level.js` validates adjacency,
    derives waypoints, road-tile sides and seeded scenery (cells touching
    the road always stay buildable). All three levels converted (Meadow,
    Crossroads with a 3-way junction and two castles, Long March).
  - `js/assets.js` loads 37 KayKit Medieval Hexagon models from
    `assets/hex/` (1.6 MB, credits in `assets/CREDITS.md`); all share one
    atlas material. The atlas is the pack's "Summer" variant (greener).
    Static board = 3 merged meshes; about 15–30 draw calls, ~50k triangles.
  - `js/grid.js`: one hex = one building spot. `js/renderer.js`: hex board,
    island in the sea, castle at the goal, spawn ring + flags, teal hex
    overlay on free cells while placing, see-through model as placement
    ghost, real tower models (archer `tower_A`, catapult, cannon, frost
    `tower_B` + crystal). Cannon/catapult turrets aim; recoil, arm swing
    and roof bounce on fire. M0 colour shim removed.
  - Circle Shooter is now the **Catapult** (range 6, damage 70, slow,
    small splash; lobbed shot like the cannon).
  - Clicking or tapping a tower model selects it (`Renderer.pickTower`).
  - `window.__td = { state, Renderer, Level, Grid }` is a debug handle for
    automated play-tests.
  - Checked in headless Chromium: levels 1–3 at 1366×768, level 1 at
    1024×768 with touch (place, select by roof tap, refused on road and
    scenery, full wave + quiz). No console errors or warnings.
  - **Known gaps (planned later):** enemies and projectiles are still
    placeholder shapes (M2). Phone portrait 390×844: board is tiny and the
    HUD overflows (M4/M5). Balance untouched: 20–25 waves, forced quiz
    popup (M3/M4). UI still English and cream/wood themed (M3).
  - **Next:** M2 (animated KayKit skeletons, real projectiles).
- 2026-11-21 — **M2 (enemies and projectiles) done.**
  - `js/characters.js`: loads six KayKit Skeletons characters and four rig
    files from `assets/skeletons/` (4.7 MB), converts them to Lambert,
    and hands out **pooled** instances (own mixer + own materials for
    tinting). Clips used: `Walking_A`, `Running_A`, `Death_A`,
    `Spawn_Ground` (the large rig has no spawn clip).
  - Tier → character: Grunt = Minion, Soldier = Rogue, Warrior = Warrior,
    Brute = Mage, Titan = Necromancer, Boss = Golem. A wounded enemy that
    drops a tier swaps to the weaker character (existing poof effect).
  - Enemies rise out of the ground for 0.9 s (`CONFIG.enemySpawnRise`,
    they are stunned but hittable), then walk or run with the leg speed
    matched to their real speed. Red flash on hit, blue tint when frozen,
    blob shadow, health bar. Killed enemies play the death clip and sink
    into the ground (`Renderer._corpses`, max 24).
  - Projectiles are models: arrow (points along its flight path),
    cannonball and catapult boulder (tumbling, lobbed).
  - Checked in headless Chromium: normal wave, boss wave, deaths, all
    three projectile types, back to menu and level switch mid-battle. No
    console errors or warnings.
  - **Performance risk for M5:** each character is about 10 skinned meshes,
    so 13 enemies cost ~130 draw calls (149 total measured). Not yet
    measured on a real Chromebook. Options: merge each character's parts
    into one skinned mesh at load; fewer, stronger enemies (planned in M4).
  - **Size:** game folder is now about 8 MB. The four rig files (2.7 MB)
    contain many unused clips and a mannequin mesh; strip them in M5.
  - Noted for M3: the "End run" button uses a native `confirm()` dialog.
  - **Next:** M3 (self-paced verb forge, `krabsy-questions.js`, DE/ES UI,
    Krabsy look for HUD and menus).
