// engine/math.js - deterministic math for a frame-as-pure-function renderer.
//
// Every function here is a pure function of its arguments. Nothing keeps state between frames, nothing calls
// Math.random(), and nothing integrates frame by frame. A frame may be rendered in any order, on any worker, and
// comes out identical. That is the whole contract of this engine: if you need motion, write it as a closed form.
'use strict';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const lerp = (a, b, k) => a + (b - a) * k;
const lerp3 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
const remap = (v, a, b, c, d) => lerp(c, d, clamp01(invLerp(a, b, v)));
const step = (edge, x) => (x < edge ? 0 : 1);
const sign = (x) => (x < 0 ? -1 : 1);

// ---------- easing ----------
const smoothstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const smoothstep01 = (k) => { const t = clamp01(k); return t * t * (3 - 2 * t); };
const smootherstep01 = (k) => { const t = clamp01(k); return t * t * t * (t * (t * 6 - 15) + 10); };
const easeInOutCubic = (k) => { k = clamp01(k); return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
const easeInCubic = (k) => Math.pow(clamp01(k), 3);
const easeOutCubic = (k) => 1 - Math.pow(1 - clamp01(k), 3);
const easeInQuad = (k) => { k = clamp01(k); return k * k; };
const easeOutQuad = (k) => { k = clamp01(k); return k * (2 - k); };
const easeOutExpo = (k) => (k >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp01(k)));
const easeInOutSine = (k) => -(Math.cos(Math.PI * clamp01(k)) - 1) / 2;
// A move with an intentional anticipation dip: starts slightly backwards, then travels. Use for weight.
const easeAnticipate = (k, amp = 0.08) => {
  k = clamp01(k);
  return k < 0.22 ? -amp * Math.sin((k / 0.22) * Math.PI) * 0.5 : easeInOutCubic((k - 0.22) / 0.78) * (1 + amp) - amp;
};

// ---------- time helpers ----------
const seg = (t, a, b) => clamp01((t - a) / (b - a));          // 0..1 progress through [a,b]
const span = (t, a, b) => clamp(t, a, b);                      // t clamped into [a,b]
const win = (t, a, b, fade = 0.15) => Math.min(smoothstep(a, a + fade, t), 1 - smoothstep(b - fade, b, t));
const frac = (x) => x - Math.floor(x);
const mod = (a, n) => ((a % n) + n) % n;

// ---------- deterministic randomness ----------
// hash01(i): stable pseudo-random number from an index. Use it instead of Math.random() for anything that must look
// random but stay identical in every render of the same frame (star positions, grass blades, grain, speckles).
function hash01(i) {
  let x = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}
