#!/usr/bin/env node

/**
 * Generate migrations index file
 * 
 * Usage:
 *   node generate-migrations-index.mjs [--migrations-dir <dir>] [--index-path <path>] [--types-path <path>]
 * 
 * Or via config file:
 *   node generate-migrations-index.mjs --config <config-file>
 */

import { readdir, readFile, writeFile, mkdir } from 'fs/promises';
import { readFileSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Default configuration
const defaultConfig = {
  migrationsDir: './src/migrations',
  indexPath: './src/migrations/index.ts',
  typesPath: 'schema-versioned-storage', // Use package name by default
};

/**
 * Load configuration from package.json
 */
function loadPackageJsonConfig() {
  try {
    const packageJsonPath = resolve(process.cwd(), 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    
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
function parseArgs() {
  const args = process.argv.slice(2);
  
  // Start with defaults
  let config = { ...defaultConfig };
  
  // Load from package.json if available (lowest priority)
  const packageJsonConfig = loadPackageJsonConfig();
  if (packageJsonConfig) {
    if (packageJsonConfig.migrationsDir) config.migrationsDir = packageJsonConfig.migrationsDir;
    if (packageJsonConfig.indexPath) config.indexPath = packageJsonConfig.indexPath;
    if (packageJsonConfig.typesPath) config.typesPath = packageJsonConfig.typesPath;
  }

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--migrations-dir' && args[i + 1]) {
      config.migrationsDir = args[i + 1];
      i++;
    } else if (args[i] === '--index-path' && args[i + 1]) {
      config.indexPath = args[i + 1];
      i++;
    } else if (args[i] === '--types-path' && args[i + 1]) {
      config.typesPath = args[i + 1];
      i++;
    } else if (args[i] === '--config' && args[i + 1]) {
      // Load config from file (overrides package.json)
      try {
        const configFile = readFileSync(resolve(args[i + 1]), 'utf-8');
        const fileConfig = JSON.parse(configFile);
        
        // Support both flat and nested config formats
        if (fileConfig.migrations) {
          // Nested format: { migrations: { dir, indexPath, typesPath } }
          if (fileConfig.migrations.dir) config.migrationsDir = fileConfig.migrations.dir;
          if (fileConfig.migrations.indexPath) config.indexPath = fileConfig.migrations.indexPath;
          if (fileConfig.migrations.typesPath) config.typesPath = fileConfig.migrations.typesPath;
        } else {
          // Flat format: { migrationsDir, indexPath, typesPath }
          if (fileConfig.migrationsDir) config.migrationsDir = fileConfig.migrationsDir;
          if (fileConfig.indexPath) config.indexPath = fileConfig.indexPath;
          if (fileConfig.typesPath) config.typesPath = fileConfig.typesPath;
        }
      } catch (error) {
        console.error(`Failed to load config file: ${error.message}`);
        process.exit(1);
      }
      i++;
    }
  }

  return config;
}

/**
 * Find all migration files in the migrations directory
 */
async function findMigrationFiles(migrationsDir) {
  try {
    const files = await readdir(migrationsDir);
    return files
      .filter((file) => /^\d+-.*\.ts$/.test(file))
      .sort((a, b) => {
        const aVersion = parseInt(a.split('-')[0], 10);
        const bVersion = parseInt(b.split('-')[0], 10);
        return aVersion - bVersion;
      });
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.warn(`Migrations directory not found: ${migrationsDir}`);
      return [];
    }
    throw error;
  }
}

/**
 * Generate the index file content
 */
function generateIndexContent(migrationFiles, config) {
  const imports = migrationFiles.map((file, index) => {
    const fileName = file.replace(/\.ts$/, '');
    return `import migration${index} from './${fileName}';`;
  });

  const registryEntries = migrationFiles.map((file, index) => {
    const version = parseInt(file.split('-')[0], 10);
    return `  registry.set(${version}, migration${index});`;
  });

  // Use the package name for types import
  // Consumers can override this if they have their own types
  const typesPath = config.typesPath || 'schema-versioned-storage';

  return `// Auto-generated file - do not edit manually
// Run: npm run generate:migrations

${imports.join('\n')}

import type { Migration } from '${typesPath}';

const registry = new Map<number, Migration>();

${registryEntries.join('\n')}

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
async function main() {
  const config = parseArgs();
  const migrationsDir = resolve(process.cwd(), config.migrationsDir);
  const indexPath = resolve(process.cwd(), config.indexPath);

  console.log(`Scanning migrations directory: ${migrationsDir}`);
  const migrationFiles = await findMigrationFiles(migrationsDir);

  if (migrationFiles.length === 0) {
    console.warn('No migration files found. Creating empty index.');
  } else {
    console.log(`Found ${migrationFiles.length} migration(s):`);
    migrationFiles.forEach((file) => console.log(`  - ${file}`));
  }

  const content = generateIndexContent(migrationFiles, config);

  // Ensure directory exists
  await mkdir(dirname(indexPath), { recursive: true });

  // Write index file
  await writeFile(indexPath, content, 'utf-8');
  console.log(`Generated index file: ${indexPath}`);
}

main().catch((error) => {
  console.error('Error generating migrations index:', error);
  process.exit(1);
});

