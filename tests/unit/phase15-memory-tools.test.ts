/**
 * CoreBlow Phase 15 — Memory & Tool System Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStore } from '../../src/memory/memory-store.js';
import { VectorStore } from '../../src/memory/vector-store.js';
import { ToolRegistry } from '../../src/tools/tool-registry.js';
import { ToolExecutor } from '../../src/tools/tool-executor.js';
import { WorkflowEngine } from '../../src/tools/workflow-engine.js';

// ================================================================
// Memory Store Tests
// ================================================================
describe('MemoryStore', () => {
    let store: MemoryStore;
    beforeEach(() => { store = new MemoryStore(); });

    it('should create a conversation', () => {
        const conv = store.create('Test Chat');
        expect(conv.id).toBeTruthy();
        expect(conv.title).toBe('Test Chat');
    });

    it('should add messages', () => {
        const conv = store.create();
        store.addMessage(conv.id, 'user', 'Hello');
        store.addMessage(conv.id, 'assistant', 'Hi there!');
        const msgs = store.getMessages(conv.id);
        expect(msgs).toHaveLength(2);
    });

    it('should get a conversation', () => {
        const conv = store.create('My Chat');
        expect(store.get(conv.id)?.title).toBe('My Chat');
    });

    it('should return null for missing conversation', () => {
        expect(store.addMessage('nonexistent', 'user', 'test')).toBeNull();
    });

    it('should search across messages', () => {
        const conv = store.create();
        store.addMessage(conv.id, 'user', 'How to use TypeScript?');
        store.addMessage(conv.id, 'assistant', 'TypeScript is a typed language');
        const results = store.search('TypeScript');
        expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('should list conversations', () => {
        store.create('Chat 1');
        store.create('Chat 2');
        expect(store.list()).toHaveLength(2);
    });

    it('should delete a conversation', () => {
        const conv = store.create();
        expect(store.delete(conv.id)).toBe(true);
        expect(store.get(conv.id)).toBeNull();
    });

    it('should summarize', async () => {
        const conv = store.create();
        store.addMessage(conv.id, 'user', 'Hello');
        const summary = await store.summarize(conv.id);
        expect(summary).toContain('1 messages');
    });

    it('should get stats', () => {
        const conv = store.create();
        store.addMessage(conv.id, 'user', 'msg');
        const stats = store.getStats();
        expect(stats.conversations).toBe(1);
        expect(stats.totalMessages).toBe(1);
    });
});

// ================================================================
// Vector Store Tests
// ================================================================
describe('VectorStore', () => {
    let store: VectorStore;
    beforeEach(() => { store = new VectorStore({ dimensions: 3 }); });

    it('should add documents', () => {
        store.add('doc1', 'Hello world', [1, 0, 0]);
        expect(store.count()).toBe(1);
    });

    it('should search by cosine similarity', () => {
        store.add('doc1', 'TypeScript guide', [1, 0, 0]);
        store.add('doc2', 'Python guide', [0, 1, 0]);
        store.add('doc3', 'TypeScript tutorial', [0.9, 0.1, 0]);

        const results = store.search([1, 0, 0], { topK: 2 });
        expect(results[0]!.document.id).toBe('doc1');
        expect(results[0]!.score).toBeCloseTo(1.0, 1);
    });

    it('should filter by namespace', () => {
        store.add('doc1', 'A', [1, 0, 0], {}, 'ns1');
        store.add('doc2', 'B', [0, 1, 0], {}, 'ns2');
        const results = store.search([1, 0, 0], { namespace: 'ns1' });
        expect(results).toHaveLength(1);
    });

    it('should filter by custom function', () => {
        store.add('doc1', 'public', [1, 0, 0], { public: true });
        store.add('doc2', 'private', [0.9, 0, 0], { public: false });
        const results = store.search([1, 0, 0], { filter: (d) => d.metadata?.public === true });
        expect(results).toHaveLength(1);
    });

    it('should delete documents', () => {
        store.add('doc1', 'A', [1, 0, 0]);
        expect(store.delete('doc1')).toBe(true);
        expect(store.count()).toBe(0);
    });

    it('should delete by namespace', () => {
        store.add('d1', 'A', [1, 0, 0], {}, 'temp');
        store.add('d2', 'B', [0, 1, 0], {}, 'temp');
        store.add('d3', 'C', [0, 0, 1], {}, 'keep');
        expect(store.deleteNamespace('temp')).toBe(2);
        expect(store.count()).toBe(1);
    });

    it('should list namespaces', () => {
        store.add('d1', 'A', [1, 0, 0], {}, 'alpha');
        store.add('d2', 'B', [0, 1, 0], {}, 'beta');
        expect(store.listNamespaces().sort()).toEqual(['alpha', 'beta']);
    });

    it('should apply minScore', () => {
        store.add('doc1', 'Match', [1, 0, 0]);
        store.add('doc2', 'No match', [0, 1, 0]);
        const results = store.search([1, 0, 0], { minScore: 0.9 });
        expect(results).toHaveLength(1);
    });
});

// ================================================================
// Tool Registry Tests
// ================================================================
describe('ToolRegistry', () => {
    let registry: ToolRegistry;
    beforeEach(() => { registry = new ToolRegistry(); });

    it('should register tools', () => {
        registry.register({
            name: 'weather',
            description: 'Get weather',
            parameters: { type: 'object', properties: { city: { type: 'string' } }, required: ['city'] },
            handler: async () => 'Sunny',
        });
        expect(registry.count()).toBe(1);
    });

    it('should get a tool', () => {
        registry.register({ name: 'calc', description: 'Calculate', parameters: { type: 'object', properties: {} }, handler: async () => '42' });
        expect(registry.get('calc')?.name).toBe('calc');
    });

    it('should check existence', () => {
        registry.register({ name: 'test', description: 'Test', parameters: { type: 'object', properties: {} }, handler: async () => '' });
        expect(registry.has('test')).toBe(true);
        expect(registry.has('nope')).toBe(false);
    });

    it('should export OpenAI format', () => {
        registry.register({ name: 'search', description: 'Search the web', parameters: { type: 'object', properties: { q: { type: 'string' } } }, handler: async () => '' });
        const tools = registry.toOpenAI();
        expect(tools[0]!.type).toBe('function');
        expect(tools[0]!.function.name).toBe('search');
    });

    it('should filter by permission', () => {
        registry.register({ name: 'public_tool', description: '', parameters: { type: 'object', properties: {} }, handler: async () => '', permission: 'public' });
        registry.register({ name: 'owner_tool', description: '', parameters: { type: 'object', properties: {} }, handler: async () => '', permission: 'owner' });
        expect(registry.toOpenAI('public')).toHaveLength(1);
        expect(registry.toOpenAI('owner')).toHaveLength(2);
    });

    it('should enable/disable tools', () => {
        registry.register({ name: 'tool1', description: '', parameters: { type: 'object', properties: {} }, handler: async () => '' });
        registry.setEnabled('tool1', false);
        expect(registry.toOpenAI()).toHaveLength(0);
    });

    it('should list by category', () => {
        registry.register({ name: 't1', description: '', parameters: { type: 'object', properties: {} }, handler: async () => '', category: 'math' });
        registry.register({ name: 't2', description: '', parameters: { type: 'object', properties: {} }, handler: async () => '', category: 'math' });
        const cats = registry.listByCategory();
        expect(cats['math']).toHaveLength(2);
    });
});

// ================================================================
// Tool Executor Tests
// ================================================================
describe('ToolExecutor', () => {
    let registry: ToolRegistry;
    let executor: ToolExecutor;

    beforeEach(() => {
        registry = new ToolRegistry();
        registry.register({ name: 'greet', description: 'Greet', parameters: { type: 'object', properties: {} }, handler: async (args) => `Hello ${args.name ?? 'World'}` });
        registry.register({ name: 'fail', description: 'Fail', parameters: { type: 'object', properties: {} }, handler: async () => { throw new Error('boom'); } });
        executor = new ToolExecutor(registry, { maxRetries: 1, timeoutMs: 5000 });
    });

    it('should execute a tool', async () => {
        const result = await executor.execute('greet', { name: 'Alice' }, 'call-1');
        expect(result.success).toBe(true);
        expect(result.output).toBe('Hello Alice');
    });

    it('should handle missing tools', async () => {
        const result = await executor.execute('nonexistent', {}, 'call-2');
        expect(result.success).toBe(false);
    });

    it('should handle tool errors with retry', async () => {
        const result = await executor.execute('fail', {}, 'call-3');
        expect(result.success).toBe(false);
        expect(result.error).toContain('boom');
    });

    it('should execute many in parallel', async () => {
        const results = await executor.executeMany([
            { toolName: 'greet', args: { name: 'A' }, callId: 'c1' },
            { toolName: 'greet', args: { name: 'B' }, callId: 'c2' },
        ]);
        expect(results).toHaveLength(2);
        expect(results.every((r) => r.success)).toBe(true);
    });

    it('should track stats', async () => {
        await executor.execute('greet', {}, 'c1');
        await executor.execute('fail', {}, 'c2');
        const stats = executor.getStats();
        expect(stats.totalCalls).toBe(2);
    });
});

// ================================================================
// Workflow Engine Tests
// ================================================================
describe('WorkflowEngine', () => {
    let engine: WorkflowEngine;
    beforeEach(() => { engine = new WorkflowEngine(); });

    it('should register and execute a workflow', async () => {
        engine.register({
            id: 'wf1', name: 'Simple', steps: [
                { id: 's1', name: 'Step 1', handler: async () => 'done' },
            ],
        });
        const result = await engine.execute('wf1');
        expect(result.status).toBe('completed');
        expect(result.steps[0]!.status).toBe('success');
    });

    it('should pass context between steps', async () => {
        engine.register({
            id: 'wf2', name: 'Chain', steps: [
                { id: 's1', name: 'First', handler: async () => 42 },
                { id: 's2', name: 'Second', handler: async (ctx) => `Got ${ctx.results['s1']}` },
            ],
        });
        const result = await engine.execute('wf2');
        expect(result.context.results['s2']).toBe('Got 42');
    });

    it('should skip conditional steps', async () => {
        engine.register({
            id: 'wf3', name: 'Conditional', steps: [
                { id: 's1', name: 'Always', handler: async () => 'yes' },
                { id: 's2', name: 'Skip', handler: async () => 'no', condition: () => false },
            ],
        });
        const result = await engine.execute('wf3');
        expect(result.steps[1]!.status).toBe('skipped');
    });

    it('should handle errors with skip strategy', async () => {
        engine.register({
            id: 'wf4', name: 'ErrorSkip', steps: [
                { id: 's1', name: 'Fail', handler: async () => { throw new Error('oops'); }, onError: 'skip' },
                { id: 's2', name: 'Continue', handler: async () => 'still running' },
            ],
        });
        const result = await engine.execute('wf4');
        expect(result.steps[0]!.status).toBe('skipped');
        expect(result.steps[1]!.status).toBe('success');
    });

    it('should fail on unhandled errors', async () => {
        engine.register({
            id: 'wf5', name: 'Fail', steps: [
                { id: 's1', name: 'Boom', handler: async () => { throw new Error('fatal'); }, onError: 'fail' },
                { id: 's2', name: 'Never', handler: async () => 'nope' },
            ],
        });
        const result = await engine.execute('wf5');
        expect(result.status).toBe('failed');
        expect(result.steps).toHaveLength(1);
    });

    it('should list workflows', () => {
        engine.register({ id: 'a', name: 'A', steps: [] });
        engine.register({ id: 'b', name: 'B', steps: [{ id: 's', name: 'S', handler: async () => {} }] });
        expect(engine.list()).toHaveLength(2);
    });

    it('should throw for unknown workflow', async () => {
        await expect(engine.execute('unknown')).rejects.toThrow('not found');
    });

    it('should accept initial data', async () => {
        engine.register({
            id: 'wf6', name: 'Data', steps: [
                { id: 's1', name: 'Read', handler: async (ctx) => ctx.metadata['input'] },
            ],
        });
        const result = await engine.execute('wf6', { input: 'hello' });
        expect(result.context.results['s1']).toBe('hello');
    });
});
