/** CoreBlow — Schema Base */
export interface SchemaField { path: string; type: "string" | "number" | "boolean" | "object" | "array"; required: boolean; default?: unknown; description?: string; }
export function createSchemaField(path: string, type: SchemaField["type"], required = false, defaultValue?: unknown): SchemaField { return { path, type, required, default: defaultValue }; }
