// scripts/render-check.mjs — the repository's own integrity check, usable by CI and by the installer.
//
//   node scripts/render-check.mjs            # verify the skill tree (files, frontmatter, references, BOM, links)
//   node scripts/render-check.mjs --json     # machine-readable result
//
// It answers three questions the loader cares about:
//   1. will DSH discover this skill?  (SKILL.md at the root, parseable frontmatter, kebab-case name matching the folder)
//   2. is every file the skill promises actually there, and does every path it mentions resolve?
//   3. is the tree clean enough to publish?  (no BOMs, no absolute paths, no node_modules or renders committed)
//
// Exit code 0 = publishable, 1 = problems listed.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, basename, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = basename(HERE) === 'scripts' ? dirname(HERE) : HERE;
const JSON_OUT = process.argv.includes('--json');

const problems = [];
const notes = [];
const ok = (m) => notes.push(['ok', m]);
const bad = (m) => problems.push(m);
const warn = (m) => notes.push(['note', m]);

// ---------------------------------------------------------------- 1. will DSH discover it?
const skillPath = join(ROOT, 'SKILL.md');
if (!existsSync(skillPath)) {
  bad('SKILL.md is missing at the repository root (DSH discovers <root>/<name>/SKILL.md)');
} else {
  const raw = readFileSync(skillPath);
  if (raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf) bad('SKILL.md starts with a UTF-8 BOM — DSH will ignore the skill');
  const text = raw.toString('utf8');
  const fm = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  if (!fm) {
    bad('SKILL.md has no YAML frontmatter');
  } else {
    const body = fm[1];
    const one = (key) => {
      // a plain single-line scalar is all this loader needs; block scalars are accepted too
      const m = new RegExp('^' + key + ':[ \\t]*(.*)$', 'm').exec(body);
      return m ? m[1].trim() : '';
    };
    const name = one('name');
    const description = one('description');
    const whenToUse = one('whenToUse');
    if (!name) bad('frontmatter has no name');
    else if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) bad(`frontmatter name is not kebab-case: ${name}`);
    else if (name !== basename(ROOT)) bad(`frontmatter name "${name}" does not match the skill directory "${basename(ROOT)}"`);
    else ok(`frontmatter name: ${name} (matches the directory)`);
    if (!description) bad('frontmatter has no description (the catalog shows it, and the model routes on it)');
    else if (description.includes(': ')) bad('description contains ": " — unquoted YAML would parse it as a nested mapping; use a dash or a comma');
    else if (description.length > 500) bad(`description is ${description.length} chars; the DSH catalog caps around 500 including the name`);
    else ok(`frontmatter description: ${description.length} chars, no YAML hazard`);
    if (!whenToUse) warn('frontmatter has no whenToUse — the model has less to route on');
    else ok(`frontmatter whenToUse: ${whenToUse.length} chars`);
    for (const legacy of ['modelInvocable', 'userInvocable', 'disableModelInvocation', 'allowed-tools', 'argument-hint']) {
      if (new RegExp('^' + legacy + ':', 'm').test(body)) bad(`frontmatter uses "${legacy}", which DSH rejects; the supported keys are disable-model-invocation and user-invocable`);
    }
    for (const key of ['disable-model-invocation', 'user-invocable']) {
      const v = one(key);
      if (v && !/^(true|false|yes|no|on|off|1|0)$/i.test(v)) bad(`frontmatter ${key} must be a boolean, got "${v}"`);
    }
    if (/^disable-model-invocation:[ \t]*true/im.test(body)) bad('disable-model-invocation: true makes the skill user-only; it would never be routed to automatically');
    ok('frontmatter is model-invocable and user-invocable');
  }
}

// ---------------------------------------------------------------- 2. the files the skill promises
const REQUIRED = [
  'SKILL.md', 'README.md', 'LICENSE', 'CHANGELOG.md', 'CONTRIBUTING.md', 'SECURITY.md', 'NOTICE', 'AGENTS.md',
  'examples/README.md',
  'scripts/preflight.mjs', 'scripts/render-check.mjs', 'scripts/install.ps1', 'scripts/update.ps1',
];
for (const f of REQUIRED) if (!existsSync(join(ROOT, f))) bad(`required file missing: ${f}`);

