import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import GUI from 'lil-gui';

import { makeSpecies, SPECIES, SPECIES_ORDER } from './species/presets.js';
import { morphParams, clone } from './core/params.js';
import { ARRANGEMENTS } from './core/math.js';
import { Fruit } from './geom/fruit.js';
import { SEED_MODES } from './geom/seeds.js';
import { makeMaterials, applySkin } from './shading/materials.js';
import { buildTable } from './scene/environment.js';
import { buildJungle } from './scene/jungle.js';
import { buildLensFlare } from './scene/lensflare.js';
import { encodeGenome, encodeGenomeSync, decodeGenome } from './genome.js';

const app = document.getElementById('app');

// ---- renderer / scene / camera ------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.localClippingEnabled = true; // the cutaway plane
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.001, 500);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.autoRotateSpeed = 1.2;
controls.minDistance = 0.01;
controls.maxDistance = 40;

// Two backdrops. The jungle is the default — these are tropical fruit, and a black
// studio was both boring and a lie about where they come from. The studio is kept for
// clean gallery plates, where a busy background just fights the subject.
const jungle = buildJungle(scene, renderer);
const table = buildTable(scene);
const flare = buildLensFlare(renderer);

// ---- the cutaway --------------------------------------------------------------
// A single clipping plane the user can slide through the fruit. This is the whole
// reason the flesh is translucent in the first place: the seeds are the payoff, and
// the fastest way to see them is to cut the thing in half.
const clipPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 10);
const clipPlanes = [clipPlane];

// ---- state --------------------------------------------------------------------
let params = makeSpecies('durian');
let genomeBase = { s: 'durian' };
let currentSpecies = 'durian';
let materials = makeMaterials(params, clipPlanes);
let fruit = null;

const ui = {
  blendTo: 'dragonfruit',
  morph: 0,
  backdrop: 'jungle',
  dapple: 1.0,
  canopy: 0.62,
  sunElevation: 52,
  sunAzimuth: 40,
  flare: true,
  autoRotate: true,
  cut: 0,          // 0 = whole fruit, 1 = sliced right through
  showTable: true,
  wireframe: false,
};

function frameCamera(preserve = false) {
  const s = fruit.span;
  const dist = s * 1.85 + 0.02;
  if (!preserve) {
    camera.position.set(s * 0.55, s * 0.35, dist);
    controls.target.set(0, 0, 0);
  } else {
    const dir = camera.position.clone().sub(controls.target);
    if (dir.lengthSq() < 1e-12) dir.set(0, 0, 1);
    camera.position.copy(controls.target).addScaledVector(dir.normalize(), dist);
  }
  camera.near = Math.max(0.0005, s * 0.005);
  camera.far = s * 200 + 10;
  camera.updateProjectionMatrix();
  const domeR = jungle.setScale(s);
  camera.far = domeR * 2.5;
  camera.updateProjectionMatrix();
  table.setScale(s, -params.scale * 0.5);
  updateCut();
}

