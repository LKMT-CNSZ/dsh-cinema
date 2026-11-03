// audio/score.mjs - the film's sound, synthesised from scratch and locked to the picture.
//
//   node audio/score.mjs                      -> audio/score.wav + audio/cues.json
//   ffmpeg -y -i audio/score.wav -af "highpass=f=28,loudnorm=I=-19:TP=-1.5:LRA=9" -c:a aac -b:a 192k assets/score.m4a
//
// The design follows references/sound-design.md: a documentary mix is mostly air and distance, with a few objects close
// enough to touch the lens. So: one continuous wind bed with gusts, footsteps landing on dry grass, cloth, one key
// press, one piano note that outlives its cause, and wingbeats leaving. No whooshes, no impacts, no "cinematic" hits -
// and a real silence around the note, because silence is what makes a single sound audible.
import { writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// cues.json is written next to this file and read by the QA sweep to check sound against picture
const SR = 44100;
const TAU = Math.PI * 2;
const DUR = 12.0;
const N = Math.ceil(SR * DUR);
const L = new Float32Array(N), R = new Float32Array(N);
const sendL = new Float32Array(N), sendR = new Float32Array(N);   // reverb sends

let seed = 1337;
const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// One placed sound. pan -1..1, rev = send to the room, bus 'mus' ducks under nothing here (no music).
function put(t0, len, gen, { gain = 1, pan = 0, rev = 0 } = {}) {
  const i0 = Math.max(0, Math.floor(t0 * SR)), i1 = Math.min(N, Math.floor((t0 + len) * SR));
  const gl = gain * Math.cos((pan + 1) * Math.PI / 4), gr = gain * Math.sin((pan + 1) * Math.PI / 4);
  for (let i = i0; i < i1; i++) {
    const v = gen(Math.max(0, (i - t0 * SR) / SR));
    if (!Number.isFinite(v)) continue;
    L[i] += v * gl; R[i] += v * gr;
    sendL[i] += v * gl * rev; sendR[i] += v * gr * rev;
  }
}
// Band-limited noise via a state-variable filter; fc(t) and q(t) may vary over the sound (wind gusts).
function noise(t0, len, env, filt, o = {}) {
  let lp = 0, bp = 0;
  put(t0, len, (tt) => {
    const n = rnd() * 2 - 1;
    const [fc, q0] = filt(tt), q = Math.max(0.5, q0);
    const f = Math.min(0.8, 2 * Math.sin(Math.PI * Math.min(fc, SR / 6) / SR));
    lp += f * bp; const hp = n - lp - q * bp; bp += f * hp;
    return env(tt) * (o.hp ? hp : o.lp ? lp : bp);
  }, o);
}

// ---------- the bed: wind over a field -------------------------------------------------
// Two layers: a low band that gusts (the body of the air) and a thin high layer (grass hiss). The gust is a slow LFO
// with real irregularity from value noise, never a sine: wind that breathes like a sine sounds like a synth pad.
const gust = (t) => 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(t * 0.9 + Math.sin(t * 0.37) * 1.7)) * (0.7 + 0.3 * Math.sin(t * 2.3));
// The air holds for the bird too: a gust that keeps blowing through the event would bury it. Same principle as the
// silence before the note, applied to a smaller sound.
const birdDuck = (t) => 1 - 0.55 * smooth(9.08, 9.28, t) * (1 - smooth(9.95, 10.4, t));
const duckAround = (t) => {
  // the air goes quiet for the moment of contact (4.0-4.8) and comes back after the note
  const a = 1 - 0.72 * smooth(3.85, 4.15, t) * (1 - smooth(4.75, 5.35, t));
  return a;
};
put(0, DUR, (t) => {
  const g = gust(t) * duckAround(t) * birdDuck(t) * (1 - smooth(11.35, 11.95, t));
  return g * 0.5 * Math.sin(TAU * 42 * t + Math.sin(t * 0.7) * 0.6) * 0.35;
}, { gain: 0.10 });
noise(0, DUR, (t) => gust(t) * duckAround(t) * birdDuck(t) * (1 - smooth(11.3, 11.95, t)) * 0.5, (t) => [220 + 260 * gust(t), 0.9], { gain: 0.16, pan: 0.05, rev: 0.25 });
noise(0, DUR, (t) => duckAround(t) * birdDuck(t) * (1 - smooth(11.3, 11.95, t)) * 0.10 * (0.6 + 0.4 * gust(t)), () => [5200, 0.7], { gain: 0.09, pan: -0.2, rev: 0.2, hp: true });

