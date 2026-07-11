import * as THREE from 'three';

/**
 * Lens flare.
 *
 * Shamelessly not physical — it's a camera artefact, and there is no camera. That's
 * the point: it reads as "photograph of a sunlit meadow" rather than "render", and
 * it costs one fullscreen pass.
 *
 * Drawn as a screen-space overlay in its own orthographic pass after the scene, so
 * it composites over everything without touching the main render. The ghosts march
 * along the line from the sun through the screen centre and out the other side,
 * which is what a real multi-element lens does (each ghost is an internal
 * reflection between two elements, mirrored through the optical axis).
 *
 * It fades out when the sun is off screen, behind the camera, or occluded by a
 * flower — otherwise a bloom passing in front of the sun leaves the flare hanging
 * in mid-air, which instantly breaks the illusion.
 */
export function buildLensFlare(renderer) {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const uniforms = {
    uSunScreen: { value: new THREE.Vector2(0.5, 0.5) }, // sun position in [0,1] screen space
    uIntensity: { value: 0.0 },                          // 0 when the sun is hidden
    uAspect: { value: 1.0 },
    uColor: { value: new THREE.Color(0xfff0cc) },
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */`
      varying vec2 vUv;
      uniform vec2 uSunScreen;
      uniform float uIntensity;
      uniform float uAspect;
      uniform vec3 uColor;

      // A soft round blob.
      float blob(vec2 p, vec2 c, float r){
        float d = length((p - c) * vec2(uAspect, 1.0));
        return smoothstep(r, 0.0, d);
      }
      // A hexagonal iris ghost — the aperture blades, which is why real ghosts are
      // polygons rather than discs.
      float hexGhost(vec2 p, vec2 c, float r){
        vec2 q = (p - c) * vec2(uAspect, 1.0);
        float a = atan(q.y, q.x);
        float d = length(q);
        float hex = r * (0.92 + 0.08 * cos(6.0 * a));
        return smoothstep(hex, hex * 0.55, d) * 0.55;
      }

      void main(){
        if (uIntensity <= 0.001) discard;
        vec2 p = vUv;
        vec2 s = uSunScreen;
        vec3 col = vec3(0.0);

        // The glare around the sun itself, plus a long anamorphic streak.
        col += uColor * blob(p, s, 0.16) * 0.55;
        float streak = smoothstep(0.05, 0.0, abs(p.y - s.y)) *
                       smoothstep(0.55, 0.0, abs(p.x - s.x) * uAspect);
        col += uColor * streak * 0.28;

        // Ghosts, marching through the screen centre and out the far side.
        vec2 dir = vec2(0.5) - s;
        col += vec3(0.9, 0.75, 0.45) * hexGhost(p, s + dir * 0.65, 0.055);
        col += vec3(0.45, 0.85, 0.65) * hexGhost(p, s + dir * 1.15, 0.085);
        col += vec3(0.55, 0.5, 0.95) * hexGhost(p, s + dir * 1.55, 0.045);
        col += vec3(0.95, 0.5, 0.55) * hexGhost(p, s + dir * 1.95, 0.11) * 0.6;
        col += vec3(0.8, 0.85, 0.4) * blob(p, s + dir * 2.35, 0.03) * 0.5;

        gl_FragColor = vec4(col * uIntensity, 1.0);
      }`,
  });

  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false;
  scene.add(quad);

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector3();
  const sunWorld = new THREE.Vector3();
  let intensity = 0;

  return {
    /**
     * @param sunDir  unit vector toward the sun
     * @param occluders  meshes that should block the flare (the flowers)
     */
    render(mainCamera, sunDir, occluders, dt) {
      // Put a proxy for the sun along its direction and project it to screen space.
      //
      // The distance must be INSIDE the far plane. It used to be a hard-coded 300,
      // while camera.far is sized to the subject (a flower is a few tens of units at
      // most) — so the proxy always landed beyond the far plane, ndc.z came back > 1,
      // the on-screen test failed, and the flare never rendered once. It was dead
      // code that looked fine. Anchoring it to the camera's own far plane makes it
      // scale-independent.
      const reach = mainCamera.far * 0.5;
      sunWorld.copy(sunDir).multiplyScalar(reach).add(mainCamera.position);
      ndc.copy(sunWorld).project(mainCamera);

      const onScreen = ndc.z < 1 && Math.abs(ndc.x) < 1.35 && Math.abs(ndc.y) < 1.35;
      let target = 0;
      if (onScreen) {
        // Fade toward the edges of the frame rather than popping off.
        const edge = Math.max(Math.abs(ndc.x), Math.abs(ndc.y));
        target = THREE.MathUtils.clamp(1.35 - edge, 0, 1);

        // Occlusion: if a flower is between the camera and the sun, kill the flare.
        // A real lens flare is formed inside the lens, so it vanishes the instant
        // the source is covered — leaving it visible through a bloom looks broken.
        if (target > 0 && occluders && occluders.length) {
          raycaster.set(mainCamera.position, sunDir);
          raycaster.far = reach;   // scale-relative, for the same reason as above
          if (raycaster.intersectObjects(occluders, true).length > 0) target = 0;
        }
      }

      // Ease, so the flare swells and dies rather than blinking.
      const k = 1 - Math.exp(-dt * 9);
      intensity += (target - intensity) * k;

      uniforms.uSunScreen.value.set((ndc.x + 1) / 2, (ndc.y + 1) / 2);
      uniforms.uIntensity.value = intensity;
      const size = renderer.getSize(new THREE.Vector2());
      uniforms.uAspect.value = size.x / Math.max(size.y, 1);

      if (intensity > 0.002) {
        const prevAutoClear = renderer.autoClear;
        renderer.autoClear = false;
        renderer.render(scene, camera);
        renderer.autoClear = prevAutoClear;
      }
    },
    set enabled(v) { if (!v) intensity = 0; },
  };
}
