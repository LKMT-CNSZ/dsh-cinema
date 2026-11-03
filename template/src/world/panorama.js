// src/world/panorama.js - the 2.5D world of "Wind Past the Piano" (《风经过钢琴》).
//
// This file is the reference implementation of the 2.5D route: a painterly panorama built from plates (2D artwork with
// 3D placement) plus the local-3D piano and figure. Nothing here is a box or a cylinder standing in for a building: the
// house is drawn as a house (roof courses, sills, a broken pane, streaks under the eaves), the tree as a tree (tapered
// limbs, per-branch sway, sparse late-autumn leaf clusters), the foreground grass as grass (hundreds of blades with a
// travelling wind wave). The detail lives in the plate drawing, not in the geometry count.
'use strict';

// The panorama's own layout. Shared positions (the house, the tree, the piano) come from FIELD so the two reference films
// describe the same place; the far treeline is the panorama's own invention.
const PANO = {
  far: { at: [0, 10.5, 88], layer: PLATE_LAYERS.far, width: 460, height: 26 },
  house: { at: [FIELD.house.x, 0, FIELD.house.z], w: 10.0, h: 4.35, roof: 2.45 },
  tree: { at: [FIELD.tree.x, 0, FIELD.tree.z], h: 8.2, spread: 4.4 },
  foreA: { at: [0.35, 0, -4.50], width: 16, height: 0.88 },
  foreB: { at: [0.9, 0, -2.45], width: 10, height: 0.88 },
};

function definePanoramaPlates() {
  definePlate('far', { at: PANO.far.at, layer: PLATE_LAYERS.far });
  definePlate('house', { at: PANO.house.at, layer: PLATE_LAYERS.mid });
  definePlate('tree', { at: PANO.tree.at, layer: PLATE_LAYERS.mid + 1 });
  definePlate('foreA', { at: PANO.foreA.at, layer: PLATE_LAYERS.fore });
  definePlate('foreB', { at: PANO.foreB.at, layer: PLATE_LAYERS.fore });
}

// ---------- sky -------------------------------------------------------------------------------
// The sky is painted per frame (it is the one layer that is genuinely screen-space) but it drifts and thickens on the
// ambient clocks, so even the sky is not on a loop.
function panoSky(cam, t) {
  drawSky(ctx_of(), cam, t, {
    clouds: true,
    cloudDensity: AMBIENT.cloudDensity(t),
    cloudDrift: AMBIENT.cloudOffset(t, 0),
    cloudDrift2: AMBIENT.cloudOffset(t, 1),
  });
}
// main.js sets this before calling a shot's draw(); it exists so panoSky can reach the target context without threading
// it through every helper (the frame is single-threaded and one canvas per page).
let __frameCtx = null;
const ctx_of = () => __frameCtx;

// ---------- the far treeline ----------------------------------------------------------------
// A ridge of woodland 92 m out: three ranks of crowns, each rank darker and smaller, so the horizon has depth instead of
// being a single cut-out row. Everything is silhouette; the haze does the rest.
function panoFar(t) {
  plateBegin('far');
  const W2 = PANO.far.width / 2, H2 = PANO.far.height;
  // the ground the woodland stands on, painted as a receding band (no hard edge: it meets the 3D field below)
  for (let rank = 0; rank < 3; rank++) {
    const base = rank === 0 ? -0.9 : 0.2 + rank * 1.1;
    const amp = 5.4 - rank * 1.3;
    const seed = 41 + rank * 13;
    const pts = plateRidge(-W2, W2, base, (u, n) => {
      const a = fbm1((u + W2) * 0.045 + seed * 0.7, seed, 3);
      const b = fbm1((u + W2) * 0.13 + seed, seed + 5, 2);
      return 0.9 + (a * 1.5 + b * 0.6) * amp * (0.6 + 0.4 * Math.sin(n * Math.PI));
    }, 96);
    plateFill(pts, rank === 2 ? 'foliage' : 'foliageDry', {
      shade: 0.20 - rank * 0.03, tone: -0.5, haze: 0.42,
      alpha: 0.72 + rank * 0.12,
      key: 900 + rank,
    });
    // individual crowns on the near ranks: small clump masses that break the ridge line
    if (rank >= 1) {
      const n = rank === 2 ? 64 : rank === 1 ? 44 : 30;
      for (let i = 0; i < n; i++) {
        const u = -W2 + (i + hash2(seed, i) * 0.8) * (PANO.far.width / n);
        const top = base + 2.2 + fbm1((u + W2) * 0.11, seed + 3, 2) * amp * 1.15;
        const s = 1.5 + hash2(seed + 9, i) * 2.6;
        plateFill(plateEllipse(u, top, s * 1.5, s * 0.85, 12, 0.28), 'foliage', {
          shade: 0.16, tone: -0.55, haze: 0.36, alpha: 0.75 + rank * 0.15, key: 950 + rank * 40 + i,
        });
      }
    }
  }
  plateEnd();
}

