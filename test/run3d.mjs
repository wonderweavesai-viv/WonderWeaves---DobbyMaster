import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';

const root = path.resolve('dist-test');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const p = path.join(root, req.url.split('?')[0] === '/' ? 'harness3d.html' : req.url.split('?')[0]);
  fs.readFile(p, (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(4173);

const out = [];
const note = (m) => { out.push(m); console.log(m); };
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) note(`console.${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => note(`pageerror: ${e.message}`));
await page.goto('http://localhost:4173/');
await page.waitForTimeout(4000);

const info = await page.evaluate(() => {
  const gl = document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl');
  const c = document.querySelector('canvas');
  return { webgl: !!gl, canvas: c ? `${c.width}x${c.height} (css ${c.clientWidth}x${c.clientHeight})` : 'NO CANVAS', errors: window.__errors, text: document.body.innerText.slice(0, 400) };
});
note('info: ' + JSON.stringify(info));

fs.mkdirSync('test-output', { recursive: true });
const buf = await page.screenshot({ path: 'test-output/3d.png' });
const png = PNG.sync.read(buf);
const seen = new Set();
let bright = 0;
for (let i = 0; i < png.data.length; i += 4 * 50) {
  seen.add((png.data[i] >> 4) + ',' + (png.data[i + 1] >> 4) + ',' + (png.data[i + 2] >> 4));
  if (png.data[i] + png.data[i + 1] + png.data[i + 2] > 150) bright++;
}
note(`render check: ${seen.size} distinct colours, ${bright} bright samples`);
const ok = info.canvas !== 'NO CANVAS' && seen.size > 12 && bright > 200;
note(ok ? 'RESULT: 3D view rendered' : 'RESULT: 3D view did NOT render');
fs.writeFileSync('test-output/result.txt', out.join('\n'));
await browser.close();
server.close();
process.exit(ok ? 0 : 1);
