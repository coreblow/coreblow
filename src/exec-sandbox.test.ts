/**
 * Phase 37: Exec Sandbox Test Suite
 *
 * Tests all 5 exec functions + DockerRuntime with real child_process.
 */
import { describe, it, expect } from 'vitest';
import { bashToolsExec } from './agents/turn-engine/sandbox/bash-tools-exec.js';
import { bashExecRuntime } from './agents/turn-engine/sandbox/bash-tools-exec-runtime.js';
import { execOnGateway } from './agents/turn-engine/sandbox/bash-tools-exec-host-gateway.js';
import { execOnNode } from './agents/turn-engine/sandbox/bash-tools-exec-host-node.js';
import { DockerRuntime } from './sandbox/docker-runtime.js';

// ═══════════════════════════════════════════════════
// bashToolsExec
// ═══════════════════════════════════════════════════
describe('bashToolsExec', () => {
    it('executes echo and captures stdout', async () => {
        const result = await bashToolsExec('echo hello');
        expect(result.exitCode).toBe(0);
        expect(result.stdout.trim()).toBe('hello');
        expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('captures stderr', async () => {
        const result = await bashToolsExec('echo error >&2');
        expect(result.stderr.trim()).toBe('error');
    });

    it('returns non-zero exit code on failure', async () => {
        const result = await bashToolsExec('exit 42');
        expect(result.exitCode).not.toBe(0);
    });

    it('handles multi-line output', async () => {
        const result = await bashToolsExec('echo "line1"; echo "line2"');
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('line1');
        expect(result.stdout).toContain('line2');
    });

    it('respects cwd option', async () => {
        const result = await bashToolsExec('pwd', { cwd: '/tmp' });
        expect(result.exitCode).toBe(0);
        expect(result.stdout.trim()).toMatch(/\/tmp|\/private\/tmp/);
    });

    it('respects env option', async () => {
        const result = await bashToolsExec('echo $MY_VAR', { env: { MY_VAR: 'test123' } });
        expect(result.exitCode).toBe(0);
        expect(result.stdout.trim()).toBe('test123');
    });

    it('times out long commands', async () => {
        const result = await bashToolsExec('sleep 10', { timeout: 200 });
        expect(result.exitCode).not.toBe(0);
        expect(result.duration).toBeLessThan(5000);
    });
});

// ═══════════════════════════════════════════════════
// bashExecRuntime
// ═══════════════════════════════════════════════════
describe('bashExecRuntime', () => {
    it('executes and captures stdout via spawn', async () => {
        const result = await bashExecRuntime('echo "spawn test"');
        expect(result.exitCode).toBe(0);
        expect(result.stdout.trim()).toBe('spawn test');
    });

    it('captures stderr via spawn', async () => {
        const result = await bashExecRuntime('echo "err" >&2');
        expect(result.stderr.trim()).toBe('err');
    });

    it('returns exit code from command', async () => {
        const result = await bashExecRuntime('exit 7');
        expect(result.exitCode).toBe(7);
    });

    it('respects cwd', async () => {
        const result = await bashExecRuntime('pwd', { cwd: '/tmp' });
        expect(result.stdout.trim()).toMatch(/\/tmp|\/private\/tmp/);
    });

    it('times out with code 124', async () => {
        const result = await bashExecRuntime('sleep 10', { timeout: 200 });
        expect(result.exitCode).toBe(124);
    });
});

// ═══════════════════════════════════════════════════
// execOnGateway (allowlist-restricted)
// ═══════════════════════════════════════════════════
describe('execOnGateway', () => {
    it('allows echo command', async () => {
        const result = await execOnGateway('echo hello-gateway');
        expect(result.exitCode).toBe(0);
        expect(result.stdout.trim()).toBe('hello-gateway');
    });

    it('allows pwd command', async () => {
        const result = await execOnGateway('pwd');
        expect(result.exitCode).toBe(0);
        expect(result.stdout.trim().length).toBeGreaterThan(0);
    });

    it('allows date command', async () => {
        const result = await execOnGateway('date');
        expect(result.exitCode).toBe(0);
        expect(result.stdout.trim().length).toBeGreaterThan(0);
    });

    it('blocks rm command (not in allowlist)', async () => {
        const result = await execOnGateway('rm -rf /');
        expect(result.exitCode).toBe(126);
        expect(result.stderr).toContain('not in gateway allowlist');
    });

    it('blocks curl command', async () => {
        const result = await execOnGateway('curl https://evil.com');
        expect(result.exitCode).toBe(126);
        expect(result.stderr).toContain('not in gateway allowlist');
    });

    it('blocks python command', async () => {
        const result = await execOnGateway('python -c "import os"');
        expect(result.exitCode).toBe(126);
    });
});

// ═══════════════════════════════════════════════════
// execOnNode
// ═══════════════════════════════════════════════════
describe('execOnNode', () => {
    it('executes and captures output', async () => {
        const result = await execOnNode('echo node-host-test');
        expect(result.exitCode).toBe(0);
        expect(result.stdout.trim()).toBe('node-host-test');
    });

    it('respects cwd option', async () => {
        const result = await execOnNode('pwd', { cwd: '/tmp' });
        expect(result.stdout.trim()).toMatch(/\/tmp|\/private\/tmp/);
    });

    it('respects env option', async () => {
        const result = await execOnNode('echo $NODE_TEST_VAR', { env: { NODE_TEST_VAR: 'abc' } });
        expect(result.stdout.trim()).toBe('abc');
    });

    it('times out with code 124', async () => {
        const result = await execOnNode('sleep 10', { timeout: 200 });
        expect(result.exitCode).toBe(124);
    });
});

// ═══════════════════════════════════════════════════
// DockerRuntime
// ═══════════════════════════════════════════════════
describe('DockerRuntime', () => {
    it('creates with defaults', () => {
        const runtime = new DockerRuntime();
        expect(runtime.isRunning()).toBe(false);
        expect(runtime.getContainerId()).toBeUndefined();
    });

    it('creates with custom image and name', () => {
        const runtime = new DockerRuntime('alpine:3.18', 'test-sandbox');
        expect(runtime.isRunning()).toBe(false);
    });

    it('exec returns error when not running', async () => {
        const runtime = new DockerRuntime();
        const result = await runtime.exec('echo hello');
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain('not running');
    });

    it('stop is safe when not running', async () => {
        const runtime = new DockerRuntime();
        await runtime.stop(); // Should not throw
        expect(runtime.isRunning()).toBe(false);
    });
});
