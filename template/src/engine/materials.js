// engine/materials.js - procedural surfaces, each with its own light response.
//
// A material is not a colour: it is a base albedo plus a rough/spec response plus a texture routine that draws in
// screen space, clipped to the projected polygon, with feature sizes derived from how many pixels a metre occupies at
// that depth. Concrete mottles and stains; wood has grain along its length; lacquer mirrors the sky in a broad
// vertical gradient; cloth folds; grass reads as strokes of many greens; glass keeps only what it reflects. They must
// never share one texture logic - that is what makes a painted frame look like a texture-swapped game.
'use strict';

const MAT = {
  // ---- ground ----
  soil: { color: hexLin('#5b4d3c'), rough: 0.95, spec: 0.02, tex: 'soil' },
  grassGround: { color: hexLin('#5f6440'), rough: 0.92, spec: 0.03, tex: 'grassGround' },
  asphalt: { color: hexLin('#4a4a4a'), rough: 0.88, spec: 0.05, tex: 'asphalt' },
  concrete: { color: hexLin('#9a978c'), rough: 0.9, spec: 0.04, tex: 'concrete' },
  concreteDark: { color: hexLin('#6d6a62'), rough: 0.9, spec: 0.04, tex: 'concrete' },
  plaster: { color: hexLin('#a49a89'), rough: 0.88, spec: 0.03, tex: 'plaster' },
  stone: { color: hexLin('#8e8b82'), rough: 0.86, spec: 0.06, tex: 'stone' },
  brick: { color: hexLin('#8a5a48'), rough: 0.9, spec: 0.03, tex: 'brick' },
  roofSlate: { color: hexLin('#4f5352'), rough: 0.82, spec: 0.05, tex: 'roofSlate' },
  // ---- wood & metal ----
  wood: { color: hexLin('#6d4a2f'), rough: 0.72, spec: 0.08, tex: 'wood' },
  woodPale: { color: hexLin('#8a6a48'), rough: 0.7, spec: 0.1, tex: 'wood' },
  bark: { color: hexLin('#4a3f36'), rough: 0.94, spec: 0.02, tex: 'bark' },
  metal: { color: hexLin('#6a6a6c'), rough: 0.35, spec: 0.5, tex: 'metal' },
  metalDark: { color: hexLin('#3a3a3c'), rough: 0.4, spec: 0.45, tex: 'metal' },
  brass: { color: hexLin('#9a7b45'), rough: 0.28, spec: 0.7, tex: 'brass' },
  lacquer: { color: hexLin('#1c1a1a'), rough: 0.16, spec: 0.85, tex: 'lacquer' },
  lacquerSide: { color: hexLin('#181616'), rough: 0.34, spec: 0.42, tex: 'lacquerSide' },
  ivory: { color: hexLin('#f2ead4'), rough: 0.55, spec: 0.14, tex: 'ivory' },
  wax: { color: hexLin('#e3d7bb'), rough: 0.62, spec: 0.18, tex: 'wax' },
  wheat: { color: hexLin('#b3a06e'), rough: 0.9, spec: 0.03, tex: 'wheat' },
  // ---- soft ----
  clothWool: { color: hexLin('#4a4a52'), rough: 0.95, spec: 0.02, tex: 'cloth' },
  clothCanvas: { color: hexLin('#7d735f'), rough: 0.95, spec: 0.02, tex: 'cloth' },
  skin: { color: hexLin('#8d6f5e'), rough: 0.7, spec: 0.08, tex: 'skin' },
  silhouette: { color: hexLin('#141519'), rough: 0.9, spec: 0.12, tex: 'silhouette' },
  // ---- transparent / reflective ----
  glass: { color: hexLin('#8fa4ab'), rough: 0.06, spec: 1.0, tex: 'glass', alpha: 0.42 },
  glassDark: { color: hexLin('#3a4247'), rough: 0.08, spec: 1.0, tex: 'glass', alpha: 0.72 },
  water: { color: hexLin('#4a5a5c'), rough: 0.05, spec: 1.0, tex: 'water', alpha: 0.9 },
  // ---- foliage ----
  foliage: { color: hexLin('#5a5c3c'), rough: 0.95, spec: 0.02, tex: 'foliage' },
  foliageDry: { color: hexLin('#6e6440'), rough: 0.95, spec: 0.02, tex: 'foliage' },
  // ---- emitted surfaces (lamps, lit windows) ----
  windowLit: { color: hexLin('#40342a'), rough: 0.4, spec: 0.3, emit: hexLin('#ffb464'), emitStrength: 0.9, tex: 'glass' },
  candleFlame: { color: hexLin('#ffd9a0'), emit: hexLin('#ffb060'), emitStrength: 3.2, rough: 0.5, spec: 0, tex: 'none' },
};

