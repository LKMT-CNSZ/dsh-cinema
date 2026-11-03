// S2 - the medium (2.90 - 6.10 s)
//
// The camera has come around behind her right shoulder and dollies in while the focus pulls from her back to the key
// bed. What happens: her left hand settles on the front edge of the key bed, her right hand anticipates, crosses the
// gap on an arc and presses one key. Head, chest and shoulder arrive at three different times.
//
// The focus pull is a real lens: aperture 2.4 on a 50 mm, computed by the thin-lens formula in camera.js and applied in
// depth bands (renderer.js) - never a full-frame blur.
'use strict';
shot({
  film: 'piano',
  id: 'S2', start: 2.90, dur: 3.20,
  meta: {
    scene: 'field, medium over her shoulder', size: 'medium', lens: '50mm f/2.4', motion: 'dolly in 1.1 m, focus pull',
    transition: 'hard cut on her stopping',
    reads: ['2.9-3.6 she is at the piano, left hand finding the key bed', '3.6-4.2 the right hand anticipates and reaches',
      '4.2-4.6 contact: one key goes down', '4.6-5.4 she releases and withdraws; the note keeps going',
      '5.4-6.1 she listens'],
  },
  light(lt) {
    lightUse('lategold');
    LIGHT.sun.intensity = 2.02;
    lightPoint([-0.62, 0.215, 1.55], hexLin('#ffb066'), 0.95, 0.75);
  },
  cam: (lt) => getThing('camera', 's2')(lt),
  dof: (lt) => { const c = getThing('camera', 's2')(lt); return { focus: c.focus, aperture: c.aperture }; },
  draw({ t }) {
    drawFieldBase(t);
    drawWoman(t);
    drawBird(birdStateAt(t), { order: 3 });
  },
});




