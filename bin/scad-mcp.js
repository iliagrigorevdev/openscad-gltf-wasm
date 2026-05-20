#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Relative imports from the root of the package
import { convertScadToGltf } from "../convert.js";
import { generatePrompt } from "../prompt.js";

// Resolve the local WASM file path securely
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const wasmPath = path.resolve(__dirname, "../openscad.wasm");

// Polyfill fetch so the Emscripten WASM loader can read the local .wasm file in Node.js
const originalFetch = global.fetch;
global.fetch = async (url, options) => {
  const urlStr = url.toString();
  if (urlStr.startsWith("file://") || urlStr.endsWith(".wasm")) {
    const normalizedPath = urlStr.startsWith("file://")
      ? fileURLToPath(urlStr)
      : urlStr;

    const buffer = fs.readFileSync(normalizedPath);
    return new Response(buffer, {
      status: 200,
      headers: { "Content-Type": "application/wasm" },
    });
  }
  if (originalFetch) {
    return originalFetch(url, options);
  }
  throw new Error(`Fetch not polyfilled for: ${urlStr}`);
};

// Initialize MCP Server
const server = new Server(
  {
    name: "openscad-gltf-mcp",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// Register Tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "generate_prompt",
        description:
          "Generates an LLM prompt containing the required syntax rules for PBR materials and Skeletal Animations in the custom OpenSCAD fork.",
        inputSchema: {
          type: "object",
          properties: {
            description: {
              type: "string",
              description:
                "The description of the 3D object you want to design (e.g., 'a futuristic glass sword')",
            },
            options: {
              type: "object",
              description:
                "Optional toggles to include/exclude specific syntax blocks.",
              properties: {
                basic: { type: "boolean" },
                transmission: { type: "boolean" },
                clearcoat: { type: "boolean" },
                sheen: { type: "boolean" },
                emissive: { type: "boolean" },
                specular: { type: "boolean" },
                iridescence: { type: "boolean" },
                autoSmoothAngle: { type: "boolean" },
                animation: { type: "boolean" },
                lazyUnion: { type: "boolean" },
              },
            },
          },
          required: ["description"],
        },
      },
      {
        name: "convert_scad_to_glb",
        description:
          "Converts OpenSCAD (.scad) code directly to a Web-ready GLTF/GLB binary 3D file on the local file system. Supports PBR materials and skeletal animations.",
        inputSchema: {
          type: "object",
          properties: {
            scadCode: {
              type: "string",
              description: "The raw OpenSCAD code string to compile.",
            },
            outputPath: {
              type: "string",
              description:
                "The absolute local file path where the resulting .glb file should be saved (e.g., '/Users/name/Desktop/model.glb')",
            },
            options: {
              type: "object",
              description: "Optional compiler toggles.",
              properties: {
                binary: {
                  type: "boolean",
                  description:
                    "Output as binary GLB (true) or normal GLTF (false). Default true.",
                },
                lazyUnion: {
                  type: "boolean",
                  description: "Enable lazy union optimization. Default false.",
                },
              },
            },
          },
          required: ["scadCode", "outputPath"],
        },
      },
    ],
  };
});

// Handle Tool Execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case "generate_prompt": {
      const { description, options } = request.params.arguments;
      try {
        const prompt = generatePrompt(description, options || {});
        return {
          content: [{ type: "text", text: prompt }],
        };
      } catch (error) {
        return {
          content: [
            { type: "text", text: `Error generating prompt: ${error.message}` },
          ],
          isError: true,
        };
      }
    }

    case "convert_scad_to_glb": {
      const { scadCode, outputPath, options } = request.params.arguments;
      try {
        const conversionOptions = {
          wasmUrl: `file://${wasmPath}`,
          ...(options || {}),
        };

        // Compile SCAD to GLB
        const glbData = await convertScadToGltf(scadCode, conversionOptions);

        // Ensure parent directories exist
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        // Save file to disk
        fs.writeFileSync(outputPath, glbData);

        return {
          content: [
            {
              type: "text",
              text: `Successfully converted and saved 3D model to: ${outputPath}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error compiling SCAD to GLB: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }

    default:
      throw new Error(`Tool not found: ${request.params.name}`);
  }
});

// Start the MCP Stdio Server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("OpenSCAD GLTF MCP server running on stdio");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
