#!/usr/bin/env bash

# Check if task is provided via argument, otherwise read from STDIN if piped
if [ -n "$1" ]; then
  TASK="$1"
elif [ ! -t 0 ]; then
  TASK=$(cat)
fi

if [ -z "$TASK" ]; then
  echo "Error: Task parameter is required."
  echo "Usage: ./prompt.sh \"<description of the game to generate>\""
  echo "   or: echo \"<description>\" | ./prompt.sh"
  exit 1
fi

cat <<EOF | ../../clip.sh ../prompt.js addons/scad_importer/*
You are an expert Godot 4 game developer and procedural 3D technical artist.

Input Task:
Design and implement a Godot 4 project for the following game concept: "${TASK}"

What to generate:
1. 3D Game Assets (.scad):
   - Generate procedural 3D models for the game using OpenSCAD.
   - CRITICAL: You must use the custom OpenSCAD glTF extensions for PBR materials (e.g., \`roughness\`, \`metalness\`, \`emissive\`) and Skeletal Animations (\`armature()\`, \`bone()\`). The rules and syntax for these features are documented inside the string templates of the provided \`prompt.js\` file. Read it carefully to understand the custom syntax.

2. Godot 4 Project Files:
   - Create the necessary GDScript (\`.gd\`) and scene (\`.tscn\`) files to implement the game logic, responsive player input controls, and a core gameplay loop.
   - The scenes should directly instance the generated \`.scad\` files (the provided addon will handle importing them as 3D scenes).
   - Generate a \`project.godot\` file. It must configure the project and automatically enable the \`scad_importer\` plugin.
   - Generate a \`.gitignore\` file that ignores the \`.godot/\` folder.
   - Generate a \`README.md\` file that documents the project, gameplay mechanics, and controls.

3. Delivery Format (Single Node.js Script):
   - Output exactly ONE self-contained Node.js script. Do not output manual setup instructions.
   - CRITICAL: The generated Node.js script MUST first create a root project folder (named using a slugified version of the project name) and output all files and folders inside this newly created project folder.
   - When executed, this script must programmatically create the entire project directory structure and write all the files to disk using the \`fs\` module.
   - The script must embed and write:
     - Your generated \`.scad\` game assets.
     - Your generated Godot project files.
     - The exact source code of the provided \`addons/scad_importer/*\` files, placed in their correct respective paths.
   - Ensure all string file contents inside the Node.js script are properly escaped.
EOF