// ---------- footsteps on dry grass -----------------------------------------------------
// Five steps in 0.15-2.20 s. Each is a soft low thud plus a short rasp of grass; the spacing shortens as she settles.
// One footfall every 0.367 s: the walk covers its 3.08 m in 2.2 s at a 1.03 m stride, so six steps, plus the settle step.
const steps = [0.16, 0.53, 0.90, 1.27, 1.63, 1.99];
steps.forEach((t0, i) => {
  const v = 0.5 + 0.5 * Math.sin(i * 2.1);
  // one footfall is louder than the next: a walk is not a metronome
  const w = i % 2 ? 0.82 : 1.0;
  put(t0, 0.2, (tt) => v * w * 0.35 * Math.sin(TAU * (72 - tt * 60) * tt) * Math.exp(-tt * 22), { gain: 0.32, pan: -0.25, rev: 0.18 });
  noise(t0 + 0.005, 0.16, (tt) => v * w * 0.5 * Math.exp(-tt * 26), () => [2600, 0.8], { gain: 0.16, pan: -0.3, rev: 0.2, hp: true });
  noise(t0 + 0.02, 0.22, (tt) => v * w * 0.22 * Math.exp(-tt * 12), () => [900, 1.2], { gain: 0.12, pan: -0.2, rev: 0.25 });
});
// the settle step, quieter and closer to the body
put(2.40, 0.18, (tt) => 0.22 * Math.sin(TAU * (80 - tt * 60) * tt) * Math.exp(-tt * 26), { gain: 0.22, pan: -0.15, rev: 0.18 });
noise(2.41, 0.14, (tt) => 0.34 * Math.exp(-tt * 30), () => [2400, 0.8], { gain: 0.12, pan: -0.2, rev: 0.2, hp: true });

// ---------- cloth as her arm moves -----------------------------------------------------
noise(3.30, 0.55, (tt) => 0.16 * Math.sin(Math.PI * clamp(tt / 0.55)) * (0.6 + 0.4 * rnd()), () => [3400, 0.8], { gain: 0.10, pan: 0.3, rev: 0.2, hp: true });
noise(4.85, 0.70, (tt) => 0.12 * Math.sin(Math.PI * clamp(tt / 0.70)) * (0.6 + 0.4 * rnd()), () => [2900, 0.8], { gain: 0.09, pan: 0.25, rev: 0.2, hp: true });

// ---------- the key ---------------------------------------------------------------
// A key press is three sounds in order: the finger's touch (almost nothing), the key hitting the bed (a wooden knock),
// and then the note. Splitting them is what makes the action feel physical.
noise(4.20, 0.05, (tt) => 0.25 * Math.exp(-tt * 90), () => [4200, 0.9], { gain: 0.12, pan: 0.1, rev: 0.2, hp: true });
put(4.222, 0.18, (tt) => 0.5 * Math.sin(TAU * (168 - tt * 90) * tt) * Math.exp(-tt * 34), { gain: 0.30, pan: 0.1, rev: 0.25 });
noise(4.24, 0.12, (tt) => 0.22 * Math.exp(-tt * 40), () => [1200, 1.0], { gain: 0.12, pan: 0.1, rev: 0.3 });

// ---------- the note ------------------------------------------------------------------
// One note, F#3, played as an additive piano: partials with slight inharmonicity, each its own decay (the high ones die
// first), a hammer thump, and a long room behind it. It has to outlive the picture's interest in it - 4.2 s of tail -
// because that tail is the film's whole subject.
const NOTE_T = 4.235;
const F0 = mtof(54);   // F#3
const partials = [
  [1, 1.00, 3.2], [2, 0.52, 2.4], [3, 0.32, 1.9], [4, 0.20, 1.5], [5, 0.13, 1.2],
  [6, 0.09, 1.0], [7, 0.06, 0.85], [8, 0.045, 0.72], [9, 0.03, 0.6], [11, 0.02, 0.5], [13, 0.014, 0.42],
];
const noteLen = 7.4;
put(NOTE_T, noteLen, (tt) => {
  let s = 0;
  for (let i = 0; i < partials.length; i++) {
    const [h, a, d] = partials[i];
    // inharmonicity grows with the square of the partial number, as a real string's does
    const f = F0 * h * (1 + 0.00022 * h * h);
    // higher partials must decay faster, not slower: tau falls as the partial climbs the series
    const tau = 3.8 / (1 + 0.35 * (h - 1));
    s += a * Math.sin(TAU * f * tt + h * 0.7) * Math.exp(-tt / tau);
  }
  // hammer: a very short bright knock, and the soundboard's first swell
  const hammer = (Math.sin(TAU * 2100 * tt) * 0.5 + (rnd() * 2 - 1) * 0.5) * Math.exp(-tt * 220) * 0.5;
  // the strike is not a click: the note swells for 8 ms
  const swell = Math.min(1, tt / 0.008) * (tt < 0.02 ? 1 : 1);
  return 0.16 * s * swell * (1 + hammer);
}, { gain: 0.95, pan: 0.06, rev: 0.55 });
// a second, softer sympathetic ring an octave up, and the pedal/room after the strike
put(NOTE_T + 0.01, 5.2, (tt) => 0.012 * Math.sin(TAU * F0 * 2 * 1.0006 * tt) * Math.exp(-tt * 0.9) * Math.min(1, tt / 0.05), { gain: 0.5, pan: 0.15, rev: 0.7 });
// the key coming back up at 4.62: a dry wooden return, much quieter than the press
put(4.625, 0.12, (tt) => 0.26 * Math.sin(TAU * (240 - tt * 130) * tt) * Math.exp(-tt * 46), { gain: 0.24, pan: 0.1, rev: 0.2 });

