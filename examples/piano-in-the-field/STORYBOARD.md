# The Piano in the Field — storyboard (worked example)

12.00 s · 24 fps · 1920×1080 · 5 shots · hard cuts, one opening fade, one closing fade. Times are film time.

---

## S1 — the field · 0.00–2.90 (2.90 s) · fade in 0.55 s

**Shot**: wide establishing. **Camera**: 35 mm, locked off on a tripod at (−1.62, 1.38, −6.35) with 2.2 mm breath.
**Light**: late gold, sun behind the field at −46° azimuth, exposure 0.84; the candle is a 0.55-intensity practical in the
grass. **Ground**: dry grass, stones, treeline. **Sound**: wind, six footsteps arriving, a distant bird twice.

| read | time | what the viewer must get |
|---|---|---|
| 1 | 0.0–1.0 | the place: a field, a house too far gone, a tree, and a piano standing in it |
| 2 | 1.0–1.9 | a figure is walking in from the left, and she is walking *to* the piano |
| 3 | 1.9–2.5 | the bird on the open lid, watching her |
| 4 | 2.5–2.9 | she arrives at the keyboard |

**Action**: the walk is three strides over 3.08 m (stride 1.03 m), then one settle step; she turns to the piano hips first,
chest 80 ms later, head 200 ms later. **Environment**: grass moves in the shared wind, the bird's head turns in two steps.
**Narrative job**: state the proposition — this object does not belong here, and someone is coming to use it.

---

## S2 — over her shoulder · 2.90–6.10 (3.20 s) · hard cut

**Shot**: medium, over her left shoulder onto the keyboard. **Camera**: 50 mm at f/2.4, dolly in 1.1 m from
(3.05, 1.56, 3.62) to (2.28, 1.43, 2.78), focus pulls 3.85 → 2.75 m. **Light**: late gold + candle at 0.95. **Sound**:
cloth, the key press (touch, knock, note at 4.235), the release, the wind ducked away for the contact.

| read | time | what the viewer must get |
|---|---|---|
| 1 | 2.9–3.6 | she is at the piano; her left hand settles on the key bed's front edge |
| 2 | 3.6–4.2 | the right hand pulls back, then crosses the gap on an arc |
| 3 | 4.2–4.6 | contact: the fingertip lands on one key and the key goes down |
| 4 | 4.6–5.3 | she releases and withdraws; the note keeps going |
| 5 | 5.3–6.1 | she stands still and listens |

**Action**: anticipation 3.55–3.70 (hand back 3 cm), reach on a Bezier arc 3.70–4.22, contact solved to <3 mm, hold 400 ms,
release, withdraw with an overshoot at 5.18. **Environment**: grass, the candle's flame moves. **Narrative job**: make the
contact physical and give the note a beginning.

---

## S3 — the candle and the keys · 6.10–8.90 (2.80 s) · hard cut on the release

**Shot**: ground-level detail. **Camera**: 60 mm at f/2.0, at (−0.02, 0.505, 2.98) looking at (−0.60, 0.300, 1.50), focus
1.55 m: the piano's front leg and caster on the left, the candle in the grass, the keyboard raking above, the treeline
beyond. **Light**: late gold + candle at 2.6. **Sound**: only the note's tail and air.

| read | time | what the viewer must get |
|---|---|---|
| 1 | 6.1–6.7 | we are down in the grass now; the scale has changed |
| 2 | 6.7–7.5 | the candle: someone was here before her |
| 3 | 7.5–8.4 | the note is still going; nothing else happens |
| 4 | 8.4–8.9 | the flame leans, nothing else moves; she starts to turn (heard, not seen) |

**Environment**: grass leans, the flame flickers at 11.3 Hz with a 23.1 Hz overtone. **Narrative job**: give the sound
somewhere to live, and plant the bird's departure as a sound before it becomes an image.

---

## S4 — the bird leaves · 8.90–10.60 (1.70 s) · hard cut

**Shot**: medium-wide from beside her shoulder. **Camera**: 35 mm at f/2.8 at (3.55, 1.74, 1.15) looking at (0.35, 1.62,
0.55), tilting up 9° between 0.45 and 1.5 s. **Light**: late gold. **Sound**: wingbeats receding left, panned out.

| read | time | what the viewer must get |
|---|---|---|
| 1 | 8.9–9.2 | the bird on the lid, the field behind it |
| 2 | 9.2–9.6 | the crouch, then two power strokes |
| 3 | 9.6–10.3 | it climbs out of frame top left; the camera tilts after it |
| 4 | 10.3–10.6 | her head and shoulders follow, arriving late |

**Action**: the bird's one event (`birdStateAt(t)`); her head tracks it with a 110 ms lag, the chest with a 400 ms lag.
**Narrative job**: the witness leaves; the small event is the film's only plot.

---

## S5 — the field again · 10.60–12.00 (1.40 s) · cut, ends on a 0.45 s fade to black

**Shot**: wide, framed almost as S1 framed it. **Camera**: 35 mm at (−1.86, 1.41, −6.20) looking at (0.50, 1.07, 0.88),
locked off. **Light**: late gold, sun intensity easing down 10 % across the shot. **Sound**: wind returns, then fades.

| read | time | what the viewer must get |
|---|---|---|
| 1 | 10.6–11.2 | the field again, and she is still at the piano |
| 2 | 11.2–11.6 | the bird is gone; the candle is not |
| 3 | 11.6–12.0 | hold, then black |

**Narrative job**: rhyme with the opening, and change one thing: the witness is missing. No black held after the fade.

---

## The film as one movement

```
distance ──► approach ──► contact ──► listening ──► departure ──► echo
   2.9s        3.2s         2.8s         1.7s          1.4s
```

Two fades (in 0.55 s, out 0.45 s), four hard cuts, no dissolves: a documentary cuts, it does not melt.
