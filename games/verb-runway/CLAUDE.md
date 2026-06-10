# Verb Runway — proof-of-concept brief

You are building a new game for **Krabsy** (krabsy.com), a browser-based
English-grammar learning site for German- and Spanish-speaking school kids
(roughly ages 10–14). The site has a catalogue of arcade games that drill
irregular verbs (Verb Slash, Verb Snake, Verb Flow, Air Control, a 3D
platformer). This folder is yours; the brief below is everything you need.
You do not have — and do not need — access to the rest of the repo except
the read-only reference listed under **Data**.

## The game in one paragraph

**Verb Runway** is a 2D paper-doll dress-up game (Dress to Impress made
single-player and learning-powered). Each day brings a **styling theme**
("Beach party!", "Rainy-day cozy", "Spooky elegance"). You dress a cute
avatar from your closet, send the look down a runway, and a panel of
three judges scores it against the theme. New clothes are **earned with
grammar**: correct answers buy Fashion Deliveries that unlock garments.
Better wardrobe → better scores → more themes mastered. The audience
skews toward players the current catalogue underserves; charm and style
are the product.

## ⚠️ What this PoC is REALLY testing

**The art.** The entire wardrobe is hand-drawn vector art (inline SVG,
drawn in code — zero external assets). The user's open question is
whether AI-authored vector fashion can look *good*, not just functional.
Therefore:

- Build only **3–4 garments per category** — but make every single one
  excellent. No filler. Quality bar: *"every item looks like it came
  from one illustrator's sticker set."* Spend your time polishing
  shapes, not adding items.
- Provide a **`?qa=closet` contact-sheet scene** that renders every
  garment on the doll in a grid — the user will judge the art from this
  one screenshot. This scene is a first-class deliverable.
- If an item looks weak, delete it or redraw it. 12 great items beat
  20 mediocre ones.

## Art direction (follow strictly — consistency IS quality)

- **One avatar base**: front-facing, stylized proportions (big head,
  roughly 1:3.5 head-to-body), simple friendly face, **selectable skin
  tones** (4 swatches) and a neutral base outfit (plain tank + shorts)
  so the doll is never "undressed".
- **Sticker style**: uniform thick outlines (~3px, one dark ink color,
  rounded joins), flat color fills, exactly ONE shade tone per shape
  for depth (no gradients except subtle fabric sheen where it earns
  its place), small white highlight accents.
- **Harmonious palette**: define ~12 garment colors that all work
  together (Krabsy teal/coral/amber family + denim blue, blush pink,
  cream, mint, lavender, charcoal…). Each garment ships in **3
  colorways** chosen from this palette — this triples the visible
  wardrobe for free and guarantees outfits never clash hideously.
