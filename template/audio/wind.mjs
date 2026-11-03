// audio/wind.mjs - the mix for "Wind Past the Piano" (《风经过钢琴》).
//
//   node audio/wind.mjs            -> audio/score.wav + audio/cues.json
//   ffmpeg -y -i audio/score.wav -af "highpass=f=26,loudnorm=I=-19:TP=-1.5:LRA=9" -c:a aac -b:a 192k assets/score.m4a
//
// This is the 2.5D film's sound, and it is deliberately thinner than the earlier film's mix: wind in three layers (a low
// body, a mid air, a high hiss off the grass), a rustle that rides the gust, one distant bird, one wooden creak, and - the
// film's only musical event - the piano's own strings, excited by the wind, humming a low F# that swells and fades with the
// gust. Nobody plays it. No footsteps, no music, no hits: the space is the subject.
import { writeFileSync, mkdirSync } from 'node:fs';

const SR = 44100, TAU = Math.PI * 2, DUR = 12.0;
const N = Math.ceil(SR * DUR);
const L = new Float32Array(N), R = new Float32Array(N);
const sendL = new Float32Array(N), sendR = new Float32Array(N);
let seed = 20261;
const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

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

// ---------- wind, in three layers --------------------------------------------------------------
// The gust is the film's clock: it arrives at 1.2 s, breathes twice, and is still there at the end. The three layers do
// not peak together - the low body leads, the hiss lags by ~0.4 s - which is what makes it read as air moving through
// grass rather than as filtered noise.
const gust = (t) => 0.42 + 0.58 * (0.5 + 0.5 * Math.sin((t / 4.7) * TAU + Math.sin(t / 11.3) * 1.7));
const fadeEnd = (t) => 1 - smooth(11.35, 11.98, t);
put(0, DUR, (t) => {
  const g = gust(t) * fadeEnd(t);
  return g * 0.55 * Math.sin(TAU * 38 * t + Math.sin(t * 0.6) * 0.8) * 0.5;
}, { gain: 0.12, pan: 0.0, rev: 0.2 });
noise(0, DUR, (t) => gust(t) * fadeEnd(t) * 0.55, (t) => [190 + 300 * gust(t - 0.25), 0.95], { gain: 0.20, pan: -0.08, rev: 0.3 });
noise(0, DUR, (t) => gust(t - 0.4) * fadeEnd(t) * 0.30, (t) => [700 + 500 * gust(t - 0.4), 0.8], { gain: 0.13, pan: 0.14, rev: 0.35 });
noise(0, DUR, (t) => Math.pow(gust(t - 0.15), 1.4) * fadeEnd(t) * 0.16, () => [4200, 0.7], { gain: 0.10, pan: 0.2, rev: 0.3, hp: true });

// ---------- grass rustle: the wind made audible off the field ----------------------------------
for (let i = 0; i < 26; i++) {
  const t0 = 0.2 + i * 0.44 + (rnd() - 0.5) * 0.18;
  const g = gust(t0);
  noise(t0, 0.5 + rnd() * 0.6, (tt) => (0.25 + 0.75 * g) * 0.5 * Math.sin(Math.PI * clamp(tt / 0.9)) * (0.55 + 0.45 * rnd()), () => [3000 + rnd() * 1800, 0.85], { gain: 0.055 * (0.4 + g), pan: -0.5 + rnd(), rev: 0.4, hp: true });
}

// ---------- one distant bird, twice ------------------------------------------------------------
const call = (t0, m, pan, len = 0.26) => {
  put(t0, len, (tt) => {
    const vib = 1 + 0.05 * Math.sin(TAU * 7 * tt);
    return 0.06 * Math.sin(TAU * mtof(m) * tt * vib) * Math.sin(Math.PI * clamp(tt / len)) ** 1.4;
  }, { gain: 0.5, pan, rev: 0.7 });
};
call(3.62, 93, -0.62); call(3.86, 90, -0.58, 0.2); call(5.10, 96, -0.7, 0.18);