// ---------- the house ------------------------------------------------------------------------
// Ten metres of façade, four and a half of wall, a slate roof: roof courses, a chimney with a shadow, sills, a broken
// pane, a curtain, streaks under the eaves, a step. Each mark is placed in metres so it holds at any camera distance.
function panoHouse(t) {
  const P = PANO.house;
  plateBegin('house');
  const W2 = P.w / 2, H = P.h, R = P.roof;
  const eave = H, ridge = H + R;
  // cast shadow of the house on its own ground (a soft ellipse, painted, so it survives any camera angle)
  plateFill([[-W2 * 1.5, -0.02], [W2 * 1.9, -0.02], [W2 * 2.2, 0.28], [-W2 * 1.4, 0.16]], 'soil', { shade: 0.1, tone: -0.2, alpha: 0.34, haze: 1.15 });
  // walls: the sun is behind-left, so the façade we see is in shade and slightly cool
  const wall = plateRect(-W2, 0, W2, eave, 0.006);
  plateFill(wall, 'plaster', { shade: 0.21, tone: -0.38, haze: 0.55, key: 501 });
  // the right-hand return, catching a little sun: a narrow plane at the edge
  plateFill([[-W2, 0], [-W2 + 1.05, 0.12], [-W2 + 1.05, eave - 0.05], [-W2, eave]], 'plaster', { shade: 0.42, tone: 0.05, haze: 0.55, key: 502 });
  // roof: two slopes meeting at the ridge, with a dark underside line
  plateFill([[-W2 - 0.45, eave], [0, ridge], [0, ridge - 0.12], [-W2 - 0.45, eave - 0.16]], 'roofSlate', { shade: 0.34, tone: -0.12, haze: 0.55, key: 510 });
  plateFill([[0, ridge], [W2 + 0.45, eave], [W2 + 0.45, eave - 0.16], [0, ridge - 0.12]], 'roofSlate', { shade: 0.62, tone: 0.12, haze: 0.55, key: 511 });
  plateLine([[-W2 - 0.45, eave - 0.16], [0, ridge - 0.12], [W2 + 0.45, eave - 0.16]], 'roofSlate', 0.05, { shade: 0.3, alpha: 0.9, key: 512 });
  // the shadow the eave throws on its own wall: the single mark that makes a façade read as standing under a roof
  plateFill(plateRect(-W2, eave - 0.72, W2, eave + 0.02, 0.004), 'plaster', { shade: 0.04, tone: -0.4, alpha: 0.75, haze: 0.55, key: 513 });
  // the wall's contact with the ground: one dark line, and the shadow the building throws to its right
  plateFill(plateRect(-W2 - 0.1, -0.12, W2 + 0.1, 0.16, 0.008), 'soil', { shade: 0.04, tone: -0.3, alpha: 0.62, haze: 0.5, key: 514 });
  plateFill([[-W2 * 1.4, -0.02], [W2 * 1.7, -0.02], [W2 * 1.9, 0.3], [-W2 * 1.2, 0.2]], 'soil', { shade: 0.06, tone: -0.25, alpha: 0.3, haze: 0.6, key: 515 });
  // chimney: brick, with a lit face and a shadow thrown onto the roof
  plateFill(plateRect(-1.9, ridge - 0.35, -0.95, ridge + 1.15, 0.004), 'brick', { shade: 0.72, tone: 0.1, key: 520 });
  plateFill([[-0.95, ridge - 0.35], [-0.72, ridge - 0.32], [-0.72, ridge + 1.05], [-0.95, ridge + 1.15]], 'brick', { shade: 0.4, tone: -0.1, key: 521 });
  plateFill(plateEllipse(-0.95, ridge + 1.2, 0.5, 0.12, 10, 0.05), 'stone', { shade: 0.35, key: 522 });
  // windows: two intact, one broken. Frames, sills, glazing, and a curtain in the middle one.
  const win = (cu, cv, w, h, broken) => {
    plateFill(plateRect(cu - w / 2 - 0.07, cv - h / 2 - 0.07, cu + w / 2 + 0.07, cv + h / 2 + 0.07, 0.003), 'stone', { shade: 0.26, tone: -0.3, key: 530 + cu });
    plateFill(plateRect(cu - w / 2, cv - h / 2, cu + w / 2, cv + h / 2, 0.002), 'glassDark', { shade: 0.18, tone: -0.5, key: 531 + cu });
    // glazing bars
    plateLine([[cu, cv - h / 2], [cu, cv + h / 2]], 'woodPale', 0.035, { shade: 0.22, key: 532 + cu });
    plateLine([[cu - w / 2, cv], [cu + w / 2, cv]], 'woodPale', 0.035, { shade: 0.22, key: 533 + cu });
    // sill, with a shadow under it
    plateFill(plateRect(cu - w / 2 - 0.12, cv - h / 2 - 0.16, cu + w / 2 + 0.12, cv - h / 2 - 0.07, 0.002), 'stone', { shade: 0.62, tone: 0.1, key: 534 + cu });
    plateFill(plateRect(cu - w / 2 - 0.12, cv - h / 2 - 0.16, cu + w / 2 + 0.12, cv - h / 2 - 0.2, 0.002), 'stone', { shade: 0.15, alpha: 0.6, key: 535 + cu });
    if (broken) {
      // a broken pane: a jagged gap and a shard still hanging
      plateFill([[cu + 0.02, cv + h / 2], [cu + w / 2, cv + h / 2], [cu + w / 2, cv + 0.04], [cu + 0.24, cv + 0.12], [cu + 0.1, cv + h / 2 - 0.1]], 'silhouette', { shade: 0.1, alpha: 0.8, key: 540 + cu });
      plateFill([[cu + 0.06, cv + h / 2 - 0.06], [cu + 0.3, cv + h / 2 - 0.02], [cu + 0.12, cv + h / 2 - 0.26]], 'glass', { shade: 0.35, alpha: 0.5, key: 541 + cu });
    } else {
      // a pale curtain behind the glass, and the reflection of the sky on it
      plateFill(plateRect(cu - w / 2 + 0.06, cv - h / 2 + 0.05, cu - 0.02, cv + h / 2 - 0.05, 0.01), 'clothCanvas', { shade: 0.5, tone: 0.2, alpha: 0.55, key: 542 + cu });
      plateFill([[cu - w / 2 + 0.03, cv + h / 2 - 0.03], [cu + w / 2 - 0.03, cv - h / 2 + 0.03], [cu + w / 2 - 0.03, cv - h / 2 + 0.16], [cu - w / 2 + 0.09, cv + h / 2 - 0.09]], 'glass', { shade: 0.5, alpha: 0.35, key: 543 + cu });
    }
  };
  win(-2.55, 2.85, 1.15, 1.45, false);
  win(0.15, 2.9, 1.2, 1.5, true);
  win(2.7, 2.8, 1.0, 1.3, false);
  // door: recessed, with a step, a worn threshold and a handle
  plateFill(plateRect(1.55, 0, 2.35, 2.25, 0.003), 'wood', { shade: 0.3, tone: -0.2, key: 550 });
  plateFill(plateRect(1.62, 0, 2.28, 2.16, 0.002), 'woodPale', { shade: 0.16, key: 551 });
  plateFill(plateRect(1.5, -0.02, 2.4, 0.1, 0.002), 'stone', { shade: 0.6, tone: 0.1, key: 552 });
  plateFill(plateEllipse(2.22, 1.15, 0.035, 0.035, 8), 'brass', { shade: 0.9, key: 553 });
  // weather: streaks under the eaves and under each sill, moss at the base, one patch of lost render
  plateDetail(wall, (c, box) => {
    const rnd = rngFrom(5177);
    for (let i = 0; i < 46; i++) {
      const x = box.bbox.x0 + rnd() * box.bbox.w;
      const y0 = box.bbox.y0 + rnd() * box.bbox.h * 0.18;
      const hh = box.bbox.h * (0.1 + rnd() * 0.3);
      const g = c.createLinearGradient(0, y0, 0, y0 + hh);
      g.addColorStop(0, `rgba(38,33,26,${0.10 + rnd() * 0.12})`);
      g.addColorStop(1, 'rgba(38,33,26,0)');
      c.fillStyle = g;
      c.fillRect(x, y0, Math.max(1, box.k * (0.01 + rnd() * 0.03)), hh);
    }
    // moss / damp at the foot of the wall
    const g2 = c.createLinearGradient(0, box.bbox.y1 - box.bbox.h * 0.09, 0, box.bbox.y1);
    g2.addColorStop(0, 'rgba(58,64,40,0)');
    g2.addColorStop(1, 'rgba(58,64,40,0.34)');
    c.fillStyle = g2;
    c.fillRect(box.bbox.x0, box.bbox.y1 - box.bbox.h * 0.09, box.bbox.w, box.bbox.h * 0.09);
    // a patch where the render has fallen away, showing brick
    const px = box.bbox.x0 + box.bbox.w * 0.72, py = box.bbox.y1 - box.bbox.h * 0.34;
    c.fillStyle = 'rgba(96,62,46,0.35)';
    c.beginPath();
    c.moveTo(px, py);
    for (let i = 0; i < 7; i++) c.lineTo(px + (rnd() - 0.3) * box.k * 0.5, py + (rnd() - 0.5) * box.k * 0.35);
    c.closePath(); c.fill();
  });
  // a gutter and a downpipe, drawn as thin geometry with its own shadow
  plateLine([[-W2 - 0.45, eave + 0.02], [W2 + 0.45, eave + 0.02]], 'metal', 0.055, { shade: 0.45, alpha: 0.9 });
  plateLine([[-W2 + 0.35, eave], [-W2 + 0.35, 0.15]], 'metal', 0.05, { shade: 0.4, alpha: 0.85 });
  plateEnd();
}