function rebuild(preserveCamera = true) {
  if (fruit) { scene.remove(fruit); fruit.dispose(); }
  // The materials outlive the mesh, so every rebuild has to re-push the palette —
  // otherwise switching preset swaps the geometry and leaves the previous fruit's
  // colours on it, and every fruit in the set comes out durian-coloured.
  applySkin(materials, params);
  fruit = new Fruit(params, materials);
  fruit.traverse((o) => { if (o.isMesh || o.isInstancedMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(fruit);
  frameCamera(preserveCamera);
  updateLabels();
}

/**
 * The clipping plane sweeps from just outside the fruit to a little past its
 * middle. It has to be calibrated to the fruit's DEPTH, not its height — scaling
 * the sweep by `scale` meant the plane never reached into anything slimmer than
 * it was tall, so a dragon fruit simply refused to be cut.
 */
function updateCut() {
  if (!fruit) return;
  clipPlane.constant = fruit.zHalf * (1.02 - ui.cut * 1.3);
  for (const m of Object.values(materials)) {
    m.clippingPlanes = ui.cut > 0.001 ? clipPlanes : null;
    m.needsUpdate = true;
  }
}

function applyBackdrop() {
  jungle.params.elevation = ui.sunElevation;
  jungle.params.azimuth = ui.sunAzimuth;
  jungle.params.density = ui.canopy;
  jungle.setVisible(ui.backdrop === 'jungle');
  jungle.setDapple(ui.dapple);
  jungle.apply();
}

function updateLabels() {
  document.getElementById('species-name').textContent = params.displayName;
  const f = params.features;
  const bits = [];
  bits.push(`${(params.scale * 100).toFixed(0)} cm`);
  if (f.count > 0) bits.push(`${Math.round(f.count)} ${f.arrangement === 'spiral' ? 'spiral' : f.arrangement === 'rows' ? 'rowed' : 'packed'} features`);
  if (params.ribs.count > 0 && params.ribs.depth > 0.01) bits.push(`${Math.round(params.ribs.count)} ribs`);
  bits.push(params.seeds.mode === 'none' ? 'seedless' : `${params.seeds.mode} seeds`);
  document.getElementById('mode-line').textContent = bits.join(' · ');
}

// ---- GUI ----------------------------------------------------------------------
const gui = new GUI({ title: '🍈 fruit' });
gui.domElement.id = 'gui-panel';
if (gui.$title) gui.$title.style.display = 'none';

/** Overwrite `params` in place, so every lil-gui controller keeps its live binding
 *  across a preset switch. (Learned the hard way in the fish rig: replacing the
 *  object wholesale silently orphans every controller.) */
function syncInto(target, source) {
  for (const k of Object.keys(target)) if (!(k in source)) delete target[k];
  for (const k of Object.keys(source)) {
    const sv = source[k];
    if (sv && typeof sv === 'object' && !Array.isArray(sv)) {
      if (!target[k] || typeof target[k] !== 'object') target[k] = {};
      syncInto(target[k], sv);
    } else {
      target[k] = Array.isArray(sv) ? clone(sv) : sv;
    }
  }
}

function refreshControllers() {
  for (const c of gui.controllersRecursive()) c.updateDisplay();
}

function setSpecies(id) {
  currentSpecies = id;
  ui.morph = 0;
  genomeBase = { s: id };
  syncInto(params, makeSpecies(id));
  rebuild(false);
  highlightSpecies(id);
  refreshControllers();
  scheduleUrlUpdate();
}

function applyMorph() {
  const a = makeSpecies(currentSpecies);
  const b = makeSpecies(ui.blendTo);
  genomeBase = ui.morph > 0 ? { s: currentSpecies, b: ui.blendTo, t: ui.morph } : { s: currentSpecies };
  syncInto(params, morphParams(a, b, ui.morph));
  materials = makeMaterials(params, clipPlanes);
  applySkin(materials, params);
  rebuild(true);
  refreshControllers();
  scheduleUrlUpdate();
}

// -- Explore
const fExplore = gui.addFolder('explore');
const SPECIES_LABELS = {
  durian: 'Durian', pineapple: 'Pineapple', dragonfruit: 'Dragon', carambola: 'Star',
  kiwano: 'Kiwano', cherimoya: 'Cherimoya', salak: 'Salak', buddhashand: "Buddha's",
  lychee: 'Lychee', rambutan: 'Rambutan', soursop: 'Soursop', hala: 'Hala',
  bittermelon: 'Bitter', snakegourd: 'Snake', cantaloupe: 'Melon', apple: 'Apple',
};
const speciesChips = {};
function highlightSpecies(id) {
  for (const k in speciesChips) speciesChips[k].classList.toggle('active', k === id);
}
(function buildChips() {
  const bar = document.createElement('div');
  bar.className = 'species-chips';
  for (const id of SPECIES_ORDER) {
    const b = document.createElement('button');
    b.className = 'chip';
    b.textContent = SPECIES_LABELS[id] || id;
    b.addEventListener('click', () => setSpecies(id));
    speciesChips[id] = b;
    bar.appendChild(b);
  }
  const c = fExplore.$children || fExplore.domElement;
  c.insertBefore(bar, c.firstChild);
})();
fExplore.add(ui, 'blendTo', SPECIES_ORDER).name('blend toward');
fExplore.add(ui, 'morph', 0, 1, 0.001).name('blend amount').onChange(applyMorph).listen();

// -- Body
const fBody = gui.addFolder('body');
fBody.add(params, 'scale', 0.01, 1.2, 0.001).name('size (m)').onChange(structural);
fBody.add(params.body, 'aspect', 0.04, 2.5, 0.01).name('width / length').onChange(structural);
fBody.add(params.body, 'bulge', 0.08, 0.92, 0.01).name('widest point').onChange(structural);
fBody.add(params.body, 'baseFill', 0.4, 6, 0.05).name('blossom end').onChange(structural);
fBody.add(params.body, 'tipFill', 0.4, 6, 0.05).name('stem end').onChange(structural);
fBody.add(params.body, 'neck', 0, 0.7, 0.01).name('neck (pear)').onChange(structural);
fBody.add(params.body, 'neckPos', 0.2, 0.95, 0.01).name('neck position').onChange(structural);
fBody.add(params.body, 'bend', -0.9, 0.9, 0.01).name('bend (banana)').onChange(structural);
fBody.close();

// -- Ribs
const fRibs = gui.addFolder('ribs & lobes');
fRibs.add(params.ribs, 'count', 0, 16, 1).name('rib count').onChange(structural);
fRibs.add(params.ribs, 'depth', 0, 0.6, 0.005).name('rib depth').onChange(structural);
fRibs.add(params.ribs, 'sharp', 0.3, 3, 0.05).name('rib sharpness').onChange(structural);
fRibs.add(params.ribs, 'twist', -2, 2, 0.02).name('twist').onChange(structural);
fRibs.add(params.ribs, 'ramp', 0, 1, 0.01).name("fingers (Buddha's hand)").onChange(structural);
fRibs.close();

// -- Features: the heart of the toy
const fFeat = gui.addFolder('spikes, nodules & scales');
fFeat.add(params.features, 'count', 0, 800, 1).name('how many').onChange(structural);
fFeat.add(params.features, 'height', 0, 1.4, 0.01).name('height (× radius)').onChange(structural);
fFeat.add(params.features, 'width', 0.01, 0.5, 0.005).name('width').onChange(structural);
fFeat.add(params.features, 'sharp', 0.15, 3, 0.05).name('dome ↔ spike').onChange(structural);
fFeat.add(params.features, 'sides', 3, 20, 1).name('facets (4=pyramid, 6=hex)').onChange(structural);
fFeat.add(params.features, 'elong', 0, 3, 0.05).name('elongate → scale').onChange(structural);
fFeat.add(params.features, 'tilt', -1.4, 1.4, 0.02).name('tilt (− = roof tiles)').onChange(structural);
fFeat.add(params.features, 'curve', 0, 2, 0.02).name('recurve → hook').onChange(structural);
fFeat.add(params.features, 'latGrad', -1, 1, 0.02).name('base ↔ apex size').onChange(structural);
fFeat.add(params.features, 'arrangement', ARRANGEMENTS).name('arrangement').onChange(structural);
fFeat.add(params.features, 'rows', 3, 20, 1).name('rows (if rowed)').onChange(structural);
fFeat.add(params.features, 'jitter', 0, 1, 0.02).name('disorder').onChange(structural);
fFeat.add(params.features, 'seed', 1, 99, 1).name('seed').onChange(structural);
fFeat.close();

// -- Rind noise
const fRind = gui.addFolder('rind');
fRind.add(params.rind, 'warts', 0, 1.5, 0.02).name('warts').onChange(structural);
fRind.add(params.rind, 'wartScale', 1, 16, 0.5).name('wart size').onChange(structural);
fRind.add(params.rind, 'netting', 0, 1.5, 0.02).name('netting (cantaloupe)').onChange(structural);
fRind.add(params.rind, 'netScale', 3, 30, 0.5).name('net density').onChange(structural);
fRind.close();

// -- Interior
const fIn = gui.addFolder('interior & seeds');
fIn.add(ui, 'cut', 0, 1, 0.005).name('✂ slice open').onChange(updateCut);
fIn.add(params.seeds, 'mode', SEED_MODES).name('arrangement').onChange(structural);
fIn.add(params.seeds, 'count', 0, 600, 1).name('seed count').onChange(structural);
fIn.add(params.seeds, 'size', 0.005, 0.45, 0.005).name('seed size').onChange(structural);
fIn.add(params.seeds, 'spread', 0.05, 1.5, 0.01).name('spread / depth').onChange(structural);
fIn.add(params.seeds, 'segments', 3, 16, 1).name('locules (5 = apple star)').onChange(structural);
fIn.add(params.core, 'enabled').name('central core').onChange(structural);
fIn.add(params.core, 'radius', 0.05, 0.5, 0.01).name('core radius').onChange(structural);
fIn.open();

// -- Surface / material
const fMicro = gui.addFolder('surface detail');
fMicro.add(params.skin, 'pits', 0, 1.5, 0.01).name('orange-peel pitting').onChange(onSkin);
fMicro.add(params.skin, 'pitScale', 10, 160, 1).name('pit density').onChange(onSkin);
fMicro.add(params.skin, 'striations', 0, 1, 0.01).name('lengthwise striations').onChange(onSkin);
fMicro.add(params.skin, 'striScale', 4, 70, 1).name('striation fineness').onChange(onSkin);
fMicro.add(params.skin, 'bump', 0, 0.3, 0.005).name('relief strength').onChange(onSkin);
fMicro.add(params.skin, 'roughVar', 0, 1, 0.01).name('roughness breakup').onChange(onSkin);
fMicro.add(params.skin, 'wax', 0, 1, 0.01).name('powdery bloom').onChange(onSkin);
fMicro.open();

const fSkin = gui.addFolder('skin & flesh');
fSkin.add(params.skin, 'translucency', 0, 1, 0.01).name('translucency').onChange(onSkin);
fSkin.add(params.skin, 'thickness', 0.05, 2, 0.01).name('flesh depth').onChange(onSkin);
fSkin.add(params.skin, 'attenuation', 0.05, 2, 0.01).name('flesh saturation').onChange(onSkin);
fSkin.add(params.skin, 'roughness', 0.03, 1, 0.01).name('roughness').onChange(onSkin);
fSkin.add(params.skin, 'clearcoat', 0, 1, 0.01).name('waxy bloom').onChange(onSkin);
fSkin.add(params.skin, 'mottle', 0, 1, 0.01).name('mottling').onChange(onSkin);
fSkin.add(params.skin, 'blush', 0, 1, 0.01).name('blush').onChange(onSkin);
fSkin.addColor(params.skin, 'topColor').name('skin (top)').onChange(onSkin);
fSkin.addColor(params.skin, 'bottomColor').name('skin (bottom)').onChange(onSkin);
fSkin.addColor(params.skin, 'featureColor').name('spike base').onChange(onSkin);
fSkin.addColor(params.skin, 'featureTipColor').name('spike tip').onChange(onSkin);
fSkin.addColor(params.skin, 'fleshColor').name('flesh').onChange(onSkin);
fSkin.addColor(params.skin, 'seedColor').name('seed').onChange(onSkin);
fSkin.close();

// -- Crown / stem
const fTop = gui.addFolder('crown & stem');
fTop.add(params.crown, 'leaves', 0, 40, 1).name('crown leaves').onChange(structural);
fTop.add(params.crown, 'height', 0.1, 1.5, 0.01).name('leaf length').onChange(structural);
fTop.add(params.crown, 'spread', 0, 1.5, 0.02).name('leaf splay').onChange(structural);
fTop.add(params.stem, 'length', 0, 0.5, 0.01).name('stem').onChange(structural);
fTop.add(params.calyx, 'lobes', 0, 8, 1).name('calyx lobes').onChange(structural);
fTop.close();

// -- Scene
const fScene = gui.addFolder('scene');
fScene.add(ui, 'backdrop', ['jungle', 'studio']).name('backdrop').onChange(applyBackdrop);
fScene.add(ui, 'dapple', 0, 1, 0.01).name('dappled light').onChange(applyBackdrop);
fScene.add(ui, 'sunElevation', 5, 88, 1).name('sun height').onChange(applyBackdrop);
fScene.add(ui, 'sunAzimuth', 0, 360, 1).name('sun angle').onChange(applyBackdrop);
fScene.add(ui, 'canopy', 0.2, 0.95, 0.01).name('canopy density').onChange(applyBackdrop);
fScene.add(ui, 'flare').name('lens flare');
fScene.add(ui, 'autoRotate').name('turntable').onChange((v) => (controls.autoRotate = v));
fScene.add(ui, 'showTable').name('table').onChange((v) => table.setVisible(v));
fScene.add(ui, 'wireframe').name('wireframe').onChange((v) => {
  materials.skin.wireframe = v;
  materials.feature.wireframe = v;
});
fScene.add({ reset: () => frameCamera(false) }, 'reset').name('reset camera');
fScene.close();

gui.add({ share: shareFruit }, 'share').name('🔗 copy link to this fruit');

function onSkin() { applySkin(materials, params); }

// Structural edits rebuild the mesh, but not on every mouse-move of a slider —
// coalesce them to one rebuild per frame.
let structuralPending = false;
function structural() { structuralPending = true; }

// ---- shareable URL ------------------------------------------------------------
let urlTimer = 0, urlSeq = 0;
function scheduleUrlUpdate() {
  clearTimeout(urlTimer);
  urlTimer = setTimeout(async () => {
    const seq = ++urlSeq;
    const code = await encodeGenome(params, genomeBase);
    if (seq === urlSeq) history.replaceState(null, '', `${location.origin}${location.pathname}#fruit=${code}`);
  }, 500);
}

function shareFruit() {
  const fast = encodeGenomeSync(params, genomeBase);
  if (fast !== null) copyShareUrl(fast);
  else encodeGenome(params, genomeBase).then(copyShareUrl);
}
function copyShareUrl(code) {
  const url = `${location.origin}${location.pathname}#fruit=${code}`;
  history.replaceState(null, '', url);
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(
      () => toast('link copied — share your fruit!'),
      () => toast('copy failed — the URL is in the address bar')
    );
  } else toast('URL updated — copy it from the address bar');
}
async function loadGenomeFromHash() {
  const m = location.hash.match(/#fruit=(.+)/);
  if (!m) return false;
  try {
    const { params: tree, base } = await decodeGenome(m[1]);
    syncInto(params, tree);
    genomeBase = base ?? { s: SPECIES[params.id] ? params.id : 'durian' };
    return true;
  } catch (e) { console.warn('bad fruit code in URL', e); return false; }
}

let toastTimer = 0;
function toast(msg) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.style.cssText = 'position:fixed;left:50%;top:24px;transform:translateX(-50%);z-index:30;padding:9px 16px;border-radius:999px;background:rgba(38,28,20,.94);color:#f6ede2;font:600 12px ui-sans-serif,system-ui,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.4);transition:opacity .3s;backdrop-filter:blur(6px);';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = '1';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.style.opacity = '0'; }, 2200);
}

