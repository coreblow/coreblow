import { describe, it, expect } from 'vitest';
import { exampleTool } from '../src/tools.js';
import { statusCommand } from '../src/commands.js';

describe('full-plugin', () => {
    describe('exampleTool', () => {
        it('should execute with query', async () => {
            const result = await exampleTool.execute({ query: 'test' });
            expect(result).toContain('test');
        });
    });

    describe('statusCommand', () => {
        it('should return status', async () => {
            const result = await statusCommand.handler();
            expect(result).toContain('running');
        });
    });
});
