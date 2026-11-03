// render.mjs - renders studio.html in headless Chrome: review images, the film, and the QA sweep.
//
// Looking at it (open the images with your image viewer / Read tool):
//   node render.mjs --sheet=0.2,2.8,5.4 --cols=3 --w=640 --out=out/check/sheet.jpg       contact sheet
//   node render.mjs --strip=3.0:3.5 --cols=6 --w=320 --out=out/check/strip.jpg           EVERY frame of a moment
//   node render.mjs --sheet=5.1 --crop=760,300,420,420 --w=600 --out=out/check/hand.jpg  full-res detail
//   node render.mjs --strip=4.0:4.4 --crop-at=2.35,1.1,0,520,420 --out=out/check/foot.jpg crop following a world point
//   node render.mjs --stills=1.2,6.4 --out=out/stills                                   full-res PNGs
// Making the film:
//   node render.mjs --clip [--range=0:4] --audio=assets/score.m4a --out=out/film.mp4    one worker, straight to MP4
//   node render.mjs --frames --workers=4                                                 parallel, resumable JPEG frames
//   node render.mjs --encode --audio=assets/score.m4a --out=out/film.mp4                 out/frames -> MP4
// QA (the automated pass described in references/technical-qa.md):
//   node render.mjs --qa [--range=0:12] [--step=1] [--out=out/qa]                        P0/P1/P2 report
// Other flags: --fps=24, --film=wind|piano (which film in the project), --chrome=<path>, --soft-gl, --gpu-angle=...
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, statSync, renameSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { homedir } from 'node:os';
import { analyzeSweep, writeReport } from './scripts/qa.mjs';
import { analyzeAudio } from './scripts/check-audio.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const CHROMES = [args.chrome, process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', `${process.env.LOCALAPPDATA || ''}/Google/Chrome/Application/chrome.exe`,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  ...playwrightChromes()];
function playwrightChromes() {
  const dir = `${homedir()}/.cache/ms-playwright`;
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((n) => /^chromium-\d+$/.test(n)).sort((a, b) => b.split('-')[1] - a.split('-')[1])
    .map((n) => `${dir}/${n}/chrome-linux64/chrome`);
}
const CHROME = CHROMES.find((p) => p && existsSync(p));
if (!CHROME) { console.error('Chrome not found: pass --chrome=<path> or set CHROME_PATH'); process.exit(1); }

const fps = +(args.fps || 24), FRAMES_DIR = 'out/frames';
const run = (cmd, a) => new Promise((ok, bad) => { const p = spawn(cmd, a, { stdio: 'inherit' }); p.on('close', (c) => (c ? bad(new Error(cmd + ' exited ' + c)) : ok())); });
const times = (s) => String(s).split(',').map(Number);
const span = (s) => String(s).split(':').map(Number);
const fields = (s) => { const out = []; let d = 0, cur = ''; for (const ch of String(s)) { if (ch === ',' && !d) { out.push(cur); cur = ''; continue; } d += ch === '(' ? 1 : ch === ')' ? -1 : 0; cur += ch; } out.push(cur); return out.map((v) => (isNaN(+v) ? v : +v)); };
const PAGE_ERRORS = [];

if (args.encode) {
  const out = args.out || 'out/film.mp4';
  const n = readdirSync(FRAMES_DIR).filter((f) => f.endsWith('.jpg')).length;
  const audio = args.audio || (existsSync('assets/score.m4a') ? 'assets/score.m4a' : '');
  console.log(`encoding ${n} frames -> ${out}${audio ? ' with ' + audio : ''}`);
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-stats', '-framerate', String(fps), '-i', `${FRAMES_DIR}/f%05d.jpg`,
    ...(audio ? ['-i', audio, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '192k', '-shortest'] : []),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out]);
  console.log('wrote ' + out);
  process.exit(0);
}

const ANGLE = { vulkan: ['--use-angle=vulkan', '--enable-features=Vulkan'], 'gl-egl': ['--use-angle=gl-egl'] };
if (args['gpu-angle'] && !ANGLE[args['gpu-angle']]) { console.error(`--gpu-angle must be one of ${Object.keys(ANGLE)}`); process.exit(1); }
const gpu = args['soft-gl'] ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  : args['gpu-angle'] ? ANGLE[args['gpu-angle']]
  : process.platform === 'win32' ? ['--use-angle=d3d11'] : process.platform === 'darwin' ? ['--use-angle=metal'] : ['--use-gl=angle'];
