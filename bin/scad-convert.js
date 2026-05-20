#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
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

/**
 * Recursively resolves local dependencies (include / use) to build a combined content string.
 * This ensures changes in included files also trigger a re-import.
 */
function getFileAndDependenciesContent(filePath, visited = new Set()) {
  if (visited.has(filePath)) return "";
  visited.add(filePath);

  if (!fs.existsSync(filePath)) {
    return "";
  }

  const content = fs.readFileSync(filePath, "utf8");
  let totalContent = content;

  // Match include <...> or "..." and use <...> or "..."
  const includeRegex = /(?:include|use)\s*([<"])([^>"]+)([>"])/g;
  let match;
  while ((match = includeRegex.exec(content)) !== null) {
    const depRelativePath = match[2];
    const depAbsolutePath = path.resolve(
      path.dirname(filePath),
      depRelativePath,
    );
    totalContent += getFileAndDependenciesContent(depAbsolutePath, visited);
  }

  return totalContent;
}

async function run() {
  const allArgs = process.argv.slice(2);
  const useCache = allArgs.includes("--cache");
  const args = allArgs.filter((arg) => arg !== "--cache");

  const inputPath = args[0];
  const outputPath = args[1];
  const optionsJson = args[2];

  if (!inputPath || !outputPath) {
    console.error(
      "Usage: scad-convert <input.scad | input_dir> <output.glb | output_dir> [options_json] [--cache]",
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
    const importFilePath = `${finalOutputPath}.import`;

    let needsConversion = true;
    let currentHash = null;

    if (useCache) {
      // Hash the combination of the SCAD file (plus dependencies) and the current options
      const totalContentForHash = getFileAndDependenciesContent(file);
      const hashData = totalContentForHash + JSON.stringify(options);
      currentHash = crypto.createHash("sha256").update(hashData).digest("hex");

      // Check if the file has already been imported with these exact contents/options
      if (fs.existsSync(finalOutputPath) && fs.existsSync(importFilePath)) {
        try {
          const importData = JSON.parse(
            fs.readFileSync(importFilePath, "utf8"),
          );
          if (importData.hash === currentHash) {
            needsConversion = false;
          }
        } catch (e) {
          // Ignore JSON parse errors, proceed with conversion
        }
      }
    }

    if (!needsConversion) {
      console.log(`Skipped ${path.basename(file)} (no changes detected)`);
      continue;
    }

    if (useCache || isInputDirectory) {
      console.log(`Converting ${path.basename(file)} -> ${finalOutputPath}...`);
    }

    try {
      // Pass the raw SCAD directly to the WASM converter
      const glbData = await convertScadToGltf(scadCode, {
        wasmUrl: `file://${wasmPath}`,
        ...options,
      });

      fs.writeFileSync(finalOutputPath, glbData);

      if (useCache) {
        // Save an import cache file
        fs.writeFileSync(
          importFilePath,
          JSON.stringify(
            {
              hash: currentHash,
              source: path.basename(file),
              timestamp: new Date().toISOString(),
            },
            null,
            2,
          ),
        );
      }
    } catch (error) {
      console.error(`SCAD Conversion Error for ${file}:`, error);
      process.exit(1);
    }
  }

  process.exit(0);
}

run();
