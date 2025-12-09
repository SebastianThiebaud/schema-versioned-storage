import { describe, it, expect, beforeEach } from "vitest";
import { z } from "zod";
import { createPersistedState } from "../../src/index";
import { createMemoryAdapter } from "../../src/adapters/memory";

// Test schema
const testSchema = z.object({
  _version: z.number(),
  user: z.object({
    name: z.string().default(""),
    email: z.string().default(""),
  }).default({ name: "", email: "" }),
  preferences: z.object({
    theme: z.enum(["light", "dark"]).default("light"),
  }).default({ theme: "light" }),
});

type TestSchema = z.output<typeof testSchema>;

describe("Integration: Full Flow", () => {
  let storage: ReturnType<typeof createPersistedState<TestSchema>>;

  beforeEach(() => {
    storage = createPersistedState({
      schema: testSchema,
      storageKey: "test-storage",
      storage: createMemoryAdapter(),
      migrations: [],
      getCurrentVersion: () => 1,
      schemaHashes: { 1: "test-hash-1" },
    });
  });

  it("should initialize with defaults when no data exists", async () => {
    await storage.init();

    const user = storage.get("user");
    expect(user.name).toBe("");
    expect(user.email).toBe("");
    expect(storage.getSchemaVersion()).toBe(1);
  });

  it("should persist and retrieve data", async () => {
    await storage.init();

    await storage.set("user", {
      name: "John Doe",
      email: "john@example.com",
    });

    const user = storage.get("user");
    expect(user.name).toBe("John Doe");
    expect(user.email).toBe("john@example.com");
  });

  it("should update data", async () => {
    await storage.init();

    await storage.set("user", {
      name: "John Doe",
      email: "john@example.com",
    });

    await storage.update("user", (prev) => ({
      ...prev,
      name: "Jane Doe",
    }));

    const user = storage.get("user");
    expect(user.name).toBe("Jane Doe");
    expect(user.email).toBe("john@example.com");
  });

  it("should get all state", async () => {
    await storage.init();

    await storage.set("user", {
      name: "John Doe",
      email: "john@example.com",
    });

    const allState = storage.getAll();
    expect(allState._version).toBe(1);
    expect(allState.user.name).toBe("John Doe");
    expect(allState.preferences.theme).toBe("light");
  });

  it("should clear all data", async () => {
    await storage.init();

    await storage.set("user", {
      name: "John Doe",
      email: "john@example.com",
    });

    await storage.clear();

    // After clear, should have defaults again
    const user = storage.get("user");
    expect(user.name).toBe("");
    expect(user.email).toBe("");
  });
});
