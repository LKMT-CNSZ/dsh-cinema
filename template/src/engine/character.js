// engine/character.js - a real skeleton, solved by IK, drawn as a figure.
//
// The figure is not a shape that slides across the frame. It is eleven joint positions solved every frame from a pose:
// a spine chain (hips -> waist -> chest -> neck -> head) posed by rotation, two legs solved by two-bone IK onto ankle
// targets, two arms solved by IK onto wrist targets, feet built from the ankle out, hands only detailed when the shot is
// close enough for fingers to be larger than a pixel.
//
// Why IK targets rather than x/y interpolation: a foot target that stays world-fixed during stance IS foot locking; a
// hand target that stops at a key IS contact; a hip height that follows the pelvis curve IS weight. Bones keep their
// length by construction, so a character can never change proportions between shots - QA asserts it as well.
'use strict';

// One person's proportions, in metres. These numbers are the character: change them once, every shot follows.
const PROPORTIONS = {
  hipCenterY: 0.92,        // pelvis centre above the ground when standing at ease
  hipW: 0.088,             // hip joint offset from the pelvis centre
  hipDrop: 0.035,
  spineHipWaist: 0.10,
  spineWaistChest: 0.18,
  spineChestShoulder: 0.19,
  shoulderW: 0.163,
  shoulderDrop: 0.025,
  neckLen: 0.075,
  headR: 0.093,
  upperArm: 0.285,
  forearm: 0.255,
  handLen: 0.175,          // wrist to fingertip
  handW: 0.072,
  thigh: 0.42,
  shin: 0.415,
  ankleH: 0.075,
  footLen: 0.235,
  heelBack: 0.055,
  coatTopY: 1.34,          // world-relative offset handled in render (local from hips)
  coatHemY: 0.46,          // hem height above the ground (mid-calf)
  coatHalfWidth: 0.225,
  coatShoulderHalfWidth: 0.175,
  hairLen: 0.20,
};

// Allocate a pose with every field the solver reads. Shot code spreads over this; it never has to list all fields.
function basePose(o = {}) {
  return {
    root: [0, PROPORTIONS.hipCenterY, 0],
    yaw: 0,
    hipsPitch: 0, hipsRoll: 0, hipsYaw: 0,
    waistFwd: 0, waistSide: 0,
    chestFwd: 0, chestTwist: 0, chestSide: 0,
    neckFwd: 0,
    headYaw: 0, headLook: 0, headTilt: 0,
    feet: null,            // {L:{pos,yaw,pitch}, R:{...}}  pos = ankle world position
    hands: null,           // {L:{pos,pole}, R:{...}}      pos = wrist world position
    armHang: 6,            // degrees of elbow bend when an arm has no IK target
    kneeOut: 0.035,
    elbowOut: 0.04,
    breathe: 1,
    coatLift: 0,
    ...o,
  };
}
// Default foot targets for a standing pose, in world space, derived from the root and facing.
function standFeet(pose, stance = 0.055, stagger = 0) {
  const yaw = pose.yaw * DEG;
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const at = (dx, dz) => [pose.root[0] + dx * c + dz * s, PROPORTIONS.ankleH, pose.root[2] - dx * s + dz * c];
  return {
    L: { pos: at(-stance, -stagger * 0.5), yaw: pose.yaw, pitch: 0 },
    R: { pos: at(stance, stagger * 0.5), yaw: pose.yaw, pitch: 0 },
  };
}

// ---- two-bone IK -----------------------------------------------------------
// Solve a joint between a root and a target so both bones keep their length. The pole decides which way the joint
// bends: a knee forward, an elbow back/out. Returns the joint position, or a straight-line fallback when out of reach.
function solveTwoBone(root, target, lenA, lenB, pole) {
  const d = vsub(target, root);
  let dist = vlen(d);
  if (!Number.isFinite(dist) || dist < 1e-5) dist = 1e-5;
  const maxReach = (lenA + lenB) * 0.9995;
  const minReach = Math.abs(lenA - lenB) + 0.01;
  const clamped = clamp(dist, minReach, maxReach);
  const dir = vmul(d, 1 / dist);
  const targetC = vadd(root, vmul(dir, clamped));
  // cosine rule for the angle between the root-target line and the first bone
  const cosA = clamp((lenA * lenA + clamped * clamped - lenB * lenB) / (2 * lenA * clamped), -1, 1);
  const a = Math.acos(cosA);
  // bend plane: contains the pole direction, perpendicular to the bone chain
  let p = vsub(pole, vmul(dir, vdot(pole, dir)));
  if (vlen(p) < 1e-6) p = [0, 0, 1];
  p = vnorm(p);
  const joint = vadd(root, vadd(vmul(dir, Math.cos(a) * lenA), vmul(p, Math.sin(a) * lenA)));
  return { joint, end: targetC, reach: clamped / (lenA + lenB), overflow: dist - maxReach };
}

