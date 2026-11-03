# Contributing to DSH Cinema

Thanks for taking the time. This project is a film-making system, so "it compiles" is not the bar: a change is done when a
frame has been rendered and looked at.

## Before you start

- Read `SKILL.md` (the skill contract), then `references/visual-quality-control.md` (what a reviewer checks).
- Windows is the reference environment: PowerShell 7, Node 20+, Chrome, FFmpeg on PATH. Linux and macOS work for rendering
  but the installers are PowerShell.

## The two kinds of change

**1. Skill text** (`SKILL.md`, `references/*.md`, `templates/*.md`)

- Keep every rule executable: a number, a command, or a named file. "Make it cinematic" is not a contribution.
- If you add a rule, add the check that catches its violation, or say why it cannot be automated.
- Never claim a capability the engine does not have. The *Honest limits* section is part of the contract.

**2. Engine or template** (`template/**`, `scripts/**`)

- Every frame must remain a pure function of time: no cross-frame state, no `Math.random()` without a seed.
- Run the whole loop before opening a PR:

  ```bash
  cd template
  node render.mjs --stills=2.0,6.4 --film=wind     # look at a frame first
  node render.mjs --frames --workers=4 --film=wind
  node render.mjs --qa --out=out/qa --film=wind    # P0 and P1 must both be 0
  node render.mjs --encode --audio=assets/score.m4a --out=out/film.mp4 --film=wind
  ```

- If your change alters a shot's cost, update that shot's `budget` in `src/shots/*.js` from the measured numbers
  (`node scripts/scan.mjs <t> --film=wind` prints them). A budget that is never met is not a budget.
- If a frame hangs, use `scripts/scan.mjs` (which time) and `scripts/opscan.mjs` (which draw command) before touching
  anything else.

## Adding an example

An example is real work, not a placeholder: a produced film, its documents (bible, storyboard, shot list, QA report) and
the stills that prove it was reviewed. Put it in `examples/<name>/` and register it in `examples/README.md` with its
duration, the route it demonstrates and its QA result.

## Commit messages

`type(scope): summary` — e.g. `fix(engine): clamp ground shadows crossing the lens`, `docs(references): add panorama depth
spacing rule`. One logical change per commit.

## Versioning

Semantic Versioning. `CHANGELOG.md` gets an entry in the same commit as the change. A release tag is `vX.Y.Z` and only after
`scripts/render-check.mjs` and the QA sweep pass.

## Licence

Contributions are accepted under the MIT licence in `LICENSE`. By opening a pull request you confirm you wrote the code, or
that it is compatible with MIT and attributed in `NOTICE`.
