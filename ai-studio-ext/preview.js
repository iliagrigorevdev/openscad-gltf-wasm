import { convertScadToGltf } from "openscad-gltf-wasm/convert";
import wasmUrl from "openscad-gltf-wasm/openscad.wasm?url";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

const viewerEl = document.getElementById("viewer");
const statusEl = document.getElementById("status");

let currentMesh = null;
let isCompiling = false;
let pendingCode = null;
let mixer = null;

// --- Setup Three.js Scene ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x222222);

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  2000,
);
camera.position.set(50, 50, 50);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Add Tone Mapping for realistic lighting display
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

viewerEl.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.1;

// --- Add Room Environment for IBL (Image-Based Lighting) ---
const pmremGenerator = new THREE.PMREMGenerator(renderer);
scene.environment = pmremGenerator.fromScene(
  new RoomEnvironment(),
  0.04,
).texture;
scene.environmentIntensity = 0.8; // Dim the environment reflections/lighting

// Environment Helpers
const floorGeo = new THREE.PlaneGeometry(2000, 2000);
const floorMat = new THREE.MeshStandardMaterial({
  color: 0x333333,
  roughness: 0.8,
  metalness: 0.1,
});
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// Standard Lights Setup
// NOTE: AmbientLight was removed because RoomEnvironment provides global ambient lighting.

// Kept purely for casting distinct shadows
const dirLight = new THREE.DirectionalLight(0xffffff, 0.6); // Reduced intensity
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.bias = -0.0005;
scene.add(dirLight);
scene.add(dirLight.target);

let lastTime = performance.now();
function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  const delta = (now - lastTime) / 1000.0;
  lastTime = now;

  if (mixer) mixer.update(delta);
  controls.update();

  renderer.render(scene, camera);
}
animate();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- GLTF Parsing & Rendering Logic ---
function renderGLTF(outputArray) {
  return new Promise((resolve, reject) => {
    if (currentMesh) {
      if (mixer) {
        mixer.stopAllAction();
        mixer.uncacheRoot(mixer.getRoot());
        mixer = null;
      }
      scene.remove(currentMesh);
      currentMesh.traverse((child) => {
        if (child.isMesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
      currentMesh = null;
    }

    const arrayBuffer = outputArray.buffer.slice(
      outputArray.byteOffset,
      outputArray.byteOffset + outputArray.byteLength,
    );

    const loader = new GLTFLoader();
    loader.parse(
      arrayBuffer,
      "",
      (gltf) => {
        currentMesh = gltf.scene;

        if (gltf.animations && gltf.animations.length > 0) {
          mixer = new THREE.AnimationMixer(currentMesh);
          gltf.animations.forEach((clip) => {
            mixer.clipAction(clip).play();
          });
        }

        currentMesh.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        scene.add(currentMesh);
        fitCamera();
        resolve();
      },
      (error) => {
        console.error(error);
        reject(error);
      },
    );
  });
}

function fitCamera() {
  if (!currentMesh) return;
  const worldBox = new THREE.Box3().setFromObject(currentMesh);
  if (worldBox.isEmpty()) return;

  const center = worldBox.getCenter(new THREE.Vector3());
  const size = worldBox.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 10;

  floor.position.y = worldBox.min.y - 0.01;

  const fov = camera.fov * (Math.PI / 180);
  let distance = maxDim / (2 * Math.tan(fov / 2));
  if (camera.aspect < 1) distance /= camera.aspect;

  distance *= 1.5;

  camera.position.set(
    center.x + distance * 0.8,
    center.y + distance * 0.8,
    center.z + distance * 0.8,
  );
  camera.lookAt(center);
  controls.target.copy(center);
  controls.update();

  dirLight.position.set(
    center.x + maxDim,
    center.y + maxDim * 1.5,
    center.z + maxDim,
  );
  dirLight.target.position.copy(center);
  dirLight.target.updateMatrixWorld();

  const shadowCamSize = maxDim * 1.5;
  dirLight.shadow.camera.left = -shadowCamSize;
  dirLight.shadow.camera.right = shadowCamSize;
  dirLight.shadow.camera.top = shadowCamSize;
  dirLight.shadow.camera.bottom = -shadowCamSize;
  dirLight.shadow.camera.near = 0.1;
  dirLight.shadow.camera.far = maxDim * 5;
  dirLight.shadow.camera.updateProjectionMatrix();
}

async function compileAndRender(scadCode) {
  if (isCompiling) {
    pendingCode = scadCode;
    return;
  }
  isCompiling = true;
  statusEl.innerText = "Compiling WASM...";

  try {
    const gltfData = await convertScadToGltf(scadCode, { wasmUrl });

    statusEl.innerText = "Loading Scene...";
    await renderGLTF(gltfData);

    statusEl.innerText = "";
  } catch (e) {
    console.error(e);
    statusEl.innerText = "Compilation Error";
  } finally {
    isCompiling = false;
    if (pendingCode !== null) {
      const codeToCompile = pendingCode;
      pendingCode = null;
      compileAndRender(codeToCompile);
    }
  }
}

// --- Listen for Messages ---
window.addEventListener("message", async (event) => {
  if (event.data.type === "RENDER_SCAD") {
    await compileAndRender(event.data.code);
  }
});
