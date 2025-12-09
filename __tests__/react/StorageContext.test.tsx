import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, renderHook, act } from "@testing-library/react";
import { z } from "zod";
import { createPersistedState } from "../../src/core/persisted";
import { createMemoryAdapter } from "../../src/adapters/memory";
import {
  StorageProvider,
  useStorage,
  useStorageInitialized,
} from "../../src/react";

// Test schema
const testSchema = z.object({
  _version: z.number(),
  name: z.string().default("default"),
  count: z.number().default(0),
});

type TestSchema = z.output<typeof testSchema>;

describe("StorageProvider and hooks", () => {
  let storage: ReturnType<typeof createPersistedState<TestSchema>>;

  beforeEach(async () => {
    storage = createPersistedState({
      schema: testSchema,
      storageKey: "test-storage",
      storage: createMemoryAdapter(),
      migrations: [],
      getCurrentVersion: () => 1,
      schemaHashes: { 1: "test-hash" },
    });
    await storage.init();
  });

  describe("StorageProvider", () => {
    it("should provide storage to children", () => {
      const TestComponent = () => {
        const storage = useStorage<TestSchema>();
        const value = storage.get("name");
        return <div>{value}</div>;
      };

      const { container } = render(
        <StorageProvider storage={storage} initialized={true}>
          <TestComponent />
        </StorageProvider>
      );

      expect(container.textContent).toBe("default");
    });

    it("should provide initialized status to children", () => {
      const TestComponent = () => {
        const isInitialized = useStorageInitialized();
        return <div>{isInitialized ? "initialized" : "not initialized"}</div>;
      };

      const { container, rerender } = render(
        <StorageProvider storage={storage} initialized={false}>
          <TestComponent />
        </StorageProvider>
      );

      expect(container.textContent).toBe("not initialized");

      rerender(
        <StorageProvider storage={storage} initialized={true}>
          <TestComponent />
        </StorageProvider>
      );

      expect(container.textContent).toBe("initialized");
    });
  });

  describe("useStorage", () => {
    it("should return storage instance when used within provider", () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <StorageProvider storage={storage} initialized={true}>
          {children}
        </StorageProvider>
      );

      const { result } = renderHook(() => useStorage<TestSchema>(), {
        wrapper,
      });

      expect(result.current).toBe(storage);
      expect(result.current.get("name")).toBe("default");
      expect(result.current.get("count")).toBe(0);
    });

    it("should throw error when used outside provider", () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      expect(() => {
        renderHook(() => useStorage<TestSchema>());
      }).toThrow(
        "useStorage must be used within a StorageProvider"
      );

      consoleSpy.mockRestore();
    });

    it("should allow reading values from storage", () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <StorageProvider storage={storage} initialized={true}>
          {children}
        </StorageProvider>
      );

      const { result } = renderHook(() => useStorage<TestSchema>(), {
        wrapper,
      });

      expect(result.current.get("name")).toBe("default");
      expect(result.current.get("count")).toBe(0);
    });

    it("should allow setting values in storage", async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <StorageProvider storage={storage} initialized={true}>
          {children}
        </StorageProvider>
      );

      const { result } = renderHook(() => useStorage<TestSchema>(), {
        wrapper,
      });

      await act(async () => {
        await result.current.set("name", "updated");
      });

      expect(result.current.get("name")).toBe("updated");
    });

    it("should allow updating values in storage", async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <StorageProvider storage={storage} initialized={true}>
          {children}
        </StorageProvider>
      );

      const { result } = renderHook(() => useStorage<TestSchema>(), {
        wrapper,
      });

      await act(async () => {
        await result.current.update("count", (prev) => prev + 1);
      });

      expect(result.current.get("count")).toBe(1);
    });
  });

  describe("useStorageInitialized", () => {
    it("should return true when storage is initialized", () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <StorageProvider storage={storage} initialized={true}>
          {children}
        </StorageProvider>
      );

      const { result } = renderHook(() => useStorageInitialized(), {
        wrapper,
      });

      expect(result.current).toBe(true);
    });

    it("should return false when storage is not initialized", () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <StorageProvider storage={storage} initialized={false}>
          {children}
        </StorageProvider>
      );

      const { result } = renderHook(() => useStorageInitialized(), {
        wrapper,
      });

      expect(result.current).toBe(false);
    });

    it("should return false when used outside provider", () => {
      const { result } = renderHook(() => useStorageInitialized());

      expect(result.current).toBe(false);
    });

    it("should update when initialized prop changes", () => {
      let initialized = false;
      const TestWrapper = ({ children }: { children: React.ReactNode }) => (
        <StorageProvider storage={storage} initialized={initialized}>
          {children}
        </StorageProvider>
      );

      const { result, rerender } = renderHook(() => useStorageInitialized(), {
        wrapper: TestWrapper,
      });

      expect(result.current).toBe(false);

      // Update the initialized value and rerender
      initialized = true;
      rerender();

      expect(result.current).toBe(true);
    });
  });

  describe("integration", () => {
    it("should work with multiple hooks in same component", () => {
      const TestComponent = () => {
        const storage = useStorage<TestSchema>();
        const isInitialized = useStorageInitialized();
        const name = storage.get("name");

        return (
          <div>
            <span data-testid="initialized">{isInitialized ? "yes" : "no"}</span>
            <span data-testid="name">{name}</span>
          </div>
        );
      };

      const { getByTestId } = render(
        <StorageProvider storage={storage} initialized={true}>
          <TestComponent />
        </StorageProvider>
      );

      expect(getByTestId("initialized").textContent).toBe("yes");
      expect(getByTestId("name").textContent).toBe("default");
    });

    it("should work with nested providers", async () => {
      // Create a schema with different defaults for inner storage
      const innerSchema = z.object({
        _version: z.number(),
        name: z.string().default("inner"),
        count: z.number().default(1),
      });
      
      const innerStorage = createPersistedState({
        schema: innerSchema,
        storageKey: "inner-storage",
        storage: createMemoryAdapter(),
        migrations: [],
        getCurrentVersion: () => 1,
        schemaHashes: { 1: "inner-hash" },
      });

      await innerStorage.init();

      const OuterComponent = () => {
        const storage = useStorage<TestSchema>();
        return <div data-testid="outer">{storage.get("name")}</div>;
      };

      const InnerComponent = () => {
        const storage = useStorage<TestSchema>();
        return <div data-testid="inner">{storage.get("name")}</div>;
      };

      const { getByTestId } = render(
        <StorageProvider storage={storage} initialized={true}>
          <OuterComponent />
          <StorageProvider storage={innerStorage} initialized={true}>
            <InnerComponent />
          </StorageProvider>
        </StorageProvider>
      );

      expect(getByTestId("outer").textContent).toBe("default");
      expect(getByTestId("inner").textContent).toBe("inner");
    });
  });
});
