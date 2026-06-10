// HUD, tower buttons, tower-info panel, and all overlays (menu, wave complete, game
// over, victory, quiz). Step 11 added the start menu, heart-icon lives, animated coin,
// end-game button, and highscore display.

const UI = {
  els: {},

  init() {
    this.els.coins           = document.getElementById('coin-count');
    this.els.livesContainer  = document.getElementById('lives-container');
    this.els.wave            = document.getElementById('wave-count');
    this.els.waveTotal       = document.getElementById('wave-total');
    this.els.phaseLabel      = document.getElementById('phase-label');
    this.els.endGameBtn      = document.getElementById('end-game-btn');
    this.els.muteBtn         = document.getElementById('mute-btn');
    this.els.waveBanner      = document.getElementById('wave-banner');
    this.els.towerButtons    = document.getElementById('tower-buttons');
    this.els.towerInfo       = document.getElementById('tower-info');
    this.els.startWaveBtn    = document.getElementById('start-wave-btn');

    this.els.menuOv          = document.getElementById('menu-overlay');
    this.els.levelCards      = document.getElementById('level-cards');

    this.els.waveCompleteOv  = document.getElementById('wave-complete-overlay');
    this.els.waveCompleteNum = document.getElementById('wc-num');
    this.els.waveCompleteBonus = document.getElementById('wc-bonus');
    this.els.gameOverOv      = document.getElementById('game-over-overlay');
    this.els.gameOverWave    = document.getElementById('go-wave');
    this.els.gameOverTotal   = document.getElementById('go-total');
    this.els.gameOverBest    = document.getElementById('go-best');
    this.els.victoryOv       = document.getElementById('victory-overlay');
    this.els.victoryTotal    = document.getElementById('vc-total');
    this.els.victoryBest     = document.getElementById('vc-best');
    this.els.quizOv          = document.getElementById('quiz-overlay');
    this.els.quizPanel       = document.querySelector('.quiz-panel');
    this.els.quizNum         = document.getElementById('quiz-num');
    this.els.quizChain       = document.getElementById('quiz-chain');
    this.els.quizAnswers     = document.getElementById('quiz-answers');
    this.els.quizFeedback    = document.getElementById('quiz-feedback');

    this.onLevelChanged();

    this._buildTowerButtons();
    this._buildLevelCards();
    this._renderHeartsInitial();
    this._wireActions();

    this._towerInfoSig = null;
    this._quizSig = null;
    this._livesSig = null;
    this._quizFbSig = null;
    this._lastCoins = null;
    this._lastLives = null;
    this._lastBannerWave = 0;
    this.els.muteBtn.textContent = Sound.muted ? '🔇' : '🔊';
  },

  _buildTowerButtons() {
    // Real renders of the 3D tower models, photographed by the renderer.
    this._thumbs = Renderer.getTowerThumbnails ? Renderer.getTowerThumbnails() : {};
    const container = this.els.towerButtons;
    container.innerHTML = '';
    for (let i = 0; i < TOWER_ORDER.length; i++) {
      const type = TOWER_ORDER[i];
      const def = CONFIG.TOWERS[type];
      const btn = document.createElement('button');
      btn.className = 'tower-btn';
      btn.dataset.tower = type;
      const thumb = this._thumbs[type]
        ? `<img class="tower-thumb" src="${this._thumbs[type]}" alt="" draggable="false">`
        : `<span class="tower-thumb" style="background:${def.color}"></span>`;
      btn.innerHTML = `
        <span class="tower-btn-hotkey">${i + 1}</span>
        ${thumb}
        <span class="tower-btn-name">${def.name}</span>
        <span class="tower-btn-cost">
          <span class="coin-icon coin-icon-sm"></span>
          ${def.cost}
        </span>
      `;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        Input.toggleTowerPlacement(type);
        btn.blur();
      });
      container.appendChild(btn);
    }
  },

  _renderHeartsInitial() {
    // Empty; will be populated on first update() using Level.current.startingLives as the cap.
    this.els.livesContainer.innerHTML = '';
  },

  // Re-sync everything that depends on the loaded level (totals, hearts cap).
  onLevelChanged() {
    this.els.waveTotal.textContent = Level.current.totalWaves;
    this.els.gameOverTotal.textContent = Level.current.totalWaves;
    this.els.victoryTotal.textContent = Level.current.totalWaves;
    this._livesSig = null;
  },

  // ── Level select (start menu) ───────────────────────────────────────

  _buildLevelCards() {
    const container = this.els.levelCards;
    container.innerHTML = '';
    this._levelBestEls = [];
    LEVELS.forEach((lvl, i) => {
      const card = document.createElement('button');
      card.className = 'level-card';
      card.appendChild(this._paintMinimap(lvl));
      const name = document.createElement('span');
      name.className = 'level-name';
      name.textContent = `${i + 1}. ${lvl.name}`;
      const tag = document.createElement('span');
      tag.className = 'level-tag';
      tag.textContent = lvl.tagline || '';
      const best = document.createElement('span');
      best.className = 'level-best';
      card.append(name, tag, best);
      this._levelBestEls.push(best);
      card.addEventListener('click', () => { Sound.play('click'); startGame(i); });
      container.appendChild(card);
    });
    this._refreshLevelBests();
  },

  _refreshLevelBests() {
    if (!this._levelBestEls) return;
    this._levelBestEls.forEach((el, i) => {
      const best = getHighscore(i);
      el.textContent = best > 0 ? `Best: wave ${best}` : 'Not played yet';
    });
  },

  // Tiny painting of the tile map — one pixel per tile, upscaled by CSS.
  // Returned as an <img> so the card holds a static picture, not a live canvas.
  _paintMinimap(lvl) {
    const c = document.createElement('canvas');
    c.width = lvl.gridWidth;
    c.height = lvl.gridHeight;
    const ctx = c.getContext('2d');
    const COLORS = {
      ground: null, path: '#c4a35a', water: '#3a8fd4',
      obstacle: '#2d5a1e', spawn: '#ffe66d', goal: '#e63946',
    };
    for (let y = 0; y < lvl.gridHeight; y++) {
      for (let x = 0; x < lvl.gridWidth; x++) {
        const type = lvl.tileKey[lvl.tiles[y][x]];
        ctx.fillStyle = COLORS[type] || ((x + y) % 2 === 0 ? '#4a7c2e' : '#528834');
        ctx.fillRect(x, y, 1, 1);
      }
    }
    const img = document.createElement('img');
    img.className = 'level-map';
    img.draggable = false;
    img.alt = `${lvl.name} map`;
    img.src = c.toDataURL('image/png');
    return img;
  },

  _wireActions() {
    this.els.startWaveBtn.addEventListener('click', () => {
      if (state.phase === 'BUILD') Wave.startNext(state);
    });

    this.els.waveCompleteOv.addEventListener('click', () => {
      if (state.phase === 'WAVE_COMPLETE') state.waveCompleteTimer = 0;
    });

    this.els.muteBtn.addEventListener('click', () => {
      const muted = Sound.toggleMute();
      this.els.muteBtn.textContent = muted ? '🔇' : '🔊';
      this.els.muteBtn.blur();
    });

    this.els.endGameBtn.addEventListener('click', () => {
      if (confirm('End this run and return to the menu?')) endGame();
    });

    this.els.towerInfo.addEventListener('click', (e) => {
      const el = e.target.closest('[data-action]');
      if (!el || !state.selectedTower) return;
      if (el.dataset.action === 'upgrade') upgradeTower(state.selectedTower);
      else if (el.dataset.action === 'sell') sellTower(state.selectedTower);
    });

    this.els.quizAnswers.addEventListener('click', (e) => {
      const btn = e.target.closest('.quiz-answer');
      if (!btn) return;
      const idx = parseInt(btn.dataset.index, 10);
      Quiz.answer(state, idx);
    });

    document.querySelectorAll('[data-action="restart"]').forEach((el) => {
      el.addEventListener('click', () => resetRun());
    });
    document.querySelectorAll('[data-action="menu"]').forEach((el) => {
      el.addEventListener('click', () => endGame());
    });
  },

  update(state) {
    // Body state class — CSS uses this to fade/hide the HUD and bottom panel when the
    // game isn't actively playable (menu / game-over / victory).
    const inactive = state.phase === 'MENU'
                  || state.phase === 'GAME_OVER'
                  || state.phase === 'VICTORY';
    document.body.classList.toggle('game-inactive', inactive);
    document.body.classList.toggle('state-menu', state.phase === 'MENU');

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
      const lc = this.els.livesContainer;
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
      b.textContent = boss ? `Wave ${state.currentWave} — BOSS!` : `Wave ${state.currentWave}`;
      b.classList.toggle('boss', boss);
      b.classList.remove('hidden', 'show');
      void b.offsetWidth;
      b.classList.add('show');
    }
    if (state.phase === 'MENU') this._lastBannerWave = 0;
    const PHASE_LABELS = {
      BUILD: '🔨 Build time',
      BATTLE: '⚔️ Battle!',
      WAVE_COMPLETE: '🎉 Wave complete',
      QUIZ: '📖 Verb check',
      GAME_OVER: 'Game over',
      VICTORY: '🏆 Victory!',
    };
    this.els.phaseLabel.textContent = PHASE_LABELS[state.phase] || state.phase;

    // End-game button: visible only during actual gameplay.
    this.els.endGameBtn.classList.toggle('hidden',
      state.phase === 'MENU' || state.phase === 'GAME_OVER' || state.phase === 'VICTORY');

    const gameActive = state.phase === 'BUILD' || state.phase === 'BATTLE';
    const buttons = this.els.towerButtons.children;
    for (const btn of buttons) {
      const type = btn.dataset.tower;
      const cost = CONFIG.TOWERS[type].cost;
      btn.classList.toggle('disabled', state.coins < cost || !gameActive);
      btn.classList.toggle(
        'active',
        state.placement.active && state.placement.towerType === type
      );
    }

    document
      .getElementById('game-container')
      .classList.toggle('placing', state.placement.active);

    this.els.startWaveBtn.classList.toggle('hidden', state.phase !== 'BUILD');
    this.els.startWaveBtn.disabled = state.phase !== 'BUILD';

    // Overlays
    this.els.menuOv.classList.toggle('hidden', state.phase !== 'MENU');
    if (state.phase === 'MENU') this._refreshLevelBests();

    const showWC = state.phase === 'WAVE_COMPLETE';
    this.els.waveCompleteOv.classList.toggle('hidden', !showWC);
    if (showWC) {
      this.els.waveCompleteNum.textContent = state.currentWave;
      this.els.waveCompleteBonus.textContent = Level.current.economy.waveCompletionBonus;
    }

    const showGO = state.phase === 'GAME_OVER';
    this.els.gameOverOv.classList.toggle('hidden', !showGO);
    if (showGO) {
      this.els.gameOverWave.textContent = state.currentWave;
      this.els.gameOverBest.textContent = getHighscore();
    }

    const showV = state.phase === 'VICTORY';
    this.els.victoryOv.classList.toggle('hidden', !showV);
    if (showV) this.els.victoryBest.textContent = getHighscore();

    this._renderTowerInfo(state);
    this._renderQuiz(state);
  },

  _renderHearts(state) {
    const max = Level.current.startingLives;
    const sig = `${state.lives}/${max}`;
    if (sig === this._livesSig) return;
    this._livesSig = sig;

    let html = '';
    for (let i = 0; i < max; i++) {
      const cls = i < state.lives ? 'heart filled' : 'heart empty';
      const glyph = i < state.lives ? '♥' : '♡';
      html += `<span class="${cls}">${glyph}</span>`;
    }
    this.els.livesContainer.innerHTML = html;
  },

  // ── Tower info panel (step 9) ────────────────────────────────────────

  _renderTowerInfo(state) {
    const el = this.els.towerInfo;
    const t = state.selectedTower;
    if (!t) {
      if (this._towerInfoSig !== null) {
        el.classList.add('hidden');
        el.innerHTML = '';
        this._towerInfoSig = null;
      }
      return;
    }

    const up = t.nextUpgrade();
    const sig = [
      t === state.selectedTower ? 'self' : 'other',
      t.type, t.upgradeLevel, t.totalInvested,
      up ? `${up.cost}:${state.coins >= up.cost ? 'y' : 'n'}` : 'max',
    ].join('|');
    if (sig === this._towerInfoSig) return;
    this._towerInfoSig = sig;

    const def = CONFIG.TOWERS[t.type];
    el.classList.remove('hidden');

    const stats = this._towerStatsHtml(t);
    const upgradeBlock = up
      ? `<button class="ti-btn upgrade ${state.coins >= up.cost ? '' : 'disabled'}"
                 data-action="upgrade">
           <span class="ti-btn-label">Upgrade ▸ ${t.upgradeLevel + 1}</span>
           <span class="ti-btn-desc">${up.description}</span>
           <span class="ti-btn-cost"><span class="coin-icon coin-icon-sm"></span>${up.cost}</span>
         </button>`
      : `<div class="ti-btn maxed">Max level</div>`;

    const sellBlock = `
      <button class="ti-btn sell" data-action="sell">
        <span class="ti-btn-label">Sell</span>
        <span class="ti-btn-cost">+<span class="coin-icon coin-icon-sm"></span>${t.sellValue()}</span>
        <span class="ti-btn-hotkey">Del</span>
      </button>`;

    const thumb = (this._thumbs && this._thumbs[t.type])
      ? `<img class="ti-thumb" src="${this._thumbs[t.type]}" alt="" draggable="false">`
      : `<span class="ti-thumb" style="background:${def.color}"></span>`;
    el.innerHTML = `
      ${thumb}
      <div class="ti-header">
        <div class="ti-title">
          <span>${def.name}</span>
          <span class="ti-level">Lv ${t.upgradeLevel}</span>
        </div>
        <div class="ti-desc">${def.description}</div>
        <div class="ti-stats">${stats}</div>
      </div>
      <div class="ti-actions">
        ${upgradeBlock}
        ${sellBlock}
      </div>
    `;
  },

  _towerStatsHtml(t) {
    if (t.type === 'freeze') {
      return `<span>RNG ${t.range.toFixed(1)}</span>
              <span>FREEZE ${t.freezeDuration.toFixed(2)}s</span>
              <span>CD ${t.freezeCooldown.toFixed(1)}s</span>
              ${t.permanentSlow ? '<span class="ti-stat-flag">PERMA-SLOW</span>' : ''}`;
    }
    if (t.type === 'cannon') {
      return `<span>DMG ${t.damage.toFixed(0)}</span>
              <span>RNG ${t.range.toFixed(1)}</span>
              <span>AOE ${t.aoeRadius.toFixed(1)}</span>
              <span>RATE ${t.fireRate.toFixed(2)}/s</span>`;
    }
    if (t.type === 'circleShooter') {
      return `<span>DMG ${t.damage.toFixed(0)}</span>
              <span>RNG ${t.range.toFixed(1)}</span>
              <span>BURST ${t.projectilesPerBurst}</span>
              <span>RATE ${t.fireRate.toFixed(2)}/s</span>`;
    }
    const pierceTag = t.pierceMode === 'hitTwo' ? '<span class="ti-stat-flag">PIERCE ×2</span>'
                    : t.pierceMode === 'infinite' ? '<span class="ti-stat-flag">PIERCE ∞</span>'
                    : '';
    return `<span>DMG ${t.damage.toFixed(0)}</span>
            <span>RNG ${t.range.toFixed(1)}</span>
            <span>RATE ${t.fireRate.toFixed(2)}/s</span>
            ${pierceTag}`;
  },

  // ── Quiz panel (step 10) ─────────────────────────────────────────────

  _renderQuiz(state) {
    const ov = this.els.quizOv;
    if (state.phase !== 'QUIZ' || !state.quiz) {
      ov.classList.add('hidden');
      this._quizSig = null;
      return;
    }
    ov.classList.remove('hidden');

    const q = state.quiz;
    const sig = [
      q.verb.verb, q.questionIndex, q.feedbackActive ? 1 : 0,
      q.selectedAnswer, q.wasCorrect ? 1 : 0, q.choices.join(','),
    ].join('|');
    if (sig === this._quizSig) return;
    this._quizSig = sig;

    // Celebration / shake — once per feedback reveal.
    const fbSig = `${q.verb.verb}|${q.questionIndex}|${q.feedbackActive ? 1 : 0}`;
    if (q.feedbackActive && fbSig !== this._quizFbSig) {
      const panel = this.els.quizPanel;
      panel.classList.remove('celebrate', 'shake');
      void panel.offsetWidth;
      if (q.wasCorrect) {
        panel.classList.add('celebrate');
        this._spawnConfetti(panel);
      } else {
        panel.classList.add('shake');
      }
    }
    this._quizFbSig = fbSig;

    this.els.quizNum.textContent = q.questionIndex + 1;

    const base = q.verb.verb;
    let pastSlot, ppSlot;
    if (q.questionIndex === 0) {
      pastSlot = q.feedbackActive
        ? `<span class="quiz-slot revealed">${q.verb.past}</span>`
        : `<span class="quiz-slot ask">???</span>`;
      ppSlot = `<span class="quiz-slot blank">___</span>`;
    } else {
      pastSlot = `<span class="quiz-slot filled">${q.verb.past}</span>`;
      ppSlot = q.feedbackActive
        ? `<span class="quiz-slot revealed">${q.verb.pp}</span>`
        : `<span class="quiz-slot ask">???</span>`;
    }
    this.els.quizChain.innerHTML = `
      <span class="quiz-slot base">${base}</span>
      <span class="quiz-arrow">→</span>
      ${pastSlot}
      <span class="quiz-arrow">→</span>
      ${ppSlot}
    `;

    let answersHtml = '';
    for (let i = 0; i < q.choices.length; i++) {
      let cls = 'quiz-answer';
      if (q.feedbackActive) {
        cls += ' locked';
        if (i === q.correctIndex) cls += ' correct';
        else if (i === q.selectedAnswer) cls += ' wrong';
      }
      answersHtml += `<button class="${cls}" data-index="${i}">${q.choices[i]}</button>`;
    }
    this.els.quizAnswers.innerHTML = answersHtml;

    if (q.feedbackActive) {
      this.els.quizFeedback.textContent = q.wasCorrect
        ? `Correct! +${Level.current.quiz.coinsPerCorrectAnswer}`
        : `The answer is "${q.questionIndex === 0 ? q.verb.past : q.verb.pp}".`;
      this.els.quizFeedback.className = `quiz-feedback ${q.wasCorrect ? 'ok' : 'bad'}`;
    } else {
      this.els.quizFeedback.textContent = '';
      this.els.quizFeedback.className = 'quiz-feedback';
    }
  },

  // ~28 colorful squares bursting from the panel center; each gets a random
  // trajectory via CSS custom properties and is removed when its animation ends.
  _spawnConfetti(panel) {
    const COLORS = ['#ffd447', '#5bc14a', '#3d7dd8', '#ff6eb4', '#e25c4d', '#9b59d0', '#6cc3d8'];
    for (let i = 0; i < 28; i++) {
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
