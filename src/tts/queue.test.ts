import { describe, it, expect } from 'vitest';
import { TTSQueue } from './queue.js';

describe('TTSQueue', () => {
    it('should add and process item', async () => {
        const q = new TTSQueue();
        const result = await q.add('hello', 'alloy');
        expect(result).toBeDefined();
    });
});
