// Screens (start / level select / post-level), HUD, hint bar.
import { LEVELS, TEASER } from './levels.js';
import { VERBS } from './verbs.js';

const $ = (id) => document.getElementById(id);

export const ui = {
  showScreen(id) {
    for (const s of ['startScreen', 'levelScreen', 'post']) {
      $(s).classList.toggle('hidden', s !== id);
    }
    if (!id) for (const s of ['startScreen', 'levelScreen', 'post']) $(s).classList.add('hidden');
  },

  hud(on) { $('hud').classList.toggle('on', on); },

  renderLevelGrid(save, onPick) {
    const grid = $('levelGrid');
    grid.innerHTML = '';
    LEVELS.forEach((lv, i) => {
      const stars = save.stars[lv.id] || 0;
      const locked = i > 0 && (save.stars[LEVELS[i - 1].id] || 0) < 1;
      const el = document.createElement('div');
      el.className = 'lvl' + (locked ? ' locked' : '');
      const starStr = [1, 2, 3].map((n) => `<span class="${n <= stars ? '' : 'off'}">⭐</span>`).join('');
      el.innerHTML = `${locked ? '<div class="lock">🔒</div>' : ''}<div class="em">${lv.emoji}</div>` +
        `<div class="nm">${lv.name}</div><div class="stars">${starStr}</div>` +
        `<div class="best">${save.best[lv.id] ? '🪙 ' + save.best[lv.id] : '&nbsp;'}</div>`;
      if (!locked) {
        el.style.cursor = 'pointer';
        el.addEventListener('click', () => onPick(i));
      }
      grid.appendChild(el);
    });
    const t = document.createElement('div');
    t.className = 'lvl locked teaser';
    t.innerHTML = `<div class="lock">🔒</div><div class="em">${TEASER.emoji}</div>` +
      `<div class="nm">${TEASER.name}</div><div class="soon">coming soon</div><div class="best">&nbsp;</div>`;
    grid.appendChild(t);
  },

  setCoins(v) { $('coinVal').textContent = v; },
  setTime(sec) {
    const m = Math.floor(Math.max(0, sec) / 60), s = Math.floor(Math.max(0, sec) % 60);
    $('timeVal').textContent = `${m}:${String(s).padStart(2, '0')}`;
    $('timerPill').classList.toggle('frantic', sec <= 30 && sec > 0);
  },
  setCombo(n) {
    const pill = $('comboPill');
    pill.classList.toggle('on', n >= 2);
    if (n >= 2) $('comboVal').textContent = 'x' + n;
  },
  setPlates(n) {
    $('plateVal').textContent = n;
    $('plateCount').classList.toggle('zero', n === 0);
  },
  hint(text) { $('hint').textContent = text || ''; },

  renderPost(level, score, stars, missedKeys, best, hasNext, isNewBest) {
    $('postTitle').textContent = `${level.emoji} ${level.name} — shift over!`;
    $('postScore').textContent = score;
    $('postBest').textContent = isNewBest ? '🎉 New best!' : (best ? `Best: 🪙 ${best}` : '');
    const starEls = [...$('postStars').children];
    starEls.forEach((el, i) => {
      el.classList.remove('on', 'off2');
      if (i < stars) {
        setTimeout(() => el.classList.add('on'), 350 + i * 420);
      } else {
        el.classList.add('off2');
      }
    });
    const box = $('missedBox');
    const list = $('missedList');
    list.innerHTML = '';
    const uniq = [...new Set(missedKeys.map((k) => k.split('|')[0]))];
    box.classList.toggle('empty', uniq.length === 0);
    for (const base of uniq.slice(0, 6)) {
      const v = VERBS.find((x) => x.v === base);
      if (!v) continue;
      const row = document.createElement('div');
      row.innerHTML = `<span class="form-base">${v.v}</span> → <span class="form-past">${v.past}</span> → <span class="form-pp">${v.pp}</span>`;
      list.appendChild(row);
    }
    $('nextBtn').style.display = hasNext && stars >= 1 ? '' : 'none';
    this.showScreen('post');
  },

  async countdown() {
    const cd = $('countdown'), num = $('countNum');
    cd.classList.add('on');
    for (const n of ['3', '2', '1', 'GO!']) {
      num.textContent = n;
      num.style.animation = 'none';
      void num.offsetWidth;          // restart CSS animation
      num.style.animation = '';
      await new Promise((r) => setTimeout(r, n === 'GO!' ? 550 : 750));
    }
    cd.classList.remove('on');
  },

  fade(on) { $('fader').classList.toggle('on', on); },
  loadingNote(t) { $('loadingNote').textContent = t || ''; },

  /** Full-screen loading overlay: a pizza builds slice by slice. */
  loading(on) {
    $('loader').classList.toggle('hidden', !on);
    clearInterval(this._loadTimer);
    if (!on) return;
    const MSGS = ['Rolling the dough', 'Firing up the oven', 'Sharpening the knives',
                  'Polishing the plates', 'Reading the order tickets', 'Tying the apron'];
    const pie = $('loaderPizza'), msg = $('loaderMsg');
    let step = 0;
    const SLICES = 8;
    const draw = () => {
      const n = step % (SLICES + 1);                      // 0..8 slices, then restart
      const deg = n * (360 / SLICES);
      // cheese wedge over dark crust, thin coral "pepperoni" ring on the cheese
      pie.style.background =
        `radial-gradient(circle at 32% 30%, #ff8585 0 7px, transparent 8px),` +
        `radial-gradient(circle at 68% 55%, #ff8585 0 7px, transparent 8px),` +
        `radial-gradient(circle at 42% 70%, #ff8585 0 7px, transparent 8px),` +
        `conic-gradient(#ffcf5e ${deg}deg, #5d4327 ${deg}deg)`;
      if (step % 3 === 0) msg.textContent = MSGS[(step / 3 | 0) % MSGS.length];
      step++;
    };
    draw();
    this._loadTimer = setInterval(draw, 260);
  },
};
