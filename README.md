# openscad-gltf-wasm

A powerful WebAssembly (WASM) build of a custom OpenSCAD fork that enables direct compilation of OpenSCAD (`.scad`) scripts to **glTF/GLB** formats natively in JavaScript (Node.js and Browser).

Unlike standard OpenSCAD, this custom engine supports **Physically Based Rendering (PBR)** materials and **Hierarchical Skeletal Animations**, making it a perfect bridge between procedural CAD generation and modern 3D web rendering engines (like Three.js or Babylon.js).

This WASM module was generated from the `gltf` branch of the [openscad fork](https://github.com/iliagrigorevdev/openscad).

## Features

- **Direct SCAD to GLB conversion:** Compile geometry directly to web-ready binary glTF.
- **Extended PBR Material Support:** Native extensions to the OpenSCAD `color()` module supporting `metalness`, `roughness`, `transmission` (glass), `clearcoat`, and `sheen`.
- **Skeletal Animation:** Define animated armatures and bones directly within your `.scad` files.
- **True Skeletal Skinning:** Exports absolute world transforms and properly bound animation tracks.
- **LLM Friendly:** Includes a built-in prompt generator (`prompt.sh`) to help AI models (like ChatGPT or Claude) write compatible OpenSCAD scripts utilizing the new features.

---

## Installation

```bash
npm install openscad-gltf-wasm
```

---

## Usage (JavaScript / Node.js)

The package provides a convenient `convert.js` wrapper to handle the Emscripten WASM lifecycle and virtual file system.

```javascript
import { convertScadToGltf } from "openscad-gltf-wasm/convert";
import fs from "fs";

const scadCode = `
  color("gold", metalness=1.0, roughness=0.2)
  sphere(r=10);
`;

async function buildModel() {
  try {
    // Compile SCAD to a GLB Uint8Array
    const glbData = await convertScadToGltf(scadCode);

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

If you are using this in a browser, you may need to provide the URL to the WASM file so the Emscripten loader can find it:

```javascript
// Import the WASM file URL (syntax depends on your bundler, e.g., Vite)
import wasmUrl from "openscad-gltf-wasm/openscad.wasm?url";

const glbData = await convertScadToGltf(scadCode, wasmUrl);
```

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
    clearcoat = 1.0,           // Adds a clear reflective top layer (car paint/wet surfaces)
    clearcoatRoughness = 0.1,
    sheen = 1.0,               // Velvet/fabric rim lighting
    sheenColor = [1.0, 0.5, 0.5],
    sheenRoughness = 0.2
) {
    cylinder(h=10, r=5);
}
```

### 2. Skeletal Animations

You can now define hierarchical animated parts. Use the `armature` root module to define keyframes, and the `bone` module to define the physical moving parts.

```openscad
armature(animations = [
  // Format: ["BoneName", [ [time_in_sec, [rot_x, y, z], [trans_x, y, z]], ... ]]
  ["Pendulum", [
    [0.0, [0, 0, 0], [0, 0, 0]],
    [1.0, [0, 45, 0], [0, 0, 0]],
    [2.0, [0, -45, 0], [0, 0, 0]],
    [3.0, [0, 0, 0], [0, 0, 0]]
  ]]
]) {
    bone(name="Pendulum", t=[0, 0, 10], r=[0, 0, 0]) {
        color("silver", metalness=0.9, roughness=0.1)
        cylinder(h=10, r=1, center=false);
    }
}
```

---

## AI Integration (`prompt.sh`)

Because LLMs (like ChatGPT or Claude) only know standard OpenSCAD syntax up to their training cutoff, we've included a helper script to generate LLM prompts. This injects the rules for PBR and animations into your prompt context.

**Usage:**

```bash
./node_modules/openscad-gltf-wasm/prompt.sh "a futuristic glass sword with a glowing metallic handle, animated to spin 360 degrees"
```

_This will copy a highly-detailed system prompt to your clipboard, ready to be pasted into your AI tool of choice to generate perfectly compatible code for this library._

---

## Architecture & Credits

- **Core Engine:** Built on top of [OpenSCAD](https://openscad.org/).
- **glTF Export:** Export mechanics utilize the [tinygltf](https://github.com/syoyo/tinygltf) library.
- **License:** See the `LICENSE` file (GPL-2.0 or later, inheriting from standard OpenSCAD).
