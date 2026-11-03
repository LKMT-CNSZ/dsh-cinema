# QA report — The Piano in the Field

Every number in this document must come from an artefact: a rendered frame, a measured WAV, a command's stdout. Nothing here is estimated, and nothing here is remembered. The generated half of this report (`out/qa/QA_REPORT.md` + `out/qa/report.json`, written by `scripts/qa.mjs`) supplies sections 2–4 and 6; sections 1, 5 and 7–9 are written by the person who ran the pass, because a rule engine cannot say whether a hold was intentional.

Values written `<like this>` are to be replaced with the output of the command in the same row. The worked rows — S1 in section 3, the format row in section 4, row 1 in section 8 — show the shape of a filled row against this film's real metadata. None of them is a finding.

## 1 · Environment / toolchain

| item | value | how to get it |
|---|---|---|
| OS / CPU | `<os and cpu>` | `Get-ComputerInfo` / `uname -a` |
| node | `<node --version>` | `node --version` |
| Chrome | `<version>` found at `<path>` | `render.mjs` resolves `--chrome`, then `CHROME_PATH`, then the standard Chrome paths, then the Playwright cache; a failure here exits 1 with "Chrome not found" |
| GPU / ANGLE backend | `<renderer string>` via `<d3d11 or swiftshader>` | `node render.mjs --stills=6.1 --out=out/stills` prints `GPU: …`; Windows defaults to `--use-angle=d3d11`, `--soft-gl` forces SwiftShader |
| ffmpeg | `<ffmpeg -version, first line>` | `ffmpeg -version` |
| ffprobe | `<ffprobe -version, first line>` | `ffprobe -version` |
| preflight | `<preflight output>` | `node scripts/preflight.mjs <project-dir>` (toolchain + skill integrity) |
| template version / date | `<commit or date>` | |

## 2 · Spec