// ---- the skeleton ----------------------------------------------------------
// Solve every joint of a pose into world positions. Returns joints plus the orientations the renderer needs.
function solveSkeleton(pose) {
  const P = PROPORTIONS;
  const yawM = rotY(pose.yaw * DEG);
  const hipsM = mat3mul(yawM, mat3mul(rotX(-pose.hipsPitch * DEG), mat3mul(rotY(pose.hipsYaw * DEG), rotZ(pose.hipsRoll * DEG))));
  const hips = pose.root.slice();
  const waist = vadd(hips, mat3apply(hipsM, [0, P.spineHipWaist, 0]));
  const waistM = mat3mul(hipsM, mat3mul(rotX(-pose.waistFwd * DEG), rotZ(pose.waistSide * DEG)));
  const chest = vadd(waist, mat3apply(waistM, [0, P.spineWaistChest, 0]));
  const chestM = mat3mul(waistM, mat3mul(rotX(-pose.chestFwd * DEG), mat3mul(rotY(pose.chestTwist * DEG), rotZ(pose.chestSide * DEG))));
  const neckBase = vadd(chest, mat3apply(chestM, [0, P.spineChestShoulder, 0]));
  const neckM = mat3mul(chestM, rotX(-pose.neckFwd * DEG));
  const headBase = vadd(neckBase, mat3apply(neckM, [0, P.neckLen, 0]));
  const headM = mat3mul(neckM, mat3mul(rotY(pose.headYaw * DEG), mat3mul(rotX(pose.headLook * DEG), rotZ(pose.headTilt * DEG))));
  const headCenter = vadd(headBase, mat3apply(headM, [0, P.headR * 0.92, 0]));

  const shoulderL = vadd(neckBase, mat3apply(chestM, [-P.shoulderW, -P.shoulderDrop, 0]));
  const shoulderR = vadd(neckBase, mat3apply(chestM, [P.shoulderW, -P.shoulderDrop, 0]));
  const hipL = vadd(hips, mat3apply(hipsM, [-P.hipW, -P.hipDrop, 0]));
  const hipR = vadd(hips, mat3apply(hipsM, [P.hipW, -P.hipDrop, 0]));

  // legs: ankle targets drive both knees. Pole is forward + slightly outward, which is how knees actually bend.
  const feet = pose.feet || standFeet(pose);
  const fwd = mat3apply(yawM, [0, 0, 1]);
  const legL = solveTwoBone(hipL, feet.L.pos, P.thigh, P.shin, vadd(fwd, [-pose.kneeOut, 0, 0]));
  const legR = solveTwoBone(hipR, feet.R.pos, P.thigh, P.shin, vadd(fwd, [pose.kneeOut, 0, 0]));

  // feet: from the ankle to the toe, with a pitch that rolls the foot over the ball when it leaves the ground
  const footGeom = (ankle, spec) => {
    const fm = mat3mul(rotY(spec.yaw * DEG), rotX((spec.pitch || 0) * DEG));
    const toe = vadd(ankle, mat3apply(fm, [0, -P.ankleH * 0.86, P.footLen * 0.72]));
    const heel = vadd(ankle, mat3apply(fm, [0, -P.ankleH * 0.55, -P.heelBack]));
    const ball = vadd(ankle, mat3apply(fm, [0, -P.ankleH * 0.9, P.footLen * 0.42]));
    return { ankle, toe, heel, ball };
  };

  // arms: IK to the wrist, or a natural hang when the shot gives no target
  const hands = pose.hands || {};
  const armOf = (side, shoulder) => {
    const target = hands[side];
    if (target && target.pos) {
      const pole = target.pole || vadd(mat3apply(yawM, [side === 'L' ? -0.5 : 0.5, 0, -1]), [0, 0, 0]);
      return solveTwoBone(shoulder, target.pos, P.upperArm, P.forearm, pole);
    }
    // hanging arm: elbow bends forward and slightly out, and the forearm has its real length (a unit vector here made a
    // metre-long forearm, i.e. hands at her knees - the kind of error a screenshot catches immediately)
    const dir = vnorm(vadd(mat3apply(yawM, [0, -1, 0]), mat3apply(yawM, [side === 'L' ? -0.09 : 0.09, 0, 0.04])));
    const elbow = vadd(shoulder, vmul(dir, P.upperArm));
    const wrist = vadd(elbow, vmul(vnorm(vadd(dir, mat3apply(yawM, [0, 0, 0.26]))), P.forearm));
    return { joint: elbow, end: wrist, reach: 1 };
  };
  const armL = armOf('L', shoulderL), armR = armOf('R', shoulderR);
  // hand direction: continue the forearm, then bend towards the palm normal a little
  const handOf = (arm, side) => {
    const dir = vnorm(vsub(arm.end, arm.joint));
    const tip = vadd(arm.end, vmul(dir, P.handLen));
    const sideDir = vnorm(vcross(dir, mat3apply(yawM, [0, 0, side === 'L' ? -1 : 1])));
    return { wrist: arm.end, dir, tip, side: sideDir };
  };

  return {
    pose, yawM, hipsM, waistM, chestM, neckM, headM,
    hips, waist, chest, neckBase, headBase, headCenter,
    shoulderL, shoulderR, hipL, hipR,
    kneeL: legL.joint, kneeR: legR.joint, ankleL: legL.end, ankleR: legR.end,
    legL, legR,
    elbowL: armL.joint, elbowR: armR.joint, wristL: armL.end, wristR: armR.end,
    footL: footGeom(legL.end, feet.L), footR: footGeom(legR.end, feet.R),
    handL: handOf(armL, 'L'), handR: handOf(armR, 'R'),
    reachWarn: Math.max(0, legL.overflow, legR.overflow),
  };
}
// Rest lengths, for QA: a figure that keeps its proportions has these distances at every t.
function restLengths() {
  const P = PROPORTIONS;
  return {
    'hipL-kneeL': P.thigh, 'kneeL-ankleL': P.shin, 'hipR-kneeR': P.thigh, 'kneeR-ankleR': P.shin,
    'shoulderL-elbowL': P.upperArm, 'elbowL-wristL': P.forearm,
    'shoulderR-elbowR': P.upperArm, 'elbowR-wristR': P.forearm,
    'hips-chest': P.spineHipWaist + P.spineWaistChest,
    'chest-neckBase': P.spineChestShoulder,
  };
}

