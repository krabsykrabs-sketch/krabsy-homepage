"""Visible SEO content for the game wrapper pages (homepage/<lang>/<spiele|juegos>/<id>/).

Rendered into the pages by tools/render_game_info.py. Every fact here was
checked against the served game code (2026-11) — keep it that way: when a
game changes (new levels, controls, verbs), update its entry and re-run the
renderer. Strings may contain inline HTML (<em>, <strong>, <a>).

Per page keys:
  h1, lead (list of paragraphs), howto (list), learn (list of paragraphs),
  faq (list of (question, answer)), related (game ids), verbs (verb slugs
  linked in the "learn" box), meta (optional new meta description),
  ld_description (JSON-LD description), genre, teaches.
"""

DE_HUB = "/de/unregelmaessige-verben"
ES_HUB = "/es/verbos-irregulares"


def v(lang, verb):
    hub = DE_HUB if lang == "de" else ES_HUB
    return f'<a href="{hub}/{verb}/"><em>{verb}</em></a>'


CONTENT = {
    # ───────────────────────────────────────────────────────────── Verb Slash
    "verb-slash": {
        "de": {
            "h1": "Verb Slash – unregelmäßige Verben mit einem Wisch üben",
            "meta": "Zerschneide Ballons und Bälle mit der richtigen Verbform – go, went, gone. Wisch-Spiel zum Üben unregelmäßiger englischer Verben. Kostenlos im Browser, ohne Anmeldung.",
            "lead": [
                "In Verb Slash steigen Ballons und Wasserbälle über dem Strand auf – und du zerschneidest mit einem schnellen Wisch die richtige Verbform. So übst du die <strong>unregelmäßigen Verben im Englischen</strong>, ganz ohne Vokabelheft. Jede Runde dreht sich um ein Verb, zum Beispiel <em>go → went → gone</em>.",
                "Das Spiel läuft kostenlos im Browser, ohne Download und ohne Anmeldung. Alle Hinweise im Spiel sind auf Deutsch, nur die Verben bleiben natürlich Englisch.",
            ],
            "howto": [
                "Zwei Ballons mit je einem englischen Verb steigen auf. Tippe oder wische auf einen davon – das ist dein Verb für die Runde.",
                "Jetzt fliegen Bälle mit verschiedenen Formen hoch. Zerschneide den Ball mit der <strong>Simple-Past-Form</strong> (bei <em>go</em> also <em>went</em>).",
                "In der zweiten Welle suchst du das <strong>Past Participle</strong> (<em>gone</em>).",
                "Du hast drei Herzen. Eins geht verloren, wenn du einen falschen Ball triffst oder den richtigen herunterfallen lässt. Nach jedem Fehler zeigt dir das Spiel die richtige Reihe, zum Beispiel <em>go → went → gone</em> – und der erste Fehler pro Spiel kostet kein Herz.",
                "Am Computer klickst du den richtigen Ball an oder wischst mit gedrückter Maustaste darüber, auf Handy und Tablet tippst oder wischst du mit dem Finger.",
            ],
            "learn": [
                "Verb Slash trainiert 30 häufige unregelmäßige Verben, zum Beispiel {go}, {swim}, {write}, {break} und {forget}. Auf den falschen Bällen stehen ausgedachte Fehlerformen wie <em>goed</em> oder <em>writed</em> – genau die Fehler, die im Test gern passieren. Mit jeder richtigen Serie steigt dein Punkte-Multiplikator. Verben, die du verpasst hast, kommen später noch einmal dran, und deinen Rekord merkt sich das Spiel auf deinem Gerät.",
            ],
            "verbs": ["go", "swim", "write", "break", "forget"],
            "faq": [
                ("Ist Verb Slash kostenlos?", "Ja. Du spielst direkt im Browser – ohne Download, ohne Konto und ohne Anmeldung."),
                ("Kann ich Verb Slash auf dem Handy spielen?", "Ja, du wischst einfach mit dem Finger. Halte das Handy am besten quer, dann wird das Spielfeld größer."),
                ("Für welche Klasse eignet sich das Spiel?", "Unregelmäßige Verben kommen im Englischunterricht meist ab Klasse 5 oder 6 dran. Verb Slash ist ideal zum Wiederholen vor Vokabeltests und Klassenarbeiten."),
            ],
            "related": ["verb-snake", "air-control", "verb-kitchen"],
        },
        "es": {
            "h1": "Verb Slash: practica los verbos irregulares en inglés de un tajo",
            "meta": "Corta globos y pelotas con la forma verbal correcta – go, went, gone. Juego para practicar los verbos irregulares en inglés. Gratis en el navegador, sin registro.",
            "lead": [
                "En Verb Slash suben globos y pelotas de playa por la pantalla y tú cortas la forma verbal correcta con un movimiento rápido. Es una manera divertida de repasar los <strong>verbos irregulares en inglés</strong> sin abrir el cuaderno. Cada ronda gira alrededor de un verbo, por ejemplo <em>go → went → gone</em>.",
                "Puedes jugar gratis en el navegador, sin descargar nada y sin registrarte. Todas las indicaciones del juego están en español; solo los verbos siguen en inglés, claro.",
            ],
            "howto": [
                "Aparecen dos globos, cada uno con un verbo en inglés. Toca uno o pasa el dedo o el ratón por encima para elegir el verbo de la ronda.",
                "Luego saltan pelotas con distintas formas. Corta la que tiene el <strong>pasado simple</strong> (si elegiste <em>go</em>, es <em>went</em>).",
                "En la segunda tanda buscas el <strong>participio pasado</strong> (<em>gone</em>).",
                "Tienes tres vidas. Pierdes una si cortas una pelota equivocada o si dejas caer la correcta. Después de cada error el juego te muestra la serie correcta, por ejemplo <em>go → went → gone</em>, y el primer error de cada partida no te quita ninguna vida.",
                "En la computadora haces clic en la pelota correcta o la cortas manteniendo pulsado el botón del ratón; en el celular o la tablet, la tocas o deslizas el dedo.",
            ],
            "learn": [
                "El juego usa 30 verbos irregulares muy frecuentes, como {go}, {swim}, {write}, {break} y {forget}. Las pelotas falsas llevan formas inventadas como <em>goed</em> o <em>writed</em>, justo los errores típicos del examen. Cuantos más aciertos seguidos, más alto el multiplicador de puntos. Los verbos que fallas vuelven a salir más tarde, y tu récord queda guardado en tu dispositivo.",
            ],
            "verbs": ["go", "swim", "write", "break", "forget"],
            "faq": [
                ("¿Verb Slash es gratis?", "Sí. Juegas directamente en el navegador, sin descargas, sin cuenta y sin registro."),
                ("¿Se puede jugar en el celular?", "Sí, solo tienes que deslizar el dedo. Pon el teléfono en horizontal para ver el juego más grande."),
                ("¿Para qué edad es?", "Está pensado para chicos y chicas desde unos 10 años que estudian inglés en la escuela. Es perfecto para repasar los verbos irregulares antes de un examen."),
            ],
            "related": ["verb-snake", "air-control", "verb-kitchen"],
        },
    },
    # ───────────────────────────────────────────────────────────── Crab Slash
    "crab-slash": {
        "de": {
            "h1": "Crab Slash – finde die richtigen Verbformen am Strand",
            "meta": "Wische über die Krabben mit der richtigen Form: Simple Past und Past Participle von 30 unregelmäßigen englischen Verben. Kostenlos im Browser, ohne Anmeldung.",
            "lead": [
                "Am Strand wuseln Krabben herum, und jede trägt ein Schild mit einem englischen Wort. Oben auf der Karte steht ein Verb, etwa <em>go → ??? / ???</em>. Deine Aufgabe: Wische über die zwei Krabben mit den passenden Formen – <em>went</em> und <em>gone</em>. Crab Slash ist ein schnelles Strandspiel für alle, die die <strong>unregelmäßigen Verben</strong> sicher können wollen.",
                "Du brauchst nichts zu installieren und kein Konto. Die Hinweise im Spiel sind kurz und auf Englisch.",
            ],
            "howto": [
                "Schau auf die Karte oben: Dort steht die Grundform des Verbs.",
                "Wische über die Krabbe mit der richtigen <strong>Simple-Past-Form</strong> und über die Krabbe mit dem richtigen <strong>Past Participle</strong>.",
                "Zu jedem Verb laufen zwei richtige und zwei falsche Krabben herum. Alle Schilder sehen gleich aus – die Farbe verrät also nichts.",
                "Es sind immer mehrere Verben unterwegs, aber nur das Verb auf der Karte zählt. Lies genau!",
                "Nach 30 Verben ist die Runde geschafft. Steuern kannst du mit der Maus oder mit dem Finger.",
            ],
            "learn": [
                "Crab Slash übt die drei Formen von 30 wichtigen Verben wie {eat}, {fly}, {drink}, {choose} und {throw}. Die falschen Krabben tragen typische Fehler wie <em>eated</em> oder <em>wented</em>. Du kannst hier nicht verlieren: Ein Fehlgriff setzt nur deine Serie zurück. Wer viele Treffer hintereinander schafft, bekommt bis zu dreifache Punkte – und sieht am Ende seine beste Serie.",
            ],
            "verbs": ["eat", "fly", "drink", "choose", "throw"],
            "faq": [
                ("Kann man bei Crab Slash verlieren?", "Nein. Es gibt keine Leben. Ein falscher Treffer kostet nur deine Serie, du kannst also in Ruhe üben."),
                ("Wie lange dauert eine Runde?", "Eine Runde ist vorbei, wenn du alle 30 Verben vollständig gefunden hast – je nach Tempo ein paar Minuten."),
                ("Funktioniert das Spiel auf dem Tablet?", "Ja. Du wischst mit dem Finger über die Krabben, genau wie mit der Maus am Computer."),
            ],
            "related": ["verb-dungeon", "verb-flow", "verb-snake"],
        },
        "es": {
            "h1": "Crab Slash: atrapa las formas verbales en la playa",
            "meta": "Corta los cangrejos que llevan la forma correcta: pasado simple y participio de 30 verbos irregulares en inglés. Gratis en el navegador, sin registro.",
            "lead": [
                "En la playa corren cangrejos que llevan carteles con palabras en inglés. Arriba, una tarjeta te muestra un verbo, por ejemplo <em>go → ??? / ???</em>. Tu misión es cortar los dos cangrejos que llevan las formas correctas: <em>went</em> y <em>gone</em>. Crab Slash es un juego rápido para dominar los <strong>verbos irregulares en inglés</strong>.",
                "No hace falta instalar nada ni crear una cuenta. Las indicaciones del juego son cortas y están en inglés.",
            ],
            "howto": [
                "Mira la tarjeta de arriba: ahí aparece el verbo en su forma base.",
                "Desliza sobre el cangrejo con el <strong>pasado simple</strong> correcto y sobre el que lleva el <strong>participio pasado</strong> correcto.",
                "Por cada verbo hay dos cangrejos correctos y dos con formas falsas. Todos los carteles son iguales, así que el color no te da pistas.",
                "En la arena hay varios verbos a la vez, pero solo cuenta el de la tarjeta. ¡Lee con atención!",
                "Terminas la partida cuando completas los 30 verbos. Se juega con el ratón o con el dedo.",
            ],
            "learn": [
                "Crab Slash repasa las tres formas de 30 verbos clave, como {eat}, {fly}, {drink}, {choose} y {throw}. Los cangrejos tramposos llevan errores típicos como <em>eated</em> o <em>wented</em>. Aquí no se pierde: un error solo reinicia tu racha. Si encadenas aciertos, los puntos se multiplican hasta por tres, y al final ves tu mejor racha.",
            ],
            "verbs": ["eat", "fly", "drink", "choose", "throw"],
            "faq": [
                ("¿Se puede perder en Crab Slash?", "No. No hay vidas: si te equivocas, solo se reinicia tu racha. Puedes practicar sin presión."),
                ("¿Cuánto dura una partida?", "Termina cuando encuentras las formas de los 30 verbos; según tu ritmo, unos pocos minutos."),
                ("¿Funciona en tablet o celular?", "Sí. Deslizas el dedo sobre los cangrejos igual que con el ratón en la computadora. En horizontal se ve mejor."),
            ],
            "related": ["verb-dungeon", "verb-flow", "verb-snake"],
        },
    },
    # ──────────────────────────────────────────────────────────── Air Control
    "air-control": {
        "de": {
            "h1": "Air Control – lande Flugzeuge mit englischen Verbformen",
            "meta": "Zeichne Flugrouten und lande go, went und gone auf derselben Landebahn. Fluglotsen-Spiel zum Üben unregelmäßiger englischer Verben. Kostenlos im Browser, ohne Anmeldung.",
            "lead": [
                "In Air Control bist du Fluglotse. Jedes Flugzeug trägt eine englische Verbform – und du bringst die drei Formen eines Verbs, zum Beispiel <em>fly</em>, <em>flew</em> und <em>flown</em>, auf <strong>dieselbe Landebahn</strong>. Dabei musst du gleichzeitig aufpassen, dass sich keine Flugzeuge in die Quere kommen. Ein Spiel für alle, die die <strong>unregelmäßigen Verben</strong> üben und dabei einen kühlen Kopf behalten wollen.",
                "Air Control läuft kostenlos im Browser. Die Texte im Spiel sind auf Deutsch, nur die Verben bleiben Englisch. Ein kurzes Tutorial zeigt dir beim ersten Start, wie es geht.",
            ],
            "howto": [
                "Ziehe mit der Maus oder dem Finger eine Linie von einem Flugzeug zu einer Landebahn – das Flugzeug fliegt die Route ab.",
                "Lande alle drei Formen eines Verbs auf derselben Bahn. Landen sie in der richtigen Reihenfolge – erst <em>go</em>, dann <em>went</em>, dann <em>gone</em> –, gibt es einen großen Bonus. Lies genau: Die Flugzeuge verraten nicht, welche Form sie tragen.",
                "Hubschrauber 🚁 gehören auf den H-Landeplatz.",
                "Achtung: Stoßen zwei Flugzeuge zusammen, ist das Spiel vorbei.",
                "Mit <kbd>P</kbd> oder der Leertaste pausierst du, mit <kbd>M</kbd> schaltest du den Ton aus.",
            ],
            "learn": [
                "Air Control enthält 30 häufige unregelmäßige Verben, darunter {fly}, {take}, {begin}, {speak} und {drive}. Du musst die Formen nicht nur erkennen, sondern auch zusammen denken: Welche drei Wörter gehören zu einem Verb? Es gibt drei Level, die nacheinander freigeschaltet werden: „First Flight“, „Heli School“ und „Endless Skies“ mit zwei Landebahnen und immer mehr Verkehr. Am Ende siehst du, welche Verbketten du komplett gelandet hast.",
            ],
            "verbs": ["fly", "take", "begin", "speak", "drive"],
            "faq": [
                ("Was passiert, wenn ich ein Flugzeug zur falschen Bahn schicke?", "Dann erscheint „Wrong runway!“ und das Flugzeug fliegt die Route nicht – zieh einfach eine neue. Das Spiel endet nur, wenn zwei Flugzeuge zusammenstoßen."),
                ("Wie schalte ich neue Level frei?", "Die drei Level werden der Reihe nach freigeschaltet. Dein Fortschritt und dein Rekord werden auf deinem Gerät gespeichert."),
                ("Ist Air Control auf Deutsch?", "Ja. Alle Texte im Spiel sind auf Deutsch (auf der spanischen Seite auf Spanisch). Nur die Verbformen selbst bleiben Englisch – die übst du ja."),
            ],
            "related": ["verb-snake", "verb-kitchen", "verb-dungeon"],
        },
        "es": {
            "h1": "Air Control: aterriza aviones con los verbos irregulares",
            "meta": "Traza rutas de vuelo y aterriza go, went y gone en la misma pista. Juego de controlador aéreo para practicar los verbos irregulares en inglés. Gratis, sin registro.",
            "lead": [
                "En Air Control eres controlador aéreo. Cada avión lleva una forma verbal en inglés y tu trabajo es aterrizar las tres formas de un mismo verbo – por ejemplo <em>fly</em>, <em>flew</em> y <em>flown</em> – <strong>en la misma pista</strong>. Al mismo tiempo tienes que evitar que los aviones choquen. Ideal para practicar los <strong>verbos irregulares en inglés</strong> mientras pones a prueba tus reflejos.",
                "Se juega gratis en el navegador. Los textos del juego están en español; solo los verbos siguen en inglés. La primera vez, un pequeño tutorial te enseña lo básico.",
            ],
            "howto": [
                "Arrastra el ratón o el dedo desde un avión hasta una pista para trazar su ruta.",
                "Aterriza las tres formas de un verbo en la misma pista. Si aterrizan en el orden correcto – primero <em>go</em>, luego <em>went</em> y después <em>gone</em> – ganas un gran bonus. Lee bien: los aviones no te dicen qué forma llevan.",
                "Los helicópteros 🚁 van al helipuerto marcado con una H.",
                "¡Cuidado! Si dos aviones chocan, se acaba la partida.",
                "Con <kbd>P</kbd> o la barra espaciadora pausas el juego; con <kbd>M</kbd> quitas el sonido.",
            ],
            "learn": [
                "El juego incluye 30 verbos irregulares muy usados, entre ellos {fly}, {take}, {begin}, {speak} y {drive}. No basta con reconocer cada forma: tienes que pensar qué tres palabras forman un verbo completo. Hay tres niveles que se desbloquean uno tras otro: «First Flight», «Heli School» y «Endless Skies», con dos pistas y cada vez más tráfico. Al terminar ves todas las cadenas de verbos que lograste aterrizar.",
            ],
            "verbs": ["fly", "take", "begin", "speak", "drive"],
            "faq": [
                ("¿Qué pasa si mando un avión a la pista equivocada?", "Aparece «Wrong runway!» y el avión no sigue esa ruta; solo tienes que trazar otra. La partida termina únicamente si dos aviones chocan."),
                ("¿Cómo se desbloquean los niveles?", "Los tres niveles se abren en orden. Tu progreso y tu mejor puntuación se guardan en tu dispositivo."),
                ("¿El juego está en español?", "Sí. Todos los textos del juego están en español (en la página alemana, en alemán). Solo las formas verbales siguen en inglés, que es justo lo que practicas."),
            ],
            "related": ["verb-snake", "verb-kitchen", "verb-dungeon"],
        },
    },
    # ───────────────────────────────────────────────────────────── Verb Snake
    "verb-snake": {
        "de": {
            "h1": "Verb Snake – das Schlangenspiel mit unregelmäßigen Verben",
            "meta": "Snake mit englischen Verben: Friss go, went und gone in der richtigen Reihenfolge und übe so die unregelmäßigen Verben. Kostenlos im Browser, ohne Anmeldung.",
            "lead": [
                "Kennst du Snake? In Verb Snake steuerst du eine Schlange über das Spielfeld, aber das Futter ist besonders: Auf jedem Obststück steht eine englische Verbform. Friss die Formen <strong>in der richtigen Reihenfolge</strong> – zuerst <em>go</em>, dann <em>went</em>, dann <em>gone</em> – und deine Schlange wächst.",
                "So trainierst du die <strong>unregelmäßigen Verben</strong> mit einem echten Klassiker. Kostenlos, direkt im Browser, ohne Anmeldung. Die Spieltexte sind auf Englisch.",
            ],
            "howto": [
                "Steuere mit den <kbd>Pfeiltasten</kbd> oder <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd>. Auf Handy und Tablet nutzt du das Steuerkreuz oder tippst auf die Seite des Spielfelds, in die du abbiegen willst.",
                "Friss erst die Grundform, dann das Simple Past, dann das Past Participle. Für ein komplettes Verb gibt es Extrapunkte.",
                "Frisst du eine Form in der falschen Reihenfolge, schrumpft deine Schlange.",
                "Fahr nicht gegen die Wand und nicht in dich selbst!",
                "Je mehr Punkte du hast, desto schneller wird die Schlange.",
            ],
            "learn": [
                "Verb Snake holt sich die Verben aus der großen Krabsy-Verbliste – fast alle 172 unregelmäßigen Verben sind dabei, zum Beispiel {go}, {see}, {take}, {give} und {ride}. Weil du die Formen in der richtigen Reihenfolge fressen musst, prägt sich die Reihe Grundform → Simple Past → Past Participle ganz automatisch ein. Zu Beginn liegt nur ein Obststück auf dem Feld, danach wird es mit drei Stücken kniffliger. Deine Bestleistung wird auf deinem Gerät gespeichert.",
            ],
            "verbs": ["go", "see", "take", "give", "ride"],
            "faq": [
                ("Kann ich Verb Snake auf dem Handy spielen?", "Ja. Auf Touch-Geräten erscheint ein Steuerkreuz, oder du tippst einfach auf die Seite des Felds, in die die Schlange abbiegen soll."),
                ("Was passiert bei einer falschen Form?", "Du verlierst Punkte und deine Schlange wird kürzer. Ist sie nur noch ein Kopf, ist das Spiel vorbei."),
                ("Welche Verben kommen vor?", "Fast alle unregelmäßigen Verben aus der Krabsy-Liste – nur sehr lange Formen werden weggelassen, damit sie aufs Spielfeld passen."),
            ],
            "related": ["verb-kitchen", "verb-flow", "air-control"],
        },
        "es": {
            "h1": "Verb Snake: el juego de la serpiente con verbos irregulares",
            "meta": "La serpiente clásica con verbos en inglés: cómete go, went y gone en el orden correcto y practica los verbos irregulares. Gratis en el navegador, sin registro.",
            "lead": [
                "¿Te acuerdas del juego de la serpiente? En Verb Snake mueves una serpiente por el tablero, pero la comida es especial: cada fruta lleva escrita una forma verbal en inglés. Cómetelas <strong>en el orden correcto</strong> – primero <em>go</em>, luego <em>went</em> y al final <em>gone</em> – y tu serpiente crecerá.",
                "Así repasas los <strong>verbos irregulares en inglés</strong> con un clásico de siempre. Gratis, en el navegador y sin registro. Los textos del juego están en inglés.",
            ],
            "howto": [
                "Muévete con las <kbd>flechas</kbd> o con <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd>. En el celular o la tablet usa la cruceta en pantalla o toca el lado del tablero hacia el que quieres girar.",
                "Primero la forma base, después el pasado simple y por último el participio. Completar un verbo da puntos extra.",
                "Si te comes una forma fuera de orden, tu serpiente se encoge.",
                "No choques contra las paredes ni contra tu propia cola.",
                "Cuantos más puntos tienes, más rápido va la serpiente.",
            ],
            "learn": [
                "Verb Snake usa la lista completa de Krabsy: casi todos los 172 verbos irregulares, como {go}, {see}, {take}, {give} o {ride}. Como tienes que comer las formas en orden, la secuencia forma base → pasado simple → participio se te queda grabada sin darte cuenta. Al principio solo hay una fruta en el tablero; después aparecen tres y hay que pensar más rápido. Tu mejor puntuación se guarda en tu dispositivo.",
            ],
            "verbs": ["go", "see", "take", "give", "ride"],
            "faq": [
                ("¿Puedo jugar Verb Snake en el celular?", "Sí. En pantallas táctiles aparece una cruceta, o simplemente tocas el lado del tablero hacia donde quieres que gire la serpiente."),
                ("¿Qué pasa si me como una forma equivocada?", "Pierdes puntos y la serpiente se hace más corta. Si solo le queda la cabeza, se termina la partida."),
                ("¿Qué verbos aparecen?", "Casi todos los verbos irregulares de la lista de Krabsy; solo se dejan fuera las formas muy largas para que quepan en el tablero."),
            ],
            "related": ["verb-kitchen", "verb-flow", "air-control"],
        },
    },
    # ────────────────────────────────────────────────────────────── Verb Flow
    "verb-flow": {
        "de": {
            "h1": "Verb Flow – das Rätsel für unregelmäßige Verben",
            "lead": [
                "Verb Flow ist ein Knobelspiel: Auf einem Raster verteilt stehen englische Verbformen. Du ziehst eine Leitung von der Grundform über das Simple Past bis zum Past Participle – also von <em>go</em> über <em>went</em> zu <em>gone</em>. Klingt einfach? Die Leitungen dürfen sich nicht kreuzen, und die Wörter der anderen Verben stehen dir im Weg.",
                "Ein ruhiges Spiel ohne Zeitdruck, perfekt zum Nachdenken über die <strong>unregelmäßigen Verben</strong>. Kostenlos im Browser, ohne Anmeldung; die kurzen Spieltexte sind auf Englisch.",
            ],
            "howto": [
                "Drücke auf eine Grundform und ziehe mit Maus oder Finger eine Leitung über das Feld.",
                "Verbinde die Formen in der richtigen Reihenfolge: erst die mittlere (Simple Past), dann die letzte (Past Participle).",
                "Leitungen dürfen sich nicht kreuzen und nicht durch fremde Wörter laufen.",
                "Füllst du jedes Kästchen aus, gibt es den „PERFECT FLOW“-Bonus.",
                "Steckst du fest, hilft dir ein Tipp (drei pro Level, sie kosten ein paar Punkte). Mit „Clear board“ fängst du das Level neu an.",
            ],
            "learn": [
                "Die Level werden nach und nach größer: vom 5×5-Feld mit drei Verben bis zum 8×8-Feld mit sechs Verben, und die Verben werden dabei schwieriger. Am Anfang triffst du alte Bekannte wie {go}, {see} oder {think}, später kommen schwierigere Verben wie {catch}, {choose} und sogar {freeze} oder {swing} dazu. Jedes Feld ist so gebaut, dass es eine Lösung gibt, die alle Kästchen füllt. Verlieren kannst du nicht – nur besser werden. Dein Level und dein Punktestand werden gespeichert.",
            ],
            "verbs": ["go", "see", "think", "catch", "choose", "freeze", "swing"],
            "faq": [
                ("Gibt es in Verb Flow ein Zeitlimit?", "Nein. Du kannst in Ruhe überlegen. Es gibt weder Timer noch Leben."),
                ("Wird mein Fortschritt gespeichert?", "Ja, das erreichte Level und dein bester Punktestand werden auf deinem Gerät gespeichert. Mit „Restart at Level 1“ kannst du von vorn beginnen."),
                ("Was bringt mir das Rätsel fürs Englische?", "Du musst für jedes Verb alle drei Formen erkennen und in die richtige Reihenfolge bringen. Genau diese Reihe wird im Unterricht und im Test abgefragt."),
            ],
            "related": ["verb-snake", "verb-dungeon", "verb-kitchen"],
        },
        "es": {
            "h1": "Verb Flow: el rompecabezas de los verbos irregulares",
            "lead": [
                "Verb Flow es un juego de lógica: en una cuadrícula hay formas verbales en inglés repartidas por todas partes. Tienes que trazar una tubería desde la forma base, pasando por el pasado simple, hasta el participio – de <em>go</em> a <em>went</em> y de ahí a <em>gone</em>. ¿Parece fácil? Las tuberías no pueden cruzarse y las palabras de los otros verbos te bloquean el camino.",
                "Es un juego tranquilo, sin reloj, perfecto para pensar con calma en los <strong>verbos irregulares en inglés</strong>. Gratis en el navegador y sin registro; los textos del juego están en inglés.",
            ],
            "howto": [
                "Toca una forma base y arrastra el ratón o el dedo para dibujar la tubería.",
                "Une las formas en orden: primero la del medio (pasado simple) y después la última (participio).",
                "Las tuberías no se pueden cruzar ni pasar por encima de otras palabras.",
                "Si llenas todas las casillas, ganas el bonus «PERFECT FLOW».",
                "¿Te atascaste? Tienes tres pistas por nivel, a cambio de algunos puntos. Con «Clear board» vacías el tablero y vuelves a empezar.",
            ],
            "learn": [
                "Los niveles crecen poco a poco: del tablero de 5×5 con tres verbos al de 8×8 con seis, y los verbos también se vuelven más difíciles. Empiezas con conocidos como {go}, {see} o {think}, y más adelante llegan verbos más difíciles como {catch}, {choose} e incluso {freeze} o {swing}. Cada tablero tiene una solución que llena todas las casillas. Aquí no se pierde, solo se mejora. El juego guarda tu nivel y tu mejor puntuación.",
            ],
            "verbs": ["go", "see", "think", "catch", "choose", "freeze", "swing"],
            "faq": [
                ("¿Verb Flow tiene límite de tiempo?", "No. Puedes pensar con calma: no hay reloj ni vidas."),
                ("¿Se guarda mi progreso?", "Sí, el nivel alcanzado y tu mejor puntuación se guardan en tu dispositivo. Con «Restart at Level 1» vuelves al principio."),
                ("¿Cómo me ayuda con el inglés?", "Para cada verbo tienes que reconocer sus tres formas y ponerlas en orden, que es justo lo que te preguntan en clase y en los exámenes."),
            ],
            "related": ["verb-snake", "verb-dungeon", "verb-kitchen"],
        },
    },
    # ──────────────────────────────────────────────────────── Verb Platformer
    "verb-platformer": {
        "de": {
            "h1": "Verb Platformer – 3D-Jump-’n’-Run mit englischen Verben",
            "lead": [
                "Im Verb Platformer läufst und springst du mit deiner Figur über schwebende Plattformen hoch über den Wolken. Immer wieder kommst du an ein Tor mit einer Verbreihe, zum Beispiel <em>go → ___ → gone</em>. Davor liegen drei rote Plattformen mit verschiedenen Wörtern – aber nur eine trägt dich: die mit der Form, die in die Lücke passt.",
                "Landest du auf der falschen Plattform, bröckelt sie weg, du fällst und siehst sofort die ganze Reihe richtig. Dann versuchst du es direkt vor dem Tor noch einmal. Das Spiel ist kostenlos, läuft im Browser ohne Anmeldung und ist auf Deutsch, Spanisch und Englisch spielbar.",
            ],
            "howto": [
                "Am Computer: Klicke ins Spielbild – dann steuert die Maus die Blickrichtung. Laufen mit <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> oder den Pfeiltasten, springen mit der <kbd>Leertaste</kbd>, Pause mit <kbd>Esc</kbd>.",
                "Auf Tablet und Handy (quer halten): links der Joystick zum Laufen, rechts der Sprung-Knopf, mit dem Finger über das Bild wischen zum Umsehen.",
                "Lies die Verbreihe am Tor und spring auf die Plattform mit dem Wort, das in die Lücke passt.",
                "Erreichst du die Flagge am Ende, ist das Level geschafft. Je weniger Fehler, desto mehr Sterne (bis zu drei pro Level).",
            ],
            "learn": [
                "Geübt werden die <strong>zweite und dritte Form</strong> von rund 150 unregelmäßigen Verben, zum Beispiel {go}, {eat}, {swim}, {fly} und {think}. Erst fragt ein Tor die zweite Form (<em>go → ___</em>), am nächsten Tor folgt die dritte Form desselben Verbs (<em>go → went → ___</em>). Die falschen Plattformen zeigen typische Verwechslungen wie <em>goed</em> oder die andere Vergangenheitsform.",
                "Es gibt sechs Level, die nacheinander schwieriger werden – beim Springen und bei den Verben: vom geraden Weg in <em>First Steps</em> über Kurven, Rampen, fahrende Plattformen, Hämmer und Fließbänder bis zum <em>Sky Finale</em>. Alle Level sind von Anfang an frei wählbar. Sterne und Bestzeiten werden auf deinem Gerät gespeichert, am Ende jedes Levels siehst du die Verben, die du noch üben solltest.",
            ],
            "verbs": ["go", "eat", "swim", "fly", "think"],
            "faq": [
                ("Kann ich den Verb Platformer auf dem Handy oder Tablet spielen?", "Ja. Auf Touch-Geräten erscheinen ein Joystick und ein Sprung-Knopf; das Handy hältst du quer. Am bequemsten ist es am Computer mit Maus und Tastatur oder auf einem Tablet."),
                ("Was passiert, wenn ich auf der falschen Plattform lande?", "Die Plattform zerbröselt, du fällst und siehst die richtige Verbreihe. Danach startest du direkt vor dem Tor neu – ohne Leben oder Zeitdruck. Fehler kosten nur Sterne."),
                ("Welche Verbformen werden geübt?", "Die zweite und die dritte Form (Simple Past und Past Participle), zum Beispiel <em>go → went → gone</em>. Die dritte Form wird immer direkt nach der zweiten Form desselben Verbs gefragt."),
                ("Kann ich mit meiner Klasse ein bestimmtes Level spielen?", "Ja. Alle sechs Level sind sofort auswählbar; die Punkte neben dem Levelnamen zeigen, wie schwer die Verben sind."),
            ],
            "related": ["verb-kitchen", "air-control", "verb-snake"],
        },
        "es": {
            "h1": "Verb Platformer: saltos en 3D con los verbos en inglés",
            "lead": [
                "En Verb Platformer corres y saltas con tu personaje por plataformas que flotan sobre las nubes. De vez en cuando llegas a una puerta con una serie de verbos, por ejemplo <em>go → ___ → gone</em>. Delante hay tres plataformas rojas con palabras distintas, pero solo una te sostiene: la de la forma que completa el hueco.",
                "Si caes en la plataforma equivocada, se desmorona, te caes y ves enseguida la serie completa y correcta. Luego lo intentas otra vez justo delante de la puerta. El juego es gratis, funciona en el navegador sin crear cuenta y se puede jugar en español, alemán e inglés.",
            ],
            "howto": [
                "En la computadora: haz clic en la imagen del juego para mirar alrededor con el ratón. Muévete con <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> o con las flechas, salta con la <kbd>barra espaciadora</kbd> y pausa con <kbd>Esc</kbd>.",
                "En tableta y celular (en horizontal): a la izquierda el joystick para correr, a la derecha el botón de salto; desliza el dedo por la imagen para mirar alrededor.",
                "Lee la serie de verbos de la puerta y salta a la plataforma con la palabra que completa el hueco.",
                "Cuando llegas a la bandera del final, superas el nivel. Cuantos menos errores, más estrellas (hasta tres por nivel).",
            ],
            "learn": [
                "Practicas la <strong>segunda y la tercera forma</strong> de unos 150 verbos irregulares, por ejemplo {go}, {eat}, {swim}, {fly} y {think}. Primero una puerta pregunta la segunda forma (<em>go → ___</em>) y en la siguiente viene la tercera forma del mismo verbo (<em>go → went → ___</em>). Las plataformas falsas muestran confusiones típicas como <em>goed</em> o la otra forma del pasado.",
                "Hay seis niveles que se vuelven más difíciles, tanto en los saltos como en los verbos: desde el camino recto de <em>First Steps</em>, pasando por curvas, rampas, plataformas móviles, martillos y cintas transportadoras, hasta el <em>Sky Finale</em>. Todos los niveles se pueden elegir desde el principio. Las estrellas y los mejores tiempos se guardan en tu dispositivo, y al final de cada nivel ves los verbos que te conviene repasar.",
            ],
            "verbs": ["go", "eat", "swim", "fly", "think"],
            "faq": [
                ("¿Puedo jugar Verb Platformer en el celular o la tableta?", "Sí. En pantallas táctiles aparecen un joystick y un botón de salto; el celular se sostiene en horizontal. Lo más cómodo es la computadora con ratón y teclado, o una tableta."),
                ("¿Qué pasa si salto a la plataforma equivocada?", "La plataforma se rompe, te caes y ves la serie correcta. Después vuelves a aparecer delante de la puerta, sin perder vidas ni tiempo. Los errores solo cuestan estrellas."),
                ("¿Qué formas verbales se practican?", "La segunda y la tercera forma (pasado simple y participio), por ejemplo <em>go → went → gone</em>. La tercera forma se pregunta siempre justo después de la segunda forma del mismo verbo."),
                ("¿Puedo jugar un nivel concreto con mi clase?", "Sí. Los seis niveles se pueden elegir desde el principio; los puntos junto al nombre del nivel indican lo difíciles que son los verbos."),
            ],
            "related": ["verb-kitchen", "air-control", "verb-snake"],
        },
    },
    # ─────────────────────────────────────────────────────────── Verb Kitchen
    "verb-kitchen": {
        "de": {
            "h1": "Verb Kitchen – Kochspiel mit unregelmäßigen Verben",
            "lead": [
                "Willkommen in der Verb Kitchen! In diesem 3D-Kochspiel nimmst du Bestellungen an, schnippelst Zutaten, brätst und backst – und servierst die fertigen Teller durch die Durchreiche. Doch die Teller kommen schmutzig zurück. Sauber werden sie nur mit Englisch: Für <strong>zwei richtige Antworten</strong> an der Spüle bekommst du einen sauberen Teller.",
                "So wird aus Küchenstress ein Training für die <strong>unregelmäßigen Verben</strong>. Das Spiel läuft kostenlos im Browser, die Texte im Spiel sind auf Deutsch.",
            ],
            "howto": [
                "Bewegen mit <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> oder den Pfeiltasten, aufnehmen und ablegen mit <kbd>E</kbd>, schneiden mit gedrückter <kbd>Leertaste</kbd>.",
                "Auf Tablet und Handy tippst du dorthin, wo deine Figur hinlaufen soll, und tippst eine Station an, um sie zu benutzen.",
                "Hol Zutaten aus den Kisten, schneide und koche sie, leg sie auf einen Teller und serviere. Pass auf, dass nichts anbrennt!",
                "An der Spüle beantwortest du Verbfragen mit einem von drei Knöpfen – per Klick oder mit den Tasten <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd>.",
                "Je schneller du alle Bestellungen schaffst, desto mehr Sterne bekommst du.",
            ],
            "learn": [
                "Jeder Teller ist ein Verb: Erst fragt das Spiel nach der zweiten Form (<em>go → ___</em>), dann nach der dritten (<em>go → went → ___</em>). Insgesamt sind 46 Verben dabei – auch Küchenverben wie {cut}, {burn}, {break} und {eat}. Nach einem Fehler siehst du die ganze Reihe, verpasste Verben kommen wieder, und am Ende zeigt dir das Spiel, welche Verben du noch üben solltest. Es gibt acht Level: vom Salat im Garden Bistro mit Tutorial über Burger, Pizza, Suppe und Eisbecher bis zur Sandwich Bar – in zwei Leveln kocht ein Helfer mit.",
            ],
            "verbs": ["cut", "burn", "break", "eat"],
            "faq": [
                ("Brauche ich eine Tastatur?", "Am Computer spielst du mit Tastatur. Auf Tablet und Handy funktioniert Tippen: Die Figur läuft von selbst zum angetippten Ort."),
                ("Kann man in Verb Kitchen verlieren?", "Nein. Bestellungen laufen nicht ab. Die Uhr zählt nur mit, und je schneller du bist, desto mehr Sterne bekommst du."),
                ("Was kann ich mit Sternen freischalten?", "Mit gesammelten Sternen schaltest du neue Spielfiguren frei. Sterne, Bestzeiten und Fortschritt werden auf deinem Gerät gespeichert."),
            ],
            "related": ["verb-towers", "air-control", "verb-flow"],
        },
        "es": {
            "h1": "Verb Kitchen: juego de cocina con verbos irregulares",
            "lead": [
                "¡Bienvenido a Verb Kitchen! En este juego de cocina en 3D recibes pedidos, cortas ingredientes, cocinas en la estufa o en el horno y sirves los platos por la ventanilla. Pero los platos vuelven sucios, y solo se limpian con inglés: cada <strong>dos respuestas correctas</strong> en el fregadero te dan un plato limpio.",
                "Así el caos de la cocina se convierte en práctica de los <strong>verbos irregulares en inglés</strong>. Se juega gratis en el navegador y los textos del juego están en español.",
            ],
            "howto": [
                "Muévete con <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> o con las flechas, toma y deja cosas con <kbd>E</kbd> y corta manteniendo pulsada la <kbd>barra espaciadora</kbd>.",
                "En tablet o celular tocas el lugar al que quieres ir y tocas una estación para usarla.",
                "Saca ingredientes de las cajas, córtalos y cocínalos, ponlos en un plato y sírvelo. ¡Que no se queme nada!",
                "En el fregadero respondes preguntas de verbos con uno de tres botones: con un clic o con las teclas <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd>.",
                "Cuanto más rápido entregues todos los pedidos, más estrellas consigues.",
            ],
            "learn": [
                "Cada plato es un verbo: primero el juego te pide la segunda forma (<em>go → ___</em>) y luego la tercera (<em>go → went → ___</em>). Hay 46 verbos, entre ellos verbos de cocina como {cut}, {burn}, {break} y {eat}. Si fallas, ves la secuencia completa; los verbos que fallaste vuelven a salir y al final el juego te muestra cuáles debes repasar. Hay ocho niveles: desde la ensalada del Garden Bistro, con tutorial, pasando por hamburguesas, pizza, sopa y copas de helado, hasta el Sandwich Bar; en dos niveles cocinas con un ayudante.",
            ],
            "verbs": ["cut", "burn", "break", "eat"],
            "faq": [
                ("¿Necesito teclado?", "En la computadora se juega con teclado. En tablet y celular basta con tocar la pantalla: tu cocinero camina solo hasta el lugar que tocaste."),
                ("¿Se puede perder en Verb Kitchen?", "No. Los pedidos no caducan. El reloj solo mide tu tiempo, y si eres rápido ganas más estrellas."),
                ("¿Para qué sirven las estrellas?", "Con las estrellas desbloqueas nuevos personajes. Tus estrellas, mejores tiempos y progreso se guardan en tu dispositivo."),
            ],
            "related": ["verb-towers", "air-control", "verb-flow"],
        },
    },
    "verb-towers": {
        "de": {
            "h1": "Verb Towers – Tower Defense mit unregelmäßigen Verben",
            "lead": [
                "In Verb Towers verteidigst du deine Burg gegen Wellen von Skelett-Kriegern. Baue Bogentürme, Katapulte, Kanonen und Frosttürme an den Weg – aber Münzen gibt es nur in der <strong>Schmiede</strong>: Jede richtige Antwort auf eine Verbfrage bringt dir Münzen für neue Türme.",
                "So trainierst du die <strong>unregelmäßigen Verben</strong> ganz nebenbei, während du deine Verteidigung planst. Das Spiel läuft kostenlos im Browser, ohne Download und ohne Anmeldung.",
            ],
            "howto": [
                "Wähle ein Feld neben dem Weg und einen Turm aus der Leiste unten – oder zuerst den Turm (Tasten <kbd>1</kbd>–<kbd>4</kbd>) und dann das Feld.",
                "In der Schmiede rechts beantwortest du Verbfragen per Klick oder mit <kbd>Q</kbd> <kbd>W</kbd> <kbd>E</kbd>. Richtig = Münzen, eine Serie bringt einen Bonus.",
                "Mit <kbd>Leertaste</kbd> oder „Welle starten“ geht es los. Tippe einen Turm an, um ihn auszubauen oder zu verkaufen.",
                "Auf Tablet und Handy spielst du mit Tippen; auf dem Handy am besten im Querformat.",
                "Kommt kein Gegner bis zur Burg durch, bekommst du drei Sterne – und Sterne schalten neue Level frei.",
            ],
            "learn": [
                "Die Schmiede fragt die zweite und dritte Form, zum Beispiel <em>go → ___</em> und gleich danach <em>go → went → ___</em> – ohne Grammatik-Fachbegriffe. Nach einem Fehler siehst du die ganze Reihe, und verpasste Verben kommen kurz darauf wieder, etwa {think}, {bring} oder {catch}. Es gibt sechs Level von der Wiese bis zum Winterpass, mit Herbst, Seen und Schnee.",
            ],
            "verbs": ["think", "bring", "catch"],
            "faq": [
                ("Kann ich Verb Towers ohne Antworten gewinnen?", "Nein. Gegner bringen kaum Münzen – fast alles Geld kommt aus der Schmiede. Wer die Verben kann, baut die stärkere Verteidigung."),
                ("Läuft das Spiel auf dem Handy?", "Ja, mit Tippen. Am besten hältst du das Handy quer; auf Tablet, Chromebook und Computer ist das Spielfeld größer."),
                ("Wird mein Fortschritt gespeichert?", "Ja, Sterne, Bestwerte und freigeschaltete Level werden nur auf deinem Gerät gespeichert. Es gibt kein Konto."),
            ],
            "related": ["verb-kitchen", "air-control", "verb-snake"],
        },
        "es": {
            "h1": "Verb Towers: tower defense con verbos irregulares",
            "lead": [
                "En Verb Towers defiendes tu castillo de oleadas de guerreros esqueleto. Construye torres de arqueros, catapultas, cañones y torres de hielo junto al camino, pero las monedas solo salen de la <strong>forja</strong>: cada respuesta correcta a una pregunta de verbos te da monedas para nuevas torres.",
                "Así practicas los <strong>verbos irregulares en inglés</strong> mientras planeas tu defensa. Se juega gratis en el navegador, sin descargas y sin registro.",
            ],
            "howto": [
                "Elige una casilla junto al camino y una torre de la barra de abajo, o primero la torre (teclas <kbd>1</kbd>–<kbd>4</kbd>) y luego la casilla.",
                "En la forja, a la derecha, respondes preguntas de verbos con un clic o con <kbd>Q</kbd> <kbd>W</kbd> <kbd>E</kbd>. Respuesta correcta = monedas; una racha da un bonus.",
                "Con la <kbd>barra espaciadora</kbd> o «Iniciar oleada» empieza el ataque. Toca una torre para mejorarla o venderla.",
                "En tablet y celular se juega tocando la pantalla; en el celular, mejor en horizontal.",
                "Si ningún enemigo llega al castillo, consigues tres estrellas, y las estrellas desbloquean nuevos niveles.",
            ],
            "learn": [
                "La forja pregunta la segunda y la tercera forma, por ejemplo <em>go → ___</em> y justo después <em>go → went → ___</em>, sin términos gramaticales. Si fallas, ves la secuencia completa, y los verbos que fallaste vuelven poco después, como {think}, {bring} o {catch}. Hay seis niveles, de la pradera al paso de invierno, con otoño, lagos y nieve.",
            ],
            "verbs": ["think", "bring", "catch"],
            "faq": [
                ("¿Se puede ganar Verb Towers sin responder?", "No. Los enemigos casi no dan monedas: casi todo el dinero sale de la forja. Quien sabe los verbos construye la mejor defensa."),
                ("¿Funciona en el celular?", "Sí, tocando la pantalla. Lo mejor es poner el celular en horizontal; en tablet, Chromebook o computadora el tablero se ve más grande."),
                ("¿Se guarda mi progreso?", "Sí. Las estrellas, los récords y los niveles desbloqueados se guardan solo en tu dispositivo. No hace falta cuenta."),
            ],
            "related": ["verb-kitchen", "air-control", "verb-snake"],
        },
    },
    # ─────────────────────────────────────────────────────────── Quiz-Raum
    "quiz-room": {
        "de": {
            "h1": "Quiz-Raum – das Live-Quiz für die ganze Klasse",
            "meta": "Live-Quiz für die Englischstunde: Jedes Kind spielt am eigenen Gerät als Figur in einem 3D-Raum und beantwortet Fragen zu unregelmäßigen Verben und Präpositionen. Kostenlos, ohne Konto.",
            "lead": [
                "Im Quiz-Raum spielt die ganze Klasse gleichzeitig. Jedes Kind öffnet den Raum am eigenen Gerät, gibt den <strong>Raum-Code</strong> und seinen Vornamen ein und läuft als kleine Figur durch einen bunten 3D-Raum. Die Fragen kommen auf einer privaten Antwortkarte – wer geantwortet hat, darf bis zur Auflösung herumlaufen, Trampolin springen, rutschen und Bälle in den Korb werfen.",
                'Die Lehrkraft spielt nicht mit, sie leitet den Raum: <a href="/games/quiz-room/teacher.html?lang=de"><strong>Quiz-Raum öffnen</strong></a>, Thema und Schwierigkeit wählen, die Fragen ansehen und tauschen, starten. Kostenlos im Browser, ohne Konto und ohne Download.',
            ],
            "howto": [
                "Lehrkraft: Öffnen Sie den <a href=\"/games/quiz-room/teacher.html?lang=de\">Quiz-Raum</a>, wählen Sie Thema, Schwierigkeit, Anzahl der Fragen und die Zeit pro Frage. Die Fragenliste lässt sich vorher durchsehen: Fragen entfernen, tauschen oder neue dazunehmen.",
                "Kinder: <strong>krabsy.com/quiz</strong> öffnen oder den QR-Code scannen, den Code und den Vornamen eingeben, eine Figur und eine Farbe wählen – schon steht man im Raum.",
                "Laufen mit <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> oder den Pfeiltasten, <kbd>Umschalt</kbd> zum Rennen, <kbd>Leertaste</kbd> zum Springen. Auf Tablets erscheinen ein Joystick und ein Sprung-Knopf.",
                "Zu jeder Frage gibt es vier Antworten (Klick oder Tasten <kbd>1</kbd>–<kbd>4</kbd>). Schnelle richtige Antworten bringen mehr Punkte. Über dem Kopf zeigt ein Punkt, <em>dass</em> jemand geantwortet hat – nie, <em>was</em>.",
                "Nach jeder Frage sehen alle die Lösung und die Top 5. Zum Schluss gibt es optional eine Bonusrunde: Die Antworten liegen auf vier Feldern am Boden, und alle rennen zum richtigen Feld.",
            ],
            "learn": [
                "Geübt werden die <strong>unregelmäßigen Verben</strong> und die <strong>Präpositionen</strong>, jeweils in drei Schwierigkeitsstufen. Bei den Verben fragt das Quiz erst die zweite Form (<em>go → ___</em>) und gleich danach die dritte (<em>go → went → ___</em>), zum Beispiel bei {go}, {think} oder {bring} – ohne Grammatik-Fachbegriffe. Präpositionen kommen als Lückensatz wie <em>My birthday is ___ July.</em>",
                "Nach jeder Frage zeigt der Raum die ganze Verbreihe oder die Regel zur Präposition. Am Ende sieht die Lehrkraft, welche Wörter die Klasse am häufigsten falsch hatte.",
            ],
            "verbs": ["go", "think", "bring"],
            "faq": [
                ("Brauchen die Kinder ein Konto?", "Nein. Die Kinder geben nur den Raum-Code und einen Vornamen ein. Namen und Punkte gibt es nur, solange der Raum offen ist; danach wird nichts gespeichert."),
                ("Wie viele Kinder können mitspielen?", "Bis zu 40 Kinder pro Raum, jedes an seinem eigenen Gerät: Chromebook, Laptop, Tablet oder Handy."),
                ("Kann ich die Fragen selbst auswählen?", "Ja. Vor dem Start sehen Sie alle Fragen und können einzelne entfernen, gegen andere tauschen oder neue hinzufügen. Beim Projektor-Bild sind die Antworten verdeckt."),
                ("Was passiert, wenn ein Kind die Verbindung verliert?", "Es kommt automatisch zurück und behält Namen und Punkte. Die Lehrkraft kann Namen ändern, Kinder entfernen und den Raum sperren."),
            ],
            "related": ["verb-towers", "verb-kitchen", "verb-snake"],
        },
        "es": {
            "h1": "Sala de quiz: el quiz en vivo para toda la clase",
            "meta": "Quiz en vivo para la clase de inglés: cada alumno juega en su propio dispositivo con un personaje en una sala 3D y responde preguntas de verbos irregulares y preposiciones. Gratis y sin cuenta.",
            "lead": [
                "En la sala de quiz juega toda la clase a la vez. Cada alumno abre la sala en su propio dispositivo, escribe el <strong>código de la sala</strong> y su nombre, y recorre una sala 3D llena de color con su personaje. Las preguntas llegan en una tarjeta privada; quien ya respondió puede pasear, saltar en la cama elástica, tirarse por el tobogán y encestar pelotas hasta que se muestra la respuesta.",
                'El docente no juega: dirige la sala. <a href="/games/quiz-room/teacher.html?lang=es"><strong>Abre una sala de quiz</strong></a>, elige el tema y la dificultad, revisa y cambia las preguntas y empieza. Gratis en el navegador, sin cuenta y sin descargas.',
            ],
            "howto": [
                "Docente: abre la <a href=\"/games/quiz-room/teacher.html?lang=es\">sala de quiz</a> y elige el tema, la dificultad, el número de preguntas y el tiempo por pregunta. Antes de empezar puedes ver la lista: quitar preguntas, cambiarlas o añadir más.",
                "Alumnos: abren <strong>krabsy.com/quiz</strong> o escanean el código QR, escriben el código y su nombre, eligen personaje y color, y ya están en la sala.",
                "Se camina con <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> o las flechas, <kbd>Mayús</kbd> para correr y la <kbd>barra espaciadora</kbd> para saltar. En tablets aparecen un joystick y un botón de salto.",
                "Cada pregunta tiene cuatro respuestas (clic o teclas <kbd>1</kbd>–<kbd>4</kbd>). Las respuestas correctas y rápidas dan más puntos. Un punto sobre la cabeza muestra <em>que</em> alguien respondió, nunca <em>qué</em>.",
                "Después de cada pregunta todos ven la solución y el top 5. Al final hay una ronda extra opcional: las respuestas están en cuatro casillas del suelo y todos corren a la correcta.",
            ],
            "learn": [
                "Se practican los <strong>verbos irregulares</strong> y las <strong>preposiciones</strong>, cada uno en tres niveles. Con los verbos, el quiz pregunta primero la segunda forma (<em>go → ___</em>) y justo después la tercera (<em>go → went → ___</em>), por ejemplo con {go}, {think} o {bring}, sin términos gramaticales. Las preposiciones aparecen en frases con hueco como <em>My birthday is ___ July.</em>",
                "Después de cada pregunta la sala muestra la serie completa del verbo o la regla de la preposición. Al final, el docente ve qué palabras falló más la clase.",
            ],
            "verbs": ["go", "think", "bring"],
            "faq": [
                ("¿Los alumnos necesitan una cuenta?", "No. Solo escriben el código de la sala y un nombre. Los nombres y los puntos existen solo mientras la sala está abierta; después no se guarda nada."),
                ("¿Cuántos alumnos pueden jugar?", "Hasta 40 por sala, cada uno en su propio dispositivo: Chromebook, portátil, tablet o celular."),
                ("¿Puedo elegir las preguntas?", "Sí. Antes de empezar ves todas las preguntas y puedes quitar algunas, cambiarlas por otras o añadir nuevas. En la imagen del proyector las respuestas están ocultas."),
                ("¿Qué pasa si un alumno pierde la conexión?", "Vuelve solo y conserva su nombre y sus puntos. El docente puede cambiar nombres, sacar a alguien de la sala y cerrar la sala a nuevos jugadores."),
            ],
            "related": ["verb-towers", "verb-kitchen", "verb-snake"],
        },
    },
    # ─────────────────────────────────────────────────────────── Verb Dungeon
    "verb-dungeon": {
        "de": {
            "h1": "Verb Dungeon – Abenteuer im Verlies mit unregelmäßigen Verben",
            "meta": "Ein 3D-Dungeon-Abenteuer mit englischen Verben: Finde den versteckten Schlüssel, lies das Verb-Buch an der Tür und besiege drei verschiedene Bosse. Kostenlos im Browser, ohne Anmeldung.",
            "lead": [
                "In Verb Dungeon läuft dein kleiner Held mit Schwert durch ein Verlies voller Fackeln, Fässer und frecher Skelette. In jedem Raum ist die Tür verschlossen. Den Schlüssel musst du erst finden – er steckt in einem Fass, einer Kiste oder bei einem Skelett. Aufschließen kannst du nur mit Englisch: Neben der Tür liegt ein Verb-Buch in einem leuchtenden Runenkreis, und mit <strong>zwei richtigen Verbformen</strong> geht die Tür auf.",
                "Das ist ein bisschen gruselig, aber nie zum Fürchten: Umgehauene Skelette fallen zu einem ordentlichen Knochenhaufen zusammen und stehen etwas verlegen wieder auf. Das Spiel läuft kostenlos im Browser, ohne Download und ohne Anmeldung. Die Texte im Spiel sind auf Deutsch, nur die Verben bleiben Englisch.",
            ],
            "howto": [
                "Am Computer läufst du mit <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> oder den Pfeiltasten. Die <kbd>Leertaste</kbd> haut, zerschlägt Kisten und Fässer und öffnet Truhen und das Verb-Buch. Auf Tablet und Handy erscheinen ein Joystick (Daumen links aufs Bild legen und schieben) und ein Schwert-Knopf rechts unten, der dasselbe macht.",
                "Alles, was du benutzen kannst, hat einen leuchtenden Ring am Boden. Zerschlag Fässer und Kisten oder hau die Skelette um, bis der Schlüssel herausfällt, und lauf darüber.",
                "Mit dem Schlüssel gehst du zum Verb-Buch neben der Tür – in seinen Runenkreis kommen keine Skelette und keine Pfeile. Drück die <kbd>Leertaste</kbd> oder den Schwert-Knopf, dann erscheint eine Frage wie <em>go → ___ → ___</em>. Antworte mit einem Klick, durch Antippen oder mit den Tasten <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd>. Eine Frage kommt nur, wenn du sie aufrufst, und solange sie offen ist, steht das ganze Verlies still.",
                "Manche Räume haben eigene Rätsel: zwei Wände mit Runentüren hintereinander (nur die Tür mit dem richtigen Wort geht auf), eine Wortbrücke, auf der nur die Steine mit der richtigen Form halten, oder einen Hinterhalt, bei dem die Tür hinter dir zufällt.",
                "Am Ende jedes Levels wartet ein anderer Boss: ein großer Golem, ein Nekromant, der immer neue Skelette ruft, und ein Skelett-Magier mit Zauberkugeln. Stell dich auf den leuchtenden Stein, drück die <kbd>Leertaste</kbd> und beantworte die Frage – dann ist der Boss kurz schwindelig, und du kannst ihn hauen.",
            ],
            "learn": [
                "Geübt werden die <strong>zweite und dritte Form</strong> der unregelmäßigen Verben, zum Beispiel {go}, {see}, {fly}, {find} und {drive}. Erst fragt das Spiel die zweite Form (<em>go → ___</em>), gleich danach die dritte mit der zweiten schon eingetragen (<em>go → went → ___</em>) – ohne Grammatik-Fachbegriffe. Nach einem Fehler siehst du die Reihe, und das verpasste Verb kommt an einer späteren Tür noch einmal dran.",
                "Es gibt drei Level mit fünf bis sechs Räumen, von leichten Verben in Level 1 bis zu schwierigeren in Level 3. Wer alles beim ersten Versuch richtig hat, bekommt drei Sterne. Mit Münzen aus Truhen, der Schatzkammer und von den Bossen schaltest du neue Helden frei: Barbar, Schurke und Magier.",
            ],
            "verbs": ["go", "see", "fly", "find", "drive"],
            "faq": [
                ("Kann ich Verb Dungeon auf dem Handy oder Tablet spielen?", "Ja. Auf Touch-Geräten erscheinen ein Joystick zum Laufen und ein Schwert-Knopf zum Hauen und Öffnen; Antworten tippst du einfach an. Das Handy hältst du quer. Am bequemsten ist es auf einem Tablet oder am Computer mit Tastatur."),
                ("Ist das Spiel gruselig?", "Nur ein bisschen. Es gibt Fackeln, Skelette und drei alberne Bosse, aber kein Blut und nichts zum Fürchten. Wer alle Herzen verliert, ist kurz schwindelig und startet den Raum neu – was du schon geschafft hast, bleibt."),
                ("Wird mein Fortschritt gespeichert?", "Ja. Sterne, Münzen und freigeschaltete Helden werden nur auf deinem Gerät gespeichert. Es gibt kein Konto."),
            ],
            "related": ["verb-kitchen", "verb-towers", "verb-snake"],
        },
        "es": {
            "h1": "Verb Dungeon: aventura en la mazmorra con verbos irregulares",
            "meta": "Una aventura en 3D con verbos en inglés: encuentra la llave escondida, lee el libro de verbos junto a la puerta y vence a tres jefes distintos. Gratis en el navegador, sin registro.",
            "lead": [
                "En Verb Dungeon tu pequeño héroe con espada recorre una mazmorra llena de antorchas, barriles y esqueletos traviesos. En cada sala la puerta está cerrada con llave, y primero tienes que encontrarla: está escondida en un barril, una caja o la lleva un esqueleto. Para abrir la puerta necesitas inglés: junto a ella hay un libro de verbos en un círculo de runas brillante, y con <strong>dos formas verbales correctas</strong> la puerta se abre.",
                "Da un poquito de miedo, pero nada de terror: los esqueletos que derribas se desarman en un montoncito de huesos y se levantan otra vez, algo avergonzados. Se juega gratis en el navegador, sin descargas y sin registro. Los textos del juego están en español; solo los verbos siguen en inglés.",
            ],
            "howto": [
                "En la computadora te mueves con <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> o con las flechas. La <kbd>barra espaciadora</kbd> golpea, rompe cajas y barriles y abre cofres y el libro de verbos. En tableta y celular aparecen un joystick (apoya el pulgar a la izquierda de la pantalla y deslízalo) y un botón de espada abajo a la derecha que hace lo mismo.",
                "Todo lo que puedes usar tiene un anillo brillante en el suelo. Rompe barriles y cajas o derriba a los esqueletos hasta que aparezca la llave, y pasa por encima de ella.",
                "Con la llave vas al libro de verbos junto a la puerta: en su círculo de runas no entran esqueletos ni flechas. Pulsa la <kbd>barra espaciadora</kbd> o el botón de espada y aparece una pregunta como <em>go → ___ → ___</em>. Responde con un clic, tocando la respuesta o con las teclas <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd>. Una pregunta solo aparece cuando tú la abres, y mientras está abierta, toda la mazmorra se queda quieta.",
                "Algunas salas tienen su propio reto: dos paredes con puertas de runas, una detrás de otra (solo se abre la puerta con la palabra correcta), un puente de palabras donde solo aguantan las piedras con la forma correcta, o una emboscada en la que la puerta se cierra detrás de ti.",
                "Al final de cada nivel te espera un jefe distinto: un gólem enorme, un nigromante que no para de levantar esqueletos y un mago esqueleto con bolas mágicas. Párate sobre la piedra brillante, pulsa la <kbd>barra espaciadora</kbd> y responde la pregunta: el jefe se marea un momento y puedes golpearlo.",
            ],
            "learn": [
                "Practicas la <strong>segunda y la tercera forma</strong> de los verbos irregulares, por ejemplo {go}, {see}, {fly}, {find} y {drive}. Primero el juego pregunta la segunda forma (<em>go → ___</em>) y justo después la tercera, con la segunda ya escrita (<em>go → went → ___</em>), sin términos gramaticales. Si fallas, ves la secuencia y el verbo vuelve a salir en una puerta más adelante.",
                "Hay tres niveles con cinco o seis salas, desde verbos fáciles en el nivel 1 hasta otros más difíciles en el nivel 3. Si aciertas todo al primer intento, consigues tres estrellas. Con las monedas de los cofres, la sala del tesoro y los jefes desbloqueas nuevos héroes: bárbaro, pícaro y mago.",
            ],
            "verbs": ["go", "see", "fly", "find", "drive"],
            "faq": [
                ("¿Puedo jugar Verb Dungeon en el celular o la tablet?", "Sí. En pantallas táctiles aparecen un joystick para moverte y un botón de espada para golpear y abrir; las respuestas solo se tocan. El celular se sostiene en horizontal. Lo más cómodo es una tableta o la computadora con teclado."),
                ("¿Da miedo el juego?", "Solo un poquito. Hay antorchas, esqueletos y tres jefes muy tontos, pero nada de sangre ni de terror. Si pierdes todos los corazones, te mareas un momento y la sala empieza de nuevo; lo que ya lograste se queda."),
                ("¿Se guarda mi progreso?", "Sí. Las estrellas, las monedas y los héroes desbloqueados se guardan solo en tu dispositivo. No hace falta cuenta."),
            ],
            "related": ["verb-kitchen", "verb-towers", "verb-snake"],
        },
    },
}

