# Verb Valley — game brief

You are the **game session** for Verb Valley on **Krabsy** (krabsy.com): a
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
- **Grammar drives progress all the time:** no clean plates, no serving,
  about one question per served order.
- **Fixed camera, simple controls:** it plays on a Chromebook and a touch
  tablet.
- **Short levels with stars** (about 3 minutes), which fits a lesson.

## The game

A cozy 3D farming life-sim (Stardew Valley's loop at browser size). You
spend the summer on your grandparents' coastal farm. Each morning starts at
the beach school with **Professor Krabsy**, a scholarly crab; after class
you farm. Sleeping saves the game and grows the crops. The world is kind:
nothing dies, there is no fail state.

## What exists (PoC, last worked on 2026-06-11)

`index.html` + `src/` (about 3,000 lines): config, verbs, audio, save,
world, daycycle, player, farming, fishing, school, ui, game, assets. The
Status log at the bottom has every detail; in short:

- **Day loop:** wake → school (8 chalk questions on a 3D blackboard,
  opens at wake) → farm → sleep (save + growth). One day is 7–8 minutes.
  Bed works at any hour.
- **School:** 5 coins per correct answer, a rare seed at 6+ correct, a
  sticker at 8/8, one class per day. Missed verbs persist; the next class
  opens with a review question.
- **Farm:** 24 plots (till, plant, water, harvest), 12 crops with a crop
  album, shop tiers, a rare-seed ladder from school, a hay meadow, 5
  trees, a quarry (stone, gold, gems), pond fishing, instant selling at
  the crate.
- **Hard gate:** all farm work is locked until you attended school that
  day.
- **Look:** KayKit Ranger with real animations and tools in hand; KayKit
  trees, rocks, crates. Krabsy, cottage, school and crops are still
  procedural. Day/night cycle with dusk, fireflies and stars.
- **Save:** localStorage `krabsy_vvalley_save`, schema v3 with migrations.
- **QA:** `window.__VV` hook and `?qa=` frozen scenes (morning,
  school-open, field-with-crops, dusk, night).

Known weaknesses:
- **`assets/` is missing on this machine.** It is a gitignored working
  copy and is not on disk here, so the game will not load until
  the models are copied again. The manifest in `src/assets.js` lists every
  file; the sources are in the shared library (see Assets). Do this first.
- **Grammar is front-loaded:** 8 questions at school, then about 6 minutes
  of farming with no English at all. This is the main design problem.
- **No touch controls.**
- Three.js and fonts come from **CDNs** (unpkg, Google Fonts).
- UI is **English only**.
- The blackboard still uses grammar terms (`src/school.js`); check it
  against the mandate below.
- Verbs are inlined, not from the question engine.
- Scope has grown fast (fishing, mining, meadow). There is no short
  "session" a teacher can plan around.

## Direction for the full game (proposed by the master session)

The owner said yes to the game. He has **not** yet confirmed the points
below one by one. Your first task is to check them against the PoC and
come back with a short plan.

1. **Spread the grammar through the day** instead of one block at school.
   The Kitchen pattern is a chore station you visit when you choose, and
   that the work depends on. Ideas to weigh:
   - The **well**: the bucket holds water for about 6 tiles; refilling it
     is one question.
   - **Seed packets** open with a question; rare seeds need harder verbs.
   - The **shop keeper** or the sell crate gives a better price for a
     correct answer.
   - School stays, but shorter (3–4 questions), as the daily start and the
     place for review of yesterday's misses.
   Keep the owner's core rule in spirit: no learning, no farming.
2. **Camera and controls for school devices:** a calm, mostly fixed
   high camera that needs no camera input. Touch: virtual stick, one
   action button, tappable hotbar and inventory.
3. **A plannable session:** one in-game day should be a satisfying unit of
   about 5–7 minutes with a clear end (the sleep card with the day's
   results and missed verb chains). Consider daily goals ("grow 3
   turnips") with 1–3 stars so a class has something to compare.
4. **Shared school devices:** saves live in localStorage, so several kids
   may share one browser. Offer named save slots or at least a clear
   "New farm" path, and keep the first day fun without any save.
5. **Finish the look:** replace the remaining procedural pieces (cottage,
   school, crops, Krabsy) where good models exist; keep the dusk showcase.
6. **Stop adding systems** until the above is done. Animals, villagers,
   festivals and building stay on the later list.

Suggested milestones: M0 clean base (restore `assets/`, vendored Three.js,
self-hosted fonts, noindex meta) → M1 grammar spread through the day on the
question engine, no terminology, DE/ES UI → M2 camera + touch → M3 models
for cottage, school, crops, Krabsy → M4 first-day tutorial, daily goals,
save slots → M5 polish, device tests, size check, then "ready for review".

**First task:** restore the assets, play three in-game days, read the
code, then propose a short plan to the owner (where the questions go,
camera, session shape, milestones). Get an OK before big rewrites.

## Assets: shared CC0 library

`/home/janah/dev/_assets/` (about 3.4 GB, all CC0; see its `README.md`).
It is read-only: copy only the files you use into `assets/` here and list
each pack in `assets/CREDITS.md`.

- Already wired (see `src/assets.js` and the 2026-06-11 log entry):
  `kaykit/KayKit_Adventurers_2.0_*` (Ranger),
  `KayKit_Character_Animations_1.1`, `KayKit_RPGToolsBits_1.0_EXTRA`,
  `KayKit_FantasyWeaponsBits_1.0_FREE`, `KayKit_Forest_Nature_Pack_1.0_EXTRA`,
  `KayKit_ResourceBits_1.0_EXTRA`.
- Worth checking for the missing pieces: `quaternius/` and `tinytreats/`
  (crops, farm buildings), `ultimateanimatedanimals/` (later: animals),
  `kaykit/KayKit_Furniture_Bits_1.0_SOURCE` (cottage),
  `kenney/nature-kit`, `kenney/fantasy-town-kit`.
- Crab mascot (optional, for Professor Krabsy):
  `/home/janah/dev/BlobVideos/renderers/assets/crab.glb`, rig contract in
  `/home/janah/dev/BlobVideos/docs/asset_spec.md`. Ask the owner first.
- **`assets/` is gitignored here** (`.gitignore` in this folder). For a
  release the used files must be tracked. Agree with the master session
  how (Tower Defense tracks its `assets/` in the game folder).

Rules: GLB/glTF only. Whole download **≤ 15 MB**, first playable screen
within a few seconds on a school Chromebook. Share materials, merge static
geometry, one shadow light.

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
  positional notation (`go → ___ → gone`, asked blank highlighted) or a
  sentence gap (`My birthday is ___ July.`). Terms only as small captions
  or in the feedback after an answer.
- After a wrong answer Professor Krabsy shows the full chain
  (`go → went → gone`).
- Form colours site-wide: base = amber, past = teal, participle = coral.
- Question data from `homepage/lib/krabsy-questions.js` (`getQuizSet`,
  topic from `?topic=`; it covers verbs and prepositions), with a small
  inline fallback for offline dev. Canonical lists are in `content/`.
- Keep the **missed-verb review** across days. It is the teaching core.
- **UI in German and Spanish** (verbs stay English), chosen by
  `?lang=de|es`. See Verb Kitchen's `src/i18n.js`.
- **First 30 seconds:** clear goal, playable within about 10 s, day 1
  teaches by doing, nothing punishes a beginner.
- **Devices** (test all three): 1366×768 laptop with keyboard; 1024×768
  touch tablet/Chromebook (must be fully playable); 390×844 phone
  (playable, or an explicit friendly message).
- Site style: teal `#2ee6c0`, coral `#ff8585`, amber `#ffcf5e` on deep
  navy. Sound via WebAudio synth or small CC0 files; mute toggle persisted.
- Never break existing saves without a migration (see `src/save.js`).

## Verification notes (from the PoC)

- The preview tool's screenshot can hang on this 3D app. Headless
  Chromium/Edge with the `?qa=` scenes works.
- Drive the full loop through `window.__VV` and assert each step (school →
  unlock → plant → water → sleep → grow → harvest → sell), plus a
  save/load round trip across a reload.

## Working agreement

- Work in `/home/janah/dev/krabsy-homepage/games/verb-valley/` on `main`.
  There is one shared checkout; other sessions work in it at the same time.
- Stage only this folder (`git add games/verb-valley`, never `git add -A`
  or `git stash`), commit with the Co-Authored-By trailer. **Don't push.**
- End every session by updating the **Status log** below: what changed,
  what's next, open questions for the owner.
- The owner prefers short, step-by-step explanations in chat. Ask before
  big design decisions.
- When it's ready for review, say so in the Status log. The master session
  then play-tests and releases it to `homepage/games/verb-valley/` with
  wrappers `/de/spiele/verb-valley/` and `/es/juegos/verb-valley/`.

## Status log

- 2026-06-10 — PoC brief written by the master session (the original PoC
  brief is in git history: `git log -- games/verb-valley/CLAUDE.md`).
- 2026-06-10 — **PoC built and verified.** `index.html` + 10 modules in
  `src/` (config, verbs, audio, save, world, daycycle, player, farming,
  school, ui, game). Everything in the brief's daily loop is in:
  - **School:** 8 chalk questions on the 3D blackboard (raycast-clickable
    chips + keys 1–3), form-color convention (past=teal, pp=coral,
    prep=amber), wrong answers show the full chain, rewards 5c/correct,
    special star-fruit seed at 6+, sticker at 8/8, one class per day.
    Missed verbs persist in the save; the next class opens with a review
    question and a correct answer graduates the verb off the list.
  - **Farm:** 24 plots (till/plant/water/harvest), 4 crops, growth on
    sleep via `advanceDay()` in save.js, 5 regrowing trees + axe (50c),
    daily wild berries, shop stand, shipping crate that pays on sleep.
  - **Hard gate verified:** every farm action routes through one gated
    wrapper in game.js; pre-class attempts return `school-gate` and show
    the shrug bubble. Berry-picking is deliberately ungated (gives the
    06:00–08:00 window something to do).
  - **Day/night:** keyframed sky/fog/sun/ambient, sun arc with one shadow
    light, golden dusk, emissive cottage windows, fireflies + stars
    (soft-dot sprite texture — plain Points render as squares), morning
    fog, sleepy vignette, WebAudio cricket/bird ambience.
  - **Verification done:** `?qa=` scenes (morning, school-open,
    field-with-crops, dusk, night) screenshotted via headless Edge;
    `window.__VV` drove the full loop — 37 assertions PASS (gate,
    class rewards, review graduation, plant→water→sleep→grow→harvest→
    ship→coins, shop, axe+tree regrow, berries, save/load round-trip
    across a reload). Zero console errors. `__VV.benchmark()` (rAF-free,
    because the preview panel suspends rAF): 13.6 ms/frame at dusk ≈ 74 fps.
  - `.claude/launch.json` serves this folder on :8132 via WSL python3.
  - **Known gaps for v1.1:** touch controls, watering-can refills,
    sticker row only shows in HUD + sleep card (no cottage interior),
    class camera is a fixed angle, no Krabsy idle dialogue.
- 2026-06-10 — **Playtest round 1 (user feedback).** Three changes:
  - **Inventory panel** (left edge): seed bags (burlap chip with the crop
    printed on it) + harvested produce, each with counts. Clicking one
    holds it over the player's head (oversized 1.5× so it reads at
    camera distance; arms raise). Holding a seed bag + E on tilled soil
    plants that seed — this replaced the hotbar seed slot, so the hotbar
    is now 3 tools (1 hoe, 2 can, 3 axe; 4 cycles held seed). When the
    held seed/produce runs out it auto-stows back to the hoe.
  - **No more dead waiting** (user: "I just had to wait"): school opens
    at wake (06:00) instead of 08:00, and bed works at any hour. Class
    advances the clock +60 min instead of snapping to 09:00.
  - Selection model lives in ui.js (`{kind:'tool'|'seed'|'item', id}`);
    game.js mirrors it onto the rig via the onSelect hook.
  - Re-verified: 15 assertions on the new behaviors + core-loop
    regression all PASS, zero console errors, screenshots checked
    (inventory panel, active-seed highlight, held bag visible).
- 2026-06-10 — **Playtest round 2 (user feedback).**
  - Berry pickup (and every acquisition path) refreshes the inventory
    panel immediately — the panel is the live source of truth.
  - **Selling pays on the spot** at the crate ("Sell", not "Ship") —
    the overnight-crate Stardew homage read as a bug to the player.
    `advanceDay()` still drains a legacy crate so old saves pay out.
  - 7 assertions PASS (E-path berry pickup → panel chip, instant +coins,
    crate stays empty, harvest section hides when empty, sleep pays 0).
- 2026-06-10 — **Playtest round 3 (user feedback): more to do every day.**
  - **Crop album** (📖 chip in HUD): 12 crops, goal 100%. First harvest
    of a type collects it (toast + star sfx; completing all 12 grants a
    sticker + celebration). School rares show as ??? until grown.
  - **Crop catalogue expanded to 12** with shop tiers: tier 2 unlocks at
    3 distinct crops grown, tier 3 at 6 (enforced in `buy()`, not just
    the UI). School ladder star → moon → rainbow fruit advances strictly
    by what you've GROWN — holding an unplanted rare seed yields dupes,
    so rainbow fruit stays genuinely late-game.
  - **Hay meadow** (24 tiles, NE): scythe (new free tool, key 3) cuts
    tall hay → +1 hay (4c), water the stubble → regrows overnight,
    unwatered stays stubble. School-gated like all farm work. This is
    the daily money grind that fills the long afternoon.
  - **Tools render in hand**: hoe/can/scythe/axe primitive builds parented
    to the right hand (they ride the arm swing); selecting a seed/produce
    stows the tool and hoists the bag instead.
  - Save schema v2 with a real v1 migration (keeps day/coins/stickers/
    missed verbs, adds hay/collection/scythe, infers album from held
    produce) — verified with a crafted v1 save through a real reload.
  - 28 assertions PASS this round; zero console errors.
- 2026-06-11 — **Asset rebuild (user-requested): KayKit packs replace the
  procedural look, plus mining + fishing.** The game now loads GLTF
  assets at boot (new `src/assets.js`, manifest of ~35 models staged
  into `assets/` — copied from the shared library, gitignored via this
  folder's own `.gitignore`).
  - **Packs used:** Adventurers (Ranger player), Character_Animations
    (Rig_Medium MovementBasic/General/Tools clip sets), RPGToolsBits
    (shovel/bucket/pickaxe/axe/lantern), FantasyWeaponsBits (sword_B),
    Forest_Nature (trees/bushes/rocks/grass), ResourceBits (crates, wood,
    stone, gold, gems, berry baskets). **Gotcha:** GLTFLoader sanitizes
    bone names — `handslot.r` arrives as `handslotr`. KayKit hand tools
    fit the hand slot with an **identity transform** (no rotation needed).
  - **Player:** Ranger with real animations — Idle/Running locomotion
    crossfades, one-shot work clips (Dig=till, Use_Item=water, Chop=hay+
    trees, Pickaxe=mine), Holding_A as the carry pose, full Fishing_* set.
    Tools snap onto the hand-slot bone; fishing rod stays procedural (no
    rod in any pack). Krabsy, cottage, school, crops stay procedural.
  - **Tool remap (user-decided):** shovel tills, bucket waters, sword
    cuts hay (the "katana" ask → sword_B; no katana in the pack), axe
    chops. Hotbar is 6 slots (keys 1–6; 7 cycles seed); save schema v3
    migrates v2 tools (hoe→shovel, can→bucket, scythe→sword) — verified
    with a crafted v2 save through a real reload.
  - **NEW Quarry** (west edge, 6 nodes; user chose "mining AND meadow"):
    pickaxe 60c in the shop; nodes are weighted rolls stone 6 / gold 2 /
    gem 1 (deterministic per day+slot, integer-hash mixed — a first
    naive mod-997 hash gave 2 gems on day 1), drops stone×2 @6c /
    gold @28c / gem @48c, mined nodes regrow overnight as a fresh roll.
    School-gated like all farm work.
  - **NEW Pond fishing** (pulled from v1.1 at user's choice): rod 40c;
    E casts → wait 1.2–3.6s → bobber dips (0.9s bite window) → E lands
    fish 18c (10% goldfish 60c); moving or sleeping cancels, misses just
    retry. State machine in `src/fishing.js`; `__VV.setFishingRng()`
    makes it deterministic for QA.
  - **Verification:** 36 gameplay + 6 save-persistence + 8 migration
    assertions all PASS; zero console errors; school/dusk/night `?qa=`
    scenes screenshotted (the preview-panel screenshot hang struck again;
    headless Edge workaround held, write the PNG to a Windows-local dir).
    Benchmark at dusk: 12.3–23 ms/frame (noisy panel environment;
    best-case matches the pre-rebuild 13.6 ms; the scene is light —
    272 draw calls / 21k triangles).
  - QA additions: `__VV.zoom(f)`, `__VV.face(rad)`, `__VV.playAction()`,
    `__VV.mine/startFishing/fishPress/tickFishing/fishingPhase/
    cancelFishing/setFishingRng`, plus `window.__SCENE/__THREE/__RENDERER`.
  - **Known gaps for next round:** rod model is procedural; class leaves
    the Ranger standing at the bench (no sit clip wired); hay blades are
    still procedural cones (no hay model in the packs); grass tufts read
    thin from the follow-cam distance.
- 2026-11-21 — **Owner decision: build the full game.** The master session
  replaced the PoC brief with this one. Nothing changed in the code.
  `assets/` is missing locally (see "Known weaknesses"). **Next:** the
  first task above (restore assets, play, propose a plan).
- 2026-11-22 — **Assets restored + three days played; plan proposed
  (awaiting owner OK).**
  - `assets/` rebuilt from the shared library (34 manifest files + their
    `.bin`/texture deps, 4.4 MB) with `assets/CREDITS.md`. Still
    gitignored. `.claude/launch.json` pointed at an old path
    (`/home/jan/...`) and is fixed.
  - Played days 1–3 in headless Chromium through `window.__VV` and took
    screenshots: loads with zero console errors, 4.3 ms/frame. The school
    gate, class rewards, missed-verb review on the next morning, growth,
    harvest and the album all work.
  - **Findings:**
    1. The blackboard asks `past participle of BEGIN?` /
       `simple past of SLEEP?`: terminology as the question, which breaks
       the mandate (`src/verbs.js` `makeVerbQ`). The preposition questions
       (`My birthday is ___ July.`) are fine.
    2. Grammar = 8 questions at about 06:00, then zero for the rest of
       the day. The bucket has unlimited water, so nothing in farming
       needs English.
    3. The follow camera sits low behind the player: signs (Sell, Hay,
       Quarry) are unreadable, the empty sky/off-map void fills the top
       third, and trees hide the player at the school bench.
    4. Keyboard only. On 1024×768 there is no way to move; on 390×844
       the HUD overlaps (coins over the album chip) and the inventory
       covers the field.
    5. Crops, cottage, school and Krabsy are still procedural. Kenney
       `nature-kit` has crop stages (`crops_cornStageA–D`,
       `crop_pumpkin`, `crop_carrot`, dirt rows, fences): a real option
       for crops.
    6. Good base for the rework: every farm action already goes through
       one `gated()` wrapper in `src/game.js`, so new question stations
       hook in at one place.
  - **Proposed plan (needs owner OK):**
    - **Questions spread through the day, Kitchen sink pattern** (self-
      paced, the work depends on it, wrong = chain shown + fresh question,
      nothing lost, clock pauses while a question is open):
      - **School** shrinks to 4 questions (opens with yesterday's review
        verb). It still unlocks the farm and gives the rare seed.
      - **The well (main station):** the bucket holds water for 6 tiles,
        refilling is 1 question. About 3–5 per day, rising as the field
        grows.
      - **Selling at the crate:** answer one question for a +50% price on
        that batch (optional, so selling never blocks).
      - Target is about 10–14 questions per day, all from
        `krabsy-questions.js` `getQuizSet` in positional notation
        (`go → ___ → gone`) and `chainOrder` pairs.
    - **One day = one lesson unit (about 6 min):** a daily goal card in
      the morning ("harvest 3 turnips", "fill the well 4×") with 1–3
      stars on the sleep card, next to the day's missed chains.
    - **Camera:** a high, fixed-angle camera (like Kitchen) that follows
      the player loosely and needs no camera input. Signs get bigger.
    - **Touch:** a virtual stick plus one big action button; the hotbar
      and inventory are already tappable chips.
    - **Freeze the scope:** keep fishing/quarry/meadow as they are, add
      nothing new.
  - **Milestones:** M0 clean base (vendored Three.js + fonts, noindex,
    no-terminology fix): about 1 session. M1 question stations + DE/ES:
    2 sessions. M2 camera + touch: 1–2. M3 models (Kenney crops, cottage,
    school, crab): 1–2. M4 daily goals, first-day tutorial, save slots:
    1–2. M5 device tests + review: 1. **Total about 7–9 sessions.**
  - **Open questions for the owner:** (a) well + crate + short school as
    the question stations? (b) OK to make the camera high and fixed?
    (c) Use the BlobVideos crab for Professor Krabsy? (d) How should
    `assets/` be tracked for release (copy Tower Defense)?
- 2026-11-22 — **Owner OK'd the plan ("go with it"). M0 done, M1 core
  done (question stations); DE/ES UI still open.**
  - **M0:** Three.js 0.169 vendored (`vendor/three/`, copied from Verb
    Kitchen, import map) and fonts self-hosted (`fonts/fonts.css`; Nunito
    is a variable font, so one file covers all weights). Added
    `noindex, indexifembedded`. Verified: no third-party requests.
  - **New `src/questions.js`** (deck shared by every station): uses the
    question engine (`/lib/krabsy-questions.js`, `?topic=`) with the
    inline lists in `verbs.js` as fallback (local dev 404s on `/lib/` by
    design). Verbs come as **chain-order pairs** (`go → ? → ___`, then
    `go → went → ?`); other topics as single sentence gaps. Easy tiers
    come first. Missed items go to `state.school.missed` (the next class
    opens with them) and are asked again **the same day** 3 units later
    (Kitchen re-ask). Answering a review fully right graduates it.
    `buildClass`/`makeVerbQ` (with the grammar-term prompts) are removed.
  - **New `src/quiz.js`:** one DOM question card for all stations: big
    tappable chips plus keys 1–3, asked blank highlighted in its form
    colour (2nd teal, 3rd coral, base amber). Wrong = Professor Krabsy
    shows `go → went → ___` (never reveals the 3rd form before it is
    asked) or the full chain, or for gaps the sentence with the answer.
    The clock pauses while it is open.
  - **School** = 4 questions (2 pairs; review first). 5 coins per right
    answer, rare seed at 3+/4, sticker at 4/4. The 3D blackboard mirrors
    the question in chalk (no more board raycast).
  - **The well** (new, procedural, west of the field, `LAYOUT.well`):
    the bucket holds 6 waterings (`state.water`, HUD chip 🪣 n/6, pulses
    when empty). Field and hay watering use it. A refill asks one pair:
    +3 water per right answer (a gap topic fills all 6). It opens after
    school. A new farm starts with a full bucket.
  - **Krabsy's deal** at the sell crate: optional, one pair, +25% per
    right answer on the next sale (shown in the panel, reset after it is
    applied).
  - **Sleep card:** "English today: x / y ✓" plus the missed chains to
    practise tomorrow. `state.today` is reset by `advanceDay`.
  - **Save v4** (`water`, `saleBonus`, `today`). v3→v4 migration is
    verified, and the v1/v2 chains now run through to v4.
  - **Verified** (headless Chromium; test script in the session
    scratchpad): 26 checks pass on both the inline and engine paths
    (served `homepage/lib`+`data` next to the game via symlinks on
    :8133). They cover: positional prompts with no terms, follow-up shows
    the 2nd form, class 4 Qs/coins/unlock, bucket 6 then empty, well
    partial/full refill, refusal when full, clock pause, same-day re-ask,
    deal +50% sale, sleep English summary + chains, next-day review +
    graduation, save round trip, v3 migration, zero console errors
    (engine path), no third-party hosts. `?topic=prepositions` works on
    the engine.
  - **QA API changes:** `__VV.answer(i)` answers the open panel;
    `flush()`, `quizOpen()`, `currentStep()`, `solve(right)`,
    `solveAll(pattern)`, `attendClass(nRight)` (async), `useWell()`,
    `deal()`, `questions()`. `startClass` no longer takes a seed.
  - **Next:** M1 rest = DE/ES UI (`src/i18n.js` like Kitchen; all UI
    strings are still English). Then M2 camera (high, fixed) + touch
    (stick + action button) + phone HUD (the top-right chips overlap at
    390 px). Watch in play-tests: whether ~10 questions/day feels right,
    and whether the deal is found without a hint (the daily goals in M4
    can point to it).