// ---------- wingbeats ---------------------------------------------------------------
// 9.18: the bird leaves. Six strokes, each a soft "fwump" of air, receding and panning left as it climbs.
for (let i = 0; i < 7; i++) {
  const t0 = 9.18 + i * 0.185 - i * 0.006;
  const far = i / 6;
  noise(t0, 0.2, (tt) => (0.5 - far * 0.34) * Math.sin(Math.PI * clamp(tt / 0.2)) * (0.7 + 0.3 * rnd()), () => [280 + far * 120, 0.9], { gain: 0.36 * (1 - far * 0.45), pan: lerp(0.35, -0.6, far), rev: 0.3, lp: true });
  noise(t0 + 0.02, 0.1, (tt) => 0.18 * Math.exp(-tt * 40) * (0.7 + 0.3 * rnd()), () => [3200, 0.8], { gain: 0.08 * (1 - far * 0.5), pan: lerp(0.3, -0.55, far), rev: 0.25, hp: true });
}
// a distant bird answering, twice, far left: the field is not empty
const chirp = (t0, m, pan) => put(t0, 0.22, (tt) => 0.05 * Math.sin(TAU * mtof(m) * tt * (1 + 0.12 * Math.sin(tt * 40))) * Math.sin(Math.PI * clamp(tt / 0.22)), { gain: 0.22, pan, rev: 0.55 });
chirp(1.05, 96, -0.6); chirp(1.24, 93, -0.55); chirp(10.62, 91, -0.35); chirp(10.80, 94, -0.3);

// ---------- room ---------------------------------------------------------------------
// A short, wide stereo room (Schroeder): the field is open, so the reverb is small and dark. Only the note and the bird
// get much of it; the footsteps and the wind stay dry and close.
function verb(inp, spread) {
  const combs = [1153, 1219, 1301, 1381, 1459, 1523].map((d) => ({ b: new Float32Array(d + spread), i: 0, s: 0 }));
  const aps = [557, 443, 347].map((d) => ({ b: new Float32Array(d + spread), i: 0 }));
  const o = new Float32Array(N);
  for (let n = 0; n < N; n++) {
    const x = inp[n] * 0.022;
    let y = 0;
    for (const c of combs) { const v = c.b[c.i]; c.s = v * 0.72 + c.s * 0.28; c.b[c.i] = x + c.s * 0.8; c.i = (c.i + 1) % c.b.length; y += v; }
    for (const a of aps) { const v = a.b[a.i]; a.b[a.i] = y + v * 0.5; a.i = (a.i + 1) % a.b.length; y = v - y; }
    o[n] = y;
  }
  return o;
}
const wl = verb(sendL, 0), wr = verb(sendR, 19);
let peak = 0;
const oL = new Float32Array(N), oR = new Float32Array(N);
for (let n = 0; n < N; n++) {
  let l = L[n] + wl[n] * 3.4, r = R[n] + wr[n] * 3.4;
  l = Math.tanh(l * 1.15) / 1.15; r = Math.tanh(r * 1.15) / 1.15;
  oL[n] = l; oR[n] = r;
  peak = Math.max(peak, Math.abs(l), Math.abs(r));
}
const g = 0.82 / (peak || 1);
const fadeOut = Math.floor((DUR - 0.52) * SR);
const buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
for (let n = 0; n < N; n++) {
  const f = Math.min(1, n / (0.03 * SR)) * (n > fadeOut ? Math.max(0, 1 - (n - fadeOut) / (0.5 * SR)) : 1);   // reaches 0 at 12.0 s
  buf.writeInt16LE(Math.round(clamp(oL[n] * g * f, -1, 1) * 32767), 44 + n * 4);
  buf.writeInt16LE(Math.round(clamp(oR[n] * g * f, -1, 1) * 32767), 46 + n * 4);
}
mkdirSync(new URL('.', import.meta.url), { recursive: true });
writeFileSync(new URL('./score.wav', import.meta.url), buf);

// Cues: the picture's events, so the QA sweep can check that the sound and the image agree (a cue is "this happens at
// this second", and references/technical-qa.md uses them to test sound/picture sync).
const cues = [
  { name: 'footstep 1', t: 0.16 }, { name: 'footstep 4', t: 1.27 }, { name: 'settle step', t: 2.40 },
  { name: 'cloth reach', t: 3.30 },
  { name: 'key press', t: 4.222 }, { name: 'note F#3', t: NOTE_T }, { name: 'key release', t: 4.625, masked: true },
  { name: 'bird takeoff', t: 9.18 }, { name: 'wingbeat 3', t: 9.538 },
  { name: 'end of wind', t: 11.95, fade: true },
];
writeFileSync(new URL('./cues.json', import.meta.url), JSON.stringify(cues, null, 1));
console.log(`score.wav: ${DUR}s, peak ${peak.toFixed(2)} normalised, ${cues.length} cues`);


