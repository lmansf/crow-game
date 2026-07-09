// All sound is synthesized with WebAudio: no asset files.
// Every public call is safe to make before unlock or when muted.

import { save } from './save.js';

let ctx = null;
let master = null;
let ambientNodes = null;
let glideNoise = null;
let collectStep = 0;
let collectResetAt = 0;

function now() {
  return ctx ? ctx.currentTime : 0;
}

function env(gainNode, t0, peak, attack, decay) {
  const g = gainNode.gain;
  g.cancelScheduledValues(t0);
  g.setValueAtTime(0.0001, t0);
  g.exponentialRampToValueAtTime(Math.max(peak, 0.0001), t0 + attack);
  g.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
}

function tone({ freq = 440, type = 'sine', peak = 0.2, attack = 0.01, decay = 0.2, slide = 0, delay = 0 }) {
  if (!ctx) return;
  const t0 = now() + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(freq + slide, 30), t0 + attack + decay);
  env(g, t0, peak, attack, decay);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + attack + decay + 0.05);
}

function noiseBuffer() {
  const len = ctx.sampleRate * 0.5;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

let sharedNoise = null;

function whoosh({ peak = 0.12, attack = 0.02, decay = 0.18, freq = 900, q = 1.2, delay = 0 }) {
  if (!ctx) return;
  const t0 = now() + delay;
  sharedNoise = sharedNoise || noiseBuffer();
  const src = ctx.createBufferSource();
  src.buffer = sharedNoise;
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(freq, t0);
  filter.Q.value = q;
  const g = ctx.createGain();
  env(g, t0, peak, attack, decay);
  src.connect(filter).connect(g).connect(master);
  src.start(t0);
  src.stop(t0 + attack + decay + 0.05);
}

const PENTA = [523.25, 587.33, 659.25, 783.99, 880.0]; // C5 pentatonic

export const audio = {
  unlock() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = save.muted ? 0 : 1;
      master.connect(ctx.destination);
      this.startAmbient();
    } catch {
      ctx = null;
    }
  },

  get muted() {
    return save.muted;
  },

  toggleMute() {
    save.muted = !save.muted;
    if (master) master.gain.value = save.muted ? 0 : 1;
    return save.muted;
  },

  setPaused(paused) {
    if (!ctx) return;
    if (paused && ctx.state === 'running') ctx.suspend();
    else if (!paused && ctx.state === 'suspended') ctx.resume();
  },

  // ------- SFX -------
  jump() { whoosh({ freq: 700, peak: 0.09, decay: 0.14 }); tone({ freq: 330, type: 'triangle', slide: 260, peak: 0.08, decay: 0.12 }); },
  flap() { whoosh({ freq: 480, peak: 0.16, attack: 0.015, decay: 0.2, q: 0.9 }); tone({ freq: 392, type: 'triangle', slide: 300, peak: 0.07, decay: 0.14 }); },
  dash() { whoosh({ freq: 1400, peak: 0.18, attack: 0.008, decay: 0.24, q: 1.6 }); tone({ freq: 220, type: 'sawtooth', slide: 340, peak: 0.05, decay: 0.16 }); },
  land() { whoosh({ freq: 200, peak: 0.07, attack: 0.005, decay: 0.09, q: 0.7 }); },
  wallGrab() { whoosh({ freq: 320, peak: 0.05, decay: 0.07 }); },

  glide(on) {
    if (!ctx) return;
    if (on && !glideNoise) {
      sharedNoise = sharedNoise || noiseBuffer();
      const src = ctx.createBufferSource();
      src.buffer = sharedNoise;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 620;
      filter.Q.value = 0.6;
      const g = ctx.createGain();
      g.gain.value = 0.0001;
      g.gain.setTargetAtTime(0.05, now(), 0.12);
      src.connect(filter).connect(g).connect(master);
      src.start();
      glideNoise = { src, g };
    } else if (!on && glideNoise) {
      const { src, g } = glideNoise;
      glideNoise = null;
      g.gain.setTargetAtTime(0.0001, now(), 0.08);
      src.stop(now() + 0.4);
    }
  },

  collect() {
    if (!ctx) return;
    const t = now();
    if (t > collectResetAt) collectStep = 0;
    collectResetAt = t + 2;
    const f = PENTA[collectStep % PENTA.length] * (1 + Math.floor(collectStep / PENTA.length) * 0.5);
    collectStep++;
    tone({ freq: f, type: 'sine', peak: 0.14, attack: 0.005, decay: 0.3 });
    tone({ freq: f * 2, type: 'sine', peak: 0.05, attack: 0.005, decay: 0.22, delay: 0.02 });
  },

  power() {
    [261.63, 329.63, 392.0, 523.25].forEach((f, i) =>
      tone({ freq: f, type: 'triangle', peak: 0.13, attack: 0.01, decay: 0.5, delay: i * 0.09 }));
    whoosh({ freq: 2400, peak: 0.06, attack: 0.05, decay: 0.6, delay: 0.2 });
  },

  perch() {
    tone({ freq: 659.25, type: 'sine', peak: 0.1, decay: 0.35 });
    tone({ freq: 987.77, type: 'sine', peak: 0.08, decay: 0.4, delay: 0.12 });
  },

  zap() {
    tone({ freq: 140, type: 'square', slide: -90, peak: 0.14, attack: 0.005, decay: 0.25 });
    whoosh({ freq: 3200, peak: 0.12, attack: 0.004, decay: 0.18, q: 0.5 });
  },

  launch() {
    tone({ freq: 200, type: 'triangle', slide: 480, peak: 0.14, attack: 0.01, decay: 0.28 });
    whoosh({ freq: 1000, peak: 0.1, attack: 0.01, decay: 0.22, q: 1.1 });
  },

  smash() {
    tone({ freq: 95, type: 'square', slide: -45, peak: 0.16, attack: 0.004, decay: 0.22 });
    whoosh({ freq: 240, peak: 0.18, attack: 0.004, decay: 0.24, q: 0.6 });
    whoosh({ freq: 2600, peak: 0.08, attack: 0.004, decay: 0.12, q: 0.5, delay: 0.02 });
  },

  goalLetter(i) {
    tone({ freq: 392 + i * 46, type: 'triangle', peak: 0.1, attack: 0.005, decay: 0.2 });
    whoosh({ freq: 2000, peak: 0.04, attack: 0.005, decay: 0.1 });
  },

  goal() {
    [261.63, 329.63, 392.0, 493.88, 523.25, 659.25].forEach((f, i) =>
      tone({ freq: f, type: 'triangle', peak: 0.12, attack: 0.02, decay: 1.1, delay: i * 0.11 }));
    whoosh({ freq: 1800, peak: 0.08, attack: 0.3, decay: 1.6, delay: 0.3 });
  },

  ui() { tone({ freq: 740, type: 'sine', peak: 0.06, decay: 0.09 }); },

  // ------- ambient bed: two soft detuned pads + surf noise -------
  startAmbient() {
    if (!ctx || ambientNodes) return;
    const g = ctx.createGain();
    g.gain.value = 0.05;
    g.connect(master);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 520;
    filter.connect(g);

    const oscs = [110, 110.7, 164.8, 220.9].map((f) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      const og = ctx.createGain();
      og.gain.value = 0.22;
      o.connect(og).connect(filter);
      o.start();
      return { o, og };
    });

    // slow chord drift: A minor feel <-> F major feel
    const lfoTimer = setInterval(() => {
      if (!ctx || ctx.state !== 'running') return;
      const t = now();
      const toF = Math.floor(t / 8) % 2 === 1;
      oscs[2].o.frequency.setTargetAtTime(toF ? 174.6 : 164.8, t, 1.5);
      oscs[3].o.frequency.setTargetAtTime(toF ? 261.6 : 220.9, t, 1.5);
      filter.frequency.setTargetAtTime(420 + Math.sin(t * 0.4) * 160, t, 1.2);
    }, 1000);

    // surf: slow-breathing filtered noise
    sharedNoise = sharedNoise || noiseBuffer();
    const surf = ctx.createBufferSource();
    surf.buffer = sharedNoise;
    surf.loop = true;
    const surfFilter = ctx.createBiquadFilter();
    surfFilter.type = 'lowpass';
    surfFilter.frequency.value = 380;
    const surfGain = ctx.createGain();
    surfGain.gain.value = 0.018;
    const surfLfo = ctx.createOscillator();
    surfLfo.frequency.value = 0.09;
    const surfLfoGain = ctx.createGain();
    surfLfoGain.gain.value = 0.012;
    surfLfo.connect(surfLfoGain).connect(surfGain.gain);
    surf.connect(surfFilter).connect(surfGain).connect(master);
    surf.start();
    surfLfo.start();

    ambientNodes = { g, oscs, lfoTimer, surf, surfLfo };
  },
};
