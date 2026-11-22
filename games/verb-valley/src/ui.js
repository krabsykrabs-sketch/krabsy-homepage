// DOM layer: HUD (clock/day/coins/hotbar), the left inventory panel, start
// screen, shop + shipping panels, sleep summary, world-anchored speech
// bubbles, toasts. All markup lives in index.html; this module wires it.
//
// Selection model: one thing is "in hand" at a time —
//   { kind:'tool', id:'hoe'|'can'|'axe' }   tools live in the bottom hotbar
//   { kind:'seed', id:cropType }            a seed bag, held over the head
//   { kind:'item', id:itemType }            harvested produce, held likewise
// Clicking an inventory chip selects seed/produce; game.js mirrors the
// selection onto the player rig via hooks.onSelect.

import * as THREE from 'three';
import { CROPS, CROP_ORDER, TIER_UNLOCK, SELLABLE, TOOL_COST, ITEM_EMOJI, BUCKET_CAP } from './config.js';
import { sfx, toggle as toggleSound, isEnabled as soundOn } from './audio.js';
import { t, nameOf, NameOf } from './i18n.js';
const tr = t;   // for loops whose variable is called t

const $ = (id) => document.getElementById(id);

const TOOL_DEFS = [
  { id: 'shovel', icon: '🪏' }, { id: 'bucket', icon: '🪣' }, { id: 'sword', icon: '⚔️' },
  { id: 'axe', icon: '🪓' }, { id: 'pickaxe', icon: '⛏️' }, { id: 'rod', icon: '🎣' },
];
const SEED_ORDER = CROP_ORDER;
const PRODUCE_ORDER = [...CROP_ORDER, 'berry', 'hay', 'wood', 'stone', 'gold', 'gem', 'fish', 'goldfish'];

