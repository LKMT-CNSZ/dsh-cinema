# QA report - film

Generated 2026-11-03T06:44:31.043Z. Every number below came from rendering the actual frames in headless Chrome; nothing here is estimated.

## 1. Technical spec

| item | value |
|---|---|
| duration | 12 s |
| frame rate | 24 fps |
| resolution | 1920 x 1080 |
| shots | 2 |
| render cost | 465.1 ms/frame |
| audio | assets/score.m4a (12s) |

## 2. Shots and their measured character

| shot | start | dur | scene | size | lens | camera | mean | std | edge | frames |
|---|---|---|---|---|---|---|---|---|---|---|
| W1 | 0s | 7.4s | the field, panorama | panorama | 32mm f/5.6 | slow dolly left 0.47 m and in 0.70 m over 7.4 s, tripod breath | 83.1 | 18.3 | 23.2 | 178 |
| W2 | 7.4s | 4.6s | the field and the piano, closer | panorama, closer | 40mm f/4.0 | slow dolly in 0.45 m, tripod breath | 69.9 | 27.5 | 24.8 | 110 |

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
| bed (0.3-3.6 s) | 0.16 | the field is never silent |
| quiet stretch (4.00-4.20 s) | 0.069 | quiet stretch: below the bed |
| first event peak (4.24-4.6 s) | 0.3359 | the first event, well above the bed |
| two seconds later (6.2-6.4 s) | 0.2547 | the event is still present |
| mid-film event (9.18-9.7 s) | 0.1834 | above the bed |
| end (11.5-11.95 s) | 0.03 | fading out |

| cue | at (s) | after/before | nearest onset |
|---|---|---|---|
| gust arrives | 1.2 | 1.28 | 0.1 |
| grass rustle | 2.1 | 0.9 | 0.1 |
| bird call | 3.62 | 1.27 | 0.1 |
| strings swell | 5 | 1.76 | 0.1 |
| wood creak | 6.2 | 1.01 | 0.1 |
| second gust | 8.6 | 1.73 | 0.1 |
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
| horizonJump | 0.008 |  |
| parallaxEps | 0.6 |  |
| detailNearRatio | 1.25 |  |
| skyNoiseRatio | 1.6 |  |

## 5. Verdict

P0 and P1 are clear: the automated pass found nothing that blocks delivery. P2 items still need a human look.
