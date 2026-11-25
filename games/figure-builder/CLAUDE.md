# Krabsy figure builder ("Meine Figur") — brief

Owner idea (2026-11-25): every child chooses and customises their own
character once, for the whole platform (and later per class). KayKit only,
**no weapons**. First user: the Quiz-Raum (`games/quiz-show/`), later other
3D games.

**What you own:** this folder. Integration into the site (`homepage/`), the
Quiz-Raum and the class system is master / Quiz-Raum session work, listed
below as later steps. Stage only this folder:
`git add games/figure-builder && git commit …`. Don't push.

Status: **prototype v2 (2026-11-25)**, local only, not on the site.

## How to run it

`python3 -m http.server 8145` in this folder → http://localhost:8145/
(port 8145; 8140–8144 are other game dev servers, 8142 the Quiz-Raum).
`?lang=es` for Spanish. QA: `node tools/qa.cjs <outDir>` (13 checks);
contact sheets: `node tools/sheet.cjs hats|glasses|backs <group> <out.png>`;
portraits: `node tools/portraits.cjs [sheet.png]` (renders `assets/portraits/`).

| File | Job |
|---|---|
| `src/figure.js` | catalogue (`CHARS`, `HATS`, `GLASSES`, `BACKS`, `NO_HAT`, palettes), `normalize`, `randomConfig`, `charInfo`, `buildFigure(config)`, `loadClips`, `inspectFigure` |
| `src/builder.js` + `index.html` | the page: ① gallery with tabs, ② ‹ › per slot + colour swatches (★ = original), preview (drag, 🔄 toggle, animations), 🎲 (keeps the character), reset, save; DE/ES |
| `tools/sheet.*`, `tools/portraits.*`, `tools/qa.cjs` | contact sheets, gallery portraits, QA |

## How it works now (v2, after the owner's first feedback)

**One main decision, then customising** (owner, 2026-11-25): step 1, pick a
character from a picture gallery (tabs Menschen / Fantasy / Monster &
Roboter); step 2, customise it: hat, glasses, back item (each: "★ Original"
= what the character comes with, "nichts", or a catalogue item) and colours
(skin + hair only for human characters; main colour, trousers, accessory
colour for all). Characters are never mixed with each other's heads or
bodies any more (that's what broke combinations in v1).

- **42 characters** (all KayKit, CC0, same skeleton Rig_Medium):
  - people (20): Protagonist A/B, Hiker, Witch, Superhero, MagicalGirl, Helper A/B,
    Caveman, Farmer A/B, Driver, Survivalist, Werewolf_Man, Clown, ToySoldier,
    SpaceRanger, Ninja, Engineer, Lorekeeper;
  - fantasy (12): Knight, Paladin, Ranger, Rogue, Rogue_Hooded, Barbarian, Druid,
    Cleric, Vampire, Tiefling, PlantWarrior, AvianSwordsman;
  - monsters & robots (10): OrcRaider, Werewolf_Wolf, MonsterCostume, Robot One/Two,
    Skeleton Minion/Warrior/Rogue/Mage, Necromancer.
  Source: `/home/janah/dev/_assets/kaykit` (Mystery Monthly Series 4/5/6,
  Adventurers 2.0, Skeletons 1.1). `SpaceRanger_FlightMode.glb` is only an
  accessory source (jetpack, space helmet). Licences in `assets/chars/`.
- **Left out:** Mage (Quiz-Raum teacher), Hoarder (sword in a pouch),
  ActionFigure (cigar), Marksman (sniper look), Dummy (target), mannequins,
  very big/wide ones that would tower over the others (4GTN, Clanker,
  CombatMech, FrostGolem, Monstrosity, Skeleton_Golem, OrcBrute,
  BlackKnight), duplicates (Monster, Barbarian_Large, Paladin_with_Helmet).
  Dropped parts: Ranger's quiver, Rogue_Hooded's mask.
- **Accessories:** 13 hats, 5 glasses, 15 back items (6 backpacks, orc pack,
  jetpack, wind-up key, bat wings, 5 capes) — taken from the characters.
- **Hats off** (`NO_HAT`) for heads they don't fit: Protagonist A/B (cap in
  the head), robots, werewolf, dino costume, space ranger. Checked with
  `tools/sheet.cjs hats|glasses|backs <group>` (every character × every item).
