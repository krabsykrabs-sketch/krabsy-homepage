# Krabsy drill review, 2026-11-28

Read-only play-test of all drills (Fable 5.2 subagent, master session). Every
drill was played by script at phone (390×844, touch) and desktop (1366×768).
Times are estimates: 3–5 s per choice answer, 6–10 s per typed answer, 5–7 s
for a choice with a sentence, plus the drill's own pauses. Sound was checked
in code, not by ear. ES and /en/spanish/ checked briefly (same code, same
findings).

## Short answer

Yes, it is time. The drills work and record answers, but they are three
generations of code side by side, and none shows the shells a child just
earned.

- **Sprint, Free Practice, Flashcards**: on the site design, no game feel (no
  sound, no streak, no reward moment).
- **Type Race, Drag Match, Falling Forms, Fill the Gap**: game feel (sound,
  streak, points, best score) but their own sand-coloured look; three of them
  only know 30 built-in verbs.
- **Verb-Diplom and Jetzt üben** are the modern ones: the model for a rebuild.

## Table

| Drill | Length (questions / time) | Fun | Look | Verdict | Reason |
|---|---|---|---|---|---|
| Sprint (16 page copies: verbs, prepositions, tenses, Spanish) | 20 / 1.5 min verbs, 2–2.5 min sentence topics | 2 | 3.5 | Rebuild on a shared drill shell | Right mechanics, but silent and flat; same code pasted into 16 pages |
| Type Race | No end, 3 lives; weak child 30–60 s, strong 5–8 min+ | 2.5 | 3 | Retire; keep URL, serve shared drill in typed mode | No clock despite the name, 30 built-in verbs, same task as Free Practice and Diplom |
| Drag Match | 16 matches / 1–1.5 min | 4 | 3 | Keep and polish | Best round length, clear goal, best time |
| Falling Forms | No end, 3 lives, speeds up; 1.5–4 min | 4 | 3 | Keep and polish | Only drill with real tension and a natural end |
| Fill the Gap (all topics) | No end, 3 lives; typical 1–2 min, strong child endless | 2.5 | 3 | Rebuild on the shell (typed sentences) | Plays any topic, but the round ends by luck of the draw |
| Free Practice (verbs, prepositions) | Endless, 12–18 s per verb | 1 | 3 | Merge into the shell (untimed typed mode) | No round, no end; verb version never shows the right answer |
| Flashcards (verbs, prepositions) | 172 cards (12–17 min) / 297 cards (20–30 min) | 1.5 | 3 | Keep as a learning tool, rounds of 10, no shells | Nobody finishes the deck; self-rating pays shells |
| Verb-Diplom | Bronze 30 typed / 3–5 min, Silver 60 / 6–10, Gold 90 / 9–15 | 4 | 4.5 | Keep; the model | Clean, teaches on mistakes, real goal (certificate) |
| Statistik | not a drill | – | 3.5 | Merge into Profile | Duplicates Profile; fire emoji |
| Jetzt üben (reference) | 8 choice + 5 typed / 2–3 min, then a game | 3.5 | 4.5 | Reference | Best per-answer feedback on the site |

## Is 20 too long for Sprint?

By the clock no (about 1.5 min for verbs), for what it offers yes. Suggestion:
**12**. It feels long because nothing happens on the way (20 identical
screens, no sound, no streak, no milestone). A best-time chase needs a cheap
"one more go": 12 is under a minute for verbs, 1–1.5 min for sentences. The +3 s
penalty means an early mistake spoils a 20-question run. 12 keeps chain pairs
whole (6 verbs × 2 forms) and stays longer than Jetzt üben's 8.
"20" also appears in texts: `drills.sprint` tagline/intro in
`data/ui_de.json`, `ui_es.json`, `ui_en.json`, the green intro card, and the
article ("Nach 20 Verben").

## Findings per drill

### Sprint
- 20 questions; pause 0.2 s right / 0.5 s wrong; wrong costs +3 s.
- Short colour flash, "+3s" badge, no sound, no streak; progress only as text
  "Frage 5 von 20".
- End screen: time, accuracy, best time, missed items, "Nochmal spielen". No
  shells shown (a test run earned 34). The green intro card returns on top, so
  "Nochmal spielen" is below the fold on phone and 768 px desktop.
- First run says "Bestzeit" (always true, meaningless).
- Phone: `go → ___ → ___` wraps (second blank on its own line). Hover style
  has no `(hover: hover)` guard, so a tapped button can look pre-selected on
  the next question.
- Follows the presentation rule, chain order, smart mix; no visible level.
- Wrong texts: DE "bevor die Zeit abläuft", ES "antes que se acabe el tiempo"
  (there is no time limit); ES prepositions Sprint says "Veinte verbos".
- Same inline script in 16 pages (DE 6, ES 6, EN 4).

### Type Race
- No clock; ends after 3 wrong verbs. Sound, streak multiplier, points,
  hearts, best score. "Level" changes nothing; the level-up screen only
  interrupts.
- 30 verbs built in; own answer check (no alternates, no BE/AE mapping).
- Phone: large empty area under the fields. Desktop: no OK button, only Enter.

