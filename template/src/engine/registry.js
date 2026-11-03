// engine/registry.js - the shared vocabulary of a film.
//
// Every repeated thing - a character, a prop, a building, an environment, a material, a light, a camera - is defined
// once and referenced by id. That is what stops a house from being rebuilt 3 cm taller in shot 4, a character from
// changing height between two shots, or a bird from existing twice. Registries are filled at boot by src/world/*.js.
'use strict';

const REGISTRY = {
  material: MAT,
  light: LIGHT_PRESETS,
  character: {},
  prop: {},
  environment: {},
  camera: {},
};

function defineThing(kind, id, def) {
  const bucket = REGISTRY[kind];
  if (!bucket) throw new Error('unknown registry: ' + kind);
  if (bucket[id]) throw new Error(`${kind} "${id}" is already defined`);
  bucket[id] = def;
  return def;
}
const getThing = (kind, id) => {
  const v = REGISTRY[kind] && REGISTRY[kind][id];
  if (!v) throw new Error(`no ${kind} "${id}" - add it to src/world/`);
  return v;
};
// QA reads this: duplicate definitions are impossible by construction, but a scene can still draw the same prop twice
// from two different call sites, which is what the "one piano" probe checks.
function registryReport() {
  const out = {};
  for (const k of Object.keys(REGISTRY)) {
    const v = REGISTRY[k];
    out[k] = Array.isArray(v) ? v.length : Object.keys(v).length;
  }
  return out;
}

// ---- shared world conventions ---------------------------------------------
// One coordinate system for the whole film: metres, +Y up, ground at y = 0, +X east, +Z north. A camera at yaw 0
// looks towards +Z. Characters stand on y = 0 and are authored facing +Z; face them elsewhere with a yaw.
const WORLD_SCALE = { unit: 'metre' };

// ---- reusable staging helpers ----------------------------------------------
// Place a character definition on the ground: position + facing, one call for every shot, so the same person keeps the
// same height, the same coat and the same proportions wherever they are seen.
function placeCharacter(id, { x, z, yaw = 0, scale = 1 }) {
  const def = getThing('character', id);
  return { def, root: [x, 0, z], yaw, scale };
}
// A prop's world placement, with a yaw and an optional tilt. Props are authored around their own origin at ground
// level so that "on the ground" is y = 0 for every one of them.
function placeProp(id, { x, z, y = 0, yaw = 0, scale = 1 }) {
  const def = getThing('prop', id);
  return { def, origin: [x, y, z], yaw, scale };
}
// Rotate a point in the prop's local space into world space around its placement (yaw in DEGREES about +Y, which is
// how every placement in this project is written; the trigonometry converts once, here).
function localToWorld(place, p) {
  const a = (place.yaw || 0) * DEG;
  const c = Math.cos(a), s = Math.sin(a), k = place.scale ?? 1;
  const x = p[0] * k, y = p[1] * k, z = p[2] * k;
  return [place.origin[0] + x * c + z * s, place.origin[1] + y, place.origin[2] - x * s + z * c];
}
