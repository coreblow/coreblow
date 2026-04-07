/**
 * CoreBlow Model Selection Engine
 *
 * Handles model reference parsing, normalization, alias resolution,
 * allowlist management, and model catalog operations. Provides the
 * complete model resolution pipeline from user input to provider/model pair.
 *
 * Equivalent: CoreBlow src/agents/model-selection.ts (773 LOC)
 */

import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('model-selection');

// ─── Types ────────────────────────────────────────────────────────

export interface ModelRef {
    provider: string;
    model: string;
}

export interface ModelCatalogEntry {
    id: string;
    name: string;
    provider: string;
    contextWindow?: number;
    reasoning?: boolean;
    input?: string[];
}

export interface ModelAliasIndex {
    byAlias: Map<string, { alias: string; ref: ModelRef }>;
    byKey: Map<string, string[]>;
}

export interface ModelRefStatus {
    key: string;
    inCatalog: boolean;
    allowAny: boolean;
    allowed: boolean;
}

export interface CoreBlowModelsConfig {
    defaults?: {
        model?: string | { primary?: string };
        models?: Record<string, { alias?: string; params?: { thinking?: string } }>;
        provider?: string;
        thinkingDefault?: string;
        subagents?: { model?: string };
    };
}

export interface CoreBlowConfig {
    agents?: CoreBlowModelsConfig;
    models?: {
        providers?: Record<string, {
            models?: Array<{
                id: string;
                name?: string;
                contextWindow?: number;
                reasoning?: boolean;
                input?: string[];
            }>;
        }>;
    };
    hooks?: {
        gmail?: { model?: string };
    };
}

// ─── Constants ────────────────────────────────────────────────────

export const DEFAULT_PROVIDER = 'anthropic';
export const DEFAULT_MODEL = 'claude-sonnet-4-5';

// ─── Provider Normalization ───────────────────────────────────────

const PROVIDER_ALIASES: Record<string, string> = {
    'openai': 'openai',
    'gpt': 'openai',
    'anthropic': 'anthropic',
    'claude': 'anthropic',
    'google': 'google',
    'gemini': 'google',
    'google-vertex': 'google-vertex',
    'vertex': 'google-vertex',
    'xai': 'xai',
    'grok': 'xai',
    'openrouter': 'openrouter',
    'deepseek': 'deepseek',
    'mistral': 'mistral',
    'cohere': 'cohere',
    'groq': 'groq',
    'together': 'together',
    'fireworks': 'fireworks',
    'perplexity': 'perplexity',
    'ollama': 'ollama',
    'local': 'ollama',
};

export function normalizeProviderId(raw: string): string {
    const trimmed = raw.trim().toLowerCase();
    return PROVIDER_ALIASES[trimmed] ?? trimmed;
}

export function normalizeProviderIdForAuth(provider: string): string {
    return normalizeProviderId(provider);
}

// ─── Model ID Normalization ───────────────────────────────────────

function normalizeAnthropicModelId(model: string): string {
    const trimmed = model.trim();
    if (!trimmed) return trimmed;
    const lower = trimmed.toLowerCase();
    switch (lower) {
        case 'opus-4.6': return 'claude-opus-4-6';
        case 'opus-4.5': return 'claude-opus-4-5';
        case 'sonnet-4.6': return 'claude-sonnet-4-6';
        case 'sonnet-4.5': return 'claude-sonnet-4-5';
        case 'haiku-3.5': return 'claude-3-5-haiku-20241022';
        default: return trimmed;
    }
}

function normalizeGoogleModelId(model: string): string {
    const trimmed = model.trim();
    if (!trimmed) return trimmed;
    const lower = trimmed.toLowerCase();
    // Normalize common aliases
    if (lower === 'gemini-2.5-pro' || lower === 'gemini-pro') return 'gemini-2.5-pro-preview-05-06';
    if (lower === 'gemini-2.5-flash' || lower === 'gemini-flash') return 'gemini-2.5-flash-preview-05-20';
    return trimmed;
}

function normalizeXaiModelId(model: string): string {
    const trimmed = model.trim();
    if (!trimmed) return trimmed;
    const lower = trimmed.toLowerCase();
    if (lower === 'grok' || lower === 'grok-3') return 'grok-3';
    if (lower === 'grok-mini' || lower === 'grok-3-mini') return 'grok-3-mini';
    return trimmed;
}

function normalizeProviderModelId(provider: string, model: string): string {
    switch (provider) {
        case 'anthropic': return normalizeAnthropicModelId(model);
        case 'google':
        case 'google-vertex': return normalizeGoogleModelId(model);
        case 'xai': return normalizeXaiModelId(model);
        case 'openrouter': return model.includes('/') ? model : `openrouter/${model}`;
        default: return model;
    }
}

