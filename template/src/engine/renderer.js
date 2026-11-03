// engine/renderer.js - a depth-sorted painter of a metric 3D world.
//
// Scene code never draws: it declares geometry (quads, boxes, tubes, ground, shadows, billboards) and the renderer
// projects it through the frame's camera, sorts every surface back-to-front and paints it with its material's light
// response. Surfaces are convex, the sort is by depth, and the near plane is clipped in view space, so nothing can
// throw a canvas error or draw the world inside-out when the camera moves into a wall.
//
// Sorting keys, in order: layer (fixed draw bands: ground < shadows < geometry < overlay), then depth (far first),
// then `order` (tie-breaker for parts of one object, e.g. a character's limbs).
'use strict';

const SCENE = {
  cam: null,
  ops: [],
  seq: 0,
  frameNo: 0,
  dof: null,          // {focus, bands:[{z,blur}]} set by the shot when it wants a focus pull
  stats: { quads: 0, ops: 0 },
};

const LAYER = { SKY: -100, GROUND: -40, SHADOW: -30, MIST: -20, GEO: 0, OVER: 20, POST: 40 };

function sceneBegin(cam, frameNo) {
  SCENE.cam = cam;
  SCENE.ops.length = 0;
  SCENE.seq = 0;
  SCENE.frameNo = frameNo;
  SCENE.t = frameNo / (PROJECT.fps || 24);
  SCENE.stats.quads = 0;
  SCENE.stats.ops = 0;
  SCENE.tags = {};
  SCENE.plates = {};
  CAMERA = cam;                     // lighting specular needs the lens position
}
// Push one draw command. z = view depth (larger is further); order breaks ties inside an object.
// Count how many times a named thing was drawn this frame. A prop placed twice (the classic "two birds" defect) shows
// up as a count of 2, and the QA probe fails that frame.
function sceneTag(name) { SCENE.tags[name] = (SCENE.tags[name] || 0) + 1; }
const OP_CAP = 2400;
function _op(z, draw, layer = LAYER.GEO, order = 0) {
  // A hard cap on queued draw commands: a pathological frame must fail loudly and cheaply, not hang the renderer.
  if (SCENE.ops.length >= OP_CAP) {
    if (!SCENE.capped) { SCENE.capped = true; if (window.QA) QA.warn('op cap hit', { cap: OP_CAP }); }
    return;
  }
  SCENE.ops.push({ z, layer, order, draw });
}
// A scene-authored draw command (rim lights, fog cards, hand-made silhouettes) that still takes part in the depth
// sort. Use it when a shape needs a paint routine the materials do not cover.
function customOp(z, draw, o = {}) { _op(z, draw, o.layer ?? LAYER.GEO, o.order ?? 0); }

