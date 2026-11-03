// scripts/preflight.mjs - check a project (or the skill itself) before rendering a single frame.
//
//   node scripts/preflight.mjs                # check the project in the current directory
//   node scripts/preflight.mjs <project-dir>
//   node scripts/preflight.mjs --skill <skill-dir>
//
// Everything here is a static check: files that must exist, script tags that must resolve, a timeline that must tile the
// declared duration, a SKILL.md whose frontmatter DSH will actually accept. It is the cheap pass; `render.mjs --qa` is
// the expensive one.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILL_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];
const notes = [];
const ok = [];
const fail = (s) => problems.push(s);
const note = (s) => notes.push(s);
const good = (s) => ok.push(s);

const argv = process.argv.slice(2);
const skillMode = argv.includes('--skill');
const target = resolve(argv.find((a) => !a.startsWith('--')) || (skillMode ? SKILL_DIR : '.'));
const skillRoot = skillMode ? target : SKILL_DIR;

// ---------- toolchain -------------------------------------------------------
const has = (cmd, args = ['--version']) => {
  try { return spawnSync(cmd, args, { stdio: 'ignore', shell: process.platform === 'win32' }).status === 0; } catch { return false; }
};
if (has('node')) good(`node ${process.version}`); else fail('node is not on PATH');
if (has('ffmpeg', ['-version'])) good('ffmpeg'); else fail('ffmpeg is not on PATH (needed to encode the film)');
const CHROMES = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', `${process.env.LOCALAPPDATA || ''}/Google/Chrome/Application/chrome.exe`,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'];
const chrome = CHROMES.find((p) => p && existsSync(p));
if (chrome) good(`chrome ${chrome}`); else fail('no Chrome found: install it or set CHROME_PATH');

