/**
 * Wave 32: Model & Prompt (selection, fallback, composition, persona)
 * TARGET: ~35 tests
 *
 * CoreBlow ref: models/model-catalog.ts + chat/prompt-builder.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    normalizeProviderId,
    normalizeProviderIdForAuth,
    modelKey,
    legacyModelKey,
    parseModelRef,
    buildModelAliasIndex,
    resolveModelRefFromString,
    splitTrailingAuthProfile,
    DEFAULT_PROVIDER,
    DEFAULT_MODEL
} from '../../src/agents/model-selection.js';
import {
    createFallbackChain,
    getCurrentModel,
    advanceFallback,
    isRateLimitError,
    resetFallbackChain
} from '../../src/agents/model-fallback.js';
import { composePrompt, createDefaultBudget } from '../../src/agents/prompt-composition.js';
import { PersonaEngine } from '../../src/agents/persona-engine.js';

// ─── Model Selection — Provider normalization ─────────────────────────────

describe('Model Selection — Provider normalization', () => {
    it('normalizes known provider aliases', () => {
        expect(normalizeProviderId('gpt')).toBe('openai');
        expect(normalizeProviderId('claude')).toBe('anthropic');
        expect(normalizeProviderId('gemini')).toBe('google');
        expect(normalizeProviderId('vertex')).toBe('google-vertex');
        expect(normalizeProviderId('grok')).toBe('xai');
        expect(normalizeProviderId('local')).toBe('ollama');
    });

    it('trims and lowercases input', () => {
        expect(normalizeProviderId('  OpenAI  ')).toBe('openai');
    });

    it('returns unknown providers unchanged', () => {
        expect(normalizeProviderId('custom-llm')).toBe('custom-llm');
    });

    it('normalizeProviderIdForAuth delegates to normalizeProviderId', () => {
        expect(normalizeProviderIdForAuth('claude')).toBe('anthropic');
    });

    it('has correct DEFAULT_PROVIDER and DEFAULT_MODEL', () => {
        expect(DEFAULT_PROVIDER).toBe('anthropic');
        expect(typeof DEFAULT_MODEL).toBe('string');
        expect(DEFAULT_MODEL.length).toBeGreaterThan(0);
    });
});

// ─── Model Selection — Model keys ─────────────────────────────────────────

describe('Model Selection — Model keys', () => {
    it('modelKey uses provider/model format', () => {
        const key = modelKey('openai', 'gpt-4');
        expect(key).toBe('openai/gpt-4');
    });

    it('modelKey returns model only when provider empty', () => {
        expect(modelKey('', 'gpt-4')).toBe('gpt-4');
    });

    it('modelKey does not double-prefix', () => {
        expect(modelKey('openai', 'openai/gpt-4')).toBe('openai/gpt-4');
    });

    it('legacyModelKey returns null when rawKey equals canonicalKey', () => {
        // provider/model raw = canonical, so null
        const result = legacyModelKey('anthropic', 'claude-3-opus');
        // Result is null because rawKey = 'anthropic/claude-3-opus' = canonicalKey
        expect(result).toBeNull();
    });

    it('splitTrailingAuthProfile splits at @', () => {
        const res = splitTrailingAuthProfile('openai/gpt-4@myprofile');
        expect(res.model).toBe('openai/gpt-4');
        expect(res.profile).toBe('myprofile');
    });

    it('splitTrailingAuthProfile returns model unchanged when no @', () => {
        const res = splitTrailingAuthProfile('openai/gpt-4');
        expect(res.model).toBe('openai/gpt-4');
        expect(res.profile).toBeUndefined();
    });
});

// ─── Model Selection — parseModelRef ─────────────────────────────────────

describe('Model Selection — parseModelRef', () => {
    it('parses provider/model format', () => {
        const ref = parseModelRef('openai/gpt-4', 'openai');
        expect(ref?.provider).toBe('openai');
        expect(ref?.model).toBe('gpt-4');
    });

    it('uses defaultProvider for bare model names', () => {
        const ref = parseModelRef('gpt-4', 'openai');
        expect(ref?.provider).toBe('openai');
        expect(ref?.model).toBe('gpt-4');
    });

    it('returns null for empty string', () => {
        expect(parseModelRef('', 'openai')).toBeNull();
    });

    it('normalizes provider aliases in model ref', () => {
        const ref = parseModelRef('gemini/gemini-pro', 'google');
        expect(ref?.provider).toBe('google'); // gemini -> google
    });
});

// ─── Model Selection — Alias index ───────────────────────────────────────

describe('Model Selection — Alias index', () => {
    it('builds alias index from config', () => {
        const cfg = {
            agents: {
                defaults: {
                    models: {
                        'anthropic/claude-sonnet-4-5': { alias: 'sonnet' }
                    }
                }
            }
        };
        const index = buildModelAliasIndex({ cfg: cfg as any, defaultProvider: 'anthropic' });
        expect(index.byAlias.has('sonnet')).toBe(true);
    });

    it('resolveModelRefFromString resolves aliases', () => {
        const cfg = {
            agents: {
                defaults: {
                    models: {
                        'openai/gpt-4': { alias: 'gpt4' }
                    }
                }
            }
        };
        const aliasIndex = buildModelAliasIndex({ cfg: cfg as any, defaultProvider: 'openai' });
        const resolved = resolveModelRefFromString({ raw: 'gpt4', defaultProvider: 'openai', aliasIndex });
        expect(resolved?.ref.model).toBe('gpt-4');
        expect(resolved?.alias).toBe('gpt4');
    });

    it('resolveModelRefFromString returns direct model ref when no alias', () => {
        const resolved = resolveModelRefFromString({ raw: 'openai/gpt-4', defaultProvider: 'openai' });
        expect(resolved?.ref.provider).toBe('openai');
        expect(resolved?.ref.model).toBe('gpt-4');
    });
});

// ─── Model Fallback Chain ────────────────────────────────────────────────

describe('Model Fallback Chain', () => {
    it('creates chain sorted by priority (highest first)', () => {
        const chain = createFallbackChain([
            { provider: 'openai', model: 'gpt-3.5', priority: 1 },
            { provider: 'openai', model: 'gpt-4', priority: 10 },
            { provider: 'anthropic', model: 'haiku', priority: 5 },
        ]);
        expect(getCurrentModel(chain)?.model).toBe('gpt-4');
    });

    it('advances to next model on failure', () => {
        const chain = createFallbackChain([
            { provider: 'openai', model: 'primary', priority: 10 },
            { provider: 'anthropic', model: 'fallback', priority: 5 },
        ]);
        advanceFallback(chain, 'error');
        expect(getCurrentModel(chain)?.model).toBe('fallback');
    });

    it('returns null when chain exhausted', () => {
        const chain = createFallbackChain([
            { provider: 'openai', model: 'only', priority: 10 },
        ]);
        const next = advanceFallback(chain, 'error');
        expect(next).toBeNull();
        expect(getCurrentModel(chain)).toBeNull();
    });

    it('detects rate limit errors by pattern', () => {
        expect(isRateLimitError(new Error('rate limit exceeded'))).toBe(true);
        expect(isRateLimitError(new Error('429 Too Many Requests'))).toBe(true);
        expect(isRateLimitError(new Error('quota exceeded'))).toBe(true);
        expect(isRateLimitError(new Error('model not found'))).toBe(false);
    });

    it('resets chain back to first model', () => {
        const chain = createFallbackChain([
            { provider: 'openai', model: 'primary', priority: 10 },
            { provider: 'anthropic', model: 'fallback', priority: 5 },
        ]);
        advanceFallback(chain, 'error');
        resetFallbackChain(chain);
        expect(getCurrentModel(chain)?.model).toBe('primary');
    });
});

// ─── Prompt Composition ──────────────────────────────────────────────────

describe('Prompt Composition', () => {
    it('createDefaultBudget allocates 15/70/15 split', () => {
        const budget = createDefaultBudget(10000);
        expect(budget.systemBudget).toBe(1500);
        expect(budget.contextBudget).toBe(7000);
        expect(budget.toolsBudget).toBe(1500);
    });

    it('composes prompt without truncation when under budget', () => {
        const budget = createDefaultBudget(10000);
        const result = composePrompt({
            systemPrompt: 'Be helpful',
            messages: [
                { role: 'user', content: 'Hello' },
                { role: 'assistant', content: 'Hi there' }
            ],
            budget
        });
        expect(result.truncated).toBe(false);
        expect(result.system).toBe('Be helpful');
        expect(result.messages).toHaveLength(2);
    });

    it('truncates system if over systemBudget', () => {
        const budget = createDefaultBudget(100);
        const result = composePrompt({
            systemPrompt: 'X'.repeat(5000),
            messages: [],
            budget
        });
        expect(result.truncated).toBe(true);
    });

    it('truncates oldest context messages when over contextBudget', () => {
        const budget = createDefaultBudget(100);
        const messages = Array.from({ length: 50 }, (_, i) => ({
            role: 'user', content: `Msg ${i}: ${'A'.repeat(200)}`
        }));
        const result = composePrompt({ systemPrompt: 'sys', messages, budget });
        expect(result.truncated).toBe(true);
        expect(result.messages.length).toBeLessThan(50);
    });

    it('preserves most recent messages during truncation', () => {
        const budget = createDefaultBudget(200);
        const messages = [
            { role: 'user', content: 'Old message' },
            { role: 'assistant', content: 'Old reply' },
            { role: 'user', content: 'Recent message' },
        ];
        const result = composePrompt({ systemPrompt: 'sys', messages, budget });
        const contents = result.messages.map(m => m.content);
        expect(contents).toContain('Recent message');
    });

    it('estimatedTokens is positive when content present', () => {
        const budget = createDefaultBudget(10000);
        const result = composePrompt({
            systemPrompt: 'Be helpful assistant',
            messages: [{ role: 'user', content: 'Hello world' }],
            budget
        });
        expect(result.estimatedTokens).toBeGreaterThan(0);
    });
});

// ─── Persona Engine ──────────────────────────────────────────────────────

describe('Persona Engine', () => {
    let engine: PersonaEngine;

    beforeEach(() => { engine = new PersonaEngine(); });

    it('starts with built-in default, coder, analyst, creative personas', () => {
        const list = engine.list();
        const ids = list.map(p => p.id);
        expect(ids).toContain('default');
        expect(ids).toContain('coder');
        expect(ids).toContain('analyst');
        expect(ids).toContain('creative');
    });

    it('registers and retrieves a custom persona', () => {
        engine.register({ id: 'pirate', name: 'Pirate Pete', systemPrompt: 'Ye are a pirate!', tone: 'casual' });
        expect(engine.get('pirate')).not.toBeNull();
        expect(engine.get('pirate')?.name).toBe('Pirate Pete');
    });

    it('returns null for unknown persona', () => {
        expect(engine.get('unknown-persona')).toBeNull();
    });

    it('activates persona for conversation', () => {
        engine.register({ id: 'expert', name: 'Expert', systemPrompt: 'You are expert' });
        const ok = engine.activate('conv1', 'expert');
        expect(ok).toBe(true);
        expect(engine.getActive('conv1')?.id).toBe('expert');
    });

    it('activate returns false for unknown persona', () => {
        expect(engine.activate('conv1', 'nonexistent')).toBe(false);
    });

    it('deactivates persona clears the activation', () => {
        engine.register({ id: 'temp', name: 'T', systemPrompt: 'sp' });
        engine.activate('conv1', 'temp');
        engine.deactivate('conv1');
        expect(engine.getActive('conv1')).toBeNull();
    });

    it('buildSystemMessages returns array with system role', () => {
        engine.register({ id: 'agent', name: 'A', systemPrompt: 'You are Agent X.' });
        engine.activate('conv1', 'agent');
        const msgs = engine.buildSystemMessages('conv1');
        expect(msgs.some(m => m.role === 'system')).toBe(true);
        expect(msgs.some(m => m.content.includes('Agent X'))).toBe(true);
    });

    it('buildSystemMessages uses default persona when not activated', () => {
        const msgs = engine.buildSystemMessages('conv-no-persona');
        expect(msgs.some(m => m.content.includes('CoreBlow'))).toBe(true);
    });

    it('getModelParams returns temperature and maxTokens', () => {
        engine.register({ id: 'precise', name: 'P', systemPrompt: 'sp', temperature: 0.1, maxTokens: 256 });
        engine.activate('conv1', 'precise');
        const params = engine.getModelParams('conv1');
        expect(params.temperature).toBe(0.1);
        expect(params.maxTokens).toBe(256);
    });

    it('delete removes custom persona', () => {
        engine.register({ id: 'temp', name: 'T', systemPrompt: 'sp' });
        const ok = engine.delete('temp');
        expect(ok).toBe(true);
        expect(engine.get('temp')).toBeNull();
    });

    it('delete default returns false (protection)', () => {
        expect(engine.delete('default')).toBe(false);
        expect(engine.get('default')).not.toBeNull();
    });
});
