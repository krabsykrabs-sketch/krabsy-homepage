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
├── levels/level1-6.js    hex maps, waves, economy, season (classic scripts)
└── js/
    main.js               state, phases, loop, stars, speed
    level.js grid.js      hex board, paths, building spots
    wave.js enemy.js tower.js projectile.js effects.js config.js audio.js
    forge.js questions.js the always-visible question card and its data
    tutorial.js           level-1 coach
    i18n.js               de / es / en
    assets.js characters.js renderer.js   models, pooled skeletons, 3D
    input.js ui.js        mouse/touch/keys, HUD and overlays
tools/
    balance-sim.mjs       bot that plays levels (strategies: mix, archers)
    hex-path.py           anchor cells → full road chain for a level file
    check-turns.mjs       checks every road: no gaps, no repeats, no turn > 60°
    strip-rigs.py         makes the animation-only GLB files
td-html5-spec.md          original 2D spec (historic, balance ideas)
```

**Play locally:** `python3 tools/dev-server.py` → http://localhost:8125/?lang=de
(serves the game plus the site's `/lib` and `/data`, so the real question
engine works as after release; add `&unlock=all` to open every level).
`python3 -m http.server 8123 --directory TowerDefense3D` also works but
uses the fallback verbs.

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
- **Name decided by the owner (2026-11-21): "Verb Towers"**, with
  "Tower Defense" in the subtitle / page text for search. It is in
  `index.html` `<title>` and `js/i18n.js` (`title`).
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

## Play-test notes (owner)

1. **Spawn camping (2026-11-21).** A tower next to the spawn point kills
   skeletons while they are still rising out of the ground; they never
   start walking. Looks and feels wrong, especially in early levels.
   Proposed fix: enemies cannot be targeted or damaged (also not by
   splash or frost) until they have finished rising; optionally keep the
   hexes touching the spawn unbuildable.

2. **Economy: the forge is optional (2026-11-21).** The owner can build
   without ever opening it. Math confirms it: coins without the forge are
   176 / 253 / 495 on levels 1 / 2 / 3 (start + kills + wave bonus); the
   forge adds at most 192 / 216 / 240, i.e. only 52 % / 46 % / 33 % of all
   income. Kill coins grow with enemy count and tier, so the forge matters
   least on level 3.
   Owner's idea: an **always-visible question card** at the side; the game
   never stops; answer whenever you need money. Session's recommendation:
   do it, replacing forge + hammers. Rules proposed: right = coins and the
   next question after a short beat; wrong = full chain shown and the card
   locked for ~4 s (guessing costs time), verb returns later; kills pay
   almost nothing, small wave bonus, so ~75–80 % of income is verbs; side
   panel on laptop/tablet, compact strip above the dock on phones; camera
   fit gets a right inset; retune with the bot (answer rate × accuracy).
   Not decided yet.

3. **Upgraded towers look like base towers (2026-11-21).** Today an
   upgrade only adds small gold dots at the foot and 8 % size. Owner wants
   a clear visual level-up (different look, maybe roof colour or glow).
   Session's proposal, not decided: (a) silhouette — level 2 stands on the
   pack's `building_tower_base`, level 3 on two, so higher levels are
   taller; (b) roof colour per level via recoloured copies of the 16 KB
   atlas (blue → teal → gold), no new models; (c) at max level a flag on
   top and a soft glow ring; (d) a star badge above the tower; (e) a
   level-up burst with sound. Recommended: a + b + c + e.

Notes 1 and 2 are implemented (Status log, "play-test round 1"); note 3 is
implemented as preview-approved by the owner (Status log, "round 2").

4. **Archer upgrade was useless (2026-11-21).** Upgraded arrows flew
   straight through one enemy and on into nowhere — fine on the old
   straight 2D roads, pointless on winding hex roads. Owner wants chain /
   seeking arrows. Implemented (Status log, "round 3"). First version was far too
   strong (×3 / ×5); toned down the same day (Status log, "round 3b").

5. **3rd-form questions are confusing (2026-11-21).** With both blanks
   empty (`go → ___ → ?`) the owner kept answering the 2nd form. Data: 105
   of 172 verbs have identical 2nd/3rd forms (no harm there); for 60 of
   the other 67 the 2nd form is offered as a wrong option — the error
   measures attention, not knowledge. Simply showing the 2nd form would
   give the answer away for those 105. Decision: ask the chain in order —
   3rd form only as the follow-up to the same verb's 2nd form, with the
   2nd form filled in. Done in this game (Status log, "round 4"); handed
   to the master session for the shared engine (site-wide).

6. **Moments too generic, and sound/music (2026-11-22).** "When you die you
   don't really notice; you just get a text. Everything should be clear
   without reading. Time to think about sound and music." A Fable 5.2
   subagent wrote a design proposal (not built yet):
   - Core idea: **the castle is the health bar.** Enemies burst at the
     gate, the castle flashes and squashes, a heart flies to the HUD and
     breaks, small camera shake; smoke under 60 % lives, smoke + flames +
     lowered flag under 30 %; low lives (≤ 3): pulsing hearts, coral
     vignette, heartbeat.
   - Defeat: ~2.5 s sequence (skippable) — camera to the castle, castle
     swaps to `building_destroyed`, red flag, desaturate — then an
     icon-led panel (broken heart, waves as dots). Victory: hearts fly out,
     confetti, towers pop, stars slam in one by one.
   - Later: boss entrance and boss health bar, wave-start pips, streak
     flame, build dust, "not enough coins" feedback.
   - Sound: stay procedural WebAudio (0 MB; the asset library has no
     audio). Music layers: calm build, drums + bass in battle, minor +
     drone for bosses, heartbeat at low lives, end jingles. New effects
     (castle hit, horn, boss, stars, streak, can't-afford), softer wrong
     answer, per-sound caps. Lower default volume, separate music /
     effects toggles, pause when the tab is hidden, `?sound=off` /
     `?music=off` for teachers.
   - Open decisions: music style; music on or off by default; defeat
     sequence skippable; bosses rising out of the ground.
   Owner chose (2026-11-22): build the first batch; music style **soft
   medieval**; music **on but quiet** by default. Built (Status log,
   "round 6").

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
- 2026-11-21 — **Play-test round 1 (owner notes 1 and 2) done.**
  - **Spawn camping fixed:** enemies cannot be targeted, damaged or frozen
    while they rise out of the ground (`spawnTimer > 0`); towers ignore
    them until they take their first step.
  - **Forge is now an always-visible question card** (owner's idea). No
    button, no modal, no slow motion; the game never stops for it. Side
    panel on wide landscape screens (chain runs top to bottom), compact
    panel under the top bar on short landscape windows, a strip above the
    dock otherwise. Dock, coach and wave banner centre on the space left
    of the panel; the camera fit reserves the panel's width or height.
  - **Card rules** (`CONFIG.forge`): 8 answers ("ore") per wave, used up
    right or wrong and refilled when the next build phase starts — added
    by the session so the untimed build phase is not an endless coin farm.
    Right = 5 coins, +1 per 3-streak up to +3, next question after 0.9 s.
    Wrong = full chain with captions, card locked 4 s (shrinking bar), the
    question returns later. The card runs on wall-clock time, so it does
    not slow down on a slow device.
  - **Economy:** kills pay a flat 1 coin (boss 3), wave bonus 5. With all
    answers right the forge is roughly 75–80 % of income; with none the
    bot affords about three towers per level.
  - **Bot results** (`tools/balance-sim.mjs`, updated for the card; it
    answers all 8 questions every wave), enemy stats unchanged from M4:
    level 1: 3 stars from 40 % accuracy, 0 % = 1 star or lost;
    level 2: 100 % = 3 stars, 40–70 % = 1–3 stars, 0 % = lost in wave 6–7;
    level 3: 100 % = 3 stars, 70 % = 1–2 stars, 40 % and below = lost.
  - Keys: `Q` `W` `E` answer the card; `1`–`4` stay the tower keys; `F`
    is gone. Tutorial is now: tap hex → pick tower → start wave → answer
    the card. A newly built tower is no longer auto-selected (its info
    panel covered the board on small screens).
  - **Bug found and fixed on the way:** the forge config rewrite had
    deleted `CONFIG.projectileHitRadius`, so no shot ever hit (owner:
    "the enemies don't die"). All `CONFIG.*` references were re-checked.
  - Checked in headless Chromium at 1366×768, 1024×768 touch, 390×844
    touch and 844×390 touch, German and Spanish, site engine and
    fallback: tutorial, card flow (right, streak, wrong + lock, keyboard,
    empty, refill), spawn immunity (27 rising enemies, none hurt),
    victory, next level. No console errors.
  - **Open:** is 8 answers per wave the right amount; real-device and
    real-kid testing as before.
- 2026-11-21 — **Play-test round 2 (owner note 3): visible tower levels.**
  - Owner approved a side-by-side preview first. Built as shown, plus a
    foot ring on every upgraded level (the preview showed that cannon and
    catapult, which have no roof, were hard to tell apart at level 2).
  - Per level (`TOWER_LEVEL` in `renderer.js`): size ×1.0 / 1.14 / 1.28;
    a low stone plinth (`building_tower_base_blue`, squashed) under levels
    2 and 3; roof and trim colour blue → teal → gold; foot ring teal /
    gold; a softly pulsing glow disc at the top level. The old gold dots
    are gone.
  - Colours come from `Assets.levelMaterials`: recoloured copies of the
    atlas made at load time on a canvas (every blue swatch shifted in
    hue). No extra download.
  - Level-up moment: ring burst and sparks in the new colour
    (`Effects.spawnLevelUp`), a size pop (`tower.levelUpT`), two rising
    notes.
  - Rejected on the way: stacking full tower bases (towers became two to
    three times as tall); a flag on top (invisible at game distance).
  - Checked in headless Chromium: all four towers at all three levels,
    upgrade twice through the UI, a wave afterwards. No console errors.
- 2026-11-21 — **Play-test round 3 (owner note 4): chain arrows.**
  - Archer upgrades are now chain jumps instead of pierce: after a hit the
    arrow homes in on the nearest enemy it has not hit yet within
    `CONFIG.chainRange` (3.2). Level 2 hits up to 3 enemies, level 3 up to
    5 (`CHAIN_HITS`, modes `chain2` / `chain4` in `config.js`). The old
    range multipliers (1.5 / 10) are gone.
  - Every arrow, upgraded or not, re-targets the nearest enemy in reach
    when its target dies on the way, and ends when none is in reach. No
    arrow flies off into nowhere any more.
  - Chained arrows fly low from enemy to enemy (renderer).
  - Upgrade texts and tower-info flags rewritten in de / es / en.
  - Measured (one archer, wave 6): level 1 = 1 enemy per arrow; level 2
    = mostly 3; level 3 = 2–5 depending on how bunched the enemies are;
    0 missed arrows. Bot balance unchanged within noise.
  - From now on the session runs on Opus 5.5 (owner's choice, to save
    tokens); design-heavy work may go to a Fable 5.2 subagent.
- 2026-11-21 — **Round 3b: chain arrows toned down** (owner: ×3 then ×5 per
  upgrade is far too strong). Now level 2 = 1 jump (2 enemies), level 3 =
  2 jumps (3 enemies), each jump keeps 70 % of the damage
  (`CONFIG.chainFalloff`; modes `chain1` / `chain2`). At most ×1.7 /
  ×2.19 base damage, only when enemies are bunched; measured in wave 6:
  ×1.66 / ×2.13, 0 missed arrows. Value per coin: +0.70 / +0.49 "archers"
  for 30 coins each, vs +1.0 for a new archer (20 coins, needs a spot)
  and +0.37 for the catapult damage upgrade (40 coins).
- 2026-11-21 — **Round 4 (owner note 5): chain order for questions.**
  - `js/questions.js`: a 3rd-form question is never asked with the 2nd
    slot empty. When the pool draws a verb's 2nd form, its 3rd form
    follows right after (`followUp`) with the 2nd form written in; when
    it draws a 3rd form first, the 2nd form is asked before it. Missed
    3rd forms come back with the 2nd form filled in, too. Prepositions
    and other topics are unaffected.
  - Checked 400 questions each on site data, fallback verbs and
    prepositions: 201 third-form questions, all with the correct 2nd form
    shown; card screenshot `meet → met → ?`. No errors.
  - **For the master session (site-wide):** the same rule belongs in
    `homepage/lib/krabsy-questions.js` (e.g. a `getQuizSet` option that
    pairs each verb's participle question after its past question and
    fills `display.slots[0].text`), so every drill and game gets it. The
    owner asked for this on 2026-11-21; sent as a message to the "Verb
    Dungeon Game brief" session (believed to be the master). This game
    session does not edit `homepage/`.
- 2026-11-21 — **Round 5 (owner notes): coins from the answer, loaded catapult.**
  - Right answers: the coins now burst out of the answer button and fly
    to the purse (`Effects.spawnFlyingCoins(..., screenStart)`,
    `Forge._buttonPoint`), with a "+5" rising out of the button; flying
    coins are a bit bigger. Without a page (bot) they start at the castle.
  - Fixed a reveal leak from round 4: after a 2nd-form answer the 3rd form
    stays `___` when it is the next question (`ui._questionHtml`).
  - Catapult: a boulder sits in the bucket while loaded, disappears when
    thrown and is reloaded 0.7 s later (`tower.sinceShot`).
- 2026-11-21 — **Name and levels 4–6.**
  - Owner agreed on the name **"Verb Towers"** (subtitle/page text should
    say "Tower Defense"). Owner asked for more levels before release.
  - New levels (unlock in order by stars, as before):
    4 **Lakeside / Seeufer / Orilla del lago** — autumn, 14×10, road
      loops around a lake, 10 waves (boss 5, 10).
    5 **Two Gates / Zwei Tore / Dos puertas** — summer, 14×10, two spawn
      points whose roads meet early, 11 waves (boss 6, 11).
    6 **Winter Pass / Winterpass / Paso de invierno** — winter, 15×11,
      longest road with three crossings and a frozen lake, 12 waves
      (boss 6, 12).
  - **Seasons** (`season` in a level file): the board material swaps to
    the pack's fall / winter atlas (`Assets.setSeason`); towers, plinths
    and the castle keep the summer atlas (`Assets.towerMaterial`) so the
    blue / teal / gold upgrade colours stay readable. The open sea takes
    the season's water colour. `sceneryDensity` makes woods denser.
  - Lakes inside the board sit almost level with the grass and get water
    lilies and reeds (5 small pack models), so they no longer look like
    holes. Menu thumbnails show season colour and lakes.
  - Road cells are generated with `tools/hex-path.py` from a few anchors.
  - Bot balance (3 runs each): 4, 5 and 6 all give 3 stars at 100 %,
    1–2 stars at 70 %, lose at 40 % (level 4 sometimes a 1-star win) and
    lose without verbs. Level 5 needed a longer shared road; with only
    8 road cells after the junction even 100 % lost.
  - Checked in headless Chromium: all six levels load, enemies walk every
    road (both gates on level 5), menu with six cards and locks on
    1024×768 and 390×844 (scrolls), level-1 regression. No errors.
- 2026-11-21 — **Owner rule: enemies never turn 90° or more.** On a hex
  road that means at most one hex side (60°) per cell; a U-turn takes
  three gentle steps. `tools/check-turns.mjs` checks all levels (also
  gaps and repeated cells) — run it after editing a level. It found three
  120° bends (level 4 lake loop, level 5 lower road at the junction,
  level 6 first U-turn); all rerouted. Levels 1–3 were already fine.
  Bot afterwards: levels 4–6 give 2–3 stars at 100 %, 1–2 at 70 %, lose
  at 40 % and below.
- `?unlock=all` opens every level (testing, teachers); stars untouched.
- 2026-11-21 — **UI scale for big monitors** (owner: UI tiny on a high-
  resolution screen). `main.js` sets the CSS variable `--ui` =
  min(width / 1366, height / 800), clamped to 1–2.2; HUD, dock, question
  card, coach, banner, overlays and menu use `zoom: var(--ui)`; the 3D
  canvas is not zoomed. 1366×768 and smaller stay exactly as before
  (measured identical). 2560×1440 → ×1.8, 3840×2160 → ×2.2. Camera
  insets now use bounding rects so the board still fits beside the card.
  `tools/dev-server.py` = local test server with the site's /lib + /data.

## TODO: phase 1 — shared learning engine (from master, 2026-11-22)

Record every answer with `recordAttempt()` and take rounds with `smart: true`. Recipe: `docs/phase1-game-wiring.md`. Mark it done there and here when finished.
**Done 2026-11-22 by the master session** (release prep): `js/questions.js` `_smartFront()` puts the smart-mix words at the front of the pool at init and on every `resetRun()`; `Questions.record(q, correct)` → `recordAttempt(item, form, correct, 'verb-towers', topic)`, called once per answer in `js/forge.js` `answer()`.
- 2026-11-22 — **Economy: verbs are now required** (owner play-test: won
  level 5 "Two Gates" with archers only and without answering a single
  question; one boss got through).
  - Cause: kill coins (1 per kill) + wave bonus (5) + cheap archers (20
    coins, best damage per coin by far). The bot missed it because it
    mixed tower types and built only between waves.
  - `tools/balance-sim.mjs` now has a third argument, the strategy:
    `mix` (old) or `archers` (archers only, best spots, builds whenever
    it has coins, also mid-wave — like a sharp human). It reads tower
    costs from the game (`__td.CONFIG`) and uses `dev-server.py` (:8125).
  - Changes: kills pay **0** coins (bosses 2; no coin animation for 0),
    wave bonus **3** on every level, archer **30 coins, 20 damage** (was
    20 / 25). Enemy health −10 % on levels 3, 4 and 6.
  - Bot now (archers / mix): 0 % answers = lost on every level (level 1
    around wave 6); 40 % = level 1–2 won (1–3 stars), 3–6 lost; 70 % =
    archers win with 1–3 stars (level 4 about half the time), the weaker
    mix bot loses from level 3; 100 % = 3 stars with archers, 2–3 with
    mix. Archers no longer beat the mixed build at equal answers.
  - **Open:** with all answers right the game is still comfortable (lots
    of coins). If the owner wants more challenge for strong players, the
    next levers are fewer coins per answer later in a level, or tougher
    late waves; not done yet.
- 2026-11-22 — **Round 6 (owner note 6): clear moments, sound and music.**
  - **The castle is the health bar** (`renderer.js` `_addCastle`,
    `_castleHit`, `_syncCastles`): each castle is its own object with its
    own material. An enemy at the gate (`Effects.spawnCastleHit`) makes the
    castle flash coral and squash, throws dust and stone chips, shakes the
    camera briefly (not with prefers-reduced-motion) and sends a heart
    from the castle to the HUD hearts. Smoke rises below 60 % lives,
    smoke + flames below 30 %.
  - **Low lives** (`dangerLives()` = 30 % of the start lives, at least 2):
    HUD hearts pulse coral, a red edge breathes (`#danger-vignette`), and
    a heartbeat joins the music.
  - **Defeat scene** (`state.endT` 2.6 s, a tap or key skips): the world
    greys out, skeletons freeze, the camera glides to the castle, it
    collapses into `building_destroyed` in a dust cloud with smoke, then
    the panel: a broken heart, the title, and one dot per wave (teal =
    survived, coral = where it fell). "Play again" restores the castle
    (`Renderer.onRunReset`).
  - **Victory** (1.6 s): the towers pop one after another, then the panel
    with a castle icon; stars slam in one by one, each with a rising note,
    then confetti.
  - **Not enough coins:** the tower card shakes and a dull "tock" plays.
  - **Audio** (`js/audio.js` rewritten, still 0 bytes of files): master
    about half as loud as before, music clearly under effects. The speaker
    button cycles all 🔊 → effects only 🔈 → off 🔇 (`td3d_sound`);
    `?sound=off` / `?music=off` for teacher links; audio pauses when the
    tab is hidden. Per-sound rate caps (arrows, deaths, explosions,
    coins). New sounds: castle hit, wave horn, star slams, "nope", a
    castle-collapse defeat jingle, softer wrong answer.
  - **Music, soft medieval** in D dorian (Dm–C–Bb–C, 100 bpm): plucked
    lute arpeggios, soft bass, a breathy flute phrase every second bar.
    Battle adds a frame drum and a walking bass; the end screens stop the
    music; low lives add a heartbeat (`Sound.setMood`, `setDanger`).
  - Checked in headless Chromium (1366×768, German): sound button cycle,
    "nope" shake, castle hit with chips and heart, danger state, defeat
    scene and panel with dots, play again restores the castle, victory
    with three stars. No console errors. Not heard by a human yet — the
    music and sounds need the owner's ears.
  - Not built yet (second batch): boss entrance and boss health bar, boss
    music, wave-start pips and icon banner, streak flame, build dust.
