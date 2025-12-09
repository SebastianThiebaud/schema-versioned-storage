// Main exports
export { createPersistedState } from "./core/persisted";
export type {
  PersistedStateConfig,
  StorageAdapter,
  PersistedState,
} from "./core/persisted";

// Migration types and utilities
export type { Migration, MigrationMetadata } from "./types";
export { createMigrationRegistry, runMigrations } from "./core/migrations";

// Utilities
export {
  simpleHash,
  extractSchemaShape,
  hashSchema,
  getTypeString,
} from "./utils";

// Re-export Zod for convenience
export { z } from "zod";
