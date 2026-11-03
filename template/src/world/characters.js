// src/world/characters.js - the performance of the one person in the film, as one function of global time.
//
// This is the most important design decision in the film: she is posed by `womanPose(t)` where t is FILM time, not
// shot time. Every shot that sees her calls the same function, so at a cut her body, her hand on the key bed and her
// head are exactly where the previous shot left them. Continuity stops being something to remember and becomes a
// property of the code.
//
// Her performance, in film seconds:
//   0.10 - 2.30  walks in from frame left along FIELD.walk, arms swinging opposite her legs, coat trailing
//   2.30 - 2.80  stops and turns to the piano: hips first, chest a beat later, head last
//   3.00 - 3.90  left hand finds the front edge of the key bed and rests there
//   3.55          right hand pulls back 3 cm (anticipation)
//   3.72 - 4.22  reaches along an arc to one key
//   4.22 - 4.62  contact, press, hold, release
//   4.62 - 5.30  withdraws with an overshoot
//   5.30 - 8.60  stands, listening; head lifts off the keys at 6.4
//   8.60 - 10.40 follows the bird with her head only, shoulders a beat behind
//   10.40 - 12.0 settles back to the keys
'use strict';

const WOMAN = {
  stride: 0,                 // set in defineCharacters from the path length
  keyU: 0.44,                // which key she plays (0..1 across the keyboard)
  pressAt: 4.22, releaseAt: 4.62,
};

