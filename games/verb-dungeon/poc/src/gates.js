import * as THREE from 'three';
import { rand, clamp, canvasTexture } from './utils.js';
import { makeChallenge, makeRuneChallenge } from './verbs.js';
import { ui, chainHTML } from './ui.js';
import { fx } from './fx.js';
import { sfx } from './audio.js';

const SLOT_COLOR = { base: '#ffcf5e', past: '#2ee6c0', pp: '#ff8585' };

// floating stone word-plate texture
function drawPlate(g, w, h, text, slot) {
  g.clearRect(0, 0, w, h);
  // slab face
  g.fillStyle = '#39456b';
  g.beginPath(); g.roundRect(8, 8, w - 16, h - 16, 26); g.fill();
  g.strokeStyle = '#222a45'; g.lineWidth = 10; g.stroke();
  g.strokeStyle = 'rgba(160,190,240,.16)'; g.lineWidth = 4;
  g.beginPath(); g.roundRect(20, 20, w - 40, h - 40, 18); g.stroke();
  // chisel specks
  g.fillStyle = 'rgba(0,0,0,.25)';
  for (let i = 0; i < 40; i++) g.fillRect(rand(14, w - 14), rand(14, h - 14), 3, 3);

  g.textAlign = 'center'; g.textBaseline = 'middle';
  const fit = (str, max, startPx) => {
    let px = startPx;
    do { g.font = `${px}px "Fredoka One", sans-serif`; px -= 4; }
    while (g.measureText(str).width > max && px > 22);
  };
  if (slot === 'both') {
    const [a, b] = text.split(' · ');
    fit(`${a} · ${b}`, w - 90, 74);
    const mid = g.measureText(' · ').width;
    const wa = g.measureText(a).width, wb = g.measureText(b).width;
    const total = wa + mid + wb;
    let x = w / 2 - total / 2;
    g.fillStyle = SLOT_COLOR.past; g.textAlign = 'left';
    g.fillText(a, x, h / 2); x += wa;
    g.fillStyle = '#9db4dd'; g.fillText(' · ', x, h / 2); x += mid;
    g.fillStyle = SLOT_COLOR.pp; g.fillText(b, x, h / 2);
    g.textAlign = 'center';
  } else {
    fit(text, w - 80, 104);
    g.fillStyle = SLOT_COLOR[slot] || '#fff';
    g.fillText(text, w / 2, h / 2);
  }
}

class WordPlates {
  constructor(scene, positions, facing) {
    this.scene = scene;
    this.plates = positions.map((p, i) => {
      const group = new THREE.Group();
      group.position.copy(p);
      group.position.y = 1.3;
      group.rotation.y = facing;
      const slab = new THREE.Mesh(
        new THREE.BoxGeometry(1.8, 1.05, 0.14),
        new THREE.MeshLambertMaterial({ color: 0x39456b }));
      group.add(slab);
      const canvas = document.createElement('canvas');
      canvas.width = 512; canvas.height = 288;
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      const faceMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
      const face = new THREE.Mesh(new THREE.PlaneGeometry(1.74, 0.99), faceMat);
      face.position.z = 0.078;
      group.add(face);
      group.visible = false;
      group.scale.setScalar(0.001);
      scene.add(group);
      return { group, canvas, tex, face, seed: rand(10), popT: -1, wobbleT: -1, baseY: 1.3 + (i % 2) * 0.12 };
    });
    this.shown = false;
  }

  setOptions(options, slot) {
    this.options = options;
    options.forEach((opt, i) => {
      const p = this.plates[i];
      drawPlate(p.canvas.getContext('2d'), 512, 288, opt.text, slot);
      p.tex.needsUpdate = true;
    });
  }

  show() {
    if (this.shown) return;
    this.shown = true;
    this.plates.forEach((p, i) => {
      p.group.visible = true;
      p.popT = -0.01 - i * 0.12; // stagger
    });
  }

  hide() {
    this.shown = false;
    for (const p of this.plates) { p.group.visible = false; p.group.scale.setScalar(0.001); p.popT = -1; }
  }

  wobble(i) {
    this.plates[i].wobbleT = 0;
    this.plates[i].face.material.color.set(0xffb0b0);
  }

  shatter() {
    for (const p of this.plates) {
      if (!p.group.visible) continue;
      fx.burst(p.group.position, { color: 0x9fe8ff, n: 16, speed: 2.6, life: 0.8, gravity: 2 });
      fx.burst(p.group.position, { color: 0xffe9a0, n: 8, speed: 1.6, life: 0.6 });
    }
    this.hide();
  }