// ---------- primitives ----------
// A convex 3D polygon. n may be omitted; it is derived from the winding (counter-clockwise seen from the front).
function poly3(pts, matId, o = {}) {
  const cam = SCENE.cam;
  const pr = projectPoly(cam, pts, o.depth);
  if (!pr) return null;
  const mat = MAT[matId] || MAT.concrete;
  const center = o.center || centroid3(pts);
  // Two-sided lighting: the normal is turned towards the lens. Winding mistakes are then invisible, and a flat panel
  // (a window, a boarded plank, a roof sheet) is lit by the light that can actually reach the face we are seeing.
  let normal = o.normal || faceNormal(pts);
  if (!o.keepNormal && vdot(normal, vsub(cam.pos, center)) < 0) normal = vmul(normal, -1);
  const lin = surfaceColor(mat, normal, center, o.noHaze ? null : pr.z);
  const rgb = cssRGB(lin, LIGHT.exposure, LIGHT.contrast);
  const pxPerM = cam.focalPx / Math.max(0.05, pr.z);
  const key = o.key ?? (hash2(Math.round(center[0] * 100) + 4096, Math.round(center[1] * 100) * 7 + Math.round(center[2] * 100)) >>> 0);
  const litSun = Math.max(0, vdot(normal, LIGHT.sun.dir)) * LIGHT.sun.intensity;
  const spec = clamp(_shade.spec, 0, 1);
  _op(pr.z, (ctx) => {
    const path = polyPath(ctx, pr.pts);
    ctx.fillStyle = cssOf(rgb, mat.alpha ?? 1);
    if (mat.alpha < 1) { ctx.globalAlpha = 1; }
    ctx.fill(path);
    if (o.shading !== false) paintSurface({ ctx, pts: pr.pts, mat, rgb, key, pxPerM, litSun, spec, z: pr.z, normal, center });
    if (spec > 0.06 && mat.spec > 0.2 && o.spec !== false) paintSpec(ctx, pr.pts, rgb, spec, pxPerM);
    if (o.stroke && o.strokeColor) {
      ctx.strokeStyle = o.strokeColor; ctx.lineWidth = o.stroke; ctx.stroke(path);
    }
  }, o.layer ?? LAYER.GEO, o.order ?? 0);
  SCENE.stats.quads++;
  return pr;
}
function faceNormal(pts) {
  // Newell's method: robust for non-planar polygons and any vertex count.
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    ny += (a[2] - b[2]) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return vnorm([nx, ny, nz]);
}
function centroid3(pts) {
  let x = 0, y = 0, z = 0;
  for (const p of pts) { x += p[0]; y += p[1]; z += p[2]; }
  return [x / pts.length, y / pts.length, z / pts.length];
}
function polyPath(ctx, pts) {
  const p = new Path2D();
  p.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]);
  p.closePath();
  return p;
}
// A soft specular streak inside a glossy surface (lacquer, glass, water, metal). Kept small and asymmetric.
function paintSpec(ctx, pts, rgb, spec, pxPerM) {
  const b = bboxOf(pts);
  ctx.save();
  ctx.clip(polyPath(ctx, pts));
  const cx = b.cx + b.w * 0.06, cy = b.y0 + b.h * 0.18;
  const r = Math.max(b.w, b.h) * 0.42;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  const a = clamp(spec * 0.5, 0, 0.5);
  g.addColorStop(0, `rgba(255,252,244,${a})`);
  g.addColorStop(0.55, `rgba(255,250,240,${a * 0.25})`);
  g.addColorStop(1, 'rgba(255,250,240,0)');
  ctx.fillStyle = g; ctx.fillRect(b.x0 - 2, b.y0 - 2, b.w + 4, b.h + 4);
  ctx.restore();
}

// A box in world space. options: {mat, matTop, matSide, rotY, layer, order, depthBias}
function box(center, size, matId, o = {}) {
  const [cx, cy, cz] = center;
  const [sx, sy, sz] = size;
  const hx = sx / 2, hy = sy / 2, hz = sz / 2;
  const ry = (o.rotY || 0);
  const c = Math.cos(ry), s = Math.sin(ry);
  const R = (x, y, z) => [cx + x * c + z * s, cy + y, cz - x * s + z * c];
  const V = {
    nbl: R(-hx, -hy, -hz), nbr: R(hx, -hy, -hz), ntr: R(hx, hy, -hz), ntl: R(-hx, hy, -hz),
    fbl: R(-hx, -hy, hz), fbr: R(hx, -hy, hz), ftr: R(hx, hy, hz), ftl: R(-hx, hy, hz),
  };
  const m = o.mat || matId;
  const top = o.matTop || m, side = o.matSide || m;
  const faces = [
    ['front', [V.fbl, V.fbr, V.ftr, V.ftl], side],
    ['back', [V.nbr, V.nbl, V.ntl, V.ntr], side],
    ['left', [V.nbl, V.fbl, V.ftl, V.ntl], side],
    ['right', [V.fbr, V.nbr, V.ntr, V.ftr], side],
    ['top', [V.ntl, V.ntr, V.ftr, V.ftl], top],
    ['bottom', [V.nbl, V.fbl, V.fbr, V.nbr], side],
  ];
  // back faces are skipped by the painter anyway (their normal faces away), but keeping them costs nothing and keeps
  // interior-visible objects (an open lid, a hollow wall) correct.
  for (const [name, pts, mid] of faces) {
    poly3(pts, mid, { ...o, normal: faceNormal(pts), center: centroid3(pts), order: (o.order || 0) });
  }
}

