import { Sound } from './audio.js';
import { CONFIG, TOWER_ORDER } from './config.js';
import { Level, HEX, hexCenter } from './level.js';
import { Renderer } from './renderer.js';
import { Input } from './input.js';
import { Forge } from './forge.js';
import { Questions } from './questions.js';
import { Wave } from './wave.js';
import { t, towerText, levelText } from './i18n.js';
import {
  LEVELS, state, startGame, endGame, resetRun, nextLevel, hasNextLevel, dangerLives,
  getHighscore, getStars, isUnlocked, upgradeTower, sellTower, isTowerLocked,
} from './main.js';

// HUD, bottom dock (tower cards, forge, start wave), tower-info panel, the forge panel
// and all overlays (menu, wave complete, game over, victory, quit). All player-facing
// text comes from i18n.js.

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const COIN = '<span class="coin-icon coin-icon-sm"></span>';
// Small padlock drawn in SVG (no emoji), shown on locked tower cards.
const LOCK_SVG = '<svg viewBox="0 0 24 24" width="22" height="22"><rect x="4.5" y="10.5" width="15" height="10.5" rx="2.5" fill="#ffcf5e" stroke="#0d1b3a" stroke-width="1.8"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="#ffcf5e" stroke-width="2.6"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="#0d1b3a" stroke-width="0.9" opacity="0.5"/><circle cx="12" cy="15.3" r="1.7" fill="#0d1b3a"/></svg>';

