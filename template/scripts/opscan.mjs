// scripts/opscan.mjs - find the exact draw command that hangs a frame, by executing the queue one op at a time.
//   node scripts/opscan.mjs 10.0 --film=wind [--timeout=2500]
// The frame is prepared (sky + every plate/geometry call queue their ops), sorted, then each op's draw closure is invoked
// in its own evaluate call. A hanging op times out and is reported with its layer, depth and kind.
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const t = +(args.t || process.argv[2] || 0);
const timeout = +(args.timeout || 2500);
const CHROMES = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome'].filter(Boolean);
const CHROME = CHROMES.find((p) => existsSync(p));
const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true, protocolTimeout: 0,
  args: ['--allow-file-access-from-files', '--ignore-gpu-blocklist', '--use-angle=d3d11'],
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[page error]', e.message));
await page.goto(pathToFileURL(resolve('studio.html')).href + '?render' + (args.film ? '&film=' + args.film : ''), { waitUntil: 'networkidle0' });
await page.waitForFunction('window.ready === true', { timeout: 60000 });
const info = await page.evaluate((tt) => {
  const def = shotAt(tt).def;
  const lt = tt - def.start;
  lightReset(); def.light(lt, tt);
  const cam = readCamera(def.cam(lt), lt);
  sceneBegin(cam, Math.round(tt * 24));
  drawSky(ctx, cam, tt, typeof def.sky === 'function' ? def.sky(tt, lt) : (def.sky || {}));
  def.draw({ ctx, t: tt, lt, dur: def.dur, cam, frameNo: Math.round(tt * 24) });
  const ops = SCENE.ops.slice().sort((a, b) => (a.layer - b.layer) || (b.z - a.z) || (a.order - b.order));
  window.__OPS = ops;
  return { n: ops.length, layers: [...new Set(ops.map((o) => o.layer))] };
}, t);
console.log(`frame ${t}s: ${info.n} ops, layers ${info.layers.join(',')}`);
let bad = -1;
for (let i = 0; i < info.n; i++) {
  const res = await Promise.race([
    page.evaluate((idx) => {
      const o = window.__OPS[idx];
      const a = performance.now();
      o.draw(ctx);
      return { ms: Math.round(performance.now() - a) };
    }, i).then((v) => ({ ok: true, v })).catch((e) => ({ ok: false, err: String(e).slice(0, 120) })),
    new Promise((r) => setTimeout(() => r({ ok: false, err: 'HANG' }), timeout)),
  ]);
  if (!res.ok) {
    bad = i;
    const meta = await Promise.race([
      page.evaluate((idx) => { const o = window.__OPS[idx]; return { layer: o.layer, z: +o.z.toFixed(2), tag: o.tag || '(3d)', kind: o.kind || '3d' }; }, i),
      new Promise((r) => setTimeout(() => r({ note: 'page unresponsive' }), 1500)),
    ]);
    console.log(`op ${i}/${info.n}  ${res.err}  ${JSON.stringify(meta)}`);
    break;
  }
  if (res.v.ms > 250) console.log(`op ${i} slow: ${res.v.ms} ms`);
  if (i % 200 === 0) console.log(`... ${i}/${info.n} ops drawn`);
}
if (bad < 0) console.log('no hanging op: every op drew in under ' + timeout + ' ms');
await browser.close();
