/* ──────────────────────────────────────────────────────────────────────────
   Krabsy — shared input helpers
   ES module. One helper for now: wireTwoFieldForm — the past + participle
   typing pattern shared by Type Race and Free Practice.
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Wire a two-input form (past + participle) so that:
 *   • Enter in the PAST field advances focus to the PARTICIPLE field
 *     (does NOT submit, even if PP is empty).
 *   • Enter in the PARTICIPLE field calls onSubmit().
 *   • Tab in the PAST field still advances to PP (native browser behavior,
 *     left alone).
 *   • focusFirst() autofocuses the PAST field — drills call this at the
 *     start of each verb.
 *
 * @param {Object} opts
 * @param {HTMLInputElement} opts.pastInput
 * @param {HTMLInputElement} opts.ppInput
 * @param {Function}         opts.onSubmit   called with no args when PP+Enter
 */
export function wireTwoFieldForm({ pastInput, ppInput, onSubmit }) {
  if (!pastInput || !ppInput) {
    throw new Error('wireTwoFieldForm: pastInput and ppInput are required');
  }

  pastInput.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      // Don't submit; just advance focus.
      ev.preventDefault();
      ppInput.focus();
      // Place cursor at end of PP field
      const v = ppInput.value;
      try { ppInput.setSelectionRange(v.length, v.length); } catch (_) {}
    }
  });

  ppInput.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      if (typeof onSubmit === 'function') onSubmit();
    }
  });

  return {
    focusFirst() {
      try { pastInput.focus({ preventScroll: true }); }
      catch (_) { try { pastInput.focus(); } catch (__) {} }
      const v = pastInput.value;
      try { pastInput.setSelectionRange(v.length, v.length); } catch (_) {}
    },
  };
}
