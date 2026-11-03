# Environment animation

A still frame that moves: one wind field, one clock per element, and the discipline of never letting two things share a period.

## 1 · The principle

A documentary frame is never still, and it is never all moving at once. `src/engine/ambient.js` is the layer of slow,
involuntary motion that makes a locked-off shot feel photographed. Three rules follow, and every later section is one of
them made executable:

1. **No two things share a period.** Two elements running the same sine read as a loop even when the film is not one,
   because the eye finds the recurrence in half a second.
2. **Motion is layered by speed.** Grass answers in a tenth of a second, branches in about a fifth, clouds over a minute.
   A frame where everything moves at the same rate looks switched on, not alive.
3. **Direction comes from one field.** Every blade, branch and coat bends downwind, and the field has a travelling wave,
   so the frame has a direction and a propagation — not a hundred independent wiggles.

## 2 · The clocks

Every number is from `src/engine/ambient.js`, `src/engine/sky.js`, or the shot that registers the mover.

| element | period | amplitude | phase / direction source | code |
|---|---|---|---|---|
| gust envelope | 4.7 s and 11.3 s, multiplied; turbulence `noise1(t*0.9,3)` | 0.18–1.00, `clamp01` | sine phases + an 11.3 s inner modulation | `AMBIENT.gust` |
| travelling wave | λ 7 m, phase velocity 7/2.4 = **2.92 m/s** along +x | × 0.55–1.00 of the gust | world `x` | `AMBIENT.at` |
| grass ripple | 1.3 s | × 0.55–1.00 of the wind | `x*0.42 + z*0.31` rad/m (15 m ripple along x) | `AMBIENT.grassSway` |
| branch slow bend | 1.9 s | 1.0 × gust × 1.3/stiffness, in degrees | `seed*2.3` rad | `AMBIENT.branchSway` |
| branch fast tremor | 0.73 s | 0.28 of the slow term | `seed*5.1` rad | `AMBIENT.branchSway` |
| branch arrival lag | 0.18 s × stiffness | — | gust read at `t − 0.18·stiffness` | `AMBIENT.branchSway` |
| leaf cluster | 1.9 s / 0.73 s at 0.8 × its branch's stiffness | 1.3/(0.8·stiffness) | `seed+3` rad | `panoTree` |
| low cloud drift | 0.62 sky-m/s + a 57 s swell | ±1.4 sky-m | linear drift | `AMBIENT.cloudOffset(t,0)` |
| high cloud drift | 0.34 sky-m/s + a 23 s swell | ±0.9 sky-m | `+1.7` rad | `AMBIENT.cloudOffset(t,1)` |
| cloud density | 40 s | 0.44–1.00 | `+0.8` rad | `AMBIENT.cloudDensity` |
| light | 37 s (exposure and warmth share the clock) | 0.945–1.000, i.e. 0.08 stop over a full cycle; warmth ±0.06 | `t/37` and `t/37 + 2.1` | `AMBIENT.exposureDrift`, `warmDrift` |
| dust motes | 6 m wrap at 0.03–0.08 m/s; 0.21 rad/s vertical sway | 0.012–0.032 m, α 0.12–0.42 | `hash2(seed,i)`, 14 motes | `AMBIENT.motes` |
| the crossing bird | one event, 3.1–8.5 s | x −44 → 34 m at z 46 | event time `t0`, 5.2 Hz flap | `AMBIENT.birdCross` |

The `t` passed to all of these is **film** time, not shot-local time, so a gust that arrives at 1.2 s arrives once, and a shot that starts mid-gust starts mid-gust.

## 3 · The three levels

**The field.** Grass is a *field* sampled per blade, not a swaying object: `AMBIENT.at(t,x,z)` multiplies the gust by a
travelling wave in world x, `grassSway` adds the 1.3 s ripple, and `panoFore` gives each blade its own `x` — blades have
no phases, they have positions. Measured in W1: a 0.35 m blade's tip leans 0.19 m (110 px at k = 571 px/plate-m) and the
wave's crest crosses the 16 m plate in 5.5 s.

