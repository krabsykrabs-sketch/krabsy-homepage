// Interface texts (verbs always stay English). Language: ?lang=de|es|en, else the
// browser language, else English. A key with a `_touch` twin is used on touch screens.
const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
const T = {
  en: {
    tagline: 'Answer the verb, get a stone, knock the skeletons off their forts!',
    level: (n) => `Level ${n}`, soon: 'soon', loading: 'Loading …',
    howCard: 'stone', howAim: 'drag back: aim', howAnswer: 'answer',
    howCard_touch: 'Tap: stone', howAim_touch: 'Drag back: aim', howAnswer_touch: 'Tap: answer',
    castle: (a, b) => `Castle ${a} / ${b}`,
    basket: 'Get a stone', basket_touch: 'Get a stone',
    cardTitle: 'Answer for your stone', cardUp: 'Right = a better stone!',
    hintBasket: 'Tap the basket for a stone (or press Space).',
    hintBasket_touch: 'Tap the basket for a stone.',
    hintAim: 'Drag back, aim and let go!', hintAimKeys: 'Drag back and let go (or ← → ↑ ↓ and Space).',
    hintAim_touch: 'Drag back, aim and let go!',
    hintSplit: 'Tap while it flies: it splits into three!',
    hintPull: 'Pull further back to shoot!',
    right: 'Right!', notQuite: 'Not quite:',
    stone_pebble: 'Only a pebble …', stone_normal: 'A stone!', stone_big: 'Big stone!',
    stone_split: 'Split stone!', stone_bomb: 'Barrel bomb!', stone_cannon: 'Cannonball!',
    oof: 'Oof!', crack: 'Crack!', boom: 'Boom!',
    extra: 'One more try!', castleWon: 'Castle cleared!', castleDone: 'On to the next castle!',
    done: 'Level cleared!', points: (n) => `${n} points`,
    firstTry: (a, b) => `${a} of ${b} answers right`,
    practise: 'Verbs to practise:', perfect: 'No mistakes. Perfect!',
    next: 'Next level', again: 'Play again', menu: 'Levels', sound: 'Sound',
  },
  de: {
    tagline: 'Beantworte das Verb, hol dir einen Stein und schieß die Skelette von ihren Burgen!',
    level: (n) => `Level ${n}`, soon: 'bald', loading: 'Lädt …',
    howCard: 'Stein', howAim: 'zurückziehen: zielen', howAnswer: 'antworten',
    howCard_touch: 'Tippen: Stein', howAim_touch: 'Zurückziehen: zielen', howAnswer_touch: 'Tippen: antworten',
    castle: (a, b) => `Burg ${a} / ${b}`,
    basket: 'Stein holen', basket_touch: 'Stein holen',
    cardTitle: 'Antworte für deinen Stein', cardUp: 'Richtig = ein besserer Stein!',
    hintBasket: 'Tipp auf den Korb für einen Stein (oder drück die Leertaste).',
    hintBasket_touch: 'Tipp auf den Korb für einen Stein.',
    hintAim: 'Zurückziehen, zielen und loslassen!', hintAimKeys: 'Zurückziehen und loslassen (oder ← → ↑ ↓ und Leertaste).',
    hintAim_touch: 'Zurückziehen, zielen und loslassen!',
    hintSplit: 'Tipp, während er fliegt: Er teilt sich in drei!',
    hintPull: 'Weiter zurückziehen zum Schießen!',
    right: 'Richtig!', notQuite: 'Nicht ganz:',
    stone_pebble: 'Nur ein Kieselstein …', stone_normal: 'Ein Stein!', stone_big: 'Großer Stein!',
    stone_split: 'Splitterstein!', stone_bomb: 'Fassbombe!', stone_cannon: 'Kanonenkugel!',
    oof: 'Uff!', crack: 'Krach!', boom: 'Bumm!',
    extra: 'Noch ein Versuch!', castleWon: 'Burg geschafft!', castleDone: 'Weiter zur nächsten Burg!',
    done: 'Level geschafft!', points: (n) => `${n} Punkte`,
    firstTry: (a, b) => `${a} von ${b} Antworten richtig`,
    practise: 'Diese Verben üben:', perfect: 'Keine Fehler. Perfekt!',
    next: 'Nächstes Level', again: 'Nochmal', menu: 'Levels', sound: 'Ton',
  },
  es: {
    tagline: '¡Responde el verbo, consigue una piedra y tira a los esqueletos de sus fuertes!',
    level: (n) => `Nivel ${n}`, soon: 'pronto', loading: 'Cargando …',
    howCard: 'piedra', howAim: 'tirar hacia atrás: apuntar', howAnswer: 'responder',
    howCard_touch: 'Toca: piedra', howAim_touch: 'Tira hacia atrás: apuntar', howAnswer_touch: 'Toca: responder',
    castle: (a, b) => `Castillo ${a} / ${b}`,
    basket: 'Coger piedra', basket_touch: 'Coger piedra',
    cardTitle: 'Responde para tu piedra', cardUp: '¡Bien = una piedra mejor!',
    hintBasket: 'Toca la cesta para una piedra (o pulsa Espacio).',
    hintBasket_touch: 'Toca la cesta para una piedra.',
    hintAim: '¡Tira hacia atrás, apunta y suelta!', hintAimKeys: 'Tira hacia atrás y suelta (o ← → ↑ ↓ y Espacio).',
    hintAim_touch: '¡Tira hacia atrás, apunta y suelta!',
    hintSplit: '¡Toca mientras vuela: se divide en tres!',
    hintPull: '¡Tira más hacia atrás para disparar!',
    right: '¡Bien!', notQuite: 'Casi:',
    stone_pebble: 'Solo un guijarro …', stone_normal: '¡Una piedra!', stone_big: '¡Piedra grande!',
    stone_split: '¡Piedra triple!', stone_bomb: '¡Barril bomba!', stone_cannon: '¡Bala de cañón!',
    oof: '¡Uf!', crack: '¡Crac!', boom: '¡Bum!',
    extra: '¡Un intento más!', castleWon: '¡Castillo conquistado!', castleDone: '¡Al siguiente castillo!',
    done: '¡Nivel superado!', points: (n) => `${n} puntos`,
    firstTry: (a, b) => `${a} de ${b} respuestas bien`,
    practise: 'Verbos para practicar:', perfect: 'Sin errores. ¡Perfecto!',
    next: 'Siguiente nivel', again: 'Otra vez', menu: 'Niveles', sound: 'Sonido',
  },
};

function pick() {
  const q = new URLSearchParams(location.search).get('lang');
  if (q && T[q]) return q;
  const nav = (navigator.language || 'en').slice(0, 2).toLowerCase();
  return T[nav] ? nav : 'en';
}
export const lang = pick();
export const isTouch = touch;
export function t(key, ...args) {
  const v = (touch && (T[lang][`${key}_touch`] ?? T.en[`${key}_touch`])) || (T[lang][key] ?? T.en[key] ?? key);
  return typeof v === 'function' ? v(...args) : v;
}
