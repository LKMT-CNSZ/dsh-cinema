# Detail density

Minimal is a decision about composition, not permission for an empty surface: this page defines how many marks a frame needs, which plane each mark belongs to, how a mark is authored so it survives a camera move, and how to prove the detail is actually there.

## 1 · The density ladder

| plane | what the eye can resolve | what must be drawn | reference film |
|---|---|---|---|
| distant, 60 – 100 m+ | a silhouette and 2 – 3 tonal masses | the outline, a crown texture that survives haze, one or two height steps | treeline: 3 ridge fills + 108 crown ellipses at `k` = 18.1 px/m, so a 3 m crown is 54 px and 1 px = 0.055 m |
| middle, 10 – 40 m | construction: it must be recognisable as *that* building, *that* tree | roof courses, sills, glazing bars, a door, an eave shadow, weathering; bark, limb structure, leaf clusters | house: 43 marks at 49.8 px/m (W1) / 66.8 px/m (W2); tree: 196 marks |
| near, 1 – 6 m | texture and edge: close enough to count | per-mark variation in size, colour and lean; occlusion of the subject | 560 blades at 567 px/m (W1) and 1,458 px/m (W2); a 6 – 14 mm blade is 3.4 – 7.9 px wide at 3 m and 8.7 – 20.4 px in W2 |

The ladder is not a style: it is the resolution limit of the eye at that distance. A 2 cm glazing bar at 34 m is 1.5 px, so it must be drawn as a 1-px line, not as a bar with two edges.

## 2 · The mark inventory of the reference film

Counted by wrapping `plateFill` / `plateLine` / `plateDetail` and reading the counts per plate — the same number `BUDGET.finish()` reports.

| plate | marks | what they are |
|---|---|---|
| `far` | 111 | 3 ridge fills (96-point ridges, `amp` 5.4 / 4.1 / 2.8) + 108 crowns: 44 at rank 1, 64 at rank 2 |
| `house` | 43 | painted ground shadow, wall, sunlit return, 2 roof slopes, ridge line, eave shadow, ground contact, chimney front + side + cap, 3 windows, door frame + leaf + step + brass handle, gutter, downpipe, and one clipped pass holding 46 streaks + a moss gradient + a 7-segment lost-render patch |
| `tree` | 196 | 2 painted shadows, trunk fill, one detail pass of 90 bark strokes (4 – 16 mm wide), 66 limbs in 4 levels (0.11 – 0.13 m at level 1, × 0.62 per level), 63 leaf clusters of 42 dabs each |
| `foreA` | 596 | grass base band + 560 blades (each a 4-segment tapered ribbon, 6 – 14 mm at the root) + 35 seed heads (one blade in sixteen) |
| `foreB` | 368 | the same construction at the closer plate: base band + 340 blades + 27 seed heads |
| **W1 total** | **946** | `BUDGET.measured.plateFills` = 946, with 134 – 148 local-3D surfaces = 1,080 – 1,094 queued ops |
| **W2 total** | **718** | `plateFills` = 718, with 126 local-3D surfaces = 844 ops |

Two details worth copying: the blades are **filled ribbons, not strokes** (a stroke has one width and reads as a straw), and the grass passes `tex: 'none'` because texture inside a 4 px blade is invisible at 560 blades a frame.

## 3 · Four mark scales inside one surface

The house is 43 marks and they are not one scale. Every surface that reads as built carries at least four:

| scale | marks in the reference house | physical size | pixels at 49.8 / 66.8 px/m |
|---|---|---|---|
| structure | façade 10 m × 4.35 m, roof rise 2.45 m | 2 – 10 m | 100 – 500 px |
| construction | window opening 1.2 × 1.5 m, door 0.8 × 2.25 m, eave shadow 0.72 m | 0.7 – 1.5 m | 35 – 75 px |
| joinery | sill 0.09 m, frame reveal 0.07 m, gutter 0.055 m, glazing bar 0.035 m | 3 – 9 cm | 1.5 – 5 px |
| hardware | roof ridge line 0.05 m, brass door handle 0.035 m radius | 2 – 7 cm | 1.7 – 3.5 px |

