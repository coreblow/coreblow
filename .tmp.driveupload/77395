import { describe, it, expect } from 'vitest';

describe('named-plugin', () => {
    it('should load plugin', async () => {
        const plugin = await import('../src/index.js');
        expect(plugin.default.meta.name).toBe('named-plugin');
    });
});
