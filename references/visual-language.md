# Visual language

This file fixes what one frame of a dsh-cinema film may look like — one lighting rig, a film-stock palette, materials that behave like different substances, a 3:2 photograph composed inside a 16:9 frame — and bans the looks that make a painted frame read as decoration, with the reason each one is banned.

## 1. Light first

- A frame names **one** lighting state. `main.js` runs `lightReset()` then `def.light(lt)`; after that every surface asks the same rig (`shadeSurface`, `surfaceColor`) for irradiance. If a surface is bright, a named light made it bright. There is no highlight that exists without a source.
- Pick a preset — `LIGHT_PRESETS.overcast` / `lategold` / `dusk` — and then move **intensity only**. The reference film is `lategold` in all five shots and varies `LIGHT.sun.intensity` between 1.80 and 2.02; no shot touches `LIGHT.sun.dir`.
- Copy this shape, which is S2's whole lighting state:

```js
light(lt) {
  lightUse('lategold');
  LIGHT.sun.intensity = 2.02;
  lightPoint([-0.62, 0.215, 1.55], hexLin('#ffb066'), 0.95, 0.75);
},
```

- State the sun as numbers in the bible and then never choose it again: the reference's is `vnorm([-0.70, 0.235, 0.67])` — elevation 13.6°, azimuth 46° west of north, low and behind the subject, so the camera looks into backlight and the woman is a silhouette.
- Shadows are a result, not an object. `castShadow` shifts a footprint by `height / max(0.18, tan(elevation))`; at 13.6° that is **4.1 × the object's height**: the piano's 0.95 m case throws a 3.9 m shadow, the house's 4.5 m walls an 18.5 m one, all in the same direction on the same ground. A hand-placed shadow with another angle is the single most visible lie in a painted frame.
- One rig is also one contrast and one exposure: `LIGHT.contrast` 0.10 overcast / 0.24 lategold / 0.18 dusk, `LIGHT.exposure` 1.00 / 0.80 / 1.15. Do not fix a dark shot by raising exposure mid-shot — the QA sweep calls a >0.35 exposure change at a cut a P1.

## 2. Sky and bounce are two different lights

- `LIGHT.sky` is a hemisphere: `up` from above, `bounce` from the ground, `horizon` for the band between. In `lategold`, `up` is `[0.16, 0.26, 0.48]` (cool, blue) and `bounce` is `[0.20, 0.17, 0.13]` (warm, nearly dark), at intensity 0.34 against a sun of 2.95 — an **8.7 : 1** ratio.
- Consequences to obey: the shaded side of anything is *cooler* than its lit side and 5–10× darker; it is never neutral grey and never black. The `silhouette` material carries one soft lit edge on the sun side and nothing on the other.
- A frame with 0.9 of its pixels near black and a mean luma under 20 is raised as a P1 "black hole", not accepted as a mood. Fill shadow with the sky, not with black: `shadowTint` mixes `sky.up` at 0.05 with `bounce` at 0.06 for exactly this reason.
- If the sky is in frame, the sun disc, its halo and the cloud plate all agree with the same `LIGHT.sun.dir` (`sky.js` projects the sun at 400 m). A tilt that moves the horizon must move the sun with it.

## 3. Practicals, if any

