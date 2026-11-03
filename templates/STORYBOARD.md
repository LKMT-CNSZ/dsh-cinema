# Storyboard — The Piano in the Field

The shot-by-shot document, written before the shot files and kept in step with them. One block per shot, in film order. Every position is in metres in one coordinate system: **+Y up, ground at y = 0, +X east, +Z north, yaw in degrees about +Y (0 = facing +Z)**. Times are film seconds from 0.000; `meta` in `shot()` must repeat `scene`, `size`, `lens`, `motion`, `transition` and `reads` from this document, so the storyboard and the timeline cannot drift.

| film | duration | fps | frame | shots |
|---|---|---|---|---|
| The Piano in the Field | 12.000 s | 24 | 1920 × 1080 | 5 |

The **in** row of each block is the previous shot's **out** row — a cut is one event described twice, and only after the cut changes are both descriptions true.

---

## S1 · the establishing wide

| field | value |
|---|---|
| number | S1 |
| start–end | 0.00–2.90 s |
| duration | 2.90 s |
| in | fade in from black over 0.55 s, `fadeColor '#07080c'` |
| out | hard cut at 2.900 s, on her stopping |
| scene | field, wide |
| size | wide |
| camera | pos (−1.62, 1.38, −6.35) + `CAM.breath(lt, 0.0022, 3, 0.5)`; target (0.32, 1.06, 0.85); height 1.38 m; 35 mm (54.4° horizontal), focus 7.2 m, f/5.6; locked off, tripod breath |
| light | `lategold`; sun intensity 1.92 → 2.02 over 0.6–2.90 s; direction is the film constant `vnorm([-0.70, 0.235, 0.67])`, 61° off the lens axis towards frame-left and 13.6° above the horizon, so the field is backlit from front-left; candle point (−0.62, 0.215, 1.55) `#ffb066`, intensity 0.55, radius 0.5 m |
| subject | the woman walks `FIELD.walk` from (−3.02, 2.40) to (0.02, 1.78) between 0.10 and 2.30 s, then turns to yaw 168° by 2.78 s; the bird is perched at (0.851, 1.778, 0.211), yaw 258° |
| action | a walk watched for longer than it needs to be, a stop, a turn, a look down at the keyboard |
| environment motion | 54 grass tufts on `windAt(t, p)`; treeline static; candle flame ±0.14 at 11.3 Hz and ±0.07 at 23.1 Hz |
| materials | grassGround, foliageDry, stone, plaster, brick, roofSlate, wood, glassDark, bark, lacquer, lacquerSide, woodPale, ivory, brass, metalDark, wax, silhouette |
| frame detail | piano at (0.30, 0.40) yaw −12°; house 26 m away at 18 % haze; treeline at 60 m at 35 %; shadows run east-south, towards frame-right and the lens; her coat hem 0.46 m above the grass |
| sound | wind bed; footsteps 1–5 at 0.16/0.62/1.07/1.52/1.96; two chirps far left at 1.05 and 1.24 |
| narrative job | establish the place and the piano's scale; make the walk long enough to be watched |
| reads | 4 |

- `0.0–1.0` the place: field, house, tree, piano
- `1.0–1.9` a figure is walking in from the left
- `1.9–2.6` the bird on the lid, watching her
- `2.6–2.9` she arrives at the keyboard

---

## S2 · the medium over her shoulder

