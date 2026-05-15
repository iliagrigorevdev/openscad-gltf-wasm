# Godot OpenSCAD GLTF Importer

A Godot 4.x Editor Plugin that allows you to import OpenSCAD (`.scad`) files directly into your project as 3D scenes.

Instead of relying on the standard OpenSCAD desktop app, this addon seamlessly bridges Godot with a custom, modern WASM build of OpenSCAD (`openscad-gltf-wasm`). This allows you to write procedural 3D models using code and instantly see them imported into Godot with **Physically Based Rendering (PBR)** materials and **Skeletal Animations**.

## ✨ Features

- **Direct Import:** Drag and drop `.scad` files into your `res://` directory. Godot handles the rest.
- **PBR Materials:** Fully supports the extended `color()` syntax from the custom compiler (metalness, roughness, glass transmission, emission).
- **Skeletal Animations:** Imports rigged armatures and keyframe animations directly into Godot's `Skeleton3D` and `AnimationPlayer` nodes.
- **Auto-Cleanup:** Translates `.scad` to a temporary `.glb` file, passes it to Godot's advanced scene importer, and automatically cleans up temporary files.

## ⚠️ Prerequisites

Because this plugin downloads and runs a WebAssembly compiler locally, **Node.js must be installed on your system.**

1. Install [Node.js](https://nodejs.org/) (which includes `npx`).
2. Ensure `npx` is available in your system's PATH.
   _(Note for Windows users: The plugin automatically handles routing the command through `cmd.exe`)._

## 🚀 Installation

1. Download or clone this repository.
2. Move the `addons/scad_importer` folder into your Godot project's `addons/` directory.
   _(Your path should look like: `your_project/addons/scad_importer/plugin.cfg`)_
3. Open Godot, go to **Project** -> **Project Settings** -> **Plugins**.
4. Check the **Enable** box next to "OpenSCAD GLTF Importer".

## 🛠️ Usage

1. Create or place an OpenSCAD `.scad` file anywhere in your Godot file system.
2. Godot will automatically trigger the importer.
3. Double-click the imported `.scad` file to open it, or instantiate it into your currently open scene.

> **Note:** The _very first time_ you import a file, the process might take a few extra seconds. The plugin uses `npx` to fetch the `openscad-gltf-wasm` package from GitHub. Subsequent imports will be much faster.

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
