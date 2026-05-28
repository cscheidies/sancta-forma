// sfx.js — Sound effects. All synthesis via Web Audio API (no files needed).

let _ctx = null;

function ctx() {
  if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (_ctx.state === 'suspended') _ctx.resume();
  return _ctx;
}

function rand(a, b) { return a + Math.random() * (b - a); }

// Element-specific character
const ELEM = {
  square:   { freq: 160, wave: 'square',   color: 'low, boxy'   },
  circle:   { freq: 280, wave: 'sine',     color: 'round, warm' },
  triangle: { freq: 480, wave: 'triangle', color: 'bright, sharp'},
};

// ── Nemesis absorption ─────────────────────────────────────────────────────
// The hunter shape is absorbing YOUR pure form — extreme, wrongness sound
export function absorbNemesis(nemesisType) {
  const c = ctx();
  const now = c.currentTime;

  // Discordant screech — two out-of-phase sawtooth waves detuned badly
  [[0.94, 0.14], [1.00, 0.12], [1.07, 0.10]].forEach(([mult, gain], i) => {
    const baseFreq = { moon: 340, hexagon: 220, star: 580 }[nemesisType] || 300;
    const osc = c.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = baseFreq * mult;
    const ws = c.createWaveShaper();
    const curve = new Float32Array(256);
    for (let j=0; j<256; j++) {
      const x = j*2/256-1;
      curve[j] = (Math.PI+120)*x/(Math.PI+120*Math.abs(x));
    }
    ws.curve = curve;
    const g = c.createGain();
    g.gain.setValueAtTime(gain, now + i*0.01);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc.connect(ws); ws.connect(g); g.connect(c.destination);
    osc.start(now+i*0.01); osc.stop(now+0.40);
  });

  // Deep subharmonic warning pulse (the universe recoiling)
  const sub = c.createOscillator();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(55, now);
  sub.frequency.exponentialRampToValueAtTime(28, now+0.4);
  const subG = c.createGain();
  subG.gain.setValueAtTime(0.35, now);
  subG.gain.exponentialRampToValueAtTime(0.001, now+0.45);
  sub.connect(subG); subG.connect(c.destination);
  sub.start(now); sub.stop(now+0.5);

  // Noise burst — corruption crackle, loud
  noise(0.28, 3000, 0.20, now);
  noise(0.14, 800,  0.35, now+0.05);
}

// ── Shared helpers ─────────────────────────────────────────────────────────

function tone(freq, type, gainVal, attack, decay, when) {
  const c = ctx();
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const g = c.createGain();
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(gainVal, when + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, when + attack + decay);
  osc.connect(g); g.connect(c.destination);
  osc.start(when); osc.stop(when + attack + decay + 0.05);
  return osc;
}

function noise(gainVal, lpFreq, duration, when) {
  const c = ctx();
  const len = Math.ceil(c.sampleRate * duration);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const filt = c.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.value = lpFreq;
  const g = c.createGain();
  g.gain.setValueAtTime(gainVal, when);
  g.gain.exponentialRampToValueAtTime(0.0001, when + duration);
  src.connect(filt); filt.connect(g); g.connect(c.destination);
  src.start(when); src.stop(when + duration + 0.05);
}

// ── Absorption: same element ───────────────────────────────────────────────
// Clean, satisfying harmonic bloom
export function absorbSame(element) {
  const c = ctx();
  const now = c.currentTime;
  const { freq, wave } = ELEM[element];

  // Root + 5th + octave, staggered slightly
  [[1, 0.16, 0], [1.5, 0.10, 0.02], [2, 0.07, 0.04]].forEach(([mult, gain, delay]) => {
    tone(freq * mult, wave, gain, 0.015, 0.30 - delay, now + delay);
  });

  // Soft click transient
  noise(0.04, 2200, 0.04, now);
}

