/**
 * agents/models-config.ts
 * Model configuration management — selection, merging, policy.
 */
import { normalizeProviderId } from './provider-id.js';

export interface ModelConfig { id: string; provider: string; contextWindow?: number; maxOutputTokens?: number; temperature?: number; topP?: number; apiKey?: string; baseUrl?: string; headers?: Record<string, string>; disabled?: boolean; }
export interface ModelsConfig { default?: string; models: Record<string, ModelConfig>; providerDefaults?: Record<string, Partial<ModelConfig>>; }

export function mergeModelConfigs(base: ModelsConfig, override: Partial<ModelsConfig>): ModelsConfig {
    const merged: ModelsConfig = { default: override.default ?? base.default, models: { ...base.models }, providerDefaults: { ...base.providerDefaults, ...override.providerDefaults } };
    if (override.models) { for (const [id, cfg] of Object.entries(override.models)) merged.models[id] = { ...(merged.models[id] ?? { id, provider: '' }), ...cfg }; }
    return merged;
}

export function resolveModelConfig(config: ModelsConfig, modelId?: string): ModelConfig | undefined {
    const id = modelId ?? config.default;
    if (!id) return undefined;
    const model = config.models[id];
    if (!model) return undefined;
    const providerDefaults = config.providerDefaults?.[normalizeProviderId(model.provider)];
    return providerDefaults ? { ...providerDefaults, ...model } : model;
}

export function listAvailableModels(config: ModelsConfig): ModelConfig[] {
    return Object.values(config.models).filter((m) => !m.disabled);
}

export function listModelsByProvider(config: ModelsConfig, provider: string): ModelConfig[] {
    const normalized = normalizeProviderId(provider);
    return listAvailableModels(config).filter((m) => normalizeProviderId(m.provider) === normalized);
}

export function getDefaultModel(config: ModelsConfig): ModelConfig | undefined {
    return config.default ? config.models[config.default] : undefined;
}

export function validateModelsConfig(config: ModelsConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (config.default && !config.models[config.default]) errors.push(`Default model "${config.default}" not found in models`);
    for (const [id, model] of Object.entries(config.models)) {
        if (!model.provider) errors.push(`Model "${id}" missing provider`);
        if (model.contextWindow !== undefined && model.contextWindow <= 0) errors.push(`Model "${id}" has invalid contextWindow`);
    }
    return { valid: errors.length === 0, errors };
}
