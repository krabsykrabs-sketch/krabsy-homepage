// Drag with a tap alternative: drag a piece onto a target, or tap the piece and then the target
// (or the target first, then the piece). Pointer events, works with mouse, touch and pen.
export function dragTap(root, { piece, target, onDrop, onPick }) {
  let picked = null, waiting = null, suppress = false;
  const clear = () => {
    picked && picked.classList.remove('is-picked'); waiting && waiting.classList.remove('is-target'); picked = waiting = null;
    root.classList.remove('has-pick'); onPick && onPick(null);
  };
  root.addEventListener('pointerdown', e => {
    const p = e.target.closest(piece);
    if (!p || p.disabled || e.button > 0) return;
    const sx = e.clientX, sy = e.clientY; let ghost = null, over = null;
    const move = ev => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (!ghost && Math.hypot(dx, dy) > 8) {
        const r = p.getBoundingClientRect();
        ghost = p.cloneNode(true); ghost.classList.add('drag-ghost'); ghost.classList.remove('is-picked');
        Object.assign(ghost.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
        document.body.appendChild(ghost); p.classList.add('is-dragging'); clear();
      }
      if (ghost) {
        ghost.style.transform = `translate(${dx}px, ${dy}px) rotate(-3deg) scale(1.06)`;
        const t = hit(ev);
        if (t !== over) { over && over.classList.remove('is-over'); t && t.classList.add('is-over'); over = t; }
      }
    };
    const hit = ev => { const el = document.elementFromPoint(ev.clientX, ev.clientY); const t = el && el.closest(target); return t && root.contains(t) ? t : null; };
    const up = ev => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
      if (!ghost) return;
      ghost.remove(); p.classList.remove('is-dragging'); over && over.classList.remove('is-over');
      suppress = true; setTimeout(() => { suppress = false; }, 50);
      const t = ev.type === 'pointerup' ? hit(ev) : null;
      if (t) onDrop(p, t);
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  });
  root.addEventListener('click', e => {
    if (suppress) return;
    const p = e.target.closest(piece), t = e.target.closest(target);
    if (p && !p.disabled) {
      if (waiting) { const w = waiting; clear(); return onDrop(p, w); }
      const same = picked === p; clear();
      if (!same) { picked = p; p.classList.add('is-picked'); root.classList.add('has-pick'); onPick && onPick(p); }
    } else if (t) {
      if (picked) { const pk = picked; clear(); onDrop(pk, t); }
      else if (!t.classList.contains('is-full')) { const same = waiting === t; clear(); if (!same) { waiting = t; t.classList.add('is-target'); } }
    }
  });
  return { clear, target: () => waiting };
}
