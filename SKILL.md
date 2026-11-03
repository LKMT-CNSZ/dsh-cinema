---
name: dsh-cinema
description: Create videos, experimental films and cinematic visuals entirely in code — programmatic video production, 2D and 2.5D scenes, procedural rendering, music videos, storyboarding, shot design, shot edits, animation fixes, rendering and picture QA with Canvas 2D, WebGL and ffmpeg. Ships a deterministic frame renderer, a measurable complexity budget and a P0/P1/P2 sweep. Use for panoramic, minimal, photographic code films, avant-garde shorts and procedural art.
whenToUse: Use when the user asks to make, edit, review or fix a code-generated film, animation, music video, experimental visual, shot list, storyboard or render, or to improve a flat panorama, low-poly scene, stiff motion or continuity. Do not use it for ordinary documents, email or unrelated programming.
user-invocable: true
metadata:
  version: 1.0.0
  license: MIT
  repository: https://github.com/LKMT-CNSZ/dsh-cinema
  display-name: DSH Cinema
  display-name-zh: DSH 电影艺术创作
---

# DSH Cinema — 2.5D documentary art cinema

DSH Cinema is a production system for short films that look photographed rather than rendered: a wide field, one subject,
air you can see, and detail where the eye goes. Code is the camera, the brush and the edit.


The system's promise is narrow on purpose: **a few kinds of scene, very finely done.** Wild field, coast, road, a house at
the edge of a town, a minimal interior, sky and horizon. When a scene outgrows the budget, the shot is split — the drawing
quality of everything else never comes down to fit more objects in.

## What it is for

| direction | what the skill gives you |
|---|---|
| avant-garde / modern-art short | one idea per shot, empty frames that carry meaning, a single surreal element with a job |
| 2D / 2.5D experimental film | painted plates placed at depths in a metric world: 2D detail with real parallax |
| procedural music video | the timeline, the mix and the edit are code; sound is synthesised, not licensed |
| documentary-photographic image | one sun, true colour, a horizon that is measured rather than eyeballed |
| minimal visual art | large negative space with detail concentrated where the eye is |
| surrealist short | restraint by rule: nothing floats that has no narrative work to do |
| conceptual-art video | the film states a proposition and refuses the rest |
| moving visual installation | long takes, slow clocks, no beat to cut to |

The default route is **2.5D** — 2D artwork placed at depths in a metric world — not a full 3D scene. The earlier 3D route
still ships in the same project and still renders (`--film=piano`); it is no longer the default.

## Invoking it

- **Automatically**: the description above is the routing contract. When a task is about making, editing, reviewing or
  fixing a code-generated film, animation, music video, visual study, shot list or render, load this skill before planning.
- **Manually**: type `/dsh-cinema` in the DSH composer, or pick *dsh-cinema* from the `/` menu. DSH sends the literal token
  and the host loads the skill for the turn.
- It is deliberately **not** for ordinary documents, email, spreadsheets or unrelated programming.

```bash
# after the skill is loaded, a project starts like this
node scripts/new_project.mjs my-film      # from the skill root: scaffold a runnable project
cd my-film && npm install
node render.mjs --stills=2.0 --film=wind  # look at a frame before rendering the film
```


## The four tiers, in priority order

| tier | what it is for | code |
|---|---|---|
| 1. Canvas 2D paint | the default for everything: silhouettes, buildings, vegetation, props, textures, light and shadow | `engine/materials.js`, `engine/renderer.js` |
| 2. 2.5D plates | the main spatial tool: foreground / mid / background planes, parallax, dolly, occlusion | `engine/layers.js`, `world/panorama.js` |
| 3. local 3D | only where 2D cannot go: a piano seen from any angle, the silhouette figure with IK feet, cast shadows, the ground plane | `engine/props.js`, `engine/character.js`, `engine/renderer.js` |
| 4. WebGL / Three.js | only when a shot truly needs the GPU (water, rain, volumetric fog, reflections). Available, not used by the reference film — and the reason is written down in `references/2.5d-scene-system.md` | not shipped |

Do not add a tier to look technical. Every shot picks the simplest tier that gives the highest image.

## The eight steps

1. **Bible** — `templates/CREATIVE_BIBLE.md`: the place, the weather, the time of day, what the film is about, and what it is
   not. One paragraph that could be a photograph's caption.
2. **Budget** — `references/scene-complexity-budget.md`: before any code, estimate the eight budget quantities, declare them
   in each shot's `budget` (the top-level field of `shot()`, a sibling of `meta`), and decide whether the scene must be split. A budget that is never met is not a budget.
3. **Storyboard and shot list** — `templates/STORYBOARD.md`, `templates/SHOT_LIST.md`. Every shot states its read (what the
   audience learns), its camera, its lens, its transition, and its **layer plan** (which plates, at what depth, in what band).
4. **Look development** — one still per shot, at full resolution, in `out/check/`. Open it. The panorama's ten properties
   (`references/panoramic-composition.md`) are checked here, not after the film is encoded.
5. **Shot** — one file per shot in `src/shots/`. A shot is `start, dur, cam, light, sky, draw, meta, budget`. Nothing in a
   shot may depend on the previous frame (see `engine/main.js`), so any frame can be rendered alone, in any order.
6. **Detail** — spend it where the eye is: the subject and the foreground plane. `references/detail-density.md` gives the
   measured targets (945 plate marks in the wide shot, 560 grass blades at the lens, 66 limbs and 63 leaf clusters in the tree).
7. **Review** — the nine checks and six artefacts per shot in `references/visual-quality-control.md`: contact sheet, 1:1
   crops, motion strips, first/middle/last frames. Reading the code does not count as looking.