- `lightPoint(pos, color, intensity, radius)` adds a point with a softened inverse-square falloff `1 / (1 + (d / radius)²)`. Radius is in metres: **0.45–0.75 m** for a candle, 1.5–3 m for a window.
- A practical must be visible in the frame as the thing that emits. The candle is a real prop with `candleFlame` (`emitStrength` 3.2), and the five shots drive the same point light from 0.34 to 2.6 in intensity because the camera moves from 8.0 m to 1.6 m away. Keep the jump small at the cut or the candle pops.
- Numbers from the reference: S1 0.55 / r 0.5, S2 0.95 / r 0.75, S3 2.6 / r 0.62, S4 0.34 / r 0.45, S5 0.32 / r 0.45.
- Forbidden: a point light with no visible source (it makes a glow with no object); more than two practicals in a 12 s film; a practical strong enough to out-key the sun (keep its contribution under ~35% of the sun's on the surface it lights).

## 4. Natural colour, not a grade

- The palette is film stock, held in `MAT` albedos: soil `#5b4d3c`, grass `#5f6440`, plaster `#a49a89`, ivory `#f2ead4`, lacquer `#1c1a1a`. The warm key / cool shade split comes from `lategold`'s sun `[1.0, 0.72, 0.45]` against its sky `[0.16, 0.26, 0.48]` — physics, not a LUT.
- No clipped whites: 0.985 of a frame near white is a P0 "blown frame". Nothing in `MAT` has albedo 1.0, and the darkest preset (`lategold`) sits at exposure 0.80. If a highlight must read, use halation (≤0.22) — never a +1 exposure.
- Black is a colour. The figure is a backlit silhouette at `#2a2b30`, not absent: it has a lit edge, a coat value and a value separation from the ground behind it.
- No global teal-and-orange: a wash is optional, `soft-light`, alpha ≤ 0.12, colour `#8fa0b8`, and the reference film passes no `post` options at all. Review test: at least a quarter of the frame should sit within 15% of neutral in value, and no complementary cast may cover the whole image.
- Warm low sun + cool shade is the rule; warm *everything* is the failure mode. If the shaded side of the piano is warmer than the lit side, the rig is wrong, not the grade.

## 5. Minimalism: the removal list

The reference film contains ten seen things: ground, treeline, house, tree, stones, tufts, candle, piano, woman, bird. Everything else was cut.

- Remove: any prop that exists in one shot only unless it *is* that shot's event; any texture used on the same scale on more than three surfaces; any second light source; any sky object (birds excepted — one); any text, HUD, logo or lettering; any foreground element that crosses the subject's body.
- Every wide must keep at least **0.25 of the frame quiet** — sky, air, or empty grass with nothing drawn in it. In S1 the sky above the horizon is 0.426 of the frame and holds only the treeline.
- Depth comes from layering, not detail: foreground tufts (54 tufts on an 11 × 9 m patch at x 0.4, z 1.2) cross the bottom edge and occlude boots; the subject stands at 8 m; the house is at 26 m, the tree at 14.5 m, the treeline at 52–98 m. A wide needs all three layers or it reads as a billboard.

## 6. Material truth

A material is not a colour. Each `MAT` entry carries albedo, roughness, specular strength and a texture routine that draws in screen space, clipped to the projected polygon with feature sizes in metres. The specular exponent is `8 + 120 × (1 − rough)`: lacquer 109, metal 86, wool 14. A visible highlight on wool is already a bug.

| group | ids | what each must do |
|---|---|---|
| ground | `soil` `grassGround` `asphalt` `concrete` `concreteDark` `plaster` `stone` `brick` `roofSlate` | soil: damp ellipses, no blades. grassGround: 700–5200 blade strokes, distance from the horizon geometry `(focalPx · camH) / (y − horizonY)`, blades sized for a real 3.5–8.5 cm tuft, 2–5 blades per tuft plus dry patches. asphalt: aggregate specks, no cracks. concrete: broad blotches, a tide mark rising from the bottom edge, one crack every third surface. concreteDark: same routine, shadow value. plaster: blotches plus rain streaks from the top edge. stone: coursing rows with joints and a dark base line. brick: running bond, 0.22 × 0.085 m modules. roofSlate: courses, dark lower edge, moss in the joints. |
| wood and metal | `wood` `woodPale` `bark` `metal` `metalDark` `brass` | wood: grain along the long screen axis, 26 strokes, a knot on one surface in five. woodPale: same routine, lighter (the piano's soundboard). bark: vertical fissures, 70 max. metal: sky above / ground below gradient, never rust. metalDark: casters, prop stick, hardware. brass: vertical banded polish (pedals only). |
| lacquer, keys, wax | `lacquer` `lacquerSide` `ivory` `wax` | lacquer: near-black that mirrors the sky in one broad band — only the lid's top surface. lacquerSide: flat sides, soft vertical falloff, **no reflected sky**. ivory: key strips, dark gaps at 0.0016 m, bright front edge. wax: soft translucency, three drips, never specular-hot. |
| soft | `clothWool` `clothCanvas` `skin` `silhouette` | clothWool: coat folds every 0.09 m plus hem grime. clothCanvas: same routine, coarser folds. skin: one vertical gradient; no pore noise at this scale. silhouette: one soft lit edge, never an outline on both sides. |
| transmissive | `glass` `glassDark` `water` | glass (alpha 0.42) keeps only what it reflects, shows nothing through it. glassDark (alpha 0.72): window panes, near-black, one bright frame line. water (alpha 0.9): horizontal sky strokes only. |
| foliage and emit | `foliage` `foliageDry` `windowLit` `candleFlame` | foliage: ≤220 dabs, heavier at the silhouette edge. foliageDry: same routine, dry value. windowLit: emissive window, reads as a light source, never as texture. candleFlame: the flame only, `emitStrength` 3.2. |

- One texture logic per material. Wood grain on plaster, concrete mottling on cloth, or the same noise on all nine ground surfaces is the tell that the frame was texture-swapped rather than photographed.
- Texture marks must not crawl: every routine seeds from a stable per-surface `key`, so camera movement changes perspective, not the pattern.

## 7. Composition

- Default frame: **1920 × 1080, 24 fps, 16:9** (`PROJECT`). Do not default to 2.39:1 — a scope frame buys width this world does not have, and the field is already empty.
- Compose inside a **3:2 block of 1620 × 1080** — the photographic mass lives there, anchored left or right, leaving one 300 px margin (0.156 W) of air on the other side. `config.js` says it: "A 3:2 photographic frame is a composition reference, not a crop."
- Horizon placement is a number per shot, never 0.5 by accident:

| shot | horizon (fraction of `H`) | why |
|---|---|---|
| S1 | 0.426 | the sky is the negative space |
| S2 | 0.26 | looking slightly down over her shoulder |
| S3 | 0.118 | at 0.505 m the horizon is nearly out of frame |
| S4 | 0.436 → 0.760 | the tilt drops the horizon as the bird climbs |
| S5 | 0.421 | the opening rhyme, within 1% |

- Subject size follows one formula: `px = focalPx × height / depth`, with `focalPx = focal × 53.33` at 1920. In S1 the 1.64 m figure at 8.3 m on a 35 mm lens is 371 px — **0.344 of frame height**. Rules: establishing wide 0.20–0.40, medium 0.45–0.75, close-up/detail 0.85–1.00 or deliberately cropped.
- Never let the horizon pass through a head. In S1 it clears her crown by 14 px (460 px vs 474 px), so she stands clear against the sky instead of being cut by the line.
- Keep the painter's-algorithm limit in the framing: surfaces are convex and depth-sorted, so a foreground tuft must not intersect a piano leg. Clearance of at least 5 cm, or the intersection resolves the wrong way for one frame.

## 8. Grain, vignette, halation

- A shot that passes no `post` gets: grain 0.055 (alpha 0.33, overlay, re-offset every frame), vignette 0.30 (corner multiply), **no halation, no wash**. That is what the reference film uses in all five shots.
- Ranges: grain 0.04–0.07; vignette 0.25–0.34; halation only when the sun is in frame, ≤0.6 (0.13 alpha, 9 px at quarter resolution); wash ≤0.12.
- Grain must move every frame (`frameNo` offset) and must never be used as texture. It is the one random thing that is allowed to differ between two otherwise identical frames.
- Post must be invisible unless you remove it. If a shot only looks good with a heavier vignette, the shot is wrong.

## 9. Forbidden, with reasons

1. **Watercolour / cartoon surfaces.** A brush edge is a flat field, not a surface. Geometry plus light only; if a surface needs a blob to read, model it or drop it.
2. **Neon / tech look, emissive rims, cyan edge lights.** They put light where no named source exists, and the rig stops meaning anything.
3. **HUD, overlays, on-screen text, ticks, frames.** Nothing in the film knows it is being filmed.
4. **Particle soup.** More than ~26 motes per frame is weather, not air. The reference uses 26 only in the close-up, only inside the light shaft.
5. **RGB split / chromatic aberration.** A lens does not do this on its own; it is a 2010s tell and it contradicts "one camera".
6. **Lens-flare abuse.** `sky.js` draws one atmospheric halo and the disc — no streaks, no iris ghosts. A second flare means a different film.
7. **Repeated slow motion.** The film runs at 24 fps and real speed; one slow-motion beat needs to be declared in the shot list, and is usually a sign the event is not staged.
8. **Pointless camera rotation.** `roll` defaults to 0; more than 2° needs a reason written in `meta.motion`.
9. **Everything moving in sync.** Wind is one field read by every tuft, coat and hair (`windAt`), but their peaks must not coincide: stagger the secondary motion by ≥0.2 s.
10. **Over-saturated teal-and-orange.** See §4. It is a grade pretending to be daylight.
11. Also banned: bloom, depth-of-field added in post, film-burn transitions, speed ramps, shake as emotion, artificial bokeh shapes, and any effect whose parameters only exist in post.

## 10. Restrained surrealism

A physically impossible thing may appear **once**, and only if the story needs it.

- It must be built from the same materials, lit by the same rig, cast a shadow like everything else. It is impossible because of what it is, not because it glows.
- It gets one shot, not a montage, and nobody in the film remarks on it. The reference film's impossible thing is a grand piano standing in a field; it is never explained.
- No second impossible thing, and no impossible motion: nothing floats, nothing reverses gravity, no object changes size between shots. Surrealism here is an object out of place — not a world with different physics.


## 2.5D update — the art direction this system now serves

The target is **2.5D documentary art cinema**: modern art, minimalism, documentary photography, experimental film,
restrained surrealism, natural light, true colour, large emptiness, and space that carries feeling. What is borrowed from
that tradition is a *language* — the long lens on a field, an empty frame that is not lazy, a single figure who does not act.
No director's shot is reproduced.

### What is refused outright

| refused | why it is refused | what is done instead |
|---|---|---|
| low-poly game look | the moment a surface has no authored detail, the frame reads as software | every visible surface is painted: roof courses, sills, bark strokes, blade taper |
| cheap CGI | glossy specular + lens flares + bloom sell a render, not a place | one sun, sky bounce, no flares anywhere in the engine |
| over-saturation / teal-orange | a grade is not a subject | a filmic curve and a light rig with a fixed sun colour per preset |
| neon / technology aesthetic | the system has no story that needs it | nothing emits light except a candle, and even that is a point light |
| glow particles | multiplication of noise is not atmosphere | dust motes at 0.22 alpha, 14 of them, only where the light is |
| meaningless camera motion | movement without a reason is a tell | every move is declared in the shot's `meta.motion` with its purpose |
| over-sharpening / over-blur | both are hiding a lack of detail | detail is authored; DOF is four bands and declared as an approximation |
| mechanical interpolation | linear interpolation of a human is the clearest sign of a machine | cubic Hermite and springs, with anticipation and settle |

### Minimal is not empty

The rule that governs every frame: **a frame may be 60 % sky, but the other 40 % must survive a 1:1 crop.** Emptiness is a
compositional decision with a subject and a reason (a figure's isolation, the scale of the land, the wait before an event);
emptiness that comes from having nothing to draw is a defect, not a style.

### The one surreal element rule

Restrained surrealism is allowed only when it carries meaning — a piano in a field is surreal, and it earns its place because
the film is about a sound that outlives the player. A floating object with no narrative job is removed in the storyboard, not
explained in a comment.