- **Anchor template**: all garments are drawn against one documented
  coordinate system (shoulder line, bust, waist, hip, knee, ankle
  y-coordinates on the doll's viewBox). Layer order (back to front):
  body/skin → shoes → bottoms → tops/dresses → jacket (if any) →
  face → hair → hat/accessory. Get this right first with placeholder
  rectangles, then draw real clothes.
- Categories for the PoC (3–4 items each):
  - **Hair** (e.g. long waves, high bun, curly bob, short crop)
  - **Tops** (e.g. striped tee, ruffle blouse, hoodie, knit sweater)
  - **Bottoms** (e.g. jeans, pleated skirt, cargo shorts)
  - **Dresses** (occupy top+bottom slots; e.g. sundress, party dress,
    raincoat-dress)
  - **Shoes** (e.g. sneakers, boots, sandals, mary janes)
  - **Accessories** (one slot; e.g. round glasses, sun hat, crossbody
    bag, star necklace)
- Clothing is **not gendered** — any item fits the one avatar; dresses
  and hoodies coexist in every closet.

## The full game design (build exactly this)

### Modes
- **Daily Challenge**: one theme per calendar day (deterministic from
  the date). One scored attempt per day counts for the streak; free
  retries allowed but marked "practice".
- **Free Style**: random theme from the pool, unlimited play. Same
  scoring, smaller coin payout.

### The loop
1. **Theme reveal** — a card announces the theme with 2–3 hint words
   ("Beach party! ☀️ think: sunny, light, sandals").
2. **Styling screen** — the doll center-stage; category tabs along the
   side; tap a garment to wear it, tap a colorway swatch to recolor;
   locked items show as silhouettes with a 🔒 (tap → "earn it in
   Deliveries!").
3. **Runway reveal** — the juice moment: curtain parts, spotlight
   sweep, the avatar struts (simple bob/lean/turn animation), camera
   flashes pop. Make this feel like an event every time.
4. **Judging** — three judges score the look (see below), each with a
   one-line comment, then a total out of 10 with stars and coins.
5. **Deliveries (the learning engine)** — coins buy delivery boxes
   (~5 coins each). Opening a box asks **3 grammar questions**; each
   correct answer reveals/keeps one of the box's up-to-3 items
   (duplicates become coins). Wrong answer → that item stays locked,
   and the full verb chain is shown as the teaching beat
   (`go → went → gone`). So: grammar IS the shopping.

### Judging (transparent enough to learn, warm enough to enjoy)
- Every garment carries 2–3 **style tags** (elegant, sporty, cozy,
  beachy, rainy, spooky, party, school, bold, cute…) and its colorway.
- A theme wants 2–3 tags (+ a bonus color family). Score =
  tag matches (the bulk) + color-harmony bonus (matching/complementary
  colorways) + a small per-judge personality lean (one judge loves
  bold, one loves cute, one loves classic) + a pinch of randomness so
  identical outfits don't always tie.
- Judges are characters: **Coco** 🦀 (a glamorous crab, loves elegant),
  **Pixel** 🐱 (a cool cat, loves sporty/bold), **Maus** 🐭 (a soft
  romantic, loves cute/cozy). Comments come from template pools and
  reference actual worn items ("Those boots with that raincoat? Rainy
  day PERFECTION, darling.").
- Show *why* points were earned (small tag-match chips under the score)
  so styling skill is learnable — but keep it playful, never a rubric
  wall.

### Grammar content
- House standard multiple choice: irregular verbs, mixed *simple past*
  / *past participle* slots, three chips, plausible distractors
  (regularized forms like "goed", swapped past↔pp, similar verbs).
- Form-color convention site-wide: **base = amber, past = teal,
  participle = coral** — use it on the chips and teaching toasts.
- Track missed verbs; a delivery box occasionally leads with a review
  question from past misses.

### Economy & persistence (localStorage)
- `krabsy_vrunway_save` (versioned JSON): owned garments + colorways,
  coins, daily streak, best scores per theme, missed-verb list.
- Starter closet: 1 free item per category so the first runway works
  immediately; everything else arrives via deliveries.
- PoC needs ~6–8 themes in the pool (each defined as: name, emoji,
  wanted tags, bonus color, hint words).

## Tone

Warm, glamorous, a little silly. The judges adore effort and never
mock; low scores get encouraging redirects ("Bold choice! Now let's
find something rainier, sweetheart."). Zero body talk — judges comment
on CLOTHES only, never the avatar's body. No fail states. Sparkle
generously.

## Tech conventions (match the rest of Krabsy)

- **Single self-contained HTML file**: `krabsy-verb-runway.html` in
  this folder. This game is UI-heavy, not physics-heavy: build the doll
  and garments as **inline SVG** and the interface as DOM + CSS
  (transitions/keyframes for the runway). No canvas needed, no
  frameworks, no build step, zero external assets.
- **Look & feel:** Krabsy house style — teal `#2ee6c0`, coral
  `#ff8585`, amber `#ffcf5e` on deep navy `#0d2240`; Fredoka One +
  Nunito via Google Fonts; rounded chips/buttons; start screen with
  emoji mascot + how-to rows + big primary button (other Krabsy games
  follow this pattern exactly — keep the family resemblance).
- **Audio:** WebAudio synth only: camera flashes, runway music sting
  (short loop), judge ding, sparkle arpeggio, coin chime, soft "swish"
  on garment changes. Mute toggle persisted (`krabsy_vrunway_sound`).
- **Responsive**: styling screen must work on a phone in portrait
  (tabs become a bottom sheet) — this audience plays on phones.

## Verification (do this, don't skip it)

- Serve statically (`python3 -m http.server`) and verify in a real
  browser. **Known issue:** the interactive preview's screenshot tool
  can hang (suspended renderer). Proven workaround: **headless Edge** —
  `msedge --headless=new --disable-gpu --window-size=420,860
  --screenshot=out.png "http://localhost:PORT/krabsy-verb-runway.html?qa=closet"`.
- Support `?qa=` scenes: `closet` (the all-items contact sheet — the
  art deliverable), `styling` (mid-game), `runway` (reveal moment),
  `judges` (score screen). Deterministic, no interaction needed.
- Expose a QA hook (`window.__VR`) to grant coins, unlock items, set
  the theme, and read state — then drive the full loop
  programmatically: theme → dress → runway → score → coins → delivery
  → question → unlock. Assert each step.
- Test save/load round-trip and the daily-theme determinism (same date
  → same theme).
- Zero console errors.

## Definition of done

- The `?qa=closet` contact sheet exists and every item on it would pass
  the "one illustrator's sticker set" bar — this is what the user will
  judge first.
- A stranger can play one full loop unaided: see the theme, dress the
  doll, strut the runway, read the judges, open a delivery, answer
  grammar, unlock a garment, and immediately want tomorrow's theme.
- Judging feels fair and learnable (tag chips visible), comments
  reference worn items, no body talk anywhere.
- Save/load, daily streak, and the QA scenes verified.
- This file's **Status log** is updated; work is committed (commits
  stay inside this folder).

## Data

Canonical verb data lives at `../../content/irregular-verbs.json`
(155 verbs) — **read-only reference**. Inline a curated subset (~40
common verbs) with shape `{v:'go', past:'went', pp:'gone'}`.

## Working agreements

- You own only `games/verb-runway/`. Don't modify anything outside it.
- Commit locally as you go; never push.
- Keep this CLAUDE.md current — it is the only memory between sessions.

## Status log

- 2026-06-10 — Brief written by the master session. Nothing built yet.
