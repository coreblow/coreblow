/**
 * agents/agent-stream-bridge.ts
 * Bridge between AgentEngine streaming and WebSocket clients.
 */
/** Stub: stream types */
type StreamChunk = { type: string; content: string; [key: string]: unknown };
type StreamHandler = (chunk: StreamChunk) => void;

export interface StreamClient {
    sessionId: string;
    clientId: string;
    send: (data: string) => void;
}

export class AgentStreamBridge {
    private clients = new Map<string, StreamClient[]>();

    /**
     * Register a client to receive stream events for a session.
     */
    subscribe(sessionId: string, clientId: string, send: (data: string) => void): () => void {
        const client: StreamClient = { sessionId, clientId, send };
        if (!this.clients.has(sessionId)) this.clients.set(sessionId, []);
        this.clients.get(sessionId)!.push(client);
        return () => { this.unsubscribe(sessionId, clientId); };
    }

    /**
     * Unsubscribe a client.
     */
    unsubscribe(sessionId: string, clientId: string): void {
        const list = this.clients.get(sessionId);
        if (!list) return;
        const filtered = list.filter(c => c.clientId !== clientId);
        if (filtered.length === 0) this.clients.delete(sessionId);
        else this.clients.set(sessionId, filtered);
    }

    /**
     * Create a StreamHandler that forwards chunks to all subscribed clients.
     */
    createStreamHandler(sessionId: string): StreamHandler {
        return (chunk: StreamChunk) => {
            const payload = JSON.stringify({ event: 'stream', sessionId, chunk });
            const list = this.clients.get(sessionId) ?? [];
            for (const client of list) {
                try { client.send(payload); } catch { /* client disconnected */ }
            }
        };
    }

    /**
     * Get count of subscribed clients for a session.
     */
    getSubscriberCount(sessionId: string): number {
        return this.clients.get(sessionId)?.length ?? 0;
    }

    /**
     * Clear all subscriptions.
     */
    clear(): void { this.clients.clear(); }
}
