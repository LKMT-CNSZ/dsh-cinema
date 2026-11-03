# Changelog

All notable changes to DSH Cinema are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Nothing yet.

## [1.0.0] — 2026-11-03

First public release. This version is the 2.5D rewrite of the earlier `documentary-code-cinema` skill; the 3D film is kept
as a regression case rather than removed.

### Renamed

- Project and skill renamed `documentary-code-cinema` → **`dsh-cinema`** (display name *DSH Cinema*, 中文名 *DSH 电影艺术创作*).
  Install directory is now `~/.dsh/skills/dsh-cinema/`; invocation is `/dsh-cinema`. The engine, materials, camera, rig,
  audio and QA modules are unchanged by the rename.

### Added — 2.5D production system

- `engine/layers.js`: depth-placed 2D plates (`definePlate`, `plateBegin/End`, `plateFill/Line/Detail`, `plateRect/Ellipse/
  Ridge`, `plateScreen`, `PLATE_LAYERS`) — painted detail in metres, projected through the same pinhole camera as the 3D.
- `engine/ambient.js`: one wind field with element periods that never coincide (grass 1.3 s, branch 1.9 s + 0.73 s tremor,
  clouds 57 s + 23 s, light 37 s), dust motes and a single bird crossing.
- `engine/budget.js`: the scene complexity budget — eight declared quantities, measured every frame, P2 at 1.2× and P1 at 2×.
- Painted cloud forms and a horizon haze band in `engine/sky.js`; a new `wheat` material and per-material texture rules.
- `scripts/scan.mjs` and `scripts/opscan.mjs`: find a frame — or an exact draw command — that hangs, without rendering the film.
- New references: `2.5d-scene-system.md`, `panoramic-composition.md`, `detail-density.md`, `scene-complexity-budget.md`,
  `environment-animation.md`, `visual-quality-control.md`.
- New QA rules: budget overrun, parallax reversal, horizon jump at a cut, near-field detail density, sky calmness.
- Reference film 《风经过钢琴》 / *Wind Past the Piano*: 12.000 s, 1920×1080, 24 fps, two shots, one match cut, QA P0=P1=P2=0.

### Fixed

- An infinite loop in the stone texture's joint pass when a shape was clipped to zero height (it hung the renderer for
  minutes at particular camera positions).
- Near-plane projection producing million-pixel coordinates that locked Chrome up; all screen coordinates are now clamped.
- Cast shadows crossing the lens: bbox and clip path are clamped, and shadows outside 3× the frame are skipped.
- A "foreground" plate authored 13 m from the lens (it read as a hedge); the engine now rejects a plate closer than 1.1 m.
- A 27.9 px horizon jump at the reference film's match cut: the horizon is now solved in pixels, not in pitch (0.19 px).
- UTF-8 BOMs from PowerShell writes silently dropping the skill from the DSH catalog; `scripts/preflight.mjs` now checks
  frontmatter, and the installer strips BOMs.

### Changed

- `references/character-animation.md`: figures are explicitly A/B level. Faces, precise finger work, multi-person
  interaction and complex prop manipulation are **not** production capabilities.
- `preflight.mjs` validates the film named in `src/config.js` instead of every shot in the project (the project holds two
  films: the 2.5D one and the earlier 3D one).
- `templates/` now ask for the 2.5D facts: layer plan, depth notation, declared budget, 2.5D QA checks.

### Migration from `documentary-code-cinema`

```powershell
# remove the old install, then install dsh-cinema
Remove-Item "$env:DSH_HOME\skills\documentary-code-cinema" -Recurse -Force
git clone https://github.com/LKMT-CNSZ/dsh-cinema "$env:DSH_HOME\skills\dsh-cinema"
```

Projects scaffolded by the old skill keep working: the template API is unchanged, and the old 3D film renders with
`--film=piano`.
