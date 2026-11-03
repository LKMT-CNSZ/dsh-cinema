# Continuity

Continuity in this engine is not memory: it is one registry, one layout, one clock and one sun, plus a five-minute checklist that proves they held on the frames you actually rendered.

## 1. The registries

Every repeated thing — a character, a prop, an environment, a camera — is defined once and referenced by id. Materials and light live in the same system: `REGISTRY.material` is `MAT`, `REGISTRY.light` is `LIGHT_PRESETS`.

```js
const PIANO_PLACE = () => placeProp('piano', { x: FIELD.piano.x, z: FIELD.piano.z, yaw: FIELD.piano.yaw });
defineThing('prop', 'piano', {
  kind: 'grand piano',
  build: (place, o) => buildPiano(place, o),
  keyPoint: (u) => pianoKeyPoint(PIANO_PLACE(), u),
  caseHeight: 0.94,
  lidAngle: 34,
});
```

- `defineThing(kind, id, def)` throws if the id already exists, so "two different pianos" is impossible at definition time. `getThing(kind, id)` throws if it is missing, so a shot cannot silently draw a house it invented.
- The defineThing kinds are `character`, `prop`, `environment` and `camera`; materials and light are pre-filled from `MAT` and `LIGHT_PRESETS`. Boot order in `world.js` is environment → characters → props → cameras, and a missing required id throws at boot, before any pixel.
- The one thing the registry cannot prevent is a scene calling the same builder twice, so a QA probe counts per-frame draw tags: `piano`, `house`, `tree`, `woman`, `bird`, `treeline` must each be 1, and 2 is a P0.
- Rule: a shot file may call `getThing`, a `draw*` helper, or a registered pose function. It may not build geometry, define a material, or write a world position as a literal.

## 2. One FIELD layout, yaw in degrees

The whole film is one coordinate system: metres, `+Y` up, ground at `y = 0`, `+X` east, `+Z` north, yaw in degrees about `+Y` (0 = facing `+Z`). `FIELD` in `src/world/environment.js` is the only place a position is written.

| what | FIELD entry | why it matters |
|---|---|---|
| piano | `{ x: 0.30, z: 0.40, yaw: -12 }` | the subject of every shot; the yaw moves the lid and the key point together |
| her path | `from [-3.02, 2.40]` to `[0.02, 1.78]`, `start 0.10`, `stop 2.30`, `turnStart 2.22`, `turnEnd 2.78` | the walk, its duration and the turn are one record |
| bird perch | `[0.851, 1.778, 0.211]` | 1.778 m up, on the lid's outer edge |
| house / tree | `(-11.5, 26.0) yaw 8` / `(6.6, 14.5) yaw 4` | the two background silhouettes; 26 m and 14.5 m away |
| stones / tufts / candle | `(3.15, 2.35)` `(-5.4, 13.2)`; `(0.4, 1.2)`; `(-0.62, 1.55)` | the foreground occlusion patch and the one practical |

- Placement goes through `placeProp(id, { x, z, y, yaw, scale })` and `localToWorld(place, p)`, the only place degrees become radians. A prop's local origin is on the ground, so "on the ground" is `y = 0` for every prop.
- Consequence to respect: the piano's lid hinge is at local x −0.72 and its key point at local `[-0.62 + u × 1.23, 0.746, 1.09]`. Rotate the prop and both move together; that is why the hand target and the drawn key can never disagree. A shot that writes the key point in world space instead of `getThing('prop','piano').keyPoint(u)` breaks the contact.
- Do not hand-write a facing the code derives: `FIELD.walk.yawWalk: 98` is overwritten at boot with `atan2(dx, dz)`, which evaluates to 101.5°, and the derived value is what the gait uses.

## 3. One performance, one clock

`womanPose(t)` takes **film** time, not shot-local time. Every shot calls `drawWoman(t)` with the global `t`, so at every cut her body, hand and head are exactly where the previous shot left them.

| film time | what she does |
|---|---|
| 0.10–2.30 | walks 3.10 m in three 1.03 m strides from (−3.02, 2.40) to (0.02, 1.78), arms opposite her legs, coat trailing |
| 2.30–2.78 | stops and turns: hips first, chest a beat later, head last |
| 3.02–3.92 | left hand finds the key bed's front edge and rests there for the rest of the film |
| 3.55 / 3.70–4.22 | right hand pulls back 3 cm, then reaches along an arc (not a straight line) to one key |
| 4.22–4.62 | contact: the key goes 6 mm down and stays down |
| 4.62–5.30 | withdraws with a spring overshoot; the note keeps going |
| 8.60–10.40 | follows the bird with her head; her shoulders arrive 0.1–0.6 s late |
| 10.40–12.00 | settles back towards the keys |

