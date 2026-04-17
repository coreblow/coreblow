/**
 * plugin-sdk/provider-helpers.ts
 * LLM provider integration helpers for plugins.
 */

import { parseModelString } from '../auto-reply/model-runtime.js';

export interface CompletionRequest {
    model: string;
    messages: Array<{ role: string; content: string }>;
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    stream?: boolean;
}

export interface CompletionResponse {
    content: string;
    model: string;
    usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
    finishReason?: string;
}

/**
 * Resolve provider configuration from config.
 */
export function resolveProviderConfig(model: string, cfg?: Record<string, unknown>): {
    provider: string;
    modelId: string;
    apiKey?: string;
    endpoint?: string;
} {
    const { provider, modelId } = parseModelString(model);
    const models = cfg?.models as Record<string, unknown> | undefined;
    const providerCfg = models?.[provider] as Record<string, unknown> | undefined;

    return {
        provider,
        modelId,
        apiKey: providerCfg?.apiKey as string | undefined,
        endpoint: providerCfg?.endpoint as string | undefined,
    };
}

/**
 * Get list of available models from config.
 */
export function getAvailableModels(cfg?: Record<string, unknown>): string[] {
    const models: string[] = [];
    const modelsCfg = cfg?.models as Record<string, unknown> | undefined;
    if (!modelsCfg) return models;

    for (const [provider, providerCfg] of Object.entries(modelsCfg)) {
        if (typeof providerCfg === 'object' && providerCfg !== null) {
            const pc = providerCfg as Record<string, unknown>;
            if (pc.apiKey || pc.endpoint) {
                models.push(`${provider}/*`);
            }
            if (Array.isArray(pc.models)) {
                for (const m of pc.models) {
                    if (typeof m === 'string') models.push(`${provider}/${m}`);
                }
            }
        }
    }
    return models;
}

/**
 * Validate a model string.
 */
export function isValidModelString(model: string): boolean {
    try {
        const { provider, modelId } = parseModelString(model);
        return provider.length > 0 && modelId.length > 0;
    } catch { return false; }
}
