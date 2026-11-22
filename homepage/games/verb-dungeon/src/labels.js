// Word plates drawn in the 3D room (rune door signs, bridge stones): a plane with a
// canvas texture. Unlit and not tone-mapped, so the words read like the interface
// (same colours and font) however dark the corner is.
import * as THREE from 'three';

const LOOK = {
  normal: { bg: '#13294d', edge: '#ffcf5e', ink: '#eaf2ff' },
  base: { bg: '#4a3a10', edge: '#ffcf5e', ink: '#ffcf5e' },   // the given base form (amber)
  right: { bg: '#0d4a42', edge: '#2ee6c0', ink: '#2ee6c0' },
  wrong: { bg: '#241f2b', edge: '#4a3f50', ink: '#6f6474' },
  wait: { bg: '#162036', edge: '#3a4a6e', ink: '#5d6f96' },   // a bridge stone whose word comes later
};

// w, h in world units. flat = lies on the floor (text is drawn taller, because the
// camera looks down at an angle and squeezes it).
export function makeLabel(w, h, { flat = false } = {}) {
  const PX = 128, stretch = flat ? 1.35 : 1;
  const c = document.createElement('canvas');
  c.width = Math.round(w * PX); c.height = Math.round(h * PX);
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false }));
  if (flat) mesh.rotation.x = -Math.PI / 2;
  const label = {
    mesh, text: '', state: 'normal',
    set(text, state = 'normal') {
      label.text = text; label.state = state;
      const look = LOOK[state], W = c.width, H = c.height, r = 26, b = 9;
      g.clearRect(0, 0, W, H);
      g.fillStyle = look.bg; g.strokeStyle = look.edge; g.lineWidth = b;
      g.beginPath(); g.roundRect(b / 2, b / 2, W - b, H - b, r); g.fill(); g.stroke();
      // Largest font that fits the plate.
      let size = Math.min(H * 0.62 / stretch, 150);
      g.font = `${size}px 'Fredoka One', 'Nunito', sans-serif`;
      const room = W - 46, tw = g.measureText(text).width;
      if (tw > room) { size *= room / tw; g.font = `${size}px 'Fredoka One', 'Nunito', sans-serif`; }
      g.fillStyle = look.ink; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.save(); g.translate(W / 2, H / 2 + size * 0.04 * stretch); g.scale(1, stretch);
      g.fillText(text, 0, 0);
      g.restore();
      tex.needsUpdate = true;
    },
    dispose() { mesh.geometry.dispose(); mesh.material.dispose(); tex.dispose(); },
  };
  return label;
}

// A small brick-wall texture for the dead ends behind wrong rune doors.
export const brickTex = (() => {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#2a2f45'; g.fillRect(0, 0, 128, 128);
  for (let row = 0; row < 8; row++) for (let col = -1; col < 4; col++) {
    const x = col * 32 + (row % 2 ? 16 : 0), y = row * 16;
    g.fillStyle = ['#6d6f8c', '#7b7d9b', '#62647f', '#74688a'][(row * 3 + col + 4) % 4];
    g.fillRect(x + 2, y + 2, 28, 12);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
