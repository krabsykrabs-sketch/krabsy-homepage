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
                "Das Spiel läuft kostenlos im Browser, ohne Download und ohne Anmeldung. Die kurzen Hinweise im Spiel sind auf Englisch – hier erklären wir dir alles auf Deutsch.",
            ],
            "howto": [
                "Zwei Ballons mit je einem englischen Verb steigen auf. Wische über einen davon – das ist dein Verb für die Runde.",
                "Jetzt fliegen Bälle mit verschiedenen Formen hoch. Zerschneide den Ball mit der <strong>Simple-Past-Form</strong> (bei <em>go</em> also <em>went</em>).",
                "In der zweiten Welle suchst du das <strong>Past Participle</strong> (<em>gone</em>).",
                "Du hast drei Herzen. Eins geht verloren, wenn du einen falschen Ball triffst oder den richtigen herunterfallen lässt.",
                "Am Computer wischst du mit gedrückter Maustaste, auf Handy und Tablet mit dem Finger.",
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
            "related": ["crab-slash", "verb-snake", "air-control"],
        },
        "es": {
            "h1": "Verb Slash: practica los verbos irregulares en inglés de un tajo",
            "meta": "Corta globos y pelotas con la forma verbal correcta – go, went, gone. Juego para practicar los verbos irregulares en inglés. Gratis en el navegador, sin registro.",
            "lead": [
                "En Verb Slash suben globos y pelotas de playa por la pantalla y tú cortas la forma verbal correcta con un movimiento rápido. Es una manera divertida de repasar los <strong>verbos irregulares en inglés</strong> sin abrir el cuaderno. Cada ronda gira alrededor de un verbo, por ejemplo <em>go → went → gone</em>.",
                "Puedes jugar gratis en el navegador, sin descargar nada y sin registrarte. Las pocas instrucciones del juego están en inglés; aquí te lo explicamos todo en español.",
            ],
            "howto": [
                "Aparecen dos globos, cada uno con un verbo en inglés. Pasa el dedo o el ratón por uno para elegir el verbo de la ronda.",
                "Luego saltan pelotas con distintas formas. Corta la que tiene el <strong>pasado simple</strong> (si elegiste <em>go</em>, es <em>went</em>).",
                "En la segunda tanda buscas el <strong>participio pasado</strong> (<em>gone</em>).",
                "Tienes tres vidas. Pierdes una si cortas una pelota equivocada o si dejas caer la correcta.",
                "En la computadora mantienes pulsado el botón del ratón y deslizas; en el celular o la tablet, deslizas el dedo.",
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
            "related": ["crab-slash", "verb-snake", "air-control"],
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
            "related": ["verb-slash", "verb-flow", "verb-snake"],
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
            "related": ["verb-slash", "verb-flow", "verb-snake"],
        },
    },
    # ──────────────────────────────────────────────────────────── Air Control
    "air-control": {
        "de": {
            "h1": "Air Control – lande Flugzeuge mit englischen Verbformen",
            "meta": "Zeichne Flugrouten und lande go, went und gone auf derselben Landebahn. Fluglotsen-Spiel zum Üben unregelmäßiger englischer Verben. Kostenlos im Browser, ohne Anmeldung.",
            "lead": [
                "In Air Control bist du Fluglotse. Jedes Flugzeug trägt eine englische Verbform – und du bringst die drei Formen eines Verbs, zum Beispiel <em>fly</em>, <em>flew</em> und <em>flown</em>, auf <strong>dieselbe Landebahn</strong>. Dabei musst du gleichzeitig aufpassen, dass sich keine Flugzeuge in die Quere kommen. Ein Spiel für alle, die die <strong>unregelmäßigen Verben</strong> üben und dabei einen kühlen Kopf behalten wollen.",
                "Air Control läuft kostenlos im Browser. Die Texte im Spiel sind auf Englisch, ein kurzes Tutorial zeigt dir beim ersten Start, wie es geht.",
            ],
            "howto": [
                "Ziehe mit der Maus oder dem Finger eine Linie von einem Flugzeug zu einer Landebahn – das Flugzeug fliegt die Route ab.",
                "Lande alle drei Formen eines Verbs auf derselben Bahn. In der Reihenfolge ① Grundform → ② Simple Past → ③ Past Participle gibt es einen großen Bonus.",
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
                ("Ist Air Control auf Deutsch?", "Die kurzen Texte im Spiel sind auf Englisch – passend zum Üben. Die Anleitung auf dieser Seite erklärt alles auf Deutsch."),
            ],
            "related": ["verb-snake", "verb-kitchen", "verb-slash"],
        },
        "es": {
            "h1": "Air Control: aterriza aviones con los verbos irregulares",
            "meta": "Traza rutas de vuelo y aterriza go, went y gone en la misma pista. Juego de controlador aéreo para practicar los verbos irregulares en inglés. Gratis, sin registro.",
            "lead": [
                "En Air Control eres controlador aéreo. Cada avión lleva una forma verbal en inglés y tu trabajo es aterrizar las tres formas de un mismo verbo – por ejemplo <em>fly</em>, <em>flew</em> y <em>flown</em> – <strong>en la misma pista</strong>. Al mismo tiempo tienes que evitar que los aviones choquen. Ideal para practicar los <strong>verbos irregulares en inglés</strong> mientras pones a prueba tus reflejos.",
                "Se juega gratis en el navegador. Los textos del juego están en inglés y la primera vez un pequeño tutorial te enseña lo básico.",
            ],
            "howto": [
                "Arrastra el ratón o el dedo desde un avión hasta una pista para trazar su ruta.",
                "Aterriza las tres formas de un verbo en la misma pista. Si lo haces en orden – ① forma base → ② pasado simple → ③ participio – ganas un gran bonus.",
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
                ("¿El juego está en español?", "Los textos dentro del juego están en inglés, que es justo lo que practicas. En esta página tienes las instrucciones en español."),
            ],
            "related": ["verb-snake", "verb-kitchen", "verb-slash"],
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
            "related": ["verb-flow", "air-control", "crab-slash"],
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
            "related": ["verb-flow", "air-control", "crab-slash"],
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
            "related": ["verb-snake", "crab-slash", "verb-platformer"],
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
            "related": ["verb-snake", "crab-slash", "verb-platformer"],
        },
    },
    # ──────────────────────────────────────────────────────── Verb Platformer
    "verb-platformer": {
        "de": {
            "h1": "Verb Platformer – 3D-Jump-’n’-Run mit englischen Verben",
            "lead": [
                "Im Verb Platformer läufst und springst du mit deiner Figur durch eine bunte 3D-Welt. Immer wieder kommst du an ein Tor mit einem englischen Verb, zum Beispiel <em>go</em>. Dahinter warten drei Plattformen mit verschiedenen Wörtern – aber nur eine trägt dich: die mit der richtigen <strong>Simple-Past-Form</strong>, hier <em>went</em>.",
                "Landest du auf der falschen Plattform, bröckelt sie weg, du fällst – und siehst sofort, was falsch war. Dann probierst du es einfach noch einmal. Das Spiel ist kostenlos und läuft im Browser; die Texte im Spiel sind auf Englisch.",
            ],
            "howto": [
                "Klicke ins Spielbild, damit die Maus die Kamera steuert. Mit <kbd>Esc</kbd> gibst du die Maus wieder frei.",
                "Laufen mit <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> oder den Pfeiltasten, springen mit der <kbd>Leertaste</kbd>.",
                "Lies das Verb am Tor und spring auf die Plattform mit der passenden Vergangenheitsform.",
                "Erreichst du die Flagge am Ende, ist das Level geschafft.",
                "Am besten spielst du am Computer mit Tastatur und Maus.",
            ],
            "learn": [
                "Der Verb Platformer konzentriert sich auf das <strong>Simple Past</strong> von 15 Grundverben wie {go}, {run}, {swim}, {see} und {think}. Die falschen Plattformen zeigen typische Verwechslungen: eine ausgedachte Form wie <em>goed</em> oder das Past Participle <em>gone</em>. So lernst du, die beiden Vergangenheitsformen auseinanderzuhalten. Es gibt drei Level mit drei bis fünf Toren, beweglichen Plattformen und einem kurvigen Weg. Geschaffte Level bekommen ein Häkchen.",
            ],
            "verbs": ["go", "run", "swim", "see", "think"],
            "faq": [
                ("Kann ich den Verb Platformer auf dem Handy spielen?", "Das Spiel ist für Computer mit Tastatur und Maus gemacht. Auf Handys gibt es noch keine Touch-Steuerung – nimm lieber einen Laptop oder PC."),
                ("Was passiert, wenn ich auf der falschen Plattform lande?", "Die Plattform zerbröselt, du fällst und siehst die richtige Lösung. Danach startest du direkt vor dem Tor neu – ohne Leben oder Zeitdruck."),
                ("Welche Verbform wird geübt?", "Nur das Simple Past, also die zweite Form (go → <em>went</em>). Für alle drei Formen eignen sich zum Beispiel Verb Snake oder Verb Flow."),
            ],
            "related": ["verb-kitchen", "air-control", "verb-snake"],
        },
        "es": {
            "h1": "Verb Platformer: saltos en 3D con los verbos en inglés",
            "lead": [
                "En Verb Platformer corres y saltas con tu personaje por un mundo en 3D. De vez en cuando llegas a una puerta con un verbo en inglés, por ejemplo <em>go</em>. Detrás te esperan tres plataformas con palabras distintas, pero solo una te sostiene: la del <strong>pasado simple</strong> correcto, en este caso <em>went</em>.",
                "Si caes en la plataforma equivocada, se desmorona, te caes y ves enseguida cuál era el error. Luego lo intentas otra vez. El juego es gratis y funciona en el navegador; los textos están en inglés.",
            ],
            "howto": [
                "Haz clic en la imagen del juego para controlar la cámara con el ratón. Con <kbd>Esc</kbd> sueltas el ratón.",
                "Muévete con <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> o con las flechas y salta con la <kbd>barra espaciadora</kbd>.",
                "Lee el verbo de la puerta y salta a la plataforma con la forma en pasado correcta.",
                "Cuando llegas a la bandera del final, superas el nivel.",
                "Se juega mejor en la computadora, con teclado y ratón.",
            ],
            "learn": [
                "Verb Platformer se centra en el <strong>pasado simple</strong> de 15 verbos básicos como {go}, {run}, {swim}, {see} y {think}. Las plataformas falsas muestran confusiones típicas: una forma inventada como <em>goed</em> o el participio <em>gone</em>. Así aprendes a no mezclar las dos formas del pasado. Hay tres niveles con entre tres y cinco puertas, plataformas que se mueven y un camino con curvas. Los niveles superados quedan marcados.",
            ],
            "verbs": ["go", "run", "swim", "see", "think"],
            "faq": [
                ("¿Puedo jugar Verb Platformer en el celular?", "El juego está hecho para computadora con teclado y ratón. En teléfonos todavía no hay controles táctiles, así que mejor usa una laptop o un PC."),
                ("¿Qué pasa si salto a la plataforma equivocada?", "La plataforma se rompe, te caes y ves la respuesta correcta. Después vuelves a aparecer delante de la puerta, sin perder vidas ni tiempo."),
                ("¿Qué forma verbal se practica?", "Solo el pasado simple, la segunda forma (go → <em>went</em>). Para practicar las tres formas prueba Verb Snake o Verb Flow."),
            ],
            "related": ["verb-kitchen", "air-control", "verb-snake"],
        },
    },
    # ─────────────────────────────────────────────────────────── Verb Kitchen
    "verb-kitchen": {
        "de": {
            "h1": "Verb Kitchen – Kochspiel mit unregelmäßigen Verben",
            "lead": [
                "Willkommen in der Verb Kitchen! In diesem 3D-Kochspiel nimmst du Bestellungen an, schnippelst Zutaten, brätst und backst – und servierst die fertigen Teller durch die Durchreiche. Doch die Teller kommen schmutzig zurück. Sauber werden sie nur mit Englisch: Für <strong>drei richtige Antworten</strong> an der Spüle bekommst du einen sauberen Teller.",
                "So wird aus Küchenstress ein Training für die <strong>unregelmäßigen Verben</strong>. Das Spiel läuft kostenlos im Browser; die Texte im Spiel sind auf Englisch.",
            ],
            "howto": [
                "Bewegen mit <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> oder den Pfeiltasten, aufnehmen und ablegen mit <kbd>E</kbd>, schneiden mit gedrückter <kbd>Leertaste</kbd>.",
                "Auf Tablet und Handy tippst du dorthin, wo deine Figur hinlaufen soll, und tippst eine Station an, um sie zu benutzen.",
                "Hol Zutaten aus den Kisten, schneide und koche sie, leg sie auf einen Teller und serviere. Pass auf, dass nichts anbrennt!",
                "An der Spüle beantwortest du Verbfragen mit einem von drei Knöpfen – per Klick oder mit den Tasten <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd>.",
                "Je schneller du alle Bestellungen schaffst, desto mehr Sterne bekommst du.",
            ],
            "learn": [
                "An der Spüle fragt das Spiel mal nach dem Simple Past, mal nach dem Past Participle, zum Beispiel <em>go → ___</em> oder <em>go → went → ___</em>. Insgesamt sind 46 Verben dabei – auch Küchenverben wie {cut}, {burn}, {break} und {eat}. Nach einem Fehler siehst du die ganze Reihe, verpasste Verben kommen wieder, und am Ende zeigt dir das Spiel, welche Verben du noch üben solltest. Es gibt drei Restaurants: Garden Bistro mit Tutorial, Burger Bar und Pizza Palace.",
            ],
            "verbs": ["cut", "burn", "break", "eat"],
            "faq": [
                ("Brauche ich eine Tastatur?", "Am Computer spielst du mit Tastatur. Auf Tablet und Handy funktioniert Tippen: Die Figur läuft von selbst zum angetippten Ort."),
                ("Kann man in Verb Kitchen verlieren?", "Nein. Bestellungen laufen nicht ab. Die Uhr zählt nur mit, und je schneller du bist, desto mehr Sterne bekommst du."),
                ("Was kann ich mit Sternen freischalten?", "Mit gesammelten Sternen schaltest du neue Spielfiguren frei. Sterne, Bestzeiten und Fortschritt werden auf deinem Gerät gespeichert."),
            ],
            "related": ["verb-platformer", "air-control", "verb-flow"],
        },
        "es": {
            "h1": "Verb Kitchen: juego de cocina con verbos irregulares",
            "lead": [
                "¡Bienvenido a Verb Kitchen! En este juego de cocina en 3D recibes pedidos, cortas ingredientes, cocinas en la estufa o en el horno y sirves los platos por la ventanilla. Pero los platos vuelven sucios, y solo se limpian con inglés: cada <strong>tres respuestas correctas</strong> en el fregadero te dan un plato limpio.",
                "Así el caos de la cocina se convierte en práctica de los <strong>verbos irregulares en inglés</strong>. Se juega gratis en el navegador; los textos del juego están en inglés.",
            ],
            "howto": [
                "Muévete con <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> o con las flechas, toma y deja cosas con <kbd>E</kbd> y corta manteniendo pulsada la <kbd>barra espaciadora</kbd>.",
                "En tablet o celular tocas el lugar al que quieres ir y tocas una estación para usarla.",
                "Saca ingredientes de las cajas, córtalos y cocínalos, ponlos en un plato y sírvelo. ¡Que no se queme nada!",
                "En el fregadero respondes preguntas de verbos con uno de tres botones: con un clic o con las teclas <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd>.",
                "Cuanto más rápido entregues todos los pedidos, más estrellas consigues.",
            ],
            "learn": [
                "En el fregadero el juego te pregunta a veces el pasado simple y a veces el participio, por ejemplo <em>go → ___</em> o <em>go → went → ___</em>. Hay 46 verbos, entre ellos verbos de cocina como {cut}, {burn}, {break} y {eat}. Si fallas, ves la secuencia completa; los verbos que fallaste vuelven a salir y al final el juego te muestra cuáles debes repasar. Hay tres restaurantes: Garden Bistro, con tutorial, Burger Bar y Pizza Palace.",
            ],
            "verbs": ["cut", "burn", "break", "eat"],
            "faq": [
                ("¿Necesito teclado?", "En la computadora se juega con teclado. En tablet y celular basta con tocar la pantalla: tu cocinero camina solo hasta el lugar que tocaste."),
                ("¿Se puede perder en Verb Kitchen?", "No. Los pedidos no caducan. El reloj solo mide tu tiempo, y si eres rápido ganas más estrellas."),
                ("¿Para qué sirven las estrellas?", "Con las estrellas desbloqueas nuevos personajes. Tus estrellas, mejores tiempos y progreso se guardan en tu dispositivo."),
            ],
            "related": ["verb-platformer", "air-control", "verb-flow"],
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
}

# What each game asks for (JSON-LD "teaches").
TEACHES = {
    "de": {
        "default": "Unregelmäßige englische Verben: Grundform, Simple Past und Past Participle",
        "verb-platformer": "Unregelmäßige englische Verben: Simple Past",
        "verb-kitchen": "Unregelmäßige englische Verben: Simple Past und Past Participle",
        "crab-slash": "Unregelmäßige englische Verben: Simple Past und Past Participle",
    },
    "es": {
        "default": "Verbos irregulares en inglés: forma base, pasado simple y participio pasado",
        "verb-platformer": "Verbos irregulares en inglés: pasado simple",
        "verb-kitchen": "Verbos irregulares en inglés: pasado simple y participio pasado",
        "crab-slash": "Verbos irregulares en inglés: pasado simple y participio pasado",
    },
}
