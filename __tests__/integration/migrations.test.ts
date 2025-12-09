import { describe, it, expect, beforeEach } from "vitest";
import { z } from "zod";
import { createPersistedState } from "../../src/index";
import { createMemoryAdapter } from "../../src/adapters/memory";
import type { Migration } from "../../src/types";

// Version 1 schema
const schemaV1 = z.object({
  _version: z.number(),
  name: z.string().default(""),
});

type SchemaV1 = z.output<typeof schemaV1>;

// Version 2 schema (adds email field)
const schemaV2 = z.object({
  _version: z.number(),
  name: z.string().default(""),
  email: z.string().default(""),
});

type SchemaV2 = z.output<typeof schemaV2>;

// Version 3 schema (adds preferences)
const schemaV3 = z.object({
  _version: z.number(),
  name: z.string().default(""),
  email: z.string().default(""),
  preferences: z.object({
    theme: z.enum(["light", "dark"]).default("light"),
  }).default({ theme: "light" }),
});

type SchemaV3 = z.output<typeof schemaV3>;

// Migration from v1 to v2
const migrationV1ToV2: Migration<SchemaV2> = {
  metadata: {
    version: 2,
    description: "Add email field",
  },
  migrate: (state: unknown): SchemaV2 => {
    const oldState = state as SchemaV1;
    return {
      ...oldState,
      _version: 2,
      email: "",
    };
  },
};

// Migration from v2 to v3
const migrationV2ToV3: Migration<SchemaV3> = {
  metadata: {
    version: 3,
    description: "Add preferences",
  },
  migrate: (state: unknown): SchemaV3 => {
    const oldState = state as SchemaV2;
    return {
      ...oldState,
      _version: 3,
      preferences: {
        theme: "light",
      },
    };
  },
};

describe("Integration: Migrations", () => {
  it("should migrate from v1 to v2", async () => {
    const adapter = createMemoryAdapter();

    // Store v1 data
    await adapter.setItem(
      "test-storage",
      JSON.stringify({
        _version: 1,
        name: "John Doe",
      }),
    );

    const storage = createPersistedState({
      schema: schemaV2,
      storageKey: "test-storage",
      storage: adapter,
      migrations: [migrationV1ToV2],
      getCurrentVersion: () => 2,
      schemaHashes: { 2: "hash-v2" },
    });

    await storage.init();

    const state = storage.getAll();
    expect(state._version).toBe(2);
    expect(state.name).toBe("John Doe");
    expect(state.email).toBe("");
  });

  it("should migrate from v1 to v3 (chained migrations)", async () => {
    const adapter = createMemoryAdapter();

    // Store v1 data
    await adapter.setItem(
      "test-storage",
      JSON.stringify({
        _version: 1,
        name: "John Doe",
      }),
    );

    const storage = createPersistedState({
      schema: schemaV3,
      storageKey: "test-storage",
      storage: adapter,
      migrations: [migrationV1ToV2, migrationV2ToV3],
      getCurrentVersion: () => 3,
      schemaHashes: { 3: "hash-v3" },
    });

    await storage.init();

    const state = storage.getAll();
    expect(state._version).toBe(3);
    expect(state.name).toBe("John Doe");
    expect(state.email).toBe("");
    expect(state.preferences?.theme).toBe("light");
  });

  it("should preserve data during migration", async () => {
    const adapter = createMemoryAdapter();

    // Store v2 data with email
    await adapter.setItem(
      "test-storage",
      JSON.stringify({
        _version: 2,
        name: "John Doe",
        email: "john@example.com",
      }),
    );

    const storage = createPersistedState({
      schema: schemaV3,
      storageKey: "test-storage",
      storage: adapter,
      migrations: [migrationV2ToV3],
      getCurrentVersion: () => 3,
      schemaHashes: { 3: "hash-v3" },
    });

    await storage.init();

    const state = storage.getAll();
    expect(state._version).toBe(3);
    expect(state.name).toBe("John Doe");
    expect(state.email).toBe("john@example.com"); // Preserved!
    expect(state.preferences?.theme).toBe("light");
  });
});
