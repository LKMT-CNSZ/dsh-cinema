# Technical QA

Two questions have to be answered for every film: **is it broken** (and where, exactly) and **is it good** (and who says
so). The first is automated, in code, against the real rendered frames. The second is a person looking at images, and it
must be logged. Neither can substitute for the other.

## The three levels

- **P0 — blocks delivery.** A JavaScript error, a blank or black frame outside a fade, a NaN in a coordinate, a missing
  asset, a foot through the floor, a bone that changed length, a hand that misses its contact, a camera that jumps inside
  a shot, a timeline that does not tile the declared duration, a prop drawn twice.
- **P1 — must be fixed.** An underexposed or black-hole frame, a leg over-extended by more than 2 cm, a prop floating, a
  sun direction that changes at a cut, an exposure jump, an audio length mismatch, a cue that is not audible.
- **P2 — judged by a person.** Busy frames (texture masquerading as detail), a shot held still for a whole second, two
  shots whose statistics are nearly identical (which may be the intentional opening/closing rhyme), a cue masked by a
  sustained sound, render cost above ~1.2 s/frame, a shot that looks identical to another.

P0 and P1 must both be zero before the film is called done. P2 items are recorded with a decision, not silently accepted.

## What runs

### In the page, while a frame is drawn

`src/engine/qa.js` collects issues per frame and runs **probes** (registered by scene code) at QA time:

| probe | level | checks |
|---|---|---|
| `single instance` | P0 | every repeated thing (piano, house, tree, woman, bird, treeline) drawn exactly once per frame |
| `woman.key-contact` | P0 | fingertip within 30 mm of the key for the whole press window |
| `woman.feet-on-ground` | P0 | the lower ankle stays between 0.05 and 0.11 m |
| `bone length drift` | P0 | every bone within 2 % of its rest length, every frame |
| `foot through floor` | P0 | ankle never below −2 mm |
| `leg over-extended` | P1 | IK reach overflow > 2 cm |
| `figure floating` | P1 | both ankles above 0.5 m |
| `NaN camera` / `camera inside subject` | P0 | non-finite camera, or target within 5 cm of the lens |

Renderer-side guards (`assertFinitePts`, near-plane clipping, `projectPoly` returning `null`) exist so a bad coordinate
skips a surface instead of throwing the whole page.

### The sweep

```bash
node render.mjs --qa --out=out/qa            # every frame
node render.mjs --qa --range=0:3 --step=1    # one shot
```

For each frame it renders, then measures:

- `mean`, `std`, near-black fraction, near-white fraction, edge energy and mean RGB, from a 128×72 downsample;
- the camera state (position, target, focal, focus, aperture, horizon);
- the lighting state (sun direction, exposure);
- everything the probes and the renderer raised.

Then `scripts/qa.mjs` applies rules and writes `out/qa/QA_REPORT.md` + `report.json`.

| rule | value | meaning |
|---|---|---|
| `emptyStd` | 2.5 | frame variance below this = nothing is drawn |
| `blackMean` | 3.0 | mean luma below this = black frame |
| `whiteFrac` | 0.985 | fraction of near-white pixels = blown |
| `darkMean` | 12.0 | P1: underexposed frame |
| `darkFrac` | 0.90 | P1: a hole rather than a shadow |
| `camPosJump` | 0.16 m | P0: camera moved per frame inside a shot |
| `camYawJump` | 4.5° | P0: camera direction snapped |
| `camFocalJump` | 1.5 mm | P0: focal length snapped |
| `sunDrift` | 0.035 | P1: sun direction changed at a cut |
| `exposureDrift` | 0.35 | P1: exposure jumped at a cut |
| `msPerFrameWarn` | 1200 ms | P2: render cost |
| `edgeBusy` | 95 | P2: busy frame |
| `stillFrames` | 24 | P2: a held second |
| `repeatSigDiff` | 1.2 | P2: two shots look identical |

Fade windows declared by a shot (`fadeIn`, `fadeOut`) are exempt from the pixel rules — a fade to black is an edit, not
an empty frame — and nothing else is.

### Camera and continuity

The sweep compares adjacent frames *inside* a shot for position, direction and focal jumps. Across a cut it compares the
sun direction and exposure. Repeated-shot detection compares the statistics at 25/50/75 % of each shot and flags pairs
closer than 1.2; a first/last pair is reported as the opening/closing rhyme, not a defect.

### Audio, measured

```bash
node -e "import('./scripts/check-audio.mjs').then(m=>console.log(m.analyzeAudio('audio/score.wav', JSON.parse(require('fs').readFileSync('audio/cues.json')), 12).stats))"
```

`scripts/check-audio.mjs` reads the PCM, computes a 50 ms RMS envelope and checks:

- duration against the film (P1 if > 0.15 s off);
- the bed exists (P1 if the wind is silent before anything happens);
- the pre-note silence is quieter than the bed (P2 if not — the silence is a design decision and must be there);
- the note has a peak (P0 if missing) and a tail 2 s later (P1 if it dies);
- the wingbeats are not buried under the bed (P2);
- the end fades (P2);
- every cue in `cues.json` rises above the floor before it (P2 `cue lost in the mix`), with `fade` and `masked` cues
  exempt by declaration.

