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
    // Try to import the schema file
    // Note: This requires the schema to be exported and the file to be transpiled
    // For now, we'll read the file and try to extract the schema
    const schemaContent = await readFile(schemaPath, 'utf-8');

    // Try to dynamically import if it's a .ts file (requires ts-node or similar)
    // For now, we'll use a simpler approach: require the user to provide a JS version
    // or we'll parse the TypeScript file

    // For this implementation, we'll create a template that the user needs to fill in
    // or we'll try to use ts-node if available
    let schemaModule;
    try {
      // Try to require/import the schema
      // This might fail if TypeScript isn't compiled
      schemaModule = require(schemaPath.replace(/\.ts$/, '.js'));
    } catch (e) {
      // If that fails, try with ts-node
      try {
        require('ts-node/register');
        delete require.cache[schemaPath];
        schemaModule = require(schemaPath);
      } catch (e2) {
        console.warn(
          'Could not directly import schema. Please ensure the schema file is compiled or ts-node is available.'
        );
        console.warn('Creating a template file that you can fill in manually.');
        return generateTemplate(outputPath);
      }
    }

    const schema = schemaModule.persistedSchema || schemaModule.schema || schemaModule.default;
    if (!schema) {
      throw new Error('Schema not found in file. Expected export named "persistedSchema", "schema", or default.');
    }

    // For now, we'll generate a hash for the current version
    // In a real implementation, you'd need to track all versions
    const shape = extractSchemaShape(schema);
    const hash = simpleHash(shape);

    const content = `// Auto-generated file - do not edit manually
// Run: npm run generate:schema-hashes

export const SCHEMA_HASHES_BY_VERSION: Record<number, string> = {
  1: '${hash}',
  // Add more versions as needed
};
`;

    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, content, 'utf-8');
    console.log(`Generated schema hashes file: ${outputPath}`);
    console.log(`Hash for version 1: ${hash}`);
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

