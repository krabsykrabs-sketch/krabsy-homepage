# Creature pipeline (Verb Hatchery)

Turns CC0 source models (Quaternius packs in `/home/janah/dev/_assets/`) into the
game's creature collection in `assets/creatures/`:

- `<id>.glb`: one model per creature. Root node `creature`, looks at +Z, stands on
  y = 0, longest side 1.0 (measured over the whole idle clip), at most ~3000
  triangles, metalness 0, clips named `idle`, `walk`, `jump`, `eat`, `fun`
  (only the ones the source has).
- `icons/<id>.webp`: 128 × 128, transparent, three-quarter view, idle pose.
  `icons/<id>_s.webp`: the same shape in dark blue ("not found yet").
- `creatures.json`: the manifest the game reads (names EN / DE / ES, zone,
  rarity, clips, suggested size, source, licence).

Nothing here is wired into the game yet (`src/` still uses `assets/animals/`).

## Run it

```
node tools/creatures/build.cjs            # all creatures (about 1.5 minutes)
node tools/creatures/build.cjs fox crab   # only these (the manifest keeps the others)
python3 tools/serve.py 8143 &             # dev server, if it is not running
node tools/creatures/check.cjs            # loads every GLB in three.js 0.169, screenshots → _shots/creatures-*.png
python3 tools/creatures/sheet.py          # owner's overview → _shots/roster.png
```

Needs: Blender 4.5 (default path: the Windows install, called from WSL; set
`BLENDER=/path/to/blender` for another one), Node, Playwright for `check.cjs`
(`PLAYWRIGHT=/path/to/node_modules/playwright`), Pillow for `sheet.py`.
`PORT=8163 node tools/creatures/check.cjs` for another dev-server port.

Look at one creature: `http://localhost:8143/tools/creatures/viewer.html?id=fox&clip=walk`
(`?zone=beach`, `?clip=jump`, `?t=0.4` freezes the clip, `?real` uses the suggested
sizes, `?raw` shows Blender's output before the shrink step). The red arrow is +Z.

## Files

| File | What it does |
|---|---|
| `roster.json` | **The list to edit**: packs (folder, licence, URL) and creatures (id, source file, names, zone, rarity, size). |
| `build.cjs` | Runs everything: Blender once for all creatures, then the shrink step, then writes `creatures.json`. |
| `build.py` | Blender script: import, pick + rename clips, fill unkeyed bones with the default pose, normalise, decimate, render the icon, export. |
| `optimize.cjs` | Shrinks a GLB without dependencies: normals / uvs / weights as small integers, fewer keyframes, no rest-pose tracks. Also usable alone: `node optimize.cjs in.glb out.glb`. |
| `viewer.html`, `check.cjs` | Three.js test page and the headless check. |
| `sheet.py` | Roster picture. |
| `inspect_sources.py` | Blender script that lists triangles, bones and clips of source files (for choosing new creatures). |
| `polypizza_get.py`, `unzip_safe.py` | How the packs were downloaded / unpacked (see `assets/creatures/CREDITS.md`). |
| `.tmp/` | Work files and `blender.log` (git-ignored). |

## Add a creature

1. Put the source model in the asset library and, if its pack is new, add the
   pack to `packs` in `roster.json` (`dir` relative to `assetsRoot`, `ext`,
   licence, URL). Only CC0. Add the pack to `assets/creatures/CREDITS.md` and
   `/home/janah/dev/_assets/README.md`.
2. Add a line to `creatures`: `id` (lower case, the file name), `pack`, `src`
   (file name without extension), `name` (`en` / `de` / `es`), `zone`,
   `rarity`, `scale` (suggested height in metres in a pen).
3. `node tools/creatures/build.cjs <id>`, then look at it in `viewer.html` and
   run `check.cjs` and `sheet.py`.

Optional fields per creature: `clips` (`{"fun": "Dance", "eat": null}`: source
clip per standard name, `null` = leave out; without it the names are guessed, see
`AUTO` in `build.py`), `walk` (`"jump"`: which clip to use as walk when the model
has none), `move` (`"swim"` / `"fly"`, default walk; sets `hover`), `hover`,
`monster` (true = invented name, `kind: "monster"`), `yaw` (degrees, if it looks
the wrong way), `max_tris` (default 3000), `tex` (largest texture side, default
256), `icon_az` / `icon_el` (icon camera), `texture` (for FBX with a separate image).
A pack can set `clips` and `texture` for all its creatures.

## For the game code (not built yet)

- Load `assets/creatures/creatures.json`; a creature's model is `file`, its
  Book picture `icon`, its "not found" picture `silhouette`.
- Size: `factor = scale / size[1]` (`size` = width, height, length of the
  normalised model). Swimmers and flyers: lift by `hover`.
- Clips: `clips.idle` and `clips.walk` always exist (walk may point to `jump`
  or `idle`); `jump`, `eat`, `fun` only where the source has them.
- **Always play a clip.** Without one, a model shows its bind pose (some stand
  on their nose). Clips leave out bones that stay in the rest pose, which is
  fine with `AnimationMixer`.
- Skinned models: clone with `SkeletonUtils.clone`, and set
  `frustumCulled = false` or compute the bounding box after posing.
- Golden versions are not separate files: tint the materials in code.
- Monsters from Ultimate Monsters use several plain-colour materials (3–8 draw
  calls per creature); merging them into vertex colours would save draw calls
  if many are on screen.
