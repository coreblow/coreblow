// @ts-nocheck
/**
 * media-understanding/scope.ts
 * Media scope resolution and validation.
 * Ported from CoreBlow reference src/media-understanding/scope.ts.
 */

import type { MediaType, MediaUnderstandingScope, MediaSource } from './types.js';
import { MediaSizeExceededError, MediaFormatError } from './errors.js';
import { normalizeChatType } from "../channels/chat-type.js";
import type { MediaUnderstandingScopeConfig } from "../config/types.tools.js";

const DEFAULT_SCOPE: MediaUnderstandingScope = {
    allowedTypes: ['image', 'audio', 'video', 'document'],
    maxFileSizeBytes: 20 * 1024 * 1024, // 20MB
    maxImageDimensionPx: 8192,
    maxVideoDurationSec: 300,
    maxAudioDurationSec: 600,
};

const SUPPORTED_IMAGE_FORMATS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'ico'];
const SUPPORTED_AUDIO_FORMATS = ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'wma', 'webm'];
const SUPPORTED_VIDEO_FORMATS = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'flv'];
const SUPPORTED_DOCUMENT_FORMATS = ['pdf', 'txt', 'md', 'csv', 'json', 'xml', 'html', 'docx', 'xlsx'];

/**
 * Resolve media scope from config.
 */
export function resolveMediaScope(cfg?: Record<string, unknown>): MediaUnderstandingScope {
    if (!cfg) return { ...DEFAULT_SCOPE };

    const media = cfg.media as Record<string, unknown> | undefined;
    if (!media) return { ...DEFAULT_SCOPE };

    return {
        allowedTypes: resolveAllowedTypes(media.allowedTypes),
        maxFileSizeBytes: resolvePositiveInt(media.maxFileSizeBytes, DEFAULT_SCOPE.maxFileSizeBytes),
        maxImageDimensionPx: resolvePositiveInt(media.maxImageDimensionPx, DEFAULT_SCOPE.maxImageDimensionPx),
        maxVideoDurationSec: resolvePositiveInt(media.maxVideoDurationSec, DEFAULT_SCOPE.maxVideoDurationSec),
        maxAudioDurationSec: resolvePositiveInt(media.maxAudioDurationSec, DEFAULT_SCOPE.maxAudioDurationSec),
    };
}

function resolveAllowedTypes(raw: unknown): MediaType[] {
    if (!Array.isArray(raw)) return [...DEFAULT_SCOPE.allowedTypes];
    const valid = raw.filter((t): t is MediaType => typeof t === 'string' && DEFAULT_SCOPE.allowedTypes.includes(t as MediaType));
    return valid.length > 0 ? valid : [...DEFAULT_SCOPE.allowedTypes];
}

function resolvePositiveInt(raw: unknown, fallback: number): number {
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return Math.floor(raw);
    return fallback;
}

/**
 * Validate media against scope.
 */
export function validateMediaScope(params: { type: MediaType; sizeBytes?: number; scope?: MediaUnderstandingScope }): void {
    const scope = params.scope ?? DEFAULT_SCOPE;
    if (!scope.allowedTypes.includes(params.type)) {
        throw new MediaFormatError(params.type, params.type);
    }
    if (params.sizeBytes !== undefined && params.sizeBytes > scope.maxFileSizeBytes) {
        throw new MediaSizeExceededError(params.type, params.sizeBytes, scope.maxFileSizeBytes);
    }
}

/**
 * Get supported formats for a media type.
 */
export function getSupportedFormats(type: MediaType): string[] {
    switch (type) {
        case 'image': return [...SUPPORTED_IMAGE_FORMATS];
        case 'audio': return [...SUPPORTED_AUDIO_FORMATS];
        case 'video': return [...SUPPORTED_VIDEO_FORMATS];
        case 'document': return [...SUPPORTED_DOCUMENT_FORMATS];
        default: return [];
    }
}

/**
 * Detect media type from MIME type.
 */
export function detectMediaType(mimeType: string): MediaType | null {
    const normalized = mimeType.toLowerCase().trim();
    if (normalized.startsWith('image/')) return 'image';
    if (normalized.startsWith('audio/')) return 'audio';
    if (normalized.startsWith('video/')) return 'video';
    if (normalized === 'application/pdf' || normalized.startsWith('text/')) return 'document';
    return null;
}

/**
 * Detect media type from file extension.
 */
