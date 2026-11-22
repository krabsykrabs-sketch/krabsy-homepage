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
    title: 'Krabsy Quiz Room',
    // child
    joinTitle: 'Join the quiz room', code: 'Room code', name: 'Your first name', color: 'Your colour',
    join: 'Join', joining: 'Joining …',
    err_no_room: 'No room with this code. Check the code on the board.', err_locked: 'The room is closed for new players.',
    err_full: 'The room is full.', err_removed: 'You were removed from this room.', err_bad_name: 'Please type your first name.',
    err_net: 'No connection to the quiz server. Try again in a moment.',
    lobby: 'Waiting for the teacher to start. Walk around! (WASD or arrows, Space = jump)',
    question: (a, b) => `Question ${a} / ${b}`, sent: 'Answer sent! Walk around until the answer comes.',
    right: 'Right!', wrong: 'Not quite.', none: 'No answer this time.', theAnswer: 'The answer:',
    pts: (n) => `+${n} points`, rank: (r, n) => `Place ${r} of ${n}`, streak: (n) => `${n} in a row!`,
    top5: 'Top 5', score: 'Points', endTitle: 'The quiz is over!', youPlace: (r, n) => `You are number ${r} of ${n}`,
    youRight: (a, b) => `${a} of ${b} right`, kicked: 'You were removed from the room.', closed: 'The room is closed.',
    lost: 'Connection lost … reconnecting', renamed: (n) => `The teacher renamed you: ${n}`,
    // teacher
    setupTitle: 'Set up your quiz', topic: 'Topic', topic_irregular_verbs: 'Irregular verbs', topic_prepositions: 'Prepositions',
    difficulty: 'Difficulty', diff_irregular_verbs: ['common', 'medium', 'rare'], diff_prepositions: ['easy', 'medium', 'hard'],
    count: 'Questions', timePer: 'Time per question', open: 'Open the room', opening: 'Opening …',
    joinAt: 'Join at', inRoom: (n) => `${n} in the room`, start: 'Start the quiz', next: 'Next', reveal: 'Show answer',
    end: 'End quiz', lock: 'Lock room', unlock: 'Unlock room', remove: 'Remove', rename: 'Rename', renameTo: 'New name:',
    answeredOf: (a, b) => `${a} / ${b} answered`, waitingPlayers: 'Waiting for players …',
    review: 'Words to practise again', reviewNone: 'The class got everything right!', missed: (n) => `missed ${n}×`,
    ranking: 'Ranking', classRight: (p) => `The class answered ${p} % right.`, newQuiz: 'New quiz', results: 'Results',
    closeRoom: 'Close room', teacherOnly: 'The teacher runs the room and does not play.',
    noQuestions: 'Not enough questions for this choice.',
    swap: 'Swap for another question', removeQ: 'Remove', nQuestions: (n) => `${n} questions`, showAnswers: 'Show answers',
    addQ: 'Add a question', newMix: 'New mix', editQuestions: 'Edit questions', save: 'Save', cancel: 'Cancel',
    answersHint: 'The projector may be on: answers are hidden here unless you tick "Show answers".',
  },
  de: {
    title: 'Krabsy Quiz-Raum',
    joinTitle: 'Ab in den Quiz-Raum', code: 'Raum-Code', name: 'Dein Vorname', color: 'Deine Farbe',
    join: 'Beitreten', joining: 'Verbinde …',
    err_no_room: 'Kein Raum mit diesem Code. Schau nochmal an die Tafel.', err_locked: 'Der Raum ist für neue Spieler geschlossen.',
    err_full: 'Der Raum ist voll.', err_removed: 'Du wurdest aus diesem Raum entfernt.', err_bad_name: 'Bitte gib deinen Vornamen ein.',
    err_net: 'Keine Verbindung zum Quiz-Server. Versuch es gleich nochmal.',
    lobby: 'Warte, bis die Lehrkraft startet. Lauf herum! (WASD oder Pfeile, Leertaste = springen)',
    question: (a, b) => `Frage ${a} / ${b}`, sent: 'Antwort gesendet! Lauf herum, bis die Auflösung kommt.',
    right: 'Richtig!', wrong: 'Nicht ganz.', none: 'Diesmal keine Antwort.', theAnswer: 'Die Antwort:',
    pts: (n) => `+${n} Punkte`, rank: (r, n) => `Platz ${r} von ${n}`, streak: (n) => `${n} richtig in Folge!`,
    top5: 'Top 5', score: 'Punkte', endTitle: 'Das Quiz ist vorbei!', youPlace: (r, n) => `Du bist auf Platz ${r} von ${n}`,
    youRight: (a, b) => `${a} von ${b} richtig`, kicked: 'Du wurdest aus dem Raum entfernt.', closed: 'Der Raum ist geschlossen.',
    lost: 'Verbindung weg … verbinde neu', renamed: (n) => `Die Lehrkraft hat dich umbenannt: ${n}`,
    setupTitle: 'Stell dein Quiz zusammen', topic: 'Thema', topic_irregular_verbs: 'Unregelmäßige Verben', topic_prepositions: 'Präpositionen',
    difficulty: 'Schwierigkeit', diff_irregular_verbs: ['häufig', 'mittel', 'selten'], diff_prepositions: ['leicht', 'mittel', 'schwer'],
    count: 'Fragen', timePer: 'Zeit pro Frage', open: 'Raum öffnen', opening: 'Öffne …',
    joinAt: 'Beitreten auf', inRoom: (n) => `${n} im Raum`, start: 'Quiz starten', next: 'Weiter', reveal: 'Auflösen',
    end: 'Quiz beenden', lock: 'Raum sperren', unlock: 'Raum entsperren', remove: 'Entfernen', rename: 'Umbenennen', renameTo: 'Neuer Name:',
    answeredOf: (a, b) => `${a} / ${b} haben geantwortet`, waitingPlayers: 'Warte auf Mitspieler …',
    review: 'Diese Wörter nochmal üben', reviewNone: 'Die Klasse hatte alles richtig!', missed: (n) => `${n}× falsch`,
    ranking: 'Rangliste', classRight: (p) => `Die Klasse hatte ${p} % richtig.`, newQuiz: 'Neues Quiz', results: 'Ergebnis',
    closeRoom: 'Raum schließen', teacherOnly: 'Die Lehrkraft leitet den Raum und spielt nicht mit.',
    noQuestions: 'Für diese Auswahl gibt es nicht genug Fragen.',
    swap: 'Gegen eine andere Frage tauschen', removeQ: 'Entfernen', nQuestions: (n) => `${n} Fragen`, showAnswers: 'Antworten zeigen',
    addQ: 'Frage hinzufügen', newMix: 'Neu mischen', editQuestions: 'Fragen bearbeiten', save: 'Speichern', cancel: 'Abbrechen',
    answersHint: 'Der Beamer läuft vielleicht: Die Antworten sind hier versteckt, außer du hakst „Antworten zeigen“ an.',
  },
  es: {
    title: 'Krabsy Sala de Quiz',
    joinTitle: 'Entra en la sala de quiz', code: 'Código de la sala', name: 'Tu nombre', color: 'Tu color',
    join: 'Entrar', joining: 'Conectando …',
    err_no_room: 'No hay sala con este código. Mira la pizarra otra vez.', err_locked: 'La sala está cerrada para nuevos jugadores.',
    err_full: 'La sala está llena.', err_removed: 'Te han sacado de esta sala.', err_bad_name: 'Escribe tu nombre, por favor.',
    err_net: 'No hay conexión con el servidor del quiz. Inténtalo en un momento.',
    lobby: 'Espera a que el profe empiece. ¡Pasea! (WASD o flechas, espacio = saltar)',
    question: (a, b) => `Pregunta ${a} / ${b}`, sent: '¡Respuesta enviada! Pasea hasta que llegue la solución.',
    right: '¡Bien!', wrong: 'Casi.', none: 'Esta vez sin respuesta.', theAnswer: 'La respuesta:',
    pts: (n) => `+${n} puntos`, rank: (r, n) => `Puesto ${r} de ${n}`, streak: (n) => `¡${n} seguidas!`,
    top5: 'Top 5', score: 'Puntos', endTitle: '¡Se acabó el quiz!', youPlace: (r, n) => `Estás en el puesto ${r} de ${n}`,
    youRight: (a, b) => `${a} de ${b} bien`, kicked: 'Te han sacado de la sala.', closed: 'La sala está cerrada.',
    lost: 'Conexión perdida … reconectando', renamed: (n) => `El profe te ha cambiado el nombre: ${n}`,
    setupTitle: 'Prepara tu quiz', topic: 'Tema', topic_irregular_verbs: 'Verbos irregulares', topic_prepositions: 'Preposiciones',
    difficulty: 'Dificultad', diff_irregular_verbs: ['frecuentes', 'medios', 'raros'], diff_prepositions: ['fácil', 'media', 'difícil'],
    count: 'Preguntas', timePer: 'Tiempo por pregunta', open: 'Abrir la sala', opening: 'Abriendo …',
    joinAt: 'Entrar en', inRoom: (n) => `${n} en la sala`, start: 'Empezar el quiz', next: 'Siguiente', reveal: 'Resolver',
    end: 'Terminar', lock: 'Bloquear la sala', unlock: 'Desbloquear la sala', remove: 'Sacar', rename: 'Renombrar', renameTo: 'Nombre nuevo:',
    answeredOf: (a, b) => `${a} / ${b} han respondido`, waitingPlayers: 'Esperando jugadores …',
    review: 'Palabras para repasar', reviewNone: '¡La clase lo acertó todo!', missed: (n) => `${n}× mal`,
    ranking: 'Clasificación', classRight: (p) => `La clase acertó el ${p} %.`, newQuiz: 'Nuevo quiz', results: 'Resultados',
    closeRoom: 'Cerrar la sala', teacherOnly: 'El profe dirige la sala y no juega.',
    noQuestions: 'No hay suficientes preguntas para esta selección.',
    swap: 'Cambiar por otra pregunta', removeQ: 'Quitar', nQuestions: (n) => `${n} preguntas`, showAnswers: 'Mostrar respuestas',
    addQ: 'Añadir pregunta', newMix: 'Mezclar de nuevo', editQuestions: 'Editar preguntas', save: 'Guardar', cancel: 'Cancelar',
    answersHint: 'Quizá el proyector está encendido: las respuestas están ocultas salvo que marques «Mostrar respuestas».',
  },
};

export function t(key, ...args) {
  const v = T[lang()][key] ?? T.en[key] ?? key;
  return typeof v === 'function' ? v(...args) : v;
}