const sandbox = process.platform === 'linux' ? ['--no-sandbox'] : [];
const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true, protocolTimeout: 0,
  args: [...sandbox, '--allow-file-access-from-files', '--ignore-gpu-blocklist', ...gpu, '--enable-gpu-rasterization',
    '--window-size=1920,1080', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'],
});
async function openPage(tag = '') {
  const page = await browser.newPage();
  page.on('console', (m) => { if (['error', 'warn'].includes(m.type())) { console.log(`[page${tag}]`, m.text()); if (m.type() === 'error') PAGE_ERRORS.push(m.text()); } });
  page.on('pageerror', (e) => { console.log(`[page error${tag}]`, e.message); PAGE_ERRORS.push(e.message); });
  await page.goto(pathToFileURL(resolve('studio.html')).href + '?render' + (args.film ? '&film=' + args.film : ''), { waitUntil: 'networkidle0' });
  await page.waitForFunction('window.ready === true', { timeout: 60000 });
  return page;
}
const frameOf = async (page, t, type, q) => {
  const url = await page.evaluate((tt, ty, qq) => window.renderAt(tt, ty, qq), t, type, q);
  return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
};

if (args.sheet || args.strip) {
  const page = await openPage(), out = args.out || 'out/check/sheet.jpg';
  mkdirSync(dirname(out), { recursive: true });
  let ts;
  if (args.strip) { const [a, b] = span(args.strip); ts = []; for (let i = Math.round(a * fps); i <= Math.round(b * fps); i++) ts.push(+(i / fps).toFixed(5)); }
  else ts = times(args.sheet);
  const crop = args.crop ? times(args.crop) : null;
  const at = args['crop-at'] ? fields(args['crop-at']) : null;
  const { url, ms } = await page.evaluate((ts2, c, w, crop2, at2) => window.renderSheet(ts2, c, w, crop2, at2),
    ts, +(args.cols || (args.strip ? 6 : 3)), +(args.w || (args.strip ? 320 : 640)), crop, at);
  writeFileSync(out, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
  console.log(`${out}  (${ts.length} frames)  ms/frame: ${ms.join(' ')}`);
} else if (args.stills) {
  const page = await openPage(), out = args.out || 'out/stills';
  mkdirSync(out, { recursive: true });
  console.log('GPU:', await page.evaluate(() => window.gpuInfo()));
  const film = await page.evaluate(() => window.qaFilm());
  console.log(`film: ${film.duration}s @ ${film.fps}fps, ${film.shots.length} shots`);
  if (film.timelineIssues.length) console.log('TIMELINE:', film.timelineIssues.join(' | '));
  for (const s of times(args.stills)) {
    const t0 = Date.now(), buf = await frameOf(page, s, 'image/png');
    const f = `${out}/t${s.toFixed(2).replace('.', '_')}.png`;
    writeFileSync(f, buf);
    console.log(`${f}  ${Date.now() - t0} ms`);
  }
} else if (args.frames) {
  const probe = await openPage(), film = await probe.evaluate(() => window.qaFilm());
  await probe.close();
  const [a, b] = args.range ? span(args.range) : [0, film.duration];
  const workers = +(args.workers || 3);
  mkdirSync(FRAMES_DIR, { recursive: true });
  const first = Math.round(a * fps), last = Math.min(Math.ceil(film.duration * fps) - 1, Math.round(b * fps) - 1);
  const todo = [];
  for (let i = first; i <= last; i++) { const f = `${FRAMES_DIR}/f${String(i).padStart(5, '0')}.jpg`; if (!existsSync(f) || statSync(f).size < 1000) todo.push(i); }
  console.log(`${todo.length} frames to render (${last - first + 1 - todo.length} already done), ${workers} workers`);
  let next = 0, done = 0; const start = Date.now();
  await Promise.all(Array.from({ length: workers }, async (_, w) => {
    const page = await openPage('#' + w);
    while (next < todo.length) {
      const i = todo[next++], f = `${FRAMES_DIR}/f${String(i).padStart(5, '0')}.jpg`;
      const buf = await frameOf(page, i / fps, 'image/jpeg', 0.94);
      writeFileSync(f + '.tmp', buf); renameSync(f + '.tmp', f);
      if (++done % 24 === 0 || done === todo.length) {
        const el = (Date.now() - start) / 1000;
        console.log(`frame ${done}/${todo.length}  ${(el / done * 1000).toFixed(0)} ms/frame effective  eta ${((todo.length - done) * el / done / 60).toFixed(1)} min`);
      }
    }
  }));
} else if (args.clip) {
  const page = await openPage(), film = await page.evaluate(() => window.qaFilm());
  const [a, b] = args.range ? span(args.range) : [0, film.duration];
  const audio = args.audio || (existsSync('assets/score.m4a') ? 'assets/score.m4a' : '');
  const out = args.out || 'out/film.mp4';
  mkdirSync(dirname(out), { recursive: true });
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    ...(audio ? ['-ss', String(a), '-t', String(b - a), '-i', audio, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '192k', '-shortest'] : []),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out],
  { stdio: ['pipe', 'inherit', 'inherit'] });
  const n = Math.round((b - a) * fps), start = Date.now();
  for (let i = 0; i < n; i++) {
    const buf = await frameOf(page, a + i / fps, 'image/jpeg', 0.93);
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (i % 24 === 0 || i === n - 1) console.log(`frame ${i + 1}/${n}  ${((Date.now() - start) / (i + 1)).toFixed(0)} ms/frame`);
  }
  ff.stdin.end(); await new Promise((r) => ff.on('close', r));
  console.log(`wrote ${out}`);
} else if (args.qa) {
  const outDir = args.out || 'out/qa';
  mkdirSync(outDir, { recursive: true });
  const page = await openPage();
  const film = await page.evaluate(() => window.qaFilm());
  console.log(`film: ${film.duration}s @ ${film.fps}fps, ${film.shots.length} shots: ${film.shots.map((s) => s.id).join(', ')}`);
  if (film.timelineIssues.length) console.log('TIMELINE:', film.timelineIssues.join(' | '));
  const [a, b] = args.range ? span(args.range) : [0, film.duration];
  const step = +(args.step || 1);                     // 1 = every frame
  const list = [];
  for (let i = Math.round(a * film.fps); i <= Math.round(b * film.fps) - 1; i += step) list.push(+(i / film.fps).toFixed(5));
  const t0 = Date.now();
  const rows = await page.evaluate((ts) => ts.map((t) => window.qaAnalyze(t)), list);
  const ms = (Date.now() - t0) / Math.max(1, rows.length);
  console.log(`QA sweep: ${rows.length} frames in ${((Date.now() - t0) / 1000).toFixed(1)}s (${ms.toFixed(0)} ms/frame)`);

  // audio: a measured pass over the mix, not a guess about it
  let audio = null;
  const wavPath = existsSync('audio/score.wav') ? 'audio/score.wav' : null;
  let audioCheck = null;
  if (wavPath) {
    const cues = existsSync('audio/cues.json') ? JSON.parse(readFileSync('audio/cues.json', 'utf8')) : [];
    audioCheck = analyzeAudio(wavPath, cues, film.duration);
    for (const i of audioCheck.issues) PAGE_ERRORS.length;   // keep the array shape; issues are merged below
  }
  const musicPath = existsSync('assets/score.m4a') ? 'assets/score.m4a' : existsSync('audio/score.wav') ? 'audio/score.wav' : null;
  if (musicPath) {
    const probe = await new Promise((ok) => {
      const p = spawn('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type', '-of', 'json', musicPath]);
      let s = ''; p.stdout.on('data', (d) => (s += d)); p.on('close', () => { try { ok(JSON.parse(s)); } catch { ok(null); } });
    });
    audio = { path: musicPath, duration: probe ? +(+probe.format?.duration || 0).toFixed(3) : null };
    const cuesPath = 'audio/cues.json';
    if (existsSync(cuesPath)) {
      try { audio.cues = JSON.parse(readFileSync(cuesPath, 'utf8')); } catch { audio.cues = null; }
    }
  }
  const report = analyzeSweep(rows, film, { fps: film.fps, msPerFrame: ms, pageErrors: PAGE_ERRORS, audio });
  if (audioCheck) { report.audio = audioCheck.stats; for (const i of audioCheck.issues) { report.issues.push({ ...i }); report.summary[i.level]++; } }
  writeReport(report, outDir);
  console.log(`wrote ${outDir}/QA_REPORT.md and ${outDir}/report.json`);
  for (const i of report.issues.slice(0, 40)) console.log(`  ${i.level} ${String(i.t).padStart(7)}s  ${i.kind}  ${i.detail}`);
  console.log(`summary: P0=${report.summary.P0} P1=${report.summary.P1} P2=${report.summary.P2}  ->  ${report.summary.P0 + report.summary.P1 === 0 ? 'PASS (P0/P1 clear)' : 'FAIL'}`);
  if (PAGE_ERRORS.length) console.log(`page errors: ${PAGE_ERRORS.length} (see report)`);
  await browser.close();
  process.exit(report.summary.P0 + report.summary.P1 === 0 ? 0 : 1);
} else {
  console.log('nothing to do: see the usage notes at the top of render.mjs');
}
await browser.close();

