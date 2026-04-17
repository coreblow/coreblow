/**
 * Process Tests — Phase B: Business Logic
 * Tests: CommandQueue, ProcessPool
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { enqueueCommand, getNextCommand, startCommand, completeCommand, failCommand, getQueueStatus, clearQueue, setMaxConcurrent } from './command-queue.js';
import { ProcessPool } from './pool.js';

// ═══════════════════════════════════════════════════════════════════
// CommandQueue
// ═══════════════════════════════════════════════════════════════════

describe('CommandQueue', () => {
    beforeEach(() => { clearQueue(); setMaxConcurrent(3); });

    // --- Enqueue ---
    it('enqueues a command', () => {
        const cmd = enqueueCommand('c1', 'echo hello');
        expect(cmd.status).toBe('pending');
        expect(cmd.id).toBe('c1');
    });

    it('enqueues with priority', () => {
        enqueueCommand('c1', 'low', 'low');
        enqueueCommand('c2', 'critical', 'critical');
        enqueueCommand('c3', 'normal', 'normal');
        const next = getNextCommand();
        expect(next!.id).toBe('c2'); // critical first
    });

    it('sorts by priority: critical > high > normal > low', () => {
        enqueueCommand('low', 'cmd', 'low');
        enqueueCommand('normal', 'cmd', 'normal');
        enqueueCommand('high', 'cmd', 'high');
        enqueueCommand('critical', 'cmd', 'critical');
        expect(getNextCommand()!.id).toBe('critical');
    });

    // --- getNextCommand ---
    it('returns next pending command', () => {
        enqueueCommand('c1', 'echo 1');
        expect(getNextCommand()!.id).toBe('c1');
    });

    it('returns null when queue empty', () => {
        expect(getNextCommand()).toBeNull();
    });

    it('respects max concurrent', () => {
        setMaxConcurrent(1);
        enqueueCommand('c1', 'cmd1');
        enqueueCommand('c2', 'cmd2');
        startCommand('c1');
        expect(getNextCommand()).toBeNull(); // c1 running, limit 1
    });

    // --- Lifecycle ---
    it('starts a command', () => {
        enqueueCommand('c1', 'cmd');
        expect(startCommand('c1')).toBe(true);
    });

    it('returns false starting non-existent', () => {
        expect(startCommand('nonexistent')).toBe(false);
    });

    it('completes a command', () => {
        enqueueCommand('c1', 'cmd');
        startCommand('c1');
        expect(completeCommand('c1', 'done')).toBe(true);
    });

    it('fails a command', () => {
        enqueueCommand('c1', 'cmd');
        startCommand('c1');
        expect(failCommand('c1', 'error message')).toBe(true);
    });

    // --- Status ---
    it('tracks queue status', () => {
        enqueueCommand('c1', 'cmd');
        enqueueCommand('c2', 'cmd');
        enqueueCommand('c3', 'cmd');
        startCommand('c1');
        completeCommand('c1', 'ok');
        startCommand('c2');
        failCommand('c2', 'err');
        const status = getQueueStatus();
        expect(status.pending).toBe(1);
        expect(status.completed).toBe(1);
        expect(status.failed).toBe(1);
    });

    // --- Clear ---
    it('clears the queue', () => {
        enqueueCommand('c1', 'cmd');
        enqueueCommand('c2', 'cmd');
        clearQueue();
        expect(getQueueStatus().pending).toBe(0);
    });

    // --- Concurrency ---
    it('allows multiple concurrent up to limit', () => {
        setMaxConcurrent(2);
        enqueueCommand('c1', 'cmd');
        enqueueCommand('c2', 'cmd');
        enqueueCommand('c3', 'cmd');
        startCommand('c1');
        expect(getNextCommand()).not.toBeNull(); // 1 running, limit 2
        startCommand('c2');
        expect(getNextCommand()).toBeNull(); // 2 running, limit 2
    });

    it('frees slot after completion', () => {
        setMaxConcurrent(1);
        enqueueCommand('c1', 'cmd');
        enqueueCommand('c2', 'cmd');
        startCommand('c1');
        expect(getNextCommand()).toBeNull();
        completeCommand('c1', 'ok');
        expect(getNextCommand()!.id).toBe('c2');
    });
});

// ═══════════════════════════════════════════════════════════════════
// ProcessPool
// ═══════════════════════════════════════════════════════════════════

describe('ProcessPool', () => {
    it('creates with max size', () => {
        const pool = new ProcessPool(4);
        expect(pool.size()).toBe(0);
    });

    it('returns null when empty', () => {
        const pool = new ProcessPool(2);
        expect(pool.acquire()).toBeNull();
    });

    it('releases and acquires workers', () => {
        const pool = new ProcessPool(2);
        pool.release({ id: 1 });
        pool.release({ id: 2 });
        expect(pool.size()).toBe(2);
        const w = pool.acquire();
        expect(w).toBeDefined();
        expect(pool.size()).toBe(1);
    });

    it('respects max size on release', () => {
        const pool = new ProcessPool(2);
        pool.release({ id: 1 });
        pool.release({ id: 2 });
        pool.release({ id: 3 }); // should be discarded
        expect(pool.size()).toBe(2);
    });

    it('LIFO order', () => {
        const pool = new ProcessPool(3);
        pool.release({ id: 'a' });
        pool.release({ id: 'b' });
        expect((pool.acquire() as any).id).toBe('b'); // last in, first out
    });
});
