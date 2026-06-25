# Krabsy — "Tower" Diorama Game (SimTower-style)

**For:** a Claude Code session scoped to **`games/sim-tower/` only**. You do
**not** need the rest of the repo. You have read access to the shared asset
library at `/home/jan/krabsy-homepage/assets/` (granted via
`.claude/settings.local.json`) — copy what you use into this folder.

**This brief is self-contained.** Everything you need — the goal, the runtime
spec, the two authored rooms, and the full level-format contract — is here.

---

## Status (read first)

This is **Part B: build the runtime.** The level **editor** ("Krabsy World
Designer") is already built and lives **outside this folder** (`tools/world-designer/`,
also hosted at `dev.brocco.run/level-editor/`). **You don't touch it and don't
need it.** Jan already authored two rooms with it (see below). Your job is the
diorama runtime that loads those rooms and brings them to life.

Two rooms are ready in **`games/sim-tower/levels/`**:
- **`simroom1.json`** — an apartment
- **`SimOffice.json`** — an office

Both are `krabsy-level` JSON and **mix three asset packs** (a prototype-greybox
floor, restaurant-bits walls, and furniture). Build your loader to the **format
contract in §5–§7 below** — follow it exactly and you rebuild Jan's rooms
faithfully, then stack them into a building.

---

## Goal

Build a small, watchable **SimTower-style diorama** — a stacked cross-section of
a building, fixed camera, little 3D characters moving through furnished rooms on
a routine. No economy, no elevators, no learning content yet. The single
question this prototype must answer: **does it look good and feel alive enough
that a kid would want to keep watching?**

---

## What v1 does

- Load the two authored rooms and **assemble a small building** by stacking /
  arranging room interiors into the cutaway grid (e.g. 3 floors, the apartment
  and office repeated/varied across them). Jan will author more rooms later.
- Drop in a few **characters running a hardcoded routine loop** so the scene
  feels alive.
- Fixed camera, soft shadowbox lighting. That's it — prove the *feel*.

---

## Visual concept

- **Cutaway shadowbox:** fixed camera looking into the building from the front,
  front walls removed, each room a shallow diorama.
- **Camera:** orthographic, **near straight-on** — only a few degrees of tilt.
  Expose the tilt as a single tunable constant at the top of the file
  (start ~**5°**). A big angle looks great on 3 floors and becomes an occlusion
  mess on 15; sell depth with lighting, not angle. (Ortho ~5° is the default;
  try a very-long-lens perspective only if it reads better.)
- **Room dimensions (put ALL of these in clearly-named constants — Jan tunes them):**
  - horizontal tile = **1 world unit**… **BUT** note the authored rooms use the
    editor's `grid.tile = 2` world units per cell (KayKit pieces are 2×2). Read
    `tile` from each level's `grid` and honour it; don't hardcode. If you want a
    1-unit gameplay tile, scale the loaded room, but the cleanest path is to keep
    the room's own 2-unit cells and set the **story pitch** to match.
  - **story pitch ≈ 3 units** (room height between floors — enough for a ~1.8u
    character + furniture + headroom). Floors stack at this vertical interval.
  - the authored rooms are small (≈3×6 cells). A room is roughly furniture along
    the back, a walkway kept clear at the front.
- **Layout per room:** back depth-row = furniture; front depth-row (closest to
  camera) = walkway, kept clear and readable.
- **Lighting:** shadowbox feel — darker back wall, soft shadows, furniture and
  characters overlapping through the depth so it reads as a real space.

---

## Characters

- **KayKit Adventurers** pack + the **Character Animations** set
  (`/assets/KayKit/KayKit_Adventurers_2.0_FREE/` and
  `/assets/KayKit/KayKit_Character_Animations_1.1/` — copy what you use into
  `games/sim-tower/assets/characters/`). The kitchen game uses the same rig
  (Idle / Running / a work clip retarget fine).
- **Kinematic movement along waypoints — NO physics.** Do **not** pull in Rapier.
  Characters lerp/steer between points; play walk / idle / sit animations.
