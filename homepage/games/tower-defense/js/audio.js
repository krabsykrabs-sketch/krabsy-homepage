// Procedural WebAudio: all sound effects and the music are synthesized — no audio
// files, 0 bytes of download. The context unlocks on the first user gesture (browser
// autoplay policy); every public method is safe to call before that (it no-ops).
//
// Classroom rules (owner decisions 2026-11-22):
//   - quiet by default, music clearly under the effects;
//   - the speaker button cycles  all → effects only → off  (stored in localStorage);
//   - ?sound=off silences everything, ?music=off keeps only effects (teacher links);
//   - audio pauses while the tab or iframe is hidden.
//
// Music: "soft medieval" — plucked lute arpeggios, a soft bass and a breathy flute in
// D dorian. Moods: 'menu' / 'build' (calm), 'battle' (frame drum and a walking bass
// join), 'end' (music stops, a jingle plays). setDanger(true) adds a heartbeat.

const MODES = ['all', 'sfx', 'off'];

// Minimum seconds between two plays of the same sound, so many towers firing at ×2
// speed do not become a wall of noise.
const MIN_GAP = { shoot: 0.12, enemyDie: 0.08, explosion: 0.1, cannonFire: 0.1, coin: 0.05, castleHit: 0.12 };

export const Sound = {
  ctx: null,
  master: null,
  sfxGain: null,
  musicGain: null,
  mode: 'all',
  _lastPlay: {},
  _musicTimer: null,
  _step: 0,
  _nextNoteTime: 0,
  _mood: 'menu',
  _danger: false,
  _noiseBuf: null,

  init() {
    try {
      const saved = localStorage.getItem('td3d_sound');
      if (MODES.includes(saved)) this.mode = saved;
      else if (localStorage.getItem('td3d_muted') === '1') this.mode = 'off'; // old setting
    } catch { /* storage blocked */ }
    try {
      const q = new URLSearchParams(window.location.search);
      if (q.get('sound') === 'off') this.mode = 'off';
      else if (q.get('music') === 'off' && this.mode === 'all') this.mode = 'sfx';
    } catch { /* no URL */ }

    const unlock = () => {
      this._unlock();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend();
      else this.ctx.resume();
    });
  },

  // Kept for the old button code: true when nothing plays.
  get muted() { return this.mode === 'off'; },

  _unlock() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.connect(this.master);
    this.musicGain = this.ctx.createGain();
    this.musicGain.connect(this.master);
    this._applyMode(true);
    // One shared second of white noise for drums, dust and thuds.
    const len = this.ctx.sampleRate;
    this._noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this._noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this._startMusic();
  },

  // Speaker button: all → effects only → off → all.
  cycleMode() {
    this.mode = MODES[(MODES.indexOf(this.mode) + 1) % MODES.length];
    try { localStorage.setItem('td3d_sound', this.mode); } catch { /* ignore */ }
    this._applyMode(false);
    return this.mode;
  },
  toggleMute() { return this.cycleMode() === 'off'; },

  _applyMode(instant) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const sfx = this.mode === 'off' ? 0 : 0.9;
    const music = this.mode === 'all' ? 0.32 : 0;
    for (const [g, v] of [[this.sfxGain, sfx], [this.musicGain, music]]) {
      g.gain.cancelScheduledValues(t);
      if (instant) g.gain.setValueAtTime(v, t);
      else { g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(v, t + 0.15); }
    }
  },

  // ── Effects ───────────────────────────────────────────────────────────

  play(name, arg) {
    if (!this.ctx || this.mode === 'off') return;
    const now = this.ctx.currentTime;
    const gap = MIN_GAP[name] || 0.03;
    if (now - (this._lastPlay[name] ?? -1) < gap) return;
    this._lastPlay[name] = now;
    const fn = this._sfx[name];
    if (fn) fn.call(this, now, arg);
  },

  _tone({ at, freq, freqEnd, type = 'sine', dur = 0.15, vol = 0.1, attack = 0.005, out }) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, at);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), at + dur);
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(vol, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g).connect(out || this.sfxGain);
    o.start(at);
    o.stop(at + dur + 0.05);
    return o;
  },

  // Filtered noise burst (thuds, dust, drums).
  _noise({ at, dur = 0.2, vol = 0.2, filterFrom = 2000, filterTo = 300, type = 'lowpass', out }) {
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(filterFrom, at);
    f.frequency.exponentialRampToValueAtTime(Math.max(40, filterTo), at + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(f).connect(g).connect(out || this.sfxGain);
    src.start(at, Math.random() * 0.5);
    src.stop(at + dur + 0.05);
  },

  _sfx: {
    shoot(t) { this._tone({ at: t, freq: 620, freqEnd: 280, type: 'triangle', dur: 0.07, vol: 0.05 }); },
    cannonFire(t) {
      this._tone({ at: t, freq: 130, freqEnd: 55, type: 'sine', dur: 0.2, vol: 0.18 });
      this._noise({ at: t, dur: 0.12, vol: 0.1, filterFrom: 900, filterTo: 150 });
    },
    explosion(t) {
      this._noise({ at: t, dur: 0.4, vol: 0.2, filterFrom: 1400, filterTo: 100 });
      this._tone({ at: t, freq: 90, freqEnd: 40, type: 'sine', dur: 0.35, vol: 0.15 });
    },
    freeze(t) {
      [1500, 1180, 950].forEach((f, i) =>
        this._tone({ at: t + i * 0.07, freq: f, freqEnd: f * 0.92, type: 'sine', dur: 0.25, vol: 0.05 }));
    },
    enemyDie(t) {
      this._tone({ at: t, freq: 320, freqEnd: 70, type: 'triangle', dur: 0.12, vol: 0.06 });
      this._noise({ at: t, dur: 0.07, vol: 0.05, filterFrom: 2500, filterTo: 500 });
    },
    transform(t) { this._noise({ at: t, dur: 0.1, vol: 0.07, filterFrom: 1800, filterTo: 400 }); },
    coin(t) {
      this._tone({ at: t, freq: 988, type: 'triangle', dur: 0.06, vol: 0.05 });
      this._tone({ at: t + 0.06, freq: 1319, type: 'triangle', dur: 0.14, vol: 0.05 });
    },
    // An enemy hits the castle gate: a heavy wooden thud and crumbling stone.
    castleHit(t) {
      this._tone({ at: t, freq: 110, freqEnd: 45, type: 'sine', dur: 0.35, vol: 0.28 });
      this._noise({ at: t, dur: 0.18, vol: 0.22, filterFrom: 900, filterTo: 120 });
      this._noise({ at: t + 0.08, dur: 0.35, vol: 0.08, filterFrom: 3500, filterTo: 900, type: 'bandpass' });
    },
    lifeLost(t) { this._sfx.castleHit.call(this, t); },
    // Wave start: a two-note horn.
    waveStart(t) {
      for (const [f, d, at] of [[220, 0.32, 0], [330, 0.5, 0.3]]) {
        this._tone({ at: t + at, freq: f, type: 'sawtooth', dur: d, vol: 0.05, attack: 0.06 });
        this._tone({ at: t + at, freq: f * 1.005, type: 'triangle', dur: d, vol: 0.06, attack: 0.06 });
      }
    },
    waveComplete(t) {
      [587, 740, 880].forEach((f, i) =>
        this._tone({ at: t + i * 0.11, freq: f, type: 'triangle', dur: 0.22, vol: 0.08 }));
    },
    quizCorrect(t) {
      [587, 740, 880, 1175].forEach((f, i) =>
        this._tone({ at: t + i * 0.08, freq: f, type: 'triangle', dur: 0.2, vol: 0.08 }));
      this._tone({ at: t + 0.32, freq: 2349, type: 'sine', dur: 0.3, vol: 0.035 });
    },
    // Softer than a buzzer: two low, falling notes.
    quizWrong(t) {
      this._tone({ at: t, freq: 330, freqEnd: 300, type: 'triangle', dur: 0.18, vol: 0.08 });
      this._tone({ at: t + 0.17, freq: 247, freqEnd: 220, type: 'triangle', dur: 0.28, vol: 0.08 });
    },
    click(t) { this._tone({ at: t, freq: 1100, freqEnd: 700, type: 'sine', dur: 0.035, vol: 0.05 }); },
    // Not enough coins: a dull wooden tock.
    nope(t) {
      this._tone({ at: t, freq: 180, freqEnd: 120, type: 'sine', dur: 0.12, vol: 0.14 });
      this._noise({ at: t, dur: 0.05, vol: 0.06, filterFrom: 1200, filterTo: 400 });
    },
    place(t) {
      this._noise({ at: t, dur: 0.14, vol: 0.14, filterFrom: 700, filterTo: 150 });
      this._tone({ at: t + 0.05, freq: 587, type: 'triangle', dur: 0.12, vol: 0.06 });
    },
    sell(t) {
      this._noise({ at: t, dur: 0.05, vol: 0.06, filterFrom: 3500, filterTo: 1500 });
      this._tone({ at: t + 0.03, freq: 1319, type: 'triangle', dur: 0.07, vol: 0.05 });
      this._tone({ at: t + 0.1, freq: 988, type: 'triangle', dur: 0.1, vol: 0.05 });
    },
    upgrade(t) {
      this._tone({ at: t, freq: 330, freqEnd: 660, type: 'triangle', dur: 0.16, vol: 0.09 });
      this._tone({ at: t + 0.14, freq: 660, freqEnd: 1320, type: 'triangle', dur: 0.26, vol: 0.09 });
    },
    // One star slamming onto the victory panel; arg = 0, 1, 2 rises in pitch.
    star(t, i = 0) {
      const f = [784, 988, 1175][i] || 1175;
      this._noise({ at: t, dur: 0.08, vol: 0.1, filterFrom: 2500, filterTo: 600 });
      this._tone({ at: t, freq: f, type: 'triangle', dur: 0.35, vol: 0.1 });
      this._tone({ at: t, freq: f * 2, type: 'sine', dur: 0.25, vol: 0.03 });
    },
    victory(t) {
      [587, 740, 880, 1175, 880, 1175].forEach((f, i) =>
        this._tone({ at: t + i * 0.13, freq: f, type: 'triangle', dur: 0.26, vol: 0.09 }));
    },
    // Defeat: the castle collapses, then a slow falling tune.
    gameOver(t) {
      this._noise({ at: t, dur: 1.2, vol: 0.25, filterFrom: 1200, filterTo: 60 });
      this._tone({ at: t, freq: 70, freqEnd: 30, type: 'sine', dur: 1.0, vol: 0.25 });
      [587, 523, 440, 349, 294].forEach((f, i) =>
        this._tone({ at: t + 0.9 + i * 0.28, freq: f, type: 'triangle', dur: 0.5, vol: 0.08, attack: 0.03 }));
    },
  },

  // ── Music ─────────────────────────────────────────────────────────────

  setMood(mood) {
    if (mood === this._mood) return;
    this._mood = mood;
  },

  setDanger(on) { this._danger = !!on; },

  _midi(n) { return 440 * Math.pow(2, (n - 69) / 12); },

  _startMusic() {
    if (this._musicTimer) return;
    this._step = 0;
    this._nextNoteTime = this.ctx.currentTime + 0.2;
    this._musicTimer = setInterval(() => {
      if (this.ctx.state !== 'running') return;
      const ahead = 0.2;
      while (this._nextNoteTime < this.ctx.currentTime + ahead) {
        this._scheduleStep(this._step, this._nextNoteTime);
        this._step = (this._step + 1) % 64;
        this._nextNoteTime += 60 / 100 / 2; // eighth notes at 100 bpm
      }
    }, 40);
  },

  // Four chords of two bars each in D dorian: Dm – C – Bb – C (a folk-like loop).
  // 8 bars × 8 eighths = 64 steps.
  _scheduleStep(step, t) {
    if (this._mood === 'end') return;
    const CHORDS = [
      [50, 53, 57],   // Dm
      [48, 52, 55],   // C
      [46, 50, 53],   // Bb
      [48, 52, 55],   // C
    ];
    const bar = Math.floor(step / 8), sub = step % 8;
    const chord = CHORDS[Math.floor(bar / 2) % 4];
    const battle = this._mood === 'battle';
    const out = this.musicGain;

    // Soft bass: on the bar in calm moods, walking quarter notes in battle.
    if (sub === 0 || (battle && sub % 2 === 0)) {
      const walk = [0, 0, 7, 5][sub / 2] ?? 0;
      this._pluck(t, this._midi(chord[0] - 12 + (battle ? walk : 0)), 0.5, battle ? 0.12 : 0.1, out, 'sine');
    }
    // Lute: a plucked arpeggio up and down the chord.
    const ARP = [0, 1, 2, 1, 0, 1, 2, 1];
    if (battle || sub % 2 === 0) {
      const n = chord[ARP[sub]] + 12;
      this._pluck(t, this._midi(n), 0.35, battle ? 0.045 : 0.05, out, 'triangle');
    }
    // Flute: a short phrase every second bar, from the D minor pentatonic.
    if (bar % 2 === 1 && (sub === 0 || sub === 3 || sub === 4)) {
      const PENTA = [74, 77, 79, 81, 84];
      const n = PENTA[(step * 3 + bar) % PENTA.length];
      this._flute(t, this._midi(n), sub === 4 ? 0.9 : 0.35, 0.03, out);
    }
    // Battle: a frame drum on the beats, a light tap in between.
    if (battle) {
      if (sub === 0 || sub === 4) this._noise({ at: t, dur: 0.18, vol: 0.12, filterFrom: 300, filterTo: 70, out });
      else if (sub === 2 || sub === 6) this._noise({ at: t, dur: 0.06, vol: 0.04, filterFrom: 2500, filterTo: 1200, type: 'bandpass', out });
    }
    // Low lives: a heartbeat (two soft thumps per bar), even in calm moods.
    if (this._danger && (sub === 0 || sub === 1)) {
      this._tone({ at: t, freq: 70, freqEnd: 45, type: 'sine', dur: 0.18, vol: sub === 0 ? 0.3 : 0.2, out });
    }
  },

  // Plucked string: fast attack, quick decay.
  _pluck(at, freq, dur, vol, out, type) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(vol, at + 0.004);
    g.gain.exponentialRampToValueAtTime(vol * 0.25, at + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g).connect(out);
    o.start(at);
    o.stop(at + dur + 0.05);
  },

  // Breathy flute: soft attack, gentle vibrato.
  _flute(at, freq, dur, vol, out) {
    const o = this.ctx.createOscillator();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    lfo.frequency.value = 5;
    lfoGain.gain.value = freq * 0.006;
    lfo.connect(lfoGain).connect(o.frequency);
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(vol, at + 0.08);
    g.gain.setValueAtTime(vol, at + dur * 0.7);
    g.gain.linearRampToValueAtTime(0.0001, at + dur);
    o.connect(g).connect(out);
    o.start(at); lfo.start(at);
    o.stop(at + dur + 0.05); lfo.stop(at + dur + 0.05);
  },
};
