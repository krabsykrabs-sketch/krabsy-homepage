// All DOM-side UI: HUD, challenge banner, toasts, overlays, confetti.
const $ = (id) => document.getElementById(id);

const SLOT_CLASS = { base: 'base', past: 'past', pp: 'pp' };

// Build the colored verb-chain chips. `gapSlot` = 'past' | 'pp' | 'both' | null.
export function chainHTML(verb, gapSlot = null) {
  const chip = (text, slot, gap) => gap
    ? `<span class="chip gap ${slot}-c">?</span>`
    : `<span class="chip ${SLOT_CLASS[slot]}">${text.toUpperCase()}</span>`;
  const arr = `<span class="arr">→</span>`;
  return chip(verb.v, 'base', false) + arr +
    chip(verb.past, 'past', gapSlot === 'past' || gapSlot === 'both') + arr +
    chip(verb.pp, 'pp', gapSlot === 'pp' || gapSlot === 'both');
}

export const ui = {
  init({ onStart, onAgain, onMute }) {
    $('btn-start').addEventListener('click', onStart);
    $('btn-again').addEventListener('click', onAgain);
    $('btn-mute').addEventListener('click', onMute);
  },

  setMuteIcon(muted) { $('btn-mute').textContent = muted ? '🔇' : '🔊'; },

  showHud() { $('hud').classList.remove('hidden'); },

  setHearts(n) {
    [...$('hp').children].forEach((el, i) => el.classList.toggle('off', i >= n));
  },
  setScore(n) { $('score-val').textContent = n; },
  setMastered(n) { $('mastered-val').textContent = n; },

  showSkelCounter(n) { $('skel-chip').classList.add('show'); this.setSkelCounter(n); },
  setSkelCounter(n) { $('skel-val').textContent = n; },
  hideSkelCounter() { $('skel-chip').classList.remove('show'); },

  showChallenge(html) {
    const el = $('challenge');
    el.innerHTML = `<span class="lbl">Open with</span>${html}`;
    el.classList.remove('hidden');
  },
  hideChallenge() { $('challenge').classList.add('hidden'); },

  toast(html, { dur = 2600, kind = '' } = {}) {
    const box = $('toasts');
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.innerHTML = html;
    box.appendChild(el);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 380); }, dur);
  },

  hint(text, dur = 4200) {
    const el = $('hint');
    el.textContent = text;
    el.classList.remove('hidden');
    clearTimeout(this._hintT);
    this._hintT = setTimeout(() => el.classList.add('hidden'), dur);
  },

  // floating "BONK!"-style text at screen coordinates
  pop(x, y, text, color = '#ffcf5e') {
    const el = document.createElement('div');
    el.className = 'pop';
    el.style.left = `${x}px`; el.style.top = `${y}px`; el.style.color = color;
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 950);
  },

  showTitle() {
    const el = $('title-banner');
    el.classList.remove('show');
    void el.offsetWidth; // restart animation
    el.classList.add('show');
  },

  fade(on) { $('fade').classList.toggle('on', on); },

  showStartBest(best) {
    $('start-best').innerHTML = best > 0 ? `Best score: <b>${best}</b> ✨` : '';
  },
  hideStart() { $('start').classList.add('hidden'); },

  showWin({ score, best, chains }) {
    $('win-score').textContent = score;
    $('win-best').textContent = best;
    $('win-chains').innerHTML = chains
      .map((v) => `<div class="row">${chainHTML(v)}</div>`)
      .join('');
    $('win').classList.remove('hidden');
    this.confetti();
  },

  confetti() {
    const box = $('confetti');
    const colors = ['#2ee6c0', '#ff8585', '#ffcf5e', '#9db4dd', '#ffffff'];
    for (let i = 0; i < 90; i++) {
      const el = document.createElement('div');
      el.className = 'cf';
      el.style.left = `${Math.random() * 100}vw`;
      el.style.background = colors[i % colors.length];
      el.style.animationDuration = `${2.2 + Math.random() * 2.6}s`;
      el.style.animationDelay = `${Math.random() * 1.6}s`;
      el.style.transform = `rotate(${Math.random() * 360}deg)`;
      box.appendChild(el);
      setTimeout(() => el.remove(), 6500);
    }
  },
};
