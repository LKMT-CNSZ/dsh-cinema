# AGENTS.md — guidance for AI agents working *on* DSH Cinema

This file is for an agent modifying this repository. It is not the skill: the skill is `SKILL.md`, which is what an agent
loads when a user asks for a film. Read `SKILL.md` first; this file only says how to change it safely.

## Ground rules

1. **Never break the reference film.** `template/` contains two complete films. Before and after any engine change:
   ```bash
   cd template
   node render.mjs --qa --out=out/qa --film=wind     # P0 and P1 must be 0
   node render.mjs --stills=2.0,9.0 --film=wind      # and you must open the stills
   ```
2. **Every frame is a pure function of time.** No cross-frame state, no unseeded randomness. If a change needs memory
   between frames, it is the wrong change.
3. **The budget is a contract.** If a change makes a shot draw more, update that shot's `budget` from the measured numbers
   (`node scripts/scan.mjs <t> --film=wind`), or reduce the drawing.
4. **Never claim a capability in a document that the engine does not have.** The *Honest limits* section of `SKILL.md` is
   part of the contract; add to it when you find another limit.
5. **Frontmatter is a fixed vocabulary.** DSH accepts `name`, `description`, `whenToUse`, `disable-model-invocation`,
   `user-invocable` and a `metadata` object. Anything else (`allowed-tools`, `argument-hint`, `modelInvocable`, …) is either
   ignored or rejected — a rejected frontmatter makes the skill disappear from the catalog without an error in chat.
6. **UTF-8 without BOM.** A BOM on `SKILL.md` silently drops the skill. `scripts/render-check.mjs` fails on it.

## The loop for a content change

- New reference or template: add the file, mention it in `SKILL.md` (the mention is how an agent finds it), and run
  `node scripts/render-check.mjs`.
- New shot or world element: add it to a film, declare its budget, render stills, look at them, then the QA sweep.
- Renaming anything: `git grep` the old string first. `SKILL.md` and `README.md` must never disagree about a file path.

## What not to do

- Do not add a dependency to `template/package.json` without a reason stated in the commit (the whole system runs on
  `puppeteer-core` alone).
- Do not commit `node_modules/`, `out/`, rendered frames or audio. `.gitignore` covers them.
- Do not "improve" the look without re-running the QA sweep: a nicer frame that breaks the horizon rule is a regression.
- Do not write marketing claims into `README.md` that the `examples/` folder does not demonstrate.
