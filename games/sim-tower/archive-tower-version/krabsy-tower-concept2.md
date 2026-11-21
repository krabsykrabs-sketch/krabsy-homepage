# Krabsy Tower — Game Concept (vertical slice) + next CC steps

A tight, cozy tenant-builder built on the existing prototype. Framed as a **proof slice** — smallest version that shows the core loop is fun. Learning content is deferred (see the slot near the end); this is about whether the *game* holds up.

---

## The camera change (what you asked for)

Move from the flat cutaway to a real **3D dollhouse**:

- **Constrained orbit camera** — rotate around the tower, zoom in/out, pan up and down floors. Not a free fly-cam.
- **The one tradeoff:** a tall tower + a movable camera means walls and floors occlude the rooms behind them.
- **The fix (proven cozy-builder pattern):** dynamic culling — walls/floors between the camera and the room in focus fade or hide, so interiors stay readable from any angle. Optionally a "focus this floor" mode.
- **Net:** the camera becomes the *delight + inspection* tool. Orbit to admire your tower (the brag-worthy thing — "look at mine"), zoom in to watch a resident's routine, click a resident to read what they want.

Real depth now matters: rooms use their 2-tile depth — furniture against the back wall, residents moving through the front walkway in actual 3D.

---

## The game (core loop)

**Fantasy:** You're the landlord of a quirky little tower. Build rooms, attract residents, keep them happy, watch the place grow and come alive.

**30-second loop:**
1. **Build a room** (costs coins). Type matters — Apartment (homes), Office (work), and later an amenity or two.
2. **A resident moves in** — one of the KayKit characters (knight, witch, etc.). Each has **one simple, visible want** ("wants a sofa," "wants a quiet floor," "wants a café nearby").
3. **Meet the want → happy resident** → pays more rent (faster coins) + feeds tower XP. **Ignore it → they grumble**, earn less, eventually move out (gentle, no harsh fail).
4. **More coins + levels → unlock new room types and floors → new residents, new wants → repeat.**

**What makes it a game (the decision layer):** limited space and coins force real choices. A café makes nearby apartment-dwellers happy but earns nothing directly; another office earns coins but adds no happiness. Where do you put the noisy room? Matching wants to rooms — and placing them well — is the puzzle. Cozy optimization, not twitch.

**Progress:** reuse the coins + level bar already in the UI; add a few soft milestones for direction (below). Keep the **Free build (sandbox)** toggle for endless play.

**The hook:** the characters carry it. Personalities + little routines are why a 12-year-old keeps watching and building "one more room."

---

## Scope guardrails (keep it small)

- **2 room types** to start (Apartment, Office) + **1 amenity** (Café) — the café is what creates the first interesting tradeoff.
- **2–3 resident types**, **one want each**, drawn from a tiny fixed set of wants.
- **One happiness state per resident** (happy / meh / leaving) — not a multi-stat sim.
- **No bankruptcy, no fail state** for the slice. Residents leaving is the only "negative," and it's soft.
- **Reuse** the existing coins + tower-level systems; don't rebuild the economy.

---

## Where learning bolts in later (deferred — don't build now)

Keep three things as clean, discrete events so a quick grammar question can slot into any of them later: **satisfying a want**, **collecting rent**, and **unlocking a room/floor**. Answer correctly → the action happens. That's the only architectural ask for now — leave those as events; build no question UI yet.

---

## Next steps for Claude Code (pick + sequence)

Each is a small, self-contained task — a viable first CC prompt. All should follow investigate-first (read + report before editing shared code), one change per commit.

**Option 1 — 3D dollhouse camera.** Convert the scene to real 3D with an orbit / zoom / pan-floors camera and dynamic wall-and-floor culling so interiors stay visible. The foundational change; everything else is viewed through it.

**Option 2 — Resident wants + happiness.** On top of the existing economy: give each resident one want, show it on click, and make the met/unmet state drive rent and a happy/meh/leaving status.

**Option 3 — First real decision (Café amenity).** Add the Café as a buildable room with a simple "nearby" happiness effect on adjacent apartments — creating the build-vs-earn tradeoff that turns this into a game.

**Option 4 — Direction (milestones).** Add 3–4 soft goals tied to the existing level bar ("House your first 5 residents," "Build a café," "Reach a happy 3-floor streak").

**Recommended order:** 1 → 2 → 3 → 4. But each is small and reorderable — if you'd rather prove the *loop* before reworking the camera, 2 can be built on the current view first, then re-skinned in 3D.
