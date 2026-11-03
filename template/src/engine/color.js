// engine/color.js - linear-light colour, exposure and a filmic tone curve.
//
// All shading happens in linear light (0..N, 1.0 = a mid-bright diffuse surface). The tone curve is applied once per
// surface colour, so every fill the canvas receives is display-referred and already "filmed": no plastic highlights, no
// clipping to pure white, shadows that keep a colour. Canvas gradients then interpolate in sRGB, which is close enough
// for painted surfaces and much cheaper than a full HDR framebuffer.
'use strict';

const clampRGB = (c) => [clamp(c[0], 0, 4), clamp(c[1], 0, 4), clamp(c[2], 0, 4)];
const srgbToLinear = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
const linearToSrgb = (v) => (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
const hexToRGB = (hex) => {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
};
// Material base colours are authored in sRGB hex; lighting wants linear.
const hexLin = (hex) => hexToRGB(hex).map(srgbToLinear);
const rgbLin = (r, g, b) => [srgbToLinear(r / 255), srgbToLinear(g / 255), srgbToLinear(b / 255)];

// ---- filmic tone curve -------------------------------------------------------
// A soft-shouldered curve with a gentle S in the mids (film prints roll off before white and never fully crush).
// exposure scales scene light before the curve; contrast is applied to the curve's shape.
function toneChannel(x, exposure, contrast) {
  let v = x * exposure;
  if (v < 0) v = 0;
  // Reinhard-with-toe: keeps highlight detail, gives a soft start in the blacks.
  v = v / (1 + v * 0.72);
  // S-curve around 0.45 to give the image a "print" feel without a heavy LUT.
  v = clamp(v, 0, 1);
  v = v < 0.5 ? 0.5 * Math.pow(v * 2, 1 + contrast) : 1 - 0.5 * Math.pow((1 - v) * 2, 1 + contrast);
  return v;
}
// Convert a linear colour to a CSS rgb() string, tone-mapped and gamma-encoded.
function css(lin, exposure = 1, contrast = 0.12, alpha = 1) {
  const c = lin;
  const r = toneChannel(c[0], exposure, contrast);
  const g = toneChannel(c[1], exposure, contrast);
  const b = toneChannel(c[2], exposure, contrast);
  const R = Math.round(clamp(linearToSrgb(r), 0, 1) * 255);
  const G = Math.round(clamp(linearToSrgb(g), 0, 1) * 255);
  const B = Math.round(clamp(linearToSrgb(b), 0, 1) * 255);
  return alpha >= 1 ? `rgb(${R},${G},${B})` : `rgba(${R},${G},${B},${alpha})`;
}
// Same, but return [r,g,b] 0..255 so callers can build gradients.
function cssRGB(lin, exposure = 1, contrast = 0.12) {
  const r = toneChannel(lin[0], exposure, contrast);
  const g = toneChannel(lin[1], exposure, contrast);
  const b = toneChannel(lin[2], exposure, contrast);
  return [Math.round(clamp(linearToSrgb(r), 0, 1) * 255), Math.round(clamp(linearToSrgb(g), 0, 1) * 255), Math.round(clamp(linearToSrgb(b), 0, 1) * 255)];
}
const rgbaStr = (rgb255, a = 1) => `rgba(${rgb255[0]},${rgb255[1]},${rgb255[2]},${a})`;

// ---- colour maths in linear light -------------------------------------------
const cadd = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const cscale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const cmul = (a, b) => [a[0] * b[0], a[1] * b[1], a[2] * b[2]];
const cmix = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
const cluma = (a) => 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
const cdesat = (a, k) => { const l = cluma(a); return cmix(a, [l, l, l], k); };
// Colour temperature: 0 = cold (blue), 1 = warm (amber) for a low sun. Applied in linear light.
function warmShift(c, k) {
  return [c[0] * (1 + 0.16 * k), c[1] * (1 + 0.02 * k), c[2] * (1 - 0.20 * k)];
}
