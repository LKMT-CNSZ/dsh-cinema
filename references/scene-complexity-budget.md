# Scene complexity budget

A shot declares what it is about to cost before it is coded, the engine counts what it actually drew, and QA fails the shot when the two disagree — because quality does not decay smoothly with complexity, it falls off a cliff.

## 1 · Why a cliff, not a slope

A ten-metre house with roof courses, sills, one broken pane and damp at its foot reads as a building; the same house plus
a dozen rough props reads as a game. Complexity is therefore not "keep an eye on it": it is a number a shot declares, a
counter the engine runs and a tolerance QA enforces — `BUDGET.begin(cur.def.budget || null)` at the top of the frame,
`BUDGET.finish()` after post comparing the counters and raising P2 (over 1.2×) or P1 (over 2×).

## 2 · The eight things a shot must declare

| declaration | what the frame spends it on | default limit | incremented by |
|---|---|---|---|
| `plateFills` | every op a plate emits: fill, stroked line, clipped detail pass | 260 | counted from `SCENE.ops` at `finish()` (`kind === 'plate'`) |
| `surfaces3d` | every other op: polys, boxes, tubes, ground, shadows, billboards, figure | 120 | the complement of the above |
| `movers` | independently animated things, by name | 6 | `mover('wind')` — a `Set`, so repeats collapse |
| `materials` | distinct plate material ids | 12 | `plateFill` / `plateLine` → `budgetMaterial(matId)` |
| `layers` | distinct 2.5D plates drawn | 7 | `plateBegin(name)` → `budgetLayer(name)`; the five `PLATE_LAYERS` bands are not counted |
| `figures` | people | 1 | `BUDGET.count('figures', 1)` |
| `interactions` | contact events (a hand on a key, a foot on a step) | 1 | `budgetInteraction()` |
| `cameraMoves` | simultaneous camera behaviours (dolly + breath) | 2 | `BUDGET.count('cameraMoves', 1)` — declared, never inferred |

Three things that are easy to get wrong, all visible in the code:

- The declaration is the **top-level `budget` field of `shot()`**, a sibling of `meta`, read back as `s.budget`; a budget
  inside `meta` is never read, and the shot silently runs on the defaults — against which the reference wide shot fails on
  plate marks (946 / 260 = 3.64× → P1) and materials (18 / 12 = 1.50× → P2).
- A declared **0 disables that check** (`finish()` skips a kind whose limit is falsy): `interactions: 0` means "do not
  check", not "zero allowed".

## 3 · The reference film's two budgets, declared and measured

Measured with `scripts/scan.mjs` on this build (W1 at 2.0 s and 4.0 s; W2 at 8.0 s):

| kind | W1 declared | W1 measured | ratio | W2 declared | W2 measured | ratio |
|---|---|---|---|---|---|---|
| `plateFills` | 1000 | 946 | 0.95 | 900 | 718 | 0.80 |
| `surfaces3d` | 170 | 141, 148 with the bird | 0.83–0.87 | 170 | 126 | 0.74 |
| `movers` | 5 | 4, 5 from 3.1 s | 0.80–1.00 | 5 | 4 | 0.80 |
| `materials` | 20 | 18 | 0.90 | 20 | 18 | 0.90 |
| `layers` | 4 | 4 | 1.00 | 4 | 4 | 1.00 |
| `figures` | 1 | 1 | 1.00 | 1 | 1 | 1.00 |
| `interactions` | 0 | 0 | — | 0 | 0 | — |
| `cameraMoves` | 2 | 1 | 0.50 | 1 | 1 | 1.00 |

Two of those lines are the method. **`movers` is a peak, not an average:** W1 registers `light`, `wind`, `clouds`,
`figure.coat` every frame and `bird` only while `AMBIENT.birdCross` returns a position (3.1–8.5 s), so it measures 4 for
most of the shot and 5 in the bird's window. **`cameraMoves` counts declarations, not behaviour:** W1 declares 2 and
counts 1, and only counting more than you declared can overrun, so "1 of 2" is not an error.

Where the plate marks go — same four plates in both shots, only the grass and the bird change:

| plate | marks | what they buy |
|---|---|---|
| `far` — treeline, 460 m wide, 3 ranks + 108 crowns | 111 | a horizon with depth instead of a cut-out row |
| `house` — 10 m façade, 4.35 m wall, 2.45 m roof | 43 | roof courses, sills, a broken pane, eave shadow, damp at the base |
| `tree` — 8.2 m, four limb levels, leaf clusters | 196 | per-limb sway and a crown that is not one silhouette |
| `foreA` — 16 m grass plate, 560 blades (W2's 10 m `foreB`: 368) | 596 | blades that occlude the piano's legs: the subject in the lens's space |

63 % of W1's plate budget is one plate — the right place to spend it (the foreground grass is what makes the shot read as
photographed) and the first place to look when a shot goes over. The local-3D side is one object and one person:
`panoHero()` (piano, figure, both cast shadows, 14 motes) is 140 of the 141 `surfaces3d`.

## 4 · Reading an overrun

| measured / declared | level | what it means | what to do |
|---|---|---|---|
| ≤ 1.20 | none | the declaration is the truth | nothing |
| 1.20 – 2.00 | P2 `budget overrun` | more complex than the shot promised | cut the cheapest detail first (§8), or re-declare from the measured frame and say why |
| > 2.00 | P1 `budget overrun` | the shot was designed without a budget | split it into another shot; do not re-declare a number you never intended |

