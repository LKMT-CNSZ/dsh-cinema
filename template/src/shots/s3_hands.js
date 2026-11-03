// S3 - the close-up (6.10 - 8.90 s)
//
// 60 mm at 1.6 m from the lens, wide open. The hand has left the key; the key is still moving; the candle stands in the grass
// beyond the keyboard and is the only light close enough to shape the ivories. Dust hangs in the low sun. Nothing
// happens except the note dying, which is the point: a documentary gives a sound time to leave the frame.
'use strict';
shot({
  film: 'piano',
  id: 'S3', start: 6.10, dur: 2.80,
  meta: {
    scene: 'piano keyboard raking to the candle, close-up', size: 'close-up', lens: '60mm f/2.0', motion: 'locked off, holding',
    transition: 'cut on the release of the key',
    reads: ['6.1-6.6 the keys, raking away from the lens', '6.6-7.4 the candle at the far end of the keyboard',
      '7.4-8.4 dust in the low light; the note is still going', '8.4-8.9 the flame leans; nothing else moves'],
  },
  light(lt) {
    lightUse('lategold');
    LIGHT.sun.intensity = 1.86;
    // the candle is close enough here to matter: it is the warm side of the ivory
    lightPoint([-0.62, 0.215, 1.55], hexLin('#ffb066'), 2.6, 0.62);
  },
  cam: (lt) => getThing('camera', 's3')(lt),
  dof: (lt) => { const c = getThing('camera', 's3')(lt); return { focus: c.focus, aperture: c.aperture }; },
  draw({ t }) {
    drawFieldBase(t);
    drawWoman(t);
    drawBird(birdStateAt(t), { order: 3 });
    // dust motes, lit by the sun that is coming from behind her: small, and only where the light is
    const rnd = rngFrom(91);
    for (let i = 0; i < 26; i++) {
      const x = -0.35 + rnd() * 1.4, y = 0.62 + rnd() * 0.75, z = 1.25 + rnd() * 0.5;
      const drift = Math.sin(t * 0.6 + i) * 0.02;
      billboard([x + drift, y + Math.sin(t * 0.4 + i * 2.1) * 0.01, z], 0.004, 0.004, (ctx, b) => {
        ctx.fillStyle = `rgba(255,236,206,${0.25 + rnd() * 0.3})`;
        ctx.beginPath(); ctx.arc(b.x, b.y, Math.max(0.6, b.w * 0.5), 0, TAU); ctx.fill();
      }, { depth: viewPoint(SCENE.cam, [x, y, z]).z });
    }
  },
});






