export function normalizeStringEntries(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => String(entry).trim())
    .filter((entry) => entry.length > 0);
}

export function normalizeStringEntriesLower(value: unknown): string[] {
  return normalizeStringEntries(value).map((entry) => entry.toLowerCase());
}

export function normalizeTrimmedStringList(value: unknown): string[] {
  return normalizeStringEntries(value);
}

export function normalizeOptionalTrimmedStringList(value: unknown): string[] | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  const list = normalizeTrimmedStringList(value);
  return list.length > 0 ? list : undefined;
}

export function normalizeHyphenSlug(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/gu, "-")
    .replace(/[/\\]+/gu, "-")
    .replace(/-{2,}/gu, "-")
    .replace(/^[.-]+|[.-]+$/gu, "");
}

export function normalizeAtHashSlug(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return value
    .trim()
    .toLowerCase()
    .replace(/^[@#_\s-]+/gu, "")
    .replace(/[@#_\s+]+/gu, "-")
    .replace(/[^a-z0-9-]+/gu, "-")
    .replace(/-{2,}/gu, "-")
    .replace(/^-+|-+$/gu, "");
}
