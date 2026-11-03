// src/world.js - boot the shared vocabulary, then prove it holds together.
//
// This file is the only place that knows about all the registries. The film's repeated things live in
// src/world/characters.js (who), props.js (what), environment.js (where), cameras.js (how it is seen). Every shot
// references those ids; nothing in a shot file may invent its own house, tree or person, which is the structural
// reason this engine cannot produce the classic "the house changed between shots" defect.
const WORLD = {
  // the one sun direction for the whole film: low, west-south-west, behind the field. Continuity is a hard constraint,
  // so it is a constant, not a per-shot choice (QA fails the film if a cut changes it).
  sunDir: vnorm([-0.70, 0.235, 0.67]),
  built: false,
};

function buildWorld() {
  lightUse('lategold');
  for (const p of ['overcast', 'lategold', 'dusk']) LIGHT_PRESETS[p].sun.dir = WORLD.sunDir.slice();
  defineEnvironment();
  defineCharacters();
  defineProps();
  defineCameras();
  WORLD.built = true;
  if (window.SMOKE_TEST) return;
  // sanity: every registry the film uses must have its entries, and materials must have a texture routine
  const need = { character: ['woman'], prop: ['piano', 'house', 'tree', 'bird', 'candle', 'stones'], environment: ['field'], camera: ['s1', 's2', 's3', 's4', 's5'] };
  for (const kind of Object.keys(need)) {
    for (const id of need[kind]) {
      if (!REGISTRY[kind][id]) throw new Error(`src/world/${kind}s: "${id}" is not defined`);
    }
  }
  for (const id of Object.keys(MAT)) {
    if (!MAT[id].tex) throw new Error(`material "${id}" has no texture routine`);
  }
  console.log('world:', JSON.stringify(registryReport()));
}
