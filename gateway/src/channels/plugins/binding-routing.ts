/** CoreBlow — Binding Routing */ export function resolveBindingRoute(channelId: string, threadId?: string): string { return threadId ? channelId + ":" + threadId : channelId; }
