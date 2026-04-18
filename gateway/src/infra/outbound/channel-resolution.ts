/** CoreBlow — Channel Resolution */
export interface ResolvedChannel { channelId: string; type: string; displayName: string; priority: number; }
export function resolveChannels(channelIds: string[], channelMap: Map<string, ResolvedChannel>): ResolvedChannel[] { return channelIds.map((id) => channelMap.get(id)).filter((c): c is ResolvedChannel => !!c).sort((a, b) => b.priority - a.priority); }
