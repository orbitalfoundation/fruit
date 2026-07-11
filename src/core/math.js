// Small numeric toolkit shared by the surface evaluator, the feature scatterer
// and the GUI. (Started life in the sibling fish rig; the tree-blending and
// curve helpers are unchanged, the phyllotaxis and noise below are fruit's.)

export const TAU = Math.PI * 2;

/**
 * The golden angle, 137.507…° — the divergence angle that generates the
 * Fibonacci parastichies you count on a pineapple, a pinecone, a sunflower.
 * Successive primordia placed at this angle never line up into rows, which is
 * exactly why it packs surface features evenly; any rational fraction of a turn
 * would collapse into visible spokes.
 */
export const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, x) => (b === a ? 0 : (x - a) / (b - a));

export function smoothstep(edge0, edge1, x) {
  const t = clamp(invLerp(edge0, edge1, x), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * C-infinity approximation of max() for non-negative arguments. Used to graft the
 * caudal peduncle floor onto the body silhouette without leaving a visible crease
 * where the two curves cross.
 */
export function smoothMax(a, b, k = 8) {
  if (a <= 0) return b;
  if (b <= 0) return a;
  return Math.pow(Math.pow(a, k) + Math.pow(b, k), 1 / k);
}

/**
 * Signed superellipse basis: se(t, n) traces |y/H|^n + |z/W|^n = 1 when fed
 * cos/sin of the ring angle. n = 2 is a plain ellipse; large n squares off the
 * cross-section, which is how a boxfish gets its carapace.
 */
export function se(t, n) {
  const e = 2 / n;
  const a = Math.abs(t);
  return (t < 0 ? -1 : 1) * Math.pow(a, e);
}

/**
 * Normalised beta-style bump on [0,1]: peaks at `girth`, vanishes at both ends.
 * `blunt` controls how rounded the leading end is (0.5 gives a sqrt-like, rounded
 * snout; 2.0 gives a sharp streamlined point). The trailing exponent is derived so
 * that the peak lands exactly on `girth`.
 */
export function betaBump(s, girth, blunt) {
  if (s <= 0 || s >= 1) return 0;
  const g = clamp(girth, 0.02, 0.98);
  const a = Math.max(blunt, 0.02);
  const b = (a * (1 - g)) / g;
  const peak = Math.pow(g, a) * Math.pow(1 - g, b);
  return (Math.pow(s, a) * Math.pow(1 - s, b)) / peak;
}

/** Monotone-ish evaluation of a polyline of [x, y] control points. */
export function curveAt(points, x) {
  const n = points.length;
  if (n === 0) return 0;
  if (x <= points[0][0]) return points[0][1];
  if (x >= points[n - 1][0]) return points[n - 1][1];
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    if (x <= x1) {
      const t = smoothstep(x0, x1, x);
      return lerp(y0, y1, t);
    }
  }
  return points[n - 1][1];
}

/** Deterministic hash -> [0,1). Keeps every run reproducible from a seed. */
export function hash1(n) {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Recursively blend two parameter trees. Numbers lerp, everything else snaps at t>=0.5. */
export function lerpTree(a, b, t) {
  if (typeof a === 'number' && typeof b === 'number') return lerp(a, b, t);
  if (Array.isArray(a) && Array.isArray(b)) {
    // Arrays of the same length blend elementwise; otherwise snap.
    if (a.length !== b.length) return t < 0.5 ? clone(a) : clone(b);
    return a.map((v, i) => lerpTree(v, b[i], t));
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const out = {};
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
      if (!(k in a)) out[k] = clone(b[k]);
      else if (!(k in b)) out[k] = clone(a[k]);
      else out[k] = lerpTree(a[k], b[k], t);
    }
    return out;
  }
  return t < 0.5 ? clone(a) : clone(b);
}

export function clone(v) {
  if (Array.isArray(v)) return v.map(clone);
  if (v && typeof v === 'object') {
    const o = {};
    for (const k of Object.keys(v)) o[k] = clone(v[k]);
    return o;
  }
  return v;
}

/**
 * Superellipse end-cap on [0,1]: 0 at t=0, 1 at t=1, with `fill` controlling how
 * the shoulder rolls off. This is the single knob that carries a fruit's end from
 * a spike to a flat shoulder:
 *
 *   fill < 1   concave, tapering to a point   (lemon's nipple, a chilli's tip)
 *   fill = 2   a circular quarter-arc         (a sphere's pole)
 *   fill >> 1  a square shoulder              (a cucumber's blunt end)
 *
 * A fruit body is two of these back to back, meeting at the widest point.
 */
export function endCap(t, fill) {
  const e = Math.max(fill, 0.05);
  const s = clamp(t, 0, 1);
  return Math.pow(1 - Math.pow(1 - s, e), 1 / e);
}

/** Deterministic 3D value noise, trilinearly interpolated. Cheap; good enough
 *  for the low-frequency lumps of a warty rind. */
export function noise3(x, y, z, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const h = (i, j, k) => hash1(i * 157.31 + j * 311.7 + k * 74.7 + seed * 13.13);
  const c00 = lerp(h(xi, yi, zi), h(xi + 1, yi, zi), u);
  const c10 = lerp(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), u);
  const c01 = lerp(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), u);
  const c11 = lerp(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), u);
  return lerp(lerp(c00, c10, v), lerp(c01, c11, v), w) * 2 - 1; // -> [-1, 1]
}