// ---------- the skill bundle itself ----------------------------------------
const required = [
  'SKILL.md', 'README.md',
  'references/visual-language.md', 'references/directing.md', 'references/cinematography.md',
  'references/motion-system.md', 'references/character-animation.md', 'references/procedural-materials.md',
  'references/continuity.md', 'references/technical-qa.md', 'references/sound-design.md',
  'templates/CREATIVE_BIBLE.md', 'templates/STORYBOARD.md', 'templates/SHOT_LIST.md', 'templates/SHOT_SPEC.md',
  'templates/QA_REPORT.md',
  'scripts/new_project.mjs', 'scripts/preflight.mjs',
  'template/studio.html', 'template/render.mjs', 'template/package.json', 'template/audio/score.mjs',
  'template/scripts/probe.mjs', 'template/scripts/qa.mjs', 'template/scripts/check-audio.mjs',
  'template/src/config.js', 'template/src/world.js',
  'template/src/engine/math.js', 'template/src/engine/color.js', 'template/src/engine/lighting.js',
  'template/src/engine/camera.js', 'template/src/engine/materials.js', 'template/src/engine/renderer.js',
  'template/src/engine/sky.js', 'template/src/engine/post.js', 'template/src/engine/timeline.js',
  'template/src/engine/qa.js', 'template/src/engine/registry.js', 'template/src/engine/character.js',
  'template/src/engine/bird.js', 'template/src/engine/props.js', 'template/src/engine/main.js',
  'template/src/world/environment.js', 'template/src/world/characters.js', 'template/src/world/props.js',
  'template/src/world/cameras.js',
];
for (const f of required) {
  if (!existsSync(join(skillRoot, f))) fail(`missing from the skill: ${f}`);
}
// frontmatter: DSH discovers <root>/<name>/SKILL.md, one level deep, and drops the skill silently if the frontmatter is
// invalid (name must be kebab-case, description required and capped at 500 chars in the catalog).
const skillMd = join(skillRoot, 'SKILL.md');
if (existsSync(skillMd)) {
  const src = readFileSync(skillMd, 'utf8');
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) fail('SKILL.md has no YAML frontmatter (DSH will silently drop the skill)');
  else {
    const fm = m[1];
    const name = (fm.match(/^name:\s*(.+)$/m) || [])[1];
    // description must be a single-line scalar: a greedy [\s\S] match would swallow whenToUse and metadata and report a
    // length four times the real one
    const desc = (fm.match(/^description:[ \t]*(.+)$/m) || [])[1];
    if (!name) fail('SKILL.md frontmatter has no name');
    else if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name.trim())) fail(`SKILL.md name "${name.trim()}" is not kebab-case`);
    else good(`frontmatter name: ${name.trim()}`);
    if (!desc || !desc.trim()) fail('SKILL.md frontmatter has no description');
    else {
      const len = (name ? ('name' + name).length : 0) + desc.trim().length;
      if (len > 500) note(`name + description is ${len} chars; the DSH catalog caps around 500`);
      else good(`frontmatter description: ${desc.trim().length} chars`);
      if (/(^|: )\S*:\s/.test(desc.trim().replace(/^["']|["']$/g, ''))) note('description contains ": " which breaks unquoted YAML - quote it or use a dash');
      // the invocation vocabulary DSH actually accepts (any other key makes the loader drop the skill without an error)
      for (const key of ['disable-model-invocation', 'user-invocable']) {
        const v = (fm.match(new RegExp('^' + key + ':[ \\t]*(\\S+)', 'm')) || [])[1];
        if (v && !/^(true|false|yes|no|on|off|1|0)$/i.test(v)) fail(`frontmatter ${key} must be a boolean, got "${v}"`);
      }
      for (const legacy of ['modelInvocable', 'userInvocable', 'disableModelInvocation', 'allowed-tools', 'argument-hint']) {
        if (new RegExp('^' + legacy + ':', 'm').test(fm)) fail(`frontmatter uses "${legacy}", which DSH rejects`);
      }
    }
  }
}

// ---------- the project ----------------------------------------------------
function checkProject(dir) {
  const html = join(dir, 'studio.html');
  if (!existsSync(html)) { fail(`no studio.html in ${dir} - is this a project? (run scripts/new_project.mjs)`); return; }
  const src = readFileSync(html, 'utf8');
  const scripts = [...src.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
  if (!scripts.length) fail('studio.html loads no scripts');
  for (const s of scripts) if (!existsSync(join(dir, s))) fail(`studio.html loads "${s}" which does not exist`);
  good(`${scripts.length} scripts resolve`);

  const cfgPath = join(dir, 'src/config.js');
  if (!existsSync(cfgPath)) { fail('src/config.js is missing'); return; }
  const cfg = readFileSync(cfgPath, 'utf8');
  const num = (k) => { const m = cfg.match(new RegExp(k + ':\\s*([ \\d.]+)')); return m ? +m[1] : null; };
  const dur = num('duration'), fps = num('fps'), w = num('width'), h = num('height');
  if (!dur) fail('PROJECT.duration is missing or zero');
  if (!fps) fail('PROJECT.fps is missing');
  if (!w || !h) fail('PROJECT.width/height are missing');
  if (w && h) good(`spec ${w}x${h} @ ${fps} fps, ${dur} s, ${Math.round(dur * fps)} frames`);

  // shots: parse `start:` and `dur:` from src/shots/*.js and check they tile the declared duration.
  // A project may hold more than one film (the 2.5D one and the earlier 3D one): each shot declares `film: 'name'` and
  // only the group named in PROJECT.film has to tile. Shots without a film field belong to the default film, 'piano'.
  const shotsDir = join(dir, 'src/shots');
  if (!existsSync(shotsDir)) fail('src/shots/ is missing');
  else {
    const cfg = existsSync(join(dir, 'src/config.js')) ? readFileSync(join(dir, 'src/config.js'), 'utf8') : '';
    const activeFilm = (cfg.match(/film:\s*'([^']+)'/) || [])[1] || 'piano';
    const files = readdirSync(shotsDir).filter((f) => f.endsWith('.js') && !f.startsWith('_'));
    const loaded = new Set(scripts.map((s) => s.replace(/\\/g, '/')));
    const allShots = [];
    for (const f of files) {
      const p = join(shotsDir, f);
      const s = readFileSync(p, 'utf8');
      if (!loaded.has(`src/shots/${f}`)) note(`src/shots/${f} exists but is not loaded by studio.html`);
      const id = (s.match(/id:\s*'([^']+)'/) || [])[1];
      const start = (s.match(/start:\s*([\d.]+)/) || [])[1];
      const d = (s.match(/dur:\s*([\d.]+)/) || [])[1];
      const film = (s.match(/film:\s*'([^']+)'/) || [])[1] || 'piano';
      if (id && start != null && d != null) allShots.push({ id, start: +start, dur: +d, file: f, film });
    }
    const shots = allShots.filter((s) => s.film === activeFilm);
    const films = [...new Set(allShots.map((s) => s.film))];
    if (films.length > 1) note(`project holds ${films.length} films: ${films.join(', ')} (checking "${activeFilm}")`);
    if (!shots.length) fail(`no shots found for film "${activeFilm}" in src/shots/ (no id/start/dur triple)`);
    shots.sort((a, b) => a.start - b.start);
    let cursor = 0;
    for (const s of shots) {
      if (Math.abs(s.start - cursor) > 1e-6) fail(`${s.id} starts at ${s.start}s but the previous shot ends at ${cursor.toFixed(2)}s`);
      cursor = s.start + s.dur;
    }
    if (dur && Math.abs(cursor - dur) > 1e-6) fail(`shots end at ${cursor.toFixed(2)}s but PROJECT.duration is ${dur}s`);
    if (dur && Math.abs(cursor - dur) <= 1e-6) good(`${shots.length} shots tile 0-${dur}s (${shots.map((s) => s.id).join(' ')})`);
    const ids = shots.map((s) => s.id);
    if (new Set(ids).size !== ids.length) fail('two shots share an id');
  }

  // assets and sound
  if (existsSync(join(dir, 'audio/score.wav'))) good('audio/score.wav');
  else note('no audio/score.wav yet (run node audio/score.mjs)');
  if (existsSync(join(dir, 'assets/score.m4a'))) good('assets/score.m4a');
  else note('no assets/score.m4a yet (encode the score before rendering the film)');
  if (existsSync(join(dir, 'out/film.mp4'))) good('out/film.mp4');
  // the dependencies the engine needs
  if (!existsSync(join(dir, 'node_modules/puppeteer-core'))) {
    // the skill's own template is not a project: a scaffolded copy installs its own dependency
    if (skillMode) note('the template has no node_modules (a scaffolded project installs puppeteer-core)');
    else fail('puppeteer-core is not installed (npm install in the project)');
  } else good('puppeteer-core installed');
}

if (skillMode) {
  if (existsSync(join(skillRoot, 'template/studio.html'))) checkProject(join(skillRoot, 'template'));
} else {
  checkProject(target);
}

// ---------- report ---------------------------------------------------------
for (const s of ok) console.log('  ok   ' + s);
for (const s of notes) console.log('  note ' + s);
for (const s of problems) console.log('  FAIL ' + s);
console.log('');
if (problems.length) {
  console.log(`preflight: ${problems.length} problem(s), ${notes.length} note(s). Fix the FAIL lines before rendering.`);
  process.exit(1);
}
console.log(`preflight: clean (${notes.length} note(s)).`);
