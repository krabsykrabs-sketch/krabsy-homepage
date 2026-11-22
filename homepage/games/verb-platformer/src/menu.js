// Title screen + level select. Every level is always selectable (teachers assign levels).
import { t, getLang, setLang, LANGS } from './i18n.js';
import { getBest, formatTime } from './progress.js';
import { starsHtml, helpHtml, esc, CLOCK_SVG } from './shell-bits.js';

export function createMenu({ levels, onPick }) {
  const root = document.getElementById('menu');
  const list = document.getElementById('menu-list');
  const playBtn = document.getElementById('play-btn');
  const playLabel = document.getElementById('play-label');
  const playSub = document.getElementById('play-sub');
  const starsTotal = document.getElementById('stars-total');
  const help = document.getElementById('menu-help');
  const langSwitch = document.getElementById('lang-switch');

  let nextLevel = null;

  // The level "Play" starts: the first one never finished, else the first below three stars,
  // else the first.
  function pickNext() {
    return levels.find(l => !getBest(l.id))
      || levels.find(l => getBest(l.id).stars < 3)
      || levels[0];
  }

  function render() {
    // language switch
    langSwitch.innerHTML = '';
    for (const l of LANGS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = l.toUpperCase();
      b.className = l === getLang() ? 'on' : '';
      b.setAttribute('aria-pressed', l === getLang() ? 'true' : 'false');
      b.addEventListener('click', () => { setLang(l); render(); });
      langSwitch.appendChild(b);
    }

    // play button
    nextLevel = pickNext();
    const bests = levels.map(l => getBest(l.id));
    const finished = bests.filter(Boolean).length;
    playBtn.hidden = !nextLevel;
    if (nextLevel) {
      const n = levels.indexOf(nextLevel) + 1;
      playLabel.textContent = finished === 0 ? t('play') : finished >= levels.length ? t('playAgain') : t('playContinue');
      playSub.textContent = `${t('levelN', n)} · ${nextLevel.name}`;
    }
    const got = bests.reduce((s, b) => s + (b ? b.stars : 0), 0);
    starsTotal.innerHTML = levels.length
      ? `<svg class="star on" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.8l3.1 6.5 7.1.9-5.2 4.9 1.3 7-6.3-3.4-6.3 3.4 1.3-7L1.8 9.2l7.1-.9z"/></svg><span>${esc(t('starsTotal', got, levels.length * 3))}</span>`
      : '';

    help.innerHTML = helpHtml();

    // level cards
    list.innerHTML = '';
    levels.forEach((lvl, i) => {
      const best = bests[i];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'level-card' + (lvl === nextLevel ? ' is-next' : '') + (best ? ' is-done' : '');
      btn.dataset.level = lvl.id;
      const idea = t(`idea.${lvl.id}`) || '';
      const tier = Array.isArray(lvl.tiers) && lvl.tiers.length ? Math.max(1, Math.min(3, Math.max(...lvl.tiers))) : 0;
      const dots = tier
        ? `<span class="verb-level" role="img" aria-label="${esc(t('verbsLevel', tier))}">${esc(t('verbs'))} ${[1, 2, 3].map(k => `<i class="${k <= tier ? 'on' : ''}"></i>`).join('')}</span>`
        : '';
      btn.innerHTML =
        `<span class="num">${i + 1}</span>` +
        `<span class="info"><span class="name">${esc(lvl.name)}</span>` +
        `<span class="idea">${esc(idea)}</span>${dots}</span>` +
        `<span class="score">${starsHtml(best ? best.stars : 0)}` +
        `<span class="time" title="${esc(t('bestTime'))}">${best && best.time !== null ? CLOCK_SVG + formatTime(best.time) : '&nbsp;'}</span></span>`;
      btn.addEventListener('click', () => onPick(lvl));
      list.appendChild(btn);
    });
  }

  playBtn.addEventListener('click', () => { if (nextLevel) onPick(nextLevel); });

  return {
    show() { render(); root.hidden = false; },
    hide() { root.hidden = true; },
    get visible() { return !root.hidden; },
    primary() { if (nextLevel) onPick(nextLevel); },
  };
}
