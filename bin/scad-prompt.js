#!/usr/bin/env node
import { generatePrompt } from "../prompt.js";

function run() {
  const args = process.argv.slice(2);
  const description = args[0];
  const optionsJson = args[1];

  if (!description) {
    console.error("Usage: scad-prompt <description> [options_json]");
    console.error(
      "Example: scad-prompt 'a futuristic glass sword' '{\"animation\": true}'",
    );
    process.exit(1);
  }

  let options = {};
  if (optionsJson) {
    try {
      if (optionsJson.startsWith("{")) {
        // Parse as normal JSON
        options = JSON.parse(optionsJson);
      } else {
        // Safely decode the Base64 string
        const decoded = Buffer.from(optionsJson, "base64").toString("utf8");
        options = JSON.parse(decoded);
      }
    } catch (e) {
      console.error("Invalid options JSON provided.");
      process.exit(1);
    }
  }

  try {
    const prompt = generatePrompt(description, options);
    console.log(prompt);
  } catch (error) {
    console.error("Error generating prompt:", error.message);
    process.exit(1);
  }
}

run();
