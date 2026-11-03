// scripts/qa.mjs - the rule engine behind `node render.mjs --qa`.
//
// The page answers "what is in this frame"; this file decides whether that is acceptable. Three levels, and the rule
// is strict on purpose: P0 blocks delivery, P1 must be fixed before delivery, P2 is judged by a person and recorded.
// Every rule here is a number, so the report can be argued with, and every issue names the frame time it came from -
// which is what makes the fix loop (locate -> cause -> fix -> re-render that range) possible.
import { writeFileSync } from 'node:fs';

export const RULES = {
  emptyStd: 2.5,          // P0: a frame with almost no variance has nothing drawn in it
  blackMean: 3.0,         // P0: essentially a black frame
  whiteFrac: 0.985,       // P0: the frame is blown out
  darkMean: 12.0,         // P1: so dark that the shot reads as an error rather than a night exterior
  darkFrac: 0.9,          // P1: this much pure black is a hole, not a shadow
  camPosJump: 0.16,       // P0: metres between adjacent frames inside one shot (a cut is not a jump)
  camYawJump: 4.5,        // P0: degrees between adjacent frames inside one shot
  camFocalJump: 1.5,      // P0: mm between adjacent frames inside one shot
  sunDrift: 0.035,        // P1: the sun may not change direction between shots of one film
  exposureDrift: 0.35,    // P1: exposure sliding between shots
  msPerFrameWarn: 1200,   // P2: render cost
  edgeBusy: 95,           // P2: too much high-frequency detail (noise masquerading as texture)
  stillFrames: 24,        // P2: a whole second with no measurable change (report only: a held shot is allowed)
  repeatSigDiff: 1.2,     // P2: two different shots whose statistics are nearly identical
  // 2.5D rules
  horizonJump: 0.008,     // P1: the horizon may drift this much (fraction of frame height) between two shots that match cut
  parallaxEps: 0.6,       // P1: a nearer plate must move at least this much more than a farther one when the camera moves
  detailNearRatio: 1.25,  // P2: the near third of the frame should carry this much more edge energy than the middle third
  skyNoiseRatio: 1.6,     // P2: the sky band should be calmer than the middle band (detail, not noise)
};

const deg = (r) => (r * 180) / Math.PI;
const angBetween = (a, b) => {
  const d = Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  return deg(Math.acos(d));
};

