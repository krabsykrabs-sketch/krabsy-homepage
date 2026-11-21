// Interface texts (verbs always stay English). Language: ?lang=de|es|en, else the
// browser language, else English.
const T = {
  en: {
    tagline: 'Open the doors with irregular verbs. Bonk the skeletons!',
    level: (n) => `Level ${n}`, play: 'Play', loading: 'Loading …',
    howMove: 'move', howBonk: 'bonk', howAnswer: 'answer',
    room: (a, b) => `Room ${a} / ${b}`,
    hintDoor: 'Walk to the door at the back!',
    hintBonk: 'Bonk the skeletons first!', hintKey: 'The door is ready. Walk up to it!',
    hintChest: 'A chest! Walk up to it for a bonus.',
    notQuite: 'Not quite:', tryAgain: 'Try again!', right: 'Right!',
    unlocked: 'Unlocked!', treasure: 'Treasure!', bonk: 'Bonk!', ouch: 'Ouch!',
    heart: '+1 heart', dizzy: 'Dizzy! Try this room again.', nextRoom: 'Next room …',
    done: 'Dungeon cleared!', firstTry: (a, b) => `${a} of ${b} right on the first try`,
    practise: 'Verbs to practise:', perfect: 'No mistakes. Perfect!',
    next: 'Next level', again: 'Play again', menu: 'Levels',
    sound: 'Sound', rotate: 'Verb Dungeon needs a wider screen. Turn your device sideways or use a tablet or laptop.',
    clickToPlay: 'Click here to play',
    touchSoon: 'Keyboard needed for now. Touch controls are coming.',
  },
  de: {
    tagline: 'Öffne die Türen mit unregelmäßigen Verben. Hau die Skelette um!',
    level: (n) => `Level ${n}`, play: 'Spielen', loading: 'Lädt …',
    howMove: 'laufen', howBonk: 'hauen', howAnswer: 'antworten',
    room: (a, b) => `Raum ${a} / ${b}`,
    hintDoor: 'Lauf zur Tür ganz hinten!',
    hintBonk: 'Hau zuerst die Skelette um!', hintKey: 'Die Tür ist bereit. Lauf hin!',
    hintChest: 'Eine Truhe! Lauf hin für einen Bonus.',
    notQuite: 'Nicht ganz:', tryAgain: 'Versuch es noch einmal!', right: 'Richtig!',
    unlocked: 'Offen!', treasure: 'Schatz!', bonk: 'Bonk!', ouch: 'Autsch!',
    heart: '+1 Herz', dizzy: 'Schwindelig! Versuch den Raum noch einmal.', nextRoom: 'Nächster Raum …',
    done: 'Verlies geschafft!', firstTry: (a, b) => `${a} von ${b} beim ersten Versuch richtig`,
    practise: 'Diese Verben üben:', perfect: 'Keine Fehler. Perfekt!',
    next: 'Nächstes Level', again: 'Noch einmal', menu: 'Level',
    sound: 'Ton', rotate: 'Verb Dungeon braucht einen breiteren Bildschirm. Dreh dein Gerät quer oder nimm ein Tablet oder einen Laptop.',
    clickToPlay: 'Klick hier zum Spielen',
    touchSoon: 'Im Moment brauchst du eine Tastatur. Touch-Steuerung kommt bald.',
  },
  es: {
    tagline: 'Abre las puertas con verbos irregulares. ¡Dale a los esqueletos!',
    level: (n) => `Nivel ${n}`, play: 'Jugar', loading: 'Cargando …',
    howMove: 'moverse', howBonk: 'golpear', howAnswer: 'responder',
    room: (a, b) => `Sala ${a} / ${b}`,
    hintDoor: '¡Camina hasta la puerta del fondo!',
    hintBonk: '¡Primero dale a los esqueletos!', hintKey: 'La puerta está lista. ¡Acércate!',
    hintChest: '¡Un cofre! Acércate para un premio.',
    notQuite: 'Casi:', tryAgain: '¡Inténtalo otra vez!', right: '¡Correcto!',
    unlocked: '¡Abierta!', treasure: '¡Tesoro!', bonk: '¡Bonk!', ouch: '¡Ay!',
    heart: '+1 corazón', dizzy: '¡Mareado! Intenta esta sala otra vez.', nextRoom: 'Siguiente sala …',
    done: '¡Mazmorra superada!', firstTry: (a, b) => `${a} de ${b} bien a la primera`,
    practise: 'Verbos para practicar:', perfect: 'Sin errores. ¡Perfecto!',
    next: 'Siguiente nivel', again: 'Jugar otra vez', menu: 'Niveles',
    sound: 'Sonido', rotate: 'Verb Dungeon necesita una pantalla más ancha. Gira tu dispositivo o usa una tableta o un portátil.',
    clickToPlay: 'Haz clic aquí para jugar',
    touchSoon: 'Por ahora necesitas un teclado. Los controles táctiles llegarán pronto.',
  },
};

function pick() {
  const q = new URLSearchParams(location.search).get('lang');
  if (q && T[q]) return q;
  const nav = (navigator.language || 'en').slice(0, 2).toLowerCase();
  return T[nav] ? nav : 'en';
}
export const lang = pick();
export function t(key, ...args) {
  const v = T[lang][key] ?? T.en[key] ?? key;
  return typeof v === 'function' ? v(...args) : v;
}
