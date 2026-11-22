// Interface texts (verbs always stay English). Language: ?lang=de|es|en, else the
// browser language, else English. A key with a `_touch` twin uses the twin on touch devices.
const T = {
  en: {
    tagline: 'Answer the verb, then putt the ball into the hole. Few strokes = more stars!',
    level: (n) => `Level ${n}`, loading: 'Loading …',
    howAnswer: 'answer', howAim: 'aim', howShoot: 'hold and let go: shoot',
    howAim_touch: 'Drag back from the ball', howShoot_touch: 'let go: shoot', howAnswer_touch: 'Tap: answer',
    hole: (a, b) => `Hole ${a}/${b}`, par: (n) => `Par ${n}`, strokes: (n) => `Strokes ${n}`,
    ready: 'Space: your stroke', ready_touch: 'Tap: your stroke',
    aimHint: 'Drag back from the ball and let go. Or ← → and hold Space.',
    aimHint_touch: 'Drag back from the ball and let go!',
    cardTitle: 'Answer, then take your shot',
    gateHow: 'Putt the ball through the gate with the right word',
    notQuite: 'Not quite:', penalty: '+1 stroke', right: 'Right!',
    wrongGate: 'Wrong gate! +1', rightGate: 'Right gate!',
    holeInOne: 'Hole in one!', underPar: 'Super!', atPar: 'Par! Great!', overPar: 'In the hole!',
    goOn: "Let's go on!", outOfBounds: 'Out! +1',
    done: 'Course finished!', total: (s, p) => `${s} strokes · par ${p}`,
    firstTry: (a, b) => `${a} of ${b} verbs right on the first try`,
    practise: 'Verbs to practise:', perfect: 'No mistakes. Perfect!',
    next: 'Next level', again: 'Play again', menu: 'Levels', soon: 'soon',
    sound: 'Sound', clickToPlay: 'Click here to play', clickToPlay_touch: 'Tap here to play',
  },
  de: {
    tagline: 'Beantworte das Verb, dann putte den Ball ins Loch. Wenige Schläge = mehr Sterne!',
    level: (n) => `Level ${n}`, loading: 'Lädt …',
    howAnswer: 'antworten', howAim: 'zielen', howShoot: 'halten und loslassen: schlagen',
    howAim_touch: 'Vom Ball nach hinten ziehen', howShoot_touch: 'loslassen: schlagen', howAnswer_touch: 'Antippen: antworten',
    hole: (a, b) => `Loch ${a}/${b}`, par: (n) => `Par ${n}`, strokes: (n) => `Schläge ${n}`,
    ready: 'Leertaste: dein Schlag', ready_touch: 'Antippen: dein Schlag',
    aimHint: 'Vom Ball nach hinten ziehen und loslassen. Oder ← → und Leertaste halten.',
    aimHint_touch: 'Vom Ball nach hinten ziehen und loslassen!',
    cardTitle: 'Antworte, dann darfst du schlagen',
    gateHow: 'Putte den Ball durch das Tor mit dem richtigen Wort',
    notQuite: 'Nicht ganz:', penalty: '+1 Schlag', right: 'Richtig!',
    wrongGate: 'Falsches Tor! +1', rightGate: 'Richtiges Tor!',
    holeInOne: 'Hole in one!', underPar: 'Super!', atPar: 'Par! Toll!', overPar: 'Eingelocht!',
    goOn: 'Weiter geht’s!', outOfBounds: 'Aus! +1',
    done: 'Platz geschafft!', total: (s, p) => `${s} Schläge · Par ${p}`,
    firstTry: (a, b) => `${a} von ${b} Verben beim ersten Versuch richtig`,
    practise: 'Diese Verben üben:', perfect: 'Keine Fehler. Perfekt!',
    next: 'Nächstes Level', again: 'Noch einmal', menu: 'Level', soon: 'bald',
    sound: 'Ton', clickToPlay: 'Klick hier zum Spielen', clickToPlay_touch: 'Tipp hier zum Spielen',
  },
  es: {
    tagline: 'Responde el verbo y mete la bola en el hoyo. ¡Menos golpes = más estrellas!',
    level: (n) => `Nivel ${n}`, loading: 'Cargando …',
    howAnswer: 'responder', howAim: 'apuntar', howShoot: 'mantén y suelta: golpear',
    howAim_touch: 'Arrastra hacia atrás desde la bola', howShoot_touch: 'suelta: golpear', howAnswer_touch: 'Toca: responder',
    hole: (a, b) => `Hoyo ${a}/${b}`, par: (n) => `Par ${n}`, strokes: (n) => `Golpes ${n}`,
    ready: 'Espacio: tu golpe', ready_touch: 'Toca: tu golpe',
    aimHint: 'Arrastra hacia atrás desde la bola y suelta. O ← → y mantén Espacio.',
    aimHint_touch: '¡Arrastra hacia atrás desde la bola y suelta!',
    cardTitle: 'Responde y luego golpea',
    gateHow: 'Pasa la bola por la puerta con la palabra correcta',
    notQuite: 'Casi:', penalty: '+1 golpe', right: '¡Correcto!',
    wrongGate: '¡Puerta equivocada! +1', rightGate: '¡Puerta correcta!',
    holeInOne: '¡Hoyo en uno!', underPar: '¡Súper!', atPar: '¡Par! ¡Genial!', overPar: '¡Dentro!',
    goOn: '¡Sigamos!', outOfBounds: '¡Fuera! +1',
    done: '¡Campo terminado!', total: (s, p) => `${s} golpes · par ${p}`,
    firstTry: (a, b) => `${a} de ${b} verbos bien a la primera`,
    practise: 'Verbos para practicar:', perfect: 'Sin errores. ¡Perfecto!',
    next: 'Siguiente nivel', again: 'Jugar otra vez', menu: 'Niveles', soon: 'pronto',
    sound: 'Sonido', clickToPlay: 'Haz clic aquí para jugar', clickToPlay_touch: 'Toca aquí para jugar',
  },
};

function pick() {
  const q = new URLSearchParams(location.search).get('lang');
  if (q && T[q]) return q;
  const nav = (navigator.language || 'en').slice(0, 2).toLowerCase();
  return T[nav] ? nav : 'en';
}
export const lang = pick();
export let touchMode = false;
export function setTouch(on) { touchMode = on; }
export function t(key, ...args) {
  const v = (touchMode && (T[lang][`${key}_touch`] ?? T.en[`${key}_touch`])) || (T[lang][key] ?? T.en[key] ?? key);
  return typeof v === 'function' ? v(...args) : v;
}
