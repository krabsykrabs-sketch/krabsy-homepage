# My figure everywhere, shells, and the Krabsy world — platform brief

Written 2026-11-25 with the owner, after the figure builder prototype
(`games/figure-builder/`). Three ideas from the owner, in this order:

1. **Every child builds one figure, and it is the main character in all 3D
   games** (including Verb Towers, where it becomes the builder).
2. **Children earn points across all games and unlock characters and
   accessories with them.**
3. **Eventually: the landing page as a 3D world** where you walk with your
   figure to the games.

Part 1 (figure + points) is the plan to build. Part 2 (the world) builds on
it and comes later. Decisions the owner still has to make are marked
**Decide:**, with a recommendation.

---

# Part 1 — My figure in every 3D game, and shells

## Why

- **Ownership.** A figure the child made themselves turns "a game on a
  website" into "my game". It's the strongest reason to come back.
- **One reward for everything.** Today every game has its own coins or
  stars. A shared reward makes practice in *any* game (and in the drills)
  count towards something the child cares about.
- **Cheap to do.** All the 3D games already use KayKit characters on the
  same skeleton (Rig_Medium), so one figure fits all of them (checked
  2026-11-25):

| Game | Main character today | Status |
|---|---|---|
| Quiz-Raum | 8 KayKit figures to pick from; teacher = Mage | live |
| Verb Kitchen | the player picks Rogue / Ranger / Knight / Mage / Barbarian | live |
| Verb Platformer | Ranger | live (beta) |
| Verb Dungeon | 4 heroes (Knight free, Barbarian / Rogue / Mage for coins) | live |
| Verb Hatchery | Protagonist A / B | tester release |
| Verb Valley | Ranger | in development |
| Verb Towers | **no character** → the figure becomes the builder (new) | live |

## What the child sees

- A page **"Meine Figur" / "Mi personaje" / "My figure"**: the figure
  builder (step 1 pick a character, step 2 accessories and colours), plus
  the child's **shells** and the things that can be unlocked.
