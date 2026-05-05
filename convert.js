import OpenScad from "./openscad.js";

/**
 * Converts SCAD code to a GLTF/GLB Uint8Array using the OpenSCAD WASM compiler.
 * @param {string} scadCode - The OpenSCAD code to compile.
 * @param {string} [wasmUrl] - Optional URL to the openscad.wasm file, useful for bundlers or extensions.
 * @returns {Promise<Uint8Array>} The resulting GLB data.
 */
export async function convertScadToGltf(scadCode, wasmUrl) {
  // Initialize a NEW instance every time because callMain terminates the WASM environment
  const instance = await OpenScad({
    noInitialRun: true,
    locateFile: (path) => {
      if (wasmUrl && path.endsWith("openscad.wasm")) {
        return wasmUrl;
      }
      return path;
    },
  });

  // Write the input SCAD code to Emscripten's virtual file system
  instance.FS.writeFile("/input.scad", scadCode);

  // Compile to GLB
  instance.callMain([
    "/input.scad",
    "-o",
    "output.glb",
    "--enable=lazy-union",
  ]);

  // Read the resulting GLB byte array back from the virtual file system
  const outputArray = instance.FS.readFile("/output.glb");
  return outputArray;
}
