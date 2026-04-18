/** CoreBlow — Schema Base (Generated) */
import { createSchemaField, type SchemaField } from "./schema-base.js";
export const BASE_SCHEMA_FIELDS: SchemaField[] = [
  createSchemaField("version", "number", true, 2),
  createSchemaField("provider", "string", false, "anthropic"),
  createSchemaField("model", "string", false, "claude-sonnet-4-20250514"),
  createSchemaField("temperature", "number", false, 0.7),
  createSchemaField("maxTokens", "number", false, 8192),
  createSchemaField("systemPrompt", "string", false),
  createSchemaField("channels", "object", false),
  createSchemaField("agents", "object", false),
  createSchemaField("tools", "object", false),
  createSchemaField("mcp", "object", false),
];
