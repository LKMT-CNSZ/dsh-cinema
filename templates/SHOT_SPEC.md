# Shot spec — S2 · the medium over her shoulder

One shot, written as engineering before a line of it is coded. This document is the contract the shot file is written against: if a number here is not in `src/world/cameras.js` or `src/world/environment.js`, it is a position the shot invented, which is the defect the registries exist to prevent. Worked example: **S2 of The Piano in the Field** (2.900–6.100 s, the key press); a blank skeleton follows in section 11.

| field | value |
|---|---|
| shot id | S2 |
| scene | field, medium over her shoulder |
| film time | 2.900–6.100 s (dur 3.200 s, 76.8 frames at 24 fps) |
| lens | 50 mm on a 36 mm sensor, 39.6° horizontal, f/2.4 (meta says 50 mm — resolve before coding) |
| shot file | `src/shots/s2_approach.js` |
| status | specified → built → reviewed |

## 1 · Intent

One sentence, and it must contain a verb, an object and a reason to be a shot: **make a finger pressing one key feel physical, and let attention move from the person to the act while the sound outlives both.**

## 2 · Read timing

| # | window (s) | what must be legible | how it is staged |
|---|---|---|---|
| 1 | 2.9–3.6 | she is at the piano, left hand finding the key bed | left wrist lerps to the key-bed front edge over 3.02–3.92 s |
| 2 | 3.6–4.2 | the right hand anticipates and reaches | 3 cm pull-back 3.55–3.70 s, then a Bézier arc whose control point is 0.31 m above the key |
| 3 | 4.2–4.6 | contact: one key goes down 6 mm | `womanPoseOnKey` contact solve to < 4 mm, key depth `smoothstep(4.22, 4.27)` |
| 4 | 4.6–5.4 | she releases and withdraws; the note keeps going | release from 4.62 s, withdraw to 5.30 s, spring overshoot from 5.18 s |
| 5 | 5.4–6.1 | she listens | head holds down until 6.4 s, chest and shoulders settle |

## 3 · Staging, in metres

Coordinate note: **+Y up, ground at y = 0, +X east, +Z north, yaw in degrees about +Y (0 = facing +Z)**. Nothing is drawn from measured pixels; the camera projects this world.

```text
                    +Z (north, away from the S1 camera)
   +4.55  ●  CAM start (3.05, 1.56, 3.62)  target (0.30, 1.10, 1.30)
   +2.78  ○  CAM end   (2.28, 1.43, 2.78)  target (0.26, 1.04, 1.22)   travel 1.15 m
   +1.78  ▮  WOMAN root (0.02, 0.92, 1.78) yaw 168°  → left hand to key-bed front edge
   +1.55  ✳  CANDLE (-0.62, 0, 1.55), flame and shot light at y = 0.215
   +0.40  ▭  PIANO origin (0.30, 0, 0.40) yaw −12°, case 0.94 m, lid 34°
    0.00  ───────────────  ground y = 0  ───────────────
          x: −0.62        +0.02      +0.30   +0.82  +1.05   (east →)
```

| object | x | y | z | yaw | note |
|---|---|---|---|---|---|
| camera (start) | 1.05 | 1.42 | 4.55 | — | 3.35 m from its target; `CAM.breath(lt, 0.0018, 5, 0.4)` |
| camera (end) | 0.82 | 1.36 | 4.12 | — | 2.97 m from its target; dolly by `easeInOutCubic(seg(lt, 0.15, 3.0))` |
| the woman | 0.02 | 0.92 (root) | 1.78 | 168° | ankles ±0.078 m lateral, ankle height 0.075 m |
| piano | 0.30 | 0 | 0.40 | −12° | `placeProp('piano', …)`; no shot may re-place it |
| key-bed front edge | piano-local (0.32, 0.735, 1.205) | | | | left-hand target adds (0, 0.075, 0.055) |
| the key she plays | `keyPoint(0.44)` | | | | probe it before staging; right wrist adds (0.015, 0.118, 0.03) |
| candle | −0.62 | 0 | 1.55 | — | wax 0.16 m, flame 0.215 m |
| bird (perched, drawn) | 0.851 | 1.778 | 0.211 | 258° | drawn in this shot too — it sits on the lid ~10° off the lens axis, so do not assume it is out of frame |

