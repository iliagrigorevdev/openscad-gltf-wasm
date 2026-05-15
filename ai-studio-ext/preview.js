import { convertScadToGltf } from "openscad-gltf-wasm/convert";
import wasmUrl from "openscad-gltf-wasm/openscad.wasm?url";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { WebGLPathTracer } from "three-gpu-pathtracer";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";

const viewerEl = document.getElementById("viewer");
const statusEl = document.getElementById("status");
const historyPanel = document.getElementById("history-panel");
const historyToggle = document.getElementById("history-toggle");
const editorPanel = document.getElementById("editor-panel");
const editorToggle = document.getElementById("editor-toggle");
const expandToggle = document.getElementById("expand-toggle");
const historyList = document.getElementById("history-list");
const editorEl = document.getElementById("editor");
const exportGltfBtn = document.getElementById("export-gltf-btn");
const downloadScadBtn = document.getElementById("download-scad-btn");
const autoSmoothCb = document.getElementById("auto-smooth-cb");
const pathTracingCb = document.getElementById("path-tracing-cb");

let currentMesh = null;
let currentGltfData = null;
let isCompiling = false;
let pendingCode = null;
let mixer = null; // Animation mixer for skeletal animation

// --- UI Logic ---
function updateExpandToggle() {
  if (
    historyPanel.classList.contains("collapsed") ||
    editorPanel.classList.contains("collapsed")
  ) {
    expandToggle.style.display = "block";
  } else {
    expandToggle.style.display = "none";
  }
}

historyToggle.onclick = () => {
  historyPanel.classList.add("collapsed");
  updateExpandToggle();
  setTimeout(onResize, 300);
};

editorToggle.onclick = () => {
  editorPanel.classList.add("collapsed");
  updateExpandToggle();
  setTimeout(onResize, 300);
};

expandToggle.onclick = () => {
  historyPanel.classList.remove("collapsed");
  editorPanel.classList.remove("collapsed");
  updateExpandToggle();
  setTimeout(onResize, 300);
};

// --- Load Persisted Checkbox States ---
const savedPathTracing = localStorage.getItem("scad_preview_path_tracing");
if (savedPathTracing !== null) {
  pathTracingCb.checked = savedPathTracing === "true";
}

const savedAutoSmooth = localStorage.getItem("scad_preview_auto_smooth");
if (savedAutoSmooth !== null) {
  autoSmoothCb.checked = savedAutoSmooth === "true";
}

pathTracingCb.addEventListener("change", () => {
  localStorage.setItem("scad_preview_path_tracing", pathTracingCb.checked);
  if (pathTracingCb.checked) {
    pathTracer.updateCamera();
  }
});

autoSmoothCb.addEventListener("change", () => {
  localStorage.setItem("scad_preview_auto_smooth", autoSmoothCb.checked);
  if (currentGltfData) {
    statusEl.innerText = "Building BVH & Scene...";
    // setTimeout defers the thread block allowing the UI to repaint the status first
    setTimeout(async () => {
      try {
        await renderGLTF(currentGltfData);
        statusEl.innerText = "Rendering";
      } catch (e) {
        statusEl.innerText = "Error Rendering";
      }
    }, 10);
  }
});