// ---- motion ----------------------------------------------------------------
// Breathing and weight shift. Documentary people are never frozen, but nothing should "act" either: sub-centimetre
// drift, a breath every four seconds, a head that settles. Everything is a smooth function of t.
function idlePose(t, o = {}) {
  const breath = Math.sin((t / 4.2) * TAU + (o.seed || 0) * 1.7);
  const sway = Math.sin((t / 9.5) * TAU + (o.seed || 0) * 2.3);
  const micro = noise1(t * 0.6, 11 + (o.seed || 0) * 7) - 0.5;
  const p = basePose(o.base || {});
  p.root[1] = (o.base?.root?.[1] ?? PROPORTIONS.hipCenterY) + breath * 0.0035;
  p.hipsRoll = (p.hipsRoll || 0) + sway * 0.5;
  p.chestFwd = (p.chestFwd || 0) + breath * 0.9 + micro * 0.4;
  p.waistSide = (p.waistSide || 0) + sway * 0.7;
  p.headYaw = (p.headYaw || 0) + micro * 1.6;
  p.headLook = (p.headLook || 0) + (o.headLook || 0) + Math.sin(t * 0.31 + 1.3) * 0.35;
  if (!p.feet) p.feet = standFeet(p, o.stance ?? 0.062, o.stagger || 0);
  return p;
}
// Where the pelvis is while walking: two bobs per stride (highest at mid-stance), one side-to-side sway per stride.
const walkBob = (phase) => -Math.abs(Math.sin(phase * Math.PI)) * 0.022;
const walkSway = (phase) => Math.sin(phase * TAU) * 0.017;

