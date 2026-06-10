// Procedural WebAudio: all SFX and the background music are synthesized — no audio
// files. The context unlocks on the first user gesture (browser autoplay policy);
// every public method is safe to call before that (it just no-ops).

const Sound = {
  ctx: null,
  master: null,
  sfxGain: null,
  musicGain: null,
  muted: false,
  _lastPlay: {},          // per-sound rate limiting
  _musicTimer: null,
  _musicStep: 0,
  _nextNoteTime: 0,

  init() {
    try { this.muted = localStorage.getItem('td3d_muted') === '1'; } catch { /* ignore */ }
    const unlock = () => {
      this._unlock();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  },

  _unlock() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.9;
    this.sfxGain.connect(this.master);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.5;
    this.musicGain.connect(this.master);
    this._startMusic();
  },

  toggleMute() {
    this.muted = !this.muted;
    try { localStorage.setItem('td3d_muted', this.muted ? '1' : '0'); } catch { /* ignore */ }
    if (this.master) {
      this.master.gain.linearRampToValueAtTime(this.muted ? 0 : 1, this.ctx.currentTime + 0.05);
    }
    return this.muted;
  },

  // ── SFX ───────────────────────────────────────────────────────────────

  play(name) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    if (now - (this._lastPlay[name] || -1) < 0.03) return;
    this._lastPlay[name] = now;
    const fn = this._sfx[name];
    if (fn) fn.call(this, now);
  },

  // One tone with a simple attack/decay envelope. Returns the oscillator.
  _tone({ at, freq, freqEnd, type = 'sine', dur = 0.15, vol = 0.1, attack = 0.005 }) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, at);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), at + dur);
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(vol, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g).connect(this.sfxGain);
    o.start(at);
    o.stop(at + dur + 0.05);
    return o;
  },

  // White-noise burst through a lowpass filter (thuds, poofs, explosions).
  _noise({ at, dur = 0.2, vol = 0.2, filterFrom = 2000, filterTo = 300 }) {
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(filterFrom, at);
    f.frequency.exponentialRampToValueAtTime(Math.max(40, filterTo), at + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(f).connect(g).connect(this.sfxGain);
    src.start(at);
  },

  _sfx: {
    shoot(t) { this._tone({ at: t, freq: 620, freqEnd: 280, type: 'square', dur: 0.07, vol: 0.05 }); },
    burst(t) {
      this._tone({ at: t, freq: 880, freqEnd: 440, type: 'triangle', dur: 0.09, vol: 0.06 });
      this._noise({ at: t, dur: 0.06, vol: 0.04, filterFrom: 3000, filterTo: 800 });
    },
    cannonFire(t) {
      this._tone({ at: t, freq: 130, freqEnd: 55, type: 'sine', dur: 0.2, vol: 0.18 });
      this._noise({ at: t, dur: 0.12, vol: 0.1, filterFrom: 900, filterTo: 150 });
    },
    explosion(t) {
      this._noise({ at: t, dur: 0.4, vol: 0.22, filterFrom: 1400, filterTo: 100 });
      this._tone({ at: t, freq: 90, freqEnd: 40, type: 'sine', dur: 0.35, vol: 0.16 });
    },
    freeze(t) {
      [1500, 1180, 950].forEach((f, i) =>
        this._tone({ at: t + i * 0.07, freq: f, freqEnd: f * 0.92, type: 'sine', dur: 0.25, vol: 0.05 }));
    },
    enemyDie(t) {
      this._tone({ at: t, freq: 320, freqEnd: 70, type: 'square', dur: 0.12, vol: 0.06 });
      this._noise({ at: t, dur: 0.07, vol: 0.05, filterFrom: 2500, filterTo: 500 });
    },
    transform(t) { this._noise({ at: t, dur: 0.1, vol: 0.07, filterFrom: 1800, filterTo: 400 }); },
    coin(t) {
      this._tone({ at: t, freq: 988, type: 'square', dur: 0.06, vol: 0.045 });
      this._tone({ at: t + 0.06, freq: 1319, type: 'square', dur: 0.14, vol: 0.045 });
    },
    lifeLost(t) {
      this._tone({ at: t, freq: 330, freqEnd: 220, type: 'sawtooth', dur: 0.16, vol: 0.09 });
      this._tone({ at: t + 0.16, freq: 220, freqEnd: 147, type: 'sawtooth', dur: 0.24, vol: 0.09 });
    },
    waveStart(t) {
      this._tone({ at: t, freq: 196, freqEnd: 392, type: 'sawtooth', dur: 0.25, vol: 0.07 });
      this._tone({ at: t + 0.05, freq: 247, freqEnd: 494, type: 'sawtooth', dur: 0.22, vol: 0.05 });
    },
    waveComplete(t) {
      [523, 659, 784].forEach((f, i) =>
        this._tone({ at: t + i * 0.11, freq: f, type: 'triangle', dur: 0.22, vol: 0.08 }));
    },
    quizCorrect(t) {
      [523, 659, 784, 1047].forEach((f, i) =>
        this._tone({ at: t + i * 0.08, freq: f, type: 'triangle', dur: 0.2, vol: 0.08 }));
      this._tone({ at: t + 0.32, freq: 2093, type: 'sine', dur: 0.3, vol: 0.04 });
    },
    quizWrong(t) {
      this._tone({ at: t, freq: 180, freqEnd: 150, type: 'sawtooth', dur: 0.22, vol: 0.06 });
      this._tone({ at: t + 0.02, freq: 185, freqEnd: 152, type: 'sawtooth', dur: 0.22, vol: 0.05 });
    },
    click(t) { this._tone({ at: t, freq: 1100, freqEnd: 700, type: 'sine', dur: 0.035, vol: 0.05 }); },
    place(t) {
      this._noise({ at: t, dur: 0.08, vol: 0.1, filterFrom: 700, filterTo: 200 });
      this._tone({ at: t + 0.04, freq: 660, type: 'triangle', dur: 0.12, vol: 0.06 });
    },
    sell(t) {
      this._noise({ at: t, dur: 0.05, vol: 0.06, filterFrom: 3500, filterTo: 1500 });
      this._tone({ at: t + 0.03, freq: 1319, type: 'square', dur: 0.07, vol: 0.04 });
      this._tone({ at: t + 0.1, freq: 988, type: 'square', dur: 0.1, vol: 0.04 });
    },
    upgrade(t) { this._tone({ at: t, freq: 330, freqEnd: 990, type: 'triangle', dur: 0.28, vol: 0.09 }); },
    victory(t) {
      [523, 659, 784, 1047, 784, 1047].forEach((f, i) =>
        this._tone({ at: t + i * 0.13, freq: f, type: 'triangle', dur: 0.26, vol: 0.09 }));
    },
    gameOver(t) {
      [392, 330, 262, 196].forEach((f, i) =>
        this._tone({ at: t + i * 0.22, freq: f, type: 'triangle', dur: 0.34, vol: 0.09 }));
    },
  },

  // ── Music ─────────────────────────────────────────────────────────────
  // Gentle 4-bar loop (C – G – Am – F) scheduled in eighth notes with a lookahead
  // timer. Soft sine bass, sparse triangle arpeggio, occasional pentatonic sparkle.

  _midi(n) { return 440 * Math.pow(2, (n - 69) / 12); },

  _startMusic() {
    if (this._musicTimer) return;
    this._musicStep = 0;
    this._nextNoteTime = this.ctx.currentTime + 0.2;
    this._musicTimer = setInterval(() => {
      const ahead = 0.18;
      while (this._nextNoteTime < this.ctx.currentTime + ahead) {
        this._scheduleStep(this._musicStep, this._nextNoteTime);
        this._musicStep = (this._musicStep + 1) % 32;
        this._nextNoteTime += (60 / 92) / 2; // eighth notes at 92 bpm
      }
    }, 40);
  },

  _scheduleStep(step, t) {
    // Chord roots (midi): C3 G2 A2 F2 — one chord per bar (8 eighth-steps).
    const CHORDS = [
      { root: 48, third: 52, fifth: 55 },  // C
      { root: 43, third: 47, fifth: 50 },  // G
      { root: 45, third: 48, fifth: 52 },  // Am
      { root: 41, third: 45, fifth: 48 },  // F
    ];
    const SPARKLE = [72, 76, 79, 81, 84];  // C-major pentatonic, 5th octave
    const chord = CHORDS[Math.floor(step / 8)];
    const sub = step % 8;

    if (sub === 0 || sub === 4) {
      this._musicNote({ at: t, freq: this._midi(chord.root - 12), type: 'sine', dur: 0.5, vol: 0.1 });
    }
    if (sub % 2 === 1) {
      const tones = [chord.root, chord.third, chord.fifth, chord.third];
      const n = tones[Math.floor(sub / 2)] + 12;
      this._musicNote({ at: t, freq: this._midi(n), type: 'triangle', dur: 0.16, vol: 0.035 });
    }
    if (sub === 2 || (sub === 6 && step % 16 === 14)) {
      const n = SPARKLE[(step * 7 + 3) % SPARKLE.length];
      this._musicNote({ at: t, freq: this._midi(n), type: 'sine', dur: 0.3, vol: 0.025 });
    }
  },

  _musicNote({ at, freq, type, dur, vol }) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(vol, at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g).connect(this.musicGain);
    o.start(at);
    o.stop(at + dur + 0.05);
  },
};
