export function normalizeOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function normalizeLowercaseStringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function normalizeOptionalLowercaseString(value: unknown): string | undefined {
  const normalized = normalizeLowercaseStringOrEmpty(value);
  return normalized || undefined;
}
