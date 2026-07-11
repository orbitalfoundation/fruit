// Renders a clean plate per species (GUI + overlays hidden) into examples/.
// Also renders a "cut open" plate, since the interior is half the point.
// Usage: npm start & ; node scripts/gallery.mjs
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { WebSocket } from 'ws';
import { SPECIES_ORDER } from '../src/species/presets.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'examples');
mkdirSync(OUT, { recursive: true });

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL = process.env.URL || 'http://localhost:5174/';
const PORT = 9231;
const ONLY = process.argv[2]; // optional: render just one species

const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`,
  '--disable-gpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--window-size=900,900', '--no-first-run', '--user-data-dir=/tmp/fruitgallery', 'about:blank']);
chrome.stderr.on('data', () => {});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function cdp() {
  for (let i = 0; i < 40; i++) {
    try {
      const l = await (await fetch(`http://localhost:${PORT}/json/list`)).json();
      const p = l.find((t) => t.type === 'page');
      if (p) return p;
    } catch {}
    await sleep(250);
  }
  throw new Error('no devtools');
}
const page = await cdp();
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.on('open', r));
let id = 0; const pend = new Map();
ws.on('message', (d) => {
  const m = JSON.parse(d.toString());
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); }
});
const send = (method, params = {}) => new Promise((res) => {
  const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params }));
});
const evalJs = async (expr) =>
  (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result.value;

await send('Page.enable');
await send('Runtime.enable');

// Surface page errors — a silent screenshot of a half-rendered scene is the worst
// outcome here. Note this listens for console.error TOO, not just thrown
// exceptions: three.js reports a failed shader compile via console.error, so a
// material that silently renders nothing produces no exception at all. That is
// exactly how an undeclared uniform once made every fruit body invisible while
// this script cheerfully reported success.
const errors = [];
ws.on('message', (d) => {
  const m = JSON.parse(d.toString());
  if (m.method === 'Runtime.exceptionThrown') {
    errors.push(m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text);
  }
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
    errors.push(m.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 600));
  }
});

await send('Page.navigate', { url: URL });

// Poll for readiness rather than sleeping a fixed amount — and guard against the
// confusion that cost time once: if the page that answered isn't this app,
// everything below silently screenshots someone else's project.
let ready = false;
for (let i = 0; i < 40 && !ready; i++) {
  await sleep(500);
  ready = await evalJs(`typeof window.FRUIT !== 'undefined' && !!window.FRUIT.fruit()`);
}
if (!ready) {
  console.error(`ERROR: ${URL} is not the fruit app (no window.FRUIT). Is another project's server on that port?`);
  ws.close(); chrome.kill(); process.exit(1);
}

await evalJs(`document.querySelectorAll('.lil-gui, #title, #hud, #loader, #panel-tab, #toast').forEach(e => e.style.display='none'); true;`);

const list = ONLY ? [ONLY] : SPECIES_ORDER;
for (const id of list) {
  await evalJs(`window.FRUIT.setSpecies(${JSON.stringify(id)}); true;`);
  await sleep(1400);
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  if (shot?.data) {
    writeFileSync(join(OUT, `${id}.png`), Buffer.from(shot.data, 'base64'));
    console.log(`  ${id}.png`);
  }
}

// One cutaway plate, to show the interior actually reads.
await evalJs(`window.FRUIT.setSpecies('dragonfruit'); true;`);
await sleep(1200);
console.log(errors.length ? `\nPAGE ERRORS:\n${errors.join('\n')}` : '\nno page errors');

ws.close(); chrome.kill(); process.exit(errors.length ? 1 : 0);