// A gait: for a travelled distance s, each foot alternates stance (world-locked) and swing.
//   duty = fraction of the cycle spent on the ground (0.62 is a walk, 0.5 a run)
//   stride = metres per cycle
// Returns {L:{pos,yaw,pitch,plant}, R:{...}, phase, bob}
function gait(s, o) {
  const P = PROPORTIONS;
  const stride = o.stride || 1.42;
  const duty = o.duty || 0.62;
  const yawRad = (o.yaw || 0) * DEG;
  const c = Math.cos(yawRad), sn = Math.sin(yawRad);
  const pathAt = o.path;                          // pathAt(distance) -> [x,z]
  const lateral = o.stance ?? 0.055;
  const foot = (offsetCycles, sideSign) => {
    const phi = s / stride + offsetCycles;
    const n = Math.floor(phi), k = phi - n;
    // The foot lands HALF A STANCE SWEEP AHEAD of the hip, not under it: that is the difference between a walk and a
    // shuffle, and it is what keeps the leg from being dragged straight behind the body by the end of stance.
    const sweep = stride * duty;
    const sLand = (n - offsetCycles) * stride + sweep * 0.5;
    const sNext = sLand + stride;
    const land = pathAt(sLand), next = pathAt(sNext);
    // lateral offset perpendicular to the direction of travel, so feet stay under the hips instead of in front of them
    const lx = c * lateral * sideSign, lz = -sn * lateral * sideSign;
    if (k < duty) {
      // stance: the foot does not move. This is foot locking, and it is why a walk does not slide.
      const q = k / duty;
      // the heel lifts through the last third of stance (the ankle rises, the heel pitches up): without this the leg
      // would have to be longer than it is to stay on the ground at the end of the step
      const push = smoothstep01(clamp01((q - 0.58) / 0.42));
      const pos = [land[0] + lx, P.ankleH + push * 0.085, land[1] + lz];
      // heel strike rolls the foot: toe up at the start, toe down and pushing off at the end
      const pitch = lerp(-7, 30, q * q);
      return { pos, yaw: o.yaw, pitch, plant: 1, k, swinging: false };
    }
    // swing: ankle travels from the old plant to the new one on an arc, with the toe lifting first
    const q = (k - duty) / (1 - duty);
    const e = easeInOutCubic(q);
    const pos = [lerp(land[0], next[0], e) + lx, P.ankleH + Math.sin(Math.PI * q) * (o.lift ?? 0.085) + 0.045 * (1 - q), lerp(land[1], next[1], e) + lz];
    const pitch = lerp(30, -7, easeInOutCubic(clamp01(q * 1.2)));
    return { pos, yaw: o.yaw, pitch, plant: 0, k, swinging: true };
  };
  const L = foot(0, -1), R = foot(0.5, 1);
  const phase = s / stride;
  const bob = -Math.abs(Math.sin(phase * Math.PI)) * 0.019;
  const sway = Math.sin(phase * TAU) * 0.016;
  return { L, R, phase, bob, sway };
}

