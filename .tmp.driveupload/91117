/**
 * Exec on Node Host — Executes commands on the node-host process.
 *
 * Designed for node-level tool execution with sandboxed environment.
 */
import { spawn } from 'node:child_process';

export async function execOnNode(cmd: string, opts: Record<string, unknown> = {}): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const timeout = typeof opts.timeout === 'number' ? opts.timeout : 30_000;
    const cwd = typeof opts.cwd === 'string' ? opts.cwd : undefined;
    const envOverrides = typeof opts.env === 'object' && opts.env !== null ? opts.env as Record<string, string> : {};

    // Sanitize: strip dangerous env vars
    const safeEnv = { ...process.env, ...envOverrides };
    delete safeEnv.NODE_REPL_HISTORY;

    return new Promise((resolve) => {
        const chunks: Buffer[] = [];
        const errChunks: Buffer[] = [];
        let killed = false;

        const child = spawn('/bin/sh', ['-c', cmd], { cwd, env: safeEnv, stdio: ['ignore', 'pipe', 'pipe'] });
        const timer = setTimeout(() => { killed = true; child.kill('SIGKILL'); }, timeout);

        child.stdout?.on('data', (chunk: Buffer) => chunks.push(chunk));
        child.stderr?.on('data', (chunk: Buffer) => errChunks.push(chunk));

        child.on('close', (code) => {
            clearTimeout(timer);
            const stdout = Buffer.concat(chunks).toString('utf-8');
            const stderr = Buffer.concat(errChunks).toString('utf-8');
            resolve({ stdout, stderr: killed ? (stderr || `Timed out after ${timeout}ms`) : stderr, exitCode: killed ? 124 : (code ?? 1) });
        });

        child.on('error', (err) => {
            clearTimeout(timer);
            resolve({ stdout: '', stderr: err.message, exitCode: 1 });
        });
    });
}
