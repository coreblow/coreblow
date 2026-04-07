/**
 * Exec on Gateway Host — Executes commands on the gateway process.
 *
 * Used for gateway-level operations (config reload, health check, etc.).
 * Restricted to safe commands via allowlist.
 */
import { execFile } from 'node:child_process';

const ALLOWED_COMMANDS = new Set(['node', 'npm', 'npx', 'cat', 'echo', 'ls', 'pwd', 'whoami', 'uname', 'date', 'env']);

export async function execOnGateway(cmd: string, opts: Record<string, unknown> = {}): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const parts = cmd.trim().split(/\s+/);
    const binary = parts[0] ?? '';
    const baseName = binary.split('/').pop() ?? '';

    if (!ALLOWED_COMMANDS.has(baseName)) {
        return { stdout: '', stderr: `Command not in gateway allowlist: ${baseName}`, exitCode: 126 };
    }

    const timeout = typeof opts.timeout === 'number' ? opts.timeout : 15_000;
    const cwd = typeof opts.cwd === 'string' ? opts.cwd : undefined;

    return new Promise((resolve) => {
        execFile('/bin/sh', ['-c', cmd], { timeout, cwd, maxBuffer: 5 * 1024 * 1024 }, (error, stdout, stderr) => {
            if (error) {
                resolve({ stdout: stdout ?? '', stderr: stderr || error.message, exitCode: 1 });
            } else {
                resolve({ stdout: stdout ?? '', stderr: stderr ?? '', exitCode: 0 });
            }
        });
    });
}
