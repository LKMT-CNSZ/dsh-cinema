// engine/camera.js - a real pinhole camera, and the moves a documentary camera makes.
//
// The camera is a position, a look-at target, a focal length in millimetres on a 36 mm sensor, a roll, a focus
// distance and an aperture. Everything the frame shows is that camera's projection of a metric world, so a dolly is a
// position moved towards a subject, a pan is a yaw change, and parallax between a foreground hand and a background
// house is not a trick - it is the geometry. No 2D "zoom", no fake depth.
'use strict';

const SENSOR_W = 36;          // full-frame width in mm; 16:9 crops the height
const NEAR = 0.04;            // near clip in metres

// Build a camera state. focus: distance in metres (default = distance to target). aperture: f-number (2.8 default).
function makeCamera(o) {
  const pos = o.pos.slice();
  const target = o.target.slice();
  const focalMM = o.focal ?? 35;
  const sensorMM = o.sensor ?? SENSOR_W;
  let fwd = vnorm(vsub(target, pos));
  const upWorld = [0, 1, 0];
  let right = vnorm(vcross(upWorld, fwd));
  let up = vnorm(vcross(fwd, right));
  const roll = o.roll ?? 0;
  if (roll) {
    const c = Math.cos(roll), s = Math.sin(roll);
    const r2 = vadd(vmul(right, c), vmul(up, s));
    const u2 = vsub(vmul(up, c), vmul(right, s));
    right = r2; up = u2;
  }
  const focalPx = (focalMM / sensorMM) * W;
  const distTarget = vlen(vsub(target, pos));
  const focus = o.focus ?? distTarget;
  return {
    pos, target, fwd, right, up,
    focalMM, sensorMM, focalPx, roll,
    focus, aperture: o.aperture ?? 2.8,
    pitch: Math.asin(clamp(fwd[1], -1, 1)), yaw: Math.atan2(fwd[0], fwd[2]),
    horizonY: H / 2 + focalPx * Math.tan(Math.asin(clamp(fwd[1], -1, 1))),
  };
}

// World point -> view space {x right, y up, z forward}. Behind the lens is z <= 0.
function viewPoint(cam, p) {
  const d = vsub(p, cam.pos);
  return { x: vdot(d, cam.right), y: vdot(d, cam.up), z: vdot(d, cam.fwd) };
}
function viewToScreen(cam, v) {
  return { x: W / 2 + (v.x / v.z) * cam.focalPx, y: H / 2 - (v.y / v.z) * cam.focalPx };
}
// Project one point. Returns null when it is behind the lens or too close to clip reliably.
function project(cam, p) {
  const v = viewPoint(cam, p);
  if (!(v.z > NEAR)) return null;
  const s = viewToScreen(cam, v);
  return { x: s.x, y: s.y, z: v.z };
}
// Screen pixel -> a world ray (origin on the lens, direction normalised). Used to place things on the ground in frame.
function worldRay(cam, sx, sy) {
  const dx = (sx - W / 2) / cam.focalPx;
  const dy = -(sy - H / 2) / cam.focalPx;
  const dir = vnorm(vadd(cam.fwd, vadd(vmul(cam.right, dx), vmul(cam.up, dy))));
  return { origin: cam.pos.slice(), dir };
}
// Where a screen pixel's ray meets the ground plane y = 0 (null when it looks at the sky).
function groundHit(cam, sx, sy) {
  const r = worldRay(cam, sx, sy);
  if (Math.abs(r.dir[1]) < 1e-5) return null;
  const k = -r.origin[1] / r.dir[1];
  if (k <= 0) return null;
  return [r.origin[0] + r.dir[0] * k, 0, r.origin[2] + r.dir[2] * k];
}

