#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { convertScadToGltf } from "../convert.js";

// 1. Resolve the local WASM file path (assuming the script is in /bin and wasm is in root)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const wasmPath = path.resolve(__dirname, "../openscad.wasm");

// 2. Polyfill fetch so the WASM loader works natively in Node.js
global.fetch = async (url) => {
  const normalizedPath = url.toString().startsWith("file://")
    ? fileURLToPath(url.toString())
    : url.toString();

  const buffer = fs.readFileSync(normalizedPath);
  return new Response(buffer, {
    status: 200,
    headers: { "Content-Type": "application/wasm" },
  });
};

async function run() {
  const args = process.argv.slice(2);
  const inputPath = args[0];
  const outputPath = args[1];
  const optionsJson = args[2];

  if (!inputPath || !outputPath) {
    console.error(
      "Usage: scad-convert <input.scad | input_dir> <output.glb | output_dir> [options_json]",
    );
    process.exit(1);
  }

  if (!fs.existsSync(inputPath)) {
    console.error(`Input file or directory not found: ${inputPath}`);
    process.exit(1);
  }

  const isInputDirectory = fs.statSync(inputPath).isDirectory();

  let inputFiles = [];
  if (isInputDirectory) {
    const files = fs.readdirSync(inputPath);
    for (const file of files) {
      if (file.toLowerCase().endsWith(".scad")) {
        inputFiles.push(path.join(inputPath, file));
      }
    }

    if (inputFiles.length === 0) {
      console.log(`No .scad files found in directory: ${inputPath}`);
      process.exit(0);
    }

    // Output must be a directory if input is a directory
    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true });
    } else if (!fs.statSync(outputPath).isDirectory()) {
      console.error("Output must be a directory when input is a directory.");
      process.exit(1);
    }
  } else {
    inputFiles.push(inputPath);
  }

  let options = {};
  if (optionsJson) {
    if (optionsJson.startsWith("{")) {
      // If it starts with '{', try parsing as normal JSON
      options = JSON.parse(optionsJson);
    } else {
      // Otherwise, safely decode the Base64 string
      const decoded = Buffer.from(optionsJson, "base64").toString("utf8");
      options = JSON.parse(decoded);
    }
  }

  for (const file of inputFiles) {
    let finalOutputPath = outputPath;

    if (isInputDirectory) {
      const baseName = path.basename(file, path.extname(file));
      finalOutputPath = path.join(outputPath, `${baseName}.glb`);
    } else {
      if (fs.existsSync(outputPath)) {
        if (fs.statSync(outputPath).isDirectory()) {
          const baseName = path.basename(file, path.extname(file));
          finalOutputPath = path.join(outputPath, `${baseName}.glb`);
        }
      } else {
        // If it doesn't exist, determine if it's meant to be a folder or a file
        const ext = path.extname(outputPath).toLowerCase();
        if (ext !== ".glb" && ext !== ".gltf") {
          // Treat as a directory
          fs.mkdirSync(outputPath, { recursive: true });
          const baseName = path.basename(file, path.extname(file));
          finalOutputPath = path.join(outputPath, `${baseName}.glb`);
        } else {
          // Treat as a file, ensure parent directory exists
          const parentDir = path.dirname(outputPath);
          if (!fs.existsSync(parentDir)) {
            fs.mkdirSync(parentDir, { recursive: true });
          }
        }
      }
    }

    const scadCode = fs.readFileSync(file, "utf8");

    try {
      // Pass the raw SCAD directly to the WASM converter
      const glbData = await convertScadToGltf(scadCode, {
        wasmUrl: `file://${wasmPath}`,
        ...options,
      });

      fs.writeFileSync(finalOutputPath, glbData);
    } catch (error) {
      console.error(`SCAD Conversion Error for ${file}:`, error);
      process.exit(1);
    }
  }

  process.exit(0);
}

run();
