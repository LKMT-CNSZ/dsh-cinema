# Panoramic composition

The panorama is this system's strongest frame: one subject, real air between five depth planes, and detail that survives a 1:1 crop — and this page is the checklist a wide shot passes before it is rendered at full quality.

## 1 · The ten properties, each with a measurable test

| # | property | test (number, and how to get it) | reference value |
|---|---|---|---|
| 1 | a clear subject | name it in one sentence in `meta.reads`; its screen height is 0.10 – 0.36 H | figure 333 px (0.31 H), piano's raised lid 385 px (0.36 H) in W1 |
| 2 | a visual centre of gravity | the subject's screen centroid within ±0.06 W of 0.5 W or of a third | piano base x = 953 px (0.496 W), house 472 (0.246 W), tree 1545 (0.805 W) |
| 3 | believable proportion | projected height = real height × `focalPx` / view depth, within ±5 % | 1.68 m figure at 8.63 m on 32 mm = 332 px predicted, 333 px measured |
| 4 | foreground / middle / background | at least 3 distinguishable planes whose view depths differ by ≥1.5× | 3.0 / 7.9 / 21.4 / 34.3 / 94.5 m — five planes, 567 → 18 px/m |
| 5 | credible perspective | no roll; the horizon is the pinhole horizon `cam.horizonY`; verticals stay vertical | 0° roll; horizon 443 px at W1's head, 430 px at its tail |
| 6 | natural light | one sun direction for the whole film; every plate face states its own `shade` | `sunDrift` ≤ 0.035° across a cut; façade `shade 0.21` vs return `0.42` |
| 7 | purposeful emptiness | the quiet fraction: 16 px blocks whose std < 4/255, on a 480×270 downscale | 0.377 (W1), 0.407 (W2); the band is 0.30 – 0.55 |
| 8 | fine environment detail | a 300×300 crop at 100 % from each plane shows ≥3 value steps and ≥2 mark scales | house: 43 marks from a 0.03 m glazing bar to a 10 m roof |
| 9 | a little natural motion | 2 – 5 registered movers, no two sharing a period | 5 movers (`light`, `wind`, `clouds`, `figure.coat`, `bird`); 4.7 / 11.3 / 1.9 / 0.73 / 57 / 23 / 40 / 37 s |
| 10 | narrative framing | `meta.reads` tiles the shot with no gap | W1: 5 reads over 7.4 s, checked by `finishTimeline()` |

## 2 · The reference composition, measured

*Wind Past the Piano*, W1 at t = 0.5 s, 1920×1080, 32 mm on a 36 mm sensor (`focalPx` = 1706.7 px), camera at z = −7.39 m. Every column below is read from `qaAnalyze(0.5)`, not estimated.

| element | world anchor | view depth | px per metre | screen x of the anchor | what it occupies |
|---|---|---|---|---|---|
| treeline (`far`) | z = 88 m, y = 10.5 m | 94.5 m | 18.1 | 1078 (0.56 W) | the ridge across the horizon at 443 px |
| house (`house`) | (−11.5, 0, 26) | 34.3 m | 49.8 | 472 (0.25 W) | 6.8 m tall → 339 px (0.31 H) |
| tree (`tree`) | (6.6, 0, 14.5) | 21.4 m | 79.6 | 1545 (0.80 W) | 8.2 m tall → 653 px (0.60 H) |
| piano (local 3D) | (0.30, 0, 0.40) | 7.9 m | 216 | base at 953 (0.50 W) | 1.78 m lid → 385 px (0.36 H) |
| figure (local 3D) | (−1.28, 0, 1.02) | 8.6 m | 198 | 651 (0.34 W) | 1.68 m → 333 px (0.31 H) |
| foreground (`foreA`) | (0.35, 0, −4.50) | 3.0 m | 567 | 752 (0.39 W) | tallest blade at y ≈ 745 px (bottom 31 %); the plate's base is below the frame, so the blades are what shows |

