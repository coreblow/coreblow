import { describe, it, expect, vi } from 'vitest';

vi.mock('../agents/sandbox-tool-policy.js', () => ({
    pickSandboxToolPolicy: vi.fn(() => ({ allow: ['*'] })),
}));

import { pickSandboxToolPolicy } from './audit-tool-policy.js';

describe('audit-tool-policy', () => {
    it('should re-export pickSandboxToolPolicy from agents module', () => {
        expect(pickSandboxToolPolicy).toBeDefined();
        expect(typeof pickSandboxToolPolicy).toBe('function');
    });

    it('should call through to the mocked implementation', () => {
        const result = pickSandboxToolPolicy({} as any);
        expect(result).toEqual({ allow: ['*'] });
    });
});
