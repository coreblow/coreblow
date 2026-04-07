/**
 * agents/fast-mode.ts
 * Fast mode — skip expensive operations for speed.
 */
let fastMode = false;
export function enableFastMode(): void { fastMode = true; }
export function disableFastMode(): void { fastMode = false; }
export function isFastMode(): boolean { return fastMode; }
export function skipIfFastMode<T>(fn: () => T, fallback: T): T { return fastMode ? fallback : fn(); }
export async function skipIfFastModeAsync<T>(fn: () => Promise<T>, fallback: T): Promise<T> { return fastMode ? fallback : fn(); }