The horizon runs from 443 px (0.410 H) at the head of W1 to 430 px (0.398 H) at its tail — the camera tips 0.45° down over the 7.4 s dolly. All of it is inside the 0.38 – 0.46 band, and the cut's job is to land W2's first frame within `horizonJump` = 0.008 H (8.6 px) of W1's last, so measure both sides with `qaAnalyze(t).cam.horizonY` before calling a cut matched (section 5).

Depth spacing is what makes the slow dolly legible: every plane is at least 1.6× the previous one, and the near-to-far scale ratio is 567/18 ≈ 31×, so a 0.7 m push moves the grass about thirty times as far on screen as the treeline.

Lens and position are chosen together, and the table shows why: 32 mm at 7.9 m gives the piano 216 px/m, and a 50 mm lens from the same spot would give 338 px/m — a medium shot of a piano, not a panorama with a piano in it. Change the focal length only when the shot is meant to become a different size, which is exactly what the W1 → W2 cut does (section 5).

## 3 · Measuring a panorama before you trust it

```js
// node scripts/probe.mjs "<expr>" — one shot, from the page's own geometry
(() => {
  const t = 0.5, r = qaAnalyze(t), c = SCENE.cam;
  const foot = project(c, [-1.28, 0, 1.02]), head = project(c, [-1.28, 1.68, 1.02]);
  const inCore = (x) => x > 150 && x < 1770;                       // the 3:2 core of 1920 x 1080
  return {
    horizon: +(c.horizonY / 1080).toFixed(3),                     // 0.38 - 0.46
    subjectH: +((foot.y - head.y) / 1080).toFixed(3),              // 0.10 - 0.36 = panorama
    planes: Object.entries(r.plates).map(([n, p]) => [n, p.depth]),  // >= 3, adjacent >= 1.5x
    massesInCore: ['house', 'tree', 'piano'].map((n) => inCore(n === 'piano' ? 953 : r.plates[n].ox)),
  };
})()
```

- The 3:2 core of a 1080-px-high frame is 1620 px wide, so it is x = 150…1770. A 16:9 frame is 300 px wider than that: the extra width is for **edge rhythm**, not for more objects.
- Read `r.plates[name].depth` for the plane test, and `r.plates[name].ox` for the thirds. If a plate is missing from `SCENE.plates`, the shot did not draw it — a 2.5D defect, not a composition one.
- `node render.mjs --strip=0.6:1.2 --crop-at=-1.28,1.0,1.02,420,420 --out=out/check/zoom.jpg` follows the figure through the dolly: the only way to see whether the subject keeps its size and position while the camera moves.

## 4 · 3:2 photographic restraint inside a 16:9 frame

A 3:2 photograph is calmer than 16:9 because it does not offer room for one more object. Inside 16:9, three rules keep that calm:

1. **One line per shot.** Each shot is built on one diagonal or one horizontal: W1's line is the horizon plus the treeline ridge; nothing else crosses the frame at a similar angle. Test: draw the line on the contact sheet; if a second line competes within ~10°, delete one.
2. **Edge rhythm, not more objects.** Put the flanking masses near the frame edges (house at 0.25 W, tree at 0.80 W) and leave the middle for the subject (piano at 0.50 W). The width is spent on the gap between masses, not on filling it.
3. **A negative-space budget.** 0.30 – 0.55 of the frame may be quiet (sky or open field), measured as the fraction of 16 px blocks whose std is under 4/255: the reference measures 0.377 in W1 and 0.407 in W2.

Emptiness becomes laziness in three cases: the quiet area covers the subject's own zone (the middle third), the quiet fraction climbs past 0.65, or the "empty" field has no gradient at all — `stats.std` under `RULES.emptyStd` (2.5) is a P0 `empty frame`, not a style.

## 5 · The same place, closer: W1 → W2 as a match cut

A panorama proves itself when the next shot changes the distance and not the world. The reference does it with geometry, never a zoom:

| quantity | W1 head | W2, first frame | change |
|---|---|---|---|
| lens | 32 mm (1,706.7 px) | 40 mm (2,133.3 px) | ×1.25 |
| piano view depth | 7.9 m | 4.36 m | ×0.55 |
| figure view depth | 8.6 m | 5.32 m | ×0.62 |
| figure height on screen | 333 px (0.31 H) | 678 px (0.63 H) | ×2.04 |
| foreground plate depth | 3.0 m | 1.46 m | ×0.49 |
| house `k` | 49.8 px/m | 66.8 px/m | ×1.34 |
| horizon | 430 px at W1's tail | 430 ± 8.6 px required | measure both sides |

