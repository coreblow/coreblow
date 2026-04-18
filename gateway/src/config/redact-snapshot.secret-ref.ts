/** CoreBlow — Redact Secret Refs */
export function isSecretRef(value: unknown): boolean { return typeof value === "string" && (value.startsWith("env:") || value.startsWith("file:") || value.startsWith("vault:")); }
export function redactSecretRef(value: string): string { if (value.startsWith("env:")) return "env:<redacted>"; if (value.startsWith("file:")) return "file:<redacted>"; return "<secret-ref>"; }