// A tapered tube along a 3D spine, emitted as one screen-space silhouette between consecutive rings.
// Used for limbs, branches, pipes, candle stems. radii is per-point in metres. The silhouette is built by offsetting
// the projected spine perpendicular to itself, and the ends are extended by half a radius so consecutive segments of a
// limb overlap instead of leaving a gap at the joint.
function tube(pts, radii, matId, o = {}) {
  const cam = SCENE.cam;
  const mat = MAT[matId] || MAT.concrete;
  const n = pts.length;
  const view = pts.map((p) => viewPoint(cam, p));
  const screens = view.map((v) => (v.z > NEAR ? viewToScreen(cam, v) : null));
  if (screens.some((s) => !s)) return;                 // part of the tube is behind the lens: skip that tube whole
  const extend = o.extend ?? 0.55;                     // extend the ends by this fraction of the radius
  const left = [], right = [];
  const zs = [];
  for (let i = 0; i < n; i++) {
    const a = screens[Math.max(0, i - 1)], b = screens[Math.min(n - 1, i + 1)];
    let dx = b.x - a.x, dy = b.y - a.y;
    let len = Math.hypot(dx, dy);
    // a segment pointing at the lens projects to nothing: fall back to the previous direction rather than dividing by 0
    if (len < 0.35) { dx = 0; dy = -1; len = 1; } else { dx /= len; dy /= len; }
    const rPx = Math.max(0.5, (radii[i] / Math.max(0.02, view[i].z)) * cam.focalPx);
    const ext = i === 0 || i === n - 1 ? rPx * extend : 0;
    const cx = screens[i].x + dx * (i === n - 1 ? ext : i === 0 ? -ext : 0);
    const cy = screens[i].y + dy * (i === n - 1 ? ext : i === 0 ? -ext : 0);
    left.push([cx - dy * rPx, cy + dx * rPx]);
    right.push([cx + dy * rPx, cy - dx * rPx]);
    zs.push(view[i].z);
  }
  if (o.caps !== false) {
    // rounded end caps: a projected disc at each end, so two tubes meeting at a joint never show a seam
    for (const [i, r] of [[0, radii[0]], [n - 1, radii[n - 1]]]) {
      disc(pts[i], r * 0.97, matId, { order: (o.order ?? 0) + 0.4, key: (o.key ?? 0) + 3 + i, rim: false, noHaze: o.noHaze });
    }
  }
  const outline = left.concat(right.reverse());
  const z = zs.reduce((s, v) => s + v, 0) / n;
  const center = pts[Math.floor(n / 2)];
  // light response from the axis normal across the tube: one side lit, one side in shade, and a single rim stroke
  const axis = vnorm(vsub(pts[n - 1], pts[0]));
  const side = vnorm(vcross(axis, LIGHT.sun.dir));
  const normal = vnorm(vcross(axis, side));
  const lit = surfaceColor(mat, normal, center, o.noHaze ? null : z);
  const rgb = cssRGB(lit, LIGHT.exposure, LIGHT.contrast);
  const key = o.key ?? 1234 + (SCENE.seq++);
  _op(z, (ctx) => {
    const path = polyPath(ctx, outline);
    ctx.fillStyle = cssOf(rgb, mat.alpha ?? 1);
    ctx.fill(path);
    if (o.shading !== false) paintSurface({ ctx, pts: outline, mat, rgb, key, pxPerM: cam.focalPx / z, litSun: 0.4 * LIGHT.sun.intensity, spec: 0, z, normal, center });
    // rim: the sun side of the tube catches a thin line of light. One stroke, not an outline all round.
    if (o.rim !== false) {
      const sunSide = vdot(vcross(axis, normal), LIGHT.sun.dir);
      const ptsRim = sunSide > 0 ? right : left;
      ctx.save();
      ctx.clip(path);
      ctx.strokeStyle = cssOf(cssRGB(cscale(cadd(LIGHT.sun.color, [0.3, 0.3, 0.3]), 0.5), LIGHT.exposure), 0.45);
      ctx.lineWidth = Math.max(1, cam.focalPx / z * 0.0035);
      ctx.beginPath();
      ctx.moveTo(ptsRim[0][0], ptsRim[0][1]);
      for (let i = 1; i < ptsRim.length; i++) ctx.lineTo(ptsRim[i][0], ptsRim[i][1]);
      ctx.stroke();
      ctx.restore();
    }
  }, o.layer ?? LAYER.GEO, o.order ?? 0);
  SCENE.stats.quads++;
}
// A filled disc at a world point (joints, hands, pebbles seen edge-on). Radius in metres; drawn as an ellipse so a disc
// seen at an angle is still a disc on screen.
function disc(p, radius, matId, o = {}) {
  const cam = SCENE.cam;
  const v = viewPoint(cam, p);
  if (!(v.z > NEAR)) return;
  const s = viewToScreen(cam, v);
  const rPx = (radius / v.z) * cam.focalPx;
  const mat = MAT[matId] || MAT.silhouette;
  const lin = surfaceColor(mat, vmul(cam.fwd, -1), p, o.noHaze ? null : v.z);
  const rgb = cssRGB(lin, LIGHT.exposure, LIGHT.contrast);
  _op(v.z, (ctx) => {
    ctx.fillStyle = cssOf(rgb, mat.alpha ?? 1);
    ctx.beginPath(); ctx.arc(s.x, s.y, Math.max(0.5, rPx), 0, TAU); ctx.fill();
  }, o.layer ?? LAYER.GEO, o.order ?? 0);
}

