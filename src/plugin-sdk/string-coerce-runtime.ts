export * from "../shared/string-coerce.js";
export {
  normalizeAtHashSlug,
  normalizeHyphenSlug,
  normalizeOptionalTrimmedStringList,
  normalizeSingleOrTrimmedStringList,
  normalizeStringEntries,
  normalizeStringEntriesLower,
} from "../shared/string-normalization.js";
export { summarizeStringEntries } from "../shared/string-sample.js";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeOptionalLowercaseString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim().toLowerCase() : undefined;
}
