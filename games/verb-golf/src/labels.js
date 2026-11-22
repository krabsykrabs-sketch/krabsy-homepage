// Word plates over the gates: a canvas texture on a sprite (always faces the camera).
// States: 'wait' ("?"), 'open' (a word to choose), 'right' (teal), 'wrong' / 'off' (greyed).
import * as THREE from 'three';

const W = 320, H = 120;

export function makePlate() {
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(2.05, 2.05 * H / W, 1);
  sprite.renderOrder = 5;
  const plate = { sprite, word: '', state: 'wait' };
  plate.set = (state, word = plate.word) => {
    plate.state = state; plate.word = word;
    draw(canvas.getContext('2d'), state, word);
    tex.needsUpdate = true;
  };
  plate.set('wait', '');
  return plate;
}

function draw(ctx, state, word) {
  ctx.clearRect(0, 0, W, H);
  const fill = { wait: '#16335e', open: '#fdf7ea', right: '#2ee6c0', wrong: '#5a4a5c', off: '#3a4b68' }[state];
  const ink = { wait: '#9db4dd', open: '#0d2240', right: '#06231d', wrong: '#a8949e', off: '#7d8eab' }[state];
  const edge = { wait: '#2b4370', open: '#ffcf5e', right: '#159a80', wrong: '#3a2a3c', off: '#2b3a55' }[state];
  const r = 30, x = 8, y = 8, w = W - 16, h = H - 22;
  ctx.fillStyle = 'rgba(0,0,0,.28)';
  rr(ctx, x, y + 8, w, h, r); ctx.fill();
  ctx.fillStyle = fill; ctx.strokeStyle = edge; ctx.lineWidth = 7;
  rr(ctx, x, y, w, h, r); ctx.fill(); ctx.stroke();
  const text = state === 'wait' ? '?' : word;
  let size = 62;
  ctx.font = `400 ${size}px 'Fredoka One', sans-serif`;
  while (ctx.measureText(text).width > w - 30 && size > 26) { size -= 2; ctx.font = `400 ${size}px 'Fredoka One', sans-serif`; }
  ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, W / 2, y + h / 2 + 3);
  if (state === 'wrong') {
    ctx.strokeStyle = 'rgba(255,133,133,.8)'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(40, y + h / 2); ctx.lineTo(W - 40, y + h / 2); ctx.stroke();
  }
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
