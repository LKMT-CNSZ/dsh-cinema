// S1 - the establishing wide (0.00 - 2.90 s)
//
// The film's proposition in one frame: a grand piano standing alone in a field, a house too far gone to be a home, a
// bare tree, and a woman walking in from frame left. The bird is already on the open lid. Camera is locked off: this is
// an observation, not an announcement. The only motion a tripod gives is breath.
'use strict';
shot({
  film: 'piano',
  id: 'S1', start: 0.00, dur: 2.90,
  meta: {
    scene: 'field, wide', size: 'wide', lens: '35mm f/5.6', motion: 'locked off, tripod breath',
    transition: 'fade in from black (0.55 s)', fadeIn: 0.55,
    reads: ['0.0-1.0 the place: field, house, tree, piano', '1.0-1.9 a figure is walking in from the left',
      '1.9-2.6 the bird on the lid, watching her', '2.6-2.9 she arrives at the keyboard'],
  },
  light(lt) {
    lightUse('lategold');
    LIGHT.sun.intensity = 1.92 + 0.10 * smoothstep01(seg(lt, 0.6, 2.9));
    lightPoint([-0.62, 0.215, 1.55], hexLin('#ffb066'), 0.55, 0.5);
  },
  cam: (lt) => getThing('camera', 's1')(lt),
  draw({ t }) {
    drawFieldBase(t);
    drawWoman(t);
    drawBird(birdStateAt(t), { order: 3 });
  },
  fadeIn: 0.55, fadeColor: '#07080c',
});




