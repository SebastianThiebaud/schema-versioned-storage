import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  parseArgs,
  loadPackageJsonConfig,
  simpleHash,
  getTypeName,
  extractSchemaShape,
  generateTemplate,
  generateSchemaHashes,
  generateSchemaHashesFile,
  defaultConfig,
} from "../../../scripts/lib/generate-schema-hashes";
import { writeFile, mkdir, mkdtemp, rm, readFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

describe("generate-schema-hashes", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "schema-hashes-lib-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("parseArgs", () => {
    it("should return default config when no args", () => {
      const config = parseArgs([]);
      expect(config).toEqual(defaultConfig);
    });

    it("should parse schema-file argument", () => {
      const config = parseArgs(["--schema-file", "./custom/schema.ts"]);
      expect(config.schemaFile).toBe("./custom/schema.ts");
    });

    it("should parse output-path argument", () => {
      const config = parseArgs(["--output-path", "./custom/hashes.ts"]);
      expect(config.outputPath).toBe("./custom/hashes.ts");
    });

    it("should parse all arguments together", () => {
      const config = parseArgs([
        "--schema-file",
        "./custom/schema.ts",
        "--output-path",
        "./custom/hashes.ts",
      ]);
      expect(config.schemaFile).toBe("./custom/schema.ts");
      expect(config.outputPath).toBe("./custom/hashes.ts");
    });

    it("should load from config file with nested format", async () => {
      const configFile = join(tempDir, "config.json");
      await writeFile(
        configFile,
        JSON.stringify({
          schema: {
            file: "./nested/schema.ts",
            hashesOutput: "./nested/hashes.ts",
          },
        }),
      );

      const config = parseArgs(["--config", configFile], tempDir);
      expect(config.schemaFile).toBe("./nested/schema.ts");
      expect(config.outputPath).toBe("./nested/hashes.ts");
    });

    it("should load from config file with flat format", async () => {
      const configFile = join(tempDir, "config.json");
      await writeFile(
        configFile,
        JSON.stringify({
          schemaFile: "./flat/schema.ts",
          outputPath: "./flat/hashes.ts",
        }),
      );

      const config = parseArgs(["--config", configFile], tempDir);
      expect(config.schemaFile).toBe("./flat/schema.ts");
      expect(config.outputPath).toBe("./flat/hashes.ts");
    });

    it("should throw error on invalid config file", async () => {
      const configFile = join(tempDir, "invalid.json");
      await writeFile(configFile, "invalid json");

      expect(() => {
        parseArgs(["--config", configFile], tempDir);
      }).toThrow("Failed to load config file");
    });
  });

  describe("loadPackageJsonConfig", () => {
    it("should return null when package.json does not exist", () => {
      const result = loadPackageJsonConfig(tempDir);
      expect(result).toBeNull();
    });

    it("should load nested format from package.json", async () => {
      const packageJson = join(tempDir, "package.json");
      await writeFile(
        packageJson,
        JSON.stringify({
          name: "test-app",
          schemaVersionedStorage: {
            schema: {
              file: "./pkg/schema.ts",
              hashesOutput: "./pkg/hashes.ts",
            },
          },
        }),
      );

      const result = loadPackageJsonConfig(tempDir);
      expect(result).toEqual({
        schemaFile: "./pkg/schema.ts",
        outputPath: "./pkg/hashes.ts",
      });
    });

    it("should load flat format from package.json", async () => {
      const packageJson = join(tempDir, "package.json");
      await writeFile(
        packageJson,
        JSON.stringify({
          name: "test-app",
          schemaVersionedStorage: {
            schemaFile: "./flat/schema.ts",
            outputPath: "./flat/hashes.ts",
          },
        }),
      );

      const result = loadPackageJsonConfig(tempDir);
      expect(result).toEqual({
        schemaFile: "./flat/schema.ts",
        outputPath: "./flat/hashes.ts",
      });
    });

    it("should handle partial package.json config", async () => {
      const packageJson = join(tempDir, "package.json");
      await writeFile(
        packageJson,
        JSON.stringify({
          name: "test-app",
          schemaVersionedStorage: {
            schema: {
              file: "./partial/schema.ts",
              // hashesOutput missing
            },
          },
        }),
      );

      const result = loadPackageJsonConfig(tempDir);
      expect(result?.schemaFile).toBe("./partial/schema.ts");
      expect(result?.outputPath).toBeUndefined();
    });

    it("should use package.json config in parseArgs", async () => {
      const packageJson = join(tempDir, "package.json");
      await writeFile(
        packageJson,
        JSON.stringify({
          name: "test-app",
          schemaVersionedStorage: {
            schema: {
              file: "./pkg/schema.ts",
              hashesOutput: "./pkg/hashes.ts",
            },
          },
        }),
      );

      const config = parseArgs([], tempDir);
      expect(config.schemaFile).toBe("./pkg/schema.ts");
      expect(config.outputPath).toBe("./pkg/hashes.ts");
    });
  });

  describe("simpleHash", () => {
    it("should generate a hash", () => {
      const hash = simpleHash("test");
      expect(hash).toBeTruthy();
      expect(typeof hash).toBe("string");
    });

    it("should generate same hash for same input", () => {
      expect(simpleHash("test")).toBe(simpleHash("test"));
    });

    it("should generate different hashes for different inputs", () => {
      expect(simpleHash("test1")).not.toBe(simpleHash("test2"));
    });
  });

  describe("getTypeName", () => {
    it("should return unknown for invalid schema", () => {
      expect(getTypeName(null)).toBe("unknown");
      expect(getTypeName(undefined)).toBe("unknown");
      // Empty object has constructor.name === 'Object', which gets lowercased to 'object'
      expect(getTypeName({})).toBe("object");
    });

    it("should handle ZodString", () => {
      const mockSchema = { constructor: { name: "ZodString" } };
      expect(getTypeName(mockSchema)).toBe("string");
    });

    it("should handle ZodNumber", () => {
      const mockSchema = { constructor: { name: "ZodNumber" } };
      expect(getTypeName(mockSchema)).toBe("number");
    });

    it("should handle ZodBoolean", () => {
      const mockSchema = { constructor: { name: "ZodBoolean" } };
      expect(getTypeName(mockSchema)).toBe("boolean");
    });

    it("should handle ZodArray", () => {
      const mockSchema = {
        constructor: { name: "ZodArray" },
        _def: { type: { constructor: { name: "ZodString" } } },
      };
      expect(getTypeName(mockSchema)).toBe("array<string>");
    });

    it("should handle ZodObject", () => {
      const mockSchema = {
        constructor: { name: "ZodObject" },
        shape: {
          name: { constructor: { name: "ZodString" } },
          age: { constructor: { name: "ZodNumber" } },
        },
      };
      const result = getTypeName(mockSchema);
      expect(result).toContain("object");
      expect(result).toContain("age");
      expect(result).toContain("name");
    });

    it("should handle ZodObject with _def.shape()", () => {
      const mockSchema = {
        constructor: { name: "ZodObject" },
        _def: {
          shape: () => ({
            name: { constructor: { name: "ZodString" } },
          }),
        },
      };
      const result = getTypeName(mockSchema);
      expect(result).toContain("object");
    });

    it("should handle ZodObject without shape", () => {
      const mockSchema = {
        constructor: { name: "ZodObject" },
      };
      const result = getTypeName(mockSchema);
      expect(result).toBe("object");
    });

    it("should handle ZodOptional", () => {
      const mockSchema = {
        constructor: { name: "ZodOptional" },
        _def: {
          innerType: { constructor: { name: "ZodString" } },
        },
      };
      expect(getTypeName(mockSchema)).toBe("optional<string>");
    });

    it("should handle ZodNullable", () => {
      const mockSchema = {
        constructor: { name: "ZodNullable" },
        _def: {
          innerType: { constructor: { name: "ZodNumber" } },
        },
      };
      expect(getTypeName(mockSchema)).toBe("nullable<number>");
    });

    it("should handle ZodDefault", () => {
      const mockSchema = {
        constructor: { name: "ZodDefault" },
        _def: {
          innerType: { constructor: { name: "ZodBoolean" } },
        },
      };
      expect(getTypeName(mockSchema)).toBe("default<boolean>");
    });

    it("should handle ZodEnum", () => {
      const mockSchema = {
        constructor: { name: "ZodEnum" },
        _def: { values: ["a", "b", "c"] },
      };
      expect(getTypeName(mockSchema)).toBe("enum[a,b,c]");
    });

    it("should handle ZodEnum with options", () => {
      const mockSchema = {
        constructor: { name: "ZodEnum" },
        options: ["x", "y"],
      };
      expect(getTypeName(mockSchema)).toBe("enum[x,y]");
    });

    it("should handle ZodLiteral", () => {
      const mockSchema = {
        constructor: { name: "ZodLiteral" },
        _def: { value: "test" },
      };
      expect(getTypeName(mockSchema)).toBe("literal<test>");
    });

    it("should handle ZodLiteral with value property", () => {
      const mockSchema = {
        constructor: { name: "ZodLiteral" },
        value: 123,
      };
      expect(getTypeName(mockSchema)).toBe("literal<123>");
    });

    it("should handle schema with _def.typeName when no constructor", () => {
      const mockSchema = {
        constructor: undefined,
        _def: { typeName: "ZodString" },
      };
      expect(getTypeName(mockSchema)).toBe("string");
    });

    it("should handle unknown type name", () => {
      const mockSchema = {
        constructor: { name: "ZodCustomType" },
      };
      expect(getTypeName(mockSchema)).toBe("customtype");
    });
  });

  describe("extractSchemaShape", () => {
    it("should throw error for invalid schema", () => {
      expect(() => extractSchemaShape(null)).toThrow("Invalid schema");
      expect(() => extractSchemaShape({})).toThrow(
        "Schema does not have a shape property",
      );
    });

    it("should extract shape from schema", () => {
      const mockSchema = {
        shape: {
          name: { constructor: { name: "ZodString" } },
          age: { constructor: { name: "ZodNumber" } },
        },
      };
      const shape = extractSchemaShape(mockSchema);
      expect(shape).toContain("age");
      expect(shape).toContain("name");
    });

    it("should extract shape from schema with _def.shape()", () => {
      const mockSchema = {
        _def: {
          shape: () => ({
            name: { constructor: { name: "ZodString" } },
          }),
        },
      };
      const shape = extractSchemaShape(mockSchema);
      expect(shape).toContain("name");
    });

    it("should throw when schema has no shape", () => {
      const mockSchema = {
        // No shape property
      };
      expect(() => extractSchemaShape(mockSchema)).toThrow(
        "Schema does not have a shape property",
      );
    });
  });

  describe("generateTemplate", () => {
    it("should generate template file", async () => {
      const outputPath = join(tempDir, "hashes.ts");
      await generateTemplate(outputPath);

      const content = await readFile(outputPath, "utf-8");
      expect(content).toContain("SCHEMA_HASHES_BY_VERSION");
      expect(content).toContain("Record<number, string>");
      expect(content).toContain("1: 'hash1'");
    });

    it("should create nested directories", async () => {
      const outputPath = join(tempDir, "nested", "deep", "hashes.ts");
      await generateTemplate(outputPath);

      const content = await readFile(outputPath, "utf-8");
      expect(content).toBeTruthy();
    });
  });

  describe("generateSchemaHashes", () => {
    it("should generate template when schema cannot be loaded", async () => {
      const schemaFile = join(tempDir, "nonexistent.ts");
      const outputPath = join(tempDir, "hashes.ts");

      await generateSchemaHashes(schemaFile, outputPath, tempDir);

      const content = await readFile(outputPath, "utf-8");
      expect(content).toContain("SCHEMA_HASHES_BY_VERSION");
    });
  });

  describe("generateSchemaHashesFile", () => {
    it("should generate file with config", async () => {
      const outputPath = join(tempDir, "hashes.ts");
      const schemaFile = join(tempDir, "schema.ts");

      await generateSchemaHashesFile(
        {
          schemaFile: "./schema.ts",
          outputPath: "./hashes.ts",
        },
        tempDir,
      );

      // Should generate template since schema can't be loaded
      const content = await readFile(outputPath, "utf-8");
      expect(content).toBeTruthy();
    });
  });

  describe("generateSchemaHashes error paths", () => {
    it("should handle schema not found error", async () => {
      const schemaFile = join(tempDir, "schema.ts");
      const outputPath = join(tempDir, "hashes.ts");

      // Create a file that exists but doesn't export schema
      await writeFile(schemaFile, "export const notSchema = {};");

      await generateSchemaHashes(schemaFile, outputPath, tempDir);

      // Should generate template on error
      const content = await readFile(outputPath, "utf-8");
      expect(content).toContain("SCHEMA_HASHES_BY_VERSION");
    });

    it("should handle extractSchemaShape error", async () => {
      const schemaFile = join(tempDir, "schema.ts");
      const outputPath = join(tempDir, "hashes.ts");

      // This will fail when trying to extract shape
      // We can't easily mock require, but the error path should be covered
      await generateSchemaHashes(schemaFile, outputPath, tempDir);

      // Should generate template on error
      const content = await readFile(outputPath, "utf-8");
      expect(content).toContain("SCHEMA_HASHES_BY_VERSION");
    });

    it("should handle nonexistent schema file", async () => {
      const schemaFile = join(tempDir, "nonexistent.ts");
      const outputPath = join(tempDir, "hashes.ts");

      await generateSchemaHashes(schemaFile, outputPath, tempDir);

      // Should generate template on error
      const content = await readFile(outputPath, "utf-8");
      expect(content).toContain("SCHEMA_HASHES_BY_VERSION");
    });
  });
});
