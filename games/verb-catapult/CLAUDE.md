# Verb Catapult — game brief

You are the **game session** for Verb Catapult on **Krabsy** (krabsy.com):
a free browser site where German- and Spanish-speaking kids (about 10–14)
practise English irregular verbs. Read the repo-root `CLAUDE.md` once for
the site rules, then work only in this folder. The master session releases
games (wrapper pages, `games.json`, sitemap, deploy). You don't touch
`homepage/` or other games, and you don't push or deploy. Stage only this
folder, in the same command that commits: `git add games/verb-catapult && git commit …`.

Status: **brief written 2026-11-22 on the owner's request, nothing built yet.**

## Why this game

The owner wants a game that copies a **proven mechanic** instead of a new
invention, and named the Angry Birds kind: a slingshot/catapult, physics,
towers that fall down. We copy the **gameplay only**: our own name, our
own characters and the KayKit look. No birds, pigs, names, art, sounds or
level layouts from that game.

It also fits what makes Verb Kitchen work (see `games/verb-kitchen/CLAUDE.md`):

- **Self-paced question moment.** Between shots nothing moves; the player
  answers when ready, and only then aims.
- **Grammar drives progress.** No answer, no stone.
- **Fixed camera, simple controls.** The whole scene is visible; one drag
  aims, the same on mouse and touch.
- **Short levels with stars.** One castle takes 1–2 minutes.

## The game

Goofy skeletons (KayKit Skeletons) have built wobbly forts of crates,
planks and stone blocks on a meadow. Krabsy's catapult stands on the left.
Knock down every skeleton to win the castle.

### Core loop (one shot)

1. The stones lie in a basket next to the catapult (the count shows how
   many shots are left). The player taps the basket / presses Space →
   the **question card** opens (same pattern as Verb Dungeon's card:
   large, centred, the scene dimmed and paused, chips 1–3 or tap).
2. **2nd form right** (`go → ___ → ___`): a normal stone drops into the
   catapult.
3. Right after it, the **3rd form** is asked with the 2nd filled in
   (`go → went → ___`, the chain-order rule). **Right = the stone is
   upgraded** to a special stone (see below). Wrong = it stays a normal
   stone. So the 3rd form is a bonus, never a block.
4. **Wrong 2nd form:** the chip greys out, the teach line shows the chain
   as far as allowed, the stone **crumbles** (the shot counts as used),
   and the verb comes back later. A new card opens for the next stone.
5. Drag back from the catapult, release, watch the fort fall.
6. When everything has stopped (or after 4 s), the next shot.

Questions per castle ≈ shots × 2 (pairs). A level of 3–4 castles asks
about 15–25 questions in about 4 minutes.

### Special stones (earned by the 3rd form)

Introduced one per level so the player learns them one at a time:

| Stone | Effect | From level |
|---|---|---|
| Big stone | heavier, smashes stone blocks | 1 |
| Split stone | tap in flight → splits into three | 2 |
| Barrel bomb | explodes on impact (KayKit barrel) | 3 |
| Cannonball | fast and flat, flies through wood | 4 |

The game picks the special stone of the castle (one type per castle), so
the player doesn't have to choose.

### Stars and scoring

- Points for each skeleton knocked over, each block broken, and every
  stone left over at the end.
- Stars from the points (3 thresholds per castle, set in the level data).
- **No hard losing:** when the stones run out and skeletons are still
  standing, the player gets one extra stone ("One more try!"), but the
  castle can then give at most 1 star. After that one, the castle counts
  as done and the next one opens.
- Results screen like Kitchen's: stars, points, verbs answered right,
  missed verbs listed for review.

### Levels (6, each 3–4 castles)

| Level | Theme | New element |
|---|---|---|
| 1 | green meadow | wooden crates and planks; big stone |
| 2 | farm (hay bales, carts) | split stone; skeletons on high towers |
| 3 | stone fort | stone blocks that only big stones / bombs break; barrel bomb |
| 4 | harbour (boats, crates) | cannonball; forts behind walls |
| 5 | night castle (torches) | skeleton mages with shields (need two hits) |
| 6 | the skeleton king's castle | the Skeleton Golem as a boss in the last castle |

Level 1 castle 1 is the tutorial: one skeleton on one crate, one stone.

## Assets