export function createUI(state, hooks) {
  // hooks: { onBuy(id), onShip(item,n), onSleep(), onNewFarm(), onContinue(),
  //          onWake(), onSelect(sel) }
  let sel = { kind: 'tool', id: 'shovel' };
  const v3 = new THREE.Vector3();

  function setSel(next) {
    sel = next;
    refresh();
    hooks.onSelect?.(sel);
  }

  // ── Hotbar (tools only) ──
  function renderHotbar() {
    const hotbar = $('hotbar');
    hotbar.innerHTML = '';
    TOOL_DEFS.forEach((t, i) => {
      const owned = state.tools[t.id];
      const slot = document.createElement('div');
      slot.className = 'slot' + (sel.kind === 'tool' && sel.id === t.id ? ' active' : '') + (owned ? '' : ' locked');
      slot.innerHTML = `<span>${owned ? t.icon : '🔒'}</span><i class="key">${i + 1}</i>`;
      slot.title = tr('tool.' + t.id);
      slot.onclick = () => selectTool(t.id);
      hotbar.appendChild(slot);
    });
    $('gate-pill').hidden = state.schooledDay === state.day;
  }

  function selectTool(id) {
    if (!state.tools[id]) { sfx.deny(); toast(t('noTool')); return; }
    setSel({ kind: 'tool', id });
  }

  function selectSeed(type) {
    if ((state.seeds[type] ?? 0) < 1) { sfx.deny(); toast(t('noSeedsOf', nameOf(type))); return; }
    setSel({ kind: 'seed', id: type });
  }

  function selectItem(type) {
    if ((state.inventory[type] ?? 0) < 1) return;
    setSel({ kind: 'item', id: type });
  }

  // Cycle through seed types you actually have (key 4).
  function cycleSeed() {
    const have = SEED_ORDER.filter((t) => (state.seeds[t] ?? 0) > 0);
    if (!have.length) { sfx.deny(); toast(t('noSeeds')); return; }
    const cur = sel.kind === 'seed' ? have.indexOf(sel.id) : -1;
    setSel({ kind: 'seed', id: have[(cur + 1) % have.length] });
  }

  // ── Inventory panel (left) ──
  function renderInventory() {
    const seedsEl = $('inv-seeds');
    seedsEl.innerHTML = '';
    let anySeed = false;
    for (const t of SEED_ORDER) {
      const n = state.seeds[t] ?? 0;
      if (!n) continue;
      anySeed = true;
      const chip = document.createElement('div');
      chip.className = 'inv-chip seed' + (sel.kind === 'seed' && sel.id === t ? ' active' : '');
      chip.innerHTML = `<span class="bag"><span class="bag-emoji">${CROPS[t].emoji}</span></span><b class="count">${n}</b>`;
      chip.title = tr('seedTip', NameOf(t));
      chip.onclick = () => selectSeed(t);
      seedsEl.appendChild(chip);
    }
    if (!anySeed) seedsEl.innerHTML = `<p class="inv-empty">${t('invEmpty')}</p>`;

    const itemsEl = $('inv-items');
    itemsEl.innerHTML = '';
    let anyItem = false;
    for (const t of PRODUCE_ORDER) {
      const n = state.inventory[t] ?? 0;
      if (!n) continue;
      anyItem = true;
      const chip = document.createElement('div');
      chip.className = 'inv-chip' + (sel.kind === 'item' && sel.id === t ? ' active' : '');
      chip.innerHTML = `<span class="ic">${ITEM_EMOJI[t]}</span><b class="count">${n}</b>`;
      chip.title = tr('itemTip', NameOf(t), SELLABLE[t]);
      chip.onclick = () => selectItem(t);
      itemsEl.appendChild(chip);
    }
    $('inv-items-wrap').hidden = !anyItem;
  }

  // If the selected seed/produce ran out, fall back to the hoe.
  function autoStow() {
    if (sel.kind === 'seed' && (state.seeds[sel.id] ?? 0) < 1) setSel({ kind: 'tool', id: 'shovel' });
    else if (sel.kind === 'item' && (state.inventory[sel.id] ?? 0) < 1) setSel({ kind: 'tool', id: 'shovel' });
  }

  function refresh() {
    renderHotbar();
    renderInventory();
    updateHUD();
  }

  // ── HUD clock/coins ──
  function fmtTime(min) {
    const h = Math.floor(min / 60) % 24, m = Math.floor(min % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  function updateHUD() {
    $('hud-day').textContent = t('day', state.day);
    $('hud-clock').textContent = fmtTime(state.timeMin);
    $('hud-coins').textContent = state.coins;
    $('hud-water-n').textContent = `${state.water ?? 0}/${BUCKET_CAP}`;
    $('hud-water').classList.toggle('empty', (state.water ?? 0) <= 0 && state.schooledDay === state.day);
    const stickers = state.school.stickers;
    $('hud-stickers').hidden = stickers === 0;
    $('hud-stickers').textContent = stickers > 0 ? '🌟'.repeat(Math.min(stickers, 5)) + (stickers > 5 ? `×${stickers}` : '') : '';
    $('hud-album').textContent = `📖 ${collectedCount()}/${CROP_ORDER.length}`;
  }

  // ── Toasts + interaction prompt ──
  let toastTimer = null;
  function toast(msg, ms = 2600) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), ms);
  }
  function prompt(text) {
    const el = $('prompt');
    if (!text) { el.hidden = true; return; }
    el.hidden = false;
    // On touch the action button (✋) stands in for the E key.
    el.innerHTML = document.body.classList.contains('touch') ? text.replace('<b>E</b>', '<b>✋</b>') : text;
  }

  // ── World-anchored speech bubble ──
  let bubbleAnchor = null, bubbleTimer = null;
  function bubble(worldPos, text, ms = 3000) {
    const el = $('bubble');
    el.textContent = text;
    el.hidden = false;
    bubbleAnchor = worldPos.clone ? worldPos.clone() : new THREE.Vector3(worldPos.x, worldPos.y ?? 1.5, worldPos.z);
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => { el.hidden = true; bubbleAnchor = null; }, ms);
  }
  function projectBubble(camera) {
    if (!bubbleAnchor) return;
    const el = $('bubble');
    v3.copy(bubbleAnchor).project(camera);
    if (v3.z > 1) { el.style.opacity = 0; return; }
    el.style.opacity = 1;
    el.style.left = `${(v3.x * 0.5 + 0.5) * innerWidth}px`;
    el.style.top = `${(-v3.y * 0.5 + 0.5) * innerHeight}px`;
  }

  // ── Crop album ──
  const collectedCount = () => Object.keys(state.collection ?? {}).length;
  const tierUnlocked = (tier) => collectedCount() >= (TIER_UNLOCK[tier] ?? 0);

  function openAlbum() {
    const list = $('album-list');
    list.innerHTML = '';
    for (const k of CROP_ORDER) {
      const c = CROPS[k];
      const got = !!state.collection?.[k];
      const secret = c.schoolOnly && !got;   // school rares stay mysterious
      const row = document.createElement('div');
      row.className = 'panel-row' + (got ? '' : ' dim');
      const src = c.schoolOnly ? t('albumSchool')
        : tierUnlocked(c.tier) ? t('albumShop')
        : t('albumLocked', TIER_UNLOCK[c.tier]);
      row.innerHTML = `<span class="ic">${secret ? '❓' : c.emoji}</span>
        <span class="nm">${secret ? '???' : NameOf(k)}<small>${t('albumRow', c.days, c.sell, src)}</small></span>
        <span class="album-check">${got ? '✓' : ''}</span>`;
      list.appendChild(row);
    }
    const n = collectedCount(), total = CROP_ORDER.length;
    $('album-fill').style.width = `${Math.round((n / total) * 100)}%`;
    $('album-progress').textContent = n === total ? t('albumDone') : t('albumProgress', n, total);
    $('album-panel').hidden = false;
  }
  $('hud-album').onclick = openAlbum;
  $('album-close').onclick = () => { $('album-panel').hidden = true; };

  // ── Shop panel ──
  function openShop() {
    const list = $('shop-list');
    list.innerHTML = '';
    const rows = [
      ...SEED_ORDER.filter((t) => !CROPS[t].schoolOnly).map((t) => ({
        id: 'seed:' + t, icon: CROPS[t].emoji, name: tr('seedName', NameOf(t)),
        desc: tierUnlocked(CROPS[t].tier)
          ? tr('seedDesc', CROPS[t].days, CROPS[t].sell)
          : tr('albumLocked', TIER_UNLOCK[CROPS[t].tier]),
        cost: CROPS[t].seed, locked: !tierUnlocked(CROPS[t].tier),
      })),
      { id: 'axe', icon: '🪓', name: t('axeName'), desc: state.tools.axe ? t('owned') : t('axeDesc'), cost: TOOL_COST.axe, disabled: state.tools.axe },
      { id: 'pickaxe', icon: '⛏️', name: t('pickName'), desc: state.tools.pickaxe ? t('owned') : t('pickDesc'), cost: TOOL_COST.pickaxe, disabled: state.tools.pickaxe },
      { id: 'rod', icon: '🎣', name: t('rodName'), desc: state.tools.rod ? t('owned') : t('rodDesc'), cost: TOOL_COST.rod, disabled: state.tools.rod },
    ];
    for (const r of rows) {
      const row = document.createElement('div');
      row.className = 'panel-row' + (r.locked ? ' dim' : '');
      const afford = state.coins >= r.cost && !r.disabled && !r.locked;
      row.innerHTML = `<span class="ic">${r.locked ? '❓' : r.icon}</span><span class="nm">${r.name}<small>${r.desc}</small></span>
        <button class="chip-btn ${afford ? '' : 'off'}">${r.disabled ? '✓' : r.locked ? '🔒' : r.cost + ' 🪙'}</button>`;
      if (!r.locked) row.querySelector('button').onclick = () => { hooks.onBuy(r.id); openShop(); refresh(); };
      list.appendChild(row);
    }
    $('shop-coins').textContent = t('youHave', state.coins);
    $('shop-panel').hidden = false;
  }

  // ── Shipping panel ──
  function openShip() {
    const list = $('ship-list');
    list.innerHTML = '';
    // Krabsy's deal: an optional question for a better price on the next sale.
    const deal = $('ship-deal');
    if (state.saleBonus > 0) {
      deal.innerHTML = `<div class="deal">🦀<span>${t('dealOn', Math.round(state.saleBonus * 100))}</span></div>`;
    } else {
      deal.innerHTML = `<div class="deal">🦀<span>${t('dealOffer')}</span><button class="chip-btn">${t('dealBtn')}</button></div>`;
      deal.querySelector('button').onclick = () => hooks.onDeal?.();
    }
    let any = false;
    for (const [item, n] of Object.entries(state.inventory)) {
      if (!n) continue;
      any = true;
      const row = document.createElement('div');
      row.className = 'panel-row';
      row.innerHTML = `<span class="ic">${ITEM_EMOJI[item] ?? '❔'}</span>
        <span class="nm">${NameOf(item)} ×${n}<small>${t('each', SELLABLE[item])}</small></span>
        <button class="chip-btn">${t('sell1')}</button><button class="chip-btn">${t('sellAll')}</button>`;
      const [b1, bAll] = row.querySelectorAll('button');
      b1.onclick = () => { hooks.onShip(item, 1); openShip(); };
      bAll.onclick = () => { hooks.onShip(item, n); openShip(); };
      list.appendChild(row);
    }
    if (!any) list.innerHTML = `<p class="empty">${t('nothingToSell')}</p>`;
    $('ship-crate').textContent = t('youHave', state.coins);
    $('ship-panel').hidden = false;
  }

  function closePanels() {
    $('shop-panel').hidden = true;
    $('ship-panel').hidden = true;
    $('album-panel').hidden = true;
  }
  function anyPanelOpen() {
    return !$('shop-panel').hidden || !$('ship-panel').hidden
      || !$('album-panel').hidden || !$('sleep-overlay').hidden;
  }

  $('shop-close').onclick = closePanels;
  $('ship-close').onclick = closePanels;

  // ── Sleep overlay ──
  function showSleep(summary, dozedOff) {
    const el = $('sleep-overlay');
    $('sleep-title').textContent = dozedOff ? t('dozed') : t('goodNight');
    let html = '';
    if (summary.earned > 0) {
      const items = Object.entries(summary.sold).map(([it, n]) => `${ITEM_EMOJI[it] ?? ''} ×${n}`).join('  ');
      html += `<p class="earn">${items}</p><p class="earn big">${t('fromCrate', summary.earned)}</p>`;
    }
    if (summary.grew) html += `<p>${t('grew', summary.grew)}</p>`;
    if (summary.ripened) html += `<p>${t('ripe', summary.ripened)}</p>`;
    if (summary.hayRegrown) html += `<p>${t('hayRegrew', summary.hayRegrown)}</p>`;
    if (summary.nodesRegrown) html += `<p>${t('quarryFresh')}</p>`;
    if (!html) html = `<p>${t('quiet')}</p>`;
    const en = summary.english;
    if (en && en.asked > 0) {
      html += `<div class="english"><p>${t('englishToday', en.correct, en.asked)}</p>`;
      if (en.lines?.length) html += `<p>${t('practise')}</p>` + en.lines.map((l) => `<p class="chain">${l}</p>`).join('');
      html += '</div>';
    }
    if (state.school.stickers > 0) html += `<p class="stickers">${t('stickers')} ${'🌟'.repeat(Math.min(state.school.stickers, 8))}</p>`;
    $('sleep-body').innerHTML = html;
    $('sleep-day').textContent = t('day', summary.day);
    el.hidden = false;
  }
  $('sleep-continue').onclick = () => { $('sleep-overlay').hidden = true; hooks.onWake?.(); };

  // ── Start screen ──
  function showStart(hasSave) {
    $('start-screen').hidden = false;
    $('btn-continue').hidden = !hasSave;
    $('btn-new').textContent = hasSave ? t('btnNewFarm') : t('btnStart');
    $('btn-new').classList.toggle('secondary', hasSave);
    $('btn-continue').onclick = () => { $('start-screen').hidden = true; hooks.onContinue(); };
    $('btn-new').onclick = () => {
      if (hasSave && !confirm(t('confirmNew'))) return;
      $('start-screen').hidden = true; hooks.onNewFarm();
    };
  }

  // ── Sound toggle ──
  const sndBtn = $('btn-sound');
  const renderSnd = () => { sndBtn.textContent = soundOn() ? '🔊' : '🔇'; };
  sndBtn.onclick = () => { toggleSound(); renderSnd(); };
  renderSnd();

  refresh();

  return {
    updateHUD, refresh, toast, prompt, bubble, projectBubble,
    openShop, openShip, openAlbum, closePanels, anyPanelOpen, showSleep, showStart,
    selectTool, selectSeed, selectItem, cycleSeed, autoStow, collectedCount,
    get selection() { return sel; },
    get tool() { return sel.kind === 'tool' ? sel.id : null; },
    get seedType() { return sel.kind === 'seed' ? sel.id : null; },
  };
}
