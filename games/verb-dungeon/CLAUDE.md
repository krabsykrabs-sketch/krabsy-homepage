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

**Release:** the master session releases; everything it needs (build
copy list, wrapper pages in `release/`, catalogue and hub changes,
IndexNow URLs) is in `RELEASE.md`. Don't edit `homepage/` from here.

## What exists

**The game base (built 2026-11-21, replaces the PoC as `index.html`).**
Plain ES modules, no build step. Serve with `python3 tools/serve.py`
(port 8130, caching off; `.claude/launch.json` does the same) and open `/`.
`?play=1` skips the menu.

| File | What it does |
|---|---|
| `index.html` | page, styles, HUD, question card, bottom sign line, start and end screens |
| `src/main.js` | game loop and rules, input, interface, QA hook |
| `src/room.js` | builds one room from data (shell + props, merged to one mesh; search props separate) |
| `src/levels.js` | level data: 3 levels of 5 rooms, room templates, room types |
| `src/heroes.js` | the hero's game items (sword; shield only on the fallback Knight), the swing clip (`SWINGS`) and the saved progress (`krabsy_vdungeon_save`) |
| `src/figure.js` | the child's figure as the hero (`loadPlayerFigure`, fallback Knight) and the one-time move of old hero-shop purchases into the shells store |
| `src/marker.js` | the one "you can use this" marker: `markUsable(obj, {radius, top})` / `unmark(m)` (all rings one InstancedMesh, all sparkles one Points: 2 draw calls) |
| `src/labels.js` | word plates in the room (rune door signs, bridge stones), brick texture |
| `src/assets.js` | model loading, shared material, static merge |
| `src/chars.js` | animated character (hero, skeletons) |
| `src/questions.js` | questions from the site engine (smart mix), inline fallback |
| `src/analytics.js` | what the game reports to the site: word statistics (`recordAttempt`) and game events (`gameEvent`); silent without the site |
| `src/verbs.js` | inline fallback verbs (46, copied from Verb Kitchen) |
| `src/i18n.js` | interface texts EN/DE/ES (`?lang=`) |
| `src/audio.js` | WebAudio synth (kept from the PoC) |
| `src/touch.js` | touch controls: virtual stick + sword button (feeds `updateHero()` / `bonk()`) |
| `src/debris.js` | smashed crates / barrels: a pool of plank, stave and hoop pieces (shared geometry, no lights) |
| `assets/`, `vendor/three/`, `fonts/` | models (5.5 MB; about 3.4 MB in the first load, the extra heroes load when picked, the level 2 / 3 bosses when their level starts), Three.js 0.169, fonts; nothing from a CDN |
| `poc/` | the June PoC, kept for reference (follow camera, primitives) |

**Rules as built**
- **Things you can use move or glow; decoration never does (2026-11-22,
  play-test note 6).** Everything the player can act on gets the same
  marker (`src/marker.js`): a soft teal ring on the floor (additive,
  slowly pulsing) with three sparkles rising from it. Coin stacks (they
  also bob and turn slowly), the key on the floor, unsearched search
  props, a closed chest, the boss "?" stone. It goes when the thing is
  used up (coin taken, chest opened, prop searched, stone used, key
  taken). New usable things: `markUsable(obj, { radius, top })`, keep the
  handle, `unmark(m)` when done (`m.off = true` hides it for a moment,
  e.g. a coin in flight); `enterRoom` clears all marks. Decoration never
  bobs, glows or sparkles (the verb book's rune circle glows: it is
  usable), and there is no treasure-looking decoration:
  no `coin_stack_*`, `trunk_large_A` or `box_small_decorated` (it has
  coins on it) in room props, so every coin you see can be collected.
- One room on screen, fixed camera (43° down, fitted to the window). Every
  room has the same shell; you enter at the open front and leave through
  the door in the back wall. Room change is a short fade.
- **Room goal, then the door.** Every room has a `type` in `levels.js`
  (`'key'` default, `'ambush'`, `'rune'`, `'bridge'`, `'vault'`, `'boss'`)
  and three phases in `main.js`: `goal` (the room's task: key + verb book;
  the door only gives a hint) → `door` (book answered: the lock glows, the
  door opens by itself when the hero comes near) → `open`. A room type is
  one entry in `GOALS` (`enter(keep)`, `update(dt)`, `onBonk(s)`, `save()`,
  `doorHint` (key or function), `sign()`).
  Rune and bridge are the verb question themselves: `sign()` gives the
  question for the small line at the bottom (chain + how-to, no chips),
  answers go through `judge(pair, q, i)` (stars, missed verb back as a
  pair), and `openExit(door)` opens the way out. They have no skeletons.
- **Questions only when the player chooses (2026-11-22, play-test note
  12).** Nothing asks by itself any more: walking over the key, up to a
  chest or onto the boss stone asks nothing. Space (or the sword button)
  opens the card at the verb book (inside its circle), at a closed chest
  (within 2.4) or on the boss stone (`usable()` / `useHere()`, checked in
  `bonk()` before the swing). A small prompt floats over that thing
  (`#prompt`: `Space` / the sword icon + "read the book" / "open the chest"
  / "answer"). It is hidden while the card is open.
- **Question card (2026-11-21, play-test notes 2 + 4).** The verb book, a
  chest and the boss stone ask in a large card in
  the middle of the screen over the dimmed room (`openCard`, `#ask`). While
  it is open the whole game is paused (`step()` returns early: skeletons,
  boss, arrows, game-clock timers, animations, the key; only the torches
  flicker, on `G.wall`). It stays until it is resolved; keys 1–3 or a
  click answer. The card's edge and the asked
  blank are teal for the 2nd form, coral for the 3rd; a "?" sits in the
  asked blank. The book asks a pair: 2nd form, then the 3rd with the 2nd
  shown (two dots in the corner). Chest: one 2nd-form question, with a
  "later" button / Esc (the chest stays shut; Space there asks again).
  Boss: one question per round (the card's icon and title are the boss's). A wrong
  answer greys the chip and shows the teach line (the chain as far as it
  may be shown: `go → went → ___` at the 2nd form, the full chain at the
  3rd). Rune doors and the bridge keep their words in the room and only
  the small line at the bottom.
