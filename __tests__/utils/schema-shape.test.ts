import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  extractSchemaShape,
  getTypeString,
  hashSchema,
} from "../../src/utils/schema-shape";

describe("getTypeString", () => {
  it("should return correct type for string", () => {
    expect(getTypeString(z.string())).toBe("string");
  });

  it("should return correct type for number", () => {
    expect(getTypeString(z.number())).toBe("number");
  });

  it("should return correct type for boolean", () => {
    expect(getTypeString(z.boolean())).toBe("boolean");
  });

  it("should return correct type for null", () => {
    expect(getTypeString(z.null())).toBe("null");
  });

  it("should return correct type for undefined", () => {
    expect(getTypeString(z.undefined())).toBe("undefined");
  });

  it("should return correct type for array", () => {
    expect(getTypeString(z.array(z.string()))).toBe("array<string>");
  });

  it("should return correct type for object", () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    });
    const typeStr = getTypeString(schema);
    expect(typeStr).toContain("object");
    expect(typeStr).toContain("age:number");
    expect(typeStr).toContain("name:string");
  });

  it("should return correct type for optional", () => {
    expect(getTypeString(z.string().optional())).toBe("optional<string>");
  });

  it("should return correct type for nullable", () => {
    expect(getTypeString(z.string().nullable())).toBe("nullable<string>");
  });

  it("should return correct type for default", () => {
    expect(getTypeString(z.string().default("test"))).toBe("default<string>");
  });

  it("should return correct type for enum", () => {
    expect(getTypeString(z.enum(["a", "b", "c"]))).toBe("enum[a,b,c]");
  });

  it("should return correct type for literal", () => {
    expect(getTypeString(z.literal("test"))).toBe("literal<test>");
  });

  it("should return correct type for union", () => {
    const union = z.union([z.string(), z.number()]);
    const typeStr = getTypeString(union);
    expect(typeStr).toContain("union");
    expect(typeStr).toContain("string");
    expect(typeStr).toContain("number");
  });

  it("should return correct type for intersection", () => {
    const intersection = z.intersection(
      z.object({ a: z.string() }),
      z.object({ b: z.number() }),
    );
    const typeStr = getTypeString(intersection);
    expect(typeStr).toContain("intersection");
  });

  it("should return correct type for record", () => {
    expect(getTypeString(z.record(z.string()))).toBe("record<string>");
  });

  it("should return correct type for tuple", () => {
    const tuple = z.tuple([z.string(), z.number()]);
    const typeStr = getTypeString(tuple);
    expect(typeStr).toContain("tuple");
    expect(typeStr).toContain("string");
    expect(typeStr).toContain("number");
  });

  it("should return correct type for map", () => {
    expect(getTypeString(z.map(z.string(), z.number()))).toBe("map<number>");
  });

  it("should return correct type for set", () => {
    expect(getTypeString(z.set(z.string()))).toBe("set<string>");
  });

  it("should return correct type for date", () => {
    expect(getTypeString(z.date())).toBe("date");
  });

  it("should return correct type for any", () => {
    expect(getTypeString(z.any())).toBe("any");
  });

  it("should return correct type for unknown", () => {
    expect(getTypeString(z.unknown())).toBe("unknown");
  });

  it("should return correct type for void", () => {
    expect(getTypeString(z.void())).toBe("void");
  });

  it("should return correct type for never", () => {
    expect(getTypeString(z.never())).toBe("never");
  });

  it("should return unknown for unsupported types", () => {
    // Create a mock schema that doesn't match any known type
    const mockSchema = { constructor: { name: "UnknownType" } } as any;
    expect(getTypeString(mockSchema)).toBe("unknown");
  });
});

describe("extractSchemaShape", () => {
  it("should extract shape from simple object schema", () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    });
    const shape = extractSchemaShape(schema);
    expect(shape).toContain("name:string");
    expect(shape).toContain("age:number");
  });

  it("should sort keys alphabetically", () => {
    const schema = z.object({
      z: z.string(),
      a: z.number(),
      m: z.boolean(),
    });
    const shape = extractSchemaShape(schema);
    expect(shape.indexOf("a:number")).toBeLessThan(shape.indexOf("m:boolean"));
    expect(shape.indexOf("m:boolean")).toBeLessThan(shape.indexOf("z:string"));
  });

  it("should handle nested objects", () => {
    const schema = z.object({
      user: z.object({
        name: z.string(),
      }),
    });
    const shape = extractSchemaShape(schema);
    expect(shape).toContain("user:");
  });

  it("should handle arrays", () => {
    const schema = z.object({
      items: z.array(z.string()),
    });
    const shape = extractSchemaShape(schema);
    expect(shape).toContain("items:array<string>");
  });
});

describe("hashSchema", () => {
  it("should generate a hash for a schema", () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    });
    const hash = hashSchema(schema);
    expect(hash).toBeTruthy();
    expect(typeof hash).toBe("string");
  });

  it("should generate the same hash for the same schema", () => {
    const schema1 = z.object({
      name: z.string(),
      age: z.number(),
    });
    const schema2 = z.object({
      name: z.string(),
      age: z.number(),
    });
    expect(hashSchema(schema1)).toBe(hashSchema(schema2));
  });

  it("should generate different hashes for different schemas", () => {
    const schema1 = z.object({
      name: z.string(),
    });
    const schema2 = z.object({
      name: z.string(),
      age: z.number(),
    });
    expect(hashSchema(schema1)).not.toBe(hashSchema(schema2));
  });
});