export const UI = {
  els: {},

  init() {
    const $ = (id) => document.getElementById(id);
    Object.assign(this.els, {
      coins: $('coin-count'), livesContainer: $('lives-container'), livesCompact: $('lives-compact'),
      wave: $('wave-count'), waveTotal: $('wave-total'), phaseLabel: $('phase-label'),
      endGameBtn: $('end-game-btn'), muteBtn: $('mute-btn'), waveBanner: $('wave-banner'),
      coach: $('coach'), speedBtn: $('speed-btn'), fitBtn: $('fit-btn'),
      vcStars: $('vc-stars'), nextLevelBtn: $('next-level-btn'),
      towerButtons: $('tower-buttons'), towerInfo: $('tower-info'),
      startWaveBtn: $('start-wave-btn'),
      forgePanel: $('forge-panel'), forgeSub: $('forge-sub'), forgeOre: $('forge-ore'),
      forgeLockBar: $('forge-lock-bar'), forgeQuestion: $('forge-question'),
      forgeAnswers: $('forge-answers'), forgeFeedback: $('forge-feedback'),
      menuOv: $('menu-overlay'), levelCards: $('level-cards'),
      waveCompleteOv: $('wave-complete-overlay'), wcTitle: $('wc-title'), wcBonus: $('wc-bonus'),
      gameOverOv: $('game-over-overlay'), goSub: $('go-sub'), goBest: $('go-best'), goRecap: $('go-recap'),
      victoryOv: $('victory-overlay'), vcSub: $('vc-sub'), vcBest: $('vc-best'), vcRecap: $('vc-recap'),
      quitOv: $('quit-overlay'), quitYes: $('quit-yes'), quitNo: $('quit-no'),
    });

    this.onLevelChanged();
    this._buildTowerButtons();
    this._buildLevelCards();
    this._wireActions();

    this._towerInfoSig = null;
    this._forgeSig = null;
    this._forgeFbSig = null;
    this._forgeHeadSig = null;
    this._livesSig = null;
    this._endSig = null;
    this._lastCoins = null;
    this._lastLives = null;
    this._lastBannerWave = 0;
    this._quitOpen = false;
    this._hintSig = null;
    this._soundIcon();
  },

  _buildTowerButtons() {
    // Real renders of the 3D tower models, photographed by the renderer.
    this._thumbs = Renderer.getTowerThumbnails();
    const container = this.els.towerButtons;
    container.innerHTML = '';
    TOWER_ORDER.forEach((type, i) => {
      const def = CONFIG.TOWERS[type];
      const btn = document.createElement('button');
      btn.className = 'tower-btn';
      btn.dataset.tower = type;
      btn.setAttribute('aria-label', `${towerText(type).name}: ${towerText(type).desc}`);
      btn.innerHTML = `
        <span class="tower-btn-hotkey">${i + 1}</span>
        <img class="tower-thumb" src="${this._thumbs[type]}" alt="" draggable="false">
        ${this._specialHtml(type)}
        <span class="tower-btn-name">${esc(towerText(type).name)}</span>
        ${this._statBarsHtml(type)}
        <span class="tower-btn-cost">${COIN}${def.cost}</span>
        <span class="tower-lock" aria-hidden="true">${LOCK_SVG}</span>
      `;
      // Preview before buying: hover (mouse) or long press (touch) shows the
      // description and, when a hex is chosen, the tower's range on the board.
      btn.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') this._preview(type, btn); });
      btn.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') this._preview(null); });
      btn.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse') return;
        clearTimeout(this._pressTimer);
        this._pressTimer = setTimeout(() => { this._longPressed = btn; this._preview(type, btn); }, 420);
      });
      const endPress = () => {
        clearTimeout(this._pressTimer);
        if (this._longPressed === btn) setTimeout(() => this._preview(null), 1200);
      };
      btn.addEventListener('pointerup', endPress);
      btn.addEventListener('pointercancel', endPress);
      btn.addEventListener('contextmenu', (e) => e.preventDefault());
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        // A long press only previews; it never buys.
        if (this._longPressed === btn) { this._longPressed = null; btn.blur(); return; }
        // Locked until an archer stands: shake, and say so above the card.
        if (isTowerLocked(type) && (state.phase === 'BUILD' || state.phase === 'BATTLE')) {
          btn.classList.remove('nope'); void btn.offsetWidth; btn.classList.add('nope');
          Sound.play('nope');
          this._flashPop(btn, t('archerFirst'));
          btn.blur();
          return;
        }
        // Not enough coins: the card shakes and a dull tock plays (no text needed).
        if (state.coins < def.cost && (state.phase === 'BUILD' || state.phase === 'BATTLE')) {
          btn.classList.remove('nope'); void btn.offsetWidth; btn.classList.add('nope');
          Sound.play('nope');
          Forge.noCoins(state, type);
          btn.blur();
          return;
        }
        Input.toggleTowerPlacement(type);
        btn.blur();
      });
      container.appendChild(btn);
    });
    // The dock stays compact (picture + price) and opens while a mouse is over it.
    // Touch has no hover: a long press on a card shows the same details in the popup.
    const dock = document.getElementById('bottom-dock');
    const row = document.getElementById('dock-row');
    row.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') dock.classList.add('open'); });
    row.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') dock.classList.remove('open'); });
  },

  _specialHtml(type) {
    const special = { cannon: '💥', freeze: '❄️' }[type];
    return special ? `<span class="ts-special" aria-hidden="true">${special}</span>` : '';
  },

  // Three small bars compare the towers at a glance (damage, range, speed), plus an
  // icon for what is special. Values come from the tower config, scaled to 1–5.
  _statBarsHtml(type) {
    const d = CONFIG.TOWERS[type];
    const clamp = (v) => Math.max(1, Math.min(5, v));
    const rate = type === 'freeze' ? 1 / (d.freezeCooldown || 4) : d.fireRate;
    const rows = [
      ['⚔️', d.damage > 0 ? clamp(Math.ceil(d.damage / 15)) : 0],
      ['🎯', clamp(Math.round(d.range - 1))],
      ['⏱', clamp(rate >= 1.2 ? 5 : rate >= 0.8 ? 4 : rate >= 0.5 ? 3 : rate >= 0.35 ? 2 : 1)],
    ];
    let html = '<span class="tower-stats" aria-hidden="true">';
    for (const [icon, n] of rows) {
      let segs = '';
      for (let i = 0; i < 5; i++) segs += `<i class="${i < n ? 'on' : ''}"></i>`;
      html += `<span class="ts-row"><span class="ts-icon">${icon}</span><span class="ts-bar">${segs}</span></span>`;
    }
    return html + '</span>';
  },

  // Show (or hide with null) the preview for a tower card: a popup with the name and
  // description above the card, and the range on the board at the chosen hex.
  // A short message in the card popup (e.g. "build an archer first"), then it hides.
  _flashPop(btn, text) {
    const pop = document.getElementById('tower-pop');
    pop.innerHTML = `<span>${esc(text)}</span>`;
    pop.classList.remove('hidden');
    const dock = document.getElementById('bottom-dock').getBoundingClientRect();
    const b = btn.getBoundingClientRect();
    const zoom = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui')) || 1;
    pop.style.left = `${(b.left + b.width / 2 - dock.left) / zoom}px`;
    pop.style.top = `${(b.top - dock.top) / zoom - 8}px`;
    clearTimeout(this._popTimer);
    this._popTimer = setTimeout(() => { if (!state.previewType) pop.classList.add('hidden'); }, 1800);
  },

  _preview(type, btn) {
    // A locked tower gets the popup but no see-through model on the board.
    state.previewType = type && isTowerLocked(type) ? null : type;
    const pop = document.getElementById('tower-pop');
    if (!type) { pop.classList.add('hidden'); return; }
    const text = towerText(type);
    // The compact card shows no stats; the popup carries them (needed on touch).
    const open = document.getElementById('bottom-dock').classList.contains('open');
    pop.innerHTML = `<b>${esc(text.name)}</b>${open ? '' : this._statBarsHtml(type)}<span>${esc(text.desc)}</span>`
      + (isTowerLocked(type) ? `<span class="pop-lock">${esc(t('archerFirst'))}</span>` : '');
    clearTimeout(this._popTimer);
    pop.classList.remove('hidden');
    const dock = document.getElementById('bottom-dock').getBoundingClientRect();
    const b = btn.getBoundingClientRect();
    const zoom = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui')) || 1;
    pop.style.left = `${(b.left + b.width / 2 - dock.left) / zoom}px`;
    pop.style.top = `${(b.top - dock.top) / zoom - 8}px`;
  },

  // Re-sync everything that depends on the loaded level (totals, hearts cap).
  onLevelChanged() {
    this.els.waveTotal.textContent = Level.current.totalWaves;
    this._livesSig = null;
  },

  // ── Level select (start menu) ───────────────────────────────────────

  _buildLevelCards() {
    const container = this.els.levelCards;
    container.innerHTML = '';
    this._levelCards = [];
    LEVELS.forEach((lvl, i) => {
      const text = levelText(i);
      const card = document.createElement('button');
      card.className = 'level-card';
      card.appendChild(this._paintMinimap(lvl, text.name));
      const name = document.createElement('span');
      name.className = 'level-name';
      name.textContent = `${i + 1}. ${text.name}`;
      const tag = document.createElement('span');
      tag.className = 'level-tag';
      tag.textContent = text.tag;
      const stars = document.createElement('span');
      stars.className = 'level-stars';
      const best = document.createElement('span');
      best.className = 'level-best';
      card.append(name, tag, stars, best);
      this._levelCards.push({ card, stars, best });
      card.addEventListener('click', () => {
        if (!isUnlocked(i)) return;
        Sound.play('click');
        startGame(i);
      });
      container.appendChild(card);
    });
    this._refreshLevelCards();
  },

  // Stars, best wave and the lock on each level card (re-read when the menu shows).
  _refreshLevelCards() {
    if (!this._levelCards) return;
    this._levelCards.forEach(({ card, stars, best }, i) => {
      const open = isUnlocked(i);
      const got = getStars(i);
      card.classList.toggle('locked', !open);
      stars.innerHTML = open ? this._starsHtml(got) : '🔒';
      const wave = getHighscore(i);
      if (!open) best.textContent = t('locked', i);
      else if (got > 0) best.textContent = '';
      else best.textContent = wave > 0 ? t('levelBest', wave) : t('notPlayed');
    });
  },

  _starsHtml(n) {
    let html = '';
    for (let i = 0; i < 3; i++) html += `<span class="star ${i < n ? 'on' : ''}">★</span>`;
    return html;
  },

  // Tiny painting of the hex map: grass, the road, spawn (coral) and castles (blue).
  // Returned as an <img> so the card holds a static picture, not a live canvas.
  _paintMinimap(lvl, label) {
    const S = 10; // pixels per world unit
    const c = document.createElement('canvas');
    c.width = (lvl.cols * HEX.WIDTH + 1) * S;
    c.height = ((lvl.rows - 1) * HEX.ROW + 2 * HEX.RADIUS) * S;
    const ctx = c.getContext('2d');
    ctx.fillStyle = { fall: '#c98436', winter: '#c9d8de' }[lvl.season] || '#62a83c';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = { fall: '#0a8079', winter: '#0b6f84' }[lvl.season] || '#2f86c6';
    for (const [wc, wr] of lvl.water || []) {
      const p = hexCenter(wc, wr);
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const ang = Math.PI / 6 + k * Math.PI / 3; // pointy-top hexagon
        const hx = (p.x + Math.cos(ang) * HEX.RADIUS * 1.02) * S, hy = (p.y + Math.sin(ang) * HEX.RADIUS * 1.02) * S;
        if (k === 0) ctx.moveTo(hx, hy); else ctx.lineTo(hx, hy);
      }
      ctx.fill();
    }
    const dot = (cell, color, radius) => {
      const p = hexCenter(cell[0], cell[1]);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.x * S, p.y * S, radius * S, 0, Math.PI * 2);
      ctx.fill();
    };
    for (const path of lvl.paths) {
      ctx.strokeStyle = lvl.season === 'winter' ? '#7f9aa6' : '#e6c08a';
      ctx.lineWidth = 0.7 * S;
      ctx.lineJoin = ctx.lineCap = 'round';
      ctx.beginPath();
      path.cells.forEach((cell, i) => {
        const p = hexCenter(cell[0], cell[1]);
        if (i === 0) ctx.moveTo(p.x * S, p.y * S); else ctx.lineTo(p.x * S, p.y * S);
      });
      ctx.stroke();
    }
    for (const path of lvl.paths) {
      dot(path.cells[0], '#ff8585', 0.8);
      dot(path.cells[path.cells.length - 1], '#2a6fd6', 1.0);
    }
    const img = document.createElement('img');
    img.className = 'level-map';
    img.draggable = false;
    img.alt = label;
    img.src = c.toDataURL('image/png');
    return img;
  },

  _wireActions() {
    this.els.startWaveBtn.addEventListener('click', () => {
      if (state.phase !== 'BUILD') return;
      Wave.startNext(state);
    });

    this.els.forgeAnswers.addEventListener('click', (e) => {
      const btn = e.target.closest('.forge-answer');
      if (btn) Forge.answer(state, parseInt(btn.dataset.index, 10));
    });

    this.els.waveCompleteOv.addEventListener('click', () => {
      if (state.phase === 'WAVE_COMPLETE') state.waveCompleteTimer = 0;
    });

    this.els.muteBtn.addEventListener('click', () => {
      Sound.cycleMode();
      this._soundIcon();
      this.els.muteBtn.blur();
    });

    // Leaving a run asks first, in the page (native dialogs are awkward in an iframe).
    this.els.fitBtn.addEventListener('click', () => { Renderer.resetView(true); this.els.fitBtn.blur(); });
    this.els.speedBtn.addEventListener('click', () => {
      state.speed = state.speed === 1 ? 2 : 1;
      this.els.speedBtn.blur();
    });
    this.els.nextLevelBtn.addEventListener('click', () => nextLevel());

    this.els.endGameBtn.addEventListener('click', () => { this._quitOpen = true; });
    this.els.quitNo.addEventListener('click', () => { this._quitOpen = false; });
    this.els.quitYes.addEventListener('click', () => { this._quitOpen = false; endGame(); });

    this.els.towerInfo.addEventListener('click', (e) => {
      const el = e.target.closest('[data-action]');
      if (!el || !state.selectedTower) return;
      if (el.dataset.action === 'upgrade') upgradeTower(state.selectedTower);
      else if (el.dataset.action === 'sell') sellTower(state.selectedTower);
    });

    document.querySelectorAll('[data-action="restart"]').forEach((el) => {
      el.addEventListener('click', () => resetRun());
    });
    document.querySelectorAll('[data-action="menu"]').forEach((el) => {
      el.addEventListener('click', () => endGame());
    });
  },

  update(state) {
    // Body state class — CSS hides the HUD and the dock when the game isn't playable.
    const inactive = state.phase === 'MENU' || state.phase === 'GAME_OVER' || state.phase === 'VICTORY';
    document.body.classList.toggle('game-inactive', inactive);
    document.body.classList.toggle('state-menu', state.phase === 'MENU');
    const playing = state.phase === 'BUILD' || state.phase === 'BATTLE';
    if (!playing && state.phase !== 'WAVE_COMPLETE') this._quitOpen = false;

    this.els.coins.textContent = state.coins;
    // Bounce the coin chip whenever the total goes up.
    if (this._lastCoins !== null && state.coins > this._lastCoins) {
      const chip = this.els.coins.parentElement;
      chip.classList.remove('pop');
      void chip.offsetWidth; // restart the CSS animation
      chip.classList.add('pop');
    }
    this._lastCoins = state.coins;

    // Shake the hearts when a life is lost.
    if (this._lastLives !== null && state.lives < this._lastLives) {
      const lc = this.els.livesContainer.parentElement;
      lc.classList.remove('hurt');
      void lc.offsetWidth;
      lc.classList.add('hurt');
    }
    this._lastLives = state.lives;

    this._renderHearts(state);
    this.els.wave.textContent = state.currentWave;

    // Wave banner — announce each new wave as BATTLE begins.
    if (state.phase === 'BATTLE' && state.currentWave !== this._lastBannerWave) {
      this._lastBannerWave = state.currentWave;
      const b = this.els.waveBanner;
      const boss = Wave.isBossWave(state.currentWave);
      b.textContent = boss ? t('bossBanner', state.currentWave) : t('waveBanner', state.currentWave);
      b.classList.toggle('boss', boss);
      b.classList.remove('hidden', 'show');
      void b.offsetWidth;
      b.classList.add('show');
    }
    if (state.phase === 'MENU') this._lastBannerWave = 0;

    const PHASE_KEYS = { BUILD: 'phaseBuild', BATTLE: 'phaseBattle', WAVE_COMPLETE: 'phaseWaveDone' };
    this.els.phaseLabel.textContent = PHASE_KEYS[state.phase] ? t(PHASE_KEYS[state.phase]) : '';
    this.els.fitBtn.classList.toggle('hidden', !Renderer.isZoomed() || !playing);
    this.els.speedBtn.textContent = `×${state.speed}`;
    this.els.speedBtn.classList.toggle('fast', state.speed > 1);
    this._renderHint(state);

    for (const btn of this.els.towerButtons.children) {
      const type = btn.dataset.tower;
      const locked = isTowerLocked(type);
      btn.classList.toggle('locked', locked);
      btn.classList.toggle('disabled', locked || state.coins < CONFIG.TOWERS[type].cost || !playing);
      btn.classList.toggle('active', state.placement.active && state.placement.towerType === type);
      btn.classList.toggle('build-here', !locked && !!state.buildCell && state.coins >= CONFIG.TOWERS[type].cost);
      btn.classList.toggle('hint-pulse', !!state.hint && state.hint.target === `tower:${type}`);
    }
    document.getElementById('game-container').classList.toggle('placing', state.placement.active);

    this.els.startWaveBtn.classList.toggle('hidden', state.phase !== 'BUILD');
    this.els.startWaveBtn.disabled = state.phase !== 'BUILD';

    // Overlays
    this.els.menuOv.classList.toggle('hidden', state.phase !== 'MENU');
    const menuNow = state.phase === 'MENU';
    if (menuNow && !this._menuWas) this._refreshLevelCards();
    this._menuWas = menuNow;

    const showWC = state.phase === 'WAVE_COMPLETE';
    this.els.waveCompleteOv.classList.toggle('hidden', !showWC);
    if (showWC) {
      this.els.wcTitle.textContent = t('waveDone', state.currentWave);
      this.els.wcBonus.textContent = Level.current.economy.waveCompletionBonus;
    }

    this._renderEndScreens(state);
    this.els.quitOv.classList.toggle('hidden', !this._quitOpen);

    this._renderForge(state);
    this._renderTowerInfo(state);
  },

  // Tutorial coach line + a pulse on the thing to press.
  _renderHint(state) {
    const h = state.hint;
    const sig = h ? `${h.key}|${h.target}` : '';
    if (sig === this._hintSig) return;
    this._hintSig = sig;
    this.els.coach.classList.toggle('hidden', !h);
    if (h) this.els.coach.textContent = t(h.key);
    this.els.startWaveBtn.classList.toggle('hint-pulse', !!h && h.target === 'start');
    this.els.forgePanel.classList.toggle('hint-pulse', !!h && h.target === 'forge');
    this.els.towerButtons.classList.toggle('hint-pulse', !!h && h.target === 'towers');
    this.els.towerInfo.classList.toggle('hint-upgrade', !!h && h.target === 'upgrade');
  },

  // Speaker button: 🔊 all, 🔈 effects only (no music), 🔇 off.
  _soundIcon() {
    this.els.muteBtn.textContent = { all: '🔊', sfx: '🔈', off: '🔇' }[Sound.mode];
  },

  _renderHearts(state) {
    const max = Level.current.startingLives;
    const sig = `${state.lives}/${max}`;
    if (sig === this._livesSig) return;
    this._livesSig = sig;

    let html = '';
    for (let i = 0; i < max; i++) {
      html += i < state.lives ? '<span class="heart filled">♥</span>' : '<span class="heart empty">♥</span>';
    }
    this.els.livesContainer.innerHTML = html;
    this.els.livesCompact.textContent = `♥ ${state.lives}`; // shown instead on phones
    const danger = state.lives > 0 && state.lives <= dangerLives();
    this.els.livesContainer.parentElement.classList.toggle('danger', danger);
    document.getElementById('danger-vignette').classList.toggle('on', danger);
  },

  // ── Game over / victory, with the verbs to practise ─────────────────

  _renderEndScreens(state) {
    // The defeat / victory scene plays first; the panel comes when it ends (tap skips).
    const ready = state.endT <= 0;
    const showGO = state.phase === 'GAME_OVER' && ready;
    const showV = state.phase === 'VICTORY' && ready;
    document.getElementById('danger-vignette').classList.toggle('defeat', state.phase === 'GAME_OVER');
    this.els.gameOverOv.classList.toggle('hidden', !showGO);
    this.els.victoryOv.classList.toggle('hidden', !showV);
    if (!showGO && !showV) { this._endSig = null; return; }
    const sig = `${state.phase}|${state.currentWave}`;
    if (sig === this._endSig) return;
    this._endSig = sig;

    const total = Level.current.totalWaves;
    const best = t('best', Math.max(getHighscore(), state.currentWave));
    const recap = this._recapHtml(state);
    if (showGO) {
      // How far you got, as dots: one per wave, filled up to the wave reached.
      let dots = '';
      for (let i = 1; i <= total; i++) dots += `<span class="wdot ${i < state.currentWave ? 'done' : i === state.currentWave ? 'lost' : ''}"></span>`;
      document.getElementById('go-dots').innerHTML = dots;
      this.els.goSub.textContent = t('reached', state.currentWave, total);
      this.els.goBest.textContent = best;
      this.els.goRecap.innerHTML = recap;
    } else {
      this.els.vcStars.innerHTML = this._starsHtml(state.starsEarned);
      this.els.nextLevelBtn.classList.toggle('hidden', !hasNextLevel());
      this.els.vcSub.textContent = t('victorySub', total);
      this.els.vcBest.textContent = best;
      this.els.vcRecap.innerHTML = recap;
      // Stars slam in one by one, each with its own note, then confetti.
      for (let i = 0; i < state.starsEarned; i++) setTimeout(() => Sound.play('star', i), 350 + i * 330);
      setTimeout(() => this._spawnConfetti(this.els.victoryOv.querySelector('.overlay-panel'), 48), 350 + state.starsEarned * 330);
    }
  },

  _recapHtml(state) {
    const { asked, right } = state.stats;
    if (asked === 0) return '';
    let html = `<div class="recap-score">${esc(t('score', right, asked))}</div>`;
    const missed = [...Questions.missed.values()].sort((a, b) => b.times - a.times).slice(0, 6);
    if (missed.length === 0) return html + `<div class="recap-perfect">${esc(t('recapPerfect'))}</div>`;
    html += `<div class="recap-title">${esc(t('recapTitle'))}</div><div class="recap-list">`;
    for (const m of missed) html += `<div class="recap-line">${this._chainHtml(m.q)}</div>`;
    return html + '</div>';
  },

  // go → went → gone in the house colours, or the sentence with the gap filled.
  _chainHtml(q) {
    const c = q.teach && q.teach.chain;
    if (q.display.kind === 'trio' && c) {
      const arrow = ' <span class="recap-arrow">→</span> ';
      return `<span class="form-base">${esc(c.base)}</span>${arrow}<span class="form-past">${esc(c.past)}</span>${arrow}<span class="form-part">${esc(c.participle)}</span>`;
    }
    return esc(Questions.solutionLine(q));
  },

  // ── Tower info panel ─────────────────────────────────────────────────

  _renderTowerInfo(state) {
    const el = this.els.towerInfo;
    const tw = state.selectedTower;
    if (!tw) {
      if (this._towerInfoSig !== null) {
        el.classList.add('hidden');
        el.innerHTML = '';
        this._towerInfoSig = null;
      }
      return;
    }

    const up = tw.nextUpgrade();
    const sig = [
      tw.type, tw.cellX, tw.cellY, tw.upgradeLevel, tw.totalInvested,
      up ? `${up.cost}:${state.coins >= up.cost ? 'y' : 'n'}` : 'max',
    ].join('|');
    if (sig === this._towerInfoSig) return;
    this._towerInfoSig = sig;

    const text = towerText(tw.type);
    el.classList.remove('hidden');

    const upgradeBlock = up
      ? `<button class="btn btn-teal ti-btn ${state.coins >= up.cost ? '' : 'disabled'}" data-action="upgrade">
           <span>${esc(t('upgrade'))}</span>
           <span class="ti-btn-desc">${esc(text.ups[tw.upgradeLevel] || '')}</span>
           <span class="ti-btn-cost">${COIN}${up.cost}</span>
         </button>`
      : `<div class="ti-btn maxed">${esc(t('maxLevel'))}</div>`;

    el.innerHTML = `
      <img class="ti-thumb" src="${this._thumbs[tw.type]}" alt="" draggable="false">
      <div class="ti-header">
        <div class="ti-title">
          <span>${esc(text.name)}</span>
          <span class="ti-level">${esc(t('level'))} ${tw.upgradeLevel + 1}</span>
        </div>
        <div class="ti-desc">${esc(text.desc)}</div>
        <div class="ti-stats">${this._towerStatsHtml(tw)}</div>
      </div>
      <div class="ti-actions">
        ${upgradeBlock}
        <button class="btn btn-ghost ti-btn" data-action="sell">
          <span>${esc(t('sell'))}</span>
          <span class="ti-btn-cost">+${COIN}${tw.sellValue()}</span>
        </button>
      </div>
    `;
  },

  _towerStatsHtml(tw) {
    const stat = (key, value) => `<span>${esc(t(key))} <b>${value}</b></span>`;
    const flag = (key) => `<span class="ti-stat-flag">${esc(t(key))}</span>`;
    if (tw.type === 'freeze') {
      return stat('statRange', tw.range.toFixed(1))
           + stat('statFreeze', `${tw.freezeDuration.toFixed(1)} s`)
           + stat('statPause', `${tw.freezeCooldown.toFixed(1)} s`)
           + (tw.permanentSlow ? flag('flagSlow') : '');
    }
    let html = stat('statDamage', tw.damage.toFixed(0))
             + stat('statRange', tw.range.toFixed(1))
             + stat('statRate', `${tw.fireRate.toFixed(1)}/s`);
    if (tw.aoeRadius > 0) html += stat('statArea', tw.aoeRadius.toFixed(1));
    if (tw.pierceMode === 'chain1') html += flag('flagChain1');
    if (tw.pierceMode === 'chain2') html += flag('flagChain2');
    return html;
  },

  // ── Forge card (questions for coins, always visible) ────────────────

  _renderForge(state) {
    const f = state.forge;
    const panel = this.els.forgePanel;
    if (!Forge.active(state)) {
      panel.classList.add('hidden');
      this._forgeSig = null;
      this._forgeHeadSig = null;
      return;
    }
    if (panel.classList.contains('hidden')) {
      // Slides in (first time in level 1, or a new run).
      panel.classList.remove('hidden', 'reveal'); void panel.offsetWidth; panel.classList.add('reveal');
    }

    // Head: questions left this wave, what the next right answer pays, the streak.
    const headSig = `${f.ore}|${f.streak}`;
    if (headSig !== this._forgeHeadSig) {
      this._forgeHeadSig = headSig;
      this.els.forgeOre.textContent = f.ore;
      let sub = esc(t('forgeSub', Forge.reward(f.streak)));
      if (f.streak >= 2) sub += ` · <span class="streak">🔥 ${esc(t('streak', f.streak))}</span>`;
      this.els.forgeSub.innerHTML = sub;
    }

    // Lock bar after a wrong answer (updated every frame, it is one style write).
    this.els.forgeLockBar.style.width = f.stage === 'wrong' && f.lock > 0
      ? `${Math.max(0, f.timer / f.lock) * 100}%` : '0';

    const q = f.q;
    const sig = q ? `${q.id}|${f.stage}|${f.picked}|${q.options.join(',')}` : `empty|${state.phase === 'BUILD'}`;
    if (sig === this._forgeSig) return;
    this._forgeSig = sig;

    if (!q) {
      this.els.forgeQuestion.innerHTML = `<span class="q-empty">${esc(t(state.phase === 'BUILD' ? 'forgeEmptyBuild' : 'forgeEmpty'))}</span>`;
      this.els.forgeAnswers.innerHTML = '';
      this.els.forgeFeedback.className = 'forge-feedback';
      this.els.forgeFeedback.innerHTML = '';
      return;
    }
    const answered = f.stage === 'right' || f.stage === 'wrong';

    // Celebration / shake — once per feedback reveal.
    const fbSig = `${q.id}|${f.stage}|${state.stats.asked}`;
    if (answered && fbSig !== this._forgeFbSig) {
      panel.classList.remove('celebrate', 'shake');
      void panel.offsetWidth;
      if (f.stage === 'right') { panel.classList.add('celebrate'); this._spawnConfetti(panel); }
      else panel.classList.add('shake');
    }
    this._forgeFbSig = fbSig;

    this.els.forgeQuestion.innerHTML = this._questionHtml(q, answered);

    const KEYS = ['Q', 'W', 'E'];
    let answersHtml = '';
    q.options.forEach((opt, i) => {
      let cls = 'forge-answer';
      if (answered) {
        cls += ' locked';
        if (i === q.correctIndex) cls += ' correct';
        else if (i === f.picked) cls += ' wrong';
      }
      const gain = f.stage === 'right' && i === q.correctIndex
        ? `<span class="gain-pop">+${f.lastGain}</span>` : '';
      answersHtml += `<button class="${cls}" data-index="${i}"><span class="key">${KEYS[i] || ''}</span>${esc(opt)}${gain}</button>`;
    });
    this.els.forgeAnswers.innerHTML = answersHtml;

    const fb = this.els.forgeFeedback;
    if (f.stage === 'right') {
      fb.className = 'forge-feedback ok';
      fb.innerHTML = `${esc(t('forgeRight', f.lastGain))} ${COIN}`;
    } else if (f.stage === 'wrong') {
      fb.className = 'forge-feedback bad';
      fb.textContent = t('forgeWrong');
      // Sentence topics: the short rule teaches why (verbs show the whole chain instead).
      if (q.display.kind === 'gap' && q.teach && q.teach.line) {
        fb.innerHTML += `<div class="forge-teach">${esc(q.teach.line)}</div>`;
      }
    } else {
      fb.className = 'forge-feedback';
      fb.innerHTML = '';
    }
  },

  // The question itself. Verbs: go → [ ? ] → ___ with the asked blank highlighted —
  // the position in the chain is the question, no grammar terms. After the answer the
  // full chain is shown, with the terms as small captions.
  _questionHtml(q, answered) {
    const d = q.display;
    if (d.kind === 'gap') {
      const fill = answered ? esc(q.answer) : '?';
      return `<div class="q-sentence">${esc(d.sentence).replace(/_{2,}/, `<span class="q-gap">${fill}</span>`)}</div>`;
    }
    const chain = q.teach && q.teach.chain;
    const captions = t('forgeCaption');
    const forms = ['form-base', 'form-past', 'form-part'];
    const slot = (index, word, cls) => `
      <span class="q-slot ${cls}">
        <span class="q-word ${cls === 'shown' ? forms[index] : ''}">${esc(word)}</span>
        <span class="q-caption">${answered && cls === 'shown' ? esc(captions[index]) : ''}</span>
      </span>`;
    const arrow = '<span class="q-arrow">→</span>';
    // When this verb's 3rd form is asked next, keep it hidden after this answer —
    // otherwise the reveal would give the follow-up away.
    const next = Questions.followUp;
    const thirdComes = d.askIndex === 0 && next && next.display.kind === 'trio' && next.display.base === d.base;
    let html = slot(0, d.base, 'shown');
    d.slots.forEach((s, i) => {
      html += arrow;
      if (answered && thirdComes && i === 1) html += slot(i + 1, '___', 'blank');
      else if (answered && chain) html += slot(i + 1, i === 0 ? chain.past : chain.participle, 'shown');
      else if (answered && i === d.askIndex) html += slot(i + 1, q.answer, 'shown');
      else if (i === d.askIndex) html += slot(i + 1, '?', 'ask');
      else html += slot(i + 1, s.text != null ? s.text : '___', s.text != null ? 'shown' : 'blank');
    });
    return html;
  },

  // Coloured squares bursting from the panel centre; each gets a random trajectory
  // via CSS custom properties and is removed when its animation ends.
  _spawnConfetti(panel, count = 24) {
    const COLORS = ['#2ee6c0', '#ff8585', '#ffcf5e', '#ffffff'];
    for (let i = 0; i < count; i++) {
      const c = document.createElement('span');
      c.className = 'confetti';
      const angle = Math.random() * Math.PI * 2;
      const dist = 90 + Math.random() * 160;
      c.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
      c.style.setProperty('--dy', `${Math.sin(angle) * dist * 0.7 - 60}px`);
      c.style.setProperty('--rot', `${(Math.random() - 0.5) * 720}deg`);
      c.style.background = COLORS[i % COLORS.length];
      c.style.animationDelay = `${Math.random() * 0.1}s`;
      c.addEventListener('animationend', () => c.remove());
      panel.appendChild(c);
    }
  },
};
