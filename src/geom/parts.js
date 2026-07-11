import * as THREE from 'three';
import { TAU, GOLDEN_ANGLE, lerp } from '../core/math.js';

/**
 * The bits that aren't the fruit body: the stem it hung from, and the crown of
 * bracts on top. The crown is doing a lot of recognition work — a pineapple
 * without its rosette is just a scaly barrel — and it's the same phyllotaxis as
 * the fruitlets, one rung up.
 */

/** A tapered blade, curving outward and drooping: one leaf of the crown. */
function bladeGeometry(bend, segs = 8) {
  const pos = [], nrm = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const w = (1 - t) * (0.35 + 0.65 * (1 - t)) * 0.5; // widest at the base, to a point
    // The blade leans out and then droops under its own weight.
    const x = Math.sin(t * Math.PI * 0.5) * bend;
    const y = t;
    const drop = t * t * bend * 0.55;
    pos.push(x - w, y - drop, 0, x + w, y - drop, 0);
    nrm.push(0, 0, 1, 0, 0, 1);
  }
  for (let i = 0; i < segs; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setIndex(idx);
  return g;
}

export function buildCrown(p, surface, material) {
  const c = p.crown;
  const n = Math.round(c.leaves);
  if (n < 1 || c.height <= 0) return null;

  const geo = bladeGeometry(c.bend);
  const mesh = new THREE.InstancedMesh(geo, material, n);
  mesh.frustumCulled = false;

  const M = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const topY = surface.axisAt(1);
  const topX = surface.bendAt(1);

  for (let i = 0; i < n; i++) {
    // Same golden angle as the fruitlets — the crown is a continuation of the
    // same spiral, so the leaves never stack into rows.
    const a = i * GOLDEN_ANGLE;
    const t = i / Math.max(n - 1, 1);
    const lean = lerp(c.spread * 0.15, c.spread, t); // inner leaves upright, outer splayed
    const len = c.height * surface.height * lerp(1, 0.45, t * t);
    const w = c.width * surface.maxR;

    e.set(0, a, lean);
    q.setFromEuler(e);
    pos.set(topX, topY - surface.height * 0.01, 0);
    scl.set(w, len, w);
    M.compose(pos, q, scl);
    mesh.setMatrixAt(i, M);
  }
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

export function buildStem(p, surface, material) {
  const s = p.stem;
  if (s.length <= 0) return null;
  const r = s.radius * surface.maxR;
  const h = s.length * surface.height;
  const geo = new THREE.CylinderGeometry(r * 0.72, r, h, 12, 1);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(surface.bendAt(1), surface.axisAt(1) + h * 0.42, 0);
  return mesh;
}

/** A ring of small bracts where the stem meets the fruit (a calyx). */
export function buildCalyx(p, surface, material) {
  const c = p.calyx;
  const n = Math.round(c.lobes);
  if (n < 1 || c.size <= 0) return null;
  const geo = bladeGeometry(0.5, 5);
  const mesh = new THREE.InstancedMesh(geo, material, n);
  mesh.frustumCulled = false;
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const pos = new THREE.Vector3(), scl = new THREE.Vector3();
  const topY = surface.axisAt(0.97), topX = surface.bendAt(0.97);
  const len = c.size * surface.maxR;
  for (let i = 0; i < n; i++) {
    e.set(0, (i / n) * TAU, Math.PI * 0.62); // splayed almost flat against the shoulder
    q.setFromEuler(e);
    pos.set(topX, topY, 0);
    scl.set(len * 0.8, len, len);
    M.compose(pos, q, scl);
    mesh.setMatrixAt(i, M);
  }
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}
