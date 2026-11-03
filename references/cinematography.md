# Cinematography

The camera here is a real pinhole on a 36 mm sensor, so every shot states a position, a target, a focal length, a focus distance and an aperture in metres — and this file fixes the heights, lenses, moves and cuts that are allowed, each with the job it does.

## 1. The model

- `makeCamera({ pos, target, focal, focus, aperture, roll })` builds the frame's camera; `SENSOR_W = 36`, `NEAR = 0.04`, and `focalPx = (focal / 36) × W`, which at 1920 is **focal × 53.33**. At 35 mm that is 1866.7 px; at 85 mm, 4533.3 px.
- There is no 2D zoom and no fake parallax. A dolly is `pos` moved towards a subject; a pan is the `target` moved; a depth cue is geometry projected by `project`. If a frame's foreground and background do not slide against each other when the camera moves, the camera did not move.
- `readCamera(desc, t)` accepts a plain description object or a function of shot-local time. Every camera in the film lives in `src/world/cameras.js`, one entry per shot; a shot file may not build a camera inline.
- A `focal` change inside one shot is a zoom and must be declared. The QA sweep raises a P0 at more than **1.5 mm** of focal change between adjacent frames, and a P0 at more than **0.16 m** of camera translation or **4.5°** of yaw change in one frame — inside a shot, that is a jump, not a move.
- Keep clear of `NEAR = 0.04`: a camera that passes within 4 cm of the piano lid clips the polygon and the lid becomes a hole. Render the closest frame of any move and check it.

## 2. Lens vocabulary on the 36 mm sensor

| focal | focalPx | horizontal FOV | use |
|---|---|---|---|
| 32 mm | 1707 | 58.7° | establishing wide where the field must read deep |
| 35 mm | 1867 | 54.4° | the default documentary wide — depth without bending the piano |
| 40 mm | 2133 | 48.5° | medium over the shoulder, gentler than 50 |
| 45 mm | 2400 | 43.6° | medium wide that tightens a wide by one size |
| 50 mm | 2667 | 39.6° | medium: person and object in one frame, perspective still honest |
| 60 mm | 3200 | 33.4° | close-up of an object or a hand; sky nearly gone |
| 85 mm | 4533 | 23.9° | compression and separation; for objects, never for faces |

- Rules: one lens per shot, declared. A wide is 32–35, a medium 40–50, a close-up 60–85. Do not "fix" a composition by changing focal length — move the camera.
- `meta.lens` is the shot's written intent and `cameras.js` holds the number that renders. In this template those disagree (S1–S5 write 35/50/60/35/35 but render 35/50/60/35/35); the rendered number is the one the frame shows, so treat the code as authoritative and fix the disagreement before delivery.

## 3. Camera height is a statement

| height | what it says | in the reference |
|---|---|---|
| 0.30–0.55 m | ground-level detail; objects become monumental, sky disappears | S3 at 0.505 m on 60 mm, horizon at 0.118 of frame |
| 1.10–1.30 m | seated, crouched, or shoulder-held | not used — available for a chair, a child, a table |
| 1.36–1.45 m | standing observer, just under a 1.64 m figure's eye line (eyes ≈ 1.55 m) | S1 1.38, S2 1.42 → 1.36, S5 1.41 |
| 1.70–1.90 m | slightly above the subject, looking down; the camera does not join | S4 at 1.74 m |

- Height is written in the shot list and the bible. At a cut it may change only because the film moved to a new setup; a change of more than 0.3 m must be visible as a new size, and any 0.5 m → 1.7 m jump needs its reason in `meta.motion`.
- Within a shot, height may change only if the camera physically can: S2 drops 6 cm over its dolly because a person operating would. A 40 cm descent in 1 s is a crane and must be declared as one.

## 4. The move vocabulary

| move | how it is written | the reference | what it is FOR |
|---|---|---|---|
| locked off + breath | `CAM.breath(lt, amp, seed, speed)` added to `pos` | amp 0.0022 (S1), 0.0018 (S2), 0.0012 (S3), 0.0020 (S4), 0.0024 (S5); handheld 0.012 | watching: the tripod breathes, so a person is holding it |
| pan / tilt by target | the `target` is lerped, `pos` is not | S4's carry-through | following a line that leaves the frame |
| dolly in / out | `CAM.lerp(a, b, k)` on `pos` **and** `target` | S2: 1.1 m over 2.85 s = 0.17 m/s | attention tightening on one act as it happens |
| tracking | `pos` interpolated with the subject's path | none in this film | a subject travelling more than 3 m with two depths in parallax |
| tilt with carry-through | target y rises while the horizon drops through frame | S4: pitch −2.11° → +8.55° (10.7°) in 1.05 s, horizon 0.436 → 0.760 | a thing that leaves frame without a cut to it |
| match cut | two shots framed to the same mass position and focal | S1 → S5: both 35 mm, horizons 0.426 / 0.421, cameras 0.28 m apart | "the same place, changed" |
| focus pull | `dof: (lt) => ({ focus, aperture })`, blurred by `circleOfConfusion` | S2: focus 3.85 → 2.75 m over 1.6 s | attention moving between two depths in one frame |

