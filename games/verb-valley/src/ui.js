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
import { CROPS, SELLABLE, AXE_COST, ITEM_EMOJI } from './config.js';
import { sfx, toggle as toggleSound, isEnabled as soundOn } from './audio.js';

const $ = (id) => document.getElementById(id);

const TOOL_DEFS = [
  { id: 'hoe', icon: '⛏', name: 'Hoe' },
  { id: 'can', icon: '🚿', name: 'Watering can' },
  { id: 'axe', icon: '🪓', name: 'Axe' },
];
const SEED_ORDER = ['turnip', 'tomato', 'pumpkin', 'starfruit'];
const PRODUCE_ORDER = ['turnip', 'tomato', 'pumpkin', 'starfruit', 'berry', 'wood'];

export function createUI(state, hooks) {
  // hooks: { onBuy(id), onShip(item,n), onSleep(), onNewFarm(), onContinue(),
  //          onWake(), onSelect(sel) }
  let sel = { kind: 'tool', id: 'hoe' };
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
      slot.title = t.name;
      slot.onclick = () => selectTool(t.id);
      hotbar.appendChild(slot);
    });
    $('gate-pill').hidden = state.schooledDay === state.day;
  }

  function selectTool(id) {
    if (id === 'axe' && !state.tools.axe) { sfx.deny(); toast('No axe yet — check the shop!'); return; }
    setSel({ kind: 'tool', id });
  }

  function selectSeed(type) {
    if ((state.seeds[type] ?? 0) < 1) { sfx.deny(); toast(`No ${CROPS[type].name} seeds left`); return; }
    setSel({ kind: 'seed', id: type });
  }

  function selectItem(type) {
    if ((state.inventory[type] ?? 0) < 1) return;
    setSel({ kind: 'item', id: type });
  }

  // Cycle through seed types you actually have (key 4).
  function cycleSeed() {
    const have = SEED_ORDER.filter((t) => (state.seeds[t] ?? 0) > 0);
    if (!have.length) { sfx.deny(); toast('No seeds — visit the shop 🛒'); return; }
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
      chip.title = `${CROPS[t].name} seeds — click to hold`;
      chip.onclick = () => selectSeed(t);
      seedsEl.appendChild(chip);
    }
    if (!anySeed) seedsEl.innerHTML = '<p class="inv-empty">No seeds<br>🛒 shop!</p>';

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
      chip.title = `${CROPS[t]?.name ?? t} — sells ${SELLABLE[t]}c at the crate`;
      chip.onclick = () => selectItem(t);
      itemsEl.appendChild(chip);
    }
    $('inv-items-wrap').hidden = !anyItem;
  }

  // If the selected seed/produce ran out, fall back to the hoe.
  function autoStow() {
    if (sel.kind === 'seed' && (state.seeds[sel.id] ?? 0) < 1) setSel({ kind: 'tool', id: 'hoe' });
    else if (sel.kind === 'item' && (state.inventory[sel.id] ?? 0) < 1) setSel({ kind: 'tool', id: 'hoe' });
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
    $('hud-day').textContent = `Day ${state.day}`;
    $('hud-clock').textContent = fmtTime(state.timeMin);
    $('hud-coins').textContent = state.coins;
    const stickers = state.school.stickers;
    $('hud-stickers').hidden = stickers === 0;
    $('hud-stickers').textContent = stickers > 0 ? '🌟'.repeat(Math.min(stickers, 5)) + (stickers > 5 ? `×${stickers}` : '') : '';
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
    el.innerHTML = text;
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

  // ── Shop panel ──
  function openShop() {
    const list = $('shop-list');
    list.innerHTML = '';
    const rows = [
      ...SEED_ORDER.filter((t) => !CROPS[t].schoolOnly).map((t) => ({
        id: 'seed:' + t, icon: CROPS[t].emoji, name: `${CROPS[t].name} seed`,
        desc: `${CROPS[t].days} days · sells ${CROPS[t].sell}c`, cost: CROPS[t].seed,
      })),
      { id: 'axe', icon: '🪓', name: 'Axe', desc: state.tools.axe ? 'owned!' : 'chop trees for wood', cost: AXE_COST, disabled: state.tools.axe },
    ];
    for (const r of rows) {
      const row = document.createElement('div');
      row.className = 'panel-row';
      const afford = state.coins >= r.cost && !r.disabled;
      row.innerHTML = `<span class="ic">${r.icon}</span><span class="nm">${r.name}<small>${r.desc}</small></span>
        <button class="chip-btn ${afford ? '' : 'off'}">${r.disabled ? '✓' : r.cost + ' 🪙'}</button>`;
      row.querySelector('button').onclick = () => { hooks.onBuy(r.id); openShop(); refresh(); };
      list.appendChild(row);
    }
    $('shop-coins').textContent = `You have ${state.coins} 🪙`;
    $('shop-panel').hidden = false;
  }

  // ── Shipping panel ──
  function openShip() {
    const list = $('ship-list');
    list.innerHTML = '';
    let any = false;
    for (const [item, n] of Object.entries(state.inventory)) {
      if (!n) continue;
      any = true;
      const row = document.createElement('div');
      row.className = 'panel-row';
      row.innerHTML = `<span class="ic">${ITEM_EMOJI[item] ?? '❔'}</span>
        <span class="nm">${CROPS[item]?.name ?? item} ×${n}<small>${SELLABLE[item]}c each</small></span>
        <button class="chip-btn">Ship 1</button><button class="chip-btn">All</button>`;
      const [b1, bAll] = row.querySelectorAll('button');
      b1.onclick = () => { hooks.onShip(item, 1); autoStow(); openShip(); refresh(); };
      bAll.onclick = () => { hooks.onShip(item, n); autoStow(); openShip(); refresh(); };
      list.appendChild(row);
    }
    if (!any) list.innerHTML = '<p class="empty">Nothing to ship — harvest something first!</p>';
    const crateTotal = Object.entries(state.crate).reduce((s, [it, n]) => s + (SELLABLE[it] ?? 0) * n, 0);
    const crateCount = Object.values(state.crate).reduce((s, n) => s + n, 0);
    $('ship-crate').textContent = crateCount
      ? `In crate: ${crateCount} item${crateCount > 1 ? 's' : ''} → ${crateTotal} 🪙 when you sleep`
      : 'Crate is empty. Coins arrive overnight.';
    $('ship-panel').hidden = false;
  }

  function closePanels() {
    $('shop-panel').hidden = true;
    $('ship-panel').hidden = true;
  }
  function anyPanelOpen() { return !$('shop-panel').hidden || !$('ship-panel').hidden || !$('sleep-overlay').hidden; }

  $('shop-close').onclick = closePanels;
  $('ship-close').onclick = closePanels;

  // ── Sleep overlay ──
  function showSleep(summary, dozedOff) {
    const el = $('sleep-overlay');
    $('sleep-title').textContent = dozedOff ? '💤 You dozed off…' : '🌙 Good night!';
    let html = '';
    if (summary.earned > 0) {
      const items = Object.entries(summary.sold).map(([it, n]) => `${ITEM_EMOJI[it] ?? ''} ×${n}`).join('  ');
      html += `<p class="earn">${items}</p><p class="earn big">+${summary.earned} 🪙 from the crate</p>`;
    }
    if (summary.grew) html += `<p>${summary.grew} crop${summary.grew > 1 ? 's' : ''} grew overnight 🌱</p>`;
    if (summary.ripened) html += `<p>${summary.ripened} ready to harvest! ✨</p>`;
    if (!html) html = '<p>A quiet night on the farm.</p>';
    if (state.school.stickers > 0) html += `<p class="stickers">Sticker collection: ${'🌟'.repeat(Math.min(state.school.stickers, 8))}</p>`;
    $('sleep-body').innerHTML = html;
    $('sleep-day').textContent = `Day ${summary.day}`;
    el.hidden = false;
  }
  $('sleep-continue').onclick = () => { $('sleep-overlay').hidden = true; hooks.onWake?.(); };

  // ── Start screen ──
  function showStart(hasSave) {
    $('start-screen').hidden = false;
    $('btn-continue').hidden = !hasSave;
    $('btn-new').textContent = hasSave ? 'New Farm' : 'Start Farming';
    $('btn-new').classList.toggle('secondary', hasSave);
    $('btn-continue').onclick = () => { $('start-screen').hidden = true; hooks.onContinue(); };
    $('btn-new').onclick = () => {
      if (hasSave && !confirm('Start over? Your current farm will be lost.')) return;
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
    openShop, openShip, closePanels, anyPanelOpen, showSleep, showStart,
    selectTool, selectSeed, selectItem, cycleSeed, autoStow,
    get selection() { return sel; },
    get tool() { return sel.kind === 'tool' ? sel.id : null; },
    get seedType() { return sel.kind === 'seed' ? sel.id : null; },
  };
}
