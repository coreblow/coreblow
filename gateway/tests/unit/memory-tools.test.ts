/**
 * tests/unit/memory-tools.test.ts
 * Tests for memory tools (agent-facing API)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMemoryTools } from '../../src/memory/tools.js';
import { MemoryManager } from '../../src/memory/manager.js';

vi.mock('../../src/gateway/config.js', () => ({
    getHomeDir: () => '/tmp/coreblow-tools-test-' + Date.now(),
}));

describe('Memory Tools', () => {
    let tools: ReturnType<typeof createMemoryTools>;
    let memory: MemoryManager;

    beforeEach(async () => {
        memory = new MemoryManager({ embeddingBackend: 'local', autoMemorize: false });
        await memory.init();
        tools = createMemoryTools(memory);
    });

    it('should create 5 tools', () => {
        expect(tools.length).toBe(5);
    });

    it('should have correct tool names', () => {
        const names = tools.map(t => t.name).sort();
        expect(names).toEqual(['memory_forget', 'memory_list', 'memory_recall', 'memory_stats', 'memory_store']);
    });

    it('memory_store should store and return confirmation', async () => {
        const storeTool = tools.find(t => t.name === 'memory_store')!;
        const result = await storeTool.execute({ text: 'Test memory' });
        expect(result).toContain('✅');
        expect(result).toContain('Memory stored');
    });

    it('memory_recall should search memories', async () => {
        const storeTool = tools.find(t => t.name === 'memory_store')!;
        const recallTool = tools.find(t => t.name === 'memory_recall')!;

        await storeTool.execute({ text: 'TypeScript is great' });
        const result = await recallTool.execute({ query: 'TypeScript' });
        expect(typeof result).toBe('string');
    });

    it('memory_forget should delete memory', async () => {
        const storeTool = tools.find(t => t.name === 'memory_store')!;
        const forgetTool = tools.find(t => t.name === 'memory_forget')!;

        const storeResult = await storeTool.execute({ text: 'Forget me' });
        const idMatch = storeResult.match(/id: (\w+)/);
        if (idMatch) {
            const result = await forgetTool.execute({ id: idMatch[1] });
            expect(result).toContain('forgotten');
        }
    });

    it('memory_list should list recent memories', async () => {
        const storeTool = tools.find(t => t.name === 'memory_store')!;
        const listTool = tools.find(t => t.name === 'memory_list')!;

        await storeTool.execute({ text: 'Item 1' });
        await storeTool.execute({ text: 'Item 2' });
        const result = await listTool.execute({ count: 10 });
        expect(result).toContain('Memories');
    });

    it('memory_stats should return statistics', async () => {
        const statsTool = tools.find(t => t.name === 'memory_stats')!;
        const result = await statsTool.execute({});
        expect(result).toContain('Memory Stats');
        expect(result).toContain('Backend');
    });

    it('memory_list with no memories should return empty message', async () => {
        const listTool = tools.find(t => t.name === 'memory_list')!;
        const result = await listTool.execute({});
        expect(result).toContain('No memories');
    });

    it('memory_forget non-existent should return not found', async () => {
        const forgetTool = tools.find(t => t.name === 'memory_forget')!;
        const result = await forgetTool.execute({ id: 'non-existent' });
        expect(result).toContain('not found');
    });
});
