console.log("🚀 SCAD Preview Extension loaded!");

// --- IndexedDB Setup ---
const DB_NAME = "ScadPreviewDB";
const DB_VERSION = 1;
const STORE_NAME = "scad_snippets";

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "hash" });
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

async function computeHash(str) {
  const msgBuffer = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function saveScad(code) {
  const hash = await computeHash(code);
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(hash);

    getReq.onsuccess = () => {
      if (!getReq.result) {
        // Unique code detected! Save it.
        store.add({ hash, code, timestamp: Date.now() });
        tx.oncomplete = async () => {
          // Send an update ping to the iframe if it is currently open
          const iframeContainer = document.getElementById(
            "scad-preview-iframe",
          );
          if (iframeContainer) {
            const scads = await getScads();
            iframeContainer
              .querySelector("iframe")
              .contentWindow.postMessage(
                { type: "HISTORY_UPDATED", scads },
                "*",
              );
          }
          resolve(true);
        };
      } else {
        resolve(false);
      }
    };
    tx.onerror = () => reject(tx.error);
  });
}

async function getScads() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Watch the DOM for AI-generated code blocks
const observer = new MutationObserver(() => {
  const codeBlocks = document.querySelectorAll(
    'ms-code-block[data-test-language="openscad" i], ms-code-block[data-test-language="scad" i]',
  );

  codeBlocks.forEach((block) => {
    if (block.hasAttribute("data-scad-injected")) return;
    block.setAttribute("data-scad-injected", "true");

    const btn = document.createElement("button");
    btn.innerText = "👀 Preview 3D";
    btn.className = "scad-preview-btn";
    btn.style.margin = "0 0 10px 15px";

    btn.onpointerdown = (e) => e.stopPropagation();

    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();

      const codeElement = block.querySelector("code");
      if (codeElement) {
        openPreviewPanel(codeElement.innerText);
      }
    };

    const preElement = block.querySelector("pre");
    if (preElement) {
      preElement.parentNode.insertBefore(btn, preElement);
    } else {
      block.appendChild(btn);
    }

    // Auto-save logic with debounce to handle streaming AI generation
    let timeout;
    const saveDebounced = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        const codeElement = block.querySelector("code");
        if (codeElement) {
          const text = codeElement.innerText.trim();
          if (text) saveScad(text);
        }
      }, 1500);
    };

    const charObserver = new MutationObserver(saveDebounced);
    charObserver.observe(block, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    saveDebounced();
  });
});

observer.observe(document.body, { childList: true, subtree: true });

function openPreviewPanel(scadCode) {
  let existingContainer = document.getElementById("scad-preview-iframe");

  // Reuse existing iframe without reloading it to keep history UI smooth
  if (existingContainer) {
    existingContainer
      .querySelector("iframe")
      .contentWindow.postMessage({ type: "RENDER_SCAD", code: scadCode }, "*");
    return;
  }

  // Create container for iframe
  const container = document.createElement("div");
  container.id = "scad-preview-iframe";

  // Add close button
  const closeBtn = document.createElement("button");
  closeBtn.innerText = "X";
  closeBtn.className = "scad-close-btn";
  closeBtn.onclick = () => container.remove();

  const iframe = document.createElement("iframe");
  iframe.src = chrome.runtime.getURL("preview.html");

  container.appendChild(closeBtn);
  container.appendChild(iframe);
  document.body.appendChild(container);

  // Wait for iframe to load, then pass SCAD code and initial database history payload
  iframe.onload = async () => {
    iframe.contentWindow.postMessage(
      { type: "RENDER_SCAD", code: scadCode },
      "*",
    );
    const scads = await getScads();
    iframe.contentWindow.postMessage({ type: "INIT_HISTORY", scads }, "*");
  };
}
