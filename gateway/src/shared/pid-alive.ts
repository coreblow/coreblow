/**
 * src/shared/pid-alive.ts
 * Cross-platform PID liveness checks.
 * Ported from CoreBlow shared/pid-alive.ts.
 */

import fsSync from "node:fs";

function isValidPid(pid: number): boolean {
    return Number.isInteger(pid) && pid > 0;
}

/**
 * Check if a process is a zombie on Linux by reading /proc/<pid>/status.
 * Returns false on non-Linux platforms or if the proc file can't be read.
 */
function isZombieProcess(pid: number): boolean {
    if (process.platform !== "linux") return false;
    
    try {
        const status = fsSync.readFileSync(`/proc/${pid}/status`, "utf8");
        const stateMatch = status.match(/^State:\s+(\S)/m);
        return stateMatch?.[1] === "Z";
    } catch {
        return false;
    }
}

export function isPidAlive(pid: number): boolean {
    if (!isValidPid(pid)) return false;
    
    try {
        process.kill(pid, 0);
    } catch {
        return false;
    }
    
    if (isZombieProcess(pid)) {
        return false;
    }
    
    return true;
}

export async function waitForPidExit(pid: number, timeoutMs: number): Promise<boolean> {
    const startTime = Date.now();
    while (isPidAlive(pid)) {
        if (Date.now() - startTime > timeoutMs) {
            return false;
        }
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    return true;
}

/**
 * Read the process start time (field 22 "starttime") from /proc/<pid>/stat.
 * Returns the value in clock ticks since system boot, or null on non-Linux
 * platforms or if the proc file can't be read.
 */
export function getProcessStartTime(pid: number): number | null {
    if (process.platform !== "linux") return null;
    if (!isValidPid(pid)) return null;
    
    try {
        const stat = fsSync.readFileSync(`/proc/${pid}/stat`, "utf8");
        const commEndIndex = stat.lastIndexOf(")");
        if (commEndIndex < 0) return null;
        
        const afterComm = stat.slice(commEndIndex + 1).trimStart();
        const fields = afterComm.split(/\s+/);
        const starttime = Number(fields[19]);
        
        return Number.isInteger(starttime) && starttime >= 0 ? starttime : null;
    } catch {
        return null;
    }
}
