const STORAGE_KEY = 'krabsy_3d_completed';

export function getCompleted() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}

export function markCompleted(id) {
  const c = getCompleted();
  if (!c.includes(id)) {
    c.push(id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
  }
}

export function createMenu({ levels, onPick }) {
  const root = document.getElementById('menu');
  const list = document.getElementById('menu-list');

  function render() {
    const completed = new Set(getCompleted());
    list.innerHTML = '';
    for (const lvl of levels) {
      const btn = document.createElement('button');
      btn.className = 'level-btn';
      const tick = completed.has(lvl.id) ? ' ✓' : '';
      btn.innerHTML = `<span class="title">${lvl.name}</span><span class="tick">${tick}</span>`;
      btn.addEventListener('click', () => onPick(lvl));
      list.appendChild(btn);
    }
  }

  return {
    show() { render(); root.hidden = false; },
    hide() { root.hidden = true; },
  };
}
