# Motion system

Every moving thing in this engine is a **closed-form function of time**. Nothing integrates a step, nothing remembers the
previous frame, nothing calls `Math.random()`. That is not a style preference: frames are rendered in parallel, out of
order, on several workers, and any two renders of the same `t` must be byte-identical. It is also what makes a motion
*editable*: you can change the pose at 4.3 s without re-rendering 0–4.2 s.

## The rule

> If you need motion, write `f(t) -> value`. Never write `x += v * dt`.

Violations show up as: frames that differ between two renders of the same time, motion that depends on render order,
"physics" that explodes on a slow frame, and QA that cannot reproduce a defect.

The only randomness allowed is `hash01(i)` (stable per index), `hash2/hash3` (per coordinate pair) and `rngFrom(seed)`
(a seeded stream inside one loop). `noise1(t, seed)` and `fbm2(x, y, seed)` are deterministic value noise: use them for
wind, breathing, flicker and grain, never `Math.random()`.

## Time helpers

| call | meaning |
|---|---|
| `seg(t, a, b)` | progress 0..1 of `t` through `[a,b]` |
| `span(t, a, b)` | `t` clamped into `[a,b]` |
| `win(t, a, b, fade)` | 0 outside `[a,b]`, ramping in/out — a visibility window |
| `clamp01`, `smoothstep(a,b,x)`, `smoothstep01(k)`, `smootherstep01(k)` | the bread-and-butter eases |
| `frac(x)`, `mod(a,n)` | cycles without sign surprises |

