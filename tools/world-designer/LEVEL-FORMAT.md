# Krabsy level format — reconstruction guide

A level JSON exported by the **Krabsy Level Editor** describes a 3D scene as a
list of placed KayKit models. **It does NOT store world positions** — Y, exact
XZ, footprint anchoring and a few built-in offsets are *recomputed* from the
rules below. Follow them and you rebuild the editor's scene exactly, then you
can keep building on it.

This file is self-contained: everything needed to write a loader is here.

---

## 1. The JSON

```json
{
  "format": "krabsy-level",
  "version": 1,
  "catalog": "restaurant-bits",
  "grid": { "cols": 12, "rows": 12, "tile": 2 },
  "objects": [
    { "model": "floor_kitchen", "col": 2, "row": 2, "rot": 0 },
    { "model": "kitchencounter_straight_A", "col": 3, "row": 1, "rot": 0 },
    { "model": "wall", "col": 4, "row": 0, "rot": 1 },
    { "model": "oven", "col": 5, "row": 1, "rot": 0, "off": { "x": 0, "y": 0.2, "z": -0.1 } },
    { "model": "couch", "pack": "furniture-bits", "col": 6, "row": 2, "rot": 0 }
  ]
}
```

| field | meaning |
|---|---|
| `catalog` | the **default** asset pack id for objects without their own `pack` |
| `grid.cols` / `grid.rows` | grid size in tiles |
| `grid.tile` | world units per tile (always **2** — KayKit pieces are 2×2) |
| `objects[]` | placed pieces, **in stacking order** (earlier = lower in its cell) |
| `model` | the GLTF base filename in the asset pack (e.g. `kitchencounter_straight_A`) |
| `pack` | *optional* asset-pack id this object comes from — present only when it **differs** from the level's `catalog`. A level may **mix packs** (e.g. prototype walls + furniture). Absent ⇒ use `catalog`. |
| `col`, `row` | grid cell. For multi-cell pieces this is the **anchor** (min corner) |
| `rot` | quarter-turns 0–3 = 0° / 90° / 180° / 270° about +Y (the R-key rotation) |
| `rotX`, `rotZ` | *optional* extra tilt in **degrees** about X / Z (e.g. lay a knife flat); absent = 0 |
| `off` | *optional* manual nudge in **world units** (X/Y/Z); absent = 0,0,0 |

Tolerate unknown fields / future `version` values. A single-pack level (e.g.
every kitchen level) carries **no** `pack` fields — so single-pack loaders that
ignore `pack` keep working unchanged. A multi-pack loader must resolve each
object's models from `obj.pack || catalog` (each pack = its own gltf dir +
atlas; model names can collide across packs, so the pack id disambiguates).

---

## 2. Assets

- Models are **KayKit Restaurant Bits 1.0 EXTRA** (GLTF, one shared atlas
  `restaurantbits_extra.png`). `model` is the gltf base name. Load + measure
  them the way the game already does.
- **Custom tiles** `tile_white`, `tile_black`, `tile_brown_light`,
  `tile_brown_dark` are editor-generated 1×1 floor tiles (flat colour swatches
  on the same atlas) — they are **not** in the base pack. If a level uses any,
  either copy those four `tile_*.gltf` from the editor, or recreate them as
  2×2-unit, 0.5-thick slabs (top at y=0) in these colours:
  white `rgb(209,216,220)`, black `rgb(49,49,49)`,
  brown_light `rgb(167,101,76)`, brown_dark `rgb(152,87,66)`.

---

## 3. Coordinate system

- Floor is the **X–Z plane**, **Y is up**. `TILE = grid.tile` (2).
- The grid is **centred on the origin**. Cell centre:

```
cellCenter(col, row) = ( (col - (cols-1)/2) * TILE,  0,  (row - (rows-1)/2) * TILE )
```
(`col`/`row` may be fractional in this helper — used for footprint centres.)

---

## 4. Per-model rules (the part NOT in the JSON)

These three small tables are the editor's `MODEL_META`. Everything not listed is
a plain **1×1, non-ground, no built-in offset** piece.

**A. Footprint (multi-cell).** `col,row` is the anchor; the piece is centred on
the whole block.