| field | value |
|---|---|
| number | S2 |
| start–end | 2.90–6.10 s |
| duration | 3.20 s |
| in | hard cut at 2.900 s from S1, on her stopping |
| out | hard cut at 6.100 s, 1.48 s after the key release (the metadata string calls it "cut on the release of the key") |
| scene | field, medium over her shoulder |
| size | medium |
| camera | pos (3.05, 1.56, 3.62) → (2.28, 1.43, 2.78) over lt 0.15–3.0 by `easeInOutCubic`, travel 1.15 m; target (0.30, 1.10, 1.30) → (0.26, 1.04, 1.22); height 1.42 → 1.36 m; 50 mm (39.6° horizontal), focus 3.85 → 2.75 m over lt 1.0–2.6, f/2.4; breath 0.0018 m seed 5; `dof` hands `focus`/`aperture` to the renderer |
| light | `lategold`; sun intensity 2.02; direction constant, 121° off the lens axis — the sun is behind the camera's right shoulder, so she is lit as a side-front figure and not a silhouette; candle point (−0.62, 0.215, 1.55) intensity 0.95, radius 0.75 m |
| subject | root (0.02, 0.92, 1.78) yaw 168°; left hand target is the key-bed front edge at piano-local (0.32, 0.735, 1.205) + (0, 0.075, 0.055); right wrist at `keyPoint(0.44)` + (0.015, 0.118, 0.03) |
| action | left hand settles 3.02–3.92 s; right hand anticipates 3.55–3.70 s, crosses on an arc whose control point is 0.31 m above the key 3.70–4.22 s, holds 4.22–4.62 s, withdraws to 5.30 s with a spring overshoot from 5.18 s; head, chest and shoulder arrive at three different times, the head 110 ms behind its target |
| environment motion | candle flame; tufts at the frame edge; no dust in this shot |
| materials | lacquer, lacquerSide, woodPale, wood, ivory, brass, metalDark, wax, silhouette, grassGround, foliageDry, stone, plaster, roofSlate, bark |
| frame detail | the focus pull is the shot: 3.85 → 2.75 m while the camera closes 1.15 m; as written the pull now ends on the keys (2.73 m from the lens), so see `SHOT_SPEC.md` §4 before copying it; the key travels 6 mm; the lid's 34° plate holds the sky; haze on the subject is about 2 % — this shot is not hazy |
| sound | cloth 3.30; key touch 4.200, knock 4.222, note 4.235, mechanism 4.240; key release 4.625 (`masked`); cloth 4.85; the wind bed ducked 3.85–5.35 |
| narrative job | make the press physical, and move attention from the person to the act |
| reads | 5 |

- `2.9–3.6` she is at the piano, left hand finding the key bed
- `3.6–4.2` the right hand anticipates and reaches
- `4.2–4.6` contact: one key goes down
- `4.6–5.4` she releases and withdraws; the note keeps going
- `5.4–6.1` she listens

---

## S3 · the close-up

| field | value |
|---|---|
| number | S3 |
| start–end | 6.10–8.90 s |
| duration | 2.80 s |
| in | hard cut at 6.100 s from S2, after she has listened for 1.5 s |
| out | hard cut at 8.900 s, on her head turning after the bird |
| scene | piano keyboard raking to the candle, close-up |
| size | close-up |
| camera | pos (−0.02, 0.505, 2.98) + `CAM.breath(lt, 0.0012, 7, 0.3)`; target (−0.60, 0.300, 1.50); height 0.505 m; 60 mm (33.4° horizontal), focus 1.55 m, f/2.0; locked off, holding; `dof` active |
| light | `lategold`; sun intensity 1.86; direction constant, 112° off the lens axis — the sun is behind the camera's right, raking across the keys; candle point at 2.6 with radius 0.62 m, the brightest practical in the film and the warm side of the ivory |
| subject | the keyboard seen from 0.505 m, raking away from the lens; her figure at the edge of frame, still; the key is at rest — its 6 mm travel ended at 4.70 s |
| action | nothing. The note is dying; the candle is burning; the dust is moving |
| environment motion | 26 dust motes (0.004 m, rngFrom(91)) drifting 0.02 m at 0.6 rad/s between y 0.62 and 1.37; candle flame; tufts out of focus in front |
| materials | ivory, lacquer, lacquerSide, wax, silhouette, grassGround, foliageDry, stone, bark |
| frame detail | depth bands make the candle the only sharp warm thing and the ivory the only sharp bright thing; dust is drawn only where the sun reaches; haze on the keys is about 1 % |
| sound | the note's tail (4.235 + 7.4 s = 11.635) and nothing new; the wind returns at 5.35; no foley in this shot at all |
| narrative job | give the sound time to leave the frame; prove the film is willing to hold |
| reads | 4 |