The shared KayKit library is at `/home/janah/dev/krabsy-homepage/assets/`
(gitignored, CC0; some packs are symlinks into `/home/janah/dev/_assets/kaykit/`).
Copy only the models you use into `games/verb-catapult/assets/`, and keep
the first load small (Verb Dungeon loads about 3.4 MB).

- **`KayKit_Medieval_Hexagon_Pack_1.0_EXTRA`** — `catapult` (+ colour
  versions), `cannon`, `cannonball_pallet`, `barrel`, `crate_A/B_*`,
  `crate_long_*`, `haybale`, `cart*`, `boat`, `fence_*`, `banner_*`,
  `building_*` (background), `cloud_*`.
- **`KayKit_Skeletons_1.1_EXTRA`** — `Skeleton_Minion`, `Skeleton_Warrior`,
  `Skeleton_Mage`, `Skeleton_Rogue`, `Skeleton_Golem` (+ shields,
  weapons). The rigs and animations are in the pack; Verb Dungeon already
  loads and animates them (`games/verb-dungeon/src/chars.js`), so copy
  that code.
- **`KayKit_ResourceBits_1.0_EXTRA`** — crates, boxes, piles, gold for
  the points bursts.
- **`KayKit_Platformer_Pack_1.0_EXTRA`** — plain blocks and planks
  (`platform_*`, `barrier_*`) if the crates aren't enough for building.
- **`KayKit_Forest_Nature_Pack_1.0_EXTRA`** — trees, rocks, grass around
  the scene.
- Krabsy at the catapult: optional; a KayKit character
  (Mystery Monthly "Protagonists") or none.

## Technical direction

- Plain ES modules, Three.js vendored (copy `vendor/three/` from Verb
  Dungeon, 0.169), no CDN, no build step. Dev server: `python3
  tools/serve.py` (no cache), this folder's port is **8141**.
- **Physics is the main decision, and it needs a real engine.** Falling
  stacks of blocks are too hard to write by hand. Recommended: **2D
  physics in a side view, drawn in 3D.** Everything moves in one plane
  (x/y), the models are 3D, and the camera looks from the side, slightly
  from above and at an angle, so it still looks 3D. Use **planck.js**
  (a JavaScript port of Box2D, about 200 KB, no WebAssembly) and vendor it
  into `vendor/`. Every block is a box or circle body; its 3D model
  follows the body. Rapier 2D is the alternative if planck.js is too
  slow. Don't do full 3D physics: it wobbles more, is harder to make fair,
  and is slower on school Chromebooks.
- **Stable stacks:** the forts must stand still until hit (bodies start
  asleep; enough friction; the first second after loading has no damage).
  Blocks break from impact force over a threshold (wood low, stone high).
- **Level data as JSON** (`levels/*.json`): blocks with type, position,
  rotation; skeletons; stone count; star thresholds; special stone type.
  A small in-game editor (`?edit=1`: drag blocks, save JSON) is worth
  building early, because castles are tuned by play-testing.
- **Questions:** from `homepage/lib/krabsy-questions.js`, `getQuizSet`
  with `withOptions` and the default chain order (pairs: 2nd form, then
  3rd form with the 2nd filled in). Keep an inline fallback list (copy
  Verb Dungeon's `src/questions.js` + `src/verbs.js`). No grammar terms in
  the question; use `go → ___ → ___` with the asked blank highlighted
  (teal = 2nd form, coral = 3rd, as in the Dungeon).
- **Interface texts EN/DE/ES** (`?lang=`, `src/i18n.js` like the Dungeon).
- **Analytics:** call `recordAttempt()` for every answer, and send game
  events via `/lib/krabsy-game-events.js` (spec in `docs/game-analytics.md`:
  `level_start`, `level_end`, plus `castle_end` with shots used, stars,
  points).
- WebAudio synth for sounds (catapult creak and thwack, wood crack, stone
  thud, skeleton rattle "oof", cheer).
- Target: plays smoothly on a school Chromebook and a touch tablet.
  Physics runs at a fixed step; cap the number of bodies per castle
  (about 60).

## Open questions for the owner

- Name: "Verb Catapult" or something else?
- Is a wrong answer crumbling the stone too harsh? (The alternative: the
  stone stays, but the player loses points.)
- Krabsy at the catapult, or only the catapult?

## Log

- 2026-11-22: brief written by the master session (owner: "something like
  Angry Birds").
