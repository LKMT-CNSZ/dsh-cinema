// W1 - the field, wide (0.00 - 7.40 s)   《风经过钢琴》 / "Wind Past the Piano"
//
// The film's proposition in one shot: a field, a treeline, a house that is too far gone, a bare tree, and a grand piano
// with a woman standing beside it - all of it 2.5D plates in front of a local-3D piano, so the layers move against each
// other as the camera makes one slow move to the left and in. Nothing happens: the wind arrives, the grass answers, the
// tree answers a beat later, the clouds cross, a bird goes past far away, and the figure does not act.
'use strict';
shot({
  film: 'wind',
  id: 'W1', start: 0.00, dur: 7.40,
  meta: {
    scene: 'the field, panorama', size: 'panorama', lens: '32mm f/5.6',
    motion: 'slow dolly left 0.47 m and in 0.70 m over 7.4 s, tripod breath',
    transition: 'fade in from black (0.6 s)',
    reads: [
      '0.0-1.4 the place: field, sky, treeline, one building',
      '1.4-2.8 the piano, alone, and a figure standing at it',
      '2.8-4.2 the wind arrives: the grass moves first',
      '4.2-5.6 the tree answers a beat later; the clouds keep crossing',
      '5.6-7.4 a bird crosses far off; the field goes on',
    ],
  },
  // The complexity budget is a promise the QA sweep checks: plate marks, local-3D surfaces, independent movers,
  // materials, plates, people, contact events, camera behaviours.
  budget: { plateFills: 1000, surfaces3d: 170, movers: 5, materials: 20, layers: 4, figures: 1, interactions: 0, cameraMoves: 2 },
  sky: (t) => ({ clouds: true, cloudDensity: AMBIENT.cloudDensity(t), cloudDrift: AMBIENT.cloudOffset(t, 0), cloudDrift2: AMBIENT.cloudOffset(t, 1) }),
  light(lt, t) {
    lightUse('lategold');
    // the sun does not change; a thin cloud passing across it does. Fractions of a stop, over a minute.
    LIGHT.exposure *= AMBIENT.exposureDrift(t);
    LIGHT.sun.intensity *= 0.98 + 0.02 * Math.sin((t / 37) * TAU + 1.1);
    LIGHT.sun.color = warmShift(LIGHT.sun.color.slice(), (AMBIENT.warmDrift(t) - 0.5) * 0.12);
    mover('light');
    mover('wind');
    mover('clouds');
    BUDGET.count('cameraMoves', 1);
  },
  cam: (lt) => getThing('camera', 'w1')(lt),
  draw({ t }) {
    panoFar(t);
    fieldGround();          // the one local-3D piece of ground: correct perspective for the grass texture
    panoHouse(t);
    panoTree(t);
    panoHero(t);
    panoFore(t, 'foreA');
    panoBird(t);
  },
  fadeIn: 0.60, fadeColor: '#0a0b0d',
});
