// =========================
//  Three.js 基本場景
// =========================
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 0, 5);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// =========================
//  粒子初始化
// =========================
const count = 5000;
const positions = new Float32Array(count * 3);
const colors = new Float32Array(count * 3);
const targetPositions = new Float32Array(count * 3);

for (let i = 0; i < count; i++) {
  const i3 = i * 3;
  positions[i3 + 0] = (Math.random() - 0.5) * 4;
  positions[i3 + 1] = (Math.random() - 0.5) * 4;
  positions[i3 + 2] = (Math.random() - 0.5) * 4;

  colors[i3 + 0] = Math.random();
  colors[i3 + 1] = Math.random();
  colors[i3 + 2] = Math.random();
}

const geometry = new THREE.BufferGeometry();
geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

const material = new THREE.PointsMaterial({
  size: 0.05,
  vertexColors: true,
  transparent: true,
  depthWrite: false,
});

const particles = new THREE.Points(geometry, material);
scene.add(particles);

// =========================
//  粒子形狀模板
// =========================
function shapeSphere(i, count) {
  const u = i / count;
  const theta = Math.acos(2 * u - 1);
  const phi = Math.random() * Math.PI * 2;
  const r = 1.0;
  return new THREE.Vector3(
    r * Math.sin(theta) * Math.cos(phi),
    r * Math.cos(theta),
    r * Math.sin(theta) * Math.sin(phi)
  );
}

function shapeHeart(i, count) {
  const t = (i / count) * Math.PI * 2;
  const r = 0.5;
  const x = r * 16 * Math.pow(Math.sin(t), 3);
  const y =
    r *
    (13 * Math.cos(t) -
      5 * Math.cos(2 * t) -
      2 * Math.cos(3 * t) -
      Math.cos(4 * t));
  const z = (Math.random() - 0.5) * 0.2;
  return new THREE.Vector3(x * 0.05, y * 0.05, z);
}

function shapeFlower(i, count) {
  const petals = 5;
  const t = (i / count) * Math.PI * 2;
  const r = 0.8 + 0.2 * Math.sin(petals * t);
  return new THREE.Vector3(
    r * Math.cos(t),
    r * Math.sin(t),
    (Math.random() - 0.5) * 0.3
  );
}

function shapeSaturn(i, count) {
  if (i < count * 0.7) return shapeSphere(i, count * 0.7);
  const t = Math.random() * Math.PI * 2;
  return new THREE.Vector3(
    1.5 * Math.cos(t),
    (Math.random() - 0.5) * 0.1,
    1.5 * Math.sin(t)
  );
}

function shapeFireworks(i, count) {
  const t = Math.random() * Math.PI * 2;
  const u = Math.random() * 2 - 1;
  const theta = Math.acos(u);
  const r = 0.2 + Math.random() * 2.0;
  return new THREE.Vector3(
    r * Math.sin(theta) * Math.cos(t),
    r * Math.cos(theta),
    r * Math.sin(theta) * Math.sin(t)
  );
}

function updateShapeTargets(type) {
  for (let i = 0; i < count; i++) {
    let p;
    switch (type) {
      case 0: p = shapeSphere(i, count); break;
      case 1: p = shapeHeart(i, count); break;
      case 2: p = shapeFlower(i, count); break;
      case 3: p = shapeSaturn(i, count); break;
      case 4: p = shapeFireworks(i, count); break;
    }
    const i3 = i * 3;
    targetPositions[i3 + 0] = p.x;
    targetPositions[i3 + 1] = p.y;
    targetPositions[i3 + 2] = p.z;
  }
}

// =========================
//  手勢控制參數
// =========================
const controls = {
  spread: 1.0,
  colorMode: 0,
  shapeType: 0,
};

function distance2D(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function updateControlsFromHand(landmarks) {
  if (!landmarks) return;

  const wrist = landmarks[0];
  const indexTip = landmarks[8];
  const thumbTip = landmarks[4];
  const pinky = landmarks[17];

  const palmWidth = distance2D(landmarks[1], landmarks[17]);
  controls.spread = THREE.MathUtils.clamp(palmWidth * 5, 0.3, 3.0);

  const pinch = distance2D(thumbTip, indexTip);
  if (pinch < 0.05) controls.colorMode = 0;
  else if (pinch < 0.1) controls.colorMode = 1;
  else controls.colorMode = 2;

  const cx = (wrist.x + indexTip.x + pinky.x) / 3;
  if (cx < 0.33) controls.shapeType = 0;
  else if (cx < 0.5) controls.shapeType = 1;
  else if (cx < 0.66) controls.shapeType = 2;
  else if (cx < 0.8) controls.shapeType = 3;
  else controls.shapeType = 4;
}

// =========================
//  MediaPipe Hands
// =========================
const video = document.getElementById("video");
let latestHand = null;

navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
  video.srcObject = stream;
});

const hands = new Hands({
  locateFile: (file) =>
    `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
});

hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.7,
});

hands.onResults((results) => {
  latestHand =
    results.multiHandLandmarks && results.multiHandLandmarks.length > 0
      ? results.multiHandLandmarks[0]
      : null;
});

const cameraMP = new Camera(video, {
  onFrame: async () => {
    await hands.send({ image: video });
  },
  width: 640,
  height: 480,
});
cameraMP.start();

// =========================
//  動畫 Loop
// =========================
const clock = new THREE.Clock();
let lastShape = -1;

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();

  updateControlsFromHand(latestHand);

  if (controls.shapeType !== lastShape) {
    updateShapeTargets(controls.shapeType);
    lastShape = controls.shapeType;
  }

  const pos = geometry.getAttribute("position").array;
  const col = geometry.getAttribute("color").array;

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;

    const tx = targetPositions[i3 + 0] * controls.spread;
    const ty = targetPositions[i3 + 1] * controls.spread;
    const tz = targetPositions[i3 + 2] * controls.spread;

    pos[i3 + 0] += (tx - pos[i3 + 0]) * 0.1;
    pos[i3 + 1] += (ty - pos[i3 + 1]) * 0.1;
    pos[i3 + 2] += (tz - pos[i3 + 2]) * 0.1;

    let r, g, b;
    if (controls.colorMode === 0) {
      r = 0.2; g = 0.7; b = 1.0;
    } else if (controls.colorMode === 1) {
      r = 1.0; g = 0.6; b = 0.2;
    } else {
      const h = (i / count + clock.elapsedTime * 0.1) % 1;
      const c = new THREE.Color().setHSL(h, 0.7, 0.5);
      r = c.r; g = c.g; b = c.b;
    }

    col[i3 + 0] += (r - col[i3 + 0]) * 0.2;
    col[i3 + 1] += (g - col[i3 + 1]) * 0.2;
    col[i3 + 2] += (b - col[i3 + 2]) * 0.2;
  }

  geometry.getAttribute("position").needsUpdate = true;
  geometry.getAttribute("color").needsUpdate = true;

  particles.rotation.y += dt * 0.2;

  renderer.render(scene, camera);
}

animate();
