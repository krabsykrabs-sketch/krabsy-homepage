// The show logic: rounds, scoring, reveal. No DOM, no 3D, no keys.
// Input (src/input.js today, a network input in phase 4) calls the actions below:
//   pick(team, option)   round 1 / final: a team's secret answer (may change until reveal)
//   buzz(team)           round 2: first buzz wins the right to answer
//   answer(option)       round 2: the buzzing team's answer
//   setBet(team, value)  final: before the question is shown
//   advance()            the teacher's Enter / "Next" button: moves the show on
// Everything the screen needs is in `show.state`; after each change the show calls
// `onChange(event)` with a small event object ({ type, ... }) for sounds and effects.

export const POINTS = { r1: 100, r2: 200 };
export const BET_FLOOR = 100;    // a team below this may still bet up to 100 (comebacks)
export const TIME = 20;          // seconds per question when the timer is on

export const LENGTHS = {
  short: { r1: 6, r2: 4, final: 3, minutes: 10 },
  normal: { r1: 10, r2: 8, final: 3, minutes: 20 },
  long: { r1: 14, r2: 12, final: 3, minutes: 30 },
};

const flat = (units) => units.flatMap((u, ui) => u.map((q, k) => ({ ...q, unit: ui, pos: k, pairLen: u.length })));

export class Show {
  // teams: [{ name, color }], set: { r1, r2, final } units from questions.js
  constructor({ teams, set, timer = true, onChange = () => {} }) {
    this.onChange = onChange;
    this.timerOn = timer;
    this.rounds = [
      { n: 1, kind: 'all', qs: flat(set.r1) },
      { n: 2, kind: 'buzz', qs: flat(set.r2) },
      { n: 3, kind: 'bet', qs: flat(set.final) },
    ].filter((r) => r.qs.length);
    this.state = {
      teams: teams.map((t, i) => ({ ...t, i, score: 0, gained: 0 })),
      round: 0, qi: -1,
      phase: 'title',     // title | bet | ask | answering | reveal | standings | end
      picks: {},          // team → option index (round 1, final)
      bets: {},           // team → points (final)
      buzzer: null,       // team answering in round 2
      out: [],            // teams that answered wrong in round 2 (this question)
      struck: [],         // options already tried wrong in round 2 (this question)
      owner: null,        // round 2, 3rd form: team that won the 2nd form
      timeLeft: TIME,
      result: null,       // after reveal: { correct: team[], wrong: team[], delta: {team: n} }
      missed: new Map(),  // item → { q, n }  (for the teacher's review)
      answered: 0, right: 0,   // team answers given / right, whole show
    };
    this.roundStats = { answers: 0, correct: 0, t0: 0 };
  }

  get round() { return this.rounds[this.state.round]; }
  get q() { return this.round && this.round.qs[this.state.qi]; }
  get total() { return this.rounds.reduce((s, r) => s + r.qs.length, 0); }
  emit(type, extra = {}) { this.onChange({ type, ...extra }); }

  start() { this.state.phase = 'title'; this.roundStats.t0 = performance.now(); this.emit('round_title', { round: this.round.n }); }

  // ---------------------------------------------------------------- teacher
  advance() {
    const s = this.state;
    switch (s.phase) {
      case 'title': return this.nextQuestion();
      case 'bet': return this.ask();
      case 'ask':
        if (this.round.kind !== 'buzz') return this.reveal();
        return this.reveal();                 // teacher skips a buzzer question
      case 'answering': return;               // waiting for the buzzing team's letter
      case 'reveal': return this.nextQuestion();
      case 'standings':
        if (s.round + 1 >= this.rounds.length) { s.phase = 'end'; return this.emit('end'); }
        s.round += 1; s.qi = -1; s.phase = 'title';
        this.roundStats = { answers: 0, correct: 0, t0: performance.now() };
        return this.emit('round_title', { round: this.round.n });
      default: return;
    }
  }

  nextQuestion() {
    const s = this.state;
    if (s.qi + 1 >= this.round.qs.length) {
      s.phase = 'standings';
      return this.emit('round_end', { round: this.round.n, ...this.roundStats,
        seconds: Math.round((performance.now() - this.roundStats.t0) / 1000) });
    }
    const prev = this.q;
    s.qi += 1;
    s.picks = {}; s.out = []; s.struck = []; s.buzzer = null; s.result = null; s.owner = null;
    s.teams.forEach((t) => { t.gained = 0; });
    // Round 2, 3rd form: it goes to the team that won the 2nd form, if any.
    if (this.round.kind === 'buzz' && this.q.followUp && prev && prev.unit === this.q.unit) {
      s.owner = this._lastWinner ?? null;
    }
    if (this.round.kind === 'bet') {
      s.bets = {};
      s.teams.forEach((t) => { s.bets[t.i] = Math.min(this.maxBet(t.i), Math.round(this.maxBet(t.i) / 2 / 50) * 50); });
      s.phase = 'bet';
      return this.emit('bet');
    }
    return this.ask();
  }

