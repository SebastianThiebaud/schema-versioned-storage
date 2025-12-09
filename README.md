# schema-versioned-storage

Type-safe, versioned persisted state with automatic migrations for TypeScript applications.

## Features

- 🔒 **Type-safe**: Full TypeScript support with Zod schema validation
- 🔄 **Automatic migrations**: Seamlessly migrate between schema versions
- 💾 **Storage agnostic**: Works with AsyncStorage (React Native), localStorage (Web), or custom adapters
- 🎯 **Zero dependencies**: Only requires Zod (and optional peer dependencies for adapters)
- 🧪 **Test-friendly**: Includes memory adapter for testing
- 📦 **Tree-shakeable**: ES modules support

## Installation

```bash
npm install schema-versioned-storage zod
```

For React Native, also install:

```bash
npm install @react-native-async-storage/async-storage
```

## Quick Start

### 1. Define your schema

```typescript
// src/schema.ts
import { z } from 'zod';

export const persistedSchema = z.object({
  _version: z.number(),
  preferences: z.object({
    colorScheme: z.enum(['system', 'light', 'dark']).default('system'),
  }),
});

export type PersistedSchema = z.infer<typeof persistedSchema>;
```

### 2. Define defaults

```typescript
// src/defaults.ts
import type { PersistedSchema } from './schema';

export function createDefaults(version: number): PersistedSchema {
  return {
    _version: version,
    preferences: {
      colorScheme: 'system',
    },
  };
}
```

### 3. Create migrations (optional)

```typescript
// src/migrations/2-add-feature.ts
import type { Migration } from 'schema-versioned-storage';
import type { PersistedSchema } from '../schema';

const migration: Migration<PersistedSchema> = {
  metadata: {
    version: 2,
    description: 'Add new preferences field',
  },
  migrate: (state: unknown): PersistedSchema => {
    const oldState = state as any;
    return {
      ...oldState,
      _version: 2,
      preferences: {
        ...oldState.preferences,
        colorScheme: oldState.preferences?.colorScheme || 'system',
      },
    };
  },
};

export default migration;
```

### 4. Configure paths (optional)

Add configuration to your `package.json` to avoid passing paths every time:

```json
{
  "schemaVersionedStorage": {
    "schema": {
      "file": "./src/schema.ts",
      "hashesOutput": "./src/schema-hashes.ts"
    },
    "migrations": {
      "dir": "./src/migrations",
      "indexPath": "./src/migrations/index.ts",
      "typesPath": "schema-versioned-storage"
    }
  },
  "scripts": {
    "generate:migrations": "node node_modules/schema-versioned-storage/scripts/generate-migrations-index.mjs",
    "generate:schema-hashes": "node node_modules/schema-versioned-storage/scripts/generate-schema-hashes.mjs"
  }
}
```

**Note:** If you don't configure paths, the scripts will use defaults (`./src/...`). See the [Configuration](#configuration) section for all options.

### 5. Generate migrations index and schema hashes

Run the generation scripts:

```bash
npm run generate:migrations
npm run generate:schema-hashes
```

Or if you haven't added npm scripts, run directly:

```bash
node node_modules/schema-versioned-storage/scripts/generate-migrations-index.mjs
node node_modules/schema-versioned-storage/scripts/generate-schema-hashes.mjs
```

### 6. Initialize storage

```typescript
// src/storage.ts
import { createPersistedState } from 'schema-versioned-storage';
import { createAsyncStorageAdapter } from 'schema-versioned-storage/adapters/async-storage';
import { persistedSchema } from './schema';
import { createDefaults } from './defaults';
import { getMigrations, getCurrentSchemaVersion } from './migrations';
import { SCHEMA_HASHES_BY_VERSION } from './schema-hashes';

export const storage = createPersistedState({
  schema: persistedSchema,
  defaults: createDefaults,
  storageKey: 'MY_APP_STATE',
  storage: createAsyncStorageAdapter(),
  migrations: Array.from(getMigrations().values()),
  getCurrentVersion: getCurrentSchemaVersion,
  schemaHashes: SCHEMA_HASHES_BY_VERSION,
});

// Initialize in your app
await storage.init();
```

### 7. Use the storage

```typescript
// Get values
const colorScheme = storage.get('preferences').colorScheme;

// Set values
await storage.set('preferences', {
  colorScheme: 'dark',
});

// Update values
await storage.update('preferences', (prev) => ({
  ...prev,
  colorScheme: 'light',
}));

// Get all state
const allState = storage.getAll();
```

## API Reference

### `createPersistedState<TSchema>(config)`

Creates a persisted state instance.

**Parameters:**