// ---------- the tree -------------------------------------------------------------------------
// A late-autumn tree: tapered limbs with bark marks, a handful of leaf clusters that lag their branches, and per-branch
// sway so the crown moves as a body with a small independent tremor, never as one rigid silhouette.
function panoTree(t) {
  const P = PANO.tree;
  plateBegin('tree');
  // the shadow lies across the field, stretched by the low sun and softer at its far end
  plateFill([[-P.spread * 0.55, -0.03], [P.spread * 1.25, -0.03], [P.spread * 1.05, 0.16], [-P.spread * 0.35, 0.1]], 'soil', { shade: 0.12, tone: -0.2, alpha: 0.26, haze: 1.05 });
  plateFill(plateEllipse(0.15, -0.02, P.spread * 0.34, 0.1, 16, 0.2), 'soil', { shade: 0.1, tone: -0.2, alpha: 0.28, haze: 1.05 });
  const swayAt = (stiff, seed) => AMBIENT.branchSway(t, seed, stiff) * 0.055;
  // trunk: three tapering segments, each swaying less than the one above it
  const trunkTop = P.h * 0.34;
  const tr = [[-0.30, 0], [0.30, 0], [0.19, trunkTop * 0.45], [0.10, trunkTop * 0.8], [0.05, trunkTop], [-0.11, trunkTop]];
  plateFill(tr, 'bark', { shade: 0.28, tone: -0.25, key: 601 });
  plateDetail(tr, (c, box) => {
    const rnd = rngFrom(6611);
    for (let i = 0; i < 90; i++) {
      const x = box.bbox.x0 + rnd() * box.bbox.w;
      const y = box.bbox.y0 + rnd() * box.bbox.h;
      c.strokeStyle = `rgba(${12 + rnd() * 26 | 0},${11 + rnd() * 22 | 0},${9 + rnd() * 18 | 0},${0.25 + rnd() * 0.35})`;
      c.lineWidth = Math.max(0.6, box.k * (0.004 + rnd() * 0.012));
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + (rnd() - 0.5) * box.k * 0.05, y + box.k * (0.05 + rnd() * 0.22));
      c.stroke();
    }
  });
  // limbs: a recursive skeleton, generated once from a seed (the same tree every frame), swayed per limb
  const limbs = PANO_TREE_LIMBS || (PANO_TREE_LIMBS = buildLimbSkeleton(7301));
  for (const L of limbs) {
    const sway = swayAt(L.stiff, L.seed);
    const pts = L.pts.map(([u, v], i) => [u + sway * (i / (L.pts.length - 1)) * L.len * 0.5, v]);
    plateLine(pts, 'bark', L.w, { shade: 0.26, tone: -0.25, alpha: 1 });
  }
  // leaf clusters at the tips: sparse, and each one lags its branch by a fraction of a second
  const tips = limbs.filter((L) => L.level >= 2);
  for (let i = 0; i < tips.length; i++) {
    const L = tips[i];
    const tip = L.pts[L.pts.length - 1];
    const sway = swayAt(L.stiff * 0.8, L.seed + 3);
    const cx = tip[0] + sway * L.len * 0.6, cy = tip[1] + sway * L.len * 0.2;
    const s = L.len * (0.20 + hash2(7301, i) * 0.14);
    plateFill(plateEllipse(cx, cy, s * 1.25, s * 0.8, 14, 0.3), 'foliageDry', {
      shade: 0.4, tone: -0.1, alpha: 0.82, key: 700 + i,
    });
    plateDetail(plateEllipse(cx, cy, s * 1.25, s * 0.8, 14, 0.3), (c, box) => {
      const rnd = rngFrom(7301 + i * 31);
      for (let k = 0; k < 42; k++) {
        const a = rnd() * TAU, r = Math.pow(rnd(), 0.6);
        const x = cx * 0 + box.bbox.x0 + box.bbox.w * (0.5 + Math.cos(a) * r * 0.46);
        const y = box.bbox.y0 + box.bbox.h * (0.5 + Math.sin(a) * r * 0.42);
        c.fillStyle = `rgba(${52 + rnd() * 46 | 0},${50 + rnd() * 40 | 0},${24 + rnd() * 26 | 0},${0.35 + rnd() * 0.4})`;
        c.beginPath();
        c.ellipse(x, y, Math.max(1, box.k * (0.025 + rnd() * 0.05)), Math.max(1, box.k * (0.015 + rnd() * 0.03)), rnd() * TAU, 0, TAU);
        c.fill();
      }
    });
  }
  plateEnd();
}
// One deterministic limb skeleton per tree: level, points, width, stiffness, seed.
let PANO_TREE_LIMBS = null;
function buildLimbSkeleton(seed) {
  const rnd = rngFrom(seed);
  const out = [];
  const grow = (u, v, ang, len, w, level, stiff, sd) => {
    if (level > 4 || len < 0.22) return;
    const pts = [];
    const n = 4;
    let cu = u, cv = v, a = ang;
    for (let i = 0; i < n; i++) {
      a += (rnd() - 0.5) * 0.22;
      cu += Math.cos(a) * (len / n);
      cv += Math.sin(a) * (len / n);
      pts.push([cu, cv]);
    }
    out.push({ pts: [[u, v], ...pts], w, level, len, stiff, seed: sd });
    const kids = level < 2 ? 3 : 2;
    for (let i = 0; i < kids; i++) {
      grow(cu, cv, a + (i - (kids - 1) / 2) * (0.55 + rnd() * 0.3) + (rnd() - 0.5) * 0.2, len * (0.66 + rnd() * 0.12), w * 0.62, level + 1, stiff * 1.28, sd + i * 3 + level);
    }
  };
  grow(0, PANO.tree.h * 0.34, 1.42, 2.2, 0.13, 1, 1.0, 1);
  grow(0, PANO.tree.h * 0.32, 1.72, 2.0, 0.12, 1, 0.9, 7);
  grow(0, PANO.tree.h * 0.30, 1.16, 1.8, 0.11, 1, 1.1, 13);
  return out;
}

