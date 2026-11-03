// engine/props.js - the things in the field, built from geometry, each with its own construction rules.
//
// A prop is a builder: given a placement (origin, yaw, scale) it declares world geometry. It is authored around its own
// origin at ground level, so "on the ground" is y = 0 for every prop, and a prop can be given to any shot as a single
// placement. Repeated props are defined once in src/world/props.js; their geometry (a tree's branch list) is generated
// once at boot from a seed, so it can never differ between shots.
'use strict';

// local point -> world point for a placement
const PW = (place, p) => localToWorld(place, p);
const _keyOf = (place, i) => (Math.floor(place.origin[0] * 13) + Math.floor(place.origin[2] * 7) * 31 + i * 977) >>> 0;

// ---------- grand piano -----------------------------------------------------
// Plan outline in local metres: the keyboard edge at +z, the curved tail at -z. Extruded into a case, with a lid
// opened on its left hinge, three legs, a key bed and (from above) the strings.
const PIANO_PLAN = [
  [-0.72, 0.95], [0.72, 0.95], [0.75, 0.30], [0.71, -0.22], [0.60, -0.66],
  [0.40, -0.92], [0.10, -1.03], [-0.28, -1.04], [-0.56, -0.94], [-0.70, -0.70], [-0.72, -0.30],
];
function buildPiano(place, o = {}) {
  const W = (p) => PW(place, p);
  const caseBot = 0.60, caseTop = 0.94;
  const key = _keyOf(place, 1);
  // case: extruded outline (sides + top + bottom)
  const top = PIANO_PLAN.map(([x, z]) => W([x, caseTop, z]));
  const bot = PIANO_PLAN.map(([x, z]) => W([x, caseBot, z]));
  // top: with the lid up, the open top shows the soundboard inside, with a lacquer rim around it
  poly3(top, 'woodPale', { key, order: 1 });
  for (let i = 0; i < PIANO_PLAN.length; i++) {
    const j = (i + 1) % PIANO_PLAN.length;
    const a = PIANO_PLAN[i], b = PIANO_PLAN[j];
    poly3([W([a[0], caseTop + 0.028, a[1]]), W([b[0], caseTop + 0.028, b[1]]), W([b[0], caseTop, b[1]]), W([a[0], caseTop, a[1]])], 'lacquer', { key: key + 300 + i, order: 1.4 });
  }
  // sides, one quad per outline edge, wound so the normal points outward
  for (let i = 0; i < PIANO_PLAN.length; i++) {
    const j = (i + 1) % PIANO_PLAN.length;
    poly3([top[i], top[j], bot[j], bot[i]], 'lacquerSide', { key: key + i + 2, order: 1 });
  }
  // lid: hinged on the left (x = -0.72) and propped open; a lid that ever changed angle between shots would be a
  // continuity error, so the angle is part of the prop definition.
  const lidAngle = (o.lidAngle ?? 34) * DEG;
  const hingeX = -0.72;
  const lid = PIANO_PLAN.map(([x, z]) => {
    const dx = x - hingeX;
    return W([hingeX + dx * Math.cos(lidAngle), caseTop + 0.012 + dx * Math.sin(lidAngle), z * 0.985 - 0.01]);
  });
  poly3(lid, o.lidMat || 'lacquer', { key: key + 40, order: 2 });
  // lid underside edge and prop stick
  poly3([W([hingeX, caseTop, 0.9]), W([hingeX, caseTop, -0.95]), lid[8], lid[0]], 'lacquer', { key: key + 41, order: 2 });
  const propTop = [hingeX + (0.62 - hingeX) * Math.cos(lidAngle), caseTop + 0.01 + (0.62 - hingeX) * Math.sin(lidAngle), -0.55];
  tube([W([0.62, caseTop - 0.05, -0.55]), W(propTop)], [0.012, 0.010], 'metalDark', { order: 3, key: key + 42 });
  // legs + casters
  const legs = [[-0.58, 0.60], [0.55, 0.52], [0.0, -0.72]];
  legs.forEach(([x, z], i) => {
    tube([W([x, 0.02, z]), W([x, caseBot * 0.55, z]), W([x, caseBot, z])], [0.032, 0.030, 0.042], 'wood', { order: 0, key: key + 50 + i });
    tube([W([x, 0.0, z]), W([x, 0.03, z])], [0.045, 0.045], 'metalDark', { order: 0, key: key + 60 + i });
  });
  // key bed: a slab in front of the case, with the keys themselves only drawn when the frame is close enough
  poly3([W([-0.68, 0.735, 0.95]), W([0.68, 0.735, 0.95]), W([0.68, 0.735, 1.20]), W([-0.66, 0.735, 1.20])], 'wood', { key: key + 70, order: 4 });
  poly3([W([-0.68, 0.735, 1.20]), W([0.68, 0.735, 1.20]), W([0.68, 0.715, 1.22]), W([-0.66, 0.715, 1.22])], 'wood', { key: key + 71, order: 4 });
  const cam = SCENE.cam;
  const zKey = viewPoint(cam, W([0, 0.75, 1.1])).z;
  if (cam.focalPx / Math.max(0.2, zKey) * 0.022 > 3) {
    // white keys: one surface with dark gaps drawn by the material-free key strip, then black keys on top
    poly3([W([-0.63, 0.742, 0.99]), W([0.63, 0.742, 0.99]), W([0.63, 0.742, 1.16]), W([-0.61, 0.742, 1.16])], 'ivory', { key: key + 72, order: 5 });
    const nKeys = 30;
    for (let i = 0; i < nKeys; i++) {
      const x0 = -0.62 + (i / nKeys) * 1.23, x1 = x0 + 1.23 / nKeys * 0.82;
      // every third pair gets a black key, as a real keyboard does (approximate but visually correct)
      if (i % 7 === 2 || i % 7 === 6) {
        poly3([W([x0 + 0.006, 0.746, 1.02]), W([x1 - 0.004, 0.746, 1.02]), W([x1 - 0.004, 0.746, 1.10]), W([x0 + 0.006, 0.746, 1.10])], 'lacquer', { key: key + 80 + i, order: 6 });
      }
    }
  }
  // music desk and the fallboard in front of the player
  poly3([W([-0.62, 0.96, 0.98]), W([0.62, 0.96, 0.98]), W([0.60, 1.20, 0.86]), W([-0.60, 1.20, 0.86])], 'lacquer', { key: key + 90, order: 5 });
  // strings, visible through the open lid from above
  const zStr = viewPoint(cam, W([0, 0.9, 0])).z;
  if (cam.focalPx / Math.max(0.2, zStr) * 0.01 > 2.2) {
    for (let i = 0; i < 7; i++) {
      const x = -0.5 + i * 0.16;
      line3([W([x, 0.905, 0.85]), W([x * 0.7, 0.905, -0.75])], 'rgba(212,206,190,0.55)', 1, { order: 3 });
    }
  }
  // pedals
  poly3([W([-0.14, 0.10, 1.16]), W([0.14, 0.10, 1.16]), W([0.14, 0.02, 1.20]), W([-0.14, 0.02, 1.20])], 'brass', { key: key + 100, order: 4 });
  return { caseTop, keyZ: 1.16, keyY: 0.742 };
}
// The key a note comes from: the world position of the contact point on the ivories.
function pianoKeyPoint(place, u = 0.42) {
  return PW(place, [-0.62 + u * 1.23, 0.746, 1.09]);
}

