/** Agent Code Protocol spawn. */
export interface AcpSpawnOptions { agentId: string; task: string; timeout?: number; model?: string; }
export interface AcpResult { agentId: string; output: string; exitCode: number; duration: number; }
export function createAcpSpawnOptions(agentId: string, task: string): AcpSpawnOptions { return { agentId, task, timeout: 300_000 }; }
