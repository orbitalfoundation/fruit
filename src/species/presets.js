import { defaultParams } from '../core/params.js';

/**
 * Fourteen fruit chosen to span the morphospace rather than the supermarket.
 *
 * Numbers here are real where the botany gave real ones: a durian's spines are
 * 0.7–1.7 cm tall on a ~7.5 cm radius (hence height ≈ 0.18 of the radius) and sit
 * on hexagonal bases; a pineapple is 100–200 hexagonal fruitlets on golden-angle
 * spirals; a dragon fruit averages 39 bracts; a carambola has 5 ribs and 4–5
 * locules. Colours are calibrated from reference imagery, not measured.
 *
 * The point of each preset is to sit somewhere no other preset does — durian and
 * cherimoya share an arrangement but nothing else; rambutan and dragon fruit have
 * the tallest features relative to their radius but one is a hair and the other a
 * leaf. What's fun is what's BETWEEN them, which is what the blend slider is for.
 */

// ── the spiky end ────────────────────────────────────────────────────────────

/** Durian: a five-carpel capsule under a blue-noise field of hexagonal pyramids.
 *  The spines are NOT on a spiral — they're outgrowths of the husk, not flowers. */
function durian() {
  const p = defaultParams();
  p.id = 'durian';
  p.displayName = 'Durian';
  p.scale = 0.30;
  p.body.aspect = 0.52;    // ~30 × 15 cm
  p.body.bulge = 0.48;
  p.body.baseFill = 2.4;
  p.body.tipFill = 1.7;
  // The five sutures the husk splits along — shallow, but they organise the fruit.
  p.ribs = { count: 5, depth: 0.055, sharp: 0.8, twist: 0.0, ramp: 0.0 };
  p.features = {
    ...p.features,
    count: 210, height: 0.20, width: 0.15, sharp: 1.5, sides: 6,
    tilt: 0.08, curve: 0.05, arrangement: 'scatter', jitter: 0.5, seed: 11,
  };
  p.seeds = { mode: 'radial', count: 10, size: 0.30, spread: 0.85, segments: 5, seed: 4 };
  p.stem = { length: 0.08, radius: 0.07 };
  Object.assign(p.skin, {
    topColor: 0x8f9448, bottomColor: 0x7e8b3e,
    featureColor: 0x77803a, featureTipColor: 0xa89b5b,
    fleshColor: 0xf2d06b, seedColor: 0x8b6f47,
    translucency: 0.12, roughness: 0.62, clearcoat: 0.1, mottle: 0.3, thickness: 0.5,
  });
  return p;
}

/** Kiwano: tall sharp horns in longitudinal rows, following the cucurbit's ribs,
 *  over a chamber of lime-green jelly and flat white seeds. */
function kiwano() {
  const p = defaultParams();
  p.id = 'kiwano';
  p.displayName = 'Kiwano (Horned Melon)';
  p.scale = 0.13;
  p.body.aspect = 0.58;
  p.body.baseFill = 2.6;
  p.body.tipFill = 2.6;
  p.ribs = { count: 10, depth: 0.05, sharp: 0.9, twist: 0.0, ramp: 0.0 };
  // Broad-based horns, not needles: a needle seen end-on shades into a dark ring
  // and reads as a crater punched into the rind rather than a spike coming out.
  p.features = {
    ...p.features,
    count: 62, height: 0.34, width: 0.15, sharp: 1.5, sides: 10,
    tilt: 0.12, arrangement: 'rows', rows: 10, jitter: 0.18, seed: 5,
  };
  p.seeds = { mode: 'cavity', count: 110, size: 0.05, spread: 1.25, segments: 5, seed: 7 };
  Object.assign(p.skin, {
    topColor: 0xe8891a, bottomColor: 0xd9a327,
    featureColor: 0xd9821a, featureTipColor: 0xc9a227,
    fleshColor: 0x8dc63f, seedColor: 0xf2efe0,
    translucency: 0.42, roughness: 0.4, clearcoat: 0.25, mottle: 0.45,
  });
  return p;
}