// A screen-space bitmap/sprite anchored to a world point (foliage clumps, grass tufts, dust, birds far away).
// drawFn(ctx, box) gets {x, y, w, h, z, scale}. box.w/h are the world size projected to pixels.
function billboard(pos, wMetres, hMetres, drawFn, o = {}) {
  const cam = SCENE.cam;
  const v = viewPoint(cam, pos);
  if (!(v.z > NEAR)) return;
  const s = viewToScreen(cam, v);
  const w = (wMetres / v.z) * cam.focalPx;
  const h = (hMetres / v.z) * cam.focalPx;
  if (!Number.isFinite(w) || !Number.isFinite(h)) return;
  const z = o.depth ?? v.z;
  _op(z, (ctx) => drawFn(ctx, { x: s.x, y: s.y, w, h, z: v.z, scale: cam.focalPx / v.z }), o.layer ?? LAYER.GEO, o.order ?? 0);
}

// A stroked 3D polyline (wire, branch edge, sparkline on a surface). Per-segment so depth is honest.
function line3(pts, color, widthPx, o = {}) {
  const cam = SCENE.cam;
  const pr = projectLine(cam, pts);
  for (let i = 0; i < pr.length - 1; i++) {
    const a = pr[i], b = pr[i + 1];
    if (!a || !b) continue;
    const z = (a[2] + b[2]) / 2;
    const w = o.worldWidth ? Math.max(0.5, (o.worldWidth / z) * cam.focalPx) : widthPx;
    _op(z, (ctx) => {
      ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }, o.layer ?? LAYER.GEO, o.order ?? 0);
  }
}

// The ground: one huge quad in front of the camera, near-clipped, drawn in the GROUND layer. Everything else sorts
// against it because its depth is pinned to the far plane rather than to its own geometry.
function ground(matId = 'grassGround', o = {}) {
  const cam = SCENE.cam;
  const y = o.y ?? 0;
  const R = o.radius ?? 260;
  const cx = cam.pos[0], cz = cam.pos[2];
  const pts = [[cx - R, y, cz - R], [cx + R, y, cz - R], [cx + R, y, cz + R], [cx - R, y, cz + R]];
  // The apex of the fog is the horizon; pin depth so the ground always draws behind standing geometry.
  const pr = projectPoly(cam, pts, 1e6);
  if (!pr) return;
  const normal = [0, 1, 0];
  // Shading for a huge plane: sample a point a few metres in front of the lens so the gradient is meaningful.
  const near = [cam.pos[0] + cam.fwd[0] * 3, 0, cam.pos[2] + cam.fwd[2] * 3];
  const lin = surfaceColor(MAT[matId], normal, near, 0);
  const rgb = cssRGB(lin, LIGHT.exposure, LIGHT.contrast);
  const key = o.key ?? 9001;
  _op(1e6, (ctx) => {
    // A ground quad is enormous and lit at grazing angles, so a depth-tinted vertical gradient reads better than one
    // flat fill. It is still one surface: the horizon is where it meets the sky, not a painted seam.
    const b = { y0: Math.min(...pr.pts.map((p) => p[1])), y1: Math.max(...pr.pts.map((p) => p[1])) };
    const horizon = cam.horizonY;
    const g = ctx.createLinearGradient(0, Math.min(horizon, b.y0), 0, b.y1);
    const farCol = cssRGB(hazeAt(cscale(MAT[matId].color, 0.96), 32), LIGHT.exposure, LIGHT.contrast);
    const midCol = cssRGB(hazeAt(cscale(MAT[matId].color, 1.0), 26), LIGHT.exposure, LIGHT.contrast);
    g.addColorStop(0, cssOf(farCol, 1));
    g.addColorStop(0.16, cssOf(cssRGB(hazeAt(cscale(MAT[matId].color, 1.0), 22), LIGHT.exposure, LIGHT.contrast), 1));
    g.addColorStop(0.44, cssOf(midCol, 1));
    g.addColorStop(0.78, cssOf(rgb, 1));
    g.addColorStop(1, cssOf(shadeRGB(rgb, 0.95), 1));
    ctx.fillStyle = g;
    ctx.fill(polyPath(ctx, pr.pts));
    paintSurface({ ctx, pts: pr.pts, mat: MAT[matId], rgb, key, pxPerM: cam.focalPx / 6, litSun: LIGHT.sun.intensity, spec: 0, z: 20, normal, center: near, cam, camHeight: cam.pos[1], focalPx: cam.focalPx, horizonY: cam.horizonY });
  }, LAYER.GROUND, o.order ?? 0);
}
// A ground shadow polygon (already projected onto the ground in world space) — soft, drawn in the SHADOW layer.
function shadow(pts3, strength = 0.45, o = {}) {
  const cam = SCENE.cam;
  const pr = projectPoly(cam, pts3, o.depth);
  if (!pr) return;
  _op(pr.z + (o.bias ?? 0), (ctx) => paintGroundShadow(ctx, pr.pts, strength, o.softness ?? 6), LAYER.SHADOW, o.order ?? 0);
}

