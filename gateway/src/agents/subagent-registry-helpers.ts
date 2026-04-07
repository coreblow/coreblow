/** Subagent registry helper utilities. */
export function generateRegistryKey(parentId: string, agentId: string): string { return `${parentId}:${agentId}`; }
export function parseRegistryKey(key: string): { parentId: string; agentId: string } { const [parentId, agentId] = key.split(':'); return { parentId, agentId }; }
