/** Subagent registry state types. */
export type RegistryState = 'empty' | 'active' | 'draining' | 'shutdown';
export function resolveRegistryState(activeCount: number, isShuttingDown: boolean): RegistryState { if (isShuttingDown) return activeCount > 0 ? 'draining' : 'shutdown'; return activeCount > 0 ? 'active' : 'empty'; }
