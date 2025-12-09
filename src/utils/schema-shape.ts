import { z } from "zod";
import { simpleHash } from "./hash";

/**
 * Get a string representation of a Zod type
 */
export function getTypeString(schema: z.ZodTypeAny): string {
  if (schema instanceof z.ZodString) return "string";
  if (schema instanceof z.ZodNumber) return "number";
  if (schema instanceof z.ZodBoolean) return "boolean";
  if (schema instanceof z.ZodNull) return "null";
  if (schema instanceof z.ZodUndefined) return "undefined";
  if (schema instanceof z.ZodArray)
    return `array<${getTypeString(schema.element)}>`;
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    const keys = Object.keys(shape).sort();
    return `object{${keys.map((k) => `${k}:${getTypeString(shape[k])}`).join(",")}}`;
  }
  if (schema instanceof z.ZodOptional)
    return `optional<${getTypeString(schema._def.innerType)}>`;
  if (schema instanceof z.ZodNullable)
    return `nullable<${getTypeString(schema._def.innerType)}>`;
  if (schema instanceof z.ZodDefault)
    return `default<${getTypeString(schema._def.innerType)}>`;
  if (schema instanceof z.ZodEnum) return `enum[${schema.options.join(",")}]`;
  if (schema instanceof z.ZodLiteral) return `literal<${schema.value}>`;
  if (schema instanceof z.ZodUnion) {
    return `union<${schema.options.map((opt: z.ZodTypeAny) => getTypeString(opt)).join("|")}>`;
  }
  if (schema instanceof z.ZodIntersection) {
    return `intersection<${getTypeString(schema._def.left)}&${getTypeString(schema._def.right)}>`;
  }
  if (schema instanceof z.ZodRecord) {
    return `record<${getTypeString(schema._def.valueType)}>`;
  }
  if (schema instanceof z.ZodTuple) {
    return `tuple<${schema.items.map((item: z.ZodTypeAny) => getTypeString(item)).join(",")}>`;
  }
  if (schema instanceof z.ZodMap) {
    return `map<${getTypeString(schema._def.valueType)}>`;
  }
  if (schema instanceof z.ZodSet) {
    return `set<${getTypeString(schema._def.valueType)}>`;
  }
  if (schema instanceof z.ZodDate) return "date";
  if (schema instanceof z.ZodAny) return "any";
  if (schema instanceof z.ZodUnknown) return "unknown";
  if (schema instanceof z.ZodVoid) return "void";
  if (schema instanceof z.ZodNever) return "never";
  return "unknown";
}

/**
 * Extract a normalized shape string from a Zod schema
 * This is used to generate a hash for schema versioning
 */
export function extractSchemaShape(schema: z.ZodObject<any>): string {
  const shape = schema.shape;
  const keys = Object.keys(shape).sort();
  const shapeString = keys
    .map((key) => {
      const fieldSchema = shape[key];
      return `${key}:${getTypeString(fieldSchema)}`;
    })
    .join(",");
  return `{${shapeString}}`;
}

/**
 * Generate a hash for a schema
 */
export function hashSchema(schema: z.ZodObject<any>): string {
  const shape = extractSchemaShape(schema);
  return simpleHash(shape);
}
