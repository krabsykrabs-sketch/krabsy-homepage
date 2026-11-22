# Verb Dungeon — owner play-test notes

Owner, 2026-11-21: "collect comments before rebuild." Collect notes here
during play-testing; fix them together in one pass afterwards. The master
session adds each note as the owner reports it; the build agent does not
edit this file.

## Open

(none)

## Liked (keep)

- **Boss room** (golem, "?" stone, dizzy + bonk, 3 skulls): owner
  2026-11-21: "the boss level is great!"

## Done (2026-11-21)

1. **Word bridge: the concept does not work** → the hero hops instead of
   walking: from the base stone or the last right stone, ← ↑ → (A W D,
   1 2 3 or a click) hop to the left / middle / right stone of the next
   row, so no way across touches a wrong stone; a wrong stone crumbles
   and drops the hero to the start (no heart lost); ↓ on the base stone
   steps back.
2. **Question box in the centre, game paused** → a large card in the
   middle over the dimmed room; everything but the torches pauses while
   it is open. Used by the key (mandatory pair), chests (one question,
   "later" / Esc), the boss stone and the treasure-room door; rune doors
   and the bridge keep their words in the room and a small line at the
   bottom.
3. **Key carrier is boring** → no key is visible any more. It hides in
   one of the skeletons (found when bonked; "Nothing!" puff, sometimes a
   coin, otherwise) or in one of 2–3 twinkling crates / barrels searched
   with Space (`search` in the room data). Picked at random; the last one
   always has it.
4. **Answer when collecting the key** → walking over the key opens the
   card with its verb pair (2nd form, then 3rd with the 2nd shown);
   answered, the key is yours (HUD), the lock glows and the door opens by
   itself when you come near. Ambush rooms work the same way; treasure
   room and boss keep their exits.

## Done (2026-11-22)

5. **Word bridge with hopping is bad** → no special controls: two pits with three word stones each and a strip of floor between; walk across the right stone, a wrong one crumbles and drops you back where you came from (no heart lost).
6. **Can't tell decoration from things you can use** → every usable thing (coins, key, search props, closed chests, boss stone) gets one teal pulsing floor ring with rising sparkles until used; decoration never moves or glows, and no coins, trunks or coin-topped boxes are used as decoration any more.
7. **Different weapons per hero** → Knight sword + shield (teal swoosh), Barbarian a big double axe with a 2H slice (wider amber swoosh), Rogue two daggers with a dual-wield scissor cut (two coral crescents), Mage the staff upright with a glowing gem (purple arc and sparkles); same swing timing and hit rules for all, axe and daggers turn their flat side to the camera so they read from above.
8. **Mage: the staff doesn't swing** → during a swing the staff blends out of its upright hold into the hand's pose and follows the arm through the cut (gem first), then goes back upright; the purple arc runs through the gem.
9. **Crates and barrels should break** → a swing smashes a searchable crate / barrel: planks or staves and hoops fly out and bounce, dust, a crunch, and it is gone (no collision); the key pops out of the wreck, an empty one sometimes drops a coin; no "Empty" text.
10. **Rune doors: picking twice in the same wall** → two walls in a row (option a): a first wall across the room with three doors (2nd form); the right one opens and you walk through into an antechamber; the back wall's three doors ask the 3rd form (2nd shown below), its right door is the exit. The first wall fades while you are behind it.
11. **A different boss in every level** → Level 1 Golem (as before), Level 2 Necromancer (floats, keeps raising up to 3 small skeletons; a right answer breaks his spell, the minions crumble), Level 3 Skeleton Mage (keeps his distance, casts fans of slow purple orbs after a "!!" wind-up; swat or dodge them). Same pattern for all: Space on the "?" stone, answer, bonk the dizzy boss, 3 pips (💀 / 👑 / 🔮), own intro line, coins at the end.
12. **Questions only when the player chooses** → the key asks nothing (straight to the HUD); a verb book on a stand in a glowing rune circle next to the door: walk in, Space / sword button opens the card (2nd form, then 3rd); both right → clunk, the door unlocks. Skeletons wait at the circle's edge, arrows fizzle there. Chests and the boss stone also open only with Space (a "Space: …" prompt floats over them); the treasure room's door uses the book too.
13. **Barbarian's axe too large; swings look left-handed** (2026-11-22, owner: "The axe of the barbarian is too large, and for all characters, please make sure that the swing is in the right direction, or that the weapon is in the right hand, because right now the barbarian has the weapon in the right hand, but then the swing looks like it's coming from the left hand. It's from left to right, so it looks a bit counterintuitive.") → axe scaled 1.35 → 1.05; every swing is now a forehand: the swing clips play backwards, so the blade winds up on the weapon-hand side and sweeps right → left (the rogue's daggers each from their own side inwards, the mage's staff likewise); swooshes follow; hit still at 0.117 s with the blade ahead.
14. **Book and key in any order; the book shows when it's read** (2026-11-22, after release; owner: "I don't think we need to set the order of book and key. It should be fine to do the book first and then the key. And the book should have a clear state of read: if we have read the book, it should look different. Maybe the ring disappears, or the book is closed, or both.") → both: the book can be read any time (no "find the key first"); both forms right → the open book folds shut on its stand (left half over the right, cover up, 0.7 s) and the rune circle and its glow fade out (it stops keeping enemies out too). The door unlocks once the key is taken AND the book is read, in either order; the hints say what is still missing ("The book is read! Now find the key." / "Now read the verb book" / "Find the key and read the verb book"). A read book stays read (closed, no circle) through a dizzy restart.
15. **Hero portraits on a neutral background** (2026-11-22; owner: "The preview of the 4 characters should not be in a dungeon. The background should be neutral. That way it's way better to see and recognize the characters.") → the four menu portraits are re-rendered with only the hero (and its weapon) in the scene, a soft vertical navy gradient behind (`#2d5b91` → `#122a50`, matching the menu cards), a warm front key light and a cool rim light; same crop, 144 px WebP.