| model | footprint (w×d cells) |
|---|---|
| `floor_kitchen` | 2×2 |
| `floor_kitchen_styleB` | 2×2 |

For a `w×d` piece: XZ centre = `cellCenter(col + (w-1)/2, row + (d-1)/2)`.

> **Footprint per pack.** `restaurant-bits` uses this hand-authored table (it must
> match the frozen kitchen loader, which treats only the big floors as 2×2 and
> everything else 1×1). **Other packs DERIVE the footprint from the model's
> measured size**: `w = max(1, round(sizeX / 2))`, `d = max(1, round(sizeZ / 2))`
> (2 world units per cell). So e.g. Prototype `Floor`/`Primitive_Cube`/slopes →
> 2×2, `Wall`/`Workbench` → 2×1. **A multi-pack runtime must derive footprints the
> same way** for non-`restaurant-bits` packs, or pieces will sit off their anchor.

**B. Ground (laid flush — TOP at the surface, slab recessed, contributes 0).**
Placed so the model's TOP sits at the stack surface: `yBase = surface - maxY`
(`maxY = minY + height`). Restaurant floors have their origin at the top
(maxY = 0 ⇒ `surface`); the prototype floors have their origin at the bottom
(maxY = height ⇒ pushed down so the top is flush) — both packs harmonised.

```
floor_kitchen, floor_kitchen_styleB, floor_kitchen_small, floor_kitchen_small_styleB,
tile_white, tile_black, tile_brown_light, tile_brown_dark,
Floor, Floor_Dirt, Floor_Prototype, Primitive_Floor
```

**C. Built-in placement offset (+ forced 1×1).** A local-space offset baked into
the wall/door kit so the wide (4-unit) mesh seats on ONE cell's edge. Value
`WALL_PLACE = { x: -1, y: 0, z: -0.5 }`, **rotated by the piece's `rot`** (so it
tracks the four orientations). Every piece here is **1×1** — do NOT derive its
footprint from the measured size. Restaurant + prototype walls are geometrically
identical and share this offset. Applied to:

```
door_A, door_B, wall, wall_doorway, wall_half,
wall_decorated, wall_decorated_styleB,
wall_window_open, wall_window_closed,
wall_window_closed_curtains_red, wall_window_closed_curtains_green,
wall_orderwindow, wall_orderwindow_decorated,
Wall, Wall_Half, Wall_Doorway, Wall_Window_Open, Wall_Window_Closed,
Wall_Decorated, Wall_Target, Door_A, Door_B, Door_A_Decorated
```
(Deliberately NOT pillars, NOT `wall_tiles_*`.)

---

## 5. Reconstruction algorithm

For each unique `model`, load the gltf and measure its local bounding box →
`height = maxY - minY` and `minY`.

**Step 1 — stack heights (process objects in array order):**

```
tops = {}                              // "col,row" -> running height, default 0
for each object o, in order:
  (w, d) = footprint(o.model)          // table A, default 1×1
  base = max over cells cc in [o.col .. o.col+w-1], rr in [o.row .. o.row+d-1] of (tops["cc,rr"] || 0)
  o.y  = base
  contribution = isGround(o.model) ? 0 : height(o.model)     // table B
  for each covered cell cc,rr:  tops["cc,rr"] = base + contribution
```

**Step 2 — world transform for each object:**

```
(w, d)   = footprint(o.model)
center   = cellCenter(o.col + (w-1)/2, o.row + (d-1)/2)
yBase    = isGround(o.model) ? o.y : o.y - minY(o.model)
place    = rotateY(placeOffset(o.model), o.rot * 90°)         // table C, ZERO if none
manual   = o.off || {x:0, y:0, z:0}                            // world space, NOT rotated

position = ( center.x + place.x + manual.x,
             yBase    + place.y + manual.y,
             center.z + place.z + manual.z )
rotation = Euler( (o.rotX||0)·π/180,  o.rot·(π/2),  (o.rotZ||0)·π/180,  order 'YXZ' )

instantiate model at position + rotation.
```

```
rotateY(v, θ) = { x: v.x*cos θ + v.z*sin θ,  y: v.y,  z: -v.x*sin θ + v.z*cos θ }
```