- In every 3D game the child plays **as their figure**. A child who never
  made one plays a default figure (today's game hero), so nothing changes
  for them.
- **Shells** for right answers in any game or drill, shown as a small
  counter in the site header ("🐚 240").
- Characters and accessories beyond the free set come as **gifts**
  ("Rewards instead of a shop" below; first built with locks and prices,
  changed the same day); colours are always free.

## The figure on the site (shared code)

Moves out of `games/figure-builder/` into the site:

| What | Where |
|---|---|
| Figure code (`buildFigure`, catalogue, `normalize`, clips) | `homepage/lib/krabsy-figure.js` |
| Character files, animations, portraits | `homepage/assets/figures/` (chars/, anim/, portraits/) — ~16 MB in total, but a game loads only **one** character (0.2–0.6 MB) plus the animations (1.4 MB, shared, cached) |
| The builder page | `/de/meine-figur/`, `/es/mi-personaje/`, `/en/my-figure/` (wrapper pages like the games) |
| Saved figure | `localStorage krabsy_figure_v2` (already the builder's format: ids and palette indices only, no free text) |

**For games** (an addition to `docs/game-contract.md`):

```js
import { loadPlayerFigure } from '/lib/krabsy-figure.js';
const fig = await loadPlayerFigure({ fallback: 'Ranger', lambert: true });
scene.add(fig.root);              // same skeleton as before
fig.clips                          // Idle, Walk, Run, Jump, Interact … (shared)
```

- `fallback` = the game's current hero, used when the child has no figure.
- Games keep their own extra animation packs (Kitchen, Tools …): they are
  on the same skeleton and work with every figure.
- A game may **hide** accessories that don't fit its play (e.g. long capes
  in a tight dungeon) and may **add** its own game items (a ladle in the
  kitchen, a hammer in Verb Towers). Game items are not part of the figure.
- A game may show a short "Spiel mit deiner Figur →" link to the builder
  page on its start screen.

## Game by game

| Game | What changes | Notes |
|---|---|---|
| **Quiz-Raum** | Join screen: "my figure" instead of the 8-figure choice (the 8 stay as quick picks). Join sends the figure JSON; the server checks it (known ids, small numbers) and relays it in the player list; every client builds the others' figures. | Multiplayer = up to 40 different figures. **Performance check first** (see below). Teacher stays the Mage. |
| **Verb Hatchery** | Replaces the Protagonist A/B choice. | Simplest; the game is already third-person. |
| **Verb Platformer** | Player = figure. | Check the jump/hit boxes with tall hats (hats don't count for collisions). |
| **Verb Valley** | Player = figure (with the Tools clips). | Build it in while the game is being built. |
| **Verb Kitchen** | The chef choice becomes "your figure"; a chef's hat could be a free accessory in the kitchen. | The 5 Adventurers stay as the fallback choice. |
| **Verb Dungeon** | Hero = figure. Coins and hero shop merge into shells (part below). | **Decide:** the hero hits with a sword today. Recommendation: keep the sword as the *game's* item in the dungeon only (it's already live and liked), the figure itself stays weapon-free. Alternative: a "word wand" / magic book instead. |
| **Verb Towers** | **New: the figure is the builder.** It walks across the hex board to the chosen tile, hammers, and the tower rises; it runs to the forge for the verb questions and back. | A real addition to the game (walking, hammer animation, camera). Own game session. |

## Shells (the cross-game points)

**Decide — name.** Recommendation: **Muscheln / caracolas / shells** 🐚 (not "conchas": vulgar slang in Uruguay, Argentina, Chile and parts of Peru — our first class is from Uruguay). It
fits the crab, and it doesn't clash with the games' own coins and stars,
which stay what they are inside each game (Verb Towers' forge coins buy
towers in a level, stars rate a level). Shells are the one thing that
counts across Krabsy.

### Earning

All games and drills already report every answer to **one place**:
`recordAttempt()` in `homepage/lib/krabsy-stats.js`. Shells are counted
there, so every game (and every future game) earns shells without any
game code. Proposal:

| Rule | Why |
|---|---|
| **+1 shell per right answer**, any game, any drill, any topic | simple, fair |
| **+1 extra** when the word was a weak one (mastery ≤ 2) or new | rewards learning, not repeating what you know |
| wrong answers: 0, **shells are never taken away** | no frustration |
| **soft daily limit**: after 200 shells in a day, 1 shell per 3 right answers | no shell farming with easy words for hours |
| small bonuses later: first play of each game, a week with practice on 5 days | tie-in with the stats page |

Rough scale: a 10-minute session is 60–120 answers → **60–150 shells**.

### Rewards instead of a shop (2026-11-25)

**Owner decision 2026-11-25** (replaces the prices; the shop was live for a
few hours): seeing 42 figures and 33 accessories with locks and prices was
overwhelming. Nothing is bought any more. A child sees only what it owns and
gets everything else as a **gift**: a random figure or accessory it doesn't
have yet. Code: `homepage/lib/krabsy-rewards.js` (rules, no DOM),
`krabsy-gifts-ui.js` (the gift card), `krabsy-figure-catalog.js` (the lists,
no three.js).

**Owned from the start:** 12 figures (list below), each figure's own
accessories ("★ Original"), all colours.

**Ways to get a gift**

| Way | Rule |
|---|---|
| **Shells** | every **150 shells collected** (lifetime `earned`; shells are never spent, the header shows the lifetime number). A bar on the figure page and the profile shows the way to the next one. |
| **Milestones** (once each) | 50 / 200 / 500 / 1000 right answers · 10 / 50 words that sit (every answered form at mastery ≥ 4; a verb needs both forms, as on the profile) · Verb-Diplom bronze / silver / gold · a second topic tried. 500 and 1000 answers, 50 words, silver and gold give a **figure**. |
| **Practice days** | 3 / 7 / 14 / 30 practice days. A practice day = a calendar day with at least **10 answers** (right or wrong). The days **don't have to follow each other**: a missed day costs nothing (no "streak lost" for a child who has no say over when the class practises). 14 and 30 give a figure. |
| **Weeks** | one gift for every **new calendar week (Mon–Sun) with a practice day, from the second such week on**. |
| **Found in a 3D game** | `grantGift()` / `pickGift()`, `docs/game-contract.md` ("Gifts found in a game"); at most 2 per game and day. No game hides one yet, so the child-facing texts say "bald". |

**Which gift:** random among what the child doesn't own. The old shop prices
(`PRICES` in the catalogue) are now only the **rarity**: within the figures
and within the accessories the chance is (cheapest ÷ price)², so a straw hat
or the farmer comes early and the jetpack or the Necromancer late. Without a
fixed kind it is a figure with 40 % and an accessory with 60 %. The very
first gift is always a figure. A gift that comes alone prefers things the
child's current figure can wear (others are 5 × less likely; every accessory
fits at least one free figure, so nothing is ever useless). When a child
owns everything, the bar says so and nothing more is given.

