// The sink: dirty plates → verb questions → clean plates. Missed verbs are
// re-queued (spaced repetition) and persisted for the post-level recap.
import { makeQuestion } from './verbs.js';
import { audio } from './audio.js';

export class SinkQuiz {
  constructor(game) {
    this.game = game;
    this.missedQueue = [];          // verb keys waiting to be re-asked
    this.missedThisRound = [];      // [{verb, form}] for the recap
    this.recent = new Set();        // avoid immediate verb repeats
    this.current = null;
    this.lockUntil = 0;             // ignore input briefly after answer

    this.el = document.getElementById('quiz');
    this.card = document.getElementById('quizCard');
    this.promptEl = document.getElementById('quizPrompt');
    this.subEl = document.getElementById('quizSub');
    this.chipsEl = document.getElementById('chips');
    this.chainEl = document.getElementById('quizChain');
    this.goBtn = document.getElementById('quizGo');
    this.goBtn.addEventListener('click', () => this.nextAfterWrong());
  }

  get open() { return this.el.classList.contains('on'); }

  openQuestion() {
    const q = makeQuestion(this.missedQueue, this.recent);
    this.current = q;
    this.recent.add(q.verb);
    if (this.recent.size > 8) this.recent.delete(this.recent.values().next().value);

    this.card.classList.remove('wrongState');
    this.promptEl.innerHTML = q.prompt;
    this.subEl.textContent = q.sub + (q.fromMissed ? ' · one more try!' : '');
    this.chainEl.style.display = 'none';
    this.goBtn.style.display = 'none';
    this.chipsEl.style.display = 'flex';
    this.chipsEl.innerHTML = '';
    q.chips.forEach((c, i) => {
      const b = document.createElement('button');
      b.className = 'chip';
      b.textContent = c;
      b.addEventListener('click', () => this.answer(i));
      this.chipsEl.appendChild(b);
    });
    this.el.classList.add('on');
    this.game.onQuestionOpen();
    audio.splash();
  }

  answer(idx) {
    if (!this.current || performance.now() < this.lockUntil) return;
    const q = this.current;
    const chips = [...this.chipsEl.children];
    if (idx < 0 || idx >= chips.length) return;
    const chosen = q.chips[idx];
    this.lockUntil = performance.now() + 450;

    if (chosen === q.answer) {
      chips[idx].classList.add('good');
      audio.correct();
      this.game.onPlateWashed();
      setTimeout(() => this.close(), 480);
    } else {
      chips[idx].classList.add('bad');
      chips[q.chips.indexOf(q.answer)].classList.add('good');
      audio.wrong();
      this.card.classList.add('wrongState');
      this.chainEl.innerHTML = q.chain;
      this.chainEl.style.display = 'block';
      this.goBtn.style.display = 'inline-block';
      // spaced repetition: re-ask after a couple of other questions
      const reKey = q.key;
      if (!this.missedQueue.includes(reKey)) {
        this.missedQueue.splice(Math.min(2, this.missedQueue.length), 0, reKey);
      }
      this.missedThisRound.push(q.key);
      this.game.onPlateMissed(q);
      this.current = null;   // chips dead until "keep washing"
    }
  }

  /** After a wrong answer: plate stays dirty, fresh question follows. */
  nextAfterWrong() {
    if (this.game.sinkStation && this.game.sinkStation.dirtyPlates > 0) {
      this.openQuestion();
    } else {
      this.close();
    }
  }

  close() {
    this.el.classList.remove('on');
    this.current = null;
    this.game.onQuestionClose();
  }

  /** Keyboard 1/2/3 → chips. */
  handleKey(key) {
    if (!this.open) return false;
    if (this.current && key >= '1' && key <= '3') {
      this.answer(parseInt(key, 10) - 1);
      return true;
    }
    if (!this.current && (key === 'Enter' || key === ' ')) {
      this.nextAfterWrong();
      return true;
    }
    return true;   // swallow all input while open
  }
}
