// In-browser build mode: compose the tower by clicking slots. A left palette
// picks the "brush" (a room, or Erase); the tower shows translucent placeholders
// for empty slots that you click to fill. Add/remove floors, Save (→ localStorage
// + downloads building.json), Clear. Purely an authoring layer over `tower`.
//
// NOTE: the original brief listed "in-game build mode" as a non-goal — this is a
// deliberate later override (Jan asked to construct the tower himself).

const TEAL = 0x2ee6c0;

export function createBuilder(tower, { THREE, scene, camera, renderer }) {
  injectStyles();

  // ── 3D slot layer (clickable proxies + ghosts + hover highlight) ───────
  const layer = new THREE.Group();
  layer.name = 'builderLayer';
  layer.visible = false;
  scene.add(layer);

  const proxies = [];                 // invisible, raycastable: {mesh, c, f, filled}
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let hovered = null;

  const ghostMat = new THREE.MeshBasicMaterial({ color: TEAL, transparent: true, opacity: 0.08, depthWrite: false });
  const highlight = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
    new THREE.LineBasicMaterial({ color: TEAL }),
  );
  highlight.visible = false;
  layer.add(highlight);

  function clearProxies() {
    for (const p of proxies) { layer.remove(p.mesh); p.mesh.geometry.dispose(); }
    proxies.length = 0;
    for (let i = layer.children.length - 1; i >= 0; i--) {
      const ch = layer.children[i];
      if (ch.userData.ghost) { layer.remove(ch); ch.geometry.dispose(); }
    }
    highlight.visible = false; hovered = null;
  }

  function buildProxies() {
    clearProxies();
    if (!tower.built) return;
    for (const s of tower.built.slots) {
      const w = s.w * 0.96, h = s.h * 0.92, d = Math.max(s.d, 1.5);
      // invisible click proxy (raycast ignores .visible) covering the slot volume
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), ghostMat);
      mesh.visible = false;
      mesh.position.set(s.x, s.yMid, s.zMid);
      mesh.userData = { c: s.c, f: s.f };
      layer.add(mesh);
      proxies.push({ mesh, c: s.c, f: s.f, filled: !!s.id, w, h, d, x: s.x, yMid: s.yMid, zMid: s.zMid });
      // ghost box only for empty slots
      if (!s.id) {
        const ghost = new THREE.Mesh(new THREE.BoxGeometry(w * 0.92, h * 0.86, d * 0.9), ghostMat);
        ghost.position.set(s.x, s.yMid, s.zMid);
        ghost.userData.ghost = true;
        layer.add(ghost);
        const edges = new THREE.LineSegments(
          new THREE.EdgesGeometry(new THREE.BoxGeometry(w * 0.92, h * 0.86, d * 0.9)),
          new THREE.LineBasicMaterial({ color: TEAL, transparent: true, opacity: 0.4 }),
        );
        edges.position.copy(ghost.position); edges.userData.ghost = true;
        layer.add(edges);
      }
    }
  }

  function pickSlot(ev) {
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(proxies.map((p) => p.mesh), false);
    if (!hits.length) return null;
    return hits[0].object.userData; // {c, f}
  }

  function onMove(ev) {
    if (!tower.buildMode) return;
    const hit = pickSlot(ev);
    if (!hit) { highlight.visible = false; hovered = null; renderer.domElement.style.cursor = ''; return; }
    const p = proxies.find((q) => q.c === hit.c && q.f === hit.f);
    if (!p) return;
    hovered = hit;
    highlight.visible = true;
    highlight.position.set(p.x, p.yMid, p.zMid);
    highlight.scale.set(p.w, p.h, p.d);
    renderer.domElement.style.cursor = 'pointer';
  }

  async function onDown(ev) {
    if (!tower.buildMode || ev.button !== 0) return;
    const hit = pickSlot(ev);
    if (!hit) return;
    const id = (tower.brush === 'erase') ? null : tower.brush;
    await tower.setSlot(hit.c, hit.f, id);
  }

  renderer.domElement.addEventListener('pointermove', onMove);
  renderer.domElement.addEventListener('pointerdown', onDown);

  // ── DOM: toggle button + panel ─────────────────────────────────────────
  const toggle = el('button', 'stToggle', '🏗 Build');
  document.body.appendChild(toggle);

  const panel = el('div', 'stPanel');
  panel.innerHTML = `
    <div class="stHead">🏗 Build your tower</div>
    <div class="stHint">Pick a room, then click a glowing slot in the tower. Click a filled slot to replace it; use Erase to clear.</div>
    <div class="stSection">Rooms</div>
    <div class="stPalette" id="stPalette"></div>
    <div class="stSection">Floors &amp; layout</div>
    <div class="stRow">
      <button class="stBtn" id="stAdd">＋ Floor</button>
      <button class="stBtn" id="stRemove">－ Floor</button>
      <button class="stBtn" id="stClear">Clear</button>
    </div>
    <div class="stRow">
      <button class="stBtn stPrimary" id="stSave">💾 Save layout</button>
      <button class="stBtn" id="stDone">✓ Done</button>
    </div>
    <div class="stFoot" id="stFoot"></div>`;
  document.body.appendChild(panel);

  const paletteEl = panel.querySelector('#stPalette');
  const footEl = panel.querySelector('#stFoot');

  function buildPalette() {
    paletteEl.innerHTML = '';
    const ids = Object.keys(tower.rooms);
    for (const id of ids) {
      const b = el('button', 'stChip', tower.rooms[id].label);
      b.dataset.id = id;
      if (tower.brush === id) b.classList.add('on');
      b.onclick = () => { tower.brush = id; refreshPalette(); };
      paletteEl.appendChild(b);
    }
    const er = el('button', 'stChip stErase', '🧽 Erase');
    er.dataset.id = 'erase';
    if (tower.brush === 'erase') er.classList.add('on');
    er.onclick = () => { tower.brush = 'erase'; refreshPalette(); };
    paletteEl.appendChild(er);
  }
  function refreshPalette() {
    for (const b of paletteEl.children) b.classList.toggle('on', b.dataset.id === tower.brush);
  }
  function refreshFoot() {
    const floors = tower.layout.length;
    const filled = tower.layout.flat().filter(Boolean).length;
    footEl.textContent = `${floors} floor(s) · ${filled} room(s) placed · ${tower.cols} columns`;
  }

  panel.querySelector('#stAdd').onclick = () => tower.addFloor();
  panel.querySelector('#stRemove').onclick = () => tower.removeFloor();
  panel.querySelector('#stClear').onclick = () => { if (confirm('Clear all placed rooms?')) tower.clear(); };
  panel.querySelector('#stSave').onclick = () => { tower.save(); flash(footEl, 'saved ✓ (building.json downloaded — drop it in the game folder to make it the default)'); };
  panel.querySelector('#stDone').onclick = () => api.exit();
  toggle.onclick = () => (tower.buildMode ? api.exit() : api.enter());

  // ── public API ─────────────────────────────────────────────────────────
  const api = {
    async enter() {
      await tower.enterBuild();         // rebuild (no tenants) → onRebuilt → refresh()
      panel.classList.add('open');
      layer.visible = true;
      toggle.textContent = '✓ Done';
      toggle.classList.add('on');
      buildPalette();
      refreshFoot();
    },
    async exit() {
      panel.classList.remove('open');
      layer.visible = false;
      toggle.textContent = '🏗 Build';
      toggle.classList.remove('on');
      await tower.exitBuild();          // rebuild with tenants
    },
    refresh() {                          // called by tower after every rebuild
      if (tower.buildMode) { buildProxies(); refreshFoot(); }
      else clearProxies();
      refreshPalette();
    },
  };
  return api;
}

