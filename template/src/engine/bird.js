// engine/bird.js - one bird, one wing shape, kinematically folded.
//
// The regression case this module answers is "the wings look wrong". A wing is not a blob with a sine on it: it is two
// bones (humerus/forearm and hand) with a chord that tapers, folded by rotating those bones, with the primaries
// trailing. Flight is a flap cycle (downstroke drives, upstroke folds); a takeoff is a crouch, two power strokes and a
// climb; a landing is a flare, a stall and a step. The bird is defined once and only one of it exists in a film.
'use strict';

const BIRD = {
  bodyLen: 0.26, bodyW: 0.088, bodyH: 0.098,
  headR: 0.040, neckLen: 0.055,
  beakLen: 0.042,
  tailLen: 0.155, tailW: 0.072,
  wingInner: 0.155, wingOuter: 0.135,
  chord: 0.098,
  shoulder: [0.040, 0.032, 0.018],
};

// A wing as a closed outline in the bird's local space. side: +1 right, -1 left.
//   spread: 0 folded along the body, 1 fully extended
//   flap: roll of the inner bone (+ = raised)
//   sweep: yaw of the wing (+ = forward)
//   bend: extra fold at the wrist (upstroke)
function wingOutline(side, o) {
  const B = BIRD;
  const spread = o.spread ?? 1, flap = o.flap ?? 0, sweep = o.sweep ?? 0, bend = o.bend ?? 0;
  const sh = [B.shoulder[0] * side, B.shoulder[1], B.shoulder[2]];
  // Extending and folding: at spread 0 the bones lie along the body and point backwards; at spread 1 they are out.
  const outRoll = lerp(-1.25, flap, spread);            // folded hangs down the flank
  const outYaw = lerp(-1.35, sweep, spread);            // folded sweeps back
  const rot = (v, roll, yaw) => {
    // rotate about +z (roll, + raises a right-pointing bone) then about +y (yaw, + swings forward)
    const cR = Math.cos(roll), sR = Math.sin(roll), cY = Math.cos(yaw), sY = Math.sin(yaw);
    const x = v[0] * cR - v[1] * sR, y = v[0] * sR + v[1] * cR, z = v[2];
    return [x * cY + z * sY, y, -x * sY + z * cY];
  };
  const innerDir = rot([side, 0, 0], outRoll, outYaw);
  const elbow = vadd(sh, vmul(innerDir, B.wingInner * (0.55 + 0.45 * spread)));
  // the hand continues the wing, folding further on the upstroke and slightly forward on the downstroke
  const handRoll = outRoll + bend * 0.55;
  const handYaw = outYaw + bend * 0.35 - (1 - spread) * 0.5;
  const handDir = rot([side, 0, 0], handRoll, handYaw);
  const wristEnd = vadd(elbow, vmul(handDir, B.wingOuter));
  // chord (front to back of the wing) is horizontal-ish: rotate the backward vector by the same roll
  const chordAt = (roll) => {
    const c = Math.cos(roll), s = Math.sin(roll);
    // chord points backwards (-z) and droops with roll
    return [0.06 * side * Math.sin(roll), -0.10 * Math.abs(Math.sin(roll)) + 0.02, -1];
  };
  const chordRoot = vmul(vnorm(chordAt(outRoll)), B.chord * 0.95);
  const chordMid = vmul(vnorm(chordAt(outRoll * 0.8)), B.chord * 0.85);
  const chordTip = vmul(vnorm(chordAt(handRoll)), B.chord * 0.38);
  const lead = [sh, elbow, wristEnd];
  const trail = [vadd(sh, chordRoot), vadd(elbow, chordMid), vadd(wristEnd, chordTip)];
  // primaries: three short fingers fanning from the tip, so the wing tip is not a clean triangle
  const tipFan = [];
  for (let i = 0; i < 4; i++) {
    const t = i / 3;
    const base = vadd(wristEnd, vmul(chordTip, 0.25 + t * 0.7));
    const dir = vnorm(vadd(vmul(handDir, 0.7), vmul(vnorm(chordTip), 0.5 * (1 - t))));
    tipFan.push(vadd(base, vmul(dir, B.wingOuter * (0.36 - t * 0.14))));
  }
  // outline: leading edge out, primaries back, trailing edge in
  return [...lead, ...tipFan, trail[2], trail[1], trail[0]];
}