Notes:
- **Array order matters** — stacking depends on it.
- The built-in offset (C) **rotates** with the piece; the manual `off` is
  world-space and is **not** rotated.
- Because the editor and game load the *same* models, measured `height`/`minY`
  match, so stacking is identical.
- `rotX` / `rotZ` are cosmetic tilt (Euler order **`YXZ`** so the Y/R rotation
  stays a world-up turntable). They do **not** affect stacking or the wall
  place-offset (both use only the Y/`rot` rotation); use `off` to re-seat a
  tilted piece on its surface if needed.

---

## 6. Drop-in loader (Three.js sketch)

Adapt `getInstance(name)` / `measure(name)` to your model cache.

```js
const TILE = level.grid.tile;           // 2
const { cols, rows } = level.grid;
const ZERO = { x: 0, y: 0, z: 0 };

// (single-pack restaurant sketch; for MULTI-PACK levels resolve model/measure
//  per `o.pack || catalog` and force WALL-set pieces to 1×1 — see §4 + the
//  sim-tower brief. The sets below already list the prototype pieces.)
const FOOTPRINT = { floor_kitchen: [2,2], floor_kitchen_styleB: [2,2] };
const GROUND = new Set(['floor_kitchen','floor_kitchen_styleB',
  'floor_kitchen_small','floor_kitchen_small_styleB',
  'tile_white','tile_black','tile_brown_light','tile_brown_dark',
  'Floor','Floor_Dirt','Floor_Prototype','Primitive_Floor']);
const WALL_PLACE = { x: -1, y: 0, z: -0.5 };
const WALL = new Set(['door_A','door_B','wall','wall_doorway','wall_half',
  'wall_decorated','wall_decorated_styleB','wall_window_open','wall_window_closed',
  'wall_window_closed_curtains_red','wall_window_closed_curtains_green',
  'wall_orderwindow','wall_orderwindow_decorated',
  'Wall','Wall_Half','Wall_Doorway','Wall_Window_Open','Wall_Window_Closed',
  'Wall_Decorated','Wall_Target','Door_A','Door_B','Door_A_Decorated']);

const fp = m => WALL.has(m) ? [1,1] : (FOOTPRINT[m] || [1,1]);
const cellCenter = (c, r) => ({ x: (c-(cols-1)/2)*TILE, z: (r-(rows-1)/2)*TILE });
const rotY = (v, q) => { const t=q*Math.PI/2, c=Math.cos(t), s=Math.sin(t);
  return { x: v.x*c+v.z*s, y: v.y, z: -v.x*s+v.z*c }; };

// pass 1: stack heights
const tops = new Map();
for (const o of level.objects) {
  const [w,d] = fp(o.model); let base = 0;
  for (let c=o.col; c<o.col+w; c++) for (let r=o.row; r<o.row+d; r++)
    base = Math.max(base, tops.get(c+','+r) || 0);
  o._y = base;
  const top = base + (GROUND.has(o.model) ? 0 : measure(o.model).height);
  for (let c=o.col; c<o.col+w; c++) for (let r=o.row; r<o.row+d; r++) tops.set(c+','+r, top);
}

// pass 2: instantiate
for (const o of level.objects) {
  const [w,d] = fp(o.model);
  const ctr = cellCenter(o.col+(w-1)/2, o.row+(d-1)/2);
  const m2 = measure(o.model);
  const yB = GROUND.has(o.model) ? o._y - (m2.minY + m2.height) : o._y - m2.minY;   // ground: TOP at surface
  const pl = WALL.has(o.model) ? rotY(WALL_PLACE, o.rot) : ZERO;
  const off = o.off || ZERO;
  const node = getInstance(o.model);
  node.position.set(ctr.x + pl.x + off.x, yB + pl.y + off.y, ctr.z + pl.z + off.z);
  node.rotation.set((o.rotX||0)*Math.PI/180, o.rot*Math.PI/2, (o.rotZ||0)*Math.PI/180, 'YXZ');
  scene.add(node);
}
```

That reproduces the editor scene exactly. From there, add gameplay (tag stations,
spawn, hatch, etc.) however the game needs — the visual layout is faithful.