- Simple per-character state machine: `idle → pick a target (sofa / desk / bed /
  wander) → walk there → perform (sit / stand) for a beat → repeat`. Stagger
  characters so they're not in lockstep. Derive a few waypoints per room from the
  furniture positions (e.g. a point in front of the couch/desk) — **in the
  runtime**, not authored in the editor.

---

## Tech constraints

- **Three.js, pure browser ES modules, no build step** (matches the other Krabsy
  3D games). Use a CDN import map for `three` like the existing 3D games start
  with; self-host into `vendor/` later only if a target network blocks the CDN.
- **No Rapier, no networking, no backend.** No economy, needs/meters, elevators,
  or fail state. **No learning content yet** — grammar hooks are a later pass.
- Structure: `index.html` + `src/*.js` (e.g. `main`, `loader`, `building`,
  `character`, `camera`). Deployable as a standalone game on the Krabsy homepage
  (a master session handles release/integration — not your concern).

---

## Assets — what to copy from `/assets/`

The two rooms reference exactly these (copy each pack's `*.gltf` + `*.bin` + its
atlas `*.png` into `games/sim-tower/assets/models/<pack-id>/`, one folder per
pack — each pack has its OWN atlas and model names can collide across packs):

| pack-id | source dir under `/assets/KayKit/` | models the rooms use | atlas |
|---|---|---|---|
| `prototype-bits` | `KayKit_Prototype_Bits_1.1_EXTRA/Assets/gltf/` | `Floor` | `prototypebits_texture.png` |
| `restaurant-bits` | `KayKit_Restaurant_Bits_1.0_EXTRA/Assets/gltf/` | `wall`, `wall_doorway` | `restaurantbits_extra.png` |
| `furniture-bits` | `KayKit_Furniture_Bits_1.0_SOURCE/Assets/gltf/` | `cabinet_medium`, `chair_desk_B`, `couch_pillows`, `desk_decorated`, `lamp_standing`, `rug_rectangle_stripes_A`, `table_low_decorated` | `furniturebits_texture.png` |

Copy the **whole** gltf folder of each pack if you prefer (Jan will author more
rooms that use more pieces) — the subset above is just what's used today. Skip
`*:Zone.Identifier` files. The copied `assets/models/` + `assets/characters/`
are gitignored (re-derivable); the deployed homepage copy is tracked at release.

> Each KayKit gltf references its atlas by a **relative** filename, so the atlas
> must sit **next to** the gltfs in the same `assets/models/<pack-id>/` folder.

---

## §5. Level format — the JSON

A room JSON does **NOT** store world positions — Y, exact XZ, footprint
anchoring and a couple of built-in offsets are **recomputed** from the rules
below. Follow them and you rebuild the editor's scene exactly.

```json
{
  "format": "krabsy-level",
  "version": 1,
  "catalog": "prototype-bits",
  "grid": { "cols": 3, "rows": 6, "tile": 2 },
  "objects": [
    { "model": "Floor", "col": 0, "row": 0, "rot": 0 },
    { "model": "wall", "pack": "restaurant-bits", "col": 0, "row": 0, "rot": 1 },
    { "model": "couch_pillows", "pack": "furniture-bits", "col": 1, "row": 4, "rot": 2,
      "off": { "x": 0, "y": 0, "z": 0.1 } }
  ]
}
```

