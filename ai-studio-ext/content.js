console.log("🚀 SCAD Preview Extension loaded!");

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
  });
});

observer.observe(document.body, { childList: true, subtree: true });

function openPreviewPanel(scadCode) {
  let existingContainer = document.getElementById("scad-preview-iframe");

  // Reuse existing iframe
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

  // Wait for iframe to load, then pass SCAD code
  iframe.onload = () => {
    iframe.contentWindow.postMessage(
      { type: "RENDER_SCAD", code: scadCode },
      "*",
    );
  };
}