8. **QA and deliver** — `node render.mjs --qa` (P0/P1/P2, budget, parallax, horizon match, detail bands), then
   `--frames`, `--encode`, and the audio pass in `references/sound-design.md`.

## Rules that are not negotiable

1. **Minimal is not empty.** A frame may be 60 % sky, but the 40 % that is not sky must survive a 1:1 crop.
2. **No low-poly, no cheap CGI.** A house is drawn as a house: roof courses, sills, glazing bars, one broken pane, an eave
   shadow, streaks under the eaves. Boxes are not buildings.
3. **One light.** A single sun direction for the whole film, plus sky bounce. The sun is a constant; cloud shadow may dim it
   by fractions of a stop over tens of seconds.
4. **One wind.** Every moving thing reads the same wind field (`AMBIENT.at`) but **no two things share a period**; the grass
   moves at 1.3 s, a branch answers at 1.9 s with a 0.73 s tremor, clouds cross on 57 s.
5. **Plates are authored in metres.** One plate metre is `focalPx / depth` pixels, so a mark keeps its physical size at any
   camera distance. Nothing is authored in screen pixels except inside `plateDetail`.
6. **The budget decides the shot.** Over budget is not "make it rougher": split the shot, or simplify the expression (fewer
   objects, better ones).
7. **Figures are silhouettes.** A-level performance only: far, back, side, still. B-level: walk, sit, stand, turn, reach.
   C-level (faces, fingers, multi-person interaction) is not a production capability and must not be promised.
8. **Sound is a layer of the image.** Wind in three bands, one distant bird, one wooden creak, and the piano's own strings
   excited by the wind. No trailers, no whoosh, no music beat.

## Engine map

| file | what it owns |
|---|---|
| `engine/layers.js` | plates: `definePlate`, `plateBegin/End`, `plateFill/Line/Detail`, `plateRect/Ellipse/Ridge`, `plateScreen`, `PLATE_LAYERS` |
| `engine/ambient.js` | the wind field, branch and grass sway, cloud drift and density, light drift, dust motes, the one bird |
| `engine/budget.js` | `BUDGET.begin/count/finish`, overrun levels, `mover()` |
| `engine/sky.js` | sky gradient, painted cloud forms, horizon haze, sun |
| `engine/materials.js` | 31 materials, each with its own texture logic (grass, bark, plaster, slate, glass, brick, cloth, wax, wheat...) |
| `engine/renderer.js` | depth-sorted op queue, ground, cast shadows, polygons, tubes, billboards, four-band DOF |
| `engine/character.js` | 11-joint silhouette skeleton, IK, hand contact, coat, no face |
| `engine/props.js` | the piano (local 3D), props |
| `engine/camera.js` | pinhole camera, focal from mm, near clipping, projection |
| `engine/qa.js` + `scripts/qa.mjs` | P0/P1/P2 sweep: blank frames, NaN, camera jumps, sun drift, held frames, repeat signatures, budget, parallax, horizon match, detail bands |
| `scripts/scan.mjs`, `scripts/opscan.mjs` | find a frame — or an exact draw command — that hangs, without rendering the whole film |

## The reference film

《风经过钢琴》 / *Wind Past the Piano* — 12.000 s, 1920×1080, 24 fps, two shots, one match cut on the horizon.
W1 (0.00–7.40 s): panorama, 32 mm, slow dolly left and in; four plates (treeline 88 m, house 26 m, tree 14.5 m, foreground
grass 3 m) plus the local-3D piano and the figure. W2 (7.40–12.00 s): locked off, 40 mm, same horizon, the piano close.
Measured: 946 / 718 plate marks per frame, 18 materials, 4 movers, 0.45-0.75 s per frame (four workers), QA P0 = P1 = P2 = 0.
Source: `examples/wind-past-the-piano/`. The earlier 3D film (*The Piano in the Field*) remains in
`examples/piano-in-the-field/` and still renders with `--film=piano`, as the regression case.

## Commands

```bash
node ../../scripts/new_project.mjs my-film      # scaffold a project (strips the demo unless --keep-demo)
node render.mjs --stills=2.0,6.4 --film=wind    # look before rendering 288 frames
node render.mjs --sheet=0.8,2,3.4 --cols=3 --film=wind   # contact sheet
node render.mjs --frames --workers=4 --film=wind
node render.mjs --qa --out=out/qa --film=wind   # P0 must be 0 and P1 must be 0
node render.mjs --encode --audio=assets/score.m4a --out=out/film.mp4 --film=wind
node ../../scripts/preflight.mjs                # toolchain, required files, frontmatter, shot tiling
node scripts/scan.mjs 9.0,10.0 --film=wind      # does any time hang? (it happened once: see visual-quality-control)
```

## Honest limits

- Figures have no faces, no fingers below ~34 px of palm width, and no C-level performance.
- Depth of field is four blurred bands, not a lens model; bokeh is approximated, not simulated.
- The painter's algorithm cannot resolve interpenetrating geometry: a plate never passes through a 3D object.
- 2.5D plates are billboards: a plate meant to be seen at an angle must be authored with its own `tilt`/`yaw`, or built as
  local 3D.
- Aerial perspective is a mix toward one haze colour, so a very long lens at a very long distance is a tint, not physics.
- The reference film's horizon has a visible tonal seam where the 3D ground's haze band meets the treeline plate. The
  automated sweep does not catch it (it is a compositional defect, not a numeric one); it is listed in
  references/visual-quality-control.md and in the example's QA_REPORT.md as an open defect, not hidden.
- The WebGL and Three.js tiers are documented but not exercised by the reference film; do not claim their output as tested.

