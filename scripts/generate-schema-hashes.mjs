#!/usr/bin/env node

/**
 * Generate schema hashes file
 * 
 * Usage:
 *   node generate-schema-hashes.mjs [--schema-file <file>] [--output-path <path>]
 * 
 * Or via config file:
 *   node generate-schema-hashes.mjs --config <config-file>
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

// Default configuration
const defaultConfig = {
  schemaFile: './src/schema.ts',
  outputPath: './src/schema-hashes.ts',
};

/**
 * Load configuration from package.json
 */
function loadPackageJsonConfig() {
  try {
    const { readFileSync } = require('fs');
    const packageJsonPath = resolve(process.cwd(), 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    
    if (packageJson.schemaVersionedStorage?.schema) {
      return {
        schemaFile: packageJson.schemaVersionedStorage.schema.file,
        outputPath: packageJson.schemaVersionedStorage.schema.hashesOutput,
      };
    }
    
    // Support flat format in package.json
    if (packageJson.schemaVersionedStorage) {
      return {
        schemaFile: packageJson.schemaVersionedStorage.schemaFile,
        outputPath: packageJson.schemaVersionedStorage.outputPath,
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
    if (packageJsonConfig.schemaFile) config.schemaFile = packageJsonConfig.schemaFile;
    if (packageJsonConfig.outputPath) config.outputPath = packageJsonConfig.outputPath;
  }

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--schema-file' && args[i + 1]) {
      config.schemaFile = args[i + 1];
      i++;
    } else if (args[i] === '--output-path' && args[i + 1]) {
      config.outputPath = args[i + 1];
      i++;
    } else if (args[i] === '--config' && args[i + 1]) {
      // Load config from file (overrides package.json)
      try {
        const { readFileSync } = require('fs');
        const configFile = readFileSync(resolve(args[i + 1]), 'utf-8');
        const fileConfig = JSON.parse(configFile);
        
        // Support both flat and nested config formats
        if (fileConfig.schema) {
          // Nested format: { schema: { file, hashesOutput } }
          if (fileConfig.schema.file) config.schemaFile = fileConfig.schema.file;
          if (fileConfig.schema.hashesOutput) config.outputPath = fileConfig.schema.hashesOutput;
        } else {
          // Flat format: { schemaFile, outputPath }
          if (fileConfig.schemaFile) config.schemaFile = fileConfig.schemaFile;
          if (fileConfig.outputPath) config.outputPath = fileConfig.outputPath;
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
 * Simple hash function (matches the one in utils/hash.ts)
 */
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Extract schema shape from Zod schema object
 * This is a simplified version that works with the compiled schema
 */
function extractSchemaShape(schema) {
  if (!schema || typeof schema !== 'object') {
    throw new Error('Invalid schema: must be a Zod object');
  }

  const shape = schema.shape || schema._def?.shape?.();
  if (!shape) {
    throw new Error('Schema does not have a shape property');
  }

  const keys = Object.keys(shape).sort();
  const shapeString = keys
    .map((key) => {
      const fieldSchema = shape[key];
      const typeName = getTypeName(fieldSchema);
      return `${key}:${typeName}`;
    })
    .join(',');

  return `{${shapeString}}`;
}

/**
 * Get type name from Zod schema
 */
function getTypeName(schema) {
  if (!schema || typeof schema !== 'object') {
    return 'unknown';
  }

  const typeName = schema.constructor?.name || schema._def?.typeName;
  if (!typeName) {
    return 'unknown';
  }

  // Handle common Zod types
  if (typeName === 'ZodString') return 'string';
  if (typeName === 'ZodNumber') return 'number';
  if (typeName === 'ZodBoolean') return 'boolean';
  if (typeName === 'ZodNull') return 'null';
  if (typeName === 'ZodUndefined') return 'undefined';
  if (typeName === 'ZodArray') {
    const element = schema._def?.type || schema.element;
    return `array<${getTypeName(element)}>`;
  }
  if (typeName === 'ZodObject') {
    const shape = schema._def?.shape?.() || schema.shape;
    if (shape) {
      const keys = Object.keys(shape).sort();
      return `object{${keys.map((k) => `${k}:${getTypeName(shape[k])}`).join(',')}}`;
    }
    return 'object';
  }
  if (typeName === 'ZodOptional') {
    const inner = schema._def?.innerType || schema._def?.type;
    return `optional<${getTypeName(inner)}>`;
  }
  if (typeName === 'ZodNullable') {
    const inner = schema._def?.innerType || schema._def?.type;
    return `nullable<${getTypeName(inner)}>`;
  }
  if (typeName === 'ZodDefault') {
    const inner = schema._def?.innerType || schema._def?.type;
    return `default<${getTypeName(inner)}>`;
  }
  if (typeName === 'ZodEnum') {
    const values = schema._def?.values || schema.options || [];
    return `enum[${values.join(',')}]`;
  }
  if (typeName === 'ZodLiteral') {
    const value = schema._def?.value || schema.value;
    return `literal<${value}>`;
  }

  return typeName.toLowerCase().replace('zod', '');
}

/**
 * Generate schema hashes for all versions
 * This function needs to import the schema and compute hashes
 */
async function generateSchemaHashes(schemaFile, outputPath) {
  const schemaPath = resolve(process.cwd(), schemaFile);

  try {
    // Try to import the schema file and compute hash
    let hash;
    let schemaModule;
    const isTypeScript = schemaPath.endsWith('.ts') || schemaPath.endsWith('.tsx');
    
    if (isTypeScript) {
      // For TypeScript files, use tsx via npx to import and compute hash
      try {
        const { execSync } = require('child_process');
        const { writeFileSync, unlinkSync, existsSync } = require('fs');
        const { join } = require('path');
        const os = require('os');
        
        // Get package name - try to detect from installed package or use default
        let packageName = '@sebastianthiebaud/schema-versioned-storage';
        try {
          // Try to find the package in node_modules
          const fs = require('fs');
          const path = require('path');
          const nodeModulesPath = path.join(process.cwd(), 'node_modules');
          
          // Try scoped package first
          let pkgPath = path.join(nodeModulesPath, '@sebastianthiebaud', 'schema-versioned-storage', 'package.json');
          if (!fs.existsSync(pkgPath)) {
            // Try unscoped
            pkgPath = path.join(nodeModulesPath, 'schema-versioned-storage', 'package.json');
          }
          
          if (fs.existsSync(pkgPath)) {
            const installedPkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
            packageName = installedPkg.name;
          }
        } catch {
          // Use default
        }
        
        // Use tsx to import and compute hash inline
        const pathUtil = require('path');
        const fs = require('fs');
        let tsxCommand = 'npx --yes tsx';
        
        // Check for tsx in local node_modules
        const localTsx = pathUtil.join(process.cwd(), 'node_modules', '.bin', 'tsx');
        if (fs.existsSync(localTsx)) {
          tsxCommand = localTsx;
        } else {
          // Try global tsx
          try {
            execSync('tsx --version', { stdio: 'ignore' });
            tsxCommand = 'tsx';
          } catch {
            // Use npx
          }
        }
        
        // Use relative path for import
        const relativeSchemaPath = pathUtil.relative(process.cwd(), schemaPath).replace(/\\/g, '/');
        const importPath = relativeSchemaPath.startsWith('.') ? relativeSchemaPath : `./${relativeSchemaPath}`;
        
        // Use tsx -e to execute inline code
        const inlineScript = `import { persistedSchema } from '${importPath}'; import { hashSchema } from '${packageName}'; console.log(JSON.stringify({ hash: hashSchema(persistedSchema) }));`;
        
        try {
          // Use exec with timeout wrapper
          const { exec } = require('child_process');
          const timeout = 10000; // 10 seconds
          
          // Escape the inline script for shell - use double quotes and escape internal quotes
          const escapedScript = inlineScript.replace(/"/g, '\\"');
          // Use shell to handle complex commands like 'npx --yes tsx'
          const fullCommand = `${tsxCommand} -e "${escapedScript}"`;
          
          // Wrap exec in a promise with timeout
          const output = await new Promise((resolve, reject) => {
            let timeoutId;
            let childProcess;
            
            const cleanup = () => {
              if (timeoutId) clearTimeout(timeoutId);
              if (childProcess) {
                try {
                  childProcess.kill();
                } catch (e) {
                  // Ignore kill errors
                }
              }
            };
            
            // Set up timeout
            timeoutId = setTimeout(() => {
              cleanup();
              reject(new Error('Execution timeout'));
            }, timeout);
            
            // Execute command
            childProcess = exec(
              fullCommand,
              {
                cwd: process.cwd(),
                encoding: 'utf-8',
                maxBuffer: 10 * 1024 * 1024, // 10MB
              },
              (error, stdout, stderr) => {
                cleanup();
                if (error) {
                  reject(error);
                } else {
                  resolve(stdout.trim());
                }
              }
            );
          });
          
          if (output) {
            const data = JSON.parse(output);
            hash = data.hash;
          } else {
            throw new Error('No output from tsx script');
          }
        } catch (execError) {
          // If tsx fails, try ts-node as fallback
          try {
            require('ts-node/register');
            delete require.cache[schemaPath];
            schemaModule = require(schemaPath);
          } catch (tsNodeError) {
            // Log the error for debugging
            const errorMsg = execError.message || String(execError);
            console.warn('Could not import TypeScript schema using tsx.');
            if (errorMsg && !errorMsg.includes('tsx') && !errorMsg.includes('timeout')) {
              console.warn('Error:', errorMsg.substring(0, 200));
            }
            console.warn('Please install tsx: npm install --save-dev tsx');
            console.warn('Or install ts-node: npm install --save-dev ts-node');
            console.warn('Creating a template file that you can fill in manually.');
            return generateTemplate(outputPath);
          }
        }
      } catch (tsxError) {
        // Fall back to ts-node if available
        try {
          require('ts-node/register');
          delete require.cache[schemaPath];
          schemaModule = require(schemaPath);
        } catch (tsNodeError) {
          console.warn(
            'Could not import TypeScript schema. Please install tsx: npm install --save-dev tsx'
          );
          console.warn('Or install ts-node: npm install --save-dev ts-node');
          console.warn('Creating a template file that you can fill in manually.');
          return generateTemplate(outputPath);
        }
      }
    } else {
      // JavaScript file - try direct require
      try {
        schemaModule = require(schemaPath);
      } catch (e) {
        console.warn('Could not import schema file.');
        return generateTemplate(outputPath);
      }
    }

    // If we don't have a hash yet, compute it from the schema
    if (!hash) {
      const schema = schemaModule.persistedSchema || schemaModule.schema || schemaModule.default;
      if (!schema) {
        throw new Error('Schema not found in file. Expected export named "persistedSchema", "schema", or default.');
      }

      // Compute hash using the shape extraction
      const shape = extractSchemaShape(schema);
      hash = simpleHash(shape);
    }

    // Read existing hashes to preserve previous versions
    let existingHashes = {};
    try {
      const existingContent = await readFile(outputPath, 'utf-8');
      // Extract existing hashes using regex
      const matches = existingContent.matchAll(/(\d+):\s*['"]([^'"]+)['"]/g);
      for (const match of matches) {
        existingHashes[Number(match[1])] = match[2];
      }
    } catch {
      // File doesn't exist yet, start fresh
    }

    // Try to get current version from migrations if available
    let currentVersion = 1;
    try {
      // Try to find migrations index to get current version
      const migrationsIndexPath = resolve(process.cwd(), schemaFile.replace(/schema\.ts$/, 'migrations/index.ts'));
      try {
        const migrationsContent = await readFile(migrationsIndexPath, 'utf-8');
        // Try to extract version from getCurrentSchemaVersion or registry
        const versionMatch = migrationsContent.match(/getCurrentSchemaVersion\(\)[^}]*return\s+Math\.max\([^)]+\)/);
        if (versionMatch) {
          // Try to require and call it
          try {
            require('ts-node/register');
            const migrationsModule = require(migrationsIndexPath);
            if (typeof migrationsModule.getCurrentSchemaVersion === 'function') {
              currentVersion = migrationsModule.getCurrentSchemaVersion();
            }
          } catch {
            // Fall back to counting registry entries
            const registryMatches = migrationsContent.matchAll(/registry\.set\((\d+),/g);
            const versions = Array.from(registryMatches, m => Number(m[1]));
            if (versions.length > 0) {
              currentVersion = Math.max(...versions);
            }
          }
        } else {
          // Count registry entries as fallback
          const registryMatches = migrationsContent.matchAll(/registry\.set\((\d+),/g);
          const versions = Array.from(registryMatches, m => Number(m[1]));
          if (versions.length > 0) {
            currentVersion = Math.max(...versions);
          }
        }
      } catch {
        // Migrations file not found or can't be read
      }
    } catch {
      // Couldn't determine version, use 1
    }

    // Update hash for current version
    existingHashes[currentVersion] = hash;

    // Generate file content with all versions
    const versions = Object.keys(existingHashes)
      .map(Number)
      .sort((a, b) => a - b);

    const hashesContent = versions
      .map((v) => `  ${v}: '${existingHashes[v]}', // Hash for version ${v}`)
      .join('\n');

    const content = `/**
 * Schema hashes for each version
 *
 * This file is AUTO-GENERATED by scripts/generate-schema-hashes.mjs
 * DO NOT EDIT MANUALLY - run \`npm run generate:schema-hashes\` to regenerate
 *
 * This tracks the schema hash for each version to detect schema changes.
 * When the schema changes, the hash changes, and a migration is required.
 */

/**
 * Expected schema hash for each version
 * Format: version -> schema hash at that version
 */
export const SCHEMA_HASHES_BY_VERSION: Record<number, string> = {
${hashesContent}
};
`;

    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, content, 'utf-8');
    console.log(`Generated schema hashes file: ${outputPath}`);
    console.log(`Hash for version ${currentVersion}: ${hash}`);
  } catch (error) {
    console.error('Error generating schema hashes:', error);
    // Generate template as fallback
    return generateTemplate(outputPath);
  }
}

/**
 * Generate a template file
 */
async function generateTemplate(outputPath) {
  const content = `// Auto-generated file - do not edit manually
// Run: npm run generate:schema-hashes
//
// Note: This is a template. You may need to manually update this file
// with hashes for all schema versions.

export const SCHEMA_HASHES_BY_VERSION: Record<number, string> = {
  1: 'hash1',
  // Add more versions as needed
};
`;

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, content, 'utf-8');
  console.log(`Generated template file: ${outputPath}`);
  console.log('Please update this file with the correct hashes for your schema versions.');
}

/**
 * Main function
 */
async function main() {
  const config = parseArgs();
  const schemaFile = resolve(process.cwd(), config.schemaFile);
  const outputPath = resolve(process.cwd(), config.outputPath);

  console.log(`Reading schema file: ${schemaFile}`);
  await generateSchemaHashes(schemaFile, outputPath);
}

main().catch((error) => {
  console.error('Error generating schema hashes:', error);
  process.exit(1);
});