Exactly 2.00 is P2 (`over > 2`). The issue carries the measured value, the declaration and the ratio, once per frame. The
sweep's `report.json` keeps only pixel statistics per row: the `budget` and `plates` payloads from `qaAnalyze()` are not
persisted, so to read them later, measure again (§9).

## 5 · Estimate before coding

Estimate from measured precedents, not optimism. The reference film's unit costs: treeline 111 marks (0.24 per metre of
skyline), house 43 (4.3 per metre of façade), tree 196 (24 per metre of height), foreground grass 596 (37 per metre of
plate width), and the piano plus figure as one 140-surface local-3D object.

A proposed shot is then arithmetic: a 12 m house (52) + an 8 m tree (192) + 16 m of grass at 520 blades (≈555) + one
piano and one figure (140) = 939 plate marks and 141 surfaces, which fits W1's declaration with 6 % to spare. At 1400
marks the shot is two shots, and no amount of careful painting changes that.

## 6 · Declare it in the shot file

The declaration sits beside `meta`, and the movers are registered where they exist, not in a comment:

```js
shot({
  film: 'wind', id: 'W1', start: 0.00, dur: 7.40,
  budget: { plateFills: 1000, surfaces3d: 170, movers: 5, materials: 20, layers: 4, figures: 1, interactions: 0, cameraMoves: 2 },
  light(lt, t) {
    LIGHT.exposure *= AMBIENT.exposureDrift(t);
    mover('light'); mover('wind'); mover('clouds');
    BUDGET.count('cameraMoves', 1);
  },
  draw({ t }) { panoFar(t); fieldGround(); panoHouse(t); panoTree(t); panoHero(t); panoFore(t, 'foreA'); panoBird(t); },
});
```

`mover()` is a claim that the thing moves on its own clock; registering the bird inside `panoBird()` after its early return is what makes the count follow the bird's presence rather than its code path.

## 7 · The split rule

A shot holds **one primary subject and up to three secondary ones**. W1 is exactly that: the piano and the woman are the
subject, the house, the tree and the treeline are secondary, the grass is the ground they stand on. The moment a fourth
needs to be recognisable, cut to another shot instead — a cut is free, a prop is not.

The house plate is 43 marks and reads as a building; four rough props at 25 marks each cost 100 and read as four rough
props; ten props at 30 marks is 300 — three-quarters of a shot's budget — spent on things nobody will look at. Splitting
is also cheaper than it looks: W2 is the same place cut closer, the bird gone and a smaller grass plate, and it measures
718 plate marks instead of 946 and 126 surfaces instead of 141.

## 8 · What to simplify first

| order | what to cut | why |
|---|---|---|
| 1 | far clutter — extra treeline ranks, crowns, distant windows | the haze eats them; each crown costs a mark and returns a pixel |
| 2 | small props — stones, buckets, a second chair | they read as silhouettes at this scale and cost a plate's worth of marks |
| 3 | background movers — a second bird, a distant sheet | in the far field it is indistinguishable from a still one and still costs a `mover()` |
| — | never the subject's silhouette | the outline is the subject; a crude outline loses the shot |
| — | never the material of the subject | the piano's lacquer mirroring the sky and the coat's wool are the two material events in the film |

Rule of thumb for a plate's own detail: cut what is smaller than ~2 px where it is seen (a 4 mm mark at 40 m on a 32 mm
lens is 0.17 px) and spend the marks on what the lens is 1–4 m from, where 4 mm is 3–7 px.

## 9 · Measure a shot's real cost before QA

`scripts/scan.mjs` renders the frame and prints the engine's own numbers — ops, ms and the measured budget — one line per
time, so a throw or a hang does not stop the scan:

```bash
cd template
node scripts/scan.mjs 2.0,4.0,6.9,8.0 --film=wind
  2.00s  ok   {"ms":979,"ops":1087,"budget":{"plateFills":946,"surfaces3d":141,"movers":4,...}}
  8.00s  ok   {"ms":1668,"ops":844,"budget":{"plateFills":718,"surfaces3d":126,"movers":4,...}}
```

To split a total by plate, count what each plate painter appends to the frame's op queue:

```bash
node scripts/probe.mjs "(()=>{drawFrame(2.0);const c=f=>{const b=SCENE.ops.length;f();return SCENE.ops.length-b};return {far:c(()=>panoFar(2.0)),house:c(()=>panoHouse(2.0)),tree:c(()=>panoTree(2.0)),foreA:c(()=>panoFore(2.0,'foreA'))}})()"
  -> {"far":111,"house":43,"tree":196,"foreA":596}
```

Two cost facts that op counts hide. **A plate mark is not a fixed amount of work:** W2's `foreB` sits 1.44 m from the lens
at k = 1485 px per plate metre, W1's `foreA` at 2.46–2.99 m at k = 571–693, so W2 uses fewer marks (718 vs 946) and costs
more per frame (1.0–1.7 s vs 0.14–0.25 s in the same scan) because each blade covers ~6.8× the pixels — budget marks *and*
watch `ms` for a near plate. **`ms` is only comparable within one session:** the first frame after boot pays for canvas and
font setup; steady-state W1 frames measure 140–250 ms, and `RULES.msPerFrameWarn` is 1200 ms.

A budget that is never met is not a budget: 946 of 1000 is a declaration worth arguing with, 200 of 1000 is decoration.
If a shot changes materially — a plate re-anchored, the bird moved, the grass thinned — update the declaration in the same
commit as the drawing, from a measured frame, or the next reader measures against a number nobody meant.