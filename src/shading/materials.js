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

  float h31(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float vnoise(vec3 p){
    vec3 i = floor(p), f = fract(p);
    f = f*f*(3.0-2.0*f);
    float n000=h31(i), n100=h31(i+vec3(1,0,0)), n010=h31(i+vec3(0,1,0)), n110=h31(i+vec3(1,1,0));
    float n001=h31(i+vec3(0,0,1)), n101=h31(i+vec3(1,0,1)), n011=h31(i+vec3(0,1,1)), n111=h31(i+vec3(1,1,1));
    return mix(mix(mix(n000,n100,f.x), mix(n010,n110,f.x), f.y),
               mix(mix(n001,n101,f.x), mix(n011,n111,f.x), f.y), f.z);
  }
`;

/** Inject the gradient+mottle into any of three's lit materials. */
function withGradient(mat, opts) {
  mat.userData.uniforms = {
    uTopColor: { value: new THREE.Color(opts.topColor) },
    uBottomColor: { value: new THREE.Color(opts.bottomColor) },
    uMottle: { value: opts.mottle ?? 0 },
    uMottleScale: { value: opts.mottleScale ?? 8 },
    uBlush: { value: opts.blush ?? 0 },
    uHeight: { value: opts.height || 1 },
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
           // A blush of the top colour pooling on one flank, like a cheek.
           float cheek = smoothstep(0.1, 1.0, normalize(vObjPos + vec3(0.0,1e-5,0.0)).x);
           base = mix(base, uTopColor, uBlush * cheek * 0.6);
           diffuseColor.rgb *= base;
         }`
      );
  };
  // three caches programs by this key; bump it when the injected source changes.
  mat.customProgramCacheKey = () => 'fruit-gradient-v1';
  return mat;
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
    { topColor: sk.topColor, bottomColor: sk.bottomColor, mottle: sk.mottle, mottleScale: sk.mottleScale, blush: sk.blush, height: H }
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
    { topColor: sk.featureTipColor, bottomColor: sk.featureColor, mottle: sk.mottle * 0.5, mottleScale: sk.mottleScale * 2, blush: 0, height: H * 0.25 }
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
