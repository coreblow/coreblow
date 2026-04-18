/** CoreBlow — Target Resolver */
export interface ResolvedTarget { targetId: string; channelId: string; type: string; }
export function resolveTarget(targetId: string, targets: Map<string, ResolvedTarget>): ResolvedTarget | null { return targets.get(targetId) ?? null; }
