# Procedural materials

A material is not a colour. It is a **base albedo**, a **roughness/specular response**, and a **texture routine** that
draws inside the projected polygon with feature sizes derived from how many pixels a metre occupies at that depth. That
last part is what separates a painted surface from a tiled sprite: a blade of grass 1 m from the lens is 20 px, at 20 m
it is 1 px, and the routine must know it.

All materials live in `src/engine/materials.js` (`MAT` + `TEX`). Every surface the engine draws passes through
`paintSurface()`, which clips to the projected polygon before any mark is made. A texture mark that escapes its surface is
the single fastest way for a procedural frame to look painted rather than photographed.

## The list

| id | albedo family | rough / spec | what it must do |
|---|---|---|---|
| `soil` | dark brown | 0.95 / 0.02 | clods, grain, matte |
| `grassGround` | olive | 0.92 / 0.03 | thousands of blades in perspective, dry patches |
| `asphalt` | near-black grey | 0.88 / 0.05 | aggregate speckle, faint sheen |
| `concrete` | warm grey | 0.90 / 0.04 | broad blotches, aggregate, dirt tide-line, occasional crack |
| `concreteDark` | grey | 0.90 / 0.04 | same, darker (plinths, kerbs) |
| `plaster` | pale ochre | 0.88 / 0.03 | mottling, vertical rain streaks |
| `stone` | grey | 0.86 / 0.06 | coursing, joints, chips |
| `brick` | red-brown | 0.90 / 0.03 | brick courses with per-brick variation |
| `roofSlate` | blue-grey | 0.82 / 0.05 | rows of tiles, dark lower edge per course, moss |
| `wood` | mid brown | 0.72 / 0.08 | grain along the long axis, rare knots |
| `woodPale` | light brown | 0.70 / 0.10 | grain, for boxed frames and interiors |
| `bark` | dark brown | 0.94 / 0.02 | vertical fissures, deep shade |
| `metal` | steel | 0.35 / 0.50 | sky-above/ground-below reflection gradient |
| `metalDark` | dark steel | 0.40 / 0.45 | same, for casters and rods |
| `brass` | warm metal | 0.28 / 0.70 | bright top, dark bottom |
| `lacquer` | near-black | 0.16 / 0.85 | a broad sky reflection: this is a grand piano's lid |
| `lacquerSide` | near-black | 0.34 / 0.42 | flat case sides: dark, only a soft falloff, no mirror |
| `ivory` | bone | 0.55 / 0.14 | key strips with gap shadows and a lit front edge |
| `wax` | pale cream | 0.62 / 0.18 | soft vertical falloff, a couple of drips |
| `clothWool` | slate | 0.95 / 0.02 | folds: alternating lit/shaded vertical bands |
| `clothCanvas` | sand | 0.95 / 0.02 | folds, fuzz |
| `skin` | warm mid | 0.70 / 0.08 | one gradient, used only on a lit profile plane |
| `silhouette` | near-black | 0.90 / 0.12 | a rim on the sun side and nothing else |
| `glass` | blue-grey | 0.06 / 1.0 | reflection gradient, frame edge, `alpha 0.42` |
| `glassDark` | dark | 0.08 / 1.0 | the same, near-opaque: windows at dusk |
| `water` | dark teal | 0.05 / 1.0 | horizontal ripple highlights, sky reflection |
| `foliage` | olive | 0.95 / 0.02 | leaf dabs in clumps (used by tree canopies) |
| `windowLit` | dark | 0.40 / 0.30 | emissive warm interior (a practical that reads at distance) |
| `candleFlame` | warm | — | emissive, 3.2× — the only true light source surface |

## The rules a texture routine follows

1. **Draw only inside `s.pts`.** `paintSurface` clips for you; never draw a full-frame rect from a texture routine.
2. **Size in metres, resolve in pixels.** `px(s, 0.02)` converts 2 cm at this surface's depth into pixels with a floor of
   1 px, so far marks neither vanish nor become noise.
3. **Seed from `s.key`.** The key is derived from the surface's material and its quantised world centroid, so marks stay
   put as the camera moves. A texture that crawls every frame reads as noise.
4. **Cap the work.** Marks per surface are clamped (grass ~5200 strokes over the visible ground, aggregate ≤ 160 specks,
   etc.). A close-up must not cost 5 s/frame — the box you sample is clamped to the canvas (`clipBox`) for exactly this
   reason.
5. **Light enters through `s.rgb`.** The base colour is already tone-mapped and lit; textures multiply it by 0.5–1.4, never
   re-light the surface.
6. **One material, one behaviour.** Concrete mottles; it does not have grain. Wood has grain; it does not mottle. Glass
   reflects and does not absorb; cloth folds and does not reflect.
7. **Detail is not uniform.** Marks cluster: moss in joints, dirt at the bottom of a wall, dry patches in a field, fuzz
   only at a cloth's edge.

## Ground: the one surface that must fake perspective

The ground is a single enormous polygon, so its texture cannot be a screen-space carpet. `grassGround` recovers depth per
mark from the horizon line:

