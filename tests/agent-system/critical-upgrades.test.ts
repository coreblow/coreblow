/**
 * Tests for 5 CRITICAL Agent System Upgrades
 *
 * 1. Tool Call Argument Repair
 * 2. Context Window Guard
 * 3. Context Compaction Engine
 * 4. Model Fallback Chain
 * 5. Model Catalog
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
    repairToolCallArguments,
    RepairTracker,
    type ToolSchema,
} from '../../src/agents/turn-engine/tools/tool-call-argument-repair.js';
import {
    ContextWindowGuard,
    estimateTokens,
    getModelTokenLimit,
    type Message,
} from '../../src/agents/turn-engine/session/context-window-guard.js';
import {
    CompactionEngine,
    validateCompaction,
    type CompactionMessage,
} from '../../src/agents/turn-engine/compaction/compaction-engine.js';
import {
    ModelFallbackChain,
    createFallbackChain,
    MODEL_CATALOG,
    type ModelConfig,
} from '../../src/agents/turn-engine/model/model-fallback.js';


// ═══════════════════════════════════════════════════════════════
// 1. TOOL CALL ARGUMENT REPAIR
// ═══════════════════════════════════════════════════════════════

describe('Tool Call Argument Repair', () => {
    it('parses valid JSON directly', () => {
        const result = repairToolCallArguments('{"name": "test", "value": 42}');
        expect(result.repaired).toBe(true);
        expect(result.args).toEqual({ name: 'test', value: 42 });
        expect(result.strategy).toBeNull(); // No repair needed
    });

    it('fixes trailing commas', () => {
        const result = repairToolCallArguments('{"name": "test", "value": 42,}');
        expect(result.repaired).toBe(true);
        expect(result.args).toEqual({ name: 'test', value: 42 });
        expect(result.strategy).toBe('trailing_comma');
    });

    it('fixes single quotes', () => {
        const result = repairToolCallArguments("{'name': 'test', 'value': 42}");
        expect(result.repaired).toBe(true);
        expect(result.args).toEqual({ name: 'test', value: 42 });
        expect(result.strategy).toBe('single_quotes');
    });

    it('fixes unquoted keys', () => {
        const result = repairToolCallArguments('{name: "test", value: 42}');
        expect(result.repaired).toBe(true);
        expect(result.args).toEqual({ name: 'test', value: 42 });
        expect(result.strategy).toBe('unquoted_keys');
    });

    it('fixes truncated JSON (missing closing brace)', () => {
        const result = repairToolCallArguments('{"name": "test", "value": 42');
        expect(result.repaired).toBe(true);
        expect(result.args).toEqual({ name: 'test', value: 42 });
        expect(result.strategy).toBe('truncation_close');
    });

    it('extracts JSON from markdown code block', () => {
        const raw = 'Here is the result:\n```json\n{"name": "test"}\n```\nDone!';
        const result = repairToolCallArguments(raw);
        expect(result.repaired).toBe(true);
        expect(result.args).toEqual({ name: 'test' });
        expect(result.strategy).toBe('extract_json');
    });

    it('extracts JSON from surrounding text', () => {
        const raw = 'The arguments are {"file": "test.ts"} and done.';
        const result = repairToolCallArguments(raw);
        expect(result.repaired).toBe(true);
        expect(result.args).toEqual({ file: 'test.ts' });
        expect(result.strategy).toBe('extract_json');
    });

    it('applies combined repairs', () => {
        // Single quotes + trailing comma + truncated
        const result = repairToolCallArguments("{'name': 'test',");
        expect(result.repaired).toBe(true);
        expect(result.args!.name).toBe('test');
    });

    it('applies schema defaults', () => {
        const schema: ToolSchema = {
            name: 'readFile',
            parameters: [
                { name: 'path', type: 'string', required: true },
                { name: 'encoding', type: 'string', default: 'utf-8' },
            ],
        };
        const result = repairToolCallArguments('{"path": "/test.txt"}', schema);
        expect(result.repaired).toBe(true);
        expect(result.args!.encoding).toBe('utf-8');
    });

    it('applies type coercion', () => {
        const schema: ToolSchema = {
            name: 'setConfig',
            parameters: [
                { name: 'count', type: 'number' },
                { name: 'enabled', type: 'boolean' },
            ],
        };
        const result = repairToolCallArguments('{"count": "42", "enabled": "true"}', schema);
        expect(result.repaired).toBe(true);
        expect(result.args!.count).toBe(42);
        expect(result.args!.enabled).toBe(true);
    });

    it('generates error feedback when repair fails', () => {
        const result = repairToolCallArguments('this is not json at all !!!');
        expect(result.repaired).toBe(false);
        expect(result.args).toBeNull();
        expect(result.errorFeedback).toContain('ERROR');
        expect(result.errorFeedback).toContain('valid JSON');
    });

    it('generates schema-aware error feedback', () => {
        const schema: ToolSchema = {
            name: 'readFile',
            parameters: [
                { name: 'path', type: 'string', required: true, description: 'File path to read' },
            ],
        };
        const result = repairToolCallArguments('broken!!!', schema);
        expect(result.repaired).toBe(false);
        expect(result.errorFeedback).toContain('path');
        expect(result.errorFeedback).toContain('REQUIRED');
    });

    it('RepairTracker tracks stats', () => {
        const tracker = new RepairTracker();
        tracker.recordRepair('trailing_comma', 'readFile');
        tracker.recordRepair('trailing_comma', 'writeFile');
        tracker.recordRepair('single_quotes', 'search');
        tracker.recordFailure('deleteFile');

        const stats = tracker.stats();
        expect(stats.totalRepairs).toBe(3);
        expect(stats.totalFailures).toBe(1);
        expect(stats.byStrategy.trailing_comma).toBe(2);
        expect(stats.byStrategy.single_quotes).toBe(1);
    });
});


// ═══════════════════════════════════════════════════════════════
// 2. CONTEXT WINDOW GUARD
// ═══════════════════════════════════════════════════════════════

describe('Context Window Guard', () => {
    const makeMessages = (count: number, contentSize = 100): Message[] => {
        const msgs: Message[] = [
            { role: 'system', content: 'You are a helpful assistant.' },
        ];
        for (let i = 0; i < count; i++) {
            msgs.push({
                role: i % 2 === 0 ? 'user' : 'assistant',
                content: `Message ${i}: ${'x'.repeat(contentSize)}`,
                timestamp: Date.now() - (count - i) * 60000,
            });
        }
        return msgs;
    };

    it('does not prune when under threshold', () => {
        const guard = new ContextWindowGuard({ maxTokens: 100000 });
        const messages = makeMessages(5);
        const result = guard.enforce(messages);
        expect(result.pruned).toBe(false);
        expect(result.removedCount).toBe(0);
    });

    it('prunes when exceeding threshold', () => {
        // Small limit to force pruning
        const guard = new ContextWindowGuard({ maxTokens: 500, reservedResponseTokens: 100 });
        const messages = makeMessages(20, 50);
        const result = guard.enforce(messages);
        expect(result.pruned).toBe(true);
        expect(result.removedCount).toBeGreaterThan(0);
        expect(result.messages.length).toBeLessThan(messages.length);
    });

    it('preserves system messages', () => {
        const guard = new ContextWindowGuard({ maxTokens: 200, reservedResponseTokens: 50 });
        const messages = makeMessages(20, 50);
        const result = guard.enforce(messages);
        expect(result.messages[0]!.role).toBe('system');
    });

    it('preserves pinned messages', () => {
        const guard = new ContextWindowGuard({ maxTokens: 300, reservedResponseTokens: 50 });
        const messages = makeMessages(10, 50);
        messages[3]!.pinned = true;
        messages[3]!.content = 'IMPORTANT PINNED';
        const result = guard.enforce(messages);
        expect(result.messages.some(m => m.content.includes('IMPORTANT PINNED'))).toBe(true);
    });

    it('wouldExceed detects overflow', () => {
        const guard = new ContextWindowGuard({ maxTokens: 100, reservedResponseTokens: 20 });
        const messages: Message[] = [
            { role: 'system', content: 'System prompt' },
            { role: 'user', content: 'x'.repeat(200) },
        ];
        expect(guard.wouldExceed(messages, 'x'.repeat(100))).toBe(true);
    });

    it('remainingBudget calculates correctly', () => {
        const guard = new ContextWindowGuard({ maxTokens: 1000, reservedResponseTokens: 200 });
        const messages: Message[] = [
            { role: 'system', content: 'Hello' }, // ~5 tokens
        ];
        const budget = guard.remainingBudget(messages);
        expect(budget).toBeGreaterThan(0);
        expect(budget).toBeLessThan(800);
    });

    it('getModelTokenLimit returns correct limits', () => {
        expect(getModelTokenLimit('gpt-4o')).toBe(128000);
        expect(getModelTokenLimit('claude-4-opus')).toBe(200000);
        expect(getModelTokenLimit('gemini-2.5-pro')).toBe(1048576);
        expect(getModelTokenLimit('unknown-model')).toBe(128000); // default
    });

    it('estimateTokens gives reasonable estimate', () => {
        expect(estimateTokens('')).toBe(0);
        expect(estimateTokens('hello world')).toBeGreaterThan(0);
        expect(estimateTokens('a'.repeat(400))).toBe(100); // ~4 chars/token
    });

    it('forModel creates guard with correct limit', () => {
        const guard = ContextWindowGuard.forModel('gpt-4o');
        const stats = guard.stats();
        expect(stats.maxTokens).toBe(128000);
    });

    it('compacts old messages into summary', () => {
        const guard = new ContextWindowGuard({
            maxTokens: 500,
            reservedResponseTokens: 100,
            useSummaryCompaction: true,
        });
        const messages = makeMessages(30, 50);
        const result = guard.enforce(messages);
        expect(result.pruned).toBe(true);
        expect(result.totalTokens).toBeLessThan(500);
    });
});


// ═══════════════════════════════════════════════════════════════
// 3. CONTEXT COMPACTION ENGINE
// ═══════════════════════════════════════════════════════════════

describe('Compaction Engine', () => {
    const makeCompactionMessages = (count: number): CompactionMessage[] => {
        const msgs: CompactionMessage[] = [
            { role: 'system', content: 'System prompt' },
        ];
        for (let i = 0; i < count; i++) {
            msgs.push({
                role: i % 2 === 0 ? 'user' : 'assistant',
                content: `Message ${i}: Some conversation content about topic ${i}`,
                timestamp: Date.now() - (count - i) * 60000,
            });
        }
        return msgs;
    };

    it('does not compact few messages', async () => {
        const engine = new CompactionEngine({ strategy: 'sliding_window' });
        const messages = makeCompactionMessages(3);
        const result = await engine.compact(messages);
        expect(result.removedCount).toBe(0);
        expect(result.finalCount).toBe(4); // 1 system + 3
    });

    it('sliding window keeps last N messages', async () => {
        const engine = new CompactionEngine({ strategy: 'sliding_window', windowSize: 5 });
        const messages = makeCompactionMessages(20);
        const result = await engine.compact(messages);
        expect(result.finalCount).toBeLessThanOrEqual(6); // system + 5
        expect(result.removedCount).toBeGreaterThan(0);
    });

    it('importance-based keeps high-importance messages', async () => {
        const engine = new CompactionEngine({
            strategy: 'importance',
            importanceThreshold: 0.6,
        });
        const messages = makeCompactionMessages(10);
        // Mark some as important
        messages[3]!.importance = 0.9;
        messages[5]!.importance = 0.8;
        const result = await engine.compact(messages);
        expect(result.messages.some(m => m.importance === 0.9)).toBe(true);
        expect(result.messages.some(m => m.importance === 0.8)).toBe(true);
    });

    it('summary compaction generates summary', async () => {
        const engine = new CompactionEngine({ strategy: 'summary', windowSize: 6 });
        const messages = makeCompactionMessages(15);
        const result = await engine.compact(messages);
        expect(result.hasSummary).toBe(true);
        expect(result.messages.some(m => m.content.includes('Summary'))).toBe(true);
    });

    it('hybrid compaction works', async () => {
        const engine = new CompactionEngine({ strategy: 'hybrid', importanceThreshold: 0.9 });
        const messages = makeCompactionMessages(20);
        const result = await engine.compact(messages);
        // With 0.9 threshold, most auto-scored messages (~0.5) will be compacted
        expect(result.hasSummary).toBe(true);
        expect(result.strategy).toBe('hybrid');
    });

    it('preserves system messages', async () => {
        const engine = new CompactionEngine({ strategy: 'sliding_window', windowSize: 3 });
        const messages = makeCompactionMessages(20);
        const result = await engine.compact(messages);
        expect(result.messages[0]!.role).toBe('system');
    });

    it('preserves pinned messages', async () => {
        const engine = new CompactionEngine({ strategy: 'sliding_window', windowSize: 3 });
        const messages = makeCompactionMessages(20);
        messages[5]!.pinned = true;
        messages[5]!.content = 'PINNED MESSAGE';
        const result = await engine.compact(messages);
        expect(result.messages.some(m => m.content === 'PINNED MESSAGE')).toBe(true);
    });

    it('validateCompaction detects missing system message', () => {
        const original: CompactionMessage[] = [
            { role: 'system', content: 'System' },
            { role: 'user', content: 'Hello' },
        ];
        const compacted: CompactionMessage[] = [
            { role: 'user', content: 'Hello' },
        ];
        const validation = validateCompaction(original, compacted);
        expect(validation.valid).toBe(false);
        expect(validation.issues[0]).toContain('System message');
    });

    it('validateCompaction passes for valid compaction', () => {
        const original: CompactionMessage[] = [
            { role: 'system', content: 'System' },
            { role: 'user', content: 'A' },
            { role: 'assistant', content: 'B' },
        ];
        const compacted: CompactionMessage[] = [
            { role: 'system', content: 'System' },
            { role: 'assistant', content: 'B' },
        ];
        const validation = validateCompaction(original, compacted);
        expect(validation.valid).toBe(true);
    });

    it('tracks stats correctly', async () => {
        const engine = new CompactionEngine({ strategy: 'sliding_window', windowSize: 3 });
        await engine.compact(makeCompactionMessages(20));
        await engine.compact(makeCompactionMessages(15));
        const stats = engine.stats();
        expect(stats.totalCompactions).toBe(2);
        expect(stats.totalRemoved).toBeGreaterThan(0);
    });
});


// ═══════════════════════════════════════════════════════════════
// 4. MODEL FALLBACK CHAIN
// ═══════════════════════════════════════════════════════════════

describe('Model Fallback Chain', () => {
    const testModels: ModelConfig[] = [
        { id: 'model-a', provider: 'provider-a', priority: 1, supportsTools: true, supportsVision: true },
        { id: 'model-b', provider: 'provider-b', priority: 2, supportsTools: true, supportsVision: false },
        { id: 'model-c', provider: 'provider-c', priority: 3, supportsTools: false, supportsVision: false },
    ];

    it('uses first model when it succeeds', async () => {
        const chain = new ModelFallbackChain({ models: testModels });
        const result = await chain.execute(async (modelId) => `result-from-${modelId}`);
        expect(result.modelId).toBe('model-a');
        expect(result.result).toBe('result-from-model-a');
        expect(result.attemptCount).toBe(1);
        expect(result.failures).toHaveLength(0);
    });

    it('falls back to second model on failure', async () => {
        const chain = new ModelFallbackChain({ models: testModels, maxRetries: 0 });
        let callCount = 0;
        const result = await chain.execute(async (modelId) => {
            callCount++;
            if (modelId === 'model-a') throw new Error('401 Unauthorized');
            return `result-from-${modelId}`;
        });
        expect(result.modelId).toBe('model-b');
        expect(result.attemptCount).toBe(2);
        expect(result.failures).toHaveLength(1);
        expect(result.failures[0]!.reason).toBe('auth_failure');
    });

    it('falls back through entire chain', async () => {
        const chain = new ModelFallbackChain({ models: testModels, maxRetries: 0 });
        const result = await chain.execute(async (modelId) => {
            if (modelId === 'model-a') throw new Error('401 Unauthorized');
            if (modelId === 'model-b') throw new Error('429 Rate limit');
            return `result-from-${modelId}`;
        });
        expect(result.modelId).toBe('model-c');
        expect(result.attemptCount).toBe(3);
    });

    it('throws when all models fail', async () => {
        const chain = new ModelFallbackChain({ models: testModels, maxRetries: 0 });
        await expect(
            chain.execute(async () => { throw new Error('All broken'); })
        ).rejects.toThrow('All');
    });

    it('records observations', async () => {
        const chain = new ModelFallbackChain({ models: testModels, maxRetries: 0 });
        await chain.execute(async (modelId) => {
            if (modelId === 'model-a') throw new Error('401 Unauthorized');
            return 'ok';
        });

        const obsA = chain.getModelObservation('model-a')!;
        expect(obsA.failures).toBe(1);
        expect(obsA.lastFailureReason).toBe('auth_failure');

        const obsB = chain.getModelObservation('model-b')!;
        expect(obsB.successes).toBe(1);
    });

    it('applies cooldown on rate limit', async () => {
        const chain = new ModelFallbackChain({
            models: testModels,
            maxRetries: 0,
            cooldownMs: 60000,
        });

        // First call: model-a rate limited → model-b succeeds
        await chain.execute(async (modelId) => {
            if (modelId === 'model-a') throw new Error('429 Rate limit');
            return 'ok';
        });

        // Second call: model-a should be in cooldown → skip to model-b
        const result = await chain.execute(async (modelId) => `from-${modelId}`);
        expect(result.modelId).toBe('model-b'); // Skipped model-a
    });

    it('suppresses model after max failures', async () => {
        const chain = new ModelFallbackChain({
            models: testModels,
            maxRetries: 0,
            cooldownMs: 0, // No cooldown so model-a is retried each call
            maxFailuresBeforeSuppression: 3,
        });

        // Fail model-a three times
        for (let i = 0; i < 3; i++) {
            await chain.execute(async (modelId) => {
                if (modelId === 'model-a') throw new Error('500 Server Error');
                return 'ok';
            });
        }

        const obs = chain.getModelObservation('model-a')!;
        expect(obs.failures).toBeGreaterThanOrEqual(3);
        expect(obs.suppressedUntil).toBeDefined();
    });

    it('filters by capabilities', async () => {
        const chain = new ModelFallbackChain({ models: testModels, maxRetries: 0 });
        const result = await chain.execute(
            async (modelId) => `from-${modelId}`,
            { requireVision: true }
        );
        expect(result.modelId).toBe('model-a'); // Only model-a supports vision
    });

    it('getBestModel returns first available', () => {
        const chain = new ModelFallbackChain({ models: testModels });
        const best = chain.getBestModel();
        expect(best?.id).toBe('model-a');
    });

    it('getBestModel filters capabilities', () => {
        const chain = new ModelFallbackChain({ models: testModels });
        const bestVision = chain.getBestModel({ requireVision: true });
        expect(bestVision?.id).toBe('model-a');
    });

    it('health reports correct stats', () => {
        const chain = new ModelFallbackChain({ models: testModels });
        const h = chain.health();
        expect(h.totalModels).toBe(3);
        expect(h.availableModels).toBe(3);
        expect(h.suppressedModels).toBe(0);
    });

    it('manual suppress/unsuppress works', () => {
        const chain = new ModelFallbackChain({ models: testModels });
        chain.suppressModel('model-a');
        expect(chain.health().suppressedModels).toBe(1);
        chain.unsuppressModel('model-a');
        expect(chain.health().suppressedModels).toBe(0);
    });
});


// ═══════════════════════════════════════════════════════════════
// 5. MODEL CATALOG & FALLBACK FACTORY
// ═══════════════════════════════════════════════════════════════

describe('Model Catalog', () => {
    it('contains models from major providers', () => {
        const providers = new Set(MODEL_CATALOG.map(m => m.provider));
        expect(providers.has('openai')).toBe(true);
        expect(providers.has('anthropic')).toBe(true);
        expect(providers.has('google')).toBe(true);
        expect(providers.has('mistral')).toBe(true);
    });

    it('all models have required fields', () => {
        for (const model of MODEL_CATALOG) {
            expect(model.id).toBeTruthy();
            expect(model.provider).toBeTruthy();
            expect(typeof model.priority).toBe('number');
        }
    });

    it('createFallbackChain respects provider preferences', () => {
        const chain = createFallbackChain(['anthropic', 'openai']);
        const models = chain.getModels();
        // Anthropic models should come before OpenAI
        const firstAnthropic = models.findIndex(m => m.provider === 'anthropic');
        const firstOpenAI = models.findIndex(m => m.provider === 'openai');
        expect(firstAnthropic).toBeLessThan(firstOpenAI);
    });

    it('createFallbackChain includes all catalog models', () => {
        const chain = createFallbackChain(['openai']);
        expect(chain.getModels().length).toBe(MODEL_CATALOG.length);
    });
});
