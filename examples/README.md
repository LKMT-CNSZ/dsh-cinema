# Examples

Two films, both produced with the code in `../template`, both with their documents and review artefacts. They are the
evidence that the system works, and they double as regression cases.

| example | length | route | what it demonstrates | QA |
|---|---|---|---|---|
| [`wind-past-the-piano/`](wind-past-the-piano/) | 12.000 s, 24 fps | 2.5D plates + local 3D | the 2.5D route: four depth planes, a match cut on the horizon, a figure that does not act, a wind-driven sound design | P0 = 0, P1 = 0, P2 = 0 |
| [`piano-in-the-field/`](piano-in-the-field/) | 12.000 s, 24 fps | full 3D (previous route) | the earlier 3D film, kept as a regression case: `--film=piano` still renders and still passes the same sweep | P0 = 0, P1 = 0, P2 = 0 |

Each folder holds:

- `README.md` — what to look at, and how to reproduce it
- `CREATIVE_BIBLE.md`, `STORYBOARD.md`, `SHOT_LIST.md` — the production documents that produced the film
- `QA_REPORT.md` — the generated sweep report, including any defect left open
- `stills/` — contact sheet, motion strips, 1:1 crops, first and last frame

## A note on what is *not* here

The project's published directory plan suggested three examples (`panoramic-landscape`, `experimental-film`,
`wind-installation`). Those would be new films, and a film is not an example until it has been rendered and reviewed; a
placeholder folder with a README would be exactly the kind of claim this project refuses to make. The two films above cover
the panoramic/2.5D direction and the 3D regression; a genuinely experimental, non-narrative study and a moving-installation
piece are the next candidates, and `CONTRIBUTING.md` says what an example has to contain before it is listed here.

To try the system yourself without producing a film first:

```bash
cd ../template
node scripts/scan.mjs 2.0,9.0 --film=wind     # what a frame costs, and whether anything hangs
node render.mjs --stills=2.0,9.0 --film=wind  # two frames, about a second each
```