// A whole walking pose for a straight path from A to B, with the timing profile the shot asks for.
// o: {start, end, from:[x,z], to:[x,z], yaw, stride, duty, turnTo (deg), armSwing}
function walkPose(t, o) {
  const P = PROPORTIONS;
  const k = seg(t, o.start, o.end);
  const e = (o.ease || smoothstep01)(k);
  const pathLen = Math.hypot(o.to[0] - o.from[0], o.to[1] - o.from[1]);
  const s = e * pathLen;
  const yaw = o.yaw ?? 0;
  const yawRad = yaw * DEG;
  const c = Math.cos(yawRad), sn = Math.sin(yawRad);
  // yaw 0 faces +Z, so d metres along the path is from + d * (sin yaw, cos yaw). (Getting this backwards is how a walk
  // ends up three metres from where it was aimed, with the feet left behind.)
  const pathAt = (d) => [o.from[0] + sn * d, o.from[1] + c * d];
  const g = gait(s, { stride: o.stride || 1.42, duty: o.duty || 0.62, yaw, path: (d) => pathAt(clamp(d, -stridePad(pathLen), pathLen + stridePad(pathLen))), stance: o.stance, lift: o.lift });
  const rootXZ = pathAt(s);
  // Pelvis height from leg reach, not from a bob curve: the body lowers exactly as far as the furthest foot requires, so
  // a leg can never be pulled off the ground by its own stride. This is also where a walk's natural bob comes from.
  const legLen = (P.thigh + P.shin) * 0.975;
  const reachOf = (foot) => Math.hypot(foot.pos[0] - rootXZ[0], foot.pos[2] - rootXZ[1]);
  const dH = Math.max(reachOf(g.L), reachOf(g.R));
  const maxVert = Math.sqrt(Math.max(0.05, legLen * legLen - dH * dH));
  const hipY = P.ankleH + maxVert + 0.004;
  const p = basePose(o.base || {});
  p.yaw = yaw;
  // the pelvis sits one hip-drop above the hip joint's reach-limited height
  p.root = [rootXZ[0] + g.sway * -sn, hipY + P.hipDrop, rootXZ[1] + g.sway * c];
  p.feet = { L: { pos: g.L.pos, yaw: g.L.yaw, pitch: g.L.pitch }, R: { pos: g.R.pos, yaw: g.R.yaw, pitch: g.R.pitch } };
  // pelvis counter-rotates against the shoulders; the arms swing opposite the legs and lag them slightly
  const ph = g.phase;
  p.hipsYaw = Math.sin(ph * TAU) * 4.5;
  p.chestTwist = -Math.sin(ph * TAU) * 6.5;
  p.hipsRoll = Math.sin(ph * TAU) * 2.2;
  p.chestFwd = 3.2 + Math.sin(ph * TAU * 2) * 0.6;
  p.waistFwd = 1.5;
  p.headYaw = Math.sin(ph * TAU + 0.9) * 2.2 + (o.headYaw || 0);
  p.headLook = (o.headLook ?? 2);
  // arms: the right arm swings forward when the left leg leads. Amplitude is weight-dependent; 15 deg is a walk.
  const swing = o.armSwing ?? 19;
  const shoulderY = p.root[1] + neckHeight() - P.shoulderDrop;
  const armTarget = (side) => {
    const sign = side === 'L' ? -1 : 1;
    const shoulder = vadd([p.root[0], shoulderY, p.root[2]], mat3apply(rotY(yawRad), [sign * P.shoulderW, 0, 0]));
    const fwd = Math.sin(ph * TAU + (side === 'L' ? Math.PI : 0)) * swing;
    const dir = mat3apply(rotY(yawRad), mat3apply(rotX(-fwd * DEG), [sign * 0.07, -1, 0]));
    const wrist = vadd(shoulder, vmul(vnorm(dir), P.upperArm + P.forearm - 0.055));
    return { pos: wrist, pole: mat3apply(rotY(yawRad), [sign * 0.45, -0.25, -0.86]) };
  };
  if (o.arms !== false) p.hands = { L: armTarget('L'), R: armTarget('R') };
  return p;
}
function stridePad(len) { return Math.max(4, len); }
function neckHeight() { return PROPORTIONS.spineHipWaist + PROPORTIONS.spineWaistChest + PROPORTIONS.spineChestShoulder; }

// Point the head at a world target, with the neck taking part of the turn (and lagging the chest: see lookLag).
function lookAt(p, target, weight = 1) {
  const from = [p.root[0], p.root[1] + neckHeight() + PROPORTIONS.neckLen, p.root[2]];
  const d = vsub(target, from);
  const yawTo = Math.atan2(d[0], d[2]) / DEG - p.yaw;
  const lookTo = -Math.atan2(d[1], Math.hypot(d[0], d[2])) / DEG;
  const wrap = (a) => ((a + 540) % 360) - 180;
  p.headYaw = wrap(yawTo * 0.72 * weight) + (p.headYaw || 0) * 0.3;
  p.headLook = p.headLook * (1 - 0.7 * weight) + lookTo * 0.6 * weight;
  p.neckFwd = lookTo * 0.18 * weight;
  return p;
}


