# Directing

How to decide what the film is about, what each shot is for, and what the viewer is given time to read — all of it written down before a single line of shot code exists.

## 1. The one-sentence film

Write it in this shape: **`<someone> <does one physical act> in <a specific place>, and <a small event> takes <the thing> away.`**

- Reference: *A woman walks into a field to play one note on a grand piano, and a bird on the open lid leaves before the note has finished.*
- Rules: ≤ 30 words; contains a place, one act and a loss; no mood adjectives; no "about". If the sentence needs the word "about" to work, the film is an essay, not a film.
- Put it verbatim at the top of `CREATIVE_BIBLE.md`, in `SHOT_LIST.md`, and in the shot file header. Do not edit it after shot 1 is coded: a logline that changes at shot 3 means shots 1–2 were built for a different film.

## 2. Theme becomes a physical motif

A theme ("distance", "the world outliving the action") cannot be photographed. Convert it into one object or one measurable physical fact, and let the film carry only that.

- The motif must be something that already exists as a registered thing — a prop id (`defineThing('prop', 'piano', …)`), or a property of one you can measure: the lid's `lidAngle: 34`, the key's 6 mm travel, the candle still burning at 12.0 s.
- It must appear in at least 4 of 5 shots, be visible before the turn and after it, and never be explained by a character or a caption.
- If the motif is not in `FIELD`, it does not exist. A motif you cannot place in metres is a mood, not a motif.

## 3. Three beats inside 8–15 s

| beat | share | reference times | function | what must be true when it ends |
|---|---|---|---|---|
| arrival | 0–25% | 0.00–2.90 (24%) | someone enters a place the film has already shown empty | she is at the instrument |
| the act | 25–75% | 2.90–8.90 (50%) | one action, with one contact, and its consequence | the act is over; the consequence has started |
| consequence | 75–100% | 8.90–12.00 (26%) | the place answers, without the actor doing anything | the place is shown changed |

- Exactly three beats. A fourth beat is a fourth shot and at least three more seconds.
- For 8 s: 2 / 4 / 2. For 15 s: 3.75 / 7.5 / 3.75. The middle beat is never less than 45% of the runtime — the act is what the film is.
- The consequence must contain something *absent* that was present in the arrival (the bird, in the reference). "Nothing happens at the end" is not a beat; absence is.

## 4. The emotional curve

Write it as a table of times and states, one state per row, before designing any frame. At most four states; each state is a change in what the viewer *knows*, not a change of camera.

| t (s) | state | what the frame does |
|---|---|---|
| 0.0–0.6 | noticing | fade in from black over 0.55 s on a still wide; only grass moves |
| 0.6–2.3 | approach | the figure walks in from 0.07 W to 0.44 W; camera locked off |
| 2.3–2.9 | settling | she stops and turns; cut at 2.90 |
| 2.9–4.2 | intent | dolly in; focus moves from her back to the keys |
| 4.2–4.6 | contact | one key 6 mm down; nothing else moves for 0.4 s |
| 4.6–6.1 | release | she withdraws; the note continues; held frame |
| 6.1–8.9 | aftermath | close-up; dust; the note dies |
| 8.9–10.6 | departure | the bird leaves; the camera tilts with it |
| 10.6–12.0 | absence | closing wide, the bird is gone; fade 0.45 s |

- The curve needs one flat segment of at least 1.4 s (here S5) and one short segment of about 0.4 s (the contact). A curve that is uniform in pace is a slideshow.
- If two adjacent rows have the same state, they are one row and one read.

## 5. Staging a shot: three questions, answered in writing

1. **Subject** — exactly one: a registered id (`woman`, `piano`, `bird`, `candle`). Two subjects means two shots.
2. **Where the eye lands first** — a screen position, plus the reason it lands there. Reference: S1, the bird on the open lid at 0.60 W / 0.33 H — the only shape in the upper third, the only one with air around it, and the only one above the horizon line.
3. **What the frame must say if held** — one sentence the still must support ("a piano has been left in a field for a long time").

If the three answers contradict — subject is the hand, eye lands on the candle, the frame says "a field" — restage. Do not add light, blur or a second prop to fix it.

## 6. Every shot needs an event

An event is a change of state nameable in one phrase with a before and an after: *the key goes down*, *the hand withdraws*, *the bird leaves*, *the bird is not there*.

- The event must be readable in one held frame at its peak. Render the peak, show it to someone who has not read the bible, and ask what changed. If the answer needs the previous frame, it is a transition, not an event.
- Forbidden: shots that only describe ("she stands at the piano") — that is coverage for another shot's event; a reaction shot with no preceding event; two events in one shot.
- Count them: five shots, one event each. S1 she arrives; S2 one key goes down; S3 the note dies; S4 the bird leaves; S5 the bird is absent and nothing replaces it.

## 7. Time for the viewer: the reads

Every shot declares what the viewer is given time to see, as a list of timed reads in `meta.reads`. The list is published into the QA report by `shotMeta()`, so the document and the film cannot drift apart.

