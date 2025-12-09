import type { StorageAdapter } from "../core/persisted";

/**
 * Create a memory storage adapter (useful for testing)
 */
export function createMemoryAdapter(): StorageAdapter {
  const storage = new Map<string, string>();

  return {
    async getItem(key: string): Promise<string | null> {
      return storage.get(key) ?? null;
    },
    async setItem(key: string, value: string): Promise<void> {
      storage.set(key, value);
    },
    async removeItem(key: string): Promise<void> {
      storage.delete(key);
    },
  };
}