- 2026-11-22 — **Round 7: see what a tower does before buying** (owner:
  "can the player see what the towers do before buying them?" — before,
  only a mouse tooltip, nothing on touch).
  - Each tower card has three 5-step bars from the config (`ui._statBarsHtml`):
    ⚔️ damage (ceil(damage/15)), 🎯 range (round(range−1)), ⏱ speed
    (fire rate bands; frost uses 1/cooldown), plus 💥 (cannon, hits a
    group) or ❄️ (frost). Archer 2·3·5, catapult 5·5·2, cannon 4·3·1,
    frost 0·3·1.
  - Mouse hover or a touch long press (420 ms) on a card shows a popup
    with name and description (`#tower-pop`) and, if a hex is already
    chosen, the see-through tower with its range circle there
    (`state.previewType`, `renderer._syncGhost`). A long press never
    buys; a normal tap still builds at once.
  - Checked in headless Chromium at 1366×768 (hover), 1024×768 and
    390×844 (long press): popup, range preview, no purchase on long press,
    tap builds. No errors.
- 2026-11-22 — **Round 8: compact dock, more room for the map** (owner: the
  UI on the right and bottom leaves the map small).
  - Tower cards show only the tower picture, the price and the 💥 / ❄️
    icon. With a mouse over the dock it opens (`#bottom-dock.open`) to the
    full cards with name and stat bars; on touch a long press shows the
    popup, which now carries the stat bars too. The camera fit keeps the
    compact dock height while it is open (`Renderer._compactRowH`), so the
    board does not jump; the open cards briefly cover its bottom edge.
  - "Start wave" is smaller; on phones it sits in the same row as the
    cards. The question card side panel is 230 px (was 268), 220 px on
    short landscape; on phones its streak line is hidden and spacing
    tightened.
  - Dock height 159 → 84 px at 1366×768 (board visibly bigger); phone
    portrait dock + card 381 → 258 px. Tablets 1024×768 are limited by
    width, so the gain there is small.
  - Zoom / pan deliberately not built (owner agreed to try without first):
    it hides part of the road and clashes with tap-to-build on touch.
  - Checked in headless Chromium at 1366×768 (hover open/close, camera
    stable, click builds), 1024×768 and 390×844 touch (long press shows
    stats, never buys; tap hex then card builds), 844×390, 2560×1440. No
    errors.
  - Owner follow-up: the cards keep their width when the dock opens; only
    the height grows (76 px wide on laptops, 72 px ≤1100 px; long Spanish
    names wrap to two lines).