The one real moving camera in the film, verbatim:

```js
defineThing('camera', 's2', (lt) => {
  const k = easeInOutCubic(seg(lt, 0.15, 3.0));
  const b = CAM.breath(lt, 0.0018, 5, 0.4);
  return {
    pos: [lerp(1.05, 0.82, k) + b[0], lerp(1.42, 1.36, k) + b[1], lerp(4.55, 4.12, k) + b[2]],
    target: [lerp(0.30, 0.26, k), lerp(1.10, 1.04, k), lerp(1.30, 1.22, k)],
    focal: 50, focus: lerp(3.85, 2.75, easeInOutCubic(seg(lt, 1.0, 2.6))), aperture: 2.4,
    motion: 'dolly in 1.1 m with a focus pull to the keys',
  };
});
```

## 5. A move needs a destination and a reason

- Write both next to the call site: the end position in metres, and the line of the film the move carries. If you cannot name the end position, it is a drift — delete it.
- Speed: dolly and track 0.15–0.20 m/s at 3–5 m, never above 0.5 m/s. A pan that only re-frames ≤ 3°/s; a follow-tilt may run 10°/s for ≤1 s (S4 does 10.2°/s). Breath never exceeds 0.006 m on a tripod.
- Start the move within 0.3 s of the event it follows, and end it after the event has finished. A move that starts and ends with nothing in between is camera exercise.
- Banned: **every shot pushing in** (the reference has one dolly in five shots), **drifting with no end state**, a move that begins before the cut that motivates it, two unrelated moves in one shot, and a zoom standing in for a dolly.
- Budget: three of five shots locked off. If a shot has no event, lock it; if it has an event, lock it and let the event move.

## 6. When to cut

- Cut at the **end of a read**, never inside one. After an action, give it 0.10–0.20 s to complete: S1 → S2 at 2.90 is 0.12 s after the turn ends (2.78); S4 → S5 at 10.60 is 0.15 s after the bird clears frame (10.45); S3 → S4 at 8.90 cuts 0.14 s *into* the crouch — a cut on action, so the new shot starts already moving.
- S2 → S3 at 6.10 ends the 0.7 s listening read (5.4–6.1). Cutting out of a hold is the documentary way to say "that is finished, look at the consequence".
- Default is the hard cut (4 of 5 here). Fade only at the ends: `fadeIn: 0.55` on S1 and `fadeOut: 0.45` on S5, both to `#07080c`. `mix` (a dissolve at the head of a shot) exists and is unused; a dissolve in the middle of a 12 s film reads as a commercial.
- Two adjacent shots must differ in size or subject. Two shots within 1.0–1.3× of the same subject fraction read as a jump; the QA sweep reports near-identical shot statistics as `repeatSigDiff`.
- Screen direction is a contract: a figure that exits frame left re-enters from the right unless the cut is deliberately disorienting. No cut in an 8–15 s documentary earns that.

## 7. Coverage: the five-shot structure

| shot | size | height | focal | move | job |
|---|---|---|---|---|---|
| S1 | wide | 1.38 m | 35 | locked, breath 0.0022 | the place, empty, with the piano in it |
| S2 | medium | 1.42 → 1.36 m | 50 | dolly 1.1 m + focus pull | the act: one key goes down |
| S3 | close-up | 0.505 m | 60 | locked, breath 0.0012 | the consequence: the note dying |
| S4 | medium wide | 1.74 m | 35 | tilt 10.7° carry-through | the departure |
| S5 | wide | 1.41 m | 35 | locked, breath 0.0024 | the absence |

- An 8–15 s film needs 3–5 shots and at least three distinct sizes. Exactly one close-up, placed on the event that needs explaining (here, the note).
- Never two wides in a row unless the second is the opening/closing rhyme; never a close-up of a face — the figure is a silhouette, so a close-up is of hands, objects or light.
- A detail shot is a close-up of an object with its own light (the candle in S3), not a tighter version of the medium in front of it.

## 8. Framing

