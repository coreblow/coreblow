/**
 * media-understanding/defaults.ts
 * Default prompts and configuration for media analysis.
 * Ported from CoreBlow src/media-understanding/defaults.ts.
 */

export const DEFAULT_IMAGE_PROMPT = 'Describe this image in detail. Include all visible text, important visual elements, colors, and layout.';
export const DEFAULT_AUDIO_PROMPT = 'Transcribe this audio. Include timestamps if available.';
export const DEFAULT_VIDEO_PROMPT = 'Describe the contents of this video, including visual elements, audio, and key events.';
export const DEFAULT_DOCUMENT_PROMPT = 'Summarize the contents of this document.';

export const DEFAULT_IMAGE_MODEL = 'gpt-4o';
export const DEFAULT_AUDIO_MODEL = 'whisper-1';
export const DEFAULT_VIDEO_MODEL = 'gemini-2.5-pro';

export const DEFAULT_MAX_TOKENS = 4096;
export const DEFAULT_DETAIL = 'auto' as const;
export const DEFAULT_SAMPLE_FRAMES = 5;
export const DEFAULT_TIMEOUT_MS = 60_000;

/**
 * Resolve the analysis prompt for a media type.
 */
export function resolveMediaPrompt(params: {
    type: string;
    customPrompt?: string;
    cfg?: Record<string, unknown>;
}): string {
    if (params.customPrompt?.trim()) return params.customPrompt.trim();

    const media = params.cfg?.media as Record<string, unknown> | undefined;
    const prompts = media?.prompts as Record<string, unknown> | undefined;
    const configPrompt = prompts?.[params.type];
    if (typeof configPrompt === 'string' && configPrompt.trim()) return configPrompt.trim();

    switch (params.type) {
        case 'image': return DEFAULT_IMAGE_PROMPT;
        case 'audio': return DEFAULT_AUDIO_PROMPT;
        case 'video': return DEFAULT_VIDEO_PROMPT;
        case 'document': return DEFAULT_DOCUMENT_PROMPT;
        default: return `Describe the contents of this ${params.type}.`;
    }
}

/**
 * Resolve model for media analysis.
 */
export function resolveMediaModel(type: string, cfg?: Record<string, unknown>): string {
    const media = cfg?.media as Record<string, unknown> | undefined;
    const models = media?.models as Record<string, unknown> | undefined;
    const configModel = models?.[type];
    if (typeof configModel === 'string') return configModel;

    switch (type) {
        case 'image': return DEFAULT_IMAGE_MODEL;
        case 'audio': return DEFAULT_AUDIO_MODEL;
        case 'video': return DEFAULT_VIDEO_MODEL;
        default: return DEFAULT_IMAGE_MODEL;
    }
}

/**
 * Resolve max tokens for media analysis.
 */
export function resolveMediaMaxTokens(modelMaxTokens?: number, requestedMaxTokens = DEFAULT_MAX_TOKENS): number {
    if (typeof modelMaxTokens !== 'number' || !Number.isFinite(modelMaxTokens) || modelMaxTokens <= 0) return requestedMaxTokens;
    return Math.min(requestedMaxTokens, modelMaxTokens);
}