- `6.1–6.6` the keys, raking away from the lens
- `6.6–7.4` the candle at the far end of the keyboard
- `7.4–8.4` dust in the low light; the note is still going
- `8.4–8.9` the flame moves; the flame leans, nothing else moves

Read 4 is a continuity risk, not a fact: the bird is perched until 8.76 s and the score's first stroke is 9.18 s, so "the flame leans, nothing else moves" at 8.4 s has no source and there is only one bird in the world. The read is kept verbatim because `meta.reads` repeats it — fix the read and the shot together, or delete the line.

---

## S4 · the bird leaves

| field | value |
|---|---|
| number | S4 |
| start–end | 8.90–10.60 s |
| duration | 1.70 s |
| in | hard cut at 8.900 s from S3, on her head turning |
| out | hard cut at 10.600 s, 0.15 s after the bird is out of frame (10.45) and 0.35 s after its last wingbeat (10.254) |
| scene | field, medium wide from behind the piano |
| size | medium wide |
| camera | pos (3.55, 1.74, 1.15) + `CAM.breath(lt, 0.002, 9, 0.45)`; target (0.35, 1.62, 0.55) → (0.72, 2.18, 0.40) over lt 0.45–1.5 by `smoothstep01` (10.7° of tilt up); height 1.74 m; 35 mm (54.4°), focus 3.1 → 3.7 m, f/2.8 |
| light | `lategold`; sun intensity 1.98; direction constant, 54° off the lens axis to frame-left — backlit again, the bird a silhouette against the sky; candle point 0.34, radius 0.45 m |
| subject | the bird at the perch (0.851, 1.778, 0.211) until 9.18 s, crouching from 8.76 s, then on a cubic Bézier to (−8.6, 6.4, −3.2) with out-of-frame at 10.45 s; the woman at the keyboard, head tracking the bird from 8.60 s, shoulders 0.5 s later |
| action | one crouch, one push, seven wingbeats, one tilt — the film's only event, and it is small |
| environment motion | flap at 4.6 Hz; candle flame; tufts; the treeline static |
| materials | silhouette (bird and the woman), lacquer, ivory, grassGround, plaster, bark, stone |
| frame detail | the camera carries the bird's line instead of cutting to it; her head arrives late and her shoulders later; the tilt lifts the frame until the sky has taken the top of it and the bird has somewhere to climb |
| sound | takeoff 9.18 and seven wingbeats through 10.254, panning +0.35 → −0.60 and falling 5.2 dB; the note's last ring; no new foley |
| narrative job | pay off the bird that has been in every shot; let one thing happen |
| reads | 4 |

- `8.9–9.2` the bird on the lid, the field behind it
- `9.2–9.6` the crouch and the first two strokes
- `9.6–10.2` it climbs out of frame top left; the camera tilts
- `10.2–10.6` her head and shoulders follow it

---

## S5 · the closing wide

| field | value |
|---|---|
| number | S5 |
| start–end | 10.60–12.00 s |
| duration | 1.40 s |
| in | hard cut at 10.600 s from S4, 0.15 s after the bird is out of frame |
| out | fade to black over the last 0.45 s, `fadeColor '#07080c'` — the film ends on the hold, with no black held after the last frame of meaning |
| scene | field, wide (opening rhyme) |
| size | wide |
| camera | pos (−1.86, 1.41, −6.20) + `CAM.breath(lt, 0.0024, 11, 0.45)`; target (0.50, 1.07, 0.88); height 1.41 m; 35 mm (54.4°), focus 7.1 m, f/5.6; locked off, tripod breath. 0.28 m from S1 — the rhyme is recognisable and not a duplicate |
| light | `lategold`; sun intensity 1.90 → 1.80 over lt 0.2–1.4 (the light keeps going down); direction constant, 65° off the lens axis to frame-left; candle point 0.32, radius 0.45 m |
| subject | the woman still at the keyboard, root (0.02, 0.92, 1.78), head settling back to the keys from 10.40 s; the bird is not drawn at all |
| action | hold. Nothing is done to the frame; the light does the only changing |
| environment motion | tufts, candle flame; the note's final decay until 11.635 |
| materials | grassGround, foliageDry, stone, plaster, brick, roofSlate, wood, glassDark, bark, lacquer, ivory, brass, wax, silhouette |
| frame detail | the piano, the house, the tree, her — the S1 frame with one prop missing; haze 18 % on the house; the composition must read as "the same place", not as "the same shot" |
| sound | two chirps far left at 10.62 and 10.80; the wind closes 11.30–11.95; the score fades from 11.65 while the picture fades from 11.55; the note stops at 11.635 |
| narrative job | end where the film began, with the place changed by what happened in it and by nothing else |
| reads | 3 |

