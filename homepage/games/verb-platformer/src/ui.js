// In-game HUD + transient overlays.
export function createUI({ onMenu }) {
  const hud = document.getElementById('hud');
  const levelInfo = document.getElementById('level-info');
  const menuBtn = document.getElementById('menu-btn');
  const flash = document.getElementById('death-flash');
  const complete = document.getElementById('level-complete');

  const progressEl = document.getElementById('progress');
  const progressText = document.getElementById('progress-text');
  const progressFill = document.getElementById('progress-fill');

  const reveal = document.getElementById('answer-reveal');
  const revealPrompt = document.getElementById('reveal-prompt');
  const revealCorrect = document.getElementById('reveal-correct');

  const hudQuestion = document.getElementById('hud-question');

  let revealHideTimer = null;
  let revealClearTimer = null;

  menuBtn.addEventListener('click', () => onMenu?.());

  return {
    showHud() { hud.hidden = false; progressEl.hidden = false; },
    hideHud() { hud.hidden = true;  progressEl.hidden = true;  },
    setLevel(text) { levelInfo.textContent = text; },

    // currentGate is 1-based: "Gate 1 / 5" before clearing any gate.
    setProgress(currentGate, total) {
      // Editor-format levels report total=0 (no gate concept) — hide the bar entirely.
      if (total === 0) {
        progressEl.hidden = true;
        return;
      }
      progressEl.hidden = false;
      if (currentGate > total) {
        progressText.textContent = 'Reach the flag!';
        progressFill.style.width = '100%';
      } else {
        progressText.textContent = `Gate ${currentGate} / ${total}`;
        progressFill.style.width = `${((currentGate - 1) / total) * 100}%`;
      }
    },

    deathFlash() {
      flash.hidden = false;
      flash.style.opacity = '0.55';
      requestAnimationFrame(() => requestAnimationFrame(() => { flash.style.opacity = '0'; }));
      setTimeout(() => { flash.hidden = true; }, 600);
    },

    // Shown when the player steps on an answer block. `word` is the word on that block; a wrong
    // pick shows it with a red ✗, a correct pick with a green ✓.
    showAnswerReveal(verb, word, isCorrect = false) {
      revealPrompt.textContent = `${verb} → `;
      revealCorrect.textContent = `${word} ${isCorrect ? '✓' : '✗'}`;
      revealCorrect.classList.toggle('wrong', !isCorrect);
      reveal.hidden = false;
      reveal.style.opacity = '1';
      clearTimeout(revealHideTimer);
      clearTimeout(revealClearTimer);
      revealHideTimer  = setTimeout(() => { reveal.style.opacity = '0'; }, 1500);
      revealClearTimer = setTimeout(() => { reveal.hidden = true; },        2100);
    },
    hideAnswerReveal() {
      clearTimeout(revealHideTimer);
      clearTimeout(revealClearTimer);
      reveal.hidden = true;
      reveal.style.opacity = '0';
    },

    showLevelComplete() { complete.hidden = false; },
    hideLevelComplete() { complete.hidden = true; },

    setHudQuestion(text) {
      if (text == null) {
        hudQuestion.hidden = true;
        return;
      }
      if (hudQuestion.textContent !== text) hudQuestion.textContent = text;
      hudQuestion.hidden = false;
    },
  };
}