// ---- rendering -------------------------------------------------------------
// A figure is drawn as overlapping capsules and hulled masses in one material, in anatomical order: far arm, far leg,
// coat, torso, head, near leg, near arm. Because the colour is uniform, a joint is only visible as the place where two
// capsules overlap - and they overlap by construction (each tube extends past its joint and ends in a disc).
function hull2d(pts) {
  const P = pts.slice().sort((a, b) => (a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]));
  if (P.length < 3) return P;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const p of P) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  for (let i = P.length - 1; i >= 0; i--) {
    const p = P[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  upper.pop(); lower.pop();
  return lower.concat(upper);
}
// Which way the sun is on screen: +1 right, -1 left. Rim lights and cloth shading both need this.
function sunSideScreen(cam) {
  return vdot(LIGHT.sun.dir, cam.right) >= 0 ? 1 : -1;
}
// A limb: a tapered capsule with rounded ends. Caps overlap the joints so a bent elbow reads as one form.
function limb(a, b, r0, r1, o = {}) {
  const mid = vlerp(a, b, 0.5);
  tube([a, mid, b], [r0, (r0 + r1) / 2, r1], o.mat || 'silhouette', { order: o.order || 0, key: o.key || 4001, extend: 0.9, rim: o.rim !== false });
  // a joint disc at the proximal end keeps a hip or shoulder from pinching when the limb swings
  disc(a, r0 * 0.99, o.mat || 'silhouette', { order: (o.order || 0) + 0.2 });
}
// A flat convex silhouette from a point cloud in 3D, with a rim on the sun side. Used for the torso, the coat, the head
// and the hair - the masses that are not tubes.
function massSilhouette(pts3, o = {}) {
  const cam = SCENE.cam;
  const pr = projectPoly(cam, pts3);
  if (!pr) return;
  const hull = hull2d(pr.pts);
  if (hull.length < 3) return;
  const mat = MAT[o.mat || 'silhouette'];
  const normal = vmul(cam.fwd, -1);
  const center = centroid3(pts3);
  const lin = surfaceColor(mat, normal, center, pr.z);
  const rgb = cssRGB(lin, LIGHT.exposure, LIGHT.contrast);
  const sunScreen = sunSideScreen(cam);
  const key = o.key ?? (Math.round(center[0] * 97) + Math.round(center[2] * 31) + 555);
  _op(pr.z, (ctx) => {
    const path = polyPath(ctx, hull);
    ctx.fillStyle = cssOf(rgb, mat.alpha ?? 1);
    ctx.fill(path);
    paintSurface({ ctx, pts: hull, mat, rgb, key, pxPerM: cam.focalPx / pr.z, litSun: Math.max(0, vdot(normal, LIGHT.sun.dir)) * LIGHT.sun.intensity, spec: 0, z: pr.z, normal, center, sunScreen });
    if (o.rim !== false) {
      ctx.save();
      ctx.clip(path);
      const b = bboxOf(hull);
      const g = ctx.createLinearGradient(side0(b, sunScreen), 0, side1(b, sunScreen), 0);
      const rimCol = cssRGB(cscale(cadd(LIGHT.sun.color, [0.25, 0.25, 0.25]), 0.5), LIGHT.exposure);
      // a rim is an EDGE: keeping it in the last 12 % of the mass is the difference between a backlit coat and a grey one
      g.addColorStop(0, cssOf(rimCol, 0));
      g.addColorStop(0.88, cssOf(rimCol, 0));
      g.addColorStop(1, cssOf(rimCol, 0.42));
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = g;
      ctx.fillRect(b.x0 - 2, b.y0 - 2, b.w + 4, b.h + 4);
      ctx.restore();
    }
  }, o.layer ?? 0, o.order ?? 0);
}
const side0 = (b, side) => (side > 0 ? b.x0 : b.x1);
const side1 = (b, side) => (side > 0 ? b.x1 : b.x0);

// Rings in 3D around an axis: the building block for a torso, a coat and a head.
function ringAround(center, up, right, rx, rz, n = 12, jitter = 0, seed = 1) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const j = jitter ? (hash2(seed, i) - 0.5) * jitter : 0;
    out.push(vadd(center, vadd(vmul(right, Math.cos(a) * rx * (1 + j)), vmul(up, Math.sin(a) * rz * (1 + j)))));
  }
  return out;
}

