/**
 * Basic usage example for schema-versioned-storage
 *
 * This example shows how to:
 * 1. Define a schema
 * 2. Define defaults
 * 3. Create migrations
 * 4. Initialize and use the storage
 */

import { z } from "zod";
import { createPersistedState } from "../src/index";
import { createMemoryAdapter } from "../src/adapters/memory";

// 1. Define your schema
export const persistedSchema = z.object({
  _version: z.number(),
  preferences: z.object({
    colorScheme: z.enum(["system", "light", "dark"]).default("system"),
    language: z.string().default("en"),
  }),
  user: z.object({
    name: z.string().optional(),
    email: z.string().optional(),
  }),
});

export type PersistedSchema = z.infer<typeof persistedSchema>;

// 2. Define defaults
export function createDefaults(version: number): PersistedSchema {
  return {
    _version: version,
    preferences: {
      colorScheme: "system",
      language: "en",
    },
    user: {
      name: undefined,
      email: undefined,
    },
  };
}

// 3. Define migrations (optional)
// For this example, we'll skip migrations and use version 1
const migrations: any[] = [];

// 4. Schema hashes (normally auto-generated)
const SCHEMA_HASHES_BY_VERSION: Record<number, string> = {
  1: "example-hash-1",
};

// 5. Initialize storage
const storage = createPersistedState({
  schema: persistedSchema,
  defaults: createDefaults,
  storageKey: "MY_APP_STATE",
  storage: createMemoryAdapter(), // Use memory adapter for this example
  migrations,
  getCurrentVersion: () => 1,
  schemaHashes: SCHEMA_HASHES_BY_VERSION,
});

// 6. Use the storage
async function example() {
  // Initialize
  await storage.init();

  // Get values
  const colorScheme = storage.get("preferences").colorScheme;
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
