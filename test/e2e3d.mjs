import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';

const root = path.resolve('dist');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/json' };
const server = http.createServer((req, res) => {
  const u = req.url.split('?')[0];
  const p = path.join(root, u === '/' ? 'index.html' : u);
  fs.readFile(p, (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(4174);

const out = [];
const note = (m) => { out.push(m); console.log(m); };
fs.mkdirSync('test-output', { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
console.log('cpus', (await import('node:os')).cpus().length);
page.on('console', (m) => { if (m.type() === 'error') note(`console.error: ${m.text().slice(0, 300)}`); else if (m.text().startsWith('[perf]')) note(m.text()); });
page.on('pageerror', (e) => note(`pageerror: ${e.message.slice(0, 300)}`));

let step = 'open app';
try {
  await page.goto('http://localhost:4174/');
  await page.waitForTimeout(1500);
  step = 'click New Design';
  await page.getByText('New Design', { exact: true }).first().click();
  await page.waitForTimeout(500);
  step = 'create design';
  await page.locator('button.flex-\\[2\\]').first().click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-output/step-after-create.png' });
  step = 'click SIM mode';
  const clicked = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => (x.innerText || '').trim().toUpperCase() === 'SIM');
    if (!b) return 'no SIM button found'; b.click(); return 'clicked disabled=' + b.disabled;
  });
  note('SIM: ' + clicked);
  const t0 = Date.now();
  await Promise.race([page.evaluate(() => 1), new Promise((_, rej) => setTimeout(() => rej(new Error('main thread still blocked after 150s: likely endless loop')), 150000))]);
  note(`SIM screen became responsive after ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  const t1 = Date.now();
  step = 'click 3D View';
  page.setDefaultTimeout(60000);
  await page.getByText('3D View', { exact: true }).first().click({ timeout: 150000 });
  note(`3D tab clickable after ${((Date.now() - t1) / 1000).toFixed(1)}s`);
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'test-output/step-3d.png' });
  step = 'inspect';
  const info = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    if (!c) return { canvas: 'NO CANVAS', body: document.body.innerText.slice(0, 300).replace(/\n/g, ' | ') };
    const chain = [];
    let el = c.parentElement;
    for (let i = 0; i < 7 && el; i++) { chain.push(`${el.tagName.toLowerCase()}[${el.clientWidth}x${el.clientHeight}]`); el = el.parentElement; }
    const err = [...document.querySelectorAll('div')].find(d => d.innerText && d.innerText.startsWith('3D view problem'));
    return { canvas: `${c.width}x${c.height} css ${c.clientWidth}x${c.clientHeight}`, chain: chain.join(' < '), glError: err ? err.innerText : null };
  });
  note('info: ' + JSON.stringify(info));
  const png = PNG.sync.read(fs.readFileSync('test-output/step-3d.png'));
  const seen = new Set(); let bright = 0;
  for (let i = 0; i < png.data.length; i += 4 * 40) {
    seen.add((png.data[i] >> 4) + ',' + (png.data[i + 1] >> 4) + ',' + (png.data[i + 2] >> 4));
    if (png.data[i] + png.data[i + 1] + png.data[i + 2] > 600) bright++;
  }
  note(`screen colours: ${seen.size}`);
  const ok = info.canvas !== 'NO CANVAS' && !info.glError && out.filter(l => l.startsWith('pageerror')).length === 0;
  note(ok ? 'RESULT: app 3D view opened without errors' : 'RESULT: app 3D view FAILED');
  fs.writeFileSync('test-output/e2e.txt', out.join('\n'));
  await browser.close(); server.close();
  process.exit(ok ? 0 : 1);
} catch (e) {
  note(`FAILED at step "${step}": ${String(e.message).split('\n')[0]}`);
  try {
    await page.screenshot({ path: 'test-output/step-fail.png' });
    const btns = await page.evaluate(() => [...document.querySelectorAll('button')].filter(b => b.offsetParent).map(b => (b.innerText || b.title || b.getAttribute('aria-label') || '?').trim().replace(/\s+/g, ' ').slice(0, 24)).filter(Boolean));
    note('visible buttons: ' + btns.join(' ; ').slice(0, 700));
    note('body: ' + (await page.evaluate(() => document.body.innerText.slice(0, 400).replace(/\n/g, ' | '))));
  } catch (e2) { note('diag failed: ' + e2.message.slice(0, 120)); }
  fs.writeFileSync('test-output/e2e.txt', out.join('\n'));
  await browser.close(); server.close();
  process.exit(1);
}
