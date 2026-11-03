# DSH Cinema

**DSH 电影艺术创作** · a DSH skill for making films with code.

Code is the camera, the brush and the edit. Every pixel is drawn, every sound is synthesised, every frame is a function of
time — no AI image generation, no stock footage, no licensed music.

```bash
# one command to install (Windows PowerShell)
pwsh -File scripts/install.ps1
```

Then in DSH: type `/dsh-cinema`, or just describe the film you want — the skill routes itself.

---

## What it makes

| direction | what you get |
|---|---|
| avant-garde / modern-art short | one idea per shot, negatives that carry meaning, a single surreal element with a job |
| 2D / 2.5D experimental film | painted plates placed at depths in a metric world — 2D detail with real parallax |
| procedural music video | the timeline, the edit and the mix are code; sound is synthesised, never licensed |
| documentary-photographic image | one sun, true colour, a horizon that is measured rather than eyeballed |
| minimalist visual art | large negative space, detail concentrated where the eye is |
| surrealist short | restraint by rule: nothing floats that has no narrative work to do |
| conceptual-art video | the film states a proposition and refuses the rest |
| moving installation | long takes, slow clocks, no beat to cut to |

**Not** for: ordinary documents, email, spreadsheets, unrelated programming.

## The idea

A painted 3D box gives you perspective and nothing else. Making a house read as a house in 3D means adding modelling,
materials, roof courses, window reveals — all geometry, which is slow, hard to art-direct and collapses into "low-poly" as
soon as the budget runs out. A painted house gets 60 marks of detail for the cost of 60 strokes, and the marks are authored,
not simulated.

So the system does the one thing 2D cannot do itself: it places each painting at a **depth in a metric world** and projects
it through the same pinhole camera as the local 3D. Parallax, dolly, occlusion and scale then behave correctly while the
artwork stays 2D. That is the whole architecture.

## Technical architecture

Four tiers, in priority order. A shot picks the simplest one that gives the highest image.

| tier | role | code |
|---|---|---|
| 1. Canvas 2D paint | the default for everything: silhouettes, buildings, vegetation, props, textures, light and shadow | `template/src/engine/materials.js`, `renderer.js` |
| 2. 2.5D plates | the main spatial tool: foreground / mid / background planes, parallax, dolly, occlusion | `template/src/engine/layers.js`, `template/src/world/panorama.js` |
| 3. local 3D | only where 2D cannot go: a piano seen from any angle, a silhouette figure with IK feet, cast shadows, the ground plane | `engine/props.js`, `engine/character.js` |
| 4. WebGL / GLSL / Three.js | only when a shot truly needs the GPU (water, rain, volumetric fog, reflections). Documented, not exercised by the reference film — and the reason is written down | `references/2.5d-scene-system.md` |

Everything is deterministic: a frame is a pure function of time, so frames can be rendered in parallel, out of order, and
re-rendered alone. Rendering is headless Chrome; encoding and muxing are FFmpeg; the mix is synthesised with plain
JavaScript (SVF-filtered noise, additive partials, a Schroeder reverb) and written as a WAV.

```
audio/*.mjs  ──► score.wav ──► ffmpeg ─┐
template/src/**  ──► studio.html ──► Chrome ──► frames ──┴──► film.mp4
                                              QA sweep ──► QA_REPORT.md
```

## What makes it more than a renderer

- **A measurable complexity budget.** Every shot declares eight quantities (plate marks, 3D surfaces, movers, materials,
  plates, figures, contact events, camera behaviours). QA measures them every frame: 1.2× over is P2, 2× is P1. Over budget
  means split the shot, never lower the drawing quality of everything else.
- **A quality sweep with rules that have all fired.** Blank frames, NaN, camera jumps, sun drift, held frames, repeated
  signatures, budget overruns, parallax reversal, horizon jumps at a cut, near-field detail density, noisy skies.
- **A wind field with no shared periods.** Grass at 1.3 s, a branch at 1.9 s with a 0.73 s tremor, clouds on 57 s, light on
  37 s. No two things share a clock, so the frame never reads as a loop.
- **Honest limits, in the skill itself.** Faces, precise fingers, multi-person interaction and complex prop manipulation are
  not production capabilities. The skill says so instead of discovering it in shot six.

## Install

Requirements: **Node 20+**, **Chrome**, **FFmpeg** on `PATH`, and a DSH installation. Windows is the reference environment;
Linux and macOS render fine, the installers are PowerShell.

```powershell
# 1. get the repository
git clone https://github.com/LKMT-CNSZ/dsh-cinema
cd dsh-cinema

# 2. install into the DSH user skills directory (~/.dsh/skills/dsh-cinema)
pwsh -File scripts/install.ps1

# 3. verify
node "$env:DSH_HOME\skills\dsh-cinema\scripts\preflight.mjs" --skill
```

The installer copies the tree (without `node_modules`, `out/` and `.git`), strips UTF-8 BOMs (a BOM makes DSH drop the skill
silently), backs up any existing install to `skills\.backup\dsh-cinema-<timestamp>`, and verifies the result.

