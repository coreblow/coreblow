/**
 * CoreBlow — Sandbox Tool Policy Tests
 *
 * Tests for pickSandboxToolPolicy and unionAllow logic.
 */

import { describe, it, expect } from 'vitest';
import { pickSandboxToolPolicy } from './sandbox-tool-policy.js';

describe('pickSandboxToolPolicy', () => {
    it('returns undefined for no config', () => {
        expect(pickSandboxToolPolicy()).toBeUndefined();
    });

    it('returns undefined for empty config', () => {
        expect(pickSandboxToolPolicy({})).toBeUndefined();
    });

    it('returns allow list', () => {
        const policy = pickSandboxToolPolicy({ allow: ['read', 'write'] });
        expect(policy).toEqual({ allow: ['read', 'write'], deny: undefined });
    });

    it('returns deny list', () => {
        const policy = pickSandboxToolPolicy({ deny: ['exec'] });
        expect(policy).toEqual({ allow: undefined, deny: ['exec'] });
    });

    it('combines allow and deny', () => {
        const policy = pickSandboxToolPolicy({ allow: ['read'], deny: ['exec'] });
        expect(policy!.allow).toEqual(['read']);
        expect(policy!.deny).toEqual(['exec']);
    });

    it('alsoAllow merges with allow', () => {
        const policy = pickSandboxToolPolicy({ allow: ['read'], alsoAllow: ['write'] });
        expect(policy!.allow).toContain('read');
        expect(policy!.allow).toContain('write');
    });

    it('alsoAllow without allow creates "*" + extras', () => {
        const policy = pickSandboxToolPolicy({ alsoAllow: ['special'] });
        expect(policy!.allow).toContain('*');
        expect(policy!.allow).toContain('special');
    });

    it('deduplicates alsoAllow entries', () => {
        const policy = pickSandboxToolPolicy({ allow: ['read', 'write'], alsoAllow: ['read'] });
        const count = policy!.allow!.filter(x => x === 'read').length;
        expect(count).toBe(1);
    });

    it('empty arrays still produce policy (arrays are truthy)', () => {
        const policy = pickSandboxToolPolicy({ allow: [], deny: [] });
        expect(policy).toEqual({ allow: [], deny: [] });
    });
});
