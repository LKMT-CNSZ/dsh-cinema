// engine/layers.js - the 2.5D system: cut-out plates at fixed depths in the world.
//
// A plate is a flat plane facing the lens, anchored at a world point, drawn in its own 2D coordinates in METRES (+y up,
// origin at the anchor). Because the anchor is a world position and every point is projected through the same camera as
// the local-3D props, parallax and dolly work for free: push the camera forward and the near grass grows faster than the
// far treeline, exactly as real geometry does - but each plate is painted as a 2D artwork, so it can carry far more detail
// per pixel than a painted 3D box. That is the whole point of 2.5D: 2D drawing detail, 3D spatial behaviour.
//
// Draw bands (absolute renderer layers) decide occlusion, and they are declared per plate:
//   PLATE_LAYERS.far   -60   treeline, hills: behind everything
//   PLATE_LAYERS.field -36   the ground plane's painting (drawn before the 3D cast shadows at -30)
//   PLATE_LAYERS.mid   -16   a house, a wall: behind the local-3D subject
//   PLATE_LAYERS.near    6   things just in front of the subject
//   PLATE_LAYERS.fore   28   foreground grass: occludes legs and wheels
'use strict';

const PLATE_LAYERS = { far: -60, field: -36, mid: -16, near: 6, fore: 28 };
const PLATES = {};
let CUR_PLATE = null;

function definePlate(name, o) {
  if (PLATES[name]) throw new Error('plate already defined: ' + name);
  PLATES[name] = {
    name,
    at: o.at.slice(),
    layer: o.layer ?? PLATE_LAYERS.mid,
    scale: o.scale ?? 1,
    tilt: o.tilt ?? 0,          // degrees of lean away from the image plane
    yaw: o.yaw ?? 0,
    hazeK: o.hazeK ?? 1,
  };
  return PLATES[name];
}
const getPlate = (name) => {
  const p = PLATES[name];
  if (!p) throw new Error('no plate "' + name + '" - define it before a shot draws it');
  return p;
};
const PLATES_DECLARED = () => PLATES;

// Screen basis of a plate this frame: origin in pixels, and the pixel vectors for one plate metre right and up.
function plateBasis(p) {
  const cam = SCENE.cam;
  const a = p.at;
  const yawM = rotY(p.yaw * DEG);
  const tiltM = rotX(p.tilt * DEG);
  const rightW = mat3apply(yawM, [1, 0, 0]);
  const upW = mat3apply(yawM, mat3apply(tiltM, [0, 1, 0]));
  const v = viewPoint(cam, a);
  const depth = Math.max(0.45, v.z);   // a plate closer than this would blow the pixel scale up
  if (depth < 1.1) {
    // A plate almost at the lens is not a foreground any more: it is a mistake, and drawing it costs the frame.
    if (window.QA) QA.note('plate too close', { plate: p.name, depth: +depth.toFixed(2) });
    CUR_PLATE = null;
    throw new Error('plate ' + p.name + ' is ' + depth.toFixed(2) + ' m from the lens');
  }
  const s0 = viewToScreen(cam, v);
  const sR = viewToScreen(cam, viewPoint(cam, vadd(a, rightW)));
  const sU = viewToScreen(cam, viewPoint(cam, vadd(a, upW)));
  return {
    depth,
    k: (cam.focalPx / depth) * p.scale,
    ox: s0.x, oy: s0.y,
    rx: (sR.x - s0.x) * p.scale, ry: (sR.y - s0.y) * p.scale,
    ux: (sU.x - s0.x) * p.scale, uy: (sU.y - s0.y) * p.scale,
  };
}
// Plate metre coordinates -> screen pixel.
function plateToScreen(u, v) {
  const b = CUR_PLATE.basis;
  return [b.ox + u * b.rx + v * b.ux, b.oy + u * b.ry + v * b.uy];
}
function plateBegin(name) {
  const p = getPlate(name);
  budgetLayer(name);
  CUR_PLATE = { p, basis: plateBasis(p), order: 0 };
  // QA reads the plate geometry back: depth, scale and screen origin are what make parallax checkable
  SCENE.plates = SCENE.plates || {};
  SCENE.plates[name] = { depth: +CUR_PLATE.basis.depth.toFixed(3), k: +CUR_PLATE.basis.k.toFixed(2), ox: +CUR_PLATE.basis.ox.toFixed(2), oy: +CUR_PLATE.basis.oy.toFixed(2), layer: p.layer };
  return CUR_PLATE;
}
function plateEnd() { CUR_PLATE = null; }

