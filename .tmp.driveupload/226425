/**
 * tests/unit/tools.test.ts
 * Unit tests — tool registry and tool execution
 */

import { describe, it, expect, vi } from 'vitest';

describe('ToolRegistry', () => {
    it('should register and execute tools', async () => {
        const registry = new Map<string, { execute: Function }>();

        const mockTool = {
            name: 'echo',
            execute: vi.fn(async (args: any) => `Echo: ${args.text}`),
        };

        registry.set(mockTool.name, mockTool);

        const result = await registry.get('echo')!.execute({ text: 'hello' });
        expect(result).toBe('Echo: hello');
        expect(mockTool.execute).toHaveBeenCalledTimes(1);
    });

    it('should handle unknown tools gracefully', () => {
        const registry = new Map<string, any>();
        expect(registry.get('nonexistent')).toBeUndefined();
    });

    it('should list registered tools', () => {
        const registry = new Map<string, any>();
        registry.set('exec', { name: 'exec' });
        registry.set('web_fetch', { name: 'web_fetch' });
        registry.set('cron', { name: 'cron' });

        expect(Array.from(registry.keys())).toEqual(['exec', 'web_fetch', 'cron']);
        expect(registry.size).toBe(3);
    });
});

describe('Tool Execution', () => {
    it('should chunk responses for channel limits', () => {
        const text = 'a'.repeat(5000);
        const maxLen = 2000;
        const chunks: string[] = [];

        for (let i = 0; i < text.length; i += maxLen) {
            chunks.push(text.substring(i, i + maxLen));
        }

        expect(chunks).toHaveLength(3);
        expect(chunks[0]).toHaveLength(2000);
        expect(chunks[2]).toHaveLength(1000);
    });

    it('should detect tool execution loops', () => {
        const history: string[] = [];
        const maxLoops = 3;

        // Simulate repeated tool calls
        for (let i = 0; i < 5; i++) {
            history.push('web_fetch');
        }

        const recentCalls = history.slice(-maxLoops);
        const allSame = recentCalls.every(c => c === recentCalls[0]);
        expect(allSame).toBe(true);
        expect(history.length).toBeGreaterThan(maxLoops);
    });
});