  // index of the plate the hero is touching, or -1
  plateAt(pos) {
    if (!this.shown) return -1;
    for (let i = 0; i < this.plates.length; i++) {
      const g = this.plates[i].group;
      if (g.scale.x > 0.8 &&
        Math.hypot(pos.x - g.position.x, pos.z - g.position.z) < 0.95) return i;
    }
    return -1;
  }

  raycastIndex(raycaster) {
    if (!this.shown) return -1;
    for (let i = 0; i < this.plates.length; i++) {
      if (raycaster.intersectObject(this.plates[i].group, true).length) return i;
    }
    return -1;
  }

  update(dt, t) {
    if (!this.shown) return;
    for (const p of this.plates) {
      if (p.popT < 0) {
        p.popT += dt;
        if (p.popT >= 0) { p.popT = 0; sfx.popIn(); }
        continue;
      }
      if (p.popT < 0.4) {
        p.popT += dt;
        const k = Math.min(1, p.popT / 0.35);
        const s = 1 + 0.25 * Math.sin(k * Math.PI); // overshoot pop
        p.group.scale.setScalar(k < 1 ? k * s : 1);
      } else p.group.scale.setScalar(1);
      p.group.position.y = p.baseY + Math.sin(t * 1.8 + p.seed) * 0.07;
      if (p.wobbleT >= 0) {
        p.wobbleT += dt;
        const k = p.wobbleT / 0.8;
        p.group.rotation.z = Math.sin(p.wobbleT * 26) * 0.3 * Math.max(0, 1 - k);
        if (k >= 1) { p.wobbleT = -1; p.group.rotation.z = 0; p.face.material.color.set(0xffffff); }
      }
    }
  }
}

function runeCircleTexture(color = '#2ee6c0') {
  return canvasTexture(256, 256, (g) => {
    g.translate(128, 128);
    g.strokeStyle = color; g.lineWidth = 6;
    g.beginPath(); g.arc(0, 0, 96, 0, Math.PI * 2); g.stroke();
    g.font = '34px serif'; g.fillStyle = color;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const runes = 'ᚠᚢᚦᚨᚱᚲᚷ';
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      g.save(); g.translate(Math.cos(a) * 70, Math.sin(a) * 70); g.rotate(a + Math.PI / 2);
      g.fillText(runes[i], 0, 0); g.restore();
    }
    g.beginPath(); g.arc(0, 0, 34, 0, Math.PI * 2); g.stroke();
  });
}

// A verb-locked door or chest.
export class VerbGate {
  constructor(scene, level, {
    id, kind = 'door', pos, facing = Math.PI, pool, double = false,
    locked = false, platePositions, usedVerbs, onSolved,
  }) {
    this.id = id; this.kind = kind; this.scene = scene; this.level = level;
    this.pos = pos; this.pool = pool; this.double = double;
    this.locked = locked; this.usedVerbs = usedVerbs; this.onSolved = onSolved;
    this.state = 'closed'; // closed | opening | open
    this.activated = false;
    this.cooldown = 0;
    this.firstTry = true;
    this.openT = 0;
    this.hintShown = false;

    this.plates = new WordPlates(scene, platePositions, facing);
    if (kind === 'door') this._buildDoor();
    else this._buildChest();
    this._newChallenge();
  }