gui.onChange(scheduleUrlUpdate);

// ---- panel --------------------------------------------------------------------
const panelTab = document.getElementById('panel-tab');
gui.domElement.addEventListener('click', (e) => e.stopPropagation());
panelTab?.addEventListener('click', () => document.body.classList.toggle('panel-open'));
if (innerWidth > 560) document.body.classList.add('panel-open');

// ---- boot ---------------------------------------------------------------------
(async () => {
  const shared = await loadGenomeFromHash();
  if (shared) {
    currentSpecies = genomeBase.s;
    if (genomeBase.b != null) { ui.blendTo = genomeBase.b; ui.morph = genomeBase.t; }
    materials = makeMaterials(params, clipPlanes);
  }
  applySkin(materials, params);
  applyBackdrop();
  controls.autoRotate = ui.autoRotate;
  rebuild(false);
  highlightSpecies(currentSpecies);
  refreshControllers();
  document.getElementById('loader').style.opacity = '0';
  setTimeout(() => document.getElementById('loader')?.remove(), 700);
  animate();
})();

// ---- loop ---------------------------------------------------------------------
const hud = document.getElementById('hud');
const clock = new THREE.Clock();
let frames = 0, fpsT = 0, fps = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  if (structuralPending) {
    structuralPending = false;
    rebuild(true);
  }

  jungle.update(dt);
  controls.update();
  renderer.render(scene, camera);

  // The flare composites over the finished frame; the fruit occludes it.
  if (ui.flare && ui.backdrop === 'jungle') flare.render(camera, jungle.sun, [fruit], dt);
  else flare.enabled = false;

  frames++; fpsT += dt;
  if (fpsT >= 0.5) { fps = Math.round(frames / fpsT); frames = 0; fpsT = 0; }
  const s = fruit.stats;
  hud.textContent = `${params.id}  ·  ${s.features} features  ·  ${s.seeds} seeds  ·  ${(s.tris / 1000).toFixed(0)}k tris  ·  ${fps} fps`;
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// expose for console tinkering
window.FRUIT = {
  get params() { return params; },
  fruit: () => fruit,
  setSpecies,
  share: shareFruit,
  encode: () => encodeGenome(params, genomeBase),
  /** Slice the fruit open (0 = whole, 1 = cut through the middle). */
  setCut(v) { ui.cut = v; updateCut(); refreshControllers(); },
  rebuild: () => rebuild(true),
};