- Rule: no shot may pass `lt` into `womanPose`. If a performance needs to differ, add a time window to the one function — never a second pose function.
- The pose is corrected onto the key once per frame (`womanPoseOnKey`): the fingertip is driven to within 4 mm and the skeleton re-solved, because IK alone lands near a target, not on it.
- QA asserts it rather than trusting it: `woman.key-contact` (fingertip < 30 mm of the key between 4.23 and 4.61 s, P0), `woman.feet-on-ground` (lowest ankle between 0.05 and 0.11 m, P0), and any bone length drifting more than 2% from `PROPORTIONS` is a P0.

## 4. The bird's one event

- `BIRD_EVENT = { takeoff: 9.18, outOfFrame: 10.45 }`; `birdPosAt(t)` is a cubic Bézier from the perch through `[0.62, 2.25, -0.28]` and `[-1.9, 4.6, -2.2]` to `[-8.6, 6.4, -3.2]`; `birdStateAt(t)` returns perched (with a crouch from 8.76 s, blended so nothing pops) or `birdTakeoff` at 4.6 Hz.
- Every shot draws the bird through `birdStateAt(t)`: S1–S3 perched, S4 the flight, S5 nothing at all. S5's omission is a continuity claim, so the shot file says it out loud: "no bird: it left in S4".
- Rule: one event per creature per film. Do not add a second bird "for the wide", and do not re-time the takeoff in one shot — the event has a single clock.

## 5. The sun direction is a constant

- `WORLD.sunDir = vnorm([-0.70, 0.235, 0.67])` is written into all three presets at boot, so a shot that names a different preset still cannot change the sun. Elevation 13.6°, azimuth 46.3° west of north.
- A cut may change `LIGHT.sun.intensity` — the reference moves it by at most 0.16 from one shot to the next — but never `LIGHT.sun.dir`. The QA sweep compares the sun vector across every cut: more than **0.035°** is a P1, and so is an exposure change above **0.35**.
- Shadows are derived, not drawn: `castShadow` reads the constant, so there is nothing to keep in sync by hand. The only way to break it is to draw a ground shadow polygon yourself, which is why checklist item 5 exists.

## 6. Geometry cached at boot

- `tree.branches` is generated once, at define time: `treeBranches(7, { levels: 3, trunkH: 2.35, trunkR: 0.20, lean: 0.05 })`, then passed into every build. A tree generated per frame would breathe, and its silhouette would differ between S1 and S5.
- The piano's construction constants are part of the prop, not the shot: `lidAngle: 34`, case from 0.60 to 0.94 m, three legs at local `[-0.58, 0.60]`, `[0.55, 0.52]`, `[0.0, -0.72]`. No shot knows legs exist, so no shot can omit one.
- Anything that looks random — branches, stones, tufts, texture marks — must be seeded from a stable key, never from time. Textures seed from the surface `key`; the treeline seeds from `1200 + rank × 977 + i`.
- Limit: cached geometry still runs through the painter's algorithm, so caching fixes *identity*, not *intersection*. Keep a foreground prop at least 5 cm clear of the piano.

## 7. Cuts

| cut | what it is | in the reference |
|---|---|---|
| hard cut | the default; a new setup on the next frame | S2 → S3 at 6.10 |
| cut on action | cut while something is still moving, so the new shot starts moving | S3 → S4 at 8.90, 0.14 s into the crouch |
| camera carry-through | the camera follows the subject instead of cutting to it | S4's 10.7° tilt with the bird |
| match cut | two frames with the same mass position, focal and horizon | S1 → S5 |
| fade | only at the ends of the film | `fadeIn: 0.55` on S1, `fadeOut: 0.45` on S5, both `#07080c` |

- `finishTimeline()` validates the edit: shots contiguous, no gap and no overlap, last shot ending exactly at `PROJECT.duration` (12.0). Any mismatch is a P0 before a single frame is reviewed.
- `mix` (a cross-dissolve at the head of a shot) is implemented and unused here. A dissolve in the middle of a short documentary reads as an advert; use it only if the film is about memory.
- Every cut carries exactly one of the five above. A cut that is none of them is a mistake, not a style.

## 8. The opening and closing rhyme

- S1: `pos [-1.62, 1.38, -6.35]`, `target [0.32, 1.06, 0.85]`, focal 35, focus 7.2, aperture 5.6, horizon 0.426.
- S5: `pos [-1.86, 1.41, -6.20]`, `target [0.50, 1.07, 0.88]`, focal 35, focus 7.1, aperture 5.6, horizon 0.421.
- The cameras are 0.28 m apart; the horizon differs by 0.5%; the light falls instead of rising (S1 ramps `LIGHT.sun.intensity` 1.92 → 2.02, S5 1.90 → 1.80); the bird is gone; the candle is still lit. That is the whole difference, and it is enough.
- Rule: a rhyme differs in exactly what the story changed and stays within 0.5 m, 1° and 1% horizon. More difference is a new place; less is a repeated frame, and the QA sweep reports two shots whose statistics are nearly identical (`repeatSigDiff`).

