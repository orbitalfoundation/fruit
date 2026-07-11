import * as THREE from 'three';

/**
 * Fruit shading.
 *
 * The one non-negotiable: the flesh has to be SEMI-TRANSPARENT, because the seeds
 * are the point. That's `transmission` on a MeshPhysicalMaterial rather than plain
 * alpha — transmission refracts what's behind the surface and keeps specular
 * highlights on top, so the fruit reads as a solid translucent body with things
 * suspended in it (a lychee, a grape held up to a window) instead of a ghost. The
 * seeds and core are opaque, so they render into the transmission pass and show
 * through.
 *
 * The rind colour is a vertical gradient with a mottle: almost every fruit is
 * darker/redder at the sun-facing shoulder and paler at the blossom end, and the
 * speckle breaks up the plastic uniformity that kills a CG fruit.
 */

const GRADIENT_VERT = /* glsl */`
  varying float vHeightT;
  varying vec3 vObjPos;
`;

const GRADIENT_FRAG = /* glsl */`
  varying float vHeightT;
  varying vec3 vObjPos;
  uniform vec3 uTopColor;
  uniform vec3 uBottomColor;
  uniform float uMottle;
  uniform float uMottleScale;
  uniform float uBlush;
  uniform float uHeight;   // also used here, not just in the vertex stage

  // Surface detail — the difference between "fruit" and "plastic fruit".
  uniform float uPits;        // orange-peel pitting: fine, dense, shallow
  uniform float uPitScale;
  uniform float uStriations;  // faint lengthwise streaks, running along the fruit's axis
  uniform float uStriScale;
  uniform float uRoughVar;    // spatial roughness breakup — waxy patches and dull patches
  uniform float uBumpAmount;
  uniform float uWax;         // powdery grazing-angle bloom, like a plum's

  float h31(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float vnoise(vec3 p){
    vec3 i = floor(p), f = fract(p);
    f = f*f*(3.0-2.0*f);
    float n000=h31(i), n100=h31(i+vec3(1,0,0)), n010=h31(i+vec3(0,1,0)), n110=h31(i+vec3(1,1,0));
    float n001=h31(i+vec3(0,0,1)), n101=h31(i+vec3(1,0,1)), n011=h31(i+vec3(0,1,1)), n111=h31(i+vec3(1,1,1));
    return mix(mix(mix(n000,n100,f.x), mix(n010,n110,f.x), f.y),
               mix(mix(n001,n101,f.x), mix(n011,n111,f.x), f.y), f.z);
  }
  float fbm(vec3 p){
    return 0.55 * vnoise(p) + 0.30 * vnoise(p * 2.07) + 0.15 * vnoise(p * 4.13);
  }

  /**
   * The micro-relief height field, in the surface's own object space.
   *
   * Two layers, and they're anisotropic on purpose:
   *
   *   PITS — dense, shallow, isotropic. This is orange-peel: thousands of tiny
   *   dimples. It is the single biggest reason a CG fruit stops looking injection-
   *   moulded, because it breaks the specular into a thousand pieces instead of one
   *   clean highlight.
   *
   *   STRIATIONS — stretched hard ALONG the fruit's axis (sampled at high frequency
   *   around it, low frequency up it), so the noise smears into faint lengthwise
   *   streaks rather than blobs. That anisotropy is the whole point: real rind grew
   *   by extending along one axis, and its fibres, wrinkles and colour striations all
   *   line up with that growth. On a feature (a dragon fruit's bract, a durian spine)
   *   the same function runs down the spine of the scale and reads as fibrous veining,
   *   because a feature's local +Y IS its spine.
   */
  /**
   * Analytic LOD. A procedural texture has no mip pyramid, so the moment its
   * wavelength approaches one pixel it stops being texture and starts being TV
   * static. fwidth(p) tells us how much surface a pixel covers; fade each layer out
   * as its frequency approaches that rate. Without this the pitting shimmers into a
   * crawling checkerboard the instant you orbit the fruit.
   * (No backticks in here: the whole shader lives inside a JS template literal.)
   */
  vec2 detailFade(vec3 p){
    float fw = max(length(fwidth(p)), 1e-7);
    return vec2(1.0 / (1.0 + uPitScale * fw * 7.0),
                1.0 / (1.0 + uStriScale * fw * 7.0));
  }

  /**
   * RELIEF — what actually bends the light. Pitting only.
   *
   * The striations deliberately do NOT go in here. They're anisotropic by
   * construction (high frequency around the fruit, low along it), so as a height
   * field they are literally snakes — and pushing snakes through the normal gave the
   * durian a set of glossy grey worms crawling over its rind. In a real fruit the
   * lengthwise striations are PIGMENT, not relief: they're colour laid down along the
   * growth axis, and they don't catch the light. So they tint the albedo (below) and
   * leave the normal alone, which is both more physical and much better looking.
   */
  float reliefHeight(vec3 p, vec2 fade){
    if (uPits <= 0.0001) return 0.0;
    float n = vnoise(p * uPitScale);
    return uPits * fade.x * (n * n - 0.25);   // squared → dimples, not bumps
  }

  /** PIGMENT — relief plus the colour-only striations. Albedo, never the normal. */
  float detailHeight(vec3 p, vec2 fade){
    float h = reliefHeight(p, fade);
    if (uStriations > 0.0001) {
      h += uStriations * fade.y *
           (fbm(vec3(p.x * uStriScale, p.y * uStriScale * 0.12, p.z * uStriScale)) - 0.5);
    }
    return h;
  }

  /**
   * Perturb the shading normal from that height field WITHOUT a normal map, UVs or
   * tangents — Mikkelsen's derivative trick. We have no UV parameterisation worth
   * having (the rind is a lathe with ribs and noise on it), so we recover the surface
   * gradient from screen-space derivatives of position and height instead. Costs two
   * dFdx/dFdy pairs and needs no authored texture at all.
   */
  vec3 perturbNormal(vec3 N, vec3 p, vec2 fade){
    if (uBumpAmount <= 0.0001) return N;
    vec3 dpdx = dFdx(p);
    vec3 dpdy = dFdy(p);
    float h  = reliefHeight(p, fade);   // relief only — see above
    float hx = dFdx(h);
    float hy = dFdy(h);
    vec3 r1 = cross(dpdy, N);
    vec3 r2 = cross(N, dpdx);
    float det = dot(dpdx, r1);
    vec3 grad = sign(det) * (hx * r1 + hy * r2);
    return normalize(abs(det) * N - uBumpAmount * grad);
  }
`;

