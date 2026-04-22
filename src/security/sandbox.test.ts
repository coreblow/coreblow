import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../utils/logger.js', () => ({
    createChildLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

import { SandboxManager } from './sandbox.js';

describe('SandboxManager', () => {
    let sm: SandboxManager;

    beforeEach(() => {
        sm = new SandboxManager({ mode: 'none' }); // Skip Docker/native detection
    });

    // ─── Command Blocking ────────────────────────────────────────

    describe('command blocking', () => {
        it('should block "rm -rf /"', async () => {
            const r = await sm.exec('rm -rf /');
            expect(r.killed).toBe(true);
            expect(r.killReason).toBe('blocked_command');
            expect(r.exitCode).toBe(1);
            expect(r.stderr).toContain('blocked');
        });

        it('should block "shutdown"', async () => {
            const r = await sm.exec('shutdown -h now');
            expect(r.killed).toBe(true);
            expect(r.killReason).toBe('blocked_command');
        });

        it('should block "reboot"', async () => {
            const r = await sm.exec('reboot');
            expect(r.killed).toBe(true);
        });

        it('should block "kill -9 1"', async () => {
            const r = await sm.exec('kill -9 1');
            expect(r.killed).toBe(true);
        });

        it('should block fork bomb', async () => {
            const r = await sm.exec(':(){:|:&};:');
            expect(r.killed).toBe(true);
        });

        it('should block "mkfs"', async () => {
            const r = await sm.exec('mkfs /dev/sda1');
            expect(r.killed).toBe(true);
        });

        it('should block "pkill" and "killall"', async () => {
            expect((await sm.exec('pkill node')).killed).toBe(true);
            expect((await sm.exec('killall node')).killed).toBe(true);
        });

        it('should block case-insensitively', async () => {
            const r = await sm.exec('SHUTDOWN -h now');
            expect(r.killed).toBe(true);
        });

        it('should allow safe commands', async () => {
            const r = await sm.exec('echo hello');
            expect(r.killed).toBe(false);
            expect(r.sandboxMode).toBe('none');
        });
    });

    // ─── Allowlist Mode ──────────────────────────────────────────

    describe('allowlist mode', () => {
        it('should block non-whitelisted commands when allowedCommands set', async () => {
            const restricted = new SandboxManager({
                mode: 'none',
                allowedCommands: ['echo', 'ls'],
            });
            const r = await restricted.exec('curl example.com');
            expect(r.killed).toBe(true);
        });

        it('should allow whitelisted commands', async () => {
            const restricted = new SandboxManager({
                mode: 'none',
                allowedCommands: ['echo', 'ls'],
            });
            const r = await restricted.exec('echo test');
            expect(r.killed).toBe(false);
        });
    });

    // ─── Custom Blocked Commands ─────────────────────────────────

    describe('custom blocked commands', () => {
        it('should use custom blocklist', async () => {
            const custom = new SandboxManager({
                mode: 'none',
                blockedCommands: ['custom-danger'],
            });
            const r = await custom.exec('custom-danger --force');
            expect(r.killed).toBe(true);
        });
    });

    // ─── Config Defaults ─────────────────────────────────────────

    describe('config', () => {
        it('should default to auto mode', () => {
            const auto = new SandboxManager();
            // Can't test detection without Docker, but object creates fine
            expect(auto).toBeDefined();
        });
    });
});
