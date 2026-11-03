# QA report — The Piano in the Field

The generated report is next to this file (`08-generated-qa-report.md` / `.json`, produced by
`node render.mjs --qa --out=out/qa`). This page is the human document that goes with it: what was measured, what was
looked at, what was wrong, and what changed.

## 1. Environment and toolchain

| item | value |
|---|---|
| Node | v24.19.0 |
| ffmpeg | 9.0.2 full build |
| Chrome | 156.0.8078.80 (`C:\Program Files\Google\Chrome\Application\chrome.exe`) |
| GPU path | ANGLE / D3D11 (headless Chrome) |
| dependency | puppeteer-core only |
| render | `node render.mjs --frames --workers=4` then `--encode --audio=assets/score.m4a` |

## 2. Spec

| item | declared | measured |
|---|---|---|
| duration | 12.00 s | 12.000 s (ffprobe) |
| frame rate | 24 fps | 24/1 |
| resolution | 1920 × 1080 | 1920 × 1080 |
| shots | 5 | 5, tiling 0–12.00 s (preflight) |
| frames | 288 | 288 |
| render cost | — | **80.0 ms/frame** (QA sweep), 72 ms/frame effective in parallel |
| audio | 12.0 s | 12.000 s, measured from PCM |
| file | — | `out/film.mp4`, 44.2 MB, H.264 CRF 17 + AAC 192k |

## 3. Per-shot measurements (from the sweep, all 288 frames)

| shot | start | dur | size | lens | mean luma | std | edge | verdict |
|---|---|---|---|---|---|---|---|---|
| S1 | 0.00 | 2.90 | wide | 35 mm f/5.6 | 83.5 | 23.6 | 24.3 | pass |
| S2 | 2.90 | 3.20 | medium | 50 mm f/2.4 | 68.9 | 31.7 | 25.3 | pass (darkest: backlit foreground) |
| S3 | 6.10 | 2.80 | detail | 60 mm f/2.0 | 52.5 | 25.2 | 20.0 | pass (deliberately dark) |
| S4 | 8.90 | 1.70 | medium wide | 35 mm f/2.8 | 88.6 | 37.0 | 18.5 | pass |
| S5 | 10.60 | 1.40 | wide | 35 mm f/5.6 | 79.8 | 22.5 | 23.2 | pass |

No frame fell below the empty/black/underexposed thresholds outside its declared fade windows; no frame exceeded the busy
threshold; the camera moved at most 0.045 m and turned at most 0.35° between adjacent frames inside a shot; the sun
direction is identical at every cut (it is a constant in `src/world.js`).

## 4. Issues

### P0 — 0 at delivery

| t | kind | detail | cause | fix | re-rendered |
|---|---|---|---|---|---|
| 0.00–0.08 | empty frame | std 0.11, mean 8.1 | fade-in is black by design; the rule did not know about fades | declare `fadeIn`/`fadeOut` in shot meta and exempt those windows in `scripts/qa.mjs` | rule change verified on all 288 frames |
| 0.54–2.13 | foot through floor | lower ankle 0.112–0.156 m | gait planted the stance foot under the hip; by the end of stance the leg was over-extended and the IK lifted the foot | land the foot half a stance sweep ahead, lift the heel through the last third of stance, derive pelvis height from leg reach | strip 0.90–1.55 re-rendered |
| — | bone length drift | (none at delivery) | a hanging forearm was written as a unit vector during the build | multiply by `P.forearm` | probe + full sweep |

### P1 — 0 at delivery

| t | kind | detail | cause | fix | re-rendered |
|---|---|---|---|---|---|
| 0.0–2.2 (during build) | leg over-extended | overflow 0.05–0.31 m | same gait defect as above | same | same |
| 11.92–12.00 (during build) | underexposed | fade-out tail | fade exemption | same rule change | — |
| — | audio length mismatch | 0 at delivery | — | — | — |

### P2 — reviewed

| t | kind | detail | decision |
|---|---|---|---|
| — | cue masked by the note | `key release` 4.625 s is quieter than the note under it | **accepted by design**: the release is deliberately masked by the note it ends; the cue is declared `masked` in `cues.json` so the rule does not treat it as a lost sound |
| — | opening/closing rhyme | S1 and S5 statistics close | **intentional**: the film's ending rhymes with its opening; noted, not "fixed" |
| S3 | darkest shot (mean 53) | the detail shot is a candle at dusk | **accepted**: within the P1 dark threshold (>12), and the shot is lit by the only practical in the film |

## 5. Audio, measured

| measurement | RMS | meaning |
|---|---|---|
| bed 0.3–3.6 s | 0.0393 | wind is present before anything happens |
| pre-note 4.00–4.20 s | 0.0105 | 3.7× quieter than the bed: the silence is real |
| note peak 4.24–4.60 s | 0.7466 | the attack is 19× the bed |
| note tail 6.20–6.40 s | 0.1792 | the note still rings 2 s after the press; tau falls with each partial, so the fundamental outlives the 13th |
| wingbeats 9.18–9.70 s | 0.0779 | 2.0x the bed, receding and panned; the wind is ducked to let them through |
| end 11.50–11.95 s | 0.0156 | fading to zero at 12.000 s |