- `schema`: Zod schema for your state
- `defaults`: Function that returns default values for a given version
- `storageKey`: Key to use in storage
- `storage`: Storage adapter instance
- `migrations`: Array of migrations (optional)
- `getCurrentVersion`: Function that returns the current schema version
- `schemaHashes`: Record mapping version numbers to schema hashes

**Returns:** `PersistedState<TSchema>`

### `PersistedState<TSchema>`

#### `init(): Promise<void>`

Initialize the storage. Must be called before using other methods.

#### `get<K>(key: K): TSchema[K]`

Get a value from the state.

#### `set<K>(key: K, value: TSchema[K]): Promise<void>`

Set a value in the state.

#### `update<K>(key: K, updater: (prev: TSchema[K]) => TSchema[K]): Promise<void>`

Update a value using an updater function.

#### `getAll(): TSchema`

Get all state.

#### `clear(): Promise<void>`

Clear all state and reset to defaults.

#### `getSchemaVersion(): number`

Get the current schema version.

#### `getSchemaHash(): string`

Get the schema hash for the current version.

#### `getSchemaHashForVersion(version: number): string | undefined`

Get the schema hash for a specific version.

## Storage Adapters

### AsyncStorage (React Native)

```typescript
import { createAsyncStorageAdapter } from 'schema-versioned-storage/adapters/async-storage';

const storage = createPersistedState({
  // ... other config
  storage: createAsyncStorageAdapter(),
});
```

### localStorage (Web)

```typescript
import { createLocalStorageAdapter } from 'schema-versioned-storage/adapters/local-storage';

const storage = createPersistedState({
  // ... other config
  storage: createLocalStorageAdapter(),
});
```

### Memory (Testing)

```typescript
import { createMemoryAdapter } from 'schema-versioned-storage/adapters/memory';

const storage = createPersistedState({
  // ... other config
  storage: createMemoryAdapter(),
});
```

### Custom Adapter

```typescript
import type { StorageAdapter } from 'schema-versioned-storage';

const customAdapter: StorageAdapter = {
  async getItem(key: string): Promise<string | null> {
    // Your implementation
  },
  async setItem(key: string, value: string): Promise<void> {
    // Your implementation
  },
  async removeItem(key: string): Promise<void> {
    // Your implementation
  },
};
```

## Migration System

Migrations are automatically run when the stored version is older than the current version. Migrations must be:

1. Named with the pattern: `{version}-{description}.ts` (e.g., `2-add-feature.ts`)
2. Export a default `Migration<TSchema>` object
3. Have sequential version numbers

Example migration:

```typescript
import type { Migration } from 'schema-versioned-storage';
import type { PersistedSchema } from '../schema';

const migration: Migration<PersistedSchema> = {
  metadata: {
    version: 2,
    description: 'Add new field',
  },
  migrate: (state: unknown): PersistedSchema => {
    const oldState = state as any;
    return {
      ...oldState,
      _version: 2,
      // Add your migration logic here
    };
  },
};

export default migration;
```

## Configuration

You can configure the paths for your schema, defaults, and migrations in several ways. Configuration priority (highest to lowest):

1. **CLI Arguments** (highest priority)
2. **Config File** (via `--config`)
3. **package.json** (if `schemaVersionedStorage` field exists)
4. **Defaults** (lowest priority)

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
    "defaults": {
      "file": "./lib/storage/defaults.ts"
    },
    "migrations": {
      "dir": "./lib/storage/migrations",
      "indexPath": "./lib/storage/migrations/index.ts",
      "typesPath": "schema-versioned-storage"
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
    "typesPath": "schema-versioned-storage"
  }
}
```

Then run the scripts without any arguments:

```bash
node node_modules/schema-versioned-storage/scripts/generate-migrations-index.mjs
node node_modules/schema-versioned-storage/scripts/generate-schema-hashes.mjs
```

Or add npm scripts to your `package.json`:

```json
{
  "scripts": {
    "generate:migrations": "node node_modules/schema-versioned-storage/scripts/generate-migrations-index.mjs",
    "generate:schema-hashes": "node node_modules/schema-versioned-storage/scripts/generate-schema-hashes.mjs"
  }
}
```

Then simply run:

```bash
npm run generate:migrations
npm run generate:schema-hashes
```

### Option 2: Using CLI Arguments

Pass paths directly as command-line arguments:

```bash
# Generate migrations index
node node_modules/schema-versioned-storage/scripts/generate-migrations-index.mjs \
  --migrations-dir ./lib/storage/migrations \
  --index-path ./lib/storage/migrations/index.ts \
  --types-path schema-versioned-storage