// Draw a solved figure. opts: {order, handDetail, skirt}
function drawFigure(place, pose, opts = {}) {
  const P = PROPORTIONS;
  const p = pose;
  const J = solveSkeleton(p);
  // QA: proportions must hold, and no foot may be below the floor
  qaBoneLengths('woman', J, restLengths());
  qaGroundContact('ankleL', J.ankleL, -0.002);
  qaGroundContact('ankleR', J.ankleR, -0.002);
  if (J.reachWarn > 0.02) QA.warn('leg over-extended', { overflow: +J.reachWarn.toFixed(3) });
  if (J.ankleL[1] > 0.5 && J.ankleR[1] > 0.5) QA.warn('figure floating', { y: +J.ankleL[1].toFixed(2) });

  const order = opts.order || 0;
  const cam = SCENE.cam;
  const zOf = (pt) => viewPoint(cam, pt).z;
  const fwd = mat3apply(J.yawM, [0, 0, 1]);
  const rightV = mat3apply(J.yawM, [1, 0, 0]);
  const upV = [0, 1, 0];

  // ---- which side is nearer ------------------------------------------------
  const nearLeg = zOf(J.kneeL) < zOf(J.kneeR) ? 'L' : 'R';
  const farLeg = nearLeg === 'L' ? 'R' : 'L';
  const nearArm = zOf(J.wristL) < zOf(J.wristR) ? 'L' : 'R';
  const farArm = nearArm === 'L' ? 'R' : 'L';

  const drawLeg = (side, ord) => {
    const hip = side === 'L' ? J.hipL : J.hipR, knee = side === 'L' ? J.kneeL : J.kneeR, ankle = side === 'L' ? J.ankleL : J.ankleR;
    limb(hip, knee, 0.084, 0.064, { order: ord, key: 4200 + (side === 'L' ? 1 : 2) });
    limb(knee, ankle, 0.060, 0.043, { order: ord + 0.5, key: 4210 + (side === 'L' ? 1 : 2) });
    // boot: heel to toe as one capsule, plus the ankle
    const f = side === 'L' ? J.footL : J.footR;
    limb(f.heel, f.toe, 0.050, 0.036, { order: ord + 1, key: 4220 + (side === 'L' ? 1 : 2), rim: false });
  };
  const drawArm = (side, ord) => {
    const sh = side === 'L' ? J.shoulderL : J.shoulderR, el = side === 'L' ? J.elbowL : J.elbowR, wr = side === 'L' ? J.wristL : J.wristR;
    limb(sh, el, 0.056, 0.043, { order: ord, key: 4300 + (side === 'L' ? 1 : 2) });
    limb(el, wr, 0.042, 0.031, { order: ord + 0.5, key: 4310 + (side === 'L' ? 1 : 2) });
    const hand = side === 'L' ? J.handL : J.handR;
    const pxPerM = cam.focalPx / Math.max(0.2, zOf(hand.wrist));
    const o2 = { order: ord + 1, side };
    // at a distance a hand is a small mass; close up it resolves into a palm and fingers
    if (pxPerM * PROPORTIONS.handW > 34 && opts.handDetail !== false) drawHand(hand, o2);
    else limb(hand.wrist, vadd(hand.wrist, vmul(hand.dir, 0.10)), 0.033, 0.026, { order: ord + 1, key: 4320, rim: false });
  };

  // ---- far side ------------------------------------------------------------
  drawArm(farArm, order + 0);
  drawLeg(farLeg, order + 1);

  // ---- the coat: a mass from the shoulders to mid-calf ---------------------
  // Its hem is animated as secondary motion: it lags a turn and lifts with a step. Two rings are enough for a hull.
  const hemY = Math.max(0.26, p.root[1] - P.hipCenterY + P.coatHemY);
  const hem = ringAround([p.root[0], hemY, p.root[2]], upV, rightV, P.coatHalfWidth, P.coatHalfWidth * 0.74, 14, 0.05, 77);
  // the hem sways opposite the turn and lifts on the forward leg
  const sway = p.coatSway || 0, lift = p.coatLift || 0;
  for (const hp of hem) {
    const dx = hp[0] - p.root[0], dz = hp[2] - p.root[2];
    hp[0] += sway * 0.35 + Math.sin(lift * 3) * 0.004;
    hp[2] += sway * 0.12;
    hp[1] += Math.abs(Math.sin(Math.atan2(dz, dx))) * lift * 0.02;
  }
  const waistRing = ringAround([J.waist[0], J.waist[1] + 0.02, J.waist[2]], upV, rightV, P.coatShoulderHalfWidth * 0.86, P.coatShoulderHalfWidth * 0.6, 10, 0, 78);
  massSilhouette(hem.concat(waistRing), { order: order + 2, key: 4400 });

  // ---- torso above the coat ------------------------------------------------
  const chestRing = ringAround([J.chest[0], J.chest[1] + 0.03, J.chest[2]], upV, rightV, 0.135, 0.082, 10, 0, 79);
  const shoulderRing = ringAround([J.neckBase[0], J.neckBase[1] - 0.03, J.neckBase[2]], upV, rightV, P.shoulderW * 1.02, 0.075, 10, 0, 80);
  const waist2 = ringAround([J.waist[0], J.waist[1], J.waist[2]], upV, rightV, 0.112, 0.070, 10, 0, 81);
  massSilhouette(chestRing.concat(shoulderRing, waist2), { order: order + 3, key: 4410 });

  // ---- neck and head -------------------------------------------------------
  limb(J.neckBase, J.headBase, 0.048, 0.042, { order: order + 3.5, key: 4420, rim: false });
  drawHead(J, p, order + 4, opts);

  // ---- near side -----------------------------------------------------------
  drawLeg(nearLeg, order + 5);
  drawArm(nearArm, order + 6);
  return J;
}

