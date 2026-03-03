import { describe, it, expect } from 'vitest';
import { negotiateCapabilities } from './capability.js';

describe('ACP Capabilities', () => {
    it('should find matching capabilities', () => {
        const local = [{ name: 'chat', version: '1.0', methods: ['send'] }];
        const remote = [{ name: 'chat', version: '1.0', methods: ['send', 'receive'] }];
        const result = negotiateCapabilities(local, remote);
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('chat');
    });

    it('should return empty for no match', () => {
        const local = [{ name: 'chat', version: '1.0', methods: [] }];
        const remote = [{ name: 'files', version: '1.0', methods: [] }];
        expect(negotiateCapabilities(local, remote)).toHaveLength(0);
    });
});
