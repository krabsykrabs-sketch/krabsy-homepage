// Minimap (bottom left): island, zones, home, eggs, thieves, player arrow.
// North-up, so it reads like a map; the arrow shows where the player looks.
import { ISLAND, HOME, ZONES, RARITY } from './balance.js';

const ZONE_COLOR = { forest: '#3f8f43', beach: '#f2d9a0', volcano: '#6b4a45' };

export class Minimap {
  constructor(canvas) {
    this.c = canvas; this.x = canvas.getContext('2d');
    this.size = canvas.width;
    this.scale = this.size / (ISLAND.r * 2 + 16);
  }
  px(x, z) { return [this.size / 2 + (x - ISLAND.cx) * this.scale, this.size / 2 + (z - ISLAND.cz) * this.scale]; }
  draw({ player, yaw, eggs, thieves, isOpen, carrying }) {
    const x = this.x, S = this.size;
    x.clearRect(0, 0, S, S);
    x.save();
    x.beginPath(); x.arc(S / 2, S / 2, S / 2 - 1, 0, Math.PI * 2); x.clip();
    x.fillStyle = '#3fb8e8'; x.fillRect(0, 0, S, S);
    let [cx, cy] = this.px(ISLAND.cx, ISLAND.cz);
    x.fillStyle = '#86d46c'; x.beginPath(); x.arc(cx, cy, (ISLAND.r - 6) * this.scale, 0, Math.PI * 2); x.fill();
    for (const z of ZONES) {
      if (!z.r) continue;
      const [zx, zy] = this.px(z.x, z.z);
      x.fillStyle = ZONE_COLOR[z.id]; x.beginPath(); x.arc(zx, zy, z.r * this.scale, 0, Math.PI * 2); x.fill();
      if (!isOpen(z)) {
        x.strokeStyle = 'rgba(255,255,255,.85)'; x.lineWidth = 2; x.setLineDash([4, 3]); x.stroke(); x.setLineDash([]);
        x.fillStyle = '#ffcf5e'; x.font = 'bold 12px Nunito, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText(`🔒${z.stars}★`, zx, zy);
      }
    }
    // home
    const [hx, hy] = this.px(HOME.x, HOME.z);
    x.fillStyle = '#2ee6c0'; x.strokeStyle = '#0d2240'; x.lineWidth = 2;
    x.beginPath(); x.arc(hx, hy, carrying ? 7 + Math.sin(performance.now() / 150) * 1.5 : 6, 0, Math.PI * 2); x.fill(); x.stroke();
    // eggs
    for (const e of eggs) {
      const [ex, ey] = this.px(e.x, e.z);
      x.fillStyle = RARITY[e.rarity].css; x.strokeStyle = 'rgba(13,34,64,.8)'; x.lineWidth = 1;
      x.beginPath(); x.arc(ex, ey, e.rarity === 'common' ? 2.2 : 3.2, 0, Math.PI * 2); x.fill(); x.stroke();
    }
    // thieves
    for (const t of thieves) {
      if (!isOpen(t.zone)) continue;
      const [tx, ty] = this.px(t.x, t.z);
      x.fillStyle = t.state === 'chase' ? '#ff3b3b' : '#ff8585';
      x.fillRect(tx - 2.5, ty - 2.5, 5, 5);
    }
    // player arrow
    const [px, py] = this.px(player.x, player.z);
    x.translate(px, py); x.rotate(-yaw);
    x.fillStyle = '#fff'; x.strokeStyle = '#0d2240'; x.lineWidth = 2;
    x.beginPath(); x.moveTo(0, -8); x.lineTo(6, 6); x.lineTo(0, 3); x.lineTo(-6, 6); x.closePath(); x.fill(); x.stroke();
    x.restore();
    x.strokeStyle = 'rgba(13,34,64,.9)'; x.lineWidth = 4;
    x.beginPath(); x.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2); x.stroke();
  }
}