# Generate schema hashes
node node_modules/schema-versioned-storage/scripts/generate-schema-hashes.mjs \
  --schema-file ./lib/storage/schema.ts \
  --output-path ./lib/storage/schema-hashes.ts
```

### Option 3: Using a Config File

Create a `schema-versioned-storage.config.json` file in your project root. You can use either a **nested format** (recommended) or a **flat format**:

**Nested format (recommended):**
```json
{
  "schema": {
    "file": "./lib/storage/schema.ts",
    "hashesOutput": "./lib/storage/schema-hashes.ts"
  },
  "defaults": {
    "file": "./lib/storage/defaults.ts"
  },
  "migrations": {
    "dir": "./lib/storage/migrations",
    "indexPath": "./lib/storage/migrations/index.ts",
    "typesPath": "schema-versioned-storage"
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
  "typesPath": "schema-versioned-storage"
}
```

Then run the scripts with the config file:

```bash
node node_modules/schema-versioned-storage/scripts/generate-migrations-index.mjs \
  --config schema-versioned-storage.config.json

node node_modules/schema-versioned-storage/scripts/generate-schema-hashes.mjs \
  --config schema-versioned-storage.config.json
```

**Note:** The `defaults.file` field in the nested format is for documentation purposes only. The defaults file path is not used by the scripts, but you should keep it in sync with your actual defaults file location.

**Note:** CLI arguments will override values from `package.json` or config files.

### Default Paths

If no configuration is provided, the scripts use these defaults:

- **Schema file**: `./src/schema.ts`
- **Schema hashes output**: `./src/schema-hashes.ts`
- **Migrations directory**: `./src/migrations`
- **Migrations index**: `./src/migrations/index.ts`
- **Types path**: `schema-versioned-storage` (package name)

## Scripts

### Generate Migrations Index

Generates an index file that exports all migrations. The script scans the migrations directory for files matching the pattern `{version}-{description}.ts` and creates an index file.

**CLI Options:**
- `--migrations-dir <path>` - Directory containing migration files (default: `./src/migrations`)
- `--index-path <path>` - Output path for the index file (default: `./src/migrations/index.ts`)
- `--types-path <path>` - Path to import Migration types from (default: `schema-versioned-storage`)
- `--config <file>` - Path to a JSON config file

**Example:**
```bash
node node_modules/schema-versioned-storage/scripts/generate-migrations-index.mjs \
  --migrations-dir ./lib/storage/migrations \
  --index-path ./lib/storage/migrations/index.ts \
  --types-path schema-versioned-storage
```

### Generate Schema Hashes

Generates a file with schema hashes for each version. These hashes are used to detect schema changes.

**CLI Options:**
- `--schema-file <path>` - Path to your schema file (default: `./src/schema.ts`)
- `--output-path <path>` - Output path for schema hashes file (default: `./src/schema-hashes.ts`)
- `--config <file>` - Path to a JSON config file

**Example:**
```bash
node node_modules/schema-versioned-storage/scripts/generate-schema-hashes.mjs \
  --schema-file ./lib/storage/schema.ts \
  --output-path ./lib/storage/schema-hashes.ts
```

## Examples

See the `examples/` directory for complete examples:

- `basic-usage.ts` - Basic usage with memory adapter
- `react-native-usage.ts` - React Native usage with AsyncStorage

## Testing

The package includes a memory adapter perfect for testing:

```typescript
import { createMemoryAdapter } from 'schema-versioned-storage/adapters/memory';

const storage = createPersistedState({
  // ... config
  storage: createMemoryAdapter(),
});
```

## Type Safety

The package provides full type safety:

```typescript
// TypeScript knows the exact shape of your state
const colorScheme = storage.get('preferences').colorScheme; // ✅
const invalid = storage.get('nonexistent'); // ❌ TypeScript error

// Set operations are type-checked
await storage.set('preferences', { colorScheme: 'dark' }); // ✅
await storage.set('preferences', { invalid: 'value' }); // ❌ TypeScript error
```

## Releasing

This package uses GitHub Actions to automatically publish to npm when a new release is created on GitHub.

### Release Process

1. Update the version in `package.json` following [Semantic Versioning](https://semver.org/)
2. Update `CHANGELOG.md` with the changes
3. Commit and push your changes
4. Create a new release on GitHub:
   - Go to the repository's Releases page
   - Click "Create a new release"
   - Choose a tag (e.g., `v1.0.0`) - **Important**: The tag version must match the version in `package.json` (without the `v` prefix)
   - Fill in the release title and description
   - Click "Publish release"

The GitHub Action will automatically:
- Verify the version in `package.json` matches the release tag
- Run tests
- Build the package
- Publish to npm with provenance

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

