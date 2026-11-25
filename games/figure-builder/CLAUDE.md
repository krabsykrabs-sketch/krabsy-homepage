# Krabsy figure builder ("Meine Figur") — brief

Owner idea (2026-11-25): every child chooses and customises their own
character once, for the whole platform (and later per class). KayKit only,
**no weapons**. First user: the Quiz-Raum (`games/quiz-show/`), later other
3D games.

**What you own:** this folder. Integration into the site (`homepage/`), the
Quiz-Raum and the class system is master / Quiz-Raum session work, listed
below as later steps. Stage only this folder:
`git add games/figure-builder && git commit …`. Don't push.

Status: **prototype (2026-11-25)**, local only, not on the site.

## How to run it

`python3 -m http.server 8145` in this folder → http://localhost:8145/
(port 8145; 8140–8144 are other game dev servers, 8142 the Quiz-Raum).
`?lang=es` for Spanish. QA: `node tools/qa.cjs <outDir>` (7 checks);
contact sheets: `node tools/sheet.cjs heads|hats|outfits <out.png>`.

| File | Job |
|---|---|
| `src/figure.js` | catalogue (`OUTFITS`, `HEADS`, `HATS`, `GLASSES`, `BACKS`, palettes), `normalize`, `randomConfig`, `buildFigure(config)` (parts onto one skeleton + recoloured palettes), `loadClips`, `inspectFigure` |
| `src/builder.js` + `index.html` | the page: turning preview (drag), ‹ › per slot, colour swatches (★ = original), 🎲, reset, save; DE/ES |
| `tools/sheet.html/.cjs` | contact sheets for checking combinations |

## What KayKit allows (checked in the files, 2026-11-25)

- All 14 figures we have (Quiz-Raum: Protagonist A/B, Hiker, Witch,
  Superhero, Helper A/B, Caveman; Adventurers 2.0: Knight, Ranger, Rogue,
  Rogue_Hooded, Barbarian, Mage) use the **same skeleton** (Rig_Medium) and
  are built from separate **skinned** parts: Head, Body, ArmLeft/Right,
  LegLeft/Right, plus extras (Hat, Glasses, Backpack, Cape, BearHat,
  Helmet + Visor, Mask, Quiver). So a part from one figure can be bound to
  another figure's skeleton by bone name: heads, hats, glasses, backpacks
  and capes mix freely; the shared walk/run/jump/emote animations work.
- Colours: every figure has its own 1024² palette texture (8 × 4 swatch
  cells, vertical gradients). Parts keep their own texture when mixed.
  Recolouring = rewriting swatch cells in a canvas copy of a texture:
  - skin: cell (0,0) on every figure → skin-tone choice,
  - hair: the head's other non-dark cells,
  - outfit: the most-used saturated cell of the body (main colour) and of
    the legs (trousers), detected from the UVs.
- **Weapons:** separate files (swords, bows, staffs …), never copied. The
  Ranger's quiver (arrows) is left out too. The Mage is reserved for the
  teacher in the Quiz-Raum (not offered here).

## Slots (prototype)

| Slot | Options |
|---|---|
| Outfit (body, arms, legs) | 11 (13 figures minus Rogue_Hooded and Helper_B: same clothes as Rogue / Helper_A) |
| Head (face + hair) | 13 heads |
| Headwear | none, cap (Hiker), witch hat, Helper A hat, Helper B hat, bear hat (Barbarian), helmet (Knight, without its visor: it covered the face) |
| Glasses | none, Protagonist A, Witch |
| Back | none, 3 backpacks (Hiker, Protagonist A/B), 4 capes (Superhero, Knight, Ranger, Rogue) |
| Colours | skin tone (6), hair (8), main colour (10), trousers (10) |

Not offered: Rogue_Hooded's mask (looks like a robber), the quiver, any
weapon. Hat/head check (`tools/sheet.cjs hats`, every head × every hat):
everything sits well except the Protagonist_A head, which has a cap built in
(`HEAD_NO_HAT`: the hat row is switched off for it). Many heads carry their
own hair accessories (bow, hood, mask) — that's part of the head.

Technical notes found while building:
- Superhero's cape is not skinned but hangs on the `chest` bone (the only
  such part): `prepare` keeps the bone name and the builder hangs it on the
  same bone of the new skeleton.
- Parts with two materials (glasses: frame + lenses) arrive as
  `…_Glasses_1/_2`; lenses have no palette texture and keep their material.
- three.js keeps glTF textures unflipped (`flipY = false`): UV v = 0 is the
  top row of the palette image, so cell row r = image row r from the top.
- Main colour cell = most-covered body cell weighted by saturation
  (`n · (0.35 + s)`): a yellow jacket beats grey trousers, but the Knight's
  big grey armour still wins over his belt. Trousers never take the main cell.

The choice is a small JSON (`krabsy_figure_v1` in localStorage):
`{ v:1, outfit, head, hat, glasses, back, skin, hair, main, legs }` (names
and palette indices, no free text).

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

## Log

- 2026-11-25: brief + first prototype (owner: "work on the character builder").
- 2026-11-25: prototype works on localhost: 11 outfits, 13 heads, 7 hats, 3
  glasses, 8 back items, 4 colour slots; saved in `krabsy_figure_v1`.
  Fixed on the way: Superhero's rigid cape, two-material glasses, main
  colour choice. qa 7/7. Next: owner looks at it; then the later steps.
