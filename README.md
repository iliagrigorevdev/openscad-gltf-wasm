# OpenSCAD GLTF WASM

A powerful WebAssembly (WASM) build of a custom OpenSCAD fork that enables direct compilation of OpenSCAD (`.scad`) scripts to **glTF/GLB** formats natively in JavaScript (Node.js and Browser).

Unlike standard OpenSCAD, this custom engine supports **Physically Based Rendering (PBR)** materials and **Hierarchical Skeletal Animations**, making it a perfect bridge between procedural CAD generation and modern 3D web rendering engines (like Three.js or Babylon.js).

This WASM module was generated from the `gltf` branch of the forked [openscad](https://github.com/iliagrigorevdev/openscad).

**🌐 Live Demo:** Try the online viewer based on this WASM package here: [openscad-gltf-viewer](https://iliagrigorevdev.github.io/openscad-gltf-viewer/)

## Features

- **Direct SCAD to GLB conversion:** Compile geometry directly to web-ready binary glTF.
- **Extended PBR Material Support:** Native extensions to the OpenSCAD `color()` module supporting `metalness`, `roughness`, `transmission` (glass), `clearcoat`, `sheen`, `ior`, `emissive`, `specular`, `iridescence`, and `autoSmoothAngle`.
- **Skeletal Animation:** Define animated armatures and bones directly within your `.scad` files.
- **True Skeletal Skinning:** Exports absolute world transforms and properly bound animation tracks.
- **LLM Friendly:** Includes a built-in prompt generator (`prompt.js` / `scad-prompt` CLI) to help AI models (like Gemini or Claude) write compatible OpenSCAD scripts utilizing the new features.
- **Local API Server:** Bundled `scad-serve` CLI utility to manage local `.scad` files remotely via REST API.
- **CLI Converter:** Bundled `scad-convert` CLI utility for batch compiling `.scad` files with smart dependency hashing.
- **AI Studio Extension:** Includes a Chrome extension to natively preview and locally save AI-generated 3D models directly inside Google AI Studio.

---

## Installation

```bash
npm install github:iliagrigorevdev/openscad-gltf-wasm
```

---

## Usage (JavaScript / Node.js)

The package provides a convenient `convert.js` wrapper to handle the Emscripten WASM lifecycle and virtual file system.

_Note: Because the underlying WASM loader was compiled for the web, it expects the modern `fetch()` API. In Node.js, we must provide the absolute path to the `.wasm` file and briefly polyfill `fetch` so it can read local files from disk._

```javascript
import { convertScadToGltf } from "openscad-gltf-wasm/convert";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// 1. Locate the WASM file inside node_modules
const wasmPath = path.resolve("node_modules/openscad-gltf-wasm/openscad.wasm");

// 2. Mock fetch to allow the WASM loader to read local files in Node.js
global.fetch = async (url) => {
  const normalizedPath = url.toString().startsWith("file://")
    ? fileURLToPath(url.toString())
    : url.toString();

  const buffer = fs.readFileSync(normalizedPath);
  return new Response(buffer, {
    status: 200,
    headers: { "Content-Type": "application/wasm" }
  });
};

const scadCode = `
  color("gold", metalness=1.0, roughness=0.2)
  sphere(r=10);
`;

async function buildModel() {
  try {
    // 3. Compile SCAD to a GLB Uint8Array
    const glbData = await convertScadToGltf(scadCode, {
      wasmUrl: \`file://\${wasmPath}\`
    });

    // Save to disk (or send to a client, load into Three.js, etc.)
    fs.writeFileSync("output.glb", glbData);
    console.log("Successfully compiled to output.glb!");
  } catch (error) {
    console.error("Compilation failed:", error);
  }
}

buildModel();
```

### Using in Web Bundlers (Webpack / Vite)

If you are using this in a browser, you don't need to mock `fetch`. You just need to provide the URL to the `.wasm` file so the bundler and Emscripten loader can fetch it over HTTP:

```javascript
// Import the WASM file URL (syntax depends on your bundler, e.g., Vite uses ?url)
import wasmUrl from "openscad-gltf-wasm/openscad.wasm?url";
import { convertScadToGltf } from "openscad-gltf-wasm/convert";

const scadCode = `cylinder(h=20, r=5);`;

const glbData = await convertScadToGltf(scadCode, { wasmUrl });
```

---

## Command Line Conversion (`scad-convert`)

The package includes a CLI utility to convert `.scad` files to `.glb` directly from your terminal. It supports single files or entire directories, and features a smart caching system to speed up build pipelines.

**Run the converter using one of these options:**

- **Option A: Run directly (No installation)**
  ```bash
  npx -p github:iliagrigorevdev/openscad-gltf-wasm scad-convert <input.scad | input_dir> <output.glb | output_dir> [options_json] [--cache]
  ```
- **Option B: If installed as a dependency**
  ```bash
  npx scad-convert <input.scad | input_dir> <output.glb | output_dir> [options_json] [--cache]
  ```

**Examples:**

- **Single File:**
  ```bash
  npx scad-convert model.scad model.glb
  ```
- **Directory Batch Conversion:**
  ```bash
  npx scad-convert ./src_models ./out_glbs
  ```
- **With Smart Caching (`--cache`):**
  Works similarly to Godot's asset pipeline. It generates a `.import` file containing a hash of the `.scad` content (including any resolved `include` or `use` dependencies) and compiler options. Subsequent runs will skip the conversion if no changes are detected.
  ```bash
  npx scad-convert ./src_models ./out_glbs --cache
  ```
- **With Options:**
  Pass custom compiler options as a JSON string (or Base64 encoded JSON).
  ```bash
  npx scad-convert model.scad model.glb '{"binary": false}'
  ```

---

## Local File Management & Conversion (`scad-serve`)

If you are building a web IDE, a generative UI, or using the **AI Studio Extension**, you can use the `scad-serve` utility. It provides a REST API to manage local files and perform in-memory SCAD-to-GLB conversions.

It strictly operates **only** on the `.scad` files in the directory where the command is run.

**Start the server using one of these options:**

- **Option A: Run directly (No installation)**
  ```bash
  npx -p github:iliagrigorevdev/openscad-gltf-wasm scad-serve
  ```
- **Option B: If installed as a dependency**
  ```bash
  npx scad-serve
  ```

**Optional Arguments:**

- `--port 3000`: Set a custom port (default is 3000).

**Available Endpoints:**

- `GET /api/scads`
  - Lists all `.scad` files in the current working directory.
- `GET /api/scads/:filename`
  - Retrieves the text content of a specific `.scad` file.
- `POST /api/scads`
  - Creates or updates a `.scad` file on disk.
  - **Body Payload:** `{ "filename": "model.scad", "content": "cube(10);" }`
- `DELETE /api/scads/:filename`
  - Deletes a `.scad` file.
- `POST /api/convert`
  - **In-memory conversion:** Compiles raw SCAD string to GLB data without writing to the file system.
  - **Body Payload:** `{ "content": "sphere(r=10);" }`
  - **Response:** Binary GLB data (`model/gltf-binary`).

---

## 🧩 Google AI Studio Extension

This repository includes a Chrome/Chromium extension located in the [`/ai-studio-ext`](./ai-studio-ext) directory that brings native 3D rendering to [Google AI Studio](https://aistudio.google.com/).

When asking an LLM (like Gemini) to generate OpenSCAD code, the extension automatically detects the output and injects a **"Preview 3D"** button directly into the chat interface.

- **Instant Rendering:** Compiles and renders the AI's generated `.scad` code on-the-fly entirely in your browser using this WASM package and Three.js.
- **Seamless Iteration:** No need to copy-paste code to an external viewer; evaluate PBR materials and geometry generated by the AI instantly.
- **Local Saving:** Features a built-in UI that seamlessly communicates with the `scad-serve` local backend to save models directly to your machine.

[View AI Studio Extension Documentation & Setup](./ai-studio-ext/README.md)

---

## 🎮 Godot Engine Integration

This repository includes an official **Godot 4.x Importer Addon** located in the [`/godot`](./godot) directory.

The addon allows you to drag-and-drop `.scad` files directly into your Godot project. It uses this WASM compiler under the hood to transform scripts into 3D scenes automatically.

- **Features:** Supports PBR Materials and Skeletal Animations inside the Godot Editor.
- **License:** The Godot Addon is licensed under **MIT** (see the `/godot` folder for details).
- **Setup:** Simply copy the `addons/scad_importer` folder to your project and enable it in Project Settings.

[View Godot Addon Documentation & Setup](./godot/README.md)

---

## Extended OpenSCAD Syntax

This custom fork introduces new syntax not found in standard OpenSCAD.

### 1. PBR Materials

The standard `color()` module has been extended with standard glTF PBR attributes:

```openscad
color(
    "white",
    roughness = 0.0,           // 0.0 (glossy) to 1.0 (matte)
    metalness = 1.0,           // 1.0 for metals, blocks light transmission
    transmission = 0.9,        // 0.0 to 1.0 for glass/water transparency (requires alpha=1.0)
    thickness = 2.0,           // Volume thickness for refraction
    ior = 1.5,                 // Index of refraction
    attenuationColor = [1.0, 1.0, 1.0], // Color of light passing through volume
    attenuationDistance = 0.0, // Distance light travels before fully tinted
    clearcoat = 1.0,           // Adds a clear reflective top layer (car paint/wet surfaces)
    clearcoatRoughness = 0.1,
    sheen = 1.0,               // Velvet/fabric rim lighting
    sheenColor = [1.0, 0.5, 0.5],
    sheenRoughness = 0.2,
    emissive = [0.0, 0.0, 0.0], // Glowing color
    emissiveIntensity = 1.0,    // Strength of the glow
    specularColor = [1.0, 1.0, 1.0], // Tint for specular highlights
    specularIntensity = 1.0,    // Strength of specular highlights
    iridescence = 0.0,          // Thin-film interference effect (soap bubble)
    iridescenceIOR = 1.3,
    autoSmoothAngle = 30.0      // Generates smooth vertex normals below this angle threshold
) {
    cylinder(h=10, r=5);
}
```

### 2. Skeletal Animations

You can now define hierarchical animated parts. Use the `armature` root module to define keyframes, and the `bone` module to define the physical moving parts.

```openscad
armature(animations = [
  ["Swing", [
    // Format: ["BoneName", [ [time_in_sec, [rot_x, y, z], [trans_x, y, z]], ... ]]
    ["Pendulum", [
      [0.0, [0, 0, 0], [0, 0, 0]],
      [1.0, [0, 45, 0], [0, 0, 0]],
      [2.0, [0, -45, 0], [0, 0, 0]],
      [3.0, [0, 0, 0], [0, 0, 0]]
    ]]
  ]]
]) {
    bone(name="Pendulum", t=[0, 0, 10], r=[0, 0, 0]) {
        color("silver", metalness=0.9, roughness=0.1)
        cylinder(h=10, r=1, center=false);
    }
}
```

---

## AI Integration (`prompt.js` & `scad-prompt`)

Because LLMs (like Gemini or Claude) only know standard OpenSCAD syntax up to their training cutoff, we've included tools to generate LLM prompts. This injects the rules for PBR and animations directly into your prompt context.

### JavaScript Usage

```javascript
import { generatePrompt } from "openscad-gltf-wasm/prompt";

const description =
  "a futuristic glass sword with a glowing metallic handle, animated to spin 360 degrees";
const promptContext = generatePrompt(description);

// You can now pass this context string directly to an AI API
// or print it to the console to paste into Gemini.
console.log(promptContext);
```

### Command Line Usage (`scad-prompt`)

You can generate AI prompts directly from your terminal, which is ideal for bash scripts or piping into AI CLI tools.

**Run the generator using one of these options:**

- **Option A: Run directly (No installation)**
  ```bash
  npx -p github:iliagrigorevdev/openscad-gltf-wasm scad-prompt <description> [options_json]
  ```
- **Option B: If installed as a dependency**
  ```bash
  npx scad-prompt <description> [options_json]
  ```

**Examples:**

- **Basic Prompt Generation:**
  ```bash
  npx scad-prompt "a futuristic glass sword, animated to spin"
  ```
- **With Custom Options:**
  Pass configuration options (to disable certain syntax rules) as a JSON string.
  ```bash
  npx scad-prompt "a simple flat cube" '{"animation": false, "transmission": false}'
  ```

### Available Prompt Options

The `options` object (or parsed CLI `options_json`) configures which feature-specific syntax blocks are included in the generated prompt.

| Option            | Type      | Default | Description                                                                                                             |
| :---------------- | :-------- | :------ | :---------------------------------------------------------------------------------------------------------------------- |
| `basic`           | `boolean` | `true`  | Includes basic PBR material rules (`roughness`, `metalness`).                                                           |
| `transmission`    | `boolean` | `true`  | Includes transparency and volume rules (`transmission`, `thickness`, `ior`, `attenuationColor`, `attenuationDistance`). |
| `clearcoat`       | `boolean` | `true`  | Includes clearcoat rules (`clearcoat`, `clearcoatRoughness`).                                                           |
| `sheen`           | `boolean` | `true`  | Includes fabric sheen rules (`sheen`, `sheenColor`, `sheenRoughness`).                                                  |
| `emissive`        | `boolean` | `true`  | Includes emission/glow rules (`emissive`, `emissiveIntensity`).                                                         |
| `specular`        | `boolean` | `true`  | Includes specular highlight rules (`specularColor`, `specularIntensity`).                                               |
| `iridescence`     | `boolean` | `true`  | Includes thin-film iridescence rules (`iridescence`, `iridescenceIOR`).                                                 |
| `autoSmoothAngle` | `boolean` | `true`  | Includes custom mesh smoothing rules (`autoSmoothAngle`).                                                               |
| `animation`       | `boolean` | `true`  | Includes hierarchical bone and armature rules (`armature`, `bone`).                                                     |
| `lazyUnion`       | `boolean` | `false` | Includes geometry rules for discrete un-booleaned meshes (lazy-union).                                                  |

---

## 🤖 MCP Server Integration

This repository includes a fully functional **Model Context Protocol (MCP)** server. This allows any MCP-compatible client or AI assistant to natively design OpenSCAD scripts and compile them into `.glb` 3D files directly on your computer.

### Configuration

Add the following configuration block to your MCP client's configuration file:

```json
{
  "mcpServers": {
    "openscad-gltf": {
      "command": "npx",
      "args": [
        "-y",
        "--package=github:iliagrigorevdev/openscad-gltf-wasm",
        "scad-mcp"
      ]
    }
  }
}
```

### Workflow

Once connected, an AI assistant can use the server to execute the following loop:

1. **Retrieve Syntax Rules:** The assistant calls the `generate_prompt` tool to get the extended syntax rules for PBR materials and skeletal animations.
2. **Generate Code:** The assistant writes the `.scad` script based on your design request.
3. **Compile to 3D File:** The assistant calls the `convert_scad_to_glb` tool to compile the code and save the resulting `.glb` model directly to your specified local directory.

---

## Architecture & Credits

- **Core Engine:** Built on top of [OpenSCAD](https://openscad.org/).
- **glTF Export:** Export mechanics utilize the [tinygltf](https://github.com/syoyo/tinygltf) library.
- **License:** See the `LICENSE` file (GPL-2.0 or later, inheriting from standard OpenSCAD).