**The objects.** A tree is a body made of parts. `panoTree` builds one deterministic limb skeleton per tree
(`buildLimbSkeleton(7301)`), gives every limb a stiffness that grows 1.28× per level, and sways each with its own seed;
leaf clusters are evaluated at 0.8× their branch's stiffness with `seed+3`. Measured tip displacement over 8 s: 76 mm on
a level-2 limb (1.4 m), 40 mm on level 3, 23 mm on level 4 — the crown is not one silhouette.

**The world.** Clouds are anchored to azimuth and elevation in `sky.js` and drift on two clocks: layer 0 at 0.62 sky-m/s
with a 57 s swell, mapped at `0.05 × focalPx` px per sky-metre; layer 1 at 0.34, mapped at `0.028 × focalPx`, drawn 1.7×
larger and 0.34 frame-heights higher at 0.30 weight. Over W1's 7.4 s that is 5.61 sky-m (479 px) for the low layer and
1.13 (54 px) for the high one: the sky moves, slowly, and never in step with the grass.

## 4 · One wind field, many response times

The gust is two slow envelopes multiplied plus a fast turbulence term, so it has no single period to lock onto. What
separates the elements is *when they read it*:

```js
gust(t) {
  const a = 0.5 + 0.5 * Math.sin((t / 4.7) * TAU + Math.sin(t / 11.3) * 1.9);
  const b = 0.5 + 0.5 * Math.sin((t / 11.3) * TAU + 1.1);
  const turb = 0.5 + 0.5 * noise1(t * 0.9, 3);
  return clamp01(0.18 + 0.55 * a * b + 0.27 * turb * 0.6);
},
at(t, x, z) {
  const wave = 0.5 + 0.5 * Math.sin((x / 7.0 - t / 2.4) * TAU);
  return clamp01(AMBIENT.gust(t) * (0.55 + 0.45 * wave));
},
branchSway(t, seed, stiffness = 1) {
  const g = AMBIENT.gust(t - 0.18 * stiffness);          // the lag is the physics
  const slow = Math.sin((t / 1.9) * TAU + seed * 2.3) * 1.0;
  const fast = Math.sin((t / 0.73) * TAU + seed * 5.1) * 0.28;
  return (slow + fast) * g * (1.3 / stiffness);
},
```

Grass reads the gust at `t`; a stiffness-1 branch reads it at `t − 0.18`; stiffer limbs read it later (1.28 → 0.23 s,
1.638 → 0.29 s, 2.097 → 0.38 s). That one line is the whole difference between "the wind arrived" and "everything
started at once".

## 5 · Authoring a new moving element

1. **Pick a period that is not taken.** The set is 4.7, 11.3, 1.9, 0.73, 1.3, 57, 23, 40, 37 s and the 5.2 Hz wingbeat.
2. **Derive the phase from a named constant**, never a literal inside a `Math.sin`: `(t / PERIOD) * TAU + phase`.
3. **Add a spatial phase from world position**, not from draw order or a frame counter, so the element travels.
4. **Read the one wind field** with `AMBIENT.at(t, x, z)`; never give the element its own gust.
5. **Be deterministic**: `rngFrom(seed)`, `hash2`, `noise1` — never `Math.random()` or `Date.now()`, because frames render out of order and in parallel.
6. **Register it** with `mover('name')` at the call site, after any early return, so the budget follows its presence.
7. **Add its row to §2.** A clock that is not in the table is a clock nobody can audit.

```js
// engine/ambient.js - a new element with its own clock, reading the shared wind.
reedSway(t, x, z, h = 1) {
  const PERIOD = 2.65;                                              // not in the taken set
  const wind = AMBIENT.at(t, x, z);                                 // one field: 7 m wave, 2.92 m/s
  const bend = Math.sin((t / PERIOD) * TAU + x * 0.9 + z * 0.55);   // spatial phase
  return wind * (0.6 + 0.4 * bend) * h;
},
```

