// The check that matters for the interior: with the flesh translucent and the
// fruit sliced open, can you actually SEE the seeds? Renders a cut-open plate for
// each seed archetype into examples/cut-*.png.
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { WebSocket } from 'ws';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'examples');
mkdirSync(OUT, { recursive: true });

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL = process.env.URL || 'http://localhost:5174/';
const PORT = 9232;

// One fruit per seed archetype — the whole point is that these look different.
const CASES = [
  { id: 'dragonfruit', cut: 0.55, label: 'dispersed' },
  { id: 'apple', cut: 0.62, label: 'core / carpel star' },
  { id: 'carambola', cut: 0.55, label: 'radial locules' },
  { id: 'cherimoya', cut: 0.6, label: 'seed under each areole' },
  { id: 'lychee', cut: 0.6, label: 'single stone' },
  { id: 'kiwano', cut: 0.6, label: 'central cavity' },
  { id: 'durian', cut: 0.62, label: 'five locules' },
  { id: 'dragonfruit', cut: 0.0, label: 'whole, translucent' },
];

const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`,
  '--disable-gpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--window-size=900,900', '--no-first-run', '--user-data-dir=/tmp/fruitinterior', 'about:blank']);
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
const errors = [];
ws.on('message', (d) => {
  const m = JSON.parse(d.toString());
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails?.text);
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
    errors.push(m.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 400));
  }
});
const send = (method, params = {}) => new Promise((res) => {
  const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params }));
});
const evalJs = async (expr) =>
  (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result.value;

await send('Page.enable');
await send('Runtime.enable');
await send('Page.navigate', { url: URL });
// Poll for readiness rather than guessing a sleep: a cold load of the production
// bundle over the network takes far longer than a local dev one, and a fixed wait
// that's fine on localhost reports the live site as "not the fruit app".
let ready = false;
for (let i = 0; i < 40 && !ready; i++) {
  await sleep(500);
  ready = await evalJs('typeof window.FRUIT !== "undefined" && !!window.FRUIT.fruit()');
}
if (!ready) {
  console.error(`ERROR: ${URL} never became ready (no window.FRUIT).`);
  if (errors.length) console.error(errors.join('\n'));
  process.exit(1);
}
await evalJs(`document.querySelectorAll('.lil-gui, #title, #hud, #loader, #panel-tab').forEach(e => e.style.display='none');
             window.FRUIT.params.__ || true;`);
// Stop the turntable so the cut face reliably points at the camera.
await evalJs(`window.FRUIT.params && (document.querySelector('canvas'), true);`);

for (const c of CASES) {
  await evalJs(`window.FRUIT.setSpecies(${JSON.stringify(c.id)}); window.FRUIT.setCut(${c.cut}); true;`);
  await sleep(1500);
  const seeds = await evalJs(`window.FRUIT.fruit().stats.seeds`);
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  const name = `cut-${c.id}${c.cut === 0 ? '-whole' : ''}.png`;
  if (shot?.data) writeFileSync(join(OUT, name), Buffer.from(shot.data, 'base64'));
  console.log(`  ${name.padEnd(26)} ${String(seeds).padStart(4)} seeds  (${c.label})`);
}

console.log(errors.length ? `\nPAGE ERRORS:\n${errors.join('\n')}` : '\nno page errors');
ws.close(); chrome.kill(); process.exit(errors.length ? 1 : 0);
