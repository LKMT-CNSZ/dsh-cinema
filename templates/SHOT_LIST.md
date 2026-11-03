# Shot list — The Piano in the Field

The production view of the same film the storyboard describes. The timeline and this table must not drift: the `meta` object in each `shot()` repeats the row, and every camera number below is read from `defineThing('camera', …)` in `src/world/cameras.js`. Where a `meta` string and the code disagree, **the code is authoritative** and the drift is listed in section 5. Lens values are focal lengths on a 36 mm sensor; horizontal field of view is `2·atan(18/f)` — 54.4° at 35 mm, 39.6° at 50 mm, 33.4° at 60 mm, 23.9° at 85 mm.

## 1 · Production table

| id | start (s) | dur (s) | size | lens: meta → code focal | camera move | scene | light preset | sound cues | transition out | reads |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 | 0.000 | 2.900 | wide | 32mm → 35 mm, f/5.6 | locked off, tripod breath | field, wide | lategold | footsteps 1–5, chirps 1.05/1.24 | hard cut at 2.900 | 4 |
| S2 | 2.900 | 3.200 | medium | 40mm → 50 mm, f/2.4 | dolly in 1.15 m, focus pull 3.85 → 2.75 m | field, medium over her shoulder | lategold | cloth 3.30, key 4.20/4.222, note 4.235, release 4.625, cloth 4.85 | hard cut at 6.100 | 5 |
| S3 | 6.100 | 2.800 | close-up | 85mm → 60 mm, f/2.0 | locked off, holding | piano keyboard raking to the candle, close-up | lategold | note tail only (to 11.635) | hard cut at 8.900 | 4 |
| S4 | 8.900 | 1.700 | medium wide | 45mm → 35 mm, f/2.8 | tilt up 10.7°, target y 1.62 → 2.18 m | field, medium wide from behind the piano | lategold | takeoff 9.18, 7 wingbeats to 10.254 | hard cut at 10.600 | 4 |
| S5 | 10.600 | 1.400 | wide | 32mm → 35 mm, f/5.6 | locked off, tripod breath | field, wide (opening rhyme) | lategold | chirps 10.62/10.80, wind ends 11.95 | fade to black 0.45 s | 3 |

All five shots run on one light: `lightUse('lategold')`, with `LIGHT.sun.dir` overwritten at boot by `WORLD.sunDir = vnorm([-0.70, 0.235, 0.67])`. The preset supplies colour, sky, haze and exposure 0.80; the shots supply sun intensity (1.86–2.02) and one `lightPoint` for the candle.

## 2 · Timing budget

| shot | start | dur | end | frames at 24 fps | what the cut is for |
|---|---|---|---|---|---|
| S1 | 0.000 | 2.900 | 2.900 | 69.6 | she stops; the walk has been watched long enough |
| S2 | 2.900 | 3.200 | 6.100 | 76.8 | the press is over; the shot waits 1.48 s on her listening |
| S3 | 6.100 | 2.800 | 8.900 | 67.2 | the note has been given time; she turns to the bird |
| S4 | 8.900 | 1.700 | 10.600 | 40.8 | the bird is out of frame |
| S5 | 10.600 | 1.400 | 12.000 | 33.6 | the hold is over; fade |
| **total** | **0.000** | **12.000** | **12.000** | **288.0** | must equal `PROJECT.duration` (12.0) exactly |

`finishTimeline()` asserts the sum: shots must be contiguous, non-overlapping and end at `PROJECT.duration` (±1e−6), otherwise every frame of the sweep carries a P0 `timeline` issue. Frames are `dur × fps`; the total is exactly 288, and every cut time falls on a fractional frame (2.900 s = frame 69.6, 6.100 = 146.4, 8.900 = 213.6, 10.600 = 254.4), so no frame sits on a cut — do not rely on that: the sweep walks integer frames and `shotAt(t)` assigns each one to exactly one shot.

## 3 · Shot parameters, in the shape of the code

### S1 — `src/shots/s1_field.js`

