// Block editor for a worksheet. One column, a fixed set of block types, no syntax.
import { state, material, student, farmSteps, GAP_POOL, VOCAB, SETS, word, TOPICS, TOPIC_IDS, LEVELS } from '../data.js';
import { esc, on, $, toast, go, modal, pickStudents, assignTo, icon } from '../ui.js';
import { mountPlayer } from '../student/player.js';

const TYPES = {
  text:  { label: 'Text',              pic: '¶',  sub: 'a short story line or a tip' },
  cards: { label: 'Picture cards',     pic: '🖼️', sub: 'look, turn, listen' },
  tap:   { label: 'Tap the picture',   pic: '👆', sub: 'read the word, tap the picture' },
  match: { label: 'Match pairs',       pic: '🔗', sub: 'picture to word' },
  sort:  { label: 'Sort into baskets', pic: '🧺', sub: 'two baskets' },
  gap:   { label: 'Drag to the gap',   pic: '✏️', sub: 'sentences with one gap' },
};
const SOON = [['Typewriter', '⌨️'], ['Say it to your tutor', '🗣']];
const fresh = type => ({
  text: { type, title: 'A new part of the story', body: 'Write one or two friendly sentences.', pic: '📘' },
  cards: { type, title: 'Meet the words', words: ['perro', 'gato', 'conejo', 'raton'], set: 'animals', fill: 'topic' },
  tap: { type, title: 'Tap the picture', words: ['perro', 'gato', 'conejo', 'vaca'], set: 'animals', fill: 'topic' },
  match: { type, title: 'Match the pairs', words: ['perro', 'gato', 'conejo', 'pato'], set: 'animals', fill: 'topic' },
  sort: { type, title: 'Sort into baskets', baskets: [{ id: 'two', label: 'Tiene 2 patas', sub: 'two legs' }, { id: 'four', label: 'Tiene 4 patas', sub: 'four legs' }], cards: [{ w: 'pato', b: 'two' }, { w: 'perro', b: 'four' }, { w: 'gallina', b: 'two' }, { w: 'gato', b: 'four' }], hint: 'Count the legs.' },
  gap: { type, title: 'Drag the word into the gap', items: GAP_POOL.slice(5, 8).map(x => ({ ...x })), extra: [], fill: 'topic' },
}[type]);
const minutes = bs => Math.max(1, Math.round(bs.reduce((n, b) => n + ({ text: 0.5, cards: 0.3 * (b.words || []).length, tap: 0.3 * (b.words || []).length, match: 1.5, sort: 2, gap: 0.5 * (b.items || []).length }[b.type] || 1), 0)));

