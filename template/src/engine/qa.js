// engine/qa.js - automated inspection, in the page, at frame level.
//
// The QA system answers questions a person cannot answer by reading code: is this frame empty, is the camera where the
// shot list says, are the feet on the ground, is the hand on the key, does this character keep its proportions, is a
// number in the render NaN. Scenes register probes; the renderer reports geometry faults; the QA sweep in render.mjs
// drives it frame by frame and turns the results into a P0/P1/P2 report.
'use strict';

const QA = {
  level: { P0: 3, P1: 2, P2: 1 },
  issues: [],            // {t, level, kind, detail}
  frame: [],             // issues raised while rendering the current frame
  probes: [],            // {name, fn(t) -> {ok, detail}}
  t: 0,
  probe(name, fn) { QA.probes.push({ name, fn }); },
  beginFrame(t, frameNo) { QA.t = t; QA.frame = []; QA.frameNo = frameNo; },
  raise(level, kind, detail) { QA.frame.push({ t: QA.t, level, kind, detail }); QA.issues.push({ t: QA.t, level, kind, detail }); },
  fail(kind, detail) { QA.raise('P0', kind, detail); },
  warn(kind, detail) { QA.raise('P1', kind, detail); },
  note(kind, detail) { QA.raise('P2', kind, detail); },
  endFrame() { return QA.frame.slice(); },
  // Run every registered probe. A probe returns {ok, detail}; !ok means "the scene contradicts itself".
  runProbes(t) {
    const out = [];
    for (const p of QA.probes) {
      try {
        const r = p.fn(t);
        if (r && r.ok === false) out.push({ probe: p.name, level: r.level || 'P1', detail: r.detail || '' });
      } catch (e) {
        out.push({ probe: p.name, level: 'P0', detail: 'probe threw: ' + e.message });
      }
    }
    return out;
  },
  summary() {
    const byLevel = { P0: 0, P1: 0, P2: 0 };
    for (const i of QA.issues) byLevel[i.level]++;
    return byLevel;
  },
};

// ---- geometry assertions used by scene code ---------------------------------
// A joint below the floor is a P0: it means the walk or the IK is wrong, not that the drawing is ugly.
function qaGroundContact(label, p, floor = -0.005) {
  if (!Number.isFinite(p[0]) || !Number.isFinite(p[1]) || !Number.isFinite(p[2])) {
    QA.fail('NaN position', { label });
    return;
  }
  if (p[1] < floor) QA.fail('foot through floor', { label, y: +p[1].toFixed(3) });
}
// Contact between a hand/tool and the thing it is supposed to touch, in metres.
function qaContact(label, a, b, tolerance = 0.02) {
  const d = vdist(a, b);
  if (d > tolerance) QA.warn('contact gap', { label, distance: +d.toFixed(3), tolerance });
  return d;
}
// A character must keep its proportions: compare every bone's world length to its rest length.
function qaBoneLengths(label, joints, restLengths) {
  for (const k of Object.keys(restLengths)) {
    const [a, b] = k.split('-');
    if (!joints[a] || !joints[b]) continue;
    const got = vdist(joints[a], joints[b]);
    const want = restLengths[k];
    const err = Math.abs(got - want) / want;
    if (err > 0.02) QA.fail('bone length drift', { label, bone: k, got: +got.toFixed(4), want: +want.toFixed(4), err: +err.toFixed(3) });
  }
}
// A camera must not jump between two adjacent frames unless the cut is intentional; the sweep compares frames, so the
// shot records its own expectations here for the report instead.
function qaCameraSanity(cam) {
  const vals = [...cam.pos, ...cam.target, cam.focalMM, cam.focus];
  if (vals.some((v) => !Number.isFinite(v))) QA.fail('NaN camera', { cam: { pos: cam.pos, target: cam.target } });
  const d = vlen(vsub(cam.target, cam.pos));
  if (d < 0.05) QA.fail('camera inside subject', { distance: +d.toFixed(3) });
}
// Every repeated thing exists in exactly one copy per frame. This is the cheapest possible defence against the
// "two birds", "two pianos" and "rebuilt house" class of defect: the probe reads the render's own draw counts.
function qaRegisterInstanceProbe() {
  QA.probe('single instance', () => {
    const tags = SCENE.tags || {};
    const singles = ['piano', 'house', 'tree', 'woman', 'bird', 'treeline'];
    for (const k of singles) {
      if ((tags[k] || 0) > 1) return { ok: false, level: 'P0', detail: k + ' drawn ' + tags[k] + ' times in one frame' };
    }
    return { ok: true, detail: JSON.stringify(tags) };
  });
}
// A prop that should be on the ground must touch it.
function qaPropRest(label, bottomY, floor = 0, tol = 0.02) {
  if (Math.abs(bottomY - floor) > tol) QA.warn('prop floating', { label, bottom: +bottomY.toFixed(3), floor });
}

