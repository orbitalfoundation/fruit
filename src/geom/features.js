import * as THREE from 'three';
import { TAU, clamp, lerp, scatterSurface } from '../core/math.js';

/**
 * Surface features — the durian's spines, the cherimoya's areoles, the pineapple's
 * fruitlets, the salak's reptilian tiles, the rambutan's hairs.
 *
 * The bet this project makes: those are all ONE object with different numbers in
 * it. A feature is a solid of revolution of `sides` facets standing on the rind,
 * and six knobs carry it across the whole space:
 *
 *   sharp   tip profile, r(s) = (1-s)^sharp up the feature's own axis.
 *           0.3 → a swollen dome that only turns over at the top (lychee tubercle)
 *           1   → a straight cone
 *           2.5 → a concave needle (durian)
 *   sides   4–6 → the pyramidal, hexagonal-based spine of a durian, or the
 *           hexagonal fruitlet of a pineapple (both are hexagons because both are
 *           close-packed on a surface). 16+ → a smooth cone or hair.
 *   elong   footprint anisotropy. 0 → circular; >0 → a plate drawn out along the
 *           fruit's axis: a scale.
 *   tilt    lean off the surface normal, in radians, toward the stem end. Positive
 *           lifts the tip toward the crown (dragon fruit bracts); negative lays the
 *           plates back so they overlap like roof tiles, which is what makes a
 *           snake fruit read as reptilian rather than merely bumpy.
 *   curve   recurve of the feature's own axis. A soursop's "spines" are not spines
 *           at all — they're the soft persistent tips of its carpels, and every one
 *           of them hooks toward the apex. That hook is the whole character.
 *   latGrad height as a function of latitude. A cherimoya is mammillate at the base
 *           and nearly flat shields at the apex; a constant height loses that.
 *
 * Scattered by `arrangement` (see math.scatterSurface) — spiral for fruit whose
 * units are organ primordia, blue-noise for fruit whose bumps are just rind.
 */

/**
 * The unit feature: base on the XZ plane, apex at +Y, unit base radius and height.
 * `curve` hooks the axis toward +Z, which the instancer aligns with "toward the
 * stem end", so every hook on the fruit points the same way — as a soursop's do.
 */
function featureGeometry(sides, sharp, curve, rings = 6) {
  const s = clamp(Math.round(sides), 3, 32);
  const pos = [], idx = [];
  const rAt = (t) => Math.pow(1 - t, Math.max(sharp, 0.05));

  for (let ri = 0; ri <= rings; ri++) {
    const t = ri / rings;
    const r = rAt(t);
    const hook = curve * t * t;          // quadratic: straight at the base, bent at the tip
    const droop = -curve * curve * t * t * 0.25; // a long hook also falls toward the rind
    for (let si = 0; si <= s; si++) {
      const a = (si / s) * TAU;
      pos.push(Math.cos(a) * r, t + droop, Math.sin(a) * r + hook);
    }
  }
  for (let ri = 0; ri < rings; ri++) {
    for (let si = 0; si < s; si++) {
      const a = ri * (s + 1) + si, b = a + 1, c = a + (s + 1), d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const centre = pos.length / 3;
  pos.push(0, 0, 0); // cap the base, so a feature seen through translucent flesh isn't hollow
  for (let si = 0; si < s; si++) idx.push(centre, si + 1, si);

  let g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  // Few sides = a faceted pyramid, and it should LOOK faceted: a durian spine has
  // visible flats. Many sides = a smooth cone or hair, so keep shared normals.
  if (s <= 8) {
    g = g.toNonIndexed();
    g.computeVertexNormals();
  } else {
    g.computeVertexNormals();
  }
  return g;
}

/** Where the features sit. Shared with the seed scatterer, because in an aggregate
 *  fruit (cherimoya, soursop, jackfruit) each seed sits under one surface unit —
 *  they are literally the same point set, one per carpel. */
export function featurePoints(p, surface) {
  const f = p.features;
  const count = Math.round(f.count);
  if (count < 1) return [];
  return scatterSurface(count, surface.innerRadiusAt, surface.axisAt, {
    mode: f.arrangement, spiral: f.spiral, jitter: f.jitter, seed: f.seed,
    rows: f.rows, v0: f.coverBase, v1: f.coverTip,
  });
}

export function buildFeatures(p, surface, material, pts = featurePoints(p, surface)) {
  const f = p.features;
  if (!pts.length || f.height <= 0) return null;

  const geo = featureGeometry(f.sides, f.sharp, f.curve);
  const mesh = new THREE.InstancedMesh(geo, material, pts.length);
  mesh.frustumCulled = false;

  const P = new THREE.Vector3(), N = new THREE.Vector3();
  const TU = new THREE.Vector3(), TV = new THREE.Vector3(), Pu = new THREE.Vector3(), Pv = new THREE.Vector3();
  const colX = new THREE.Vector3(), colY = new THREE.Vector3(), colZ = new THREE.Vector3();
  const M = new THREE.Matrix4();

  const H = f.height * surface.maxR;
  const W = f.width * surface.maxR;

  for (let i = 0; i < pts.length; i++) {
    const { u, v } = pts[i];
    surface.point(u, v, P);
    surface.normal(u, v, N);

    // A local frame on the rind: TU around the fruit, TV toward the stem end.
    surface.point(u + 1e-3, v, Pu);
    surface.point(u, clamp(v + 1e-3, 0, 1), Pv);
    TU.subVectors(Pu, P);
    TV.subVectors(Pv, P);
    if (TU.lengthSq() < 1e-12) TU.set(1, 0, 0);
    if (TV.lengthSq() < 1e-12) TV.set(0, 1, 0);
    TU.normalize(); TV.normalize();
    // The parametric tangents aren't perpendicular over a rib; re-orthogonalise
    // against the normal so features don't shear.
    TV.addScaledVector(N, -TV.dot(N)).normalize();
    TU.crossVectors(TV, N).normalize();

    // Height varies with latitude: mammillate at the base, flat shields at the apex.
    const lat = 1 + f.latGrad * (v - 0.5) * 2;
    const h = H * clamp(lat, 0.05, 3);

    // A SHEARED basis, not a rotation. Tilting the whole feature would swing its
    // footprint out of the tangent plane too — and for an elongated plate, whose
    // long axis lies along the surface, a 78° tilt would stand that long axis up
    // on end and turn every roof tile into a spike. (That is exactly what turned
    // the first snake fruit into a pine cone.) So: pin the base to the rind and
    // lean ONLY the growth axis.
    colX.copy(TU).multiplyScalar(W);                       // footprint, around the fruit
    colZ.copy(TV).multiplyScalar(W * (1 + f.elong));       // footprint, along the fruit
    colY.copy(N).multiplyScalar(Math.cos(f.tilt))          // growth axis: leans, base doesn't
      .addScaledVector(TV, Math.sin(f.tilt))
      .multiplyScalar(h);
    M.makeBasis(colX, colY, colZ);

    // Sink the base a little so no rim floats off the rind.
    const sink = -h * 0.08;
    M.setPosition(P.x + N.x * sink, P.y + N.y * sink, P.z + N.z * sink);
    mesh.setMatrixAt(i, M);
  }
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}