// Illuminate a plate surface from its authored "how much key light does this face get" value. A flat plane has no normal
// to consult, so the artist states it; the rig still supplies colour, intensity and aerial perspective.
function plateLight(mat, shade, tone, depth, height, haze = 1) {
  const sun = cscale(LIGHT.sun.color, clamp(shade, 0, 2) * LIGHT.sun.intensity * 0.55);
  const hemi = cscale(cmix(LIGHT.sky.bounce, LIGHT.sky.up, 0.55), LIGHT.sky.intensity * 1.1);
  let c = [
    mat.color[0] * (sun[0] + hemi[0]),
    mat.color[1] * (sun[1] + hemi[1]),
    mat.color[2] * (sun[2] + hemi[2]),
  ];
  if (tone) c = warmShift(c, tone);
  return hazeAt(c, depth * haze, height);
}
// A filled shape in plate coordinates.
//   shade 0..1.6 how much key light this face receives (0 = turned away, 1 = facing the sun)
//   tone  -1..1  cool..warm
//   alpha, key, haze, tex (override the material's texture routine)
function plateFill(uv, matId, o = {}) {
  if (!CUR_PLATE) throw new Error('plateFill outside plateBegin/plateEnd');
  if (!uv || uv.length < 3) return null;
  const b = CUR_PLATE.basis;
  const pts = uv.map(([u, v]) => plateToScreen(u, v));
  const mat = MAT[matId] || MAT.concrete;
  budgetMaterial(matId);
  const lin = plateLight(mat, o.shade ?? 1, o.tone || 0, b.depth, b.oy ? CUR_PLATE.p.at[1] : 0, o.haze ?? 1);
  const rgb = cssRGB(lin, LIGHT.exposure, LIGHT.contrast);
  const key = o.key ?? ((Math.round(Math.abs(CUR_PLATE.p.at[2]) * 13) + CUR_PLATE.p.name.length * 7 + CUR_PLATE.order * 3) >>> 0);
  const layer = o.layer ?? CUR_PLATE.p.layer;
  const order = CUR_PLATE.order++;
  const plateRef = { at: CUR_PLATE.p.at.slice() };   // the closure runs at flush time, after plateEnd: capture what it needs
  _op(b.depth, (ctx) => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fillStyle = cssOf(rgb, (o.alpha ?? 1) * (mat.alpha ?? 1));
    ctx.fill();
    const texId = o.tex || mat.tex;
    if (texId && texId !== 'none') {
      paintSurface({
        ctx, pts, mat: { ...mat, tex: texId }, rgb, key,
        pxPerM: b.k, litSun: clamp(o.shade ?? 1, 0, 2) * LIGHT.sun.intensity, spec: 0,
        z: b.depth, normal: vmul(SCENE.cam.fwd, -1), center: plateRef.at, sunScreen: sunSideScreen(SCENE.cam),
      });
    }
  }, layer, order);
  const last = SCENE.ops[SCENE.ops.length - 1];
  if (last) { last.kind = 'plate'; last.tag = CUR_PLATE ? CUR_PLATE.p.name + '#' + order : '?'; }
  return pts;
}
// A stroked path in plate coordinates. width in metres of plate.
function plateLine(uv, matId, widthM = 0.02, o = {}) {
  if (!CUR_PLATE) throw new Error('plateLine outside plateBegin/plateEnd');
  if (!uv || uv.length < 2) return;
  const b = CUR_PLATE.basis;
  const pts = uv.map(([u, v]) => plateToScreen(u, v));
  const mat = MAT[matId] || MAT.silhouette;
  budgetMaterial(matId);
  const lin = plateLight(mat, o.shade ?? 1, o.tone || 0, b.depth, 0, o.haze ?? 1);
  const col = o.css || cssOf(cssRGB(lin, LIGHT.exposure, LIGHT.contrast), o.alpha ?? 1);
  const wpx = Math.max(0.6, widthM * b.k);
  const layer = o.layer ?? CUR_PLATE.p.layer;
  const order = CUR_PLATE.order++;
  _op(b.depth, (ctx) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = wpx;
    ctx.lineCap = o.cap || 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    if (o.close) ctx.closePath();
    ctx.stroke();
  }, layer, order);
  const last = SCENE.ops[SCENE.ops.length - 1];
  if (last) { last.kind = 'plate'; last.tag = CUR_PLATE ? CUR_PLATE.p.name + '#' + order : '?'; }
}
// A screen-space detail pass clipped to a plate polygon: marks that are easier to place in pixels but must stay inside
// the shape (leaf clusters, window mullions, grass tufts, door hardware).
function plateDetail(uv, fn, o = {}) {
  if (!CUR_PLATE) throw new Error('plateDetail outside plateBegin/plateEnd');
  const b = CUR_PLATE.basis;
  const pts = uv.map(([u, v]) => plateToScreen(u, v));
  const layer = o.layer ?? CUR_PLATE.p.layer;
  const order = CUR_PLATE.order++;
  _op(b.depth, (ctx) => {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.clip();
    fn(ctx, { pts, bbox: bboxOf(pts), k: b.k, depth: b.depth });
    ctx.restore();
  }, layer, order);
  const last = SCENE.ops[SCENE.ops.length - 1];
  if (last) { last.kind = 'plate'; last.tag = CUR_PLATE ? CUR_PLATE.p.name + '#' + order : '?'; }
  return pts;
}