export function detectMediaTypeFromExt(ext: string): MediaType | null {
    const normalized = ext.toLowerCase().replace(/^\./, '');
    if (SUPPORTED_IMAGE_FORMATS.includes(normalized)) return 'image';
    if (SUPPORTED_AUDIO_FORMATS.includes(normalized)) return 'audio';
    if (SUPPORTED_VIDEO_FORMATS.includes(normalized)) return 'video';
    if (SUPPORTED_DOCUMENT_FORMATS.includes(normalized)) return 'document';
    return null;
}

// ── Scope Decision Engine ──

export type MediaUnderstandingScopeDecision = "allow" | "deny";

/**
 * Resolves scope rule decisions for media understanding.
 *
 * Evaluates an ordered set of scope rules against incoming request context
 * (channel, chatType, sessionKey) and returns the first matching action.
 * Falls back to the scope default or "allow" when no rule matches.
 */
class ScopeDecisionEngine {
    private static readonly VALID_DECISIONS: ReadonlySet<string> = new Set(["allow", "deny"]);

    /**
     * Normalize a raw decision string into a typed decision, or undefined if invalid.
     */
    private normalizeDecision(value?: string | null): MediaUnderstandingScopeDecision | undefined {
        const normalized = value?.trim().toLowerCase();
        if (!normalized || !ScopeDecisionEngine.VALID_DECISIONS.has(normalized)) {
            return undefined;
        }
        return normalized as MediaUnderstandingScopeDecision;
    }

    /**
     * Normalize a raw match string for case-insensitive comparison.
     * Returns undefined for empty/null values.
     */
    private normalizeMatchValue(value?: string | null): string | undefined {
        const normalized = value?.trim().toLowerCase();
        return normalized || undefined;
    }

    /**
     * Evaluate a single rule against the request context.
     * Returns the rule's action if all match criteria pass, otherwise null.
     */
    private evaluateRule(
        rule: { action?: string; match?: Record<string, unknown> },
        context: { channel?: string; chatType?: string; sessionKey: string },
    ): MediaUnderstandingScopeDecision | null {
        const match = rule.match ?? {};
        const matchChannel = this.normalizeMatchValue(match.channel as string | undefined);
        const matchChatType = normalizeMediaUnderstandingChatType(match.chatType as string | undefined);
        const matchPrefix = this.normalizeMatchValue(match.keyPrefix as string | undefined);

        if (matchChannel && matchChannel !== context.channel) {
            return null;
        }
        if (matchChatType && matchChatType !== context.chatType) {
            return null;
        }
        if (matchPrefix && !context.sessionKey.startsWith(matchPrefix)) {
            return null;
        }

        return this.normalizeDecision(rule.action) ?? "allow";
    }

    /**
     * Resolve the scope decision by evaluating rules in order.
     * Returns "allow" if no scope is configured or no rules match.
     */
    resolve(params: {
        scope?: MediaUnderstandingScopeConfig;
        sessionKey?: string;
        channel?: string;
        chatType?: string;
    }): MediaUnderstandingScopeDecision {
        const { scope } = params;
        if (!scope) {
            return "allow";
        }

        const context = {
            channel: this.normalizeMatchValue(params.channel),
            chatType: normalizeMediaUnderstandingChatType(params.chatType),
            sessionKey: this.normalizeMatchValue(params.sessionKey) ?? "",
        };

        for (const rule of scope.rules ?? []) {
            if (!rule) {
                continue;
            }
            const decision = this.evaluateRule(rule, context);
            if (decision !== null) {
                return decision;
            }
        }

        return this.normalizeDecision(scope.default) ?? "allow";
    }
}

/** Singleton engine instance used by the exported helper functions. */
const scopeEngine = new ScopeDecisionEngine();

/**
 * Normalize a raw chat type string into a canonical chat type.
 * Maps platform-specific labels (e.g. "dm") to standard values ("direct").
 */
export function normalizeMediaUnderstandingChatType(raw?: string | null): string | undefined {
    return normalizeChatType(raw ?? undefined);
}

/**
 * Resolve the media understanding scope decision for a given context.
 * Delegates to {@link ScopeDecisionEngine.resolve}.
 */
export function resolveMediaUnderstandingScope(params: {
    scope?: MediaUnderstandingScopeConfig;
    sessionKey?: string;
    channel?: string;
    chatType?: string;
}): MediaUnderstandingScopeDecision {
    return scopeEngine.resolve(params);
}
