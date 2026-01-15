# Documentation

Complete guide to `@sebastianthiebaud/schema-versioned-storage`.

## Table of Contents

- [Getting Started](#getting-started)
- [Core Concepts](#core-concepts)
- [API Reference](#api-reference)
- [Migration System](#migration-system)
- [Storage Adapters](#storage-adapters)
- [React Integration](#react-integration)
- [CLI Usage](#cli-usage)
- [Configuration](#configuration)
- [Advanced Patterns](#advanced-patterns)
- [Examples](#examples)
- [Troubleshooting](#troubleshooting)

---

## Getting Started

### Installation

```bash
npm install @sebastianthiebaud/schema-versioned-storage
```

Zod is automatically installed as a dependency.

### React Native Setup

If you're using React Native, install the AsyncStorage adapter:

```bash
npm install @react-native-async-storage/async-storage
```

### Basic Example

```typescript
import { z } from "zod";
import { createPersistedState } from "@sebastianthiebaud/schema-versioned-storage";
import { createLocalStorageAdapter } from "@sebastianthiebaud/schema-versioned-storage/adapters/local-storage";

// 1. Define your schema with inline defaults
const schema = z.object({
  _version: z.number(),
  preferences: z.object({
    colorScheme: z.enum(["system", "light", "dark"]),
  }).default({ colorScheme: "system" }),
});

// 2. Create storage instance
const storage = createPersistedState({
  schema,
  storageKey: "MY_APP_STATE",
  storage: createLocalStorageAdapter(),
  migrations: [],
  getCurrentVersion: () => 1,
  schemaHashes: { 1: "hash" },
});

// 3. Initialize and use
await storage.init();
await storage.set("preferences", { colorScheme: "dark" });
const theme = storage.get("preferences").colorScheme;
```

---

## Core Concepts

### Schema Definition

Your schema is a Zod object that defines the shape of your persisted state. The `_version` field is required and is automatically managed by the library.

**Key principles:**
- Use `.default()` on Zod fields to provide default values
- The `_version` field is automatically set at runtime
- Schema changes require migrations (see [Migration System](#migration-system))

### Storage Adapters

Storage adapters abstract the underlying storage mechanism. The library provides:
- `localStorage` (Web)
- `AsyncStorage` (React Native)
- `Memory` (Testing)

You can also create custom adapters (see [Storage Adapters](#storage-adapters)).

### Migrations

Migrations transform data from one schema version to another. They run automatically when the stored version is older than the current version.

### Schema Hashes

Schema hashes are used to detect schema changes and ensure data integrity. They're generated automatically by the CLI tool.

---

## API Reference

### `createPersistedState<TSchema>(config)`

Creates a persisted state instance.

**Type:**
```typescript
function createPersistedState<TSchema extends z.ZodTypeAny>(
  config: PersistedStateConfig<z.output<TSchema>>
): PersistedState<z.output<TSchema>>
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `schema` | `z.ZodType<TSchema>` | Zod schema with inline defaults |
| `storageKey` | `string` | Key to use in storage |
| `storage` | `StorageAdapter` | Storage adapter instance |
| `migrations` | `Migration<any>[]` | Array of migrations (optional) |
| `getCurrentVersion` | `() => number` | Function returning current schema version |
| `schemaHashes` | `Record<number, string>` | Map of version numbers to schema hashes |

**Returns:** `PersistedState<TSchema>`

**Example:**
```typescript
const storage = createPersistedState({
  schema: mySchema,
  storageKey: "APP_STATE",
  storage: createLocalStorageAdapter(),
  migrations: [migration1, migration2],
  getCurrentVersion: () => 2,
  schemaHashes: { 1: "hash1", 2: "hash2" },
});
```

---

### `PersistedState<TSchema>`

The storage instance returned by `createPersistedState`.

#### `init(): Promise<void>`

Initialize the storage. Must be called before using other methods.

**Behavior:**
- Loads data from storage
- Validates against schema
- Runs migrations if needed
- Sets defaults for missing fields

**Example:**
```typescript
await storage.init();
```

#### `get<K>(key: K): TSchema[K]`

Get a value from the state using method-based access.

**Type:**
```typescript
get<K extends keyof TSchema>(key: K): TSchema[K]
```

**Example:**
```typescript
const colorScheme = storage.get("preferences").colorScheme;
```

**Note:** Returns the current in-memory state. Call `init()` first to load from storage.

#### `getAll(): TSchema`

Get all state as an object. Useful for property-based access or when you need multiple values.

**Type:**
```typescript
getAll(): TSchema
```

**Example:**
```typescript
// Property-based access
const { preferences } = storage.getAll();
const colorScheme = preferences.colorScheme;

// Or access directly
const colorScheme = storage.getAll().preferences.colorScheme;
```

#### `set<K>(key: K, value: TSchema[K]): Promise<void>`

Set a value in the state.

**Type:**
```typescript
set<K extends keyof TSchema>(key: K, value: TSchema[K]): Promise<void>
```

**Example:**
```typescript
await storage.set("preferences", {
  colorScheme: "dark",
  language: "en",
});
```

#### `update<K>(key: K, updater: (prev: TSchema[K]) => TSchema[K]): Promise<void>`

Update a value using an updater function.

**Type:**
```typescript
update<K extends keyof TSchema>(
  key: K,
  updater: (prev: TSchema[K]) => TSchema[K]
): Promise<void>
```

**Example:**
```typescript
await storage.update("preferences", (prev) => ({
  ...prev,
  colorScheme: "light",
}));
```

#### `clear(): Promise<void>`

Clear all state and reset to defaults.

**Example:**
```typescript
await storage.clear();
```

#### `getSchemaVersion(): number`

Get the current schema version.

**Returns:** Current version number

**Example:**
```typescript
const version = storage.getSchemaVersion(); // e.g., 2
```

#### `getSchemaHash(): string`

Get the schema hash for the current version.

**Returns:** Schema hash string

**Example:**
```typescript
const hash = storage.getSchemaHash();
```

#### `getSchemaHashForVersion(version: number): string | undefined`

Get the schema hash for a specific version.

**Parameters:**
- `version`: Version number

**Returns:** Schema hash string or `undefined` if version not found

**Example:**
```typescript
const hash = storage.getSchemaHashForVersion(1);
```

---

## Migration System

### Overview

Migrations allow you to evolve your schema over time without breaking existing user data. They run automatically when the stored version is older than the current version.

### Creating Migrations

Migrations must:
1. Be named with the pattern: `{version}-{description}.ts` (e.g., `2-add-feature.ts`)
2. Export a default `Migration<TSchema>` object
3. Have sequential version numbers

**Example migration:**

```typescript
// src/migrations/2-add-language.ts
import type { Migration } from "@sebastianthiebaud/schema-versioned-storage";
import type { PersistedSchema } from "../schema";

const migration: Migration<PersistedSchema> = {
  metadata: {
    version: 2,
    description: "Add language preference",
  },
  migrate: (state: unknown): PersistedSchema => {
    const oldState = state as any;
    return {
      ...oldState,
      _version: 2,
      preferences: {
        ...oldState.preferences,
        language: oldState.preferences?.language || "en", // Default for existing users
      },
    };
  },
};

export default migration;
```

### Migration Interface

```typescript
interface Migration<TSchema> {
  metadata: {
    version: number;
    description: string;
  };
  migrate: (state: unknown) => TSchema;
}
```

### Migration Execution

Migrations run in order from the stored version to the current version:

1. Load stored data
2. Check stored version vs current version
3. If stored version < current version:
   - Run migrations sequentially (stored version + 1 → current version)
   - Each migration receives the output of the previous migration
4. Validate migrated data against current schema
5. Save to storage

### Best Practices

1. **Always increment `_version`** in your migration
2. **Provide defaults** for new fields
3. **Preserve existing data** when possible
4. **Test migrations** with real data shapes
5. **Keep migrations simple** - complex logic should be in your app code

### Migration Examples

#### Adding a Field

```typescript
const migration: Migration<PersistedSchema> = {
  metadata: { version: 2, description: "Add theme field" },
  migrate: (state: unknown): PersistedSchema => {
    const old = state as any;
    return {
      ...old,
      _version: 2,
      preferences: {
        ...old.preferences,
        theme: "light", // New field with default
      },
    };
  },
};
```

#### Removing a Field

```typescript
const migration: Migration<PersistedSchema> = {
  metadata: { version: 3, description: "Remove deprecated field" },
  migrate: (state: unknown): PersistedSchema => {
    const old = state as any;
    const { deprecatedField, ...rest } = old;
    return {
      ...rest,
      _version: 3,
    };
  },
};
```

#### Renaming a Field

```typescript
const migration: Migration<PersistedSchema> = {
  metadata: { version: 4, description: "Rename colorScheme to theme" },
  migrate: (state: unknown): PersistedSchema => {
    const old = state as any;
    return {
      ...old,
      _version: 4,
      preferences: {
        theme: old.preferences?.colorScheme || "system", // Renamed
      },
    };
  },
};
```

---

## Storage Adapters

### Built-in Adapters

#### localStorage (Web)

```typescript
import { createLocalStorageAdapter } from "@sebastianthiebaud/schema-versioned-storage/adapters/local-storage";

const storage = createPersistedState({
  // ... other config
  storage: createLocalStorageAdapter(),
});
```

#### AsyncStorage (React Native)

```typescript
import { createAsyncStorageAdapter } from "@sebastianthiebaud/schema-versioned-storage/adapters/async-storage";

const storage = createPersistedState({
  // ... other config
  storage: createAsyncStorageAdapter(),
});
```

**Note:** Requires `@react-native-async-storage/async-storage` as a peer dependency.

#### Memory (Testing)

```typescript
import { createMemoryAdapter } from "@sebastianthiebaud/schema-versioned-storage/adapters/memory";

const storage = createPersistedState({
  // ... other config
  storage: createMemoryAdapter(),
});
```

Perfect for testing - data is stored in memory and cleared between tests.

### Custom Adapter

Implement the `StorageAdapter` interface:

```typescript
import type { StorageAdapter } from "@sebastianthiebaud/schema-versioned-storage";

const customAdapter: StorageAdapter = {
  async getItem(key: string): Promise<string | null> {
    // Your implementation
    return await myStorage.get(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    // Your implementation
    await myStorage.set(key, value);
  },
  async removeItem(key: string): Promise<void> {
    // Your implementation
    await myStorage.delete(key);
  },
};
```

**Example: IndexedDB Adapter**

```typescript
const indexedDBAdapter: StorageAdapter = {
  async getItem(key: string): Promise<string | null> {
    const db = await openDB("my-db", 1);
    const tx = db.transaction("store", "readonly");
    const store = tx.objectStore("store");
    return (await store.get(key)) || null;
  },
  async setItem(key: string, value: string): Promise<void> {
    const db = await openDB("my-db", 1);
    const tx = db.transaction("store", "readwrite");
    const store = tx.objectStore("store");
    await store.put(value, key);
  },
  async removeItem(key: string): Promise<void> {
    const db = await openDB("my-db", 1);
    const tx = db.transaction("store", "readwrite");
    const store = tx.objectStore("store");
    await store.delete(key);
  },
};
```

---

## React Integration

### Setup

The library provides React hooks for accessing storage from components without prop drilling.

```typescript
import { StorageProvider, useStorage } from "@sebastianthiebaud/schema-versioned-storage/react";
import { storage } from "./storage"; // Your storage instance
import { useEffect, useState } from "react";

function App() {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    storage.init().then(() => setInitialized(true));
  }, []);

  if (!initialized) return <div>Loading...</div>;

  return (
    <StorageProvider storage={storage} initialized={initialized}>
      <MyComponent />
    </StorageProvider>
  );
}
```

### `StorageProvider`

Provider component that makes the storage instance available to all child components.

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `storage` | `PersistedState<TSchema>` | The storage instance |
| `initialized` | `boolean` (optional) | Whether storage has been initialized |
| `children` | `ReactNode` | Child components |

### `useStorage<TSchema>(): PersistedState<TSchema>`

Hook to access the storage instance from any component within a `StorageProvider`.

**Returns:** The storage instance

**Throws:** Error if used outside of `StorageProvider`

**Example:**
```typescript
function MyComponent() {
  const storage = useStorage<PersistedSchema>();
  
  const colorScheme = storage.get("preferences").colorScheme;
  
  const handleChange = async () => {
    await storage.set("preferences", {
      ...storage.get("preferences"),
      colorScheme: "dark",
    });
  };

  return <button onClick={handleChange}>Toggle Theme</button>;
}
```

### `useStorageInitialized(): boolean`

Hook to check if storage has been initialized.

**Returns:** `true` if storage is initialized, `false` otherwise

**Example:**
```typescript
function MyComponent() {
  const initialized = useStorageInitialized();
  
  if (!initialized) {
    return <div>Loading...</div>;
  }
  
  // Use storage...
}
```

---

## CLI Usage

The `svs` CLI tool is included with the package and can be used directly with `npx`.

### Commands

#### `generate:migrations`

Generate the migrations index file that exports all your migrations.

```bash
npx svs generate:migrations
```

**Options:**
- `--migrations-dir <path>` - Directory containing migration files (default: `./src/migrations`)
- `--index-path <path>` - Output path for the index file (default: `./src/migrations/index.ts`)
- `--types-path <path>` - Path to import Migration types from (default: package name from `package.json`)
- `--config <file>` - Path to a JSON config file

**Example:**
```bash
npx svs generate:migrations \
  --migrations-dir ./lib/storage/migrations \
  --index-path ./lib/storage/migrations/index.ts \
  --types-path my-app
```

#### `generate:schema-hashes`

Generate schema hashes for version detection.

```bash
npx svs generate:schema-hashes
```

**Options:**
- `--schema-file <path>` - Path to your schema file (default: `./src/schema.ts`)
- `--output-path <path>` - Output path for schema hashes file (default: `./src/schema-hashes.ts`)
- `--config <file>` - Path to a JSON config file

**Example:**
```bash
npx svs generate:schema-hashes \
  --schema-file ./lib/storage/schema.ts \
  --output-path ./lib/storage/schema-hashes.ts
```

#### `generate:all`

Generate both migrations index and schema hashes at once.

```bash
npx svs generate:all
```

### Adding to package.json Scripts

You can add these commands to your `package.json` scripts:

```json
{
  "scripts": {
    "generate:migrations": "svs generate:migrations",
    "generate:schema-hashes": "svs generate:schema-hashes",
    "generate:all": "svs generate:all"
  }
}
```

Then run:
```bash
npm run generate:migrations
npm run generate:schema-hashes
```

---

## Configuration

You can configure paths for your schema and migrations in several ways. Configuration priority (highest to lowest):

1. **CLI Arguments** (highest priority)
2. **Config File** (via `--config`)
3. **package.json** (if `schemaVersionedStorage` field exists)
4. **Default paths** (lowest priority)

### Option 1: Using package.json (Recommended)

Add a `schemaVersionedStorage` field to your `package.json`:

**Nested format (recommended):**
```json
{
  "name": "my-app",
  "version": "1.0.0",
  "schemaVersionedStorage": {
    "schema": {
      "file": "./lib/storage/schema.ts",
      "hashesOutput": "./lib/storage/schema-hashes.ts"
    },
    "migrations": {
      "dir": "./lib/storage/migrations",
      "indexPath": "./lib/storage/migrations/index.ts",
      "typesPath": "my-app"
    }
  }
}
```

**Flat format (also supported):**
```json
{
  "name": "my-app",
  "version": "1.0.0",
  "schemaVersionedStorage": {
    "schemaFile": "./lib/storage/schema.ts",
    "outputPath": "./lib/storage/schema-hashes.ts",
    "migrationsDir": "./lib/storage/migrations",
    "indexPath": "./lib/storage/migrations/index.ts",
    "typesPath": "my-app"
  }
}
```

### Option 2: Using CLI Arguments

Pass paths directly as command-line arguments:

```bash
npx svs generate:migrations \
  --migrations-dir ./lib/storage/migrations \
  --index-path ./lib/storage/migrations/index.ts \
  --types-path my-app

npx svs generate:schema-hashes \
  --schema-file ./lib/storage/schema.ts \
  --output-path ./lib/storage/schema-hashes.ts
```

### Option 3: Using a Config File

Create a `schema-versioned-storage.config.json` file in your project root:

**Nested format (recommended):**
```json
{
  "schema": {
    "file": "./lib/storage/schema.ts",
    "hashesOutput": "./lib/storage/schema-hashes.ts"
  },
  "migrations": {
    "dir": "./lib/storage/migrations",
    "indexPath": "./lib/storage/migrations/index.ts",
    "typesPath": "my-app"
  }
}
```

**Flat format (also supported):**
```json
{
  "schemaFile": "./lib/storage/schema.ts",
  "outputPath": "./lib/storage/schema-hashes.ts",
  "migrationsDir": "./lib/storage/migrations",
  "indexPath": "./lib/storage/migrations/index.ts",
  "typesPath": "my-app"
}
```

Then run:
```bash
npx svs generate:migrations --config schema-versioned-storage.config.json
npx svs generate:schema-hashes --config schema-versioned-storage.config.json
```

### Default Paths

If no configuration is provided, the scripts use these defaults:

- **Schema file**: `./src/schema.ts`
- **Schema hashes output**: `./src/schema-hashes.ts`
- **Migrations directory**: `./src/migrations`
- **Migrations index**: `./src/migrations/index.ts`
- **Types path**: Automatically uses your package name from `package.json` (or `schema-versioned-storage` as fallback)

---

## Advanced Patterns

### Multiple Storage Instances

You can create multiple storage instances for different parts of your app:

```typescript
const userStorage = createPersistedState({
  schema: userSchema,
  storageKey: "USER_STATE",
  storage: createLocalStorageAdapter(),
  // ...
});

const settingsStorage = createPersistedState({
  schema: settingsSchema,
  storageKey: "SETTINGS_STATE",
  storage: createLocalStorageAdapter(),
  // ...
});
```

### Conditional Migrations

You can add conditional logic in migrations:

```typescript
const migration: Migration<PersistedSchema> = {
  metadata: { version: 3, description: "Conditional migration" },
  migrate: (state: unknown): PersistedSchema => {
    const old = state as any;
    const newState = { ...old, _version: 3 };
    
    // Only migrate if certain conditions are met
    if (old.someField === "old-value") {
      newState.someField = "new-value";
    }
    
    return newState;
  },
};
```

### Schema Validation in Migrations

Validate intermediate states in migrations:

```typescript
import { z } from "zod";

const oldSchema = z.object({
  _version: z.number(),
  // old schema shape
});

const migration: Migration<PersistedSchema> = {
  metadata: { version: 2, description: "Validated migration" },
  migrate: (state: unknown): PersistedSchema => {
    // Validate old state shape
    const oldState = oldSchema.parse(state);
    
    // Transform
    return {
      ...oldState,
      _version: 2,
      // new fields
    };
  },
};
```

### Error Handling

Handle errors during initialization:

```typescript
try {
  await storage.init();
} catch (error) {
  if (error instanceof z.ZodError) {
    // Schema validation failed
    console.error("Schema validation error:", error.errors);
    // Optionally clear storage and start fresh
    await storage.clear();
    await storage.init();
  } else {
    // Other errors (storage unavailable, etc.)
    console.error("Storage error:", error);
  }
}
```

---

## Examples

See the `examples/` directory for complete examples:

- `basic-usage.ts` - Basic usage with memory adapter
- `react-native-usage.ts` - React Native usage with AsyncStorage
- `react-hook-usage.tsx` - React hooks with StorageProvider and useStorage

### Basic Usage

```typescript
import { z } from "zod";
import { createPersistedState } from "@sebastianthiebaud/schema-versioned-storage";
import { createMemoryAdapter } from "@sebastianthiebaud/schema-versioned-storage/adapters/memory";

const schema = z.object({
  _version: z.number(),
  count: z.number().default(0),
});

const storage = createPersistedState({
  schema,
  storageKey: "COUNTER",
  storage: createMemoryAdapter(),
  migrations: [],
  getCurrentVersion: () => 1,
  schemaHashes: { 1: "hash" },
});

await storage.init();
await storage.set("count", storage.get("count") + 1);
console.log(storage.get("count")); // 1
```

### React Native Usage

```typescript
import { createAsyncStorageAdapter } from "@sebastianthiebaud/schema-versioned-storage/adapters/async-storage";

const storage = createPersistedState({
  schema,
  storageKey: "APP_STATE",
  storage: createAsyncStorageAdapter(),
  // ...
});
```

### React Hooks Usage

```typescript
import { StorageProvider, useStorage } from "@sebastianthiebaud/schema-versioned-storage/react";

function App() {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    storage.init().then(() => setInitialized(true));
  }, []);

  return (
    <StorageProvider storage={storage} initialized={initialized}>
      <Counter />
    </StorageProvider>
  );
}

function Counter() {
  const storage = useStorage<PersistedSchema>();
  const count = storage.get("count");

  return (
    <button onClick={() => storage.set("count", count + 1)}>
      Count: {count}
    </button>
  );
}
```

---

## Troubleshooting

### Schema Validation Errors

**Problem:** Getting Zod validation errors when loading data.

**Solutions:**
- Check that your schema matches the stored data shape
- Ensure migrations are running correctly
- Verify schema hashes are up to date
- Consider adding a migration to fix data shape issues

### Migrations Not Running

**Problem:** Migrations don't seem to be executing.

**Solutions:**
- Verify `getCurrentVersion()` returns the correct version
- Check that migrations are in the correct order
- Ensure migration files are named correctly (`{version}-{description}.ts`)
- Verify migrations are included in the migrations array

### Type Errors

**Problem:** TypeScript errors when using storage methods.

**Solutions:**
- Ensure your schema type is correctly inferred
- Use `z.output<typeof schema>` if needed
- Check that you're using the correct generic type parameter

### Storage Not Persisting

**Problem:** Data isn't persisting between app restarts.

**Solutions:**
- Verify `init()` is called before using storage
- Check that `set()` operations complete (await them)
- Ensure storage adapter is working correctly
- Check browser/device storage permissions

### React Native Issues

**Problem:** AsyncStorage adapter not working.

**Solutions:**
- Verify `@react-native-async-storage/async-storage` is installed
- Check that you're using the correct adapter import
- Ensure AsyncStorage is properly linked (if using older RN versions)

---

## License

MIT
