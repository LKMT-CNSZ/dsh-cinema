// engine/main.js - boot, the frame pipeline, and the headless render hooks.
//
// One frame is: set the lighting rig for this moment, build the camera, clear, paint the sky, let the shot add world
// geometry, flush it back-to-front through the camera, add air and post, and return. Nothing in that list remembers the
// previous frame. render.mjs calls window.renderAt(t) for stills, sheets, strips, every frame of the film, and for the
// QA sweep; studio.html calls the same function as you scrub.
'use strict';

let canvas = null, ctx = null;
let T = 0;
let FRAME_NO = 0;
let OFF = null, OFFX = null;          // offscreen frame for dissolves and QA pixel reads
let INIT = false;

// ---- frame -----------------------------------------------------------------
function paintShot(targetCtx, def, lt, tg, frameNo) {
  __frameCtx = targetCtx;      // plate helpers paint into the frame's own context
  // 1. light first: the sky, every surface and the character read the same rig.
  lightReset();
  def.light(lt, tg);
  // 2. camera
  const cam = readCamera(def.cam, lt);
  qaCameraSanity(cam);
  sceneBegin(cam, frameNo);
  // 3. air before solids
  const skyOpts = typeof def.sky === 'function' ? def.sky(tg, lt) : (def.sky || {});
  drawSky(targetCtx, cam, tg, skyOpts);
  // 4. the shot's own world
  def.draw({ ctx: targetCtx, t: tg, lt, dur: def.dur, cam, frameNo });
  // 5. mist over the land (or over the whole frame if the shot asks for it)
  drawMist(targetCtx, cam, tg, def.mist ? def.mist(lt) : 0);
  // 6. focus pull, then paint everything back-to-front
  if (def.dof) {
    const p = def.dof(lt);
    if (p && p.focus > 0) focusPull(p.focus, p.aperture ?? 2.8);
  }
  sceneFlush(targetCtx);
  return cam;
}

function drawFrame(t) {
  const frameNo = Math.round(t * PROJECT.fps);
  FRAME_NO = frameNo;
  T = t;
  QA.beginFrame(t, frameNo);
  const cur = shotAt(t);
  BUDGET.begin(cur.def.budget || null);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  const cam = paintShot(ctx, cur.def, cur.lt, t, frameNo);

  // cross-dissolve at the head of a shot: the previous shot's last moments keep playing under it
  if (cur.def.mix && cur.lt < cur.def.mix.dur) {
    const prev = filmShots()[cur.index - 1];
    if (prev) {
      if (!OFF) { OFF = document.createElement('canvas'); OFF.width = W; OFF.height = H; OFFX = OFF.getContext('2d'); }
      OFFX.setTransform(1, 0, 0, 1, 0, 0);
      OFFX.clearRect(0, 0, W, H);
      const prevLt = clamp(prev.dur - (cur.def.mix.dur - cur.lt), 0, prev.dur);
      paintShot(OFFX, prev, prevLt, prev.start + prevLt, frameNo);
      const k = 1 - smoothstep01(cur.lt / cur.def.mix.dur);
      compositeFrame(ctx, OFF, k);
    }
  }
  // fades are part of the edit, applied over the finished frame
  if (cur.def.fadeIn) fadeTo(ctx, cur.def.fadeColor || '#05060a', 1 - smoothstep01(cur.lt / cur.def.fadeIn));
  if (cur.def.fadeOut) fadeTo(ctx, cur.def.fadeColor || '#05060a', smoothstep01((cur.lt - (cur.dur - cur.def.fadeOut)) / cur.def.fadeOut));
  // 7. the print
  applyPost(ctx, t, frameNo, cur.def.post || {});
  SCENE.budget = BUDGET.finish();
  if (SCENE.budget) for (const i of SCENE.budget.issues) QA.raise(i.level, i.kind, i.detail);
  QA.endFrame();
  return { cam, shot: cur.def, lt: cur.lt };
}

