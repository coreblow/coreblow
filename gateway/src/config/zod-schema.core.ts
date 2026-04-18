/** CoreBlow — Zod Schema: Core */
export interface ValidationResult { valid: boolean; errors: string[]; }
export function validateString(value: unknown, field: string): string[] { return typeof value === "string" ? [] : [field + " must be a string"]; }
export function validateNumber(value: unknown, field: string, min?: number, max?: number): string[] {
  if (typeof value !== "number" || !Number.isFinite(value)) return [field + " must be a number"];
  if (min !== undefined && value < min) return [field + " must be >= " + min];
  if (max !== undefined && value > max) return [field + " must be <= " + max];
  return [];
}
export function validateBoolean(value: unknown, field: string): string[] { return typeof value === "boolean" ? [] : [field + " must be a boolean"]; }
export function validateEnum(value: unknown, field: string, allowed: string[]): string[] { return allowed.includes(value as string) ? [] : [field + " must be one of: " + allowed.join(", ")]; }