Cue audibility (after/before the cue, 0.95 = audible): footsteps 3.04 / 3.98, cloth 1.23, key press 12.61, note 15.19,
bird takeoff 1.00, wingbeat 0.96. `key release` and `end of wind` are declared exempt (masked / fade).

## 6. Commands actually run

```bash
node scripts/preflight.mjs .                      # environment, script tags, 5 shots tile 0-12.00 s
node render.mjs --qa --out=out/qa                 # 288 frames, 23.2 s sweep, P0=0 P1=0 P2=0
node audio/score.mjs                              # audio/score.wav + audio/cues.json (9 cues)
node render.mjs --frames --workers=4              # 288 frames, 72 ms/frame effective
node render.mjs --encode --audio=assets/score.m4a --out=out/film.mp4
ffprobe -v error -show_entries format=duration:stream=width,height,r_frame_rate -of json out/film.mp4
node scripts/probe.mjs "(J=>({ank:J.ankleL,ov:J.reachWarn}))(solveSkeleton(womanPose(1.4)))"
```

## 7. Human review log

Images opened (all in `stills/`, plus the working checks listed below):

| image | what was checked | what it showed |
|---|---|---|
| `01-film-contact-sheet.jpg` | the whole film at 11 times | the five shots read; the cut into S2 lands on her stopped; S5 rhymes with S1 with the bird gone |
| `02-walk-strip.jpg` | every frame of the walk (0.90–1.55 s) | feet alternate, no sliding, the settle step closes the stance |
| `03-key-press-strip.jpg` | every frame of the contact (4.10–4.65 s) | anticipation, arc, contact, hold, release, overshoot |
| `04-shots-s2-s3-s4.jpg` | S2/S3/S4 at full width | keys and candle visible; her silhouette holds; the bird is on the lid |
| `05-s3-detail-full-res.png` | S3 at 1:1 | the candle, the piano's caster, grass in perspective, treeline |
| `06-s1-wide-full-res.png` | S1 at 1:1 | house, tree, treeline, grass texture, the woman in stride |
| `07-defects-found-during-build.jpg` | model sheets during the build | the failures below, before they were fixed |
| `09-bird-takeoff-strip.jpg` | every frame of 9.10–9.60 s | crouch, two power strokes, climb; one bird only |

Defects found by looking, not by reading code (all fixed before delivery):

1. **The world was rotated wrong**: `localToWorld` treated a yaw in degrees as radians, so the house, the piano's keyboard
   and every prop sat in the wrong orientation; the key she "played" was 0.8 m away. Caught by a model sheet of the piano.
2. **Hands at her knees**: the hanging forearm's direction was used as a unit vector, making a 1 m forearm. Caught in a
   full-resolution figure still.
3. **The walk ended three metres off its path**: the gait's path direction used `(cos, −sin)` instead of `(sin, cos)`. Caught
   by a walk strip that seemed to "slide".
4. **Feet off the ground**: the stance foot was planted under the hip, so the leg was over-extended at the end of each
   stance. Caught by QA (P0 ankle 0.12–0.16 m) and visible in the strip as a hitch.
5. **Bark and grass drawn outside their surfaces**: texture marks were not clipped to the projected polygon. Caught in a
   detail crop of the tree.
6. **Foliage as circle blobs**: rendered as a handful of large translucent discs. Replaced with an organic clump mass.
7. **Limbs as separate sticks**: gaps at elbows and knees. Replaced with capsules plus joint discs, and hulled torso/coat.
8. **A 5 s frame**: a close-up's `screen`-blend rim filled a 5000×8000 px rect and the DOF bands were full-resolution.
   Caught by the still render timing. Fixed with `clipBox` and half-res cached bands (now 110–250 ms).
9. **A candle with key gaps**: the wax used the ivory material, so it was striped, and the flame sat under the wick.
   Caught in the S3 still.
10. **S3 framed from inside the coat, then under the lid, then inside the case**: three restagings until the camera was
    placed at ground level outside the piano, looking along the candle. Caught by opening every attempt.
11. **A chimney floating above the roof** and **a boarded window that read as a lit window** (inverted winding): caught in
    a house model sheet; fixed by seating the chimney on the roof plane and by turning normals towards the lens.
12. **Documentation drift**: the shots' `meta.lens` strings said 32/40/85/45 mm while the cameras rendered 35/50/60/35 mm.
    Caught while writing the shot list; both fixed to the same values.

## 8. Verdict

P0 = 0, P1 = 0, P2 = 3 reviewed and accepted with reasons. The film is delivered: `out/film.mp4`, 12.000 s.

Honest limits of this delivery: the figure is a silhouette (no face); depth of field is four blurred depth bands, not real
bokeh; the painter's algorithm cannot resolve interpenetrating geometry, so nothing in the film intersects; S3 is a
ground-level detail rather than the hand close-up the first storyboard asked for, because the geometry of an open grand
piano lid does not allow that camera position.


