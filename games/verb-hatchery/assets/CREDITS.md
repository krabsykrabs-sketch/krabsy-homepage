# Asset credits

All models are CC0 (public domain) unless noted (Quaternius, KayKit by Kay Lousberg,
Kenney, Tiny Treats by Isa Lousberg), copied from the shared library `/home/janah/dev/krabsy-homepage/assets/` and `/home/janah/dev/_assets/` (not in git).
Only the files in use are copied here.

| Files | Pack |
|---|---|
| `qnature/qnature.glb` + `qnature/atlas.webp`: all trees (CommonTree, Pine, TwistedTree, DeadTree, the giant `TwistedTree_Big`), bushes, ferns, clover, plants, grass, flowers, petals, mushrooms, rocks (`Rock_Medium_*`, the bare grey `Rock_Lo_*`), pebbles, stepping stones (`RockPath_*`) | Quaternius Stylized Nature MegaKit (Standard, free) — CC0, quaternius.com |
| in the same file: `Lantern_Wall`, `Banner_1_Cloth`, `Barrel`, `Crate_Wooden`, `Bench`, `Bag`, `Cauldron`, `Stall_Empty`, `FarmCrate_Carrot`, `Stool` (yard, farm, Forest camp, ruin) | Quaternius Fantasy Props MegaKit (Standard, free) — CC0 |
| in the same file: `Prop_WoodenFence_Single`, `Prop_WoodenFence_Extension1/2`; the hatchery building, its tower and the Meadow ruin: `Wall_Plaster_*`, `Wall_UnevenBrick_*`, `Corner_Exterior_Wood`, `Window_Wide_Round1`, `WindowShutters_Wide_Round_Open`, `Door_1_Round`, `DoorFrame_Round_WoodDark`, `Roof_RoundTiles_8x12`, `Roof_Front_Brick8`, `Roof_Tower_RoundTiles`, `Prop_Chimney2`, `Prop_Wagon`, `Prop_Brick1/3`, `Prop_Vine2/5` | Quaternius Medieval Village MegaKit (Standard, free) — CC0 |
| in the same file: `Crop_Pumpkin`, `Crop_Carrot`, `Crop_Corn`, `Crop_Tomato`, `Crop_Wheat` (the farm, the wheat field) | Quaternius Ultimate Crops ("Nature Crops Pack", `License.txt`: CC0) — source `/home/janah/dev/_assets/quaternius/ultimate-crops/OBJ` (`*_4.obj` + `.mtl`) |
| `characters/Protagonist_A.glb`, `Protagonist_B.glb` (player characters) | KayKit Mystery Monthly Series 5, "10 – April 2025 – Protagonists" |
| `props/nature/*` (lily pads, canoe, the Volcano's stone heads) | Kenney Nature Kit (kenney.nl) — CC0 |
| `props/pirate/*` (palms, shipwreck, pirate ship, rowing boats, barrels, crate, chest, flag, sand rocks, grey rocks `rocks-a/b/c`, `bottle`, `tool-shovel`, `hole`, tower = lighthouse) + `Textures/colormap.png` | Kenney Pirate Kit — CC0 |
| `props/survival/*` (signpost, bedroll) | Kenney Survival Kit — CC0 |
| `props/playground/*` | Tiny Treats – Fun Playground 1.0 FREE (Isa Lousberg) — CC0 |
| `props/picnic/*` | Tiny Treats – Pleasant Picnic 1.0 FREE (Isa Lousberg) — CC0 |
| `props/park/*` (fountain) | Tiny Treats – Pretty Park 1.0 FREE (Isa Lousberg) — CC0 |
| `props/gems/*` (volcano crystals) | KayKit Resource Bits 1.0 (EXTRA) — CC0 |
| `characters/anim_player.glb` (animation only) | KayKit Mystery Monthly Series 5, `Animations/gltf/Rig_Medium` |

`qnature/` is built from the kits in `/home/janah/dev/_assets/quaternius/packs/`
and the crops in `/home/janah/dev/_assets/quaternius/ultimate-crops/OBJ` by
`tools/build-qnature.mjs` (see its header): the models are simplified (the
kit's trees have 3,000–10,000 triangles, ours 500–1,300; a roof 6,400 → 700),
bark / wood / metal / plaster / stone / roof tiles are baked into vertex colours
(the village kit's wall textures repeat, so they cannot go into the atlas), the
leaf shapes, plants, flowers, rocks, stones and vine leaves share one
1024 × 1404 texture atlas, normal maps are not used. 108 models, 27,000
triangles, 1.05 MB + 130 KB. Rebuild:

```
mkdir /tmp/q && cd /tmp/q && npm i meshoptimizer sharp
MESHOPT=/tmp/q/node_modules/meshoptimizer/index.js SHARP=/tmp/q/node_modules/sharp \
  node tools/build-qnature.mjs
```

`anim_player.glb` keeps only the bones and 9 clips, built with the Tower
Defense tool:

```
python3 ../tower-defense/tools/strip-rigs.py assets/characters/anim_player.glb \
  Idle_A,Walking_A,Running_A,Jump_Start,Jump_Idle,Jump_Land,PickUp,Hit_A,Interact \
  <pack>/Rig_Medium_General.glb <pack>/Rig_Medium_MovementBasic.glb
```

`<pack>` = `assets/KayKit_Mystery_Monthly_Series_5/Animations/gltf/Rig_Medium`
(repo root).

**Hatched creatures, `animals/*_Animations.glb` — NOT in git (see `../.gitignore`):**
Quirky Series – FREE Animals v1.4 by Omabuarts Studio (8 animals: Colobus,
Gecko, Herring, Inkfish, Muskrat, Pudu, Sparrow, Taipan; model + texture +
18 clips each, ~270 KB). Source: `/home/janah/dev/_assets/_zips/Quirky Series
- FREE Animals v1.4.7z` (extract with Windows `tar.exe -xf`; copy
`3D Files/GLTF/Animations/*_Animations.glb`). **Licence not confirmed:** no
licence file in the archive, blank on https://omabuarts.itch.io/quirky-series-free-animals
(not CC0, unlike the rest of the library). Confirm before committing or
releasing. Without these files the game uses the code-built creatures.

Eggs, incubators, pens, the base deck, thief crabs, hats, the fallback
creatures, the beach pier, parasols, towels and beach ball, the hatchery's
wind wheel and sign board, the stone bridge, the scarecrow, the Forest camp's
tent, stumps and logs, the lava are built from primitives in code. Three.js 0.169 (MIT) is in
`vendor/three/`; fonts Fredoka One and Nunito (OFL) in `fonts/`.
