// scripts/scan.mjs - call a page function for a list of times and report which ones hang or throw.
//   node scripts/scan.mjs 8.0,9.0,9.5,10.0 --film=wind [--timeout=15000]
// The page is opened once; each time is evaluated with a race timeout, so one bad frame does not stop the scan.
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { homedir } from 'node:os';

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const times = String(args.t || process.argv[2] || '0').split(',').map(Number);
const timeout = +(args.timeout || 15000);
const CHROMES = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean);
const CHROME = CHROMES.find((p) => existsSync(p));
if (!CHROME) { console.error('Chrome not found'); process.exit(1); }
const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true, protocolTimeout: 0,
  args: ['--allow-file-access-from-files', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--window-size=1920,1080'],
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[page error]', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('[console]', m.text()); });
await page.goto(pathToFileURL(resolve('studio.html')).href + '?render' + (args.film ? '&film=' + args.film : ''), { waitUntil: 'networkidle0' });
await page.waitForFunction('window.ready === true', { timeout: 60000 });
for (const t of times) {
  const t0 = Date.now();
  const res = await Promise.race([
    page.evaluate(async (tt) => {
      const a = performance.now();
      window.renderAt(tt, 'image/jpeg', 0.5);
      const d = performance.now() - a;
      const b = SCENE.budget ? SCENE.budget.measured : null;
      return { ms: Math.round(d), ops: SCENE.ops.length, budget: b };
    }, t).then((v) => ({ ok: true, v })).catch((e) => ({ ok: false, err: String(e).slice(0, 200) })),
    new Promise((r) => setTimeout(() => r({ ok: false, err: 'HANG (>' + timeout + ' ms)' }), timeout)),
  ]);
  console.log(`${t.toFixed(2)}s  ${res.ok ? 'ok   ' + JSON.stringify(res.v) : 'FAIL ' + res.err}  (${Date.now() - t0} ms)`);
  if (!res.ok && String(res.err).startsWith('HANG')) {
    console.log('  -> the page is stuck in a synchronous draw; restarting the page');
    await browser.close();
    process.exit(2);
  }
}
await browser.close();