# Short JSON-LD helpers per game (genre is language-neutral enough to share).
GENRE = {
    "verb-slash": ["Arcade", "Educational"],
    "crab-slash": ["Arcade", "Educational"],
    "air-control": ["Strategy", "Educational"],
    "verb-snake": ["Arcade", "Educational"],
    "verb-flow": ["Puzzle", "Educational"],
    "verb-platformer": ["Platformer", "Educational"],
    "verb-kitchen": ["Simulation", "Educational"],
    "verb-towers": ["Strategy", "Educational"],
    "verb-dungeon": ["Adventure", "Educational"],
    "quiz-room": ["Trivia", "Educational"],
    "verb-hatchery": ["Adventure", "Educational"],
}

# Multiplayer games (JSON-LD "playMode"; default SinglePlayer).
PLAYMODE = {"quiz-room": "MultiPlayer"}

# What each game asks for (JSON-LD "teaches").
TEACHES = {
    "de": {
        "default": "Unregelmäßige englische Verben: Grundform, Simple Past und Past Participle",
        "verb-platformer": "Unregelmäßige englische Verben: Simple Past und Past Participle",
        "verb-kitchen": "Unregelmäßige englische Verben: Simple Past und Past Participle",
        "verb-towers": "Unregelmäßige englische Verben: Simple Past und Past Participle",
        "verb-dungeon": "Unregelmäßige englische Verben: Simple Past und Past Participle",
        "quiz-room": "Unregelmäßige englische Verben und englische Präpositionen",
        "crab-slash": "Unregelmäßige englische Verben: Simple Past und Past Participle",
    },
    "es": {
        "default": "Verbos irregulares en inglés: forma base, pasado simple y participio pasado",
        "verb-platformer": "Verbos irregulares en inglés: pasado simple y participio pasado",
        "verb-kitchen": "Verbos irregulares en inglés: pasado simple y participio pasado",
        "verb-towers": "Verbos irregulares en inglés: pasado simple y participio pasado",
        "verb-dungeon": "Verbos irregulares en inglés: pasado simple y participio pasado",
        "quiz-room": "Verbos irregulares y preposiciones en inglés",
        "crab-slash": "Verbos irregulares en inglés: pasado simple y participio pasado",
    },
}


