# Asset credits

All models are CC0 (public domain) unless noted (Quaternius, KayKit by Kay Lousberg,
Kenney, Tiny Treats by Isa Lousberg), copied from the shared library `/home/janah/dev/krabsy-homepage/assets/` and `/home/janah/dev/_assets/` (not in git).
Only the files in use are copied here.

| Files | Pack |
|---|---|
| `qnature/qnature.glb` + `qnature/atlas.webp`: all trees (CommonTree, Pine, TwistedTree, DeadTree), bushes, ferns, clover, plants, grass, flowers, petals, mushrooms, rocks, pebbles, stepping stones (`RockPath_*`) | Quaternius Stylized Nature MegaKit (Standard, free) — CC0, quaternius.com |
| in the same file: `Lantern_Wall`, `Banner_1_Cloth` | Quaternius Fantasy Props MegaKit (Standard, free) — CC0 |
| in the same file: `Prop_WoodenFence_Single`, `Prop_WoodenFence_Extension1/2` | Quaternius Medieval Village MegaKit (Standard, free) — CC0 |
| `characters/Protagonist_A.glb`, `Protagonist_B.glb` (player characters) | KayKit Mystery Monthly Series 5, "10 – April 2025 – Protagonists" |
| `props/nature/*` (stumps, logs, tent, campfire, lily pads, statues, sea rock, crops, farm fence, canoe, pot) | Kenney Nature Kit (kenney.nl) — CC0 |
| `props/pirate/*` (palms, shipwreck, pirate ship, rowing boats, barrels, crate, chest, flag, sand rocks, grey rocks `rocks-a/b/c`, `bottle`, `tool-shovel`, `hole`, tower = lighthouse) + `Textures/colormap.png` | Kenney Pirate Kit — CC0 |
| `props/survival/*` (signpost, bedroll) | Kenney Survival Kit — CC0 |
| `props/playground/*` | Tiny Treats – Fun Playground 1.0 FREE (Isa Lousberg) — CC0 |
| `props/picnic/*` | Tiny Treats – Pleasant Picnic 1.0 FREE (Isa Lousberg) — CC0 |
| `props/park/*` (street lantern, bench, fountain) | Tiny Treats – Pretty Park 1.0 FREE (Isa Lousberg) — CC0 |
| `props/gems/*` (volcano crystals) | KayKit Resource Bits 1.0 (EXTRA) — CC0 |
| `characters/anim_player.glb` (animation only) | KayKit Mystery Monthly Series 5, `Animations/gltf/Rig_Medium` |

`qnature/` is built from the kits in `/home/janah/dev/_assets/quaternius/packs/`
by `tools/build-qnature.mjs` (see its header): the models are simplified (the
kit's trees have 3,000–10,000 triangles, ours 500–1,300), bark / wood / metal are
baked into vertex colours, the leaf shapes, plants, flowers, rocks and stones
share one 1024 × 1272 texture atlas, normal maps are not used. Rebuild:

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

Eggs, incubators, pens, the base, thief crabs, hats, the fallback
creatures, the beach pier, parasols, towels and beach ball are built from
primitives in code. Three.js 0.169 (MIT) is in
`vendor/three/`; fonts Fredoka One and Nunito (OFL) in `fonts/`.
