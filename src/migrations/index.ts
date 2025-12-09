// Auto-generated file - do not edit manually
// Run: npm run generate:migrations

import type { Migration } from "@sebastianthiebaud/schema-versioned-storage";

const registry = new Map<number, Migration>();

export function getMigrations(): Map<number, Migration> {
  return registry;
}

export function getCurrentSchemaVersion(): number {
  if (registry.size === 0) return 1;
  return Math.max(...Array.from(registry.keys()));
}
