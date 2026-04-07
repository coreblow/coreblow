/**
 * agents/timeout.ts
 * Timeout utilities for agent operations.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, label = 'operation'): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Timeout: ${label} exceeded ${ms}ms`)), ms);
        promise.then((v) => { clearTimeout(timer); resolve(v); }, (e) => { clearTimeout(timer); reject(e); });
    });
}
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'));
        const timer = setTimeout(resolve, ms);
        signal?.addEventListener('abort', () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
    });
}
export function createDeadline(ms: number): { isExpired: () => boolean; remainingMs: () => number; expiresAt: number } {
    const expiresAt = Date.now() + ms;
    return { isExpired: () => Date.now() >= expiresAt, remainingMs: () => Math.max(0, expiresAt - Date.now()), expiresAt };
}
