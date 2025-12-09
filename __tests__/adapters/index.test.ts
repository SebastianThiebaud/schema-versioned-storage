import { describe, it, expect } from "vitest";
import {
  createMemoryAdapter,
  createLocalStorageAdapter,
  createAsyncStorageAdapter,
} from "../../src/adapters";

describe("adapters/index", () => {
  it("should export createMemoryAdapter", () => {
    expect(typeof createMemoryAdapter).toBe("function");
    const adapter = createMemoryAdapter();
    expect(adapter).toHaveProperty("getItem");
    expect(adapter).toHaveProperty("setItem");
    expect(adapter).toHaveProperty("removeItem");
  });

  it("should export createLocalStorageAdapter", () => {
    expect(typeof createLocalStorageAdapter).toBe("function");
  });

  it("should export createAsyncStorageAdapter", () => {
    expect(typeof createAsyncStorageAdapter).toBe("function");
  });
});
