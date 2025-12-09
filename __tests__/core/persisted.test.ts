import { describe, it, expect, beforeEach } from "vitest";
import { z } from "zod";
import { createPersistedState } from "../../src/core/persisted";
import { createMemoryAdapter } from "../../src/adapters/memory";
import type { Migration } from "../../src/types";

// Test schema
const testSchema = z.object({
  _version: z.number(),
  name: z.string(),
  count: z.number(),
});

type TestSchema = z.infer<typeof testSchema>;

function createDefaults(version: number): TestSchema {
  return {
    _version: version,
    name: "default",
    count: 0,
  };
}

describe("createPersistedState", () => {
  let storage: ReturnType<typeof createPersistedState<TestSchema>>;

  beforeEach(() => {
    storage = createPersistedState({
      schema: testSchema,
      defaults: createDefaults,
      storageKey: "test-storage",
      storage: createMemoryAdapter(),
      migrations: [],
      getCurrentVersion: () => 1,
      schemaHashes: { 1: "hash1" },
    });
  });

  it("should initialize with defaults when no stored data", async () => {
    await storage.init();
    expect(storage.get("name")).toBe("default");
    expect(storage.get("count")).toBe(0);
  });

  it("should load stored data", async () => {
    const adapter = createMemoryAdapter();
    await adapter.setItem(
      "test-storage",
      JSON.stringify({ _version: 1, name: "stored", count: 5 }),
    );

    storage = createPersistedState({
      schema: testSchema,
      defaults: createDefaults,
      storageKey: "test-storage",
      storage: adapter,
      migrations: [],
      getCurrentVersion: () => 1,
      schemaHashes: { 1: "hash1" },
    });

    await storage.init();
    expect(storage.get("name")).toBe("stored");
    expect(storage.get("count")).toBe(5);
  });

  it("should throw error if not initialized", () => {
    expect(() => {
      storage.get("name");
    }).toThrow("not initialized");
  });

  it("should get values after initialization", async () => {
    await storage.init();
    expect(storage.get("name")).toBe("default");
    expect(storage.get("count")).toBe(0);
  });

  it("should set values", async () => {
    await storage.init();
    await storage.set("name", "updated");
    expect(storage.get("name")).toBe("updated");
  });

  it("should update values", async () => {
    await storage.init();
    await storage.update("count", (prev) => prev + 1);
    expect(storage.get("count")).toBe(1);
  });

  it("should get all state", async () => {
    await storage.init();
    const all = storage.getAll();
    expect(all).toEqual({ _version: 1, name: "default", count: 0 });
  });

  it("should clear state", async () => {
    await storage.init();
    await storage.set("name", "test");
    await storage.clear();
    // After clear, should be back to defaults
    expect(storage.get("name")).toBe("default");
  });

  it("should get schema version", async () => {
    await storage.init();
    expect(storage.getSchemaVersion()).toBe(1);
  });

  it("should get schema hash", async () => {
    await storage.init();
    expect(storage.getSchemaHash()).toBe("hash1");
  });

  it("should get schema hash for version", async () => {
    await storage.init();
    expect(storage.getSchemaHashForVersion(1)).toBe("hash1");
    expect(storage.getSchemaHashForVersion(2)).toBeUndefined();
  });

  it("should run migrations when stored version is older", async () => {
    const adapter = createMemoryAdapter();
    await adapter.setItem(
      "test-storage",
      JSON.stringify({ _version: 1, name: "old", count: 0 }),
    );

    const migrations: Migration<TestSchema>[] = [
      {
        metadata: { version: 2, description: "Update name" },
        migrate: (state: any) => ({
          ...state,
          _version: 2,
          name: "migrated",
        }),
      },
    ];

    storage = createPersistedState({
      schema: testSchema,
      defaults: createDefaults,
      storageKey: "test-storage",
      storage: adapter,
      migrations,
      getCurrentVersion: () => 2,
      schemaHashes: { 1: "hash1", 2: "hash2" },
    });

    await storage.init();
    expect(storage.get("name")).toBe("migrated");
    expect(storage.getSchemaVersion()).toBe(2);
  });

  it("should validate schema on set", async () => {
    await storage.init();
    await expect(async () => {
      // @ts-expect-error - intentionally invalid type
      await storage.set("name", 123);
    }).rejects.toThrow();
  });

  it("should use defaults on invalid stored data", async () => {
    const adapter = createMemoryAdapter();
    await adapter.setItem("test-storage", "invalid json");

    storage = createPersistedState({
      schema: testSchema,
      defaults: createDefaults,
      storageKey: "test-storage",
      storage: adapter,
      migrations: [],
      getCurrentVersion: () => 1,
      schemaHashes: { 1: "hash1" },
    });

    await storage.init();
    // Should fall back to defaults
    expect(storage.get("name")).toBe("default");
  });

  it("should handle stored version newer than current version", async () => {
    const adapter = createMemoryAdapter();
    await adapter.setItem(
      "test-storage",
      JSON.stringify({ _version: 2, name: "newer", count: 0 }),
    );

    storage = createPersistedState({
      schema: testSchema,
      defaults: createDefaults,
      storageKey: "test-storage",
      storage: adapter,
      migrations: [],
      getCurrentVersion: () => 1,
      schemaHashes: { 1: "hash1" },
    });

    await storage.init();
    // Should use defaults when stored version is newer
    expect(storage.get("name")).toBe("default");
  });

  it("should handle schema validation error on stored data", async () => {
    const adapter = createMemoryAdapter();
    // Store data that doesn't match schema
    await adapter.setItem(
      "test-storage",
      JSON.stringify({ _version: 1, name: 123, count: "invalid" }),
    );

    storage = createPersistedState({
      schema: testSchema,
      defaults: createDefaults,
      storageKey: "test-storage",
      storage: adapter,
      migrations: [],
      getCurrentVersion: () => 1,
      schemaHashes: { 1: "hash1" },
    });

    await storage.init();
    // Should fall back to defaults on validation error
    expect(storage.get("name")).toBe("default");
  });

  it("should handle storage.getItem error", async () => {
    const adapter = createMemoryAdapter();
    // Create a storage adapter that throws on getItem
    const errorAdapter = {
      ...adapter,
      getItem: async () => {
        throw new Error("Storage error");
      },
    };

    storage = createPersistedState({
      schema: testSchema,
      defaults: createDefaults,
      storageKey: "test-storage",
      storage: errorAdapter,
      migrations: [],
      getCurrentVersion: () => 1,
      schemaHashes: { 1: "hash1" },
    });

    await storage.init();
    // Should use defaults on storage error
    expect(storage.get("name")).toBe("default");
  });

  it("should handle storage.setItem error", async () => {
    const adapter = createMemoryAdapter();
    const errorAdapter = {
      ...adapter,
      setItem: async () => {
        throw new Error("Storage write error");
      },
    };

    storage = createPersistedState({
      schema: testSchema,
      defaults: createDefaults,
      storageKey: "test-storage",
      storage: errorAdapter,
      migrations: [],
      getCurrentVersion: () => 1,
      schemaHashes: { 1: "hash1" },
    });

    await storage.init();
    await expect(storage.set("name", "test")).rejects.toThrow(
      "Storage write error",
    );
  });

  it("should handle storage.removeItem error in clear", async () => {
    const adapter = createMemoryAdapter();
    const errorAdapter = {
      ...adapter,
      removeItem: async () => {
        throw new Error("Storage remove error");
      },
    };

    storage = createPersistedState({
      schema: testSchema,
      defaults: createDefaults,
      storageKey: "test-storage",
      storage: errorAdapter,
      migrations: [],
      getCurrentVersion: () => 1,
      schemaHashes: { 1: "hash1" },
    });

    await storage.init();
    await expect(storage.clear()).rejects.toThrow("Storage remove error");
  });

  it("should ensure _version is set on state", async () => {
    const adapter = createMemoryAdapter();
    // Store data without _version
    await adapter.setItem(
      "test-storage",
      JSON.stringify({ name: "test", count: 0 }),
    );

    storage = createPersistedState({
      schema: testSchema,
      defaults: createDefaults,
      storageKey: "test-storage",
      storage: adapter,
      migrations: [],
      getCurrentVersion: () => 1,
      schemaHashes: { 1: "hash1" },
    });

    await storage.init();
    expect(storage.get("_version")).toBe(1);
  });

  it("should handle same version with schema hash check", async () => {
    const adapter = createMemoryAdapter();
    await adapter.setItem(
      "test-storage",
      JSON.stringify({ _version: 1, name: "stored", count: 5 }),
    );

    storage = createPersistedState({
      schema: testSchema,
      defaults: createDefaults,
      storageKey: "test-storage",
      storage: adapter,
      migrations: [],
      getCurrentVersion: () => 1,
      schemaHashes: { 1: "hash1" },
    });

    await storage.init();
    // Should load stored data when version matches
    expect(storage.get("name")).toBe("stored");
  });

  it("should not reinitialize if already initialized", async () => {
    await storage.init();
    const firstState = storage.getAll();

    // Try to init again
    await storage.init();
    const secondState = storage.getAll();

    // Should be the same
    expect(firstState).toEqual(secondState);
  });

  it("should throw error when set is called before init", async () => {
    await expect(storage.set("name", "test")).rejects.toThrow(
      "not initialized",
    );
  });

  it("should throw error when update is called before init", async () => {
    await expect(storage.update("name", (prev) => prev)).rejects.toThrow(
      "not initialized",
    );
  });

  it("should throw error when getAll is called before init", () => {
    expect(() => storage.getAll()).toThrow("not initialized");
  });

  it("should return empty string when schema hash is not found", async () => {
    storage = createPersistedState({
      schema: testSchema,
      defaults: createDefaults,
      storageKey: "test-storage",
      storage: createMemoryAdapter(),
      migrations: [],
      getCurrentVersion: () => 1,
      schemaHashes: {}, // Empty hashes
    });

    await storage.init();
    expect(storage.getSchemaHash()).toBe("");
  });
});
