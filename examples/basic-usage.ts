/**
 * Basic usage example for schema-versioned-storage
 *
 * This example shows how to:
 * 1. Define a schema with inline defaults
 * 2. Create migrations
 * 3. Initialize and use the storage
 */

import { z } from "zod";
import { createPersistedState } from "../src/index";
import { createMemoryAdapter } from "../src/adapters/memory";

// 1. Define your schema with inline defaults
export const persistedSchema = z.object({
  /**
   * Schema version for migration support
   * The default value is set at runtime in persisted.ts
   */
  _version: z.number(),
  preferences: z
    .object({
      colorScheme: z.enum(["system", "light", "dark"]).default("system"),
      language: z.string().default("en"),
    })
    .default({ colorScheme: "system", language: "en" }),
  user: z
    .object({
      name: z.string().optional(),
      email: z.string().optional(),
    })
    .default({})
    .optional(),
});

export type PersistedSchema = z.output<typeof persistedSchema>;

// 3. Define migrations (optional)
// For this example, we'll skip migrations and use version 1
const migrations: any[] = [];

// 4. Schema hashes (normally auto-generated)
const SCHEMA_HASHES_BY_VERSION: Record<number, string> = {
  1: "example-hash-1",
};
const storage = createPersistedState({
  schema: persistedSchema,
  storageKey: "MY_APP_STATE",
  storage: createMemoryAdapter(), // Use memory adapter for this example
  migrations,
  getCurrentVersion: () => 1,
  schemaHashes: SCHEMA_HASHES_BY_VERSION,
});

// 5. Use the storage
async function example() {
  // Initialize
  await storage.init();

  // Get values
  const preferences = storage.get("preferences")!; // preferences is guaranteed by schema defaults
  const colorScheme = preferences.colorScheme;
  console.log("Current color scheme:", colorScheme);

  // Set values
  await storage.set("preferences", {
    colorScheme: "dark",
    language: "en",
  });

  // Update values
  await storage.update("preferences", (prev) => ({
    ...prev,
    colorScheme: "light",
  }));

  // Get all state
  const allState = storage.getAll();
  console.log("All state:", allState);

  // Get schema version
  const version = storage.getSchemaVersion();
  console.log("Schema version:", version);
}

// Run example
example().catch(console.error);
