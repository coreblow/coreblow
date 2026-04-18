/** CoreBlow — Redact Config Snapshot */
import { redactRawValue } from "./redact-snapshot.raw.js";
export function redactConfigSnapshot(config: Record<string, unknown>): Record<string, unknown> { const result: Record<string, unknown> = {}; for (const [key, value] of Object.entries(config)) { if (typeof value === "object" && value !== null && !Array.isArray(value)) { result[key] = redactConfigSnapshot(value as Record<string, unknown>); } else { result[key] = redactRawValue(key, value); } } return result; }
