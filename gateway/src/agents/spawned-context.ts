/** Context passed to spawned agents. */
export interface SpawnedContext { parentSessionId: string; depth: number; task: string; model?: string; tools?: string[]; maxTurns?: number; }
export function createSpawnedContext(parentSessionId: string, task: string, depth = 0): SpawnedContext { return { parentSessionId, depth, task, maxTurns: 20 }; }
