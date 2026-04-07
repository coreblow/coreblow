/** Subagent registry lifecycle management. */
export type RegistryLifecyclePhase = 'created' | 'starting' | 'running' | 'stopping' | 'stopped' | 'error';
export function validateTransition(from: RegistryLifecyclePhase, to: RegistryLifecyclePhase): boolean {
    const valid: Record<string, string[]> = { created: ['starting'], starting: ['running', 'error'], running: ['stopping', 'error'], stopping: ['stopped', 'error'], stopped: [], error: ['starting'] };
    return valid[from]?.includes(to) ?? false;
}