// ---- headless hooks (used by render.mjs) -----------------------------------
window.renderAt = (t, type = 'image/png', q = 0.92) => {
  drawFrame(t);
  return canvas.toDataURL(type, q);
};
// Contact sheet: several times at once, with an optional fixed crop or a crop that follows a WORLD point through the
// camera at each time (for checking a foot, a hand or a contact while the camera moves).
window.renderSheet = (times, cols = 3, w = 640, crop = null, at = null) => {
  if (at) at = at.map((v) => (typeof v === 'string' ? (0, eval)(v) : v));
  const [, , cw, ch] = at || crop || [0, 0, W, H];
  const h = Math.round((w * ch) / cw);
  const rows = Math.ceil(times.length / cols);
  const sc = document.createElement('canvas');
  sc.width = cols * w; sc.height = rows * h;
  const c = sc.getContext('2d');
  const ms = [];
  for (let i = 0; i < times.length; i++) {
    const t0 = performance.now();
    const { cam } = drawFrame(times[i]);
    ms.push(Math.round(performance.now() - t0));
    const x = (i % cols) * w, y = Math.floor(i / cols) * h;
    let sx = 0, sy = 0;
    if (at) {
      const p = project(cam, [at[0], at[1], at[2] ?? 0]);
      sx = p ? p.x - cw / 2 : 0;
      sy = p ? p.y - ch / 2 : 0;
    } else if (crop) { sx = crop[0]; sy = crop[1]; }
    c.drawImage(canvas, sx, sy, cw, ch, x, y, w, h);
    c.fillStyle = 'rgba(0,0,0,.62)';
    c.fillRect(x, y, 96, 22);
    c.fillStyle = '#fff';
    c.font = '15px ui-monospace, monospace';
    c.fillText(times[i].toFixed(2) + 's', x + 6, y + 16);
    // shot id lets a reviewer name the seam a frame belongs to
    const s = shotAt(times[i]).def;
    c.fillStyle = 'rgba(0,0,0,.62)';
    c.fillRect(x + w - 58, y, 58, 22);
    c.fillStyle = '#dcdcdc';
    c.fillText(s.id, x + w - 52, y + 16);
  }
  return { url: sc.toDataURL('image/jpeg', 0.9), ms };
};
window.gpuInfo = () => {
  const gl = document.createElement('canvas').getContext('webgl');
  if (!gl) return 'no webgl';
  const e = gl.getExtension('WEBGL_debug_renderer_info');
  return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
};

// ---- QA hooks --------------------------------------------------------------
// Render one frame and measure it: pixel statistics from a downscaled copy (cheap, stable) plus every probe.
window.qaAnalyze = (t) => {
  const { cam, shot: def, lt } = drawFrame(t);
  const stat = qaPixelStats();
  const probes = QA.runProbes(t);
  const issues = QA.endFrame();
  return {
    t, shot: def.id, lt: +lt.toFixed(3),
    cam: { pos: cam.pos.map((v) => +v.toFixed(4)), target: cam.target.map((v) => +v.toFixed(4)), focal: cam.focalMM, focus: +cam.focus.toFixed(3), aperture: cam.aperture, horizonY: +cam.horizonY.toFixed(1) },
    stats: stat,
    issues: issues.concat(probes.map((p) => ({ level: p.level, kind: p.probe, detail: p.detail }))),
    sun: LIGHT.sun.dir.map((v) => +v.toFixed(3)),
    exposure: LIGHT.exposure,
    plates: SCENE.plates || null,
    budget: SCENE.budget ? { measured: SCENE.budget.measured, declared: SCENE.budget.declared, limits: SCENE.budget.limits } : null,
  };
};
function qaPixelStats() {
  const sw = 128, sh = 72;
  if (!OFF) { OFF = document.createElement('canvas'); OFF.width = W; OFF.height = H; OFFX = OFF.getContext('2d'); }
  let sc = document.getElementById('qaSmall');
  if (!sc) { sc = document.createElement('canvas'); sc.id = 'qaSmall'; sc.width = sw; sc.height = sh; }
  const c = sc.getContext('2d', { willReadFrequently: true });
  c.clearRect(0, 0, sw, sh);
  c.drawImage(canvas, 0, 0, sw, sh);
  const d = c.getImageData(0, 0, sw, sh).data;
  let sum = 0, sum2 = 0, black = 0, white = 0, n = sw * sh;
  let rs = 0, gs = 0, bs = 0;
  for (let i = 0; i < n; i++) {
    const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    sum += l; sum2 += l * l;
    rs += r; gs += g; bs += b;
    if (l < 6) black++;
    if (l > 250) white++;
  }
  const mean = sum / n;
  const std = Math.sqrt(Math.max(0, sum2 / n - mean * mean));
  // edge energy: mean absolute horizontal gradient, a rough "is there anything drawn" measure
  let edge = 0;
  const bands = [0, 0, 0], bandN = [0, 0, 0];
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw - 1; x++) {
    const i = (y * sw + x) * 4, j = i + 4;
    const e = Math.abs(d[i] - d[j]) + Math.abs(d[i + 1] - d[j + 1]) + Math.abs(d[i + 2] - d[j + 2]);
    edge += e;
    const b = y < sh * 0.34 ? 0 : y < sh * 0.62 ? 1 : 2;   // sky, middle distance, near field
    bands[b] += e; bandN[b]++;
  }
  edge /= n;
  for (let b = 0; b < 3; b++) bands[b] = +(bands[b] / Math.max(1, bandN[b])).toFixed(2);
  return {
    mean: +mean.toFixed(2), std: +std.toFixed(2), black: +(black / n).toFixed(3), white: +(white / n).toFixed(3),
    edge: +edge.toFixed(2), bands, rgb: [Math.round(rs / n), Math.round(gs / n), Math.round(bs / n)],
  };
}
window.qaFilm = () => ({
  film: activeFilm(), films: filmList(),
  duration: PROJECT.duration, fps: PROJECT.fps, width: W, height: H,
  shots: shotMeta(), timelineIssues: finishTimeline(),
  accumulated: QA.summary(),
});
window.projectInfo = () => ({ duration: PROJECT.duration, fps: PROJECT.fps });

