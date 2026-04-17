/**
 * src/tts/types.ts
 * TTS engine types
 * SUPERIOR: CoreBlow = single provider; CoreBlow = multi-provider + offline + SSML + streaming
 */

export type TtsProvider = 'sherpa-onnx' | 'openai' | 'google' | 'elevenlabs' | 'edge' | 'system';

export type TtsOutputFormat = 'wav' | 'mp3' | 'ogg' | 'pcm';

export interface TtsVoice {
    id: string;
    name: string;
    language: string;
    gender: 'male' | 'female' | 'neutral';
    provider: TtsProvider;
    /** Preview URL or sample */
    sampleUrl?: string;
}

export interface TtsRequest {
    text: string;
    voice?: string;
    provider?: TtsProvider;
    language?: string;
    speed?: number;
    pitch?: number;
    format?: TtsOutputFormat;
    /** SSML markup (SUPERIOR: CoreBlow doesn't support SSML) */
    ssml?: boolean;
    /** Stream audio chunks as they're generated */
    stream?: boolean;
    /** Max text length before auto-chunking */
    maxChunkLength?: number;
}

export interface TtsResult {
    audio: Buffer;
    format: TtsOutputFormat;
    durationMs: number;
    provider: TtsProvider;
    voice: string;
    bytesGenerated: number;
    cached: boolean;
}

export interface TtsConfig {
    defaultProvider?: TtsProvider;
    defaultVoice?: string;
    defaultLanguage?: string;
    defaultSpeed?: number;
    cacheEnabled?: boolean;
    /** Maximum text length per request */
    maxTextLength?: number;
    /** Provider-specific API keys */
    apiKeys?: Partial<Record<TtsProvider, string>>;
}
