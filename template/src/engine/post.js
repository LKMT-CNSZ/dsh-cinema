// engine/post.js - the print: grain, gate vignette, a gentle halation on the brightest values, and a colour wash.
//
// Everything here is applied once over the finished frame, and every random value is derived from the frame number, so
// grain moves like film grain (fresh each frame) while staying identical for the same frame. The rule: post should be
// invisible unless you remove it. If a shot needs post to look good, the shot is wrong.
'use strict';

let POST = null;

function postInit() {
  // One grain plate, re-offset per frame. Subtle enough to survive H.264 without turning into noise.
  const w = W, h = H;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const c = cv.getContext('2d');
  const img = c.createImageData(w, h);
  const rnd = rngFrom(0x51f3a);
  for (let i = 0; i < img.data.length; i += 4) {
    // grain is stronger in the mids, weaker in the deep shadows and highlights (as a real emulsion is)
    const n = (rnd() + rnd() + rnd() - 1.5) * 0.66;      // roughly normal, -1..1
    const v = 128 + n * 46;
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  c.putImageData(img, 0, 0);
  POST = { grain: cv, vignette: null };
}

// The vignette is built once: a soft multiply that darkens the corners by a fixed amount (a lens' natural falloff).
function makeVignette(amount = 0.34) {
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(W / 2, H / 2, H * 0.34, W / 2, H / 2, H * 1.02);
  g.addColorStop(0, `rgba(255,255,255,1)`);
  g.addColorStop(0.55, `rgba(255,255,255,${1 - amount * 0.4})`);
  g.addColorStop(1, `rgba(255,255,255,${1 - amount})`);
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  return cv;
}

// Apply the print. opts: {grain, vignette, wash, halation}
function applyPost(ctx, t, frameNo, opts = {}) {
  if (!POST) postInit();
  const grainAmt = opts.grain ?? 0.055;
  // ---- halation: light bleeds around the brightest areas. Drawn from a blurred, downscaled copy of the frame with a
  // warm screen blend. Restrained: only the sun and lit paper should ever show it.
  if ((opts.halation ?? 0) > 0.001) {
    const small = ctx.canvas.width / 4;
    const tmp = document.createElement('canvas');
    tmp.width = small; tmp.height = (ctx.canvas.height / ctx.canvas.width) * small;
    const tc = tmp.getContext('2d');
    tc.drawImage(ctx.canvas, 0, 0, tmp.width, tmp.height);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = clamp01(opts.halation) * 0.22;
    ctx.filter = 'blur(9px)';
    ctx.drawImage(tmp, 0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.filter = 'none';
    ctx.restore();
  }
  // ---- vignette ----
  if ((opts.vignette ?? 0.3) > 0.001) {
    if (!POST.vignette) POST.vignette = makeVignette(opts.vignette ?? 0.3);
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 1;
    ctx.drawImage(POST.vignette, 0, 0);
    ctx.restore();
  }
  // ---- colour wash: a very slight split (cool shadows, warm highlights) so the image is not one flat grade.
  if (opts.wash) {
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    ctx.globalAlpha = clamp01(opts.wash.alpha ?? 0.12);
    ctx.fillStyle = opts.wash.color || '#8fa0b8';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();
  }
  // ---- grain: two offsets per frame, multiplied/divided so it does not grey the image out.
  if (grainAmt > 0.0005) {
    const gx = hash01(frameNo * 977 + 13) * 512, gy = hash01(frameNo * 131 + 7) * 512;
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = clamp01(grainAmt * 6);
    ctx.fillStyle = ctx.createPattern(POST.grain, 'repeat');
    ctx.translate(-gx, -gy);
    ctx.fillRect(0, 0, W + 512, H + 512);
    ctx.restore();
  }
}

// A dissolve helper: draw `src` (a finished frame canvas) over the target at alpha k.
function compositeFrame(ctx, src, k) {
  ctx.save();
  ctx.globalAlpha = clamp01(k);
  ctx.drawImage(src, 0, 0);
  ctx.restore();
}
// Fade to/from a colour (black for the opening and the ending, a paper tone for a white-out if a film wants one).
function fadeTo(ctx, color, amount) {
  if (amount <= 0.001) return;
  ctx.save();
  ctx.globalAlpha = clamp01(amount);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}
