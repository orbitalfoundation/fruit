import * as THREE from 'three';
import { TAU, GOLDEN_ANGLE, clamp, lerp, mulberry32 } from '../core/math.js';

/**
 * The interior. Fruit are mostly a strategy for moving seeds around, so the seed
 * arrangement is not decoration — it's the part the translucent flesh exists to
 * show. Six archetypes cover most of the botany:
 *
 *   pit        one big stone at the centre (drupe: peach, mango, avocado). It is
 *              bigger than people expect — an avocado's is ~40-50% of the fruit's
 *              own diameter.
 *   core       a small cluster of pips around the axis (pome: apple, pear — a real
 *              apple's five carpels sit on a pentagram, which is why a cored apple
 *              shows a star; we place them on a `segments`-gon for the same reason)
 *   radial     seeds pushed out into wedge-shaped locules (citrus, ~10 carpels)
 *   ring       an annulus of seeds around a pale central column (kiwi: the ovules
 *              radiate from the columella, so the seeds land on a cylindrical shell)
 *   dispersed  seeds strewn evenly through the whole flesh (dragon fruit, fig)
 *   cavity     seeds crowded into a hollow at the middle (melon, papaya, pepper)
 *   follow     one seed beneath each surface feature. This is the botanically
 *              lovely case: in an aggregate fruit — cherimoya, soursop, jackfruit —
 *              every surface areole IS one carpel, and each carpel holds one seed.
 *              The rind's point set and the seed's point set are the same set.
 *
 * Everything else is placed against the UN-modulated silhouette (`innerRadiusAt`),
 * so seeds never wander out into a spike or a rib valley — the flesh is a smooth
 * body inside whatever the rind happens to be doing.
 */
export const SEED_MODES = ['none', 'pit', 'core', 'radial', 'ring', 'dispersed', 'cavity', 'follow'];

