import { describe, it, expect, beforeEach } from 'vitest';
import { ApiKeyManager } from './api-key-manager.js';

describe('ApiKeyManager', () => {
    let mgr: ApiKeyManager;

    beforeEach(() => {
        mgr = new ApiKeyManager();
    });

    describe('create', () => {
        it('creates a key with cb_ prefix', () => {
            const key = mgr.create('test-key', 'user1');
            expect(key.key).toMatch(/^cb_/);
            expect(key.name).toBe('test-key');
            expect(key.owner).toBe('user1');
            expect(key.active).toBe(true);
            expect(key.usage).toBe(0);
        });

        it('uses default scopes and rate limit', () => {
            const key = mgr.create('k', 'u');
            expect(key.scopes).toEqual(['*']);
            expect(key.rateLimit).toBe(1000);
        });

        it('accepts custom scopes, rate limit, and expiry', () => {
            const key = mgr.create('k', 'u', ['read', 'write'], 50, 60_000);
            expect(key.scopes).toEqual(['read', 'write']);
            expect(key.rateLimit).toBe(50);
            expect(key.expiresAt).toBeDefined();
            expect(key.expiresAt!).toBeGreaterThan(Date.now());
        });

        it('assigns unique IDs', () => {
            const k1 = mgr.create('a', 'u');
            const k2 = mgr.create('b', 'u');
            expect(k1.id).not.toBe(k2.id);
            expect(k1.key).not.toBe(k2.key);
        });
    });

    describe('validate', () => {
        it('validates a valid key', () => {
            const key = mgr.create('k', 'u');
            const result = mgr.validate(key.key);
            expect(result.valid).toBe(true);
            expect(result.apiKey!.usage).toBe(1);
        });

        it('rejects unknown key', () => {
            const result = mgr.validate('cb_nonexistent');
            expect(result.valid).toBe(false);
            expect(result.error).toContain('not found');
        });

        it('rejects inactive key', () => {
            const key = mgr.create('k', 'u');
            mgr.deactivate(key.id);
            const result = mgr.validate(key.key);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('inactive');
        });

        it('rejects expired key', () => {
            const key = mgr.create('k', 'u', ['*'], 1000, 1);
            // Wait for expiry
            const start = Date.now();
            while (Date.now() - start < 5) {}
            const result = mgr.validate(key.key);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('expired');
        });

        it('rejects when rate limit exceeded', () => {
            const key = mgr.create('k', 'u', ['*'], 2);
            mgr.validate(key.key);
            mgr.validate(key.key);
            const result = mgr.validate(key.key);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('Rate limit');
        });

        it('validates scope — wildcard allows everything', () => {
            const key = mgr.create('k', 'u', ['*']);
            expect(mgr.validate(key.key, 'admin').valid).toBe(true);
        });

        it('rejects insufficient scope', () => {
            const key = mgr.create('k', 'u', ['read']);
            const result = mgr.validate(key.key, 'admin');
            expect(result.valid).toBe(false);
            expect(result.error).toContain('scope');
        });

        it('allows matching scope', () => {
            const key = mgr.create('k', 'u', ['read', 'write']);
            expect(mgr.validate(key.key, 'read').valid).toBe(true);
        });
    });

    describe('rotate', () => {
        it('generates a new key for same ID', () => {
            const key = mgr.create('k', 'u');
            const oldKey = key.key;
            const rotated = mgr.rotate(key.id);
            expect(rotated).not.toBeNull();
            expect(rotated!.key).not.toBe(oldKey);
            expect(rotated!.id).toBe(key.id);
        });

        it('old key is invalid after rotation', () => {
            const key = mgr.create('k', 'u');
            const oldKey = key.key;
            mgr.rotate(key.id);
            expect(mgr.validate(oldKey).valid).toBe(false);
        });

        it('new key is valid after rotation', () => {
            const key = mgr.create('k', 'u');
            const rotated = mgr.rotate(key.id)!;
            expect(mgr.validate(rotated.key).valid).toBe(true);
        });

        it('returns null for unknown ID', () => {
            expect(mgr.rotate('fake-id')).toBeNull();
        });
    });

    describe('deactivate', () => {
        it('deactivates an existing key', () => {
            const key = mgr.create('k', 'u');
            expect(mgr.deactivate(key.id)).toBe(true);
        });

        it('returns false for unknown ID', () => {
            expect(mgr.deactivate('fake')).toBe(false);
        });
    });

    describe('listByOwner', () => {
        it('lists keys for a specific owner', () => {
            mgr.create('a', 'user1');
            mgr.create('b', 'user1');
            mgr.create('c', 'user2');
            expect(mgr.listByOwner('user1')).toHaveLength(2);
            expect(mgr.listByOwner('user2')).toHaveLength(1);
            expect(mgr.listByOwner('user3')).toHaveLength(0);
        });
    });

    describe('stats', () => {
        it('tracks operations', () => {
            const k = mgr.create('k', 'u');
            mgr.validate(k.key);
            mgr.validate('bad-key');
            mgr.rotate(k.id);
            const stats = mgr.getStats();
            expect(stats.created).toBe(1);
            expect(stats.validated).toBe(1);
            expect(stats.rejected).toBe(1);
            expect(stats.rotated).toBe(1);
        });
    });
});