// ---------- foreground grass -----------------------------------------------------------------
// The layer that makes the plate system worth having: hundreds of blades at 3 m, each following the travelling wind wave,
// each a slightly different height, colour and lean. It occludes the piano's legs, which is what puts the subject in the
// same space as the lens.
function panoFore(t, plateName = 'foreA') {
  plateBegin(plateName);
  const P = plateName === 'foreA' ? PANO.foreA : PANO.foreB;
  const halfW = P.width / 2;
  const n = plateName === 'foreA' ? 560 : 340;
  const rnd = rngFrom(plateName === 'foreA' ? 8801 : 8802);
  // a low band of grass at the base only: the plate is 2.9 m from the lens in W1 and 1.45 m in W2, so a solid bar would
  // read as a hedge - the blades carry the plane, the band just stops gaps showing under them
  plateFill(plateRect(-halfW, -0.5, halfW, 0.05, 0.02), 'grassGround', { shade: 0.45, tone: -0.12, alpha: 0.9, key: 880 });
  for (let i = 0; i < n; i++) {
    const u = -halfW + rnd() * P.width;
    const v0 = -0.05 + rnd() * 0.1;
    const h = P.height * (0.3 + Math.pow(rnd(), 1.5) * 0.7);
    const lean = AMBIENT.grassSway(t, P.at[0] + u, P.at[2], 1) * 0.55 + (rnd() - 0.5) * 0.12;
    const tint = rnd();
    const mat = tint < 0.55 ? 'foliageDry' : 'grassGround';
    // A blade is a tapered ribbon that curves: half a millimetre at the tip, a centimetre at the root, bending with the
    // wind. Drawn as a filled shape, not a stroke - a stroke has one width and reads as a straw.
    const w = 0.009 + rnd() * 0.011;   // 9-20 mm at the root: a blade has to read at 1.5 m as well as at 3 m
    const seg = 4;
    const spine = [];
    for (let s = 0; s <= seg; s++) {
      const k = s / seg;
      spine.push([u + lean * h * Math.pow(k, 1.6), v0 + h * k]);
    }
    const leftPts = [], rightPts = [];
    for (let s = 0; s <= seg; s++) {
      const k = s / seg;
      const ww = w * (1 - k * 0.85);
      leftPts.push([spine[s][0] - ww, spine[s][1]]);
      rightPts.push([spine[s][0] + ww, spine[s][1]]);
    }
    plateFill(leftPts.concat(rightPts.reverse()), mat, {
      shade: 0.5 + tint * 0.55, tone: tint < 0.5 ? -0.22 : 0.15, alpha: 0.92, key: 890 + i, tex: 'none',
    });
    if (rnd() < 0.06) {
      // a seed head, small and soft: one blade in sixteen carries one
      const tip = spine[seg];
      plateFill(plateEllipse(tip[0], tip[1] - 0.02, 0.016, 0.05, 12, 0.18), 'wheat', { shade: 0.85, tone: 0.25, alpha: 0.8, key: 920 + i });
    }
  }
  plateEnd();
}

