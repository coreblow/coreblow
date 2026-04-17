export type ModelProviderConfig = {
    api?: string;
    baseUrl?: string;
    apiKey?: string;
    models?: Record<string, ModelConfig>;
    defaultModel?: string;
    headers?: Record<string, string>;
    maxRetries?: number;
    retryDelayMs?: number;
    rateLimitRpm?: number;
};

export type ModelConfig = {
    displayName?: string;
    contextWindow?: number;
    maxOutputTokens?: number;
    supportsImages?: boolean;
    supportsTools?: boolean;
    supportsStreaming?: boolean;
    supportsThinking?: boolean;
    isReasoning?: boolean;
    pricing?: { inputPer1k?: number; outputPer1k?: number };
};

export type ModelsConfig = {
    default?: string;
    providers?: Record<string, ModelProviderConfig>;
    aliases?: Record<string, string>;
    allowlist?: string[];
    denylist?: string[];
};
