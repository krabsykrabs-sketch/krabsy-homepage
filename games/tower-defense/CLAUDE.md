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

## Current state (2026-11-21, after M0–M5: READY FOR REVIEW)

The game is `TowerDefense3D/` (plain static files, no build step, 5.4 MB).
Working title in the UI: "Verb Towers". The old 2D game and the first
3D placeholder version are gone (git history has them).

```
TowerDefense3D/
├── index.html            noindex meta, import map, data-i18n nodes
├── css/game3d.css        Krabsy look, responsive rules
├── fonts/                Fredoka One, Nunito (self-hosted)
├── vendor/three/         Three.js 0.169 ES modules + GLTFLoader etc.
├── assets/hex/           KayKit Medieval Hexagon models used (1.6 MB)
├── assets/skeletons/     6 characters + 2 animation-only files (2.3 MB)
├── assets/CREDITS.md
├── levels/level1-3.js    hex maps, waves, economy (classic scripts)
└── js/
    main.js               state, phases, loop, stars, speed
    level.js grid.js      hex board, paths, building spots
    wave.js enemy.js tower.js projectile.js effects.js config.js audio.js
    forge.js questions.js the question moment and its data source
    tutorial.js           level-1 coach
    i18n.js               de / es / en
    assets.js characters.js renderer.js   models, pooled skeletons, 3D
    input.js ui.js        mouse/touch/keys, HUD and overlays
tools/
    balance-sim.mjs       bot that plays all levels (balance check)
    strip-rigs.py         makes the animation-only GLB files
td-html5-spec.md          original 2D spec (historic, balance ideas)
```

**Play locally:** `python3 -m http.server 8123 --directory TowerDefense3D`
(fallback verbs). To use the real question engine the site's `/lib` and
`/data` must be served at the root, as after release.

**URL parameters:** `?lang=de|es|en`, `?topic=irregular_verbs|prepositions`,
`?q=high|low` (fix the render quality; default adapts to the frame rate).

**Notes for the master session (release):**
- Copy `TowerDefense3D/` to `homepage/games/tower-defense/` as is. `tools/`
  and the spec are not served.
- The game imports `/lib/krabsy-questions.js` by absolute path, so it must
  live on the site origin. Wrappers iframe `/games/tower-defense/?lang=de`
  (or `es`); without `?lang` it uses `localStorage.krabsy_lang`.
- `localStorage` keys: `td3d_stars_level_N`, `td3d_highscore_level_N`,
  `td3d_tutorial_done`. No analytics calls and no third-party requests.
- The game name is undecided; "Verb Towers" appears in `index.html`
  `<title>` and `js/i18n.js` (`title`).
- Phone portrait is playable but small; the menu shows a "turn your phone"
  hint there.

