// scripts/check-audio.mjs - measures the mix instead of trusting it.
//
// You cannot hear a score while writing it, so the report has to show it: level over time, the silence before the note,
// the note's decay, the wingbeats, and whether each cue in audio/cues.json actually has an onset near it. Everything is
// computed from the PCM, so it is objective and repeatable.
import { readFileSync, existsSync } from 'node:fs';

// Read a 16-bit PCM WAV (what audio/score.mjs writes) and return mono samples plus the sample rate.
export function readWav(path) {
  const b = readFileSync(path);
  if (b.toString('ascii', 0, 4) !== 'RIFF') throw new Error('not a RIFF wav');
  let off = 12, fmt = null, data = null;
  while (off + 8 <= b.length) {
    const id = b.toString('ascii', off, off + 4);
    const size = b.readUInt32LE(off + 4);
    if (id === 'fmt ') fmt = { channels: b.readUInt16LE(off + 10), sampleRate: b.readUInt32LE(off + 12), bits: b.readUInt16LE(off + 22) };
    if (id === 'data') data = { start: off + 8, size };
    off += 8 + size + (size % 2);
  }
  if (!fmt || !data) throw new Error('wav missing fmt/data');
  const ch = fmt.channels, n = Math.floor(data.size / (2 * ch));
  const mono = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let c = 0; c < ch; c++) s += b.readInt16LE(data.start + (i * ch + c) * 2) / 32768;
    mono[i] = s / ch;
  }
  return { samples: mono, sampleRate: fmt.sampleRate, duration: n / fmt.sampleRate };
}

// RMS in windows of `win` seconds, plus the peak in each window.
export function envelope(samples, sampleRate, win = 0.05) {
  const n = Math.floor(win * sampleRate);
  const out = [];
  for (let i = 0; i + n <= samples.length; i += n) {
    let s = 0, p = 0;
    for (let k = 0; k < n; k++) { const v = samples[i + k]; s += v * v; p = Math.max(p, Math.abs(v)); }
    out.push({ t: +(i / sampleRate).toFixed(3), rms: Math.sqrt(s / n), peak: p });
  }
  return out;
}

// Onset = a rise of RMS that is both absolute and relative to the previous 100 ms.
function onsets(env, threshold = 0.012) {
  const out = [];
  for (let i = 2; i < env.length; i++) {
    const prev = (env[i - 1].rms + env[i - 2].rms) / 2;
    if (env[i].rms > threshold && env[i].rms > prev * 1.6) out.push(env[i].t);
  }
  return out;
}

// Analyse a mix against the film's cue list. Returns {issues, stats}; issues use the same P0/P1/P2 vocabulary as QA.
export function analyzeAudio(wavPath, cues = [], filmDuration = 12) {
  const issues = [];
  const push = (level, kind, detail) => issues.push({ level, t: '-', kind, detail });
  if (!existsSync(wavPath)) { push('P1', 'audio missing', wavPath); return { issues, stats: null }; }
  const { samples, sampleRate, duration } = readWav(wavPath);
  const env = envelope(samples, sampleRate, 0.05);
  const at = (t) => env.find((e) => e.t >= t) || env[env.length - 1];
  const mean = (a, b) => { const s = env.filter((e) => e.t >= a && e.t < b); return s.reduce((x, e) => x + e.rms, 0) / Math.max(1, s.length); };
  const peakOf = (a, b) => env.filter((e) => e.t >= a && e.t < b).reduce((m, e) => Math.max(m, e.peak), 0);

  if (Math.abs(duration - filmDuration) > 0.15) push('P1', 'audio length', `${duration.toFixed(2)}s vs film ${filmDuration}s`);
  const wind = mean(0.3, 3.6);
  const silence = mean(4.00, 4.20);
  const notePeak = peakOf(4.24, 4.6);
  const noteTail = mean(6.4, 7.4);
  const wing = mean(9.18, 9.7);
  const end = mean(11.5, 11.95);
  if (wind < 0.002) push('P1', 'no bed', `wind RMS ${wind.toFixed(4)} - the field is silent before anything happens`);
  if (silence > wind * 0.85) push('P2', 'no silence before the note', `pre-note RMS ${silence.toFixed(4)} vs bed ${wind.toFixed(4)}`);
  if (notePeak < 0.02) push('P0', 'the note is missing', `peak ${notePeak.toFixed(4)} after 4.235 s`);
  if (noteTail < 0.0015) push('P1', 'the note dies too fast', `RMS at 6.4-7.4 s is ${noteTail.toFixed(4)}`);
  if (wing < wind) push('P2', 'wingbeats under the bed', `wing RMS ${wing.toFixed(4)} vs bed ${wind.toFixed(4)}`);
  if (end > wind * 0.6) push('P2', 'no fade at the end', `last RMS ${end.toFixed(4)} vs bed ${wind.toFixed(4)}`);

  // Cue alignment: for each scheduled cue, compare the loudest window just after it with the floor just before it.
  // A cue that is inaudible is a real defect (it was composed and then lost in the mix), so it is reported - but only
  // when the level actually fails to rise, never on the shape of the sound.
  const on = onsets(env);
  const median = (arr) => { if (!arr.length) return 0; const s = arr.slice().sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
  const cueCheck = cues.map((c) => {
    if (c.fade || c.masked) return { ...c, ratio: null, nearestOnset: null, errMs: null };
    const before = median(env.filter((e) => e.t >= c.t - 0.45 && e.t < c.t - 0.13).map((e) => e.rms));
    const after = Math.max(0, ...env.filter((e) => e.t >= c.t - 0.05 && e.t < c.t + 0.16).map((e) => e.rms));
    const ratio = before > 1e-5 ? after / before : (after > 0.002 ? 9 : 0);
    // A cue is heard if the mix CHANGES around it: either the sound raises the level, or the bed is ducked to let it
    // through (the two things a mixer does). A flat mix means the cue was lost.
    const change = ratio >= 1 ? ratio : 1 / Math.max(0.05, ratio);
    // ...or the cue simply sits above the bed (a transient over a ducked bed changes the level very little, but it is
    // unmistakably loud against the air it is in).
    const aboveBed = after / Math.max(1e-6, wind);
    const near = on.reduce((best, t) => (Math.abs(t - c.t) < Math.abs(best - c.t) ? t : best), on[0] ?? -99);
    if (change < 1.05 && aboveBed < 1.4) push('P2', 'cue lost in the mix', c.name + ' at ' + c.t + 's: level changed by ' + change.toFixed(2) + 'x, ' + aboveBed.toFixed(2) + 'x the bed');
    return { ...c, ratio: +ratio.toFixed(2), change: +change.toFixed(2), aboveBed: +aboveBed.toFixed(2), nearestOnset: near, errMs: Math.round((near - c.t) * 1000) };
  });
  // the note must outlast its cause: sound present at 2 s after the press
  const tail2s = mean(6.2, 6.4);
  return {
    issues,
    stats: {
      path: wavPath, duration: +duration.toFixed(3), sampleRate,
      rms: { bed: +wind.toFixed(4), preNote: +silence.toFixed(4), notePeak: +notePeak.toFixed(4), noteTail2s: +tail2s.toFixed(4), wing: +wing.toFixed(4), end: +end.toFixed(4) },
      cues: cueCheck,
      envelope: env.filter((e, i) => i % 10 === 0).map((e) => ({ t: e.t, rms: +e.rms.toFixed(4) })),
    },
  };
}



