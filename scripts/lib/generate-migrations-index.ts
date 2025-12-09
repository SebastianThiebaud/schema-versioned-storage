import { readdir, readFile, writeFile, mkdir } from "fs/promises";
import { readFileSync } from "fs";
import { dirname, resolve } from "path";

// Default configuration
export const defaultConfig = {
  migrationsDir: "./src/migrations",
  indexPath: "./src/migrations/index.ts",
  typesPath: "schema-versioned-storage", // Use package name by default
};

export interface MigrationsConfig {
  migrationsDir: string;
  indexPath: string;
  typesPath: string;
}

/**
 * Load configuration from package.json
 */
export function loadPackageJsonConfig(
  cwd: string = process.cwd(),
): Partial<MigrationsConfig> | null {
  try {
    const packageJsonPath = resolve(cwd, "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));

    if (packageJson.schemaVersionedStorage?.migrations) {
      return {
        migrationsDir: packageJson.schemaVersionedStorage.migrations.dir,
        indexPath: packageJson.schemaVersionedStorage.migrations.indexPath,
        typesPath: packageJson.schemaVersionedStorage.migrations.typesPath,
      };
    }

    // Support flat format in package.json
    if (packageJson.schemaVersionedStorage) {
      return {
        migrationsDir: packageJson.schemaVersionedStorage.migrationsDir,
        indexPath: packageJson.schemaVersionedStorage.indexPath,
        typesPath: packageJson.schemaVersionedStorage.typesPath,
      };
    }
  } catch (error) {
    // package.json not found or invalid - ignore
  }
  return null;
}

/**
 * Parse command line arguments
 */
export function parseArgs(
  args: string[] = process.argv.slice(2),
  cwd: string = process.cwd(),
): MigrationsConfig {
  // Start with defaults
  let config: MigrationsConfig = { ...defaultConfig };

  // Load from package.json if available (lowest priority)
  const packageJsonConfig = loadPackageJsonConfig(cwd);
  if (packageJsonConfig) {
    if (packageJsonConfig.migrationsDir)
      config.migrationsDir = packageJsonConfig.migrationsDir;
    if (packageJsonConfig.indexPath)
      config.indexPath = packageJsonConfig.indexPath;
    if (packageJsonConfig.typesPath)
      config.typesPath = packageJsonConfig.typesPath;
  }

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--migrations-dir" && args[i + 1]) {
      config.migrationsDir = args[i + 1];
      i++;
    } else if (args[i] === "--index-path" && args[i + 1]) {
      config.indexPath = args[i + 1];
      i++;
    } else if (args[i] === "--types-path" && args[i + 1]) {
      config.typesPath = args[i + 1];
      i++;
    } else if (args[i] === "--config" && args[i + 1]) {
      // Load config from file (overrides package.json)
      try {
        const configFile = readFileSync(resolve(cwd, args[i + 1]), "utf-8");
        const fileConfig = JSON.parse(configFile);

        // Support both flat and nested config formats
        if (fileConfig.migrations) {
          // Nested format: { migrations: { dir, indexPath, typesPath } }
          if (fileConfig.migrations.dir)
            config.migrationsDir = fileConfig.migrations.dir;
          if (fileConfig.migrations.indexPath)
            config.indexPath = fileConfig.migrations.indexPath;
          if (fileConfig.migrations.typesPath)
            config.typesPath = fileConfig.migrations.typesPath;
        } else {
          // Flat format: { migrationsDir, indexPath, typesPath }
          if (fileConfig.migrationsDir)
            config.migrationsDir = fileConfig.migrationsDir;
          if (fileConfig.indexPath) config.indexPath = fileConfig.indexPath;
          if (fileConfig.typesPath) config.typesPath = fileConfig.typesPath;
        }
      } catch (error: any) {
        throw new Error(`Failed to load config file: ${error.message}`);
      }
      i++;
    }
  }

  return config;
}

/**
 * Find all migration files in the migrations directory
 */
export async function findMigrationFiles(
  migrationsDir: string,
): Promise<string[]> {
  try {
    const files = await readdir(migrationsDir);
    return files
      .filter((file) => /^\d+-.*\.ts$/.test(file))
      .sort((a, b) => {
        const aVersion = parseInt(a.split("-")[0], 10);
        const bVersion = parseInt(b.split("-")[0], 10);
        return aVersion - bVersion;
      });
  } catch (error: any) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

/**
 * Generate the index file content
 */
export function generateIndexContent(
  migrationFiles: string[],
  config: MigrationsConfig,
): string {
  const imports = migrationFiles.map((file, index) => {
    const fileName = file.replace(/\.ts$/, "");
    return `import migration${index} from './${fileName}';`;
  });

  const registryEntries = migrationFiles.map((file, index) => {
    const version = parseInt(file.split("-")[0], 10);
    return `  registry.set(${version}, migration${index});`;
  });

  // Use the package name for types import
  // Consumers can override this if they have their own types
  const typesPath = config.typesPath || "schema-versioned-storage";

  return `// Auto-generated file - do not edit manually
// Run: npm run generate:migrations

${imports.join("\n")}

import type { Migration } from '${typesPath}';

const registry = new Map<number, Migration>();

${registryEntries.join("\n")}

export function getMigrations(): Map<number, Migration> {
  return registry;
}

export function getCurrentSchemaVersion(): number {
  if (registry.size === 0) return 1;
  return Math.max(...Array.from(registry.keys()));
}
`;
}

/**
 * Main function
 */
export async function generateMigrationsIndex(
  config?: MigrationsConfig,
  cwd: string = process.cwd(),
): Promise<void> {
  const finalConfig = config || parseArgs([], cwd);
  const migrationsDir = resolve(cwd, finalConfig.migrationsDir);
  const indexPath = resolve(cwd, finalConfig.indexPath);

  const migrationFiles = await findMigrationFiles(migrationsDir);

  const content = generateIndexContent(migrationFiles, finalConfig);

  // Ensure directory exists
  await mkdir(dirname(indexPath), { recursive: true });

  // Write index file
  await writeFile(indexPath, content, "utf-8");
}