```js
const dist = Math.max(1.0, (fpx * camHeight) / (y - horizonY));   // metres from the lens for this screen row
const lenPx = Math.min(26, Math.max(1.2, (fpx * 0.045) / dist));  // a blade 4.5 cm tall, in pixels at that distance
```

and it samples the visible box with a bias towards the bottom of the frame (where the near grass is). This is why the
field can be one quad and still look like grass at 2 m and at 40 m.

## Light response

`surfaceColor(mat, normal, position, depth)` =

```
albedo × (sunColor·NdotL·sunIntensity + hemisphere(normal)·skyIntensity + Σ point lights, inverse-square)
+ specular × sunColor      (Blinn-Phong exponent from roughness, matched to the camera by half-vector)
+ emission                 (only the flame and a lit window)
→ mixed towards haze colour by depth (aerial perspective)
```

Practical consequences:

- A **backlit** shot (sun behind the subject) puts every surface facing the camera in shade: albedo × sky only. That is
  correct and it is why a backlit field has bright air and dark objects. Do not "fix" it by raising ambient; raise the
  story's justification (rim light, a practical, a lighter foreground material).
- **Two-sided normals** are enforced in `poly3`: the normal is flipped towards the lens, so a flat panel is lit by the
  light that reaches the face you can see. This makes winding mistakes invisible.
- **Specular is small.** The engine's specular exists so lacquer mirrors the sky and a key's front edge catches a glint. If
  a surface needs a highlight to read, it is the wrong material.

## Failure catalogue

| symptom | cause | fix |
|---|---|---|
| frame looks "textured all over", like noise | marks outside their polygon, or a full-frame grain in the texture | clip; use `clipBox`; check a crop at 1:1 |
| field looks like a carpet | uniform screen-space strokes | perspective-aware `grassGround` (distance from the horizon) |
| surfaces look plastic | specular too high, roughness too low everywhere | only lacquer/glass/water/metal carry spec |
| everything the same brown | one lighting state with no colour separation | separate sky (cool) from sun (warm); give materials distinct albedo families |
| a wall reads as a flat slab | no marks at the right scale | mottling + streaks sized in metres; add a dirt line at the base |
| close-up costs seconds per frame | an unclamped texture box filled with a `screen` blend | `clipBox`, cap counts |
| wood grain rotates with the camera | grain direction computed in screen space with no anchor | anchor on the polygon's long axis; it is an approximation, keep it |
| a prop's material changes between shots | a different material id passed at a different call site | one registry entry per prop |

## Adding a material

1. Add the material to `MAT` with an albedo (`hexLin`), `rough`, `spec`, and a `tex` name.
2. Add the `TEX` routine: `(ctx, s) => { … }`, using `s.bbox` (clamped), `s.rgb`, `s.key`, `px(s, metres)`.
3. Check it in a model sheet: render the same object at 3 m and at 30 m with `--crop`.
4. Check cost: the QA sweep reports ms/frame; a new material that adds 200 ms across a shot is too heavy for its value.
5. If it needs emission or a practical, add the light in the shot's `light(lt)` and register a point light — never bake a
   glow into the texture.


## 2.5D update — materials as authored texture, not noise

### The rule that replaced the old one

```
Never give every object one repeated noise texture. Each material has its own logic, and the logic is physical:
what is it made of, how does it meet light, how does it wear?
```

### The materials that carry the reference film

| material | what the texture routine actually does |
|---|---|
| grass (ground + blades) | perspective-aware strokes whose length and density fall with distance; blades are tapered filled ribbons with a colour spread from dry olive to straw |
| bark | ~90 vertical strokes with random length and a slight lean, plus a darker side |
| foliage / dry foliage | 40-220 leaf dabs concentrated at the silhouette edge, each a small ellipse at its own angle |
| plaster | mottles, faint vertical streaks, a luminosity variation across the wall, and a darker damp line at the foot |
| roof slate | horizontal courses with per-slate tonal variation and a shadow line under each course |
| brick | courses with an offset per row and mortar joints drawn as gaps, not lines |
| glass | a vertical reflection gradient, an edge highlight, and a dark interior - no transparency effect |
| wood | grain running along the shape's long axis with knots and a worn, lighter edge |
| wax / wheat | new in this build: a soft translucent body for the candle, a pale glume mass for seed heads |
| concrete / stone | micro-roughness dabs, irregular patches, chips at the edges, stains that follow gravity |
| cloth canvas | folds as low-frequency bands with a highlight on one side, never a repeating stripe |
| metal | a narrow specular band and a slightly darker reflection of the sky |

### Scale, not detail level

Every mark is authored in metres and converted with `pxPerM`, so a texture keeps its physical size from 3 m to 88 m. When a
material's marks fall below ~2 px they are culled - that is the only acceptable simplification, and it is a rule of
visibility, not a lower standard.

### Materials in a plate

A plate authors its own light (`shade` and `tone` per shape) because a flat plane has no normal. The material supplies the
texture logic and the albedo; the plate supplies how the face is turned to the sun. Two facing faces must never be given the
same shade - that is what makes a painted building read as a cut-out.