/** Inject the gradient, the mottle and the surface detail into a lit material. */
function withGradient(mat, opts) {
  const d = opts.detail || {};
  mat.userData.uniforms = {
    uTopColor: { value: new THREE.Color(opts.topColor) },
    uBottomColor: { value: new THREE.Color(opts.bottomColor) },
    uMottle: { value: opts.mottle ?? 0 },
    uMottleScale: { value: opts.mottleScale ?? 8 },
    uBlush: { value: opts.blush ?? 0 },
    uHeight: { value: opts.height || 1 },
    uPits: { value: d.pits ?? 0 },
    uPitScale: { value: d.pitScale ?? 55 },
    uStriations: { value: d.striations ?? 0 },
    uStriScale: { value: d.striScale ?? 22 },
    uRoughVar: { value: d.roughVar ?? 0 },
    uBumpAmount: { value: d.bump ?? 0 },
    uWax: { value: d.wax ?? 0 },
  };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, mat.userData.uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${GRADIENT_VERT}\nuniform float uHeight;`)
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vObjPos = position;
         vHeightT = clamp(position.y / max(uHeight, 1e-4) + 0.5, 0.0, 1.0);`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${GRADIENT_FRAG}`)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         {
           // Ripeness runs up the fruit: the shoulder that faced the sun is the
           // saturated end, the blossom end is paler.
           float t = smoothstep(0.05, 0.95, vHeightT);
           vec3 base = mix(uBottomColor, uTopColor, t);
           float n = vnoise(vObjPos * uMottleScale / max(uHeight, 1e-4));
           float speck = vnoise(vObjPos * uMottleScale * 3.7 / max(uHeight, 1e-4));
           base *= 1.0 + uMottle * (n - 0.5) * 0.85;
           base = mix(base, base * (0.55 + 0.9 * speck), uMottle * 0.35);

           // Colour follows the relief. Pits sit in shadow and striations darken the
           // grooves, so the albedo and the normal agree with each other — when they
           // disagree, the eye reads "texture painted on plastic" instantly.
           vec3 dp = vObjPos / max(uHeight, 1e-4);
           float relief = detailHeight(dp, detailFade(dp));
           base *= 1.0 + clamp(relief, -0.5, 0.5) * 0.30;

           // A blush of the top colour pooling on one flank, like a cheek.
           float cheek = smoothstep(0.1, 1.0, normalize(vObjPos + vec3(0.0,1e-5,0.0)).x);
           base = mix(base, uTopColor, uBlush * cheek * 0.6);
           diffuseColor.rgb *= base;
         }`
      )
      // Perturb the shading normal from the procedural relief.
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
         {
           vec3 dp = vObjPos / max(uHeight, 1e-4);
           normal = perturbNormal(normal, dp, detailFade(dp));
         }`
      )
      // Break the roughness up spatially. A real rind is not uniformly anything:
      // it has waxy patches that catch the light and dull patches that don't, and a
      // single constant roughness is the loudest "this is CG" tell there is.
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
         {
           vec3 rp = vObjPos / max(uHeight, 1e-4);
           float rfade = 1.0 / (1.0 + 48.0 * max(length(fwidth(rp)), 1e-7) * 7.0);
           float rv = fbm(rp * 48.0);
           roughnessFactor = clamp(
             roughnessFactor * (1.0 + uRoughVar * rfade * (rv - 0.5) * 0.85), 0.12, 1.0);
         }`
      )
      // The powdery bloom on a plum or a grape: a pale haze that only shows at
      // grazing angles. Cheap, and it reads as "this fruit has been outdoors".
      .replace(
        '#include <opaque_fragment>',
        `{
           float fres = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 3.5);
           outgoingLight += vec3(0.9, 0.92, 0.88) * fres * uWax * 0.35;
         }
         #include <opaque_fragment>`
      );
  };
  // three caches programs by this key; bump it when the injected source changes.
  mat.customProgramCacheKey = () => 'fruit-surface-v6';
  return mat;
}