/** Soursop: not spines at all — the soft recurved tips of its carpels, every one
 *  hooking toward the apex, with one seed under each. */
function soursop() {
  const p = defaultParams();
  p.id = 'soursop';
  p.displayName = 'Soursop';
  p.scale = 0.26;
  p.body.aspect = 0.6;
  p.body.bulge = 0.44;
  p.body.tipFill = 1.5;
  p.body.bend = 0.1;       // soursop is usually oblique — a carpel that lost the argument
  p.features = {
    ...p.features,
    count: 420, height: 0.10, width: 0.06, sharp: 1.2, sides: 5,
    tilt: 0.45, curve: 1.15, arrangement: 'scatter', jitter: 0.45, seed: 9,
  };
  p.seeds = { mode: 'follow', count: 55, size: 0.10, spread: 0.5, segments: 5, seed: 2 };
  Object.assign(p.skin, {
    topColor: 0x4b6b31, bottomColor: 0x5f7d3c,
    featureColor: 0x547434, featureTipColor: 0x86a355,
    fleshColor: 0xfcfaf3, seedColor: 0x191210,
    translucency: 0.3, roughness: 0.5, clearcoat: 0.2, mottle: 0.25,
  });
  return p;
}

// ── the nodular end ──────────────────────────────────────────────────────────

/** Cherimoya: U-shaped areoles, one per carpel, mammillate at the base and
 *  flattening to shields at the apex — hence the latitude gradient. Each areole
 *  has a big glossy seed directly under it. */
function cherimoya() {
  const p = defaultParams();
  p.id = 'cherimoya';
  p.displayName = 'Cherimoya';
  p.scale = 0.13;
  p.body.aspect = 0.92;
  p.body.bulge = 0.42;
  p.body.tipFill = 1.6;
  p.features = {
    ...p.features,
    count: 48, height: 0.12, width: 0.30, sharp: 0.45, sides: 6,
    tilt: 0.1, latGrad: -0.65, arrangement: 'scatter', jitter: 0.35, seed: 13,
  };
  p.seeds = { mode: 'follow', count: 32, size: 0.14, spread: 0.55, segments: 5, seed: 6 };
  p.calyx = { lobes: 5, size: 0.22 };
  p.stem = { length: 0.06, radius: 0.05 };
  Object.assign(p.skin, {
    topColor: 0x7fa05b, bottomColor: 0x8fae6b,
    featureColor: 0x76965a, featureTipColor: 0xa3bd85,
    fleshColor: 0xfbf6e7, seedColor: 0x2b1c12,
    translucency: 0.34, roughness: 0.52, clearcoat: 0.18, mottle: 0.3,
  });
  return p;
}

/** Lychee: hundreds of small rigid tubercles on brittle polygonal plates, around
 *  a single glossy stone that's a third of the fruit. */
function lychee() {
  const p = defaultParams();
  p.id = 'lychee';
  p.displayName = 'Lychee';
  p.scale = 0.042;
  p.body.aspect = 0.92;
  p.body.bulge = 0.46;
  p.features = {
    ...p.features,
    count: 320, height: 0.07, width: 0.115, sharp: 0.5, sides: 6,
    tilt: 0.05, arrangement: 'scatter', jitter: 0.5, seed: 21,
  };
  p.seeds = { mode: 'pit', count: 1, size: 0.11, spread: 1, segments: 5, seed: 1 };
  p.stem = { length: 0.09, radius: 0.035 };
  Object.assign(p.skin, {
    topColor: 0xc1362f, bottomColor: 0x8e2a38,
    featureColor: 0xb03330, featureTipColor: 0xd8564a,
    fleshColor: 0xf6f2ea, seedColor: 0x3a2416,
    translucency: 0.3, roughness: 0.55, clearcoat: 0.12, mottle: 0.4, mottleScale: 16,
  });
  return p;
}

/** Rambutan: the tubercle taken to its limit, where it becomes a soft filament as
 *  long as the fruit's own radius. */