// Build every part of the bird in world space.
function birdParts(state) {
  const B = BIRD;
  const M = mat3mul(rotY((state.yaw || 0) * DEG), mat3mul(rotX((state.pitch || 0) * DEG), rotZ((state.roll || 0) * DEG)));
  const s = state.scale ?? 1;
  const T = (p) => vadd(state.pos, vmul(mat3apply(M, vmul(p, s)), 1));
  const body = [];
  // body: an ellipsoid approximated as a hull of points, slightly heavier at the breast
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU;
    body.push([Math.cos(a) * B.bodyW * 0.5, Math.sin(a) * B.bodyH * 0.52 + 0.004, 0.012]);
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    body.push([Math.cos(a) * B.bodyW * 0.42, Math.sin(a) * B.bodyH * 0.42, -0.085]);
  }
  body.push([0, 0.0, 0.128], [0, 0.0, -0.125]);
  // tail: a fan behind the body, tilted by tailAngle
  const tailTilt = (state.tail || 0) * DEG;
  const tailRoot = [0, 0.012, -0.118];
  const tailDir = [0, Math.sin(tailTilt) * 0.5, -1];
  const tailEnd = vadd(tailRoot, vmul(vnorm(tailDir), B.tailLen));
  const tailWide = vmul([1, 0, 0], B.tailW * 0.5);
  const tail = [vadd(tailRoot, tailWide), vadd(vadd(tailEnd, tailWide), [0, 0.006, 0]), vadd(vsub(tailEnd, tailWide), [0, 0.006, 0]), vsub(tailRoot, tailWide)];
  // head + beak, offset by the neck angles
  const headYaw = (state.headYaw || 0) * DEG, headPitch = (state.headPitch || 0) * DEG;
  const headBase = [0, 0.030, 0.098];
  const neckM = mat3mul(rotY(headYaw), rotX(headPitch));
  const headC = vadd(headBase, mat3apply(neckM, [0, 0.020, 0.052]));
  const beakTip = vadd(headC, mat3apply(neckM, [0, -0.004, B.headR + B.beakLen]));
  const beakRoot = vadd(headC, mat3apply(neckM, [0, -0.002, B.headR * 0.9]));
  const headPoly = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    headPoly.push(vadd(headC, vadd(vmul(mat3apply(neckM, [1, 0, 0]), Math.cos(a) * B.headR), vmul(mat3apply(neckM, [0, 1, 0]), Math.sin(a) * B.headR * 1.02))));
  }
  const wings = { L: wingOutline(-1, state.wing || {}), R: wingOutline(1, state.wing || {}) };
  const toWorld = (arr) => arr.map((p) => T(p));
  return {
    M, T,
    body: toWorld(body),
    tail: toWorld(tail),
    head: headPoly.map((p) => T(p)),
    beak: toWorld([beakRoot, beakTip]),
    wings: { L: toWorld(wings.L), R: toWorld(wings.R) },
    headC: T(headC), beakTip: T(beakTip),
    // QA: the wing's span must be the wing's span - a bird that changes size between shots is a bug
    span: vdist(T(wings.L[2]), T(wings.R[2])),
  };
}

function drawBird(state, opts = {}) {
  sceneTag('bird');
  const cam = SCENE.cam;
  const parts = birdParts(state);
  if (!Number.isFinite(parts.span) || parts.span <= 0) { QA.fail('bird degenerate', { span: parts.span }); return; }
  const order = opts.order || 0;
  const zOf = (arr) => {
    let z = 0;
    for (const p of arr) z += viewPoint(cam, p).z;
    return z / arr.length;
  };
  // wings first (far one behind the body), then tail, body, head, beak: a bird reads as a bird from its silhouette
  const zL = zOf(parts.wings.L), zR = zOf(parts.wings.R);
  const wingOrder = zL < zR ? ['R', 'L'] : ['L', 'R'];
  poly3(parts.wings[wingOrder[0]], 'silhouette', { key: 4101, order: order + 1 });
  poly3(parts.tail, 'silhouette', { key: 4102, order: order + 2 });
  poly3(parts.body, 'silhouette', { key: 4103, order: order + 3 });
  poly3(parts.wings[wingOrder[1]], 'silhouette', { key: 4104, order: order + 4 });
  poly3(parts.head, 'silhouette', { key: 4105, order: order + 5 });
  poly3([parts.beak[0], parts.beak[1], vadd(parts.beak[1], [0.004, -0.010, 0])], 'silhouette', { key: 4106, order: order + 6 });
  if (opts.eye !== false) {
    // one catchlight in the eye: the only specular a documentary silhouette bird is allowed
    const eye = birdParts(state).headC;
    const p = project(cam, vadd(eye, [0.012 * (state.yaw > 0 ? 1 : -1), 0.012, 0.028]));
    if (p) _op(p.z, (ctx) => {
      ctx.fillStyle = 'rgba(226,228,224,0.8)';
      ctx.beginPath(); ctx.arc(p.x, p.y, 1.4, 0, TAU); ctx.fill();
    }, 0, order + 7);
  }
  return parts;
}