# ── Teacher notes ("Im Unterricht einsetzen" / "En clase"), rendered after
#    "what you learn" by render_game_info.py. Only games listed here get the block.
TEACHER = {
    "quiz-room": {
        "de": [
            "Für Klassen, in denen jedes Kind ein Gerät hat (Chromebook, Laptop, Tablet). Ein Beamer ist hilfreich, aber nicht nötig.",
            "Ein Quiz mit 10 Fragen dauert etwa 10 Minuten. Wer schon geantwortet hat, darf im Raum spielen; mit „Alle in die Mitte“ holen Sie alle zurück.",
            "Die Antworten zählen in die Lernstatistik jedes Kindes auf seinem Gerät und, wenn die Kinder Ihrer <a href=\"/de/lehrkraefte/\">Krabsy-Klasse</a> beigetreten sind, ins Klassen-Dashboard.",
        ],
        "es": [
            "Para clases en las que cada alumno tiene un dispositivo (Chromebook, portátil, tablet). Un proyector ayuda, pero no hace falta.",
            "Un quiz de 10 preguntas dura unos 10 minutos. Quien ya respondió puede jugar en la sala; con «Todos al centro» los traes de vuelta.",
            "Las respuestas cuentan en las estadísticas de cada alumno en su dispositivo y, si tus alumnos se unieron a tu <a href=\"/es/docentes/\">clase de Krabsy</a>, en el panel de la clase.",
        ],
    },
    "verb-towers": {
        "de": [
            "Läuft auf Handy, Tablet und PC, ohne Konto. Sie teilen einfach den Link.",
            "Münzen gibt es nur für richtige Antworten: Wer genau arbeitet, baut mehr Türme. So zahlt sich Sorgfalt sichtbar aus.",
            "Idee: als Belohnung nach einer Übungsphase oder als Hausaufgabe mit einem gemeinsamen Ziel, etwa einer bestimmten Welle.",
        ],
        "es": [
            "Funciona en móvil, tablet y ordenador, sin cuenta. Solo tienes que compartir el enlace.",
            "Las monedas solo se ganan con respuestas correctas: quien trabaja con cuidado construye más torres.",
            "Idea: como premio después de una fase de práctica o como tarea con un objetivo común, por ejemplo llegar a cierta oleada.",
        ],
    },
    "verb-kitchen": {
        "de": [
            "3D-Spiel für Handy, Tablet und PC, ohne Konto. Ein Level dauert einige Minuten.",
            "Die Verbfragen kommen an der Spüle: Ohne richtige Antworten gibt es keine sauberen Teller. So wiederholen die Lernenden viele Formen, ohne dass es sich wie Üben anfühlt.",
            "Idee: zum Abschluss einer Grammatikeinheit 10 bis 15 Minuten spielen und danach die Verben besprechen, die besonders oft falsch waren.",
        ],
        "es": [
            "Juego en 3D para móvil, tablet y ordenador, sin cuenta. Cada nivel dura unos minutos.",
            "Las preguntas de verbos llegan en el fregadero: sin respuestas correctas no hay platos limpios. Así el alumnado repasa muchas formas sin sentir que está estudiando.",
            "Idea: al final de una unidad de gramática, jugar 10 o 15 minutos y después comentar los verbos que más se fallaron.",
        ],
    },
    "verb-platformer": {
        "de": [
            "Am besten am PC oder Laptop mit Tastatur.",
            "Jedes Tor zeigt eine Verbreihe mit Lücke. Ein Fehler kostet keinen Neustart: Die richtige Reihe erscheint sofort, dann geht es weiter.",
            "Idee: am Whiteboard gemeinsam spielen, die Klasse ruft, auf welche Plattform gesprungen wird.",
        ],
        "es": [
            "Mejor en ordenador o portátil con teclado.",
            "Cada puerta muestra una serie de verbos con un hueco. Un error no obliga a empezar de nuevo: aparece la serie correcta y se sigue jugando.",
            "Idea: jugar juntos en la pizarra digital; la clase dice en qué plataforma hay que saltar.",
        ],
    },
    "verb-snake": {
        "de": [
            "Kurze Runden auf Handy, Tablet oder PC, ohne Konto.",
            "Mit jedem Bissen kommt die Reihenfolge Grundform, zweite, dritte Form: Das festigt die drei Formen als Einheit.",
            "Idee: ein Highscore-Wettbewerb in der Klasse über eine Woche.",
        ],
        "es": [
            "Rondas cortas en móvil, tablet u ordenador, sin cuenta.",
            "Con cada bocado se repite el orden de las tres formas: así se aprenden como una unidad.",
            "Idea: un concurso de récords en la clase durante una semana.",
        ],
    },
    "verb-slash": {
        "de": [
            "Kurze Runden, mit Finger oder Maus.",
            "Die falschen Bälle tragen typische Fehlerformen wie <em>goed</em> oder <em>writed</em>: genau die Fehler, die in Tests vorkommen.",
            "Idee: als Warm-up spielen und danach die Fehlerformen an der Tafel sammeln.",
        ],
        "es": [
            "Rondas cortas, con el dedo o el ratón.",
            "Las pelotas falsas llevan errores típicos como <em>goed</em> o <em>writed</em>: justo los que aparecen en los exámenes.",
            "Idea: jugar como calentamiento y después reunir esos errores en la pizarra.",
        ],
    },
    "air-control": {
        "de": [
            "Am besten am PC oder Laptop: Das Spiel braucht etwas Platz und Übersicht.",
            "Die drei Formen eines Verbs müssen zusammen gefunden werden. Das übt das Denken in ganzen Verbreihen.",
            "Idee: in Partnerarbeit spielen, eine Person sucht die Formen, die andere lotst die Flugzeuge.",
        ],
        "es": [
            "Mejor en ordenador o portátil: el juego necesita algo de espacio y visión de conjunto.",
            "Hay que encontrar juntas las tres formas de un verbo. Así se practica pensar en series completas.",
            "Idea: jugar por parejas; una persona busca las formas y la otra guía los aviones.",
        ],
    },
    "verb-flow": {
        "de": [
            "Ohne Zeitdruck, auf allen Geräten.",
            "Wer die Leitung legt, muss die Reihenfolge der Formen kennen. Gut für Lernende, die bei Zeitdruck nervös werden.",
            "Idee: als ruhige Station beim Stationenlernen.",
        ],
        "es": [
            "Sin presión de tiempo, en cualquier dispositivo.",
            "Para trazar la línea hay que saber el orden de las formas. Ideal para quien se pone nervioso con el reloj.",
            "Idea: como estación tranquila en un trabajo por rincones.",
        ],
    },
}