- Compose inside the 3:2 block described in `visual-language.md`; a wide's mass sits there, and the extra 16:9 width on one side is air, not content.
- Headroom 0.04–0.10 of frame height above the head in a medium or a close-up; in a wide the figure is small, so 0.30–0.45 is normal (S1's crown sits at 0.439 H). Lead room at least 0.15 of frame width in the direction of travel. In S1 the horizon is at 460 px and the crown at 474 px — 14 px apart, so the horizon clears her head and never cuts her body.
- Subject size is a decision, not a result: set the fraction of frame height the subject must occupy (0.20–0.40 wide, 0.45–0.75 medium, 0.85–1.00 or cropped for a close-up) and then choose the position and focal that produce it. In S1 the figure sits at 0.348.
- The camera's `target` is not the subject's centre. In S1 it is `[0.32, 1.06, 0.85]` — 0.02 m east of the piano's x, 0.12 m above its case — so the piano projects at 0.514 W, near centre, and the bird lands at 0.60 W with air above the horizon.
- Depth order must survive the painter's algorithm: a foreground tuft, the subject, the house and the treeline all convex and separated. Framing is where interpenetration is prevented, not fixed afterwards.

## 9. The shot list, as the code publishes it

These are the fields `shotMeta()` publishes; write `SHOT_LIST.md` from the code, not the other way round.

| id | start | dur | size | lens (meta) | motion | transition | reads |
|---|---|---|---|---|---|---|---|
| S1 | 0.00 | 2.90 | wide | 35 mm f/5.6 | locked off, tripod breath | fade in 0.55 s | 4 — ends "she arrives at the keyboard" |
| S2 | 2.90 | 3.20 | medium | 50 mm f/2.4 | dolly in 1.1 m, focus pull | hard cut on her stopping | 5 — ends "she listens" |
| S3 | 6.10 | 2.80 | close-up | 60 mm f/2.0 | locked off, holding | cut on the release of the key | 4 — ends "the flame leans, nothing else moves" |
| S4 | 8.90 | 1.70 | medium wide | 35 mm f/2.8 | tilt up 10.7 deg following the bird | cut from the close-up on her head turning | 4 — ends "her head and shoulders follow it" |
| S5 | 10.60 | 1.40 | wide | 35 mm f/5.6 | locked off, tripod breath | cut, then fade out 0.45 s | 3 — ends "hold, then black" |

- The `motion` strings here are the intent; the measured values are in §4 and §7 (the dolly is 1.1 m, the tilt is 10.7°). Reconcile the two before delivery, or the shot list is fiction.

## 10. Forbidden

1. **Every shot pushes in.** One motivated dolly per film; the rest hold. A film where the camera always advances has no rhythm, only a tic.
2. **Drift.** A move with no destination is not a move; it makes the audience seasick and the geometry meaningless.
3. **Whip pans, crash zooms, snap focus.** The QA sweep fails camera jumps over 0.16 m / 4.5° / 1.5 mm per frame, and rightly.
4. **Dutch angle.** `roll` defaults to 0; more than 2° needs a written reason.
5. **Handheld as emotion.** Shake is a statement about the operator, not the subject; if the film has no operator character, the camera is on a tripod.
6. **Camera above 3 m or below 0.3 m** without a line in the shot list saying what that height means.
7. **2.39:1.** See `visual-language.md`: the default is 1920 × 1080, 24 fps, 16:9.
8. **A move that passes through geometry.** `NEAR = 0.04` will clip it into a hole; check the closest frame of every move.


## 2.5D update — the camera language for plates

### The moves that are allowed

| move | use | reference film |
|---|---|---|
| fixed on sticks, with breath | the shot is about what is in the frame | W2 |
| very slow dolly in or out | a relationship between subject and land changes | W1 (in 0.7 m, left 0.5 m over 7.4 s) |
| very slow lateral pan or truck | parallax between plates does the storytelling | W1 |
| foreground occlusion | grass at the lens puts the subject in the same space as the camera | W1, W2 |
| long take | the system's natural unit; 6-8 s at a time | both |
| match cut on a compositional line | a closer framing without a time jump | W1 → W2, horizon matched |

Not allowed: rotation or orbit for its own sake, sudden zooms, drift with no declared purpose, more than one transition type
per film, and "everything moves so it looks animated".

### Every move must declare itself

```js
meta: { motion: 'slow dolly left 0.5 m and in 0.7 m over 7.4 s, tripod breath' }
```

A move that cannot be described in one line like that is not a decision yet.

### Horizon discipline

For a panorama the horizon is the film's spine. Rules:

- place it between 0.36 H and 0.46 H in a wide shot; the reference film uses 0.39;
- a match cut must land the horizon within ~0.5 % of frame height (the QA sweep fails it over 0.8 %);
- the camera may not roll; the horizon stays level to the pixel;
- a tilt that follows a bird is the only move allowed to change it, and then it is stated in the shot list.

### Lens choice

32-40 mm on the 36 mm sensor for panoramas (the reference film: 32 mm wide, 40 mm closer, 60 mm for a detail). Wider than
28 mm starts to bend a field; longer than 50 mm flattens the depth planes and the plate system loses its point. DoF is four
bands - declare the aperture you would have used, but do not promise bokeh you cannot draw.

### Camera continuity across a cut

Position must be plausible (a cut may move a camera, not teleport an audience), subject direction must not flip, subject
scale must step by less than ~2×, and sun direction must be identical. The QA sweep checks the sun vector and the horizon;
the rest is the editor's job, documented in the shot list.
