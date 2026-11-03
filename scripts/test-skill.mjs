// scripts/test-skill.mjs — Tests A, B (catalog-side) and G: does the *installed* skill hold up?
//
//   node scripts/test-skill.mjs                  # test the installed skill (~/.dsh/skills/dsh-cinema)
//   node scripts/test-skill.mjs <path>           # test any copy of the skill
//
// It answers, with real reads rather than a claim: are the files the skill promises present, does the frontmatter match the
// DSH loader's vocabulary, and is every reference and template it points at readable. Auto-invocation and `/dsh-cinema`
// are model/host behaviour and are NOT tested here — see tests/C in the release notes.
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';

const DEFAULT = join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'skills', 'dsh-cinema');
const ROOT = process.argv[2] || DEFAULT;
if (!existsSync(join(ROOT, 'SKILL.md'))) { console.error('not a skill directory: ' + ROOT); process.exit(2); }

const results = [];
const check = (id, name, fn) => {
  try { results.push({ id, name, pass: true, detail: fn() || '' }); }
  catch (e) { results.push({ id, name, pass: false, detail: String(e.message || e) }); }
};
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
const text = (p) => readFileSync(join(ROOT, p), 'utf8');

// ---- A. files the skill promises ------------------------------------------------------------
check('A1', 'required documents exist', () => {
  const required = ['SKILL.md', 'README.md', 'LICENSE', 'CHANGELOG.md', 'CONTRIBUTING.md', 'SECURITY.md', 'NOTICE',
    'AGENTS.md', 'examples/README.md', 'scripts/preflight.mjs', 'scripts/render-check.mjs', 'scripts/test-skill.mjs',
    'scripts/install.ps1', 'scripts/update.ps1', 'scripts/publish.ps1'];
  const missing = required.filter((f) => !existsSync(join(ROOT, f)));
  assert(!missing.length, 'missing: ' + missing.join(', '));
  return `${required.length} root documents/scripts`;
});
check('A2', 'frontmatter matches the DSH loader contract', () => {
  const raw = readFileSync(join(ROOT, 'SKILL.md'));
  assert(!(raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf), 'SKILL.md has a BOM');
  const s = raw.toString('utf8');
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(s);
  assert(fm, 'no frontmatter');
  const one = (k) => (new RegExp('^' + k + ':[ \\t]*(.+)$', 'm').exec(fm[1]) || [])[1];
  const name = one('name');
  assert(name === 'dsh-cinema', 'name is ' + name);
  const desc = one('description');
  assert(desc && desc.length > 100 && desc.length <= 500, 'description length ' + (desc || '').length);
  assert(!desc.includes(': '), 'description has a YAML hazard');
  assert(one('whenToUse'), 'no whenToUse');
  assert(/^user-invocable:[ \t]*true/m.test(fm[1]), 'user-invocable is not true');
  assert(!/^disable-model-invocation:/m.test(fm[1]), 'model invocation is disabled');
  for (const bad of ['allowed-tools', 'argument-hint', 'modelInvocable', 'userInvocable', 'disableModelInvocation']) {
    assert(!new RegExp('^' + bad + ':', 'm').test(fm[1]), 'unsupported key: ' + bad);
  }
  return `name=dsh-cinema, description=${desc.length} chars, whenToUse=${one('whenToUse').length} chars, model+user invocable`;
});
check('A3', 'the engine and both films are present', () => {
  const engine = ['layers.js', 'ambient.js', 'budget.js', 'sky.js', 'materials.js', 'renderer.js', 'character.js', 'props.js', 'camera.js', 'qa.js', 'main.js'];
  const missing = engine.filter((f) => !existsSync(join(ROOT, 'template/src/engine', f)));
  assert(!missing.length, 'missing engine: ' + missing.join(', '));
  const shots = ['w1_field.js', 'w2_close.js', 's1_field.js', 's2_approach.js', 's3_hands.js', 's4_flight.js', 's5_after.js'];
  const ms = shots.filter((f) => !existsSync(join(ROOT, 'template/src/shots', f)));
  assert(!ms.length, 'missing shots: ' + ms.join(', '));
  return `${engine.length} modules, ${shots.length} shots (2.5D film + 3D regression film)`;
});

// ---- G. everything the skill points at is readable -----------------------------------------
check('G1', 'every references/ and templates/ file named by SKILL.md is readable', () => {
  const s = text('SKILL.md');
  const named = new Set();
  for (const m of s.matchAll(/`((?:references|templates)\/[A-Za-z0-9._-]+\.md)`/g)) named.add(m[1]);
  assert(named.size >= 8, 'SKILL.md names only ' + named.size + ' documents');
  let chars = 0;
  for (const rel of named) {
    const p = join(ROOT, rel);
    assert(existsSync(p), 'missing: ' + rel);
    const body = readFileSync(p, 'utf8');
    assert(body.length > 800, rel + ' is suspiciously short (' + body.length + ' chars)');
    assert(/^#\s/m.test(body), rel + ' has no heading');
    chars += body.length;
  }
  return `${named.size} documents, ${(chars / 1024).toFixed(0)} KB read`;
});
check('G2', 'the document sets are complete', () => {
  const refs = ['visual-language.md', 'directing.md', 'cinematography.md', '2.5d-scene-system.md', 'panoramic-composition.md',
    'detail-density.md', 'procedural-materials.md', 'motion-system.md', 'environment-animation.md', 'scene-complexity-budget.md',
    'visual-quality-control.md', 'continuity.md', 'sound-design.md', 'technical-qa.md', 'character-animation.md'];
  const missing = refs.filter((f) => !existsSync(join(ROOT, 'references', f)));
  assert(!missing.length, 'missing references: ' + missing.join(', '));
  const tpl = ['CREATIVE_BIBLE.md', 'STORYBOARD.md', 'SHOT_LIST.md', 'SHOT_SPEC.md', 'QA_REPORT.md'];
  const mt = tpl.filter((f) => !existsSync(join(ROOT, 'templates', f)));
  assert(!mt.length, 'missing templates: ' + mt.join(', '));
  return `${refs.length} references + ${tpl.length} templates`;
});
check('G3', 'the examples carry their documents and evidence', () => {
  for (const e of ['wind-past-the-piano', 'piano-in-the-field']) {
    for (const f of ['README.md', 'CREATIVE_BIBLE.md', 'STORYBOARD.md', 'SHOT_LIST.md', 'QA_REPORT.md']) {
      assert(existsSync(join(ROOT, 'examples', e, f)), `missing examples/${e}/${f}`);
    }
    assert(statSync(join(ROOT, 'examples', e, 'stills')).isDirectory(), `missing examples/${e}/stills`);
  }
  return 'both examples complete (documents + stills)';
});

const pad = (s, n) => String(s).padEnd(n);
console.log(`\nskill under test: ${ROOT}`);
for (const r of results) console.log(`  ${r.pass ? 'PASS' : 'FAIL'}  ${pad(r.id, 3)} ${pad(r.name, 52)} ${r.detail}`);
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