// ── Absorption: cross element (corrupting) ─────────────────────────────────
// Discordant — two slightly detuned sawtooth + noise burst
export function absorbCross(absorbedElement) {
  const c = ctx();
  const now = c.currentTime;
  const { freq } = ELEM[absorbedElement];

  // Detuned dissonant pair (tritone relationship)
  tone(freq * 0.97, 'sawtooth', 0.10, 0.01, 0.22, now);
  tone(freq * 1.41, 'sawtooth', 0.07, 0.01, 0.18, now + 0.01);

  // Filtered noise burst (corruption crackle)
  const bufLen = Math.ceil(c.sampleRate * 0.18);
  const buf = c.createBuffer(1, bufLen, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const bpf = c.createBiquadFilter();
  bpf.type = 'bandpass';
  bpf.frequency.value = 1200;
  bpf.Q.value = 1.5;
  const g = c.createGain();
  g.gain.setValueAtTime(0.08, now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
  src.connect(bpf); bpf.connect(g); g.connect(c.destination);
  src.start(now);
}

// ── Transform (transit absorption — element shift) ─────────────────────────
// A shimmering pitch-shift shimmer: you are becoming something else
export function transform(newElement) {
  const c = ctx();
  const now = c.currentTime;
  const freqs = { square: 200, circle: 350, triangle: 520 };
  const base = freqs[newElement] || 280;

  // Rising shimmer — two detuned sine sweeps
  [0, 7].forEach(detuneCents => {
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(base * 0.75, now);
    osc.frequency.exponentialRampToValueAtTime(base * 1.5, now + 0.25);
    osc.detune.value = detuneCents;
    const g = c.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.08, now + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.30);
    osc.connect(g); g.connect(c.destination);
    osc.start(now); osc.stop(now + 0.35);
  });
  noise(0.03, 3000, 0.12, now);
}

// ── Hexagon costume ────────────────────────────────────────────────────────
// Dissonant grinding thud — alien geometry forcing its shape
export function costume() {
  const c = ctx();
  const now = c.currentTime;
  // Low grinding tone
  [70, 74.5, 105].forEach(freq => {
    const osc = c.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.linearRampToValueAtTime(freq * 0.85, now + 0.3);
    const g = c.createGain();
    g.gain.setValueAtTime(0.06, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc.connect(g); g.connect(c.destination);
    osc.start(now); osc.stop(now + 0.4);
  });
  noise(0.04, 400, 0.2, now);
}

// ── Costume cleanse ────────────────────────────────────────────────────────
// Clean ascending tone — form restored
export function cleanse() {
  const c = ctx();
  const now = c.currentTime;
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(260, now);
  osc.frequency.exponentialRampToValueAtTime(520, now + 0.18);
  const g = c.createGain();
  g.gain.setValueAtTime(0.10, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
  osc.connect(g); g.connect(c.destination);
  osc.start(now); osc.stop(now + 0.3);
}

// ── Safe transit ───────────────────────────────────────────────────────────
// Soft whoosh — lowpass-filtered noise sweep
export function absorbSafe() {
  const c = ctx();
  const now = c.currentTime;

  const bufLen = Math.ceil(c.sampleRate * 0.22);
  const buf = c.createBuffer(1, bufLen, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;

  const filt = c.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.setValueAtTime(180, now);
  filt.frequency.linearRampToValueAtTime(900, now + 0.09);
  filt.frequency.exponentialRampToValueAtTime(220, now + 0.22);

  const g = c.createGain();
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(0.07, now + 0.04);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

  src.connect(filt); filt.connect(g); g.connect(c.destination);
  src.start(now);
}

// ── Win ────────────────────────────────────────────────────────────────────
// Ascending arpeggio: Cmaj7 → ring out
export function win() {
  const c = ctx();
  const now = c.currentTime;

  // C4 E4 G4 B4 C5 — ascending
  [261.6, 329.6, 392.0, 493.9, 523.3].forEach((f, i) => {
    tone(f, 'sine', 0.18, 0.02, 1.2, now + i * 0.11);
    // Octave shimmer
    if (i < 3) tone(f * 2, 'sine', 0.05, 0.02, 0.8, now + i * 0.11 + 0.04);
  });

  // Cymbal sizzle
  noise(0.06, 8000, 0.5, now + 0.1);
}

// ── Death ──────────────────────────────────────────────────────────────────
// Plays the sampled death hit (sfx_death.ogg).
let _deathBuf = null;
let _deathBufLoading = false;
function loadDeathBuf() {
  if (_deathBuf || _deathBufLoading) return;
  _deathBufLoading = true;
  fetch('./sfx_death.ogg')
    .then(r => r.arrayBuffer())
    .then(ab => ctx().decodeAudioData(ab))
    .then(buf => { _deathBuf = buf; })
    .catch(() => { _deathBufLoading = false; });
}
loadDeathBuf(); // preload on module init

export function death() {
  if (_deathBuf) {
    const c = ctx();
    const src = c.createBufferSource();
    src.buffer = _deathBuf;
    const gain = c.createGain();
    gain.gain.value = 0.9;
    src.connect(gain);
    gain.connect(c.destination);
    src.start();
    return;
  }
  // Fallback: synthesised sting if file not yet loaded
  const c = ctx();
  const now = c.currentTime;

  // ── Master reverb (simple comb-filter simulation) ─────────────────────
  // Two slightly-delayed copies of everything for spatial width
  function reverbSend(node, delayTime, gainVal) {
    const d = c.createDelay(0.5);
    d.delayTime.value = delayTime;
    const g = c.createGain();
    g.gain.value = gainVal;
    node.connect(g); g.connect(d); d.connect(c.destination);
  }

  // ── String voices: 5-voice cluster, E4–Bb5 tritone ───────────────────
  // Violins + violas in upper register: sharp, dissonant, held fortissimo
  const stringVoices = [
    { freq: 329.6, gain: 0.22, detune:  0  }, // E4 — low strings entry
    { freq: 493.9, gain: 0.20, detune:  4  }, // B4
    { freq: 659.3, gain: 0.18, detune: -3  }, // E5
    { freq: 698.5, gain: 0.15, detune:  8  }, // F5 — minor 2nd from E5 (dissonance)
    { freq: 932.3, gain: 0.13, detune: -5  }, // Bb5 — tritone (maximum tension)
  ];

  stringVoices.forEach((v, i) => {
    const osc = c.createOscillator();
    osc.type = 'sawtooth'; // bowed strings = sawtooth-rich harmonics
    osc.frequency.value = v.freq;
    osc.detune.value = v.detune;

    // Warm LP filter (strings don't have raw sawtooth harshness)
    const lpf = c.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.setValueAtTime(2400, now);
    lpf.frequency.exponentialRampToValueAtTime(1400, now + 0.4); // tone darkens over time

    // Tremolo: fast bowing motion at ~10-12 Hz
    const lfo = c.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 10.2 + i * 0.55; // each voice trembles at slightly different rate
    const lfoAmt = c.createGain();
    lfoAmt.gain.value = v.gain * 0.15; // tremolo depth ±15%

    // Amplitude envelope: snap attack, hold, long decay
    const env = c.createGain();
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(v.gain, now + 0.012 + i * 0.006); // staggered arrival
    env.gain.setValueAtTime(v.gain, now + 0.3);
    env.gain.exponentialRampToValueAtTime(v.gain * 0.5, now + 1.0);
    env.gain.exponentialRampToValueAtTime(0.001, now + 2.8);

    lfo.connect(lfoAmt);
    lfoAmt.connect(env.gain); // LFO modulates envelope gain → tremolo

    osc.connect(lpf); lpf.connect(env); env.connect(c.destination);
    reverbSend(env, 0.06 + i * 0.015, 0.10);

    osc.start(now); osc.stop(now + 3.0);
    lfo.start(now); lfo.stop(now + 3.0);
  });

  // ── Cello section: powerful E3 → downward slide ──────────────────────
  const cello = c.createOscillator();
  cello.type = 'sawtooth';
  cello.frequency.setValueAtTime(164.8, now);       // E3
  cello.frequency.exponentialRampToValueAtTime(110, now + 1.2); // slide down to A2
  const celloLpf = c.createBiquadFilter();
  celloLpf.type = 'lowpass';
  celloLpf.frequency.value = 900;
  const celloEnv = c.createGain();
  celloEnv.gain.setValueAtTime(0.32, now);
  celloEnv.gain.exponentialRampToValueAtTime(0.001, now + 2.0);
  cello.connect(celloLpf); celloLpf.connect(celloEnv); celloEnv.connect(c.destination);
  reverbSend(celloEnv, 0.08, 0.12);
  cello.start(now); cello.stop(now + 2.1);

  // ── Double-bass sub impact ────────────────────────────────────────────
  const bass = c.createOscillator();
  bass.type = 'sine';
  bass.frequency.setValueAtTime(82.4, now);  // E2
  bass.frequency.exponentialRampToValueAtTime(41.2, now + 0.6);
  const bassEnv = c.createGain();
  bassEnv.gain.setValueAtTime(0.55, now);
  bassEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
  bass.connect(bassEnv); bassEnv.connect(c.destination);
  bass.start(now); bass.stop(now + 0.75);

  // ── Bow-strike transient (the initial attack crack) ───────────────────
  noise(0.20, 5000, 0.04, now);           // bright initial crack
  noise(0.08, 1000, 0.25, now + 0.02);   // body resonance tail
}

// ── Stuck (no valid moves) ─────────────────────────────────────────────────
// Dull double-thud
export function stuck() {
  const c = ctx();
  const now = c.currentTime;
  tone(140, 'triangle', 0.14, 0.01, 0.18, now);
  tone(120, 'triangle', 0.11, 0.01, 0.18, now + 0.16);
  noise(0.05, 350, 0.12, now);
}

// ── Near-death warning ─────────────────────────────────────────────────────
// Ominous heartbeat — two thumps + high warning whine
export function blocked() {
  const c = ctx();
  const now = c.currentTime;
  const osc = c.createOscillator();
  const g   = c.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(90, now);
  osc.frequency.linearRampToValueAtTime(60, now + 0.07);
  g.gain.setValueAtTime(0.04, now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.10);
  osc.connect(g); g.connect(c.destination);
  osc.start(now); osc.stop(now + 0.10);
}

// ── Rite card select — unique per rite position (0–5) × element ────────────
// Minimal, eerie, organic, short, otherworldly.
export function riteSelect(riteIndex, element) {
  const c = ctx();
  const now = c.currentTime;

  // Base frequency varies per element
  const elemBase = { square: 0.9, circle: 1.0, triangle: 1.18 }[element] || 1.0;

  // Each of the 6 rites has a distinct timbral character
  const rites = [
    // Rite I — low cave breath: filtered noise + slow sine swell
    () => {
      noise(0.06, 280, 0.35, now);
      const o = c.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(68 * elemBase, now);
      o.frequency.linearRampToValueAtTime(82 * elemBase, now + 0.22);
      const g = c.createGain();
      g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.09, now + 0.08);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.40);
      o.connect(g); g.connect(c.destination); o.start(now); o.stop(now + 0.45);
    },
    // Rite II — glass tap: sharp sine ping with long tail
    () => {
      const f = 520 * elemBase;
      tone(f, 'sine', 0.12, 0.004, 0.55, now);
      tone(f * 1.5, 'sine', 0.05, 0.004, 0.40, now + 0.008);
    },
    // Rite III — hollow bone: triangle + resonant bandpass noise
    () => {
      const f = 180 * elemBase;
      tone(f, 'triangle', 0.13, 0.01, 0.30, now);
      const len = Math.ceil(c.sampleRate * 0.20);
      const buf = c.createBuffer(1, len, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = c.createBufferSource(); src.buffer = buf;
      const bpf = c.createBiquadFilter(); bpf.type = 'bandpass';
      bpf.frequency.value = f * 2.8; bpf.Q.value = 12;
      const g = c.createGain();
      g.gain.setValueAtTime(0.09, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      src.connect(bpf); bpf.connect(g); g.connect(c.destination); src.start(now);
    },
    // Rite IV — deep bell shimmer: FM synthesis, two detuned sines
    () => {
      const f = 310 * elemBase;
      [0, 7, -5].forEach((detune, i) => {
        const o = c.createOscillator(); o.type = 'sine';
        o.frequency.value = f; o.detune.value = detune;
        const g = c.createGain();
        g.gain.setValueAtTime(0, now + i * 0.015);
        g.gain.linearRampToValueAtTime(0.10 - i * 0.025, now + i * 0.015 + 0.012);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.55 - i * 0.08);
        o.connect(g); g.connect(c.destination); o.start(now + i * 0.015); o.stop(now + 0.65);
      });
    },
    // Rite V — high crystal whisper: fast attack sine + shimmer + air
    () => {
      const f = 740 * elemBase;
      tone(f, 'sine', 0.10, 0.003, 0.28, now);
      tone(f * 1.26, 'sine', 0.04, 0.003, 0.20, now + 0.005);
      noise(0.03, 4200, 0.12, now);
    },
    // Rite VI — the final rite: eerie descending cluster + breath
    () => {
      const f = 420 * elemBase;
      [[1.0, 0.09], [1.122, 0.06], [0.891, 0.05]].forEach(([mult, gain], i) => {
        const o = c.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(f * mult, now);
        o.frequency.exponentialRampToValueAtTime(f * mult * 0.88, now + 0.40);
        const g = c.createGain();
        g.gain.setValueAtTime(0, now + i * 0.02);
        g.gain.linearRampToValueAtTime(gain, now + i * 0.02 + 0.025);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.50);
        o.connect(g); g.connect(c.destination); o.start(now + i * 0.02); o.stop(now + 0.55);
      });
      noise(0.04, 600, 0.30, now + 0.05);
    },
  ];

  (rites[Math.max(0, Math.min(5, riteIndex))] || rites[0])();
}

// ── Realm navigation ────────────────────────────────────────────────────────
// dir: 'next' | 'prev'  — ascending shimmer vs descending shadow
export function realmNav(dir) {
  const c = ctx();
  const now = c.currentTime;

  if (dir === 'next') {
    // Ascending soft shimmer — stepping into the unknown
    [220, 330, 495].forEach((f, i) => {
      const o = c.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(f, now + i * 0.055);
      o.frequency.linearRampToValueAtTime(f * 1.12, now + i * 0.055 + 0.18);
      const g = c.createGain();
      g.gain.setValueAtTime(0, now + i * 0.055);
      g.gain.linearRampToValueAtTime(0.07 - i * 0.015, now + i * 0.055 + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.055 + 0.28);
      o.connect(g); g.connect(c.destination); o.start(now + i * 0.055); o.stop(now + i * 0.055 + 0.32);
    });
    noise(0.025, 3500, 0.18, now + 0.04);
  } else {
    // Descending shadow — retreating, pulling back
    [440, 293, 196].forEach((f, i) => {
      const o = c.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(f, now + i * 0.05);
      o.frequency.linearRampToValueAtTime(f * 0.88, now + i * 0.05 + 0.20);
      const g = c.createGain();
      g.gain.setValueAtTime(0, now + i * 0.05);
      g.gain.linearRampToValueAtTime(0.065 - i * 0.012, now + i * 0.05 + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.28);
      o.connect(g); g.connect(c.destination); o.start(now + i * 0.05); o.stop(now + i * 0.05 + 0.32);
    });
    noise(0.02, 800, 0.20, now);
  }
}

export function nearDeath(element) {
  const c = ctx();
  const now = c.currentTime;

  // Lub-dub heartbeat (two low thuds, second slightly quieter)
  [[0.00, 0.26, 80], [0.24, 0.18, 70]].forEach(([delay, gain, startFreq]) => {
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(startFreq, now + delay);
    osc.frequency.exponentialRampToValueAtTime(32, now + delay + 0.18);
    const env = c.createGain();
    env.gain.setValueAtTime(gain, now + delay);
    env.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.22);
    osc.connect(env); env.connect(c.destination);
    osc.start(now + delay); osc.stop(now + delay + 0.25);

    // Noise thud body (like a kick drum)
    noise(gain * 0.35, 180, 0.12, now + delay);
  });

  // High ominous whine (element-specific pitch — your shape's "voice" cracking)
  const whineFreqs = { square: 660, circle: 880, triangle: 1100 };
  const wf = whineFreqs[element] || 770;
  const wOsc = c.createOscillator();
  wOsc.type = 'sine';
  wOsc.frequency.setValueAtTime(wf * 1.04, now + 0.05);
  wOsc.frequency.linearRampToValueAtTime(wf, now + 0.35);
  const wEnv = c.createGain();
  wEnv.gain.setValueAtTime(0, now + 0.05);
  wEnv.gain.linearRampToValueAtTime(0.045, now + 0.15);
  wEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.80);
  wOsc.connect(wEnv); wEnv.connect(c.destination);
  wOsc.start(now + 0.05); wOsc.stop(now + 0.85);

  // Dissonant overtone (minor 2nd above) — unsettling
  const dOsc = c.createOscillator();
  dOsc.type = 'sine';
  dOsc.frequency.value = wf * 1.059; // minor 2nd interval
  const dEnv = c.createGain();
  dEnv.gain.setValueAtTime(0, now + 0.08);
  dEnv.gain.linearRampToValueAtTime(0.022, now + 0.20);
  dEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.70);
  dOsc.connect(dEnv); dEnv.connect(c.destination);
  dOsc.start(now + 0.08); dOsc.stop(now + 0.75);
}
