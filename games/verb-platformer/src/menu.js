// Title screen + level select. Every level is always selectable (teachers assign levels).
import { t, getLang, setLang, LANGS } from './i18n.js';
import { getBest, formatTime } from './progress.js';
import { starsHtml, helpHtml, esc, CLOCK_SVG } from './shell-bits.js';
import { HEROES, mineInfo } from './player-character.js';
import { getHero, saveHero } from './hero.js';

// onHero(hero): a hero was picked (main.js swaps the player's mesh in the background).
export function createMenu({ levels, onPick, onHero }) {
  const root = document.getElementById('menu');
  const list = document.getElementById('menu-list');
  const playBtn = document.getElementById('play-btn');
  const playLabel = document.getElementById('play-label');
  const playSub = document.getElementById('play-sub');
  const starsTotal = document.getElementById('stars-total');
  const help = document.getElementById('menu-help');
  const langSwitch = document.getElementById('lang-switch');
  const heroPick = document.getElementById('hero-pick');
  const heroTiles = document.getElementById('hero-tiles');
  const figLink = document.getElementById('figure-link');

  // ---- Hero picker (docs/game-contract.md "Hero choice on the start screen") ----
  // Tile 1 = the child's figure (or the Schülerin), preselected; then the free heroes.
  // Hidden when the figure module is missing (file://, bare dev server): the old Ranger
  // plays then and the link would lead nowhere. Never throws.
  let mine = null;                  // { char, own } from the figure module, or null
  const mineP = mineInfo().then(m => { mine = m; }).catch(() => { mine = null; });

  function heroTile(hero) {
    const isMine = hero === 'mine';
    const char = isMine ? mine.char : hero;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'hero-tile';
    btn.dataset.hero = hero;
    btn.setAttribute('role', 'radio');
    const name = isMine ? t('heroMine') : (t(`hero.${hero}`) || hero);
    btn.title = name;
    btn.innerHTML =
      `<span class="hero-pic"><img alt="" width="64" height="64" decoding="async" src="/assets/figures/portraits/${encodeURIComponent(char)}.webp"></span>` +
      `<span class="hero-name">${esc(name)}</span>` +
      `<span class="hero-mine">${isMine && mine.own ? esc(t('figureMine')) : ''}</span>`;
    // no portrait → the first letter in the circle
    btn.querySelector('img').addEventListener('error', (e) => {
      const pic = e.target.parentElement;
      e.target.remove();
      pic.textContent = name.slice(0, 1);
    });
    btn.addEventListener('click', () => choose(hero, false));
    return btn;
  }

  function markChosen(focus) {
    const cur = getHero();
    for (const b of heroTiles.children) {
      const on = b.dataset.hero === cur;
      b.setAttribute('aria-checked', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;               // roving tab stop: Tab reaches the chosen tile
      if (on && focus) b.focus();
    }
  }

  function choose(hero, focus) {
    if (!HEROES.includes(hero)) return;
    saveHero(hero);
    markChosen(focus);
    try { onHero?.(hero); } catch (_) { /* ignore */ }
  }

  // Arrow keys move the choice (radio group).
  heroTiles.addEventListener('keydown', (e) => {
    const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!d) return;
    e.preventDefault();
    const i = HEROES.indexOf(getHero());
    choose(HEROES[(i + d + HEROES.length) % HEROES.length], true);
  });

  function renderHeroes() {
    heroPick.hidden = !mine;
    if (!mine) return;
    heroTiles.innerHTML = '';
    for (const h of HEROES) heroTiles.appendChild(heroTile(h));
    markChosen(false);
    heroTiles.setAttribute('aria-label', t('heroPick'));
    figLink.href = t('figureUrl');
    figLink.textContent = t('figureLink');
  }
  mineP.then(() => { if (!root.hidden) renderHeroes(); });

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
      playSub.textContent = `${t('levelN', n)} · ${t(`name.${nextLevel.id}`) || nextLevel.name}`;
    }
    const got = bests.reduce((s, b) => s + (b ? b.stars : 0), 0);
    starsTotal.innerHTML = levels.length
      ? `<svg class="star on" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.8l3.1 6.5 7.1.9-5.2 4.9 1.3 7-6.3-3.4-6.3 3.4 1.3-7L1.8 9.2l7.1-.9z"/></svg><span>${esc(t('starsTotal', got, levels.length * 3))}</span>`
      : '';

    help.innerHTML = helpHtml();
    renderHeroes();

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
        `<span class="info"><span class="name">${esc(t(`name.${lvl.id}`) || lvl.name)}</span>` +
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
