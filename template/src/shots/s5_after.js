// S5 - the closing wide (10.60 - 12.00 s)
//
// The same field, framed almost as the first shot framed it: the piano, the house, the tree, and her still standing at
// the keyboard. The bird is gone. The candle is still burning. The camera holds, the light keeps going down, and the
// film fades to black on the hold - no black held after the last frame of meaning.
'use strict';
shot({
  film: 'piano',
  id: 'S5', start: 10.60, dur: 1.40,
  meta: {
    scene: 'field, wide (opening rhyme)', size: 'wide', lens: '35mm f/5.6', motion: 'locked off, tripod breath',
    transition: 'cut from the bird leaving; ends on a 0.45 s fade to black',
    reads: ['10.6-11.2 the field again, her still at the piano', '11.2-11.6 the bird is gone; the candle is not',
      '11.6-12.0 hold, then black'],
  },
  light(lt) {
    lightUse('lategold');
    LIGHT.sun.intensity = 1.90 - 0.10 * smoothstep01(seg(lt, 0.2, 1.4));
    lightPoint([-0.62, 0.215, 1.55], hexLin('#ffb066'), 0.32, 0.45);
  },
  cam: (lt) => getThing('camera', 's5')(lt),
  draw({ t }) {
    drawFieldBase(t);
    drawWoman(t);
    // no bird: it left in S4. A shot that quietly omits a prop is a continuity claim, and QA checks the sky for it.
  },
  fadeOut: 0.45, fadeColor: '#07080c',
});



