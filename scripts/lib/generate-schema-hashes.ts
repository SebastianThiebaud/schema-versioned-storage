import { readFile, writeFile, mkdir } from "fs/promises";
import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

// Default configuration
export const defaultConfig = {
  schemaFile: "./src/schema.ts",
  outputPath: "./src/schema-hashes.ts",
};

export interface SchemaHashesConfig {
  schemaFile: string;
  outputPath: string;
}

/**
 * Load configuration from package.json
 */
export function loadPackageJsonConfig(
  cwd: string = process.cwd(),
): Partial<SchemaHashesConfig> | null {
  try {
    const packageJsonPath = resolve(cwd, "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));

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
export function parseArgs(
  args: string[] = process.argv.slice(2),
  cwd: string = process.cwd(),
): SchemaHashesConfig {
  // Start with defaults
  let config: SchemaHashesConfig = { ...defaultConfig };

  // Load from package.json if available (lowest priority)
  const packageJsonConfig = loadPackageJsonConfig(cwd);
  if (packageJsonConfig) {
    if (packageJsonConfig.schemaFile)
      config.schemaFile = packageJsonConfig.schemaFile;
    if (packageJsonConfig.outputPath)
      config.outputPath = packageJsonConfig.outputPath;
  }

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--schema-file" && args[i + 1]) {
      config.schemaFile = args[i + 1];
      i++;
    } else if (args[i] === "--output-path" && args[i + 1]) {
      config.outputPath = args[i + 1];
      i++;
    } else if (args[i] === "--config" && args[i + 1]) {
      // Load config from file (overrides package.json)
      try {
        const configFile = readFileSync(resolve(cwd, args[i + 1]), "utf-8");
        const fileConfig = JSON.parse(configFile);

        // Support both flat and nested config formats
        if (fileConfig.schema) {
          // Nested format: { schema: { file, hashesOutput } }
          if (fileConfig.schema.file)
            config.schemaFile = fileConfig.schema.file;
          if (fileConfig.schema.hashesOutput)
            config.outputPath = fileConfig.schema.hashesOutput;
        } else {
          // Flat format: { schemaFile, outputPath }
          if (fileConfig.schemaFile) config.schemaFile = fileConfig.schemaFile;
          if (fileConfig.outputPath) config.outputPath = fileConfig.outputPath;
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
 * Simple hash function (matches the one in utils/hash.ts)
 */
export function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Get type name from Zod schema
 */
export function getTypeName(schema: any): string {
  if (!schema || typeof schema !== "object") {
    return "unknown";
  }

  const typeName = schema.constructor?.name || schema._def?.typeName;
  if (!typeName) {
    return "unknown";
  }

  // Handle common Zod types
  if (typeName === "ZodString") return "string";
  if (typeName === "ZodNumber") return "number";
  if (typeName === "ZodBoolean") return "boolean";
  if (typeName === "ZodNull") return "null";
  if (typeName === "ZodUndefined") return "undefined";
  if (typeName === "ZodArray") {
    const element = schema._def?.type || schema.element;
    return `array<${getTypeName(element)}>`;
  }
  if (typeName === "ZodObject") {
    const shape = schema._def?.shape?.() || schema.shape;
    if (shape) {
      const keys = Object.keys(shape).sort();
      return `object{${keys.map((k) => `${k}:${getTypeName(shape[k])}`).join(",")}}`;
    }
    return "object";
  }
  if (typeName === "ZodOptional") {
    const inner = schema._def?.innerType || schema._def?.type;
    return `optional<${getTypeName(inner)}>`;
  }
  if (typeName === "ZodNullable") {
    const inner = schema._def?.innerType || schema._def?.type;
    return `nullable<${getTypeName(inner)}>`;
  }
  if (typeName === "ZodDefault") {
    const inner = schema._def?.innerType || schema._def?.type;
    return `default<${getTypeName(inner)}>`;
  }
  if (typeName === "ZodEnum") {
    const values = schema._def?.values || schema.options || [];
    return `enum[${values.join(",")}]`;
  }
  if (typeName === "ZodLiteral") {
    const value = schema._def?.value || schema.value;
    return `literal<${value}>`;
  }

  return typeName.toLowerCase().replace("zod", "");
}

/**
 * Extract schema shape from Zod schema object
 * This is a simplified version that works with the compiled schema
 */
export function extractSchemaShape(schema: any): string {
  if (!schema || typeof schema !== "object") {
    throw new Error("Invalid schema: must be a Zod object");
  }

  const shape = schema.shape || schema._def?.shape?.();
  if (!shape) {
    throw new Error("Schema does not have a shape property");
  }

  const keys = Object.keys(shape).sort();
  const shapeString = keys
    .map((key) => {
      const fieldSchema = shape[key];
      const typeName = getTypeName(fieldSchema);
      return `${key}:${typeName}`;
    })
    .join(",");

  return `{${shapeString}}`;
}

/**
 * Generate a template file
 */
export async function generateTemplate(outputPath: string): Promise<void> {
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
  await writeFile(outputPath, content, "utf-8");
}

/**
 * Generate schema hashes for all versions
 */
export async function generateSchemaHashes(
  schemaFile: string,
  outputPath: string,
  cwd: string = process.cwd(),
): Promise<void> {
  const schemaPath = resolve(cwd, schemaFile);

  try {
    // Try to import the schema file
    let schemaModule;
    try {
      // Try to require/import the schema
      // This might fail if TypeScript isn't compiled
      schemaModule = require(schemaPath.replace(/\.ts$/, ".js"));
    } catch (e) {
      // If that fails, try with ts-node
      try {
        require("ts-node/register");
        delete require.cache[schemaPath];
        schemaModule = require(schemaPath);
      } catch (e2) {
        // Generate template as fallback
        await generateTemplate(outputPath);
        return;
      }
    }

    const schema =
      schemaModule.persistedSchema ||
      schemaModule.schema ||
      schemaModule.default;
    if (!schema) {
      throw new Error(
        'Schema not found in file. Expected export named "persistedSchema", "schema", or default.',
      );
    }

    // Generate a hash for the current version
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
    await writeFile(outputPath, content, "utf-8");
  } catch (error) {
    // Generate template as fallback
    await generateTemplate(outputPath);
  }
}

/**
 * Main function
 */
export async function generateSchemaHashesFile(
  config?: SchemaHashesConfig,
  cwd: string = process.cwd(),
): Promise<void> {
  const finalConfig = config || parseArgs([], cwd);
  const schemaFile = resolve(cwd, finalConfig.schemaFile);
  const outputPath = resolve(cwd, finalConfig.outputPath);

  await generateSchemaHashes(schemaFile, outputPath, cwd);
}
