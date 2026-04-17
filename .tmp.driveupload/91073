/**
 * agents/turn-engine/channels/routing.ts
 * Channel routing logic for the turn engine.
 */

export interface ChannelRoute {
    channel: string;
    agentId: string;
    priority?: number;
    filter?: (message: { content: string; channel: string }) => boolean;
}

const channelRoutes: ChannelRoute[] = [];

export function addChannelRoute(route: ChannelRoute): void {
    channelRoutes.push(route);
    channelRoutes.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
}

export function resolveChannelRoute(channel: string, content?: string): string | null {
    for (const route of channelRoutes) {
        if (route.channel !== channel) continue;
        if (route.filter && content && !route.filter({ content, channel })) continue;
        return route.agentId;
    }
    return null;
}

export function clearChannelRoutes(): void {
    channelRoutes.length = 0;
}
