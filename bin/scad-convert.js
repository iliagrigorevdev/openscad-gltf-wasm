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
      "Usage: scad-convert <input.scad> <output.glb> [options_json]",
    );
    process.exit(1);
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

  if (!fs.existsSync(inputPath)) {
    console.error(`Input file not found: ${inputPath}`);
    process.exit(1);
  }

  const scadCode = fs.readFileSync(inputPath, "utf8");

  try {
    // Pass the raw SCAD directly to the WASM converter
    const glbData = await convertScadToGltf(scadCode, {
      wasmUrl: `file://${wasmPath}`,
      ...options,
    });

    fs.writeFileSync(outputPath, glbData);
    process.exit(0);
  } catch (error) {
    console.error("SCAD Conversion Error:", error);
    process.exit(1);
  }
}

run();
