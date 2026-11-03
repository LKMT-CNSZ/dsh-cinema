// engine/ambient.js - the world moving when nothing happens.
//
// A documentary frame is never still, and it is never all moving at once. This module is the layer of slow, involuntary
// motion: one wind field that everything reads (with a different phase and a different response time per element), clouds
// on their own very slow clocks, light drifting by fractions of a stop, dust in the air, and a bird crossing at a distance.
//
// The rule this file exists to enforce: **no two things share a period.** Wind gusts at 4.7 s and 11.3 s; a branch rings at
// 1.9 s and answers at 0.73 s; grass follows at 1.3 s with a spatial wavelength of ~7 m; clouds cross on 57 s and 23 s;
// the light changes over 37 s. When elements share a sine, the frame reads as a loop even when it is not one.
'use strict';

const AMBIENT = {
  // ---- wind ------------------------------------------------------------------------------------
  // A gust is two slow envelopes multiplied, plus a fast turbulence term. Returns 0..1.
  gust(t) {
    const a = 0.5 + 0.5 * Math.sin((t / 4.7) * TAU + Math.sin(t / 11.3) * 1.9);
    const b = 0.5 + 0.5 * Math.sin((t / 11.3) * TAU + 1.1);
    const turb = 0.5 + 0.5 * noise1(t * 0.9, 3);
    return clamp01(0.18 + 0.55 * a * b + 0.27 * turb * 0.6);
  },
  // The wind at a world position: same gust, but with a travelling wave so the field does not breathe in unison.
  // wavelength ~7 m, travelling along +x at ~2.4 m/s.
  at(t, x, z) {
    const wave = 0.5 + 0.5 * Math.sin((x / 7.0 - t / 2.4) * TAU);
    return clamp01(AMBIENT.gust(t) * (0.55 + 0.45 * wave));
  },
  // ---- vegetation ------------------------------------------------------------------------------
  // A branch tip's angular offset in degrees. Heavier branches (bigger stiffness) move less and slower.
  //
  // The two terms are the point: a slow bend with the gust, and a fast small tremor that arrives a beat later. A branch
  // that oscillates with one clean sine looks like a metronome.
  branchSway(t, seed, stiffness = 1) {
    const g = AMBIENT.gust(t - 0.18 * stiffness);
    const slow = Math.sin((t / 1.9) * TAU + seed * 2.3) * 1.0;
    const fast = Math.sin((t / 0.73) * TAU + seed * 5.1) * 0.28;
    return (slow + fast) * g * (1.3 / stiffness);
  },
  // A grass blade: bends downwind, with a slower ripple. x/z give it its place in the travelling wave.
  grassSway(t, x, z, h = 1) {
    const wind = AMBIENT.at(t, x, z);
    const ripple = Math.sin((t / 1.3) * TAU + x * 0.42 + z * 0.31);
    return wind * (0.55 + 0.45 * ripple) * h;
  },
  // ---- sky -------------------------------------------------------------------------------------
  // Clouds cross in metres of sky. Two layers at different speeds: high cirrus is faster than low cloud.
  cloudOffset(t, layer = 0) {
    if (layer === 0) return t * 0.62 + Math.sin((t / 57) * TAU) * 1.4;
    return t * 0.34 + Math.sin((t / 23) * TAU + 1.7) * 0.9;
  },
  // Cloud density breathing: the amount of cloud in frame changes over 40 s, so a 12 s film is inside one slow swell.
  cloudDensity(t) {
    return 0.72 + 0.28 * Math.sin((t / 40) * TAU + 0.8);
  },
  // ---- light -----------------------------------------------------------------------------------
  // Fractions of a stop, not stops: the sun is not a dimmer. Cloud shadow passing over the field is the main effect.
  exposureDrift(t) {
    return 1 - 0.035 * (0.5 + 0.5 * Math.sin((t / 37) * TAU)) - 0.02 * AMBIENT.gust(t);
  },
  warmDrift(t) {
    return 0.5 + 0.5 * Math.sin((t / 37) * TAU + 2.1);
  },
  // ---- air -------------------------------------------------------------------------------------
  // Dust motes: a deterministic set of points drifting in the light. Returns [{u,v,size,alpha}] in plate metres.
  motes(t, n, seed = 1, w = 6, h = 3) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const s = hash2(seed, i);
      const s2 = hash2(seed + 7, i);
      const drift = t * (0.03 + s2 * 0.05);
      const u = ((s * w + drift) % w) - w / 2;
      const v = 0.25 + ((s2 * h + Math.sin(t * 0.21 + i) * 0.06 + t * 0.012) % h);
      out.push({ u, v, size: 0.012 + s2 * 0.02, alpha: 0.12 + s * 0.3 });
    }
    return out;
  },
  // ---- the one crossing ------------------------------------------------------------------------
  // A bird crosses the far field at a distance. Not a nature-documentary flight: a shape, a wingbeat, gone.
  birdCross(t, o = {}) {
    const t0 = o.t0 ?? 2.2;
    const dur = o.dur ?? 4.6;
    const k = (t - t0) / dur;
    if (k < 0 || k > 1) return null;
    const y0 = o.y ?? 9.5;
    const x0 = o.x0 ?? -34, x1 = o.x1 ?? 26;
    return {
      pos: [lerp(x0, x1, k), y0 + Math.sin(k * Math.PI) * (o.arc ?? 1.2), o.z ?? 55],
      yaw: o.yaw ?? 96,
      pitch: -4 + Math.sin(k * Math.PI) * 4,
      wing: { spread: 0.95, flap: Math.sin((t - t0) * 5.2 * TAU) * 1.1, sweep: 0.15, bend: Math.max(0, Math.cos((t - t0) * 5.2 * TAU)) * 0.6 },
      scale: o.scale ?? 1.6,
    };
  },
};
