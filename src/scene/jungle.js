import * as THREE from 'three';

/**
 * A jungle, instead of a black void.
 *
 * These are tropical fruit — durian, rambutan, salak, dragon fruit — and standing them
 * in a black studio was both boring and a lie about where they come from. So: a
 * rainforest understorey. Deep green shade, a hot canopy above with gaps burning
 * through it, shafts of light coming down at an angle, and out-of-focus bokeh where
 * the sun catches leaves behind the subject.
 *
 * The important part is that the light doesn't just sit in the background — it lands
 * ON the fruit. A SpotLight with a projected "gobo" texture (a canvas of leaf-shaped
 * blobs) throws dappled shade across the rind, which is the single biggest reason a
 * render stops looking like a product shot and starts looking like a photograph: real
 * outdoor light is *broken up*, and a fruit lit by one clean key light reads as
 * plastic no matter how good its shader is.
 */

/** A leaf-dapple gobo: overlapping soft blobs, most of the frame dark. */
function dappleTexture(size = 512) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');

  // Dim, not black: the dapple should modulate the key, not gate it.
  ctx.fillStyle = '#4a5236';
  ctx.fillRect(0, 0, size, size);

  // Then punch bright gaps through the canopy. A few big ones, many small.
  let seed = 7;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 420; i++) {
    const r = (0.006 + Math.pow(rnd(), 2.4) * 0.045) * size;
    const x = rnd() * size, y = rnd() * size;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const warm = 200 + rnd() * 55;
    g.addColorStop(0, `rgba(255,${warm | 0},${(warm * 0.78) | 0},0.55)`);
    g.addColorStop(0.5, `rgba(190,${(warm * 0.85) | 0},120,0.18)`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

export function buildJungle(scene, renderer) {
  const sun = new THREE.Vector3();
  const params = { elevation: 52, azimuth: 40, density: 0.44, exposure: 1.05 };

  const uniforms = {
    uTime: { value: 0 },
    uSunDir: { value: sun },
    uCanopy: { value: new THREE.Color(0x3a6b2c) },   // leaves in shade
    uGap: { value: new THREE.Color(0xeaffb4) },      // sunlight burning through a gap
    uDeep: { value: new THREE.Color(0x16281a) },     // the dark understorey
    uFloor: { value: new THREE.Color(0x2c3a1e) },
    uDensity: { value: params.density },
  };

  const domeMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms,
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */`
      varying vec3 vDir;
      uniform float uTime;
      uniform vec3 uSunDir, uCanopy, uGap, uDeep, uFloor;
      uniform float uDensity;

      float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vnoise(vec2 p){
        vec2 i = floor(p), f = fract(p);
        f = f*f*(3.0-2.0*f);
        return mix(mix(h21(i), h21(i+vec2(1,0)), f.x),
                   mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y);
      }
      float fbm(vec2 p){
        float v = 0.0, a = 0.5;
        for (int i = 0; i < 5; i++) { v += a * vnoise(p); p *= 2.03; a *= 0.5; }
        return v;
      }

      void main(){
        vec3 d = normalize(vDir);
        float h = d.y;

        // Spherical domain for the foliage, drifting very slowly — the canopy breathes.
        vec2 uv = vec2(atan(d.z, d.x) * 1.6, d.y * 2.4);
        vec2 drift = vec2(uTime * 0.006, sin(uTime * 0.05) * 0.012);

        // Layer the canopy: three depths of leaves, each finer and darker than the
        // last. The layering is what gives the background a sense of DEPTH rather
        // than being a flat gradient — you can see through the near leaves to the
        // lit ones behind.
        float far  = fbm(uv * 1.6 + drift);
        float mid  = fbm(uv * 3.7 - drift * 1.7);
        float near = fbm(uv * 8.3 + drift * 2.6);

        // Gaps in the canopy, biased upward (the sky is up there somewhere).
        float sky = smoothstep(-0.75, 0.15, h);
        float gap = smoothstep(uDensity, uDensity + 0.22, far * 0.65 + mid * 0.35) * sky;

        vec3 col = mix(uDeep, uCanopy, smoothstep(-0.55, 0.35, h));
        col = mix(col, uFloor, smoothstep(-0.1, -0.7, h));       // forest floor below
        col = mix(col, uGap, gap * 1.0);                          // burn the gaps through

        // Near leaves silhouetted against the light — the layer that sells the depth.
        float leaves = smoothstep(0.42, 0.62, near);
        col *= 1.0 - leaves * 0.45 * sky;

        // Bokeh: the gaps go soft and round where they're behind the subject, which is
        // what an open aperture does to a bright background.
        float bokeh = pow(gap, 2.5);
        col += uGap * bokeh * 0.35;

        // Shafts of light raking down from the sun through the canopy.
        float sa = max(dot(d, normalize(uSunDir)), 0.0);
        float shaft = pow(sa, 3.0) * (0.35 + 0.65 * fbm(uv * 2.2 + drift * 3.0));
        col += vec3(0.85, 0.95, 0.55) * shaft * 0.35 * sky;

        // The sun itself, glimpsed through the leaves.
        col += vec3(1.0, 0.97, 0.85) * pow(sa, 260.0) * 2.2 * (0.35 + gap);

        gl_FragColor = vec4(col, 1.0);
      }`,
  });

  const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), domeMat);
  dome.renderOrder = -1;
  dome.frustumCulled = false;
  scene.add(dome);

  // ---- lights -----------------------------------------------------------------
  // The dappled key. This is the one that matters: it throws leaf-shadows across the
  // fruit, so the highlight is broken instead of being one clean plastic-looking blob.
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const key = new THREE.SpotLight(0xfff0cf, 60, 0, Math.PI / 3.4, 0.35, 1.1);
  key.map = dappleTexture();
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.0015;
  scene.add(key, key.target);

  // A cool green bounce from the surrounding foliage — everything in a jungle is lit
  // partly by leaf-filtered green light, and skipping it is why forest renders look wrong.
  const fill = new THREE.HemisphereLight(0xa8d878, 0x2a1f14, 0.85);
  const rim = new THREE.DirectionalLight(0xdcffb0, 1.5);
  const ambient = new THREE.AmbientLight(0xbfd9a0, 0.25);
  scene.add(fill, rim, ambient);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), domeMat.clone()));
  const envRT = pmrem.fromScene(envScene, 0.05);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 1.0;

  function sunDir() {
    const phi = THREE.MathUtils.degToRad(90 - params.elevation);
    const theta = THREE.MathUtils.degToRad(params.azimuth);
    sun.setFromSphericalCoords(1, phi, theta);
    return sun;
  }

  let span = 1;
  function apply() {
    sunDir();
    uniforms.uDensity.value = params.density;
    renderer.toneMappingExposure = params.exposure;

    const d = Math.max(span * 4, 0.5);
    key.position.copy(sun).multiplyScalar(d);
    key.target.position.set(0, 0, 0);
    key.target.updateMatrixWorld();
    // Intensity follows the inverse-square falloff, so the dapple stays put when the
    // fruit is scaled from a lychee to a jackfruit.
    key.intensity = 9 * d * d;
    key.distance = d * 6;
    key.shadow.camera.near = d * 0.05;
    key.shadow.camera.far = d * 5;
    key.shadow.camera.updateProjectionMatrix();

    rim.position.copy(sun).multiplyScalar(-d).setY(d * 0.4);
  }
  apply();

  const dapple = key.map;

  return {
    params, sun,
    update(dt) { uniforms.uTime.value += dt; },
    apply,

    /** Jungle or clean studio. The studio still exists because a busy background
     *  fights the subject in a gallery plate — but it is no longer the default. */
    setVisible(v) {
      dome.visible = v;
      scene.background = v ? null : new THREE.Color(0x0e0c0a);
      scene.environmentIntensity = v ? 1.0 : 0.6;
      rim.color.set(v ? 0xdcffb0 : 0xffd9a8);
      fill.color.set(v ? 0xa8d878 : 0xbfd4ff);
    },

    /**
     * How broken-up the light is. Raising it doesn't just add a texture — it also
     * pulls the ambient DOWN, because dappled light only reads if the shade is
     * actually dark. Flood the scene with fill and the leaf-shadows wash out to
     * nothing, which is the mistake that makes outdoor renders look like studio ones.
     */
    setDapple(v) {
      key.map = v > 0.02 ? dapple : null;
      fill.intensity = THREE.MathUtils.lerp(1.7, 0.55, v);
      ambient.intensity = THREE.MathUtils.lerp(0.6, 0.18, v);
      key.needsUpdate = true;
    },

    /** Size the jungle to the fruit. Returns the dome's radius so the caller can put
     *  its far plane beyond it (a fixed radius gets clipped away — see flowers). */
    setScale(s) {
      span = s;
      const r = Math.max(s * 40, 4);
      dome.scale.setScalar(r);
      apply();
      return r;
    },
    dispose() { pmrem.dispose(); envRT.dispose(); },
  };
}
