// S4 - the bird leaves (8.90 - 10.60 s)
//
// From beside her right shoulder, 35 mm. The bird has been waiting since the first frame; at 9.18 it crouches and goes. The
// camera tilts up with it - a carry-through rather than a cut - and she follows it with her head, then her shoulders,
// arriving late. This is the film's one event, and it is small.
'use strict';
shot({
  film: 'piano',
  id: 'S4', start: 8.90, dur: 1.70,
  meta: {
    scene: 'field, medium wide from behind the piano', size: 'medium wide', lens: '35mm f/2.8', motion: 'tilt up 10.7 deg following the bird',
    transition: 'cut from the close-up on her head turning',
    reads: ['8.9-9.2 the bird on the lid, the field behind it', '9.2-9.6 the crouch and the first two strokes',
      '9.6-10.2 it climbs out of frame top left; the camera tilts', '10.2-10.6 her head and shoulders follow it'],
  },
  light(lt) {
    lightUse('lategold');
    LIGHT.sun.intensity = 1.98;
    lightPoint([-0.62, 0.215, 1.55], hexLin('#ffb066'), 0.34, 0.45);
  },
  cam: (lt) => getThing('camera', 's4')(lt),
  draw({ t }) {
    drawFieldBase(t);
    drawWoman(t);
    drawBird(birdStateAt(t), { order: 3, eye: true });
  },
});



