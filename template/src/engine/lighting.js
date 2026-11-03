// engine/lighting.js - one rig per frame, real directions.
//
// A frame names one lighting state (a preset interpolated by the shot). Every surface then asks the rig for its
// irradiance: a directional sun with a direction, a colour and an intensity; a hemisphere ambient that separates sky
// light (from above) from bounce light (from the ground); optional practical points (a candle, a lit window) with
// inverse-square falloff; plus depth haze. Nothing glows "because it is a highlight" - if a surface is bright, some
// named light made it bright, and the shadow side is the one facing away from the sun. That single rule is what makes
// a painted frame read as photographed rather than decorated.
'use strict';

const LIGHT = {
  sun: { dir: vnorm([-0.55, 0.42, 0.72]), color: [1.0, 0.86, 0.72], intensity: 1.5, angular: 0.05 },
  sky: { up: [0.34, 0.46, 0.62], horizon: [0.55, 0.56, 0.55], bounce: [0.20, 0.18, 0.14], intensity: 0.55 },
  points: [],
  exposure: 1.0,
  contrast: 0.12,
  haze: { color: [0.62, 0.64, 0.66], density: 0.010, heightFalloff: 0.35 },
  matteMist: 0,          // 0..1 ground mist, screen-space, drawn by the sky/atmosphere pass
};

// ---- presets ---------------------------------------------------------------
// documentary daylight is mostly overcast or a low hard sun; both are here, and both keep a cool sky with a warm sun.
const LIGHT_PRESETS = {
  overcast: {
    sun: { dir: vnorm([-0.42, 0.62, 0.66]), color: [0.84, 0.88, 0.98], intensity: 0.9, angular: 0.28 },
    sky: { up: [0.34, 0.42, 0.56], horizon: [0.62, 0.63, 0.62], bounce: [0.22, 0.22, 0.19], intensity: 0.8 },
    exposure: 1.0, contrast: 0.10, haze: { color: [0.66, 0.67, 0.68], density: 0.010, heightFalloff: 0.4 },
  },
  // late afternoon, sun low in the west, warm on the surfaces that face it, cool shade
  lategold: {
    sun: { dir: vnorm([-0.78, 0.26, 0.57]), color: [1.0, 0.72, 0.45], intensity: 2.95, angular: 0.05 },
    sky: { up: [0.16, 0.26, 0.48], horizon: [0.54, 0.47, 0.42], bounce: [0.20, 0.17, 0.13], intensity: 0.34 },
    exposure: 0.80, contrast: 0.24, haze: { color: [0.70, 0.58, 0.44], density: 0.0068, heightFalloff: 0.35 },
  },
  // the sun has just gone: the sky does the lighting, the ground is nearly black
  dusk: {
    sun: { dir: vnorm([-0.80, 0.10, 0.58]), color: [0.92, 0.55, 0.38], intensity: 0.5, angular: 0.3 },
    sky: { up: [0.13, 0.20, 0.36], horizon: [0.36, 0.32, 0.32], bounce: [0.09, 0.09, 0.09], intensity: 0.5 },
    exposure: 1.15, contrast: 0.18, haze: { color: [0.30, 0.31, 0.38], density: 0.010, heightFalloff: 0.4 },
  },
};

// ---- rig lifecycle ---------------------------------------------------------
function lightReset() {
  LIGHT.points.length = 0;
}
// Blend two presets: cameras rarely sit inside one lighting state for a whole film, and a hard switch mid-shot is a
// continuity error. Use this with a value from the shot (an argument of t) and the light becomes part of the motion.
function lightUse(preset, k = 1, blendFrom = null) {
  const p = typeof preset === 'string' ? LIGHT_PRESETS[preset] : preset;
  const src = blendFrom || (typeof preset === 'string' ? null : instanceOfPreset());
  if (!src || k >= 1) {
    LIGHT.sun.dir = p.sun.dir.slice(); LIGHT.sun.color = p.sun.color.slice();
    LIGHT.sun.intensity = p.sun.intensity; LIGHT.sun.angular = p.sun.angular;
    LIGHT.sky.up = p.sky.up.slice(); LIGHT.sky.horizon = p.sky.horizon.slice();
    LIGHT.sky.bounce = p.sky.bounce.slice(); LIGHT.sky.intensity = p.sky.intensity;
    LIGHT.exposure = p.exposure; LIGHT.contrast = p.contrast;
    LIGHT.haze.color = p.haze.color.slice(); LIGHT.haze.density = p.haze.density; LIGHT.haze.heightFalloff = p.haze.heightFalloff;
    return p;
  }
  const mixP = (a, b, kk) => cmix(a, b, kk);
  LIGHT.sun.dir = vnorm(vlerp(p.sun.dir, LIGHT.sun.dir, k));
  LIGHT.sun.color = mixP(p.sun.color, LIGHT.sun.color, k);
  LIGHT.sun.intensity = lerp(p.sun.intensity, LIGHT.sun.intensity, k);
  LIGHT.sun.angular = lerp(p.sun.angular, LIGHT.sun.angular, k);
  LIGHT.sky.up = mixP(p.sky.up, LIGHT.sky.up, k);
  LIGHT.sky.horizon = mixP(p.sky.horizon, LIGHT.sky.horizon, k);
  LIGHT.sky.bounce = mixP(p.sky.bounce, LIGHT.sky.bounce, k);
  LIGHT.sky.intensity = lerp(p.sky.intensity, LIGHT.sky.intensity, k);
  LIGHT.exposure = lerp(p.exposure, LIGHT.exposure, k);
  LIGHT.contrast = lerp(p.contrast, LIGHT.contrast, k);
  LIGHT.haze.color = mixP(p.haze.color, LIGHT.haze.color, k);
  LIGHT.haze.density = lerp(p.haze.density, LIGHT.haze.density, k);
  return p;
}
// Snapshot the current rig (used as the "from" side of a cross-fade).
function instanceOfPreset() {
  return {
    sun: { dir: LIGHT.sun.dir, color: LIGHT.sun.color, intensity: LIGHT.sun.intensity, angular: LIGHT.sun.angular },
    sky: { up: LIGHT.sky.up, horizon: LIGHT.sky.horizon, bounce: LIGHT.sky.bounce, intensity: LIGHT.sky.intensity },
    exposure: LIGHT.exposure, contrast: LIGHT.contrast,
    haze: { color: LIGHT.haze.color, density: LIGHT.haze.density, heightFalloff: LIGHT.haze.heightFalloff },
  };
}
// A practical light: a candle, a window, a fire. Physical falloff over a radius in metres.
function lightPoint(pos, color, intensity = 1, radius = 1.2) {
  LIGHT.points.push({ pos, color, intensity, radius });
}