  _buildDoor() {
    const m = this.level.mats;
    this.slab = new THREE.Group();
    this.slab.position.set(this.pos.x, 0, this.pos.z);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(3.3, 4.1, 0.34), m.wood);
    panel.position.y = 2.05;
    this.slab.add(panel);
    for (const by of [0.7, 2.05, 3.4]) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(3.34, 0.18, 0.38), m.stoneDk);
      band.position.y = by;
      this.slab.add(band);
    }
    this.rune = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 1.5),
      new THREE.MeshBasicMaterial({
        map: runeCircleTexture(), transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      }));
    this.rune.position.set(0, 2.1, -0.22);
    this.slab.add(this.rune);
    this.scene.add(this.slab);
    this.collider = this.level.addCollider(this.pos.x, this.pos.z, 3.3, 0.6, true);
  }

  _buildChest() {
    const m = this.level.mats;
    this.chest = new THREE.Group();
    this.chest.position.set(this.pos.x, 0, this.pos.z);
    this.chest.rotation.y = this.pos.ry || 0;
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.62, 0.8), m.wood);
    base.position.y = 0.31;
    this.chest.add(base);
    this.lid = new THREE.Group();
    this.lid.position.set(0, 0.62, -0.4); // hinge at the back
    const lidMesh = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.28, 0.8), m.wood);
    lidMesh.position.set(0, 0.14, 0.4);
    this.lid.add(lidMesh);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(1.19, 0.08, 0.84), m.gold);
    trim.position.set(0, 0.02, 0.4);
    this.lid.add(trim);
    this.chest.add(this.lid);
    const lock = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.26, 0.08), m.gold);
    lock.position.set(0, 0.56, 0.42);
    this.chest.add(lock);
    this.rune = new THREE.Mesh(
      new THREE.PlaneGeometry(0.85, 0.85),
      new THREE.MeshBasicMaterial({
        map: runeCircleTexture('#ffcf5e'), transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending,
      }));
    this.rune.position.set(0, 0.45, 0.46);
    this.chest.add(this.rune);
    // golden light beam, revealed on open
    this.beam = new THREE.Mesh(
      new THREE.ConeGeometry(0.55, 2.6, 14, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xffe2a0, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      }));
    this.beam.position.set(0, 1.6, 0);
    this.chest.add(this.beam);
    this.scene.add(this.chest);
    this.collider = this.level.addCollider(this.pos.x, this.pos.z, 1.3, 1.0);
  }

  _newChallenge() {
    const ch = makeChallenge(this.pool, this.usedVerbs, { double: this.double });
    this.challenge = ch;
    this.plates.setOptions(ch.options, ch.slot);
  }

  _showBanner() {
    ui.showChallenge(chainHTML(this.challenge.verb, this.challenge.slot));
  }

  choose(i) {
    if (this.state !== 'closed' || this.cooldown > 0 || this.locked || !this.activated) return;
    const opt = this.challenge.options[i];
    if (!opt) return;
    if (opt.correct) this._solve();
    else this._wrong(i);
  }

  _wrong(i) {
    sfx.bzzt();
    this.plates.wobble(i);
    ui.toast(`Not quite! ${chainHTML(this.challenge.verb)}`, { dur: 3000, kind: 'bad' });
    this.firstTry = false;
    this.cooldown = 1.5;
    this._pendingNew = true;
  }

  _solve() {
    this.usedVerbs.add(this.challenge.verb.v);
    this.plates.shatter();
    ui.hideChallenge();
    sfx.sparkle();
    this.state = 'opening';
    this.openT = 0;
    if (this.kind === 'door') {
      sfx.rumble(1.3);
      fx.dustPuff(new THREE.Vector3(this.pos.x - 1.4, 0, this.pos.z), 6);
      fx.dustPuff(new THREE.Vector3(this.pos.x + 1.4, 0, this.pos.z), 6);
    } else {
      sfx.chestCreak();
    }
    this.onSolved(this, this.firstTry);
  }

  forceSolve() { if (this.state === 'closed') this._solve(); }

  unlock() {
    this.locked = false;
    fx.burst(new THREE.Vector3(this.pos.x, 2, this.pos.z), { color: 0x2ee6c0, n: 24, speed: 3 });
    sfx.sparkle();
  }

  update(dt, t, player) {
    this.plates.update(dt, t);

    if (this.rune && this.state === 'closed') {
      const k = 0.75 + 0.25 * Math.sin(t * 2.4);
      this.rune.material.opacity = this.locked ? 0.25 : k;
    }

    if (this.state === 'opening') {
      this.openT += dt;
      if (this.kind === 'door') {
        const k = Math.min(1, this.openT / 1.3);
        this.slab.position.y = -4.35 * k * k;
        this.slab.position.x = this.pos.x + Math.sin(this.openT * 40) * 0.02 * (1 - k); // rumble shiver
        if (k > 0.6) this.collider.off = true;
        if (k >= 1) { this.state = 'open'; this.slab.visible = false; }
      } else {
        const k = Math.min(1, this.openT / 0.9);
        this.lid.rotation.x = -1.95 * k * (2 - k);
        this.beam.material.opacity = 0.4 * k;
        this.rune.material.opacity = 1 - k;
        if (k >= 1) this.state = 'open';
      }
      return;
    }
    if (this.state !== 'closed') return;

    const d = Math.hypot(player.pos.x - this.pos.x, player.pos.z - this.pos.z);

    if (this.locked) {
      if (d < 5 && !this.hintShown) {
        this.hintShown = true;
        ui.toast('The door is held by spooky magic… 💀 Bonk all the skeletons!', { dur: 3200 });
      }
      return;
    }

    if (!this.activated && d < 6.2) {
      this.activated = true;
      this.plates.show();
      this._showBanner();
    } else if (this.activated && d > 7.5) {
      this.activated = false;
      this.plates.hide();
      ui.hideChallenge();
    }

    if (this.cooldown > 0) {
      this.cooldown -= dt;
      if (this.cooldown <= 0 && this._pendingNew) {
        this._pendingNew = false;
        this._newChallenge();
        if (this.activated) {
          this.plates.hide();
          this.plates.show();
          this._showBanner();
        }
      }
      return;
    }

    if (this.activated) {
      const i = this.plates.plateAt(player.pos);
      if (i >= 0) this.choose(i);
    }
  }
}

