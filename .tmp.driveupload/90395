/**
 * commands/batch.test.ts — Batch executor tests
 */
import { describe, it, expect } from 'vitest';
import { BatchExecutor } from './batch.js';

describe('BatchExecutor', () => {
    it('should execute batch commands', async () => {
        const batch = new BatchExecutor();
        const results = await batch.executeBatch(
            ['echo a', 'echo b'],
            async (cmd) => `result: ${cmd}`,
        );
        expect(results).toHaveLength(2);
        expect(results[0].result).toBe('result: echo a');
        expect(results[1].result).toBe('result: echo b');
    });

    it('should handle empty batch', async () => {
        const batch = new BatchExecutor();
        const results = await batch.executeBatch([], async () => '');
        expect(results).toHaveLength(0);
    });
});