const count = (dir, filter = () => true) => {
  const p = join(ROOT, dir);
  if (!existsSync(p)) return 0;
  return readdirSync(p).filter((n) => statSync(join(p, n)).isFile() && filter(n)).length;
};
const refs = count('references', (n) => n.endsWith('.md'));
const templates = count('templates', (n) => n.endsWith('.md'));
if (refs < 10) bad(`references/ has only ${refs} documents (the skill promises the full set)`);
else ok(`references/: ${refs} documents`);
if (templates < 4) bad(`templates/ has only ${templates} documents`);
else ok(`templates/: ${templates} documents`);

// every relative path mention in SKILL.md must resolve
if (existsSync(skillPath)) {
  const text = readFileSync(skillPath, 'utf8');
  const mentions = new Set();
  for (const m of text.matchAll(/`([A-Za-z0-9_./-]+\.(?:md|mjs|js|json|ps1|html))`/g)) mentions.add(m[1]);
  let resolved = 0;
  for (const rel of mentions) {
    const candidates = [join(ROOT, rel), join(ROOT, 'template', 'src', rel), join(ROOT, 'template', rel)];
    if (candidates.some((p) => existsSync(p))) resolved++;
    else bad(`SKILL.md mentions ${rel}, which does not exist`);
  }
  ok(`SKILL.md: ${resolved}/${mentions.size} referenced paths resolve`);
}

// the engine files the skill's own engine map names
const ENGINE = ['layers.js', 'ambient.js', 'budget.js', 'sky.js', 'materials.js', 'renderer.js', 'character.js', 'props.js', 'camera.js', 'qa.js', 'main.js'];
for (const f of ENGINE) if (!existsSync(join(ROOT, 'template', 'src', 'engine', f))) bad(`engine file missing: template/src/engine/${f}`);
const shots = count(join('template', 'src', 'shots'), (n) => n.endsWith('.js'));
if (shots < 2) bad(`template/src/shots/ has only ${shots} shot files`);
else ok(`template: ${ENGINE.length} engine modules, ${shots} shots`);

// ---------------------------------------------------------------- 3. clean tree
// node_modules/ and out/ are renders or dependencies and must never be part of the tree. `.git` is expected in a checkout
// (git cannot track it), so it is skipped without complaint.
const SKIP_DIRS = ['.git'];
const FORBIDDEN_DIRS = ['node_modules', 'out'];
const walk = (dir, out = []) => {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (SKIP_DIRS.includes(n)) continue;
      if (FORBIDDEN_DIRS.includes(n)) {
        if (dir === ROOT) bad(`${n}/ must not be committed at the repository root`);
        continue;
      }
      walk(p, out);
    } else out.push(p);
  }
  return out;
};
const files = walk(ROOT);
let bom = 0, abs = 0;
for (const f of files) {
  const ext = extname(f);
  if (!['.md', '.js', '.mjs', '.json', '.html', '.ps1', '.yml'].includes(ext)) continue;
  const b = readFileSync(f);
  if (b.length > 3 && b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) { bom++; bad(`UTF-8 BOM: ${relative(ROOT, f)}`); }
  const t = b.toString('utf8');
  if (/[A-Z]:\\\\Users\\\\|C:\\\\Users\\\\Ray/.test(t)) { abs++; bad(`absolute local path in ${relative(ROOT, f)} — leaks a machine path`); }
}
ok(`tree: ${files.length} files, ${bom} BOMs, ${abs} absolute paths`);

// ---------------------------------------------------------------- report
const result = { root: ROOT, ok: problems.length === 0, problems, notes: notes.map(([k, m]) => `${k}  ${m}`) };
if (JSON_OUT) {
  console.log(JSON.stringify(result, null, 2));
} else {
  for (const [k, m] of notes) console.log(`  ${k.padEnd(4)} ${m}`);
  for (const p of problems) console.log(`  FAIL ${p}`);
  console.log(result.ok ? '\nrender-check: publishable' : `\nrender-check: ${problems.length} problem(s)`);
}
process.exit(result.ok ? 0 : 1);
