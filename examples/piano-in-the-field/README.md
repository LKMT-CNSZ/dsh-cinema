# documentary-scene — the reference film, as evidence

This folder is the worked example the skill was built from and tested on: *The Piano in the Field*, 12 s, 5 shots,
24 fps, 1920×1080, rendered entirely from code. It is not a separate code base — the runnable project is
`../../template/` (and any project scaffolded from it).

## What is here

| file | what it is |
|---|---|
| `CREATIVE_BIBLE.md` | the plan: story, theme, metaphor, world, colour arc, emotional curve, sound |
| `STORYBOARD.md` | the five shots with timed reads, camera, light and action |
| `SHOT_LIST.md` | the production table, the timing budget, the parameters in code shape, the cue sheet |
| `QA_REPORT.md` | the human QA document: measurements, issues by level, review log, verdict |
| `08-generated-qa-report.md` / `.json` | the raw output of `node render.mjs --qa` for all 288 frames |
| `stills/` | the review images: contact sheet, motion strips, 1:1 details, and the defects found during the build |

## Run it

```bash
node ~/.dsh/skills/dsh-cinema/scripts/new_project.mjs my-film --keep-demo
cd my-film
node render.mjs --sheet=0.5,1.7,2.7,4.6,7.0,9.4,11.1 --cols=4 --w=520 --out=out/check/film.jpg
node audio/score.mjs
ffmpeg -y -i audio/score.wav -af "highpass=f=28,loudnorm=I=-19:TP=-1.5:LRA=9" -c:a aac -b:a 192k assets/score.m4a
node render.mjs --frames --workers=4 && node render.mjs --encode --audio=assets/score.m4a --out=out/film.mp4
```

`--keep-demo` keeps the five shots and the world registries; without it you get the engine and one empty first shot.

## Why this scene is the regression test

The film deliberately contains the objects and the shot grammar that produced the known defects in an earlier procedural
music video, so the skill can be judged against them rather than against a blank page:

| known defect (November Rain MV) | what this scene does about it | where it is verified |
|---|---|---|
| characters clipping into props / each other | one skeleton, one coat shell, contacts solved by IK correction; nothing intersects by construction | `QA_REPORT.md` §4, `woman.key-contact` probe |
| unstable body proportions | bone lengths are constants; QA compares every bone every frame | `bone length drift` probe, P0 |
| broken bird wings | a two-bone wing with a tapered chord and primaries, folded by rotating the bones; perched / takeoff / flight states | `stills/09-bird-takeoff-strip.jpg` |
| the bird generated twice | one registry entry, one draw call; `single instance` probe | `QA_REPORT.md` §4 |
| house/tree/piano/candle discontinuous between shots | one `FIELD` layout, one prop per registry entry, geometry cached at boot, one sun direction | `references/continuity.md`, preflight |
| repeated shots | the sweep compares shot statistics and flags near-identical pairs | `scripts/qa.mjs` `repeatSigDiff` |
| opening and ending not linked | S5 re-frames S1 with the bird gone and the light colder | `stills/01-film-contact-sheet.jpg` |
| lens-flare overuse | no flare exists in the engine; the sun is a disc and a wide halo, and it is behind the field for the whole film | `references/visual-language.md` |
| stiff motion | anticipation, arcs, per-joint overlap, foot locking, secondary coat/hair motion, contact correction | `stills/02-walk-strip.jpg`, `03-key-press-strip.jpg` |

## What this scene does NOT prove

A silhouette figure with no facial performance, a 12-second duration, and a single exterior location. Longer films, more
characters and closer framing will find the edges of the engine: read the limits section of `SKILL.md` before promising a
client a close-up of a face.

