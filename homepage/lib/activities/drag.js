// Drag with a tap alternative: drag a piece onto a target, or tap the piece and then the
// target (or the target first, then the piece). Pointer events: mouse, touch and pen.
// Ported from docs/prototype/tutor-v2/js/student/drag.js, plus hooks so the player can
// put "what is picked / dragged" into its sync state:
//   onPick(piece|null)      a piece was picked (tap) or the pick was cleared
//   onWait(target|null)     a target was tapped first and waits for a piece
//   onDrag(piece|null)      a drag started (piece) or ended (null)
//   onDrop(piece, target)   the answer
// The pieces and targets are found by selector; `.is-full` targets do not wait.
const PAD = 40;   // px around a target that still counts as "on it"

export function dragTap(root, { piece, target, onDrop, onPick, onWait, onDrag }) {
  let picked = null, waiting = null, suppress = false, dead = false;
  const clear = () => {
    const had = picked || waiting;
    picked && picked.classList.remove('is-picked'); waiting && waiting.classList.remove('is-target'); picked = waiting = null;
    root.classList.remove('has-pick');
    if (had) { onPick && onPick(null); onWait && onWait(null); }
  };
  const down = e => {
    const p = e.target.closest(piece);
    if (dead || !p || p.disabled || e.button > 0 || !root.contains(p)) return;
    const sx = e.clientX, sy = e.clientY; let ghost = null, over = null;
    // Forgiving drop (owner 2026-11-26: "you need to be super precise"): the target under the
    // pointer wins; else the target the dragged word overlaps most; else the nearest target
    // within PAD px of the pointer. The highlight while dragging uses the same rule.
    const hit = ev => {
      const el = document.elementFromPoint(ev.clientX, ev.clientY); const t0 = el && el.closest(target);
      if (t0 && root.contains(t0)) return t0;
      const all = [...root.querySelectorAll(target)].filter(t => t.getClientRects().length);
      if (ghost) {
        const g = ghost.getBoundingClientRect(); let best = null, most = 0;
        for (const t of all) {
          const r = t.getBoundingClientRect();
          const a = Math.max(0, Math.min(r.right, g.right) - Math.max(r.left, g.left)) * Math.max(0, Math.min(r.bottom, g.bottom) - Math.max(r.top, g.top));
          if (a > most) { most = a; best = t; }
        }
        if (best) return best;
      }
      let near = null, nd = PAD;
      for (const t of all) {
        const r = t.getBoundingClientRect();
        const d = Math.hypot(Math.max(r.left - ev.clientX, 0, ev.clientX - r.right), Math.max(r.top - ev.clientY, 0, ev.clientY - r.bottom));
        if (d < nd) { nd = d; near = t; }
      }
      return near;
    };
    const move = ev => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (!ghost && Math.hypot(dx, dy) > 8) {
        const r = p.getBoundingClientRect();
        ghost = p.cloneNode(true); ghost.classList.add('drag-ghost'); ghost.classList.remove('is-picked'); ghost.removeAttribute('data-anchor');
        Object.assign(ghost.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
        document.body.appendChild(ghost); p.classList.add('is-dragging'); clear();
        onDrag && onDrag(p);
      }
      if (ghost) {
        ghost.style.transform = `translate(${dx}px, ${dy}px) rotate(-3deg) scale(1.06)`;
        const t = hit(ev);
        if (t !== over) { over && over.classList.remove('is-over'); t && t.classList.add('is-over'); over = t; }
      }
    };
    const up = ev => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
      if (!ghost) return;
      ghost.remove(); p.classList.remove('is-dragging'); over && over.classList.remove('is-over');
      suppress = true; setTimeout(() => { suppress = false; }, 50);
      const t = ev.type === 'pointerup' ? hit(ev) : null;
      onDrag && onDrag(null);
      if (t && !dead) onDrop(p, t);
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  };
  const click = e => {
    if (suppress || dead) return;
    const p = e.target.closest(piece), t = e.target.closest(target);
    if (p && !p.disabled && root.contains(p)) {
      if (waiting) { const w = waiting; clear(); return onDrop(p, w); }
      const same = picked === p; clear();
      if (!same) { picked = p; p.classList.add('is-picked'); root.classList.add('has-pick'); onPick && onPick(p); }
    } else if (t && root.contains(t)) {
      if (picked) { const pk = picked; clear(); onDrop(pk, t); }
      else if (!t.classList.contains('is-full')) { const same = waiting === t; clear(); if (!same) { waiting = t; t.classList.add('is-target'); onWait && onWait(t); } }
    }
  };
  root.addEventListener('pointerdown', down);
  root.addEventListener('click', click);
  return {
    clear,
    target: () => waiting,
    picked: () => picked,
    destroy() { dead = true; root.removeEventListener('pointerdown', down); root.removeEventListener('click', click); },
  };
}
