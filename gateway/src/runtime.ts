/**
 * CoreBlow runtime adapter for canvas-host
 */

export interface Runtime {
    log: (...args: unknown[]) => void;
    env: Record<string, string>;
}

export const defaultRuntime: Runtime = {
    log: (...args: unknown[]) => console.log('[CoreBlow]', ...args),
    env: process.env as Record<string, string>,
};