**The first run for children who already practised:** they get what their
shells and milestones so far are worth, **at most 5 gifts at once**; the rest
counts as given. Everything unlocked or bought before (`owned`, the Dungeon
migration) stays, and shells spent in the shop still count (the gifts go by
`earned`, not `balance`).

**What the child sees**

- **Gift card** "Neues Geschenk! 🎁" with the picture, the name and the
  reason, and a button to the figure page ("Anziehen" / "Ansehen"). It
  slides in at the bottom of the next site page, never blocks, shows each
  gift once and several in one card. Not on game pages or in game iframes:
  there the header counter gets a 🎁 dot and the card waits.
- **Figure page:** only owned figures and accessories, "12 von 42 Figuren
  gesammelt", one "?" tile per grid that explains how to get more, "Neu"
  badges until the tab was opened. No prices, locks or dialogs.
- **Profile:** shells collected, the bar to the next surprise, the collected
  counts, the last gifts and the next goals.

**Storage** (this device): `krabsy_shells_v1.owned` as before, plus
`krabsy_rewards_v1` (`shellGifts`, `done` milestones, practice days and
weeks, the gift log with shown / seen flags). Its own key, because older
cached copies of `krabsy-shells.js` rewrite `krabsy_shells_v1` with only the
fields they know.

Important: whatever is free at launch stays free, and whatever a child owns
stays owned.

### Where shells are stored

- On the device, next to the learning stats (`localStorage`), no account —
  same as everything else on Krabsy. Clearing the browser loses them; a
  short note on the figure page says so.
- Shells are not secret: a child who edits `localStorage` gets more. That's
  fine as long as nothing is compared between children (no shell
  leaderboards).
- **With a class** (phase 2 classes): the figure and the shells can be
  stored with the pupil, so they follow the child to another device. That
  needs a small API addition (figure JSON + shell count per pupil) and a
  privacy-page line. Later step.
- **Decide:** may a teacher switch shells off for their class? (Recommendation:
  not needed at first; shells are invisible in the Quiz-Raum anyway.)

### What happens to the games' own unlocks

- **Verb Dungeon:** coins and the hero shop go; the hero is your figure.
  Children who bought heroes get the matching characters (Barbarian, Rogue,
  Mage → Mage is the teacher's, so Mage buyers get another character of
  their choice) unlocked as shells, so nobody loses anything.
- **Verb Kitchen:** its 5-character choice becomes the fallback; the figure
  replaces it.
- In-level currencies (Verb Towers forge coins, Hatchery coins, stars) stay.

## Performance (the main technical risk)

- Single-player games: one figure = one character file + recoloured
  palettes (256 px) — cheaper than today's games, no risk.
- **Quiz-Raum: up to 40 different figures.** Each child's figure has its own
  textures and parts; with the 8 fixed figures they were shared. Plan: test
  first with 30 different figures on a cheap Chromebook (headless numbers
  are not representative). Fallbacks if it's too slow: 64 px palettes for
  other children, far figures without accessories, then the room's existing
  quality steps. **Do the Quiz-Raum play-test before this step.**