- **Turning:** off by default, "🔄 Drehen" button; dragging always works.
- Saved as `krabsy_figure_v2`: `{v:2, char, hat, glasses, back, skin, hair,
  main, legs, acc}` (ids and palette indices only; `normalize()` cleans
  anything else).

Technical notes:
- Parts move between characters by bone name. Skinned parts get the source
  bone inverses scaled by (source bone scale / target bone scale); rigid
  parts (hats/capes on the `head`/`chest` bone) hang on the same bone.
  Rigid parts on another part (jetpack wings, helmet visor) come along with
  their parent's copy. Multi-material parts arrive as `…_1/_2` (glasses).
- The toy soldier's hat really is that tall (1.8 m bearskin).
- OrcRaider's texture is a separate file (`OrcRaider_texture.png`).
- Colours rewrite palette cells (8 × 4) in a 256 px canvas copy per source
  character; skin = cell 0 when it looks like skin; main colour = most
  covered body cell weighted by saturation. Weak spot: on mostly brown /
  leather outfits (orc) the main colour hits a small trim only.

## Later steps (not in the prototype)

1. Polish + a check on a cheap Chromebook (each child = own textures).
2. Move `src/figure.js` (catalogue + `buildFigure(config)`) to
   `homepage/lib/` with the character files under `homepage/assets/figures/`
   so every game loads the same ones.
3. Site page "Meine Figur" / "Mi personaje" (DE/ES), linked from the
   games hub and the Quiz-Raum join screen.
4. Quiz-Raum: join sends the figure JSON (server validates names/indices,
   relays it in the player list); the avatar is built with `buildFigure`.
   The old 8-figure choice stays as the quick option.
5. Classes (phase 2): store the figure with the pupil, so it follows them
   to another device.

Owner idea (2026-11-25): the figure becomes the main character in **all**
3D games (Quiz-Raum, Verb Hatchery, Verb Platformer, Verb Valley, Verb
Kitchen, Verb Dungeon — all already on Rig_Medium), plus points across all
games to unlock characters and accessories. **Verb Towers** gets a main
character too: the child's figure as the builder who walks over and builds
the towers. **Written up: `docs/figures-shells-world.md`** (figure in all 3D games, shells, Krabsy world).

Owner idea (2026-11-25, "eventually"): the landing page as a **3D world**
where the child walks with their figure to the different games. Notes for
the brief: keep the normal HTML pages as they are (teachers, search engines,
slow devices, screen readers) and make the 3D world an extra entrance
("Krabsy-Welt"), loaded only on demand; it's the natural home for the
figure and the points (shop, unlocks).

## Owner feedback

Batch 1 (2026-11-25) — **done** in v2: rotation button; "not all
combinations work" → one character + accessories; more characters (orc,
skeletons and others); main decision first, then accessories + colours.

**Parked (owner, 2026-11-25):** weeding out combinations that don't look
good is owner work and is parked for now. Idea for when it resumes: a review
page built from the contact sheets where the owner clicks bad pairs
(character × item) and it writes the exclusion list.

Batch 2 (collecting, 2026-11-25):
1. The bird character (AvianSwordsman) has no preview picture in the
   gallery. Cause known: `tools/portraits.html` hides parts matching
   /Sword/, which matches the character's own name → empty picture. Fix the
   filter and re-render its portrait.

## Log

- 2026-11-25: brief + first prototype (owner: "work on the character builder").
- 2026-11-25: prototype works on localhost: 11 outfits, 13 heads, 7 hats, 3
  glasses, 8 back items, 4 colour slots; saved in `krabsy_figure_v1`.
  Fixed on the way: Superhero's rigid cape, two-material glasses, main
  colour choice. qa 7/7. Next: owner looks at it; then the later steps.
- 2026-11-25: v2 after owner feedback batch 1: character gallery (42 KayKit
  characters in 3 groups) + accessories (13 hats, 5 glasses, 15 back items) +
  colours; turning off by default with a 🔄 button. Fixed: jetpack wings /
  visor copied twice, bone-scale compensation. qa 13/13 (all characters,
  72 accessory combinations). Next: owner looks at it.