| item | value |
|---|---|
| title | The Piano in the Field |
| duration | 12.0 s (`PROJECT.duration`) |
| frame rate | 24 fps (`PROJECT.fps`) |
| resolution | 1920 × 1080 (`PROJECT.width` × `PROJECT.height`), 16:9 |
| shots | 5 (S1 2.90 + S2 3.20 + S3 2.80 + S4 1.70 + S5 1.40 = 12.000) |
| render cost | `<measured>` ms/frame at 1080p (the sweep's mean; `RULES.msPerFrameWarn` = 1200) |
| audio | `assets/score.m4a`, `<duration>` s, 44100 Hz source |
| frames rendered | 288 (12.0 s × 24 fps) |
| encode | `libx264 -preset slow -crf 17 -pix_fmt yuv420p +faststart`, AAC 192k |

## 3 · Per-shot measured character

The sweep (`node render.mjs --qa`) measures a 128 × 72 downscale of every frame: `mean` luma, `std` luma, near-black fraction, near-white fraction, mean horizontal edge gradient. These are the numbers that catch an empty, black, blown, underexposed or busy frame, and the same rows feed the continuity checks.

| shot | start | dur | scene | size | lens (meta) / focal (code) | camera | mean | std | edge | black | white | frames |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| S1 | 0.000 | 2.900 | field, wide | wide | 32mm / 35 mm f/5.6 | locked off, tripod breath | `<measured>` | `<measured>` | `<measured>` | `<measured>` | `<measured>` | `<measured>` |
| S2 | 2.900 | 3.200 | field, medium over her shoulder | medium | 40mm / 50 mm f/2.4 | dolly in 1.15 m, focus pull | | | | | | |
| S3 | 6.100 | 2.800 | piano keyboard raking to the candle, close-up | close-up | 85mm / 60 mm f/2.0 | locked off, holding | | | | | | |
| S4 | 8.900 | 1.700 | field, medium wide from behind the piano | medium wide | 45mm / 35 mm f/2.8 | tilt up 10.7° | | | | | | |
| S5 | 10.600 | 1.400 | field, wide (opening rhyme) | wide | 32mm / 35 mm f/5.6 | locked off, tripod breath | | | | | | |

S1 is the worked example: its identity columns are facts of the film, its six measured columns come from the sweep and nothing else. The S1 fade-in is 0.55 s, and the pixel rules stand down inside it (a fade is an edit, not an empty frame); every other frame of the shot is judged.

## 4 · Issues

Three levels, one policy: **P0 blocks delivery, P1 must be fixed before delivery, P2 is a human decision and must be recorded in the review log.** Each row names the frame time that produced it, because that is what makes the fix loop (locate → cause → fix → re-render that range) possible.

### P0 — blocking

| t (s) | kind | detail | cause | fix | re-rendered |
|---|---|---|---|---|---|
| `<t>` | `empty frame` | `std=<measured> mean=<measured>` (rule: `std < 2.5`) | `<e.g. the shot drew nothing before the sky pass>` | `<the smallest change>` | `<--range=… and the sheet/strip that proved it>` |

Kinds this level can contain: `javascript error`, `timeline`, `empty frame`, `black frame`, `blown frame`, `camera jump`, `camera snap`, `focal jump`, `foot through floor`, `NaN position`, `NaN camera`, `camera inside subject`, `bone length drift`, `woman.key-contact`, `woman.feet-on-ground`, `single instance`, `the note is missing`.

### P1 — must fix

| t (s) | kind | detail | cause | fix | re-rendered |
|---|---|---|---|---|---|
| | | | | | |
| | | | | | |

Kinds this level can contain: `underexposed shot frame` (`mean < 12`), `black hole` (`black > 0.9` with `mean < 20`), `sun direction changed at a cut` (> 0.035°), `exposure jump at a cut` (Δ > 0.35), `contact gap` (> 0.02 m), `prop floating` (> 0.02 m), `leg over-extended`, `figure floating`, `audio length mismatch` (> 0.15 s), `cue outside film`, `no bed`, `the note dies too fast`.

### P2 — reviewed, not failed

| t (s) | kind | detail | cause | fix | re-rendered |
|---|---|---|---|---|---|
| | | | | | |
| | | | | | |

Kinds this level can contain: `busy frame` (`edge > 95`), `held still for 1 s` (24 frames with no change — legal, but state it), `two shots look identical` / `opening-closing rhyme` (signature diff < 1.2), `slow frame` (> 1200 ms), `no silence before the note`, `wingbeats under the bed`, `no fade at the end`, `cue lost in the mix` (after/before < 0.95). Each one is either accepted with a reason or fixed; "noted" is not a decision.

## 5 · Automated checks actually run

| check | command | result |
|---|---|---|
| toolchain + skill integrity | `node scripts/preflight.mjs <project-dir>` | `<output>` |
| timeline tiling and spec | `node render.mjs --qa --out=out/qa` | `film: 12s @ 24fps, 5 shots: S1, S2, S3, S4, S5`; `timelineIssues` must be empty |
| pixel, camera, lighting, stillness, audio rules | `node render.mjs --qa --out=out/qa` | `P0=<n> P1=<n> P2=<n>`; exit code 0 only when P0 + P1 = 0 |
| the rules in force (recorded with the run) | `out/qa/report.json` → `meta.rules` | see section 6 |
| audio measurement | inside `--qa`, or the standalone `analyzeAudio` one-liner | `audio.rms` and `audio.cues` in `report.json` |
| probe: contact | `node scripts/probe.mjs "womanKeyPoint()" "solveSkeleton(womanPoseOnKey(4.30)).wristR"` | `<distance>` m (P0 above 0.03) |
| probe: feet | `node scripts/probe.mjs "solveSkeleton(womanPoseOnKey(2.0)).ankleL[1]"` | `<height>` m, must be 0.05–0.11 |
| probe: geometry cost | `node scripts/probe.mjs "drawFrame(4.22); JSON.stringify(SCENE.stats)"` | `<quads>` quads, `<ops>` ops |
| the film | `node render.mjs --frames --workers=4` | `<n>` frames, `<ms>` ms/frame effective |
| the encode | `node render.mjs --encode --audio=assets/score.m4a --out=out/film.mp4` | `<size>` MB, `<duration>` s |
| the mix, seen | `ffmpeg -y -i audio/score.wav -lavfi showspectrumpic=s=1600x900:legend=1 out/check/spectrum.png` | `<what the image shows>` |

## 6 · Rules applied (verbatim from `RULES` in `scripts/qa.mjs`)

| rule | value | meaning |
|---|---|---|
| `emptyStd` | 2.5 | frame variance below this = nothing drawn (P0) |
| `blackMean` | 3.0 | mean luma below this = black frame (P0) |
| `whiteFrac` | 0.985 | this fraction of near-white pixels = blown (P0) |
| `darkMean` | 12.0 | mean luma below this = underexposed (P1) |
| `darkFrac` | 0.9 | this much near-black with a dark mean = a hole (P1) |
| `camPosJump` | 0.16 | metres between adjacent frames inside one shot (P0) |
| `camYawJump` | 4.5 | degrees between adjacent frames inside one shot (P0) |
| `camFocalJump` | 1.5 | mm between adjacent frames inside one shot (P0) |
| `sunDrift` | 0.035 | degrees the sun may change at a cut (P1) |
| `exposureDrift` | 0.35 | exposure may change this much at a cut (P1) |
| `msPerFrameWarn` | 1200 | render cost that earns a performance note (P2) |
| `edgeBusy` | 95 | mean gradient above this = noisy frame (P2) |
| `stillFrames` | 24 | frames with no change before a stillness note (P2) |
| `repeatSigDiff` | 1.2 | two shots closer than this are reported as possibly repeated (P2) |

## 7 · Audio measurements

Windows are 0.05 s. Thresholds are in `scripts/check-audio.mjs`; a mix is accepted when the bed exists, the air steps back before the note, the note arrives and survives, the wings are audible and the film ends in air.

| measurement | window (s) | fail rule | measured |
|---|---|---|---|
| `bed` | mean 0.30–3.60 | < 0.002 → P1 `no bed` | `<measured>` |
| `preNote` | mean 4.00–4.20 | > bed × 0.85 → P2 `no silence before the note` | `<measured>` |
| `notePeak` | peak 4.24–4.60 | < 0.02 → P0 `the note is missing` | `<measured>` |
| `noteTail2s` | mean 6.20–6.40 | reported, not failed | `<measured>` |
| `noteTail` | mean 6.40–7.40 | < 0.0015 → P1 `the note dies too fast` | `<measured>` |
| `wing` | mean 9.18–9.70 | < bed → P2 `wingbeats under the bed` | `<measured>` |
| `end` | mean 11.50–11.95 | > bed × 0.6 → P2 `no fade at the end` | `<measured>` |

Cue ratios (`after/before`, pass ≥ 0.95; `masked` and `fade` cues report `null` and cannot fail):

| cue | t (s) | ratio | nearest onset | errMs | verdict |
|---|---|---|---|---|---|
| footstep 1 | 0.16 | `<measured>` | `<measured>` | `<measured>` | |
| footstep 5 | 1.96 | | | | |
| cloth reach | 3.30 | | | | |
| key press | 4.222 | | | | |
| note F#3 | 4.235 | | | | |
| key release | 4.625 | `null` (`masked`) | | | |
| bird takeoff | 9.18 | | | | |
| wingbeat 3 | 9.55 | | | | |
| end of wind | 11.95 | `null` (`fade`) | | | |

The cloth cue is the one to watch: it is 6 dB under the bed by design, and a ratio under 0.95 there is a real answer ("the arm is inaudible") rather than a measurement error. A cue ratio proves the sound rose above the bed; the `errMs` column proves it rose at the right moment — a ratio of 2.0 with `errMs` of 200 is still a defect.

## 8 · Human review log

The automated pass cannot tell a hold from a stall, a rhyme from a repeat, or a deliberately empty sky from an empty frame. This log is the only record of what was actually looked at.

| # | frames / file | looked at | what was wrong | what changed | re-rendered |
|---|---|---|---|---|---|
| 1 | `out/check/s2_marks.jpg` (2.9, 3.6, 4.22, 4.6, 5.4) | the five reads of S2 | `<what was wrong>` | `<the smallest change>` | `<command>` |
| 2 | `out/check/s2_press.jpg` (strip 4.10–4.32) | the contact, frame by frame | | | |
| 3 | `out/check/s2_key.jpg` (crop following the key bed) | the 6 mm travel | | | |
| 4 | `out/check/spectrum.png` | the mix, section 7 | | | |

Review set the reference film ships with (`template/out/check/`): `film1–4.jpg` (film marks), `look1–2.jpg` (look development), `models1–6.jpg` (prop probes), `walk1–3.jpg` (the walk), `press.jpg` (the press), `bird.jpg` (the takeoff), and thirteen full-res moments in `stills/t*_*.png`. Open them; do not trust the filenames.

Budget per shot: one **sheet** for the marks, one **strip** for each motion, one **crop** for each contact. A shot that has not been seen in those three forms has not been reviewed.

## 9 · Verdict

| gate | value | consequence |
|---|---|---|
| P0 | `<n>` | must be 0 |
| P1 | `<n>` | must be 0 |
| P2 | `<n>` | each one accepted with a reason or fixed — see section 4 |
| audio | `<pass / fail>` | bed, pre-note, note peak, tail, wing and end within section 7's rules |
| frames re-rendered after the last fix | `<n>` | the verdict applies only to frames rendered after the final change |

> `<P0 and P1 are clear: the automated pass found nothing that blocks delivery. P2 items are reviewed above.>` — or: `<Blocked: n P0 and n P1 must be fixed and the affected frames re-rendered before delivery.>`

**Signature** — reviewer `<name>`, `<date>`, for commands run on `<machine>` at `<node / Chrome / ffmpeg versions>`. The verdict covers exactly the command list in section 5 and no other build.


## The 2.5D checks

These are in addition to the P0/P1/P2 sweep, and they exist because every one of them has failed at least once in this build.

| # | check | how | fail |
|---|---|---|---|
| 1 | budget declared and met | measured per frame vs `budget` (the top-level field of `shot()`, a sibling of `meta`) | P2 over 1.2×, P1 over 2× |
| 2 | parallax direction | a nearer plate must move at least as many screen pixels as a farther one when the camera moves | P1 "parallax reversed" |
| 3 | horizon continuity | `|horizonY(a) - horizonY(b)| / H` at a cut | P1 over 0.008 |
| 4 | near-field detail density | edge energy of the bottom third vs the middle third | P2 under 1.25× |
| 5 | sky calm | edge energy of the top third vs the middle third | P2 over 1.6× |
| 6 | no hard plate edge at the horizon | open the frame at 1:1 across the horizon | a visible straight line = a defect, list it |
| 7 | plate scale | no plate closer than 1.1 m to the lens (the engine throws) | P0, the frame did not render |
| 8 | layer order | a plate never draws over a nearer object (check a foreground blade against the subject's leg) | P1 |
| 9 | frame time | per-frame ms from `--frames` and `--qa` | over 2.5 s/frame = simplify |

```
node render.mjs --qa --out=out/qa --film=wind      # writes QA_REPORT.md and report.json
node scripts/scan.mjs 9.0,9.5,10.0 --film=wind     # if a frame hangs, find the time
node scripts/opscan.mjs 10.0 --film=wind           # then find the exact draw command
```

