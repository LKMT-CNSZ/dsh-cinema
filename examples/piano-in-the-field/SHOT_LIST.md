# The Piano in the Field — shot list (worked example)

The production table, then the same information in the shape the code takes. If this file and
`src/world/cameras.js` disagree, the code is what renders; keep them equal by editing both in one change.

## Production table

| id | start | dur | size | lens | camera | scene | light | sound cues | reads | transition out |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 | 0.00 | 2.90 | wide | 35 mm f/5.6 | locked off, breath 2.2 mm | field, house, tree, piano | lategold, sun −46° / 13.6° | wind, 6 footsteps, 2 distant birds | 4 | hard cut |
| S2 | 2.90 | 3.20 | medium | 50 mm f/2.4 | dolly in 1.1 m, focus 3.85→3.40 | over her left shoulder onto the keys | lategold + candle 0.95 | cloth, key press, note F#3, release | 5 | hard cut on the release |
| S3 | 6.10 | 2.80 | detail | 60 mm f/2.0 | locked off, 1.55 m focus | piano leg, candle, keyboard, treeline | lategold + candle 2.6 | note tail, air | 4 | hard cut |
| S4 | 8.90 | 1.70 | medium wide | 35 mm f/2.8 | tilt up 9° (carry-through) | beside her shoulder, bird on the lid | lategold | wingbeats, wind | 4 | hard cut |
| S5 | 10.60 | 1.40 | wide | 35 mm f/5.6 | locked off, breath 2.4 mm | field, wide (rhyme) | lategold, intensity −10 % | wind fades | 3 | fade to black 0.45 s |

Total 12.00 s = `PROJECT.duration`. Frame counts at 24 fps: 70 + 77 + 67 + 41 + 33 = 288.

## Timing budget

| segment | seconds | share |
|---|---|---|
| establishing (S1) | 2.90 | 24 % |
| human action (S2) | 3.20 | 27 % |
| aftermath / detail (S3) | 2.80 | 23 % |
| the event (S4) | 1.70 | 14 % |
| echo (S5) | 1.40 | 12 % |

The two shots that carry meaning (S2 contact, S3 listening) get more than half the film; the event itself is the shortest
full shot. That proportion is the directorial decision: this is not a film about a bird.

## In code

```js
// src/shots/s1_field.js
shot({
  id: 'S1', start: 0.00, dur: 2.90,
  meta: { scene: 'field, wide', size: 'wide', lens: '35mm f/5.6', motion: 'locked off, tripod breath',
          transition: 'fade in from black (0.55 s)', reads: [ /* four timed reads */ ] },
  light(lt) { lightUse('lategold'); LIGHT.sun.intensity = 1.92 + 0.10 * smoothstep01(seg(lt, 0.6, 2.9));
              lightPoint([-0.62, 0.215, 1.55], hexLin('#ffb066'), 0.55, 0.5); },
  cam: (lt) => getThing('camera', 's1')(lt),
  draw({ t }) { drawFieldBase(t); drawWoman(t); drawBird(birdStateAt(t), { order: 3 }); },
  fadeIn: 0.55, fadeColor: '#07080c',
});
```

```js
// src/world/cameras.js  (the description the shot calls; focal here is what renders)
defineThing('camera', 's1', (lt) => {
  const b = CAM.breath(lt, 0.0022, 3, 0.5);
  return { pos: [-1.62 + b[0], 1.38 + b[1], -6.35 + b[2]], target: [0.32, 1.06, 0.85],
           focal: 35, focus: 7.2, aperture: 5.6, motion: 'locked off, tripod breath' };
});
```

## Per-shot parameters

### S1 — establishing
- camera (m): pos (−1.62, 1.38, −6.35), target (0.32, 1.06, 0.85), focal 35, focus 7.2, aperture 5.6, breath 2.2 mm.
- light: `lategold`; sun direction (−0.70, 0.235, 0.67) normalised; intensity 1.92→2.02; exposure 0.84; candle practical
  0.55 at (−0.62, 0.215, 1.55).
- budget: ~110 surfaces (ground, treeline 108 billboards, house 25, tree 60, piano 22, candle 4, tufts 54, woman 25, bird 7).
- QA: `single instance`, `bone length drift`, `feet-on-ground`, `key-contact` (idle), camera-jump rule.

### S2 — over her shoulder
- camera: dolly (3.05, 1.56, 3.62) → (2.28, 1.43, 2.78) over 0.15–3.0 s local, focus 3.85 → 2.75 m, f/2.4.
- depth of field: `dof: (lt) => ({ focus, aperture })`, 4 bands, half-resolution blur.
- light: `lategold`, candle 0.95.
- QA: `key-contact` (P0, 30 mm for 4.22–4.62), `single instance`.

### S3 — the candle
- camera (m): pos (−0.02, 0.505, 2.98), target (−0.60, 0.300, 1.50), focal 60, focus 1.55, aperture 2.0, breath 1.2 mm.
- light: `lategold`, candle 2.6 inside 0.62 m.
- QA: `single instance`, `feet-on-ground` (she is off-frame but the solver still runs).

### S4 — the departure
- camera (m): pos (3.55, 1.74, 1.15), target (0.35, 1.62, 0.55) → (0.72, 2.18, 0.40) over local 0.45–1.5 s, focal 35, f/2.8.
- light: `lategold`.
- QA: `single instance` (`bird` count must be exactly 1 — the defect this film's predecessor had).

### S5 — the echo
- camera (m): pos (−1.86, 1.41, −6.20), target (0.50, 1.07, 0.88), focal 35, focus 7.1, f/5.6, breath 2.4 mm.
- light: `lategold`, intensity 1.90 → 1.80.
- QA: `single instance`; the repeat check should report the S1/S5 pair as the opening/closing rhyme (P2), not a defect.

## Cue sheet (audio/cues.json)

| cue | t (s) | intent |
|---|---|---|
| footstep 1 | 0.16 | she is already walking when we find her |
| footstep 5 | 1.96 | the settle step |
| cloth reach | 3.30 | the arm moving inside the coat |
| key press | 4.222 | touch + wooden knock |
| note F#3 | 4.235 | the film's one sound |
| key release | 4.625 | masked by the note, by design |
| bird takeoff | 9.18 | the event, heard before it is seen |
| wingbeat 3 | 9.55 | receding, panning left |
| end of wind | 11.95 | fade (exempt from the audibility rule) |
