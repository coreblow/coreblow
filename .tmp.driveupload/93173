/**
 * process/spawn-utils.ts
 * Spawn helpers with fallback and error formatting.
 * Ported from OpenClaw src/process/spawn-utils.ts.
 */

import type { ChildProcess, SpawnOptions } from 'node:child_process';
import { spawn } from 'node:child_process';

export type SpawnFallback = { label: string; options: SpawnOptions };
export type SpawnWithFallbackResult = { child: ChildProcess; usedFallback: boolean; fallbackLabel?: string };

export function resolveCommandStdio(params: { hasInput: boolean; preferInherit: boolean }): ['pipe' | 'inherit' | 'ignore', 'pipe', 'pipe'] {
    const stdin = params.hasInput ? 'pipe' : params.preferInherit ? 'inherit' : 'pipe';
    return [stdin, 'pipe', 'pipe'];
}

export function formatSpawnError(err: unknown): string {
    if (!(err instanceof Error)) return String(err);
    const details = err as NodeJS.ErrnoException;
    const parts: string[] = [];
    if (err.message?.trim()) parts.push(err.message.trim());
    if (details.code) parts.push(`code: ${details.code}`);
    if (details.errno !== undefined) parts.push(`errno: ${details.errno}`);
    if (details.syscall) parts.push(`syscall: ${details.syscall}`);
    if (details.path) parts.push(`path: ${details.path}`);
    return parts.join(', ');
}

/**
 * Spawn with retries using fallback configurations.
 */
export function spawnWithFallback(params: {
    argv: string[];
    options: SpawnOptions;
    fallbacks?: SpawnFallback[];
    retryCodes?: string[];
}): SpawnWithFallbackResult {
    const retryCodes = params.retryCodes ?? ['EBADF'];

    try {
        const child = spawn(params.argv[0], params.argv.slice(1), params.options);
        return { child, usedFallback: false };
    } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        if (!code || !retryCodes.includes(code) || !params.fallbacks?.length) throw err;

        for (const fallback of params.fallbacks) {
            try {
                const child = spawn(params.argv[0], params.argv.slice(1), { ...params.options, ...fallback.options });
                return { child, usedFallback: true, fallbackLabel: fallback.label };
            } catch { /* try next */ }
        }
        throw err;
    }
}

/**
 * Collect output from a child process.
 */
export function collectOutput(child: ChildProcess): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve) => {
        const stdout: string[] = [];
        const stderr: string[] = [];
        child.stdout?.on('data', (data: Buffer) => stdout.push(data.toString()));
        child.stderr?.on('data', (data: Buffer) => stderr.push(data.toString()));
        child.on('close', (code) => resolve({ stdout: stdout.join(''), stderr: stderr.join(''), exitCode: code ?? 1 }));
        child.on('error', () => resolve({ stdout: stdout.join(''), stderr: stderr.join(''), exitCode: 1 }));
    });
}
