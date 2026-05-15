import OpenScad from "./openscad.js";

/**
 * Converts SCAD code to a GLTF/GLB Uint8Array using the OpenSCAD WASM compiler.
 * @param {string} scadCode - The OpenSCAD code to compile.
 * @param {Object} [options={}] - Options object.
 * @param {string} [options.wasmUrl] - Optional URL to the openscad.wasm file, useful for bundlers or extensions.
 * @param {boolean} [options.binary=true] - Whether to compile to a binary GLB (true) or normal GLTF (false).
 * @param {boolean} [options.lazyUnion=true] - Whether to apply the lazy union optimization (--enable=lazy-union).
 * @returns {Promise<Uint8Array>} The resulting GLB/GLTF data.
 */
export async function convertScadToGltf(scadCode, options = {}) {
  const wasmUrl = options.wasmUrl;
  const isBinary = options.binary !== undefined ? options.binary : true;
  const lazyUnion = options.lazyUnion !== undefined ? options.lazyUnion : true;

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

  // Compile to GLTF/GLB
  const outputExt = isBinary ? "glb" : "gltf";
  const outputName = `/output.${outputExt}`;

  const args = ["/input.scad", "-o", outputName];
  if (lazyUnion) {
    args.push("--enable=lazy-union");
  }

  instance.callMain(args);

  // Read the resulting byte array back from the virtual file system
  const outputArray = instance.FS.readFile(outputName);
  return outputArray;
}
