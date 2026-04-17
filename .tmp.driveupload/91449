/** Exec runtime environment detection. */
export function detectRuntime(): 'node' | 'bun' | 'deno' | 'unknown' {
    if (typeof process !== 'undefined' && process.versions?.bun) return 'bun';
    if (typeof process !== 'undefined' && process.versions?.node) return 'node';
    return 'unknown';
}
export function getRuntimeVersion(): string { return process.version ?? 'unknown'; }
