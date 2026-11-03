// engine/timeline.js - the film as a list of shots, and more than one film in one project.
//
// A shot declares: when it starts, how long it runs, its camera, its lighting function, and a draw function that adds
// geometry for a local time. Shots may belong to a named film (PROJECT.film selects which one renders), so the 2.5D
// reference film and the earlier 3D one can live side by side and share the engine, the world registries and the QA.
'use strict';

const SHOTS = [];
const FILM_CACHE = { key: null, list: [] };

// Register a shot. Required: start, dur, cam, light, draw. Optional: film, meta, budget, dof, mist, post,
// fadeIn, fadeOut, mix.
function shot(def) {
  if (!def.id || !def.meta) throw new Error('shot needs id and meta');
  def.film = def.film || 'main';   // a scaffolded project's single film is 'main'
  SHOTS.push(def);
  FILM_CACHE.key = null;
  return def;
}
const activeFilm = () => PROJECT.film || 'main';
// The shots of the film being rendered, sorted by start time.
function filmShots() {
  const key = activeFilm();
  if (FILM_CACHE.key === key) return FILM_CACHE.list;
  FILM_CACHE.list = SHOTS.filter((s) => s.film === key).sort((a, b) => a.start - b.start);
  FILM_CACHE.key = key;
  return FILM_CACHE.list;
}
function finishTimeline() {
  const list = filmShots();
  const issues = [];
  let cursor = 0;
  for (const s of list) {
    if (Math.abs(s.start - cursor) > 1e-6) {
      issues.push(`${s.id}: starts at ${s.start}s, expected ${cursor}s (${s.start > cursor ? 'gap' : 'overlap'})`);
    }
    cursor = s.start + s.dur;
  }
  if (list.length && Math.abs(cursor - PROJECT.duration) > 1e-6) {
    issues.push(`film "${activeFilm()}" ends at ${cursor.toFixed(3)}s but PROJECT.duration is ${PROJECT.duration}s`);
  }
  if (!list.length) issues.push(`no shots for film "${activeFilm()}"`);
  return issues;
}
function shotAt(t) {
  const list = filmShots();
  let i = 0;
  while (i + 1 < list.length && t >= list[i + 1].start) i++;
  const def = list[i];
  return { def, lt: clamp(t - def.start, 0, def.dur), dur: def.dur, index: i, t };
}
const shotMeta = () => filmShots().map((s) => ({
  id: s.id, start: s.start, dur: s.dur, film: s.film,
  fadeIn: s.fadeIn || 0, fadeOut: s.fadeOut || 0, mix: s.mix ? s.mix.dur : 0,
  budget: s.budget || null, ...s.meta,
}));
const filmList = () => [...new Set(SHOTS.map((s) => s.film))];