// ---------- the piano's strings, excited by the wind -------------------------------------------
// F#1 with its inharmonic partials, swelling with the gust. This is the film's only pitched sound, and it is not played:
// the wind does it. Amplitudes follow gust^2, so the string "answers" the air.
const F0 = mtof(30);   // F#1, ~46 Hz
const partials = [[1, 1.0], [2, 0.5], [3, 0.33], [4, 0.22], [5, 0.15], [6, 0.1], [7, 0.07], [9, 0.045], [11, 0.03], [13, 0.02]];
put(0, DUR, (t) => {
  const g = Math.pow(gust(t - 0.6), 2.2) * fadeEnd(t);
  let s = 0;
  for (const [h, a] of partials) {
    const f = F0 * h * (1 + 0.0004 * h * h);
    s += a * Math.sin(TAU * f * t * 1.0006 + h);
  }
  // a slow beating between two near-unison strings: the sound breathes by a few cents, as an old piano does
  const beat = 1 + 0.12 * Math.sin(TAU * 0.37 * t);
  return 0.055 * s * g * beat;
}, { gain: 0.85, pan: 0.05, rev: 0.75 });

// ---------- one wooden creak (the lid, or the case) --------------------------------------------
noise(6.18, 0.55, (tt) => 0.5 * Math.sin(Math.PI * clamp(tt / 0.55)) * (tt < 0.1 ? tt / 0.1 : 1), (tt) => [340 + tt * 260, 2.2], { gain: 0.13, pan: 0.25, rev: 0.5 });
put(6.20, 0.4, (tt) => 0.05 * Math.sin(TAU * (78 + 40 * Math.sin(tt * 9)) * tt) * Math.exp(-tt * 6), { gain: 0.4, pan: 0.2, rev: 0.5 });

// ---------- room -------------------------------------------------------------------------------
function verb(inp, spread) {
  const combs = [1153, 1219, 1301, 1381, 1459, 1523].map((d) => ({ b: new Float32Array(d + spread), i: 0, s: 0 }));
  const aps = [557, 443, 347].map((d) => ({ b: new Float32Array(d + spread), i: 0 }));
  const o = new Float32Array(N);
  for (let n = 0; n < N; n++) {
    const x = inp[n] * 0.024;
    let y = 0;
    for (const c of combs) { const v = c.b[c.i]; c.s = v * 0.74 + c.s * 0.26; c.b[c.i] = x + c.s * 0.8; c.i = (c.i + 1) % c.b.length; y += v; }
    for (const a of aps) { const v = a.b[a.i]; a.b[a.i] = y + v * 0.5; a.i = (a.i + 1) % a.b.length; y = v - y; }
    o[n] = y;
  }
  return o;
}
const wl = verb(sendL, 0), wr = verb(sendR, 19);
let peak = 0;
const oL = new Float32Array(N), oR = new Float32Array(N);
for (let n = 0; n < N; n++) {
  let l = L[n] + wl[n] * 4.2, r = R[n] + wr[n] * 4.2;
  l = Math.tanh(l * 1.1) / 1.1; r = Math.tanh(r * 1.1) / 1.1;
  oL[n] = l; oR[n] = r;
  peak = Math.max(peak, Math.abs(l), Math.abs(r));
}
const g = 0.82 / (peak || 1);
const fadeOut = Math.floor((DUR - 0.55) * SR);
const buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
for (let n = 0; n < N; n++) {
  const f = Math.min(1, n / (0.05 * SR)) * (n > fadeOut ? Math.max(0, 1 - (n - fadeOut) / (0.55 * SR)) : 1);
  buf.writeInt16LE(Math.round(clamp(oL[n] * g * f, -1, 1) * 32767), 44 + n * 4);
  buf.writeInt16LE(Math.round(clamp(oR[n] * g * f, -1, 1) * 32767), 46 + n * 4);
}
mkdirSync(new URL('.', import.meta.url), { recursive: true });
writeFileSync(new URL('./score.wav', import.meta.url), buf);

const cues = [
  { name: 'gust arrives', t: 1.20 },
  { name: 'grass rustle', t: 2.10 },
  { name: 'bird call', t: 3.62 },
  { name: 'strings swell', t: 5.00 },
  { name: 'wood creak', t: 6.20 },
  { name: 'second gust', t: 8.60 },
  { name: 'end of wind', t: 11.95, fade: true },
];
writeFileSync(new URL('./cues.json', import.meta.url), JSON.stringify(cues, null, 1));
console.log(`score.wav (wind): ${DUR}s, peak ${peak.toFixed(2)} normalised, ${cues.length} cues`);
