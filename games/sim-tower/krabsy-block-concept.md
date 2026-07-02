# Krabsy Block — game concept (v1 slice)

**Decision (Jan, 2026-07-02):** the tower concept is retired — "block is better,
overwrite the tower." The last tower state is tagged **`tower-final`** in git for
recovery. This folder (`games/sim-tower/`) is rebuilt in place into the block
game (folder rename is a release-time concern, not ours).

---

## The pitch

You own a **city block**. Buy plots around the ring, build shops and homes as
**whole buildings** with full authored interiors, and watch the block come
alive: residents stroll the sidewalk between home, shops and the courtyard
park; cars circle the outer street; shop windows glow. Cozy watch-and-manage
tycoon — no fail state.

Why the block beat the "chunky tower" (square floorplates + floor switcher):

1. **Watchability is the genre.** The dollhouse's charm is seeing *everything
   alive at once*. A floor-switcher hides all but one floor behind UI; a ring
   hides the far side behind *rotation*, which is play, not UI.
2. **One viewing direction survives.** Every system we have — authored rooms
   (solid back wall, open front), reveal walls, camera, lighting — assumes
   front-on viewing. Ring buildings face outward: same assumption, kept.
   Floorplates would need all-sides-readable rooms = re-author everything.
3. **Shop size is solved by the format**, not fought by it: a shop is a
   building; buildings can be wide (multi-plot later).
4. **The block can eat the tower later** (buildings grow a 2nd floor as
   endgame), but a tower can't grow into streets and shopfronts.

## World layout (the ring)

```
        ┌──────── road (cars loop) ────────┐
        │  ┌────── sidewalk ring ───────┐  │
        │  │  [B][B][B]                 │  │      B = building plot,
        │  │ ┌──────────────┐ (corner   │  │          faces OUTWARD
        │  [B]│  courtyard  │[B] gaps    │  │      corners = open (sidewalk,
        │  [B]│    park 🌳   │[B] = park  │  │          streetlight, park access)
        │  [B]│             │[B] access) │  │
        │  │ └──────────────┘           │  │
        │  │  [B][B][B]                 │  │
        └──┴────────────────────────────┴──┘
```

- **4 sides × `SIDE_PLOTS` plots** (v1: 3) + 4 **open corners** (no corner
  buildings in v1 — they give sidewalk↔courtyard access and hold streetlights).
- A plot holds one authored room (the existing 5×6 levels work as-is: the
  interior hallway strip becomes the shop's entry zone; the front door faces
  the sidewalk). Buildings on each side are yawed so their open front faces
  outward — from any orbit angle you see that face's interiors; the far side
  shows authored **backs**, like a real block.
- **Courtyard park**: green ground, benches/bushes/trees (city pack), a few
  stroll points. Reached through the corner gaps.
- **Streets**: a road ring outside the sidewalk; cars (city pack, ×3 scale) do
  laps in two lanes, opposite directions, no collisions.

## Systems mapping (what carries over)

| system | tower | block |
|---|---|---|
| lots/buy/build | column lots, support rule | ring plots, adjacency = ring neighbours |
| circulation | stairs + elevator + hallway | **sidewalk ring** (way simpler; elevator system deleted) |
| commute | planTrip floors | ring-arc walk: door → sidewalk → shorter way round → door / park |
| camera | orbit, az clamped ±58° | same rig, **360° orbit** |
| reveal walls | front, occupancy-driven | same, on each building's outward face |
| wants/moods/rent | as-is | as-is (`quiet` = no office next door; amenity = within N plots) |
| 💬 quiz | as-is (engine-first questions.js) | as-is |
| save | simtower.game | new key (block layout), old saves ignored |
| street | 1 straight road | road ring + cornering cars |
| rooms/loader/nav/chars | as-is | **unchanged** |

## v1 scope guardrails

- Single story everywhere. No corner buildings. One block, fixed size.
- Room set: apartment, office(s), café, pizzeria, ice cream — as today.
- Park is fixed decoration + stroll destination (not buildable).
- Same economy numbers, milestones, quiz cadence as the tower slice.
- Deferred: multi-plot-wide buildings, 2nd floors (endgame), walk-mode
  (possess a resident), corner shops, day/night.

## Build phases (each verified + committed)

- **B1 — the world:** `src/block.js` (ring math: plot transforms, sidewalk
  polyline, door anchors) + `buildBlock()` replacing `buildTower()` + road
  ring/cars + courtyard + 360° camera + yaw-aware build ghosts. Static block
  renders with interiors, reveal walls, cars looping.
- **B2 — the sim:** ring-walk `planTrip` (elevator manager deleted), buy
  adjacency, want tweaks, park visits, save on the new key. Residents stroll
  and visit shops; quiz works; selftest 0 violations.
- **B3 — polish + verify:** screenshots, status log, tune counts/speeds.
