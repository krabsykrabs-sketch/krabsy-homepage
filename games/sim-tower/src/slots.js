// Reusable clickable slot layer for the tower: translucent placeholders on
// empty cells + a hover highlight + raycast picking. onPick(c, f) fires on click.
const TEAL = 0x2ee6c0;

export function createSlotPicker(tower, { THREE, scene, camera, renderer, onPick }) {
  const layer = new THREE.Group();
  layer.name = 'slotPicker';
  layer.visible = false;
  scene.add(layer);

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const proxies = [];
  const ghostMat = new THREE.MeshBasicMaterial({ color: TEAL, transparent: true, opacity: 0.09, depthWrite: false });

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

  function refresh() {
    clear();
    if (!tower.built) return;
    for (const s of tower.built.slots) {
      const w = s.w * 0.96, h = s.h * 0.92, d = Math.max(s.d, 1.5);
      const proxy = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), ghostMat);
      proxy.visible = false;                        // raycast ignores .visible → invisible but clickable
      proxy.position.set(s.x, s.yMid, s.zMid);
      proxy.userData = { c: s.c, f: s.f, w, h, d };
      layer.add(proxy);
      proxies.push(proxy);
      if (!s.id) {                                  // ghost box for empty slots
        const g = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, h * 0.84, d * 0.9), ghostMat);
        g.position.copy(proxy.position);
        layer.add(g);
        const e = new THREE.LineSegments(
          new THREE.EdgesGeometry(new THREE.BoxGeometry(w * 0.9, h * 0.84, d * 0.9)),
          new THREE.LineBasicMaterial({ color: TEAL, transparent: true, opacity: 0.42 }),
        );
        e.position.copy(proxy.position);
        layer.add(e);
      }
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
    if (!layer.visible) { highlight.visible = false; return; }
    const hit = pick(ev);
    if (!hit) { highlight.visible = false; renderer.domElement.style.cursor = ''; return; }
    highlight.visible = true;
    highlight.position.copy(hit.position);
    highlight.scale.set(hit.userData.w, hit.userData.h, hit.userData.d);
    renderer.domElement.style.cursor = 'pointer';
  }
  function clickAt(ev) {
    if (!layer.visible || (ev.button != null && ev.button !== 0)) return;
    const hit = pick(ev);
    if (hit) onPick(hit.userData.c, hit.userData.f);
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
