import { describe, it, expect, vi } from 'vitest';
import { SessionManagerRegistry, type SessionManagerExtension } from './session-manager.js';

describe('Session Manager Registry', () => {
    const ext: SessionManagerExtension = {
        id: 'test-mgr',
        onSessionCreate: vi.fn(),
        onSessionResume: vi.fn(),
        onSessionEnd: vi.fn(),
        onSessionExport: vi.fn().mockResolvedValue({ key: 'val' }),
        onSessionImport: vi.fn(),
    };

    it('registers and lists', () => {
        const registry = new SessionManagerRegistry();
        registry.register(ext);
        expect(registry.list()).toHaveLength(1);
        expect(registry.get('test-mgr')).toBe(ext);
    });

    it('unregisters', () => {
        const registry = new SessionManagerRegistry();
        registry.register(ext);
        expect(registry.unregister('test-mgr')).toBe(true);
        expect(registry.get('test-mgr')).toBeUndefined();
    });

    it('notifies create', async () => {
        const registry = new SessionManagerRegistry();
        const fn = vi.fn();
        registry.register({ id: 'a', onSessionCreate: fn });
        await registry.notifyCreate('session-1', { user: 'alice' });
        expect(fn).toHaveBeenCalledWith('session-1', { user: 'alice' });
    });

    it('notifies resume', async () => {
        const registry = new SessionManagerRegistry();
        const fn = vi.fn();
        registry.register({ id: 'a', onSessionResume: fn });
        await registry.notifyResume('session-1');
        expect(fn).toHaveBeenCalledWith('session-1');
    });

    it('notifies end', async () => {
        const registry = new SessionManagerRegistry();
        const fn = vi.fn();
        registry.register({ id: 'a', onSessionEnd: fn });
        await registry.notifyEnd('session-1');
        expect(fn).toHaveBeenCalledWith('session-1');
    });

    it('exports all', async () => {
        const registry = new SessionManagerRegistry();
        registry.register({ id: 'a', onSessionExport: async () => ({ x: 1 }) });
        registry.register({ id: 'b', onSessionExport: async () => ({ y: 2 }) });
        const exported = await registry.exportAll('session-1');
        expect(exported.a).toEqual({ x: 1 });
        expect(exported.b).toEqual({ y: 2 });
    });

    it('imports all', async () => {
        const registry = new SessionManagerRegistry();
        const fn = vi.fn();
        registry.register({ id: 'a', onSessionImport: fn });
        await registry.importAll('session-1', { a: { imported: true } });
        expect(fn).toHaveBeenCalledWith('session-1', { imported: true });
    });

    it('handles extension errors gracefully', async () => {
        const registry = new SessionManagerRegistry();
        registry.register({ id: 'fail', onSessionCreate: async () => { throw new Error('boom'); } });
        await expect(registry.notifyCreate('s', {})).resolves.not.toThrow();
    });
});
