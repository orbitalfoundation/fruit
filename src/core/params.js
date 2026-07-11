import { lerpTree, lerpHex, clone } from './math.js';

/**
 * A fruit IS this tree. Everything downstream — the mesh, the spines, the seeds,
 * the shareable URL — is a pure function of it.
 *
 * The fish rig next door is organised around a spine and a swim cycle. A fruit has
 * neither, and forcing it into that shape would have been the wrong abstraction.
 * What a fruit has instead is a body of revolution wearing three independent
 * fields — an angular one (ribs), a scattered one (features) and a volumetric one
 * (seeds) — and the interesting fruit are the ones that turn on an unlikely
 * combination of them. Bitter melon really is ribs AND warts; a durian really is a
 * five-carpel body under a blue-noise field of pyramids.
 *
 * Dimensions are metres. Feature sizes are fractions of the fruit's own radius, so
 * a preset stays itself when you drag `scale` from a lychee to a jackfruit.
 */
export function defaultParams() {
  return {
    id: 'berry',
    displayName: 'Generic Berry',
    scale: 0.09, // overall height, in metres, tip to tail

    body: {
      aspect: 1.0,     // width / height. 0.05 = a snake gourd; 3 = a squat pumpkin
      bulge: 0.5,      // where the widest point sits. < 0.5 = pear/avocado/salak
      baseFill: 2.0,   // blossom-end shoulder: <1 pointed, 2 round, >4 blunt/flat
      tipFill: 2.0,    // stem-end shoulder
      neck: 0.0,       // a secondary waist — a pear's, a gourd's
      neckPos: 0.78,
      neckWidth: 0.16,
      bend: 0.0,       // banana / chilli curvature
    },

    // Angular modulation. Five deep ribs is a carambola; eight shallow ones is a
    // ribbed pumpkin; deep ribs that only bite near the tip split the body into
    // fingers, which is roughly what happened to a Buddha's hand (its carpels
    // never fused).
    ribs: {
      count: 0,
      depth: 0.0,   // fraction of radius
      sharp: 1.0,   // >1 sharpens ridges into wings and deepens the valleys
      twist: 0.0,   // spiral the ribs around the axis
      ramp: 0.0,    // 0 = ribbed end to end; 1 = only at the distal end (fingers)
    },

    // Isotropic rind noise, independent of the discrete features above.
    rind: {
      warts: 0.0,     // low-frequency lumps (bitter melon, osage orange)
      wartScale: 4.0,
      netting: 0.0,   // raised ridges (a cantaloupe's suberised crack network)
      netScale: 9.0,
      seed: 1,
    },

    // Discrete surface units: spines, tubercles, fruitlets, scales, hairs.
    features: {
      count: 0,
      height: 0.16,        // fraction of radius. Durian ~0.10-0.23; dragon fruit ~1.0
      width: 0.14,
      sharp: 1.0,          // tip profile: 0.3 dome, 1 cone, 2.5 needle
      sides: 16,           // 4-6 = faceted pyramid/hexagon, 16+ = smooth
      elong: 0.0,          // draw the footprint out along the axis → a scale
      tilt: 0.0,           // radians off the normal, toward the stem end
      curve: 0.0,          // recurve the tip into a hook (soursop)
      latGrad: 0.0,        // taller at the base (-) or the apex (+)
      arrangement: 'scatter', // 'spiral' | 'scatter' | 'rows' — see math.scatterSurface
      spiral: 1,
      rows: 8,
      jitter: 0.15,
      coverBase: 0.03,     // features live between these two latitudes
      coverTip: 0.97,
      seed: 1,
    },

    seeds: {
      mode: 'core',   // see geom/seeds.js SEED_MODES
      count: 8,
      size: 0.07,     // fraction of radius
      spread: 1.0,
      segments: 5,    // locules — 5 for a pome's carpel star, ~10 for a citrus
      seed: 3,
    },

    // The pale column down the middle: an apple's core, a kiwi's pith.
    core: { enabled: false, radius: 0.18, height: 0.75 },

    crown: { leaves: 0, height: 0.55, width: 0.1, spread: 0.7, bend: 0.35 },
    stem: { length: 0.0, radius: 0.05 },
    calyx: { lobes: 0, size: 0.3 },

    skin: {
      topColor: 0xc0563a,
      bottomColor: 0xd98b52,
      featureColor: 0xb04a30,
      featureTipColor: 0x7fb04a,
      fleshColor: 0xf6f2ea,
      seedColor: 0x2b1c12,
      coreColor: 0xf2ecd8,
      leafColor: 0x3e7031,
      stemColor: 0x6b5136,

      translucency: 0.35, // MeshPhysical transmission — the seeds show through this
      thickness: 0.7,     // in fruit heights; how far light travels in the flesh
      attenuation: 0.6,   // flesh colour saturates with depth
      roughness: 0.42,
      clearcoat: 0.35,
      sheen: 0.0,
      mottle: 0.25,
      mottleScale: 8.0,
      blush: 0.0,

      // Micro-surface. A rind is never uniformly anything, and a constant roughness
      // over a smooth normal is the loudest "this is CG" tell there is.
      // Frequencies are in units of the fruit's own height, so they hold their look
      // as `scale` changes. Keep them well below the mesh's sampling rate: pushed too
      // fine, procedural relief doesn't read as texture, it aliases into TV static.
      pits: 0.4,        // orange-peel dimpling — dense, shallow, isotropic
      pitScale: 30,
      striations: 0.22, // faint streaks stretched ALONG the fruit's growth axis
      striScale: 16,
      roughVar: 0.5,    // waxy patches and dull patches
      // Keep this SMALL. The derivative-based normal perturbation divides the height
      // gradient by the (tiny) screen-space determinant, so it is not scale-normalised
      // and its useful range is nothing like 0..1: at 0.22 the normals blow out and the
      // rind grows glossy grey worms; 0.08 is a well-pitted orange peel.
      bump: 0.08,       // how hard the relief bends the shading normal
      wax: 0.18,        // the powdery grazing-angle bloom of a plum or a grape
    },

    mesh: { segU: 160, segV: 128 },
  };
}

/** Blend two fruit. Numbers lerp, colours lerp in colour space, strings snap. */
export function morphParams(a, b, t) {
  const out = lerpTree(a, b, t);
  for (const k of Object.keys(a.skin)) {
    if (typeof a.skin[k] === 'number' && k.toLowerCase().includes('color')) {
      out.skin[k] = lerpHex(a.skin[k], b.skin[k], t);
    }
  }
  // Counts and enums have to land on integers/valid values, not halfway between.
  out.ribs.count = Math.round(out.ribs.count);
  out.features.count = Math.round(out.features.count);
  out.features.sides = Math.round(out.features.sides);
  out.features.arrangement = t < 0.5 ? a.features.arrangement : b.features.arrangement;
  out.seeds.mode = t < 0.5 ? a.seeds.mode : b.seeds.mode;
  out.seeds.count = Math.round(out.seeds.count);
  out.seeds.segments = Math.round(out.seeds.segments);
  out.crown.leaves = Math.round(out.crown.leaves);
  out.calyx.lobes = Math.round(out.calyx.lobes);
  out.core.enabled = t < 0.5 ? a.core.enabled : b.core.enabled;
  out.id = t < 0.5 ? a.id : b.id;
  out.displayName = t <= 0 ? a.displayName : t >= 1 ? b.displayName
    : `${a.displayName} ↔ ${b.displayName}`;
  return out;
}

export { clone };