// ── tiny DOM helpers ───────────────────────────────────────────────────────
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
function flash(node, msg) {
  node.textContent = msg;
  node.classList.add('stFlash');
  setTimeout(() => node.classList.remove('stFlash'), 2600);
}
function injectStyles() {
  if (document.getElementById('stBuilderCss')) return;
  const s = document.createElement('style');
  s.id = 'stBuilderCss';
  s.textContent = `
  .stToggle{position:fixed; right:14px; bottom:14px; z-index:40; cursor:pointer;
    font:700 14px 'Nunito',system-ui,sans-serif; color:#0e141d; background:#2ee6c0;
    border:none; border-radius:11px; padding:10px 16px; box-shadow:0 6px 18px rgba(0,0,0,.4);}
  .stToggle.on{background:#ffcf5e;}
  .stToggle:hover{filter:brightness(1.07);}
  .stPanel{position:fixed; left:0; top:0; bottom:0; width:264px; z-index:39; transform:translateX(-110%);
    transition:transform .25s ease; background:rgba(16,20,29,.94); backdrop-filter:blur(6px);
    border-right:1px solid rgba(46,230,192,.25); color:#e7ecf3; padding:16px 14px; overflow:auto;
    font:600 13px 'Nunito',system-ui,sans-serif;}
  .stPanel.open{transform:translateX(0);}
  .stHead{font:700 18px 'Fredoka One','Nunito',cursive; color:#2ee6c0; margin-bottom:6px;}
  .stHint{color:#8fa0b6; font-size:12px; line-height:1.45; margin-bottom:12px;}
  .stSection{color:#ffcf5e; font-weight:800; font-size:11px; letter-spacing:.6px; text-transform:uppercase; margin:12px 0 6px;}
  .stPalette{display:flex; flex-wrap:wrap; gap:7px;}
  .stChip{cursor:pointer; border:1px solid rgba(255,255,255,.16); background:rgba(255,255,255,.05);
    color:#e7ecf3; border-radius:9px; padding:7px 11px; font:700 13px 'Nunito',sans-serif;}
  .stChip:hover{border-color:rgba(46,230,192,.6);}
  .stChip.on{background:#2ee6c0; color:#0e141d; border-color:#2ee6c0;}
  .stChip.stErase.on{background:#ff8585; border-color:#ff8585;}
  .stRow{display:flex; gap:7px; margin-top:8px;}
  .stBtn{flex:1; cursor:pointer; border:1px solid rgba(255,255,255,.16); background:rgba(255,255,255,.05);
    color:#e7ecf3; border-radius:9px; padding:9px 8px; font:700 13px 'Nunito',sans-serif;}
  .stBtn:hover{border-color:rgba(46,230,192,.6);}
  .stPrimary{background:#2ee6c0; color:#0e141d; border-color:#2ee6c0;}
  .stFoot{margin-top:12px; color:#8fa0b6; font-size:12px; line-height:1.4;}
  .stFoot.stFlash{color:#2ee6c0;}
  `;
  document.head.appendChild(s);
}
