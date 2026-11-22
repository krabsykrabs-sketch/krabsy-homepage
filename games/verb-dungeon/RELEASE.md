# Verb Dungeon — release prep for the master session

**READY TO RELEASE (owner, 2026-11-22: "It can go live").** Build =
commit b3101a6 (`games/verb-dungeon/`): hero weapons, touch controls, the
check pass on the site question engine and play-test notes 8–13 (mage
staff, breakable crates, two-wall rune rooms, the verb book, a boss per
level, forehand swings) are done. Not verified: a real tablet/phone and the
new sounds (headless tests only). Use the "Info page text" section below
for `tools/game_info_content.py`: the game no longer asks at the key, so
several lines changed.

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
  only, and it describes the old key question and the one golem** —
  replace it with the text in "Info page text" below.
- Static lists re-rendered with `tools/render_static_games.py` (disabled
  "Bald" card/tile in the DE/ES games hubs, landing pages, verb hubs).

## At release (master)

1. Copy the game build: `games/verb-dungeon/` → `homepage/games/verb-dungeon/`
   — only `index.html`, `src/`, `assets/`, `vendor/`, `fonts/` (not `poc/`,
   `tools/`, `release/`, `_shots/`, `*.md`, `.claude/`). Its `index.html`
   has `noindex, indexifembedded`; it imports `/lib/krabsy-questions.js`
   from the site. Size 7.2 MB (2026-11-22, with the three bosses):
   `assets/` 5.50 MB (about 3.4 MB in the first load, unchanged; the other
   heroes load when picked, the level 2 / 3 bosses — 0.89 MB — when that
   level starts), `vendor/` 1.46 MB, `src/` 0.22 MB, `fonts/` 0.05 MB.
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

## Info page text (for `tools/game_info_content.py`, `verb-dungeon`)

Replace these items (DE and ES), then re-render the wrappers' info section
(`tools/render_game_info.py`). Items not listed stay as they are.

### DE

`meta`:

    Ein 3D-Dungeon-Abenteuer mit englischen Verben: Finde den versteckten Schlüssel, lies das Verb-Buch an der Tür und besiege drei verschiedene Bosse. Kostenlos im Browser, ohne Anmeldung.

`lead[0]`:

    In Verb Dungeon läuft dein kleiner Held mit Schwert durch ein Verlies voller Fackeln, Fässer und frecher Skelette. In jedem Raum ist die Tür verschlossen. Den Schlüssel musst du erst finden – er steckt in einem Fass, einer Kiste oder bei einem Skelett. Aufschließen kannst du nur mit Englisch: Neben der Tür liegt ein Verb-Buch in einem leuchtenden Runenkreis, und mit <strong>zwei richtigen Verbformen</strong> geht die Tür auf.

`howto` (all five):

    Am Computer läufst du mit <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> oder den Pfeiltasten. Die <kbd>Leertaste</kbd> haut, zerschlägt Kisten und Fässer und öffnet Truhen und das Verb-Buch. Auf Tablet und Handy erscheinen ein Joystick (Daumen links aufs Bild legen und schieben) und ein Schwert-Knopf rechts unten, der dasselbe macht.

    Alles, was du benutzen kannst, hat einen leuchtenden Ring am Boden. Zerschlag Fässer und Kisten oder hau die Skelette um, bis der Schlüssel herausfällt, und lauf darüber.

    Mit dem Schlüssel gehst du zum Verb-Buch neben der Tür – in seinen Runenkreis kommen keine Skelette und keine Pfeile. Drück die <kbd>Leertaste</kbd> oder den Schwert-Knopf, dann erscheint eine Frage wie <em>go → ___ → ___</em>. Antworte mit einem Klick, durch Antippen oder mit den Tasten <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd>. Eine Frage kommt nur, wenn du sie aufrufst, und solange sie offen ist, steht das ganze Verlies still.

    Manche Räume haben eigene Rätsel: zwei Wände mit Runentüren hintereinander (nur die Tür mit dem richtigen Wort geht auf), eine Wortbrücke, auf der nur die Steine mit der richtigen Form halten, oder einen Hinterhalt, bei dem die Tür hinter dir zufällt.

    Am Ende jedes Levels wartet ein anderer Boss: ein großer Golem, ein Nekromant, der immer neue Skelette ruft, und ein Skelett-Magier mit Zauberkugeln. Stell dich auf den leuchtenden Stein, drück die <kbd>Leertaste</kbd> und beantworte die Frage – dann ist der Boss kurz schwindelig, und du kannst ihn hauen.

