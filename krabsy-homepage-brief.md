# Krabsy Homepage — Claude Code Build Brief

## What We're Building

A homepage for **krabsy.com** — an educational gaming platform where European and Latin American children (ages 10–14) learn English grammar through browser games. This is a **beta version** for testing with real school classes.

The homepage IS the game arcade. Kids land on the site and immediately see games they can play. No registration, no marketing fluff, no "learning platform" vibes.

---

## Design Direction

**Tone:** Ocean/beach-themed game portal. Fun, modern, clean. Think curated arcade, not educational software. The target audience is 10–14 year olds — it should feel cool, not babyish.

**Brand:**
- Name: Krabsy
- Mascot: A crab (use 🦀 emoji as placeholder — final mascot design is pending)
- Color palette: Ocean-inspired — deep blues, coral/salmon accents, sandy golds, teal/seafoam greens
- CSS variables to use:
  ```css
  --ocean-deep: #0288d1;
  --coral: #ff6b6b;
  --teal: #00c49a;
  --teal-dark: #00a882;
  --sand-gold: #ffd166;
  --white: #fff;
  ```
- Typography: `Fredoka One` for display/logo, `Nunito` for body text (both from Google Fonts, already used in the games)

**Design references:** Look at einmaleins.de for the game portal layout pattern (game grid as homepage, game embedded in-page). But Krabsy should look more modern and age-appropriate for teenagers, not young children.

---

## Page Structure

### Header
- Krabsy logo (left): "Krab" in `--ocean-deep`, "sy" in `--coral`, Fredoka One font. 🦀 emoji next to it.
- Language toggle (right): `DE | ES` — small pill buttons or text links. Active language is highlighted.
- Keep it slim — this should not dominate the page.

