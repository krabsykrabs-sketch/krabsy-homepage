/* Krabsy — teacher practice link builder (2026-11-25).

   Mounts into <div id="link-builder"> on a teacher page; the section (interface
   language × subject, sections.json) comes from the page URL, or from
   data-section="en/spanish" when the page sits outside the section tree. The teacher picks
   a topic, a game or drill, a difficulty and (for games) the game language; the
   result is a permanent link to the normal student page with the settings in
   its query — nothing is stored anywhere:

     /de/spiele/verb-kitchen/?topic=irregular_verbs&difficulty=1&lang=en&from=teacher

   The pages pass ?topic= ?difficulty= ?lang= on to the game (render_game_info.py,
   Fill the Gap pages), the question engine applies ?difficulty= (krabsy-data.js
   linkLevel), and from=teacher shows "Practice from your teacher" under the game
   (krabsy-game-info.js).

   Options come from the catalogue: the section's topics (krabsy-lang.js
   sectionTopics: subject + URL in this interface language), the games that play the chosen topic (games.json
   topics, ui_langs), the drills Sprint and Fill the Gap if the topic has them.
   ?topic=<id> in the page URL preselects that topic (links from the topic hubs). */
import qrcode from '/games/quiz-room/vendor/qrcode/qrcode.js';
import { currentSection, sectionById, sectionTopics, gameUrl, topicUrl, pickLang } from '/lib/krabsy-lang.js?v=2026-11-27';

