# Verb Hatchery — world review and proposal (2026-11-23)

The owner approved all 15 items (2026-11-23); they are built step by step.
**Built: Step 1 = items 1–4, Step 2 = items 5–7 and Step 3 = items 8–12** (all
2026-11-23, see the Log in `CLAUDE.md` for what was done and the measured draw
calls). Step 2 also switched all trees, bushes, rocks, plants and flowers to the
Quaternius *Stylized Nature MegaKit* (owner's wish). Not built yet: items 13–15
(Step 4).

Pictures are in `_shots/` (not in git): `review-*.png` = the world today,
`beach-before-*.png` / `beach-after-*.png` = the Beach rebuild.

Effort: **S** = up to 1 hour, **M** = half a day, **L** = a day or more.

## What is wrong today (short)

1. **The ground is one flat green.** No grass, no texture, no colour change
   between zones (`review-meadow-empty.png`, `review-island-top.png`).
2. **Zones are round stamps.** The Forest is a disc of trees, the Volcano a
   smooth cone on a lawn (`review-forest.png`, `review-volcano.png`).
3. **Home is a box with a roof** on a brown rectangle (`review-home.png`).
4. **Sky and light are flat**: one sky colour, hard dark shadows.
5. **White egg beams dominate every view** (`review-island-top.png`).
6. **Too many draw calls.** Measured headless today: 200–250 in a Beach
   view, about 450 looking at Home; the scene has 885 separate meshes. (The
   log says "~50"; that number does not match what I measure.) This is the
   real risk for Chromebooks, and it limits everything we add.

## Proposal, in the order I would build it

### Step 1 — quick wins, no new assets — ✅ built 2026-11-23

| # | What | How | Effort | Cost |
|---|---|---|---|---|
| 1 ✅ | **Merge the static props** | `decor.js` `put()` adds every model as its own mesh. Merge all props that never move into one mesh per material (like the new pier and parasols). Same for pens and incubators. | M | **Saved** 60–210 draw calls per view (measured: Home 191 → 30, Meadow 287 → 79) |
| 2 ✅ | **Sky, light, colour** | Gradient sky dome (light at the horizon, deeper blue above), a visible sun, softer shadows, tone mapping, slightly warm light. | S | none |
| 3 ✅ | **Egg beams** | Thinner, in the egg's colour, fading out with height; only the event egg keeps a big beam. | S | none |
| 4 ✅ | **Pond like the sea** | Use the new shore shader (light shallows, foam line) on the pond, give it an irregular shape, fix the teal reeds. | S | none |

### Step 2 — the ground (biggest visual gain) — ✅ built 2026-11-23

| # | What | How | Effort | Cost |
|---|---|---|---|---|
| 5 ✅ | **Ground colour per zone** | Darker, mossy floor in the Forest; grey ash ring around the Volcano; dry yellow patches and flower-coloured patches in the Meadow. Vertex colours only. | S | none |
| 6 ✅ | **Grass and small plants** | Many small tufts, clover, ferns and pebbles as instanced meshes, drawn only near the player. Models: Quaternius *Stylized Nature MegaKit* (already in `/home/janah/dev/_assets/quaternius/`, CC0, not used yet). | M | +5 draw calls, up to +31k triangles near the player (measured; the new Quaternius trees add more: +12 % to +39 % triangles per view in total) |
| 7 ✅ | **Paths you can read** | Stepping stones (`RockPath_*` from the same kit), a few fence posts and lanterns, a gate where a path enters a zone. | S–M | +0–1 draw calls (measured) |

### Step 3 — give each zone a face — ✅ built 2026-11-23

| # | What | How | Effort | Cost |
|---|---|---|---|---|
| 8 ✅ | **Home: a real hatchery** | Built from the Quaternius *Medieval Village MegaKit* instead of KayKit (owner's wish): a long house with a coral tiled roof, a stone tower with a turning wind wheel (16 m, seen from far), a big sign board on posts, a fenced yard with lantern posts; the farm has real crops (Quaternius *Ultimate Crops*), a wagon and a market stall. | M | +1 draw call (the wind wheel), +16k triangles in the Home view (measured: 175k → 191k) |
| 9 ✅ | **Volcano** | Seven ridges and gullies in the height function, a deeper crater with a lava pool; four lava streams run down the gullies facing the island (one flowing mesh + glowing, scorched rock beside them), embers, big boulders on the ridges; stone heads darkened to the Volcano's rock. | M | +0 draw calls (lava pool + streams are one mesh, embers +1, smoke puffs 10 → 7) |
| 10 ✅ | **Forest** | Trees thin out at the edge instead of ending in a circle; undergrowth (ferns, big leafy plants); the camp is a clearing you reach by a trail of stones from the end of the path (tent, fire, log seats, supplies, a tall banner pole); green, close haze deep in the forest (fog + horizon colour follow the player). | M | +0 draw calls |
| 11 ✅ | **Meadow landmarks** | A hill with one huge tree (north-east); a stream from the pond to the sea with a walkable stone bridge (south-east); a wheat field with a scarecrow beyond the bridge; a ruin near the standing stones (south-west). All from Quaternius kits or built in code (no Kenney / KayKit: they clash). The stream and the bridge are on the minimap. | M | +0 draw calls (all in the static batch; the stream's water is part of the pond's mesh) |
| 12 ✅ | **Coast all round** | The coast is no longer a circle (`coast()` in `world.js`): coves with wide sand, headlands with grey rock and boulders in the water; the lighthouse stands on a rocky knoll on the Beach's north headland; three tiny islands off the coast (pines / a rock stack / palms; not reachable). | S–M | +0 draw calls |

### Step 4 — life

| # | What | How | Effort | Cost |
|---|---|---|---|---|
| 13 | **Wind** | Palms, trees and grass sway (a few lines in the vertex shader). | S | none |
| 14 | **Water life** | Splash rings when wading, fish jumping in the bay, a sailing boat crossing the horizon. | S–M | +2 draw calls |
| 15 | **Beach extras** | Beach hut or lookout tower, shells and starfish, buoys. | S | +2 draw calls |

## Asset packs

**Already in our library, not used in this game yet (free, CC0, nothing to download):**

- Quaternius *Stylized Nature MegaKit* (Standard): grass, clover, ferns, pebbles, stone paths, trees. For #6, #7, #10.
- KayKit *Medieval Hexagon Pack*: buildings, fences. For #8, #11. (I have not opened the pack to confirm it has a windmill.)
- Kenney *Nature Kit*: more rocks and plants; cliffs and bridges if it has them (not checked). For #11, #12.

**New packs (not downloaded; owner decides):**

| Pack | Author | Licence | Price | URL | What for |
|---|---|---|---|---|---|
| Watercraft Kit (45 files) | Kenney | CC0 | free | https://kenney.nl/assets/watercraft-kit | Sailing boats and buoys for #14, #15. Nice to have, not needed. |

I do **not** recommend buying anything. The paid tiers of the Quaternius kit
(more variants, engine files) would add nothing we need.

## My pick

Build **1 + 2 + 3** first (one session: the game gets faster and looks
cleaner), then **5 + 6** (the ground), then **8** (Home) and **9** (Volcano).
