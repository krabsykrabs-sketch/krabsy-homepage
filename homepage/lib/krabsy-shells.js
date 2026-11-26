/* ──────────────────────────────────────────────────────────────────────────
   Krabsy — shells (Muscheln / caracolas / shells 🐚)
   ES module. The one reward that counts across all games and drills
   (docs/figures-shells-world.md, owner decisions 2026-11-25).

   Earning is counted in ONE place: recordAttempt() in krabsy-stats.js calls
   earnForAnswer(), so every game and drill earns without game code.

     +1 per right answer
     +1 extra when the item was new or weak (mastery ≤ 2 before the answer)
     wrong answer: 0 — shells are never taken away
     after 200 shells in a calendar day: 1 shell per 3 right answers

   No spending (owner decision 2026-11-25, "rewards instead of a shop"):
   shells are progress towards a surprise. Every 150 shells collected
   (lifetime `earned`) is a gift, a random figure or accessory; the rules are
   in krabsy-rewards.js. `balance` and unlock() are kept for older cached
   pages and game builds; nothing on the site calls unlock() any more.
   Whatever is in `owned` stays owned.

   Storage: localStorage["krabsy_shells_v1"], on this device only:
     { v:1, balance, earned, day:"YYYY-MM-DD", dayShells, slow, owned:[ids] }
   Every call reads and writes storage directly (no module cache): pages load
   lib modules under several URLs and games run in iframes, so several copies
   of this module work on the same data.

   Nothing here may throw into a game: every public function is safe to call
   without storage (private mode) and outside a browser.
   ────────────────────────────────────────────────────────────────────────── */

const KEY = 'krabsy_shells_v1';
export const DAILY_FULL = 200;      // shells per calendar day at the full rate
export const SLOW_EVERY = 3;        // after that: 1 shell per 3 right answers

// The counter opens the child's overview page "Mein Profil" (krabsy-profile.js); the
// figure builder is one tap further (owner decision 2026-11-25).
const PROFILE_URL = { de: '/de/profil/', es: '/es/perfil/', en: '/en/my-profile/' };
const WORD = { de: 'Muscheln', es: 'caracolas', en: 'shells' };
const GIFT_WORD = { de: 'neues Geschenk', es: 'regalo nuevo', en: 'new gift' };
const PROFILE_WORD = { de: 'Mein Profil', es: 'Mi perfil', en: 'My profile' };

function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
const int = (v) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

export const STARTER_ITEMS = ['hat:cap', 'glasses:round', 'back:pack', 'back:capeKnight'];

function read() {
  const s = { v: 1, balance: 0, earned: 0, day: today(), dayShells: 0, slow: 0, owned: [] };
  try {
    const o = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (o && typeof o === 'object') {
      s.balance = int(o.balance); s.earned = Math.max(int(o.earned), s.balance);
      if (o.day === s.day) { s.dayShells = int(o.dayShells); s.slow = int(o.slow) % SLOW_EVERY; }
      if (Array.isArray(o.owned)) {
        s.owned = [...new Set(o.owned.filter((x) => typeof x === 'string' && /^[a-z]+:[A-Za-z0-9_]{1,40}$/.test(x)))].slice(0, 500);
      }
    }
  } catch (_) { /* private mode / broken JSON: start empty */ }
  // Starter accessories every child owns from the start (owner 2026-11-25: fewer than the
  // 14 the free figures wear; ids as in krabsy-figure-catalog.js). Merged in, never removed.
  s.owned = [...new Set([...STARTER_ITEMS, ...s.owned])];
  return s;
}
function write(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); return true; } catch (_) { return false; }
}
function announce(s, delta) {
  try {
    window.dispatchEvent(new CustomEvent('krabsy:shells', { detail: { balance: s.balance, earned: s.earned, delta } }));
  } catch (_) { /* no window */ }
}

/** { balance, earned (lifetime), today (shells earned today), owned: [ids] } */
export function getShells() {
  const s = read();
  return { balance: s.balance, earned: s.earned, today: s.dayShells, owned: s.owned };
}
export function ownedItems() { return read().owned; }
export function owns(id) { return read().owned.includes(id); }

/**
 * One answer. `weakOrNew`: the item had mastery ≤ 2 or was never answered.
 * Returns the number of shells earned (0, 1 or 2). Called by recordAttempt().
 */
