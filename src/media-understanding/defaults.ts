/**
 * media-understanding/defaults.ts
 * Default prompts and configuration for media analysis.
 * Ported from CoreBlow reference src/media-understanding/defaults.ts.
 */

/** Maximum file size for media analysis (20 MB). */
export const DEFAULT_MAX_BYTES = 20 * 1024 * 1024;

/** Maximum character limits for text extraction by capability. */
export const DEFAULT_MAX_CHARS_BY_CAPABILITY: Record<string, number> = {
  image: 50_000,
  audio: 100_000,
  video: 100_000,
  document: 200_000,
};

/** Number of concurrent media analysis operations. */
export const DEFAULT_MEDIA_CONCURRENCY = 3;

/** Default prompt for generic media analysis. */
export const DEFAULT_PROMPT = "Describe the contents of this media.";

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


// Stub — used by link-understanding/runner.ts
export const CLI_OUTPUT_MAX_BUFFER = 1024 * 1024;

// Stub exports — used by runner.ts, runner.entries.ts
export const AUTO_AUDIO_KEY_PROVIDERS = [
  "openai",
  "groq",
  "deepgram",
  "google",
  "mistral",
] as const;
export const AUTO_IMAGE_KEY_PROVIDERS = ['openai', 'anthropic', 'google', 'minimax', 'minimax-portal'] as const;
export const AUTO_VIDEO_KEY_PROVIDERS = ["google", "moonshot"] as const;
export const DEFAULT_IMAGE_MODELS: Record<string, string> = { openai: 'gpt-4o', google: 'gemini-1.5-flash' };
export const DEFAULT_AUDIO_MODELS: Record<string, string> = {
  groq: "whisper-large-v3-turbo",
  openai: "gpt-4o-mini-transcribe",
  deepgram: "nova-3",
  mistral: "voxtral-mini-latest",
};
export const DEFAULT_TIMEOUT_SECONDS = 120;
export const MIN_AUDIO_FILE_BYTES = 1024;