// ---------- flush ----------
// Sort back to front and paint. If SCENE.dof is set, geometry is split into depth bands and blurred separately, then
// composited — a real focus pull requires blurring by distance, and banding is how a painter approximates a lens.
function sceneFlush(ctx, opts = {}) {
  const ops = SCENE.ops;
  ops.sort((a, b) => (a.layer - b.layer) || (b.z - a.z) || (a.order - b.order));
  const dof = SCENE.dof;
  if (!dof) {
    for (const op of ops) op.draw(ctx);
    SCENE.stats.ops = ops.length;
    return;
  }
  // Depth bands: each has a depth anchor and a blur radius in px. The bands are rendered at HALF resolution, blurred
  // there and scaled back up: a blurred image cannot show the difference, and it costs a quarter of the pixels.
  const bands = dof.bands;
  const bufs = dofBuffers(bands.length);
  for (const op of ops) {
    // ground and its shadows are one huge surface: blurring them by their pinned depth would blur the whole field, so
    // they stay in the sharp base pass and the depth bands carry only the objects standing on the ground.
    if (op.layer <= LAYER.SHADOW) { op.draw(ctx); continue; }
    let idx = 0;
    for (let i = 0; i < bands.length; i++) if (op.z >= bands[i].z) idx = i;
    op.draw(bufs[idx].ctx);
  }
  for (let i = 0; i < bands.length; i++) {
    const b = bands[i], buf = bufs[i];
    if (b.blur > 0.4) {
      const bc = buf.blurCtx;
      bc.setTransform(1, 0, 0, 1, 0, 0);
      bc.clearRect(0, 0, buf.w, buf.h);
      bc.filter = 'blur(' + (b.blur * 0.5).toFixed(2) + 'px)';
      bc.drawImage(buf.c, 0, 0);
      bc.filter = 'none';
      ctx.drawImage(buf.blur, 0, 0, W, H);
    } else {
      ctx.drawImage(buf.c, 0, 0, W, H);
    }
  }
  SCENE.stats.ops = ops.length;
  SCENE.dof = null;
}
// Half-resolution band buffers, allocated once and reused for every frame: allocating three 1080p canvases per frame is
// most of the cost of a focus pull.
let DOF_BUFS = null;
function dofBuffers(n) {
  if (DOF_BUFS && DOF_BUFS.length === n) return DOF_BUFS;
  DOF_BUFS = [];
  for (let i = 0; i < n; i++) {
    const w = Math.round(W / 2), h = Math.round(H / 2);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const blur = document.createElement('canvas'); blur.width = w; blur.height = h;
    const cctx = c.getContext('2d');
    cctx.setTransform(0.5, 0, 0, 0.5, 0, 0);       // ops draw in full-frame pixels
    DOF_BUFS.push({ c, w, h, ctx: cctx, blur, blurCtx: blur.getContext('2d') });
  }
  return DOF_BUFS;
}
// Set a focus pull for this frame: focus distance in metres, aperture f-number. Bands are placed around it.
function focusPull(focusMetres, aperture = 2.8) {
  const cam = SCENE.cam;
  const c = { ...cam, focus: focusMetres, aperture };
  const blur = (depth) => clamp(circleOfConfusion(c, depth) * 0.7, 0, 14);
  SCENE.dof = {
    focus: focusMetres,
    bands: [
      { z: 0, blur: blur(Math.max(0.4, focusMetres * 0.35)) },
      { z: focusMetres * 0.7, blur: blur(focusMetres) },
      { z: focusMetres * 1.6, blur: blur(focusMetres * 2.4) },
      { z: focusMetres * 4.0, blur: blur(focusMetres * 6.0) },
    ],
  };
}



