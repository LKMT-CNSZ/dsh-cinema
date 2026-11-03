// src/world/environment.js - where everything is, once.
//
// Every position in the film is declared here, in metres, in one coordinate system: +Y up, ground at y = 0, +X east,
// +Z north, yaw in degrees about +Y (0 = facing +Z). Shots reference FIELD; nothing in a shot file invents a position.
// That is what makes the house, the tree, the piano and the woman hold their relationships across cuts.
'use strict';

const FIELD = {
  // the grand piano, standing in the field. Keyboard faces roughly towards the camera.
  piano: { x: 0.30, z: 0.40, yaw: -12 },
  // her path: she walks in from frame left, stops at the keyboard and turns to face it.
  walk: {
    from: [-3.02, 2.40], to: [0.02, 1.78],
    yawWalk: 0,          // overwritten at boot by atan2(dx, dz) of the path: one source of truth
    yawEnd: 168,
    start: 0.10, stop: 2.30, turnStart: 2.22, turnEnd: 2.78,
  },
  // the bird sits on the open lid's outer edge, at 1.778 m: a silhouette against the sky
  birdPerch: [0.851, 1.778, 0.211],
  // the house, far left behind the piano; the tree, right of frame
  house: { x: -11.5, z: 26.0, yaw: 8 },
  tree: { x: 6.6, z: 14.5, yaw: 4 },
  stonesNear: { x: 3.15, z: 2.35, spread: 2.6 },
  stonesHouse: { x: -5.4, z: 13.2, spread: 4.5 },
  // tufts: the foreground grass that occludes boots and piano legs. Anchored in world space, not to the camera.
  tufts: { x: 0.4, z: 1.2, spreadX: 11, spreadZ: 9, count: 54 },
};

const PIANO_PLACE = () => placeProp('piano', { x: FIELD.piano.x, z: FIELD.piano.z, yaw: FIELD.piano.yaw });
const HOUSE_PLACE = () => placeProp('house', { x: FIELD.house.x, z: FIELD.house.z, yaw: FIELD.house.yaw });
const TREE_PLACE = () => placeProp('tree', { x: FIELD.tree.x, z: FIELD.tree.z, yaw: FIELD.tree.yaw });
const STONES_NEAR = () => placeProp('stones', { x: FIELD.stonesNear.x, z: FIELD.stonesNear.z });
const STONES_HOUSE = () => placeProp('stones', { x: FIELD.stonesHouse.x, z: FIELD.stonesHouse.z });
const TUFT_PLACE = () => placeProp('tufts', { x: FIELD.tufts.x, z: FIELD.tufts.z });

