# Character animation

The figure is a **skeleton solved by IK**, drawn as a silhouette. Not a shape that slides: eleven joints in world space,
derived every frame from a pose. Bones have fixed lengths, so a person cannot change proportions between shots; feet are
solved onto ground targets, so a foot cannot slide; a hand is solved onto a key, so contact is a constraint rather than an
eyeball.

## The proportions (metres, for a 1.64 m adult)

`PROPORTIONS` in `src/engine/character.js`. These numbers ARE the character: change them once and every shot follows.

| bone | length | note |
|---|---|---|
| hip centre height | 0.92 | standing at ease |
| hip joint offset | 0.088 lateral, 0.035 down | |
| spine: hips→waist→chest→shoulder | 0.10 / 0.18 / 0.19 | shoulder line at 1.39 |
| shoulder half-width | 0.163 | |
| neck → head base | 0.075 | head radius 0.093 |
| upper arm / forearm / hand | 0.285 / 0.255 / 0.175 | fingertips reach 0.715 from the shoulder |
| thigh / shin / ankle height | 0.42 / 0.415 / 0.075 | leg 0.835, nearly straight when standing |
| foot | 0.235 long, heel back 0.055 | |
| coat | hem 0.46 above ground, half-width 0.225 | mid-calf |

If you change a length, the QA probe `bone length drift` will pass (it compares against the same constants) but every
reach, contact and ground solve in the film shifts. Change the table, then re-solve the shots that touch objects.

## A pose

```js
basePose({
  root: [x, hipY, z],          // pelvis centre, world metres
  yaw: 168,                    // facing, degrees (0 = +Z)
  hipsPitch, hipsRoll, hipsYaw,
  waistFwd, waistSide,
  chestFwd, chestTwist, chestSide,
  neckFwd, headYaw, headLook, headTilt,
  feet: { L: { pos:[x,0.075,z], yaw, pitch }, R: {...} },   // ANKLE world targets
  hands: { L: { pos:[x,y,z], pole:[...] }, R: {...} },      // WRIST world targets
  coatSway, coatLift,
})
```

Spine joints are posed by rotation; **limbs are posed by target**. That is the whole design: a hand's position is
something a shot can state in world space ("the wrist is 12 cm above the second key"), and the solver finds the elbow.

## Solving

`solveSkeleton(pose)` returns every joint in world space: `hips, waist, chest, neckBase, headBase, headCenter, shoulderL/R,
elbowL/R, wristL/R, hipL/R, kneeL/R, ankleL/R, footL/R, handL/R`, plus `reachWarn`.

- **Spine**: rotation matrices chained hips → waist → chest → neck → head with `eulerMat`-style composition. Pitch is
  `-fwd` because a downward-pointing bone rotated +x swings backwards.
- **Two-bone IK** (`solveTwoBone`): cosine rule on the root→target distance, with a **pole vector** choosing the bend
  plane. Knee pole = forward + slightly outward; elbow pole = outward + back. Out of reach is clamped and reported in
  `reachWarn` (QA turns >2 cm into a P1). A leg that has to over-extend means the staging is wrong, not the IK.
- **Feet**: the ankle target plus a pitch builds heel, ball and toe; the foot polygon is drawn from those points, so the
  sole stays on the ground plane when the ankle is at `ankleH`.
- **Hands**: the wrist target defines the palm; the hand continues the forearm direction. Fingers are drawn only when
  they resolve (see below).

## Pose targets are world positions

Because targets are world-space, contact is a solve, not a guess. The reach in the reference film:

```js
const key = getThing('prop','piano').keyPoint(0.44);      // world point of one ivory key
const wrist = vadd(key, [0.015, 0.118, 0.03]);            // start 12 cm above and behind it
```

and then a **one-step contact correction** (`womanPoseOnKey`): solve, measure the fingertip, move the wrist target by the
error, solve again, up to five times. That is how the fingertip lands within 3 mm of the key with no hard-coded angles,
and it stays correct if the piano is moved.

```js
for (let i = 0; i < 5; i++) {
  const err = vsub(key, fingertipOf(p));
  if (vlen(err) < 0.004) break;
  p.hands.R.pos = vadd(p.hands.R.pos, vmul(err, 0.85));
}
```

## Overlap: parts arrive at different times

Never move hips, chest, head and hands together. In the reference performance:

| part | starts | ends | lag behind its driver |
|---|---|---|---|
| hips turn | 2.30 | 2.80 | — |
| chest twist | +0.08 s | +0.08 s | 80 ms |
| head turn | +0.20 s | +0.20 s | 200 ms |
| right hand reach | 3.70 | 4.22 | starts 1.4 s after the feet stop |
| key release | 4.62 | 4.62 | 400 ms hold |
| withdraw | 4.64 | 5.30 | overshoot spring at 5.18 |
| head lifts off the keys | 5.4 | 6.4 | 700 ms after the hand |

`lookAt(pose, target, weight)` aims the head at a world point and splits the effort between neck and head. In shots, the
head target is usually evaluated at `t - 0.11` so the head *lags* what it is looking at; a head that tracks instantly
reads as a camera, not a person.

## Secondary motion on the body

- `coatSway` drives the hem shell inside the coat mass (folds are drawn in the silhouette texture, the hem is a hulled
  ring that sways opposite the yaw rate).
