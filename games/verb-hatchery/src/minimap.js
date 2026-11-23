// Minimap (bottom left): island, zones, home, eggs, thieves, player arrow.
// North-up, so it reads like a map; the arrow shows where the player looks.
import { ISLAND, HOME, ZONES, RARITY } from './balance.js';
import { PATHS, POND, pondPoint, WATER_Y, terrainH, zoneAt, onPier, STREAM, BRIDGE, LIGHT, HILL } from './world.js';

export class Minimap {
  constructor(canvas) {
    this.c = canvas; this.x = canvas.getContext('2d');
    this.size = canvas.width;
    this.scale = this.size / (ISLAND.r * 2 + 32); // (room for the tiny islands off the coast)
    this.base = this._base();
  }
  // The island as it really is (coast, bay, zones), drawn once from the height function.
  _base() {
    const S = this.size, c = document.createElement('canvas'); c.width = c.height = S;
    const x = c.getContext('2d'), img = x.createImageData(S, S), d = img.data;
    const COL = { sea: [63, 184, 232], shallow: [127, 226, 222], meadow: [134, 212, 108], forest: [63, 143, 67], beach: [242, 217, 160], volcano: [107, 74, 69], pier: [154, 98, 54] };
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const wx = ISLAND.cx + (i + 0.5 - S / 2) / this.scale, wz = ISLAND.cz + (j + 0.5 - S / 2) / this.scale;
      const h = terrainH(wx, wz);
      const k = onPier(wx, wz) ? 'pier' : h < WATER_Y - 0.9 ? 'sea' : h < WATER_Y ? 'shallow' : h < 0.2 ? 'beach' : zoneAt(wx, wz).id;
      d.set(COL[k], (j * S + i) * 4); d[(j * S + i) * 4 + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    // step-3 landmarks: the stream and its bridge, the hill's giant tree, the lighthouse
    x.strokeStyle = '#4cc6e8'; x.lineWidth = 3; x.lineCap = 'round'; x.lineJoin = 'round'; x.beginPath();
    STREAM.pts.forEach(([a, b], i) => { const [u, v] = this.px(a, b); if (i) x.lineTo(u, v); else x.moveTo(u, v); }); x.stroke();
    x.strokeStyle = '#8d887c'; x.lineWidth = 3.5; x.lineCap = 'butt'; x.beginPath();
    x.moveTo(...this.px(BRIDGE.x - BRIDGE.ux * 6, BRIDGE.z - BRIDGE.uz * 6)); x.lineTo(...this.px(BRIDGE.x + BRIDGE.ux * 6, BRIDGE.z + BRIDGE.uz * 6)); x.stroke();
    x.fillStyle = '#3f8f43'; x.beginPath(); x.arc(...this.px(HILL.x, HILL.z), 4, 0, 6.3); x.fill();
    x.fillStyle = '#fff'; x.strokeStyle = '#55657f'; x.lineWidth = 1.5; x.beginPath(); x.arc(...this.px(LIGHT.x, LIGHT.z), 2.6, 0, 6.3); x.fill(); x.stroke();
    return c;
  }
  px(x, z) { return [this.size / 2 + (x - ISLAND.cx) * this.scale, this.size / 2 + (z - ISLAND.cz) * this.scale]; }
  draw({ player, yaw, eggs, thieves, isOpen, carrying }) {
    const x = this.x, S = this.size;
    x.clearRect(0, 0, S, S);
    x.save();
    x.beginPath(); x.arc(S / 2, S / 2, S / 2 - 1, 0, Math.PI * 2); x.clip();
    x.drawImage(this.base, 0, 0);
    for (const z of ZONES) {
      if (!z.r || isOpen(z)) continue;
      const [zx, zy] = this.px(z.x, z.z);
      x.beginPath(); x.arc(zx, zy, z.r * this.scale, 0, Math.PI * 2);
      x.fillStyle = 'rgba(13,34,64,.28)'; x.fill();
      x.strokeStyle = 'rgba(255,255,255,.85)'; x.lineWidth = 2; x.setLineDash([4, 3]); x.stroke(); x.setLineDash([]);
      x.fillStyle = '#ffcf5e'; x.font = 'bold 12px Nunito, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(`🔒${z.stars}★`, zx, zy);
    }
    // paths and the pond
    x.strokeStyle = '#c9a46f'; x.lineWidth = 2.5; x.lineCap = 'round'; x.lineJoin = 'round';
    for (const p of PATHS) { x.beginPath(); p.forEach(([a, b], i) => { const [u, v] = this.px(a, b); if (i) x.lineTo(u, v); else x.moveTo(u, v); }); x.stroke(); }
    x.fillStyle = '#4cc6e8'; x.beginPath(); // the pond's real outline (its waterline)
    for (let k = 0; k < 24; k++) { const [u, v] = this.px(...pondPoint(k / 24 * Math.PI * 2, POND.r * 0.85)); if (k) x.lineTo(u, v); else x.moveTo(u, v); }
    x.closePath(); x.fill();
    // home
    const [hx, hy] = this.px(HOME.x, HOME.z);
    x.fillStyle = '#2ee6c0'; x.strokeStyle = '#0d2240'; x.lineWidth = 2;
    x.beginPath(); x.arc(hx, hy, carrying ? 7 + Math.sin(performance.now() / 150) * 1.5 : 6, 0, Math.PI * 2); x.fill(); x.stroke();
    // eggs
    for (const e of eggs) {
      const [ex, ey] = this.px(e.x, e.z);
      x.fillStyle = RARITY[e.rarity].css; x.strokeStyle = 'rgba(13,34,64,.8)'; x.lineWidth = 1;
      x.beginPath(); x.arc(ex, ey, e.event ? 5 : e.rarity === 'common' ? 2.2 : 3.2, 0, Math.PI * 2); x.fill(); x.stroke();
      if (e.event) { // blinking ring around the special egg
        x.strokeStyle = '#ffcf5e'; x.lineWidth = 2.5;
        x.beginPath(); x.arc(ex, ey, 9 + Math.sin(performance.now() / 180) * 3, 0, Math.PI * 2); x.stroke();
      }
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