// ---------- house -----------------------------------------------------------
function buildHouse(place, o = {}) {
  const W = (p) => PW(place, p);
  const key = _keyOf(place, 2);
  const w = o.width ?? 8.6, d = o.depth ?? 6.4, h = o.height ?? 3.5;
  const hw = w / 2, hd = d / 2;
  // stone foundation
  box(W([0, 0.22, 0]), [w + 0.16, 0.44, d + 0.16], 'stone', { rotY: place.yaw * DEG, key: key + 1 });
  // walls (four slabs, roof-height to the eaves)
  const wallMat = o.wallMat || 'plaster';
  box(W([0, 0.44 + h / 2, -hd]), [w, h, 0.34], wallMat, { rotY: place.yaw * DEG, key: key + 2 });
  box(W([0, 0.44 + h / 2, hd]), [w, h, 0.34], wallMat, { rotY: place.yaw * DEG, key: key + 3 });
  box(W([-hw, 0.44 + h / 2, 0]), [0.34, h, d], wallMat, { rotY: place.yaw * DEG, key: key + 4 });
  box(W([hw, 0.44 + h / 2, 0]), [0.34, h, d], wallMat, { rotY: place.yaw * DEG, key: key + 5 });
  // gable roof: two panels meeting at the ridge, with a little overhang. Ridge along z.
  const eaveY = 0.44 + h, ridgeY = eaveY + (o.ridge ?? 2.0), over = 0.35;
  const roofMat = o.roofMat || 'roofSlate';
  const panelL = [W([-hw - over, eaveY - 0.05, -hd - over]), W([0, ridgeY, -hd - over]), W([0, ridgeY, hd + over]), W([-hw - over, eaveY - 0.05, hd + over])];
  const panelR = [W([0, ridgeY, -hd - over]), W([hw + over, eaveY - 0.05, -hd - over]), W([hw + over, eaveY - 0.05, hd + over]), W([0, ridgeY, hd + over])];
  poly3(panelL, roofMat, { key: key + 6, order: 1 });
  poly3(panelR, roofMat, { key: key + 7, order: 1 });
  // gable ends (triangles closing the roof)
  poly3([W([-hw, eaveY, -hd]), W([0, ridgeY, -hd]), W([hw, eaveY, -hd])], wallMat, { key: key + 8, order: 1 });
  poly3([W([hw, eaveY, hd]), W([0, ridgeY, hd]), W([-hw, eaveY, hd])], wallMat, { key: key + 9, order: 1 });
  // windows: two on the long face towards the camera, one boarded. Frames are wood, panes near-black glass.
  const winMat = o.winMat || 'glassDark';
  const windows = o.windows || [{ x: -2.3, y: 2.5, w: 1.05, h: 1.35, boarded: false }, { x: 1.9, y: 2.45, w: 1.05, h: 1.3, boarded: true }];
  windows.forEach((win, i) => {
    const zf = -hd - 0.18;      // just proud of the wall, facing the camera side
    const x0 = win.x - win.w / 2, x1 = win.x + win.w / 2, y0 = win.y - win.h / 2, y1 = win.y + win.h / 2;
    poly3([W([x0, y0, zf]), W([x1, y0, zf]), W([x1, y1, zf]), W([x0, y1, zf])], winMat, { key: key + 20 + i, order: 2 });
    // frame: four thin strips
    poly3([W([x0 - 0.07, y0 - 0.07, zf]), W([x1 + 0.07, y0 - 0.07, zf]), W([x1 + 0.07, y0, zf]), W([x0 - 0.07, y0, zf])], 'wood', { key: key + 22 + i, order: 3 });
    poly3([W([x0 - 0.07, y1, zf]), W([x1 + 0.07, y1, zf]), W([x1 + 0.07, y1 + 0.07, zf]), W([x0 - 0.07, y1 + 0.07, zf])], 'wood', { key: key + 24 + i, order: 3 });
    poly3([W([x0 - 0.07, y0, zf]), W([x0, y0, zf]), W([x0, y1, zf]), W([x0 - 0.07, y1, zf])], 'wood', { key: key + 26 + i, order: 3 });
    poly3([W([x1, y0, zf]), W([x1 + 0.07, y0, zf]), W([x1 + 0.07, y1, zf]), W([x1, y1, zf])], 'wood', { key: key + 28 + i, order: 3 });
    // a mullion
    poly3([W([win.x - 0.02, y0, zf - 0.01]), W([win.x + 0.02, y0, zf - 0.01]), W([win.x + 0.02, y1, zf - 0.01]), W([win.x - 0.02, y1, zf - 0.01])], 'wood', { key: key + 30 + i, order: 3 });
    if (win.boarded) {
      for (let b = 0; b < 3; b++) {
        const yy = y0 + 0.22 + b * 0.36;
        poly3([W([x0 - 0.04, yy, zf - 0.05]), W([x1 + 0.04, yy + 0.05, zf - 0.05]), W([x1 + 0.04, yy + 0.18, zf - 0.05]), W([x0 - 0.04, yy + 0.12, zf - 0.05])], 'wood', { key: key + 40 + i * 3 + b, order: 4 });
      }
    }
  });
  // door: a recess in the wall, dark, with a threshold
  const dx = o.doorX ?? 4.0;
  poly3([W([dx - 0.48, 0.44, -hd - 0.19]), W([dx + 0.48, 0.44, -hd - 0.19]), W([dx + 0.48, 2.55, -hd - 0.19]), W([dx - 0.48, 2.55, -hd - 0.19])], 'wood', { key: key + 60, order: 2 });
  poly3([W([dx - 0.40, 0.46, -hd - 0.22]), W([dx + 0.40, 0.46, -hd - 0.22]), W([dx + 0.40, 2.46, -hd - 0.22]), W([dx - 0.40, 2.46, -hd - 0.22])], 'glassDark', { key: key + 61, order: 2 });
  // chimney
  // the chimney's base must be inside the roof plane at its position, or it floats above the house
  const roofYAtChimney = ridgeY - (Math.min(hw, hw - 1.4) / (hw + over)) * (ridgeY - eaveY);
  box(W([hw - 1.4, roofYAtChimney + 0.45, 0.9]), [0.75, 1.7, 0.75], 'brick', { rotY: place.yaw * DEG, key: key + 70 });
  return { eaveY, ridgeY, hw, hd };
}