/** The body's micro-surface: fine isotropic pitting plus faint axial striations. */
function skinDetail(sk) {
  return {
    pits: sk.pits, pitScale: sk.pitScale,
    striations: sk.striations, striScale: sk.striScale,
    roughVar: sk.roughVar, bump: sk.bump, wax: sk.wax,
  };
}

/**
 * The features' micro-surface. A dragon fruit's bract or a durian's spine is a
 * different material from the rind it stands on: drier, rougher, harder in the
 * specular, no waxy bloom — and above all FIBROUS, with veins running lengthwise
 * down its spine. That falls out for free, because a feature's local +Y *is* its
 * spine, and the striation noise is stretched along exactly that axis.
 */
function featureDetail(sk) {
  return {
    pits: sk.pits * 0.5, pitScale: sk.pitScale * 1.15,
    striations: sk.striations * 2.4 + 0.10,   // the fibrous veining
    striScale: sk.striScale * 1.6,
    roughVar: sk.roughVar * 1.25,
    bump: sk.bump * 1.35,
    wax: 0.0,                                  // scales are dry; only the rind blooms
  };
}

export function makeMaterials(p, clipPlanes) {
  const sk = p.skin;
  const H = p.scale;

  const skin = withGradient(
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: sk.roughness,
      clearcoat: sk.clearcoat,
      clearcoatRoughness: 0.25,
      // The translucency that lets the seeds read through the flesh.
      transmission: sk.translucency,
      thickness: sk.thickness * p.scale,
      attenuationDistance: Math.max(sk.attenuation, 0.01) * p.scale,
      attenuationColor: new THREE.Color(sk.fleshColor),
      ior: 1.4,
      specularIntensity: 1.0,
      sheen: sk.sheen,
      sheenColor: new THREE.Color(0xffffff),
      sheenRoughness: 0.7,
      // DoubleSide so slicing the fruit open shows the inner wall of the rind
      // rather than looking straight through a hole.
      side: THREE.DoubleSide,
      clippingPlanes: clipPlanes,
      clipShadows: true,
    }),
    { topColor: sk.topColor, bottomColor: sk.bottomColor, mottle: sk.mottle, mottleScale: sk.mottleScale, blush: sk.blush, height: H, detail: skinDetail(sk) }
  );

  const feature = withGradient(
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: Math.min(sk.roughness + 0.15, 1),
      clearcoat: sk.clearcoat * 0.5,
      // Spikes and scales are usually more opaque and drier than the flesh — but
      // a little transmission keeps thin tips from looking like plastic.
      transmission: sk.translucency * 0.25,
      thickness: sk.thickness * p.scale * 0.3,
      ior: 1.4,
      side: THREE.DoubleSide,
      clippingPlanes: clipPlanes,
    }),
    { topColor: sk.featureTipColor, bottomColor: sk.featureColor, mottle: sk.mottle * 0.5, mottleScale: sk.mottleScale * 2, blush: 0, height: H * 0.25, detail: featureDetail(sk) }
  );

  const seed = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(sk.seedColor),
    roughness: 0.32,
    clearcoat: 0.6,
    clearcoatRoughness: 0.3,
    clippingPlanes: clipPlanes,
  });

  const core = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(sk.coreColor),
    roughness: 0.75,
    transmission: sk.translucency * 0.35,
    thickness: p.scale * 0.2,
    ior: 1.35,
    side: THREE.DoubleSide,
    clippingPlanes: clipPlanes,
  });

  const leaf = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(sk.leafColor),
    roughness: 0.6,
    clearcoat: 0.35,
    sheen: 0.4,
    sheenColor: new THREE.Color(0x9fd07a),
    side: THREE.DoubleSide,
    clippingPlanes: clipPlanes,
  });

  const stem = new THREE.MeshStandardMaterial({
    color: new THREE.Color(sk.stemColor),
    roughness: 0.85,
    clippingPlanes: clipPlanes,
  });

  return { skin, feature, seed, core, leaf, stem };
}

