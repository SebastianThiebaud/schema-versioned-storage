import { describe, it, expect } from "vitest";
import { createMemoryAdapter } from "../../src/adapters/memory";

describe("MemoryAdapter", () => {
  it("should store and retrieve values", async () => {
    const adapter = createMemoryAdapter();
    await adapter.setItem("test-key", "test-value");
    const value = await adapter.getItem("test-key");
    expect(value).toBe("test-value");
  });

  it("should return null for non-existent keys", async () => {
    const adapter = createMemoryAdapter();
    const value = await adapter.getItem("non-existent");
    expect(value).toBeNull();
  });

  it("should remove items", async () => {
    const adapter = createMemoryAdapter();
    await adapter.setItem("test-key", "test-value");
    await adapter.removeItem("test-key");
    const value = await adapter.getItem("test-key");
    expect(value).toBeNull();
  });

  it("should handle multiple keys", async () => {
    const adapter = createMemoryAdapter();
    await adapter.setItem("key1", "value1");
    await adapter.setItem("key2", "value2");
    expect(await adapter.getItem("key1")).toBe("value1");
    expect(await adapter.getItem("key2")).toBe("value2");
  });

  it("should overwrite existing values", async () => {
    const adapter = createMemoryAdapter();
    await adapter.setItem("test-key", "value1");
    await adapter.setItem("test-key", "value2");
    const value = await adapter.getItem("test-key");
    expect(value).toBe("value2");
  });
});