// ---- boot ------------------------------------------------------------------
async function boot() {
  canvas = document.getElementById('out');
  canvas.width = W; canvas.height = H;
  ctx = canvas.getContext('2d', { willReadFrequently: true });
  postInit();
  skyInit();
  const qFilm = new URLSearchParams(location.search).get('film');
  if (qFilm) PROJECT.film = qFilm;   // render.mjs --film=<name> selects which film in the project renders
  buildWorld();                   // world/ files define registries; this validates them
  definePanoramaPlates();         // the 2.5D plates of the reference film
  qaRegisterInstanceProbe();
  const issues = finishTimeline();
  if (issues.length) console.warn('timeline:', issues.join(' | '));
  console.log('film:', activeFilm(), '(', filmList().join(', '), ')');
  INIT = true;
  window.ready = true;
  if (!location.search.includes('render')) devUI();
}

// ---- the studio UI (scrub, frame step, overlays) ---------------------------
function devUI() {
  const bar = document.getElementById('bar');
  const scrub = document.getElementById('scrub');
  const label = document.getElementById('label');
  scrub.max = PROJECT.duration;
  let busy = false;
  let pending = null;
  const render = () => {
    if (busy) return;
    busy = true;
    const loop = () => {
      if (pending == null) { busy = false; return; }
      const t = pending; pending = null;
      const t0 = performance.now();
      const { shot: def, lt } = drawFrame(t);
      const ms = Math.round(performance.now() - t0);
      scrub.value = t;
      label.textContent = `${t.toFixed(3)}s  ${def.id}  ${lt.toFixed(2)}s/${def.dur.toFixed(2)}s  ${ms}ms  ${W}x${H}@${PROJECT.fps}`;
      requestAnimationFrame(loop);
    };
    loop();
  };
  scrub.addEventListener('input', () => { pending = +scrub.value; render(); });
  window.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 1 / PROJECT.fps : 0.1;
    if (e.key === 'ArrowRight') { pending = clamp((+scrub.value) + step, 0, PROJECT.duration); render(); }
    if (e.key === 'ArrowLeft') { pending = clamp((+scrub.value) - step, 0, PROJECT.duration); render(); }
  });
  const q = new URLSearchParams(location.search);
  const t0 = +(q.get('t') || 0);
  pending = q.get('shot') != null ? SHOTS[+q.get('shot')].start : t0;
  render();
}
boot();

