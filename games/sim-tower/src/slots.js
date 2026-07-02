// Reusable clickable plot layer for the block. Ghosts are shown ONLY for the
// currently selected build tool (tower.brush):
//   • null      → nothing (clean view)
//   • 'expand'  → AMBER frontier plots (buy floor space on the ring)
//   • a room id → TEAL empty owned plots (build that room)
//   • 'erase'   → TEAL on built plots (sandbox)
// Plots are yawed per block side; ghosts carry the same rotation.
// onPick(i, side, kind, content) fires on click; clickAt returns true on a hit.
const TEAL = 0x2ee6c0;
const AMBER = 0xffcf5e;

export function createSlotPicker(tower, { THREE, scene, camera, renderer, onPick }) {
  const layer = new THREE.Group();
  layer.name = 'slotPicker';
  layer.visible = false;
  scene.add(layer);

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const proxies = [];
  const tealMat = new THREE.MeshBasicMaterial({ color: TEAL, transparent: true, opacity: 0.09, depthWrite: false });
  const amberMat = new THREE.MeshBasicMaterial({ color: AMBER, transparent: true, opacity: 0.1, depthWrite: false });

  const highlight = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
    new THREE.LineBasicMaterial({ color: TEAL }),
  );
  highlight.visible = false;
  layer.add(highlight);

  function clear() {
    for (let i = layer.children.length - 1; i >= 0; i--) {
      const ch = layer.children[i];
      if (ch === highlight) continue;
      layer.remove(ch); ch.geometry?.dispose?.();
    }
    proxies.length = 0;
    highlight.visible = false;
  }

  // invisible clickable proxy over a plot + an optional coloured fill, yawed to its side
  function addCell(s, kind, color, fill) {
    const w = s.w * 0.96, h = s.h * 0.92, d = Math.max(s.d, 1.5);
    const yaw = (s.yawDeg || 0) * Math.PI / 180;
    const proxy = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), tealMat);
    proxy.visible = false;                          // raycast ignores .visible → invisible but clickable
    proxy.position.set(s.x, s.yMid, s.z);
    proxy.rotation.y = yaw;
    proxy.userData = { c: s.c, f: s.f, kind, content: s.content ?? null, w, h, d, yaw };
    layer.add(proxy); proxies.push(proxy);
    if (fill) {
      const m = color === AMBER ? amberMat : tealMat;
      const g = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, h * 0.84, d * 0.9), m);
      g.position.copy(proxy.position); g.rotation.y = yaw; layer.add(g);
      const e = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(w * 0.9, h * 0.84, d * 0.9)),
        new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.45 }),
      );
      e.position.copy(proxy.position); e.rotation.y = yaw; layer.add(e);
    }
  }

  function refresh() {
    clear();
    if (!tower.built) return;
    const brush = tower.brush;
    if (!brush) return;                                // no tool selected → no ghosts
    if (brush === 'expand') {
      for (const s of (tower.built.buyable || [])) addCell(s, 'buy', AMBER, true);
    } else if (brush === 'erase') {
      for (const s of tower.built.slots) if (s.content != null) addCell(s, 'lot', TEAL, true);
    } else {
      for (const s of tower.built.slots) if (s.content == null) addCell(s, 'lot', TEAL, true);   // build a room into an owned plot
    }
  }

  function pick(ev) {
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(proxies, false);
    return hits.length ? hits[0].object : null;
  }

  function hoverAt(ev) {
    if (!layer.visible || !tower.brush) { highlight.visible = false; renderer.domElement.style.cursor = ''; return; }
    const hit = pick(ev);
    if (!hit) { highlight.visible = false; renderer.domElement.style.cursor = ''; return; }
    highlight.visible = true;
    highlight.material.color.setHex(hit.userData.kind === 'buy' ? AMBER : TEAL);
    highlight.position.copy(hit.position);
    highlight.rotation.y = hit.userData.yaw;
    highlight.scale.set(hit.userData.w, hit.userData.h, hit.userData.d);
    renderer.domElement.style.cursor = 'pointer';
  }
  /** Returns true if a ghost was clicked (so the caller knows not to deselect). */
  function clickAt(ev) {
    if (!layer.visible || (ev.button != null && ev.button !== 0)) return false;
    const hit = pick(ev);
    if (hit) { onPick(hit.userData.c, hit.userData.f, hit.userData.kind, hit.userData.content); return true; }
    return false;
  }

  return {
    refresh,
    clickAt, hoverAt,
    /** Flat/no-rig path: bind simple pointer listeners directly. */
    attachDirect() {
      renderer.domElement.addEventListener('pointermove', hoverAt);
      renderer.domElement.addEventListener('pointerdown', clickAt);
    },
    setVisible(v) { layer.visible = v; if (!v) { highlight.visible = false; renderer.domElement.style.cursor = ''; } },
    isVisible() { return layer.visible; },
  };
}
