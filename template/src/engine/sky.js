// engine/sky.js - sky, sun and air.
//
// The sky is not a backdrop image: it is the colour of the atmosphere at this camera's elevation and azimuth, with the
// sun where the lighting rig says the sun is. One consequence that matters: when the camera tilts up, the sun, the
// horizon colour and the cloud parallax all move together, so a tilt in one shot and a tilt in another agree.
'use strict';

let SKY_TEX = null;
let CLOUD_FORM = null;
function buildCloudForms() {
  const rnd = rngFrom(4711);
  const out = [];
  for (let i = 0; i < 26; i++) {
    out.push({
      u: -0.9 + rnd() * 1.8,
      v: 0.035 + Math.pow(rnd(), 1.5) * 0.235,
      w: 0.10 + rnd() * 0.30,
      h: 0.012 + rnd() * 0.032,
      a: 0.16 + rnd() * 0.30,
      tilt: (rnd() - 0.5) * 0.16,
      speed: 0.5 + rnd() * 1.6,
      cool: 0.2 + rnd() * 0.7,
      lit: rnd() < 0.35 ? 0.6 + rnd() * 0.4 : 0,
    });
  }
  return out;
}

function skyInit() {
  // A tileable cloud field, generated once from value noise. It is a DARKNESS map: drawn with a multiply blend it
  // darkens whatever colour the sky is at that moment, so the same plate serves an overcast noon and a low sun.
  const w = 1024, h = 512;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const c = cv.getContext('2d');
  const img = c.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // wrap the noise horizontally by blending two samples, so the texture tiles without a seam
      const u = x / w, v = y / h;
      const n1 = fbm2(u * 7, v * 3.4, 11, 4);
      const n2 = fbm2((u - 1) * 7, v * 3.4, 11, 4);
      const n = lerp(n1, n2, u);
      // more cloud in the mid-height band, thin at the zenith, fading into the haze at the horizon
      const band = 0.35 + 0.65 * Math.sin(Math.PI * clamp01(v * 1.2 + 0.1));
      let a = clamp01((n * 1.5 - 0.52) * 2.0) * band;
      a = Math.pow(a, 1.35);
      const i = (y * w + x) * 4;
      img.data[i] = 104; img.data[i + 1] = 108; img.data[i + 2] = 118;   // multiplied: cool, slightly blue shadow
      img.data[i + 3] = Math.round(a * 210);
    }
  }
  c.putImageData(img, 0, 0);
  SKY_TEX = cv;
}

