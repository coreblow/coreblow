/**
 * src/shared/frontmatter.ts
 * Parse frontmatter metadata arrays and requirements.
 * Ported from CoreBlow shared/frontmatter.ts.
 */

import JSON5 from "json5";

// Backward compatibility keys
const MANIFEST_KEY = "manifest";
const LEGACY_MANIFEST_KEYS = ["plugin", "channel", "metadata"];

export function normalizeStringList(input: unknown): string[] {
    if (!input) return [];
    if (Array.isArray(input)) {
        return input.map((value) => String(value).trim()).filter(Boolean);
    }
    if (typeof input === "string") {
        return input
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean);
    }
    return [];
}

export function getFrontmatterString(
    frontmatter: Record<string, unknown>,
    key: string,
): string | undefined {
    const raw = frontmatter[key];
    return typeof raw === "string" ? raw : undefined;
}

export function parseFrontmatterBool(value: string | undefined, fallback: boolean): boolean {
    if (value === undefined) return fallback;
    const trimmed = value.trim().toLowerCase();
    if (trimmed === "true" || trimmed === "1" || trimmed === "yes") return true;
    if (trimmed === "false" || trimmed === "0" || trimmed === "no") return false;
    return fallback;
}

export function resolveManifestBlock(params: {
    frontmatter: Record<string, unknown>;
    key?: string;
}): Record<string, unknown> | undefined {
    const raw = getFrontmatterString(params.frontmatter, params.key ?? "metadata");
    if (!raw) return undefined;

    try {
        const parsed = JSON5.parse(raw);
        if (!parsed || typeof parsed !== "object") return undefined;

        const manifestKeys = [MANIFEST_KEY, ...LEGACY_MANIFEST_KEYS];
        for (const key of manifestKeys) {
            const candidate = (parsed as Record<string, unknown>)[key];
            if (candidate && typeof candidate === "object") {
                return candidate as Record<string, unknown>;
            }
        }
        return undefined;
    } catch {
        return undefined;
    }
}

export type ManifestRequires = {
    bins: string[];
    anyBins: string[];
    env: string[];
    config: string[];
};

export function resolveManifestRequires(
    metadataObj: Record<string, unknown>,
): ManifestRequires | undefined {
    const requiresRaw =
        typeof metadataObj.requires === "object" && metadataObj.requires !== null
            ? (metadataObj.requires as Record<string, unknown>)
            : undefined;
    if (!requiresRaw) return undefined;

    return {
        bins: normalizeStringList(requiresRaw.bins),
        anyBins: normalizeStringList(requiresRaw.anyBins),
        env: normalizeStringList(requiresRaw.env),
        config: normalizeStringList(requiresRaw.config),
    };
}

export function resolveManifestInstall<T>(
    metadataObj: Record<string, unknown>,
    parseInstallSpec: (input: unknown) => T | undefined,
): T[] {
    const installRaw = Array.isArray(metadataObj.install) ? (metadataObj.install as unknown[]) : [];
    return installRaw
        .map((entry) => parseInstallSpec(entry))
        .filter((entry): entry is T => Boolean(entry));
}

export function resolveManifestOs(metadataObj: Record<string, unknown>): string[] {
    return normalizeStringList(metadataObj.os);
}
