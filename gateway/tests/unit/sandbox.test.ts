/**
 * tests/unit/sandbox.test.ts
 * Tests for sandbox execution
 */
import { describe, it, expect } from 'vitest';
import { SandboxManager } from '../../src/security/sandbox.js';

describe('SandboxManager', () => {
    it('should create with default config', () => {
        const sandbox = new SandboxManager();
        expect(sandbox).toBeDefined();
    });

    it('should block dangerous commands', async () => {
        const sandbox = new SandboxManager({ mode: 'none' });
        const result = await sandbox.exec('rm -rf /');
        expect(result.killed).toBe(true);
        expect(result.killReason).toBe('blocked_command');
        expect(result.stderr).toContain('blocked');
    });

    it('should block fork bombs', async () => {
        const sandbox = new SandboxManager({ mode: 'none' });
        const result = await sandbox.exec(':(){:|:&};:');
        expect(result.killed).toBe(true);
    });

    it('should execute safe commands in native mode', async () => {
        const sandbox = new SandboxManager({ mode: 'native' });
        const result = await sandbox.exec('echo hello');
        expect(result.exitCode).toBe(0);
        expect(result.stdout.trim()).toBe('hello');
        expect(result.sandboxMode).toBe('native');
    });

    it('should timeout long-running commands', async () => {
        const sandbox = new SandboxManager({ mode: 'native', timeoutMs: 500 });
        const result = await sandbox.exec('sleep 10');
        expect(result.killed).toBe(true);
        expect(result.durationMs).toBeLessThan(5000);
    }, 10_000);

    it('should respect working directory', async () => {
        const sandbox = new SandboxManager({ mode: 'native', workDir: '/tmp' });
        const result = await sandbox.exec('pwd');
        expect(result.stdout.trim()).toBe('/private/tmp');
    });

    it('should check Docker availability', () => {
        const sandbox = new SandboxManager();
        const available = sandbox.isDockerAvailable();
        expect(typeof available).toBe('boolean');
    });

    it('should whitelist commands', async () => {
        const sandbox = new SandboxManager({
            mode: 'native',
            allowedCommands: ['echo', 'ls'],
        });
        const ok = await sandbox.exec('echo test');
        expect(ok.exitCode).toBe(0);

        const blocked = await sandbox.exec('rm test.txt');
        expect(blocked.killed).toBe(true);
    });

    it('should report duration', async () => {
        const sandbox = new SandboxManager({ mode: 'native' });
        const result = await sandbox.exec('echo fast');
        expect(result.durationMs).toBeGreaterThanOrEqual(0);
        expect(result.durationMs).toBeLessThan(5000);
    });
});