A surface with only the first two scales reads as a flat fill with a border; a surface with only the last two has no shape. The 1.7 px handle still reads because it is a *bright* mark on a shaded door — it survives on contrast, not on size. Decide the smallest mark by what can contrast, not only by what can resolve.

## 4 · Authoring one mark so it scales

```js
// one leaf cluster: one fill, one clipped dab pass, 42 dabs of 2.5 - 7.5 cm  (panorama.js, panoTree)
plateFill(plateEllipse(cx, cy, s * 1.25, s * 0.8, 14, 0.3), 'foliageDry',
          { shade: 0.4, tone: -0.1, alpha: 0.82, key: 700 + i });
plateDetail(plateEllipse(cx, cy, s * 1.25, s * 0.8, 14, 0.3), (c, box) => {
  const rnd = rngFrom(7301 + i * 31);                 // one seed per cluster: stable every frame
  for (let k = 0; k < 42; k++) {
    const a = rnd() * TAU, r = Math.pow(rnd(), 0.6);  // power curve: denser at the centre
    const x = box.bbox.x0 + box.bbox.w * (0.5 + Math.cos(a) * r * 0.46);
    const y = box.bbox.y0 + box.bbox.h * (0.5 + Math.sin(a) * r * 0.42);
    c.fillStyle = `rgba(${52 + rnd() * 46 | 0},${50 + rnd() * 40 | 0},${24 + rnd() * 26 | 0},${0.35 + rnd() * 0.4})`;
    c.beginPath();
    c.ellipse(x, y, Math.max(1, box.k * (0.025 + rnd() * 0.05)),   // 2.5 - 7.5 cm, floor 1 px
                     Math.max(1, box.k * (0.015 + rnd() * 0.03)),   // 1.5 - 4.5 cm
                     rnd() * TAU, 0, TAU);
    c.fill();
  }
});
```

1. **Metres in, pixels out.** Every size is `box.k * <metres>`; the `Math.max(1, …)` floor is the only pixel in the expression, and it exists to keep a sub-pixel mark from disappearing rather than to set a size.
2. **Seed every mark set.** `rngFrom(7301 + i * 31)` per cluster, `rngFrom(6611)` for bark, `rngFrom(5177)` for weather: the marks are identical every frame of every render, so nothing crawls when the camera moves.
3. **Vary three things per mark.** Size, colour and angle (the blades vary height to 0.3 – 1.0 of the plate height, material 55/45, `shade` 0.5 – 1.05, and lean from `AMBIENT.grassSway`); one varying property still reads as a pattern.
4. **One clipped pass per shape.** The 46 streaks are 1 op with 46 strokes inside it, not 46 ops — that is how a house stays inside its `plateFills` declaration.

## 5 · Detail is spent where the eye is

W1's 946 plate marks are not spread: **foreground 596 (63 %), tree 196 (21 %), treeline 111 (12 %), house 43 (5 %)**. More than half the drawing budget is in the near plane, because that is where the eye spends its time and where an empty surface is most obvious.

- **The sweep measures this.** `detailNearRatio` = 1.25: the near third's edge energy must be at least 1.25× the middle third's, from `stats.bands` (a 128×72 downscale, thirds at 0.34 H and 0.62 H). W1 at t = 0.5 measures bands `[15.83, 16.47, 32.42]` = 1.97×, and passes.
- **And the sky must stay calm.** `skyNoiseRatio` = 1.6 fails a frame whose top third is noisier than its middle third — clouds are low-frequency marks, and grain is not detail.
- **The budget is a promise, not a ceiling.** W1 declares `plateFills: 1000` against the engine's default `BUDGET.limits.plateFills` 260; over 1.2× the declaration is P2, over 2× is P1. The measured 946 / 718 are what those declarations are calibrated against.
- **The cost of a mark.** A 1080p frame draws in 45 – 84 ms; a finished PNG still costs about 1.26 s end to end and a JPEG still about 0.25 s. Marks are cheap; PNGs are not, so review in JPEG sheets and spend full-resolution PNGs only on the frames that decide the shot.

