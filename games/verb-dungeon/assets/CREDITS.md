# Asset credits

All models are CC0 (public domain), copied from the shared library
`/home/janah/dev/_assets/`. Only the files in use are copied here.

| Folder | Pack | Author | Licence |
|---|---|---|---|
| `dungeon/` | KayKit Dungeon Pack 1.1 (free) | Kay Lousberg, kaylousberg.com | CC0 |
| `characters/Knight.glb`, `sword_1handed.*`, `shield_round.*`, `knight_texture.png` | KayKit Adventurers 2.0 | Kay Lousberg | CC0 |
| `characters/Skeleton_Minion.glb` | KayKit Skeletons 1.1 | Kay Lousberg | CC0 |
| `characters/anim_medium.glb` | KayKit Character Animations 1.1 | Kay Lousberg | CC0 |
| `characters/Skeleton_Golem.glb`, `Skeleton_Rogue.glb`, `Skeleton_Crossbow.*`, `Skeleton_Arrow.*`, `skeleton_texture_A.png` | KayKit Skeletons 1.1 | Kay Lousberg | CC0 |
| `characters/anim_large.glb`, `anim_ranged.glb`, `anim_boss.glb` | KayKit Character Animations 1.1 | Kay Lousberg | CC0 |
| `characters/Necromancer.glb`, `Skeleton_Mage.glb`, `Skeleton_Staff.*` (level 2 and 3 bosses) | KayKit Skeletons 1.1 (EXTRA) | Kay Lousberg | CC0 |

`anim_medium.glb` is an animation-only file (bones + 10 clips) built with
`games/tower-defense/tools/strip-rigs.py` from `Rig_Medium_General`,
`Rig_Medium_MovementBasic` and `Rig_Medium_CombatMelee`:

```
python3 ../tower-defense/tools/strip-rigs.py assets/characters/anim_medium.glb \
  Idle_A,Walking_A,Running_A,Death_A,Spawn_Ground,Hit_A,Interact,Melee_1H_Attack_Slice_Horizontal,Melee_2H_Attack_Slice,Melee_Dualwield_Attack_Slice \
  <pack>/Rig_Medium_General.glb <pack>/Rig_Medium_MovementBasic.glb <pack>/Rig_Medium_CombatMelee.glb
```

`<pack>` = `/home/janah/dev/_assets/kaykit/KayKit_Character_Animations_1.1/Animations/gltf/Rig_Medium`.
Hero swings (`SWINGS` in `src/heroes.js`): knight and mage `Melee_1H_Attack_Slice_Horizontal`
(added 2026-11-21), barbarian `Melee_2H_Attack_Slice`, rogue `Melee_Dualwield_Attack_Slice`
(both added 2026-11-22, when `Melee_1H_Attack_Chop` was dropped).

Three.js 0.169 (MIT) is vendored in `vendor/three/`. Fonts Fredoka One and
Nunito (OFL) are in `fonts/`.

Added 2026-11-21 (boss, archer, heroes). `anim_large.glb` (golem, large rig, 6 clips)
and `anim_ranged.glb` (archer, medium rig, 2 clips) are animation-only files too:

```
python3 ../tower-defense/tools/strip-rigs.py assets/characters/anim_large.glb \
  Idle_A,Walking_A,Running_A,Death_A,Hit_A,Flexing \
  <large>/Rig_Large_General.glb <large>/Rig_Large_MovementBasic.glb <large>/Rig_Large_Simulation.glb
python3 ../tower-defense/tools/strip-rigs.py assets/characters/anim_ranged.glb \
  Ranged_2H_Aiming,Ranged_2H_Shoot <pack>/Rig_Medium_CombatRanged.glb
```

`<large>` = the same pack's `Rig_Large` folder. Hero models other than the knight
(about 350 KB each) and their gear are loaded only when the player picks them.

Added 2026-11-22 (a different boss per level, play-test note 11): the Necromancer
(level 2) and the Skeleton Mage (level 3), both on the medium rig, each holding
`Skeleton_Staff` (it uses the same `skeleton_texture_A.png`). They and
`anim_boss.glb` (medium rig, 4 clips: the casting moves and the skeletons' taunt)
load only when level 2 or 3 starts (`Assets.loadBoss`), not in the first load:

```
python3 ../tower-defense/tools/strip-rigs.py assets/characters/anim_boss.glb \
  Ranged_Magic_Summon,Ranged_Magic_Shoot,Ranged_Magic_Spellcasting,Skeletons_Taunt \
  <pack>/Rig_Medium_CombatRanged.glb <pack>/Rig_Medium_Special.glb
```

Sizes: `Necromancer.glb` 409 KB, `Skeleton_Mage.glb` 270 KB, `anim_boss.glb` 134 KB,
`Skeleton_Staff.*` 72 KB.
