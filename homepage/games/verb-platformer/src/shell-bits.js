// Small pieces shared by the title screen, the pause card, the first-run hint and the results.
import { t } from './i18n.js';

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
    html += `<p class="help-goal">${esc(t('helpGoal'))} <span class="chain">go → <b>___</b> → gone</span></p>`;
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
