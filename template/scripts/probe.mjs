// scripts/probe.mjs - evaluate an expression inside the film page, after boot, and print the result.
//
// The fastest way to find out why a figure looks wrong: ask the page where the joints actually are, in metres.
//   node scripts/probe.mjs "solveSkeleton(womanPoseOnKey(10.5)).wristL"
//   node scripts/probe.mjs "womanKeyPoint()" "womanKeyDepth(4.3)"
//   node scripts/probe.mjs "JSON.stringify(registryReport())"
// Every expression is evaluated in the page's global scope, one at a time, and printed as JSON.
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { homedir } from 'node:os';
import { readdirSync } from 'node:fs';

const CHROMES = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium', ...playwrightChromes()];
function playwrightChromes() {
  const dir = `${homedir()}/.cache/ms-playwright`;
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((n) => /^chromium-\d+$/.test(n)).sort((a, b) => b.split('-')[1] - a.split('-')[1]).map((n) => `${dir}/${n}/chrome-linux64/chrome`);
}
const CHROME = CHROMES.find((p) => p && existsSync(p));
if (!CHROME) { console.error('Chrome not found: set CHROME_PATH'); process.exit(1); }
const exprs = process.argv.slice(2);
if (!exprs.length) { console.error('usage: node scripts/probe.mjs "<expression>" ["<expression>" ...]'); process.exit(1); }
const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true, protocolTimeout: 0,
  args: ['--allow-file-access-from-files', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--window-size=1280,720'],
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[page error]', e.message));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warn') console.log(`[page ${m.type()}]`, m.text()); });
await page.goto(pathToFileURL(resolve('studio.html')).href + '?render', { waitUntil: 'networkidle0' });
await page.waitForFunction('window.ready === true', { timeout: 60000 });
for (const e of exprs) {
  const out = await page.evaluate((src) => {
    try {
      const v = (0, eval)(src);
      return typeof v === 'function' ? String(v) : JSON.stringify(v, (k, val) => (typeof val === 'number' ? Math.round(val * 10000) / 10000 : val));
    } catch (err) { return 'ERROR: ' + err.message; }
  }, e);
  console.log(`${e}\n  -> ${out}`);
}
await browser.close();