downloadScadBtn.onclick = () => {
  const code = editorEl.value;
  if (!code) {
    alert("No SCAD code to download!");
    return;
  }

  const blob = new Blob([code], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.style.display = "none";
  link.href = url;
  link.download = "model.scad";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

exportGltfBtn.onclick = () => {
  if (!currentGltfData) {
    alert("No model to export!");
    return;
  }

  const blob = new Blob([currentGltfData], {
    type: "application/octet-stream",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.style.display = "none";
  link.href = url;
  link.download = "model.glb";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

function renderHistory(scads) {
  historyList.innerHTML = "";
  if (!scads || scads.length === 0) {
    historyList.innerHTML =
      '<div style="padding:10px; color:#aaa; font-size:12px;">No SCADs saved.</div>';
    return;
  }

  scads.sort((a, b) => b.timestamp - a.timestamp); // newest first
  scads.forEach((item) => {
    const div = document.createElement("div");
    div.className = "history-item";
    const snippet =
      item.code.substring(0, 60).replace(/\s+/g, " ") +
      (item.code.length > 60 ? "..." : "");
    const timeStr = new Date(item.timestamp).toLocaleString();

    div.innerHTML = `
      <div class="history-time">${timeStr}</div>
      <div class="history-snippet">${snippet}</div>
    `;
    div.onclick = () => {
      editorEl.value = item.code;
      compileAndRender(item.code);
    };
    historyList.appendChild(div);
  });
}

// Editor Auto-Render Debounce
let renderTimeout;
editorEl.addEventListener("input", (e) => {
  clearTimeout(renderTimeout);
  statusEl.innerText = "Waiting to compile...";
  renderTimeout = setTimeout(() => {
    compileAndRender(e.target.value);
  }, 800);
});

// --- Setup Three.js Scene & Path Tracer ---
const scene = new THREE.Scene();

const initialWidth = viewerEl.clientWidth || window.innerWidth;
const initialHeight = viewerEl.clientHeight || window.innerHeight;

const camera = new THREE.PerspectiveCamera(
  60,
  initialWidth / initialHeight,
  0.1,
  2000,
);
camera.position.set(50, 50, 50);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(initialWidth, initialHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
viewerEl.appendChild(renderer.domElement);

// Initialize Path Tracer
const pathTracer = new WebGLPathTracer(renderer);
pathTracer.bounces = 10; // Allow standard light bouncing
pathTracer.transmissiveBounces = 10; // Allow rays to pass through transparent objects
pathTracer.multipleImportanceSampling = true; // Reduces noise with HDRs

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.1;
controls.maxDistance = 2000;
// Reset path tracer accumulation when interacting
controls.addEventListener("change", () => pathTracer.updateCamera());

// --- Load HDR Environment Mapping ---
const hdrUrl =
  typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id
    ? chrome.runtime.getURL("res/aristea_wreck_puresky_2k.hdr")
    : "res/aristea_wreck_puresky_2k.hdr";

new HDRLoader().load(hdrUrl, (texture) => {
  texture.mapping = THREE.EquirectangularReflectionMapping;
  scene.background = texture;
  scene.environment = texture;

  // Re-initialize path tracer scene with the new environment
  pathTracer.setScene(scene, camera);
  pathTracer.updateCamera();
});

// Environment Helpers
const floorGeo = new THREE.PlaneGeometry(2000, 2000);
const floorMat = new THREE.MeshStandardMaterial({
  color: 0x222222,
  roughness: 0.8,
  metalness: 0.1,
});
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// WebGL Lights Setup
const lightGroup = new THREE.Group();

const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
lightGroup.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.bias = -0.0005;
lightGroup.add(dirLight);
lightGroup.add(dirLight.target);

scene.add(lightGroup);

// Initial empty setup so we render black void instead of breaking
pathTracer.setScene(scene, camera);

let lastTime = performance.now();
function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  const delta = (now - lastTime) / 1000.0;
  lastTime = now;

  if (mixer) mixer.update(delta);
  controls.update();

  if (pathTracingCb.checked) {
    lightGroup.visible = false;
    // Render via Path Tracer instead of standard WebGL renderer
    pathTracer.renderSample();
  } else {
    lightGroup.visible = true;
    renderer.render(scene, camera);
  }
}
animate();

function onResize() {
  const width = viewerEl.clientWidth || window.innerWidth;
  const height = viewerEl.clientHeight || window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  pathTracer.updateCamera();
}
window.addEventListener("resize", onResize);
setTimeout(onResize, 100);

// --- Auto Smooth Logic ---
function computeSmoothNormals(positions, creaseAngle = Math.PI / 4) {
  const hashToVertices = new Map();
  const vertexNormals = new Float32Array(positions.length);

  for (let i = 0; i < positions.length; i += 9) {
    const ax = positions[i],
      ay = positions[i + 1],
      az = positions[i + 2];
    const bx = positions[i + 3],
      by = positions[i + 4],
      bz = positions[i + 5];
    const cx = positions[i + 6],
      cy = positions[i + 7],
      cz = positions[i + 8];

    const cbx = cx - bx,
      cby = cy - by,
      cbz = cz - bz;
    const abx = ax - bx,
      aby = ay - by,
      abz = az - bz;

    const nx = cby * abz - cbz * aby;
    const ny = cbz * abx - cbx * abz;
    const nz = cbx * aby - cby * abx;

    let len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (len === 0) len = 1;
    const normal = { x: nx / len, y: ny / len, z: nz / len };

    for (let j = 0; j < 3; j++) {
      const vIdx = i + j * 3;
      const x = positions[vIdx];
      const y = positions[vIdx + 1];
      const z = positions[vIdx + 2];
      const hash = `${Math.round(x * 1e4)}_${Math.round(y * 1e4)}_${Math.round(z * 1e4)}`;

      let list = hashToVertices.get(hash);
      if (!list) {
        list = [];
        hashToVertices.set(hash, list);
      }
      list.push({ index: vIdx, faceNormal: normal });
    }
  }

  const cosAngle = Math.cos(creaseAngle);

  for (const list of hashToVertices.values()) {
    const adj = Array.from({ length: list.length }, () => []);
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const dot =
          list[i].faceNormal.x * list[j].faceNormal.x +
          list[i].faceNormal.y * list[j].faceNormal.y +
          list[i].faceNormal.z * list[j].faceNormal.z;
        if (dot >= cosAngle - 0.0001) {
          adj[i].push(j);
          adj[j].push(i);
        }
      }
    }

    const visited = new Array(list.length).fill(false);
    for (let i = 0; i < list.length; i++) {
      if (!visited[i]) {
        const component = [];
        const q = [i];
        visited[i] = true;
        while (q.length > 0) {
          const curr = q.shift();
          component.push(curr);
          for (const neighbor of adj[curr]) {
            if (!visited[neighbor]) {
              visited[neighbor] = true;
              q.push(neighbor);
            }
          }
        }

        let nx = 0,
          ny = 0,
          nz = 0;
        for (const idx of component) {
          nx += list[idx].faceNormal.x;
          ny += list[idx].faceNormal.y;
          nz += list[idx].faceNormal.z;
        }
        let len = Math.sqrt(nx * nx + ny * ny + nz * nz);
        if (len === 0) len = 1;

        nx /= len;
        ny /= len;
        nz /= len;

        for (const idx of component) {
          const v = list[idx];
          vertexNormals[v.index] = nx;
          vertexNormals[v.index + 1] = ny;
          vertexNormals[v.index + 2] = nz;
        }
      }
    }
  }

  return vertexNormals;
}

function autoSmoothGeometry(geometry) {
  const nonIndexed = geometry.index
    ? geometry.toNonIndexed()
    : geometry.clone();
  const positions = nonIndexed.attributes.position.array;

  const hasColor = nonIndexed.attributes.color !== undefined;
  const colors = hasColor ? nonIndexed.attributes.color.array : null;

  // Check if we are smoothing a SkinnedMesh! We MUST preserve these buffers or it crashes
  const hasSkinIndex = nonIndexed.attributes.skinIndex !== undefined;
  const skinIndices = hasSkinIndex
    ? nonIndexed.attributes.skinIndex.array
    : null;

  const hasSkinWeight = nonIndexed.attributes.skinWeight !== undefined;
  const skinWeights = hasSkinWeight
    ? nonIndexed.attributes.skinWeight.array
    : null;

  const normals = computeSmoothNormals(positions, Math.PI / 6);

  const weldedPositions = [];
  const weldedColors = [];
  const weldedNormals = [];
  const weldedSkinIndices = [];
  const weldedSkinWeights = [];
  const indices = [];
  const vertexHash = new Map();
  let nextVertexIndex = 0;

  for (let i = 0; i < positions.length / 3; i++) {
    const px = positions[i * 3];
    const py = positions[i * 3 + 1];
    const pz = positions[i * 3 + 2];

    const nx = normals[i * 3];
    const ny = normals[i * 3 + 1];
    const nz = normals[i * 3 + 2];

    let r = 0,
      g = 0,
      b = 0;
    if (hasColor) {
      r = colors[i * 3];
      g = colors[i * 3 + 1];
      b = colors[i * 3 + 2];
    }

    let si0 = 0,
      si1 = 0,
      si2 = 0,
      si3 = 0;
    if (hasSkinIndex) {
      si0 = skinIndices[i * 4];
      si1 = skinIndices[i * 4 + 1];
      si2 = skinIndices[i * 4 + 2];
      si3 = skinIndices[i * 4 + 3];
    }

    let sw0 = 0,
      sw1 = 0,
      sw2 = 0,
      sw3 = 0;
    if (hasSkinWeight) {
      sw0 = skinWeights[i * 4];
      sw1 = skinWeights[i * 4 + 1];
      sw2 = skinWeights[i * 4 + 2];
      sw3 = skinWeights[i * 4 + 3];
    }

    const hx = Math.round(px * 1e4);
    const hy = Math.round(py * 1e4);
    const hz = Math.round(pz * 1e4);
    const hnx = Math.round(nx * 1e4);
    const hny = Math.round(ny * 1e4);
    const hnz = Math.round(nz * 1e4);

    let hash = `${hx}_${hy}_${hz}_${hnx}_${hny}_${hnz}`;
    if (hasColor) {
      const hr = Math.round(r * 1e4);
      const hg = Math.round(g * 1e4);
      const hb = Math.round(b * 1e4);
      hash += `_${hr}_${hg}_${hb}`;
    }
    if (hasSkinIndex) {
      hash += `_${si0}_${si1}_${si2}_${si3}`;
    }
    if (hasSkinWeight) {
      const hw0 = Math.round(sw0 * 1e3);
      const hw1 = Math.round(sw1 * 1e3);
      const hw2 = Math.round(sw2 * 1e3);
      const hw3 = Math.round(sw3 * 1e3);
      hash += `_${hw0}_${hw1}_${hw2}_${hw3}`;
    }

    let idx = vertexHash.get(hash);
    if (idx === undefined) {
      idx = nextVertexIndex++;
      vertexHash.set(hash, idx);
      weldedPositions.push(px, py, pz);
      if (hasColor) weldedColors.push(r, g, b);
      weldedNormals.push(nx, ny, nz);
      if (hasSkinIndex) weldedSkinIndices.push(si0, si1, si2, si3);
      if (hasSkinWeight) weldedSkinWeights.push(sw0, sw1, sw2, sw3);
    }
    indices.push(idx);
  }

  const newGeometry = new THREE.BufferGeometry();
  newGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(weldedPositions, 3),
  );
  if (hasColor) {
    newGeometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(weldedColors, 3),
    );
  }
  newGeometry.setAttribute(
    "normal",
    new THREE.Float32BufferAttribute(weldedNormals, 3),
  );
  if (hasSkinIndex) {
    newGeometry.setAttribute(
      "skinIndex",
      new THREE.Uint16BufferAttribute(weldedSkinIndices, 4),
    );
  }
  if (hasSkinWeight) {
    newGeometry.setAttribute(
      "skinWeight",
      new THREE.Float32BufferAttribute(weldedSkinWeights, 4),
    );
  }

  newGeometry.setIndex(indices);

  if (nonIndexed.groups && nonIndexed.groups.length > 0) {
    for (const g of nonIndexed.groups) {
      newGeometry.addGroup(g.start, g.count, g.materialIndex);
    }
  }

  nonIndexed.dispose();

  return newGeometry;
}

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

    // Safely extract the exact buffer to avoid Emscripten WASM view issues
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
            if (autoSmoothCb.checked && child.geometry) {
              const oldGeom = child.geometry;
              child.geometry = autoSmoothGeometry(oldGeom);
              oldGeom.dispose();

              if (child.material) {
                const makeSmooth = (m) => {
                  m.flatShading = false;
                  m.needsUpdate = true;
                };
                if (Array.isArray(child.material)) {
                  child.material.forEach(makeSmooth);
                } else {
                  makeSmooth(child.material);
                }
              }
            }

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

  // Drop the floor slightly below the object bounds to prevent Z-fighting
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

  // Adjust directional light to cover the object dynamically
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

  // Send the updated geometry scene to the GPU path tracer (generates BVH and resets accumulation)
  lightGroup.visible = !pathTracingCb.checked;
  pathTracer.setScene(scene, camera);
}

async function compileAndRender(scadCode) {
  if (isCompiling) {
    pendingCode = scadCode;
    return;
  }
  isCompiling = true;
  statusEl.innerText = "Compiling WASM...";

  try {
    currentGltfData = await convertScadToGltf(scadCode, { wasmUrl });

    statusEl.innerText = "Building BVH & Scene...";
    await renderGLTF(currentGltfData);

    statusEl.innerText = "Rendering";
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
    if (editorEl.value !== event.data.code) {
      editorEl.value = event.data.code;
    }
    await compileAndRender(event.data.code);
  } else if (
    event.data.type === "INIT_HISTORY" ||
    event.data.type === "HISTORY_UPDATED"
  ) {
    renderHistory(event.data.scads);
  }
});