- **Hidden key (2026-11-21, play-test notes 3 + 4).** No skeleton shows
  the key. A key room hides it in one of its search props (`search` in the
  room data: 2–3 extra props, each with the same "usable" marker) or, without
  them, in one of its skeletons. The hiding place is picked at random when
  the room starts and is fixed, so the last one searched / bonked always
  has it. Bonking a skeleton without it: a dust puff and "Nothing!"
  (sometimes a coin stack, 30 %). Space next to a search prop searches it:
  it wobbles; empty = rattle, puff, "Empty!"; the right one pops the key
  out (towards the hero). The key lands on free floor with a light pool;
  walking over it takes it (no question; key in the HUD, hint "now read the
  verb book", or the door unlocks if the book is already read). Other
  skeletons are optional pests. Level 1 rooms 1 and 2
  use search props; the other key rooms use skeletons.
- **Crates and barrels break (2026-11-22, play-test note 9).** A swing that
  reaches a search prop smashes it (`searched()`): the prop disappears and
  its collision goes, 11 pieces fly out (`src/debris.js`: planks for a
  crate, staves + two iron hoops for a barrel/keg; one pool of 28 meshes on
  4 shared geometries and 3 materials, gravity, a bounce, shrink away after
  1.15 s), a dust puff, `sfx.crunch()`, a small camera shake. The key pops
  out of the wreck (towards the hero); an empty one drops a coin stack 30 %
  of the time and shows no text. The "usable" marker stays until it breaks.
  A dizzy restart keeps smashed props gone. Decoration crates don't break.
  (A bonked skeleton without the key still shrugs "Nothing!".)
- **Verb book (2026-11-22, play-test note 12).** Key, ambush and treasure
  rooms have a lectern with an open book (primitives, `makeLectern()` in
  `room.js`, × 1.3) right of the door (`BOOK` x 2.8 z −5.2; `book: [x, z]` in
  the room data moves it; the vault's is at 2.4 / −4.9) inside a rune
  circle (r 1.6: canvas decal with amber rings and teal runes on a dark
  teal pool, slowly turning and pulsing; dims when read). The book has the
  usable marker until read. **Book and key in any order (2026-11-22,
  play-test note 14):** Space inside the circle always opens the card with
  the room's pair (2nd form, then 3rd), key or not. Both right →
  `sfx.clunk()`, "✓", the book is **read**: the open book folds shut on its
  stand (the book is two halves hinged at the spine, `book.halves` /
  `book.spine` from `makeLectern()`; the left half turns over onto the
  right one, cover up, and the closed book slides to the middle, 0.7 s,
  `book.shut` 0 → 1 in `updateBook`), and the rune circle and its glow
  fade out; `room.wards` empties, so enemies may walk there again. Key
  rooms unlock (`goalDone`, the lock glows, the door opens as the hero
  approaches) once the key is taken AND the book is read, whichever comes
  last (`unlockBook()` / `keyDone()`); the hint says what is missing:
  "The book is read! Now find the key." (`hintKeyStill`), "Now read the
  verb book" (`hintBook`), at the door "Find the key and read the verb
  book" (`hintNeedBoth`), "Find the key first" (`hintNoKey`) or "Read the
  verb book first" (`hintBookFirst`). A read book stays read (closed, no
  circle) through a dizzy restart. While unread, the circle is a
  ward (`room.wards`): skeletons, archers and bosses are pushed out of it
  (`collide(…, enemy)`), patrol points inside it move to its edge,
  skeletons chasing a hero who stands inside wait at the edge (idle,
  facing the hero) and never bump; arrows and orbs fizzle at the edge
  ("✦", `sfx.fizzle()`). The cellar and hall lost their right-hand column
  + candle next to the door for it.
- Ambush (`type: 'ambush'`): the door stands open. When the hero walks in
  (z < 2.2) it slams, and the room's skeletons rise from the floor one
  after the other, each at the first point of its route. One of them has
  the key, as in the key hunt; then the book. A dizzy restart springs the
  trap again (the key's state stays), unless the key was already taken
  (then the skeletons stay calm).
- **Rune doors (`type: 'rune'`, rebuilt 2026-11-22, play-test note 10,
  owner's option a: two walls in a row).** A first wall across the room
  (`RUNE_WALL.z` = 0, 1 thick; `room.inner.gates`: three doorways at x −4 /
  0 / 4 with a sign each, two torches on its front) and the back wall with
  three doors (`room.doors`). Walk into a door of the wall whose turn it is
  to choose it (`runeWall(step).line`). The first wall asks the 2nd form:
  the right door swings open and lets the hero through (`pass`: the wall's
  collision has a gap there, `collide()`) into the antechamber (z −7…−0.5);
  the back wall's signs show "?" until then, then the 3rd-form choices (the
  2nd form shown in the bottom line); its right door is the exit. Wrong
  door (either wall): it swings open on a brick wall, sad trombone, the sign
  greys out, a small push back that also re-arms the choice; the verb comes
  back later. The first wall (merged mesh, doorways, signs, bricks, torch
  glows on cloned materials) fades to 22 % while the hero is in or behind
  it, so the antechamber stays visible from the fixed camera; the solved
  first wall shows the right word teal, the others dim.
  `room.exitX` says which back door leads on.
- **Word bridge (`type: 'bridge'`, rebuilt 2026-11-22, play-test note 5).**
  No special controls: the hero walks normally everywhere. Front to back
  (`PITS`, `STONE`, `BASE_SIGN` in `room.js`): the entrance ledge with the
  base form on an amber floor plate (z 4.4…8), pit A with three word
  stones for the 2nd form (z 1.6…4.4), a full-width strip of floor
  (z −1.6…1.6), pit B with three stones for the 3rd form (z −4.4…−1.6),
  the far ledge with the door. Stones are 2.8 wide at x −4.2 / 0 / 4.2 and
  span their pit edge to edge; the 1.4-unit gaps between them are wider
  than the hero, so you cannot slip sideways from one stone to the next.
  You line up on a ledge / the strip and walk straight across. The hero
  counts as over the pit when its centre is not within a stone (0.15
  slack at the sides). Right stone → teal, sparkle, the other two of the
  row crumble away; after row A the 2nd form shows in the bottom line and
  row B's words appear (they show "?" before, so the 3rd-form choices are
  not seen early). Wrong stone → it shakes (0.28 s) and crumbles with the
  hero on it ("Oops!", dust puff); the hero drops and stands again 1 unit
  back on the floor it came from (no heart lost, movement keys released);
  the stone stays gone; the verb returns later via `judge()`. Walking off
  a stone's side or into a gap = the same drop. Right 3rd-form stone →
  full chain toast, the door opens. The hero enters beside the plate
  (x −3). Props on the ledges stand back from the pit edges, so bumping
  into one never pushes the hero over.
- **Bosses (`type: 'boss'`, last room of every level; a different one per
  level since 2026-11-22, play-test note 11; `boss:` in the room data,
  `BOSSES` in `main.js`).** The pattern the owner liked stays for all: an
  intro beat (own line, e.g. "Rise, my bony friends!"), then the boss
  attacks its own way; a glowing "?" stone lies on the floor (one of six
  spots, away from boss and hero): stand on it and press Space, the card
  asks. Right answer: the boss is dizzy for 6 s (stars) and its trick
  stops; a bonk takes one of its 3 pips (room label "Level n · <name>" +
  pips). Bonking it while it is not dizzy only goes "Clonk!". Wrong answer:
  it laughs (`sfx.laugh`), and the stone comes back after 3 s with the same
  question (the tried choice greyed). Touching it costs a heart. Questions
  run in chain order across rounds: 2nd form, 3rd form, next verb. At 0
  pips it falls over, drops 5 coin stacks, and the exit opens. A dizzy
  restart keeps its pips and the current question (the intro plays again).
  Faster on higher levels and with fewer pips.
  - Level 1 **Golem** (💀, `Skeleton_Golem`, large rig, × 1.25): walks
    after the hero, now and then a charge: 0.9 s wind-up with "!!", then
    straight ahead without turning, then a tired pause.
  - Level 2 **Necromancer** (👑, `Necromancer.glb`, medium rig, × 1.45, a
    `Skeleton_Staff`): floats down at the start and hovers, drifts to keep
    5–8 units from the hero, and every ~4 s raises a small skeleton
    (`Ranged_Magic_Summon`, `sfx.summon`; at most 3 alive; 2 at once after
    the intro) on free floor ≥ 2.6 from the hero. Minions (`minion: true`,
    × 0.9) always chase; bonked they crumble away instead of getting up. A
    right answer breaks his spell: "Spell broken!", every minion falls
    apart, he sinks to the floor dizzy.
  - Level 3 **Skeleton Mage** (🔮, `Skeleton_Mage.glb`, medium rig, × 1.5,
    a `Skeleton_Staff`): twirls in with a puff ("Abraca-bones!"), keeps
    5.5–9 units away, every ~3.3 s casts: 1 s wind-up
    (`Ranged_Magic_Spellcasting`, "!!", a purple glow grows on his staff,
    aim fixed for the last 0.3 s), then a fan of 3 slow orbs (5 at the last
    pip; speed 4.6, hero 6.2) at where the hero stood. An orb costs a heart;
    the weapon swats it ("Pling!"), props stop it. Dizzy: his orbs fizzle.
- Coins: stacks worth 5 pop out of chests (2, gold chest 3), the boss (5)
  and sometimes an empty hiding place (1), or lie in the treasure room
  (`type: 'vault'`, `coins: [[x, z], …]`, level 2; its door is opened by
  the verb book). Walk near a stack to collect
  it; stacks still lying when the room ends are collected for you. Since
  2026-11-25 coins are the treasure of one level run: the HUD shows this
  run's coins, the end screen "+N coins"; they buy nothing (the hero shop
  is gone). The lifetime total is still kept in localStorage
  `krabsy_vdungeon_save` (`{ coins, owned, hero, migrated }`; `owned` /
  `hero` are the old shop's data, read once by the migration, never
  written again). Never call coins shells / Muscheln / caracolas.
- **The hero is the child's figure (2026-11-25, owner decision; see
  `docs/game-contract.md` "The player's figure").** `src/figure.js`
  `loadHeroFigure()` = `loadPlayerFigure({ fallback: 'Knight', lambert:
  true, clips: false })` from `/lib/krabsy-figure.js` (the Dungeon's own
  clips from `anim_medium.glb` etc. play on it, same skeleton; nothing is
  hidden: capes and back items fit). It loads in parallel with the room
  assets; `buildHero({ root, own })` uses the figure as it is (`Char`
  option `own`). The sword is the Dungeon's item on `handslot.r` (scaled
  against the slot's world scale, so it keeps its size on every figure);
  the shield only goes on the fallback Knight (no saved figure, or a
  locked character). Without the site (dev server, `file://`) or on any
  error the old `assets/characters/Knight.glb` with sword + shield is
  built (`info().hero`: `figure` | `fallback` | `knight`). Collisions,
  swing timing and hit rules are unchanged. Menu: "Dein Held" + "Du
  spielst mit deiner eigenen Figur." / "Du spielst den Ritter. Bau dir
  deine eigene Figur!" and the link "Spiel mit deiner Figur →" /
  "Juega con tu personaje →" / "Play with your figure →" to `/de/meine-figur/`
  / `/es/mi-personaje/` / `/en/my-figure/` (`target="_top"`).
