
// =====================================================
// 基本設定
// =====================================================
const SIZE = 256;                 // 256×256 = 65536 粒子
const NUM = SIZE * SIZE;

let renderer, scene, camera;
let simScene, simCamera;
let posRT_A, posRT_B;
let velRT_A, velRT_B;

initThree();
initGPGPU();
initParticles();
initHandTracking();
animate();

// =====================================================
// Three.js 場景
// =====================================================
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

// =====================================================
// 建立 RenderTarget
// =====================================================
function createRT() {
  return new THREE.WebGLRenderTarget(SIZE, SIZE, {
    type: THREE.FloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
  });
}

// =====================================================
// 初始化 GPGPU
// =====================================================
function initGPGPU() {
  posRT_A = createRT();
  posRT_B = createRT();
  velRT_A = createRT();
  velRT_B = createRT();

  // 初始化位置貼圖
  const initPos = new Float32Array(NUM * 4);
  for (let i = 0; i < NUM; i++) {
    const i4 = i * 4;
    initPos[i4 + 0] = (Math.random() - 0.5) * 2;
    initPos[i4 + 1] = (Math.random() - 0.5) * 2;
    initPos[i4 + 2] = (Math.random() - 0.5) * 2;
    initPos[i4 + 3] = 1.0;
  }
  const texPos = new THREE.DataTexture(initPos, SIZE, SIZE, THREE.RGBAFormat, THREE.FloatType);
  texPos.needsUpdate = true;

  renderer.setRenderTarget(posRT_A);
  renderer.copyTextureToTexture(new THREE.Vector2(0, 0), texPos, posRT_A.texture);

  // 初始化速度貼圖
  const initVel = new Float32Array(NUM * 4);
  const texVel = new THREE.DataTexture(initVel, SIZE, SIZE, THREE.RGBAFormat, THREE.FloatType);
  texVel.needsUpdate = true;

  renderer.setRenderTarget(velRT_A);
  renderer.copyTextureToTexture(new THREE.Vector2(0, 0), texVel, velRT_A.texture);
  renderer.setRenderTarget(null);

  // 模擬場景
  simScene = new THREE.Scene();
  simCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const simPlane = new THREE.PlaneGeometry(2, 2);
  simMaterial = new THREE.ShaderMaterial({
    uniforms: {
      u_posTex: { value: posRT_A.texture },
      u_velTex: { value: velRT_A.texture },
      u_time: { value: 0 },
      u_dt: { value: 0.016 },
      u_shape: { value: 0 },
      u_spread: { value: 1.0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      varying vec2 vUv;

      uniform sampler2D u_posTex;
      uniform sampler2D u_velTex;
      uniform float u_time;
      uniform float u_dt;
      uniform float u_spread;
      uniform int u_shape;

      // -------------------------
      // 形狀模板（GPU 版）
      // -------------------------
      vec3 shapeSphere(vec2 uv) {
        float x = uv.x * 2.0 - 1.0;
        float y = uv.y * 2.0 - 1.0;
        float z = sqrt(max(0.0, 1.0 - x*x - y*y));
        return vec3(x, y, z);
      }

      vec3 shapeHeart(vec2 uv) {
        float t = uv.x * 6.283;
        float r = 0.3;
        float x = r * 16.0 * pow(sin(t), 3.0);
        float y = r * (13.0*cos(t) - 5.0*cos(2.0*t) - 2.0*cos(3.0*t) - cos(4.0*t));
        return vec3(x*0.05, y*0.05, 0.0);
      }

      vec3 shapeFlower(vec2 uv) {
        float t = uv.x * 6.283;
        float r = 0.8 + 0.2 * sin(5.0 * t);
        return vec3(r*cos(t), r*sin(t), 0.0);
      }

      vec3 shapeStar(vec2 uv) {
        float t = uv.x * 6.283;
        float r = (mod(floor(uv.y * 10.0), 2.0) == 0.0) ? 1.0 : 0.4;
        return vec3(r*cos(t), r*sin(t), 0.0);
      }

      vec3 shapeSaturn(vec2 uv) {
        float t = uv.x * 6.283;
        if (uv.y < 0.7) {
          return vec3(0.6*cos(t), 0.6*sin(t), 0.0);
        } else {
          return vec3(1.2*cos(t), 0.0, 1.2*sin(t));
        }
      }

      vec3 getShape(vec2 uv) {
        if (u_shape == 0) return shapeSphere(uv);
        if (u_shape == 1) return shapeHeart(uv);
        if (u_shape == 2) return shapeFlower(uv);
        if (u_shape == 3) return shapeSaturn(uv);
        if (u_shape == 4) return shapeStar(uv);
        return shapeSphere(uv);
      }

      void main() {
        vec4 pos = texture2D(u_posTex, vUv);
        vec4 vel = texture2D(u_velTex, vUv);

        vec3 target = getShape(vUv) * u_spread;
        vec3 dir = target - pos.xyz;

        vel.xyz += dir * 0.5 * u_dt;
        vel.xyz *= 0.98;

        pos.xyz += vel.xyz * u_dt;

        gl_FragColor = pos;
      }
    `,
  });

  simScene.add(new THREE.Mesh(simPlane, simMaterial));
}

// =====================================================
// 粒子渲染
// =====================================================
let particles, renderMaterial;

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
      u_posTex: { value: posRT_A.texture },
      u_time: { value: 0 },
      u_colorMode: { value: 0 },
    },
    vertexShader: `
      precision highp float;
      uniform sampler2D u_posTex;
      uniform float u_time;
      varying vec3 vColor;

      void main() {
        vec2 uv = uv;
        vec3 pos = texture2D(u_posTex, uv).xyz;

        float h = fract(uv.x + u_time * 0.1);
        vColor = vec3(h, 1.0 - h, 0.8);

        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = 2.0 * (300.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      precision highp float;
      varying vec3 vColor;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        gl_FragColor = vec4(vColor, 1.0);
      }
    `,
    transparent: true,
    depthWrite: false,
  });

  particles = new THREE.Points(geo, renderMaterial);
  scene.add(particles);
}

// =====================================================
// 手勢控制
// =====================================================
const controls = {
  spread: 1.0,
  shape: 0,
  colorMode: 0,
};

let latestHand = null;

function initHandTracking() {
  const video = document.getElementById("video");

  navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
    video.srcObject = stream;
  });

  const hands = new Hands({
    locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`,
  });

  hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.7,
  });

  hands.onResults((res) => {
    latestHand = res.multiHandLandmarks?.[0] || null;
  });

  const cam = new Camera(video, {
    onFrame: async () => hands.send({ image: video }),
    width: 640,
    height: 480,
  });
  cam.start();
}

function updateHandControls() {
  if (!latestHand) return;

  const wrist = latestHand[0];
  const index = latestHand[8];
  const thumb = latestHand[4];
  const pinky = latestHand[17];

  // spread
  const palm = Math.hypot(
    latestHand[1].x - latestHand[17].x,
    latestHand[1].y - latestHand[17].y
  );
  controls.spread = THREE.MathUtils.clamp(palm * 5, 0.3, 3.0);

  // color
  const pinch = Math.hypot(index.x - thumb.x, index.y - thumb.y);
  controls.colorMode = pinch < 0.05 ? 0 : pinch < 0.1 ? 1 : 2;

  // shape
  const cx = (wrist.x + index.x + pinky.x) / 3;
  if (cx < 0.2) controls.shape = 0;      // 球
  else if (cx < 0.4) controls.shape = 1; // 心
  else if (cx < 0.6) controls.shape = 2; // 花
  else if (cx < 0.8) controls.shape = 3; // 土星
  else controls.shape = 4;               // 星星
}

// =====================================================
// 動畫
// =====================================================
const clock = new THREE.Clock();

function simulate(dt) {
  simMaterial.uniforms.u_dt.value = dt;
  simMaterial.uniforms.u_time.value += dt;
  simMaterial.uniforms.u_spread.value = controls.spread;
  simMaterial.uniforms.u_shape.value = controls.shape;

  simMaterial.uniforms.u_posTex.value = posRT_A.texture;
  simMaterial.uniforms.u_velTex.value = velRT_A.texture;

  renderer.setRenderTarget(posRT_B);
  renderer.render(simScene, simCamera);
  renderer.setRenderTarget(null);

  let tmp = posRT_A;
  posRT_A = posRT_B;
  posRT_B = tmp;

  renderMaterial.uniforms.u_posTex.value = posRT_A.texture;
}

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();

  updateHandControls();
  simulate(dt);

  renderMaterial.uniforms.u_time.value += dt;
  renderMaterial.uniforms.u_colorMode.value = controls.colorMode;

  renderer.render(scene, camera);
}
