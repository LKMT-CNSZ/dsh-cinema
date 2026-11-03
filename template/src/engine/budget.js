// engine/budget.js - the scene complexity budget.
//
// The lesson from the first film is that quality does not fall off smoothly with scene complexity: it falls off a cliff.
// A house with eleven well-painted details reads as a photograph; the same house plus ten rough props reads as a game.
// So complexity is now an explicit, checked budget per shot rather than something discovered halfway through the render.
//
// A shot declares its budget in meta.budget. The engine measures what was actually drawn, and QA fails a shot that
// exceeds its declaration by more than 20 %. If a shot needs more than its budget, the answer is to split the shot or
// simplify the way something is expressed - never to lower the drawing quality of everything.
'use strict';

const BUDGET = {
  // what a shot may spend, measured by the engine, not guessed
  limits: {
    plateFills: 260,        // filled shapes across all 2.5D plates
    surfaces3d: 120,        // polygons drawn by the local-3D renderer
    movers: 6,              // independently animated things (wind field counts as one)
    materials: 12,          // distinct material ids visible in the frame
    layers: 7,              // distinct 2.5D plates
    figures: 1,             // people
    interactions: 1,        // contact events (a hand on a key, a foot on a step)
    cameraMoves: 2,         // simultaneous camera behaviours (e.g. dolly + breath)
  },
  state: null,
  begin(declared = {}) {
    BUDGET.state = {
      declared,
      measured: { plateFills: 0, surfaces3d: 0, movers: 0, materials: 0, layers: 0, figures: 0, interactions: 0, cameraMoves: 0 },
      materials: new Set(),
      layerNames: new Set(),
      movers: new Set(),
    };
  },
  count(kind, n = 1, name = null) {
    if (!BUDGET.state) return;
    const m = BUDGET.state.measured;
    if (kind === 'materials') { BUDGET.state.materials.add(n); return; }
    if (kind === 'layers') { BUDGET.state.layerNames.add(n); return; }
    if (kind === 'mover') { BUDGET.state.movers.add(name || String(n)); return; }
    if (m[kind] != null) m[kind] += n;
  },
  // Merge the counters the renderer keeps into the budget's own, then compare against the declaration.
  finish() {
    const st = BUDGET.state;
    if (!st) return null;
    const ops = SCENE.ops || [];
    let plateFills = 0, surfaces3d = 0;
    for (const op of ops) {
      if (op.kind === 'plate') plateFills++;
      else surfaces3d++;
    }
    st.measured.plateFills = plateFills;
    st.measured.surfaces3d = surfaces3d;
    st.measured.materials = st.materials.size;
    st.measured.layers = st.layerNames.size;
    st.measured.movers = st.movers.size;
    st.measured.figures = Math.max(st.measured.figures, (SCENE.tags && SCENE.tags.woman) || 0);
    const issues = [];
    const limitOf = (k) => (st.declared && st.declared[k] != null ? st.declared[k] : BUDGET.limits[k]);
    for (const k of Object.keys(st.measured)) {
      if (!limitOf(k)) continue;
      const over = st.measured[k] / limitOf(k);
      if (over > 1.2) {
        issues.push({
          level: over > 2 ? 'P1' : 'P2',
          kind: 'budget overrun',
          detail: `${k}: measured ${st.measured[k]}, declared ${limitOf(k)} (${over.toFixed(2)}x) - split the shot or simplify the expression`,
        });
      }
    }
    return { measured: st.measured, declared: st.declared, limits: BUDGET.limits, issues };
  },
};
// A mover is anything with its own animation function. Registering it is a claim: "this thing moves on its own clock".
function mover(name) { BUDGET.count('mover', 0, name); }
function budgetMaterial(id) { BUDGET.count('materials', id); }
function budgetLayer(id) { BUDGET.count('layers', id); }
function budgetInteraction() { BUDGET.count('interactions', 1); }