Everything takes seconds in film time. Shot code passes either the global `t` (for anything that must continue across a
cut: a figure's performance, the bird) or the shot-local `lt` (for the camera, which belongs to the shot). Never mix the
two in one expression without naming which is which.

## Curves

- `hermite(p0, p1, m0, m1, t)` — cubic Hermite with explicit tangents. Use it when the *speed* at both ends matters:
  a hand that leaves slowly and arrives fast, a door that swings and settles.
  ```js
  // a head turning: slow out of the old pose, fast into the new one
  const yaw = hermite(0, 28, 0, 60, seg(t, 2.1, 2.55));   // m0 = 0 (ease out), m1 = 60 deg/s at arrival
  ```
- `catmull(keys, t)` — Catmull-Rom through a sequence of values; for a hand path or a head arc with several keys.
- `bez2`, `bez3`, `bez2v` — quadratic/cubic Bezier, scalar or 3-vector. Use for a reach that rises before it comes down.
- `arc3(a, b, h, k)` — point on an arc from `a` to `b` peaking `h` metres above the chord: hops, thrown objects, a bird's
  landing approach.
- `easeInOutCubic`, `easeOutExpo`, `easeAnticipate(k, amp)` — `easeAnticipate` starts slightly backwards, which is the
  cheapest way to give a move weight.

## Springs (closed form, not integrated)

`spring(t, t0, k, w)` is a damped oscillator kicked at `t0`: 0 before, then `exp(-k·(t-t0))·sin(w·(t-t0))`.
`ring(t, [t0, t1, …], k, w)` superposes one kick per event. `lag(sample, t, delay, settle)` evaluates an external signal
`delay` seconds behind, so a coat hem or a head can trail its driver.

```js
// follow-through: the coat away from the body, the head settling after the chest
const hem = ring(t, [2.30, 3.95], 7, 22) * 0.03;     // two events in the performance
const headSettle = spring(t, 4.22, 9, 26) * 1.4;      // after the key press
```

Springs are for **secondary** motion. They must never be the primary motion of a body part, because an oscillator reads
as a wobble rather than a decision.

## Poses as functions

A pose is a plain object of numbers and vectors (`root`, `yaw`, `chestTwist`, `feet`, `hands`, …). Two ways to build one:

- `blendPose(a, b, k)` mixes two poses key by key (numbers, arrays; other fields take `b` past 0.5).
- `poseTrack(t, [[0, poseA], [1.2, poseB, easeFn], …])` samples a keyframe track where each key may override the easing
  used to arrive at it.

The reference film does not use pose tracks for its figure: it uses **analytic motion functions composed by shot time**,
because a walk is a cycle, not a set of keys. Keys are for one-off actions (reaching, sitting, turning on a spot).

## The gait

`gait(s, o)` turns a travelled **distance** `s` (metres) into two foot states. `walkPose(t, o)` builds a full body pose
from a straight path, an easing for progress, a stride length and a duty factor.

The properties that matter, and where they come from:

- **Foot locking.** During stance the foot's world position does not change (it is `pathAt(sLand)`); the body moves over
  it. A walk written as `x = lerp(...)` on the feet slides. This one cannot.
- **Plant ahead of the hip.** The foot lands half a stance sweep *in front* of the hip. Without that offset, by the end of
  stance the leg is dragged straight behind the body and the IK has to either stretch it (proportions change) or lift it
  (foot off the ground).
- **Heel lift.** Through the last third of stance the ankle rises up to 0.085 m and the foot pitches up to 30°. This is
  what makes the same leg length reach the ground at the end of a long step: a 0.835 m leg cannot reach 0.40 m in front
  of a 0.885 m hip; it can reach it once the ankle lifts.
- **Reach-limited pelvis.** The hip height is not a bob curve, it is `sqrt(legLen² − dH²)` where `dH` is the horizontal
  distance to the furthest foot. The body lowers exactly as far as the feet require, which produces the natural bob as a
  side effect and makes an over-extended leg impossible. The result is `root[1] ≈ 0.84–0.87` for a 1.64 m figure.
- **Counter-rotation.** Pelvis yaw and chest twist run in antiphase; the arms swing opposite the legs; the head has its
  own small lag (`Math.sin(phase·TAU + 0.9)`).

```js
const p = walkPose(t, { start: 0.10, end: 2.30, from: [-3.02, 2.40], to: [0.02, 1.78], yaw: 100.3, stride: 1.03, duty: 0.62, armSwing: 19 });
```

The gait's phase is derived from distance, so a walk at constant speed has constant cadence; if the easing slows down, the
steps shorten, exactly as a person's do when they stop.

## Stops, turns, settles

- A walk does not stop with the feet half a stride apart. After the walk, animate **one settle step**: the trailing foot
  lifts, arcs and plants beside the leading one (0.46 s), while the leading foot drags 8 cm into a stance. Details in
  `src/world/characters.js` (`stepK`, `dragK`).
- A turn is hips first, chest 80 ms later, head 200 ms later. Implement it by giving each of the three its own `yaw`
  function with a different `seg(t, a, b)` window, never one shared `lerp`.
- After any fast move, add a small `spring`-driven overshoot (hand, coat hem, head) so the body settles instead of
  stopping dead.

## Secondary motion

Secondary motion is what makes a moving figure read as flesh rather than a jointed puppet. Keep it under 4 % of the
primary motion's amplitude, and drive it from the primary motion:

- coat hem: `coatSway` from the yaw rate, `coatLift` from the step phase (`Math.abs(Math.sin(phase·TAU))`);
- hair: a small offset opposite the head's turn, spring-damped;
- props held in a hand: attached to the hand's position with a 40–80 ms lag and a settle;
- grass and trees: one `wind(t)` function shared by every tuft, with a per-tuft phase from its world position, so the
  whole field moves as one body of air. Never give each sprite its own independent sine.

## Camera motion

The camera rig lives in `camera.js` and `CAM`. It is a description, not a drawing:

```js
// locked off but alive: a tripod still breathes
const b = CAM.breath(lt, 0.0022, 3, 0.5);          // metres, seed, speed
return { pos: [-1.62 + b[0], 1.38 + b[1], -6.35 + b[2]], target: [0.32, 1.06, 0.85], focal: 35, focus: 7.2, aperture: 5.6 };

// a dolly with a focus pull: interpolate the camera STATE, not screen coordinates
const k = easeInOutCubic(seg(lt, 0.15, 3.0));
return CAM.lerp(stateA, stateB, k);                 // pos, target, focal, focus, aperture, roll
```

A move must have a destination and a reason; if the reason is "it felt static", lock the camera and give the frame
something to watch instead. Never use the same move in consecutive shots, and never let a move run through a cut (unless
the cut is a carry-through, in which case the second shot continues the first move in the same direction).

## Forbidden by this system

- `Math.random()` anywhere in scene or engine code.
- Per-frame state (`let x` mutated across frames), accumulated velocities, particle integrators.
- Frame-rate-dependent motion: everything is seconds, so `1/fps` must never appear in a motion expression.
- Snapping a pose between frames (a `lerp` with no easing, or a branch on `t` that jumps). Feed a `smoothstep` window.
- Moving every part at once: give each part its own start time.


## 2.5D update — one wind, many clocks

### The rule

Every moving thing reads the same wind field, and **no two things share a period**. When several elements oscillate on one
sine, the frame reads as a loop even when it is not one.

```js
AMBIENT.gust(t)                 // 4.7 s and 11.3 s envelopes multiplied, plus turbulence
AMBIENT.at(t, x, z)             // the gust with a ~7 m travelling wave at ~2.4 m/s
AMBIENT.branchSway(t, seed, s)  // 1.9 s bend + a 0.73 s tremor, lagged by stiffness
AMBIENT.grassSway(t, x, z, h)   // 1.3 s ripple, phase from position
AMBIENT.cloudOffset(t, layer)   // 0.62 m/s and 0.34 m/s plus 57 s and 23 s drifts
AMBIENT.exposureDrift(t)        // 37 s, a few percent of a stop
```

### Three levels

1. **The field** - grass and crops: a travelling wave, so the wind arrives in one place before another.
2. **The objects** - branches, leaves, cloth, a hanging wire: each with its own stiffness and phase, and each *lagging* the
   field. The tree answers the gust about 0.2 s late; that lag is what makes it read as a tree and not a metronome.
3. **The world** - clouds, light, dust: slow enough that a 12 s film sits inside a single swell.

### Register every mover

Anything with its own animation function calls `mover('name')` in the shot. The budget counts them, and a shot with more
than six independent movers has lost its stillness.

### Determinism

Every function here is pure in `t` (and its spatial inputs). No accumulated state, no `Math.random()`, no per-frame drift -
otherwise parallel rendering produces different films depending on frame order.