const hash2 = (a, b) => hash01(Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663));
const hash3 = (a, b, c) => hash01(Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663) ^ Math.imul(c | 0, 83492791));
// A tiny seeded generator for loops that need a stream of values (call sites always use a fixed seed).
function rngFrom(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Signed symmetric random in [-a, a].
const sym = (i, a) => (hash01(i) * 2 - 1) * a;

// ---------- noise (deterministic, smooth) ----------
// Value noise 1D: good for wind gusts, flicker, breathing. f = feature frequency in Hz-like units.
const lerpSmooth = (a, b, k) => lerp(a, b, smoothstep01(k));
function noise1(x, seed = 0) {
  const i = Math.floor(x), f = x - i;
  return lerpSmooth(hash2(i, seed), hash2(i + 1, seed), f);
}
// Value noise 2D: procedural textures (grain, clouds, dust). Returns 0..1.
function noise2(x, y, seed = 0) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const a = hash2(ix * 374761 + seed, iy * 668265);
  const b = hash2((ix + 1) * 374761 + seed, iy * 668265);
  const c = hash2(ix * 374761 + seed, (iy + 1) * 668265);
  const d = hash2((ix + 1) * 374761 + seed, (iy + 1) * 668265);
  const u = smoothstep01(fx), v = smoothstep01(fy);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
// 2-octave fbm: soft, cheap, enough for fog bands and stone mottling.
function fbm1(x, seed = 0, oct = 3) {
  let v = 0, amp = 0.5, f = 1;
  for (let o = 0; o < oct; o++) { v += amp * noise1(x * f, seed + o * 17); f *= 2.03; amp *= 0.5; }
  return v;
}
function fbm2(x, y, seed = 0, oct = 3) {
  let v = 0, amp = 0.5, f = 1;
  for (let o = 0; o < oct; o++) { v += amp * noise2(x * f, y * f, seed + o * 131); f *= 2.03; amp *= 0.5; }
  return v;
}

// ---------- curves ----------
// Cubic Hermite between two values with explicit tangents (m0, m1 in value units per unit t). The physical way to
// specify a move: "leave slowly, arrive fast" is a pair of tangents, not an easing box.
function hermite(p0, p1, m0, m1, t) {
  t = clamp01(t);
  const t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * p0 + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * p1 + (t3 - t2) * m1;
}
// Catmull-Rom through a value sequence; used for hand paths and head arcs.
function catmull(keys, t) {
  if (keys.length < 2) return keys[0] ?? 0;
  const i = clamp(Math.floor(t * (keys.length - 1)), 0, keys.length - 2);
  const lt = t * (keys.length - 1) - i;
  const p0 = keys[Math.max(0, i - 1)], p1 = keys[i], p2 = keys[i + 1], p3 = keys[Math.min(keys.length - 1, i + 2)];
  return hermite(p1, p2, (p2 - p0) * 0.5, (p3 - p1) * 0.5, lt);
}
// Cubic Bezier point for a scalar or a 2/3-vector control polygon.
const bez2 = (a, b, c, t) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * b + t * t * c;
const bez3 = (a, b, c, d, t) => {
  const u = 1 - t;
  return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
};
const bez2v = (a, b, c, t) => [bez2(a[0], b[0], c[0], t), bez2(a[1], b[1], c[1], t), bez2(a[2], b[2], c[2], t)];
// Point on a ballistic-ish arc from a to b, peaking h metres above the chord at the midpoint. k = 0..1.
const arc3 = (a, b, h, k) => {
  const p = lerp3(a, b, k);
  return [p[0], p[1] + h * 4 * k * (1 - k), p[2]];
};

// ---------- springs (closed form, not integrated) ----------
// Damped spring kicked at t0: 0 before the kick, then a decaying oscillation. Read it as follow-through: a coat hem,
// a head settle, a bird's landing bounce. k = damping (higher dies faster), w = angular frequency (rad/s).
const spring = (t, t0, k = 6, w = 18) => (t < t0 ? 0 : Math.exp(-k * (t - t0)) * Math.sin(w * (t - t0)));
// Sum of kicks at a list of event times: one impulse per event, all analytically superposed.
const ring = (t, events, k = 6, w = 18) => events.reduce((s, e) => s + spring(t, e, k, w), 0);
// A drifting spring that follows an external signal sampled `delay` seconds behind, so parts lag their driver.
// sample: (time) => number. Bias decays the lag towards the target so the part settles when the driver stops.
function lag(sample, t, delay, settle = 2.2) {
  const target = sample(t - delay);
  const prev = sample(t - delay - 0.06);
  const vel = (target - prev) / 0.06;
  return target + vel * delay * settle;
}

// ---------- vectors (plain [x,y,z] arrays) ----------
const v3 = (x = 0, y = 0, z = 0) => [x, y, z];
const vadd = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const vsub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const vmul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const vdot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const vcross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const vlen = (a) => Math.hypot(a[0], a[1], a[2]);
const vnorm = (a) => { const l = vlen(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const vdist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const vlerp = lerp3;
// Move `a` towards `b` by at most `maxStep` (for clamping IK targets into reach).
function vclampLen(a, b, maxLen) {
  const d = vsub(b, a), l = vlen(d);
  return l <= maxLen ? b.slice() : vadd(a, vmul(d, maxLen / l));
}
const vlerpRot = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];

// ---------- 3x3 rotation matrices (row-major 9-array) ----------
const mat3mul = (a, b) => {
  const o = new Array(9);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    o[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
  }
  return o;
};
const mat3id = () => [1, 0, 0, 0, 1, 0, 0, 0, 1];
const rotX = (a) => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; };
const rotY = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
const rotZ = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
const mat3apply = (m, v) => [
  m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
  m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
  m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
];
// Joint orientation from Euler angles in degrees, applied yaw -> pitch -> roll. Body axes: +x right, +y up, +z forward.
// Pitch (x) swings a limb forward/back, side (z) lifts it away from the body, yaw (y) twists it.
function eulerMat(rx, ry, rz) {
  return mat3mul(rotZ((rz || 0) * DEG), mat3mul(rotX((rx || 0) * DEG), rotY((ry || 0) * DEG)));
}
// Turn a direction into pitch/yaw degrees for gaze and camera targets.
const dirPitchYaw = (d) => {
  const n = vnorm(d);
  return { pitch: Math.asin(clamp(n[1], -1, 1)) / DEG, yaw: Math.atan2(n[0], n[2]) / DEG };
};

// ---------- interpolation of pose structs ----------
// Poses are plain objects of numbers or arrays. blendPose(a, b, k) mixes them key by key; missing keys take b's value.
function blendPose(a, b, k) {
  const o = {};
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const va = a[key], vb = b[key];
    if (typeof va === 'number' && typeof vb === 'number') o[key] = lerp(va, vb, k);
    else if (Array.isArray(va) && Array.isArray(vb)) o[key] = va.map((x, i) => lerp(x, vb[i], k));
    else if (va === undefined) o[key] = vb;
    else if (vb === undefined) o[key] = va;
    else o[key] = k < 0.5 ? va : vb;
  }
  return o;
}
// Sample a pose track: keys = [[time, pose], ...] in seconds. Before the first key the first pose holds; after the last
// key the last pose holds. Each pair is blended with the easing for that span (default smoothstep).
function poseAt(t, keys, easeFn = smoothstep01) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t < keys[i][0]) {
      const [ta, pa] = keys[i - 1], [tb, pb] = keys[i];
      return blendPose(pa, pb, easeFn((t - ta) / (tb - ta)));
    }
  }
  return keys[keys.length - 1][1];
}
// Per-key easing: keys may be [time, pose, easeFn] to override the interpolation of the span that ENDS at that key.
function poseTrack(t, keys) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t < keys[i][0]) {
      const [ta, pa] = keys[i - 1], [tb, pb, e] = keys[i];
      return blendPose(pa, pb, (e || smoothstep01)((t - ta) / (tb - ta)));
    }
  }
  return keys[keys.length - 1][1];
}

// ---------- small utilities ----------
const fmt = (n, d = 2) => (Math.round(n * 10 ** d) / 10 ** d).toFixed(d);
const isFinitePos = (p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]) && Number.isFinite(p[2]);
// Guard: any non-finite number in a point list means a bug upstream; report it instead of drawing garbage.
function assertFinitePts(pts, where) {
  for (const p of pts) {
    if (!Number.isFinite(p[0]) || !Number.isFinite(p[1]) || !Number.isFinite(p[2])) {
      if (window.QA) window.QA.fail('NaN geometry', { where, point: p });
      return false;
    }
  }
  return true;
}
