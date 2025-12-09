import type { StorageAdapter } from "../core/persisted";

/**
 * Create a localStorage adapter for web browsers
 */
export function createLocalStorageAdapter(): StorageAdapter {
  if (typeof window === "undefined" || !window.localStorage) {
    throw new Error("localStorage is not available in this environment");
  }

  return {
    async getItem(key: string): Promise<string | null> {
      try {
        return window.localStorage.getItem(key);
      } catch (error) {
        return null;
      }
    },
    async setItem(key: string, value: string): Promise<void> {
      try {
        window.localStorage.setItem(key, value);
      } catch (error) {
        throw error;
      }
    },
    async removeItem(key: string): Promise<void> {
      try {
        window.localStorage.removeItem(key);
      } catch (error) {
        // Don't rethrow - removeItem failures are non-critical
      }
    },
  };
}