- **Hero-shop migration (`migrateHeroes()`, before the figure loads).**
  Runs once (flag `migrated` in the save; unlocking an owned id is a no-op
  and a saved figure is never replaced, so it is safe to run again). Each
  old purchase is unlocked as a gift (`unlock(id, 0)` from
  `/lib/krabsy-shells.js`, balance untouched): barbarian → `char:Barbarian`,
  rogue → `char:Rogue_Hooded` (the Dungeon's rogue was the hooded model),
  mage → `char:Cleric` + `hat:wizard` (the Mage is the Quiz-Raum
  teacher's, not in the catalogue). A child whose chosen hero was one of
  them and who has no figure yet gets that look saved as the figure
  (Barbarian / Rogue_Hooded / the Witch in purple with the wizard hat).
  Without the site the import fails and the flag stays unset.
- Heroes (until 2026-11-25): a coin shop with Knight, Barbarian, Rogue and
  Mage, each with its own weapon, swing and swoosh (see git history before
  this date). Now one hero, the child's figure, with the Knight's sword and
  its 1H slice (forehand: the clip is mirrored in time, `reverse: true`,
  `swingTimes()`, play-test note 13). `Assets` still builds `Swing_<key>`
  for every `SWINGS` entry (now only `slice`).
- Archer skeleton (`archer(route)` in `levels.js`, from level 2): keeps 4.5
  to 10 units away, shows "!" and aims for 1 s (the last 0.3 s fixed), then
  shoots one slow arrow (speed 7, hero 6.2) straight at where the hero
  stood; 3.4 s between shots. An arrow costs a heart; step aside or swat
  it with the weapon ("Pling!"). Props stop arrows; the verb book's circle
  makes them fizzle. Bonked archers get up
  calm and stop shooting.
- Missed verbs: a wrong answer anywhere (card, rune door, bridge stone)
  puts the verb's pair back in the queue once; the next verb book, boss
  round, rune room or bridge takes missed pairs first. Chests
  always take a fresh verb.
- Chests are optional bonus questions: Space next to one; one 2nd-form
  question, feedback shows the full chain; +1 heart (or just treasure).
- Skeletons that are not bonked yet chase and bump the hero (−1 heart,
  knock-back, short blink). Bonked ones get up again and only wander.
- Swing: Space does a flat cut across the front (the hero's swing clip
  from `SWINGS` in `heroes.js`, played as `Swing_<key>` = its upper body,
  built at load in `assets.js`; the hips' turn is folded into the spine so
  the legs keep running). Clip: `Melee_1H_Attack_Slice_Horizontal`
  (`slice`; the shop heroes' `heavy` / `dual` swings went with the shop on
  2026-11-25); the measured blade angles are in the comments there. Each starts inside its wind-up
  (`from`): strike begins within ~0.06 s of the key press, hit check at
  0.11 s (measured 0.117 s at 60 fps for every hero) when the blade is in
  front, next swing allowed after 0.38 s (`SWING` in `main.js`). Hit rules
  are the same for all (range 2.6, cone in `bonkCheck`). Space at the book,
  a chest or the boss stone opens it instead of swinging. A crescent
  (`trails`, one per entry in the hero's `trails`; the rogue has two)
  follows each blade's hand slot through the strike; a hit adds a flash,
  sparks in the hero's colour, a 50 ms hit-stop and a small camera shake
  (`hitFx`). The same swing smashes a search prop in reach.
- Chain order: a verb's 3rd form is asked only right after its 2nd form,
  with the 2nd form shown (`go → went → ___`). After a 2nd-form answer the
  feedback also stops at `go → went → ___`; the full chain comes after the
  3rd form. `questions.js` `loadPairs()` returns verb pairs `{ base, past,
  pp, steps: [2nd, 3rd] }` from the site engine (two records in a row, the
  second marked `followUp`) or from the inline list. On the site the
  level's `tiers` pick the verbs by the verb table's `tier` (from
  `getChainSet`), filled up with the easiest others if too few. The
  level's verbs come first from the **smart mix** (`getChainSet({ smart:
  true })`, one set per tier of the level, an equal share each; see
  "Learning stats and game events").
  `single(pair)` makes the chest question, `again(pair)` the repeat.
- **Controls and devices (touch added 2026-11-22).**
  - Keyboard (laptop, Chromebook): WASD / arrows walk, Space swings (bonk and
    smash) or opens the book / a chest / the boss card, 1–3 answer the card, Esc = "later" at a chest, M = sound. Menu:
    1–3 or ←/→ pick a level, Enter/Space start. If the page has no keyboard
    focus during play it pauses with "Click here to play" (not in touch mode).
  - Touch (`src/touch.js`), switched on by `pointer: coarse` or the first
    touch; a key press (W A S D, arrows, Space, Enter, digits) switches it off
    again (touch Chromebooks). Drawn only while a level runs
    (`html.touch body.playing`). **Stick:** a touch on the room in the left
    60 % of the screen; the stick jumps under the thumb (at rest it waits
    faint in the bottom-left corner), radius 58 px (46 on short screens),
    dead zone 16 %, speed ramps from 35 % to full at 62 % deflection, and the
    direction snaps to straight up/down/left/right within ±20° (walking
    straight through a door or over a bridge stone). The camera has no yaw,
    so screen direction = room direction. **Sword button** (bottom right,
    112 px, 92 on short screens) = Space, fires on touchstart, works while
    the other thumb holds the stick. Opening a card or dropping off the
    bridge stops the stick until the finger is lifted (`holdStick()`).
    Everything else is a button: level, the figure link, card chips,
    "later", end-screen buttons, sound. Buttons use `tap()` (pointerup for
    touch, click for the mouse, ghost click ignored, as in Verb Kitchen).
  - No page scroll / zoom / selection / long-press menu: `touch-action:none`
    on the page (menus scroll with `pan-y` if they must), `-webkit-touch-callout`,
    `contextmenu` blocked in touch mode, `gesturestart` blocked (old iOS).
    Audio is resumed on every tap (iOS starts it suspended).
  - Touch texts: i18n keys with a `_touch` twin (`howMove`, `howBonk`,
    `howAnswer`, `hintSearch`, `hintBoss_golem`, `hintBoss_necro`,
    `clickToPlay`) use the twin in touch mode; the Space prompt shows the
    sword icon instead of the key;
    the menu how-to shows a stick icon, the sword icon and 👆; key badges
    (`1 2 3`, `Esc`) are hidden on touch.
  - Phones: **upright (portrait, ≤ 640 px wide) plays sideways (2026-11-25,
    owner's first phone test: the "turn your device" wall stopped him).**
    `src/rotate.js` turns `<body>` by 90° (`html.rot`), so the game is landscape
    on screen even with rotation lock on; if the phone does rotate the page it
    is drawn normally again. While turned, use `VW()`/`VH()` instead of
    `innerWidth`/`innerHeight` and `toLocal()` / `centreOf()` for screen
    coordinates (touch, `getBoundingClientRect`); CSS uses `var(--lw)` /
    `var(--lvw)` for the game's width. The `@media (max-height:…)` rules are
    copied into extra sheets that switch on by the LOGICAL height.
    `tools/qa-touch.cjs` at 390×844 plays in this mode (touch points turned).
    `#rotate` only shows if scripts fail. **Landscape is playable** (tested at 844×390): below 500 px height the
    menu, end screen, hint, sign and toast are compact, stick and button
    smaller. The bottom sign keeps clear of the stick and the button
    (`max-width: 100vw − 340px` in touch mode).
- 3 hearts; at 0 the hero is dizzy and the room restarts with full hearts.
  What was reached stays: where the key is (hidden, lying on the floor or
  taken) and which hiding places were tried (smashed props stay gone), a
  read book, the boss's pips and question, an opened chest. (A card can't be open then: it pauses the room.)
- Stars: 3 = every question right on the first try, 2 = at least 60 %,
  else 1. Best stars per level in localStorage `krabsy_vdungeon_stars`.
  Level n+1 unlocks with any star on level n (`?unlock` opens all).
- Questions: `/lib/krabsy-questions.js` (`getQuizSet`, tiers per level,
  smart mix) when served from the site, otherwise the inline list.