// Draw the sky for this camera. Called before any geometry, into the frame context.
function drawSky(ctx, cam, t, o = {}) {
  const sky = LIGHT.sky;
  const ex = LIGHT.exposure, ct = LIGHT.contrast;
  const zenith = cssRGB(cscale(sky.up, 1.15), ex, ct);
  const horiz = cssRGB(sky.horizon, ex, ct);
  const horizonY = cam.horizonY;
  // vertical gradient: zenith at the top of the frame, horizon colour at the horizon line, and a slightly darker
  // band below it (the far ground, seen through air) so the seam never reads as a hard edge.
  const g1 = ctx.createLinearGradient(0, 0, 0, Math.max(1, horizonY));
  g1.addColorStop(0, cssOf(zenith, 1));
  g1.addColorStop(0.62, cssOf(cssRGB(cmix(sky.up, sky.horizon, 0.55), ex, ct), 1));
  g1.addColorStop(1, cssOf(horiz, 1));
  ctx.fillStyle = g1;
  ctx.fillRect(0, 0, W, Math.max(0, Math.min(H, horizonY)));
  if (horizonY < H) {
    const g2 = ctx.createLinearGradient(0, horizonY, 0, H);
    g2.addColorStop(0, cssOf(horiz, 1));
    g2.addColorStop(1, cssOf(cssRGB(cmix(sky.horizon, [0.16, 0.15, 0.14], 0.72), ex, ct), 1));
    ctx.fillStyle = g2;
    ctx.fillRect(0, horizonY, W, H - horizonY);
  }

  // ---- clouds: anchored to azimuth and elevation, so a pan slides them and a tilt carries them with the horizon ---
  if (o.clouds !== false) {
    const density = o.cloudDensity ?? 1;
    if (density > 0.01) {
      const texPxToScreen = (cam.focalPx * 2.6) / SKY_TEX.width;   // 1024 texels span ~150 degrees
      const imgW = SKY_TEX.width * texPxToScreen, imgH = SKY_TEX.height * texPxToScreen;
      // the drift comes from the ambient clock (two layers on different periods), so the sky never loops
      const drift = o.cloudDrift != null ? o.cloudDrift * cam.focalPx * 0.05 : t * 2.4;
      const offX = mod(W / 2 - cam.yaw * cam.focalPx + drift, imgW) - imgW;
      const baseY = horizonY - imgH * 0.78;
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = clamp01(0.95 * density);
      for (let i = -1; i < Math.ceil(W / imgW) + 2; i++) {
        ctx.drawImage(SKY_TEX, offX + i * imgW, baseY, imgW, imgH);
      }
      // a second, higher cloud rank at half weight and a different period: cirrus over low cloud
      if (o.cloudDrift2 != null) {
        const drift2 = o.cloudDrift2 * cam.focalPx * 0.028;
        const off2 = mod(W / 2 - cam.yaw * cam.focalPx + drift2, imgW * 1.7) - imgW * 1.7;
        ctx.globalAlpha = clamp01(0.30 * density);
        for (let i = -1; i < Math.ceil(W / (imgW * 1.7)) + 2; i++) {
          ctx.drawImage(SKY_TEX, off2 + i * imgW * 1.7, baseY - imgH * 0.34, imgW * 1.7, imgH * 1.7);
        }
        ctx.globalAlpha = 1;
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }
  }

  // ---- sun ----
  const sunScreen = project(cam, vadd(cam.pos, vmul(LIGHT.sun.dir, 400)));
  if (sunScreen) {
    const r = Math.max(6, cam.focalPx * Math.tan(0.0045));   // ~0.5 degree disc
    const warm = cssRGB(cscale(LIGHT.sun.color, 0.8), 0.9, 0.1);
    const glowA = 0.5 * clamp01(LIGHT.sun.intensity / 2.2);
    // wide atmospheric halo, then the disc. No streaks, no iris ghosts: a documentary lens at f/5.6.
    const halo = ctx.createRadialGradient(sunScreen.x, sunScreen.y, 0, sunScreen.x, sunScreen.y, r * 46);
    halo.addColorStop(0, cssOf(warm, 0.62 * glowA + 0.16));
    halo.addColorStop(0.12, cssOf(warm, 0.22 * glowA + 0.05));
    halo.addColorStop(0.45, cssOf(warm, 0.06 * glowA));
    halo.addColorStop(1, cssOf(warm, 0));
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, W, H);
    const disc = ctx.createRadialGradient(sunScreen.x, sunScreen.y, 0, sunScreen.x, sunScreen.y, r);
    disc.addColorStop(0, 'rgba(255,253,246,0.98)');
    disc.addColorStop(0.72, cssOf(warm, 0.92));
    disc.addColorStop(1, cssOf(warm, 0));
    ctx.fillStyle = disc;
    ctx.beginPath(); ctx.arc(sunScreen.x, sunScreen.y, r, 0, TAU); ctx.fill();
  }

  // ---- painted cloud masses ------------------------------------------------------------------
  // A texture multiply gives grain, not clouds. These are drawn as soft, slow, layered masses whose positions are fixed in
  // sky coordinates (so a pan slides them) and whose drift comes from the ambient clock.
  if (o.clouds !== false && (o.cloudDensity ?? 1) > 0.2) {
    const dens = clamp01((o.cloudDensity ?? 1));
    const drift = (o.cloudDrift ?? t * 0.5);
    const clouds = CLOUD_FORM || (CLOUD_FORM = buildCloudForms());
    for (const c of clouds) {
      const u = c.u - drift * c.speed * 0.02;
      const sx = W / 2 + u * cam.focalPx - cam.yaw * cam.focalPx - drift * cam.focalPx * 0.012;
      const sy = cam.horizonY - c.v * cam.focalPx;
      const rw = c.w * cam.focalPx, rh = c.h * cam.focalPx;
      if (sx + rw < -200 || sx - rw > W + 200) continue;
      const a = clamp01(c.a * dens * (o.cloudAlpha ?? 1));
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, rw);
      const cool = cssRGB(cscale(cmix(LIGHT.sky.up, LIGHT.sky.horizon, c.cool), 1.0), LIGHT.exposure, LIGHT.contrast);
      g.addColorStop(0, cssOf(cool, a));
      g.addColorStop(0.55, cssOf(cool, a * 0.55));
      g.addColorStop(1, cssOf(cool, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(sx, sy, rw, rh, c.tilt, 0, TAU);
      ctx.fill();
      // the lit underside: a thin warm edge where the low sun catches the cloud
      if (c.lit > 0.01 && LIGHT.sun.intensity > 1) {
        const warm = cssRGB(cscale(LIGHT.sun.color, 0.9), LIGHT.exposure, LIGHT.contrast);
        const g2 = ctx.createLinearGradient(sx - rw, sy + rh * 0.2, sx + rw, sy + rh * 0.9);
        g2.addColorStop(0, cssOf(warm, 0));
        g2.addColorStop(0.5, cssOf(warm, a * c.lit * 0.5));
        g2.addColorStop(1, cssOf(warm, 0));
        ctx.fillStyle = g2;
        ctx.beginPath();
        ctx.ellipse(sx, sy, rw * 0.92, rh * 0.9, c.tilt, 0, TAU);
        ctx.fill();
      }
    }
  }
  // horizon haze: a band of air laid over the land AND the sky at once, so the meeting is not a line at all
  {
    const hz = cssRGB(cscale(cmix(LIGHT.sky.horizon, LIGHT.sky.up, 0.25), 1.0), LIGHT.exposure, LIGHT.contrast);
    const y0 = cam.horizonY - H * 0.02, y1 = cam.horizonY + H * 0.16;
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, cssOf(hz, 0.30));
    g.addColorStop(0.45, cssOf(hz, 0.20));
    g.addColorStop(1, cssOf(hz, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, y0, W, y1 - y0);
  }
  // horizon haze: the air near the ground is denser and brighter; this is the one band that ties sky to land
  const hz = LIGHT.haze;
  const hazeBand = ctx.createLinearGradient(0, horizonY - H * 0.16, 0, horizonY + H * 0.04);
  hazeBand.addColorStop(0, cssOf(hz.color, 0));
  hazeBand.addColorStop(0.75, cssOf(hz.color, clamp01(0.28 + hz.density * 6) * 0.6));
  hazeBand.addColorStop(1, cssOf(hz.color, 0));
  ctx.fillStyle = hazeBand;
  ctx.fillRect(0, horizonY - H * 0.16, W, H * 0.2);
}

// Ground mist, drawn after geometry: a few slow horizontal veils that only exist near the ground plane.
// amount 0..1. Use it for dawn, dusk and after rain - never as a general "atmosphere" filter over everything.
function drawMist(ctx, cam, t, amount) {
  if (amount <= 0.01) return;
  const horizonY = cam.horizonY;
  const col = cssRGB(cscale(LIGHT.haze.color, 1.0), LIGHT.exposure, LIGHT.contrast);
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 4; i++) {
    const y = horizonY - 6 + i * (H * 0.02) + Math.sin(t * 0.09 + i * 1.7) * 3;
    const thick = H * (0.035 + i * 0.012);
    const g = ctx.createLinearGradient(0, y - thick, 0, y + thick);
    const a = amount * (0.09 - i * 0.014);
    g.addColorStop(0, cssOf(col, 0));
    g.addColorStop(0.5, cssOf(col, Math.max(0, a)));
    g.addColorStop(1, cssOf(col, 0));
    ctx.fillStyle = g;
    // ragged horizontal extent so the veil does not read as a band
    const xoff = Math.sin(t * 0.05 + i) * W * 0.08;
    ctx.fillRect(xoff, y - thick, W - xoff * 2, thick * 2);
  }
  ctx.restore();
}