// ---- small helpers ---------------------------------------------------------
const withClip = (ctx, pts, fn) => {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.clip();
  fn();
  ctx.restore();
};
// Bounding box of a projected polygon, padded.
function bboxOf(pts) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}
// Anything outside the canvas costs fill time and shows nothing. Every texture routine works inside this box.
const clipBox = (b) => {
  const x0 = Math.max(b.x0, -2), y0 = Math.max(b.y0, -2);
  const x1 = Math.min(b.x1, W + 2), y1 = Math.min(b.y1, H + 2);
  return { x0, y0, x1, y1, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0), cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
};
const areaOf = (pts) => {
  let a = 0;
  for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; }
  return Math.abs(a) / 2;
};
const cssOf = (rgb255, a = 1) => `rgba(${rgb255[0]},${rgb255[1]},${rgb255[2]},${a})`;
const shadeRGB = (rgb255, k) => [clamp(rgb255[0] * k, 0, 255) | 0, clamp(rgb255[1] * k, 0, 255) | 0, clamp(rgb255[2] * k, 0, 255) | 0];
// Features measured in metres, resolved to pixels at this surface's depth (min 1 px so far things do not vanish).
const px = (s, metres) => Math.max(1, metres * s.pxPerM);

// ---- texture routines ------------------------------------------------------
// Each routine fills its own marks; the base fill is already drawn by the renderer. `s.key` is a stable integer for
// this surface, so marks do not crawl from frame to frame; camera movement changes perspective, not the pattern.
const TEX = {
  none() {},

  // Concrete: broad blotches, fine aggregate, darker wash where the ground has splashed it, occasional crack.
  concrete(ctx, s) {
    const b = s.bbox, rnd = rngFrom(s.key ^ 0x51ab);
    const n = 3 + Math.floor(clamp(b.w * b.h / 220000, 0, 4));
    for (let i = 0; i < n; i++) {
      const x = b.x0 + rnd() * b.w, y = b.y0 + rnd() * b.h, r = px(s, 0.25 + rnd() * 0.9);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const dark = rnd() < 0.55;
      g.addColorStop(0, cssOf(dark ? shadeRGB(s.rgb, 0.82) : shadeRGB(s.rgb, 1.14), 0.16 + rnd() * 0.12));
      g.addColorStop(1, cssOf(s.rgb, 0));
      ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    const specks = Math.min(160, Math.round(areaOf(s.pts) / 5200));
    for (let i = 0; i < specks; i++) {
      const x = b.x0 + rnd() * b.w, y = b.y0 + rnd() * b.h, r = px(s, 0.006 + rnd() * 0.02);
      ctx.fillStyle = cssOf(shadeRGB(s.rgb, rnd() < 0.5 ? 0.72 : 1.16), 0.16 + rnd() * 0.16);
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }
    // tide mark / dirt line rising from the bottom edge (world-down on the screen is +y)
    const g2 = ctx.createLinearGradient(0, b.y1 - b.h * 0.35, 0, b.y1);
    g2.addColorStop(0, cssOf(shadeRGB(s.rgb, 0.7), 0));
    g2.addColorStop(1, cssOf(shadeRGB(s.rgb, 0.62), 0.2));
    ctx.fillStyle = g2; ctx.fillRect(b.x0, b.y1 - b.h * 0.35, b.w, b.h * 0.35);
    if (s.key % 3 === 0 && b.w > 60) {
      ctx.strokeStyle = cssOf(shadeRGB(s.rgb, 0.55), 0.35); ctx.lineWidth = Math.max(1, px(s, 0.008));
      ctx.beginPath();
      let x = b.x0 + rnd() * b.w, y = b.y0 + rnd() * b.h * 0.4;
      ctx.moveTo(x, y);
      for (let i = 0; i < 5; i++) { x += (rnd() - 0.5) * px(s, 0.3); y += rnd() * px(s, 0.35); ctx.lineTo(x, y); }
      ctx.stroke();
    }
  },

  plaster(ctx, s) {
    const b = s.bbox, rnd = rngFrom(s.key ^ 0x77c1);
    const n = 3 + Math.floor(clamp(b.w * b.h / 300000, 0, 3));
    for (let i = 0; i < n; i++) {
      const x = b.x0 + rnd() * b.w, y = b.y0 + rnd() * b.h, r = px(s, 0.3 + rnd() * 1.2);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, cssOf(shadeRGB(s.rgb, 0.86 + rnd() * 0.28), 0.14));
      g.addColorStop(1, cssOf(s.rgb, 0));
      ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    // rain streaks: vertical dirty traces from the top edge
    const streaks = Math.round(clamp(b.w / 26, 0, 26));
    for (let i = 0; i < streaks; i++) {
      const x = b.x0 + rnd() * b.w, w = px(s, 0.01 + rnd() * 0.035), h = b.h * (0.2 + rnd() * 0.6);
      const g = ctx.createLinearGradient(0, b.y0, 0, b.y0 + h);
      g.addColorStop(0, cssOf(shadeRGB(s.rgb, 0.7), 0.16));
      g.addColorStop(1, cssOf(shadeRGB(s.rgb, 0.7), 0));
      ctx.fillStyle = g; ctx.fillRect(x, b.y0, w, h);
    }
  },

  stone(ctx, s) {
    const b = s.bbox, rnd = rngFrom(s.key ^ 0x1f3d);
    const rows = Math.max(2, Math.round(b.h / px(s, 0.42)));
    // rowH may not be zero: a bbox clipped to nothing would make the joint loop advance by 0 forever (this hung the
    // renderer for minutes at particular camera positions - see references/technical-qa.md).
    const rowH = Math.max(1, b.h / rows);
    for (let r = 0; r < rows; r++) {
      const y = b.y0 + r * rowH;
      ctx.fillStyle = cssOf(shadeRGB(s.rgb, 0.9 + rnd() * 0.2), 0.25);
      ctx.fillRect(b.x0, y, b.w, rowH * 0.9);
      ctx.fillStyle = cssOf(shadeRGB(s.rgb, 0.55), 0.3);
      ctx.fillRect(b.x0, y + rowH * 0.9, b.w, Math.max(1, rowH * 0.08));
      // joints, with a hard iteration cap as a second line of defence
      let x = b.x0 + rnd() * rowH;
      for (let guard = 0; x < b.x1 && guard < 4000; guard++) {
        ctx.fillStyle = cssOf(shadeRGB(s.rgb, 0.5), 0.25);
        ctx.fillRect(x, y, Math.max(1, px(s, 0.012)), rowH * 0.9);
        x += rowH * (1.4 + rnd() * 1.4);
      }
    }
  },

  // Slate/tile roof: coursing across the slope, each course a little darker at its lower edge, with moss in the joints.
  roofSlate(ctx, s) {
    const b = s.bbox, rnd = rngFrom(s.key ^ 0x3a17);
    const rows = Math.max(3, Math.round(b.h / px(s, 0.16)));
    for (let r = 0; r < rows; r++) {
      const y = b.y0 + (r / rows) * b.h, hh = b.h / rows;
      ctx.fillStyle = cssOf(shadeRGB(s.rgb, 0.92 + rnd() * 0.16), 0.5);
      ctx.fillRect(b.x0, y, b.w, hh * 0.92);
      ctx.fillStyle = cssOf(shadeRGB(s.rgb, 0.5), 0.45);
      ctx.fillRect(b.x0, y + hh * 0.88, b.w, Math.max(1, hh * 0.14));
      const tiles = Math.max(3, Math.round(b.w / px(s, 0.3)));
      for (let i = 0; i < tiles; i++) {
        const x = b.x0 + ((i + (r % 2) * 0.5) / tiles) * b.w;
        ctx.fillStyle = cssOf(shadeRGB(s.rgb, 0.62 + rnd() * 0.2), 0.3);
        ctx.fillRect(x, y, Math.max(1, px(s, 0.012)), hh * 0.9);
      }
    }
    // moss: a few green-warm patches, low alpha
    for (let i = 0; i < 5; i++) {
      const x = b.x0 + rnd() * b.w, y = b.y0 + rnd() * b.h, r = px(s, 0.1 + rnd() * 0.25);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(96,104,66,0.22)');
      g.addColorStop(1, 'rgba(96,104,66,0)');
      ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
  },

  brick(ctx, s) {
    const b = s.bbox, rnd = rngFrom(s.key ^ 0x2b7e);
    const rowH = Math.max(2, px(s, 0.085));
    const brow = Math.max(3, px(s, 0.22));
    const rows = Math.ceil(b.h / rowH);
    for (let r = 0; r < rows; r++) {
      const y = b.y0 + r * rowH;
      const off = (r % 2) * brow * 0.5;
      for (let x = b.x0 - brow; x < b.x1; x += brow) {
        const v = 0.82 + rnd() * 0.36;
        ctx.fillStyle = cssOf(shadeRGB(s.rgb, v), 0.5);
        ctx.fillRect(x + off + 1, y + 1, brow - 2, rowH - 2);
      }
    }
  },

  wood(ctx, s) {
    const b = s.bbox, rnd = rngFrom(s.key ^ 0x3c9a);
    ctx.save();
    // grain runs along the surface's long screen axis
    const horizontal = b.w >= b.h;
    ctx.translate(b.cx, b.cy);
    if (!horizontal) ctx.rotate(Math.PI / 2);
    const spanW = horizontal ? b.w : b.h, spanH = horizontal ? b.h : b.w;
    for (let i = 0; i < 26; i++) {
      const y = -spanH / 2 + rnd() * spanH;
      const amp = px(s, 0.006 + rnd() * 0.02);
      ctx.strokeStyle = cssOf(shadeRGB(s.rgb, 0.66 + rnd() * 0.3), 0.1 + rnd() * 0.2);
      ctx.lineWidth = Math.max(0.6, px(s, 0.003 + rnd() * 0.006));
      ctx.beginPath();
      const x0 = -spanW / 2, x1 = spanW / 2;
      ctx.moveTo(x0, y);
      ctx.bezierCurveTo(x0 + spanW * 0.3, y + amp, x0 + spanW * 0.7, y - amp, x1, y + amp * 0.4);
      ctx.stroke();
    }
    // knots (rare: a knot every few surfaces, not on every one)
    const knots = (s.key % 5 === 0) ? 1 : 0;
    for (let i = 0; i < knots; i++) {
      const x = (rnd() - 0.5) * spanW * 0.8, y = (rnd() - 0.5) * spanH * 0.7, r = px(s, 0.02 + rnd() * 0.03);
      ctx.strokeStyle = cssOf(shadeRGB(s.rgb, 0.6), 0.4);
      for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.ellipse(x, y, r * (1 + k * 0.7), r * (0.5 + k * 0.4), 0.2, 0, TAU); ctx.stroke(); }
    }
    ctx.restore();
  },

  bark(ctx, s) {
    const b = s.bbox, rnd = rngFrom(s.key ^ 0x6d21);
    const n = Math.min(70, Math.round(b.w / 3));
    for (let i = 0; i < n; i++) {
      const x = b.x0 + rnd() * b.w;
      const h = b.h * (0.15 + rnd() * 0.5);
      const y = b.y0 + rnd() * (b.h - h);
      ctx.strokeStyle = cssOf(shadeRGB(s.rgb, rnd() < 0.5 ? 0.55 : 1.35), 0.1 + rnd() * 0.16);
      ctx.lineWidth = Math.max(0.7, px(s, 0.008 + rnd() * 0.02));
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + (rnd() - 0.5) * px(s, 0.05), y + h * 0.4, x + (rnd() - 0.5) * px(s, 0.05), y + h * 0.7, x + (rnd() - 0.5) * px(s, 0.03), y + h);
      ctx.stroke();
    }
  },

  metal(ctx, s) {
    const b = s.bbox, rnd = rngFrom(s.key ^ 0x91f2);
    // a metal surface reflects the sky above and the ground below: a vertical gradient with a horizon-ish break
    const g = ctx.createLinearGradient(0, b.y0, 0, b.y1);
    const sky = clampRGB(cadd(LIGHT.sky.up, LIGHT.sky.horizon));
    const skyS = cssOf(cssRGB(cscale(sky, 0.55), LIGHT.exposure), 0.5);
    const gndS = cssOf(shadeRGB(s.rgb, 0.55), 0.5);
    g.addColorStop(0, skyS);
    g.addColorStop(0.55, cssOf(s.rgb, 0.35));
    g.addColorStop(1, gndS);
    ctx.fillStyle = g; ctx.fillRect(b.x0, b.y0, b.w, b.h);
    for (let i = 0; i < 6; i++) {
      const y = b.y0 + rnd() * b.h;
      ctx.strokeStyle = cssOf(shadeRGB(s.rgb, rnd() < 0.5 ? 0.7 : 1.3), 0.12);
      ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(b.x0, y); ctx.lineTo(b.x1, y); ctx.stroke();
    }
  },

  brass(ctx, s) {
    const b = s.bbox;
    const g = ctx.createLinearGradient(0, b.y0, 0, b.y1);
    g.addColorStop(0, cssOf(shadeRGB(s.rgb, 1.35), 0.65));
    g.addColorStop(0.5, cssOf(shadeRGB(s.rgb, 0.95), 0.4));
    g.addColorStop(1, cssOf(shadeRGB(s.rgb, 0.6), 0.55));
    ctx.fillStyle = g; ctx.fillRect(b.x0, b.y0, b.w, b.h);
  },

  // A grand piano's lacquer: nearly black, but it holds a broad soft reflection of the sky and a bright edge where the
  // varnish catches the sun. This is the one place where a smooth gradient is correct rather than a texture.
  lacquer(ctx, s) {
    const b = s.bbox;
    const g = ctx.createLinearGradient(b.x0, b.y0, b.x1, b.y1);
    const refl = cssRGB(cscale(cadd(LIGHT.sky.up, LIGHT.sky.horizon), 0.30), LIGHT.exposure);
    g.addColorStop(0, cssOf(s.rgb, 1));
    g.addColorStop(0.32, cssOf(shadeRGB(s.rgb, 1.35), 1));
    g.addColorStop(0.45, cssOf(refl, 1));
    g.addColorStop(0.58, cssOf(shadeRGB(s.rgb, 1.1), 1));
    g.addColorStop(1, cssOf(s.rgb, 1));
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = g; ctx.fillRect(b.x0, b.y0, b.w, b.h);
    ctx.globalAlpha = 1;
  },

  // The flat sides of a lacquered case: dark, almost no reflection, only a soft vertical falloff. The bright broad
  // reflection belongs to the lid's top surface, where a real sky would actually be mirrored.
  lacquerSide(ctx, s) {
    const b = s.bbox;
    const g = ctx.createLinearGradient(0, b.y0, 0, b.y1);
    g.addColorStop(0, cssOf(shadeRGB(s.rgb, 1.22), 0.4));
    g.addColorStop(0.55, cssOf(shadeRGB(s.rgb, 1.0), 0.18));
    g.addColorStop(1, cssOf(shadeRGB(s.rgb, 0.82), 0.3));
    ctx.fillStyle = g; ctx.fillRect(b.x0, b.y0, b.w, b.h);
  },

  glass(ctx, s) {    const b = s.bbox;
    const g = ctx.createLinearGradient(b.x0, b.y0, b.x1, b.y1);
    g.addColorStop(0, cssOf(cssRGB(LIGHT.sky.up, LIGHT.exposure), 0.34));
    g.addColorStop(0.45, cssOf(cssRGB(LIGHT.sky.horizon, LIGHT.exposure), 0.12));
    g.addColorStop(1, cssOf(shadeRGB(s.rgb, 0.75), 0.3));
    ctx.fillStyle = g; ctx.fillRect(b.x0, b.y0, b.w, b.h);
    ctx.strokeStyle = cssOf(shadeRGB(s.rgb, 1.5), 0.22); ctx.lineWidth = Math.max(1, px(s, 0.01));
    ctx.strokeRect(b.x0 + 2, b.y0 + 2, b.w - 4, b.h - 4);
  },

  water(ctx, s) {
    const b = s.bbox, rnd = rngFrom(s.key ^ 0x5a3c);
    ctx.fillStyle = cssOf(cssRGB(cscale(LIGHT.sky.horizon, 0.5), LIGHT.exposure), 0.25);
    ctx.fillRect(b.x0, b.y0, b.w, b.h);
    const rows = Math.max(3, Math.round(b.h / 9));
    for (let i = 0; i < rows; i++) {
      const y = b.y0 + (i + 0.5) * (b.h / rows);
      const w = b.w * (0.25 + rnd() * 0.7), x = b.x0 + rnd() * (b.w - w);
      ctx.strokeStyle = cssOf(cssRGB(cscale(LIGHT.sky.up, 0.9), LIGHT.exposure), 0.15 + rnd() * 0.25);
      ctx.lineWidth = Math.max(0.9, b.h / rows * 0.25);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.stroke();
    }
  },

  cloth(ctx, s) {
    const b = s.bbox, rnd = rngFrom(s.key ^ 0x4e11);
    // folds: soft vertical bands, alternating lit and shaded, plus a mild grime at the hem
    const folds = Math.max(2, Math.round(b.w / px(s, 0.09)));
    for (let i = 0; i < folds; i++) {
      const x = b.x0 + (i + rnd() * 0.8) * (b.w / folds);
      const w = px(s, 0.03 + rnd() * 0.06);
      const g = ctx.createLinearGradient(x - w, 0, x + w, 0);
      g.addColorStop(0, cssOf(shadeRGB(s.rgb, 1.2), 0.2));
      g.addColorStop(0.5, cssOf(shadeRGB(s.rgb, 0.78), 0.22));
      g.addColorStop(1, cssOf(shadeRGB(s.rgb, 1.15), 0.12));
      ctx.fillStyle = g; ctx.fillRect(x - w, b.y0, 2 * w, b.h);
    }
    const fuzz = Math.min(90, Math.round(areaOf(s.pts) / 4200));
    for (let i = 0; i < fuzz; i++) {
      const x = b.x0 + rnd() * b.w, y = b.y0 + rnd() * b.h;
      ctx.fillStyle = cssOf(shadeRGB(s.rgb, 1.3), 0.07);
      ctx.fillRect(x, y, 1, 1 + rnd() * 2);
    }
  },

  skin(ctx, s) {
    const b = s.bbox;
    const g = ctx.createLinearGradient(b.x0, b.y0, 0, b.y1);
    g.addColorStop(0, cssOf(shadeRGB(s.rgb, 1.1), 0.35));
    g.addColorStop(1, cssOf(shadeRGB(s.rgb, 0.85), 0.3));
    ctx.fillStyle = g; ctx.fillRect(b.x0, b.y0, b.w, b.h);
  },

  // Piano keys: bone-white strips with a faint amber cast where the varnish has aged, and thin shadows between them.
  // The gaps are shaded here rather than modelled as objects: at key scale a real gap is darker than the key.
  ivory(ctx, s) {
    const b = s.bbox;
    ctx.fillStyle = cssOf(s.rgb, 0.9); ctx.fillRect(b.x0, b.y0, b.w, b.h);
    const n = Math.min(60, Math.max(8, Math.round(b.w / Math.max(3, px(s, 0.021)))));
    for (let i = 0; i <= n; i++) {
      const x = b.x0 + (i / n) * b.w;
      ctx.fillStyle = cssOf(shadeRGB(s.rgb, 0.55), 0.55);
      ctx.fillRect(x, b.y0, Math.max(0.8, px(s, 0.0016)), b.h);
    }
    // the front edge of the key bed catches the light
    const g = ctx.createLinearGradient(0, b.y1 - b.h * 0.25, 0, b.y1);
    g.addColorStop(0, cssOf(shadeRGB(s.rgb, 1.15), 0));
    g.addColorStop(1, cssOf(shadeRGB(s.rgb, 1.15), 0.35));
    ctx.fillStyle = g; ctx.fillRect(b.x0, b.y1 - b.h * 0.25, b.w, b.h * 0.25);
  },

  // Candle wax: soft, slightly translucent near the top, with a couple of drips. It is the only thing in the film
  // that is lit from inside, so its texture stays simple and its value stays close to the flame.
  wax(ctx, s) {
    const b = s.bbox;
    const g = ctx.createLinearGradient(0, b.y0, 0, b.y1);
    g.addColorStop(0, cssOf(shadeRGB(s.rgb, 1.28), 0.6));
    g.addColorStop(0.45, cssOf(s.rgb, 0.25));
    g.addColorStop(1, cssOf(shadeRGB(s.rgb, 0.86), 0.35));
    ctx.fillStyle = g; ctx.fillRect(b.x0, b.y0, b.w, b.h);
    const rnd = rngFrom(s.key ^ 0x2aa1);
    for (let i = 0; i < 3; i++) {
      const x = b.x0 + 0.15 * b.w + rnd() * b.w * 0.7;
      const h = b.h * (0.12 + rnd() * 0.3);
      ctx.fillStyle = cssOf(shadeRGB(s.rgb, 1.35), 0.3);
      ctx.beginPath(); ctx.ellipse(x, b.y0 + h, Math.max(1, b.w * 0.1), h, 0, 0, TAU); ctx.fill();
    }
  },

  // Dry seed heads: a pale, soft mass with a few darker glumes. One more material that is not a noise texture.
  wheat(ctx, s) {
    const b = s.bbox, rnd = rngFrom(s.key ^ 0x51a3);
    ctx.fillStyle = cssOf(s.rgb, 0.75); ctx.fillRect(b.x0, b.y0, b.w, b.h);
    for (let i = 0; i < 9; i++) {
      const x = b.x0 + rnd() * b.w, y = b.y0 + rnd() * b.h;
      ctx.strokeStyle = cssOf(shadeRGB(s.rgb, 0.6 + rnd() * 0.7), 0.5);
      ctx.lineWidth = Math.max(0.6, b.w * 0.12);
      ctx.beginPath(); ctx.moveTo(x, y - b.h * 0.4); ctx.lineTo(x + (rnd() - 0.5) * b.w * 0.5, y + b.h * 0.4); ctx.stroke();
    }
  },

  // A silhouette still catches light: one soft edge on the lit side, and never an outline on both.
  silhouette(ctx, s) {
    const b = s.bbox;
    const lit = s.litSun || 0;
    const side = s.sunScreen || 1;
    const g = ctx.createLinearGradient(side > 0 ? b.x0 : b.x1, b.y0, side > 0 ? b.x1 : b.x0, b.y1);
    g.addColorStop(0, cssOf(shadeRGB(s.rgb, 0.88), 0.42));
    g.addColorStop(0.6, cssOf(s.rgb, 0.16));
    g.addColorStop(1, cssOf(shadeRGB(s.rgb, 1 + 0.8 * Math.min(1, lit)), 0.5));
    ctx.fillStyle = g; ctx.fillRect(b.x0, b.y0, b.w, b.h);
  },

  soil(ctx, s) {
    const b = s.bbox, rnd = rngFrom(s.key ^ 0x33aa);
    const n = Math.min(120, Math.round(areaOf(s.pts) / 7000));
    for (let i = 0; i < n; i++) {
      const x = b.x0 + rnd() * b.w, y = b.y0 + rnd() * b.h, r = px(s, 0.01 + rnd() * 0.05);
      ctx.fillStyle = cssOf(shadeRGB(s.rgb, rnd() < 0.5 ? 0.7 : 1.25), 0.12);
      ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.55, rnd() * TAU, 0, TAU); ctx.fill();
    }
  },

  // Ground grass with real perspective: a blade near the lens is large, a blade 40 m out is a couple of pixels, and the
  // density falls off with distance. Doing this from the horizon line (instead of one uniform screen-space carpet) is
  // what stops a field from looking like a textured plane.
  grassGround(ctx, s) {
    // The ground is one huge polygon, so its projected bbox is mostly off-screen: clamp to the canvas before sampling,
    // or almost every blade is drawn where nobody can see it.
    const full = s.bbox;
    const b = { x0: Math.max(0, full.x0), y0: Math.max(s.horizonY || 0, full.y0), x1: Math.min(W, full.x1), y1: Math.min(H, full.y1) };
    b.w = Math.max(1, b.x1 - b.x0); b.h = Math.max(1, b.y1 - b.y0);
    if (b.w < 2 || b.h < 2) return;
    const rnd = rngFrom(s.key ^ 0x2d17);
    const camH = s.camHeight || 1.5;
    const fpx = s.focalPx || 1700;
    const hy = s.horizonY || 0;
    const strokes = Math.min(7000, Math.max(900, Math.round((b.w * b.h) / 200)));
    for (let i = 0; i < strokes; i++) {
      const x = b.x0 + rnd() * b.w;
      // bias towards the bottom of the frame: that is where the near grass is
      // near-uniform over the visible field: a panorama needs texture at 30 m as much as at 3 m
      const v = 1 - Math.pow(rnd(), 1.15);
      const y = b.y0 + v * b.h;
      if (y <= hy + 2) continue;
      const dist = Math.max(1.0, (fpx * camH) / (y - hy));
      if (dist > 120) continue;
      // a tuft, not a spike: three to five blades rising from one base, leaning the same way (the wind is one body of air)
      const baseLen = Math.min(26, Math.max(1.2, (fpx * (0.035 + rnd() * 0.05)) / dist));
      const lean = (rnd() - 0.5) * 0.9;
      const blades = 2 + Math.floor(rnd() * 3);
      for (let k = 0; k < blades; k++) {
        const bx = x + (rnd() - 0.5) * baseLen * 0.5;
        const lenPx = baseLen * (0.55 + rnd() * 0.7);
        const hue = rnd();
        const c = hue < 0.3 ? shadeRGB(s.rgb, 0.62) : hue < 0.72 ? s.rgb : shadeRGB(s.rgb, 1.26);
        ctx.strokeStyle = cssOf(c, 0.26 + rnd() * 0.34);
        ctx.lineWidth = Math.max(0.6, lenPx * 0.085);
        ctx.beginPath();
        ctx.moveTo(bx, y);
        ctx.quadraticCurveTo(bx + lean * lenPx * 0.28, y - lenPx * 0.6, bx + lean * lenPx * 0.7, y - lenPx);
        ctx.stroke();
      }
    }
    // old furrows: shallow bands running away from the lens, the way a worked field lies
    for (let i = 0; i < 7; i++) {
      const y = b.y0 + b.h * ((i + 0.5) / 7);
      const g3 = ctx.createLinearGradient(0, y - b.h * 0.02, 0, y + b.h * 0.02);
      g3.addColorStop(0, cssOf(shadeRGB(s.rgb, 0.86), 0));
      g3.addColorStop(0.5, cssOf(shadeRGB(s.rgb, 0.86), 0.12));
      g3.addColorStop(1, cssOf(shadeRGB(s.rgb, 0.86), 0));
      ctx.fillStyle = g3;
      ctx.fillRect(b.x0, y - b.h * 0.02, b.w, b.h * 0.04);
    }
    // dry patches: the field is not one even carpet
    const patches = 3 + (s.key % 3);
    for (let i = 0; i < patches; i++) {
      const x = b.x0 + rnd() * b.w, y = b.y0 + rnd() * b.h, r = Math.min(b.w, b.h) * (0.1 + rnd() * 0.25);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, cssOf(shadeRGB(s.rgb, 1.14), 0.10));
      g.addColorStop(1, cssOf(s.rgb, 0));
      ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
  },
  asphalt(ctx, s) {
    const b = s.bbox, rnd = rngFrom(s.key ^ 0x7f01);
    const n = Math.min(260, Math.round(areaOf(s.pts) / 3200));
    for (let i = 0; i < n; i++) {
      const x = b.x0 + rnd() * b.w, y = b.y0 + rnd() * b.h, r = px(s, 0.004 + rnd() * 0.014);
      ctx.fillStyle = cssOf(shadeRGB(s.rgb, rnd() < 0.5 ? 0.6 : 1.4), 0.2);
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }
  },

  // Foliage: clumps of leaves as many small dark/bright dabs, heavier at the silhouette edge.
  foliage(ctx, s) {
    const b = s.bbox, rnd = rngFrom(s.key ^ 0x5c8b);
    const n = Math.min(220, Math.round(areaOf(s.pts) / 900));
    for (let i = 0; i < n; i++) {
      const x = b.x0 + rnd() * b.w, y = b.y0 + rnd() * b.h;
      const r = px(s, 0.03 + rnd() * 0.07);
      const v = 0.55 + rnd() * 0.9;
      ctx.fillStyle = cssOf(shadeRGB(s.rgb, v), 0.3 + rnd() * 0.35);
      ctx.beginPath(); ctx.ellipse(x, y, r, r * (0.5 + rnd() * 0.5), rnd() * TAU, 0, TAU); ctx.fill();
    }
  },
};