// ---------- the hero: piano + figure, local 3D ------------------------------------------------
// The piano keeps its 3D construction (it is the one object whose proportions and lid geometry must be right from any
// angle), and the figure is a static silhouette with only the coat and a slow breath moving.
function panoHero(t, o = {}) {
  scenePiano();
  if (o.shadows === false) return panoHeroNoShadow(t, o);
  // shadows first: they belong on the field, under everything
  castShadow({ origin: [-1.28, 0, 1.02], yaw: 168, scale: 1 }, [[-0.2, -0.15], [0.2, -0.15], [0.2, 0.15], [-0.2, 0.15]], 1.64, 0.24);
  if (o.figure !== false) drawStander(t, o);
  // dust in the air between the lens and the piano: a few motes, only where the light is
  const motes = AMBIENT.motes(t, 14, 4, 5, 1.4);
  for (const m of motes) {
    const p = [0.4 + m.u - 2.4, 0.35 + m.v, -2.6];
    const pr = project(SCENE.cam, p);
    if (!pr) continue;
    _op(pr.z - 0.4, (c) => {
      c.fillStyle = `rgba(255,244,220,${m.alpha * 0.22})`;
      c.beginPath();
      c.arc(pr.x, pr.y, Math.max(0.6, m.size * SCENE.cam.focalPx / pr.z), 0, TAU);
      c.fill();
    }, LAYER.GEO + 2, 0);
  }
}