// ---- authoring helpers -----------------------------------------------------------------------
// A rectangle whose top edge is very slightly irregular: a painted wall is not a CAD box.
function plateRect(u0, v0, u1, v1, jitter = 0.004) {
  const out = [[u0, v0], [u1, v0]];
  const n = 4;
  for (let i = n; i >= 0; i--) {
    const u = u0 + (u1 - u0) * (i / n);
    out.push([u, v1 + (noise1(u * 4.7 + v1 * 3.1, 9) - 0.5) * Math.abs(v1 - v0) * jitter]);
  }
  return out;
}
const plateEllipse = (cu, cv, ru, rv, n = 26, wobble = 0) => {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const w = 1 + (wobble ? (noise1(i * 1.7 + cu * 3, 3) - 0.5) * 2 * wobble : 0);
    out.push([cu + Math.cos(a) * ru * w, cv + Math.sin(a) * rv * w]);
  }
  return out;
};
// A ridge / treeline / hill silhouette: a varying top edge over a flat bottom.
function plateRidge(u0, u1, baseV, heightFn, n = 72) {
  const out = [[u1, baseV], [u0, baseV]];
  for (let i = 0; i <= n; i++) {
    const u = u0 + (u1 - u0) * (i / n);
    out.push([u, baseV + Math.max(0, heightFn(u, i / n))]);
  }
  return out;
}
// Where a plate metre lands on screen this frame (for placing a 3D object against a plate, or a crop point).
function plateScreen(name, u, v) {
  const p = getPlate(name);
  const b = plateBasis(p);
  return [b.ox + u * b.rx + v * b.ux, b.oy + u * b.ry + v * b.uy];
}
const platePxPerM = () => (CUR_PLATE ? CUR_PLATE.basis.k : 100);
const plateDepth = (name) => plateBasis(getPlate(name)).depth;
