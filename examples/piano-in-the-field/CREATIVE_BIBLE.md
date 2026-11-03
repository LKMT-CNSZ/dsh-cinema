# The Piano in the Field — creative bible (worked example)

Finished, 12 s, 5 shots, 24 fps, 1920×1080. This document is the actual plan the film was built from; the numbers match
`src/world/environment.js`, `src/world/characters.js` and the five shot files.

## Logline

A woman walks to a grand piano abandoned in a late-autumn field, plays one note, and listens to it die; a bird that has
been sitting on the open lid leaves when the sound reaches it.

## Theme

**Sound outlives the people who made it.** Nothing in the film is explained: the evidence is a piano with no house to
belong to, a boarded window, a candle someone left burning, and one note that takes longer to disappear than the action
that made it.

## Metaphor

The piano is the memory (an object too large to remove, still working); the bird is the witness (it waits, it hears, it
goes); the candle is the person who was here before (a practical light with no visible owner).

## Characters

| who | what we see | numbers |
|---|---|---|
| the woman | a silhouette in a long wool coat, hair in a bun, boots, gloves not worn | 1.64 m; coat hem 0.46 m above ground; one performance for the whole film (`womanPose(t)`) |
| the bird | a crow-sized bird on the lid's outer edge | 0.29 m body, 0.58 m spread, perched with folded wings, one takeoff at 9.18 s |
| the field | grass, stones, a bare tree, a treeline on the ring | ground plane y = 0; treeline 52–95 m out |

## World

- **Place**: an open field, flat, five stone blocks and a bare tree; a two-storey house 8.6 × 6.4 m with a dark slate
  roof, a boarded window and a door with no handle; a treeline ringing the field; a grand piano standing in the grass with
  its lid propped open. Coordinates: +Y up, ground at y = 0, +Z north, yaw in degrees. Whole layout in one constant
  (`FIELD`).
- **Time**: late afternoon, the sun low and behind the field (elevation 13.6°, azimuth −46°), so everything facing the
  camera is in shade and the air is bright.
- **Weather**: still, dry, no rain; a light wind crossing left to right, visible in the grass.
- **Ground**: dry late-autumn grass, olive and dun, taller near the lens.

## Visual motif

**One line at a time.** The lid's edge, the treeline, the horizon, the keyboard's front edge: each shot is built around
one diagonal or horizontal line, and the cut changes which line dominates.

## Colour arc

| time | palette | light state | why |
|---|---|---|---|
| 0.0–2.9 | cool grass, pale blue sky, dark masses | late gold, backlit | the place is observed coldly |
| 2.9–6.1 | same, with the lacquer holding a sky reflection | late gold, focus pulled to the keys | the person is introduced by her action, not her face |
| 6.1–8.9 | warm candle against near-black; grass lit from below | late gold + one practical (2.6 intensity, 0.62 m radius) | the note has a temperature |
| 8.9–10.6 | brighter air as the camera tilts into the sky | late gold, same sun | the event is small and the world is large |
| 10.6–12.0 | the same field, a degree colder, fading out | late gold, sun intensity easing −5 % | the place has been changed by what happened in it |

## Emotional curve

| time | state | what the viewer feels |
|---|---|---|
| 0.0–1.0 | distance | curiosity: what is that object doing here |
| 1.0–2.3 | approach | recognition: someone is coming to it |
| 2.3–3.6 | arrival | attention: she is going to touch it |
| 3.6–4.6 | contact | the small shock of a sound in an empty place |
| 4.6–6.1 | listening | held breath |
| 6.1–8.9 | the aftermath | the note is still there; the candle is still burning |
| 8.9–10.6 | departure | the witness leaves |
| 10.6–12.0 | echo | the place without the sound |

## Sound direction

One continuous wind bed (two layers: a gusting low band and a thin high hiss), six footsteps on dry grass, cloth, one
key press as three sounds (touch, wooden knock, note), **one note** (F#3, 11 partials, 7.4 s tail), a real silence
between 4.0 and 4.4 s, wingbeats receding left and up, one distant answering bird. No music, no whooshes, no impacts.

## Look — the three rules that had to survive

1. Every surface is lit by the named sun or by the named candle; shade is sky-coloured, never black.
2. The figure never changes proportions, never floats, never slides: it is a skeleton whose feet are locked to the ground.
3. Nothing in the frame exists to fill it. If a shot has only grass in it, the grass has to be the point.

## Out of scope (decided against, on purpose)

- No music. The film is one note and air; a score would tell the viewer what to feel.
- No close-up of a face. The figure is a silhouette; the face is the one thing this medium cannot do honestly.
- No lens flare, no slow motion, no HDR look, no text, no title cards.
- No second location and no second character: the film's whole budget of attention is one field.