function rambutan() {
  const p = defaultParams();
  p.id = 'rambutan';
  p.displayName = 'Rambutan';
  p.scale = 0.05;
  p.body.aspect = 0.82;
  p.features = {
    ...p.features,
    count: 170, height: 0.85, width: 0.035, sharp: 1.1, sides: 8,
    tilt: 0.35, curve: 0.7, arrangement: 'scatter', jitter: 0.55, seed: 17,
  };
  p.seeds = { mode: 'pit', count: 1, size: 0.1, spread: 1, segments: 5, seed: 1 };
  Object.assign(p.skin, {
    topColor: 0xd42d2d, bottomColor: 0xc02533,
    featureColor: 0xd0402f, featureTipColor: 0x7dbe3a,
    fleshColor: 0xf7f1f0, seedColor: 0x7c5c3e,
    translucency: 0.28, roughness: 0.5, clearcoat: 0.2, mottle: 0.2,
  });
  return p;
}

// ── the scaly end ────────────────────────────────────────────────────────────

/** Pineapple: 100–200 hexagonal fruitlets on golden-angle spirals. Because the
 *  fruitlets ARE flowers, this is one of the few fruit where phyllotaxis is the
 *  right generator — and the 8/13/21 parastichies fall out for free. */
function pineapple() {
  const p = defaultParams();
  p.id = 'pineapple';
  p.displayName = 'Pineapple';
  p.scale = 0.28;
  p.body.aspect = 0.46;
  p.body.baseFill = 4.5;   // a barrel: square shoulders at both ends
  p.body.tipFill = 4.0;
  p.features = {
    ...p.features,
    count: 155, height: 0.11, width: 0.20, sharp: 0.35, sides: 6,
    elong: 0.12, tilt: 0.18, arrangement: 'spiral', spiral: 1, jitter: 0.0,
    coverBase: 0.02, coverTip: 0.99, seed: 2,
  };
  p.seeds = { mode: 'none', count: 0, size: 0.05, spread: 1, segments: 5, seed: 1 };
  p.core = { enabled: true, radius: 0.22, height: 0.9 };
  p.crown = { leaves: 26, height: 0.62, width: 0.11, spread: 0.75, bend: 0.4 };
  Object.assign(p.skin, {
    topColor: 0xc98a2b, bottomColor: 0xa8762c,
    featureColor: 0xb98329, featureTipColor: 0x6e8b3d,
    fleshColor: 0xf3d25f, seedColor: 0x3a2416, coreColor: 0xf6e6a8,
    leafColor: 0x3e7031,
    translucency: 0.22, roughness: 0.55, clearcoat: 0.15, mottle: 0.35,
  });
  return p;
}

/** Salak: imbricate scales — triangular plates laid back so they overlap like roof
 *  tiles. The negative tilt is what makes it read as reptilian rather than bumpy. */
function salak() {
  const p = defaultParams();
  p.id = 'salak';
  p.displayName = 'Salak (Snake Fruit)';
  p.scale = 0.075;
  p.body.aspect = 0.72;
  p.body.bulge = 0.40;     // teardrop: fat at the blossom end, drawn to a point
  p.body.baseFill = 2.8;
  p.body.tipFill = 1.15;
  // Imbricate tiles: laid back almost flat against the rind (tilt ≈ −78°) and
  // broader than they are tall, so each plate overlaps the one below it. Standing
  // them up even a little turns a snake fruit into a pine cone.
  p.features = {
    ...p.features,
    count: 190, height: 0.19, width: 0.17, sharp: 0.4, sides: 4,
    elong: 0.9, tilt: -1.3, arrangement: 'spiral', spiral: 1, jitter: 0.04, seed: 8,
  };
  p.seeds = { mode: 'pit', count: 1, size: 0.13, spread: 1, segments: 3, seed: 1 };
  Object.assign(p.skin, {
    topColor: 0x8a4522, bottomColor: 0x6b3a1e,
    featureColor: 0x6b3a1e, featureTipColor: 0xa8552b,
    fleshColor: 0xf4eddc, seedColor: 0x241611,
    translucency: 0.16, roughness: 0.38, clearcoat: 0.5, mottle: 0.3,
  });
  return p;
}

