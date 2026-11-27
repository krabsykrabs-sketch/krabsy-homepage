/* ──────────────────────────────────────────────────────────────────────────
   Krabsy — the gift popup ("Neues Geschenk! 🎁")
   ES module, loaded on demand by the header counter (krabsy-shells.js).
   Rules: krabsy-rewards.js; concept: docs/figures-shells-world.md.

   When a page of the site opens and there are gifts the child has not been
   told about, a small card slides in at the bottom: what it got (picture +
   name + why), and a button to the figure page. Several gifts share one card.
   It never blocks: no backdrop, the page stays usable, ✕ or Esc closes it,
   and each gift is announced once.

   Not shown inside a game iframe or on a game page (header.k-game-nav): a
   gift earned or found there waits, the header counter shows a 🎁 dot, and
   the card comes on the next site page.
   ────────────────────────────────────────────────────────────────────────── */
import { takePending, giftBadge, giftFits } from './krabsy-rewards.js';
import { currentLang, uiPage } from './krabsy-lang.js?v=2026-11-27';
const T = {
  de: {
    title: 'Neues Geschenk!', titleMany: '{n} neue Geschenke!', intro: 'Du hast etwas Neues bekommen:',
    wear: 'Anziehen', look: 'Ansehen', close: 'Schließen', more: 'und {n} mehr',
    why: { shells: 'Für 150 gesammelte Muscheln', right: 'Für {n} richtige Antworten', safe: 'Weil {n} Wörter schon sitzen',
      topics: 'Für ein zweites Thema', diplom: 'Für dein Verb-Diplom', days: 'Für {n} Übungstage',
      week: 'Für eine neue Übungswoche', game: 'In einem Spiel gefunden', tutor: 'Von deiner Lehrkraft' },
  },
  es: {
    title: '¡Regalo nuevo!', titleMany: '¡{n} regalos nuevos!', intro: 'Tienes algo nuevo:',
    wear: 'Probar', look: 'Ver', close: 'Cerrar', more: 'y {n} más',
    why: { shells: 'Por reunir 150 caracolas', right: 'Por {n} respuestas correctas', safe: 'Porque ya te salen {n} palabras',
      topics: 'Por probar un segundo tema', diplom: 'Por tu diploma de verbos', days: 'Por {n} días de práctica',
      week: 'Por una nueva semana de práctica', game: 'Lo encontraste en un juego', tutor: 'De tu profesor o profesora' },
  },
  en: {
    title: 'New gift!', titleMany: '{n} new gifts!', intro: 'You got something new:',
    wear: 'Put it on', look: 'Have a look', close: 'Close', more: 'and {n} more',
    why: { shells: 'For collecting 150 shells', right: 'For {n} right answers', safe: 'Because you know {n} words',
      topics: 'For trying a second topic', diplom: 'For your verb diploma', days: 'For {n} practice days',
      week: 'For a new practice week', game: 'Found in a game', tutor: 'From your tutor' },
  },
};
const fill = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k]));

/** Why a gift was given, for a child: reasonText('days:7', 'de') → "Für 7 Übungstage". */
export function reasonText(source, lang = currentLang()) {
  const t = (T[lang] || T.en).why;
  const [type, arg] = String(source || '').split(':');
  if (type === 'game' && arg === 'tutor' && t.tutor) return t.tutor;      // sent live by a tutor
  if (!Object.hasOwn(t, type)) return '';
  return fill(t[type], { n: arg });
}

function styles() {
  if (document.getElementById('k-gift-styles')) return;
  const st = document.createElement('style');
  st.id = 'k-gift-styles';
  st.textContent = `
    .k-gift {
      position: fixed; right: 16px; bottom: 16px; z-index: 2147483000; width: 340px; max-width: calc(100vw - 20px);
      box-sizing: border-box; padding: 14px 16px 16px; border-radius: 20px; background: #fff; color: #2c2a3a;
      border: 3px solid #ffcf5e; box-shadow: 0 10px 30px rgba(44, 42, 58, 0.28);
      font-family: Nunito, system-ui, sans-serif; text-align: left;
      animation: k-gift-in 0.4s cubic-bezier(0.2, 0.9, 0.3, 1.2);
    }
    @keyframes k-gift-in { from { transform: translateY(24px); opacity: 0; } to { transform: none; opacity: 1; } }
    .k-gift * { box-sizing: border-box; }
    .k-gift-head { display: flex; align-items: center; gap: 8px; margin: 0 0 2px; }
    .k-gift-title { flex: 1 1 auto; margin: 0; font-family: 'Fredoka One', Nunito, system-ui, sans-serif; font-weight: 400; font-size: 1.3rem; line-height: 1.15; color: #2c2a3a; }
    .k-gift-x {
      flex: 0 0 auto; width: 40px; height: 40px; margin: -6px -8px -6px 0; border: 0; border-radius: 50%; background: none;
      color: #6b6880; font-size: 1.3rem; line-height: 1; cursor: pointer; font-family: inherit;
    }
    .k-gift-x:hover { background: #f1f0f7; color: #2c2a3a; }
    .k-gift-intro { margin: 0 0 10px; font-size: 0.98rem; line-height: 1.35; font-weight: 600; color: #55526b; }
    .k-gift-list { list-style: none; margin: 0 0 12px; padding: 0; display: grid; gap: 8px; }
    .k-gift-item { display: flex; align-items: center; gap: 12px; min-width: 0; }
    .k-gift-pic { flex: 0 0 auto; width: 64px; height: 64px; border-radius: 14px; background: #16245a; border: 3px solid #2d4180; overflow: hidden; }
    .k-gift-pic img { display: block; width: 100%; height: 100%; object-fit: cover; }
    .k-gift-pic.is-item img { object-fit: contain; padding: 3px; }
    .k-gift-list.is-one .k-gift-pic { width: 88px; height: 88px; }
    .k-gift-txt { min-width: 0; display: flex; flex-direction: column; gap: 1px; }
    .k-gift-name { font-weight: 800; font-size: 1.08rem; line-height: 1.2; overflow-wrap: anywhere; }
    .k-gift-why { font-size: 0.88rem; line-height: 1.3; font-weight: 600; color: #55526b; }
    .k-gift-more { margin: -4px 0 12px; font-size: 0.92rem; font-weight: 700; color: #55526b; }
    .k-gift-go {
      display: flex; align-items: center; justify-content: center; width: 100%; min-height: 46px; padding: 8px 18px;
      border-radius: 999px; border: 0; background: #ffcf5e; color: #3a2600; cursor: pointer; text-decoration: none;
      font-family: inherit; font-weight: 800; font-size: 1.05rem; line-height: 1.2;
    }
    .k-gift-go:hover { background: #ffc233; color: #3a2600; }
    .k-gift :focus-visible { outline: 3px solid #2c2a3a; outline-offset: 2px; }
    @media (max-width: 559px) {
      .k-gift { left: 10px; right: 10px; bottom: calc(10px + var(--k-tabbar-h, 0px)); width: auto; max-width: none; }
    }
    @media (prefers-reduced-motion: reduce) { .k-gift { animation: none; } }
  `;
  document.head.appendChild(st);
}

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const MAX_ROWS = 3;