// ---- surface painting ------------------------------------------------------
// Called by the renderer once per surface. s: {ctx, pts, mat, rgb (tone-mapped base), key, pxPerM, litSun, bbox}
// Every routine draws inside the projected polygon: a texture mark that escapes its surface is the single most common
// way a procedural frame looks painted rather than photographed.
function paintSurface(s) {
  const mat = s.mat;
  const tex = TEX[mat.tex] || TEX.none;
  const ctx = s.ctx;
  s.bbox = clipBox(bboxOf(s.pts));
  // a shape clipped away (off frame, or zero height) must not reach a texture routine: several of them derive their
  // step from the bbox and would spin. This is the guard that keeps the renderer deterministic under a moving camera.
  if (!(s.bbox.w >= 1) || !(s.bbox.h >= 1)) return;
  const alpha = mat.alpha ?? 1;
  withClip(ctx, s.pts, () => {
    ctx.save();
    if (alpha < 1) ctx.globalAlpha = alpha;
    tex(ctx, s);
    ctx.restore();
  });
}
// A contact shadow / cast shadow footprint on the ground, drawn as a soft dark shape.
function paintGroundShadow(ctx, pts, strength = 0.5, softness = 5) {
  if (strength <= 0.01) return;
  // The bbox MUST be clamped. A shadow that crosses the near plane projects to coordinates in the millions, and a
  // blurred fill over that box locks the browser up - the single worst performance cliff in this renderer.
  const raw = bboxOf(pts);
  if (!Number.isFinite(raw.x0) || raw.w > W * 3 || raw.h > H * 6) {
    if (window.QA) QA.note('shadow outside the frame', { w: Math.round(raw.w), h: Math.round(raw.h) });
    return;
  }
  const b = clipBox(raw);
  if (b.w < 2 || b.h < 2) return;
  const r = clamp(softness * 2.2, 1, 64);
  // Clamp the clip path too. A polygon whose vertices are in the millions makes Chrome rasterise a path millions of
  // pixels wide before the clip even starts, which hangs the page; clamping the outline to a padded frame is invisible
  // (everything outside the canvas is clipped anyway) and costs nothing.
  const pad = 4;
  const cx0 = -pad, cy0 = -pad, cx1 = W + pad, cy1 = H + pad;
  const cp = pts.map(([x, y]) => [clamp(x, cx0, cx1), clamp(y, cy0, cy1)]);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cp[0][0], cp[0][1]);
  for (let i = 1; i < cp.length; i++) ctx.lineTo(cp[i][0], cp[i][1]);
  ctx.closePath();
  ctx.clip();
  ctx.filter = `blur(${r}px)`;
  const g = ctx.createRadialGradient(b.cx, b.cy, 0, b.cx, b.cy, Math.max(b.w, b.h) * 0.62);
  g.addColorStop(0, `rgba(0,0,0,${0.62 * strength})`);
  g.addColorStop(0.7, `rgba(0,0,0,${0.30 * strength})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(b.x0 - r, b.y0 - r, b.w + r * 2, b.h + r * 2);
  ctx.restore();
  ctx.filter = 'none';
}













