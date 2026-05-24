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
// Unmissable: sub-bass impact + screaming pitch dive + noise crash + horror chord
export function death() {
  const c = ctx();
  const now = c.currentTime;

  // ① Sub-bass BOOM — hits immediately, physical impact
  const sub = c.createOscillator();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(120, now);
  sub.frequency.exponentialRampToValueAtTime(28, now + 0.55);
  const subG = c.createGain();
  subG.gain.setValueAtTime(0.9, now);
  subG.gain.exponentialRampToValueAtTime(0.001, now + 0.60);
  sub.connect(subG); subG.connect(c.destination);
  sub.start(now); sub.stop(now + 0.65);

  // ② Distorted sawtooth pitch dive (the "scream")
  const ws = c.createWaveShaper();
  const curve = new Float32Array(512);
  for (let i = 0; i < 512; i++) {
    const x = (i * 2) / 512 - 1;
    curve[i] = (Math.PI + 300) * x / (Math.PI + 300 * Math.abs(x));
  }
  ws.curve = curve;
  const saw = c.createOscillator();
  saw.type = 'sawtooth';
  saw.frequency.setValueAtTime(600, now);
  saw.frequency.exponentialRampToValueAtTime(40, now + 0.80);
  const sawG = c.createGain();
  sawG.gain.setValueAtTime(0.55, now);
  sawG.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
  saw.connect(ws); ws.connect(sawG); sawG.connect(c.destination);
  saw.start(now); saw.stop(now + 0.90);

  // ③ White noise crash (full-spectrum impact)
  noise(0.55, 6000, 0.08, now);          // initial crack
  noise(0.30, 2000, 0.45, now + 0.04);  // rumble tail
  noise(0.15, 500,  0.70, now + 0.08);  // low rumble

  // ④ Horror chord (minor 2nd cluster, dark and unresolved)
  [[110, 0.18], [116.5, 0.14], [130.8, 0.12]].forEach(([freq, gain], i) => {
    const o = c.createOscillator();
    o.type = 'triangle';
    o.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(0, now + 0.05);
    g.gain.linearRampToValueAtTime(gain, now + 0.15);
    g.gain.exponentialRampToValueAtTime(0.001, now + 1.80);
    o.connect(g); g.connect(c.destination);
    o.start(now + 0.05); o.stop(now + 1.85);
  });

  // ⑤ High metallic sting (cuts through)
  const sting = c.createOscillator();
  sting.type = 'square';
  sting.frequency.setValueAtTime(880, now);
  sting.frequency.exponentialRampToValueAtTime(220, now + 0.30);
  const stingF = c.createBiquadFilter();
  stingF.type = 'bandpass'; stingF.frequency.value = 1400; stingF.Q.value = 3;
  const stingG = c.createGain();
  stingG.gain.setValueAtTime(0.22, now);
  stingG.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
  sting.connect(stingF); stingF.connect(stingG); stingG.connect(c.destination);
  sting.start(now); sting.stop(now + 0.40);
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
