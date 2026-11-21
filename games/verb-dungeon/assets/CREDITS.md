# Asset credits

All models are CC0 (public domain), copied from the shared library
`/home/janah/dev/_assets/`. Only the files in use are copied here.

| Folder | Pack | Author | Licence |
|---|---|---|---|
| `dungeon/` | KayKit Dungeon Pack 1.1 (free) | Kay Lousberg, kaylousberg.com | CC0 |
| `characters/Knight.glb`, `sword_1handed.*`, `shield_round.*`, `knight_texture.png` | KayKit Adventurers 2.0 | Kay Lousberg | CC0 |
| `characters/Skeleton_Minion.glb` | KayKit Skeletons 1.1 | Kay Lousberg | CC0 |
| `characters/anim_medium.glb` | KayKit Character Animations 1.1 | Kay Lousberg | CC0 |

`anim_medium.glb` is an animation-only file (bones + 8 clips) built with
`games/tower-defense/tools/strip-rigs.py` from `Rig_Medium_General`,
`Rig_Medium_MovementBasic` and `Rig_Medium_CombatMelee`:

```
python3 ../tower-defense/tools/strip-rigs.py assets/characters/anim_medium.glb \
  Idle_A,Walking_A,Running_A,Death_A,Spawn_Ground,Hit_A,Interact,Melee_1H_Attack_Chop \
  <pack>/Rig_Medium_General.glb <pack>/Rig_Medium_MovementBasic.glb <pack>/Rig_Medium_CombatMelee.glb
```

Three.js 0.169 (MIT) is vendored in `vendor/three/`. Fonts Fredoka One and
Nunito (OFL) are in `fonts/`.
