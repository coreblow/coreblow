/**
 * agents/auth-profiles.test.ts
 */
import { describe, it, expect } from 'vitest';
import { AuthProfileManager } from './auth-profiles.js';

describe('Auth Profile Manager', () => {
    it('adds and selects profile', () => {
        const mgr = new AuthProfileManager();
        mgr.addProfile({ id: 'p1', provider: 'openai', priority: 1 });
        const selected = mgr.selectProfile('openai');
        expect(selected).not.toBeNull();
        expect(selected!.id).toBe('p1');
    });

    it('selects by priority', () => {
        const mgr = new AuthProfileManager();
        mgr.addProfile({ id: 'p1', provider: 'openai', priority: 2 });
        mgr.addProfile({ id: 'p2', provider: 'openai', priority: 1 });
        expect(mgr.selectProfile('openai')!.id).toBe('p2');
    });

    it('records success', () => {
        const mgr = new AuthProfileManager();
        mgr.addProfile({ id: 'p1', provider: 'openai', priority: 1 });
        mgr.recordSuccess('p1');
        expect(mgr.listAll()[0].usageCount).toBe(1);
    });

    it('records failure and enters cooldown', () => {
        const mgr = new AuthProfileManager();
        mgr.addProfile({ id: 'p1', provider: 'openai', priority: 1 });
        mgr.recordFailure('p1', 10000);
        expect(mgr.listAll()[0].status).toBe('cooldown');
    });

    it('disables after 5 failures', () => {
        const mgr = new AuthProfileManager();
        mgr.addProfile({ id: 'p1', provider: 'openai', priority: 1 });
        for (let i = 0; i < 5; i++) mgr.recordFailure('p1');
        expect(mgr.listAll()[0].status).toBe('disabled');
    });

    it('restores profile', () => {
        const mgr = new AuthProfileManager();
        mgr.addProfile({ id: 'p1', provider: 'openai', priority: 1 });
        mgr.recordFailure('p1', 10000);
        mgr.restore('p1');
        expect(mgr.listAll()[0].status).toBe('active');
    });

    it('skips cooled-down profiles', () => {
        const mgr = new AuthProfileManager();
        mgr.addProfile({ id: 'p1', provider: 'openai', priority: 1 });
        mgr.addProfile({ id: 'p2', provider: 'openai', priority: 2 });
        mgr.recordFailure('p1', 60000); // cooldown
        expect(mgr.selectProfile('openai')!.id).toBe('p2');
    });

    it('removes profile', () => {
        const mgr = new AuthProfileManager();
        mgr.addProfile({ id: 'p1', provider: 'openai', priority: 1 });
        expect(mgr.remove('p1')).toBe(true);
        expect(mgr.listAll()).toHaveLength(0);
    });

    it('serializes to/from store', () => {
        const mgr = new AuthProfileManager();
        mgr.addProfile({ id: 'p1', provider: 'openai', priority: 1 });
        const store = mgr.toStore();
        const restored = AuthProfileManager.fromStore(store);
        expect(restored.listAll()).toHaveLength(1);
        expect(restored.listAll()[0].id).toBe('p1');
    });

    it('prunes expired cooldowns', async () => {
        const mgr = new AuthProfileManager();
        mgr.addProfile({ id: 'p1', provider: 'openai', priority: 1 });
        mgr.recordFailure('p1', 30); // 30ms cooldown
        await new Promise((r) => setTimeout(r, 60));
        expect(mgr.pruneExpiredCooldowns()).toBe(1);
        expect(mgr.listAll()[0].status).toBe('active');
    });
});