## 6 · The cull order when the budget is blown

When `node render.mjs --qa` reports a budget overrun, cut in this order — never in another:

1. **Marks below ~2 px.** They cost an op and show nothing. The engine already gates its own: piano keys are drawn only when a 22 mm key is over 3 px (`cam.focalPx / zKey * 0.022 > 3`), the strings only when a 10 mm gap is over 2.2 px.
2. **Interior texture on the far plane.** The treeline is silhouettes plus haze; a texture pass inside a 54 px crown is invisible under `haze: 0.42`.
3. **A second weathering pass on the same shape.** Merge it into the one clipped `plateDetail` — the count of ops falls, the count of strokes does not.
4. **A whole object the `reads` never mentions.** If the shot's `meta.reads` does not name it, it is set dressing, and set dressing is where the budget went.

Never cut these five, whatever the overrun: the contact shadow, the eave shadow, the glazing bars, the blade taper, and the specular on lacquer. They are what says "a real material under a real light", and their absence is visible from across the room.

## 7 · Anti-patterns, with the fix

| anti-pattern | why it fails | fix |
|---|---|---|
| a repeating noise texture | the eye finds the period in half a second and reads "texture map" | one seeded mark set per surface (`rngFrom(seed)`), a different seed per material — 31 materials with 24 texture routines in the engine |
| one texture logic for every material | grass, brick and lacquer ending up with the same statistical character | each material has its own routine (`procedural-materials.md`): blades are filled tapered ribbons, the roof is slate courses, the lacquer is a specular gradient |
| uniform mark spacing | regularity reads as a pattern | drive position from a hash and size from a power curve (`Math.pow(rnd(), 1.5)` for blade height, `Math.pow(rnd(), 0.6)` for dab radius) |
| detail authored in pixels | the mark changes physical size the moment the camera moves | author in metres and convert with `k` = `focalPx / depth` (2.5D section 7) |
| detail that does not scale with distance | the same mark reads as a boulder at 3 m and is invisible at 90 m | the ladder in section 1; the far plane gets silhouette only |
| detail that costs and cannot be seen | a sub-pixel mark is paid for and never drawn | cull under ~2 px (section 6, item 1) |

## 8 · The measurable definition of done

Detail is done when all four hold, each with a command:

1. **The crop test.** At 100 %, a 300×300 crop from each of the three planes shows at least **3 distinct value steps** and at least **2 distinct mark scales**. `node render.mjs --sheet=0.5 --crop=680,900,300,300 --w=300 --out=out/check/near.jpg`, then the same crop at the subject and at the treeline. A crop with one flat value fails even if the frame reads well at 25 %.
2. **The plain-area test.** No fully flat patch wider than 200 px outside deliberate sky: `stats.std` under 2.5 is a P0 `empty frame`, and the whole-frame quiet fraction must sit in 0.30 – 0.55 (`panoramic-composition.md`).
3. **The subject test.** The subject's silhouette is legible in a 40-px-tall thumbnail — a shape, not a smudge.
4. **The sweep.** `node render.mjs --qa --range=<shot start>:<shot end>` raises no P0, no P1, and no P2 `near field too plain` for the shot.

## 9 · What minimal actually means

Empty is a composition decision: a field with one gesture, a sky with a gradient and a bird. It is not a surface with no marks. The test is always the same crop at 1:1 — three value steps and two mark scales — because that is what the audience's eye asks of a photograph, and it is the cheapest thing in this engine to give it.