- **Learning stats and game events (2026-11-22, classroom phase 1;
  `docs/phase1-game-wiring.md`, `docs/game-analytics.md`, all in
  `src/analytics.js`).** Every question's FIRST choice goes to the shared
  word statistics: `recordAttempt(verb, 'past' | 'participle', correct,
  'verb-dungeon', 'irregular_verbs')`, called from `judge()` (book both
  forms, chest, boss stone, rune first wall = past / back wall =
  participle, bridge row A = past / row B = participle). The question's
  `seen` flag (reset by `fresh()` / `again()`) keeps a retry of the same
  question from counting again (a wrong chip and then the right one, the
  boss stone's repeat, a second rune door, a second bridge stone); a
  missed verb that comes back at a later room is a new question and counts
  again. `loadPairs()` puts the smart mix first at every level start: one
  `getChainSet({ tiers: [t], count, smart: true })` per tier of the level
  (an equal share of the 10 verbs each), because one set over tiers 2 + 3
  would only take new words from tier 2 (the smart mix opens a tier when
  60 % of the one below is known); the rest of the pool and the chain
  order stay as before. Game events (`gameEvent('verb-dungeon', …)`; the
  helper posts to the wrapper page, or fires a `krabsy:game` DOM event
  without a parent): `level_start {level}`, `room_done {level, room, type,
  seconds, hits_taken}` (as the hero leaves; a dizzy restart keeps the
  room's clock and hits), `player_dizzy {level, room, type}`, `boss_round
  {level, boss: golem|necro|mage, result: right|wrong, form: past|pp,
  pips}` (pips left before the bonk), `level_end {level, result: 'won',
  stars, seconds, answers, correct, first_try, questions, coins, rooms,
  hits_taken, dizzy}` (answers = every choice incl. retries, correct = the
  right ones, first_try / questions = the stars' ratio, coins = this run).
  There is no "lost" (0 hearts restarts the room); a level left midway is
  a `level_start` without `level_end`. `level` and `room` are 1-based;
  `seconds` run on `G.wall` (card time included). Both libs are imported
  dynamically from `/lib/` (no `?v=`); without the site (dev server,
  `file://`) the imports fail and everything is a no-op. `?qa=` runs
  report nothing unless `&track=1`.

**Not built yet**
- A tutorial that teaches by doing (room 1 of level 1 has no skeletons,
  hints tell you what to do, but that is all).
- Final level design (step E). The three levels now mix the room types
  and end with the boss.
- Prepositions (`?topic=`), cinematic beats, music.

**Local diagnostics:** on localhost (not with `?qa`) the game sends key
presses, a 2-second heartbeat and errors as `diag?…` requests, visible in
the dev server's output. This is how the "controls don't work" report was
solved.

**QA without a keyboard:** `window.__VD` (`info()`, `run(n)`, `teleport`,
`bonkOne`, `bonkAll`, `searchOne(i)` (smash prop i), `findKey()` (bonk /
smash the hiding places until the key pops out), `takeKey()`, `hideIn(i)`
(choose the hiding place), `space()` (what Space does here: swing or open),
`toBook()`, `readBook(wrongFirst)`, `answerCard(wrongFirst)`, `answerRight`,
`answerWrong`, `later`, `doGoal`, `playRoom`, `foe` (the boss)). `info()`
also has `book` (shut/done), `rune` (`step:z`), `boss` (`kind:state:pips`),
`minions` and `prompt` (what Space would open). `info().bridge` = `step:floor|stone|fall:broken`. `__VD.solve[type]()`
and `__VD.pick(right, hold)` are the solvers per room type.
`?qa=play&level=2` plays a level by script (per room: the locked door is
checked; key rooms with an odd index (or all with `&bookfirst=1`) read the
book before the key, and the door must stay locked with the book closed
and no ward (`lockedBookOnly`), the others take the key first; walking
up to a chest must not open it, Space does, "later" closes it, Space again,
answered; the key is found and taken without a card, the door stays locked
until the book is answered, then must open by itself; the rune room's
right first-wall door must let the hero walk through; standing on the boss
stone must not open the card; one mistake in the first room);
`&wrongall=1` makes a mistake in every room (in a rune room at both walls). `?qa=hurt` checks the dizzy restart (`&stop=N`: a room with 2+
skeletons or the boss — `level=2&stop=2` key, `level=3&stop=3` ambush,
`level=1&stop=4` golem, `level=2&stop=5` necromancer, `level=3&stop=4`
skeleton mage; `&pre=floor|taken|book|boss` = the key lies on the floor /
is taken / the book is read too, one boss round won first; the result shows `before`,
`dizzy` and `restarted`; `&pre=bookonly` = the book read, the key still
hidden: it must stay read). `?qa=keys` sends real key events. `&track=1`
lets a QA run send its stats and game events (off by default).
`info()` also has `bookShut` (0 open … 1 closed), `wards` and `smart`
(verbs from the smart mix in the pool).
`?qa=card&stop=N&gate=book|chest|boss` freezes with a question card
open (`&step=2` the 3rd form, `&wrong=1` one mistake).
`?qa=key&stop=N&pose=nothing|pop|floor|taken|open&n=frames` freezes key
hunt moments (`&keyin=i` the hiding place). `&hold=1` keeps the floating
words (`Bonk!`, `Nothing!`) on screen for screenshots.
`?qa=pose&stop=N&do=…` freezes any room after a list of commands
(`tp:x:z`, `run:n`, `face:deg` (0 = towards the camera), `right`, `wrong` (rune door, or walk across a bridge
stone of the current row with W; `wrong:hold` = stop once on the stone,
e.g. mid-crumble), `goal`, `find`, `search:i`,
`bonkone:i`, `keyin:i`, `bonkall`, `stone` (wait for the boss stone, stand
on it), `space` (press Space), `take` (walk onto the key), `book` (into the
book's circle), `readbook`, `beside:i` (next to search prop i, facing it),
`minions:n` (wait for n necromancer minions), `cast:t` / `orbs:t` (the
skeleton mage mid-cast / orbs t s in flight), `still` (enemies stop),
`ans:right|wrong`, `foe` (next to the boss; `golem` works too), `bonk`,
`menu`, `coins:n`; `&safe=1` = no bumps). `&hero=id` plays as that hero; `?qa=portrait&stop=0&hero=id`
is the close-up the menu portraits were cut from (only the hero and the lights, on a vertical navy gradient with a front key and a rim light, play-test note 15; 640 px square from y 120, x 380 / 420 / 370 / 290 for knight / barbarian / rogue / mage, scaled to 144; `&pt=` holds the swing clip at that time);
`?qa=swing&stop=1&n=8&fps=60` (n = frames after the key press; `&stand=1`,
`&face=deg`, `&skel=1`) freezes a swing. On localhost the result is also
sent as a `qa-report?…` request, readable in the dev server's log.
Headless runs: the Linux Playwright Chromium from `~/.cache/ms-playwright`
(read `#qa` when it has text), or headless Edge with
`--virtual-time-budget` ≈ 40000; each run its own profile folder.
`__VD.askLog` lists every question shown (`gate:base:ask`, cards and the
bottom sign) for chain-order checks; `__VD.keyObj()` is where the key lies.
**Site-like test (engine, not the inline verbs):** serve a folder that holds
the game files at `/` plus symlinks `lib` → `homepage/lib` and `data` →
`homepage/data`; then `info().source === 'engine'`. `tools/qa-engine.cjs
<port> [extra query]` plays levels 1–3 with and without `&wrongall=1` and
prints source, tiers, the verb pool and chain-order violations.
`tools/qa-touch.cjs <port> <w> <h> <lang> <prefix>` plays level 1 by touch
in a `hasTouch`/`isMobile` context (stick drags via CDP
`Input.dispatchTouchEvent`, taps on menu, hero cards, chips, "later", end
screen, sound; the sword button at the book (without and with the key), at
the chest and on the boss stone; both rune walls; screenshots
`_shots/<prefix>-*.png`; `SHOTS=dir` writes them elsewhere); `START=n` skips the
first n rooms by script, `ONLY=n` stops after room n. Headless frame rates
are low, so it steers by polling the hero's position.

## Direction for the full game (proposed by the master session)

The owner said yes to the game and, after the look test, to building on
this look (2026-11-21). Points 1–5 below are built in a first version;
6 (touch) is built too (2026-11-22). He has not confirmed the rule details listed under
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

## Owner decisions 2026-11-21 (play-test 2) — the build plan

Owner after testing all levels: "I don't see the fun yet, all levels seem
the same." The sword is now fine ("great"). Owner approved everything
below ("do all, go ahead"). Build in this order and hand each step to the
owner for a play-test:

A. **Collectable key + two-form doors.**
   - One skeleton per room carries the key, visible on its belt (glowing).
     Bonk it and the key pops out onto the floor; the player walks over
     to pick it up (shown in the HUD, door lock starts to glow). The
     floating key over the door goes. Other skeletons are optional pests.
     Rooms without skeletons: the key lies somewhere in the room.
   - A door asks **both forms**: first the 2nd (`go → ___ → ___`), then in
     the same plate the 3rd with the 2nd shown (`go → went → ___`); it
     opens only after both. The 3rd form is not revealed in between. A
     missed verb returns at a later door as a pair.
   - Chests stay a quick bonus: one 2nd-form question, then the full chain.
B. **Room types**, each room has its own idea:
   - Key hunt (A).
   - Rune doors: three doors labelled with word forms; walk through the
     right one. A wrong door = brick wall + sad trombone (the PoC had this).
   - Word bridge: a gap crossed on stepping stones with words; step only
     on the right forms (`go → went → gone`), a wrong stone drops you back
     to the start of the bridge (no heart loss for beginners).
   - Ambush: the door slams, several skeletons rise from the floor, bonk
     them all to reopen it.
C. **Boss room** at the end of each level: a big golem skeleton; each right
   answer stuns it so it can be bonked; a few rounds.
D. **Rewards and variety:** a treasure vault with coins; coins and stars
   unlock new heroes (like Verb Kitchen's character shop); an archer
   skeleton that keeps its distance.
E. **Three levels rebuilt** from the new room types (+ boss), each level a
   different mix, difficulty rising.

Rules that stay: positional notation, no grammar terms as the question,
chain order, nothing attacks while a question plate is open, spooky not
scary, DE/ES/EN texts, keyboard (touch comes later).



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
- 2026-11-21 — **Owner play-test 2: sword "barely detectable".** Cause: an
  overhead chop is a vertical move and hides behind the hero's head under
  the 43° camera; skipping the wind-up made it smaller still. Now a
  horizontal slice with a swoosh and hit feedback (see the "Sword" rule).
  - `anim_medium.glb` rebuilt with a 9th clip (+30 KB, command in
    `assets/CREDITS.md`). `?qa=...&stop=0` now really means "play no room"
    (it used to be read as "no limit").
  - Checked by script and frame-by-frame screenshots (`_shots/swing-*.png`:
    standing, running, facing the camera); `?qa=play` still ends level 1.
    Each headless run should use its own Edge profile folder, otherwise
    overlapping runs give stale screenshots.
  - **Not checked:** the feel in real play (speed, sound, shake strength),
    frame rate on a Chromebook.
  - **Next:** owner retries the sword; then touch controls, tutorial room,
    more room templates.
- 2026-11-21 — **Step A built: collectable key + two-form doors** (see
  "Rules as built"). Changed: `src/main.js` (room phases, `GOALS`, key,
  two-step plate, QA), `src/questions.js` (pairs), `src/room.js` (lock
  glow instead of the floating key; `type`, `phase`, `door`),
  `src/levels.js` (`key` spot in level 1 room 1), `src/i18n.js` (new hints
  DE/ES/EN), `index.html` (HUD key slot, step bars).
  - **Checked** by script in headless Chromium (Linux build from the
    Playwright cache; WSL→Windows interop was down, so not Edge):
    `?qa=play&level=1..3&lang=de` reach the end screen, a missed verb
    returns at the next door as a pair; the same with the site engine
    (`source: engine`, test folder with `/lib` + `/data`); `?qa=hurt`
    plain, `pre=floor` and `pre=door` keep the key and door state.
    Screenshots `_shots/A-*.png`.
  - **Not checked:** real keyboard play (does the carrier read at a
    glance, is the key arc fun, pickup sound), the HUD key fly animation
    (decoration, not visible in frozen shots), frame rate on a Chromebook
    (one more point light: the key's).
  - **Seen, not changed:** the engine's tier filter returns nothing, so
    level 1 on the site gets hard verbs (cling, withdraw, flee). The plate
    keeps an empty line under the choices (room for the teach line).
    In the storage room the first skeleton starts behind a pillar.
  - **Next:** owner play-tests A; then step B (room types) as new `GOALS`
    entries plus `type` in the room data.
- 2026-11-21 — **Step B built: room types** (ambush, rune doors, word
  bridge; see "Rules as built"), plus three fixes from the review of A:
  the carrier's key is much bigger and faces the camera; the plate's step
  marks are two dots in its corner; on the site the level's tiers now
  pick the verbs (level 1 = tier 1 only).
  - Changed: `src/main.js` (three `GOALS` entries, `judge`, `openExit`,
    sign plate, QA solvers), `src/room.js` (three doorways, chasm, stones,
    `doors[]`, `exitX`), new `src/labels.js`, `src/levels.js` (templates
    `runes` and `chasm`, levels rebuilt: L1 key, key, bridge, rune,
    ambush; L2 ambush, bridge, key, rune, ambush; L3 rune, ambush, bridge,
    key, ambush), `src/questions.js` (tiers), `src/i18n.js`, `index.html`.
  - **Checked** by script in headless Chromium (Linux, Playwright cache):
    `?qa=play&level=1..3` reach the end screen with the inline list and
    with the site engine (tiers used: L1 `1111111111`, L2 mix of 1/2, L3
    mix of 2/3); the same with `&wrongall=1` (a mistake in every room,
    the verb comes back as a pair); `?qa=hurt` in an ambush room and in a
    key room (`level=2&stop=2`, also `pre=floor|door`). Screenshots
    `_shots/B-*.png` at 1366×768 and two at 1024×768.
  - **Not checked:** real keyboard play of the new rooms (is walking into
    a door / onto a stone a clear "choice", bridge edges, ambush
    difficulty), sounds (slam, trombone, fall), frame rate on a
    Chromebook, phones.
  - **Open points for the owner:** rune and bridge rooms open the door
    themselves (no extra door question). After a wrong answer the teach
    line still shows the asked form (`go → went → ___`), so the next try
    is easy. The rune room shows no hint pill (it would cover the signs);
    the plate's how-to line explains it.
  - **Next:** owner play-tests B; then step C (boss room).
- 2026-11-21 — **Steps C and D built: boss, coins, heroes, archer,
  treasure room** (see "Rules as built").
  - Changed: `src/main.js` (`GOALS.boss`, `GOALS.vault`, coins, arrows,
    archer, hero swap, menu hero cards, QA), new `src/heroes.js`,
    `src/assets.js` (golem, archer, large-rig and ranged clips, lazy hero
    loading), `src/levels.js` (template `arena`; L1 key, key, bridge,
    rune, boss; L2 ambush, bridge, key + archer, rune, treasure room,
    boss; L3 rune, key + archer, bridge, ambush + archer, boss),
    `src/i18n.js`, `index.html`, new assets (`assets/CREDITS.md`).
  - **Checked** by script in headless Chromium: `?qa=play&level=1..3`
    reach the end screen (inline list and site engine), also with
    `&wrongall=1` and as mage / rogue; dizzy restart in the boss room
    keeps the skulls (`pre=boss`: 2 left), ambush and key rooms as before;
    `?qa=swing` unchanged. Screenshots `_shots/C-*.png`, `_shots/D-*.png`.
  - **Not checked:** real play: whether the golem's walk and charge are
    fair and fun, whether 6 s of dizzy time is right, archer timing with
    other skeletons around, coin prices against real earnings (about 20
    to 40 coins per level, 70 with the treasure room), buying in the menu
    with a real click, sounds, frame rate on a Chromebook (first load
    grew by about 1 MB).
  - **Open points for the owner:** level 1 has no ambush any more (5
    rooms with the boss); the mage holds the staff like a club (gem down)
    because every hero uses the sword swing; the plain "bone pile" is the
    golem lying down, no separate pile model; menu heroes are click-only
    (no keys).
  - **Next:** owner play-tests C and D; then step E (final level mix,
    difficulty), touch controls, tutorial.
- 2026-11-21 — **Owner play-test notes 1–4 built** (see `PLAYTEST-NOTES.md`
  and "Rules as built"): word bridge by hops, question card in the middle
  with the room paused, hidden key (skeletons or search props, random, the
  last one always has it), the key asks its pair and the door then opens
  by itself.
  - Changed: `src/main.js` (card, sign line, `hideKey`/`reveal`/search
    props/puff, bridge hops + stone clicks, door auto-open, pause in
    `step()`, QA), `src/room.js` (`search` props with twinkles; `door`
    state gone), `src/levels.js` (`search` field and format comment; L1
    rooms 1–2 hide the key in props), `src/i18n.js` (DE/ES/EN texts),
    `src/audio.js` (`rattle`, `hop`, `cardOpen`), `index.html` (card,
    sign line). Removed: the carrier (key over the head, gold tint, its
    light), the door question flow for key rooms, the `key: {x, z}` and
    `carrier` room fields, the bottom plate.
  - Decisions made here: the treasure room's door still asks its pair
    (now in the card, opened when the hero walks up to it, no "later").
    The ambush no longer needs every skeleton bonked, only the key. A
    chest asks again only after the hero stepped away (≥ 3.2 units). On
    the bridge the near edge only lets you hop on at the base stone;
    from the last stone any of the three keys hops to the far bank.
    Empty hiding places give a coin stack 30 % of the time. Level 1
    room 2 (one skeleton) hides the key in props, so it is not "bonk the
    only skeleton".
  - **Checked** in headless Chromium (Linux, Playwright cache), inline
    verbs: `?qa=play&level=1..3` and with `&wrongall=1` (also as mage)
    reach the end screen; missed verbs return at the next key / bridge /
    rune room; `?qa=hurt` in key rooms (`pre=floor|taken`: key state and
    tried hiding places survive), the ambush (`level=3&stop=3`) and the
    boss (`pre=boss`: 2 skulls stay). A real-input run (Playwright
    keyboard and mouse): chest card with Esc, the "later" button, digits;
    bridge: walk onto the base stone, ↓ back, a wrong hop (fall, no
    heart lost), a click on the right stone, a digit hop, onto the far
    bank, walk out; boss card answered with a digit; the game clock and
    the golem stand still while the card is open. Screenshots
    `_shots/N-*.png` (1366×768, two at 1024×768, Spanish).
  - **Not checked:** a human playing (is the hop fun, are the twinkles
    enough of a hint, does the card feel too interrupting), sounds
    (`rattle`, `hop`, `cardOpen`), the site question engine (questions.js
    is unchanged), frame rate on a Chromebook (draw calls 20 → 32: the
    search props and twinkles are separate meshes), touch (a tap on a
    stone or a chip works like a click, but there is still no way to
    walk).
  - **Next:** owner play-tests the four notes; then step E, touch
    controls, tutorial.
- 2026-11-22 — **Word bridge rebuilt without special controls** (play-test
  note 5, master's layout; see "Rules as built"). Hop mechanic removed
  completely (`hopTo`, `bridgeChoose`, `bridgeBack`, `landHop`, hop keys,
  stone clicks, hop hints, `sfx.hop`, the `holds()` goal hook). Two pits
  with a row of three stones each, a strip of floor between; walk across
  the right stone.
  - Changed: `src/room.js` (`PITS`/`STONE`/`BASE_SIGN`, floor in three
    bands of squeezed tiles, slabs, pit floors, brick far walls fading
    into the dark, dark lips on the edges, base plate), `src/assets.js`
    (`mergeStatic` takes `sz`, a z-squeeze), `src/labels.js` (`wait`
    look for the "?" stones), `src/main.js` (`GOALS.bridge`,
    `dealStones`/`stepOnStone`/`updateBridge`/`dropHero`, QA `pick` walks
    across with W, `solve.bridge`, `info().bridge`), `src/levels.js`
    (bridge props moved away from the pit edges), `src/i18n.js` (DE/ES/EN
    "Walk across the stone with the right word"), `src/audio.js`.
  - Decisions: row B shows "?" until row A is solved; the unchosen stones
    of a solved row crumble away (only the teal path stays); after a drop
    the movement keys are released (no walking straight back into the
    gap); the hero enters at x −3 so it does not hide the base plate.
  - **Checked** (headless Linux Chromium, inline verbs):
    `?qa=play&level=1..3` and `&wrongall=1` reach the end screen, hearts 3;
    a real keyboard run (Playwright `page.keyboard`, DE 1366×768 and ES
    1024×768): wrong stone → crumble, back on the ledge, hearts 3, verb in
    the missed list; right stone onto the strip (bottom line
    `go → went → ?`); right row-B stone onto the far ledge (door open);
    out through the door into the next room. Walking sideways along both
    ledges and the strip, also into the props, never drops the hero.
    `node --check` on all `src/*.js`. Screenshots `_shots/R-*.png`.
  - **Not checked:** a human playing (does the strip feel roomy enough,
    is the drop clear), sounds, frame rate on a Chromebook (a few more
    meshes in the bridge room), the site question engine.
- 2026-11-22 — **"Things you can use" marker; no decorative coins**
  (play-test note 6, see "Rules as built").
  - New `src/marker.js` (`markUsable` / `unmark` / `clearMarks` /
    `updateMarks`): teal `#2ee6c0` floor ring, additive, pulsing
    (opacity 0.5–1, size ±7 %), plus 3 rising sparkles per mark. Teal was
    picked over amber: it reads against the warm torch-lit floor and the
    gold coins / key. Used on coin stacks, the key on the floor, search
    props (replaces the old twinkle sprites), closed chests, the boss
    stone. Coin stacks lost their gold glow sprite and bob + turn
    instead; the key's own light pool is a bit softer so the ring shows.
  - `src/levels.js`: decorative `coin_stack_*` removed from the treasure
    room and the boss room, all `trunk_large_A` (looked like chests) and
    `box_small_decorated` (has coins on it) replaced by barrels, crates,
    a keg and two columns with candles. `src/assets.js` no longer loads
    those three models. `src/room.js`: search-prop sparkles removed,
    chest keeps its object (`chest.obj`).
  - Draw calls (`__VD.info().calls`, 1366×768, room just entered),
    before → after: L1 room 1 32→25, L1 room 2 43→36, treasure room 35→31,
    chest rooms without search props +2 (L2 room 3 42→44, L3 room 2 51→53),
    all other rooms unchanged (bridge 55, rune 27, boss 28, ambush 20).
  - **Checked** (headless Linux Chromium, inline verbs): `?qa=play&level=1..3`
    and `&wrongall=1` reach the end screen; `?qa=hurt` (key on the floor,
    boss) restarts with the right marks; `node --check` on all `src/*.js`.
    Every room of every level screenshotted: no decorative coins left
    (L1: cellar, storage, bridge, runes, boss; L2: hall ambush, bridge,
    cellar, runes, treasure room, boss; L3: runes, hall, bridge, storage
    ambush, boss). Screenshots `_shots/M-*.png`.
  - **Not checked:** a human playing (is the ring too strong or too
    faint on a real screen, do kids read it as "use me"), frame rate on a
    Chromebook, touch.
- 2026-11-22 — **Weapons you can tell apart per hero** (play-test note 7,
  see "Heroes" and "Swing" in "Rules as built"). Knight sword + shield
  (teal, unchanged); Barbarian a big double axe (`axe_2handed` × 1.35, no
  shield, 2H slice, wider amber swoosh); Rogue two daggers (dual-wield
  scissor slice, two short coral crescents); Mage the staff upright with
  the gem up and glowing, purple swoosh, purple sparkles on a hit.
  - Changed: `src/heroes.js` (per-hero `gear`, `swing`, `trails`,
    `sparks`, `magic`, `portraitT`; `SWINGS` with measured clip timings),
    `src/assets.js` (one upper-body clip per swing, `Swing_<key>`; gear
    list from `gear`), `src/main.js` (swing reads the hero's swing, one
    swoosh mesh per trail with its own colour / direction / radii,
    `updateGear()` for `faceCam` / `upright` weapons, gem glow, sparks
    colour, magic sparkles; QA: `&hero=` now also plays `?qa=play` as that
    hero, `info().built`, pose command `face:deg`, portrait `&pt=`),
    `assets/` (new `axe_2handed.*`, `dagger.*`, `rogue_texture.png`;
    removed the unused `axe_1handed.*` and `shield_round_barbarian.*`;
    `anim_medium.glb` rebuilt: + `Melee_2H_Attack_Slice`,
    `Melee_Dualwield_Attack_Slice`, − `Melee_1H_Attack_Chop`), portraits
    regenerated with the weapons in view. `assets/` 4.56 → 4.61 MB
    (+45 KB; first load +24 KB: anim file +20 KB, portraits +4 KB).
  - Weapons that would show edge-on from above (axe head, dagger blades)
    turn about their handle each frame to face the camera; that is why the
    old `axe_1handed` read like a sword.
  - **Checked** (headless Linux Chromium, inline verbs): `?qa=play&level=1..3`
    and `&wrongall=1` as each of the four heroes reach the end screen
    (hearts 3); `?qa=swing` hit at 0.117 s for every hero (standing and
    running); `node --check` on all `src/*.js`. Screenshots `_shots/W-*.png`.
  - **Not checked:** a human playing (does the axe feel heavier, is the
    rogue's double cut clear at full speed, sound is the same `swing` for
    everyone), frame rate on a Chromebook (one more swoosh mesh for the
    rogue, one sprite on the staff).
- 2026-11-22 — **Touch controls + check pass on the site question engine**
  (release blockers; see "Controls and devices" in "Rules as built").
  - Touch: new `src/touch.js` (floating stick on the left 60 % of the room,
    sword button bottom right = Space, axis snap ±20°, stops at a card / a
    bridge drop until the finger lifts); `main.js` reads the stick in
    `updateHero()`, all buttons via `tap()`, no "click to play" overlay in
    touch mode, `body.playing` class; `index.html` styles, `touch-action`,
    no callout / selection, `viewport-fit=cover` + safe-area insets,
    compact layout below 500 px height (phone landscape); `i18n.js` `_touch`
    text twins (DE/ES/EN), the unused `touchSoon` removed; `audio.js`
    resumes a suspended AudioContext on every tap (iOS). Phone landscape is
    playable; portrait keeps the "turn your device" message.
  - Engine check (site-like server: game at `/` + `lib`/`data` symlinks to
    `homepage/`): `?qa=play&level=1..3` and `&wrongall=1`, in EN, DE and ES,
    all reach 'end' with `source: 'engine'`; level 1 pools all tier 1, level
    2 tiers 1–2, level 3 tiers 2–3; `askLog` shows no 3rd-form question
    that did not follow its own 2nd form (key, door, chest, rune, bridge,
    boss, vault, ambush rooms). Long engine verbs (`understand`,
    `wake up`) fit the card and the plates. No fixes were needed.
  - **Checked** (headless Linux Chromium, `hasTouch`/`isMobile`, the
    engine server): `tools/qa-touch.cjs` at 1024×768 (DE) played level 1
    by touch only — stick walk, sword-button search until the key pops,
    key card by tapped chips (one wrong), door, chest "later" + back +
    answer, skeleton bonked by the button, stick + button together, bridge
    (one wrong stone, then both rows), rune doors (one wrong), boss (stone,
    chip, three bonks), end screen "Levels" button, sound toggle, hero buy
    (Barbarian for 40) and select in the menu, no page scroll/zoom; with
    `document.hasFocus()` faked false (iframe) touch still plays. 844×390
    (ES): menu, room 1 to room 2 by touch. Desktop: `?qa=play` levels 1–3 ±
    `&wrongall=1` with the inline verbs reach 'end', `?qa=keys` moves the
    hero, no touch controls or touch texts without touch, `node --check`
    on all `src/*.js`. Screenshots `_shots/T-*.png` (tablet room / card /
    menu / bridge / rune / end, phone room / card / menu / bridge / end /
    portrait, desktop).
  - **Not checked:** a real iPad / Android tablet / phone / touch
    Chromebook (Safari audio unlock, real thumb comfort, frame rate), a
    hardware keyboard on an iPad (a key press hides the touch controls,
    the next touch shows them again), tablet in portrait (playable, room
    small). Next: owner play-test on a tablet, then release (RELEASE.md).
- 2026-11-22 — **Play-test notes 8–12 built** ("rebuild all now"; see
  `PLAYTEST-NOTES.md` and "Rules as built").
  - 8 Mage staff: `updateGear()` slerps the upright staff into the hand's
    pose while a swing runs (`gearBlend`), so it follows the arm, gem
    first; the purple arc runs through the gem (trail `tip`). At rest it
    stands upright as before.
  - 9 Crates and barrels smash (new `src/debris.js`, `sfx.crunch`); no
    "Empty!" text; collision removed; the key pops out of the wreck.
  - 10 Rune room = two walls in a row (owner's option a): first wall at
    z 0 with three doors (2nd form, the right one lets you through, the
    wall fades while you are behind it), the back wall's doors ask the
    3rd form ("?" until then).
  - 12 Questions only on Space: the key asks nothing; a verb book on a
    lectern in a rune circle right of the door (key, ambush, treasure
    rooms) asks the pair and unlocks the door; skeletons wait at the
    circle's edge, arrows / orbs fizzle there; chests and the boss stone
    open with Space too ("Space: …" prompt, `#prompt`). Removed: the key
    card, the treasure-door card, walking into chests, the chest's
    step-away rule.
  - 11 Bosses: L1 Golem (unchanged), L2 Necromancer (floats, raises up to
    3 minions; right answer = "Spell broken!", minions crumble), L3
    Skeleton Mage (fans of slow orbs after a "!!" wind-up). `BOSSES` in
    `main.js`, `boss:` in `levels.js`; models load when level 2 / 3
    starts (`Assets.loadBoss`).
  - Decisions made here: L3 boss = Skeleton Mage (ranged orbs) rather than
    a spinning warrior, because the golem already does the melee charge;
    the book stands right of the door at x 2.8 z −5.2 (behind the storage
    room's pillars it was hidden), the cellar's and hall's right-hand
    column + candle went for it; both rune walls keep full-height KayKit
    doorways and the first one fades instead of being lowered; a wrong
    door's push back re-arms the choice (0.8 from the wall, was 1.2), so
    the next door can be tried at once; a bonked skeleton without the key
    still says "Nothing!" (only crates lost their text); a boss's touch
    costs a heart for all three (was golem only); the bosses' staffs are
    flipped head-up in the hand; HUD pills are smaller below 500 px
    height so the back wall's signs clear the room label on phones.
  - 13 (added by the master mid-round): barbarian axe × 1.35 → 1.05; all
    swings are forehands (clips reversed, see "Forehand for everyone");
    before/after strips `_shots/P3-swing-<hero>.png`.
  - Sizes: `assets/` 4.61 → 5.50 MB (+ `Necromancer.glb` 409 KB,
    `Skeleton_Mage.glb` 270 KB, `anim_boss.glb` 134 KB, `Skeleton_Staff.*`
    72 KB; none of it in the first load), `src/` 0.18 → 0.22 MB. Draw
    calls: the lectern is baked to 4 meshes (+ circle + glow); L1 room 1
    25 → 29.
  - **Checked** (headless Linux Chromium, private copy, then copied
    over): `?qa=play&level=1..3` and `&wrongall=1` reach 'end' with hearts
    3 (inline verbs; as all four heroes with `&wrongall=1`); the site
    engine run `tools/qa-engine.cjs` levels 1–3 ± wrongall: 'end',
    `source: engine`, no chain-order violations; `tools/qa-touch.cjs` at
    1024×768 DE plays level 1 by touch (book without key → hint, key taken
    without a card, book by the sword button with one wrong chip, chest
    prompt / button / "later" / button again, both rune walls incl. a wrong
    first-wall door and walking through the right one, boss stone needs the
    button, golem down, end screen) and at 844×390 ES room 1; `?qa=hurt` in
    a key room (`pre=floor|taken|book`), the ambush (`pre=taken`) and all
    three boss rooms (`pre=boss`: 2 pips kept); `?qa=swing` hit at 0.117 s
    for all four heroes, standing and running, blade ahead at the hit
    (forehand); a ward check (hero in the circle 12 s next to a skeleton and
    an archer: 0 hits, 2 arrows fizzled, skeleton held at 2.5 from the
    centre); orbs hit a hero who stands still; a smashed crate has no
    collision and shows no text; `node --check` on all `src/*.js`.
    Screenshots `_shots/P3-*.png` (looked at; fixed from them: the book was
    hidden behind the storage pillars, the circle was too faint, the boss
    intro lines covered the bosses / the hint, the bosses' staffs pointed
    into the floor, the mage's cast glow was hidden, the phone HUD touched
    the back wall's signs).
  - **Not checked:** a human playing (is the book a welcome pause or a
    chore, does the faded first wall read, necromancer / mage difficulty
    and orb speed, forehand feel), sounds (crunch, clunk, book, summon,
    orb, laugh, fizzle), frame rate on a Chromebook (debris pool, the rune
    room's transparent wall, minions), a real tablet / phone.
  - **Next:** owner play-test of notes 8–13; then release (RELEASE.md:
    new size and new info-page text).
- 2026-11-22 — **Learning engine + game events wired (classroom phase 1,
  master request) and play-test note 14 built** (see "Learning stats and
  game events" and "Verb book" in "Rules as built").
  - New `src/analytics.js` (`Track`): `recordAttempt` for every
    question's first choice (from `judge()`, `seen` flag on the question)
    and the events `level_start`, `room_done`, `player_dizzy`,
    `boss_round`, `level_end`; dynamic imports of `/lib/krabsy-stats.js`
    and `/lib/krabsy-game-events.js`, no-ops without the site; nothing from
    `?qa=` runs unless `&track=1`. `src/questions.js`: smart mix first
    (one `getChainSet({ smart: true })` per tier of the level), `item` on
    engine questions, `fresh()` resets `seen`; `info().smart`.
  - Note 14: the book can be read before or after the key; read = it folds
    shut and the circle fades (no ward any more); key rooms unlock when
    both are done (`keyDone()`); new hints `hintKeyStill`, `hintNeedBoth`
    (EN/DE/ES; `hintBookNoKey` removed). `room.js` `makeLectern()`: the
    book is two hinged halves (stand 2 + book 6 draw calls, was 4).
    QA: `?qa=play` reads the book first in key rooms with an odd index
    (`&bookfirst=1` = all), `&pre=bookonly` for `?qa=hurt`, `info().bookShut`
    / `wards`; `tools/qa-touch.cjs` room 1 now goes book → key by touch.
    `PLAYTEST-NOTES.md`: note 14 moved to done.
  - **Checked** (headless Linux Chromium; site-like folder with `lib` /
    `data` symlinks, and the plain dev server): with `&track=1`, level 1
    sends `level_start {level:1}`, five `room_done` (e.g. `{level:1, room:1,
    type:'key', seconds:4, hits_taken:0}`), three `boss_round` (`golem`,
    right, past/pp, pips 3/2/1) and `level_end {level:1, result:'won',
    stars:2, seconds:36, answers:13, correct:12, first_try:11,
    questions:12, coins:40, rooms:5, hits_taken:0, dizzy:0}`; 12
    `recordAttempt` calls (`run:past:false`, `run:participle:true`, chest
    `take:past:true`, … source `verb-dungeon`, topic `irregular_verbs`) =
    12 questions, retries not counted (`&wrongall=1`: 18 answers, 12
    records). `?qa=hurt` sends `player_dizzy`, and the room's `room_done`
    after the restart has `hits_taken: 3`. Without `&track=1`: 0 records,
    0 events; on the dev server (no `/lib`): inline verbs, no errors.
    Smart mix: with four tier-1 verbs stored as wrong, level 1's pool held
    all four, levels 2/3 kept their tier mix (`1221222111`, `2333232322`).
    `tools/qa-engine.cjs` levels 1–3 ± wrongall: 'end', hearts 3, engine,
    no chain-order violations (site folder); the same with the inline list
    (dev server). Book first (`?qa=play` levels 1–3, `&bookfirst=1`):
    door stays locked with the book closed and no ward, opens when the
    key is taken; `?qa=hurt&pre=bookonly`: the book stays read through the
    restart. `tools/qa-touch.cjs` 1024×768 DE (site folder): all 43
    checks OK, incl. book first by the sword button (closed, no ward,
    door locked, hint "Das Buch ist gelesen! …"), then key → unlocked.
    `node --check` on all `src/*.js`. Screenshots
    `_shots/P4-book-open.png`, `P4-book-read-locked.png` (+ `-de`),
    `P4-book-closing.png`, `P4-book-zoom.png` (half-closed / closed).
  - **Seen, not changed:** with the circle gone, a lighter rectangle shows
    on the floor left of the lectern in L1 room 1 (it was hidden under the
    circle; looks like a gap in the moon shadow).
  - **Not checked:** a real site page (iframe → wrapper → api), the
    dashboard; a human playing book-first.
  - **Note 15 (same round): hero portraits on a neutral background.**
    `?qa=portrait` now hides everything but the hero (weapons are on its
    hand slots) and the lights, drops the fog and draws a vertical navy
    gradient (`#2d5b91` → `#122a50`, the same for every crop) with a warm
    front key light and a cool rim light. The four `assets/portraits/*.webp`
    re-rendered (same crop and 144 px, WebP q82: 2.1–3.2 KB each, were
    4.6–4.8 KB). Looked at in the menu: `_shots/P4-menu-portraits.png`
    (all unlocked) and `P4-menu-portraits-new.png` (new player: three dimmed
    as locked); all four read clearly against the cards, weapons in frame.
    `PLAYTEST-NOTES.md`: notes 14 and 15 done.

- 2026-11-23 — Master session: the Space key cap (controls box + use prompt) now reads Leertaste / Espacio (i18n key `keySpace`), source + live build (25a1ae2). Owner: menus in the child's language, English only for what is learned.

- 2026-11-25 — Master session (owner's first real phone test): **upright phones
  play sideways** (`src/rotate.js`, see "Controls and devices"); `main.js` and
  `touch.js` use the logical size; `tools/qa-touch.cjs` supports 390×844. The
  wrapper pages now hide the site header on short landscape screens
  (`homepage/lib/krabsy-game-info.css`), so landscape gets 354 px instead of 306.
  Checked headless (Linux Chromium): touch run at 390×844, `?qa=play&level=1` at
  1366×768, 844×390, 768×1024 (no turn there). **Not checked:** a real phone.
- 2026-11-25 (later) — Module URLs are versioned now (import map entries
  `./src/x.js` → `./src/x.js?v=<hash>`, `main.js?v=`): **after changing `src/`, run
  `python3 tools/stamp_game_modules.py games/verb-dungeon homepage/games/verb-dungeon`**
  (repo root). Reason: the owner's phone ran a cached old `main.js` with the new
  `index.html` after the deploy. `#rotate` ("turn your device") shows again on an upright phone
  whenever sideways mode is not running (`html:not(.rot)`).
- 2026-11-25 — **The hero is the child's figure; the coin hero shop is gone**
  (owner decisions 2026-11-25, `docs/figures-shells-world.md`; see "The hero
  is the child's figure" and "Hero-shop migration" in "Rules as built").
  - New `src/figure.js` (`loadHeroFigure`, `migrateHeroes`, the mapping
    barbarian → `char:Barbarian`, rogue → `char:Rogue_Hooded`, mage →
    `char:Cleric` + `hat:wizard`). `src/main.js`: `buildHero({ root, own })`
    / `{ template }`, `loadHero()` in parallel with `Assets.load()`, old
    Knight on any failure, menu "your figure" line + link instead of the
    hero cards, HUD coins = this run's coins, QA `&hero=` removed,
    `info().hero` = figure | fallback | knight, `coinsRun`. `src/heroes.js`:
    one hero def (sword; shield `figure: false`), `SWINGS` only `slice`,
    `Save` keeps the old fields untouched + `migrated`. `src/assets.js`:
    `Knight.glb` no longer in the first load (only for the no-site
    fallback). `src/chars.js`: option `own`. `src/i18n.js`: `figureOwn`,
    `figureNone`, `figureLink` (DE/ES/EN); `needCoins`, `hero_*` gone.
    `index.html`: menu styles; import map restamped (`figure.js` added).
    `tools/qa-touch.cjs`: checks the figure link instead of buying a hero.
  - Events: there never was a hero-purchase event, so nothing was dropped;
    `level_end.coins` stays (this run's coins).
  - First load: the figure (one character file 0.2–0.6 MB, + one per
    borrowed accessory, from `/assets/figures/`, shared with the site's
    figure page) instead of the Dungeon's `Knight.glb` (336 KB); the shared
    animation files are not loaded (`clips: false`).
  - **Checked** (headless Linux Chromium, scratch copy of `homepage/` with
    this build, `api.krabsy.com` blocked): no figure → catalogue Knight with
    sword + shield; free figure (Witch, recoloured) → sword only; Hiker
    with the toy-soldier hat, wings and goggles (owned) and Knight with
    the long cape → shown, nothing clips in the rooms, no `hide` needed; a
    saved Vampire not owned → fallback Knight; save owning Barbarian + Mage
    (hero mage) → shells owned `char:Barbarian`, `char:Cleric`, `hat:wizard`,
    figure saved = Witch + wizard hat in purple, balance unchanged, reload =
    identical storage; rogue + barbarian save (Barbarian already owned) →
    `char:Rogue_Hooded` added, the same again with the flag removed;
    dev server without `/lib` → old Knight, migration not marked.
    `?qa=play&level=1` (none / free / hat+back) and `level=3` (migrated
    figure, ES) reach the end screen with hearts 3 (book, key, chest, rune,
    bridge, boss stone); `?qa=swing`: hit at 0.117 s as before; hands at
    0.43 from the body in idle (no T-pose); 0 console errors on the site
    copy. Menu at 1366×768 DE and 844×390 ES touch looked at.
  - **Not done / not checked:** the shop heroes' files (`Barbarian.glb`,
    `Rogue_Hooded.glb`, `Mage.glb`, `axe_2handed.*`, `dagger.*`, `staff.*`,
    their textures, `assets/portraits/`) are unused now but still in the
    folder (deleting them was not allowed in this session): remove them and
    their `CREDITS.md` line, and leave them out of the build copy (−1.2 MB).
    `tools/qa-touch.cjs` not re-run. A real device; the figure page link
    from inside the real wrapper iframe.
  - **Release (master):** copy + stamp as usual; `RELEASE.md`'s "the other
    heroes load when picked" and the thumbnails' "three heroes" key art are
    out of date.