/** Show the card for these gifts ([{ id, slot, key, name, image, source }]). Returns the element. */
export function showGifts(gifts, { lang = currentLang() } = {}) {
  if (!gifts || !gifts.length) return null;
  // Adult learners (tutor's "adult" flag): no gift cards; the gifts stay owned quietly.
  try { if (localStorage.getItem('krabsy_adult') === '1') return null; } catch (_) {}
  styles();
  document.querySelector('.k-gift')?.remove();
  const t = T[lang] || T.en;
  const card = el('section', 'k-gift');
  card.setAttribute('role', 'status'); card.setAttribute('aria-live', 'polite');
  const head = el('div', 'k-gift-head');
  const title = el('h2', 'k-gift-title', (gifts.length > 1 ? fill(t.titleMany, { n: gifts.length }) : t.title) + ' 🎁');
  const x = el('button', 'k-gift-x', '✕'); x.type = 'button'; x.setAttribute('aria-label', t.close);
  head.append(title, x);
  const list = el('ul', 'k-gift-list' + (gifts.length === 1 ? ' is-one' : ''));
  for (const g of gifts.slice(0, MAX_ROWS)) {
    const li = el('li', 'k-gift-item');
    const pic = el('span', 'k-gift-pic' + (g.slot === 'char' ? '' : ' is-item'));
    const img = el('img'); img.alt = ''; img.width = 192; img.height = 192; img.decoding = 'async'; img.src = g.image;
    img.onerror = () => { img.remove(); };
    pic.append(img);
    const txt = el('span', 'k-gift-txt');
    txt.append(el('span', 'k-gift-name', g.name));
    const why = reasonText(g.source, lang);
    if (why) txt.append(el('span', 'k-gift-why', why));
    li.append(pic, txt); list.append(li);
  }
  card.append(head, el('p', 'k-gift-intro', t.intro), list);
  if (gifts.length > MAX_ROWS) card.append(el('p', 'k-gift-more', fill(t.more, { n: gifts.length - MAX_ROWS })));

  // The button: on the figure page it shows the gift right there, elsewhere it goes there.
  const first = gifts[0];
  const one = gifts.length === 1 && first.slot !== 'char' && giftFits(first.id);     // "Anziehen" only when it can be put on
  const go = el('a', 'k-gift-go', (one ? t.wear : t.look) + ' →');
  const figure = uiPage('figure', lang) || uiPage('figure', 'en');
  go.href = `${figure}#neu=${encodeURIComponent(first.id)}`;
  const close = () => { card.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  go.addEventListener('click', (e) => {
    if (location.pathname === figure) {
      e.preventDefault(); close();
      try { window.dispatchEvent(new CustomEvent('krabsy:show-gift', { detail: { id: first.id } })); } catch (_) { /* old browser */ }
    }
  });
  x.addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  card.append(go);
  document.body.appendChild(card);
  return card;
}

/**
 * Called once per page by the header counter. Shows the waiting gifts when this is a
 * normal site page (not a game page, not an iframe). Never throws.
 */
export function mountGiftPopup({ lang = currentLang() } = {}) {
  try {
    if (window.top !== window) return;
    if (document.querySelector('header.k-game-nav')) return;
    if (window.__krabsyGiftPopup) return;
    window.__krabsyGiftPopup = true;
    if (!giftBadge().pending) return;
    const show = () => { try { showGifts(takePending(), { lang }); } catch (_) { /* no popup then */ } };
    // a moment after the page has settled, so it is seen sliding in
    setTimeout(show, 700);
  } catch (_) { /* no popup then */ }
}
