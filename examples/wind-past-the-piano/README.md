# 《风经过钢琴》 / Wind Past the Piano — the 2.5D reference film

12.000 s · 1920×1080 · 24 fps · two shots · H.264 + AAC · QA P0 = 0, P1 = 0.

This is the reference film of the 2.5D route: a wide field, one piano, one figure who does not act, and air moving through
everything on a set of clocks that never agree. It exists to demonstrate that 2D drawing placed at depths in a metric world
can carry a documentary panorama with more detail per pixel than a 3D scene of the same cost.

## What to look at, in order

1. **The wide (0.00-7.40 s).** Four plates at 88 / 26 / 14.5 / ~3 m plus the local-3D piano and figure. The camera dollies
   0.5 m left and 0.7 m in over the whole shot; watch the treeline barely move while the foreground grass sweeps.
2. **The figure.** Back three-quarters, no face, coat moving by millimetres. She never acts; that is the performance.
3. **The match cut (7.40 s).** The horizon is identical (within ~2 px); only the framing changes (32 mm → 40 mm, 7.4 m → 4.2 m).
4. **The near plane (W2).** Grass at 2.4 m from the lens crosses the bottom of the frame, so the piano sits *behind* something.
5. **The sound.** Wind in three bands, a bird at 3.62 s, the piano's own strings swelling with the gust at ~5 s (nobody
   plays them), one wooden creak at 6.20 s, then the fade.

## Files

| file | what it is |
|---|---|
| `CREATIVE_BIBLE.md` | the place, the weather, the decisions, what the film refuses |
| `STORYBOARD.md` | the two frames, the depth chart, the motion clocks |
| `SHOT_LIST.md` | both shots with their budgets, planes, reads and measured cost |
| `QA_REPORT.md` | the generated sweep report (P0/P1/P2, budget, parallax, horizon, detail bands, audio) |
| `stills/` | contact sheet, key frames, 1:1 crops, motion strips |

## Reproduce it

```bash
cd template
node render.mjs --stills=2.0 --film=wind
node render.mjs --frames --workers=4 --film=wind
node render.mjs --qa --out=out/qa --film=wind
node render.mjs --encode --audio=assets/score.m4a --out=out/film-wind.mp4 --film=wind
```

## Regression value

The earlier 3D film (*The Piano in the Field*) is still in the same project and still renders with `--film=piano`, which is
what makes this project a regression test for the engine: two films, one codebase, both must render and both must pass QA.
The defects the first film was built to catch - character clipping, proportion drift, duplicated props, repeated shots,
discontinuous scenery, a missing opening/closing echo - remain covered by the same probes.