## 9. The five-minute continuity checklist

Run this before rendering the film, and again on the last render. All fourteen items are checkable from two stills per shot and one strip across each cut.

1. Positions — compare the piano's screen x in S1 and S5: same side of frame, within 0.05 W.
2. Heights — the figure's lowest ankle is 0.05–0.11 m in every sampled frame; the piano's case top is 0.94 m.
3. Lid angle — 34° in all five shots; the prop stick meets the lid at the same point.
4. Coat — hem 0.46 m above the ground when standing, same silhouette in every shot (`PROPORTIONS` unchanged).
5. Light direction — the piano's shadow and the woman's shadow point the same way; `LIGHT.sun.intensity` changes by less than 0.2 across each cut.
6. Screen direction — she enters frame left, and is never seen entering frame right.
7. Prop presence — candle in 5 shots, bird in 4, house and tree in the wides; nothing appears that `FIELD` does not hold.
8. Pose at cuts — render `t − 0.01` and `t + 0.01` for each cut: the body must move less than one frame's worth, or move because the cut is on action (§7).
9. Key travel — 6 mm down between 4.22 and 4.62, back up by 4.70.
10. Feet — no ankle below −0.005 m (P0), and no foot sliding during stance (`walkPose` locks the planted foot).
11. Bird — exactly one; absent in S5; never drawn twice in S3 or S4.
12. Candle flame — the flame is in frame whenever the point light is used; the light's intensity is within the range of §3 of `visual-language.md`.
13. Frame edges — nothing that belongs in frame is cut by the edge (check the piano's curved tail in S1).
14. Timeline — five shots, contiguous, 12.00 s exactly; `finishTimeline()` returns no issues.

## 10. What this prevents, and the mechanism

| classic defect | what prevents it here |
|---|---|
| the house changes size between shots | one `defineThing('prop', 'house')` with width 8.6, depth 6.4, height 3.5, ridge 2.0; every shot calls `HOUSE_PLACE()` and `build(place)` |
| the bird exists twice | one `birdStateAt(t)`, one `FIELD.birdPerch`, plus the per-frame tag count P0 |
| the piano loses a leg | three legs live inside `buildPiano`; no shot file can address a leg |
| a character changes height | `PROPORTIONS` are constants, IK keeps bone lengths by construction, and >2% drift is a P0 |
| the hand floats 2 cm off the key | `womanPoseOnKey` contact correction to <4 mm, plus the 30 mm QA probe through the contact window |
| the tree's silhouette changes | `tree.branches` is generated once at define time and reused |
| the sun jumps at a cut | `WORLD.sunDir` overwrites every preset, and the sweep fails a >0.035° change |
| the note dies at a different time in two shots | one clock: the picture, the pose and the audio cue all read `WOMAN.releaseAt = 4.62` |
| her hand is in two places after a cut | one `womanPose(t)` in film time; no shot may pose her locally |


## 2.5D update — continuity of a layered space

A 2.5D film has two kinds of continuity, and both are checked across every cut.

### Spatial continuity

| what | rule | reference film |
|---|---|---|
| depth planes | the same plate keeps the same anchor and band in every shot it appears in | house 26 m / band -16, tree 14.5 m / -15, both shots |
| parallax direction | a nearer plane always moves more than a farther one when the camera moves (QA fails a reversal) | checked per frame by the QA sweep |
| horizon | within 0.5 % of frame height across a match cut | 3 px at the 7.40 s cut |
| subject scale | a cut may change it by less than 2× | piano 0.33 H → 0.52 H |
| sun | one direction for the whole film; cloud shadow may dim it, never move it | fixed vector `[-0.70, 0.235, 0.67]` |
| ground contact | a 3D object's shadow is cast by the 3D path and lands on the same ground the plates stand on | piano and figure shadows |

### Time continuity

The film is one continuous performance even across cuts: pose functions take **film time**, not shot-local time, so the
figure's coat has the same phase before and after a cut. The same applies to the wind (a gust that arrives at 3.1 s is still
in the air at 7.5 s) and to the clouds.

### What breaks 2.5D continuity most often

1. re-anchoring a plate per shot "to frame it better" (the place stops being a place);
2. letting the foreground plate drift in depth between shots;
3. changing the horizon height because the framing was easier;
4. giving one shot a different sun because its composition wanted the light on the other side;
5. a new element appearing in shot 2 that was not in the wide shot of the same place.

All five are caught in the visual review by putting the first and last frames of adjacent shots side by side.