- 2026-11-22 — **Game analytics events** (master request, spec in the
  repo's `docs/game-analytics.md`). New `js/analytics.js` (`Track`) loads
  `/lib/krabsy-game-events.js` and sends: `level_start`, `wave_start`,
  `tower_built`, `tower_upgraded`, `tower_sold`, `not_enough_coins` (card
  shake, key 1–4, or upgrade without money), `wave_end` (leaked enemies,
  answers / correct since the last wave), `level_end` (won/lost, stars,
  wave, lives, active seconds, answers, correct, coins_earned = coins +
  spent − refunds − start coins, towers_built). Levels are 1-based like the
  menu. Back to the menu mid-level sends nothing (= "left"). Without the
  helper (local dev) every call is a no-op; without a parent page (bot,
  tests) the helper only fires a DOM event. Counts only, no words.
  Checked in headless Chromium by listening to the DOM events: all eight
  events with correct values, retry = new `level_start`, quit = nothing.
- 2026-11-23 — **Weak connections** (owner request).
  - `js/retry.js` `withRetry()`: every model and texture download
    (`assets.js` hex models + season atlases, `characters.js` skeletons)
    is retried after 0.6 s, 1.5 s and 3 s before the game gives up with
    `loadError`. A failing `.bin` / texture inside a glTF retries the whole
    file. Retries log a console warning.
  - Three.js is now the official minified `three.module.min.js` 0.169
    (687 KB, was 1.3 MB; from the npm package, whose unminified file is
    byte-identical to the old vendored copy). Import map updated; the
    unminified file is removed.
  - Checked in headless Chromium: 4 files failing twice each → game loads
    and plays, no errors; one file always failing → 4 attempts, then the
    reload message; build-flow regression fine.
- 2026-11-23 — **Round 9: tutorial, fewer questions, map uses the height**
  (owner: upgrades are hidden; fewer questions per round; no questions
  before the money runs out; map still too small).
  - **Questions:** 5 per wave (was 8). Owner chose 5 × 8 coins; the bot
    showed that was harder than before (fewer answers → streak bonus
    rarely reached; 70 % lost levels 4–6), so it is **5 × 9 coins**. Bot
    (2 runs each, both strategies): 0 % = every level lost; 40 % = level
    1–2 won; 70 % = archers win all six (1–3 stars), mix bot wins 1–3 and
    some of 6; 100 % = 3 stars archers, 1–3 mix. Same as before.
  - **Card arrives later (level 1, first time only):** `Forge.newState(hidden)`;
    the card is hidden until the player first can't afford something
    (`Forge.noCoins`: card shake, keys 1–4, chosen hex, upgrade) or after
    wave 1 (`refill`). It fades in with a glow (`#forge-panel.reveal`).
    From level 2 on, and after the tutorial, it is there from the start.
  - **Upgrades visible:** an amber ⬆ badge bobs above every tower whose
    upgrade is affordable (`u.upBadge` sprite in `renderer.js`, hidden
    while that tower is selected; tapping it selects the tower).
  - **Tutorial** (`tutorial.js`): tap hex → pick tower → start wave; the
    card's first appearance → "Out of coins? Answer the question"; as soon
    as an upgrade is affordable → "Tap your tower with the ⬆" (its hex
    glows) → "Now press Upgrade" (button pulses). Finished after the first
    upgrade (or when the level ends after at least one answer).
  - **Camera:** the board uses (almost) the full height. Only the question
    card keeps its space; the top bar overlaps freely and the dock keeps
    only 40 % of its height. The tilt is chosen per screen shape, 50–62°,
    the one that gives the biggest board area (+2 % per step needed);
    in practice 62° on laptop, tablet and phones, so the board is taller
    and hexes are bigger tap targets.
  - Checked in headless Chromium: the full tutorial flow at 1366×768
    (mouse), 1024×768 and 390×844 (touch) — card hidden, appears on the
    "nope", answer hint, ⬆ badge, upgrade hint and button pulse, done flag;
    camera at 1366×768, 1024×768, 390×844, 844×390, 1920×1080. No errors.
- 2026-11-23 — **Camera control: zoom and pan** (owner request).
  - `renderer.js` `_view` {zoom 1–2, panX, panZ} on top of the fitted view;
    `zoomAt()` keeps the ground point under the pointer, `panTo()` keeps a
    grabbed ground point under the finger; pan is clamped so the board
    never leaves the screen; `resetView()` glides back (wall-clock).
  - Mouse: wheel zooms toward the pointer; left-drag (> 6 px) pans, a
    short click still taps on release; right / middle drag pans; a right
    click without moving still cancels placement. Keys `+` / `-`.
  - Touch: one finger taps on release (if it did not move > 10 px) or
    drags the map; two fingers pinch-zoom and move. Taps now act on
    touchend instead of touchstart.
  - ⤢ button in the top bar, only while zoomed: back to the whole map.
    New level, play again, victory, defeat and the menu also return to
    the whole map (the defeat scene starts from it).
  - Menu hint mentions "Mausrad: zoomen".
  - Checked in headless Chromium: 1366×768 (wheel, drag, click builds
    after zoom, `-`, fit button, zoom out stops at the whole map),
    1024×768 and 390×844 touch (pinch, one-finger drag, tap builds while
    zoomed, fit button); regressions: build flow, tutorial, analytics
    events. No errors. Under heavy machine load a test tap can land while
    the camera re-fits (seen once in a parallel run, passes alone).
- 2026-11-24 (master session): plays any topic properly. `js/i18n.js`
  `TOPIC_TEXT` (subtitle, menu example line, recap heading per topic;
  prepositions and Spanish `es_ser`), `js/questions.js` passes the game's
  `lang` to `getQuizSet` (teach lines were in the stored site language),
  `js/ui.js` shows `teach.line` under "This is right:" for sentence topics
  (`.forge-teach` in `css/game3d.css`). Checked headless: es_ser/en
  (menu, forge, wrong-answer rule in English), verbs/de unchanged.
  Served in the Spanish section: `/en/spanish/games/verb-towers/`.


- 2026-11-27 — **Round 10: guidance for first-time players, archer first**
  (owner: players without tower-defense experience don't know what to do;
  force the archer tower first, the others are weak openers).
  - **Archer first, every level:** catapult, cannon and frost are locked
    until an archer tower stands (`isTowerLocked()` in `main.js`; locked
    again if the last archer is sold). Locked cards show an SVG padlock
    (no emoji); a tap shakes the card and says "Bau zuerst einen
    Bogenturm." above it; keys 1–4 and `Input._place` refuse too; hover /
    long press shows the popup without a ghost model. Both bot strategies
    open with an archer, so balance is unchanged.
  - **Tutorial** (level 1, first time; `tutorial.js`), now 7 steps: amber
    arrows flow along every road to the castle with "Skeletons walk this
    road to your castle. Tap a glowing hex next to it!" → "Take the archer
    tower: it shoots fast" (only the archer card pulses) → "Your tower
    shoots by itself at anything in its circle. Start the first wave!"
    with the tower's range circle pulsing → wave 1: "Watch: your tower
    stops the skeletons" (circle stays) → question card → upgrade → new
    last step "Build a second tower next to the road" (glowing hexes).
    Finished after an upgrade plus a second tower, or when the level ends.
  - Renderer: `_syncTutorialMarks()` (road arrows from `paths[].waypoints`,
    `state.hintRoad`; range disc for `state.hintRange`).
  - Checked in headless Chromium, full tutorial at 1366×768 (de), 1024×768
    touch (es) and 390×844 touch (de): every step, locked-card message,
    done flag. No errors. Under heavy machine load one tablet run missed
    the first hex tap (camera and touch events were fine in 8 reruns).

- 2026-11-27 — **Round 11: training level** (owner: a pure tutorial level,
  very short, straight road, 1–2 waves, every step forced). Owner chose:
  new players must finish it before level 1; the level-1 tutorial goes.
  - `levels/training.js` (`window.LEVEL_TRAINING`, `training: true`): 11×5,
    one straight road, 2 waves (2 then 3 slow skeletons), 30 start coins
    (one archer), `orePerWave: 99` so answers never run out there.
  - It is level index **-1** (`TRAINING_INDEX`, `levelAt()` in `main.js`),
    so levels 1–6 keep their indices, stars, records and analytics
    numbers; training reports `level: 0`. Storage: `td3d_stars_training`,
    `td3d_highscore_training`. Menu: "Training" card first (teal border).
  - Unlock: level 1 opens after the training, or at once for players with
    `td3d_tutorial_done` (old tutorial) or stars on level 1. Winning the
    training sets `td3d_tutorial_done`.
  - **Forced steps** (`tutorial.js`, training only): `state.gate` = what is
    allowed (`cells`, `cards`, `tower`, `start`, `upgrade`, `answers`),
    checked in `input.js` (taps, keys), `wave.js` (start), `forge.js`
    (answers), `main.js` (upgrade; no selling), `ui.js` (cards, dimmed start
    button, no sell button). Steps: road arrows + tap the one glowing hex →
    archer → range circle + start wave 1 → watch → card appears: "answer,
    collect 30" → tap tower → upgrade → start the last wave → "you can
    answer during a wave too" → victory.
  - Level 1 has no coach and no hidden card any more.
  - Checked in headless Chromium at 1366×768 (de), 1024×768 touch (es),
    390×844 touch (de): locked level 1, wrong hex / early start / catapult
    ignored, every step, a wrong answer on the way, victory with 3 stars,
    level 1 opens without coach. Bot on level 1 unchanged. No errors.

- 2026-11-27 — **Training follow-up** (owner): 2 questions, not 3, then the
  card is empty; and the owner prefers building card first, then the map.
  - `trainingRightAnswers: 2` in `levels/training.js`: after the 2nd right
    answer the card's ore is set to 0 ("Leer! Starte die nächste Welle.");
    wrong answers never empty it. Wave-1 bonus in training 3 → 12, so
    12 + 2 × 9 = exactly the 30-coin upgrade.
  - Training builds card first: "Pick the archer tower below" (only the
    archer card works), then "Now tap the glowing hex next to the road"
    (only that hex). Wave 2 line is now "Watch: your stronger tower hits
    two skeletons at once" (the card is empty then). Unused tutorial
    strings removed. Normal levels still accept both build orders.
  - Checked in headless Chromium at 1366×768 (de) and 1024×768 touch (es):
    hex before card ignored, wrong hex ignored, 1 wrong + 2 right answers →
    card empty with 30 coins, upgrade, victory, level 1 opens. No errors.

- 2026-11-27 — **Towers arrive level by level** (owner idea; owner chose the
  order): training + level 1 = archer only, level 2 adds the catapult,
  level 3 the cannon, level 4 frost; levels 5–6 have all four.
  - Level files: `towers: [...]` (dock list; all when missing) and
    `newTower` (levels 2–4). `main.js`: `availableTowers()`,
    `towerAvailable()`; `Input._place` / `toggleTowerPlacement` refuse
    others; keys 1–4 follow the visible order; hidden cards in the dock.
  - **Intro card** (`#tower-intro`): at the start of a level with a new
    tower, the first time only (`td3d_tower_seen_<type>`): "New tower!",
    the tower picture, name, description, stat bars, "Let's go". While it
    shows, no wave start, no answers, no building (`state.intro`). The new
    card then carries an amber "NEW" tag until it has been built once.
    Archer-first lock still applies.
  - `tools/balance-sim.mjs`: towers a level lacks become archers; marks
    intros seen. Bot (2 runs, levels 1–4): archers as before (0 % lost,
    40 % wins 1–2, 70 % wins 1–3 and level 4 about half, 100 % 3 stars);
    mix bot level 1 and 2 now win at 40 % (only archers / catapults),
    level 3–4 lost at 70 % as before.
  - Checked in headless Chromium at 1366×768 (de) and 390×844 (es): dock
    per level, intro shows once, Space blocked while it shows, "Let's go"
    closes it at once, NEW tag. No errors.

- 2026-11-27 — **Open task from the master session:** four new English sentence topics (en_simple_past, en_present_simple, en_present_progressive, en_present_perfect; `content/en-*.json`, in games.json for this game) fall back to the irregular-verbs menu texts (go → went). Add one shared English-sentences entry to the topic text table, like the es_* fallback (e.g. `/^en_/` → `en_sentences`), with subtitle/example/"Sätze zum Üben" in DE/ES/EN. Test `?topic=en_simple_past&lang=de`, commit, don't push, tell the master.