// ---- near-plane clipping ---------------------------------------------------
// Sutherland-Hodgman against z >= NEAR in view space. Without this, a wall or a piano lid the camera passes through
// projects to coordinates in the millions and the canvas draws nothing (or the page throws). Every polygon goes here.
function clipNearView(pts, near = NEAR) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const ina = a.z >= near, inb = b.z >= near;
    if (ina) out.push(a);
    if (ina !== inb) {
      const k = (near - a.z) / (b.z - a.z);
      out.push({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: near });
    }
  }
  return out;
}
// Project a 3D polygon to screen space, clipping first. Returns {pts:[[x,y]...], z: mean depth} or null.
function projectPoly(cam, pts3, depthOverride) {
  const view = new Array(pts3.length);
  let allNear = true, allFar = true;
  let zSum = 0;
  for (let i = 0; i < pts3.length; i++) {
    const v = viewPoint(cam, pts3[i]);
    view[i] = v;
    zSum += v.z;
    if (v.z < NEAR) allNear = false;
    if (v.z > NEAR) allFar = false;
  }
  let clipped = view;
  if (!allNear) {
    if (allFar) return null;             // entirely behind the lens
    clipped = clipNearView(view);
    if (clipped.length < 3) return null;
  }
  let zMean = 0, zMin = Infinity, zMax = -Infinity;
  const out = new Array(clipped.length);
  // A vertex on the near plane (z = 0.04) projects to focal * x / 0.04, which can be millions of pixels. Chrome then
  // tries to rasterise a path that wide and the page locks up - this is the single nastiest failure mode in the whole
  // engine, and it only shows up at particular camera positions (a ground quad grazing the lens). Clamping the screen
  // coordinates to a padded frame is invisible (everything outside the canvas is clipped anyway) and makes it impossible.
  const PADX = W * 4, PADY = H * 4;
  for (let i = 0; i < clipped.length; i++) {
    const v = clipped[i];
    const s = viewToScreen(cam, v);
    if (!Number.isFinite(s.x) || !Number.isFinite(s.y)) return null;
    out[i] = [clamp(s.x, -PADX, W + PADX), clamp(s.y, -PADY, H + PADY)];
    zMean += v.z; if (v.z < zMin) zMin = v.z; if (v.z > zMax) zMax = v.z;
  }
  zMean /= clipped.length;
  return { pts: out, z: depthOverride ?? zMean, zMin, zMax };
}
// Project a 3D polyline (no near clipping of interior points; segments crossing the lens are dropped).
function projectLine(cam, pts3) {
  const out = new Array(pts3.length);
  for (let i = 0; i < pts3.length; i++) {
    const v = viewPoint(cam, pts3[i]);
    if (!(v.z > NEAR)) { out[i] = null; continue; }
    const s = viewToScreen(cam, v);
    out[i] = [s.x, s.y, v.z];
  }
  return out;
}

// ---- camera language -------------------------------------------------------
// A camera move is a function of t that returns [pos, target, extras]. These are the moves this skill uses; each has
// to have a reason in the shot list, and the reason is written next to the call site in the shot file.
const CAM = {
  // Handheld breath: sub-centimetre, low-frequency, two noise channels. Documentary cameras are on tripods or
  // shoulders; a tripod still breathes. amp is in metres (0.001-0.006 for a locked-off shot, 0.012 for handheld).
  breath(t, amp = 0.003, seed = 1, speed = 0.35) {
    return [
      (noise1(t * speed, seed) - 0.5) * 2 * amp + (noise1(t * speed * 3.1, seed + 7) - 0.5) * amp * 0.35,
      (noise1(t * speed * 0.8, seed + 3) - 0.5) * 2 * amp * 0.6 + (noise1(t * speed * 2.4, seed + 11) - 0.5) * amp * 0.3,
      (noise1(t * speed * 0.6, seed + 5) - 0.5) * 2 * amp * 0.5,
    ];
  },
  // Eased interpolation of two camera states: the honest way to write a dolly/track/crane without re-deriving geometry.
  lerp(a, b, k) {
    return {
      pos: vlerp(a.pos, b.pos, k),
      target: vlerp(a.target, b.target, k),
      focal: lerp(a.focal ?? 35, b.focal ?? 35, k),
      focus: lerp(a.focus ?? 12, b.focus ?? 12, k),
      aperture: lerp(a.aperture ?? 2.8, b.aperture ?? 2.8, k),
      roll: lerp(a.roll ?? 0, b.roll ?? 0, k),
    };
  },
};
// Turn a camera description into the state the frame uses. Desc is a plain object; a function is called with t.
function readCamera(desc, t) {
  let c = typeof desc === 'function' ? desc(t) : desc;
  if (c.posFunc) c = { ...c, pos: c.posFunc(t) };
  return makeCamera({
    pos: c.pos, target: c.target, focal: c.focal, sensor: c.sensor, roll: c.roll || 0,
    focus: c.focus, aperture: c.aperture,
  });
}

// ---- depth of field --------------------------------------------------------
// Circle of confusion in screen pixels for a surface at `depth`, from the thin-lens formula (as a lens designer would
// compute it), scaled by the frame width. Used by the renderer to blur whole depth bands, never per pixel.
function circleOfConfusion(cam, depth) {
  const f = cam.focalMM, N = cam.aperture, focusMm = cam.focus * 1000, d = depth * 1000;
  if (focusMm <= 0 || d <= 0) return 0;
  const coc = (f * f * Math.abs(d - focusMm)) / (N * d * (focusMm - f) + 1e-6);
  // coc is in mm on the sensor; convert to pixels of the 1920-wide frame
  const px = (coc / SENSOR_W) * 1920;
  return clamp(px, 0, 42);
}
