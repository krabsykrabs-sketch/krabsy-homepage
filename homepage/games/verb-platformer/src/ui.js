// The game shell's DOM: in-game HUD, transient overlays, pause card, first-run hint,
// results screen, loader. All text comes from src/i18n.js; main.js owns the flow.
import { t } from './i18n.js';
import { formatTime } from './progress.js';
import { starsHtml, helpHtml, esc, IS_TOUCH } from './shell-bits.js';
import { startConfetti, stopConfetti, playJingle } from './celebrate.js';
import { toggleMuted, onMuteChange } from './sound.js';

const $ = id => document.getElementById(id);

export function createUI({ onPause, onResume, onRestart, onLevels, onHintGo, onRetry, onNext }) {
  const hud = $('hud');
  const levelInfo = $('level-info');
  const pips = $('gate-pips');
  const hudTime = $('hud-time');
  const pauseBtn = $('pause-btn');
  const lookTip = $('look-tip');
  const flash = $('death-flash');

  const reveal = $('answer-reveal');
  const revealPrompt = $('reveal-prompt');
  const revealCorrect = $('reveal-correct');
  const hudQuestion = $('hud-question');

  const pause = $('pause');
  const hint = $('first-hint');
  const results = $('level-complete');
  const confetti = $('confetti');
  const loader = $('loader');

  let revealHideTimer = null;
  let revealClearTimer = null;
  let shownTime = '';

  // A HUD button must never keep the keyboard focus: Space is "jump".
  const click = (el, fn) => el.addEventListener('click', () => { el.blur(); fn?.(); });
  click(pauseBtn, onPause);
  const muteBtn = $('mute-btn');
  click(muteBtn, toggleMuted);
  onMuteChange(m => muteBtn.setAttribute('aria-pressed', String(m)));
  click($('pause-resume'), onResume);
  click($('pause-restart'), onRestart);
  click($('pause-levels'), onLevels);
  click($('hint-go'), onHintGo);
  click($('res-retry'), onRetry);
  click($('res-next'), onNext);
  click($('res-levels'), onLevels);

  function hintStepsHtml() {
    const move = IS_TOUCH
      ? '<div class="pic pic-stick"><i></i></div>'
      : '<div class="pic pic-wasd"><kbd class="key">W</kbd><span><kbd class="key">A</kbd><kbd class="key">S</kbd><kbd class="key">D</kbd></span></div>';
    const jump = IS_TOUCH
      ? `<div class="pic"><span class="pic-jump">${esc(t('jump'))}</span></div>`
      : `<div class="pic"><kbd class="key space">${esc(t('keySpace'))}</kbd></div>`;
    const goal = '<div class="pic pic-gate"><span class="sign">go → <b>___</b> → gone</span>' +
      '<span class="blocks"><i class="bad">goed</i><i class="good">went</i><i class="bad">wented</i></span></div>';
    return `<div class="hint-step">${move}<strong>${esc(t('hintMove'))}</strong></div>` +
      `<div class="hint-step">${jump}<strong>${esc(t('hintJump'))}</strong></div>` +
      `<div class="hint-step wide">${goal}<strong>${esc(t('hintGoal'))}</strong><small>${esc(t('hintGoalSub'))}</small></div>`;
  }

  return {
    // ---------- HUD ----------
    showHud() { hud.hidden = false; },
    hideHud() { hud.hidden = true; lookTip.hidden = true; },
    setLevel(text) { levelInfo.textContent = text; },

    // `cleared` gates out of `total`. One pip per gate plus the flag; no gates = no pips.
    setProgress(cleared, total) {
      if (!total) { pips.hidden = true; pips.innerHTML = ''; return; }
      pips.hidden = false;
      let html = '';
      for (let i = 0; i < total; i++) html += `<i class="${i < cleared ? 'done' : i === cleared ? 'now' : ''}"></i>`;
      html += `<i class="flag${cleared >= total ? ' now' : ''}"></i>`;
      pips.innerHTML = html;
      pips.setAttribute('aria-label', cleared >= total ? t('toFlag') : t('gateOf', cleared + 1, total));
    },

    setTime(seconds) {
      const s = formatTime(seconds);
      if (s !== shownTime) { shownTime = s; hudTime.textContent = s; }
    },

    setLookTip(show) { lookTip.hidden = !show; },

    deathFlash() {
      flash.hidden = false;
      flash.style.opacity = '0.5';
      requestAnimationFrame(() => requestAnimationFrame(() => { flash.style.opacity = '0'; }));
      setTimeout(() => { flash.hidden = true; }, 600);
    },

    // After every answer: the full chain (`go → went → gone`) in green. After a wrong answer
    // the word the player stepped on is shown above it with a red ✗, and it stays longer.
    showAnswerReveal(chain, wrongWord = null) {
      revealPrompt.textContent = wrongWord ? `${wrongWord} ✗` : '';
      revealPrompt.hidden = !wrongWord;
      revealCorrect.textContent = chain;
      reveal.hidden = false;
      reveal.style.opacity = '1';
      clearTimeout(revealHideTimer);
      clearTimeout(revealClearTimer);
      const hold = wrongWord ? 2600 : 1400;
      revealHideTimer  = setTimeout(() => { reveal.style.opacity = '0'; }, hold);
      revealClearTimer = setTimeout(() => { reveal.hidden = true; },        hold + 600);
    },
    hideAnswerReveal() {
      clearTimeout(revealHideTimer);
      clearTimeout(revealClearTimer);
      reveal.hidden = true;
      reveal.style.opacity = '0';
    },

    setHudQuestion(text) {
      if (text == null) { hudQuestion.hidden = true; return; }
      if (hudQuestion.textContent !== text) hudQuestion.textContent = text;
      hudQuestion.hidden = false;
    },

    // ---------- Loader ----------
    showLoader() { loader.hidden = false; },
    hideLoader() { loader.hidden = true; },

    // ---------- First-run hint ----------
    showHint() { $('hint-steps').innerHTML = hintStepsHtml(); hint.hidden = false; },
    hideHint() { hint.hidden = true; },

    // ---------- Pause ----------
    showPause(levelName, { canLeave = true } = {}) {
      $('pause-level').textContent = levelName || '';
      $('pause-help').innerHTML = helpHtml({ withGoal: false });
      $('pause-levels').hidden = !canLeave;
      pause.hidden = false;
    },
    hidePause() { pause.hidden = true; },

    // ---------- Results ----------
    // r: { levelName, stars, time, bestTime, newBestTime, firstTry, gates, missed: [chain…], perfect,
    //      hasNext, canLeave, allDone }
    showResults(r) {
      $('res-level').textContent = r.levelName || '';
      const starsEl = $('res-stars');
      starsEl.innerHTML = starsHtml(r.stars, 'big');
      $('res-note').textContent = r.allDone ? t('resAllDone') : r.stars < 3 ? t('resStarRule') : '';
      $('res-time').textContent = formatTime(r.time);
      const best = $('res-best');
      best.textContent = r.newBestTime ? t('resNewBest') : (r.bestTime != null && r.bestTime < r.time - 0.5 ? t('resBest', formatTime(r.bestTime)) : '');
      best.classList.toggle('is-new', !!r.newBestTime);
      $('res-first-stat').hidden = !r.gates;
      $('res-first').textContent = `${r.firstTry} / ${r.gates}`;

      const box = $('res-missed-box');
      const list = $('res-missed');
      box.hidden = !r.missed.length && !r.perfect;
      box.classList.toggle('is-perfect', !r.missed.length);
      $('res-missed-title').textContent = r.missed.length ? t('resMissed') : t('resPerfect');
      list.innerHTML = r.missed.map(chain => `<li>${esc(chain)}</li>`).join('');

      const next = $('res-next');
      const retry = $('res-retry');
      next.hidden = !r.hasNext;
      $('res-levels').hidden = !r.canLeave;
      // One primary button: the next level, else back to the level list, else retry.
      $('res-levels').classList.toggle('btn-primary', !r.hasNext && r.canLeave);
      retry.classList.toggle('btn-primary', !r.hasNext && !r.canLeave);

      results.hidden = false;
      startConfetti(confetti, r.stars);
      playJingle(r.stars);
    },
    hideResults() { results.hidden = true; stopConfetti(confetti); },
    resultsPrimary() { return results.querySelector('.btn-primary:not([hidden])'); },
  };
}
