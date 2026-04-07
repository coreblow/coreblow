/**
 * src/shared/entry-metadata.ts
 * Metadata and status resolution.
 * Ported from CoreBlow shared/entry-metadata.ts and shared/entry-status.ts.
 */

import {
    evaluateRequirementsFromMetadataWithRemote,
    type RequirementConfigCheck,
    type RequirementRemote,
    type Requirements,
    type RequirementsMetadata,
} from "./requirements.js";

// ── Metadata ──

export type EntryMetadata = {
    emoji?: string;
    homepage?: string;
};

export function resolveEmojiAndHomepage(params: {
    metadata?: { emoji?: string; homepage?: string } | null;
    frontmatter?: {
        emoji?: string;
        homepage?: string;
        website?: string;
        url?: string;
    } | null;
}): EntryMetadata {
    const emoji = params.metadata?.emoji ?? params.frontmatter?.emoji;
    const homepageRaw =
        params.metadata?.homepage ??
        params.frontmatter?.homepage ??
        params.frontmatter?.website ??
        params.frontmatter?.url;
    const homepage = homepageRaw?.trim() ? homepageRaw.trim() : undefined;
    return { ...(emoji ? { emoji } : {}), ...(homepage ? { homepage } : {}) };
}

export function resolveEntryMetadata(entry: {
    metadata?: { emoji?: string; homepage?: string } | null;
    frontmatter?: { emoji?: string; homepage?: string; website?: string; url?: string } | null;
}): EntryMetadata {
    return resolveEmojiAndHomepage(entry);
}

// ── Status ──

export enum EntryStatus {
    Running = "running",
    Stopped = "stopped",
    Error = "error",
    Unknown = "unknown"
}

export function resolveEntryStatus(entry: { status?: string; running?: boolean }): EntryStatus {
    if (entry.status) {
        const norm = entry.status.toLowerCase();
        if (norm === "running") return EntryStatus.Running;
        if (norm === "stopped") return EntryStatus.Stopped;
        if (norm === "error") return EntryStatus.Error;
    }
    if (entry.running === true) return EntryStatus.Running;
    if (entry.running === false) return EntryStatus.Stopped;
    return EntryStatus.Unknown;
}

// ── Requirements Evaluation ──

export type EntryMetadataRequirementsParams = Parameters<
    typeof evaluateEntryMetadataRequirements
>[0];

export function evaluateEntryMetadataRequirements(params: {
    always: boolean;
    metadata?: (RequirementsMetadata & { emoji?: string; homepage?: string }) | null;
    frontmatter?: {
        emoji?: string;
        homepage?: string;
        website?: string;
        url?: string;
    } | null;
    hasLocalBin: (bin: string) => boolean;
    localPlatform: string;
    remote?: RequirementRemote;
    isEnvSatisfied: (envName: string) => boolean;
    isConfigSatisfied: (pathStr: string) => boolean;
}): {
    emoji?: string;
    homepage?: string;
    required: Requirements;
    missing: Requirements;
    requirementsSatisfied: boolean;
    configChecks: RequirementConfigCheck[];
} {
    const { emoji, homepage } = resolveEmojiAndHomepage({
        metadata: params.metadata,
        frontmatter: params.frontmatter,
    });
    const { required, missing, eligible, configChecks } = evaluateRequirementsFromMetadataWithRemote({
        always: params.always,
        metadata: params.metadata ?? undefined,
        hasLocalBin: params.hasLocalBin,
        localPlatform: params.localPlatform,
        remote: params.remote,
        isEnvSatisfied: params.isEnvSatisfied,
        isConfigSatisfied: params.isConfigSatisfied,
    });
    return {
        ...(emoji ? { emoji } : {}),
        ...(homepage ? { homepage } : {}),
        required,
        missing,
        requirementsSatisfied: eligible,
        configChecks,
    };
}

export function evaluateEntryMetadataRequirementsForCurrentPlatform(
    params: Omit<EntryMetadataRequirementsParams, "localPlatform">,
): ReturnType<typeof evaluateEntryMetadataRequirements> {
    return evaluateEntryMetadataRequirements({
        ...params,
        localPlatform: process.platform,
    });
}

export function evaluateEntryRequirementsForCurrentPlatform(params: {
    always: boolean;
    entry: {
        metadata?: (RequirementsMetadata & { emoji?: string; homepage?: string }) | null;
        frontmatter?: {
            emoji?: string;
            homepage?: string;
            website?: string;
            url?: string;
        } | null;
    };
    hasLocalBin: (bin: string) => boolean;
    remote?: RequirementRemote;
    isEnvSatisfied: (envName: string) => boolean;
    isConfigSatisfied: (pathStr: string) => boolean;
}): ReturnType<typeof evaluateEntryMetadataRequirements> {
    return evaluateEntryMetadataRequirementsForCurrentPlatform({
        always: params.always,
        metadata: params.entry.metadata,
        frontmatter: params.entry.frontmatter,
        hasLocalBin: params.hasLocalBin,
        remote: params.remote,
        isEnvSatisfied: params.isEnvSatisfied,
        isConfigSatisfied: params.isConfigSatisfied,
    });
}