// The pose, as a pure function of film time. Every shot calls this.
function womanPose(t) {
  const P = PROPORTIONS;
  const W = FIELD.walk;
  const stride = WOMAN.stride || 1.31;

  // ---- locomotion ----------------------------------------------------------
  const walkOpts = { start: W.start, end: W.stop, from: W.from, to: W.to, yaw: W.yawWalk, stride, duty: 0.62, armSwing: 13, stance: 0.055 };
  const walk = walkPose(t, walkOpts);
  const walkEnd = walkPose(W.stop, walkOpts);
  const turn = smoothstep(W.turnStart, W.turnEnd, t);
  const yaw = lerp(W.yawWalk, W.yawEnd, turn);

  // ---- the standing base pose ---------------------------------------------
  const stand = idlePose(t, { seed: 2, base: { root: [W.to[0], P.hipCenterY, W.to[1]], yaw } });
  // A walk does not stop with the feet half a stride apart: the trailing foot takes one last step and comes beside the
  // leading one. This settle step is also what establishes the stance she keeps for the rest of the film, so the pose is
  // identical in S2-S5 by construction.
  const stance = standFeet({ root: [W.to[0], 0, W.to[1]], yaw }, 0.078, 0.02);
  const stepK = smoothstep(W.stop, W.stop + 0.46, t);
  const dragK = smoothstep(W.stop, W.stop + 0.30, t);
  const liftRear = Math.sin(Math.PI * clamp01(stepK)) * 0.055;
  stand.feet = {
    L: { pos: vlerp(walkEnd.feet.L.pos, stance.L.pos, dragK), yaw: lerp(W.yawWalk, yaw, smoothstep(W.stop, W.stop + 0.4, t)), pitch: 0 },
    R: { pos: vadd(vlerp(walkEnd.feet.R.pos, stance.R.pos, stepK), [0, liftRear, 0]), yaw: lerp(W.yawWalk, yaw, smoothstep(W.stop + 0.05, W.stop + 0.5, t)), pitch: lerp(12, 0, stepK) },
  };
  // the settle from walk to stand: pelvis height, hip/shoulder counter-rotation and arm swing all decay together
  const settle = smoothstep(W.stop - 0.05, W.stop + 0.42, t);
  let pose;
  if (t < W.stop) {
    pose = { ...walk };
    // she starts turning her head towards the piano before she has quite stopped
    pose.headYaw = (walk.headYaw || 0) + turn * 12;
  } else {
    pose = { ...stand };
    pose.root = vlerp(walkEnd.root, stand.root, settle);
    pose.hipsYaw = lerp(walkEnd.hipsYaw || 0, 0, settle);
    pose.chestTwist = lerp(walkEnd.chestTwist || 0, 0, settle);
    pose.chestFwd = lerp(walkEnd.chestFwd || 0, stand.chestFwd || 0, settle);
    pose.yaw = yaw;
    pose.hands = null;
    pose.headYaw = lerp(walkEnd.headYaw || 0, 0, settle) + turn * 8;
  }

  // ---- hands ---------------------------------------------------------------
  // Rest positions come from the solved hanging arm, so the reach starts exactly where the arm would be.
  const rest = solveSkeleton(pose);
  const key = getThing('prop', 'piano').keyPoint(WOMAN.keyU);
  const rightRest = rest.wristR, leftRest = rest.wristL;

  // right hand: anticipation, arc, contact, hold, withdraw
  const anticipate = smoothstep(3.55, 3.70, t) * (1 - smoothstep(3.70, 3.82, t));
  const reach = smoothstep(3.70, 4.22, t);
  const withdraw = smoothstep(WOMAN.releaseAt + 0.02, 5.30, t);
  const holdK = smoothstep(WOMAN.pressAt, WOMAN.pressAt + 0.04, t) * (1 - smoothstep(WOMAN.releaseAt, WOMAN.releaseAt + 0.06, t));
  const keyWrist = vadd(key, [0.015, 0.118, 0.03]);
  const approachCtl = vadd(key, [0.08, 0.31, 0.14]);       // the arc rises before it comes down: a hand does not
  const restBack = vadd(rightRest, [-0.02, -0.02, 0.03]);   // travel straight to an object
  let wristR = rightRest.slice();
  if (t < 3.72) {
    wristR = vadd(rightRest, vmul(vsub(restBack, rightRest), anticipate * 0.6 + reach * 0.2));
  } else if (t < 4.22 + 0.001) {
    wristR = bez2v(restBack, approachCtl, keyWrist, reach);
  } else if (t < 5.32) {
    const contact = vadd(keyWrist, [0, -0.004 * holdK, 0]);
    wristR = vlerp(contact, vadd(rightRest, [0.03, 0.05, 0.06]), withdraw);
    // the overshoot: a released arm swings a little past its rest before it settles
    const over = spring(t, 5.18, 9, 30) * 0.02;
    if (t > 5.18) wristR = vadd(wristR, [over * 0.3, over, over * 0.4]);
  }
  // left hand: rests on the front edge of the key bed from 3.9 s and stays there for the rest of the film
  const leftTarget = vadd(PW(pianoPlace(), [0.32, 0.735, 1.205]), [0.0, 0.075, 0.055]);
  const leftK = smoothstep(3.02, 3.92, t);
  const wristL = vlerp(leftRest, leftTarget, leftK);

  const poleR = vadd(pose.root, mat3apply(rotY(yaw * DEG), [0.55, 0.15, -0.85]));
  const poleL = vadd(pose.root, mat3apply(rotY(yaw * DEG), [-0.5, 0.1, -0.9]));
  const anyHand = t >= 2.95;
  if (anyHand) pose.hands = { R: { pos: wristR, pole: poleR }, L: { pos: wristL, pole: poleL } };

  // ---- torso: the reach brings the shoulder and the chest with it -------------
  const reachTwist = (smoothstep(3.6, 4.1, t) * (1 - smoothstep(4.7, 5.4, t))) * -9;
  pose.chestTwist = (pose.chestTwist || 0) + reachTwist;
  pose.chestFwd = (pose.chestFwd || 0) + smoothstep(3.65, 4.2, t) * (1 - smoothstep(4.8, 5.5, t)) * 2.6;
  pose.hipsYaw = (pose.hipsYaw || 0) + reachTwist * 0.22;
  pose.waistSide = (pose.waistSide || 0) + smoothstep(3.7, 4.3, t) * (1 - smoothstep(4.8, 5.6, t)) * 1.4;

  // ---- the head: targets, and a lag so it never moves with the chest ---------
  const lookTargets = (tt) => {
    if (tt < 2.30) return vadd(key, [0, 0.15, 0]);                       // watching the piano as she arrives
    if (tt < 4.75) return vadd(key, [0, 0.06, 0]);                       // down at her hand on the key
    if (tt < 6.40) return vadd(key, [0, 0.10, 0]);                       // a beat of listening, head still down
    if (tt < 8.60) return [1.4, 2.9, 22];                                // the field: she listens to the note die away
    if (tt < 10.40) return birdPosAt(tt);                                // follows the bird out
    return [0.9, 1.5, 6];                                                // settles back towards the piano
  };
  const lookK = smoothstep(W.stop - 0.15, W.stop + 0.55, t);             // no head-track while walking
  if (lookK > 0) {
    const lagged = lookTargets(t - 0.11);                                 // the head lags its target by 110 ms
    lookAt(pose, lagged, lookK * (t > 8.6 && t < 10.4 ? 0.95 : 0.8));
  }
  // shoulders follow the head later still: a small extra chest twist while she tracks the bird
  pose.chestTwist = (pose.chestTwist || 0) + smoothstep(9.0, 9.7, t) * (1 - smoothstep(10.2, 10.8, t)) * 5;

  // ---- secondary: the coat trails the change of direction -------------------
  const yawRate = (yaw - lerp(W.yawWalk, W.yawEnd, smoothstep(W.turnStart, W.turnEnd, Math.max(0, t - 0.08)))) / 0.08;
  const stepSway = t < W.stop ? Math.sin((walk.phase || 0) * TAU + 0.8) * 0.05 : Math.sin(t * 1.3) * 0.012;
  pose.coatSway = clamp(-yawRate * 0.05 + stepSway, -0.25, 0.25);
  pose.coatLift = t < W.stop ? Math.abs(Math.sin((walk.phase || 0) * TAU)) * 0.6 : 0.05 + Math.sin(t * 1.1) * 0.03;

  return pose;
}

// One-step contact correction: whatever the IK produced, move the wrist target by the error between the fingertip and
// the key and solve again. This is how the hand lands ON the key instead of near it, without hard-coding angles.
function fingertipOf(pose, side = 'R') {
  const J = solveSkeleton(pose);
  return side === 'R' ? J.handR.tip : J.handL.tip;
}
function womanPoseOnKey(t) {
  const pose = womanPose(t);
  if (t < 3.72 || t > 5.32 || !pose.hands) return pose;
  const key = getThing('prop', 'piano').keyPoint(WOMAN.keyU);
  let p = pose;
  for (let i = 0; i < 5; i++) {
    const tip = fingertipOf(p);
    const err = vsub(key, tip);
    if (vlen(err) < 0.004) break;
    const h = p.hands.R;
    p = { ...p, hands: { ...p.hands, R: { ...h, pos: vadd(h.pos, vmul(err, 0.85)) } } };
  }
  return p;
}
// The key's travel: she presses it 6 mm, and it comes back up when she releases.
function womanKeyDepth(t) {
  const down = smoothstep(WOMAN.pressAt, WOMAN.pressAt + 0.05, t) * (1 - smoothstep(WOMAN.releaseAt, WOMAN.releaseAt + 0.08, t));
  return 0.006 * down;
}
const womanKeyPoint = () => getThing('prop', 'piano').keyPoint(WOMAN.keyU);

// Draw her, plus her shadow. Every shot calls this one function.
function drawWoman(t, opts = {}) {
  sceneTag('woman');
  const pose = womanPoseOnKey(t);
  castShadow({ origin: [pose.root[0], 0, pose.root[2]], yaw: pose.yaw, scale: 1 },
    [[-0.22, -0.16], [0.22, -0.16], [0.22, 0.16], [-0.22, 0.16]], 1.0, 0.38);
  return drawFigure({}, pose, opts);
}

function defineCharacters() {
  // the walk is exactly three strides long, and the yaw that faces the path is derived from the path itself - so the
  // gait's feet land on the path instead of near it.
  const dx = FIELD.walk.to[0] - FIELD.walk.from[0], dz = FIELD.walk.to[1] - FIELD.walk.from[1];
  WOMAN.stride = Math.hypot(dx, dz) / 3;
  FIELD.walk.yawWalk = Math.atan2(dx, dz) / DEG;
  defineThing('character', 'woman', {
    height: 1.644,
    coat: 'long wool coat, mid-calf',
    pose: womanPoseOnKey,
    draw: (t, opts) => drawWoman(t, opts),
    keyAction: { press: WOMAN.pressAt, release: WOMAN.releaseAt, key: womanKeyPoint },
  });
  // QA: at the moment of contact the fingertip must be on the key, and her feet must stay on the ground.
  QA.probe('woman.key-contact', (t) => {
    if (t < WOMAN.pressAt + 0.01 || t > WOMAN.releaseAt - 0.01) return { ok: true };
    const tip = fingertipOf(womanPoseOnKey(t));
    const key = womanKeyPoint();
    const d = vdist(tip, key);
    return { ok: d < 0.03, level: 'P0', detail: `fingertip ${(d * 1000).toFixed(0)} mm from the key at t=${t.toFixed(2)}` };
  });
  QA.probe('woman.feet-on-ground', (t) => {
    const J = solveSkeleton(womanPoseOnKey(t));
    const low = Math.min(J.ankleL[1], J.ankleR[1]);
    return { ok: low > 0.05 && low < 0.11, level: 'P0', detail: `ankle height ${low.toFixed(3)} m at t=${t.toFixed(2)}` };
  });
}