# ── English interface = the Spanish section for English speakers (/en/spanish/games/<id>/,
#    2026-11-24). Added to CONTENT below; facts checked against the games' sentence-topic mode.
EN_SPANISH = {
    "verb-kitchen": {
        "h1": "Verb Kitchen: a Spanish cooking game",
        "lead": [
            "Welcome to Verb Kitchen! In this 3D cooking game you take orders, chop ingredients, fry and bake, and serve the dishes through the hatch. But the plates come back dirty, and they only get clean with Spanish: <strong>two right answers</strong> at the sink wash one plate.",
            "That turns kitchen chaos into Spanish practice. The game is free in the browser, with English menus and Spanish sentences.",
        ],
        "howto": [
            "Move with <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> or the arrow keys, pick up and put down with <kbd>E</kbd>, chop by holding <kbd>Space</kbd>.",
            "On a tablet or phone, tap where your chef should go and tap a station to use it.",
            "Take ingredients from the crates, chop and cook them, put them on a plate and serve. Don't let anything burn!",
            "At the sink you answer Spanish sentences with one of three buttons: click them or press <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd>.",
            "The faster you finish all orders, the more stars you get.",
        ],
        "learn": [
            "Each plate asks two Spanish sentences with a gap, usually of the same kind: <em lang=\"es\">Yo ___ de Londres.</em> After a mistake you see the whole sentence and a short rule in English. Sentences you missed come back a few plates later and land in the <strong>Sentence Cookbook</strong>, so the sink asks them first next time. There are eight kitchens, from a salad bistro with a tutorial to burgers, pizza, soup, ice cream and a sandwich bar.",
        ],
        "faq": [
            ("Do I need a keyboard?", "On a computer you play with the keyboard. On tablets and phones tapping works: your chef walks to the place you tap."),
            ("Can I lose in Verb Kitchen?", "No. Orders never run out. The clock only measures your time, and faster cooks get more stars."),
            ("What is the Sentence Cookbook?", "It lists the Spanish sentences of the topic. The ones you missed are at the top, and the sink asks them first in your next round."),
        ],
        "related": ["verb-platformer", "verb-towers"],
        "meta": "A 3D cooking game for Spanish: cook, serve and wash the dirty plates by answering Spanish sentences. Free in the browser, no sign-up.",
    },
    "verb-platformer": {
        "h1": "Verb Platformer: a Spanish jump-and-run",
        "lead": [
            "Jump across floating islands high above the clouds. On the way to the flag you reach <strong>answer gates</strong>: a Spanish sentence with a gap floats above three red blocks, each with a word. Land on the right one. The wrong blocks crumble and fall!",
            "The game is free in the browser, with English menus and Spanish sentences.",
        ],
        "howto": [
            "Run with <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> or the arrow keys, jump with <kbd>Space</kbd> and look around with the mouse. On a tablet: the stick and the jump button.",
            "Read the sentence on the orange sign, then jump on the block with the missing word.",
            "Wrong block? You fall into the clouds, see the right sentence and why, and try again from the last checkpoint.",
            "Reach the flag. Fewer wrong answers mean more stars.",
        ],
        "learn": [
            "Every gate is one Spanish sentence with a gap, for example <em lang=\"es\">Soy ___ Inglaterra.</em> After a wrong block the game shows the whole sentence and a short rule in English. The first levels ask the easiest sentences; later levels mix in harder ones. There are six levels, from First Steps to the Sky Finale with hammers and moving platforms.",
        ],
        "faq": [
            ("Does it work on a tablet?", "Yes, with a stick and a jump button. It is best on a computer or Chromebook with a big screen."),
            ("How do I get three stars?", "Answer every gate right the first time. One or two wrong answers give two stars, more give one. Falling into a gap costs no stars."),
            ("Is my progress saved?", "Yes, stars and best times are saved on your device only. There is no account."),
        ],
        "related": ["verb-kitchen", "verb-towers"],
        "meta": "A 3D jump-and-run for Spanish: jump on the block with the right word, the wrong ones fall. Free in the browser, no sign-up.",
    },
    "verb-towers": {
        "h1": "Verb Towers: a Spanish tower-defence game",
        "lead": [
            "Enemies march along the road to your castle, and your towers stop them. Towers cost coins, and you earn coins in the <strong>forge</strong>: answer the Spanish sentence, and every right answer forges coins. A streak of right answers pays more.",
            "The game is free in the browser, with English menus and Spanish sentences.",
        ],
        "howto": [
            "Tap or click a glowing field next to the road to build a tower.",
            "Start the wave. While the enemies walk, answer the sentences in the forge: tap an answer or press <kbd>Q</kbd> <kbd>W</kbd> <kbd>E</kbd>.",
            "A wrong answer locks the forge for a moment and shows you the right word and a short rule.",
            "Spend your coins on more towers and upgrades. Protect the castle to win stars and unlock the next level.",
        ],
        "learn": [
            "The forge asks Spanish sentences with a gap, like <em lang=\"es\">Me ___ Sofía.</em> Right answers give coins, so practicing is how you defend the castle. After a mistake you see the right word and why. There are six levels, from the Meadow to the Winter Pass.",
        ],
        "faq": [
            ("Does it work on a phone?", "Yes, by tapping; turn the phone sideways. Tablets and computers show a bigger map."),
            ("What happens if I answer wrong?", "The forge locks for a moment and shows the right word and a short rule. Then the next sentence comes."),
            ("Is my progress saved?", "Yes, stars and unlocked levels are saved on your device only. There is no account."),
        ],
        "related": ["verb-kitchen", "verb-platformer"],
        "meta": "A 3D tower-defence game for Spanish: answer Spanish sentences to forge coins, build towers and stop the enemies. Free in the browser, no sign-up.",
    },
    "verb-hatchery": {
        "h1": "Egg Island: a Spanish island adventure",
        "lead": [
            "Run across a sunny 3D island and look for eggs. To pick an egg up you answer a <strong>Spanish sentence</strong>. Carry it to your farm before the thief crabs grab it, put it in the incubator and watch a creature hatch.",
            "Your creatures earn coins for upgrades, and rarer eggs ask more. The game is free in the browser, with English menus and Spanish sentences.",
        ],
        "howto": [
            "Walk with <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd>, turn the camera by dragging the mouse, run with <kbd>Shift</kbd> and jump with <kbd>Space</kbd>. On a tablet: the stick and the hand button (turn the tablet sideways).",
            "Walk to a glowing egg and press <kbd>E</kbd> (or click it). Answer the sentence to pick the egg up.",
            "Follow the arrow back to your farm. The egg goes into the incubator and hatches after a moment.",
            "Watch out for thief crabs: answer right and you keep your egg. Spend the coins your creatures earn on upgrades (<kbd>U</kbd>) and look at your creatures in the Creature Book (<kbd>B</kbd>).",
        ],
        "learn": [
            "Each egg asks a Spanish sentence with a gap, like <em lang=\"es\">Me ___ Sofía.</em> Rare eggs ask two. After a mistake the egg rolls away, and you see the whole sentence and a short rule in English. The sentence comes back soon, and the Creature Book lists the sentences you still need to practice.",
        ],
        "faq": [
            ("Does it work on a phone?", "It needs a wide screen: a computer, a Chromebook or a tablet held sideways. Phones are not tested yet."),
            ("Can I lose in Egg Island?", "No. A wrong answer only lets the egg roll away; it comes back soon. Thief crabs can take an egg, but you can catch them."),
            ("Is my progress saved?", "Yes, your creatures, coins and upgrades are saved on your device only. There is no account."),
        ],
        "related": ["verb-kitchen", "verb-towers"],
        "meta": "A 3D island game for Spanish: find eggs, answer Spanish sentences to pick them up and hatch creatures. Free in the browser, no sign-up.",
    },
}
# Keys of CONTENT / TEACHES / TEACHER are section ids (homepage/data/sections.json).
for _gid, _c in EN_SPANISH.items():
    CONTENT.setdefault(_gid, {})["en/spanish"] = _c

TEACHES["en/spanish"] = {"default": "Spanish grammar for beginners: ser, estar, ser or estar, tener"}
