// Headless geometry check: every preset, and every adjacent morph, must produce
// finite vertices, features that actually land on the rind, and seeds that stay
// inside the flesh. Three.js builds geometry fine without a WebGL context, so this
// runs in plain node and catches the NaN-producing parameter before a browser does.
import * as THREE from 'three';
import { SPECIES_ORDER, makeSpecies } from '../src/species/presets.js';
import { morphParams } from '../src/core/params.js';
import { makeSurface, buildBodyGeometry } from '../src/geom/surface.js';
import { featurePoints, buildFeatures } from '../src/geom/features.js';
import { buildSeeds } from '../src/geom/seeds.js';

const mat = new THREE.MeshBasicMaterial();
let fail = 0;

function firstNaN(arr) {
  for (let i = 0; i < arr.length; i++) if (!Number.isFinite(arr[i])) return i;
  return -1;
}

/** Check one parameter tree end to end. */
function check(label, p) {
  const errs = [];
  const surface = makeSurface(p);

  const geo = buildBodyGeometry(p, surface);
  const pos = geo.attributes.position.array;
  const nrm = geo.attributes.normal.array;
  if (firstNaN(pos) >= 0) errs.push(`NaN position @${firstNaN(pos)}`);
  if (firstNaN(nrm) >= 0) errs.push(`NaN normal @${firstNaN(nrm)}`);

  // Every normal must be unit length — a degenerate one means a fold in the mesh.
  for (let i = 0; i < nrm.length; i += 3) {
    const len = Math.hypot(nrm[i], nrm[i + 1], nrm[i + 2]);
    if (Math.abs(len - 1) > 0.05) { errs.push(`non-unit normal (${len.toFixed(3)})`); break; }
  }

  // The body must have positive extent in every axis it should.
  geo.computeBoundingBox();
  const size = new THREE.Vector3();
  geo.boundingBox.getSize(size);
  if (size.y < p.scale * 0.5) errs.push(`body too short: ${size.y.toFixed(3)} vs scale ${p.scale}`);
  if (size.x <= 0 || size.z <= 0) errs.push('body has zero width');

  const pts = featurePoints(p, surface);
  const feats = buildFeatures(p, surface, mat, pts);
  if (Math.round(p.features.count) > 0) {
    if (!feats) errs.push('features requested but none built');
    else {
      if (feats.count !== pts.length) errs.push(`feature count ${feats.count} != points ${pts.length}`);
      const m = new THREE.Matrix4();
      const v = new THREE.Vector3();
      for (let i = 0; i < feats.count; i++) {
        feats.getMatrixAt(i, m);
        if (firstNaN(m.elements) >= 0) { errs.push(`NaN feature matrix @${i}`); break; }
        v.setFromMatrixPosition(m);
        // A feature's base must sit on the rind, not float in space or sink to the
        // core: its distance from the axis should be near the local radius.
        const vv = Math.min(Math.max(v.y / surface.height + 0.5, 0), 1);
        const rHere = Math.hypot(v.x - surface.bendAt(vv), v.z);
        const rSurf = surface.innerRadiusAt(vv);
        if (rHere > rSurf * 1.9 + 1e-6 || rHere < rSurf * 0.25 - 1e-6) {
          errs.push(`feature ${i} off the rind (r=${rHere.toFixed(4)} vs ${rSurf.toFixed(4)})`);
          break;
        }
      }
    }
  }

  const seeds = buildSeeds(p, surface, mat, pts);
  if (p.seeds.mode !== 'none' && Math.round(p.seeds.count) > 0) {
    if (!seeds) errs.push(`seed mode '${p.seeds.mode}' produced nothing`);
    else {
      const m = new THREE.Matrix4();
      const v = new THREE.Vector3();
      for (let i = 0; i < seeds.count; i++) {
        seeds.getMatrixAt(i, m);
        if (firstNaN(m.elements) >= 0) { errs.push(`NaN seed matrix @${i}`); break; }
        v.setFromMatrixPosition(m);
        // Seeds must be INSIDE the fruit. This is the check that matters: a seed
        // outside the flesh is the most visible possible bug once the skin is
        // translucent.
        const vv = v.y / surface.height + 0.5;
        if (vv < -0.02 || vv > 1.02) { errs.push(`seed ${i} outside the body axially`); break; }
        const rHere = Math.hypot(v.x - surface.bendAt(Math.min(Math.max(vv, 0), 1)), v.z);
        const rSurf = surface.innerRadiusAt(Math.min(Math.max(vv, 0), 1));
        if (rHere > rSurf) { errs.push(`seed ${i} pokes out of the flesh`); break; }
      }
    }
  }

  const stats = `${String(Math.round(pos.length / 3)).padStart(6)} verts` +
    ` ${String(feats ? feats.count : 0).padStart(4)} feat` +
    ` ${String(seeds ? seeds.count : 0).padStart(4)} seed`;
  if (errs.length) {
    fail++;
    console.log(`FAIL ${label.padEnd(24)} ${stats}  ${errs.join('; ')}`);
  } else {
    console.log(`ok   ${label.padEnd(24)} ${stats}`);
  }
  geo.dispose();
}

for (const id of SPECIES_ORDER) check(id, makeSpecies(id));

console.log('\nmorph checks:');
for (let i = 0; i < SPECIES_ORDER.length - 1; i++) {
  const a = makeSpecies(SPECIES_ORDER[i]);
  const b = makeSpecies(SPECIES_ORDER[i + 1]);
  check(`${SPECIES_ORDER[i]} ↔ ${SPECIES_ORDER[i + 1]}`, morphParams(a, b, 0.5));
}

console.log(fail ? `\n${fail} FAILURES` : '\nALL PASS');
process.exit(fail ? 1 : 0);