- `coatLift` raises the hem with the step phase (`|sin(phase·TAU)|`).
- Hair and bun follow the head with a small spring; the bun is a projected disc behind the skull.
- Breathing: `idlePose` adds 3.5 mm of pelvis rise, 0.9° of chest pitch and a micro head yaw from `noise1(t)`. A figure
  with zero motion is a bug; a figure with 2 cm of idle drift is a mime.

## Rendering the figure

Order is anatomical, not random: far arm, far leg, coat, torso, head, near leg, near arm — with which side is "far"
decided by comparing view-space depth of the knees and wrists, so the figure stays correct from any angle.

- Limbs are **capsules**: `tube()` with `extend: 0.9` and a disc at the proximal joint. Two capsules meeting at a joint
  overlap by construction, so a bent elbow is one form instead of two sticks.
- Torso, coat, head and hair are **hulls**: `massSilhouette()` projects a ring of 3D points and fills the convex hull with
  a rim light on the sun side (a single gradient in `screen` blend). Hulls never show internal seams.
- The **coat** gets soft vertical folds drawn inside the mass (5 gradient bands), and its hem ring is offset by the sway.
- The **hand**: a palm polygon plus four fingers plus a thumb, but only when the palm would be at least ~34 px wide.
  Below that the hand is one small capsule. A five-fingered claw at 12 px is the defect this threshold exists to prevent.
- **No face.** A drawn face on a 150 px silhouette becomes a mask. Instead: hair mass, bun, one small highlight on the
  sun side of the skull. Where the film needs the idea of a face, stage a profile against the sky, or cut to the hands.

## What breaks, and how to see it

| symptom | cause | how to see it | fix |
|---|---|---|---|
| hands hang at the knees | a limb length written as a unit vector | `node scripts/probe.mjs "(J=>J.wristR)(solveSkeleton(womanPose(t)))"` | multiply direction by the bone length |
| wrist or knee at a strange height | IK target out of reach, silently clamped | the probe's `reachWarn` | move the target, or lower the pelvis (reach-limited height) |
| foot sliding | stance foot recomputed from the body position each frame | strip of the walk with `--crop-at` | plant at `pathAt(sLand)`, keep it fixed through stance |
| foot through the floor | ankle target below `ankleH`, or IK clamp | QA `foot through floor` | clamp the target; keep the sole on y≈0 |
| figure changes height | the root height is authored per shot instead of from the gait | compare root y across shots | one performance function, one stance |
| head turns with the chest | one `yaw` shared by both | strip through a turn | separate windows, head 200 ms later |
| a limb pops to a new place | a pose branch on `t` with no window | strip | `smoothstep` the transition |
| the hand misses the key | no contact correction | crop at the key, `--crop-at` | solve, measure, correct (see above) |
| two of something | the prop drawn from two call sites | QA `single instance` probe | one registry entry, one draw call |

## QA that runs automatically

- `qaBoneLengths` — every bone's world length against `restLengths()`, tolerance 2 % (P0).
- `qaGroundContact` — ankles may not go below −2 mm (P0).
- `leg over-extended` — `reachWarn > 2 cm` (P1).
- `figure floating` — both ankles above 0.5 m (P1).
- `woman.key-contact` — fingertip within 3 cm of the key for the whole press window (P0).
- `woman.feet-on-ground` — the lower ankle stays between 0.05 and 0.11 m (P0).
- `single instance` — a figure or prop drawn twice in one frame (P0).

Run them over every frame with `node render.mjs --qa`; run them on one time with
`node scripts/probe.mjs "(J=>({ank:J.ankleL,ov:J.reachWarn}))(solveSkeleton(womanPose(1.4)))"`.


## 2.5D update — the figure is now explicitly A/B level

### What changed

The previous version tried to make a character system that could do anything. This version states a capability boundary and
keeps the animation quality high inside it.

| level | content | production status |
|---|---|---|
| **A** | far figure, silhouette, back, side profile, still | the default; the reference film's figure is A-level |
| **B** | slow walk, sit, stand, look down, turn, one raised arm, a hand resting on a key | available and tested |
| **C** | facial expression, precise finger work, multiple people interacting, complex prop manipulation | **not a production capability** - do not promise it |

The reference film's figure is A-level: she stands at the piano's bass side, back three-quarters to the lens, and does not
act. What moves is the coat (two frequencies), the head (0.8°), the chest twist (0.7°) - millimetres, not performance.

### The rules that still apply in full

1. **No mechanical interpolation.** Every action has anticipation, primary motion, weight shift, follow-through, overlap and
   a settle. Cubic Hermite for trajectories, damped springs for secondary motion.
2. **Independent joints.** A pose is 11 joints with their own targets; a limb cannot be a rigid piece of another.
3. **Contact is solved, not placed.** A hand on a key is solved to within 3 mm by iterating the wrist target; a foot is locked
   in world space for the whole stance.
4. **Proportions are a contract.** The skeleton's segment lengths are validated every frame (`qaBoneLengths`); a figure whose
   proportions drift is a bug, not a style.
5. **One figure, one wardrobe, one place.** The coat, hair and stance must be identical from every angle and in every shot
   where the figure appears.

### When in doubt, use less figure

A silhouette at the piano from behind carries more than a badly animated face ever will. If a shot needs C-level performance
to work, the shot is wrong for this system - rewrite the shot, not the character.