```js
shot({
  id: 'S1', start: 0.00, dur: 2.90,
  meta: {
    scene: 'field, wide', size: 'wide', lens: '32mm', motion: 'locked off, tripod breath',
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
  fadeIn: 0.55, fadeColor: '#07080c',
});
```

```js
defineThing('camera', 's1', (lt) => {
  const b = CAM.breath(lt, 0.0022, 3, 0.5);
  return {
    pos: [-1.62 + b[0], 1.38 + b[1], -6.35 + b[2]],
    target: [0.32, 1.06, 0.85],
    focal: 35, focus: 7.2, aperture: 5.6,
    motion: 'locked off, tripod breath',
  };
});
```

### S2 — `src/shots/s2_approach.js`

```js
shot({
  id: 'S2', start: 2.90, dur: 3.20,
  meta: {
    scene: 'field, medium over her shoulder', size: 'medium', lens: '40mm f/2.4',
    motion: 'dolly in 1.1 m, focus pull',
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
});
```

```js
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
```

### S3 — `src/shots/s3_hands.js`

```js
shot({
  id: 'S3', start: 6.10, dur: 2.80,
  meta: {
    scene: 'piano keyboard raking to the candle, close-up', size: 'close-up', lens: '85mm f/2.0',
    motion: 'locked off, holding',
    transition: 'cut on the release of the key',
    reads: ['6.1-6.6 the keys, raking away from the lens', '6.6-7.4 the candle at the far end of the keyboard',
      '7.4-8.4 dust in the low light; the note is still going', '8.4-8.9 the flame moves; the flame leans, nothing else moves'],
  },
  light(lt) {
    lightUse('lategold');
    LIGHT.sun.intensity = 1.86;
    lightPoint([-0.62, 0.215, 1.55], hexLin('#ffb066'), 2.6, 0.62);
  },
  cam: (lt) => getThing('camera', 's3')(lt),
  dof: (lt) => { const c = getThing('camera', 's3')(lt); return { focus: c.focus, aperture: c.aperture }; },
});
```

```js
defineThing('camera', 's3', (lt) => {
  const b = CAM.breath(lt, 0.0012, 7, 0.3);
  return {
    pos: [-0.02 + b[0], 0.505 + b[1], 2.98 + b[2]],
    target: [-0.60, 0.300, 1.50],
    focal: 60, focus: 1.55, aperture: 2.0,
    motion: 'locked off close-up, holding on the keys',
  };
});
```

### S4 — `src/shots/s4_flight.js`

```js
shot({
  id: 'S4', start: 8.90, dur: 1.70,
  meta: {
    scene: 'field, medium wide from behind the piano', size: 'medium wide', lens: '45mm f/3.2',
    motion: 'tilt up 10.7 deg following the bird',
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
});
```

```js
defineThing('camera', 's4', (lt) => {
  const tilt = smoothstep01(seg(lt, 0.45, 1.5));
  const b = CAM.breath(lt, 0.002, 9, 0.45);
  return {
    pos: [3.55 + b[0], 1.74 + b[1], 1.15 + b[2]],
    target: [lerp(0.35, 0.72, tilt), lerp(1.62, 2.18, tilt), lerp(0.55, 0.40, tilt)],
    focal: 35, focus: lerp(3.1, 3.7, tilt), aperture: 2.8,
    motion: 'tilt up 10.7 deg following the bird out of frame',
  };
});
```

### S5 — `src/shots/s5_after.js`

```js
shot({
  id: 'S5', start: 10.60, dur: 1.40,
  meta: {
    scene: 'field, wide (opening rhyme)', size: 'wide', lens: '32mm', motion: 'locked off, tripod breath',
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
  draw({ t }) { drawFieldBase(t); drawWoman(t); },   // no bird: it left in S4
  fadeOut: 0.45, fadeColor: '#07080c',
});
```

```js
defineThing('camera', 's5', (lt) => {
  const b = CAM.breath(lt, 0.0024, 11, 0.45);
  return {
    pos: [-1.86 + b[0], 1.41 + b[1], -6.20 + b[2]],
    target: [0.50, 1.07, 0.88],
    focal: 35, focus: 7.1, aperture: 5.6,
    motion: 'locked off, tripod breath',
  };
});
```

