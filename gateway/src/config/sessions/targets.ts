/** CoreBlow — Session Targets */
export interface SessionTarget { sessionId: string; channelId: string; priority: number; }
export function resolveSessionTarget(targets: SessionTarget[], channelId: string): SessionTarget | undefined { return targets.find((t) => t.channelId === channelId); }
