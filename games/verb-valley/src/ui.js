// DOM layer: HUD (clock/day/coins/hotbar), start screen, shop + shipping
// panels, sleep summary, world-anchored speech bubbles, toasts. All markup
// lives in index.html; this module wires and updates it.

import * as THREE from 'three';
import { CROPS, SELLABLE, AXE_COST } from './config.js';
import { sfx, toggle as toggleSound, isEnabled as soundOn } from './audio.js';

const $ = (id) => document.getElementById(id);

const TOOL_DEFS = [
  { id: 'hoe', icon: '⛏', name: 'Hoe' },
  { id: 'can', icon: '🚿', name: 'Watering can' },
  { id: 'seeds', icon: '🌱', name: 'Seeds' },
  { id: 'axe', icon: '🪓', name: 'Axe' },
];
const SEED_ORDER = ['turnip', 'tomato', 'pumpkin', 'starfruit'];
const ITEM_EMOJI = { turnip: '🥬', tomato: '🍅', pumpkin: '🎃', starfruit: '⭐', wood: '🪵', berry: '🫐' };

export function createUI(state, hooks) {
  // hooks: { onBuy(id), onShip(item, n), onSleep(), onNewFarm(), onContinue() }
  let tool = 'hoe';
  let seedSel = 0;
  const v3 = new THREE.Vector3();

  // ── Hotbar ──
  const hotbar = $('hotbar');
  function renderHotbar() {
    hotbar.innerHTML = '';
    TOOL_DEFS.forEach((t, i) => {
      const owned = t.id === 'seeds' ? true : state.tools[t.id];
      const slot = document.createElement('div');
      slot.className = 'slot' + (tool === t.id ? ' active' : '') + (owned ? '' : ' locked');
      let label = t.icon;
      if (t.id === 'seeds') {
        const type = SEED_ORDER[seedSel];
        label = CROPS[type].emoji;
        const n = state.seeds[type] ?? 0;
        slot.innerHTML = `<span>${label}</span><b class="count">${n}</b><i class="key">${i + 1}</i>`;
      } else {
        slot.innerHTML = `<span>${owned ? t.icon : '🔒'}</span><i class="key">${i + 1}</i>`;
      }
      slot.title = t.id === 'seeds' ? `${CROPS[SEED_ORDER[seedSel]].name} seeds (press 3 again to cycle)` : t.name;
      slot.onclick = () => selectTool(t.id);
      hotbar.appendChild(slot);
    });
    $('gate-pill').hidden = state.schooledDay === state.day;
  }

  function selectTool(id) {
    if (id === 'seeds' && tool === 'seeds') {
      // cycle seed type
      for (let k = 1; k <= SEED_ORDER.length; k++) {
        const j = (seedSel + k) % SEED_ORDER.length;
        if ((state.seeds[SEED_ORDER[j]] ?? 0) > 0 || k === SEED_ORDER.length) { seedSel = j; break; }
      }
    }
    if (id === 'axe' && !state.tools.axe) { sfx.deny(); toast('No axe yet — check the shop!'); return; }
    tool = id;
    renderHotbar();
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
      row.querySelector('button').onclick = () => { hooks.onBuy(r.id); openShop(); updateHUD(); };
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
      b1.onclick = () => { hooks.onShip(item, 1); openShip(); };
      bAll.onclick = () => { hooks.onShip(item, n); openShip(); };
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

  renderHotbar();
  updateHUD();

  return {
    updateHUD, renderHotbar, toast, prompt, bubble, projectBubble,
    openShop, openShip, closePanels, anyPanelOpen, showSleep, showStart,
    selectTool,
    get tool() { return tool; },
    get seedType() { return SEED_ORDER[seedSel]; },
  };
}