```js
shot({
  id: 'S3', start: 6.10, dur: 2.80,
  meta: {
    scene: 'piano keyboard raking to the candle, close-up', size: 'close-up', lens: '60mm f/2.0',
    motion: 'locked off, holding', transition: 'cut on the release of the key',
    reads: ['6.1-6.6 the keys, raking away from the lens', '6.6-7.4 the candle at the far end of the keyboard',
      '7.4-8.4 dust in the low light; the note is still going', '8.4-8.9 the flame moves; the flame leans, nothing else moves'],
  },
  light(lt) { /* one rig, §visual-language */ },
  cam: (lt) => getThing('camera', 's3')(lt),
  draw({ t }) { /* field, woman, bird, dust */ },
});
```

- Rules measured from the reference film: 3–5 reads per shot; each read 0.3–1.0 s (7–24 frames); reads tile the shot — they may touch, they may not overlap; the first read starts at the shot's first frame; 20 reads cover 12.0 s, average 0.60 s.
- One read at a time. If two things must be understood together, that is one read written as one line.
- Write reads in **film time**, to one decimal, in the same `"6.1-6.6 the thing"` shape as above, so a person can check them against the timeline by eye.
- A read is something to *see*, not a line of dialogue, an emotion, or an intention. "she is sad" is not a read; "her hand is still on the key" is.
- The last read of a shot ends on the shot's last frame — that is what "cut at the end of a read" means. Cutting mid-read costs the viewer the thing the shot existed for.

## 8. `CREATIVE_BIBLE.md`: required sections

One page, ≤ 60 lines, every section present, no "TBD". In this order:

1. **Logline** — §1, verbatim.
2. **Story core** — what happens, three lines, with the beat times from §3.
3. **Theme** — one abstract sentence, the one you refuse to film literally.
4. **Physical motif** — the object and its registry id, per §2.
5. **Characters** — one entry per `defineThing('character', …)` entry: height (1.64 m), build read, coat, what they want in these few seconds.
6. **World** — the place in one paragraph, then the `FIELD` entries with metres (piano at 0.30, 0.40; house at −11.5, 26.0; tree at 6.6, 14.5; bird perch at 0.851, 1.778, 0.211). The bible may not contain a position that is not in `FIELD`.
7. **Visual motif** — the single image the film should be remembered by, with the frame it is in.
8. **Emotional curve** — the table from §4.
9. **Look** — light preset, sun elevation, contrast, grain, the lens set, the horizon heights.
10. **Colour arc** — three swatches in hex at 0 s / midpoint / end, e.g. `#b48a5e` → `#8a7a68` → `#4a4a52`, with the scene each belongs to.
11. **Sound direction** — beds, the foley that marks contact, the one silence, each with a cue time.
12. **Forbidden** — five lines naming what this film must not become.

An empty section is a decision not yet made. Stop and make it.

## 9. Worked example: the piano, the woman, the bird

| element | id / position | what it is for | seen |
|---|---|---|---|
| the piano | `FIELD.piano` at (0.30, 0.40), yaw −12 | the impossible object and the instrument; the place's fact | 5 of 5 shots |
| the woman | `character:woman`, 1.64 m, walks 3.10 m in three 1.03 m strides from (−3.02, 2.40) to (0.02, 1.78) | the act: one key, pressed at 4.22 and released at 4.62 | 5 of 5 shots |
| the bird | `FIELD.birdPerch` at 0.851, 1.778, 0.211 | the consequence: it waits, crouches at 8.76, is gone by 10.45 | 4 of 5 shots (absent in S5) |

- Three elements, three beats, no fourth. The piano states the place in the arrival; the woman's single key *is* the act; the bird's leaving is the only thing the film gives away.
- Test the story by removal: if the bird were cut, the film would still be a woman at a piano, so the bird is not decoration — it carries the last beat. If the piano were cut, the film would have no impossibility left. If the woman were cut, nothing would happen.
- Keep the staging disciplined: nobody is named, nothing is explained, no one looks at the lens, and only one thing leaves the frame under its own power. The bird is that thing, and its one event is spent on 1.7 s of screen time.


## 2.5D update — directing under a complexity budget

### Choose scenes this system can finish

The promise is a few kinds of scene done finely: wild field, coast, town edge, road, old house, abandoned structure, outdoor
installation, minimal interior, sky and horizon. A scene that needs crowds, faces, hands in close-up or interpenetrating
machinery is not in scope — say so in the bible rather than discovering it in shot 6.

### The budget is a directing decision

Before the shot list, ask how much the film can afford per frame. The eight quantities (`plateFills`, `surfaces3d`,
`movers`, `materials`, `layers`, `figures`, `interactions`, `cameraMoves`) are declared per shot and measured by QA.
When a scene wants more, the director's options are, in order:

1. **split the shot** — a wide and a closer shot are usually a better film than one crowded wide;
2. **simplify the expression** — one house that is properly drawn beats a house plus twelve rough props;
3. **move detail to the near plane**, where the eye actually is;
4. **cut the element** — if it is not carrying a read, it is not in the film.

Lowering the drawing quality of everything to fit one more object is never an option.

### The shot must have a read

Every shot states what the audience learns, in order, as bullet points in `meta.reads`. A shot with no read is a shot that
exists because the renderer can make it. Delete those.

### One subject, one event

One primary subject, one to three secondary elements, and at most one event (a bird crosses, a branch answers). If a shot has
two events, it is two shots - or it is a shot that will not cut.