### Game Grid (main content, immediately visible)
- This IS the homepage. No hero banner above it.
- Responsive grid: **2 columns on mobile**, **3–4 columns on desktop**
- Each card is a **landscape thumbnail (16:9 aspect ratio)**
- Thumbnail image fills the entire card (no borders, no padding)
- **Desktop:** Game name + short description appear on hover (overlay slides up from bottom of card, semi-transparent dark background, white text)
- **Mobile:** Game name is always visible as a small overlay bar at bottom of card (since there's no hover on touch devices)
- Cards have subtle rounded corners and a light shadow
- Cards should have a satisfying hover animation (slight scale up + shadow increase)
- No BETA badges on cards

### Footer
- Minimal: Impressum/Imprint link, Contact, "Built with 🦀"
- Very small, unobtrusive

---

## Game Launch Behavior

When a user clicks a game card:
- The page navigates to a **game-specific URL**: `/games/{game-id}` (e.g., `/games/verb-slash`)
- The game page has the **same Krabsy header** at the top
- Below the header: the **game title**
- Below the title: the game loads in an **iframe with fixed 16:9 aspect ratio**, centered, max-width constrained so it doesn't get absurdly large on wide screens
- Below the game iframe: the **full game grid** is shown again (so kids can easily pick another game)
- A small **"← Back to all games"** link above the game iframe (clicking the logo also works)

---

## Localization

The homepage supports **German (DE)** and **Spanish (ES)** with a language toggle.

All UI text (header, footer, game descriptions, hover text, labels) is stored in a localization object and swapped instantly on toggle — no page reload.

The games themselves teach English, so game content is always in English. Only the platform chrome (surrounding UI) is localized.

### Localization structure:
```json
{
  "de": {
    "tagline": "Meistere Englisch — Spiel für Spiel!",
    "back_to_games": "← Zurück zu allen Spielen",
    "footer_imprint": "Impressum",
    "footer_contact": "Kontakt",
    "footer_built_with": "Made with 🦀"
  },
  "es": {
    "tagline": "¡Domina el inglés — juego a juego!",
    "back_to_games": "← Volver a todos los juegos",
    "footer_imprint": "Aviso legal",
    "footer_contact": "Contacto",
    "footer_built_with": "Hecho con 🦀"
  }
}
```

Game titles and descriptions also need DE and ES versions — these live in the games config (see below).

Language preference should be saved in `localStorage` and restored on next visit. Default to `de`.

---

## Games Configuration (the swappability system)

**This is the most important architectural requirement.** Adding, removing, or replacing a game must be trivial.

All game metadata lives in a single `games.json` file:

```json
{
  "games": [
    {
      "id": "verb-slash",
      "title_de": "Verb Slash!",
      "title_es": "Verb Slash!",
      "description_de": "Zerschlage die richtigen Verbformen!",
      "description_es": "¡Corta las formas verbales correctas!",
      "thumbnail": "thumbnails/verb-slash.png",
      "file": "games/verb-slash.html",
      "topic": "irregular_verbs",
      "status": "beta",
      "aspect_ratio": "16:9"
    },
    {
      "id": "bubble-up",
      "title_de": "Bubble Up!",
      "title_es": "Bubble Up!",
      "description_de": "Kicke dich nach oben und knacke die Verben!",
      "description_es": "¡Salta hacia arriba y resuelve los verbos!",
      "thumbnail": "thumbnails/bubble-up.png",
      "file": "games/bubble-up.html",
      "topic": "irregular_verbs",
      "status": "beta",
      "aspect_ratio": "16:9"
    }
  ]
}
```

**To add a new game:**
1. Drop the HTML file into `/games/`
2. Add a thumbnail image to `/thumbnails/`
3. Add one entry to `games.json`
4. Done. No code changes needed.

**To replace a game version:** swap the HTML file, keep the same filename.

**Placeholder cards:** If a game has `"thumbnail": null` or the image is missing, render a styled placeholder card using the game's topic color + an emoji/icon + the game title centered. This way we can announce upcoming games before they're built.

**Placeholder thumbnail style suggestions:**
- `irregular_verbs` topic → blue/teal gradient + 📝 or ✏️ emoji
- Future topics can have their own color schemes
- Game title displayed in Fredoka One, white, centered

---

## Folder Structure

```
krabsy.com/
├── index.html          ← Homepage (game grid)
├── game.html           ← Game page template (reused for all games)
├── games.json          ← Game registry (edit this to add/remove games)
├── style.css           ← Shared styles
├── script.js           ← Shared logic (routing, localization, grid rendering)
├── i18n.json           ← UI localization strings (DE + ES)
├── games/
│   ├── verb-slash.html ← Self-contained game files
│   └── bubble-up.html
└── thumbnails/
    ├── verb-slash.png  ← 16:9 screenshots or designed thumbnails
    └── bubble-up.png
```

**Note:** For the initial beta, `game.html` can work with URL parameters (e.g., `game.html?id=verb-slash`) instead of proper routing. Clean URLs (`/games/verb-slash`) can come later when we set up a proper server or static site generator.

---

## Technical Requirements

- **Pure HTML/CSS/JS.** No frameworks, no build tools, no npm. This must be deployable by dropping files onto any static hosting.
- **Mobile-first responsive design.** Most users will be on phones.
- **Google Fonts:** Import Fredoka One and Nunito.
- **No localStorage for game data** (games handle their own storage). Only use localStorage for language preference.
- **The game iframe** must:
  - Maintain 16:9 aspect ratio at all widths
  - Be centered with reasonable max-width (~900px)
  - Have `allow="fullscreen"` attribute
  - Have no visible border (or a very subtle one matching the theme)
- **Smooth interactions:** Card hover animations, language toggle transition, page transitions should feel polished.
- **SEO basics:** Proper `<title>`, `<meta description>`, `<html lang>` tag that updates with language toggle, Open Graph tags.

---

## What We Have Right Now

Two working games (both self-contained HTML files):

1. **Verb Slash** (`verb-slash.html`) — A Fruit Ninja-style game. Currently portrait/mobile-optimized. Will be letterboxed in 16:9 container — that's OK for now.
2. **Bubble Up** (`bubble-up.html`) — An endless ocean arcade game with diagonal movement physics. May need layout adjustments for 16:9.

For the beta launch, include both games plus 2–3 placeholder cards for upcoming games (to show the grid isn't empty and to signal more content is coming).

Placeholder game ideas to include as "coming soon" cards:
- "Verb Cards" (memory/matching game) — irregular_verbs topic
- "Astro Verbs" (space shooter) — irregular_verbs topic
- "Tense Tower" (tower defense) — tenses topic

---

## Quality Checklist

Before considering this done, verify:

- [ ] Homepage loads and shows game grid immediately (no loading screens, no splash pages)
- [ ] Language toggle switches all visible text between DE and ES without page reload
- [ ] Language preference is saved and restored on revisit
- [ ] Clicking a game card navigates to the game page and loads the game in an iframe
- [ ] Game iframe maintains 16:9 aspect ratio on all screen sizes
- [ ] Game grid is visible below the iframe on the game page
- [ ] "Back to all games" link works
- [ ] Placeholder cards render nicely for games without thumbnails
- [ ] Hover effects work on desktop, touch works on mobile
- [ ] Game name overlay appears on hover (desktop) / always visible (mobile)
- [ ] Page looks good on iPhone SE (small), iPhone 14 (medium), iPad (tablet), desktop
- [ ] Adding a new game by editing `games.json` works with zero code changes
- [ ] All text is localized (no hardcoded German or Spanish strings in HTML/JS)
- [ ] Footer contains Impressum and Contact links
- [ ] `<html lang>` attribute updates when language is toggled
- [ ] Page title and meta description are localized

---

## Out of Scope (don't build these)

- User accounts / authentication
- Backend / database
- Analytics (add later)
- Ad integration (add later)
- Additional languages beyond DE + ES
- Verb reference tables / SEO content pages (separate task)
- Game progress tracking across games
- Any kind of "about" or "how it works" page
