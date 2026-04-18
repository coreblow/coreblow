/** CoreBlow — Channel Activity Tracking */
export interface ChannelActivity { channelId: string; lastMessageAt: number; messageCount: number; }
const activities = new Map<string, ChannelActivity>();
export function recordChannelActivity(channelId: string): void { const now = Date.now(); const existing = activities.get(channelId); activities.set(channelId, { channelId, lastMessageAt: now, messageCount: (existing?.messageCount ?? 0) + 1 }); }
export function getChannelActivity(channelId: string): ChannelActivity | undefined { return activities.get(channelId); }
export function getAllChannelActivities(): ChannelActivity[] { return [...activities.values()]; }
export function clearChannelActivities(): void { activities.clear(); }