```bash
node scripts/probe.mjs "womanKeyPoint()" "JSON.stringify(pianoPlace())" "solveSkeleton(womanPoseOnKey(4.30)).wristR"
```

## 4 · Camera block

| parameter | value |
|---|---|
| pos | (3.05, 1.56, 3.62) → (2.28, 1.43, 2.78), `lerp` per axis on `k = easeInOutCubic(seg(lt, 0.15, 3.0))` |
| target | (0.30, 1.10, 1.30) → (0.26, 1.04, 1.22) — same `k` |
| focal | 50 mm on 36 mm: 39.6° horizontal, `focalPx = 50/36 × 1920 = 2666.7` |
| focus | 3.85 → 2.75 m, `easeInOutCubic(seg(lt, 1.0, 2.6))` |
| aperture | f/2.4; `dof` returns `{focus, aperture}` so the renderer splits the frame into 4 depth bands at 0, 0.7×, 1.6× and 4× the focus distance |
| move | dolly in 1.15 m; no pan, no roll; height drops 1.42 → 1.36 m |
| breath | 0.0018 m, seed 5, speed 0.4 — sub-centimetre, two noise channels |

**Check the pull against real distances before coding.** With the camera at z = 4.12 the key bed is ≈ 2.74 m from the lens and her shoulder ≈ 2.5 m, so `focus 3.85 → 2.75` is a pull that ends 0.66 m *beyond* the keys: at f/2.4 (CoC ≈ 5 px on the subject) it reads as a soft subject, not as a rack onto the hand. If the pull is meant to land on the key bed, author it from the probe: `focus: lerp(2.5, 2.75, k)`.

## 5 · Light block

| parameter | value |
|---|---|
| preset | `lightUse('lategold')` — sun colour `[1.0, 0.72, 0.45]`, sky up `[0.16, 0.26, 0.48]`, horizon `[0.54, 0.47, 0.42]`, bounce `[0.20, 0.17, 0.13]`, sky intensity 0.34, contrast 0.24 |
| sun direction | film constant `vnorm([-0.70, 0.235, 0.67])`; in this shot it is 121° off the lens axis, behind the camera's right shoulder — side-front light, not backlight |
| sun intensity | 2.02 (the film ranges 1.86–2.02; direction may not change at a cut) |
| practical | `lightPoint([-0.62, 0.215, 1.55], hexLin('#ffb066'), 0.95, 0.75)` — candle, inverse-square over a 0.75 m radius |
| second practical | the candle prop registers its own point at (−0.62, 0.195, 1.55), intensity 0.35, radius 0.55 m, unless `build` is called with `light: false`; the shot's point sits on top of it |
| exposure | 0.80, from the preset (`LIGHT.exposure`), not per shot |

**A rule of this rig:** shading happens when a surface is built, not when the frame is flushed — `poly3`, `box` and `tube` call `surfaceColor` immediately. A `lightPoint` registered after a surface was built does not light it. That is why the candle's light is registered in `light(lt)` (before `draw`) and why the prop's own point only affects geometry drawn after it. Order of calls is part of the lighting design.

## 6 · Materials

Ids as they exist in `MAT` (`src/engine/materials.js`); one texture routine per material, no shared "texture logic".

