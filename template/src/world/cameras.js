// src/world/cameras.js - the camera language of this film, one entry per shot.
//
// A camera is a description, not a drawing: position, target, focal length, focus and aperture. The shot calls the
// entry with its local time. It is documented here so the SHOT_LIST and the code cannot drift apart: these fields are
// what the shot list was written from.
'use strict';

function defineCameras() {
  // S1 - the establishing wide. Locked off on a tripod that breathes. 35 mm on full frame: enough perspective to feel the depth of the field, not enough to bend the piano.
  defineThing('camera', 's1', (lt) => {
    const b = CAM.breath(lt, 0.0022, 3, 0.5);
    return {
      pos: [-1.62 + b[0], 1.38 + b[1], -6.35 + b[2]],
      target: [0.32, 1.06, 0.85],
      focal: 35, focus: 7.2, aperture: 5.6,
      motion: 'locked off, tripod breath',
    };
  });
  // S2 - the medium, dollying in slowly towards her shoulder. 50 mm keeps the perspective gentle; the focus pulls from
  // her back (3.85 m) to the key bed (2.75 m, where the keys actually are) as her hand arrives, which is the shot's idea: attention moving from the person to the act.
  defineThing('camera', 's2', (lt) => {
    const k = easeInOutCubic(seg(lt, 0.15, 3.0));
    const b = CAM.breath(lt, 0.0018, 5, 0.4);
    return {
      pos: [lerp(1.05, 0.82, k) + b[0], lerp(1.42, 1.36, k) + b[1], lerp(4.55, 4.12, k) + b[2]],
      target: [lerp(0.30, 0.26, k), lerp(1.10, 1.04, k), lerp(1.30, 1.22, k)],
      focal: 50, focus: lerp(3.85, 2.75, easeInOutCubic(seg(lt, 1.0, 2.6))), aperture: 2.4,
      motion: 'dolly in 1.1 m with a focus pull to the keys',
    };
  });
  // S3 - the close-up. 60 mm at 1.6 m, wide open: the keys, the hand and the candle, nothing else sharp.
  defineThing('camera', 's3', (lt) => {
    const b = CAM.breath(lt, 0.0012, 7, 0.3);
    return {
      pos: [-0.02 + b[0], 0.505 + b[1], 2.98 + b[2]],
      target: [-0.60, 0.300, 1.50],
      focal: 60, focus: 1.55, aperture: 2.0,
      motion: 'locked off close-up, holding on the keys',
    };
  });
  // S4 - the bird leaves. 35 mm, from beside her shoulder, tilting up 10.7 deg, tilting up as it climbs: the camera carries the bird's line
  // instead of cutting to it.
  defineThing('camera', 's4', (lt) => {
    const tilt = smoothstep01(seg(lt, 0.45, 1.5));
    const b = CAM.breath(lt, 0.002, 9, 0.45);
    return {
      pos: [3.55 + b[0], 1.74 + b[1], 1.15 + b[2]],
      target: [lerp(0.35, 0.72, tilt), lerp(1.62, 2.18, tilt), lerp(0.55, 0.40, tilt)],
      focal: 35, focus: lerp(3.1, 3.7, tilt), aperture: 2.8,
      motion: 'tilt up 9 deg following the bird out of frame',
    };
  });
  // W1 - the panorama: one slow move to the left and in, over the whole shot. 30 mm on full frame: a wide lens that still
  // holds the horizon straight. The breath is 1.6 mm and slower than the earlier film's, because this camera is on sticks.
  defineThing('camera', 'w1', (lt) => {
    const k = easeInOutSine(seg(lt, 0.0, 7.4));
    const b = CAM.breath(lt, 0.0016, 21, 0.32);
    return {
      pos: [lerp(0.95, 0.48, k) + b[0], lerp(1.52, 1.48, k) + b[1], lerp(-7.40, -6.70, k) + b[2]],
      target: [lerp(0.30, 0.20, k), lerp(1.05, 1.00, k), lerp(0.85, 0.72, k)],
      focal: 32, focus: 8.2, aperture: 5.6,
      motion: 'slow dolly left and in',
    };
  });
  // W2 - the closer framing after the match cut, LOCKED OFF on a tripod that breathes: 40 mm, 4.8 m out, horizon matched
  // to W1 within 0.1 degrees. The locked camera is the point - the first shot moves, the second one looks.
  defineThing('camera', 'w2', (lt) => {
    const b = CAM.breath(lt, 0.0014, 23, 0.30);
    return {
      pos: [1.49 + b[0], 1.16 + b[1], -3.74 + b[2]],
      target: [0.40, 0.912, 0.92],   // horizon matched to W1 in PIXELS (429.6 px), which with a 40 mm lens needs a shallower pitch than W1
      focal: 40, focus: 5.4, aperture: 4.0,
      motion: 'locked off, tripod breath',
    };
  });
  // S5 - the closing wide: the same field as S1, from a slightly different position, so the film ends where it began
  // and the place has been changed by what happened in it.
  defineThing('camera', 's5', (lt) => {
    const b = CAM.breath(lt, 0.0024, 11, 0.45);
    return {
      pos: [-1.86 + b[0], 1.41 + b[1], -6.20 + b[2]],
      target: [0.50, 1.07, 0.88],
      focal: 35, focus: 7.1, aperture: 5.6,
      motion: 'locked off, tripod breath',
    };
  });
}











