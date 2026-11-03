# Creative bible — The Piano in the Field

One page, written before any shot code. If the logline cannot be said in one sentence, stop here and change the idea, not the script. Every number in this document must come from the code that will be written from it: `PROJECT` in `src/config.js`, `FIELD` in `src/world/environment.js`, the presets in `src/engine/lighting.js`, the proportions in `src/engine/character.js`.

## 0 · Spec

| field | value |
|---|---|
| title | The Piano in the Field |
| duration | 12.0 s (`PROJECT.duration`) |
| frame rate | 24 fps (`PROJECT.fps`) |
| frame | 1920 × 1080, 16:9 (`PROJECT.width`, `PROJECT.height`) |
| shots | 5 |
| words in the film | 0 — no dialogue, no voice-over, no titles |
| music | none: the track is effects and one note |

## 1 · Logline

**The Piano in the Field:** A woman walks into a field where a grand piano is standing, presses one key, and the note outlives her attention to it — while the bird on the open lid leaves before the sound does.

**New film:**

## 2 · Theme

**Example:** Attention is a form of care. One note is enough if you stay for its tail. The film is about the difference between making a sound and hearing it out.

**New film:**

## 3 · Metaphor

**Example:** A grand piano standing in a field is an instrument out of its house — a domestic object that has lost its walls and kept its voice. The tail of the note is the persistence of an act after the person who performed it has withdrawn her hand.

**New film:**

## 4 · Characters (with numbers)

Numbers, not adjectives: height, coat, gait, wingspan, case size. These become registry entries and QA probes, so a number written here is a number the film cannot break.

| character | numbers | behaviour | on screen |
|---|---|---|---|
| the woman | height 1.67 m; coat mid-calf, hem 0.46 m above ground, shoulder half-width 0.175 m; stride 1.0342 m per cycle, duty 0.62, arm swing 13°, stance 0.055 m, ankle height 0.075 m | walks 3.10 m in 2.20 s, stops, turns 98° → 168°, presses one key 6 mm, listens, follows the bird with her head | 0.10–12.00 s |
| the bird | wingspan 0.58 m (inner 0.155 + outer 0.135 per side), body 0.26 m | perched without moving; crouches from 8.76 s; leaves at 9.18 s at 4.6 Hz flap | 0.00–10.45 s, then gone |
| the piano | case height 0.94 m, lid open 34°, keyboard key at `keyPoint(0.44)` | never moves | all 5 shots |
| the candle | wax 0.16 m, flame drawn at 0.215 m, the only light close enough to shape the ivories | flickers at 11.3 Hz ±0.14 and 23.1 Hz ±0.07 | all 5 shots |
| | | | |

## 5 · World