## 4 · Ids and placements the shots may reference

No shot file may invent a position, a prop or a person. Everything below is defined once and referenced by id.

| kind | id | placement / value |
|---|---|---|
| environment | `field` | `FIELD` layout, `ground`, `scenery`, `grass`, `piano`, `wind`, `birdPos`, `birdState` |
| character | `woman` | height 1.67 m, coat mid-calf, pose = `womanPoseOnKey(t)` of film time |
| prop | `piano` | `placeProp('piano', {x: 0.30, z: 0.40, yaw: -12})`, case 0.94 m, lid 34°, `keyPoint(0.44)` |
| prop | `house` | `placeProp('house', {x: -11.5, z: 26.0, yaw: 8})`, 8.6 × 6.4 × 3.5 m, eave 3.94 m |
| prop | `tree` | `placeProp('tree', {x: 6.6, z: 14.5, yaw: 4})`, trunk 2.35 m |
| prop | `stones` | near (3.15, 2.35) spread 2.6; by the house (−5.4, 13.2) spread 4.5 |
| prop | `tufts` | (0.4, 1.2), spread 11 × 9, count 54 |
| prop | `candle` | (−0.62, 0, 1.55), wax 0.16 m, flame and shot light at y 0.215 |
| prop | `bird` | perch (0.851, 1.778, 0.211), yaw 258°, wingspan 0.58 m, takeoff 9.18 |
| camera | `s1`…`s5` | section 3 |

## 5 · Documentation drift in the reference film

The template is a regression test for defects, and it has a few of its own. Fix them in a new film instead of copying them.

| where | what the text says | what the code does | fix |
|---|---|---|---|
| `meta.lens`, all five shots | 35/50/60/35/35 mm | 35/50/60/35/35 mm in `cameras.js` | correct `meta.lens` to the code, or the code to the intent |
| S2 `meta.motion` | "dolly in 1.1 m" | travel is 1.15 m: (3.05, 1.56, 3.62) → (2.28, 1.43, 2.78) | write the measured travel |
| S3 `meta.motion` and file comment | "60 mm at 1.6 m" | 60 mm, target 1.55 m | decide which lens the shot is and make both agree |
| S4 `meta.motion` | "tilt up 10.7 deg" | 10.7°: `asin(0.44/2.96)` vs `asin(−0.12/3.26)` | write 10.6, or change the target |
| S5 `meta.transition` | "cut from the bird leaving" | the cut lands at 10.600, 0.15 s after the bird is out of frame (10.45) and 0.35 s after the last wingbeat (10.254) | describe the cut by its time, not by its cause |

## 6 · Blank production table — a new film

| id | start (s) | dur (s) | size | lens | camera move | scene | light preset | sound cues | transition out | reads |
|---|---|---|---|---|---|---|---|---|---|---|
| | | | | | | | | | | |
| | | | | | | | | | | |
| | | | | | | | | | | |

| shot | start | dur | end | frames | what the cut is for |
|---|---|---|---|---|---|
| | | | | | |
| | | | | | |


## The 2.5D columns

A shot list for this system has one more block per shot than a photographic one, because the depth structure is a decision
made before the shot is animated, not after.

| column | what goes in it | example |
|---|---|---|
| route | which tier carries the shot | `2.5D plates + local 3D piano` |
| planes | every plate, its world anchor and its band | `far [-60] treeline @ z 88 · mid [-16] house @ (-11.5, 26) · mid+1 tree @ (6.6, 14.5) · fore [28] grass @ z -4.5` |
| local 3D | what is actually modelled | `piano, figure, cast shadows, ground` |
| budget | the eight quantities, declared | `945/141/4/18/4/1/0/1` (plate marks / 3D surfaces / movers / materials / plates / figures / interactions / camera behaviours) |
| motion clocks | which ambient elements move, and how fast | `wind 4.7+11.3 s (grass 1.3 s wave), branch 1.9+0.73 s, clouds 57+23 s, light 37 s` |
| horizon | its height in frame and what it does across cuts | `0.39 H, matched within 3 px at 7.40 s` |