```powershell
pwsh -File scripts/install.ps1 -Force      # replace an existing install (backed up first)
pwsh -File scripts/install.ps1 -Repo       # clone from GitHub instead of copying this checkout
pwsh -File scripts/update.ps1 -DryRun      # show what an update would change
pwsh -File scripts/update.ps1              # update, with a backup
```

## Invocation

**Automatic.** The skill's `description` and `whenToUse` are the routing contract. When a task is about making, editing,
reviewing or fixing a code-generated film, animation, music video, visual study, shot list or render, DSH loads it before
planning. This is model judgement on the catalog text — not a hard-coded trigger — and the text is written to make that
judgement reliably.

**Manual.** Type `/dsh-cinema` in the composer, or pick *dsh-cinema* from the `/` menu. DSH sends the literal token and the
host loads the skill for that turn.

Once loaded, a project starts like this:

```bash
cd "$env:DSH_HOME\skills\dsh-cinema"
node scripts/new_project.mjs my-film      # a complete, runnable film project
cd my-film; npm install
node render.mjs --stills=2.0 --film=wind  # look at a frame before rendering 288
node render.mjs --frames --workers=4 --film=wind
node render.mjs --qa --out=out/qa --film=wind
node render.mjs --encode --audio=assets/score.m4a --out=out/film.mp4 --film=wind
```

## Update

```powershell
pwsh -File scripts/update.ps1              # copy a newer checkout over the installed skill
pwsh -File scripts/update.ps1 -Repo        # or git pull, if you installed with -Repo
```

`update.ps1` never deletes files that exist only in the destination — a shot or reference you added survives. It prints
what would change with `-DryRun` and keeps a timestamped backup.

## Examples

| film | route | length |
|---|---|---|
| [《风经过钢琴》/ *Wind Past the Piano*](examples/wind-past-the-piano/) | 2.5D plates + local 3D, one match cut | 12.000 s |
| [*The Piano in the Field*](examples/piano-in-the-field/) | the previous full-3D route, kept as a regression case | 12.000 s |

Each folder has its creative bible, storyboard, shot list with declared budgets, the generated QA report, and the stills that
were actually reviewed (contact sheet, motion strips, 1:1 crops, first and last frame). See [`examples/README.md`](examples/README.md).

## Documentation

| document | what it is |
|---|---|
| [`SKILL.md`](SKILL.md) | the skill contract: tiers, workflow, rules, engine map, limits |
| [`references/`](references/) | 15 normative documents (composition, materials, motion, continuity, sound, QA, budget, detail density) |
| [`templates/`](templates/) | 5 fill-in production documents (bible, storyboard, shot list, shot spec, QA report) |
| [`template/`](template/) | a complete, runnable project: engine, world, two films, renderer, audio, QA |
| [`AGENTS.md`](AGENTS.md) | how an agent should change *this repository* |

## FAQ

**Is any of this AI-generated imagery?** No. No image or video model is involved. Every frame is drawn by JavaScript on a
canvas; every sound is synthesised from oscillators and noise.

**Do I need a GPU?** No. Canvas 2D on the CPU is the default; Chrome may use the GPU to composite. The 2.5D route exists
partly because it renders fast without one.

**Why does the skill say it cannot draw faces?** Because it cannot. The figure is a silhouette with an 11-joint rig. If a film
needs a face, it is the wrong shot for this system — and the skill tells you that up front instead of failing at frame 200.

**The film renders but looks flat — what first?** Open `references/panoramic-composition.md` and check the ten properties.
The two usual culprits are a foreground plate that is too far from the lens and a horizon with no treeline or haze on it.

**A frame hangs.** `node scripts/scan.mjs <t> --film=wind` finds which time, `node scripts/opscan.mjs <t> --film=wind` finds
the exact draw command. Two real hangs were found that way; the guards are documented in `references/technical-qa.md`.

**How do I remove it?**

```powershell
Remove-Item "$env:DSH_HOME\skills\dsh-cinema" -Recurse -Force
```

## Known limitations

- Figures are silhouettes: no faces, no fingers below ~34 px of palm width, no multi-person interaction.
- Depth of field is four blurred bands, not a lens model.
- The painter's algorithm cannot resolve interpenetrating geometry: a plate never passes through a 3D object.
- A 2.5D plate is a billboard; a wall meant to be seen at an angle needs its own `tilt`/`yaw` or must be local 3D.
- Aerial perspective is a mix toward one haze colour, so a very long lens at a very long distance is a tint, not physics.
- The reference film leaves a visible tonal seam where the 3D ground's haze band meets the treeline plate; it is listed in
  its QA report as an open defect rather than hidden.
- The WebGL / Three.js tier is documented but not exercised by the reference film; do not treat its output as tested.

## Licence

MIT — see [`LICENSE`](LICENSE). Third-party components and artistic references are listed in [`NOTICE`](NOTICE).

This project was previously published as `documentary-code-cinema`; the rename is recorded in [`CHANGELOG.md`](CHANGELOG.md).
