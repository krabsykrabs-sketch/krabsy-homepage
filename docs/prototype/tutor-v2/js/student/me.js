// "My Krabsy": the student's own page. Homework, bookshelf, word album, lesson mode.
import { state, VOCAB, SETS, material, farmSteps, cardsOnly, word } from '../data.js';
import { esc, go, on, toast, speak, cover } from '../ui.js';
import { mountPlayer } from './player.js';
import { mountBook } from './book.js';

const SHELF = [
  { id: 'm_book_granja', title: 'La granja', pic: '🐄', tint: 'sage', pages: 8, open: true },
  { id: 'b2', title: '¿Cómo estás?', pic: '😊', tint: 'lav', pages: 8, done: true },
  { id: 'b3', title: 'El picnic', pic: '🧺', tint: 'amber', pages: 10 },
  { id: 'b4', title: 'Mi familia', pic: '👵', tint: 'coral', pages: 10 },
  { id: 'b5', title: '¿Dónde está Tito?', pic: '🐶', tint: 'teal', pages: 8 },
];
const count = set => { const ws = VOCAB.filter(v => v.set === set); return [ws.filter(w => ['sticker', 'gold'].includes(state.album[w.id])).length, ws.length]; };

export function renderMe(root, tab = 'home') {
  const tabs = [['home', '🏠', 'Today'], ['books', '📚', 'Books'], ['album', '⭐', 'Words']];
  root.innerHTML = `<div class="me">
    <header class="me-top"><span class="me-crab">🦀</span><div><h1>¡Hola, Lucas!</h1><p>${tab === 'home' ? 'Nora has left three things for you.' : tab === 'books' ? 'Your bookshelf. Every book is open.' : 'Your word album is filling up.'}</p></div>
      <span class="me-stars">⭐ ${state.stars}</span></header>
    <main class="me-main">${tab === 'books' ? books() : tab === 'album' ? album() : tab === 'lesson' ? lessonMode() : home()}</main>
    <nav class="me-nav">${tabs.map(([id, e, l]) => `<a href="#/me/${id}" class="${tab === id ? 'on' : ''}"><span>${e}</span>${l}</a>`).join('')}</nav>
  </div>`;
  on(root, 'click', '[data-soon]', () => toast('Only “La granja” is in the prototype. The others open the same way.'));
  on(root, 'click', '[data-say]', (e, b) => { speak(b.dataset.say); b.classList.remove('wig'); void b.offsetWidth; b.classList.add('wig'); });
  on(root, 'click', '[data-set]', (e, b) => { root.querySelectorAll('.alb-page').forEach(p => { p.hidden = p.dataset.page !== b.dataset.set; }); root.querySelectorAll('[data-set]').forEach(x => x.classList.toggle('on', x === b)); });
}

function home() {
  const [a, n] = count('animals');
  return `<a class="me-lesson" href="#/me/lesson"><span>🎧</span><span><b>Lesson with Nora today at 15:00</b><br>This page changes by itself when the lesson starts.</span><span class="arr">›</span></a>
  <h2>From Nora</h2>
  <div class="me-cards">
    <a class="me-card tint-sage" href="#/play/m_ws_farm"><span class="art">🚜<i>🐄</i><i>🐔</i></span><span class="body"><small>GAME PAGE · 10 min</small><b>Lucas visits the farm</b>
      <span class="due ${state.wsDone ? 'done' : ''}">${state.wsDone ? '✓ Finished' : 'for Friday'}</span></span></a>
    <a class="me-card tint-amber" href="#/read"><span class="art">📖<i>🏡</i><i>🐷</i></span><span class="body"><small>BOOK · 8 pages</small><b>La granja</b>
      <span class="due ${state.bookDone ? 'done' : ''}">${state.bookDone ? '✓ Finished' : 'for Monday'}</span></span></a>
    <a class="me-card tint-lav" href="#/play/m_pic_animals"><span class="art">🐴<i>🐑</i><i>🦆</i></span><span class="body"><small>PICTURE CARDS · 3 min</small><b>Animals</b>
      <span class="due soft">any time</span></span></a>
  </div>
  <h2>Keep going</h2>
  <a class="me-row" href="#/me/album"><span class="big">⭐</span><span><b>Animals · ${a} of ${n} stickers</b><span class="me-bar"><i style="width:${a / n * 100}%"></i></span></span><span class="arr">›</span></a>
  <h2>Finished</h2>
  <div class="me-done"><span><i>🐈</i>Where is the cat? <b>★★★</b></span><span><i>📋</i>estar · 40 questions <b>★★★</b></span><span><i>😊</i>¿Cómo estás? <b>¡Leído!</b></span></div>`;
}

function books() {
  return `<div class="shelf">${SHELF.map(b => { const done = b.done || (b.open && state.bookDone); return `<${b.open ? 'a href="#/read"' : 'button data-soon'} class="shelf-book tint-${b.tint}">
      <span class="spine"></span><span class="pic">${b.pic}</span><b>${esc(b.title)}</b><small>${b.pages} pages</small>${done ? '<span class="stamp">¡Leído!</span>' : ''}</${b.open ? 'a' : 'button'}>`; }).join('')}</div>
    <p class="me-note">A stamp shows the books you have read. You can read any book again.</p>`;
}

function album() {
  const sets = Object.keys(SETS);
  return `<div class="alb-tabs">${sets.map((s, i) => { const [a, n] = count(s); return `<button data-set="${s}" class="${i === 0 ? 'on' : ''}">${SETS[s].label} <b>${a}/${n}</b></button>`; }).join('')}</div>
    ${sets.map((s, i) => `<section class="alb-page tint-${SETS[s].tint}" data-page="${s}" ${i ? 'hidden' : ''}><h2>${esc(SETS[s].es)}</h2><div class="alb-grid">${VOCAB.filter(v => v.set === s).map((w, k) => {
      const st = state.album[w.id] || 'none';
      return st === 'none' ? `<span class="alb-slot none"><i>${k + 1}</i></span>`
        : `<button class="alb-slot ${st}" data-say="${esc(w.full)}"><span class="pic">${w.pic}</span><b>${st === 'seen' ? '· · ·' : esc(w.full)}</b></button>`;
    }).join('')}</div></section>`).join('')}
    <div class="alb-legend"><span><i class="l-none"></i>not met yet</span><span><i class="l-seen"></i>seen in a book</span><span><i class="l-sticker"></i>answered right</span><span><i class="l-gold"></i>typed right</span></div>`;
}

function lessonMode() {
  return `<div class="me-wait"><div class="dots"><i class="on"></i><i class="on"></i><i></i><i></i><i></i></div><span class="pic">🦀</span><h2>Nora is getting the next thing ready</h2><p>Stay here. It opens by itself.</p><span class="me-stars big">⭐ 4</span>
    <p class="me-note">This is “lesson mode”: no menus, one thing on the screen. To see it working, open <b>Live</b> in the tutor app.</p></div>`;
}

export function renderPlay(root, id) {
  const m = material(id) || material('m_ws_farm');
  const steps = m.kind === 'pictures' ? cardsOnly() : farmSteps();
  mountPlayer(root, steps, { onExit: () => go('#/me'), doneLabel: 'Back to My Krabsy' });
}
export function renderRead(root) {
  mountBook(root, { onExit: done => { if (done) toast('⭐ +3 · “La granja” has a stamp now'); go(done ? '#/me/books' : '#/me'); } });
}