// The head: a projected ellipsoid (its silhouette is what a silhouette figure shows), a hair mass whose offset follows
// the head's yaw so a turn reads even from behind, and a bun. No face is drawn: on a backlit figure a drawn face is the
// fastest way to look like a mask.
function drawHead(J, p, order, opts) {
  const cam = SCENE.cam;
  const c = J.headCenter;
  const P = PROPORTIONS;
  const z = viewPoint(cam, c).z;
  if (!(z > NEAR)) return;
  const headRing = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    const rx = P.headR * 0.93, ry = P.headR * 1.06;
    headRing.push(vadd(c, vadd(vmul(cam.right, Math.cos(a) * rx), vmul(cam.up, Math.sin(a) * ry))));
  }
  // hair: the same ellipse, offset back and up along the head's own axes, slightly larger
  const hairC = vadd(c, mat3apply(J.headM, [0, P.headR * 0.20, -P.headR * 0.34]));
  const hair = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    hair.push(vadd(hairC, vadd(vmul(cam.right, Math.cos(a) * P.headR * 1.0), vmul(cam.up, Math.sin(a) * P.headR * 1.02))));
  }
  const bun = vadd(c, mat3apply(J.headM, [0, P.headR * 0.02, -P.headR * 0.78]));
  massSilhouette(hair, { order: order + 1, key: 4500 });
  massSilhouette(circleAround(bun, cam, P.headR * 0.46), { order: order + 1.2, key: 4501 });
  massSilhouette(headRing, { order: order + 2, key: 4502 });
  // one small hair highlight on the sun side: the only thing on her head that catches light
  const sunSide = sunSideScreen(cam);
  const hp = vadd(c, vadd(vmul(cam.right, sunSide * P.headR * 0.72), vmul(cam.up, P.headR * 0.55)));
  disc(hp, P.headR * 0.20, 'silhouette', { order: order + 2.4 });
}
const circleAround = (c, cam, r) => {
  const out = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU;
    out.push(vadd(c, vadd(vmul(cam.right, Math.cos(a) * r), vmul(cam.up, Math.sin(a) * r * 1.05))));
  }
  return out;
};
// Fingers are only drawn when they would resolve: below about 34 px of hand the detail becomes a claw, which is exactly
// the failure this skill exists to avoid.
function drawHand(hand, o) {
  const order = o.order || 0;
  const dir = hand.dir, sideDir = hand.side;
  const wrist = hand.wrist;
  const palmLen = 0.082, palmW = PROPORTIONS.handW * 0.5;
  const palmA = vadd(wrist, vmul(sideDir, -palmW));
  const palmB = vadd(wrist, vmul(sideDir, palmW));
  const palmC = vadd(vadd(wrist, vmul(dir, palmLen)), vmul(sideDir, palmW * 0.82));
  const palmD = vadd(vadd(wrist, vmul(dir, palmLen)), vmul(sideDir, -palmW * 0.82));
  poly3([palmA, palmB, palmC, palmD], 'silhouette', { order: order + 0.2, key: 4600 });
  for (let i = 0; i < 4; i++) {
    const off = (i - 1.5) * (palmW * 0.60);
    const base = vadd(vadd(wrist, vmul(dir, palmLen * 0.92)), vmul(sideDir, off));
    const curl = vnorm(vadd(vmul(dir, 0.93), vmul(sideDir, (i - 1.5) * 0.07)));
    const mid = vadd(base, vmul(curl, 0.046));
    const tip = vadd(mid, vmul(vnorm(vadd(curl, [0, -0.28, 0])), 0.040));
    tube([base, mid, tip], [0.0102, 0.0090, 0.0070], 'silhouette', { order: order + 0.4, key: 4610 + i, rim: false, caps: false });
  }
  // thumb, off the index side
  const tBase = vadd(vadd(wrist, vmul(dir, palmLen * 0.18)), vmul(sideDir, -palmW * 1.02));
  const tTip = vadd(tBase, vmul(vnorm(vadd(vmul(dir, 0.62), vmul(sideDir, -0.5))), 0.068));
  tube([tBase, vlerp(tBase, tTip, 0.5), tTip], [0.011, 0.0098, 0.0078], 'silhouette', { order: order + 0.4, key: 4620, rim: false, caps: false });
}