export function analyzeSweep(rows, film, opts = {}) {
  const issues = [];
  const push = (level, t, kind, detail) => issues.push({ level, t: typeof t === 'number' ? +t.toFixed(3) : t, kind, detail });
  const fps = opts.fps || film.fps;

  // ---- P0: the render itself ---------------------------------------------------------------------------------
  if (opts.pageErrors && opts.pageErrors.length) {
    for (const e of opts.pageErrors.slice(0, 8)) push('P0', '-', 'javascript error', e);
  }
  if (film.timelineIssues && film.timelineIssues.length) {
    for (const e of film.timelineIssues) push('P0', '-', 'timeline', e);
  }
  // anything the scene or the renderer raised while drawing
  const levelCount = { P0: 0, P1: 0, P2: 0 };
  const seen = new Set();
  for (const r of rows) {
    for (const i of r.issues || []) {
      const key = `${i.level}|${i.kind}|${JSON.stringify(i.detail).slice(0, 160)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      push(i.level || 'P1', r.t, i.kind, typeof i.detail === 'string' ? i.detail : JSON.stringify(i.detail));
    }
  }
  // ---- pixel rules -------------------------------------------------------------------------------------------
  for (const r of rows) {
    const s = r.stats;
    // A fade to or from black is an edit, not an empty frame: the shot declares its fade length and the pixel rules
    // stand down inside that window. They still apply everywhere else, including a fade longer than it claims.
    const meta = film.shots.find((sh) => sh.id === r.shot);
    const localT = meta ? r.t - meta.start : r.t;
    const inFade = meta && ((meta.fadeIn > 0 && localT < meta.fadeIn) || (meta.fadeOut > 0 && localT > meta.dur - meta.fadeOut));
    if (inFade) continue;
    if (s.std < RULES.emptyStd) push('P0', r.t, 'empty frame', `std=${s.std} mean=${s.mean}`);
    else if (s.mean < RULES.blackMean) push('P0', r.t, 'black frame', `mean=${s.mean}`);
    else if (s.white > RULES.whiteFrac) push('P0', r.t, 'blown frame', `white=${s.white}`);
    else if (s.mean < RULES.darkMean) push('P1', r.t, 'underexposed shot frame', `mean=${s.mean}`);
    if (s.black > RULES.darkFrac && s.mean < 20) push('P1', r.t, 'black hole', `black=${s.black} mean=${s.mean}`);
    if (s.edge > RULES.edgeBusy) push('P2', r.t, 'busy frame', `edge=${s.edge} (texture/noise masquerading as detail)`);
  }
  // ---- camera continuity (inside a shot; a cut is exempt) -----------------------------------------------------
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1], b = rows[i];
    if (a.shot !== b.shot) continue;
    if (Math.abs(b.t - a.t - 1 / fps) > 1e-4) continue;          // only adjacent frames
    const dp = Math.hypot(b.cam.pos[0] - a.cam.pos[0], b.cam.pos[1] - a.cam.pos[1], b.cam.pos[2] - a.cam.pos[2]);
    if (dp > RULES.camPosJump) push('P0', b.t, 'camera jump', `moved ${dp.toFixed(3)} m in one frame (${a.shot})`);
    const yawA = [a.cam.target[0] - a.cam.pos[0], a.cam.target[1] - a.cam.pos[1], a.cam.target[2] - a.cam.pos[2]];
    const yawB = [b.cam.target[0] - b.cam.pos[0], b.cam.target[1] - b.cam.pos[1], b.cam.target[2] - b.cam.pos[2]];
    const ang = angBetween(yawA, yawB);
    if (ang > RULES.camYawJump) push('P0', b.t, 'camera snap', `${ang.toFixed(2)} deg in one frame (${a.shot})`);
    if (Math.abs(b.cam.focal - a.cam.focal) > RULES.camFocalJump) push('P0', b.t, 'focal jump', `${a.cam.focal}->${b.cam.focal}mm`);
  }
  // ---- lighting continuity across shots ----------------------------------------------------------------------
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1], b = rows[i];
    if (a.shot === b.shot) continue;
    const d = angBetween(a.sun, b.sun);
    if (d > RULES.sunDrift) push('P1', b.t, 'sun direction changed at a cut', `${a.shot}->${b.shot}: ${d.toFixed(1)} deg`);
    if (Math.abs(a.exposure - b.exposure) > RULES.exposureDrift) push('P1', b.t, 'exposure jump at a cut', `${a.exposure}->${b.exposure}`);
  }
  // ---- 2.5D: parallax, horizon matching, detail density ------------------------------------------------------
  const plateByName = new Map();
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1], b = rows[i];
    if (!b.plates || !a.plates) continue;
    const moving = Math.hypot(b.cam.pos[0] - a.cam.pos[0], b.cam.pos[2] - a.cam.pos[2]) > 0.004;
    if (a.shot === b.shot && moving) {
      // near plates must shift more on screen than far ones; a reversal means a plate was anchored or layered wrongly
      const names = Object.keys(a.plates).filter((n) => b.plates[n]);
      for (const n1 of names) for (const n2 of names) {
        const p1 = a.plates[n1], p2 = a.plates[n2];
        if (p1.depth >= p2.depth) continue;               // n1 is nearer
        const d1 = Math.hypot(b.plates[n1].ox - p1.ox, b.plates[n1].oy - p1.oy);
        const d2 = Math.hypot(b.plates[n2].ox - p2.ox, b.plates[n2].oy - p2.oy);
        if (d1 + RULES.parallaxEps < d2 && d2 > 0.4) {
          push('P1', b.t, 'parallax reversed', n1 + ' (' + p1.depth.toFixed(1) + ' m) moved ' + d1.toFixed(2) + ' px, ' + n2 + ' (' + p2.depth.toFixed(1) + ' m) moved ' + d2.toFixed(2) + ' px');
        }
      }
    }
    if (a.shot !== b.shot) {
      const dy = Math.abs(a.cam.horizonY - b.cam.horizonY) / film.height;
      if (dy > RULES.horizonJump) push('P1', b.t, 'horizon jumped at the cut', (dy * film.height).toFixed(1) + ' px between ' + a.shot + ' and ' + b.shot);
    }
  }
  for (const r of rows) {
    const bd = r.stats.bands;
    if (!bd) continue;
    if (r.stats.edge < 8) continue;   // a fading frame has no near field to judge
    if (bd[2] > 0 && bd[1] > 0 && bd[2] < bd[1] * RULES.detailNearRatio) {
      push('P2', r.t, 'near field too plain', 'near edge ' + bd[2] + ' vs middle ' + bd[1] + ' - detail belongs in the foreground');
    }
    if (bd[1] > 0 && bd[0] > bd[1] * RULES.skyNoiseRatio) {
      push('P2', r.t, 'noisy sky', 'sky edge ' + bd[0] + ' vs middle ' + bd[1]);
    }
  }
  // ---- repeated / held shots ---------------------------------------------------------------------------------
  const byShot = new Map();
  for (const r of rows) {
    if (!byShot.has(r.shot)) byShot.set(r.shot, []);
    byShot.get(r.shot).push(r);
  }
  const sig = (arr) => {
    const pick = [0.25, 0.5, 0.75].map((k) => arr[Math.min(arr.length - 1, Math.floor(arr.length * k))]);
    return pick.map((r) => r.stats);
  };
  const shots = [...byShot.entries()].map(([id, arr]) => ({ id, arr, sig: sig(arr) }));
  for (let i = 0; i < shots.length; i++) {
    for (let j = i + 1; j < shots.length; j++) {
      const A = shots[i].sig, B = shots[j].sig;
      let diff = 0;
      for (let k = 0; k < 3; k++) diff += Math.abs(A[k].mean - B[k].mean) + Math.abs(A[k].std - B[k].std) + Math.abs(A[k].edge - B[k].edge) * 0.5;
      diff /= 3;
      if (diff < RULES.repeatSigDiff) {
        const firstLast = i === 0 && j === shots.length - 1;
        push('P2', shots[j].arr[0].t, firstLast ? 'opening/closing rhyme (intentional?)' : 'two shots look identical',
          `${shots[i].id} vs ${shots[j].id}: signature diff ${diff.toFixed(2)}`);
      }
    }
  }
  // stillness: a whole second inside one shot with no change in std/edge (a held frame is legal; note it)
  for (const { id, arr } of shots) {
    let run = 0;
    for (let i = 1; i < arr.length; i++) {
      const a = arr[i - 1].stats, b = arr[i].stats;
      if (Math.abs(a.mean - b.mean) < 0.02 && Math.abs(a.edge - b.edge) < 0.02) run++; else run = 0;
      if (run === RULES.stillFrames) push('P2', arr[i].t, 'held still for 1 s', `${id}: check that the hold is intentional`);
    }
  }
  // ---- audio -------------------------------------------------------------------------------------------------
  if (opts.audio) {
    const a = opts.audio;
    if (a.duration != null && Math.abs(a.duration - film.duration) > 0.15) {
      push('P1', '-', 'audio length mismatch', `${a.duration}s audio vs ${film.duration}s film`);
    }
    if (Array.isArray(a.cues)) {
      for (const c of a.cues) {
        if (!(c.t >= 0 && c.t <= film.duration)) push('P1', c.t, 'cue outside film', `${c.name || 'cue'} at ${c.t}s`);
      }
    }
  }
  // ---- performance & spec ------------------------------------------------------------------------------------
  if (opts.msPerFrame > RULES.msPerFrameWarn) push('P2', '-', 'slow frame', `${opts.msPerFrame.toFixed(0)} ms/frame at 1080p`);

  // ---- per-shot summary --------------------------------------------------------------------------------------
  const shotsSummary = [];
  for (const { id, arr } of shots) {
    const meta = film.shots.find((s) => s.id === id) || {};
    const avg = (k) => arr.reduce((s, r) => s + r.stats[k], 0) / arr.length;
    shotsSummary.push({
      id, start: meta.start, dur: meta.dur, scenes: meta.scene || '', size: meta.size || '', lens: meta.lens || '',
      motion: meta.motion || '', transition: meta.transition || '', reads: meta.reads || [],
      mean: +avg('mean').toFixed(1), std: +avg('std').toFixed(1), black: +avg('black').toFixed(3), white: +avg('white').toFixed(3),
      edge: +avg('edge').toFixed(1), frames: arr.length,
    });
  }
  const summary = { P0: 0, P1: 0, P2: 0 };
  for (const i of issues) summary[i.level]++;
  issues.sort((a, b) => (a.level < b.level ? -1 : a.level > b.level ? 1 : (typeof a.t === 'number' && typeof b.t === 'number' ? a.t - b.t : 0)));
  return {
    film, shots: shotsSummary, issues, summary,
    rows: rows.map((r) => ({ t: r.t, shot: r.shot, mean: r.stats.mean, std: r.stats.std, edge: r.stats.edge, black: r.stats.black, white: r.stats.white, rgb: r.stats.rgb })),
    meta: { msPerFrame: +(opts.msPerFrame || 0).toFixed(1), audio: opts.audio || null, rules: RULES, generated: new Date().toISOString() },
  };
}

export function writeReport(report, dir) {
  const { film, shots, issues, summary, meta } = report;
  writeFileSync(`${dir}/report.json`, JSON.stringify(report, null, 1));
  const L = [];
  L.push(`# QA report - ${film.title || 'film'}`);
  L.push('');
  L.push(`Generated ${meta.generated}. Every number below came from rendering the actual frames in headless Chrome; nothing here is estimated.`);
  L.push('');
  L.push('## 1. Technical spec');
  L.push('');
  L.push(`| item | value |`);
  L.push(`|---|---|`);
  L.push(`| duration | ${film.duration} s |`);
  L.push(`| frame rate | ${film.fps} fps |`);
  L.push(`| resolution | ${film.width} x ${film.height} |`);
  L.push(`| shots | ${film.shots.length} |`);
  L.push(`| render cost | ${meta.msPerFrame} ms/frame |`);
  L.push(`| audio | ${meta.audio ? `${meta.audio.path} (${meta.audio.duration}s)` : 'none'} |`);
  L.push('');
  L.push('## 2. Shots and their measured character');
  L.push('');
  L.push('| shot | start | dur | scene | size | lens | camera | mean | std | edge | frames |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const s of shots) {
    L.push(`| ${s.id} | ${s.start}s | ${s.dur}s | ${s.scenes} | ${s.size} | ${s.lens} | ${s.motion} | ${s.mean} | ${s.std} | ${s.edge} | ${s.frames} |`);
  }
  L.push('');
  L.push('## 3. Issues');
  L.push('');
  L.push(`**P0 (blocking): ${summary.P0}** &nbsp; **P1 (must fix): ${summary.P1}** &nbsp; **P2 (reviewed): ${summary.P2}**`);
  L.push('');
  for (const level of ['P0', 'P1', 'P2']) {
    const list = issues.filter((i) => i.level === level);
    L.push(`### ${level} - ${list.length}`);
    L.push('');
    if (!list.length) { L.push('_none_'); L.push(''); continue; }
    L.push('| t (s) | kind | detail |');
    L.push('|---|---|---|');
    for (const i of list.slice(0, 120)) L.push(`| ${i.t} | ${i.kind} | ${String(i.detail).replace(/\|/g, '/')} |`);
    if (list.length > 120) L.push(`| ... | | ${list.length - 120} more in report.json |`);
    L.push('');
  }
  // audio: the mix was measured, not heard. Show the numbers.
  if (report.audio) {
    L.push('## 4. Audio (measured)');
    L.push('');
    L.push(`file: \`${report.audio.path}\` · ${report.audio.duration}s`);
    L.push('');
    L.push('| measurement | RMS | what it should show |');
    L.push('|---|---|---|');
    const r = report.audio.rms;
    L.push(`| bed (0.3-3.6 s) | ${r.bed} | the field is never silent |`);
    L.push(`| quiet stretch (4.00-4.20 s) | ${r.preNote} | quiet stretch: below the bed |`);
    L.push(`| first event peak (4.24-4.6 s) | ${r.notePeak} | the first event, well above the bed |`);
    L.push(`| two seconds later (6.2-6.4 s) | ${r.noteTail2s} | the event is still present |`);
    L.push(`| mid-film event (9.18-9.7 s) | ${r.wing} | above the bed |`);
    L.push(`| end (11.5-11.95 s) | ${r.end} | fading out |`);
    L.push('');
    L.push('| cue | at (s) | after/before | nearest onset |');
    L.push('|---|---|---|---|');
    for (const c of report.audio.cues) L.push(`| ${c.name} | ${c.t} | ${c.ratio ?? '(fade/masked)'} | ${c.nearestOnset ?? '-'} |`);
    L.push('');
  }
  const ruleHeading = report.audio ? '## 5. Rules applied' : '## 4. Rules applied';
  L.push(ruleHeading);
  L.push('');
  L.push('| rule | value | meaning |');
  L.push('|---|---|---|');
  const R = meta.rules;
  const meaning = {
    emptyStd: 'frame variance below this = nothing drawn',
    blackMean: 'mean luma below this = black frame',
    whiteFrac: 'this fraction of near-white pixels = blown',
    darkMean: 'mean luma below this = underexposed frame (P1)',
    darkFrac: 'this fraction of near-black pixels with a dark mean = hole',
    camPosJump: 'camera moved further than this between adjacent frames = jump',
    camYawJump: 'camera direction changed more than this between adjacent frames = snap',
    camFocalJump: 'focal length changed more than this between adjacent frames',
    sunDrift: 'sun direction changed more than this at a cut = continuity error',
    exposureDrift: 'exposure changed more than this at a cut',
    msPerFrameWarn: 'render slower than this earns a performance note',
    edgeBusy: 'mean gradient above this = busy/noisy frame',
    stillFrames: 'frames with no change before a stillness note',
    repeatSigDiff: 'two shots closer than this are reported as possibly repeated',
  };
  for (const k of Object.keys(R)) L.push(`| ${k} | ${R[k]} | ${meaning[k] || ''} |`);
  L.push('');
  L.push('## 5. Verdict');
  L.push('');
  L.push(summary.P0 + summary.P1 === 0
    ? 'P0 and P1 are clear: the automated pass found nothing that blocks delivery. P2 items still need a human look.'
    : `Blocked: ${summary.P0} P0 and ${summary.P1} P1 issues must be fixed and the affected frames re-rendered before delivery.`);
  L.push('');
  writeFileSync(`${dir}/QA_REPORT.md`, L.join('\n'));
  return `${dir}/QA_REPORT.md`;
}