/** Two octaves of noise3, ridged (|n| inverted) — the raised veins of a
 *  cantaloupe's netting rather than smooth lumps. */
export function ridged(x, y, z, seed = 0) {
  const a = 1 - Math.abs(noise3(x, y, z, seed));
  const b = 1 - Math.abs(noise3(x * 2.1, y * 2.1, z * 2.1, seed + 7));
  return a * a * 0.7 + b * b * 0.3;
}

/**
 * The arrangements a fruit actually uses to lay features out on its rind. Getting
 * this right per-fruit matters more than it sounds — it's the difference between
 * a pineapple and a durian even when the bumps themselves are identical.
 *
 *   spiral  golden-angle phyllotaxis. Correct ONLY where the surface units grew
 *           from organ primordia on a meristem: pineapple's fruitlets, dragon
 *           fruit's bracts, salak's scales, a pinecone. On a barrel this puts the
 *           units on Fibonacci parastichies (the 8/13/21 spirals you can count on
 *           a real pineapple) with no extra work, and it's why a fruitlet has six
 *           neighbours — three spiral families crossing.
 *   scatter blue-noise-ish packing, NOT a spiral. This is the common case and the
 *           easy thing to get wrong: a durian's spines are epidermal outgrowths of
 *           the capsule wall, and a lychee's tubercles are peel, so neither
 *           inherits a meristem's spiral. They pack evenly but without long-range
 *           order. (Approximated here by a heavily jittered golden angle, which
 *           decorrelates the rows while still resisting clumps far better than
 *           uniform random.)
 *   rows    features aligned into longitudinal ranks, following ribs — a kiwano's
 *           horns tracking the underlying cucurbit ridges.
 *
 * In every mode the points are spaced by equal AREA, not by equal v. The lateral
 * area of a slice goes as r(v)·|dP/dv|, so a naive v = i/count crowds the narrow
 * poles — the difference between a durian evenly studded with spines and one with
 * a bald belly and a thicket at each end.
 */
export const ARRANGEMENTS = ['spiral', 'scatter', 'rows'];

export function scatterSurface(count, radiusAt, axisAt, opts = {}) {
  const {
    mode = 'spiral', spiral = 1, jitter = 0, seed = 1,
    rows = 8, v0 = 0.02, v1 = 0.98,
  } = opts;
  if (count < 1) return [];

  const STEPS = 160;
  // Cumulative lateral area A(v), sampled, then inverted by binary search.
  const cum = new Float64Array(STEPS + 1);
  let prevR = radiusAt(v0), prevY = axisAt(v0), total = 0;
  for (let i = 1; i <= STEPS; i++) {
    const v = v0 + ((v1 - v0) * i) / STEPS;
    const r = radiusAt(v), y = axisAt(v);
    total += Math.PI * (r + prevR) * Math.hypot(r - prevR, y - prevY); // frustum lateral area
    cum[i] = total;
    prevR = r; prevY = y;
  }
  if (total <= 0) return [];

  const vAtArea = (frac) => {
    const target = total * clamp(frac, 0, 1);
    let lo = 0, hi = STEPS;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] < target) lo = mid + 1; else hi = mid;
    }
    return v0 + ((v1 - v0) * lo) / STEPS;
  };

  const out = [];
  const R = Math.max(1, Math.round(rows));
  const perRow = Math.max(1, Math.ceil(count / R));

  for (let i = 0; i < count; i++) {
    let u, v;
    if (mode === 'rows') {
      const row = i % R;
      const k = Math.floor(i / R);
      v = vAtArea((k + 0.5) / perRow);
      // Stagger alternate ranks so the horns interlock rather than forming a grid.
      u = row / R + (k % 2) * (0.5 / R);
    } else {
      v = vAtArea((i + 0.5) / count);
      u = ((i * GOLDEN_ANGLE * spiral) / TAU) % 1;
    }
    // `scatter` is a spiral with its long-range order shaken out of it.
    const j = mode === 'scatter' ? Math.max(jitter, 0.55) : jitter;
    if (j > 0) {
      u += (hash1(i * 3.7 + seed) - 0.5) * j * (mode === 'rows' ? 0.6 / R : 0.55);
      v = clamp(v + (hash1(i * 9.1 + seed * 2) - 0.5) * j * (v1 - v0) * 0.5, v0, v1);
    }
    out.push({ u: u - Math.floor(u), v });
  }
  return out;
}

/** Blend hex colours in linear-ish space; good enough for palette morphing. */
export function lerpHex(a, b, t) {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  const r = Math.round(lerp(ar * ar, br * br, t) ** 0.5);
  const g = Math.round(lerp(ag * ag, bg * bg, t) ** 0.5);
  const bl = Math.round(lerp(ab * ab, bb * bb, t) ** 0.5);
  return (r << 16) | (g << 8) | bl;
}
