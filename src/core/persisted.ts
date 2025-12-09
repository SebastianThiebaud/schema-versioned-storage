import { z } from 'zod';
import type { Migration } from '../types';
import { runMigrations } from './migrations';

/**
 * Storage adapter interface for abstracting storage operations
 */
export interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/**
 * Configuration for creating a persisted state
 */
export interface PersistedStateConfig<TSchema> {
  schema: z.ZodSchema<TSchema>;
  defaults: (version: number) => TSchema;
  storageKey: string;
  storage: StorageAdapter;
  migrations?: Migration<TSchema>[];
  getCurrentVersion: () => number;
  schemaHashes: Record<number, string>;
}

/**
 * Persisted state API
 */
export interface PersistedState<TSchema> {
  init(): Promise<void>;
  get<K extends keyof TSchema>(key: K): TSchema[K];
  set<K extends keyof TSchema>(key: K, value: TSchema[K]): Promise<void>;
  update<K extends keyof TSchema>(
    key: K,
    updater: (prev: TSchema[K]) => TSchema[K]
  ): Promise<void>;
  getAll(): TSchema;
  clear(): Promise<void>;
  getSchemaVersion(): number;
  getSchemaHash(): string;
  getSchemaHashForVersion(version: number): string | undefined;
}

/**
 * Create a persisted state instance
 */
export function createPersistedState<TSchema>(
  config: PersistedStateConfig<TSchema>
): PersistedState<TSchema> {
  const {
    schema,
    defaults,
    storageKey,
    storage,
    migrations = [],
    getCurrentVersion,
    schemaHashes,
  } = config;

  let state: TSchema | null = null;
  let currentVersion: number = getCurrentVersion();
  let initialized = false;

  /**
   * Initialize the persisted state
   * Loads from storage, validates, and runs migrations if needed
   */
  async function init(): Promise<void> {
    if (initialized) {
      return;
    }

    try {
      const stored = await storage.getItem(storageKey);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          const storedVersion = parsed._version ?? 0;

          // Check if we need to migrate
          if (storedVersion < currentVersion) {
            // Run migrations
            state = runMigrations(parsed, storedVersion, currentVersion, migrations);
          } else if (storedVersion === currentVersion) {
            // Validate schema hash if available
            const expectedHash = schemaHashes[currentVersion];
            if (expectedHash) {
              // Note: We can't easily recompute the hash from the stored data
              // The hash is computed at build time from the schema definition
              // We'll validate the schema structure instead
            }
            state = parsed;
          } else {
            // Stored version is newer than current - this shouldn't happen
            // but we'll use defaults to be safe
            state = defaults(currentVersion);
          }

          // Validate against schema
          state = schema.parse(state);
        } catch (error) {
          // Use defaults on error
          state = defaults(currentVersion);
        }
      } else {
        // No stored data, use defaults
        state = defaults(currentVersion);
      }
    } catch (error) {
      // Use defaults on error
      state = defaults(currentVersion);
    }

    // Ensure state has _version
    if (state && typeof state === 'object' && '_version' in state) {
      (state as any)._version = currentVersion;
    }

    initialized = true;
  }

  /**
   * Get a value from the state
   */
  function get<K extends keyof TSchema>(key: K): TSchema[K] {
    if (!initialized || !state) {
      throw new Error('PersistedState not initialized. Call init() first.');
    }
    return state[key];
  }

  /**
   * Set a value in the state
   */
  async function set<K extends keyof TSchema>(key: K, value: TSchema[K]): Promise<void> {
    if (!initialized || !state) {
      throw new Error('PersistedState not initialized. Call init() first.');
    }

    (state as any)[key] = value;

    // Validate the updated state
    const validated = schema.parse(state);
    state = validated;

    // Persist to storage
    try {
      await storage.setItem(storageKey, JSON.stringify(state));
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update a value in the state using an updater function
   */
  async function update<K extends keyof TSchema>(
    key: K,
    updater: (prev: TSchema[K]) => TSchema[K]
  ): Promise<void> {
    if (!initialized || !state) {
      throw new Error('PersistedState not initialized. Call init() first.');
    }

    const currentValue = state[key];
    const newValue = updater(currentValue);
    await set(key, newValue);
  }

  /**
   * Get all state
   */
  function getAll(): TSchema {
    if (!initialized || !state) {
      throw new Error('PersistedState not initialized. Call init() first.');
    }
    return state;
  }

  /**
   * Clear all state
   */
  async function clear(): Promise<void> {
    state = defaults(currentVersion);
    try {
      await storage.removeItem(storageKey);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get the current schema version
   */
  function getSchemaVersion(): number {
    return currentVersion;
  }

  /**
   * Get the schema hash for the current version
   */
  function getSchemaHash(): string {
    return schemaHashes[currentVersion] ?? '';
  }

  /**
   * Get the schema hash for a specific version
   */
  function getSchemaHashForVersion(version: number): string | undefined {
    return schemaHashes[version];
  }

  return {
    init,
    get,
    set,
    update,
    getAll,
    clear,
    getSchemaVersion,
    getSchemaHash,
    getSchemaHashForVersion,
  };
}