const DRILLS = [   // drill pages that take ?difficulty= (and pass it to the game frame)
  { id: 'sprint', thumb: '/thumbnails/Sprint.png', name: { de: 'Sprint', es: 'Sprint', en: 'Sprint' } },
  { id: 'fill-the-gap', thumb: '/thumbnails/FillGap.png', name: { de: 'Lückentext', es: 'Rellena el hueco', en: 'Fill the Gap' } },
];
const T = {
  de: {
    topic: '1. Thema', game: '2. Spiel oder Übung', diff: '3. Schwierigkeit', lang: '4. Sprache im Spiel',
    games: 'Spiele', drills: 'Übungen',
    levels: [['', 'Alles'], ['1', 'Leicht'], ['2', 'Leicht + mittel']],
    langNote: 'Menüs, Anleitung und Erklärungen im Spiel. Geübt wird immer das Thema.',
    drillLang: 'Übungen laufen in der Sprache der Seite.',
    langs: { de: 'Deutsch', es: 'Spanisch', en: 'Englisch' },
    link: 'Ihr Link', copy: 'Link kopieren', copied: 'Kopiert ✓', open: 'Ausprobieren',
    note: 'Der Link gilt dauerhaft und speichert nichts. Die Kinder landen im normalen Krabsy und sehen oben „Übung von deiner Lehrkraft“.',
    qr: 'QR-Code für den Beamer',
  },
  es: {
    topic: '1. Tema', game: '2. Juego o ejercicio', diff: '3. Dificultad', lang: '4. Idioma del juego',
    games: 'Juegos', drills: 'Ejercicios',
    levels: [['', 'Todo'], ['1', 'Fácil'], ['2', 'Fácil + media']],
    langNote: 'Menús, instrucciones y explicaciones del juego. Se practica siempre el tema.',
    drillLang: 'Los ejercicios usan el idioma de la página.',
    langs: { de: 'Alemán', es: 'Español', en: 'Inglés' },
    link: 'Tu enlace', copy: 'Copiar enlace', copied: 'Copiado ✓', open: 'Probar',
    note: 'El enlace funciona siempre y no guarda nada. El alumnado entra en el Krabsy normal y ve «Práctica de tu docente».',
    qr: 'Código QR para el proyector',
  },
  en: {
    topic: '1. Topic', game: '2. Game or drill', diff: '3. Difficulty', lang: '4. Language in the game',
    games: 'Games', drills: 'Drills',
    levels: [['', 'Everything'], ['1', 'Easy'], ['2', 'Easy + medium']],
    langNote: 'Menus, tutorial and explanations in the game. The questions are always the topic.',
    drillLang: 'Drills use the language of the page.',
    langs: { de: 'German', es: 'Spanish', en: 'English' },
    link: 'Your link', copy: 'Copy link', copied: 'Copied ✓', open: 'Try it',
    note: 'The link works for good and stores nothing. Pupils land on the normal Krabsy and see “Practice from your teacher”.',
    qr: 'QR code for the projector',
  },
};

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function qrSvg(text) {
  try {
    const q = qrcode(0, 'M'); q.addData(text); q.make();
    const n = q.getModuleCount(), b = 2, size = n + b * 2;
    let d = '';
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.isDark(y, x)) d += `M${x + b} ${y + b}h1v1h-1z`;
    return `<svg viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" role="img" aria-label="QR"><rect width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
  } catch (_) { return ''; }
}

async function mount(el) {
  const section = sectionById(el.dataset.section) || currentSection();
  const lang = section.ui;
  const S = T[lang] || T.en;
  let topics, games;
  try {
    [topics, games] = await Promise.all([
      fetch('/data/topics.json').then((r) => r.json()),
      fetch('/data/games.json').then((r) => r.json()),
    ]);
  } catch (_) { return; }
  const topicIds = sectionTopics(section).filter((id) => topics[id] && topics[id].status !== 'coming_soon');
  if (!topicIds.length) return;
  // ?topic=<id> on the teacher page preselects a topic (the topic hubs link here with it).
  let pre = null;
  try { pre = new URLSearchParams(location.search).get('topic'); } catch (_) { /* no location */ }
  const st = { topic: topicIds.includes(pre) ? pre : topicIds[0], target: null, diff: '', glang: lang };

  function targets() {
    const t = topics[st.topic];
    const g = games.filter((x) => (x.topics || []).includes(st.topic) && x.status !== 'coming_soon' && x.audience !== 'teacher')
      .map((x) => ({ kind: 'game', id: x.id, name: pickLang(x.name, lang) || x.id,
        thumb: x.thumb_small || x.thumbnail || '', langs: x.ui_langs || [lang], path: gameUrl(section, x.id) }));
    const d = DRILLS.filter((x) => t.pages && t.pages[x.id] && t.pages[x.id][lang])
      .map((x) => ({ kind: 'drill', id: 'drill:' + x.id, name: pickLang(x.name, lang), thumb: x.thumb, langs: [],
        path: topicUrl(st.topic, lang, t.pages[x.id][lang]) }));
    return { g, d };
  }

  function url() {
    const all = [...targets().g, ...targets().d];
    const tg = all.find((x) => x.id === st.target) || all[0];
    if (!tg) return '';
    const q = new URLSearchParams();
    if (tg.kind === 'game') q.set('topic', st.topic);
    if (st.diff) q.set('difficulty', st.diff);
    if (tg.kind === 'game' && st.glang && st.glang !== lang && tg.langs.includes(st.glang)) q.set('lang', st.glang);
    q.set('from', 'teacher');
    return location.origin + tg.path + '?' + q.toString();
  }

  function chips(name, items, cur) {
    return items.map(([v, label]) => `<label class="lb-chip"><input type="radio" name="${name}" value="${esc(v)}"${v === cur ? ' checked' : ''}><span>${esc(label)}</span></label>`).join('');
  }

  function render() {
    const { g, d } = targets();
    const all = [...g, ...d];
    if (!all.some((x) => x.id === st.target)) st.target = all.length ? all[0].id : null;
    const tg = all.find((x) => x.id === st.target);
    if (tg && tg.kind === 'game' && !tg.langs.includes(st.glang)) st.glang = tg.langs.includes(lang) ? lang : tg.langs[0];
    const link = url();
    const card = (x) => `<label class="lb-target"><input type="radio" name="lb-target" value="${esc(x.id)}"${x.id === st.target ? ' checked' : ''}>`
      + `<span class="lb-target-box">${x.thumb ? `<img src="${esc(x.thumb)}" alt="" loading="lazy" decoding="async">` : '<span class="lb-target-ico" aria-hidden="true">✏️</span>'}`
      + `<span class="lb-target-name">${esc(x.name)}</span></span></label>`;
    el.innerHTML = `
      <div class="lb-step"><h3>${S.topic}</h3><div class="lb-chips">${chips('lb-topic', topicIds.map((id) => [id, pickLang(topics[id].display_name, lang) || id]), st.topic)}</div></div>
      <div class="lb-step"><h3>${S.game}</h3>
        ${g.length ? `<p class="lb-group">${S.games}</p><div class="lb-targets">${g.map(card).join('')}</div>` : ''}
        ${d.length ? `<p class="lb-group">${S.drills}</p><div class="lb-targets">${d.map(card).join('')}</div>` : ''}</div>
      <div class="lb-step"><h3>${S.diff}</h3><div class="lb-chips">${chips('lb-diff', S.levels, st.diff)}</div></div>
      <div class="lb-step"><h3>${S.lang}</h3>${tg && tg.kind === 'game'
        ? `<div class="lb-chips">${chips('lb-lang', tg.langs.map((l) => [l, S.langs[l] || l]), st.glang)}</div><p class="lb-note">${S.langNote}</p>`
        : `<p class="lb-note">${S.drillLang}</p>`}</div>
      <div class="lb-result">
        <div class="lb-result-main">
          <label class="lb-link-label" for="lb-link">${S.link}</label>
          <input id="lb-link" class="lb-link" type="text" readonly value="${esc(link)}">
          <div class="lb-actions"><button type="button" class="tc-btn is-amber lb-copy">${S.copy}</button>
            <a class="tc-link" href="${esc(link)}" target="_blank" rel="noopener">${S.open} ↗</a></div>
          <p class="lb-note">${S.note}</p>
        </div>
        <figure class="lb-qr">${qrSvg(link)}<figcaption>${S.qr}</figcaption></figure>
      </div>`;
    el.querySelectorAll('input[name="lb-topic"]').forEach((i) => i.addEventListener('change', () => { st.topic = i.value; render(); }));
    el.querySelectorAll('input[name="lb-target"]').forEach((i) => i.addEventListener('change', () => { st.target = i.value; render(); }));
    el.querySelectorAll('input[name="lb-diff"]').forEach((i) => i.addEventListener('change', () => { st.diff = i.value; render(); }));
    el.querySelectorAll('input[name="lb-lang"]').forEach((i) => i.addEventListener('change', () => { st.glang = i.value; render(); }));
    const btn = el.querySelector('.lb-copy');
    btn.addEventListener('click', async () => {
      const inp = el.querySelector('#lb-link');
      try { await navigator.clipboard.writeText(inp.value); } catch (_) { inp.select(); document.execCommand('copy'); }
      btn.textContent = S.copied;
      setTimeout(() => { btn.textContent = S.copy; }, 1800);
    });
  }
  render();
}

document.querySelectorAll('#link-builder').forEach(mount);