// ─── Model Key ────────────────────────────────────────────────────

export function modelKey(provider: string, model: string): string {
    const p = provider.trim();
    const m = model.trim();
    if (!p) return m;
    if (!m) return p;
    return m.toLowerCase().startsWith(`${p.toLowerCase()}/`) ? m : `${p}/${m}`;
}

export function legacyModelKey(provider: string, model: string): string | null {
    const p = provider.trim();
    const m = model.trim();
    if (!p || !m) return null;
    const rawKey = `${p}/${m}`;
    const canonicalKey = modelKey(p, m);
    return rawKey === canonicalKey ? null : rawKey;
}

// ─── Model Ref Parsing ───────────────────────────────────────────

export function normalizeModelRef(provider: string, model: string): ModelRef {
    const normalizedProvider = normalizeProviderId(provider);
    const normalizedModel = normalizeProviderModelId(normalizedProvider, model.trim());
    return { provider: normalizedProvider, model: normalizedModel };
}

export function parseModelRef(raw: string, defaultProvider: string): ModelRef | null {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const slash = trimmed.indexOf('/');
    if (slash === -1) {
        return normalizeModelRef(defaultProvider, trimmed);
    }
    const providerRaw = trimmed.slice(0, slash).trim();
    const model = trimmed.slice(slash + 1).trim();
    if (!providerRaw || !model) return null;
    return normalizeModelRef(providerRaw, model);
}

/**
 * Split a trailing auth profile from a model ref string.
 * Format: "provider/model@profile" → { model: "provider/model", profile: "profile" }
 */
export function splitTrailingAuthProfile(raw: string): { model: string; profile?: string } {
    const trimmed = raw.trim();
    const atIndex = trimmed.lastIndexOf('@');
    if (atIndex === -1 || atIndex === 0) return { model: trimmed };
    return {
        model: trimmed.slice(0, atIndex),
        profile: trimmed.slice(atIndex + 1),
    };
}

// ─── Alias System ─────────────────────────────────────────────────

function normalizeAliasKey(value: string): string {
    return value.trim().toLowerCase();
}

export function buildModelAliasIndex(params: {
    cfg: CoreBlowConfig;
    defaultProvider: string;
}): ModelAliasIndex {
    const byAlias = new Map<string, { alias: string; ref: ModelRef }>();
    const byKey = new Map<string, string[]>();

    const rawModels = params.cfg.agents?.defaults?.models ?? {};
    for (const [keyRaw, entryRaw] of Object.entries(rawModels)) {
        const parsed = parseModelRef(String(keyRaw ?? ''), params.defaultProvider);
        if (!parsed) continue;

        const alias = String(entryRaw?.alias ?? '').trim();
        if (!alias) continue;

        const aliasKey = normalizeAliasKey(alias);
        byAlias.set(aliasKey, { alias, ref: parsed });
        const key = modelKey(parsed.provider, parsed.model);
        const existing = byKey.get(key) ?? [];
        existing.push(alias);
        byKey.set(key, existing);
    }

    return { byAlias, byKey };
}

export function resolveModelRefFromString(params: {
    raw: string;
    defaultProvider: string;
    aliasIndex?: ModelAliasIndex;
}): { ref: ModelRef; alias?: string } | null {
    const { model } = splitTrailingAuthProfile(params.raw);
    if (!model) return null;

    if (!model.includes('/')) {
        const aliasKey = normalizeAliasKey(model);
        const aliasMatch = params.aliasIndex?.byAlias.get(aliasKey);
        if (aliasMatch) {
            return { ref: aliasMatch.ref, alias: aliasMatch.alias };
        }
    }

    const parsed = parseModelRef(model, params.defaultProvider);
    if (!parsed) return null;
    return { ref: parsed };
}

// ─── Configured Model Resolution ─────────────────────────────────

function resolveAgentModelPrimaryValue(model: string | { primary?: string } | undefined): string | undefined {
    if (typeof model === 'string') return model.trim() || undefined;
    if (model && typeof model === 'object' && 'primary' in model) {
        const primary = model.primary;
        if (typeof primary === 'string') return primary.trim() || undefined;
    }
    return undefined;
}

export function resolveConfiguredModelRef(params: {
    cfg: CoreBlowConfig;
    defaultProvider: string;
    defaultModel: string;
}): ModelRef {
    const rawModel = resolveAgentModelPrimaryValue(
        params.cfg.agents?.defaults?.model,
    ) ?? '';

    if (rawModel) {
        const trimmed = rawModel.trim();
        const aliasIndex = buildModelAliasIndex({
            cfg: params.cfg,
            defaultProvider: params.defaultProvider,
        });

        if (!trimmed.includes('/')) {
            const aliasKey = normalizeAliasKey(trimmed);
            const aliasMatch = aliasIndex.byAlias.get(aliasKey);
            if (aliasMatch) return aliasMatch.ref;

            log.warn(`Model "${trimmed}" specified without provider. Falling back to "anthropic/${trimmed}".`);
            return { provider: 'anthropic', model: trimmed };
        }

        const resolved = resolveModelRefFromString({
            raw: trimmed,
            defaultProvider: params.defaultProvider,
            aliasIndex,
        });
        if (resolved) return resolved.ref;

        log.warn(`Model "${trimmed}" could not be resolved. Falling back to default "${params.defaultProvider}/${params.defaultModel}".`);
    }

    return { provider: params.defaultProvider, model: params.defaultModel };
}

export function resolveDefaultModelForAgent(params: {
    cfg: CoreBlowConfig;
    agentId?: string;
}): ModelRef {
    return resolveConfiguredModelRef({
        cfg: params.cfg,
        defaultProvider: DEFAULT_PROVIDER,
        defaultModel: DEFAULT_MODEL,
    });
}

// ─── Allowlist ────────────────────────────────────────────────────

export function buildAllowedModelSet(params: {
    cfg: CoreBlowConfig;
    catalog: ModelCatalogEntry[];
    defaultProvider: string;
    defaultModel?: string;
}): {
    allowAny: boolean;
    allowedCatalog: ModelCatalogEntry[];
    allowedKeys: Set<string>;
} {
    const rawAllowlist = Object.keys(params.cfg.agents?.defaults?.models ?? {});
    const allowAny = rawAllowlist.length === 0;
    const defaultModel = params.defaultModel?.trim();
    const defaultRef = defaultModel && params.defaultProvider
        ? parseModelRef(defaultModel, params.defaultProvider)
        : null;
    const defaultKey = defaultRef ? modelKey(defaultRef.provider, defaultRef.model) : undefined;
    const catalogKeys = new Set(params.catalog.map((entry) => modelKey(entry.provider, entry.id)));

    if (allowAny) {
        if (defaultKey) catalogKeys.add(defaultKey);
        return { allowAny: true, allowedCatalog: params.catalog, allowedKeys: catalogKeys };
    }

    const allowedKeys = new Set<string>();
    const syntheticCatalogEntries = new Map<string, ModelCatalogEntry>();
    for (const raw of rawAllowlist) {
        const parsed = parseModelRef(String(raw), params.defaultProvider);
        if (!parsed) continue;
        const key = modelKey(parsed.provider, parsed.model);
        allowedKeys.add(key);
        if (!catalogKeys.has(key) && !syntheticCatalogEntries.has(key)) {
            syntheticCatalogEntries.set(key, {
                id: parsed.model,
                name: parsed.model,
                provider: parsed.provider,
            });
        }
    }

    if (defaultKey) allowedKeys.add(defaultKey);

    const allowedCatalog = [
        ...params.catalog.filter((entry) => allowedKeys.has(modelKey(entry.provider, entry.id))),
        ...syntheticCatalogEntries.values(),
    ];

    if (allowedCatalog.length === 0 && allowedKeys.size === 0) {
        if (defaultKey) catalogKeys.add(defaultKey);
        return { allowAny: true, allowedCatalog: params.catalog, allowedKeys: catalogKeys };
    }

    return { allowAny: false, allowedCatalog, allowedKeys };
}

export function buildConfiguredModelCatalog(params: { cfg: CoreBlowConfig }): ModelCatalogEntry[] {
    const providers = params.cfg.models?.providers;
    if (!providers || typeof providers !== 'object') return [];

    const catalog: ModelCatalogEntry[] = [];
    for (const [providerRaw, provider] of Object.entries(providers)) {
        const providerId = normalizeProviderId(providerRaw);
        if (!providerId || !Array.isArray(provider?.models)) continue;

        for (const model of provider.models) {
            const id = typeof model?.id === 'string' ? model.id.trim() : '';
            if (!id) continue;
            catalog.push({
                provider: providerId,
                id,
                name: typeof model?.name === 'string' && model.name.trim() ? model.name.trim() : id,
                contextWindow: typeof model?.contextWindow === 'number' && model.contextWindow > 0 ? model.contextWindow : undefined,
                reasoning: typeof model?.reasoning === 'boolean' ? model.reasoning : undefined,
                input: Array.isArray(model?.input) ? model.input : undefined,
            });
        }
    }

    return catalog;
}

// ─── Status & Validation ──────────────────────────────────────────

export function getModelRefStatus(params: {
    cfg: CoreBlowConfig;
    catalog: ModelCatalogEntry[];
    ref: ModelRef;
    defaultProvider: string;
    defaultModel?: string;
}): ModelRefStatus {
    const allowed = buildAllowedModelSet({
        cfg: params.cfg,
        catalog: params.catalog,
        defaultProvider: params.defaultProvider,
        defaultModel: params.defaultModel,
    });
    const key = modelKey(params.ref.provider, params.ref.model);
    return {
        key,
        inCatalog: params.catalog.some((entry) => modelKey(entry.provider, entry.id) === key),
        allowAny: allowed.allowAny,
        allowed: allowed.allowAny || allowed.allowedKeys.has(key),
    };
}

export function resolveAllowedModelRef(params: {
    cfg: CoreBlowConfig;
    catalog: ModelCatalogEntry[];
    raw: string;
    defaultProvider: string;
    defaultModel?: string;
}): { ref: ModelRef; key: string } | { error: string } {
    const trimmed = params.raw.trim();
    if (!trimmed) return { error: 'invalid model: empty' };

    const aliasIndex = buildModelAliasIndex({
        cfg: params.cfg,
        defaultProvider: params.defaultProvider,
    });
    const resolved = resolveModelRefFromString({
        raw: trimmed,
        defaultProvider: params.defaultProvider,
        aliasIndex,
    });
    if (!resolved) return { error: `invalid model: ${trimmed}` };

    const status = getModelRefStatus({
        cfg: params.cfg,
        catalog: params.catalog,
        ref: resolved.ref,
        defaultProvider: params.defaultProvider,
        defaultModel: params.defaultModel,
    });
    if (!status.allowed) return { error: `model not allowed: ${status.key}` };

    return { ref: resolved.ref, key: status.key };
}

// ─── Thinking/Reasoning ───────────────────────────────────────────

export type ThinkLevel = 'off' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'adaptive';

export function resolveThinkingDefault(params: {
    cfg: CoreBlowConfig;
    provider: string;
    model: string;
    catalog?: ModelCatalogEntry[];
}): ThinkLevel {
    const canonicalKey = modelKey(params.provider, params.model);
    const configuredModels = params.cfg.agents?.defaults?.models;
    const perModelThinking = configuredModels?.[canonicalKey]?.params?.thinking;

    const validLevels: ThinkLevel[] = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'adaptive'];
    if (perModelThinking && validLevels.includes(perModelThinking as ThinkLevel)) {
        return perModelThinking as ThinkLevel;
    }

    const configured = params.cfg.agents?.defaults?.thinkingDefault;
    if (configured && validLevels.includes(configured as ThinkLevel)) {
        return configured as ThinkLevel;
    }

    // Default: reasoning models get 'medium', others get 'off'
    const candidate = params.catalog?.find(
        (entry) => entry.provider === params.provider && entry.id === params.model,
    );
    return candidate?.reasoning === true ? 'medium' : 'off';
}

export function resolveReasoningDefault(params: {
    provider: string;
    model: string;
    catalog?: ModelCatalogEntry[];
}): 'on' | 'off' {
    const candidate = params.catalog?.find(
        (entry) => entry.provider === params.provider && entry.id === params.model,
    );
    return candidate?.reasoning === true ? 'on' : 'off';
}

// ─── Normalize Model Selection ────────────────────────────────────

export function normalizeModelSelection(value: unknown): string | undefined {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed || undefined;
    }
    if (!value || typeof value !== 'object') return undefined;
    const primary = (value as { primary?: unknown }).primary;
    if (typeof primary === 'string' && primary.trim()) return primary.trim();
    return undefined;
}

// ─── Gmail Hook Model ─────────────────────────────────────────────

export function resolveHooksGmailModel(params: {
    cfg: CoreBlowConfig;
    defaultProvider: string;
}): ModelRef | null {
    const hooksModel = params.cfg.hooks?.gmail?.model;
    if (!hooksModel?.trim()) return null;

    const aliasIndex = buildModelAliasIndex({
        cfg: params.cfg,
        defaultProvider: params.defaultProvider,
    });
    const resolved = resolveModelRefFromString({
        raw: hooksModel,
        defaultProvider: params.defaultProvider,
        aliasIndex,
    });
    return resolved?.ref ?? null;
}
