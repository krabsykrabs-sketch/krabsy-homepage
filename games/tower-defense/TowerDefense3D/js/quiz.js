// Quiz system (step 10). Between every wave the player answers 2 questions about the
// same verb: simple past, then past participle. Correct answers award coins via the
// flying-coin effect; wrong answers briefly show the correct form, award nothing, and
// move on. After Q2, return to BUILD (or VICTORY if this was the final wave).

const Quiz = {
  start(state) {
    state.quiz = {
      verb: VERBS[Math.floor(Math.random() * VERBS.length)],
      questionIndex: 0,   // 0 = simple past, 1 = past participle
      choices: [],
      correctIndex: 0,
      feedbackActive: false,
      feedbackTimer: 0,
      selectedAnswer: -1,
      wasCorrect: false,
    };
    state.phase = 'QUIZ';
    this._setupQuestion(state);
  },

  _setupQuestion(state) {
    const q = state.quiz;
    const verb = q.verb;
    const correct = q.questionIndex === 0 ? verb.past : verb.pp;
    const wrongs  = q.questionIndex === 0 ? verb.pw   : verb.ppw;

    // Two random distractors from the 3 available, then shuffle in the correct answer.
    const pool = wrongs.slice().sort(() => Math.random() - 0.5);
    const choices = [correct, pool[0], pool[1]];
    for (let i = choices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [choices[i], choices[j]] = [choices[j], choices[i]];
    }

    q.choices = choices;
    q.correctIndex = choices.indexOf(correct);
    q.feedbackActive = false;
    q.feedbackTimer = 0;
    q.selectedAnswer = -1;
    q.wasCorrect = false;
  },

  answer(state, choiceIndex) {
    const q = state.quiz;
    if (!q || q.feedbackActive) return;
    if (choiceIndex < 0 || choiceIndex >= q.choices.length) return;

    const correct = choiceIndex === q.correctIndex;
    q.selectedAnswer = choiceIndex;
    q.wasCorrect = correct;
    q.feedbackActive = true;
    q.feedbackTimer = correct ? 1.0 : 1.5; // spec durations

    Sound.play(correct ? 'quizCorrect' : 'quizWrong');
    if (correct) {
      const lvl = Level.current;
      const reward = lvl.quiz.coinsPerCorrectAnswer;
      // Spec: "UI position for quiz". The panel is centered; map center sits underneath.
      Effects.spawnFlyingCoins(
        { x: lvl.gridWidth / 2, y: lvl.gridHeight / 2 },
        reward,
      );
    }
  },

  update(dt, state) {
    const q = state.quiz;
    if (!q || !q.feedbackActive) return;
    q.feedbackTimer -= dt;
    if (q.feedbackTimer <= 0) this._advance(state);
  },

  _advance(state) {
    const q = state.quiz;
    q.questionIndex += 1;
    if (q.questionIndex < 2) {
      this._setupQuestion(state);
      return;
    }

    // Quiz finished — VICTORY if the just-completed quiz followed the final wave.
    const lvl = Level.current;
    state.quiz = null;
    state.phase = state.currentWave >= lvl.totalWaves ? 'VICTORY' : 'BUILD';
    if (state.phase === 'VICTORY') Sound.play('victory');
  },
};