export function renderEditor(el, id, q) {
  const m = material(id); if (!m) return go('#/library');
  const forS = q.get('for') ? student(q.get('for')) : null;
  if (!m.blocks) {
    m.blocks = farmSteps().map(b => ({ fill: 'topic', set: 'animals', ...b }));
    if (m.from === 'weak words') m.blocks = [
      { type: 'text', title: 'Tricky words', body: 'These are the words that tripped you up. Let’s catch them!', pic: '🕵️' },
      { type: 'gap', title: 'Drag the word into the gap', fill: 'weak', items: [1, 0, 6, 8, 4].map(i => ({ ...GAP_POOL[i] })), extra: ['son'] },
      { type: 'match', title: 'Match the pairs', fill: 'weak', set: 'animals', words: ['oveja', 'vaca', 'cerdo', 'gallina'] }];
  }
  const E = { sel: 1, undo: [], own: null };
  const snap = () => { E.undo.push(JSON.stringify(m.blocks)); if (E.undo.length > 20) E.undo.shift(); };
  const saved = () => { const s = $('[data-saved]', el); if (!s) return; s.textContent = 'Saving …'; s.classList.add('busy'); clearTimeout(E.t); E.t = setTimeout(() => { s.textContent = 'Saved ✓'; s.classList.remove('busy'); }, 500); };
  const change = fn => { snap(); fn(); draw(); saved(); };

  function summaryOf(b) {
    if (b.type === 'text') return `<p class="blk-text"><b>${esc(b.title)}</b> ${esc(b.body)}</p>`;
    if (b.type === 'sort') return `<div class="blk-baskets">${b.baskets.map(k => `<div><b>🧺 ${esc(k.label)}</b><span>${b.cards.filter(c => c.b === k.id).map(c => `<i title="${esc(word(c.w).full)}">${word(c.w).pic}</i>`).join('')}</span></div>`).join('')}</div>`;
    if (b.type === 'gap') return `<ol class="blk-sents">${b.items.map(it => `<li>${esc(it.s).replace('___', `<mark>${esc(it.a)}</mark>`)}</li>`).join('')}</ol>`;
    return `<div class="blk-words">${b.words.map(w => `<span><i>${word(w).pic}</i>${esc(word(w).full)}</span>`).join('')}</div>`;
  }

  function contentEditor(b, i) {
    if (b.type === 'text') return `<label class="lbl">Heading<input class="input" data-f="title" value="${esc(b.title)}"></label><label class="lbl">Text<textarea class="input" rows="2" data-f="body">${esc(b.body)}</textarea></label>`;
    if (b.type === 'gap') return `<ol class="ed-sents">${b.items.map((it, k) => `<li><span>${esc(it.s).replace('___', `<mark>${esc(it.a)}</mark>`)}<small>${esc(it.hint)}</small></span>
        <button class="iconbtn" data-swap="${k}" title="Give me another sentence">${icon('swap')}</button><button class="iconbtn" data-rm="${k}" title="Remove">${icon('x')}</button></li>`).join('')}</ol>
      ${E.own !== null ? ownBox() : `<div class="btn-row"><button class="btn small" data-addsent>${icon('plus')} Sentence from Krabsy</button><button class="btn small" data-own>${icon('plus')} My own sentence</button><button class="btn small ghost" data-refill>⟳ Refill all</button></div>`}`;
    if (b.type === 'sort') return `<div class="two">${b.baskets.map((k, n) => `<label class="lbl">Basket ${n + 1}<input class="input" data-basket="${n}" value="${esc(k.label)}"></label>`).join('')}</div>
      <p class="lbl">Cards: tap a card to move it to the other basket</p>
      <div class="ed-baskets">${b.baskets.map(k => `<div><b>🧺 ${esc(k.label)}</b><div class="ed-words">${b.cards.map((c, n) => c.b === k.id ? `<button class="ed-word on" data-move="${n}"><i>${word(c.w).pic}</i>${esc(word(c.w).full)}</button>` : '').join('')}</div></div>`).join('')}</div>`;
    const set = b.set || 'animals';
    return `<div class="row-between"><p class="lbl">Tap the words you want (${b.words.length} chosen)</p><select class="input sel" data-set>${Object.keys(SETS).map(s => `<option value="${s}" ${s === set ? 'selected' : ''}>${SETS[s].label}</option>`).join('')}</select></div>
      <div class="ed-words">${VOCAB.filter(v => v.set === set).map(v => `<button class="ed-word ${b.words.includes(v.id) ? 'on' : ''}" data-word="${v.id}"><i>${v.pic}</i>${esc(v.full)}</button>`).join('')}</div>`;
  }
  const ownBox = () => `<div class="own"><label class="lbl">1 · Type the whole sentence<input class="input" data-owninput value="${esc(E.own)}" placeholder="El gato está en la cama."></label>
    <p class="lbl">2 · Tap the word that becomes the gap</p><div class="own-words" data-ownwords>${ownWords()}</div><button class="link" data-owncancel>Cancel</button></div>`;
  const ownWords = () => (E.own || '').trim().split(/\s+/).filter(Boolean).map((w, k) => `<button class="ed-word" data-gapword="${k}">${esc(w)}</button>`).join('') || '<span class="mute">Your words appear here.</span>';

  function inspector(b) {
    if (!b) return '<p class="mute">Choose a block to see its settings.</p>';
    const q = b.type !== 'text';
    return `<h3>${TYPES[b.type].pic} ${TYPES[b.type].label}</h3><p class="mute">${TYPES[b.type].sub}</p>
      <label class="lbl">What the student reads on top<input class="input" data-f="title" value="${esc(b.title)}"></label>
      ${q && b.type !== 'sort' ? `<fieldset class="radios"><legend>Fill with</legend>
        <label><input type="radio" name="fill" value="topic" ${b.fill !== 'weak' && b.fill !== 'own' ? 'checked' : ''}> Krabsy’s ${TOPICS[m.topic].label} ${b.type === 'gap' ? 'sentences' : 'words'}</label>
        <label><input type="radio" name="fill" value="weak" ${b.fill === 'weak' ? 'checked' : ''}> ${forS ? esc(forS.name) + '’s' : 'A student’s'} weak words</label>
        <label><input type="radio" name="fill" value="own" ${b.fill === 'own' ? 'checked' : ''}> My own</label></fieldset>
      <div class="stepper"><span>How many</span><button data-cnt="-1" aria-label="Fewer">−</button><b>${(b.items || b.words).length}</b><button data-cnt="1" aria-label="More">+</button></div>` : ''}
      ${q ? `<label class="check"><input type="checkbox" checked><span>Hints allowed <span class="mute">(a hint means fewer stars)</span></span></label>
      <label class="check"><input type="checkbox" checked><span>Show the short explanation after each answer</span></label>` : ''}
      <p class="mute small">There is no field for grammar words in a question. The student sees a picture, a sentence or a gap.</p>`;
  }

  function rubric() {
    const bs = m.blocks, nonText = new Set(bs.filter(b => ['cards', 'tap', 'match', 'sort'].includes(b.type)).map(b => b.type)).size, min = minutes(bs);
    const row = (ok, t) => `<li class="${ok ? 'ok' : 'todo'}">${ok ? '✓' : '○'} ${t}</li>`;
    return `<ul class="rubric">${row(bs[0] && bs[0].type === 'text', 'Starts with a little story')}${row(bs.length >= 3 && bs.length <= 6, `3 to 5 activities (${bs.filter(b => b.type !== 'text').length} now)`)}${row(nonText >= 2, '2 or more picture activities')}${row(min >= 6 && min <= 12, `8 to 12 minutes (about ${min} now)`)}</ul>`;
  }

  function draw() {
    const b = m.blocks[E.sel];
    el.innerHTML = `<div class="editor">
      <header class="ed-top"><a class="back" href="#/library?shelf=mine">${icon('left')} Library</a>
        <input class="ed-title" data-title value="${esc(m.title)}" aria-label="Title">
        <select class="input sel" data-mlevel>${LEVELS.map(l => `<option ${m.level === l ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <select class="input sel" data-mtopic>${TOPIC_IDS.map(t => `<option value="${t}" ${m.topic === t ? 'selected' : ''}>${TOPICS[t].label}</option>`).join('')}</select>
        <span class="saved" data-saved>Saved ✓</span><span class="grow"></span>
        <button class="btn ghost" data-undo ${E.undo.length ? '' : 'disabled'}>${icon('undo')} Undo</button><button class="btn" data-preview>${icon('eye')} Preview</button><button class="btn primary" data-assign>Assign</button></header>
      ${forS ? `<div class="banner info"><span class="att-ic info">★</span><span>Made from <b>${esc(forS.name)}’s</b> weak words: está / es, tiene / tengo, la oveja. Change anything you like.</span></div>` : ''}
      ${m.from && !forS ? `<div class="banner info"><span class="att-ic info">⧉</span><span>Your copy of <b>${esc(m.from)}</b>. The Krabsy original stays as it is.</span></div>` : ''}
      <div class="ed-cols">
        <aside class="ed-add card pad"><h3>Add</h3>${Object.entries(TYPES).map(([t, v]) => `<button class="add-blk" data-add="${t}"><span>${v.pic}</span><b>${v.label}</b><small>${v.sub}</small></button>`).join('')}
          ${SOON.map(([l, p]) => `<button class="add-blk" disabled><span>${p}</span><b>${l}</b><small>comes later</small></button>`).join('')}</aside>
        <section class="ed-sheet">${m.blocks.map((x, i) => `<article class="blk card ${i === E.sel ? 'sel' : ''}" data-blk="${i}" draggable="true">
            <header><span class="grip" title="Drag to move">${icon('grip')}</span><span class="blk-n">${i + 1}</span><b>${TYPES[x.type].pic} ${TYPES[x.type].label}</b><span class="mute">${x.type === 'text' ? '' : esc(x.title)}</span><span class="grow"></span>
              <button class="iconbtn" data-up="${i}" ${i ? '' : 'disabled'} aria-label="Move up">${icon('up')}</button><button class="iconbtn" data-down="${i}" ${i < m.blocks.length - 1 ? '' : 'disabled'} aria-label="Move down">${icon('down')}</button><button class="iconbtn" data-del="${i}" aria-label="Delete block">${icon('trash')}</button></header>
            <div class="blk-body">${i === E.sel ? contentEditor(x, i) : summaryOf(x)}</div></article>`).join('')}
          <button class="add-end" data-add="gap">${icon('plus')} Add block</button></section>
        <aside class="ed-side"><div class="card pad" data-insp>${inspector(b)}</div><div class="card pad"><h3>Good-worksheet check</h3>${rubric()}</div></aside>
      </div></div>`;
  }
  draw();

  const cur = () => m.blocks[E.sel];
  on(el, 'click', '[data-blk]', (e, a) => { if (e.target.closest('button, input, textarea, select, label')) return; if (+a.dataset.blk !== E.sel) { E.sel = +a.dataset.blk; E.own = null; draw(); } });
  on(el, 'click', '[data-add]', (e, b) => change(() => { m.blocks.splice(E.sel + 1, 0, fresh(b.dataset.add)); E.sel = Math.min(E.sel + 1, m.blocks.length - 1); E.own = null; }));
  on(el, 'click', '[data-up]', (e, b) => change(() => { const i = +b.dataset.up; [m.blocks[i - 1], m.blocks[i]] = [m.blocks[i], m.blocks[i - 1]]; E.sel = i - 1; }));
  on(el, 'click', '[data-down]', (e, b) => change(() => { const i = +b.dataset.down; [m.blocks[i + 1], m.blocks[i]] = [m.blocks[i], m.blocks[i + 1]]; E.sel = i + 1; }));
  on(el, 'click', '[data-del]', (e, b) => { if (m.blocks.length < 2) return toast('A worksheet needs one block'); change(() => { m.blocks.splice(+b.dataset.del, 1); E.sel = Math.max(0, Math.min(E.sel, m.blocks.length - 1)); }); toast('Block removed. “Undo” brings it back.'); });
  on(el, 'click', '[data-undo]', () => { if (!E.undo.length) return; m.blocks = JSON.parse(E.undo.pop()); E.sel = Math.min(E.sel, m.blocks.length - 1); draw(); saved(); });
  // drag to reorder
  let dragFrom = null;
  on(el, 'dragstart', '[data-blk]', (e, a) => { dragFrom = +a.dataset.blk; a.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', a.dataset.blk); } catch (_) { /* old browsers */ } });
  on(el, 'dragover', '[data-blk]', (e, a) => { e.preventDefault(); el.querySelectorAll('.drop-here').forEach(x => x.classList.remove('drop-here')); a.classList.add('drop-here'); });
  on(el, 'dragend', '[data-blk]', () => el.querySelectorAll('.drop-here, .dragging').forEach(x => x.classList.remove('drop-here', 'dragging')));
  on(el, 'drop', '[data-blk]', (e, a) => { e.preventDefault(); const to = +a.dataset.blk; if (dragFrom === null || to === dragFrom) return; change(() => { const [x] = m.blocks.splice(dragFrom, 1); m.blocks.splice(to, 0, x); E.sel = to; }); dragFrom = null; });
  // text fields: update the model without redrawing (keeps the cursor)
  on(el, 'input', '[data-f]', (e, f) => { cur()[f.dataset.f] = f.value; saved(); el.querySelectorAll(`[data-f="${f.dataset.f}"]`).forEach(x => { if (x !== f) x.value = f.value; }); });
  on(el, 'input', '[data-title]', (e, f) => { m.title = f.value; saved(); });
  on(el, 'change', '[data-mlevel]', (e, f) => { m.level = f.value; saved(); });
  on(el, 'change', '[data-mtopic]', (e, f) => { m.topic = f.value; saved(); draw(); });
  on(el, 'change', '[data-basket]', (e, f) => change(() => { cur().baskets[+f.dataset.basket].label = f.value; }));
  on(el, 'change', '[name="fill"]', (e, f) => { const v = f.value; change(() => { const b = cur(); b.fill = v;
    if (b.type === 'gap') { if (v === 'weak') b.items = [1, 0, 6, 8, 4].slice(0, Math.max(3, b.items.length)).map(i => ({ ...GAP_POOL[i] })); if (v === 'topic') b.items = GAP_POOL.slice(0, b.items.length).map(x => ({ ...x })); if (v === 'own') { E.own = ''; } }
    else if (v === 'weak') b.words = ['oveja', 'vaca', 'cerdo', 'gallina', 'pato', 'caballo'].slice(0, Math.max(3, b.words.length)); });
    if (v === 'weak') toast(`Filled with the words ${forS ? esc(forS.name) : 'the student'} gets wrong most often`); });
  on(el, 'click', '[data-cnt]', (e, c) => change(() => { const b = cur(), d = +c.dataset.cnt;
    if (b.type === 'gap') { if (d > 0) { const nx = GAP_POOL.find(p => !b.items.some(i => i.s === p.s)); nx && b.items.push({ ...nx }); } else if (b.items.length > 2) b.items.pop(); }
    else { if (d > 0) { const nx = VOCAB.find(v => v.set === (b.set || 'animals') && !b.words.includes(v.id)); nx && b.words.push(nx.id); } else if (b.words.length > 2) b.words.pop(); } }));
  on(el, 'click', '[data-word]', (e, w) => change(() => { const b = cur(), id = w.dataset.word; if (b.words.includes(id)) { if (b.words.length > 2) b.words = b.words.filter(x => x !== id); else toast('Keep at least two words'); } else b.words.push(id); }));
  on(el, 'change', '[data-set]', (e, f) => change(() => { const b = cur(); b.set = f.value; b.words = VOCAB.filter(v => v.set === f.value).slice(0, 4).map(v => v.id); }));
  on(el, 'click', '[data-move]', (e, w) => change(() => { const b = cur(), c = b.cards[+w.dataset.move]; c.b = b.baskets.find(k => k.id !== c.b).id; }));
  on(el, 'click', '[data-swap]', (e, w) => change(() => { const b = cur(), k = +w.dataset.swap; const nx = GAP_POOL.filter(p => !b.items.some(i => i.s === p.s)); if (nx.length) b.items[k] = { ...nx[(k + E.undo.length) % nx.length] }; }));
  on(el, 'click', '[data-rm]', (e, w) => change(() => { const b = cur(); if (b.items.length > 1) b.items.splice(+w.dataset.rm, 1); }));
  on(el, 'click', '[data-addsent]', () => change(() => { const b = cur(); const nx = GAP_POOL.find(p => !b.items.some(i => i.s === p.s)); nx ? b.items.push({ ...nx }) : toast('That is every Krabsy sentence in the prototype'); }));
  on(el, 'click', '[data-refill]', () => change(() => { const b = cur(); const n = b.items.length, off = (GAP_POOL.findIndex(p => p.s === b.items[0].s) + n) % GAP_POOL.length; b.items = Array.from({ length: n }, (_, k) => ({ ...GAP_POOL[(off + k) % GAP_POOL.length] })); }));
  on(el, 'click', '[data-own]', () => { E.own = ''; draw(); $('[data-owninput]', el).focus(); });
  on(el, 'click', '[data-owncancel]', () => { E.own = null; draw(); });
  on(el, 'input', '[data-owninput]', (e, f) => { E.own = f.value; $('[data-ownwords]', el).innerHTML = ownWords(); });
  on(el, 'click', '[data-gapword]', (e, w) => { const ws = E.own.trim().split(/\s+/); const k = +w.dataset.gapword; const ans = ws[k].replace(/[.,;:!?¡¿]/g, ''); if (!ans) return;
    ws[k] = ws[k].replace(ans, '___'); change(() => { cur().items.push({ s: ws.join(' '), a: ans, hint: 'your own sentence', teach: '' }); E.own = null; }); toast(`Gap made: “${esc(ans)}” goes into the word bank`); });
  on(el, 'click', '[data-assign]', () => pickStudents({ title: `Assign “${m.title}”`, pre: forS ? [forS.id] : [], sub: 'Assigning saves a version. Students keep the version they were given, even if you edit later.', onDone: ids => { m.draft = false; assignTo(ids, m); } }));
  on(el, 'click', '[data-preview]', () => modal({ title: 'Preview: what the student gets', wide: true, cls: 'preview-modal',
    body: `<div class="prev-bar"><span class="seg"><button data-fr="phone" class="on">Phone</button><button data-fr="tablet">Tablet</button></span><span class="mute">The real player. Play it through.</span></div><div class="frame phone" data-frame><div class="frame-screen" data-player></div></div>`,
    onMount(w) { mountPlayer($('[data-player]', w), JSON.parse(JSON.stringify(m.blocks)), {}); on(w, 'click', '[data-fr]', (e, b) => { $('[data-frame]', w).className = 'frame ' + b.dataset.fr; w.querySelectorAll('[data-fr]').forEach(x => x.classList.toggle('on', x === b)); }); } }));
}