  ask() {
    const s = this.state;
    s.phase = 'ask'; s.timeLeft = TIME;
    if (s.owner != null) { s.buzzer = s.owner; s.phase = 'answering'; }
    this.emit('question', { owner: s.owner });
  }

  // ---------------------------------------------------------------- teams
  pick(team, option) {
    const s = this.state;
    if (s.phase !== 'ask' || this.round.kind === 'buzz' || !s.teams[team]) return;
    const first = !(team in s.picks);
    s.picks[team] = option;
    this.emit('locked', { team, first });
    if (Object.keys(s.picks).length === s.teams.length) this.reveal();
  }

  buzz(team) {
    const s = this.state;
    if (s.phase !== 'ask' || this.round.kind !== 'buzz' || !s.teams[team] || s.out.includes(team)) return;
    s.buzzer = team; s.phase = 'answering';
    this.emit('buzz', { team });
  }

  answer(option) {
    const s = this.state;
    if (s.phase !== 'answering') return;
    const team = s.buzzer, ok = option === this.q.options.indexOf(this.q.answer);
    this._count(ok);
    if (ok) {
      s.teams[team].score += POINTS.r2; s.teams[team].gained = POINTS.r2;
      if (s.out.length) this._miss(this.q, s.out.length);
      s.result = { correct: [team], wrong: s.out.slice(), picked: { [team]: option } };
      this._lastWinner = team;
      s.phase = 'reveal';
      return this.emit('reveal', { result: s.result });
    }
    s.out.push(team); s.struck.push(option); s.buzzer = null;
    s.phase = 'ask';
    this.emit('wrong_buzz', { team, option });
    if (s.out.length >= s.teams.length) this.reveal();
  }

  maxBet(team) { return Math.max(this.state.teams[team].score, BET_FLOOR); }

  setBet(team, value) {
    const s = this.state;
    if (s.phase !== 'bet' || !s.teams[team]) return;
    s.bets[team] = Math.max(0, Math.min(this.maxBet(team), Math.round(value)));
    this.emit('bet_changed', { team });
  }

  // ---------------------------------------------------------------- time
  tick(dt) {
    const s = this.state;
    if (!this.timerOn || s.phase !== 'ask') return;   // paused while a buzzing team answers
    const before = Math.ceil(s.timeLeft);
    s.timeLeft = Math.max(0, s.timeLeft - dt);
    const now = Math.ceil(s.timeLeft);
    if (now !== before) this.emit('second', { left: now });
    if (s.timeLeft <= 0) { this.emit('time_up'); this.reveal(); }
  }

  // ---------------------------------------------------------------- reveal
  reveal() {
    const s = this.state, q = this.q, right = q.options.indexOf(q.answer);
    if (s.phase === 'reveal') return;
    if (this.round.kind === 'buzz') {
      s.result = { correct: [], wrong: s.out.slice(), picked: {} };
      this._lastWinner = null;
      if (!s.out.length) this._miss(q, s.teams.length);   // nobody dared: count as missed
      else this._miss(q, s.out.length);
    } else {
      const correct = [], wrong = [];
      for (const t of s.teams) {
        const p = s.picks[t.i];
        const ok = p === right;
        if (p !== undefined) this._count(ok);
        (ok ? correct : wrong).push(t.i);
        let d = 0;
        if (this.round.kind === 'all') d = ok ? POINTS.r1 : 0;
        else d = ok ? s.bets[t.i] : -Math.min(s.bets[t.i], t.score);
        t.score += d; t.gained = d;
      }
      if (wrong.length) this._miss(q, wrong.length);
      s.result = { correct, wrong, picked: { ...s.picks } };
    }
    s.phase = 'reveal';
    this.emit('reveal', { result: s.result });
  }

  _count(ok) {
    this.state.answered += 1; this.roundStats.answers += 1;
    if (ok) { this.state.right += 1; this.roundStats.correct += 1; }
    this.emit('attempt', { correct: ok, q: this.q });
  }

  _miss(q, n) {
    const m = this.state.missed, key = `${q.topic}|${q.item}`;
    const e = m.get(key) || { q, n: 0 };
    e.n += n; m.set(key, e);
  }

  // ---------------------------------------------------------------- results
  ranking() { return this.state.teams.slice().sort((a, b) => b.score - a.score); }
  review(n = 5) {
    return [...this.state.missed.values()].sort((a, b) => b.n - a.n).slice(0, n);
  }
}