// A stander: static, back three-quarters to the lens, coat and hair moving by millimetres. No performance, no face.
function panoHeroNoShadow(t, o) {
  if (o.figure !== false) drawStander(t, o);
}
function drawStander(t, o = {}) {
  const root = [-1.28, PROPORTIONS.hipCenterY, 1.02];
  const yaw = o.yaw ?? 168;
  const p = idlePose(t, { seed: 9, base: { root, yaw } });
  p.headYaw = (p.headYaw || 0) + 6 + Math.sin(t * 0.37) * 0.8;
  p.headLook = 2 + Math.sin(t * 0.29 + 1.1) * 0.7;
  p.chestTwist = 4 + Math.sin(t * 0.21) * 0.7;
  // the wind works on the coat, not on the body
  p.coatSway = Math.sin((t / 1.9) * TAU + 0.6) * 0.05 + AMBIENT.gust(t) * 0.03;
  p.coatLift = 0.25 + AMBIENT.gust(t) * 0.4;
  mover('figure.coat');
  BUDGET.count('figures', 1);
  return drawFigure({}, p, { order: o.order || 0 });
}

// ---------- the bird -------------------------------------------------------------------------
function panoBird(t) {
  const b = AMBIENT.birdCross(t, { t0: 3.1, dur: 5.4, z: 46, y0: 10.6, x0: -44, x1: 34, arc: 1.6, scale: 1.5 });
  if (!b) return;
  mover('bird');
  drawBird(b, { order: 2 });
}
