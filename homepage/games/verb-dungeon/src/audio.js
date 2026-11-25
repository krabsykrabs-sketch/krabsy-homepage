// All sound is synthesized — no audio files (PoC constraint).
const STORE_KEY = 'krabsy_vdungeon_sound';

class SFX {
  constructor() {
    this.ctx = null;
    this.muted = localStorage.getItem(STORE_KEY) === 'off';
  }

  // must be called from a user gesture (start button)
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; } // iOS starts it suspended
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    this.master.connect(this.ctx.destination);
    // 1s of white noise, reused by every noise-based effect
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this._startAmbience();
  }

  setMuted(m) {
    this.muted = m;
    localStorage.setItem(STORE_KEY, m ? 'off' : 'on');
    if (this.master) this.master.gain.linearRampToValueAtTime(m ? 0 : 0.9, this.ctx.currentTime + 0.15);
  }

  tone({ f = 440, f1, type = 'sine', t = 0, dur = 0.2, g = 0.18, a = 0.008, vib = 0, vibF = 6 } = {}) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + t;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t0);
    if (f1 !== undefined) o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t0 + dur);
    const gn = this.ctx.createGain();
    gn.gain.setValueAtTime(0.0001, t0);
    gn.gain.linearRampToValueAtTime(g, t0 + a);
    gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    if (vib > 0) {
      const lfo = this.ctx.createOscillator(), lg = this.ctx.createGain();
      lfo.frequency.value = vibF; lg.gain.value = vib;
      lfo.connect(lg); lg.connect(o.frequency);
      lfo.start(t0); lfo.stop(t0 + dur);
    }
    o.connect(gn); gn.connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  noise({ t = 0, dur = 0.25, g = 0.2, f = 800, f1, type = 'lowpass', q = 1 } = {}) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + t;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    const flt = this.ctx.createBiquadFilter();
    flt.type = type; flt.Q.value = q;
    flt.frequency.setValueAtTime(f, t0);
    if (f1 !== undefined) flt.frequency.exponentialRampToValueAtTime(Math.max(f1, 10), t0 + dur);
    const gn = this.ctx.createGain();
    gn.gain.setValueAtTime(0.0001, t0);
    gn.gain.linearRampToValueAtTime(g, t0 + 0.012);
    gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(flt); flt.connect(gn); gn.connect(this.master);
    src.start(t0); src.stop(t0 + dur + 0.05);
  }

  // quiet dungeon bed: low drone + random torch-crackle pops
  _startAmbience() {
    const t0 = this.ctx.currentTime;
    for (const [f, g] of [[55, 0.016], [55.6, 0.012], [110.3, 0.006]]) {
      const o = this.ctx.createOscillator(), gn = this.ctx.createGain();
      o.type = 'triangle'; o.frequency.value = f; gn.gain.value = g;
      o.connect(gn); gn.connect(this.master); o.start(t0);
    }
    this._crackle = setInterval(() => {
      if (document.hidden || !this.ctx) return;
      if (Math.random() < 0.55)
        this.noise({ dur: 0.03 + Math.random() * 0.05, g: 0.004 + Math.random() * 0.012,
          f: 500 + Math.random() * 2200, type: 'bandpass', q: 3 });
    }, 130);
  }

  // ---- game events ----
  uiClick() { this.tone({ f: 620, f1: 920, type: 'triangle', dur: 0.09, g: 0.12 }); }
  bonk() {
    this.tone({ f: 170, f1: 62, type: 'sine', dur: 0.13, g: 0.35 });
    this.noise({ dur: 0.06, g: 0.14, f: 2000, f1: 300 });
  }
  swing() { this.noise({ dur: 0.12, g: 0.06, f: 300, f1: 1600, type: 'bandpass', q: 2 }); }
  boneRattle() {
    // descending xylophone clatter — the "tidy pile of bones" sound
    const notes = [1318, 1175, 988, 880, 740, 659, 587];
    notes.forEach((f, i) => {
      this.tone({ f: f * (0.98 + Math.random() * 0.04), type: 'sine', t: i * 0.055, dur: 0.16, g: 0.16 });
      this.tone({ f: f * 3.1, type: 'sine', t: i * 0.055, dur: 0.05, g: 0.05 });
    });
  }
  reassemble() {
    const notes = [587, 659, 740, 880, 988];
    notes.forEach((f, i) => this.tone({ f, type: 'sine', t: i * 0.07, dur: 0.14, g: 0.12 }));
  }
  bzzt() {
    this.tone({ f: 130, f1: 80, type: 'square', dur: 0.22, g: 0.1 });
    this.tone({ f: 131, f1: 78, type: 'sawtooth', dur: 0.22, g: 0.06 });
  }
  sparkle() {
    [523, 659, 784, 1047, 1319].forEach((f, i) =>
      this.tone({ f, type: 'sine', t: i * 0.05, dur: 0.3, g: 0.13 }));
  }
  rumble(dur = 1.1) {
    this.noise({ dur, g: 0.3, f: 120, f1: 60, q: 0.7 });
    this.tone({ f: 48, f1: 38, type: 'sine', dur, g: 0.22 });
  }
  thud() {
    this.tone({ f: 80, f1: 34, type: 'sine', dur: 0.3, g: 0.5 });
    this.noise({ dur: 0.12, g: 0.22, f: 400, f1: 80 });
  }
  trombone() {
    // wah wah waaah
    const seq = [[294, 0.32], [277, 0.32], [262, 0.32], [233, 0.9]];
    let t = 0;
    seq.forEach(([f, d], i) => {
      this.tone({ f: f * 1.02, f1: f * 0.985, type: 'sawtooth', t, dur: d, g: 0.085,
        vib: i === 3 ? 9 : 0, vibF: 7 });
      this.tone({ f: f / 2, type: 'triangle', t, dur: d, g: 0.05 });
      t += d + 0.05;
    });
  }
  coin(i = 0) {
    this.tone({ f: 1319, type: 'square', t: i * 0.06, dur: 0.05, g: 0.045 });
    this.tone({ f: 1760, type: 'square', t: i * 0.06 + 0.05, dur: 0.14, g: 0.045 });
  }
  hurt() {
    this.tone({ f: 330, f1: 140, type: 'triangle', dur: 0.28, g: 0.2, vib: 14, vibF: 18 });
  }
  fall() { this.tone({ f: 950, f1: 220, type: 'sine', dur: 0.7, g: 0.16 }); }
  dizzy() {
    [880, 932, 880, 932, 880].forEach((f, i) => this.tone({ f, type: 'sine', t: i * 0.09, dur: 0.1, g: 0.07 }));
  }
  whoosh() { this.noise({ dur: 0.35, g: 0.12, f: 200, f1: 1400, type: 'bandpass', q: 1.6 }); }
  popIn() { this.tone({ f: 540, f1: 860, type: 'triangle', dur: 0.1, g: 0.09 }); }
  slam() {
    this.thud();
    this.noise({ dur: 0.4, g: 0.2, f: 250, f1: 60 });
  }
  rattle() { // an empty crate or barrel: a few dry wooden knocks
    [0, 0.07, 0.15].forEach((t, i) => {
      this.tone({ f: 260 - i * 40, f1: 140, type: 'triangle', t, dur: 0.07, g: 0.16 });
      this.noise({ t, dur: 0.05, g: 0.1, f: 1800, f1: 600, type: 'bandpass', q: 3 });
    });
  }
  crunch() { // a crate or barrel smashed: a sharp crack, splintering, wooden knocks
    this.noise({ dur: 0.09, g: 0.32, f: 3200, f1: 700, type: 'bandpass', q: 0.8 });
    this.tone({ f: 210, f1: 70, type: 'triangle', dur: 0.16, g: 0.3 });
    this.noise({ t: 0.03, dur: 0.32, g: 0.16, f: 1500, f1: 300, type: 'bandpass', q: 1.4 });
    [0.1, 0.19, 0.3, 0.38].forEach((t, i) => this.tone({ f: 300 - i * 35, f1: 160, type: 'triangle', t, dur: 0.06, g: 0.12 - i * 0.02 }));
  }
  clunk() { // a lock opens: a heavy click and a low thunk
    this.tone({ f: 1400, f1: 900, type: 'square', dur: 0.03, g: 0.08 });
    this.tone({ f: 120, f1: 60, type: 'sine', t: 0.05, dur: 0.22, g: 0.42 });
    this.noise({ t: 0.05, dur: 0.1, g: 0.18, f: 600, f1: 150 });
    this.tone({ f: 1800, type: 'square', t: 0.18, dur: 0.025, g: 0.05 });
  }
  bookOpen() { // pages flutter open
    for (let i = 0; i < 4; i++) this.noise({ t: i * 0.045, dur: 0.06, g: 0.07, f: 2600 + i * 300, type: 'bandpass', q: 2.5 });
    this.tone({ f: 523, f1: 784, type: 'sine', t: 0.12, dur: 0.25, g: 0.07 });
  }
  fizzle() { this.noise({ dur: 0.22, g: 0.1, f: 4000, f1: 1200, type: 'highpass', q: 1 }); }
  summon() { // the necromancer raises bones: a rising wobble
    this.tone({ f: 180, f1: 520, type: 'sawtooth', dur: 0.55, g: 0.05, vib: 18, vibF: 9 });
    this.tone({ f: 90, f1: 260, type: 'triangle', dur: 0.55, g: 0.08 });
  }
  orb() { this.tone({ f: 700, f1: 300, type: 'sine', dur: 0.3, g: 0.1, vib: 30, vibF: 14 }); }
  laugh() { // a goofy "nyeh heh heh"
    [0, 0.16, 0.3, 0.42].forEach((t, i) => this.tone({ f: 330 - i * 22, f1: 250 - i * 20, type: 'square', t, dur: 0.11, g: 0.05, vib: 12, vibF: 20 }));
  }
  cardOpen() { [660, 990].forEach((f, i) => this.tone({ f, type: 'triangle', t: i * 0.07, dur: 0.18, g: 0.1 })); }
  chestCreak() { this.tone({ f: 180, f1: 420, type: 'sawtooth', dur: 0.5, g: 0.035, vib: 10, vibF: 9 }); }
  fanfare() {
    const seq = [[523, 0], [659, 0.13], [784, 0.26], [1047, 0.42]];
    seq.forEach(([f, t]) => this.tone({ f, type: 'triangle', t, dur: 0.32, g: 0.15 }));
    [1047, 1319, 1568].forEach((f) => this.tone({ f, type: 'triangle', t: 0.65, dur: 0.9, g: 0.09 }));
    this.sparkle();
  }
  gift() { // a gift pops out of the boss chest: a bright rising arpeggio and a shimmer
    [784, 988, 1175, 1568, 1976].forEach((f, i) => this.tone({ f, type: 'triangle', t: i * 0.07, dur: 0.35, g: 0.11 }));
    [2349, 2637].forEach((f, i) => this.tone({ f, type: 'sine', t: 0.4 + i * 0.12, dur: 0.6, g: 0.06, vib: 12, vibF: 9 }));
  }
  sting() {
    // ambush! short spooky-goofy sting
    [[196, 0], [185, 0.16], [175, 0.32]].forEach(([f, t]) =>
      this.tone({ f, type: 'sawtooth', t, dur: 0.18, g: 0.07 }));
    this.tone({ f: 392, f1: 370, type: 'square', t: 0.5, dur: 0.4, g: 0.05, vib: 6 });
  }
}

export const sfx = new SFX();
