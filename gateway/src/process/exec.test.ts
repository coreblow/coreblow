/**
 * process/exec.test.ts — Safe exec tests
 */
import { describe, it, expect } from 'vitest';
import { exec, execShell, commandExists } from './exec.js';

describe('Process Exec', () => {
    describe('exec', () => {
        it('runs echo', async () => {
            const result = await exec('echo', ['hello']);
            expect(result.exitCode).toBe(0);
            expect(result.stdout.trim()).toBe('hello');
            expect(result.killed).toBe(false);
        });

        it('captures stderr', async () => {
            const result = await exec('sh', ['-c', 'echo err >&2']);
            expect(result.stderr).toContain('err');
        });

        it('returns non-zero exit', async () => {
            const result = await exec('sh', ['-c', 'exit 42']);
            expect(result.exitCode).toBe(42);
        });

        it('handles timeout', async () => {
            const result = await exec('sleep', ['10'], { timeoutMs: 100 });
            expect(result.killed).toBe(true);
        });

        it('tracks duration', async () => {
            const result = await exec('echo', ['fast']);
            expect(result.durationMs).toBeGreaterThanOrEqual(0);
            expect(result.durationMs).toBeLessThan(5000);
        });
    });

    describe('execShell', () => {
        it('runs shell command', async () => {
            const result = await execShell('echo "hello world"');
            expect(result.stdout.trim()).toBe('hello world');
        });
    });

    describe('commandExists', () => {
        it('finds echo', async () => {
            expect(await commandExists('echo')).toBe(true);
        });

        it('does not find nonexistent', async () => {
            expect(await commandExists('nonexistent_command_xyz')).toBe(false);
        });
    });
});