| surface | material id | what it must show |
|---|---|---|
| piano case and lid | `lacquer` | near-black, rough 0.16, strong sky reflection; the lid plate at 34° |
| piano sides | `lacquerSide` | rough 0.34, less mirror than the lid |
| key bed / key slip | `wood`, `woodPale` | grain, not noise |
| keys | `ivory` | `#f2ead4`, rough 0.55; the only bright surface near the lens |
| pedals, prop stick, castors | `brass`, `metalDark` | specular only where a named light reaches |
| the woman | `silhouette` | one material for the whole figure: coat, hair, boots (`clothWool` exists but the film's figure is not drawn with it) |
| candle | `wax` | `#e3d7bb`; the flame itself is a drawn radial-gradient billboard, not a material |
| ground, tufts | `grassGround`, `foliageDry` | thousands of strokes, different sizes |
| house, stones, tree, drop | `plaster`, `wood`, `glassDark`, `brick`, `roofSlate`, `stone`, `bark` | background: the house at 18 % haze, the near stones and tufts much less |

## 7 · Geometry budget

The renderer is a painter's algorithm over convex surfaces; cost is roughly linear in the number of draw operations, and one 1080p frame is 200–900 ms on a modern machine (the reference film averages ~110 ms). State a budget *before* coding and measure it after:

| measure | how to read it | budget for this shot |
|---|---|---|
| quads | `node scripts/probe.mjs "drawFrame(4.22); JSON.stringify(SCENE.stats)"` | `<measured>` at first build; +20 % allowed, then re-measure ms/frame |
| ops (depth-sorted draw commands) | same call, `SCENE.stats.ops` | `<measured>` |
| ms/frame | `node render.mjs --qa --out=out/qa` prints it; `RULES.msPerFrameWarn` is 1200 | under 1200, ideally near the film's average |
| depth bands | set by `dof`; 4 bands at half resolution | 4 — do not add bands for one shot |

## 8 · Motion list

Everything that moves, its closed form, and what the movement is *for*. Nothing may be left to a solver.

| what | closed form | function |
|---|---|---|
| camera | axis `lerp` on `easeInOutCubic` + `CAM.breath` | closes 1.15 m; the move carries "attention moving in" |
| focus | `lerp(3.85, 2.75, easeInOutCubic(seg(lt, 1.0, 2.6)))` | the pull is the shot's idea (see section 4 for the distance check) |
| left hand | `smoothstep(3.02, 3.92)` to the key-bed front edge | the body claims the instrument before the right hand acts |
| right hand | anticipation, then `bez2v(restBack, approachCtl, keyWrist, reach)`, hold, withdraw | an arc, not a line: hands do not travel straight to objects |
| key | `smoothstep(4.22, 4.27)` down, release by 4.70, 6 mm total | the only object the film touches |
| torso | `chestTwist −9°` and `chestFwd +2.6°` with the reach, decaying by 5.5 s | the reach has weight |
| head | look target with a 110 ms lag; down at 4.75, off the keys at 6.4 | head, chest and shoulder arrive at three different times |
| coat | `coatSway` from yaw rate, `coatLift` from the step phase | secondary motion, never the subject of a frame |
| candle | flame scale `1 + sin(11.3t + 0.7) 0.14 + sin(23.1t) 0.07` | the only light in the film that visibly lives |

## 9 · QA hooks

Probes registered by the world, and the sweep rules that will judge this shot. Tolerances are numbers, so a failure can be argued with.

| hook | source | tolerance / rule |
|---|---|---|
| `woman.key-contact` | `src/world/characters.js` | fingertip within **0.03 m** of `womanKeyPoint()` during 4.23–4.61 s; failure is P0 |
| `woman.feet-on-ground` | `src/world/characters.js` | lowest ankle between **0.05 and 0.11 m** every frame; failure is P0 |
| `single instance` | `src/engine/qa.js` | piano, house, tree, woman, bird, treeline each drawn once per frame; twice is P0 |
| `qaContact(label, a, b, tolerance = 0.02)` | `src/engine/qa.js` | any hand/tool contact the shot asserts: 0.02 m, P1 `contact gap` |
| `qaPropRest` / `qaGroundContact` | `src/engine/qa.js` | prop bottom within 0.02 m of the ground; no joint below −0.005 m |
| `qaBoneLengths` | `src/engine/qa.js` | every bone within 2 % of its rest length, or P0 `bone length drift` |
| camera continuity | `scripts/qa.mjs` | ≤ 0.16 m, ≤ 4.5°, ≤ 1.5 mm between adjacent frames (P0) |
| lighting continuity | `scripts/qa.mjs` | sun ≤ 0.035° and exposure ≤ 0.35 change at a cut (P1) |
| frame statistics | `scripts/qa.mjs` | `std` < 2.5, `mean` < 3, `white` > 0.985 are P0; `mean` < 12 and `black` > 0.9 with `mean` < 20 are P1; `edge` > 95 is P2 |
| held still | `scripts/qa.mjs` | 24 frames with no change is reported, not failed — a hold is legal |

## 10 · Review commands

One sheet per shot, one strip per motion, one crop per contact. Open each image and check the reads in section 2 against it; a claim about the shot that did not come from an image is a guess.

```bash
# the five marks of the shot, side by side
node render.mjs --sheet=2.9,3.6,4.22,4.6,5.4 --cols=5 --w=640 --out=out/check/s2_marks.jpg
# every frame of the press (4.10-4.32), to judge the contact and the key travel
node render.mjs --strip=4.10:4.32 --cols=11 --w=320 --out=out/check/s2_press.jpg
# full-res detail of the hand and the key bed
node render.mjs --sheet=4.30 --crop=900,430,420,360 --w=600 --out=out/check/s2_hand.jpg
# a crop that follows the key bed through the whole reach, in world metres
node render.mjs --strip=3.7:4.3 --crop-at=0.05,0.78,1.57,560,420 --out=out/check/s2_key.jpg
# once the stills are right: the shot as a clip with the score
node render.mjs --clip --range=2.9:6.1 --audio=assets/score.m4a --out=out/check/s2.mp4
```

`--crop` takes screen pixels `x,y,w,h`; `--crop-at` takes a world point `x,y,z` then `w,h` and re-projects it every frame, which is the only honest way to check a contact while the camera moves. `--range` re-renders only the affected seconds when something is fixed.

## 11 · Blank spec — copy for the next shot

| field | value |
|---|---|
| shot id | |
| scene | |
| film time / duration / frames | |
| lens | focal / horizontal FOV / f-number |
| shot file | |
| intent (one sentence) | |

| # | window (s) | what must be legible | how it is staged |
|---|---|---|---|
| 1 | | | |
| 2 | | | |
| 3 | | | |

| object | x | y | z | yaw | note |
|---|---|---|---|---|---|
| camera | | | | | |
| subject | | | | | |
| prop | | | | | |
| practical | | | | | |

| block | fields |
|---|---|
| camera | pos / target / focal / focus / aperture / move / breath / dof |
| light | preset / sun direction / sun intensity / practicals / exposure |
| materials | one material id per surface |
| geometry budget | quads / ops / ms-per-frame, measured with `SCENE.stats` |
| motion | what moves, closed form, function |
| QA hooks | probes that apply, contact tolerances, which RULES catch this shot |

Review commands (`--sheet`, `--strip`, `--crop-at`, `--clip --range`) and the reviewer's signature belong under this line.


## The 2.5D shot specification

Fill this in for every shot before writing the draw function. A shot that cannot fill the planes block does not have a
space yet, and a shot that cannot fill the budget block has not been thought about.

```js
shot({
  film: 'wind', id: 'W1', start: 0.00, dur: 7.40,
  meta: {
    scene: 'the field, panorama', size: 'panorama', lens: '32mm f/5.6',
    motion: 'slow dolly left 0.5 m and in 0.7 m',
    transition: 'fade in 0.6 s',
    horizon: 0.39,           // fraction of frame height
    reads: ['...'],
  },
  // what this shot is allowed to spend; QA measures it and fails overruns
  budget: { plateFills: 1000, surfaces3d: 170, movers: 5, materials: 20, layers: 4, figures: 1, interactions: 0, cameraMoves: 2 },
  // the sky is a function of time here, because cloud density and drift are on the ambient clocks
  sky: (t) => ({ clouds: true, cloudDensity: AMBIENT.cloudDensity(t), cloudDrift: AMBIENT.cloudOffset(t, 0), cloudDrift2: AMBIENT.cloudOffset(t, 1) }),
  // the light rig: one sun, and a fractional-stop drift over ~40 s (never a dimmer)
  light(lt, t) { lightUse('lategold'); LIGHT.exposure *= AMBIENT.exposureDrift(t); },
  cam: (lt) => getThing('camera', 'w1')(lt),
  // draw order = far to near, and the order is the occlusion
  draw({ t }) { panoFar(t); fieldGround(); panoHouse(t); panoTree(t); panoHero(t); panoFore(t, 'foreA'); panoBird(t); },
});
```

**Planes block**

| plate | anchor (m) | band | painted size | detail marks | motion |
|---|---|---|---|---|---|
| | | | | | |

**What is local 3D, and why** (if the answer is "because I know how to write a box", cut it and draw it):

**What the shot spends, and what was cut to afford it**:
