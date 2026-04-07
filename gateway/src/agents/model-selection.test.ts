/**
 * Tests for CoreBlow Model Selection Engine
 */

import { describe, it, expect } from 'vitest';
import {
    modelKey,
    legacyModelKey,
    normalizeProviderId,
    normalizeModelRef,
    parseModelRef,
    splitTrailingAuthProfile,
    buildModelAliasIndex,
    resolveModelRefFromString,
    resolveConfiguredModelRef,
    resolveDefaultModelForAgent,
    buildAllowedModelSet,
    buildConfiguredModelCatalog,
    getModelRefStatus,
    resolveAllowedModelRef,
    resolveThinkingDefault,
    resolveReasoningDefault,
    normalizeModelSelection,
    resolveHooksGmailModel,
    DEFAULT_PROVIDER,
    DEFAULT_MODEL,
    type CoreBlowConfig,
    type ModelCatalogEntry,
} from './model-selection.js';

describe('normalizeProviderId', () => {
    it('should normalize common provider names', () => {
        expect(normalizeProviderId('openai')).toBe('openai');
        expect(normalizeProviderId('gpt')).toBe('openai');
        expect(normalizeProviderId('anthropic')).toBe('anthropic');
        expect(normalizeProviderId('claude')).toBe('anthropic');
        expect(normalizeProviderId('google')).toBe('google');
        expect(normalizeProviderId('gemini')).toBe('google');
        expect(normalizeProviderId('xai')).toBe('xai');
        expect(normalizeProviderId('grok')).toBe('xai');
    });

    it('should handle case insensitivity', () => {
        expect(normalizeProviderId('OpenAI')).toBe('openai');
        expect(normalizeProviderId('ANTHROPIC')).toBe('anthropic');
    });

    it('should pass through unknown providers', () => {
        expect(normalizeProviderId('custom-provider')).toBe('custom-provider');
    });

    it('should handle trimming', () => {
        expect(normalizeProviderId('  openai  ')).toBe('openai');
    });
});

describe('modelKey', () => {
    it('should build provider/model key', () => {
        expect(modelKey('openai', 'gpt-4o')).toBe('openai/gpt-4o');
        expect(modelKey('anthropic', 'claude-sonnet-4-5')).toBe('anthropic/claude-sonnet-4-5');
    });

    it('should handle model already containing provider prefix', () => {
        expect(modelKey('openai', 'openai/gpt-4o')).toBe('openai/gpt-4o');
    });

    it('should handle empty provider', () => {
        expect(modelKey('', 'gpt-4o')).toBe('gpt-4o');
    });

    it('should handle empty model', () => {
        expect(modelKey('openai', '')).toBe('openai');
    });
});

describe('legacyModelKey', () => {
    it('should return null when key equals canonical key', () => {
        expect(legacyModelKey('openai', 'gpt-4o')).toBeNull();
    });

    it('should return null for empty inputs', () => {
        expect(legacyModelKey('', 'gpt-4o')).toBeNull();
        expect(legacyModelKey('openai', '')).toBeNull();
    });
});

describe('normalizeModelRef', () => {
    it('should normalize Anthropic model IDs', () => {
        const ref = normalizeModelRef('anthropic', 'opus-4.6');
        expect(ref.model).toBe('claude-opus-4-6');
    });

    it('should normalize Google model IDs', () => {
        const ref = normalizeModelRef('google', 'gemini-2.5-pro');
        expect(ref.model).toContain('gemini-2.5-pro');
    });

    it('should normalize xAI model IDs', () => {
        const ref = normalizeModelRef('xai', 'grok');
        expect(ref.model).toBe('grok-3');
    });

    it('should preserve unknown model IDs', () => {
        const ref = normalizeModelRef('custom', 'my-model');
        expect(ref.model).toBe('my-model');
    });
});

describe('parseModelRef', () => {
    it('should parse provider/model format', () => {
        const ref = parseModelRef('openai/gpt-4o', DEFAULT_PROVIDER);
        expect(ref).not.toBeNull();
        expect(ref!.provider).toBe('openai');
        expect(ref!.model).toBe('gpt-4o');
    });

    it('should use default provider for model-only input', () => {
        const ref = parseModelRef('gpt-4o', 'openai');
        expect(ref).not.toBeNull();
        expect(ref!.provider).toBe('openai');
        expect(ref!.model).toBe('gpt-4o');
    });

    it('should return null for empty input', () => {
        expect(parseModelRef('', DEFAULT_PROVIDER)).toBeNull();
    });

    it('should return null for invalid format', () => {
        expect(parseModelRef('/', DEFAULT_PROVIDER)).toBeNull();
    });
});

describe('splitTrailingAuthProfile', () => {
    it('should split model@profile format', () => {
        const result = splitTrailingAuthProfile('anthropic/claude-sonnet-4-5@work');
        expect(result.model).toBe('anthropic/claude-sonnet-4-5');
        expect(result.profile).toBe('work');
    });

    it('should handle no profile', () => {
        const result = splitTrailingAuthProfile('anthropic/claude-sonnet-4-5');
        expect(result.model).toBe('anthropic/claude-sonnet-4-5');
        expect(result.profile).toBeUndefined();
    });

    it('should handle empty string', () => {
        const result = splitTrailingAuthProfile('');
        expect(result.model).toBe('');
    });
});

describe('buildModelAliasIndex', () => {
    it('should build alias index from config', () => {
        const cfg: CoreBlowConfig = {
            agents: {
                defaults: {
                    models: {
                        'openai/gpt-4o-mini': { alias: 'fast' },
                        'anthropic/claude-opus-4-6': { alias: 'smart' },
                    },
                },
            },
        };

        const index = buildModelAliasIndex({ cfg, defaultProvider: DEFAULT_PROVIDER });
        expect(index.byAlias.has('fast')).toBe(true);
        expect(index.byAlias.has('smart')).toBe(true);
        expect(index.byAlias.get('fast')!.ref.provider).toBe('openai');
    });

    it('should handle empty models', () => {
        const cfg: CoreBlowConfig = {};
        const index = buildModelAliasIndex({ cfg, defaultProvider: DEFAULT_PROVIDER });
        expect(index.byAlias.size).toBe(0);
    });
});

describe('resolveModelRefFromString', () => {
    it('should resolve from alias', () => {
        const cfg: CoreBlowConfig = {
            agents: {
                defaults: {
                    models: {
                        'openai/gpt-4o-mini': { alias: 'fast' },
                    },
                },
            },
        };
        const aliasIndex = buildModelAliasIndex({ cfg, defaultProvider: DEFAULT_PROVIDER });
        const result = resolveModelRefFromString({
            raw: 'fast',
            defaultProvider: DEFAULT_PROVIDER,
            aliasIndex,
        });
        expect(result).not.toBeNull();
        expect(result!.ref.provider).toBe('openai');
        expect(result!.alias).toBe('fast');
    });

    it('should resolve from direct provider/model', () => {
        const result = resolveModelRefFromString({
            raw: 'openai/gpt-4o',
            defaultProvider: DEFAULT_PROVIDER,
        });
        expect(result).not.toBeNull();
        expect(result!.ref.provider).toBe('openai');
        expect(result!.ref.model).toBe('gpt-4o');
    });

    it('should strip auth profile before resolving', () => {
        const result = resolveModelRefFromString({
            raw: 'openai/gpt-4o@work',
            defaultProvider: DEFAULT_PROVIDER,
        });
        expect(result).not.toBeNull();
        expect(result!.ref.model).toBe('gpt-4o');
    });
});

describe('resolveConfiguredModelRef', () => {
    it('should resolve from config', () => {
        const cfg: CoreBlowConfig = {
            agents: {
                defaults: {
                    model: 'openai/gpt-4o',
                },
            },
        };
        const ref = resolveConfiguredModelRef({
            cfg,
            defaultProvider: DEFAULT_PROVIDER,
            defaultModel: DEFAULT_MODEL,
        });
        expect(ref.provider).toBe('openai');
        expect(ref.model).toBe('gpt-4o');
    });

    it('should fall back to defaults when no model configured', () => {
        const ref = resolveConfiguredModelRef({
            cfg: {},
            defaultProvider: DEFAULT_PROVIDER,
            defaultModel: DEFAULT_MODEL,
        });
        expect(ref.provider).toBe(DEFAULT_PROVIDER);
        expect(ref.model).toBe(DEFAULT_MODEL);
    });
});

describe('resolveDefaultModelForAgent', () => {
    it('should resolve configured model', () => {
        const cfg: CoreBlowConfig = {
            agents: {
                defaults: {
                    model: 'google/gemini-2.5-pro',
                },
            },
        };
        const ref = resolveDefaultModelForAgent({ cfg });
        expect(ref.provider).toBe('google');
    });

    it('should fall back to defaults', () => {
        const ref = resolveDefaultModelForAgent({ cfg: {} });
        expect(ref.provider).toBe(DEFAULT_PROVIDER);
        expect(ref.model).toBe(DEFAULT_MODEL);
    });
});

describe('buildAllowedModelSet', () => {
    const catalog: ModelCatalogEntry[] = [
        { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
        { id: 'claude-sonnet-4-5', name: 'Sonnet 4.5', provider: 'anthropic' },
    ];

    it('should allow any model when no allowlist', () => {
        const result = buildAllowedModelSet({
            cfg: {},
            catalog,
            defaultProvider: DEFAULT_PROVIDER,
        });
        expect(result.allowAny).toBe(true);
    });

    it('should filter by allowlist', () => {
        const cfg: CoreBlowConfig = {
            agents: {
                defaults: {
                    models: {
                        'openai/gpt-4o': { alias: 'fast' },
                    },
                },
            },
        };
        const result = buildAllowedModelSet({
            cfg,
            catalog,
            defaultProvider: DEFAULT_PROVIDER,
        });
        expect(result.allowAny).toBe(false);
        expect(result.allowedKeys.has('openai/gpt-4o')).toBe(true);
    });
});

describe('buildConfiguredModelCatalog', () => {
    it('should build catalog from config', () => {
        const cfg: CoreBlowConfig = {
            models: {
                providers: {
                    openai: {
                        models: [
                            { id: 'gpt-4o', name: 'GPT-4o', contextWindow: 128000, reasoning: false },
                            { id: 'o3-mini', name: 'O3 Mini', reasoning: true },
                        ],
                    },
                },
            },
        };
        const catalog = buildConfiguredModelCatalog({ cfg });
        expect(catalog).toHaveLength(2);
        expect(catalog[0]!.provider).toBe('openai');
        expect(catalog[0]!.id).toBe('gpt-4o');
        expect(catalog[0]!.contextWindow).toBe(128000);
    });

    it('should return empty for no providers', () => {
        const catalog = buildConfiguredModelCatalog({ cfg: {} });
        expect(catalog).toHaveLength(0);
    });
});

describe('resolveThinkingDefault', () => {
    it('should return "off" for non-reasoning models', () => {
        const result = resolveThinkingDefault({
            cfg: {},
            provider: 'openai',
            model: 'gpt-4o',
            catalog: [{ id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', reasoning: false }],
        });
        expect(result).toBe('off');
    });

    it('should return "medium" for reasoning models', () => {
        const result = resolveThinkingDefault({
            cfg: {},
            provider: 'openai',
            model: 'o3-mini',
            catalog: [{ id: 'o3-mini', name: 'O3 Mini', provider: 'openai', reasoning: true }],
        });
        expect(result).toBe('medium');
    });

    it('should respect config override', () => {
        const cfg: CoreBlowConfig = {
            agents: {
                defaults: {
                    thinkingDefault: 'high',
                },
            },
        };
        const result = resolveThinkingDefault({ cfg, provider: 'openai', model: 'gpt-4o' });
        expect(result).toBe('high');
    });
});

describe('resolveReasoningDefault', () => {
    it('should return "on" for reasoning models', () => {
        const result = resolveReasoningDefault({
            provider: 'openai',
            model: 'o3-mini',
            catalog: [{ id: 'o3-mini', name: 'O3 Mini', provider: 'openai', reasoning: true }],
        });
        expect(result).toBe('on');
    });

    it('should return "off" for non-reasoning models', () => {
        const result = resolveReasoningDefault({
            provider: 'openai',
            model: 'gpt-4o',
            catalog: [{ id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', reasoning: false }],
        });
        expect(result).toBe('off');
    });
});

describe('normalizeModelSelection', () => {
    it('should normalize string values', () => {
        expect(normalizeModelSelection('openai/gpt-4o')).toBe('openai/gpt-4o');
        expect(normalizeModelSelection('  trimmed  ')).toBe('trimmed');
        expect(normalizeModelSelection('')).toBeUndefined();
    });

    it('should extract primary from object', () => {
        expect(normalizeModelSelection({ primary: 'openai/gpt-4o' })).toBe('openai/gpt-4o');
        expect(normalizeModelSelection({ primary: '' })).toBeUndefined();
    });

    it('should return undefined for invalid input', () => {
        expect(normalizeModelSelection(null)).toBeUndefined();
        expect(normalizeModelSelection(undefined)).toBeUndefined();
        expect(normalizeModelSelection(42)).toBeUndefined();
    });
});

describe('resolveHooksGmailModel', () => {
    it('should resolve gmail hook model', () => {
        const cfg: CoreBlowConfig = {
            hooks: { gmail: { model: 'openai/gpt-4o-mini' } },
        };
        const ref = resolveHooksGmailModel({ cfg, defaultProvider: DEFAULT_PROVIDER });
        expect(ref).not.toBeNull();
        expect(ref!.provider).toBe('openai');
        expect(ref!.model).toBe('gpt-4o-mini');
    });

    it('should return null when no gmail model', () => {
        const ref = resolveHooksGmailModel({ cfg: {}, defaultProvider: DEFAULT_PROVIDER });
        expect(ref).toBeNull();
    });
});