export function earnForAnswer(correct, weakOrNew) {
  try {
    if (!correct) return 0;
    const s = read();
    let n;
    if (s.dayShells >= DAILY_FULL) {
      s.slow += 1;
      n = s.slow >= SLOW_EVERY ? 1 : 0;
      if (n) s.slow = 0;
    } else {
      n = weakOrNew ? 2 : 1;
    }
    s.balance += n; s.earned += n; s.dayShells += n;
    if (!write(s)) return 0;
    if (n) announce(s, n);
    return n;
  } catch (_) { return 0; }
}

/**
 * Pay `price` shells for `id` (e.g. "char:Ninja", "hat:witch").
 * → { ok, balance, missing? }. Already owned = ok, nothing is charged.
 */
export function unlock(id, price) {
  try {
    const s = read();
    if (s.owned.includes(id)) return { ok: true, balance: s.balance, already: true };
    const p = int(price);
    if (typeof id !== 'string' || !/^[a-z]+:[A-Za-z0-9_]{1,40}$/.test(id)) return { ok: false, balance: s.balance };
    if (s.balance < p) return { ok: false, balance: s.balance, missing: p - s.balance };
    s.balance -= p; s.owned.push(id);
    if (!write(s)) return { ok: false, balance: s.balance + p };
    announce(s, -p);
    return { ok: true, balance: s.balance };
  } catch (_) { return { ok: false, balance: 0 }; }
}

/** fn({ balance, earned }) whenever the shells change — on this page, in a game iframe or in another tab. */
export function onShellsChange(fn) {
  const call = () => { try { fn(getShells()); } catch (_) { /* listener's problem */ } };
  const onStorage = (e) => { if (!e || e.key === KEY || e.key === null) call(); };
  try {
    window.addEventListener('krabsy:shells', call);
    window.addEventListener('krabsy:attempt', call);
    window.addEventListener('storage', onStorage);
  } catch (_) { /* no window */ }
  return () => {
    try {
      window.removeEventListener('krabsy:shells', call);
      window.removeEventListener('krabsy:attempt', call);
      window.removeEventListener('storage', onStorage);
    } catch (_) { /* no window */ }
  };
}

/* ── Header counter "🐚 240" ─────────────────────────────────────────────
   Mounted into the site header (header.k-page-header, by krabsy-footer.js)
   and the game header (.k-game-nav, by krabsy-nav.js). Links to the profile
   page "Mein Profil". Shows the shells collected so far (lifetime; nothing is
   spent any more). Hidden until the first shell was ever earned, so first-time
   visitors and teachers see the header as before; it appears with the first
   right answer and stays.
   Gifts (krabsy-rewards.js, loaded on demand): a small dot on the counter while
   a gift is new, and the gift popup (krabsy-gifts-ui.js) on site pages. */

function pageLang() {
  try {
    const m = location.pathname.match(/^\/(de|es|en)(\/|$)/);
    if (m) return m[1];
    const ls = localStorage.getItem('krabsy_lang');
    if (ls === 'de' || ls === 'es' || ls === 'en') return ls;
  } catch (_) { /* fall through */ }
  return 'de';
}

function injectCounterStyles() {
  if (document.getElementById('k-shells-styles')) return;
  const st = document.createElement('style');
  st.id = 'k-shells-styles';
  st.textContent = `
    .k-shells {
      display: inline-flex; align-items: center; gap: 5px; flex: 0 0 auto;
      min-height: 32px; padding: 0 12px; margin: 0 10px 0 auto;
      border-radius: 999px; background: #fff4d6; box-shadow: inset 0 0 0 1.5px #ffcf5e;
      color: #2c2a3a; text-decoration: none; white-space: nowrap; line-height: 1;
      font-family: 'Nunito', system-ui, sans-serif; font-size: 0.85rem; font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
    .k-shells:hover { background: #ffe9ad; color: #2c2a3a; }
    .k-shells[hidden] { display: none; }
    .k-shells { position: relative; }
    .k-shells-gift {
      position: absolute; top: -5px; right: -5px; width: 20px; height: 20px; border-radius: 50%;
      display: grid; place-items: center; font-size: 11px; line-height: 1;
      background: #ff8585; box-shadow: 0 0 0 2px #fff;
    }
    .k-shells-gift[hidden] { display: none; }
    .k-shells-icon { font-size: 1.05em; }
    .k-shells.is-pop { animation: k-shells-pop 0.45s ease-out; }
    @keyframes k-shells-pop { 0% { transform: scale(1); } 40% { transform: scale(1.18); } 100% { transform: scale(1); } }
    @media (prefers-reduced-motion: reduce) { .k-shells.is-pop { animation: none; } }
    .k-game-nav .k-shells { min-height: 28px; padding: 0 10px; margin: 0; font-size: 0.78rem; }
    @media (max-width: 559px) { .k-page-header .k-shells { min-height: 36px; } }
    /* Landing pages on phones (logo + teacher link + language toggle fill the first
       row): the counter sits at the end of the chip row instead of adding a third row. */
    @media (max-width: 559px) {
      .k-page-header:has(> .hd-right .k-lang-btn) > .k-shells { position: absolute; right: 14px; bottom: 10px; margin: 0; padding: 0 8px; gap: 3px; font-size: 0.78rem; }
      .k-page-header:has(> .hd-right .k-lang-btn):has(> .k-shells:not([hidden])) > .k-topic-nav { padding-right: 70px; gap: 0; }
      .k-page-header:has(> .hd-right .k-lang-btn):has(> .k-shells:not([hidden])) > .k-topic-nav .k-nav-chip { padding: 0 7px; }
    }
  `;
  document.head.appendChild(st);
}