The arithmetic is the test: `height × focalPx / viewDepth` predicts 674 px for the figure in W2 against 678 measured — within 1 %, which is what a real move looks like.

The horizon is the trap, and it catches almost everyone: the horizon's offset from frame centre is `focalPx × tan(pitch)`, so a 25 % longer lens at the *same* pitch pushes the horizon 25 % further from centre. W1 ends at 429.6 px with pitch −3.70°; at 40 mm the matching pitch is `atan((540 − 429.6) / 2133.3)` = −2.97°, which means raising the W2 target's height from 0.85 m to about 0.91 m. Copying the previous shot's pitch instead leaves the horizon 28 px high and the sweep reports a P1 `horizon jumped at the cut` — compute the target height from the horizon you need, and never from the previous shot.

## 6 · Checklist before the full-quality render

1. A full-resolution still, opened and looked at — not merely generated.
2. The ten properties marked pass/fail with the measured number beside each (section 3's probe).
3. `cam.horizonY / 1080` inside 0.38 – 0.46, and within 8.6 px of the neighbouring shot's at a match cut.
4. Subject height 0.10 – 0.36 H, and within ±5 % of real height × `focalPx` / view depth.
5. At least 3 plate planes with view depths ≥1.5× apart, read from `SCENE.plates`.
6. Quiet fraction 0.30 – 0.55 by the block measure; `stats.std` ≥ 2.5 everywhere outside a declared fade.
7. Three 1:1 crops: the near band, the subject, the far plane. `node render.mjs --sheet=0.5 --crop=150,0,1620,1080 --w=540 --out=out/check/core32.jpg` shows the 3:2 core.
8. `node render.mjs --qa --range=<shot start>:<shot end>` with no P0 and no P1 for that range.
9. The plate record written down: `depth`, `k` and anchor `ox` per plate, so the next shot can be checked against it.

## 7 · What ruins a panorama, and the fix

| failure | what it looks like | fix |
|---|---|---|
| piling objects in to fill the width | a stage set; the eye has no resting place | remove two of them and hold the frame with the one line and the sky — the reference has five elements plus grass, for 7.4 s |
| a row of identical cut-out trees | a paper chain along the horizon | 2 – 3 ranks, each flatter and more opaque (`amp` 5.4 / 4.1 / 2.8, `alpha` 0.72 / 0.84 / 0.96 in the reference), heights and spacing from `hash2`, and 44 + 64 crowns breaking the ridge |
| a house made of boxes | low-poly, and the eye places it instantly as a prop | 43 plate marks: roof courses, sills, glazing bars, a broken pane, a curtain, a door with a step and a brass handle, 46 streaks, moss, a lost patch of render, gutter, downpipe, eave shadow, chimney with two faces |
| a straight hard horizon, no treeline, no haze | a seam between two flat colours; the field reads as a backdrop | the treeline sits ON the horizon, `drawSky` lays a haze band from 0.16 H above to 0.04 H below it, and the ground gradient is pinned to `cam.horizonY` |
| a "foreground" plate 13 m away | a hedge across the middle distance | anchor the foreground inside 6 m of the lens (reference: 3.0 m in W1, 1.46 m in W2, both above the 1.1 m guard), and check where its top edge lands: `plateScreen(name, 0, height)` must be above y = 1080 or the plate is invisible |
| detail spread evenly across the frame | busy and flat at the same time | concentrate marks where the eye is: the subject and the near plane (see `detail-density.md`) |

## 8 · Two things to say out loud

1. **A panorama is not a wide shot.** A 0.63 H figure in W2 is a medium framed wide; the ten properties are what separates a panorama from a wide medium. W2 is deliberate — the same place, closer — but it is not a second panorama.
2. **Every number above is a measurement, not a memory.** Re-run section 3's probe after any plate change: depth, `k`, and the anchor's screen x are what composition actually is here, and they move the moment a camera does.