/** Dragon fruit: the largest surface features in the whole space — leafy bracts
 *  nearly as long as the fruit's radius — over a uniform volumetric scatter of
 *  ~a thousand tiny seeds. The showcase for translucent flesh. */
function dragonfruit() {
  const p = defaultParams();
  p.id = 'dragonfruit';
  p.displayName = 'Dragon Fruit';
  p.scale = 0.11;
  p.body.aspect = 0.66;
  p.body.baseFill = 1.9;
  p.body.tipFill = 1.9;
  // The bracts are genuinely long — 4 cm of bract on a 3 cm radius — but they LIE
  // BACK along the body like fins rather than standing off it, so the tilt has to
  // be near-tangent (~72°) or the fruit turns into an artichoke.
  p.features = {
    ...p.features,
    count: 39, height: 0.9, width: 0.15, sharp: 0.85, sides: 8,
    elong: 2.4, tilt: 1.26, curve: 0.85, latGrad: 0.3,
    arrangement: 'spiral', spiral: 1, jitter: 0.08,
    coverBase: 0.06, coverTip: 0.95, seed: 3,
  };
  p.seeds = { mode: 'dispersed', count: 420, size: 0.022, spread: 1, segments: 5, seed: 12 };
  Object.assign(p.skin, {
    topColor: 0xd6295e, bottomColor: 0xb52350,
    featureColor: 0xcf2f5c, featureTipColor: 0x7cb342,
    fleshColor: 0xfaf7f5, seedColor: 0x1a1512,
    translucency: 0.55, thickness: 0.55, roughness: 0.35, clearcoat: 0.4, mottle: 0.2,
  });
  return p;
}

/** Hala: a sphere assembled from wedge-shaped phalanges, like an exploding planet.
 *  Flat-topped truncated pyramids, and a colour gradient up each key. */
function hala() {
  const p = defaultParams();
  p.id = 'hala';
  p.displayName = 'Hala (Pandanus)';
  p.scale = 0.17;
  p.body.aspect = 1.0;
  p.features = {
    ...p.features,
    count: 64, height: 0.38, width: 0.27, sharp: 0.22, sides: 6,
    tilt: 0.0, arrangement: 'spiral', spiral: 1, jitter: 0.05,
    coverBase: 0.02, coverTip: 0.98, seed: 23,
  };
  p.seeds = { mode: 'follow', count: 64, size: 0.06, spread: 0.62, segments: 5, seed: 5 };
  Object.assign(p.skin, {
    topColor: 0xe8c547, bottomColor: 0xd8b23f,
    featureColor: 0x7fa33c, featureTipColor: 0xd63a20,
    fleshColor: 0xe5d9b6, seedColor: 0x6b4a24,
    translucency: 0.2, roughness: 0.55, clearcoat: 0.2, mottle: 0.35,
  });
  return p;
}

// ── the ribbed / long end ────────────────────────────────────────────────────

/** Carambola: five deep ribs and nothing else. Pure angular modulation, and the
 *  most translucent flesh here — you can see the seeds through an uncut one. */
function carambola() {
  const p = defaultParams();
  p.id = 'carambola';
  p.displayName = 'Carambola (Star Fruit)';
  p.scale = 0.12;
  p.body.aspect = 0.52;
  p.body.baseFill = 1.5;
  p.body.tipFill = 1.5;
  p.ribs = { count: 5, depth: 0.44, sharp: 1.9, twist: 0.0, ramp: 0.0 };
  p.features = { ...p.features, count: 0 };
  p.seeds = { mode: 'radial', count: 11, size: 0.11, spread: 0.7, segments: 5, seed: 3 };
  p.stem = { length: 0.05, radius: 0.03 };
  Object.assign(p.skin, {
    topColor: 0xf0c233, bottomColor: 0xd9b83a,
    featureColor: 0xd9b83a, featureTipColor: 0x9cbf3b,
    fleshColor: 0xf5e27a, seedColor: 0xb08d57,
    translucency: 0.72, thickness: 0.5, attenuation: 0.45,
    roughness: 0.22, clearcoat: 0.65, mottle: 0.12,
  });
  return p;
}

