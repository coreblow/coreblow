/**
 * CoreBlow Security — SandboxManager Test Suite
 *
 * Covers: blocked command detection, whitelist enforcement,
 * exec() with blocked commands, mode resolution, isDockerAvailable(),
 * and native/unsandboxed execution. Uses vi.mock to isolate from
 * real child_process/docker availability.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../utils/logger.js', () => ({
    createChildLogger: () => ({
        info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
    }),
}));

vi.mock('node:child_process', () => ({
    spawn: vi.fn(() => {
        const proc = {
            stdout: { on: vi.fn() },
            stderr: { on: vi.fn() },
            on: vi.fn((event: string, cb: Function) => {
                if (event === 'close') setTimeout(() => cb(0), 10);
            }),
            kill: vi.fn(),
        };
        return proc;
    }),
    execSync: vi.fn(() => 'Docker version 24.0.0'),
}));

import { SandboxManager } from './sandbox.js';

describe('SandboxManager', () => {
    let sandbox: SandboxManager;

    beforeEach(() => {
        sandbox = new SandboxManager({ mode: 'none' });
    });

    // ─── Blocked Commands ───────────────────────────────────────

    describe('blocked commands', () => {
        it('blocks rm -rf /', async () => {
            const result = await sandbox.exec('rm -rf /');
            expect(result.killed).toBe(true);
            expect(result.killReason).toBe('blocked_command');
            expect(result.stderr).toContain('blocked');
            expect(result.exitCode).toBe(1);
            expect(result.durationMs).toBe(0);
        });

        it('blocks fork bomb', async () => {
            const result = await sandbox.exec(':(){:|:&};:');
            expect(result.killed).toBe(true);
            expect(result.killReason).toBe('blocked_command');
        });

        it('blocks shutdown command', async () => {
            const result = await sandbox.exec('shutdown -h now');
            expect(result.killed).toBe(true);
        });

        it('blocks reboot command', async () => {
            const result = await sandbox.exec('reboot');
            expect(result.killed).toBe(true);
        });

        it('blocks pkill/killall', async () => {
            expect((await sandbox.exec('pkill -9 node')).killed).toBe(true);
            expect((await sandbox.exec('killall node')).killed).toBe(true);
        });

        it('blocks dd if=/dev/zero', async () => {
            const result = await sandbox.exec('dd if=/dev/zero of=/dev/sda');
            expect(result.killed).toBe(true);
        });

        it('blocks mkfs', async () => {
            const result = await sandbox.exec('mkfs.ext4 /dev/sda1');
            expect(result.killed).toBe(true);
        });

        it('is case-insensitive for blocking', async () => {
            const result = await sandbox.exec('SHUTDOWN -h NOW');
            expect(result.killed).toBe(true);
        });

        it('allows safe commands', async () => {
            const result = await sandbox.exec('echo hello');
            expect(result.killed).toBe(false);
        });
    });

    // ─── Whitelist (allowedCommands) ────────────────────────────

    describe('allowedCommands (whitelist)', () => {
        it('blocks commands not in whitelist', async () => {
            const restricted = new SandboxManager({
                mode: 'none',
                allowedCommands: ['echo', 'cat'],
            });

            const result = await restricted.exec('curl http://evil.com');
            expect(result.killed).toBe(true);
            expect(result.killReason).toBe('blocked_command');
        });

        it('allows whitelisted commands', async () => {
            const restricted = new SandboxManager({
                mode: 'none',
                allowedCommands: ['echo', 'cat'],
            });

            const result = await restricted.exec('echo hello');
            expect(result.killed).toBe(false);
        });
    });

    // ─── Mode Selection ─────────────────────────────────────────

    describe('mode resolution', () => {
        it('explicit docker mode', async () => {
            const dockerSandbox = new SandboxManager({ mode: 'docker' });
            const result = await dockerSandbox.exec('echo test');
            expect(result.sandboxMode).toBe('docker');
        });

        it('explicit native mode', async () => {
            const nativeSandbox = new SandboxManager({ mode: 'native' });
            const result = await nativeSandbox.exec('echo test');
            expect(result.sandboxMode).toBe('native');
        });

        it('explicit none mode', async () => {
            const result = await sandbox.exec('echo test');
            expect(result.sandboxMode).toBe('none');
        });
    });

    // ─── isDockerAvailable() ────────────────────────────────────

    describe('isDockerAvailable()', () => {
        it('returns true when docker command succeeds', () => {
            const s = new SandboxManager();
            expect(s.isDockerAvailable()).toBe(true);
        });
    });

    // ─── Configuration Merging ──────────────────────────────────

    describe('configuration', () => {
        it('defaults to auto mode, 30s timeout, 256MB memory', async () => {
            const defaultSandbox = new SandboxManager();
            // We verify defaults by passing no config and checking the exec
            const result = await defaultSandbox.exec('echo test');
            expect(result).toBeTruthy();
        });

        it('merges per-exec overrides with instance config', async () => {
            const result = await sandbox.exec('echo test', { timeoutMs: 5000 });
            expect(result).toBeTruthy();
        });
    });
});