export function buildSeeds(p, surface, material, featurePts = []) {
  const s = p.seeds;
  if (s.mode === 'none') return null;

  const placements = placeSeeds(s, surface, featurePts);
  if (!placements.length) return null;

  // A slightly irregular blob reads as a seed; a smooth sphere reads as a bead.
  const geo = new THREE.IcosahedronGeometry(1, 2);
  const mesh = new THREE.InstancedMesh(geo, material, placements.length);
  mesh.frustumCulled = false;

  const M = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const scl = new THREE.Vector3();
  for (let i = 0; i < placements.length; i++) {
    const { pos, size, aim, squash } = placements[i];
    q.setFromUnitVectors(up, aim);
    scl.set(size * squash, size, size * squash);
    M.compose(pos, q, scl);
    mesh.setMatrixAt(i, M);
  }
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

function placeSeeds(s, surface, featurePts) {
  const rnd = mulberry32(s.seed >>> 0 || 1);
  const R = surface.maxR;
  const H = surface.height;
  const out = [];
  const base = s.size * R;

  // Keep a seed strictly inside the flesh: its centre plus its own radius must
  // clear the silhouette, with a margin for the rind's thickness.
  const fits = (x, y, z, size) => {
    const v = clamp(y / H + 0.5, 0, 1);
    const rr = surface.innerRadiusAt(v) * 0.86 - size;
    return rr > 0 && Math.hypot(x - surface.bendAt(v), z) <= rr;
  };
  const push = (x, y, z, size, aim = new THREE.Vector3(0, 1, 0), squash = 0.62) => {
    const v = clamp(y / H + 0.5, 0, 1);
    out.push({ pos: new THREE.Vector3(x + surface.bendAt(v), y, z), size, aim, squash });
  };

  const n = Math.max(1, Math.round(s.count));

  switch (s.mode) {
    case 'pit': {
      // One stone, elongated along the axis and sitting a touch low, like a mango's.
      push(0, -H * 0.02, 0, R * s.size * 3.2, new THREE.Vector3(0, 1, 0), 0.72);
      break;
    }
    case 'core': {
      // Pips on a `segments`-gon around the axis, each leaning outward and up:
      // the apple's carpel star.
      const seg = Math.max(3, Math.round(s.segments));
      for (let i = 0; i < n; i++) {
        const k = i % seg;
        const tier = Math.floor(i / seg);
        const a = (k / seg) * TAU + tier * 0.3;
        const r = R * 0.13 * s.spread * (1 + tier * 0.35);
        const y = H * (-0.04 + tier * 0.06);
        const aim = new THREE.Vector3(Math.cos(a) * 0.5, 1, Math.sin(a) * 0.5).normalize();
        if (fits(Math.cos(a) * r, y, Math.sin(a) * r, base)) {
          push(Math.cos(a) * r, y, Math.sin(a) * r, base, aim, 0.55);
        }
      }
      break;
    }
    case 'radial': {
      // Citrus: a few seeds per locule, all pointing in toward the axis, clustered
      // near the core rather than out at the peel.
      const seg = Math.max(3, Math.round(s.segments));
      for (let i = 0; i < n; i++) {
        const k = i % seg;
        const a = (k / seg) * TAU + (rnd() - 0.5) * 0.25;
        const r = R * lerp(0.16, 0.42, rnd()) * s.spread;
        const y = (rnd() - 0.5) * H * 0.42;
        const aim = new THREE.Vector3(-Math.cos(a), 0.55, -Math.sin(a)).normalize();
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        if (fits(x, y, z, base)) push(x, y, z, base, aim, 0.5);
      }
      break;
    }
    case 'ring': {
      // Kiwi: a band of seeds in an annulus, leaving the pale column clear.
      for (let i = 0; i < n; i++) {
        const a = i * GOLDEN_ANGLE;
        const rr = R * lerp(0.42, 0.56, rnd()) * s.spread;
        const y = (rnd() - 0.5) * H * 0.66;
        const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
        const aim = new THREE.Vector3(-Math.cos(a), (rnd() - 0.5) * 0.4, -Math.sin(a)).normalize();
        if (fits(x, y, z, base)) push(x, y, z, base, aim, 0.55);
      }
      break;
    }
    case 'dispersed': {
      // Dragon fruit: specks throughout. Rejection-sample so the density is even
      // in VOLUME rather than piling up on the axis.
      let tries = 0;
      while (out.length < n && tries < n * 40) {
        tries++;
        const y = (rnd() - 0.5) * H * 0.9;
        const v = clamp(y / H + 0.5, 0, 1);
        const rmax = surface.innerRadiusAt(v) * 0.84;
        const rr = rmax * Math.sqrt(rnd()); // sqrt → uniform over the disc
        const a = rnd() * TAU;
        const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
        const aim = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize();
        if (fits(x, y, z, base)) push(x, y, z, base, aim, 0.7);
      }
      break;
    }
    case 'cavity': {
      // Melon/papaya: crowded into a central hollow, packed but not on the axis.
      for (let i = 0; i < n; i++) {
        const a = i * GOLDEN_ANGLE;
        const rr = R * 0.34 * s.spread * Math.sqrt(rnd());
        const y = (rnd() - 0.5) * H * 0.5;
        const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
        const aim = new THREE.Vector3(-Math.cos(a), rnd() - 0.5, -Math.sin(a)).normalize();
        if (fits(x, y, z, base)) push(x, y, z, base, aim, 0.5);
      }
      break;
    }
    case 'follow': {
      // One seed per surface unit, sunk beneath it: the aggregate fruit, where the
      // areole you can see and the seed you can't are the same carpel. `spread`
      // slides them between hugging the rind and gathering toward the axis.
      if (!featurePts.length) break;
      const step = Math.max(1, Math.floor(featurePts.length / n));
      for (let i = 0; i < featurePts.length && out.length < n; i += step) {
        const { u, v } = featurePts[i];
        const depth = clamp(s.spread, 0.05, 0.95); // 0 = just under the skin, 1 = at the core
        const rr = surface.innerRadiusAt(v) * (1 - depth) * 0.82;
        const a = u * TAU;
        const y = surface.axisAt(v) * 0.92;
        const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
        const aim = new THREE.Vector3(-Math.cos(a), 0.25, -Math.sin(a)).normalize();
        if (fits(x, y, z, base)) push(x, y, z, base, aim, 0.6);
      }
      break;
    }
  }
  return out;
}

/**
 * The pale column some fruit have down the middle — an apple's core, a kiwi's
 * pith, a pineapple's woody heart. Reads as structure through the flesh.
 */
export function buildCore(p, surface, material) {
  const c = p.core;
  if (!c.enabled) return null;
  const r = c.radius * surface.maxR;
  const h = c.height * surface.height;
  const geo = new THREE.CylinderGeometry(r * 0.8, r, h, 24, 1, false);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.y = 0;
  return mesh;
}
