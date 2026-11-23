// The sink: dirty plates → verb questions → clean plates. Missed verbs are
// re-queued (spaced repetition) and persisted for the post-level recap.
//
// ONE PLATE = ONE VERB, TWO ANSWERS in chain order (owner decision 2026-11-23):
//   step 1  go → [___] → ___    (2nd form)
//   step 2  go → went → [___]   (3rd form, the 2nd form written in)
// Both right → a clean plate. After step 1 the 3rd form is never revealed.
// A WRONG answer (either step): the plate stays dirty, its wash progress goes
// back to 0, the full chain is shown, and the pair is dropped — "Keep washing"
// starts a NEW verb (both forms). The missed verb comes back as a whole pair
// after one other plate (and is saved for the cookbook / next round). Re-asking the
// same 3rd form right after showing the chain would just test memory of the
// screen, and a lone 3rd-form question is never asked (root CLAUDE.md).
// Leaving the sink mid-pair (Esc) keeps the pair: the next visit continues
// with its 3rd form. The round clock keeps running throughout (game.js).
import { makePair, seedPractice } from './verbs.js';
import { audio } from './audio.js';
import { ui } from './ui.js';
import { t } from './i18n.js';

export class SinkQuiz {
  constructor(game) {
    this.game = game;
    this.missedQueue = [];          // verbs waiting to be re-asked (as whole pairs)
    this.later = [];                // [{verb, wait}] missed verbs, held back a plate first
    this.missedThisRound = [];      // ['go|past', …] for the recap
    this.recent = new Set();        // avoid immediate verb repeats
    // persistent spaced repetition: verbs missed in earlier rounds lead off
    // this round's washing. A practice pair washed RIGHT (both forms, first
    // showing) proves recall across rounds → the verb leaves the saved list.
    this.practiceKeys = new Set(seedPractice(game.save.missed));
    this.missedQueue.push(...this.practiceKeys);
    this.pair = null;               // the plate's verb pair in progress
    this.step = 0;                  // 0 = 2nd form, 1 = 3rd form
    this.current = null;
    this.lockUntil = 0;             // ignore input briefly after answer

    this.el = document.getElementById('quiz');
    this.card = document.getElementById('quizCard');
    this.promptEl = document.getElementById('quizPrompt');
    this.subEl = document.getElementById('quizSub');
    this.chipsEl = document.getElementById('chips');
    this.chainEl = document.getElementById('quizChain');
    this.goBtn = document.getElementById('quizGo');
    this.goBtn.onclick = () => this.nextAfterWrong();
  }

  get open() { return this.el.classList.contains('on'); }

  openQuestion() {
    const wasOpen = this.open;
    if (!this.pair) {
      // a missed verb waits one other plate, then jumps the queue
      for (const m of this.later) if (--m.wait <= 0) this.missedQueue.unshift(m.verb);
      this.later = this.later.filter((m) => m.wait > 0);
      this.pair = makePair(this.missedQueue, this.recent);
      this.step = 0;
      this.recent.add(this.pair.verb);
      if (this.recent.size > 8) this.recent.delete(this.recent.values().next().value);
    }
    const q = { ...this.pair.steps[this.step], fromMissed: this.pair.fromMissed };
    this.current = q;

    this.card.classList.remove('wrongState');
    this.promptEl.innerHTML = q.prompt;
    this.subEl.textContent = q.sub + (this.practiceKeys.has(q.verb) ? t('fromCookbook')
      : q.fromMissed ? t('oneMoreTry') : '');
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
    // 2 correct answers (one verb, both forms) wash one plate — show the progress
    ui.setWashProgress(this.game.washProgress, this.game.washTarget);
    this.el.classList.add('on');
    if (!wasOpen) { this.game.onQuestionOpen(); }
    audio.splash();
  }

  answer(idx) {
    if (!this.current || performance.now() < this.lockUntil) return;
    const q = this.current;
    const chips = [...this.chipsEl.children];
    if (idx < 0 || idx >= chips.length) return;
    const chosen = q.chips[idx];
    this.lockUntil = performance.now() + 450;
    const right = chosen === q.answer;

    // a practice pair counts only on its first showing: both forms right →
    // mastered (leaves the saved list); a miss → normal in-round re-ask
    if (this.practiceKeys.has(q.verb) && (!right || this.step === 1)) {
      this.practiceKeys.delete(q.verb);
      if (right) this.game.onPracticeMastered(q.verb);
    }

    if (right) {
      chips[idx].classList.add('good');
      audio.correct();
      this.current = null;                       // these chips are now dead
      const r = this.game.onWashCorrect();        // banks 1/2 of a wash
      if (r.plateDone) {
        this.pair = null;
        // one sparkling plate — celebrate, then leave. Press E again for the next.
        setTimeout(() => this.close(), 950);
      } else {
        // halfway: the same verb's 3rd form follows (its 2nd form written in)
        this.step = 1;
        setTimeout(() => { if (this.open) this.openQuestion(); }, 640);
      }
    } else {
      chips[idx].classList.add('bad');
      chips[q.chips.indexOf(q.answer)].classList.add('good');
      audio.wrong();
      this.card.classList.add('wrongState');
      this.chainEl.innerHTML = q.chain;            // the whole chain: this pair is over
      this.chainEl.style.display = 'block';
      this.goBtn.style.display = 'inline-block';
      // spaced repetition: the verb comes back as a whole pair after one other plate
      if (!this.missedQueue.includes(q.verb) && !this.later.some((m) => m.verb === q.verb)) {
        this.later.push({ verb: q.verb, wait: 2 });
      }
      this.missedThisRound.push(q.key);
      this.game.onPlateMissed(q);
      this.game.onWashWrong();                     // plate stays dirty, progress → 0
      this.pair = null;                            // "keep washing" = a new verb
      this.current = null;   // chips dead until "keep washing"
    }
  }

  /** After a wrong answer: plate stays dirty, a fresh pair follows. */
  nextAfterWrong() {
    if (this.game.sinkStation && this.game.sinkStation.dirtyPlates > 0) {
      this.openQuestion();
    } else {
      this.close();
    }
  }

  close() {
    this.el.classList.remove('on');
    this.current = null;            // this.pair stays: the next visit resumes it
    this.game.onQuestionClose();
  }

  /** Keyboard 1/2/3 → chips. */
  handleKey(key) {
    if (!this.open) return false;
    if (key === 'Escape') { this.close(); return true; }
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
