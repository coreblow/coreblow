/** CoreBlow — Redact Config Snapshot (Raw) */
export function redactRawValue(key: string, value: unknown): unknown { const sensitivePatterns = ["key", "token", "secret", "password", "credential"]; const lower = key.toLowerCase(); if (sensitivePatterns.some((p) => lower.includes(p)) && typeof value === "string") return "<redacted>"; return value; }
