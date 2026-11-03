# Visual quality control

Every shot is reviewed against nine checks, from six artefacts, with the frame times and the measurements written down
before the film is encoded — a review that did not open an image is not a review.

## 1 · The nine checks

| # | check | what to look at | pass / fail |
|---|---|---|---|
| 1 | composition | the contact sheet at the shot's key times | the subject sits where the shot list says and holds the frame; an accidental tangent (a subject edge grazing a frame edge or a plate edge) is a fail |
| 2 | subject scale | the 1:1 crop of the subject plus a projection probe | projected height within ±10 % of the spec: W1's figure is 342 px (31.7 % of 1080) at 2.0 s, W2's 686 px (63.6 %) at 8.0 s |
| 3 | detail | 1:1 crops of the four corners and the subject | every region shows one material's own texture; `stats.std ≥ 2.5` (below that `RULES.emptyStd` raises P0 `empty frame`) and no featureless area wider than ⅙ of the frame |
| 4 | material truth | the 1:1 crop on each surface in the shot's material list | each material behaves like its own physics (grass is tapered ribbons, foliage a scatter of marks, lacquer mirrors the sky); one texture logic on two materials is a fail |
| 5 | light and shadow agreement | the crop at the subject's feet and `qaAnalyze().sun` | every shadow runs to yaw 133.7° from a 13.63° sun and is 4.12× the object's height long (the piano's 0.95 m → 3.92 m); the sun vector is identical across a cut (`RULES.sunDrift` 0.035°) |
| 6 | occlusion and space | the 1:1 crop where the near plate crosses the subject's base | nearer draws over farther: blades cross the piano's legs and the figure's boots, and nothing is painted over a nearer object |
| 7 | motion continuity | the motion strip at 24 fps | no pop, slide or teleport; adjacent-frame camera deltas hold: 0.16 m, 4.5°, 1.5 mm (`camPosJump`, `camYawJump`, `camFocalJump`) |
| 8 | cross-shot consistency | the outgoing shot's last frame beside the incoming shot's first | same sun, exposure within 0.35, the same plates at the same world anchors, horizon within 0.5 % of frame height (§3.3) |
| 9 | sound–picture sync | the cue table and a strip around each picture event | an audible cue lands within one frame (41.7 ms at 24 fps) of its event, or is declared `fade` / `masked` in `audio/cues.json` |

A failing check is written up as frame time + defect + cause, not as taste. The nine checks pass on the shot in front of
you; they do not average with the previous shot.

## 2 · The six artefacts every shot must produce

First frame, middle key frames, last frame, contact sheet, 1:1 detail crops, motion strip — six commands against the real
renderer, every cell labelled with its time and shot id by `renderSheet`:

```bash
cd template
node render.mjs --stills=0.04,7.37 --out=out/check/w1_ends        # first and last frame, full-res PNG + ms per still
node render.mjs --sheet=1.0,2.0,3.5,5.0,6.9 --cols=5 --w=480 --out=out/check/w1_marks.jpg   # middle key frames
node render.mjs --sheet=0.8,2.0,3.4,4.8,6.2 --cols=5 --w=480 --out=out/check/w1_sheet.jpg   # the contact sheet
node render.mjs --sheet=2.0 --crop=520,380,260,400 --w=260 --out=out/check/w1_figure.jpg    # 1:1 of the figure
node render.mjs --sheet=2.0 --crop=680,700,240,180 --w=240 --out=out/check/w1_occlusion.jpg # 1:1, grass over legs
node render.mjs --strip=4.9:5.4 --cols=12 --w=320 --out=out/check/w1_gust.jpg               # every frame of the gust
node render.mjs --strip=2.0:2.6 --crop-at=-1.28,0.85,1.02,300,420 --w=300 --out=out/check/w1_coat.jpg
```

`--crop` takes screen pixels `x,y,w,h`; `--crop-at` takes a world point `x,y,z` then `w,h` and re-projects it every frame,
the only honest way to hold a crop on something while the camera moves. Pass `--w` equal to the crop's width for a true
1:1; any other `--w` is a rescale and can hide a 2 px defect. `--stills` prints the milliseconds each full-res frame cost.

## 3 · The 2.5D checks

### 3.1 Layer order

A plate draws in its declared band, and the band — not the depth sort alone — decides what covers what:
`PLATE_LAYERS.far -60`, `field -36`, `mid -16`, `near 6`, `fore 28`. A plate must never draw through a nearer object.
Read the frame's own state with `qaAnalyze(t).plates` (depth in metres, `k` in px per plate metre, screen origin, layer):

| plate | W1 @ 1.0 s | W2 @ 8.0 s | layer | drawing order |
|---|---|---|---|---|
| `far` | depth 94.49, k 18.06 | depth 89.23, k 23.91 | −60 | farthest, first |
| `house` | depth 34.26, k 49.82 | depth 31.94, k 66.79 | −16 | behind the subject |
| `tree` | depth 21.42, k 79.68 | depth 16.63, k 128.29 | −15 | nearer than the house, so after it |
| `foreA` / `foreB` | depth 2.99, k 571.4 | depth 1.44, k 1485.3 | 28 | after `LAYER.GEO` (0): it occludes the piano |

Pass: for every pair of plates that overlap on screen, layer(nearer) > layer(farther). Fail: a plate on the wrong band,
which reads as a cut-out sliding over the thing in front of it.

### 3.2 Parallax direction

Two invariants, both readable from `qaAnalyze().plates` at two times:

1. **`k × depth = focalPx`** for every plate — measured 1706.6 for all four plates at 32 mm (32/36 × 1920 = 1706.7) and
   2133.3 at 40 mm. A plate that breaks this was authored at a fixed screen size, not attached to the world.
2. **A nearer plate moves more than a farther one.** Compare each plate's screen-origin shift against the far plate's so
   the camera's turn cancels: |Δox − Δox(far)| over W1's 1.0 → 5.0 s is 0 px (`far`), 2.6 (`house`), 27.5 (`tree`), 158.2
   (`foreA`) — monotone in nearness. A sign reversal, or a near plate with a smaller differential than a far one, is a
   bug in the anchor or the scale, not a matter of taste.

```bash
node scripts/probe.mjs "(()=>{drawFrame(1.0);return qaAnalyze(1.0).plates})()" "(()=>{drawFrame(5.0);return qaAnalyze(5.0).plates})()"
```

### 3.3 Horizon continuity across a cut

A cut inside one place is a reframe, not a new world: the horizon (the camera's ground vanishing line, `cam.horizonY`)
may move at most **0.5 % of frame height — 5.4 px at 1080**. Measure the last frame of the outgoing shot against the first
of the incoming one. Note that matching the *pitch* is not enough: `horizonY = H/2 + focalPx * tan(pitch)`, so a longer lens
moves the line unless the pitch shallows to compensate. In this build W1 at 7.375 s gives 429.56 px; the first attempt set
W2's target y to 0.850 to match W1's pitch exactly (-3.70°) and still failed by **27.9 px**, because 40 mm at the same pitch
puts the horizon higher. Solving for the pixel position gives target y **0.912**, which measures **429.37 px — 0.19 px from
W1** and passes. The W1 → W2 cut is only a match cut because of that one number.

### 3.4 Plate scale guard

`plateBasis()` refuses a plate closer than 1.1 m to the lens: it raises `QA.note('plate too close')` and throws
`plate X is Y m from the lens`. This is a real event, not a hypothetical — with the earlier `foreA` anchor at z −5.35 the
W1 dolly closed it to 0.96 m at 6.90 s and `scripts/scan.mjs` printed `FAIL Error: plate foreA is 0.96 m from the lens`
for 6.00–7.30 s. Re-anchored at z −4.50 it runs 2.99 → 2.46 m and the frames render. A plate at 1.1–1.5 m is legal and
expensive: W2's `foreB` sits at 1.44 m and costs 1.0–1.7 s per frame against W1's 0.14–0.25 s.

### 3.5 Foreground occlusion

The near plate exists to put the subject in the lens's space. Pass: in the 1:1 crop at the subject's base at least three
blades cross the silhouette of a leg or a boot, and the plate's depth is less than the distance to that object. Fail: a
clean outline standing on a clean line, which is a paste-up however good the painting is.

### 3.6 Seam check

No hard rectangle edge at the horizon, and no straight line where a plate's base meets the ground. Pass: the base is a
band (soil, haze, or a second overlapping fill) whose edge is broken by the ground's own texture. Fail: a horizontal step
of more than ~4 luma levels across one row, visible in a 1:1 crop. The house plate carries two overlapping soil bands at
its foot for exactly this reason; the treeline's three ranks break the ridge line instead of ending it.

## 4 · The loop

1. **Render** the six artefacts for the shot.
2. **Open** every one of them, at full size.
3. **List** the defects in writing: frame time, what is wrong, which of the nine checks it fails.
4. **Name the cause** in one sentence — a plate anchor, a pitch, a blade width, a declared number. Not "looks off".
5. **Fix the cause**, the smallest change that removes it.
6. **Re-render only that range** (`--strip`, `--range`) and look again.
7. **Write down which frames you opened** and what you saw, as a table: image, frame times, what was checked, what was
   seen, verdict — the shape of `examples/piano-in-the-field/QA_REPORT.md` §7.

## 5 · Known failure catalogue (this build)

| # | symptom | cause | fix / status |
|---|---|---|---|
| 1 | a hard band where a plate's base met the ground | the plate ended on a straight edge at the horizon | two overlapping soil bands at the house's foot, broken edge; fixed |
| 2 | a foreground plate reading as a hedge | anchored ~13 m out (k = 131 px/m, so a 6–14 mm blade is 0.8–1.8 px, the same width as mid-ground grass) | anchor it at 1.4–3.0 m (k 571–1485, blades 3.4–21 px); fixed |
| 3 | leaf clusters as flat blobs | one ellipse fill per cluster, no interior marks | 42 clipped sub-marks per cluster (`plateDetail`), 2.0–6.0 px each at W1's tree; fixed |
| 4 | blades as thick strokes | `ctx.stroke` with one `lineWidth` — a stroke has one width and reads as a straw | tapered filled ribbon, 0.006–0.014 m at the root down to 15 % at the tip; fixed |
| 5 | a frame that hung the renderer for minutes | a shadow polygon crossing the near plane projected to coordinates in the millions and Chrome tried to rasterise them | screen coordinates clamped to ±4× the frame in `projectPoly` (`PADX = W*4`); fixed — find the next one with `scan.mjs` (which time) then `opscan.mjs` (which op: layer, z, order, kind) |
| 6 | every frame failed QA with a budget overrun | the declaration was the quiet state, not the peak frame (`movers: 3` while light, wind, clouds and coat move = 4/3 = 1.33×, P2 on every frame) | declare the peak, measured from a rendered frame; the reference shot declares 5 and measures 4–5 |
| 7 | the horizon jumps at the W1 → W2 cut | matching the pitch instead of the pixel position: 40 mm at W1's pitch put the line 27.9 px higher | **fixed**: target y 0.912 measures 429.37 px, 0.19 px from W1 (§3.3) |

## 6 · Sign-off

A shot is not finished until this table is filled — in the shot's file or the QA report — before the film is encoded:

| field | required |
|---|---|
| shot id / time range | e.g. `W1`, 0.00–7.40 s |
| artefacts produced | the six filenames from §2, with the times they cover |
| frames opened | every time actually looked at, not "the shot" |
| nine checks | pass / fail per check, with the criterion that failed |
| budget | declared vs measured per kind (from `scan.mjs`); any ratio above 1.2 named |
| plates | depth, k and layer per plate at two times, with `k × depth` confirmed |
| horizon | last frame of this shot, first frame of the next, and the delta in px |
| defects | found / cause / fixed / range re-rendered, or "none" |
| QA | `node render.mjs --qa --out=out/qa`: P0, P1, P2 counts |
| reviewer | name, date, and the one sentence that says what this shot is for |

P0 and P1 must both be zero, and a P2 is a decision written down with its reason. "It looked fine on the sheet" is not a
sign-off: the sheet is five frames, and the six artefacts exist because the defect is usually in the other two hundred.