// ---- motion ----------------------------------------------------------------
// A perched bird: folded wings, a head that turns in steps, a tail that flicks, and the whole body breathing.
function birdPerched(t, o = {}) {
  const seed = o.seed || 0;
  const turnKey = o.turns || [[0.0, 0], [1.6, 10], [2.4, -6], [4.0, 4]];
  let headYaw = 0;
  for (let i = 1; i < turnKey.length; i++) {
    if (t < turnKey[i][0]) {
      const [ta, va] = turnKey[i - 1], [tb, vb] = turnKey[i];
      headYaw = lerp(va, vb, smoothstep01((t - ta) / (tb - ta)));
      break;
    }
    headYaw = turnKey[turnKey.length - 1][1];
  }
  // head turns lead, body follows a beat later: the difference is what makes it read as a living bird
  const bodyYaw = headYaw * 0.28;
  const flick = Math.sin(t * 2.1 + seed) * 3 + spring(t, o.flickAt ?? 2.2, 9, 26) * 8;
  return {
    pos: o.pos || [0, 0.9, 0],
    yaw: (o.yaw || 0) + bodyYaw,
    pitch: -4 + Math.sin(t * 1.7 + seed) * 1.2,
    roll: 0,
    scale: o.scale ?? 1,
    tail: 2 + flick * 0.6,
    headYaw: headYaw * 0.8,
    headPitch: -6 + Math.sin(t * 0.9 + seed) * 2,
    wing: { spread: 0.06 + Math.max(0, flick) * 0.004, flap: -0.2, sweep: -0.2, bend: 0.1 },
  };
}
// Flight along a path function. flapHz is a real wingbeat rate (a crow is about 4 Hz).
function birdFlight(t, o) {
  const path = o.path;
  const t0 = o.t0 ?? 0;
  const pos = path(t);
  const dt = 0.02;
  const ahead = path(t + dt);
  const vel = vmul(vsub(ahead, pos), 1 / dt);
  const speed = vlen(vel);
  const nd = vnorm(vadd(vel, [0, 0, 1e-6]));
  const yaw = Math.atan2(nd[0], nd[2]) / DEG;
  const pitch = Math.asin(clamp(nd[1], -1, 1)) / DEG;
  const flapHz = o.flapHz ?? 4.1;
  const phase = (t - t0) * flapHz * TAU + (o.phase || 0);
  const amp = o.amp ?? 0.85;
  const flap = Math.sin(phase) * amp;                       // +1 = wings up
  const upstroke = Math.max(0, Math.cos(phase));            // folding happens on the upstroke
  const spread = clamp01((speed - (o.speedMin ?? 0.2)) / 1.4);
  return {
    pos, yaw, pitch: pitch * 0.9 + (o.pitchBias || 0), roll: -Math.sin(phase) * 6,
    scale: o.scale ?? 1,
    tail: 4 + Math.sin(phase) * 5,
    headYaw: (o.headYaw || 0) + Math.sin(t * 0.7) * 3,
    headPitch: -4,
    wing: { spread: 0.92 * spread + 0.08, flap: flap * 1.15, sweep: 0.12 + upstroke * 0.25, bend: upstroke * 0.7 },
    speed,
  };
}
// Takeoff: crouch, a push, two power strokes, then climb. Returns the flight state blended with the crouch.
function birdTakeoff(t, o) {
  const t0 = o.t0 ?? 0;
  const crouch = smoothstep(t0 - 0.42, t0 - 0.08, t);
  const push = smoothstep(t0 - 0.06, t0 + 0.10, t);
  const s = birdFlight(t, o);
  const bodyDrop = -0.03 * crouch * (1 - push) + 0.06 * Math.max(0, Math.sin(seg(t, t0, t0 + 0.4) * Math.PI)) * push;
  s.pos = vadd(s.pos, [0, bodyDrop, 0]);
  s.pitch += -12 * crouch * (1 - push) + 8 * push;
  // the first two strokes are deeper and slower
  const power = smoothstep(t0 - 0.05, t0 + 0.6, t) < 1 ? 1 : 0;
  s.wing.flap = (s.wing.flap || 0) * (1 + 0.35 * power);
  return s;
}
// Landing: approach, flare (wings wide and forward, body pitched up), stall, then a step and a settle.
function birdLanding(t, o) {
  const tLand = o.tLand ?? 0;
  const s = birdFlight(t, o);
  const flare = smoothstep(tLand - 0.55, tLand - 0.18, t) * (1 - smoothstep(tLand - 0.02, tLand + 0.25, t));
  s.pitch += flare * 16;
  s.wing.spread = Math.min(1, (s.wing.spread || 0) + flare * 0.2);
  s.wing.flap = (s.wing.flap || 0) * (1 - flare * 0.7) + flare * 0.5;
  s.wing.sweep = (s.wing.sweep || 0) + flare * 0.4;
  return s;
}