/**
 * Put the counter into `header` (default: the page's site or game header).
 * Idempotent; returns the <a> element or null. Never throws.
 */
export function mountShellCounter(header) {
  // Adult learners (tutor's "adult" flag, docs/tutor-platform.md): no shells, no gifts.
  if ((() => { try { return localStorage.getItem('krabsy_adult') === '1'; } catch (_) { return false; } })()) return null;
  // Tutor pages (space, sign-in, parents' report) are for adults: no shells there.
  try { if (document.querySelector('[data-tutor-page]:not([data-tutor-page="student"])')) return null; } catch (_) {}
  try {
    const host = header || document.querySelector('header.k-page-header, header.k-game-nav');
    if (!host) return null;
    const had = host.querySelector('.k-shells');
    if (had) return had;
    injectCounterStyles();
    const lang = pageLang();
    const a = document.createElement('a');
    a.className = 'k-shells';
    a.href = PROFILE_URL[lang] || PROFILE_URL.de;
    a.innerHTML = '<span class="k-shells-icon" aria-hidden="true">🐚</span><span class="k-shells-n">0</span>'
      + '<span class="k-shells-gift" aria-hidden="true" hidden>🎁</span>';
    const num = a.querySelector('.k-shells-n');
    const dot = a.querySelector('.k-shells-gift');
    let gifts = 0;                      // gifts that are new (not yet looked at on the figure page)

    // Site header: just before the language toggle / right-hand group; game
    // header: before the "← back" link. Other scripts insert their parts
    // later (topic chips), so the place is kept with an observer.
    const anchor = () => host.querySelector(':scope > .k-lang-toggle, :scope > .hd-right, :scope > .k-game-nav-back');
    const place = () => {
      const ref = anchor();
      if (ref) { if (a.nextElementSibling !== ref) host.insertBefore(a, ref); }
      else if (host.lastElementChild !== a) host.appendChild(a);
    };
    place();
    try { new MutationObserver(place).observe(host, { childList: true }); } catch (_) { /* old browser */ }

    let shown = null;
    const render = (s) => {
      a.hidden = !(s.earned > 0 || gifts > 0);
      num.textContent = String(s.earned);
      dot.hidden = !(gifts > 0);
      a.setAttribute('aria-label', `${s.earned} ${WORD[lang] || WORD.de}${gifts > 0 ? `, ${GIFT_WORD[lang] || GIFT_WORD.de}` : ''} – ${PROFILE_WORD[lang] || PROFILE_WORD.de}`);
      a.title = PROFILE_WORD[lang] || PROFILE_WORD.de;
      if (shown !== null && s.earned > shown) {
        a.classList.remove('is-pop'); void a.offsetWidth; a.classList.add('is-pop');
      }
      shown = s.earned;
    };
    render(getShells());
    onShellsChange(render);
    // Gifts: give what is due (a child who already has shells gets its first gifts here),
    // show the dot, and let the popup tell about new ones. All optional: without the
    // rewards module the counter works as before.
    import('./krabsy-rewards.js').then((R) => {
      const badge = () => { gifts = R.giftBadge().unseen; render(getShells()); };
      R.syncRewards();
      badge();
      R.onRewardsChange(badge);
      return import('./krabsy-gifts-ui.js').then((U) => U.mountGiftPopup({ lang }));
    }).catch(() => {});
    return a;
  } catch (_) { return null; }
}