## 6 · Amplitude: under 4 % of the subject

An element that is not the subject may not move more than **4 % of the subject's height** in that frame. Measured: the coat
hem swings ~4.5 cm on a 1.70 m figure (2.6 %); the tree's 76 mm limb-tip motion at 21 m projects to 6 px against a 342 px
figure (1.8 %); the motes are 0.012–0.032 m across at ~2.6 m (8–21 px) and read as dust. The grass in W1 is the subject,
so it is exempt — it may move 60 % of its own height, because the shot is about the wind.

```bash
node scripts/probe.mjs "(()=>{let lo=9,hi=-9;for(let t=0;t<8;t+=0.05){const v=AMBIENT.branchSway(t,1,1.28)*0.055*1.4*0.5;if(v<lo)lo=v;if(v>hi)hi=v}return {peakM:+(hi-lo).toFixed(3)}})()"
  -> {"peakM":0.076}
```

Convert with `peakM × k`, where `k` is the plate's pixels per metre (`SCENE.plates[name].k`), and compare with the
subject's projected height (`project(cam, head)` minus `project(cam, foot)`).

## 7 · Detecting "everything moved together"

**Period collision.** List the periods in the shot: two equal periods is one clock even with different phases. That is why
§2 exists. **Phase-difference dump.** Evaluate every element at 1 s intervals: constant differences mean one oscillator;
columns that track in sign every second are too close in period. Real output from this build (gust, one grass blade at
x 0.35 / z −4.50, normalised branch sway):

| t (s) | gust | grassSway | branchSway / (1.3/stiffness) |
|---|---|---|---|
| 0.0 | 0.555 | 0.058 | 0.234 |
| 0.5 | 0.772 | 0.436 | −0.502 |
| 1.0 | 0.885 | 0.192 | −0.321 |
| 1.5 | 0.790 | 0.295 | 0.527 |
| 3.0 | 0.310 | 0.145 | −0.150 |

The grass and the branch are anti-phase at 0.5 s and in phase at 2.0 s: independent. One live collision is worth naming —
the coat uses `sin((t/1.9)TAU + 0.6)` and the branch's slow bend is 1.9 s too; different phases (0.6 vs `seed*2.3`) keep
them from reading as a loop, but if the coat and the tree ever breathe together in review, the coat's clock is the line to change.

## 8 · Worked example: the gust arrives

The cue sheet starts with `gust arrives` at 1.2 s. In the picture the same envelope does this:

- **1.0 s — grass.** `AMBIENT.gust` rises 0.555 → 0.885 between 0 and 1.0 s; `at(t,x,z)` puts the crest on a different
  blade at a different moment, and each blade bends inside the same frame, because the field reads the gust at `t`.
- **1.2 s — branches.** `branchSway` reads `gust(t − 0.18·stiffness)`: heavy limbs 0.18 s after the grass, the
  stiffness-2.097 tips at 0.38 s. The tree answers a beat later, and its outer twigs later still.
- **1.2 s → 8.6 s — clouds.** They do not answer at all: the 57 s and 23 s drifts keep crossing (479 px of low cloud in
  W1) and never respond to the gust — the field reacts, the sky does not, and that contrast is what makes air feel large.
- **Light.** `exposureDrift` measures 0.971 at 0 s, 0.962 at 1 s and 0.964 at 4 s; the gust's own term is `−0.02 × gust`,
  so the field darkens by ~1.8 % at the gust's peak. Visible in a side-by-side, which is the correct amount.

## 9 · What breaks it

| symptom | cause | fix |
|---|---|---|
| the whole frame breathes together | one `Math.sin(t)` drives several elements | give each element its own period and a spatial phase |
| grass like a curtain | every blade shares a phase | phase from world x/z, never from the blade index |
| a tree like a metronome | one sine per branch, no tremor, no stiffness | slow bend + fast tremor + stiffness-scaled gain and lag |
| clouds that answer the gust | the cloud drift was multiplied by `gust()` | clouds keep their own clocks; the gust never touches the sky |
