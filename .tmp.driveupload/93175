/**
 * process/kill-tree.ts
 * Process tree termination with graceful shutdown.
 * Ported 1:1 from OpenClaw src/process/kill-tree.ts.
 */

import { spawn } from 'node:child_process';

const DEFAULT_GRACE_MS = 3000;
const MAX_GRACE_MS = 60_000;

/**
 * Best-effort process-tree termination with graceful shutdown.
 * - Windows: use taskkill /T for descendants.
 * - Unix: SIGTERM to process group first, then SIGKILL after grace period.
 */
export function killProcessTree(pid: number, opts?: { graceMs?: number }): void {
    if (!Number.isFinite(pid) || pid <= 0) return;
    const graceMs = normalizeGraceMs(opts?.graceMs);
    if (process.platform === 'win32') { killProcessTreeWindows(pid, graceMs); return; }
    killProcessTreeUnix(pid, graceMs);
}

function normalizeGraceMs(value?: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_GRACE_MS;
    return Math.max(0, Math.min(MAX_GRACE_MS, Math.floor(value)));
}

function isProcessAlive(pid: number): boolean {
    try { process.kill(pid, 0); return true; }
    catch { return false; }
}

function killProcessTreeUnix(pid: number, graceMs: number): void {
    // Try SIGTERM to process group
    try { process.kill(-pid, 'SIGTERM'); } catch { /* no group, try pid */ try { process.kill(pid, 'SIGTERM'); } catch { /* already dead */ return; } }

    if (graceMs <= 0) {
        try { process.kill(-pid, 'SIGKILL'); } catch { try { process.kill(pid, 'SIGKILL'); } catch { /* ok */ } }
        return;
    }

    setTimeout(() => {
        if (!isProcessAlive(pid)) return;
        try { process.kill(-pid, 'SIGKILL'); } catch { try { process.kill(pid, 'SIGKILL'); } catch { /* ok */ } }
    }, graceMs).unref();
}

function killProcessTreeWindows(pid: number, graceMs: number): void {
    // Graceful first
    try {
        spawn('taskkill', ['/pid', String(pid), '/T'], { stdio: 'ignore', detached: true }).unref();
    } catch { /* ok */ }

    setTimeout(() => {
        if (!isProcessAlive(pid)) return;
        try {
            spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore', detached: true }).unref();
        } catch { /* ok */ }
    }, graceMs).unref();
}

/**
 * Send SIGTERM to a process and wait for it to exit.
 */
export async function gracefulKill(pid: number, timeoutMs = DEFAULT_GRACE_MS): Promise<boolean> {
    if (!isProcessAlive(pid)) return true;
    try { process.kill(pid, 'SIGTERM'); } catch { return true; }

    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        if (!isProcessAlive(pid)) return true;
        await new Promise((r) => setTimeout(r, 50));
    }

    if (isProcessAlive(pid)) {
        try { process.kill(pid, 'SIGKILL'); } catch { /* ok */ }
        return false;
    }
    return true;
}