// ---------- tree ------------------------------------------------------------
// One deterministic branch list per tree, generated once. A tree that rearranged between shots is the defect this
// cached geometry exists to prevent.
function treeBranches(seed, o = {}) {
  const rnd = rngFrom(seed);
  const out = [];
  const lean = o.lean ?? 0.04;
  const trunkH = o.trunkH ?? 2.3;
  const trunkR = o.trunkR ?? 0.19;
  const maxLevel = o.levels ?? 4;
  // trunk, slightly leaning
  const tip = [Math.sin(lean) * trunkH, trunkH, 0];
  out.push({ a: [0, 0, 0], b: tip, r0: trunkR, r1: trunkR * 0.6, level: 0 });
  const grow = (base, dir, len, r, level) => {
    if (level > maxLevel || len < 0.14) return;
    const end = vadd(base, vmul(vnorm(dir), len));
    out.push({ a: base, b: end, r0: r, r1: r * 0.56, level });
    // two or three children per fork, spreading in distinct directions so the silhouette stays open, not a bundle
    const n = level >= 3 ? 2 : (rnd() < 0.45 ? 3 : 2);
    for (let i = 0; i < n; i++) {
      const spread = (0.55 + rnd() * 0.6) * (i % 2 ? 1 : -1);
      const yaw = (rnd() - 0.5) * 3.0;
      const d = vnorm([
        dir[0] + spread * 0.72 + Math.sin(yaw) * 0.55,
        Math.max(0.12, Math.abs(dir[1]) * (0.62 + rnd() * 0.25) - (level >= 2 ? 0.08 : 0)),
        dir[2] + spread * 0.35 + Math.cos(yaw) * 0.55,
      ]);
      grow(end, d, len * (0.62 + rnd() * 0.14), r * 0.56, level + 1);
    }
  };
  // three main limbs from the trunk top, plus two lower ones for a fuller silhouette
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU + 0.6;
    grow(tip, [Math.cos(a) * 0.72, 0.68, Math.sin(a) * 0.72], 1.45, trunkR * 0.58, 1);
  }
  for (let i = 0; i < 2; i++) {
    const a = (i / 2) * TAU + 2.2;
    grow(vlerp([0, 0, 0], tip, 0.66), [Math.cos(a) * 0.9, 0.45, Math.sin(a) * 0.9], 1.05, trunkR * 0.38, 2);
  }
  return out;
}
function buildTree(place, o = {}) {
  const key = _keyOf(place, 3);
  const branches = o.branches || treeBranches(o.seed ?? 7, o);
  branches.forEach((b, i) => {
    const a = PW(place, b.a), c = PW(place, b.b);
    const r0 = b.r0 * place.scale, r1 = b.r1 * place.scale;
    tube([a, vlerp(a, c, 0.55), c], [r0, (r0 + r1) / 2, r1], 'bark', { order: 0, key: key + i });
  });
  // foliage: small clumps at branch tips, dark against the sky. Restrained: a bare tree with a little leaf cover.
  const tips = branches.filter((b) => b.level >= 3).slice(0, o.leafClumps ?? 24);
  tips.forEach((b, i) => {
    const p = PW(place, b.b);
    const sway = o.sway ? o.sway(b.b, i) : 0;
    const size = (0.26 + hash01(key + i) * 0.22) * place.scale;
    billboard([p[0] + sway * 0.1, p[1] + 0.12, p[2]], size * 1.5, size, (ctx, bx) => {
      // A clump is a soft irregular mass, not a circle: an organic closed path plus a few darker leaf dabs inside it.
      const rnd = rngFrom(key + i * 31);
      const n = 13;
      ctx.beginPath();
      for (let k = 0; k < n; k++) {
        const a = (k / n) * TAU;
        const r = (0.34 + rnd() * 0.2) * Math.min(bx.w, bx.h) * 1.5;
        const x = bx.x + Math.cos(a) * r * 1.15, y = bx.y + Math.sin(a) * r * 0.78;
        if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      const g = ctx.createLinearGradient(bx.x, bx.y - bx.h * 0.5, bx.x, bx.y + bx.h * 0.5);
      g.addColorStop(0, 'rgba(74,78,52,0.86)');
      g.addColorStop(0.55, 'rgba(44,48,32,0.9)');
      g.addColorStop(1, 'rgba(26,30,20,0.92)');
      ctx.fillStyle = g;
      ctx.fill();
      for (let k = 0; k < 7; k++) {
        const x = bx.x + (rnd() - 0.5) * bx.w * 0.8, y = bx.y + (rnd() - 0.5) * bx.h * 0.6;
        ctx.fillStyle = `rgba(${20 + rnd() * 16 | 0},${24 + rnd() * 16 | 0},${16 + rnd() * 10 | 0},${0.35 + rnd() * 0.3})`;
        ctx.beginPath(); ctx.ellipse(x, y, bx.w * (0.06 + rnd() * 0.08), bx.h * (0.05 + rnd() * 0.07), rnd() * TAU, 0, TAU); ctx.fill();
      }
    }, { order: 2, depth: viewPoint(SCENE.cam, p).z });
  });
  return branches;
}

// ---------- stones ----------------------------------------------------------
function buildStones(place, o = {}) {
  const key = _keyOf(place, 4);
  const n = o.count ?? 5;
  const rnd = rngFrom(key);
  for (let i = 0; i < n; i++) {
    const x = (rnd() - 0.5) * (o.spread ?? 3.2), z = (rnd() - 0.5) * (o.spread ?? 2.2) + (o.offsetZ ?? 0);
    const s = (0.10 + rnd() * 0.20) * place.scale;
    const y = s * 0.42;
    box(PW(place, [x, y, z]), [s * 1.6, s * 0.9, s * 1.3], 'stone', { rotY: place.yaw * DEG + rnd() * TAU, key: key + i });
  }
}

// ---------- grass tufts -----------------------------------------------------
// A field needs a foreground layer that occludes boots and the piano's legs. These are world-anchored billboards with
// a wind phase from their position, so the field moves as one body of air rather than as independent sprites.
function buildTufts(place, o = {}) {
  const key = _keyOf(place, 5);
  const n = o.count ?? 46;
  const rnd = rngFrom(key);
  const cam = SCENE.cam;
  for (let i = 0; i < n; i++) {
    const x = (rnd() - 0.5) * (o.spreadX ?? 9), z = (rnd() - 0.5) * (o.spreadZ ?? 7) + (o.offsetZ ?? 0);
    const p = PW(place, [x, 0, z]);
    // only tufts inside the camera's forward arc are worth drawing
    if (viewPoint(cam, p).z < 0.4) continue;
    const h = 0.16 + rnd() * 0.22;
    const phase = hash01(key + i) * TAU;
    const sway = o.wind ? o.wind(p, phase) : 0;
    billboard(p, h * 0.75, h, (ctx, bx) => {
      const rr = rngFrom(key + i * 17);
      const blades = 7 + Math.floor(rr() * 6);
      const t = o.t ?? 0;
      for (let k = 0; k < blades; k++) {
        const ox = (rr() - 0.5) * bx.w * 0.8;
        const lean = sway * (0.5 + rr()) + (rr() - 0.5) * 0.1;
        const hh = bx.h * (0.55 + rr() * 0.6);
        const g = 58 + rr() * 46;
        ctx.strokeStyle = `rgba(${Math.round(g * 0.74)},${Math.round(g)},${Math.round(g * 0.6)},${0.5 + rr() * 0.4})`;
        ctx.lineWidth = Math.max(0.8, bx.w * 0.05);
        ctx.beginPath();
        ctx.moveTo(bx.x + ox, bx.y + bx.h * 0.42);
        ctx.quadraticCurveTo(bx.x + ox + lean * 0.4, bx.y, bx.x + ox + lean, bx.y - hh + bx.h * 0.4);
        ctx.stroke();
      }
    }, { order: 5, depth: viewPoint(cam, p).z });
  }
}

// ---------- candle ----------------------------------------------------------
// A small practical light: a body, a flame that is the only emissive surface in the film, and a registered point light
// so the things around it are actually lit by it.
function buildCandle(place, o = {}) {
  const key = _keyOf(place, 6);
  const W = (p) => PW(place, p);
  const h = o.height ?? 0.16;
  tube([W([0, 0, 0]), W([0, h * 0.5, 0]), W([0, h, 0])], [0.024, 0.023, 0.021], 'wax', { order: 2, key });
  // wick
  tube([W([0, h, 0]), W([0, h + 0.018, 0])], [0.0035, 0.003], 'lacquer', { order: 3, key: key + 1, rim: false });
  if (o.light !== false) lightPoint(W([0, h + 0.035, 0]), hexLin('#ffb066'), o.intensity ?? 0.35, 0.55);
  const flick = o.flicker ?? (t => 1 + Math.sin(t * 11.3) * 0.12 + Math.sin(t * 23.7) * 0.06);
  billboard(W([0, h + 0.055, 0]), 0.024, 0.05, (ctx, bx) => {
    const g = ctx.createRadialGradient(bx.x, bx.y, 0, bx.x, bx.y, bx.w * 1.4);
    g.addColorStop(0, 'rgba(255,246,220,0.95)');
    g.addColorStop(0.45, 'rgba(255,196,110,0.85)');
    g.addColorStop(1, 'rgba(255,150,60,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(bx.x, bx.y, bx.w * 0.8, bx.h * 0.9 * flick(SCENE.t || 0), 0, 0, TAU); ctx.fill();
  }, { order: 4 });
}








