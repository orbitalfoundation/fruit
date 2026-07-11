import * as THREE from 'three';

/**
 * A studio, not a habitat. The fish rig next door builds an ocean because a fish
 * without water is a specimen; a fruit is a still life, and the honest setting for
 * one is a table and a soft window.
 *
 * The lighting has one job beyond looking nice: transmission needs something WORTH
 * refracting. A translucent carambola lit by a bare point light is a grey blob —
 * it only reads as juicy when there's a bright soft source behind and above it for
 * the flesh to glow against. So: a large warm key, a cool fill, and a strong rim,
 * plus a PMREM environment so the clearcoat has something to reflect.
 */
export function buildEnvironment(scene, renderer) {
  const bgTop = new THREE.Color(0x2a2320);
  const bgBottom = new THREE.Color(0x0b0908);

  const domeGeo = new THREE.SphereGeometry(1, 32, 24);
  const domeMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { uTop: { value: bgTop }, uBottom: { value: bgBottom } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */`
      varying vec3 vDir;
      uniform vec3 uTop, uBottom;
      void main(){
        float h = normalize(vDir).y;
        vec3 col = mix(uBottom, uTop, smoothstep(-0.55, 0.75, h));
        // A soft pool of light behind the fruit, so translucent flesh has
        // something to glow against.
        float glow = smoothstep(0.55, 1.0, normalize(vDir).z * 0.5 + 0.5);
        col += vec3(0.16, 0.13, 0.10) * glow;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const dome = new THREE.Mesh(domeGeo, domeMat);
  dome.renderOrder = -1;
  dome.frustumCulled = false;
  scene.add(dome);

  // A soft-boxed key (an area light stands in for the window), a cool fill from
  // the opposite side, and a back rim that rakes the spikes.
  const key = new THREE.DirectionalLight(0xfff2e0, 2.6);
  key.position.set(1, 1.6, 1.1);
  const fill = new THREE.DirectionalLight(0xbfd4ff, 0.55);
  fill.position.set(-1.4, 0.2, 0.6);
  const rim = new THREE.DirectionalLight(0xffd9a8, 2.2);
  rim.position.set(-0.5, 0.7, -1.6);
  // Bounce off the "table", which keeps the underside of a spiky fruit legible.
  const bounce = new THREE.DirectionalLight(0xffe8cf, 0.5);
  bounce.position.set(0, -1, 0.3);
  const ambient = new THREE.AmbientLight(0xf0e6dc, 0.35);
  scene.add(key, fill, rim, bounce, ambient);

  // A PMREM of the gradient dome: this is what the clearcoat and the transmission
  // actually sample, and without it both look like flat plastic.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), domeMat.clone()));
  const envRT = pmrem.fromScene(envScene, 0.04);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.85;

  const group = new THREE.Group();
  scene.add(group);

  return {
    /** Rescale the whole rig so a 4 cm lychee and a 90 cm snake gourd are both lit
     *  the same way — everything is authored in fruit-spans. */
    setScale(span) {
      dome.scale.setScalar(Math.max(span * 30, 1));
      for (const l of [key, fill, rim, bounce]) {
        l.position.normalize().multiplyScalar(span * 3);
      }
    },
    dispose() { pmrem.dispose(); envRT.dispose(); },
  };
}

/** The table: a soft shadowed disc so the fruit isn't floating in a void. */
export function buildTable(scene) {
  const geo = new THREE.CircleGeometry(1, 64);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x1a1512, roughness: 0.9, metalness: 0.0,
    transparent: true, opacity: 0.9,
  });
  const disc = new THREE.Mesh(geo, mat);
  disc.rotation.x = -Math.PI / 2;
  scene.add(disc);

  // A cheap contact shadow — a radial-gradient sprite under the fruit reads better
  // than a real shadow map at this scale, and costs nothing.
  const size = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(0.55, 'rgba(0,0,0,0.22)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false,
  });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  scene.add(shadow);

  return {
    setScale(span, bottomY) {
      // Keep the table modest: at 3× the span it stopped reading as a surface the
      // fruit sits on and started reading as a brown wall behind it.
      disc.scale.setScalar(span * 1.4);
      disc.position.y = bottomY - span * 0.002;
      shadow.scale.setScalar(span * 1.3);
      shadow.position.y = bottomY + span * 0.001;
    },
    setVisible(v) { disc.visible = v; shadow.visible = v; },
  };
}
