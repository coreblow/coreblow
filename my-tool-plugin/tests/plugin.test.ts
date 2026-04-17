import { describe, it, expect } from 'vitest';
import { exampleTool } from '../src/tools.js';

describe('my-tool-plugin', () => {
    describe('exampleTool', () => {
        it('should execute with query', async () => {
            const result = await exampleTool.execute({ query: 'test' });
            expect(result).toContain('test');
        });
    });
});
