#!/usr/bin/env node

/**
 * Schema Versioned Storage CLI
 *
 * Usage:
 *   svs generate:migrations
 *   svs generate:schema-hashes
 *   svs generate:all
 */

import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { spawn } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const commands = {
  "generate:migrations": join(
    __dirname,
    "../scripts/generate-migrations-index.mjs",
  ),
  "generate:schema-hashes": join(
    __dirname,
    "../scripts/generate-schema-hashes.mjs",
  ),
  "generate:all": null, // Special case - runs both
};

function runScript(scriptPath, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn("node", [scriptPath, ...args], {
      stdio: "inherit",
      shell: false,
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Script exited with code ${code}`));
      }
    });

    child.on("error", (error) => {
      reject(error);
    });
  });
}

async function main() {
  const [command, ...args] = process.argv.slice(2);

  if (!command) {
    console.error("Usage: svs <command> [options]");
    console.error("");
    console.error("Commands:");
    console.error("  generate:migrations     Generate migrations index file");
    console.error("  generate:schema-hashes   Generate schema hashes file");
    console.error(
      "  generate:all            Generate both migrations and schema hashes",
    );
    console.error("");
    console.error("Options:");
    console.error("  All options from the underlying scripts are supported");
    console.error(
      "  See package.json schemaVersionedStorage config for defaults",
    );
    process.exit(1);
  }

  if (command === "generate:all") {
    try {
      await runScript(commands["generate:migrations"], args);
      await runScript(commands["generate:schema-hashes"], args);
    } catch (error) {
      console.error("Error:", error.message);
      process.exit(1);
    }
  } else if (commands[command]) {
    try {
      await runScript(commands[command], args);
    } catch (error) {
      console.error("Error:", error.message);
      process.exit(1);
    }
  } else {
    console.error(`Unknown command: ${command}`);
    console.error("");
    console.error("Available commands:");
    Object.keys(commands).forEach((cmd) => {
      console.error(`  ${cmd}`);
    });
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});
