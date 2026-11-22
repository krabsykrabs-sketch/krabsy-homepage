# Verb Dungeon — release prep for the master session

State 2026-11-22 (afternoon): hero weapons, **touch controls** and the
**check pass on the site question engine** are done (see the game's
`CLAUDE.md` Status log). Still open before going live: the owner's play-test
on a real tablet / phone (headless tests only so far). Text for the info
pages below (section "Device text").

Agreed with the master session (Homepage layout / Verb Towers release):
the master does the release and pushes the shared site files; the Dungeon
session prepares everything here and does not edit `homepage/` any more.

## Already prepared

Committed and pushed by the master with the Verb Towers release (f07357d,
2026-11-22): the `games.json` entry as `coming_soon` and the three
thumbnails (the "Bald" tile works). Still uncommitted: the
`game_info_content.py` content and the static-list re-render, if the
master did not include them.

- `homepage/data/games.json`: `verb-dungeon` entry with status
  **`coming_soon`** (card shows "Bald"/disabled), new tagline, thumbnails,
  `hero`, `new_until: 2027-03-31` (Dungeon agent's choice; change freely),
  `devices: large_screen` (→ `phone_ok` at release, see step 3).
- Images (**master, 2026-11-22: replaced by Gemini key art in the Verb
  Kitchen style** — the three heroes with the golden key at an opening
  dungeon door, dizzy golem, bone-pile skeleton; originals in
  `_incoming/verb-dungeon-art/`, v2 used):
  `homepage/thumbnails/hero/verb-dungeon.jpg` (1200×675) and
  `homepage/thumbnails/sm/verb-dungeon.jpg` (640×360). `games.json`
  `thumbnail` now points to the sm JPG; `thumbnails/verb-dungeon.png` (the
  boss-room screenshot) is no longer referenced. At release, use the hero
  JPG as `og:image` / `twitter:image` on both wrapper pages.
- `tools/game_info_content.py`: `verb-dungeon` DE/ES content (heading,
  meta, intro, how to play, what you learn, 3 FAQs, related games),
  genre Adventure. **Its device/FAQ and how-to text still says keyboard
  only** — replace it with the text in "Device text" below.
- Static lists re-rendered with `tools/render_static_games.py` (disabled
  "Bald" card/tile in the DE/ES games hubs, landing pages, verb hubs).

## At release (master)

1. Copy the game build: `games/verb-dungeon/` → `homepage/games/verb-dungeon/`
   — only `index.html`, `src/`, `assets/`, `vendor/`, `fonts/` (not `poc/`,
   `tools/`, `release/`, `_shots/`, `*.md`, `.claude/`). Its `index.html`
   has `noindex, indexifembedded`; it imports `/lib/krabsy-questions.js`
   from the site. Size 6.3 MB (2026-11-22, with weapons and touch):
   `assets/` 4.61 MB (about 3.4 MB in the first load; the other heroes load
   when picked), `vendor/` 1.46 MB, `src/` 0.18 MB, `fonts/` 0.05 MB.
2. Wrapper pages (prepared, built from Verb Kitchen's wrapper, with info
   section, JSON-LD WebPage/VideoGame/Breadcrumb/FAQPage, canonical,
   hreflang, og tags, `initGamePage('verb_dungeon')`):
   `games/verb-dungeon/release/de/index.html` → `homepage/de/spiele/verb-dungeon/index.html`
   `games/verb-dungeon/release/es/index.html` → `homepage/es/juegos/verb-dungeon/index.html`
   (re-render their info section with `tools/render_game_info.py` if the
   content in `game_info_content.py` changed).
3. `games.json`: `verb-dungeon` status `coming_soon` → **`beta`** (Verb
   Kitchen's first release was `beta`, commit 9d52df5) and **`devices:
   phone_ok`**: touch controls shipped, a tablet plays everything by touch,
   and a phone held sideways (tested at 844×390) is playable (compact menu,
   smaller stick and button; small, but every word reads). Phones held
   upright show "turn your device". If the owner's real-phone check finds
   it too small, keep `large_screen` instead. Re-run
   `tools/render_static_games.py`.
4. Games hubs JSON-LD `hasPart`, add after the Kitchen line (mind the comma):
   - DE `homepage/de/spiele/index.html`:
     `{ "@type": "WebApplication", "name": "Verb Dungeon",    "url": "https://krabsy.com/de/spiele/verb-dungeon/",    "applicationCategory": "EducationalApplication", "operatingSystem": "Any" }`
   - ES `homepage/es/juegos/index.html`: same with
     `https://krabsy.com/es/juegos/verb-dungeon/`.
5. Hub intro paragraph, one sentence each (append to the "Jedes Spiel
   trainiert …" / "Cada juego te hace pensar …" paragraph):
   - DE: ` In <a href="/de/spiele/verb-dungeon/">Verb Dungeon</a> suchst du im Verlies nach Schlüsseln und öffnest Türen mit den richtigen Formen.`
   - ES: ` En <a href="/es/juegos/verb-dungeon/">Verb Dungeon</a> buscas llaves en una mazmorra y abres puertas con las formas correctas.`
6. Sitemap: `tools/generate_sitemap.py` (adds both wrapper URLs with
   hreflang de/es/x-default).
7. Deploy (owner clicks Deploy in Coolify), check both wrappers live, then
   IndexNow:
   `https://krabsy.com/de/spiele/verb-dungeon/`, `https://krabsy.com/es/juegos/verb-dungeon/`,
   `https://krabsy.com/de/spiele/`, `https://krabsy.com/es/juegos/`,
   `https://krabsy.com/de/`, `https://krabsy.com/es/`,
   `https://krabsy.com/de/unregelmaessige-verben/`, `https://krabsy.com/es/verbos-irregulares/`
8. STATUS.md: Verb Dungeon row → released (beta).

## Device text (for `tools/game_info_content.py`, `verb-dungeon`)

Replace these three items, then re-render the wrappers' info section
(`tools/render_game_info.py`).

DE `howto[0]`:

    Am Computer läufst du mit <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> oder den Pfeiltasten und haust und durchsuchst mit der <kbd>Leertaste</kbd>. Auf Tablet und Handy erscheinen ein Joystick (Daumen links aufs Bild legen und schieben) und ein Schwert-Knopf rechts unten.

DE `howto[2]`:

    Lauf über den Schlüssel, dann erscheint eine Frage wie <em>go → ___ → ___</em>. Antworte mit einem Klick, durch Antippen oder mit den Tasten <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd>. Solange die Frage offen ist, steht das ganze Verlies still.

DE FAQ 1:

    ("Kann ich Verb Dungeon auf dem Handy oder Tablet spielen?", "Ja. Auf Touch-Geräten erscheinen ein Joystick zum Laufen und ein Schwert-Knopf zum Hauen und Durchsuchen; Antworten tippst du einfach an. Das Handy hältst du quer. Am bequemsten ist es auf einem Tablet oder am Computer mit Tastatur."),

ES `howto[0]`:

    En la computadora te mueves con <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> o con las flechas, y golpeas y registras con la <kbd>barra espaciadora</kbd>. En tableta y celular aparecen un joystick (apoya el pulgar a la izquierda de la pantalla y deslízalo) y un botón de espada abajo a la derecha.

ES `howto[2]`:

    Pasa por encima de la llave y aparece una pregunta como <em>go → ___ → ___</em>. Responde con un clic, tocando la respuesta o con las teclas <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd>. Mientras la pregunta está abierta, toda la mazmorra se queda quieta.

ES FAQ 1:

    ("¿Puedo jugar Verb Dungeon en el celular o la tablet?", "Sí. En pantallas táctiles aparecen un joystick para moverte y un botón de espada para golpear y registrar; las respuestas solo se tocan. El celular se sostiene en horizontal. Lo más cómodo es una tableta o la computadora con teclado."),