## Order of work

| Step | What | Who |
|---|---|---|
| 0 | Quiz-Raum play-test with a real class (frame rate on a cheap Chromebook) | owner |
| 1 | **Owner decisions:** shell name, earning rules, free set, prices, Dungeon sword | owner |
| 2 | Shared code + assets on the site; **shells start counting** (counter in the header) — even before the shop, so children already have shells when it opens | master session |
| 3 | Figure page DE/ES/EN with locks, prices and unlocking; link in the games hub and the header | master session (from the builder) |
| 4 | Game contract addition (`loadPlayerFigure`) | master session |
| 5 | Games, one session each: Verb Hatchery → Verb Platformer → Quiz-Raum (after the performance check) → Verb Kitchen → Verb Dungeon (with the shell migration) → Verb Valley (while it's built) | game sessions |
| 6 | Verb Towers: the builder figure (new feature) | Verb Towers session |
| 7 | Classes: figure and shells with the pupil | master session + API |

Steps 2–4 are one or two sessions; each game is roughly half a session,
Verb Towers and the Quiz-Raum more.

## Rules that stay

- **No weapons** in the figure catalogue; a game may give its hero a game
  item (Dungeon sword, see Decide above).
- **No free text** anywhere in the figure (ids and numbers only), so there is
  nothing to moderate; the server checks the figure JSON in the Quiz-Raum.
- **No accounts, no personal data** for the figure and the shells; with a
  class, only what the class system already stores plus the figure ids.
- Characters and accessories are **KayKit (CC0)**; new ones are checked on
  every character with the contact sheets (`games/figure-builder/tools/sheet.cjs`).
  Weeding out combinations that don't look good is owner work, **parked**
  (idea: a review page where the owner clicks bad pairs).

---

# Part 2 — The Krabsy world (later)

## The idea

The start page gets a second, playful entrance: a small **3D world** where
the child walks with their own figure. Every game is a building or a portal;
walking in opens the game. The figure page is a changing room, the shell
shop a stall. It's the natural home for parts 1's figure and shells.

## What it must not break

The normal HTML pages stay the main entrance, unchanged:

- **Teachers** need to find and share a game in seconds.
- **Search engines** (and Bing, which brought the first class) read the
  HTML pages; a 3D world has nothing for them.
- **Slow school devices, phones, screen readers** need the light pages.

So the world is an **extra entrance** ("Krabsy-Welt betreten" on the start
page and the games hub), loaded only when someone opens it, at its own URL
(`/de/welt/`, `/es/mundo/`, `/en/world/`).

## What's in it

| Place | What it does |
|---|---|
| A portal / building per game | built from `homepage/data/games.json` (new games appear automatically); sign with the game's name and topics; walking in opens the normal game page |
| Changing room | opens "Meine Figur" (or the builder right there) |
| Shell stall | unlocks with shells |
| Notice board | the child's practice stats (from `krabsy-stats.js`): words to practise, streak |
| Krabsy, the crab | a host figure who greets, explains, points to new games |
| Topic paths (later) | paths for English verbs, prepositions, Spanish … leading to the games that play them |

- **Single player only.** No other children in the world: nothing to
  moderate, no privacy questions. (The Quiz-Raum stays the place to play
  together, with the teacher.)
- Every building is also a normal link in an HTML menu over the world
  (keyboard, screen readers, "Zur normalen Seite").

## Technical sketch

- Three.js like the games; scenery from the KayKit packs on this machine
  (`/home/janah/dev/_assets/kaykit`: City Builder, Forest Nature, Medieval
  Hexagon, Platformer, Restaurant …) — one small island or plaza, not a big
  open world.
- Walking: the Quiz-Raum controller (keys, touch stick, jump) and camera.
- Budget: first view in under ~3 MB (scenery + one figure), smooth on a
  cheap Chromebook; everything else loads on demand.
- DE / ES / EN interface like the site.

## Phases

| Phase | What |
|---|---|
| W1 | Prototype: plaza, 4 game portals, changing-room door, walking + touch; local only |
| W2 | All games from `games.json`, shell stall, notice board, Krabsy host; DE/ES/EN; entrance link on the start page |
| W3 | Polish, seasonal decorations (new hats in the shop), topic paths |

**Decide (later):** is the world built after part 1 is complete, or does W1
start once the figure page is live? Recommendation: after part 1's steps
2–5 — the world only makes sense when the figure and shells exist.

---

## Owner decisions 2026-11-25

1. Name: **Muscheln / caracolas / shells** 🐚.
2. Earning rules: **as in the table above** (+1 per right answer, +1 extra for a weak or new word, never taken away, after 200 a day 1 per 3 right answers).
3. Free from the start: **12 characters** (Schülerin, Schüler, Wanderer, Hexe, Wichtel, Elf, Ritter, Abenteurerin, Druidin, Ork, Skelett, Roboter Eins; owner 2026-11-25 before launch: the female Wichtel `Helper_A` free, Superheld `Superhero` locked at 200 instead); other characters 150–400, accessories 40–150, all colours free.
4. Verb Dungeon: **keep the sword as the Dungeon's game item**; the figure catalogue stays weapon-free.
5. Teacher switch-off: not now.
6. First build: **steps 2–4** (shared code + assets, shells counting + header counter, figure page DE/ES/EN with locks and prices, game-contract addition). Games follow one session each, Verb Hatchery first. The Krabsy world waits until part 1 is done.
7. **Rewards instead of a shop** (same day, after seeing the shop live): no prices, no buying; see "Rewards instead of a shop" above. Decision 3's prices are now only the rarity.

## Built 2026-11-25 (steps 2–4)

| What | Where |
|---|---|
| Shells: balance, daily counter, unlocks (`localStorage krabsy_shells_v1`) | `homepage/lib/krabsy-shells.js` |
| Earning, in `recordAttempt()`: "new or weak" = the item's form was never answered or had mastery ≤ 2 **before** this answer | `homepage/lib/krabsy-stats.js` |
| Header counter "🐚 240" (hidden until the first shell was ever earned; links to the figure page) | mounted by `krabsy-footer.js` (site header) and `krabsy-nav.js` (game header) |
| Figure code, `loadPlayerFigure` | `homepage/lib/krabsy-figure.js` |
| Catalogue: characters, accessories, free set, rarity (`FREE_CHARS`, `PRICES`), names DE/ES/EN | `homepage/lib/krabsy-figure-catalog.js` |
| Gifts: rules, `grantGift`, the gift card | `homepage/lib/krabsy-rewards.js`, `krabsy-gifts-ui.js` |
| Figure page DE / ES / EN (builder; owned things only since "Rewards instead of a shop") | `/de/meine-figur/`, `/es/mi-personaje/`, `/en/my-figure/` (noindex); script `homepage/lib/krabsy-figure-page.js` + `.css` |
| Assets (42 characters + the jetpack source, 2 animation files, 42 portraits as WebP) | `homepage/assets/figures/`; three.js r169 for the page in `homepage/lib/vendor/three/` |
| For games | `docs/game-contract.md`, "The player's figure" |

Free characters (ids): Protagonist_A (Schülerin), Protagonist_B (Schüler), Hiker
(Wanderer), Witch (Hexe), Helper_A (Wichtel), Helper_B (Elf), Knight (Ritter),
Rogue (Abenteurerin), Druid (Druidin), OrcRaider (Ork), Skeleton_Minion (Skelett),
Robot_One (Roboter Eins). The builder shows only what the child owns. Next:
games hide their first gifts (`grantGift`), one session each.

## Open decisions (summary)

1. Shell name (recommended: Muscheln / caracolas / shells; never "conchas").
2. Earning rules (recommended: table above).
3. The 12 free characters and the prices.
4. Verb Dungeon: keep the sword as a game item, or a non-weapon.
5. Teachers switching shells off: needed? (recommended: not at first).
6. When the Krabsy world starts (recommended: after part 1, steps 2–5).