You cannot hear the film while you write it. The envelope table and a spectrogram are how you check the mix:
`ffmpeg -y -i audio/score.wav -lavfi showspectrumpic=s=1400x500:legend=1 out/qa/spectrum.png` — then look at it.

## The human review loop

For every shot, in this order, and for the last one too:

```bash
node render.mjs --sheet=0.5,1.4,2.3 --cols=3 --w=640 --out=out/check/s1.jpg            # the shape of the shot
node render.mjs --strip=4.1:4.7 --cols=8 --w=320 --out=out/check/press.jpg             # every frame of a motion
node render.mjs --sheet=4.45 --crop=820,300,520,420 --w=640 --out=out/check/hand.jpg   # 1:1 detail on a contact
node render.mjs --strip=0.9:1.6 --crop-at=-2.1,1.0,0,600,700 --out=out/check/walk.jpg  # follows a world point
```

Open every image and answer, in writing:

1. **Light** — where does it come from, do shadow directions agree, is anything lit from two places?
2. **Figure** — proportions, posture, feet planted, hands where they should be, no interpenetration with props?
3. **Contact** — at the contact frame, is the fingertip ON the key (crop it, don't assume)?
4. **Materials** — does each surface behave like its material, or is one texture doing all of them?
5. **Composition** — subject big enough, horizon placed, negative space used, no accidental tangents?
6. **Cuts** — does each cut land on something, does the frame after the cut continue screen direction?
7. **Anything empty** — a frame with nothing to look at is a bug even if QA passes.
8. **The reads** — can a first-time viewer understand what this shot is doing, in time?

A review that did not open an image is not a review. Write down which frames you opened and what you saw.

## Fixing

1. Locate the frame (`--strip` gives you the time).
2. Locate the line (the shot's `draw`, the pose function, the material).
3. Name the cause in one sentence ("the wrist target is 12 cm too high because the arm length was written as a unit
   vector").
4. Change the smallest thing that removes the cause.
5. Re-render **only** the affected range and look again.
6. Only then re-run the full sweep and encode.

## Deliverables the report must contain

`out/qa/QA_REPORT.md` (generated) plus the filled-in `templates/QA_REPORT.md`: environment, spec, per-shot measured
table, P0/P1/P2 tables with causes and fixes, the commands actually run, the audio measurements, the human review log,
and a verdict. If a check was not run, say so; a report that implies coverage it does not have is worse than no report.


## 2.5D update — what the sweep checks now, and the two hangs it found

### The new rules (all in `scripts/qa.mjs`)

| rule | level | what it catches |
|---|---|---|
| budget overrun over 1.2× the declared value | P2 | a shot that quietly grew past its promise |
| budget overrun over 2× | P1 | a shot that should have been split |
| parallax reversed between two plates | P1 | a plate anchored or layered wrongly (near moving less than far) |
| horizon jumped more than 0.8 % of frame height at a cut | P1 | a match cut that was not matched |
| near-third edge energy under 1.25× the middle third | P2 | a plain foreground - "minimal" that is actually empty |
| sky edge energy over 1.6× the middle third | P2 | a noisy sky (dust or texture where there should be air) |

The per-band edge energies come from the same 128×72 downsample the other statistics use (`stats.bands`: sky / middle / near).

### The two failures worth remembering

**1. A frame hung for minutes at one camera position.** Not slow - stuck. The scan tool (`scripts/scan.mjs`) showed times
2.0-9.5 s rendering in ~1 s and 10.0 s never returning. The op-scanner (`scripts/opscan.mjs`) executed the queued commands one
at a time and named the operation. The cause was a cast shadow crossing the near plane: its projected bbox was millions of
pixels wide, and Chrome rasterises the whole thing before clipping. Two fixes, both kept:
`paintGroundShadow` clamps the bbox **and** the clip path to a padded frame and skips anything over 3× the frame;
`projectPoly` clamps every screen coordinate to ±4 frames.

**2. A "foreground" plate was 13 m away.** It read as a hedge across the middle of the frame. The engine now throws if a plate
is closer than 1.1 m, and the shot author is forced to declare a plate depth that is actually foreground (3 m in this film).

### The diagnostic tools

```bash
node scripts/scan.mjs 2,5,8,10,11.5 --film=wind     # per-time: ops, budget, ms - or HANG
node scripts/opscan.mjs 10 --film=wind              # per-command: which draw call never returns
```

`scan.mjs` prints the measured budget per frame, which is also the fastest way to fill in `budget` (the top-level field of `shot()`, a sibling of `meta`) honestly.
`opscan.mjs` prepares the frame, sorts the queue, and invokes each command in its own page call with a timeout.

### Frame time

The reference film runs 0.75-1.35 s per frame single-threaded (488 ms/frame with four workers). Budget rules of thumb:

- over 2.5 s/frame: find the plate or texture that is too expensive, do not lower global quality;
- 7000 ground strokes and 7000 plate marks are the two heavy items, both bounded;
- the 2400-command cap is a ceiling, not a target - hitting it is a QA failure, not a feature.

