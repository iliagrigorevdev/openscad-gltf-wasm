# Godot OpenSCAD GLTF Importer

A Godot 4.x Editor Plugin that allows you to import OpenSCAD (`.scad`) files directly into your project as 3D scenes.

Instead of relying on the standard OpenSCAD desktop app, this addon seamlessly bridges Godot with a custom, modern WASM build of OpenSCAD (`openscad-gltf-wasm`). This allows you to write procedural 3D models using code and instantly see them imported into Godot with **Physically Based Rendering (PBR)** materials and **Skeletal Animations**.

## ✨ Features

- **Direct Import:** Drag and drop `.scad` files into your `res://` directory. Godot handles the rest.
- **PBR Materials:** Fully supports the extended `color()` syntax from the custom compiler (metalness, roughness, glass transmission, emission).
- **Skeletal Animations:** Imports rigged armatures and keyframe animations directly into Godot's `Skeleton3D` and `AnimationPlayer` nodes.
- **Auto-Cleanup:** Translates `.scad` to a temporary `.glb` file, passes it to Godot's advanced scene importer, and automatically cleans up temporary files.
- **Dual Conversion Modes:** Automatically tries local execution via `npx`, with a fallback to a local API server if Node.js is not in the system path.

## ⚠️ Prerequisites

The plugin requires a way to execute the `openscad-gltf-wasm` compiler. You have two options:

### Option 1: Local Node.js (Recommended)

1. Install [Node.js](https://nodejs.org/).
2. Ensure `npx` is available in your system's PATH.
3. The plugin will automatically run the compiler via `npx`.

### Option 2: Server Mode (Fallback)

If `npx` is not found or fails, the plugin attempts to connect to a local server.
To start the server, open your terminal and run:

```bash
npx -p github:iliagrigorevdev/openscad-gltf-wasm scad-serve
```

## 🚀 Installation

1. Download or clone this repository.
2. Move the `addons/scad_importer` folder into your Godot project's `addons/` directory.
   _(Your path should look like: `your_project/addons/scad_importer/plugin.cfg`)_
3. Open Godot, go to **Project** -> **Project Settings** -> **Plugins**.
4. Check the **Enable** box next to "OpenSCAD GLTF Importer".

## 🛠️ Usage

1. Place a `.scad` file in your Godot project.
2. Godot will trigger the importer.
3. **If conversion fails:** Check the Output console. If `npx` failed, the plugin will try to reach `scad-serve`. Ensure your local server is running if you aren't using the Node.js global path.

---

## 🤖 AI Project Generation (`scad-godot-prompt`)

Because LLMs (like Gemini or Claude) only know standard OpenSCAD syntax up to their training cutoff, this package includes a powerful CLI utility designed to generate an exhaustive LLM prompt for scaffolding a **complete Godot 4 project** utilizing procedural OpenSCAD assets.

This tool automatically bundles the extended OpenSCAD syntax rules, the source code of this Godot Importer Addon, and your specific game description into a massive context block, and **copies it directly to your system clipboard**.

### 1. Run the prompt generator:

```bash
npx -p github:iliagrigorevdev/openscad-gltf-wasm scad-godot-prompt "A 3D platformer game with a robotic frog"
```

You can also pass prompt options as a JSON string to toggle specific features (e.g., disabling animation or transmission):

```bash
npx -p github:iliagrigorevdev/openscad-gltf-wasm scad-godot-prompt "A 3D platformer game with a robotic frog" '{"animation": false, "transmission": false}'
```

The options JSON configures which feature-specific syntax blocks are included in the generated prompt.

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

### 2. Workflow Pipeline:

1. **Run the command** above. The generated context prompt is automatically copied to your clipboard (requires `pbcopy`, `xclip`, or `termux-clipboard-set`).
2. **Paste the prompt** into an advanced LLM (e.g., Gemini Pro).
3. **Generate Script:** The LLM will follow the strict prompt instructions to generate a single, self-contained `build_game.js` script.
4. **Execute:** Save and run `node build_game.js` locally. It will programmatically generate the project folder, OpenSCAD game assets (`.scad`), Godot scenes (`.tscn`), and scripts (`.gd`) with the importer addon automatically configured.
5. **Play:** Open the newly generated folder in the Godot Editor and test your AI-generated game!

---

## ⚖️ Licensing & Legal

This project utilizes a separated architecture that allows it to interact with a copyleft tool without inheriting its license restrictions.

### The Godot Plugin: MIT License

The source code for this Godot plugin (the GDScript files and configurations found in this repository) is provided under the permissive **MIT License**. Copyright (c) 2026 Ilia Grigorev. You are free to use, modify, and distribute this Godot addon in both open-source and closed-source commercial Godot projects.

### The OpenSCAD Compiler: GPLv2

Under the hood, this addon works by executing an external command-line process to invoke [`openscad-gltf-wasm`](https://github.com/iliagrigorevdev/openscad-gltf-wasm). That underlying compiler is a modified fork of OpenSCAD, and its source code is licensed under the **GNU General Public License Version 2 (GPLv2)**.

**Why is this allowed?**
The Godot Plugin and the OpenSCAD Compiler act as entirely separate programs. The Godot plugin does not statically or dynamically link to the GPL software's source code; it merely acts as a wrapper that sends arguments to an external command-line process (`npx ... scad-convert`). Because they communicate at "arm's length" via standard system execution pipes, the Godot plugin is not considered a derivative work of the GPL software and safely retains its MIT License.

_(Your generated 3D models/GLB files are your own intellectual property and are not bound by the GPL)._
