// Interface texts EN/DE/ES (the questions always stay English).
// Language: ?lang=de|es|en → localStorage krabsy_lang → DE (site convention).
let L = null;
export function lang() {
  if (L) return L;
  const q = new URLSearchParams(location.search).get('lang');
  let s = null;
  try { s = localStorage.getItem('krabsy_lang'); } catch (_) {}
  L = ['de', 'es', 'en'].includes(q) ? q : ['de', 'es', 'en'].includes(s) ? s : 'de';
  return L;
}

const T = {
  en: {
    title: 'Krabsy Quiz Show', tagline: 'The class quiz for one big screen. Play in teams!',
    topic: 'Topic', topic_irregular_verbs: 'Irregular verbs', topic_prepositions: 'Prepositions',
    teams: 'Teams', length: 'Length', len_short: 'Short', len_normal: 'Normal', len_long: 'Long',
    lenInfo: (n, m) => `${n} questions · about ${m} min`,
    timer: 'Timer', timerOn: '20 s', timerOff: 'Off', start: 'Start the show!',
    teamNames: ['Teal', 'Coral', 'Amber', 'Purple'], team: 'Team',
    round1: 'Round 1', round1Name: 'Everyone answers', round2: 'Round 2', round2Name: 'Buzzer',
    round3: 'Final', round3Name: 'Bet your points',
    r1How: 'Every team picks a letter in secret. Tap the podium, then the letter — or use your keys.',
    r2How: 'Buzz first, then answer! Wrong = out for this question, the others may buzz.',
    r3How: 'Bet part of your points. Right = win the bet, wrong = lose it.',
    keys: 'Keys', buzzKey: 'Buzzer', go: "Let's go!",
    lockedIn: 'locked in', waiting: 'thinking …', pickTeam: 'Which team?',
    reveal: 'Reveal', next: 'Next', enterNext: 'Enter', buzzNow: 'Buzz!', buzzed: 'answers!',
    out: 'out', nobody: 'Nobody had it.', right: 'Right!', points: 'points',
    question: (a, b) => `Question ${a} / ${b}`,
    bet: 'Your bet', betsHow: 'Set your bets, then show the question.', showQuestion: 'Show the question',
    standings: 'Standings', afterRound: (n) => `After ${n}`, continue: 'Continue',
    winner: (n) => `${n} wins!`, tie: 'A tie!',
    review: 'Words to practise again', reviewNone: 'The class got everything right. Wow!',
    reviewMissed: (n) => `missed ${n}×`, again: 'New show', fullscreen: 'Fullscreen', sound: 'Sound',
    timeUp: "Time's up!", noAnswer: 'no answer',
  },
  de: {
    title: 'Krabsy Quizshow', tagline: 'Das Klassenquiz für die große Leinwand. Spielt in Teams!',
    topic: 'Thema', topic_irregular_verbs: 'Unregelmäßige Verben', topic_prepositions: 'Präpositionen',
    teams: 'Teams', length: 'Länge', len_short: 'Kurz', len_normal: 'Normal', len_long: 'Lang',
    lenInfo: (n, m) => `${n} Fragen · etwa ${m} Min.`,
    timer: 'Zeitlimit', timerOn: '20 s', timerOff: 'Aus', start: 'Show starten!',
    teamNames: ['Türkis', 'Koralle', 'Gelb', 'Lila'], team: 'Team',
    round1: 'Runde 1', round1Name: 'Alle antworten', round2: 'Runde 2', round2Name: 'Buzzer',
    round3: 'Finale', round3Name: 'Setzt eure Punkte',
    r1How: 'Jedes Team wählt geheim einen Buchstaben. Tippt aufs Pult, dann auf den Buchstaben – oder nehmt eure Tasten.',
    r2How: 'Wer zuerst buzzert, antwortet! Falsch = für diese Frage raus, die anderen dürfen buzzern.',
    r3How: 'Setzt einen Teil eurer Punkte. Richtig = Einsatz gewonnen, falsch = Einsatz weg.',
    keys: 'Tasten', buzzKey: 'Buzzer', go: 'Los geht’s!',
    lockedIn: 'eingeloggt', waiting: 'überlegt …', pickTeam: 'Welches Team?',
    reveal: 'Auflösen', next: 'Weiter', enterNext: 'Enter', buzzNow: 'Buzzern!', buzzed: 'antwortet!',
    out: 'raus', nobody: 'Das hatte keiner.', right: 'Richtig!', points: 'Punkte',
    question: (a, b) => `Frage ${a} / ${b}`,
    bet: 'Euer Einsatz', betsHow: 'Stellt eure Einsätze ein, dann kommt die Frage.', showQuestion: 'Frage zeigen',
    standings: 'Punktestand', afterRound: (n) => `Nach ${n}`, continue: 'Weiter',
    winner: (n) => `${n} gewinnt!`, tie: 'Unentschieden!',
    review: 'Diese Wörter nochmal üben', reviewNone: 'Die Klasse hatte alles richtig. Wow!',
    reviewMissed: (n) => `${n}× falsch`, again: 'Neue Show', fullscreen: 'Vollbild', sound: 'Ton',
    timeUp: 'Zeit ist um!', noAnswer: 'keine Antwort',
  },
  es: {
    title: 'Krabsy Quiz Show', tagline: 'El concurso de clase para la pantalla grande. ¡Jugad en equipos!',
    topic: 'Tema', topic_irregular_verbs: 'Verbos irregulares', topic_prepositions: 'Preposiciones',
    teams: 'Equipos', length: 'Duración', len_short: 'Corto', len_normal: 'Normal', len_long: 'Largo',
    lenInfo: (n, m) => `${n} preguntas · unos ${m} min`,
    timer: 'Tiempo', timerOn: '20 s', timerOff: 'Sin límite', start: '¡Empieza el show!',
    teamNames: ['Turquesa', 'Coral', 'Ámbar', 'Morado'], team: 'Equipo',
    round1: 'Ronda 1', round1Name: 'Todos responden', round2: 'Ronda 2', round2Name: 'Pulsador',
    round3: 'Final', round3Name: 'Apostad vuestros puntos',
    r1How: 'Cada equipo elige una letra en secreto. Tocad el atril y luego la letra, o usad vuestras teclas.',
    r2How: '¡Quien pulse primero, responde! Mal = fuera en esta pregunta, los demás pueden pulsar.',
    r3How: 'Apostad parte de vuestros puntos. Bien = ganáis la apuesta, mal = la perdéis.',
    keys: 'Teclas', buzzKey: 'Pulsador', go: '¡Vamos!',
    lockedIn: 'listo', waiting: 'pensando …', pickTeam: '¿Qué equipo?',
    reveal: 'Resolver', next: 'Siguiente', enterNext: 'Enter', buzzNow: '¡Pulsad!', buzzed: '¡responde!',
    out: 'fuera', nobody: 'Nadie lo tenía.', right: '¡Bien!', points: 'puntos',
    question: (a, b) => `Pregunta ${a} / ${b}`,
    bet: 'Vuestra apuesta', betsHow: 'Elegid vuestras apuestas y luego mostrad la pregunta.', showQuestion: 'Mostrar pregunta',
    standings: 'Clasificación', afterRound: (n) => `Tras ${n}`, continue: 'Seguir',
    winner: (n) => `¡Gana ${n}!`, tie: '¡Empate!',
    review: 'Palabras para repasar', reviewNone: 'La clase lo acertó todo. ¡Guau!',
    reviewMissed: (n) => `${n}× mal`, again: 'Nuevo show', fullscreen: 'Pantalla completa', sound: 'Sonido',
    timeUp: '¡Se acabó el tiempo!', noAnswer: 'sin respuesta',
  },
};

export function t(key, ...args) {
  const v = T[lang()][key] ?? T.en[key] ?? key;
  return typeof v === 'function' ? v(...args) : v;
}
