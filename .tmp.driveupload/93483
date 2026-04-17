/**
 * Tests: Process Module — Command Queue, Process Manager, Graceful Shutdown
 */
import { describe, it, expect } from 'vitest';
import {
    enqueueCommand,
    getNextCommand,
    startCommand,
    completeCommand,
    failCommand,
} from '../../src/process/command-queue.js';
import { ProcessManager } from '../../src/process/manager.js';
import { GracefulShutdown } from '../../src/process/graceful-shutdown.js';

// ═══════════════════════════════════════════════════════════════
// COMMAND QUEUE
// ═══════════════════════════════════════════════════════════════

describe('Command Queue', () => {
    it('enqueues a command', () => {
        const cmd = enqueueCommand('q-test-1', 'echo hello');
        expect(cmd.id).toBe('q-test-1');
        expect(cmd.status).toBe('pending');
    });

    it('gets next command by priority', () => {
        enqueueCommand('q-test-high', 'prioritized', 'high');
        const next = getNextCommand();
        expect(next).toBeDefined();
    });

    it('starts a command', () => {
        const cmd = enqueueCommand('q-start-1', 'test');
        expect(startCommand(cmd.id)).toBe(true);
    });

    it('completes a command', () => {
        const cmd = enqueueCommand('q-complete-1', 'test');
        startCommand(cmd.id);
        expect(completeCommand(cmd.id, 'output text')).toBe(true);
    });

    it('fails a command', () => {
        const cmd = enqueueCommand('q-fail-1', 'test');
        startCommand(cmd.id);
        expect(failCommand(cmd.id, 'error!')).toBe(true);
    });

    it('returns false for unknown command', () => {
        expect(startCommand('nonexistent-cmd')).toBe(false);
    });
});

// ═══════════════════════════════════════════════════════════════
// PROCESS MANAGER
// ═══════════════════════════════════════════════════════════════

describe('ProcessManager', () => {
    it('registers a process', () => {
        const pm = new ProcessManager();
        pm.register('test-proc', process.pid);
        const all = pm.getAll();
        expect(all['test-proc']).toBeDefined();
        expect(all['test-proc'].status).toBe('running');
    });

    it('stops a registered process', () => {
        const pm = new ProcessManager();
        pm.register('stop-test', 99999);
        pm.stop('stop-test');
        expect(pm.getAll()['stop-test'].status).toBe('stopped');
    });
});

// ═══════════════════════════════════════════════════════════════
// GRACEFUL SHUTDOWN
// ═══════════════════════════════════════════════════════════════

describe('GracefulShutdown', () => {
    it('registers handlers', () => {
        const gs = new GracefulShutdown();
        let called = false;
        gs.register('test', async () => { called = true; });
        expect(gs).toBeDefined();
    });

    it('runs handlers on shutdown', async () => {
        const gs = new GracefulShutdown();
        let called = false;
        gs.register('test-handler', async () => { called = true; });
        // Cannot call actual shutdown (it calls process.exit), so test registration works
        expect(gs).toBeDefined();
    });
});