**Not verified (please check in review):** real Chromebook / tablet / phone
performance and feel; balance with real kids (tuned with a bot only);
German and Spanish wording by a native-speaker read-through.

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
- 2026-11-21 — **M3 (verb forge, languages, Krabsy look) done.**
  - **Forge** (`js/forge.js`) replaces the forced between-wave quiz
    (`quiz.js` deleted). The player opens it with the amber dock button or
    `F`, any time in build or battle. Each wave gives 3 hammers
    (`CONFIG.forge`); one question per hammer. Right = 8 coins fly in from
    the castle and the next question follows; wrong = no coins, the full
    chain is shown with small grammar-term captions, and the player
    presses "next" when ready. A hammer is used either way, so guessing
    does not pay. In battle the game runs at 25 % speed while the forge is
    open. Keys: 1–3 answer, Enter/Space next, Esc/F close.
  - **Questions** (`js/questions.js`): `/lib/krabsy-questions.js`
    `getQuizSet` (quiz shape, `?topic=`), ordered by verb tier so everyday
    verbs come first (`getChainSet` supplies the tiers; every question has
    the same `difficulty`). Missed questions return three questions later
    and are listed on the game-over / victory screen. Inline fallback of
    30 verbs when the import fails (local dev, file://). Presentation is
    positional: `send → ___ → [ ? ]`. `?topic=prepositions` works too
    (sentence with a highlighted gap).
  - **Languages** (`js/i18n.js`): German, Spanish, English. `?lang=`, else
    `localStorage.krabsy_lang` (the site's key), else browser, else German.
    All UI text goes through `t()`; static nodes use `data-i18n`.
  - **Look:** `index.html`, `css/game3d.css` and `js/ui.js` rewritten in
    the Krabsy style (navy panels, teal/coral/amber, Fredoka One + Nunito).
    Responsive rules for ≤1100 px, short windows and phones (≤640 px:
    compact HUD, hearts as a number). "End game" asks in the page instead
    of a native `confirm()`.
  - Fixed: "Play again" on the end screens threw since M0 (`resetRun` was
    not exported after the ES-module conversion).
  - Working title in the UI: **"Verb Towers"** (final name is the owner's
    call).
  - Checked in headless Chromium: full forge flow (right, wrong, keyboard,
    empty forge, refill after a wave, slow motion in battle), game over
    with recap, play again, quit dialog. German on the inline fallback;
    Spanish, German and prepositions on the real site engine (344
    questions) via a local server that also serves `/lib` and `/data`;
    1366×768, 1024×768 touch, 390×844 touch. No console errors.
  - **To test the real question engine locally**, the game must be served
    with the site's `/lib` and `/data` at the root (as it will be after
    release). Plain `python3 -m http.server` in `TowerDefense3D/` uses the
    fallback verbs and logs one expected 404 for `/lib/krabsy-questions.js`.
  - **Not done yet:** balance is untouched (20–25 waves; wave bonus, kill
    coins and forge coins are first guesses). No tutorial, no stars.
    Phone portrait is playable but the board is small.
  - **Next:** M4 (first-30-seconds tutorial, touch build flow, 3 levels
    with 8–10 waves, fewer and stronger enemies, stars).
- 2026-11-21 — **M4 (tutorial, build flow, levels, stars) done.**
  - **Levels:** 8 / 9 / 10 waves (was 20 / 20 / 25), boss waves listed per
    level (`bossWaves`: 4+8, 5+9, 5+10), fewer and stronger enemies (wave 1
    of level 1 is three slow skeletons). `enemyScaling` in the level files
    now also accepts `speedPerWave`, `spawnInterval`, `enemiesPerBoss`,
    `bossHealthFactor`.
  - **Balance** was tuned with a bot: `tools/balance-sim.mjs` plays every
    level at verb accuracy 1 / 0.7 / 0.4 / 0 (needs the local server on
    :8123 and the Playwright Chromium in `~/.cache/ms-playwright`). Result:
    level 1 is winnable without verbs (1–2 stars) and gives 3 stars from
    ~40 % accuracy; level 2 and 3 are lost without verbs, give 1–2 stars
    at 40–70 % and 2–3 stars at 100 %. The bot is a simple player (builds
    only between waves); real kids are untested.
  - **Stars:** a won level earns 1–3 stars by lives left (3 = at most one
    lost, 2 = at least half). Stored in `localStorage`
    (`td3d_stars_level_N`); one star unlocks the next level. Level cards
    show stars or a lock; the victory screen shows the stars and a
    "next level" button.
  - **Build flow:** tap a free hex (it glows amber), then a tower card
    builds right there. The old order (card first, then hex) still works,
    as do keys 1–4.
  - **Tutorial** (`js/tutorial.js`, level 1, first time only): one short
    coach line plus a pulse on what to press — tap a glowing hex, pick a
    tower, start the wave, watch, open the forge, answer. Steps follow the
    game state, so another order never blocks. Finished flag:
    `td3d_tutorial_done`.
  - **Speed button** ×1 / ×2 in the HUD (battle only).
  - Checked in headless Chromium at 1366×768, 1024×768 touch, 390×844
    touch and 844×390 touch: tutorial steps, both build orders, speed,
    victory with stars, next level, locks on the menu. No console errors.
  - **Known gaps for M5:** on short landscape phones the dock covers the
    bottom rows of the board; on portrait phones the board is small.
    Performance on a real Chromebook is unmeasured. Rig files still carry
    unused clips (size).
  - **Next:** M5 (polish, real-device checks, size and load time, then
    "ready for review").
- 2026-11-21 — **M5 (polish, size, performance) done. READY FOR REVIEW.**
  - **Size:** 8.0 MB → 5.4 MB. The four rig files (2.7 MB) are replaced by
    two animation-only files (0.2 MB) built by `tools/strip-rigs.py`.
    Measured page load: about 6.2 MB over 168 requests (many small
    gltf + bin pairs; could be merged into one file later if load time
    matters).
  - **Performance:** one shared skeleton per enemy instead of one per body
    part; the shadow map is redrawn only when towers change (and ~8×/s in
    battle); enemies and projectiles cast no real shadows. Adaptive
    quality: under ~26 fps the renderer first drops to 1× pixel ratio,
    then turns shadows off (`?q=high|low` overrides). Typical frame:
    40–60 draw calls plus ~10 per enemy, 60–70k triangles.
  - **Camera** now fits the board into the area between the top HUD and
    the measured dock height at any window shape (laptop, tablet, phone
    landscape and portrait) and re-fits when the dock changes.
  - Loading note shows a percentage; portrait phones get a "turn your
    phone" hint on the menu.
  - Regression in headless Chromium, no console errors: forge flow,
    tutorial, both build orders, stars and unlocking, next level, game
    over recap, quit; 1366×768, 1024×768 touch, 844×390 touch, 390×844
    touch; German, Spanish; real site question engine and fallback.
  - **Open questions for the owner:** final game name; crab mascot yes/no
    (not used); whether level 1 should stay winnable without verbs.
  - **Ideas not done:** merge each character into one mesh (if a real
    Chromebook is slow), merge the hex models into one file, coast tiles
    around the island, sound polish, more levels, typed-answer mode.
