// W2 - the field, closer, horizon matched (7.40 - 12.00 s)
//
// A match cut, not a cut: the horizon lands within a pixel of where W1 left it, so the eye reads one continuous place and
// only then notices the frame is closer (32 mm to 40 mm, the piano 7.9 m to 4.4 m). The foreground grass plate is 1.45 m
// from the lens, so it moves fastest and puts the piano behind it in real space. Still nothing happens: the wind keeps
// going, the piano creaks, the figure's coat moves and the woman does not.
'use strict';
shot({
  film: 'wind',
  id: 'W2', start: 7.40, dur: 4.60,
  meta: {
    scene: 'the field and the piano, closer', size: 'panorama, closer', lens: '40mm f/4.0',
    motion: 'slow dolly in 0.45 m, tripod breath',
    transition: 'match cut on the horizon line; ends on a 0.55 s fade',
    reads: [
      '7.4-8.4 the same horizon, closer: the piano is the subject now',
      '8.4-9.6 the lid edge and the coat, moving by millimetres',
      '9.6-11.0 grass at the lens, the field behind it',
      '11.0-12.0 hold, then black',
    ],
  },
  budget: { plateFills: 900, surfaces3d: 170, movers: 5, materials: 20, layers: 4, figures: 1, interactions: 0, cameraMoves: 1 },
  sky: (t) => ({ clouds: true, cloudDensity: AMBIENT.cloudDensity(t), cloudDrift: AMBIENT.cloudOffset(t, 0), cloudDrift2: AMBIENT.cloudOffset(t, 1) }),
  light(lt, t) {
    lightUse('lategold');
    LIGHT.exposure *= AMBIENT.exposureDrift(t) * 0.98;
    LIGHT.sun.intensity *= 0.98 + 0.02 * Math.sin((t / 37) * TAU + 1.1);
    LIGHT.sun.color = warmShift(LIGHT.sun.color.slice(), (AMBIENT.warmDrift(t) - 0.5) * 0.12);
    mover('light');
    mover('wind');
    mover('clouds');
    BUDGET.count('cameraMoves', 1);
  },
  cam: (lt) => getThing('camera', 'w2')(lt),
  draw({ t }) {
    panoFar(t);
    fieldGround();
    panoHouse(t);
    panoTree(t);
    panoHero(t, { yaw: 196, shadows: false });
    panoFore(t, 'foreB');
  },
  fadeOut: 0.55, fadeColor: '#0a0b0d',
});
