const SIZE = 256;
const NUM = SIZE * SIZE;

let renderer, scene, camera;
let posRT;
let particles, renderMaterial;
const clock = new THREE.Clock();

initThree();
initTexture();
initParticles();
animate();

function initThree() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 1000);
  camera.position.set(0, 0, 5);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  document.body.appendChild(renderer.domElement);

  window.addEventListener("resize", () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
}

function initTexture() {
  posRT = new THREE.WebGLRenderTarget(SIZE, SIZE, {
    type: THREE.FloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
  });

  const data = new Float32Array(NUM * 4);
  for (let i = 0; i < NUM; i++) {
    const i4 = i * 4;
    data[i4 + 0] = (Math.random() - 0.5) * 2;
    data[i4 + 1] = (Math.random() - 0.5) * 2;
    data[i4 + 2] = (Math.random() - 0.5) * 2;
    data[i4 + 3] = 1.0;
  }

  const tex = new THREE.DataTexture(data, SIZE, SIZE, THREE.RGBAFormat, THREE.FloatType);
  tex.needsUpdate = true;

  renderer.setRenderTarget(posRT);
  renderer.copyTextureToTexture(new THREE.Vector2(0, 0), tex, posRT.texture);
  renderer.setRenderTarget(null);
}

function initParticles() {
  const geo = new THREE.BufferGeometry();
  const uv = new Float32Array(NUM * 2);
  const pos = new Float32Array(NUM * 3);

  let i = 0;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      uv[i * 2 + 0] = (x + 0.5) / SIZE;
      uv[i * 2 + 1] = (y + 0.5) / SIZE;
      i++;
    }
  }

  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));

  renderMaterial = new THREE.ShaderMaterial({
    uniforms: {
      u_posTex: { value: posRT.texture },
      u_time: { value: 0 },
    },
    vertexShader: `
      precision highp float;
      uniform sampler2D u_posTex;
      uniform float u_time;
      varying vec3 vColor;

      void main() {
        vec2 coord = uv;
        vec3 pos = texture2D(u_posTex, coord).xyz;

        vColor = vec3(0.5 + 0.5 * sin(u_time + coord.x * 10.0), 0.5, 0.8);

        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = 1.5 * (300.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      precision highp float;
      varying vec3 vColor;
      void main() {
        gl_FragColor = vec4(vColor, 1.0);
      }
    `,
    transparent: true,
    depthWrite: false,
  });

  particles = new THREE.Points(geo, renderMaterial);
  scene.add(particles);
}

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  renderMaterial.uniforms.u_time.value += dt;
  renderer.render(scene, camera);
}
