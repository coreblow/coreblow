/**
 * media-understanding/scope.ts
 * Media scope resolution and validation.
 * Ported from CoreBlow src/media-understanding/scope.ts.
 */

import type { MediaType, MediaUnderstandingScope, MediaSource } from './types.js';
import { MediaSizeExceededError, MediaFormatError } from './errors.js';

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
