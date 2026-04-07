/**
 * src/infra/restart-stale-pids.ts
 * Synchronous termination of stale processes preventing restart bindings.
 * Ported from CoreBlow infra/restart-stale-pids.ts.
 */

import { spawnSync } from "node:child_process";

// CoreBlow specific ports fallback
function resolveGatewayPort(portOverride?: number, env: Record<string, string | undefined> = process.env): number {
    if (typeof portOverride === "number" && portOverride > 0) return Math.floor(portOverride);
    const fromEnv = parseInt(env.COREBLOW_GATEWAY_PORT || env.COREBLOW_GATEWAY_PORT || "8080", 10);
    return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : 8080;
}

// Inlined lsof resolver
function resolveLsofCommandSync(): string {
    return "lsof";
}

const SPAWN_TIMEOUT_MS = 2000;
const STALE_SIGTERM_WAIT_MS = 600;
const STALE_SIGKILL_WAIT_MS = 400;
const PORT_FREE_POLL_INTERVAL_MS = 50;
const PORT_FREE_TIMEOUT_MS = 2000;
const POLL_SPAWN_TIMEOUT_MS = 400;

let sleepSyncOverride: ((ms: number) => void) | null = null;
let dateNowOverride: (() => number) | null = null;

function getTimeMs(): number {
    return dateNowOverride ? dateNowOverride() : Date.now();
}

function sleepSync(ms: number): void {
    const timeoutMs = Math.max(0, Math.floor(ms));
    if (timeoutMs <= 0) return;
    if (sleepSyncOverride) {
        sleepSyncOverride(timeoutMs);
        return;
    }
    try {
        const lock = new Int32Array(new SharedArrayBuffer(4));
        Atomics.wait(lock, 0, 0, timeoutMs);
    } catch {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {}
    }
}

function parsePidsFromLsofOutput(stdout: string): number[] {
    const pids: number[] = [];
    let currentPid: number | undefined;
    let currentCmd: string | undefined;
    for (const line of stdout.split(/\r?\n/).filter(Boolean)) {
        if (line.startsWith("p")) {
            if (currentPid != null && currentCmd && currentCmd.toLowerCase().match(/coreblow|coreblow/)) {
                pids.push(currentPid);
            }
            const parsed = Number.parseInt(line.slice(1), 10);
            currentPid = Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
            currentCmd = undefined;
        } else if (line.startsWith("c")) {
            currentCmd = line.slice(1);
        }
    }
    if (currentPid != null && currentCmd && currentCmd.toLowerCase().match(/coreblow|coreblow/)) {
        pids.push(currentPid);
    }
    return [...new Set(pids)].filter((pid) => pid !== process.pid);
}

export function findGatewayPidsOnPortSync(
    port: number,
    spawnTimeoutMs = SPAWN_TIMEOUT_MS,
): number[] {
    if (process.platform === "win32") {
        return [];
    }
    const lsof = resolveLsofCommandSync();
    const res = spawnSync(lsof, ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-Fpc"], {
        encoding: "utf8",
        timeout: spawnTimeoutMs,
    });
    if (res.error || res.status === 1) {
        return [];
    }
    if (res.status !== 0) {
        return [];
    }
    return parsePidsFromLsofOutput(res.stdout);
}

type PollResult = { free: true } | { free: false } | { free: null; permanent: boolean };

function pollPortOnce(port: number): PollResult {
    try {
        const lsof = resolveLsofCommandSync();
        const res = spawnSync(lsof, ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-Fpc"], {
            encoding: "utf8",
            timeout: POLL_SPAWN_TIMEOUT_MS,
        });
        if (res.error) {
            const code = (res.error as NodeJS.ErrnoException).code;
            const permanent = code === "ENOENT" || code === "EACCES" || code === "EPERM";
            return { free: null, permanent };
        }
        if (res.status === 1) {
            if (res.stdout) {
                const pids = parsePidsFromLsofOutput(res.stdout);
                return pids.length === 0 ? { free: true } : { free: false };
            }
            return { free: true };
        }
        if (res.status !== 0) {
            return { free: null, permanent: false };
        }
        const pids = parsePidsFromLsofOutput(res.stdout);
        return pids.length === 0 ? { free: true } : { free: false };
    } catch {
        return { free: null, permanent: false };
    }
}

function terminateStaleProcessesSync(pids: number[]): number[] {
    const killed: number[] = [];
    for (const pid of pids) {
        try {
            process.kill(pid, "SIGTERM");
            killed.push(pid);
        } catch {}
    }
    if (killed.length === 0) return killed;
    
    sleepSync(STALE_SIGTERM_WAIT_MS);
    for (const pid of killed) {
        try {
            process.kill(pid, 0);
            process.kill(pid, "SIGKILL");
        } catch {}
    }
    sleepSync(STALE_SIGKILL_WAIT_MS);
    return killed;
}

function waitForPortFreeSync(port: number): void {
    const deadline = getTimeMs() + PORT_FREE_TIMEOUT_MS;
    while (getTimeMs() < deadline) {
        const result = pollPortOnce(port);
        if (result.free === true) return;
        if (result.free === null && result.permanent) return;
        sleepSync(PORT_FREE_POLL_INTERVAL_MS);
    }
}

export function cleanStaleGatewayProcessesSync(portOverride?: number): number[] {
    try {
        const port = resolveGatewayPort(portOverride);
        const stalePids = findGatewayPidsOnPortSync(port);
        if (stalePids.length === 0) return [];
        
        const killed = terminateStaleProcessesSync(stalePids);
        waitForPortFreeSync(port);
        return killed;
    } catch {
        return [];
    }
}
