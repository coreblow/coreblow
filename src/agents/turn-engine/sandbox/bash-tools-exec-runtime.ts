/**
 * Bash Exec Runtime — Executes commands in the runtime environment.
 *
 * Wraps child_process.spawn for streaming output and better control.
 */
import { spawn } from 'node:child_process';

export interface BashExecOptions {
    timeout?: number;
    cwd?: string;
    env?: Record<string, string>;
}

export async function bashExecRuntime(cmd: string, opts: BashExecOptions = {}): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const timeout = opts.timeout ?? 30_000;
    const env = opts.env ? { ...process.env, ...opts.env } : process.env;

    return new Promise((resolve) => {
        const chunks: Buffer[] = [];
        const errChunks: Buffer[] = [];
        let killed = false;

        const child = spawn('/bin/sh', ['-c', cmd], { cwd: opts.cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });

        const timer = setTimeout(() => { killed = true; child.kill('SIGTERM'); }, timeout);

        child.stdout?.on('data', (chunk: Buffer) => chunks.push(chunk));
        child.stderr?.on('data', (chunk: Buffer) => errChunks.push(chunk));

        child.on('close', (code) => {
            clearTimeout(timer);
            const stdout = Buffer.concat(chunks).toString('utf-8');
            const stderr = Buffer.concat(errChunks).toString('utf-8');
            if (killed) {
                resolve({ stdout, stderr: stderr || `Command timed out after ${timeout}ms`, exitCode: 124 });
            } else {
                resolve({ stdout, stderr, exitCode: code ?? 1 });
            }
        });

        child.on('error', (err) => {
            clearTimeout(timer);
            resolve({ stdout: '', stderr: err.message, exitCode: 1 });
        });
    });
}