| field | meaning |
|---|---|
| `catalog` | the **default** pack id for objects without their own `pack` |
| `grid.cols` / `grid.rows` | grid size in cells |
| `grid.tile` | world units per cell (these rooms: **2**) |
| `objects[]` | placed pieces, **in stacking order** (earlier = lower in its cell) |
| `model` | the gltf base filename |
| `pack` | *optional* pack id this object is from — present only when it **differs** from `catalog`. Resolve each model from **`obj.pack || catalog`** (load it from that pack's folder + atlas). |
| `col`, `row` | grid cell; for a multi-cell piece this is the **anchor** (min corner) |
| `rot` | quarter-turns 0–3 = 0/90/180/270° about +Y |
| `rotX`, `rotZ` | *optional* extra tilt in **degrees**; absent = 0 |
| `off` | *optional* manual nudge in **world units** (X/Y/Z); absent = 0,0,0 |

Tolerate unknown fields / future `version` values.

## §6. Per-model rules (NOT in the JSON)

**Footprint (multi-cell).** `col,row` is the anchor; the piece centres on the
whole block. Derivation depends on the pack:
- **`restaurant-bits`:** a fixed table — only `floor_kitchen` / `floor_kitchen_styleB`
  are 2×2; **everything else (incl. `wall`, `wall_doorway`) is 1×1**.
- **Any other pack** (prototype, furniture): **derive from the measured model
  size** — `w = max(1, round(sizeX / TILE))`, `d = max(1, round(sizeZ / TILE))`.
  So prototype `Floor` → 2×2; furniture pieces are mostly 1×1 (a `couch`/`desk`
  may be 2×1). **You must do this**, or multi-cell pieces sit off their anchor.

XZ centre of a `w×d` piece = `cellCenter(col + (w-1)/2, row + (d-1)/2)`.

**Ground (laid flush, contributes 0 height to the stack).** Only the
restaurant/editor floor pieces:
`floor_kitchen, floor_kitchen_styleB, floor_kitchen_small, floor_kitchen_small_styleB,
tile_white, tile_black, tile_brown_light, tile_brown_dark`.
**Note:** the prototype `Floor` these rooms use is **NOT** in this set — it's a
normal (non-ground) slab that contributes its height, exactly as authored. Don't
add it; just replicate the rule.

**Built-in placement offset (wall kit).** A local-space offset baked into the
restaurant wall/door kit so they align on the grid: `WALL_PLACE = {x:-1, y:0, z:-0.5}`,
**rotated by the piece's `rot`**. Applies to:
`door_A, door_B, wall, wall_doorway, wall_half, wall_decorated, wall_decorated_styleB,
wall_window_open, wall_window_closed, wall_window_closed_curtains_red,
wall_window_closed_curtains_green, wall_orderwindow, wall_orderwindow_decorated`.
(The rooms use `wall` + `wall_doorway`, so this offset matters — get it right.)

## §7. Reconstruction algorithm + drop-in loader (multi-pack)

For each unique `(pack, model)` load the gltf and measure its local bbox →
`height = maxY-minY`, `minY`, `sizeX`, `sizeZ`. Then:

```js
const TILE = level.grid.tile;                 // 2 for these rooms
const { cols, rows } = level.grid;
const DEFAULT = level.catalog;
const ZERO = { x: 0, y: 0, z: 0 };

// restaurant-bits keeps a fixed footprint/ground/wall table; other packs derive.
const RESTAURANT_FP = { floor_kitchen: [2,2], floor_kitchen_styleB: [2,2] };
const GROUND = new Set(['floor_kitchen','floor_kitchen_styleB',
  'floor_kitchen_small','floor_kitchen_small_styleB',
  'tile_white','tile_black','tile_brown_light','tile_brown_dark']);
const WALL_PLACE = { x: -1, y: 0, z: -0.5 };
const WALL = new Set(['door_A','door_B','wall','wall_doorway','wall_half',
  'wall_decorated','wall_decorated_styleB','wall_window_open','wall_window_closed',
  'wall_window_closed_curtains_red','wall_window_closed_curtains_green',
  'wall_orderwindow','wall_orderwindow_decorated']);

const packOf = o => o.pack || DEFAULT;
// getModel(pack, name) -> a fresh instance;  measure(pack, name) -> {height,minY,sizeX,sizeZ}
const footprint = (pack, name) => {
  if (pack === 'restaurant-bits') return RESTAURANT_FP[name] || [1,1];
  const m = measure(pack, name);
  return [Math.max(1, Math.round(m.sizeX/TILE)), Math.max(1, Math.round(m.sizeZ/TILE))];
};
const cellCenter = (c, r) => ({ x: (c-(cols-1)/2)*TILE, z: (r-(rows-1)/2)*TILE });
const rotY = (v, q) => { const t=q*Math.PI/2, c=Math.cos(t), s=Math.sin(t);
  return { x: v.x*c+v.z*s, y: v.y, z: -v.x*s+v.z*c }; };

// pass 1 — stack heights (array order matters!)
const tops = new Map();
for (const o of level.objects) {
  const pk = packOf(o), [w,d] = footprint(pk, o.model); let base = 0;
  for (let c=o.col; c<o.col+w; c++) for (let r=o.row; r<o.row+d; r++)
    base = Math.max(base, tops.get(c+','+r) || 0);
  o._y = base;
  const top = base + (GROUND.has(o.model) ? 0 : measure(pk, o.model).height);
  for (let c=o.col; c<o.col+w; c++) for (let r=o.row; r<o.row+d; r++) tops.set(c+','+r, top);
}

// pass 2 — instantiate
for (const o of level.objects) {
  const pk = packOf(o), [w,d] = footprint(pk, o.model);
  const ctr = cellCenter(o.col+(w-1)/2, o.row+(d-1)/2);
  const yB = GROUND.has(o.model) ? o._y : o._y - measure(pk, o.model).minY;
  const pl = WALL.has(o.model) ? rotY(WALL_PLACE, o.rot) : ZERO;
  const off = o.off || ZERO;
  const node = getModel(pk, o.model);
  node.position.set(ctr.x + pl.x + off.x, yB + pl.y + off.y, ctr.z + pl.z + off.z);
  node.rotation.set((o.rotX||0)*Math.PI/180, o.rot*Math.PI/2, (o.rotZ||0)*Math.PI/180, 'YXZ');
  roomGroup.add(node);
}
```

That reproduces a room exactly (the floor centred on its 2×2 block, walls on the
back edge, furniture stacked on the floor). To stack rooms into a building, give
each room group its **floor Y** = `floorIndex * STORY_PITCH` and lay rooms out
horizontally per your building layout. Notes:
- **Array order matters** for stacking. The wall offset **rotates** with `rot`;
  the manual `off` is world-space, NOT rotated. Euler order is **`YXZ`**.
- Loading the SAME gltf the editor used means measured `height`/`minY` match, so
  stacking is identical to what Jan saw.

---

## Verification (don't skip)

Match the other Krabsy 3D games' workflow: serve statically and check in a real
browser. The interactive preview's screenshot tool can hang on a suspended
renderer — the proven workaround is **headless Edge** screenshots against a
`?qa=`-style frozen scene (load a room, freeze a frame). Assert: both rooms load
with **zero console errors** and **no missing models**; the floor/walls/furniture
sit where the editor showed them; characters walk their routine; ~60 fps.

A local preview is wired: `.claude/launch.json` serves this folder on
**port 8042** (`python3 -m http.server`).

---

## Deliverables

1. The diorama runtime (`index.html` + `src/`), loading the two rooms via the
   §7 loader, stacked into a small building.
2. The asset subset copied into `assets/models/<pack>/` + `assets/characters/`.
3. A few characters on a hardcoded routine.
4. Verified (headless): rooms render faithfully, 0 errors, characters move.
5. Keep a short status log at the bottom of THIS file as you go (it's the memory
   between sessions).

## Non-goals (do NOT build)
Economy, rent, tenant needs/happiness meters, elevators or commute logic, in-game
build mode, multiplayer, save/load of player progress, any learning/quiz
mechanic, multi-floor or waypoint authoring **in the editor**, Rapier/physics.

## Resolved decisions (were open when this started)
- **Asset packs:** decided — the rooms combine `prototype-bits` (floor) +
  `restaurant-bits` (walls) + `furniture-bits`. Use those.
- **Format ownership:** the runtime reuses the `krabsy-level` format (§5–§7) with
  the multi-pack `pack` field; you write your own loader (above). The editor is
  done; don't extend the format unless truly necessary, and never to break a
  single-pack (kitchen) level.
- **Camera:** orthographic, ~5° tilt, tunable constant.