- `10.6–11.2` the field again, her still at the piano
- `11.2–11.6` the bird is gone; the candle is not
- `11.6–12.0` hold, then black

---

## Continuity ledger

| thing | value that may not change | what catches it |
|---|---|---|
| sun | `vnorm([-0.70, 0.235, 0.67])`, colour `[1.0, 0.72, 0.45]`; intensity may vary 1.86–2.02 | `sunDrift` 0.035° at a cut (P1) |
| exposure | 0.80 from `lategold` | `exposureDrift` 0.35 at a cut (P1) |
| camera inside a shot | ≤ 0.16 m, ≤ 4.5°, ≤ 1.5 mm per adjacent frame | `camPosJump`, `camYawJump`, `camFocalJump` (P0) |
| piano | `placeProp('piano', {x: 0.30, z: 0.40, yaw: -12})`, case 0.94 m, lid 34° | `single instance` probe (P0) |
| candle | at (−0.62, 0, 1.55), flame and light at y 0.215 | light blocks in all five shots |
| key | `getThing('prop', 'piano').keyPoint(0.44)` | `woman.key-contact` under 0.03 m (P0) |
| the woman | one pose, `womanPoseOnKey(t)` of film time, for every shot | `woman.feet-on-ground` 0.05–0.11 m; bone length 2 % (P0) |
| the bird | perch (0.851, 1.778, 0.211); takeoff 9.18; out of frame 10.45; not drawn in S5 | `single instance` (P0) |
| timeline | shots tile 0.000 → 12.000 with no gap or overlap | `finishTimeline()` (P0) |

---

## Blank shot block — copy for a new film

| field | value |
|---|---|
| number | |
| start–end | |
| duration | |
| in | |
| out | |
| scene | |
| size | |
| camera | pos / target / height / focal / focus / aperture / move / breath |
| light | preset / sun intensity / sun direction note / practicals |
| subject | position and pose at the head of the shot |
| action | what the subject does, with times |
| environment motion | what moves that is not the subject |
| materials | |
| frame detail | the one thing a single frame of this shot must contain |
| sound | cues and what is deliberately absent |
| narrative job | why this shot exists at all |
| reads | |

- `__–__`
- `__–__`
- `__–__`


## Depth notation

Draw the frame as a ground plan under each panel: a horizontal axis for screen position, a vertical axis for distance from
the lens, and every plate as a bar at its depth with its band number. Two bars at the same depth are one plane - they will
always move together - and that is almost never what a panorama wants.

```
DISTANCE (m)  2      4        14.5      26                  88
              |      |         |         |                   |
fore plane    [======== grass ========]                        band 28
mid planes                     [= tree =] [===== house =====]  band -16 / -15
far plane                                            [= treeline ======]  band -60
local 3D             [piano][figure]                            band 0
```

Two rules for the plan:

1. **Adjacent depths must differ by at least 2×** for the parallax to read at slow camera speeds. The reference film uses
   3 m, 14.5 m, 26 m, 88 m - four distinct planes, each one roughly double the last.
2. **The subject sits alone at its depth.** If something else shares the piano's plane, one of them is in the wrong place.