/** Push live parameter edits into the materials without rebuilding geometry. */
export function applySkin(mats, p) {
  const sk = p.skin;
  const H = p.scale;

  mats.skin.roughness = sk.roughness;
  mats.skin.clearcoat = sk.clearcoat;
  mats.skin.transmission = sk.translucency;
  mats.skin.thickness = sk.thickness * p.scale;
  mats.skin.attenuationDistance = Math.max(sk.attenuation, 0.01) * p.scale;
  mats.skin.attenuationColor.set(sk.fleshColor);
  mats.skin.sheen = sk.sheen;

  mats.feature.roughness = Math.min(sk.roughness + 0.15, 1);
  mats.feature.clearcoat = sk.clearcoat * 0.5;
  mats.feature.transmission = sk.translucency * 0.25;

  mats.seed.color.set(sk.seedColor);
  mats.core.color.set(sk.coreColor);
  mats.core.transmission = sk.translucency * 0.35;
  mats.leaf.color.set(sk.leafColor);
  mats.stem.color.set(sk.stemColor);

  const pushDetail = (u, d) => {
    u.uPits.value = d.pits; u.uPitScale.value = d.pitScale;
    u.uStriations.value = d.striations; u.uStriScale.value = d.striScale;
    u.uRoughVar.value = d.roughVar; u.uBumpAmount.value = d.bump; u.uWax.value = d.wax;
  };
  pushDetail(mats.skin.userData.uniforms, skinDetail(sk));
  pushDetail(mats.feature.userData.uniforms, featureDetail(sk));

  const su = mats.skin.userData.uniforms;
  su.uTopColor.value.set(sk.topColor);
  su.uBottomColor.value.set(sk.bottomColor);
  su.uMottle.value = sk.mottle;
  su.uMottleScale.value = sk.mottleScale;
  su.uBlush.value = sk.blush;
  su.uHeight.value = H;

  const fu = mats.feature.userData.uniforms;
  fu.uTopColor.value.set(sk.featureTipColor);
  fu.uBottomColor.value.set(sk.featureColor);
  fu.uMottle.value = sk.mottle * 0.5;
  fu.uMottleScale.value = sk.mottleScale * 2;
  fu.uHeight.value = H * 0.25;

  for (const m of Object.values(mats)) m.needsUpdate = true;
}
