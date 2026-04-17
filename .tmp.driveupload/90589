// Stub for channel config helpers - mapAllowFromEntries filters arrays to valid string entries
function mapAllowFromEntries(entries: unknown[]): string[] {
  return entries.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
}

export function normalizeNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? mapAllowFromEntries(value) : [];
}
