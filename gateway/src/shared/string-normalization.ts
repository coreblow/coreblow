/**
 * src/shared/string-normalization.ts
 * String normalization helpers.
 * Ported from CoreBlow shared/string-normalization.ts.
 */

export function normalizeStringEntries(list?: ReadonlyArray<unknown>): string[] {
    return (list ?? []).map((entry) => String(entry).trim()).filter(Boolean);
}

export function normalizeStringEntriesLower(list?: ReadonlyArray<unknown>): string[] {
    return normalizeStringEntries(list).map((entry) => entry.toLowerCase());
}

export function normalizeHyphenSlug(raw?: string | null): string {
    const trimmed = raw?.trim().toLowerCase() ?? "";
    if (!trimmed) return "";
    
    const dashed = trimmed.replace(/\s+/g, "-");
    const cleaned = dashed.replace(/[^a-z0-9#@._+-]+/g, "-");
    return cleaned.replace(/-{2,}/g, "-").replace(/^[-.]+|[-.]+$/g, "");
}

export function normalizeAtHashSlug(raw?: string | null): string {
    const trimmed = raw?.trim().toLowerCase() ?? "";
    if (!trimmed) return "";
    
    const withoutPrefix = trimmed.replace(/^[@#]+/, "");
    const dashed = withoutPrefix.replace(/[\s_]+/g, "-");
    const cleaned = dashed.replace(/[^a-z0-9-]+/g, "-");
    return cleaned.replace(/-{2,}/g, "-").replace(/^-+|-+$/g, "");
}

export function normalizeWhitespace(str: string): string {
    return str.replace(/\s+/g, " ").trim();
}

export function normalizeNewlines(str: string): string {
    return str.replace(/\r\n/g, "\n");
}

export function trimLines(str: string): string {
    return str.split("\n").map(l => l.trim()).join("\n");
}
