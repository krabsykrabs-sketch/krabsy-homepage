// Small pieces shared by the title screen, the pause card, the first-run hint and the results.
import { t, exampleHtml } from './i18n.js';

// Same test as src/controls.js: the main pointer is a finger.
export const IS_TOUCH = window.matchMedia('(pointer: coarse)').matches
  || (('ontouchstart' in window) && !window.matchMedia('(pointer: fine)').matches);

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const STAR_PATH = 'M12 1.8l3.1 6.5 7.1.9-5.2 4.9 1.3 7-6.3-3.4-6.3 3.4 1.3-7L1.8 9.2l7.1-.9z';

/** Three stars, `n` of them filled. */
export function starsHtml(n, cls = '') {
  let out = '';
  for (let i = 0; i < 3; i++) {
    out += `<svg class="star ${i < n ? 'on' : 'off'}" viewBox="0 0 24 24" aria-hidden="true"><path d="${STAR_PATH}"/></svg>`;
  }
  return `<span class="stars ${cls}" role="img" aria-label="${esc(t('starsOf', n))}">${out}</span>`;
}

export const CLOCK_SVG = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M12 8.5V13l3 2M9.5 2.5h5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';

const key = (label, wide = false) => `<kbd class="key${wide ? ' wide' : ''}">${esc(label)}</kbd>`;

/** Controls help for this device. `withGoal` adds the "land on the word" line with an example. */
export function helpHtml({ withGoal = true } = {}) {
  const rows = IS_TOUCH
    ? [
        [key(t('touchStick'), true), t('helpMove')],
        [key(t('jump'), true), t('helpJump')],
        [key(t('touchSwipe'), true), t('helpLook')],
      ]
    : [
        [key('W') + key('A') + key('S') + key('D'), t('helpMove')],
        [key(t('keySpace'), true), t('helpJump')],
        [key(t('keyMouse'), true), t('helpLook')],
        [key('Esc', true), t('helpPause')],
      ];
  let html = '<div class="help-rows">' + rows.map(([k, label]) =>
    `<span class="help-row"><span class="keys">${k}</span><span>${esc(label)}</span></span>`).join('') + '</div>';
  if (withGoal) {
    html += `<p class="help-goal">${esc(t('helpGoal'))} <span class="chain">${exampleHtml()}</span></p>`;
  }
  return html;
}

// Font for text drawn into canvas textures (question sign, answer bubbles): the site's
// heading font, as in the HUD. Fredoka One has one weight, so no 'bold' (it would be faked).
// main.js waits for it (fontsReady) before a level builds its signs.
export const CANVAS_FONT = "'Fredoka One', 'Nunito', Arial, sans-serif";
export function fontsReady(ms = 2000) {
  if (!document.fonts?.load) return Promise.resolve();
  return Promise.race([
    document.fonts.load("100px 'Fredoka One'").catch(() => {}),
    new Promise(r => setTimeout(r, ms)),
  ]);
}

// ---- Tutorial (level "How to Play", owner 2026-11-28) ----------------------------------
// The big controls card on the start platform (drawn like game key caps, owner's reference
// screenshot) and the small hint banners further on. Level JSON `tips`: [{ id, p, r }].

const ARROW = (dir) => `<svg class="arr arr-${dir}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v16M5 11l7-7 7 7" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const capKey = (letter, dir, cls = '') => `<span class="cap ${cls}">${letter ? `<b>${esc(letter)}</b>` : ''}${dir ? ARROW(dir) : ''}</span>`;
const MOUSE_SVG = '<svg class="mouse" viewBox="0 0 64 96" aria-hidden="true"><rect x="5" y="5" width="54" height="86" rx="27" class="body"/><path d="M32 5v34M5 39h54" class="line"/><rect x="28" y="16" width="8" height="14" rx="4" class="wheel"/></svg>';
const HAND_SVG = '<svg class="hand" viewBox="0 0 64 64" aria-hidden="true"><path d="M8 22h40M40 14l8 8-8 8M56 42H16M24 34l-8 8 8 8" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/** The controls card: every control of this device, big, around the screen edges. */
export function controlsCardHtml() {
  if (IS_TOUCH) {
    return `<div class="cc cc-stick"><span class="cc-label">${esc(t('ctrl.move'))}</span>${ARROW('down')}</div>` +
      `<div class="cc cc-swipe">${HAND_SVG}<span class="cc-label">${esc(t('ctrl.swipe'))}: ${esc(t('ctrl.look'))}</span></div>` +
      `<div class="cc cc-jumpbtn"><span class="cc-label">${esc(t('ctrl.jump'))}</span>${ARROW('down')}</div>`;
  }
  return `<div class="cc cc-wasd"><div class="caps">${capKey('W', 'up')}</div>` +
    `<div class="caps">${capKey('A', 'left')}${capKey('S', 'down')}${capKey('D', 'right')}</div>` +
    `<span class="cc-label">${esc(t('ctrl.move'))}</span></div>` +
    `<div class="cc cc-mouse">${MOUSE_SVG}<span class="cc-label">${esc(t('ctrl.look'))}</span></div>` +
    `<div class="cc cc-space">${capKey(t('keySpace'), null, 'wide')}<span class="cc-label">${esc(t('ctrl.jump'))}</span></div>` +
    `<div class="cc cc-arrows"><div class="caps">${capKey('', 'up')}</div>` +
    `<div class="caps">${capKey('', 'left', 'hi')}${capKey('', 'down')}${capKey('', 'right', 'hi')}</div>` +
    `<span class="cc-label"><small>${esc(t('ctrl.or'))}</small> ${esc(t('ctrl.move'))}</span></div>` +
    `<div class="cc cc-go">${esc(t('ctrl.go'))}</div>`;
}

/** A small hint banner for a tutorial tip (`tip.<id>`), with the key it needs. */
export function tipHtml(id) {
  if (id === 'flag') return esc(t('tip.flag'));
  let k = '';
  if (id === 'jump' || id === 'step') k = IS_TOUCH ? key(t('jump'), true) : key(t('keySpace'), true);
  let html = `${k ? `<span class="keys">${k}</span>` : ''}<span>${esc(t(`tip.${id}`) || '')}</span>`;
  if (id === 'goal') html += ` <span class="chain">${exampleHtml()}</span>`;
  return html;
}
