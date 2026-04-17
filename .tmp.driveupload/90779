/**
 * Tests for CoreBlow Session Write Lock Manager
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SessionWriteLockManager } from './session-write-lock.js';

describe('SessionWriteLockManager', () => {
    let manager: SessionWriteLockManager;

    beforeEach(() => {
        manager = new SessionWriteLockManager(60_000); // Long cleanup interval for tests
    });

    afterEach(() => {
        manager.shutdown();
    });

    describe('acquire', () => {
        it('should acquire a lock on uncontested session', async () => {
            const result = await manager.acquire('session-1', { holder: 'handler-1' });
            expect(result.acquired).toBe(true);
            expect(result.lock).toBeDefined();
            expect(result.lock!.sessionId).toBe('session-1');
            expect(result.lock!.holder).toBe('handler-1');
            expect(result.lock!.depth).toBe(1);
        });

        it('should reject when session is already locked by another holder', async () => {
            await manager.acquire('session-1', { holder: 'handler-1' });
            const result = await manager.acquire('session-1', { holder: 'handler-2' });
            expect(result.acquired).toBe(false);
            expect(result.error).toContain('locked by');
        });

        it('should allow re-entrant locking by same holder', async () => {
            await manager.acquire('session-1', { holder: 'handler-1', reentrant: true });
            const result = await manager.acquire('session-1', { holder: 'handler-1', reentrant: true });
            expect(result.acquired).toBe(true);
            expect(result.lock!.depth).toBe(2);
        });

        it('should acquire lock on expired session', async () => {
            await manager.acquire('session-1', { holder: 'handler-1', timeoutMs: 1 });
            // Wait for expiry
            await new Promise((r) => setTimeout(r, 10));
            const result = await manager.acquire('session-1', { holder: 'handler-2' });
            expect(result.acquired).toBe(true);
            expect(result.lock!.holder).toBe('handler-2');
        });

        it('should support custom timeout', async () => {
            const result = await manager.acquire('session-1', { holder: 'h', timeoutMs: 60_000 });
            expect(result.lock!.expiresAt).toBeGreaterThan(Date.now() + 50_000);
        });

        it('should support metadata', async () => {
            const result = await manager.acquire('session-1', {
                holder: 'handler-1',
                metadata: { purpose: 'chat' },
            });
            expect(result.lock!.metadata).toEqual({ purpose: 'chat' });
        });
    });

    describe('release', () => {
        it('should release a held lock', async () => {
            await manager.acquire('session-1', { holder: 'handler-1' });
            const released = manager.release('session-1', 'handler-1');
            expect(released).toBe(true);
            expect(manager.isLocked('session-1')).toBe(false);
        });

        it('should reject release from wrong holder', async () => {
            await manager.acquire('session-1', { holder: 'handler-1' });
            const released = manager.release('session-1', 'handler-2');
            expect(released).toBe(false);
            expect(manager.isLocked('session-1')).toBe(true);
        });

        it('should return false for unlocked session', () => {
            expect(manager.release('nonexistent', 'anyone')).toBe(false);
        });

        it('should decrement depth for re-entrant locks', async () => {
            await manager.acquire('session-1', { holder: 'h', reentrant: true });
            await manager.acquire('session-1', { holder: 'h', reentrant: true });
            manager.release('session-1', 'h');
            expect(manager.isLocked('session-1')).toBe(true); // depth was 2, now 1
            manager.release('session-1', 'h');
            expect(manager.isLocked('session-1')).toBe(false); // fully released
        });
    });

    describe('isLocked', () => {
        it('should return true for locked session', async () => {
            await manager.acquire('session-1', { holder: 'handler-1' });
            expect(manager.isLocked('session-1')).toBe(true);
        });

        it('should return false for unlocked session', () => {
            expect(manager.isLocked('session-1')).toBe(false);
        });

        it('should return false for expired lock', async () => {
            await manager.acquire('session-1', { holder: 'handler-1', timeoutMs: 1 });
            await new Promise((r) => setTimeout(r, 10));
            expect(manager.isLocked('session-1')).toBe(false);
        });
    });

    describe('getLockInfo', () => {
        it('should return lock info for active lock', async () => {
            await manager.acquire('session-1', { holder: 'handler-1' });
            const info = manager.getLockInfo('session-1');
            expect(info).not.toBeNull();
            expect(info!.holder).toBe('handler-1');
        });

        it('should return null for no lock', () => {
            expect(manager.getLockInfo('nonexistent')).toBeNull();
        });
    });

    describe('forceRelease', () => {
        it('should force-release a lock', async () => {
            await manager.acquire('session-1', { holder: 'handler-1' });
            const released = manager.forceRelease('session-1');
            expect(released).toBe(true);
            expect(manager.isLocked('session-1')).toBe(false);
        });

        it('should return false for unlocked session', () => {
            expect(manager.forceRelease('nonexistent')).toBe(false);
        });
    });

    describe('withLock', () => {
        it('should execute function while holding lock', async () => {
            let executed = false;
            const result = await manager.withLock('session-1', { holder: 'handler-1' }, async () => {
                executed = true;
                expect(manager.isLocked('session-1')).toBe(true);
                return 'done';
            });
            expect(executed).toBe(true);
            expect(result.result).toBe('done');
            expect(manager.isLocked('session-1')).toBe(false);
        });

        it('should release lock even on error', async () => {
            try {
                await manager.withLock('session-1', { holder: 'handler-1' }, async () => {
                    throw new Error('test error');
                });
            } catch {
                // Expected
            }
            // Lock should be released
            expect(manager.isLocked('session-1')).toBe(false);
        });

        it('should return error when lock cannot be acquired', async () => {
            await manager.acquire('session-1', { holder: 'handler-1' });
            const result = await manager.withLock('session-1', { holder: 'handler-2' }, async () => 'never');
            expect(result.error).toBeDefined();
        });
    });

    describe('extend', () => {
        it('should extend lock expiry', async () => {
            const lockResult = await manager.acquire('session-1', { holder: 'h', timeoutMs: 5000 });
            const originalExpiry = lockResult.lock!.expiresAt;
            const extended = manager.extend('session-1', 'h', 10_000);
            expect(extended).toBe(true);
            const info = manager.getLockInfo('session-1');
            expect(info!.expiresAt).toBe(originalExpiry + 10_000);
        });

        it('should reject extend from wrong holder', async () => {
            await manager.acquire('session-1', { holder: 'handler-1' });
            expect(manager.extend('session-1', 'handler-2', 10_000)).toBe(false);
        });
    });

    describe('listActiveLocks', () => {
        it('should list all active locks', async () => {
            await manager.acquire('session-1', { holder: 'h1' });
            await manager.acquire('session-2', { holder: 'h2' });
            const locks = manager.listActiveLocks();
            expect(locks).toHaveLength(2);
        });

        it('should exclude expired locks', async () => {
            await manager.acquire('session-1', { holder: 'h', timeoutMs: 1 });
            await new Promise((r) => setTimeout(r, 10));
            const locks = manager.listActiveLocks();
            expect(locks).toHaveLength(0);
        });
    });

    describe('getStats', () => {
        it('should track statistics', async () => {
            await manager.acquire('session-1', { holder: 'h' });
            manager.release('session-1', 'h');
            const stats = manager.getStats();
            expect(stats.totalAcquired).toBe(1);
            expect(stats.totalReleased).toBe(1);
            expect(stats.activeLocks).toBe(0);
        });
    });

    describe('shutdown', () => {
        it('should release all locks on shutdown', async () => {
            await manager.acquire('session-1', { holder: 'h1' });
            await manager.acquire('session-2', { holder: 'h2' });
            manager.shutdown();
            expect(manager.listActiveLocks()).toHaveLength(0);
        });
    });
});