// ---- shading ---------------------------------------------------------------
// Irradiance on a surface with normal n at world position p, ignoring shadows (occlusion is the scene author's job:
// a wall's back face simply faces away from the sun).
const _shade = { diff: [0, 0, 0], spec: 0, sunDot: 0, hemi: 0 };
function shadeSurface(normal, position, mat) {
  const n = normal;
  let diff = [0, 0, 0];
  // sun: a hard key with a soft penumbra term for grazing angles
  const ndl = Math.max(0, vdot(n, LIGHT.sun.dir));
  const soft = smoothstep01(1 - LIGHT.sun.angular * 6) * 0.12;      // larger angular size = softer terminator
  const key = smoothstep(0, 1, ndl + soft * ndl);
  diff = cadd(diff, cscale(LIGHT.sun.color, key * LIGHT.sun.intensity));
  // hemisphere ambient: up = sky, down = bounce. A surface facing the sky is lit by it; one facing down is lit by earth.
  const upness = n[1] * 0.5 + 0.5;
  const hemi = cmix(cscale(LIGHT.sky.bounce, 1.0), LIGHT.sky.up, upness);
  diff = cadd(diff, cscale(hemi, LIGHT.sky.intensity));
  // practicals
  let pointSum = 0;
  for (const pl of LIGHT.points) {
    const d = vsub(pl.pos, position);
    const dist = vlen(d) || 0.001;
    const l = vmul(d, 1 / dist);
    const ndlP = Math.max(0, vdot(n, l));
    if (ndlP <= 0) continue;
    const att = 1 / (1 + (dist / pl.radius) ** 2);
    const k = ndlP * att * pl.intensity;
    diff = cadd(diff, cscale(pl.color, k));
    pointSum += k;
  }
  // specular: only the sun and the practicals, and only as much as the material's roughness allows
  const specPow = 8 + 120 * (1 - (mat.rough ?? 0.8));
  const v = vnorm(vsub(CAMERA.pos, position));
  const h = vnorm(vadd(v, LIGHT.sun.dir));
  const specSun = Math.pow(Math.max(0, vdot(n, h)), specPow) * (mat.spec ?? 0.05) * LIGHT.sun.intensity;
  let specPoint = 0;
  for (const pl of LIGHT.points) {
    const d = vsub(pl.pos, position); const dist = vlen(d) || 0.001;
    const l = vmul(d, 1 / dist);
    const hv = vnorm(vadd(v, l));
    specPoint += Math.pow(Math.max(0, vdot(n, hv)), specPow) * (mat.spec ?? 0.05) * pl.intensity / (1 + (dist / pl.radius) ** 2);
  }
  _shade.diff = diff;
  _shade.spec = specSun + specPoint;
  _shade.sunDot = ndl;
  _shade.hemi = upness;
  return _shade;
}
// Final surface colour: albedo x irradiance, plus a tinted specular, then pushed towards the haze colour by distance.
function surfaceColor(mat, normal, position, depth) {
  const s = shadeSurface(normal, position, mat);
  const alb = mat.color;
  let c = [alb[0] * s.diff[0], alb[1] * s.diff[1], alb[2] * s.diff[2]];
  if (mat.emit) c = cadd(c, cscale(mat.emit, mat.emitStrength ?? 1));
  const specCol = cscale(cmix([1, 1, 1], LIGHT.sun.color, 0.55), s.spec * 0.9);
  c = cadd(c, specCol);
  if (depth != null) c = hazeAt(c, depth);
  return c;
}
// Aerial perspective: distant geometry loses contrast and drifts to the colour of the air. Both an exponential mix and
// a height term (haze pools low) are applied, because a field at dusk does both.
function hazeAt(color, depth, worldY = 0) {
  const hz = LIGHT.haze;
  if (!hz || depth <= 0) return color;
  const lowBoost = 1 + hz.heightFalloff * clamp01(1 - worldY / 6);
  const k = 1 - Math.exp(-depth * hz.density * lowBoost);
  return cmix(color, hz.color, clamp01(k) * 0.92);
}
// Ambient-ish colour for a fully dark surface (silhouettes, unlit interiors) so black stays a colour, not a hole.
const shadowTint = () => cmix(cscale(LIGHT.sky.up, 0.05), cscale(LIGHT.sky.bounce, 0.06), 0.5);
// The camera is needed for specular half-vectors; the renderer sets it per frame.
let CAMERA = { pos: [0, 1.6, 0], target: [0, 1.6, 1], focal: 35 };



