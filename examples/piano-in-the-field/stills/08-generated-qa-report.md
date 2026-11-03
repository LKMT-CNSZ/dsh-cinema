# QA report - film

Generated 2026-11-03T05:21:11.919Z. Every number below came from rendering the actual frames in headless Chrome; nothing here is estimated.

## 1. Technical spec

| item | value |
|---|---|
| duration | 12 s |
| frame rate | 24 fps |
| resolution | 1920 x 1080 |
| shots | 5 |
| render cost | 73.2 ms/frame |
| audio | assets/score.m4a (12s) |

## 2. Shots and their measured character

| shot | start | dur | scene | size | lens | camera | mean | std | edge | frames |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 | 0s | 2.9s | field, wide | wide | 35mm f/5.6 | locked off, tripod breath | 83.5 | 23.6 | 24.3 | 70 |
| S2 | 2.9s | 3.2s | field, medium over her shoulder | medium | 50mm f/2.4 | dolly in 1.1 m, focus pull | 67.1 | 32.6 | 24.3 | 77 |
| S3 | 6.1s | 2.8s | piano keyboard raking to the candle, close-up | close-up | 60mm f/2.0 | locked off, holding | 49.5 | 24.9 | 19 | 67 |
| S4 | 8.9s | 1.7s | field, medium wide from behind the piano | medium wide | 35mm f/2.8 | tilt up 10.7 deg following the bird | 88.5 | 37.1 | 18.5 | 41 |
| S5 | 10.6s | 1.4s | field, wide (opening rhyme) | wide | 35mm f/5.6 | locked off, tripod breath | 79.8 | 22.5 | 23.2 | 33 |

## 3. Issues

**P0 (blocking): 0** &nbsp; **P1 (must fix): 0** &nbsp; **P2 (reviewed): 0**

### P0 - 0

_none_

### P1 - 0

_none_

### P2 - 0

_none_

## 4. Audio (measured)

file: `audio/score.wav` · 12s

| measurement | RMS | what it should show |
|---|---|---|
| bed (0.3-3.6 s) | 0.0387 | the field is never silent |
| pre-note (4.00-4.20 s) | 0.0105 | quieter than the bed: the air holds its breath |
| note peak (4.24-4.6 s) | 0.7466 | one attack, well above the bed |
| note tail (6.2-6.4 s) | 0.1792 | the note outlives its cause |
| wingbeats (9.18-9.7 s) | 0.0779 | above the bed |
| end (11.5-11.95 s) | 0.0156 | fading out |

| cue | at (s) | after/before | nearest onset |
|---|---|---|---|
| footstep 1 | 0.16 | 3.04 | 0.15 |
| footstep 4 | 1.27 | 1.68 | 1.25 |
| settle step | 2.4 | 2.27 | 2.4 |
| cloth reach | 3.3 | 1.21 | 2.4 |
| key press | 4.222 | 13.49 | 4.2 |
| note F#3 | 4.235 | 16.24 | 4.25 |
| key release | 4.625 | (fade/masked) | - |
| bird takeoff | 9.18 | 0.89 | 4.25 |
| wingbeat 3 | 9.538 | 0.93 | 4.25 |
| end of wind | 11.95 | (fade/masked) | - |

## 5. Rules applied

| rule | value | meaning |
|---|---|---|
| emptyStd | 2.5 | frame variance below this = nothing drawn |
| blackMean | 3 | mean luma below this = black frame |
| whiteFrac | 0.985 | this fraction of near-white pixels = blown |
| darkMean | 12 | mean luma below this = underexposed frame (P1) |
| darkFrac | 0.9 | this fraction of near-black pixels with a dark mean = hole |
| camPosJump | 0.16 | camera moved further than this between adjacent frames = jump |
| camYawJump | 4.5 | camera direction changed more than this between adjacent frames = snap |
| camFocalJump | 1.5 | focal length changed more than this between adjacent frames |
| sunDrift | 0.035 | sun direction changed more than this at a cut = continuity error |
| exposureDrift | 0.35 | exposure changed more than this at a cut |
| msPerFrameWarn | 1200 | render slower than this earns a performance note |
| edgeBusy | 95 | mean gradient above this = busy/noisy frame |
| stillFrames | 24 | frames with no change before a stillness note |
| repeatSigDiff | 1.2 | two shots closer than this are reported as possibly repeated |

## 5. Verdict

P0 and P1 are clear: the automated pass found nothing that blocks delivery. P2 items still need a human look.