// ---- shared scene pieces ---------------------------------------------------
// The field itself: ground, then the far things (house, tree), then the near things, in that order so the painter's
// sort has something sensible to do even before depth decides.
function fieldGround() {
  ground('grassGround');
}
// A cast shadow on the ground: the hull of a footprint and the same footprint pushed along the sun's horizontal
// direction by (height / tan(sunElevation)). This is how a low sun throws long shadows across a field.
function castShadow(place, footprint, height, strength = 0.4, softnessK = 3) {
  const elev = Math.asin(clamp(LIGHT.sun.dir[1], 0.05, 1));
  const tanE = Math.tan(elev);
  const dirXZ = vnorm([-LIGHT.sun.dir[0], 0, -LIGHT.sun.dir[2]]);
  const shift = height / Math.max(0.18, tanE);
  const near = footprint.map(([x, z]) => PW(place, [x, 0.01, z]));
  const far = footprint.map(([x, z]) => PW(place, [x + dirXZ[0] * shift, 0.01, z + dirXZ[2] * shift]));
  const hull = hull2d(near.concat(far).map((p) => [p[0], p[2]]));
  shadow(hull.map(([x, z]) => [x, 0.012, z]), strength, { softness: 6 + Math.min(30, height * softnessK) });
}
// The house, the tree and the stones: everything that never moves, drawn identically in every shot.
// A distant treeline closes the horizon. Without it a field ends in a straight cut between ground and sky, which is the
// fastest way for a wide shot to look like a test render rather than a place. It is far enough to be pure silhouette.
function treeline() {
  const cam = SCENE.cam;
  // two ranks of bare trees on a ring around the field, so a shot looking any way has a horizon with depth. The trees
  // are billboards at 50-95 m: pure silhouette, already half eaten by the haze.
  for (let rank = 0; rank < 2; rank++) {
    const count = rank === 0 ? 64 : 44;
    for (let i = 0; i < count; i++) {
      const seed = 1200 + rank * 977 + i;
      const a = (i / count) * TAU + hash01(seed) * 0.09;
      const r = (rank === 0 ? 52 : 78) + hash01(seed + 7) * 20;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const h = (rank === 0 ? 5.5 : 7.5) + hash01(seed + 3) * 6.0;
      const w = h * (0.42 + hash01(seed + 11) * 0.4);
      const p = [x, 0, z];
      if (viewPoint(cam, p).z < 2) continue;
      billboard([x, h * 0.42, z], w, h * 0.72, (ctx, b) => {
        const rnd = rngFrom(seed);
        const lobes = 3 + Math.floor(rnd() * 3);
        for (let k = 0; k < lobes; k++) {
          const cx = b.x + (rnd() - 0.5) * b.w * 0.8, cy = b.y - b.h * 0.18 + (rnd() - 0.5) * b.h * 0.36;
          const rr = b.w * (0.16 + rnd() * 0.16);
          ctx.beginPath();
          const n = 7;
          for (let q = 0; q < n; q++) {
            const aa = (q / n) * TAU;
            const rq = rr * (0.72 + rnd() * 0.5);
            const px2 = cx + Math.cos(aa) * rq, py2 = cy + Math.sin(aa) * rq * 0.66;
            if (q === 0) ctx.moveTo(px2, py2); else ctx.lineTo(px2, py2);
          }
          ctx.closePath();
          ctx.fillStyle = rank === 0 ? 'rgba(42,48,48,0.66)' : 'rgba(56,62,62,0.46)';
          ctx.fill();
        }
        ctx.fillStyle = rank === 0 ? 'rgba(38,42,40,0.72)' : 'rgba(50,54,52,0.52)';
        ctx.fillRect(b.x - Math.max(1, b.w * 0.016), b.y - b.h * 0.28, Math.max(1.4, b.w * 0.032), b.h * 0.75);
      }, { depth: viewPoint(cam, p).z });
    }
  }
}function staticScenery() {
  sceneTag('treeline');
  treeline();
  const house = HOUSE_PLACE(), tree = TREE_PLACE();
  castShadow(house, [[-4.3, -3.2], [4.3, -3.2], [4.3, 3.2], [-4.3, 3.2]], 4.5, 0.30);
  castShadow(tree, [[-0.3, -0.3], [0.3, -0.3], [0.3, 0.3], [-0.3, 0.3]], 5.0, 0.22);
  sceneTag('house'); getThing('prop', 'house').build(house);
  sceneTag('tree'); getThing('prop', 'tree').build(tree);
  getThing('prop', 'stones').build(STONES_HOUSE());
  getThing('prop', 'stones').build(STONES_NEAR());
}
function nearGrass(t, wind) {
  getThing('prop', 'tufts').build(TUFT_PLACE(), { t, wind });
}
// The piano plus its shadow. Called from every shot that can see it, with the same placement.
function scenePiano() {
  sceneTag('piano');
  const place = PIANO_PLACE();
  castShadow(place, [[-0.8, -1.1], [0.8, -1.1], [0.8, 1.25], [-0.8, 1.25]], 0.95, 0.28, 9);
  return getThing('prop', 'piano').build(place);
}
const pianoPlace = () => PIANO_PLACE();
const birdPerchPoint = () => FIELD.birdPerch.slice();

// The wind: one field of air. Tufts, cloth and hair all read the same gust, with a phase from position, so the field
// moves together instead of each sprite doing its own dance.
function windAt(t, p) {
  const gust = 0.55 + 0.45 * noise1(t * 0.42 + 2.0, 3);
  const wave = Math.sin(t * 1.15 + (p[0] + p[2]) * 0.22);
  return (0.5 + 0.5 * wave) * gust * 0.55;
}

// ---- the one shared scene draw ---------------------------------------------
// Every shot that can see the field draws it through this function, so the piano, the candle, the grass, the house and
// the tree are identical in all five shots. The depth sort orders them with the figure and the bird; the call order
// here is only about which pieces exist.
const CANDLE_AT = { x: -0.62, z: 1.55, y: 0 };
const CANDLE_PLACE = () => placeProp('candle', { x: CANDLE_AT.x, z: CANDLE_AT.z, y: CANDLE_AT.y });
function drawFieldBase(t, o = {}) {
  fieldGround();
  staticScenery();
  scenePiano();
  // the shot owns the candle's point light (its intensity is a lighting decision); the prop only draws the wax and flame
  getThing('prop', 'candle').build(CANDLE_PLACE(), { light: false, flicker: (tt) => 1 + Math.sin(tt * 11.3 + 0.7) * 0.14 + Math.sin(tt * 23.1) * 0.07 });
  nearGrass(t, windAt);
}

// ---- registry --------------------------------------------------------------
function defineEnvironment() {
  defineThing('environment', 'field', {
    layout: FIELD,
    ground: fieldGround,
    scenery: staticScenery,
    grass: nearGrass,
    piano: scenePiano,
    wind: windAt,
    birdPos: birdPosAt,
    birdState: birdStateAt,
  });
}

// ---- the bird's one event --------------------------------------------------
// The film has exactly one bird and it acts once: it waits on the lid, then it leaves. Both the flight path and the
// bird's state are functions of film time, shared by every shot (S4 films it; S1/S2/S3 have it perched; in S5 it is
// gone), which is what makes "the same bird, present or absent" verifiable rather than remembered.
const BIRD_EVENT = { takeoff: 9.18, outOfFrame: 10.45 };
function birdPosAt(t) {
  const p0 = FIELD.birdPerch;
  if (t < BIRD_EVENT.takeoff) return p0.slice();
  const k = clamp01((t - BIRD_EVENT.takeoff) / (BIRD_EVENT.outOfFrame - BIRD_EVENT.takeoff));
  const c1 = [0.62, 2.25, -0.28], c2 = [-1.9, 4.6, -2.2], c3 = [-8.6, 6.4, -3.2];
  const u = 1 - k;
  const bz = (a, b, c, d) => u * u * u * a + 3 * u * u * k * b + 3 * u * k * k * c + k * k * k * d;
  return [bz(p0[0], c1[0], c2[0], c3[0]), bz(p0[1], c1[1], c2[1], c3[1]), bz(p0[2], c1[2], c2[2], c3[2])];
}
function birdStateAt(t) {
  const perch = FIELD.birdPerch;
  if (t < BIRD_EVENT.takeoff - 0.42) {
    return birdPerched(t, { pos: perch, yaw: 258, seed: 4, flickAt: 3.4, scale: 1 });
  }
  const path = (tt) => birdPosAt(Math.max(tt, BIRD_EVENT.takeoff - 0.001));
  if (t < BIRD_EVENT.takeoff + 0.05) {
    // the crouch before the push: blended into the perched pose so nothing pops
    const crouch = smoothstep(BIRD_EVENT.takeoff - 0.42, BIRD_EVENT.takeoff - 0.02, t);
    const base = birdPerched(t, { pos: perch, yaw: 258, seed: 4, flickAt: 3.4 });
    base.pos = vadd(base.pos, [0, -0.012 * crouch, 0]);
    base.pitch -= 5 * crouch;
    base.wing = { spread: lerp(0.06, 0.35, crouch), flap: lerp(-0.2, 0.5, crouch), sweep: -0.2, bend: 0.2 };
    return base;
  }
  return birdTakeoff(t, { t0: BIRD_EVENT.takeoff, path, flapHz: 4.6, amp: 0.95, phase: 1.1 });
}








