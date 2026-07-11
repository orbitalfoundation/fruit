import * as THREE from 'three';
import { TAU, clamp, lerp, endCap, noise3, ridged, smoothstep } from '../core/math.js';

/**
 * The fruit body: a surface of revolution, modulated.
 *
 * Where a fish is a spine with an envelope swept along it, a fruit is much more
 * nearly a solid of revolution — so the whole morphospace of gross shape lives
 * in a handful of scalar fields layered onto r(u, v):
 *
 *   profile(v)   two superellipse end-caps meeting at the widest point. Carries
 *                sphere → pear → cucumber → chilli, and the pinched waist of a
 *                gourd, entirely in `bulge`, `baseFill`, `tipFill`, `neck`.
 *   ribs(u, v)   angular modulation. `count` lobes of depth `depth`: shallow and
 *                many = a ribbed pumpkin; five and deep = carambola's star. A
 *                `ramp` that deepens the ribs toward the tip splits the body into
 *                fingers, which is roughly what a Buddha's hand is.
 *   rind(u, v)   isotropic noise: low-frequency `warts` (bitter melon, osage
 *                orange) and high-frequency `netting` ridges (cantaloupe).
 *   bend(v)      lateral displacement of the axis — a banana, a chilli.
 *
 * Spikes, nodules and scales are NOT in here: they're discrete instanced bodies
 * scattered over this surface (see features.js), because a durian's spine is a
 * separate object with its own silhouette, not a bump in the rind.
 *
 * u ∈ [0,1) goes around the axis, v ∈ [0,1] runs from the blossom end (bottom)
 * to the stem end (top). +Y is up: fruit stand upright, like a pineapple.
 */
export function makeSurface(p) {
  const height = p.scale;
  const maxR = 0.5 * p.scale * p.body.aspect;
  const b = p.body, rb = p.ribs, rn = p.rind;

  /** Silhouette radius before any angular modulation. */
  function profileAt(v) {
    const bulge = clamp(b.bulge, 0.05, 0.95);
    const t = v < bulge ? v / bulge : (1 - v) / (1 - bulge);
    const fill = v < bulge ? b.baseFill : b.tipFill;
    let r = maxR * endCap(clamp(t, 0, 1), fill);
    if (b.neck > 0) {
      const d = (v - b.neckPos) / Math.max(b.neckWidth, 0.02);
      r *= 1 - b.neck * Math.exp(-d * d);
    }
    return Math.max(r, 1e-5);
  }

  /** Angular rib/lobe modulation, as a multiplier on the profile radius. */
  function ribAt(u, v) {
    if (rb.count < 1 || rb.depth <= 0) return 1;
    const theta = u * TAU + rb.twist * (v - 0.5) * TAU;
    const m = Math.cos(theta * Math.round(rb.count));
    // Sharpening the cosine turns round lobes into the winged ridges and deep
    // concave valleys of a carambola. Sign-preserving so the valleys cut in as
    // much as the ridges stand out.
    const sharp = Math.sign(m) * Math.pow(Math.abs(m), 1 / Math.max(rb.sharp, 0.05));
    // `ramp` confines the ribs to the distal end, which is how the body splits
    // into fingers rather than being fluted end to end.
    const ramp = (1 - rb.ramp) + rb.ramp * smoothstep(0.2, 0.85, v);
    // Fade to nothing at the poles, where the rings collapse and deep ribs would
    // otherwise fold the mesh through itself.
    const polar = smoothstep(0, 0.05, v) * smoothstep(0, 0.05, 1 - v);
    return 1 + rb.depth * sharp * ramp * polar;
  }

  /** Warts and netting, as a fractional perturbation of the radius. */
  function rindAt(u, v) {
    if (rn.warts <= 0 && rn.netting <= 0) return 0;
    const theta = u * TAU;
    const x = Math.cos(theta), z = Math.sin(theta);
    let d = 0;
    if (rn.warts > 0) {
      const s = rn.wartScale;
      d += rn.warts * 0.11 * noise3(x * s, v * s * 1.8, z * s, rn.seed);
    }
    if (rn.netting > 0) {
      const s = rn.netScale;
      d += rn.netting * 0.045 * (ridged(x * s, v * s * 1.6, z * s, rn.seed + 3) - 0.45);
    }
    return d;
  }

  const radiusAt = (u, v) => profileAt(v) * ribAt(u, v) * (1 + rindAt(u, v));
  /** Lateral offset of the axis at v — banana curvature. */
  const bendAt = (v) => b.bend * maxR * 2 * Math.sin(Math.PI * v) * 0.5;
  const axisAt = (v) => (v - 0.5) * height;

  function point(u, v, out = new THREE.Vector3()) {
    const r = radiusAt(u, v);
    const theta = u * TAU;
    return out.set(bendAt(v) + r * Math.cos(theta), axisAt(v), r * Math.sin(theta));
  }

  // Finite-difference normals. The surface is a stack of noise, sharpened cosines
  // and superellipses — differentiating it by hand would be a page of algebra and
  // one sign error; sampling it is exact enough and always agrees with the mesh.
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
  const _du = new THREE.Vector3(), _dv = new THREE.Vector3();
  function normal(u, v, out = new THREE.Vector3()) {
    const e = 1e-3;
    const vc = clamp(v, e * 2, 1 - e * 2); // poles are singular; sample just inside
    point(u, vc, _a);
    point(u + e, vc, _b);
    point(u, vc + e, _c);
    _du.subVectors(_b, _a);
    _dv.subVectors(_c, _a);
    out.crossVectors(_dv, _du).normalize();
    if (!Number.isFinite(out.x) || out.lengthSq() < 0.5) out.set(0, v > 0.5 ? 1 : -1, 0);
    return out;
  }

  return {
    height, maxR, point, normal, radiusAt, profileAt, axisAt, bendAt,
    /** Radius of the un-modulated silhouette — what the seed scatterer uses to
     *  stay inside the flesh without chasing every spike and rib. */
    innerRadiusAt: profileAt,
  };
}

/** Tessellate the surface into a renderable mesh. */
export function buildBodyGeometry(p, surface = makeSurface(p)) {
  const segU = p.mesh.segU, segV = p.mesh.segV;
  const nVerts = (segU + 1) * (segV + 1);
  const pos = new Float32Array(nVerts * 3);
  const nrm = new Float32Array(nVerts * 3);
  const uvs = new Float32Array(nVerts * 2);

  const P = new THREE.Vector3(), N = new THREE.Vector3();
  let i = 0;
  for (let iv = 0; iv <= segV; iv++) {
    const v = iv / segV;
    for (let iu = 0; iu <= segU; iu++) {
      const u = iu / segU; // the seam column repeats u=0 at u=1 so UVs stay continuous
      surface.point(u, v, P);
      surface.normal(u, v, N);
      pos[i * 3] = P.x; pos[i * 3 + 1] = P.y; pos[i * 3 + 2] = P.z;
      nrm[i * 3] = N.x; nrm[i * 3 + 1] = N.y; nrm[i * 3 + 2] = N.z;
      uvs[i * 2] = u; uvs[i * 2 + 1] = v;
      i++;
    }
  }

  const idx = [];
  for (let iv = 0; iv < segV; iv++) {
    for (let iu = 0; iu < segU; iu++) {
      const a = iv * (segU + 1) + iu;
      const bb = a + 1;
      const c = a + (segU + 1);
      const d = c + 1;
      idx.push(a, c, bb, bb, c, d);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}
