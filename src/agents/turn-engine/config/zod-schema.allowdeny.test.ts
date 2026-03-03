import { describe, it, expect } from 'vitest';
import { AllowDenySchema, checkAllowDeny } from './zod-schema.allowdeny.js';

describe('AllowDeny Schema', () => {
    it('should validate allow-only config', () => {
        const result = AllowDenySchema.safeParse({ allow: ['bash', 'python'] });
        expect(result.success).toBe(true);
    });

    it('should validate deny-only config', () => {
        const result = AllowDenySchema.safeParse({ deny: ['rm'] });
        expect(result.success).toBe(true);
    });

    it('should reject both allow and deny', () => {
        const result = AllowDenySchema.safeParse({ allow: ['bash'], deny: ['rm'] });
        expect(result.success).toBe(false);
    });

    it('should check allow rules', () => {
        expect(checkAllowDeny('bash', { allow: ['bash', 'python'] })).toBe(true);
        expect(checkAllowDeny('curl', { allow: ['bash', 'python'] })).toBe(false);
    });

    it('should check deny rules', () => {
        expect(checkAllowDeny('rm', { deny: ['rm'] })).toBe(false);
        expect(checkAllowDeny('ls', { deny: ['rm'] })).toBe(true);
    });
});
