// scripts/new_project.mjs - scaffold a dsh-cinema project from the skill's template.
//
//   node scripts/new_project.mjs <target-dir> [--keep-demo]
//
// Copies the engine, the world registries and the render/audio pipeline, installs the one dependency (puppeteer-core),
// checks the toolchain, and leaves a clean first shot to build in. `--keep-demo` keeps the reference film (The Piano in
// the Field) intact, which is the best way to learn the API — and the worst way to start a new film by accident.
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILL_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const target = args.find((a) => !a.startsWith('--'));
const keepDemo = args.includes('--keep-demo');
if (!target) {
  console.error('usage: node new_project.mjs <target-dir> [--keep-demo]');
  process.exit(1);
}
const TARGET = resolve(target);
if (existsSync(join(TARGET, 'studio.html'))) {
  console.error(`error: ${TARGET} already has a studio.html; not overwriting`);
  process.exit(1);
}
mkdirSync(TARGET, { recursive: true });
cpSync(join(SKILL_DIR, 'template'), TARGET, {
  recursive: true,
  filter: (src) => !/node_modules|\\out\\|\/out\/|\\assets\\|\/assets\//.test(src),
});
mkdirSync(join(TARGET, 'assets'), { recursive: true });
mkdirSync(join(TARGET, 'out', 'check'), { recursive: true });
mkdirSync(join(TARGET, 'audio'), { recursive: true });

// Strip the reference film unless asked to keep it: a new film should start from an empty shot, not from a copy of the
// demo that then has to be surgically removed by hand.
if (!keepDemo) {
  const shotsDir = join(TARGET, 'src/shots');
  if (existsSync(shotsDir)) {
    for (const f of readdirSync(shotsDir)) if (f.endsWith('.js')) rmSync(join(shotsDir, f), { force: true });
  }
  mkdirSync(shotsDir, { recursive: true });
  writeFileSync(join(shotsDir, 's1_first.js'), `// S1 - the first shot (start 0). Copy the shape of this file for every shot.
//
// A shot declares WHEN it runs, HOW it is lit, WHAT the camera is, and WHAT exists in the frame. It may not draw the sky
// (main.js owns that), keep state between frames, or invent a position that FIELD does not own.
'use strict';
shot({
  film: 'main',
  id: 'S1', start: 0.00, dur: PROJECT.duration,
  meta: {
    scene: 'where we are, in four words', size: 'wide', lens: '35mm f/5.6', motion: 'locked off, tripod breath',
    transition: 'fade in from black (0.55 s)',
    reads: ['0.0-1.0 what the place is', '1.0-2.0 who is in it', '2.0-3.0 what is about to happen'],
  },
  light(lt) {
    lightUse('lategold');
    // lightPoint([x, y, z], hexLin('#ffb066'), 2.6, 0.62);   // a practical, if the shot has one
  },
  cam: (lt) => ({ pos: [-1.6, 1.38, -6.3], target: [0.3, 1.06, 0.85], focal: 35, focus: 7.2, aperture: 5.6 }),
  // the 2.5D default route: four painted plates in depth, the piano and figure as local 3D. Comment any line out to see
  // what it contributes; the order is far to near and is also the occlusion order.
  draw({ t }) {
    panoFar(t);          // treeline at 88 m
    fieldGround();       // the ground plane (local 3D, for perspective)
    panoHouse(t);        // house plate at 26 m
    panoTree(t);         // tree plate at 14.5 m
    panoHero(t);         // the piano and the figure (local 3D) + their shadows
    panoFore(t, 'foreA'); // grass 2.9 m from the lens
  },
  fadeIn: 0.55, fadeColor: '#07080c',
});
`, 'utf8');
  const studio = join(TARGET, 'studio.html');
  const html = readFileSync(studio, 'utf8');
  const patched = html.replace(
    /<!-- ===== shots[\s\S]*?<!-- ===== boot ===== -->/,
    '<!-- ===== shots, in time order (order does not matter: each declares its start) ===== -->\n<script src="src/shots/s1_first.js"></script>\n<!-- ===== boot ===== -->',
  );
  writeFileSync(studio, patched, 'utf8');
  // the starter shot belongs to the project's own film, 'main'
  const cfgPath = join(TARGET, 'src/config.js');
  const cfg = readFileSync(cfgPath, 'utf8').replace(/film:\s*'[^']*'/, "film: 'main'");
  writeFileSync(cfgPath, cfg, 'utf8');
  // the sound is composed for this film; a new film starts with the synthesis but no cue sheet
  rmSync(join(TARGET, 'audio/score.wav'), { force: true });
  rmSync(join(TARGET, 'audio/cues.json'), { force: true });
}

// dependency install (with the registry fallback that this machine sometimes needs)
console.log('== installing puppeteer-core');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const install = spawnSync(npm, ['install', '--silent', '--no-audit', '--no-fund'], { cwd: TARGET, stdio: 'inherit', shell: process.platform === 'win32' });
if (install.status !== 0) {
  console.log('== retrying via registry.npmmirror.com');
  spawnSync(npm, ['install', '--silent', '--no-audit', '--no-fund', '--registry=https://registry.npmmirror.com'], { cwd: TARGET, stdio: 'inherit', shell: process.platform === 'win32' });
}

console.log('');
console.log(`== ready: ${TARGET}`);
console.log(`   next:  cd "${TARGET}"`);
console.log('          node render.mjs --sheet=0.5,1.5,2.5 --cols=3 --w=640 --out=out/check/first.jpg');
console.log('          node render.mjs --qa            (after the shots exist)');
console.log('          node audio/score.mjs             (then encode: see SKILL.md step 7)');
console.log('          node render.mjs --frames --workers=4 && node render.mjs --encode --audio=assets/score.m4a --out=out/film.mp4');