/** Buddha's hand: a citron whose carpels never fused, so the fruit grew as fingers.
 *  Approximated by ribs deep enough to nearly pinch through, ramped so they only
 *  bite at the distal end. Interior: solid pith. Nothing to reveal — which is its
 *  own kind of surprise when you slice it open. */
function buddhasHand() {
  const p = defaultParams();
  p.id = 'buddhashand';
  p.displayName = "Buddha's Hand";
  p.scale = 0.24;
  p.body.aspect = 0.55;
  p.body.bulge = 0.3;
  p.body.baseFill = 2.2;
  p.body.tipFill = 0.95;
  p.ribs = { count: 9, depth: 0.46, sharp: 2.3, twist: 0.12, ramp: 0.92 };
  p.features = { ...p.features, count: 0 };
  p.rind = { ...p.rind, warts: 0.25, wartScale: 7 };
  p.seeds = { mode: 'none', count: 0, size: 0.05, spread: 1, segments: 5, seed: 1 };
  p.stem = { length: 0.05, radius: 0.05 };
  Object.assign(p.skin, {
    topColor: 0xf5c518, bottomColor: 0xd9ae2a,
    featureColor: 0xd9ae2a, featureTipColor: 0xa8c24a,
    fleshColor: 0xfffdf5, seedColor: 0xe8e0c8,
    translucency: 0.5, thickness: 0.9, attenuation: 0.8,
    roughness: 0.45, clearcoat: 0.3, mottle: 0.35, mottleScale: 12,
  });
  return p;
}

/** Bitter melon: the fruit that proves ribs and warts are independent sliders —
 *  it runs both at once, tubercles marching along ~9 longitudinal ridges. */
function bitterMelon() {
  const p = defaultParams();
  p.id = 'bittermelon';
  p.displayName = 'Bitter Melon';
  p.scale = 0.22;
  p.body.aspect = 0.28;
  p.body.bulge = 0.5;
  p.body.baseFill = 1.1;
  p.body.tipFill = 1.1;
  p.ribs = { count: 9, depth: 0.16, sharp: 1.4, twist: 0.05, ramp: 0.0 };
  p.rind = { warts: 0.55, wartScale: 9, netting: 0.0, netScale: 9, seed: 4 };
  p.features = {
    ...p.features,
    count: 120, height: 0.16, width: 0.09, sharp: 1.3, sides: 5,
    tilt: 0.1, arrangement: 'rows', rows: 9, jitter: 0.25, seed: 31,
  };
  p.seeds = { mode: 'cavity', count: 30, size: 0.09, spread: 1.1, segments: 3, seed: 8 };
  Object.assign(p.skin, {
    topColor: 0x8fae4a, bottomColor: 0xa8bf5c,
    featureColor: 0x93b24d, featureTipColor: 0xc2d17a,
    fleshColor: 0xeef0d8, seedColor: 0xc9483a,
    translucency: 0.3, roughness: 0.45, clearcoat: 0.25, mottle: 0.3,
  });
  return p;
}

/** Snake gourd: the argument for letting the length slider go past "reasonable".
 *  Real ones reach two metres and coil; this one is merely absurd. */