### Drag Match
- 8 verbs, two stages, 16 matches; wrong match +2 s. Sound, streak, best time,
  clear end screen.
- Phone: tap mode only works word → base verb; tapping the dashed empty slot
  (the obvious target) does nothing.
- 30 built-in verbs.

### Falling Forms
- 8 s per block at level 1, −0.8 s per level (every 5 verbs), down to 2.5 s.
  Best feel of the set: sound, streak, points, lives, full chain after a miss.
- Chain order right. 30 built-in verbs with invented wrong forms.
- Desktop: buttons travel down with the block (mouse chases moving targets);
  keys 1/2/3 work.

### Fill the Gap
- No end, 3 lives, no difficulty ramp: verbs drawn from all 172 (forsake,
  overcome, cling, leant, bet early on); a typical child loses three lives in
  5–10 sentences for vocabulary reasons.
- One best score shared by every topic.
- Plays any topic with its own loaders and own check (alternates yes, BE/AE
  no). "Level" cosmetic. /en/spanish/ version has accent keys (good).

### Free Practice
- Endless; no round, end screen or reward. Status line with attempts,
  accuracy, streak.
- Verbs: a wrong answer shows only "Falsch" for 0.8 s; the right form is never
  shown (prepositions version shows "→ at").
- Fields labelled "Simple Past" / "Past Participle" = grammar term as the
  question.
- Phone: two intro paragraphs saying the same thing, then filter and status;
  input below the fold. Teacher list (`?verbs=`) end panel has a crab emoji.

### Flashcards
- Whole deck: 172 verb cards, 297 preposition cards ("Karte 1 von 172").
- "Schon gewusst" records two right answers without a check: 8 taps gave 28
  shells, so a gift (150 shells) costs about two minutes of tapping.
- Flip animation only; on phone the card starts below two intro texts.

### Verb-Diplom
- Progress bar, mistake counter, positional question, typed answer through
  `checkTyped`; wrong answer shows the right form and full chain, waits for
  "Weiter". Pass screen with printable certificate, or fail list with links.
- Missing: sound, shells earned (56 in a Bronze run), and its own tab (the tab
  bar lists only Karteikarten, Verb-Tabelle, Freies Üben).

### All drills
- Every drill records answers and pays shells; no end screen mentions shells
  or gifts.
- Every drill page has a green intro card (27–49 words) plus a 280–420 word
  article; the intro returns on the end screen.
- Non-Krabsy icons: fire emoji (Statistik), crab emoji (Free Practice "all
  done", DE/ES/EN), party emoji (Jetzt üben "Geschafft!"), ♥ ♪ ✕ in the four
  game files, ✓ in Diplom and Drag Match.

## Overlap

- Sprint = Jetzt üben step 1 (20 instead of 8, plus a clock).
- Type Race = Free Practice = Verb-Diplom (type 2nd and 3rd form; Diplom best).
- Fill the Gap = Jetzt üben step 2 (plus lives and points).
- Drag Match and Falling Forms overlap with Verb Flow and Verb Snake; closer to
  small games than drills.
- Statistik = Profile.
- For verbs a child sees 5 drill tabs, 3 tools, Diplom, Jetzt üben and 8 games:
  too many doors to the same thing.

## Most important changes

1. **One shared drill shell** (3–4 days): one script + stylesheet on
   `getQuizSet` / `checkTyped`, modelled on the Jetzt üben card and Diplom.
   Modes: choice or typed, with or without clock. Replaces the 16 Sprint
   copies, 4 Free Practice copies, Type Race, later Fill the Gap. URLs stay.
2. **One end screen everywhere** (in 1; +½ day for the iframe games that
   stay): big "+N Muscheln" with the shell icon, right/total, new best, missed
   items with "practise these again", "Nochmal", link to a game.
3. **Per-answer feel** (1 day): sound (tones exist in the game files), streak,
   progress bar, shell pop; wrong shows the right answer and teach line; drop
   or cut the +3 s penalty to +1 s.
4. **Less text on drill pages** (½ day in generators): remove the green intro
   card, shorter H1, never show the intro on the end screen; article stays,
   below the drill.
5. **Tidy the offer** (1 day): retire Type Race and Free Practice as separate
   things; Flashcards in rounds of 10, no shells; Fill the Gap fixed round of
   10 starting easy; Statistik into Profile; consider moving Drag Match and
   Falling Forms next to the games.

## Quick wins

- Sprint 20 → 12 (constant on 16 pages + texts).
- Sprint end screen: show shells earned, hide the intro card, "Neue
  Bestzeit!" only when an older time was beaten.
- Sprint on phone: compact one-line row from Jetzt üben; hover style under
  `@media (hover: hover)`.
- Fix the three wrong texts (see Sprint).
- Free Practice (verbs): show the right form after a wrong answer.
- Flashcards: no shells for self-rating; 10 cards per round.
- Drag Match: accept a tap on the empty slot.
- Fill the Gap: best score per topic; start with tier-1 verbs.
- Verb-Diplom tab in the tab bar.
- Replace emojis and ♥ ♪ ✕ with Krabsy icons.

Scripts and screenshots (temporary): session scratchpad `drills/`.
