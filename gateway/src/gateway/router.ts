/** Gateway Router */

export interface InboundMessage {
    channel: string;
    senderId: string;
    senderName?: string;
    sessionId: string;
    groupId?: string;
    text: string;
    timestamp: number;
    raw?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
}

export interface OutboundMessage {
    channel: string;
    targetId: string;
    senderId?: string;
    groupId?: string;
    text: string;
    raw?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
}

export interface MessageRouter {
    route(message: InboundMessage): Promise<void>;
    routeInbound(message: InboundMessage): Promise<void>;
    registerChannelSender(channel: string, sender: (msg: OutboundMessage) => Promise<void>): void;
    
    // Core methods used by orchestrator
    onMessage(handler: (msg: InboundMessage) => Promise<void>): void;
    sendReply(request: Pick<InboundMessage, 'channel' | 'text'> & Partial<InboundMessage>, content?: string): Promise<void>;
}

export const MessageRouter = {
    deriveSessionId(channel: string, userId: string, channelId?: string): string {
        return channelId ? `${channel}_${userId}_${channelId}` : `${channel}_${userId}`;
    }
};

export function createRouter(): MessageRouter {
    const senders = new Map<string, (msg: OutboundMessage) => Promise<void>>();
    return {
        async route(message) { /* routing logic */ },
        async routeInbound(message) { /* routing logic */ },
        registerChannelSender(ch, fn) { senders.set(ch, fn); },
        onMessage(handler) {},
        async sendReply(req, content) {}
    };
}