| aspect | value |
|---|---|
| place | one open field; a ruined house 26.0 m north and 11.5 m west; a bare tree 14.5 m north, 6.6 m east; stones and 54 grass tufts in the near field |
| time of day | late afternoon, the sun 13.6° above the horizon, direction `vnorm([-0.70, 0.235, 0.67])` — fixed for the whole film |
| weather | clear, dry; one field of air moves the grass, the coat and the hair, and its gust swells 0.55–1.00 (5.2 dB) |
| ground | dry grass (`grassGround`, #5f6440) with stones and tufts; ground at y = 0 |
| horizon | two ranks of bare trees at 52–72 m and 78–98 m, pure silhouette in the haze |
| coordinates | metres, +Y up, ground y = 0, +X east, +Z north, yaw degrees about +Y (0 = facing +Z) |
| light | preset `lategold`: sun colour `[1.0, 0.72, 0.45]`, sky up `[0.16, 0.26, 0.48]`, haze `[0.70, 0.58, 0.44]` at density 0.0068, exposure 0.80 |

## 6 · Visual motif

**Example:** The note is a held frame. The film opens and closes on the same wide from almost the same position (S1 at `(-1.62, 1.38, -6.35)`, S5 at `(-1.86, 1.41, -6.20)` — 0.28 m apart, so the rhyme is recognisable and not a duplicate). The candle is the only warm light close enough to shape the ivories, and it is in every shot. The bird is present in four shots and absent in the fifth: the one prop whose absence is a line of the film. The camera crosses the piano's axis once, between S1 (looking +Z from z = −6.35) and S2 (looking −Z from z = +4.55); what does not change is the sun, the keyboard's facing, and the distance from the lens to the key.

**New film:**

## 7 · Colour arc

| time | palette | light state |
|---|---|---|
| 0.00–0.55 | `#07080c` → field | fade in from black, 0.55 s |
| 0.55–2.90 | deep blue sky, dry olive ground, warm dust haze | `lategold`, sun intensity 1.92 → 2.02 |
| 2.90–6.10 | olive field, lacquer black `#1c1a1a` reflecting the sky, ivory `#f2ead4` | sun 2.02, candle point 0.95 |
| 6.10–8.90 | ivory, wax `#e3d7bb`, flame `#ffb060`, dust in the low sun | sun 1.86, candle point 2.6 (the brightest practical in the film) |
| 8.90–10.60 | sky again, bird silhouette, gold rim on the piano lid | sun 1.98, candle point 0.34 |
| 10.60–12.00 | the same wide, going down; last 0.45 s to `#07080c` | sun 1.90 → 1.80, then fade out |
| | | |

## 8 · Emotional curve

| time | state | what the viewer feels |
|---|---|---|
| 0.0–1.0 | observation | this is a place, not a story |
| 1.0–2.9 | approach | expectancy: someone is coming and is in no hurry |
| 2.9–4.2 | preparation | attention tightening onto a hand |
| 4.2–4.6 | contact | the small shock of a real action |
| 4.6–8.4 | decay | permission to sit still; nothing is being asked of you |
| 8.4–10.6 | departure | a loss, small and exact |
| 10.6–12.0 | return | the place again, changed by the note and not by the camera |
| | | |

## 9 · Sound direction

No music, one continuous wind bed with gusts and a thin high layer, six footsteps close and dry on grass, cloth on the arm, one key press in three parts (touch, wooden knock, note), one F#3 with eleven partials and a 7.4 s tail, seven wingbeats receding to frame left, two distant chirps before the note and two after the bird. The air is ducked 11.1 dB from 4.15 to 4.75 s so the note has a silence to arrive in. Reverb is a small dark room on the note and the birds only; the footsteps stay dry. Every sound has a distance, and no two sounds share one. Delivery at −19 LUFS.

**New film:**

## 10 · Look reference — the three rules that must survive

1. **One sun.** Every shot calls `lightUse('lategold')` and the sun direction is a film constant `vnorm([-0.70, 0.235, 0.67])`. A cut that changes it by more than 0.035° is a P1 in `scripts/qa.mjs`. Sun intensity may change per shot (1.86–2.02); direction and colour may not.
2. **One world in metres.** Every position lives in `FIELD`; a camera move is a position moved towards a subject, and parallax is geometry. Inside a shot the camera may not move more than 0.16 m, turn more than 4.5° or change focal length by more than 1.5 mm between adjacent frames (P0).
3. **The print is restrained.** Grain 0.055, gate vignette 0.3, halation only on the brightest values, no lens flares, no RGB split, no slow motion, no beat-locked movement. A frame whose edge energy exceeds 95 is reported as busy (P2) — texture pretending to be detail is the same defect as noise pretending to be grain.

**New film:** the three rules this film cannot break, with the number that catches each one.

## 11 · Explicitly out of scope

- No facial acting. The figure is a backlit silhouette: coat, bun, boots, hands when they resolve. Shots that need a face are re-staged as hands, objects or light.
- No dialogue, no voice-over, no intertitles, no subtitles, no captions.
- No music, no score, no beat-synced cutting.
- No particle soup, no lens flares, no RGB split, no slow motion, no speed ramps.
- No simulation: every path, spring and pose is closed-form and deterministic. Nothing is left to a solver.
- No interpenetrating geometry. The renderer is a painter's algorithm over convex surfaces; props and figure may occlude but never intersect.
- No second location and no second time of day: one field, one sun, twelve seconds.
- No CG reveal, no impossible camera move, no shot that exists only to show the engine.

**New film:** the things a viewer might expect that this film refuses, and why each refusal is load-bearing.


## The 2.5D production decisions

Fill these in before the shot list; they are the decisions that the rest of the film cannot escape.

| decision | answer | why |
|---|---|---|
| route | | 2.5D plates by default; name anything that must be local 3D and say why |
| the place, in one camera position | | a panorama is a place you can stand in, not a set of shots |
| time of day and sun direction (one for the whole film) | | |
| the wind: strength, direction, what answers it first | | |
| the ambient clocks (what moves, how fast) | | no two elements may share a period |
| depth planes and what lives at each | | adjacent planes at least 2× apart |
| horizon height in frame | | |
| the emptiness: what fraction of the frame is allowed to be sky or field | | and why that emptiness has meaning |
| what is deliberately absent | | the film's negative budget |
| the single surreal element, if any, and what it means | | surrealism without narrative meaning is refused |