function snakeGourd() {
  const p = defaultParams();
  p.id = 'snakegourd';
  p.displayName = 'Snake Gourd';
  p.scale = 0.9;
  p.body.aspect = 0.06;
  p.body.bulge = 0.55;
  p.body.baseFill = 1.4;
  p.body.tipFill = 1.2;
  p.body.bend = 0.55;
  p.ribs = { count: 12, depth: 0.08, sharp: 1.0, twist: 1.6, ramp: 0.0 };
  p.rind = { warts: 0.15, wartScale: 3, netting: 0.25, netScale: 14, seed: 6 };
  p.features = { ...p.features, count: 0 };
  p.seeds = { mode: 'dispersed', count: 90, size: 0.28, spread: 1, segments: 3, seed: 9 };
  p.mesh = { segU: 96, segV: 220 }; // it's mostly length — spend the vertices there
  Object.assign(p.skin, {
    topColor: 0xc43b21, bottomColor: 0xb5c97a,
    featureColor: 0xb5c97a, featureTipColor: 0xc43b21,
    fleshColor: 0xd9452a, seedColor: 0xe8dcc0,
    translucency: 0.35, roughness: 0.4, clearcoat: 0.3, mottle: 0.5, mottleScale: 5,
  });
  return p;
}

/** Cantaloupe: the netted rind — a suberised crack network, not a tiling — over a
 *  hollow cavity of seeds. The only preset that leans on the rind noise alone. */
function cantaloupe() {
  const p = defaultParams();
  p.id = 'cantaloupe';
  p.displayName = 'Cantaloupe';
  p.scale = 0.15;
  p.body.aspect = 1.05;
  p.ribs = { count: 10, depth: 0.045, sharp: 0.7, twist: 0.0, ramp: 0.0 };
  p.rind = { warts: 0.12, wartScale: 3.5, netting: 1.0, netScale: 13, seed: 2 };
  p.features = { ...p.features, count: 0 };
  p.seeds = { mode: 'cavity', count: 140, size: 0.05, spread: 1.0, segments: 3, seed: 11 };
  Object.assign(p.skin, {
    topColor: 0xc2b280, bottomColor: 0xa8a06a,
    featureColor: 0xd8cfa8, featureTipColor: 0xe4dcc0,
    fleshColor: 0xef9f5e, seedColor: 0xe8dcc0,
    translucency: 0.32, roughness: 0.72, clearcoat: 0.05, mottle: 0.45, mottleScale: 14,
  });
  return p;
}

/** Apple: the control group. Smooth, unremarkable, and the reason the five-carpel
 *  star in the middle is worth slicing open to see. */
function apple() {
  const p = defaultParams();
  p.id = 'apple';
  p.displayName = 'Apple';
  p.scale = 0.08;
  p.body.aspect = 1.05;
  p.body.bulge = 0.55;
  p.body.baseFill = 3.2;
  p.body.tipFill = 3.0;
  p.features = { ...p.features, count: 0 };
  p.seeds = { mode: 'core', count: 10, size: 0.09, spread: 1.0, segments: 5, seed: 5 };
  p.core = { enabled: true, radius: 0.14, height: 0.62 };
  p.stem = { length: 0.22, radius: 0.03 };
  p.calyx = { lobes: 5, size: 0.14 };
  Object.assign(p.skin, {
    topColor: 0xc0281f, bottomColor: 0xd8b13a,
    featureColor: 0xc0281f, featureTipColor: 0xd8b13a,
    fleshColor: 0xf7f0d8, seedColor: 0x4a2c14, coreColor: 0xf2ecd8,
    translucency: 0.3, roughness: 0.28, clearcoat: 0.7, mottle: 0.3, blush: 0.5,
  });
  return p;
}

export const SPECIES = {
  durian, pineapple, dragonfruit, carambola, kiwano, cherimoya, salak,
  buddhashand: buddhasHand, lychee, rambutan, soursop, hala,
  bittermelon: bitterMelon, snakegourd: snakeGourd, cantaloupe, apple,
};

export const SPECIES_ORDER = [
  'durian', 'pineapple', 'dragonfruit', 'carambola', 'kiwano', 'cherimoya',
  'salak', 'buddhashand', 'lychee', 'rambutan', 'soursop', 'hala',
  'bittermelon', 'snakegourd', 'cantaloupe', 'apple',
];

export function makeSpecies(id) {
  const f = SPECIES[id] || SPECIES.durian;
  return f();
}