// Three rune doors, one correctly-formed chain — the wrong ones hide a brick wall.
export class RuneDoors {
  constructor(scene, level, { xs, z, usedVerbs, onSolved }) {
    this.scene = scene; this.level = level; this.onSolved = onSolved;
    this.z = z;
    this.challenge = makeRuneChallenge(usedVerbs);
    usedVerbs.add(this.challenge.verb.v);
    this.solved = false;
    this.doors = this.challenge.chains.map((chain, i) => {
      const x = xs[i];
      const m = level.mats;
      const slab = new THREE.Group();
      slab.position.set(x, 0, z + 0.5);
      const panel = new THREE.Mesh(new THREE.BoxGeometry(2.3, 4.1, 0.3), m.wood);
      panel.position.y = 2.05;
      slab.add(panel);
      for (const by of [0.8, 3.3]) {
        const band = new THREE.Mesh(new THREE.BoxGeometry(2.34, 0.16, 0.34), m.stoneDk);
        band.position.y = by;
        slab.add(band);
      }
      scene.add(slab);

      // chain plaque above the door
      const canvas = document.createElement('canvas');
      canvas.width = 1024; canvas.height = 192;
      const g = canvas.getContext('2d');
      g.fillStyle = '#1c2440';
      g.beginPath(); g.roundRect(4, 4, 1016, 184, 28); g.fill();
      g.strokeStyle = '#39456b'; g.lineWidth = 8; g.stroke();
      g.textBaseline = 'middle'; g.font = '64px "Fredoka One", sans-serif';
      const parts = [
        [this.challenge.verb.v.toUpperCase(), SLOT_COLOR.base],
        ['  →  ', '#9db4dd'],
        [chain.past.toUpperCase(), SLOT_COLOR.past],
        ['  →  ', '#9db4dd'],
        [chain.pp.toUpperCase(), SLOT_COLOR.pp],
      ];
      let total = 0;
      for (const [s] of parts) total += g.measureText(s).width;
      let px = 512 - total / 2;
      g.textAlign = 'left';
      for (const [s, color] of parts) {
        g.fillStyle = color;
        g.fillText(s, px, 100);
        px += g.measureText(s).width;
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      const plaque = new THREE.Mesh(
        new THREE.PlaneGeometry(2.9, 0.55),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
      plaque.position.set(x, 3.35, z - 0.05);
      plaque.rotation.y = Math.PI;
      scene.add(plaque);

      // brick plug behind the two wrong doors
      let plug = null;
      if (!chain.correct) {
        plug = new THREE.Mesh(new THREE.BoxGeometry(2.4, 4.4, 0.9), m.brick);
        plug.position.set(x, 2.2, z + 1.7);
        plug.visible = false;
        scene.add(plug);
        level.addCollider(x, z + 1.7, 2.4, 0.9, true);
      }
      return {
        x, chain, slab, plug, tried: false, opening: false, t: 0,
        collider: level.addCollider(x, z + 0.5, 2.3, 0.6, true),
      };
    });
  }

  update(dt, t, player) {
    for (const d of this.doors) {
      if (d.opening) {
        d.t += dt;
        const k = Math.min(1, d.t / 1.1);
        d.slab.position.y = -4.35 * k * k;
        if (k > 0.6) d.collider.off = true;
        if (k >= 1) { d.opening = false; d.slab.visible = d.slab.position.y > -4; }
        continue;
      }
      if (d.tried || this.solved) continue;
      const dist = Math.hypot(player.pos.x - d.x, player.pos.z - (this.z - 0.7));
      if (dist < 1.15 && player.pos.z < this.z) {
        d.tried = true;
        d.opening = true; d.t = 0;
        if (d.chain.correct) {
          this.solved = true;
          sfx.rumble(1.2);
          sfx.sparkle();
          fx.burst(new THREE.Vector3(d.x, 2.2, this.z), { color: 0x2ee6c0, n: 26, speed: 3 });
          this.onSolved(this);
        } else {
          d.plug.visible = true;
          sfx.rumble(0.8);
          sfx.trombone();
          const wrongForm = d.chain.past !== this.challenge.verb.past ? d.chain.past : d.chain.pp;
          ui.toast(`Bzzt! “${wrongForm.toUpperCase()}” is not the true chain… 🧱`, { dur: 3000, kind: 'bad' });
          fx.dustPuff(new THREE.Vector3(d.x, 0, this.z), 10);
        }
      }
    }
  }
}