`learn[1]`:

    Es gibt drei Level mit fünf bis sechs Räumen, von leichten Verben in Level 1 bis zu schwierigeren in Level 3. Wer alles beim ersten Versuch richtig hat, bekommt drei Sterne. Mit Münzen aus Truhen, der Schatzkammer und von den Bossen schaltest du neue Helden frei: Barbar, Schurke und Magier.

FAQ 1 and FAQ 2:

    ("Kann ich Verb Dungeon auf dem Handy oder Tablet spielen?", "Ja. Auf Touch-Geräten erscheinen ein Joystick zum Laufen und ein Schwert-Knopf zum Hauen und Öffnen; Antworten tippst du einfach an. Das Handy hältst du quer. Am bequemsten ist es auf einem Tablet oder am Computer mit Tastatur."),
    ("Ist das Spiel gruselig?", "Nur ein bisschen. Es gibt Fackeln, Skelette und drei alberne Bosse, aber kein Blut und nichts zum Fürchten. Wer alle Herzen verliert, ist kurz schwindelig und startet den Raum neu – was du schon geschafft hast, bleibt."),

### ES

`meta`:

    Una aventura en 3D con verbos en inglés: encuentra la llave escondida, lee el libro de verbos junto a la puerta y vence a tres jefes distintos. Gratis en el navegador, sin registro.

`lead[0]`:

    En Verb Dungeon tu pequeño héroe con espada recorre una mazmorra llena de antorchas, barriles y esqueletos traviesos. En cada sala la puerta está cerrada con llave, y primero tienes que encontrarla: está escondida en un barril, una caja o la lleva un esqueleto. Para abrir la puerta necesitas inglés: junto a ella hay un libro de verbos en un círculo de runas brillante, y con <strong>dos formas verbales correctas</strong> la puerta se abre.

`howto` (all five):

    En la computadora te mueves con <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> o con las flechas. La <kbd>barra espaciadora</kbd> golpea, rompe cajas y barriles y abre cofres y el libro de verbos. En tableta y celular aparecen un joystick (apoya el pulgar a la izquierda de la pantalla y deslízalo) y un botón de espada abajo a la derecha que hace lo mismo.

    Todo lo que puedes usar tiene un anillo brillante en el suelo. Rompe barriles y cajas o derriba a los esqueletos hasta que aparezca la llave, y pasa por encima de ella.

    Con la llave vas al libro de verbos junto a la puerta: en su círculo de runas no entran esqueletos ni flechas. Pulsa la <kbd>barra espaciadora</kbd> o el botón de espada y aparece una pregunta como <em>go → ___ → ___</em>. Responde con un clic, tocando la respuesta o con las teclas <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd>. Una pregunta solo aparece cuando tú la abres, y mientras está abierta, toda la mazmorra se queda quieta.

    Algunas salas tienen su propio reto: dos paredes con puertas de runas, una detrás de otra (solo se abre la puerta con la palabra correcta), un puente de palabras donde solo aguantan las piedras con la forma correcta, o una emboscada en la que la puerta se cierra detrás de ti.

    Al final de cada nivel te espera un jefe distinto: un gólem enorme, un nigromante que no para de levantar esqueletos y un mago esqueleto con bolas mágicas. Párate sobre la piedra brillante, pulsa la <kbd>barra espaciadora</kbd> y responde la pregunta: el jefe se marea un momento y puedes golpearlo.

`learn[1]`:

    Hay tres niveles con cinco o seis salas, desde verbos fáciles en el nivel 1 hasta otros más difíciles en el nivel 3. Si aciertas todo al primer intento, consigues tres estrellas. Con las monedas de los cofres, la sala del tesoro y los jefes desbloqueas nuevos héroes: bárbaro, pícaro y mago.

FAQ 1 and FAQ 2:

    ("¿Puedo jugar Verb Dungeon en el celular o la tablet?", "Sí. En pantallas táctiles aparecen un joystick para moverte y un botón de espada para golpear y abrir; las respuestas solo se tocan. El celular se sostiene en horizontal. Lo más cómodo es una tableta o la computadora con teclado."),
    ("¿Da miedo el juego?", "Solo un poquito. Hay antorchas, esqueletos y tres jefes muy tontos, pero nada de sangre ni de terror. Si pierdes todos los corazones, te mareas un momento y la sala empieza de nuevo; lo que ya lograste se queda."),
